import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, Sparkles, Bot } from "lucide-react";
import { engineData, engineRequest } from "@/lib/arles-engine";
import { useAuth } from "@/lib/auth";

export function StoreInfo() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [form, setForm] = useState({
    store_name: "",
    short_description: "",
    avg_time: "30-40 min",
    min_order: "R$ 0,00",
    opening_hours: "Todos os dias das 18h as 23h",
    delivery_fee: "",
    neighborhoods: "",
    payment_methods: "",
    pix_key: "",
    ai_rules: "",
    ai_enabled: true
  });

  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const data = await engineData<any>("store-info");
        if (data) {
          setForm({
            store_name: data.store_name || "",
            short_description: data.short_description || "",
            avg_time: data.avg_time || "30-40 min",
            min_order: data.min_order != null ? `R$ ${Number(data.min_order).toFixed(2).replace(".", ",")}` : "R$ 0,00",
            opening_hours: data.opening_hours || "Todos os dias das 18h as 23h",
            delivery_fee: data.delivery_fee || "",
            neighborhoods: data.neighborhoods || "",
            payment_methods: data.payment_methods || "",
            pix_key: data.pix_key || "",
            ai_rules: data.ai_rules || "",
            ai_enabled: data.ai_enabled !== false,
          });
        }
      } catch (error) {
        console.error("Loja Engine:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    
    const payload = {
      store_name: form.store_name,
      short_description: form.short_description,
      avg_time: form.avg_time,
      min_order: parseFloat(form.min_order.replace(/[^\d,]/g, '').replace(',', '.') || '0'),
      opening_hours: form.opening_hours,
      delivery_fee: form.delivery_fee,
      neighborhoods: form.neighborhoods,
      payment_methods: form.payment_methods,
      pix_key: form.pix_key,
      ai_rules: form.ai_rules,
      ai_enabled: form.ai_enabled
    };

    try {
      await engineRequest("store-info", { method: "PUT", body: payload });
      window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "store_info" } }));
    } catch (error: any) {
      alert("Erro ao salvar: " + (error?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Informações da Loja</h2>
        <p className="text-muted-foreground">Base de conhecimento utilizada pela Inteligência Artificial no atendimento.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Loja</Label>
            <Input value={form.store_name} onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))} placeholder="Ex: Pizzaria Suprema" />
          </div>
          <div className="space-y-2">
            <Label>Descrição curta</Label>
            <Input value={form.short_description} onChange={e => setForm(f => ({ ...f, short_description: e.target.value }))} placeholder="Ex: A melhor pizza artesanal da região." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tempo Médio</Label>
              <select 
                value={form.avg_time} 
                onChange={e => setForm(f => ({ ...f, avg_time: e.target.value }))}
                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="15-25 min">15-25 min</option>
                <option value="30-40 min">30-40 min</option>
                <option value="45-60 min">45-60 min</option>
                <option value="60-90 min">60-90 min</option>
                <option value="Acima de 90 min">Acima de 90 min</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Pedido Mínimo</Label>
              <select 
                value={form.min_order} 
                onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))}
                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="R$ 0,00">Sem mínimo</option>
                <option value="R$ 20,00">R$ 20,00</option>
                <option value="R$ 30,00">R$ 30,00</option>
                <option value="R$ 50,00">R$ 50,00</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Horário de Funcionamento</Label>
            <select 
                value={form.opening_hours} 
                onChange={e => setForm(f => ({ ...f, opening_hours: e.target.value }))}
                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Todos os dias das 18h as 23h">Todos os dias das 18h as 23h</option>
                <option value="Ter a Dom das 18h as 23h">Ter a Dom das 18h as 23h</option>
                <option value="Seg a Sab das 11h as 15h">Seg a Sab das 11h as 15h</option>
                <option value="24 horas">24 horas</option>
              </select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Taxa de Entrega</Label>
            <Input value={form.delivery_fee} onChange={e => setForm(f => ({ ...f, delivery_fee: e.target.value }))} placeholder="Ex: R$ 5 a R$ 15 dependendo do bairro" />
          </div>
          <div className="space-y-2">
            <Label>Bairros Atendidos</Label>
            <Input value={form.neighborhoods} onChange={e => setForm(f => ({ ...f, neighborhoods: e.target.value }))} placeholder="Ex: Centro, Jardim, Bela Vista" />
          </div>
          <div className="space-y-2">
            <Label>Formas de Pagamento</Label>
            <Input value={form.payment_methods} onChange={e => setForm(f => ({ ...f, payment_methods: e.target.value }))} placeholder="Ex: Pix, Cartão e Dinheiro" />
          </div>
          <div className="space-y-2">
            <Label>Chave PIX (Para a IA enviar)</Label>
            <Input value={form.pix_key} onChange={e => setForm(f => ({ ...f, pix_key: e.target.value }))} placeholder="Ex: CNPJ 12.345.678/0001-90" />
          </div>
        </div>
        
        <div className="md:col-span-2 space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Bot className="size-4 text-primary" />
                Atendimento Automático
              </Label>
              <p className="text-xs text-muted-foreground">
                Quando ativado, a IA responde automaticamente as mensagens dos seus clientes.
              </p>
            </div>
            <Switch 
              checked={form.ai_enabled} 
              onCheckedChange={c => setForm(f => ({ ...f, ai_enabled: c }))} 
            />
          </div>
        </div>

        <div className="md:col-span-2 space-y-3 pt-4 border-t">
          <Label className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Informações adicionais que a IA deve saber
          </Label>
          <p className="text-xs text-muted-foreground">
            Escreva regras, promoções e detalhes específicos. A IA vai ler e usar isso para responder dúvidas dos clientes.
          </p>
          <Textarea 
            className="min-h-[150px] resize-none" 
            value={form.ai_rules}
            onChange={e => setForm(f => ({ ...f, ai_rules: e.target.value }))}
            placeholder="Ex: Aceitamos alterações na pizza até o início do preparo. Entregamos somente nos bairros Centro e Jardim. Brinde de refrigerante acima de R$80."
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto px-8">
        {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
        Salvar Conhecimento
      </Button>
    </div>
  );
}
