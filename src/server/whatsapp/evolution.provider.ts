// src/server/whatsapp/evolution.provider.ts
export class EvolutionWhatsAppProvider {
  private apiUrl: string;
  private apiKey: string;
  private webhookBaseUrl: string;

  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL || "";
    this.apiKey = process.env.EVOLUTION_API_KEY || "";
    this.webhookBaseUrl = process.env.N8N_INBOUND_WEBHOOK_URL || "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.apiKey);
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    if (!this.isConfigured()) {
      throw new Error("Evolution API não configurada");
    }

    const url = `${this.apiUrl.replace(/\/$/, '')}${endpoint}`;
    
    const headers = {
      "Content-Type": "application/json",
      "apikey": this.apiKey,
      ...(options.headers || {})
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Evolution API Error (${res.status}): ${await res.text()}`);
      }
      
      return await res.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error("Evolution API Timeout");
      }
      throw err;
    }
  }

  async checkHealth() {
    if (!this.isConfigured()) return { configured: false, reachable: false };
    try {
      // Endpoint comum para testar se a API está de pé na Evolution
      // Substitua pelo endpoint real de instâncias ou server info
      await this.request("/instance/fetchInstances");
      return { configured: true, reachable: true };
    } catch {
      return { configured: true, reachable: false };
    }
  }

  async createInstance(instanceName: string) {
    return this.request("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName,
        token: instanceName,
        qrcode: true,
      }),
    });
  }

  async getQrCode(instanceName: string) {
    return this.request(`/instance/connect/${instanceName}`, {
      method: "GET",
    });
  }

  async getConnectionStatus(instanceName: string) {
    return this.request(`/instance/connectionState/${instanceName}`, {
      method: "GET",
    });
  }

  async configureWebhook(instanceName: string) {
    const webhookUrl = `${process.env.VITE_APP_URL || "http://localhost:5173"}/api/webhooks/evolution`;
    return this.request(`/webhook/set/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        webhook: {
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: [
            "MESSAGES_UPSERT",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED"
          ]
        }
      }),
    });
  }

  async disconnect(instanceName: string) {
    return this.request(`/instance/logout/${instanceName}`, {
      method: "DELETE",
    });
  }

  async deleteInstance(instanceName: string) {
    return this.request(`/instance/delete/${instanceName}`, {
      method: "DELETE",
    });
  }

  async sendMessage(instanceName: string, phone: string, message: string) {
    return this.request(`/message/sendText/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number: phone,
        options: { delay: 1200, presence: "composing" },
        textMessage: { text: message }
      }),
    });
  }
}
