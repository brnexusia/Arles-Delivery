import { engineData } from "@/lib/arles-engine";

export type SubscriptionStatus = "trial" | "active" | "expired" | "past_due" | "canceled";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  daysRemaining: number | null;
  hasAccess: boolean;
  isExpired: boolean;
  isTrialExpiring: boolean;

  planKey: string | null;
  contactLimit: number | null;
  contactsUsed: number | null;

  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  essential: "Essencial",
  professional: "Profissional",
  scale: "Escala",
};

export type BillingPlan = {
  key: string;
  name: string;
  priceCents: number;
  currency: string;
  contacts: number;
};

export async function getBillingCatalog(): Promise<BillingPlan[]> {
  const rows = await engineData<any[]>("billing/catalog");
  return rows.map((row) => ({
    key: String(row.plan_key),
    name: String(row.display_name),
    priceCents: Number(row.display_price_cents),
    currency: String(row.currency || "BRL"),
    contacts: Number(row.contact_limit),
  }));
}

export function planLabel(key: string | null): string {
  return key ? (PLAN_LABELS[key] ?? key) : "—";
}

export async function getSubscriptionInfo(_companyId?: string): Promise<SubscriptionInfo | null> {
  try {
    const raw = await engineData<any>("billing/subscription");

    return {
      status: raw.status as SubscriptionStatus,
      trialEndsAt: raw.trialEndsAt ? new Date(raw.trialEndsAt) : null,
      subscriptionEndsAt: raw.subscriptionEndsAt ? new Date(raw.subscriptionEndsAt) : null,
      daysRemaining: raw.daysRemaining ?? null,
      hasAccess: raw.hasAccess === true,
      isExpired: raw.isExpired === true,
      isTrialExpiring: raw.isTrialExpiring === true,
      planKey: raw.planKey ?? null,
      contactLimit: raw.contactLimit ?? null,
      contactsUsed: raw.contactsUsed ?? 0,
      stripeCustomerId: raw.stripeCustomerId ?? null,
      stripeSubscriptionId: raw.stripeSubscriptionId ?? null,
      cancelAtPeriodEnd: raw.cancelAtPeriodEnd === true,
    };
  } catch (error) {
    console.error("[subscription]", error);
    return null;
  }
}

export async function hasActiveAccess(companyId?: string): Promise<boolean> {
  const info = await getSubscriptionInfo(companyId);
  return info?.hasAccess ?? false;
}
