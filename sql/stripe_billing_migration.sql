-- Migrate billing fields for Stripe integration
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS stripe_price_id text,
ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz,
ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;

-- Add index on stripe_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer_id ON public.companies(stripe_customer_id);

-- Idempotency table for stripe webhooks
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS (though only accessed by service role backend usually)
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
