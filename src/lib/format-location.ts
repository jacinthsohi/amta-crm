/**
 * Formats a city/state pair into a single display string.
 *
 * Rules:
 *   - Trims and treats empty strings as null.
 *   - "International" and "Other" are generic state values that
 *     shouldn't appear alone or appended to a city.
 *   - Returns null when there's nothing meaningful to display.
 *
 * Examples:
 *   formatLocation("San Francisco", "CA")              -> "San Francisco, CA"
 *   formatLocation("San Francisco", null)              -> "San Francisco"
 *   formatLocation(null, "CA")                         -> "CA"
 *   formatLocation("Toronto", "International")         -> "Toronto"
 *   formatLocation(null, "International")              -> null
 *   formatLocation(null, null)                         -> null
 */
export function formatLocation(
  city: string | null,
  state: string | null,
): string | null {
  const c = city?.trim() || null;
  const s = state?.trim() || null;

  const isGenericState = s === "International" || s === "Other";

  if (c && s && !isGenericState) return `${c}, ${s}`;
  if (c) return c;
  if (s && !isGenericState) return s;
  return null;
}
