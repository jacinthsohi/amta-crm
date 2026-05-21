import { useEffect, useMemo, useState } from "react";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea, PillSelect } from "@/components/Inputs";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { ContactPicker } from "@/components/ContactPicker";
import { useProgramsLookup } from "@/lib/lookups";
import { useContacts } from "./hooks";
import { useUpsertProgramAffiliation } from "./hooks";
import { formatError } from "@/lib/errors";
import { ProgramCombobox, type ProgramOption } from "@/features/profile/ProgramCombobox";

type AffiliationType = "student_alumni" | "coach" | "advisor";

type FormState = {
  contact_id: string | null;
  program_id: string | null;
  affiliation_type: AffiliationType;
  start_year: string;
  end_year: string;
  notes: string;
};

const thisYear = new Date().getFullYear();

/**
 * ProgramAffiliationForm — opens from either side of the relationship:
 *   - From a contact's detail page → pass `contactId` (locks contact, picks program)
 *   - From a program's detail page → pass `programId` (locks program, picks contact)
 *
 * Exactly one of the two should be passed. The other side becomes the
 * "pickable" field in the form.
 *
 * Program picker: when the program is the pickable side, uses the shared
 * ProgramCombobox (debounced search) instead of a plain <select> over all
 * ~483 programs. The combobox needs the program NAME to display a current
 * selection; we resolve program_id -> name from useProgramsLookup (already
 * loaded for this form).
 */
export function ProgramAffiliationForm({
  open,
  onClose,
  contactId,
  programId,
}: {
  open: boolean;
  onClose: () => void;
  contactId?: string;
  programId?: string;
}) {
  const upsert = useUpsertProgramAffiliation();
  const { data: programs } = useProgramsLookup();
  const { data: contacts } = useContacts();

  const lockedSide: "contact" | "program" = contactId ? "contact" : "program";

  const blank = (): FormState => ({
    contact_id: contactId ?? null,
    program_id: programId ?? null,
    affiliation_type: "student_alumni",
    start_year: String(thisYear),
    end_year: "",
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
  }, [open, contactId, programId]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched(true);
  };

  // Resolve the selected program's name for the combobox's closed-state
  // display. ProgramCombobox shows `selectedLabel` when closed; without it a
  // selection renders blank. The program lookup is already loaded for this
  // form, so we read the name from there. null when nothing is selected (or
  // the lookup hasn't resolved yet — the combobox tolerates a null label).
  const selectedProgramName = useMemo(() => {
    if (!form.program_id) return null;
    const match = (programs ?? []).find((p) => p.id === form.program_id);
    return match?.name ?? null;
  }, [form.program_id, programs]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.contact_id) e.contact_id = "Pick a contact";
    if (!form.program_id) e.program_id = "Pick a program";
    const startYr = Number(form.start_year);
    if (!startYr || startYr < 1900 || startYr > 2100)
      e.start_year = "Enter a valid year";
    if (form.end_year) {
      const endYr = Number(form.end_year);
      if (!endYr || endYr < 1900 || endYr > 2100)
        e.end_year = "Enter a valid year";
      else if (endYr < startYr) e.end_year = "End year must be after start";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      await upsert.mutateAsync({
        contact_id: form.contact_id!,
        program_id: form.program_id!,
        affiliation_type: form.affiliation_type,
        start_year: Number(form.start_year),
        end_year: form.end_year ? Number(form.end_year) : null,
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
      title="Add program affiliation"
      footer={
        <>
          <div className="flex-1" />
          <SecondaryButton onClick={onClose} disabled={upsert.isPending}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Add affiliation"}
          </PrimaryButton>
        </>
      }
    >
      {/* Show the field for the side that's NOT locked */}
      {lockedSide === "contact" ? (
        <FieldGroup label="Program" required error={errors.program_id}>
          <ProgramCombobox
            value={form.program_id}
            selectedLabel={selectedProgramName}
            placeholder="Search for a program…"
            onChange={(p: ProgramOption) => set("program_id", p.id)}
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

      <FieldGroup label="Type" required>
        <PillSelect<AffiliationType>
          value={form.affiliation_type}
          onChange={(v) => set("affiliation_type", v)}
          options={[
            { id: "student_alumni", label: "Student / Alumni" },
            { id: "coach", label: "Coach" },
            { id: "advisor", label: "Advisor" },
          ]}
        />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Start year" required error={errors.start_year}>
          <TextInput
            type="number"
            value={form.start_year}
            onChange={(v) => set("start_year", v)}
            placeholder={String(thisYear)}
            error={errors.start_year}
          />
        </FieldGroup>
        <FieldGroup
          label="End year"
          hint="Leave blank if ongoing"
          error={errors.end_year}
        >
          <TextInput
            type="number"
            value={form.end_year}
            onChange={(v) => set("end_year", v)}
            error={errors.end_year}
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
