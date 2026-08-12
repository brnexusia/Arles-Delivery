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

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return json({ error: "Informe e-mail e senha." }, 400);
  }

  try {
    const result = await engineFetch("/internal/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const token = String(result.data?.session_token || "");

    if (!result.response.ok || !token) {
      return json(result.data, result.response.status);
    }

    // O login só responde 200 se a sessão recém-criada também funcionar
    // no endpoint /internal/auth/session do Engine.
    const check = await validateEngineSession(token);
    if (!check.ok || !check.user) {
      console.error("[AUTH LOGIN] session validation failed", {
        status: check.status,
        data: check.data,
      });
      return json(
        {
          error: "A sessão foi criada, mas não pôde ser validada.",
          code: "SESSION_CREATED_BUT_INVALID",
        },
        502,
      );
    }

    return json(
      {
        ok: true,
        user: check.user,
        // Fallback proposital para o browser persistir a sessão quando
        // o Set-Cookie HttpOnly for perdido por alguma camada de runtime/proxy.
        session_token: token,
      },
      200,
      {
        "Set-Cookie": sessionCookieHeader(token),
        "X-Arles-Session-Created": "1",
      },
    );
  } catch (error: any) {
    console.error("[AUTH LOGIN]", error);
    return json({ error: error?.message || "Falha no login." }, 500);
  }
}
