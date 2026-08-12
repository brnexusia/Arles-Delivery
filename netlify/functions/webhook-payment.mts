// netlify/functions/webhook-payment.mts
import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: Request, context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ ok: false, reason: "Supabase configuration missing" }), { status: 200 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const eventType: string = body.event || "unknown";
    const payload = body.data || body;

    const companyId = payload.metadata?.company_id || payload.customer?.email;
    if (!companyId) {
      console.error("Payment webhook: missing company_id in payload");
      return new Response(JSON.stringify({ ok: false, reason: "missing company_id" }), { status: 200 });
    }

    let statusUpdate: Record<string, any> = {};

    switch (eventType) {
      case "payment.approved":
      case "subscription.active":
        statusUpdate = { subscription_status: "active", subscription_started_at: new Date().toISOString() };
        break;
      case "subscription.canceled":
      case "payment.refunded":
        statusUpdate = { subscription_status: "canceled" };
        break;
      case "payment.failed":
        statusUpdate = { subscription_status: "past_due" };
        break;
      default:
        console.log(`Unhandled payment event: ${eventType}`);
        return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
    }

    const { error } = await supabase
      .from("companies")
      .update(statusUpdate)
      .eq("name", companyId);

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    console.error("Payment webhook error:", err.message);
    return new Response(JSON.stringify({ error: "Processing failed" }), { status: 400 });
  }
}
