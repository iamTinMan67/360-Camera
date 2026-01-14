// Supabase Edge Function: guest-gallery
// Validates a QR token, enforces expiry, and returns event + media with signed URLs.
//
// Required secrets (set in Supabase Dashboard -> Edge Functions -> Secrets):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// Deploy:
// supabase functions deploy guest-gallery
// supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  // In production you can restrict this to your domain(s).
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GuestGalleryRequest = {
  token: string;
};

Deno.serve(async (req) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    // Some clients may send an empty body (or invalid JSON). Handle gracefully.
    const raw = await req.text();
    if (!raw) {
      return Response.json(
        { error: "Missing request body (expected JSON: { token })" },
        { status: 400, headers: corsHeaders },
      );
    }

    let parsed: Partial<GuestGalleryRequest> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json(
        { error: "Invalid JSON body (expected JSON: { token })" },
        { status: 400, headers: corsHeaders },
      );
    }

    const token = parsed.token;
    if (!token || typeof token !== "string") {
      return Response.json(
        { error: "Missing token" },
        { status: 400, headers: corsHeaders },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Server not configured" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1) Validate token + expiry
    const { data: linkRow, error: linkErr } = await admin
      .from("event_access_links")
      .select("event_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (linkErr) {
      return Response.json({ error: linkErr.message }, { status: 500, headers: corsHeaders });
    }
    if (!linkRow) {
      return Response.json({ error: "Invalid or expired link" }, { status: 404, headers: corsHeaders });
    }

    if (linkRow.expires_at && new Date(linkRow.expires_at).getTime() < Date.now()) {
      return Response.json({ error: "Link expired" }, { status: 403, headers: corsHeaders });
    }

    // 2) Load event
    const { data: event, error: eventErr } = await admin
      .from("events")
      .select("*")
      .eq("id", linkRow.event_id)
      .single();

    if (eventErr) {
      return Response.json({ error: eventErr.message }, { status: 500, headers: corsHeaders });
    }

    // 3) Load media
    const { data: media, error: mediaErr } = await admin
      .from("media")
      .select("*")
      .eq("event_id", linkRow.event_id)
      .order("created_at", { ascending: false });

    if (mediaErr) {
      return Response.json({ error: mediaErr.message }, { status: 500, headers: corsHeaders });
    }

    // 4) Create signed URLs (1 hour)
    const bucket = "event-media";
    const expiresIn = 60 * 60;
    const out = [];

    for (const item of media ?? []) {
      let signed_url: string | null = null;
      if (item.storage_path) {
        const { data: signed, error: signedErr } = await admin.storage
          .from(bucket)
          .createSignedUrl(item.storage_path, expiresIn);

        if (!signedErr) signed_url = signed.signedUrl;
      }

      out.push({ ...item, signed_url });
    }

    return Response.json({ event, media: out }, { status: 200, headers: corsHeaders });
  } catch (e) {
    return Response.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500, headers: corsHeaders },
    );
  }
});

