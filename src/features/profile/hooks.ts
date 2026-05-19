import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type ProfileData = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  pronouns: string | null;
  email: string | null;
  secondary_email: string | null;
  phone: string | null;
  current_city: string | null;
  current_state: string | null;
  profile_photo_url: string | null;
};

export type ProfileLoadState =
  | { status: "loading" }
  | { status: "no_token" }
  | { status: "invalid" } // token doesn't resolve (expired, revoked, or never existed)
  | { status: "error"; message: string }
  | { status: "ready"; data: ProfileData };

/**
 * Loads a profile by magic-link token.
 *
 * States:
 *   - loading: initial fetch in flight
 *   - no_token: caller passed null/empty (URL has no ?token=)
 *   - invalid: token didn't resolve to a profile (expired, revoked, bad)
 *   - error: unexpected RPC failure
 *   - ready: profile loaded
 */
export function useProfile(token: string | null): ProfileLoadState {
  const [state, setState] = useState<ProfileLoadState>(
    token ? { status: "loading" } : { status: "no_token" }
  );

  useEffect(() => {
    if (!token) {
      setState({ status: "no_token" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      const { data, error } = await supabase.rpc("get_profile_by_token", {
        token,
      });

      if (cancelled) return;

      if (error) {
        setState({ status: "error", message: error.message });
        return;
      }

      if (!data) {
        setState({ status: "invalid" });
        return;
      }

      setState({ status: "ready", data: data as ProfileData });
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return state;
}
