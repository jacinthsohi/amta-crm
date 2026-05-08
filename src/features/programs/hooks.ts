import { useMemo } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Program,
  ProgramAffiliation,
  Contact,
} from "@/lib/database.types";

const KEYS = {
  programs: ["programs"] as const,
  programsInfinite: ["programs", "infinite"] as const,
  programsAll: ["programs", "all"] as const,
  program: (id: string) => ["program", id] as const,
  programAffiliations: (id: string) => ["program-affiliations", id] as const,
};

// Page size for the paginated list. 50 is a comfortable batch — enough to feel
// substantial, small enough to keep first-page render fast.
export const PROGRAMS_PAGE_SIZE = 50;

// =============================================================================
// useInfinitePrograms — paginated list query for the Programs page
// =============================================================================
// Uses cursor-based pagination on `name` (the displayed sort order). Each page
// fetches PROGRAMS_PAGE_SIZE + 1 rows; the extra row is used to determine if
// there's a next page without a separate count() query.
//
// We sort by name ASC because that's the user-facing display order, so cursor
// pagination matches what the user sees.
// =============================================================================
export function useInfinitePrograms() {
  return useInfiniteQuery<Program[], Error>({
    queryKey: KEYS.programsInfinite,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from("active_programs")
        .select("*")
        .order("name", { ascending: true })
        .limit(PROGRAMS_PAGE_SIZE + 1); // +1 to detect if there's a next page

      // pageParam is the last name from the previous page — paginate after it
      if (pageParam) {
        query = query.gt("name", pageParam as string);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      // If we got back fewer than PAGE_SIZE+1, there's no next page
      if (lastPage.length <= PROGRAMS_PAGE_SIZE) return undefined;
      // Otherwise the last "real" item's name is the cursor for the next page
      return lastPage[PROGRAMS_PAGE_SIZE - 1]?.name;
    },
  });
}

// =============================================================================
// useAllPrograms — fetches every program in a single call
// =============================================================================
// Used in two cases:
//   1. When the user is searching/filtering (we need all rows to search across)
//   2. When the user clicks CSV export (export should include all rows, not
//      just the currently-loaded paginated subset)
//
// `enabled` is controlled by the caller so this only fires when needed.
// =============================================================================
export function useAllPrograms(enabled: boolean) {
  return useQuery<Program[]>({
    queryKey: KEYS.programsAll,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_programs")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// =============================================================================
// usePrograms — legacy lookup query (kept for compatibility with other features)
// =============================================================================
// Other parts of the app (ProgramSelector, etc.) still call this for
// dropdown-style lookups. Keep it returning the full list so we don't break
// anything else.
// =============================================================================
export function usePrograms() {
  return useQuery<Program[]>({
    queryKey: KEYS.programs,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_programs")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// =============================================================================
// useProgram — single program with affiliated contacts grouped by type
// =============================================================================
export type ProgramWithAffiliations = Program & {
  affiliations: (ProgramAffiliation & {
    contact: Contact | null;
  })[];
};

export function useProgram(id: string | undefined) {
  return useQuery<ProgramWithAffiliations | null>({
    queryKey: id ? KEYS.program(id) : ["program", "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const [programRes, affsRes, contactsRes] = await Promise.all([
        supabase.from("active_programs").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("active_program_affiliations")
          .select("*")
          .eq("program_id", id)
          .order("start_year", { ascending: false }),
        supabase.from("active_contacts").select("*"),
      ]);

      if (programRes.error) throw programRes.error;
      if (!programRes.data) return null;
      if (affsRes.error) throw affsRes.error;
      if (contactsRes.error) throw contactsRes.error;

      const contactById = new Map(
        (contactsRes.data ?? []).map((c) => [c.id, c]),
      );

      return {
        ...programRes.data,
        affiliations: (affsRes.data ?? []).map((a) => ({
          ...a,
          contact: contactById.get(a.contact_id) ?? null,
        })),
      };
    },
  });
}

// =============================================================================
// useUpsertProgram
// =============================================================================
type UpsertProgramInput = {
  id?: string;
  name: string;
  short_name: string;
  city: string | null;
  state: string | null;
  website: string | null;
  status: "active" | "inactive";
  joined_year: number | null;
  notes: string | null;
};

export function useUpsertProgram() {
  const qc = useQueryClient();
  return useMutation<Program, Error, UpsertProgramInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("programs")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("programs")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (program) => {
      qc.invalidateQueries({ queryKey: KEYS.programs });
      qc.invalidateQueries({ queryKey: KEYS.programsInfinite });
      qc.invalidateQueries({ queryKey: KEYS.programsAll });
      qc.invalidateQueries({ queryKey: KEYS.program(program.id) });
      qc.invalidateQueries({ queryKey: ["programs-lookup"] });
    },
  });
}

// =============================================================================
// useSoftDeleteProgram
// =============================================================================
export function useSoftDeleteProgram() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("soft_delete", {
        table_name: "programs",
        row_id: id,
      });
      if (error) throw error;
      return data ?? id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.programs });
      qc.invalidateQueries({ queryKey: KEYS.programsInfinite });
      qc.invalidateQueries({ queryKey: KEYS.programsAll });
      qc.invalidateQueries({ queryKey: ["programs-lookup"] });
    },
  });
}

// =============================================================================
// Helpers — grouping affiliations by type, computing "is current"
// =============================================================================
export function isCurrentAffiliation(a: ProgramAffiliation): boolean {
  if (!a.end_year) return true;
  return a.end_year >= new Date().getFullYear();
}

export function useGroupedAffiliations(
  affiliations: ProgramWithAffiliations["affiliations"] | undefined,
) {
  return useMemo(() => {
    const coaches: typeof affiliations = [];
    const current: typeof affiliations = [];
    const alumni: typeof affiliations = [];
    const advisors: typeof affiliations = [];

    for (const a of affiliations ?? []) {
      if (!a.contact) continue;
      if (a.affiliation_type === "coach") coaches!.push(a);
      else if (a.affiliation_type === "advisor") advisors!.push(a);
      else if (a.affiliation_type === "student_alumni") {
        if (isCurrentAffiliation(a)) current!.push(a);
        else alumni!.push(a);
      }
    }

    return { coaches, current, alumni, advisors };
  }, [affiliations]);
}
