import raw from "@/data/contacts.json";

export type Contact = {
  phone: string;
  name: string;
  date: string; // yyyy-mm-dd
  seller: string;
  company: string;
  time: string; // HH:MM ("" quando indisponível)
};

type RawFile = {
  companies: string[];
  rows: [string, string, string, string, number, (string | undefined)?][];
};

const file = raw as RawFile;

export type Dataset = { companies: string[]; contacts: Contact[]; fetchedAt: string | null };

/** Converte o formato bruto (planilha/JSON) em um dataset utilizável. */
export function toDataset(input: RawFile & { fetchedAt?: string }): Dataset {
  return {
    companies: input.companies,
    contacts: input.rows.map((r) => ({
      phone: r[0],
      name: r[1],
      date: r[2],
      seller: r[3],
      company: input.companies[r[4]],
      time: r[5] ?? "",
    })),
    fetchedAt: input.fetchedAt ?? null,
  };
}


/** Snapshot local usado como fallback enquanto a planilha não responde. */
export const staticDataset: Dataset = toDataset(file);

export const companies: string[] = staticDataset.companies;

/** Todos os registros brutos (duplicados preservados). */
export const allContacts: Contact[] = staticDataset.contacts;

/** Dados isolados por empresa — a base do multi-tenant. */
export function contactsOf(company: string, source: Contact[] = allContacts): Contact[] {
  return source.filter((c) => c.company === company);
}


export function sellersOf(rows: Contact[]) {
  return Array.from(new Set(rows.map((c) => c.seller))).sort();
}

export function dateRangeOf(rows: Contact[]) {
  const dates = rows.map((c) => c.date).sort();
  return { min: dates[0] ?? "2026-01-01", max: dates[dates.length - 1] ?? "2026-12-31" };
}

export function formatBR(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function formatPhone(p: string) {
  const digits = p.replace(/\D/g, "");
  if (digits.length >= 12) {
    const cc = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const mid = rest.slice(0, rest.length - 4);
    return `+${cc} (${ddd}) ${mid}-${rest.slice(-4)}`;
  }
  return p;
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export const WEEKDAY_ORDER = WEEKDAYS;

export type Metrics = {
  total: number;
  dailyAvg: number;
  activeDays: number;
  topSeller: { name: string; count: number } | null;
  returnRate: number;
  returningContacts: number;
  uniquePhones: number;
  byDate: { date: string; label: string; count: number }[];
  bySeller: { seller: string; count: number }[];
  byWeekday: { weekday: string; count: number }[];
  byFrequency: { bucket: string; count: number }[];
  byHour: { hour: string; count: number }[];
  hasHourData: boolean;
};

export function computeMetrics(rows: Contact[]): Metrics {
  const dateMap = new Map<string, number>();
  const sellerMap = new Map<string, number>();
  const weekdayMap = new Map<string, number>();
  const phoneDays = new Map<string, Set<string>>();
  const hourCounts = new Array(24).fill(0) as number[];
  let hourTotal = 0;

  for (const r of rows) {
    dateMap.set(r.date, (dateMap.get(r.date) ?? 0) + 1);
    sellerMap.set(r.seller, (sellerMap.get(r.seller) ?? 0) + 1);
    const wd = weekdayOf(r.date);
    weekdayMap.set(wd, (weekdayMap.get(wd) ?? 0) + 1);
    let set = phoneDays.get(r.phone);
    if (!set) phoneDays.set(r.phone, (set = new Set()));
    set.add(r.date);
    if (r.time) {
      const h = Number(r.time.slice(0, 2));
      if (Number.isFinite(h) && h >= 0 && h < 24) {
        hourCounts[h]++;
        hourTotal++;
      }
    }
  }

  const uniquePhones = phoneDays.size;
  let returningContacts = 0;
  const buckets = [0, 0, 0, 0, 0]; // 1x, 2x, 3x, 4x, 5x+
  for (const set of phoneDays.values()) {
    if (set.size > 1) returningContacts++;
    buckets[Math.min(set.size, 5) - 1]++;
  }

  const bySeller = [...sellerMap.entries()]
    .map(([seller, count]) => ({ seller, count }))
    .sort((a, b) => b.count - a.count);

  const byDate = [...dateMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count, label: formatBR(date).slice(0, 5) }));

  return {
    total: rows.length,
    activeDays: dateMap.size,
    dailyAvg: dateMap.size ? rows.length / dateMap.size : 0,
    topSeller: bySeller[0] ? { name: bySeller[0].seller, count: bySeller[0].count } : null,
    returnRate: uniquePhones ? (returningContacts / uniquePhones) * 100 : 0,
    returningContacts,
    uniquePhones,
    byDate,
    bySeller,
    byWeekday: WEEKDAYS.map((w) => ({ weekday: w, count: weekdayMap.get(w) ?? 0 })),
    byFrequency: ["1 contato", "2 contatos", "3 contatos", "4 contatos", "5+ contatos"].map(
      (bucket, i) => ({ bucket, count: buckets[i] }),
    ),
    byHour: hourCounts.map((count, h) => ({ hour: `${String(h).padStart(2, "0")}h`, count })),
    hasHourData: hourTotal > 0,
  };
}

/** Período imediatamente anterior, com a mesma duração em dias. */
export function previousRange(start: string, end: string) {
  const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
  const day = 86_400_000;
  const s = toDate(start).getTime();
  const e = toDate(end).getTime();
  const span = Math.max(day, e - s + day);
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return { start: iso(s - span), end: iso(s - day) };
}

/** Variação percentual entre dois valores (null quando não há base de comparação). */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}


/** Timeline completa de um número dentro da empresa (todos os registros). */
export function historyOf(rows: Contact[], phone: string) {
  return rows.filter((r) => r.phone === phone).sort((a, b) => a.date.localeCompare(b.date));
}

export type FrequencyClient = {
  phone: string;
  name: string;
  days: number;
  records: number;
  lastDate: string;
  sellers: string[];
};

/**
 * Clientes de um bucket de frequência (1..4 = exatamente N dias distintos, 5 = 5 ou mais).
 */
export function clientsByFrequency(rows: Contact[], bucket: number): FrequencyClient[] {
  const map = new Map<string, Contact[]>();
  for (const r of rows) {
    const list = map.get(r.phone);
    if (list) list.push(r);
    else map.set(r.phone, [r]);
  }

  const out: FrequencyClient[] = [];
  for (const [phone, list] of map) {
    const days = new Set(list.map((r) => r.date)).size;
    const match = bucket >= 5 ? days >= 5 : days === bucket;
    if (!match) continue;
    out.push({
      phone,
      name: list.find((r) => r.name)?.name ?? "",
      days,
      records: list.length,
      lastDate: list.reduce((a, r) => (r.date > a ? r.date : a), list[0].date),
      sellers: Array.from(new Set(list.map((r) => r.seller))).sort(),
    });
  }
  return out.sort((a, b) => b.days - a.days || b.lastDate.localeCompare(a.lastDate));
}

