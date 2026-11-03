#!/usr/bin/env bash
# ============================================================
# Runs ON THE SERVER. The GitHub Actions workflow pipes it over SSH after uploading a new release:
#
#   ssh truffles-server bash -s -- DEPLOY_PATH RELEASE_ID KEEP APP_NAME HEALTH_URL KIND < remote-release.sh
#
# What it does, in order:
#   1. validates every argument (they become file paths and commands)
#   2. prepares the uploaded release (api: links the secret .env and installs dependencies)
#   3. switches the `current` symlink to the new release in one atomic step
#   4. restarts the app with PM2
#   5. waits for the health check to pass
#   6. if it does NOT pass: rolls back to the previous release automatically and exits with an error
#   7. deletes old releases, keeping the newest KEEP
#
# Server layout:
#   DEPLOY_PATH/releases/<RELEASE_ID>/   one folder per deployment
#   DEPLOY_PATH/current                  symlink to the live release
#   DEPLOY_PATH/shared/.env              (api only) secrets, created by hand once, never in git
# ============================================================
set -Eeuo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }
log() { echo "[deploy] $*"; }

[ "$#" -eq 6 ] || die "expected 6 arguments: DEPLOY_PATH RELEASE_ID KEEP APP_NAME HEALTH_URL KIND"
DEPLOY_PATH=$1
RELEASE_ID=$2
KEEP=$3
APP_NAME=$4
HEALTH_URL=$5
KIND=$6

# ---- 1. validate (nothing unexpected may reach a path or a command) ----
[[ $DEPLOY_PATH =~ ^/[A-Za-z0-9._/-]+$ ]] || die "DEPLOY_PATH must be an absolute path of letters, digits, . _ - /"
[[ $DEPLOY_PATH != *..* ]]                  || die "DEPLOY_PATH must not contain '..'"
[[ $RELEASE_ID =~ ^[0-9]{14}-[0-9a-f]{7,40}$ ]] || die "RELEASE_ID has an unexpected format"
[[ $KEEP =~ ^[0-9]+$ ]] && (( KEEP >= 2 && KEEP <= 50 )) || die "KEEP must be a number from 2 to 50"
[[ $APP_NAME =~ ^[A-Za-z0-9._-]+$ ]]        || die "APP_NAME has an unexpected format"
[[ $HEALTH_URL =~ ^http://(127\.0\.0\.1|localhost):[0-9]{2,5}/[A-Za-z0-9._/-]*$ ]] || die "HEALTH_URL must be a local http address"
[[ $KIND == web || $KIND == api ]]          || die "KIND must be 'web' or 'api'"

RELEASES="$DEPLOY_PATH/releases"
SHARED="$DEPLOY_PATH/shared"
CURRENT="$DEPLOY_PATH/current"
NEW="$RELEASES/$RELEASE_ID"

[ -d "$NEW" ] || die "uploaded release not found: $NEW"
command -v pm2  >/dev/null || die "pm2 is not installed on the server (npm install -g pm2)"
command -v curl >/dev/null || die "curl is not installed on the server"
[ -f "$NEW/ecosystem.config.cjs" ] || die "release has no ecosystem.config.cjs"

PREVIOUS=""
if [ -L "$CURRENT" ]; then PREVIOUS=$(readlink -f "$CURRENT" || true); fi
log "new release:      $NEW"
log "previous release: ${PREVIOUS:-none (first deployment)}"

# ---- 2. prepare ----
if [ "$KIND" = "api" ]; then
  [ -f "$SHARED/.env" ] || die "missing $SHARED/.env. Create it once from .env.example (see DEPLOYMENT.md)."
  # The .env stays outside the release folders so it survives every deployment and is never uploaded.
  chmod 600 "$SHARED/.env" 2>/dev/null || true
  ln -sfn "$SHARED/.env" "$NEW/.env"
  command -v npm >/dev/null || die "npm is not installed on the server"
  log "installing production dependencies"
  (cd "$NEW" && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
fi

# ---- helpers ----
start_app() { # directory
  (cd "$1" && pm2 startOrReload ecosystem.config.cjs --update-env)
}

switch_to() { # directory: atomic swap (a temp link, then rename over the old one)
  ln -sfn "$1" "$DEPLOY_PATH/.current.tmp"
  mv -Tf "$DEPLOY_PATH/.current.tmp" "$CURRENT"
}

healthy() {
  local i
  for i in $(seq 1 30); do
    if curl -fsS --max-time 3 -o /dev/null "$HEALTH_URL" 2>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

# ---- 3 + 4. go live ----
log "switching 'current' to the new release"
switch_to "$NEW"
log "starting $APP_NAME with PM2"
start_app "$NEW" || true   # a failed start is caught by the health check below

# ---- 5 + 6. verify, roll back on failure ----
if healthy; then
  log "health check passed: $HEALTH_URL"
else
  echo "ERROR: health check FAILED for $HEALTH_URL" >&2
  echo "--- last application log lines ---" >&2
  pm2 logs "$APP_NAME" --lines 25 --nostream >&2 2>/dev/null || true
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    log "ROLLING BACK to $PREVIOUS"
    switch_to "$PREVIOUS"
    start_app "$PREVIOUS" || true
    if healthy; then log "rollback succeeded: the previous version is live again"
    else echo "ERROR: the previous release is also unhealthy. Manual attention needed." >&2; fi
  else
    echo "ERROR: no previous release to roll back to." >&2
  fi
  rm -rf -- "$NEW"
  exit 1
fi

pm2 save >/dev/null 2>&1 || true

# ---- 7. keep only the newest releases (never the live one or the previous one) ----
log "cleaning up old releases (keeping $KEEP)"
LIVE=$(readlink -f "$CURRENT" || true)
ls -1 "$RELEASES" 2>/dev/null | sort -r | tail -n +"$((KEEP + 1))" | while read -r old; do
  target="$RELEASES/$old"
  if [ "$target" != "$LIVE" ] && [ "$target" != "$PREVIOUS" ]; then rm -rf -- "$target"; fi
done

log "DONE. Live release: $RELEASE_ID"
