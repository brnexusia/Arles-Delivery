import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const n8nUrl = process.env.N8N_ORDER_EVENTS_WEBHOOK_URL || "";

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Supabase server is not configured" }, 500);
  }

  const token = (req.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) return json({ error: "Unauthorized" }, 401);

  let body: {
    event?: string;
    order_id?: string;
    status?: string;
    previous_status?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.order_id || !body.status) {
    return json({ error: "order_id and status are required" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id,name")
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (companyError) return json({ error: companyError.message }, 500);
  if (!company) return json({ error: "Company not found" }, 404);

  const { data: order, error: orderError } = await supabase
    .from("delivery_orders")
    .select("id,company_id,customer_id,client_name,client_phone,items,observations,delivery_address,delivery_type,total_value,status,payment_method,created_at,delivered_at")
    .eq("id", body.order_id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (orderError) return json({ error: orderError.message }, 500);
  if (!order) return json({ error: "Order not found" }, 404);

  const [{ data: connection }, { data: settings }, { data: storeInfo }] = await Promise.all([
    supabase
      .from("whatsapp_connections")
      .select("instance_name,status")
      .eq("company_id", company.id)
      .maybeSingle(),
    supabase
      .from("company_settings")
      .select("display_name,instagram")
      .eq("company_id", company.id)
      .maybeSingle(),
    supabase
      .from("delivery_store_info")
      .select("store_name")
      .eq("company_id", company.id)
      .maybeSingle(),
  ]);

  if (!n8nUrl) {
    console.warn("[ARLES ORDER EVENT] N8N_ORDER_EVENTS_WEBHOOK_URL not configured");
    return json({ success: true, forwarded: false, reason: "n8n_not_configured" });
  }

  if (!connection?.instance_name || connection.status !== "connected") {
    console.warn("[ARLES ORDER EVENT] WhatsApp connection unavailable", company.id);
    return json({ success: true, forwarded: false, reason: "whatsapp_not_connected" });
  }

  const companyName =
    settings?.display_name ||
    storeInfo?.store_name ||
    company.name ||
    "Estabelecimento";

  const payload = {
    event: "ORDER_STATUS_CHANGED",
    source: "arles_app",
    company_id: company.id,
    company_name: companyName,
    company_instagram: settings?.instagram || null,
    instance_name: connection.instance_name,
    order_id: order.id,
    previous_status: body.previous_status || null,
    status: order.status,
    client_name: order.client_name,
    client_phone: order.client_phone,
    customer_id: order.customer_id,
    delivery_type: order.delivery_type || null,
    delivery_address: order.delivery_address,
    total_value: order.total_value,
    payment_method: order.payment_method,
    items: order.items,
    occurred_at: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.error("[ARLES ORDER EVENT] n8n returned", response.status, responseText);
      return json({ success: true, forwarded: false, n8n_status: response.status });
    }

    return json({ success: true, forwarded: true, event: payload.event, status: order.status });
  } catch (error: any) {
    console.error("[ARLES ORDER EVENT] n8n forward failed", error);
    return json({ success: true, forwarded: false, error: error?.message || "forward_failed" });
  }
}
