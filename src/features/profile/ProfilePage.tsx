import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Mail, Phone, MapPin, User, CheckCircle2 } from "lucide-react";
import { useProfile, useUpdateProfile, type ProfileData } from "./hooks";
import { formatLocation } from "@/lib/format-location";
import { STATE_OPTIONS_FOR_DROPDOWN } from "@/lib/us-states";

type Mode = "view" | "edit";

export default function ProfilePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { state, setProfile } = useProfile(token);
  const [mode, setMode] = useState<Mode>("view");
  const [justSaved, setJustSaved] = useState(false);

  // When the user saves successfully, show a confirmation banner that
  // self-dismisses after a few seconds. Reset when the user starts
  // editing again so a second save still flashes.
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
          />
        )}
        {state.status === "ready" && mode === "edit" && token && (
          <ProfileEdit
            profile={state.data}
            token={token}
            onCancel={() => setMode("view")}
            onSaved={(updated) => {
              // Push the server-confirmed profile back into useProfile's
              // state so view mode shows the saved values immediately.
              setProfile(updated);
              setMode("view");
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
}: {
  profile: ProfileData;
  onEdit: () => void;
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

      {/* Affiliations placeholder — wired up in Chunk 4 */}
      <Section title="AMTA affiliations">
        <Row icon={<User className="h-4 w-4" />}>
          <Empty>Adding your program affiliations is coming soon.</Empty>
        </Row>
      </Section>

      {/* Edit button */}
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

// =============================================================================
// Edit mode
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

  // Dirty check: only enable save if the user changed something.
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
    // Trim everything before sending. Empty string becomes null on the
    // server side, but the RPC accepts either.
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

      {/* Action bar */}
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
// Small UI primitives (local to this file — they're profile-specific)
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
