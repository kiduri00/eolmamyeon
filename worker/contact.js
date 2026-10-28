// 집핀 문의(사이트 안 문의 양식) — POST /api/contact 와 운영자용 /api/contact/admin/*.
// KV(env.PUSH) 키:
//   msg:<ISO 시각>:<난수>       문의 한 건 {kind, text, email, zone, url, why, nums, asOf, ua, ts, read} · 180일 뒤 저절로 지워짐 · IP는 저장하지 않는다
//   rl:<해시>:<YYYYMMDDHH>      보낸 횟수(1시간 · 해시 = SHA-256(IP + 그날 소금)) · 1시간 뒤 지워짐
//   salt:<YYYY-MM-DD>           그날 소금(난수, 2일 뒤 지워짐) — 다음 날이면 같은 IP도 다른 해시가 된다
//   admin:tokenhash             운영자 토큰의 SHA-256(16진수). 토큰은 /api/contact/admin/init 이 딱 한 번만 만들어 돌려준다
//   admin:sub                   운영자 기기의 웹 푸시 구독(새 문의 알림)
import { vapidKeys, sendPush, b64u } from "./webpush.js";
import { okEndpoint } from "./push.js";

export const KINDS = { general: "일반 문의", error: "숫자 오류", idea: "기능 제안", etc: "기타" };
export const MIN = 10, MAX = 2000, PER_HOUR = 5, KEEP_DAYS = 180;
const MAXBODY = 16384;
const EMAIL = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const ZONE = /^[A-Za-z0-9_-]{1,24}$/;
const MSG_ID = /^msg:\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z:[A-Za-z0-9_-]{6,16}$/;
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const enc = (s) => new TextEncoder().encode(s);
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256hex(s) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc(s)))); }
const rand = (n) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sameOrigin = (req) => { const o = req.headers.get("Origin"); return !o || o === new URL(req.url).origin; };
async function readBody(req) {
  const t = await req.text();
  if (t.length > MAXBODY) return null;
  try { const b = JSON.parse(t); return b && typeof b === "object" ? b : null; } catch (e) { return null; }
}
const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** 받은 문의 본문 검사 → {ok, v} 또는 {error} */
export function cleanMsg(b) {
  if (!b || typeof b !== "object") return { error: "body" };
  if (typeof b.website === "string" && b.website.trim()) return { error: "spam" };   // 사람 눈에 안 보이는 칸(허니팟)을 채웠으면 로봇
  const kind = Object.prototype.hasOwnProperty.call(KINDS, b.kind) ? b.kind : null;
  if (!kind) return { error: "kind" };
  const text = typeof b.text === "string" ? b.text.replace(/\r\n?/g, "\n").trim() : "";
  if (text.length < MIN || text.length > MAX) return { error: "text" };
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (email && (email.length > 254 || !EMAIL.test(email))) return { error: "email" };
  const zone = typeof b.zone === "string" && ZONE.test(b.zone) ? b.zone : "";
  let url = "";
  try { const u = new URL(str(b.url, 300)); if (u.protocol === "https:" || u.protocol === "http:") url = u.href.slice(0, 300); } catch (e) {}
  return { ok: true, v: { kind, text, email, zone, url, why: str(b.why, 80), nums: str(b.nums, 300), asOf: str(b.asOf, 20) } };
}

async function daySalt(env, day) {
  const k = "salt:" + day;
  let s = await env.PUSH.get(k);
  if (!s) { s = rand(24); await env.PUSH.put(k, s, { expirationTtl: 2 * 86400 }); }
  return s;
}
/** 1시간에 PER_HOUR번까지(IP는 그날 소금과 함께 해시만 · 1시간 뒤 지워짐) → 넘었으면 false */
export async function rateOk(env, ip, now = new Date()) {
  const iso = now.toISOString(), day = iso.slice(0, 10), hr = iso.slice(0, 13).replace(/\D/g, "");
  const h = (await sha256hex((ip || "?") + "|" + (await daySalt(env, day)))).slice(0, 32);
  const k = `rl:${h}:${hr}`, n = +((await env.PUSH.get(k)) || 0);
  if (n >= PER_HOUR) return false;
  await env.PUSH.put(k, String(n + 1), { expirationTtl: 3700 });
  return true;
}

async function adminOk(req, env) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(req.headers.get("Authorization") || "");
  if (!m) return false;
  const want = await env.PUSH.get("admin:tokenhash");
  if (!want) return false;
  const got = await sha256hex(m[1]);
  if (got.length !== want.length) return false;
  let d = 0; for (let i = 0; i < got.length; i++) d |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0;
}
const subject = (env) => env.VAPID_SUBJECT || "https://jaegaebal.alwaysquestions.kr/";
async function notifyAdmin(env, v, opts = {}) {
  const sub = await env.PUSH.get("admin:sub", "json");
  if (!sub || !sub.endpoint) return 0;
  const keys = await vapidKeys(env);
  const msg = { title: `새 문의 1건 · ${KINDS[v.kind]}`, body: v.text.slice(0, 80) + (v.text.length > 80 ? "…" : ""), url: "/admin.html", tag: "jp-admin-" + Date.now() };
  let code = 0;
  try { code = await sendPush(sub, msg, keys, subject(env), { fetch: opts.fetch }); } catch (e) { code = -1; }
  if (code === 404 || code === 410) await env.PUSH.delete("admin:sub");
  return code;
}

// 막 지운 문의 키(5분): KV list가 지운 키를 한동안 더 돌려줘 '모두 N건'이 줄지 않던 것(21차)
const DEL_KEY = "admin:del", DEL_MS = 5 * 60 * 1000;
async function delSet(env) {
  let L = []; try { L = (await env.PUSH.get(DEL_KEY, "json")) || []; } catch (e) { L = []; }
  const t = Date.now();
  return new Set((Array.isArray(L) ? L : []).filter((x) => x && t - x.t < DEL_MS).map((x) => x.id));
}
async function delMark(env, id) {
  let L = []; try { L = (await env.PUSH.get(DEL_KEY, "json")) || []; } catch (e) { L = []; }
  const t = Date.now();
  L = (Array.isArray(L) ? L : []).filter((x) => x && t - x.t < DEL_MS && x.id !== id).slice(-200);
  L.push({ id, t });
  await env.PUSH.put(DEL_KEY, JSON.stringify(L), { expirationTtl: 600 });
}
export async function handleContact(req, env, ctx, opts = {}) {
  const u = new URL(req.url), p = u.pathname.replace(/\/+$/, "");
  if (!env.PUSH) return json({ error: "off" }, 503);
  // ---- 방문자: 문의 보내기 ----
  if (p === "/api/contact") {
    if (req.method !== "POST") return json({ error: "method" }, 405);
    if (!sameOrigin(req)) return json({ error: "origin" }, 403);
    const b = await readBody(req);
    if (!b) return json({ error: "body" }, 400);
    const c = cleanMsg(b);
    if (!c.ok) return json({ error: c.error }, 400);
    if (!(await rateOk(env, req.headers.get("CF-Connecting-IP") || "", opts.now))) return json({ error: "rate" }, 429);
    const now = opts.now || new Date(), ts = now.toISOString();
    const v = { ...c.v, ua: String(req.headers.get("User-Agent") || "").replace(/\s+/g, " ").slice(0, 120), ts, read: false };
    const id = `msg:${ts}:${rand(9)}`;
    await env.PUSH.put(id, JSON.stringify(v), { expirationTtl: KEEP_DAYS * 86400 });
    const job = notifyAdmin(env, v, opts).catch(() => 0);
    if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
    return json({ ok: true });
  }
  // ---- 운영자 ----
  if (p === "/api/contact/admin/init") {
    if (req.method !== "GET" && req.method !== "POST") return json({ error: "method" }, 405);
    if (await env.PUSH.get("admin:tokenhash")) return json({ error: "already initialised" }, 403);
    const token = rand(32);
    await env.PUSH.put("admin:tokenhash", await sha256hex(token));
    return json({ token, note: "이 토큰은 다시 보여 주지 않아요. /admin.html 에 한 번 넣으면 그 기기에 저장돼요." });
  }
  if (!p.startsWith("/api/contact/admin/")) return json({ error: "not found" }, 404);
  if (!(await adminOk(req, env))) return json({ error: "auth" }, 401);
  if (p === "/api/contact/admin/list" && req.method === "GET") {
    // KV 목록은 이름 오름차순(= 오래된 순) → 이름만 다 모아 최신순으로 뒤집고, 커서 = 건너뛸 개수
    const names = []; let cur;
    for (let i = 0; i < 50; i++) { const L = await env.PUSH.list({ prefix: "msg:", cursor: cur, limit: 1000 }); L.keys.forEach((k) => names.push(k.name)); if (L.list_complete || !L.cursor) break; cur = L.cursor; }
    // KV 목록은 지운 뒤에도 최대 60초 동안 지운 키를 돌려준다(전 세계 복제 지연) → 막 지운 키(admin:del, 5분)를 빼고 센다
    const gone = await delSet(env), live0 = names.filter((n) => !gone.has(n));
    names.length = 0; names.push(...live0);
    names.sort().reverse();
    const off = Math.max(0, Math.floor(+u.searchParams.get("cursor") || 0)), lim = Math.max(1, Math.min(100, Math.floor(+u.searchParams.get("limit") || 30)));
    const page = names.slice(off, off + lim), items = [];
    let miss = 0;
    for (const id of page) { const v = await env.PUSH.get(id, "json"); if (v) items.push({ id, ...v, kindT: KINDS[v.kind] || v.kind }); else miss++; }
    // 목록에는 있는데 값이 없는 키(만료·다른 곳에서 지움)는 세지 않는다
    return json({ items, total: Math.max(0, names.length - miss), unread: null, cursor: off + lim < names.length ? String(off + lim) : null });
  }
  if ((p === "/api/contact/admin/read" || p === "/api/contact/admin/delete") && req.method === "POST") {
    const b = await readBody(req), id = b && typeof b.id === "string" ? b.id : "";
    if (!MSG_ID.test(id)) return json({ error: "id" }, 400);
    if (p.endsWith("/delete")) { await env.PUSH.delete(id); await delMark(env, id); return json({ ok: true }); }
    const v = await env.PUSH.get(id, "json");
    if (!v) return json({ error: "gone" }, 404);
    v.read = b.read !== false;
    // 처음 저장한 때부터 180일 — 읽음 표시를 해도 지워질 날은 그대로
    const exp = Math.floor(new Date(v.ts).getTime() / 1000) + KEEP_DAYS * 86400, nowS = Math.floor(Date.now() / 1000);
    await env.PUSH.put(id, JSON.stringify(v), exp - nowS > 60 ? { expiration: exp } : { expirationTtl: 60 });
    return json({ ok: true });
  }
  if (p === "/api/contact/admin/sub" && req.method === "POST") {
    const b = await readBody(req), s = b && b.sub, k = (s && s.keys) || {};
    if (!s || !okEndpoint(s.endpoint, env) || typeof k.p256dh !== "string" || typeof k.auth !== "string" || !/^[A-Za-z0-9_-]{80,100}$/.test(k.p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(k.auth)) return json({ error: "subscription" }, 400);
    await env.PUSH.put("admin:sub", JSON.stringify({ endpoint: s.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } }));
    return json({ ok: true });
  }
  if (p === "/api/contact/admin/unsub" && req.method === "POST") { await env.PUSH.delete("admin:sub"); return json({ ok: true }); }
  if (p === "/api/contact/admin/key" && req.method === "GET") { const k = await vapidKeys(env); return json({ key: k.pub }); }
  return json({ error: "not found" }, 404);
}
