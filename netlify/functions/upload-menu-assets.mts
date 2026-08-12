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
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase server config missing" }, 500);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const token = getBearer(req);
  if (!token) return json({ error: "Unauthorized" }, 401);

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", authData.user.id)
    .maybeSingle();

  if (companyError || !company) return json({ error: "Company not found for this user" }, 404);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const pages = body?.pages;
  if (!Array.isArray(pages) || pages.length === 0) return json({ error: "Missing pages" }, 400);

  const bucketName = "menu-assets";
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) return json({ error: "Could not access menu storage" }, 500);
  if (!buckets.some((b) => b.name === bucketName)) {
    const { error } = await supabase.storage.createBucket(bucketName, { public: true, fileSizeLimit: 10485760 });
    if (error) return json({ error: "Could not create menu-assets bucket" }, 500);
  }

  const generationId = crypto.randomUUID();
  const uploadedPaths: string[] = [];
  const assets: any[] = [];

  try {
    for (const page of pages) {
      if (typeof page?.page_number !== "number" || !page?.base64) continue;
      const match = String(page.base64).match(/^data:([^;]+);base64,(.+)$/);
      const contentType = match?.[1] || "image/png";
      const raw = match?.[2] || String(page.base64);
      const buffer = Buffer.from(raw, "base64");
      const path = `${company.id}/${generationId}/page-${page.page_number}.png`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(path, buffer, { upsert: false, contentType });
      if (uploadError) throw new Error(`Falha ao enviar página ${page.page_number}: ${uploadError.message}`);

      uploadedPaths.push(path);
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(path);
      assets.push({
        page_number: page.page_number,
        image_url: urlData.publicUrl,
        type: "menu_page",
        category: page.category || null,
        storage_path: path,
      });
    }

    if (assets.length === 0) throw new Error("Nenhuma página válida foi gerada");

    const { data: oldRows } = await supabase
      .from("menu_assets")
      .select("storage_path,image_url")
      .eq("company_id", company.id);
    const oldPaths = (oldRows || []).map((r: any) => {
      if (r.storage_path) return r.storage_path;
      const marker = `/storage/v1/object/public/${bucketName}/`;
      const index = String(r.image_url || "").indexOf(marker);
      return index >= 0 ? decodeURIComponent(String(r.image_url).slice(index + marker.length)) : null;
    }).filter(Boolean);

    const { error: replaceError } = await supabase.rpc("replace_menu_assets", {
      p_company_id: company.id,
      p_generation_id: generationId,
      p_assets: assets,
    });
    if (replaceError) throw new Error(`Falha ao salvar cardápio visual: ${replaceError.message}`);

    if (oldPaths.length > 0) {
      const { error: removeError } = await supabase.storage.from(bucketName).remove(oldPaths);
      if (removeError) console.warn("[ARLES MenuUpload] old storage cleanup failed", removeError.message);
    }

    const { data: activeAssets, error: fetchError } = await supabase
      .from("menu_assets")
      .select("*")
      .eq("company_id", company.id)
      .eq("is_active", true)
      .order("page_number");
    if (fetchError) throw new Error(fetchError.message);

    return json({ success: true, assets: activeAssets || [] });
  } catch (error: any) {
    if (uploadedPaths.length > 0) await supabase.storage.from(bucketName).remove(uploadedPaths);
    console.error("[ARLES MenuUpload]", error);
    return json({ error: error?.message || "Falha ao gerar cardápio visual" }, 500);
  }
}
