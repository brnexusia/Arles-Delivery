import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: Request, _ctx: Context) {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: "server_misconfigured" }, 500);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "missing_or_invalid_session" }, 401);

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) return json({ error: "missing_or_invalid_session" }, 401);

  let body: { company_name?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const companyName = body.company_name?.trim();
  if (!companyName) return json({ error: "company_name_is_required" }, 400);

  const { data: existing, error: existingError } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existingError) return json({ error: existingError.message }, 500);
  if (existing) return json({ ok: true, company: existing, created: false });

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert([{
      owner_id: user.id,
      name: companyName,
      has_delivery: true,
      subscription_status: "trial",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
    }])
    .select()
    .single();

  if (companyError || !company) {
    // If two requests raced, reuse the row already created for this owner.
    const { data: racedCompany } = await supabase
      .from("companies")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (racedCompany) return json({ ok: true, company: racedCompany, created: false });
    return json({ error: companyError?.message || "failed_to_create_company" }, 500);
  }

  // Registration contact data belongs to company settings, not to auth credentials.
  await supabase.from("company_settings").upsert({
    company_id: company.id,
    display_name: companyName,
    phone: body.phone?.trim() || null,
    email: user.email || null,
  }, { onConflict: "company_id" }).then(({ error }) => {
    if (error) console.warn("[REGISTER COMPANY] company_settings init skipped:", error.message);
  });

  return json({
    ok: true,
    company,
    created: true,
    trial: { ends_at: trialEndsAt.toISOString() },
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
