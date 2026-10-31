// 재개픽 관심 구역 알림 — /api/push/* 요청과 매일 cron 발송. 정적 파일은 건드리지 않는다(env.ASSETS로 그대로 넘김).
// KV(env.PUSH) 키: "vapid"(키쌍) · "state"({last, day, pend}) · "sub:<엔드포인트 해시>"({s, z, c, o, mz, f, at}) · o = 끈 알림 종류
// 사이클 5(A): 빈도 f = i 중요한 것만(기본: 단계 변경·인가 고시·내 돈 조건 진입·관심 구역 경매 새 물건·관심 구역 매각기일 전날) · d 매일 · w 주 1회(월요일 주간 요약)
//   하루 최대 1통(state.day = 보낸 서울 날짜 · 태그 jp-날짜) · 밀린 자료(bf)·계산 버전 바뀐 날(why cv)·원인 모름(na) 변화는 보내지 않는다
//   문장은 문구 사전(feed_words.js ← tools/feed_words.json) 한 곳 · 해제된 거래(x)는 정정 푸시를 따로 보내지 않고 다음 다이제스트에 '지난 소식 정정 N건'
import { vapidKeys, sendPush, b64u } from "./webpush.js";
import FW from "./feed_words.js";

const MAXZ = 20, MAXC = 3, MAXCZ = 500, MAXMZ = 200, MAXBODY = 32768;   // 사이클 4: MAXMZ = 끈 구역(mz) 상한(앱 72_inbox payload와 같음)   // 사이클 3: 조건 구역 150 → 500(경매 있는 구역 먼저 · 앱 72_inbox payload와 같은 상한)
const ID = /^[A-Za-z0-9_-]{1,24}$/;
const KINDS = ["", "redev", "rebuild", "small"];
export const FREQS = ["i", "d", "w"];
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
  // 끈 알림 종류(앱 MY > 알림 설정): 이 종류 사건은 보내지 않는다
  const o = [...new Set((Array.isArray(b.o) ? b.o : []).filter((x) => ["trade", "stage", "notice", "auction", "price"].includes(x)))];
  // 사이클 4: 끈 구역(앱 MY > 알림 설정 · 구역별 끄기) — 그 구역 사건은 핀·조건·경매·필요한 돈(price) 어느 경로로도 보내지 않는다
  const mz = [...new Set((Array.isArray(b.mz) ? b.mz : []).filter((x) => typeof x === "string" && ID.test(x)))].slice(0, MAXMZ);
  const f = FREQS.includes(b.f) ? b.f : "i";   // 사이클 5: 빈도(없으면 '중요한 것만')
  return { s: { endpoint: s.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } }, z, c, o, mz, f, at: new Date().toISOString() };
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
const TYPE_T = FW.type;
const fill = (t, o) => String(t).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? (typeof o[k] === "number" && Number.isInteger(o[k]) ? o[k].toLocaleString("ko-KR") : String(o[k])) : m));
const cashT = (v) => (v >= 1 ? `${Math.round(v * 10) / 10}억` : `${Math.round(v * 1e4).toLocaleString("ko-KR")}만`);
const aucAmt = (v) => (v == null || !isFinite(v) || v <= 0 ? "–" : v >= 1e8 ? `${(Math.floor(v / 1e7 + 0.5) / 10).toLocaleString("ko-KR")}억` : `${Math.floor(v / 1e4 + 0.5).toLocaleString("ko-KR")}만`);
const md = (d) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || ""); return m ? `${+m[2]}.${+m[3]}` : ""; };
/** 푸시로 보낼 수 있는 사건: 밀린 자료·계산 버전 변화·원인 모름이 아님 */
export const pushable = (e) => !!e && !e.bf && !(e.type === "price" && Array.isArray(e.why) && (e.why.includes("cv") || e.why.includes("na")));
/** '중요한 것만'(f=i)에 드는 관심 구역 사건: 단계 변경 · 인가 고시 · 경매 새 물건(유찰 하락 아님) */
export const important = (e) => e.type === "stage" || (e.type === "notice" && e.cat === "ok") || (e.type === "auction" && e.ak !== "drop");
/** 구독 하나와 맞는 사건: 핀 구역의 단계·실거래·고시 + 조건 핀 금액 안으로 들어온 구역(price)
 *  opt: {f 빈도, sched 내일 매각기일 줄(today.json auc), all 전체 사건(정정 셈), from·to 이번 창} */
export function match(sub, items, opt = {}) {
  const Z = new Set(sub.z || []), O = new Set(sub.o || []), MZ = new Set(sub.mz || []), zone = [], cond = [], sched = [];
  const f = opt.f || sub.f || "i";
  for (const e of items) {
    if (!pushable(e)) continue;
    if (O.has(e.type)) continue;
    if (MZ.has(e.id)) continue;   // 사이클 4: 끈 구역 = 그 구역 알림 전부 끔(price 조건 경로도)
    if (Z.has(e.id) && e.type !== "price") { if (f !== "i" || important(e)) zone.push(e); }
    if (e.type === "auction" && !Z.has(e.id) && f !== "i") {
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
  // 관심 구역 경매 매각기일 전날(D-1): today.json auc 줄 [구역, 사건번호, 물건번호, 매각기일, 시각, 최저가, …] — 출처 있는 날짜만
  if (!O.has("auction")) for (const a of opt.sched || []) if (Array.isArray(a) && Z.has(a[0]) && !MZ.has(a[0])) sched.push(a);
  // 지난 소식 정정: 관심 구역 거래 소식 중 이번 창에 해제가 확인된 것(정정 푸시를 따로 보내지 않고 셈만)
  let fix = 0;
  if (opt.all && opt.from != null && !O.has("trade")) for (const e of opt.all) if (e.type === "trade" && e.x && Z.has(e.id) && !MZ.has(e.id) && e.xd > opt.from && e.xd <= opt.to) fix++;
  return { zone, cond, sched, fix, f };
}
/** 알림 한 통(구독마다 하루 한 통으로 묶는다) · opt: {asOf 자료 기준일, wk 서울 이번 주 숫자(today.json seoul.w), name(구역 → 이름), f} */
export function compose(m, date, opt = {}) {
  const f = opt.f || m.f || "i", P = FW.push, L = [];
  m.zone.forEach((e) => L.push(`${e.n} · ${e.text}`));
  m.cond.forEach(({ e, c }) => L.push(e.type === "auction" ? `${e.n} · ${e.text}` : fill(P.cond, { n: e.n, mode: c.mode === "gap" ? "전세" : "대출", cash: cashT(e.v[c.mode === "gap" ? "g" : "c"][1]) })));
  (m.sched || []).forEach((a) => L.push(fill(P.dday, { n: (opt.name && opt.name(a[0])) || a[0], d: md(a[3]) + (a[4] ? " " + a[4] : ""), a: aucAmt(a[5]) })));
  const week = f === "w" && opt.wk;
  if (!L.length && !week) return null;
  const zIds = [...new Set(m.zone.map((e) => e.id).concat((m.sched || []).map((a) => a[0])))], cIds = [...new Set(m.cond.map((x) => x.e.id))];
  let title;
  if (f === "w") title = L.length ? fill(P.t_week, { z: zIds.length, n: L.length }) : P.t_week0;
  else if (!m.zone.length && !m.cond.length) title = fill(P.t_sched, { n: m.sched.length });
  else title = zIds.length && cIds.length ? fill(P.t_both, { z: zIds.length, c: cIds.length }) : zIds.length ? fill(P.t_zone, { z: zIds.length }) : fill(P.t_cond, { c: cIds.length });
  const one = zIds.length + cIds.length === 1 ? (zIds[0] || cIds[0]) : null;
  const url = `/?src=push&k=${f}&d=${date}#${one || "inbox"}`;   // 측정: 페이지 수로만(사용자 ID 없음)
  const head = [fill(P.asof, { d: md(opt.asOf || date) })];
  if (week) head.push(fill(P.wk, { trade: opt.wk.trade || 0, notice: opt.wk.notice || 0, auc_sale: opt.wk.auc_sale || 0 }));
  const tail = [];
  if (L.length > 3) tail.push(fill(P.more, { n: L.length - 3 }));
  if (m.fix) tail.push(fill(FW.x.fix, { n: m.fix }));
  const body = head.concat(L.slice(0, 3), tail).join("\n");
  return { title, body: body.slice(0, 600), url, tag: "jp-" + date };
}

async function loadChanges(env) {
  const r = await env.ASSETS.fetch(new Request("https://assets.local/data/changes.json"));
  if (!r.ok) throw new Error("changes.json " + r.status);
  return r.json();
}
async function loadToday(env) {   // 없거나 깨져도 발송은 계속(내일 매각기일·주간 숫자만 빠짐)
  try { const r = await env.ASSETS.fetch(new Request("https://assets.local/data/today.json")); return r.ok ? await r.json() : null; } catch (e) { return null; }
}
const kstDay = (t) => new Date(t + 9 * 36e5).toISOString().slice(0, 10);
const addDay = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const wday = (d) => new Date(d + "T00:00:00Z").getUTCDay();
/** 매일 cron(07:30 KST): 서울 날짜 하루에 한 번만 돈다. 지난번 뒤로 새로 생긴 날의 사건 + 관심 구역 내일 매각기일 + (월요일) 주간 요약.
 *  한 번에 batch개까지 보내고 남으면 커서를 저장해 다음 실행에서 잇는다(같은 구독에 두 번 보내지 않음) */
export async function runCron(env, opts = {}) {
  const batch = opts.batch || +env.PUSH_BATCH || 45;
  const today = kstDay(opts.now != null ? +new Date(opts.now) : Date.now());
  const st = (await env.PUSH.get("state", "json")) || {};
  if (!st.pend && st.day === today) return { sent: 0, skipped: "done today", last: st.last || null };   // 하루 최대 1통
  const ch = await loadChanges(env), td = await loadToday(env);
  const items = Array.isArray(ch.items) ? ch.items : [];
  const maxDate = items.reduce((m, e) => (e.date > m ? e.date : m), "");
  const monday = wday(today) === 1;
  let pend = st.pend;
  if (!pend) {
    // 처음 돌 때는 가장 최근 날 하루치만(지난 30일을 한꺼번에 보내지 않게)
    const from = st.last || (maxDate ? prevDay(maxDate) : "");
    pend = { from, to: maxDate > from ? maxDate : from, cursor: null, day: today };
  }
  const fresh = items.filter((e) => e.date > pend.from && e.date <= pend.to && pushable(e));
  const wFrom = addDay(today, -7), weekItems = items.filter((e) => e.date > wFrom && pushable(e));
  const sched = td && Array.isArray(td.auc) ? td.auc.filter((a) => Array.isArray(a) && a[3] === addDay(today, 1)) : [];
  const asOf = (td && td.asOf) || ch.asOf || pend.to;
  if (!fresh.length && !sched.length && !monday) {
    await env.PUSH.put("state", JSON.stringify({ last: pend.to || st.last || null, day: today, at: new Date().toISOString() }));
    return { sent: 0, skipped: "no new", last: pend.to || st.last || null };
  }
  const keys = await vapidKeys(env);
  const name = (id) => { const e = items.find((x) => x.id === id && x.n); return e ? e.n : id; };
  let sent = 0, gone = 0, fail = 0, seen = 0, done = false;
  const byF = { i: 0, d: 0, w: 0 };
  // 보낸 건수(외부 요청)만 batch로 센다. 끊기면 {cursor: 이 페이지의 시작 커서, off: 페이지 안 위치}를 남겨 다음 실행에서 잇는다
  outer: for (;;) {
    const L = await env.PUSH.list({ prefix: "sub:", cursor: pend.cursor || undefined, limit: 200 });
    for (let i = pend.off || 0; i < L.keys.length; i++) {
      if (sent + gone + fail >= batch) { pend.off = i; break outer; }
      seen++;
      const sub = await env.PUSH.get(L.keys[i].name, "json");
      if (!sub || !sub.s) continue;
      const f = FREQS.includes(sub.f) ? sub.f : "i";
      if (f === "w" && !monday) continue;
      const m = match(sub, f === "w" ? weekItems : fresh, { f, sched: f === "w" ? [] : sched, all: items, from: f === "w" ? wFrom : pend.from, to: f === "w" ? today : pend.to });
      const msg = compose(m, today, { f, asOf, wk: td && td.seoul ? td.seoul.w : null, name });
      if (!msg) continue;
      let code = 0;
      try { code = await sendPush(sub.s, msg, keys, subject(env), { fetch: opts.fetch }); } catch (e) { code = -1; }
      if (code === 404 || code === 410) { await env.PUSH.delete(L.keys[i].name); gone++; }
      else if (code >= 200 && code < 300) { sent++; byF[f]++; }
      else fail++;
    }
    pend.off = 0;
    if (L.list_complete || !L.cursor) { done = true; break; }
    pend.cursor = L.cursor;
  }
  if (done) await env.PUSH.put("state", JSON.stringify({ last: pend.to, day: today, at: new Date().toISOString() }));
  else await env.PUSH.put("state", JSON.stringify({ last: st.last || null, day: st.day || null, pend }));
  return { sent, gone, fail, seen, events: fresh.length, sched: sched.length, done, to: pend.to, day: today, byF };
}
const prevDay = (d) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
