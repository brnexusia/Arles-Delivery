BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_key text,
  ADD COLUMN IF NOT EXISTS monthly_contact_limit integer,
  ADD COLUMN IF NOT EXISTS monthly_contacts_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS usage_period_end timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS companies_stripe_customer_unique
  ON public.companies(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS companies_stripe_subscription_unique
  ON public.companies(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no browser policy is intentionally created.
NOTIFY pgrst, 'reload schema';
COMMIT;
