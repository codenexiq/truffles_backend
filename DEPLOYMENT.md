# Deployment (API)

Every push to `main` is tested and then deployed to the server over SSH by
`.github/workflows/deploy.yml`. The SSH settings are in that file; the secret values are in GitHub.

```
git push  →  GitHub Actions: audit, build, security tests  →  rsync over SSH to releases/<time>-<sha>
          →  remote-release.sh: install deps, switch `current` symlink, restart PM2, health check
          →  health check fails?  automatic rollback to the previous release
```

## 1. One-time server setup (Ubuntu/Debian)

```bash
# as root
adduser --disabled-password deploy
mkdir -p /var/www/truffles-api/{releases,shared} && chown -R deploy:deploy /var/www/truffles-api
# Node 24, nginx, certbot, rsync, curl
npm install -g pm2
sudo -u deploy pm2 startup      # run the command it prints, so the app restarts after a reboot
```

Create a dedicated deploy key **on your own computer** (never reuse a personal key):

```bash
ssh-keygen -t ed25519 -f truffles_deploy -C "github-actions-truffles-api" -N ""
ssh-copy-id -i truffles_deploy.pub deploy@YOUR_SERVER      # or append it to ~deploy/.ssh/authorized_keys
ssh-keyscan -p 22 YOUR_SERVER                              # output = the SSH_KNOWN_HOSTS secret
```

Create the secret settings file **once, on the server** (it is never in git and survives every deployment):

```bash
cp .env.example /var/www/truffles-api/shared/.env     # or write it by hand
nano /var/www/truffles-api/shared/.env
chmod 600 /var/www/truffles-api/shared/.env
```

Required production values: `NODE_ENV=production`, `JWT_SECRET` (64+ random chars:
`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`), `CLIENT_URL=https://your-site`,
`TRUST_PROXY=1` (nginx is in front), and `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (`npm run hash-password`).
The server refuses to start in production with weak or missing values.

nginx: copy `deploy/nginx.conf.example` to `/etc/nginx/sites-available/`, edit the domain, enable it, then
`sudo certbot --nginx -d api.your-domain`.

## 2. GitHub settings (repository → Settings → Secrets and variables → Actions)

| Type | Name | Value |
|---|---|---|
| Secret | `SSH_HOST` | server IP or hostname |
| Secret | `SSH_USER` | `deploy` |
| Secret | `SSH_PRIVATE_KEY` | full contents of `truffles_deploy` (the private file) |
| Secret | `SSH_KNOWN_HOSTS` | output of `ssh-keyscan` above |
| Secret | `SSH_PORT` | optional, default 22 |
| Variable | `DEPLOY_PATH` | `/var/www/truffles-api` |

Optional: create an environment named `production` (Settings → Environments) and add required reviewers
to approve each deployment. Until the values above exist, the deploy job skips itself with a notice.

## 3. Day to day

* Push to `main` → deploys. Pull requests only run the tests.
* Run manually: Actions → "Test and deploy (API)" → Run workflow.
* Manual rollback: `ln -sfn /var/www/truffles-api/releases/<older> /var/www/truffles-api/current && cd /var/www/truffles-api/current && pm2 startOrReload ecosystem.config.cjs`.
* Logs: `pm2 logs truffles-api`.

## Notes

* The app keeps data in memory, so it runs as a single PM2 instance and orders/reservations reset on restart.
  Add a database before relying on it for real bookings.
* Keep the private key only in GitHub Secrets. If it leaks, remove the line from `authorized_keys` and make a new key.
