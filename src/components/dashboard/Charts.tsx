import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Metrics } from "@/lib/data";

function ChartCard({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className={`gap-0 p-5 shadow-[var(--shadow-card)] ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mb-4 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="h-[260px] w-full">{children}</div>
    </Card>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "0.6rem",
    fontSize: "12px",
    color: "var(--popover-foreground)",
  },
  labelStyle: { color: "var(--popover-foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--popover-foreground)" },
  cursor: { fill: "var(--accent)", opacity: 0.5 },
};

/**
 * Critério de cor único do painel:
 * - uma única cor (primária / chart-1) com variação de intensidade para volume;
 * - intensidade máxima apenas no valor de destaque (top / pico);
 * - verde e vermelho ficam reservados para tendência (ver KpiCard).
 */
const MAIN = "var(--chart-1)";
const strengthOf = (value: number, max: number) => 0.28 + 0.72 * (max ? value / max : 0);



const intFormat = (v: number) => v.toLocaleString("pt-BR");

export function VolumeChart({ data }: { data: Metrics["byDate"] }) {
  return (
    <ChartCard title="Volume ao longo do tempo" subtitle="Atendimentos registrados por dia">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            {...tooltipStyle}
            cursor={{ stroke: MAIN }}
            formatter={(v) => [intFormat(Number(v)), "Atendimentos"]}
            labelFormatter={(label: string) => `Dia ${label}`}
          />
          <Area
            type="basis"
            dataKey="count"
            name="Atendimentos"
            stroke={MAIN}
            strokeWidth={2.5}
            fill={MAIN}
            fillOpacity={0.2}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SellerChart({ data }: { data: Metrics["bySeller"] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = data[0]?.count ?? 0;
  const top = data[0]?.seller;

  return (
    <ChartCard
      title="Performance por vendedora"
      subtitle="Total de contatos atribuídos — barra em destaque é a líder do período"
      action={top ? <Badge variant="secondary">Líder: {top}</Badge> : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="seller"
            width={90}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v) => [
              `${intFormat(Number(v))} (${total ? ((Number(v) / total) * 100).toFixed(1) : "0"}%)`,
              "Contatos",
            ]}
          />
          <Bar dataKey="count" name="Contatos" radius={[0, 6, 6, 0]}>
            <LabelList
              dataKey="count"
              position="right"
              offset={8}
              formatter={(v: number) =>
                `${intFormat(v)} · ${total ? ((v / total) * 100).toFixed(0) : 0}%`
              }
              style={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={MAIN}
                fillOpacity={d.seller === top ? 1 : Math.min(0.6, strengthOf(d.count, max))}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WeekdayChart({ data }: { data: Metrics["byWeekday"] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const peak = data.find((d) => d.count === max)?.weekday;
  const chartData = data.map((d) => ({ ...d, peak: d.weekday === peak ? "pico" : "" }));

  return (
    <ChartCard
      title="Picos por dia da semana"
      subtitle="Demanda agregada no período — a barra cheia marca o dia de pico"
      action={peak ? <Badge variant="secondary">Pico: {peak}</Badge> : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: -20, right: 8, top: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="weekday"
            tickFormatter={(v: string) => v.slice(0, 3)}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v, _n, item) => [
              `${intFormat(Number(v))}${
                (item?.payload as { peak?: string })?.peak ? " · dia de pico" : ""
              }`,
              "Atendimentos",
            ]}
          />
          <Bar dataKey="count" name="Atendimentos" radius={[6, 6, 0, 0]}>
            <LabelList
              dataKey="peak"
              position="top"
              offset={8}
              style={{ fontSize: 10, fill: "var(--foreground)", fontWeight: 600 }}
            />
            {chartData.map((d, i) => (
              <Cell key={i} fill={MAIN} fillOpacity={strengthOf(d.count, max)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function HourChart({ data }: { data: Metrics["byHour"] }) {
  const active = data.filter((d) => d.count > 0);
  const first = data.findIndex((d) => d.count > 0);
  const last = data.length - 1 - [...data].reverse().findIndex((d) => d.count > 0);
  const sliced = active.length ? data.slice(Math.max(0, first - 1), last + 2) : data;
  const max = Math.max(...sliced.map((d) => d.count), 1);
  const peak = sliced.find((d) => d.count === max)?.hour;

  return (
    <ChartCard
      title="Volume por horário"
      subtitle="Distribuição dos atendimentos ao longo do dia — a barra cheia marca o horário de pico"
      action={peak ? <Badge variant="secondary">Pico: {peak}</Badge> : undefined}
    >
      {active.length === 0 ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">
          Sem horário registrado neste período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sliced} margin={{ left: -20, right: 8, top: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(v) => [intFormat(Number(v)), "Atendimentos"]}
              labelFormatter={(label: string) => `Faixa das ${label}`}
            />
            <Bar dataKey="count" name="Atendimentos" radius={[6, 6, 0, 0]}>
              {sliced.map((d, i) => (
                <Cell key={i} fill={MAIN} fillOpacity={strengthOf(d.count, max)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function FrequencyChart({
  data,
  onSelectBucket,
}: {
  data: Metrics["byFrequency"];
  onSelectBucket?: (bucket: number) => void;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  
  // Para evitar erro no log(0) do Recharts, ajustamos 0 para 0.1 apenas no gráfico.
  // A LabelList usará o valor original.
  const chartData = data.map(d => ({
    ...d,
    chartCount: Math.max(d.count, 0.1),
    originalCount: d.count
  }));

  return (
    <ChartCard
      title="Frequência de contatos"
      subtitle="Quantos clientes únicos entraram em contato 1, 2, 3 ou mais vezes (Escala Logarítmica) — clique para ver os contatos"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: -20, right: 8, top: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            scale="log"
            domain={[1, "auto"]}
            allowDataOverflow={true}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip {...tooltipStyle} formatter={(v, _n, item) => [intFormat(Number(item.payload.originalCount)), "Clientes"]} />
          <Bar
            dataKey="chartCount"
            name="Clientes"
            radius={[6, 6, 0, 0]}
            minPointSize={2}
            onClick={(_: unknown, i: number) => onSelectBucket?.(i + 1)}
          >
            <LabelList
              dataKey="originalCount"
              position="top"
              offset={8}
              formatter={(v: number) => intFormat(v)}
              style={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 600 }}
            />
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={MAIN}
                fillOpacity={strengthOf(d.originalCount, max)}
                cursor={onSelectBucket ? "pointer" : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
