#!/usr/bin/env bash
# ============================================================
# Runs the full security suite against the COMPILED server, the way production runs it.
# Used by the GitHub Actions pipeline, and safe to run on your own machine:
#
#     npm run build && npm run security:ci
#
# It starts its own throw-away servers on high ports with random secrets, runs every check,
# and always stops them again. It never touches your .env or a running server.
# ============================================================
set -Eeuo pipefail
cd "$(dirname "$0")/.."

[ -f dist/server.js ] || { echo "dist/server.js not found. Run 'npm run build' first."; exit 1; }

# The test servers must never touch a real database: blank the DB settings so a developer's .env cannot leak in
# (values that are already set, even to nothing, are not overridden by .env).
export DB_NAME="" DB_USER="" DB_PASSWORD=""

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

TEST_PW='Zx9!mQ4#vL2$wT8pR-ci'
export TEST_PW
TEST_HASH=$(node -e 'console.log(require("bcryptjs").hashSync(process.env.TEST_PW, 10))')
SECRET=$(node -e 'console.log(require("crypto").randomBytes(64).toString("hex"))')
ORIGIN="https://ci.truffles.example"

wait_for() { # port
  for _ in $(seq 1 40); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://127.0.0.1:$1/api/v1/health" || true)
    [ "$code" = "200" ] && return 0
    sleep 0.5
  done
  echo "server on port $1 did not start"; return 1
}

echo "### 1/3  Main security suite (production mode, compiled build)"
PORT=5059 NODE_ENV=production JWT_SECRET="$SECRET" CLIENT_URL="$ORIGIN" \
  PUBLIC_WRITE_MAX=500 RATE_LIMIT_MAX=5000 \
  ADMIN_EMAIL=ci-admin@example.com ADMIN_PASSWORD_HASH="$TEST_HASH" \
  node dist/server.js > /tmp/ci-api-main.log 2>&1 &
PIDS+=($!)
wait_for 5059
CHECK_PROD=1 CHECK_ORIGIN="$ORIGIN" BASE_URL=http://127.0.0.1:5059 \
  CHECK_ADMIN_EMAIL=ci-admin@example.com CHECK_ADMIN_PASSWORD="$TEST_PW" \
  node scripts/security-check.mjs

echo; echo "### 2/3  Rate limits and lockout (fresh server, strict limits)"
PORT=5057 NODE_ENV=production JWT_SECRET="$SECRET" CLIENT_URL="$ORIGIN" PUBLIC_WRITE_MAX=5 \
  ADMIN_EMAIL=ci-admin@example.com ADMIN_PASSWORD_HASH="$TEST_HASH" \
  node dist/server.js > /tmp/ci-api-rate.log 2>&1 &
PIDS+=($!)
wait_for 5057
BASE_URL=http://127.0.0.1:5057 node scripts/security-check.mjs --ratelimit

echo; echo "### 3/3  Unsafe production settings must be refused at startup"
node scripts/security-check.mjs --env

echo; echo "Security pipeline: ALL CHECKS PASSED"
