import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useCommitteesLookup } from "@/lib/lookups";
import { useEvents } from "@/features/events/hooks";
import {
  useUpsertProject,
  useSoftDeleteProject,
  type ProjectWithRelations,
} from "./hooks";
import { formatError } from "@/lib/errors";

import { RichTextEditor } from "@/components/RichTextEditor";
type Status = "planning" | "active" | "on_hold" | "completed" | "cancelled";
type Priority = "low" | "medium" | "high";

type FormState = {
  name: string;
  description: string;
  status: Status;
  priority: Priority;
  owner_id: string | null;
  committee_id: string | null;
  event_id: string | null;
  start_date: string;
  target_completion_date: string;
};

const blank: FormState = {
  name: "",
  description: "",
  status: "planning",
  priority: "medium",
  owner_id: null,
  committee_id: null,
  event_id: null,
  start_date: "",
  target_completion_date: "",
};

export function ProjectForm({
  open,
  onClose,
  initialProject,
}: {
  open: boolean;
  onClose: () => void;
  initialProject?: ProjectWithRelations;
}) {
  const navigate = useNavigate();
  const isEdit = Boolean(initialProject);

  const upsert = useUpsertProject();
  const softDelete = useSoftDeleteProject();
  const { data: contacts } = useContacts();
  const { data: committees } = useCommitteesLookup();
  const { data: events } = useEvents();

  const [form, setForm] = useState<FormState>(blank);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialProject) {
      setForm({
        name: initialProject.name,
        description: initialProject.description ?? "",
        status: initialProject.status,
        priority: initialProject.priority,
        owner_id: initialProject.owner_id,
        committee_id: initialProject.committee_id,
        event_id: initialProject.event_id,
        start_date: initialProject.start_date ?? "",
        target_completion_date: initialProject.target_completion_date ?? "",
      });
    } else {
      setForm(blank);
    }
    setTouched(false);
    setErrors({});
    setSubmitError(null);
  }, [open, initialProject]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (
      form.start_date &&
      form.target_completion_date &&
      form.target_completion_date < form.start_date
    )
      e.target_completion_date = "Target date must be after start";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      const saved = await upsert.mutateAsync({
        id: initialProject?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        owner_id: form.owner_id,
        committee_id: form.committee_id,
        event_id: form.event_id,
        start_date: form.start_date || null,
        target_completion_date: form.target_completion_date || null,
      });
      onClose();
      if (!isEdit) navigate(`/projects/${saved.id}`);
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const handleDelete = async () => {
    if (!initialProject) return;
    if (
      !window.confirm(
        "Delete this project? Tasks and interactions linked to it will remain in the database but reference a deleted project.",
      )
    )
      return;
    setSubmitError(null);
    try {
      await softDelete.mutateAsync(initialProject.id);
      onClose();
      navigate("/projects");
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const submitting = upsert.isPending || softDelete.isPending;
  const cantSubmit = submitting || !form.name.trim();

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      dirty={touched && !submitting}
      title={isEdit ? "Edit project" : "New project"}
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
            {submitting ? "Saving…" : isEdit ? "Save" : "Create project"}
          </PrimaryButton>
        </>
      }
    >
      <FieldGroup label="Name" required error={errors.name}>
        <TextInput
          value={form.name}
          onChange={(v) => set("name", v)}
          placeholder="Develop new Code of Ethics"
          error={errors.name}
          autoFocus
        />
      </FieldGroup>

      <FieldGroup label="Description">
        <RichTextEditor
          value={form.description}
          onChange={(v) => set("description", v)}
          placeholder="What's this project about?"
          rows={3}
        />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Status">
          <PillSelect<Status>
            value={form.status}
            onChange={(v) => set("status", v)}
            options={[
              { id: "planning", label: "Planning" },
              { id: "active", label: "Active" },
              { id: "on_hold", label: "On hold" },
              { id: "completed", label: "Completed" },
              { id: "cancelled", label: "Cancelled" },
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

      <FieldGroup label="Owner" hint="The contact who's driving this project.">
        <ContactPicker
          value={form.owner_id}
          onChange={(v) => set("owner_id", v)}
          contacts={contacts ?? []}
          placeholder="Pick a contact…"
        />
      </FieldGroup>

      <FieldGroup
        label="Committee"
        hint="Optional — the committee sponsoring this project."
      >
        <Select
          value={form.committee_id}
          onChange={(v) => set("committee_id", v)}
          placeholder="No committee"
          options={(committees ?? []).map((c) => ({
            id: c.id,
            label: c.name,
          }))}
        />
      </FieldGroup>

      <FieldGroup
        label="Event"
        hint="Optional — link this project to a specific tournament or board meeting."
      >
        <Select
          value={form.event_id}
          onChange={(v) => set("event_id", v)}
          placeholder="No event"
          options={(events ?? []).map((e) => ({ id: e.id, label: e.name }))}
        />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Start date">
          <TextInput
            type="date"
            value={form.start_date}
            onChange={(v) => set("start_date", v)}
          />
        </FieldGroup>
        <FieldGroup
          label="Target date"
          hint="When you want to be done"
          error={errors.target_completion_date}
        >
          <TextInput
            type="date"
            value={form.target_completion_date}
            onChange={(v) => set("target_completion_date", v)}
            error={errors.target_completion_date}
          />
        </FieldGroup>
      </div>

      {submitError && (
        <div className="mt-3 p-3 rounded-md text-xs text-red-700 bg-red-50 border border-red-100">
          {submitError}
        </div>
      )}
    </SidePanel>
  );
}
