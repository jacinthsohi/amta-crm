// =============================================================================
// src/features/data/StateHeatmap.tsx
// =============================================================================
// US state heatmap with a Programs / Alumni toggle. Uses react-simple-maps
// for the SVG map rendering and a public topojson source for state shapes.
//
// Interactivity:
//   - Hover a state: state stroke darkens to maroon, tooltip appears near
//     cursor with "State name — N programs/alumni"
//   - Cursor changes to pointer (signals interactivity even though click
//     doesn't navigate yet — that's a future enhancement once /programs
//     and /contacts support state filtering)
//   - States with 0 data still show their tooltip; this confirms the map
//     is working and the count is genuinely zero
//
// Color scale: maroon-tinted, light to dark based on count. Zero = light
// zinc fill so empty states are visible but visually quiet.
// =============================================================================

import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";

// US states topojson from the react-simple-maps recommended public source.
// This is a CDN-hosted file, ~150KB, served via jsDelivr.
const US_STATES_GEO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

type ViewMode = "programs" | "alumni";

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  stateName: string;
  count: number;
};

export type StateHeatmapProps = {
  programsByState: Map<string, number>;
  alumniByState: Map<string, number>;
};

export function StateHeatmap({
  programsByState,
  alumniByState,
}: StateHeatmapProps) {
  const [mode, setMode] = useState<ViewMode>("programs");
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    stateName: "",
    count: 0,
  });

  const activeData = mode === "programs" ? programsByState : alumniByState;
  const maxCount = useMemo(
    () => Math.max(0, ...Array.from(activeData.values())),
    [activeData],
  );

  // -----------------------------------------------------------------------------
  // Tooltip event handlers
  // -----------------------------------------------------------------------------

  function handleMouseEnter(stateName: string, count: number) {
    return (e: React.MouseEvent) => {
      setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        stateName,
        count,
      });
    };
  }

  function handleMouseMove(e: React.MouseEvent) {
    // Update position only — keep the same state/count from the enter event.
    // This avoids re-reading geo props on every pixel move.
    setTooltip((prev) =>
      prev.visible ? { ...prev, x: e.clientX, y: e.clientY } : prev,
    );
  }

  function handleMouseLeave() {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 relative">
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
                    onMouseEnter={handleMouseEnter(stateName, count)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      default: { outline: "none" },
                      hover: {
                        outline: "none",
                        fill,
                        stroke: "#70172a",
                        strokeWidth: 1.5,
                        cursor: "pointer",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>

        {/* Floating tooltip — follows cursor, renders only when visible */}
        {tooltip.visible && (
          <HeatmapTooltip
            x={tooltip.x}
            y={tooltip.y}
            stateName={tooltip.stateName}
            count={tooltip.count}
            mode={mode}
          />
        )}
      </div>

      <Legend mode={mode} maxCount={maxCount} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tooltip
// -----------------------------------------------------------------------------
// Rendered as a fixed-position element near the cursor. Using `position: fixed`
// + clientX/Y means we don't have to translate coordinates into the SVG's
// coordinate system. Slight offset so the cursor doesn't overlap the tooltip.

function HeatmapTooltip({
  x,
  y,
  stateName,
  count,
  mode,
}: {
  x: number;
  y: number;
  stateName: string;
  count: number;
  mode: ViewMode;
}) {
  const noun =
    mode === "programs"
      ? count === 1
        ? "program"
        : "programs"
      : count === 1
        ? "alum"
        : "alumni";

  return (
    <div
      className="fixed pointer-events-none z-50 rounded-md bg-zinc-900 text-white px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
      style={{
        left: x + 12,
        top: y + 12,
      }}
    >
      <div className="font-medium">{stateName}</div>
      <div className="text-zinc-300 tabular-nums">
        {count.toLocaleString()} {noun}
      </div>
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

  const ratio = Math.sqrt(count / maxCount);

  const lo = { r: 253, g: 232, b: 236 }; // light maroon tint
  const hi = { r: 112, g: 23, b: 42 }; // brand maroon #70172a

  const r = Math.round(lo.r + (hi.r - lo.r) * ratio);
  const g = Math.round(lo.g + (hi.g - lo.g) * ratio);
  const b = Math.round(lo.b + (hi.b - lo.b) * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}
