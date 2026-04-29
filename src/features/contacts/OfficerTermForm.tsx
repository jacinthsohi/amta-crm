import { useEffect, useState } from "react";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea, PillSelect } from "@/components/Inputs";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { useUpsertOfficerTerm } from "./hooks";
import { formatError } from "@/lib/errors";

type OfficerType =
  | "president"
  | "president_elect"
  | "past_president"
  | "secretary"
  | "treasurer";

type FormState = {
  officer_type: OfficerType;
  start_date: string;
  end_date: string;
  notes: string;
};

const blank: FormState = {
  officer_type: "secretary",
  start_date: "",
  end_date: "",
  notes: "",
};

export function OfficerTermForm({
  open,
  onClose,
  contactId,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
}) {
  const upsert = useUpsertOfficerTerm();
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
    if (!form.start_date) e.start_date = "Start date is required";
    if (form.end_date && form.start_date && form.end_date < form.start_date)
      e.end_date = "End date must be after start";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      await upsert.mutateAsync({
        contact_id: contactId,
        officer_type: form.officer_type,
        start_date: form.start_date,
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
      title="Add officer term"
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
      <FieldGroup
        label="Role"
        required
        hint="Of the officer roles, only President is elected. Others are appointed."
      >
        <PillSelect<OfficerType>
          value={form.officer_type}
          onChange={(v) => set("officer_type", v)}
          options={[
            { id: "president", label: "President" },
            { id: "president_elect", label: "President-Elect" },
            { id: "past_president", label: "Past President" },
            { id: "secretary", label: "Secretary" },
            { id: "treasurer", label: "Treasurer" },
          ]}
        />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Start date" required error={errors.start_date}>
          <TextInput
            type="date"
            value={form.start_date}
            onChange={(v) => set("start_date", v)}
            error={errors.start_date}
          />
        </FieldGroup>
        <FieldGroup label="End date" hint="Leave blank if current" error={errors.end_date}>
          <TextInput
            type="date"
            value={form.end_date}
            onChange={(v) => set("end_date", v)}
            error={errors.end_date}
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
