-- ============================================================
-- ARLES DELIVERY — Controle de Trial (Anti-abuso)
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TRIAL_ENTITLEMENTS
--    Histórico permanente de trials concedidos.
--    Persiste mesmo que a empresa seja apagada.
--    O campo company_id é referência livre (text), não FK,
--    para garantir que o registro sobreviva à exclusão da empresa.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trial_entitlements (
    id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id       text,                               -- id da empresa (sem FK — sobrevive à exclusão)
    email_normalized text,                               -- email em lowercase
    phone_normalized text,                               -- somente dígitos, ex: "11999999999"
    trial_started_at timestamp with time zone,
    trial_ends_at    timestamp with time zone,
    created_at       timestamp with time zone DEFAULT now()
);

-- Índices para buscas rápidas pelos campos de verificação
CREATE INDEX IF NOT EXISTS trial_entitlements_phone_idx ON public.trial_entitlements (phone_normalized);
CREATE INDEX IF NOT EXISTS trial_entitlements_email_idx ON public.trial_entitlements (email_normalized);
CREATE INDEX IF NOT EXISTS trial_entitlements_company_idx ON public.trial_entitlements (company_id);

-- RLS: acesso total via service role key (a função backend usa service role)
ALTER TABLE public.trial_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total a trial_entitlements" ON public.trial_entitlements;
CREATE POLICY "Acesso total a trial_entitlements"
ON public.trial_entitlements
FOR ALL
USING (true)
WITH CHECK (true);
