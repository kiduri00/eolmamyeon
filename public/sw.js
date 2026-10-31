/* 서비스 워커 — 보수적으로:
   HTML은 네트워크 우선(오프라인이면 저장본), 데이터·API·아이콘은 저장본을 먼저 보여 주고 뒤에서 갱신,
   지도 타일은 작은 상한을 둔 런타임 캐시만. 버전을 올리면 옛 캐시는 지운다. */
const V = "dae09427"; // tools/build.py가 빌드 해시로 바꿔 씀
const BRAND = "재개픽", BRAND_EN = "JaegaePick"; // 서비스 이름 — tools/build.py가 tools/brand.py 값으로 바꿔 씀
const SHELL = "eolma-shell-" + V;
const DATA = "eolma-data-" + V;
const TILE = "eolma-tile-" + V;
const CDN = "eolma-cdn-" + V;
const BUND = "eolma-bund-" + V;
const PAGES = "eolma-pages"; // 다녀간 구역·구·리포트 페이지(버전과 무관하게 유지 · 오프라인에서 다시 열기)
const KEEP = [SHELL, DATA, TILE, CDN, BUND, PAGES];
const PRE = ["/", "/manifest.webmanifest", "/icons/favicon.svg", "/icons/favicon.ico", "/icons/apple-touch-icon-180.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icon-badge-96.png", "/pages.css"];
// 구 페이지(목록 + 25개 구)는 설치 때 미리 저장 → 오프라인에서도 구별 구역 목록을 연다
const GUS = "강남구 강동구 강북구 강서구 관악구 광진구 구로구 금천구 노원구 도봉구 동대문구 동작구 마포구 서대문구 서초구 성동구 성북구 송파구 양천구 영등포구 용산구 은평구 종로구 중구 중랑구".split(" ");
const PRE_PAGES = ["/gu/"].concat(GUS.map((g) => "/gu/" + encodeURIComponent(g)));
const CAP = { [DATA]: 120, [TILE]: 300, [CDN]: 40, [SHELL]: 30, [BUND]: 24, [PAGES]: 80 };
const isDoc = (p) => /^\/(z|gu|report|guide|feed)\//.test(p) || /^\/(years|about|method|contact|terms|privacy|faq)(\.html)?$/.test(p);
// 앱 첫 화면 주소("/" · "/index.html")만 앱 저장본으로 대신한다 — 그 밖(/faq 등)은 저장본이 없으면 오프라인 안내(앱 첫 화면을 다른 주소로 보이지 않게)
const isApp = (p) => p === "/" || p === "/index.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(PRE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => keep(PRE_PAGES).catch(() => {}))
    // 첫 화면이 참조하는 해시 묶음(/b/h·a·d·c)까지 미리 저장 → 처음 방문 뒤 바로 오프라인 가능 · 설치 앱 묶음(/b/t.*)은 빼고(브라우저 방문자가 받지 않게 · 앱은 처음 받을 때 저장)
    .then(() => fetch("/", { cache: "reload" }).then((r) => r.text()).then((t) => caches.open(BUND).then((c) => Promise.all([...new Set(t.match(/\/b\/[a-su-z]\.[0-9a-f]{10}\.(?:js|css|json)/g) || [])].map((u) => c.add(u).catch(() => {})))))).catch(() => {})
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => k.startsWith("eolma-") && !KEEP.includes(k)).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (_) {} }
    // 사이클 4: 이름을 바꾸기 전 옛 태그(jp·zp로 시작하지 않는 태그)로 받은 알림은 업데이트 직후 한 번 닫는다 — 다음 알림이 올 때까지 서랍에 남던 것(push 처리 때와 같은 규칙)
    try { const ns = await self.registration.getNotifications(); ns.forEach((n) => { if (n.tag && !/^(jp|zp)/.test(n.tag)) n.close(); }); } catch (_) {}
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
// 5라운드: 오프라인 안내의 앱 5탭/웹 4탭은 페이지 안 인라인 스크립트가 탭(창)마다 고른다(sessionStorage zp.tapp · display-mode) — 서비스 워커 전역 값은 같은 기기 브라우저 탭으로 샜다
const offlinePage = async () => {
  const pc = await caches.open(PAGES);
  const ks = (await pc.keys()).slice(-30).reverse();
  const items = await Promise.all(ks.map(async (k) => { try { const t = await (await pc.match(k)).text(); const m = t.match(/<title>([^<|]*)/); return [new URL(k.url).pathname, (m ? m[1] : new URL(k.url).pathname).trim()]; } catch (_) { return null; } }));
  // 앱과 같은 모양(머리 · 52px 줄 · 아래 탭 4개) — 외부 파일 없이 이 글 안에서 다 그린다(오프라인)
  const tab = (u, t, d, on) => `<a href="${u}"${on ? ' aria-current="page"' : ""}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg><span>${t}</span></a>`;
  const css = ":root{--bg:#f2f4f6;--sf:#fff;--t1:#191f28;--t2:#4e5968;--t3:#6b7684;--bd:#e5e8eb;--nv:#1f3a87}@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--sf:#15181d;--t1:#e9ecf1;--t2:#b4bcc6;--t3:#8b95a1;--bd:#2a3038;--nv:#9fb3ff}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t1);font:16px/1.5 Pretendard Variable,Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;padding-bottom:calc(72px + env(safe-area-inset-bottom,0px))}header{position:sticky;top:0;display:flex;align-items:center;gap:8px;height:56px;padding:0 16px;background:var(--sf);border-bottom:1px solid var(--bd)}header a{display:flex;align-items:center;gap:6px;color:var(--t1);text-decoration:none;font-weight:800;font-size:19px}header small{font-weight:700;font-size:15px;color:var(--nv)}main{max-width:640px;margin:0 auto;padding:20px 16px}.off{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;background:var(--sf);border:1px solid var(--bd);font-size:13px;font-weight:600;color:var(--t2)}h1{font-size:22px;margin:14px 0 4px}p{margin:0 0 16px;color:var(--t2);font-size:15px}h2{font-size:15px;margin:22px 0 8px;color:var(--t2)}ul{list-style:none;margin:0;padding:0;background:var(--sf);border:1px solid var(--bd);border-radius:16px;overflow:hidden}li+li{border-top:1px solid var(--bd)}li a{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;padding:0 16px;color:var(--t1);text-decoration:none;font-weight:600;font-size:15px}li a::after{content:'';flex:none;width:8px;height:8px;border-right:2px solid var(--t3);border-top:2px solid var(--t3);transform:rotate(45deg)}li a span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.home{display:flex;align-items:center;justify-content:center;min-height:52px;margin-top:20px;border-radius:14px;background:var(--nv);color:#fff;text-decoration:none;font-weight:700}@media (prefers-color-scheme:dark){.home{color:#0f1115}}nav{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(4,1fr);padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:var(--sf);border-top:1px solid var(--bd)}nav a{display:flex;flex-direction:column;align-items:center;gap:3px;min-height:50px;justify-content:center;color:var(--t2);font-size:11.5px;font-weight:600;text-decoration:none}nav a[aria-current]{color:var(--nv)}nav .w{display:contents}nav .a,.home .a{display:none}html.app nav .w,html.app .home .w{display:none}html.app nav .a{display:contents}html.app .home .a{display:inline}html.app nav{grid-template-columns:repeat(5,1fr)}";
  const nav = `<span class="w">${tab("/", "찾기", "M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14", 1)}</span><span class="a">${tab("/", "홈", "M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z", 1)}${tab("/#map", "지도", "M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14")}</span>` + tab("/#favTop", "관심", "M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.4 7.2 4.4c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z") + tab("/#news", "소식", "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4zM10 20.5a2.2 2.2 0 0 0 4 0") + tab("/#my", "MY", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0");
  const li = items.filter(Boolean).map(([u, t]) => `<li><a href="${esc(u)}"><span>${esc(t)}</span></a></li>`).join("");
  return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark"><title>오프라인 | ${BRAND}</title><style>${css}</style><body><header><a href="/" aria-label="${BRAND} 처음으로"><img src="/icons/favicon.svg" width="26" height="26" alt="">${BRAND} <small lang="en">${BRAND_EN}</small></a></header><main><span class="off">오프라인</span><h1>이 페이지는 아직 저장돼 있지 않아요</h1><p>연결되면 다시 열어 주세요. 이 기기에 저장된 화면은 바로 볼 수 있어요.</p>${li ? `<h2>이 기기에 저장된 페이지</h2><ul>${li}</ul>` : ""}<a class="home" href="/"><span class="w">찾기(저장된 첫 화면)로</span><span class="a">홈(저장된 첫 화면)으로</span></a></main><nav aria-label="주요 메뉴">${nav}</nav><script>(function(){var a=false;try{a=sessionStorage.getItem("zp.tapp")==="1"}catch(e){}try{a=a||matchMedia("(display-mode: standalone)").matches||matchMedia("(display-mode: fullscreen)").matches}catch(e){}if(a)document.documentElement.classList.add("app")})()</script></body></html>`, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
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
    if (doc || !isApp(path)) return offlinePage();
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
    if (u.pathname.startsWith("/api/contact") || /^\/admin(\.html)?$/.test(u.pathname)) return; // 문의 양식·운영자 화면은 저장하지 않는다(늘 네트워크)
    if (req.mode === "navigate") return e.respondWith(page(e));
    if (u.pathname.startsWith("/b/")) return e.respondWith(cacheFirst(e, BUND)); // 해시가 박힌 앱 코드·데이터
    if (u.pathname.startsWith("/data/") || u.pathname.startsWith("/api/") || /^\/(premium\.json|manifest\.webmanifest|icons?[^/]*\.(png|svg|ico)|icons\/[^/]+\.(png|svg|ico)|og\.png)$/.test(u.pathname)) return e.respondWith(swr(e, u.pathname.startsWith("/icon") || u.pathname.startsWith("/manifest") ? SHELL : DATA));
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
  // 사이클 3: 알림 태그 jp-(옛 이름 태그) — 새 알림을 띄울 때 jp-·zp가 아닌 옛 태그 알림은 닫는다(같은 날 알림이 두 묶음으로 남지 않게)
  e.waitUntil(self.registration.getNotifications().then((ns) => ns.forEach((n) => { if (n.tag && !/^(jp|zp)/.test(n.tag)) n.close(); })).catch(() => {}).then(() => self.registration.showNotification(d.title || `${BRAND} · 새 소식`, { body: d.body || "관심 구역에 새 소식이 있어요", icon: "/icons/icon-192.png", badge: "/icon-badge-96.png", tag: d.tag || "jp", lang: "ko", data: { url } })));
});
// 알림을 누르면: 열린 앱 창이 있으면 그 창에서 구역을 열고(앱이 메시지를 받아 #id로 이동), 없으면 새 창
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // 새 문의 알림(/admin.html): 열린 운영자 화면이 있으면 그 창을 앞으로(화면이 다시 보이면 목록을 새로 받는다), 없으면 새 창
    if (/\/admin(\.html)?$/.test(new URL(url).pathname)) { const a = cs.find((x) => /\/admin(\.html)?$/.test(new URL(x.url).pathname)); if (a) { try { await a.focus(); } catch (_) {} return; } await self.clients.openWindow(url); return; }
    const c = cs.find((x) => new URL(x.url).origin === self.location.origin && new URL(x.url).pathname === "/") || null;
    if (c) { try { await c.focus(); } catch (_) {} c.postMessage({ t: "zp-open", url }); return; }
    // 6라운드: 첫 화면 말고 다른 페이지 창을 그 주소로 옮기던 것(navigate)은 뺌 — 그 창이 앱인지 브라우저 탭인지 서비스 워커가 알 수 없어(정적 페이지는 답할 코드가 없음) 브라우저 탭을 옮길 수 있었다 · 라이브와 같이 새 창
    await self.clients.openWindow(url);
  })());
});
