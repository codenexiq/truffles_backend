// Starts the COMPILED API in development mode (in-memory demo data) and checks the staff dashboard routes:
//   npm run build && npm run test:dashboard
// It uses its own random secrets and a throw-away port, and never touches .env or a running server.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5159;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
const DASH = `${BASE}/dashboard/reservations`;
const ORIGIN = "http://localhost:3000"; // the site origin the server always allows in development mode
const PASSWORD = "Zx9!mQ4#vL2$wT8pR-dash";

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "dash-smoke-")); // empty folder: no .env is picked up
const child = spawn(process.execPath, [path.join(root, "dist/server.js")], {
  cwd: sandbox,
  env: {
    PATH: process.env.PATH,
    NODE_ENV: "development",
    PORT: String(PORT),
    JWT_SECRET: crypto.randomBytes(64).toString("hex"),
    CLIENT_URL: ORIGIN,
    ADMIN_EMAIL: "smoke@example.com",
    ADMIN_PASSWORD_HASH: bcrypt.hashSync(PASSWORD, 10),
    RATE_LIMIT_MAX: "5000",
  },
});
let serverLog = "";
child.stdout.on("data", (d) => (serverLog += d));
child.stderr.on("data", (d) => (serverLog += d));

let pass = 0;
let fail = 0;
const t = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = (url, o = {}) => fetch(url, { ...o, headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(o.headers ?? {}) } });

async function main() {
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    try {
      up = (await fetch(BASE + "/health")).ok;
    } catch {
      await sleep(300);
    }
  }
  t("server starts", up, serverLog.slice(-300));
  if (!up) return;

  console.log("--- login");
  let r = await call(DASH);
  t("dashboard without login -> 401", r.status === 401);
  r = await call(BASE + "/auth/login", { method: "POST", body: JSON.stringify({ email: "smoke@example.com", password: PASSWORD }) });
  const login = await r.json();
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  t("correct password -> 200 with a session cookie", r.status === 200 && cookie.startsWith("token="));
  const auth = { headers: { Cookie: cookie } };
  const bearer = { headers: { Authorization: `Bearer ${login.data.token}` } };

  console.log("--- reading reservations");
  r = await call(DASH + "?limit=5", auth);
  let body = await r.json();
  t("list returns items and paging", r.status === 200 && Array.isArray(body.data) && body.data.length === 5 && body.meta.total >= 12 && body.meta.totalPages >= 3);
  t("a reservation has no secret token field", body.data.every((x) => !("cancelTokenHash" in x) && !("cancel_token_hash" in x)));
  r = await call(DASH + "?status=pending&sort=date_asc", auth);
  body = await r.json();
  t("status filter returns only pending", body.data.length > 0 && body.data.every((x) => x.status === "pending"));
  t("date_asc sorts by date", body.data.every((x, i) => i === 0 || body.data[i - 1].date <= x.date));
  r = await call(DASH + "?q=hamza", auth);
  body = await r.json();
  t("search finds by name", body.data.length === 1 && /hamza/i.test(body.data[0].name));
  r = await call(DASH + "?limit=500", auth);
  t("limit above 100 is refused (422)", r.status === 422);
  r = await call(DASH + "?status=bogus", auth);
  t("unknown status is refused (422)", r.status === 422);
  r = await call(DASH + "/stats", bearer);
  body = await r.json();
  t("stats work with a bearer token", r.status === 200 && body.data.total >= 12 && typeof body.data.today.guests === "number");

  console.log("--- changing a status");
  r = await call(DASH + "?status=pending&limit=1", auth);
  const pending = (await r.json()).data[0];
  const patch = (id, status, extra = auth) => call(`${DASH}/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }), ...extra });
  r = await patch(pending.id, "confirmed");
  t("pending -> confirmed works", r.status === 200 && (await r.json()).data.status === "confirmed");
  r = await patch(pending.id, "pending");
  t("confirmed -> pending (undo) works", r.status === 200);
  await patch(pending.id, "cancelled");
  r = await patch(pending.id, "completed");
  t("cancelled -> completed is refused (409)", r.status === 409);
  r = await patch("does-not-exist", "confirmed");
  t("unknown id -> 404", r.status === 404);

  console.log("--- browser safety");
  r = await call(`${DASH}/${pending.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "pending" }), headers: { Origin: "https://evil.example", Cookie: cookie } });
  t("write from another website -> 403", r.status === 403);
  r = await fetch(DASH, { headers: { Origin: "https://evil.example", Cookie: cookie } });
  t("another website gets no CORS permission", !r.headers.get("access-control-allow-origin"));

  console.log("--- the public site still works");
  r = await call(BASE + "/health");
  t("health check ok", r.status === 200);
  r = await call(BASE + "/reservations", { headers: {} });
  t("public reservation list is still staff-only (401)", r.status === 401);

  console.log("--- blog posts and pictures (in-memory mode)");
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const upload = (body, type = "image/png", headers = auth.headers) => fetch(BASE + "/dashboard/media", { method: "POST", headers: { "Content-Type": type, Origin: ORIGIN, ...headers }, body });
  r = await fetch(BASE + "/dashboard/media", { method: "POST", headers: { "Content-Type": "image/png", Origin: ORIGIN }, body: PNG });
  t("upload without login -> 401", r.status === 401);
  r = await upload(PNG);
  const media = await r.json();
  t("PNG upload -> 201 with a /media/ path", r.status === 201 && /^\/media\/med_/.test(media.data?.path ?? ""));
  r = await upload(Buffer.from("<svg><script>alert(1)</script></svg>"));
  t("a script pretending to be a PNG is refused (400)", r.status === 400);
  r = await fetch(BASE + media.data.path);
  t("the picture can be fetched without login", r.status === 200 && r.headers.get("content-type") === "image/png" && r.headers.get("x-content-type-options") === "nosniff");

  const post = { title: "Smoke Test Post", excerpt: "A short summary for the smoke test.", category: "menu", author: "Tester", cover: media.data.path, coverAlt: "Test cover", status: "draft", date: new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10), body: [{ type: "p", text: "Hello" }, { type: "cta", text: "Book", label: "Reserve", href: "/reservations" }] };
  const blog = (p, o = {}) => call(`${BASE}/dashboard/blog${p}`, { ...o, ...auth });
  r = await blog("/posts", { method: "POST", body: JSON.stringify({ ...post, body: [{ type: "cta", text: "x", label: "y", href: "javascript:alert(1)" }] }) });
  t("a javascript: link is refused (422)", r.status === 422);
  r = await blog("/posts", { method: "POST", body: JSON.stringify(post) });
  const created = (await r.json()).data;
  t("draft created (201) with a slug from the title", r.status === 201 && created.slug === "smoke-test-post");
  r = await call(BASE + "/blog/posts");
  t("a draft is not on the public blog", (await r.json()).data.length === 0);
  r = await blog(`/posts/${created.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "published" }) });
  t("publish -> 200", r.status === 200);
  r = await call(BASE + "/blog/posts");
  const pub = (await r.json()).data;
  t("published post is on the public blog, without staff details", pub.length === 1 && pub[0].slug === "smoke-test-post" && !("createdBy" in pub[0]) && !("id" in pub[0]));
  r = await call(BASE + "/blog/posts/smoke-test-post");
  t("public get by slug -> 200", r.status === 200);
  r = await blog(`/posts/${created.id}`, { method: "DELETE" });
  t("delete -> 200", r.status === 200);
  r = await call(BASE + "/blog/posts/smoke-test-post");
  t("deleted post is gone from the public blog (404)", r.status === 404);

  console.log("--- maintenance mode (in-memory mode)");
  r = await call(BASE + "/site/status");
  t("public status: site is open by default, nothing else revealed", r.status === 200 && JSON.stringify((await r.json()).data) === JSON.stringify({ maintenance: { enabled: false } }));
  const maint = (body, headers = auth.headers) => call(`${BASE}/dashboard/maintenance`, { method: "PUT", body: JSON.stringify(body), headers });
  const notice = { enabled: true, title: "Back soon", message: "We are doing some work.", eta: "" };
  r = await call(`${BASE}/dashboard/maintenance`, { method: "PUT", body: JSON.stringify(notice) });
  t("switching it needs a login (401)", r.status === 401);
  r = await maint({ ...notice, title: "x" });
  t("a too-short heading is refused (422)", r.status === 422);
  r = await maint({ ...notice, enabled: "yes" });
  t("enabled must be true/false (422)", r.status === 422);
  r = await maint(notice, { Cookie: cookie, Origin: "https://evil.example" });
  t("switching from another website is refused (403)", r.status === 403);
  r = await maint(notice);
  t("switch ON -> 200", r.status === 200 && (await r.json()).data.enabled === true);
  r = await call(BASE + "/site/status");
  const on = (await r.json()).data.maintenance;
  t("public status now says ON with the title and message", on.enabled === true && on.title === "Back soon" && on.message === "We are doing some work." && !("updatedBy" in on));
  r = await maint({ ...notice, enabled: false });
  t("switch OFF -> 200", r.status === 200);
  r = await call(BASE + "/site/status");
  t("public status is back to open", (await r.json()).data.maintenance.enabled === false);
  r = await call(`${BASE}/dashboard/maintenance/history`, auth);
  t("history records both changes", (await r.json()).data.length === 2);

  console.log("--- logout");
  r = await call(BASE + "/auth/logout", { method: "POST", ...auth });
  t("logout ok", r.status === 200);
  r = await call(DASH, auth);
  t("the old session is dead after logout (401)", r.status === 401);
}

try {
  await main();
} catch (e) {
  fail++;
  console.log("  FAIL  unexpected error:", e);
} finally {
  await new Promise((resolve) => {
    child.on("exit", resolve);
    child.kill();
    setTimeout(resolve, 2000);
  });
  try {
    fs.rmSync(sandbox, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
