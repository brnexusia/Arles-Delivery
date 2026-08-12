# Arles Delivery — conexão Auth/Billing v1.4

Este patch move o login e o estado da assinatura para o Arles Core/PostgreSQL.

- O navegador usa cookie de sessão HttpOnly `arles_session`.
- O browser não recebe `ARLES_ENGINE_INTERNAL_KEY`.
- Netlify Functions autenticam a sessão no Engine.
- Novas contas não precisam do Supabase Auth.
- Conta antiga é convertida no primeiro login bem-sucedido usando o Supabase somente como verificação temporária.
- Checkout/Portal continuam no Stripe via Functions.
- Stripe webhook atualiza o PostgreSQL pelo Engine.
- O proxy de painel passa `company_id` também no DELETE, corrigindo a exclusão de produtos.

## Netlify

Mantenha:

```env
ARLES_ENGINE_URL=...
ARLES_ENGINE_INTERNAL_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_ESSENTIAL=...
STRIPE_PRICE_PROFESSIONAL=...
STRIPE_PRICE_SCALE=...
APP_URL=...
```

Temporariamente para converter contas antigas:

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Depois do deploy, faça login uma vez com cada conta antiga para convertê-la ao Core.
