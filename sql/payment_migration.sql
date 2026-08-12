-- ============================================================
-- ARLES DELIVERY — Payment Controls
-- ============================================================

ALTER TABLE public.delivery_orders
    ADD COLUMN IF NOT EXISTS payment_method text, -- 'pix', 'cash', 'card'
    ADD COLUMN IF NOT EXISTS payment_status text, -- 'pending', 'pending_approval', 'approved', 'pay_on_delivery'
    ADD COLUMN IF NOT EXISTS payment_proof_url text,
    ADD COLUMN IF NOT EXISTS payment_approved_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS change_for numeric(10, 2);
