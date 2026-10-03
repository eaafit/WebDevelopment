# Grafana profitability demo data

Dashboard:

```text
http://localhost:3001/d/profitability-gauge-demo/dohodnost?from=now-6h&to=now&refresh=10s
```

## Apply demo values

Run the prepared idempotent script:

```powershell
docker cp scripts/profitability-grafana-demo.sql notary-postgres:/tmp/profitability-grafana-demo.sql
docker exec notary-postgres psql -U admin -d db -f /tmp/profitability-grafana-demo.sql
```

Expected values after the script:

```text
7 days:   50 000
30 days: 120 000
90 days: 180 000
```

The dashboard refreshes every 10 seconds. You can also press refresh in Grafana.

## Check current values

```sql
SELECT COALESCE(SUM(amount), 0) AS "7 days"
FROM payments
WHERE status = 'completed'
  AND payment_date >= NOW() - INTERVAL '7 days';

SELECT COALESCE(SUM(amount), 0) AS "30 days"
FROM payments
WHERE status = 'completed'
  AND payment_date >= NOW() - INTERVAL '30 days';

SELECT COALESCE(SUM(amount), 0) AS "90 days"
FROM payments
WHERE status = 'completed'
  AND payment_date >= NOW() - INTERVAL '90 days';

SELECT COALESCE(SUM(amount), 0) AS "All time"
FROM payments
WHERE status = 'completed';
```

## Change demo values manually

Make the 7-day gauge green:

```sql
UPDATE payments
SET amount = 150000.00,
    payment_date = NOW() - INTERVAL '1 day',
    status = 'completed'
WHERE transaction_id = 'grafana-demo-profitability-7d';
```

Make the 7-day gauge red:

```sql
UPDATE payments
SET amount = 30000.00,
    payment_date = NOW() - INTERVAL '1 day',
    status = 'completed'
WHERE transaction_id = 'grafana-demo-profitability-7d';
```

Increase the 30-day gauge:

```sql
UPDATE payments
SET amount = 200000.00,
    payment_date = NOW() - INTERVAL '14 days',
    status = 'completed'
WHERE transaction_id = 'grafana-demo-profitability-30d';
```

Increase the 90-day gauge:

```sql
UPDATE payments
SET amount = 250000.00,
    payment_date = NOW() - INTERVAL '45 days',
    status = 'completed'
WHERE transaction_id = 'grafana-demo-profitability-90d';
```

## Reset demo data

```sql
DELETE FROM payments
WHERE payment_method = 'grafana-demo'
   OR transaction_id LIKE 'grafana-demo-profitability-%';
```
