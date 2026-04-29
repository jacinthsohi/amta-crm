import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
};

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3.5 py-1.5 rounded-md text-sm font-medium text-white bg-maroon-700 hover:bg-maroon-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-sm font-medium px-3 py-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors",
        className,
      )}
    >
      {children}
    </button>
  );
}
