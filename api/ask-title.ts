import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/ask-title
 *
 * Given a user question and assistant answer, generate a short
 * (3-5 word) title for the conversation. Used by the Ask page
 * to populate sidebar entries automatically.
 *
 * Request body: { user_question: string, assistant_answer: string }
 * Response:     { title: string }
 *
 * This is a separate (cheaper) endpoint rather than baked into /api/ask
 * so we can run it asynchronously after the user already has their answer.
 */

export const config = {
  runtime: "edge",
};

let anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError(405, "Method not allowed.");
  }

  // Auth check
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError(401, "Missing Authorization header.");
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return jsonError(500, "Server misconfigured.");
  }

  const anonClient = createClient(supabaseUrl, anonKey);
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonError(401, "Invalid or expired session.");
  }

  // Parse body
  let body: { user_question?: string; assistant_answer?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  if (!body.user_question || !body.assistant_answer) {
    return jsonError(400, "Need user_question and assistant_answer.");
  }

  // Generate title
  try {
    const response = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001", // Fast + cheap for this small task
      max_tokens: 30,
      system:
        "You generate short conversation titles for an AI search interface. " +
        "Given a user question and the AI's answer, return a 3-6 word title " +
        "that captures what the conversation is about. " +
        "No quotes, no punctuation at the end. Just the title text.",
      messages: [
        {
          role: "user",
          content: `Question: ${body.user_question}\n\nAnswer: ${body.assistant_answer.slice(0, 500)}\n\nTitle:`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text") as
      | { type: "text"; text: string }
      | undefined;
    const title = textBlock?.text?.trim() ?? "New conversation";

    return new Response(JSON.stringify({ title }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return jsonError(502, "Title generation failed: " + (e as Error).message);
  }
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
