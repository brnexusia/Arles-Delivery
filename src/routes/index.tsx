import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Crown, Repeat2, Activity, LogOut, UserRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filters } from "@/components/dashboard/Filters";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ContactsTable } from "@/components/dashboard/ContactsTable";
import {
  FrequencyChart,
  HourChart,
  SellerChart,
  VolumeChart,
  WeekdayChart,
} from "@/components/dashboard/Charts";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { FrequencyDetail } from "@/components/dashboard/FrequencyDetail";
import { Agenda } from "@/components/dashboard/Agenda";
import { Configuracoes } from "@/components/dashboard/Configuracoes";
import { CustomMetrics } from "@/components/dashboard/CustomMetrics";
import { resolveModuleComponent } from "@/platform/module-registry";

import {
  computeMetrics,
  contactsOf,
  dateRangeOf,
  deltaPct,
  previousRange,
  sellersOf,
  formatBR,
  staticDataset,
  toDataset,
  currentMonthRange,
  type Dataset,
} from "@/lib/data";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arles | Métricas Operacionais" },
      {
        name: "description",
        content:
          "Dashboard analítico do Arles: leads, média diária, taxa de retorno e performance por vendedora.",
      },
      { property: "og:title", content: "Arles | Métricas Operacionais" },
      {
        property: "og:description",
        content:
          "Dashboard analítico do Arles: leads, média diária, taxa de retorno e performance por vendedora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.navigate({ to: "/login", replace: true });
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  const ModuleComponent = resolveModuleComponent(user.modules);
  if (ModuleComponent) {
    return <ModuleComponent />;
  }

  return (
    <Dashboard
      company={user.company}
      userName={user.name}
      hasCalendar={!!user.has_calendar}
      hasServices={!!user.has_services}
      hasCustomMetrics={!!user.has_custom_metrics}
      onSignOut={signOut}
    />
  );
}

function Dashboard({
  company,
  userName,
  hasCalendar,
  hasServices,
  hasCustomMetrics,
  onSignOut,
}: {
  company: string;
  userName: string;
  hasCalendar: boolean;
  hasServices: boolean;
  hasCustomMetrics: boolean;
  onSignOut: () => void;
}) {
  // Compatibilidade do dashboard legado. A função valida a sessão e aplica o
  // tenant no servidor antes de devolver qualquer registro ao navegador.
  const query = useQuery<Dataset>({
    queryKey: ["legacy-metrics", company],
    queryFn: async () => {
      const response = await fetch("/.netlify/functions/legacy-metrics", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Falha ao carregar métricas do tenant.");
      return toDataset(await response.json());
    },
    initialData: staticDataset,
    initialDataUpdatedAt: 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const dataset = query.data ?? staticDataset;

  // Isolamento multi-tenant: somente os registros da empresa do usuário.
  const companyRows = useMemo(
    () => contactsOf(company, dataset.contacts),
    [company, dataset.contacts],
  );
  const range = useMemo(() => dateRangeOf(companyRows), [companyRows]);
  const sellers = useMemo(() => sellersOf(companyRows), [companyRows]);

  const [startRaw, setStart] = useState<string | null>(null);
  const [endRaw, setEnd] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [freqBucket, setFreqBucket] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    "metrics" | "agenda" | "configuracoes" | "custom_metrics"
  >("metrics");

  const defaultRange = useMemo(() => currentMonthRange(), []);
  const start = startRaw ?? defaultRange.start;
  const end = endRaw ?? defaultRange.end;

  const rows = useMemo(
    () =>
      companyRows.filter(
        (c) =>
          c.date >= start &&
          c.date <= end &&
          (selected.length === 0 || selected.includes(c.seller)),
      ),
    [companyRows, start, end, selected],
  );

  // Período anterior de mesma duração — base das setas de tendência.
  const prev = useMemo(() => previousRange(start, end), [start, end]);
  const prevRows = useMemo(
    () =>
      companyRows.filter(
        (c) =>
          c.date >= prev.start &&
          c.date <= prev.end &&
          (selected.length === 0 || selected.includes(c.seller)),
      ),
    [companyRows, prev, selected],
  );

  const m = useMemo(() => computeMetrics(rows), [rows]);
  const pm = useMemo(() => computeMetrics(prevRows), [prevRows]);
  const RETURN_TARGET = 20; // referência de taxa de retorno saudável (%)

  const toggleSeller = (s: string) =>
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const reset = () => {
    setStart(null);
    setEnd(null);
    setSelected([]);
  };

  const updatedAt = dataset.fetchedAt
    ? new Date(dataset.fetchedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight">
                <div className="relative flex items-center">
                  {/* Glow behind logo in dark mode */}
                  <div className="absolute inset-x-0 h-8 top-1/2 -translate-y-1/2 dark:bg-primary/20 blur-xl rounded-full" />
                  <img
                    src="/logo.png"
                    alt="Arles"
                    className="relative z-10 h-10 w-auto object-contain"
                    style={{ filter: "var(--logo-filter)" }}
                  />
                </div>
              </h1>
              <p className="text-xs text-muted-foreground">
                Base de {formatBR(range.min)} a {formatBR(range.max)} ·{" "}
                {companyRows.length.toLocaleString("pt-BR")} registros
                {updatedAt ? ` · atualizado às ${updatedAt}` : " · dados locais"}
                {query.isError ? " · falha ao sincronizar" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground sm:inline-flex">
              <UserRound className="size-3.5" />
              {userName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              title="Atualizar dados"
              aria-label="Atualizar dados"
            >
              <RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              Sair
            </Button>
          </div>
        </header>

        <div className="flex justify-center sm:justify-start border-b pb-1">
          <div className="flex space-x-6">
            <button
              onClick={() => setActiveTab("metrics")}
              className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "metrics"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              Métricas
            </button>
            {hasCalendar && (
              <button
                onClick={() => setActiveTab("agenda")}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === "agenda"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                Agenda
              </button>
            )}
            {hasCustomMetrics && (
              <button
                onClick={() => setActiveTab("custom_metrics")}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === "custom_metrics"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                Métricas Extras
              </button>
            )}
            <button
              onClick={() => setActiveTab("configuracoes")}
              className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "configuracoes"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              Configurações
            </button>
          </div>
        </div>

        {activeTab === "configuracoes" ? (
          <Configuracoes hasServices={hasServices} />
        ) : activeTab === "agenda" ? (
          <Agenda />
        ) : activeTab === "custom_metrics" ? (
          <CustomMetrics />
        ) : (
          <>
            <Filters
              start={start}
              end={end}
              onStart={setStart}
              onEnd={setEnd}
              sellers={sellers}
              selected={selected}
              onToggleSeller={toggleSeller}
              onReset={reset}
            />

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Total de Atendimentos"
                value={m.total.toLocaleString("pt-BR")}
                hint="Todos os registros do período"
                icon={Activity}
                accent="muted"
                delta={deltaPct(m.total, pm.total)}
              />
              <KpiCard
                label="Clientes Únicos"
                value={m.uniquePhones.toLocaleString("pt-BR")}
                hint={`${(m.total / (m.uniquePhones || 1)).toFixed(1)} atendimentos por cliente`}
                icon={UserRound}
                accent="muted"
                delta={deltaPct(m.uniquePhones, pm.uniquePhones)}
              />
              <KpiCard
                label="Média Diária"
                value={m.dailyAvg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                hint={`${m.activeDays} dias com atendimento`}
                icon={CalendarDays}
                accent="muted"
                delta={deltaPct(m.dailyAvg, pm.dailyAvg)}
              />
              <KpiCard
                label="Top Vendedora"
                value={m.topSeller?.name ?? "—"}
                hint={
                  m.topSeller
                    ? `${m.topSeller.count.toLocaleString("pt-BR")} contatos no período`
                    : "Sem dados no período"
                }
                icon={Crown}
                accent="muted"
                delta={
                  m.topSeller && pm.topSeller && m.topSeller.name === pm.topSeller.name
                    ? deltaPct(m.topSeller.count, pm.topSeller.count)
                    : null
                }
              />
              <KpiCard
                label="Taxa de Retorno"
                value={`${m.returnRate.toFixed(1)}%`}
                hint={`${m.returningContacts.toLocaleString("pt-BR")} clientes em mais de uma data · meta ${RETURN_TARGET}%`}
                icon={Repeat2}
                accent="muted"
                valueTone={m.returnRate >= RETURN_TARGET ? "positive" : "negative"}
                delta={deltaPct(m.returnRate, pm.returnRate)}
              />
            </section>

            <VolumeChart data={m.byDate} />

            <section className="grid gap-4 lg:grid-cols-2">
              <SellerChart data={m.bySeller} />
              <WeekdayChart data={m.byWeekday} />
            </section>

            <HourChart data={m.byHour} />

            <FrequencyChart data={m.byFrequency} onSelectBucket={setFreqBucket} />

            <FrequencyDetail
              bucket={freqBucket}
              rows={rows}
              onOpenChange={(o) => !o && setFreqBucket(null)}
            />

            <ContactsTable rows={rows} allRows={companyRows} />
          </>
        )}
      </div>
    </main>
  );
}
