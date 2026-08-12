import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { clientsByFrequency, formatBR, formatPhone, type Contact } from "@/lib/data";

export function FrequencyDetail({
  bucket,
  rows,
  onOpenChange,
}: {
  bucket: number | null;
  rows: Contact[];
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");

  const clients = useMemo(
    () => (bucket ? clientsByFrequency(rows, bucket) : []),
    [bucket, rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, "").includes(q),
    );
  }, [clients, query]);

  const label = bucket === 5 ? "5 ou mais contatos" : `exatamente ${bucket} contatos`;

  return (
    <Sheet open={bucket !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Clientes com {label}</SheetTitle>
          <SheetDescription>
            {clients.length.toLocaleString("pt-BR")} cliente(s) únicos no período filtrado
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por telefone ou nome..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2 overflow-y-auto px-4 pb-6">
          {filtered.map((c) => (
            <div key={c.phone} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs tabular-nums">{formatPhone(c.phone)}</span>
                <Badge variant="secondary">{c.days} dias</Badge>
              </div>
              <p className="mt-1 truncate text-sm font-medium">{c.name || "—"}</p>
              <p className="text-xs text-muted-foreground">
                Último contato em {formatBR(c.lastDate)} · {c.sellers.join(", ")}
              </p>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
