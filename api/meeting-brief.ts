import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/meeting-brief
 *
 * Generates an actionable meeting prep brief for a contact. Unlike
 * /api/contact-summary (which is descriptive: "who is this person"), this
 * endpoint produces structured, scannable context for "I'm meeting them in
 * 30 minutes — what do I need to know?"
 *
 * Request body:
 *   {
 *     contact_id: string,            // required
 *     meeting_context?: string       // optional ("budget discussion", etc.)
 *   }
 *
 * Response: JSON with a structured brief — see BriefSchema below.
 *
 * Auth: Bearer token in Authorization header. 401 otherwise.
 *
 * Pattern notes:
 *   - Uses Claude's tool-use feature for guaranteed structured output. Forced
 *     tool choice means the model MUST call our `submit_brief` tool with a
 *     JSON object matching our schema. This is the most reliable way to get
 *     structured data from a chat-style LLM.
 *   - Persists every brief to public.meeting_briefs for audit trail + last-brief
 *     display.
 *   - Two Supabase clients (anon for JWT verify, service-role for data fetch)
 *     same as /api/contact-summary.
 */

export const config = {
  runtime: "edge",
};

// -----------------------------------------------------------------------------
// Lazy clients
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
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey)
    throw new Error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set");
  return createClient(url, anonKey);
}

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sk)
    throw new Error("VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, sk);
}

// -----------------------------------------------------------------------------
// Tool schema — forces Claude to return structured JSON
// -----------------------------------------------------------------------------

const SUBMIT_BRIEF_TOOL = {
  name: "submit_brief",
  description:
    "Submit the structured meeting prep brief. Call this exactly once with all sections filled in.",
  input_schema: {
    type: "object",
    properties: {
      who_they_are: {
        type: "string",
        description:
          "1-2 sentence orientation. Their primary role/affiliation. Like a brief introduction at a meeting.",
      },
      your_history: {
        type: "string",
        description:
          "1-2 sentences on the existing relationship: how long, in what capacity, any notable shared work. If none, say so plainly.",
      },
      recent_activity: {
        type: "array",
        description:
          "3-5 bullet points of concrete recent activity from the data: interactions, events, committee work, tasks. Most recent first. Each bullet is one factual sentence.",
        items: { type: "string" },
      },
      open_threads: {
        type: "array",
        description:
          "Open items that may come up: unfinished tasks, recent unresolved interactions, things the contact has flagged. Empty array if none.",
        items: { type: "string" },
      },
      talking_points: {
        type: "array",
        description:
          "3-5 suggested topics for the meeting. Should be informed by the data and (if provided) the meeting context. Phrased as things to ask or raise, not statements.",
        items: { type: "string" },
      },
    },
    required: [
      "who_they_are",
      "your_history",
      "recent_activity",
      "open_threads",
      "talking_points",
    ],
  },
} as const;

// Mirror the tool input as a TS type so we can validate Claude's output.
interface MeetingBrief {
  who_they_are: string;
  your_history: string;
  recent_activity: string[];
  open_threads: string[];
  talking_points: string[];
}

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError(405, "Method not allowed. Use POST.");
  }

  // ---- 1. Auth -------------------------------------------------------------
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(401, "Missing or malformed Authorization header.");
  }

  // ---- 2. Parse body -------------------------------------------------------
  let contactId: string;
  let meetingContext: string | null = null;
  try {
    const body = (await request.json()) as {
      contact_id?: unknown;
      meeting_context?: unknown;
    };
    if (typeof body.contact_id !== "string" || !body.contact_id) {
      return jsonError(400, "Request body must include 'contact_id' (string).");
    }
    contactId = body.contact_id;
    if (typeof body.meeting_context === "string") {
      const trimmed = body.meeting_context.trim();
      meetingContext = trimmed.length > 0 ? trimmed.slice(0, 500) : null;
    }
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  // ---- 3. Verify JWT -------------------------------------------------------
  let anonClient, serviceClient;
  try {
    anonClient = getAnonClient();
    serviceClient = getServiceClient();
  } catch (e) {
    return jsonError(500, "Server misconfigured: " + (e as Error).message);
  }

  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } =
    await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonError(401, "Invalid or expired session.");
  }

  // Find the requesting user's contact_id (used for `generated_by` audit)
  const { data: requesterContact } = await serviceClient
    .from("active_contacts")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  const generatedById = requesterContact?.id ?? null;

  // ---- 4. Fetch the target contact's data ----------------------------------
  const data = await fetchBriefData(serviceClient, contactId);
  if (!data) {
    return jsonError(404, `Contact not found: ${contactId}`);
  }

  // ---- 5. Build prompt + call Claude with forced tool use ------------------
  const userMessage = formatBriefPrompt(data, meetingContext);

  let response;
  try {
    response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_BRIEF_TOOL],
      tool_choice: { type: "tool", name: "submit_brief" },
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (e) {
    const msg = (e as Error).message ?? "Claude API call failed";
    return jsonError(502, "Claude API error: " + msg);
  }

  // Find the tool_use block in the response (forced tool_choice guarantees one)
  const toolUseBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    return jsonError(
      502,
      `Claude response missing tool_use block. Stop reason: ${response.stop_reason}. ` +
        `Content: ${JSON.stringify(response.content).slice(0, 500)}`,
    );
  }

  const brief = toolUseBlock.input as MeetingBrief;

  // Defensive: validate shape (Claude usually nails this with forced tools,
  // but better to surface a clear error than silently render garbage)
  if (
    typeof brief.who_they_are !== "string" ||
    typeof brief.your_history !== "string" ||
    !Array.isArray(brief.recent_activity) ||
    !Array.isArray(brief.open_threads) ||
    !Array.isArray(brief.talking_points)
  ) {
    return jsonError(
      502,
      `Brief shape invalid: ${JSON.stringify(brief).slice(0, 500)}`,
    );
  }

  // ---- 6. Persist (audit trail) --------------------------------------------
  const { error: insertErr } = await serviceClient.from("meeting_briefs").insert({
    contact_id: contactId,
    generated_by: generatedById,
    meeting_context: meetingContext,
    brief: brief,
  });
  if (insertErr) {
    // Don't fail the request — the brief is generated and useful. Just log.
    console.error("[meeting-brief] insert failed:", insertErr);
  }

  // ---- 7. Return -----------------------------------------------------------
  return new Response(JSON.stringify(brief), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

// -----------------------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a meeting prep assistant for AMTA (American \
Mock Trial Association) board members and officers. Your job is to help them \
walk into a 1:1 meeting with full context on the person they're meeting.

You will be given structured data about a contact: their roles, history, \
recent interactions, open tasks, and committee work. You may also be given \
optional context about the meeting itself.

Call the submit_brief tool exactly once with these sections:

- who_they_are: 1-2 sentence orientation. Lead with their primary affiliation \
  (school + role) and most senior AMTA position. Keep it factual.

- your_history: 1-2 sentences. How long they've been involved, in what \
  capacities, any notable shared work. If the data shows no significant \
  shared history, say plainly: "No notable shared history yet — this may be \
  a first substantive meeting."

- recent_activity: 3-5 bullets, most recent first. Pull from the actual \
  interactions, events, and tasks in the data. Each bullet is ONE factual \
  sentence. Include dates where available. Don't invent.

- open_threads: ONLY items that genuinely need follow-up — open tasks \
  involving them, unresolved questions from recent interactions, things they \
  flagged. Empty array if there are none. Don't pad.

- talking_points: 3-5 suggested topics for the meeting. These should be \
  informed by the data AND, if provided, the specific meeting_context. \
  Phrase as questions or topics to raise, not as statements. If the meeting \
  context mentions a specific topic (budget, recruiting, etc.), the talking \
  points should center on that topic. If no context is given, draw from \
  recent activity and open threads.

CRITICAL RULES:
- Never invent facts. If the data is sparse, the brief should be sparse.
- Never speculate about feelings or motivations.
- Use the contact's first name in talking_points (more natural for a meeting).
- Don't include their email/phone — those are visible elsewhere on the page.
- If meeting_context is null, generate a general-purpose brief without \
  pretending you have specific topic context.`;

// -----------------------------------------------------------------------------
// Data fetching — pull broad relational data for the brief
// -----------------------------------------------------------------------------

type BriefDataBundle = {
  contact: {
    first_name: string;
    last_name: string;
    pronouns: string | null;
    primary_program: string | null;
    standing: string | null;
    categories: string[];
  };
  officer_terms: {
    officer_type: string;
    start_date: string;
    end_date: string | null;
  }[];
  committees: { name: string; position: string }[];
  recent_interactions: {
    type: string;
    subject: string;
    occurred_at: string;
    notes_excerpt: string;
  }[];
  open_tasks: {
    title: string;
    status: string;
    priority: string | null;
    due_date: string | null;
  }[];
  recent_events: { name: string; role: string; start_date: string }[];
};

async function fetchBriefData(
  supabase: ReturnType<typeof getServiceClient>,
  contactId: string,
): Promise<BriefDataBundle | null> {
  // Fetch contact + all relations in parallel
  const [
    contactRes,
    officerTermsRes,
    committeeAssignmentsRes,
    committeesRes,
    categoryAssignmentsRes,
    categoriesRes,
    programAffiliationsRes,
    programsRes,
    interactionParticipantsRes,
    interactionsRes,
    tasksRes,
    eventStaffRes,
    eventsRes,
  ] = await Promise.all([
    supabase
      .from("active_contacts")
      .select("first_name, last_name, pronouns, standing")
      .eq("id", contactId)
      .maybeSingle(),
    supabase
      .from("active_officer_terms")
      .select("officer_type, start_date, end_date")
      .eq("contact_id", contactId)
      .order("start_date", { ascending: false }),
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
      .select("program_id, start_year, end_year")
      .eq("contact_id", contactId)
      .order("start_year", { ascending: false }),
    supabase.from("active_programs").select("id, name"),
    supabase
      .from("active_interaction_participants")
      .select("interaction_id")
      .eq("contact_id", contactId),
    supabase
      .from("active_interactions")
      .select("id, type, subject, notes, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("active_tasks")
      .select("title, status, priority, due_date, assigned_to")
      .eq("assigned_to", contactId)
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(20),
    supabase
      .from("active_event_staff")
      .select("event_id, role")
      .eq("contact_id", contactId),
    supabase
      .from("active_events")
      .select("id, name, start_date")
      .order("start_date", { ascending: false })
      .limit(50),
  ]);

  if (!contactRes.data) return null;

  // Categories
  const categoryNamesById = new Map<string, string>(
    (categoriesRes.data ?? []).map((c: any) => [c.id, c.name]),
  );
  const categories = (categoryAssignmentsRes.data ?? [])
    .map((a: any) => categoryNamesById.get(a.category_id))
    .filter((n): n is string => Boolean(n));

  // Primary program (most recent affiliation)
  const programNamesById = new Map<string, string>(
    (programsRes.data ?? []).map((p: any) => [p.id, p.name]),
  );
  const firstAff = (programAffiliationsRes.data ?? [])[0];
  const primary_program = firstAff
    ? programNamesById.get(firstAff.program_id) ?? null
    : null;

  // Committees
  const committeeNamesById = new Map<string, string>(
    (committeesRes.data ?? []).map((c: any) => [c.id, c.name]),
  );
  const committees = (committeeAssignmentsRes.data ?? [])
    .map((a: any) => ({
      name: committeeNamesById.get(a.committee_id) ?? "Unknown",
      position: a.position,
    }))
    .filter((c) => c.name !== "Unknown");

  // Recent interactions involving this contact
  const interactionsById = new Map<string, any>(
    (interactionsRes.data ?? []).map((i: any) => [i.id, i]),
  );
  const userInteractionIds = (interactionParticipantsRes.data ?? []).map(
    (p: any) => p.interaction_id,
  );
  const recent_interactions = userInteractionIds
    .map((id) => interactionsById.get(id))
    .filter(Boolean)
    .sort(
      (a: any, b: any) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )
    .slice(0, 8) // top 8 most recent
    .map((i: any) => ({
      type: i.type,
      subject: i.subject ?? "",
      occurred_at: i.occurred_at,
      notes_excerpt: stripHtmlAndTruncate(i.notes, 240),
    }));

  // Open tasks
  const open_tasks = (tasksRes.data ?? []).map((t: any) => ({
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
  }));

  // Recent events they staffed
  const eventsById = new Map<string, any>(
    (eventsRes.data ?? []).map((e: any) => [e.id, e]),
  );
  const recent_events = (eventStaffRes.data ?? [])
    .map((s: any) => {
      const e = eventsById.get(s.event_id);
      if (!e) return null;
      return { name: e.name, role: s.role, start_date: e.start_date };
    })
    .filter((e): e is { name: string; role: string; start_date: string } =>
      Boolean(e),
    )
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    )
    .slice(0, 6);

  return {
    contact: {
      first_name: contactRes.data.first_name,
      last_name: contactRes.data.last_name,
      pronouns: contactRes.data.pronouns,
      primary_program,
      standing: contactRes.data.standing,
      categories,
    },
    officer_terms: officerTermsRes.data ?? [],
    committees,
    recent_interactions,
    open_tasks,
    recent_events,
  };
}

function stripHtmlAndTruncate(
  html: string | null | undefined,
  maxLen: number,
): string {
  if (!html) return "";
  const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen).trim() + "…";
}

// -----------------------------------------------------------------------------
// Prompt formatting
// -----------------------------------------------------------------------------

function formatBriefPrompt(
  d: BriefDataBundle,
  meetingContext: string | null,
): string {
  const lines: string[] = [];
  const c = d.contact;

  lines.push(`# Contact`);
  lines.push(`Name: ${c.first_name} ${c.last_name}${c.pronouns ? ` (${c.pronouns})` : ""}`);
  if (c.primary_program) lines.push(`Primary affiliation: ${c.primary_program}`);
  if (c.categories.length > 0) lines.push(`Categories: ${c.categories.join(", ")}`);
  if (c.standing) lines.push(`Board standing: ${c.standing}`);

  if (d.officer_terms.length > 0) {
    lines.push("");
    lines.push("# Officer history");
    for (const t of d.officer_terms) {
      const role = t.officer_type.replace(/_/g, " ");
      const range = t.end_date
        ? `${t.start_date} to ${t.end_date}`
        : `${t.start_date} to present`;
      lines.push(`- ${role}: ${range}`);
    }
  }

  if (d.committees.length > 0) {
    lines.push("");
    lines.push("# Committee work");
    for (const c of d.committees) {
      lines.push(`- ${c.name} (${c.position})`);
    }
  }

  if (d.recent_interactions.length > 0) {
    lines.push("");
    lines.push("# Recent interactions (most recent first)");
    for (const i of d.recent_interactions) {
      const datePart = i.occurred_at.slice(0, 10);
      lines.push(`- ${datePart} (${i.type}): ${i.subject}`);
      if (i.notes_excerpt) lines.push(`    Notes: ${i.notes_excerpt}`);
    }
  }

  if (d.open_tasks.length > 0) {
    lines.push("");
    lines.push("# Open tasks assigned to them");
    for (const t of d.open_tasks) {
      const due = t.due_date ? ` (due ${t.due_date})` : "";
      const pri = t.priority ? ` [${t.priority}]` : "";
      lines.push(`- ${t.title}${pri} — ${t.status}${due}`);
    }
  }

  if (d.recent_events.length > 0) {
    lines.push("");
    lines.push("# Recent events");
    for (const e of d.recent_events) {
      lines.push(`- ${e.start_date}: ${e.name} (${e.role})`);
    }
  }

  if (meetingContext) {
    lines.push("");
    lines.push("# Meeting context (provided by the user)");
    lines.push(meetingContext);
  } else {
    lines.push("");
    lines.push("# Meeting context");
    lines.push("(none provided — generate a general-purpose brief)");
  }

  return lines.join("\n");
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
