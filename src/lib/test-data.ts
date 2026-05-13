// =============================================================================
// src/lib/test-data.ts
// =============================================================================
// Helpers for filtering test contacts out of lists, stats, and AI features.
//
// Background: we use a "Test" contact category to flag test data (rather than
// a dedicated is_test column) because it reuses our existing category UI
// without any schema change. Admin tags a contact with the Test category to
// mark it as test; this module provides the helpers that respect that tag
// across the app.
//
// Two helpers for two query shapes:
//   - isTestContact(): a predicate for filtering arrays that already have
//     category_names attached. Used in the contacts list hook where
//     stitching already happened.
//   - getTestContactIds(): an async function that returns the UUIDs of all
//     test-tagged contacts. Used for query-level filtering where you have
//     `.not("id", "in", "(uuid1,uuid2,...)")` or similar.
//
// Both default to filtering test contacts OUT. To opt back in (e.g. a "show
// test data" toggle), check the toggle state in the caller and skip the
// filter.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The name of the category we use to flag test contacts. Single source of
 * truth — if we ever rename, this is the one place to change.
 */
export const TEST_CATEGORY_NAME = "Test";

/**
 * localStorage key for the "show test data" toggle. Centralized so the
 * toggle UI and any consumer that respects it share the same key.
 */
export const SHOW_TEST_DATA_KEY = "amta:show-test-data";

/**
 * Reads the current value of the "show test data" toggle from localStorage.
 * Defaults to false (test data is hidden by default).
 *
 * Safe to call on the server / before hydration — returns false if
 * localStorage isn't available.
 */
export function shouldShowTestData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SHOW_TEST_DATA_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Writes the "show test data" toggle to localStorage.
 */
export function setShowTestData(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SHOW_TEST_DATA_KEY, String(value));
  } catch {
    // localStorage might be unavailable (Safari private mode, etc.); silently
    // ignore. The default (false) will be used.
  }
}

/**
 * Predicate for filtering arrays of contacts that already have
 * `category_names` attached. Returns true if the contact has the Test
 * category.
 *
 * Usage:
 *   const visible = contacts.filter(c => !isTestContact(c));
 *   // or, respecting the toggle:
 *   const visible = shouldShowTestData()
 *     ? contacts
 *     : contacts.filter(c => !isTestContact(c));
 */
export function isTestContact(contact: {
  category_names?: string[] | null;
}): boolean {
  return contact.category_names?.includes(TEST_CATEGORY_NAME) ?? false;
}

/**
 * Returns the UUIDs of all contacts tagged with the Test category.
 * Useful for query-level filtering where you want to do something like:
 *   const testIds = await getTestContactIds(supabase);
 *   query.not("id", "in", `(${testIds.join(",")})`);
 *
 * Returns an empty array if there are no test contacts (so a downstream
 * `.not("id", "in", "()")` would just be a no-op, but check first to avoid
 * a malformed SQL query — see below).
 *
 * @returns string[] of contact UUIDs; possibly empty.
 */
export async function getTestContactIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  // Look up the Test category id first
  const { data: cats, error: catErr } = await supabase
    .from("active_contact_categories")
    .select("id")
    .eq("name", TEST_CATEGORY_NAME)
    .maybeSingle();

  if (catErr) throw catErr;
  if (!cats) return []; // No "Test" category exists → no test contacts

  // Then look up the contact ids that have that category
  const { data: assignments, error: assignErr } = await supabase
    .from("active_contact_category_assignments")
    .select("contact_id")
    .eq("category_id", cats.id);

  if (assignErr) throw assignErr;
  return (assignments ?? []).map((a) => a.contact_id);
}

/**
 * Convenience: apply a "not in (test ids)" filter to a Supabase query
 * builder when you don't want test contacts in the results. Pass the
 * column name on the table you're querying that holds the contact_id.
 *
 * Example:
 *   let q = supabase.from("interactions").select("*");
 *   q = await excludeTestContacts(q, "contact_id");
 *
 * If there are no test contacts, this is a no-op.
 */
export async function excludeTestContacts<T>(
  query: T,
  contactIdColumn: string,
  supabase: SupabaseClient,
): Promise<T> {
  const testIds = await getTestContactIds(supabase);
  if (testIds.length === 0) return query;
  // PostgREST `.not(col, 'in', '(...)')` expects a parenthesized csv
  return (query as any).not(
    contactIdColumn,
    "in",
    `(${testIds.join(",")})`,
  );
}
