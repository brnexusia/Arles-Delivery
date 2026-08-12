BEGIN;

-- ARLES DELIVERY — Módulo 6: operação, pós-venda, avaliações e dados do cliente.

-- Instagram da empresa, usado somente na mensagem de avaliação positiva.
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS instagram text;

-- Campos usados pelo agente/painel. Todos idempotentes.
ALTER TABLE public.delivery_orders
  ADD COLUMN IF NOT EXISTS delivery_type text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS change_for numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Última avaliação também fica disponível no cadastro do cliente.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS default_address text,
  ADD COLUMN IF NOT EXISTS favorite_payment text,
  ADD COLUMN IF NOT EXISTS last_rating integer,
  ADD COLUMN IF NOT EXISTS last_review_at timestamptz;


-- Upsert do cliente: guarda nome real, último endereço e forma de pagamento.
CREATE OR REPLACE FUNCTION public.upsert_customer_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_customer_id uuid;
BEGIN
  IF NEW.company_id IS NULL OR NEW.client_phone IS NULL OR trim(NEW.client_phone)='' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.customers(
    company_id,name,phone_number,default_address,favorite_payment,
    first_order_at,last_order_at,orders_count,total_spent,created_at,updated_at
  ) VALUES(
    NEW.company_id,
    COALESCE(NULLIF(trim(NEW.client_name),''),'Cliente'),
    trim(NEW.client_phone),
    NULLIF(trim(COALESCE(NEW.delivery_address,'')),''),
    NULLIF(trim(COALESCE(NEW.payment_method,'')),''),
    COALESCE(NEW.created_at,now()),
    COALESCE(NEW.created_at,now()),
    1,
    COALESCE(NEW.total_value,0),
    now(),now()
  )
  ON CONFLICT(company_id,phone_number) DO UPDATE SET
    name=CASE
      WHEN EXCLUDED.name IS NOT NULL AND lower(EXCLUDED.name) <> 'cliente' THEN EXCLUDED.name
      ELSE public.customers.name
    END,
    default_address=COALESCE(EXCLUDED.default_address,public.customers.default_address),
    favorite_payment=COALESCE(EXCLUDED.favorite_payment,public.customers.favorite_payment),
    last_order_at=EXCLUDED.last_order_at,
    orders_count=public.customers.orders_count+1,
    total_spent=public.customers.total_spent+EXCLUDED.total_spent,
    updated_at=now()
  RETURNING id INTO v_customer_id;

  NEW.customer_id=v_customer_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_upsert_customer ON public.delivery_orders;
CREATE TRIGGER trg_upsert_customer
BEFORE INSERT ON public.delivery_orders
FOR EACH ROW EXECUTE FUNCTION public.upsert_customer_on_order();

-- Avaliações por pedido.
CREATE TABLE IF NOT EXISTS public.delivery_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  phone_number text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback text,
  source text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_reviews_order_unique
  ON public.delivery_reviews(order_id);

CREATE INDEX IF NOT EXISTS delivery_reviews_company_created_idx
  ON public.delivery_reviews(company_id, created_at DESC);

ALTER TABLE public.delivery_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_delivery_reviews" ON public.delivery_reviews;
CREATE POLICY "owner_delivery_reviews" ON public.delivery_reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id=delivery_reviews.company_id AND c.owner_id=auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id=delivery_reviews.company_id AND c.owner_id=auth.uid()
    )
  );

-- Ao receber avaliação, vincula o customer_id pelo pedido (quando possível)
-- e guarda a última nota no cadastro do cliente.
CREATE OR REPLACE FUNCTION public.sync_customer_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_customer_id uuid;
BEGIN
  IF NEW.customer_id IS NULL THEN
    SELECT o.customer_id INTO v_customer_id
    FROM public.delivery_orders o
    WHERE o.id=NEW.order_id AND o.company_id=NEW.company_id;

    NEW.customer_id=v_customer_id;
  END IF;

  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET last_rating=NEW.rating,
        last_review_at=COALESCE(NEW.created_at,now()),
        updated_at=now()
    WHERE id=NEW.customer_id AND company_id=NEW.company_id;
  ELSE
    UPDATE public.customers
    SET last_rating=NEW.rating,
        last_review_at=COALESCE(NEW.created_at,now()),
        updated_at=now()
    WHERE company_id=NEW.company_id AND phone_number=NEW.phone_number;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_review ON public.delivery_reviews;
CREATE TRIGGER trg_sync_customer_review
BEFORE INSERT ON public.delivery_reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_review();

NOTIFY pgrst,'reload schema';
COMMIT;
