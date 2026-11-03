// ============================================================
// Truffles API security check. Attacks a RUNNING server the way a hostile visitor would.
//
//   npm run security:check                         (against http://localhost:5001)
//   BASE_URL=https://api.example.com npm run security:check
//
// Optional, for the logged-in tests (use a real admin of the server under test):
//   CHECK_ADMIN_EMAIL=... CHECK_ADMIN_PASSWORD=... npm run security:check
//
// Flags:
//   --ratelimit   only run the rate-limit tests (start the server with PUBLIC_WRITE_MAX=5
//                 and a fresh process first; these tests deliberately trip the limits)
//   --env         only test that the server refuses to start with unsafe production settings
//
// Do NOT point this at a live production site with real customers: it creates test records.
// ============================================================
import { spawnSync } from "node:child_process";
import jwt from "jsonwebtoken";

const BASE = (process.env.BASE_URL ?? "http://localhost:5001").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const ORIGIN = process.env.CHECK_ORIGIN ?? "http://localhost:3000";
const EVIL = "https://evil.example";
const ADMIN_EMAIL = process.env.CHECK_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.CHECK_ADMIN_PASSWORD;
const args = new Set(process.argv.slice(2));

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `  -> ${detail}` : ""}`);
  }
}
const section = (t) => console.log(`\n== ${t}`);

async function call(method, path, { body, headers = {}, raw, origin } = {}) {
  const h = { ...headers };
  if (origin) h.Origin = origin;
  let payload = raw;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    h["Content-Type"] ??= "application/json";
  }
  const res = await fetch(`${API}${path}`, { method, headers: h, body: payload });
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, headers: res.headers, json, text };
}

const future = (days) => new Date(Date.now() + days * 86400000 + 5 * 3600000).toISOString().slice(0, 10);

// ------------------------------------------------------------
async function envEnforcement() {
  section("Unsafe production settings are refused at startup");
  const run = (extra) =>
    spawnSync("npx", ["tsx", "src/server.ts"], {
      env: { ...process.env, NODE_ENV: "production", PORT: "5999", ...extra },
      encoding: "utf8",
      timeout: 25000,
      shell: true,
    });
  const DEFAULT = "super-secret-truffles-cafe-jwt-key-change-in-production-2026";

  let r = run({ JWT_SECRET: DEFAULT, CLIENT_URL: "https://example.com" });
  check("production + the old built-in default JWT secret -> refuses to start", r.status !== 0 && /placeholder|FATAL/i.test(r.stderr + r.stdout));
  r = run({ JWT_SECRET: "", CLIENT_URL: "https://example.com" });
  check("production + no JWT secret -> refuses to start", r.status !== 0 && /JWT_SECRET/.test(r.stderr + r.stdout));
  r = run({ JWT_SECRET: "short", CLIENT_URL: "https://example.com" });
  check("production + short JWT secret -> refuses to start", r.status !== 0 && /32 characters/.test(r.stderr + r.stdout));
  r = run({ JWT_SECRET: "k8Vq2mZpX7rT4wY9nB3cL6dF1gH5jS0aE8uI2oP7zQ4xM6vN3bC9yR1tW5eU", CLIENT_URL: "http://example.com" });
  check("production + non-https CLIENT_URL -> refuses to start", r.status !== 0 && /https/.test(r.stderr + r.stdout));
}

// ------------------------------------------------------------
async function rateLimits() {
  section("Rate limiting (needs a fresh server started with PUBLIC_WRITE_MAX=5)");
  const contact = { name: "Rate Test", email: "rate@example.com", subject: "Rate limit test", message: "This is a rate limit test message." };
  let blocked = 0;
  for (let i = 0; i < 10; i++) {
    const r = await call("POST", "/contact", { body: contact });
    if (r.status === 429) blocked++;
  }
  check("repeated form submissions from one IP are blocked (429)", blocked >= 4, `blocked ${blocked}/10`);

  let loginBlocked = 0;
  let lockedMessage = false;
  for (let i = 0; i < 14; i++) {
    const r = await call("POST", "/auth/login", { body: { email: `nobody${i % 2}@example.com`, password: "wrong-password-123" } });
    if (r.status === 429) loginBlocked++;
    if (r.status === 429 && /Too many/i.test(r.json?.message ?? "")) lockedMessage = true;
  }
  check("repeated bad logins are blocked (429)", loginBlocked > 0 && lockedMessage, `blocked ${loginBlocked}/14`);

  // Account lockout is per email: 5 wrong passwords lock that email even from another "client".
  const victim = `victim${Date.now()}@example.com`;
  let locked = false;
  for (let i = 0; i < 7; i++) {
    const r = await call("POST", "/auth/login", { body: { email: victim, password: `wrong-${i}-password` } });
    if (r.status === 429) locked = true;
  }
  check("one email address is locked after repeated failures", locked);
}

// ------------------------------------------------------------
async function main() {
  console.log(`Security check against ${BASE}`);
  if (args.has("--env")) return envEnforcement();
  if (args.has("--ratelimit")) return rateLimits();

  // ---------- headers ----------
  section("Security headers");
  const h = await call("GET", "/health");
  const hd = h.headers;
  check("health check responds", h.status === 200);
  check("no X-Powered-By header (framework hidden)", !hd.get("x-powered-by"));
  check("CSP forbids everything (default-src 'none')", /default-src 'none'/.test(hd.get("content-security-policy") ?? ""));
  check("framing blocked (frame-ancestors 'none')", /frame-ancestors 'none'/.test(hd.get("content-security-policy") ?? ""));
  check("X-Content-Type-Options: nosniff", hd.get("x-content-type-options") === "nosniff");
  check("Referrer-Policy: no-referrer", hd.get("referrer-policy") === "no-referrer");
  check("Cross-Origin-Resource-Policy set", !!hd.get("cross-origin-resource-policy"));
  check("Permissions-Policy set", /camera=\(\)/.test(hd.get("permissions-policy") ?? ""));
  check("responses are not cacheable (no-store)", /no-store/.test(hd.get("cache-control") ?? ""));
  check("health check reveals no version / uptime", !/uptime|version/i.test(h.text));

  if (process.env.CHECK_PROD) {
    check("production: HSTS forces HTTPS for two years", /max-age=63072000/.test(hd.get("strict-transport-security") ?? "") && /includeSubDomains/.test(hd.get("strict-transport-security") ?? ""));
    const localhostPre = await fetch(`${API}/contact`, { method: "OPTIONS", headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" } });
    check("production: localhost is NOT an allowed origin", !localhostPre.headers.get("access-control-allow-origin"));
  }

  const nf = await call("GET", "/does-not-exist-<script>");
  check("unknown route is a clean 404", nf.status === 404);
  check("404 does not reflect the requested URL", !/does-not-exist/.test(nf.text));

  // ---------- CORS / CSRF ----------
  section("Cross-origin protection");
  const okPre = await fetch(`${API}/contact`, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
  check("our own website origin is allowed by CORS", okPre.headers.get("access-control-allow-origin") === ORIGIN);
  const evilPre = await fetch(`${API}/contact`, { method: "OPTIONS", headers: { Origin: EVIL, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
  check("an unknown website origin gets NO CORS permission", !evilPre.headers.get("access-control-allow-origin"));
  const evilPost = await call("POST", "/contact", { origin: EVIL, body: { name: "X Y", email: "x@example.com", subject: "Evil origin", message: "Sent from a hostile website." } });
  check("a write from an unknown website origin is refused (403)", evilPost.status === 403, `status ${evilPost.status}`);

  // ---------- authentication ----------
  section("Authentication");
  const defaults = await call("POST", "/auth/login", { body: { email: "admin@trufflescafe.com", password: "admin123" } });
  check("the old default admin account (admin123) no longer works", defaults.status === 401, `status ${defaults.status}`);
  const mgr = await call("POST", "/auth/login", { body: { email: "manager@trufflescafe.com", password: "admin123" } });
  check("the old default manager account no longer works", mgr.status === 401);

  const wrongPw = await call("POST", "/auth/login", { body: { email: ADMIN_EMAIL ?? "admin@truffles.local", password: "definitely-wrong-123" } });
  const noUser = await call("POST", "/auth/login", { body: { email: "nobody-at-all@example.com", password: "definitely-wrong-123" } });
  check("wrong password and unknown email give the identical message", wrongPw.json?.message === noUser.json?.message && noUser.status === 401, `${wrongPw.json?.message} | ${noUser.json?.message}`);

  // Forged tokens
  const claims = { id: "user-admin-1", email: "admin@trufflescafe.com", name: "Forged", role: "super_admin" };
  const forgedDefault = jwt.sign(claims, "super-secret-truffles-cafe-jwt-key-change-in-production-2026", { expiresIn: "1h" });
  const f1 = await call("GET", "/reservations", { headers: { Authorization: `Bearer ${forgedDefault}` } });
  check("a token forged with the old public default secret is rejected", f1.status === 401, `status ${f1.status}`);
  const noneTok = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.`;
  const f2 = await call("GET", "/reservations", { headers: { Authorization: `Bearer ${noneTok}` } });
  check("a token with algorithm 'none' is rejected", f2.status === 401);
  const f3 = await call("GET", "/reservations", { headers: { Authorization: "Bearer not.a.token" } });
  check("garbage token is rejected", f3.status === 401);

  // Everything staff-only must demand a login
  const staffOnly = [
    ["GET", "/reservations"], ["GET", "/reservations/res_x"], ["PATCH", "/reservations/res_x/status"],
    ["GET", "/orders"], ["PATCH", "/orders/order_x/status"], ["GET", "/contact"], ["PATCH", "/contact/inq_x/read"],
    ["GET", "/newsletter/subscribers"], ["GET", "/reviews/admin/all"], ["PATCH", "/reviews/rev_x/approval"],
    ["POST", "/menu"], ["PUT", "/menu/menu_x"], ["DELETE", "/menu/menu_x"], ["POST", "/events"], ["DELETE", "/events/event_x"],
    ["POST", "/auth/register-staff"], ["GET", "/auth/me"],
  ];
  const open = [];
  for (const [m, p] of staffOnly) {
    const r = await call(m, p, { body: ["POST", "PUT", "PATCH"].includes(m) ? {} : undefined });
    if (r.status !== 401) open.push(`${m} ${p} -> ${r.status}`);
  }
  check(`all ${staffOnly.length} staff-only endpoints require a login`, open.length === 0, open.join("; "));

  // ---------- data exposure / ownership ----------
  section("Customers can only reach their own data");
  const book = await call("POST", "/reservations", {
    origin: ORIGIN,
    body: { name: "Security Test", email: "sec@example.com", phone: "0300-1234567", date: future(30), time: "8:00 PM", guests: 2 },
  });
  const rid = book.json?.data?.id;
  const ctok = book.json?.data?.cancelToken;
  check("a booking is accepted (201)", book.status === 201, `status ${book.status} ${book.text.slice(0, 120)}`);
  check("booking id is unguessable (random UUID, not a timestamp)", /^res_[0-9a-f-]{36}$/.test(rid ?? ""), rid);
  check("booking response does not echo the guest's personal details", !/Security Test|sec@example\.com|0300-1234567/.test(book.text));
  check("booking response gives the guest a secret cancel token", typeof ctok === "string" && ctok.length >= 30);

  const noTok = await call("PATCH", `/reservations/${rid}/cancel`, { body: {} });
  check("cancelling without the token is refused", noTok.status === 422, `status ${noTok.status}`);
  const badTok = await call("PATCH", `/reservations/${rid}/cancel`, { body: { token: "x".repeat(43) } });
  check("cancelling with a wrong token is refused", badTok.status === 404, `status ${badTok.status}`);
  const guess = await call("PATCH", `/reservations/res_${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}/cancel`, { body: { token: ctok } });
  check("a guessed reservation id cannot be cancelled", guess.status === 404);
  check("wrong id / wrong token / replay all look identical (no probing)", badTok.json?.message === guess.json?.message);
  const good = await call("PATCH", `/reservations/${rid}/cancel`, { body: { token: ctok } });
  check("the real owner (id + token) can cancel", good.status === 200 && good.json?.data?.status === "cancelled", `status ${good.status}`);
  const again = await call("PATCH", `/reservations/${rid}/cancel`, { body: { token: ctok } });
  check("a cancelled booking cannot be cancelled again", again.status === 404);

  const menu = await call("GET", "/menu");
  const dish = menu.json?.data?.[0];
  const order = await call("POST", "/orders", {
    origin: ORIGIN,
    body: { customerName: "Order Test", customerEmail: "ord@example.com", customerPhone: "0300-7654321", orderType: "takeout", items: [{ menuItemId: dish?.id, quantity: 1 }] },
  });
  const oid = order.json?.data?.id;
  const otok = order.json?.data?.accessToken;
  check("an order is accepted (201)", order.status === 201, `status ${order.status} ${order.text.slice(0, 120)}`);
  check("order id is unguessable", /^order_[0-9a-f-]{36}$/.test(oid ?? ""), oid);
  check("order response never contains the token hash", !/accessTokenHash/.test(order.text));
  const o1 = await call("GET", `/orders/${oid}`);
  check("an order cannot be read without its token (no customer data leak)", o1.status === 404 && !/Order Test|ord@example/.test(o1.text), `status ${o1.status}`);
  const o2 = await call("GET", `/orders/${oid}`, { headers: { "X-Order-Token": "y".repeat(43) } });
  check("an order cannot be read with a wrong token", o2.status === 404);
  const o3 = await call("GET", `/orders/${oid}`, { headers: { "X-Order-Token": otok } });
  check("the customer can read their own order with the token", o3.status === 200 && o3.json?.data?.customerName === "Order Test");

  // Reviews are moderated
  const marker = `Moderation-${Date.now()}`;
  const rv = await call("POST", "/reviews", { origin: ORIGIN, body: { name: "Review Tester", rating: 5, comment: `${marker} a lovely evening` } });
  check("a review is accepted (201)", rv.status === 201);
  const pub = await call("GET", "/reviews");
  check("a new review is NOT published until staff approve it", !pub.text.includes(marker));
  check("public reviews expose only name, rating, comment, date", !(pub.json?.data ?? []).some((r) => "id" in r || "isApproved" in r));

  // Newsletter cannot be used to find who is subscribed
  const em = `news${Date.now()}@example.com`;
  const s1 = await call("POST", "/newsletter/subscribe", { body: { email: em } });
  const s2 = await call("POST", "/newsletter/subscribe", { body: { email: em } });
  check("subscribing twice gives the same answer (no 'already subscribed' leak)", s1.status === s2.status && s1.json?.message === s2.json?.message, `${s1.status}/${s2.status}`);
  const un = await call("POST", "/newsletter/unsubscribe", { body: { email: em, token: "z".repeat(43) } });
  check("unsubscribing someone else's address needs a valid token (answers generically)", un.status === 200 && /If that address/.test(un.json?.message ?? ""));
  const un2 = await call("POST", "/newsletter/unsubscribe", { body: { email: em } });
  check("unsubscribe without a token is refused", un2.status === 422);

  // ---------- input hardening ----------
  section("Input hardening");
  const big = await call("POST", "/contact", { body: { name: "Big", email: "big@example.com", subject: "Large body", message: "x".repeat(200_000) } });
  check("an oversized request body is refused (413)", big.status === 413, `status ${big.status}`);
  const badJson = await call("POST", "/contact", { raw: "{not json", headers: { "Content-Type": "application/json" } });
  check("malformed JSON gives a clean 400", badJson.status === 400 && !/Unexpected|position|SyntaxError/.test(badJson.text), badJson.text.slice(0, 100));
  const form = await call("POST", "/contact", { raw: "name=a&email=b", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  check("form-encoded / non-JSON bodies are refused (415)", form.status === 415, `status ${form.status}`);
  const longField = await call("POST", "/contact", { body: { name: "A".repeat(500), email: "a@example.com", subject: "Long name", message: "A message long enough to pass." } });
  check("over-long fields are rejected (422)", longField.status === 422);
  const badDate = await call("POST", "/reservations", { body: { name: "Past Date", email: "p@example.com", phone: "0300-1234567", date: "2020-01-01", time: "8:00 PM", guests: 2 } });
  check("a reservation in the past is rejected", badDate.status === 422);
  const fakeDate = await call("POST", "/reservations", { body: { name: "Fake Date", email: "p@example.com", phone: "0300-1234567", date: "2027-02-31", time: "8:00 PM", guests: 2 } });
  check("an impossible date (31 Feb) is rejected", fakeDate.status === 422);
  const tooMany = await call("POST", "/reservations", { body: { name: "Too Many", email: "p@example.com", phone: "0300-1234567", date: future(10), time: "8:00 PM", guests: 5000 } });
  check("an absurd party size is rejected", tooMany.status === 422);
  const badPhone = await call("POST", "/contact", { body: { name: "Bad Phone", email: "a@example.com", phone: "<script>alert(1)</script>", subject: "Bad phone", message: "A message long enough to pass." } });
  check("a script in the phone field is rejected", badPhone.status === 422);
  const proto = await call("POST", "/contact", { raw: '{"name":"Proto","email":"p@example.com","subject":"Proto test","message":"A message long enough.","__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}}}', headers: { "Content-Type": "application/json" } });
  check("prototype-pollution keys are harmless", proto.status === 201 || proto.status === 422);
  check("the server still behaves normally afterwards", (await call("GET", "/health")).status === 200 && !({}).isAdmin);
  const honey = await call("POST", "/contact", { body: { name: "Bot", email: "bot@example.com", subject: "Spam", message: "Buy cheap watches now please.", website: "http://spam.example" } });
  check("the bot trap swallows form spam without storing it", honey.status === 201 && honey.json?.data?.id === "received");
  const qs = await call("GET", "/menu?category[]=a&category=b&search=" + "x".repeat(500));
  check("hostile query strings give a clean 4xx, not a crash", qs.status >= 400 && qs.status < 500, `status ${qs.status}`);

  // ---------- logged-in behaviour (needs credentials) ----------
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    section("Staff sessions (logged in as the admin you provided)");
    const login = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
    const lj = await login.json();
    const token = lj?.data?.token;
    const cookies = login.headers.getSetCookie().join("; ");
    check("admin login works", login.status === 200 && !!token, `status ${login.status}`);
    check("session cookie is HttpOnly", /httponly/i.test(cookies));
    check("session cookie is SameSite=Strict", /samesite=strict/i.test(cookies));
    if (process.env.CHECK_PROD) {
      check("production: session cookie is Secure and __Host- prefixed", /secure/i.test(cookies) && /^__Host-token=/.test(cookies));
    }
    const cookieValue = cookies.split(";")[0];

    const listed = await call("GET", "/reservations", { headers: { Authorization: `Bearer ${token}` } });
    check("a valid token reaches staff data", listed.status === 200);
    check("staff data never contains token hashes", !/cancelTokenHash|accessTokenHash|passwordHash/.test(listed.text));
    const me = await call("GET", "/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    check("profile never contains a password hash", me.status === 200 && !/passwordHash/.test(me.text));

    const csrf = await call("PATCH", "/reservations/res_x/status", { headers: { Cookie: cookieValue }, origin: EVIL, body: { status: "confirmed" } });
    check("a cookie-authenticated write from another website is blocked (CSRF)", csrf.status === 403, `status ${csrf.status}`);
    const csrf2 = await call("PATCH", "/reservations/res_x/status", { headers: { Cookie: cookieValue }, body: { status: "confirmed" } });
    check("a cookie-authenticated write with no Origin at all is blocked", csrf2.status === 403, `status ${csrf2.status}`);

    const weak = await call("POST", "/auth/register-staff", { headers: { Authorization: `Bearer ${token}` }, body: { name: "Weak User", email: `weak${Date.now()}@example.com`, password: "password123", role: "staff" } });
    check("a weak staff password is refused", weak.status === 422, `status ${weak.status}`);
    const staffEmail = `staff${Date.now()}@example.com`;
    const staffPw = "Tr0ub4dor&Horse-Battery!";
    const mk = await call("POST", "/auth/register-staff", { headers: { Authorization: `Bearer ${token}` }, body: { name: "Staff Member", email: staffEmail, password: staffPw, role: "staff" } });
    check("a strong staff account can be created", mk.status === 201, `status ${mk.status}`);
    const sl = await call("POST", "/auth/login", { body: { email: staffEmail, password: staffPw } });
    const stoken = sl.json?.data?.token;
    const esc = await call("POST", "/auth/register-staff", { headers: { Authorization: `Bearer ${stoken}` }, body: { name: "Sneaky", email: `sneaky${Date.now()}@example.com`, password: "Tr0ub4dor&Horse-Battery!", role: "admin" } });
    check("a staff member cannot create accounts (no privilege escalation)", esc.status === 403, `status ${esc.status}`);
    const stk2 = await call("GET", "/newsletter/subscribers", { headers: { Authorization: `Bearer ${stoken}` } });
    check("a staff member cannot read the subscriber list (role limits)", stk2.status === 403, `status ${stk2.status}`);

    const out = await call("POST", "/auth/logout", { headers: { Authorization: `Bearer ${token}` } });
    check("logout succeeds", out.status === 200);
    const after = await call("GET", "/reservations", { headers: { Authorization: `Bearer ${token}` } });
    check("a token is dead after logout (revoked server-side)", after.status === 401, `status ${after.status}`);
  } else {
    console.log("\n(skipped: logged-in tests. Set CHECK_ADMIN_EMAIL and CHECK_ADMIN_PASSWORD to include them.)");
  }

  // ---------- result ----------
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log("\nFailures:\n" + failures.map((f) => "  - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Security check crashed:", e);
  process.exit(2);
});
