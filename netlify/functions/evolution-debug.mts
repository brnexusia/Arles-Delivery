// netlify/functions/evolution-debug.mts
// Endpoint interno de diagnóstico — NUNCA retorna API Key
import type { Context } from "@netlify/functions";

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const apiUrl = process.env.EVOLUTION_API_URL || "";
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  const configured = Boolean(apiUrl && apiKey);

  let reachable = false;
  if (configured) {
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/instance/fetchInstances`, {
        method: "GET",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      reachable = res.ok || res.status === 401; // 401 means reachable but wrong key
    } catch {
      reachable = false;
    }
  }

  return new Response(
    JSON.stringify({
      configured,
      reachable,
      baseUrlPresent: Boolean(apiUrl),
      // NUNCA retornar apiKey ou apiUrl completa
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
