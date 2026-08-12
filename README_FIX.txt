ARLES DELIVERY v1.5.5 — FIX EMPTY JSON SESSION

Diagnóstico confirmado pelo log:
FST_ERR_CTP_EMPTY_JSON_BODY
"Body cannot be empty when content-type is set to 'application/json'"

Causa:
engineFetch adicionava Content-Type: application/json em TODAS as requisições,
inclusive POST sem body, como /internal/auth/session e /internal/auth/logout.

Fastify rejeitava a requisição antes mesmo de executar a rota.

Correção:
- Content-Type: application/json só é enviado quando init.body existe.
- Requisições POST vazias de sessão/logout deixam de ser rejeitadas.
- Não altera Engine, Postgres, token, senha, trial ou Stripe.

Aplique somente:
netlify/lib/arles-server.mts

Depois do deploy:
auth-login deve passar da validação de sessão e retornar 200.
