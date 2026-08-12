import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

function getBearer(req: Request) {
  const value = req.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "SUPABASE_SERVER_CONFIG_MISSING" }, 500);

  const token = getBearer(req);
  if (!token) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const { data: company } = await supabase.from("companies").select("id").eq("owner_id", authData.user.id).maybeSingle();
  if (!company) return json({ error: "Company not found for this user" }, 404);

  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle();

  if (!connection) return json({ success: true, status: "disconnected" });

  const apiUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY || "";

  if (apiUrl && apiKey) {
    try {
      const res = await fetch(`${apiUrl}/instance/logout/${encodeURIComponent(connection.instance_name)}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok && res.status !== 404) console.warn("[ARLES] Evolution logout returned", res.status, await res.text());
    } catch (error) {
      console.warn("[ARLES] Evolution logout failed", error);
    }
  }

  await supabase.from("whatsapp_connections").update({
    status: "disconnected",
    phone_number: null,
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id);

  return json({ success: true, status: "disconnected" });
}
