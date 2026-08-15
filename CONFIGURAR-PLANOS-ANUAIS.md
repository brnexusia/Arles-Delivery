# Configurar planos anuais do Arles Delivery

No Stripe, crie um preço recorrente anual para cada plano:

| Plano | Cobrança anual | Equivalente mensal | Economia |
| --- | ---: | ---: | ---: |
| Essencial | R$ 499,00/ano | R$ 41,58/mês | R$ 99,80 |
| Profissional | R$ 1.970,00/ano | R$ 164,17/mês | R$ 394,00 |
| Escala | R$ 2.970,00/ano | R$ 247,50/mês | R$ 594,00 |

Depois, copie os três Price IDs anuais para as variáveis do Netlify:

```env
STRIPE_PRICE_ESSENTIAL_ANNUAL=price_...
STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_...
STRIPE_PRICE_SCALE_ANNUAL=price_...
```

Os Price IDs mensais atuais continuam nas variáveis já existentes. Após salvar
as novas variáveis, faça um novo deploy do site no Netlify.
