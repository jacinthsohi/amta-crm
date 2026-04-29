import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex items-center gap-1 text-xs font-medium text-zinc-700 mb-1.5">
      <span>{children}</span>
      {required && <span className="text-red-600">•</span>}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
      <AlertCircle size={11} />
      {children}
    </div>
  );
}

export function FieldGroup({
  label,
  required,
  error,
  hint,
  children,
}: {
  label?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      {children}
      {hint && !error && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
