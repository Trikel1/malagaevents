// Admin-authenticated proxy: run one sports source (by slug) through sync-sports-normalized.
// - Validates JWT + admin role.
// - Forwards to sync-sports-normalized with x-sync-key (server-side only).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const syncKey = Deno.env.get("SYNC_SPORTS_KEY");
  if (!syncKey) return json({ error: "server_misconfigured" }, 500);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: hasAdmin } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!hasAdmin) return json({ error: "forbidden" }, 403);

  let body: { slug?: string; feedUrl?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const slug = (body.slug ?? "").trim();
  if (!slug && !body.feedUrl) return json({ error: "missing_slug_or_feedUrl" }, 400);

  const target = `${supabaseUrl}/functions/v1/sync-sports-normalized`;
  const resp = await fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sync-key": syncKey },
    body: JSON.stringify({ slug, feedUrl: body.feedUrl, adapter: "json" }),
  });
  let payload: unknown;
  try { payload = await resp.json(); } catch { payload = { error: "invalid_response" }; }
  return json({ ok: resp.ok, result: payload }, resp.ok ? 200 : 502);
});
