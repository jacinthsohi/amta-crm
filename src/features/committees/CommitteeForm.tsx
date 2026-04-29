import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea, Select, PillSelect } from "@/components/Inputs";
import {
  PrimaryButton,
  SecondaryButton,
  DangerButton,
} from "@/components/Buttons";
import { useCommitteesLookup } from "@/lib/lookups";
import {
  useUpsertCommittee,
  useSoftDeleteCommittee,
  type CommitteeWithRelations,
} from "./hooks";
import { formatError } from "@/lib/errors";

import { RichTextEditor } from "@/components/RichTextEditor";
type FormState = {
  name: string;
  description: string;
  parent_committee_id: string | null;
  status: "active" | "inactive";
  is_executive: boolean;
};

const blank: FormState = {
  name: "",
  description: "",
  parent_committee_id: null,
  status: "active",
  is_executive: false,
};

export function CommitteeForm({
  open,
  onClose,
  initialCommittee,
}: {
  open: boolean;
  onClose: () => void;
  initialCommittee?: CommitteeWithRelations;
}) {
  const navigate = useNavigate();
  const isEdit = Boolean(initialCommittee);

  const upsert = useUpsertCommittee();
  const softDelete = useSoftDeleteCommittee();
  const { data: committees } = useCommitteesLookup();

  const [form, setForm] = useState<FormState>(blank);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialCommittee) {
      setForm({
        name: initialCommittee.name,
        description: initialCommittee.description ?? "",
        parent_committee_id: initialCommittee.parent_committee_id,
        status: initialCommittee.status,
        is_executive: initialCommittee.is_executive,
      });
    } else {
      setForm(blank);
    }
    setTouched(false);
    setErrors({});
    setSubmitError(null);
  }, [open, initialCommittee]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      const saved = await upsert.mutateAsync({
        id: initialCommittee?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        parent_committee_id: form.parent_committee_id,
        status: form.status,
        is_executive: form.is_executive,
      });
      onClose();
      if (!isEdit) navigate(`/committees/${saved.id}`);
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const handleDelete = async () => {
    if (!initialCommittee) return;
    if (
      !window.confirm(
        "Delete this committee? Member assignments will remain in the database but will reference a deleted committee.",
      )
    )
      return;
    setSubmitError(null);
    try {
      await softDelete.mutateAsync(initialCommittee.id);
      onClose();
      navigate("/committees");
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const submitting = upsert.isPending || softDelete.isPending;
  const cantSubmit = submitting || !form.name.trim();

  // Filter the parent committee picker — exclude the committee itself, and
  // exclude its existing subcommittees (otherwise we'd create a cycle).
  const eligibleParents = (committees ?? []).filter((c) => {
    if (!initialCommittee) return true;
    if (c.id === initialCommittee.id) return false;
    if (c.parent_committee_id === initialCommittee.id) return false;
    return true;
  });

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      dirty={touched && !submitting}
      title={isEdit ? "Edit committee" : "New committee"}
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
            {submitting ? "Saving…" : isEdit ? "Save" : "Create committee"}
          </PrimaryButton>
        </>
      }
    >
      <FieldGroup label="Name" required error={errors.name}>
        <TextInput
          value={form.name}
          onChange={(v) => set("name", v)}
          placeholder="Tournament Administration Committee"
          error={errors.name}
          autoFocus
        />
      </FieldGroup>

      <FieldGroup label="Description">
        <RichTextEditor
          value={form.description}
          onChange={(v) => set("description", v)}
          placeholder="What this committee is responsible for…"
          rows={3}
        />
      </FieldGroup>

      <FieldGroup
        label="Parent committee"
        hint="Leave blank for a top-level committee. Pick a parent to make this a subcommittee."
      >
        <Select
          value={form.parent_committee_id}
          onChange={(v) => set("parent_committee_id", v)}
          placeholder="No parent (top-level)"
          options={eligibleParents.map((c) => ({ id: c.id, label: c.name }))}
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

      <FieldGroup
        label="Executive committee?"
        hint="Set true for the Executive Committee specifically — it gets special treatment in some views."
      >
        <PillSelect<"true" | "false">
          value={form.is_executive ? "true" : "false"}
          onChange={(v) => set("is_executive", v === "true")}
          options={[
            { id: "false", label: "No" },
            { id: "true", label: "Yes" },
          ]}
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
