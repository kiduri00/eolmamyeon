#!/usr/bin/env node
/* 배포 전 자동 QA 게이트 (집핀)
   실행:  NODE_PATH=$(npm root -g) node tools/qa.js [baseUrl] [--update-baseline]
   기본 baseUrl = http://localhost:8765 (python3 -m http.server 8765 -d public)
   실패가 하나라도 있으면 exit 1. 요약은 stdout, 전체 결과는 JSON(QA_OUT 또는 아래 기본 경로).
   터치 타깃 개수는 tools/qa_baseline.json 의 값보다 늘었을 때만 실패(--update-baseline 로 갱신). */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
const BASE = (argv.find((a) => !a.startsWith("--")) || "http://localhost:8765").replace(/\/+$/, "");
const UPDATE_BASELINE = argv.includes("--update-baseline");
const OUT = process.env.QA_OUT || "/tmp/claude-0/-home-claude/887bff60-b663-5701-90e9-e402cebc9114/scratchpad/qa_last.json";
const BASELINE_FILE = path.join(__dirname, "qa_baseline.json");
const EXE = process.env.QA_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const HARD_LIMIT_MS = 225000;            // 4분 안에 끝나도록 스스로 멈춤
const T_START = Date.now();
const elapsed = () => Date.now() - T_START;

// 도구 6개(ZP_TOOLS) + 예전 주소(ZP_ALIAS: 합친 화면의 탭으로 열림) 몇 개
const TOOLS = ["rankHub", "txrTop", "rankTop", "news", "supplyTop", "diagTop", "favTop", "commuteTop", "planner", "saveTop"];
const GAUGE = [0, 30, 58, 88, 100];
const TOUCH_MIN = 40;
const LONGTASK_WARN = 800;
const SN_LIMIT_MS = 6000;
const BLOCK = /googlesyndication|googletagmanager|google-analytics|doubleclick|adservice|adtrafficquality|fundingchoices|pagead2/i;
const IGNORE_MSG = /GL Driver|WebGL|GPU stall|swiftshader|adsbygoogle|googlesyndication|pagead|\[Report Only\]|report-only|Content-Security-Policy-Report-Only/i;
const BAD_TEXT = [/\bNaN\b/, /\bundefined\b/, /\bnull\b/, /\bInfinity\b/, /\[object/, /0\.0억\s*모자라요/];

const failures = [];
const warnings = [];
const info = {};
const fail = (check, where, msg) => failures.push({ check, where, msg });
const warn = (check, where, msg) => warnings.push({ check, where, msg });

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const toCash = (p) => { const KN = [[0, 0.5], [28, 2], [58, 5], [88, 10], [100, 15]]; for (let i = 1; i < KN.length; i++) if (p <= KN[i][0]) { const [a, x] = KN[i - 1], [b, y] = KN[i]; const v = x + ((p - a) / (b - a)) * (y - x); return v < 2 ? Math.round(v * 10) / 10 : v < 10 ? Math.round(v * 2) / 2 : Math.round(v); } return 15; };
const num = (s) => { const m = String(s || "").replace(/,/g, "").match(/(\d+)\s*곳?\s*$/) || String(s || "").replace(/,/g, "").match(/(\d+)/); return m ? +m[1] : NaN; };

function proxyOpt() {
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0)/.test(BASE)) return undefined;
  const p = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY;
  if (!p) return undefined;
  try { const u = new URL(p); return { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username) || undefined, password: decodeURIComponent(u.password) || undefined }; } catch (e) { return { server: p }; }
}

// ---------------- 페이지 안에서 돌리는 검사 함수 ----------------
const IN_PAGE = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0) return false; return !el.closest("[hidden],[aria-hidden=true] [hidden]"); };
  const sel = (el) => { const p = []; let e = el; for (let i = 0; e && e.nodeType === 1 && i < 4; i++, e = e.parentElement) { let s = e.tagName.toLowerCase(); if (e.id) { p.unshift(s + "#" + e.id); break; } const c = [...e.classList].slice(0, 2).join("."); if (c) s += "." + c; p.unshift(s); } return p.join(">"); };
  const inScroller = (el, stop) => { for (let a = el.parentElement; a && a !== stop && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
  window.__qa = {
    overflow() { const se = document.scrollingElement; return { sw: se.scrollWidth, iw: innerWidth }; },
    innerOverflow(s) { const el = document.querySelector(s); if (!el || !vis(el)) return null; const cs = getComputedStyle(el); return { sw: el.scrollWidth, cw: el.clientWidth, ox: cs.overflowX }; },
    wideEls() { const iw = innerWidth; return [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > iw + 1 && vis(e) && !inScroller(e) && getComputedStyle(e).position !== "fixed"; }).slice(0, 4).map((e) => sel(e) + " right=" + Math.round(e.getBoundingClientRect().right)); },
    clipping(rootSel) {
      const out = [];
      for (const root of document.querySelectorAll(rootSel)) {
        if (!vis(root)) continue;
        for (const el of root.querySelectorAll("*")) {
          if (/^(INPUT|SELECT|TEXTAREA|SVG|CANVAS|IMG|svg|path|g|text)$/.test(el.tagName) || el instanceof SVGElement) continue;
          if (el.clientWidth <= 2) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "inline" || cs.display === "contents" || cs.display === "none") continue;
          const ox = cs.overflowX; if (ox === "auto" || ox === "scroll") continue;
          if (el.scrollWidth <= el.clientWidth + 1) continue;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own && ox === "visible") continue;          // 자식이 넘치면 자식이 보고됨
          if (!vis(el) || inScroller(el, root.parentElement)) continue;
          if (cs.clip !== "auto" || /inset\(50%|rect\(0/.test(cs.clipPath + cs.clip)) continue;  // sr-only
          const t = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
          if (!t) continue;
          out.push({ sel: sel(el), text: t.slice(0, 50), sw: el.scrollWidth, cw: el.clientWidth, ox, ellipsis: cs.textOverflow === "ellipsis" });
        }
      }
      return out;
    },
    touch(rootSel, excludeSel) {
      const out = [];
      for (const root of document.querySelectorAll(rootSel)) for (const el of root.querySelectorAll("button, a[href], [role=button], [role=tab]")) {
        if (excludeSel && el.closest(excludeSel)) continue;
        if (!vis(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "inline" && el.tagName === "A") { const p = el.parentElement; if (p && [...p.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue; }  // 문장 속 링크(WCAG 예외)
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 40) out.push({ sel: sel(el), text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) });
      }
      const seen = new Set(); return out.filter((o) => { const k = o.sel + o.text + o.w + o.h; if (seen.has(k)) return false; seen.add(k); return true; });
    },
    text(s) { const el = document.querySelector(s); return el ? el.innerText : ""; },
  };
};

async function setup(browser, name, opts) {
  const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: !!proxyOpt(), serviceWorkers: "block" });
  await ctx.route(BLOCK, (r) => r.abort());
  await ctx.addInitScript(() => {
    try { localStorage.setItem("zp.onb", "1"); } catch (e) {}   // 첫 실행 질문은 qa_consistency ui.onboard에서
    window.__lt = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([e.startTime, e.duration]))).observe({ type: "longtask", buffered: true }); } catch (e) {}
  });
  await ctx.addInitScript(IN_PAGE);
  const page = await ctx.newPage();
  page.__errs = [];
  page.on("pageerror", (e) => page.__errs.push("pageerror: " + (e.message || String(e)).split("\n")[0].slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text(), u = (m.location() && m.location().url) || "";
    if (IGNORE_MSG.test(t) || BLOCK.test(u) || BLOCK.test(t)) return; if (/nope-qa-/.test(u)) return; if (/^https?:\/\/(localhost|127\.)/.test(BASE) && /\/api\/push\//.test(u)) return;   // 정적 서버엔 Worker(/api/push/*)가 없다(배포본은 Worker가 답함 · qa_consistency와 같은 예외) if (/CORS/.test(t) && /about:blank/.test(t + u)) return;
    page.__errs.push("console.error: " + t.slice(0, 200) + (u ? " @" + u.replace(BASE, "").slice(0, 60) : ""));
  });
  return { ctx, page, name };
}
function flushErrors(page, where) {
  const e = [...new Set(page.__errs)]; page.__errs.length = 0;
  e.forEach((m) => fail("1.errors", where, m));
}

async function loadHome(page, hash = "") {
  const t0 = Date.now();
  if (hash) await page.goto("about:blank");   // 해시만 다르면 같은 문서로 남으므로 진짜 새로 불러오기
  await page.goto(BASE + "/" + hash, { waitUntil: "domcontentloaded", timeout: 30000 });
  let tSN = null;
  try {
    await page.waitForFunction(() => { const e = document.getElementById("sN"); return e && +e.textContent.replace(/\D/g, "") > 0; }, null, { timeout: 15000, polling: 50 });
    tSN = Date.now() - t0;
  } catch (e) { tSN = null; }
  try { await page.waitForLoadState("load", { timeout: 15000 }); } catch (e) {}
  return tSN;
}
async function settle(page, ms = 500) {
  await page.waitForTimeout(ms);
  let prev = null;
  for (let i = 0; i < 12; i++) { const v = await page.evaluate(() => (document.getElementById("sN") || {}).textContent + "|" + (document.getElementById("sLT") || {}).textContent); if (v === prev) return v; prev = v; await page.waitForTimeout(120); }
  return prev;
}
async function checkOverflow(page, where) {
  const o = await page.evaluate(() => __qa.overflow());
  if (o.sw > o.iw + 1) { const w = await page.evaluate(() => __qa.wideEls()); fail("3.overflow", where, `scrollWidth ${o.sw} > innerWidth ${o.iw}` + (w.length ? " · " + w.join(", ") : "")); }
  return o;
}
async function checkClip(page, where, rootSel) {
  const c = await page.evaluate((s) => __qa.clipping(s), rootSel);
  c.filter((x) => !x.ellipsis).slice(0, 6).forEach((x) => fail("4.clip", where, `${x.sel} "${x.text}" (${x.sw}>${x.cw}, overflow:${x.ox})`));
  const el = c.filter((x) => x.ellipsis); if (el.length) warn("4.clip", where, `${el.length} ellipsis-truncated: ` + el.slice(0, 3).map((x) => `${x.sel} "${x.text}"`).join("; "));
  return c;
}
function checkText(txt, where) {
  for (const re of BAD_TEXT) { const m = txt.match(new RegExp(".{0,25}" + re.source + ".{0,25}")); if (m) fail("6.content", where, `bad token ${re.source}: "${m[0].replace(/\s+/g, " ").trim()}"`); }
  const lines = txt.split("\n").map((s) => s.trim()).filter(Boolean);
  for (let i = 1; i < lines.length; i++) if (lines[i] === lines[i - 1] && lines[i].length >= 6) { fail("6.content", where, `duplicated adjacent line: "${lines[i].slice(0, 60)}"`); break; }
}
async function longTasks(page, where, since) {
  const lt = await page.evaluate((s) => window.__lt.filter(([t, d]) => t > s && d > 800).map(([t, d]) => Math.round(d)), since);
  if (lt.length) warn("8.longtask", where, `long task(s) > ${LONGTASK_WARN}ms after idle: ${lt.join(", ")}ms`);
}

async function gaugeCheck(page, where, api) {
  const rows = [];
  for (const p of GAUGE) {
    await page.evaluate((v) => { const s = document.getElementById("sCash"); s.value = String(v); s.dispatchEvent(new Event("input", { bubbles: true })); s.dispatchEvent(new Event("change", { bubbles: true })); }, p);
    await settle(page, 650);
    const r = await page.evaluate(() => ({ sN: document.getElementById("sN").textContent, sLT: document.getElementById("sLT").textContent, mode: ((document.querySelector('.s-mode button[aria-pressed="true"]') || {}).dataset || {}).f === "cash" ? (document.querySelector("#pBasis [aria-pressed=true]") || {}).dataset?.v === "total" ? "입주" : "대출" : "전세", cashV: document.getElementById("sCashV").textContent, pCash: (document.getElementById("pCash") || {}).value }));
    const hero = num(r.sN), list = num(r.sLT);
    const row = { pos: p, cash: toCash(p), hero, list, mode: r.mode, label: r.cashV };
    if (hero !== list) fail("2.count", where, `gauge ${p} (${r.cashV}): hero #sN=${hero} ≠ list #sLT=${list} ("${r.sLT}")`);
    if (api && api.steps) {
      const key = /전세/.test(r.mode) ? "gapNow" : /입주/.test(r.mode) ? "cashTotal" : "cashNow";
      const st = api.steps.find((s) => Math.abs(s.cash - row.cash) < 1e-6);
      if (st && st[key] != null) { row.api = st[key]; row.apiKey = key; if (st[key] !== hero) warn("2.api", where, `gauge ${p} (${row.cash}억, ${key}): page ${hero} vs /api/v1/cash.json ${st[key]} (diff ${hero - st[key]})`); }
    }
    rows.push(row);
  }
  return rows;
}

async function openZone(page, id) {
  await page.evaluate(() => { const t = document.getElementById("repTitle"); if (t) t.__qaOld = 1; });
  await page.evaluate((i) => { location.hash = "#" + i; }, id);
  try {
    await page.waitForFunction(() => { const t = document.getElementById("repTitle"); return t && !t.__qaOld && t.textContent.trim(); }, null, { timeout: 6000, polling: 60 });
  } catch (e) { return false; }
  await page.waitForTimeout(450);  // 시트 열림 애니메이션
  return true;
}
async function zoneChecks(page, scen, id, opts) {
  const where = `${scen}/zone ${id}`;
  const ok = await openZone(page, id);
  if (!ok) { fail("7.zone", where, "zone report did not render (#repTitle missing)"); return null; }
  const mobile = opts.mobile;
  if (mobile) { const s = await page.evaluate(() => document.getElementById("report").classList.contains("sheet")); if (!s) fail("7.zone", where, "mobile: #report did not become .sheet"); }
  await checkOverflow(page, where);
  const io = await page.evaluate(() => __qa.innerOverflow("#report"));
  if (io && io.sw > io.cw + 1 && io.ox !== "auto" && io.ox !== "scroll") fail("3.overflow", where, `#report content ${io.sw} > ${io.cw}`);
  else if (io && io.sw > io.cw + 1) fail("3.overflow", where, `#report scrolls horizontally (${io.sw} > ${io.cw})`);
  await checkClip(page, where, "#report");
  const head = await page.evaluate(() => { const h = document.querySelector("#report .rep-head"); return h ? h.innerText : ""; });
  if (!/\d[\d.,]*\s*(억|만|천)/.test(head)) fail("6.content", where, "no headline money number in .rep-head");
  let txt = await page.evaluate(() => __qa.text("#report"));
  checkText(txt, where);
  let touch = null;
  if (opts.touch) touch = await page.evaluate(() => __qa.touch("#report", ".sheet-foot-x"));
  if (opts.tabs) {
    const tabs = await page.evaluate(() => [...document.querySelectorAll("#report [role=tab]")].map((b) => b.dataset.tab));
    for (const k of tabs) {
      await page.evaluate((k) => { const b = document.querySelector(`#report [role=tab][data-tab="${k}"]`); b && b.click(); }, k);
      await page.waitForTimeout(220);
      const st = await page.evaluate((k) => { const b = document.querySelector(`#report [role=tab][data-tab="${k}"]`); const p = document.getElementById("pane"); return { sel: b && b.getAttribute("aria-selected"), len: p ? p.innerText.trim().length : -1, txt: p ? p.innerText : "" }; }, k);
      if (st.sel !== "true") fail("6.tabs", where, `tab ${k} not selected after click`);
      if (st.len <= 0) fail("6.tabs", where, `tab ${k} pane empty`);
      checkText(st.txt, `${where}/tab ${k}`);
      flushErrors(page, `${where}/tab ${k}`);
    }
    if (tabs.length) { await page.evaluate(() => { const b = document.querySelector('#report [role=tab][data-tab="money"]'); b && b.click(); }); await page.waitForTimeout(150); }
    if (tabs.length) await checkOverflow(page, where + "/after tabs");
  }
  flushErrors(page, where);
  return { touch };
}

(async () => {
  const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) : {};
  const measured = { touch: {} };
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"], proxy: proxyOpt() });
  const MOB = (w, h) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const DESK = { viewport: { width: 1440, height: 900 } };
  let api = null, zoneIds = [];
  const deadline = (label) => { if (elapsed() > HARD_LIMIT_MS) { warn("runtime", label, `skipped: time budget ${HARD_LIMIT_MS / 1000}s reached`); return true; } return false; };

  async function scenario(name, opts, plan) {
    if (deadline(name)) return;
    const S = await setup(browser, name, opts);
    const { page } = S;
    const mobile = !!opts.isMobile;
    try {
      // ---- home ----
      const tSN = await loadHome(page);
      info[name] = { tSN };
      if (tSN == null) fail("8.perf", name, "#sN never became non-zero within 15s");
      else if (tSN > SN_LIMIT_MS) fail("8.perf", name, `time to #sN non-zero ${tSN}ms > ${SN_LIMIT_MS}ms`);
      await page.waitForTimeout(1000);
      const idle = await page.evaluate(() => performance.now());
      flushErrors(page, name + "/home load");
      if (!api && plan.api) {
        api = await page.evaluate(async () => { try { const [c, z] = await Promise.all([fetch("/api/v1/cash.json").then((r) => r.json()), fetch("/api/v1/zones.json").then((r) => r.json())]); return { cash: c, zones: z.items.map((x) => ({ id: x.id, gap: x.need && x.need.gap ? x.need.gap.now : null })) }; } catch (e) { return { err: String(e) }; } });
        if (api.err) warn("2.api", name, "could not fetch api: " + api.err);
        else {
          const withGap = api.zones.filter((z) => z.gap != null).sort((a, b) => a.gap - b.gap);
          const first = withGap.slice(0, 6).map((z) => z.id);
          const rest = api.zones.filter((z) => !first.includes(z.id));
          const rnd = mulberry32(20261017), pick = [];
          while (pick.length < 6 && rest.length) pick.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0].id);
          zoneIds = first.concat(pick);
        }
      }
      await checkOverflow(page, name + "/home");
      await checkClip(page, name + "/home", ".s-hero");
      if (plan.touch) {
        const t = await page.evaluate(() => __qa.touch("body", "#report,.sheet,[hidden]"));
        measured.touch["home_" + name] = t.length;
        info[name].touchHome = { count: t.length, top: t.sort((a, b) => a.w * a.h - b.w * b.h).slice(0, 6) };
      }
      if (plan.gauge) {
        info[name].gauge = await gaugeCheck(page, name, api && api.cash);
        flushErrors(page, name + "/gauge");
        await checkOverflow(page, name + "/home after gauge");
        // 기본값으로 되돌림
        await page.evaluate(() => { const s = document.getElementById("sCash"); s.value = "8.33"; s.dispatchEvent(new Event("change", { bubbles: true })); });
        await settle(page, 400);
      }
      // ---- zones (in-page hash) ----
      const zs = plan.zones ? zoneIds.slice(0, plan.zones) : [];
      let touchMax = 0, touchTop = [];
      for (const id of zs) {
        if (deadline(name + "/zones")) break;
        const r = await zoneChecks(page, name, id, { mobile, tabs: plan.tabs, touch: plan.touch });
        if (r && r.touch) { if (r.touch.length > touchMax) { touchMax = r.touch.length; touchTop = r.touch.sort((a, b) => a.w * a.h - b.w * b.h).slice(0, 6); } }
      }
      if (plan.touch && zs.length) { measured.touch["sheet_" + name] = touchMax; info[name].touchSheet = { maxCount: touchMax, top: touchTop }; }
      await longTasks(page, name, idle);
      // ---- tool deep links (fresh load each) ----
      for (const id of plan.tools || []) {
        if (deadline(name + "/tools")) break;
        const where = `${name}/#${id}`;
        await loadHome(page, "#" + id);
        await page.waitForTimeout(700);
        const st = await page.evaluate((id) => { const s = document.getElementById(id); if (!s) return { missing: 1 }; const r = s.getBoundingClientRect(); const al = (window.ZP_ALIAS || {})[id]; return { on: s.classList.contains("s-on") || id === "planner", len: s.innerText.trim().length, h: Math.round(r.height), disp: getComputedStyle(s).display, al, hash: location.hash, hubOn: al ? !!(document.getElementById(al[0]) || {}).classList?.contains("s-on") : null }; }, id);
        if (st.missing) fail("7.deeplink", where, "section missing");
        else if (st.al && (st.hash !== "#" + st.al[0] || !st.hubOn)) fail("7.deeplink", where, `old link should open #${st.al[0]} (${st.al[1]}): hash ${st.hash}, hub s-on ${st.hubOn}`);
        else if (st.disp === "none" || st.h < 40 || st.len < 40) fail("7.deeplink", where, `renders empty (display:${st.disp}, h=${st.h}, text=${st.len})`);
        await checkOverflow(page, where);
        await checkClip(page, where, `#${id}`);
        const tx = await page.evaluate((id) => __qa.text("#" + id), id);
        checkText(tx, where);
        flushErrors(page, where);
      }
      // ---- zone deep link (fresh) ----
      if (plan.zoneDeep && zoneIds[0]) {
        const where = `${name}/#${zoneIds[0]} (deep link)`;
        await loadHome(page, "#" + zoneIds[0]);
        try { await page.waitForFunction(() => { const t = document.getElementById("repTitle"); return t && t.textContent.trim(); }, null, { timeout: 8000 }); } catch (e) { fail("7.deeplink", where, "zone deep link did not open report"); }
        await page.waitForTimeout(500);
        if (mobile && !(await page.evaluate(() => document.getElementById("report").classList.contains("sheet")))) fail("7.deeplink", where, "zone deep link: sheet not open on mobile");
        flushErrors(page, where);
      }
      // ---- 404 ----
      if (plan.notFound) {
        const where = name + "/404";
        const resp = await page.goto(BASE + "/nope-qa-" + Date.now(), { waitUntil: "domcontentloaded" });
        const st = resp ? resp.status() : 0, server = resp ? (resp.headers()["server"] || "") : "";
        const body = await page.evaluate(() => (document.body ? document.body.innerText.trim() : ""));
        if (st !== 404) warn("7.404", where, `status ${st} (expected 404)`);
        if (body.length < 20) fail("7.404", where, `404 page body empty (status ${st})`);
        else if (!/찾을 수 없/.test(body)) { if (/SimpleHTTP/i.test(server)) warn("7.404", where, "local python server: custom 404.html not served (expected locally)"); else fail("7.404", where, "custom 404 page not served"); }
        if (/SimpleHTTP/i.test(server)) {
          await page.goto(BASE + "/404.html", { waitUntil: "domcontentloaded" });
          const b2 = await page.evaluate(() => (document.body ? document.body.innerText.trim() : ""));
          if (!/찾을 수 없/.test(b2)) fail("7.404", where, "/404.html has no body");
        }
        await checkOverflow(page, where);
        flushErrors(page, where);
      }
    } catch (e) {
      fail("runtime", name, "scenario crashed: " + String(e.message || e).split("\n")[0].slice(0, 200));
    } finally {
      await S.ctx.close().catch(() => {});
    }
  }

  await scenario("m360", MOB(360, 740), { api: true, gauge: true, touch: true, zones: 12, tabs: true, tools: TOOLS, zoneDeep: true, notFound: true });
  await scenario("m390", MOB(390, 844), { api: true, gauge: true, touch: true, zones: 4, tabs: false });
  await scenario("d1440", DESK, { api: true, gauge: true, zones: 3, tabs: true, tools: ["rankHub", "news", "planner"], zoneDeep: true });
  await scenario("m360-dark", { ...MOB(360, 740), colorScheme: "dark" }, { api: true, zones: 4, tabs: false, tools: ["planner"] });
  await scenario("d1440-dark", { ...DESK, colorScheme: "dark" }, { api: true, zones: 2, tabs: false });
  await browser.close();

  // ---- 터치 타깃: 기준선보다 늘면 실패 ----
  const bt = (baseline.touch || {});
  for (const [k, v] of Object.entries(measured.touch)) {
    if (bt[k] == null) warn("5.touch", k, `no baseline (now ${v}); run with --update-baseline`);
    else if (v > bt[k]) fail("5.touch", k, `targets < ${TOUCH_MIN}px: ${v} (baseline ${bt[k]})`);
  }
  if (UPDATE_BASELINE || !fs.existsSync(BASELINE_FILE)) {
    const nb = { note: "QA gate baseline: touch = count of visible buttons/links smaller than 40x40 CSS px. Fails only when the count grows. Update: node tools/qa.js --update-baseline", updated: new Date().toISOString().slice(0, 10), touch: { ...bt, ...measured.touch } };
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(nb, null, 2) + "\n");
    console.log(`baseline written: ${BASELINE_FILE}`);
  }

  // ---- 출력 ----
  const res = { base: BASE, at: new Date().toISOString(), ms: elapsed(), pass: failures.length === 0, failures, warnings, info, zones: zoneIds };
  try { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(res, null, 2)); } catch (e) { console.error("could not write " + OUT + ": " + e.message); }
  const group = (arr) => { const g = {}; arr.forEach((x) => (g[x.check] = g[x.check] || []).push(x)); return g; };
  console.log(`\nQA ${BASE}  (${(elapsed() / 1000).toFixed(1)}s, zones: ${zoneIds.join(" ")})`);
  for (const [n, v] of Object.entries(info)) {
    const parts = [`#sN ${v.tSN == null ? "n/a" : v.tSN + "ms"}`];
    if (v.gauge) parts.push("gauge " + v.gauge.map((g) => `${g.label}:${g.hero}/${g.list}${g.api != null ? "/api" + g.api : ""}`).join(" "));
    if (v.touchHome) parts.push(`touch<40 home ${v.touchHome.count}`);
    if (v.touchSheet) parts.push(`sheet max ${v.touchSheet.maxCount}`);
    console.log(`  ${n.padEnd(11)} ${parts.join(" · ")}`);
  }
  const fw = (title, arr, max) => { if (!arr.length) return; console.log(`\n${title} (${arr.length})`); for (const [c, xs] of Object.entries(group(arr))) { console.log(`  [${c}] ${xs.length}`); xs.slice(0, max).forEach((x) => console.log(`    - ${x.where}: ${x.msg}`)); if (xs.length > max) console.log(`    … +${xs.length - max} more (see JSON)`); } };
  fw("WARN", warnings, 4);
  fw("FAIL", failures, 8);
  console.log(`\n${failures.length ? "QA FAILED" : "QA PASSED"} · ${failures.length} failure(s), ${warnings.length} warning(s) · JSON: ${OUT}`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error("QA crashed:", e); process.exit(2); });
