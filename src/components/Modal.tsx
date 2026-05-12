// src/components/Modal.tsx
// =============================================================================
// Generic Modal component
// =============================================================================
// First reusable modal primitive in the app. Built for the alumni claim review
// flow but designed to be reused for future modals (approve form, reject
// reason dialog, etc).
//
// Features:
//   - Backdrop click closes the modal
//   - ESC key closes the modal
//   - Body scroll is locked while open
//   - Optional footer slot for actions
//   - Header with title + close (X) button
//
// Usage:
//   <Modal
//     open={isOpen}
//     onClose={() => setIsOpen(false)}
//     title="Review alumni claim"
//     subtitle="Submitted May 9, 2026"
//     footer={<>
//       <button onClick={handleReject}>Reject</button>
//       <button onClick={handleApprove}>Approve</button>
//     </>}
//   >
//     <p>Modal body content</p>
//   </Modal>
// =============================================================================

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  // Max width of the modal panel. Defaults to 'lg' (~32rem).
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "lg",
}: ModalProps) {
  // Close on ESC. Effect only re-binds when open changes.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll while the modal is open. Without this, scrolling the
  // modal content can bleed through to the page underneath on some browsers.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`w-full ${SIZE_CLASSES[size]} overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2
              id="modal-title"
              className="text-base font-semibold text-zinc-900"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable if content is tall */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer (optional) */}
        {footer && (
          <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
