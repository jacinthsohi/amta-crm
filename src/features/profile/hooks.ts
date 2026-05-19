import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
 * Note on parameter naming: the underlying Postgres functions use the
 * `p_` prefix convention (p_token, p_contact_id, ...) to avoid ambiguity
 * with column names inside the function bodies. PostgREST passes named
 * args literally, so the client must match.
 *
 * Returns both the load state and a `setProfile` updater that callers
 * can use to push fresh profile data into state (e.g. after a save).
 * Without this, the view-mode display would show stale values after
 * editing.
 *
 * States:
 *   - loading: initial fetch in flight
 *   - no_token: caller passed null/empty (URL has no ?token=)
 *   - invalid: token didn't resolve to a profile (expired, revoked, bad)
 *   - error: unexpected RPC failure
 *   - ready: profile loaded
 */
export function useProfile(token: string | null): {
  state: ProfileLoadState;
  setProfile: (data: ProfileData) => void;
} {
  const [state, setState] = useState<ProfileLoadState>(
    token ? { status: "loading" } : { status: "no_token" },
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
        p_token: token,
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

  const setProfile = useCallback((data: ProfileData) => {
    setState({ status: "ready", data });
  }, []);

  return { state, setProfile };
}

/**
 * Payload for the update_my_profile RPC. All `p_` prefixed to match
 * the Postgres function's parameter names. null clears the field.
 */
export type UpdateProfileInput = {
  p_token: string;
  p_first_name: string | null;
  p_last_name: string | null;
  p_pronouns: string | null;
  p_secondary_email: string | null;
  p_phone: string | null;
  p_current_city: string | null;
  p_current_state: string | null;
};

/**
 * Mutation hook for saving profile edits.
 *
 * On success the RPC returns the updated profile JSON and refreshes
 * the token's expiry by 30 days (per Chunk 1's design), so the same
 * URL remains valid. Callers should plumb the returned ProfileData
 * back into useProfile via setProfile so view-mode reflects the saved
 * values immediately.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<ProfileData> => {
      const { data, error } = await supabase.rpc("update_my_profile", input);
      if (error) throw error;
      if (!data) throw new Error("Profile update returned no data");
      return data as ProfileData;
    },
    onSuccess: () => {
      // Future-proofing: if we later cache profiles via React Query,
      // this is where we'd invalidate. No-op today.
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
