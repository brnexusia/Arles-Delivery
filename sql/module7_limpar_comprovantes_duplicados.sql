BEGIN;

-- Limpa somente comprovantes EXATAMENTE duplicados que tenham sido
-- gravados em mais de um pedido da mesma empresa/telefone.
-- Mantém o comprovante no pedido mais recente.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        company_id,
        client_phone,
        md5(payment_proof_url)
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.delivery_orders
  WHERE payment_proof_url IS NOT NULL
    AND payment_proof_url <> ''
)
UPDATE public.delivery_orders AS o
SET
  payment_proof_url = NULL,
  payment_status = CASE
    WHEN o.payment_status = 'pending_approval'
         AND o.payment_approved_at IS NULL
      THEN 'pending'
    ELSE o.payment_status
  END,
  updated_at = now()
FROM ranked AS r
WHERE o.id = r.id
  AND r.rn > 1;

NOTIFY pgrst, 'reload schema';

COMMIT;
