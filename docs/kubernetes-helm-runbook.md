# Kubernetes and Helm Release Runbook

This runbook describes the operational flow added for the coursework CI/CD PR. It covers the kustomize demo manifests, the Helm chart, release tag rules, smoke checks, observability objects and rollback paths.

## Deployment Options

| Path                         | Directory                            | Best For                                                             |
| ---------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Kustomize local overlay      | `deploy/k8s/overlays/local`          | Fast demo on kind or minikube with local images.                     |
| Kustomize staging overlay    | `deploy/k8s/overlays/staging`        | Review of staging values, TLS annotations and higher replica counts. |
| Kustomize production overlay | `deploy/k8s/overlays/production`     | Review of production host, resources and HPA limits.                 |
| Helm chart                   | `deploy/helm/notary-portal`          | Reusable release install or upgrade flow.                            |
| GitLab CI deploy job         | `.gitlab-ci.yml` `deploy_kubernetes` | Tag-driven deploy from pushed container images.                      |

## Release Tag Contract

Container builds and deploy jobs are intentionally gated by tags.

Allowed:

```bash
1.1.1
1.1.1-rc.1
1.1.1-rc.2
2.0.0
```

Rejected:

```bash
v1.1.1
1.1
1.1.1-beta.1
01.1.1
1.01.1
1.1.01
```

Check locally:

```bash
bash scripts/ci/validate-semver-tag.sh 1.1.1-rc.2
bash scripts/ci/validate-semver-tag.sh v1.1.1
```

The second command should fail.

## Local Image Build

Build images before either kind/kustomize or Helm local install:

```bash
docker build -f apps/api/Dockerfile -t notary-portal-api:local .
docker build -f apps/web/Dockerfile -t notary-portal-web:local .
```

For kind:

```bash
kind load docker-image notary-portal-api:local
kind load docker-image notary-portal-web:local
```

For minikube:

```bash
minikube image load notary-portal-api:local
minikube image load notary-portal-web:local
```

## Kustomize Local Deploy

Render:

```bash
kubectl kustomize deploy/k8s/overlays/local
```

Apply:

```bash
kubectl apply -k deploy/k8s/overlays/local
kubectl get pods,svc,ingress -n notary-portal
```

Run migrations:

```bash
kubectl get jobs -n notary-portal
kubectl logs job/notary-prisma-migrate -n notary-portal
```

Check API:

```bash
kubectl port-forward -n notary-portal svc/api 3000:3000
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:3000/metrics | head
```

Check Web:

```bash
kubectl port-forward -n notary-portal svc/web 8080:80
curl -fsS http://localhost:8080/ | head
```

## Kustomize Staging Review

Render staging values:

```bash
kubectl kustomize deploy/k8s/overlays/staging
```

What to inspect:

1. namespace is `notary-portal-staging`;
2. `NODE_ENV` is `staging`;
3. ingress host is `notary-staging.example.com`;
4. TLS issuer is `letsencrypt-staging`;
5. API and Web replicas start from `2`;
6. HPA maximum is lower than production;
7. image repositories point to the placeholder registry path.

The staging overlay is not meant to be applied as-is to a real cluster until registry and secret values are replaced.

## Kustomize Production Review

Render production values:

```bash
kubectl kustomize deploy/k8s/overlays/production
```

What to inspect:

1. namespace is `notary-portal`;
2. `NODE_ENV` is `production`;
3. ingress host is `notary.example.com`;
4. TLS issuer is `letsencrypt-production`;
5. Robokassa test mode is disabled;
6. API starts at `3` replicas;
7. Web starts at `3` replicas;
8. API HPA can scale to `8`;
9. Web HPA can scale to `6`;
10. Postgres resource limits are increased.

Production overlay still expects a real secret named `notary-portal-secret`.

## Helm Local Install

Render the chart:

```bash
helm template notary-portal deploy/helm/notary-portal -f deploy/helm/notary-portal/values-local.yaml
```

Install:

```bash
helm upgrade --install notary-portal deploy/helm/notary-portal \
  -n notary-portal \
  --create-namespace \
  -f deploy/helm/notary-portal/values-local.yaml
```

Check:

```bash
helm status notary-portal -n notary-portal
kubectl get pods,svc,ingress -n notary-portal
```

## Helm Staging Install

Create the secret first:

```bash
kubectl create namespace notary-portal-staging --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n notary-portal-staging -f deploy/k8s/base/secret.example.yaml
```

Install:

```bash
helm upgrade --install notary-portal deploy/helm/notary-portal \
  -n notary-portal-staging \
  -f deploy/helm/notary-portal/values-staging.yaml \
  --set api.image.tag=1.1.1-rc.2 \
  --set web.image.tag=1.1.1-rc.2
```

Expected result:

- API deployment rolls out with two initial replicas;
- Web deployment rolls out with two initial replicas;
- migration hook runs before install or upgrade;
- Ingress points to the staging host;
- HPA and PDB objects are created.

## Helm Production Install

Create production secrets outside Git:

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

Install:

```bash
helm upgrade --install notary-portal deploy/helm/notary-portal \
  -n notary-portal \
  -f deploy/helm/notary-portal/values-production.yaml \
  --set api.image.tag=1.1.1 \
  --set web.image.tag=1.1.1
```

## GitLab CI Deploy Variables

| Variable                      | Required   | Purpose                                            |
| ----------------------------- | ---------- | -------------------------------------------------- |
| `CI_REGISTRY`                 | yes        | Registry host used by Kaniko and Docker pulls.     |
| `CI_REGISTRY_IMAGE`           | yes        | Base registry path for API and Web images.         |
| `CI_REGISTRY_USER`            | yes        | Registry login user.                               |
| `CI_REGISTRY_PASSWORD`        | yes        | Registry login password or token.                  |
| `SONAR_HOST_URL`              | for Sonar  | SonarQube endpoint.                                |
| `SONAR_TOKEN`                 | for Sonar  | SonarQube scanner token.                           |
| `KUBE_CONFIG_B64`             | for deploy | Base64 encoded kubeconfig.                         |
| `KUBE_NAMESPACE`              | optional   | Defaults to `notary-portal`.                       |
| `KUBE_SECRET_MANIFEST`        | optional   | Secret manifest applied by deploy job.             |
| `KUBE_ENABLE_MONITORING_CRDS` | optional   | Set to `true` when Prometheus Operator CRDs exist. |
| `CI_RUN_INTEGRATION_SMOKE`    | optional   | Enables compose integration smoke automatically.   |

## Monitoring Objects

The kustomize base and Helm chart include optional Prometheus Operator objects:

- `ServiceMonitor` for `/metrics`;
- `PrometheusRule` for API target availability;
- `PrometheusRule` for failed access spikes;
- restart-related rule in kustomize base.

If the cluster does not have Prometheus Operator CRDs, either install the CRDs or disable the monitoring templates in Helm:

```bash
helm upgrade --install notary-portal deploy/helm/notary-portal \
  -n notary-portal \
  -f deploy/helm/notary-portal/values-local.yaml \
  --set monitoring.enabled=false
```

For kustomize, remove `monitoring.yaml` from `deploy/k8s/base/kustomization.yaml` for clusters without the CRDs.

## Network Policy Expectations

Network policies implement a small zero-trust baseline:

1. default deny ingress and egress;
2. Web accepts HTTP traffic and can reach API;
3. API accepts traffic from Web and ingress namespaces;
4. API can reach Postgres, DNS, HTTP and HTTPS;
5. Postgres only accepts API and migration job traffic.

If the cluster uses a CNI without NetworkPolicy support, the objects are accepted but not enforced.

## Rollback

Helm rollback:

```bash
helm history notary-portal -n notary-portal
helm rollback notary-portal <revision> -n notary-portal
```

Kustomize rollback by image tag:

```bash
kubectl set image deployment/notary-api api=registry.example.com/notary-portal/notary-portal-api:<old-tag> -n notary-portal
kubectl set image deployment/notary-web web=registry.example.com/notary-portal/notary-portal-web:<old-tag> -n notary-portal
kubectl rollout status deployment/notary-api -n notary-portal
kubectl rollout status deployment/notary-web -n notary-portal
```

If migrations are not backward-compatible, stop and restore database backup before rolling back the application image.

## Release Evidence Checklist

Before marking a release ready:

1. Tag passes `scripts/ci/validate-semver-tag.sh`.
2. Unit tests pass.
3. Lint and stylelint pass.
4. API build passes.
5. Web build passes.
6. API image builds.
7. Web image builds.
8. Container smoke passes.
9. Trivy scan artifacts are present.
10. CycloneDX image SBOM artifacts are present.
11. Runtime SBOM is current.
12. SonarQube analysis is attached when secrets are configured.
13. Kustomize local overlay renders.
14. Helm chart renders for local values.
15. Deploy job has required kubeconfig and registry variables.

## Troubleshooting

| Symptom                          | Likely Cause                                   | Fix                                                               |
| -------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `ImagePullBackOff`               | Cluster cannot pull registry image.            | Check registry credentials and image tag.                         |
| migration job fails              | `DATABASE_URL` or Prisma files missing.        | Check secret and API image contains `/app/prisma`.                |
| API readiness fails              | App cannot connect to Postgres or missing env. | Check API logs and secret values.                                 |
| Web shows 502 on API paths       | Ingress or nginx routes cannot reach API.      | Check service names and endpoints.                                |
| Prometheus objects fail to apply | CRDs are missing.                              | Install Prometheus Operator CRDs or disable monitoring.           |
| HPA shows unknown metrics        | Metrics server is missing.                     | Install metrics-server in the cluster.                            |
| NetworkPolicy blocks traffic     | CNI enforces default deny.                     | Check labels and temporarily disable NetworkPolicy for diagnosis. |

## Cleanup

Kustomize:

```bash
kubectl delete -k deploy/k8s/overlays/local
```

Helm:

```bash
helm uninstall notary-portal -n notary-portal
kubectl delete namespace notary-portal
```

Local Docker smoke:

```bash
docker compose -p notary-smoke -f apps/web/docker-compose.portal.yml down -v --remove-orphans
```
