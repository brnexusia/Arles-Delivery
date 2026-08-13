import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2, Store, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Criar Conta | Arles Platform" },
      { name: "description", content: "Crie sua conta na Arles Platform." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name || !form.companyName || !form.email || !form.phone || !form.password) {
      setError("Preencha todos os campos.");
      return;
    }

    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError("Informe um WhatsApp válido com DDD.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (!form.acceptedTerms) {
      setError("Você precisa aceitar os termos de uso.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp({
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
      });

      if (!result.ok) {
        setError(result.error || "Erro ao criar sua conta.");
        return;
      }

      router.navigate({ to: "/", replace: true });
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-bg relative grid min-h-screen place-items-center px-4 py-10">
      <div className="relative w-full max-w-md space-y-6">
        <div className="relative flex flex-col items-center justify-center py-2">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>
          <div className="relative flex justify-center mb-4 mt-4">
            <div className="absolute inset-x-0 h-12 top-1/2 -translate-y-1/2 dark:bg-primary/20 blur-2xl rounded-full" />
            <img
              src="/logo.png"
              alt="Arles"
              className="relative z-10 h-16 w-auto object-contain"
              style={{ filter: "var(--logo-filter)" }}
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Crie sua conta</h1>
          <p className="text-sm text-muted-foreground text-center">
            Comece a configurar seu delivery em poucos minutos.
          </p>
        </div>

        <Card className="p-6 shadow-[var(--shadow-card)]">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setError(null);
                  }}
                  placeholder="João Silva"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Estabelecimento</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(e) => {
                    setForm({ ...form, companyName: e.target.value });
                    setError(null);
                  }}
                  placeholder="Pizzaria Suprema"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setError(null);
                }}
                placeholder="contato@empresa.com.br"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">WhatsApp do responsável</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  setError(null);
                }}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => {
                      setForm({ ...form, password: e.target.value });
                      setError(null);
                    }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) => {
                    setForm({ ...form, confirmPassword: e.target.value });
                    setError(null);
                  }}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="terms"
                checked={form.acceptedTerms}
                onChange={(e) => setForm({ ...form, acceptedTerms: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="terms" className="text-xs font-normal">
                Li e aceito os Termos de Uso e Política de Privacidade
              </Label>
            </div>

            {error && <p className="text-sm text-destructive font-medium">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Store className="size-4 mr-2" />
              )}
              Criar minha conta
            </Button>

            <div className="pt-2 text-center text-sm">
              <span className="text-muted-foreground">Já possui uma conta? </span>
              <Link
                to="/login"
                className="text-primary hover:underline font-medium inline-flex items-center"
              >
                Entrar <ArrowRight className="size-3 ml-1" />
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
