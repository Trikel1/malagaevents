/**
 * One-shot trigger for sync-sports. No auth required.
 * Reads SYNC_SPORTS_KEY from env and proxies to sync-sports.
 * Should be deleted after testing.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const syncKey = Deno.env.get("SYNC_SPORTS_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!syncKey || !supabaseUrl) {
    return new Response(
      JSON.stringify({ error: "Missing env vars" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const slug = body.slug || undefined;
  const searchOnly = body.searchOnly || false;

  console.log(`[trigger-sync] Calling sync-sports slug=${slug || "ALL"} searchOnly=${searchOnly}...`);

  const response = await fetch(`${supabaseUrl}/functions/v1/sync-sports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-key": syncKey,
    },
    body: JSON.stringify({ slug, force: true, cooldownMinutes: 0, searchOnly }),
  });

  const data = await response.json();
  console.log(`[trigger-sync] Result:`, JSON.stringify(data));

  return new Response(
    JSON.stringify(data),
    { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
