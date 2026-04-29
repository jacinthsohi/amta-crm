import { useEffect, useState } from "react";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, Select } from "@/components/Inputs";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import {
  useUpsertEventDocument,
  DOCUMENT_TYPE_LABELS,
} from "./hooks";
import { formatError } from "@/lib/errors";

type DocType =
  | "agenda"
  | "meeting_minutes"
  | "welcome_packet"
  | "tournament_packet"
  | "tabulation_summary"
  | "other";

type FormState = {
  document_type: DocType;
  title: string;
  url: string;
};

const blank: FormState = {
  document_type: "other",
  title: "",
  url: "",
};

/**
 * EventDocumentForm — adds a link to an external document (Drive, Dropbox,
 * etc) related to this event.
 *
 * v1 doesn't upload files to Supabase Storage — that's a follow-up. For now
 * everything is a URL the user pastes in.
 */
export function EventDocumentForm({
  open,
  onClose,
  eventId,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
}) {
  const upsert = useUpsertEventDocument();

  const [form, setForm] = useState<FormState>(blank);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(blank);
    setTouched(false);
    setErrors({});
    setSubmitError(null);
  }, [open]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.url.trim()) e.url = "URL is required";
    else if (!/^https?:\/\//i.test(form.url.trim()))
      e.url = "URL must start with http:// or https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      await upsert.mutateAsync({
        event_id: eventId,
        document_type: form.document_type,
        title: form.title.trim(),
        url: form.url.trim(),
      });
      onClose();
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      dirty={touched && !upsert.isPending}
      title="Add document"
      footer={
        <>
          <div className="flex-1" />
          <SecondaryButton onClick={onClose} disabled={upsert.isPending}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Add document"}
          </PrimaryButton>
        </>
      }
    >
      <FieldGroup label="Type" required>
        <Select
          value={form.document_type}
          onChange={(v) => set("document_type", v as DocType)}
          options={(
            Object.keys(DOCUMENT_TYPE_LABELS) as DocType[]
          ).map((t) => ({ id: t, label: DOCUMENT_TYPE_LABELS[t] }))}
        />
      </FieldGroup>

      <FieldGroup label="Title" required error={errors.title}>
        <TextInput
          value={form.title}
          onChange={(v) => set("title", v)}
          placeholder="2026 Midlands State Invitational Welcome Packet"
          error={errors.title}
        />
      </FieldGroup>

      <FieldGroup
        label="URL"
        required
        error={errors.url}
        hint="Paste the link from Google Drive, Dropbox, or wherever the document lives."
      >
        <TextInput
          value={form.url}
          onChange={(v) => set("url", v)}
          placeholder="https://docs.google.com/…"
          error={errors.url}
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
