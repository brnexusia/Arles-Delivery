import type { Context } from "@netlify/functions";
import Stripe from "stripe";
import {
  engineFetch,
  engineSession,
  json,
} from "../lib/arles-server.mts";

type PlanKey = "essential" | "professional" | "scale";

const PLAN_LIMITS: Record<PlanKey, number> = {
  essential: 360,
  professional: 1500,
  scale: 3000,
};

function priceFor(plan: PlanKey) {
  return {
    essential: process.env.STRIPE_PRICE_ESSENTIAL,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    scale: process.env.STRIPE_PRICE_SCALE,
  }[plan];
}

export default async function handler(req: Request, context: Context) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  if (!stripeKey) return json({ error: "STRIPE_NOT_CONFIGURED" }, 500);

  const auth = await engineSession(req, context);
  if (!auth.user || auth.user.role === "admin") {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const planKey = String(body.plan_key || "").toLowerCase() as PlanKey;
  if (!(planKey in PLAN_LIMITS)) {
    return json({ error: "Invalid plan_key" }, 400);
  }

  const priceId = priceFor(planKey);
  if (!priceId) {
    return json({ error: `Stripe price for ${planKey} is not configured.` }, 500);
  }

  const companyId = auth.user.companyId;
  const billingContext = await engineFetch(
    `/internal/billing/context?company_id=${encodeURIComponent(companyId)}`,
    { method: "GET" },
  );

  if (!billingContext.response.ok || !billingContext.data?.data) {
    return json(billingContext.data, billingContext.response.status);
  }

  const company = billingContext.data.data;

  if (
    company.subscription_status === "active" &&
    company.stripe_subscription_id
  ) {
    return json({ already_subscribed: true }, 409);
  }

  const stripe = new Stripe(stripeKey);

  try {
    let customerId = company.stripe_customer_id as string | null;

    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if ((customer as Stripe.DeletedCustomer).deleted) customerId = null;
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: company.name,
        email: company.email || undefined,
        metadata: { company_id: companyId },
      });
      customerId = customer.id;

      const saved = await engineFetch("/internal/billing/customer", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          customer_id: customerId,
        }),
      });

      if (!saved.response.ok) {
        return json(saved.data, saved.response.status);
      }
    }

    const appUrl = (process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        company_id: companyId,
        plan_key: planKey,
      },
      subscription_data: {
        metadata: {
          company_id: companyId,
          plan_key: planKey,
        },
      },
      success_url: `${appUrl}/?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?tab=billing&checkout=cancelled`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return json({ error: "Stripe did not return a Checkout URL." }, 502);
    }

    return json({ url: session.url });
  } catch (error: any) {
    console.error("[CHECKOUT]", error);
    return json({ error: error?.message || "Checkout failed" }, 500);
  }
}
