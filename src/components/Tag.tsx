import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "maroon" | "warn" | "success" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 border-zinc-200",
  maroon: "bg-maroon-50 text-maroon-700 border-maroon-100",
  warn: "bg-amber-50 text-amber-800 border-amber-100",
  success: "bg-green-50 text-green-700 border-green-100",
  muted: "bg-zinc-50 text-zinc-500 border-zinc-100",
};

/**
 * Compact tag/pill for status, role, category labels, etc.
 */
export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs px-2 py-0.5 rounded-md font-medium border",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
