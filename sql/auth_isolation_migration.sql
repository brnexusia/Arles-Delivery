-- ============================================================================
-- MIGRAÇÃO DE SEGURANÇA E ISOLAMENTO MULTI-TENANT (Supabase)
-- Execute este arquivo no SQL Editor do Supabase para aplicar as correções.
-- ============================================================================

-- 1. Adicionar owner_id na tabela companies (se não existir)
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Criar índice para performance em buscas por owner_id
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON public.companies(owner_id);

-- 3. Habilitar RLS em companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 4. Limpar políticas antigas de companies para evitar conflitos
DROP POLICY IF EXISTS "Acesso total a companies" ON public.companies;
DROP POLICY IF EXISTS "Usuarios veem sua propria empresa" ON public.companies;
DROP POLICY IF EXISTS "Usuarios podem atualizar sua propria empresa" ON public.companies;
DROP POLICY IF EXISTS "Usuarios podem inserir sua propria empresa" ON public.companies;
DROP POLICY IF EXISTS "Permitir visualizar empresas sem dono" ON public.companies;
DROP POLICY IF EXISTS "Permitir assumir empresa sem dono" ON public.companies;
DROP POLICY IF EXISTS "Enable all operations for users" ON public.companies;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.companies;
DROP POLICY IF EXISTS "Usuarios veem sua propria empresa ou sem dono" ON public.companies;
DROP POLICY IF EXISTS "Usuarios inserem sua propria empresa" ON public.companies;
DROP POLICY IF EXISTS "Usuarios atualizam sua propria empresa" ON public.companies;
DROP POLICY IF EXISTS "Usuarios deletam sua propria empresa" ON public.companies;

-- 5. Novas Políticas de Segurança para companies
-- A) Leitura: o usuário pode ver a empresa se for dono OU se a empresa ainda não tiver dono (para permitir a migração/claim)
CREATE POLICY "Usuarios veem sua propria empresa ou sem dono"
ON public.companies FOR SELECT
USING (owner_id = auth.uid() OR owner_id IS NULL);

-- B) Inserção: o usuário só pode criar empresa se setar a si mesmo como dono
-- (Permitimos auth.uid() IS NULL caso o Supabase esteja com "Confirm Email" ativado e a sessão demore a existir)
CREATE POLICY "Usuarios inserem sua propria empresa"
ON public.companies FOR INSERT
WITH CHECK (owner_id = auth.uid() OR auth.uid() IS NULL);

-- C) Atualização: o usuário pode atualizar se for o dono, OU se a empresa não tiver dono e ele estiver assumindo-a
CREATE POLICY "Usuarios atualizam sua propria empresa"
ON public.companies FOR UPDATE
USING (owner_id = auth.uid() OR owner_id IS NULL)
WITH CHECK (owner_id = auth.uid());

-- D) Exclusão: apenas o dono pode deletar
CREATE POLICY "Usuarios deletam sua propria empresa"
ON public.companies FOR DELETE
USING (owner_id = auth.uid());


-- 6. Função auxiliar de verificação de propriedade
-- Retorna true apenas se a empresa pertencer ao usuário autenticado atual.
-- NUNCA retorna true se owner_id for null, garantindo que tabelas dependentes
-- não sejam acessadas até que a empresa seja "reivindicada" (claim).
CREATE OR REPLACE FUNCTION user_owns_company(company_name text) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.companies 
    WHERE name = company_name AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Aplicar Políticas Multi-tenant rígidas nas tabelas dependentes
-- A tabela deve ter uma coluna (geralmente "company" ou "company_id") que armazena o nome da empresa.

DO $$ 
DECLARE
  tbl text;
  col text;
BEGIN
  -- Lista de tabelas e suas colunas que referenciam o nome da empresa
  -- Formato: tabela:coluna
  FOR tbl, col IN 
    VALUES 
      ('delivery_orders', 'company'),
      ('delivery_products', 'company'),
      ('delivery_store_info', 'company'),
      ('delivery_whatsapp', 'company'),
      ('whatsapp_connections', 'company_id'),
      ('menu_assets', 'company_id'),
      ('monthly_contact_usage', 'company_id')
  LOOP
    -- Verifica se a tabela existe antes de aplicar
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      
      -- Remove política genérica se existir
      EXECUTE format('DROP POLICY IF EXISTS "Acesso total a %I" ON public.%I', tbl, tbl);
      -- Remove nossa política anterior se estiver atualizando
      EXECUTE format('DROP POLICY IF EXISTS "Dono acessa %I" ON public.%I', tbl, tbl);
      
      -- Cria nova política rígida usando a função user_owns_company
      EXECUTE format('
        CREATE POLICY "Dono acessa %I" ON public.%I
        FOR ALL USING (user_owns_company(%I)) WITH CHECK (user_owns_company(%I))
      ', tbl, tbl, col, col);
      
    END IF;
  END LOOP;
END $$;


-- 8. Recarregar Schema Cache (PostgREST)
-- Isso força o Supabase a reconhecer a nova coluna owner_id imediatamente, 
-- curando o erro "Could not find the 'owner_id' column in the schema cache".
NOTIFY pgrst, 'reload schema';
