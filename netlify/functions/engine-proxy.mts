import type { Context } from "@netlify/functions";
import { engineFetch, engineSession, json } from "../lib/arles-server.mts";

type EngineRoute = {
  primary: string;
  fallback?: string;
};

function resolveEnginePath(path: string): EngineRoute | null {
  const clean = path.replace(/^\/+|\/+$/g, "");

  const exact: Record<string, EngineRoute> = {
    company: {
      primary: "/internal/platform/company",
      fallback: "/internal/panel/company",
    },
    "onboarding/complete": {
      primary: "/internal/platform/onboarding/complete",
      fallback: "/internal/panel/onboarding/complete",
    },
    orders: {
      primary: "/internal/verticals/delivery/orders",
      fallback: "/internal/panel/orders",
    },
    customers: {
      primary: "/internal/verticals/delivery/customers",
      fallback: "/internal/panel/customers",
    },
    products: {
      primary: "/internal/verticals/delivery/products",
      fallback: "/internal/panel/products",
    },
    "menu/import": {
      primary: "/internal/verticals/delivery/menu/import",
      fallback: "/internal/panel/menu/import",
    },
    "menu/analyze": {
      primary: "/internal/verticals/delivery/menu/analyze",
      fallback: "/internal/panel/menu/analyze",
    },
    "store-info": {
      primary: "/internal/verticals/delivery/store",
      fallback: "/internal/panel/store-info",
    },
    settings: {
      primary: "/internal/platform/settings",
      fallback: "/internal/panel/settings",
    },
    "menu-assets": {
      primary: "/internal/verticals/delivery/menu/assets",
      fallback: "/internal/panel/menu-assets",
    },
    "whatsapp/status": {
      primary: "/internal/platform/channels/whatsapp",
      fallback: "/internal/panel/whatsapp/status",
    },
    "whatsapp/connect": {
      primary: "/internal/platform/channels/whatsapp/connect",
      fallback: "/internal/panel/whatsapp/connect",
    },
    "whatsapp/disconnect": {
      primary: "/internal/platform/channels/whatsapp/disconnect",
      fallback: "/internal/panel/whatsapp/disconnect",
    },
    "billing/subscription": { primary: "/internal/billing/subscription" },
  };

  if (exact[clean]) return exact[clean];

  const patterns = [
    [
      /^orders\/([0-9a-f-]{36})\/status$/i,
      {
        primary: "/internal/verticals/delivery/orders/$1/status",
        fallback: "/internal/panel/orders/$1/status",
      },
    ],
    [
      /^orders\/([0-9a-f-]{36})\/payment$/i,
      {
        primary: "/internal/verticals/delivery/orders/$1/payment",
        fallback: "/internal/panel/orders/$1/payment",
      },
    ],
    [
      /^customers\/([0-9a-f-]{36})$/i,
      {
        primary: "/internal/verticals/delivery/customers/$1",
        fallback: "/internal/panel/customers/$1",
      },
    ],
    [
      /^customers\/([0-9a-f-]{36})\/orders$/i,
      {
        primary: "/internal/verticals/delivery/customers/$1/orders",
        fallback: "/internal/panel/customers/$1/orders",
      },
    ],
    [
      /^products\/([0-9a-f-]{36})$/i,
      {
        primary: "/internal/verticals/delivery/products/$1",
        fallback: "/internal/panel/products/$1",
      },
    ],
    [
      /^menu\/analyze\/([0-9a-f-]{36})$/i,
      {
        primary: "/internal/verticals/delivery/menu/analyze/$1",
        fallback: "/internal/panel/menu/analyze/$1",
      },
    ],
  ] as const;

  for (const [regex, target] of patterns) {
    if (regex.test(clean)) {
      return {
        primary: clean.replace(regex, target.primary),
        fallback: target.fallback ? clean.replace(regex, target.fallback) : undefined,
      };
    }
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
    const engineRoute = resolveEnginePath(requested);
    if (!engineRoute) return json({ error: "Invalid engine path" }, 404);

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

    // O proxy já validou a sessão. Encaminhar o mesmo token permite que as
    // rotas modulares do Core resolvam o tenant sem depender do modo legado.
    const init: RequestInit = {
      method: req.method,
      headers: { "X-Arles-Session": session.token },
    };
    if (req.method !== "GET" && req.method !== "DELETE") {
      init.body = JSON.stringify({ ...body, company_id: companyId });
    }

    let forwarded = await engineFetch(`${engineRoute.primary}${query}`, init);

    // Durante a transição do Core antigo para o motor modular, alguns ambientes
    // ainda expõem apenas /internal/panel/*. O fallback evita quebrar o painel
    // enquanto o Core é atualizado e só é usado quando a rota nova não existe.
    if (forwarded.response.status === 404 && engineRoute.fallback) {
      forwarded = await engineFetch(`${engineRoute.fallback}${query}`, init);
    }

    return json(forwarded.data, forwarded.response.status);
  } catch (error: any) {
    console.error("[ARLES ENGINE PROXY]", error);
    return json({ error: error?.message || "ENGINE_UNREACHABLE" }, 502);
  }
}
