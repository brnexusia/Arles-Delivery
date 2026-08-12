import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Clock, CreditCard, Banknote, QrCode, FileImage, Eye, EyeOff } from "lucide-react";
import { engineData, engineRequest } from "@/lib/arles-engine";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";

const TABS = ["Todos", "Novos", "Preparo", "Pronto", "Entrega", "Fim", "Cancela"];

// Payment status badge config
function PaymentBadge({ order }: { order: any }) {
  const method = order.payment_method;
  const status = order.payment_status;

  if (!method && !status) return null;

  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> Pagamento aprovado
      </span>
    );
  }

  if (status === "pending_approval") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <Clock className="size-3" /> PIX aguardando aprovação
      </span>
    );
  }

  if (status === "pay_on_delivery") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        {method === "card" ? <CreditCard className="size-3" /> : <Banknote className="size-3" />}
        Pagamento no local
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-muted text-muted-foreground">
        <QrCode className="size-3" /> PIX pendente
      </span>
    );
  }

  return null;
}

// Method label helper
function methodLabel(method: string) {
  if (method === "pix") return "PIX";
  if (method === "card") return "Cartão";
  if (method === "cash") return "Dinheiro";
  return method || "—";
}

export function Orders() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingPayment, setApprovingPayment] = useState(false);
  const [proofPreviewOrderId, setProofPreviewOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setOrders((await engineData<any[]>("orders")) || []);
    } catch (error) {
      console.error("Pedidos Engine:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchOrders(); }, [user]);

  const updateStatus = async (status: string) => {
    if (!selectedOrder || !user?.companyId) return;
    if (status === selectedOrder.status) return;

    try {
      await engineRequest(`orders/${selectedOrder.id}/status`, {
        method: "POST",
        body: { status },
      });
      const isNowDelivered = status === "Finalizados";
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
        ...(isNowDelivered ? { delivered_at: new Date().toISOString() } : {}),
      };
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, ...updateData } : o));
      setSelectedOrder({ ...selectedOrder, ...updateData });
    } catch (error: any) {
      alert("Não foi possível atualizar o pedido: " + (error?.message || "erro desconhecido"));
    }
  };

  const approvePayment = async () => {
    if (!selectedOrder) return;
    setApprovingPayment(true);
    try {
      await engineRequest(`orders/${selectedOrder.id}/payment`, {
        method: "POST",
        body: { payment_status: "approved" },
      });
      const now = new Date().toISOString();
      const updateData = { payment_status: "approved", payment_approved_at: now };
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, ...updateData } : o));
      setSelectedOrder({ ...selectedOrder, ...updateData });
    } catch (error: any) {
      alert("Não foi possível aprovar o PIX: " + (error?.message || "erro desconhecido"));
    } finally {
      setApprovingPayment(false);
    }
  };

  // Mapeamento dos filtros
  const statusMap: Record<string, string[]> = {
    "Todos": ["Novos", "Em preparo", "Pronto", "Saiu para entrega", "Finalizados", "Cancelados"],
    "Novos": ["Novos"],
    "Preparo": ["Em preparo"],
    "Pronto": ["Pronto"],
    "Entrega": ["Saiu para entrega"],
    "Fim": ["Finalizados"],
    "Cancela": ["Cancelados"]
  };

  const filtered = activeFilter === "Todos" ? orders : orders.filter(o => statusMap[activeFilter]?.includes(o.status));

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Gerenciamento de Pedidos</h2>
      </div>

      <div className="flex flex-wrap gap-2 pb-2">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeFilter === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
          Nenhum pedido encontrado para este filtro.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(order => {
            const items = Array.isArray(order.items) ? order.items : [];
            const hasPendingPix = order.payment_status === "pending_approval";
            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`rounded-xl border bg-card p-5 cursor-pointer hover:border-primary/50 transition-colors shadow-sm relative overflow-hidden ${
                  hasPendingPix ? "border-amber-300 dark:border-amber-700" : ""
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">#{order.id.slice(0, 4)}</span>
                    <h3 className="font-semibold text-lg leading-tight mt-0.5 truncate pr-2">{order.client_name}</h3>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${
                    order.status === "Novos" ? "bg-red-100 text-red-700" :
                    order.status === "Em preparo" ? "bg-amber-100 text-amber-700" :
                    order.status === "Pronto" ? "bg-violet-100 text-violet-700" :
                    order.status === "Saiu para entrega" ? "bg-blue-100 text-blue-700" :
                    order.status === "Finalizados" ? "bg-emerald-100 text-emerald-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {order.status}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {items.length > 0 ? items.map((i: any) => `${i.quantity || 1}x ${i.name}`).join(", ") : "Sem itens detalhados"}
                </p>

                {/* Payment badge on card */}
                {(order.payment_method || order.payment_status) && (
                  <div className="mb-3">
                    <PaymentBadge order={order} />
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">{format(new Date(order.created_at), "HH:mm")}</span>
                  <span className="font-bold">R$ {Number(order.total_value).toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detalhes do Pedido Modal */}
      <Dialog
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            setProofPreviewOrderId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Pedido #{selectedOrder?.id.slice(0, 4)}
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground">
                {selectedOrder?.status}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5 pt-2">

              {/* Cliente */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Cliente</p>
                  <p className="font-medium">{selectedOrder.client_name}</p>
                  <p className="text-muted-foreground">{selectedOrder.client_phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Total</p>
                  <p className="text-primary font-bold text-lg">R$ {Number(selectedOrder.total_value).toFixed(2).replace(".", ",")}</p>
                </div>
              </div>

              {/* Pagamento */}
              <div className="rounded-xl border p-4 space-y-3 bg-muted/20">
                <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Pagamento</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedOrder.payment_method === "pix" && <QrCode className="size-4 text-primary" />}
                    {selectedOrder.payment_method === "card" && <CreditCard className="size-4 text-primary" />}
                    {selectedOrder.payment_method === "cash" && <Banknote className="size-4 text-primary" />}
                    <span className="font-semibold text-sm">{methodLabel(selectedOrder.payment_method)}</span>
                  </div>
                  <PaymentBadge order={selectedOrder} />
                </div>

                {/* Troco - apenas dinheiro */}
                {selectedOrder.payment_method === "cash" && selectedOrder.change_for && (
                  <p className="text-sm text-muted-foreground">
                    Troco para: <span className="font-semibold">R$ {Number(selectedOrder.change_for).toFixed(2).replace(".", ",")}</span>
                  </p>
                )}

                {/* Comprovante PIX
                    O workflow pode salvar um data:image/...;base64 diretamente na linha do pedido.
                    Navegar para data: em nova aba é bloqueado/instável em navegadores modernos,
                    então o comprovante é renderizado dentro do próprio painel. */}
                {selectedOrder.payment_method === "pix" && selectedOrder.payment_proof_url && (
                  <div className="mt-2 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">Comprovante enviado pelo cliente:</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setProofPreviewOrderId(current =>
                          current === selectedOrder.id ? null : selectedOrder.id
                        )
                      }
                      className="gap-2"
                    >
                      <FileImage className="size-4 text-primary" />
                      {proofPreviewOrderId === selectedOrder.id ? "Ocultar comprovante" : "Ver comprovante"}
                      {proofPreviewOrderId === selectedOrder.id
                        ? <EyeOff className="size-3 text-muted-foreground" />
                        : <Eye className="size-3 text-muted-foreground" />}
                    </Button>

                    {proofPreviewOrderId === selectedOrder.id && (
                      <div className="rounded-xl border bg-background p-2 overflow-hidden">
                        <img
                          src={selectedOrder.payment_proof_url}
                          alt={`Comprovante do pedido #${selectedOrder.id.slice(0, 4)}`}
                          className="block w-full max-h-[60vh] object-contain rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Botão Aprovar PIX */}
                {selectedOrder.payment_method === "pix" && selectedOrder.payment_status === "pending_approval" && (
                  <Button
                    onClick={approvePayment}
                    disabled={approvingPayment}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-1"
                  >
                    {approvingPayment
                      ? <Loader2 className="size-4 mr-2 animate-spin" />
                      : <CheckCircle2 className="size-4 mr-2" />}
                    Aprovar pagamento PIX
                  </Button>
                )}

                {/* PIX pendente sem comprovante */}
                {selectedOrder.payment_method === "pix" && selectedOrder.payment_status === "pending" && (
                  <p className="text-xs text-muted-foreground italic">
                    Aguardando o cliente enviar o comprovante via WhatsApp.
                  </p>
                )}

                {/* PIX já aprovado */}
                {selectedOrder.payment_method === "pix" && selectedOrder.payment_status === "approved" && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-emerald-600">Aprovado manualmente em:</p>
                    <p className="text-sm font-semibold">
                      {selectedOrder.payment_approved_at
                        ? format(new Date(selectedOrder.payment_approved_at), "dd/MM/yyyy 'às' HH:mm")
                        : "—"}
                    </p>
                  </div>
                )}
              </div>

              {/* Endereço */}
              <div>
                <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Endereço de Entrega</p>
                <p className="text-sm p-3 rounded-lg bg-muted/30 border">{selectedOrder.delivery_address || "Não informado"}</p>
              </div>

              {/* Itens */}
              <div>
                <p className="text-muted-foreground text-xs uppercase font-medium mb-2">Itens do Pedido</p>
                <ul className="space-y-2">
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, i: number) => (
                    <li key={i} className="text-sm font-medium flex justify-between border-b pb-2 last:border-0">
                      <span>{item.quantity || 1}x {item.name}</span>
                      {(item.unit_price ?? item.price) != null && <span className="text-muted-foreground">R$ {Number(item.unit_price ?? item.price).toFixed(2).replace(".", ",")}</span>}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Observações */}
              {selectedOrder.observations && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Observações</p>
                  <p className="text-sm p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/50">
                    {selectedOrder.observations}
                  </p>
                </div>
              )}

              {/* Ações de status */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {selectedOrder.status === "Novos" && <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => updateStatus("Em preparo")}>Preparando</Button>}
                {selectedOrder.status === "Em preparo" && <Button className="flex-1 bg-violet-500 hover:bg-violet-600 text-white" onClick={() => updateStatus("Pronto")}>Pedido pronto</Button>}
                {selectedOrder.status === "Pronto" && selectedOrder.delivery_type === "pickup" && <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => updateStatus("Finalizados")}>Retirado / Finalizar</Button>}
                {selectedOrder.status === "Pronto" && selectedOrder.delivery_type !== "pickup" && <Button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white" onClick={() => updateStatus("Saiu para entrega")}>Saiu p/ entrega</Button>}
                {selectedOrder.status === "Saiu para entrega" && <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => updateStatus("Finalizados")}>Entregue</Button>}
                <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 mt-1" onClick={() => updateStatus("Cancelados")}>Cancelar Pedido</Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
