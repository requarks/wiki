#!/usr/bin/env bash
# Roll back Wiki.js to the previous image and prune unused wiki images.
# Usage:
#   ./rollback-wiki.sh           # restore previous image from last deploy
#   ./rollback-wiki.sh --cleanup # rollback + remove unused wiki images

set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/kayesh/wiki}"
COMPOSE_DIR="${COMPOSE_DIR:-/root}"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
ENV_FILE="${COMPOSE_DIR}/.env"
STATE_DIR="${COMPOSE_DIR}/.wiki-deploy"
STATE_FILE="${STATE_DIR}/state.env"
REPORT_FILE="${STATE_DIR}/last-rollback-report.txt"
DO_CLEANUP=false

if [[ "${1:-}" == "--cleanup" ]]; then
  DO_CLEANUP=true
fi

log() {
  echo "[rollback-wiki] $*"
}

fail() {
  echo "[rollback-wiki] ERROR: $*" >&2
  exit 1
}

[[ -f "$STATE_FILE" ]] || fail "No deployment state found at ${STATE_FILE}. Nothing to roll back."

# shellcheck disable=SC1090
source "$STATE_FILE"

[[ -n "${PREVIOUS_IMAGE:-}" ]] || fail "PREVIOUS_IMAGE is empty in ${STATE_FILE}"
[[ -n "${CURRENT_IMAGE:-}" ]] || fail "CURRENT_IMAGE is empty in ${STATE_FILE}"

compose_cmd() {
  docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

log "Rolling back from ${CURRENT_IMAGE} to ${PREVIOUS_IMAGE}"

if [[ -n "${COMPOSE_BACKUP:-}" && -f "$COMPOSE_BACKUP" ]]; then
  cp -a "$COMPOSE_BACKUP" "$COMPOSE_FILE"
fi

if [[ -n "${ENV_BACKUP:-}" && -f "$ENV_BACKUP" ]]; then
  cp -a "$ENV_BACKUP" "$ENV_FILE"
else
  echo "WIKI_IMAGE=${PREVIOUS_IMAGE}" > "$ENV_FILE"
fi

docker pull "$PREVIOUS_IMAGE" || log "Warning: could not pull ${PREVIOUS_IMAGE}; using local copy if present"

cd "$COMPOSE_DIR"
compose_cmd up -d wiki

for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/healthz >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

health_code="$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/healthz || echo "000")"
[[ "$health_code" == "200" ]] || fail "Rollback health check failed (HTTP ${health_code})"

if [[ "$DO_CLEANUP" == true ]]; then
  log "Removing failed/current wiki image: ${CURRENT_IMAGE}"
  docker rmi "$CURRENT_IMAGE" 2>/dev/null || true
  log "Pruning dangling images..."
  docker image prune -f
  log "Removing unused ${REGISTRY} images (keeping running image)..."
  running_image="$(docker inspect wiki --format '{{.Config.Image}}')"
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    img_id="$(echo "$line" | awk '{print $3}')"
    repo_tag="$(echo "$line" | awk '{print $1":"$2}')"
    [[ "$repo_tag" == "$running_image" ]] && continue
    docker rmi "$repo_tag" 2>/dev/null || true
  done < <(docker images "$REGISTRY" --format '{{.Repository}} {{.Tag}} {{.ID}}')
fi

cat > "$STATE_FILE" <<EOF
PREVIOUS_IMAGE=${CURRENT_IMAGE}
CURRENT_IMAGE=${PREVIOUS_IMAGE}
DEPLOYED_AT=$(date -u +%Y%m%dT%H%M%SZ)
ROLLED_BACK_FROM=${CURRENT_IMAGE}
EOF

{
  echo "Wiki.js rollback report"
  echo "====================="
  echo "Rolled back from:  ${CURRENT_IMAGE}"
  echo "Rolled back to:    ${PREVIOUS_IMAGE}"
  echo "Cleanup performed: ${DO_CLEANUP}"
  echo ""
  docker ps --filter name='^wiki$' --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
  echo ""
  echo "healthz -> ${health_code}"
} | tee "$REPORT_FILE"

log "Rollback complete."
log "Report saved to ${REPORT_FILE}"
