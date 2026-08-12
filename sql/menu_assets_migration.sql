-- ============================================================
-- ARLES DELIVERY — Menu Assets (cardápio visual)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.menu_assets (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id  text NOT NULL,
    page_number integer NOT NULL,
    image_url   text NOT NULL,
    type        text NOT NULL DEFAULT 'menu_page',
    category    text,          -- categoria dessa página (para filtrar por tema)
    is_active   boolean DEFAULT true,
    created_at  timestamp with time zone DEFAULT now(),
    updated_at  timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menu_assets_company_idx ON public.menu_assets (company_id, is_active);

ALTER TABLE public.menu_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total a menu_assets" ON public.menu_assets;
CREATE POLICY "Acesso total a menu_assets" ON public.menu_assets FOR ALL USING (true) WITH CHECK (true);

-- Bucket de storage (criar manualmente no painel Supabase se precisar)
-- Nome: menu-assets  |  Público: sim
