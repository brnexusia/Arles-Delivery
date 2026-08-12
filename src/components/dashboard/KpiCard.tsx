import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export type KpiTone = "neutral" | "positive" | "negative";

/** Paleta dos ícones: intensidade da cor principal varia por tipo de métrica. */
export type KpiAccent = "primary" | "soft" | "muted";

const ACCENT_CLASS: Record<KpiAccent, string> = {
  primary: "bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.2)]",
  soft: "bg-gradient-to-br from-primary/10 to-transparent text-primary/80 border border-primary/10",
  muted: "bg-gradient-to-br from-white/10 to-white/2 text-foreground border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md",
};

const TONE_CLASS: Record<KpiTone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-success",
  negative: "text-destructive",
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "soft",
  valueTone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent?: KpiAccent;
  valueTone?: KpiTone;
  /** Variação percentual em relação ao período anterior (null = sem base). */
  delta?: number | null;
  deltaLabel?: string;
  higherIsBetter?: boolean;
}) {
  return (
    <Card className="gap-0 p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={`rounded-xl p-2.5 backdrop-blur-sm transition-all duration-300 hover:scale-105 ${ACCENT_CLASS[accent]}`}>
          <Icon className="size-5" strokeWidth={1.5} />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`text-3xl font-bold tracking-tight tabular-nums ${TONE_CLASS[valueTone]}`}
        >
          {value}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}
