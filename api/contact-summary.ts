import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/contact-summary
 *
 * Generates an AI summary of a contact's role and recent activity.
 * Streams the generated text back to the client. After streaming
 * completes, persists the summary to the contact's row.
 *
 * Auth: requires a valid Supabase JWT in the Authorization header
 * ("Bearer <token>"). Otherwise responds 401.
 *
 * Env vars required:
 *   ANTHROPIC_API_KEY              — Anthropic API key (server-only)
 *   VITE_SUPABASE_URL              — Supabase project URL
 *   VITE_SUPABASE_ANON_KEY         — Supabase anon key (used for JWT verification)
 *   SUPABASE_SERVICE_ROLE_KEY      — Supabase service role key (used for
 *                                     RLS-bypassing data fetches)
 *
 * We use TWO Supabase clients here:
 *   1. An anon-key client to verify the user's JWT via auth.getUser(token)
 *   2. A service-role client to fetch the contact's relational data without
 *      RLS getting in the way
 * Mixing these is necessary because the service-role client bypasses auth
 * entirely and behaves oddly when asked to verify user tokens.
 */

export const config = {
  // Edge runtime supports streaming responses natively.
  runtime: "edge",
};

// -----------------------------------------------------------------------------
// Lazy-initialized clients. Edge runtime reuses these across requests.
// -----------------------------------------------------------------------------

let anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

function getAnonClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set");
  }
  return createClient(supabaseUrl, anonKey);
}

function getServiceClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError(405, "Method not allowed. Use POST.");
  }

  // ---- 1. Auth check -------------------------------------------------------
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError(401, "Missing or malformed Authorization header.");
  }

  // ---- 2. Parse + validate body --------------------------------------------
  let contactId: string;
  try {
    const body = (await request.json()) as { contact_id?: unknown };
    if (typeof body.contact_id !== "string" || !body.contact_id) {
      return jsonError(400, "Request body must include 'contact_id' (string).");
    }
    contactId = body.contact_id;
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  // ---- 3. Verify the JWT identifies a real user ----------------------------
  // Use an anon-key client for JWT verification. Service-role clients bypass
  // auth and behave oddly when asked to verify tokens.
  let anonClient;
  let serviceClient;
  try {
    anonClient = getAnonClient();
    serviceClient = getServiceClient();
  } catch (e) {
    return jsonError(500, "Server misconfigured: " + (e as Error).message);
  }

  const token = authHeader.slice("Bearer ".length);

  // Diagnostic logging — visible in Vercel function logs
  console.log("[contact-summary] Token length:", token.length);
  console.log("[contact-summary] Token prefix:", token.slice(0, 20));
  console.log(
    "[contact-summary] Anon key starts with:",
    process.env.VITE_SUPABASE_ANON_KEY?.slice(0, 10),
  );

  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);

  if (userErr) {
    console.log("[contact-summary] getUser error:", JSON.stringify(userErr));
  }
  if (!userData?.user) {
    console.log("[contact-summary] No user returned from getUser");
  } else {
    console.log("[contact-summary] User verified:", userData.user.id);
  }

  if (userErr || !userData?.user) {
    return jsonError(401, "Invalid or expired session.");
  }

  // ---- 4. Fetch the contact and all its related data -----------------------
  // Use the service-role client for data fetching to bypass RLS. The user
  // is already authenticated; we just need to read data that they may not
  // have direct RLS permission for (e.g. all committees).
  const contactData = await fetchContactData(serviceClient, contactId);
  if (!contactData) {
    return jsonError(404, "Contact not found.");
  }

  // ---- 5. Build the user message and call Claude with streaming ------------
  const userMessage = formatContactDataForPrompt(contactData);

  let claudeStream;
  try {
    claudeStream = await getAnthropic().messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (e) {
    const msg = (e as Error).message ?? "Claude API call failed";
    // Anthropic SDK errors have helpful structure but we keep messaging simple
    return jsonError(502, "Claude API error: " + msg);
  }

  // ---- 6. Stream back to client. After the stream finishes, persist. -------
  const encoder = new TextEncoder();
  let fullText = "";

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }
        controller.close();

        // After streaming completes, save the result to the database.
        // We do this AFTER closing the stream so the user sees the full text
        // immediately; the DB write happens in background.
        if (fullText.trim()) {
          await serviceClient
            .from("contacts")
            .update({
              ai_summary: fullText,
              ai_summary_generated_at: new Date().toISOString(),
            })
            .eq("id", contactId);
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// -----------------------------------------------------------------------------
// System prompt — defines the summary's tone and shape.
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an internal tool helping AMTA (American Mock \
Trial Association) board members and officers quickly orient to who someone \
is in their organization.

When given structured data about a contact, write a 2-3 sentence factual \
summary covering:
  - Their primary affiliation (school + role if known)
  - Their leadership roles in AMTA (officer titles, committee chairs/co-chairs)
  - Other notable AMTA service (committees they're members of, recent activity)

Tone: professional, factual, concise. Like a brief in a board meeting.

Rules:
  - DO NOT speculate or add information not present in the data.
  - DO NOT use phrases like "appears to be" or "likely is" — only state \
    what's verifiable from the data.
  - DO NOT include the contact's email, phone, or other PII unnecessary \
    for orientation.
  - DO group related committee work together rather than listing every \
    committee separately. Example: "serves on multiple Tournament \
    Administration subcommittees including X, Y, and Z."
  - Use full names of committees on first mention. Officer titles should \
    be capitalized (President, Treasurer, Chair).
  - If the contact has no notable AMTA service yet, just describe their \
    affiliation and note they're a contact in the directory.
  - Return only the summary text. No headers, no labels, no preamble.`;

// -----------------------------------------------------------------------------
// Data fetching — pull all relevant relational data for one contact
// -----------------------------------------------------------------------------

type ContactDataBundle = {
  contact: {
    first_name: string;
    last_name: string;
    title: string | null;
    primary_program_name: string | null;
  };
  officer_terms: { officer_type: string; start_date: string; end_date: string | null }[];
  board_terms: { start_date: string; end_date: string | null }[];
  committees: { name: string; position: string }[];
  category_names: string[];
  interaction_stats: { total: number; by_type: Record<string, number> };
};

async function fetchContactData(
  supabase: ReturnType<typeof getServiceClient>,
  contactId: string,
): Promise<ContactDataBundle | null> {
  // Use Promise.all to parallelize all the queries
  const [
    contactRes,
    officerTermsRes,
    boardTermsRes,
    committeeAssignmentsRes,
    committeesRes,
    categoryAssignmentsRes,
    categoriesRes,
    programAffiliationsRes,
    programsRes,
    interactionParticipantsRes,
    interactionsRes,
  ] = await Promise.all([
    supabase
      .from("active_contacts")
      .select("first_name, last_name, title")
      .eq("id", contactId)
      .maybeSingle(),
    supabase
      .from("active_officer_terms")
      .select("officer_type, start_date, end_date")
      .eq("contact_id", contactId),
    supabase
      .from("active_board_terms")
      .select("start_date, end_date")
      .eq("contact_id", contactId),
    supabase
      .from("active_committee_assignments")
      .select("committee_id, position")
      .eq("contact_id", contactId),
    supabase.from("active_committees").select("id, name"),
    supabase
      .from("active_contact_category_assignments")
      .select("category_id")
      .eq("contact_id", contactId),
    supabase.from("active_contact_categories").select("id, name"),
    supabase
      .from("active_program_affiliations")
      .select("program_id, role, start_year, end_year")
      .eq("contact_id", contactId)
      .order("start_year", { ascending: false }),
    supabase.from("active_programs").select("id, name"),
    supabase
      .from("active_interaction_participants")
      .select("interaction_id")
      .eq("contact_id", contactId),
    supabase.from("active_interactions").select("id, type"),
  ]);

  if (!contactRes.data) return null;

  // Resolve committees by joining locally (simpler than a SQL join)
  const committeeNamesById = new Map<string, string>(
    (committeesRes.data ?? []).map((c: any) => [c.id, c.name]),
  );
  const committees = (committeeAssignmentsRes.data ?? [])
    .map((a: any) => ({
      name: committeeNamesById.get(a.committee_id) ?? "Unknown committee",
      position: a.position,
    }))
    .filter((c) => c.name !== "Unknown committee");

  // Resolve categories
  const categoryNamesById = new Map<string, string>(
    (categoriesRes.data ?? []).map((c: any) => [c.id, c.name]),
  );
  const category_names = (categoryAssignmentsRes.data ?? [])
    .map((a: any) => categoryNamesById.get(a.category_id))
    .filter((n): n is string => Boolean(n));

  // Resolve primary program (most recent affiliation)
  const programNamesById = new Map<string, string>(
    (programsRes.data ?? []).map((p: any) => [p.id, p.name]),
  );
  const primary_program_name =
    (programAffiliationsRes.data ?? [])[0]?.program_id
      ? programNamesById.get((programAffiliationsRes.data ?? [])[0].program_id) ?? null
      : null;

  // Aggregate interaction stats by type (no content, just counts)
  const interactionTypesById = new Map<string, string>(
    (interactionsRes.data ?? []).map((i: any) => [i.id, i.type]),
  );
  const userInteractionIds = (interactionParticipantsRes.data ?? []).map(
    (p: any) => p.interaction_id,
  );
  const by_type: Record<string, number> = {};
  for (const id of userInteractionIds) {
    const type = interactionTypesById.get(id);
    if (type) by_type[type] = (by_type[type] ?? 0) + 1;
  }

  return {
    contact: {
      first_name: contactRes.data.first_name,
      last_name: contactRes.data.last_name,
      title: contactRes.data.title ?? null,
      primary_program_name,
    },
    officer_terms: officerTermsRes.data ?? [],
    board_terms: boardTermsRes.data ?? [],
    committees,
    category_names,
    interaction_stats: {
      total: userInteractionIds.length,
      by_type,
    },
  };
}

// -----------------------------------------------------------------------------
// Prompt formatting — turn the data bundle into a user message for Claude
// -----------------------------------------------------------------------------

function formatContactDataForPrompt(d: ContactDataBundle): string {
  const lines: string[] = [];
  const c = d.contact;

  lines.push(`Name: ${c.first_name} ${c.last_name}`);
  if (c.title) lines.push(`Title: ${c.title}`);
  if (c.primary_program_name) {
    lines.push(`Primary affiliation: ${c.primary_program_name}`);
  }

  if (d.officer_terms.length > 0) {
    lines.push("");
    lines.push("Officer terms:");
    for (const t of d.officer_terms) {
      const role = t.officer_type.replace(/_/g, " ");
      const range = t.end_date
        ? `${t.start_date} to ${t.end_date} (past)`
        : `${t.start_date} to present`;
      lines.push(`  - ${role}: ${range}`);
    }
  }

  if (d.board_terms.length > 0) {
    lines.push("");
    lines.push("Board terms:");
    for (const t of d.board_terms) {
      const range = t.end_date
        ? `${t.start_date} to ${t.end_date} (past)`
        : `${t.start_date} to present`;
      lines.push(`  - ${range}`);
    }
  }

  if (d.committees.length > 0) {
    lines.push("");
    lines.push("Committee assignments:");
    for (const c of d.committees) {
      lines.push(`  - ${c.name}: ${c.position}`);
    }
  }

  if (d.category_names.length > 0) {
    lines.push("");
    lines.push(`Categories: ${d.category_names.join(", ")}`);
  }

  const stats = d.interaction_stats;
  if (stats.total > 0) {
    lines.push("");
    const byTypeStr = Object.entries(stats.by_type)
      .map(([type, count]) => `${count} ${type}${count === 1 ? "" : "s"}`)
      .join(", ");
    lines.push(`Recent activity: ${stats.total} interactions logged (${byTypeStr})`);
  }

  return lines.join("\n");
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
