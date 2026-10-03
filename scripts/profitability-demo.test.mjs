import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const paths = {
  datasource: resolve(
    root,
    'monitoring/grafana/provisioning/datasources/datasources.yml',
  ),
  dashboard: resolve(
    root,
    'monitoring/grafana/provisioning/dashboards/profitability-gauge.json',
  ),
  dashboardProvider: resolve(
    root,
    'monitoring/grafana/provisioning/dashboards/dashboards.yml',
  ),
  seed: resolve(root, 'monitoring/init/001_profitability_demo.sql'),
  docs: resolve(root, 'docs/profitability-gauge-grafana.md'),
};

const read = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

const dockerExecutables = [
  process.env.DOCKER_BIN,
  process.platform === 'win32' ? 'docker.exe' : 'docker',
  'docker',
  '/usr/local/bin/docker',
  '/opt/homebrew/bin/docker',
].filter(Boolean);

const runDocker = (args) => {
  const missingExecutables = [];

  for (const dockerExecutable of dockerExecutables) {
    try {
      return execFileSync(dockerExecutable, args, { cwd: root, encoding: 'utf8' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        missingExecutables.push(dockerExecutable);
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Docker CLI was not found. Tried: ${missingExecutables.join(', ')}`);
};

const test = (name, assertion) => {
  try {
    assertion();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const getGaugePanels = (dashboard) => dashboard.panels.filter((panel) => panel.type === 'gauge');

test('PostgreSQL datasource for profitability metrics is configured', () => {
  const datasourceContent = read(paths.datasource);
  if (!datasourceContent) {
    throw new Error('Datasource file not found');
  }

  assert.match(datasourceContent, /name:\s*PostgreSQL Profitability Demo/);
  assert.match(datasourceContent, /uid:\s*postgres-profitability/);
  assert.match(datasourceContent, /type:\s*postgres/);
  assert.match(datasourceContent, /url:\s*postgres:5432/);
  assert.match(datasourceContent, /user:\s*admin/);
  assert.match(datasourceContent, /database:\s*db/);
  assert.match(datasourceContent, /password:\s*admin/);
});

test('dashboard provider is configured', () => {
  const providerContent = read(paths.dashboardProvider);
  if (!providerContent) {
    throw new Error('Dashboard provider file not found');
  }

  assert.match(providerContent, /type:\s*file/);
  assert.match(providerContent, /path:\s*\/etc\/grafana\/provisioning\/dashboards/);
});

test('dashboard JSON file exists and is valid', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  assert.ok(dashboard.panels, 'dashboard has panels');
  assert.ok(dashboard.uid, 'dashboard has uid');
  assert.ok(dashboard.title, 'dashboard has title');
});

test('dashboard has 7 Gauge panels (4 real data + 3 test examples)', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const gaugePanels = getGaugePanels(dashboard);

  assert.equal(gaugePanels.length, 7, 'dashboard should have 7 Gauge panels');
});

test('dashboard uses correct datasource UID for all panels', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const gaugePanels = getGaugePanels(dashboard);

  for (const panel of gaugePanels) {
    assert.equal(panel.datasource.uid, 'postgres-profitability', 
      `Panel "${panel.title}" should use postgres-profitability datasource`);
    assert.equal(panel.datasource.type, 'postgres', 
      `Panel "${panel.title}" should use postgres type`);
  }
});

test('dashboard has currencyRUB unit configured', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const gaugePanels = getGaugePanels(dashboard);

  for (const panel of gaugePanels) {
    assert.equal(panel.fieldConfig.defaults.unit, 'currencyRUB', 
      `Panel "${panel.title}" should have currencyRUB unit`);
  }
});

test('real data panels query payments table with status=completed', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const expectedPanels = [
    'Доходность за 7 дней',
    'Доходность за 30 дней',
    'Доходность за 90 дней',
    'Доходность (все время)',
  ];

  for (const title of expectedPanels) {
    const panel = dashboard.panels.find((p) => p.title === title);
    assert.ok(panel, `panel "${title}" should exist`);
    assert.equal(panel.type, 'gauge');
    assert.match(panel.targets[0].rawSql, /FROM payments/i);
    assert.match(panel.targets[0].rawSql, /status\s*=\s*'completed'/i);
  }
});

test('test example panels use hardcoded values', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const expectedPanels = [
    { title: 'Пример: 50 000 руб.', value: 50000 },
    { title: 'Пример: 150 000 руб.', value: 150000 },
    { title: 'Пример: 250 000 руб.', value: 250000 },
  ];

  for (const { title, value } of expectedPanels) {
    const panel = dashboard.panels.find((p) => p.title === title);
    assert.ok(panel, `panel "${title}" should exist`);
    assert.match(panel.targets[0].rawSql, new RegExp(value.toFixed(2)));
  }
});

test('test example panels have correct thresholds (100k/200k)', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const testPanels = dashboard.panels.filter((p) => p.title.startsWith('Пример:'));

  for (const panel of testPanels) {
    assert.equal(panel.fieldConfig.defaults.thresholds.mode, 'absolute');
    assert.equal(panel.fieldConfig.defaults.thresholds.steps[1].value, 100000);
    assert.equal(panel.fieldConfig.defaults.thresholds.steps[2].value, 200000);
  }
});

test('7-day panel has thresholds 50k/100k', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const panel = dashboard.panels.find((p) => p.title === 'Доходность за 7 дней');

  assert.ok(panel);
  assert.equal(panel.fieldConfig.defaults.thresholds.steps[1].value, 50000);
  assert.equal(panel.fieldConfig.defaults.thresholds.steps[2].value, 100000);
});

test('30-day panel has thresholds 50k/100k', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const panel = dashboard.panels.find((p) => p.title === 'Доходность за 30 дней');

  assert.ok(panel);
  assert.equal(panel.fieldConfig.defaults.thresholds.steps[1].value, 50000);
  assert.equal(panel.fieldConfig.defaults.thresholds.steps[2].value, 100000);
});

test('90-day panel has thresholds 100k/200k', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const panel = dashboard.panels.find((p) => p.title === 'Доходность за 90 дней');

  assert.ok(panel);
  assert.equal(panel.fieldConfig.defaults.thresholds.steps[1].value, 100000);
  assert.equal(panel.fieldConfig.defaults.thresholds.steps[2].value, 200000);
});

test('all-time panel has thresholds 100k/200k', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const panel = dashboard.panels.find((p) => p.title === 'Доходность (все время)');

  assert.ok(panel);
  assert.equal(panel.fieldConfig.defaults.thresholds.steps[1].value, 100000);
  assert.equal(panel.fieldConfig.defaults.thresholds.steps[2].value, 200000);
});

test('all gauge panels have threshold markers and labels enabled', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const gaugePanels = getGaugePanels(dashboard);

  for (const panel of gaugePanels) {
    assert.equal(panel.options.showThresholdMarkers, true,
      `Panel "${panel.title}" should show threshold markers`);
    assert.equal(panel.options.showThresholdLabels, true,
      `Panel "${panel.title}" should show threshold labels`);
  }
});

test('dashboard has auto-refresh configured', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  assert.equal(dashboard.refresh, '10s');
});

test('dashboard has correct UID and title', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  assert.equal(dashboard.uid, 'profitability-gauge-demo');
  assert.equal(dashboard.title, 'Доходность');
});

test('all panels use thresholds color mode', () => {
  const dashboardContent = read(paths.dashboard);
  if (!dashboardContent) {
    throw new Error('Dashboard file not found');
  }

  const dashboard = JSON.parse(dashboardContent);
  const gaugePanels = getGaugePanels(dashboard);

  for (const panel of gaugePanels) {
    assert.equal(panel.fieldConfig.defaults.color.mode, 'thresholds',
      `Panel "${panel.title}" should use thresholds color mode`);
  }
});

test('Grafana container is running on port 3001', () => {
  const psOutput = runDocker(['ps', '--format', '{{.Names}}\t{{.Ports}}']);
  assert.match(psOutput, /notary-grafana.*3001/);
});

test('PostgreSQL container is running', () => {
  const psOutput = runDocker(['ps', '--format', '{{.Names}}']);
  assert.match(psOutput, /notary-postgres/);
});

console.log('\n--- All tests passed ---');
