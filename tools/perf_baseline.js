#!/usr/bin/env node
/* 성능 기준선(390px 폰 · 4×CPU): 홈 · /#map · /z 한 쪽의 LCP · TBT · 가장 긴 작업 · JS KB — 각 3번, 가운데 값.
   renew/audit/perf_live.js를 다시 쓸 수 있게 고친 것(같은 잣대: 9초 관찰 · 광고·분석 요청 막음 · 캐시 없는 새 문맥).

   재기:   NODE_PATH=$(npm root -g) node tools/perf_baseline.js [baseUrl] [--runs 3] [--cpu 4] [--out file.json]
           baseUrl 기본 http://localhost:8765 (python3 -m http.server 8765 -d public) · 라이브는 https://jaegaebal.alwaysquestions.kr
   견주기: node tools/perf_baseline.js --compare tools/fixtures/perf_main.json new.json
           또는 재면서 바로:  node tools/perf_baseline.js http://localhost:8790 --against tools/fixtures/perf_main.json
           회귀 한도(스펙): JS KB +10% · 가장 긴 작업 +100ms → 넘으면 exit 1. LCP·TBT는 참고(+20%·+300ms 넘으면 경고만).
   JS KB = 받은 스크립트 내용을 gzip -6 한 크기(로컬·라이브 같은 잣대) · jsWireKb = 실제 받은 바이트.
   TBT = 관찰 9초 안 긴 작업(50ms 넘는 부분) 합 — 바쁜 공용 기계에서는 출렁이므로 판정에 쓰지 않는다. */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes("--" + k);
const EXE = process.env.QA_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PAGES = [["home", "/"], ["map", "/#map"], ["z", opt("z", "/z/o1176")], ["drag", "/?cash=2&mode=jeonse#map"]].filter(([k]) => (opt("only", "") ? opt("only", "").split(",").includes(k) : k !== "drag"));   // drag(사이클 4 D+): 구 줌에서 지도 끌기 5번 → 손을 뗀 뒤 라벨 다시 배치(layout) 시간 · 그 뒤 긴 작업 — --only drag로만   // --only map,home : 일부만 재기(빠른 실험)
const LIMIT = { jsPct: 10, longMs: 100, lcpPct: 20, tbtMs: 300 };

const median = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };

function compare(base, cur) {
  const rows = [], fails = [], warns = [];
  for (const [k] of PAGES) {
    const b = base.pages[k], c = cur.pages[k];
    if (!b || !c) { warns.push(`${k}: 한쪽에 없음`); continue; }
    const d = (f) => c[f] - b[f];
    const jsPct = b.jsKb ? (d("jsKb") / b.jsKb) * 100 : 0;
    rows.push(`${k.padEnd(5)} JS ${b.jsKb}→${c.jsKb}KB (${jsPct >= 0 ? "+" : ""}${jsPct.toFixed(1)}%) · 긴 작업 ${b.longMs}→${c.longMs}ms (${d("longMs") >= 0 ? "+" : ""}${d("longMs")}) · LCP ${b.lcp}→${c.lcp}ms · TBT ${b.tbt}→${c.tbt}ms`);
    if (jsPct > LIMIT.jsPct) fails.push(`${k}: JS +${jsPct.toFixed(1)}% > +${LIMIT.jsPct}%`);
    if (d("longMs") > LIMIT.longMs) fails.push(`${k}: 가장 긴 작업 +${d("longMs")}ms > +${LIMIT.longMs}ms`);
    if (b.lcp && (d("lcp") / b.lcp) * 100 > LIMIT.lcpPct) warns.push(`${k}: LCP +${Math.round((d("lcp") / b.lcp) * 100)}%`);
    if (d("tbt") > LIMIT.tbtMs) warns.push(`${k}: TBT +${d("tbt")}ms`);
  }
  console.log(`\nperf compare  base ${base.base} (${base.at}) → ${cur.base} (${cur.at})`);
  rows.forEach((r) => console.log("  " + r));
  warns.forEach((w) => console.log("  WARN " + w));
  fails.forEach((f) => console.log("  FAIL " + f));
  console.log(fails.length ? `\nREGRESSION · ${fails.length}` : "\nOK · 회귀 한도 안(JS +10% · 긴 작업 +100ms)");
  return fails.length;
}

async function measure(BASE, RUNS, CPU) {
  const { chromium } = require("playwright");
  const proxy = () => { const p = process.env.HTTPS_PROXY; if (!p || /localhost|127\.0\.0\.1/.test(BASE)) return undefined; const u = new URL(p); return { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username) || undefined, password: decodeURIComponent(u.password) || undefined }; };
  const b = await chromium.launch({ executablePath: EXE, proxy: proxy(), args: ["--ignore-certificate-errors"] });
  const runs = {};
  for (const [k, p] of PAGES) {
    runs[k] = [];
    for (let i = 0; i < RUNS; i++) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true, serviceWorkers: "block", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36" });
      await ctx.route(/googlesyndication|googletagmanager|google-analytics|doubleclick|adservice|adtrafficquality|fundingchoices|pagead2/, (r) => r.abort());
      // 로컬 python 서버는 깨끗한 주소(/z/o1176)를 못 연다 → .html
      if (/localhost|127\.0\.0\.1/.test(BASE)) await ctx.route(/\/z\/[a-z0-9]+(\?[^#]*)?$/, (q) => { const u = new URL(q.request().url()); if (!u.pathname.endsWith(".html")) u.pathname += ".html"; return q.continue({ url: u.toString() }); });
      const pg = await ctx.newPage();
      const cdp = await ctx.newCDPSession(pg);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
      await cdp.send("Network.enable");
      // JS 크기는 두 가지: 실제 받은 바이트(서버 압축에 따라 다름 · 로컬 python 서버는 압축 안 함) · 내용을 gzip -6 한 크기(어느 서버든 같은 잣대 → 회귀 판정은 이것)
      let bytes = 0, js = 0, jsGz = 0, reqs = 0; const types = {}, pend = [];
      cdp.on("Network.responseReceived", (e) => { types[e.requestId] = e.type; });
      cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; reqs++; if (types[e.requestId] === "Script") { js += e.encodedDataLength; pend.push(cdp.send("Network.getResponseBody", { requestId: e.requestId }).then((b) => { jsGz += zlib.gzipSync(Buffer.from(b.body, b.base64Encoded ? "base64" : "utf8"), { level: 6 }).length; }).catch(() => {})); } });
      await pg.addInitScript(() => {
        window.__lt = []; window.__lcp = 0;
        new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: "longtask", buffered: true });
        new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = Math.round(e.startTime)))).observe({ type: "largest-contentful-paint", buffered: true });
      });
      const q0 = p.includes("?") ? "&" : "?", u = BASE + (p.includes("#") ? p.replace("#", q0 + "pb=" + Date.now() + "#") : p + q0 + "pb=" + Date.now());
      await pg.goto(u, { waitUntil: "load", timeout: 60000 }).catch(() => {});
      await pg.waitForTimeout(9000);
      if (k === "drag") {
        // 성북구로 들어가 실제 지도·태그가 뜬 뒤, 끌기 5번(각 120px) — 손을 뗀 뒤 2초 안 layout 시간(window.__mxLayT)과 긴 작업
        await pg.evaluate(() => { const b = [...document.querySelectorAll(".zgu")].find((x) => x.dataset.gu === "성북구" && x.offsetWidth); if (b) b.click(); });
        await pg.waitForFunction(() => { try { const m = ZP_lmx.map(); return m && m.loaded() && ZP_lmx.gu() === "성북구" && !document.querySelector(".zp-ph") && document.querySelectorAll("#lmap .zpill").length > 0; } catch (e) { return false; } }, null, { timeout: 60000 }).catch(() => {});
        await pg.waitForTimeout(3000);
        const D = [];
        for (let j = 0; j < 5; j++) {
          await pg.evaluate(() => { window.__mxLayT = []; window.__lt = []; });
          const x0 = 195 + (j % 2 ? 60 : -60), y0 = 470;
          await pg.mouse.move(x0, y0); await pg.mouse.down();
          for (let s = 1; s <= 6; s++) { await pg.mouse.move(x0 + (j % 2 ? -20 : 20) * s, y0 + (j % 3 - 1) * 8 * s); await pg.waitForTimeout(30); }
          const t0 = await pg.evaluate(() => performance.now());
          await pg.mouse.up(); await pg.waitForTimeout(2200);
          D.push(await pg.evaluate((t0) => ({ lay: (window.__mxLayT || []).slice(), long: window.__lt.filter((x) => x[0] >= t0 - 5).map((x) => x[1]) }), t0));
        }
        const lay = D.map((d) => (d.lay.length ? Math.max(...d.lay) : 0)), lg = D.map((d) => (d.long.length ? Math.max(...d.long) : 0));
        const row = { layMs: median(lay), layMax: Math.max(...lay), longAfter: median(lg), longAfterMax: Math.max(...lg), raw: D };
        runs[k].push(row); console.log(`drag  #${i + 1} ${JSON.stringify({ lay, lg })}`); await ctx.close(); continue;
      }
      const r = await pg.evaluate(() => { const lt = window.__lt; return { lcp: window.__lcp, fcp: Math.round((performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime || 0), longMs: lt.reduce((m, x) => Math.max(m, x[1]), 0), tbt: lt.reduce((s, x) => s + Math.max(0, x[1] - 50), 0), nLong: lt.length }; }).catch(() => ({}));
      await Promise.all(pend);
      const row = { ...r, kb: Math.round(bytes / 1024), jsWireKb: Math.round(js / 1024), jsKb: Math.round(jsGz / 1024), reqs };
      runs[k].push(row);
      console.log(`${k.padEnd(5)} #${i + 1} ${JSON.stringify(row)}`);
      await ctx.close();
    }
  }
  await b.close();
  const pages = {};
  for (const [k, p] of PAGES) { const R = runs[k]; pages[k] = { path: p }; for (const f of (k === "drag" ? ["layMs", "layMax", "longAfter", "longAfterMax"] : ["lcp", "fcp", "tbt", "longMs", "nLong", "kb", "jsKb", "jsWireKb", "reqs"])) pages[k][f] = median(R.map((x) => x[f])); }
  let load = null; try { load = require("os").loadavg().map((x) => +x.toFixed(2)); } catch (e) {}
  return { base: BASE, at: new Date().toISOString(), runs: RUNS, cpu: CPU, viewport: "390x844@2", observeMs: 9000, loadavg: load, pages, raw: runs };
}

(async () => {
  if (!has("compare")) require("./qa_lock").relaunch(__filename);   // 재는 동안 다른 QA와 겹치지 않게(기계 전체 잠금)
  if (has("compare")) {
    const i = argv.indexOf("--compare"); const [a, b] = [argv[i + 1], argv[i + 2]];
    process.exit(compare(JSON.parse(fs.readFileSync(a, "utf8")), JSON.parse(fs.readFileSync(b, "utf8"))) ? 1 : 0);
  }
  const BASE = (argv.find((a, i) => !a.startsWith("--") && !(i && argv[i - 1].startsWith("--"))) || "http://localhost:8765").replace(/\/+$/, "");
  const res = await measure(BASE, +opt("runs", 3), +opt("cpu", 4));
  console.log("\nmedian of " + res.runs + " · load " + (res.loadavg || []).join(" "));
  for (const [k, v] of Object.entries(res.pages)) if (k === "drag") console.log(`  drag  끌기 뒤 라벨 다시 배치 가운데 ${v.layMs}ms(최대 ${v.layMax}) · 그 뒤 긴 작업 가운데 ${v.longAfter}ms(최대 ${v.longAfterMax})`); else console.log(`  ${k.padEnd(5)} ${v.path.padEnd(10)} LCP ${v.lcp}ms · TBT ${v.tbt}ms · 가장 긴 작업 ${v.longMs}ms · JS ${v.jsKb}KB(gzip) / 받은 ${v.jsWireKb}KB · 전체 ${v.kb}KB`);
  const out = opt("out", "/tmp/claude-0/-home-claude/887bff60-b663-5701-90e9-e402cebc9114/scratchpad/perf_last.json");
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log("JSON " + out);
  const ag = opt("against", null);
  if (ag) process.exit(compare(JSON.parse(fs.readFileSync(ag, "utf8")), res) ? 1 : 0);
})().catch((e) => { console.error("perf_baseline crashed:", e); process.exit(2); });
