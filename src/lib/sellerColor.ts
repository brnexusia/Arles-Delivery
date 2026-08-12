/**
 * Cor fixa por vendedora, derivada da mesma cor principal dos gráficos
 * (--chart-1) apenas variando a intensidade — verde/vermelho seguem
 * reservados para tendência.
 */
const LEVELS = [18, 30, 42, 56, 70, 84];

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

export function sellerLevel(seller: string) {
  return LEVELS[hash(seller) % LEVELS.length]!;
}

/** Preenchimento sólido usado nos gráficos (opacidade sobre a cor principal). */
export function sellerFillOpacity(seller: string) {
  return sellerLevel(seller) / 100;
}

/** Estilo do badge da vendedora: fundo tingido + traço na mesma cor. */
export function sellerBadgeStyle(seller: string): React.CSSProperties {
  const level = sellerLevel(seller);
  return {
    backgroundColor: `color-mix(in oklab, var(--chart-1) ${Math.round(level * 0.28)}%, transparent)`,
    borderColor: `color-mix(in oklab, var(--chart-1) ${Math.round(level * 0.6)}%, transparent)`,
    color: "var(--foreground)",
  };
}
