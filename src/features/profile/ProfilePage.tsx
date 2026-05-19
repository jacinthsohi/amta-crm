import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  useProfile,
  useUpdateProfile,
  useAddAffiliation,
  useUpdateAffiliation,
  useDeleteAffiliation,
  type ProfileData,
  type ProfileAffiliation,
} from "./hooks";
import { ProgramCombobox, type ProgramOption } from "./ProgramCombobox";
import { formatLocation } from "@/lib/format-location";
import { STATE_OPTIONS_FOR_DROPDOWN } from "@/lib/us-states";

type Mode = "view" | "edit";

const AFFILIATION_TYPE_LABELS: Record<
  ProfileAffiliation["affiliation_type"],
  string
> = {
  student_alumni: "Student / Alumni",
  coach: "Coach",
  advisor: "Advisor",
};

export default function ProfilePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { state, setProfile, refetch } = useProfile(token);
  const [mode, setMode] = useState<Mode>("view");
  const [affiliationsOpen, setAffiliationsOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 4000);
    return () => clearTimeout(t);
  }, [justSaved]);

  return (
    <div className="min-h-screen bg-stone-50">
      <BrandHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {justSaved && <SavedBanner />}
        {state.status === "loading" && <LoadingState />}
        {state.status === "no_token" && <NoTokenState />}
        {state.status === "invalid" && <InvalidTokenState />}
        {state.status === "error" && <ErrorState message={state.message} />}
        {state.status === "ready" && mode === "view" && (
          <ProfileView
            profile={state.data}
            onEdit={() => {
              setJustSaved(false);
              setMode("edit");
            }}
            onManageAffiliations={() => {
              setJustSaved(false);
              setAffiliationsOpen(true);
            }}
          />
        )}
        {state.status === "ready" && mode === "edit" && token && (
          <ProfileEdit
            profile={state.data}
            token={token}
            onCancel={() => setMode("view")}
            onSaved={(updated) => {
              setProfile(updated);
              setMode("view");
              setJustSaved(true);
            }}
          />
        )}
        {state.status === "ready" && affiliationsOpen && token && (
          <AffiliationsModal
            profile={state.data}
            token={token}
            onClose={() => setAffiliationsOpen(false)}
            onAnyChange={async () => {
              await refetch();
              setJustSaved(true);
            }}
          />
        )}
      </main>
    </div>
  );
}

function BrandHeader() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#70172a] font-serif text-sm font-bold text-white">
            A
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-900">
              American Mock Trial Association
            </div>
            <div className="text-xs text-stone-500">Your AMTA profile</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function SavedBanner() {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <CheckCircle2 className="h-4 w-4" />
      <span>Profile saved.</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
      <div className="text-sm text-stone-500">Loading your profile…</div>
    </div>
  );
}

function NoTokenState() {
  return (
    <MessageCard
      title="This link isn't quite right"
      body={
        <>
          The URL is missing the access token AMTA sends you. Make sure you
          used the full link from your email — if you copied just part of it,
          try clicking the link directly instead.
        </>
      }
    />
  );
}

function InvalidTokenState() {
  return (
    <MessageCard
      title="This link has expired"
      body={
        <>
          Profile links are good for 30 days from when they were sent (and
          they refresh each time you save changes). This one is no longer
          active. Reply to the email AMTA sent you to request a fresh link.
        </>
      }
    />
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <MessageCard
      title="Something went wrong"
      body={
        <>
          We couldn't load your profile. Please try again in a moment. If
          this keeps happening, let AMTA know.
          <div className="mt-3 text-xs text-stone-400">Details: {message}</div>
        </>
      }
    />
  );
}

function MessageCard({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-8">
      <h1 className="text-lg font-semibold text-stone-900">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">{body}</p>
    </div>
  );
}

// =============================================================================
// View mode
// =============================================================================

function ProfileView({
  profile,
  onEdit,
  onManageAffiliations,
}: {
  profile: ProfileData;
  onEdit: () => void;
  onManageAffiliations: () => void;
}) {
  const fullName = useMemo(() => {
    const parts = [profile.first_name, profile.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Your profile";
  }, [profile.first_name, profile.last_name]);

  const initials = useMemo(() => {
    const f = profile.first_name?.[0] ?? "";
    const l = profile.last_name?.[0] ?? "";
    return (f + l).toUpperCase() || "?";
  }, [profile.first_name, profile.last_name]);

  const locationText = formatLocation(
    profile.current_city,
    profile.current_state,
  );

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <div className="flex items-start gap-4">
          {profile.profile_photo_url ? (
            <img
              src={profile.profile_photo_url}
              alt={fullName}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#70172a] text-xl font-semibold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-stone-900">
              {fullName}
            </h1>
            {profile.pronouns && (
              <div className="mt-0.5 text-sm text-stone-500">
                {profile.pronouns}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact info */}
      <Section title="Contact">
        <Row icon={<Mail className="h-4 w-4" />}>
          {profile.email ? (
            <span>{profile.email}</span>
          ) : (
            <Empty>No primary email on file</Empty>
          )}
        </Row>
        {profile.secondary_email && (
          <Row icon={<Mail className="h-4 w-4" />}>
            <span>{profile.secondary_email}</span>
            <span className="ml-2 text-xs text-stone-400">secondary</span>
          </Row>
        )}
        <Row icon={<Phone className="h-4 w-4" />}>
          {profile.phone ? (
            <span>{profile.phone}</span>
          ) : (
            <Empty>No phone on file</Empty>
          )}
        </Row>
      </Section>

      {/* Location */}
      <Section title="Location">
        <Row icon={<MapPin className="h-4 w-4" />}>
          {locationText ? (
            <span>{locationText}</span>
          ) : (
            <Empty>No location on file</Empty>
          )}
        </Row>
      </Section>

      {/* AMTA affiliations */}
      <AffiliationsSection
        affiliations={profile.affiliations}
        onManage={onManageAffiliations}
      />

      {/* Edit basics */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onEdit}
          className="w-full rounded-md bg-[#70172a] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5a1222] sm:w-auto"
        >
          Edit profile
        </button>
      </div>
    </div>
  );
}

function AffiliationsSection({
  affiliations,
  onManage,
}: {
  affiliations: ProfileAffiliation[];
  onManage: () => void;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-6 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          AMTA affiliations
        </h2>
        <button
          type="button"
          onClick={onManage}
          className="text-xs font-medium text-[#70172a] hover:underline"
        >
          {affiliations.length > 0 ? "Manage" : "Add"}
        </button>
      </div>
      <div className="divide-y divide-stone-100">
        {affiliations.length === 0 ? (
          <div className="px-6 py-4 text-sm">
            <Empty>
              No affiliations on file yet. Add the programs you've been part of
              as a student, coach, or advisor.
            </Empty>
          </div>
        ) : (
          affiliations.map((a) => (
            <Row key={a.id} icon={<GraduationCap className="h-4 w-4" />}>
              <div className="min-w-0">
                <div className="truncate font-medium text-stone-900">
                  {a.program_name ?? "(unknown program)"}
                </div>
                <div className="text-xs text-stone-500">
                  {AFFILIATION_TYPE_LABELS[a.affiliation_type]} ·{" "}
                  {formatYearRange(a.start_year, a.end_year)}
                  {(a.program_city || a.program_state) && (
                    <>
                      {" · "}
                      {[a.program_city, a.program_state]
                        .filter(Boolean)
                        .join(", ")}
                    </>
                  )}
                </div>
              </div>
            </Row>
          ))
        )}
      </div>
    </section>
  );
}

function formatYearRange(start: number, end: number | null) {
  if (!end) return `${start} – present`;
  if (start === end) return `${start}`;
  return `${start} – ${end}`;
}

// =============================================================================
// Edit mode (basic fields)
// =============================================================================

type EditFormState = {
  first_name: string;
  last_name: string;
  pronouns: string;
  secondary_email: string;
  phone: string;
  current_city: string;
  current_state: string;
};

function profileToFormState(p: ProfileData): EditFormState {
  return {
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    pronouns: p.pronouns ?? "",
    secondary_email: p.secondary_email ?? "",
    phone: p.phone ?? "",
    current_city: p.current_city ?? "",
    current_state: p.current_state ?? "",
  };
}

function ProfileEdit({
  profile,
  token,
  onCancel,
  onSaved,
}: {
  profile: ProfileData;
  token: string;
  onCancel: () => void;
  onSaved: (updated: ProfileData) => void;
}) {
  const initial = useMemo(() => profileToFormState(profile), [profile]);
  const [form, setForm] = useState<EditFormState>(initial);
  const { mutate, isPending, error } = useUpdateProfile();

  const isDirty = useMemo(() => {
    return (Object.keys(initial) as Array<keyof EditFormState>).some(
      (k) => form[k] !== initial[k],
    );
  }, [form, initial]);

  function update<K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const payload = {
      p_token: token,
      p_first_name: form.first_name.trim() || null,
      p_last_name: form.last_name.trim() || null,
      p_pronouns: form.pronouns.trim() || null,
      p_secondary_email: form.secondary_email.trim() || null,
      p_phone: form.phone.trim() || null,
      p_current_city: form.current_city.trim() || null,
      p_current_state: form.current_state.trim() || null,
    };
    mutate(payload, {
      onSuccess: (updated) => onSaved(updated),
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-stone-900">
          Edit your profile
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Update what AMTA has on file. Your changes save when you click the
          button at the bottom.
        </p>
      </section>

      <Section title="Name & pronouns">
        <Field label="First name">
          <TextInput
            value={form.first_name}
            onChange={(v) => update("first_name", v)}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Last name">
          <TextInput
            value={form.last_name}
            onChange={(v) => update("last_name", v)}
            autoComplete="family-name"
          />
        </Field>
        <Field label="Pronouns" hint="Optional — e.g. she/her, they/them">
          <TextInput
            value={form.pronouns}
            onChange={(v) => update("pronouns", v)}
            placeholder="she/her"
          />
        </Field>
      </Section>

      <Section title="Contact">
        <Field
          label="Primary email"
          hint={
            <>
              We keep this one locked so AMTA always has a reliable way to
              reach you. To update it, send us a note at{" "}
              <a
                href="mailto:amta@collegemocktrial.org"
                className="text-[#70172a] underline hover:no-underline"
              >
                amta@collegemocktrial.org
              </a>{" "}
              and we'll switch it on our end.
            </>
          }
        >
          <TextInput
            value={profile.email ?? ""}
            onChange={() => {}}
            disabled
          />
        </Field>
        <Field label="Secondary email" hint="Optional">
          <TextInput
            type="email"
            value={form.secondary_email}
            onChange={(v) => update("secondary_email", v)}
            autoComplete="email"
          />
        </Field>
        <Field label="Phone">
          <TextInput
            type="tel"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            autoComplete="tel"
          />
        </Field>
      </Section>

      <Section title="Location">
        <Field label="City">
          <TextInput
            value={form.current_city}
            onChange={(v) => update("current_city", v)}
            placeholder="Midlands"
            autoComplete="address-level2"
          />
        </Field>
        <Field label="State">
          <StateSelect
            value={form.current_state}
            onChange={(v) => update("current_state", v)}
          />
        </Field>
      </Section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-medium">Couldn't save your changes</div>
          <div className="mt-1 text-xs text-red-700">{error.message}</div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isDirty || isPending}
          className="rounded-md bg-[#70172a] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5a1222] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Affiliations modal
// =============================================================================

type AffRow =
  | { mode: "existing"; aff: ProfileAffiliation }
  | { mode: "editing"; aff: ProfileAffiliation }
  | { mode: "creating" };

function AffiliationsModal({
  profile,
  token,
  onClose,
  onAnyChange,
}: {
  profile: ProfileData;
  token: string;
  onClose: () => void;
  /** Called after a successful add/update/delete. Modal stays open. */
  onAnyChange: () => Promise<void>;
}) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Manage your affiliations
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Programs you've been part of as a student, coach, or advisor.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2">
          {profile.affiliations.map((a) =>
            editingId === a.id ? (
              <AffiliationForm
                key={a.id}
                token={token}
                initial={a}
                onCancel={() => setEditingId(null)}
                onDone={async () => {
                  setEditingId(null);
                  await onAnyChange();
                }}
              />
            ) : (
              <AffiliationListRow
                key={a.id}
                aff={a}
                token={token}
                onEdit={() => setEditingId(a.id)}
                onDeleted={onAnyChange}
              />
            ),
          )}

          {creatingNew ? (
            <AffiliationForm
              token={token}
              initial={null}
              onCancel={() => setCreatingNew(false)}
              onDone={async () => {
                setCreatingNew(false);
                await onAnyChange();
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-stone-300 px-3 py-3 text-sm font-medium text-stone-600 hover:border-[#70172a] hover:text-[#70172a]"
            >
              <Plus size={14} />
              Add an affiliation
            </button>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function AffiliationListRow({
  aff,
  token,
  onEdit,
  onDeleted,
}: {
  aff: ProfileAffiliation;
  token: string;
  onEdit: () => void;
  onDeleted: () => Promise<void>;
}) {
  const del = useDeleteAffiliation();

  async function handleDelete() {
    if (
      !window.confirm(
        `Remove your affiliation with ${aff.program_name ?? "this program"}?`,
      )
    ) {
      return;
    }
    await del.mutateAsync({ p_token: token, p_affiliation_id: aff.id });
    await onDeleted();
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-stone-900">
          {aff.program_name ?? "(unknown program)"}
        </div>
        <div className="truncate text-xs text-stone-500">
          {AFFILIATION_TYPE_LABELS[aff.affiliation_type]} ·{" "}
          {formatYearRange(aff.start_year, aff.end_year)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
          aria-label="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={del.isPending}
          className="rounded-md p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          aria-label="Remove"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function AffiliationForm({
  token,
  initial,
  onCancel,
  onDone,
}: {
  token: string;
  initial: ProfileAffiliation | null;
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const [programId, setProgramId] = useState<string | null>(
    initial?.program_id ?? null,
  );
  const [programLabel, setProgramLabel] = useState<string | null>(
    initial?.program_name ?? null,
  );
  const [type, setType] = useState<ProfileAffiliation["affiliation_type"]>(
    initial?.affiliation_type ?? "student_alumni",
  );
  const [startYear, setStartYear] = useState<string>(
    initial?.start_year != null ? String(initial.start_year) : "",
  );
  const [endYear, setEndYear] = useState<string>(
    initial?.end_year != null ? String(initial.end_year) : "",
  );

  const add = useAddAffiliation();
  const upd = useUpdateAffiliation();
  const isPending = add.isPending || upd.isPending;
  const lastError = add.error?.message ?? upd.error?.message ?? null;

  // Basic client-side validation. The DB also enforces; this just gives
  // friendlier inline messaging.
  const startN = startYear ? Number(startYear) : null;
  const endN = endYear ? Number(endYear) : null;
  const yearError = (() => {
    if (startN == null || Number.isNaN(startN))
      return "Start year is required";
    if (startN < 1985 || startN > 2100) return "Start year looks off";
    if (endN != null) {
      if (Number.isNaN(endN)) return "End year doesn't look like a number";
      if (endN < startN) return "End year can't be before start year";
      if (endN < 1985 || endN > 2100) return "End year looks off";
    }
    return null;
  })();

  const canSubmit = programId && !yearError && !isPending;

  async function handleSubmit() {
    if (!canSubmit || !programId || startN == null) return;
    const payload = {
      p_token: token,
      p_program_id: programId,
      p_affiliation_type: type,
      p_start_year: startN,
      p_end_year: endN,
    };
    if (initial) {
      await upd.mutateAsync({
        ...payload,
        p_affiliation_id: initial.id,
      });
    } else {
      await add.mutateAsync(payload);
    }
    await onDone();
  }

  function onProgramPicked(p: ProgramOption) {
    setProgramId(p.id);
    setProgramLabel(p.name);
  }

  return (
    <div className="space-y-3 rounded-md border border-[#70172a]/30 bg-stone-50 p-4">
      <div>
        <label className="block text-xs font-medium text-stone-700">
          Program
        </label>
        <div className="mt-1">
          <ProgramCombobox
            value={programId}
            selectedLabel={programLabel}
            onChange={onProgramPicked}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-stone-700">
            Your role
          </label>
          <select
            value={type}
            onChange={(e) =>
              setType(
                e.target.value as ProfileAffiliation["affiliation_type"],
              )
            }
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#70172a] focus:outline-none focus:ring-1 focus:ring-[#70172a]"
          >
            <option value="student_alumni">Student / Alumni</option>
            <option value="coach">Coach</option>
            <option value="advisor">Advisor</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-700">
            Start year
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 2019"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#70172a] focus:outline-none focus:ring-1 focus:ring-[#70172a]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-700">
            End year{" "}
            <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="leave blank if ongoing"
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#70172a] focus:outline-none focus:ring-1 focus:ring-[#70172a]"
          />
        </div>
      </div>

      {yearError && (
        <div className="text-xs text-red-700">{yearError}</div>
      )}
      {lastError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {lastError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-md bg-[#70172a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5a1222] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : initial ? "Save changes" : "Add affiliation"}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Small UI primitives
// =============================================================================

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-6 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-stone-100">{children}</div>
    </section>
  );
}

function Row({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 text-sm text-stone-700">
      <span className="text-stone-400">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-stone-400">{children}</span>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-4">
      <label className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      {hint && <div className="mt-0.5 text-xs text-stone-500">{hint}</div>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#70172a] focus:outline-none focus:ring-1 focus:ring-[#70172a] disabled:bg-stone-50 disabled:text-stone-500"
    />
  );
}

function StateSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#70172a] focus:outline-none focus:ring-1 focus:ring-[#70172a]"
    >
      <option value="">— Select —</option>
      {STATE_OPTIONS_FOR_DROPDOWN.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
