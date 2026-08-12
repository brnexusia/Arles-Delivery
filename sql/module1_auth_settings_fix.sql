BEGIN;

-- Auth owns users; companies only links the authenticated owner to a tenant.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS companies_owner_id_unique
  ON public.companies(owner_id) WHERE owner_id IS NOT NULL;

-- Legacy auth columns may remain temporarily, but they are no longer required by the app.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='username') THEN
    ALTER TABLE public.companies ALTER COLUMN username DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='password') THEN
    ALTER TABLE public.companies ALTER COLUMN password DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- General settings keyed by company UUID.
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company text,
  company_id uuid,
  display_name text,
  phone text,
  email text,
  address text,
  city text,
  website text,
  open_days text,
  open_time text,
  close_time text,
  notifications_sound boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS notifications_sound boolean DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='company_settings_company_id_fkey') THEN
    ALTER TABLE public.company_settings
      ADD CONSTRAINT company_settings_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='company_settings' AND column_name='company') THEN
    EXECUTE 'UPDATE public.company_settings s SET company_id=c.id FROM public.companies c WHERE s.company_id IS NULL AND s.company=c.name';
    ALTER TABLE public.company_settings ALTER COLUMN company DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS company_settings_company_id_unique
  ON public.company_settings(company_id) WHERE company_id IS NOT NULL;

-- Store/AI knowledge keyed by company UUID.
CREATE TABLE IF NOT EXISTS public.delivery_store_info (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company text,
  company_id uuid,
  store_name text,
  short_description text,
  avg_time text,
  min_order numeric(10,2),
  opening_hours text,
  delivery_fee text,
  neighborhoods text,
  payment_methods text,
  pix_key text,
  ai_rules text,
  ai_enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.delivery_store_info
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='delivery_store_info_company_id_fkey') THEN
    ALTER TABLE public.delivery_store_info
      ADD CONSTRAINT delivery_store_info_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_store_info' AND column_name='company') THEN
    EXECUTE 'UPDATE public.delivery_store_info s SET company_id=c.id FROM public.companies c WHERE s.company_id IS NULL AND s.company=c.name';
    ALTER TABLE public.delivery_store_info ALTER COLUMN company DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS delivery_store_info_company_id_unique
  ON public.delivery_store_info(company_id) WHERE company_id IS NOT NULL;

-- Strict owner-based RLS for the tables used in this module.
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_store_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total a companies" ON public.companies;
DROP POLICY IF EXISTS "Usuarios veem sua propria empresa ou sem dono" ON public.companies;
DROP POLICY IF EXISTS "Usuarios inserem sua propria empresa" ON public.companies;
DROP POLICY IF EXISTS "Usuarios atualizam sua propria empresa" ON public.companies;
DROP POLICY IF EXISTS "Usuarios deletam sua propria empresa" ON public.companies;

CREATE POLICY "owner_select_company" ON public.companies FOR SELECT USING (owner_id=auth.uid());
CREATE POLICY "owner_update_company" ON public.companies FOR UPDATE USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE POLICY "owner_delete_company" ON public.companies FOR DELETE USING (owner_id=auth.uid());

DROP POLICY IF EXISTS "Acesso total a configurações" ON public.company_settings;
DROP POLICY IF EXISTS "Dono acessa company_settings" ON public.company_settings;
CREATE POLICY "owner_company_settings" ON public.company_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id=company_settings.company_id AND c.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id=company_settings.company_id AND c.owner_id=auth.uid()));

DROP POLICY IF EXISTS "Acesso total a delivery_store_info" ON public.delivery_store_info;
DROP POLICY IF EXISTS "Dono acessa delivery_store_info" ON public.delivery_store_info;
CREATE POLICY "owner_delivery_store_info" ON public.delivery_store_info FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id=delivery_store_info.company_id AND c.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id=delivery_store_info.company_id AND c.owner_id=auth.uid()));

NOTIFY pgrst, 'reload schema';
COMMIT;
