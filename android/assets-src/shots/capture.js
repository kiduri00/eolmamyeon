#!/usr/bin/env node
/* 재개픽 스토어·매니페스트 스크린샷 촬영 (설치 앱 화면 = TWA 앱 모드)
 *
 *   NODE_PATH=$(npm root -g) node android/assets-src/shots/capture.js <빌드 폴더> [--out DIR] [--dry] [--only id,id] [--zone o694]
 *
 *   <빌드 폴더>  사이트 빌드 결과(public/ 또는 c1_public 같은 사본). 이 스크립트가 로컬 정적 서버로 띄웁니다.
 *   --out DIR    결과 폴더(기본: <빌드 폴더>/../shots_jp_<날짜>). 아래 3개 하위 폴더를 만듭니다.
 *                  raw/       앱 화면 그대로 1080×1920 (360×640 CSS px, DPR 3)
 *                  store/     Play 휴대전화 스크린샷 8장 1080×1920(위 남색 띠 + 문구 + 앱 화면 틀), 24비트 RGB PNG
 *                  manifest/  웹 매니페스트용 screenshot-home.png·screenshot-map.png(1080×1920)·screenshot-wide.png(1920×1080)
 *                  report.json  장면별 검사 결과(크기, 앱 모드, 옛 이름 잔존, 빈 화면, 콘솔 오류, 외부 요청)
 *   --dry        모든 장면을 찍고 검사하지만, 결과 폴더 이름에 _dry를 붙이고 manifest/ 파일은 "dry-" 접두사로 저장합니다.
 *                (실수로 public/에 복사하지 않도록. 최종 촬영은 UI가 굳은 뒤 --dry 없이)
 *   --only       일부 장면만(예: --only s04_diag,m_wide)
 *   --zone       관심 구역 첫 자리에 넣을 구역 id(기본 o694 공덕6구역)
 *   --base URL   이 스크립트 안의 서버 대신 이미 띄운 서버(예: http://127.0.0.1:8995, 빌드 폴더와 같은 내용)
 *   --gu 성북구  지도 구 줌·목록 장면의 구 · --pick 동소문2구역 시트 장면 구역 · --cmp 동소문2구역,성북2구역,장위11-8구역 비교 장면 구역
 *
 * 장면(사이클 5 통합 · jp4 8장): 01 홈 오늘의 재개발 카드 · 02 지도 서울 줌 D+('✓ 구 N') · 03 구역 시트(판정 띠+3칸)
 *   · 04 소식 '서울 오늘' · 05 일정(매각기일·D-day·내 일정) · 06 내 돈 레이더 · 07 입주 계산 · 08 관심 구역
 *   매니페스트: home(홈) · map(서울 줌 '✓ 구 N') · wide(넓은 화면 홈: 왼쪽 목록·오른쪽 지도)
 *   기기 상태로 넣는 것은 내 돈 3억·전세 끼고(jg-cond)와 관심 구역 5곳뿐. 알림 조건은 화면에서 실제로 눌러 저장(꾸민 '새 구역' 없음).
 *
 * 외부: 지도(MapLibre, cdnjs)와 지도 타일(openfreemap)은 실제 앱처럼 받아야 지도가 그려집니다. HTTPS_PROXY가 있으면 Node 쪽 요청으로
 *       받아 넘겨 줍니다(사내 프록시 CA는 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt). 없으면 막고, 지도 장면은 실패로 표시합니다.
 *
 * 앱 모드: TWA로 열린 것처럼 sessionStorage zp.tapp=1 + document.referrer android-app://kr.alwaysquestions.jaegaepick/
 *          (사이트 shell.html의 설치 앱 판정과 같은 규칙) → html.is-tapp, 아래 탭 5개(홈·지도·관심·소식·MY).
 * 광고·통계·문의·푸시 API 요청은 막습니다(스크린샷에 광고 칸이 찍히지 않게, 그리고 외부로 아무것도 보내지 않게).
 * 글꼴: 사이트가 jsdelivr에서 받는 Pretendard Variable을 이 기기에 설치된 Pretendard(local)로 바꿔 끼웁니다(오프라인에서도 같은 글꼴).
 *
 * 성공 = 모든 장면 ok. 하나라도 실패하면 exit 1.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium, request } = require("playwright");

// ---------------------------------------------------------------- 인자
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = argv.find((a, i) => !a.startsWith("--") && !["--out", "--only", "--zone", "--base", "--gu", "--cmp", "--pick"].includes(argv[i - 1]));
if (!ROOT || !fs.existsSync(path.join(ROOT, "index.html"))) { console.error("usage: capture.js <build folder with index.html> [--out DIR] [--dry] [--only ids] [--zone oNNN]"); process.exit(2); }
const DRY = argv.includes("--dry");
const ZONE = opt("--zone", "o694");
const ONLY = (opt("--only", "") || "").split(",").filter(Boolean);
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const OUT = path.resolve(opt("--out", path.join(path.dirname(path.resolve(ROOT)), `shots_jp_${stamp}${DRY ? "_dry" : ""}`)));
const EXT_BASE = opt("--base", "");   // 이미 띄운 정적 서버(예: python3 -m http.server 8995 -d <빌드 폴더>)를 쓸 때
const EXE = process.env.SHOT_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// ---------------------------------------------------------------- 장면
// kind store: Play 휴대전화 스크린샷(문구 띠 합성) · manifest: 웹 매니페스트(앱 화면 그대로)
// steps: {nav:"지도"} 아래 탭 누르기 · {js:"…"} 페이지에서 실행(await 가능) · {mapIdle:true} 지도 타일·라벨이 다 그려질 때까지
//        {tab} 구역 시트 탭(money|biz|tx|loc) · {fill:[sel,val]} · {click: sel} · {wait: ms} · {scroll: sel} · {top:true}
// check: {gl:true} MapLibre 지도(구 줌 이하) · {city:true} 서울 줌 구 태그(.zgu) · {sel:"…"} 보여야 하는 요소
// 사이클 4 화면(D+ 지도·v2 디자인) 기준. 숫자는 모두 빌드 자료 그대로(내 돈 3억·전세 끼고만 정해 둠).
const GU = opt("--gu", "성북구");
const CMPZ = (opt("--cmp", "동소문2구역,성북2구역,장위11-8구역") || "").split(",");
const PICK = opt("--pick", "동소문2구역");
const GO_GU = `const b=[...document.querySelectorAll(".zgu")].find((x)=>x.dataset.gu===${JSON.stringify(GU)}&&x.offsetWidth); if(b) b.click(); else ZP_lmx.attach();`;
const idOf = (n) => `(()=>{const c=ZP_feat.ctx(),r=c.R.find((q)=>c.shortName(q.n)===${JSON.stringify(n)});if(!r)throw new Error("no zone ${n}");return r.id;})()`;
const FAV = [ZONE, "o913", "o960", "o836", "o380"];
const SCENES = [
  // 사이클 5 통합(jp4 · 8장 · 트랙 G shots_plan.md/shots_spec.json): raw만 찍고 합성은 G의 compose.py(점 = 연한 남색)
  //   피할 것: 신고가 칩·꼬리표, 핀 모양, 개인 이름, 0건·로딩·토스트·설치 띠·광고 칸
  { id: "s01_today", kind: "store", vp: "phone", path: "/", ready: "#sHero",
    steps: [{ top: true }, { wait: 3500 }, { scroll: "[data-zp-today]", offset: 72 }, { wait: 1800 }],   // 통합: 앱 홈 오늘 카드는 '가장 맞는 곳' 밑(첫 화면 제목 규칙) → 카드 전체가 보이게
    check: { sel: "[data-zp-today]" }, cap: ["내 돈으로 갈 수 있는", "서울 재개발, 매일 아침"] },
  { id: "s02_map", kind: "store", vp: "phone", path: "/", ready: "#sHero",
    steps: [{ nav: "지도" }, { wait: 3000 }, { js: GO_GU }, { mapIdle: true, min: 3 }, { wait: 1500 }, { js: `const b=[...document.querySelectorAll("button,a")].find((x)=>/신고가/.test(x.textContent)&&x.offsetWidth); let r=b&&b.parentElement; while(r&&!(r.scrollWidth>r.clientWidth+4&&/(auto|scroll)/.test(getComputedStyle(r).overflowX))) r=r.parentElement; if(r){ r.scrollLeft=b.getBoundingClientRect().right-r.getBoundingClientRect().left+r.scrollLeft+6; }` }, { wait: 400 }],
    check: { gl: true, sel: ".zpill" }, cap: ["갈 수 있는 구역만", "지도에 체크로"] },
  { id: "s03_sheet", kind: "store", vp: "phone", path: "/", ready: "#sHero",
    steps: [{ nav: "지도" }, { wait: 3000 }, { js: GO_GU }, { mapIdle: true }, { js: `const id=${idOf(PICK)}; ZP_lmx.pick(id);` }, { wait: 2500 },
      // 360×640에서는 시트 위 지도 띠가 좁아 고른 구역 카드가 머리 칩 밑에 반쯤 걸림 → 카드가 시트 뒤로 가도록 지도만 살짝 내림
      { js: `ZP_lmx.map().panBy([0,-45],{duration:0});` }, { mapIdle: true }, { wait: 1200 }, { js: `const b=[...document.querySelectorAll("button,a")].find((x)=>/신고가/.test(x.textContent)&&x.offsetWidth); let r=b&&b.parentElement; while(r&&!(r.scrollWidth>r.clientWidth+4&&/(auto|scroll)/.test(getComputedStyle(r).overflowX))) r=r.parentElement; if(r){ r.scrollLeft=b.getBoundingClientRect().right-r.getBoundingClientRect().left+r.scrollLeft+6; }` }],
    check: { gl: true, sel: ".pk-n" }, cap: ["구역을 누르면", "입주까지 드는 현금까지"] },
  { id: "s04_radar", kind: "store", vp: "phone", path: "/", ready: "#sHero",
    steps: [{ nav: "소식" }, { wait: 2500 }, { click: '#nwSeg [data-nseg="mine"]' }, { wait: 3000 }, { scroll: "#nwRad", offset: 64 }, { wait: 1200 }],
    check: { sel: "#nwRad" }, cap: ["이번 주 내 돈으로", "새로 닿은 곳과 이유"] },
  { id: "s05_seoul", kind: "store", vp: "phone", path: "/", ready: "#sHero",
    steps: [{ nav: "소식" }, { wait: 2500 }, { click: '#nwSeg [data-nseg="today"]' }, { wait: 3000 }, { top: true }, { wait: 600 }],
    check: { sel: "#nwSeg" }, cap: ["오늘 서울 재개발에", "새로 올라온 소식"] },
  { id: "s06_sched", kind: "store", vp: "phone", path: "/", ready: "#sHero",
    steps: [{ nav: "소식" }, { wait: 2500 }, { click: '#nwSeg [data-nseg="cal"]' }, { wait: 3000 }, { js: `const h=[...document.querySelectorAll("#news h3,#news h4,#news b,#news strong")].find((x)=>/^경매 매각기일/.test(x.textContent.trim())&&x.offsetWidth); if(h){ h.scrollIntoView({block:"start"}); scrollBy(0,-64); }` }, { wait: 800 }],
    check: {}, cap: ["경매 매각기일과", "내 일정을 D-day로"] },
  { id: "s07_planner", kind: "store", vp: "phone", path: "/", ready: "#sHero",
    steps: [{ nav: "홈" }, { wait: 1500 }, { click: '#tHome .th-grid a[data-tile="calc"]' }, { wait: 3500 }, { top: true }, { wait: 800 }],
    check: {}, cap: ["분담금·이자까지 넣어", "입주까지 현금 계산"] },
  { id: "s08_watch", kind: "store", vp: "phone", path: "/", ready: "#sHero",
    steps: [{ nav: "관심" }, { wait: 3500 }, { top: true }, { wait: 800 }],
    check: {}, cap: ["관심 구역 소식은", "아침에 한 번만"] },
  { id: "m_home", kind: "manifest", file: "screenshot-home.png", vp: "phone", path: "/", ready: "#sHero", steps: [{ top: true }, { wait: 800 }], check: { sel: "#sHero" } },
  { id: "m_map", kind: "manifest", file: "screenshot-map.png", vp: "phone", path: "/", ready: "#sHero", steps: [{ nav: "지도" }, { wait: 4000 }], check: { city: true } },
  { id: "m_wide", kind: "manifest", file: "screenshot-wide.png", vp: "wide", path: "/", ready: "#sHero", steps: [{ top: true }, { wait: 2500 }], check: {} },
].filter((s) => !ONLY.length || ONLY.includes(s.id));

const VP = {
  phone: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36" },
  wide: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 },
};
// 외부 라이브러리(지도 MapLibre: cdnjs)는 실제 앱처럼 받아야 지도가 그려짐 → HTTPS_PROXY가 있으면 그걸로, 로컬 서버는 우회
const PROXY = (() => { const p = process.env.HTTPS_PROXY || process.env.https_proxy; if (!p) return undefined;
  try { const u = new URL(p); return { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username) || undefined, password: decodeURIComponent(u.password) || undefined, bypass: "127.0.0.1,localhost" }; } catch (e) { return { server: p, bypass: "127.0.0.1,localhost" }; } })();
const OLD_NAME = /집핀|Zippin|zippin|재개각|재개랩|얼마면 재개발/;
const BLOCK = /googlesyndication|googletagmanager|google-analytics|doubleclick|adservice|adtrafficquality|fundingchoices|pagead2|cloudflareinsights|\/api\/(contact|push)/i;

// ---------------------------------------------------------------- 정적 서버(깨끗한 주소 /z/x → /z/x.html, 폴더 → index.html)
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".webp": "image/webp", ".xml": "application/xml", ".txt": "text/plain", ".woff2": "font/woff2" };
function serve(root) {
  const R = path.resolve(root);
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
    let f = path.join(R, p);
    if (!f.startsWith(R)) { r.writeHead(403); return r.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    else if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
    if (!fs.existsSync(f)) { r.writeHead(404, { "Content-Type": "text/html" }); return r.end(fs.existsSync(path.join(R, "404.html")) ? fs.readFileSync(path.join(R, "404.html")) : "404"); }
    r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(f).pipe(r);
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

// jsdelivr Pretendard Variable → 이 기기의 Pretendard(정적 9굵기)로
const W = [[100, "Thin"], [200, "ExtraLight"], [300, "Light"], [400, "Regular"], [500, "Medium"], [600, "SemiBold"], [700, "Bold"], [800, "ExtraBold"], [900, "Black"]];
const FONT_CSS = W.map(([w, n]) => `@font-face{font-family:"Pretendard Variable";font-weight:${w};font-display:block;src:local("Pretendard ${n}"),local("Pretendard-${n}")}`).join("\n");

// ---------------------------------------------------------------- 합성(스토어용 문구 띠)
const compose = (png, cap) => `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#EEF2FB;font-family:"Pretendard Variable",Pretendard,"Noto Sans CJK KR",sans-serif}
.band{position:absolute;left:0;top:0;width:1080px;height:400px;background:#1F3A87;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}
.dot{width:18px;height:18px;border-radius:50%;background:#F5C33B;margin-bottom:34px}
h1{margin:0;font-weight:700;font-size:64px;line-height:1.32;letter-spacing:-1.5px;text-align:center}
.frame{position:absolute;left:140px;top:450px;width:800px;border-radius:44px 44px 0 0;overflow:hidden;background:#fff;box-shadow:0 10px 40px rgba(31,58,135,.18);border:2px solid #E3E8F4;border-bottom:0;line-height:0}
.frame img{display:block;width:800px;height:auto}
</style></head><body><div class="band"><i class="dot"></i><h1>${cap.map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("<br>")}</h1></div>
<div class="frame"><img src="data:image/png;base64,${png.toString("base64")}"></div></body></html>`;

// ---------------------------------------------------------------- 실행
(async () => {
  for (const d of ["raw", "store", "manifest"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  const srv = EXT_BASE ? null : await serve(ROOT);
  const BASE = EXT_BASE ? EXT_BASE.replace(/\/$/, "") : `http://127.0.0.1:${srv.address().port}`;
  // 브라우저는 프록시 없이(로컬 서버 직접), 외부 요청만 Node 쪽 요청 컨텍스트가 프록시로 받아 넘겨 줌
  const EXT = PROXY ? await request.newContext({ proxy: PROXY }) : null;
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--font-render-hinting=none"] });
  const report = { root: path.resolve(ROOT), out: OUT, dry: DRY, zone: ZONE, at: new Date().toISOString(), scenes: [] };
  let bad = 0;
  for (const sc of SCENES) {
    const res = { id: sc.id, kind: sc.kind, ok: false, errors: [], external: [], blocked: 0 };
    const ctx = await browser.newContext({ ...VP[sc.vp], colorScheme: "light", locale: "ko-KR", timezoneId: "Asia/Seoul", serviceWorkers: "block" });
    await ctx.route("**/*", async (r) => {
      const u = r.request().url();
      if (BLOCK.test(u)) { res.blocked++; return r.abort(); }
      if (/pretendard/i.test(u) && /\.css(\?|$)/.test(u)) return r.fulfill({ status: 200, contentType: "text/css", body: FONT_CSS });
      if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) {
        res.external.push(u.slice(0, 90));
        if (!EXT) return r.abort();   // 프록시가 없으면 외부(지도 라이브러리 등)는 막고 report에 남김
        try { return r.fulfill({ response: await EXT.fetch(r.request(), { timeout: 20000 }) }); } catch (e) { res.errors.push("ext " + u.slice(0, 60) + " " + String(e).slice(0, 60)); return r.abort(); }
      }
      // 바깥 서버(--base, python http.server)는 깨끗한 주소(/report/2026-10 → .html)를 모름 → 사이트(Cloudflare)처럼 여기서 .html을 내 줌
      if (EXT_BASE) { const pn = decodeURIComponent(new URL(u).pathname), f = path.join(path.resolve(ROOT), pn);
        if (!path.extname(pn) && !pn.endsWith("/") && f.startsWith(path.resolve(ROOT)) && fs.existsSync(f + ".html")) return r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fs.readFileSync(f + ".html") }); }
      return r.continue();
    });
    await ctx.addInitScript(([FAV]) => {
      try { Object.defineProperty(Document.prototype, "referrer", { get: () => "android-app://kr.alwaysquestions.jaegaepick/" }); } catch (e) {}
      try { sessionStorage.setItem("zp.tapp", "1"); } catch (e) {}
      try {
        if (!localStorage.getItem("__shotSeed")) {
          localStorage.setItem("__shotSeed", "1");
          localStorage.setItem("jg-fav", JSON.stringify(FAV));
          localStorage.setItem("jg-cond", "cash=3&mode=jeonse");
          localStorage.setItem("zp-seen-t", JSON.stringify(Date.parse("2026-10-20T09:00:00+09:00"))); localStorage.setItem("zp-inbox-seen", JSON.stringify({ at: "2026-10-20", k: [] }));   // 지난번 본 날 = 자료 기준일 며칠 전(트랙 G 계획)
        }
        localStorage.setItem("zp.onb", "1"); localStorage.setItem("zp.tonb", "1"); localStorage.setItem("zp-pwa-hint", String(Date.now()));
      } catch (e) {}
    }, [FAV]);
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") res.errors.push(m.text().slice(0, 160)); });
    page.on("pageerror", (e) => res.errors.push("PE " + String(e).slice(0, 160)));
    try {
      await page.goto(BASE + sc.path, { waitUntil: "load", timeout: 30000 });
      await page.waitForFunction(() => { const H = document.documentElement.classList; return H.contains("is-tapp") && !H.contains("tapp-cover") && !H.contains("tapp-wait"); }, null, { timeout: 20000 });
      await page.waitForSelector(sc.ready, { state: "attached", timeout: 20000 });
      for (const s of sc.steps) {
        if (s.top) await page.evaluate(() => scrollTo(0, 0));
        if (s.nav) { const ok = await page.evaluate((n) => { const b = [...document.querySelectorAll("#sNav a, #sNav button, .zp-tabs a, nav a, nav button")].find((e) => e.innerText.trim().replace(/\s*N$/, "") === n && e.offsetWidth); if (b) b.click(); return !!b; }, s.nav); if (!ok) throw new Error("no tab " + s.nav); }
        if (s.js) await page.evaluate(`(async()=>{${s.js}})()`);
        if (s.mapIdle) {   // 지도: 움직임이 멈추고 타일이 다 오고 태그(라벨)가 min개 이상 · 두 번 연속 확인
          await page.waitForFunction((min) => { const L = window.ZP_lmx, m = L && L.map && L.map(); if (!m || !m.loaded() || m.isMoving() || !m.areTilesLoaded()) { window.__idl = 0; return false; } if (L.labels && L.labels().length < min) return false; window.__idl = (window.__idl || 0) + 1; return window.__idl > 3; }, s.min || 0, { timeout: 45000, polling: 250 });
        }
        if (s.wait) await page.waitForTimeout(s.wait);
        if (s.hash) await page.evaluate((h) => { location.hash = h; }, s.hash);
        if (s.tab) { await page.click(`#report [role=tab][data-tab="${s.tab}"]`, { timeout: 8000 }); await page.waitForTimeout(1200); }
        if (s.fill) { await page.fill(s.fill[0], ""); await page.type(s.fill[0], s.fill[1], { delay: 30 }); }
        if (s.click) await page.click(s.click, { timeout: 8000 });
        if (s.scroll) await page.evaluate(([q, off]) => { const e = document.querySelector(q); if (!e) return; e.scrollIntoView({ block: "start" }); if (off) scrollBy(0, -off); }, [s.scroll, s.offset || 0]);
      }
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.addStyleTag({ content: ".zp-off{display:none!important} *{caret-color:transparent!important}" });
      await page.waitForTimeout(900);
      if (sc.check && sc.check.gl) await page.waitForFunction(() => { const m = window.ZP_lmx && ZP_lmx.map(); return m && m.areTilesLoaded() && !m.isMoving(); }, null, { timeout: 30000 }).catch(() => {});
      const png = await page.screenshot({ type: "png" });
      const info = await page.evaluate(([re, ck]) => {
        const H = document.documentElement, txt = document.body.innerText || "";
        const m = txt.match(new RegExp(re));
        const vis = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && c.visibility !== "hidden" && +c.opacity > 0.05; };
        // 화면 안에 보이는 '불러오는 중'·스피너·뼈대
        const load = [...document.querySelectorAll("body *")].filter((e) => !e.children.length && /불러오는 중|로딩|계산하는 중|잠시만/.test(e.textContent) && vis(e)).map((e) => e.textContent.trim().slice(0, 30))
          .concat([...document.querySelectorAll('[class*="spin"],[class*="skel"],[aria-busy="true"]')].filter(vis).map((e) => "." + String(e.className).slice(0, 30)));
        const m2 = window.ZP_lmx && ZP_lmx.map && ZP_lmx.map();
        return { gl: !!window.maplibregl, tiles: m2 ? m2.areTilesLoaded() : null, tier: window.ZP_lmx && ZP_lmx.tier ? ZP_lmx.tier() : null, labels: window.ZP_lmx && ZP_lmx.labels ? ZP_lmx.labels().length : null,
          city: [...document.querySelectorAll(".zgu")].filter(vis).length, sel: ck.sel ? [...document.querySelectorAll(ck.sel)].filter(vis).length : null,
          loading: load.slice(0, 5), fontsOk: document.fonts ? document.fonts.status === "loaded" : true,
          tapp: H.classList.contains("is-tapp"), tabs: document.querySelectorAll(".zp-tabs a, #sNav a, #sNav button").length, oldName: m ? m[0] : "", hash: location.hash, title: document.title.slice(0, 40) };
      }, [OLD_NAME.source, sc.check || {}]);
      Object.assign(res, info);
      const rawFile = path.join(OUT, "raw", sc.id + ".png");
      fs.writeFileSync(rawFile, png);
      // 빈 화면 검사: 고유 색 수(PNG를 다시 찍어 보는 대신 canvas로 셈)
      const probe = await page.evaluate(async (b64) => {
        const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
        const c = document.createElement("canvas"); c.width = 120; c.height = Math.round(120 * im.height / im.width);
        const g = c.getContext("2d"); g.drawImage(im, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height).data, S = new Set(); for (let i = 0; i < d.length; i += 4) S.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4));
        return { w: im.width, h: im.height, colors: S.size };
      }, png.toString("base64"));
      res.size = [probe.w, probe.h]; res.colors = probe.colors;
      const wantW = sc.vp === "wide" ? 1920 : 1080, wantH = sc.vp === "wide" ? 1080 : 1920;
      const problems = [];
      if (probe.w !== wantW || probe.h !== wantH) problems.push(`size ${probe.w}x${probe.h}`);
      if (!info.tapp) problems.push("not in app mode");
      if (info.oldName) problems.push(`old name on screen: ${info.oldName}`);
      if (probe.colors < 12) problems.push(`looks blank (${probe.colors} colours)`);
      const ck = sc.check || {};
      if (ck.gl && !(info.gl && info.tiles)) problems.push(`map not ready (maplibre=${info.gl} tiles=${info.tiles})`);
      if (ck.city && info.city < 3) problems.push(`Seoul zoom gu tags missing (${info.city})`);
      if (ck.sel && !info.sel) problems.push(`not on screen: ${ck.sel}`);
      if (info.loading.length) problems.push(`loading shown: ${info.loading.join(", ")}`);
      if (!info.fontsOk) problems.push("fonts still loading");
      // 저장
      if (sc.kind === "manifest") {
        const name = (DRY ? "dry-" : "") + sc.file;
        fs.copyFileSync(rawFile, path.join(OUT, "manifest", name));
        res.file = path.join("manifest", name);
      } else {
        const cp = await ctx.newPage();
        await cp.setViewportSize({ width: 1080, height: 1920 });
        await cp.setContent(compose(png, sc.cap), { waitUntil: "load" });
        await cp.evaluate(() => document.fonts && document.fonts.ready);
        const out = path.join(OUT, "store", sc.id.replace(/^s/, "") + ".png");
        // deviceScaleFactor 3인 컨텍스트이므로 1080×1920 CSS를 1배로 찍으려고 clip + scale "css"
        await cp.screenshot({ path: out, type: "png", scale: "css", clip: { x: 0, y: 0, width: 1080, height: 1920 } });
        await cp.close();
        res.file = path.relative(OUT, out);
      }
      res.problems = problems;
      res.ok = problems.length === 0;
    } catch (e) {
      res.problems = ["exception: " + String(e).split("\n")[0].slice(0, 200)];
    }
    if (!res.ok) bad++;
    report.scenes.push(res);
    console.log(`${res.ok ? "ok  " : "FAIL"} ${sc.id.padEnd(13)} ${res.file || ""} ${res.size ? res.size.join("x") : ""} tapp=${res.tapp} colours=${res.colors} ext=${res.external.length} err=${res.errors.length} ${(res.problems || []).join("; ")}`);
    await ctx.close();
  }
  await browser.close();
  if (EXT) await EXT.dispose();
  if (srv) srv.close();
  // 스토어 PNG는 알파 없는 24비트여야 Play가 받음: 합성 페이지는 불투명 배경이라 알파 255지만, 파일 형식도 RGB로 바꾼다(sharp가 있으면)
  try {
    const sharp = require("sharp");
    for (const d of ["store", "manifest", "raw"]) for (const f of fs.readdirSync(path.join(OUT, d))) {
      const p = path.join(OUT, d, f), buf = await sharp(p).removeAlpha().png({ compressionLevel: 9 }).toBuffer(); fs.writeFileSync(p, buf);
    }
    report.rgb24 = true;
  } catch (e) { report.rgb24 = "sharp not found: PNGs keep the alpha channel (all opaque); convert before upload"; }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n${SCENES.length - bad}/${SCENES.length} ok → ${OUT}${DRY ? "  (dry run: manifest files are prefixed dry-, do not publish)" : ""}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
