// admin-source-toggle-enabled (Phase 3E-2E):
// Admin-only action that flips `event_sources.enabled` on ONE source, plus an
// append-only audit line in `notes`. Nothing else is touched.
//
// Allowed writes (event_sources ONLY):
//   enabled
//   notes
//
// NEVER touches:
//   - public.events (no insert/update/delete)
//   - event_sources.robots_ok
//   - event_sources.write_confirmed_at / write_confirmed_by
//   - event_sources.adapter_key / base_url / slug
//   - scrape-source (no ingestion is triggered)
//
// Preconditions:
//   - When enabling: robots_ok must be true; otherwise 409 robots_not_confirmed.
//
// Auth: Authorization: Bearer <user JWT>. Admin role required via has_role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

function sanitizeNote(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\r\n\t]+/g, " ").trim().slice(0, 500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "server_misconfig" }, 500);
  }

  // authn
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);
  const adminUserId = userData.user.id;
  const adminEmail = userData.user.email ?? null;

  // authz: admin role
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: hasAdmin, error: roleErr } = await adminClient.rpc("has_role", {
    _user_id: adminUserId,
    _role: "admin",
  });
  if (roleErr || !hasAdmin) return json({ error: "forbidden" }, 403);

  // input
  let body: { sourceId?: string; enabled?: boolean; note?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const sourceId = body?.sourceId;
  if (!sourceId || typeof sourceId !== "string" || !UUID_RE.test(sourceId)) {
    return json({ error: "sourceId_required" }, 400);
  }
  if (typeof body.enabled !== "boolean") {
    return json({ error: "enabled_required_boolean" }, 400);
  }
  const note = sanitizeNote(body.note);

  // load current
  const { data: current, error: loadErr } = await adminClient
    .from("event_sources")
    .select("id, slug, name, notes, enabled, robots_ok, write_confirmed_at")
    .eq("id", sourceId)
    .maybeSingle();
  if (loadErr || !current) return json({ error: "source_not_found" }, 404);

  const row = current as {
    id: string;
    slug: string;
    name: string;
    notes: string | null;
    enabled: boolean;
    robots_ok: boolean;
    write_confirmed_at: string | null;
  };

  // precondition: cannot enable if robots not confirmed
  if (body.enabled === true && row.robots_ok !== true) {
    return json({ error: "robots_not_confirmed" }, 409);
  }

  const stamp = new Date().toISOString();
  const actor = adminEmail ?? adminUserId;
  const action = body.enabled ? "source_enabled" : "source_disabled";
  const auditLine = note
    ? `[${stamp}] ${action} by ${actor}: ${note}`
    : `[${stamp}] ${action} by ${actor}`;
  const prevNotes = row.notes ?? "";
  const nextNotes = prevNotes
    ? `${prevNotes}\n${auditLine}`.slice(0, 4000)
    : auditLine;

  // write ONLY enabled + notes.
  const { data: updated, error: updErr } = await adminClient
    .from("event_sources")
    .update({ enabled: body.enabled, notes: nextNotes })
    .eq("id", sourceId)
    .select("id, slug, name, enabled")
    .single();
  if (updErr || !updated) {
    return json({ error: "update_failed", detail: updErr?.message ?? null }, 500);
  }

  const out = updated as {
    id: string;
    slug: string;
    name: string;
    enabled: boolean;
  };

  return json({
    ok: true,
    sourceId: out.id,
    slug: out.slug,
    name: out.name,
    enabled: out.enabled,
    action,
    generatedAt: stamp,
  });
});
