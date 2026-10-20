// Une seule fonction : action "link" (enregistre le jeton de renouvellement) ou "token" (renvoie un jeton Google frais).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return json({ error: "unauthorized" }, 401);
  const uid = data.user.id;
  const body = await req.json().catch(() => ({}));

  if (body.action === "link") {
    const rt = typeof body.refresh_token === "string" ? body.refresh_token : "";
    if (!rt) return json({ error: "missing refresh_token" }, 400);
    const { error: e2 } = await admin.from("google_tokens").upsert({
      user_id: uid, refresh_token: rt, updated_at: new Date().toISOString(),
    });
    if (e2) return json({ error: "db" }, 500);
    return json({ ok: true });
  }

  const { data: row } = await admin.from("google_tokens").select("refresh_token").eq("user_id", uid).maybeSingle();
  if (!row) return json({ error: "not_linked" }, 404);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (j.error === "invalid_grant") await admin.from("google_tokens").delete().eq("user_id", uid);
    return json({ error: j.error || "google" }, 401);
  }
  return json({ access_token: j.access_token, expires_in: j.expires_in || 3600 });
});
