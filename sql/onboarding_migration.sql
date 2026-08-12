-- ============================================================
-- ARLES DELIVERY — Onboarding State
-- ============================================================

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS store_info_completed boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS menu_completed boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS whatsapp_completed boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
