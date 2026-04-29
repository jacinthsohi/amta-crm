import { Sparkles } from "lucide-react";

/**
 * Placeholder for entity sections we haven't ported yet. The Sidebar links
 * to these routes; clicking them shows this page so the app doesn't crash.
 *
 * As each Phase 4 sub-phase ships, the corresponding ComingSoon route gets
 * replaced by the real list page.
 */
export function ComingSoon({
  title,
  subPhase,
}: {
  title: string;
  subPhase: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 bg-zinc-100 border border-zinc-200">
          <Sparkles className="text-zinc-500" size={20} />
        </div>
        <h1 className="text-lg font-semibold text-zinc-900 mb-1">
          {title}
        </h1>
        <p className="text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">
          Coming in Phase {subPhase}. The shell is in place; the page itself
          ports next.
        </p>
      </div>
    </div>
  );
}
