BEGIN;

-- Products use companies.id (UUID) as the tenant key.
DO $$
DECLARE current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='delivery_products' AND column_name='company_id';

  IF current_type IS NULL THEN
    ALTER TABLE public.delivery_products ADD COLUMN company_id uuid;
  ELSIF current_type<>'uuid' THEN
    ALTER TABLE public.delivery_products ADD COLUMN IF NOT EXISTS company_uuid uuid;
    EXECUTE 'UPDATE public.delivery_products p SET company_uuid=c.id FROM public.companies c WHERE p.company_uuid IS NULL AND (p.company_id=c.name OR p.company_id=c.id::text)';

    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_products' AND column_name='company') THEN
      EXECUTE 'UPDATE public.delivery_products p SET company_uuid=c.id FROM public.companies c WHERE p.company_uuid IS NULL AND (p.company=c.name OR p.company=c.id::text)';
    END IF;

    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_products' AND column_name='legacy_company_id') THEN
      EXECUTE 'UPDATE public.delivery_products SET legacy_company_id=COALESCE(legacy_company_id,company_id::text)';
      ALTER TABLE public.delivery_products DROP COLUMN company_id;
    ELSE
      ALTER TABLE public.delivery_products RENAME COLUMN company_id TO legacy_company_id;
    END IF;
    ALTER TABLE public.delivery_products RENAME COLUMN company_uuid TO company_id;
  END IF;

  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_products' AND column_name='company') THEN
    EXECUTE 'UPDATE public.delivery_products p SET company_id=c.id FROM public.companies c WHERE p.company_id IS NULL AND (p.company=c.name OR p.company=c.id::text)';
    ALTER TABLE public.delivery_products ALTER COLUMN company DROP NOT NULL;
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_products' AND column_name='legacy_company_id') THEN
    ALTER TABLE public.delivery_products ALTER COLUMN legacy_company_id DROP NOT NULL;
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_products' AND column_name='company_id_old') THEN
    ALTER TABLE public.delivery_products ALTER COLUMN company_id_old DROP NOT NULL;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='delivery_products_company_id_fkey') THEN
    ALTER TABLE public.delivery_products
      ADD CONSTRAINT delivery_products_company_id_fkey
      FOREIGN KEY(company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS delivery_products_company_id_idx
  ON public.delivery_products(company_id,category);

ALTER TABLE public.delivery_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total a delivery_products" ON public.delivery_products;
DROP POLICY IF EXISTS "owner_delivery_products" ON public.delivery_products;
CREATE POLICY "owner_delivery_products" ON public.delivery_products FOR ALL
USING (EXISTS(SELECT 1 FROM public.companies c WHERE c.id=delivery_products.company_id AND c.owner_id=auth.uid()))
WITH CHECK (EXISTS(SELECT 1 FROM public.companies c WHERE c.id=delivery_products.company_id AND c.owner_id=auth.uid()));

-- Product variations inherit access from their product/company.
CREATE TABLE IF NOT EXISTS public.product_variations(
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_variations_product_idx ON public.product_variations(product_id);
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total a product_variations" ON public.product_variations;
DROP POLICY IF EXISTS "owner_product_variations" ON public.product_variations;
CREATE POLICY "owner_product_variations" ON public.product_variations FOR ALL
USING(EXISTS(
  SELECT 1 FROM public.delivery_products p
  JOIN public.companies c ON c.id=p.company_id
  WHERE p.id=product_variations.product_id AND c.owner_id=auth.uid()
))
WITH CHECK(EXISTS(
  SELECT 1 FROM public.delivery_products p
  JOIN public.companies c ON c.id=p.company_id
  WHERE p.id=product_variations.product_id AND c.owner_id=auth.uid()
));

-- Visual menu assets use UUID company IDs and generation metadata.
DO $$
DECLARE current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='menu_assets' AND column_name='company_id';

  IF current_type IS NULL THEN
    ALTER TABLE public.menu_assets ADD COLUMN company_id uuid;
  ELSIF current_type<>'uuid' THEN
    ALTER TABLE public.menu_assets ADD COLUMN IF NOT EXISTS company_uuid uuid;
    EXECUTE 'UPDATE public.menu_assets m SET company_uuid=c.id FROM public.companies c WHERE m.company_uuid IS NULL AND (m.company_id=c.name OR m.company_id=c.id::text)';

    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='menu_assets' AND column_name='legacy_company_id') THEN
      EXECUTE 'UPDATE public.menu_assets SET legacy_company_id=COALESCE(legacy_company_id,company_id::text)';
      ALTER TABLE public.menu_assets DROP COLUMN company_id;
    ELSE
      ALTER TABLE public.menu_assets RENAME COLUMN company_id TO legacy_company_id;
    END IF;
    ALTER TABLE public.menu_assets RENAME COLUMN company_uuid TO company_id;
  END IF;
END $$;

ALTER TABLE public.menu_assets
  ADD COLUMN IF NOT EXISTS generation_id uuid,
  ADD COLUMN IF NOT EXISTS storage_path text;

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='menu_assets' AND column_name='legacy_company_id') THEN
    ALTER TABLE public.menu_assets ALTER COLUMN legacy_company_id DROP NOT NULL;
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='menu_assets' AND column_name='company_id_old') THEN
    ALTER TABLE public.menu_assets ALTER COLUMN company_id_old DROP NOT NULL;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='menu_assets_company_id_fkey') THEN
    ALTER TABLE public.menu_assets
      ADD CONSTRAINT menu_assets_company_id_fkey
      FOREIGN KEY(company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS menu_assets_company_idx;
CREATE INDEX IF NOT EXISTS menu_assets_company_idx ON public.menu_assets(company_id,is_active,page_number);
CREATE INDEX IF NOT EXISTS menu_assets_generation_idx ON public.menu_assets(company_id,generation_id);

ALTER TABLE public.menu_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total a menu_assets" ON public.menu_assets;
DROP POLICY IF EXISTS "owner_menu_assets" ON public.menu_assets;
CREATE POLICY "owner_menu_assets" ON public.menu_assets FOR ALL
USING(EXISTS(SELECT 1 FROM public.companies c WHERE c.id=menu_assets.company_id AND c.owner_id=auth.uid()))
WITH CHECK(EXISTS(SELECT 1 FROM public.companies c WHERE c.id=menu_assets.company_id AND c.owner_id=auth.uid()));

-- Atomic database replacement for a complete visual-menu generation.
CREATE OR REPLACE FUNCTION public.replace_menu_assets(
  p_company_id uuid,
  p_generation_id uuid,
  p_assets jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  DELETE FROM public.menu_assets WHERE company_id=p_company_id;

  INSERT INTO public.menu_assets(
    company_id,page_number,image_url,type,category,is_active,generation_id,storage_path,created_at,updated_at
  )
  SELECT
    p_company_id,
    (a->>'page_number')::int,
    a->>'image_url',
    COALESCE(a->>'type','menu_page'),
    NULLIF(a->>'category',''),
    true,
    p_generation_id,
    a->>'storage_path',
    now(),now()
  FROM jsonb_array_elements(p_assets) a;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_menu_assets(uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_menu_assets(uuid,uuid,jsonb) TO service_role;

-- Atomic import of reviewed products + variations.
CREATE OR REPLACE FUNCTION public.import_delivery_menu(
  p_company_id uuid,
  p_categories jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  cat jsonb;
  prod jsonb;
  variation jsonb;
  product_id uuid;
  imported_count integer:=0;
  price_value numeric;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id) THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  FOR cat IN SELECT value FROM jsonb_array_elements(COALESCE(p_categories,'[]'::jsonb)) LOOP
    IF COALESCE(trim(cat->>'name'),'')='' THEN CONTINUE; END IF;

    FOR prod IN SELECT value FROM jsonb_array_elements(COALESCE(cat->'products','[]'::jsonb)) LOOP
      IF COALESCE((prod->>'ignore')::boolean,false) THEN CONTINUE; END IF;
      IF COALESCE(trim(prod->>'name'),'')='' THEN CONTINUE; END IF;

      price_value:=NULL;
      IF NULLIF(trim(COALESCE(prod->>'price','')),'') IS NOT NULL THEN
        BEGIN
          price_value:=replace(regexp_replace(prod->>'price','[^0-9,.-]','','g'),',','.')::numeric;
        EXCEPTION WHEN others THEN
          price_value:=NULL;
        END;
      END IF;

      INSERT INTO public.delivery_products(company_id,category,name,description,price,is_active)
      VALUES(
        p_company_id,
        trim(cat->>'name'),
        trim(prod->>'name'),
        trim(COALESCE(prod->>'description','')),
        price_value,
        COALESCE((prod->>'available')::boolean,true)
      ) RETURNING id INTO product_id;

      imported_count:=imported_count+1;

      FOR variation IN SELECT value FROM jsonb_array_elements(COALESCE(prod->'variations','[]'::jsonb)) LOOP
        IF COALESCE(trim(variation->>'name'),'')<>'' AND NULLIF(trim(COALESCE(variation->>'price','')),'') IS NOT NULL THEN
          BEGIN
            INSERT INTO public.product_variations(product_id,name,price)
            VALUES(product_id,trim(variation->>'name'),replace(regexp_replace(variation->>'price','[^0-9,.-]','','g'),',','.')::numeric);
          EXCEPTION WHEN invalid_text_representation THEN
            NULL;
          END;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN imported_count;
END;
$$;

REVOKE ALL ON FUNCTION public.import_delivery_menu(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_delivery_menu(uuid,jsonb) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
