import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, User, Phone, ShoppingBag, TrendingUp, Clock, FileText } from "lucide-react";
import { engineData, engineRequest } from "@/lib/arles-engine";
import { useAuth } from "@/lib/auth";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Customer = {
  id: string;
  company_id: string;
  name: string;
  phone_number: string;
  notes: string | null;
  first_order_at: string | null;
  last_order_at: string | null;
  orders_count: number;
  total_spent: number;
  created_at: string;
};

type Order = {
  id: string;
  created_at: string;
  items: { name: string; quantity?: number; price?: number }[];
  total_value: number;
  payment_method: string | null;
  status: string;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusColor(status: string) {
  switch (status) {
    case "Novos":            return "bg-red-100 text-red-700";
    case "Em preparo":       return "bg-amber-100 text-amber-700";
    case "Pronto":           return "bg-violet-100 text-violet-700";
    case "Saiu para entrega": return "bg-blue-100 text-blue-700";
    case "Finalizados":      return "bg-emerald-100 text-emerald-700";
    default:                 return "bg-gray-100 text-gray-700";
  }
}

// ─── Customer Detail Modal ─────────────────────────────────────────────────────
function CustomerModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setOrders((await engineData<Order[]>(`customers/${customer.id}/orders`)) || []);
      } catch (error) {
        console.error("Histórico do cliente:", error);
      } finally {
        setLoadingOrders(false);
      }
    };
    void fetchOrders();
  }, [customer.id]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await engineRequest(`customers/${customer.id}`, {
        method: "PATCH",
        body: { notes },
      });
    } catch (error) {
      console.error("Notas do cliente:", error);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-lg">
          <User className="size-5 text-primary" />
          {customer.name}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6 pt-2">
        {/* Info geral */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border bg-muted/30 p-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
              <Phone className="size-3" /> Telefone
            </p>
            <p className="font-medium">{customer.phone_number}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
              <ShoppingBag className="size-3" /> Pedidos
            </p>
            <p className="font-bold text-base">{customer.orders_count}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
              <TrendingUp className="size-3" /> Total gasto
            </p>
            <p className="font-bold text-base text-primary">{formatCurrency(customer.total_spent)}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
              <Clock className="size-3" /> Último pedido
            </p>
            <p className="font-medium">{formatDate(customer.last_order_at)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Primeira compra</p>
            <p className="font-medium">{formatDate(customer.first_order_at)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Última compra</p>
            <p className="font-medium">{formatDate(customer.last_order_at)}</p>
          </div>
        </div>

        {/* Observações */}
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
            <FileText className="size-3" /> Observações
          </p>
          <textarea
            className="w-full min-h-[72px] rounded-xl border bg-muted/30 p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder='Ex: "Prefere sem cebola", "Sempre paga no PIX"…'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
          />
          {savingNotes && <p className="text-[10px] text-muted-foreground mt-1">Salvando…</p>}
        </div>

        {/* Histórico de pedidos */}
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1">
            <ShoppingBag className="size-3" /> Histórico de pedidos
          </p>

          {loadingOrders ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-6 border-2 border-dashed rounded-xl">
              Nenhum pedido encontrado.
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const items = Array.isArray(order.items) ? order.items : [];
                return (
                  <div
                    key={order.id}
                    className="rounded-xl border bg-card p-4 space-y-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatDate(order.created_at)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${statusColor(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <p className="text-sm font-medium leading-snug">
                      {items.length > 0
                        ? items.map((i) => `${i.quantity ?? 1}x ${i.name}`).join(" · ")
                        : "Sem itens detalhados"}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {order.payment_method ?? "—"}
                      </span>
                      <span className="text-sm font-bold">
                        {formatCurrency(Number(order.total_value))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );
}

// ─── Main Customers Screen ─────────────────────────────────────────────────────
export function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchCustomers = async () => {
      try {
        setCustomers((await engineData<Customer[]>("customers")) || []);
      } catch (error) {
        console.error("Clientes Engine:", error);
      } finally {
        setLoading(false);
      }
    };
    void fetchCustomers();
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone_number.toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Clientes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Clientes cadastrados automaticamente a partir dos pedidos.
        </p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
          {search
            ? "Nenhum cliente encontrado para esta busca."
            : "Nenhum cliente ainda. Eles aparecem automaticamente após o primeiro pedido."}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
            {search ? " encontrado" + (filtered.length !== 1 ? "s" : "") : " no total"}
          </p>

          {/* Tabela */}
          <div className="rounded-xl border overflow-hidden shadow-sm">
            {/* Header — hidden on mobile, shown on sm+ */}
            <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-muted/40 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Cliente</span>
              <span>Telefone</span>
              <span className="text-right">Pedidos</span>
              <span className="text-right">Total gasto</span>
              <span className="text-right">Última compra</span>
            </div>

            <div className="divide-y">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="w-full text-left hover:bg-muted/30 transition-colors"
                >
                  {/* Mobile layout */}
                  <div className="sm:hidden flex items-start justify-between px-4 py-4 gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.phone_number}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{formatCurrency(c.total_spent)}</p>
                      <p className="text-[10px] text-muted-foreground">{c.orders_count} pedido{c.orders_count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] gap-4 items-center px-5 py-4">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{c.phone_number}</p>
                    <p className="text-sm font-medium text-right">{c.orders_count}</p>
                    <p className="text-sm font-bold text-primary text-right">{formatCurrency(c.total_spent)}</p>
                    <p className="text-sm text-muted-foreground text-right">{formatDate(c.last_order_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modal de detalhe */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && <CustomerModal customer={selected} onClose={() => setSelected(null)} />}
      </Dialog>
    </div>
  );
}
