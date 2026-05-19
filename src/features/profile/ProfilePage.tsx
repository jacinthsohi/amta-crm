import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Mail, Phone, MapPin, User } from "lucide-react";
import { useProfile, type ProfileData } from "./hooks";
import { formatLocation } from "@/lib/format-location";

export default function ProfilePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const state = useProfile(token);

  return (
    <div className="min-h-screen bg-stone-50">
      <BrandHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {state.status === "loading" && <LoadingState />}
        {state.status === "no_token" && <NoTokenState />}
        {state.status === "invalid" && <InvalidTokenState />}
        {state.status === "error" && <ErrorState message={state.message} />}
        {state.status === "ready" && <ProfileView profile={state.data} />}
      </main>
    </div>
  );
}

function BrandHeader() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="flex items-center gap-3">
          {/* If you have a logo asset, swap this for an <img>. Mirroring the
              alumni-signup pattern. */}
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

function ProfileView({ profile }: { profile: ProfileData }) {
  const fullName = useMemo(() => {
    const parts = [profile.first_name, profile.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Your profile";
  }, [profile.first_name, profile.last_name]);

  const initials = useMemo(() => {
    const f = profile.first_name?.[0] ?? "";
    const l = profile.last_name?.[0] ?? "";
    const result = (f + l).toUpperCase();
    return result || "?";
  }, [profile.first_name, profile.last_name]);

  const locationText = formatLocation(
    profile.current_city,
    profile.current_state
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

      {/* Edit button — non-functional in Chunk 2, enabled in Chunk 3 */}
      <div className="pt-2">
        <button
          type="button"
          disabled
          className="w-full rounded-md bg-[#70172a] px-4 py-2.5 text-sm font-medium text-white opacity-50 sm:w-auto"
          title="Editing will be available shortly"
        >
          Edit profile
        </button>
        <p className="mt-2 text-xs text-stone-400">
          Editing will be enabled in the next update.
        </p>
      </div>
    </div>
  );
}

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
