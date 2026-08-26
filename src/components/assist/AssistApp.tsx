import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  ClipboardList,
  Cog,
  FileInput,
  Home,
  Instagram,
  Loader2,
  LogOut,
  MessageCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Smartphone,
  Wrench,
} from "lucide-react";
import { useAuth, useSessionGuard } from "@/lib/auth";
import { engineData, engineRequest } from "@/lib/arles-engine";
import { WhatsApp } from "@/components/delivery/WhatsApp";

type Tab = "dashboard" | "orders" | "services" | "import" | "channels" | "settings";

type AssistOrder = {
  id: string;
  customer_name: string;
  customer_phone: string;
  channel: string;
  equipment_type?: string | null;
  brand?: string | null;
  model?: string | null;
  reported_issue?: string | null;
  quoted_min?: number | null;
  quoted_max?: number | null;
  approved_price?: number | null;
  status: string;
  diagnosis_notes?: string | null;
  internal_notes?: string | null;
  promised_at?: string | null;
  probable_service_name?: string | null;
  updated_at: string;
};

type AssistService = {
  id: string;
  category: string;
  equipment_type: string;
  brand?: string | null;
  model_pattern?: string | null;
  name: string;
  description?: string | null;
  pricing_mode: "exact" | "range" | "diagnosis";
  price_min?: number | null;
  price_max?: number | null;
  labor_price?: number | null;
  parts_price?: number | null;
  requires_diagnosis: boolean;
  active: boolean;
};

type AssistSettings = {
  business_name?: string;
  address?: string;
  instagram?: string;
  opening_hours?: string;
  diagnosis_fee?: number;
  diagnosis_waived_if_approved?: boolean;
  pickup_enabled?: boolean;
  default_warranty_days?: number;
};

type Overview = {
  metrics: {
    open_quotes?: number;
    in_service?: number;
    ready?: number;
    delivered_month?: number;
    revenue_month?: number;
  };
  orders: AssistOrder[];
};

type ImportPreview = {
  services: Array<Omit<AssistService, "id" | "active">>;
  warnings: string[];
};

const STATUS: Record<string, { label: string; next?: string }> = {
  triage: { label: "Triagem", next: "quoted" },
  quoted: { label: "Orçamento enviado", next: "awaiting_approval" },
  awaiting_approval: { label: "Aguardando aprovação", next: "received" },
  received: { label: "Recebido", next: "diagnosis" },
  diagnosis: { label: "Em diagnóstico", next: "approved" },
  approved: { label: "Aprovado", next: "repairing" },
  repairing: { label: "Em reparo", next: "ready" },
  ready: { label: "Pronto", next: "delivered" },
  delivered: { label: "Entregue" },
  cancelled: { label: "Cancelado" },
};

const brl = (value?: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const deviceLabel = (order: AssistOrder) =>
  [order.brand, order.model, order.equipment_type].filter(Boolean).join(" ") || "Aparelho não informado";

async function load<T>(path: string): Promise<T> {
  return engineData<T>(path);
}

export function AssistApp() {
  const { user, signOut } = useAuth();
  useSessionGuard();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const nav: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: "Visão geral", icon: <Home className="size-4" /> },
    { id: "orders", label: "Ordens", icon: <ClipboardList className="size-4" /> },
    { id: "services", label: "Serviços", icon: <Wrench className="size-4" /> },
    { id: "import", label: "Importar", icon: <FileInput className="size-4" /> },
    { id: "channels", label: "Canais", icon: <MessageCircle className="size-4" /> },
    { id: "settings", label: "Ajustes", icon: <Settings className="size-4" /> },
  ];

  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden bg-background">
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="p-6">
          <img src="/logo.png" alt="Arles" className="mb-2 h-8 w-auto object-contain" style={{ filter: "var(--logo-filter)" }} />
          <p className="text-sm font-semibold">Arles Assist</p>
          <p className="truncate text-xs text-muted-foreground">{user?.company}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4">
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                activeTab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        <div className="border-t p-4">
          <button onClick={() => void signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card p-4 md:hidden" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
          <div>
            <img src="/logo.png" alt="Arles" className="h-7 w-auto object-contain" style={{ filter: "var(--logo-filter)" }} />
            <p className="mt-1 text-[10px] font-semibold text-muted-foreground">ASSIST</p>
          </div>
          <span className="max-w-40 truncate rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">{user?.company}</span>
        </div>

        <div className="mx-auto w-full max-w-6xl p-4 sm:p-8">
          {activeTab === "dashboard" && <Dashboard onNavigate={setActiveTab} />}
          {activeTab === "orders" && <Orders />}
          {activeTab === "services" && <Services />}
          {activeTab === "import" && <Importer onDone={() => setActiveTab("services")} />}
          {activeTab === "channels" && <Channels />}
          {activeTab === "settings" && <AssistSettingsScreen />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t bg-card px-1 pt-2 md:hidden" style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
        {nav.map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-2 ${activeTab === item.id ? "text-primary" : "text-muted-foreground"}`}>
            {item.icon}<span className="max-w-full truncate px-1 text-[9px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function ScreenHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}

function Loading() {
  return <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-7 animate-spin text-muted-foreground" /></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</div>;
}

function Dashboard({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const refresh = async () => { try { setError(""); setData(await load<Overview>("assist/overview")); } catch (e: any) { setError(e?.message || "Falha ao carregar"); } };
  useEffect(() => { void refresh(); }, []);
  if (!data && !error) return <Loading />;
  if (error) return <Empty>Não foi possível carregar o Assist: {error}</Empty>;
  const m = data!.metrics || {};
  const cards = [
    ["Orçamentos abertos", m.open_quotes || 0, <Bot className="size-5" />],
    ["Em serviço", m.in_service || 0, <Activity className="size-5" />],
    ["Prontos", m.ready || 0, <PackageCheck className="size-5" />],
    ["Entregues no mês", m.delivered_month || 0, <CheckCircle2 className="size-5" />],
  ] as const;
  return <div className="space-y-7">
    <ScreenHeader title="Visão geral" description="Orçamentos, reparos e entregas da assistência em um só lugar." action={<button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"><RefreshCw className="size-4" /> Atualizar</button>} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(([label, value, icon]) => <div key={label} className="rounded-2xl border bg-card p-4"><div className="mb-5 flex items-center justify-between text-muted-foreground"><span className="text-xs font-semibold">{label}</span>{icon}</div><p className="text-3xl font-bold">{value}</p></div>)}
      <div className="rounded-2xl border bg-card p-4"><div className="mb-5 flex items-center justify-between text-muted-foreground"><span className="text-xs font-semibold">Faturamento no mês</span><Cog className="size-5" /></div><p className="text-2xl font-bold">{brl(m.revenue_month)}</p></div>
    </div>
    <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
      <div className="rounded-2xl border bg-card p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Atendimentos recentes</h2><button className="text-sm font-medium text-primary" onClick={() => onNavigate("orders")}>Ver todas</button></div>{!data!.orders?.length ? <Empty>Nenhuma OS ainda.</Empty> : <div className="space-y-2">{data!.orders.slice(0, 8).map((order) => <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{order.customer_name} · {deviceLabel(order)}</p><p className="truncate text-xs text-muted-foreground">{order.reported_issue || "Defeito ainda não detalhado"}</p></div><StatusBadge status={order.status} /></div>)}</div>}</div>
      <div className="rounded-2xl border bg-card p-5"><Bot className="mb-4 size-8 text-primary" /><h2 className="text-lg font-semibold">Importe o negócio</h2><p className="mt-2 text-sm text-muted-foreground">Cole tabela, texto de WhatsApp ou uma lista de preços. A IA organiza serviços, aparelhos e regras de orçamento.</p><button onClick={() => onNavigate("import")} className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Importar serviços com IA</button></div>
    </div>
  </div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">{STATUS[status]?.label || status}</span>;
}

function Orders() {
  const [orders, setOrders] = useState<AssistOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = async () => { setLoading(true); try { setOrders(await load<AssistOrder[]>("assist/orders")); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  const visible = useMemo(() => { const q = filter.trim().toLowerCase(); return q ? orders.filter(o => [o.customer_name,o.customer_phone,o.brand,o.model,o.equipment_type,o.reported_issue,o.status].some(v => String(v || "").toLowerCase().includes(q))) : orders; }, [orders, filter]);
  const advance = async (order: AssistOrder, next: string) => { setBusy(order.id); try { await engineRequest(`assist/orders/${order.id}`, { method: "PATCH", body: { status: next } }); await refresh(); } catch (e: any) { alert(e?.message || "Não foi possível atualizar a OS"); } finally { setBusy(null); } };
  return <div>
    <ScreenHeader title="Ordens de serviço" description="Acompanhe a jornada do orçamento até a entrega." />
    <div className="relative mb-5"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar cliente, aparelho, defeito ou status" className="h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
    {loading ? <Loading /> : !visible.length ? <Empty>Nenhuma ordem de serviço encontrada.</Empty> : <div className="space-y-3">{visible.map(order => <div key={order.id} className="rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="font-semibold">{order.customer_name}</h3><StatusBadge status={order.status} /><span className="text-xs text-muted-foreground">{order.channel}</span></div><p className="text-sm font-medium">{deviceLabel(order)}</p><p className="mt-1 text-sm text-muted-foreground">{order.reported_issue || "Sem relato de defeito"}</p>{order.probable_service_name && <p className="mt-2 text-xs"><b>Serviço provável:</b> {order.probable_service_name}</p>}{order.quoted_min != null && <p className="mt-1 text-xs"><b>Orçamento:</b> {order.quoted_max && order.quoted_max !== order.quoted_min ? `${brl(order.quoted_min)} – ${brl(order.quoted_max)}` : brl(order.quoted_min)}</p>}</div><div className="flex gap-2">{STATUS[order.status]?.next && <button disabled={busy===order.id} onClick={() => void advance(order, STATUS[order.status].next!)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy===order.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} Avançar para {STATUS[STATUS[order.status].next!]?.label}</button>}{!['delivered','cancelled'].includes(order.status) && <button disabled={busy===order.id} onClick={() => void advance(order, "cancelled")} className="rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted">Cancelar</button>}</div></div></div>)}</div>}
  </div>;
}

function Services() {
  const [services, setServices] = useState<AssistService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: "Reparo", equipment_type: "Celular", brand: "", model_pattern: "", name: "", description: "", pricing_mode: "exact" as AssistService["pricing_mode"], price_min: "", price_max: "", requires_diagnosis: false });
  const refresh = async () => { setLoading(true); try { setServices(await load<AssistService[]>("assist/services")); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  const save = async () => { if (!form.name.trim() || !form.equipment_type.trim()) return alert("Informe aparelho e nome do serviço."); setSaving(true); try { await engineRequest("assist/services", { method: "POST", body: { ...form, price_min: form.price_min ? Number(form.price_min) : null, price_max: form.price_max ? Number(form.price_max) : null } }); setShowForm(false); setForm({ category:"Reparo",equipment_type:"Celular",brand:"",model_pattern:"",name:"",description:"",pricing_mode:"exact",price_min:"",price_max:"",requires_diagnosis:false }); await refresh(); } catch(e:any) { alert(e?.message || "Erro ao salvar serviço"); } finally { setSaving(false); } };
  return <div>
    <ScreenHeader title="Serviços e preços" description="A IA só passa valores que existirem nesta base." action={<button onClick={() => setShowForm(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="size-4" /> Novo serviço</button>} />
    {showForm && <div className="mb-5 rounded-2xl border bg-card p-5"><h2 className="mb-4 font-semibold">Cadastrar serviço</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Categoria"><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="input-assist" /></Field><Field label="Tipo de aparelho"><input value={form.equipment_type} onChange={e=>setForm({...form,equipment_type:e.target.value})} className="input-assist" /></Field><Field label="Marca"><input value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})} className="input-assist" placeholder="Apple, Samsung..." /></Field><Field label="Modelo/padrão"><input value={form.model_pattern} onChange={e=>setForm({...form,model_pattern:e.target.value})} className="input-assist" placeholder="iPhone 11" /></Field><Field label="Serviço"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="input-assist" placeholder="Troca de tela" /></Field><Field label="Tipo de preço"><select value={form.pricing_mode} onChange={e=>setForm({...form,pricing_mode:e.target.value as any})} className="input-assist"><option value="exact">Preço exato</option><option value="range">Faixa / a partir de</option><option value="diagnosis">Sob diagnóstico</option></select></Field><Field label="Preço mínimo"><input type="number" value={form.price_min} onChange={e=>setForm({...form,price_min:e.target.value})} className="input-assist" /></Field><Field label="Preço máximo"><input type="number" value={form.price_max} onChange={e=>setForm({...form,price_max:e.target.value})} className="input-assist" /></Field></div><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requires_diagnosis} onChange={e=>setForm({...form,requires_diagnosis:e.target.checked})} /> Exigir diagnóstico antes de confirmar o valor</label><div className="mt-4 flex justify-end"><button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar</button></div></div>}
    {loading ? <Loading /> : !services.length ? <Empty>Nenhum serviço cadastrado. Use “Novo serviço” ou “Importar” para montar a base.</Empty> : <div className="grid gap-3 md:grid-cols-2">{services.map(service => <div key={service.id} className="rounded-2xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{service.equipment_type}{service.brand ? ` · ${service.brand}` : ""}{service.model_pattern ? ` · ${service.model_pattern}` : ""}</p><h3 className="mt-1 font-semibold">{service.name}</h3><p className="mt-1 text-sm text-muted-foreground">{service.description || service.category}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${service.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{service.active ? "ATIVO" : "PAUSADO"}</span></div><div className="mt-4 border-t pt-3 text-sm font-semibold">{service.pricing_mode === "diagnosis" ? "Sob diagnóstico" : service.price_max && service.price_max !== service.price_min ? `${brl(service.price_min)} – ${brl(service.price_max)}` : service.pricing_mode === "range" ? `A partir de ${brl(service.price_min)}` : brl(service.price_min)}</div></div>)}</div>}
    <style>{`.input-assist{height:2.75rem;width:100%;border-radius:.75rem;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:0 .75rem;font-size:.875rem;outline:none}.input-assist:focus{box-shadow:0 0 0 2px hsl(var(--primary)/.25)}`}</style>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1.5"><span className="text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>; }

function Importer({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const analyze = async () => { if(text.trim().length<10) return alert("Cole uma lista, tabela ou descrição dos serviços."); setLoading(true); try { const r = await engineRequest<{data:ImportPreview}>("assist/import/preview",{method:"POST",body:{text}}); setPreview(r.data); } catch(e:any) { alert(e?.message || "Falha ao analisar"); } finally { setLoading(false); } };
  const commit = async () => { if(!preview?.services.length) return; setLoading(true); try { await engineRequest("assist/import/commit",{method:"POST",body:{services:preview.services}}); onDone(); } catch(e:any) { alert(e?.message || "Falha ao importar"); } finally { setLoading(false); } };
  return <div><ScreenHeader title="Importar meu negócio" description="Cole informações como você já tem hoje. A IA estrutura a base sem obrigar cadastro serviço por serviço." /><div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border bg-card p-5"><div className="mb-3 flex items-center gap-2"><Bot className="size-5 text-primary" /><h2 className="font-semibold">Fonte</h2></div><textarea value={text} onChange={e=>setText(e.target.value)} rows={15} className="w-full resize-y rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder={'Exemplo:\nTrabalho com iPhone e Samsung. Troca de tela a partir de R$250, bateria a partir de R$180. Formatação de notebook R$120. Diagnóstico R$50, grátis se aprovar o serviço.'} /><button disabled={loading} onClick={() => void analyze()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{loading ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />} Gerar prévia</button></div><div className="rounded-2xl border bg-card p-5"><h2 className="mb-3 font-semibold">Prévia antes de salvar</h2>{!preview ? <Empty>A IA ainda não analisou o conteúdo.</Empty> : <><div className="max-h-[430px] space-y-2 overflow-y-auto">{preview.services.map((s,i)=><div key={`${s.name}-${i}`} className="rounded-xl border p-3"><p className="text-xs font-semibold text-muted-foreground">{s.equipment_type}{s.brand?` · ${s.brand}`:""}{s.model_pattern?` · ${s.model_pattern}`:""}</p><p className="font-semibold">{s.name}</p><p className="mt-1 text-xs text-muted-foreground">{s.pricing_mode === "diagnosis" ? "Sob diagnóstico" : s.price_max ? `${brl(s.price_min)} – ${brl(s.price_max)}` : s.pricing_mode === "range" ? `A partir de ${brl(s.price_min)}` : brl(s.price_min)}</p></div>)}</div>{preview.warnings?.length>0 && <div className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground"><b>Atenção:</b> {preview.warnings.join(" · ")}</div>}<button disabled={loading||!preview.services.length} onClick={() => void commit()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="size-4" /> Salvar {preview.services.length} serviços</button></>}</div></div></div>;
}

function Channels() {
  return <div><ScreenHeader title="Canais" description="Atendimento por WhatsApp e estrutura preparada para Instagram." /><div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border bg-card p-5"><div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><MessageCircle className="size-5" /></div><div><h2 className="font-semibold">WhatsApp</h2><p className="text-xs text-muted-foreground">Conector nativo já usado pelo Arles</p></div></div><WhatsApp /></div><div className="rounded-2xl border bg-card p-5"><div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-muted p-2"><Instagram className="size-5" /></div><div><h2 className="font-semibold">Instagram</h2><p className="text-xs text-muted-foreground">Direct Messages</p></div></div><div className="rounded-xl border border-dashed p-5"><p className="text-sm font-semibold">Estrutura do produto pronta</p><p className="mt-2 text-sm text-muted-foreground">As OS já registram o canal <b>instagram</b>. A conexão em tempo real ainda depende do webhook/credenciais da Meta e não está sendo apresentada como ativa nesta base.</p><span className="mt-4 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold">Aguardando conexão Meta</span></div></div></div></div>;
}

function AssistSettingsScreen() {
  const [data, setData] = useState<AssistSettings>({ diagnosis_fee:0, diagnosis_waived_if_approved:true, pickup_enabled:false, default_warranty_days:90 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(()=>{ void load<AssistSettings>("assist/settings").then(v=>setData(d=>({...d,...v}))).finally(()=>setLoading(false)); },[]);
  const save = async () => { setSaving(true); try { await engineRequest("assist/settings",{method:"PUT",body:data}); alert("Ajustes salvos."); } catch(e:any) { alert(e?.message || "Erro ao salvar"); } finally { setSaving(false); } };
  if(loading) return <Loading />;
  return <div><ScreenHeader title="Ajustes da assistência" description="Regras usadas pela IA ao orientar clientes e montar orçamentos." /><div className="max-w-3xl space-y-5 rounded-2xl border bg-card p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome da assistência"><input className="input-assist" value={data.business_name||""} onChange={e=>setData({...data,business_name:e.target.value})} /></Field><Field label="Instagram"><input className="input-assist" value={data.instagram||""} onChange={e=>setData({...data,instagram:e.target.value})} placeholder="@empresa" /></Field><Field label="Endereço"><input className="input-assist" value={data.address||""} onChange={e=>setData({...data,address:e.target.value})} /></Field><Field label="Horário de atendimento"><input className="input-assist" value={data.opening_hours||""} onChange={e=>setData({...data,opening_hours:e.target.value})} placeholder="Seg a sex, 8h às 18h" /></Field><Field label="Taxa de diagnóstico"><input type="number" className="input-assist" value={data.diagnosis_fee??0} onChange={e=>setData({...data,diagnosis_fee:Number(e.target.value)})} /></Field><Field label="Garantia padrão (dias)"><input type="number" className="input-assist" value={data.default_warranty_days??90} onChange={e=>setData({...data,default_warranty_days:Number(e.target.value)})} /></Field></div><label className="flex items-center justify-between gap-4 rounded-xl border p-4"><div><p className="text-sm font-semibold">Dispensar/abater diagnóstico quando o reparo for aprovado</p><p className="text-xs text-muted-foreground">A IA pode explicar essa regra ao cliente.</p></div><input type="checkbox" checked={data.diagnosis_waived_if_approved!==false} onChange={e=>setData({...data,diagnosis_waived_if_approved:e.target.checked})} /></label><label className="flex items-center justify-between gap-4 rounded-xl border p-4"><div><p className="text-sm font-semibold">Retirada/entrega de aparelhos</p><p className="text-xs text-muted-foreground">Marca se a assistência oferece logística ao cliente.</p></div><input type="checkbox" checked={data.pickup_enabled===true} onChange={e=>setData({...data,pickup_enabled:e.target.checked})} /></label><button disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving?<Loader2 className="size-4 animate-spin"/>:<Save className="size-4"/>} Salvar ajustes</button></div><style>{`.input-assist{height:2.75rem;width:100%;border-radius:.75rem;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:0 .75rem;font-size:.875rem;outline:none}.input-assist:focus{box-shadow:0 0 0 2px hsl(var(--primary)/.25)}`}</style></div>;
}
