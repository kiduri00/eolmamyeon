var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// webpush.js
var C = globalThis.crypto;
var S = C.subtle;
var te = new TextEncoder();
var b64u = /* @__PURE__ */ __name((u8) => {
  u8 = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
  let s = "";
  for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}, "b64u");
var unb64u = /* @__PURE__ */ __name((s) => {
  const b = atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}, "unb64u");
var cat = /* @__PURE__ */ __name((...a) => {
  const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n);
  let p = 0;
  for (const x of a) {
    o.set(x, p);
    p += x.length;
  }
  return o;
}, "cat");
var hmac = /* @__PURE__ */ __name(async (key, data) => new Uint8Array(await S.sign("HMAC", await S.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), data)), "hmac");
var hkdf = /* @__PURE__ */ __name(async (salt, ikm, info, len) => (await hmac(await hmac(salt, ikm), cat(info, new Uint8Array([1])))).slice(0, len), "hkdf");
var jwkFromRaw = /* @__PURE__ */ __name((pub, d) => ({ kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ...d ? { d: b64u(d) } : {}, ext: true }), "jwkFromRaw");
async function encrypt(plain, p256dh, auth, opts = {}) {
  const ua = typeof p256dh === "string" ? unb64u(p256dh) : p256dh;
  const sec = typeof auth === "string" ? unb64u(auth) : auth;
  if (ua.length !== 65 || ua[0] !== 4) throw new Error("bad p256dh");
  if (sec.length !== 16) throw new Error("bad auth");
  let asPriv, asPub;
  if (opts.as) {
    asPriv = await S.importKey("jwk", jwkFromRaw(opts.as.pub, opts.as.priv), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    asPub = opts.as.pub;
  } else {
    const kp = await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPriv = kp.privateKey;
    asPub = new Uint8Array(await S.exportKey("raw", kp.publicKey));
  }
  const uaKey = await S.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await S.deriveBits({ name: "ECDH", public: uaKey }, asPriv, 256));
  const ikm = await hkdf(sec, ecdh, cat(te.encode("WebPush: info\0"), ua, asPub), 32);
  const salt = opts.salt || C.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const body = typeof plain === "string" ? te.encode(plain) : plain;
  const rec = cat(body, new Uint8Array([2]));
  const key = await S.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await S.encrypt({ name: "AES-GCM", iv: nonce }, key, rec));
  const rs = 4096, hdr = new Uint8Array(21);
  hdr.set(salt, 0);
  new DataView(hdr.buffer).setUint32(16, rs);
  hdr[20] = asPub.length;
  return cat(hdr, asPub, ct);
}
__name(encrypt, "encrypt");
async function vapidKeys(env) {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    const pub = unb64u(env.VAPID_PUBLIC_KEY), d = unb64u(env.VAPID_PRIVATE_KEY);
    return { pub: env.VAPID_PUBLIC_KEY, key: await S.importKey("jwk", jwkFromRaw(pub, d), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]) };
  }
  let v = null;
  try {
    v = await env.PUSH.get("vapid", "json");
  } catch (e) {
  }
  if (!v || !v.pub || !v.jwk) {
    const kp = await S.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    v = { pub: b64u(await S.exportKey("raw", kp.publicKey)), jwk: await S.exportKey("jwk", kp.privateKey), at: (/* @__PURE__ */ new Date()).toISOString() };
    await env.PUSH.put("vapid", JSON.stringify(v));
  }
  return { pub: v.pub, key: await S.importKey("jwk", v.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]) };
}
__name(vapidKeys, "vapidKeys");
async function vapidAuth(endpoint, keys, subject2, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const h = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const p = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(now / 1e3) + 12 * 3600, sub: subject2 })));
  const sig = new Uint8Array(await S.sign({ name: "ECDSA", hash: "SHA-256" }, keys.key, te.encode(`${h}.${p}`)));
  return `vapid t=${h}.${p}.${b64u(sig)}, k=${keys.pub}`;
}
__name(vapidAuth, "vapidAuth");
async function sendPush(sub, payload, keys, subject2, opts = {}) {
  const body = await encrypt(typeof payload === "string" ? payload : JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
  const r = await (opts.fetch || fetch)(sub.endpoint, {
    method: "POST",
    headers: { TTL: String(opts.ttl || 86400), Urgency: opts.urgency || "normal", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Authorization: await vapidAuth(sub.endpoint, keys, subject2) },
    body
  });
  return r.status;
}
__name(sendPush, "sendPush");

// push.js
var MAXZ = 20;
var MAXC = 3;
var MAXBODY = 8192;
var ID = /^[A-Za-z0-9_-]{1,24}$/;
var KINDS = ["", "redev", "rebuild", "small"];
var PUSH_HOST = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
var json = /* @__PURE__ */ __name((o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }), "json");
var subject = /* @__PURE__ */ __name((env) => env.VAPID_SUBJECT || "https://jaegaebal.alwaysquestions.kr/", "subject");
var testHosts = /* @__PURE__ */ __name((env) => String(env.PUSH_TEST_HOSTS || "").split(",").map((x) => x.trim()).filter(Boolean), "testHosts");
async function subKey(endpoint) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)));
  return "sub:" + b64u(h.slice(0, 18));
}
__name(subKey, "subKey");
function okEndpoint(ep, env = {}) {
  let u;
  try {
    u = new URL(ep);
  } catch (e) {
    return false;
  }
  if (testHosts(env).includes(u.hostname)) return u.protocol === "http:" || u.protocol === "https:";
  return u.protocol === "https:" && PUSH_HOST.test(u.hostname) && ep.length <= 1024;
}
__name(okEndpoint, "okEndpoint");
function cleanSub(b, env) {
  if (!b || typeof b !== "object") return null;
  const s = b.sub || {}, k = s.keys || {};
  if (!okEndpoint(s.endpoint, env)) return null;
  if (typeof k.p256dh !== "string" || typeof k.auth !== "string" || !/^[A-Za-z0-9_-]{80,100}$/.test(k.p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(k.auth)) return null;
  const z = [...new Set((Array.isArray(b.zones) ? b.zones : []).filter((x) => typeof x === "string" && ID.test(x)))].slice(0, MAXZ);
  const c = (Array.isArray(b.conds) ? b.conds : []).slice(0, MAXC).map((x) => ({
    n: String(x && x.n || "").slice(0, 30),
    cash: Math.max(0, Math.min(100, +(x && x.cash) || 0)),
    mode: x && x.mode === "gap" ? "gap" : "cash",
    gu: typeof (x && x.gu) === "string" && /^[가-힣]{1,5}구$/.test(x.gu) ? x.gu : "",
    kind: KINDS.includes(x && x.kind) ? x.kind : "",
    minS: Math.max(0, Math.min(9, Math.floor(+(x && x.minS) || 0)))
  })).filter((x) => x.cash > 0);
  return { s: { endpoint: s.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } }, z, c, at: (/* @__PURE__ */ new Date()).toISOString() };
}
__name(cleanSub, "cleanSub");
async function readBody(req) {
  const t = await req.text();
  if (t.length > MAXBODY) return null;
  try {
    return JSON.parse(t);
  } catch (e) {
    return null;
  }
}
__name(readBody, "readBody");
var sameOrigin = /* @__PURE__ */ __name((req) => {
  const o = req.headers.get("Origin");
  return !o || o === new URL(req.url).origin;
}, "sameOrigin");
async function handleFetch(req, env) {
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
      const ep = b.endpoint || b.sub && b.sub.endpoint;
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
__name(handleFetch, "handleFetch");
var TYPE_T = { stage: "\uB2E8\uACC4", trade: "\uC2E4\uAC70\uB798", notice: "\uACE0\uC2DC\xB7\uACF5\uACE0", price: "\uD544\uC694\uD55C \uB3C8" };
var cashT = /* @__PURE__ */ __name((v) => v >= 1 ? `${Math.round(v * 10) / 10}\uC5B5` : `${Math.round(v * 10)}\uCC9C`, "cashT");
function match(sub, items) {
  const Z = new Set(sub.z || []), zone = [], cond = [];
  for (const e of items) {
    if (Z.has(e.id) && e.type !== "price") zone.push(e);
    if (e.type === "price" && e.v) {
      for (const c of sub.c || []) {
        const m = c.mode === "gap" ? "g" : "c", v = e.v[m];
        if (!v || !(v[0] > c.cash + 1e-9 && v[1] <= c.cash + 1e-9)) continue;
        if (c.gu && e.g !== c.gu) continue;
        if (c.kind && e.kd !== c.kind) continue;
        if (c.minS && !(e.s >= c.minS)) continue;
        cond.push({ e, c });
        break;
      }
    }
  }
  return { zone, cond };
}
__name(match, "match");
function compose(m, date) {
  const L = [];
  m.zone.forEach((e) => L.push(`${e.n} \xB7 ${e.text}`));
  m.cond.forEach(({ e, c }) => L.push(`${e.n} \xB7 ${c.mode === "gap" ? "\uC804\uC138" : "\uB300\uCD9C"} \uB07C\uACE0 ${cashT(e.v[c.mode === "gap" ? "g" : "c"][1])} \u2192 \uC870\uAC74 '${c.n || cashT(c.cash)}' \uC548\uC73C\uB85C`));
  if (!L.length) return null;
  const zIds = [...new Set(m.zone.map((e) => e.id))];
  let title, url;
  if (m.zone.length === 1 && !m.cond.length) {
    const e = m.zone[0];
    title = `${e.n} \xB7 ${TYPE_T[e.type] || "\uC0C8 \uC18C\uC2DD"}`;
    url = "/#" + e.id;
  } else if (!m.zone.length && m.cond.length === 1) {
    title = "\uC870\uAC74 \uD540\uC5D0 \uC0C8\uB85C \uB4E4\uC5B4\uC62C \uC218 \uC788\uB294 \uACF3";
    url = "/#" + m.cond[0].e.id;
  } else {
    title = zIds.length ? `\uB0B4 \uD540 ${zIds.length}\uACF3\uC5D0 \uC0C8 \uC18C\uC2DD${m.cond.length ? ` \xB7 \uC870\uAC74 \uD540 ${m.cond.length}\uACF3` : ""}` : `\uC870\uAC74 \uD540\uC5D0 \uC0C8\uB85C \uB4E4\uC5B4\uC62C \uC218 \uC788\uB294 \uACF3 ${m.cond.length}\uACF3`;
    url = zIds.length === 1 && !m.cond.length ? "/#" + zIds[0] : "/#inbox";
  }
  const body = (m.zone.length === 1 && !m.cond.length ? [m.zone[0].text] : L.slice(0, 3)).join("\n") + (L.length > 3 ? `
\uC678 ${L.length - 3}\uAC74` : "");
  return { title, body: body.slice(0, 600), url, tag: "zippin-" + date };
}
__name(compose, "compose");
async function loadChanges(env) {
  const r = await env.ASSETS.fetch(new Request("https://assets.local/data/changes.json"));
  if (!r.ok) throw new Error("changes.json " + r.status);
  return r.json();
}
__name(loadChanges, "loadChanges");
async function runCron(env, opts = {}) {
  const batch = opts.batch || +env.PUSH_BATCH || 45;
  const st = await env.PUSH.get("state", "json") || {};
  const ch = await loadChanges(env);
  const items = Array.isArray(ch.items) ? ch.items : [];
  const maxDate = items.reduce((m, e) => e.date > m ? e.date : m, "");
  let pend = st.pend;
  if (!pend) {
    const from = st.last || (maxDate ? prevDay(maxDate) : "");
    if (!maxDate || maxDate <= from) return { sent: 0, skipped: "no new", last: st.last || null };
    pend = { from, to: maxDate, cursor: null };
  }
  const fresh = items.filter((e) => e.date > pend.from && e.date <= pend.to);
  const keys = await vapidKeys(env);
  let sent = 0, gone = 0, fail = 0, seen = 0, done = false;
  outer: for (; ; ) {
    const L = await env.PUSH.list({ prefix: "sub:", cursor: pend.cursor || void 0, limit: 200 });
    for (let i = pend.off || 0; i < L.keys.length; i++) {
      if (sent + gone + fail >= batch) {
        pend.off = i;
        break outer;
      }
      seen++;
      const sub = await env.PUSH.get(L.keys[i].name, "json");
      if (!sub || !sub.s) continue;
      const msg = compose(match(sub, fresh), pend.to);
      if (!msg) continue;
      let code = 0;
      try {
        code = await sendPush(sub.s, msg, keys, subject(env), { fetch: opts.fetch });
      } catch (e) {
        code = -1;
      }
      if (code === 404 || code === 410) {
        await env.PUSH.delete(L.keys[i].name);
        gone++;
      } else if (code >= 200 && code < 300) sent++;
      else fail++;
    }
    pend.off = 0;
    if (L.list_complete || !L.cursor) {
      done = true;
      break;
    }
    pend.cursor = L.cursor;
  }
  if (done) await env.PUSH.put("state", JSON.stringify({ last: pend.to, at: (/* @__PURE__ */ new Date()).toISOString() }));
  else await env.PUSH.put("state", JSON.stringify({ last: st.last || null, pend }));
  return { sent, gone, fail, seen, events: fresh.length, done, to: pend.to };
}
__name(runCron, "runCron");
var prevDay = /* @__PURE__ */ __name((d) => {
  const t = /* @__PURE__ */ new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}, "prevDay");

// index.js
var index_default = {
  async fetch(req, env) {
    try {
      return await handleFetch(req, env);
    } catch (e) {
      return new Response(JSON.stringify({ error: "server" }), { status: 500, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
  },
  async scheduled(ev, env, ctx) {
    ctx.waitUntil(runCron(env).then((r) => console.log("push cron", JSON.stringify(r))).catch((e) => console.error("push cron failed", e && e.message)));
  }
};

// ../../../../tmp/claude-0/-home-claude/887bff60-b663-5701-90e9-e402cebc9114/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../tmp/claude-0/-home-claude/887bff60-b663-5701-90e9-e402cebc9114/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-scheduled.ts
var scheduled = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  const url = new URL(request.url);
  if (url.pathname === "/__scheduled") {
    const cron = url.searchParams.get("cron") ?? "";
    await middlewareCtx.dispatch("scheduled", { cron });
    return new Response("Ran scheduled event");
  }
  const resp = await middlewareCtx.next(request, env);
  if (request.headers.get("referer")?.endsWith("/__scheduled") && url.pathname === "/favicon.ico" && resp.status === 500) {
    return new Response(null, { status: 404 });
  }
  return resp;
}, "scheduled");
var middleware_scheduled_default = scheduled;

// ../../../../tmp/claude-0/-home-claude/887bff60-b663-5701-90e9-e402cebc9114/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-sxmzp3/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_scheduled_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../../../../tmp/claude-0/-home-claude/887bff60-b663-5701-90e9-e402cebc9114/scratchpad/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-sxmzp3/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
