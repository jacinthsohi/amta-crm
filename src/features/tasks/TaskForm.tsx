import { useEffect, useState } from "react";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea, Select, PillSelect } from "@/components/Inputs";
import { ContactPicker } from "@/components/ContactPicker";
import {
  PrimaryButton,
  SecondaryButton,
  DangerButton,
} from "@/components/Buttons";
import { useContacts } from "@/features/contacts/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useUpsertTask, useSoftDeleteTask } from "./hooks";
import type { Task } from "@/lib/database.types";
import { formatError } from "@/lib/errors";

import { RichTextEditor } from "@/components/RichTextEditor";
type Status = "todo" | "in_progress" | "blocked" | "done";
type Priority = "low" | "medium" | "high";

type FormState = {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  project_id: string | null;
  assigned_to: string | null;
  due_date: string;
};

/**
 * TaskForm — create/edit/soft-delete tasks.
 *
 * Project lock-in: pass `defaultProjectId` to start the form with that
 * project pre-selected (used from a project's detail page when adding a
 * task — the user might still re-pick if they want, but the default is
 * set so the most common case is one-click).
 */
export function TaskForm({
  open,
  onClose,
  initialTask,
  defaultProjectId,
}: {
  open: boolean;
  onClose: () => void;
  initialTask?: Task;
  defaultProjectId?: string;
}) {
  const isEdit = Boolean(initialTask);

  const upsert = useUpsertTask();
  const softDelete = useSoftDeleteTask();
  const { data: contacts } = useContacts();
  const { data: projects } = useProjects();

  const blank = (): FormState => ({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    project_id: defaultProjectId ?? null,
    assigned_to: null,
    due_date: "",
  });

  const [form, setForm] = useState<FormState>(blank);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialTask) {
      setForm({
        title: initialTask.title,
        description: initialTask.description ?? "",
        status: initialTask.status,
        priority: initialTask.priority,
        project_id: initialTask.project_id,
        assigned_to: initialTask.assigned_to,
        due_date: initialTask.due_date ?? "",
      });
    } else {
      setForm(blank());
    }
    setTouched(false);
    setErrors({});
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTask, defaultProjectId]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      await upsert.mutateAsync({
        id: initialTask?.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        project_id: form.project_id,
        assigned_to: form.assigned_to,
        due_date: form.due_date || null,
      });
      onClose();
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const handleDelete = async () => {
    if (!initialTask) return;
    if (!window.confirm("Delete this task?")) return;
    setSubmitError(null);
    try {
      await softDelete.mutateAsync(initialTask.id);
      onClose();
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const submitting = upsert.isPending || softDelete.isPending;
  const cantSubmit = submitting || !form.title.trim();

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      dirty={touched && !submitting}
      title={isEdit ? "Edit task" : "New task"}
      footer={
        <>
          {isEdit && (
            <DangerButton onClick={handleDelete} disabled={submitting}>
              Delete
            </DangerButton>
          )}
          <div className="flex-1" />
          <SecondaryButton onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={cantSubmit}>
            {submitting ? "Saving…" : isEdit ? "Save" : "Create task"}
          </PrimaryButton>
        </>
      }
    >
      <FieldGroup label="Title" required error={errors.title}>
        <TextInput
          value={form.title}
          onChange={(v) => set("title", v)}
          placeholder="Draft the new ethics policy"
          error={errors.title}
          autoFocus
        />
      </FieldGroup>

      <FieldGroup label="Description">
        <RichTextEditor
          value={form.description}
          onChange={(v) => set("description", v)}
          rows={3}
        />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Status">
          <PillSelect<Status>
            value={form.status}
            onChange={(v) => set("status", v)}
            options={[
              { id: "todo", label: "To do" },
              { id: "in_progress", label: "In progress" },
              { id: "blocked", label: "Blocked" },
              { id: "done", label: "Done" },
            ]}
          />
        </FieldGroup>
        <FieldGroup label="Priority">
          <PillSelect<Priority>
            value={form.priority}
            onChange={(v) => set("priority", v)}
            options={[
              { id: "low", label: "Low" },
              { id: "medium", label: "Medium" },
              { id: "high", label: "High" },
            ]}
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Project" hint="Optional — leave blank for standalone tasks.">
        <Select
          value={form.project_id}
          onChange={(v) => set("project_id", v)}
          placeholder="No project"
          options={(projects ?? []).map((p) => ({ id: p.id, label: p.name }))}
        />
      </FieldGroup>

      <FieldGroup label="Assigned to">
        <ContactPicker
          value={form.assigned_to}
          onChange={(v) => set("assigned_to", v)}
          contacts={contacts ?? []}
          placeholder="Pick a contact…"
        />
      </FieldGroup>

      <FieldGroup label="Due date">
        <TextInput
          type="date"
          value={form.due_date}
          onChange={(v) => set("due_date", v)}
        />
      </FieldGroup>

      {submitError && (
        <div className="mt-3 p-3 rounded-md text-xs text-red-700 bg-red-50 border border-red-100">
          {submitError}
        </div>
      )}
    </SidePanel>
  );
}
