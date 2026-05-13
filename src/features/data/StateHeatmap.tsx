// =============================================================================
// src/features/dashboard/StateHeatmap.tsx
// =============================================================================
// US state heatmap with a Programs / Alumni toggle. Uses react-simple-maps
// for the SVG map rendering and a public topojson source for state shapes.
//
// Color scale: maroon-tinted, light to dark based on count. Zero = light
// zinc fill so empty states are visible but visually quiet.
//
// Tooltip: native title (browser-rendered) is the v1. Lower scope than a
// custom React tooltip and still useful. Can upgrade later.
// =============================================================================

import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";

// US states topojson from the react-simple-maps recommended public source.
// This is a CDN-hosted file, ~150KB, served via Cloudflare. We could also
// vendor it locally if we wanted to avoid the runtime fetch.
const US_STATES_GEO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

type ViewMode = "programs" | "alumni";

export type StateHeatmapProps = {
  programsByState: Map<string, number>;
  alumniByState: Map<string, number>;
};

export function StateHeatmap({
  programsByState,
  alumniByState,
}: StateHeatmapProps) {
  const [mode, setMode] = useState<ViewMode>("programs");

  const activeData = mode === "programs" ? programsByState : alumniByState;
  const maxCount = useMemo(
    () => Math.max(0, ...Array.from(activeData.values())),
    [activeData],
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Geographic distribution
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {mode === "programs"
              ? "Active programs per US state."
              : "Alumni per US state (rolled up via their program's state)."}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      <div className="relative">
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1000 }}
          width={800}
          height={500}
          style={{ width: "100%", height: "auto" }}
        >
          <Geographies geography={US_STATES_GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const stateName = geo.properties.name as string;
                const count = activeData.get(stateName) ?? 0;
                const fill = colorForCount(count, maxCount);
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="#fff"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: {
                        outline: "none",
                        fill: hoverColorForCount(count, maxCount),
                        cursor: count > 0 ? "default" : "default",
                      },
                      pressed: { outline: "none" },
                    }}
                  >
                    <title>
                      {stateName}: {count}{" "}
                      {mode === "programs"
                        ? count === 1
                          ? "program"
                          : "programs"
                        : count === 1
                          ? "alum"
                          : "alumni"}
                    </title>
                  </Geography>
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      <Legend mode={mode} maxCount={maxCount} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Mode toggle (Programs / Alumni)
// -----------------------------------------------------------------------------

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 p-0.5">
      <ToggleButton
        active={mode === "programs"}
        onClick={() => onChange("programs")}
      >
        Programs
      </ToggleButton>
      <ToggleButton
        active={mode === "alumni"}
        onClick={() => onChange("alumni")}
      >
        Alumni
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-1 rounded text-xs font-medium transition-colors " +
        (active
          ? "bg-white text-maroon-700 shadow-sm"
          : "bg-transparent text-zinc-600 hover:text-zinc-900")
      }
    >
      {children}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Legend (color scale)
// -----------------------------------------------------------------------------

function Legend({ mode, maxCount }: { mode: ViewMode; maxCount: number }) {
  if (maxCount === 0) return null;

  // Show 5 swatches: 0, 25%, 50%, 75%, 100% of max
  const stops = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(p * maxCount));

  return (
    <div className="mt-4 flex items-center gap-3 text-[11px] text-zinc-500">
      <span>
        {mode === "programs" ? "Programs" : "Alumni"} per state:
      </span>
      <div className="flex items-center gap-1">
        {stops.map((stop, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              className="w-7 h-3 rounded-sm border border-zinc-200"
              style={{ background: colorForCount(stop, maxCount) }}
            />
            <span className="text-[10px] text-zinc-500">{stop}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Color scale
// -----------------------------------------------------------------------------

/**
 * Maps a count (0..maxCount) to a maroon-tinted color.
 * 0 → near-white zinc, max → deep maroon. Uses sqrt scaling so smaller
 * differences at the low end are visible (linear scaling buries them).
 */
function colorForCount(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return "#f4f4f5"; // zinc-100

  const ratio = Math.sqrt(count / maxCount); // sqrt for visual sensitivity at low counts

  // Interpolate between zinc-100 (very light) and maroon-700 deep.
  // Maroon brand color is #70172a. We'll go from #fde8ec → #70172a.
  // Simpler approach: blend two colors in HSL.
  // For now, do a simple RGB interpolation between two endpoints.
  const lo = { r: 253, g: 232, b: 236 }; // light maroon tint
  const hi = { r: 112, g: 23, b: 42 }; // brand maroon #70172a

  const r = Math.round(lo.r + (hi.r - lo.r) * ratio);
  const g = Math.round(lo.g + (hi.g - lo.g) * ratio);
  const b = Math.round(lo.b + (hi.b - lo.b) * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}

function hoverColorForCount(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return "#e4e4e7"; // zinc-200 on hover
  // Slightly darker version of the fill
  const base = colorForCount(count, maxCount);
  return base; // For now, keep the same. Could darken later.
}
