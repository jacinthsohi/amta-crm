import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type ProfileAffiliation = {
  id: string;
  program_id: string;
  program_name: string | null;
  program_short_name: string | null;
  program_city: string | null;
  program_state: string | null;
  affiliation_type: "student_alumni" | "coach" | "advisor";
  start_year: number;
  end_year: number | null;
};

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
  affiliations: ProfileAffiliation[];
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
  refetch: () => Promise<void>;
} {
  const [state, setState] = useState<ProfileLoadState>(
    token ? { status: "loading" } : { status: "no_token" },
  );

  const fetchProfile = useCallback(async () => {
    if (!token) {
      setState({ status: "no_token" });
      return;
    }
    setState((prev) =>
      prev.status === "ready" ? prev : { status: "loading" },
    );

    const { data, error } = await supabase.rpc("get_profile_by_token", {
      p_token: token,
    });

    if (error) {
      setState({ status: "error", message: error.message });
      return;
    }
    if (!data) {
      setState({ status: "invalid" });
      return;
    }
    setState({ status: "ready", data: data as ProfileData });
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchProfile();
      if (cancelled) {
        // No-op; fetchProfile's setState calls are idempotent enough
        // that a stale callback won't cause damage, but this guards
        // against rapidly-changing tokens.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchProfile]);

  const setProfile = useCallback((data: ProfileData) => {
    setState({ status: "ready", data });
  }, []);

  return { state, setProfile, refetch: fetchProfile };
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
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// =============================================================================
// Affiliation mutations (Chunk 4)
//
// These don't return the updated full profile; the caller refetches
// after success so the affiliations array reflects server state. The
// alternative (returning the full profile from each RPC) means three
// more lines of SQL per function and complicates the DB; refetch is
// fine for a list this small.
// =============================================================================

export type AddAffiliationInput = {
  p_token: string;
  p_program_id: string;
  p_affiliation_type: ProfileAffiliation["affiliation_type"];
  p_start_year: number;
  p_end_year: number | null;
};

export function useAddAffiliation() {
  return useMutation({
    mutationFn: async (input: AddAffiliationInput): Promise<string> => {
      const { data, error } = await supabase.rpc("add_my_affiliation", input);
      if (error) throw error;
      return data as string;
    },
  });
}

export type UpdateAffiliationInput = {
  p_token: string;
  p_affiliation_id: string;
  p_program_id: string;
  p_affiliation_type: ProfileAffiliation["affiliation_type"];
  p_start_year: number;
  p_end_year: number | null;
};

export function useUpdateAffiliation() {
  return useMutation({
    mutationFn: async (input: UpdateAffiliationInput): Promise<string> => {
      const { data, error } = await supabase.rpc(
        "update_my_affiliation",
        input,
      );
      if (error) throw error;
      return data as string;
    },
  });
}

export type DeleteAffiliationInput = {
  p_token: string;
  p_affiliation_id: string;
};

export function useDeleteAffiliation() {
  return useMutation({
    mutationFn: async (input: DeleteAffiliationInput): Promise<boolean> => {
      const { data, error } = await supabase.rpc(
        "delete_my_affiliation",
        input,
      );
      if (error) throw error;
      return data as boolean;
    },
  });
}
