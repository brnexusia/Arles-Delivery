import type { Context } from "@netlify/functions";
import { engineSession, json } from "../lib/arles-server.mts";

export default async function handler(req: Request, context: Context) {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const session = await engineSession(req, context);

  if (!session.user) {
    return json({ ok: true, user: null }, 200);
  }

  return json({ ok: true, user: session.user }, 200);
}
