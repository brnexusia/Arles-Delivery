-- ============================================================
-- ARLES DELIVERY — Schema de Dados para o Módulo de Delivery
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PEDIDOS (Orders)
--    Armazena todos os pedidos recebidos (via IA ou manual).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_orders (
    id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company           text NOT NULL,
    client_name       text NOT NULL,
    client_phone      text,
    items             jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array de itens comprados
    observations      text,
    delivery_address  text,
    payment_approved  boolean DEFAULT false,
    total_value       numeric(10, 2) DEFAULT 0,
    status            text DEFAULT 'Novos',               -- 'Novos', 'Em preparo', 'Saiu para entrega', 'Finalizados', 'Cancelados'
    created_at        timestamp with time zone DEFAULT now(),
    updated_at        timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_orders_company_idx ON public.delivery_orders (company);

ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total a delivery_orders" ON public.delivery_orders;
CREATE POLICY "Acesso total a delivery_orders"
ON public.delivery_orders
FOR ALL
USING (true)
WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 2. CARDÁPIO (Produtos do Delivery)
--    Se for diferente da tabela de 'services', usamos essa.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_products (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company       text NOT NULL,
    category      text,                    -- Ex: 'Pizzas Tradicionais', 'Bebidas'
    name          text NOT NULL,
    description   text,
    price         numeric(10, 2) NOT NULL,
    image_url     text,                    -- Caso queira exibir foto no futuro
    is_active     boolean DEFAULT true,
    created_at    timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_products_company_idx ON public.delivery_products (company);

ALTER TABLE public.delivery_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total a delivery_products" ON public.delivery_products;
CREATE POLICY "Acesso total a delivery_products"
ON public.delivery_products
FOR ALL
USING (true)
WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 3. INFORMAÇÕES DA LOJA (Base de Conhecimento da IA)
--    Apenas 1 linha por empresa.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_store_info (
    id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company           text NOT NULL UNIQUE,
    store_name        text,
    short_description text,
    avg_time          text,
    min_order         numeric(10, 2),
    opening_hours     text,
    delivery_fee      text,
    neighborhoods     text,
    payment_methods   text,
    pix_key           text,
    ai_rules          text,                    -- Regras e exceções longas para o prompt
    updated_at        timestamp with time zone DEFAULT now()
);

ALTER TABLE public.delivery_store_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total a delivery_store_info" ON public.delivery_store_info;
CREATE POLICY "Acesso total a delivery_store_info"
ON public.delivery_store_info
FOR ALL
USING (true)
WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 4. WHATSAPP SESSIONS (Status da conexão)
--    Para saber se a loja escaneou o QR Code.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_whatsapp (
    id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company           text NOT NULL UNIQUE,
    status            text DEFAULT 'disconnected', -- 'disconnected', 'connecting', 'connected'
    phone_number      text,
    last_sync         timestamp with time zone,
    updated_at        timestamp with time zone DEFAULT now()
);

ALTER TABLE public.delivery_whatsapp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total a delivery_whatsapp" ON public.delivery_whatsapp;
CREATE POLICY "Acesso total a delivery_whatsapp"
ON public.delivery_whatsapp
FOR ALL
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 5. WHATSAPP CONNECTIONS (Evolution API integration)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
    id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id        text NOT NULL, -- references companies.name or companies.id depending on your model
    provider          text DEFAULT 'evolution',
    instance_name     text NOT NULL,
    instance_id       text,
    phone_number      text,
    status            text DEFAULT 'disconnected', -- 'pending', 'disconnected', 'connecting', 'connected', 'error'
    connected_at      timestamp with time zone,
    created_at        timestamp with time zone DEFAULT now(),
    updated_at        timestamp with time zone DEFAULT now(),
    UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_connections_company_idx ON public.whatsapp_connections (company_id);
CREATE INDEX IF NOT EXISTS whatsapp_connections_instance_name_idx ON public.whatsapp_connections (instance_name);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total a whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Acesso total a whatsapp_connections"
ON public.whatsapp_connections
FOR ALL
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 6. SUBSCRIPTIONS (Planos e Trial na tabela companies)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS trial_started_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS subscription_started_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS subscription_ends_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS payment_provider text,
    ADD COLUMN IF NOT EXISTS payment_customer_id text,
    ADD COLUMN IF NOT EXISTS payment_subscription_id text;
