import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea, Select, PillSelect } from "@/components/Inputs";
import { ContactsMultiPicker } from "@/components/ContactPicker";
import { Tag } from "@/components/Tag";
import {
  PrimaryButton,
  SecondaryButton,
  DangerButton,
} from "@/components/Buttons";
import { useContacts } from "@/features/contacts/hooks";
import { useEvents } from "@/features/events/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useCommitteesLookup, useProgramsLookup } from "@/lib/lookups";
import {
  useUpsertInteraction,
  useSoftDeleteInteraction,
  type InteractionDetailFull,
} from "./hooks";
import { formatError } from "@/lib/errors";

import { RichTextEditor } from "@/components/RichTextEditor";
type IType = "email" | "call" | "meeting" | "note" | "other";
type IDirection = "inbound" | "outbound" | "internal" | null;

type FormState = {
  type: IType;
  subject: string;
  content: string;
  occurred_at: string; // datetime-local "YYYY-MM-DDTHH:mm"
  direction: IDirection;
  participant_ids: string[];
  linked_event_ids: string[];
  linked_committee_ids: string[];
  linked_program_ids: string[];
  linked_project_ids: string[];
};

function nowDatetimeLocal() {
  const d = new Date();
  // Build local-tz "YYYY-MM-DDTHH:mm" string
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const blank = (): FormState => ({
  type: "meeting",
  subject: "",
  content: "",
  occurred_at: nowDatetimeLocal(),
  direction: null,
  participant_ids: [],
  linked_event_ids: [],
  linked_committee_ids: [],
  linked_program_ids: [],
  linked_project_ids: [],
});

export function InteractionForm({
  open,
  onClose,
  initialInteraction,
}: {
  open: boolean;
  onClose: () => void;
  initialInteraction?: InteractionDetailFull;
}) {
  const navigate = useNavigate();
  const isEdit = Boolean(initialInteraction);

  const upsert = useUpsertInteraction();
  const softDelete = useSoftDeleteInteraction();
  const { data: contacts } = useContacts();
  const { data: events } = useEvents();
  const { data: projects } = useProjects();
  const { data: committees } = useCommitteesLookup();
  const { data: programs } = useProgramsLookup();

  const [form, setForm] = useState<FormState>(blank);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialInteraction) {
      // Convert ISO timestamp back to datetime-local format
      const iso = initialInteraction.occurred_at;
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

      setForm({
        type: initialInteraction.type,
        subject: initialInteraction.subject,
        content: initialInteraction.content ?? "",
        occurred_at: localStr,
        direction: initialInteraction.direction,
        participant_ids: initialInteraction.participants
          .map((p) => p.contact?.id)
          .filter((id): id is string => Boolean(id)),
        linked_event_ids: initialInteraction.linked_events.map((e) => e.id),
        linked_committee_ids: initialInteraction.linked_committees.map((c) => c.id),
        linked_program_ids: initialInteraction.linked_programs.map((p) => p.id),
        linked_project_ids: initialInteraction.linked_projects.map((p) => p.id),
      });
    } else {
      setForm(blank());
    }
    setTouched(false);
    setErrors({});
    setSubmitError(null);
  }, [open, initialInteraction]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.subject.trim()) e.subject = "Subject is required";
    if (!form.occurred_at) e.occurred_at = "Date/time is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      // Convert datetime-local back to ISO
      const occurred_at_iso = new Date(form.occurred_at).toISOString();

      const saved = await upsert.mutateAsync({
        id: initialInteraction?.id,
        type: form.type,
        subject: form.subject.trim(),
        content: form.content.trim() || null,
        occurred_at: occurred_at_iso,
        direction: form.direction,
        participant_contact_ids: form.participant_ids,
        linked_event_ids: form.linked_event_ids,
        linked_committee_ids: form.linked_committee_ids,
        linked_program_ids: form.linked_program_ids,
        linked_project_ids: form.linked_project_ids,
      });
      onClose();
      if (!isEdit) navigate(`/interactions/${saved.id}`);
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const handleDelete = async () => {
    if (!initialInteraction) return;
    if (!window.confirm("Delete this interaction?")) return;
    setSubmitError(null);
    try {
      await softDelete.mutateAsync(initialInteraction.id);
      onClose();
      navigate("/interactions");
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const submitting = upsert.isPending || softDelete.isPending;
  const cantSubmit = submitting || !form.subject.trim();

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      dirty={touched && !submitting}
      title={isEdit ? "Edit interaction" : "Log interaction"}
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
            {submitting ? "Saving…" : isEdit ? "Save" : "Log it"}
          </PrimaryButton>
        </>
      }
    >
      <FieldGroup label="Type" required>
        <PillSelect<IType>
          value={form.type}
          onChange={(v) => set("type", v)}
          options={[
            { id: "meeting", label: "Meeting" },
            { id: "call", label: "Call" },
            { id: "email", label: "Email" },
            { id: "note", label: "Note" },
            { id: "other", label: "Other" },
          ]}
        />
      </FieldGroup>

      <FieldGroup label="Subject" required error={errors.subject}>
        <TextInput
          value={form.subject}
          onChange={(v) => set("subject", v)}
          placeholder="Quick sync re: tournament logistics"
          error={errors.subject}
          autoFocus
        />
      </FieldGroup>

      <FieldGroup label="Date / time" required error={errors.occurred_at}>
        <TextInput
          type="datetime-local"
          value={form.occurred_at}
          onChange={(v) => set("occurred_at", v)}
          error={errors.occurred_at}
        />
      </FieldGroup>

      <FieldGroup
        label="Direction"
        hint="Optional. Useful for emails and calls."
      >
        <PillSelect<"inbound" | "outbound" | "internal" | "none">
          value={form.direction ?? "none"}
          onChange={(v) =>
            set("direction", v === "none" ? null : (v as IDirection))
          }
          options={[
            { id: "none", label: "—" },
            { id: "inbound", label: "Inbound" },
            { id: "outbound", label: "Outbound" },
            { id: "internal", label: "Internal" },
          ]}
        />
      </FieldGroup>

      <FieldGroup
        label="Participants"
        hint="Contacts who were part of this interaction."
      >
        <ContactsMultiPicker
          value={form.participant_ids}
          onChange={(v) => set("participant_ids", v)}
          contacts={contacts ?? []}
        />
      </FieldGroup>

      <FieldGroup label="Notes">
        <RichTextEditor
          value={form.content}
          onChange={(v) => set("content", v)}
          placeholder="What happened? What were the takeaways?"
          rows={5}
        />
      </FieldGroup>

      <div className="text-[11px] font-semibold tracking-wide uppercase text-zinc-500 mt-5 mb-2">
        Links (optional)
      </div>

      <MultiLinkField
        label="Events"
        value={form.linked_event_ids}
        onChange={(v) => set("linked_event_ids", v)}
        options={(events ?? []).map((e) => ({ id: e.id, label: e.name }))}
      />
      <MultiLinkField
        label="Committees"
        value={form.linked_committee_ids}
        onChange={(v) => set("linked_committee_ids", v)}
        options={(committees ?? []).map((c) => ({ id: c.id, label: c.name }))}
      />
      <MultiLinkField
        label="Programs"
        value={form.linked_program_ids}
        onChange={(v) => set("linked_program_ids", v)}
        options={(programs ?? []).map((p) => ({ id: p.id, label: p.name }))}
      />
      <MultiLinkField
        label="Projects"
        value={form.linked_project_ids}
        onChange={(v) => set("linked_project_ids", v)}
        options={(projects ?? []).map((p) => ({ id: p.id, label: p.name }))}
      />

      {submitError && (
        <div className="mt-3 p-3 rounded-md text-xs text-red-700 bg-red-50 border border-red-100">
          {submitError}
        </div>
      )}
    </SidePanel>
  );
}

/**
 * MultiLinkField — small multi-select where the user picks N items from a
 * list of options. Used for the four "linked X" fields in the form.
 *
 * Implementation: a select that, when something is picked, adds it to the
 * value array. Selected items render as removable chips above.
 */
function MultiLinkField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string[];
  onChange: (ids: string[]) => void;
  options: { id: string; label: string }[];
}) {
  const optionById = useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options],
  );
  const remaining = useMemo(
    () => options.filter((o) => !value.includes(o.id)),
    [options, value],
  );

  const add = (id: string | null) => {
    if (!id) return;
    onChange([...value, id]);
  };
  const remove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <FieldGroup label={label}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((id) => {
            const opt = optionById.get(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-maroon-50 text-maroon-700 border border-maroon-100"
              >
                {opt?.label ?? "(unknown)"}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="hover:bg-maroon-100 rounded transition-colors"
                  aria-label="Remove"
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <Select
        value={null}
        onChange={(v) => add(v)}
        placeholder={`Add ${label.toLowerCase().slice(0, -1)}…`}
        options={remaining.map((o) => ({ id: o.id, label: o.label }))}
      />
    </FieldGroup>
  );
}
