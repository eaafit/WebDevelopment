const fs = require('node:fs');
const path = require('node:path');

// После изменения этого файла пересоберите JSON для Grafana из корня репозитория:
// node monitoring/grafana/provisioning/dashboards/tempo-business-traces.dashboard.cjs
const dashboardPath = path.join(__dirname, 'tempo-business-traces.json');

// Размеры и положение панелей в сетке Grafana. Значения gridPos удобнее держать
// здесь, а не вручную править сгенерированный JSON.
const layout = {
  description: { h: 14, w: 24, x: 0, y: 0 },
  quick: { h: 4, w: 24, x: 0, y: 14 },
  globalDivider: { h: 2, w: 24, x: 0, y: 18 },
  allTraces: { h: 10, w: 12, x: 0, y: 20 },
  errorTraces: { h: 10, w: 12, x: 12, y: 20 },
  slowTraces: { h: 8, w: 12, x: 0, y: 30 },
  actorTraces: { h: 8, w: 12, x: 12, y: 30 },
  userDivider: { h: 2, w: 24, x: 0, y: 38 },
  auth: { h: 10, w: 6, x: 0, y: 40 },
  assessment: { h: 10, w: 6, x: 6, y: 40 },
  payment: { h: 10, w: 6, x: 12, y: 40 },
  document: { h: 10, w: 6, x: 18, y: 40 },
  opsDivider: { h: 2, w: 24, x: 0, y: 50 },
  notification: { h: 9, w: 6, x: 0, y: 52 },
  newsletter: { h: 9, w: 6, x: 6, y: 52 },
  audit: { h: 9, w: 6, x: 12, y: 52 },
  bitrix: { h: 9, w: 6, x: 18, y: 52 },
  order: { h: 9, w: 8, x: 0, y: 61 },
  report: { h: 9, w: 8, x: 8, y: 61 },
  user: { h: 9, w: 8, x: 16, y: 61 },
};

const dashboardUrl = (overrides = {}) => {
  const params = {
    orgId: '1',
    from: 'now-6h',
    to: 'now',
    'var-operation': '$__all',
    'var-entity': '$__all',
    'var-actor_role': '$__all',
    'var-result': '$__all',
    ...overrides,
  };

  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `/d/notarius-tempo-business-traces/centr-biznes-trassirovok-tempo?${query}`;
};

const panelUrl = (panelId, overrides = {}) =>
  dashboardUrl({ ...overrides, viewPanel: String(panelId) });

const exploreUrl = (query) => {
  const left = {
    datasource: 'tempo',
    queries: [{ refId: 'A', queryType: 'traceql', query }],
    range: { from: 'now-1h', to: 'now' },
  };

  return `/explore?orgId=1&left=${encodeURIComponent(JSON.stringify(left))}`;
};

const sectionLine = (title) => `
  <div style="display:flex;align-items:center;gap:12px;margin:0 0 12px;">
    <div style="flex:1;border-top:1px solid rgba(255,255,255,.36);height:0;"></div>
    <div style="font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;">${title}</div>
    <div style="flex:1;border-top:1px solid rgba(255,255,255,.36);height:0;"></div>
  </div>`;

const divider = (title) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:12px 0 8px;">
  <div style="display:flex;align-items:center;gap:16px;">
    <div style="flex:1;border-top:1px solid rgba(255,255,255,.44);height:0;"></div>
    <div style="font-size:17px;font-weight:850;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">${title}</div>
    <div style="flex:1;border-top:1px solid rgba(255,255,255,.44);height:0;"></div>
  </div>
</div>`;

const descriptionContent = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.4;">
${sectionLine('Описание')}
  <div style="border:1px solid rgba(255,255,255,.16);border-radius:6px;background:rgba(255,255,255,.025);padding:14px 16px;">
    <div style="font-size:15px;font-weight:800;margin-bottom:7px;">Центр мониторинга бизнес-трассировок API</div>
    <div style="font-size:12px;opacity:.78;max-width:1180px;margin-bottom:11px;">
      <div>Здесь собраны бизнес-трассировки API, которые backend отправляет в Tempo через OpenTelemetry.</div>
      <div style="margin-top:4px;white-space:nowrap;">
        По ним видно процесс, результат и span-этапы: авторизация, заявка, платёж, документ, уведомление, рассылка, аудит, Bitrix, заказ, отчёт, профиль.
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px;">
      <div style="border-top:1px solid rgba(255,255,255,.18);padding-top:7px;">
        <strong style="font-size:12px;">notary.operation</strong><br>
        <span style="font-size:11px;opacity:.72;">тип бизнес-операции. Примеры: <code>auth.login</code>, <code>payment.create</code></span>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,.18);padding-top:7px;">
        <strong style="font-size:12px;">notary.entity</strong><br>
        <span style="font-size:11px;opacity:.72;">бизнес-сущность. Примеры: <code>User</code>, <code>Payment</code>, <code>Document</code></span>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,.18);padding-top:7px;">
        <strong style="font-size:12px;">notary.actor.role</strong><br>
        <span style="font-size:11px;opacity:.72;">роль инициатора. Примеры: <code>applicant</code>, <code>notary</code>, <code>admin</code>, <code>system</code></span>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,.18);padding-top:7px;">
        <strong style="font-size:12px;">notary.result</strong><br>
        <span style="font-size:11px;opacity:.72;">итог операции: <code>success</code> — успешно, <code>error</code> — с ошибкой</span>
      </div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,.18);margin:10px 0;"></div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;font-size:11px;opacity:.76;">
      <div>Откройте <code>Trace ID</code>, чтобы увидеть цепочку span-этапов в Tempo.</div>
      <div><code>No data</code> в таблице означает, что за выбранный период не найдено подходящих трассировок.</div>
      <div>Если вы выполнили действие в приложении, а всё равно видите <code>No data</code>, проверьте период, фильтры и отправку трассировки в Tempo.</div>
      <div>В фильтры не вынесены email, телефоны, ФИО, токены и файловые ключи.</div>
    </div>
  </div>
</div>`;

// Иконки быстрых переходов взяты из Lucide: https://lucide.dev/
// Grafana Text panel не рендерит inline <svg>, поэтому отдаём иконки как data:image в <img>.
// Встраиваем только нужные SVG-пути, чтобы не добавлять npm-зависимость ради dashboard JSON.
const lucideIcons = {
  'alert-triangle':
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />',
  bell:
    '<path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />',
  'clipboard-list':
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />',
  'credit-card':
    '<rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />',
  'file-text':
    '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />',
  'layout-dashboard':
    '<rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />',
  list:
    '<path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" /><path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" />',
  'log-in':
    '<path d="m10 17 5-5-5-5" /><path d="M15 12H3" /><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />',
  mail:
    '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" />',
  package:
    '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /><path d="M12 22V12" /><polyline points="3.29 7 12 12 20.71 7" /><path d="m7.5 4.27 9 5.15" />',
  'pen-line':
    '<path d="M13 21h8" /><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />',
  search: '<path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />',
  'shield-check':
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" />',
  timer:
    '<line x1="10" x2="14" y1="2" y2="2" /><line x1="12" x2="15" y1="14" y2="11" /><circle cx="12" cy="14" r="8" />',
  'user-round':
    '<circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M16 3.128a4 4 0 0 1 0 7.744" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><circle cx="9" cy="7" r="4" />',
  workflow:
    '<rect width="8" height="8" x="3" y="3" rx="2" /><path d="M7 11v4a2 2 0 0 0 2 2h4" /><rect width="8" height="8" x="13" y="13" rx="2" />',
};

const lucideIcon = (name) => {
  const paths = lucideIcons[name];
  if (!paths) {
    throw new Error(`Unknown Lucide icon: ${name}`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7CBD8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

  return `<img src="${src}" alt="" aria-hidden="true" style="display:inline-block;width:16px;height:16px;flex:0 0 auto;opacity:.92;">`;
};

const quickItems = [
  ['layout-dashboard', 'Общий обзор', dashboardUrl()],
  ['list', 'Все трассировки', panelUrl(2)],
  ['alert-triangle', 'Только ошибки', panelUrl(3, { 'var-result': 'error' })],
  ['timer', 'Медленные этапы', panelUrl(4)],
  ['users', 'Роли пользователей', panelUrl(5)],
  ['log-in', 'Авторизация', panelUrl(7)],
  ['clipboard-list', 'Заявки', panelUrl(8)],
  ['credit-card', 'Платежи', panelUrl(9)],
  ['file-text', 'Документы', panelUrl(10)],
  ['bell', 'Уведомления', panelUrl(12)],
  ['mail', 'Рассылки', panelUrl(13)],
  ['shield-check', 'Аудит', panelUrl(14)],
  ['workflow', 'Bitrix24', panelUrl(15)],
  ['package', 'Заказы', panelUrl(16)],
  ['pen-line', 'Отчёты', panelUrl(17)],
  ['user-round', 'Профиль', panelUrl(18)],
  ['search', 'Tempo Explore', exploreUrl('{ span."notary.operation" =~ ".*" }')],
];

const quickContent = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.25;">
${sectionLine('Быстрое реагирование')}
  <div style="display:flex;align-items:flex-start;justify-content:flex-start;gap:8px;flex-wrap:wrap;">
${quickItems
  .map(
    ([iconName, label, href]) => `    <a href="${href}" style="display:inline-flex;align-items:center;justify-content:flex-start;gap:8px;border:1px solid rgba(255,255,255,.20);border-radius:4px;background:rgba(255,255,255,.025);min-height:38px;padding:0 13px;text-decoration:none;font-size:13px;font-weight:800;box-sizing:border-box;white-space:nowrap;">${lucideIcon(iconName)}<span>${label}</span></a>`,
  )
  .join('\n')}
  </div>
</div>`;

const panelLayouts = new Map([
  [1, layout.description],
  [40, layout.quick],
  [50, layout.globalDivider],
  [2, layout.allTraces],
  [3, layout.errorTraces],
  [4, layout.slowTraces],
  [5, layout.actorTraces],
  [51, layout.userDivider],
  [7, layout.auth],
  [8, layout.assessment],
  [9, layout.payment],
  [10, layout.document],
  [52, layout.opsDivider],
  [12, layout.notification],
  [13, layout.newsletter],
  [14, layout.audit],
  [15, layout.bitrix],
  [16, layout.order],
  [17, layout.report],
  [18, layout.user],
]);

const textPanelContent = new Map([
  [1, descriptionContent],
  [40, quickContent],
  [50, divider('Глобальный обзор')],
  [51, divider('Пользовательские бизнес-процессы')],
  [52, divider('Операционные процессы и интеграции')],
]);

const applyTextPanel = (panel, content) => {
  panel.type = 'text';
  panel.title = '';
  panel.transparent = true;
  panel.options = {
    code: {
      language: 'plaintext',
      showLineNumbers: false,
      showMiniMap: false,
    },
    content,
    mode: 'html',
  };
  panel.fieldConfig = panel.fieldConfig || { defaults: {}, overrides: [] };
};

const noDataDescriptions = new Map([
  [
    2,
    'Все найденные трассировки по выбранному периоду и фильтрам. `No data` здесь означает, что за этот период бизнес-трассировки не найдены или фильтры слишком узкие.',
  ],
  [
    3,
    'Трассировки, где результат бизнес-этапа равен error. `No data` здесь означает, что ошибок по текущему периоду и фильтрам не найдено.',
  ],
  [
    4,
    'Этапы, которые длились больше секунды. `No data` здесь означает, что медленные span-этапы по текущему периоду и фильтрам не найдены.',
  ],
  [
    5,
    'Трассировки, где известна роль инициатора. `No data` здесь означает, что за выбранный период нет трассировок с ролью пользователя или выбранная роль не встречалась.',
  ],
  [
    7,
    'Регистрация, вход, выход, обновление сессии и восстановление пароля. `No data` здесь означает, что такие действия не выполнялись за выбранный период или скрыты фильтрами.',
  ],
  [
    8,
    'Создание, изменение, проверка, завершение и отмена заявок на оценку. `No data` здесь означает, что операции с заявками не выполнялись за выбранный период или скрыты фильтрами.',
  ],
  [
    9,
    'Создание платежей, ответы платёжных систем, webhook-обработка, подписки и чеки. `No data` здесь означает, что платежные события не приходили за выбранный период или скрыты фильтрами.',
  ],
  [
    10,
    'Создание, удаление, открытие документов и безопасные этапы работы с хранилищем. `No data` здесь означает, что документные операции не выполнялись за выбранный период или скрыты фильтрами.',
  ],
  [
    12,
    'Создание, списки, прочтение, удаление и настройки уведомлений. `No data` здесь означает, что события уведомлений не выполнялись за выбранный период или скрыты фильтрами.',
  ],
  [
    13,
    'Оценка аудитории, отправка кампаний, повторная отправка и пакетная доставка. `No data` здесь означает, что рассылки не запускались за выбранный период или скрыты фильтрами.',
  ],
  [
    14,
    'Просмотр, выгрузка и запись audit-событий. `No data` здесь означает, что audit-события не попадали под текущий период и фильтры.',
  ],
  [
    15,
    'Настройка, проверка связи, синхронизация, контакты, сделки и лиды. `No data` здесь означает, что Bitrix-сценарии не запускались за выбранный период или скрыты фильтрами.',
  ],
  [
    16,
    'Список заказов, карточка заказа и взятие заказа в работу. `No data` здесь означает, что операции с заказами не выполнялись за выбранный период или скрыты фильтрами.',
  ],
  [
    17,
    'Создание, подписание и удаление отчётов. `No data` здесь означает, что операции с отчётами не выполнялись за выбранный период или скрыты фильтрами.',
  ],
  [
    18,
    'Изменение данных профиля пользователя. `No data` здесь означает, что профиль не изменялся за выбранный период или событие скрыто фильтрами.',
  ],
]);

const applyTracePanelEmptyState = (panel) => {
  if (!panel.targets?.some((target) => target.tableType === 'traces')) {
    return;
  }

  panel.description = noDataDescriptions.get(panel.id) || panel.description;
  panel.fieldConfig = panel.fieldConfig || { defaults: {}, overrides: [] };
  panel.fieldConfig.defaults = { ...(panel.fieldConfig.defaults || {}) };
  delete panel.fieldConfig.defaults.noValue;
};

const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));

dashboard.links = [];
dashboard.refresh = '5s';
dashboard.timepicker = {
  ...(dashboard.timepicker || {}),
  nowDelay: '10s',
  refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h'],
};

// Фильтры оставляем нативными переменными Grafana. Кастомные dropdown внутри text-панелей
// нестабильно скроллятся и обрезаются, а штатные контролы работают корректно.
for (const variable of dashboard.templating.list) {
  variable.hide = 0;
}

for (const panel of dashboard.panels) {
  if (panelLayouts.has(panel.id)) {
    panel.gridPos = panelLayouts.get(panel.id);
  }

  if (textPanelContent.has(panel.id)) {
    applyTextPanel(panel, textPanelContent.get(panel.id));
  }

  applyTracePanelEmptyState(panel);

  for (const target of panel.targets || []) {
    if (target.tableType === 'traces') {
      target.limit = panel.id >= 2 && panel.id <= 5 ? 50 : 30;
    }
  }
}

dashboard.panels = dashboard.panels
  .filter((panel) => ![20, 39].includes(panel.id))
  .sort((a, b) => a.gridPos.y - b.gridPos.y || a.gridPos.x - b.gridPos.x || a.id - b.id);

fs.writeFileSync(dashboardPath, `${JSON.stringify(dashboard, null, 2)}\n`);
