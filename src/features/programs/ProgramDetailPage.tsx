import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Plus,
  Calendar,
} from "lucide-react";
import {
  useProgram,
  useGroupedAffiliations,
  type ProgramWithAffiliations,
} from "./hooks";
import { useEventsForProgram } from "@/features/events/hooks";
import { Avatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { Section } from "@/components/Section";
import { RichTextDisplay } from "@/components/RichTextDisplay";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { formatYearRange, formatAffiliationType, formatDate } from "@/lib/format";
import { ProgramForm } from "./ProgramForm";
import { ProgramAffiliationForm } from "@/features/contacts/ProgramAffiliationForm";

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: program, isLoading, error, refetch } = useProgram(id);

  const [editOpen, setEditOpen] = useState(false);
  const [addAffOpen, setAddAffOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!program) {
    return (
      <div className="px-8 py-9">
        <p className="text-sm text-zinc-600">
          That program could not be found. It may have been deleted.
        </p>
        <Link
          to="/programs"
          className="text-xs text-maroon-700 hover:underline"
        >
          ← Back to programs
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-3 flex items-center gap-2 text-sm border-b border-zinc-200">
        <button
          onClick={() => navigate("/programs")}
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>Programs</span>
        </button>
        <ChevronRight size={13} className="text-zinc-300" />
        <span className="text-zinc-900 font-medium">{program.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Hero program={program} onEdit={() => setEditOpen(true)} />
        <div className="px-8 py-7">
          <PeopleSection
            program={program}
            onAdd={() => setAddAffOpen(true)}
          />
          <EventsSection programId={program.id} />
        </div>
      </div>

      <ProgramForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialProgram={program}
      />
      <ProgramAffiliationForm
        open={addAffOpen}
        onClose={() => setAddAffOpen(false)}
        programId={program.id}
      />
    </div>
  );
}

function Hero({
  program: p,
  onEdit,
}: {
  program: ProgramWithAffiliations;
  onEdit: () => void;
}) {
  return (
    <div className="px-8 pt-8 pb-6 border-b border-zinc-200">
      <div className="flex items-start gap-5">
        <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-maroon-50 border border-maroon-100 shrink-0">
          <span className="text-maroon-700 text-xl font-bold">
            {p.short_name.charAt(0)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h1 className="text-[24px] font-semibold tracking-tight text-zinc-900">
              {p.name}
            </h1>
            {p.status === "active" ? (
              <Tag tone="success">Active</Tag>
            ) : (
              <Tag tone="muted">Inactive</Tag>
            )}
          </div>
          <div className="flex items-center gap-5 text-sm text-zinc-600 flex-wrap">
            {(p.city || p.state) && (
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-zinc-400" />
                <span>
                  {p.city}
                  {p.city && p.state ? ", " : ""}
                  {p.state}
                </span>
              </div>
            )}
            {p.website && (
              <a
                href={
                  p.website.startsWith("http") ? p.website : `https://${p.website}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-zinc-600 hover:text-maroon-700"
              >
                {p.website}
                <ExternalLink size={11} />
              </a>
            )}
            {p.joined_year && (
              <span className="text-zinc-500">Joined {p.joined_year}</span>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
        >
          Edit
        </button>
      </div>
      {p.notes && (
        <div className="mt-5 p-3 rounded-md text-sm text-zinc-700 leading-relaxed bg-zinc-50 border border-zinc-100">
          <RichTextDisplay html={p.notes} />
        </div>
      )}
    </div>
  );
}

function PeopleSection({
  program,
  onAdd,
}: {
  program: ProgramWithAffiliations;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  const groups = useGroupedAffiliations(program.affiliations);
  const totalCount =
    (groups.coaches?.length ?? 0) +
    (groups.current?.length ?? 0) +
    (groups.alumni?.length ?? 0) +
    (groups.advisors?.length ?? 0);

  const renderGroup = (
    title: string,
    items: NonNullable<typeof groups.coaches>,
  ) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-5">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
          {title} ({items.length})
        </h4>
        <div className="space-y-2">
          {items.map((a) => {
            const c = a.contact;
            if (!c) return null;
            return (
              <button
                key={a.id}
                onClick={() => navigate(`/contacts/${c.id}`)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar contact={c} size={28} />
                  <span className="text-sm font-medium text-zinc-900">
                    {c.first_name} {c.last_name}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Tag tone="neutral">
                    {formatAffiliationType(a.affiliation_type)}
                  </Tag>
                  <span className="text-xs text-zinc-500">
                    {formatYearRange(a.start_year, a.end_year)}
                  </span>
                  <ChevronRight size={13} className="text-zinc-300" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Section
      title="People"
      count={totalCount}
      action={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-600 hover:text-maroon-700 hover:bg-maroon-50 transition-colors"
        >
          <Plus size={12} />
          Add affiliation
        </button>
      }
    >
      {totalCount === 0 ? (
        <EmptyState>
          No one affiliated with this program yet. Add the first contact.
        </EmptyState>
      ) : (
        <div>
          {renderGroup("Coaches", groups.coaches ?? [])}
          {renderGroup("Current students", groups.current ?? [])}
          {renderGroup("Advisors", groups.advisors ?? [])}
          {renderGroup("Alumni", groups.alumni ?? [])}
        </div>
      )}
    </Section>
  );
}

function EventsSection({ programId }: { programId: string }) {
  const navigate = useNavigate();
  const { data: events } = useEventsForProgram(programId);

  return (
    <Section title="Hosted events" count={events?.length ?? 0}>
      {!events || events.length === 0 ? (
        <EmptyState>This program hasn't hosted any events yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => navigate(`/events/${e.id}`)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-md shrink-0"
                  style={{
                    background:
                      e.photo_banner_gradient ??
                      "linear-gradient(135deg, #70172a, #a82d4a)",
                  }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-zinc-900 truncate">
                    {e.name}
                  </span>
                  <span className="text-xs text-zinc-500 inline-flex items-center gap-1">
                    <Calendar size={11} className="text-zinc-400" />
                    {formatDate(e.start_date)}
                  </span>
                </div>
              </div>
              <ChevronRight size={13} className="text-zinc-300 shrink-0 ml-3" />
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}
