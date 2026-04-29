import { useMemo } from "react";
import { useContacts } from "@/features/contacts/hooks";
import { usePrograms } from "@/features/programs/hooks";
import { useCommittees } from "@/features/committees/hooks";
import { useEvents } from "@/features/events/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useTasks } from "@/features/tasks/hooks";
import { useInteractions } from "@/features/interactions/hooks";
import { htmlToPlainText } from "@/lib/format";

/**
 * The kinds of entities that show up in the global search palette.
 *
 * Tasks and interactions are included even though they don't have their
 * own detail routes — for tasks we navigate to the parent project, and
 * for interactions we navigate to the interaction detail page.
 */
export type SearchEntityKind =
  | "contact"
  | "program"
  | "committee"
  | "event"
  | "project"
  | "task"
  | "interaction";

export type SearchableEntity = {
  kind: SearchEntityKind;
  id: string;
  /** Primary display label (typically the name/title). */
  label: string;
  /** Optional secondary line shown beneath the label (email, type, etc). */
  sublabel?: string;
  /** Where to navigate when this result is selected. */
  href: string;
  /** All searchable text concatenated — used for matching. */
  haystack: string;
};

/**
 * useSearchableEntities — unifies all entity queries into one flat list of
 * searchable items.
 *
 * This is intentionally simple. We rely on TanStack Query's caching: each
 * underlying useX() call is already used elsewhere in the app, so by the
 * time the user opens search the data is usually already in memory. The
 * first time it isn't, the palette shows a brief loading state.
 */
export function useSearchableEntities(): {
  entities: SearchableEntity[];
  isLoading: boolean;
} {
  const contacts = useContacts();
  const programs = usePrograms();
  const committees = useCommittees();
  const events = useEvents();
  const projects = useProjects();
  const tasks = useTasks();
  const interactions = useInteractions();

  const entities = useMemo<SearchableEntity[]>(() => {
    const out: SearchableEntity[] = [];

    for (const c of contacts.data ?? []) {
      const name = `${c.first_name} ${c.last_name}`;
      out.push({
        kind: "contact",
        id: c.id,
        label: name,
        sublabel: c.email ?? undefined,
        href: `/contacts/${c.id}`,
        haystack: [name, c.email, c.phone, ...c.category_names].filter(Boolean).join(" ").toLowerCase(),
      });
    }

    for (const p of programs.data ?? []) {
      out.push({
        kind: "program",
        id: p.id,
        label: p.name,
        sublabel:
          p.city && p.state ? `${p.city}, ${p.state}` : p.short_name,
        href: `/programs/${p.id}`,
        haystack: [p.name, p.short_name, p.city, p.state].filter(Boolean).join(" ").toLowerCase(),
      });
    }

    for (const c of committees.data ?? []) {
      out.push({
        kind: "committee",
        id: c.id,
        label: c.name,
        sublabel: c.is_executive ? "Executive Committee" : undefined,
        href: `/committees/${c.id}`,
        haystack: [c.name, htmlToPlainText(c.description)].filter(Boolean).join(" ").toLowerCase(),
      });
    }

    for (const e of events.data ?? []) {
      const typeLabel = e.event_type === "tournament" ? "Tournament" : "Board meeting";
      out.push({
        kind: "event",
        id: e.id,
        label: e.name,
        sublabel: `${typeLabel} · ${e.start_date}`,
        href: `/events/${e.id}`,
        haystack: [e.name, e.location_city, e.location_state, e.tournament_type].filter(Boolean).join(" ").toLowerCase(),
      });
    }

    for (const p of projects.data ?? []) {
      out.push({
        kind: "project",
        id: p.id,
        label: p.name,
        sublabel: p.status === "active" ? "Active" : p.status,
        href: `/projects/${p.id}`,
        haystack: [p.name, htmlToPlainText(p.description)].filter(Boolean).join(" ").toLowerCase(),
      });
    }

    for (const t of tasks.data ?? []) {
      // Task navigation: jump to the parent project so the user can see
      // and edit the task in context. If no project, jump to the tasks list.
      const href = t.project_id ? `/projects/${t.project_id}` : "/tasks";
      out.push({
        kind: "task",
        id: t.id,
        label: t.title,
        sublabel: t.project ? `in ${t.project.name}` : "Standalone task",
        href,
        haystack: [t.title, htmlToPlainText(t.description), t.project?.name].filter(Boolean).join(" ").toLowerCase(),
      });
    }

    for (const i of interactions.data ?? []) {
      out.push({
        kind: "interaction",
        id: i.id,
        label: i.subject,
        sublabel: `${i.type} · ${i.occurred_at.slice(0, 10)}`,
        href: `/interactions/${i.id}`,
        haystack: [i.subject, htmlToPlainText(i.content), i.type].filter(Boolean).join(" ").toLowerCase(),
      });
    }

    return out;
  }, [
    contacts.data,
    programs.data,
    committees.data,
    events.data,
    projects.data,
    tasks.data,
    interactions.data,
  ]);

  const isLoading =
    contacts.isLoading ||
    programs.isLoading ||
    committees.isLoading ||
    events.isLoading ||
    projects.isLoading ||
    tasks.isLoading ||
    interactions.isLoading;

  return { entities, isLoading };
}
