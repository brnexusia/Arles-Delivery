# Arles Delivery v1.5.5

Painel web do Arles Delivery. O projeto reúne cadastro e login, onboarding,
dashboard, pedidos, clientes, cardápio, conexão do WhatsApp, importação de
cardápio com IA, trial e assinatura Stripe.

Esta árvore consolida a base completa do painel e todas as atualizações feitas
até a correção de sessão `v1.5.5` de 11/08/2026.

## Arquitetura atual

- React 19 + TanStack Router/Start + Vite;
- Netlify para o painel e as Functions;
- Arles Core/PostgreSQL para autenticação, sessão, tenants e dados operacionais;
- Stripe para checkout, portal e webhooks de assinatura;
- Evolution API para WhatsApp;
- Supabase mantido apenas nas funções legadas que ainda o utilizam;
- Arles Core para a importação assíncrona de cardápio com IA.

O navegador nunca recebe `ARLES_ENGINE_INTERNAL_KEY`, chaves Stripe ou chaves
de serviço. As chamadas privilegiadas passam pelas Netlify Functions.

## Conteúdo

- `src/components/delivery`: painel completo do delivery;
- `src/routes`: rotas públicas, autenticação, painel e administração;
- `src/lib`: autenticação, sessão, assinatura e cliente do Arles Core;
- `netlify/functions`: autenticação, proxy, Stripe, Evolution e funções legadas;
- `netlify/lib`: utilitários de servidor e validação de sessão;
- `sql`: migrations e correções históricas do painel;
- `automation`: último agente n8n v3.2, pós-venda e ajuste Pix preservados;
- `public`: PWA, ícones, manifest e service worker.

## Atualizações incorporadas

- módulos 1–3: autenticação/configurações, WhatsApp e cardápio com IA;
- módulo 4: Stripe;
- módulo 5: PWA;
- módulos 6–7: operação, pós-venda, avaliações e Pix;
- v1.1: painel conectado ao Arles Core;
- v1.2–v1.3: importação assíncrona e robusta, deduplicação e variações;
- v1.4: Auth/Billing no Arles Core;
- v1.5: cadastro, login e sessão sem migração de contas Supabase;
- v1.5.1–v1.5.4: persistência e fallback do cookie de sessão;
- v1.5.5: `Content-Type: application/json` somente quando há body, eliminando
  `FST_ERR_CTP_EMPTY_JSON_BODY` em sessão e logout.

## Desenvolvimento local

Requer Node.js 22 ou superior.

```bash
npm ci
cp .env.example .env
npm run dev
```

## Validação

```bash
npm run typecheck
npm run build
```

Para reproduzir exatamente o build do Netlify:

```bash
NITRO_PRESET=netlify npm run build
```

Esse build gera `dist` e a função SSR interna em `.netlify/functions-internal`.

## Deploy no Netlify

1. Configure as variáveis de `.env.example` no ambiente do site.
2. Confirme que o Arles Core v1.5.5 já está implantado.
3. Faça o deploy deste repositório.
4. Teste cadastro, onboarding, logout e login.
5. Confirme que `auth-login` retorna `200` e que as chamadas seguintes de
   `engine-proxy` também retornam `200`.

O `netlify.toml` já define `NITRO_PRESET=netlify`, comando `npm run build`,
publicação em `dist` e o diretório das Functions.

## Observações de segurança

- nunca faça commit de `.env`;
- use a mesma chave interna no painel e no Core;
- mantenha `STRIPE_WEBHOOK_SECRET` separado da secret key do Stripe;
- `SUPABASE_SERVICE_ROLE_KEY`, quando ainda necessária, existe somente no
  ambiente das Functions.
