# CI/CD, SonarQube, Gitea MCP и Kubernetes

Этот документ описывает DevOps-слой, добавленный для учебного PR по порталу нотариальных услуг. В одном сценарии собраны Nx, pnpm, Docker, GitLab CI, SonarQube, Gitea MCP и Kubernetes-манифесты, чтобы показать полный путь от тестов до деплоя.

## Схема Pipeline

GitLab pipeline повторяет структуру из примера преподавателя:

1. `test` - unit-тесты и опциональный интеграционный smoke через Docker Compose.
2. `code_quality` - ESLint, Stylelint и анализ SonarQube Scanner.
3. `build` - проверка SemVer-тега и сборка контейнеров через Kaniko.
4. `test_image` - загрузка собранных API/Web образов и smoke-проверка контейнеров.
5. `security_scan` - отчеты Trivy по уязвимостям и CycloneDX SBOM-файлы.
6. `deploy` - деплой в Kubernetes через kustomize и `kubectl`.

Сборка релизных контейнеров запускается только для валидных тегов:

```bash
bash scripts/ci/validate-semver-tag.sh 1.2.3
bash scripts/ci/validate-semver-tag.sh 1.2.3-rc.1
```

Теги `v1.2.3`, `1.2`, `1.2.3-beta.1` и `01.2.3` отклоняются. Это важно для задания: контейнерные образы не собираются случайно из любой ветки, а только из понятного релизного тега.

## Локальная Проверка

Ниже команды, которые повторяют основные проверки из CI:

```bash
pnpm exec nx run-many -t test --parallel=3 --ci --coverage
pnpm exec nx affected -t lint stylelint --parallel=3
pnpm exec nx build api && pnpm exec nx build web
docker build -f apps/api/Dockerfile -t notary-portal-api:test .
docker build -f apps/web/Dockerfile -t notary-portal-web:test .
bash scripts/ci/integration-smoke.sh
```

Интеграционный smoke использует `apps/web/docker-compose.portal.yml`, создает отдельный Compose-проект `notary-smoke`, выполняет Prisma-миграции и проверяет:

- `/health` через nginx;
- `/metrics` через nginx;
- загрузку Angular shell со страницы `/`.

Если нужно оставить контейнеры после проверки, можно запустить:

```bash
KEEP_SMOKE_STACK=1 bash scripts/ci/integration-smoke.sh
```

## SonarQube и Gitea MCP

Локальный DevOps-стенд запускается так:

```bash
docker compose -f devops/docker-compose.devops.yml up -d --build
```

Сервисы стенда:

- SonarQube: `http://localhost:9000`
- Gitea: `http://localhost:3002`
- Gitea MCP SSE endpoint: `http://localhost:8080/mcp`

В локальной демке порт `9000` может быть занят MinIO. Тогда SonarQube удобно поднять на другом порту:

```bash
SONARQUBE_PORT=19000 docker compose -f devops/docker-compose.devops.yml up -d sonarqube
```

Для MCP нужно создать Gitea access token в `Settings -> Applications`, затем перезапустить сервис:

```bash
GITEA_MCP_TOKEN=<token> docker compose -f devops/docker-compose.devops.yml up -d --build gitea-mcp
```

MCP-сервер запускается в официальном SSE-режиме Gitea:

```bash
gitea-mcp -t sse --host http://gitea:3000 --token <token>
```

Важно для показа: `/mcp` - это не HTML-страница, а streaming endpoint для MCP-клиента. В браузере там не должно быть красивого интерфейса; корректный признак работы - ответ `200 OK` с `Content-Type: text/event-stream`.

## Kubernetes Демо

Сначала нужно собрать локальные образы:

```bash
docker build -f apps/api/Dockerfile -t notary-portal-api:local .
docker build -f apps/web/Dockerfile -t notary-portal-web:local .
kubectl kustomize deploy/k8s/overlays/local
kubectl apply -k deploy/k8s/overlays/local
kubectl get pods,svc,ingress -n notary-portal
```

`kubectl apply` требует запущенный локальный кластер, например kind или minikube. Для kind перед apply нужно загрузить образы внутрь кластера:

```bash
kind load docker-image notary-portal-api:local
kind load docker-image notary-portal-web:local
```

Локальный overlay содержит demo secret с небоевыми значениями. Для настоящего кластера секрет создается отдельно на основе `deploy/k8s/base/secret.example.yaml` или передается через CI.

Для ревью также доступны отдельные overlays:

```bash
kubectl kustomize deploy/k8s/overlays/staging
kubectl kustomize deploy/k8s/overlays/production
```

Базовые manifests включают service accounts, resource limits, HPA, PDB, NetworkPolicy и опциональные объекты Prometheus Operator (`ServiceMonitor`, `PrometheusRule`).

## Helm Release

То же приложение можно отрендерить и установить через Helm:

```bash
helm template notary-portal deploy/helm/notary-portal -f deploy/helm/notary-portal/values-local.yaml
helm upgrade --install notary-portal deploy/helm/notary-portal \
  -n notary-portal \
  --create-namespace \
  -f deploy/helm/notary-portal/values-local.yaml
```

Файлы настроек окружений:

- `deploy/helm/notary-portal/values-local.yaml`
- `deploy/helm/notary-portal/values-staging.yaml`
- `deploy/helm/notary-portal/values-production.yaml`

Подробный порядок проверки, rollback и release evidence описан в [kubernetes-helm-runbook.md](kubernetes-helm-runbook.md).

## Runtime SBOM

В репозитории хранится воспроизводимый SBOM по runtime-зависимостям:

```bash
node scripts/ci/generate-sbom.mjs docs/security/sbom/notary-portal-pnpm.cdx.json
jq empty docs/security/sbom/notary-portal-pnpm.cdx.json
```

Этот файл дополняет GitLab job `cyclonedx_scan`, который создает image-level SBOM artifacts для релизных тегов. За счет committed SBOM преподаватель может увидеть supply-chain evidence прямо в PR, даже не открывая artifacts в CI.

## Переменные GitLab CI

Для полноценного деплоя нужны переменные:

- `CI_REGISTRY`, `CI_REGISTRY_IMAGE`, `CI_REGISTRY_USER`, `CI_REGISTRY_PASSWORD`
- `SONAR_HOST_URL`, `SONAR_TOKEN`
- `KUBE_CONFIG_B64`
- `KUBE_NAMESPACE` (по умолчанию `notary-portal`)
- `KUBE_SECRET_MANIFEST`, если secret нужно применить из CI
- `KUBE_ENABLE_MONITORING_CRDS=true`, если в кластере установлены Prometheus Operator CRDs и нужно применить `ServiceMonitor`/`PrometheusRule`

Deploy job декодирует `KUBE_CONFIG_B64`, применяет kustomize manifests, подставляет API/Web images с релизным тегом и ждет rollout обоих deployments.
