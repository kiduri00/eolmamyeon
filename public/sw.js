// 얼마면 재개발 서비스 워커
// - 페이지(HTML): 항상 네트워크 먼저 → 매일 갱신되는 숫자를 바로 보여 준다.
//   끊겼을 때는 그 주소를 마지막으로 본 화면을 띄우고, 본 적 없는 주소면 오프라인 안내를 띄운다.
// - 지연 로딩 데이터(/data/*.json, /premium.json, 주소에 ?v=해시): 캐시를 먼저 보여 주고 뒤에서 새로 받는다.
//   같은 파일의 옛 버전은 바로 지워서 캐시가 쌓이지 않게 한다. 큰 필지 데이터(/data/pcl/)는 캐시하지 않는다.
// - 아이콘·공용 CSS: 네트워크 먼저, 끊겼을 때만 캐시.
// - 다른 도메인(광고, 지도 타일, 글꼴)은 건드리지 않는다.
const VER = 'v2';
const PAGES = 'pages-' + VER;
const ASSETS = 'assets-' + VER;
const MAX_PAGES = 40;
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

const OFFLINE_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인 · 얼마면 재개발</title>
<style>body{margin:0;font-family:system-ui,-apple-system,'Noto Sans KR',sans-serif;background:#fff;color:#14171C;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box}
@media (prefers-color-scheme:dark){body{background:#14171C;color:#E8EBF0}}h1{font-size:20px;margin:0 0 8px}p{margin:0 0 20px;color:#6B7280;line-height:1.6}
a{display:inline-block;background:#1F3A87;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600}</style></head>
<body><main><h1>인터넷에 연결되어 있지 않아요</h1><p>이 화면은 아직 저장되지 않았어요.<br>연결되면 다시 시도해 주세요.</p>
<a href="/">처음 화면으로</a></main></body></html>`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const ks = await caches.keys();
      await Promise.all(ks.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })()
  );
});

// 페이지 캐시가 너무 커지지 않게 오래된 것부터 지운다('/'는 남긴다)
async function trimPages(c) {
  const ks = await c.keys();
  const extra = ks.filter((k) => new URL(k.url).pathname !== '/');
  for (let i = 0; i < extra.length - MAX_PAGES; i++) await c.delete(extra[i]);
}

async function handleNavigate(e, url) {
  const c = await caches.open(PAGES);
  try {
    const res = (await e.preloadResponse) || (await fetch(e.request));
    if (res.ok && !res.redirected) {
      await c.delete(url.pathname);
      await c.put(url.pathname, res.clone());
      trimPages(c);
    }
    return res;
  } catch (err) {
    const hit = await c.match(url.pathname);
    if (hit) return hit;
    return new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

// 버전 붙은 데이터: 캐시 먼저, 뒤에서 갱신, 같은 경로의 옛 버전 삭제
async function handleData(e, url) {
  const c = await caches.open(ASSETS);
  const hit = await c.match(e.request);
  const net = fetch(e.request)
    .then(async (res) => {
      if (res.ok) {
        const ks = await c.keys();
        await Promise.all(ks.filter((k) => {
          const u = new URL(k.url);
          return u.pathname === url.pathname && u.search !== url.search;
        }).map((k) => c.delete(k)));
        await c.put(e.request, res.clone());
      }
      return res;
    })
    .catch(() => hit || Response.error());
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

// 아이콘·CSS: 네트워크 먼저
async function handleStatic(e) {
  const c = await caches.open(ASSETS);
  try {
    const res = await fetch(e.request);
    if (res.ok) await c.put(e.request, res.clone());
    return res;
  } catch (err) {
    return (await c.match(e.request)) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p === '/sw.js') return;

  if (req.mode === 'navigate') { e.respondWith(handleNavigate(e, url)); return; }
  if (p.startsWith('/data/pcl/')) return;
  if ((p.startsWith('/data/') && p.endsWith('.json')) || p === '/premium.json') { e.respondWith(handleData(e, url)); return; }
  if (p.startsWith('/icons/') || p === '/pages.css' || p === '/manifest.webmanifest') { e.respondWith(handleStatic(e)); return; }
});
