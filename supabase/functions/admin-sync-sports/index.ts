import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validate JWT via getClaims
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const syncAdminKey = Deno.env.get("SYNC_ADMIN_KEY");

    if (!syncAdminKey) {
      console.error("SYNC_ADMIN_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User-scoped client to validate the JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;

    // 2. Check admin role via SERVICE_ROLE client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: hasAdmin, error: roleError } = await adminClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (roleError || !hasAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse body params
    let body: { force?: boolean; cooldownMinutes?: number } = {};
    try {
      body = await req.json();
    } catch {
      // default empty body is fine
    }

    // 4. Proxy call to sync-sports with x-admin-key
    const syncUrl = `${supabaseUrl}/functions/v1/sync-sports`;
    const syncResponse = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": syncAdminKey,
      },
      body: JSON.stringify({
        force: body.force ?? true,
        cooldownMinutes: body.cooldownMinutes ?? 0,
      }),
    });

    let syncResult: unknown;
    try {
      syncResult = await syncResponse.json();
    } catch {
      syncResult = { error: "Failed to parse sync response", status: syncResponse.status };
    }

    // 5. Fetch last 10 sports_sync_runs for the admin UI
    const { data: recentRuns, error: runsError } = await adminClient
      .from("sports_sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);

    if (runsError) {
      console.error("Error fetching sync runs:", runsError);
    }

    return new Response(
      JSON.stringify({
        ok: syncResponse.ok,
        syncResult,
        recentRuns: recentRuns || [],
      }),
      {
        status: syncResponse.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("admin-sync-sports error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
