#!/usr/bin/env node
/* 집핀 숫자·용어 일관성 회귀 검사 (red-team 8~12회차에서 나온 '기계로 잴 수 있는' 결함 전부)
   실행:  NODE_PATH=$(npm root -g) node tools/qa_consistency.js [baseUrl]
          baseUrl 기본 http://localhost:8765  (python3 -m http.server 8765 -d public)
   FAIL이 하나라도 있으면 exit 1. 화면에는 검사별 PASS/FAIL 한 줄씩, 전체 결과는 JSON(QAC_OUT 또는 아래 기본 경로).
   이 파일은 src/를 읽기만 한다(shortName 원본을 그대로 가져와 페이지 안에서 돌리려고). 4분 안에 끝나도록 시간 예산을 둔다.

   검사 id 앞 글자: count.* 곳 수 · list.* 목록 · why.* '왜 이 금액?' · zone.* 구역 리포트 · z.* 정적 구역 페이지 · gu.* 구별 페이지
                    term.* 용어 · map.* 지도 · search.* 검색 · name.* 이름 · ui.* 화면(터치·가로 넘침·딥링크) · seo.* 정적·매니페스트 · err.* 콘솔 */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
const BASE = (argv.find((a) => !a.startsWith("--")) || "http://localhost:8765").replace(/\/+$/, "");
const OUT = process.env.QAC_OUT || "/tmp/claude-0/-home-claude/887bff60-b663-5701-90e9-e402cebc9114/scratchpad/qac_last.json";
const EXE = process.env.QA_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SRC_APP = path.join(__dirname, "..", "src", "app.js");
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const BUDGET_MS = 225000;
const T0 = Date.now();
const el = () => Date.now() - T0;
const over = () => el() > BUDGET_MS;
const TODAY = new Date();
let LOADS = 0;

const BLOCK = /googlesyndication|googletagmanager|google-analytics|doubleclick|adservice|adtrafficquality|fundingchoices|pagead2/i;
const IGNORE_MSG = /GL Driver|WebGL|GPU stall|swiftshader|adsbygoogle|googlesyndication|pagead|\[Report Only\]|report-only|Content-Security-Policy-Report-Only/i;

// 고정 표본 구역(보고서에서 문제가 났던 곳) + API에서 고르는 몇 곳
const FIXED_ZONES = ["o916", "o337", "o586", "o1059", "s78", "o747", "o111", "o135", "o136", "o914", "s45", "m9", "o776", "o281"];
const CASH_LEVELS = [1, 3, 6, 10, 15];
const STATIONS = ["봉천역", "신림역"];
const EXTRA_VIEWS = ["results", "rulesTop", "readsTop", "statsTop"];

// ---------------------------------------------------------------- 결과 모음
const CHECKS = new Map();   // id -> {title, n, fails:[], warns:[], skipped}
function C(id, title) { if (!CHECKS.has(id)) CHECKS.set(id, { id, title, n: 0, fails: [], warns: [], skipped: null }); return CHECKS.get(id); }
const ok = (id, title) => { C(id, title).n++; };
const bad = (id, title, msg) => { const c = C(id, title); c.n++; c.fails.push(String(msg).replace(/\s+/g, " ").slice(0, 300)); };
const wrn = (id, title, msg) => { C(id, title).warns.push(String(msg).replace(/\s+/g, " ").slice(0, 300)); };
const skip = (id, title, why) => { const c = C(id, title); if (!c.n) c.skipped = why; };
const expect = (cond, id, title, msg) => (cond ? ok(id, title) : bad(id, title, msg));

// ---------------------------------------------------------------- 숫자 읽기
const toPos = (c) => { const KN = [[0, 0.5], [28, 2], [58, 5], [88, 10], [100, 15]]; c = Math.min(15, Math.max(0.5, c)); for (let i = 1; i < KN.length; i++) if (c <= KN[i][1]) { const [a, x] = KN[i - 1], [b, y] = KN[i]; return a + ((c - x) / (y - x)) * (b - a); } return 100; };
const intOf = (s) => { const m = String(s || "").replace(/,/g, "").match(/(\d+)/); return m ? +m[1] : NaN; };
const cntOf = (s) => { const m = String(s || "").replace(/,/g, "").match(/(\d+)\s*곳/); return m ? +m[1] : NaN; };
// "1억 5,450만" / "8,740만" / "0.95억" / "2억" / "0원" / "3,905만원" → 억 단위 실수, 소수 자리(반올림 허용치용)
function money(s) {
  s = String(s || "").replace(/,/g, "").replace(/\s+/g, " ").trim();
  if (/^0\s*원/.test(s)) return { v: 0, tol: 0.0001 };
  const m = /(?:(\d+(?:\.\d+)?)\s*억)?\s*(?:(\d+)\s*만)?/.exec(s);
  if (!m || (m[1] == null && m[2] == null)) return null;
  const e = m[1] != null ? +m[1] : 0, man = m[2] != null ? +m[2] : 0;
  const dec = m[1] && m[1].includes(".") ? m[1].split(".")[1].length : 0;
  const tol = m[2] != null ? 0.00011 : dec ? 0.5 * Math.pow(10, -dec) + 1e-6 : 0.5 + 1e-6;
  return { v: e + man / 1e4, tol };
}
const eqMoney = (a, b) => a && b && Math.abs(a.v - b.v) <= Math.max(a.tol, b.tol) + 1e-6;
const eqApi = (disp, api) => disp && api != null && Math.abs(disp.v - api) <= disp.tol + 0.001;
const fm = (m) => (!m ? "–" : m.v < 1 ? `${Math.round(m.v * 1e4).toLocaleString("en-US")}만` : `${+m.v.toFixed(4)}억`);

// 억 금액 한 꼴(src/ext/05_facts.js ZF.num·ZF.cash와 같은 규칙): 1억 아래 소수 둘째 자리, 1억부터 첫째 자리
const zfNum = (v) => { if (v == null || !isFinite(v)) return "–"; const a = Math.abs(v), sg = v < 0 ? "-" : ""; if (a < 0.005) return "0"; if (a < 0.995) return sg + (Math.round(a * 100) / 100).toFixed(2).replace(/0$/, ""); return sg + (Math.round(a * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 }); };
const zfCash = (v) => { const t = zfNum(v); return t === "–" ? t : t === "0" ? "0원" : t + "억"; };
// WCAG 대비(페이지 안): 글자색(불투명도 곱) vs 조상 배경을 겹쳐 만든 실제 바탕
const CONTRAST_JS = (rootSel) => {
  const P = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; };
  const L = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const bgOf = (el) => { const st = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== "none") return null; const c = P(cs.backgroundColor); if (c && c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let b = [255, 255, 255, 1]; if (!st.length || st[st.length - 1][3] < 1) b = P(getComputedStyle(document.body).backgroundColor) || b; for (let i = st.length - 1; i >= 0; i--) b = over(st[i], b); return b; };
  const out = [];
  for (const root of document.querySelectorAll(rootSel)) for (const el of root.querySelectorAll("*")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (!window.__qc.vis(el) || el.closest("[aria-hidden=true],svg,.sr-only")) continue;
    const cs = getComputedStyle(el); if (cs.clip !== "auto") continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    const fg0 = P(cs.color), bg = bgOf(el); if (!fg0 || !bg) continue;
    const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * op], bg);
    const l1 = L(fg), l2 = L(bg), cr = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize), big = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    if (el.closest("button:disabled,[aria-disabled=true],input:disabled")) continue;
    if (cr < (big ? 3 : 4.5)) out.push(`${window.__qc.sel(el)} "${el.textContent.trim().slice(0, 16)}" ${cr.toFixed(2)}:1`);
  }
  return [...new Set(out)];
};

// 화면 글자에 나오면 안 되는 것(회차별 보고서에서 실제로 나왔던 것들)
const BAD_TOKENS = [
  [/\bNaN\b/, "NaN"], [/\bundefined\b/, "undefined"], [/\bnull\b/, "null"], [/\bInfinity\b/, "Infinity"], [/\[object/, "[object"],
  [/[–-]\s?억/, "–억"], [/곳(?:를|는|와|가)(?=[\s.,·)!?]|$)/, "곳+틀린 조사(곳를/곳는…)"], [/\(\s*-\d+\s*곳\)/, "음수 곳 수"],
  [/(?<![\d,])1건 가운데 값/, "1건 가운데 값"], [/12개월 모든 거래/, "12개월 모든 거래(→구역 안)"], [/(?<!정보)(?<!사업 )정비몽땅/, "정비몽땅(→정비사업 정보몽땅)"],
  [/동의율\s*:?\s*\d+\.\d+(?!\d|\s*%)/, "동의율 % 빠짐"], [/\d\s?m²/, "m²(→㎡)"],
];
const DOUBLED = /(?:^|[ (·])([가-힣]{2,})(?: \1)(?=$|[ ·,.)])/m;
function badText(txt) {
  const out = [];
  for (const [re, name] of BAD_TOKENS) { const m = txt.match(new RegExp(".{0,22}(?:" + re.source + ").{0,22}", "m")); if (m) out.push(`${name}: "${m[0].replace(/\s+/g, " ").trim()}"`); }
  for (const line of txt.split("\n")) { const m = DOUBLED.exec(line); if (m) { out.push(`겹친 낱말 "${m[1]} ${m[1]}": "${line.trim().slice(0, 60)}"`); break; } }
  return out;
}
// 예상 입주 글자가 과거인지 ("2025년 8월", "25.08", "2025-08", "2027년")
function pastEta(s) {
  if (!s) return false;
  let y = null, mo = 12;
  let m = /(20\d\d)\s*[년.\-/]\s*(\d{1,2})/.exec(s) || /(?:^|\D)(\d\d)\.(\d{1,2})(?!\d)/.exec(s);
  if (m) { y = +m[1] < 100 ? 2000 + +m[1] : +m[1]; mo = +m[2]; }
  else if ((m = /(20\d\d)\s*년/.exec(s))) y = +m[1];
  if (y == null) return false;
  return y < TODAY.getFullYear() || (y === TODAY.getFullYear() && mo < TODAY.getMonth() + 1);
}
const hav = (a, b, c, d) => { const R = 6371e3, t = Math.PI / 180, x = Math.sin(((c - a) * t) / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(((d - b) * t) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

// ---------------------------------------------------------------- HTTP(정적 페이지)
async function get(url, method = "GET") {
  for (let i = 0; i < 2; i++) {
    try { const r = await fetch(url, { method }); return { status: r.status, text: method === "GET" ? await r.text() : "", ct: r.headers.get("content-type") || "" }; } catch (e) { if (i) return { status: 0, text: "", err: String(e) }; }
  }
}
// /z/<id> 와 /gu/<구> 는 로컬 python 서버에서 .html이 필요하다
async function getPage(p) {
  let r = await get(BASE + encodeURI(p));
  if ((r.status === 404 || r.status === 0) && !/\.html$|\/$/.test(p)) { const r2 = await get(BASE + encodeURI(p) + ".html"); if (r2.status === 200) r = r2; }
  return r;
}
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", ndash: "–", mdash: "—", rarr: "→", larr: "←", times: "×" };
function htmlText(h) {
  let b = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<template[\s\S]*?<\/template>/gi, "");
  b = b.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(p|div|li|tr|h\d|section|article|header|footer|main|ul|ol|table|thead|tbody|dl|dt|dd|nav|figure|figcaption|td|th|small|b|strong|span|a|em|i|sup|sub|label|button|time|abbr|svg|text|g|path|circle|rect|line|polyline|polygon|title|desc|caption)[^>]*>/gi, "\n").replace(/<[^>]+>/g, "");
  b = b.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m));
  return b.split("\n").map((s) => s.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { err: String(e) }; } } })); return out; }

// /z/<id> 페이지에서 숫자 뽑기
function parseZ(html) {
  const t = htmlText(html);
  const o = { text: t };
  o.title = ((/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "").trim();
  o.h1 = htmlText(((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || ""));
  o.og = ((/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i.exec(html) || [])[1] || "");
  let m = /대지 3\.3㎡당\n([^\n]+)\n([^\n]+)/.exec(t);
  if (m) { o.hdV = money(m[1]); o.hdBasis = m[2]; o.hdN = intOf((/([\d,]+)건/.exec(m[2]) || [])[1]); }
  m = /계산 매수가\n([^\n]+)\n=\s*([^\n]+)/.exec(t);
  if (m) { o.buyV = money(m[1]); o.buyBasis = m[2]; o.buyN = intOf((/([\d,]+)건/.exec(m[2]) || [])[1]); }
  m = /매수가 표본 ([\d,]+)건/.exec(t); if (m) o.trustN = intOf(m[1]);
  m = /(전세 끼고|현금으로 사면|대출 끼고)? ?입주까지 현금\n([\d.,]+억)/.exec(t); if (m) { o.ipjuMode = m[1] || ""; o.ipju = money(m[2]); }
  m = /현금으로 사면 ([\d.,]+억)/.exec(t); if (m) o.cashTotal = money(m[1]);
  m = /데이터 기준 (\d{4}\.\d\d\.\d\d)/.exec(t); if (m) o.asof = m[1];
  return o;
}
// 앱 구역 리포트 글자에서 숫자 뽑기
function parseRep(t) {
  const o = {};
  let m = /실거래\n([^\n]+)\n([^\n]+)\n+기준 · ([^\n]+)/.exec(t);
  if (m) { o.hdLabel = m[1]; o.hdV = money(m[2]); o.hdBasis = m[3]; o.hdN = intOf((/([\d,]+)건/.exec(m[3]) || [])[1]); }
  m = /계산 매수가\n([^\n]+)\n=\s*([^\n]+)/.exec(t);
  if (m) { o.buyV = money(m[1]); o.buyBasis = m[2]; o.buyN = intOf((/([\d,]+)건/.exec(m[2]) || [])[1]); }
  m = /매수가 표본\n([\d,]+)건/.exec(t); if (m) o.trustN = intOf(m[1]);
  m = /마지막 거래\n(\d\d)\.(\d\d)\.(\d\d)/.exec(t); if (m) o.trustLast = m[1] + "." + m[2];
  m = /다른 기준 보기\n(\d\d\.\d\d)\n/.exec(t); if (m) o.excerpt1 = m[1];
  o.ipju = [...t.matchAll(/입주까지 현금\s*\n?\s*([\d.,]+억)/g)].map((x) => x[1]);
  return o;
}

// ---------------------------------------------------------------- 브라우저 도우미
const IN_PAGE = () => {
  const vis = (el) => { if (!el || !el.getBoundingClientRect) return false; const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0) return false; return !el.closest("[hidden]"); };
  const sel = (el) => { const p = []; let e = el; for (let i = 0; e && e.nodeType === 1 && i < 4; i++, e = e.parentElement) { let s = e.tagName.toLowerCase(); if (e.id) { p.unshift(s + "#" + e.id); break; } const c = [...e.classList].slice(0, 2).join("."); if (c) s += "." + c; p.unshift(s); } return p.join(">"); };
  const inScroller = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return true; } return false; };
  window.__qc = {
    vis, sel,
    domText() { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && n.parentElement.closest("script,style,noscript,template,svg title") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) }); const a = []; let n; while ((n = w.nextNode())) { const s = n.nodeValue.trim(); if (s) a.push(s); } return a.join("\n"); },
    overflow() { const se = document.scrollingElement; const iw = innerWidth; if (se.scrollWidth <= iw + 1) return null; const w = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > iw + 1 && vis(e) && !inScroller(e) && getComputedStyle(e).position !== "fixed"; }).slice(0, 3).map((e) => sel(e) + " right=" + Math.round(e.getBoundingClientRect().right)); return `scrollWidth ${se.scrollWidth} > ${iw}` + (w.length ? " · " + w.join(", ") : ""); },
    touch(rootSel, excl) {
      const out = [];
      for (const root of document.querySelectorAll(rootSel)) for (const el of root.querySelectorAll("button, a[href], [role=button], [role=tab], input[type=checkbox], input[type=radio], select")) {
        if (excl && el.closest(excl)) continue;
        if (!vis(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "inline" && el.tagName === "A") { const p = el.parentElement; if (p && [...p.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue; }   // 문장 속 링크(WCAG 2.5.8 예외)
        if (cs.clip !== "auto" || /inset\(50%/.test(cs.clipPath)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 40) out.push(`${sel(el)} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 18)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      return [...new Set(out)];
    },
  };
};

async function newPage(browser, opts, errs) {
  const ctx = await browser.newContext({ ...opts, serviceWorkers: "block" });
  await ctx.route(BLOCK, (r) => r.abort());
  await ctx.addInitScript(IN_PAGE);
  await ctx.addInitScript(() => { try { localStorage.setItem("emr.coach1", "1"); } catch (e) {} });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push({ where: page.__where || "", msg: "pageerror: " + (e.message || String(e)).split("\n")[0].slice(0, 200) }));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text(), u = (m.location() && m.location().url) || "";
    if (IGNORE_MSG.test(t) || BLOCK.test(u) || BLOCK.test(t)) return;
    const external = u && !u.startsWith(BASE);
    errs.push({ where: page.__where || "", msg: "console.error: " + t.slice(0, 200) + (u ? " @" + u.replace(BASE, "").slice(0, 70) : ""), external });
  });
  return { ctx, page };
}
async function loadHome(page, hash = "") {
  page.__where = "/" + hash;
  // 해시만 바꾸면 같은 문서로 남으므로 쿼리를 바꿔 새로 불러온다(about:blank를 거치면 매니페스트 CORS 오류가 덤으로 생김)
  await page.goto(BASE + "/" + (hash ? "?qac=" + (++LOADS) : "") + hash, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => { const e = document.getElementById("sN"); return e && /\d/.test(e.textContent) && typeof window.ZP_count === "function"; }, null, { timeout: 20000, polling: 100 }).catch(() => {});
  await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
}
async function settle(page, ms = 350) {
  await page.waitForTimeout(ms);
  let prev = null;
  for (let i = 0; i < 15; i++) {
    const v = await page.evaluate(() => ["sN", "sLT", "resTitle", "sMini", "sMore"].map((i) => (document.getElementById(i) || {}).textContent).join("|"));
    if (v === prev) return; prev = v; await page.waitForTimeout(150);
  }
}
async function setMode(page, f) { await page.evaluate((f) => { const b = document.querySelector(`.s-mode button[data-f="${f}"]`); if (b && b.getAttribute("aria-pressed") !== "true") b.click(); }, f); await settle(page, 400); }
async function setCash(page, c) {
  await page.evaluate((v) => { const s = document.getElementById("sCash"); s.value = String(v); s.dispatchEvent(new Event("input", { bubbles: true })); s.dispatchEvent(new Event("change", { bubbles: true })); }, toPos(c));
  await settle(page, 450);
}
async function stableText(page, sel, maxMs = 4000, need = 1) {
  let prev = "", same = 0; const t0 = Date.now();
  while (Date.now() - t0 < maxMs) { const t = await page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ""; }, sel); if (t && t === prev) { if (++same >= need) return t; } else same = 0; prev = t; await page.waitForTimeout(200); }
  return prev;
}

// ================================================================ 1) 정적 페이지 (node fetch)
async function staticLane(api) {
  const T = (id, t) => [id, t];
  // --- 매니페스트·첫 화면 HTML
  const idx = await get(BASE + "/");
  const man = await get(BASE + "/manifest.webmanifest");
  {
    const [id, t] = T("seo.manifest", "manifest: theme 통일·dark theme-color·orientation any·screenshots·지도/내 핀 바로가기");
    try {
      const mj = JSON.parse(man.text);
      const light = (/<meta name="theme-color" content="([^"]+)"(?![^>]*dark)[^>]*>/i.exec(idx.text) || [])[1];
      expect(light && mj.theme_color && light.toLowerCase() === mj.theme_color.toLowerCase(), id, t, `manifest theme_color ${mj.theme_color} ≠ meta theme-color ${light}`);
      expect(/<meta name="theme-color"[^>]+prefers-color-scheme: dark/i.test(idx.text), id, t, "no dark theme-color meta");
      expect(!/portrait/.test(mj.orientation || ""), id, t, `orientation ${mj.orientation}`);
      expect((mj.screenshots || []).length > 0, id, t, "no screenshots");
      const sc = (mj.shortcuts || []).map((s) => s.url).join(" ");
      expect(/#map\b/.test(sc) && /#favTop\b/.test(sc), id, t, "shortcuts lack #map / #favTop: " + sc);
    } catch (e) { bad(id, t, "manifest unreadable: " + e.message); }
  }
  {
    // 14회차: 섬(첫 페인트) 단계에도 머리 종 자리·아래 탭바·알림 카드(같은 문구)가 있다 — 앱이 붙을 때 자리가 생기며 밀리지 않게
    const T1 = "index.html 첫 페인트에 종(#huBell)·아래 탭바(#sNav)·알림 카드 자리(.pc-ph 안 .pc-al) 있음";
    expect(/id="huBell"/.test(idx.text) && /id="sNav"/.test(idx.text) && /class="pc-save pc-ph"[^>]*><div class="pc-al"/.test(idx.text), "ui.islandSlots", T1, `huBell ${/id="huBell"/.test(idx.text)} sNav ${/id="sNav"/.test(idx.text)} pc-ph card ${/class="pc-save pc-ph"[^>]*><div class="pc-al"/.test(idx.text)}`);
    const bn = api.zones.filter((z) => /^\s*\d{1,3}\.\s/.test(z.name || ""));
    expect(!bn.length, "name.listNo", "구역 이름에 목록 번호('43. 문래동1·2가') 없음(api·/z·검색 같은 shortName)", `${bn.length}: ${bn.slice(0, 4).map((z) => z.id + " " + z.name).join(", ")}`);
  }
  {
    const [id, t] = T("seo.index", "index.html: Pretendard CSS 한 번만 · title에 옛 이름(얼마면) 없음");
    const links = (idx.text.match(/<link[^>]+pretendard[^>]*>/gi) || []).filter((l) => /stylesheet|preload[^>]+as="style"/i.test(l));
    const sheets = links.filter((l) => /rel="stylesheet"/i.test(l));
    expect(sheets.length <= 1, id, t, `Pretendard stylesheet linked ${sheets.length}×: ${sheets.map((s) => s.slice(0, 90)).join(" | ")}`);
    const title = (/<title>([\s\S]*?)<\/title>/i.exec(idx.text) || [])[1] || "";
    expect(!/얼마면/.test(title), id, t, `title has old brand: ${title}`);
  }
  // --- 사이트맵의 모든 페이지
  const sm = await get(BASE + "/sitemap.xml");
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/");
  const zLocs = locs.filter((p) => /^\/z\/[^/]+$/.test(p));
  const other = locs.filter((p) => !/^\/z\/[^/]+$/.test(p));
  // sitemap에 없는 /z/ 파일도(앱 링크로 열리는 페이지) 디스크에서 보탠다
  let zIds = zLocs.map((p) => decodeURIComponent(p.slice(3)));
  try { if (fs.existsSync(path.join(PUBLIC_DIR, "z"))) { const f = fs.readdirSync(path.join(PUBLIC_DIR, "z")).filter((x) => /\.html$/.test(x) && x !== "index.html").map((x) => x.replace(/\.html$/, "")); zIds = [...new Set(zIds.concat(f))]; } } catch (e) {}
  const apiById = new Map(api.zones.map((z) => [z.id, z]));
  const zData = new Map();
  // 같은 곳 합치기(tools/enrich.py D.alias) — 앱 데이터에서 읽는다
  let aliasOf = {};
  try { aliasOf = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, "..", "pipeline", "data.enriched.json"), "utf8")).alias || {}; } catch (e) {}
  // 검색창 이름(aria-label) == 보이는 안내(placeholder)
  try { const ih = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8"), m = /<input[^>]*id="q"[^>]*>/.exec(ih) || [""], al = (/aria-label="([^"]*)"/.exec(m[0]) || [])[1], ph = (/placeholder="([^"]*)"/.exec(m[0]) || [])[1];
    expect(al && al === ph, "a11y.qLabel", "검색창 aria-label == placeholder", `aria-label "${al}" vs placeholder "${ph}"`); } catch (e) {}
  // 지번+짧은 이름이 같은 진행 중 구역이 api에 두 줄 이상 있으면 안 된다
  { const seen = new Map(), dup = []; for (const z of api.zones) { const k = `${z.name}|${String(z.jibun || "").replace(/\s+/g, "")}`; if (!z.jibun) continue; if (seen.has(k)) dup.push(`${seen.get(k)}/${z.id} ${z.name}`); else seen.set(k, z.id); }
    expect(!dup.length, "data.dedupe", "같은 곳 두 줄(지번·이름 같음)은 하나로 · 옛 id /z는 남긴 구역으로 옮김(noindex)", dup.slice(0, 5).join(" ; ")); }
  const updDot = (api.updated || "").replace(/-/g, ".");

  const zRes = await pool(zIds, 12, async (zid) => { const r = await getPage("/z/" + zid); return { zid, r }; });
  const ogList = [];
  for (const { zid, r } of zRes) {
    if (!r || r.status !== 200) { bad("z.status", "/z/<id> 페이지 200", `/z/${zid} → ${r && r.status}`); continue; }
    ok("z.status", "/z/<id> 페이지 200");
    const where = `/z/${zid}`;
    // 같은 곳 합치기로 옮긴 옛 id(api의 alias): 남긴 구역으로 가는 noindex 옮김 페이지여야 한다
    if (aliasOf[zid]) {
      expect(/name="robots" content="noindex/.test(r.text) && r.text.includes(`url=./${aliasOf[zid]}`) && !apiById.has(zid), "data.dedupe", "같은 곳 두 줄(지번·이름 같음)은 하나로 · 옛 id /z는 남긴 구역으로 옮김(noindex)", `${where}: not a redirect to ${aliasOf[zid]}`);
      continue;
    }
    const z = parseZ(r.text); zData.set(zid, z);
    // 제목·h1 겹친 유형어
    const dt = (s) => { const m = /(?:^|\s)([가-힣]{2,})\s+\1/.exec(s.replace(/\s*\|.*$/, "")); return m && /정비형|재개발|재건축|정비|주택|장기전세|가로|소규모|사업|구역/.test(m[1]) ? m[1] : null; };
    const d1 = dt(z.title), d2 = dt(z.h1);
    expect(!d1 && !d2, "z.title", "/z 제목·h1에 같은 유형어 두 번 없음(도시정비형 도시정비형)", `${where}: title "${z.title}" h1 "${z.h1}"`);
    expect(!/얼마면/.test(z.title), "z.title", "/z 제목·h1에 같은 유형어 두 번 없음(도시정비형 도시정비형)", `${where}: old brand in title`);
    // 14회차: 제목 = '<짧은 이름> 재개발|재건축 | …' — 사업 방식 말(도시정비형·공공·신속통합기획·장기전세…)은 설명으로(이름이 겹쳐 괄호로 가른 것은 허용) · 목록 번호 '43. ' 없음
    { const tn = z.title.split(" | ")[0].replace(/\([^)]*\)/g, ""); const q = tn.match(/(?:^|\s)(도시정비형|공공임대|공공시행|공공|신속통합기획|장기전세|주택정비형|LH참여형|민간|후보지|SHIFT)(?=\s|$)/);
      expect(!q && !/^\d{1,3}\.\s/.test(tn), "z.titleQ", "/z 제목에 사업 방식 말(도시정비형·공공·장기전세…)·목록 번호 없음 → 설명으로", `${where}: "${z.title}"`); }
    // 글자 결함
    const bt = badText(z.text);
    expect(!bt.length, "z.text", "/z 본문에 NaN·undefined·–억·곳를·겹친 낱말·1건 가운데 값 없음", `${where}: ${bt.join(" ; ")}`);
    // 받침 조사: 숫자 끝은 읽는 소리로(2이·4사·5오·9구 → 는/가 · 0영·1일·3삼·6육·7칠·8팔 → 은/이) — '개봉동 49은'·'창신9은'
    { const m = /[가-힣\s]\d*[2459]은 /.exec(z.text) || /[가-힣\s]\d*[013678]는 /.exec(z.text);   // 이/가는 지명('종로1가')과 겹쳐 은/는만
      expect(!m, "z.josa", "/z 숫자 뒤 조사(은/는·이/가)가 읽는 소리 받침에 맞음", `${where}: "${m && m[0].trim()}"`); }
    expect(!/입주까지 총/.test(z.text), "term.static", "정적 페이지에 '입주까지 총' 없음(→입주까지 현금)", `${where}`);
    // 표본 수: 큰 숫자 n == 계산 매수가 n == 믿어도 될까 n
    if (z.hdN || z.buyN || z.trustN) {
      const ns = [z.hdN, z.buyN, z.trustN].filter((x) => x != null && !isNaN(x));
      expect(new Set(ns).size <= 1, "z.sample", "/z 큰 숫자·계산 매수가·신뢰 상자가 같은 표본 n건", `${where}: 3.3㎡ 기준 ${z.hdN}건("${(z.hdBasis || "").slice(0, 50)}") · 매수가 ${z.buyN}건 · 신뢰 ${z.trustN}건`);
    }
    // 입주까지 현금 == API
    const a = apiById.get(zid);
    if (a && z.ipju) {
      const g = a.need && a.need.gap, c = a.need && a.need.cash;
      if (/전세/.test(z.ipjuMode)) expect(eqApi(z.ipju, g && g.total), "z.api", "/z 입주까지 현금 == /api/v1 같은 방식 값", `${where}: 전세 끼고 ${fm(z.ipju)} vs api gap.total ${g && g.total}`);
      else expect(eqApi(z.ipju, c && c.total) || eqApi(z.ipju, g && g.total), "z.api", "/z 입주까지 현금 == /api/v1 같은 방식 값", `${where}: ${z.ipjuMode || "?"} ${fm(z.ipju)} vs api cash.total ${c && c.total}`);
    }
    // 금액 꼴(ZF.cash): /z '지금 X억' == api 값의 ZF 꼴(0.69억처럼 1억 아래 소수 둘째 자리)
    if (a && a.need && a.need.gap && a.need.gap.now != null) {
      const m = /(?:^|[\s(])지금 ([\d.,]+억|0원)(?= ·|\))/.exec(z.text);
      // api는 소수 둘째 자리로 반올림돼 있어(2.65) 원래 값(2.648…)의 꼴과 한 자리 다를 수 있다 → ±0.005 안의 꼴이면 같은 꼴
      if (m) expect([a.need.gap.now - 0.005, a.need.gap.now, a.need.gap.now + 0.0049].some((v) => m[1] === zfCash(v)), "term.cashFmt", "금액 꼴 하나(ZF.cash · 1억 아래 소수 둘째 자리): 목록 == /api 값 꼴 == 지도 이름표 == 리포트 시간표", `${where}: /z "지금 ${m[1]}" vs ZF꼴(api ${a.need.gap.now}) "${zfCash(a.need.gap.now)}"`);
    }
    if (a && z.cashTotal && a.need && a.need.cash && a.need.cash.total != null) expect(eqApi(z.cashTotal, a.need.cash.total), "z.api", "/z 입주까지 현금 == /api/v1 같은 방식 값", `${where}: 현금으로 사면 ${fm(z.cashTotal)} vs api cash.total ${a.need.cash.total}`);
    if (z.asof && updDot) expect(z.asof === updDot, "seo.dates", "정적 페이지 '데이터 기준' 날짜 == api updated", `${where}: ${z.asof} vs ${updDot}`);
    if (z.og) ogList.push([zid, z.og]); else bad("seo.og", "/z og:image 있고 200", `${where}: no og:image`);
  }
  // og:image 실제 파일
  await pool(ogList, 16, async ([zid, og]) => {
    const p = og.replace(/^https?:\/\/[^/]+/, "");
    const r = await get(BASE + p, "HEAD");
    expect(r.status === 200, "seo.og", "/z og:image 있고 200", `/z/${zid}: ${p} → ${r.status}`);
  });
  // --- /gu/<구>
  const GUS = [...new Set(api.zones.map((z) => z.gu))].filter(Boolean);
  const guRes = await pool(GUS, 8, async (g) => ({ g, r: await getPage("/gu/" + g) }));
  for (const { g, r } of guRes) {
    const where = `/gu/${g}`;
    if (!r || r.status !== 200) { bad("gu.sum", "/gu 단계 요약 합 == 머리 곳 수 == 표 줄 수", `${where} → ${r && r.status}`); continue; }
    const h1 = htmlText(((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(r.text) || [])[1] || ""));
    const lede = htmlText(((/<p class="lede"[^>]*>([\s\S]*?)<\/p>/i.exec(r.text) || [])[1] || ""));
    const head = cntOf(h1);
    const sum = [...lede.replace(/,/g, "").matchAll(/(\d+)곳/g)].reduce((s, m) => s + +m[1], 0);
    const tb = (/<tbody>([\s\S]*?)<\/tbody>/i.exec(r.text) || [])[1] || "";
    const rows = [...tb.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
    expect(head === sum, "gu.sum", "/gu 단계 요약 합 == 머리 곳 수 == 표 줄 수", `${where}: h1 ${head}곳 vs 단계 요약 합 ${sum} ("${lede.slice(0, 80)}")`);
    expect(head === rows.length, "gu.sum", "/gu 단계 요약 합 == 머리 곳 수 == 표 줄 수", `${where}: h1 ${head}곳 vs 표 ${rows.length}줄`);
    const txt = htmlText(r.text);
    const bt = badText(txt);
    expect(!bt.length, "gu.text", "/gu 본문 글자 결함 없음", `${where}: ${bt.join(" ; ")}`);
    expect(!/입주까지 총/.test(txt), "term.static", "정적 페이지에 '입주까지 총' 없음(→입주까지 현금)", where);
    // 표 값 == API
    let mis = [];
    for (const row of rows) {
      const zid = (/href="(?:\.\.\/z\/|\/z\/)?([a-z]+\d+)"/.exec(row) || [])[1]; const a = apiById.get(zid); if (!a) continue;
      const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => htmlText(m[1]));
      if (tds.length < 3) continue;
      const now = money(tds[1]), tot = money(tds[2].split("\n")[0]), cashMode = /현금 매수 시/.test(tds[2]);
      const g = a.need.gap, c = a.need.cash;
      if (now && /억/.test(tds[1]) && !eqApi(now, g.now)) mis.push(`${zid} 전세 끼고 지금 ${tds[1]} vs api ${g.now}`);
      if (tot && /억/.test(tds[2])) { const ref = cashMode ? c.total : g.total; if (!eqApi(tot, ref)) mis.push(`${zid} 입주까지 ${tds[2].replace(/\n/g, " ")} vs api ${cashMode ? "cash" : "gap"}.total ${ref}`); }
    }
    expect(!mis.length, "gu.api", "/gu 표 숫자 == /api/v1 (전세 끼고 지금·입주까지 현금)", `${where}: ${mis.slice(0, 4).join(" ; ")}${mis.length > 4 ? ` … +${mis.length - 4}` : ""}`);
    const d = /데이터 기준 (\d{4}\.\d\d\.\d\d)/.exec(txt); if (d && updDot) expect(d[1] === updDot, "seo.dates", "정적 페이지 '데이터 기준' 날짜 == api updated", `${where}: ${d[1]} vs ${updDot}`);
  }
  // --- 나머지 정적 페이지(소개·방법·몇 년·가이드·리포트·색인·404)
  const rest = [...new Set(other.filter((p) => p !== "/" && !/^\/gu\/[^/]+$/.test(p)).concat(["/404.html", "/z/", "/gu/"]))];
  const rRes = await pool(rest, 8, async (p) => ({ p, r: await getPage(p) }));
  const liveCounts = [];
  for (const { p, r } of rRes) {
    if (!r || r.status !== 200 || !/html/.test(r.ct)) { if (r && r.status !== 200) bad("seo.status", "사이트맵 페이지 200", `${p} → ${r.status}`); continue; }
    ok("seo.status", "사이트맵 페이지 200");
    const txt = htmlText(r.text);
    const bt = badText(txt);
    expect(!bt.length, "seo.text", "정적 페이지(소개·가이드·리포트…) 글자 결함 없음", `${p}: ${bt.join(" ; ")}`);
    expect(!/입주까지 총/.test(txt), "term.static", "정적 페이지에 '입주까지 총' 없음(→입주까지 현금)", p);
    const title = ((/<title>([\s\S]*?)<\/title>/i.exec(r.text) || [])[1] || "");
    expect(!/얼마면/.test(title), "seo.text", "정적 페이지(소개·가이드·리포트…) 글자 결함 없음", `${p}: old brand in <title> "${title}"`);
    const d = /데이터 기준 (\d{4}\.\d\d\.\d\d)/.exec(txt); if (d && updDot) expect(d[1] === updDot, "seo.dates", "정적 페이지 '데이터 기준' 날짜 == api updated", `${p}: ${d[1]} vs ${updDot}`);
    for (const m of txt.replace(/,/g, "").matchAll(/진행 중(?: 정비사업)? (\d+)곳/g)) liveCounts.push([p, +m[1]]);
  }
  // --- API: 과거 예상 입주
  {
    const past = api.zones.filter((z) => z.completion && z.completion.mid && pastEta(z.completion.mid.replace("-", ".")));
    expect(!past.length, "zone.etaPast", "예상 입주가 과거가 아님(앱·API)", `api: ${past.length} zones with completion.mid in the past: ${past.slice(0, 5).map((z) => z.id + " " + z.completion.mid).join(", ")}`);
  }
  return { zData, liveCounts };
}

// ================================================================ 2) 곳 수·목록·왜 이 금액 (폰 390)
async function countsLane(browser, api, errs, shared) {
  const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, errs);
  try {
    await loadHome(page);
    // 라벨: 계산기(입주 계산) 방식 이름 == 첫 화면 방식 이름
    {
      // .s-mode는 첫 화면 본 버튼 + 지도 위 작은 막대(.s-mm, 같은 버튼을 대신 누르는 사본) 두 벌 → 이름 목록은 겹친 것을 한 번만
      const L = await page.evaluate(() => ({ hero: [...new Set([...document.querySelectorAll(".s-mode button")].map((b) => b.textContent.trim()))], pl: [...document.querySelectorAll("#pFund button")].map((b) => b.textContent.trim()) }));
      expect(JSON.stringify(L.hero) === JSON.stringify(L.pl), "term.mode", "사는 방식 이름이 첫 화면·입주 계산에서 같음", `hero [${L.hero.join(", ")}] vs planner [${L.pl.join(", ")}]`);
    }
    const stepOf = (c) => (api.cash.steps || []).find((s) => Math.abs(s.cash - c) < 1e-6);
    for (const mode of ["gap", "cash"]) {
      await setMode(page, mode);
      for (const c of CASH_LEVELS) {
        await setCash(page, c);
        const s = await page.evaluate(() => ({ sN: document.getElementById("sN").textContent, sNL: document.getElementById("sNL").textContent, lab: document.getElementById("sCashV").textContent, sLT: document.getElementById("sLT").textContent, mini: (document.getElementById("sMini") || {}).textContent || "", rt: (document.getElementById("resTitle") || {}).textContent || "", zc: window.ZP_count(), pc: (document.getElementById("pCash") || {}).value, more: (document.getElementById("sMore") || {}).textContent, moreH: (document.getElementById("sMore") || {}).hidden, rows: document.querySelectorAll("#sList li a[data-id]").length }));
        const hero = intOf(s.sN), where = `${mode === "gap" ? "전세" : "대출"} ${c}억 (${s.lab})`;
        const id = mode === "gap" ? "count.gap" : "count.loan", title = mode === "gap" ? "전세 끼고: 첫 화면 == ZP_count == 입주 계산 #resTitle == 목록 제목 == 작은 막대 == /api gapNow" : "대출 끼고: 첫 화면 == ZP_count == 입주 계산 #resTitle == 목록 제목 == 작은 막대";
        const plan = cntOf(s.rt), list = cntOf(s.sLT), mini = cntOf(s.mini);
        const parts = { hero, ZP_count: s.zc, planner: plan, list, mini };
        const diff = Object.entries(parts).filter(([, v]) => v !== hero);
        expect(!diff.length, id, title, `${where}: ` + Object.entries(parts).map(([k, v]) => `${k} ${v}`).join(" · "));
        expect(Math.abs(+s.pc - c) < 0.051, id, title, `${where}: planner #pCash ${s.pc} ≠ gauge ${c}`);
        if (mode === "gap") { const st = stepOf(c); if (st) expect(st.gapNow === hero, id, title, `${where}: hero ${hero} vs /api/v1/cash.json gapNow ${st.gapNow}`); }
        else { const st = stepOf(c); if (st && st.cashNow !== hero) wrn(id, title, `${where}: hero ${hero} vs api cashNow ${st.cashNow} (api는 대출 없음 기준일 수 있음)`); }
        // 목록 줄 + 더 보기 == 제목 곳 수, 음수 없음
        const moreN = s.moreH ? 0 : intOf(s.more);
        expect(s.rows + (moreN || 0) === list || (list === 0 && s.rows === 0), "count.list", "목록 줄 수 + '더 보기 (N곳)' == 목록 제목 곳 수, 음수 없음", `${where}: rows ${s.rows} + more ${s.more} ≠ ${list}`);
        expect(!/-\d/.test(s.more || ""), "count.list", "목록 줄 수 + '더 보기 (N곳)' == 목록 제목 곳 수, 음수 없음", `${where}: "${s.more}"`);
        expect(/\d+\s*곳\s*중/.test(s.sNL) || hero === 0, "count.denom", "첫 화면 곳 수에 분모('N곳 중')", `${where}: #sNL "${s.sNL}"`);
      }
    }
    // 유형 칩을 켠 채: 작은 막대 == 목록 제목 == 줄 수(+더 보기)
    for (const [mode, c] of [["gap", 3], ["cash", 10]]) {
      await setMode(page, mode); await setCash(page, c);
      for (const k of ["redev", "rebuild", "small", ""]) {
        await page.evaluate((k) => { const b = [...document.querySelectorAll("#sListW .s-flt button")].find((x) => (x.dataset.k || "") === k); if (b) b.click(); }, k); await settle(page, 350);
        const s = await page.evaluate(() => ({ sLT: document.getElementById("sLT").textContent, mini: (document.getElementById("sMini") || {}).textContent || "", sN: document.getElementById("sN").textContent, rows: document.querySelectorAll("#sList li a[data-id]").length, more: document.getElementById("sMore").hidden ? "" : document.getElementById("sMore").textContent, empty: (document.querySelector("#sList .s-empty") || {}).innerText || "" }));
        const list = cntOf(s.sLT), mini = cntOf(s.mini), where = `${mode} ${c}억 filter=${k || "전체"}`;
        expect(list === mini, "count.filter", "유형 칩을 켜도 작은 막대 곳 수 == 목록 곳 수 == 실제 줄 수", `${where}: list "${s.sLT}" vs mini "${s.mini}"`);
        expect(s.rows + (intOf(s.more) || 0) === list, "count.filter", "유형 칩을 켜도 작은 막대 곳 수 == 목록 곳 수 == 실제 줄 수", `${where}: rows ${s.rows}+more "${s.more}" vs ${list}`);
        if (s.empty) { expect(!/·\s*$/.test(s.empty.trim()) && /올려 보기|전체/.test(s.empty), "list.empty", "0곳일 때 빈 화면에 한 번에 고치는 버튼", `${where}: "${s.empty.replace(/\n/g, " ")}"`); }
      }
    }
    // 15억 전세 끼고: 목록 전체를 펼쳐 각 줄 숫자 == /api/v1/zones.json (지금·입주까지 현금)
    await setMode(page, "gap"); await setCash(page, 15);
    for (let i = 0; i < 40; i++) { const more = await page.evaluate(() => { const m = document.getElementById("sMore"); if (!m || m.hidden) return false; m.click(); return true; }); if (!more) break; await page.waitForTimeout(160); }
    const rowsG = await page.evaluate(() => [...document.querySelectorAll("#sList li")].map((li) => { const a = li.querySelector("a[data-id]"), b = li.querySelector(".s-amt"); return a && b ? { id: a.dataset.id, name: (li.querySelector(".s-nm b") || {}).textContent, amt: b.innerText } : null; }).filter(Boolean));
    const apiById = new Map(api.zones.map((z) => [z.id, z]));
    const listMap = new Map();
    const misN = [], misT = [];
    for (const r of rowsG) {
      const m1 = /([\d.,]+억|[\d,]+만|0원)/.exec(r.amt), m2 = /입주까지 현금\s*([\d.,]+억)/.exec(r.amt);
      const now = m1 && money(m1[1]), tot = m2 && money(m2[1]);
      listMap.set(r.id, { now, tot, raw: r.amt });
      const a = apiById.get(r.id); if (!a) continue;
      if (now && !eqApi(now, a.need.gap.now)) misN.push(`${r.id} ${r.name}: list ${m1[1]} vs api ${a.need.gap.now}`);
      if (tot && !eqApi(tot, a.need.gap.total)) misT.push(`${r.id} ${r.name}: list ${m2[1]} vs api ${a.need.gap.total}`);
      if (!tot && a.need.gap.total != null) misT.push(`${r.id} ${r.name}: list has no 입주까지 현금 but api ${a.need.gap.total}`);
    }
    expect(rowsG.length > 20, "list.api", "15억 전세 끼고 목록 각 줄 '지금'·'입주까지 현금' == /api/v1/zones.json", `only ${rowsG.length} rows after expanding`);
    expect(!misN.length, "list.api", "15억 전세 끼고 목록 각 줄 '지금'·'입주까지 현금' == /api/v1/zones.json", `지금: ${misN.slice(0, 4).join(" ; ")}${misN.length > 4 ? ` … +${misN.length - 4}` : ""}`);
    expect(!misT.length, "list.api", "15억 전세 끼고 목록 각 줄 '지금'·'입주까지 현금' == /api/v1/zones.json", `입주까지: ${misT.slice(0, 4).join(" ; ")}${misT.length > 4 ? ` … +${misT.length - 4}` : ""}`);
    // 입주 계산 불가 줄은 아래로
    { const firstNA = rowsG.findIndex((r) => !/입주까지 현금/.test(r.amt)), lastOK = rowsG.map((r) => /입주까지 현금/.test(r.amt)).lastIndexOf(true);
      expect(firstNA < 0 || firstNA > lastOK, "list.order", "'입주 계산 불가' 줄은 계산되는 줄보다 아래", `first n/a row #${firstNA} (${rowsG[firstNA] && rowsG[firstNA].name}) above calculable row #${lastOK}`); }
    // 맞춤순(기본 정렬): 지금 필요한 돈이 내 현금(15억)에 가까운 줄부터 — |현금 − 금액| 오름차순(표시 반올림 허용), 계산 불가 줄은 아래(list.order)
    {
      const sk = await page.evaluate(() => { try { return localStorage.getItem("emr.sort") || "fit"; } catch (e) { return "fit"; } });
      if (sk === "fit") {
        const ok = rowsG.filter((r) => /입주까지 현금/.test(r.amt)).map((r) => ({ r, m: money((/([\d.,]+억|[\d,]+만|0원)/.exec(r.amt) || [])[1]) })).filter((x) => x.m);
        let at = -1; for (let i = 1; i < ok.length; i++) { const a = Math.abs(15 - ok[i - 1].m.v), b = Math.abs(15 - ok[i].m.v); if (b + ok[i].m.tol + ok[i - 1].m.tol + 1e-6 < a) { at = i; break; } }
        expect(ok.length > 5 && at < 0, "list.fitSort", "맞춤순: 내 현금에 가까운 금액부터(|현금−금액| 오름차순 · 계산 불가는 아래)", at < 0 ? `only ${ok.length} rows` : `15억: row ${at - 1} ${ok[at - 1].r.name} ${ok[at - 1].r.amt.split("\n")[0]} before row ${at} ${ok[at].r.name} ${ok[at].r.amt.split("\n")[0]}`);
      } else skip("list.fitSort", "맞춤순: 내 현금에 가까운 금액부터(|현금−금액| 오름차순 · 계산 불가는 아래)", `stored sort ${sk}`);
    }
    // 금액 꼴 하나(ZF.cash): 1억 전세 끼고 목록 첫 줄들 '지금' == ZF 꼴(api 값) == 지도 이름표 == 리포트 시간표 '지금 · 매수'
    {
      await setMode(page, "gap"); await setCash(page, 1);
      const L1 = await page.evaluate(() => [...document.querySelectorAll("#sList li")].slice(0, 4).map((li) => { const a = li.querySelector("a[data-id]"), b = li.querySelector(".s-amt b"); return a && b ? { id: a.dataset.id, v: b.textContent.trim() } : null; }).filter(Boolean));
      const T = "금액 꼴 하나(ZF.cash · 1억 아래 소수 둘째 자리): 목록 == /api 값 꼴 == 지도 이름표 == 리포트 시간표";
      const labs = await page.evaluate((ids) => { try { const m = window.ZP_lmx && window.ZP_lmx.map && window.ZP_lmx.map(); const src = m && m.getSource("zlab"); const d = src && (src.serialize ? src.serialize().data : src._data); const F = (d && d.features) || []; const o = {}; ids.forEach((id) => { const f = F.find((x) => x.properties.id === id); if (f) o[id] = f.properties.s; }); return o; } catch (e) { return {}; } }, L1.map((x) => x.id));
      for (const x of L1) {
        const a = api.zones.find((z) => z.id === x.id); if (!a || a.need.gap.now == null) continue;
        const want = zfCash(a.need.gap.now);
        expect(x.v === want, "term.cashFmt", T, `${x.id}: list "${x.v}" vs ZF꼴(api ${a.need.gap.now}) "${want}"`);
        if (labs[x.id] != null) expect(labs[x.id] === "" || labs[x.id] === want, "term.cashFmt", T, `${x.id}: map label "${labs[x.id]}" vs list "${x.v}"`);
      }
      if (L1[0]) {
        await loadHome(page, "#" + L1[0].id); await page.waitForTimeout(1500);
        const g = await page.evaluate(() => { const b = document.querySelector("#report .gtl .gt1 b"); return b ? b.textContent.trim() : null; });
        if (g != null) expect(g === L1[0].v, "term.cashFmt", T, `${L1[0].id}: report timeline "${g}" vs list "${L1[0].v}"`);
        else wrn("term.cashFmt", T, `${L1[0].id}: no .gtl .gt1 in report`);
        await loadHome(page);
      }
    }
    shared.listMap = listMap;
    // '왜 이 금액?' 만원 더하기 == 합계, 목록 숫자와 같음
    for (const [mode, c] of [["gap", 3], ["cash", 3]]) {
      await setMode(page, mode); await setCash(page, c);
      const ids = await page.evaluate(() => [...document.querySelectorAll("#sList .s-amt[data-why]")].slice(0, 6).map((b) => b.dataset.why));
      for (const zid of ids) {
        const r = await page.evaluate(async (zid) => {
          const b = document.querySelector(`#sList .s-amt[data-why="${zid}"]`); if (!b) return null;
          const amt = b.innerText; b.click(); await new Promise((r) => setTimeout(r, 250));
          const w = document.getElementById("sWhy"); if (!w || w.hidden) return { amt, missing: 1 };
          const lines = [...w.querySelectorAll("li")].filter((li) => li.querySelector("b")).map((li) => ({ op: ((li.querySelector("span i") || {}).textContent || "").trim(), k: (li.querySelector("span") || {}).textContent, v: li.querySelector("b").textContent, sum: li.classList.contains("s-wsum") }));
          const tail = (w.querySelector("p") || {}).textContent || "";
          const x = w.querySelector("[data-x]"); if (x) x.click(); await new Promise((r) => setTimeout(r, 120));
          return { amt, lines, tail };
        }, zid);
        const where = `${mode} ${c}억 ${zid}`;
        if (!r || r.missing) { bad("why.sum", "'왜 이 금액?' 줄을 만원으로 더하면 합계와 같음 · 목록 숫자와 같음", `${where}: why sheet did not open`); continue; }
        const man = (s) => { const m = money(s); return m ? Math.round(m.v * 1e4) : NaN; };
        let acc = null, total = null;
        for (const l of r.lines) { const v = man(l.v); if (l.sum || l.op === "=") { total = v; break; } if (acc == null) acc = v; else if (/[−-]/.test(l.op)) acc -= v; else if (/\+/.test(l.op)) acc += v; }
        if (total == null || acc == null) { wrn("why.sum", "'왜 이 금액?' 줄을 만원으로 더하면 합계와 같음 · 목록 숫자와 같음", `${where}: could not parse lines ${JSON.stringify(r.lines).slice(0, 120)}`); continue; }
        expect(Math.max(0, acc) === total, "why.sum", "'왜 이 금액?' 줄을 만원으로 더하면 합계와 같음 · 목록 숫자와 같음", `${where}: ${r.lines.map((l) => `${l.op}${l.v}`).join(" ")} → 계산 ${acc}만 ≠ 합계 ${total}만`);
        const lm = /([\d.,]+억|[\d,]+만|0원)/.exec(r.amt), lv = lm && money(lm[1]);
        expect(lv && Math.abs(lv.v - total / 1e4) <= lv.tol + 1e-4, "why.sum", "'왜 이 금액?' 줄을 만원으로 더하면 합계와 같음 · 목록 숫자와 같음", `${where}: list ${lm && lm[1]} vs why 합계 ${total}만`);
        const t1 = /입주까지 현금\s*([\d.,]+억)/.exec(r.tail), t2 = /입주까지 현금\s*([\d.,]+억)/.exec(r.amt);
        if (t1 || t2) expect(t1 && t2 && eqMoney(money(t1[1]), money(t2[1])), "why.sum", "'왜 이 금액?' 줄을 만원으로 더하면 합계와 같음 · 목록 숫자와 같음", `${where}: why tail "${t1 && t1[1]}" vs list "${t2 && t2[1]}"`);
      }
    }
    // 대출 끼고 칩: 왜 시트에 대출 근거 줄
  } catch (e) { bad("runtime", "검사 실행", "countsLane crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await ctx.close().catch(() => {}); }
}

// ================================================================ 3) 구역 리포트 ↔ 목록 ↔ /z (폰 390)
async function zoneLane(browser, api, errs, shared, zoneIds) {
  const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, errs);
  const apiById = new Map(api.zones.map((z) => [z.id, z]));
  try {
    await loadHome(page);
    await setMode(page, "gap");
    for (const zid of zoneIds) {
      if (over()) { skip("zone.sample", "구역 리포트", "time budget"); break; }
      const where = `#${zid}`;
      page.__where = where;
      await page.evaluate(() => { const t = document.getElementById("repTitle"); if (t) t.__qcOld = 1; });
      await page.evaluate((i) => { location.hash = "#" + i; }, zid);
      const opened = await page.waitForFunction(() => { const t = document.getElementById("repTitle"); return t && !t.__qcOld && t.textContent.trim(); }, null, { timeout: 7000, polling: 80 }).then(() => true, () => false);
      if (!opened) { bad("zone.open", "구역 리포트가 열림", `${where}: report did not render`); continue; }
      ok("zone.open", "구역 리포트가 열림");
      // tx.json은 리포트를 열 때 늦게 불러온다 → 글자가 멈출 때까지
      await page.waitForFunction(() => /믿어도 될까|최근 구역 안 거래 없음|계산 안 함/.test((document.getElementById("report") || {}).innerText || ""), null, { timeout: 5000, polling: 150 }).catch(() => {});
      const ov = await stableText(page, "#report", 4000, 2);
      const tabs = await page.evaluate(() => [...document.querySelectorAll("#report [role=tab]")].map((b) => b.dataset.tab));
      const pane = {}; let aucI = null;
      for (const k of tabs) {
        await page.evaluate((k) => { const b = document.querySelector(`#report [role=tab][data-tab="${k}"]`); b && b.click(); }, k);
        pane[k] = await stableText(page, "#pane", 2500, 1);
        if (k === "tx") {   // 경매: 머리 칩 'N건' == 예정 사건(카드) 수 == 블록 머리 '예정 N건'(물건 수는 '물건 M개'로 따로)
          await page.waitForFunction(() => !/경매 물건 불러오는 중/.test((document.getElementById("aucSec") || {}).textContent || ""), null, { timeout: 4000, polling: 150 }).catch(() => {});
          aucI = await page.evaluate(() => { const s = document.getElementById("aucSec"), c = document.querySelector("#report .auc-chip"); if (!s) return null; const h = s.querySelector(".auc-n:not(.c)"); return { cards: s.querySelectorAll(".auc-l > li.up").length, chip: c ? c.textContent.trim() : "", head: h ? h.textContent.trim() : "", raw: [...s.querySelectorAll(".auc-f.j, .auc-sub")].map((e) => e.textContent).join(" | ") }; });
        }
      }
      await page.evaluate(() => { const b = document.querySelector('#report [role=tab][data-tab="money"]'); b && b.click(); });
      const all = [ov, ...Object.values(pane)].join("\n");
      const pinBtns = await page.evaluate(() => [...document.querySelectorAll("#report button, #report a")].filter((b) => window.__qc.vis(b) && /핀 꽂(기|고)/.test(b.textContent)).length);
      const R = parseRep(ov);
      // 글자 결함
      const bt = badText(all);
      expect(!bt.length, "zone.text", "리포트(모든 탭)에 NaN·undefined·–억·곳를·겹친 낱말·1건 가운데 값·m² 없음", `${where}: ${bt.join(" ; ")}`);
      expect(!/입주까지 총/.test(all), "term.app", "앱 화면에 '입주까지 총' 없음(같은 숫자는 '입주까지 현금')", `${where} report`);
      expect(!/호재·매물/.test(all), "term.tabName", "탭 이름을 부르는 글자 == 실제 탭 이름('호재·매물' 탭 없음)", `${where}`);
      // 일정 탭 '10년 안 준공 가능성' 값이 비지 않음('–' 대신 '1% 미만'·'자료 부족')
      if (pane.biz) { const m = /10년 안 준공 가능성\n([^\n]*)/.exec(pane.biz); if (m) expect(m[1].trim() && m[1].trim() !== "–" && m[1].trim() !== "0%", "zone.p10", "일정 탭 10년 안 준공 가능성: '–'·'0%' 대신 '1% 미만'·'자료 부족'", `${where}: "${m[1]}"`); }
      if (aucI && aucI.cards) {
        const T = "경매 셈은 사건 단위: 칩 '경매 N건' == 예정 사건 카드 수 == 블록 머리 '예정 N건'";
        expect(!aucI.chip || aucI.chip === `경매 ${aucI.cards}건`, "zone.aucCount", T, `${where}: chip "${aucI.chip}" vs ${aucI.cards} cards`);
        expect(new RegExp(`^예정 ${aucI.cards}건( · 물건 \\d+개)?$`).test(aucI.head), "zone.aucCount", T, `${where}: head "${aucI.head}" vs ${aucI.cards} cards`);
        expect(!/\d분의\d|단독주택다가구|연립주택,다세대/.test(aucI.raw), "zone.aucText", "경매 지분·용도는 읽는 말로('지분 약 9.8%' · '단독·다가구')", `${where}: ${aucI.raw.slice(0, 120)}`);
      }
      expect(pinBtns <= 1, "zone.pin1", "리포트에 '핀 꽂기' 버튼 하나", `${where}: ${pinBtns} visible 핀 꽂기 buttons`);
      // 표본 n: 큰 숫자 == 매수가 == 신뢰 상자
      const ns = [R.hdN, R.buyN, R.trustN].filter((x) => x != null && !isNaN(x));
      if (ns.length >= 2) expect(new Set(ns).size === 1, "zone.sample", "리포트 큰 숫자·계산 매수가·'믿어도 될까'가 같은 표본 n건", `${where}: 큰 숫자 ${R.hdN}건 ("${(R.hdBasis || "").slice(0, 50)}") · 매수가 ${R.buyN}건 · 신뢰 ${R.trustN}건`);
      if (R.excerpt1 && R.trustLast) expect(R.excerpt1 === R.trustLast, "zone.excerpt", "리포트 거래 발췌 첫 줄 == '마지막 거래'(최신 먼저)", `${where}: excerpt first ${R.excerpt1} vs 마지막 거래 ${R.trustLast}`);
      // 비교표(1km 안 다른 구역)의 이 구역 3.3㎡ 값 == 큰 숫자
      if (pane.near && R.hdV && /3\.3㎡/.test(R.hdLabel || "")) {
        const m = /3\.3㎡당 실거래[^\n\t]*\t([^\t\n]+)/.exec(pane.near);
        if (m && money(m[1])) expect(eqMoney(money(m[1]), R.hdV), "zone.cmp", "'1km 안 비교' 표의 이 구역 3.3㎡ 값 == 리포트 큰 숫자", `${where}: 비교표 ${m[1]} vs 큰 숫자 ${fm(R.hdV)}`);
      }
      // 입주까지 현금: 리포트 안 모든 자리 같음 == 목록 == API == /z
      const ip = [...new Set([...all.matchAll(/입주까지 현금\s*\n?\s*([\d.,]+억)/g)].map((m) => m[1]))];
      const a = apiById.get(zid);
      if (ip.length) {
        expect(ip.length === 1, "zone.ipju", "입주까지 현금: 리포트 안 모든 자리 == 목록 == /api == /z (전세 끼고)", `${where}: report shows several values ${ip.join(" / ")}`);
        const rv = money(ip[0]);
        if (a && a.need.gap.total != null) expect(eqApi(rv, a.need.gap.total), "zone.ipju", "입주까지 현금: 리포트 안 모든 자리 == 목록 == /api == /z (전세 끼고)", `${where}: report ${ip[0]} vs api gap.total ${a.need.gap.total}`);
        const lm = shared.listMap && shared.listMap.get(zid);
        if (lm && lm.tot) expect(eqMoney(lm.tot, rv), "zone.ipju", "입주까지 현금: 리포트 안 모든 자리 == 목록 == /api == /z (전세 끼고)", `${where}: list ${fm(lm.tot)} vs report ${ip[0]}`);
      }
      // 현금 탭 다리: 들어가는 돈 − 잔금대출 = 입주까지 현금 / 지금 + 이주 때 = 입주까지 현금
      { const m = /입주까지 들어가는 돈 ([\d.]+)억\n?\s*− 입주 잔금대출 ([\d.]+)억\n?\s*= 입주까지 현금 ([\d.]+)억/.exec(all);
        if (m) expect(Math.abs(+m[1] - +m[2] - +m[3]) <= 0.1 + 1e-9, "zone.bridge", "현금 탭 다리 계산(들어가는 돈 − 잔금대출 = 입주까지 현금)이 맞음", `${where}: ${m[1]} − ${m[2]} ≠ ${m[3]}`);
        const g = /지금 ([\d.]+)억\n?\s*\+ 이주 때 ([\d.]+)억\n?\s*= 입주까지 현금 ([\d.]+)억/.exec(all);
        if (g) expect(Math.abs(+g[1] + +g[2] - +g[3]) <= 0.1 + 1e-9, "zone.bridge", "현금 탭 다리 계산(들어가는 돈 − 잔금대출 = 입주까지 현금)이 맞음", `${where}: ${g[1]} + ${g[2]} ≠ ${g[3]}`); }
      // 입주 때 시세 차이 == 비례율 표 100%
      if (pane.money) {
        const g1 = /입주 때 시세 차이[^\n]*\n([+−-]?[\d.]+억)/.exec(pane.money), g2 = /\n100%\t([+−-]?[\d.]+억)/.exec(pane.money);
        if (g1 && g2) expect(g1[1].replace("−", "-") === g2[1].replace("−", "-"), "zone.gain", "'입주 때 시세 차이' == 비례율 표 100% 줄(같은 반올림)", `${where}: ${g1[1]} vs 100% ${g2[1]}`);
      }
      // 예상 입주: 현금 타임라인 == 일정 탭, 과거 아님
      { const m1 = /입주 · ([^\n]+)/.exec(pane.money || ov), m2 = /예상 입주\n([^\n]+)/.exec(pane.biz || "");
        const e1 = m1 && m1[1].trim(), e2 = m2 && m2[1].trim();
        if (e1 && e2) expect(e1 === e2 || e1.includes(e2) || e2.includes(e1), "zone.eta", "예상 입주 글자가 현금 타임라인 == 일정 탭", `${where}: 현금 "${e1}" vs 일정 "${e2}"`);
        for (const e of [e1, e2]) if (e) expect(!pastEta(e), "zone.etaPast", "예상 입주가 과거가 아님(앱·API)", `${where}: 예상 입주 "${e}" is in the past`); }
      // 같은 숫자 /z 페이지
      const zr = await getPage("/z/" + zid);
      if (zr.status === 200) {
        const Z = parseZ(zr.text);
        if (Z.hdV && R.hdV && /3\.3㎡/.test(R.hdLabel || "")) expect(eqMoney(Z.hdV, R.hdV), "zone.vsZ", "리포트 큰 숫자·표본 n·계산 매수가·입주까지 현금 == /z 페이지", `${where}: 3.3㎡ app ${fm(R.hdV)} ("${(R.hdBasis || "").slice(0, 40)}") vs /z ${fm(Z.hdV)} ("${(Z.hdBasis || "").slice(0, 40)}")`);
        if (Z.hdN && R.hdN) expect(Z.hdN === R.hdN, "zone.vsZ", "리포트 큰 숫자·표본 n·계산 매수가·입주까지 현금 == /z 페이지", `${where}: 큰 숫자 표본 app ${R.hdN}건 vs /z ${Z.hdN}건`);
        if (Z.buyV && R.buyV) expect(eqMoney(Z.buyV, R.buyV), "zone.vsZ", "리포트 큰 숫자·표본 n·계산 매수가·입주까지 현금 == /z 페이지", `${where}: 계산 매수가 app ${fm(R.buyV)} vs /z ${fm(Z.buyV)}`);
        if (Z.trustN && R.trustN) expect(Z.trustN === R.trustN, "zone.vsZ", "리포트 큰 숫자·표본 n·계산 매수가·입주까지 현금 == /z 페이지", `${where}: 신뢰 표본 app ${R.trustN} vs /z ${Z.trustN}`);
        if (Z.ipju && ip.length && /전세/.test(Z.ipjuMode)) expect(eqMoney(Z.ipju, money(ip[0])), "zone.vsZ", "리포트 큰 숫자·표본 n·계산 매수가·입주까지 현금 == /z 페이지", `${where}: 입주까지 현금 app ${ip[0]} vs /z ${fm(Z.ipju)}`);
      } else bad("zone.vsZ", "리포트 큰 숫자·표본 n·계산 매수가·입주까지 현금 == /z 페이지", `/z/${zid} → ${zr.status}`);
    }
  } catch (e) { bad("runtime", "검사 실행", "zoneLane crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await ctx.close().catch(() => {}); }
}

// ================================================================ 4) 360 화면: 터치·가로 넘침·도구 딥링크·용어·메뉴
async function uiLane(browser, api, errs, shared) {
  const { ctx, page } = await newPage(browser, { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, errs);
  try {
    await loadHome(page); await settle(page, 600);
    // 홈: h1 하나, 옛 이름 없음, 가로 넘침 없음, 터치 40px
    {
      const h = await page.evaluate(() => ({ h1: [...document.querySelectorAll("h1")].filter((e) => window.__qc.vis(e)).map((e) => e.textContent.trim().slice(0, 30)), h1all: document.querySelectorAll("h1:not([hidden])").length, txt: document.body.innerText, mini: (() => { const m = document.getElementById("sMini"); return m ? !!m.closest("aside,main,nav,header,footer,[role=region],[role=complementary],[role=main]") : null; })() }));
      expect(h.h1.length === 1, "ui.h1", "첫 화면 h1 정확히 하나 · 도구 화면마다 1단계 제목", `home visible h1: ${h.h1.length} [${h.h1.join(" | ")}]`);
      expect(!/얼마면/.test(h.txt), "ui.brand", "화면에 옛 이름 '얼마면 재개발' 없음", `home text contains 얼마면: "${(h.txt.match(/.{0,20}얼마면.{0,20}/) || [""])[0]}"`);
      if (h.mini != null) expect(h.mini, "ui.landmark", "#sMini가 랜드마크 안", "#sMini not inside a landmark");
    }
    { const o = await page.evaluate(() => window.__qc.overflow()); expect(!o, "ui.overflow", "360px 가로 스크롤 없음(홈·도구 화면마다)", `home: ${o}`); }
    { const t = await page.evaluate(() => window.__qc.touch("body", "#report,.sheet,[hidden],.s-why")); expect(!t.length, "ui.touch", "360px 홈 터치 타깃 40px 이상(문장 속 링크 제외)", `home: ${t.length} small: ${t.slice(0, 6).join(" ; ")}${t.length > 6 ? " …" : ""}`); }
    // 메뉴: 모든 도구 있음, 같은 글자 두 번 없음, '이번 달' 없음
    {
      const m = await page.evaluate((extra) => { const ids = (window.ZP_TOOLS || []).map((t) => t[0]); const links = [...document.querySelectorAll("#menuPop a, #menuPop [data-menu]")]; const hrefs = links.map((a) => (a.dataset.menu || (a.getAttribute("href") || "").replace(/^#/, ""))); const txt = links.map((a) => a.textContent.trim()); return { ids, extra, missing: ids.concat(extra.filter((x) => x !== "results" && x !== "readsTop")).filter((i) => !hrefs.includes(i)), dup: txt.filter((t, i) => t && txt.indexOf(t) !== i), month: txt.filter((t) => /이번 달/.test(t)) }; }, EXTRA_VIEWS);
      expect(!m.missing.length, "ui.menu", "⋯ 메뉴에 모든 도구 · 같은 항목 두 번 없음 · '이번 달' 없음", `menu lacks: ${m.missing.join(", ")}`);
      expect(!m.dup.length, "ui.menu", "⋯ 메뉴에 모든 도구 · 같은 항목 두 번 없음 · '이번 달' 없음", `duplicate menu items: ${m.dup.join(", ")}`);
      expect(!m.month.length, "ui.menu", "⋯ 메뉴에 모든 도구 · 같은 항목 두 번 없음 · '이번 달' 없음", `menu says: ${m.month.join(", ")}`);
      shared.toolIds = m.ids.concat(EXTRA_VIEWS);
      shared.alias = await page.evaluate(() => window.ZP_ALIAS || {});
    }
    // 홈 격자: 도구(ZP_TOOLS) 6개 이하 전부 · '더보기' 없음 · 격자와 메뉴가 같은 목록
    {
      const g = await page.evaluate(() => ({ tiles: [...document.querySelectorAll("#sTiles [data-view]")].map((a) => a.dataset.view), more: !!document.querySelector("#sTiles #sTAll, #sTiles .s-tall"), ids: (window.ZP_TOOLS || []).map((t) => t[0]) }));
      expect(g.ids.length <= 6 && JSON.stringify(g.tiles) === JSON.stringify(g.ids) && !g.more, "ui.tiles", "홈 격자 = 도구 6개 전부(ZP_TOOLS 순서) · 더보기 없음", `tiles [${g.tiles.join(", ")}] vs tools [${g.ids.join(", ")}]${g.more ? " · 더보기 있음" : ""}`);
    }
    // 돌아가기: 타일 격자 자리로
    {
      const r = await page.evaluate(async () => {
        const t = document.getElementById("sTiles"); if (!t) return null;
        t.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 200));
        const y0 = scrollY; const a = t.querySelector("a[href^='#'], button[data-v], [data-view], a"); if (!a) return null; a.click(); await new Promise((r) => setTimeout(r, 700));
        const b = [...document.querySelectorAll(".s-back")].find((x) => window.__qc.vis(x)); if (!b) return { y0, nob: 1 }; b.click(); await new Promise((r) => setTimeout(r, 900));
        return { y0, y1: scrollY };
      });
      if (r && !r.nob) expect(Math.abs(r.y1 - r.y0) < 120, "ui.back", "도구 '돌아가기' 뒤 원래 보던 자리(타일 격자)로", `scrollY before ${Math.round(r.y0)} → after ${Math.round(r.y1)}`);
      else if (r && r.nob) bad("ui.back", "도구 '돌아가기' 뒤 원래 보던 자리(타일 격자)로", "no visible .s-back after opening a tile");
    }
    // 도구 딥링크(새로 불러오기)마다: s-on · 돌아가기 버튼이 머리 아래 · 1단계 제목 · 가로 넘침 · 글자 결함
    const domTexts = [];
    // 예전 주소(#gapTop·#txrTop·#saveTop …)도 하나씩: 합친 화면이 열리고(주소 = 합친 화면) 그 탭·칸이 보여야 한다
    for (const id of (shared.toolIds || []).concat(Object.keys(shared.alias || {}))) {
      if (over()) { skip("ui.deeplink", "도구 딥링크", "time budget"); break; }
      await loadHome(page, "#" + id); await page.waitForTimeout(700);
      const s = await page.evaluate((id) => {
        const al = (window.ZP_ALIAS || {})[id];
        const sec = document.getElementById(al ? al[0] : id); if (!sec) return { missing: 1 };
        if (al) {
          // 그 탭이 가리키는 칸(aria-controls) — #newTop처럼 칸이 다른 이름이어도. 탭이 없는 #saveTop은 그 칸 자체
          const tab = sec.querySelector(`[role="tab"][data-tab="${al[1]}"]`), pane = document.getElementById(tab ? tab.getAttribute("aria-controls") : id);
          const pr = pane && pane.getBoundingClientRect();
          return { alias: al, hash: location.hash, on: sec.classList.contains("s-on"), paneVis: !!(pane && pane.offsetParent && pr.height > 40 && pane.innerText.trim().length > 40), tabSel: tab ? tab.getAttribute("aria-selected") === "true" : al[1] === "save", inView: pr ? pr.top < innerHeight && pr.bottom > 0 : false, txt: pane ? pane.innerText : "" };
        }
        const hdr = document.getElementById("hdr"), hb = hdr ? hdr.getBoundingClientRect().bottom : 0;
        const back = [...sec.querySelectorAll(".s-back")].find((b) => window.__qc.vis(b));
        const br = back && back.getBoundingClientRect();
        const lv1 = [...document.querySelectorAll("h1, [aria-level='1']")].filter((e) => window.__qc.vis(e)).map((e) => e.textContent.trim().slice(0, 30));
        return { on: sec.classList.contains("s-on"), hb: Math.round(hb), backTop: br ? Math.round(br.top) : null, lv1, len: sec.innerText.trim().length, txt: sec.innerText };
      }, id);
      const where = "#" + id;
      if (s.alias) {
        expect(s.hash === "#" + s.alias[0] && s.on && s.paneVis && s.tabSel && s.inView, "ui.alias", "예전 도구 주소 → 합친 화면 + 그 탭(주소 바뀜·탭 선택·칸 보임)", `${where}: hash ${s.hash} (want #${s.alias[0]}) · s-on ${s.on} · pane visible ${s.paneVis} · tab ${s.alias[1]} selected ${s.tabSel} · in view ${s.inView}`);
        const bt = badText(s.txt); expect(!bt.length, "ui.toolText", "도구 화면 글자 결함 없음(NaN·곳를·–억·겹친 낱말…)", `${where}: ${bt.join(" ; ")}`);
        if (id === "saveTop") { const m = /(?:^|\D)(2[1-9]|[3-9]\d|\d{3})년[^\n]{0,8}뒤/.exec(s.txt); expect(!m, "ui.save20", "모으면 언제?: 20년 넘는 'N년 뒤' 대신 '20년 넘게'", `#saveTop: "${m && m[0]}"`); }
        const o = await page.evaluate(() => window.__qc.overflow()); expect(!o, "ui.overflow", "360px 가로 스크롤 없음(홈·도구 화면마다)", `${where}: ${o}`);
        continue;
      }
      if (s.missing) { bad("ui.deeplink", "도구 딥링크: s-on · 돌아가기 버튼이 머리 밑에 다 보임 · 내용 있음", `${where}: section missing`); continue; }
      expect(s.on && s.len > 40, "ui.deeplink", "도구 딥링크: s-on · 돌아가기 버튼이 머리 밑에 다 보임 · 내용 있음", `${where}: s-on=${s.on} text=${s.len}`);
      expect(s.backTop != null && s.backTop >= s.hb - 1, "ui.deeplink", "도구 딥링크: s-on · 돌아가기 버튼이 머리 밑에 다 보임 · 내용 있음", `${where}: back button top ${s.backTop} vs header bottom ${s.hb}`);
      expect(s.lv1.length >= 1 && s.lv1.length <= 2, "ui.h1", "첫 화면 h1 정확히 하나 · 도구 화면마다 1단계 제목", `${where}: level-1 headings visible: ${s.lv1.length} [${s.lv1.join(" | ")}]`);
      const o = await page.evaluate(() => window.__qc.overflow()); expect(!o, "ui.overflow", "360px 가로 스크롤 없음(홈·도구 화면마다)", `${where}: ${o}`);
      const bt = badText(s.txt); expect(!bt.length, "ui.toolText", "도구 화면 글자 결함 없음(NaN·곳를·–억·겹친 낱말…)", `${where}: ${bt.join(" ; ")}`);
      if (id === "saveTop") { const m = /(?:^|\D)(2[1-9]|[3-9]\d|\d{3})년[^\n]{0,8}뒤/.exec(s.txt); expect(!m, "ui.save20", "모으면 언제?: 20년 넘는 'N년 뒤' 대신 '20년 넘게'", `#saveTop: "${m && m[0]}"`); }
      domTexts.push([id, await page.evaluate(() => window.__qc.domText())]);
    }
    // 용어: 도구를 다 본 뒤 앱 DOM 글자(숨은 것 포함)에 '입주까지 총' 없음, 진행 중 N곳은 하나
    {
      const hits = domTexts.filter(([, t]) => /입주까지 총/.test(t)).map(([id, t]) => `#${id}: "${(t.match(/.{0,20}입주까지 총.{0,12}/) || [""])[0].replace(/\n/g, " ")}"`);
      expect(!hits.length, "term.app", "앱 화면에 '입주까지 총' 없음(같은 숫자는 '입주까지 현금')", hits.slice(0, 4).join(" ; "));
      const live = await page.evaluate(() => (window.ZP_zones || {}).live);
      const counts = new Map();
      for (const [id, t] of domTexts) for (const m of t.replace(/,/g, "").matchAll(/진행 중(?: 정비사업)? (\d+)곳/g)) counts.set(+m[1], (counts.get(+m[1]) || "") + " #" + id);
      for (const [p, n] of shared.liveCounts || []) counts.set(n, (counts.get(n) || "") + " " + p);
      const wrong = [...counts.entries()].filter(([n]) => n !== live && n !== api.zones.length);
      expect(live === api.zones.length && !wrong.length, "count.live", "'진행 중 N곳'이 어디서나 하나(ZP_zones.live == /api count)", `ZP_zones.live ${live} · api ${api.zones.length} · other: ${wrong.map(([n, w]) => `${n}곳@${w.trim().slice(0, 60)}`).join(" ; ")}`);
      const bad2 = domTexts.map(([id, t]) => [id, badText(t).filter((x) => !/겹친 낱말/.test(x))]).filter(([, b]) => b.length);
      expect(!bad2.length, "ui.domText", "앱 DOM 전체 글자(숨은 화면 포함) 결함 없음", bad2.slice(0, 3).map(([id, b]) => `#${id}: ${b.slice(0, 2).join(" ; ")}`).join(" | "));
    }
    // 내 핀(핀 3곳 꽂은 상태): 정렬 칩·'공유 이미지에 금액 넣기' 눌리는 상자 40px 이상(체크박스는 감싼 label 크기로)
    if (!over()) {
      const ids = api.zones.slice(0, 3).map((z) => z.id);
      await page.evaluate((ids) => { try { localStorage.setItem("jg-fav", JSON.stringify(ids)); } catch (e) {} }, ids);
      await loadHome(page, "#favTop"); await page.waitForTimeout(1200);
      const t = await page.evaluate(() => { const out = []; const root = document.getElementById("favTop"); if (!root) return ["#favTop missing"]; for (const el of root.querySelectorAll("button, a[href], label, [role=button]")) { if (!window.__qc.vis(el) || el.closest("[hidden],.pn-ov")) continue; const cs = getComputedStyle(el); if (cs.display === "inline" && el.tagName === "A") continue; if (el.tagName === "LABEL" && !el.querySelector("input")) continue; const r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 40) out.push(`${window.__qc.sel(el)} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 16)}" ${Math.round(r.width)}×${Math.round(r.height)}`); } return [...new Set(out)]; });
      expect(!t.length, "ui.touchFav", "내 핀 화면 터치 타깃 40px 이상(정렬 칩·금액 넣기 체크 줄)", `${t.length} small: ${t.slice(0, 5).join(" ; ")}`);
      await page.evaluate(() => { try { localStorage.removeItem("jg-fav"); } catch (e) {} });
    }
    // 망가진 핀 링크: 알려 줌
    if (!over()) {
      await loadHome(page, "#pins=garbage!!"); await page.waitForTimeout(1200);
      const t = await page.evaluate(() => document.body.innerText);
      expect(/손상|잘못된 링크|열 수 없/.test(t), "ui.pinsBad", "망가진 #pins= 링크에 '링크가 손상됐어요' 안내", "no feedback for malformed #pins= link");
    }
  } catch (e) { bad("runtime", "검사 실행", "uiLane crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await ctx.close().catch(() => {}); }
}

// ================================================================ 5) 검색·역·이름·데스크톱
async function mapLane(browser, api, errs, shortSrc) {
  const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, errs);
  try {
    await loadHome(page); await page.waitForTimeout(500);
    // 이름: shortName()이 진행 중 구역끼리 겹치지 않음(같은 동 안 겹침만 허용)
    if (shortSrc) {
      const live = api.zones.map((z) => z.id);
      const r = await page.evaluate(({ src, live }) => {
        let sn; try { sn = new Function("R", "walkM", src + "\nreturn shortName;")(window.__ZPD.recs, null); } catch (e) { return { err: "eval: " + e.message }; }
        const by = new Map(window.__ZPD.recs.map((r) => [r.id, r])); const g = new Map();
        for (const id of live) { const r = by.get(id); if (!r || !r.n) continue; const k = sn(r.n); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
        const dn = (r) => (r.bj || r.j || "").split(" ")[0];
        const dup = [], same = [];
        g.forEach((rs, k) => { if (rs.length < 2) return; const d = new Set(rs.map(dn)); (d.size < rs.length ? same : dup).push(`${k}: ${rs.map((r) => r.id + "(" + dn(r) + ")").join(", ")}`); });
        return { n: g.size, dup, same };
      }, { src: shortSrc, live });
      if (r.err) bad("name.unique", "shortName() 진행 중 구역끼리 겹치지 않음(같은 동 쌍만 허용)", r.err);
      else { expect(!r.dup.length, "name.unique", "shortName() 진행 중 구역끼리 겹치지 않음(같은 동 쌍만 허용)", `${r.dup.length} colliding names: ${r.dup.slice(0, 5).join(" ; ")}`); if (r.same.length) wrn("name.unique", "shortName() 진행 중 구역끼리 겹치지 않음(같은 동 쌍만 허용)", `same-동 pairs (allowed): ${r.same.slice(0, 4).join(" ; ")}`); }
    } else skip("name.unique", "shortName() 진행 중 구역끼리 겹치지 않음(같은 동 쌍만 허용)", "src/app.js shortName not found");
    // 검색: 결과 이름 겹침 없음, '이름에 X' 묶음은 X를 포함, 완료 구역은 맨 앞이 아님
    for (const q of ["강남", "광흥창역", "봉천역"]) {
      await page.evaluate(() => { document.getElementById("sSearch").click(); }); await page.waitForTimeout(300);
      await page.fill("#q", ""); await page.fill("#q", q); await page.waitForTimeout(700);
      const s = await page.evaluate(() => { const box = document.getElementById("sugg"); const items = []; let head = ""; for (const el of box.children) { if (el.classList.contains("x-h")) head = el.textContent.trim(); else if (el.getAttribute("role") === "option") items.push({ head, id: el.dataset.id || "", stn: el.dataset.stn || "", name: ((el.querySelector("span") || el).childNodes[el.querySelector("span svg") ? 1 : 0] || {}).textContent || el.textContent, sub: (el.querySelector("small") || {}).textContent || "" }); } return items; });
      const zs = s.filter((x) => x.id);
      const names = zs.map((x) => x.name.trim() + "|" + x.sub.split("·")[0].trim());
      const dups = names.filter((n, i) => names.indexOf(n) !== i);
      expect(!dups.length, "search.dup", "검색 결과에 같은 구역 두 번 없음", `"${q}": ${dups.slice(0, 3).join(", ")}`);
      const wrongHead = zs.filter((x) => { const m = /이름에 '(.+)'/.exec(x.head); return m && !x.name.includes(m[1]); });
      expect(!wrongHead.length, "search.head", "'이름에 X' 묶음의 결과 이름은 X를 포함", `"${q}": ${wrongHead.slice(0, 3).map((x) => x.name).join(", ")}`);
      if (q === "강남" && zs.length) expect(!/완료|준공/.test(zs[0].name + zs[0].sub), "search.done", "검색 첫 결과가 완료 구역이 아님", `"강남" first result: ${zs[0].name} ${zs[0].sub}`);
      await page.keyboard.press("Escape").catch(() => {}); await page.waitForTimeout(200);
    }
    // 역 고르기 → 지도 확대 · 역 가까이
    for (const stn of STATIONS) {
      await loadHome(page); await page.waitForTimeout(400);
      await page.evaluate(() => document.getElementById("sSearch").click()); await page.waitForTimeout(300);
      await page.fill("#q", stn); await page.waitForFunction(() => document.querySelector("#sugg [data-stn]"), null, { timeout: 4000, polling: 100 }).catch(() => {});
      const clicked = await page.evaluate((stn) => { const b = [...document.querySelectorAll("#sugg [data-stn]")].find((x) => x.dataset.stn === stn) || document.querySelector("#sugg [data-stn]"); if (!b) return false; b.click(); return true; }, stn);
      const ST = "역 고르면 지도가 z≥14(걸어서 10분 원 전체)로 역 300m 안에 — 첫 맞춤과 겹쳐도";
      if (!clicked) { bad("map.station", ST, `${stn}: no station row in search`); continue; }
      // 비행이 끝나고 지도가 멈출 때까지(최대 6초) 기다린 뒤, 0.8초 더 지나도 그 자리인지(첫 맞춤이 뒤늦게 끼어들지 않는지) 본다
      const rd = () => page.evaluate((stn) => { const L = window.ZP_lmx, m = L && L.map && L.map(); const st = (window.__ZPD.stations || []).find((s) => s[0] === stn); if (!m) return { nomap: 1 }; const c = m.getCenter(); return { z: m.getZoom(), lat: c.lat, lng: c.lng, st, mv: m.isMoving() }; }, stn);
      let r = null; const t0 = Date.now();
      await page.waitForTimeout(1200);
      while (Date.now() - t0 < 6000) { r = await rd(); if (r.nomap || (!r.mv && r.st && r.z >= 14 && hav(r.lat, r.lng, r.st[1], r.st[2]) <= 300)) break; await page.waitForTimeout(250); }
      await page.waitForTimeout(800); r = await rd();
      if (r.nomap || !r.st) { bad("map.station", ST, `${stn}: map ${r.nomap ? "missing" : "ok"} station ${r.st ? "ok" : "missing"}`); continue; }
      const d = hav(r.lat, r.lng, r.st[1], r.st[2]);
      // 줌 하한 14: 역을 고르면 '걸어서 10분' 원이 화면 안에 다 들어오고(15분 원은 가장자리 밖으로 나갈 수 있음) 390px 폰에서 약 14.4(10_lmap.js stnGo)
      expect(r.z >= 14 && d <= 300, "map.station", ST, `${stn}: zoom ${r.z.toFixed(2)} · center ${Math.round(d)}m from station`);
    }
  } catch (e) { bad("runtime", "검사 실행", "mapLane crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await ctx.close().catch(() => {}); }
  // 데스크톱: 곳 수·딥링크 줌·초점
  const D = await newPage(browser, { viewport: { width: 1440, height: 900 } }, errs);
  try {
    const page2 = D.page;
    await loadHome(page2); await settle(page2, 500);
    for (const [mode, c] of [["gap", 6], ["cash", 6]]) {
      await setMode(page2, mode); await setCash(page2, c);
      const s = await page2.evaluate(() => ({ sN: document.getElementById("sN").textContent, sLT: document.getElementById("sLT").textContent, rt: (document.getElementById("resTitle") || {}).textContent, zc: window.ZP_count() }));
      const v = [intOf(s.sN), cntOf(s.sLT), cntOf(s.rt), s.zc];
      expect(new Set(v).size === 1, mode === "gap" ? "count.gap" : "count.loan", mode === "gap" ? "전세 끼고: 첫 화면 == ZP_count == 입주 계산 #resTitle == 목록 제목 == 작은 막대 == /api gapNow" : "대출 끼고: 첫 화면 == ZP_count == 입주 계산 #resTitle == 목록 제목 == 작은 막대", `desktop ${mode} ${c}억: hero/list/planner/ZP_count = ${v.join("/")}`);
    }
    { const o = await page2.evaluate(() => window.__qc.overflow()); expect(!o, "ui.overflowDesk", "1440px 가로 스크롤 없음", `desktop home: ${o}`); }
    await loadHome(page2, "#o1059"); await page2.waitForTimeout(2500);
    const r = await page2.evaluate(() => { const m = window.ZP_lmx && window.ZP_lmx.map && window.ZP_lmx.map(); const a = document.activeElement; return { z: m ? m.getZoom() : null, focus: a ? (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 20) : "" }; });
    if (r.z != null) expect(r.z <= 16.01, "map.deepZoom", "구역 딥링크 줌 ≤ 16(대략 범위 구역 과확대 금지)", `desktop #o1059 zoom ${r.z.toFixed(2)}`);
    expect(!/^닫기$/.test(r.focus), "ui.focus", "구역 딥링크로 열면 초점이 '닫기'가 아닌 제목에", `desktop #o1059 focus on "${r.focus}"`);
  } catch (e) { bad("runtime", "검사 실행", "desktop crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await D.ctx.close().catch(() => {}); }
}

// ================================================================ 5b) 데스크톱 상세·대비·소식 (1440) — 2번 줄이 길어 1번 줄 끝에서 돈다
async function deskLane(browser, errs) {
  const D = await newPage(browser, { viewport: { width: 1440, height: 900 } }, errs);
  const page2 = D.page;
  try {
    // PC 상세: 칸 안 스크롤 없이 페이지와 함께 흐름 · 딥링크로 열면 상세 머리가 머리줄 바로 밑 · 휠은 페이지를 내림
    {
      const T = "PC 상세는 칸 안에서 따로 스크롤하지 않음 · 딥링크 열면 상세 머리가 머리줄 밑 · 휠이 페이지를 내림";
      await loadHome(page2, "#o337"); await page2.waitForTimeout(2200);
      const a = await page2.evaluate(() => { const e = document.getElementById("report"), cs = getComputedStyle(e), h = document.getElementById("hdr").getBoundingClientRect().bottom; return { ov: cs.overflowY, sh: e.scrollHeight, ch: e.clientHeight, top: Math.round(e.getBoundingClientRect().top), hb: Math.round(h), y: Math.round(scrollY) }; });
      expect(!((a.ov === "auto" || a.ov === "scroll") && a.sh > a.ch + 2), "ui.repFlow", T, `#report overflow-y ${a.ov} scrollHeight ${a.sh} > clientHeight ${a.ch}`);
      expect(a.top >= a.hb - 2 && a.top <= a.hb + 120, "ui.repFlow", T, `#o337 deep link: report top ${a.top} vs header bottom ${a.hb} (scrollY ${a.y})`);
      // 휠은 페이지를 내린다(딥링크 직후 지도 그리기로 바쁘면 늦게 반영될 수 있어 최대 8초 기다림)
      await page2.mouse.move(1100, 600); await page2.mouse.wheel(0, 600);
      await page2.waitForFunction((y) => scrollY > y + 300, a.y, { timeout: 8000, polling: 100 }).catch(() => {});
      const y2 = await page2.evaluate(() => scrollY);
      expect(y2 > a.y + 300, "ui.repFlow", T, `wheel over report: page scrollY ${a.y} → ${Math.round(y2)}`);
      // 목록 → 상세 → Esc: 열기 전 보던 자리로
      await loadHome(page2); await settle(page2, 400);
      await page2.evaluate(() => scrollTo(0, 700)); await page2.waitForTimeout(300);
      const y0 = await page2.evaluate(() => scrollY);
      const bb = await page2.evaluate(() => { const a = [...document.querySelectorAll("#sList [data-id]")].find((e) => { const b = e.getBoundingClientRect(); return b.top > 90 && b.bottom < innerHeight - 10; }); if (!a) return null; const b = a.getBoundingClientRect(); return { x: b.x + 30, y: b.y + b.height / 2 }; });
      if (bb) {
        await page2.mouse.click(bb.x, bb.y); await page2.waitForTimeout(1200);
        await page2.keyboard.press("Escape"); await page2.waitForTimeout(700);
        const y3 = await page2.evaluate(() => [scrollY, document.documentElement.classList.contains("s-rep")]);
        expect(!y3[1] && Math.abs(y3[0] - y0) <= 30, "ui.repBack", "PC 목록 → 상세 → Esc 하면 열기 전 스크롤 자리로", `scrollY before ${Math.round(y0)} → after Esc ${Math.round(y3[0])} (s-rep ${y3[1]})`);
      } else skip("ui.repBack", "PC 목록 → 상세 → Esc 하면 열기 전 스크롤 자리로", "no visible list row at scrollY 700");
    }
    // 입주 계산(#planner) 글자 대비 4.5:1(큰 글자 3:1) — 밝은·어두운 화면
    for (const scheme of ["light", "dark"]) {
      await page2.emulateMedia({ colorScheme: scheme });
      await loadHome(page2, "#planner"); await page2.waitForTimeout(1200);
      const c = await page2.evaluate(CONTRAST_JS, "#planner");
      expect(!c.length, "ui.contrast", "입주 계산(#planner) 글자 대비 4.5:1 이상(밝은·어두운)", `${scheme}: ${c.length} low: ${c.slice(0, 4).join(" ; ")}`);
    }
    await page2.emulateMedia({ colorScheme: "light" });
    // 소식(단계 소식): 정비사업 정보몽땅 고시·공고에 올라온 가장 새 인가(신청·공람 제외)가 그 날짜로 목록에 있음 — 예전 #newTop 주소로 열어 본다
    {
      const nt = await get(BASE + "/data/notice.json");
      let it = null; try { const j = JSON.parse(nt.text); it = (j.items || []).filter((x) => x[4] === "ok" && /인가|지정|승인/.test(x[2]) && !/신청|공람/.test(x[3])).sort((a, b) => (a[0] < b[0] ? 1 : -1))[0]; } catch (e) {}
      if (it) {
        await loadHome(page2, "#newTop"); await page2.waitForTimeout(1500);
        const t = await page2.evaluate(() => { const o = document.getElementById("ntcOut"); if (!o) return ""; o.querySelectorAll("[hidden]").forEach((x) => x.removeAttribute("hidden")); return o.innerText || ""; });
        const day = it[0].slice(2).replaceAll("-", ".");
        expect(t.includes(day) && /단계 변경/.test(t), "ui.newTop", "소식(#news, 예전 #newTop)에 고시·공고의 가장 새 인가가 그 날짜로 들어감 · '단계 변경' 표시", `newest notice ${it[0]} ${it[2]} (${it[1]}) — #ntcOut ${t ? `has no "${day}"` : "empty"}${/단계 변경/.test(t) ? "" : " · no '단계 변경' rows"}`);
      } else skip("ui.newTop", "소식(#news, 예전 #newTop)에 고시·공고의 가장 새 인가가 그 날짜로 들어감 · '단계 변경' 표시", "no notice item");
    }
  } catch (e) { bad("runtime", "검사 실행", "deskLane crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await D.ctx.close().catch(() => {}); }
}


// ================================================================ 6) 14회차 결함(알림 켜기·코치·용어·역 15분·대비·리포트 제목·섬·검색 겹침·출퇴근·입주 계산·핀 글자·PC 지도/목록·정렬·갭 순위)
const PUSH_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
async function r14Lane(browser, api, errs) {
  const M = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
  // --- 폰 알림 켜기: 구독은 되지만 서버(POST /api/push/sub)가 답하지 않으면 8초 안에 버튼을 되돌리고 이유를 말한다 · 성공 토스트 없음
  {
    const T = "폰 알림 켜기: 서버가 답 안 하면 8초 안에 '켜는 중…'에서 풀리고 이유 표시 · 성공 토스트 없음 · 조건 저장 토스트는 '알림 켰어요'가 아님";
    const ctx = await browser.newContext({ ...M, serviceWorkers: "allow" });
    try {
      await ctx.route(BLOCK, (r) => r.abort());
      await ctx.grantPermissions(["notifications"], { origin: BASE });
      await ctx.route("**/api/push/key", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: PUSH_KEY }) }));
      await ctx.route("**/api/push/sub", () => {});
      await ctx.addInitScript(IN_PAGE);
      await ctx.addInitScript(() => { try { localStorage.setItem("emr.coach1", "1"); PushManager.prototype.getSubscription = () => Promise.resolve(null); PushManager.prototype.subscribe = () => Promise.resolve({ endpoint: "https://x.invalid/1", options: {}, toJSON() { return { endpoint: "https://x.invalid/1" }; } }); } catch (e) {} });
      const page = await ctx.newPage(); page.__where = "/ (push)";
      page.on("pageerror", (e) => errs.push({ where: "/ (push)", msg: "pageerror: " + (e.message || String(e)).split("\n")[0].slice(0, 200) }));
      await loadHome(page); await settle(page, 500);
      await page.click("#pcSave .pc-al").catch(() => {});
      await page.waitForTimeout(300);
      const tt = await page.evaluate(() => (document.getElementById("pnToast") || {}).textContent || "");
      expect(!/알림 켰어요/.test(tt), "ui.push", T, `조건 저장 토스트 "${tt.slice(0, 40)}"`);
      const on = await page.waitForSelector("#wsSheet [data-wson]", { timeout: 6000 }).catch(() => null);
      if (!on) skip("ui.push", T, "push button not shown");
      else {
        await on.click(); const t0 = Date.now();
        await page.waitForFunction(() => document.querySelector("#wsSheet [data-wsmsg]") || !document.getElementById("wsSheet"), null, { timeout: 12000, polling: 200 }).catch(() => {});
        const r = await page.evaluate(() => { const s = document.getElementById("wsSheet"), b = s && s.querySelector("[data-wson]"), m = s && s.querySelector("[data-wsmsg]"); return { open: !!s, btn: b ? b.textContent : "", hid: b ? b.hidden : true, dis: b ? b.disabled : false, msg: m ? m.textContent : "", ok: [...document.querySelectorAll(".ib-toast")].map((x) => x.textContent).join("|") }; });
        expect(r.open && !/켜는 중/.test(r.hid ? "" : r.btn) && !r.dis && /켤 수 없|알림함/.test(r.msg) && Date.now() - t0 < 11000, "ui.push", T, `after ${Date.now() - t0}ms: btn "${r.btn}" hidden ${r.hid} disabled ${r.dis} msg "${r.msg}"`);
        expect(!/폰 알림 켰어요/.test(r.ok), "ui.push", T, `success toast shown without server: "${r.ok}"`);
      }
    } catch (e) { bad("ui.push", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- 코치: 앱이 붙기 전(섬)에 게이지를 끌었으면 붙은 뒤 '끌어서 맞춰 보세요'가 뜨지 않음
  {
    const T = "섬에서 게이지를 끌었으면 앱이 붙은 뒤 코치 말풍선 없음";
    const ctx = await browser.newContext({ ...M, serviceWorkers: "block" });
    try {
      await ctx.route(BLOCK, (r) => r.abort());
      await ctx.route(/\/a\.[^/]*\.js$/, async (r) => { await new Promise((ok) => setTimeout(ok, 2500)); r.continue().catch(() => {}); });
      const page = await ctx.newPage();
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(300);
      const bb = await (await page.$("#sCash")).boundingBox();
      await page.mouse.move(bb.x + bb.width * 0.08, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + bb.width * 0.35, bb.y + bb.height / 2, { steps: 5 }); await page.mouse.up();
      await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const c = await page.evaluate(() => !!document.querySelector(".s-coach"));
      expect(!c, "ui.coach", T, "coach bubble shown after island drag");
    } catch (e) { bad("ui.coach", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  const { ctx, page } = await newPage(browser, M, errs);
  try {
    await loadHome(page); await settle(page, 500);
    // 용어: '내 핀' 없음(도구 목록·⋯ 메뉴·소식 칩·하단 탭) · 홈 알림 카드 문구가 줄 끝 한 낱말로 남지 않게(text-wrap balance)
    {
      const r = await page.evaluate(() => ({ t: window.__qc.domText(), tools: (window.ZP_TOOLS || []).map((x) => x[1]).join(","), wrap: (() => { const b = document.querySelector("#pcSave .pc-al-t b"); return b ? getComputedStyle(b).textWrap || getComputedStyle(b).textWrapStyle || "" : "none"; })() }));
      const m = r.t.match(/.{0,16}내 핀.{0,12}/);
      expect(!m && !/내 핀/.test(r.tools), "term.pin", "용어 '내 핀' 없음 → '관심 구역'(행동은 '핀 꽂고 알림 받기')", m ? `"${m[0]}"` : `ZP_TOOLS ${r.tools}`);
      expect(/balance/.test(r.wrap), "ui.alertWrap", "홈 알림 카드 문구 text-wrap: balance(외톨이 낱말 없음)", `text-wrap ${r.wrap}`);
    }
    // 정렬: 홈 목록·입지 순위에 '입주까지 현금 적은 순'·'입주 때 시세 차이 큰 순' · 목록 시세 선에 이름(aria-label)
    {
      const r = await page.evaluate(() => ({ s: [...document.querySelectorAll("#sSort option")].map((o) => o.value), rk: [...document.querySelectorAll("#rSort option")].map((o) => o.value), sp: [...document.querySelectorAll("#sList .s-sp")].filter((x) => !x.getAttribute("aria-label")).length }));
      expect(r.s.includes("move") && r.s.includes("gain") && r.rk.includes("move") && r.rk.includes("gain"), "list.sorts", "정렬에 입주까지 현금 적은 순·입주 때 시세 차이 큰 순(홈 목록·입지 순위)", `sSort [${r.s}] rSort [${r.rk}]`);
      expect(!r.sp, "list.spark", "목록 시세 선에 이름(aria-label·글자 '시세'/'1년▲N%')", `${r.sp} unlabeled sparklines`);
    }
    // 입주 계산 ①②③: 360에서 한 줄씩(칸이 좁아 머리가 두 줄·좁고 긴 글 덩어리 없음)
    {
      await loadHome(page, "#planner"); await page.waitForTimeout(900);
      const r = await page.evaluate(() => { const l = document.querySelector(".ptl"); if (!l) return null; const w = l.getBoundingClientRect().width; return [...l.querySelectorAll(".pt")].map((p) => [Math.round(p.getBoundingClientRect().width / w * 100), Math.round(p.querySelector(".pt-k").getBoundingClientRect().height)]); });
      if (r) expect(r.every(([pct, kh]) => pct >= 95 && kh <= 26), "ui.planner", "입주 계산 답 ①②③: 360에서 한 줄씩 쌓임 · 머리 한 줄", JSON.stringify(r)); else skip("ui.planner", "입주 계산 답 ①②③: 360에서 한 줄씩 쌓임 · 머리 한 줄", "no .ptl");
    }
    // 출퇴근: 이름 말줄임 없이 두 줄까지
    {
      await loadHome(page, "#commuteTop"); await page.waitForTimeout(1200);
      const r = await page.evaluate(() => [...document.querySelectorAll("#commuteTop .cm-n")].filter((b) => b.offsetWidth).map((b) => ({ ws: getComputedStyle(b).whiteSpace, cut: b.scrollHeight > b.clientHeight + 1 || (getComputedStyle(b).whiteSpace === "nowrap" && b.scrollWidth > b.clientWidth + 1), t: b.textContent })));
      const badN = r.filter((x) => x.ws === "nowrap" || x.cut);
      expect(r.length && !badN.length, "ui.commuteName", "출퇴근 결과 이름이 말줄임 없이 두 줄까지(360)", r.length ? badN.slice(0, 3).map((x) => `"${x.t}" ws ${x.ws}`).join(" ; ") : "no .cm-n");
    }
    // 핀 꽂기 토스트가 '실행 취소' 밑으로 넘치지 않음 · 관심 구역 카드 '대출 1.8억'(붙여 쓰기 없음)
    {
      await loadHome(page, "#o281"); await page.waitForTimeout(1800);
      const b = await page.$(".sheet-bar .pn-hpin, .rep-t .pn-hpin");
      if (b) {
        await b.click().catch(() => {}); await page.waitForTimeout(500);
        const o = await page.evaluate(() => { const t = document.getElementById("pnToast"); if (!t || !t.classList.contains("on")) return null; return [...t.querySelectorAll("b,small,span")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible" || e.getBoundingClientRect().right > t.querySelector("button").getBoundingClientRect().left + 1 && e.closest(".pn-tt")).map((e) => e.className + ":" + e.textContent.slice(0, 20)); });
        if (o) expect(!o.length, "ui.pinToast", "핀 꽂기 토스트 글자가 '실행 취소' 단추 밑으로 넘치지 않음(360)", o.join(" ; ")); else skip("ui.pinToast", "핀 꽂기 토스트 글자가 '실행 취소' 단추 밑으로 넘치지 않음(360)", "no toast");
        await loadHome(page, "#favTop"); await page.waitForTimeout(1200);
        const ft = await page.evaluate(() => (document.getElementById("fvOut") || {}).innerText || "");
        const m = ft.match(/.{0,8}(?:대출|전세)\d.{0,6}/);
        expect(!m, "term.pinAmt", "관심 구역 카드 '대출 1.8억'(방식과 금액 사이 띄어쓰기)", m ? `"${m[0]}"` : "");
        await page.evaluate(() => { try { localStorage.removeItem("jg-fav"); } catch (e) {} });
      } else skip("ui.pinToast", "핀 꽂기 토스트 글자가 '실행 취소' 단추 밑으로 넘치지 않음(360)", "no pin button");
    }
    // 받은 핀 링크 미리보기: '관심 구역 N곳 가져올까요?' + 알림 조건·메모 개수
    {
      const js = JSON.stringify([1, [[api.zones[0].id, 0, 0, null, 0, null, 0, "메모1"], [api.zones[1].id, 0, 0, null, 0, null, 0, "메모2"], [api.zones[2].id]], [["", 3, 1]]]);
      const h = "#pins=j" + Buffer.from(js).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      await loadHome(page, h); await page.waitForTimeout(1200);
      const t = await page.evaluate(() => (document.getElementById("pnImp") || {}).innerText || "");
      expect(/관심 구역 3곳 가져올까요/.test(t) && /알림 조건 1개/.test(t) && /메모 2개/.test(t) && !/핀 3곳/.test(t), "ui.pinsImport", "받은 #pins= 링크 미리보기: '관심 구역 3곳 가져올까요?' · 알림 조건·메모 개수", `"${t.replace(/\n+/g, " / ").slice(0, 140)}"`);
    }
  } catch (e) { bad("runtime", "검사 실행", "r14Lane(360) crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await ctx.close().catch(() => {}); }
  // --- 390: 역 15분(검색 머리 == 줄 수 == 지도 안내) · 같은 이름·지번 줄 두 번 없음
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, errs);
    try {
      for (const stn of ["왕십리역", "신림역"]) {
        await loadHome(page); await page.waitForTimeout(400);
        await page.evaluate(() => document.getElementById("sSearch").click()); await page.waitForTimeout(250);
        await page.fill("#q", stn); await page.waitForTimeout(800);
        const s = await page.evaluate(() => { const box = document.getElementById("sugg"); let head = "", near = 0, inNear = false; const lab = []; for (const el of box.children) { if (el.classList.contains("x-h")) { head = head || el.textContent; inNear = el.hasAttribute("data-walk"); continue; } if (el.dataset && el.dataset.id) { if (inNear) near++; const sp = el.querySelector("span"); lab.push(sp ? sp.textContent.replace(/\s+/g, " ").trim() : el.textContent); } } const h = box.querySelector("[data-walk]"); return { head: h ? h.textContent : "", n: h ? +h.dataset.walk : null, near, lab }; });
        const d = s.lab.filter((x, i) => s.lab.indexOf(x) !== i);
        expect(!d.length, "search.label", "검색 결과에 이름·지번·단계가 똑같은 줄 두 번 없음(행당동 300-1)", `"${stn}": ${d.slice(0, 3).join(" ; ")}`);
        if (s.n != null) {
          expect(s.n === s.near || (s.n > 8 && s.near === 8), "map.walk15", "역 '걸어서 15분 안 N곳' 하나(검색 머리 == 그 아래 줄 수 == 지도 안내)", `"${stn}": head "${s.head}" vs rows ${s.near}`);
          const ok2 = await page.evaluate(() => { const b = document.querySelector("#sugg [data-stn]"); if (!b) return false; b.click(); return true; });
          if (ok2) {
            await page.waitForTimeout(3600);
            const nt = await page.evaluate(() => { const n = document.querySelector(".lm-snote"); return n && !n.hidden ? { t: n.textContent, w: +n.dataset.walk } : null; });
            if (nt && nt.w) expect(nt.w === s.n && nt.t.includes(s.head.replace(/ \(.*$/, "")), "map.walk15", "역 '걸어서 15분 안 N곳' 하나(검색 머리 == 그 아래 줄 수 == 지도 안내)", `"${stn}": map "${nt.t}" vs search "${s.head}"`);
          }
        }
      }
    } catch (e) { bad("runtime", "검사 실행", "r14Lane(390) crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- 1440: 소식 대비(밝은) · 리포트 제목 · PC 지도/목록 아래 끝 · 갭 순위 모집단 == 홈 분모 · o776 실거래 카드 표본 하나
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 1440, height: 900 } }, errs);
    try {
      await loadHome(page); await settle(page, 600);
      await page.waitForTimeout(1500);
      const a = await page.evaluate(() => { const m = document.getElementById("mapbox"), l = document.getElementById("sListW"); if (!m || !l) return null; scrollTo(0, m.getBoundingClientRect().top + scrollY - 90); return null; });
      await page.waitForTimeout(600);
      const al = await page.evaluate(() => { const m = document.getElementById("mapbox").getBoundingClientRect(), l = document.getElementById("sListW").getBoundingClientRect(); return [Math.round(m.bottom), Math.round(l.bottom)]; });
      expect(Math.abs(al[0] - al[1]) <= 6, "ui.deskAlign", "PC 목록 칸 아래 끝 == 지도 아래 끝(±6px)", `map bottom ${al[0]} vs list bottom ${al[1]}`);
      const cap = await page.evaluate(() => { const t = (document.getElementById("sNL") || {}).textContent || ""; const m = /전세 시세 있는 ([\d,]+)곳/.exec(t); return m ? +m[1].replace(/,/g, "") : null; });
      await loadHome(page, "#gapTop"); await page.waitForTimeout(1200);
      const gn = await page.evaluate(() => { const e = document.querySelector("#gapTopOut [data-gapn]"); return e ? +e.dataset.gapn : null; });
      if (cap != null && gn != null) expect(gn === cap, "count.gapRank", "갭 순위 모집단 == 홈 '전세 시세 있는 N곳 중'(같은 판정)", `gap rank ${gn} vs home ${cap}`); else skip("count.gapRank", "갭 순위 모집단 == 홈 '전세 시세 있는 N곳 중'(같은 판정)", `cap ${cap} gn ${gn}`);
      await page.emulateMedia({ colorScheme: "light" });
      await loadHome(page, "#news"); await page.waitForTimeout(1500);
      const c = await page.evaluate(CONTRAST_JS, "#ntcTop");
      expect(!c.length, "ui.contrastNews", "소식(#news) 글자 대비 4.5:1 이상(밝은)", `${c.length} low: ${c.slice(0, 4).join(" ; ")}`);
      const chip = await page.evaluate(() => [...document.querySelectorAll("#ntcF button")].map((b) => b.textContent).join("|"));
      expect(!/내 핀/.test(chip), "term.pin", "용어 '내 핀' 없음 → '관심 구역'(행동은 '핀 꽂고 알림 받기')", `#news chips ${chip}`);
      await loadHome(page, "#o281"); await page.waitForTimeout(2200);
      const rt = await page.evaluate(() => { const h = document.getElementById("repTitle"), t = h && h.closest(".rep-t"), tn = h && h.parentElement; if (!h) return null; const lh = parseFloat(getComputedStyle(h).lineHeight) || 28; return { txt: h.textContent, wb: getComputedStyle(h).wordBreak, lines: Math.round(h.getBoundingClientRect().height / lh), full: t ? Math.round(tn.getBoundingClientRect().width / t.getBoundingClientRect().width * 100) : 0 }; });
      if (rt) expect(!/\d-\d/.test(rt.txt) && rt.wb === "keep-all" && rt.lines <= 2 && rt.full >= 95, "zone.title", "리포트 제목: 지번 '-'에서 안 끊김(U+2011·keep-all) · PC 제목 줄 전체 폭 · 2줄 이하", JSON.stringify(rt)); else bad("zone.title", "리포트 제목: 지번 '-'에서 안 끊김(U+2011·keep-all) · PC 제목 줄 전체 폭 · 2줄 이하", "no #repTitle");
      if (api.zones.some((z) => z.id === "o776")) {
        await loadHome(page, "#o776"); await page.waitForTimeout(2600);
        const tx = await page.evaluate(() => { const c = document.querySelector("#ovTop .ov-tx"), tr = document.querySelector("#ovTop .ov-trust"); return { c: c ? c.innerText : "", tr: tr ? tr.innerText : "" }; });
        const near = /주변 \d+m 빌라/.test(tx.tr);
        expect(!(near && /같은 동\(.*\) 빌라 매매/.test(tx.c)), "zone.sample", "리포트 큰 숫자·계산 매수가·'믿어도 될까'가 같은 표본 n건", `o776 실거래 카드 "${tx.c.replace(/\n+/g, " / ").slice(0, 90)}" vs 믿어도 "${tx.tr.replace(/\n+/g, " / ").slice(0, 60)}"`);
      }
    } catch (e) { bad("runtime", "검사 실행", "r14Lane(1440) crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
}
// ================================================================ main
(async () => {
  // API
  const [cash, zones] = await Promise.all([get(BASE + "/api/v1/cash.json"), get(BASE + "/api/v1/zones.json")]);
  let api;
  try { const z = JSON.parse(zones.text); api = { cash: JSON.parse(cash.text), zones: z.items, updated: z.updated }; }
  catch (e) { console.error("cannot read /api/v1 (" + BASE + "): " + e.message + " — is the server up?  python3 -m http.server 8765 -d public"); process.exit(2); }
  // shortName 원본(읽기만)
  let shortSrc = null;
  try {
    const s = fs.readFileSync(SRC_APP, "utf8"); const a = s.indexOf("const NAME_TAIL"), b = s.indexOf("function shortName0(", a), e = s.indexOf("\n  }\n", b);
    if (a > 0 && b > a && e > b) shortSrc = s.slice(a, e + 4).replace(/^const NAME_TAIL/, "const NAME_TAIL");
  } catch (e) {}
  // 표본 구역: 고정 + 전세 끼고 싼 곳 2 + 입주까지 계산되는 곳 중 무작위 2
  const ids = new Set(api.zones.map((z) => z.id));
  const zoneIds = FIXED_ZONES.filter((i) => ids.has(i));
  const cheap = api.zones.filter((z) => z.need.gap.now != null).sort((a, b) => a.need.gap.now - b.need.gap.now).map((z) => z.id).filter((i) => !zoneIds.includes(i));
  zoneIds.push(...cheap.slice(0, 2));
  { let s = 20261018; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); const pool2 = api.zones.filter((z) => z.need.gap.total != null && !zoneIds.includes(z.id)); for (let i = 0; i < 2 && pool2.length; i++) zoneIds.push(pool2.splice(Math.floor(rnd() * pool2.length), 1)[0].id); }

  const errs = [];
  const shared = {};
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const timing = {};
  const timed = (k, p) => { const t = Date.now(); return p.then((v) => { timing[k] = Date.now() - t; return v; }); };
  // 정적 검사는 바로 시작, 브라우저는 두 줄로(코어 2개)
  const stat = timed("static", staticLane(api));
  const cut = Math.ceil(zoneIds.length * 0.6);
  const ONLY = process.env.QAC_ONLY || "";   // 'r14' = 14회차 줄만(개발용)
  const lane1 = ONLY ? Promise.resolve() : timed("counts+zones", (async () => { await countsLane(browser, api, errs, shared); await zoneLane(browser, api, errs, shared, zoneIds.slice(0, cut)); await deskLane(browser, errs); })());
  const lane2 = ONLY ? Promise.resolve() : timed("map+ui+zones", (async () => { await mapLane(browser, api, errs, shortSrc); const st = await stat.catch(() => ({})); shared.liveCounts = st.liveCounts; await uiLane(browser, api, errs, shared); await zoneLane(browser, api, errs, shared, zoneIds.slice(cut)); })());
  const lane3 = timed("r14", r14Lane(browser, api, errs).catch((e) => bad("runtime", "검사 실행", "r14Lane crashed: " + e.message)));
  await Promise.all([stat.catch((e) => bad("runtime", "검사 실행", "static crashed: " + e.message)), lane1, lane2, lane3]);
  await browser.close();

  // 콘솔 오류
  const own = errs.filter((e) => !e.external), ext = errs.filter((e) => e.external);
  const uniq = [...new Map(own.map((e) => [e.msg, e])).values()];
  expect(!uniq.length, "err.console", "콘솔 오류·페이지 오류 없음(우리 사이트 파일)", uniq.slice(0, 5).map((e) => `${e.where}: ${e.msg}`).join(" ; "));
  if (ext.length) wrn("err.console", "콘솔 오류·페이지 오류 없음(우리 사이트 파일)", `${ext.length} external resource errors (tiles/CDN) e.g. ${ext[0].msg}`);

  // 출력
  const list = [...CHECKS.values()].sort((a, b) => a.id.localeCompare(b.id));
  const nFail = list.filter((c) => c.fails.length).length;
  const res = { base: BASE, at: new Date().toISOString(), ms: el(), timing, pass: nFail === 0, zones: zoneIds, checks: list };
  try { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(res, null, 2)); } catch (e) { console.error("could not write " + OUT + ": " + e.message); }
  console.log(`\nqa_consistency ${BASE}  ${(el() / 1000).toFixed(1)}s  zones: ${zoneIds.join(" ")}`);
  for (const c of list) {
    const tag = c.fails.length ? "FAIL" : c.skipped && !c.n ? "SKIP" : "PASS";
    console.log(`${tag} ${c.id.padEnd(16)} ${c.title}  [${c.n - c.fails.length}/${c.n}]${c.warns.length ? ` (${c.warns.length} warn)` : ""}${c.skipped ? ` (skipped: ${c.skipped})` : ""}`);
    c.fails.slice(0, 4).forEach((f) => console.log(`       - ${f}`));
    if (c.fails.length > 4) console.log(`       … +${c.fails.length - 4} more (JSON)`);
  }
  console.log(`\n${nFail ? "FAILED" : "PASSED"} · ${nFail} failing check(s) of ${list.length} · JSON ${OUT}`);
  process.exit(nFail ? 1 : 0);
})().catch((e) => { console.error("qa_consistency crashed:", e); process.exit(2); });
