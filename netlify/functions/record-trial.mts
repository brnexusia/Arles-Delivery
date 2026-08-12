// netlify/functions/record-trial.mts
// Records a new trial entitlement AFTER the company is created.
// This keeps the trial history even if the company is later deleted.
import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "SUPABASE_NOT_CONFIGURED" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let body: {
    company_id?: string;
    email?: string;
    phone?: string;
    trial_started_at?: string;
    trial_ends_at?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const { company_id, email, phone, trial_started_at, trial_ends_at } = body;

  if (!company_id) {
    return new Response(JSON.stringify({ error: "company_id is required" }), { status: 400 });
  }

  const phoneNorm = phone ? normalizePhone(phone) : null;
  const emailNorm = email ? normalizeEmail(email) : null;

  const { error } = await supabase.from("trial_entitlements").insert([{
    company_id,
    email_normalized: emailNorm,
    phone_normalized: phoneNorm,
    trial_started_at: trial_started_at || new Date().toISOString(),
    trial_ends_at: trial_ends_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }]);

  if (error) {
    console.error("[record-trial] insert error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
