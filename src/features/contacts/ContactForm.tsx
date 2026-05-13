import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea, PillSelect } from "@/components/Inputs";
import { TagsField } from "@/components/TagsField";
import {
  PrimaryButton,
  SecondaryButton,
  DangerButton,
} from "@/components/Buttons";
import {
  useContactCategories,
  useCreateContactCategory,
  useUpsertContact,
  useSoftDeleteContact,
  type ContactDetail,
} from "./hooks";
import { formatError } from "@/lib/errors";

import { RichTextEditor } from "@/components/RichTextEditor";
type FormState = {
  first_name: string;
  last_name: string;
  pronouns: string;
  email: string;
  secondary_email: string;
  phone: string;
  notes: string;
  standing: "active" | "inactive" | null;
  category_names: string[];
};

const blank: FormState = {
  first_name: "",
  last_name: "",
  pronouns: "",
  email: "",
  secondary_email: "",
  phone: "",
  notes: "",
  standing: null,
  category_names: [],
};

/**
 * ContactForm — handles both Create and Edit modes.
 *
 * Mode is determined by `initialContact`:
 *   undefined → create
 *   present   → edit
 *
 * After a successful create we navigate to the new contact's detail page,
 * so the user can immediately start adding board terms, etc.
 *
 * Soft-delete is offered in edit mode via the footer's red "Delete" button.
 */
export function ContactForm({
  open,
  onClose,
  initialContact,
}: {
  open: boolean;
  onClose: () => void;
  initialContact?: ContactDetail;
}) {
  const navigate = useNavigate();
  const isEdit = Boolean(initialContact);

  const { data: categories } = useContactCategories();
  const createCategory = useCreateContactCategory();
  const upsertContact = useUpsertContact();
  const softDelete = useSoftDeleteContact();

  const [form, setForm] = useState<FormState>(blank);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // When the panel opens (or the initial contact changes), reset form state
  useEffect(() => {
    if (!open) return;
    if (initialContact) {
      setForm({
        first_name: initialContact.first_name,
        last_name: initialContact.last_name,
        pronouns: initialContact.pronouns ?? "",
        email: initialContact.email ?? "",
        secondary_email: initialContact.secondary_email ?? "",
        phone: initialContact.phone ?? "",
        notes: initialContact.notes ?? "",
        standing: initialContact.standing,
        category_names: [...initialContact.category_names],
      });
    } else {
      setForm(blank);
    }
    setTouched(false);
    setErrors({});
    setSubmitError(null);
  }, [open, initialContact]);

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
    if (!form.first_name.trim()) e.first_name = "First name is required";
    if (!form.last_name.trim()) e.last_name = "Last name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Doesn't look like a valid email";
    if (
      form.secondary_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.secondary_email)
    )
      e.secondary_email = "Doesn't look like a valid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      const saved = await upsertContact.mutateAsync({
        id: initialContact?.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        pronouns: form.pronouns.trim() || null,
        email: form.email.trim() || null,
        secondary_email: form.secondary_email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        standing: form.standing,
        category_names: form.category_names,
      });
      onClose();
      // For new contacts, jump to their detail page so the user can keep editing
      if (!isEdit) navigate(`/contacts/${saved.id}`);
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const handleDelete = async () => {
    if (!initialContact) return;
    if (
      !window.confirm(
        "Delete this contact? Their board terms and other history will remain in the database but won't appear in the app. You can restore them later from the admin trash (coming soon).",
      )
    )
      return;
    setSubmitError(null);
    try {
      await softDelete.mutateAsync(initialContact.id);
      onClose();
      navigate("/contacts");
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const handleCreateCategory = async (name: string) => {
    try {
      await createCategory.mutateAsync(name);
    } catch (e) {
      // If creation fails (e.g. duplicate), surface it but don't block — the
      // tag will still appear in the field; it just won't be persisted.
      setSubmitError(formatError(e));
    }
  };

  const submitting = upsertContact.isPending || softDelete.isPending;
  const cantSubmit =
    submitting || !form.first_name.trim() || !form.last_name.trim();

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      dirty={touched && !submitting}
      title={isEdit ? "Edit contact" : "New contact"}
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
            {submitting ? "Saving…" : isEdit ? "Save" : "Create contact"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 mb-1">
        <FieldGroup label="First name" required error={errors.first_name}>
          <TextInput
            value={form.first_name}
            onChange={(v) => set("first_name", v)}
            placeholder="Jane"
            error={errors.first_name}
            autoFocus
          />
        </FieldGroup>
        <FieldGroup label="Last name" required error={errors.last_name}>
          <TextInput
            value={form.last_name}
            onChange={(v) => set("last_name", v)}
            placeholder="Smith"
            error={errors.last_name}
          />
        </FieldGroup>
      </div>

      <FieldGroup
        label="Pronouns"
        hint="Optional. Whatever the person uses — e.g. she/her, they/them, he/him."
      >
        <TextInput
          value={form.pronouns}
          onChange={(v) => set("pronouns", v)}
          placeholder="she/her"
        />
      </FieldGroup>

      <FieldGroup label="Primary email" error={errors.email}>
        <TextInput
          value={form.email}
          onChange={(v) => set("email", v)}
          placeholder="jane@example.org"
          error={errors.email}
          type="email"
        />
      </FieldGroup>

      <FieldGroup
        label="Secondary email"
        hint="Optional. A second email address (e.g. personal + work, or school + personal)."
        error={errors.secondary_email}
      >
        <TextInput
          value={form.secondary_email}
          onChange={(v) => set("secondary_email", v)}
          placeholder="jane.personal@example.org"
          error={errors.secondary_email}
          type="email"
        />
      </FieldGroup>

      <FieldGroup label="Phone">
        <TextInput
          value={form.phone}
          onChange={(v) => set("phone", v)}
          placeholder="(555) 123-4567"
        />
      </FieldGroup>

      <FieldGroup
        label="Categories"
        hint="Tag this contact with one or more roles. Type to search or press Enter to create a new category."
      >
        <TagsField
          value={form.category_names}
          onChange={(v) => set("category_names", v)}
          options={(categories ?? []).map((c) => c.name)}
          allowCreate
          onCreate={handleCreateCategory}
        />
      </FieldGroup>

      <FieldGroup label="Notes">
        <RichTextEditor
          value={form.notes}
          onChange={(v) => set("notes", v)}
          placeholder="Private notes about this contact"
          rows={4}
        />
      </FieldGroup>

      {(initialContact?.has_board_history || isEdit) && (
        <FieldGroup
          label="Board standing"
          hint="Whether this person currently holds an active position. Most useful for current/past board members."
        >
          <PillSelect<"active" | "inactive" | null>
            value={form.standing}
            onChange={(v) => set("standing", v)}
            options={[
              { id: "active", label: "Active" },
              { id: "inactive", label: "Inactive" },
            ]}
          />
        </FieldGroup>
      )}

      {submitError && (
        <div className="mt-3 p-3 rounded-md text-xs text-red-700 bg-red-50 border border-red-100">
          {submitError}
        </div>
      )}

      {!isEdit && (
        <div className="text-xs text-zinc-500 mt-3 p-3 rounded-md bg-zinc-50 border border-zinc-100">
          Board terms, committee assignments, and program affiliations can be
          added from the contact's detail page after saving.
        </div>
      )}
    </SidePanel>
  );
}
