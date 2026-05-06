// src/features/admin/hooks.ts
// =============================================================================
// Admin-related hooks
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ---------------------------------------------------------------------------
// useIsAdmin: is the current user flagged is_admin?
// We read from `contact` in the auth context (already loaded at sign-in)
// rather than making a separate query. Single source of truth.
// ---------------------------------------------------------------------------
export function useIsAdmin() {
  const { contact, loading } = useAuth();
  return {
    isAdmin: Boolean(contact?.is_admin),
    isLoading: loading,
  };
}

// ---------------------------------------------------------------------------
// useInvitations: list invitations with computed status
// ---------------------------------------------------------------------------
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface InvitationRow {
  id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  computed_status: InvitationStatus;
}

export function useInvitations() {
  return useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_invitations_view")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvitationRow[];
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations: send / revoke / resend
// ---------------------------------------------------------------------------
const INVITATION_TTL_DAYS = 14;

function generateToken() {
  // 32 random bytes, hex-encoded. Browser-native, no deps.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function expiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + INVITATION_TTL_DAYS);
  return d.toISOString();
}

export function useSendInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const normalized = email.toLowerCase().trim();
      const { data, error } = await supabase
        .from("invitations")
        .insert({
          email: normalized,
          token: generateToken(),
          expires_at: expiryDate(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

export function useResendInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Resend = new token + extended expiry, in place.
      const { error } = await supabase
        .from("invitations")
        .update({
          token: generateToken(),
          expires_at: expiryDate(),
          revoked_at: null, // un-revoke if previously revoked
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

// ---------------------------------------------------------------------------
// useAccessList: who currently has access? (for /admin/access page)
// ---------------------------------------------------------------------------
export interface AccessEntry {
  source: "contact" | "invitation";
  email: string;
  name: string | null;
  is_admin: boolean;
  status: string;
}

export function useAccessList() {
  return useQuery({
    queryKey: ["access-list"],
    queryFn: async () => {
      const { data: contacts, error: contactsErr } = await supabase
        .from("active_contacts")
        .select("email, first_name, last_name, is_admin")
        .order("last_name", { ascending: true });
      if (contactsErr) throw contactsErr;

      const { data: invites, error: invitesErr } = await supabase
        .from("invitations")
        .select("email, accepted_at, revoked_at")
        .not("accepted_at", "is", null)
        .is("revoked_at", null);
      if (invitesErr) throw invitesErr;

      const contactEmails = new Set(
        (contacts ?? []).map((c) => c.email?.toLowerCase()).filter(Boolean),
      );

      const entries: AccessEntry[] = [
        ...(contacts ?? []).map((c) => ({
          source: "contact" as const,
          email: c.email ?? "",
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
          is_admin: Boolean(c.is_admin),
          status: "active",
        })),
        ...(invites ?? [])
          .filter((i) => !contactEmails.has(i.email?.toLowerCase()))
          .map((i) => ({
            source: "invitation" as const,
            email: i.email,
            name: null,
            is_admin: false,
            status: "invited (no contact row)",
          })),
      ];

      return entries;
    },
  });
}
