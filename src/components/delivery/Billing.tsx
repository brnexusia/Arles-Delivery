import { useState, useEffect } from "react";
import {
  CreditCard, CheckCircle2, AlertCircle, Clock, ExternalLink,
  Loader2, XCircle, CalendarClock, Users, Zap, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getSubscriptionInfo, planLabel, type SubscriptionInfo } from "@/lib/subscription";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Plan definitions ───────────────────────────────────────────────────────────

type PlanKey = "essential" | "professional" | "scale";

interface Plan {
  key:       PlanKey;
  name:      string;
  price:     string;
  contacts:  number;
  badge?:    string;
}

const PLANS: Plan[] = [
  { key: "essential",    name: "Essencial",    price: "49,90",  contacts: 360 },
  { key: "professional", name: "Profissional",  price: "197,00", contacts: 1500, badge: "Mais escolhido" },
  { key: "scale",        name: "Escala",        price: "297,00", contacts: 3000 },
];

const FEATURES = [
  "Atendimento com IA",
  "WhatsApp",
  "Cardápio inteligente",
  "Pedidos",
  "Clientes e histórico",
  "Follow-up",
  "Cardápio visual",
];

// ── API helpers ────────────────────────────────────────────────────────────────

async function startCheckout(planKey: PlanKey): Promise<void> {
  const res = await fetch("/.netlify/functions/create-checkout-session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_key: planKey }),
  });

  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { data = { error: text || `HTTP ${res.status}` }; }

  if (data.already_subscribed) throw new Error("already_subscribed");
  if (!res.ok || !data.url) throw new Error(data.error || "Não foi possível abrir o checkout.");

  window.location.href = data.url;
}

async function openPortal(): Promise<void> {
  const res = await fetch("/.netlify/functions/create-portal-session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { data = { error: text || `HTTP ${res.status}` }; }

  if (!res.ok || !data.url) throw new Error(data.error || "Não foi possível abrir o portal.");

  window.location.href = data.url;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubscriptionInfo["status"] }) {
  const cfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    trial:    { label: "Período gratuito",           cls: "bg-blue-100 text-blue-700",     icon: <Clock className="size-3.5" /> },
    active:   { label: "Ativo",                      cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="size-3.5" /> },
    past_due: { label: "Problema no pagamento",      cls: "bg-amber-100 text-amber-700",   icon: <AlertCircle className="size-3.5" /> },
    expired:  { label: "Período encerrado",          cls: "bg-red-100 text-red-700",       icon: <XCircle className="size-3.5" /> },
    canceled: { label: "Cancelada",                  cls: "bg-zinc-100 text-zinc-600",     icon: <XCircle className="size-3.5" /> },
  };
  const s = cfg[status] ?? cfg.expired;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

function ContactUsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 100 ? "bg-red-500"
    : pct >= 90 ? "bg-amber-500"
    : pct >= 80 ? "bg-yellow-400"
    : "bg-emerald-500";

  const label = pct >= 100
    ? "Você atingiu o limite mensal do seu plano."
    : pct >= 90
    ? "Seu limite mensal está próximo."
    : pct >= 80
    ? `Você já utilizou ${pct}% dos contatos do seu plano.`
    : null;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium flex items-center gap-1.5">
          <Users className="size-4 text-muted-foreground" /> Contatos este mês
        </span>
        <span className="text-muted-foreground">{used.toLocaleString("pt-BR")} / {limit.toLocaleString("pt-BR")}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {label && (
        <p className={`text-xs font-medium ${pct >= 100 ? "text-red-600" : "text-amber-600"}`}>{label}</p>
      )}
    </div>
  );
}

function PlanCard({
  plan, loading, onSubscribe,
}: { plan: Plan; loading: boolean; onSubscribe: (k: PlanKey) => void }) {
  return (
    <div className={`relative rounded-2xl border-2 p-5 bg-card flex flex-col gap-4 ${
      plan.badge ? "border-primary shadow-md" : "border-border"
    }`}>
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[11px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
          {plan.badge}
        </span>
      )}

      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-base">{plan.name}</p>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <Users className="size-3.5" />
            Até {plan.contacts.toLocaleString("pt-BR")} contatos/mês
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold">R$ {plan.price}</p>
          <p className="text-xs text-muted-foreground">/mês</p>
        </div>
      </div>

      <Button
        id={`billing-subscribe-${plan.key}`}
        onClick={() => onSubscribe(plan.key)}
        disabled={loading}
        className={`w-full ${plan.badge ? "" : "variant-outline"}`}
        variant={plan.badge ? "default" : "outline"}
      >
        {loading
          ? <Loader2 className="size-4 animate-spin mr-2" />
          : <CreditCard className="size-4 mr-2" />}
        Assinar {plan.name}
      </Button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function Billing() {
  const { user }                  = useAuth();
  const [info, setInfo]           = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<PlanKey | null>(null);
  const [portalLoading, setPortalLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    const outcome = new URLSearchParams(window.location.search).get("checkout");

    const refresh = async () => {
      const data = await getSubscriptionInfo(user.companyId);
      if (cancelled) return;
      setInfo(data);
      setLoading(false);

      if (outcome === "success" && data?.status === "active") {
        setSuccessMsg("Assinatura ativada com sucesso.");
        if (timer) clearInterval(timer);
      }
    };

    if (outcome === "success") {
      setSuccessMsg("Pagamento recebido. Confirmando sua assinatura...");
      void refresh();
      timer = setInterval(() => {
        attempts += 1;
        void refresh();
        if (attempts >= 8 && timer) clearInterval(timer);
      }, 1500);
    } else {
      if (outcome === "cancelled") {
        setError("Checkout cancelado. Escolha um plano quando estiver pronto.");
      }
      void refresh();
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [user]);

  const handleCheckout = async (planKey: PlanKey) => {
    if (!user) return;
    setCheckoutLoading(planKey);
    setError(null);
    try {
      await startCheckout(planKey);
    } catch (e: any) {
      if (e.message === "already_subscribed") {
        setError("Você já possui uma assinatura ativa. Use \"Gerenciar assinatura\" abaixo.");
      } else {
        setError(e.message);
      }
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    if (!user) return;
    setPortalLoading(true);
    setError(null);
    try {
      await openPortal();
    } catch (e: any) {
      setError(e.message);
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = info?.status ?? "expired";

  return (
    <div className="space-y-8 max-w-2xl mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Assinatura</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie seu plano do Arles Delivery</p>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          ACTIVE SUBSCRIPTION
      ───────────────────────────────────────────────────────────────────── */}
      {status === "active" && (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-violet-600 to-fuchsia-500" />
          <div className="p-6 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shrink-0">
                  <Zap className="size-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Plano atual</p>
                  <h2 className="text-lg font-bold">{planLabel(info?.planKey ?? null)}</h2>
                </div>
              </div>
              <StatusBadge status={status} />
            </div>

            {/* Billing info */}
            {info?.subscriptionEndsAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="size-4 shrink-0" />
                {info.cancelAtPeriodEnd ? "Acesso até " : "Próxima cobrança em "}
                <strong className="text-foreground">
                  {format(info.subscriptionEndsAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </strong>
              </div>
            )}

            {/* Cancel at period end warning */}
            {info?.cancelAtPeriodEnd && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <CalendarClock className="size-4 shrink-0 mt-0.5" />
                <span>Sua assinatura foi cancelada e não será renovada. Você mantém acesso até o fim do período pago.</span>
              </div>
            )}

            {/* Contact usage bar */}
            {info?.contactLimit != null && info?.contactsUsed != null && (
              <ContactUsageBar used={info.contactsUsed} limit={info.contactLimit} />
            )}

            {/* Portal CTA */}
            <Button
              id="billing-portal-btn"
              variant="outline"
              onClick={handlePortal}
              disabled={portalLoading}
              className="w-full h-11"
            >
              {portalLoading
                ? <Loader2 className="size-4 animate-spin mr-2" />
                : <ExternalLink className="size-4 mr-2" />}
              Gerenciar assinatura
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Atualize cartão, visualize faturas ou cancele pelo portal seguro do Stripe.
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          PAST DUE
      ───────────────────────────────────────────────────────────────────── */}
      {status === "past_due" && (
        <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-lg">Arles Delivery</h2>
            <StatusBadge status={status} />
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 flex items-start gap-3">
            <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Não conseguimos processar seu pagamento.</p>
              <p className="text-xs text-amber-700 mt-1">Atualize os dados do cartão para restaurar o acesso ao atendimento automático.</p>
            </div>
          </div>
          <Button
            onClick={handlePortal}
            disabled={portalLoading}
            className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white"
          >
            {portalLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : <CreditCard className="size-4 mr-2" />}
            Atualizar forma de pagamento
          </Button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          TRIAL — show plans + days remaining
      ───────────────────────────────────────────────────────────────────── */}
      {status === "trial" && (
        <>
          {/* Trial status card */}
          <div className="rounded-2xl border bg-card shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shrink-0">
                  <Zap className="size-5 text-white" />
                </div>
                <h2 className="font-bold text-lg">Seu período gratuito</h2>
              </div>
              <StatusBadge status={status} />
            </div>

            {info?.daysRemaining !== null && (
              <div className="flex items-center gap-4 rounded-xl bg-blue-50 border border-blue-100 p-4">
                <div className="size-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-2xl font-bold text-blue-700">{info!.daysRemaining}</span>
                </div>
                <div>
                  <p className="font-semibold text-blue-800">
                    {info!.daysRemaining === 1 ? "1 dia restante" : `${info!.daysRemaining} dias restantes`}
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Encerra em {info!.trialEndsAt ? format(info!.trialEndsAt, "dd 'de' MMMM", { locale: ptBR }) : "breve"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Plan picker section */}
          <div>
            <h3 className="font-semibold text-base mb-1">Conheça nossos planos</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Assine quando estiver pronto e ative seu plano pelo Stripe.
            </p>
            <PlanGrid
              onSubscribe={handleCheckout}
              loadingPlan={checkoutLoading}
            />
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          EXPIRED / CANCELED — full plan picker with urgency
      ───────────────────────────────────────────────────────────────────── */}
      {(status === "expired" || status === "canceled") && (
        <>
          <div className="rounded-2xl border bg-card shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <StatusBadge status={status} />
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-start gap-3">
              <XCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">
                  {status === "canceled"
                    ? "Sua assinatura foi cancelada."
                    : "Seu período gratuito terminou."}
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Continue atendendo seus clientes automaticamente com o Arles Delivery.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-base mb-1">Escolha seu plano</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Continue atendendo seus clientes automaticamente com o Arles Delivery.
            </p>
            <PlanGrid
              onSubscribe={handleCheckout}
              loadingPlan={checkoutLoading}
            />
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          FEATURES (always visible)
      ───────────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-sm p-6">
        <h3 className="font-semibold text-sm mb-4">Todos os planos incluem</h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground border-t pt-3">
          A diferença entre os planos é o número de <strong>contatos únicos</strong> atendidos por mês.
          O mesmo número, mesmo que envie várias mensagens, conta como apenas 1 contato.
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-4">
        🔒 Pagamento processado com segurança pelo Stripe. Não armazenamos dados do seu cartão.
      </p>
    </div>
  );
}

// ── Plan grid helper ───────────────────────────────────────────────────────────

function PlanGrid({
  onSubscribe, loadingPlan,
}: { onSubscribe: (k: PlanKey) => void; loadingPlan: PlanKey | null }) {
  return (
    <div className="space-y-3">
      {PLANS.map((plan) => (
        <PlanCard
          key={plan.key}
          plan={plan}
          loading={loadingPlan === plan.key}
          onSubscribe={onSubscribe}
        />
      ))}
    </div>
  );
}
