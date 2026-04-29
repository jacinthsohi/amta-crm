import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Slide-in panel from the right edge of the screen. Used for create/edit
 * forms throughout the app.
 *
 * Behaviors:
 *  - Esc closes (with a confirm if `dirty=true`)
 *  - Click backdrop closes (same dirty check)
 *  - Click inside the panel doesn't close
 *  - Footer is sticky at the bottom for action buttons
 */
export function SidePanel({
  open,
  onClose,
  title,
  footer,
  children,
  dirty = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
  dirty?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dirty && !window.confirm("You have unsaved changes. Discard them?"))
          return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dirty]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-zinc-900/30 backdrop-blur-[2px]"
        onClick={() => {
          if (dirty && !window.confirm("You have unsaved changes. Discard them?"))
            return;
          onClose();
        }}
      />
      {/* Panel */}
      <aside
        className="flex flex-col h-full bg-white shadow-2xl border-l border-zinc-200"
        style={{ width: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <button
            onClick={() => {
              if (dirty && !window.confirm("You have unsaved changes. Discard them?"))
                return;
              onClose();
            }}
            className="p-1 rounded hover:bg-zinc-100 text-zinc-500"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 shrink-0 border-t border-zinc-200 bg-zinc-50">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
