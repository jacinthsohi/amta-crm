import { useEffect, useState } from "react";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea, PillSelect } from "@/components/Inputs";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { useUpsertBoardTerm } from "./hooks";
import { formatError } from "@/lib/errors";

type TermType =
  | "first_year_candidate"
  | "second_year_candidate"
  | "voting_director";

type FormState = {
  term_type: TermType;
  election_year: string; // string for the input; converted on save
  start_date: string;
  end_date: string;
  notes: string;
};

const blank: FormState = {
  term_type: "first_year_candidate",
  election_year: String(new Date().getFullYear()),
  start_date: "",
  end_date: "",
  notes: "",
};

export function BoardTermForm({
  open,
  onClose,
  contactId,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
}) {
  const upsert = useUpsertBoardTerm();
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
    const yr = Number(form.election_year);
    if (!yr || yr < 1900 || yr > 2100) e.election_year = "Enter a valid year";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      await upsert.mutateAsync({
        contact_id: contactId,
        term_type: form.term_type,
        election_year: Number(form.election_year),
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
      title="Add board term"
      footer={
        <>
          <div className="flex-1" />
          <SecondaryButton onClick={onClose} disabled={upsert.isPending}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Add term"}
          </PrimaryButton>
        </>
      }
    >
      <FieldGroup label="Type" required>
        <PillSelect<TermType>
          value={form.term_type}
          onChange={(v) => set("term_type", v)}
          options={[
            { id: "first_year_candidate", label: "First-Year Candidate" },
            { id: "second_year_candidate", label: "Second-Year Candidate" },
            { id: "voting_director", label: "Voting Director" },
          ]}
        />
      </FieldGroup>

      <FieldGroup label="Election year" required error={errors.election_year}>
        <TextInput
          type="number"
          value={form.election_year}
          onChange={(v) => set("election_year", v)}
          placeholder="2025"
          error={errors.election_year}
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
