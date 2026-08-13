import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "../dashboard/ThemeToggle";
import {
  Save,
  Loader2,
  ImagePlus,
  MessageCircle,
  BrainCircuit,
  Settings as SettingsIcon,
} from "lucide-react";
import { WhatsApp } from "@/platform/channels/WhatsApp";
import { StoreInfo } from "./StoreInfo";
import { engineData, engineRequest } from "@/lib/arles-engine";
import { useAuth } from "@/lib/auth";

type GeneralSettings = {
  display_name: string;
  phone: string;
  email: string;
  instagram: string;
  notifications_sound: boolean;
};

export function DeliverySettings({
  initialTab = "geral",
}: {
  initialTab?: "geral" | "whatsapp" | "info";
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"geral" | "whatsapp" | "info">(initialTab);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [general, setGeneral] = useState<GeneralSettings>({
    display_name: "",
    phone: "",
    email: "",
    instagram: "",
    notifications_sound: true,
  });

  useEffect(() => setActiveTab(initialTab), [initialTab]);

  useEffect(() => {
    let cancelled = false;

    async function loadGeneral() {
      if (!user?.companyId) return;
      setLoading(true);

      try {
        const data = await engineData<Partial<GeneralSettings>>("settings");
        if (!cancelled) {
          setGeneral({
            display_name: data?.display_name || user.company,
            phone: data?.phone || "",
            email: data?.email || user.username || "",
            instagram: data?.instagram || "",
            notifications_sound: data?.notifications_sound !== false,
          });
        }
      } catch (error) {
        console.error("Ajustes Engine:", error);
        if (!cancelled) {
          setGeneral({
            display_name: user.company,
            phone: "",
            email: user.username || "",
            instagram: "",
            notifications_sound: true,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadGeneral();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSave = async () => {
    if (!user?.companyId) return;
    setSaving(true);
    setSaved(false);

    try {
      await engineRequest("settings", {
        method: "PUT",
        body: {
          display_name: general.display_name.trim() || user.company,
          phone: general.phone.trim() || null,
          email: general.email.trim() || null,
          instagram: general.instagram.trim() || null,
          notifications_sound: general.notifications_sound,
        },
      });
    } catch (error: any) {
      setSaving(false);
      alert("Erro ao salvar: " + (error?.message || "erro desconhecido"));
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ajustes do Sistema</h2>
        <p className="text-muted-foreground">
          Gerencie as configurações gerais, WhatsApp e base da IA.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 pb-4 border-b">
        <button
          onClick={() => setActiveTab("geral")}
          className={`flex flex-col items-center justify-center py-2 px-1 text-xs font-medium rounded-lg transition-colors ${activeTab === "geral" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          <SettingsIcon className="size-4 mb-1" /> Geral
        </button>
        <button
          onClick={() => setActiveTab("whatsapp")}
          className={`flex flex-col items-center justify-center py-2 px-1 text-xs font-medium rounded-lg transition-colors ${activeTab === "whatsapp" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          <MessageCircle className="size-4 mb-1" /> WhatsApp
        </button>
        <button
          onClick={() => setActiveTab("info")}
          className={`flex flex-col items-center justify-center py-2 px-1 text-xs font-medium rounded-lg transition-colors ${activeTab === "info" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          <BrainCircuit className="size-4 mb-1" /> Regras IA
        </button>
      </div>

      <div className="pt-4">
        {activeTab === "geral" &&
          (loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-[200px_1fr] max-w-3xl animate-in fade-in">
              <div className="flex flex-col gap-3">
                <Label>Logo da Empresa</Label>
                <div className="size-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center bg-muted/20 text-muted-foreground">
                  <ImagePlus className="size-8 mb-2 opacity-50" />
                  <span className="text-xs font-medium">Logo</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Empresa (Exibição)</Label>
                  <Input
                    value={general.display_name}
                    onChange={(e) => setGeneral((v) => ({ ...v, display_name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone de Contato</Label>
                    <Input
                      value={general.phone}
                      onChange={(e) => setGeneral((v) => ({ ...v, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={general.email}
                      onChange={(e) => setGeneral((v) => ({ ...v, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Instagram da Empresa</Label>
                  <Input
                    value={general.instagram}
                    onChange={(e) => setGeneral((v) => ({ ...v, instagram: e.target.value }))}
                    placeholder="@suaempresa"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado somente no pedido de avaliação para o cliente marcar a empresa.
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-base">Preferências do Sistema</Label>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Aparência (Tema)</p>
                      <p className="text-xs text-muted-foreground">
                        Alternar entre modo claro e escuro
                      </p>
                    </div>
                    <ThemeToggle />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Notificações Sonoras</p>
                      <p className="text-xs text-muted-foreground">
                        Tocar alerta para novos pedidos
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={general.notifications_sound}
                      onChange={(e) =>
                        setGeneral((v) => ({ ...v, notifications_sound: e.target.checked }))
                      }
                      className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="pt-6 flex items-center gap-3">
                  <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto px-8">
                    {saving ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="size-4 mr-2" />
                    )}
                    Salvar Alterações
                  </Button>
                  {saved && <span className="text-sm text-muted-foreground">Salvo.</span>}
                </div>
              </div>
            </div>
          ))}

        {activeTab === "whatsapp" && (
          <div className="animate-in fade-in">
            <WhatsApp />
          </div>
        )}
        {activeTab === "info" && (
          <div className="animate-in fade-in">
            <StoreInfo />
          </div>
        )}
      </div>
    </div>
  );
}
