import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="text-sm text-zinc-400 px-1 py-6 text-center">
      {children}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-zinc-400 py-12">
      <Loader2 size={14} className="animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12">
      <AlertCircle size={16} className="text-red-500" />
      <p className="text-sm text-zinc-700">Couldn't load this data.</p>
      <p className="text-xs text-zinc-500 max-w-sm text-center">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-maroon-700 hover:underline mt-1"
        >
          Try again
        </button>
      )}
    </div>
  );
}
