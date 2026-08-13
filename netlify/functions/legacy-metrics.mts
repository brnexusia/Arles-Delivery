import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { engineSession, json } from "../lib/arles-server.mts";

type RawRow = [string, string, string, string, number, string];

function toISODate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const legacy = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (legacy) return `${legacy[1]}-${legacy[3]}-${legacy[2]}`;

  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  return br ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}` : text;
}

function toTime(value: unknown): string {
  const match = String(value ?? "").match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

export default async function handler(req: Request, context: Context) {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const session = await engineSession(req, context);
  if (!session.user || session.user.role === "admin") {
    return json({ error: "SESSION_EXPIRED" }, 401);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "LEGACY_METRICS_NOT_CONFIGURED" }, 503);
  }

  const company = String(session.user.company || "").trim();
  if (!company) return json({ error: "TENANT_NOT_FOUND" }, 403);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // P0: o filtro acontece no banco. Nunca carregamos outras empresas para
  // filtrar no frontend ou nesta função.
  const { data, error } = await supabase
    .from("registros")
    .select("numero,nome,data,identificador,horario,Company")
    .eq("Company", company);

  if (error) return json({ error: "LEGACY_METRICS_QUERY_FAILED" }, 502);

  const rows: RawRow[] = [];
  for (const record of data ?? []) {
    const phone = String(record.numero ?? "")
      .trim()
      .replace(/\.0$/, "");
    const date = toISODate(record.data);
    if (!date || !/\d{6,}/.test(phone)) continue;
    rows.push([
      phone,
      String(record.nome || "Sem nome").trim(),
      date,
      String(record.identificador || "Não atribuído").trim(),
      0,
      toTime(record.horario),
    ]);
  }

  return json({
    companies: [company],
    rows,
    fetchedAt: new Date().toISOString(),
  });
}
