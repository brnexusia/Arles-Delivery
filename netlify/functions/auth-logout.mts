import type { Context } from "@netlify/functions";
import {
  clearSessionCookieHeader,
  engineFetch,
  json,
  readSessionCookie,
} from "../lib/arles-server.mts";

export default async function handler(req: Request, context: Context) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = readSessionCookie(req, context);

  if (token) {
    await engineFetch("/internal/auth/logout", {
      method: "POST",
      headers: { "X-Arles-Session": token },
    }).catch(() => undefined);
  }

  return json(
    { ok: true },
    200,
    { "Set-Cookie": clearSessionCookieHeader() },
  );
}
