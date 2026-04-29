import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const baseInputClass =
  "w-full px-2.5 py-1.5 text-[13px] rounded-md border outline-none transition-colors";

type TextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> & {
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  error?: string | null;
};

export function TextInput({
  value,
  onChange,
  error,
  className,
  ...rest
}: TextInputProps) {
  return (
    <input
      {...rest}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        baseInputClass,
        error
          ? "border-red-500 focus:border-red-600"
          : "border-zinc-200 focus:border-maroon-700",
        "bg-white",
        className,
      )}
    />
  );
}

type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string | null | undefined;
  onChange: (v: string) => void;
  error?: string | null;
};

export function TextArea({
  value,
  onChange,
  error,
  rows = 4,
  className,
  ...rest
}: TextAreaProps) {
  return (
    <textarea
      {...rest}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={cn(
        baseInputClass,
        "resize-y leading-snug font-sans",
        error
          ? "border-red-500 focus:border-red-600"
          : "border-zinc-200 focus:border-maroon-700",
        "bg-white",
        className,
      )}
    />
  );
}

type Option = { id: string; label: string };

export function Select({
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: Option[];
  placeholder?: string;
  error?: string | null;
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          baseInputClass,
          "appearance-none pr-8 cursor-pointer bg-white",
          error
            ? "border-red-500 focus:border-red-600"
            : "border-zinc-200 focus:border-maroon-700",
          !value && "text-zinc-400",
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
      />
    </div>
  );
}

/**
 * PillSelect — single-choice pills (one of N options). Used for status,
 * priority, type, etc. where the field has a small number of values and
 * we want them all visible at once rather than hidden in a dropdown.
 */
export function PillSelect<T extends string | null>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={String(opt.id)}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs transition-colors border",
              active
                ? "bg-maroon-50 text-maroon-700 border-maroon-100 font-medium"
                : "bg-transparent text-zinc-600 border-zinc-200 hover:bg-zinc-50",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
