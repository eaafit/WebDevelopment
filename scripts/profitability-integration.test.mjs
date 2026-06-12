import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const runDocker = (args, encoding = 'utf8') => {
  return execFileSync('docker', args, { encoding, cwd: process.cwd() });
};

const test = (name, assertion) => {
  try {
    assertion();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(`  Error: ${error.message}`);
    throw error;
  }
};

test('Grafana is running and healthy', async () => {
  const output = runDocker([
    'exec', 'notary-grafana', 'curl',
    '-s', '-u', 'admin:admin',
    'http://localhost:3000/api/health',
  ]);
  const health = JSON.parse(output);
  assert.equal(health.version, '11.3.0');
});

test('PostgreSQL datasource is configured', () => {
  const output = runDocker([
    'exec', 'notary-grafana', 'curl',
    '-s', '-u', 'admin:admin',
    'http://localhost:3000/api/datasources/uid/postgres-profitability',
  ]);
  const datasource = JSON.parse(output);
  assert.equal(datasource.uid, 'postgres-profitability');
  assert.equal(datasource.type, 'grafana-postgresql-datasource');
});

test('PostgreSQL datasource health check passes', () => {
  const output = runDocker([
    'exec', 'notary-grafana', 'curl',
    '-s', '-u', 'admin:admin',
    'http://localhost:3000/api/datasources/uid/postgres-profitability/health',
  ]);
  const health = JSON.parse(output);
  assert.equal(health.status, 'OK');
});

test('Dashboard exists in Grafana', () => {
  const output = runDocker([
    'exec', 'notary-grafana', 'curl',
    '-s', '-u', 'admin:admin',
    'http://localhost:3000/api/search?type=dash-db&uid=profitability-gauge-demo',
  ]);
  const results = JSON.parse(output);
  const dashboard = results.find((d) => d.uid === 'profitability-gauge-demo');
  assert.ok(dashboard, 'Dashboard should exist');
  assert.equal(dashboard.title, 'Доходность');
});

test('payments table exists in database', () => {
  const output = runDocker([
    'exec', 'notary-postgres', 'psql',
    '-U', 'admin', '-d', 'db',
    '-t', '-c', "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'payments';",
  ]);
  assert.equal(output.trim(), '1');
});

test('Query 7-day profitability returns data', () => {
  const output = runDocker([
    'exec', 'notary-postgres', 'psql',
    '-U', 'admin', '-d', 'db',
    '-t', '-c', "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed' AND payment_date >= NOW() - INTERVAL '7 days';",
  ]);
  const value = parseFloat(output.trim());
  assert.ok(value >= 0, 'Should return non-negative value');
});

test('Query 30-day profitability returns data', () => {
  const output = runDocker([
    'exec', 'notary-postgres', 'psql',
    '-U', 'admin', '-d', 'db',
    '-t', '-c', "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed' AND payment_date >= NOW() - INTERVAL '30 days';",
  ]);
  const value = parseFloat(output.trim());
  assert.ok(value >= 0, 'Should return non-negative value');
});

test('Query all-time profitability returns data', () => {
  const output = runDocker([
    'exec', 'notary-postgres', 'psql',
    '-U', 'admin', '-d', 'db',
    '-t', '-c', "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed';",
  ]);
  const value = parseFloat(output.trim());
  assert.ok(value > 0, 'Should have completed payments');
});

test('Grafana dashboard is accessible via HTTP', () => {
  const output = runDocker([
    'exec', 'notary-grafana', 'curl',
    '-s', '-o', '/dev/null', '-w', '%{http_code}',
    '-u', 'admin:admin',
    'http://localhost:3000/d/profitability-gauge-demo/dohodnost',
  ]);
  assert.equal(output.trim(), '200');
});

console.log('\n--- Integration tests passed ---');
