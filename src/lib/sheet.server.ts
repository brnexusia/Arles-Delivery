import { createClient } from "@supabase/supabase-js";

// Backend (SSR/Server Functions) deve priorizar process.env
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Configuração do Supabase ausente no servidor. Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// The table name from your Supabase screenshot
const TABLE_NAME = "registros";

export type RawRow = [string, string, string, string, number, string];
export type RawDataset = { companies: string[]; rows: RawRow[]; fetchedAt: string; debug?: any };

function toISODate(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).trim();

  // Supabase armazena no formato YYYY-DD-MM (ex: "2026-06-08" = 6 de agosto de 2026).
  // É necessário trocar dia e mês para produzir um ISO correto (YYYY-MM-DD).
  const supabaseFmt = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (supabaseFmt) {
    const [, year, day, month] = supabaseFmt;
    return `${year}-${month}-${day}`;
  }

  // Fallback: DD/MM/YYYY ou DD-MM-YYYY (planilhas legadas)
  const brFmt = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (brFmt) return `${brFmt[3]}-${brFmt[2].padStart(2, "0")}-${brFmt[1].padStart(2, "0")}`;

  return s;
}

function toTime(value: unknown): string {
  if (!value) return "";
  const s = String(value).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : s;
}

function toPhone(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().replace(/\.0$/, "");
}

/** Lê os dados da tabela do Supabase e devolve o dataset no formato esperado pelo app. */
export async function fetchSheetDataset(): Promise<RawDataset> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*");

  if (error) {
    throw new Error(`Falha ao ler os dados do Supabase: ${error.message}`);
  }

  if (!data) {
    return { companies: [], rows: [], fetchedAt: new Date().toISOString() };
  }

  const companies: string[] = [];
  const rows: RawRow[] = [];

  for (const record of data) {
    // A coluna 'Company' é a empresa, 'identificador' é a vendedora.
    const companyName = String(record.Company || "Sem Empresa").trim();
    
    let companyIndex = companies.indexOf(companyName);
    if (companyIndex === -1) {
      companies.push(companyName);
      companyIndex = companies.length - 1;
    }

    const phone = toPhone(record.numero);
    const date = toISODate(record.data);
    
    // Validate date and phone, consistent with the old sheet logic
    if (!date || !/\d{6,}/.test(phone)) continue;

    const contact = String(record.nome || "").trim() || "Sem nome";
    // O identificador representa a vendedora (ex: Talita)
    const seller = String(record.identificador || "Não atribuído").trim();
    const time = toTime(record.horario);

    rows.push([phone, contact, date, seller, companyIndex, time]);
  }

  return { companies, rows, fetchedAt: new Date().toISOString(), debug: { totalData: data.length, validRows: rows.length } };
}
