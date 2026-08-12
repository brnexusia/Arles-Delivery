# Arles Delivery — Painel conectado ao Arles Engine

## Variáveis obrigatórias no Netlify

Adicione em **Site configuration -> Environment variables**:

```env
ARLES_ENGINE_URL=https://arles-core-engine.mhnmch.easypanel.host
ARLES_ENGINE_INTERNAL_KEY=O_MESMO_INTERNAL_API_KEY_CONFIGURADO_NO_ENGINE
```

Mantenha por enquanto as variáveis atuais do Supabase e Stripe.

## O que passa a vir do Engine/PostgreSQL

- Dashboard/pedidos
- Status e pós-venda
- Clientes e observações
- Produtos/cardápio
- Importação confirmada do cardápio
- Informações da loja e regras da IA
- Configurações gerais operacionais
- Cardápio visual
- WhatsApp/Evolution
- Comprovantes PIX

## O que ainda usa Supabase temporariamente

- Login/sessão
- Stripe/billing
- Identificação segura do tenant na função Netlify
- Fonte da migração única dos dados antigos
- Autenticação da extração de cardápio por IA

## Primeiro acesso após o deploy

O arquivo `netlify/functions/engine-proxy.mts` copia automaticamente uma única vez os dados operacionais antigos da empresa para o PostgreSQL do Arles Engine.

O UUID da empresa é preservado, portanto não há troca de tenant no painel.

## Webhook Evolution durante a transição

- Instâncias gerenciadas pelo novo painel recebem webhook direto para `/webhooks/evolution` do Engine.
- O webhook antigo da Netlify também foi alterado para encaminhar mensagens ao Engine enquanto alguma instância ainda estiver apontando para ele.
- O n8n deixa de ser usado por essa ponte.
