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
  },
});

// TEMP: expose client to window for debugging refresh-bounce bug. Remove
// after the bug is fixed. Anon key is already public via the bundle and
// RLS protects all data, so this is safe — but it's not something we want
// permanently in production code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).supabase = supabase;
