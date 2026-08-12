import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "FALTA CONFIGURAÇÃO DO SUPABASE NO FRONTEND: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios."
  );
  // Não instanciar o client caso falte as variáveis, lançando erro claro em vez de usar url falsa
  throw new Error("VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas no ambiente.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
