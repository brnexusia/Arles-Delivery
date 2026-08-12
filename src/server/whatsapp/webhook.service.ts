// src/server/whatsapp/webhook.service.ts
import { supabase } from "@/lib/supabase";

export class WebhookService {
  private n8nWebhookUrl: string;

  constructor() {
    this.n8nWebhookUrl = process.env.N8N_INBOUND_WEBHOOK_URL || "https://your-n8n.com/webhook/whatsapp";
  }

  async processEvolutionWebhook(body: any) {
    if (!body || !body.instance) return { success: false, reason: "Invalid payload" };

    const instanceName = body.instance;
    const eventType = body.event;
    
    // Find connection in DB
    const { data: connection, error } = await supabase
      .from("whatsapp_connections")
      .select("id, company_id, status")
      .eq("instance_name", instanceName)
      .single();

    if (error || !connection) {
      console.error(`Webhook received for unknown instance: ${instanceName}`);
      return { success: false, reason: "Unknown instance" };
    }

    // Handle connection updates
    if (eventType === "CONNECTION_UPDATE") {
      const state = body.data?.state;
      let newStatus = connection.status;
      if (state === "open") newStatus = "connected";
      else if (state === "connecting") newStatus = "connecting";
      else if (state === "close") newStatus = "disconnected";

      if (newStatus !== connection.status) {
        await supabase.from("whatsapp_connections").update({ status: newStatus }).eq("id", connection.id);
      }
      return { success: true };
    }

    // Forward messages to n8n
    if (eventType === "MESSAGES_UPSERT") {
      const messageData = body.data?.message;
      if (!messageData) return { success: true };

      // Simplified payload for n8n
      const payload = {
        company_id: connection.company_id,
        instance_name: instanceName,
        phone: body.data.key.remoteJid,
        message: messageData.conversation || messageData.extendedTextMessage?.text || "",
        message_id: body.data.key.id,
        timestamp: new Date().toISOString()
      };

      try {
        await fetch(this.n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error(`Failed to forward message to n8n for company ${connection.company_id}`, err);
      }
      return { success: true };
    }

    return { success: true, event: eventType };
  }
}

export const webhookService = new WebhookService();
