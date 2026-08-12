import type { Context } from "@netlify/functions";
import { engineFetch, engineSession, json } from "../lib/arles-server.mts";

function resolveEnginePath(path: string): string | null {
  const clean = path.replace(/^\/+|\/+$/g, "");

  const exact: Record<string, string> = {
    company: "/internal/panel/company",
    "onboarding/complete": "/internal/panel/onboarding/complete",
    orders: "/internal/panel/orders",
    customers: "/internal/panel/customers",
    products: "/internal/panel/products",
    "menu/import": "/internal/panel/menu/import",
    "menu/analyze": "/internal/panel/menu/analyze",
    "store-info": "/internal/panel/store-info",
    settings: "/internal/panel/settings",
    "menu-assets": "/internal/panel/menu-assets",
    "whatsapp/status": "/internal/panel/whatsapp/status",
    "whatsapp/connect": "/internal/panel/whatsapp/connect",
    "whatsapp/disconnect": "/internal/panel/whatsapp/disconnect",
    "billing/subscription": "/internal/billing/subscription",
  };

  if (exact[clean]) return exact[clean];

  const patterns = [
    [/^orders\/([0-9a-f-]{36})\/status$/i, "/internal/panel/orders/$1/status"],
    [/^orders\/([0-9a-f-]{36})\/payment$/i, "/internal/panel/orders/$1/payment"],
    [/^customers\/([0-9a-f-]{36})$/i, "/internal/panel/customers/$1"],
    [/^customers\/([0-9a-f-]{36})\/orders$/i, "/internal/panel/customers/$1/orders"],
    [/^products\/([0-9a-f-]{36})$/i, "/internal/panel/products/$1"],
    [/^menu\/analyze\/([0-9a-f-]{36})$/i, "/internal/panel/menu/analyze/$1"],
  ] as const;

  for (const [regex, target] of patterns) {
    if (regex.test(clean)) return clean.replace(regex, target);
  }

  return null;
}

export default async function handler(req: Request, context: Context) {
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const session = await engineSession(req, context);
    if (!session.user) return json({ error: "SESSION_EXPIRED" }, 401);

    const requestUrl = new URL(req.url);
    const requested = requestUrl.searchParams.get("path") || "";
    const enginePath = resolveEnginePath(requested);
    if (!enginePath) return json({ error: "Invalid engine path" }, 404);

    let body: Record<string, unknown> = {};
    if (req.method !== "GET" && req.method !== "DELETE") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const companyId = session.user.companyId;
    const query =
      req.method === "GET" || req.method === "DELETE"
        ? `?company_id=${encodeURIComponent(companyId)}`
        : "";

    const init: RequestInit = { method: req.method };
    if (req.method !== "GET" && req.method !== "DELETE") {
      init.body = JSON.stringify({ ...body, company_id: companyId });
    }

    const forwarded = await engineFetch(`${enginePath}${query}`, init);
    return json(forwarded.data, forwarded.response.status);
  } catch (error: any) {
    console.error("[ARLES ENGINE PROXY]", error);
    return json({ error: error?.message || "ENGINE_UNREACHABLE" }, 502);
  }
}
