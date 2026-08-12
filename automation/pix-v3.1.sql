BEGIN;

ALTER TABLE public.delivery_orders
  ADD COLUMN IF NOT EXISTS payment_proof_url text,
  ADD COLUMN IF NOT EXISTS payment_approved_at timestamptz;

NOTIFY pgrst, 'reload schema';

COMMIT;
