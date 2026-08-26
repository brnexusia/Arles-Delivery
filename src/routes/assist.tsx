import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { AssistApp } from "@/components/assist/AssistApp";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/assist")({
  head: () => ({
    meta: [
      { title: "Arles Assist | Assistência técnica com IA" },
      { name: "description", content: "Orçamentos, ordens de serviço e atendimento inteligente para assistências técnicas." },
    ],
  }),
  component: AssistPage,
});

function AssistPage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.navigate({ to: "/login", replace: true });
  }, [ready, user, router]);

  if (!ready || !user) {
    return <main className="grid min-h-screen place-items-center bg-background"><p className="text-sm text-muted-foreground">Carregando…</p></main>;
  }

  const hasAssist = user.verticals.includes("assist") || user.capabilities.includes("assist.orders");
  if (!hasAssist && user.role !== "admin") {
    return <main className="grid min-h-screen place-items-center bg-background p-6"><div className="max-w-md rounded-2xl border bg-card p-6 text-center"><h1 className="text-lg font-semibold">Arles Assist não habilitado</h1><p className="mt-2 text-sm text-muted-foreground">Esta empresa ainda não possui o vertical Assist liberado.</p></div></main>;
  }

  return <AssistApp />;
}
