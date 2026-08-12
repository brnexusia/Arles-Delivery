-- ============================================================
-- ARLES DELIVERY — Atualizações Finais do MVP (IA, Chat, Pedidos)
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. VARIAÇÕES DE PRODUTOS
--    Permite ter "Pequena", "Média", "Grande" vinculadas a um produto.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_variations (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id    uuid NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
    name          text NOT NULL,
    price         numeric(10, 2) NOT NULL,
    created_at    timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_variations_product_idx ON public.product_variations (product_id);

ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total a product_variations" ON public.product_variations;
CREATE POLICY "Acesso total a product_variations" ON public.product_variations FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 2. HISTÓRICO DE CONVERSAS (Conversations)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id    text NOT NULL,
    customer_id   uuid REFERENCES public.customers(id),
    phone_number  text NOT NULL,
    ai_enabled    boolean DEFAULT true,
    created_at    timestamp with time zone DEFAULT now(),
    updated_at    timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_company_idx ON public.conversations (company_id);
CREATE INDEX IF NOT EXISTS conversations_phone_idx ON public.conversations (phone_number);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total a conversations" ON public.conversations;
CREATE POLICY "Acesso total a conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 3. HISTÓRICO DE MENSAGENS (Messages)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    company_id      text NOT NULL,
    direction       text NOT NULL, -- 'inbound' ou 'outbound'
    sender_type     text NOT NULL, -- 'customer', 'ai', ou 'human'
    content         text NOT NULL,
    message_id      text,
    created_at      timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS messages_company_idx ON public.messages (company_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total a messages" ON public.messages;
CREATE POLICY "Acesso total a messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 4. CONTROLE GLOBAL DE IA NA LOJA
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_store_info
    ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT true;

-- ─────────────────────────────────────────────────────────────
-- 5. EVENTO DE PEDIDO ENTREGUE
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_orders
    ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;
