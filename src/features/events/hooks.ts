import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Event,
  EventHost,
  EventStaff,
  EventDocument,
  Contact,
  Program,
} from "@/lib/database.types";

const KEYS = {
  events: ["events"] as const,
  event: (id: string) => ["event", id] as const,
  eventsForProgram: (programId: string) => ["events-for-program", programId] as const,
  eventsForContact: (contactId: string) => ["events-for-contact", contactId] as const,
};

// =============================================================================
// useEvents — list
// =============================================================================
export function useEvents() {
  return useQuery<Event[]>({
    queryKey: KEYS.events,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_events")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// =============================================================================
// useEvent — single event with hosts, staff, documents joined to entities
// =============================================================================
export type EventWithRelations = Event & {
  primary_host_contact: Contact | null;
  hosts: (EventHost & { program: Program | null })[];
  staff: (EventStaff & { contact: Contact | null })[];
  documents: EventDocument[];
};

export function useEvent(id: string | undefined) {
  return useQuery<EventWithRelations | null>({
    queryKey: id ? KEYS.event(id) : ["event", "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const [
        eventRes,
        hostsRes,
        staffRes,
        docsRes,
        contactsRes,
        programsRes,
      ] = await Promise.all([
        supabase.from("active_events").select("*").eq("id", id).maybeSingle(),
        supabase.from("active_event_hosts").select("*").eq("event_id", id),
        supabase.from("active_event_staff").select("*").eq("event_id", id),
        supabase
          .from("active_event_documents")
          .select("*")
          .eq("event_id", id)
          .order("uploaded_at", { ascending: false }),
        supabase.from("active_contacts").select("*"),
        supabase.from("active_programs").select("*"),
      ]);

      if (eventRes.error) throw eventRes.error;
      if (!eventRes.data) return null;
      if (hostsRes.error) throw hostsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (docsRes.error) throw docsRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (programsRes.error) throw programsRes.error;

      const contactById = new Map(
        (contactsRes.data ?? []).map((c) => [c.id, c]),
      );
      const programById = new Map(
        (programsRes.data ?? []).map((p) => [p.id, p]),
      );

      return {
        ...eventRes.data,
        primary_host_contact: eventRes.data.primary_host_contact_id
          ? contactById.get(eventRes.data.primary_host_contact_id) ?? null
          : null,
        hosts: (hostsRes.data ?? []).map((h) => ({
          ...h,
          program: programById.get(h.program_id) ?? null,
        })),
        staff: (staffRes.data ?? []).map((s) => ({
          ...s,
          contact: contactById.get(s.contact_id) ?? null,
        })),
        documents: docsRes.data ?? [],
      };
    },
  });
}

// =============================================================================
// useEventsForProgram — events hosted by a given program
// =============================================================================
export function useEventsForProgram(programId: string | undefined) {
  return useQuery<Event[]>({
    queryKey: programId ? KEYS.eventsForProgram(programId) : ["events-for-program", "none"],
    enabled: Boolean(programId),
    queryFn: async () => {
      if (!programId) return [];
      const { data: hosts, error: hostsErr } = await supabase
        .from("active_event_hosts")
        .select("event_id")
        .eq("program_id", programId);
      if (hostsErr) throw hostsErr;
      const eventIds = (hosts ?? []).map((h) => h.event_id);
      if (eventIds.length === 0) return [];

      const { data: events, error: eventsErr } = await supabase
        .from("active_events")
        .select("*")
        .in("id", eventIds)
        .order("start_date", { ascending: false });
      if (eventsErr) throw eventsErr;
      return events ?? [];
    },
  });
}

// =============================================================================
// useEventsForContact — events someone is staffing
// =============================================================================
export function useEventsForContact(contactId: string | undefined) {
  return useQuery<Event[]>({
    queryKey: contactId
      ? KEYS.eventsForContact(contactId)
      : ["events-for-contact", "none"],
    enabled: Boolean(contactId),
    queryFn: async () => {
      if (!contactId) return [];
      const { data: staff, error: staffErr } = await supabase
        .from("active_event_staff")
        .select("event_id")
        .eq("contact_id", contactId);
      if (staffErr) throw staffErr;
      const eventIds = (staff ?? []).map((s) => s.event_id);
      if (eventIds.length === 0) return [];

      const { data: events, error: eventsErr } = await supabase
        .from("active_events")
        .select("*")
        .in("id", eventIds)
        .order("start_date", { ascending: false });
      if (eventsErr) throw eventsErr;
      return events ?? [];
    },
  });
}

// =============================================================================
// useUpsertEvent / useSoftDeleteEvent
// =============================================================================
type UpsertEventInput = {
  id?: string;
  name: string;
  event_type: "tournament" | "board_meeting";
  tournament_type: "invitational" | "regional" | "orcs" | "nct" | null;
  start_date: string;
  end_date: string | null;
  location_city: string | null;
  location_state: string | null;
  photo_banner_gradient: string | null;
  status: "upcoming" | "in_progress" | "completed" | "cancelled";
  primary_host_contact_id: string | null;
  description: string | null;
  notes: string | null;
};

export function useUpsertEvent() {
  const qc = useQueryClient();
  return useMutation<Event, Error, UpsertEventInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("events")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("events")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: KEYS.events });
      qc.invalidateQueries({ queryKey: KEYS.event(event.id) });
    },
  });
}

export function useSoftDeleteEvent() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("soft_delete", {
        table_name: "events",
        row_id: id,
      });
      if (error) throw error;
      return data ?? id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.events });
      // Could be hosting events on programs/contacts — invalidate broadly
      qc.invalidateQueries({ queryKey: ["events-for-program"] });
      qc.invalidateQueries({ queryKey: ["events-for-contact"] });
    },
  });
}

// =============================================================================
// Inline-record mutations: hosts, staff, documents
// =============================================================================

type UpsertHostInput = {
  id?: string;
  event_id: string;
  program_id: string;
  host_role: string;
};

export function useUpsertEventHost() {
  const qc = useQueryClient();
  return useMutation<EventHost, Error, UpsertHostInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("event_hosts")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("event_hosts")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (h) => {
      qc.invalidateQueries({ queryKey: KEYS.event(h.event_id) });
      qc.invalidateQueries({ queryKey: KEYS.eventsForProgram(h.program_id) });
    },
  });
}

export function useSoftDeleteEventHost() {
  const qc = useQueryClient();
  return useMutation<string, Error, { id: string; event_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc("soft_delete", {
        table_name: "event_hosts",
        row_id: id,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (_, { event_id }) => {
      qc.invalidateQueries({ queryKey: KEYS.event(event_id) });
      qc.invalidateQueries({ queryKey: ["events-for-program"] });
    },
  });
}

type UpsertStaffInput = {
  id?: string;
  event_id: string;
  contact_id: string;
  position: string;
  notes: string | null;
};

export function useUpsertEventStaff() {
  const qc = useQueryClient();
  return useMutation<EventStaff, Error, UpsertStaffInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("event_staff")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("event_staff")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: KEYS.event(s.event_id) });
      qc.invalidateQueries({ queryKey: KEYS.eventsForContact(s.contact_id) });
    },
  });
}

export function useSoftDeleteEventStaff() {
  const qc = useQueryClient();
  return useMutation<string, Error, { id: string; event_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc("soft_delete", {
        table_name: "event_staff",
        row_id: id,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (_, { event_id }) => {
      qc.invalidateQueries({ queryKey: KEYS.event(event_id) });
      qc.invalidateQueries({ queryKey: ["events-for-contact"] });
    },
  });
}

type UpsertDocumentInput = {
  id?: string;
  event_id: string;
  document_type:
    | "agenda"
    | "meeting_minutes"
    | "welcome_packet"
    | "tournament_packet"
    | "tabulation_summary"
    | "other";
  title: string;
  url: string;
};

export function useUpsertEventDocument() {
  const qc = useQueryClient();
  return useMutation<EventDocument, Error, UpsertDocumentInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("event_documents")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("event_documents")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: KEYS.event(d.event_id) });
    },
  });
}

export function useSoftDeleteEventDocument() {
  const qc = useQueryClient();
  return useMutation<string, Error, { id: string; event_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc("soft_delete", {
        table_name: "event_documents",
        row_id: id,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (_, { event_id }) => {
      qc.invalidateQueries({ queryKey: KEYS.event(event_id) });
    },
  });
}

// =============================================================================
// Helpers
// =============================================================================

export const EVENT_GRADIENTS = [
  {
    id: "maroon",
    label: "Championship",
    value:
      "linear-gradient(135deg, #70172a 0%, #a82d4a 50%, #d97706 100%)",
  },
  {
    id: "blue",
    label: "Lake",
    value: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #38bdf8 100%)",
  },
  {
    id: "purple",
    label: "Heritage",
    value: "linear-gradient(135deg, #581c87 0%, #7e22ce 50%, #c084fc 100%)",
  },
  {
    id: "green",
    label: "Forest",
    value: "linear-gradient(135deg, #14532d 0%, #166534 50%, #84cc16 100%)",
  },
  {
    id: "orange",
    label: "Sunset",
    value: "linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #fb923c 100%)",
  },
  {
    id: "warm",
    label: "Warmth",
    value: "linear-gradient(135deg, #422006 0%, #78350f 100%)",
  },
  {
    id: "slate",
    label: "Slate",
    value: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
  },
];

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  agenda: "Agenda",
  meeting_minutes: "Meeting minutes",
  welcome_packet: "Welcome packet",
  tournament_packet: "Tournament packet",
  tabulation_summary: "Tabulation summary",
  other: "Other",
};
