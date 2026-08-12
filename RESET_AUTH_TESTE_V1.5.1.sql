-- ARLES v1.5.1 — RESET APENAS DO AUTH DE TESTE
-- Use somente agora, enquanto não há usuários reais.
-- Não apaga cardápios, pedidos, clientes ou empresas existentes.

BEGIN;

DELETE FROM auth_sessions;
DELETE FROM trial_entitlements;
DELETE FROM auth_users;

COMMIT;

-- Conferência:
SELECT COUNT(*) AS auth_users FROM auth_users;
SELECT COUNT(*) AS auth_sessions FROM auth_sessions;
SELECT COUNT(*) AS trial_entitlements FROM trial_entitlements;
