// Shared Arles Platform billing status banner.
import { AlertTriangle, Clock, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { SubscriptionInfo } from "@/lib/subscription";

interface TrialBannerProps {
  subscription: SubscriptionInfo;
}

export function TrialBanner({ subscription }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Nothing to show for active subscriptions
  if (subscription.status === "active") return null;

  // Expired trial — full blocking screen
  if (
    subscription.isExpired ||
    subscription.status === "canceled" ||
    subscription.status === "past_due"
  ) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Seu período grátis terminou.</h2>
            <p className="text-muted-foreground mt-2">
              Assine a Arles Platform para continuar usando suas automações.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full text-base font-semibold"
            onClick={() => {
              window.location.href = "/?tab=billing";
            }}
          >
            Assinar agora <ExternalLink className="ml-2 size-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Você ainda pode acessar o painel, cardápio e configurações.
          </p>
        </div>
      </div>
    );
  }

  // Dismissable banner for active trials
  if (subscription.status === "trial" && !dismissed) {
    const isExpiring = subscription.isTrialExpiring;

    return (
      <div
        className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium ${
          isExpiring
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-b border-amber-500/20"
            : "bg-primary/10 text-primary border-b border-primary/20"
        }`}
      >
        <div className="flex items-center gap-2">
          <Clock className="size-4 shrink-0" />
          {isExpiring ? (
            <span>
              Seu teste grátis termina em breve. <strong>Assine agora</strong> para não perder o
              atendimento.
            </span>
          ) : (
            <span>
              Você está no período grátis.{" "}
              <strong>
                Restam {subscription.daysRemaining}{" "}
                {subscription.daysRemaining === 1 ? "dia" : "dias"}.
              </strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              window.location.href = "/?tab=billing";
            }}
          >
            Assinar
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Fechar aviso"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
