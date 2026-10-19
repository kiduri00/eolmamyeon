// 웹 푸시 Worker 시험(외부 패키지 없음): node worker/test.mjs
// 1) RFC 8291 부록 A 벡터와 같은 암호문  2) 브라우저 쪽 복호화(node:crypto로 따로 구현)로 왕복
// 3) VAPID JWT 서명 검증  4) /api/push/* 처리·정적 통과  5) cron 매칭·발송·410 정리·이어 보내기
import assert from "node:assert/strict";
import nc from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encrypt, unb64u, b64u, vapidKeys, vapidAuth } from "./webpush.js";
import { handleFetch, runCron, match, compose, okEndpoint } from "./push.js";
import worker from "./index.js";
import { cleanMsg, KINDS } from "./contact.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
let n = 0; const ok = (m) => { n++; console.log("ok", n, m); };

// ---------- 1. RFC 8291 부록 A ----------
{
  const plain = unb64u("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24");
  const body = await encrypt(plain, "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", "BTBZMqHH6r4Tts7J_aSIgg", {
    as: { pub: unb64u("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"), priv: unb64u("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw") },
    salt: unb64u("DGv6ra1nlYgDCS1FRnbzlw"),
  });
  assert.equal(b64u(body), "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
  ok("RFC 8291 test vector");
}

// ---------- 2. 브라우저(UA) 쪽 복호화: node:crypto로 독립 구현 ----------
export function uaKeys() {
  const e = nc.createECDH("prime256v1"); e.generateKeys();
  return { ecdh: e, p256dh: b64u(e.getPublicKey()), auth: b64u(nc.randomBytes(16)) };
}
export function decrypt(body, ua) {
  body = Buffer.from(body);
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  assert.equal(rs, 4096);
  const ecdh = ua.ecdh.computeSecret(asPub), uaPub = ua.ecdh.getPublicKey();
  const ikm = Buffer.from(nc.hkdfSync("sha256", ecdh, Buffer.from(unb64u(ua.auth)), Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub]), 32));
  const cek = Buffer.from(nc.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(nc.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = nc.createDecipheriv("aes-128-gcm", cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = pt.length - 1; while (end >= 0 && pt[end] === 0) end--;
  assert.equal(pt[end], 2, "last-record delimiter");
  return pt.subarray(0, end).toString("utf8");
}
{
  const ua = uaKeys(), msg = JSON.stringify({ title: "목동4단지 · 단계", body: "조합설립인가 → 사업시행인가 🎉", url: "/#o354" });
  assert.equal(decrypt(await encrypt(msg, ua.p256dh, ua.auth), ua), msg);
  ok("encrypt → independent decrypt round trip (Korean payload)");
}

// ---------- 메모리 KV · 정적 자산 흉내 ----------
function memKV() {
  const m = new Map();
  return {
    m,
    async get(k, t) { const v = m.has(k) ? m.get(k) : null; return v == null ? null : t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix = "", cursor, limit = 1000 } = {}) {
      const ks = [...m.keys()].filter((k) => k.startsWith(prefix)).sort(), s = cursor ? +cursor : 0, sl = ks.slice(s, s + limit);
      return { keys: sl.map((name) => ({ name })), list_complete: s + limit >= ks.length, cursor: s + limit >= ks.length ? undefined : String(s + limit) };
    },
  };
}
function env(changes) {
  return {
    PUSH: memKV(),
    ASSETS: { fetch: async (r) => { const u = new URL(typeof r === "string" ? r : r.url); if (u.pathname === "/data/changes.json") return new Response(JSON.stringify(changes), { headers: { "Content-Type": "application/json" } }); return new Response("static:" + u.pathname, { status: u.pathname === "/nope" ? 404 : 200 }); } },
  };
}

// ---------- 3. VAPID ----------
{
  const E = env({ items: [] });
  const k1 = await vapidKeys(E), k2 = await vapidKeys(E);
  assert.equal(k1.pub, k2.pub, "KV에 한 번 만든 키를 다시 쓴다");
  assert.equal(unb64u(k1.pub).length, 65);
  const auth = await vapidAuth("https://fcm.googleapis.com/fcm/send/abc", k1, "https://jaegaebal.alwaysquestions.kr/", 1_700_000_000_000);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(auth);
  assert.ok(m);
  const pl = JSON.parse(Buffer.from(unb64u(m[2])).toString());
  assert.deepEqual([pl.aud, pl.exp, pl.sub], ["https://fcm.googleapis.com", 1_700_000_000 + 43200, "https://jaegaebal.alwaysquestions.kr/"]);
  const pub = unb64u(m[4]);
  const key = nc.createPublicKey({ key: { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33)) }, format: "jwk" });
  assert.ok(nc.verify("sha256", Buffer.from(`${m[1]}.${m[2]}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(unb64u(m[3]))), "ES256 signature verifies");
  // 환경 변수 키
  const kp = nc.generateKeyPairSync("ec", { namedCurve: "P-256" }), jw = kp.privateKey.export({ format: "jwk" });
  const rawPub = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(unb64u(jw.x)), Buffer.from(unb64u(jw.y))]));
  const k3 = await vapidKeys({ VAPID_PUBLIC_KEY: rawPub, VAPID_PRIVATE_KEY: jw.d, PUSH: memKV() });
  assert.equal(k3.pub, rawPub);
  ok("VAPID: KV-generated key stable, JWT claims + ES256 signature valid, env-secret keys");
}

// ---------- 4. 요청 처리 ----------
const ORIGIN = "https://jaegaebal.alwaysquestions.kr";
const post = (p, b, h = {}) => new Request(ORIGIN + p, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN, ...h }, body: typeof b === "string" ? b : JSON.stringify(b) });
const mkSub = (ua, ep) => ({ endpoint: ep, keys: { p256dh: ua.p256dh, auth: ua.auth } });
{
  const E = env({ items: [] });
  let r = await worker.fetch(new Request(ORIGIN + "/z/o354"), E);
  assert.equal(await r.text(), "static:/z/o354", "정적 경로는 ASSETS로 그대로");
  r = await worker.fetch(new Request(ORIGIN + "/nope"), E); assert.equal(r.status, 404);
  r = await worker.fetch(new Request(ORIGIN + "/api/push/key"), E);
  const key = (await r.json()).key; assert.equal(r.status, 200); assert.equal(unb64u(key).length, 65);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  const ua = uaKeys();
  r = await worker.fetch(post("/api/push/sub", { sub: mkSub(ua, "https://evil.example.com/x"), zones: ["o1"] }), E); assert.equal(r.status, 400, "푸시 서비스가 아닌 주소 거절");
  r = await worker.fetch(post("/api/push/sub", { sub: mkSub(ua, "https://fcm.googleapis.com/fcm/send/A") }, { Origin: "https://evil.example.com" }), E); assert.equal(r.status, 403, "다른 출처 거절");
  r = await worker.fetch(post("/api/push/sub", "{bad"), E); assert.equal(r.status, 400);
  r = await worker.fetch(post("/api/push/sub", { sub: { endpoint: "https://fcm.googleapis.com/fcm/send/A", keys: { p256dh: "x", auth: "y" } } }), E); assert.equal(r.status, 400, "키 형식");
  r = await worker.fetch(post("/api/push/sub", { sub: mkSub(ua, "https://fcm.googleapis.com/fcm/send/A"), zones: ["o354", "o1", "<x>", "o354"], conds: [{ n: "3억 전세", cash: 3, mode: "gap", gu: "강동구", kind: "redev", minS: 0, z: ["o1", "<bad>", "o1", "o2"] }, { cash: "abc" }] }), E);
  assert.deepEqual(await r.json(), { ok: true, zones: 2, conds: 1 });
  const saved = [...E.PUSH.m.entries()].find(([k]) => k.startsWith("sub:"));
  assert.ok(saved); assert.deepEqual(JSON.parse(saved[1]).z, ["o354", "o1"]); assert.deepEqual(JSON.parse(saved[1]).c[0].z, ["o1", "o2"]);
  r = await worker.fetch(post("/api/push/sub", { sub: mkSub(ua, "https://fcm.googleapis.com/fcm/send/A"), zones: ["o9"] }), E);
  assert.equal([...E.PUSH.m.keys()].filter((k) => k.startsWith("sub:")).length, 1, "같은 구독은 덮어쓴다");
  r = await worker.fetch(post("/api/push/unsub", { endpoint: "https://fcm.googleapis.com/fcm/send/A" }), E); assert.equal(r.status, 200);
  assert.equal([...E.PUSH.m.keys()].filter((k) => k.startsWith("sub:")).length, 0);
  r = await worker.fetch(new Request(ORIGIN + "/api/push/zzz"), E); assert.equal(r.status, 404);
  r = await worker.fetch(new Request(ORIGIN + "/api/push/key"), { ASSETS: E.ASSETS }); assert.equal(r.status, 503, "KV가 없으면 503(클라이언트는 버튼을 숨김)");
  assert.ok(okEndpoint("https://web.push.apple.com/QGx") && okEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x") && okEndpoint("https://wns2-bl2p.notify.windows.com/w/?token=1") && !okEndpoint("http://fcm.googleapis.com/x") && !okEndpoint("https://fcm.googleapis.com.evil.com/x"));
  ok("routes: static pass-through, key, sub validation/origin/dedupe, unsub, 404/503");
}

// ---------- 5. 매칭·cron ----------
const CH = {
  asOf: "2026-10-19",
  items: [
    { id: "o354", date: "2026-10-19", type: "stage", text: "조합설립인가 → 사업시행인가", n: "목동4단지", g: "양천구", s: 5, k: "a" },
    { id: "o134", date: "2026-10-19", type: "trade", text: "새 실거래 1건 · 입주권 84.9㎡ 15.5억(10.17 계약)", n: "대조제1", g: "은평구", k: "b" },
    { id: "o1129", date: "2026-10-19", type: "price", text: "필요한 돈 ▼0.5억 · 전세 끼고 2.2억→1.7억", n: "고덕강일1", g: "강동구", v: { g: [2.16, 1.66] }, kd: "redev", s: 1, k: "c" },
    { id: "o9", date: "2026-10-18", type: "trade", text: "old", n: "옛", g: "중구", k: "d" },
  ],
};
{
  const sub = { z: ["o354", "o9"], c: [{ n: "2억 전세", cash: 2, mode: "gap", gu: "", kind: "", minS: 0 }] };
  const m = match(sub, CH.items.filter((e) => e.date > "2026-10-18"));
  assert.deepEqual(m.zone.map((e) => e.id), ["o354"]); assert.deepEqual(m.cond.map((x) => x.e.id), ["o1129"]);
  assert.equal(match({ z: [], c: [{ cash: 2, mode: "cash" }] }, CH.items).cond.length, 0, "방식이 다르면 아님");
  assert.equal(match({ z: [], c: [{ cash: 2, mode: "gap", gu: "중구" }] }, CH.items).cond.length, 0, "구가 다르면 아님");
  assert.equal(match({ z: [], c: [{ cash: 1.5, mode: "gap" }] }, CH.items).cond.length, 0, "아직 모자라면 아님");
  assert.equal(match({ z: [], c: [{ cash: 2, mode: "gap", minS: 4 }] }, CH.items).cond.length, 0, "단계 조건");
  const one = compose(match({ z: ["o354"], c: [] }, CH.items), "2026-10-19");
  assert.deepEqual(one, { title: "목동4단지 · 단계", body: "조합설립인가 → 사업시행인가", url: "/#o354", tag: "zippin-2026-10-19" });
  const many = compose(m, "2026-10-19");
  assert.match(many.title, /관심 구역 1곳에 새 소식 · 알림 조건 1곳/); assert.equal(many.url, "/#inbox"); assert.match(many.body, /고덕강일1 · 전세 끼고 1\.7억 → 내 돈으로 살 수 있게 됐어요/);
  // 경매: 핀 구역이면 zone, 조건에 맞는 구역(c.z)이면 cond
  const AU = { id: "o337", date: "2026-10-19", type: "auction", text: "경매 물건 등장 · 다세대 최저 2.6억 · 입찰 10.28", n: "신정1-3", g: "양천구", k: "e" };
  assert.deepEqual(match({ z: ["o337"], c: [] }, [AU]).zone.map((e) => e.id), ["o337"]);
  const ca = match({ z: [], c: [{ n: "x", cash: 2, mode: "gap", z: ["o337"] }] }, [AU]);
  assert.equal(ca.cond.length, 1); assert.deepEqual(compose(ca, "2026-10-19"), { title: "신정1-3 · 경매 물건 등장", body: "신정1-3 · 경매 물건 등장 · 다세대 최저 2.6억 · 입찰 10.28", url: "/#o337", tag: "zippin-2026-10-19" });
  assert.equal(match({ z: [], c: [{ cash: 2, mode: "gap", z: ["o1"] }] }, [AU]).cond.length, 0);
  assert.equal(compose(match({ z: ["o337"], c: [] }, [AU]), "d").title, "신정1-3 · 경매");
  assert.equal(compose(match({ z: ["zzz"], c: [] }, CH.items), "x"), null);
  ok("match + compose");
}
{
  const E = env(CH), sent = [];
  const uaA = uaKeys(), uaB = uaKeys(), uaC = uaKeys(), uaD = uaKeys();
  const subs = [[uaA, "https://fcm.googleapis.com/fcm/send/A", ["o354"]], [uaB, "https://fcm.googleapis.com/fcm/send/B", ["o999"]], [uaC, "https://fcm.googleapis.com/fcm/send/GONE", ["o134"]], [uaD, "https://web.push.apple.com/D", ["o134", "o354"]]];
  for (const [ua, ep, z] of subs) assert.equal((await worker.fetch(post("/api/push/sub", { sub: mkSub(ua, ep), zones: z }), E)).status, 200);
  const keyPub = (await (await worker.fetch(new Request(ORIGIN + "/api/push/key"), E)).json()).key;
  const fakeFetch = async (url, init) => {
    const ua = subs.find((s) => s[1] === url)[0];
    assert.equal(init.headers["Content-Encoding"], "aes128gcm"); assert.match(init.headers.Authorization, new RegExp(`k=${keyPub}$`));
    sent.push({ url, msg: JSON.parse(decrypt(init.body, ua)) });
    return new Response(null, { status: /GONE/.test(url) ? 410 : 201 });
  };
  let r = await runCron(E, { fetch: fakeFetch });
  assert.deepEqual([r.sent, r.gone, r.events, r.done], [2, 1, 3, 1 && true]);
  const byUrl = Object.fromEntries(sent.map((s) => [s.url.split("/").pop(), s.msg]));
  assert.equal(byUrl.A.title, "목동4단지 · 단계"); assert.equal(byUrl.A.url, "/#o354");
  assert.equal(byUrl.D.title, "관심 구역 2곳에 새 소식"); assert.ok(!byUrl.B, "핀이 안 맞으면 안 보냄"); assert.ok(!sent.some((s) => s.msg.body === "old"), "처음엔 가장 최근 날만");
  assert.equal([...E.PUSH.m.keys()].filter((k) => k.startsWith("sub:")).length, 3, "410이면 구독 지움");
  assert.equal(JSON.parse(E.PUSH.m.get("state")).last, "2026-10-19");
  sent.length = 0; r = await runCron(E, { fetch: fakeFetch });
  assert.equal(sent.length, 0, "같은 날 다시 돌면 안 보냄"); assert.equal(r.skipped, "no new");
  ok("cron: decrypted payloads per subscription, 410 cleanup, idempotent state");
}
{
  // 이어 보내기: batch=2, 구독 5개 → 3번에 나눠 모두 한 번씩
  const E = env(CH), got = [];
  for (let i = 0; i < 5; i++) { const ua = uaKeys(); await worker.fetch(post("/api/push/sub", { sub: mkSub(ua, `https://fcm.googleapis.com/fcm/send/S${i}`), zones: ["o354"] }), E); }
  const ff = async (url) => { got.push(url); return new Response(null, { status: 201 }); };
  const r1 = await runCron(E, { fetch: ff, batch: 2 }), r2 = await runCron(E, { fetch: ff, batch: 2 }), r3 = await runCron(E, { fetch: ff, batch: 2 }), r4 = await runCron(E, { fetch: ff, batch: 2 });
  assert.deepEqual([r1.done, r2.done, r3.done], [false, false, true]); assert.equal(r4.skipped, "no new");
  assert.equal(got.length, 5); assert.equal(new Set(got).size, 5);
  ok("cron batching resumes across runs without duplicates");
}
// changes.json 실제 파일 형식도 매칭에 넣어 본다
{
  const f = path.join(DIR, "../public/data/changes.json");
  if (fs.existsSync(f)) {
    const ch = JSON.parse(fs.readFileSync(f, "utf8"));
    assert.ok(Array.isArray(ch.items) && ch.items.every((e) => e.id && e.date && e.type && e.text && e.k));
    const z = ch.items.slice(0, 3).map((e) => e.id), m = match({ z, c: [] }, ch.items.filter((e) => e.date === ch.items[0].date));
    const msg = compose(m, ch.items[0].date); assert.ok(msg && msg.title && new TextEncoder().encode(JSON.stringify(msg)).length < 3000);
    ok("real public/data/changes.json shape + payload size");
  }
}

// ---------- 6. 문의 양식 /api/contact · 운영자 /api/contact/admin/* ----------
{
  const E = env({ items: [] });
  const ip = (x) => ({ "CF-Connecting-IP": x, "User-Agent": "Mozilla/5.0 (iPhone) test" });
  const good = { kind: "error", text: "미아16구역 지금 필요한 돈이 이상해요", email: "me@example.com", zone: "o1070", url: ORIGIN + "/#o1070", asOf: "2026.10.18", nums: "지금 2억", why: "가격", website: "" };
  // 검사
  assert.equal(cleanMsg({ ...good, kind: "x" }).error, "kind");
  assert.equal(cleanMsg({ ...good, text: "짧아요" }).error, "text");
  assert.equal(cleanMsg({ ...good, text: "가".repeat(2001) }).error, "text");
  assert.equal(cleanMsg({ ...good, email: "not-an-email" }).error, "email");
  assert.equal(cleanMsg({ ...good, website: "http://spam" }).error, "spam");
  assert.ok(cleanMsg({ ...good, email: "" }).ok, "이메일은 안 적어도 된다");
  assert.equal(cleanMsg({ ...good, zone: "<x>" }).v.zone, "");
  assert.deepEqual(Object.keys(KINDS), ["general", "error", "idea", "etc"]);
  let r = await worker.fetch(post("/api/contact", { ...good, website: "x" }, ip("1.1.1.1")), E); assert.equal(r.status, 400, "허니팟");
  r = await worker.fetch(post("/api/contact", good, { Origin: "https://evil.example.com" }), E); assert.equal(r.status, 403, "다른 출처");
  r = await worker.fetch(new Request(ORIGIN + "/api/contact"), E); assert.equal(r.status, 405);
  r = await worker.fetch(post("/api/contact", good, ip("1.1.1.1")), E);
  assert.deepEqual(await r.json(), { ok: true }); assert.equal(r.headers.get("Cache-Control"), "no-store");
  const msgs = () => [...E.PUSH.m.keys()].filter((k) => k.startsWith("msg:"));
  assert.equal(msgs().length, 1);
  const saved = JSON.parse(E.PUSH.m.get(msgs()[0]));
  assert.equal(saved.text, good.text); assert.equal(saved.zone, "o1070"); assert.equal(saved.email, "me@example.com"); assert.equal(saved.read, false);
  assert.ok(!JSON.stringify(saved).includes("1.1.1.1") && ![...E.PUSH.m.values()].some((v) => String(v).includes("1.1.1.1")) && ![...E.PUSH.m.keys()].some((k) => k.includes("1.1.1.1")), "IP는 어디에도 저장하지 않는다");
  for (let i = 0; i < 4; i++) { r = await worker.fetch(post("/api/contact", good, ip("1.1.1.1")), E); assert.equal(r.status, 200); }
  r = await worker.fetch(post("/api/contact", good, ip("1.1.1.1")), E); assert.equal(r.status, 429, "1시간에 5번까지");
  r = await worker.fetch(post("/api/contact", good, ip("2.2.2.2")), E); assert.equal(r.status, 200, "다른 IP는 따로 센다");
  // 운영자: 토큰은 딱 한 번
  r = await worker.fetch(new Request(ORIGIN + "/api/contact/admin/list"), E); assert.equal(r.status, 401);
  r = await worker.fetch(new Request(ORIGIN + "/api/contact/admin/init"), E); assert.equal(r.status, 200);
  const tok = (await r.json()).token; assert.ok(/^[A-Za-z0-9_-]{40,}$/.test(tok));
  assert.ok(!E.PUSH.m.get("admin:tokenhash").includes(tok) && /^[0-9a-f]{64}$/.test(E.PUSH.m.get("admin:tokenhash")), "토큰은 해시만 저장");
  r = await worker.fetch(new Request(ORIGIN + "/api/contact/admin/init"), E); assert.equal(r.status, 403, "두 번째 init은 늘 403");
  const A = (p, b) => new Request(ORIGIN + p, b ? { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify(b) } : { headers: { Authorization: "Bearer " + tok } });
  r = await worker.fetch(new Request(ORIGIN + "/api/contact/admin/list", { headers: { Authorization: "Bearer " + "x".repeat(43) } }), E); assert.equal(r.status, 401, "틀린 토큰");
  r = await worker.fetch(A("/api/contact/admin/list?limit=4"), E); let L = await r.json();
  assert.equal(L.total, 6); assert.equal(L.items.length, 4); assert.equal(L.cursor, "4"); assert.ok(L.items[0].ts >= L.items[1].ts, "최신순"); assert.equal(L.items[0].kindT, "숫자 오류");
  r = await worker.fetch(A("/api/contact/admin/list?cursor=4&limit=4"), E); L = await r.json(); assert.equal(L.items.length, 2); assert.equal(L.cursor, null);
  const id = L.items[0].id;
  r = await worker.fetch(A("/api/contact/admin/read", { id }), E); assert.equal(r.status, 200); assert.equal(JSON.parse(E.PUSH.m.get(id)).read, true);
  r = await worker.fetch(A("/api/contact/admin/read", { id: "sub:x" }), E); assert.equal(r.status, 400, "msg: 키만");
  r = await worker.fetch(A("/api/contact/admin/delete", { id }), E); assert.equal(r.status, 200); assert.equal(msgs().length, 5);
  // 실제 KV는 지운 키를 list에 한동안 더 돌려준다 → 그래도 '모두 N건'은 바로 줄어야 한다(21차)
  { const l0 = E.PUSH.list; E.PUSH.list = async (o) => { const L = await l0(o); if ((o.prefix || "") === "msg:" && !L.keys.some((k) => k.name === id)) L.keys.push({ name: id }); return L; };
    r = await worker.fetch(A("/api/contact/admin/list?limit=30"), E); L = await r.json(); assert.equal(L.total, 5, "지운 뒤 total -1 (stale list)"); assert.ok(!L.items.some((x) => x.id === id));
    E.PUSH.list = l0; }
  r = await worker.fetch(A("/api/contact/admin/list?limit=30"), E); L = await r.json(); assert.equal(L.total, 5); assert.equal(L.items.length, 5);
  // 운영자 푸시: 구독을 저장하면 새 문의마다 한 통
  const ua = uaKeys(), sent = [];
  r = await worker.fetch(A("/api/contact/admin/sub", { sub: mkSub(ua, "https://fcm.googleapis.com/fcm/send/ADMIN") }), E); assert.equal(r.status, 200);
  const { handleContact } = await import("./contact.js");
  r = await handleContact(post("/api/contact", { ...good, kind: "idea" }, ip("3.3.3.3")), E, null, { fetch: async (u, o) => { sent.push({ u, o }); return new Response("", { status: 201 }); } });
  assert.equal(r.status, 200); assert.equal(sent.length, 1); assert.equal(sent[0].u, "https://fcm.googleapis.com/fcm/send/ADMIN");
  const pl = JSON.parse(Buffer.from(decrypt(new Uint8Array(await new Response(sent[0].o.body).arrayBuffer()), ua)).toString());
  assert.equal(pl.title, "새 문의 1건 · 기능 제안"); assert.equal(pl.url, "/admin.html");
  ok("contact: validation · honeypot · origin · rate limit 5/h (hashed IP, not stored) · admin token once · list/read/delete · admin push");
}
console.log(`all ${n} passed`);
