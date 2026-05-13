// =============================================================================
// src/features/data/DataPage.tsx
// =============================================================================
// /data — the KPI dashboard. v1 shows three metric cards (Active Programs,
// Active Alumni, Active Board Members) and a US state heatmap with a
// Programs / Alumni toggle.
//
// Distinct from the Home page (src/features/dashboard/DashboardPage.tsx),
// which is the personal "what's on my plate today" landing experience.
// Stats-style aggregations live here on /data.
//
// Future additions tracked in BACKLOG.md:
//   - Board breakdown (director / first-year / second-year) once board_terms
//     is populated
//   - Click-through from heatmap to filtered list pages once state filtering
//     is added to /programs and /contacts
//   - Alumni heatmap toggle for "by current state" once that field is
//     populated on contacts
// =============================================================================

import { BarChart3, GraduationCap, Users, Sparkles } from "lucide-react";
import { LoadingState, ErrorState } from "@/components/states";
import { useDataDashboard } from "./hooks";
import { StateHeatmap } from "./StateHeatmap";

export default function DataPage() {
  const { data, isLoading, error, refetch } = useDataDashboard();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-7 pb-5 border-b border-zinc-200">
        <div className="flex items-center gap-2 text-zinc-900 mb-0.5">
          <BarChart3 size={18} className="text-maroon-700" />
          <h1 className="text-[22px] font-semibold tracking-tight">Data</h1>
        </div>
        <p className="text-sm text-zinc-500">
          Stats and geographic distribution across AMTA.
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : data ? (
          <DataBody data={data} />
        ) : null}
      </div>
    </div>
  );
}

function DataBody({
  data,
}: {
  data: ReturnType<typeof useDataDashboard>["data"] & {};
}) {
  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Active programs"
          value={data.programCount}
          icon={GraduationCap}
          subtitle={
            data.internationalProgramCount > 0
              ? `${data.internationalProgramCount} international (not on map)`
              : undefined
          }
        />
        <MetricCard
          label="Active alumni"
          value={data.alumniCount}
          icon={Users}
        />
        <MetricCard
          label="Current board members"
          value={data.boardMemberCount}
          icon={Sparkles}
          subtitle="Tagged 'Current Board Member' (v1 proxy)"
        />
      </div>

      {/* Heatmap */}
      <StateHeatmap
        programsByState={data.programsByState}
        alumniByState={data.alumniByState}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// MetricCard
// -----------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  icon: Icon,
  subtitle,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center gap-2 text-zinc-500 mb-2">
        <Icon size={14} />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-3xl font-semibold text-zinc-900 tabular-nums">
        {value.toLocaleString()}
      </div>
      {subtitle && (
        <div className="text-[11px] text-zinc-500 mt-1.5">{subtitle}</div>
      )}
    </div>
  );
}
