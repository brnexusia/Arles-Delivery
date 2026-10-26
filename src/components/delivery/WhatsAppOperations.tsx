import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { engineRequest } from "@/lib/arles-engine";

type GroupState = {
  group_jid: string | null;
  manually_closed: boolean;
  menu_dirty: boolean;
};

export function WhatsAppOperations() {
  const [state, setState] = useState<GroupState | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const response = await engineRequest<{ data: GroupState }>("operations/group");
      setState(response.data);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Não foi possível consultar o grupo.");
    }
  };

  useEffect(() => { void refresh(); }, []);

  const pair = async () => {
    setBusy(true);
    try {
      const response = await engineRequest<{ code: string }>("operations/group/pair", {
        method: "POST", body: {}
      });
      setCode(response.code);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Não foi possível gerar o código.");
    } finally { setBusy(false); }
  };

  return (
    <Card className="mt-6 max-w-2xl">
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-lg">Grupo da equipe</h3>
          <p className="text-sm text-muted-foreground">
            Pedidos, produtos, pagamentos e resumos funcionam diretamente no grupo do WhatsApp.
          </p>
        </div>
        {state?.group_jid ? (
          <div className="rounded-lg border p-3 text-sm space-y-1">
            <p className="font-medium text-emerald-700">Grupo vinculado</p>
            <p className="text-muted-foreground break-all">{state.group_jid}</p>
            <p>{state.manually_closed ? "🔴 Loja fechada manualmente" : "🟢 Loja habilitada para pedidos"}</p>
            {state.menu_dirty && (
              <p className="text-amber-700">
                O cardápio visual precisa ser regenerado após alterações pelo WhatsApp.
                Enquanto isso, os clientes recebem os produtos atualizados em texto.
              </p>
            )}
          </div>
        ) : <p className="text-sm text-amber-700">Nenhum grupo vinculado.</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void pair()} disabled={busy}>{busy ? "Gerando..." : "Vincular grupo"}</Button>
          <Button variant="outline" onClick={() => void refresh()}>Atualizar status</Button>
        </div>
        {code && (
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Envie esta mensagem no grupo que será usado pela equipe:</p>
            <code className="text-sm break-all">/arles vincular {code}</code>
            <p className="text-xs text-muted-foreground">Código válido por 10 minutos e utilizado apenas uma vez.</p>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
          <p className="font-medium">Comandos principais</p>
          <p>esgotou Coca-Cola 2L · voltou Coca-Cola 2L</p>
          <p>preço X-Bacon 24,90 → confirmar preço</p>
          <p>#ABCD preparando · #ABCD pronto · #ABCD entregue</p>
          <p>pix #ABCD aprovar · fechar · abrir · resumo · pendentes</p>
        </div>
        <p className="text-xs text-muted-foreground">
          As mensagens dos clientes permanecem no privado. Somente o grupo vinculado controla a operação.
        </p>
      </CardContent>
    </Card>
  );
}
