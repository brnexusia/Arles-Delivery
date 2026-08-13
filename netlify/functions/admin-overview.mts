import type { Context } from "@netlify/functions";
import { engineFetch, engineSession, json } from "../lib/arles-server.mts";

export default async function handler(req: Request, context: Context) {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const session = await engineSession(req, context);
    if (!session.user) return json({ error: "SESSION_EXPIRED" }, 401);
    if (session.user.role !== "admin") return json({ error: "ADMIN_REQUIRED" }, 403);

    const result = await engineFetch("/internal/admin/overview", {
      method: "GET",
      headers: { "X-Arles-Session": session.token },
    });
    return json(result.data, result.response.status);
  } catch (error: any) {
    console.error("[ADMIN OVERVIEW]", error);
    return json({ error: error?.message || "ENGINE_UNREACHABLE" }, 502);
  }
}
