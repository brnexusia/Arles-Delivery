import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type InputImage = { data: string; mime: string; label?: string; isOriginal?: boolean };
type MenuVariation = { name: string; price: number };
type MenuProduct = {
  name: string;
  description: string;
  price: number | null;
  available: boolean;
  variations: MenuVariation[];
};
type MenuCategory = { name: string; products: MenuProduct[] };
type MenuResult = { categories: MenuCategory[] };

const schema = {
  name: "menu_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  price: { type: ["number", "null"] },
                  available: { type: "boolean" },
                  variations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { name: { type: "string" }, price: { type: "number" } },
                      required: ["name", "price"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["name", "description", "price", "available", "variations"],
                additionalProperties: false,
              },
            },
          },
          required: ["name", "products"],
          additionalProperties: false,
        },
      },
    },
    required: ["categories"],
    additionalProperties: false,
  },
};

const extractionRules = `Você extrai cardápios de restaurantes com máxima fidelidade.
Leia TODA a imagem e todas as regiões. Não pare na primeira categoria.
Procure cabeçalhos pequenos, rodapé, laterais, segunda coluna e categorias com poucos produtos.
Cada produto deve ficar na categoria visual correta.
Extraia nome, descrição/ingredientes, preço, disponibilidade e variações/tamanhos.
Preserve ingredientes quando aparecerem abaixo ou ao lado do nome.
Se não houver descrição visível use "". Se preço estiver ausente/ilegível use null.
available=true salvo quando estiver explicitamente indisponível/esgotado.
Não invente. Ignore telefone,endereço,Instagram,slogans e textos promocionais.
Todas as imagens fornecidas pertencem ao MESMO cardápio.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function cleanResult(input: any): MenuResult {
  const categories: MenuCategory[] = [];
  for (const rawCat of Array.isArray(input?.categories) ? input.categories : []) {
    const name = String(rawCat?.name || "").trim();
    if (!name) continue;
    const products: MenuProduct[] = [];
    for (const raw of Array.isArray(rawCat?.products) ? rawCat.products : []) {
      const productName = String(raw?.name || "").trim();
      if (!productName) continue;
      const price = raw?.price === null || raw?.price === undefined || raw?.price === "" ? null : Number(raw.price);
      products.push({
        name: productName,
        description: String(raw?.description || "").trim(),
        price: Number.isFinite(price as number) ? (price as number) : null,
        available: raw?.available !== false,
        variations: (Array.isArray(raw?.variations) ? raw.variations : [])
          .map((v: any) => ({ name: String(v?.name || "").trim(), price: Number(v?.price) }))
          .filter((v: MenuVariation) => v.name && Number.isFinite(v.price)),
      });
    }
    if (products.length) categories.push({ name, products });
  }
  return { categories };
}

function mergeMenus(...menus: MenuResult[]): MenuResult {
  const categoryMap = new Map<string, MenuCategory>();

  for (const menu of menus) {
    for (const category of menu.categories) {
      const categoryKey = normalized(category.name);
      let target = categoryMap.get(categoryKey);
      if (!target) {
        target = { name: category.name.trim(), products: [] };
        categoryMap.set(categoryKey, target);
      }

      const productMap = new Map(target.products.map((p) => [normalized(p.name), p]));
      for (const product of category.products) {
        const key = normalized(product.name);
        const existing = productMap.get(key);
        if (!existing) {
          const copy = { ...product, variations: [...product.variations] };
          target.products.push(copy);
          productMap.set(key, copy);
          continue;
        }

        if (product.description.length > existing.description.length) existing.description = product.description;
        if (product.price !== null) existing.price = product.price;
        existing.available = existing.available && product.available;
        const variationMap = new Map(existing.variations.map((v) => [normalized(v.name), v]));
        for (const variation of product.variations) {
          const vKey = normalized(variation.name);
          const found = variationMap.get(vKey);
          if (found) found.price = variation.price;
          else {
            existing.variations.push({ ...variation });
            variationMap.set(vKey, existing.variations[existing.variations.length - 1]);
          }
        }
      }
    }
  }

  return { categories: [...categoryMap.values()].filter((c) => c.products.length > 0) };
}

async function callOpenAI(apiKey: string, model: string, images: InputImage[], instruction: string): Promise<MenuResult> {
  const content: any[] = [{ type: "text", text: `${extractionRules}\n\n${instruction}` }];
  images.forEach((img, index) => {
    content.push({ type: "text", text: img.label || `Imagem ${index + 1}` });
    const url = img.data.includes(",") ? img.data : `data:${img.mime};base64,${img.data}`;
    content.push({ type: "image_url", image_url: { url, detail: "high" } });
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_schema", json_schema: schema },
      temperature: 0,
      max_tokens: 12000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[MENU AI] OpenAI error", response.status, text.slice(0, 800));
    throw new Error(`OpenAI ${response.status}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Empty AI response");
  return cleanResult(JSON.parse(text));
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const apiKey = process.env.AI_API_KEY || "";
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  if (!supabaseUrl || !serviceKey || !apiKey) return json({ success: false, error: "Server configuration missing" }, 500);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json({ success: false, error: "Unauthorized" }, 401);
  const { data: company } = await supabase.from("companies").select("id").eq("owner_id", authData.user.id).maybeSingle();
  if (!company) return json({ success: false, error: "Company not found for this user" }, 404);

  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const images: InputImage[] = Array.isArray(body?.images) ? body.images : [];
  if (!images.length) return json({ success: false, error: "No images provided" }, 400);

  for (const image of images) {
    if (!ALLOWED_MIMES.includes(image.mime)) return json({ success: false, error: "Invalid image type" }, 400);
    const raw = image.data.includes(",") ? image.data.split(",")[1] : image.data;
    if (Math.ceil((raw.length * 3) / 4) > MAX_IMAGE_BYTES) return json({ success: false, error: "Image too large" }, 400);
  }

  const originals = images.filter((img) => img.isOriginal);
  const globalImages = originals.length ? originals : images.slice(0, 1);

  try {
    const baseline = await callOpenAI(
      apiKey,
      model,
      globalImages,
      "Faça primeiro uma leitura estrutural completa. Identifique todas as categorias e todos os produtos visíveis, inclusive blocos pequenos como categorias doces, bebidas ou adicionais."
    );

    let recovered: MenuResult = { categories: [] };
    if (images.length > globalImages.length) {
      try {
        recovered = await callOpenAI(
          apiKey,
          model,
          images,
          `Esta é uma segunda verificação com recortes ampliados. A leitura inicial encontrou:\n${JSON.stringify(baseline)}\nCompare com todas as imagens e devolva o cardápio COMPLETO corrigido. Recupere qualquer categoria, produto, descrição ou preço que tenha sido omitido. Os recortes se sobrepõem; não duplique itens.`
        );
      } catch (recoveryError) {
        console.warn("[MENU AI] Recovery pass failed; using baseline", recoveryError);
      }
    }

    const result = mergeMenus(baseline, recovered);
    const productCount = result.categories.reduce((sum, c) => sum + c.products.length, 0);
    if (!productCount) throw new Error("No products detected");

    console.log(`[MENU AI] ${result.categories.length} categories / ${productCount} products`);
    return json({ success: true, data: result });
  } catch (error: any) {
    console.error("[MENU AI]", error);
    return json({
      success: false,
      error: "Menu analysis failed",
      userMessage: "Não foi possível analisar o cardápio. Tente novamente com uma foto mais nítida.",
    }, 502);
  }
}
