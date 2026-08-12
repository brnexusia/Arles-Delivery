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
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const apiUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!apiUrl || !apiKey) return json({ status: "unconfigured" });
  if (!supabaseUrl || !serviceKey) return json({ error: "SUPABASE_SERVER_CONFIG_MISSING" }, 500);

  const token = getBearer(req);
  if (!token) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const { data: company } = await supabase.from("companies").select("id").eq("owner_id", authData.user.id).maybeSingle();
  if (!company) return json({ error: "Company not found for this user" }, 404);

  const { data: connection, error: connectionError } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle();

  if (connectionError) return json({ error: connectionError.message }, 500);
  if (!connection) return json({ status: "disconnected" });

  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${encodeURIComponent(connection.instance_name)}`, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) {
      await supabase.from("whatsapp_connections").update({ status: "disconnected", updated_at: new Date().toISOString() }).eq("id", connection.id);
      return json({ status: "disconnected" });
    }

    if (!res.ok) return json({ status: connection.status, degraded: true });

    const state = await res.json();
    const rawState = state?.instance?.state;
    const connectingSince = connection.updated_at ? Date.parse(connection.updated_at) : 0;
    const recentlyConnecting = connection.status === "connecting" && connectingSince > 0 && Date.now() - connectingSince < 90000;
    const status = rawState === "open" ? "connected"
      : rawState === "connecting" ? "connecting"
      : recentlyConnecting ? "connecting"
      : "disconnected";
    const phoneNumber = state?.instance?.owner || connection.phone_number || null;

    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (phoneNumber) update.phone_number = phoneNumber;
    if (status === "connected" && !connection.connected_at) update.connected_at = new Date().toISOString();
    await supabase.from("whatsapp_connections").update(update).eq("id", connection.id);

    if (status === "connected") {
      await supabase.from("companies").update({ whatsapp_completed: true }).eq("id", company.id);
    }

    return json({ status, phoneNumber });
  } catch (error: any) {
    console.error("[ARLES WHATSAPP STATUS]", error);
    return json({ status: connection.status || "disconnected", degraded: true });
  }
}
