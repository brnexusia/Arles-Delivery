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
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) return json({ success: false, error: "Supabase server config missing" }, 500);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const token = getBearer(req);
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json({ success: false, error: "Unauthorized" }, 401);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", authData.user.id)
    .maybeSingle();
  if (companyError || !company) return json({ success: false, error: "Company not found for this user" }, 404);

  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const categories = body?.categories;
  if (!Array.isArray(categories) || categories.length === 0) {
    return json({ success: false, error: "Nenhum produto para importar" }, 400);
  }

  const cleaned = categories
    .filter((cat: any) => cat && typeof cat.name === "string" && Array.isArray(cat.products))
    .map((cat: any) => ({
      name: cat.name.trim(),
      products: cat.products
        .filter((p: any) => p && typeof p.name === "string" && p.name.trim())
        .map((p: any) => ({
          name: p.name.trim(),
          description: typeof p.description === "string" ? p.description.trim() : "",
          price: p.price ?? null,
          available: p.available !== false,
          ignore: p.ignore === true,
          variations: Array.isArray(p.variations) ? p.variations : [],
        })),
    }))
    .filter((cat: any) => cat.name && cat.products.length > 0);

  if (cleaned.length === 0) return json({ success: false, error: "Nenhum produto válido para importar" }, 400);

  const { data: imported, error: importError } = await supabase.rpc("import_delivery_menu", {
    p_company_id: company.id,
    p_categories: cleaned,
  });

  if (importError) {
    console.error("[MENU CONFIRM]", importError);
    return json({ success: false, error: "Não foi possível salvar os produtos", details: importError.message }, 500);
  }

  return json({ success: true, imported: Number(imported || 0) });
}
