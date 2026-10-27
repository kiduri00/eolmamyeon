#!/usr/bin/env node
/* 재개픽 스토어·매니페스트 스크린샷 촬영 (설치 앱 화면 = TWA 앱 모드)
 *
 *   NODE_PATH=$(npm root -g) node android/assets-src/shots/capture.js <빌드 폴더> [--out DIR] [--dry] [--only id,id] [--zone o694]
 *
 *   <빌드 폴더>  사이트 빌드 결과(public/ 또는 c1_public 같은 사본). 이 스크립트가 로컬 정적 서버로 띄웁니다.
 *   --out DIR    결과 폴더(기본: <빌드 폴더>/../shots_jp_<날짜>). 아래 3개 하위 폴더를 만듭니다.
 *                  raw/       앱 화면 그대로 1080×1920 (360×640 CSS px, DPR 3)
 *                  store/     Play 휴대전화 스크린샷 6장 1080×1920(위 남색 띠 + 문구 + 앱 화면 틀), 24비트 RGB PNG
 *                  manifest/  웹 매니페스트용 screenshot-home.png·screenshot-map.png(1080×1920)·screenshot-wide.png(1920×1080)
 *                  report.json  장면별 검사 결과(크기, 앱 모드, 옛 이름 잔존, 빈 화면, 콘솔 오류, 외부 요청)
 *   --dry        모든 장면을 찍고 검사하지만, 결과 폴더 이름에 _dry를 붙이고 manifest/ 파일은 "dry-" 접두사로 저장합니다.
 *                (실수로 public/에 복사하지 않도록. 최종 촬영은 UI가 굳은 뒤 --dry 없이)
 *   --only       일부 장면만(예: --only s04_diag,m_wide)
 *   --zone       구역 화면에 쓸 구역 id(기본 o694 공덕6구역)
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
const ROOT = argv.find((a, i) => !a.startsWith("--") && !["--out", "--only", "--zone", "--tzone"].includes(argv[i - 1]));
if (!ROOT || !fs.existsSync(path.join(ROOT, "index.html"))) { console.error("usage: capture.js <build folder with index.html> [--out DIR] [--dry] [--only ids] [--zone oNNN]"); process.exit(2); }
const DRY = argv.includes("--dry");
const ZONE = opt("--zone", "o694");
const ONLY = (opt("--only", "") || "").split(",").filter(Boolean);
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const OUT = path.resolve(opt("--out", path.join(path.dirname(path.resolve(ROOT)), `shots_jp_${stamp}${DRY ? "_dry" : ""}`)));
const EXE = process.env.SHOT_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// ---------------------------------------------------------------- 장면
// kind store: Play 휴대전화 스크린샷(문구 띠 합성) · manifest: 웹 매니페스트(앱 화면 그대로)
// steps: {hash} 주소 # 바꾸기 · {tab} 구역 시트 탭(money|biz|tx|loc) · {fill:[sel,val]} · {click: sel} · {wait: ms} · {scroll: sel} · {top:true}
const TZONES = opt("--tzone", "") ? [opt("--tzone")] : ["o913", "o960", "o836", "o380", "o1176", "o957", ZONE];
const FAV = [ZONE, "o913", "o960", "o836", "o380"];
const SCENES = [
  { id: "s01_home", kind: "store", vp: "phone", path: "/", ready: "#hdr", steps: [{ top: true }],
    cap: ["내 돈으로 갈 수 있는", "서울 재개발"] },
  { id: "s02_map", kind: "store", vp: "phone", path: "/#map", ready: "#hdr", steps: [{ wait: 1500 }],
    cap: ["갈 수 있는 구역을", "지도에서 한눈에"] },
  { id: "s03_zone", kind: "store", vp: "phone", path: `/#${ZONE}`, ready: "#report [role=tab]", steps: [{ tab: "money" }],
    cap: ["지금 필요한 돈, 입주까지 현금,", "언제 입주를 한 화면에"] },
  { id: "s04_diag", kind: "store", vp: "phone", path: "/#diagTop", ready: "#dgQ",
    steps: [{ fill: ["#dgQ", "공덕6구역"] }, { wait: 1500 }, { click: "#dgS [data-d]" }, { wait: 2500 }, { scroll: "#dgQ" }],
    cap: ["매수 전 진단으로", "입주권·거래 규정 먼저 확인"] },
  // 타임라인은 인가일 기록이 있는 구역에만 나옴 → TZONES를 차례로 열어 .ztl이 있는 첫 구역을 씀(--tzone으로 지정 가능)
  { id: "s05_timeline", kind: "store", vp: "phone", path: "/", zones: TZONES, need: ".ztl", ready: "#hdr",
    steps: [{ tab: "biz" }, { wait: 1500 }, { scroll: ".ztl", offset: 64 }],
    cap: ["단계 타임라인과", "다음 단계 예상 범위"] },
  { id: "s06_news", kind: "store", vp: "phone", path: "/#news", ready: "#hdr", steps: [{ wait: 1500 }],
    cap: ["관심 구역 소식과", "알림을 구역·조건별로"] },
  { id: "m_home", kind: "manifest", file: "screenshot-home.png", vp: "phone", path: "/", ready: "#hdr", steps: [{ top: true }] },
  { id: "m_map", kind: "manifest", file: "screenshot-map.png", vp: "phone", path: "/#map", ready: "#hdr", steps: [{ wait: 1500 }] },
  { id: "m_wide", kind: "manifest", file: "screenshot-wide.png", vp: "wide", path: "/", ready: "#hdr", steps: [{ top: true }] },
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
.dot{width:18px;height:18px;border-radius:50%;background:#F5B82E;margin-bottom:34px}
h1{margin:0;font-weight:800;font-size:64px;line-height:1.32;letter-spacing:-1.5px;text-align:center}
.frame{position:absolute;left:140px;top:450px;width:800px;border-radius:44px 44px 0 0;overflow:hidden;background:#fff;box-shadow:0 10px 40px rgba(31,58,135,.18);border:2px solid #E3E8F4;border-bottom:0;line-height:0}
.frame img{display:block;width:800px;height:auto}
</style></head><body><div class="band"><i class="dot"></i><h1>${cap.map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("<br>")}</h1></div>
<div class="frame"><img src="data:image/png;base64,${png.toString("base64")}"></div></body></html>`;

// ---------------------------------------------------------------- 실행
(async () => {
  for (const d of ["raw", "store", "manifest"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  const srv = await serve(ROOT);
  const BASE = `http://127.0.0.1:${srv.address().port}`;
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
          localStorage.setItem("zp-cond", JSON.stringify([{ id: "cshot1", name: "3억 전세 끼고", cash: 3, mode: "gap", base: [], at: Date.now() - 30 * 864e5, seen: "", asOf: "" }]));
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
      if (sc.zones) {   // 구역 후보를 차례로: need 선택자가 생기는 첫 구역
        let hit = "";
        for (const z of sc.zones) {
          await page.evaluate((h) => { location.hash = h; }, "#" + z);
          await page.waitForSelector("#report [role=tab]", { timeout: 10000 }).catch(() => {});
          await page.click('#report [role=tab][data-tab="biz"]', { timeout: 5000 }).catch(() => {});
          if (await page.waitForSelector(sc.need, { state: "attached", timeout: 4000 }).then(() => true, () => false)) { hit = z; break; }
        }
        res.zone = hit || "none";
        if (!hit) throw new Error(`no zone in [${sc.zones}] shows ${sc.need}`);
      }
      for (const s of sc.steps) {
        if (s.top) await page.evaluate(() => scrollTo(0, 0));
        if (s.wait) await page.waitForTimeout(s.wait);
        if (s.hash) await page.evaluate((h) => { location.hash = h; }, s.hash);
        if (s.tab) { await page.click(`#report [role=tab][data-tab="${s.tab}"]`, { timeout: 8000 }); await page.waitForTimeout(1200); }
        if (s.fill) { await page.fill(s.fill[0], ""); await page.type(s.fill[0], s.fill[1], { delay: 30 }); }
        if (s.click) await page.click(s.click, { timeout: 8000 });
        if (s.scroll) await page.evaluate(([q, off]) => { const e = document.querySelector(q); if (!e) return; e.scrollIntoView({ block: "start" }); if (off) { let p = e.parentElement; while (p && p !== document.body) { const o = getComputedStyle(p).overflowY; if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) { p.scrollTop -= off; return; } p = p.parentElement; } scrollBy(0, -off); } }, [s.scroll, s.offset || 0]);
      }
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.addStyleTag({ content: ".zp-off{display:none!important} *{caret-color:transparent!important}" });
      await page.waitForTimeout(900);
      const png = await page.screenshot({ type: "png" });
      const info = await page.evaluate((re) => {
        const H = document.documentElement, txt = document.body.innerText || "";
        const m = txt.match(new RegExp(re));
        return { gl: !!window.maplibregl, tapp: H.classList.contains("is-tapp"), tabs: document.querySelectorAll(".zp-tabs a, #sNav a, #sNav button").length, oldName: m ? m[0] : "", hash: location.hash, title: document.title.slice(0, 40) };
      }, OLD_NAME.source);
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
      if (/#map/.test(sc.path) && !info.gl) problems.push("map library (MapLibre) not loaded: map drawn as fallback");
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
  srv.close();
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
