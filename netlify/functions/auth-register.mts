import type { Context } from "@netlify/functions";
import {
  engineFetch,
  json,
  sessionCookieHeader,
  validateEngineSession,
} from "../lib/arles-server.mts";

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const result = await engineFetch("/internal/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: String(body.name || ""),
      company_name: String(body.company_name || body.companyName || ""),
      email: String(body.email || "").trim().toLowerCase(),
      phone: String(body.phone || ""),
      password: String(body.password || ""),
    }),
  });

  const token = String(result.data?.session_token || "");

  if (!result.response.ok || !token) {
    return json(result.data, result.response.status);
  }

  const check = await validateEngineSession(token);
  if (!check.ok || !check.user) {
    console.error("[AUTH REGISTER] session validation failed", {
      status: check.status,
      data: check.data,
    });
    return json(
      {
        error: "A conta foi criada, mas a sessão não pôde ser validada.",
        code: "SESSION_CREATED_BUT_INVALID",
      },
      502,
    );
  }

  return json(
    {
      ok: true,
      user: check.user,
      session_token: token,
    },
    200,
    {
      "Set-Cookie": sessionCookieHeader(token),
      "X-Arles-Session-Created": "1",
    },
  );
}
