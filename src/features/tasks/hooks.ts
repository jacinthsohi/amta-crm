import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Task, Contact, Project } from "@/lib/database.types";

const KEYS = {
  tasks: ["tasks"] as const,
  task: (id: string) => ["task", id] as const,
  tasksForProject: (id: string) => ["tasks-for-project", id] as const,
  tasksForContact: (id: string) => ["tasks-for-contact", id] as const,
};

// =============================================================================
// useTasks — global task list with project + assignee joined
// =============================================================================
export type TaskWithRelations = Task & {
  assignee: Contact | null;
  project: Project | null;
};

export function useTasks() {
  return useQuery<TaskWithRelations[]>({
    queryKey: KEYS.tasks,
    queryFn: async () => {
      const [tasksRes, contactsRes, projectsRes] = await Promise.all([
        supabase
          .from("active_tasks")
          .select("*")
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase.from("active_contacts").select("*"),
        supabase.from("active_projects").select("*"),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (projectsRes.error) throw projectsRes.error;

      const contactById = new Map(
        (contactsRes.data ?? []).map((c) => [c.id, c]),
      );
      const projectById = new Map(
        (projectsRes.data ?? []).map((p) => [p.id, p]),
      );

      return (tasksRes.data ?? []).map((t) => ({
        ...t,
        assignee: t.assigned_to
          ? contactById.get(t.assigned_to) ?? null
          : null,
        project: t.project_id ? projectById.get(t.project_id) ?? null : null,
      }));
    },
  });
}

// =============================================================================
// useTask — single task (used by edit form to refresh)
// =============================================================================
export function useTask(id: string | undefined) {
  return useQuery<Task | null>({
    queryKey: id ? KEYS.task(id) : ["task", "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("active_tasks")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// =============================================================================
// useTasksForContact — tasks assigned to a person
// =============================================================================
export function useTasksForContact(contactId: string | undefined) {
  return useQuery<Task[]>({
    queryKey: contactId
      ? KEYS.tasksForContact(contactId)
      : ["tasks-for-contact", "none"],
    enabled: Boolean(contactId),
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from("active_tasks")
        .select("*")
        .eq("assigned_to", contactId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// =============================================================================
// useUpsertTask
// =============================================================================
type UpsertTaskInput = {
  id?: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high";
  project_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
};

export function useUpsertTask() {
  const qc = useQueryClient();
  return useMutation<Task, Error, UpsertTaskInput>({
    mutationFn: async (input) => {
      const { id, ...row } = input;
      if (id) {
        const { data, error } = await supabase
          .from("tasks")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("tasks")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: KEYS.tasks });
      qc.invalidateQueries({ queryKey: KEYS.task(task.id) });
      // Project's task list refresh
      if (task.project_id) {
        qc.invalidateQueries({ queryKey: ["project", task.project_id] });
      }
      // Assignee's tasks list refresh
      if (task.assigned_to) {
        qc.invalidateQueries({
          queryKey: KEYS.tasksForContact(task.assigned_to),
        });
      }
    },
  });
}

// =============================================================================
// useSoftDeleteTask
// =============================================================================
export function useSoftDeleteTask() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc("soft_delete", {
        table_name: "tasks",
        row_id: id,
      });
      if (error) throw error;
      return data ?? id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.tasks });
      // Also broadly invalidate project/contact tasks views
      qc.invalidateQueries({ queryKey: ["project"] });
      qc.invalidateQueries({ queryKey: ["tasks-for-contact"] });
    },
  });
}
