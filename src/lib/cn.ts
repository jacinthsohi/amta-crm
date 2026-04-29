/**
 * Tiny utility to compose className strings, ignoring falsy values.
 * Saves us from importing a fancier lib like clsx for now.
 *
 * Usage: cn("px-3 py-1", isActive && "bg-maroon-50", error && "border-red-500")
 */
export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}
