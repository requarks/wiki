#!/usr/bin/env bash
#
# Ensure local Wiki.js dev stack is running:
#   DB   -> dev/examples   (Postgres, network: examples_default)
#   Wiki -> dev/containers (source dev server on :3000, container: wiki-app)
#
# dev/deploy is the production stack (droplet). Do not use it for local dev.
#
# Usage:
#   dev/scripts/start-local-wiki.sh              # start db + wiki (detached)
#   dev/scripts/start-local-wiki.sh --recreate   # force-recreate wiki container
#   dev/scripts/start-local-wiki.sh --attach   # start db, then wiki in foreground
#   dev/scripts/start-local-wiki.sh --status     # show container status
#   dev/scripts/start-local-wiki.sh --stop       # stop wiki + db
#
# Options:
#   --recreate    Pass --force-recreate to wiki compose up
#   --attach,-f   Foreground wiki logs (docker compose up wiki)
#   --detach,-d   Detached mode (default)
#   --db-only     Start or ensure Postgres only
#   --wiki-only   Start wiki only (db must already be running)
#   --stop        Stop wiki and db services
#   --status      Print service status and exit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXAMPLES_DIR="${REPO_ROOT}/dev/examples"
CONTAINERS_DIR="${REPO_ROOT}/dev/containers"

DB_SERVICE="db"
WIKI_SERVICE="wiki"
WIKI_CONTAINER="wiki-app"
EXAMPLES_NETWORK="examples_default"
DB_WAIT_SECONDS=60
DB_WAIT_INTERVAL=2

RECREATE=false
ATTACH=false
DB_ONLY=false
WIKI_ONLY=false
STOP=false
STATUS=false

usage() {
  sed -n '3,22p' "$0" | sed 's/^# \{0,1\}//'
}

log() {
  printf '[start-local-wiki] %s\n' "$*"
}

fail() {
  printf '[start-local-wiki] ERROR: %s\n' "$*" >&2
  exit 1
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

wiki_compose_file() {
  if [[ -f "${CONTAINERS_DIR}/docker-compose.local.yml" ]]; then
    echo "${CONTAINERS_DIR}/docker-compose.local.yml"
  else
    echo "${CONTAINERS_DIR}/docker-compose.yml"
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --recreate) RECREATE=true ;;
      --attach|-f) ATTACH=true ;;
      --detach|-d) ATTACH=false ;;
      --db-only) DB_ONLY=true ;;
      --wiki-only) WIKI_ONLY=true ;;
      --stop) STOP=true ;;
      --status) STATUS=true ;;
      -h|--help) usage; exit 0 ;;
      *) fail "Unknown option: $1 (use --help)" ;;
    esac
    shift
  done
}

require_docker() {
  command -v docker >/dev/null 2>&1 || fail "docker is not installed or not on PATH"
  docker info >/dev/null 2>&1 || fail "docker daemon is not running"
}

container_running() {
  docker ps --format '{{.Names}}' | grep -qx "$1"
}

ensure_examples_network() {
  if ! docker network inspect "$EXAMPLES_NETWORK" >/dev/null 2>&1; then
    fail "Docker network ${EXAMPLES_NETWORK} not found. Start the db first: cd dev/examples && docker compose up -d db"
  fi
}

start_db() {
  log "Ensuring Postgres is up (${EXAMPLES_DIR})"
  (
    cd "$EXAMPLES_DIR"
    compose up -d "$DB_SERVICE"
  )
}

wait_for_db() {
  log "Waiting for Postgres to accept connections (up to ${DB_WAIT_SECONDS}s)"
  local elapsed=0
  while [[ "$elapsed" -lt "$DB_WAIT_SECONDS" ]]; do
    if (
      cd "$EXAMPLES_DIR"
      compose exec -T "$DB_SERVICE" pg_isready -U wikijs -d wiki >/dev/null 2>&1
    ); then
      log "Postgres is ready"
      return 0
    fi
    sleep "$DB_WAIT_INTERVAL"
    elapsed=$((elapsed + DB_WAIT_INTERVAL))
  done
  fail "Postgres did not become ready within ${DB_WAIT_SECONDS}s"
}

start_wiki_detached() {
  local compose_file
  compose_file="$(wiki_compose_file)"
  log "Starting wiki detached (${compose_file})"
  local up_args=(up -d)
  if [[ "$RECREATE" == true ]]; then
    up_args+=(--force-recreate)
  fi
  up_args+=("$WIKI_SERVICE")
  (
    cd "$CONTAINERS_DIR"
    compose -f "$compose_file" "${up_args[@]}"
  )
}

start_wiki_attached() {
  local compose_file
  compose_file="$(wiki_compose_file)"
  log "Starting wiki in foreground (${compose_file})"
  local up_args=(up)
  if [[ "$RECREATE" == true ]]; then
    up_args+=(--force-recreate)
  fi
  up_args+=("$WIKI_SERVICE")
  (
    cd "$CONTAINERS_DIR"
    compose -f "$compose_file" "${up_args[@]}"
  )
}

stop_services() {
  local compose_file
  compose_file="$(wiki_compose_file)"
  log "Stopping wiki (${CONTAINERS_DIR})"
  (
    cd "$CONTAINERS_DIR"
    compose -f "$compose_file" stop "$WIKI_SERVICE" 2>/dev/null || true
    compose -f "$compose_file" rm -f "$WIKI_SERVICE" 2>/dev/null || true
  )
  log "Stopping db (${EXAMPLES_DIR})"
  (
    cd "$EXAMPLES_DIR"
    compose stop "$DB_SERVICE" 2>/dev/null || true
  )
  log "Stopped"
}

print_status() {
  local compose_file
  compose_file="$(wiki_compose_file)"
  printf '\n--- dev/examples (db) ---\n'
  (
    cd "$EXAMPLES_DIR"
    compose ps
  ) || true
  printf '\n--- dev/containers (wiki) ---\n'
  (
    cd "$CONTAINERS_DIR"
    compose -f "$compose_file" ps
  ) || true
  printf '\nURLs:\n'
  printf '  Wiki:    http://localhost:3000\n'
  printf '  Adminer: http://localhost:3001\n'
  if container_running "$WIKI_CONTAINER"; then
    printf '\nWiki container %s is running.\n' "$WIKI_CONTAINER"
  else
    printf '\nWiki container %s is not running.\n' "$WIKI_CONTAINER"
  fi
}

main() {
  parse_args "$@"
  require_docker

  if [[ "$STATUS" == true ]]; then
    print_status
    exit 0
  fi

  if [[ "$STOP" == true ]]; then
    stop_services
    exit 0
  fi

  if [[ "$DB_ONLY" == true && "$WIKI_ONLY" == true ]]; then
    fail "Use either --db-only or --wiki-only, not both"
  fi

  if [[ "$WIKI_ONLY" != true ]]; then
    start_db
    wait_for_db
  else
    ensure_examples_network
  fi

  if [[ "$DB_ONLY" == true ]]; then
    log "DB-only mode; skipping wiki"
    print_status
    exit 0
  fi

  ensure_examples_network

  if [[ "$ATTACH" == true ]]; then
    start_wiki_attached
  else
    start_wiki_detached
    print_status
    log "Done. Wiki dev server bootstraps via dev/scripts/start-wiki-dev.sh inside the container."
  fi
}

main "$@"
