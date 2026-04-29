import { useEffect, useState } from "react";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea, Select } from "@/components/Inputs";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { ContactPicker } from "@/components/ContactPicker";
import { useCommitteesLookup } from "@/lib/lookups";
import { useContacts } from "./hooks";
import { useUpsertCommitteeAssignment } from "./hooks";
import { formatError } from "@/lib/errors";

type FormState = {
  contact_id: string | null;
  committee_id: string | null;
  position: string;
  start_date: string;
  end_date: string;
  notes: string;
};

/**
 * CommitteeAssignmentForm — opens from either side of the relationship:
 *   - From a contact's detail page → pass `contactId` (locks contact, picks committee)
 *   - From a committee's detail page → pass `committeeId` (locks committee, picks contact)
 */
export function CommitteeAssignmentForm({
  open,
  onClose,
  contactId,
  committeeId,
}: {
  open: boolean;
  onClose: () => void;
  contactId?: string;
  committeeId?: string;
}) {
  const upsert = useUpsertCommitteeAssignment();
  const { data: committees } = useCommitteesLookup();
  const { data: contacts } = useContacts();

  const lockedSide: "contact" | "committee" = contactId ? "contact" : "committee";

  const blank = (): FormState => ({
    contact_id: contactId ?? null,
    committee_id: committeeId ?? null,
    position: "Member",
    start_date: "",
    end_date: "",
    notes: "",
  });

  const [form, setForm] = useState<FormState>(blank);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(blank());
    setTouched(false);
    setErrors({});
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contactId, committeeId]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.contact_id) e.contact_id = "Pick a contact";
    if (!form.committee_id) e.committee_id = "Pick a committee";
    if (!form.position.trim()) e.position = "Position is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      await upsert.mutateAsync({
        contact_id: form.contact_id!,
        committee_id: form.committee_id!,
        position: form.position.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
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
      title="Add committee assignment"
      footer={
        <>
          <div className="flex-1" />
          <SecondaryButton onClick={onClose} disabled={upsert.isPending}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Add assignment"}
          </PrimaryButton>
        </>
      }
    >
      {lockedSide === "contact" ? (
        <FieldGroup label="Committee" required error={errors.committee_id}>
          <Select
            value={form.committee_id}
            onChange={(v) => set("committee_id", v)}
            placeholder="Pick a committee…"
            options={(committees ?? []).map((c) => ({
              id: c.id,
              label: c.name,
            }))}
            error={errors.committee_id}
          />
        </FieldGroup>
      ) : (
        <FieldGroup label="Contact" required error={errors.contact_id}>
          <ContactPicker
            value={form.contact_id}
            onChange={(v) => set("contact_id", v)}
            contacts={contacts ?? []}
            placeholder="Pick a contact…"
            error={errors.contact_id}
          />
        </FieldGroup>
      )}

      <FieldGroup
        label="Position"
        required
        error={errors.position}
        hint="Common values: Member, Chair, Co-Chair, Lead. Free-form text."
      >
        <TextInput
          value={form.position}
          onChange={(v) => set("position", v)}
          placeholder="Member"
          error={errors.position}
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
        <FieldGroup label="End date" hint="Leave blank if ongoing">
          <TextInput
            type="date"
            value={form.end_date}
            onChange={(v) => set("end_date", v)}
          />
        </FieldGroup>
      </div>

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
