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
 *         chosen password; a Supabase trigger can later link auth_user_id,
 *         but we do it client-side here for simplicity).
 *      b. Continue with Google. After OAuth returns, we verify the Google
 *         email matches the invitation email, then link the contact.
 *
 * 4. Mark the invitation as accepted and redirect to the dashboard.
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

  // Helper: after auth has completed, link the auth user to the contact and
  // mark the invitation as accepted.
  async function finalizeAcceptance(authUserId: string) {
    const { error: linkErr } = await supabase
      .from("contacts")
      .update({ auth_user_id: authUserId })
      .eq("id", contact.id);

    if (linkErr) {
      throw new Error(`Could not link contact: ${linkErr.message}`);
    }

    const { error: acceptErr } = await supabase
      .from("invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    if (acceptErr) {
      throw new Error(`Could not mark invitation accepted: ${acceptErr.message}`);
    }
  }

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

      await finalizeAcceptance(data.user.id);
      navigate("/", { replace: true });
    } catch (e) {
      setError(formatError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAccept = async () => {
    setError(null);
    // After Google OAuth, we land on a page that has access to auth.uid() via
    // the session. We append `?invitation=<id>` so the post-OAuth handler
    // (in App.tsx) knows to finalize this invitation.
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/accept-invitation/finish?invitation=${invitation.id}&email=${encodeURIComponent(invitation.email)}`,
      },
    });
    if (oauthErr) setError(oauthErr.message);
  };

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
