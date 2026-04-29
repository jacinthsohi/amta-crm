import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Interaction,
  InteractionParticipant,
  InteractionLink,
  Contact,
  Event,
  Committee,
  Program,
  Project,
} from "@/lib/database.types";

const KEYS = {
  interactions: ["interactions"] as const,
  interaction: (id: string) => ["interaction", id] as const,
  interactionsForContact: (id: string) =>
    ["interactions-for-contact", id] as const,
  interactionsForEvent: (id: string) => ["interactions-for-event", id] as const,
  interactionsForCommittee: (id: string) =>
    ["interactions-for-committee", id] as const,
  interactionsForProject: (id: string) =>
    ["interactions-for-project", id] as const,
};

// =============================================================================
// useInteractions — global list
// =============================================================================
export type InteractionWithRelations = Interaction & {
  participants: (InteractionParticipant & { contact: Contact | null })[];
  links: InteractionLink[];
};

/**
 * Returns every active interaction with its participants and links eagerly
 * loaded. The lists pages and detail pages all need participant info
 * (avatars), so we batch the fetch instead of N+1.
 */
export function useInteractions() {
  return useQuery<InteractionWithRelations[]>({
    queryKey: KEYS.interactions,
    queryFn: async () => {
      const [interactionsRes, participantsRes, linksRes, contactsRes] =
        await Promise.all([
          supabase
            .from("active_interactions")
            .select("*")
            .order("occurred_at", { ascending: false }),
          supabase.from("active_interaction_participants").select("*"),
          supabase.from("active_interaction_links").select("*"),
          supabase.from("active_contacts").select("*"),
        ]);

      if (interactionsRes.error) throw interactionsRes.error;
      if (participantsRes.error) throw participantsRes.error;
      if (linksRes.error) throw linksRes.error;
      if (contactsRes.error) throw contactsRes.error;

      const contactById = new Map(
        (contactsRes.data ?? []).map((c) => [c.id, c]),
      );

      const partsByInt = new Map<string, InteractionParticipant[]>();
      for (const p of participantsRes.data ?? []) {
        const arr = partsByInt.get(p.interaction_id);
        if (arr) arr.push(p);
        else partsByInt.set(p.interaction_id, [p]);
      }

      const linksByInt = new Map<string, InteractionLink[]>();
      for (const l of linksRes.data ?? []) {
        const arr = linksByInt.get(l.interaction_id);
        if (arr) arr.push(l);
        else linksByInt.set(l.interaction_id, [l]);
      }

      return (interactionsRes.data ?? []).map((i) => ({
        ...i,
        participants: (partsByInt.get(i.id) ?? []).map((p) => ({
          ...p,
          contact: contactById.get(p.contact_id) ?? null,
        })),
        links: linksByInt.get(i.id) ?? [],
      }));
    },
  });
}

// =============================================================================
// useInteraction — detail with participants, links, and resolved entities
// =============================================================================
export type InteractionDetailFull = Interaction & {
  logged_by_contact: Contact | null;
  participants: (InteractionParticipant & { contact: Contact | null })[];
  linked_events: Event[];
  linked_committees: Committee[];
  linked_programs: Program[];
  linked_projects: Project[];
  raw_links: InteractionLink[];
};

export function useInteraction(id: string | undefined) {
  return useQuery<InteractionDetailFull | null>({
    queryKey: id ? KEYS.interaction(id) : ["interaction", "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;

      const [
        interactionRes,
        partsRes,
        linksRes,
        contactsRes,
        eventsRes,
        committeesRes,
        programsRes,
        projectsRes,
      ] = await Promise.all([
        supabase
          .from("active_interactions")
          .select("*")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("active_interaction_participants")
          .select("*")
          .eq("interaction_id", id),
        supabase
          .from("active_interaction_links")
          .select("*")
          .eq("interaction_id", id),
        supabase.from("active_contacts").select("*"),
        supabase.from("active_events").select("*"),
        supabase.from("active_committees").select("*"),
        supabase.from("active_programs").select("*"),
        supabase.from("active_projects").select("*"),
      ]);

      if (interactionRes.error) throw interactionRes.error;
      if (!interactionRes.data) return null;
      if (partsRes.error) throw partsRes.error;
      if (linksRes.error) throw linksRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (committeesRes.error) throw committeesRes.error;
      if (programsRes.error) throw programsRes.error;
      if (projectsRes.error) throw projectsRes.error;

      const contactById = new Map(
        (contactsRes.data ?? []).map((c) => [c.id, c]),
      );
      const eventById = new Map(
        (eventsRes.data ?? []).map((e) => [e.id, e]),
      );
      const committeeById = new Map(
        (committeesRes.data ?? []).map((c) => [c.id, c]),
      );
      const programById = new Map(
        (programsRes.data ?? []).map((p) => [p.id, p]),
      );
      const projectById = new Map(
        (projectsRes.data ?? []).map((p) => [p.id, p]),
      );

      const links = linksRes.data ?? [];
      const linked_events: Event[] = [];
      const linked_committees: Committee[] = [];
      const linked_programs: Program[] = [];
      const linked_projects: Project[] = [];
      for (const l of links) {
        if (l.linked_event_id) {
          const e = eventById.get(l.linked_event_id);
          if (e) linked_events.push(e);
        }
        if (l.linked_committee_id) {
          const c = committeeById.get(l.linked_committee_id);
          if (c) linked_committees.push(c);
        }
        if (l.linked_program_id) {
          const p = programById.get(l.linked_program_id);
          if (p) linked_programs.push(p);
        }
        if (l.linked_project_id) {
          const p = projectById.get(l.linked_project_id);
          if (p) linked_projects.push(p);
        }
      }

      return {
        ...interactionRes.data,
        logged_by_contact: interactionRes.data.logged_by
          ? contactById.get(interactionRes.data.logged_by) ?? null
          : null,
        participants: (partsRes.data ?? []).map((p) => ({
          ...p,
          contact: contactById.get(p.contact_id) ?? null,
        })),
        linked_events,
        linked_committees,
        linked_programs,
        linked_projects,
        raw_links: links,
      };
    },
  });
}

// =============================================================================
// useInteractionsForContact — interactions where this contact is a participant
// =============================================================================
export function useInteractionsForContact(contactId: string | undefined) {
  return useQuery<Interaction[]>({
    queryKey: contactId
      ? KEYS.interactionsForContact(contactId)
      : ["interactions-for-contact", "none"],
    enabled: Boolean(contactId),
    queryFn: async () => {
      if (!contactId) return [];
      const { data: parts, error: partsErr } = await supabase
        .from("active_interaction_participants")
        .select("interaction_id")
        .eq("contact_id", contactId);
      if (partsErr) throw partsErr;
      const ids = (parts ?? []).map((p) => p.interaction_id);
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("active_interactions")
        .select("*")
        .in("id", ids)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// =============================================================================
// useInteractionsFor* — for events, committees, projects
// =============================================================================
function makeLinkedHook(
  linkColumn:
    | "linked_event_id"
    | "linked_committee_id"
    | "linked_program_id"
    | "linked_project_id",
  keyFactory: (id: string) => readonly unknown[],
) {
  return (linkedId: string | undefined) =>
    useQuery<Interaction[]>({
      queryKey: linkedId ? keyFactory(linkedId) : [linkColumn, "none"],
      enabled: Boolean(linkedId),
      queryFn: async () => {
        if (!linkedId) return [];
        const { data: links, error: linksErr } = await supabase
          .from("active_interaction_links")
          .select("interaction_id")
          .eq(linkColumn, linkedId);
        if (linksErr) throw linksErr;
        const ids = (links ?? []).map((l) => l.interaction_id);
        if (ids.length === 0) return [];

        const { data, error } = await supabase
          .from("active_interactions")
          .select("*")
          .in("id", ids)
          .order("occurred_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
      },
    });
}

export const useInteractionsForEvent = makeLinkedHook(
  "linked_event_id",
  KEYS.interactionsForEvent,
);
export const useInteractionsForCommittee = makeLinkedHook(
  "linked_committee_id",
  KEYS.interactionsForCommittee,
);
export const useInteractionsForProject = makeLinkedHook(
  "linked_project_id",
  KEYS.interactionsForProject,
);

// =============================================================================
// useUpsertInteraction — handles the interaction itself + reconciles
// participants and links in a single round-trip.
// =============================================================================
type UpsertInteractionInput = {
  id?: string;
  type: "email" | "call" | "meeting" | "note" | "other";
  subject: string;
  content: string | null;
  occurred_at: string;
  direction: "inbound" | "outbound" | "internal" | null;
  participant_contact_ids: string[];
  linked_event_ids: string[];
  linked_committee_ids: string[];
  linked_program_ids: string[];
  linked_project_ids: string[];
};

export function useUpsertInteraction() {
  const qc = useQueryClient();
  return useMutation<Interaction, Error, UpsertInteractionInput>({
    mutationFn: async (input) => {
      const {
        id,
        participant_contact_ids,
        linked_event_ids,
        linked_committee_ids,
        linked_program_ids,
        linked_project_ids,
        ...row
      } = input;

      // 1. Upsert the interaction row itself
      let interaction: Interaction;
      if (id) {
        const { data, error } = await supabase
          .from("interactions")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        interaction = data;
      } else {
        const { data, error } = await supabase
          .from("interactions")
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        interaction = data;
      }

      // 2. Reconcile participants — delete removed, insert new
      const { data: existingParts } = await supabase
        .from("active_interaction_participants")
        .select("*")
        .eq("interaction_id", interaction.id);
      const existingPartIds = new Set(
        (existingParts ?? []).map((p) => p.contact_id),
      );
      const desiredPartIds = new Set(participant_contact_ids);

      // Remove participants no longer in the desired set
      for (const p of existingParts ?? []) {
        if (!desiredPartIds.has(p.contact_id)) {
          await supabase.rpc("soft_delete", {
            table_name: "interaction_participants",
            row_id: p.id,
          });
        }
      }
      // Add new participants
      const partsToAdd = participant_contact_ids.filter(
        (cid) => !existingPartIds.has(cid),
      );
      if (partsToAdd.length > 0) {
        const { error } = await supabase
          .from("interaction_participants")
          .insert(
            partsToAdd.map((contact_id) => ({
              interaction_id: interaction.id,
              contact_id,
              participant_role: "participant" as const,
            })),
          );
        if (error) throw error;
      }

      // 3. Reconcile links
      // Build the desired set of links as keyed strings
      const desiredLinks = new Set<string>([
        ...linked_event_ids.map((id) => `event:${id}`),
        ...linked_committee_ids.map((id) => `committee:${id}`),
        ...linked_program_ids.map((id) => `program:${id}`),
        ...linked_project_ids.map((id) => `project:${id}`),
      ]);

      const { data: existingLinks } = await supabase
        .from("active_interaction_links")
        .select("*")
        .eq("interaction_id", interaction.id);

      const existingLinkKeys = new Map<string, string>(); // key → link.id
      for (const l of existingLinks ?? []) {
        let k: string | null = null;
        if (l.linked_event_id) k = `event:${l.linked_event_id}`;
        else if (l.linked_committee_id) k = `committee:${l.linked_committee_id}`;
        else if (l.linked_program_id) k = `program:${l.linked_program_id}`;
        else if (l.linked_project_id) k = `project:${l.linked_project_id}`;
        if (k) existingLinkKeys.set(k, l.id);
      }

      // Soft-delete links no longer wanted
      for (const [key, linkId] of existingLinkKeys) {
        if (!desiredLinks.has(key)) {
          await supabase.rpc("soft_delete", {
            table_name: "interaction_links",
            row_id: linkId,
          });
        }
      }

      // Insert new links
      const linksToAdd: Record<string, string | null>[] = [];
      for (const key of desiredLinks) {
        if (existingLinkKeys.has(key)) continue;
        const [kind, targetId] = key.split(":");
        const link: Record<string, string | null> = {
          interaction_id: interaction.id,
          linked_event_id: null,
          linked_committee_id: null,
          linked_program_id: null,
          linked_project_id: null,
        };
        if (kind === "event") link.linked_event_id = targetId;
        else if (kind === "committee") link.linked_committee_id = targetId;
        else if (kind === "program") link.linked_program_id = targetId;
        else if (kind === "project") link.linked_project_id = targetId;
        linksToAdd.push(link);
      }
      if (linksToAdd.length > 0) {
        const { error } = await supabase
          .from("interaction_links")
          .insert(linksToAdd);
        if (error) throw error;
      }

      return interaction;
    },
    onSuccess: (interaction) => {
      qc.invalidateQueries({ queryKey: KEYS.interactions });
      qc.invalidateQueries({ queryKey: KEYS.interaction(interaction.id) });
      // Broad invalidation of cross-entity views — cheaper than tracking
      // every contact/event/etc id that might have been affected
      qc.invalidateQueries({ queryKey: ["interactions-for-contact"] });
      qc.invalidateQueries({ queryKey: ["interactions-for-event"] });
      qc.invalidateQueries({ queryKey: ["interactions-for-committee"] });
      qc.invalidateQueries({ queryKey: ["interactions-for-project"] });
    },
  });
}

// =============================================================================
// useSoftDeleteInteraction
// =============================================================================
export function useSoftDeleteInteraction() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("soft_delete", {
        table_name: "interactions",
        row_id: id,
      });
      if (error) throw error;
      return data ?? id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.interactions });
      qc.invalidateQueries({ queryKey: ["interactions-for-contact"] });
      qc.invalidateQueries({ queryKey: ["interactions-for-event"] });
      qc.invalidateQueries({ queryKey: ["interactions-for-committee"] });
      qc.invalidateQueries({ queryKey: ["interactions-for-project"] });
    },
  });
}

// =============================================================================
// Type label helpers
// =============================================================================
export const INTERACTION_TYPE_LABELS: Record<string, string> = {
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  note: "Note",
  other: "Other",
};

export const INTERACTION_DIRECTION_LABELS: Record<string, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
  internal: "Internal",
};
