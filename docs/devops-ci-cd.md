# CI/CD, SonarQube, Gitea MCP and Kubernetes

This repository uses Nx, pnpm, Docker and Kubernetes manifests to demonstrate a full DevOps delivery path for the Notary Portal.

## Pipeline Layout

The GitLab pipeline mirrors the classroom example:

1. `test` - unit tests and optional Docker Compose integration smoke.
2. `code_quality` - ESLint, Stylelint and SonarQube Scanner.
3. `build` - SemVer tag validation and Kaniko container builds.
4. `test_image` - pull and smoke-check the built API and Web images.
5. `security_scan` - Trivy vulnerability reports and CycloneDX SBOM files.
6. `deploy` - Kubernetes deploy with kustomize and `kubectl`.

Release container jobs run only for valid tags:

```bash
bash scripts/ci/validate-semver-tag.sh 1.2.3
bash scripts/ci/validate-semver-tag.sh 1.2.3-rc.1
```

Invalid examples such as `v1.2.3`, `1.2`, `1.2.3-beta.1` and `01.2.3` are rejected.

## Local Verification

Run the same commands used by CI:

```bash
pnpm exec nx run-many -t test --parallel=3 --ci --coverage
pnpm exec nx affected -t lint stylelint --parallel=3
pnpm exec nx build api && pnpm exec nx build web
docker build -f apps/api/Dockerfile -t notary-portal-api:test .
docker build -f apps/web/Dockerfile -t notary-portal-web:test .
bash scripts/ci/integration-smoke.sh
```

The integration smoke uses `apps/web/docker-compose.portal.yml`, creates a separate Compose project named `notary-smoke`, runs Prisma migrations, and checks:

- `/health` through nginx;
- `/metrics` through nginx;
- the Angular shell from `/`.

Set `KEEP_SMOKE_STACK=1` to keep the containers after the smoke run.

## SonarQube and Gitea MCP

Start the local DevOps lab:

```bash
docker compose -f devops/docker-compose.devops.yml up -d --build
```

Services:

- SonarQube: `http://localhost:9000`
- Gitea: `http://localhost:3002`
- Gitea MCP SSE endpoint: `http://localhost:8080/sse`

Create a Gitea access token in `Settings -> Applications`, then restart MCP with:

```bash
GITEA_MCP_TOKEN=<token> docker compose -f devops/docker-compose.devops.yml up -d --build gitea-mcp
```

The MCP server follows the official Gitea SSE mode:

```bash
gitea-mcp -t sse --host http://gitea:3000 --token <token>
```

## Kubernetes Demo

Build local images first:

```bash
docker build -f apps/api/Dockerfile -t notary-portal-api:local .
docker build -f apps/web/Dockerfile -t notary-portal-web:local .
kubectl kustomize deploy/k8s/overlays/local
kubectl apply -k deploy/k8s/overlays/local
kubectl get pods,svc,ingress -n notary-portal
```

`kubectl apply` requires a running local cluster such as kind or minikube. For kind, load the local images before applying:

```bash
kind load docker-image notary-portal-api:local
kind load docker-image notary-portal-web:local
```

The local overlay includes a demo secret with non-production values. For real clusters, create a secret from `deploy/k8s/base/secret.example.yaml` and deploy through CI.

Required GitLab variables for deployment:

- `CI_REGISTRY`, `CI_REGISTRY_IMAGE`, `CI_REGISTRY_USER`, `CI_REGISTRY_PASSWORD`
- `SONAR_HOST_URL`, `SONAR_TOKEN`
- `KUBE_CONFIG_B64`
- `KUBE_NAMESPACE` (defaults to `notary-portal`)
- `KUBE_SECRET_MANIFEST` if the cluster secret should be applied by CI

The deploy job decodes `KUBE_CONFIG_B64`, applies kustomize manifests, rewrites API/Web images to the release tag, and waits for both deployments.
