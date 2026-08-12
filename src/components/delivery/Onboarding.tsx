import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles, Store, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { engineData, engineRequest } from "@/lib/arles-engine";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface OnboardingProps {
  onComplete: (goToMenu?: boolean) => void;
  goToTab: (tab: any, subtab?: "geral" | "whatsapp" | "info") => void;
}

export function Onboarding({ onComplete, goToTab }: OnboardingProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  const [progress, setProgress] = useState({
    store_info_completed: false,
    whatsapp_completed: false,
  });

  const loadProgress = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [companyData, waData] = await Promise.all([
        engineData<any>("company"),
        engineRequest<any>("whatsapp/status"),
      ]);

      const store_info_completed = companyData?.store_info_completed || false;
      const whatsapp_connected = waData?.status === "connected";
      const whatsapp_completed = companyData?.whatsapp_completed || whatsapp_connected;

      setProgress({ store_info_completed, whatsapp_completed });

      // Auto-advance step
      if (!store_info_completed) {
        setStep(1);
      } else {
        setStep(2);
      }

      // Both done → complete onboarding and go to menu
      if (store_info_completed && whatsapp_completed) {
        await finishOnboarding();
        return;
      }
    } catch (error) {
      console.error("Onboarding Engine:", error);
      toast.error("Não foi possível carregar o onboarding. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const finishOnboarding = async () => {
    if (!user) return;
    await engineRequest("onboarding/complete", { method: "POST", body: {} });
    toast.success("WhatsApp conectado! Agora configure seu cardápio.");
    onComplete(true); // true = go to menu tab
  };

  useEffect(() => {
    loadProgress();
  }, [user]);

  // Listen for step-completed events (StoreInfo/WhatsApp save)
  useEffect(() => {
    const handleStep = () => loadProgress();
    window.addEventListener("onboarding-step-completed", handleStep);
    return () => window.removeEventListener("onboarding-step-completed", handleStep);
  }, [user]);

  const handleSkip = () => onComplete(false);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4 animate-in fade-in zoom-in duration-300">
      <div className="max-w-md w-full space-y-8">

        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
            <Sparkles className="size-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Bem-vindo ao Arles</h2>
          <p className="text-muted-foreground text-sm">
            Configure seu delivery em 2 passos rápidos.
          </p>
        </div>

        {/* Progress bar — 2 steps */}
        <div className="flex justify-center items-center gap-6 px-8 relative">
          <div className="absolute left-[calc(50%-48px)] right-[calc(50%-48px)] top-1/2 h-0.5 -translate-y-1/2 bg-muted z-0" />
          <div
            className="absolute left-[calc(50%-48px)] top-1/2 h-0.5 -translate-y-1/2 bg-primary z-0 transition-all duration-300"
            style={{ width: step >= 2 && progress.store_info_completed ? "96px" : "0px" }}
          />
          {[1, 2].map((num) => {
            const isDone = num === 1 ? progress.store_info_completed : progress.whatsapp_completed;
            return (
              <button
                key={num}
                onClick={() => progress.store_info_completed || num === 1 ? setStep(num) : undefined}
                className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  step === num ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                } ${isDone || step >= num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {isDone ? <CheckCircle2 className="size-4" /> : num}
              </button>
            );
          })}
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm relative overflow-hidden min-h-[200px] flex flex-col justify-center">

          {step === 1 && (
            <div className="space-y-4 text-center animate-in slide-in-from-right-4">
              <Store className="size-10 mx-auto text-primary" />
              <div>
                <h3 className="font-semibold text-lg">Configure sua loja</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Defina horário, PIX e tempo de entrega para a IA atender corretamente.
                </p>
              </div>
              <div className="flex justify-center mt-4">
                {progress.store_info_completed ? (
                  <div className="flex items-center text-emerald-500 font-medium text-sm">
                    <CheckCircle2 className="mr-2 size-5" /> Etapa concluída
                  </div>
                ) : (
                  <Button className="w-full" onClick={() => goToTab("settings", "info")}>
                    Configurar Informações
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 text-center animate-in slide-in-from-right-4">
              <MessageCircle className="size-10 mx-auto text-emerald-500" />
              <div>
                <h3 className="font-semibold text-lg">Conecte seu WhatsApp</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Conecte o número que receberá os pedidos de forma automática.
                </p>
              </div>
              <div className="flex justify-center mt-4">
                {progress.whatsapp_completed ? (
                  <div className="flex items-center text-emerald-500 font-medium text-sm">
                    <CheckCircle2 className="mr-2 size-5" /> WhatsApp conectado!
                  </div>
                ) : (
                  <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-600"
                    onClick={() => goToTab("settings", "whatsapp")}
                  >
                    Conectar WhatsApp
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center px-2">
          <Button variant="ghost" className="text-muted-foreground" onClick={handleSkip}>
            Pular por agora
          </Button>
          {step === 1 && progress.store_info_completed && (
            <Button variant="ghost" onClick={() => setStep(2)} className="ml-auto">
              Próximo <ArrowRight className="ml-2 size-4" />
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
