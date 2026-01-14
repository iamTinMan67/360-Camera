// Supabase Edge Function: ensure-access-link
// Creates (or reuses) a 48-hour guest access link for an event.
//
// This function is intended to be called from the admin UI. Since the app uses
// client-side auth (no Supabase Auth), we secure it with a shared secret header.
//
// Required secrets (Supabase Dashboard -> Edge Functions -> Secrets):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - ADMIN_PASSWORD   (should match the admin password used to log in)
//
// Request:
// POST { "event_id": "<uuid>", "expires_hours"?: 48 }
// Header: x-admin-password: <ADMIN_PASSWORD>
//
// Response:
// { "token": "<uuid>", "expires_at": "<iso>" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EnsureAccessLinkRequest = {
  event_id: string;
  expires_hours?: number;
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    const providedPassword = req.headers.get("x-admin-password");
    if (!adminPassword || !providedPassword || providedPassword !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Server not configured" }, { status: 500, headers: corsHeaders });
    }

    const raw = await req.text();
    if (!raw) {
      return Response.json({ error: "Missing request body" }, { status: 400, headers: corsHeaders });
    }

    let parsed: Partial<EnsureAccessLinkRequest> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const eventId = parsed.event_id;
    if (!eventId || typeof eventId !== "string") {
      return Response.json({ error: "Missing event_id" }, { status: 400, headers: corsHeaders });
    }

    const expiresHours = typeof parsed.expires_hours === "number" && parsed.expires_hours > 0
      ? parsed.expires_hours
      : 48;
    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Reuse a still-valid token if one exists for this event.
    const { data: existing, error: existingErr } = await admin
      .from("event_access_links")
      .select("token, expires_at")
      .eq("event_id", eventId)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      return Response.json({ error: existingErr.message }, { status: 500, headers: corsHeaders });
    }

    if (existing?.token) {
      return Response.json({ token: existing.token, expires_at: existing.expires_at }, { status: 200, headers: corsHeaders });
    }

    const token = crypto.randomUUID();
    const { data: created, error: createErr } = await admin
      .from("event_access_links")
      .insert({
        event_id: eventId,
        token,
        expires_at: expiresAt,
      })
      .select("token, expires_at")
      .single();

    if (createErr) {
      return Response.json({ error: createErr.message }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ token: created.token, expires_at: created.expires_at }, { status: 200, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e?.message ?? "Unknown error" }, { status: 500, headers: corsHeaders });
  }
});

