# Arles Delivery — correção de importação IA v1.2

Não é necessária nenhuma variável nova.

1. Aplique primeiro o patch do Engine e faça deploy no Easypanel.
2. Confirme `/health` com versão `1.2.0`.
3. Aplique este patch no projeto do painel e faça deploy no Netlify.
4. Teste novamente em Cardápio -> Importar com IA.

O arquivo antigo `netlify/functions/import-menu.mts` pode continuar no projeto, mas o painel v1.2 não chama mais essa função.
A análise agora roda assíncrona no Arles Engine e o painel consulta o progresso, evitando o 504 do Netlify.
