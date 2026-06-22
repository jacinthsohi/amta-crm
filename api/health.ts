import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/health
 *
 * Public liveness + DB-reachability check for external uptime monitors
 * (UptimeRobot, Better Stack, etc.) and for smoke-testing risky migrations.
 *
 * What it proves:
 *   - the Edge function itself is serving (the platform is up), AND
 *   - Postgres is reachable and executing — it does a real round-trip via
 *     `search_programs_public`, the one RPC already granted to anon (it backs
 *     the public alumni-signup combobox). A plain `select` would only prove
 *     "static site served" or get filtered by RLS; an actual query is the
 *     honest signal.
 *
 * Why it matters here: it catches DB outages AND RLS lockouts — which is
 * exactly the failure mode the permissioning Phase 2 migration risks. Point a
 * monitor at this and a bad policy change pages you instead of a user noticing.
 *
 * Security: public on purpose (uptime monitors can't carry a session). It
 * takes NO input that influences the query, returns NO row data — only a
 * status — and uses the anon key, never the service role.
 *
 * Response: 200 {status:"ok"} when the DB round-trips; 503 {status:"degraded"}
 * when it errors or times out. Monitors key on the HTTP status code.
 */

export const config = {
  runtime: "edge",
};

// How long we wait on the DB before calling it unhealthy. Keeps the health
// check itself fast and bounded — a hung DB must not hang the endpoint.
const DB_TIMEOUT_MS = 5000;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return health(405, "fail", null, "Method not allowed.");
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return health(503, "fail", null, "Server misconfigured: Supabase env not set.");
  }

  const started = Date.now();
  try {
    const anon = createClient(supabaseUrl, anonKey);

    // Real DB round-trip, bounded by a timeout. Empty query is valid and
    // returns at most the top 20 programs; we discard the data and only care
    // whether it succeeded.
    const probe = anon.rpc("search_programs_public", { p_query: "" });
    const timeout = new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(
        () => resolve({ error: { message: `DB check exceeded ${DB_TIMEOUT_MS}ms` } }),
        DB_TIMEOUT_MS,
      ),
    );

    const { error } = await Promise.race([probe, timeout]);
    const latency = Date.now() - started;

    if (error) {
      return health(503, "fail", latency, error.message);
    }
    return health(200, "ok", latency);
  } catch (e) {
    return health(503, "fail", Date.now() - started, (e as Error).message);
  }
}

function health(
  httpStatus: number,
  db: "ok" | "fail",
  latencyMs: number | null,
  detail?: string,
): Response {
  const ok = db === "ok";
  const body = {
    status: ok ? "ok" : "degraded",
    checks: { db },
    ...(latencyMs !== null ? { db_latency_ms: latencyMs } : {}),
    ...(detail ? { detail } : {}),
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      // Public, no sensitive data — allow browser dashboards to read it too.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
