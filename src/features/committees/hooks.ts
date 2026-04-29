import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Committee,
  CommitteeAssignment,
  Contact,
} from "@/lib/database.types";

const KEYS = {
  committees: ["committees"] as const,
  committee: (id: string) => ["committee", id] as const,
};

// =============================================================================
// useCommittees — list query (used for both list page and tree rendering)
// =============================================================================
export function useCommittees() {
  return useQuery<Committee[]>({
    queryKey: KEYS.committees,
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

// =============================================================================
// useCommittee — single committee with members (assignments + contact)
// and subcommittees (committees whose parent is this one)
// =============================================================================
export type CommitteeWithRelations = Committee & {
  parent: Committee | null;
  subcommittees: Committee[];
  assignments: (CommitteeAssignment & {
    contact: Contact | null;
  })[];
};

export function useCommittee(id: string | undefined) {
  return useQuery<CommitteeWithRelations | null>({
    queryKey: id ? KEYS.committee(id) : ["committee", "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const [committeeRes, allCommitteesRes, assignmentsRes, contactsRes] =
        await Promise.all([
          supabase
            .from("active_committees")
            .select("*")
            .eq("id", id)
            .maybeSingle(),
          supabase.from("active_committees").select("*"),
          supabase
            .from("active_committee_assignments")
            .select("*")
            .eq("committee_id", id),
          supabase.from("active_contacts").select("*"),
        ]);

      if (committeeRes.error) throw committeeRes.error;
      if (!committeeRes.data) return null;
      if (allCommitteesRes.error) throw allCommitteesRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (contactsRes.error) throw contactsRes.error;

      const all = allCommitteesRes.data ?? [];
      const parent = committeeRes.data.parent_committee_id
        ? all.find((c) => c.id === committeeRes.data.parent_committee_id) ?? null
        : null;
      const subcommittees = all.filter(
        (c) => c.parent_committee_id === id,
      );

      const contactById = new Map(
        (contactsRes.data ?? []).map((c) => [c.id, c]),
      );
      const assignments = (assignmentsRes.data ?? []).map((a) => ({
        ...a,
        contact: contactById.get(a.contact_id) ?? null,
      }));

      return {
        ...committeeRes.data,
        parent,
        subcommittees,
        assignments,
      };
    },
  });
}

// =============================================================================
// useUpsertCommittee
// =============================================================================
type UpsertCommitteeInput = {
  id?: string;
  name: string;
  description: string | null;
  parent_committee_id: string | null;
  status: "active" | "inactive";
  is_executive: boolean;
};

export function useUpsertCommittee() {
  const qc = useQueryClient();
  return useMutation<Committee, Error, UpsertCommitteeInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("committees")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("committees")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (committee) => {
      qc.invalidateQueries({ queryKey: KEYS.committees });
      qc.invalidateQueries({ queryKey: KEYS.committee(committee.id) });
      qc.invalidateQueries({ queryKey: ["committees-lookup"] });
    },
  });
}

// =============================================================================
// useSoftDeleteCommittee
// =============================================================================
export function useSoftDeleteCommittee() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("soft_delete", {
        table_name: "committees",
        row_id: id,
      });
      if (error) throw error;
      return data ?? id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.committees });
      qc.invalidateQueries({ queryKey: ["committees-lookup"] });
    },
  });
}
