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
 *   2. Optionally show a friendly message if the Google email doesn't match
 *      the invited email (the URL carries `email` only for this UX hint).
 *   3. Finalize via the `accept_invitation` RPC, passing the invitation
 *      `token` from the URL. The RPC re-validates the token, enforces the
 *      email match authoritatively, links auth_user_id, and stamps
 *      accepted_at — atomically, under definer privileges (permissioning
 *      Phase 1; see docs/permissioning-model.md §6). It is idempotent, so a
 *      refresh after success just sends the user home.
 *   4. Redirect to the dashboard.
 *
 * If anything fails we surface the error.
 */
export default function FinishInvitationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const expectedEmail = searchParams.get("email");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finalize() {
      if (!token) {
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

      // Friendly pre-check: the Google account's email matches the invited
      // email. This is convenience only — the RPC enforces it authoritatively.
      const userEmail = (session.user.email ?? "").toLowerCase();
      if (expectedEmail && userEmail !== expectedEmail.toLowerCase()) {
        setError(
          `You signed in as ${userEmail}, but the invitation was sent to ${expectedEmail}. Please sign in with the matching account.`,
        );
        return;
      }

      // Finalize through the SECURITY DEFINER RPC. Idempotent: re-running after
      // a successful accept returns success ("already_accepted") rather than an
      // error, so a page refresh just sends the user home.
      const { error: rpcErr } = await supabase.rpc("accept_invitation", {
        p_token: token,
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }

      if (!cancelled) navigate("/", { replace: true });
    }

    finalize();
    return () => {
      cancelled = true;
    };
  }, [token, expectedEmail, navigate]);

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
