// 얼마면 재개발 서비스 워커
// - 페이지(HTML): 항상 네트워크 먼저 → 매일 갱신되는 숫자를 바로 보여 주고, 끊겼을 때만 마지막으로 본 화면을 띄운다.
// - 아이콘·지연 로딩 데이터(/data/, /icons/): 캐시를 먼저 보여 주고 뒤에서 새로 받아 둔다.
// - 다른 도메인(광고, 지도 타일, 글꼴)은 건드리지 않는다.
const VER = 'v1';
const PAGES = 'pages-' + VER;
const ASSETS = 'assets-' + VER;
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(url.pathname, { cacheName: PAGES })
            .then((r) => r || caches.match('/', { cacheName: PAGES }))
        )
    );
    return;
  }

  if (url.pathname.startsWith('/data/') || url.pathname.startsWith('/icons/') || url.pathname === '/premium.json' || url.pathname === '/pages.css') {
    e.respondWith(
      caches.open(ASSETS).then((c) =>
        c.match(req).then((hit) => {
          const net = fetch(req)
            .then((res) => {
              if (res.ok) c.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || net;
        })
      )
    );
  }
});
