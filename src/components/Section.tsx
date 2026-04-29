import type { ReactNode } from "react";

/**
 * Section wrapper used throughout detail pages. Provides a consistent header
 * (title + optional count + optional action button on the right) with the
 * children rendered below.
 */
export function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number | null;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-7">
      <header className="flex items-baseline justify-between gap-2 mb-2.5">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[13px] font-semibold tracking-wide uppercase text-zinc-500">
            {title}
          </h3>
          {count != null && (
            <span className="text-xs text-zinc-400">{count}</span>
          )}
        </div>
        {action}
      </header>
      <div>{children}</div>
    </section>
  );
}
