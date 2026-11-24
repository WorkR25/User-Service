#!/usr/bin/env bash
# deploy/deploy.sh - deploy WorkR User-Service on the shared WorkR server
# (this server also runs notification-service + Redis; see deploy/README.md).
#
#   ./deploy/deploy.sh              pull main, build, migrate, restart, health-check, auto-rollback
#   ./deploy/deploy.sh rollback     go back to the previous image
#   ./deploy/deploy.sh --help
set -euo pipefail

SERVICE="user-service"            # compose service name
CONTAINER="workr-user-service"    # container_name in docker-compose.yml
IMAGE="workr/user-service"        # image in docker-compose.yml

# Must be present and non-empty in deploy/.env.production
REQUIRED_ENV=(DB_HOST DB_USER DB_PASSWORD DB_NAME SALT JWT_SECRET FRONTEND_URL
              AWS_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_S3_BUCKET_NAME)
# Must not be localhost (inside a container that is the container itself)
NOT_LOOPBACK_ENV=(DB_HOST)

extra_preflight() {
  if [[ "$(env_value NOTIFICATIONS_ENABLED)" == "true" || "$(env_value LEAD_NURTURE_SCHEDULER_ENABLED)" == "true" ]]; then
    local redis_host
    redis_host="$(env_value REDIS_HOST)"
    [[ -n "$redis_host" ]] || die "REDIS_HOST is required while notifications / the nurture scheduler are enabled"
    case "$redis_host" in localhost|127.*|::1) die "REDIS_HOST=$redis_host is the container itself - use workr-redis" ;; esac
    if [[ "$redis_host" == "workr-redis" ]]; then
      [[ "$(docker inspect -f '{{.State.Running}}' workr-redis 2>/dev/null || true)" == "true" ]] \
        || die "workr-redis is not running. Deploy notification-service first - it owns Redis."
    fi
  fi
  if [[ "$(env_value LEAD_NURTURE_SCHEDULER_ENABLED)" == "true" ]]; then
    if [[ "$(env_value LEAD_NURTURE_DRY_RUN)" == "false" ]]; then
      warn "Lead nurture scheduler is ON and LIVE (LEAD_NURTURE_DRY_RUN=false): real emails/WhatsApp will be sent"
    else
      warn "Lead nurture scheduler is ON in DRY-RUN mode: it only logs what it would send"
    fi
  fi
}

pre_deploy() { :; }

# =============================================================================
# Common deploy logic (identical in every WorkR repo - only the block above differs)
# =============================================================================
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$DEPLOY_DIR")"
ENV_FILE="$DEPLOY_DIR/.env.production"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.yml")

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mxx  %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<USAGE
Usage: deploy/deploy.sh [command] [options]

Commands:
  deploy     (default) pull code, build, migrate, restart, health-check, auto-rollback
  rollback   switch back to the previous image (database migrations are NOT reverted)
  status     show the running container, its git revision and health
  logs       follow the container logs

Options (deploy):
  --no-pull        deploy the code that is already checked out (skip git pull)
  --skip-migrate   do not run database migrations

Environment:
  DEPLOY_BRANCH    branch to deploy (default: main)
  HEALTH_TIMEOUT   seconds to wait for the container to become healthy (default: 120)
USAGE
}

# Reads KEY from .env.production (last assignment wins, surrounding quotes stripped)
env_value() {
  grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- \
    | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/" || true
}

preflight() {
  command -v docker >/dev/null 2>&1 || die "docker is not installed on this server"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 plugin is missing (docker compose version failed)"
  docker info >/dev/null 2>&1 || die "cannot reach the docker daemon - is this user in the 'docker' group? (or run with sudo)"
  [[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE - copy deploy/env.production.example to deploy/.env.production and fill it in"

  local k v missing=()
  for k in "${REQUIRED_ENV[@]}"; do
    v="$(env_value "$k")"
    [[ -n "$v" ]] || missing+=("$k")
  done
  (( ${#missing[@]} == 0 )) || die "empty or missing in deploy/.env.production: ${missing[*]}"

  if grep -vE '^\s*#' "$ENV_FILE" | grep -q 'CHANGE_ME'; then
    die "deploy/.env.production still contains CHANGE_ME placeholders"
  fi

  for k in "${NOT_LOOPBACK_ENV[@]}"; do
    case "$(env_value "$k")" in
      localhost|127.*|0.0.0.0|::1)
        die "$k points at localhost. Inside a container that is the container itself. Use the real host name, or host.docker.internal when the service runs on this server." ;;
    esac
  done

  extra_preflight
}

lock() {
  command -v flock >/dev/null 2>&1 || return 0
  exec 9>"/tmp/workr-deploy-${SERVICE}.lock"
  flock -n 9 || die "another deploy of $SERVICE is already running"
}

ensure_network() {
  docker network inspect workr-net >/dev/null 2>&1 || {
    log "Creating docker network workr-net"
    docker network create workr-net >/dev/null
  }
}

update_code() {
  if [[ ! -d "$REPO_DIR/.git" ]]; then
    warn "$REPO_DIR is not a git checkout - skipping git pull"
    return 0
  fi
  log "Updating code (branch: $DEPLOY_BRANCH)"
  git -C "$REPO_DIR" fetch --prune origin
  git -C "$REPO_DIR" checkout "$DEPLOY_BRANCH"
  git -C "$REPO_DIR" pull --ff-only origin "$DEPLOY_BRANCH"
}

container_state() {
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER" 2>/dev/null || echo missing
}

wait_healthy() {
  local deadline=$(( SECONDS + HEALTH_TIMEOUT )) state
  printf 'Waiting for %s to become healthy' "$CONTAINER"
  while (( SECONDS < deadline )); do
    state="$(container_state)"
    case "$state" in
      healthy) printf ' - healthy\n'; return 0 ;;
      unhealthy|exited|dead|missing) printf ' - %s\n' "$state"; return 1 ;;
    esac
    printf '.'
    sleep 3
  done
  printf ' - timed out after %ss\n' "$HEALTH_TIMEOUT"
  return 1
}

do_rollback() {
  docker image inspect "$IMAGE:previous" >/dev/null 2>&1 || die "no previous image ($IMAGE:previous) to roll back to"
  log "Rolling back to $IMAGE:previous"
  docker tag "$IMAGE:previous" "$IMAGE:latest"
  "${COMPOSE[@]}" up -d --no-build --force-recreate "$SERVICE"
  wait_healthy || die "rollback image is not healthy either - check: docker logs $CONTAINER"
  log "Rolled back. NOTE: database migrations were not reverted."
}

do_deploy() {
  local pull=1 migrate=1 arg
  for arg in "$@"; do
    case "$arg" in
      --no-pull) pull=0 ;;
      --skip-migrate) migrate=0 ;;
      *) die "unknown option: $arg (see --help)" ;;
    esac
  done

  preflight
  lock
  ensure_network
  (( pull )) && update_code
  GIT_SHA="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  export GIT_SHA
  log "Deploying $SERVICE @ $GIT_SHA"

  # Keep the currently running image so a failed deploy can be rolled back
  if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
    docker tag "$IMAGE:latest" "$IMAGE:previous"
  fi

  log "Building images"
  "${COMPOSE[@]}" --profile migrate build --pull

  pre_deploy

  if (( migrate )); then
    log "Running database migrations"
    "${COMPOSE[@]}" --profile migrate run --rm migrate \
      || die "Migration failed - the running $SERVICE was NOT touched. Fix it and re-run."
  else
    warn "Skipping migrations (--skip-migrate)"
  fi

  log "Starting $SERVICE"
  "${COMPOSE[@]}" up -d --no-build "$SERVICE"

  if ! wait_healthy; then
    warn "New version is unhealthy. Last logs:"
    docker logs --tail 60 "$CONTAINER" 2>&1 || true
    if docker image inspect "$IMAGE:previous" >/dev/null 2>&1; then
      do_rollback
    fi
    die "Deploy of $SERVICE @ $GIT_SHA FAILED (rolled back to the previous image if one existed)"
  fi

  docker image prune -f >/dev/null 2>&1 || true
  log "Deployed $SERVICE @ $GIT_SHA"
  do_status
}

do_status() {
  docker ps -a --filter "name=^/${CONTAINER}$" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  printf 'revision: %s\n' "$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$CONTAINER" 2>/dev/null || echo n/a)"
}

cmd="${1:-deploy}"
case "$cmd" in
  deploy)   shift || true; do_deploy "$@" ;;
  rollback) preflight; lock; do_rollback ;;
  status)   do_status ;;
  logs)     "${COMPOSE[@]}" logs -f --tail=200 "$SERVICE" ;;
  -h|--help|help) usage ;;
  --*)      do_deploy "$@" ;;
  *)        usage; exit 1 ;;
esac
