// 웹 푸시 암호화(RFC 8291 aes128gcm) + VAPID(RFC 8292, JWT ES256). WebCrypto만 쓴다(외부 패키지 없음).
// Cloudflare Workers와 Node 20+(globalThis.crypto)에서 같은 코드가 돈다.
const C = globalThis.crypto, S = C.subtle;
const te = new TextEncoder();

export const b64u = (u8) => {
  u8 = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
  let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const unb64u = (s) => {
  const b = atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4));
  const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u;
};
const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const hmac = async (key, data) => new Uint8Array(await S.sign("HMAC", await S.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), data));
// HKDF(SHA-256) 한 블록(32바이트 이하)만 쓰면 되므로 직접: PRK = HMAC(salt, ikm), OKM = HMAC(PRK, info||0x01)[:len]
const hkdf = async (salt, ikm, info, len) => (await hmac(await hmac(salt, ikm), cat(info, new Uint8Array([1])))).slice(0, len);

// 공개키(비압축 65바이트) ↔ JWK x·y
const jwkFromRaw = (pub, d) => ({ kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ...(d ? { d: b64u(d) } : {}), ext: true });

/** RFC 8291 메시지 암호화. opts.as = {pub: Uint8Array(65), priv: Uint8Array(32)}·opts.salt는 시험(고정 벡터)용 */
export async function encrypt(plain, p256dh, auth, opts = {}) {
  const ua = typeof p256dh === "string" ? unb64u(p256dh) : p256dh;
  const sec = typeof auth === "string" ? unb64u(auth) : auth;
  if (ua.length !== 65 || ua[0] !== 4) throw new Error("bad p256dh");
  if (sec.length !== 16) throw new Error("bad auth");
  let asPriv, asPub;
  if (opts.as) { asPriv = await S.importKey("jwk", jwkFromRaw(opts.as.pub, opts.as.priv), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]); asPub = opts.as.pub; }
  else { const kp = await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]); asPriv = kp.privateKey; asPub = new Uint8Array(await S.exportKey("raw", kp.publicKey)); }
  const uaKey = await S.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await S.deriveBits({ name: "ECDH", public: uaKey }, asPriv, 256));
  const ikm = await hkdf(sec, ecdh, cat(te.encode("WebPush: info\0"), ua, asPub), 32);
  const salt = opts.salt || C.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const body = typeof plain === "string" ? te.encode(plain) : plain;
  const rec = cat(body, new Uint8Array([2]));   // 마지막 레코드 구분자(덧붙임 없음)
  const key = await S.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await S.encrypt({ name: "AES-GCM", iv: nonce }, key, rec));
  const rs = 4096, hdr = new Uint8Array(21);
  hdr.set(salt, 0); new DataView(hdr.buffer).setUint32(16, rs); hdr[20] = asPub.length;
  return cat(hdr, asPub, ct);
}

/** VAPID 키: 환경 변수(VAPID_PUBLIC_KEY·VAPID_PRIVATE_KEY, base64url 원시값)가 있으면 그것, 없으면 KV에 처음 한 번 만들어 둔다 */
export async function vapidKeys(env) {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    const pub = unb64u(env.VAPID_PUBLIC_KEY), d = unb64u(env.VAPID_PRIVATE_KEY);
    return { pub: env.VAPID_PUBLIC_KEY, key: await S.importKey("jwk", jwkFromRaw(pub, d), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]) };
  }
  let v = null;
  try { v = await env.PUSH.get("vapid", "json"); } catch (e) {}
  if (!v || !v.pub || !v.jwk) {
    const kp = await S.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    v = { pub: b64u(await S.exportKey("raw", kp.publicKey)), jwk: await S.exportKey("jwk", kp.privateKey), at: new Date().toISOString() };
    await env.PUSH.put("vapid", JSON.stringify(v));
  }
  return { pub: v.pub, key: await S.importKey("jwk", v.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]) };
}

/** Authorization 헤더 값: vapid t=<JWT>, k=<공개키> */
export async function vapidAuth(endpoint, keys, subject, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const h = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const p = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await S.sign({ name: "ECDSA", hash: "SHA-256" }, keys.key, te.encode(`${h}.${p}`)));   // WebCrypto 서명 = r||s(64바이트) = JWS 형식
  return `vapid t=${h}.${p}.${b64u(sig)}, k=${keys.pub}`;
}

/** 구독 하나에 보내기. 반환: 상태 코드(201·200 성공, 404·410 구독 없어짐) */
export async function sendPush(sub, payload, keys, subject, opts = {}) {
  const body = await encrypt(typeof payload === "string" ? payload : JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
  const r = await (opts.fetch || fetch)(sub.endpoint, {
    method: "POST",
    headers: { TTL: String(opts.ttl || 86400), Urgency: opts.urgency || "normal", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Authorization: await vapidAuth(sub.endpoint, keys, subject) },
    body,
  });
  return r.status;
}
