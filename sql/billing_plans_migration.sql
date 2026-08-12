-- Stripe 3-plan billing fields
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS plan_key text DEFAULT 'essential' CHECK (plan_key IN ('essential', 'professional', 'scale')),
ADD COLUMN IF NOT EXISTS monthly_contact_limit integer DEFAULT 400,
ADD COLUMN IF NOT EXISTS monthly_contacts_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_period_start timestamptz,
ADD COLUMN IF NOT EXISTS usage_period_end timestamptz;

-- Monthly contact usage tracking (for unique contact counting per cycle)
CREATE TABLE IF NOT EXISTS public.monthly_contact_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  phone_number text NOT NULL,
  billing_period text NOT NULL, -- format: '2026-08' (YYYY-MM of usage_period_start)
  first_contact_at timestamptz DEFAULT now(),
  UNIQUE (company_id, phone_number, billing_period)
);

CREATE INDEX IF NOT EXISTS idx_mcu_company_period ON public.monthly_contact_usage (company_id, billing_period);

ALTER TABLE public.monthly_contact_usage ENABLE ROW LEVEL SECURITY;
