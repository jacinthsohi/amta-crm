import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Program, Committee } from "./database.types";

/**
 * Cross-cutting lookup queries.
 *
 * As we port more entities, each will have its own hooks module. But every
 * feature needs to *display* programs and committees (e.g. ContactDetail
 * shows program names, committee names). So we centralize the lookup-style
 * read queries here for now.
 *
 * These are simple read queries with no mutations — full programs and
 * committees CRUD lives in their own feature folders (Phase 4c).
 */

export function useProgramsLookup() {
  return useQuery<Program[]>({
    queryKey: ["programs-lookup"],
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

export function useCommitteesLookup() {
  return useQuery<Committee[]>({
    queryKey: ["committees-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_committees")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
