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
 * - `accessDenied`: true if the user signed in but isn't on the invite list
 *   or in contacts. We sign them out immediately and surface a banner on
 *   the login page. (Issue #25.)
 */
type AuthContextValue = {
  session: Session | null;
  user: User | null;
  contact: Contact | null;
  loading: boolean;
  accessDenied: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Resolve the contacts row matching the current auth user.
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

  // Access gate (#25): a signed-in user is allowed if EITHER:
  //   - they have a contact row (loaded above), OR
  //   - their email has an accepted, unrevoked invitation.
  // If neither, sign them out and flag accessDenied so the login page can
  // show the "not invited" banner.
  async function checkAccessByInvitation(email: string): Promise<boolean> {
    const normalized = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from("invitations")
      .select("id")
      .eq("email", normalized)
      .not("accepted_at", "is", null)
      .is("revoked_at", null)
      .maybeSingle();
    if (error) {
      // Fail open on transient error — don't lock out a real user over a
      // network blip. Logged so we can flip to fail-closed if abused.
      console.warn("Invitation check failed, allowing through:", error);
      return true;
    }
    return Boolean(data);
  }

  async function enforceAccessGate(
    authUser: User,
    loadedContact: Contact | null,
  ): Promise<{ allowed: boolean }> {
    if (loadedContact) return { allowed: true };
    if (!authUser.email) return { allowed: false };
    const invited = await checkAccessByInvitation(authUser.email);
    return { allowed: invited };
  }

  useEffect(() => {
    // Stale-cache recovery: if cached Supabase session refers to creds the
    // server can't validate, getSession() can hang forever and the app stays
    // stuck on "Loading…". Race against a 5s timeout and force a fresh flow.
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const recoverFromStaleSession = () => {
      console.warn(
        "Auth getSession timed out — clearing stale Supabase localStorage and reloading.",
      );
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("sb-")) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // localStorage might be disabled (private browsing, etc.) — fall through
      }
      window.location.reload();
    };

    timeoutId = setTimeout(() => {
      if (cancelled) return;
      recoverFromStaleSession();
    }, 5000);

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        if (timeoutId) clearTimeout(timeoutId);

        if (data.session?.user) {
          const loaded = await loadContact(data.session.user.id);
          const { allowed } = await enforceAccessGate(data.session.user, loaded);
          if (cancelled) return;

          if (allowed) {
            setSession(data.session);
            setContact(loaded);
          } else {
            // Not invited. Sign out and flag for the login banner.
            await supabase.auth.signOut();
            setSession(null);
            setContact(null);
            setAccessDenied(true);
          }
        } else {
          setSession(null);
          setContact(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (timeoutId) clearTimeout(timeoutId);
        console.error("Auth getSession failed:", err);
        setSession(null);
        setLoading(false);
      });

    // Subscribe to auth changes (login, logout, token refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (cancelled) return;

      if (newSession?.user) {
        const loaded = await loadContact(newSession.user.id);
        const { allowed } = await enforceAccessGate(newSession.user, loaded);
        if (cancelled) return;

        if (allowed) {
          setSession(newSession);
          setContact(loaded);
          setAccessDenied(false);
        } else {
          await supabase.auth.signOut();
          setSession(null);
          setContact(null);
          setAccessDenied(true);
        }
      } else {
        setSession(null);
        setContact(null);
      }
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setContact(null);
    setAccessDenied(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        contact,
        loading,
        accessDenied,
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
