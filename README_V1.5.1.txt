ARLES v1.5.1 — correção definitiva do cadastro/login

Corrige:
1. Cookie de sessão usando a API oficial Context.cookies da Netlify.
2. Corrida entre auth-session inicial e cadastro/login.
3. auth-session não apaga mais uma sessão recém-criada.
4. Todas as funções protegidas passam o Context para leitura do cookie.
5. Validação amigável do WhatsApp do responsável.
6. Mantém trial novo de 7 dias e Stripe/Billing do v1.5.

Antes de testar:
- como ainda não existem usuários reais, rode RESET_AUTH_TESTE_V1.5.1.sql no Postgres arles_core.
- isso limpa somente auth_users, auth_sessions e trial_entitlements.
- não apaga pedidos, clientes, cardápios ou empresas.

Teste:
1. /register
2. Use um telefone com DDD, por exemplo 11999999999
3. Crie a conta
4. Deve entrar automaticamente no onboarding, sem passar por /login
5. Termine onboarding
6. Confirme banner Restam 7 dias
7. Logout
8. Login com o mesmo e-mail/senha
9. Assinatura -> escolher plano -> Stripe Checkout
