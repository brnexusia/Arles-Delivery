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

function extractQr(data: any): string | null {
  const candidates = [
    data?.qrcode?.base64,
    data?.qrCode?.base64,
    data?.base64,
    typeof data?.qrcode === "string" ? data.qrcode : null,
    typeof data?.qrCode === "string" ? data.qrCode : null,
  ];
  return candidates.find((value) => typeof value === "string" && value.length > 20) || null;
}

async function evolutionRequest(endpoint: string, options: RequestInit = {}) {
  const apiUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await res.text();
    let data: any = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }

    if (!res.ok) {
      const error: any = new Error(data?.message || data?.error || text || `Evolution ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCompany(req: Request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");

  const token = getBearer(req);
  if (!token) return { error: json({ error: "Unauthorized" }, 401) } as const;

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return { error: json({ error: "Unauthorized" }, 401) } as const;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id,name")
    .eq("owner_id", authData.user.id)
    .maybeSingle();

  if (companyError || !company) return { error: json({ error: "Company not found for this user" }, 404) } as const;
  return { supabase, company } as const;
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    return json({ error: "Evolution API not configured" }, 503);
  }

  try {
    const resolved = await resolveCompany(req);
    if ("error" in resolved) return resolved.error;
    const { supabase, company } = resolved;

    let { data: connection, error: connectionError } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("company_id", company.id)
      .maybeSingle();

    if (connectionError) return json({ error: connectionError.message }, 500);

    if (!connection) {
      const instanceName = `arles-${company.id.replace(/-/g, "").slice(0, 24)}`;
      const createdRow = await supabase
        .from("whatsapp_connections")
        .insert({ company_id: company.id, instance_name: instanceName, status: "disconnected" })
        .select("*")
        .single();

      if (createdRow.error || !createdRow.data) {
        return json({ error: createdRow.error?.message || "Failed to create WhatsApp connection" }, 500);
      }
      connection = createdRow.data;
    }

    const instanceName = connection.instance_name;
    let exists = true;
    let state: any = null;

    try {
      state = await evolutionRequest(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
    } catch (error: any) {
      if (error?.status === 404) exists = false;
      else throw error;
    }

    if (state?.instance?.state === "open") {
      await supabase.from("whatsapp_connections").update({
        status: "connected",
        phone_number: state.instance?.owner || connection.phone_number || null,
        connected_at: connection.connected_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", connection.id);
      await supabase.from("companies").update({ whatsapp_completed: true }).eq("id", company.id);
      return json({ success: true, status: "connected", phoneNumber: state.instance?.owner || connection.phone_number || null });
    }

    const webhookUrl = process.env.EVOLUTION_WEBHOOK_URL || "";
    let qrCodeBase64: string | null = null;

    if (!exists) {
      const payload: any = {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      };
      if (webhookUrl) {
        payload.webhook = {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        };
      }

      try {
        const created = await evolutionRequest("/instance/create", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        qrCodeBase64 = extractQr(created);
        const instanceId = created?.instance?.instanceId || created?.instance?.instance_id || created?.instanceId || null;
        if (instanceId) {
          await supabase.from("whatsapp_connections").update({ instance_id: instanceId }).eq("id", connection.id);
        }
      } catch (error: any) {
        if (error?.status !== 409 && !String(error?.message || "").toLowerCase().includes("already")) throw error;
      }
    }

    if (webhookUrl) {
      try {
        await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              byEvents: false,
              base64: false,
              events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
            },
          }),
        });
      } catch (error) {
        console.warn("[ARLES] Webhook configuration failed; QR flow will continue", error);
      }
    }

    if (!qrCodeBase64) {
      const qrData = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}`);
      qrCodeBase64 = extractQr(qrData);
    }

    await supabase.from("whatsapp_connections").update({
      status: "connecting",
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id);

    return json({ success: true, status: "connecting", qrCodeBase64 });
  } catch (error: any) {
    console.error("[ARLES WHATSAPP CONNECT]", error);
    const message = error?.name === "AbortError" ? "Evolution API timeout" : (error?.message || "WhatsApp connection failed");
    return json({ error: message }, 502);
  }
}
