import { useState, useEffect, useCallback } from "react";
import {
  ImageIcon, RefreshCw, Download, Loader2,
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuRendererService, type MenuAsset } from "@/lib/MenuRendererService";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function VisualMenuPanel({ onRegenerate }: { onRegenerate?: () => void }) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<MenuAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [preview, setPreview] = useState(0);

  const refreshAssets = useCallback(async () => {
    if (!user) return;
    const data = await MenuRendererService.getActiveMenuImages(user.companyId);
    setAssets(data);
    setPreview(0);
    setLoading(false);
  }, [user]);

  // Initial load
  useEffect(() => {
    refreshAssets();
  }, [refreshAssets]);

  // Listen to generation lifecycle events dispatched by MenuRendererService
  useEffect(() => {
    const onStart = () => {
      setGenerating(true);
      setLastError(null);
    };
    const onDone = () => {
      setGenerating(false);
      refreshAssets();
      onRegenerate?.();
    };

    window.addEventListener("menu-generation-start", onStart);
    window.addEventListener("menu-assets-updated", onDone);
    return () => {
      window.removeEventListener("menu-generation-start", onStart);
      window.removeEventListener("menu-assets-updated", onDone);
    };
  }, [refreshAssets, onRegenerate]);

  // Manual trigger ("Atualizar agora")
  const handleManualRegenerate = async () => {
    if (!user || generating) return;
    setGenerating(true);
    setLastError(null);
    try {
      await MenuRendererService.generateMenuImages(user.companyId);
      await refreshAssets();
      onRegenerate?.();
    } catch (err: any) {
      if (err.message === "NO_PRODUCTS") {
        setLastError("Cadastre pelo menos um produto disponível antes de gerar o cardápio visual.");
      } else if (err.message?.includes("bucket") || err.message?.includes("Storage")) {
        setLastError("Erro de armazenamento. Verifique se o bucket 'menu-assets' existe no Supabase como público.");
      } else {
        setLastError(err.message || "Não foi possível atualizar. Tente novamente.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const hasAssets = assets.length > 0;
  const lastUpdated = assets[0]?.created_at;

  function statusLine() {
    if (generating) return null;
    if (lastError) return null;
    if (!lastUpdated) return null;
    return formatDistanceToNow(new Date(lastUpdated), { addSuffix: true, locale: ptBR });
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-600 flex items-center justify-center shrink-0">
            <ImageIcon className="size-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Cardápio Visual</h3>

            {/* Status line */}
            {generating && (
              <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                <Loader2 className="size-3 animate-spin" />
                Atualizando cardápio...
              </p>
            )}
            {!generating && lastError && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                <AlertCircle className="size-3" />
                Não foi possível atualizar.
              </p>
            )}
            {!generating && !lastError && lastUpdated && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="size-3 text-emerald-500" />
                Atualizado {statusLine()}
              </p>
            )}
            {!generating && !lastError && !lastUpdated && !loading && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="size-3" />
                Nunca gerado
              </p>
            )}
          </div>
        </div>

        {/* Small secondary "Atualizar agora" */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualRegenerate}
          disabled={generating}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {generating
            ? <Loader2 className="size-3 animate-spin" />
            : <RefreshCw className="size-3" />}
          <span className="ml-1.5">Atualizar agora</span>
        </Button>
      </div>

      {/* Error message */}
      {lastError && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      {/* Body */}
      <div className="p-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>

        ) : !hasAssets ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-3">
            <div className="size-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <ImageIcon className="size-7 opacity-40" />
            </div>
            <div>
              <p className="font-medium text-sm">Nenhum cardápio visual ainda</p>
              <p className="text-sm mt-1 max-w-xs">
                O cardápio é gerado automaticamente quando você cadastra ou edita um produto.
                Ou clique em <strong>Atualizar agora</strong> para forçar.
              </p>
            </div>
          </div>

        ) : (
          <div className="space-y-4">
            {/* Preview image */}
            <div className="relative aspect-[2/3] w-full max-w-xs mx-auto rounded-xl overflow-hidden border shadow-md bg-muted">
              {generating && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-6 animate-spin" />
                    <span>Gerando novo cardápio...</span>
                  </div>
                </div>
              )}
              <img
                key={assets[preview]?.image_url} // force re-render on url change
                src={assets[preview]?.image_url}
                alt={`Página ${preview + 1} do cardápio`}
                className="w-full h-full object-cover"
              />

              {/* Navigation arrows */}
              {assets.length > 1 && !generating && (
                <>
                  <button
                    onClick={() => setPreview(p => Math.max(0, p - 1))}
                    disabled={preview === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-20 hover:bg-black/60 transition-colors"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    onClick={() => setPreview(p => Math.min(assets.length - 1, p + 1))}
                    disabled={preview === assets.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-20 hover:bg-black/60 transition-colors"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </>
              )}

              {/* Page counter */}
              {assets.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
                  {preview + 1} / {assets.length}
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {assets.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {assets.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setPreview(i)}
                    className={`shrink-0 w-14 aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all ${
                      i === preview ? "border-primary shadow-sm scale-105" : "border-transparent opacity-50 hover:opacity-75"
                    }`}
                  >
                    <img src={a.image_url} alt={`Pág ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Download button */}
            <a
              href={assets[preview]?.image_url}
              download={`cardapio-pagina-${preview + 1}.png`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl border text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <Download className="size-4" />
              Baixar página {preview + 1}
            </a>

            <p className="text-xs text-center text-muted-foreground">
              {assets.length} {assets.length === 1 ? "página" : "páginas"} — somente produtos disponíveis aparecem
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
