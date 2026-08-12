// src/server/payment/subscription.service.ts
import { supabase } from "@/lib/supabase";
import { GenericPaymentProvider } from "./payment.provider";

export class SubscriptionService {
  private provider: GenericPaymentProvider;

  constructor() {
    this.provider = new GenericPaymentProvider();
  }

  async hasActiveAccess(companyNameOrId: string): Promise<boolean> {
    const { data: company, error } = await supabase
      .from("companies")
      .select("subscription_status, trial_ends_at")
      .eq("name", companyNameOrId)
      .single();

    if (error || !company) return false;

    if (company.subscription_status === "active") return true;

    if (company.subscription_status === "trial") {
      const now = new Date();
      const endsAt = new Date(company.trial_ends_at);
      return now < endsAt;
    }

    return false;
  }

  async processWebhook(body: any, signature: string) {
    if (!this.provider.verifySignature(signature, body)) {
      throw new Error("Invalid signature");
    }

    const { type, payload } = this.provider.parseWebhook(body);
    
    // Identificar a empresa (pelo email do cliente, ID customizado ou meta-data)
    // Como exemplo genérico, vamos assumir que o provedor enviou o company_id no metadados
    const companyId = payload.metadata?.company_id || payload.customer?.email; 

    if (!companyId) throw new Error("Company ID not found in payload");

    let statusUpdate = {};

    switch (type) {
      case "payment.approved":
      case "subscription.active":
        statusUpdate = {
          subscription_status: "active",
          subscription_started_at: new Date().toISOString()
        };
        break;
      case "subscription.canceled":
      case "payment.refunded":
        statusUpdate = { subscription_status: "canceled" };
        break;
      case "payment.failed":
        statusUpdate = { subscription_status: "past_due" };
        break;
      default:
        console.log(`Unhandled webhook event type: ${type}`);
        return { success: true, ignored: true };
    }

    const { error } = await supabase
      .from("companies")
      .update(statusUpdate)
      .eq("name", companyId); // Assumindo que name é o identificador usado em Auth

    if (error) {
      console.error("Erro ao atualizar subscription:", error);
      throw error;
    }

    return { success: true };
  }
}

export const subscriptionService = new SubscriptionService();
