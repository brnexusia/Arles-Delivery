import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const ok = (body: Record<string, unknown> = { ok: true }) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

function normalizeEvent(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[.\-]/g, "_");
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") return ok({ ok: true, reason: "health_check" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) return ok({ ok: false, reason: "supabase_not_configured" });

  let body: any;
  try { body = await req.json(); } catch { return ok({ ok: false, reason: "invalid_json" }); }

  const instanceName = String(body?.instance || body?.instanceName || "");
  const event = normalizeEvent(body?.event || body?.type);
  if (!instanceName) return ok({ ok: false, reason: "missing_instance" });

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("id,company_id,status,instance_name,connected_at,phone_number")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (!connection?.company_id) return ok({ ok: false, reason: "unknown_instance" });

  const { data: company } = await supabase
    .from("companies")
    .select("id,name,subscription_status")
    .eq("id", connection.company_id)
    .maybeSingle();

  if (event === "CONNECTION_UPDATE") {
    const rawState = String(body?.data?.state || body?.data?.status || "").toLowerCase();
    const status = rawState === "open" ? "connected" : rawState === "connecting" ? "connecting" : rawState === "close" || rawState === "closed" ? "disconnected" : connection.status;
    const phoneNumber = body?.data?.owner || body?.data?.instance?.owner || connection.phone_number || null;

    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (phoneNumber) update.phone_number = phoneNumber;
    if (status === "connected" && !connection.connected_at) update.connected_at = new Date().toISOString();
    await supabase.from("whatsapp_connections").update(update).eq("id", connection.id);

    if (status === "connected") {
      await supabase.from("companies").update({ whatsapp_completed: true }).eq("id", connection.company_id);
    }
  }

  const engineUrl = (process.env.ARLES_ENGINE_URL || "").replace(/\/+$/, "");
  if (!engineUrl) return ok({ ok: true, forwarded: false, event, reason: "engine_not_configured" });

  // Durante a transição, instâncias que ainda apontam para este webhook da Netlify
  // são encaminhadas para o Arles Engine. O Engine identifica o tenant pela instância.
  if (event === "MESSAGES_UPSERT" || event === "MESSAGE_UPSERT") {
    fetch(`${engineUrl}/webhooks/evolution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch((error) => console.error("[ARLES WEBHOOK] Engine forward failed", error));

    return ok({ ok: true, forwarded: true, target: "engine", event, company_id: connection.company_id });
  }

  return ok({ ok: true, forwarded: false, event, company_id: connection.company_id });
}
