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

/**
 * Routes where the access gate must NOT run.
 *
 * /accept-invitation and /accept-invitation/finish handle their own auth
 * logic — they need a brief authenticated window to write contacts.auth_user_id
 * and invitations.accepted_at before the access gate fires. If the gate runs
 * on these routes, it races the acceptance flow and signs the user out before
 * acceptance completes.
 */
function isAcceptanceRoute(pathname: string) {
  return pathname.startsWith("/accept-invitation");
}

// Maximum time we'll wait for getSession() before giving up and treating the
// user as signed out. Earlier versions wiped localStorage and force-reloaded
// when this fired — that was destroying valid sessions on slow refreshes
// (the bug we hit on May 6). Now we just stop the loading spinner; the user
// can retry without losing their stored session.
const GET_SESSION_TIMEOUT_MS = 15_000;

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
    let cancelled = false;

    // Safety timeout: if getSession() never resolves (extremely rare), we don't
    // want the app stuck on "Loading…" forever. After 15s we set loading=false
    // and treat the user as signed out. We do NOT wipe localStorage — the
    // stored session might be perfectly valid and would survive a manual
    // refresh.
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      console.warn(
        "Auth getSession exceeded 15s timeout. Treating as signed-out for now; stored session preserved.",
      );
      setSession(null);
      setLoading(false);
    }, GET_SESSION_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        clearTimeout(timeoutId);

        if (data.session?.user) {
          const loaded = await loadContact(data.session.user.id);

          // Skip the access gate on acceptance routes — those pages
          // need a brief authenticated window to finalize the invitation.
          if (isAcceptanceRoute(window.location.pathname)) {
            if (cancelled) return;
            setSession(data.session);
            setContact(loaded);
          } else {
            const { allowed } = await enforceAccessGate(data.session.user, loaded);
            if (cancelled) return;

            if (allowed) {
              setSession(data.session);
              setContact(loaded);
            } else {
              await supabase.auth.signOut();
              setSession(null);
              setContact(null);
              setAccessDenied(true);
            }
          }
        } else {
          setSession(null);
          setContact(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
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

        // Same bypass on acceptance routes (this is the case that bit Maggy:
        // Google OAuth callback → onAuthStateChange fires → gate raced
        // FinishInvitationPage and signed her out before it could complete).
        if (isAcceptanceRoute(window.location.pathname)) {
          if (cancelled) return;
          setSession(newSession);
          setContact(loaded);
          setAccessDenied(false);
          return;
        }

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
      clearTimeout(timeoutId);
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
