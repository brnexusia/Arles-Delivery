import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Session = {
  id?: string;
  username: string;
  name: string;
  company: string;
  companyId: string;
  role?: "admin" | "user";
  verticals: string[];
  capabilities: string[];
  has_calendar?: boolean;
  has_services?: boolean;
  has_custom_metrics?: boolean;
};

type SignUpInput = {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  password: string;
};

type AuthValue = {
  user: Session | null;
  ready: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; role?: "admin" | "user" }>;
  signUp: (
    input: SignUpInput,
  ) => Promise<{ ok: boolean; error?: string; role?: "admin" | "user" }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<Session | null>;
};

const AuthContext = createContext<AuthValue | null>(null);

const CLIENT_SESSION_COOKIE = "arles_session_client";

function persistClientSession(token: string) {
  if (typeof document === "undefined" || !token) return;

  const maxAge = 30 * 24 * 60 * 60;
  document.cookie = [
    `${CLIENT_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

function clearClientSession() {
  if (typeof document === "undefined") return;

  document.cookie = [
    `${CLIENT_SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

function normalizeUser(raw: any): Session | null {
  if (!raw) return null;
  return {
    id: raw.id,
    username: raw.email || raw.username || "",
    name: raw.name || "Gestor",
    company: raw.company || "Arles",
    companyId: raw.companyId || raw.company_id || "",
    role: raw.role === "admin" ? "admin" : "user",
    verticals: Array.isArray(raw.verticals) ? raw.verticals.map(String) : [],
    capabilities: Array.isArray(raw.capabilities)
      ? raw.capabilities.map(String)
      : [],
    has_calendar: raw.has_calendar === true,
    has_services: raw.has_services === true,
    has_custom_metrics: raw.has_custom_metrics === true,
  };
}

async function readJson(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  // Impede uma auth-session antiga (iniciada antes de login/cadastro)
  // de sobrescrever uma autenticação que acabou de funcionar.
  const authEpoch = useRef(0);

  const refreshUser = useCallback(async () => {
    const epochAtStart = authEpoch.current;
    try {
      const response = await fetch("/.netlify/functions/auth-session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        if (epochAtStart === authEpoch.current) setUser(null);
        return null;
      }

      const data = await readJson(response);
      const next = normalizeUser(data.user);
      if (epochAtStart === authEpoch.current) setUser(next);
      return next;
    } catch {
      if (epochAtStart === authEpoch.current) setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const next = await refreshUser();
      if (!cancelled && next) setUser(next);
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,

      signIn: async (email, password) => {
        const mutationEpoch = ++authEpoch.current;
        try {
          const response = await fetch("/.netlify/functions/auth-login", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email.trim().toLowerCase(),
              password,
            }),
          });

          const data = await readJson(response);
          if (!response.ok) {
            return {
              ok: false,
              error: data.error || "E-mail ou senha inválidos.",
            };
          }

          const next = normalizeUser(data.user);
          if (!next || !data.session_token) {
            return { ok: false, error: "Sessão inválida." };
          }

          // Persistência redundante: o servidor tenta HttpOnly e o browser
          // mantém um cookie de fallback no mesmo domínio.
          persistClientSession(String(data.session_token));

          if (mutationEpoch === authEpoch.current) setUser(next);
          return { ok: true, role: next.role };
        } catch {
          return { ok: false, error: "Não foi possível entrar agora." };
        }
      },

      signUp: async (input) => {
        const mutationEpoch = ++authEpoch.current;
        try {
          const response = await fetch("/.netlify/functions/auth-register", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: input.name,
              company_name: input.companyName,
              email: input.email.trim().toLowerCase(),
              phone: input.phone,
              password: input.password,
            }),
          });

          const data = await readJson(response);
          if (!response.ok) {
            const code = data.code || data.error;
            const message =
              code === "EMAIL_ALREADY_REGISTERED"
                ? "Já existe uma conta com este e-mail. Faça login para continuar."
                : code === "TRIAL_ALREADY_USED"
                  ? "Este e-mail ou telefone já utilizou o período gratuito."
                  : data.error || "Erro ao criar sua conta.";
            return { ok: false, error: message };
          }

          const next = normalizeUser(data.user);
          if (!next || !data.session_token) {
            return { ok: false, error: "Conta criada, mas a sessão falhou." };
          }

          persistClientSession(String(data.session_token));

          if (mutationEpoch === authEpoch.current) setUser(next);
          return { ok: true, role: next.role };
        } catch {
          return { ok: false, error: "Não foi possível criar sua conta agora." };
        }
      },

      signOut: async () => {
        ++authEpoch.current;
        await fetch("/.netlify/functions/auth-logout", {
          method: "POST",
          credentials: "same-origin",
        }).catch(() => undefined);

        clearClientSession();
        sessionStorage.clear();
        setUser(null);
        window.location.href = "/login";
      },

      refreshUser,
    }),
    [user, ready, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useSessionGuard() {
  const { user, signOut, refreshUser } = useAuth();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const validate = async () => {
      if (cancelled) return;
      const next = await refreshUser();
      if (!cancelled && !next) await signOut();
    };

    const interval = setInterval(() => void validate(), 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, signOut, refreshUser]);
}
