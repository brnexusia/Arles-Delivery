import type { Context } from "@netlify/functions";

export const SESSION_COOKIE = "arles_session";
export const CLIENT_SESSION_COOKIE = "arles_session_client";

export function engineConfig() {
  const url = (process.env.ARLES_ENGINE_URL || "").replace(/\/+$/, "");
  const key = process.env.ARLES_ENGINE_INTERNAL_KEY || "";
  if (!url || !key) throw new Error("ARLES_ENGINE_NOT_CONFIGURED");
  return { url, key };
}

function cookiesFromHeader(req: Request): Map<string, string> {
  const values = new Map<string, string>();
  const raw = req.headers.get("cookie") || "";

  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) continue;

    const rawValue = rest.join("=") || "";
    try {
      values.set(name, decodeURIComponent(rawValue));
    } catch {
      values.set(name, rawValue);
    }
  }

  return values;
}

export function readSessionCookie(req: Request, _context?: Context): string {
  const cookies = cookiesFromHeader(req);

  // 1) Preferimos o cookie HttpOnly.
  // 2) Se o runtime/proxy não persistir esse Set-Cookie, usamos o cookie
  //    de fallback gravado pelo próprio frontend após login/cadastro.
  return (
    cookies.get(SESSION_COOKIE) ||
    cookies.get(CLIENT_SESSION_COOKIE) ||
    ""
  );
}

function sessionDays(): number {
  const value = Number(process.env.ARLES_SESSION_DAYS || 30);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 30;
}

export function sessionCookieHeader(token: string): string {
  const maxAge = sessionDays() * 24 * 60 * 60;

  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function clearSessionCookieHeader(): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export async function engineFetch(path: string, init: RequestInit = {}) {
  const { url, key } = engineConfig();

  const headers = new Headers(init.headers || {});
  headers.set("X-Arles-Key", key);

  // Fastify rejeita POST vazio quando enviamos Content-Type: application/json.
  // Só declaramos JSON quando existe body de fato.
  if (init.body !== undefined && init.body !== null) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  } else {
    headers.delete("Content-Type");
  }

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20000),
  });

  const text = await response.text().catch(() => "");
  let data: any = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  return { response, data };
}

export async function validateEngineSession(token: string) {
  if (!token) return { ok: false, user: null as any };

  const result = await engineFetch("/internal/auth/session", {
    method: "POST",
    headers: { "X-Arles-Session": token },
  });

  return {
    ok: result.response.ok && !!result.data?.user,
    user: result.data?.user || null,
    status: result.response.status,
    data: result.data,
  };
}

export async function engineSession(req: Request, context?: Context) {
  const token = readSessionCookie(req, context);
  if (!token) return { token: "", user: null as any };

  const validated = await validateEngineSession(token);

  if (!validated.ok || !validated.user) {
    return { token: "", user: null as any };
  }

  return { token, user: validated.user };
}
