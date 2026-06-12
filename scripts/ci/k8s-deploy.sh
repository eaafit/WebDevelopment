#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KUBE_NAMESPACE="${KUBE_NAMESPACE:-notary-portal}"
IMAGE_TAG="${CI_COMMIT_TAG:-local}"
API_IMAGE_REPOSITORY="${API_IMAGE_REPOSITORY:-${CI_REGISTRY_IMAGE:-notary-portal}/notary-portal-api}"
WEB_IMAGE_REPOSITORY="${WEB_IMAGE_REPOSITORY:-${CI_REGISTRY_IMAGE:-notary-portal}/notary-portal-web}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ -n "${KUBE_CONFIG_B64:-}" ]]; then
  export KUBECONFIG="$TMP_DIR/kubeconfig"
  echo "$KUBE_CONFIG_B64" | base64 -d > "$KUBECONFIG"
fi

kubectl create namespace "$KUBE_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

cp "$ROOT_DIR"/deploy/k8s/base/*.yaml "$TMP_DIR"/
rm -f "$TMP_DIR/namespace.yaml" "$TMP_DIR/secret.example.yaml"

MONITORING_RESOURCE=""
if [[ "${KUBE_ENABLE_MONITORING_CRDS:-false}" == "true" ]]; then
  MONITORING_RESOURCE="  - monitoring.yaml"
fi

cat > "$TMP_DIR/kustomization.yaml" <<EOF
resources:
  - serviceaccount.yaml
  - configmap.yaml
  - postgres.yaml
  - api.yaml
  - web.yaml
  - ingress.yaml
  - migrate-job.yaml
  - hpa.yaml
  - pdb.yaml
  - networkpolicy.yaml
${MONITORING_RESOURCE}
namespace: ${KUBE_NAMESPACE}
images:
  - name: notary-portal-api
    newName: ${API_IMAGE_REPOSITORY}
    newTag: ${IMAGE_TAG}
  - name: notary-portal-web
    newName: ${WEB_IMAGE_REPOSITORY}
    newTag: ${IMAGE_TAG}
EOF

if [[ -n "${KUBE_SECRET_MANIFEST:-}" ]]; then
  kubectl apply -n "$KUBE_NAMESPACE" -f "$KUBE_SECRET_MANIFEST"
else
  echo "KUBE_SECRET_MANIFEST is not set; expecting notary-portal-secret to exist in namespace $KUBE_NAMESPACE."
fi

kubectl apply -k "$TMP_DIR"
kubectl rollout status -n "$KUBE_NAMESPACE" deployment/notary-api --timeout=180s
kubectl rollout status -n "$KUBE_NAMESPACE" deployment/notary-web --timeout=180s
