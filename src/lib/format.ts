/**
 * Date and string formatting helpers used across the app.
 *
 * Keep these timezone-naive for now — Postgres `date` columns are dates only,
 * and `timestamptz` columns we render in the user's local browser time.
 */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  // For 'YYYY-MM-DD' strings we want to avoid timezone shifts. Construct the
  // date in local time by parsing parts manually.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start) return "—";
  if (!end || start === end) return formatDate(start);

  // If dates are in the same month, show "Apr 17–19, 2026"; otherwise full both
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const startD = new Date(ys, ms - 1, ds);
  const endD = new Date(ye, me - 1, de);

  if (ys === ye && ms === me) {
    const monthYear = startD.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    const m = monthYear.split(" ")[0];
    const y = monthYear.split(" ")[1];
    return `${m} ${ds}–${de}, ${y}`;
  }

  return `${startD.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endD.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function formatYearRange(
  start: number | null | undefined,
  end: number | null | undefined,
): string {
  if (!start) return "—";
  if (!end) return `${start}–present`;
  if (start === end) return String(start);
  return `${start}–${end}`;
}

// =============================================================================
// Term and role formatting
// =============================================================================

export function formatTermType(type: string): string {
  return (
    {
      first_year_candidate: "First-Year Candidate",
      second_year_candidate: "Second-Year Candidate",
      voting_director: "Voting Director",
    } as Record<string, string>
  )[type] ?? type;
}

export function formatOfficerType(type: string): string {
  return (
    {
      president: "President",
      president_elect: "President-Elect",
      past_president: "Past President",
      secretary: "Secretary",
      treasurer: "Treasurer",
    } as Record<string, string>
  )[type] ?? type;
}

export function formatAffiliationType(type: string): string {
  return (
    {
      student_alumni: "Student / Alumni",
      coach: "Coach",
      advisor: "Advisor",
    } as Record<string, string>
  )[type] ?? type;
}

export function formatTournamentType(type: string | null): string {
  if (!type) return "";
  return (
    {
      invitational: "Invitational",
      regional: "Regional",
      orcs: "ORCS",
      nct: "NCT",
    } as Record<string, string>
  )[type] ?? type;
}

// =============================================================================
// Initials, etc.
// =============================================================================

export function initialsOf(contact: {
  first_name: string;
  last_name: string;
}): string {
  const f = contact.first_name?.[0] ?? "";
  const l = contact.last_name?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

export function fullName(contact: {
  first_name: string;
  last_name: string;
}): string {
  return `${contact.first_name} ${contact.last_name}`.trim();
}

// =============================================================================
// HTML helpers
// =============================================================================

/**
 * Strip HTML tags from a string and decode common entities to produce plain
 * text. Used for list-page previews where rendering rich HTML would break
 * the row layout.
 *
 * This isn't a security boundary — for that, use DOMPurify. It's just a
 * "render this as plain prose" helper for previews.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  // Replace block-level closes with a space to keep words from running together
  const spaced = html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ");
  // Strip all remaining tags
  const stripped = spaced.replace(/<[^>]+>/g, "");
  // Decode the entities Tiptap might emit
  const decoded = stripped
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Collapse whitespace
  return decoded.replace(/\s+/g, " ").trim();
}
