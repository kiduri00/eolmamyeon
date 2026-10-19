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
const EXTRA_VIEWS = ["results", "rulesTop", "readsTop", "statsTop", "my"];

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
  // 화면 금액은 올림(ZF.num) → 한 칸(0.1억 · 100만)까지 차이를 허용 · '1억 2,345만'처럼 만 원까지 쓴 값은 그대로
  const tol = m[2] != null ? (m[1] == null && man % 100 === 0 ? 0.0101 : 0.00011) : dec ? Math.pow(10, -dec) + 1e-6 : 1 + 1e-6;
  return { v: e + man / 1e4, tol };
}
const eqMoney = (a, b) => a && b && Math.abs(a.v - b.v) <= Math.max(a.tol, b.tol) + 1e-6;
const eqApi = (disp, api) => disp && api != null && Math.abs(disp.v - api) <= disp.tol + 0.001;
const fm = (m) => (!m ? "–" : m.v < 1 ? `${Math.round(m.v * 1e4).toLocaleString("en-US")}만` : `${+m.v.toFixed(4)}억`);

// 억 금액 한 꼴(src/ext/05_facts.js ZF.num·ZF.cash와 같은 규칙): 1억 아래 소수 둘째 자리, 1억부터 첫째 자리
const zfUp = (x, k) => Math.ceil(x * k - 1e-6) / k;   // 화면 ZF.num과 같은 올림
const zfNum = (v) => { if (v == null || !isFinite(v)) return "–"; const a = Math.abs(v), sg = v < 0 ? "-" : ""; if (a < 0.005) return "0"; if (zfUp(a, 100) < 1) return sg + zfUp(a, 100).toFixed(2).replace(/0$/, ""); return sg + zfUp(a, 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 }); };
const zfCash = (v) => { const t = zfNum(v); if (t === "–") return t; if (t === "0") return "0원"; const a = Math.abs(v); if (Math.ceil(a * 100 - 1e-6) < 100) return (v < 0 ? "-" : "") + (Math.ceil(a * 100 - 1e-6) * 100).toLocaleString("ko-KR") + "만"; return t + "억"; };   // 1억 아래는 만 원(4,100만)
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
  m = /(전세 끼고|현금으로 사면|대출 끼고) 입주까지 현금\n([\d.,]+억|[\d,]+만|0원)/.exec(t) || /()입주까지 현금\n([\d.,]+억|[\d,]+만|0원)/.exec(t); if (m) { o.ipjuMode = m[1] || ""; o.ipju = money(m[2]); }
  { const k = /<section class="zk"[\s\S]*?<\/section>/.exec(html); if (k) { const kt = htmlText(k[0]); const g = (l) => { const x = new RegExp(l + "\\n([^\\n]+)").exec(kt); return x ? x[1].trim() : null; }; o.key = { now: g("지금 필요한 돈"), tot: g("입주까지 현금"), eta: g([...k[0].matchAll(/class="zk-l">([^<]+)</g)].map((x) => x[1])[2] || "언제 입주"), labs: [...k[0].matchAll(/class="zk-l">([^<]+)</g)].map((x) => x[1].trim()).join("|"), mail: (/href="([^"]+)"[^>]*>이 숫자가 틀렸어요/.exec(html) || [])[1] || "" }; } }
  m = /현금으로 사면 ([\d.,]+억|[\d,]+만|0원)/.exec(t); if (m) o.cashTotal = money(m[1]);
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
  o.ipju = [...t.matchAll(/입주까지 현금\s*\n?\s*([\d.,]+억|[\d,]+만|0원)/g)].map((x) => x[1]);
  return o;
}

// ---------------------------------------------------------------- 브라우저 도우미
const IN_PAGE = () => {
  // 첫 실행 질문(#onb)은 ui.onboard 검사에서만 본다 — 나머지 검사는 질문을 이미 답한 사용자로
  try { localStorage.setItem("zp.onb", "1"); } catch (e) {}
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
  page.on("pageerror", (e) => errs.push({ where: page.__where || "", msg: "pageerror: " + (e.message || String(e)).split("\n")[0].slice(0, 200) + " @" + String((e.stack || "").split("\n")[1] || "").trim().replace(/^at\s+/, "").replace(/https?:\/\/[^/]+/, "").slice(0, 90) }));
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
  // 전체 앱을 붙이기 시작했으면(주소 # 등) 다 붙을 때까지 — 바쁜 기계에서 붙기 전 누름이 늦게 다시 눌려 검사가 앞서 가던 것
  await page.waitForFunction(() => !window.ZP_boot || !window.ZP_boot.st || window.ZP_boot.hyd === 1, null, { timeout: 15000, polling: 100 }).catch(() => {});
  // 18차: 폰 지도·글꼴은 '조용해진 뒤 또는 처음 손댈 때' 붙는다(boot.js quiet) — 검사는 사람이 화면을 만진 것처럼 바로 붙인다
  await page.evaluate(() => { try { window.ZP_boot && window.ZP_boot.quietNow && window.ZP_boot.quietNow(); } catch (e) {} }).catch(() => {});
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
// 첫 화면 3칸 이름: 셋째 칸은 '언제 입주'(입주권 없는 곳은 '입주권' · 20차 G3)
const LAB3 = /^지금 필요한 돈\|입주까지 현금\|(언제 입주|입주권)$/;
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
    // 리뉴얼 1단계: 머리 종은 없앴다(소식 탭으로) → 첫 페인트에 아래 탭 4개(찾기·관심·소식·MY)가 그대로 있어야
    const T1 = "index.html 첫 페인트에 아래 탭 4개(#sNav 찾기·관심·소식·MY)·알림 카드 자리(.pc-ph 안 .pc-al) 있음 · 머리 종·⋯ 메뉴 없음";
    const nav0 = (/<nav class="s-nav" id="sNav"[\s\S]*?<\/nav>/.exec(idx.text) || [""])[0], navK = [...nav0.matchAll(/data-nav="(\w+)"/g)].map((m) => m[1]).join(",");
    expect(navK === "home,fav,news,my" && /class="pc-save pc-ph"[^>]*><div class="pc-al"/.test(idx.text) && !/id="huBell"|id="menuBtn"/.test(idx.text), "ui.islandSlots", T1, `sNav [${navK}] pc-ph card ${/class="pc-save pc-ph"[^>]*><div class="pc-al"/.test(idx.text)} bell/menu ${/id="huBell"|id="menuBtn"/.test(idx.text)}`);
    // 약관·개인정보·FAQ: 200 · MY에서 링크 · FAQ 10개 이상+찾기 칸 · 개인정보에 로컬 저장·푸시(KV)·계정 없음 · 사업자 정보 없음
    {
      const T2 = "약관·개인정보처리방침·FAQ가 200이고 MY에서 링크됨(FAQ 10개+찾기 · 방침에 localStorage·푸시 KV·계정 없음)";
      const my = (/<section class="sec tool my" id="my"[\s\S]*?<\/section>\s*<section/.exec(idx.text) || [""])[0];
      const pg = {}; for (const p of ["/terms", "/privacy", "/faq"]) pg[p] = await getPage(p);
      for (const p of Object.keys(pg)) expect(pg[p] && pg[p].status === 200, "seo.legal", T2, `${p} → ${pg[p] && pg[p].status}`);
      for (const h of ["terms", "privacy", "faq", "method", "about"]) expect(new RegExp(`href="${h}"`).test(my), "seo.legal", T2, `MY has no link to ${h}`);
      const fq = (pg["/faq"] || {}).text || "", pv = htmlText((pg["/privacy"] || {}).text || "");
      expect((fq.match(/<details class="fq"/g) || []).length >= 10 && /id="fqQ"[^>]*type="search"/.test(fq), "seo.legal", T2, `faq items ${(fq.match(/<details class="fq"/g) || []).length} · search ${/id="fqQ"/.test(fq)}`);
      expect(/localStorage/.test(pv) && /KV/.test(pv) && /계정/.test(pv) && /푸시/.test(pv), "seo.legal", T2, `privacy mentions localStorage ${/localStorage/.test(pv)} KV ${/KV/.test(pv)} 계정 ${/계정/.test(pv)} 푸시 ${/푸시/.test(pv)}`);
      for (const p of Object.keys(pg)) expect(!/사업자/.test(htmlText((pg[p] || {}).text || "")), "seo.legal", T2, `${p} mentions 사업자`);
      expect(/<a class="my-r" href="contact" id="myMail" data-zp-contact/.test(my), "seo.legal", T2, "MY 문의 row does not open the in-site contact form");
      expect(/문의하기 양식|문의 양식/.test(pv) && /180일/.test(pv) && /IP 주소는 저장하지 않/.test(pv) && /이메일은 선택/.test(pv), "seo.legal", T2, "privacy does not describe the contact form (stored items · 180 days · no IP · email optional)");
    }
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
    // 이름 속 유형어(괄호·붙은 말 포함)를 꼬리에서 또 말함: '미아3구역(재개발) 재개발' · '…주택재건축정비사업구역 재건축'
    const dk = (s) => { const t = String(s || "").replace(/\s*\|.*$/, "").trim(), m = /\s(재개발|재건축)$/.exec(t); return m && t.slice(0, -m[0].length).includes(m[1]) ? `${m[1]} twice` : null; };
    const d1 = dt(z.title) || dk(z.title), d2 = dt(z.h1) || dk(z.h1);
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
      const m = /(?:^|[\s(])지금 ([\d.,]+억|[\d,]+만|0원)(?= ·|\))/.exec(z.text);
      // api는 소수 둘째 자리로 반올림돼 있어(2.65) 원래 값(2.648…)의 꼴과 한 자리 다를 수 있다 → ±0.005 안의 꼴이면 같은 꼴
      if (m) expect([a.need.gap.now - 0.005, a.need.gap.now, a.need.gap.now + 0.0049].some((v) => m[1] === zfCash(v)), "term.cashFmt", "금액 꼴 하나(ZF.cash · 1억 아래는 만 원 · 4,100만): 목록 == /api 값 꼴 == 지도 이름표 == 리포트 시간표", `${where}: /z "지금 ${m[1]}" vs ZF꼴(api ${a.need.gap.now}) "${zfCash(a.need.gap.now)}"`);
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
    // 18차: 표 → 앱 목록 같은 줄(<ol class="gl"><li class="gr">) · 예전 표도 읽는다
    const tb = (/<tbody>([\s\S]*?)<\/tbody>/i.exec(r.text) || [])[1] || "";
    const gl = (/<ol class="gl"[^>]*>([\s\S]*?)<\/ol>/i.exec(r.text) || [])[1] || "";
    const rows = gl ? [...gl.matchAll(/<li class="gr">([\s\S]*?)<\/li>/gi)].map((m) => m[1]) : [...tb.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
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
      const tds = gl ? ["", htmlText((/<b class="gr-now">([\s\S]*?)<\/b>/.exec(row) || [])[1] || ""), htmlText(((/<b class="gr-tot">([\s\S]*?)<\/b><\/small>/.exec(row) || [])[1] || "").replace(/ <small>/, "\n<small>"))] : [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => htmlText(m[1]));
      if (tds.length < 3) continue;
      const now = money(tds[1]), tot = money(tds[2].split("\n")[0]), cashMode = /현금 매수 시/.test(tds[2]);
      const g = a.need.gap, c = a.need.cash;
      if (now && /억|만|원/.test(tds[1]) && !eqApi(now, g.now)) mis.push(`${zid} 전세 끼고 지금 ${tds[1]} vs api ${g.now}`);
      if (tot && /억|만|원/.test(tds[2])) { const ref = cashMode ? c.total : g.total; if (!eqApi(tot, ref)) mis.push(`${zid} 입주까지 ${tds[2].replace(/\n/g, " ")} vs api ${cashMode ? "cash" : "gap"}.total ${ref}`); }
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
        expect(!/곳\s*중|있는\s*[\d,]+\s*곳/.test(s.sNL) && s.sNL.trim() === "갈 수 있는 곳", "count.denom", "첫 화면 곳 수에 분모('전세 시세 있는 N곳 중') 없음 · 이름표 '갈 수 있는 곳'", `${where}: #sNL "${s.sNL}"`);
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
      const m1 = /([\d.,]+억|[\d,]+만|0원)/.exec(r.amt), m2 = /입주까지\s*(?:현금)?\s*([\d.,]+억|[\d,]+만|0원)/.exec(r.amt);
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
    { const firstNA = rowsG.findIndex((r) => !/입주까지(?! 현금 계산 보류)/.test(r.amt)), lastOK = rowsG.map((r) => /입주까지(?! 현금 계산 보류)/.test(r.amt)).lastIndexOf(true);
      expect(firstNA < 0 || firstNA > lastOK, "list.order", "'입주 계산 불가' 줄은 계산되는 줄보다 아래", `first n/a row #${firstNA} (${rowsG[firstNA] && rowsG[firstNA].name}) above calculable row #${lastOK}`); }
    // 맞춤순(기본 정렬): 지금 필요한 돈이 내 현금(15억)에 가까운 줄부터 — |현금 − 금액| 오름차순(표시 반올림 허용), 계산 불가 줄은 아래(list.order)
    {
      const sk = await page.evaluate(() => { try { return localStorage.getItem("emr.sort") || "fit"; } catch (e) { return "fit"; } });
      if (sk === "fit") {
        const ok = rowsG.filter((r) => /입주까지(?! 현금 계산 보류)/.test(r.amt)).map((r) => ({ r, m: money((/([\d.,]+억|[\d,]+만|0원)/.exec(r.amt) || [])[1]) })).filter((x) => x.m);
        let at = -1; for (let i = 1; i < ok.length; i++) { const a = Math.abs(15 - ok[i - 1].m.v), b = Math.abs(15 - ok[i].m.v); if (b + ok[i].m.tol + ok[i - 1].m.tol + 1e-6 < a) { at = i; break; } }
        expect(ok.length > 5 && at < 0, "list.fitSort", "맞춤순: 내 현금에 가까운 금액부터(|현금−금액| 오름차순 · 계산 불가는 아래)", at < 0 ? `only ${ok.length} rows` : `15억: row ${at - 1} ${ok[at - 1].r.name} ${ok[at - 1].r.amt.split("\n")[0]} before row ${at} ${ok[at].r.name} ${ok[at].r.amt.split("\n")[0]}`);
      } else skip("list.fitSort", "맞춤순: 내 현금에 가까운 금액부터(|현금−금액| 오름차순 · 계산 불가는 아래)", `stored sort ${sk}`);
    }
    // 금액 꼴 하나(ZF.cash): 1억 전세 끼고 목록 첫 줄들 '지금' == ZF 꼴(api 값) == 지도 이름표 == 리포트 시간표 '지금 · 매수'
    {
      await setMode(page, "gap"); await setCash(page, 1);
      const L1 = await page.evaluate(() => [...document.querySelectorAll("#sList li")].slice(0, 4).map((li) => { const a = li.querySelector("a[data-id]"), b = li.querySelector(".s-amt b"); return a && b ? { id: a.dataset.id, v: b.textContent.trim() } : null; }).filter(Boolean));
      const T = "금액 꼴 하나(ZF.cash · 1억 아래는 만 원 · 4,100만): 목록 == /api 값 꼴 == 지도 이름표 == 리포트 시간표";
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
        const t1 = /입주까지 현금\s*([\d.,]+억|[\d,]+만|0원)/.exec(r.tail), t2 = /입주까지\s*(?:현금)?\s*([\d.,]+억|[\d,]+만|0원)/.exec(r.amt);
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
      const pinBtns = await page.evaluate(() => [...document.querySelectorAll("#report button, #report a")].filter((b) => window.__qc.vis(b) && /핀 꽂(기|고)|관심 구역에 (추가|있어요)/.test(b.textContent)).length);
      const R = parseRep(ov); { const R2 = parseRep(all); for (const k of Object.keys(R2)) if (R[k] == null || (Array.isArray(R[k]) && !R[k].length)) R[k] = R2[k]; }   // 머리 블록이 섹션 탭 안으로 옮겨져(76_detail.js) 모든 탭 글자에서도 찾는다
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
      expect(pinBtns <= 1, "zone.pin1", "리포트에 '관심 구역에 추가' 버튼 하나", `${where}: ${pinBtns} visible 관심 구역 buttons`);
      // 표본 n: 큰 숫자 == 매수가 == 신뢰 상자
      const ns = [R.hdN, R.buyN, R.trustN].filter((x) => x != null && !isNaN(x));
      if (ns.length >= 2) expect(new Set(ns).size === 1, "zone.sample", "리포트 큰 숫자·계산 매수가·'믿어도 될까'가 같은 표본 n건", `${where}: 큰 숫자 ${R.hdN}건 ("${(R.hdBasis || "").slice(0, 50)}") · 매수가 ${R.buyN}건 · 신뢰 ${R.trustN}건`);
      if (R.excerpt1 && R.trustLast) expect(R.excerpt1 === R.trustLast, "zone.excerpt", "리포트 거래 발췌 첫 줄 == '마지막 거래'(최신 먼저)", `${where}: excerpt first ${R.excerpt1} vs 마지막 거래 ${R.trustLast}`);
      // 비교표(1km 안 다른 구역)의 이 구역 3.3㎡ 값 == 큰 숫자
      const pNear = pane.near || pane.loc;   // '호재' 탭은 '입지' 탭 아래로 합쳐졌다
      if (pNear && R.hdV && /3\.3㎡/.test(R.hdLabel || "")) {
        const m = /3\.3㎡당 실거래[^\n\t]*\t([^\t\n]+)/.exec(pNear);
        if (m && money(m[1])) expect(eqMoney(money(m[1]), R.hdV), "zone.cmp", "'1km 안 비교' 표의 이 구역 3.3㎡ 값 == 리포트 큰 숫자", `${where}: 비교표 ${m[1]} vs 큰 숫자 ${fm(R.hdV)}`);
      }
      // 입주까지 현금: 리포트 안 모든 자리 같음 == 목록 == API == /z
      const ip = [...new Set([...all.matchAll(/입주까지 현금\s*\n?\s*([\d.,]+억|[\d,]+만|0원)/g)].map((m) => m[1]))];
      const a = apiById.get(zid);
      if (ip.length) {
        expect(ip.length === 1, "zone.ipju", "입주까지 현금: 리포트 안 모든 자리 == 목록 == /api == /z (전세 끼고)", `${where}: report shows several values ${ip.join(" / ")}`);
        const rv = money(ip[0]);
        if (a && a.need.gap.total != null) expect(eqApi(rv, a.need.gap.total), "zone.ipju", "입주까지 현금: 리포트 안 모든 자리 == 목록 == /api == /z (전세 끼고)", `${where}: report ${ip[0]} vs api gap.total ${a.need.gap.total}`);
        const lm = shared.listMap && shared.listMap.get(zid);
        if (lm && lm.tot) expect(eqMoney(lm.tot, rv), "zone.ipju", "입주까지 현금: 리포트 안 모든 자리 == 목록 == /api == /z (전세 끼고)", `${where}: list ${fm(lm.tot)} vs report ${ip[0]}`);
      }
      // 현금 탭 다리: 들어가는 돈 − 잔금대출 = 입주까지 현금 / 지금 + 이주 때 = 입주까지 현금
      { const AM = "([\\d.,]+억|[\\d,]+만|0원)", mv = (x) => (money(x) || { v: NaN }).v;   // 1억 아래는 '4,100만'
        const m = new RegExp(`입주까지 들어가는 돈 ${AM}\\n?\\s*− 입주 잔금대출 ${AM}\\n?\\s*= 입주까지 현금 ${AM}`).exec(all);
        if (m) expect(Math.abs(mv(m[1]) - mv(m[2]) - mv(m[3])) <= 0.1 + 1e-9, "zone.bridge", "현금 탭 다리 계산(들어가는 돈 − 잔금대출 = 입주까지 현금)이 맞음", `${where}: ${m[1]} − ${m[2]} ≠ ${m[3]}`);
        const g = new RegExp(`지금 ${AM}\\n?\\s*\\+ 이주 때 ${AM}\\n?\\s*= 입주까지 현금 ${AM}`).exec(all);
        if (g) expect(Math.abs(mv(g[1]) + mv(g[2]) - mv(g[3])) <= 0.1 + 1e-9, "zone.bridge", "현금 탭 다리 계산(들어가는 돈 − 잔금대출 = 입주까지 현금)이 맞음", `${where}: ${g[1]} + ${g[2]} ≠ ${g[3]}`); }
      // 입주 때 시세 차이 == 비례율 표 100%
      if (pane.money) {
        const g1 = /입주 때 시세 차이[^\n]*\n([+−-]?(?:[\d.,]+억|[\d,]+만|0원))/.exec(pane.money), g2 = /\n100%\t([+−-]?(?:[\d.,]+억|[\d,]+만|0원))/.exec(pane.money);
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
        // 첫 화면 3숫자: 앱 상세 == /z (같은 이름 · 같은 값 · 전세 끼고 기본)
        { const K = await page.evaluate(() => { const k = document.querySelector("#report .dt-k"); if (!k) return null; const g = (q) => { const e = k.querySelector(`[data-k="${q}"] .dt-v`); return e ? e.textContent.trim() : null; }; return { now: g("now"), tot: g("tot"), eta: g("eta"), labs: [...k.querySelectorAll(".dt-l")].map((e) => e.textContent.trim()) }; });
          const T = "첫 화면 3숫자(지금 필요한 돈 · 입주까지 현금 · 언제 입주) 앱 == /z 페이지(이름·값)";
          if (!K) bad("zone.key3", T, `${where}: no .dt-k in report head`);
          else if (!Z.key) bad("zone.key3", T, `/z/${zid}: no key3 block`);
          else { expect(K.now === Z.key.now && K.tot === Z.key.tot && K.eta === Z.key.eta, "zone.key3", T, `${where}: app ${K.now} / ${K.tot} / ${K.eta} vs /z ${Z.key.now} / ${Z.key.tot} / ${Z.key.eta}`);
                 expect(LAB3.test(K.labs.join("|")) && K.labs.join("|") === Z.key.labs, "zone.key3", T, `${where}: labels app ${K.labs.join("|")} vs /z ${Z.key.labs}`); } }
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
      // ⋯ 메뉴는 없앴다(리뉴얼 1단계) → 도구는 MY '도구' 묶음 + 아래 탭(관심·소식)에서 연다
      const m = await page.evaluate((extra) => { const ids = (window.ZP_TOOLS || []).map((t) => t[0]); const tl = [...document.querySelectorAll("#myTools a")], nv = [...document.querySelectorAll("#sNav [data-nav]")]; const hrefs = tl.map((a) => a.dataset.menu || (a.getAttribute("href") || "").replace(/^#/, "")).concat(nv.map((b) => (b.dataset.nav === "fav" ? "favTop" : b.dataset.nav))); const txt = tl.map((a) => a.querySelector("b") ? a.querySelector("b").textContent.trim() : a.textContent.trim()); return { ids, extra, missing: ids.concat(extra.filter((x) => x !== "results" && x !== "readsTop")).filter((i) => !hrefs.includes(i)), dup: txt.filter((t, i) => t && txt.indexOf(t) !== i), month: txt.filter((t) => /이번 달/.test(t)) }; }, EXTRA_VIEWS);
      expect(!m.missing.length, "ui.menu", "MY 도구 묶음 + 아래 탭에 모든 도구 · 같은 항목 두 번 없음 · '이번 달' 없음", `menu lacks: ${m.missing.join(", ")}`);
      expect(!m.dup.length, "ui.menu", "MY 도구 묶음 + 아래 탭에 모든 도구 · 같은 항목 두 번 없음 · '이번 달' 없음", `duplicate menu items: ${m.dup.join(", ")}`);
      expect(!m.month.length, "ui.menu", "MY 도구 묶음 + 아래 탭에 모든 도구 · 같은 항목 두 번 없음 · '이번 달' 없음", `menu says: ${m.month.join(", ")}`);
      shared.toolIds = m.ids.concat(EXTRA_VIEWS);
      shared.alias = await page.evaluate(() => window.ZP_ALIAS || {});
    }
    // 21차: 홈 '더 알아보기' 격자(#sTiles)는 없고, 아래쪽 빠른 메뉴 한 줄(#sQuick)에 정확히 6개 · 각각 그 화면을 연다 · MY 도구 묶음은 전부 그대로
    {
      const TT = "홈 빠른 메뉴 한 줄 = 순위·실거래·경공매·고시공고·출퇴근·입주 계산(각각 그 화면) · 격자 없음 · 도구(ZP_TOOLS)는 MY 도구 묶음(관심·소식은 아래 탭)에 전부";
      const g = await page.evaluate(() => ({ grid: !!document.getElementById("sTiles") || !!document.querySelector(".s-t[data-view]"), q: [...document.querySelectorAll("#sQuick a")].map((a) => ({ t: a.querySelector("span").textContent.trim(), h: (a.getAttribute("href") || "").slice(1), lab: a.getAttribute("aria-label") || "" })), my: [...document.querySelectorAll("#myTools a")].map((a) => a.dataset.menu || (a.getAttribute("href") || "").replace(/^#/, "")), ids: (window.ZP_TOOLS || []).map((t) => t[0]) }));
      const lack = g.ids.filter((id) => !g.my.includes(id) && id !== "favTop" && id !== "news");
      const want = ["순위", "실거래", "경공매", "고시공고", "출퇴근", "입주 계산"];
      expect(!g.grid && g.ids.length && !lack.length && JSON.stringify(g.q.map((x) => x.t)) === JSON.stringify(want) && g.q.every((x) => x.lab.startsWith(x.t)), "ui.tiles", TT, `grid ${g.grid} · quick ${JSON.stringify(g.q.map((x) => x.t))} · not in MY: [${lack.join(", ")}]`);
      const TGT = { rankHub: ["rankHub", null], txrTop: ["rankHub", "txr"], aucTop: ["news", "auc"], ntcTop: ["news", ""], commuteTop: ["commuteTop", null], planner: ["planner", null] };
      for (const x of g.q) {
        await loadHome(page); await settle(page, 300);
        const r = await page.evaluate(async (h) => { const a = document.querySelector(`#sQuick a[href="#${h}"]`); const y0 = scrollY; a.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 120)); const y1 = scrollY; a.click(); await new Promise((r) => setTimeout(r, 700)); const on = [...document.querySelectorAll(".s-on")].map((e) => e.id); const chip = document.querySelector("#ntcF [aria-pressed=\"true\"]"); const tab = document.querySelector("#rankHub [role=tab][aria-selected=\"true\"]"); return { on, chip: chip ? chip.dataset.c : null, tab: tab ? tab.dataset.tab : null, y1, auc: (document.getElementById("ntcOut") || {}).textContent || "" }; }, x.h);
        const [view, sub] = TGT[x.h] || [];
        const okV = r.on.includes(view) && (x.h !== "aucTop" || r.chip === "auc") && (x.h !== "ntcTop" || r.chip === "") && (x.h !== "txrTop" || /txr|실거래/.test(String(r.tab)));
        expect(okV, "ui.tiles", TT, `${x.t} (#${x.h}): open ${r.on.join(",")} chip ${r.chip} tab ${r.tab}`);
        // 돌아가기 → 홈의 빠른 메뉴 자리로
        const back = await page.evaluate(async () => { history.back(); await new Promise((r) => setTimeout(r, 700)); return { view: document.documentElement.classList.contains("s-view"), y: scrollY }; });
        expect(!back.view && Math.abs(back.y - r.y1) <= 80, "ui.tiles", TT, `${x.t}: 뒤로 가기 → 홈 ${!back.view} · scroll ${Math.round(back.y)} (was ${Math.round(r.y1)})`);
      }
    }
    // 돌아가기: MY에서 연 도구의 '← 돌아가기' → MY로(아래 탭 화면 관심·소식·MY에는 돌아가기 없음)
    {
      await loadHome(page, "#my"); await page.waitForTimeout(700);
      const r = await page.evaluate(async () => {
        const a = [...document.querySelectorAll("#myTools a")].find((x) => window.__qc.vis(x) && (x.dataset.menu || "") !== "favTop" && (x.dataset.menu || "") !== "news"); if (!a) return null;
        const id = a.dataset.menu || (a.getAttribute("href") || "").slice(1);
        a.click(); await new Promise((r) => setTimeout(r, 700));
        const b = [...document.querySelectorAll(".s-back")].find((x) => window.__qc.vis(x)); if (!b) return { id, nob: 1 };
        b.click(); await new Promise((r) => setTimeout(r, 900));
        const my = document.getElementById("my");
        return { id, on: my.classList.contains("s-on"), hash: location.hash, tabBack: ["favTop", "news", "my"].filter((t) => { const s = document.getElementById(t); return s && s.querySelector(".s-back"); }) };
      });
      if (r && !r.nob) expect(r.on && r.hash === "#my" && !r.tabBack.length, "ui.back", "MY에서 연 도구 '돌아가기' → MY · 관심·소식·MY 화면엔 돌아가기 없음", `#${r.id} back → my s-on ${r.on} hash ${r.hash} · tab screens with back [${r.tabBack.join(", ")}]`);
      else bad("ui.back", "MY에서 연 도구 '돌아가기' → MY · 관심·소식·MY 화면엔 돌아가기 없음", r ? `#${r.id}: no visible .s-back` : "no tool link in MY");
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
      if (s.missing) { bad("ui.deeplink", "도구 딥링크: s-on · 돌아가기 버튼이 머리 밑에 다 보임(아래 탭 화면 관심·소식·MY는 돌아가기 없음) · 내용 있음", `${where}: section missing`); continue; }
      expect(s.on && s.len > 40, "ui.deeplink", "도구 딥링크: s-on · 돌아가기 버튼이 머리 밑에 다 보임(아래 탭 화면 관심·소식·MY는 돌아가기 없음) · 내용 있음", `${where}: s-on=${s.on} text=${s.len}`);
      if (["favTop", "news", "my"].includes(id)) expect(s.backTop == null, "ui.deeplink", "도구 딥링크: s-on · 돌아가기 버튼이 머리 밑에 다 보임(아래 탭 화면 관심·소식·MY는 돌아가기 없음) · 내용 있음", `${where}: tab screen has a back button (top ${s.backTop})`);
      else expect(s.backTop != null && s.backTop >= s.hb - 1, "ui.deeplink", "도구 딥링크: s-on · 돌아가기 버튼이 머리 밑에 다 보임(아래 탭 화면 관심·소식·MY는 돌아가기 없음) · 내용 있음", `${where}: back button top ${s.backTop} vs header bottom ${s.hb}`);
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
    // 로고 = 홈: 구역 상세 시트(로고는 시트 밑이라 click()) · 도구 화면(손가락 탭)에서 눌러도 시트·도구가 닫히고 주소 #… 없음 · 첫 화면 맨 위
    if (!over()) {
      const T = "로고를 누르면 어느 화면에서든 첫 화면 맨 위로(시트·도구 닫힘 · 주소 # 없음)";
      const st = () => page.evaluate(() => { const H = document.documentElement, m = document.getElementById("mapTop"); return { hash: location.hash, y: Math.round(scrollY), sheet: !!document.querySelector("#report.sheet"), cls: ["s-view", "s-full", "sheet-open", "s-rep", "ib-lock"].filter((c) => H.classList.contains(c)), home: !!(m && window.__qc.vis(m)) }; });
      const ok = (s) => !s.hash && !s.sheet && !s.cls.length && s.home && s.y < 5;
      const zid = api.zones[0].id;
      await loadHome(page, "#" + zid); await page.waitForFunction(() => !!document.querySelector("#report.sheet .rep-head"), null, { timeout: 8000 }).catch(() => {});
      const s0 = await st();
      if (!s0.sheet) bad("ui.logoHome", T, `#${zid}: report sheet did not open`);
      else { await page.evaluate(() => document.querySelector("a.logo").click()); await page.waitForTimeout(400); const s = await st(); expect(ok(s), "ui.logoHome", T, `report #${zid} → logo: hash "${s.hash}" sheet ${s.sheet} classes [${s.cls}] home visible ${s.home} scrollY ${s.y}`); }
      await loadHome(page, "#news"); await page.waitForTimeout(600);
      await page.tap("a.logo", { timeout: 4000 }).catch(() => {}); await page.waitForFunction(() => !location.hash && !document.documentElement.classList.contains("s-view"), null, { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400);
      { const s = await st(); expect(ok(s), "ui.logoHome", T, `tool #news → logo tap: hash "${s.hash}" classes [${s.cls}] home visible ${s.home} scrollY ${s.y}`); }
    }
    // 아래 탭 '관심 구역': 전체 지도에서 · 구역 상세를 닫은 뒤에도 → #favTop 화면(주소 #favTop · s-on · 보임)
    if (!over()) {
      const T = "아래 탭 '관심 구역'이 어디서든 #favTop 화면을 연다(전체 지도·상세 닫은 뒤)";
      const fav = () => page.evaluate(() => { const s = document.getElementById("favTop"), r = s && s.getBoundingClientRect(); return { hash: location.hash, on: !!(s && s.classList.contains("s-on")), vis: !!(r && r.height > 40 && r.top < innerHeight && r.bottom > 0), full: document.documentElement.classList.contains("s-full") }; });
      const tapFav = async () => { await page.tap('#sNav [data-nav="fav"]', { timeout: 4000, force: true }).catch(() => {}); await page.waitForFunction(() => location.hash === "#favTop" && !!document.querySelector("#favTop.s-on"), null, { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(500); };   // 바쁜 기계(swiftshader 지도 다시 그리기)에선 누름 처리가 몇 초 늦다
      await loadHome(page, "#map"); await page.waitForTimeout(800);
      await tapFav(); { const s = await fav(); expect(s.hash === "#favTop" && s.on && s.vis && !s.full, "ui.favTab", T, `from full map: hash "${s.hash}" s-on ${s.on} visible ${s.vis} s-full ${s.full}`); }
      const zid = api.zones[1].id;
      await loadHome(page, "#" + zid); await page.waitForFunction(() => !!document.querySelector("#report.sheet .rep-head"), null, { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => { const b = document.getElementById("sheetClose"); b && b.click(); }); await page.waitForTimeout(500);
      await tapFav(); { const s = await fav(); expect(s.hash === "#favTop" && s.on && s.vis, "ui.favTab", T, `report #${zid} closed → tab: hash "${s.hash}" s-on ${s.on} visible ${s.vis}`); }
    }
  } catch (e) { bad("runtime", "검사 실행", "uiLane crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await ctx.close().catch(() => {}); }
}

// ================================================================ 리뉴얼 1단계: 아래 탭 4개 · MY 화면
async function r1Lane(browser, api, errs) {
  const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, errs);
  let dialogs = 0; page.on("dialog", (d) => { dialogs++; d.dismiss().catch(() => {}); });
  try {
    // --- ui.tabs4: 보이는 탭 정확히 4개(찾기·관심·소식·MY) · 화면마다 aria-current가 하나이고 맞는 탭
    const T = "아래 탭 정확히 4개(찾기·관심·소식·MY) · 어느 화면에서든(도구·상세 닫은 뒤·전체 지도·뒤로 가기) 지금 탭 하나만 aria-current";
    const tabs = () => page.evaluate(() => { const B = [...document.querySelectorAll("#sNav [data-nav]")].filter((b) => window.__qc.vis(b)); return { n: B.length, lab: B.map((b) => (b.querySelector("span") || b).textContent.trim()).join(","), cur: B.filter((b) => b.getAttribute("aria-current") === "page").map((b) => b.dataset.nav) }; });
    const want = async (where, k) => { const t = await tabs(); expect(t.n === 4 && t.lab === "찾기,관심,소식,MY" && t.cur.length === 1 && t.cur[0] === k, "ui.tabs4", T, `${where}: ${t.n} tabs [${t.lab}] current [${t.cur}] want ${k}`); };
    for (const [h, k] of [["", "home"], ["#favTop", "fav"], ["#news", "news"], ["#my", "my"], ["#rankHub", "my"], ["#planner", "my"], ["#map", "home"]]) { await loadHome(page, h); await page.waitForTimeout(700); await want(h || "/", k); }
    // 탭을 차례로 누르기 → 뒤로 가기
    await loadHome(page); await page.mouse.move(10, 10).catch(() => {}); await page.evaluate(() => window.dispatchEvent(new Event("scroll")));   // 첫 손길 → 전체 앱 붙이기
    await page.waitForFunction(() => !window.ZP_boot || window.ZP_boot.hyd === 1, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(600);
    const tap = async (k) => { await page.tap(`#sNav [data-nav="${k}"]`, { timeout: 4000, force: true }).catch(() => {}); await page.waitForFunction((k) => { const b = document.querySelector(`#sNav [data-nav="${k}"]`); return b && b.getAttribute("aria-current") === "page"; }, k, { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(500); };
    await tap("news"); await want("tap 소식", "news");
    { const h = await page.evaluate(() => location.hash); expect(h === "#news", "ui.tabs4", T, `tap 소식 → hash ${h}`); }
    await tap("my"); await want("tap MY", "my");
    { const h = await page.evaluate(() => ({ h: location.hash, on: !!document.querySelector("#my.s-on") })); expect(h.h === "#my" && h.on, "ui.tabs4", T, `tap MY → hash ${h.h} s-on ${h.on}`); }
    // MY의 도구(순위) → MY 강조 유지 → 뒤로 → MY
    await page.evaluate(() => { const a = document.querySelector('#myTools [data-menu="rankHub"]'); a && a.click(); }); await page.waitForTimeout(800); await want("MY → 순위", "my");
    await page.goBack().catch(() => {}); await page.waitForTimeout(900);
    { const h = await page.evaluate(() => ({ h: location.hash, on: !!document.querySelector("#my.s-on") })); expect(h.h === "#my" && h.on, "ui.tabs4", T, `back from 순위 → hash ${h.h} MY shown ${h.on}`); }
    await want("back → MY", "my");
    await page.goBack().catch(() => {}); await page.waitForTimeout(900); await want("back → 소식", "news");
    await tap("home"); await want("tap 찾기", "home");
    // 구역 상세를 열고 닫으면(관심 화면 위에서) 관심 강조 그대로
    const zid = api.zones[2].id;
    await loadHome(page, "#favTop"); await page.waitForTimeout(600);
    await page.evaluate((id) => { location.hash = "#" + id; }, zid); await page.waitForFunction(() => !!document.querySelector("#report.sheet .rep-head"), null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => { const b = document.getElementById("sheetClose"); b && b.click(); }); await page.waitForTimeout(700);
    { const t = await tabs(); expect(t.cur.length === 1 && t.n === 4, "ui.tabs4", T, `report on 관심 closed → current [${t.cur}]`); }
    // 데스크톱 1440: 같은 탭 4개가 머리 안에 보이고 강조 하나
    {
      const d = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" }); await d.route(BLOCK, (r) => r.abort()); await d.addInitScript(IN_PAGE); const dp = await d.newPage();
      await loadHome(dp, "#news"); await dp.waitForTimeout(800);
      const t = await dp.evaluate(() => { const B = [...document.querySelectorAll("#sNav [data-nav]")].filter((b) => window.__qc.vis(b)); return { n: B.length, inHdr: !!document.querySelector("#hdr #sNav"), cur: B.filter((b) => b.getAttribute("aria-current") === "page").map((b) => b.dataset.nav), foot: !!(document.querySelector(".site-foot") && window.__qc.vis(document.querySelector(".site-foot"))) }; });
      expect(t.n === 4 && t.inHdr && t.cur.join() === "news", "ui.tabs4", T, `1440 #news: ${t.n} tabs in header ${t.inHdr} current [${t.cur}]`);
      expect(!t.foot, "ui.tabs4", T, "1440: web footer visible in app");
      await d.close();
    }
    // 정적 페이지도 같은 탭 4개(폰)
    {
      const sp = []; for (const u of ["/z/" + api.zones[0].id + ".html", "/guide/", "/terms.html", "/404.html"]) { page.__where = u; await page.goto(BASE + u, { waitUntil: "domcontentloaded" }).catch(() => {}); sp.push([u, await page.evaluate(() => { const A = [...document.querySelectorAll(".zp-tabs a")].filter((a) => a.getBoundingClientRect().height > 30); return { n: A.length, h: A.map((a) => a.getAttribute("href")).join(","), cur: A.filter((a) => a.getAttribute("aria-current") === "page").length }; })]); }
      for (const [u, t] of sp) expect(t.n === 4 && t.h === "/,/#favTop,/#news,/#my" && t.cur === 1, "ui.tabs4", T, `${u}: ${t.n} tabs [${t.h}] current ${t.cur}`);
    }
    // --- ui.my: MY 줄(44px 이상) · 지우기는 화면 안 확인 단계(confirm() 없음) → 지운 뒤 첫 실행 상태
    const TM = "MY: 내 조건·알림 설정(종류별·권한)·옮기기·도구 6·FAQ·출처·문의·약관·저작권·버전·기준일·설치·지우기 줄이 44px 이상 · 지우기는 화면 안 확인 → 첫 실행 상태";
    const ids = api.zones.slice(0, 2).map((z) => z.id);
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" }); await page.evaluate((ids) => { localStorage.setItem("jg-fav", JSON.stringify(ids)); localStorage.setItem("zp-alert-off", "[]"); }, ids);
    await loadHome(page, "#my"); await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s), my = q("#my");
      const need = ["#myCash", "#myMode", "#myPermS", "#myMove", "#myVer", "#myAsof", "#myWipe", "#myInst", '#my a[href="faq"]', '#my a[href="method"]', '#my a[href="terms"]', '#my a[href="privacy"]', '#my a[data-zp-contact]', "#my .my-det"];
      const miss = need.filter((s) => !q(s));
      const small = [...my.querySelectorAll(".my-r")].filter((e) => window.__qc.vis(e) && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim().slice(0, 14));
      return { miss, small, kinds: my.querySelectorAll("#myKinds [role=switch]").length, tools: my.querySelectorAll("#myTools a[data-menu]").length, ver: (q("#myVer") || {}).textContent || "", asof: (q("#myAsof") || {}).textContent || "", cash: (q("#myCash") || {}).textContent || "", mail: !!q("#my a[data-zp-contact]") && !/@/.test(my.innerText) };
    });
    expect(!r.miss.length && r.kinds >= 4 && r.tools === 6 && /\d/.test(r.ver) && !/__/.test(r.ver) && /\d/.test(r.asof) && /억|만/.test(r.cash) && r.mail, "ui.my", TM, `missing [${r.miss}] kinds ${r.kinds} tools ${r.tools} ver "${r.ver}" asof "${r.asof}" cash "${r.cash}" mail ${r.mail}`);
    expect(!r.small.length, "ui.my", TM, `rows < 44px: ${r.small.join(" ; ")}`);
    // 종류 끄기 → 저장
    // 폰 알림이 꺼져 있으면(점검 브라우저는 늘 꺼짐) 종류 스위치는 흐리게·누를 수 없음·켜진 것처럼 보이지 않음 + '폰 알림을 켜면 골라 받을 수 있어요'
    { const k = await page.evaluate(() => { const on = window.ZP_INBOX && window.ZP_INBOX.st().on; const S = [...document.querySelectorAll("#myKinds [role=switch]")]; const c = document.getElementById("myKindsC"); return { on: !!on, n: S.length, dis: S.filter((b) => b.disabled).length, onN: S.filter((b) => b.getAttribute("aria-checked") === "true").length, cap: c && !c.hidden ? c.textContent : "" }; });
      if (!k.on) expect(k.n && k.dis === k.n && !k.onN && /폰 알림을 켜면/.test(k.cap), "ui.myToggles", "폰 알림 꺼짐: MY 알림 종류 스위치 흐리게(disabled)·꺼진 모양 + 안내 한 줄", `push off: ${k.dis}/${k.n} disabled, ${k.onN} look ON, caption "${k.cap}"`); }
    await page.evaluate(() => { const b = document.querySelector('#myKinds [data-kind="trade"]'); if (b && !b.disabled) b.click(); else if (window.ZP_INBOX) window.ZP_INBOX.setKind("trade", false); });
    { const v = await page.evaluate(() => localStorage.getItem("zp-alert-off")); expect(/trade/.test(v || ""), "ui.my", TM, `alert kind toggle not stored: ${v}`); }
    // 지우기: 첫 누름은 확인 칸만(데이터 그대로) · 닫기 → 그대로 · 모두 지우기 → 저장소 빔 · 첫 화면
    await page.evaluate(() => document.getElementById("myWipe").click()); await page.waitForTimeout(200);
    { const v = await page.evaluate(() => ({ box: !document.getElementById("myWipeBox").hidden, fav: localStorage.getItem("jg-fav") })); expect(v.box && v.fav && v.fav !== "[]", "ui.my", TM, `wipe tap 1: confirm box ${v.box} data kept ${v.fav}`); }
    await page.evaluate(() => document.getElementById("myWipeNo").click()); await page.waitForTimeout(200);
    { const v = await page.evaluate(() => ({ box: !document.getElementById("myWipeBox").hidden, fav: localStorage.getItem("jg-fav") })); expect(!v.box && v.fav && v.fav !== "[]", "ui.my", TM, `wipe 닫기: box ${v.box} data ${v.fav}`); }
    await page.evaluate(() => document.getElementById("myWipe").click()); await page.waitForTimeout(200);
    await Promise.all([page.waitForNavigation({ timeout: 8000 }).catch(() => {}), page.evaluate(() => document.getElementById("myWipeGo").click())]);
    await page.waitForTimeout(800);
    { const v = await page.evaluate(() => ({ fav: localStorage.getItem("jg-fav"), off: localStorage.getItem("zp-alert-off"), hash: location.hash, view: document.documentElement.classList.contains("s-view") })); expect(!v.fav && !v.off && !v.hash && !v.view, "ui.my", TM, `after wipe: jg-fav ${v.fav} zp-alert-off ${v.off} hash "${v.hash}" s-view ${v.view}`); }
    expect(dialogs === 0, "ui.my", TM, `native dialog (confirm/alert) shown ${dialogs}×`);
  } catch (e) { bad("runtime", "검사 실행", "r1Lane crashed: " + String(e.message || e).split("\n")[0]); }
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
      const a = await page2.evaluate(() => { const e = document.getElementById("report"), cs = getComputedStyle(e), h = document.getElementById("hdr").getBoundingClientRect().bottom; const g = document.getElementById("sGauge"), gb = g && g.offsetParent ? g.getBoundingClientRect() : null; return { ov: cs.overflowY, sh: e.scrollHeight, ch: e.clientHeight, top: Math.round(e.getBoundingClientRect().top), hb: Math.round(h), y: Math.round(scrollY), gt: gb ? Math.round(gb.top) : null, gbt: gb ? Math.round(gb.bottom) : null }; });
      expect(!((a.ov === "auto" || a.ov === "scroll") && a.sh > a.ch + 2), "ui.repFlow", T, `#report overflow-y ${a.ov} scrollHeight ${a.sh} > clientHeight ${a.ch}`);
      // 리뉴얼 4단계: 상세를 열어도 예산 카드가 위에 남는다 → 상세 머리는 머리줄 밑이거나, 머리줄 밑 예산 카드 바로 아래
      expect(a.top >= a.hb - 2 && (a.top <= a.hb + 120 || (a.gt != null && a.gt >= a.hb - 2 && a.gt <= a.hb + 40 && a.top <= a.gbt + 90)), "ui.repFlow", T, `#o337 deep link: report top ${a.top} vs header bottom ${a.hb} · budget card ${a.gt}–${a.gbt} (scrollY ${a.y})`);
      // 휠은 페이지를 내린다(딥링크 직후 지도 그리기로 바쁘면 늦게 반영될 수 있어 최대 8초 기다림)
      // 상세 칸 위에서 휠(리뉴얼 2단계: PC 목록·상세 칸이 왼쪽, 지도가 오른쪽 — 칸 자리를 재서 그 위로)
      const rp = await page2.evaluate(() => { const r = document.getElementById("report").getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(Math.min(innerHeight - 100, Math.max(r.top + 200, 300)))]; });
      await page2.mouse.move(rp[0], rp[1]); await page2.mouse.wheel(0, 600);
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
    // desk.keepZone: 목록 줄을 누르면 지도가 그 구역으로 가서 1.5초 뒤에도 그 자리(서울 전체로 되돌아가지 않음) · desk.hover: 줄 ↔ 알약 마우스 연결
    {
      await loadHome(page2); await settle(page2, 400);
      await page2.waitForFunction(() => { const m = window.ZP_lmx && window.ZP_lmx.map && window.ZP_lmx.map(); return m && m.loaded() && !m.isMoving(); }, null, { timeout: 25000, polling: 200 }).catch(() => {});
      await page2.waitForTimeout(800);
      // hover: 알약이 있는 줄에 마우스 → 그 알약 .hov · 알약에 마우스 → 그 줄 .lm-hov (서울 보기는 구 묶음이라 첫 줄 구역 근처로 당겨서)
      await page2.evaluate(() => { const id = (document.querySelector("#sList li.s-card") || {}).dataset?.zid; const f = (window.ZP_lmx.map().getSource("zlab").serialize().data.features || []).find((x) => x.properties.id === id); if (f) window.ZP_lmx.map().jumpTo({ center: f.geometry.coordinates, zoom: 13 }); });
      await page2.waitForTimeout(600); await page2.waitForFunction(() => !window.ZP_lmx.map().isMoving() && document.querySelectorAll("#lmap button.zpill").length > 0, null, { timeout: 8000, polling: 150 }).catch(() => {});
      const pr = await page2.evaluate(() => { const ids = new Set([...document.querySelectorAll("#lmap button.zpill[data-zid]")].map((b) => b.dataset.zid)); const li = [...document.querySelectorAll("#sList li.s-card")].find((l) => ids.has(l.dataset.zid) && l.getBoundingClientRect().top > 80 && l.getBoundingClientRect().bottom < innerHeight - 10); if (!li) return null; const b = li.getBoundingClientRect(); return { id: li.dataset.zid, x: b.left + 40, y: b.top + b.height / 2 }; });
      if (pr) {
        await page2.mouse.move(pr.x, pr.y); await page2.waitForTimeout(400);
        const h1 = await page2.evaluate((id) => { const b = document.querySelector(`#lmap button.zpill[data-zid="${id}"]`); return !!(b && b.classList.contains("hov")); }, pr.id);
        expect(h1, "desk.hover", "PC 목록 줄에 마우스 → 지도 알약 강조 · 알약에 마우스 → 목록 줄 강조", `row ${pr.id} hover → pill .hov ${h1}`);
        const pb = await page2.evaluate((id) => { const b = document.querySelector(`#lmap button.zpill[data-zid="${id}"]`).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, pr.id);
        await page2.mouse.move(pb.x, pb.y); await page2.waitForTimeout(400);
        const h2 = await page2.evaluate((id) => { const l = document.querySelector(`#sList li[data-zid="${id}"]`); return !!(l && l.classList.contains("lm-hov")); }, pr.id);
        expect(h2, "desk.hover", "PC 목록 줄에 마우스 → 지도 알약 강조 · 알약에 마우스 → 목록 줄 강조", `pill ${pr.id} hover → row .lm-hov ${h2}`);
        await page2.mouse.move(5, 500);
      } else skip("desk.hover", "PC 목록 줄에 마우스 → 지도 알약 강조 · 알약에 마우스 → 목록 줄 강조", "no row with a visible pill");
      const row = await page2.evaluate(() => { const a = [...document.querySelectorAll("#sList li.s-card a[data-id]")][2]; if (!a) return null; a.click(); return a.dataset.id; });
      if (row) {
        // 날아가기가 끝날 때까지(바쁜 기계에선 늦다) → 그 뒤 2초 동안 그 자리에 머무는지
        // flyTo는 멀리 갈 때 한 번 줌을 뺐다가 다시 당긴다 → 움직임이 0.6초 넘게 멎을 때까지(최대 15초)
        await page2.evaluate(() => new Promise((ok) => { const m = window.ZP_lmx.map(); let still = 0; const t0 = Date.now(); const iv = setInterval(() => { still = m.isMoving() ? 0 : still + 1; if (still >= 4 || Date.now() - t0 > 15000) { clearInterval(iv); ok(); } }, 150); }));
        const z1 = await page2.evaluate(() => window.ZP_lmx.map().getZoom());
        await page2.waitForTimeout(2000);
        const z2 = await page2.evaluate(() => window.ZP_lmx.map().getZoom());
        expect(z1 >= 12.5 && Math.abs(z2 - z1) < 0.3, "desk.keepZone", "PC 목록 줄 누르면 지도가 그 구역에 머묾(상세가 열린 동안 서울 전체로 안 돌아감)", `${row}: zoom after fly ${z1.toFixed(2)} → +2s ${z2.toFixed(2)}`);
        await page2.keyboard.press("Escape"); await page2.waitForTimeout(500);
      } else skip("desk.keepZone", "PC 목록 줄 누르면 지도가 그 구역에 머묾", "no list row");
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
  // --- ui.onboard: 첫 실행 질문(저장된 조건·딥링크 없을 때만) → 2억을 고르면 카드·곳 수가 2억 · 딥링크·두 번째 방문은 건너뜀
  //     url.cash: ?cash=2 로 열면 2억 · ui.budgetSheet: 예산 시트 막대(고른 금액) 곳 수 == 카드 곳 수 == 시트 곳 수 == ZP_count
  {
    const T = "첫 실행 질문: 처음엔 '지금 쓸 수 있는 현금' 질문 · 2억 고르면 카드 2억·곳 수 == ZP_count(2) · 딥링크(#구역)·두 번째 방문은 질문 없음";
    const ctx = await browser.newContext({ ...M, serviceWorkers: "block" });   // IN_PAGE(질문 답한 사용자) 없이
    try {
      await ctx.route(BLOCK, (r) => r.abort());
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errs.push({ where: "/ (onboard)", msg: "pageerror: " + (e.message || String(e)).split("\n")[0].slice(0, 200) }));
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      const a = await page.evaluate(() => { const o = document.getElementById("onb"), r = o && o.getBoundingClientRect(); return { on: !!o && !o.hidden && r.width > 200 && r.height > 300, q: o ? o.innerText : "", chips: o ? [...o.querySelectorAll("[data-oc]")].map((b) => b.textContent.trim()) : [] }; });
      expect(a.on && /지금 쓸 수 있는 현금이 얼마예요\?/.test(a.q) && a.chips.join(",") === "5,000만,1억,2억,3억,5억,7억,10억,15억+,잘 모르겠어요 → 1억으로 둘러보기", "ui.onboard", T, `first run: shown ${a.on} · chips [${a.chips.join(", ")}]`);
      await page.tap('#onb [data-oc="2"]').catch(() => page.click('#onb [data-oc="2"]'));
      await page.waitForTimeout(250);
      const st2 = await page.evaluate(() => { const s = document.querySelector('#onb [data-st="2"]'); return !!s && !s.hidden && /집 있어요\?/.test(s.innerText) && s.querySelectorAll("[data-oh]").length === 4; });
      expect(st2, "ui.onboard", T, "second question '집 있어요?' with 4 choices not shown after picking cash");
      await page.click("#onb [data-olater]");
      await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1 && typeof window.ZP_count === "function", null, { timeout: 20000 }).catch(() => {});
      await settle(page, 900);
      const b = await page.evaluate(() => ({ hidden: document.getElementById("onb").hidden, lock: document.documentElement.classList.contains("onb-on"), v: document.getElementById("sCashV").textContent.trim(), n: document.getElementById("sN").textContent, zc: window.ZP_count(2), zcNow: window.ZP_count(), pc: (document.getElementById("pCash") || {}).value, url: location.search, cond: localStorage.getItem("jg-cond"), vt: document.getElementById("sCash").getAttribute("aria-valuetext") }));
      expect(b.hidden && !b.lock && b.v === "2억" && +b.pc === 2 && intOf(b.n) === b.zc && b.zcNow === b.zc, "ui.onboard", T, `after 2억: onb hidden ${b.hidden} lock ${b.lock} · card "${b.v}" · #sN ${b.n} vs ZP_count(2) ${b.zc} · pCash ${b.pc}`);
      expect(/[?&]cash=2(&|$)/.test(b.url) && /[?&]mode=jeonse/.test(b.url) && /cash=2/.test(b.cond || ""), "url.cash", "조건이 주소(?cash=&mode=)·localStorage에 남고, ?cash=2로 열면 2억(카드·계산기·곳 수)", `after onboarding: url "${b.url}" · jg-cond "${b.cond}"`);
      expect(b.vt === `2억, ${b.n}곳`, "ui.budgetSheet", "예산 시트: 고른 금액 막대 곳 수 == 카드 == 시트 숫자 == ZP_count · 슬라이더 aria-valuetext '2억, N곳'", `aria-valuetext "${b.vt}" vs "2억, ${b.n}곳"`);
      // 두 번째 방문(주소 없이 /): 질문 없이 2억 그대로
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(400);
      const c = await page.evaluate(() => ({ on: !document.getElementById("onb").hidden, v: document.getElementById("sCashV").textContent.trim() }));
      expect(!c.on && c.v === "2억", "ui.onboard", T, `second visit: onboarding shown ${c.on} · card "${c.v}"`);
      // 예산 시트: 2억 막대 == 카드 곳 수 == 시트 큰 숫자 == [N곳 보기]
      await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1, null, { timeout: 20000 }).catch(() => {});
      await settle(page, 600);
      await page.click("#sCashBtn"); await page.waitForTimeout(500);
      const d = await page.evaluate(() => { const bar = document.querySelector('#bHist i[data-c="2"]'), all = [...document.querySelectorAll("#bHist .scr-bars i")]; return { open: !document.getElementById("bSheet").hidden, bar: bar ? +bar.dataset.n : null, cur: bar ? bar.classList.contains("cur") : false, n: document.getElementById("sN").textContent, bN: document.getElementById("bN").textContent, go: document.getElementById("bGo").textContent, zc: window.ZP_count(2), bars: all.length, mono: all.every((x, i) => !i || +x.dataset.n >= +all[i - 1].dataset.n), more: document.getElementById("bMore").textContent, z25: window.ZP_count(2.5) }; });
      expect(d.open && d.bars >= 30 && d.bar === intOf(d.n) && d.bar === intOf(d.bN) && d.bar === d.zc && cntOf(d.go) === d.zc && d.cur, "ui.budgetSheet", "예산 시트: 고른 금액 막대 곳 수 == 카드 == 시트 숫자 == ZP_count · 슬라이더 aria-valuetext '2억, N곳'", `sheet open ${d.open} · bars ${d.bars} · bar@2억 ${d.bar} (cur ${d.cur}) · card ${d.n} · sheet ${d.bN} · go "${d.go}" · ZP_count(2) ${d.zc}`);
      const m = /5,000만 더 있으면\s*([\d,]+)곳 더/.exec(d.more);
      if (d.z25 > d.zc) expect(m && intOf(m[1]) === d.z25 - d.zc, "ui.budgetSheet", "예산 시트: '5,000만 더 있으면 N곳 더' == ZP_count(2.5) − ZP_count(2)", `"${d.more}" vs ${d.z25 - d.zc}`);
      // 칩 3억 → 카드·막대 같이
      await page.click('#bSheet [data-bc="3"]'); await settle(page, 700);
      const e = await page.evaluate(() => { const bar = document.querySelector('#bHist i[data-c="3"]'); return { bar: bar ? +bar.dataset.n : null, cur: bar ? bar.classList.contains("cur") : false, n: document.getElementById("sN").textContent, zc: window.ZP_count(3), v: document.getElementById("sCashV").textContent.trim() }; });
      expect(e.v === "3억" && e.cur && e.bar === intOf(e.n) && e.bar === e.zc, "ui.budgetSheet", "예산 시트: 고른 금액 막대 곳 수 == 카드 == 시트 숫자 == ZP_count · 슬라이더 aria-valuetext '2억, N곳'", `chip 3억: card "${e.v}" ${e.n} · bar ${e.bar} (cur ${e.cur}) · ZP_count(3) ${e.zc}`);
      await page.keyboard.press("Escape"); await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.getElementById("bSheet").hidden), "ui.budgetSheet", "예산 시트: Esc로 닫힘", "sheet still open after Escape");
      // 딥링크(새 기기 = 저장 없음)는 질문 없이 바로
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(BASE + "/?qac=onb#" + (api.zones[0] || {}).id, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(300);
      const f = await page.evaluate(() => !document.getElementById("onb").hidden);
      expect(!f, "ui.onboard", T, "zone deep link (#id) showed onboarding");
      // ?cash=2 (저장 없음): 질문 없이 2억 · 곳 수 == ZP_count(2)
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(BASE + "/?cash=2", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1 && typeof window.ZP_count === "function", null, { timeout: 20000 }).catch(() => {});
      await settle(page, 700);
      const g = await page.evaluate(() => ({ onb: !document.getElementById("onb").hidden, v: document.getElementById("sCashV").textContent.trim(), pc: (document.getElementById("pCash") || {}).value, n: document.getElementById("sN").textContent, zc: window.ZP_count(2), url: location.search, hash: location.hash }));
      expect(!g.onb && g.v === "2억" && +g.pc === 2 && intOf(g.n) === g.zc && /cash=2/.test(g.url), "url.cash", "조건이 주소(?cash=&mode=)·localStorage에 남고, ?cash=2로 열면 2억(카드·계산기·곳 수)", `?cash=2: onb ${g.onb} · card "${g.v}" · pCash ${g.pc} · #sN ${g.n} vs ZP_count(2) ${g.zc} · url "${g.url}"`);
      // 해시 딥링크와 함께: ?cash=3&mode=loan#news → 소식 화면 + 대출 끼고 3억(replaceState가 #을 지우지 않음)
      await page.goto(BASE + "/?cash=3&mode=loan#news", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const h = await page.evaluate(() => ({ hash: location.hash, on: (document.getElementById("news") || {}).classList?.contains("s-on"), mode: (document.querySelector('.s-mode button[aria-pressed="true"]') || {}).dataset?.f, pc: (document.getElementById("pCash") || {}).value, url: location.search }));
      expect(h.hash === "#news" && h.on && h.mode === "cash" && +h.pc === 3 && /mode=loan/.test(h.url), "url.cash", "조건이 주소(?cash=&mode=)·localStorage에 남고, ?cash=2로 열면 2억(카드·계산기·곳 수)", `?cash=3&mode=loan#news: hash ${h.hash} · news on ${h.on} · mode ${h.mode} · pCash ${h.pc} · url "${h.url}"`);
    } catch (e) { bad("ui.onboard", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  const { ctx, page } = await newPage(browser, M, errs);
  try {
    await loadHome(page); await settle(page, 500);
    await page.waitForSelector("#pcSave .pc-al-t b", { timeout: 6000 }).catch(() => {});   // 바쁜 기계에선 알림 카드가 늦게 붙는다
    // 용어: '내 핀' 없음(도구 목록·⋯ 메뉴·소식 칩·하단 탭) · 홈 알림 카드 문구가 줄 끝 한 낱말로 남지 않게(text-wrap balance)
    {
      const r = await page.evaluate(() => ({ t: window.__qc.domText(), tools: (window.ZP_TOOLS || []).map((x) => x[1]).join(","), wrap: (() => { const b = document.querySelector("#pcSave .pc-al-t b"); return b ? getComputedStyle(b).textWrap || getComputedStyle(b).textWrapStyle || "" : "none"; })() }));
      const m = r.t.match(/.{0,16}내 핀.{0,12}/);
      expect(!m && !/내 핀/.test(r.tools), "term.pin", "용어 '내 핀' 없음 → '관심 구역'(행동은 '핀 꽂고 알림 받기')", m ? `"${m[0]}"` : `ZP_TOOLS ${r.tools}`);
      expect(/balance/.test(r.wrap), "ui.alertWrap", "홈 알림 카드 문구 text-wrap: balance(외톨이 낱말 없음)", `text-wrap ${r.wrap}`);
    }
    // 정렬: 홈 목록·입지 순위에 '입주까지 현금 적은 순'·'입주 때 시세 차이 큰 순' · 목록 시세 선에 이름(aria-label)
    {
      const r = await page.evaluate(() => ({ s: [...document.querySelectorAll("#sortSheet [data-sort]")].map((o) => o.dataset.sort), rk: [...document.querySelectorAll("#rSort option")].map((o) => o.value) }));
      expect(["fit", "low", "move", "eta", "near", "gain"].every((k) => r.s.includes(k)) && r.rk.includes("move") && r.rk.includes("gain"), "list.sorts", "정렬 시트: 맞춤순·적은 돈·입주까지 현금·입주 빠른·역 가까운·시세 차이(홈 목록) · 입지 순위에 입주까지 현금·시세 차이", `sortSheet [${r.s}] rSort [${r.rk}]`);
      // 정렬 시트: 버튼 → 시트 → '역 가까운 순' → 버튼 글자 · 첫 카드가 역 거리 가장 짧은 곳
      await page.click("#sSortB").catch(() => {}); await page.waitForTimeout(300);
      const o = await page.evaluate(() => { const sh = document.getElementById("sortSheet"); const open = sh && !sh.hidden; const b = sh && sh.querySelector('[data-sort="near"]'); if (b) b.click(); return open; });
      await page.waitForTimeout(400);
      const n = await page.evaluate(() => ({ t: document.getElementById("sSortT").textContent, open: !document.getElementById("sortSheet").hidden, sub: [...document.querySelectorAll("#sList .s-sub")].slice(0, 3).map((e) => e.textContent) }));
      expect(o && !n.open && n.t === "역 가까운 순", "list.sorts", "정렬 시트: 맞춤순·적은 돈·입주까지 현금·입주 빠른·역 가까운·시세 차이(홈 목록) · 입지 순위에 입주까지 현금·시세 차이", `sheet open ${o} → "${n.t}" still open ${n.open} · ${n.sub.join(" / ")}`);
      await page.evaluate(() => { try { localStorage.setItem("emr.sort", "fit"); } catch (e) {} });
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
      const b = await page.$("#report .dt-fav, .sheet-bar .pn-hpin, .rep-t .pn-hpin");
      if (b) {
        // 앱이 다 붙은 뒤 누른다(바쁜 기계에서 섬 단계에 누르면 토스트 없이 늦게 처리되던 것 — 이전 SKIP 원인) · 토스트는 2.5초까지 기다림
        await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1 && typeof window.PINS === "object", null, { timeout: 10000 }).catch(() => {});
        await b.click().catch(() => {});
        await page.waitForFunction(() => { const t = document.getElementById("pnToast"); return t && t.classList.contains("on"); }, null, { timeout: 2500, polling: 100 }).catch(() => {});
        const o = await page.evaluate(() => { const t = document.getElementById("pnToast"); if (!t || !t.classList.contains("on")) return null; return [...t.querySelectorAll("b,small,span")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible" || e.closest(".pn-tt") && [...t.querySelectorAll("button")].some((bt) => { const a = e.getBoundingClientRect(), b = bt.getBoundingClientRect(); return a.right > b.left + 1 && b.right > a.left + 1 && a.bottom > b.top + 1 && b.bottom > a.top + 1; })).map((e) => e.className + ":" + e.textContent.slice(0, 20)); });
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
      // 19차: 왼쪽 칸은 페이지와 함께 한 번에 스크롤(목록 안 따로 스크롤하는 칸 없음) · 지도는 화면 아래 끝까지 붙어 있다
      await page.evaluate(() => scrollTo(0, scrollY + 600)); await page.waitForTimeout(500);
      const al = await page.evaluate(() => { const m = document.getElementById("mapbox").getBoundingClientRect(), l = document.getElementById("sList"); const ov = getComputedStyle(l).overflowY; return [Math.round(m.bottom), innerHeight, ov, l.scrollHeight - l.clientHeight]; });
      expect(Math.abs(al[0] - al[1]) <= 6 && !/auto|scroll/.test(al[2]), "ui.deskAlign", "PC: 목록 안 따로 스크롤 없음(왼쪽 칸이 페이지와 함께) · 지도 아래 끝 == 화면 아래 끝(±6px)", `map bottom ${al[0]} vs viewport ${al[1]} · list overflow ${al[2]} (inner overflow ${al[3]}px)`);
      // PC 두 칸: 왼쪽 420~440px · 지도 폭 ≥ 55% · 머리 바로 밑에 붙어(sticky) 화면 높이 · 확대 버튼·범례가 화면 안 · Tab 순서 예산 카드 → 지도 버튼
      for (const y of [0, 400, 2000]) {
        const L = await page.evaluate(async (y) => {
          scrollTo(0, y); await new Promise((r) => setTimeout(r, 250));
          const hd = document.getElementById("hdr").getBoundingClientRect().bottom, m = document.getElementById("mapbox").getBoundingClientRect(), l = document.getElementById("sRight").getBoundingClientRect();
          const z = document.querySelector("#lmap .lm-zoom"), zb = z ? z.getBoundingClientRect() : null, k = document.getElementById("lmKey"), kb = k && k.offsetWidth ? k.getBoundingClientRect() : null;
          const cb = document.getElementById("sCashBtn"), zbtn = z && z.querySelector("button");
          const tabOk = !!(cb && zbtn && cb.compareDocumentPosition(zbtn) & Node.DOCUMENT_POSITION_FOLLOWING);
          return { hd: Math.round(hd), mt: Math.round(m.top), mb: Math.round(m.bottom), mw: m.width / innerWidth, lw: Math.round(l.width), zb: zb ? Math.round(zb.bottom) : 1e9, kb: kb ? Math.round(kb.bottom) : 0, ih: innerHeight, tabOk, sy: Math.round(scrollY) };
        }, y);
        const top = L.sy > 0 ? Math.abs(L.mt - L.hd) <= 12 : L.mt <= L.hd + 12;
        expect(L.mw >= 0.55 && L.lw >= 420 && L.lw <= 440 && top && L.mb <= L.ih + 1 && L.zb <= L.ih && L.kb <= L.ih && L.tabOk, "ui.deskLayout", "PC 두 칸: 왼쪽 420~440px · 지도 ≥55% 폭 · 머리 밑 sticky · 확대 버튼·범례 화면 안 · Tab 예산 카드가 지도 버튼보다 먼저", `scroll ${y}→${L.sy}: map ${(L.mw * 100).toFixed(1)}% top ${L.mt} (hdr ${L.hd}) bottom ${L.mb}/${L.ih} · left ${L.lw}px · zoom bottom ${L.zb} · key ${L.kb} · tab order ${L.tabOk}`);
      }
      await page.evaluate(() => scrollTo(0, 0));
      // 홈 분모 글자는 없앴다 → 같은 판정(첫 화면 곳 수 함수 ZP_count, 전세 끼고, 금액 상한 없음)으로 모집단을 잰다
      await setMode(page, "gap");
      const cap = await page.evaluate(() => { try { return typeof window.ZP_count === "function" ? window.ZP_count(999) : null; } catch (e) { return null; } });
      await loadHome(page, "#gapTop"); await page.waitForTimeout(1200);
      const gn = await page.evaluate(() => { const e = document.querySelector("#gapTopOut [data-gapn]"); return e ? +e.dataset.gapn : null; });
      if (cap != null && gn != null) expect(gn === cap, "count.gapRank", "갭 순위 모집단 == 홈 곳 수 판정(ZP_count, 전세 끼고, 금액 상한 없음)", `gap rank ${gn} vs home ${cap}`); else skip("count.gapRank", "갭 순위 모집단 == 홈 곳 수 판정(ZP_count, 전세 끼고, 금액 상한 없음)", `cap ${cap} gn ${gn}`);
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
// ================================================================ 리뉴얼 3단계: 지도 알약·구 묶음·목록 ♡·막대 금액 끌기 (폰 390)
// ================================================================ 17차: 폰 지도 구 묶음 합 == 홈 곳 수 · 뒤로 가기 겹 · 새로고침 유지 · 시트 위 시트 없음
// (예전 map.guCluster는 그려진 묶음 숫자만 각 구 목록과 비교해, 겹쳐서 빠진 구는 보지 못했다 → 합을 본다)
async function navLane(browser, api, errs) {
  const mob = (w, h) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mapIdle = (page) => page.waitForFunction(() => { const m = window.ZP_lmx && window.ZP_lmx.map && window.ZP_lmx.map(); return m && !m.isMoving() && m.loaded(); }, null, { timeout: 15000, polling: 150 }).catch(() => {});
  // --- map.guCluster(합): 360·390 첫 화면(자동 맞춤) 여러 금액에서 Σ 구 묶음 + '+N곳' 칩 == ZP_count · 묶음은 지도 칸 안
  for (const [w, h] of [[360, 740], [390, 844]]) {
    if (over()) { skip("map.guCluster", "구 묶음", "time budget"); break; }
    const { ctx, page } = await newPage(browser, mob(w, h), errs);
    try {
      await loadHome(page); await settle(page, 500);
      await page.waitForFunction(() => window.ZP_lmx && window.ZP_lmx.gus && window.ZP_lmx.gus().length > 0, null, { timeout: 20000, polling: 200 }).catch(() => {});
      for (const [mode, c] of [["gap", 1], ["gap", 2], ["gap", 5], ["gap", 15], ["cash", 3]]) {
        await setMode(page, mode); await setCash(page, c);
        await page.evaluate(() => window.ZP_lmx.zoom(0)); await page.waitForTimeout(500); await mapIdle(page); await page.waitForTimeout(500);
        const g = await page.evaluate(() => { const G = window.ZP_lmx.gus(), cv = window.ZP_lmx.map().getCanvas().getBoundingClientRect(); const out = [...document.querySelectorAll("#lmap .zgu")].filter((e) => { const b = e.getBoundingClientRect(); return b.left < cv.left - 1 || b.right > cv.right + 1 || b.top < cv.top - 1 || b.bottom > cv.bottom + 1; }).map((e) => e.dataset.gu); return { n: window.ZP_count(), sum: G.reduce((a, x) => a + x.c, 0), more: window.ZP_lmx.gusMore ? window.ZP_lmx.gusMore() : -1, k: G.length, z: window.ZP_lmx.map().getZoom(), out }; });
        const where = `${w}px ${mode} ${c}억 z${g.z.toFixed(2)}`;
        if (g.z > 11.01) { ok("map.guCluster", "구 묶음"); continue; }   // 되는 곳이 적어 알약 줌으로 맞춘 경우
        expect(g.sum + g.more === g.n && g.k > 0 && !g.out.length, "map.guCluster", "폰 첫 화면 구 묶음 숫자 합 + '+N곳' 칩 == 홈 '갈 수 있는 곳'(어느 금액에서나) · 묶음은 지도 안", `${where}: clusters ${g.k} sum ${g.sum} + chip ${g.more} vs count ${g.n}${g.out.length ? ` · outside map: ${g.out}` : ""}`);
      }
    } catch (e) { bad("runtime", "검사 실행", `navLane cluster ${w} crashed: ` + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- map.guPills: 폰에서 구 묶음을 누르면 그 구 안 알약이 보인다(묶음 하나만 남아 누를 게 없던 18차 결함) · '+N곳' 칩은 구 안에서 숨김 · 칩을 누르면 구 목록이 열림
  for (const [w, h] of [[360, 740], [390, 844]]) {
    // 18차 결함 회귀라 시간 예산과 상관없이 돈다
    const { ctx, page } = await newPage(browser, mob(w, h), errs);
    const TG = "폰 구 묶음 누르면 알약 > 0 · 구 안에서는 '+N곳' 칩 숨김 · 칩 누르면 목록 열림";
    try {
      // ui.moreChip: 2억·전세 끼고(칩이 생기는 금액)에서 '+N곳 N개 구' 칩을 누르면 목록이 열리고, 목록의 구를 누르면 그 구로
      {
        await page.goto(BASE + "/?cash=2&mode=jeonse&qac=" + (++LOADS), { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForFunction(() => typeof window.ZP_count === "function", null, { timeout: 20000, polling: 100 }).catch(() => {});
        await page.evaluate(() => { try { window.ZP_boot && window.ZP_boot.quietNow && window.ZP_boot.quietNow(); } catch (e) {} const m = document.getElementById("mapbox"); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 70); });
        await page.waitForFunction(() => window.ZP_lmx && window.ZP_lmx.gus && window.ZP_lmx.gus().length > 0, null, { timeout: 25000, polling: 200 }).catch(() => {});
        await mapIdle(page); await page.waitForTimeout(500);
        const TC = "'+N곳 N개 구' 칩을 누르면 구 목록이 열리고, 그 구를 누르면 그 구로";
        const ch = await page.evaluate(() => { const e = document.getElementById("lmGuMore"); if (!e || e.hidden) return null; e.querySelector(".lm-gumore-b").click(); return { open: e.classList.contains("open"), ex: e.querySelector(".lm-gumore-b").getAttribute("aria-expanded"), n: e.querySelectorAll("li button[data-gu]").length, view: document.getElementById("mapbox").dataset.view }; });
        if (!ch) wrn("ui.moreChip", TC, `${w}px 2억: 칩 없음(모든 구 묶음이 화면 안)`);
        else {
          expect(ch.open && ch.ex === "true" && ch.n > 0 && ch.view !== "gu", "ui.moreChip", TC, `${w}px: open ${ch.open} aria-expanded ${ch.ex} items ${ch.n} view ${ch.view}`);
          const g2 = await page.evaluate(() => { const b = document.querySelector("#lmGuMore li button[data-gu]"); if (!b) return null; b.click(); return b.dataset.gu; });
          await page.waitForTimeout(1200); await mapIdle(page); await page.waitForTimeout(400);
          const v = await page.evaluate(() => ({ v: document.getElementById("mapbox").dataset.view, chip: !!(document.getElementById("lmGuMore") && !document.getElementById("lmGuMore").hidden), pills: document.querySelectorAll("#lmap button.zpill[data-zid]").length }));
          expect(v.v === "gu" && !v.chip && v.pills > 0, "ui.moreChip", TC, `${w}px ${g2}: view ${v.v} chip shown ${v.chip} pills ${v.pills}`);
        }
      }
      for (const gn of ["은평구", "영등포구", "강북구"]) {
        await loadHome(page); await settle(page, 400);
        await page.evaluate(() => { const m = document.getElementById("mapbox"); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 70); });
        await page.waitForFunction(() => window.ZP_lmx && window.ZP_lmx.gus && window.ZP_lmx.gus().length > 0, null, { timeout: 25000, polling: 200 }).catch(() => {});
        await mapIdle(page); await page.waitForTimeout(400);
        const hit = await page.evaluate((g) => { const e = document.querySelector(`#lmap .zgu[data-gu="${g}"]`); if (!e) return false; e.click(); return true; }, gn);
        if (!hit) { wrn("map.guPills", TG, `${w}px ${gn}: 묶음이 화면에 없음(칩 안)`); continue; }
        await page.waitForTimeout(900); await mapIdle(page); await page.waitForTimeout(500);
        const r = await page.evaluate(() => ({ v: document.getElementById("mapbox").dataset.view, pills: document.querySelectorAll("#lmap button.zpill[data-zid]").length, gus: document.querySelectorAll("#lmap .zgu").length, chip: !!(document.getElementById("lmGuMore") && !document.getElementById("lmGuMore").hidden), z: window.ZP_lmx.map().getZoom() }));
        expect(r.v === "gu" && r.pills > 0 && !r.gus && !r.chip, "map.guPills", TG, `${w}px ${gn}: view ${r.v} pills ${r.pills} clusters ${r.gus} chip ${r.chip} z${r.z.toFixed(2)}`);
      }
    } catch (e) { bad("runtime", "검사 실행", `guPills ${w} crashed: ` + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- ui.backStack · ui.reloadKeep · ui.noStack (390)
  const { ctx, page } = await newPage(browser, mob(390, 844), errs);
  const T = "뒤로 가기 = 맨 위 겹 하나만 닫기(신고 시트 → 상세 → 홈 · 구 확대 · 고른 카드 · 예산·정렬 시트) · 앱 밖(about:blank)으로 나가지 않음";
  const st = () => page.evaluate(() => ({ url: location.href, rep: !!(document.getElementById("dtRep") || document.getElementById("cfSheet")), sheet: document.getElementById("report").classList.contains("sheet"), view: (document.getElementById("mapbox") || {}).dataset ? document.getElementById("mapbox").dataset.view : "", pick: !!(document.getElementById("lmPick") && !document.getElementById("lmPick").hidden), bs: !!(document.getElementById("bSheet") && !document.getElementById("bSheet").hidden), ss: !!(document.getElementById("sortSheet") && !document.getElementById("sortSheet").hidden) }));
  const back = async () => { await page.goBack({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(700); return st(); };
  const inApp = (s) => s.url.startsWith(BASE);
  try {
    const zid = (api.zones.find((z) => z.id === "o1070") || api.zones.find((z) => z.need && z.need.gap && z.need.gap.now != null) || api.zones[0]).id;
    await loadHome(page, "#" + zid);
    await page.waitForFunction(() => document.querySelector("#report [data-dtrep]"), null, { timeout: 12000, polling: 150 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => { const b = document.querySelector("#report [data-dtrep]"); b && b.click(); }); await page.waitForTimeout(400);
    let s = await st();
    expect(s.rep && s.sheet, "ui.backStack", T, `#${zid}: 신고 시트 ${s.rep} 상세 ${s.sheet}`);
    s = await back();
    expect(!s.rep && s.sheet && inApp(s) && s.url.includes("#" + zid), "ui.backStack", T, `back 1 (신고 시트만 닫기): sheet open ${s.sheet} · 신고 ${s.rep} · ${s.url.replace(BASE, "")}`);
    s = await back();
    expect(!s.rep && !s.sheet && inApp(s), "ui.backStack", T, `back 2 (상세 닫기): sheet ${s.sheet} · ${s.url.replace(BASE, "")}`);
    // 예산 시트 · 정렬 시트
    await page.evaluate(() => { const b = document.getElementById("sCashBtn"); b && b.click(); }); await page.waitForTimeout(400);
    s = await st(); const bs0 = s.bs; s = await back();
    expect(bs0 && !s.bs && inApp(s), "ui.backStack", T, `budget sheet: open ${bs0} → after back open ${s.bs} · ${s.url.replace(BASE, "")}`);
    await page.evaluate(() => { const b = document.getElementById("sSortB"); b && b.click(); }); await page.waitForTimeout(400);
    s = await st(); const ss0 = s.ss; s = await back();
    expect(ss0 && !s.ss && inApp(s), "ui.backStack", T, `sort sheet: open ${ss0} → after back open ${s.ss} · ${s.url.replace(BASE, "")}`);
    // 구 묶음 → 알약 카드 → 뒤로(카드만) → 뒤로(서울 전체)
    await loadHome(page); await settle(page, 400);
    await page.waitForFunction(() => window.ZP_lmx && window.ZP_lmx.gus && window.ZP_lmx.gus().length > 0, null, { timeout: 20000, polling: 200 }).catch(() => {});
    await page.evaluate(() => { const m = document.getElementById("mapbox"); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 70); });
    await mapIdle(page); await page.waitForTimeout(600);
    const gn = await page.evaluate(() => { const g = window.ZP_lmx.gus().sort((a, b) => b.c - a.c)[0]; if (!g) return null; document.querySelector(`.zgu[data-gu="${g.n}"]`).click(); return g.n; });
    if (gn) {
      await page.waitForTimeout(1200); await mapIdle(page); await page.waitForTimeout(800);
      const pid = await page.evaluate(() => { const b = document.querySelector("#lmap button.zpill[data-zid]"); if (!b) return null; b.click(); return b.dataset.zid; });
      await page.waitForTimeout(500);
      s = await st();
      expect(s.view === "gu" && pid && s.pick, "ui.backStack", T, `${gn}: view ${s.view} · card ${s.pick} (pill ${pid}) — 구 안에서는 알약이 있어야 함`);
      if (pid) { s = await back(); expect(!s.pick && s.view === "gu" && inApp(s), "ui.backStack", T, `${gn} card back: card ${s.pick} view ${s.view} · ${s.url.replace(BASE, "")}`); }
      s = await back();
      expect(s.view !== "gu" && inApp(s), "ui.backStack", T, `${gn} back: view ${s.view} · ${s.url.replace(BASE, "")}`);
    } else bad("ui.backStack", T, "no 구 cluster to tap");
    // --- ui.reloadKeep: #my · #구역 새로고침해도 그 화면
    const TR = "새로고침해도 보던 화면 유지(#my · #구역 상세)";
    await loadHome(page, "#my"); await page.waitForTimeout(800); await page.reload({ waitUntil: "load" }); await page.waitForTimeout(2500);
    s = await page.evaluate(() => ({ h: location.hash, on: !!(document.getElementById("my") && document.getElementById("my").classList.contains("s-on")) }));
    expect(s.h === "#my" && s.on, "ui.reloadKeep", TR, `#my reload → hash "${s.h}" MY shown ${s.on}`);
    await loadHome(page, "#" + zid); await page.waitForTimeout(1500); await page.reload({ waitUntil: "load" }); await page.waitForTimeout(3500);
    s = await page.evaluate(() => ({ h: location.hash, sheet: document.getElementById("report").classList.contains("sheet"), t: (document.getElementById("repTitle") || {}).textContent || "" }));
    expect(s.h === "#" + zid && s.sheet && s.t, "ui.reloadKeep", TR, `#${zid} reload → hash "${s.h}" detail ${s.sheet} "${s.t}"`);
    // --- ui.noStack: 첫 관심 구역 추가 → '알림 받을 준비' 시트를 상세·토스트 위에 저절로 띄우지 않음 · 토스트 안 '알림 켜기'
    const TN = "시트 위에 시트 없음: 첫 관심 구역 추가 뒤 알림 시트가 저절로 뜨지 않고 토스트 안 '알림 켜기' 버튼으로";
    await page.evaluate(() => { try { localStorage.removeItem("zp-watch-pin"); localStorage.removeItem("jg-fav"); } catch (e) {} });
    await loadHome(page, "#" + zid); await page.waitForFunction(() => document.querySelector("#report .dt-fav"), null, { timeout: 12000, polling: 150 }).catch(() => {}); await page.waitForTimeout(500);
    await page.evaluate(() => { const b = document.querySelector("#report .dt-fav"); b && b.click(); }); await page.waitForTimeout(600);
    const t1 = await page.evaluate(() => { const t = document.getElementById("pnToast"); return { on: !!(t && t.classList.contains("on")), btns: t ? [...t.querySelectorAll("button")].map((b) => b.textContent.trim()) : [] }; });
    await page.waitForTimeout(2200);   // 토스트는 4초(20차 G11) — 그 안에 시트가 저절로 뜨지 않는지 보고, 토스트가 떠 있는 동안 '알림 받기'를 누른다
    const ws = await page.evaluate(() => !!document.getElementById("wsSheet"));
    expect(t1.on && t1.btns.includes("알림 받기") && t1.btns.includes("되돌리기") && !ws, "ui.noStack", TN, `toast ${t1.on} [${t1.btns}] · wsSheet after 2.8s ${ws}`);
    await page.evaluate(() => { const b = [...document.querySelectorAll("#pnToast button")].find((x) => x.textContent.trim() === "알림 받기"); b && b.click(); }); await page.waitForTimeout(600);
    const ws2 = await page.evaluate(() => ({ ws: !!document.getElementById("wsSheet"), toast: !!(document.getElementById("pnToast") && document.getElementById("pnToast").classList.contains("on")) }));
    expect(ws2.ws && !ws2.toast, "ui.noStack", TN, `'알림 켜기' → sheet ${ws2.ws} toast still on ${ws2.toast}`);
    s = await back(); const ws3 = await page.evaluate(() => !!document.getElementById("wsSheet"));
    expect(!ws3 && s.sheet && inApp(s), "ui.backStack", T, `alert sheet back: sheet gone ${!ws3} · detail ${s.sheet} · ${s.url.replace(BASE, "")}`);
  } catch (e) { bad("runtime", "검사 실행", "navLane crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await ctx.close().catch(() => {}); }
}
async function r3Lane(browser, errs) {
  const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, errs);
  const mapIdle = () => page.waitForFunction(() => { const m = window.ZP_lmx && window.ZP_lmx.map && window.ZP_lmx.map(); return m && !m.isMoving() && m.loaded(); }, null, { timeout: 15000, polling: 150 }).catch(() => {});
  // 지도 옮기기: 자동 맞춤(구 나가기·금액 바꾸기)이 끝난 뒤 옮기고, 그 자리에 머무는지 확인(최대 3번)
  const goTo = async (z, ct) => { for (let i = 0; i < 3; i++) { await mapIdle(); await page.waitForTimeout(300); await page.evaluate(([z, ct]) => window.ZP_lmx.map().jumpTo({ zoom: z, center: ct }), [z, ct]); await page.waitForTimeout(400); await mapIdle(); const zz = await page.evaluate(() => window.ZP_lmx.map().getZoom()); if (Math.abs(zz - z) < 0.05) break; } await page.waitForTimeout(300); };
  const firstLL = () => page.evaluate(() => { const id = (document.querySelector("#sList li.s-card") || {}).dataset?.zid; const f = (window.ZP_lmx.map().getSource("zlab").serialize().data.features || []).find((x) => x.properties.id === id); return f ? f.geometry.coordinates : [126.98, 37.55]; });
  try {
    await loadHome(page); await settle(page, 500);
    await setMode(page, "gap"); await setCash(page, 3);
    await page.evaluate(() => { const m = document.getElementById("mapbox"); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 70); });
    await mapIdle(); await page.waitForTimeout(600);
    // --- map.guCluster: 줌 11 이하 구 묶음 숫자 == 그 구 목록 곳 수(window.ZP_simple.guCount) · 누르면 목록 제목 곳 수가 같음
    {
      const T = "줌 11 이하 구 묶음 '구로 N곳 / 7,400만~' == 그 구 목록 곳 수·가장 적은 금액(누르면 목록 제목도 N곳)";
      await goTo(10.4, [126.98, 37.55]);
      const g = await page.evaluate(() => { const M = window.ZP_simple.guMins(); return (window.ZP_lmx.gus ? window.ZP_lmx.gus() : []).map((x) => ({ ...x, want: window.ZP_simple.guCount(x.n), wm: M[x.n] != null ? window.ZP_G.MT(M[x.n]) : "", list: window.ZP_simple.guCount(x.n) })); });
      expect(g.length > 0, "map.guCluster", T, `no 구 clusters at zoom 10.4`);
      // 21차: 두 줄 '강북 1곳' / '7,400만~'(그 구 갈 수 있는 곳 중 가장 적은 지금 필요한 돈)
      for (const x of g) expect(x.c === x.want && x.c > 0 && new RegExp(`${x.c}곳`).test(x.t) && !!x.wm && x.t.includes(x.wm) && x.lab.includes(x.n), "map.guCluster", T, `${x.n}: cluster ${x.c} "${x.t}" vs list ${x.want} min ${x.wm}`);
      if (g.length) {
        const pk = g[0];
        await page.evaluate((n) => { const b = document.querySelector(`.zgu[data-gu="${n}"]`); if (b) b.click(); }, pk.n); await page.waitForTimeout(1200); await settle(page, 300);
        const s = await page.evaluate(() => ({ t: document.getElementById("sLT").textContent, z: window.ZP_lmx.map().getZoom() }));
        expect(cntOf(s.t) === pk.c && s.t.includes(pk.n) && s.z >= 10.99, "map.guCluster", T, `tap ${pk.n} (${pk.c}): list title "${s.t}" zoom ${s.z.toFixed(2)}`);
        await page.evaluate(() => { const x = document.getElementById("sGuX"); if (x) x.click(); }); await page.waitForTimeout(800);
      }
    }
    // --- map.pills: 알약 ≤ 40 · 가능 알약 글자 == 목록 '지금' 값 · 상태 == 필요한 돈 vs 내 돈 · 이름 있는 버튼
    {
      const T = "지도 알약 ≤ 40개 · 알약 금액 == 목록 '지금' · 상태(가능/조금 모자람)가 필요한 돈 vs 내 돈과 맞음 · 접근 이름";
      for (const [mode, c, z] of [["gap", 3, 12.6], ["cash", 6, 12.2]]) {
        await setMode(page, mode); await setCash(page, c);
        // 목록을 끝까지 펼쳐 구역별 '지금' 값
        for (let i = 0; i < 40; i++) { const more = await page.evaluate(() => { const m = document.getElementById("sMore"); if (!m || m.hidden) return false; m.click(); return true; }); if (!more) break; await page.waitForTimeout(80); }
        const list = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#sList li.s-card")].map((li) => [li.dataset.zid, (li.querySelector(".s-amt .s-av b") || {}).textContent])));
        const ids = Object.keys(list);
        await goTo(z, await firstLL());
        const P = await page.evaluate(() => window.ZP_lmx.pills());
        const where = `${mode} ${c}억 z${z}`;
        expect(P.length > 0 && P.length <= 40, "map.pills", T, `${where}: ${P.length} pills`);
        for (const p of P) {
          const lab = /지금 필요한 돈/.test(p.lab) && p.lab.length > 12;
          if (p.st === "ok") expect(p.need <= c + 1e-9 && list[p.id] != null && p.t === list[p.id] && p.t === zfCash(p.need) && lab && /가능/.test(p.lab), "map.pills", T, `${where} ${p.id}: pill "${p.t}" list "${list[p.id]}" need ${p.need} label "${p.lab}"`);
          else if (p.st === "near") { const want = zfCash(Math.max(0.01, Math.ceil(p.need * 100 - 1e-6) / 100 - c)) + " 부족"; /* 모자란 곳은 '5,700만 부족' */ expect(p.need > c && p.need <= c * 1.2 + 1e-9 && p.t === want && list[p.id] == null && /조금 모자람/.test(p.lab), "map.pills", T, `${where} ${p.id}: near pill "${p.t}" want "${want}" need ${p.need} in list ${list[p.id] != null}`); }
          else bad("map.pills", T, `${where} ${p.id}: pill with state ${p.st}`);
        }
        // 알약끼리 겹치지 않음(보이는 알약 상자)
        const ov = await page.evaluate(() => { const B = [...document.querySelectorAll("#lmap .zpill .zp-in")].map((e) => e.getBoundingClientRect()); let n = 0; for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], b = B[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) n++; } return n; });
        expect(!ov, "map.pills", T, `${where}: ${ov} overlapping pills`);
      }
      // 금액을 바꾸면 알약이 바로(다음 몇 프레임 안에) 따라옴
      await setMode(page, "gap"); await setCash(page, 3);
      await goTo(12.6, await firstLL());
      const t0 = await page.evaluate(async () => { const s = document.getElementById("sCash"); const fits = (c) => { const P = window.ZP_lmx.pills(); return P.length > 0 && P.every((p) => (p.st === "ok" ? p.need <= c + 1e-9 : p.need > c && p.need <= c * 1.2 + 1e-9)); }; if (!fits(3)) return -2; s.value = String(window.ZP_simple.toPos(2)); s.dispatchEvent(new Event("input", { bubbles: true })); for (let i = 1; i <= 30; i++) { await new Promise((r) => requestAnimationFrame(r)); if (fits(2)) return i; } return -1; });
      // 금액 입력 → 다음 프레임(목록과 같은 프레임)에 알약이 새 금액 기준 · 기계가 바빠도 프레임 수로 잰다(실기기 한 프레임 ≈ 16ms)
      expect(t0 >= 1 && t0 <= 2, "map.pills", T, `pills did not follow a budget change within 2 frames (${t0} frames)`);
      await setCash(page, 3);
    }
    // --- list.heart: 카드 ♡ → 관심 구역 · 관심 탭 이름에 곳 수 · 되돌리기 토스트 · 다시 누르면 빠짐
    {
      const T = "목록 카드 ♡(44px)가 관심 구역을 켜고 끔 · 관심 탭 곳 수 · 되돌리기 토스트";
      await page.evaluate(() => { try { localStorage.removeItem("jg-fav"); } catch (e) {} });
      await loadHome(page); await settle(page, 600);
      const a = await page.evaluate(async () => {
        const h = document.querySelector("#sList .s-heart"); if (!h) return null;
        const id = h.dataset.heart, r = h.getBoundingClientRect(); h.click(); await new Promise((r) => setTimeout(r, 400));
        const nav = document.querySelector('#sNav [data-nav="fav"]'), t = document.getElementById("pnToast");
        return { id, w: Math.round(r.width), hh: Math.round(r.height), on: window.PINS.list().includes(id), pressed: document.querySelector(`#sList .s-heart[data-heart="${id}"]`).getAttribute("aria-pressed"), nav: nav ? nav.getAttribute("aria-label") : "", toast: t && t.classList.contains("on") ? t.textContent : "", undo: !!(t && t.querySelector("button")) };
      });
      if (!a) bad("list.heart", T, "no ♡ in list");
      else {
        expect(a.on && a.pressed === "true" && /관심( 구역)?\s*1곳/.test(a.nav) && a.toast && a.undo && a.w >= 44 && a.hh >= 44, "list.heart", T, JSON.stringify(a));
        const b = await page.evaluate(async (id) => { document.querySelector(`#sList .s-heart[data-heart="${id}"]`).click(); await new Promise((r) => setTimeout(r, 400)); return { on: window.PINS.list().includes(id), pressed: document.querySelector(`#sList .s-heart[data-heart="${id}"]`).getAttribute("aria-pressed"), nav: document.querySelector('#sNav [data-nav="fav"]').getAttribute("aria-label") }; }, a.id);
        expect(!b.on && b.pressed === "false" && (!/곳/.test(b.nav) || /관심 구역 0곳/.test(b.nav)), "list.heart", T, `second tap: ${JSON.stringify(b)}`);
      }
    }
    // --- list.infinite: 목록 끝에 닿으면 20곳씩 더(누르지 않아도) · 줄 + 더 보기 == 제목
    {
      const T = "목록 무한 스크롤: 끝에 닿으면 더 불러옴 · 줄 수 + '더 보기 (N곳)' == 제목 곳 수";
      await setCash(page, 6);
      const r0 = await page.evaluate(() => document.querySelectorAll("#sList li.s-card").length);
      for (let i = 0; i < 3; i++) { await page.evaluate(() => { const l = document.querySelector("#sList li.s-card:last-child"); if (l) l.scrollIntoView({ block: "end" }); }); await page.waitForTimeout(400); }
      const s = await page.evaluate(() => ({ rows: document.querySelectorAll("#sList li.s-card").length, more: document.getElementById("sMore").hidden ? "" : document.getElementById("sMore").textContent, t: document.getElementById("sLT").textContent }));
      expect(s.rows > r0 && s.rows + (intOf(s.more) || 0) === cntOf(s.t), "list.infinite", T, `rows ${r0} → ${s.rows} · more "${s.more}" · title "${s.t}"`);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    // --- ui.scrub: 홈 카드 막대를 1억 → 3억으로 끌면 금액·곳 수 == ZP_count(3) · 막대 위 세로로 밀면 페이지가 스크롤
    {
      const T = "막대로 금액 끌기: 1억→3억 끌면 카드 3억 · 곳 수 == ZP_count(3) == 손잡이 막대 · 세로로 밀면 페이지 스크롤";
      await setCash(page, 1); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(900);
      await page.waitForFunction(() => document.querySelectorAll("#sScrub .scr-bars i").length > 20, null, { timeout: 5000, polling: 100 }).catch(() => {});
      await mapIdle(); await page.waitForTimeout(300);
      const pos = await page.evaluate(() => { const b = document.querySelector("#sScrub .scr-bars").getBoundingClientRect(); const x = (c) => b.left + (window.ZP_simple.toPos(c) / 100) * b.width; return { y: b.top + b.height / 2, x1: x(1), x3: x(3), top: b.top }; });
      const cdp = await ctx.newCDPSession(page);
      const tp = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      await tp("touchStart", pos.x1, pos.y);
      for (let i = 1; i <= 10; i++) { await tp("touchMove", pos.x1 + ((pos.x3 - pos.x1) * i) / 10, pos.y + (i % 2)); await page.waitForTimeout(30); }
      await tp("touchEnd"); await settle(page, 700);
      const s = await page.evaluate(() => { const cur = document.querySelector("#sScrub .scr-bars i.cur"); return { v: document.getElementById("sCashV").textContent.trim(), n: document.getElementById("sN").textContent, zc: window.ZP_count(3), bar: cur ? +cur.dataset.n : null, vt: document.getElementById("sCash").getAttribute("aria-valuetext") }; });
      expect(s.v === "3억" && intOf(s.n) === s.zc && s.bar === s.zc && /^3억, [\d,]+곳$/.test(s.vt || ""), "ui.scrub", T, JSON.stringify(s));
      const y0 = await page.evaluate(() => scrollY);
      await tp("touchStart", pos.x3, pos.y);
      for (let i = 1; i <= 10; i++) { await tp("touchMove", pos.x3 + (i % 2), pos.y - 22 * i); await page.waitForTimeout(25); }
      await tp("touchEnd"); await page.waitForTimeout(600);
      const s2 = await page.evaluate(() => ({ y: scrollY, v: document.getElementById("sCashV").textContent.trim() }));
      expect(s2.y > y0 + 40 && s2.v === "3억", "ui.scrub", T, `vertical swipe on bars: scrollY ${y0} → ${s2.y} · amount "${s2.v}"`);
    }
    // --- list.spark: 목록에는 흐름선 없음 · 구역 상세 실거래 칸에 이름 있는 흐름선
    {
      const T = "2년 시세 흐름선은 목록이 아니라 구역 상세(실거래 칸)에 · aria-label 있음";
      const n = await page.evaluate(() => document.querySelectorAll("#sList .s-sp").length);
      expect(n === 0, "list.spark", T, `${n} sparklines still in the list`);
      let done = false;
      for (const id of ["o281", "o916", "o337", "o586"]) {
        await loadHome(page, "#" + id); await page.waitForTimeout(2500);
        const r = await page.evaluate((id) => ({ sp: [...document.querySelectorAll("#report .s-sp")].map((e) => e.getAttribute("aria-label") || ""), has: !!window.ZP_simple.spark(id) }), id);
        if (!r.has && !r.sp.length) continue;
        expect(r.sp.length === 1 && r.sp[0].length > 4, "list.spark", T, `${id}: report sparklines ${JSON.stringify(r.sp)}`); done = true; break;
      }
      if (!done) skip("list.spark", T, "no zone with 2-year data among samples");
    }
  } catch (e) { bad("runtime", "검사 실행", "r3Lane crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await ctx.close().catch(() => {}); }
}
// ================================================================ 리뉴얼 4·5단계: 상세 첫 화면 3숫자 · 숫자 신고 · 용어집 · 면책 한 번
// 용어집(docs/benchmark_brief.md 1-8): 내 돈 / 지금 필요한 돈 / 입주까지 현금 / 입주 / 관심 구역 / 갈 수 있는 곳 — 같은 개념의 다른 이름은 실패
const TERM_BAN = [
  [/가능 금액/, "가능 금액 → 지금 필요한 돈·내 돈"], [/살 수 있는 곳/, "살 수 있는 곳 → 갈 수 있는 곳"], [/이 돈이면/, "이 돈이면 → 갈 수 있는 곳"],
  [/필요 현금|필요한 현금|필요 돈/, "필요 현금 → 지금 필요한 돈·입주까지 현금"], [/(?<!집)핀(?!\s*Zippin)/, "핀(저장한 구역) → 관심 구역"], [/부족액|부족분/, "부족액 → 'N 더 필요해요'"],
  [/내 현금/, "내 현금 → 내 돈"], [/찜|즐겨찾기/, "찜 → 관심 구역"], [/관심구역|관심 지역/, "관심구역 → 관심 구역"], [/입주까지 총/, "입주까지 총 → 입주까지 현금"],
  [/(?<![가-힣])갭(?![가-힣]*투자)/, "갭 → 전세 끼고"], [/실행 취소/, "실행 취소 → 되돌리기"],
  // 17차: '살 수 있'(갈 수 있) · 가용 현금 · 5천만(5,000만) · 계산 안 해요(계산하지 않아요) · 지금 바로 쓸 수 있는 현금(지금 쓸 수 있는 현금)
  [/살 수 있/, "살 수 있 → 갈 수 있"], [/가용 현금/, "가용 현금 → 내 돈"], [/5천만/, "5천만 → 5,000만"], [/계산 안 해요/, "계산 안 해요 → 계산하지 않아요"], [/지금 바로 쓸 수 있는 현금/, "지금 바로 쓸 수 있는 현금 → 지금 쓸 수 있는 현금"],
];
// 앱 코드(JS 묶음)의 화면 글자에서 찾을 말(코드 속 낱말 '핀'·'갭' 등은 빼고 글자로만 쓰이는 것)
const TERM_BAN_JS = [/살 수 있/, /가용 현금/, /필요 현금/, /5천만/, /내 현금/, /계산 안 해요/, /지금 바로 쓸 수 있는 현금/, /살 수 있게 됨/];
const TERM_FIRST = [[/권리가액/, /내 지분 값\(권리가액\)/, "권리가액 첫 언급 → '내 지분 값(권리가액)'"], [/프리미엄/, /웃돈\(프리미엄\)/, "프리미엄 첫 언급 → '웃돈(프리미엄)'"]];
function termScan(txt, where, noDisc) {
  const T = "용어집만: 같은 개념을 다른 말로 부르지 않음(가능 금액·살 수 있는 곳·이 돈이면·필요 현금·핀·부족액·내 현금…) · 권리가액·프리미엄 첫 언급은 쉬운 말(원래 말)";
  const hits = [];
  for (const [re, nm] of TERM_BAN) { const m = new RegExp(".{0,18}" + re.source + ".{0,18}").exec(txt); if (m) hits.push(`[${nm}] "${m[0].replace(/\s+/g, " ")}"`); }
  for (const [re, full, nm] of TERM_FIRST) { const i = txt.search(re); if (i >= 0) { const j = txt.search(full); if (j < 0 || j > i - 6) hits.push(`[${nm}] "${txt.slice(Math.max(0, i - 14), i + 14).replace(/\s+/g, " ")}"`); } }
  expect(!hits.length, "term.glossary", T, `${where}: ${hits.slice(0, 3).join(" ; ")}`);
  const dn = (txt.match(/투자 권유/g) || []).length;
  if (!noDisc) expect(dn <= 1, "term.disclaimer", "면책 문구('투자 권유 아님')는 화면마다 한 번 이하 · 구역 상세는 맨 아래 한 번", `${where}: ${dn} times`);
}
async function r4Lane(browser, api, errs) {
  const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, errs);
  const ids = new Set(api.zones.map((z) => z.id));
  try {
    await loadHome(page);
    await setMode(page, "gap");
    termScan(await page.evaluate(() => document.body.innerText), "home(지도·예산 카드·갈 수 있는 곳 목록)");
    // ---- zone.fold3: 390×844 첫 화면(스크롤 전)에 3숫자 + 신뢰 한 줄 · 입주권 안 나오는 구역 포함 5곳 ----
    const cheap = api.zones.filter((z) => z.need.gap.now != null).sort((a, b) => a.need.gap.now - b.need.gap.now).map((z) => z.id);
    const FOLD = [...new Set(["o916", "o337", "o586", "o281", "o419", ...cheap.slice(0, 2)])].filter((i) => ids.has(i)).slice(0, 6);
    const T3 = "상세 첫 화면(390×844, 스크롤 전)에 3숫자(지금 필요한 돈 · 입주까지 현금 · 언제 입주/입주권) + 신뢰 한 줄 · 추정 칩 하나";
    let noIp = 0;
    for (const zid of FOLD) {
      page.__where = "#" + zid;
      await page.evaluate(() => { const t = document.getElementById("repTitle"); if (t) t.__qcOld = 1; });
      await page.evaluate((i) => { location.hash = "#" + i; }, zid);
      const opened = await page.waitForFunction(() => { const t = document.getElementById("repTitle"); return t && !t.__qcOld && document.querySelector("#report .dt-k"); }, null, { timeout: 8000, polling: 80 }).then(() => true, () => false);
      if (!opened) { bad("zone.fold3", T3, `#${zid}: report or trust line did not render`); continue; }
      await page.waitForTimeout(500);
      const f = await page.evaluate(() => {
        const rp = document.getElementById("report"); rp.scrollTop = 0;
        const H = innerHeight, bar = rp.querySelector(".dt-bar"), bh = bar ? bar.getBoundingClientRect().height : 0;
        const its = [...rp.querySelectorAll(".dt-k .dt-i")].map((e) => { const b = e.getBoundingClientRect(), v = e.querySelector(".dt-v"); return { k: e.dataset.k, l: (e.querySelector(".dt-l") || {}).textContent, v: v ? v.textContent.trim() : "", fs: v ? parseFloat(getComputedStyle(v).fontSize) : 0, fw: v ? +getComputedStyle(v).fontWeight : 0, tab: v ? getComputedStyle(v).fontVariantNumeric : "", bot: Math.round(b.bottom), top: Math.round(b.top) }; });
        const tr = rp.querySelector(".dt-trust"), tb = tr && tr.getBoundingClientRect();
        const ip = rp.querySelector('.dt-k [data-k="eta"] .dt-ip');
        const head = rp.querySelector(".rep-head"); const est = head ? (head.innerText.match(/추정/g) || []).length : 0;
        const top = rp.querySelector(".dt-top"), eta = rp.querySelector('.dt-k [data-k="eta"] .dt-v');
        return { H, bh: Math.round(bh), its, trBot: tb ? Math.round(tb.bottom) : null, trTxt: tr ? tr.innerText.replace(/\s+/g, " ") : "", ip: ip ? ip.innerText.replace(/\s+/g, " ") : "", est, noip: !!rp.querySelector(".dt-top .ov-noip"), eta: eta ? eta.textContent.trim() : "", nt: !!rp.querySelector(".dt-k .dt-nt"), ipN: top ? (top.innerText.match(/입주권 없음/g) || []).length : 0, why: top ? (top.innerText.match(/이유 보기/g) || []).length : 0, okN: top ? (top.innerText.match(/가능/g) || []).length : 0 };
      });
      const lim = f.H - f.bh;
      const labs = f.its.map((x) => x.l).join("|");
      const ntZ = f.its.length === 3 && f.its[2].l === "입주권";
      expect(f.its.length === 3 && LAB3.test(labs), "zone.fold3", T3, `#${zid}: items ${labs}`);
      expect(f.its.every((x) => x.v && x.bot <= lim), "zone.fold3", T3, `#${zid}: item bottoms ${f.its.map((x) => x.bot).join("/")} > fold ${lim} (viewport ${f.H} − bar ${f.bh})`);
      if (!ntZ) expect(f.trBot != null && f.trBot <= lim, "zone.fold3", T3, `#${zid}: trust line bottom ${f.trBot} > fold ${lim}`);
      expect(f.its.every((x) => x.fs >= 24 && x.fw >= 700 && /tabular-nums/.test(x.tab)), "zone.fold3", T3, `#${zid}: number style ${f.its.map((x) => `${x.fs}/${x.fw}/${x.tab}`).join(" ")}`);
      expect(f.est <= 1, "zone.fold3", T3, `#${zid}: '추정' ${f.est} times on first screen`);
      // 입주권 없는 곳: '언제 입주' 칸이 '입주권 없음' + 일반분양 한 줄(입주권 이야기는 첫 화면에 한 번 · 몇 년 뒤 입주 숫자 없음) · 신뢰 줄 '계산 안 함'
      // 입주권 없는 곳(셋째 칸 '입주권'): 값 '없음'·'조합원 입주권을 사야 해요' · 이유 한 줄 한 번 · '입주권 없음' 반복·'이유 보기' 줄 없음(20차 G3)
      if (ntZ) { noIp++; expect(/^(없음|조합원 입주권을 사야 해요)$/.test(f.eta) && !f.ip && f.nt && !f.noip && f.ipN <= 1 && !f.why && !f.trTxt, "zone.fold3", T3, `#${zid}: no-입주권 zone: eta "${f.eta}" chip "${f.ip}" note ${f.nt}/${f.noip} '입주권 없음' ×${f.ipN} '이유 보기' ×${f.why} trust "${f.trTxt}"`); }
      else { expect(/^입주권 /.test(f.ip), "zone.fold3", T3, `#${zid}: 입주권 chip "${f.ip}"`); expect(!/✕/.test(f.ip), "zone.fold3", T3, `#${zid}: '입주권 ✕' chip but 언제 입주 "${f.eta}"`); }
      expect(f.okN <= 1, "zone.fold3", T3, `#${zid}: '가능' ${f.okN} times on first screen (one status row)`);
      // ---- zone.report: '이 숫자가 틀렸어요' → 메일(구역 ID 자동) · 주소 복사 · 고마워요 ----
      if (FOLD.indexOf(zid) < 3) {
        const TR = "'이 숫자가 틀렸어요': 사이트 안 문의 양식(시트) · 이유 5가지 · 보내면 구역 ID·주소·데이터 기준·화면 숫자·고른 이유가 함께 감 · '잘 받았어요' · 메일 주소 안 보임";
        const sent = [];
        await page.route("**/api/contact", (rt) => { try { sent.push(JSON.parse(rt.request().postData() || "{}")); } catch (e) {} rt.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
        const rr = await page.evaluate(async () => {
          const b = document.querySelector("#report [data-dtrep]"); if (!b) return { none: 1 };
          b.click(); await new Promise((r) => setTimeout(r, 300));
          const s = document.getElementById("cfSheet"); if (!s) return { nosheet: 1 };
          const radios = s.querySelectorAll('.cf-r input[type=radio]').length, kind = (s.querySelector('.cf-k input:checked') || {}).value;
          const st = s.querySelector('.cf-r input[value="stage"]'); if (st) st.click();
          const tx = s.querySelector("textarea"); tx.value = "QA 확인 · 단계 날짜가 달라요"; tx.dispatchEvent(new Event("input", { bubbles: true }));
          s.querySelector(".cf-go").click();
          for (let i = 0; i < 30 && !s.querySelector(".cf-ok"); i++) await new Promise((r) => setTimeout(r, 100));
          const out = { radios, kind, ok: (s.querySelector(".cf-ok") || {}).innerText || "", at: /@/.test(s.innerText) };
          const x = s.querySelector(".cf-x"); if (x) x.click(); await new Promise((r) => setTimeout(r, 150));
          out.closed = !document.getElementById("cfSheet");
          return out;
        });
        await page.unroute("**/api/contact").catch(() => {});
        if (rr.none || rr.nosheet) bad("zone.report", TR, `#${zid}: ${rr.none ? "no button" : "sheet did not open"}`);
        else {
          const m = sent[0] || {};
          expect(rr.radios === 5 && rr.kind === "error" && !rr.at, "zone.report", TR, `#${zid}: radios ${rr.radios} kind ${rr.kind} address shown ${rr.at}`);
          expect(sent.length === 1 && m.zone === zid && /\d{4}\.\d\d\.\d\d/.test(m.asOf || "") && String(m.url || "").includes(zid) && m.why === "단계" && /지금 필요한 돈/.test(m.nums || "") && /QA 확인/.test(m.text || "") && m.kind === "error", "zone.report", TR, `#${zid}: sent ${JSON.stringify(m).slice(0, 220)}`);
          expect(/잘 받았어요/.test(rr.ok) && rr.closed, "zone.report", TR, `#${zid}: confirmation "${rr.ok}" closed ${rr.closed}`);
        }
      }
    }
    if (FOLD.length && !noIp) bad("zone.fold3", T3, "no 입주권 ✕ zone among fold samples");
    // ---- 상세 3곳 × 탭 5개 용어 · 면책(맨 아래 한 번) ----
    for (const zid of ["o916", "o337", "o586"].filter((i) => ids.has(i))) {
      await page.evaluate((i) => { location.hash = "#" + i; }, zid);
      await page.waitForFunction((i) => window.__zpCur && window.__zpCur() === i && document.querySelector("#report .dt-end"), zid, { timeout: 8000, polling: 100 }).catch(() => {});
      await page.waitForTimeout(400);
      for (const k of ["money", "biz", "tx", "loc", "req"]) {
        await page.evaluate((k) => { const t = document.querySelector(`#report [role=tab][data-tab="${k}"]`); t && t.click(); }, k);
        await page.waitForTimeout(700);
        const t = await page.evaluate(() => document.getElementById("report").innerText);
        termScan(t, `detail #${zid}/${k}`);
        if (k === "money") { const endT = await page.evaluate(() => (document.querySelector("#report .dt-end") || {}).innerText || ""); expect((t.match(/투자 권유/g) || []).length === 1 && /투자 권유/.test(endT), "term.disclaimer", "면책 문구('투자 권유 아님')는 화면마다 한 번 이하 · 구역 상세는 맨 아래 한 번", `detail #${zid}: ${(t.match(/투자 권유/g) || []).length} in report, bottom block has it: ${/투자 권유/.test(endT)}`); }
      }
      await page.evaluate(() => { const x = document.getElementById("sheetClose"); x && x.click(); });
      await page.waitForTimeout(500);
    }
    // ---- 관심 · 소식 · MY (아래 탭) ----
    await page.evaluate(() => { try { localStorage.setItem("jg-fav", JSON.stringify(["o916", "o337"])); } catch (e) {} });
    await loadHome(page);
    for (const n of ["fav", "news", "my"]) {
      await page.evaluate((n) => { const e = [...document.querySelectorAll(`[data-nav="${n}"]`)].find((x) => x.offsetParent); e && e.click(); }, n);
      await page.waitForTimeout(1300);
      termScan(await page.evaluate(() => document.body.innerText), `tab ${n}`);
    }
    await page.evaluate(() => { try { localStorage.removeItem("jg-fav"); } catch (e) {} });
  } catch (e) { bad("runtime", "검사 실행", "r4Lane crashed: " + String(e.message || e).split("\n")[0]); }
  finally { await ctx.close().catch(() => {}); }
  // ---- 정적 /z 5곳 · /gu 2곳: 용어 · 면책 · 첫 화면 3숫자 · 신고 메일 ----
  const zs = ["o916", "o337", "o586", "o1048", "o1173"].filter((i) => ids.has(i) || i === "o1048");
  for (const zid of zs) {
    const r = await getPage("/z/" + zid); if (r.status !== 200) { bad("z.key3", "/z 첫 화면 3숫자 + 신뢰 한 줄 + '이 숫자가 틀렸어요' 메일(구역 ID)", `/z/${zid} → ${r.status}`); continue; }
    const Z = parseZ(r.text), t = htmlText(r.text.replace(/<head[\s\S]*?<\/head>/i, ""));
    termScan(t, `/z/${zid}`);
    const subj = Z.key && Z.key.mail ? Z.key.mail.replace(/&amp;/g, "&") : "";
    expect(Z.key && LAB3.test(Z.key.labs) && (/class="zk-tr/.test(r.text) || /입주권$/.test(Z.key.labs)) && subj.endsWith(`contact?kind=error&zone=${zid}`) && /<script src="\/cf\.js"/.test(r.text), "z.key3", "/z 첫 화면 3숫자 + 신뢰 한 줄 + '이 숫자가 틀렸어요' 문의 양식(구역 ID)", `/z/${zid}: labels ${Z.key && Z.key.labs} report link "${subj}"`);
  }
  for (const g of ["구로구", "강남구"]) { const r = await getPage("/gu/" + g); if (r.status === 200) termScan(htmlText(r.text.replace(/<head[\s\S]*?<\/head>/i, "")), `/gu/${g}`); }
}
// ================================================================ 17차 2부: 이름으로 답하기 · 고른 상태 남색 · 알림 하나 · 끄는 동안 숫자 · 용어(코드·메타·매니페스트·리포트)
// ================================================================ 19차: 지도 자리 그림 = 실제 지도 · 붙일 때 긴 작업 · 홈 막대 슬라이더 · PC 구 화면 뒤로 · 돈 꼴 · 검색 배지
async function r19Lane(browser, api, errs) {
  const mob = (w, h) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  // --- map.staticMatch: 자리 그림(ghost)의 구 묶음 = 실제 지도의 구 묶음(숫자·자리 ±2px) · 보이는 합 + 칩 == 홈 곳 수 (2억 · 0.1억)
  const TS = "지도 자리 그림(실제 지도 전)과 실제 지도의 구 묶음이 같다(곳 수·자리) · 묶음 합 + '+N곳' == 홈 곳 수";
  for (const [w, h, c] of [[390, 844, 2], [360, 740, 2], [390, 844, 0.1]]) {
    const { ctx, page } = await newPage(browser, mob(w, h), errs);
    try {
      page.__where = `/?cash=${c}`;
      await page.goto(BASE + `/?cash=${c}&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.evaluate(() => { const m = document.getElementById("mapbox"); if (m) window.scrollTo(0, Math.max(0, m.getBoundingClientRect().top + scrollY - 120)); });
      const g = await page.waitForFunction(() => {
        const ghost = window.ZP_G && window.ZP_G.on(), L = window.ZP_lmx, m = L && L.map && L.map();
        if (!ghost) return m && L.gus().length ? { gone: 1 } : null;
        const lm = document.querySelectorAll("#lmap .zgu"), n = +((document.getElementById("sN") || {}).textContent || "").replace(/\D/g, "");
        if (!(m && performance.getEntriesByName("zp-ov1").length && L.gus().length === lm.length && (lm.length || n === 0))) return null;
        const R = (e) => { const r = e.getBoundingClientRect(); return [+e.dataset.n, Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), Math.round(r.width)]; };
        const A = {}, B = {}; document.querySelectorAll(".zp-ph .zg-mk .zgu").forEach((e) => (A[e.dataset.gu] = R(e))); lm.forEach((e) => (B[e.dataset.gu] = R(e)));
        return { A, B, gm: window.ZP_G.more(), lm: L.gusMore(), n, cnt: typeof window.ZP_count === "function" ? window.ZP_count() : n };
      }, null, { timeout: 60000, polling: 50 }).then((x) => x.jsonValue()).catch((e) => ({ err: String(e.message || e).slice(0, 80) }));
      const where = `${w}px ${c}억`;
      if (g.err || g.gone) { bad("map.staticMatch", TS, `${where}: ${g.err ? "자리 그림·실제 지도를 함께 볼 수 없음 " + g.err : "실제 지도가 붙기 전에 자리 그림이 사라짐"}`); continue; }
      const diff = [];
      for (const k of new Set([...Object.keys(g.A), ...Object.keys(g.B)])) { const a = g.A[k], b = g.B[k]; if (!a || !b || a[0] !== b[0] || Math.abs(a[1] - b[1]) > 2 || Math.abs(a[2] - b[2]) > 2 || Math.abs(a[3] - b[3]) > 2) diff.push(`${k} ${JSON.stringify(a)}/${JSON.stringify(b)}`); }
      const sumA = Object.values(g.A).reduce((t, x) => t + x[0], 0) + g.gm, sumB = Object.values(g.B).reduce((t, x) => t + x[0], 0) + g.lm;
      expect(!diff.length && g.gm === g.lm && sumA === g.cnt && sumB === g.cnt && g.n === g.cnt, "map.staticMatch", TS, `${where}: ghost ${sumA} (chip ${g.gm}) live ${sumB} (chip ${g.lm}) count ${g.cnt}/${g.n}${diff.length ? " · diff " + diff.join(" ") : ""}`);
      if (c < 0.5) expect(!Object.keys(g.A).length, "map.staticMatch", TS, `${where}: 0곳인데 자리 그림에 숫자 묶음 ${Object.keys(g.A).length}개`);
    } catch (e) { bad("runtime", "검사 실행", `staticMatch ${w} crashed: ` + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- map.attachJank: 붙이기(zp-att) ~ 자리 그림 걷힘(zp-fade) 사이 가장 긴 작업 ≤ 300ms (이 기계 · CPU 1배) · 붙는 동안 끈 막대 숫자 지연 중앙 ≤ 100 · 최대 ≤ 200
  {
    const TJ = "실제 지도를 붙이는 동안 가장 긴 작업 ≤ 300ms(이 기계 1배) · 붙는 중 막대 끌기 숫자 지연 중앙값 ≤ 100ms · 최대 ≤ 200ms";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      await ctx.addInitScript(() => { window.__lt19 = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt19.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: "longtask", buffered: true }); } catch (e) {} });
      page.__where = "/?cash=2 attach";
      await page.goto(BASE + `/?cash=2&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => performance.getEntriesByName("zp-fade").length, null, { timeout: 60000, polling: 200 }).catch(() => {});
      const r = await page.evaluate(() => { const a = (performance.getEntriesByName("zp-att")[0] || {}).startTime, f = (performance.getEntriesByName("zp-fade")[0] || {}).startTime; const L = (window.__lt19 || []).filter((x) => a != null && x[0] >= a - 5 && x[0] <= (f || 1e9) + 300); return { a, f, max: Math.max(0, ...L.map((x) => x[1])), n: L.length }; });
      if (r.a == null || r.f == null) bad("map.attachJank", TJ, `붙이기 표시 없음 zp-att ${r.a} zp-fade ${r.f}`);
      else expect(r.max <= 300, "map.attachJank", TJ, `attach ${Math.round(r.a)}→${Math.round(r.f)}ms · longest task ${r.max}ms (${r.n} long tasks)`);
    } catch (e) { bad("runtime", "검사 실행", "attachJank crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
    // 붙는 동안(첫 화면 2.5초) 손가락으로 끌기
    const { ctx: c2, page: p2 } = await newPage(browser, mob(390, 844), errs);
    try {
      p2.__where = "/?cash=2 first drag";
      await p2.goto(BASE + `/?cash=2&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await p2.waitForTimeout(2500);
      await p2.waitForSelector("#sScrub .scr-bars", { timeout: 15000 }).catch(() => {});
      const box = await p2.evaluate(() => { const e = document.querySelector("#sScrub .scr-bars") || document.getElementById("sScrub"); const r = e.getBoundingClientRect(); window.scrollTo(0, 0); return { l: r.left, w: r.width, y: r.top + r.height / 2 }; });
      await p2.evaluate(() => { window.__mu = []; const sN = document.getElementById("sN"); new MutationObserver(() => window.__mu.push(performance.now())).observe(sN, { childList: true, characterData: true, subtree: true }); });
      const cdp = await c2.newCDPSession(p2), tp = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      const sends = []; let x = box.l + box.w * 0.12; await tp("touchStart", x, box.y); await p2.waitForTimeout(150);
      for (let i = 1; i <= 16; i++) { x = box.l + box.w * (0.12 + i * 0.03); sends.push(await p2.evaluate(() => performance.now())); await tp("touchMove", x, box.y); await p2.waitForTimeout(60); }
      await tp("touchEnd"); await p2.waitForTimeout(1500);
      const mu = await p2.evaluate(() => window.__mu);
      const lat = sends.map((s0) => { const m = mu.find((t) => t >= s0); return m == null ? null : m - s0; }).filter((v) => v != null).sort((a, b) => a - b);
      if (lat.length < 6) bad("map.attachJank", TJ, `첫 끌기: 숫자가 거의 바뀌지 않음(${lat.length}번)`);
      else { const med = lat[lat.length >> 1], mx = lat[lat.length - 1]; expect(med <= 100 && mx <= 200, "map.attachJank", TJ, `first drag at 2.5s: median ${Math.round(med)}ms max ${Math.round(mx)}ms (n ${lat.length})`); }
    } catch (e) { bad("runtime", "검사 실행", "firstDrag crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await c2.close().catch(() => {}); }
  }
  // --- ui.scrubA11y: 홈 금액 막대 = role=slider(값·글 · 키보드 ←→ PageUp/Down Home/End)
  {
    const TA = "홈 금액 막대: role=slider · aria-valuemin/max/now · aria-valuetext '2억, 54곳' · 초점 가능(aria-hidden 아님) · 화살표·PageUp/Down·Home/End";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      page.__where = "/?cash=2 scrub a11y";
      await page.goto(BASE + `/?cash=2&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => typeof window.ZP_count === "function", null, { timeout: 30000, polling: 100 }).catch(() => {});
      await settle(page, 600);
      const a = await page.evaluate(() => { const e = document.getElementById("sScrub"); return e && { role: e.getAttribute("role"), min: e.getAttribute("aria-valuemin"), max: e.getAttribute("aria-valuemax"), now: e.getAttribute("aria-valuenow"), vt: e.getAttribute("aria-valuetext"), hid: e.closest("[aria-hidden=true]") ? 1 : 0, ti: e.tabIndex, n: window.ZP_count() }; });
      expect(a && a.role === "slider" && a.min && a.max && +a.now === 2 && new RegExp("^2억, " + a.n + "곳$").test(a.vt || "") && !a.hid && a.ti === 0, "ui.scrubA11y", TA, `attrs ${JSON.stringify(a)}`);
      const key = async (k) => { await page.focus("#sScrub"); await page.keyboard.press(k); await settle(page, 450); return page.evaluate(() => { const e = document.getElementById("sScrub"); return { now: +e.getAttribute("aria-valuenow"), vt: e.getAttribute("aria-valuetext"), sN: document.getElementById("sN").textContent, url: location.search }; }); };
      const r1 = await key("ArrowRight"), r2 = await key("PageUp"), r3 = await key("Home"), r4 = await key("End");
      expect(r1.now > 2 && r2.now > r1.now && r3.now === 0.5 && r4.now === 15 && /곳$/.test(r4.vt || ""), "ui.scrubA11y", TA, `→ ${r1.now} (${r1.vt}) · PageUp ${r2.now} · Home ${r3.now} · End ${r4.now} (${r4.vt})`);
      expect(cntOf(r1.vt) === intOf(r1.sN), "ui.scrubA11y", TA, `valuetext ${r1.vt} vs 큰 숫자 ${r1.sN}`);
    } catch (e) { bad("runtime", "검사 실행", "scrubA11y crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- map.ghostFollow (20차 G1): 실제 지도가 붙기 전 자리 그림에서 금액을 2억 → 3억(키보드)으로 바꾸면 자리 그림 묶음 합 + 칩 == 큰 숫자
  {
    const TG = "자리 그림(실제 지도 전)이 금액 변화를 따라감: 키보드로 2억 → 3억 뒤 묶음 합 + '+N곳' == 홈 곳 수 == ZP_count(3)";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      page.__where = "/?cash=2 ghost follow";
      await page.goto(BASE + `/?cash=2&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => window.ZP_G && ZP_G.on() && document.querySelectorAll(".zp-ph .zg-mk .zgu").length, null, { timeout: 20000, polling: 50 });
      await page.focus("#sScrub");
      await page.keyboard.press("ArrowRight"); await page.waitForTimeout(120); await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => +(document.getElementById("sScrub").getAttribute("aria-valuenow") || 0) === 3, null, { timeout: 4000, polling: 30 }).catch(() => {});
      await page.waitForTimeout(150);
      const g = await page.evaluate(() => ({ on: ZP_G.on(), sum: ZP_G.gus().reduce((a, x) => a + x.c, 0) + ZP_G.more(), n: +document.getElementById("sN").textContent.replace(/\D/g, ""), c3: typeof ZP_count === "function" ? ZP_count(3) : null, now: +(document.getElementById("sScrub").getAttribute("aria-valuenow") || 0) }));
      if (!g.on) bad("map.ghostFollow", TG, `자리 그림이 금액을 바꾼 직후 이미 사라짐(붙이기는 키를 누른 뒤 1초 쉬어야 함)`);
      else expect(g.now === 3 && g.sum === g.n && g.n === g.c3, "map.ghostFollow", TG, `3억: ghost ${g.sum} vs 홈 ${g.n} vs ZP_count(3) ${g.c3} (slider ${g.now})`);
    } catch (e) { bad("runtime", "검사 실행", "ghostFollow crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- ui.guDeepLink (20차 G2): /?cash=2#map-강북구 를 바로 열면 목록 '강북구 · N곳'(그 구만) · 지도 구 화면(폰·PC)
  {
    const TL = "#map-구 주소로 바로 열기: 목록이 그 구만('강북구 · N곳') · 구 화면 · 지도가 그 구 경계에 맞춤(폰·PC)";
    for (const [w, h, m] of [[390, 844, true], [1440, 900, false]]) {
      const { ctx, page } = await newPage(browser, m ? mob(w, h) : { viewport: { width: w, height: h } }, errs);
      try {
        page.__where = `/#map-강북구 ${w}`;
        await page.goto(BASE + `/?cash=2&mode=jeonse&qac=${++LOADS}#map-${encodeURIComponent("강북구")}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForFunction(() => /^강북구 · /.test(document.getElementById("sLT").textContent), null, { timeout: 30000, polling: 100 }).catch(() => {});
        await page.waitForFunction(() => { const m = window.ZP_lmx && ZP_lmx.map && ZP_lmx.map(); return m && m.loaded() && !m.isMoving(); }, null, { timeout: 30000, polling: 200 }).catch(() => {});
        await page.waitForTimeout(600);
        const r = await page.evaluate(() => { const m = ZP_lmx.map(), b = m && m.getBounds(), n = window.ZP_simple ? ZP_simple.list().length : null; return { lt: document.getElementById("sLT").textContent, view: document.getElementById("mapbox").dataset.view, gu: document.getElementById("mapbox").dataset.gu, n, inB: b ? b.contains([127.0257, 37.6396]) : false, z: m ? m.getZoom() : 0 }; });
        expect(new RegExp("^강북구 · [\\d,]+곳$").test(r.lt) && r.view === "gu" && r.gu === "강북구" && r.inB && r.z >= 10, "ui.guDeepLink", TL, `${w}px: list '${r.lt}' view ${r.view}/${r.gu} zoom ${r.z.toFixed(2)} 강북 in view ${r.inB}`);
      } catch (e) { bad("runtime", "검사 실행", "guDeepLink crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- seo.noEmail (20차 13): 공개 페이지·앱 묶음 어디에도 개인 메일 주소·mailto 없음(운영자 화면 admin.html만 예외)
  {
    const TE = "공개 페이지·앱 코드에 개인 메일 주소·mailto: 없음(문의는 사이트 안 양식) · admin.html은 noindex";
    try {
      const home = await getPage("/");
      const urls = ["/", "/contact", "/faq", "/privacy", "/terms", "/about", "/method", "/404.html", "/manifest.webmanifest", "/z/o916", "/z/o337", "/gu/" + encodeURIComponent("구로구"), "/gu/", "/report/", "/cf.js"].concat([...new Set([...home.text.matchAll(/\/b\/[ahdc]\.[0-9a-f]+\.(?:js|css)/g)].map((m) => m[0]))]);
      for (const u of urls) { const r = await getPage(u); if (r.status !== 200) continue; const hit = (/[A-Za-z0-9._%+-]+@gmail\.com/.exec(r.text) || /mailto:/.exec(r.text) || [])[0]; expect(!hit, "seo.noEmail", TE, `${u}: "${hit}"`); }
      const ad = await getPage("/admin.html");
      expect(ad.status === 200 && /name="robots" content="noindex/.test(ad.text), "seo.noEmail", TE, `admin.html ${ad.status} noindex ${/noindex/.test(ad.text)}`);
      const sm = await getPage("/sitemap.xml"); if (sm.status === 200) expect(!/admin/.test(sm.text), "seo.noEmail", TE, "sitemap lists admin");
      const sw = await getPage("/sw.js"); expect(/\/api\/contact/.test(sw.text) && /admin/.test(sw.text), "seo.noEmail", TE, "sw.js does not bypass /api/contact and admin");
    } catch (e) { bad("runtime", "검사 실행", "noEmail crashed: " + String(e.message || e).split("\n")[0]); }
  }
  // --- ui.contactForm (20차 13): MY → 문의 시트 · 검사(빈 내용·짧은 내용·이메일 꼴) · 보내기(가짜 /api/contact) → '잘 받았어요' · 뒤로 = 닫기 · 오프라인 = 안내 + 초안 남김
  {
    const TC = "문의 양식: MY에서 시트로 열림 · 종류 4개 · 내용 10~2000자(글자 수) · 이메일 검사 · 허니팟 · 보내기 → '잘 받았어요' · 뒤로 = 닫기 · 오프라인이면 안내 + 초안 저장";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      page.__where = "#my contact";
      const sent = [];
      await page.route("**/api/contact", (rt) => { try { sent.push(JSON.parse(rt.request().postData() || "{}")); } catch (e) {} rt.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
      await loadHome(page, "#my"); await page.waitForTimeout(900);
      const openIt = async () => { await page.evaluate(() => { const a = document.getElementById("myMail"); a && a.click(); }); await page.waitForTimeout(400); };
      await openIt();
      const a = await page.evaluate(() => { const s = document.getElementById("cfSheet"); if (!s) return null; const r = (e) => e.getBoundingClientRect(); return { kinds: s.querySelectorAll(".cf-k input").length, small: [...s.querySelectorAll(".cf-k span, .cf-go, .cf-x, textarea, input[type=email]")].filter((e) => r(e).height < 44).length, hp: !!s.querySelector('.cf-hp input[name="website"]'), cnt: (s.querySelector(".cf-cnt") || {}).textContent, note: /안 적으면 답장은 못 드려요/.test(s.innerText), at: /@gmail/.test(s.innerText), dlg: s.getAttribute("role") === "dialog" && s.getAttribute("aria-modal") === "true", lab: !!s.querySelector("label[for]") }; });
      expect(a && a.kinds === 4 && !a.small && a.hp && /0 \/ 2,000/.test(a.cnt || "") && a.note && !a.at && a.dlg && a.lab, "ui.contactForm", TC, `open: ${JSON.stringify(a)}`);
      // 검사
      const v = await page.evaluate(async () => {
        const s = document.getElementById("cfSheet"), go = s.querySelector(".cf-go"), tx = s.querySelector("textarea"), em = s.querySelector("input[type=email]"), w = () => new Promise((r) => setTimeout(r, 120));
        const err = () => [...s.querySelectorAll(".cf-err")].filter((e) => !e.hidden).map((e) => e.textContent);
        go.click(); await w(); const e1 = err();
        tx.value = "짧아요"; tx.dispatchEvent(new Event("input", { bubbles: true })); go.click(); await w(); const e2 = err();
        tx.value = "문의 양식 점검입니다. 숫자가 이상해요"; tx.dispatchEvent(new Event("input", { bubbles: true })); em.value = "abc@"; em.dispatchEvent(new Event("input", { bubbles: true })); go.click(); await w(); const e3 = err();
        return { e1, e2, e3, cnt: s.querySelector(".cf-cnt").textContent };
      });
      expect(v.e1.length === 1 && v.e2.length === 1 && v.e3.length === 1 && /이메일/.test(v.e3[0]) && sent.length === 0, "ui.contactForm", TC, `validation ${JSON.stringify(v)} sent ${sent.length}`);
      const ok = await page.evaluate(async () => {
        const s = document.getElementById("cfSheet"), em = s.querySelector("input[type=email]"); em.value = "qa@example.com"; em.dispatchEvent(new Event("input", { bubbles: true }));
        s.querySelector('.cf-k input[value="idea"]').click(); s.querySelector(".cf-go").click();
        for (let i = 0; i < 30 && !s.querySelector(".cf-ok"); i++) await new Promise((r) => setTimeout(r, 100));
        return { ok: (s.querySelector(".cf-ok") || {}).innerText || "", draft: localStorage.getItem("zp.cfDraft") };
      });
      const m = sent[0] || {};
      expect(/잘 받았어요/.test(ok.ok) && /며칠 안에 답장/.test(ok.ok) && sent.length === 1 && m.kind === "idea" && m.email === "qa@example.com" && /점검/.test(m.text || "") && m.website === "" && !ok.draft, "ui.contactForm", TC, `submit: "${ok.ok.slice(0, 40)}" sent ${JSON.stringify(m).slice(0, 160)} draft ${ok.draft}`);
      await page.evaluate(() => { const x = document.querySelector("#cfSheet .cf-x"); x && x.click(); }); await page.waitForTimeout(300);
      // 뒤로 = 닫기(MY 그대로)
      await openIt();
      const o1 = await page.evaluate(() => !!document.getElementById("cfSheet"));
      await page.goBack().catch(() => {}); await page.waitForTimeout(500);
      const b = await page.evaluate(() => ({ sheet: !!document.getElementById("cfSheet"), hash: location.hash, my: !!(document.getElementById("myMail") && document.getElementById("myMail").offsetParent) }));
      expect(o1 && !b.sheet && b.my, "ui.contactForm", TC, `back: opened ${o1} → sheet ${b.sheet} hash ${b.hash} MY ${b.my}`);
      // 오프라인: 안내 + 초안 남김
      await openIt();
      await ctx.setOffline(true);
      const off = await page.evaluate(async () => {
        const s = document.getElementById("cfSheet"); if (!s) return null; const tx = s.querySelector("textarea");
        tx.value = "오프라인에서 쓴 문의 초안입니다"; tx.dispatchEvent(new Event("input", { bubbles: true })); s.querySelector(".cf-go").click(); await new Promise((r) => setTimeout(r, 600));
        return { st: s.querySelector(".cf-st").textContent, draft: localStorage.getItem("zp.cfDraft") || "" };
      });
      await ctx.setOffline(false);
      expect(off && /오프라인이에요/.test(off.st) && /오프라인에서 쓴 문의 초안/.test(off.draft), "ui.contactForm", TC, `offline: ${JSON.stringify(off)}`);
      await page.evaluate(() => { try { window.ZP_contact.close(); localStorage.removeItem("zp.cfDraft"); } catch (e) {} });
    } catch (e) { bad("runtime", "검사 실행", "contactForm crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- ui.deskBackGu: PC 구 화면 → 목록 줄 → 상세 · 뒤로/Esc = 그 구 화면(같은 목록) · 상세 위 '←' 단추 하나('← 강북구 · 갈 수 있는 곳 N곳')
  {
    const TD = "PC: 구 화면에서 연 상세에서 뒤로·Esc = 그 구 화면(#map-구 · 같은 목록) · 상세 위 뒤로 단추 하나(구 이름·곳 수)";
    const { ctx, page } = await newPage(browser, { viewport: { width: 1440, height: 900 } }, errs);
    try {
      page.__where = "/ desk gu back";
      await page.goto(BASE + `/?cash=2&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => window.ZP_lmx && window.ZP_lmx.gus && window.ZP_lmx.gus().length > 0 && !(window.ZP_G && window.ZP_G.on()), null, { timeout: 45000, polling: 200 }).catch(() => {});
      const st = () => page.evaluate(() => ({ hash: decodeURIComponent(location.hash), view: document.getElementById("mapbox").dataset.view, gu: document.getElementById("mapbox").dataset.gu, rep: document.documentElement.classList.contains("s-rep"), lt: document.getElementById("sLT").textContent, backs: [...document.querySelectorAll(".s-right button, #report button, #report a")].filter((e) => e.offsetWidth && /^\s*←/.test(e.textContent)).map((e) => e.textContent.trim()) }));
      const gn = await page.evaluate(() => { const b = [...document.querySelectorAll("#lmap .zgu")].sort((a, b) => +b.dataset.n - +a.dataset.n)[0]; if (!b) return null; b.click(); return b.dataset.gu; });
      if (!gn) { bad("ui.deskBackGu", TD, "구 묶음 없음"); }
      else {
        await page.waitForTimeout(1500);
        const g0 = await st();
        await page.evaluate(() => { const a = document.querySelector("#sList a[data-id]"); a && a.click(); }); await page.waitForTimeout(1200);
        const d1 = await st();
        expect(d1.rep && d1.backs.length === 1 && new RegExp("^← " + gn + " · 갈 수 있는 곳 [\\d,]+곳$").test(d1.backs[0] || ""), "ui.deskBackGu", TD, `detail: s-rep ${d1.rep} back links ${JSON.stringify(d1.backs)}`);
        await page.goBack({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1000);
        const b1 = await st();
        expect(!b1.rep && b1.view === "gu" && b1.gu === gn && b1.hash === "#map-" + gn && b1.lt === g0.lt, "ui.deskBackGu", TD, `back: rep ${b1.rep} view ${b1.view} gu ${b1.gu} hash ${b1.hash} list '${b1.lt}' (was '${g0.lt}')`);
        await page.evaluate(() => { const a = document.querySelector("#sList a[data-id]"); a && a.click(); }); await page.waitForTimeout(1200);
        await page.keyboard.press("Escape"); await page.waitForTimeout(1000);
        const e1 = await st();
        expect(!e1.rep && e1.view === "gu" && e1.gu === gn && e1.lt === g0.lt, "ui.deskBackGu", TD, `Esc: rep ${e1.rep} view ${e1.view} gu ${e1.gu} list '${e1.lt}'`);
        await page.evaluate(() => { const a = document.querySelector("#sList a[data-id]"); a && a.click(); }); await page.waitForTimeout(1200);
        await page.evaluate(() => { const b = document.getElementById("sToList"); b && b.click(); }); await page.waitForTimeout(1000);
        const t1 = await st();
        expect(!t1.rep && t1.view === "gu" && t1.lt === g0.lt, "ui.deskBackGu", TD, `back link: rep ${t1.rep} view ${t1.view} list '${t1.lt}'`);
      }
    } catch (e) { bad("runtime", "검사 실행", "deskBackGu crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- term.money: 화면 글자에 '476만원'·'1.44억'(만·억 뒤 '원' · 억 소수 둘째 자리) 없음 — 홈·상세 5탭·입주 계산·MY
  {
    const TM = "돈 꼴: 숫자 뒤 '만원'·'억원' 없음 · 1억 이상은 소수 한 자리('1.4억')";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    const BADM = /\d\s*(만원|억원)|(?:^|[^\d.])(?:[1-9]\d*)\.\d{2,}억/;
    const scan = async (where) => { const t = await page.evaluate(() => document.body.innerText); const L = t.split("\n").filter((l) => BADM.test(l)).map((l) => l.trim().slice(0, 60)); expect(!L.length, "term.money", TM, `${where}: ${L.slice(0, 3).join(" | ")}`); };
    try {
      await loadHome(page); await settle(page, 400); await scan("home");
      for (const id of ["o1070", "o916", "o786", "o337"]) {
        await loadHome(page, "#" + id); await page.waitForTimeout(900);
        for (const tab of ["돈", "일정", "거래", "입지", "규제"]) {
          await page.evaluate((tab) => { const b = [...document.querySelectorAll("#report [role=tab]")].find((x) => x.textContent.trim() === tab); b && b.click(); }, tab); await page.waitForTimeout(450);
          await scan(`#${id} ${tab}`);
        }
      }
      await loadHome(page, "#planner"); await page.waitForTimeout(900); await scan("#planner");
      await loadHome(page, "#my"); await page.waitForTimeout(700); await scan("#my");
    } catch (e) { bad("runtime", "검사 실행", "term.money crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- search.badges: 금액이 있는 검색 결과 줄마다 '지금 X' + 내 돈 배지 · 빈 검색창 = 최근 검색·최근 본 구역
  {
    const TB = "검색: 금액이 보이는 줄마다 내 돈 배지 · 빈 검색창에 최근 검색어·최근 본 구역";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      await loadHome(page); await settle(page, 300);
      for (const q of ["신길", "장위", "ㅎㄴ"]) {
        await page.evaluate(() => { const q = document.getElementById("q"); if (!q.offsetWidth) document.getElementById("sSearch").click(); }); await page.waitForTimeout(300);
        await page.fill("#q", q); await page.waitForTimeout(700);
        const r = await page.evaluate(() => [...document.querySelectorAll("#sugg button[data-id]")].map((b) => ({ amt: !!b.querySelector(".sg-c b"), badge: !!b.querySelector(".sg-ok"), t: b.innerText.replace(/\s+/g, " ").slice(0, 40) })));
        const miss = r.filter((x) => x.amt && !x.badge);
        expect(r.length && !miss.length, "search.badges", TB, `'${q}': ${r.length} rows, ${r.filter((x) => x.amt).length} with 지금 X, missing badge: ${miss.map((x) => x.t).join(" | ")}`);
        await page.evaluate(() => { const b = document.querySelector("#sugg button[data-id]"); b && b.click(); }); await page.waitForTimeout(900);
        await page.goBack().catch(() => {}); await page.waitForTimeout(600);
      }
      await page.evaluate(() => { const q = document.getElementById("q"); if (!q.offsetWidth) document.getElementById("sSearch").click(); }); await page.waitForTimeout(300);
      await page.fill("#q", ""); await page.focus("#q"); await page.waitForTimeout(500);
      const e = await page.evaluate(() => { const t = document.getElementById("sugg").innerText; return { recQ: /최근 검색/.test(t), recZ: /최근 본 구역/.test(t) }; });
      expect(e.recQ && e.recZ, "search.badges", TB, `빈 검색창: 최근 검색 ${e.recQ} · 최근 본 구역 ${e.recZ}`);
    } catch (e) { bad("runtime", "검사 실행", "search.badges crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
}
// ---------------------------------------------------------------- 21차: 가능 구역마다 알약 · 범례 = 그려진 것 · 서울 보기 구역 면 · 막대 끌기 부드러움 · 목록 줄 역 이름
async function r21Lane(browser, api, errs) {
  const mob = (w, h, cs) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: cs });
  const idle = (page) => page.waitForFunction(() => { const m = window.ZP_lmx && ZP_lmx.map && ZP_lmx.map(); return m && m.loaded() && !m.isMoving() && !(window.ZP_G && ZP_G.on()); }, null, { timeout: 30000, polling: 200 }).catch(() => {});
  const TP = "구 화면: 화면 안(떠 있는 버튼 밑이 아닌) '가능' 구역은 모두 가격 알약이 있거나 이웃 알약의 '+N'에 셈 · 성북구 1억 정릉3구역 알약(레일 모서리 옆으로 옮겨도)";
  const TK = "범례 = 지금 화면에 그려진 것만(견본 알약 글자 == 지도 알약 · '멀다'·'정보 부족' 없음 · 서울 보기 '숫자 = 내 돈으로 갈 수 있는 곳 · 금액 = 가장 적게 드는 곳')";
  for (const [w, h] of [[360, 740], [390, 844]]) for (const cs of ["light", "dark"]) {
    const { ctx, page } = await newPage(browser, mob(w, h, cs), errs);
    const where = `${w} ${cs}`;
    try {
      page.__where = `/#map-성북구 ${where}`;
      await page.goto(BASE + `/?cash=1&mode=jeonse&qac=${++LOADS}#map-${encodeURIComponent("성북구")}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => /^성북구 · /.test(document.getElementById("sLT").textContent), null, { timeout: 30000, polling: 100 }).catch(() => {});
      await page.evaluate(() => { const m = document.getElementById("mapbox"); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 70); try { ZP_lmx.attach && 0; } catch (e) {} });
      await idle(page); await page.waitForTimeout(700);
      const chk = async (tag) => {
        const r = await page.evaluate(() => { const P = ZP_lmx.pills(), ok = ZP_lmx.okVis(); const okP = P.filter((p) => p.st === "ok"); return { ok, okP: okP.map((p) => p.id), more: P.reduce((a, p) => a + p.more, 0), key: (document.getElementById("lmKey") || {}).textContent || "", keyS: [...document.querySelectorAll("#lmKey .k-p")].map((e) => e.textContent), pt: P.map((p) => p.t), view: document.getElementById("mapbox").dataset.view }; });
        const missing = r.ok.filter((id) => !r.okP.includes(id));
        expect(r.view === "gu" && r.ok.length > 0 && missing.length <= r.more && r.ok.includes("o430") === r.okP.includes("o430"), "map.pillVisible", TP, `${where} ${tag}: ok in view ${r.ok.length} · pills ${r.okP.length} · +N ${r.more} · no pill ${missing.join(",")}`);
        expect(!/멀다|정보 부족/.test(r.key) && r.keyS.every((t) => r.pt.includes(t)) && (r.okP.length ? /내 돈으로 가능/.test(r.key) : !/내 돈으로 가능/.test(r.key)), "map.legend", TK, `${where} ${tag}: key "${r.key}" samples ${JSON.stringify(r.keyS)} pills ${JSON.stringify(r.pt.slice(0, 6))}`);
        return r;
      };
      const r0 = await chk("first");
      expect(r0.okP.includes("o430"), "map.pillVisible", TP, `${where}: 정릉3구역(o430) 알약 없음 · pills ${r0.okP.join(",")}`);
      // 사장님 화면: 정릉3구역 점이 오른쪽 위 레일 왼쪽 아래 모서리 바로 옆(원래는 '+N' 꼬리 자리 때문에 알약이 빠지고 점선 고리만 남았다)
      for (const [dx, dy] of [[-22, 18], [-40, 30], [-12, 40]]) {
        await page.evaluate(([dx, dy]) => {
          const m = ZP_lmx.map(), rail = document.querySelector("#mapbox .s-rail"), cv = m.getCanvas().getBoundingClientRect(), rb = rail.getBoundingClientRect();
          const want = [rb.left - cv.left + dx, rb.bottom - cv.top + dy], q = m.project(ZP_lmx.llOf("o430"));
          m.panBy([q.x - want[0], q.y - want[1]], { duration: 0 });
        }, [dx, dy]);
        await idle(page); await page.waitForTimeout(400);
        const r = await chk(`rail+${dx},${dy}`);
        expect(!r.ok.includes("o430") || r.okP.includes("o430"), "map.pillVisible", TP, `${where} rail ${dx},${dy}: 정릉3구역 보이는데 알약 없음 · pills ${r.okP.join(",")}`);
      }
      // 서울 보기: 범례 짧게(구 묶음 뜻 + 칠한 곳)
      await page.evaluate(() => { const x = document.getElementById("sGuX") || document.getElementById("mapBack"); if (x) x.click(); });
      await page.waitForTimeout(900); await idle(page); await page.waitForTimeout(500);
      const c = await page.evaluate(() => ({ key: (document.getElementById("lmKey") || {}).textContent || "", view: document.getElementById("mapbox").dataset.view, z: ZP_lmx.map().getZoom(), dots: ZP_lmx.okDots(), n: +document.getElementById("sN").textContent.replace(/\D/g, "") }));
      expect(c.view !== "gu" && /숫자 = 내 돈으로 갈 수 있는 곳/.test(c.key) && /금액 = 가장 적게 드는 곳/.test(c.key) && c.key.length <= 40, "map.legend", TK, `${where} 서울 보기: key "${c.key}" view ${c.view}`);
      expect(c.z > 11.01 || !c.n || c.dots > 0, "map.zoneShade", "서울 보기(줌 ≤ 11)에서 가능 구역이 바로 보임: 남색 면 45% + 작은 구역은 남색 원(자리 그림도 같은 면·원)", `${where}: zoom ${c.z.toFixed(2)} count ${c.n} small-zone dots ${c.dots}`);
      const op = await page.evaluate(() => { const m = ZP_lmx.map(); return JSON.stringify(m.getPaintProperty("zone-fill", "fill-opacity")); });
      expect(/,0,0\.(4|45),/.test(op), "map.zoneShade", "서울 보기(줌 ≤ 11)에서 가능 구역이 바로 보임: 남색 면 45% + 작은 구역은 남색 원(자리 그림도 같은 면·원)", `${where}: zone-fill opacity ${op.slice(0, 120)}`);
    } catch (e) { bad("runtime", "검사 실행", `r21 ${where} crashed: ` + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- map.zoneShade(자리 그림): 첫 화면 자리 그림에도 가능 구역 면·원
  {
    const { ctx, page } = await newPage(browser, mob(390, 844, "light"), errs);
    try {
      await page.goto(BASE + `/?cash=3&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.evaluate(() => { const m = document.getElementById("mapbox"); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 120); });
      const g = await page.waitForFunction(() => { const e = document.querySelector(".zp-ph"); if (!e) return { gone: 1 }; const p = e.querySelectorAll(".zg-z path").length, c = e.querySelectorAll(".zg-zd circle").length; return p || c ? { p, c } : null; }, null, { timeout: 8000, polling: 50 }).then((h) => h.jsonValue()).catch(() => ({ none: 1 }));
      expect(!g.none && (g.gone || (g.p > 0 && g.c > 0)), "map.zoneShade", "서울 보기(줌 ≤ 11)에서 가능 구역이 바로 보임: 남색 면 45% + 작은 구역은 남색 원(자리 그림도 같은 면·원)", `ghost 3억: paths ${g.p} circles ${g.c}${g.gone ? " (자리 그림이 이미 걷힘)" : ""}`);
    } catch (e) { bad("runtime", "검사 실행", "r21 ghost crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- ui.scrubSmooth: 홈 막대를 손가락으로 1.5초 끄는 동안 손잡이는 transform으로 따라오고, 큰 숫자는 100ms 안 · 놓으면 금액 자리로
  {
    const TD = "홈 금액 막대 끌기: 손잡이·말풍선이 손가락을 바로 따라옴(transform) · 큰 숫자 지연 중앙값 ≤ 100ms · 33ms 넘는 프레임 ≤ 10% · 놓으면 금액 자리(--p)로";
    const { ctx, page } = await newPage(browser, mob(390, 844, "light"), errs);
    try {
      await loadHome(page); await settle(page, 600);
      const box = await page.evaluate(() => { const e = document.getElementById("sScrub"); e.scrollIntoView({ block: "center" }); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2, w: b.width }; });
      await page.waitForTimeout(400);
      const cdp = await ctx.newCDPSession(page);
      await page.evaluate(() => {
        const F = (window.__F = []), L = (window.__L = []); let last = null, need = 0; window.__on = true;
        const loop = (t) => { F.push(t); if (window.__on) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
        const bars = document.querySelector("#sScrub .scr-bars"), n = document.getElementById("sN"); let prev = n.textContent;
        document.addEventListener("pointermove", (e) => { const b = bars.getBoundingClientRect(), c = ZP_simple.toCash(Math.min(100, Math.max(0, ((e.clientX - b.left) / b.width) * 100))); if (c !== last) { last = c; if (!need) need = performance.now(); } }, true);
        new MutationObserver(() => { if (n.textContent !== prev) { prev = n.textContent; if (need) { L.push(performance.now() - need); need = 0; } } }).observe(n, { childList: true, characterData: true, subtree: true });
      });
      const T = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y: box.y, id: 1 }] });
      const x0 = box.x + box.w * 0.1, x1 = box.x + box.w * 0.6;
      await T("touchStart", x0);
      const t0 = Date.now(); let mid = null, i = 0;
      while (Date.now() - t0 < 1500) { const k = (Date.now() - t0) / 1500; await T("touchMove", x0 + (x1 - x0) * k + (i++ % 2) * 0.3); if (!mid && k > 0.5) mid = await page.evaluate(() => ({ tf: document.querySelector("#sScrub .scr-h").style.transform, drag: document.getElementById("sScrub").classList.contains("drag") })); await new Promise((r) => setTimeout(r, 14)); }
      await T("touchEnd", x1);
      await page.waitForTimeout(900);
      const r = await page.evaluate(() => { window.__on = false; const F = window.__F, d = []; for (let i = 1; i < F.length; i++) d.push(F[i] - F[i - 1]); const L = window.__L.slice().sort((a, b) => a - b); const el = document.getElementById("sScrub"), c = +document.getElementById("pCash").value; return { n: d.length, s33: d.filter((x) => x > 33.4).length, L: L.length, med: L[L.length >> 1], p: el.style.getPropertyValue("--p"), want: ZP_simple.toPos(c) + "%", tf: el.querySelector(".scr-h").style.transform, drag: el.classList.contains("drag") }; });
      expect(mid && mid.drag && /translate3d/.test(mid.tf), "ui.scrubSmooth", TD, `mid-drag thumb transform "${mid && mid.tf}" drag ${mid && mid.drag}`);
      expect(r.L >= 5 && r.med <= 100 && r.s33 / Math.max(1, r.n) <= 0.1, "ui.scrubSmooth", TD, `count changes ${r.L} · median latency ${Math.round(r.med)}ms · frames >33ms ${r.s33}/${r.n}`);
      expect(!r.drag && !r.tf && r.p === r.want, "ui.scrubSmooth", TD, `after release: --p ${r.p} want ${r.want} transform "${r.tf}" drag ${r.drag}`);
    } catch (e) { bad("runtime", "검사 실행", "r21 scrub crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- list.rowFit · list.noOverflow: 목록 줄(360·390·412 · 밝은·어두운): 역·도보 분이 다 보임 · 줄 안 글자가 줄 상자 밖(다음 줄·구분선)으로 안 나감
  {
    const TR = "목록 줄 둘째 줄: 역 이름·도보 분이 다 보임(360·390·412px)";
    const TO = "목록 줄: 모든 글자·칩이 줄 상자 안(scrollHeight ≤ clientHeight) · 다음 줄과 겹치지 않음(360·390·412 · 밝은·어두운)";
    for (const w of [360, 390, 412]) for (const cs of ["light", "dark"]) {
      const { ctx, page } = await newPage(browser, mob(w, 800, cs), errs);
      try {
        await page.goto(BASE + `/?cash=3&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1 && document.querySelectorAll("#sList li.s-card").length >= 6, null, { timeout: 30000, polling: 100 }).catch(() => {});
        await page.waitForTimeout(500);
        const r = await page.evaluate(() => [...document.querySelectorAll("#sList li.s-card")].slice(0, 20).map((li) => {
          const R0 = li.getBoundingClientRect(), bad = [];
          // 보이는 상자 = 자기 상자 ∩ 넘침을 자르는 조상(overflow hidden·clip) 상자 — 잘려서 안 보이는 부분(자리가 없어 다음 줄로 밀려 숨은 '남는 돈')은 세지 않는다
          const vb = (e) => { let b = e.getBoundingClientRect(), r = [b.left, b.top, b.right, b.bottom]; for (let a = e.parentElement; a && a !== li; a = a.parentElement) { const cs = getComputedStyle(a); if (/hidden|clip/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const c = a.getBoundingClientRect(); r = [Math.max(r[0], c.left), Math.max(r[1], c.top), Math.min(r[2], c.right), Math.min(r[3], c.bottom)]; } } return r; };
          li.querySelectorAll("*").forEach((e) => { const b = e.getBoundingClientRect(); if (b.width < 1 || b.height < 1 || getComputedStyle(e).visibility === "hidden" || e.closest("[hidden]")) return; const r = vb(e); if (r[2] - r[0] < 1 || r[3] - r[1] < 1) return; if (r[1] < R0.top - 1 || r[3] > R0.bottom + 1 || r[0] < R0.left - 1 || r[2] > R0.right + 1) bad.push((e.className && e.className.baseVal == null ? e.className : e.tagName) + " " + Math.round(r[3] - R0.bottom)); });
          const wk = li.querySelector(".s-wk"), sub = li.querySelector(".s-sub"), a = wk && wk.getBoundingClientRect(), c = sub && sub.getBoundingClientRect();
          return { id: li.dataset.zid, over: li.scrollHeight > li.clientHeight + 1, bad: bad.slice(0, 3), wk: wk ? wk.textContent : "", cut: !!wk && (wk.scrollWidth > wk.clientWidth + 1 || a.right > c.right + 1 || a.width < 4) };
        }));
        const ob = r.filter((x) => x.over || x.bad.length), cut = r.filter((x) => x.cut);
        expect(r.length >= 6 && !ob.length, "list.noOverflow", TO, `${w} ${cs}: ${r.length} rows · overflow ${ob.map((x) => x.id + "[" + x.bad.join("|") + "]").join(", ")}`);
        if (cs === "light") expect(r.length > 0 && !cut.length, "list.rowFit", TR, `${w}px: ${r.length} rows · cut ${cut.map((x) => x.id + " " + x.wk).join(", ")}`);
      } catch (e) { bad("runtime", "검사 실행", "r21 rowFit crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- ui.newBadge: 마지막으로 본 날보다 새 소식이 있으면 경공매·고시공고 타일·소식 탭·머리 종에 N · 그 목록을 열면 지워짐 · 정적 페이지 종도 같은 기준
  {
    const TB = "새 소식 N 점: 마지막으로 본 날보다 새 경매·고시가 있으면 타일·소식 탭·머리 종에 N · 그 목록을 열면 지워짐 · 정적 페이지 종도 같은 키";
    const { ctx, page } = await newPage(browser, mob(390, 844, "light"), errs);
    try {
      await loadHome(page); await settle(page, 300);
      const D0 = await page.evaluate(() => { localStorage.setItem("zp.seen.auc", "2000-01-01"); localStorage.setItem("zp.seen.ntc", "2000-01-01"); return window.NEWB && NEWB.NEWD; });
      await loadHome(page); await settle(page, 500);
      const vis = () => page.evaluate(() => { const v = (s) => { const e = document.querySelector(s); return !!(e && !e.hidden && getComputedStyle(e).display !== "none"); }; /* 타일은 도구 화면이 열린 동안 숨어 있어도 점 상태(hidden)로 본다 */ return { auc: v('#sQuick a[href="#aucTop"] .nb-dot'), ntc: v('#sQuick a[href="#ntcTop"] .nb-dot'), tab: v('#sNav [data-nav="news"] .nb-dot'), bell: v("#hdrBell .nb-dot"), bl: (document.getElementById("hdrBell") || {}).getAttribute ? document.getElementById("hdrBell").getAttribute("aria-label") : "" }; });
      const a = await vis();
      expect(!!(D0 && D0.auc && D0.ntc) && a.auc && a.ntc && a.tab && a.bell && /새 소식/.test(a.bl), "ui.newBadge", TB, `stale seen: ${JSON.stringify(a)} NEWD ${JSON.stringify(D0)}`);
      await page.evaluate(() => document.querySelector('#sQuick a[href="#aucTop"]').click()); await page.waitForTimeout(800);
      const b = await vis(), k = await page.evaluate(() => localStorage.getItem("zp.seen.auc"));
      expect(!b.auc && b.ntc && b.bell && k === D0.auc, "ui.newBadge", TB, `after 경공매: ${JSON.stringify(b)} seen ${k}`);
      await page.evaluate(() => history.back()); await page.waitForTimeout(600);
      await page.evaluate(() => document.querySelector('#sQuick a[href="#ntcTop"]').click()); await page.waitForTimeout(800);
      const c = await vis();
      expect(!c.auc && !c.ntc && !c.tab && !c.bell, "ui.newBadge", TB, `after 고시공고: ${JSON.stringify(c)}`);
      // 정적 페이지: 다 본 뒤엔 점 없음 · 다시 옛날로 돌리면 점
      await page.goto(BASE + "/faq.html", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(300);
      const s1 = await page.evaluate(() => { const e = document.querySelector(".hdr-bell .nb-dot"); return e ? !e.hidden : null; });
      await page.evaluate(() => localStorage.setItem("zp.seen.ntc", "2000-01-01")); await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(300);
      const s2 = await page.evaluate(() => { const e = document.querySelector(".hdr-bell .nb-dot"); return e ? !e.hidden : null; });
      expect(s1 === false && s2 === true, "ui.newBadge", TB, `static /faq: after seen ${s1} · stale ${s2}`);
    } catch (e) { bad("runtime", "검사 실행", "r21 newBadge crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
}

async function r17bLane(browser, api, errs) {
  // ---- term.glossary(정적): 메타 태그 · 매니페스트 · 월간 리포트 · 앱 코드(JS 묶음) 화면 글자 ----
  try {
    const home = await getPage("/");
    const metas = [...home.text.matchAll(/<meta\s+[^>]*(?:name|property)="(description|og:[a-z:_]+|twitter:[a-z:_]+)"[^>]*content="([^"]*)"/g)].map((m) => m[2]).concat([(/<title>([^<]*)<\/title>/.exec(home.text) || [])[1] || ""]);
    termScan(metas.join(" / "), "home <meta>·<title>", true);   // 메타는 화면이 아니라 면책 횟수는 안 셈
    const mf = await getPage("/manifest.webmanifest");
    if (mf.status === 200) { const strs = []; const walk = (o) => { if (typeof o === "string") strs.push(o); else if (o && typeof o === "object") Object.values(o).forEach(walk); }; try { walk(JSON.parse(mf.text)); } catch (e) {} termScan(strs.join(" / "), "manifest.webmanifest", true); }
    for (const rp of ["/report/", "/report/2026-07", "/report/2026-08", "/report/2026-09"]) { const r = await getPage(rp); if (r.status === 200) termScan(htmlText(r.text.replace(/<head[\s\S]*?<\/head>/i, "")), rp); }
    const T = "용어집만: 같은 개념을 다른 말로 부르지 않음(가능 금액·살 수 있는 곳·이 돈이면·필요 현금·핀·부족액·내 현금…) · 권리가액·프리미엄 첫 언급은 쉬운 말(원래 말)";
    const js = [...new Set([...home.text.matchAll(/\/b\/[ah]\.[0-9a-f]+\.js/g)].map((m) => m[0]))];
    for (const u of js) {
      const r = await getPage(u); if (r.status !== 200) continue;
      const lits = []; const re = /(["'`])((?:\\.|(?!\1)[^\\\n])*?)\1/g; let m;
      while ((m = re.exec(r.text))) if (/[가-힣]/.test(m[2])) lits.push(m[2]);
      const hits = []; for (const b of TERM_BAN_JS) { const x = lits.find((l) => b.test(l)); if (x) { const i = x.search(b); hits.push(`[${b.source}] "${x.slice(Math.max(0, i - 16), i + 18)}"`); } }
      expect(!hits.length, "term.glossary", T, `${u.replace(/\.[0-9a-f]+\.js/, ".js")} strings: ${hits.slice(0, 3).join(" ; ")}`);
    }
  } catch (e) { bad("runtime", "검사 실행", "r17b static crashed: " + String(e.message || e).split("\n")[0]); }
  // ---- home.namesFold · ui.alertOne · ui.selectedNavy · perf.drag ----
  const TN = "첫 화면(스크롤 전)에 실제 구역 이름 + 금액(예산 카드 밑 맞춤순 3곳) — 390×844 · 360×740";
  const TA = "알림 권유는 화면마다 하나 이하 · 노랑·크림 바탕 없음";
  const TS = "고른 칩·세그먼트는 남색(#1f3a87 · 다크 #9fb3ff) — 검정·흰색 바탕 고른 상태 없음";
  const TD = "막대를 끄는 동안 곳 수가 150ms 안에 바뀜(이 기기, 50ms마다 움직임 · 가운데 값)";
  const rgb = `(c) => { const m = /rgba?\\(([^)]+)\\)/.exec(c || ""); if (!m) return null; const v = m[1].split(",").map((x) => parseFloat(x)); return v.length > 3 && v[3] < 0.5 ? null : v.slice(0, 3); }`;
  for (const [w, h, dark] of [[390, 844, false], [360, 740, false], [390, 844, true]]) {
    const where = `${w}×${h}${dark ? " dark" : ""}`;
    const { ctx, page } = await newPage(browser, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: dark ? "dark" : "light" }, errs);
    try {
      await page.evaluate(() => {}).catch(() => {});
      await loadHome(page);
      await setMode(page, "gap"); await setCash(page, 2);
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400);
      const f = await page.evaluate(() => {
        const nav = document.getElementById("sNav"), nb = nav && nav.offsetHeight ? nav.getBoundingClientRect().top : innerHeight;
        const cards = [...document.querySelectorAll("#sSum .s-rail3 button[data-id]")].map((b) => { const r = b.getBoundingClientRect(); return { n: (b.querySelector(".s-rn") || {}).textContent || "", v: (b.querySelector(".s-rv") || {}).textContent || "", top: Math.round(r.top), bot: Math.round(r.bottom), l: Math.round(r.left), vis: r.width > 0 && getComputedStyle(b).visibility !== "hidden" }; });
        return { nb: Math.round(nb), cards, n: +document.getElementById("sN").textContent.replace(/\D/g, ""), first: ((document.querySelector("#sList .s-card .s-nm b") || {}).textContent || "") };
      });
      const inFold = f.cards.filter((c) => c.vis && c.bot <= f.nb && c.l < w && /[가-힣]/.test(c.n) && /\d/.test(c.v) && /(억|만)/.test(c.v));
      if (!dark) {
        expect(inFold.length >= 1, "home.namesFold", TN, `${where}: rail cards above fold ${inFold.length} (cards ${JSON.stringify(f.cards.slice(0, 2))}, nav top ${f.nb})`);
        expect(!f.cards.length || f.cards[0].n === f.first.trim() || f.first === "" || (f.cards[0].n && f.first.trim().startsWith(f.cards[0].n)), "home.namesFold", TN, `${where}: rail first "${(f.cards[0] || {}).n}" ≠ list first "${f.first}" (맞춤순 위 3곳)`);
      }
      // 끄는 동안 숫자(가벼운 길): 50ms마다 움직여 #sN이 바뀌기까지
      if (!dark && w === 390) {
        // 지도가 다 그려진 뒤(첫 화면 뒤 한가할 때) 잰다
        await page.waitForFunction(() => { try { const m = window.ZP_lmx && ZP_lmx.map && ZP_lmx.map(); return !m || (m.loaded() && !m.isMoving()); } catch (e) { return true; } }, null, { timeout: 15000, polling: 200 }).catch(() => {});
        await page.waitForTimeout(1500);
        const lat = await page.evaluate(async () => {
          const el = document.getElementById("sScrub"); if (!el) return null;
          el.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 400));
          const bars = el.querySelector(".scr-bars").getBoundingClientRect(), y = bars.top + bars.height / 2;
          const ev = (t, x) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 9, pointerType: "mouse", clientX: x, clientY: y, button: 0, isPrimary: true }));
          const sN = document.getElementById("sN"), out = [];
          ev("pointerdown", bars.left + bars.width * 0.12); await new Promise((r) => setTimeout(r, 300));
          for (let i = 1; i <= 10; i++) {
            const before = sN.textContent, t0 = performance.now();
            ev("pointermove", bars.left + bars.width * (0.12 + i * 0.045));
            // 글자가 바뀐 순간(MutationObserver) 뒤 다음 프레임까지 = 화면에 보이기까지
            const t = await new Promise((res) => { const mo = new MutationObserver(() => { if (sN.textContent === before) return; mo.disconnect(); requestAnimationFrame(() => res(performance.now() - t0)); }); mo.observe(sN, { childList: true, characterData: true, subtree: true }); setTimeout(() => { mo.disconnect(); res(null); }, 2000); });
            if (t != null) out.push(Math.round(t));
            await new Promise((r) => setTimeout(r, 50));
          }
          ev("pointerup", bars.left + bars.width * 0.57);
          return out;
        });
        const md = lat && lat.length ? lat.slice().sort((a, b) => a - b)[Math.floor(lat.length / 2)] : null;
        expect(md != null && md <= 150, "perf.drag", TD, `${where}: count update ${JSON.stringify(lat)}ms (median ${md})`);
        if (md != null && md > 100) wrn("perf.drag", TD, `${where}: median ${md}ms > 100ms target`);
      }
      // 알림 권유 하나 · 노랑 없음(홈 · 관심 · 소식 · MY)
      for (const tab of ["home", "fav", "news", "my"]) {
        if (tab !== "home") { await page.evaluate((n) => { const e = [...document.querySelectorAll(`[data-nav="${n}"]`)].find((x) => x.offsetParent); e && e.click(); }, tab); await page.waitForTimeout(1200); }
        const a = await page.evaluate((rgbS) => {
          const rgb = eval(rgbS), yel = [];
          const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.display !== "none" && e.offsetParent !== null; };
          const ctas = [...document.querySelectorAll(".pc-al, .ib-push:not(.on), [data-wson]")].filter(vis).length;
          for (const e of document.querySelectorAll("body *")) {
            if (!vis(e)) continue;
            for (const c of [getComputedStyle(e).backgroundColor, getComputedStyle(e, "::before").backgroundColor]) {
              const v = rgb(c); if (!v) continue;
              const [r, g, b] = v.map((x) => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (d < 0.08) continue;
              let hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360;
              const sat = d / (1 - Math.abs(2 * l - 1));
              if (hh >= 38 && hh <= 62 && sat > 0.5 && l > 0.45) { yel.push((e.id ? "#" + e.id : e.className && e.className.baseVal === undefined ? "." + String(e.className).split(" ")[0] : e.tagName) + " " + c); break; }
            }
            if (yel.length > 3) break;
          }
          return { ctas, yel };
        }, rgb);
        expect(a.ctas <= 1, "ui.alertOne", TA, `${where} ${tab}: ${a.ctas} alert CTAs visible`);
        expect(!a.yel.length, "ui.alertOne", TA, `${where} ${tab}: yellow/cream backgrounds ${a.yel.join(" ; ")}`);
        // 고른 상태: 남색(검정·흰 바탕 아님)
        if (tab === "home") { await page.evaluate(() => document.getElementById("sCashBtn").click()); await page.waitForTimeout(700); }
        const sel = await page.evaluate((rgbS) => {
          const rgb = eval(rgbS), out = [];
          for (const e of document.querySelectorAll('[aria-pressed="true"], [role="tab"][aria-selected="true"]')) {
            const r = e.getBoundingClientRect(); if (!r.width || !e.offsetParent) continue;
            if (e.matches(".s-heart, .favb, .pn-hpin, .dt-fav, [data-heart], .zpill, .my-v, .pn-main, #sCashBtn, .ov-p, .lm-ctl button")) continue;   // 하트·저장·지도 알약은 '고른 칩'이 아님
            if (!e.closest(".s-flt, .s-mode, .bs-chips, .pn-sort, .pc-chip, .fchips, .hub-tabs, .my-seg, .pc-mode, .onb-c, #ntcF")) continue;
            let v = rgb(getComputedStyle(e).backgroundColor) || rgb(getComputedStyle(e, "::before").backgroundColor);
            if (!v) { out.push(`${e.textContent.trim().slice(0, 8)}: transparent`); continue; }
            const [R, G, B] = v, mx = Math.max(R, G, B), mn = Math.min(R, G, B);
            if (mx - mn < 24) out.push(`${e.textContent.trim().slice(0, 8)}: rgb(${v.join(",")})`);   // 무채색(검정·회색·흰색) 바탕 = 남색 아님
          }
          return out;
        }, rgb);
        expect(!sel.length, "ui.selectedNavy", TS, `${where} ${tab}: ${sel.slice(0, 4).join(" ; ")}`);
        if (tab === "home") { await page.keyboard.press("Escape"); await page.waitForTimeout(400); }
      }
      // 아래 탭 '관심' 이름(화면 읽기): '관심0' 같은 이름 없이 '관심 구역 N곳'
      const al = await page.evaluate(() => { const b = document.querySelector('#sNav [data-nav="fav"]'); return b ? b.getAttribute("aria-label") || b.textContent.trim() : ""; });
      expect(/^관심 구역 \d+곳/.test(al), "a11y.names", "아래 탭 '관심'의 화면 읽기 이름은 '관심 구역 N곳'", `${where}: "${al}"`);
      // MY '데이터 모두 지우기' 글자 대비 4.5:1
      const ct = await page.evaluate(() => {
        const b = document.getElementById("myWipe"); if (!b || !b.offsetParent) return null;
        const p = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, "0,0,0"])[1].split(",").map(parseFloat);
        let e = b, bg = null; while (e) { const v = p(getComputedStyle(e).backgroundColor); if (v.length < 4 || v[3] > 0.5) { bg = v; break; } e = e.parentElement; }
        const fg = p(getComputedStyle(b).color), L = (v) => { const a = v.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
        const l1 = L(fg), l2 = L(bg || [255, 255, 255]); return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
      });
      if (ct != null) expect(ct >= 4.5, "a11y.contrast", "MY '데이터 모두 지우기' 글자 대비 4.5:1 이상(라이트·다크)", `${where}: ${ct}:1`);
    } catch (e) { bad("runtime", "검사 실행", `r17bLane ${where} crashed: ` + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
}
// ================================================================ 22차: 앱 껍데기(색 모드·매니페스트·새 버전·오류 알림·자료 다시 받기) · 모든 구역 열기(오류 없음 · 앱 == /z 3숫자 == 목록)
async function r22Lane(browser, api, errs, shared) {
  const mob = (w, h, cs) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: cs });
  // --- app.colorScheme: <meta name="color-scheme" content="light dark"> + 계산된 color-scheme이 밝은 화면 light · 어두운 화면 dark(크롬 자동 어둡게가 밝은 화면을 다시 칠하지 않게) · theme-color 두 벌
  {
    const T = "색 모드: meta color-scheme 'light dark' · 계산된 color-scheme = 화면 밝기 · theme-color 밝은/어두운 두 벌(앱·정적 페이지)";
    for (const cs of ["light", "dark"]) for (const u of ["/", "/z/o916.html", "/faq.html", "/gu/"]) {
      const { ctx, page } = await newPage(browser, mob(390, 844, cs), errs);
      try {
        page.__where = u + " " + cs;
        await page.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 30000 });
        const r = await page.evaluate(() => ({ meta: (document.querySelector('meta[name="color-scheme"]') || {}).content || "", cs: getComputedStyle(document.documentElement).colorScheme, tc: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => (m.media || "") + "=" + m.content) }));
        expect(r.meta === "light dark" && r.cs === cs && r.tc.length >= 2 && r.tc.some((x) => /light/.test(x)) && r.tc.some((x) => /dark/.test(x)), "app.colorScheme", T, `${u} ${cs}: meta "${r.meta}" computed "${r.cs}" theme-color ${r.tc.join(" , ")}`);
      } catch (e) { bad("runtime", "검사 실행", `r22 colorScheme ${u} crashed: ` + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- app.manifest: 설치 앱 준비(id · start_url ?src=app · scope · standalone · orientation any · 색 · maskable · 바로가기 · 스크린샷 파일 크기)
  {
    const T = "매니페스트: id · start_url /?src=app · scope / · standalone · orientation any · 색 · maskable 아이콘 · 바로가기 · 스크린샷(적힌 크기 == 파일 크기)";
    try {
      const m = JSON.parse((await get(BASE + "/manifest.webmanifest")).text);
      const miss = [];
      if (m.id !== "/") miss.push("id " + m.id); if (m.start_url !== "/?src=app") miss.push("start_url " + m.start_url); if (m.scope !== "/") miss.push("scope"); if (m.display !== "standalone") miss.push("display " + m.display); if (m.orientation !== "any") miss.push("orientation " + m.orientation);
      if (!/^#[0-9a-f]{6}$/i.test(m.theme_color || "") || !/^#[0-9a-f]{6}$/i.test(m.background_color || "")) miss.push("colors");
      if (!(m.icons || []).some((i) => /maskable/.test(i.purpose || "") && /512/.test(i.sizes || ""))) miss.push("maskable 512");
      if (!(m.shortcuts || []).length || (m.shortcuts || []).some((x) => !/src=app/.test(x.url))) miss.push("shortcuts");
      for (const sh of m.screenshots || []) {
        const r = await fetch(BASE + sh.src); const b = Buffer.from(await r.arrayBuffer());
        const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
        if (r.status !== 200 || `${w}x${h}` !== sh.sizes) miss.push(`screenshot ${sh.src} ${r.status} ${w}x${h} vs ${sh.sizes}`);
      }
      if (!(m.screenshots || []).some((x) => x.form_factor === "wide") || !(m.screenshots || []).some((x) => x.form_factor === "narrow")) miss.push("screenshots narrow+wide");
      for (const ic of m.icons || []) { const r = await get(BASE + ic.src, "HEAD"); if (r.status !== 200) miss.push(`icon ${ic.src} ${r.status}`); }
      expect(!miss.length, "app.manifest", T, miss.join(" ; "));
    } catch (e) { bad("app.manifest", T, "manifest unreadable: " + e.message); }
  }
  // --- app.swUpdate: 이 화면을 맡던 서비스 워커가 바뀌면(배포) 첫 화면 묶음(/b/a·d)이 이 화면과 다를 때만 '새 버전이 있어요 · 새로고침' · 같으면 조용히 · 새로고침 누르면 다시 불러옴
  {
    const T = "새 버전: 워커가 바뀌고 첫 화면 묶음이 다르면 '새 버전이 있어요 · 새로고침'(누르면 다시 불러옴) · 같으면 알림 없음";
    const { ctx, page } = await newPage(browser, mob(390, 844, "light"), errs);
    try {
      let alter = false;
      await ctx.route(/\/\?swv=\d+/, async (route) => { const r = await route.fetch(); let t = await r.text(); if (alter) t = t.replace(/\/b\/a\.[0-9a-f]{10}\.js/g, "/b/a.0000000000.js"); await route.fulfill({ status: 200, contentType: "text/html", body: t }); });
      await loadHome(page, "#my"); await page.waitForTimeout(600);
      const fire = async () => { await page.evaluate(() => { navigator.serviceWorker.__zpTest = true; navigator.serviceWorker.dispatchEvent(new Event("controllerchange")); }); await page.waitForTimeout(1200); return page.evaluate(() => { const t = document.getElementById("zpUpd"); return t ? { on: t.classList.contains("on") && window.__qc.vis(t), txt: t.innerText.replace(/\s+/g, " ").trim() } : null; }); };
      const has = await page.evaluate(() => !!(navigator.serviceWorker && window.ZP_app && ZP_app.updCheck));
      if (!has) bad("app.swUpdate", T, "no serviceWorker / ZP_app.updCheck");
      else {
        const a = await fire();
        expect(!a, "app.swUpdate", T, `same bundles but toast shown: ${JSON.stringify(a)}`);
        alter = true;
        const b = await fire();
        expect(b && b.on && /새 버전이 있어요/.test(b.txt) && /새로고침/.test(b.txt), "app.swUpdate", T, `new bundles: toast ${JSON.stringify(b)}`);
        if (b && b.on) {
          const nav = page.waitForNavigation({ timeout: 8000 }).then(() => true, () => false);
          await page.click("#zpUpd [data-r]");
          expect(await nav, "app.swUpdate", T, "새로고침 did not reload");
        }
      }
    } catch (e) { bad("runtime", "검사 실행", "r22 swUpdate crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- app.errToast · app.fetchRetry: 잡히지 않은 오류 → 콘솔 + '화면 일부를 그리지 못했어요 · 다시 시도'(화면은 그대로) · 자료 받기가 한 번 끊겨도 다시 받아 성공
  {
    const T1 = "잡히지 않은 오류: 화면은 그대로 · 작은 알림 '화면 일부를 그리지 못했어요 · 다시 시도'(누르면 다시 불러옴)";
    const T2 = "자료 받기(/data/): 연결이 한 번 끊기거나 503이어도 다시 받아 성공 · 다른 출처·POST는 손대지 않음";
    const dummy = [];
    const { ctx, page } = await newPage(browser, mob(390, 844, "dark"), dummy);
    try {
      let hits = 0, hits2 = 0;
      await ctx.route(/\/data\/notice\.json\?qa=1/, (r) => { hits++; return hits === 1 ? r.abort("connectionreset") : r.continue(); });
      await ctx.route(/\/data\/notice\.json\?qa=2/, (r) => { hits2++; return hits2 <= 2 ? r.fulfill({ status: 503, body: "busy" }) : r.continue(); });
      await loadHome(page); await page.waitForTimeout(500);
      const f = await page.evaluate(async () => { const a = await fetch("data/notice.json?qa=1").then((r) => r.status, (e) => "err " + e.message); const b = await fetch("/data/notice.json?qa=2").then((r) => r.status, (e) => "err " + e.message); return [a, b]; });
      expect(f[0] === 200 && hits === 2 && f[1] === 200 && hits2 === 3, "app.fetchRetry", T2, `reset→${f[0]} (tries ${hits}) · 503→${f[1]} (tries ${hits2})`);
      const before = await page.evaluate(() => document.getElementById("sN").textContent);
      await page.evaluate(() => setTimeout(() => { null.qa22; }, 0));
      await page.waitForTimeout(700);
      const t = await page.evaluate(() => { const e = document.getElementById("zpErr"); return e ? { on: e.classList.contains("on") && window.__qc.vis(e), txt: e.innerText.replace(/\s+/g, " ").trim(), sN: document.getElementById("sN").textContent } : null; });
      expect(t && t.on && /화면 일부를 그리지 못했어요/.test(t.txt) && /다시 시도/.test(t.txt) && t.sN === before, "app.errToast", T1, JSON.stringify(t));
      if (t && t.on) { const nav = page.waitForNavigation({ timeout: 8000 }).then(() => true, () => false); await page.click("#zpErr [data-r]"); expect(await nav, "app.errToast", T1, "다시 시도 did not reload"); }
    } catch (e) { bad("runtime", "검사 실행", "r22 errToast crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- zone.fuzzAll: 한 화면에서 모든 구역(#id)을 차례로 열어 페이지 오류 0 · 다 열림 · 첫 화면 3숫자 == /z 페이지 == 15억 목록 줄(전세 끼고 기본)
  {
    const T = "모든 구역을 한 화면에서 차례로 열기(폰 밝게 전체 · PC 어둡게 1/8): 페이지 오류 0 · 다 열림";
    const T2 = "모든 구역: 앱 상세 첫 화면 3숫자(이름·값) == /z 페이지 == 15억 목록 줄 '지금'·'입주까지 현금'";
    const FZ_MS = +(process.env.QAC_FUZZ_MS || 600000);
    for (const [vp, cs, step] of [[mob(390, 844, "light"), "light", 1], [{ viewport: { width: 1440, height: 900 }, colorScheme: "dark" }, "dark", 8]]) {
      const local = [];
      const { ctx, page } = await newPage(browser, vp, local);
      const where = `${vp.isMobile ? "390" : "1440"} ${cs}`;
      try {
        page.__where = "fuzzAll " + where;
        await loadHome(page);
        const ids = (await page.evaluate(() => (window.__ZPD || {}).recs ? __ZPD.recs.map((r) => r.id) : [])).filter((_, i) => i % step === 0);
        if (!ids.length) { bad("zone.fuzzAll", T, `${where}: no zone ids`); continue; }
        const t0 = Date.now(); const got = {}; let done = 0;
        for (let i = 0; i < ids.length; i += 40) {
          if (Date.now() - t0 > FZ_MS / (step === 1 ? 1.25 : 5)) break;
          const part = await page.evaluate(async (chunk) => {
            const out = {};
            const wait = (f, ms) => new Promise((ok) => { const s = performance.now(); const tick = () => { const v = f(); if (v || performance.now() - s > ms) ok(v); else requestAnimationFrame(tick); }; tick(); });
            for (const id of chunk) {
              const t = document.getElementById("repTitle"); if (t) t.__fz = 1;
              location.hash = "#" + id;
              const ok = await wait(() => { const e = document.getElementById("repTitle"); return e && !e.__fz && e.textContent.trim(); }, 4000);
              const k = document.querySelector("#report .dt-k"), g = (q) => { const e = k && k.querySelector(`[data-k="${q}"] .dt-v`); return e ? e.textContent.trim() : null; };
              out[id] = { ok: !!ok, now: g("now"), tot: g("tot"), eta: g("eta"), labs: k ? [...k.querySelectorAll(".dt-l")].map((e) => e.textContent.trim()).join("|") : "" };
            }
            return out;
          }, ids.slice(i, i + 40));
          Object.assign(got, part); done += Object.keys(part).length;
        }
        const pe = [...new Set(local.filter((e) => /pageerror/.test(e.msg)).map((e) => e.msg))];
        errs.push(...local.filter((e) => !/pageerror/.test(e.msg)));
        const notOpen = Object.entries(got).filter(([, v]) => !v.ok).map(([k]) => k);
        expect(!pe.length && !notOpen.length && done > 0, "zone.fuzzAll", T, `${where}: opened ${done}/${ids.length} in ${Math.round((Date.now() - t0) / 1000)}s · not open ${notOpen.slice(0, 6).join(" ")} · pageerrors ${pe.slice(0, 3).join(" ; ")}`);
        if (done < ids.length) wrn("zone.fuzzAll", T, `${where}: time cap — opened ${done}/${ids.length} (QAC_FUZZ_MS=${FZ_MS})`);
        if (step !== 1) continue;
        // /z 페이지와 3숫자 비교(전부) · 15억 목록 줄과 비교(목록에 있는 곳)
        const okIds = Object.keys(got).filter((k) => got[k].ok && got[k].now != null);
        const zs = await pool(okIds, 12, async (id) => { const r = await getPage("/z/" + id); return r.status === 200 ? parseZ(r.text).key : null; });
        const mis = [], misL = []; let nz = 0, nl = 0;
        okIds.forEach((id, j) => {
          const a = got[id], z = zs[j];
          if (z && z.now != null) { nz++; if (a.now !== z.now || a.tot !== z.tot || a.eta !== z.eta || a.labs !== z.labs) mis.push(`${id}: app ${a.now}/${a.tot}/${a.eta} [${a.labs}] vs /z ${z.now}/${z.tot}/${z.eta} [${z.labs}]`); }
          const lm = shared.listMap && shared.listMap.get(id);
          if (lm && lm.now) { nl++; const an = money(a.now), at = money(a.tot); if (an && !eqMoney(lm.now, an)) misL.push(`${id}: list 지금 ${fm(lm.now)} vs detail ${a.now}`); if (lm.tot && at && !eqMoney(lm.tot, at)) misL.push(`${id}: list 입주까지 ${fm(lm.tot)} vs detail ${a.tot}`); }
        });
        expect(nz > 300 && !mis.length, "zone.allVsZ", T2, `${nz} /z compared · ${mis.length} differ: ${mis.slice(0, 4).join(" ; ")}`);
        if (nl) expect(!misL.length, "zone.allVsZ", T2, `${nl} list rows compared · ${misL.slice(0, 4).join(" ; ")}`);
      } catch (e) { bad("runtime", "검사 실행", `r22 fuzzAll ${where} crashed: ` + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
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
  const lane3 = timed("r14", (ONLY === "r1" || ONLY === "r3" || ONLY === "r4" ? Promise.resolve() : r14Lane(browser, api, errs)).catch((e) => bad("runtime", "검사 실행", "r14Lane crashed: " + e.message)));
  await Promise.all([stat.catch((e) => bad("runtime", "검사 실행", "static crashed: " + e.message)), lane1, lane2, lane3]);
  // 리뉴얼 1단계 줄(탭 4개·MY)은 다른 줄이 끝난 뒤 혼자: 코어 2개 기계에서 세 번째 브라우저가 겹치면 손가락 누름이 길게 누름으로 바뀌어 다른 줄의 탭 검사가 흔들렸다
  if (!ONLY || ONLY === "r1") await timed("r1", r1Lane(browser, api, errs));
  // 리뉴얼 3단계(지도 알약·구 묶음·♡·막대 끌기)는 다른 줄이 다 끝난 뒤 혼자 — 지도 그리기가 무거워 같이 돌면 다른 줄의 누름 검사가 밀린다
  if (!ONLY || ONLY === "r3") await timed("r3", r3Lane(browser, errs).catch((e) => bad("runtime", "검사 실행", "r3Lane crashed: " + e.message)));
  // 리뉴얼 4·5단계(상세 첫 화면 3숫자 · 숫자 신고 · 용어집 · 면책)
  if (!ONLY || ONLY === "r4") await timed("r4", r4Lane(browser, api, errs).catch((e) => bad("runtime", "검사 실행", "r4Lane crashed: " + e.message)));
  // 17차(구 묶음 합 · 뒤로 가기 겹 · 새로고침 유지 · 시트 위 시트 없음)
  if (!ONLY || ONLY === "r17") await timed("r17", navLane(browser, api, errs).catch((e) => bad("runtime", "검사 실행", "navLane crashed: " + e.message)));
  // 17차 2부(이름으로 답하기 · 고른 상태 남색 · 알림 하나 · 끄는 동안 숫자 · 용어 코드·메타·리포트) — 혼자(끄는 시간 재기)
  if (!ONLY || ONLY === "r17b") await timed("r17b", r17bLane(browser, api, errs).catch((e) => bad("runtime", "검사 실행", "r17bLane crashed: " + e.message)));
  // 19차(지도 자리 그림 = 실제 지도 · 붙일 때 긴 작업 · 홈 막대 슬라이더 · PC 구 화면 뒤로 · 돈 꼴 · 검색 배지) — 혼자(긴 작업을 잰다)
  if (!ONLY || ONLY === "r19") await timed("r19", r19Lane(browser, api, errs).catch((e) => bad("runtime", "검사 실행", "r19Lane crashed: " + e.message)));
  // 21차(가능 구역마다 알약 · 범례 · 서울 보기 구역 면 · 막대 끌기 · 목록 줄) — 혼자(끄는 프레임을 잰다)
  if (!ONLY || ONLY === "r21") await timed("r21", r21Lane(browser, api, errs).catch((e) => bad("runtime", "검사 실행", "r21Lane crashed: " + e.message)));
  // 22차(앱 껍데기 · 모든 구역 열기) — 혼자, 맨 끝(모든 구역을 여는 데 몇 분)
  if (!ONLY || ONLY === "r22") await timed("r22", r22Lane(browser, api, errs, shared).catch((e) => bad("runtime", "검사 실행", "r22Lane crashed: " + e.message)));
  await browser.close();

  // 콘솔 오류
  const localPush = /localhost|127\.0\.0\.1/.test(BASE || "") ;
  const own = errs.filter((e) => !e.external && !(localPush && /api\/push\//.test(e.msg))), ext = errs.filter((e) => e.external);
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
