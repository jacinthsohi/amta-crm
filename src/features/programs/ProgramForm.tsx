import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea, PillSelect } from "@/components/Inputs";
import {
  PrimaryButton,
  SecondaryButton,
  DangerButton,
} from "@/components/Buttons";
import {
  useUpsertProgram,
  useSoftDeleteProgram,
  type ProgramWithAffiliations,
} from "./hooks";
import { formatError } from "@/lib/errors";

import { RichTextEditor } from "@/components/RichTextEditor";
type FormState = {
  name: string;
  short_name: string;
  city: string;
  state: string;
  website: string;
  status: "active" | "inactive";
  joined_year: string;
  notes: string;
};

const blank: FormState = {
  name: "",
  short_name: "",
  city: "",
  state: "",
  website: "",
  status: "active",
  joined_year: "",
  notes: "",
};

export function ProgramForm({
  open,
  onClose,
  initialProgram,
}: {
  open: boolean;
  onClose: () => void;
  initialProgram?: ProgramWithAffiliations;
}) {
  const navigate = useNavigate();
  const isEdit = Boolean(initialProgram);

  const upsert = useUpsertProgram();
  const softDelete = useSoftDeleteProgram();

  const [form, setForm] = useState<FormState>(blank);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialProgram) {
      setForm({
        name: initialProgram.name,
        short_name: initialProgram.short_name,
        city: initialProgram.city ?? "",
        state: initialProgram.state ?? "",
        website: initialProgram.website ?? "",
        status: initialProgram.status,
        joined_year: initialProgram.joined_year
          ? String(initialProgram.joined_year)
          : "",
        notes: initialProgram.notes ?? "",
      });
    } else {
      setForm(blank);
    }
    setTouched(false);
    setErrors({});
    setSubmitError(null);
  }, [open, initialProgram]);

  // Cmd+Enter to save
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.short_name.trim()) e.short_name = "Short name is required";
    if (form.joined_year) {
      const yr = Number(form.joined_year);
      if (!yr || yr < 1900 || yr > 2100)
        e.joined_year = "Enter a valid year";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      const saved = await upsert.mutateAsync({
        id: initialProgram?.id,
        name: form.name.trim(),
        short_name: form.short_name.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        website: form.website.trim() || null,
        status: form.status,
        joined_year: form.joined_year ? Number(form.joined_year) : null,
        notes: form.notes.trim() || null,
      });
      onClose();
      if (!isEdit) navigate(`/programs/${saved.id}`);
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const handleDelete = async () => {
    if (!initialProgram) return;
    if (
      !window.confirm(
        "Delete this program? Affiliations and event hosting records will remain in the database but will reference a deleted program.",
      )
    )
      return;
    setSubmitError(null);
    try {
      await softDelete.mutateAsync(initialProgram.id);
      onClose();
      navigate("/programs");
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const submitting = upsert.isPending || softDelete.isPending;
  const cantSubmit =
    submitting || !form.name.trim() || !form.short_name.trim();

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      dirty={touched && !submitting}
      title={isEdit ? "Edit program" : "New program"}
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
            {submitting ? "Saving…" : isEdit ? "Save" : "Create program"}
          </PrimaryButton>
        </>
      }
    >
      <FieldGroup label="Name" required error={errors.name}>
        <TextInput
          value={form.name}
          onChange={(v) => set("name", v)}
          placeholder="Yale University"
          error={errors.name}
          autoFocus
        />
      </FieldGroup>

      <FieldGroup
        label="Short name"
        required
        error={errors.short_name}
        hint="Displayed in compact contexts. Usually the school's nickname."
      >
        <TextInput
          value={form.short_name}
          onChange={(v) => set("short_name", v)}
          placeholder="Yale"
          error={errors.short_name}
        />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="City">
          <TextInput
            value={form.city}
            onChange={(v) => set("city", v)}
            placeholder="New Haven"
          />
        </FieldGroup>
        <FieldGroup label="State">
          <TextInput
            value={form.state}
            onChange={(v) => set("state", v)}
            placeholder="CT"
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Website">
        <TextInput
          value={form.website}
          onChange={(v) => set("website", v)}
          placeholder="yale.edu"
        />
      </FieldGroup>

      <FieldGroup label="Joined year" error={errors.joined_year}>
        <TextInput
          type="number"
          value={form.joined_year}
          onChange={(v) => set("joined_year", v)}
          placeholder="1990"
          error={errors.joined_year}
        />
      </FieldGroup>

      <FieldGroup label="Status">
        <PillSelect<"active" | "inactive">
          value={form.status}
          onChange={(v) => set("status", v)}
          options={[
            { id: "active", label: "Active" },
            { id: "inactive", label: "Inactive" },
          ]}
        />
      </FieldGroup>

      <FieldGroup label="Notes">
        <RichTextEditor
          value={form.notes}
          onChange={(v) => set("notes", v)}
          placeholder="Internal notes about this program"
          rows={3}
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
