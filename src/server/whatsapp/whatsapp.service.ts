// src/server/whatsapp/whatsapp.service.ts
import { EvolutionWhatsAppProvider } from "./evolution.provider";
import { supabase } from "@/lib/supabase";

export class WhatsAppService {
  private provider: EvolutionWhatsAppProvider;

  constructor() {
    this.provider = new EvolutionWhatsAppProvider();
  }

  private async getConnection(companyId: string) {
    const { data, error } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("company_id", companyId)
      .single();
    if (error) throw error;
    return data;
  }

  private async updateConnectionStatus(id: string, status: string, additionalData: any = {}) {
    await supabase.from("whatsapp_connections").update({ status, ...additionalData }).eq("id", id);
  }

  async connect(companyId: string) {
    if (!this.provider.isConfigured()) {
      throw new Error("Evolution API não configurada.");
    }

    let connection = await this.getConnection(companyId).catch(() => null);

    if (!connection) {
      // Create new connection if none exists
      const instanceName = `arles-${companyId.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.random().toString(36).substring(2, 6)}`;
      const { data, error } = await supabase.from("whatsapp_connections").insert([{
        company_id: companyId,
        instance_name: instanceName,
        status: "connecting"
      }]).select().single();
      if (error) throw error;
      connection = data;
    }

    try {
      // Create instance on provider
      await this.provider.createInstance(connection.instance_name);
      
      // Configure webhook
      await this.provider.configureWebhook(connection.instance_name);

      // Get QR Code
      const qrData = await this.provider.getQrCode(connection.instance_name);
      
      await this.updateConnectionStatus(connection.id, "connecting");
      
      return {
        instanceName: connection.instance_name,
        qrCodeBase64: qrData?.base64 || qrData?.qrcode || null,
        status: "connecting"
      };
    } catch (err: any) {
      await this.updateConnectionStatus(connection.id, "error");
      throw new Error("Falha ao inicializar WhatsApp: " + err.message);
    }
  }

  async getStatus(companyId: string) {
    if (!this.provider.isConfigured()) {
      return { status: "unconfigured" };
    }

    const connection = await this.getConnection(companyId);
    if (!connection) return { status: "disconnected" };

    try {
      const state = await this.provider.getConnectionStatus(connection.instance_name);
      
      let newStatus = connection.status;
      if (state.instance?.state === "open") newStatus = "connected";
      else if (state.instance?.state === "connecting") newStatus = "connecting";
      else newStatus = "disconnected";

      if (newStatus !== connection.status) {
        await this.updateConnectionStatus(connection.id, newStatus);
      }

      return { status: newStatus, phoneNumber: state.instance?.owner || connection.phone_number };
    } catch (err) {
      return { status: connection.status }; // Return last known if API fails
    }
  }

  async disconnect(companyId: string) {
    const connection = await this.getConnection(companyId);
    if (connection) {
      try {
        await this.provider.disconnect(connection.instance_name);
      } catch (e) {
        console.error("Provider disconnect failed", e);
      }
      await this.updateConnectionStatus(connection.id, "disconnected");
    }
    return { success: true };
  }
}

export const whatsappService = new WhatsAppService();
