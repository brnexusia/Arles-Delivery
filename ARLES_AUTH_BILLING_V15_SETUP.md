# Arles Delivery — Auth + Billing v1.5

Esta versão usa somente Arles Engine/PostgreSQL para cadastro, login e sessão.
Não existe migração de contas Supabase.

Fluxo esperado:
1. /register cria auth_user + company + trial de 7 dias no PostgreSQL.
2. Cookie HttpOnly arles_session é criado automaticamente.
3. O painel carrega company/onboarding/cardápio/pedidos pelo Engine.
4. /login autentica apenas no Arles Engine.
5. Assinatura usa Stripe Checkout e webhook atualiza companies no PostgreSQL.

O Supabase pode continuar configurado temporariamente para funcionalidades antigas que ainda não tenham sido removidas, mas não participa de Auth/Billing v1.5.
