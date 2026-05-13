// =============================================================================
// src/features/data/hooks.ts
// =============================================================================
// Data hooks for the KPI dashboard at /data.
//
// One composite query returns everything the page needs:
//   - Active program count
//   - Active alumni count
//   - Active current board member count
//   - Per-state counts for the heatmap (Programs view and Alumni view)
//
// All test-tagged contacts are excluded from the alumni count, board count,
// and alumni-per-state aggregation. Programs `is_test` was punted (see
// BACKLOG.md), so the program count and per-state map include all programs
// — but only the Midlands State row would be affected, and it has no
// state populated so it doesn't appear on the heatmap anyway.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { TEST_CATEGORY_NAME } from "@/lib/test-data";

export type StateCount = { state: string; count: number };

export type DataDashboard = {
  programCount: number;
  alumniCount: number;
  boardMemberCount: number;

  // For heatmaps. Keys are full state names ("California", not "CA").
  programsByState: Map<string, number>;
  alumniByState: Map<string, number>;

  // For the international-programs callout. Total programs outside USA.
  internationalProgramCount: number;
};

// Query key — exposed so other components could invalidate this if needed.
export const dataDashboardQueryKey = ["data-dashboard"] as const;

export function useDataDashboard() {
  return useQuery<DataDashboard>({
    queryKey: dataDashboardQueryKey,
    queryFn: fetchDataDashboard,
    // Refresh every 5 min on the page; the data is fairly stable.
    staleTime: 5 * 60 * 1000,
  });
}

async function fetchDataDashboard(): Promise<DataDashboard> {
  // Parallel-fetch everything in one round trip
  const [
    programsRes,
    contactCategoriesRes,
    contactCategoryAssignmentsRes,
    affiliationsRes,
  ] = await Promise.all([
    supabase.from("active_programs").select("id, state, country"),
    supabase.from("active_contact_categories").select("id, name"),
    supabase
      .from("active_contact_category_assignments")
      .select("contact_id, category_id"),
    supabase
      .from("active_program_affiliations")
      .select("contact_id, program_id"),
  ]);

  if (programsRes.error) throw programsRes.error;
  if (contactCategoriesRes.error) throw contactCategoriesRes.error;
  if (contactCategoryAssignmentsRes.error)
    throw contactCategoryAssignmentsRes.error;
  if (affiliationsRes.error) throw affiliationsRes.error;

  const programs = programsRes.data ?? [];
  const categories = contactCategoriesRes.data ?? [];
  const assignments = contactCategoryAssignmentsRes.data ?? [];
  const affiliations = affiliationsRes.data ?? [];

  const categoryIdByName = new Map<string, string>();
  for (const cat of categories) categoryIdByName.set(cat.name, cat.id);

  const testCatId = categoryIdByName.get(TEST_CATEGORY_NAME);
  const alumniCatId = categoryIdByName.get("Alumni");
  const boardCatId = categoryIdByName.get("Current Board Member");

  const testContactIds = new Set<string>();
  if (testCatId) {
    for (const a of assignments) {
      if (a.category_id === testCatId) testContactIds.add(a.contact_id);
    }
  }

  const alumniContactIds = new Set<string>();
  if (alumniCatId) {
    for (const a of assignments) {
      if (a.category_id === alumniCatId && !testContactIds.has(a.contact_id)) {
        alumniContactIds.add(a.contact_id);
      }
    }
  }

  const boardContactIds = new Set<string>();
  if (boardCatId) {
    for (const a of assignments) {
      if (a.category_id === boardCatId && !testContactIds.has(a.contact_id)) {
        boardContactIds.add(a.contact_id);
      }
    }
  }

  const programsByState = new Map<string, number>();
  let internationalProgramCount = 0;
  for (const p of programs) {
    if (p.country && p.country !== "USA") {
      internationalProgramCount += 1;
      continue;
    }
    if (!p.state) continue;
    programsByState.set(p.state, (programsByState.get(p.state) ?? 0) + 1);
  }

  const programStateById = new Map<string, string | null>();
  const programCountryById = new Map<string, string | null>();
  for (const p of programs) {
    programStateById.set(p.id, p.state ?? null);
    programCountryById.set(p.id, p.country ?? null);
  }

  const alumniContactStates = new Map<string, Set<string>>();
  for (const aff of affiliations) {
    if (!alumniContactIds.has(aff.contact_id)) continue;
    const country = programCountryById.get(aff.program_id);
    if (country && country !== "USA") continue;
    const state = programStateById.get(aff.program_id);
    if (!state) continue;

    let states = alumniContactStates.get(aff.contact_id);
    if (!states) {
      states = new Set();
      alumniContactStates.set(aff.contact_id, states);
    }
    states.add(state);
  }

  const alumniByState = new Map<string, number>();
  for (const states of alumniContactStates.values()) {
    for (const state of states) {
      alumniByState.set(state, (alumniByState.get(state) ?? 0) + 1);
    }
  }

  return {
    programCount: programs.length,
    alumniCount: alumniContactIds.size,
    boardMemberCount: boardContactIds.size,
    programsByState,
    alumniByState,
    internationalProgramCount,
  };
}
