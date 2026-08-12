-- OPCIONAL — SOMENTE para ambiente sem usuários reais.
-- Permite reutilizar e-mail/telefone usados nos testes anteriores.
-- Mantém admins e NÃO apaga companies/pedidos/cardápios.
BEGIN;
DELETE FROM auth_sessions;
DELETE FROM auth_users WHERE role = 'user';
DELETE FROM trial_entitlements;
COMMIT;
