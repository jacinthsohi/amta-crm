import { useEffect, useState } from "react";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, Select } from "@/components/Inputs";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { useProgramsLookup } from "@/lib/lookups";
import { useUpsertEventHost } from "./hooks";
import { formatError } from "@/lib/errors";

type FormState = {
  program_id: string | null;
  host_role: string;
};

const blank: FormState = {
  program_id: null,
  host_role: "Host",
};

/**
 * EventHostForm — adds a program as a host of a tournament.
 *
 * Always opens with `eventId` locked. The user picks the program and the
 * host_role (free text — typical values: "Host", "Co-Host", "Site Sponsor").
 */
export function EventHostForm({
  open,
  onClose,
  eventId,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
}) {
  const upsert = useUpsertEventHost();
  const { data: programs } = useProgramsLookup();

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
    if (!form.program_id) e.program_id = "Pick a program";
    if (!form.host_role.trim()) e.host_role = "Role is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      await upsert.mutateAsync({
        event_id: eventId,
        program_id: form.program_id!,
        host_role: form.host_role.trim(),
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
      title="Add host program"
      footer={
        <>
          <div className="flex-1" />
          <SecondaryButton onClick={onClose} disabled={upsert.isPending}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Add host"}
          </PrimaryButton>
        </>
      }
    >
      <FieldGroup label="Program" required error={errors.program_id}>
        <Select
          value={form.program_id}
          onChange={(v) => set("program_id", v)}
          placeholder="Pick a program…"
          options={(programs ?? []).map((p) => ({ id: p.id, label: p.name }))}
          error={errors.program_id}
        />
      </FieldGroup>

      <FieldGroup
        label="Role"
        required
        error={errors.host_role}
        hint='Common values: "Host", "Co-Host", "Site Sponsor". Free text.'
      >
        <TextInput
          value={form.host_role}
          onChange={(v) => set("host_role", v)}
          placeholder="Host"
          error={errors.host_role}
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
