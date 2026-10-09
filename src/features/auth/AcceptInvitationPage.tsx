import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Invitation, Contact } from "@/lib/database.types";
import { formatError } from "@/lib/errors";

/**
 * Accept-invitation page.
 *
 * Flow:
 * 1. Read the `token` from the URL.
 * 2. Look up the matching invitations row. Confirm it's not already used or
 *    expired. Pull the linked contact for display.
 * 3. Offer the user two ways to claim the account:
 *      a. Set a password (we sign them up with the invitation email + their
 *         chosen password).
 *      b. Continue with Google (handed off to FinishInvitationPage after OAuth).
 *
 * 4. Once signed in, finalize via the `accept_invitation` SECURITY DEFINER RPC,
 *    which links auth_user_id to the contact and stamps accepted_at atomically
 *    (permissioning Phase 1). Then redirect to the dashboard.
 *
 * Note: this page does NOT require the user to be logged in.
 */

type InvitationState =
  | { status: "loading" }
  | { status: "valid"; invitation: Invitation; contact: Contact }
  | { status: "invalid"; message: string };

export default function AcceptInvitationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [invitationState, setInvitationState] = useState<InvitationState>({ status: "loading" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Password path: Supabase's mailer_autoconfirm is OFF, so signUp() creates
  // the user but returns NO session until they click the confirmation email.
  // We can't call the RPC without a session, so we hand off to the
  // confirmation link (which lands on FinishInvitationPage with a session,
  // exactly like the Google path) and show this state meanwhile.
  const [confirmationSent, setConfirmationSent] = useState(false);

  // Validate the token on mount
  useEffect(() => {
    async function validate() {
      if (!token) {
        setInvitationState({ status: "invalid", message: "Missing invitation token." });
        return;
      }

      const { data: invitation, error: invErr } = await supabase
        .from("active_invitations")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (invErr || !invitation) {
        setInvitationState({
          status: "invalid",
          message: "We couldn't find that invitation. It may have been revoked.",
        });
        return;
      }

      if (invitation.accepted_at) {
        setInvitationState({
          status: "invalid",
          message: "This invitation has already been used. Please sign in instead.",
        });
        return;
      }

      if (invitation.revoked_at) {
        setInvitationState({
          status: "invalid",
          message: "This invitation has been revoked. Ask an admin for a new one.",
        });
        return;
      }

      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        setInvitationState({
          status: "invalid",
          message: "This invitation has expired. Ask an admin to send a new one.",
        });
        return;
      }

      const { data: contact, error: contactErr } = await supabase
        .from("active_contacts")
        .select("*")
        .eq("id", invitation.contact_id)
        .single();

      if (contactErr || !contact) {
        setInvitationState({
          status: "invalid",
          message: "The contact linked to this invitation could not be loaded.",
        });
        return;
      }

      setInvitationState({ status: "valid", invitation, contact });
    }
    validate();
  }, [token]);

  if (invitationState.status === "loading") {
    return (
      <CenteredCard>
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
          <Loader2 size={14} className="animate-spin" />
          Validating invitation…
        </div>
      </CenteredCard>
    );
  }

  if (invitationState.status === "invalid") {
    return (
      <CenteredCard>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-50 mb-3">
            <AlertCircle size={18} className="text-red-600" />
          </div>
          <p className="text-sm text-zinc-700">{invitationState.message}</p>
          <button
            onClick={() => navigate("/login")}
            className="mt-4 text-xs text-maroon-700 hover:underline"
          >
            Go to sign in
          </button>
        </div>
      </CenteredCard>
    );
  }

  const { invitation, contact } = invitationState;

  // Helper: after auth has completed, finalize acceptance via the
  // SECURITY DEFINER RPC. The RPC links the (now-authenticated) caller to the
  // invitation's contact AND stamps accepted_at, atomically, under definer
  // privileges — derived from auth.uid()/auth.jwt() server-side, not from any
  // value we pass. This replaces the old direct contacts/invitations writes
  // (permissioning Phase 1; see docs/permissioning-model.md §6).
  async function finalizeAcceptance() {
    const { error: rpcErr } = await supabase.rpc("accept_invitation", {
      p_token: invitation.token,
    });

    if (rpcErr) {
      throw new Error(rpcErr.message);
    }
  }

  // BOTH paths finalize on FinishInvitationPage, which has a session (so
  // auth.uid()/auth.jwt() are populated) and calls accept_invitation(). We
  // carry the invitation `token` so the two flows share one finalize call;
  // `email` is passed only for a friendly client-side mismatch message (the
  // RPC enforces the match authoritatively).
  const finishUrl = `${window.location.origin}/accept-invitation/finish?token=${encodeURIComponent(invitation.token)}&email=${encodeURIComponent(invitation.email)}`;

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        // Where the confirmation email's link lands. Supabase confirms the
        // address, establishes a session, and redirects here — so
        // FinishInvitationPage runs the RPC exactly as it does after Google.
        options: { emailRedirectTo: finishUrl },
      });

      if (signUpErr) {
        // If the user already has an auth account (e.g. they tried before
        // and bailed), Supabase will say so — they should sign in instead.
        if (/already registered/i.test(signUpErr.message)) {
          setError(
            "An account with this email already exists. Try signing in with your password instead.",
          );
        } else {
          setError(signUpErr.message);
        }
        return;
      }

      if (!data.user) {
        setError("Sign-up succeeded but no user was returned. Please try again.");
        return;
      }

      // Supabase's enumeration protection: for an ALREADY-registered email it
      // returns a user with no identities and no error — and sends no email.
      // Don't tell them to wait for one that isn't coming.
      if (data.user.identities && data.user.identities.length === 0) {
        setError(
          "An account with this email already exists. Sign in with your password, or use Google below.",
        );
        return;
      }

      if (data.session) {
        // Only when email confirmation is disabled: we already have a
        // session, so finalize right here.
        await finalizeAcceptance();
        navigate("/", { replace: true });
        return;
      }

      // Normal case (confirmation required): no session yet. The confirmation
      // email is on its way; acceptance completes when they click it.
      setConfirmationSent(true);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAccept = async () => {
    setError(null);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: finishUrl },
    });
    if (oauthErr) setError(oauthErr.message);
  };

  if (confirmationSent) {
    return (
      <CenteredCard>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-maroon-50 mb-3">
            <CheckCircle2 size={18} className="text-maroon-700" />
          </div>
          <h2 className="text-base font-semibold text-zinc-900">Check your email</h2>
          <p className="text-sm text-zinc-700 mt-2">
            We sent a confirmation link to{" "}
            <span className="font-medium">{invitation.email}</span>. Open it to
            finish creating your account — you'll land back here signed in.
          </p>
          <p className="text-xs text-zinc-500 mt-3">
            Didn't get it? Check your spam folder, or return to this invitation
            link and use "Continue with Google" instead.
          </p>
        </div>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-maroon-50 mb-3">
          <CheckCircle2 size={18} className="text-maroon-700" />
        </div>
        <h2 className="text-base font-semibold text-zinc-900">
          Welcome, {contact.first_name}.
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          You've been invited to access AMTA CRM. Set a password or continue with
          Google to claim your account.
        </p>
      </div>

      <form onSubmit={handleSetPassword} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
            Email
          </label>
          <input
            type="email"
            value={invitation.email}
            disabled
            className="w-full px-3 py-2 text-sm rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
            Choose a password
          </label>
          <div className="relative">
            <Lock
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-zinc-200 outline-none focus:border-maroon-700 transition-colors"
              placeholder="At least 8 characters"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
            Confirm password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-3 py-2 text-sm rounded-md border border-zinc-200 outline-none focus:border-maroon-700 transition-colors"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-600 px-1">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-maroon-700 hover:bg-maroon-800 disabled:opacity-60 transition-colors"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Set password and sign in
        </button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-2 bg-white text-xs text-zinc-400">or</span>
        </div>
      </div>

      <button
        onClick={handleGoogleAccept}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-zinc-200 hover:bg-zinc-50 transition-colors"
      >
        Continue with Google
      </button>
    </CenteredCard>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-zinc-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
