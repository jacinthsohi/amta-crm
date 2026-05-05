import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/extract-event-pdf
 *
 * Takes an uploaded PDF (tournament packet, welcome packet, etc.) and
 * extracts structured event data using Claude's PDF reading capability.
 *
 * Request: multipart/form-data with a "file" field containing the PDF
 * Response: structured JSON with extracted fields and per-field confidence
 *
 * The flow this enables:
 *   1. User uploads packet PDF
 *   2. Frontend POSTs file to this endpoint
 *   3. Claude reads PDF natively (vision + text), returns structured data
 *   4. Frontend pre-fills an event form with the data
 *   5. User reviews and saves → creates event + event_documents record
 *
 * Why Edge runtime: native streaming + smaller cold starts than Node.
 * Why no streaming response: extraction is one-shot — we run Claude once
 *   and return the full result. No reason to stream a JSON object.
 */

export const config = {
  runtime: "edge",
};

// Anthropic API has a ~32MB request limit. PDFs are base64 encoded which
// inflates by ~33%. Limit raw PDFs to 20MB to leave headroom.
const MAX_PDF_BYTES = 20 * 1024 * 1024;

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
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL or anon key not set");
  return createClient(url, key);
}

// -----------------------------------------------------------------------------
// Extraction system prompt
// -----------------------------------------------------------------------------

/**
 * Notes on prompt design:
 *
 * 1. We tell Claude exactly what fields we want and the JSON shape.
 * 2. We tell it to use null when uncertain, not to invent data.
 * 3. We ask for a `confidence` score per field so the UI can highlight
 *    fields that need human review.
 * 4. We ask for a brief `extraction_notes` field that explains anything
 *    unusual — useful for debugging and for the user to understand what
 *    Claude did or couldn't do.
 *
 * The schema mirrors the events table fields PLUS host program (which is
 * a separate relation but commonly mentioned in packets).
 */
const SYSTEM_PROMPT = `You are an extraction assistant for AMTA (American \
Mock Trial Association). The user will provide a tournament packet PDF — a \
document an institution sends out when hosting a mock trial tournament. \
Your job is to extract structured event metadata from the document.

You must return a JSON object with EXACTLY this shape:

{
  "name": string | null,
  "start_date": string | null,        // YYYY-MM-DD format
  "end_date": string | null,          // YYYY-MM-DD format
  "location_city": string | null,
  "location_state": string | null,    // 2-letter abbreviation if US
  "location_venue": string | null,    // specific building/courthouse name if mentioned
  "host_program_name": string | null, // school/university name
  "description": string | null,       // 2-3 sentence summary of what this tournament is
  "registration_deadline": string | null, // YYYY-MM-DD
  "max_teams": number | null,
  "fee_per_team": number | null,      // in USD, just the number
  "tournament_director": string | null, // name only, no title
  "confidence": {
    "name": "high" | "medium" | "low",
    "start_date": "high" | "medium" | "low",
    "end_date": "high" | "medium" | "low",
    "location_city": "high" | "medium" | "low",
    "location_state": "high" | "medium" | "low",
    "location_venue": "high" | "medium" | "low",
    "host_program_name": "high" | "medium" | "low",
    "description": "high" | "medium" | "low",
    "registration_deadline": "high" | "medium" | "low",
    "max_teams": "high" | "medium" | "low",
    "fee_per_team": "high" | "medium" | "low",
    "tournament_director": "high" | "medium" | "low"
  },
  "extraction_notes": string  // brief explanation of anything unusual or unclear
}

RULES:
- Use null for any field not mentioned or unclear in the document.
- Do not invent data. If a field is not in the document, use null.
- For confidence, use "high" if the field is stated explicitly, "medium" \
  if inferred from context, "low" if you're guessing.
- Always provide ALL fields including all confidence keys, even if values \
  are null.
- The "description" should be a fresh, neutral 2-3 sentence summary you \
  write, not a copy from the document. Mention the tournament type \
  (regional, ORCS, NCT, invitational), host, dates, and notable details.
- Tournament name should be the official name (e.g., "41st National \
  Championship Tournament", "Yale Bulldog Invitational", "Hamilton \
  Regional").
- Dates: many tournaments span Friday-Sunday. Extract both start and end. \
  If only one date is given, use it for both.
- max_teams: look for phrases like "limited to 24 teams" or "capacity of 32 teams".
- fee_per_team: extract the registration fee. If multiple tiers \
  (early bird etc.), use the standard/full price.

OUTPUT: Return ONLY the JSON object. No preamble, no markdown code fences, \
no explanation outside the JSON. The response should be parseable directly \
with JSON.parse().`;

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError(405, "Method not allowed.");
  }

  // Auth
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError(401, "Missing Authorization header.");
  }

  // Verify JWT
  let anonClient;
  try {
    anonClient = getAnonClient();
  } catch (e) {
    return jsonError(500, "Server misconfigured: " + (e as Error).message);
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonError(401, "Invalid or expired session.");
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "Failed to parse form data. Send as multipart/form-data.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "No 'file' field in form data.");
  }

  if (file.size > MAX_PDF_BYTES) {
    return jsonError(
      413,
      `PDF too large (${formatBytes(file.size)}). Maximum is ${formatBytes(MAX_PDF_BYTES)}.`,
    );
  }

  if (file.type !== "application/pdf") {
    return jsonError(415, `Unsupported file type: ${file.type}. Only PDF is accepted.`);
  }

  // Convert PDF to base64
  const fileArrayBuffer = await file.arrayBuffer();
  const fileBase64 = arrayBufferToBase64(fileArrayBuffer);

  // Call Claude with the PDF
  let response;
  try {
    response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: fileBase64,
              },
            },
            {
              type: "text",
              text: "Please extract event metadata from this tournament packet according to the JSON schema in your system prompt.",
            },
          ],
        },
      ],
    });
  } catch (e) {
    const msg = (e as Error).message ?? "Unknown error";
    return jsonError(502, "Claude API error: " + msg);
  }

  // Extract text content from response
  const textBlock = response.content.find((b) => b.type === "text") as
    | { type: "text"; text: string }
    | undefined;

  if (!textBlock) {
    return jsonError(502, "No text response from Claude.");
  }

  // Parse the JSON. Be defensive — Claude sometimes wraps in code fences
  // despite our instructions.
  let extracted;
  try {
    const cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```\s*$/, "");
    extracted = JSON.parse(cleaned);
  } catch (e) {
    return jsonError(
      502,
      "Failed to parse Claude's response as JSON. Raw response: " +
        textBlock.text.slice(0, 500),
    );
  }

  return new Response(
    JSON.stringify({
      extracted,
      filename: file.name,
      file_size: file.size,
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

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

/**
 * Convert an ArrayBuffer to base64. Doing this in the Edge runtime is
 * tricky because Node's Buffer isn't available. We use chunked btoa.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Process in chunks to avoid stack overflow on large files
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
