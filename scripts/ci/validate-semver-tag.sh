#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-${CI_COMMIT_TAG:-}}"
TAG_PATTERN='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-rc\.(0|[1-9][0-9]*))?$'

if [[ -z "$TAG" ]]; then
  echo "CI_COMMIT_TAG is empty. Container release jobs require a Git tag." >&2
  exit 1
fi

if [[ ! "$TAG" =~ $TAG_PATTERN ]]; then
  echo "Invalid release tag: $TAG" >&2
  echo "Allowed examples: 1.2.3, 1.2.3-rc.1" >&2
  exit 1
fi

echo "Release tag is valid: $TAG"
