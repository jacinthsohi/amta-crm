import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Project,
  Task,
  Contact,
  Committee,
  Event,
} from "@/lib/database.types";

const KEYS = {
  projects: ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  projectsForCommittee: (id: string) => ["projects-for-committee", id] as const,
  projectsForEvent: (id: string) => ["projects-for-event", id] as const,
};

// =============================================================================
// useProjects — list
// =============================================================================
export function useProjects() {
  return useQuery<Project[]>({
    queryKey: KEYS.projects,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// =============================================================================
// useProject — detail with linked entities and tasks
// =============================================================================
export type ProjectWithRelations = Project & {
  owner: Contact | null;
  committee: Committee | null;
  event: Event | null;
  tasks: Task[];
};

export function useProject(id: string | undefined) {
  return useQuery<ProjectWithRelations | null>({
    queryKey: id ? KEYS.project(id) : ["project", "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const [
        projectRes,
        tasksRes,
        contactsRes,
        committeesRes,
        eventsRes,
      ] = await Promise.all([
        supabase.from("active_projects").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("active_tasks")
          .select("*")
          .eq("project_id", id)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase.from("active_contacts").select("*"),
        supabase.from("active_committees").select("*"),
        supabase.from("active_events").select("*"),
      ]);

      if (projectRes.error) throw projectRes.error;
      if (!projectRes.data) return null;
      if (tasksRes.error) throw tasksRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (committeesRes.error) throw committeesRes.error;
      if (eventsRes.error) throw eventsRes.error;

      const contactById = new Map(
        (contactsRes.data ?? []).map((c) => [c.id, c]),
      );
      const committeeById = new Map(
        (committeesRes.data ?? []).map((c) => [c.id, c]),
      );
      const eventById = new Map(
        (eventsRes.data ?? []).map((e) => [e.id, e]),
      );

      const p = projectRes.data;
      return {
        ...p,
        owner: p.owner_id ? contactById.get(p.owner_id) ?? null : null,
        committee: p.committee_id ? committeeById.get(p.committee_id) ?? null : null,
        event: p.event_id ? eventById.get(p.event_id) ?? null : null,
        tasks: tasksRes.data ?? [],
      };
    },
  });
}

// =============================================================================
// useProjectsForCommittee
// =============================================================================
export function useProjectsForCommittee(committeeId: string | undefined) {
  return useQuery<Project[]>({
    queryKey: committeeId
      ? KEYS.projectsForCommittee(committeeId)
      : ["projects-for-committee", "none"],
    enabled: Boolean(committeeId),
    queryFn: async () => {
      if (!committeeId) return [];
      const { data, error } = await supabase
        .from("active_projects")
        .select("*")
        .eq("committee_id", committeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// =============================================================================
// useProjectsForEvent
// =============================================================================
export function useProjectsForEvent(eventId: string | undefined) {
  return useQuery<Project[]>({
    queryKey: eventId
      ? KEYS.projectsForEvent(eventId)
      : ["projects-for-event", "none"],
    enabled: Boolean(eventId),
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("active_projects")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// =============================================================================
// useUpsertProject
// =============================================================================
type UpsertProjectInput = {
  id?: string;
  name: string;
  description: string | null;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  owner_id: string | null;
  committee_id: string | null;
  event_id: string | null;
  start_date: string | null;
  target_completion_date: string | null;
};

export function useUpsertProject() {
  const qc = useQueryClient();
  return useMutation<Project, Error, UpsertProjectInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("projects")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("projects")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: KEYS.projects });
      qc.invalidateQueries({ queryKey: KEYS.project(project.id) });
      // Affected committee / event get their projects lists refreshed
      qc.invalidateQueries({ queryKey: ["projects-for-committee"] });
      qc.invalidateQueries({ queryKey: ["projects-for-event"] });
    },
  });
}

// =============================================================================
// useSoftDeleteProject
// =============================================================================
export function useSoftDeleteProject() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("soft_delete", {
        table_name: "projects",
        row_id: id,
      });
      if (error) throw error;
      return data ?? id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.projects });
      qc.invalidateQueries({ queryKey: ["projects-for-committee"] });
      qc.invalidateQueries({ queryKey: ["projects-for-event"] });
    },
  });
}
