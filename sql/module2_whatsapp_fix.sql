BEGIN;

-- Use companies.id (UUID) as the only tenant key for WhatsApp connections.
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid,
  provider text DEFAULT 'evolution',
  instance_name text NOT NULL,
  instance_id text,
  phone_number text,
  status text DEFAULT 'disconnected',
  connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='whatsapp_connections' AND column_name='company_id';

  IF current_type IS NOT NULL AND current_type <> 'uuid' THEN
    ALTER TABLE public.whatsapp_connections ADD COLUMN IF NOT EXISTS company_uuid uuid;

    UPDATE public.whatsapp_connections w
    SET company_uuid=c.id
    FROM public.companies c
    WHERE w.company_uuid IS NULL
      AND (w.company_id=c.name OR w.company_id=c.id::text);

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='whatsapp_connections' AND column_name='legacy_company_id'
    ) THEN
      ALTER TABLE public.whatsapp_connections RENAME COLUMN company_id TO legacy_company_id;
    END IF;

    ALTER TABLE public.whatsapp_connections RENAME COLUMN company_uuid TO company_id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='whatsapp_connections_company_id_fkey') THEN
    ALTER TABLE public.whatsapp_connections
      ADD CONSTRAINT whatsapp_connections_company_id_fkey
      FOREIGN KEY(company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- If old migrations produced both name-based and UUID-text rows for the same company, keep one connection record.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY company_id
    ORDER BY
      CASE status WHEN 'connected' THEN 0 WHEN 'connecting' THEN 1 ELSE 2 END,
      updated_at DESC NULLS LAST,
      created_at DESC NULLS LAST
  ) AS rn
  FROM public.whatsapp_connections
  WHERE company_id IS NOT NULL
)
DELETE FROM public.whatsapp_connections w
USING ranked r
WHERE w.id=r.id AND r.rn>1;

DROP INDEX IF EXISTS whatsapp_connections_company_idx;
CREATE INDEX IF NOT EXISTS whatsapp_connections_company_idx ON public.whatsapp_connections(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connections_company_unique ON public.whatsapp_connections(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_connections_instance_name_idx ON public.whatsapp_connections(instance_name);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total a whatsapp_connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Dono acessa whatsapp_connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "owner_whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "owner_whatsapp_connections" ON public.whatsapp_connections FOR ALL
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id=whatsapp_connections.company_id AND c.owner_id=auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id=whatsapp_connections.company_id AND c.owner_id=auth.uid()));

NOTIFY pgrst, 'reload schema';
COMMIT;
