import { useMemo, useState } from "react";
import { Check, History, RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sellerBadgeStyle } from "@/lib/sellerColor";
import { formatBR, formatPhone, historyOf, weekdayOf, type Contact } from "@/lib/data";

const PAGE_SIZES = [25, 50, 100];

export function ContactsTable({ rows, allRows }: { rows: Contact[]; allRows: Contact[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [sellerFilter, setSellerFilter] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pageInput, setPageInput] = useState("");

  const sellers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.seller))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = rows.filter((r) => {
      if (q && !(r.name.toLowerCase().includes(q) || r.phone.replace(/\D/g, "").includes(q)))
        return false;
      if (sellerFilter.length > 0 && !sellerFilter.includes(r.seller)) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
    return base.sort((a, b) => b.date.localeCompare(a.date));
  }, [rows, query, sellerFilter, from, to]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const slice = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const hasFilters =
    query.trim() !== "" || sellerFilter.length > 0 || from !== "" || to !== "";

  const resetFilters = () => {
    setQuery("");
    setSellerFilter([]);
    setFrom("");
    setTo("");
    setPage(0);
  };

  const toggleSeller = (s: string) => {
    setSellerFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
    setPage(0);
  };

  const goToPage = () => {
    const n = Number(pageInput);
    if (!Number.isFinite(n) || n < 1) return;
    setPage(Math.min(Math.ceil(n), pageCount) - 1);
    setPageInput("");
  };

  const history = useMemo(
    () => (openPhone ? historyOf(allRows, openPhone) : []),
    [openPhone, allRows],
  );
  const historyName = history.find((h) => h.name)?.name;

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="gap-0 overflow-hidden p-0 shadow-[var(--shadow-card)]">
        <div className="space-y-4 border-b p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Contatos</h2>
              <p className="text-xs text-muted-foreground">
                {filtered.length.toLocaleString("pt-BR")}{" "}
                {hasFilters
                  ? `resultado(s) de ${rows.length.toLocaleString("pt-BR")} registros`
                  : "registros (todas as entradas, sem deduplicação)"}
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Buscar por telefone ou nome..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Vendedora</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-w-[12rem] justify-between font-normal"
                  >
                    {sellerFilter.length === 0
                      ? "Todas"
                      : `${sellerFilter.length} selecionada(s)`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[12rem]">
                  {sellers.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onSelect={(e) => {
                        e.preventDefault();
                        toggleSeller(s);
                      }}
                      className="justify-between"
                    >
                      {s}
                      {sellerFilter.includes(s) && <Check className="size-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">De</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(0);
                }}
                className="h-8 w-[10rem]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Até</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(0);
                }}
                className="h-8 w-[10rem]"
              />
            </div>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-muted-foreground"
              >
                <RotateCcw className="size-4" />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        <Table>
          <TableHeader className="bg-surface-1">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-foreground">Telefone</TableHead>
              <TableHead className="font-semibold text-foreground">Contato</TableHead>
              <TableHead className="font-semibold text-foreground">Data</TableHead>
              <TableHead className="font-semibold text-foreground">Vendedora</TableHead>
              <TableHead className="w-16 text-right font-semibold text-foreground">
                Histórico
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((r, i) => (
              <TableRow
                key={`${r.phone}-${r.date}-${i}`}
                onClick={() => setOpenPhone(r.phone)}
                className="cursor-pointer transition-colors hover:bg-accent/60 data-[state=selected]:bg-accent"
              >
                <TableCell className="font-mono text-xs tabular-nums">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenPhone(r.phone);
                    }}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {formatPhone(r.phone)}
                  </button>
                </TableCell>
                <TableCell className="max-w-[16rem] font-medium">
                  {r.name ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block max-w-[16rem] truncate">{r.name}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs break-words">
                        {r.name}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatBR(r.date)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    style={sellerBadgeStyle(r.seller)}
                    className="font-medium"
                  >
                    {r.seller}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Ver histórico"
                        className="size-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenPhone(r.phone);
                        }}
                      >
                        <History className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Ver histórico</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {slice.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhum contato encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Itens por página</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(0);
              }}
            >
              <SelectTrigger className="h-8 w-[5.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Página {current + 1} de {pageCount}
            </span>
            <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(0)}>
              Primeira
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Próxima
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(pageCount - 1)}
            >
              Última
            </Button>
            <div className="flex items-center gap-1.5">
              <Input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") goToPage();
                }}
                placeholder="Nº"
                inputMode="numeric"
                className="h-8 w-[4.5rem] text-center tabular-nums"
              />
              <Button size="sm" variant="secondary" onClick={goToPage} disabled={!pageInput}>
                Ir
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Sheet open={openPhone !== null} onOpenChange={(o) => !o && setOpenPhone(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Timeline do cliente</SheetTitle>
            <SheetDescription>
              {historyName ? `${historyName} · ` : ""}
              {openPhone ? formatPhone(openPhone) : ""} — {history.length} contato(s) registrados
            </SheetDescription>
          </SheetHeader>

          <div className="overflow-y-auto px-4 pb-6">
            <ol className="relative space-y-4 border-l pl-5">
              {history.map((h, i) => (
                <li key={`${h.date}-${i}`} className="relative">
                  <span className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium tabular-nums">{formatBR(h.date)}</span>
                    <Badge variant="outline" style={sellerBadgeStyle(h.seller)}>
                      {h.seller}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {weekdayOf(h.date)}
                    {h.name ? ` · ${h.name}` : ""}
                  </p>
                </li>
              ))}
              {history.length === 0 && (
                <li className="text-sm text-muted-foreground">Sem histórico.</li>
              )}
            </ol>
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
