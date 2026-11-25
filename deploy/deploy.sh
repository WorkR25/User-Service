#!/usr/bin/env bash
# deploy/deploy.sh - deploy WorkR User-Service (pm2) on its server.
#
#   ./deploy/deploy.sh              pull main, install deps if needed, build, migrate, restart pm2, health-check, auto-rollback
#   ./deploy/deploy.sh rollback     put the previous build back
#   ./deploy/deploy.sh --help
set -euo pipefail

LABEL="User-Service"
PM2_DEFAULT_NAME="workr-user"      # only used when no pm2 process runs this repo yet
ENTRY="dist/server.js"             # pm2 script, relative to the repo root
HEALTH_PATH="/health"
REPO_UP=".."                       # repo root relative to deploy/

# Must be present and non-empty in .env
REQUIRED_ENV=(DB_HOST DB_USER DB_PASSWORD DB_NAME SALT JWT_SECRET FRONTEND_URL
              AWS_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_S3_BUCKET_NAME)

build_cmd()   { (cd "$REPO_DIR" && npx tsc -p tsconfig.json); }
migrate_cmd() { (cd "$REPO_DIR" && NODE_ENV=production npx sequelize-cli db:migrate --env production); }

extra_preflight() {
  local notif sched redis_host redis_port vsl
  notif="$(env_value NOTIFICATIONS_ENABLED)"
  sched="$(env_value LEAD_NURTURE_SCHEDULER_ENABLED)"

  # Signup notifications + the nurture scheduler both need the Redis the notification-service worker reads from
  if [[ "$notif" == "true" || "$sched" == "true" ]]; then
    redis_host="$(env_value REDIS_HOST)"; redis_port="$(env_value REDIS_PORT)"; redis_port="${redis_port:-6379}"
    [[ -n "$redis_host" ]] || die "REDIS_HOST is empty but notifications / the nurture scheduler are enabled"
    tcp_open "$redis_host" "$redis_port" || die "cannot reach Redis at $redis_host:$redis_port - is redis-server running? (sudo systemctl status redis-server)"
  fi

  if [[ "$sched" == "true" ]]; then
    # Learned the hard way: without /api/v1 the VSL lookup answers 404, every tick reports lookupFailed and NOTHING is sent
    vsl="$(env_value VSL_API_BASE_URL)"; vsl="${vsl%/}"
    [[ -n "$vsl" ]] || die "VSL_API_BASE_URL is empty but the nurture scheduler is enabled - it would send nothing"
    [[ "$vsl" =~ /api/v[0-9]+$ ]] || die "VSL_API_BASE_URL must end with /api/v1 (e.g. https://form.interviewcall.club/api/v1) - got: $vsl"
    [[ -n "$(env_value VSL_WORKR_API_KEY)" ]] || die "VSL_WORKR_API_KEY is empty (must equal WORKR_INTEGRATION_API_KEY on the candidate-form service)"
    if [[ "$(env_value LEAD_NURTURE_DRY_RUN)" == "false" ]]; then
      warn "Nurture scheduler is ON and LIVE (LEAD_NURTURE_DRY_RUN=false): real emails / WhatsApp will be sent"
    else
      warn "Nurture scheduler is ON but in DRY-RUN: it only logs what it would send (set LEAD_NURTURE_DRY_RUN=false to go live)"
    fi
  else
    warn "LEAD_NURTURE_SCHEDULER_ENABLED is not 'true' - Day 2+ follow-ups will NOT be sent (Day 0 signup mails are unaffected)"
  fi
}

# =============================================================================
# Common deploy logic (identical in every WorkR repo - only the block above differs)
# =============================================================================
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "$DEPLOY_DIR/$REPO_UP" && pwd -P)"
ENV_FILE="$REPO_DIR/.env"
STATE_DIR="$REPO_DIR/.deploy"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
FORCE_INSTALL=0
HAVE_PREV=0

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mxx  %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<USAGE
Usage: deploy/deploy.sh [command] [options]      (run it from anywhere; it works on the repo it lives in)

Commands:
  deploy     (default) pull, install deps, build, migrate, restart pm2, health-check, auto-rollback
  rollback   put the previous build (dist.prev) back and restart (database migrations are NOT reverted)
  status     git revision, pm2 state and health
  logs       follow the application log

Options (deploy):
  --no-pull         deploy the code already checked out (skip git pull)
  --skip-migrate    do not run database migrations
  --force-install   run npm ci even if package-lock.json is unchanged

Environment:
  DEPLOY_BRANCH     branch to deploy (default: main)
  HEALTH_TIMEOUT    seconds to wait for the health check (default: 60)
  PM2_NAME          pm2 process to restart (default: found automatically by script path)
  SKIP_ENV_CHECKS=1 skip the .env value checks (the required-key check still runs)
USAGE
}

# KEY from .env: last assignment wins (same as dotenv), surrounding quotes stripped
env_value() {
  grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- \
    | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/" || true
}

# Lines dotenv silently ignores (a value split over two lines, a stray pasted secret...). Prints line NUMBERS only.
lint_env() {
  local bad
  bad="$(awk '/^[[:space:]]*(#.*)?$/ {next} /^[[:space:]]*(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*=/ {next} {printf "%s ", NR}' "$ENV_FILE")"
  [[ -z "$bad" ]] || warn ".env line(s) ${bad}are not KEY=VALUE. dotenv ignores them silently - a value split over two lines, or a stray secret that should be removed."
}

tcp_open() { timeout 3 bash -c ">/dev/tcp/$1/$2" 2>/dev/null; }

preflight() {
  local c
  for c in git node npm npx pm2 curl; do
    command -v "$c" >/dev/null 2>&1 || die "'$c' is not installed (or not on PATH for this user)"
  done
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  (( major >= 22 )) || warn "Node $major found - these services are built and run on Node 22"
  [[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE - create it first (see deploy/README.md)"
  lint_env

  local k v missing=()
  for k in "${REQUIRED_ENV[@]}"; do
    v="$(env_value "$k")"
    [[ -n "$v" ]] || missing+=("$k")
  done
  (( ${#missing[@]} == 0 )) || die "empty or missing in .env: ${missing[*]}"

  if [[ "${SKIP_ENV_CHECKS:-0}" != "1" ]]; then extra_preflight; fi
}

lock() {
  command -v flock >/dev/null 2>&1 || return 0
  exec 9>"/tmp/workr-deploy-${PM2_DEFAULT_NAME}.lock"
  flock -n 9 || die "another deploy of $LABEL is already running"
}

update_code() {
  if [[ ! -d "$REPO_DIR/.git" ]]; then
    warn "$REPO_DIR is not a git checkout - skipping git pull"
    return 0
  fi
  log "Updating code (branch: $DEPLOY_BRANCH)"
  git -C "$REPO_DIR" fetch --prune origin
  git -C "$REPO_DIR" checkout "$DEPLOY_BRANCH"
  git -C "$REPO_DIR" pull --ff-only origin "$DEPLOY_BRANCH" \
    || die "git pull failed (local changes or diverged branch in $REPO_DIR?). Fix it, or use --no-pull."
}

install_deps() {
  mkdir -p "$STATE_DIR"
  local want have=""
  want="$(sha256sum "$REPO_DIR/package-lock.json" | cut -d' ' -f1)"
  [[ -f "$STATE_DIR/lock.sha" ]] && have="$(cat "$STATE_DIR/lock.sha")"
  if [[ "$want" == "$have" && -d "$REPO_DIR/node_modules" && "$FORCE_INSTALL" != "1" ]]; then
    log "Dependencies unchanged - skipping npm ci"
    return 0
  fi
  log "Installing dependencies (npm ci)"
  (cd "$REPO_DIR" && npm ci) || die "npm ci failed - nothing was built or restarted"
  echo "$want" > "$STATE_DIR/lock.sha"
}

# The build rewrites dist/ in place, so keep the last good one next to it
backup_dist() {
  rm -rf "$REPO_DIR/dist.prev"
  if [[ -d "$REPO_DIR/dist" ]]; then
    cp -a "$REPO_DIR/dist" "$REPO_DIR/dist.prev"
    HAVE_PREV=1
  fi
}

restore_dist() {
  (( HAVE_PREV )) || return 0
  rm -rf "$REPO_DIR/dist"
  cp -a "$REPO_DIR/dist.prev" "$REPO_DIR/dist"
}

# Name of the pm2 process already running this repo's entry file (so we restart it instead of starting a twin)
pm2_name() {
  if [[ -n "${PM2_NAME:-}" ]]; then printf '%s' "$PM2_NAME"; return 0; fi
  pm2 jlist 2>/dev/null | tail -n 1 | node -e '
    let s = "";
    process.stdin.on("data", d => s += d).on("end", () => {
      try {
        const p = JSON.parse(s).find(x => x.pm2_env && x.pm2_env.pm_exec_path === process.argv[1]);
        if (p) process.stdout.write(p.name);
      } catch (e) {}
    });' "$REPO_DIR/$ENTRY" || true
}

restart_app() {
  local name
  name="$(pm2_name)"
  if [[ -n "$name" ]]; then
    log "Restarting pm2 process '$name'"
    pm2 restart "$name" --update-env
  else
    log "No pm2 process runs $ENTRY yet - starting '$PM2_DEFAULT_NAME'"
    pm2 start "$DEPLOY_DIR/ecosystem.config.js"
  fi
}


wait_healthy() {
  local port url deadline
  port="$(env_value PORT)"; port="${port:-3000}"
  url="http://127.0.0.1:${port}${HEALTH_PATH}"
  deadline=$(( SECONDS + HEALTH_TIMEOUT ))
  printf 'Waiting for %s' "$url"
  while (( SECONDS < deadline )); do
    if curl -fsS --max-time 3 -o /dev/null "$url" 2>/dev/null; then printf ' - healthy\n'; return 0; fi
    printf '.'
    sleep 2
  done
  printf ' - no healthy answer after %ss\n' "$HEALTH_TIMEOUT"
  return 1
}

show_failure_logs() {
  local name f
  name="$(pm2_name)"
  warn "Last pm2 output:"
  pm2 logs "${name:-$PM2_DEFAULT_NAME}" --nostream --lines 30 2>&1 || true
  f="$(ls -t "$REPO_DIR"/logs/*app.log 2>/dev/null | head -1 || true)"
  if [[ -n "$f" ]]; then warn "Last application log lines ($f):"; tail -n 20 "$f" || true; fi
}

do_rollback() {
  [[ -d "$REPO_DIR/dist.prev" ]] || die "no dist.prev to roll back to"
  log "Rolling back to the previous build"
  rm -rf "$REPO_DIR/dist"
  cp -a "$REPO_DIR/dist.prev" "$REPO_DIR/dist"
  restart_app
  wait_healthy || { show_failure_logs; die "rollback build is not healthy either - check the logs above"; }
  log "Rolled back. NOTE: database migrations were not reverted."
}

do_deploy() {
  local pull=1 migrate=1 arg prev_sha new_sha
  for arg in "$@"; do
    case "$arg" in
      --no-pull) pull=0 ;;
      --skip-migrate) migrate=0 ;;
      --force-install) FORCE_INSTALL=1 ;;
      *) die "unknown option: $arg (see --help)" ;;
    esac
  done

  preflight
  lock
  prev_sha="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  if (( pull )); then update_code; fi
  new_sha="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  log "Deploying $LABEL: $prev_sha -> $new_sha"

  install_deps
  backup_dist

  log "Building"
  if ! build_cmd; then
    restore_dist
    die "Build failed - the running $LABEL was NOT touched."
  fi

  if (( migrate )); then
    log "Running database migrations"
    if ! migrate_cmd; then
      restore_dist
      die "Migration failed - the running $LABEL was NOT restarted (previous build restored). Fix it and re-run."
    fi
  else
    warn "Skipping migrations (--skip-migrate)"
  fi

  restart_app

  if ! wait_healthy; then
    show_failure_logs
    if (( HAVE_PREV )); then do_rollback; fi
    die "Deploy of $LABEL @ $new_sha FAILED (rolled back to the previous build if there was one)"
  fi

  pm2 save >/dev/null 2>&1 || warn "pm2 save failed - run it by hand so the process survives a reboot"
  mkdir -p "$STATE_DIR" && echo "$new_sha" > "$STATE_DIR/last-deployed-sha"
  log "Deployed $LABEL @ $new_sha"
  do_status
}

do_status() {
  local name port
  name="$(pm2_name)"
  port="$(env_value PORT 2>/dev/null)"; port="${port:-3000}"
  printf 'git revision : %s\n' "$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo n/a)"
  printf 'pm2 process  : %s\n' "${name:-<not running>}"
  if [[ -n "$name" ]]; then pm2 describe "$name" 2>/dev/null | grep -E 'status|uptime|restarts' || true; fi
  if curl -fsS --max-time 3 -o /dev/null "http://127.0.0.1:${port}${HEALTH_PATH}" 2>/dev/null; then
    printf 'health       : OK (http://127.0.0.1:%s%s)\n' "$port" "$HEALTH_PATH"
  else
    printf 'health       : NOT OK (http://127.0.0.1:%s%s)\n' "$port" "$HEALTH_PATH"
  fi
}

do_logs() {
  local f name
  f="$(ls -t "$REPO_DIR"/logs/*app.log 2>/dev/null | head -1 || true)"
  if [[ -n "$f" ]]; then
    echo "Following $f  (Ctrl+C to stop; pm2 logs ${PM2_NAME:-$PM2_DEFAULT_NAME} shows stdout/stderr)"
    tail -n 100 -F "$f"
  else
    name="$(pm2_name)"; pm2 logs "${name:-$PM2_DEFAULT_NAME}"
  fi
}

cmd="${1:-deploy}"
case "$cmd" in
  deploy)   shift || true; do_deploy "$@" ;;
  rollback) preflight; lock; do_rollback ;;
  status)   do_status ;;
  logs)     do_logs ;;
  -h|--help|help) usage ;;
  --*)      do_deploy "$@" ;;
  *)        usage; exit 1 ;;
esac
