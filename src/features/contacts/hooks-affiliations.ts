import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ProgramAffiliation } from "@/lib/database.types";

/**
 * Fetches every active program affiliation in one shot, grouped by contact.
 *
 * Used by the contacts list to show each contact's "primary" affiliation
 * (the one with the latest start_year). Doing this as a single query rather
 * than N+1 lookups keeps the list page fast even at AMTA's full membership.
 */
export function useProgramAffiliationsByContact() {
  const { data, ...rest } = useQuery<ProgramAffiliation[]>({
    queryKey: ["program-affiliations-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_program_affiliations")
        .select("*")
        .order("start_year", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const byContactId = useMemo(() => {
    const m = new Map<string, ProgramAffiliation[]>();
    for (const a of data ?? []) {
      const list = m.get(a.contact_id);
      if (list) list.push(a);
      else m.set(a.contact_id, [a]);
    }
    return m;
  }, [data]);

  return { byContactId, ...rest };
}
