#!/usr/bin/env node
/* 사이클 5(M): 서비스 워커 — 설치 앱 첫 화면(/?src=app) 느린 망 시간 제한(3.5초) · 오프라인 · 웹(/)은 망 우선 그대로.
   자체 서버(public/을 내고 첫 화면 응답만 늦추거나 끊음)로 잰다 — 결과 줄은 'PASS|FAIL sw.appNav — …'(qa_consistency 단위 swapp).
   node tools/qa_swapp.js   (QA 잠금은 qa_consistency가 쥠 · 따로 돌리면 tools/qa_lock.sh node tools/qa_swapp.js) */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "public");
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
let slow = 0, down = 0;
const srv = http.createServer((q, s) => {
  const u = new URL(q.url, "http://x");
  let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
  let f = path.join(ROOT, p); if (!f.startsWith(ROOT)) { s.statusCode = 403; s.end(); return; }
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  const home = p === "/index.html";
  if (home && down) { q.socket.destroy(); return; }
  setTimeout(() => fs.readFile(f, (e, b) => { if (e) { s.statusCode = 404; s.end("nf"); return; } s.setHeader("content-type", T[path.extname(f)] || "application/octet-stream"); s.end(b); }), home ? slow : 0);
});
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const B = `http://localhost:${srv.address().port}`;
  const { chromium } = require("playwright");
  const b = await chromium.launch({ executablePath: process.env.QA_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const res = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route(/googlesyndication|googletagmanager|google-analytics|doubleclick|adservice|adtrafficquality|fundingchoices|pagead2|jsdelivr|openfreemap|unpkg/, (r) => r.abort());
    const p = await ctx.newPage();
    await p.goto(B + "/?src=app", { waitUntil: "load" });
    await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(() => {});
    await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500);
    const nav = async (u) => { const t = Date.now(); await p.goto(B + u, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null); const ms = Date.now() - t; const ok = await p.evaluate(() => !!document.querySelector("#sHero, h1")).catch(() => false); return { ms, ok }; };
    const chk = (c, m) => res.push([!!c, m]);
    slow = 0; let r = await nav("/?src=app"); chk(r.ok && r.ms < 3000, `빠른 망 앱 ${r.ms}ms`);
    slow = 8000; r = await nav("/?src=app"); chk(r.ok && r.ms >= 3000 && r.ms < 6000, `느린 망 8초 앱 ${r.ms}ms(저장본)`);
    r = await nav("/"); chk(r.ok && r.ms >= 7500, `느린 망 8초 웹 ${r.ms}ms(망 우선 그대로)`);
    slow = 2000; r = await nav("/?src=app"); chk(r.ok && r.ms >= 1800 && r.ms < 3400, `느린 망 2초 앱 ${r.ms}ms(망 응답)`);
    slow = 0; await ctx.setOffline(true);
    r = await nav("/?src=app"); chk(r.ok, `오프라인 앱 ${r.ms}ms`); r = await nav("/"); chk(r.ok, `오프라인 웹 ${r.ms}ms`);
    await ctx.setOffline(false);
    down = 1; r = await nav("/?src=app"); chk(r.ok && r.ms < 3000, `첫 화면 연결 끊김 앱 ${r.ms}ms`); down = 0;
  } catch (e) { res.push([false, "실행 오류 " + String(e.message || e).split("\n")[0]]); }
  await b.close(); srv.close();
  const bad = res.filter((x) => !x[0]);
  console.log(`${bad.length ? "FAIL" : "PASS"} sw.appNav — 설치 앱 첫 화면 3.5초 제한·오프라인·웹 망 우선: ${res.map((x) => (x[0] ? "" : "✗") + x[1]).join(" · ")}`);
  process.exit(bad.length ? 1 : 0);
})();
