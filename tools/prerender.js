#!/usr/bin/env node
/* 빌드 보조(tools/build.py가 부름): 첫 화면을 미리 그려 두기 위한 두 단계.
   state <html> <out.json>  : 완성된 앱(전체 데이터)을 헤드리스 크롬에서 기본 가정으로 열고,
                              게이지 단계(현금) × 사는 방식(전세 끼고·대출 끼고)마다 첫 화면 숫자·목록·'이 돈이면'을 그대로 떠 온다.
                              → 섬(island) 코드가 전체 앱 없이도 같은 숫자·같은 마크업을 바로 보여 준다(숫자는 앱 계산 그대로).
   css <html> <c.css> <out.css> : 섬 모드 첫 화면(앱 실행 전)에 실제로 그려지는 요소에 맞는 규칙만 골라 '첫 페인트용 CSS'를 만든다.
   <html>은 public/에 아직 쓰지 않은 후보 index.html(다른 빌드와 겹쳐도 안전하게). 나머지 파일은 public/에서 읽는다.
   실패하면 exit 1 → build.py가 섬 없이(예전처럼 전체 앱을 바로) 내보낸다. */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), PUB = path.join(ROOT, "public");
const [mode, HTML, ...rest] = process.argv.slice(2);
const EXE = process.env.QA_CHROME || process.env.CHROME || ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

function serve() {
  return new Promise((ok) => {
    const srv = http.createServer((q, s) => {
      let p = decodeURIComponent(q.url.split("?")[0]);
      let f = p === "/" || p === "/index.html" ? HTML : path.join(PUB, p);
      if (f !== HTML && (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory())) { s.writeHead(404); return s.end(); }
      s.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(f).pipe(s);
    }).listen(0, "127.0.0.1", () => ok(srv));
  });
}
async function launch() {
  return chromium.launch(EXE ? { executablePath: EXE, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- 1) 상태 떠 오기
async function state(out) {
  const src = fs.readFileSync(path.join(ROOT, "src/ext/60_simple.js"), "utf8");
  const m = /const KN = (\[\[[^;]*?\]\]);/.exec(src);
  if (!m) throw new Error("KN not found in 60_simple.js");
  const KN = JSON.parse(m[1]);
  const toCash = (p) => { for (let i = 1; i < KN.length; i++) if (p <= KN[i][0]) { const [a, x] = KN[i - 1], [b, y] = KN[i]; const v = x + ((p - a) / (b - a)) * (y - x); return v < 2 ? Math.round(v * 10) / 10 : v < 10 ? Math.round(v * 2) / 2 : Math.round(v); } return KN[KN.length - 1][1]; };
  const toPos = (c) => { c = Math.min(KN[KN.length - 1][1], Math.max(KN[0][1], c)); for (let i = 1; i < KN.length; i++) if (c <= KN[i][1]) { const [a, x] = KN[i - 1], [b, y] = KN[i]; return a + ((c - x) / (y - x)) * (b - a); } return 100; };
  const stops = [];
  for (let i = 0; i <= 1000; i++) { const c = toCash(i / 10); if (!stops.includes(c)) stops.push(c); }
  const srv = await serve(), port = srv.address().port;
  const br = await launch();
  try {
    // 1100px: 넓은 화면 목록 배치(목록 10줄까지) · '이 돈이면' 추가 힌트(1180px 이상에서만)는 끼지 않게
    const ctx = await br.newContext({ viewport: { width: 1100, height: 1000 }, serviceWorkers: "block" });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("zp_full", "1"); localStorage.setItem("emr.coach1", "1"); localStorage.setItem("emr.map", "svg"); } catch (e) {} });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load", timeout: 60000 });
    await page.waitForFunction(() => typeof window.ZP_count === "function" && document.documentElement.classList.contains("s-built") && document.querySelector("#sList a[data-id]"), null, { timeout: 60000 });
    // 목록 흐름선(txs.json)이 들어올 때까지
    await page.waitForFunction(() => document.querySelector("#sList .s-sp") || performance.now() > 15000, null, { timeout: 20000 }).catch(() => {});
    await wait(400);
    const htmlCls = await page.evaluate(() => document.documentElement.className);
    const res = await page.evaluate(async ({ stops, pos }) => {
      const toPos = (c) => pos[stops.indexOf(c)];
      const $ = (id) => document.getElementById(id);
      const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const rows = [], rowIx = new Map(), strs = [], strIx = new Map();
      const S = (s) => { s = s == null ? null : String(s); if (s == null) return -1; if (!strIx.has(s)) { strIx.set(s, strs.length); strs.push(s); } return strIx.get(s); };
      const recs = (window.__ZPD && window.__ZPD.recs) || [];
      const okF = typeof window.ZP_ok === "function" ? window.ZP_ok : null;
      const zIx = new Map(), zones = [];
      const snap = () => {
        const li = [...$("sList").children].map((el) => {
          const c = el.cloneNode(true); c.classList.remove("s-nosp"); if (!c.className) c.removeAttribute("class");
          const h = c.outerHTML; if (!rowIx.has(h)) { rowIx.set(h, rows.length); rows.push(h); } return rowIx.get(h);
        });
        const ok = [];
        let nOk = 0;
        if (okF) recs.forEach((r) => { let y = false; try { y = !!okF(r); } catch (e) {} if (y) nOk++; if (y && r.xy) { if (!zIx.has(r.id)) { zIx.set(r.id, zones.length); zones.push([r.id, Math.round(r.xy[0]), Math.round(r.xy[1])]); } ok.push(zIx.get(r.id)); } });
        const sl = $("sCash"), mo = $("sMore"), as = $("sAsm");
        return {
          t: [S($("sN").textContent), S($("sNL").textContent), S($("sLT").textContent), S($("sLS").textContent), S($("sCashV").innerHTML), S($("sSum").innerHTML), S(mo.hidden ? null : mo.textContent), S(as.hidden ? null : as.innerHTML), S(as.getAttribute("aria-label")), S(sl.style.getPropertyValue("--p")), S(sl.getAttribute("aria-valuetext"))],
          l: li, ok, nOk,
        };
      };
      const out = {}, conds = {};
      const go = async (c, full) => {
        const sl = $("sCash"); sl.value = String(toPos(c));
        sl.dispatchEvent(new Event("input", { bubbles: true })); if (full) sl.dispatchEvent(new Event("change", { bubbles: true }));
        let prev = "", same = 0;
        for (let i = 0; i < 60 && same < 2; i++) { await raf(); const v = $("sN").textContent + "|" + $("sLT").textContent + "|" + $("sList").innerHTML + "|" + $("sSum").innerHTML + "|" + $("pCash").value; if (v === prev) same++; else { same = 0; prev = v; } }
        if (Math.abs(+$("pCash").value - c) > 1e-9) throw new Error(`pCash ${$("pCash").value} != ${c}`);
        const s = snap(); s.c = c; s.pressed = [...document.querySelectorAll(".s-mode button")].map((x) => x.getAttribute("aria-pressed")); s.gapm = document.documentElement.classList.contains("gapm");
        return s;
      };
      for (const f of ["gap", "cash"]) {
        const b = document.querySelector(`.s-mode button[data-f="${f}"]`);
        if (b.getAttribute("aria-pressed") !== "true") b.click();
        await raf(); await new Promise((r) => setTimeout(r, 120));
        out[f] = [];
        $("sCash").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        const T0 = performance.now();
        for (const c of stops) out[f].push(await go(c, false));
        window.__tm = (window.__tm || []).concat(Math.round(performance.now() - T0));
        window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
        // 빠른 길(input만)로 뜬 값이 실제 확정 경로(change → setCash)와 같은지 몇 단계 대조
        for (const c of [1, 5, 15, stops[0]]) {
          const a = out[f][stops.indexOf(c)], b = await go(c, true);
          if (JSON.stringify([a.t, a.l, a.nOk]) !== JSON.stringify([b.t, b.l, b.nOk])) throw new Error(`fast/slow mismatch ${f} ${c}`);
        }
        await go(15, true);
        await new Promise((r) => setTimeout(r, 450));
        conds[f] = localStorage.getItem("jg-cond") || "";
      }
      const D = window.__ZPD || {};
      const gu = (D.map && D.map.gu || []).map((g) => [g[0], String(g[1]).replace(/(\d+)\.\d+/g, "$1")]);
      return { tm: window.__tm, out, conds, rows, strs, zones, okF: !!okF, map: D.map ? { w: D.map.w, h: D.map.h, gu } : null };
    }, { stops, pos: stops.map(toPos) });
    if (errs.length) throw new Error("page errors: " + errs.slice(0, 3).join(" | "));
    // 검사: 큰 숫자 = 지도 점 수(같은 판정) · 기본 상태(1억·전세 끼고)가 들어 있나
    const num = (i) => +String(res.strs[i]).replace(/\D/g, "");
    for (const f of ["gap", "cash"]) for (const s of res.out[f]) if (res.okF && s.nOk !== num(s.t[0])) { res.okF = false; }
    if (!res.okF) { res.zones = []; for (const f of ["gap", "cash"]) for (const s of res.out[f]) s.ok = []; }
    // 점: 단계별 목록 대신 '처음 되는 단계'(단조라면)
    const thr = {};
    let mono = res.okF;
    for (const f of ["gap", "cash"]) {
      const t = new Array(res.zones.length).fill(-1);
      res.out[f].forEach((s, i) => s.ok.forEach((z) => { if (t[z] < 0) t[z] = i; }));
      res.out[f].forEach((s, i) => { const set = new Set(s.ok); t.forEach((v, z) => { if ((v >= 0 && v <= i) !== set.has(z)) mono = false; }); });
      thr[f] = t;
    }
    const cls = htmlCls.split(/\s+/).filter((c) => ["free", "is-member", "s-built"].includes(c));
    const conds = res.conds; console.log('loop ms', res.tm);
    const pack = {
      v: 1, stops, KN, pos: stops.map((c) => +toPos(c).toFixed(4)), def: { f: "gap", c: 1 }, cls, conds,
      strs: res.strs, rows: res.rows,
      st: { gap: res.out.gap.map((s) => [s.t, s.l, s.pressed, s.gapm]), cash: res.out.cash.map((s) => [s.t, s.l, s.pressed, s.gapm]) },
      zones: mono ? res.zones.map((z) => [z[1], z[2]]) : [], thr: mono ? thr : null, map: res.map,
    };
    fs.writeFileSync(out, JSON.stringify(pack));
    console.log(`prerender state: ${stops.length} stops × 2 · rows ${res.rows.length} · strs ${res.strs.length} · zones ${pack.zones.length}${mono ? "" : " (no dots)"} · ${(JSON.stringify(pack).length / 1024).toFixed(0)}KB`);
  } finally { await br.close(); srv.close(); }
}

// ---------------------------------------------------------------- 2) 첫 페인트 CSS
// 섬 모드 첫 화면(앱 실행 전)에 그려지는 요소(display:none 아래 제외)에 맞는 규칙만. 화면 폭 여러 개 · 사는 방식 둘 · 게이지 끝값까지 합집합.
// :hover 같은 상태 가상 클래스와 ::before 같은 가상 요소는 떼고 맞춰 본다(상태가 바뀌어도 같은 모양). @media·@supports 안은 조건을 그대로 둔 채 같은 방법으로.
async function css(cssFile, out) {
  const srv = await serve(), port = srv.address().port;
  const br = await launch();
  const keep = new Set();
  let ruleTexts = null;
  try {
    for (const [w, h, mob] of [[412, 823, true], [1280, 900, false]]) {
      const ctx = await br.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, serviceWorkers: "block" });
      await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
      await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("zp_nohyd", "1"); } catch (e) {} });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load", timeout: 60000 });
      await page.waitForFunction(() => window.ZP_island && window.ZP_island.ready, null, { timeout: 20000 });
      await page.addStyleTag({ url: "/b/" + path.basename(cssFile) });
      await wait(150);
      const widths = mob ? [320, 360, 412, 600, 800, 980] : [981, 1100, 1180, 1280, 1440, 1920];
      for (const vw of widths) {
        await page.setViewportSize({ width: vw, height: h });
        for (const st of [["gap", 1], ["cash", 1], ["gap", 0.5], ["cash", 15], ["gap", 15], ["gap", 1]]) {
          const r = await page.evaluate(({ st, base }) => {
            window.ZP_island.set(st[0], st[1]);
            const sheet = [...document.styleSheets].find((s) => s.href && s.href.includes(base));
            if (!sheet) return null;
            const vis = (el) => el === document.documentElement || el === document.body || el === document.head || el.getClientRects().length > 0 || (el.namespaceURI === "http://www.w3.org/2000/svg" && el.closest("svg") && el.closest("svg").getClientRects().length > 0);
            const live = [...document.querySelectorAll("*")].filter((el) => !el.closest("head,script,style,template,noscript") && vis(el));
            const strip = (sel) => sel.replace(/::?(before|after|placeholder|marker|selection|first-letter|first-line|backdrop|-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?/gi, "").replace(/:(hover|focus|focus-visible|focus-within|active|visited|link|any-link|target|checked|indeterminate|disabled|enabled|placeholder-shown|invalid|valid|user-invalid|autofill)(?![\w-])/gi, "");
            const splitSel = (s) => { const o = []; let d = 0, cur = ""; for (const ch of s) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && !d) { o.push(cur); cur = ""; } else cur += ch; } o.push(cur); return o.map((x) => x.trim()).filter(Boolean); };
            const used = [];
            const walk = (list, pfx) => { [...list].forEach((r, i) => {
              const k = pfx + i;
              if (r.type === 1) {
                let hit = false;
                for (const s of splitSel(r.selectorText)) {
                  let q = strip(s).trim(); if (!q || /^[>+~]/.test(q)) q = "*";
                  q = q.replace(/([>+~\s])\s*$/, "$1*");
                  try { if (live.some((el) => el.matches(q))) { hit = true; break; } } catch (e) { hit = true; break; }
                }
                if (hit) used.push(k);
              } else if (r.cssRules) walk(r.cssRules, k + ".");
              else used.push(k);   // @font-face · @keyframes · @property 등은 그대로
            }); };
            walk(sheet.cssRules, "");
            return used;
          }, { st, base: path.basename(cssFile) });
          if (!r) throw new Error("full css sheet not found");
          r.forEach((k) => keep.add(k));
        }
      }
      if (!ruleTexts) {
        ruleTexts = await page.evaluate((base) => {
          const sheet = [...document.styleSheets].find((s) => s.href && s.href.includes(base));
          const tree = (list) => [...list].map((r) => (r.type === 1 || !r.cssRules ? { t: r.cssText } : { p: r.cssText.slice(0, r.cssText.indexOf("{")).trim(), c: tree(r.cssRules), kf: r.type === 7 }));
          return tree(sheet.cssRules);
        }, path.basename(cssFile));
      }
      await ctx.close();
    }
  } finally { await br.close(); srv.close(); }
  const emit = (list, pfx) => list.map((r, i) => {
    const k = pfx + i;
    if (r.t != null) return keep.has(k) ? r.t : "";
    if (r.kf) return keep.has(k) || list ? "" : "";
    const inner = emit(r.c, k + ".");
    return inner ? `${r.p}{${inner}}` : "";
  }).join("");
  // @keyframes는 이름이 쓰인 것만
  let txt = emit(ruleTexts, "");
  const kfs = [];
  const findKf = (list) => list.forEach((r) => { if (r.kf) kfs.push(r); else if (r.c) findKf(r.c); });
  findKf(ruleTexts);
  for (const k of kfs) { const nm = (/@(?:-webkit-)?keyframes\s+([\w-]+)/.exec(k.p) || [])[1]; if (nm && new RegExp(`animation[^;}]*\\b${nm}\\b`).test(txt)) txt += `${k.p}{${k.c.map((x) => x.t).join("")}}`; }
  fs.writeFileSync(out, txt);
  console.log(`prerender css: ${(txt.length / 1024).toFixed(1)}KB critical of ${(fs.statSync(cssFile).size / 1024).toFixed(0)}KB`);
}

(async () => {
  try {
    if (mode === "state") await state(rest[0]);
    else if (mode === "css") await css(rest[0], rest[1]);
    else throw new Error("usage: prerender.js state|css <html> ...");
  } catch (e) { console.error("prerender failed:", e && e.message || e); process.exit(1); }
})();
