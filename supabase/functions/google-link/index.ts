// Enregistre le jeton de renouvellement Google de l'utilisateur connecté.
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
  const body = await req.json().catch(() => ({}));
  const rt = typeof body.refresh_token === "string" ? body.refresh_token : "";
  if (!rt) return json({ error: "missing refresh_token" }, 400);
  const { error: e2 } = await admin.from("google_tokens").upsert({
    user_id: data.user.id, refresh_token: rt, updated_at: new Date().toISOString(),
  });
  if (e2) return json({ error: "db" }, 500);
  return json({ ok: true });
});
