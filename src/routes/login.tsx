import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar | Arles" },
      {
        name: "description",
        content:
          "Acesse o Arles: métricas de atendimento, recorrência e performance por vendedora.",
      },
      { property: "og:title", content: "Entrar no Arles" },
      {
        property: "og:description",
        content: "Login multi-empresa para acessar métricas operacionais de atendimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, ready, signIn } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (ready && user) {
      if (user.role === "admin") {
        router.navigate({ to: "/adm", replace: true });
      } else {
        router.navigate({ to: "/", replace: true });
      }
    }
  }, [ready, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    // pequena pausa para o spinner ser visível no fluxo de demo
    await new Promise((r) => setTimeout(r, 400));
    const res = await signIn(username, password);
    setIsLoading(false);
    if (!res.ok) setError(res.error ?? "Falha no login.");
    else {
      if (res.role === "admin") {
        router.navigate({ to: "/adm", replace: true });
      } else {
        router.navigate({ to: "/", replace: true });
      }
    }
  };

  return (
    <main className="login-bg relative grid min-h-screen place-items-center px-4 py-10">
      <div className="relative w-full max-w-sm space-y-6">
        <div className="relative flex items-center justify-center py-2">
          <div className="relative flex justify-center mb-6 mt-4">
            {/* Glow behind logo only in dark mode */}
            <div className="absolute inset-x-0 h-12 top-1/2 -translate-y-1/2 dark:bg-primary/20 blur-2xl rounded-full" />
            <img src="/logo.png" alt="Arles" className="relative z-10 h-24 w-auto object-contain" style={{ filter: 'var(--logo-filter)' }} />
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <ThemeToggle />
          </div>
        </div>

        <Card className="gap-0 p-6 shadow-[var(--shadow-card)]">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">E-mail</Label>
              <Input
                id="username"
                value={username}
                autoComplete="email"
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder="voce@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="size-4 mr-2" />
              )}
              {isLoading ? "Entrando…" : "Entrar"}
            </Button>
            
            <div className="pt-2 text-center text-sm">
              <span className="text-muted-foreground">Não possui uma conta? </span>
              <Link to="/register" className="text-primary hover:underline font-medium">
                Criar conta
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
