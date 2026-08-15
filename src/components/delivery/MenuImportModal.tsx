import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  ImagePlus,
  FileImage,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { useMenuImportAI } from "@/lib/MenuImportAIProvider";
import { Switch } from "@/components/ui/switch";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXT = ".jpg,.jpeg,.png,.webp";
const MAX_FILES = 6;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

type ProcessingStage = "idle" | "uploading" | "analyzing" | "preparing";

function stageLable(stage: ProcessingStage) {
  if (stage === "uploading") return "Enviando fotos...";
  if (stage === "analyzing") return "Analisando cardápio...";
  if (stage === "preparing") return "Preparando revisão...";
  return "";
}

export function MenuImportModal({ onImportComplete }: { onImportComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "processing" | "review" | "done">("select");
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const { extractMenu, confirmImport } = useMenuImportAI();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [analysisInfo, setAnalysisInfo] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const resetState = () => {
    setStep("select");
    setStage("idle");
    setError(null);
    setCategories([]);
    setAnalysisInfo(null);
    setImporting(false);
    setSelectedFiles([]);
    setImportedCount(0);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetState();
    setOpen(isOpen);
  };

  const onFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    const validType = incoming.filter((file) => ALLOWED_TYPES.includes(file.type));
    const validSize = validType.filter((file) => file.size <= MAX_FILE_BYTES);
    const messages: string[] = [];
    if (validType.length !== incoming.length) messages.push("Use somente JPG, PNG ou WEBP.");
    if (validSize.length !== validType.length) messages.push("Cada foto pode ter até 12 MB.");

    const existing = new Set(selectedFiles.map((file) => `${file.name}:${file.size}`));
    const unique = validSize.filter((file) => !existing.has(`${file.name}:${file.size}`));
    const combined = [...selectedFiles, ...unique];
    if (combined.length > MAX_FILES)
      messages.push(`Envie no máximo ${MAX_FILES} fotos por análise.`);
    setSelectedFiles(combined.slice(0, MAX_FILES));
    setError(messages.length ? messages.join(" ") : null);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) return;

    setStep("processing");
    setError(null);

    try {
      setStage("uploading");
      // Small delay to show "Enviando fotos..." feedback before heavy work
      await new Promise((r) => setTimeout(r, 300));
      setStage("analyzing");
      const result = await extractMenu(selectedFiles);
      setStage("preparing");
      await new Promise((r) => setTimeout(r, 200));
      setCategories(result.categories || []);
      setAnalysisInfo(result.analysis || null);
      setStep("review");
    } catch (err: any) {
      setError(
        err?.message ||
          "Não foi possível analisar o cardápio. Tente novamente com uma foto mais nítida.",
      );
      setStep("select");
    } finally {
      setStage("idle");
    }
  };

  const handleConfirm = async () => {
    setImporting(true);
    setError(null);
    try {
      const result = await confirmImport(categories);
      setImportedCount(result.imported);
      setStep("done");
      onImportComplete();
    } catch (err: any) {
      setError("Não foi possível salvar os produtos. Tente novamente.");
    } finally {
      setImporting(false);
    }
  };

  const updateProduct = (catIdx: number, prodIdx: number, field: string, value: any) => {
    const newCats = [...categories];
    newCats[catIdx].products[prodIdx][field] = value;
    setCategories(newCats);
  };

  const removeProduct = (catIdx: number, prodIdx: number) => {
    const newCats = [...categories];
    newCats[catIdx].products.splice(prodIdx, 1);
    // Remove empty categories
    const filtered = newCats.filter((c) => c.products.length > 0);
    setCategories(filtered);
  };

  const totalProducts = categories.reduce((acc, cat) => acc + (cat.products?.length || 0), 0);
  const totalCategories = categories.length;
  const missingPrices = categories.reduce(
    (total, category) =>
      total +
      (category.products || []).filter(
        (product: any) =>
          !product.ignore && (product.price === null || !Number.isFinite(Number(product.price))),
      ).length,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white shadow-md">
          <Sparkles className="size-4 mr-2" />
          Importar com IA
        </Button>
      </DialogTrigger>

      <DialogContent
        className={`${
          step === "review" ? "sm:max-w-[820px]" : "sm:max-w-[480px]"
        } max-h-[90vh] flex flex-col overflow-hidden`}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Importar cardápio com IA</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-2">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-start gap-2">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── SELECT ── */}
          {step === "select" && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Envie até {MAX_FILES} fotos. O Arles amplia topo, colunas, laterais e rodapé, cruza
                as leituras e organiza produtos, preços e variações automaticamente.
              </p>

              <input
                type="file"
                accept={ALLOWED_EXT}
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={onFilesChange}
              />

              {/* Drop zone */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl hover:border-primary hover:bg-primary/5 transition-colors group"
              >
                <ImagePlus className="size-10 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="text-center">
                  <p className="text-sm font-medium">Selecionar fotos do cardápio</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, JPEG, PNG ou WEBP · até 12 MB por foto
                  </p>
                </div>
              </button>

              {/* File list */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {selectedFiles.length} foto(s) selecionada(s)
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm"
                      >
                        <FileImage className="size-4 text-primary shrink-0" />
                        <span className="flex-1 truncate text-xs">{f.name}</span>
                        <button
                          onClick={() => removeFile(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                disabled={selectedFiles.length === 0}
                onClick={handleAnalyze}
              >
                <Sparkles className="size-4 mr-2" />
                Analisar com IA
              </Button>
            </div>
          )}

          {/* ── PROCESSING ── */}
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-14 space-y-5">
              <div className="relative">
                <Sparkles className="size-12 text-primary animate-pulse" />
                <Loader2 className="size-5 text-muted-foreground animate-spin absolute -bottom-1 -right-1" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-base">{stageLable(stage)}</p>
                <p className="text-sm text-muted-foreground">
                  {stage === "analyzing"
                    ? `Ampliando e cruzando as regiões de ${selectedFiles.length} foto(s)… Isso pode levar até alguns minutos.`
                    : "Aguarde um momento."}
                </p>
              </div>
            </div>
          )}

          {/* ── REVIEW ── */}
          {step === "review" && (
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
              {/* Fixed header */}
              <div className="flex-shrink-0 mb-3">
                <p className="text-sm font-semibold">
                  Encontramos {totalProducts} produto(s) em {totalCategories} categoria(s).
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Revise os dados abaixo. Edite, exclua ou desative antes de importar.
                </p>
                {analysisInfo && (
                  <p className="text-xs text-emerald-700 mt-1">
                    Leitura reforçada: {analysisInfo.regionsAnalyzed} região(ões) cruzada(s) em{" "}
                    {analysisInfo.passesCompleted} etapa(s).
                  </p>
                )}
                {missingPrices > 0 && (
                  <div className="mt-2 p-2.5 rounded-md bg-amber-50 text-amber-800 text-xs flex items-start gap-2">
                    <AlertCircle className="size-4 mt-0.5 shrink-0" />
                    <span>
                      {missingPrices} item(ns) ficaram sem preço legível. Informe o preço ou
                      desligue “Importar” nesses itens para concluir.
                    </span>
                  </div>
                )}
              </div>

              {/* Scrollable list only */}
              <div className="flex-1 min-h-0 overflow-y-auto border rounded-xl p-4">
                {categories.map((cat, cIdx) => (
                  <div key={cIdx} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Input
                        value={cat.name}
                        onChange={(e) => {
                          const newCats = [...categories];
                          newCats[cIdx].name = e.target.value;
                          setCategories(newCats);
                        }}
                        className="font-bold text-base border-none bg-transparent px-0 focus-visible:ring-0 h-auto"
                      />
                    </div>

                    <div className="space-y-3">
                      {cat.products.map((prod: any, pIdx: number) => (
                        <div
                          key={pIdx}
                          className={`p-3 border rounded-lg flex flex-col gap-2 ${
                            prod.ignore ? "opacity-40 bg-muted" : "bg-card"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1.5">
                              <Input
                                value={prod.name}
                                onChange={(e) => updateProduct(cIdx, pIdx, "name", e.target.value)}
                                className="font-semibold h-7 text-sm"
                              />
                              <Input
                                value={prod.description || ""}
                                onChange={(e) =>
                                  updateProduct(cIdx, pIdx, "description", e.target.value)
                                }
                                className="h-7 text-xs text-muted-foreground"
                                placeholder="Sem descrição"
                              />
                              <div className="flex items-center gap-2 pt-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Preço (R$):
                                </span>
                                <Input
                                  value={prod.price ?? ""}
                                  onChange={(e) =>
                                    updateProduct(
                                      cIdx,
                                      pIdx,
                                      "price",
                                      e.target.value === ""
                                        ? null
                                        : parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  type="number"
                                  step="0.01"
                                  placeholder="null"
                                  className="h-7 w-24 text-xs font-bold text-primary"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                  Importar
                                </span>
                                <Switch
                                  checked={!prod.ignore}
                                  onCheckedChange={(c) => updateProduct(cIdx, pIdx, "ignore", !c)}
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                  Disponível
                                </span>
                                <Switch
                                  checked={prod.available !== false}
                                  onCheckedChange={(c) => updateProduct(cIdx, pIdx, "available", c)}
                                />
                              </div>
                              <button
                                onClick={() => removeProduct(cIdx, pIdx)}
                                className="text-[10px] text-destructive hover:underline mt-1"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>

                          {/* Variations */}
                          {prod.variations && prod.variations.length > 0 && (
                            <div className="mt-2 pt-2 border-t text-xs space-y-1">
                              <p className="font-semibold text-muted-foreground mb-1">Variações:</p>
                              {prod.variations.map((v: any, vIdx: number) => (
                                <div key={vIdx} className="flex items-center gap-2">
                                  <Input
                                    value={v.name}
                                    onChange={(e) => {
                                      const newCats = [...categories];
                                      newCats[cIdx].products[pIdx].variations[vIdx].name =
                                        e.target.value;
                                      setCategories(newCats);
                                    }}
                                    className="h-6 text-xs flex-1"
                                  />
                                  <Input
                                    value={v.price}
                                    onChange={(e) => {
                                      const newCats = [...categories];
                                      newCats[cIdx].products[pIdx].variations[vIdx].price =
                                        parseFloat(e.target.value) || 0;
                                      setCategories(newCats);
                                    }}
                                    type="number"
                                    step="0.01"
                                    className="h-6 w-20 text-xs text-right"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Fixed footer */}
              <div className="flex-shrink-0 flex justify-between gap-2 mt-3 pt-3 border-t">
                <Button variant="outline" onClick={() => setStep("select")} disabled={importing}>
                  Voltar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={importing || totalProducts === 0 || missingPrices > 0}
                >
                  {importing && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Importar produtos
                </Button>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="size-8 text-emerald-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xl font-bold">Importação concluída!</p>
                <p className="text-muted-foreground text-sm">
                  {importedCount} produto(s) importado(s) com sucesso.
                </p>
              </div>
              <Button className="w-full" onClick={() => setOpen(false)}>
                Ver Cardápio
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
