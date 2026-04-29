import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Contact } from "./database.types";

/**
 * Auth state shared across the app.
 *
 * - `session` / `user`: come from Supabase Auth (auth.users)
 * - `contact`: the row in our `contacts` table linked to this auth user
 *   (via contacts.auth_user_id). Many app screens want the contact-level
 *   info (first/last name, etc.) more than the auth-level info, so we
 *   resolve it once at sign-in and surface it here.
 * - `loading`: true while we're figuring out who the user is on first load.
 *   Used to prevent flashing the login screen for already-signed-in users.
 */
type AuthContextValue = {
  session: Session | null;
  user: User | null;
  contact: Contact | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve the contacts row matching the current auth user.
  // Returns null if no matching contact exists yet (e.g. an admin signed up
  // through Google before being invited — we'll handle this case below).
  async function loadContact(authUserId: string) {
    const { data, error } = await supabase
      .from("active_contacts")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error) {
      console.error("Failed to load contact:", error);
      return null;
    }
    return data;
  }

  useEffect(() => {
    // Fetch the initial session on app boot
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        setContact(await loadContact(data.session.user.id));
      }
      setLoading(false);
    });

    // Subscribe to auth changes (login, logout, token refresh, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setContact(await loadContact(newSession.user.id));
      } else {
        setContact(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setContact(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        contact,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
