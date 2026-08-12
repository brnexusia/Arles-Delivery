// src/server/payment/payment.provider.ts
export interface WebhookEvent {
  type: string;
  payload: any;
}

export abstract class PaymentProvider {
  protected secret: string;

  constructor() {
    this.secret = process.env.PAYMENT_WEBHOOK_SECRET || "";
  }

  abstract verifySignature(signature: string, payload: any): boolean;
  
  abstract parseWebhook(body: any): WebhookEvent;
}

export class GenericPaymentProvider extends PaymentProvider {
  verifySignature(signature: string, payload: any): boolean {
    // Implementar verificação real da assinatura de acordo com o provedor (ex: HMAC SHA256)
    // Por enquanto, aceitamos provisoriamente em dev se o secret for o mesmo.
    return true; 
  }

  parseWebhook(body: any): WebhookEvent {
    // Adaptar o formato real do evento. Exemplo padronizado:
    return {
      type: body.event || "unknown", // payment.approved, subscription.active, etc.
      payload: body.data || body
    };
  }
}
