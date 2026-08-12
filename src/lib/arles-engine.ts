export type EngineRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function engineRequest<T = any>(
  path: string,
  options: EngineRequestOptions = {},
): Promise<T> {
  const method = options.method || "GET";

  const response = await fetch(
    `/.netlify/functions/engine-proxy?path=${encodeURIComponent(path)}`,
    {
      method,
      credentials: "same-origin",
      headers:
        options.body !== undefined
          ? { "Content-Type": "application/json" }
          : undefined,
      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    },
  );

  const text = await response.text().catch(() => "");
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (response.status === 401) {
    const expired =
      data?.error === "SESSION_EXPIRED" ||
      data?.code === "SESSION_EXPIRED";

    // Só manda para /login quando o próprio proxy confirmou que a sessão
    // expirou. Um 401 operacional isolado não deve expulsar o usuário.
    if (
      expired &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      window.location.replace("/login");
    }

    throw new Error(
      expired
        ? "Sessão expirada. Faça login novamente."
        : data?.error || "Não autorizado para esta operação.",
    );
  }

  if (!response.ok) {
    throw new Error(data?.error || `Arles Engine respondeu ${response.status}`);
  }

  return data as T;
}

export async function engineData<T = any>(path: string): Promise<T> {
  const result = await engineRequest<{ data: T }>(path);
  return result.data;
}
