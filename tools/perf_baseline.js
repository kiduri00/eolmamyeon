#!/usr/bin/env node
/* 성능 기준선(390px 폰 · 4×CPU): 홈 · /#map · /z 한 쪽의 LCP · TBT · 가장 긴 작업 · JS KB — 각 3번, 가운데 값.
   renew/audit/perf_live.js를 다시 쓸 수 있게 고친 것(같은 잣대: 9초 관찰 · 광고·분석 요청 막음 · 캐시 없는 새 문맥).

   재기:   NODE_PATH=$(npm root -g) node tools/perf_baseline.js [baseUrl] [--runs 3] [--cpu 4] [--out file.json]
           baseUrl 기본 http://localhost:8765 (python3 -m http.server 8765 -d public) · 라이브는 https://jaegaebal.alwaysquestions.kr
   견주기: node tools/perf_baseline.js --compare tools/fixtures/perf_main.json new.json
           또는 재면서 바로:  node tools/perf_baseline.js http://localhost:8790 --against tools/fixtures/perf_main.json
           회귀 한도(스펙): JS KB +10% · 가장 긴 작업 +100ms → 넘으면 exit 1. LCP·TBT는 참고(+20%·+300ms 넘으면 경고만).
   TBT = 관찰 9초 안 긴 작업(50ms 넘는 부분) 합 — 바쁜 공용 기계에서는 출렁이므로 판정에 쓰지 않는다. */
"use strict";
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes("--" + k);
const EXE = process.env.QA_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PAGES = [["home", "/"], ["map", "/#map"], ["z", opt("z", "/z/o1176")]];
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
      let bytes = 0, js = 0, reqs = 0; const types = {};
      cdp.on("Network.responseReceived", (e) => { types[e.requestId] = e.type; });
      cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; reqs++; if (types[e.requestId] === "Script") js += e.encodedDataLength; });
      await pg.addInitScript(() => {
        window.__lt = []; window.__lcp = 0;
        new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: "longtask", buffered: true });
        new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = Math.round(e.startTime)))).observe({ type: "largest-contentful-paint", buffered: true });
      });
      const u = BASE + (p.includes("#") ? p.replace("#", "?pb=" + Date.now() + "#") : p + "?pb=" + Date.now());
      await pg.goto(u, { waitUntil: "load", timeout: 60000 }).catch(() => {});
      await pg.waitForTimeout(9000);
      const r = await pg.evaluate(() => { const lt = window.__lt; return { lcp: window.__lcp, fcp: Math.round((performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime || 0), longMs: lt.reduce((m, x) => Math.max(m, x[1]), 0), tbt: lt.reduce((s, x) => s + Math.max(0, x[1] - 50), 0), nLong: lt.length }; }).catch(() => ({}));
      const row = { ...r, kb: Math.round(bytes / 1024), jsKb: Math.round(js / 1024), reqs };
      runs[k].push(row);
      console.log(`${k.padEnd(5)} #${i + 1} ${JSON.stringify(row)}`);
      await ctx.close();
    }
  }
  await b.close();
  const pages = {};
  for (const [k, p] of PAGES) { const R = runs[k]; pages[k] = { path: p }; for (const f of ["lcp", "fcp", "tbt", "longMs", "nLong", "kb", "jsKb", "reqs"]) pages[k][f] = median(R.map((x) => x[f])); }
  let load = null; try { load = require("os").loadavg().map((x) => +x.toFixed(2)); } catch (e) {}
  return { base: BASE, at: new Date().toISOString(), runs: RUNS, cpu: CPU, viewport: "390x844@2", observeMs: 9000, loadavg: load, pages, raw: runs };
}

(async () => {
  if (has("compare")) {
    const i = argv.indexOf("--compare"); const [a, b] = [argv[i + 1], argv[i + 2]];
    process.exit(compare(JSON.parse(fs.readFileSync(a, "utf8")), JSON.parse(fs.readFileSync(b, "utf8"))) ? 1 : 0);
  }
  const BASE = (argv.find((a, i) => !a.startsWith("--") && !(i && argv[i - 1].startsWith("--"))) || "http://localhost:8765").replace(/\/+$/, "");
  const res = await measure(BASE, +opt("runs", 3), +opt("cpu", 4));
  console.log("\nmedian of " + res.runs + " · load " + (res.loadavg || []).join(" "));
  for (const [k, v] of Object.entries(res.pages)) console.log(`  ${k.padEnd(5)} ${v.path.padEnd(10)} LCP ${v.lcp}ms · TBT ${v.tbt}ms · 가장 긴 작업 ${v.longMs}ms · JS ${v.jsKb}KB · 전체 ${v.kb}KB`);
  const out = opt("out", "/tmp/claude-0/-home-claude/887bff60-b663-5701-90e9-e402cebc9114/scratchpad/perf_last.json");
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log("JSON " + out);
  const ag = opt("against", null);
  if (ag) process.exit(compare(JSON.parse(fs.readFileSync(ag, "utf8")), res) ? 1 : 0);
})().catch((e) => { console.error("perf_baseline crashed:", e); process.exit(2); });
