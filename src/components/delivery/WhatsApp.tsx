import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, QrCode, AlertCircle, Loader2, Zap, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { engineRequest } from "@/lib/arles-engine";

type WaStatus = "loading" | "disconnected" | "connecting" | "connected" | "error";

export function WhatsApp() {
  const { user } = useAuth();
  const [status, setStatus] = useState<WaStatus>("loading");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = () => {
    if (statusPollRef.current) clearInterval(statusPollRef.current);
    if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
    statusPollRef.current = null;
    qrRefreshRef.current = null;
  };

  const markConnected = useCallback(async () => {
    if (!user) return;
    window.dispatchEvent(new Event("onboarding-step-completed"));
  }, [user]);

  const fetchStatus = useCallback(async (silent = false) => {
    if (!user) return;
    try {
      const data = await engineRequest<any>("whatsapp/status");

      const next: WaStatus = data.status === "connected" ? "connected"
        : data.status === "connecting" ? "connecting"
        : data.status === "unconfigured" ? "error"
        : "disconnected";

      setStatus(next);
      setPhone(data.phoneNumber || null);
      if (next === "connected") await markConnected();
      return next;
    } catch (error) {
      console.error("WhatsApp status:", error);
      if (!silent) setStatus("error");
    }
  }, [user, markConnected]);

  const requestQr = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) {
      setStatus("connecting");
      setQrCode(null);
    }

    try {
      const data = await engineRequest<any>("whatsapp/connect", {
        method: "POST",
        body: {},
      });

      if (data.status === "connected") {
        setQrCode(null);
        setPhone(data.phoneNumber || null);
        setStatus("connected");
        await markConnected();
        return;
      }

      if (data.qrCodeBase64) setQrCode(data.qrCodeBase64);
      setStatus("connecting");
    } catch (error) {
      console.error("WhatsApp connect:", error);
      if (!silent) setStatus("error");
    }
  }, [user, markConnected]);

  useEffect(() => {
    void fetchStatus();
    return stopTimers;
  }, [fetchStatus]);

  useEffect(() => {
    stopTimers();
    if (status !== "connecting") return;

    statusPollRef.current = setInterval(async () => {
      const next = await fetchStatus(true);
      if (next === "connected" || next === "disconnected" || next === "error") stopTimers();
    }, 3000);

    qrRefreshRef.current = setInterval(() => void requestQr(true), 25000);
    return stopTimers;
  }, [status, fetchStatus, requestQr]);

  const disconnect = async () => {
    if (!user) return;
    stopTimers();
    try {
      await engineRequest("whatsapp/disconnect", {
        method: "POST",
        body: {},
      });
      setQrCode(null);
      setPhone(null);
      setStatus("disconnected");
    } catch (error) {
      console.error("WhatsApp disconnect:", error);
      setStatus("error");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">WhatsApp</h2>
        <p className="text-muted-foreground">Conecte o número que receberá e responderá os pedidos automaticamente.</p>
      </div>

      <div className="max-w-md">
        <Card className="shadow-md border-border/50">
          <CardContent className="p-8 flex flex-col items-center text-center">
            {status === "loading" && <><Loader2 className="size-12 text-muted-foreground animate-spin mb-6"/><h3 className="text-lg font-semibold text-muted-foreground">Verificando conexão...</h3></>}

            {status === "disconnected" && <>
              <div className="size-20 rounded-full bg-muted flex items-center justify-center mb-6"><QrCode className="size-10 text-muted-foreground"/></div>
              <h3 className="text-xl font-semibold mb-2">WhatsApp desconectado</h3>
              <p className="text-sm text-muted-foreground mb-8">Leia o QR Code com o WhatsApp da loja para ativar o atendimento automático.</p>
              <Button onClick={() => void requestQr()} size="lg" className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white">Conectar WhatsApp</Button>
            </>}

            {status === "connecting" && <>
              {qrCode ? <>
                <div className="mb-5 border-4 border-muted rounded-xl overflow-hidden bg-white p-2 shadow-sm">
                  <img src={qrCode.startsWith("data:image") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="size-52 object-contain"/>
                </div>
                <h3 className="text-lg font-semibold mb-1">QR Code pronto</h3>
                <p className="text-sm text-muted-foreground">Abra o WhatsApp no celular, toque em <strong>Dispositivos vinculados</strong> e escaneie o código.</p>
                <p className="text-xs text-muted-foreground mt-3 opacity-70">Aguardando conexão...</p>
              </> : <>
                <div className="size-20 rounded-full bg-muted flex items-center justify-center mb-6"><Loader2 className="size-10 text-muted-foreground animate-spin"/></div>
                <h3 className="text-xl font-semibold mb-2">Preparando conexão...</h3>
                <p className="text-sm text-muted-foreground">O QR Code será exibido em instantes.</p>
              </>}
            </>}

            {status === "error" && <>
              <div className="size-20 rounded-full bg-red-100 flex items-center justify-center mb-6"><AlertCircle className="size-10 text-red-600"/></div>
              <h3 className="text-xl font-semibold mb-2">Não foi possível conectar.</h3>
              <p className="text-sm text-muted-foreground mb-8">Tente novamente.</p>
              <Button onClick={() => void requestQr()} size="lg" className="w-full">Tentar novamente</Button>
            </>}

            {status === "connected" && <>
              <div className="size-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6 relative">
                <Smartphone className="size-10 text-emerald-600"/><span className="absolute bottom-1 right-1 size-4 bg-emerald-500 border-2 border-white rounded-full"/>
              </div>
              <h3 className="text-xl font-semibold mb-1 text-emerald-700">WhatsApp conectado</h3>
              {phone && <p className="text-sm font-medium mb-1">{phone}</p>}
              <div className="mt-4 mb-6 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 w-full">
                <Zap className="size-4 text-emerald-600 shrink-0"/><p className="text-sm font-semibold text-emerald-800 text-left">ATENDIMENTO AUTOMÁTICO ATIVO</p>
              </div>
              <p className="text-xs text-muted-foreground mb-6">A IA está ativa e respondendo seus clientes automaticamente.</p>
              <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10" onClick={() => void disconnect()}><WifiOff className="size-4 mr-2"/>Desconectar</Button>
            </>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
