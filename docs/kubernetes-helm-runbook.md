# Runbook Релиза Через Kubernetes и Helm

Этот runbook описывает операционный сценарий, добавленный в учебный CI/CD PR. Здесь собраны kustomize manifests, Helm chart, правила релизных тегов, smoke-проверки, monitoring objects и порядок rollback.

## Варианты Деплоя

| Путь                         | Директория                           | Для чего нужен                                                     |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Kustomize local overlay      | `deploy/k8s/overlays/local`          | Быстрая демка на kind или minikube с локальными образами.          |
| Kustomize staging overlay    | `deploy/k8s/overlays/staging`        | Ревью staging-настроек, TLS annotations и увеличенного числа pods. |
| Kustomize production overlay | `deploy/k8s/overlays/production`     | Ревью production host, ресурсов и HPA limits.                      |
| Helm chart                   | `deploy/helm/notary-portal`          | Повторяемая установка или upgrade релиза.                          |
| GitLab CI deploy job         | `.gitlab-ci.yml` `deploy_kubernetes` | Деплой из CI после сборки контейнеров по валидному release tag.    |

## Правило Релизного Тега

Сборка контейнеров и deploy jobs специально закрыты проверкой тегов. Это защищает pipeline от случайного production build из обычной ветки.

Разрешены:

```bash
1.1.1
1.1.1-rc.1
1.1.1-rc.2
2.0.0
```

Отклоняются:

```bash
v1.1.1
1.1
1.1.1-beta.1
01.1.1
1.01.1
1.1.01
```

Проверка локально:

```bash
bash scripts/ci/validate-semver-tag.sh 1.1.1-rc.2
bash scripts/ci/validate-semver-tag.sh v1.1.1
```

Вторая команда должна завершиться ошибкой.

## Локальная Сборка Образов

Перед деплоем через kind, minikube, kustomize или Helm нужно собрать два образа:

```bash
docker build -f apps/api/Dockerfile -t notary-portal-api:local .
docker build -f apps/web/Dockerfile -t notary-portal-web:local .
```

Для kind:

```bash
kind load docker-image notary-portal-api:local
kind load docker-image notary-portal-web:local
```

Для minikube:

```bash
minikube image load notary-portal-api:local
minikube image load notary-portal-web:local
```

## Локальный Деплой Через Kustomize

Сначала можно отрендерить manifests без применения:

```bash
kubectl kustomize deploy/k8s/overlays/local
```

Затем применить их в кластер:

```bash
kubectl apply -k deploy/k8s/overlays/local
kubectl get pods,svc,ingress -n notary-portal
```

Проверка migration job:

```bash
kubectl get jobs -n notary-portal
kubectl logs job/notary-prisma-migrate -n notary-portal
```

Проверка API:

```bash
kubectl port-forward -n notary-portal svc/api 3000:3000
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:3000/metrics | head
```

Проверка Web:

```bash
kubectl port-forward -n notary-portal svc/web 8080:80
curl -fsS http://localhost:8080/ | head
```

## Ревью Staging Overlay

Рендер staging-настроек:

```bash
kubectl kustomize deploy/k8s/overlays/staging
```

Что нужно проверить:

1. namespace равен `notary-portal-staging`;
2. `NODE_ENV` равен `staging`;
3. ingress host равен `notary-staging.example.com`;
4. TLS issuer равен `letsencrypt-staging`;
5. API и Web стартуют с `2` replicas;
6. максимум HPA ниже, чем в production;
7. image repositories указывают на placeholder registry path.

Staging overlay не нужно применять в реальный кластер без замены registry и secret values.

## Ревью Production Overlay

Рендер production-настроек:

```bash
kubectl kustomize deploy/k8s/overlays/production
```

Что нужно проверить:

1. namespace равен `notary-portal`;
2. `NODE_ENV` равен `production`;
3. ingress host равен `notary.example.com`;
4. TLS issuer равен `letsencrypt-production`;
5. тестовый режим Robokassa отключен;
6. API стартует с `3` replicas;
7. Web стартует с `3` replicas;
8. API HPA может масштабироваться до `8`;
9. Web HPA может масштабироваться до `6`;
10. resource limits для Postgres увеличены.

Production overlay ожидает реальный secret с именем `notary-portal-secret`.

## Локальная Установка Через Helm

Рендер chart:

```bash
helm template notary-portal deploy/helm/notary-portal -f deploy/helm/notary-portal/values-local.yaml
```

Установка:

```bash
helm upgrade --install notary-portal deploy/helm/notary-portal \
  -n notary-portal \
  --create-namespace \
  -f deploy/helm/notary-portal/values-local.yaml
```

Проверка:

```bash
helm status notary-portal -n notary-portal
kubectl get pods,svc,ingress -n notary-portal
```

## Установка Helm Для Staging

Сначала создать secret:

```bash
kubectl create namespace notary-portal-staging --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n notary-portal-staging -f deploy/k8s/base/secret.example.yaml
```

Установка:

```bash
helm upgrade --install notary-portal deploy/helm/notary-portal \
  -n notary-portal-staging \
  -f deploy/helm/notary-portal/values-staging.yaml \
  --set api.image.tag=1.1.1-rc.2 \
  --set web.image.tag=1.1.1-rc.2
```

Ожидаемый результат:

- API deployment раскатывается с двумя начальными replicas;
- Web deployment раскатывается с двумя начальными replicas;
- migration hook выполняется перед install или upgrade;
- Ingress указывает на staging host;
- создаются HPA и PDB objects.

## Установка Helm Для Production

Production secrets создаются вне Git:

```bash
kubectl create namespace notary-portal --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic notary-portal-secret \
  -n notary-portal \
  --from-literal=DB_NAME=db \
  --from-literal=DB_USER=admin \
  --from-literal=DB_PASS='<replace>' \
  --from-literal=DATABASE_URL='postgresql://admin:<replace>@postgres:5432/db?schema=public' \
  --from-literal=JWT_ACCESS_SECRET='<replace>' \
  --from-literal=ROBOKASSA_MERCHANT_LOGIN='<replace>' \
  --from-literal=ROBOKASSA_PASSWORD_1='<replace>' \
  --from-literal=ROBOKASSA_PASSWORD_2='<replace>' \
  --from-literal=S3_ACCESS_KEY='<replace>' \
  --from-literal=S3_SECRET_KEY='<replace>'
```

Установка:

```bash
helm upgrade --install notary-portal deploy/helm/notary-portal \
  -n notary-portal \
  -f deploy/helm/notary-portal/values-production.yaml \
  --set api.image.tag=1.1.1 \
  --set web.image.tag=1.1.1
```

## Переменные GitLab CI Для Деплоя

| Переменная                    | Обязательность | Назначение                                        |
| ----------------------------- | -------------- | ------------------------------------------------- |
| `CI_REGISTRY`                 | да             | Registry host для Kaniko и Docker pull.           |
| `CI_REGISTRY_IMAGE`           | да             | Базовый registry path для API и Web images.       |
| `CI_REGISTRY_USER`            | да             | Пользователь registry.                            |
| `CI_REGISTRY_PASSWORD`        | да             | Пароль или token для registry.                    |
| `SONAR_HOST_URL`              | для Sonar      | Адрес SonarQube.                                  |
| `SONAR_TOKEN`                 | для Sonar      | Token для SonarQube Scanner.                      |
| `KUBE_CONFIG_B64`             | для deploy     | kubeconfig, закодированный в Base64.              |
| `KUBE_NAMESPACE`              | опционально    | По умолчанию `notary-portal`.                     |
| `KUBE_SECRET_MANIFEST`        | опционально    | Secret manifest, который применяет deploy job.    |
| `KUBE_ENABLE_MONITORING_CRDS` | опционально    | `true`, если есть Prometheus Operator CRDs.       |
| `CI_RUN_INTEGRATION_SMOKE`    | опционально    | Автоматически включает compose integration smoke. |

## Monitoring Objects

Kustomize base и Helm chart включают опциональные объекты Prometheus Operator:

- `ServiceMonitor` для `/metrics`;
- `PrometheusRule` для проверки доступности API target;
- `PrometheusRule` для всплесков failed access;
- правило по restart-событиям в kustomize base.

Если в кластере нет Prometheus Operator CRDs, нужно установить CRDs или отключить monitoring templates в Helm:

```bash
helm upgrade --install notary-portal deploy/helm/notary-portal \
  -n notary-portal \
  -f deploy/helm/notary-portal/values-local.yaml \
  --set monitoring.enabled=false
```

Для kustomize можно убрать `monitoring.yaml` из `deploy/k8s/base/kustomization.yaml`.

## NetworkPolicy

Network policies задают минимальный zero-trust baseline:

1. default deny для ingress и egress;
2. Web принимает HTTP traffic и может обращаться к API;
3. API принимает traffic от Web и ingress namespaces;
4. API может обращаться к Postgres, DNS, HTTP и HTTPS;
5. Postgres принимает traffic только от API и migration job.

Если CNI в кластере не поддерживает NetworkPolicy, объекты применятся, но правила не будут enforced.

## Rollback

Rollback через Helm:

```bash
helm history notary-portal -n notary-portal
helm rollback notary-portal <revision> -n notary-portal
```

Rollback через kustomize сменой image tag:

```bash
kubectl set image deployment/notary-api api=registry.example.com/notary-portal/notary-portal-api:<old-tag> -n notary-portal
kubectl set image deployment/notary-web web=registry.example.com/notary-portal/notary-portal-web:<old-tag> -n notary-portal
kubectl rollout status deployment/notary-api -n notary-portal
kubectl rollout status deployment/notary-web -n notary-portal
```

Если migrations несовместимы назад, сначала нужно остановиться и восстановить database backup, а уже потом откатывать application image.

## Чек-Лист Доказательств Релиза

Перед тем как считать релиз готовым:

1. Tag проходит `scripts/ci/validate-semver-tag.sh`.
2. Unit tests прошли.
3. Lint и stylelint прошли.
4. API build прошел.
5. Web build прошел.
6. API image собирается.
7. Web image собирается.
8. Container smoke проходит.
9. Trivy scan artifacts приложены.
10. CycloneDX image SBOM artifacts приложены.
11. Runtime SBOM актуален.
12. SonarQube analysis прикреплен, если настроены secrets.
13. Kustomize local overlay рендерится.
14. Helm chart рендерится для local values.
15. Deploy job имеет kubeconfig и registry variables.

## Диагностика Проблем

| Симптом                           | Вероятная причина                           | Что проверить                                                 |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `ImagePullBackOff`                | Кластер не может скачать registry image.    | Registry credentials и image tag.                             |
| migration job падает              | Нет `DATABASE_URL` или Prisma files.        | Secret и наличие `/app/prisma` внутри API image.              |
| API readiness fails               | App не подключается к Postgres или нет env. | API logs и secret values.                                     |
| Web показывает 502 на API paths   | Ingress или nginx routes не доходят до API. | Service names и endpoints.                                    |
| Prometheus objects не применяются | Нет CRDs.                                   | Установить Prometheus Operator CRDs или отключить monitoring. |
| HPA показывает unknown metrics    | В кластере нет metrics-server.              | Установить metrics-server.                                    |
| NetworkPolicy блокирует traffic   | CNI enforcing default deny.                 | Проверить labels или временно отключить NetworkPolicy.        |

## Очистка

Kustomize:

```bash
kubectl delete -k deploy/k8s/overlays/local
```

Helm:

```bash
helm uninstall notary-portal -n notary-portal
kubectl delete namespace notary-portal
```

Локальный Docker smoke:

```bash
docker compose -p notary-smoke -f apps/web/docker-compose.portal.yml down -v --remove-orphans
```
