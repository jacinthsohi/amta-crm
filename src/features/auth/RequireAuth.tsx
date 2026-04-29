import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { ReactNode } from "react";

/**
 * Wrap any route that should require an authenticated user. Redirects to
 * /login (with a `?next=...` so we come back here afterward) if the user
 * is not signed in.
 *
 * While the initial auth check is in flight, render a thin loader so we
 * don't briefly flash the login page for already-signed-in users.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
        <Loader2 size={14} className="animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
