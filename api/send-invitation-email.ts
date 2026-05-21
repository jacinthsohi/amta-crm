import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import { renderBrandedEmail } from "./_email-template";

/**
 * POST /api/send-invitation-email
 *
 * Emails an existing CRM invitation to its recipient via SendGrid.
 *
 * This does NOT create the invitation. The invitation row already exists
 * (created client-side by useSendInvitation / refreshed by useResendInvitation
 * in src/features/admin/hooks.ts). This endpoint loads that row by id and
 * emails the /accept-invitation link. On a successful send it stamps
 * `sent_at` with the real send time — making that column honest (it is set
 * to row-creation time on insert, since it is NOT NULL, then overwritten
 * here when the email actually goes out).
 *
 * Auth: requires a valid Supabase JWT in the Authorization header
 * ("Bearer <token>"). The caller MUST be an admin. Non-admins get 403.
 *
 * Request body:
 *   { invitation_id: string }
 *
 * Response:
 *   200 { ok: true, sent_to: string }   — email dispatched, sent_at updated
 *   4xx/5xx { error: string }           — see status code
 *
 * Env vars required:
 *   VITE_SUPABASE_URL          — Supabase project URL
 *   VITE_SUPABASE_ANON_KEY     — Supabase anon key (JWT verification)
 *   SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key (privileged work)
 *   SENDGRID_API_KEY           — SendGrid API key (server-only)
 *   PROFILE_LINK_BASE_URL      — Base URL of the app, e.g.
 *                                 "https://crm.mocktrial.tech". The invite
 *                                 link is `${base}/accept-invitation?token=`.
 *
 * RUNTIME NOTE — READ BEFORE EDITING:
 *   Vercel NODE runtime, not Edge — same as api/send-magic-link.ts and for
 *   the same reason (@sendgrid/mail needs Node built-ins). Node handlers get
 *   Express-style (req, res), NOT Web Request/Response. See the longer note
 *   in send-magic-link.ts. Do not "simplify" to match the Edge functions.
 */

export const config = {
  runtime: "nodejs",
};

const FROM_EMAIL = "amta@collegemocktrial.org";
const FROM_NAME = "American Mock Trial Association";

// -----------------------------------------------------------------------------
// Lazy-initialized clients
// -----------------------------------------------------------------------------

function getAnonClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set");
  }
  return createClient(supabaseUrl, anonKey);
}

function getServiceClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

function getSendGrid() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("SENDGRID_API_KEY is not set");
  sgMail.setApiKey(apiKey);
  return sgMail;
}

function getAppBaseUrl(): string {
  // Reuses PROFILE_LINK_BASE_URL — it's the app origin, not profile-specific.
  const base = process.env.PROFILE_LINK_BASE_URL;
  if (!base) throw new Error("PROFILE_LINK_BASE_URL is not set");
  return base.replace(/\/+$/, "");
}

// -----------------------------------------------------------------------------
// Main handler — Node runtime: (req, res) signature
// -----------------------------------------------------------------------------

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  // ---- 1. Auth header present ----------------------------------------------
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header." });
    return;
  }

  // ---- 2. Parse + validate body --------------------------------------------
  const body = req.body as { invitation_id?: unknown } | undefined;
  if (!body || typeof body.invitation_id !== "string" || !body.invitation_id) {
    res.status(400).json({
      error: "Request body must include 'invitation_id' (string).",
    });
    return;
  }
  const invitationId = body.invitation_id;

  // ---- 3. Initialize clients -----------------------------------------------
  let anonClient;
  let serviceClient;
  try {
    anonClient = getAnonClient();
    serviceClient = getServiceClient();
  } catch (e) {
    res.status(500).json({
      error: "Server misconfigured: " + (e as Error).message,
    });
    return;
  }

  // ---- 4. Verify the JWT identifies a real user ----------------------------
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }
  const callerAuthUserId = userData.user.id;

  // ---- 5. Verify the caller is an ADMIN ------------------------------------
  // Same admin gate as send-magic-link: a non-deleted contact row whose
  // auth_user_id matches the caller, with is_admin = true.
  const { data: callerContact, error: callerErr } = await serviceClient
    .from("contacts")
    .select("id, is_admin")
    .eq("auth_user_id", callerAuthUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (callerErr) {
    res.status(500).json({ error: "Could not verify caller permissions." });
    return;
  }
  if (!callerContact || callerContact.is_admin !== true) {
    res.status(403).json({
      error:
        "Only admins can send invitations. If you believe this is an error, contact an AMTA administrator.",
    });
    return;
  }

  // ---- 6. Load the invitation ----------------------------------------------
  const { data: invitation, error: invErr } = await serviceClient
    .from("invitations")
    .select("id, email, token, contact_id, accepted_at, revoked_at")
    .eq("id", invitationId)
    .maybeSingle();

  if (invErr) {
    res.status(500).json({ error: "Database error loading the invitation." });
    return;
  }
  if (!invitation) {
    res.status(404).json({ error: "That invitation could not be found." });
    return;
  }

  // Defensive validation. invitations.email is NOT NULL, but a row could
  // theoretically hold an empty/whitespace string; catch that here so it
  // fails with a clear message rather than a confusing SendGrid rejection.
  const recipientEmail =
    typeof invitation.email === "string" ? invitation.email.trim() : "";
  if (!recipientEmail) {
    res.status(422).json({
      error: "This invitation has no email address on file.",
    });
    return;
  }
  if (!invitation.token) {
    res.status(422).json({
      error: "This invitation is missing its token and can't be emailed.",
    });
    return;
  }

  // Don't email invitations that are already done or cancelled. The UI
  // shouldn't offer it, but guard server-side too.
  if (invitation.accepted_at) {
    res.status(409).json({
      error: "This invitation has already been accepted.",
    });
    return;
  }
  if (invitation.revoked_at) {
    res.status(409).json({
      error: "This invitation has been revoked. Resend it to reactivate.",
    });
    return;
  }

  // ---- 7. Build the invitation URL -----------------------------------------
  let inviteUrl: string;
  try {
    inviteUrl = `${getAppBaseUrl()}/accept-invitation?token=${invitation.token}`;
  } catch (e) {
    res.status(500).json({
      error: "Server misconfigured: " + (e as Error).message,
    });
    return;
  }

  // ---- 8. Look up the recipient's first name (nice-to-have) ----------------
  // The invitation row has contact_id; a first name personalizes the email.
  // If this lookup fails for any reason, fall back to a generic greeting —
  // a missing first name must NOT block the send.
  let firstName = "there";
  const { data: inviteeContact } = await serviceClient
    .from("contacts")
    .select("first_name")
    .eq("id", invitation.contact_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (inviteeContact?.first_name) {
    firstName = inviteeContact.first_name;
  }

  // ---- 9. Send the email via SendGrid --------------------------------------
  let sg;
  try {
    sg = getSendGrid();
  } catch (e) {
    res.status(500).json({
      error: "Server misconfigured: " + (e as Error).message,
    });
    return;
  }

  const emailText = buildInvitationEmailText(firstName, inviteUrl);
  const emailHtml = buildInvitationEmailHtml(firstName, inviteUrl);

  try {
    await sg.send({
      to: recipientEmail,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: "You're invited to the AMTA CRM",
      text: emailText,
      html: emailHtml,
    });
  } catch (e) {
    const msg =
      (e as any)?.response?.body?.errors?.[0]?.message ??
      (e as Error).message ??
      "SendGrid send failed";
    res.status(502).json({ error: "Email service error: " + msg });
    return;
  }

  // ---- 10. Stamp sent_at with the real send time ---------------------------
  // Makes the column honest: it now reflects when the email actually went
  // out, not when the row was created. A failure here is logged but does
  // NOT fail the request — the email already went out, which is what the
  // caller cares about. Worst case sent_at keeps the creation timestamp.
  const { error: stampErr } = await serviceClient
    .from("invitations")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", invitation.id);
  if (stampErr) {
    console.error(
      "[send-invitation-email] email sent but sent_at update failed:",
      stampErr.message,
    );
  }

  res.status(200).json({ ok: true, sent_to: recipientEmail });
}

// -----------------------------------------------------------------------------
// Email body — plain-text fallback + branded HTML (via ./_email-template).
// Keep the two in sync if the copy changes.
// -----------------------------------------------------------------------------

function buildInvitationEmailText(firstName: string, inviteUrl: string): string {
  return `Hi ${firstName},

You've been invited to the American Mock Trial Association CRM. Use the link below to accept your invitation and set up access:

${inviteUrl}

The invitation link is good for 14 days. When you open it you'll be able to sign in and get started.

Let us know if you have any trouble!

— AMTA`;
}

function buildInvitationEmailHtml(firstName: string, inviteUrl: string): string {
  return renderBrandedEmail({
    title: "You're invited to the AMTA CRM",
    greeting: `Hi ${firstName},`,
    bodyParagraphs: [
      "You've been invited to the American Mock Trial Association CRM. Use the button below to accept your invitation and set up access.",
    ],
    buttonLabel: "Accept Invitation",
    buttonUrl: inviteUrl,
    finePrint: [
      "The invitation link is good for 14 days. When you open it you'll be able to sign in and get started.",
    ],
    footerNote:
      "American Mock Trial Association · You're receiving this because an AMTA administrator invited you to the CRM. If that wasn't expected, you can safely ignore this email.",
  });
}
