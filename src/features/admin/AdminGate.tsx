// src/features/admin/AdminGate.tsx
// =============================================================================
// Route wrapper for /admin/*. Renders children only if the user is admin.
// Non-admins get a 'not authorized' message rather than a 404, so they know
// the URL exists but they can't access it.
// =============================================================================

import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "./hooks";
import { useAuth } from "../../lib/auth";

export default function AdminGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();

  if (loading || adminLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Not authorized</h1>
        <p className="mt-2 text-sm text-zinc-600">
          You need admin access to view this page. If this is a mistake, contact{" "}
          <a
            href="mailto:help@collegemocktrial.org"
            className="text-maroon-700 underline"
          >
            help@collegemocktrial.org
          </a>
          .
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
