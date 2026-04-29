import { useEffect, useState } from "react";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea } from "@/components/Inputs";
import { ContactPicker } from "@/components/ContactPicker";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { useContacts } from "@/features/contacts/hooks";
import { useUpsertEventStaff } from "./hooks";
import { formatError } from "@/lib/errors";

type FormState = {
  contact_id: string | null;
  position: string;
  notes: string;
};

const blank: FormState = {
  contact_id: null,
  position: "",
  notes: "",
};

/**
 * EventStaffForm — assigns a contact to staff an event in a particular role.
 *
 * Always opens with `eventId` locked. The user picks the contact and types
 * the position (e.g. "Tournament Director", "Tab Director", "Judge Liaison").
 */
export function EventStaffForm({
  open,
  onClose,
  eventId,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
}) {
  const upsert = useUpsertEventStaff();
  const { data: contacts } = useContacts();

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
    if (!form.contact_id) e.contact_id = "Pick a contact";
    if (!form.position.trim()) e.position = "Position is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      await upsert.mutateAsync({
        event_id: eventId,
        contact_id: form.contact_id!,
        position: form.position.trim(),
        notes: form.notes.trim() || null,
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
      title="Add event staff"
      footer={
        <>
          <div className="flex-1" />
          <SecondaryButton onClick={onClose} disabled={upsert.isPending}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Add staff"}
          </PrimaryButton>
        </>
      }
    >
      <FieldGroup label="Contact" required error={errors.contact_id}>
        <ContactPicker
          value={form.contact_id}
          onChange={(v) => set("contact_id", v)}
          contacts={contacts ?? []}
          placeholder="Pick a contact…"
          error={errors.contact_id}
        />
      </FieldGroup>

      <FieldGroup
        label="Position"
        required
        error={errors.position}
        hint='Common values: "Tournament Director", "Tab Director", "Judge Liaison", "Volunteer".'
      >
        <TextInput
          value={form.position}
          onChange={(v) => set("position", v)}
          placeholder="Tournament Director"
          error={errors.position}
        />
      </FieldGroup>

      <FieldGroup label="Notes">
        <TextArea
          value={form.notes}
          onChange={(v) => set("notes", v)}
          rows={2}
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
