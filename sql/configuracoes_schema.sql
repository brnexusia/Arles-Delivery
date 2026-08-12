-- ============================================================
-- ARLES — Schema de Configurações e Serviços
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. SERVIÇOS
--    Armazena os serviços oferecidos por cada empresa.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company       text NOT NULL,
    name          text NOT NULL,
    price         numeric(10, 2),          -- valor em R$
    duration_min  integer,                 -- duração em minutos
    description   text,
    created_at    timestamp with time zone DEFAULT now()
);

-- Índice para buscas por empresa
CREATE INDEX IF NOT EXISTS services_company_idx ON public.services (company);

-- RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a serviços"
ON public.services
FOR ALL
USING (true)
WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 2. CONFIGURAÇÕES DA EMPRESA
--    Uma linha por empresa — upsert via código.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_settings (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company       text NOT NULL UNIQUE,
    display_name  text,                    -- nome de exibição
    phone         text,                    -- telefone / WhatsApp
    address       text,                    -- endereço
    city          text,                    -- cidade - estado
    website       text,                    -- site ou @instagram
    open_days     text,                    -- ex: "Seg,Ter,Qua,Qui,Sex"
    open_time     text,                    -- ex: "08:00"
    close_time    text,                    -- ex: "18:00"
    updated_at    timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a configurações"
ON public.company_settings
FOR ALL
USING (true)
WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 3. (Opcional) Adicionar has_calendar à tabela companies
--    Só execute se ainda não tiver essa coluna.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS has_calendar boolean DEFAULT false;

-- Módulo de Serviços — controla a sub-aba Serviços nas Configurações
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS has_services boolean DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 4. MÉTRICAS EXTRAS / VARIÁVEIS (Custom Records)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_metrics (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company       text NOT NULL,
    name          text NOT NULL,
    value         numeric(10, 2),
    description   text,
    extra_text    text,
    created_at    timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_metrics_company_idx ON public.custom_metrics (company);

ALTER TABLE public.custom_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a custom_metrics"
ON public.custom_metrics
FOR ALL
USING (true)
WITH CHECK (true);

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS has_custom_metrics boolean DEFAULT false;


