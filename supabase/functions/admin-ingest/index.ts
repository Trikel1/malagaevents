// admin-ingest: authenticated admin proxy for the modular ingestion engine.
//
// - Validates a real Supabase JWT and checks has_role(admin).
// - Forwards to scrape-source or ingest-dispatcher using SYNC_ADMIN_KEY
//   (the shared secret NEVER leaves the server).
// - Only dry-run is exposed unless the caller passes { confirm: true }.
//   Even then, WRITE_ENABLED inside scrape-source still governs actual DB
//   writes — this proxy cannot bypass it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const syncKey = Deno.env.get("SYNC_ADMIN_KEY");
  if (!syncKey) return json({ error: "server_misconfig" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: hasAdmin, error: roleErr } = await adminClient.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleErr || !hasAdmin) return json({ error: "forbidden" }, 403);

  let body: {
    action?: "scrape-source" | "ingest-dispatcher";
    sourceId?: string;
    sourceIds?: string[];
    limit?: number;
    dryRun?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = body.action ?? "ingest-dispatcher";
  // Phase 2A/2B: force dry-run unless caller passes dryRun:false AND
  // WRITE_ENABLED on scrape-source is on. We forward whatever they ask;
  // scrape-source is the final authority.
  const dryRun = body.dryRun !== false;

  let targetPath: string;
  let payload: Record<string, unknown>;

  if (action === "scrape-source") {
    if (!body.sourceId) return json({ error: "sourceId_required" }, 400);
    targetPath = "scrape-source";
    payload = { sourceId: body.sourceId, dryRun };
  } else if (action === "ingest-dispatcher") {
    targetPath = "ingest-dispatcher";
    payload = { dryRun, sourceIds: body.sourceIds, limit: body.limit };
  } else {
    return json({ error: "invalid_action" }, 400);
  }

  const resp = await fetch(`${supabaseUrl}/functions/v1/${targetPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-key": syncKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  });
  const respBody = await resp.text();
  return new Response(respBody, {
    status: resp.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
