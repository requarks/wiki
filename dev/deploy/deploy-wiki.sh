#!/usr/bin/env bash
# Deploy Wiki.js on the production droplet.
# Usage:
#   ./deploy-wiki.sh              # pull ghcr.io/kayesh/wiki:latest
#   ./deploy-wiki.sh 2.5.315-beta # pull a specific tag
#
# Environment overrides:
#   COMPOSE_DIR=/root  REGISTRY=ghcr.io/kayesh/wiki

set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/kayesh/wiki}"
COMPOSE_DIR="${COMPOSE_DIR:-/root}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
ENV_FILE="${COMPOSE_DIR}/.env"
STATE_DIR="${COMPOSE_DIR}/.wiki-deploy"
STATE_FILE="${STATE_DIR}/state.env"
BACKUP_DIR="${STATE_DIR}/backups"
REPORT_FILE="${STATE_DIR}/last-deploy-report.txt"

IMAGE_TAG="${1:-latest}"
FULL_IMAGE="${REGISTRY}:${IMAGE_TAG}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

log() {
  echo "[deploy-wiki] $*"
}

fail() {
  echo "[deploy-wiki] ERROR: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

read_current_image() {
  if docker inspect wiki >/dev/null 2>&1; then
    docker inspect wiki --format '{{.Config.Image}}'
    return
  fi

  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    if [[ -n "${WIKI_IMAGE:-}" ]]; then
      echo "$WIKI_IMAGE"
      return
    fi
  fi

  if [[ -f "$COMPOSE_FILE" ]]; then
    awk '
      /^[[:space:]]*wiki:/ { in_wiki=1; next }
      in_wiki && /^[[:space:]]{2}[A-Za-z0-9_-]+:/ && !/^[[:space:]]*wiki:/ { exit }
      in_wiki && /^[[:space:]]*image:/ {
        sub(/^[[:space:]]*image:[[:space:]]*/, "")
        gsub(/"/, "")
        print
        exit
      }
    ' "$COMPOSE_FILE"
  fi
}

compose_cmd() {
  docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

write_state() {
  mkdir -p "$STATE_DIR" "$BACKUP_DIR"
  cat > "$STATE_FILE" <<EOF
PREVIOUS_IMAGE=${PREVIOUS_IMAGE:-}
CURRENT_IMAGE=${FULL_IMAGE}
DEPLOYED_AT=${TIMESTAMP}
IMAGE_TAG=${IMAGE_TAG}
COMPOSE_BACKUP=${COMPOSE_BACKUP:-}
ENV_BACKUP=${ENV_BACKUP:-}
EOF
}

run_health_checks() {
  local code
  code="$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/healthz || echo "000")"
  [[ "$code" == "200" ]] || fail "healthz returned HTTP ${code}"

  code="$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo "000")"
  [[ "$code" == "200" || "$code" == "302" ]] || fail "home page returned HTTP ${code}"
}

write_report() {
  mkdir -p "$STATE_DIR"
  {
    echo "Wiki.js deployment report"
    echo "======================="
    echo "Time (UTC):        ${TIMESTAMP}"
    echo "Previous image:    ${PREVIOUS_IMAGE:-<none>}"
    echo "Deployed image:    ${FULL_IMAGE}"
    echo "Compose dir:       ${COMPOSE_DIR}"
    echo ""
    echo "Running containers:"
    docker ps --filter name='^wiki$' --filter name='^db$' --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
    echo ""
    echo "Health checks:"
    echo "  /healthz -> $(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/healthz || echo FAIL)"
    echo "  /        -> $(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo FAIL)"
    echo ""
    echo "Disk:"
    df -h / | tail -1
    echo ""
    echo "Wiki images on host:"
    docker images "${REGISTRY}" --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}'
  } | tee "$REPORT_FILE"
}

require_cmd docker
require_cmd curl

[[ -d "$COMPOSE_DIR" ]] || fail "Compose directory not found: ${COMPOSE_DIR}"

PREVIOUS_IMAGE="$(read_current_image || true)"
log "Current image: ${PREVIOUS_IMAGE:-<unknown>}"
log "Target image:  ${FULL_IMAGE}"

mkdir -p "$BACKUP_DIR"
COMPOSE_BACKUP="${BACKUP_DIR}/docker-compose.yml.${TIMESTAMP}"
ENV_BACKUP="${BACKUP_DIR}/.env.${TIMESTAMP}"

if [[ -f "$COMPOSE_FILE" ]]; then
  cp -a "$COMPOSE_FILE" "$COMPOSE_BACKUP"
else
  log "Installing compose file from ${SCRIPT_DIR}/docker-compose.yml"
  cp -a "${SCRIPT_DIR}/docker-compose.yml" "$COMPOSE_FILE"
fi

if [[ -f "$ENV_FILE" ]]; then
  cp -a "$ENV_FILE" "$ENV_BACKUP"
fi

echo "WIKI_IMAGE=${FULL_IMAGE}" > "$ENV_FILE"

log "Pulling ${FULL_IMAGE}..."
docker pull "$FULL_IMAGE"

log "Restarting wiki container..."
cd "$COMPOSE_DIR"
compose_cmd up -d wiki

log "Waiting for wiki to become healthy..."
for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/healthz >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

run_health_checks
write_state
write_report

log "Deployment complete."
log "Report saved to ${REPORT_FILE}"
