// Generate an illustrative image for an event via Lovable AI (Gemini image),
// upload it to the `event-images-ai` Storage bucket, and update
// `events.image_url` with the public URL.
//
// Auth: requires an authenticated user (Lovable-managed default verify_jwt=false,
// so we validate the JWT in-code and require admin role).
// Body: { eventId: string, force?: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const BUCKET = "event-images-ai";

function buildPrompt(event: {
  title: string;
  category?: string | null;
  description?: string | null;
  venue_name?: string | null;
}): string {
  const parts = [
    `Crea una imagen ilustrativa, moderna y evocadora para un evento cultural en Málaga.`,
    `Título: "${event.title}".`,
    event.category ? `Categoría: ${event.category}.` : "",
    event.venue_name ? `Lugar: ${event.venue_name}.` : "",
    event.description ? `Contexto: ${event.description.slice(0, 240)}.` : "",
    `Estilo: fotografía editorial, iluminación mediterránea cálida, sin texto, sin logotipos, sin marcas de agua, composición 16:9, alta calidad, atmósfera atractiva.`,
  ].filter(Boolean);
  return parts.join(" ");
}

async function generateImageBase64(prompt: string): Promise<string> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI Gateway [${res.status}]: ${body}`);
  }

  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("AI Gateway returned no image");
  return b64;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth-scoped client to validate the caller
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require admin role
    const { data: isAdmin } = await authClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const eventId: string | undefined = body?.eventId;
    const force: boolean = !!body?.force;
    if (!eventId || typeof eventId !== "string") {
      return new Response(JSON.stringify({ error: "eventId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client for privileged ops (read event, upload, update)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: event, error: evErr } = await admin
      .from("events")
      .select("id, title, category, description, venue_name, image_url")
      .eq("id", eventId)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if event already has a real (non-bucket) image, unless forced
    if (!force && event.image_url && !event.image_url.includes(BUCKET)) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "event already has image_url", image_url: event.image_url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prompt = buildPrompt(event);
    const b64 = await generateImageBase64(prompt);
    const bytes = base64ToBytes(b64);

    const path = `${eventId}/${Date.now()}.png`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    const imageUrl = pub.publicUrl;

    const { error: updErr } = await admin
      .from("events")
      .update({ image_url: imageUrl })
      .eq("id", eventId);
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({ ok: true, image_url: imageUrl, prompt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-event-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
