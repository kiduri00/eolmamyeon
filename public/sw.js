/* 얼마면 재개발 서비스 워커 — 보수적으로:
   HTML은 네트워크 우선(오프라인이면 저장본), 데이터·API·아이콘은 저장본을 먼저 보여 주고 뒤에서 갱신,
   지도 타일은 작은 상한을 둔 런타임 캐시만. 버전을 올리면 옛 캐시는 지운다. */
const V = "v1";
const SHELL = "eolma-shell-" + V;
const DATA = "eolma-data-" + V;
const TILE = "eolma-tile-" + V;
const CDN = "eolma-cdn-" + V;
const KEEP = [SHELL, DATA, TILE, CDN];
const PRE = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-180.png", "/icon-192.png", "/icon-512.png"];
const CAP = { [DATA]: 120, [TILE]: 300, [CDN]: 40, [SHELL]: 30 };

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(PRE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
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

// HTML: 네트워크 우선, 실패하면 같은 주소 저장본 → 첫 화면 저장본
const page = async (e) => {
  const c = await caches.open(SHELL);
  try {
    const r = (await e.preloadResponse) || (await fetch(e.request));
    if (okToCache(r)) { const u = new URL(e.request.url); u.search = ""; e.waitUntil(c.put(u.href, r.clone()).then(() => trim(SHELL))); }
    return r;
  } catch (err) {
    const hit = (await c.match(e.request, { ignoreSearch: true })) || (await c.match("/"));
    if (hit) return hit;
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title><p style="font:16px system-ui;padding:24px">오프라인이에요. 연결되면 다시 시도해 주세요.</p>', { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (u.pathname === "/sw.js") return;
    if (req.mode === "navigate") return e.respondWith(page(e));
    if (u.pathname.startsWith("/data/") || u.pathname.startsWith("/api/") || /^\/(premium\.json|manifest\.webmanifest|icon[^/]*\.(png|svg)|og\.png)$/.test(u.pathname)) return e.respondWith(swr(e, u.pathname.startsWith("/icon") || u.pathname.startsWith("/manifest") ? SHELL : DATA));
    return; // 그 밖의 같은 출처 파일은 브라우저 기본 동작
  }
  // 타일 목록(TileJSON)은 판이 바뀌므로 그대로 두고, 판 번호가 박힌 타일·글꼴만 작게 저장
  if (u.hostname === "tiles.openfreemap.org") { if (/\.pbf$/.test(u.pathname)) e.respondWith(swr(e, TILE)); return; }
  // 버전이 박힌 CDN 파일(글꼴·지도 라이브러리)만
  if (((u.hostname === "cdn.jsdelivr.net" || u.hostname === "unpkg.com") && /@v?\d/.test(u.pathname)) || (u.hostname === "cdnjs.cloudflare.com" && /^\/ajax\/libs\/[^/]+\/\d/.test(u.pathname))) return e.respondWith(swr(e, CDN));
});
