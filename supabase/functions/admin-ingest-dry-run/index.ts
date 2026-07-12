// admin-ingest-dry-run: authenticated admin proxy that ALWAYS forces a
// per-source dry-run. Wraps scrape-source using SYNC_ADMIN_KEY server-side
// and returns only a sanitized summary — never secrets, tokens, or headers.
//
// Contract:
//   POST { sourceId: uuid }
//   200 -> {
//     runId?: string,
//     status?: string,
//     dryRun: true,
//     errors?: number,
//     inserted?: number,
//     updated?: number,
//     skippedDupes?: number,
//     previewCount?: number
//   }
//
// Even if a caller tampers with the body, dryRun is hardcoded to true here,
// and scrape-source's WRITE_ENABLED=false still governs any real writes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const syncKey = Deno.env.get("SYNC_ADMIN_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey || !syncKey) {
    return json({ error: "server_misconfig" }, 500);
  }

  // 1. Authenticate the caller via their JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await userClient.auth.getUser(
    token,
  );
  if (userErr || !userData?.user) {
    return json({ error: "invalid_token" }, 401);
  }

  // 2. Enforce admin role via has_role RPC
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: hasAdmin, error: roleErr } = await adminClient.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleErr || !hasAdmin) {
    return json({ error: "forbidden" }, 403);
  }

  // 3. Validate input
  let body: { sourceId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const sourceId = body?.sourceId;
  if (!sourceId || typeof sourceId !== "string" || !UUID_RE.test(sourceId)) {
    return json({ error: "sourceId_required" }, 400);
  }

  // 4. Invoke scrape-source internally with dryRun forced to true.
  //    SYNC_ADMIN_KEY and service key stay server-side.
  let upstream: Response;
  try {
    upstream = await fetch(`${supabaseUrl}/functions/v1/scrape-source`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-key": syncKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sourceId, dryRun: true }),
    });
  } catch (e) {
    return json({ error: "upstream_unreachable", detail: String(e) }, 502);
  }

  const rawText = await upstream.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    parsed = {};
  }

  // 5. Sanitize: only whitelist safe scalar fields. Never echo headers,
  //    tokens, or arbitrary upstream payloads back to the browser.
  const preview = parsed["preview"];
  const previewCount = Array.isArray(preview) ? preview.length : undefined;

  const pickNumber = (k: string) =>
    typeof parsed[k] === "number" ? (parsed[k] as number) : undefined;
  const pickString = (k: string) =>
    typeof parsed[k] === "string" ? (parsed[k] as string) : undefined;

  const safe = {
    ok: upstream.ok,
    dryRun: true as const,
    runId: pickString("runId") ?? pickString("run_id"),
    status: pickString("status"),
    inserted: pickNumber("inserted"),
    updated: pickNumber("updated"),
    skippedDupes: pickNumber("skippedDupes") ?? pickNumber("skipped_dupes"),
    errors: pickNumber("errors"),
    previewCount,
    error: !upstream.ok ? pickString("error") ?? "upstream_error" : undefined,
  };

  return json(safe, upstream.ok ? 200 : upstream.status);
});
