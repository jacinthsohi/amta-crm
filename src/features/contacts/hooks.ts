import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Contact,
  ContactCategory,
  ContactCategoryAssignment,
  BoardTerm,
  OfficerTerm,
  CommitteeAssignment,
  ProgramAffiliation,
} from "@/lib/database.types";
import { isTestContact, shouldShowTestData } from "@/lib/test-data";

// =============================================================================
// Query keys — centralized so invalidations don't typo
// =============================================================================
const KEYS = {
  contacts: ["contacts"] as const,
  contact: (id: string) => ["contact", id] as const,
  categories: ["contact-categories"] as const,
  contactCategoryAssignments: ["contact-category-assignments"] as const,
  boardTermsForContact: (id: string) => ["board-terms", id] as const,
  officerTermsForContact: (id: string) => ["officer-terms", id] as const,
  committeeAssignmentsForContact: (id: string) => ["committee-assignments", id] as const,
  programAffiliationsForContact: (id: string) => ["program-affiliations", id] as const,
};

// =============================================================================
// Composite shapes — what list/detail pages actually need
// =============================================================================

/**
 * A contact enriched with its category names. The list page uses this to
 * render category chips next to each row.
 */
export type ContactWithCategories = Contact & {
  category_names: string[];
};

/**
 * Everything the contact detail page needs for a single contact.
 */
export type ContactDetail = Contact & {
  category_names: string[];
  board_terms: BoardTerm[];
  officer_terms: OfficerTerm[];
  committee_assignments: CommitteeAssignment[];
  program_affiliations: ProgramAffiliation[];
};

// =============================================================================
// useContacts — the list query
// =============================================================================
/**
 * Returns every active contact with their category names attached.
 *
 * Implementation note: we fetch contacts and category assignments in parallel,
 * then stitch them in JS. This is more efficient than N+1 queries (one per
 * contact) and avoids the complexity of crafting a join in PostgREST syntax.
 *
 * Test data filtering: contacts tagged with the "Test" category are excluded
 * by default. The user can opt back in via the localStorage toggle managed
 * in src/lib/test-data.ts (and surfaced as a UI toggle on the contacts list
 * page).
 */
export function useContacts() {
  return useQuery<ContactWithCategories[]>({
    queryKey: KEYS.contacts,
    queryFn: async () => {
      const [contactsRes, assignmentsRes, categoriesRes] = await Promise.all([
        supabase.from("active_contacts").select("*").order("first_name").order("last_name"),
        supabase.from("active_contact_category_assignments").select("*"),
        supabase.from("active_contact_categories").select("*"),
      ]);

      if (contactsRes.error) throw contactsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const categoryById = new Map(
        (categoriesRes.data ?? []).map((c) => [c.id, c.name]),
      );
      const categoriesByContact = new Map<string, string[]>();
      for (const a of assignmentsRes.data ?? []) {
        const name = categoryById.get(a.category_id);
        if (!name) continue;
        const existing = categoriesByContact.get(a.contact_id);
        if (existing) existing.push(name);
        else categoriesByContact.set(a.contact_id, [name]);
      }

      const stitched = (contactsRes.data ?? []).map((c) => ({
        ...c,
        category_names: categoriesByContact.get(c.id) ?? [],
      }));

      // Filter out test contacts unless the user has toggled them on.
      // The toggle lives in localStorage (see src/lib/test-data.ts).
      return shouldShowTestData()
        ? stitched
        : stitched.filter((c) => !isTestContact(c));
    },
  });
}

// =============================================================================
// useContact — single contact detail
// =============================================================================
/**
 * Returns a single contact plus all of its sub-records (board terms, officer
 * terms, committee assignments, program affiliations) and category names.
 *
 * Returns null if the contact is not found or has been soft-deleted.
 *
 * Note: this does NOT filter test contacts. If the admin navigated to a
 * contact's detail page, we show them whatever they asked to see — test or
 * not. The "TEST" badge (rendered via the Test category chip) is the
 * visible signal that this is a test record.
 */
export function useContact(id: string | undefined) {
  return useQuery<ContactDetail | null>({
    queryKey: id ? KEYS.contact(id) : ["contact", "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const [
        contactRes,
        boardTermsRes,
        officerTermsRes,
        committeeAssignmentsRes,
        programAffiliationsRes,
        assignmentsRes,
        categoriesRes,
      ] = await Promise.all([
        supabase.from("active_contacts").select("*").eq("id", id).maybeSingle(),
        supabase.from("active_board_terms").select("*").eq("contact_id", id).order("election_year", { ascending: false }),
        supabase.from("active_officer_terms").select("*").eq("contact_id", id).order("start_date", { ascending: false }),
        supabase.from("active_committee_assignments").select("*").eq("contact_id", id),
        supabase.from("active_program_affiliations").select("*").eq("contact_id", id).order("start_year", { ascending: false }),
        supabase.from("active_contact_category_assignments").select("*").eq("contact_id", id),
        supabase.from("active_contact_categories").select("*"),
      ]);

      if (contactRes.error) throw contactRes.error;
      if (!contactRes.data) return null;
      if (boardTermsRes.error) throw boardTermsRes.error;
      if (officerTermsRes.error) throw officerTermsRes.error;
      if (committeeAssignmentsRes.error) throw committeeAssignmentsRes.error;
      if (programAffiliationsRes.error) throw programAffiliationsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const categoryById = new Map(
        (categoriesRes.data ?? []).map((c) => [c.id, c.name]),
      );
      const category_names = (assignmentsRes.data ?? [])
        .map((a) => categoryById.get(a.category_id))
        .filter((n): n is string => Boolean(n));

      return {
        ...contactRes.data,
        category_names,
        board_terms: boardTermsRes.data ?? [],
        officer_terms: officerTermsRes.data ?? [],
        committee_assignments: committeeAssignmentsRes.data ?? [],
        program_affiliations: programAffiliationsRes.data ?? [],
      };
    },
  });
}

// =============================================================================
// useContactCategories — list of all categories (for the picker)
// =============================================================================
export function useContactCategories() {
  return useQuery<ContactCategory[]>({
    queryKey: KEYS.categories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_contact_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// =============================================================================
// useCreateContactCategory — admin can create new categories from the form
// =============================================================================
export function useCreateContactCategory() {
  const qc = useQueryClient();
  return useMutation<ContactCategory, Error, string>({
    mutationFn: async (name) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Category name required");
      const { data, error } = await supabase
        .from("contact_categories")
        .insert({ name: trimmed })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.categories });
    },
  });
}

// =============================================================================
// useUpsertContact — create or edit a contact
// =============================================================================
/**
 * Creates a new contact (if no id is provided) or updates an existing one.
 * Also reconciles category assignments based on `category_names`.
 *
 * Pessimistic: the form awaits server confirmation before closing.
 */
type UpsertContactInput = {
  id?: string;
  first_name: string;
  last_name: string;
  pronouns: string | null;
  email: string | null;
  secondary_email: string | null;
  phone: string | null;
  notes: string | null;
  standing: "active" | "inactive" | null;
  category_names: string[];
};

export function useUpsertContact() {
  const qc = useQueryClient();
  return useMutation<Contact, Error, UpsertContactInput>({
    mutationFn: async (input) => {
      const { id, category_names, ...row } = input;

      // Upsert the contact row itself
      let contact: Contact;
      if (id) {
        const { data, error } = await supabase
          .from("contacts")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        contact = data;
      } else {
        const { data, error } = await supabase
          .from("contacts")
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        contact = data;
      }

      // Reconcile categories
      // Strategy: load current ACTIVE assignments + category lookups, compare
      // against desired set, soft-delete the ones that should go away, and
      // insert the ones that should be added.
      const [{ data: cats }, { data: existing }] = await Promise.all([
        supabase.from("active_contact_categories").select("*"),
        supabase
          .from("active_contact_category_assignments")
          .select("*")
          .eq("contact_id", contact.id),
      ]);
      const catByName = new Map((cats ?? []).map((c) => [c.name, c]));
      const currentCatIds = new Set((existing ?? []).map((a) => a.category_id));
      const desiredCatIds = new Set<string>();
      for (const name of category_names) {
        const cat = catByName.get(name);
        if (cat) desiredCatIds.add(cat.id);
      }

      // Soft-delete removed assignments
      const toRemove = (existing ?? []).filter(
        (a) => !desiredCatIds.has(a.category_id),
      );
      for (const a of toRemove) {
        await supabase.rpc("soft_delete", {
          table_name: "contact_category_assignments",
          row_id: a.id,
        });
      }

      // Insert new assignments
      const toAdd = [...desiredCatIds].filter((cid) => !currentCatIds.has(cid));
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("contact_category_assignments")
          .insert(
            toAdd.map((category_id) => ({
              contact_id: contact.id,
              category_id,
            })),
          );
        if (error) throw error;
      }

      return contact;
    },
    onSuccess: (contact) => {
      qc.invalidateQueries({ queryKey: KEYS.contacts });
      qc.invalidateQueries({ queryKey: KEYS.contact(contact.id) });
      qc.invalidateQueries({ queryKey: KEYS.contactCategoryAssignments });
    },
  });
}

// =============================================================================
// useSoftDeleteContact — soft-delete a contact
// =============================================================================
export function useSoftDeleteContact() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("soft_delete", {
        table_name: "contacts",
        row_id: id,
      });
      if (error) throw error;
      return data ?? id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.contacts });
    },
  });
}

// =============================================================================
// Inline-record mutations — board terms, officer terms, committee assignments,
// program affiliations.
// =============================================================================

type UpsertBoardTermInput = {
  id?: string;
  contact_id: string;
  term_type: "first_year_candidate" | "second_year_candidate" | "voting_director";
  election_year: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
};

export function useUpsertBoardTerm() {
  const qc = useQueryClient();
  return useMutation<BoardTerm, Error, UpsertBoardTermInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("board_terms")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("board_terms")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (term) => {
      qc.invalidateQueries({ queryKey: KEYS.contact(term.contact_id) });
      // has_board_history may have flipped, so refresh the list too
      qc.invalidateQueries({ queryKey: KEYS.contacts });
    },
  });
}

export function useSoftDeleteBoardTerm() {
  const qc = useQueryClient();
  return useMutation<string, Error, { id: string; contact_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc("soft_delete", {
        table_name: "board_terms",
        row_id: id,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (_, { contact_id }) => {
      qc.invalidateQueries({ queryKey: KEYS.contact(contact_id) });
      qc.invalidateQueries({ queryKey: KEYS.contacts });
    },
  });
}

type UpsertOfficerTermInput = {
  id?: string;
  contact_id: string;
  officer_type:
    | "president"
    | "president_elect"
    | "past_president"
    | "secretary"
    | "treasurer";
  start_date: string;
  end_date: string | null;
  notes: string | null;
};

export function useUpsertOfficerTerm() {
  const qc = useQueryClient();
  return useMutation<OfficerTerm, Error, UpsertOfficerTermInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("officer_terms")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("officer_terms")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (term) => {
      qc.invalidateQueries({ queryKey: KEYS.contact(term.contact_id) });
    },
  });
}

export function useSoftDeleteOfficerTerm() {
  const qc = useQueryClient();
  return useMutation<string, Error, { id: string; contact_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc("soft_delete", {
        table_name: "officer_terms",
        row_id: id,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (_, { contact_id }) => {
      qc.invalidateQueries({ queryKey: KEYS.contact(contact_id) });
    },
  });
}

type UpsertCommitteeAssignmentInput = {
  id?: string;
  contact_id: string;
  committee_id: string;
  position: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
};

export function useUpsertCommitteeAssignment() {
  const qc = useQueryClient();
  return useMutation<CommitteeAssignment, Error, UpsertCommitteeAssignmentInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("committee_assignments")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("committee_assignments")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: KEYS.contact(a.contact_id) });
    },
  });
}

export function useSoftDeleteCommitteeAssignment() {
  const qc = useQueryClient();
  return useMutation<string, Error, { id: string; contact_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc("soft_delete", {
        table_name: "committee_assignments",
        row_id: id,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (_, { contact_id }) => {
      qc.invalidateQueries({ queryKey: KEYS.contact(contact_id) });
    },
  });
}

type UpsertProgramAffiliationInput = {
  id?: string;
  contact_id: string;
  program_id: string;
  affiliation_type: "student_alumni" | "coach" | "advisor";
  start_year: number;
  end_year: number | null;
  notes: string | null;
};

export function useUpsertProgramAffiliation() {
  const qc = useQueryClient();
  return useMutation<ProgramAffiliation, Error, UpsertProgramAffiliationInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("program_affiliations")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("program_affiliations")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: KEYS.contact(a.contact_id) });
    },
  });
}

export function useSoftDeleteProgramAffiliation() {
  const qc = useQueryClient();
  return useMutation<string, Error, { id: string; contact_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc("soft_delete", {
        table_name: "program_affiliations",
        row_id: id,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (_, { contact_id }) => {
      qc.invalidateQueries({ queryKey: KEYS.contact(contact_id) });
    },
  });
}

// =============================================================================
// Helper to expose query keys for tests / external invalidation
// =============================================================================
export const contactsQueryKeys = KEYS;
