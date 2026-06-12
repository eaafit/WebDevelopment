#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/apps/web/docker-compose.portal.yml"
ENV_FILE="$ROOT_DIR/apps/web/.env.portal"
PROJECT_NAME="${SMOKE_COMPOSE_PROJECT:-notary-smoke}"
CREATED_ENV_FILE=0

write_smoke_env() {
  cat > "$ENV_FILE" <<'EOF'
DATABASE_URL=postgresql://admin:admin@postgres:5432/db?schema=public
JWT_ACCESS_SECRET=smoke-local-secret-change-in-production
CORS_ORIGIN=http://localhost
FRONTEND_URL=http://localhost
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
FIAS_PROVIDER=stub
MAIL_TRANSPORT=log
PAYMENT_PROVIDER=robokassa
ROBOKASSA_MERCHANT_LOGIN=Test1999
ROBOKASSA_PASSWORD_1=password_1
ROBOKASSA_PASSWORD_2=password_2
ROBOKASSA_TEST_MODE=true
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
S3_BUCKET_PAYMENT_DOCUMENTS=payment-documents
S3_BUCKET_ASSESSMENT_FILES=assessment-files
EOF
}

cleanup() {
  if [[ "${KEEP_SMOKE_STACK:-0}" != "1" ]]; then
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down -v --remove-orphans || true
  fi
  if [[ "$CREATED_ENV_FILE" == "1" ]]; then
    rm -f "$ENV_FILE"
  fi
}
trap cleanup EXIT

if [[ ! -f "$ENV_FILE" ]]; then
  write_smoke_env
  CREATED_ENV_FILE=1
fi

docker network create proxy >/dev/null 2>&1 || true

docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build postgres api portal
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile migrate run --rm migrate

wait_for_portal() {
  local path="$1"
  local expected="$2"

  for _ in $(seq 1 60); do
    if docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" exec -T portal wget -qO- "http://localhost${path}" | grep -q "$expected"; then
      return 0
    fi
    sleep 2
  done

  docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" logs api portal
  return 1
}

wait_for_portal /health '"status":"ok"'
wait_for_portal /metrics 'notary_'
wait_for_portal / '<app-root'

echo "Integration smoke passed: portal, API health and Prometheus metrics are reachable."
