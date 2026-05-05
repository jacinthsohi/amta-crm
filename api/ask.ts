import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/ask
 *
 * Smart contact search powered by Claude with tool use. The user asks a
 * natural-language question; Claude has access to a set of tools to query
 * the CRM database and reasons across multiple calls before responding.
 *
 * This is an "agentic loop": we send Claude the user's question, Claude
 * may respond with tool_use blocks asking for data, we execute the tools,
 * feed results back, and repeat until Claude responds with a final text
 * answer (no more tool calls).
 *
 * Request body:
 *   {
 *     messages: Anthropic.MessageParam[]  // Conversation history
 *   }
 *
 * Response:
 *   {
 *     final_text: string,                  // Claude's prose answer
 *     contact_ids: string[],               // Contact IDs mentioned (for cards)
 *     tool_calls: ToolCallRecord[],        // Trace of tool calls for UI
 *     full_messages: Anthropic.MessageParam[]  // Updated conversation
 *   }
 *
 * The full_messages can be sent back in the next request to continue the
 * conversation.
 *
 * Env vars: same as contact-summary.ts.
 */

export const config = {
  runtime: "edge",
};

// -----------------------------------------------------------------------------
// Lazy clients (same pattern as contact-summary.ts)
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
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL or anon key not set");
  return createClient(url, key);
}

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URL or service role key not set");
  return createClient(url, key);
}

// -----------------------------------------------------------------------------
// Tool definitions — these are sent to Claude so it knows what's available
// -----------------------------------------------------------------------------

/**
 * Defining tools well is the core skill of building agentic systems.
 * Each tool needs:
 *   - A clear name (verb-noun pattern)
 *   - A description that tells Claude WHEN to use it (not just what it does)
 *   - A precise input_schema with examples in descriptions
 *
 * Claude reads these descriptions to decide which tool to call. Vague
 * descriptions lead to wrong tool selection or unnecessary calls.
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_contacts",
    description:
      "Search for contacts in the AMTA CRM by various filters. Use this when " +
      "the user asks about people in general, or when filtering by board " +
      "status, categories, or affiliations. Returns up to 50 contacts with " +
      "basic info. Use get_contact_details for richer per-contact data.",
    input_schema: {
      type: "object",
      properties: {
        name_query: {
          type: "string",
          description:
            "Optional partial name match (case insensitive). Useful when user " +
            "names a specific person.",
        },
        is_current_board: {
          type: "boolean",
          description:
            "If true, only contacts who are current AMTA board members.",
        },
        category_name: {
          type: "string",
          description:
            "Filter to contacts assigned to a specific category. Categories " +
            "include: 'Current Board Member', 'AMTA Representative', 'Coach', " +
            "'Alumni', etc.",
        },
        program_name: {
          type: "string",
          description:
            "Filter to contacts affiliated with a specific program (school). " +
            "Partial match.",
        },
      },
    },
  },
  {
    name: "get_contact_details",
    description:
      "Get full details for a specific contact, including all committee " +
      "assignments, officer terms, board terms, program affiliations, and " +
      "categories. Use this when you need rich context about a person you've " +
      "already identified.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The UUID of the contact.",
        },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "search_committees",
    description:
      "Search for AMTA committees by name or keyword. AMTA has many " +
      "committees (Tournament Administration, Diversity & Inclusion, " +
      "Development, Budget, Case committees, etc.) each with chairs and " +
      "members. Use this to find which committee handles a topic before " +
      "looking up its members.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search term. Matched against committee names. " +
            "Example queries: 'diversity', 'tournament', 'budget', 'case'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_committee_members",
    description:
      "Get all current members of a specific committee, including their " +
      "positions (Chair, Co-chair, Member). Use this after identifying a " +
      "committee with search_committees.",
    input_schema: {
      type: "object",
      properties: {
        committee_id: {
          type: "string",
          description: "The UUID of the committee.",
        },
      },
      required: ["committee_id"],
    },
  },
];

// -----------------------------------------------------------------------------
// Tool implementations
// -----------------------------------------------------------------------------

type ServiceClient = ReturnType<typeof getServiceClient>;

async function executeSearchContacts(
  supabase: ServiceClient,
  args: {
    name_query?: string;
    is_current_board?: boolean;
    category_name?: string;
    program_name?: string;
  },
): Promise<unknown> {
  let query = supabase
    .from("active_contacts")
    .select("id, first_name, last_name, email, has_board_history")
    .limit(50);

  if (args.name_query) {
    // Case-insensitive partial match on first or last name
    const q = args.name_query.trim();
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  }

  const { data: contacts, error } = await query;
  if (error) return { error: error.message };
  if (!contacts) return { contacts: [] };

  let results = contacts;

  // Filter by category if requested (requires a join — easier in JS at this scale)
  if (args.category_name) {
    const { data: categoryRows } = await supabase
      .from("active_contact_categories")
      .select("id, name")
      .ilike("name", `%${args.category_name}%`);

    if (categoryRows && categoryRows.length > 0) {
      const categoryIds = categoryRows.map((c: any) => c.id);
      const { data: assignments } = await supabase
        .from("active_contact_category_assignments")
        .select("contact_id")
        .in("category_id", categoryIds);

      const contactIdsInCategory = new Set(
        (assignments ?? []).map((a: any) => a.contact_id),
      );
      results = results.filter((c: any) => contactIdsInCategory.has(c.id));
    } else {
      results = [];
    }
  }

  // Filter by current board status
  if (args.is_current_board !== undefined) {
    const { data: currentBoardCategory } = await supabase
      .from("active_contact_categories")
      .select("id")
      .eq("name", "Current Board Member")
      .maybeSingle();

    if (currentBoardCategory) {
      const { data: assignments } = await supabase
        .from("active_contact_category_assignments")
        .select("contact_id")
        .eq("category_id", currentBoardCategory.id);

      const boardIds = new Set(
        (assignments ?? []).map((a: any) => a.contact_id),
      );
      results = results.filter((c: any) =>
        args.is_current_board ? boardIds.has(c.id) : !boardIds.has(c.id),
      );
    }
  }

  // Filter by program affiliation
  if (args.program_name) {
    const { data: programs } = await supabase
      .from("active_programs")
      .select("id, name")
      .ilike("name", `%${args.program_name}%`);

    if (programs && programs.length > 0) {
      const programIds = programs.map((p: any) => p.id);
      const { data: affiliations } = await supabase
        .from("active_program_affiliations")
        .select("contact_id")
        .in("program_id", programIds);

      const affiliatedIds = new Set(
        (affiliations ?? []).map((a: any) => a.contact_id),
      );
      results = results.filter((c: any) => affiliatedIds.has(c.id));
    } else {
      results = [];
    }
  }

  return {
    count: results.length,
    contacts: results.slice(0, 50).map((c: any) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      email: c.email,
      has_board_history: c.has_board_history,
    })),
  };
}

async function executeGetContactDetails(
  supabase: ServiceClient,
  args: { contact_id: string },
): Promise<unknown> {
  const { data: contact, error } = await supabase
    .from("active_contacts")
    .select("id, first_name, last_name, email, phone, ai_summary")
    .eq("id", args.contact_id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!contact) return { error: "Contact not found" };

  // Parallel-fetch all relations
  const [
    officerTermsRes,
    boardTermsRes,
    committeeAssignmentsRes,
    committeesRes,
    categoryAssignmentsRes,
    categoriesRes,
    programAffiliationsRes,
    programsRes,
  ] = await Promise.all([
    supabase
      .from("active_officer_terms")
      .select("officer_type, start_date, end_date")
      .eq("contact_id", args.contact_id),
    supabase
      .from("active_board_terms")
      .select("start_date, end_date")
      .eq("contact_id", args.contact_id),
    supabase
      .from("active_committee_assignments")
      .select("committee_id, position")
      .eq("contact_id", args.contact_id),
    supabase.from("active_committees").select("id, name"),
    supabase
      .from("active_contact_category_assignments")
      .select("category_id")
      .eq("contact_id", args.contact_id),
    supabase.from("active_contact_categories").select("id, name"),
    supabase
      .from("active_program_affiliations")
      .select("program_id, affiliation_type, start_year, end_year")
      .eq("contact_id", args.contact_id),
    supabase.from("active_programs").select("id, name"),
  ]);

  const committeeNamesById = new Map(
    (committeesRes.data ?? []).map((c: any) => [c.id, c.name]),
  );
  const committees = (committeeAssignmentsRes.data ?? [])
    .map((a: any) => ({
      name: committeeNamesById.get(a.committee_id) ?? "Unknown",
      position: a.position,
    }))
    .filter((c) => c.name !== "Unknown");

  const categoryNamesById = new Map(
    (categoriesRes.data ?? []).map((c: any) => [c.id, c.name]),
  );
  const categories = (categoryAssignmentsRes.data ?? [])
    .map((a: any) => categoryNamesById.get(a.category_id))
    .filter((n): n is string => Boolean(n));

  const programNamesById = new Map(
    (programsRes.data ?? []).map((p: any) => [p.id, p.name]),
  );
  const programs = (programAffiliationsRes.data ?? []).map((a: any) => ({
    name: programNamesById.get(a.program_id) ?? "Unknown",
    affiliation_type: a.affiliation_type,
    start_year: a.start_year,
    end_year: a.end_year,
  }));

  return {
    id: contact.id,
    name: `${contact.first_name} ${contact.last_name}`,
    email: contact.email,
    phone: contact.phone,
    ai_summary: contact.ai_summary,
    officer_terms: officerTermsRes.data ?? [],
    board_terms: boardTermsRes.data ?? [],
    committees,
    categories,
    programs,
  };
}

async function executeSearchCommittees(
  supabase: ServiceClient,
  args: { query: string },
): Promise<unknown> {
  const { data, error } = await supabase
    .from("active_committees")
    .select("id, name, parent_committee_id")
    .ilike("name", `%${args.query}%`)
    .limit(20);

  if (error) return { error: error.message };

  return {
    count: data?.length ?? 0,
    committees: (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      is_subcommittee: c.parent_committee_id !== null,
    })),
  };
}

async function executeGetCommitteeMembers(
  supabase: ServiceClient,
  args: { committee_id: string },
): Promise<unknown> {
  const { data: assignments, error } = await supabase
    .from("active_committee_assignments")
    .select("contact_id, position")
    .eq("committee_id", args.committee_id);

  if (error) return { error: error.message };
  if (!assignments || assignments.length === 0) {
    return { committee_id: args.committee_id, members: [] };
  }

  const contactIds = assignments.map((a: any) => a.contact_id);
  const { data: contacts } = await supabase
    .from("active_contacts")
    .select("id, first_name, last_name, email")
    .in("id", contactIds);

  const contactsById = new Map(
    (contacts ?? []).map((c: any) => [c.id, c]),
  );

  const members = assignments
    .map((a: any) => {
      const c = contactsById.get(a.contact_id) as any;
      if (!c) return null;
      return {
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        email: c.email,
        position: a.position,
      };
    })
    .filter(Boolean);

  return {
    committee_id: args.committee_id,
    count: members.length,
    members,
  };
}

// -----------------------------------------------------------------------------
// Tool dispatcher
// -----------------------------------------------------------------------------

async function executeTool(
  supabase: ServiceClient,
  name: string,
  input: any,
): Promise<unknown> {
  switch (name) {
    case "search_contacts":
      return executeSearchContacts(supabase, input);
    case "get_contact_details":
      return executeGetContactDetails(supabase, input);
    case "search_committees":
      return executeSearchCommittees(supabase, input);
    case "get_committee_members":
      return executeGetCommitteeMembers(supabase, input);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// -----------------------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a helpful research assistant for AMTA (American \
Mock Trial Association) board members. You have access to AMTA's internal \
contact database and can answer questions about people in the organization.

You have tools to search contacts, look up committee structures, and get \
detailed information about specific people. Use them to ground your answers \
in real data — never guess or make up information about people.

When answering:
- Use multiple tool calls if needed. For broad questions ("who handles X?"), \
  first identify relevant committees with search_committees, then look up \
  their members.
- Be concise. Lead with the answer, then explain reasoning briefly.
- You may use light markdown (**bold** for names/titles, bullet lists, line \
  breaks for readability). The frontend renders markdown.
- If the data doesn't support a clear answer, say so honestly. Don't \
  speculate beyond what tools return.
- Avoid surfacing PII (phone numbers, personal emails) unless directly \
  relevant to the question.

Tone: helpful, knowledgeable, board-meeting professional. You're like a \
sharp staff member who knows everyone in the organization.

OUTPUT FORMAT:
After your answer, append exactly one final line in this format:

CONTACT_IDS: uuid1, uuid2, uuid3

List up to 8 contact IDs you actually referenced, in relevance order. \
Use plain comma-separated UUIDs (no brackets, no quotes). This line is \
parsed by the UI to render clickable contact cards and will be hidden \
from the user. If you didn't reference any contacts, write: CONTACT_IDS: none`;

// -----------------------------------------------------------------------------
// Agentic loop — the heart of the tool-use pattern
// -----------------------------------------------------------------------------

type ToolCallRecord = {
  tool: string;
  input: any;
  output_summary: string; // Short string for UI display
};

const MAX_ITERATIONS = 10; // Safety cap on tool-use loop

async function runAgenticLoop(
  supabase: ServiceClient,
  messages: Anthropic.MessageParam[],
): Promise<{
  final_text: string;
  tool_calls: ToolCallRecord[];
  full_messages: Anthropic.MessageParam[];
}> {
  const client = getAnthropic();
  const toolCalls: ToolCallRecord[] = [];
  let workingMessages = [...messages];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: workingMessages,
    });

    // Append assistant's response to message history
    workingMessages.push({
      role: "assistant",
      content: response.content,
    });

    // If Claude is done (no tool calls), we're finished
    if (response.stop_reason === "end_turn") {
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      const finalText = textBlocks.map((b) => b.text).join("\n").trim();
      return { final_text: finalText, tool_calls: toolCalls, full_messages: workingMessages };
    }

    // Otherwise, execute any tool_use blocks and feed back results
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(supabase, toolUse.name, toolUse.input);

        // Build a short summary string for the UI
        const summary = summarizeToolCall(toolUse.name, toolUse.input, result);
        toolCalls.push({
          tool: toolUse.name,
          input: toolUse.input,
          output_summary: summary,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Feed tool results back to Claude
      workingMessages.push({
        role: "user",
        content: toolResults,
      });

      // Loop continues — Claude may call more tools or respond
    } else {
      // Unexpected stop reason — break out with whatever we have
      break;
    }
  }

  // If we hit the iteration cap, pull the last text we have
  const lastAssistantMessage = workingMessages
    .filter((m) => m.role === "assistant")
    .pop();
  let fallbackText = "I wasn't able to complete that query. Please try rephrasing.";
  if (lastAssistantMessage && Array.isArray(lastAssistantMessage.content)) {
    const textBlocks = lastAssistantMessage.content.filter(
      (b: any) => b.type === "text",
    ) as { text: string }[];
    if (textBlocks.length > 0) {
      fallbackText = textBlocks.map((b) => b.text).join("\n").trim();
    }
  }
  return {
    final_text: fallbackText,
    tool_calls: toolCalls,
    full_messages: workingMessages,
  };
}

function summarizeToolCall(name: string, input: any, result: any): string {
  if (result && result.error) return `${name}: error — ${result.error}`;
  switch (name) {
    case "search_contacts": {
      const filters: string[] = [];
      if (input.name_query) filters.push(`name "${input.name_query}"`);
      if (input.category_name) filters.push(`category "${input.category_name}"`);
      if (input.is_current_board) filters.push("current board");
      if (input.program_name) filters.push(`program "${input.program_name}"`);
      const filterStr = filters.length > 0 ? filters.join(", ") : "all";
      return `Searched contacts (${filterStr}) — found ${result.count}`;
    }
    case "get_contact_details":
      return `Looked up details for ${result.name ?? "contact"}`;
    case "search_committees":
      return `Searched committees for "${input.query}" — found ${result.count}`;
    case "get_committee_members":
      return `Listed committee members — ${result.count} people`;
    default:
      return name;
  }
}

// -----------------------------------------------------------------------------
// Output post-processing — extract the CONTACT_IDS line from the final text
// -----------------------------------------------------------------------------

function extractContactIds(text: string): {
  cleanText: string;
  contactIds: string[];
} {
  // Match the CONTACT_IDS line. Claude sometimes uses brackets, sometimes
  // doesn't — accept both. Match through end of line OR end of string.
  const match = text.match(/CONTACT_IDS:\s*\[?([^\]\n]*)\]?/);
  if (!match) return { cleanText: text, contactIds: [] };

  const ids = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s));

  // Strip the entire CONTACT_IDS line from the displayed text. Use a
  // multiline-friendly regex that nukes the whole line.
  const cleanText = text
    .replace(/\s*CONTACT_IDS:\s*\[?[^\]\n]*\]?\s*$/m, "")
    .trim();
  return { cleanText, contactIds: ids };
}

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError(405, "Method not allowed. Use POST.");
  }

  // Auth
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError(401, "Missing or malformed Authorization header.");
  }

  // Parse body
  let body: { messages?: Anthropic.MessageParam[] };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError(400, "Request body must include a non-empty 'messages' array.");
  }

  // Verify JWT
  let anonClient, serviceClient;
  try {
    anonClient = getAnonClient();
    serviceClient = getServiceClient();
  } catch (e) {
    return jsonError(500, "Server misconfigured: " + (e as Error).message);
  }

  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonError(401, "Invalid or expired session.");
  }

  // Run the agentic loop
  let result;
  try {
    result = await runAgenticLoop(serviceClient, body.messages);
  } catch (e) {
    const msg = (e as Error).message ?? "Unknown error";
    return jsonError(502, "AI request failed: " + msg);
  }

  // Extract structured contact IDs from the final text
  const { cleanText, contactIds } = extractContactIds(result.final_text);

  return new Response(
    JSON.stringify({
      final_text: cleanText,
      contact_ids: contactIds,
      tool_calls: result.tool_calls,
      full_messages: result.full_messages,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
