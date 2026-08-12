-- ============================================================
-- ARLES DELIVERY — Módulo de Clientes
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CUSTOMERS (Clientes)
--    Criados automaticamente no primeiro pedido.
--    Chave única: company_id + phone_number
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id      text NOT NULL,          -- mesmo valor de 'company' em delivery_orders
    name            text NOT NULL,
    phone_number    text NOT NULL,
    notes           text,                   -- Observações livres ("prefere sem cebola", etc.)
    first_order_at  timestamp with time zone,
    last_order_at   timestamp with time zone,
    orders_count    integer DEFAULT 0,
    total_spent     numeric(10, 2) DEFAULT 0,
    created_at      timestamp with time zone DEFAULT now(),
    updated_at      timestamp with time zone DEFAULT now(),
    UNIQUE (company_id, phone_number)       -- mesmo número pode existir em empresas diferentes
);

CREATE INDEX IF NOT EXISTS customers_company_idx ON public.customers (company_id);
CREATE INDEX IF NOT EXISTS customers_phone_idx   ON public.customers (phone_number);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total a customers" ON public.customers;
CREATE POLICY "Acesso total a customers"
ON public.customers
FOR ALL
USING (true)
WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 2. Adicionar customer_id em delivery_orders (se ainda não existir)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_orders
    ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

CREATE INDEX IF NOT EXISTS delivery_orders_customer_idx ON public.delivery_orders (customer_id);


-- ─────────────────────────────────────────────────────────────
-- 3. Função + Trigger: upsert automático do cliente a cada pedido
--    • Cria o cliente se não existir (company + phone)
--    • Atualiza name (caso mude), last_order_at, orders_count, total_spent
--    • Vincula customer_id ao pedido
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_customer_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_customer_id uuid;
BEGIN
    -- Só processa se houver telefone
    IF NEW.client_phone IS NULL OR trim(NEW.client_phone) = '' THEN
        RETURN NEW;
    END IF;

    -- Upsert do cliente por (company_id, phone_number)
    INSERT INTO public.customers (
        company_id,
        name,
        phone_number,
        first_order_at,
        last_order_at,
        orders_count,
        total_spent
    )
    VALUES (
        NEW.company,
        NEW.client_name,
        trim(NEW.client_phone),
        NEW.created_at,
        NEW.created_at,
        1,
        COALESCE(NEW.total_value, 0)
    )
    ON CONFLICT (company_id, phone_number) DO UPDATE
        SET name          = EXCLUDED.name,           -- atualiza nome sem criar duplicata
            last_order_at = GREATEST(customers.last_order_at, EXCLUDED.last_order_at),
            orders_count  = customers.orders_count + 1,
            total_spent   = customers.total_spent + EXCLUDED.total_spent,
            updated_at    = now()
    RETURNING id INTO v_customer_id;

    -- Vincula o pedido ao cliente
    NEW.customer_id = v_customer_id;

    RETURN NEW;
END;
$$;


-- Remove trigger antigo se existir (idempotente)
DROP TRIGGER IF EXISTS trg_upsert_customer ON public.delivery_orders;

CREATE TRIGGER trg_upsert_customer
BEFORE INSERT ON public.delivery_orders
FOR EACH ROW
EXECUTE FUNCTION public.upsert_customer_on_order();
