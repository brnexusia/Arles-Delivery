import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Building2, CircleDollarSign, CreditCard, LogOut,
  MessageCircle, RefreshCw, Search, Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/adm")({ component: AdminDashboard });

type Metrics = {
  companies: number;
  users: number;
  activeSubscriptions: number;
  trials: number;
  pastDue: number;
  newCompanies30d: number;
  trialsEnding3d: number;
  monthlyRevenueCents: number;
  revenueReceived30dCents: number;
  contactsUsed: number;
};

type Company = {
  id: string;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  verticals: string[];
  planKey: string | null;
  subscriptionStatus: string;
  monthlyPriceCents: number | null;
  monthlyContactLimit: number | null;
  monthlyContactsUsed: number;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  whatsappStatus: string;
  createdAt: string;
};

type Overview = { generatedAt: string; metrics: Metrics; companies: Company[] };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const statusLabels: Record<string, string> = {
  active: "Ativa", trial: "Trial", past_due: "Pagamento pendente",
  canceled: "Cancelada", expired: "Expirada",
};
const statusClasses: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  trial: "bg-blue-50 text-blue-700 border-blue-200",
  past_due: "bg-amber-50 text-amber-800 border-amber-200",
  canceled: "bg-zinc-100 text-zinc-700 border-zinc-200",
  expired: "bg-red-50 text-red-700 border-red-200",
};

function formatMoney(cents: number | null) {
  return cents === null ? "-" : money.format(cents / 100);
}

function formatDate(value: string | null) {
  return value ? date.format(new Date(value)) : "-";
}

function Status({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusClasses[value] || statusClasses.canceled}`}>
      {statusLabels[value] || value}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: {
  icon: typeof Users; label: string; value: string; detail: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">{label}</span><Icon className="size-4" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function AdminDashboard() {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    if (ready && (!user || user.role !== "admin")) {
      router.navigate({ to: "/login", replace: true });
    }
  }, [ready, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/.netlify/functions/admin-overview", {
        credentials: "same-origin", cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Não foi possível carregar o painel.");
      }
      setOverview(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") void load();
  }, [user, load]);

  const companies = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (overview?.companies || []).filter(company => {
      const matchesStatus = status === "all" || company.subscriptionStatus === status;
      const matchesSearch = !needle || [company.name, company.ownerName, company.ownerEmail, ...company.verticals]
        .filter(Boolean).some(value => String(value).toLowerCase().includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [overview, search, status]);

  if (!ready || !user || user.role !== "admin") return null;
  const metrics = overview?.metrics;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground">A</div>
            <div><h1 className="text-base font-semibold">Arles Admin</h1><p className="text-xs text-muted-foreground">Visão geral da plataforma</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} title="Atualizar dados">
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
            <Button variant="outline" onClick={() => void signOut()}><LogOut /><span className="hidden sm:inline">Sair</span></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="text-xl font-semibold">Resumo</h2><p className="text-sm text-muted-foreground">Usuários, assinaturas e receita da operação.</p></div>
            {overview && <p className="text-xs text-muted-foreground">Atualizado às {new Date(overview.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
          </div>
          {error ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <span className="flex items-center gap-2"><AlertCircle className="size-4" />{error}</span>
              <Button variant="outline" size="sm" onClick={() => void load()}>Tentar novamente</Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={Users} label="Usuários" value={loading ? "..." : String(metrics?.users ?? 0)} detail={`${metrics?.newCompanies30d ?? 0} novas empresas em 30 dias`} />
              <MetricCard icon={CreditCard} label="Assinaturas ativas" value={loading ? "..." : String(metrics?.activeSubscriptions ?? 0)} detail={`${metrics?.trials ?? 0} em trial, ${metrics?.pastDue ?? 0} pendentes`} />
              <MetricCard icon={CircleDollarSign} label="Recebido em 30 dias" value={loading ? "..." : formatMoney(metrics?.revenueReceived30dCents ?? 0)} detail="Pagamentos confirmados pelo Stripe" />
              <MetricCard icon={Building2} label="Receita mensal ativa" value={loading ? "..." : formatMoney(metrics?.monthlyRevenueCents ?? 0)} detail="Valor mensal das assinaturas ativas" />
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold">Empresas</h2><p className="text-xs text-muted-foreground">{companies.length} de {overview?.companies.length ?? 0} registros</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={event => setSearch(event.target.value)} className="pl-9" placeholder="Buscar empresa ou usuário" />
              </label>
              <select value={status} onChange={event => setStatus(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">Todos os status</option><option value="active">Ativa</option>
                <option value="trial">Trial</option><option value="past_due">Pagamento pendente</option>
                <option value="canceled">Cancelada</option><option value="expired">Expirada</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
                {['Empresa', 'Vertical', 'Assinatura', 'Mensalidade', 'Uso', 'WhatsApp', 'Cadastro'].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {loading && Array.from({ length: 4 }).map((_, index) => <tr key={index}><td colSpan={7} className="px-4 py-4"><div className="h-8 animate-pulse rounded bg-muted" /></td></tr>)}
                {!loading && companies.map(company => <tr key={company.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3"><p className="font-medium">{company.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{company.ownerName || "Sem responsável"} · {company.ownerEmail || "sem e-mail"}</p></td>
                  <td className="px-4 py-3 capitalize">{company.verticals.join(", ") || "-"}</td>
                  <td className="px-4 py-3"><Status value={company.subscriptionStatus} /><p className="mt-1 text-xs capitalize text-muted-foreground">{company.planKey || (company.subscriptionStatus === "trial" ? `até ${formatDate(company.trialEndsAt)}` : "sem plano")}</p></td>
                  <td className="px-4 py-3 font-medium">{formatMoney(company.monthlyPriceCents)}</td>
                  <td className="px-4 py-3"><p>{company.monthlyContactsUsed.toLocaleString("pt-BR")} contatos</p><p className="text-xs text-muted-foreground">limite {company.monthlyContactLimit?.toLocaleString("pt-BR") || "-"}</p></td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><MessageCircle className={`size-4 ${company.whatsappStatus === "connected" ? "text-emerald-600" : "text-muted-foreground"}`} />{company.whatsappStatus === "connected" ? "Conectado" : "Desconectado"}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(company.createdAt)}</td>
                </tr>)}
                {!loading && !companies.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhuma empresa encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
