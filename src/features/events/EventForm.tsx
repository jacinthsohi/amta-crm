import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidePanel } from "@/components/SidePanel";
import { FieldGroup } from "@/components/FieldGroup";
import { TextInput, TextArea, Select, PillSelect } from "@/components/Inputs";
import { ContactPicker } from "@/components/ContactPicker";
import {
  PrimaryButton,
  SecondaryButton,
  DangerButton,
} from "@/components/Buttons";
import { useContacts } from "@/features/contacts/hooks";
import {
  useUpsertEvent,
  useSoftDeleteEvent,
  EVENT_GRADIENTS,
  type EventWithRelations,
} from "./hooks";
import { formatError } from "@/lib/errors";

import { RichTextEditor } from "@/components/RichTextEditor";
type EventType = "tournament" | "board_meeting";
type TournamentType = "invitational" | "regional" | "orcs" | "nct";
type Status = "upcoming" | "in_progress" | "completed" | "cancelled";

type FormState = {
  name: string;
  event_type: EventType;
  tournament_type: TournamentType | "";
  start_date: string;
  end_date: string;
  location_city: string;
  location_state: string;
  photo_banner_gradient: string;
  status: Status;
  primary_host_contact_id: string | null;
  description: string;
  notes: string;
};

const blank: FormState = {
  name: "",
  event_type: "tournament",
  tournament_type: "invitational",
  start_date: "",
  end_date: "",
  location_city: "",
  location_state: "",
  photo_banner_gradient: EVENT_GRADIENTS[0].value,
  status: "upcoming",
  primary_host_contact_id: null,
  description: "",
  notes: "",
};

export function EventForm({
  open,
  onClose,
  initialEvent,
}: {
  open: boolean;
  onClose: () => void;
  initialEvent?: EventWithRelations;
}) {
  const navigate = useNavigate();
  const isEdit = Boolean(initialEvent);

  const upsert = useUpsertEvent();
  const softDelete = useSoftDeleteEvent();
  const { data: contacts } = useContacts();

  const [form, setForm] = useState<FormState>(blank);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialEvent) {
      setForm({
        name: initialEvent.name,
        event_type: initialEvent.event_type,
        tournament_type: initialEvent.tournament_type ?? "",
        start_date: initialEvent.start_date,
        end_date: initialEvent.end_date ?? "",
        location_city: initialEvent.location_city ?? "",
        location_state: initialEvent.location_state ?? "",
        photo_banner_gradient:
          initialEvent.photo_banner_gradient ?? EVENT_GRADIENTS[0].value,
        status: initialEvent.status,
        primary_host_contact_id: initialEvent.primary_host_contact_id,
        description: initialEvent.description ?? "",
        notes: initialEvent.notes ?? "",
      });
    } else {
      setForm(blank);
    }
    setTouched(false);
    setErrors({});
    setSubmitError(null);
  }, [open, initialEvent]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched(true);
  };

  // When the user toggles between tournament and board_meeting, clear or
  // restore the tournament_type appropriately.
  const setEventType = (type: EventType) => {
    setForm((f) => ({
      ...f,
      event_type: type,
      tournament_type: type === "tournament" ? f.tournament_type || "invitational" : "",
    }));
    setTouched(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.start_date) e.start_date = "Start date is required";
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      e.end_date = "End date must be on or after start date";
    }
    if (form.event_type === "tournament" && !form.tournament_type) {
      e.tournament_type = "Pick a tournament type";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitError(null);
    try {
      const saved = await upsert.mutateAsync({
        id: initialEvent?.id,
        name: form.name.trim(),
        event_type: form.event_type,
        tournament_type:
          form.event_type === "tournament"
            ? (form.tournament_type as TournamentType)
            : null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        location_city: form.location_city.trim() || null,
        location_state: form.location_state.trim() || null,
        photo_banner_gradient: form.photo_banner_gradient,
        status: form.status,
        primary_host_contact_id: form.primary_host_contact_id,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      });
      onClose();
      if (!isEdit) navigate(`/events/${saved.id}`);
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const handleDelete = async () => {
    if (!initialEvent) return;
    if (
      !window.confirm(
        "Delete this event? Hosts, staff, and documents will remain in the database but will reference a deleted event.",
      )
    )
      return;
    setSubmitError(null);
    try {
      await softDelete.mutateAsync(initialEvent.id);
      onClose();
      navigate("/events");
    } catch (e) {
      setSubmitError(formatError(e));
    }
  };

  const submitting = upsert.isPending || softDelete.isPending;
  const cantSubmit = submitting || !form.name.trim() || !form.start_date;

  // Match the gradient back to its preset so the picker highlights correctly
  const selectedGradient = useMemo(
    () =>
      EVENT_GRADIENTS.find((g) => g.value === form.photo_banner_gradient) ??
      null,
    [form.photo_banner_gradient],
  );

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      dirty={touched && !submitting}
      title={isEdit ? "Edit event" : "New event"}
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
            {submitting ? "Saving…" : isEdit ? "Save" : "Create event"}
          </PrimaryButton>
        </>
      }
    >
      <FieldGroup label="Name" required error={errors.name}>
        <TextInput
          value={form.name}
          onChange={(v) => set("name", v)}
          placeholder="Yale Invitational"
          error={errors.name}
          autoFocus
        />
      </FieldGroup>

      <FieldGroup label="Event type" required>
        <PillSelect<EventType>
          value={form.event_type}
          onChange={setEventType}
          options={[
            { id: "tournament", label: "Tournament" },
            { id: "board_meeting", label: "Board meeting" },
          ]}
        />
      </FieldGroup>

      {form.event_type === "tournament" && (
        <FieldGroup
          label="Tournament type"
          required
          error={errors.tournament_type}
        >
          <PillSelect<TournamentType>
            value={(form.tournament_type as TournamentType) || "invitational"}
            onChange={(v) => set("tournament_type", v)}
            options={[
              { id: "invitational", label: "Invitational" },
              { id: "regional", label: "Regional" },
              { id: "orcs", label: "ORCS" },
              { id: "nct", label: "NCT" },
            ]}
          />
        </FieldGroup>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Start date" required error={errors.start_date}>
          <TextInput
            type="date"
            value={form.start_date}
            onChange={(v) => set("start_date", v)}
            error={errors.start_date}
          />
        </FieldGroup>
        <FieldGroup label="End date" hint="Same as start for one-day events" error={errors.end_date}>
          <TextInput
            type="date"
            value={form.end_date}
            onChange={(v) => set("end_date", v)}
            error={errors.end_date}
          />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Location city">
          <TextInput
            value={form.location_city}
            onChange={(v) => set("location_city", v)}
            placeholder="New Haven"
          />
        </FieldGroup>
        <FieldGroup label="State">
          <TextInput
            value={form.location_state}
            onChange={(v) => set("location_state", v)}
            placeholder="CT"
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Status">
        <PillSelect<Status>
          value={form.status}
          onChange={(v) => set("status", v)}
          options={[
            { id: "upcoming", label: "Upcoming" },
            { id: "in_progress", label: "In progress" },
            { id: "completed", label: "Completed" },
            { id: "cancelled", label: "Cancelled" },
          ]}
        />
      </FieldGroup>

      <FieldGroup
        label="Primary host"
        hint="The AMTA point person responsible for this event."
      >
        <ContactPicker
          value={form.primary_host_contact_id}
          onChange={(v) => set("primary_host_contact_id", v)}
          contacts={contacts ?? []}
          placeholder="Pick a contact…"
        />
      </FieldGroup>

      <FieldGroup
        label="Banner gradient"
        hint="Visual flair for the detail page hero. Doesn't affect behavior."
      >
        <div
          className="h-12 rounded-md border border-zinc-200 mb-2"
          style={{ background: form.photo_banner_gradient }}
        />
        <div className="grid grid-cols-7 gap-1.5">
          {EVENT_GRADIENTS.map((g) => {
            const active = selectedGradient?.id === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => set("photo_banner_gradient", g.value)}
                title={g.label}
                className={
                  "h-8 rounded-md transition-all " +
                  (active
                    ? "ring-2 ring-maroon-700 ring-offset-1"
                    : "ring-0 hover:scale-105")
                }
                style={{ background: g.value }}
              />
            );
          })}
        </div>
      </FieldGroup>

      <FieldGroup label="Description">
        <RichTextEditor
          value={form.description}
          onChange={(v) => set("description", v)}
          placeholder="What's this event about?"
          rows={3}
        />
      </FieldGroup>

      <FieldGroup label="Internal notes">
        <RichTextEditor
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
