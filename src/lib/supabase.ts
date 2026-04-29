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
