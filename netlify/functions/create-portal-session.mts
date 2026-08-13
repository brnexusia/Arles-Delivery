import type { Context } from "@netlify/functions";
import Stripe from "stripe";
import { engineFetch, engineSession, json } from "../lib/arles-server.mts";

export default async function handler(req: Request, context: Context) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  if (!stripeKey) return json({ error: "STRIPE_NOT_CONFIGURED" }, 500);

  const auth = await engineSession(req, context);
  if (!auth.user || auth.user.role === "admin") {
    return json({ error: "Unauthorized" }, 401);
  }

  const billingContext = await engineFetch("/internal/platform/billing/context", {
    method: "GET",
    headers: { "X-Arles-Session": auth.token },
  });

  if (!billingContext.response.ok || !billingContext.data?.data) {
    return json(billingContext.data, billingContext.response.status);
  }

  const customerId = billingContext.data.data.stripe_customer_id;
  if (!customerId) {
    return json({ error: "No Stripe customer exists for this company." }, 400);
  }

  try {
    const stripe = new Stripe(stripeKey);
    const appUrl = (process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "");

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/?tab=billing`,
    });

    return json({ url: session.url });
  } catch (error: any) {
    console.error("[PORTAL]", error);
    return json({ error: error?.message || "Portal failed" }, 500);
  }
}
