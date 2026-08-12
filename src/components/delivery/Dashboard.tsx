import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Clock, CheckCircle } from "lucide-react";
import { engineData, engineRequest } from "@/lib/arles-engine";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";

import { AlertCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Dashboard({ goToTab }: { goToTab?: (tab: any, subtab?: any) => void }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [waStatus, setWaStatus] = useState<string>("connected");

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const [orderData, waData] = await Promise.all([
          engineData<any[]>("orders"),
          engineRequest<{ status?: string }>("whatsapp/status"),
        ]);
        setOrders(orderData || []);
        setWaStatus(waData?.status === "disconnected" ? "disconnected" : "connected");
      } catch (error) {
        console.error("Dashboard Engine:", error);
      }
    }
    load();
  }, [user]);

  const today = new Date().toISOString().split("T")[0];
  const todaysOrders = orders.filter(o => o.created_at.startsWith(today)).length;
  const inProgress = orders.filter(o => ["Novos", "Em preparo", "Pronto", "Saiu para entrega"].includes(o.status)).length;
  const finished = orders.filter(o => o.status === "Finalizados").length;
  const recentOrders = orders.slice(0, 10);

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Resumo das suas operações de hoje.</p>
      </div>

      {waStatus === "disconnected" && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-destructive/20 p-2 rounded-full text-destructive">
              <Smartphone className="size-5" />
            </div>
            <div>
              <p className="font-semibold text-destructive">Seu WhatsApp está desconectado.</p>
              <p className="text-sm text-destructive/80">O assistente não conseguirá responder aos clientes.</p>
            </div>
          </div>
          <Button variant="destructive" onClick={() => goToTab?.("settings", "whatsapp")}>
            Reconectar
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Hoje</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todaysOrders}</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-amber-200 bg-amber-50/30 dark:bg-amber-900/10 dark:border-amber-900/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-500">Em andamento</CardTitle>
            <Clock className="size-4 text-amber-600 dark:text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">{inProgress}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-emerald-200 bg-emerald-50/30 dark:bg-emerald-900/10 dark:border-emerald-900/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-500">Finalizados</CardTitle>
            <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{finished}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Últimos Pedidos</h3>
        <Card className="shadow-sm overflow-hidden">
          <div className="divide-y">
            <div className="grid grid-cols-4 px-6 py-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-2 sm:col-span-1">Cliente</div>
              <div className="hidden sm:block">Valor</div>
              <div>Status</div>
              <div className="text-right">Horário</div>
            </div>
            {recentOrders.length === 0 ? (
               <div className="p-8 text-center text-muted-foreground">Nenhum pedido registrado ainda.</div>
            ) : recentOrders.map((order) => (
              <div key={order.id} className="grid grid-cols-4 px-6 py-4 items-center text-sm hover:bg-muted/30 transition-colors">
                <div className="col-span-2 sm:col-span-1 font-medium text-foreground truncate pr-2">
                  {order.client_name} <span className="text-xs text-muted-foreground ml-1">#{order.id.slice(0, 4)}</span>
                </div>
                <div className="hidden sm:block">R$ {Number(order.total_value).toFixed(2).replace(".", ",")}</div>
                <div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    order.status === "Em preparo" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                    order.status === "Pronto" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" :
                    order.status === "Saiu para entrega" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                    order.status === "Finalizados" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {order.status}
                  </span>
                </div>
                <div className="text-right text-muted-foreground">{format(new Date(order.created_at), "HH:mm")}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
