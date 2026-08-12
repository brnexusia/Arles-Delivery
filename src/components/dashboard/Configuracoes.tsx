import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Building2, Clock, MapPin, Phone, Globe, Scissors } from "lucide-react";
import { Servicos } from "@/components/dashboard/Servicos";

type CompanySettings = {
  id?: string;
  company: string;
  display_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  website: string | null;
  open_days: string | null;   // "Seg-Sex" etc
  open_time: string | null;   // "08:00"
  close_time: string | null;  // "18:00"
};

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function Configuracoes({ hasServices }: { hasServices: boolean }) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<"empresa" | "servicos">("empresa");

  // If services module was just disabled, reset to empresa tab
  useEffect(() => {
    if (!hasServices && subTab === "servicos") setSubTab("empresa");
  }, [hasServices]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState<CompanySettings>({
    company: user?.company ?? "",
    display_name: null,
    phone: null,
    address: null,
    city: null,
    website: null,
    open_days: null,
    open_time: null,
    close_time: null,
  });

  const [selectedDays, setSelectedDays] = useState<boolean[]>(Array(7).fill(false));

  const fetchSettings = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("company_settings")
      .select("*")
      .eq("company_id", user.companyId)
      .maybeSingle();

    if (data) {
      setSettings(data);
      if (data.open_days) {
        // parse "Seg,Ter,Qua" → boolean[]
        const saved = data.open_days.split(",").map((d: string) => d.trim());
        setSelectedDays(DAYS.map(d => saved.includes(d)));
      }
    } else {
      setSettings(s => ({ ...s, company: user.company }));
    }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, [user]);

  const toggleDay = (i: number) =>
    setSelectedDays(prev => prev.map((v, idx) => idx === i ? !v : v));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const open_days = DAYS.filter((_, i) => selectedDays[i]).join(",") || null;
    const payload = { ...settings, open_days };

    const { data: existing } = await supabase
      .from("company_settings")
      .select("id")
      .eq("company_id", user.companyId)
      .maybeSingle();

    let error: any;
    if (existing?.id) {
      ({ error } = await supabase.from("company_settings").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("company_settings").insert([{ ...payload, company: user.company }]));
    }

    setSaving(false);
    if (error) { alert("Erro ao salvar: " + error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const set = (key: keyof CompanySettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings(s => ({ ...s, [key]: e.target.value || null }));

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation — only show if services module is enabled */}
      {hasServices && (
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        <button
          onClick={() => setSubTab("empresa")}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            subTab === "empresa"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="size-3.5" />
          Empresa
        </button>
        <button
          onClick={() => setSubTab("servicos")}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            subTab === "servicos"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scissors className="size-3.5" />
          Serviços
        </button>
      </div>
      )}

      {subTab === "servicos" && hasServices ? (
        <Servicos />
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Informações básicas */}
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Informações da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome de exibição</Label>
                  <Input value={settings.display_name ?? ""} onChange={set("display_name")} placeholder="Como seu negócio aparece" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Phone className="size-3.5" />Telefone / WhatsApp</Label>
                  <Input value={settings.phone ?? ""} onChange={set("phone")} placeholder="(11) 99999-0000" inputMode="tel" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Globe className="size-3.5" />Website / Instagram</Label>
                <Input value={settings.website ?? ""} onChange={set("website")} placeholder="https://... ou @seuinsta" />
              </div>
            </CardContent>
          </Card>

          {/* Localização */}
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                Localização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={settings.address ?? ""} onChange={set("address")} placeholder="Rua, número, bairro" />
              </div>
              <div className="space-y-2">
                <Label>Cidade / Estado</Label>
                <Input value={settings.city ?? ""} onChange={set("city")} placeholder="São Paulo - SP" />
              </div>
            </CardContent>
          </Card>

          {/* Horário de atendimento */}
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Horário de Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-3 block">Dias da semana</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedDays[i]
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Abre às</Label>
                  <Input type="time" value={settings.open_time ?? ""} onChange={set("open_time")} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha às</Label>
                  <Input type="time" value={settings.close_time ?? ""} onChange={set("close_time")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            {saved ? "Salvo com sucesso!" : "Salvar Configurações"}
          </Button>
        </form>
      )}
    </div>
  );
}
