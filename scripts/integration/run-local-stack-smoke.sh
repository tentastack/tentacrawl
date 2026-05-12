#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="$ROOT_DIR/.artifacts/integration/logs"
SCREENSHOT_PATH="$ROOT_DIR/.artifacts/integration/homepage.png"

MONGO_CONTAINER="${MONGO_CONTAINER:-mongo-db}"
REDIS_CONTAINER="${REDIS_CONTAINER:-my-redis}"
MONGO_PORT="${MONGO_PORT:-27017}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_HOST="${REDIS_HOST:-localhost}"
API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"
WORKER_PORT="${WORKER_PORT:-3002}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:${MONGO_PORT}}"
MONGO_DB_NAME="${MONGO_DB_NAME:-tentacrawl}"

API_PID=""
WEB_PID=""
WORKER_PID=""

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name"
    exit 1
  fi
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local timeout_seconds="$3"
  local elapsed=0

  until curl -fsS "$url" >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [[ "$elapsed" -ge "$timeout_seconds" ]]; then
      echo "$name did not become ready in ${timeout_seconds}s"
      exit 1
    fi
  done

  echo "$name is ready"
}

cleanup() {
  set +e

  if [[ -n "$WEB_PID" ]]; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "$WORKER_PID" ]]; then
    kill "$WORKER_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "$API_PID" ]]; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

ensure_mongo_container() {
  if docker container inspect "$MONGO_CONTAINER" >/dev/null 2>&1; then
    docker start "$MONGO_CONTAINER" >/dev/null || true
    echo "Mongo container started: $MONGO_CONTAINER"
    return
  fi

  docker run -d \
    --name "$MONGO_CONTAINER" \
    -p "$MONGO_PORT:27017" \
    mongo:7 >/dev/null

  echo "Mongo container created and started: $MONGO_CONTAINER"
}

ensure_redis_container() {
  if docker container inspect "$REDIS_CONTAINER" >/dev/null 2>&1; then
    docker start "$REDIS_CONTAINER" >/dev/null || true
    echo "Redis container started: $REDIS_CONTAINER"
    return
  fi

  docker run -d \
    --name "$REDIS_CONTAINER" \
    -p "$REDIS_PORT:6379" \
    redis >/dev/null

  echo "Redis container created and started: $REDIS_CONTAINER"
}

start_apps() {
  mkdir -p "$LOG_DIR"

  cd "$ROOT_DIR"

  MONGO_URI="$MONGO_URI" \
  MONGO_DB_NAME="$MONGO_DB_NAME" \
  REDIS_HOST="$REDIS_HOST" \
  REDIS_PORT="$REDIS_PORT" \
  PORT="$API_PORT" \
  pnpm dev:api >"$LOG_DIR/api.log" 2>&1 &
  API_PID=$!

  MONGO_URI="$MONGO_URI" \
  MONGO_DB_NAME="$MONGO_DB_NAME" \
  REDIS_HOST="$REDIS_HOST" \
  REDIS_PORT="$REDIS_PORT" \
  PORT="$WORKER_PORT" \
  pnpm dev:worker >"$LOG_DIR/worker.log" 2>&1 &
  WORKER_PID=$!

  NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" pnpm dev:web >"$LOG_DIR/web.log" 2>&1 &
  WEB_PID=$!

  echo "Started api pid=$API_PID"
  echo "Started worker pid=$WORKER_PID"
  echo "Started web pid=$WEB_PID"
}

run_playwright_check() {
  cd "$ROOT_DIR"
  pnpm --filter @tentacrawl/browser exec node "$ROOT_DIR/scripts/integration/playwright-smoke.mjs" \
    --url "http://localhost:$WEB_PORT" \
    --api-health "http://localhost:$API_PORT/health" \
    --worker-health "http://localhost:$WORKER_PORT/health" \
    --output "$SCREENSHOT_PATH"
}

main() {
  require_command docker
  require_command curl
  require_command pnpm

  ensure_mongo_container
  ensure_redis_container

  start_apps

  wait_for_http "http://localhost:$API_PORT/health" "API" 180
  wait_for_http "http://localhost:$WORKER_PORT/health" "Worker" 180
  wait_for_http "http://localhost:$WEB_PORT" "Web" 240

  run_playwright_check

  echo "Smoke integration skill completed successfully"
  echo "Screenshot: $SCREENSHOT_PATH"
  echo "Logs: $LOG_DIR"
}

main "$@"
