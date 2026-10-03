WITH demo_user AS (
  SELECT id AS user_id
  FROM users
  ORDER BY email
  LIMIT 1
),
demo_payments(id, amount, payment_date, transaction_id) AS (
  VALUES
    ('11111111-1111-4111-8111-111111111111'::uuid, 50000.00::numeric(15, 2), NOW() - INTERVAL '1 day', 'grafana-demo-profitability-7d'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 70000.00::numeric(15, 2), NOW() - INTERVAL '14 days', 'grafana-demo-profitability-30d'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 60000.00::numeric(15, 2), NOW() - INTERVAL '45 days', 'grafana-demo-profitability-90d')
)
INSERT INTO payments (
  id,
  user_id,
  type,
  amount,
  payment_date,
  status,
  payment_method,
  transaction_id
)
SELECT
  demo_payments.id,
  demo_user.user_id,
  'subscription'::payment_type,
  demo_payments.amount,
  demo_payments.payment_date,
  'completed'::payment_status,
  'grafana-demo',
  demo_payments.transaction_id
FROM demo_payments
CROSS JOIN demo_user
ON CONFLICT (transaction_id) DO UPDATE
SET
  amount = EXCLUDED.amount,
  payment_date = EXCLUDED.payment_date,
  status = EXCLUDED.status,
  payment_method = EXCLUDED.payment_method;

SELECT
  COALESCE(SUM(amount), 0) AS profitability_7_days
FROM payments
WHERE status = 'completed'
  AND payment_date >= NOW() - INTERVAL '7 days';

SELECT
  COALESCE(SUM(amount), 0) AS profitability_30_days
FROM payments
WHERE status = 'completed'
  AND payment_date >= NOW() - INTERVAL '30 days';

SELECT
  COALESCE(SUM(amount), 0) AS profitability_90_days
FROM payments
WHERE status = 'completed'
  AND payment_date >= NOW() - INTERVAL '90 days';
