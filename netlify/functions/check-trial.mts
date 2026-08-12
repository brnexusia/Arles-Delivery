// netlify/functions/check-trial.mts
// Validates whether a phone/email is eligible for a new free trial.
// Called BEFORE creating the company record in Supabase.
// Returns { eligible: true } or { eligible: false, reason: "..." }
import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function normalizePhone(phone: string): string {
  // Strip everything that is not a digit
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
    return new Response(
      JSON.stringify({ error: "SUPABASE_NOT_CONFIGURED" }),
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let body: { phone?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const rawPhone = body.phone || "";
  const rawEmail = body.email || "";

  if (!rawPhone && !rawEmail) {
    return new Response(
      JSON.stringify({ error: "phone or email is required" }),
      { status: 400 }
    );
  }

  const phoneNorm = normalizePhone(rawPhone);
  const emailNorm = normalizeEmail(rawEmail);

  // ─── 1. Check trial_entitlements by phone (primary signal) ──────────────────
  if (phoneNorm) {
    const { data: phoneHit } = await supabase
      .from("trial_entitlements")
      .select("id, trial_started_at, trial_ends_at")
      .eq("phone_normalized", phoneNorm)
      .maybeSingle();

    if (phoneHit) {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: "phone_already_used",
          message:
            "Este número já utilizou o período gratuito do Arles Delivery.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ─── 2. Check trial_entitlements by email (secondary signal) ────────────────
  if (emailNorm) {
    const { data: emailHit } = await supabase
      .from("trial_entitlements")
      .select("id, trial_started_at, trial_ends_at")
      .eq("email_normalized", emailNorm)
      .maybeSingle();

    if (emailHit) {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: "email_already_used",
          message:
            "Este e-mail já utilizou o período gratuito do Arles Delivery.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ─── 3. Eligible — no prior trial found ─────────────────────────────────────
  return new Response(
    JSON.stringify({ eligible: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
