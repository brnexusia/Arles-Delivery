import type { Context } from "@netlify/functions";
import Stripe from "stripe";
import {
  engineFetch,
} from "../lib/arles-server.mts";

function subscriptionIdFromInvoice(invoice: any): string | null {
  const direct =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  if (direct) return direct;

  const parent = invoice.parent?.subscription_details?.subscription;
  if (typeof parent === "string") return parent;
  if (parent?.id) return parent.id;

  return null;
}

function normalizeSubscription(
  event: Stripe.Event,
  sub: any,
  fallback: { companyId?: string | null; planKey?: string | null } = {},
) {
  const item = sub?.items?.data?.[0] || {};
  const customer =
    typeof sub?.customer === "string"
      ? sub.customer
      : sub?.customer?.id || null;

  const periodEndSeconds =
    item?.current_period_end ??
    sub?.current_period_end ??
    null;

  const startSeconds =
    sub?.start_date ??
    sub?.created ??
    null;

  const monthlyPriceCents = (sub?.items?.data || []).reduce(
    (total: number, subscriptionItem: any) => {
      const price = subscriptionItem?.price;
      const unitAmount = Number(price?.unit_amount);
      const quantity = Number(subscriptionItem?.quantity || 1);
      const count = Math.max(1, Number(price?.recurring?.interval_count || 1));
      if (!Number.isFinite(unitAmount)) return total;

      const interval = price?.recurring?.interval;
      const amount = unitAmount * quantity;
      if (interval === "year") return total + Math.round(amount / (12 * count));
      if (interval === "week") return total + Math.round((amount * 52) / (12 * count));
      if (interval === "day") return total + Math.round((amount * 365) / (12 * count));
      return total + Math.round(amount / count);
    },
    0,
  );

  return {
    event_id: event.id,
    event_type: event.type,
    company_id:
      sub?.metadata?.company_id ||
      fallback.companyId ||
      null,
    plan_key:
      sub?.metadata?.plan_key ||
      fallback.planKey ||
      null,
    subscription_id: sub?.id || null,
    customer_id: customer,
    price_id: item?.price?.id || null,
    monthly_price_cents: monthlyPriceCents || null,
    stripe_status: sub?.status || null,
    current_period_end:
      periodEndSeconds
        ? new Date(Number(periodEndSeconds) * 1000).toISOString()
        : null,
    start_date:
      startSeconds
        ? new Date(Number(startSeconds) * 1000).toISOString()
        : null,
    cancel_at_period_end: sub?.cancel_at_period_end === true,
  };
}

async function forward(payload: any) {
  const result = await engineFetch("/internal/billing/stripe-event", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!result.response.ok) {
    throw new Error(result.data?.error || `Engine billing ${result.response.status}`);
  }
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!stripeKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey);
  const signature = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Invalid signature", error?.message);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await forward(
          normalizeSubscription(event, sub, {
            companyId: session.metadata?.company_id || null,
            planKey: session.metadata?.plan_key || null,
          }),
        );
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const payload = normalizeSubscription(event, sub);
        payload.stripe_status =
          event.type === "invoice.paid"
            ? "active"
            : "past_due";
        if (event.type === "invoice.paid") {
          payload.invoice_id = invoice.id || null;
          payload.amount_paid_cents = Number(invoice.amount_paid || 0);
          payload.currency = invoice.currency || "brl";
          payload.paid_at = invoice.status_transitions?.paid_at
            ? new Date(Number(invoice.status_transitions.paid_at) * 1000).toISOString()
            : new Date(event.created * 1000).toISOString();
        }
        await forward(payload);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await forward(
          normalizeSubscription(event, event.data.object as any),
        );
        break;
      }

      default:
        // Ignore unrelated events. Stripe can send many event types.
        break;
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error(`[STRIPE WEBHOOK] ${event.type}`, error);
    return new Response(
      error?.message || "Webhook processing failed",
      { status: 500 },
    );
  }
}
