// src/features/admin/hooks.ts
// =============================================================================
// Admin-related hooks
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ---------------------------------------------------------------------------
// useIsAdmin: is the current user flagged is_admin?
// Reads from the auth context's `contact` (already loaded at sign-in).
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
  contact_id: string;
  email: string;
  token: string;
  invited_by: string | null;
  sent_at: string;
  expires_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
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
// useInvitableContacts: contacts with an email and no active invitation yet.
// Powers the "Invite a contact" dropdown.
// ---------------------------------------------------------------------------
export interface InvitableContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export function useInvitableContacts() {
  return useQuery({
    queryKey: ["invitable-contacts"],
    queryFn: async () => {
      // 1. Pull every active contact with an email.
      const { data: contacts, error: contactsErr } = await supabase
        .from("active_contacts")
        .select("id, first_name, last_name, email")
        .not("email", "is", null);
      if (contactsErr) throw contactsErr;

      // 2. Pull every invitation that's still pending or already accepted.
      //    These contacts shouldn't appear in the dropdown.
      const { data: existingInvites, error: invErr } = await supabase
        .from("active_invitations_view")
        .select("contact_id, computed_status");
      if (invErr) throw invErr;

      const blockedContactIds = new Set(
        (existingInvites ?? [])
          .filter(
            (i) =>
              i.computed_status === "pending" ||
              i.computed_status === "accepted",
          )
          .map((i) => i.contact_id),
      );

      const invitable: InvitableContact[] = (contacts ?? [])
        .filter((c) => c.email && !blockedContactIds.has(c.id))
        .map((c) => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email as string,
        }));

      // Sort alphabetically by last name, then first.
      invitable.sort((a, b) => {
        const al = (a.last_name ?? "").toLowerCase();
        const bl = (b.last_name ?? "").toLowerCase();
        if (al !== bl) return al.localeCompare(bl);
        return (a.first_name ?? "").localeCompare(b.first_name ?? "");
      });

      return invitable;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations: send / revoke / resend
// ---------------------------------------------------------------------------
const INVITATION_TTL_DAYS = 14;

function generateToken() {
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
  const { contact: currentContact } = useAuth();

  return useMutation({
    mutationFn: async (input: { contact_id: string; email: string }) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("invitations")
        .insert({
          contact_id: input.contact_id,
          email: input.email.toLowerCase().trim(),
          token: generateToken(),
          invited_by: currentContact?.id ?? null,
          sent_at: now,
          expires_at: expiryDate(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      qc.invalidateQueries({ queryKey: ["invitable-contacts"] });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      qc.invalidateQueries({ queryKey: ["invitable-contacts"] });
    },
  });
}

export function useResendInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Resend = new token + extended expiry, in place. Also un-revoke if
      // the user is choosing to bring the invite back. Returns the updated
      // row so the page can email it as the next step.
      const { data, error } = await supabase
        .from("invitations")
        .update({
          token: generateToken(),
          sent_at: new Date().toISOString(),
          expires_at: expiryDate(),
          revoked_at: null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      qc.invalidateQueries({ queryKey: ["invitable-contacts"] });
    },
  });
}

// ---------------------------------------------------------------------------
// useSendInvitationEmail: email an existing invitation via the serverless
// function (api/send-invitation-email.ts).
//
// This is a SEPARATE step from creating/refreshing the invitation row —
// InvitationsPage orchestrates: create-or-refresh row first, then call this.
// Keeping it separate makes the failure modes legible: "the invitation
// exists" and "the email went out" stay as two answerable questions.
// On success the server stamps invitations.sent_at with the real send time.
//
// Mirrors the JWT-from-frontend pattern used by the AI features:
// supabase.auth.getSession() -> session.access_token -> Bearer header.
// ---------------------------------------------------------------------------
export function useSendInvitationEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string): Promise<{ sent_to: string }> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not signed in. Please refresh the page.");
      }

      const res = await fetch(`/api/send-invitation-email?t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invitation_id: invitationId }),
      });

      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson?.error) msg = errJson.error;
        } catch {
          // Response wasn't JSON; keep the generic message.
        }
        throw new Error(msg);
      }

      const bodyJson = (await res.json()) as { sent_to?: string };
      return { sent_to: bodyJson.sent_to ?? "" };
    },
    onSuccess: () => {
      // sent_at changed server-side — refresh the list so the "Sent" column
      // reflects the real send time.
      qc.invalidateQueries({ queryKey: ["invitations"] });
    },
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
