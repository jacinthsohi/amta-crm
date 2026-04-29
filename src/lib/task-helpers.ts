import type { Task } from "./database.types";

const todayISO = (): string => new Date().toISOString().slice(0, 10);

export function isTaskOverdue(task: Pick<Task, "status" | "due_date">): boolean {
  if (task.status === "done") return false;
  if (!task.due_date) return false;
  return task.due_date < todayISO();
}

export type DueDateLabel = {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
};

export function formatDueDate(
  iso: string | null | undefined,
  status: Task["status"],
): DueDateLabel | null {
  if (!iso) return null;
  const today = todayISO();
  const todayD = new Date(today);
  const d = new Date(iso);
  const diffDays = Math.round((d.getTime() - todayD.getTime()) / 86_400_000);
  const isOverdue = status !== "done" && iso < today;
  const isToday = iso === today;

  let label: string;
  if (isToday) label = "Today";
  else if (diffDays === 1) label = "Tomorrow";
  else if (diffDays === -1) label = "Yesterday";
  else if (diffDays > 1 && diffDays <= 7) label = `In ${diffDays}d`;
  else if (diffDays < -1 && diffDays >= -7) label = `${-diffDays}d ago`;
  else label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return { label, isOverdue, isToday };
}
