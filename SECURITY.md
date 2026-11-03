# Truffles Rooftop Restaurant: Security Guide

This document explains what protects the website (`frontend/`) and the API (`backend/`),
what you must do before going live, and what is **not yet** covered.

> **Read section 4 (before you launch) first.** Several protections only work once the
> production settings are in place.

---

## 1. What was found and fixed

| # | Problem found | Risk | Fixed |
|---|---|---|---|
| 1 | Two built-in staff accounts (a **super admin** and a manager), both with the password `admin123` | Anyone could log in as the owner | Removed. There are no default accounts. |
| 2 | The login-signing secret (`JWT_SECRET`) was a public default in the source code, and your real `.env` used it | Anyone could forge an admin login | Secret rotated. The server **refuses to start in production** with a missing/weak/known secret. |
| 3 | Anyone could cancel any reservation (`PATCH /reservations/:id/cancel`), and IDs were guessable (`res-<timestamp>`) | Sabotage of bookings | IDs are random UUIDs. Cancelling needs a secret token given only to the guest. |
| 4 | Anyone could read any order, including the customer's name, email and phone, by guessing its ID | Customer data leak | Needs a secret token (or a staff login). |
| 5 | Reviews were published instantly; unsubscribing was open to everyone; "already subscribed" revealed who is on the list | Defacement, spam, privacy | Reviews wait for approval; unsubscribe needs a signed token; same answer for new and existing subscribers. |
| 6 | No limits on how much text a form accepts; 10 MB request bodies; unlimited memory growth | Server crash / flooding | Strict length limits, 100 KB bodies, capped storage, per-IP limits on every public form. |
| 7 | Passwords of 6 characters accepted; no lockout; unknown vs wrong email distinguishable by timing | Password guessing | 12+ character policy, lockout after 5 failures, constant-time login. |
| 8 | A "staff" or "admin" could create another admin | Privilege escalation | Only a super admin can create admins. |
| 9 | Logging out did not actually end the session | Stolen token stays valid | Logout revokes the token server-side. |
| 10 | No security headers or Content-Security-Policy on the website | Script injection, clickjacking | Full header set and a CSP (see 2.2). |
| 11 | The website silently pointed at `localhost` if the API address was not set | Customers' data sent to the wrong place | The production build fails unless `NEXT_PUBLIC_BACKEND_URL` is an https address. |
| 12 | The compiled `backend/dist` folder still contained the old default admin | `npm start` would run vulnerable code | Rebuilt. **Always run `npm run build` before `npm start`.** |

Dependency scans (`npm audit`) found **0 known vulnerabilities** in both projects.

---

## 2. What protects what

### 2.1 Backend (API)

**Secrets and startup**
- `JWT_SECRET` must be 32+ random characters in production; known placeholders are blacklisted.
- `CLIENT_URL` must be `https://` in production. Localhost is only allowed in development.
- The server exits immediately on unsafe settings instead of running insecurely.

**Authentication and sessions**
- Passwords: bcrypt (cost 12). Staff password policy: 12+ characters, 3 of 4 character types, not common.
- Tokens: HS256 only (no `none` / algorithm tricks), 8 hour life, with issuer and audience checks.
- Cookie: `HttpOnly` (scripts can't read it), `SameSite=Strict`, `Secure` + `__Host-` prefix in production.
- Login lockout: 5 failures per email locks it for 15 minutes; plus 10 attempts / 15 min per IP.
- Logout revokes the token. Role checks on every staff endpoint.

**Requests**
- JSON bodies only (blocks form-style cross-site posts), 100 KB limit, strict JSON parsing.
- CORS allows only your website origins. State-changing requests from any other origin are refused (CSRF defence), and cookie-authenticated writes must come from your site.
- Every field validated with Zod: types, ranges, real calendar dates, phone/email formats, max lengths.
- Text is cleaned: control characters and HTML tags removed.
- Hidden "bot trap" field on all public forms; filled-in submissions are silently dropped.
- Rate limits: global per IP, tighter on public forms (default 10 per 15 min), tighter again on login.

**Data handling**
- Guests/customers only get back what they need (no echo of their details). Secrets are stored as hashes.
- Public reviews are shown only after approval, and expose only name, rating, comment and date.
- Errors never leak stack traces, file paths or library messages. 404s don't repeat the URL.
- Responses are `no-store` (never cached). Strict API-only CSP, `nosniff`, no `X-Powered-By`, HSTS in production.
- Crashes (`uncaughtException`) log and exit so a supervisor restarts a clean process.

### 2.2 Frontend (website)

Headers sent on every page:

| Header | Purpose |
|---|---|
| `Content-Security-Policy` | Only our own scripts; no external script hosts; data may only be sent to our API; no `eval`, no plugins, no foreign frames; `base`/`form` locked to our origin; `frame-ancestors 'none'` |
| `Strict-Transport-Security` | Browsers insist on HTTPS for 2 years |
| `X-Frame-Options: DENY` | The site cannot be embedded in another page (clickjacking) |
| `X-Content-Type-Options: nosniff` | Blocks MIME-type tricks |
| `Referrer-Policy`, `Permissions-Policy` | No leaking of URLs; camera/mic/location/payment disabled |
| `Cross-Origin-Opener-Policy` | Isolates the page from other windows |

Also: framework version hidden; script integrity hashes (SRI); the image optimizer cannot fetch from outside sites; the theme script is a file (not inline); structured data on blog posts is escaped so post text can never break out of its `<script>` tag; all `target="_blank"` links use `rel="noopener noreferrer"`; no secrets in browser code.

**Tested in a real browser on the production build:** injected attacker scripts, data uploads to an attacker server, attacker iframes, tracking images, `eval()`, `<base>` hijacking and `<object>` plugins were all **blocked**; the site cannot be framed; all 13 pages load with 0 policy violations.

---

## 3. Checking it (run these any time)

```bash
# Backend
cd backend
npm run audit                  # known-vulnerability scan
npm run security:check         # attacks a running API (70+ checks); see the file header for options
node scripts/security-check.mjs --ratelimit   # rate limits / lockout (start a fresh server with PUBLIC_WRITE_MAX=5)
node scripts/security-check.mjs --env         # proves unsafe production settings are refused

# Frontend
cd frontend
npm audit --omit=dev
```

Run `security:check` after any change to the API. **Never aim it at a live site with real customers**: it creates test records.

---

## 4. Before you launch (production checklist)

**Backend `.env` (production)**
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` = a new random value: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- [ ] `CLIENT_URL=https://your-domain.com` (comma-separate extra origins, e.g. the `www.` version)
- [ ] `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` (create the hash with `npm run hash-password`)
- [ ] `TRUST_PROXY=1` if the API sits behind nginx / a load balancer / Cloudflare (otherwise rate limits see only the proxy's IP)
- [ ] Run `npm run build` then `npm start` (never `tsx`/`dev` in production)

**Frontend**
- [ ] `NEXT_PUBLIC_BACKEND_URL=https://api.your-domain.com` (the build fails without it, on purpose)
- [ ] Build with `npm run build`, serve with `npm start`

**Hosting**
- [ ] HTTPS everywhere (a free Let's Encrypt / Cloudflare certificate is fine). Redirect http to https.
- [ ] Put the site behind a CDN/WAF such as Cloudflare for DDoS protection.
- [ ] Never commit `.env`. The project is **not yet a git repository**. Run `git init` before the first commit; `.gitignore` already excludes `.env*` (but keeps `.env.example`).
- [ ] Rotate any secret that has ever been shared in chat, email or screenshots.
- [ ] Back up your data (see 5.1) and the `.env` values in a password manager.

---

## 5. Not done yet (needs a decision or outside accounts)

1. **The API stores everything in memory.** Bookings, enquiries and reviews disappear when the server restarts, and nobody is notified. Before launch it needs a real database (for example PostgreSQL), backups, and email/WhatsApp alerts to staff. Until then WhatsApp is the reliable channel.
2. **No CAPTCHA.** The bot trap and rate limits stop casual spam, but a determined attacker would need Cloudflare Turnstile or reCAPTCHA (free; needs an account and keys).
3. **`script-src 'unsafe-inline'`.** Next.js streams page data in inline scripts, and a stricter nonce-based policy would force every page to render on demand (slower, not cacheable). I tested plain `'self'` and the site stops working. The upgrade path is a per-request nonce in `proxy.ts` (Next.js "Content Security Policy" guide) if you later accept dynamic rendering. External scripts are still fully blocked.
4. **Rate limits and lockouts live in memory.** Fine for one server; with several servers use Redis.
5. **No staff dashboard yet.** The admin API exists but there is no screen for it; when built it must use the same cookie/Bearer rules and show review moderation.
6. **If staff ever export data to Excel/CSV**, cells starting with `=`, `+`, `-` or `@` can run formulas. Neutralise them in the export.
7. **Privacy.** You collect names, phones and emails. A privacy policy (the site has a placeholder page) and a retention rule (for example delete old enquiries after 12 months) are your responsibility.
8. **Monitoring.** Add uptime monitoring and log shipping; watch for the log lines `Failed staff login attempt`, `Honeypot triggered`, `Blocked ... disallowed origin`.
9. **`/.well-known/security.txt`.** Add a contact address for people who find problems (needs a real email).

---

## 6. If something goes wrong

1. **Suspect a leaked secret?** Change `JWT_SECRET` and restart: every login session ends immediately.
2. **Suspect a staff account is compromised?** Change its password, and rotate `JWT_SECRET`.
3. **Spam flood?** Lower `PUBLIC_WRITE_MAX`, and block the IP range at your CDN/WAF.
4. **Customer data exposed?** Preserve logs, fix the cause, and tell affected customers promptly.
