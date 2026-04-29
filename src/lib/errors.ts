/**
 * Convert any thrown value into a readable string for display.
 *
 * Supabase throws plain object errors (PostgrestError) that aren't instances
 * of Error, so the naive `e instanceof Error ? e.message : String(e)` produces
 * "[object Object]" — useless. This helper handles the cases properly.
 */
export function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") {
      // Supabase: include hint and code when present for easier diagnosis
      const parts = [obj.message];
      if (typeof obj.hint === "string") parts.push(`(hint: ${obj.hint})`);
      if (typeof obj.code === "string") parts.push(`[${obj.code}]`);
      return parts.join(" ");
    }
    try {
      return JSON.stringify(e, null, 2);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
