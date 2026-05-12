// src/features/admin/alumni-claims-hooks.ts
// =============================================================================
// Alumni claims admin workflow hooks
// =============================================================================
//
// The public alumni signup form at /alumni-signup writes submissions to the
// alumni_claims table. These hooks power the admin review/approve/reject UI
// at /admin/alumni-claims.
//
// Hooks exported:
//   - useAlumniClaims(statusFilter)         — list query, filterable by status
//   - usePendingClaimsCount()               — small query for the sidebar badge
//   - useRejectClaim()                      — mutation to mark claim rejected
//   - useApproveClaimAndCreateContact()     — composite mutation: creates a
//                                             contact and marks claim approved
//   - useFindDuplicateContact()             — lazy lookup for duplicate warning
//
// Auth note: this module does NOT enforce admin-only access at the data layer.
// The current alumni_claims RLS policies allow any authenticated user to read
// and update claims. App-layer admin gating (via <AdminGate>) is the primary
// access control for now. Tighter RLS is on the backlog as its own migration.
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/lib/database.generated";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
// We pull AlumniClaim directly from the generated types rather than the
// friendly shim so this hook keeps working even if the shim hasn't been
// updated yet.
export type AlumniClaim = Database["public"]["Tables"]["alumni_claims"]["Row"];
export type AlumniClaimStatus = "pending" | "approved" | "rejected";

// What the admin sees in the list. The claim row plus a few denormalized
// fields the UI needs (program name, reviewer name).
export interface AlumniClaimRow extends AlumniClaim {
  program_name: string | null;
  reviewer_name: string | null;
}

// What a possible duplicate looks like for the UI to warn against.
export interface PossibleDuplicate {
  contact_id: string;
  match_type: "email" | "name_and_program";
  display_name: string;
  email: string | null;
}

// -----------------------------------------------------------------------------
// Query keys — centralized, same pattern as contacts/programs hooks
// -----------------------------------------------------------------------------
const KEYS = {
  alumniClaims: (status: AlumniClaimStatus | "all") =>
    ["alumni-claims", status] as const,
  alumniClaimsPendingCount: ["alumni-claims", "pending-count"] as const,
  duplicateCheck: (claimId: string) =>
    ["alumni-claims", "duplicate", claimId] as const,
};

// -----------------------------------------------------------------------------
// useAlumniClaims — list query
// -----------------------------------------------------------------------------
// Returns claims filtered by status (default: pending), enriched with the
// program name and reviewer name for display. Sorted by created_at desc so
// the newest pending claim is at the top.
//
// Implementation: we pull claims, programs, and contacts in parallel, then
// stitch them in JS. Same pattern as useContacts. Programs and contacts are
// small enough that this is faster than crafting joins in PostgREST.
// -----------------------------------------------------------------------------
export function useAlumniClaims(status: AlumniClaimStatus | "all" = "pending") {
  return useQuery<AlumniClaimRow[]>({
    queryKey: KEYS.alumniClaims(status),
    queryFn: async () => {
      let claimsQuery = supabase
        .from("alumni_claims")
        .select("*")
        .order("created_at", { ascending: false });
      if (status !== "all") {
        claimsQuery = claimsQuery.eq("status", status);
      }

      const [claimsRes, programsRes, contactsRes] = await Promise.all([
        claimsQuery,
        supabase.from("programs").select("id, name"),
        supabase.from("contacts").select("id, first_name, last_name"),
      ]);

      if (claimsRes.error) throw claimsRes.error;
      if (programsRes.error) throw programsRes.error;
      if (contactsRes.error) throw contactsRes.error;

      const programNameById = new Map(
        (programsRes.data ?? []).map((p) => [p.id, p.name]),
      );
      const contactNameById = new Map(
        (contactsRes.data ?? []).map((c) => [
          c.id,
          [c.first_name, c.last_name].filter(Boolean).join(" "),
        ]),
      );

      return (claimsRes.data ?? []).map((claim) => ({
        ...claim,
        program_name: programNameById.get(claim.program_id) ?? null,
        reviewer_name: claim.reviewed_by
          ? contactNameById.get(claim.reviewed_by) ?? null
          : null,
      }));
    },
  });
}

// -----------------------------------------------------------------------------
// usePendingClaimsCount — for the sidebar badge
// -----------------------------------------------------------------------------
// Lightweight count-only query. Returns 0 if nothing pending; sidebar uses
// this to render "Alumni claims (3)" etc.
// -----------------------------------------------------------------------------
export function usePendingClaimsCount() {
  return useQuery<number>({
    queryKey: KEYS.alumniClaimsPendingCount,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("alumni_claims")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

// -----------------------------------------------------------------------------
// useFindDuplicateContact — duplicate detection for a claim under review
// -----------------------------------------------------------------------------
// When the admin opens a claim for review, we check whether any existing
// contact looks like a possible duplicate, so the admin can be warned before
// approving and creating a second contact for the same person.
//
// Match logic (matches the spec):
//   1. Email exact match (case-insensitive), OR
//   2. (first_name + last_name + program_id) all match, names case-insensitive
//
// Returns null if no duplicate is found.
// -----------------------------------------------------------------------------
export function useFindDuplicateContact(claim: AlumniClaim | null) {
  return useQuery<PossibleDuplicate | null>({
    queryKey: claim ? KEYS.duplicateCheck(claim.id) : ["alumni-claims", "duplicate", "none"],
    enabled: Boolean(claim),
    queryFn: async () => {
      if (!claim) return null;

      const normalizedEmail = claim.email.toLowerCase().trim();
      const normalizedFirst = claim.first_name.toLowerCase().trim();
      const normalizedLast = claim.last_name.toLowerCase().trim();

      // We pull a single broad query, then filter in JS — simpler than two
      // separate Supabase queries with OR conditions.
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .is("deleted_at", null);
      if (error) throw error;

      // Check email match first (more authoritative).
      const emailMatch = (data ?? []).find(
        (c) => c.email && c.email.toLowerCase().trim() === normalizedEmail,
      );
      if (emailMatch) {
        return {
          contact_id: emailMatch.id,
          match_type: "email",
          display_name: [emailMatch.first_name, emailMatch.last_name]
            .filter(Boolean)
            .join(" "),
          email: emailMatch.email,
        };
      }

      // For name+program match we also need to check program_affiliations.
      // We do this lazily: only run the second query if a name match exists.
      const nameMatches = (data ?? []).filter(
        (c) =>
          (c.first_name ?? "").toLowerCase().trim() === normalizedFirst &&
          (c.last_name ?? "").toLowerCase().trim() === normalizedLast,
      );
      if (nameMatches.length === 0) return null;

      const { data: affs, error: affErr } = await supabase
        .from("program_affiliations")
        .select("contact_id, program_id")
        .eq("program_id", claim.program_id)
        .in(
          "contact_id",
          nameMatches.map((c) => c.id),
        )
        .is("deleted_at", null);
      if (affErr) throw affErr;

      const matchedContactId = affs?.[0]?.contact_id;
      if (!matchedContactId) return null;

      const match = nameMatches.find((c) => c.id === matchedContactId);
      if (!match) return null;

      return {
        contact_id: match.id,
        match_type: "name_and_program",
        display_name: [match.first_name, match.last_name]
          .filter(Boolean)
          .join(" "),
        email: match.email,
      };
    },
  });
}

// -----------------------------------------------------------------------------
// useRejectClaim — mark claim rejected
// -----------------------------------------------------------------------------
// Sets status='rejected', records reviewer and timestamp, optionally records
// a reason. Reason is optional (spec decision).
// -----------------------------------------------------------------------------
export function useRejectClaim() {
  const qc = useQueryClient();
  const { contact: currentContact } = useAuth();

  return useMutation({
    mutationFn: async (input: { claim_id: string; reason?: string }) => {
      if (!currentContact) {
        throw new Error("Must be signed in to reject a claim.");
      }
      const { data, error } = await supabase
        .from("alumni_claims")
        .update({
          status: "rejected",
          reviewed_by: currentContact.id,
          reviewed_at: new Date().toISOString(),
          review_notes: input.reason?.trim() || null,
        })
        .eq("id", input.claim_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate every status flavor of the list, plus the count badge.
      qc.invalidateQueries({ queryKey: ["alumni-claims"] });
    },
  });
}

// -----------------------------------------------------------------------------
// useApproveClaimAndCreateContact — combined approve + create
// -----------------------------------------------------------------------------
// Approving a claim creates a new contacts row from the (admin-edited) claim
// data, AND marks the claim approved with reviewer + timestamp + the new
// contact_id.
//
// This isn't atomic at the database level (no transaction wrapping). If the
// claim update fails after the contact insert succeeds, we'd have an orphan
// contact and a still-pending claim. In practice that's rare (the second
// operation is a simple update on a row the admin can see); a future
// improvement is to wrap both in a Postgres function called via supabase.rpc.
// -----------------------------------------------------------------------------
type ApprovalInput = {
  claim_id: string;
  // The admin-edited contact fields. We let the UI pre-fill these from the
  // claim's data, but the admin can edit before save.
  contact_data: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    pronouns: string | null;
    notes: string | null;
    is_admin?: boolean;
  };
  // Program affiliation to create alongside the contact (almost always desired
  // for an alumni claim — that's the whole point of the claim).
  program_affiliation?: {
    program_id: string;
    affiliation_type: "student_alumni" | "coach" | "advisor";
    start_year: number;
    end_year: number;
  };
};

export function useApproveClaimAndCreateContact() {
  const qc = useQueryClient();
  const { contact: currentContact } = useAuth();

  return useMutation({
    mutationFn: async (input: ApprovalInput) => {
      if (!currentContact) {
        throw new Error("Must be signed in to approve a claim.");
      }

      // 1. Create the contact row.
      const { data: contact, error: contactErr } = await supabase
        .from("contacts")
        .insert({
          first_name: input.contact_data.first_name,
          last_name: input.contact_data.last_name,
          email: input.contact_data.email,
          phone: input.contact_data.phone,
          pronouns: input.contact_data.pronouns,
          notes: input.contact_data.notes,
          is_admin: input.contact_data.is_admin ?? false,
        })
        .select()
        .single();
      if (contactErr) throw contactErr;

      // 2. Optionally create the program affiliation.
      if (input.program_affiliation) {
        const { error: affErr } = await supabase
          .from("program_affiliations")
          .insert({
            contact_id: contact.id,
            program_id: input.program_affiliation.program_id,
            affiliation_type: input.program_affiliation.affiliation_type,
            start_year: input.program_affiliation.start_year,
            end_year: input.program_affiliation.end_year,
          });
        if (affErr) {
          // We don't roll back the contact creation here. The admin can
          // re-attach the affiliation manually if this fails. Logging so
          // we notice if this becomes a real problem.
          console.error(
            "Contact created but affiliation failed; admin should attach manually:",
            affErr,
          );
        }
      }

      // 3. Mark the claim approved and point it at the new contact.
      const { data: updatedClaim, error: claimErr } = await supabase
        .from("alumni_claims")
        .update({
          status: "approved",
          reviewed_by: currentContact.id,
          reviewed_at: new Date().toISOString(),
          contact_id: contact.id,
        })
        .eq("id", input.claim_id)
        .select()
        .single();
      if (claimErr) {
        console.error(
          "Contact created but claim status update failed; admin should mark claim manually:",
          claimErr,
        );
        throw claimErr;
      }

      return { contact, claim: updatedClaim };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alumni-claims"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["program-affiliations"] });
    },
  });
}
