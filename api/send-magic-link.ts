import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";

/**
 * POST /api/send-magic-link
 *
 * Generates a fresh profile magic-link token for a contact and emails it
 * to them via SendGrid. The admin-facing alternative to copy/pasting the
 * link out of the "Generate magic link" modal.
 *
 * Auth: requires a valid Supabase JWT in the Authorization header
 * ("Bearer <token>"). The caller MUST be an admin — unlike contact-summary,
 * this endpoint mints access tokens, so "any logged-in user" is not a
 * sufficient bar. Non-admins get 403.
 *
 * Request body:
 *   { contact_id: string }
 *
 * Response:
 *   200 { ok: true, sent_to: string }   — email dispatched
 *   4xx/5xx { error: string }           — see status code
 *
 * Env vars required:
 *   VITE_SUPABASE_URL          — Supabase project URL
 *   VITE_SUPABASE_ANON_KEY     — Supabase anon key (JWT verification)
 *   SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key (privileged work)
 *   SENDGRID_API_KEY           — SendGrid API key (server-only)
 *   PROFILE_LINK_BASE_URL      — Base URL for the profile page, e.g.
 *                                 "https://crm.mocktrial.tech". The magic
 *                                 link is `${base}/profile?token=...`.
 *
 * NOTE: as of this writing SENDGRID_API_KEY is not yet populated in Vercel
 * (pending SendGrid account access). Until it is, this endpoint will return
 * 500 "Server misconfigured" on the SendGrid step. Everything up to the
 * actual send is testable; the send itself needs the key + verified domain.
 */

export const config = {
  runtime: "edge",
};

const FROM_EMAIL = "help@collegemocktrial.org";
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

function getProfileLinkBaseUrl(): string {
  const base = process.env.PROFILE_LINK_BASE_URL;
  if (!base) throw new Error("PROFILE_LINK_BASE_URL is not set");
  // Strip any trailing slash so we can safely append "/profile?token=".
  return base.replace(/\/+$/, "");
}

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError(405, "Method not allowed. Use POST.");
  }

  // ---- 1. Auth header present ----------------------------------------------
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError(401, "Missing or malformed Authorization header.");
  }

  // ---- 2. Parse + validate body --------------------------------------------
  let contactId: string;
  try {
    const body = (await request.json()) as { contact_id?: unknown };
    if (typeof body.contact_id !== "string" || !body.contact_id) {
      return jsonError(400, "Request body must include 'contact_id' (string).");
    }
    contactId = body.contact_id;
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  // ---- 3. Initialize clients -----------------------------------------------
  let anonClient;
  let serviceClient;
  try {
    anonClient = getAnonClient();
    serviceClient = getServiceClient();
  } catch (e) {
    return jsonError(500, "Server misconfigured: " + (e as Error).message);
  }

  // ---- 4. Verify the JWT identifies a real user ----------------------------
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonError(401, "Invalid or expired session.");
  }
  const callerAuthUserId = userData.user.id;

  // ---- 5. Verify the caller is an ADMIN ------------------------------------
  // Mirrors is_current_user_admin(): a contact row whose auth_user_id matches
  // the caller, not soft-deleted, with is_admin = true. Unlike contact-summary,
  // we gate on admin because this endpoint mints profile access tokens.
  const { data: callerContact, error: callerErr } = await serviceClient
    .from("contacts")
    .select("id, is_admin")
    .eq("auth_user_id", callerAuthUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (callerErr) {
    return jsonError(500, "Could not verify caller permissions.");
  }
  if (!callerContact || callerContact.is_admin !== true) {
    return jsonError(
      403,
      "Only admins can send profile links. If you believe this is an error, contact an AMTA administrator.",
    );
  }

  // ---- 6. Load the target contact ------------------------------------------
  const { data: targetContact, error: targetErr } = await serviceClient
    .from("contacts")
    .select("id, first_name, email")
    .eq("id", contactId)
    .is("deleted_at", null)
    .maybeSingle();

  if (targetErr) {
    return jsonError(500, "Database error loading the target contact.");
  }
  if (!targetContact) {
    return jsonError(404, "That contact could not be found.");
  }
  if (!targetContact.email) {
    return jsonError(
      422,
      "That contact has no email address on file, so there's nowhere to send the link.",
    );
  }

  // ---- 7. Mint a fresh magic-link token ------------------------------------
  // create_profile_token_service() is the service-role-only token mint. It
  // revokes any prior active token for the contact and returns a new one.
  // It deliberately has NO is_current_user_admin() gate (auth.uid() is NULL
  // under the service role) — authorization is THIS function's job, done in
  // step 5 above. See migration 20260517_create_profile_token_service.sql
  // for the full rationale.
  const { data: newToken, error: mintErr } = await serviceClient.rpc(
    "create_profile_token_service",
    { p_contact_id: contactId },
  );

  if (mintErr) {
    return jsonError(500, "Could not generate a new profile link.");
  }
  if (typeof newToken !== "string" || !newToken) {
    return jsonError(500, "Token mint returned an unexpected result.");
  }

  // ---- 8. Build the magic-link URL -----------------------------------------
  let magicUrl: string;
  try {
    magicUrl = `${getProfileLinkBaseUrl()}/profile?token=${newToken}`;
  } catch (e) {
    return jsonError(500, "Server misconfigured: " + (e as Error).message);
  }

  // ---- 9. Send the email via SendGrid --------------------------------------
  let sg;
  try {
    sg = getSendGrid();
  } catch (e) {
    // SENDGRID_API_KEY not yet set — see file header note.
    return jsonError(500, "Server misconfigured: " + (e as Error).message);
  }

  const firstName = targetContact.first_name || "there";
  const emailText = buildMagicLinkEmailText(firstName, magicUrl);

  try {
    await sg.send({
      to: targetContact.email,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: "Your AMTA profile link",
      text: emailText,
    });
  } catch (e) {
    // SendGrid SDK errors carry a response body with useful detail.
    const msg =
      (e as any)?.response?.body?.errors?.[0]?.message ??
      (e as Error).message ??
      "SendGrid send failed";
    return jsonError(502, "Email service error: " + msg);
  }

  return new Response(
    JSON.stringify({ ok: true, sent_to: targetContact.email }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
}

// -----------------------------------------------------------------------------
// Email body — plain text v1. Branded HTML wrapper is a deferred v2 item.
// Mirrors the copy from the Profile V1 "Compose email" mailto draft.
// -----------------------------------------------------------------------------

function buildMagicLinkEmailText(firstName: string, magicUrl: string): string {
  return `Hi ${firstName},

Here's a personal link you can use to update your contact info on file with AMTA:

${magicUrl}

The link is good for 30 days and refreshes whenever you save changes. Just click it (no password needed) and you'll be able to update your name, pronouns, phone, and other details directly.

Let me know if you have any trouble!

— AMTA`;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
