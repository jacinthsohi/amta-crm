import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Did you copy .env.example to .env and fill it in?",
  );
}

/**
 * Singleton Supabase client. Import this anywhere you need to talk to
 * Supabase — both for auth and for database queries.
 *
 * Type-parameterized with our Database schema, so all queries are
 * fully typed end-to-end.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Keep the user signed in across page reloads
    autoRefreshToken: true, // Refresh JWTs before they expire
    detectSessionInUrl: true, // Pick up auth tokens from URL fragments after OAuth

    // -----------------------------------------------------------------------
    // Workaround: refresh-bounce bug (May 2026)
    // -----------------------------------------------------------------------
    // Supabase JS v2 uses navigator.locks by default to coordinate token
    // refreshes across tabs. In our environment, the auth lock
    // ('lock:sb-<project>-auth-token') was being acquired during page init
    // but never released — every subsequent getSession() call would block
    // waiting for the lock and time out after 15s. That timeout was what
    // bounced signed-in users to the landing page after a Cmd+R.
    //
    // We diagnosed this by checking navigator.locks.query() after the
    // hang — the lock was held in exclusive mode by a clientId that was
    // no longer doing useful work.
    //
    // The fix: replace the default LockManager-based lock with a no-op
    // that just runs the callback immediately. We don't need cross-tab
    // coordination for our use case (single-user, mostly one tab at a
    // time). If a user has the app open in multiple tabs and both refresh
    // their token simultaneously, both refreshes will succeed — Supabase
    // is fine with this.
    //
    // Long-term: if Supabase fixes the underlying bug, this can be removed.
    // -----------------------------------------------------------------------
    lock: async (_name, _acquireTimeout, fn) => await fn(),
  },
});
