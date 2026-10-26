import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { DeliveryApp } from "@/components/delivery/DeliveryApp";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arles Delivery" },
      { name: "description", content: "Gestão de delivery diretamente pelo WhatsApp." },
    ],
  }),
  component: DeliveryOnlyHome,
});

function DeliveryOnlyHome() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) void router.navigate({ to: "/login", replace: true });
  }, [ready, user, router]);

  if (!ready || !user) {
    return <main className="grid min-h-screen place-items-center bg-background">
      <p className="text-sm text-muted-foreground">Carregando Arles Delivery…</p>
    </main>;
  }

  if (!user.verticals.includes("delivery") &&
      !user.capabilities.includes("delivery.orders")) {
    return <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-lg space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Arles Delivery</h1>
        <p className="text-muted-foreground">
          A versão atual opera exclusivamente com Delivery.
          Outras verticais estão desativadas, sem exclusão de dados.
        </p>
      </div>
    </main>;
  }

  return <DeliveryApp />;
}
