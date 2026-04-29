import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * After a user picks "Continue with Google" on the AcceptInvitationPage, they
 * authenticate with Google and Google redirects them here.
 *
 * Our job:
 *   1. Confirm a session exists (Supabase will have populated it from the
 *      OAuth response).
 *   2. Confirm the invitation id from the URL.
 *   3. Confirm the Google account's email matches the invitation's email
 *      (otherwise someone could try to reuse a stolen invitation link).
 *   4. Link the auth user to the contact and mark the invitation accepted.
 *   5. Redirect to the dashboard.
 *
 * If anything fails we surface the error.
 */
export default function FinishInvitationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationId = searchParams.get("invitation");
  const expectedEmail = searchParams.get("email");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finalize() {
      if (!invitationId || !expectedEmail) {
        setError("Missing invitation context. Please start over from the original email.");
        return;
      }

      // Wait briefly for Supabase to ingest the OAuth response. The auth
      // listener in AuthProvider will populate the session shortly after.
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user) {
        setError("Sign-in did not complete. Please try the invitation link again.");
        return;
      }

      // Sanity check: the Google account's email matches the invited email
      const userEmail = (session.user.email ?? "").toLowerCase();
      if (userEmail !== expectedEmail.toLowerCase()) {
        setError(
          `You signed in as ${userEmail}, but the invitation was sent to ${expectedEmail}. Please sign in with the matching account.`,
        );
        return;
      }

      // Look up the invitation
      const { data: invitation, error: invErr } = await supabase
        .from("active_invitations")
        .select("*")
        .eq("id", invitationId)
        .maybeSingle();

      if (invErr || !invitation) {
        setError("We couldn't find the invitation. It may have been revoked.");
        return;
      }
      if (invitation.accepted_at) {
        // Idempotent — already accepted, just send them home
        if (!cancelled) navigate("/", { replace: true });
        return;
      }

      // Link contact and mark invitation accepted
      const { error: linkErr } = await supabase
        .from("contacts")
        .update({ auth_user_id: session.user.id })
        .eq("id", invitation.contact_id);
      if (linkErr) {
        setError(`Could not link contact: ${linkErr.message}`);
        return;
      }

      const { error: acceptErr } = await supabase
        .from("invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);
      if (acceptErr) {
        setError(`Could not mark invitation accepted: ${acceptErr.message}`);
        return;
      }

      if (!cancelled) navigate("/", { replace: true });
    }

    finalize();
    return () => {
      cancelled = true;
    };
  }, [invitationId, expectedEmail, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-zinc-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6">
          {error ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-50 mb-3">
                <AlertCircle size={18} className="text-red-600" />
              </div>
              <p className="text-sm text-zinc-700">{error}</p>
              <button
                onClick={() => navigate("/login")}
                className="mt-4 text-xs text-maroon-700 hover:underline"
              >
                Go to sign in
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 size={14} className="animate-spin" />
              Finalizing your account…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
