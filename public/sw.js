/* 집핀 서비스 워커 — 보수적으로:
   HTML은 네트워크 우선(오프라인이면 저장본), 데이터·API·아이콘은 저장본을 먼저 보여 주고 뒤에서 갱신,
   지도 타일은 작은 상한을 둔 런타임 캐시만. 버전을 올리면 옛 캐시는 지운다. */
const V = "d30db867"; // tools/build.py가 빌드 해시로 바꿔 씀
const SHELL = "eolma-shell-" + V;
const DATA = "eolma-data-" + V;
const TILE = "eolma-tile-" + V;
const CDN = "eolma-cdn-" + V;
const BUND = "eolma-bund-" + V;
const PAGES = "eolma-pages"; // 다녀간 구역·구·리포트 페이지(버전과 무관하게 유지 · 오프라인에서 다시 열기)
const KEEP = [SHELL, DATA, TILE, CDN, BUND, PAGES];
const PRE = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-small.svg", "/icon-180.png", "/icon-192.png", "/icon-512.png", "/pages.css"];
// 구 페이지(목록 + 25개 구)는 설치 때 미리 저장 → 오프라인에서도 구별 구역 목록을 연다
const GUS = "강남구 강동구 강북구 강서구 관악구 광진구 구로구 금천구 노원구 도봉구 동대문구 동작구 마포구 서대문구 서초구 성동구 성북구 송파구 양천구 영등포구 용산구 은평구 종로구 중구 중랑구".split(" ");
const PRE_PAGES = ["/gu/"].concat(GUS.map((g) => "/gu/" + encodeURIComponent(g)));
const CAP = { [DATA]: 120, [TILE]: 300, [CDN]: 40, [SHELL]: 30, [BUND]: 6, [PAGES]: 80 };
const isDoc = (p) => /^\/(z|gu|report|guide|feed)\//.test(p) || /^\/(years|about|method|contact|terms|privacy)$/.test(p);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(PRE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => keep(PRE_PAGES).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => k.startsWith("eolma-") && !KEEP.includes(k)).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (_) {} }
    await self.clients.claim();
  })());
});

const trim = async (name) => {
  const c = await caches.open(name);
  const ks = await c.keys();
  const over = ks.length - (CAP[name] || 50);
  for (let i = 0; i < over; i++) await c.delete(ks[i]);
};

const okToCache = (r) => !!r && r.status === 200 && (r.type === "basic" || r.type === "cors" || r.type === "default");

// 저장본 먼저, 뒤에서 갱신
const swr = async (e, name, opts) => {
  const c = await caches.open(name);
  const hit = await c.match(e.request, opts);
  const net = fetch(e.request).then((r) => {
    if (okToCache(r)) { const cp = r.clone(); e.waitUntil(c.put(e.request, cp).then(() => trim(name))); }
    return r;
  });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
};

// 해시가 박힌 파일(/b/): 저장본이 있으면 그대로(내용이 바뀌면 이름이 바뀜)
const cacheFirst = async (e, name) => {
  const c = await caches.open(name);
  const hit = await c.match(e.request);
  if (hit) return hit;
  const r = await fetch(e.request);
  if (okToCache(r)) { const cp = r.clone(); e.waitUntil(c.put(e.request, cp).then(() => trim(name))); }
  return r;
};

// 주소 정리: 검색어·끝의 .html·끝 슬래시 차이를 한 키로
const keyOf = (href) => { const u = new URL(href); u.search = ""; u.hash = ""; u.pathname = u.pathname.replace(/\.html$/, "").replace(/\/index$/, "/"); return u.href; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// 오프라인인데 저장본이 없는 구역 페이지: 다녀간 페이지 목록을 보여 준다(첫 화면으로 튕기지 않게)
const offlinePage = async () => {
  const pc = await caches.open(PAGES);
  const ks = (await pc.keys()).slice(-30).reverse();
  const items = await Promise.all(ks.map(async (k) => { try { const t = await (await pc.match(k)).text(); const m = t.match(/<title>([^<|]*)/); return [new URL(k.url).pathname, (m ? m[1] : new URL(k.url).pathname).trim()]; } catch (_) { return null; } }));
  const li = items.filter(Boolean).map(([u, t]) => `<li><a href="${esc(u)}">${esc(t)}</a></li>`).join("");
  return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>오프라인 | 집핀</title><body style="font:16px/1.6 system-ui,sans-serif;padding:24px;max-width:640px;margin:auto"><h1 style="font-size:22px">오프라인이에요</h1><p>이 페이지는 아직 저장돼 있지 않아요. 연결되면 다시 시도해 주세요.</p>${li ? `<h2 style="font-size:17px">이 기기에 저장된 페이지</h2><ul>${li}</ul>` : ""}<p><a href="/">첫 화면(저장본)으로</a></p></body></html>`, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
};
// HTML: 네트워크 우선, 실패하면 같은 주소 저장본 → (구역·리포트 페이지면 저장 목록) → 첫 화면 저장본
const page = async (e) => {
  const c = await caches.open(SHELL), pc = await caches.open(PAGES);
  const path = new URL(e.request.url).pathname, doc = isDoc(path);
  try {
    const r = (await e.preloadResponse) || (await fetch(e.request));
    if (okToCache(r)) {
      const tc = doc ? pc : c, nm = doc ? PAGES : SHELL, cp = r.clone();
      e.waitUntil((async () => { await tc.put(keyOf(e.request.url), cp.clone()); if (r.url && keyOf(r.url) !== keyOf(e.request.url)) await tc.put(keyOf(r.url), cp); await trim(nm); })());
    }
    return r;
  } catch (err) {
    const k = keyOf(e.request.url);
    const hit = (await pc.match(k)) || (await c.match(k)) || (await c.match(e.request, { ignoreSearch: true }));
    if (hit) return hit;
    if (doc) return offlinePage();
    const home = await c.match(keyOf(new URL("/", e.request.url).href));
    if (home) return home;
    return offlinePage();
  }
};

// 페이지가 "이 주소들을 오프라인용으로 저장해 줘"라고 알려 온다: 처음 연 구역·구 페이지(서비스 워커가 아직 안 붙었던 첫 방문), 핀 꽂은 구역의 /z 페이지
const keep = async (urls, force) => {
  const pc = await caches.open(PAGES);
  for (const raw of (urls || []).slice(0, 40)) {
    try {
      const u = new URL(raw, self.location.origin);
      if (u.origin !== self.location.origin || !isDoc(u.pathname)) continue;
      const k = keyOf(u.href);
      if (!force && (await pc.match(k))) continue;
      let r = await fetch(u.href, { credentials: "same-origin" });
      // 확장자 없는 주소를 못 여는 서버(로컬 등)면 .html로 한 번 더
      if (!r.ok && !/\/$|\.html$/.test(u.pathname)) r = await fetch(u.href.replace(/([^/])$/, "$1.html"), { credentials: "same-origin" });
      if (r.redirected) r = new Response(await r.blob(), { status: r.status, headers: r.headers }); // 리디렉트 거친 응답은 탐색 응답으로 못 쓰므로 새로 감쌈
      if (okToCache(r) && /text\/html/.test(r.headers.get("content-type") || "")) await pc.put(k, r);
    } catch (_) {}
  }
  await trim(PAGES);
};
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.t === "keep" && Array.isArray(d.u)) e.waitUntil(keep(d.u, !!d.force));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (u.pathname === "/sw.js" || u.pathname.startsWith("/api/push/")) return; // 웹 푸시 API는 저장하지 않는다(키·구독은 늘 새로)
    if (req.mode === "navigate") return e.respondWith(page(e));
    if (u.pathname.startsWith("/b/")) return e.respondWith(cacheFirst(e, BUND)); // 해시가 박힌 앱 코드·데이터
    if (u.pathname.startsWith("/data/") || u.pathname.startsWith("/api/") || /^\/(premium\.json|manifest\.webmanifest|icon[^/]*\.(png|svg)|og\.png)$/.test(u.pathname)) return e.respondWith(swr(e, u.pathname.startsWith("/icon") || u.pathname.startsWith("/manifest") ? SHELL : DATA));
    if (u.pathname === "/pages.css") return e.respondWith(swr(e, SHELL, { ignoreSearch: true })); // 정적 페이지 모양(오프라인에서도)
    return; // 그 밖의 같은 출처 파일은 브라우저 기본 동작
  }
  // 타일 목록(TileJSON)은 판이 바뀌므로 그대로 두고, 판 번호가 박힌 타일·글꼴만 작게 저장
  if (u.hostname === "tiles.openfreemap.org") { if (/\.pbf$/.test(u.pathname)) e.respondWith(swr(e, TILE)); return; }
  // 버전이 박힌 CDN 파일(글꼴·지도 라이브러리)만
  if (((u.hostname === "cdn.jsdelivr.net" || u.hostname === "unpkg.com") && /@v?\d/.test(u.pathname)) || (u.hostname === "cdnjs.cloudflare.com" && /^\/ajax\/libs\/[^/]+\/\d/.test(u.pathname))) return e.respondWith(swr(e, CDN));
});

// ---------- 웹 푸시(관심 구역 알림): worker/push.js가 {title, body, url, tag}를 암호화해 보낸다 ----------
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  const url = typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/#inbox";
  e.waitUntil(self.registration.showNotification(d.title || "집핀 · 새 소식", { body: d.body || "핀 꽂은 구역에 새 소식이 있어요", icon: "/icon-192.png", badge: "/icon-192.png", tag: d.tag || "zippin", lang: "ko", data: { url } }));
});
// 알림을 누르면: 열린 집핀 창이 있으면 그 창에서 구역을 열고(앱이 메시지를 받아 #id로 이동), 없으면 새 창
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const c = cs.find((x) => new URL(x.url).origin === self.location.origin && new URL(x.url).pathname === "/") || null;
    if (c) { try { await c.focus(); } catch (_) {} c.postMessage({ t: "zp-open", url }); return; }
    await self.clients.openWindow(url);
  })());
});
