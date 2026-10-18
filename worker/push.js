// 집핀 관심 구역 알림 — /api/push/* 요청과 매일 cron 발송. 정적 파일은 건드리지 않는다(env.ASSETS로 그대로 넘김).
// KV(env.PUSH) 키: "vapid"(키쌍) · "state"({last, pend}) · "sub:<엔드포인트 해시>"({s, z, c, at})
import { vapidKeys, sendPush, b64u } from "./webpush.js";

const MAXZ = 20, MAXC = 3, MAXCZ = 150, MAXBODY = 16384;
const ID = /^[A-Za-z0-9_-]{1,24}$/;
const KINDS = ["", "redev", "rebuild", "small"];
// 푸시 서비스 주소만 받는다(아무 주소로나 POST를 보내게 되지 않도록)
const PUSH_HOST = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const subject = (env) => env.VAPID_SUBJECT || "https://jaegaebal.alwaysquestions.kr/";
const testHosts = (env) => String(env.PUSH_TEST_HOSTS || "").split(",").map((x) => x.trim()).filter(Boolean);

async function subKey(endpoint) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)));
  return "sub:" + b64u(h.slice(0, 18));
}
export function okEndpoint(ep, env = {}) {
  let u; try { u = new URL(ep); } catch (e) { return false; }
  if (testHosts(env).includes(u.hostname)) return u.protocol === "http:" || u.protocol === "https:";   // 로컬 시험용(배포 설정엔 두지 않는다)
  return u.protocol === "https:" && PUSH_HOST.test(u.hostname) && ep.length <= 1024;
}
/** 받은 구독 본문 검사 → 저장할 값(아니면 null) */
export function cleanSub(b, env) {
  if (!b || typeof b !== "object") return null;
  const s = b.sub || {}, k = s.keys || {};
  if (!okEndpoint(s.endpoint, env)) return null;
  if (typeof k.p256dh !== "string" || typeof k.auth !== "string" || !/^[A-Za-z0-9_-]{80,100}$/.test(k.p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(k.auth)) return null;
  const z = [...new Set((Array.isArray(b.zones) ? b.zones : []).filter((x) => typeof x === "string" && ID.test(x)))].slice(0, MAXZ);
  const c = (Array.isArray(b.conds) ? b.conds : []).slice(0, MAXC).map((x) => ({
    n: String((x && x.n) || "").slice(0, 30),
    cash: Math.max(0, Math.min(100, +(x && x.cash) || 0)),
    mode: x && x.mode === "gap" ? "gap" : "cash",
    gu: typeof (x && x.gu) === "string" && /^[가-힣]{1,5}구$/.test(x.gu) ? x.gu : "",
    kind: KINDS.includes(x && x.kind) ? x.kind : "",
    minS: Math.max(0, Math.min(9, Math.floor(+(x && x.minS) || 0))),
    // 지금 조건에 맞는 구역(앱 엔진 판정) — 그 구역에 경매 물건이 나오면 알린다
    z: [...new Set((Array.isArray(x && x.z) ? x.z : []).filter((i) => typeof i === "string" && ID.test(i)))].slice(0, MAXCZ),
  })).filter((x) => x.cash > 0);
  return { s: { endpoint: s.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } }, z, c, at: new Date().toISOString() };
}

async function readBody(req) {
  const t = await req.text();
  if (t.length > MAXBODY) return null;
  try { return JSON.parse(t); } catch (e) { return null; }
}
// 다른 사이트에서 몰래 보내는 요청 막기: Origin이 있으면 같은 출처여야
const sameOrigin = (req) => { const o = req.headers.get("Origin"); return !o || o === new URL(req.url).origin; };

export async function handleFetch(req, env) {
  const u = new URL(req.url), p = u.pathname;
  if (!p.startsWith("/api/push/")) return env.ASSETS.fetch(req);
  if (!env.PUSH) return json({ error: "push off" }, 503);
  if (p === "/api/push/key" && req.method === "GET") {
    const k = await vapidKeys(env);
    return json({ key: k.pub });
  }
  if ((p === "/api/push/sub" || p === "/api/push/unsub") && req.method === "POST") {
    if (!sameOrigin(req)) return json({ error: "origin" }, 403);
    const b = await readBody(req);
    if (!b) return json({ error: "body" }, 400);
    if (p === "/api/push/unsub") {
      const ep = b.endpoint || (b.sub && b.sub.endpoint);
      if (typeof ep !== "string" || !ep) return json({ error: "endpoint" }, 400);
      await env.PUSH.delete(await subKey(ep));
      return json({ ok: true });
    }
    const v = cleanSub(b, env);
    if (!v) return json({ error: "subscription" }, 400);
    await env.PUSH.put(await subKey(v.s.endpoint), JSON.stringify(v));
    return json({ ok: true, zones: v.z.length, conds: v.c.length });
  }
  return json({ error: "not found" }, 404);
}

// ---------- 발송 ----------
const TYPE_T = { stage: "단계", trade: "실거래", notice: "고시·공고", auction: "경매", price: "필요한 돈" };
const cashT = (v) => (v >= 1 ? `${Math.round(v * 10) / 10}억` : `${Math.round(v * 10)}천`);
/** 구독 하나와 맞는 사건: 핀 구역의 단계·실거래·고시 + 조건 핀 금액 안으로 들어온 구역(price) */
export function match(sub, items) {
  const Z = new Set(sub.z || []), zone = [], cond = [];
  for (const e of items) {
    if (Z.has(e.id) && e.type !== "price") zone.push(e);
    if (e.type === "auction" && !Z.has(e.id)) {
      const c = (sub.c || []).find((x) => Array.isArray(x.z) && x.z.includes(e.id) && !(e.mn > x.cash * 1.1 + 1e-9));   // 대표 물건 최저가(억)가 조건 현금(+10%) 안일 때만
      if (c) cond.push({ e, c });
    }
    if (e.type === "price" && e.v) {
      for (const c of sub.c || []) {
        const m = c.mode === "gap" ? "g" : "c", v = e.v[m];
        if (!v || !(v[0] > c.cash + 1e-9 && v[1] <= c.cash + 1e-9)) continue;
        if (c.gu && e.g !== c.gu) continue;
        if (c.kind && e.kd !== c.kind) continue;
        if (c.minS && !(e.s >= c.minS)) continue;
        cond.push({ e, c }); break;
      }
    }
  }
  return { zone, cond };
}
/** 알림 한 통(구독마다 하루 한 통으로 묶는다) */
export function compose(m, date) {
  const L = [];
  m.zone.forEach((e) => L.push(`${e.n} · ${e.text}`));
  m.cond.forEach(({ e, c }) => L.push(e.type === "auction" ? `${e.n} · ${e.text}` : `${e.n} · ${c.mode === "gap" ? "전세" : "대출"} 끼고 ${cashT(e.v[c.mode === "gap" ? "g" : "c"][1])} → 내 돈으로 살 수 있게 됐어요`));
  if (!L.length) return null;
  const zIds = [...new Set(m.zone.map((e) => e.id))];
  let title, url;
  if (m.zone.length === 1 && !m.cond.length) { const e = m.zone[0]; title = `${e.n} · ${TYPE_T[e.type] || "새 소식"}`; url = "/#" + e.id; }
  else if (!m.zone.length && m.cond.length === 1) { const e = m.cond[0].e; title = e.type === "auction" ? `${e.n} · 경매 물건 등장` : "이 돈으로 살 수 있는 곳이 생겼어요"; url = "/#" + e.id; }
  else { title = zIds.length ? `관심 구역 ${zIds.length}곳에 새 소식${m.cond.length ? ` · 알림 조건 ${m.cond.length}곳` : ""}` : `알림 조건에 맞는 새 소식 ${m.cond.length}곳`; url = zIds.length === 1 && !m.cond.length ? "/#" + zIds[0] : "/#inbox"; }
  const body = (m.zone.length === 1 && !m.cond.length ? [m.zone[0].text] : L.slice(0, 3)).join("\n") + (L.length > 3 ? `\n외 ${L.length - 3}건` : "");
  return { title, body: body.slice(0, 600), url, tag: "zippin-" + date };
}

async function loadChanges(env) {
  const r = await env.ASSETS.fetch(new Request("https://assets.local/data/changes.json"));
  if (!r.ok) throw new Error("changes.json " + r.status);
  return r.json();
}
/** 매일 cron: 지난번 뒤로 새로 생긴 날의 사건만 보낸다. 한 번에 batch개까지 보내고 남으면 커서를 저장해 다음 실행에서 잇는다 */
export async function runCron(env, opts = {}) {
  const batch = opts.batch || +env.PUSH_BATCH || 45;
  const st = (await env.PUSH.get("state", "json")) || {};
  const ch = await loadChanges(env);
  const items = Array.isArray(ch.items) ? ch.items : [];
  const maxDate = items.reduce((m, e) => (e.date > m ? e.date : m), "");
  let pend = st.pend;
  if (!pend) {
    // 처음 돌 때는 가장 최근 날 하루치만(지난 30일을 한꺼번에 보내지 않게)
    const from = st.last || (maxDate ? prevDay(maxDate) : "");
    if (!maxDate || maxDate <= from) return { sent: 0, skipped: "no new", last: st.last || null };
    pend = { from, to: maxDate, cursor: null };
  }
  const fresh = items.filter((e) => e.date > pend.from && e.date <= pend.to);
  const keys = await vapidKeys(env);
  let sent = 0, gone = 0, fail = 0, seen = 0, done = false;
  // 보낸 건수(외부 요청)만 batch로 센다. 끊기면 {cursor: 이 페이지의 시작 커서, off: 페이지 안 위치}를 남겨 다음 실행에서 잇는다
  outer: for (;;) {
    const L = await env.PUSH.list({ prefix: "sub:", cursor: pend.cursor || undefined, limit: 200 });
    for (let i = pend.off || 0; i < L.keys.length; i++) {
      if (sent + gone + fail >= batch) { pend.off = i; break outer; }
      seen++;
      const sub = await env.PUSH.get(L.keys[i].name, "json");
      if (!sub || !sub.s) continue;
      const msg = compose(match(sub, fresh), pend.to);
      if (!msg) continue;
      let code = 0;
      try { code = await sendPush(sub.s, msg, keys, subject(env), { fetch: opts.fetch }); } catch (e) { code = -1; }
      if (code === 404 || code === 410) { await env.PUSH.delete(L.keys[i].name); gone++; }
      else if (code >= 200 && code < 300) sent++;
      else fail++;
    }
    pend.off = 0;
    if (L.list_complete || !L.cursor) { done = true; break; }
    pend.cursor = L.cursor;
  }
  if (done) await env.PUSH.put("state", JSON.stringify({ last: pend.to, at: new Date().toISOString() }));
  else await env.PUSH.put("state", JSON.stringify({ last: st.last || null, pend }));
  return { sent, gone, fail, seen, events: fresh.length, done, to: pend.to };
}
const prevDay = (d) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
