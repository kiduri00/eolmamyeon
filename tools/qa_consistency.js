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

// ---------------------------------------------------------------- 불안정 검사 다시 재기 · 레인 묶음 나누기 (I 트랙 2026-10-27)
// flaky(ids, label, fn): 공유 2코어 기계(swiftshader)에서 타이밍 때문에 가끔 떨어지는 것으로 알려진 검사만 최대 3번(처음 + 다시 2번).
//   이번 시도에서 새로 생긴 실패가 모두 ids 안의 것일 때만 되돌리고 다시 잰다 — 다른 검사가 같이 떨어지면 바로 판정(가리지 않음).
//   다시 잰 기록은 결과 JSON checks[].retries 와 flaky[] 에 남는다(통과해도).
const FLAKY_LOG = [];
async function flaky(ids, label, fn) {
  ids = [].concat(ids);
  for (let a = 1; ; a++) {
    const snap = new Map([...CHECKS].map(([id, c]) => [id, [c.n, c.fails.length, c.warns.length]]));
    await fn(a);
    const fresh = [...CHECKS].filter(([id, c]) => c.fails.length > (snap.get(id) || [0, 0])[1]).map(([id]) => id);
    if (!fresh.length) { if (a > 1) FLAKY_LOG.push({ label, ids, attempts: a, result: "pass" }); return true; }
    if (a >= 3 || fresh.some((id) => !ids.includes(id))) { FLAKY_LOG.push({ label, ids, attempts: a, result: "fail", failed: fresh }); return false; }
    for (const id of fresh) {
      const c = CHECKS.get(id), [n, f, w] = snap.get(id) || [0, 0, 0];
      const dropped = c.fails.splice(f); c.warns.splice(w); c.n = n;
      (c.retries = c.retries || []).push(`try ${a}: ${dropped[0] || ""}`.slice(0, 300));
    }
    // 같은 묶음 안에서 이번 시도에 통과로 센 다른 검사는 다시 돌 때 두 번 세지 않게 되돌린다
    //   (한 프로세스 안에서 flaky 묶음과 다른 레인이 동시에 돌지 않는다는 전제 — 레인마다 자식 프로세스 하나)
    for (const [id, c] of [...CHECKS]) { if (fresh.includes(id)) continue; const s = snap.get(id); if (!s) CHECKS.delete(id); else { c.n = s[0]; c.warns.splice(s[2]); } }
  }
}
// secGate(lane): 레인 안 묶음마다 시간을 재고(SECT_T), QAC_PART="tapp:2/3"이면 그 레인 묶음 중 2번째 몫만 돈다.
//   몫 나누기는 PART_W(묶음별 대략 초 · 실측)로 균형 — 같은 몫은 언제나 같은 묶음(결정적).
const SECT_T = {};
const PART_W = {
  // 2026-10-27 실측(2코어 · 다른 트랙 QA 3개와 같이 돈 때 초) — noHomeFlash는 nhf 단위로 따로라 여기선 빠짐
  tapp: { "tapp.entry": 500, "search.parcel": 400, "search.names": 190, "tapp.toolEntry": 124, "tapp.mapMin": 117, "tapp.newsEntry": 80, "web.wideScroll": 80, "tapp.race": 75, "web.sheetInView": 65, "tapp.r3misc": 63, "tapp.coldTop": 63, "tapp.cashBack": 58, "tapp.r4misc": 50, "tapp.r5misc": 47, "tapp.segAll": 46, "tapp.a11y": 41, "tapp.home": 40, "moa.rows": 40, "tapp.axeAll": 40, "tapp.r2misc": 34, "tapp.bigFont": 34, "tapp.sheets": 33, "tapp.appbar": 33, "tapp.lcp": 25, "tapp.split": 20, "tapp.web": 18, "tapp.chips": 15 },
};
function partOf(lane, labels, n) {
  // 무거운 것부터 가장 가벼운 몫에 넣기(LPT) · 무게 모르는 묶음은 15초
  const W = PART_W[lane] || {}, load = Array(n).fill(0), at = {};
  labels.map((l, i) => [l, i, l === "" ? 0 : W[l] || 15]).sort((a, b) => b[2] - a[2] || a[1] - b[1]).forEach(([l, i, w]) => { const k = load.indexOf(Math.min(...load)); at[i] = k + 1; load[k] += w; });
  return at;
}
const TAPP_SECTS = ["tapp.web", "web.sheetInView", "web.loanPill", "tapp.home", "tapp.static", "tapp.staticSA", "tapp.static5", "tapp.split", "tapp.toggleDark", "tapp.noHomeFlash", "tapp.feed", "tapp.onboard", "tapp.a11y", "tapp.race", "tapp.lcp", "tapp.chips", "tapp.sheets", "tapp.appbar", "tapp.onbPolish", "tapp.r2misc", "tapp.onbToast", "tapp.newsEntry", "tapp.onbPush", "tapp.toolEntry", "tapp.segAll", "tapp.r3misc", "web.why", "web.wideScroll", "tapp.axeAll", "tapp.entry", "tapp.coldTop", "tapp.cashBack", "tapp.mapMin", "tapp.bigFont", "tapp.r4misc", "tapp.overscroll", "tapp.cover", "tapp.r5misc", "search.parcel", "search.names", "moa.rows", "tapp.coverSafe", "tapp.files"];   // tappLane 묶음 이름(SEC 번호 순서 그대로 — 묶음을 더하면 여기도)
const GATES = [];
function secGate(lane) {
  // QAC_PART 꼴: "tapp:2/3"(몫) · "tapp:2/3:-tapp.noHomeFlash"(그 묶음 빼고) · "tapp:=tapp.noHomeFlash"(그 묶음만)
  const spec = (process.env.QAC_PART || "").split(",").map((s) => s.split(":")).find(([l]) => l === lane);
  const only = spec && spec[1].startsWith("=") ? spec[1].slice(1) : null;
  const want = spec && !only ? spec[1].split("/").map(Number) : null;
  const minus = new Set(spec ? spec.slice(2).filter((x) => x.startsWith("-")).map((x) => x.slice(1)) : []);
  let cur = null, t0 = 0, at = null;
  const f = (i, lab) => {
    f.close();
    if (lane === "tapp" && TAPP_SECTS[i] !== lab) bad("runtime", "검사 실행", `secGate: tapp 묶음 ${i} "${lab}" ≠ TAPP_SECTS "${TAPP_SECTS[i]}" — 목록을 맞출 것`);
    if (want && !at) at = partOf(lane, (lane === "tapp" ? TAPP_SECTS : []).map((l) => (minus.has(l) ? "" : l)), want[1]);
    const on = only ? lab === only : (!want || at[i] === want[0]) && !minus.has(lab);
    if (on) { cur = lab || "s" + i; t0 = Date.now(); }
    return on;
  };
  f.close = () => { if (cur) { SECT_T[lane + "/" + cur] = (SECT_T[lane + "/" + cur] || 0) + Date.now() - t0; cur = null; } };
  GATES.push(f);
  return f;
}

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
const zfShort = (d) => { let m = Math.ceil((d || 0) * 1e4 - 1e-6); if (!(m >= 1)) m = 1; if (m < 1e4) return `${m.toLocaleString("ko-KR")}만`; const t = Math.ceil(m / 1e3 - 1e-9); return `${m % 1e3 ? "약 " : ""}${(t / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`; };   // 29차: 1억 아래 정확한 만 원 · 1억부터 0.1억 올림 '약 N억'(화면 ZF.short)
const zfCash = (v) => { const t = zfNum(v); if (t === "–") return t; if (t === "0") return "0원"; const a = Math.abs(v); if (Math.ceil(a * 100 - 1e-6) < 100) return (v < 0 ? "-" : "") + (Math.ceil(a * 100 - 1e-6) * 100).toLocaleString("ko-KR") + "만"; return t + "억"; };   // 1억 아래는 만 원(4,100만)
// WCAG 대비(페이지 안): 글자색(불투명도 곱) vs 조상 배경을 겹쳐 만든 실제 바탕
const CONTRAST_JS = (rootSel) => {
  const P = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; };
  const L = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const bgOf = (el) => { const st = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== "none") return null; const c = P(cs.backgroundColor); if (c && c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let b = [255, 255, 255, 1]; if (!st.length || st[st.length - 1][3] < 1) b = P(getComputedStyle(document.body).backgroundColor) || b; for (let i = st.length - 1; i >= 0; i--) b = over(st[i], b); return b; };
  const out = [];
  for (const root of document.querySelectorAll(rootSel)) for (const el of [root, ...root.querySelectorAll("*")]) {
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
  m = /(?:현금으로|대출 끼고) 사면 ([\d.,]+억|[\d,]+만|0원)/.exec(t); if (m) o.cashTotal = money(m[1]);
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
  // --- seo.shortcuts(5라운드 15): 웹 매니페스트 바로가기 4개 = 안드로이드 앱(AAB) 숏컷(twa-manifest.json 기준) — 주소·이름·아이콘(200)
  {
    const T5 = "manifest 바로가기 4개 == 앱(AAB) 숏컷(twa-manifest.json): 주소·이름·아이콘 파일";
    const tp = process.env.TWA_MANIFEST || "/home/claude/eolmamyeon-android/android/twa-manifest.json";
    let tw = null; try { tw = JSON.parse(fs.readFileSync(tp, "utf8")); } catch (e) {}
    if (!tw) skip("seo.shortcuts", T5, "twa-manifest.json 없음: " + tp);
    else {
      try {
        const mj = JSON.parse(man.text), M = mj.shortcuts || [], A = tw.shortcuts || [];
        const path = (u) => { try { const x = new URL(u, "https://x.kr"); return x.pathname + x.search + x.hash; } catch (e) { return u; } };
        const bad5 = [];
        if (M.length !== A.length) bad5.push(`수 ${M.length} ≠ ${A.length}`);
        for (let i = 0; i < Math.max(M.length, A.length); i++) { const m = M[i] || {}, a = A[i] || {}; if (path(m.url) !== path(a.url) || m.name !== a.name) bad5.push(`${i}: ${m.name} ${m.url} ≠ ${a.name} ${a.url}`); const ic = a.chosenIconUrl ? new URL(a.chosenIconUrl).pathname : null; if (ic && !(m.icons || []).some((x) => x.src === ic)) bad5.push(`${i}: 아이콘 ${ic} 없음`); }
        for (const m of M) for (const ic of m.icons || []) { const r = await get(BASE + ic.src).catch(() => ({ status: 0 })); if (r.status !== 200) bad5.push(`${ic.src} ${r.status}`); }
        expect(!bad5.length, "seo.shortcuts", T5, bad5.join(" ; "));
      } catch (e) { bad("seo.shortcuts", T5, "읽기 실패: " + e.message); }
    }
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
      const now = money(tds[1]), tot = money(tds[2].split("\n")[0]), cashMode = /현금 매수 시|대출 끼고/.test(tds[2]);
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
  // --- 28차: 입주권 없는 곳 등 '입주까지 현금 계산 보류'인 /z 페이지에는 어디에도 '입주까지 현금 N억'이 없음 + 보류 칸 아래 '잔금대출 뺀 값' 없음 + api total null (모든 /z 파일)
  {
    const id = "z.boryuConsistent", t = "/z '입주까지 현금 계산 보류'면 본문·api 어디에도 입주까지 현금 N억 없음";
    const zdir = path.join(PUBLIC_DIR, "z"); let n = 0;
    for (const f of fs.readdirSync(zdir).filter((x) => /^[a-z]+\d+\.html$/.test(x))) {
      const h = fs.readFileSync(path.join(zdir, f), "utf8");
      const m = /<span class="zk-l">입주까지 현금<\/span><b class="zk-v">([^<]*)<\/b>([\s\S]*?)<\/div>/.exec(h);
      if (!m || m[1] !== "계산 보류") continue;
      n++; const zid = f.slice(0, -5), txt = htmlText(h), why = [];
      if (/잔금대출 뺀 값/.test(m[2])) why.push("보류 칸 아래 '잔금대출 뺀 값'");
      const hit = /입주까지 현금[^.。<]{0,12}?\s[\d,.]+\s*(?:억|만)/.exec(txt.replace(/이야기 속 금액[^.]*\./g, ""));
      if (hit) why.push(`본문 "${hit[0]}"`);
      const aj = path.join(PUBLIC_DIR, "api/v1/zones", zid + ".json");
      if (fs.existsSync(aj)) { const a = JSON.parse(fs.readFileSync(aj, "utf8")); const nd = a.need || {}; if ((nd.cash && nd.cash.total != null && a.membership && a.membership.status === "no") || (nd.gap && nd.gap.total != null)) why.push(`api total ${nd.cash && nd.cash.total}/${nd.gap && nd.gap.total}`); }
      expect(!why.length, id, t, `/z/${zid}: ${why.join(" ; ")}`);
    }
    if (!n) skip(id, t, "no 보류 pages");
  }
  // --- 28차: 갱신일이 직전 배포(origin/main)보다 앞서지 않음(UTC로 하루 되돌아가던 것)
  {
    const id = "data.dateMonotonic", t = "api updated(갱신일) >= 직전 배포 origin/main 날짜";
    try {
      const cur = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, "api/v1/meta.json"), "utf8")).updated;
      const prev = JSON.parse(require("child_process").execSync("git show origin/main:public/api/v1/meta.json", { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "ignore"] }).toString()).updated;
      expect(cur && (!prev || cur >= prev), id, t, `now ${cur} < deployed ${prev}`);
      const live = (await get(BASE + "/api/v1/meta.json")); if (live && live.status === 200) { const lv = JSON.parse(live.text).updated; expect(lv === cur, id, t, `served ${lv} vs built ${cur}`); }
    } catch (e) { skip(id, t, "git/meta unavailable: " + String(e).slice(0, 80)); }
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
    { const firstNA = rowsG.findIndex((r) => !/입주까지(?! (?:현금 )?계산 보류)/.test(r.amt)), lastOK = rowsG.map((r) => /입주까지(?! (?:현금 )?계산 보류)/.test(r.amt)).lastIndexOf(true);
      expect(firstNA < 0 || firstNA > lastOK, "list.order", "'입주 계산 불가' 줄은 계산되는 줄보다 아래", `first n/a row #${firstNA} (${rowsG[firstNA] && rowsG[firstNA].name}) above calculable row #${lastOK}`); }
    // 맞춤순(기본 정렬): 지금 필요한 돈이 내 현금(15억)에 가까운 줄부터 — |현금 − 금액| 오름차순(표시 반올림 허용), 계산 불가 줄은 아래(list.order)
    {
      const sk = await page.evaluate(() => { try { return localStorage.getItem("emr.sort") || "fit"; } catch (e) { return "fit"; } });
      if (sk === "fit") {
        const ok = rowsG.filter((r) => /입주까지(?! (?:현금 )?계산 보류)/.test(r.amt)).map((r) => ({ r, m: money((/([\d.,]+억|[\d,]+만|0원)/.exec(r.amt) || [])[1]) })).filter((x) => x.m);
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
      // zone.open은 알려진 불안정 검사: 7초 안에 안 열리면 첫 화면을 다시 불러 두 번 더(그래도 안 열리면 실패)
      let opened = false, tries = 0;
      for (; tries < 3 && !opened; tries++) {
        if (tries) { await loadHome(page); await setMode(page, "gap"); }
        await page.evaluate(() => { const t = document.getElementById("repTitle"); if (t) t.__qcOld = 1; });
        await page.evaluate((i) => { location.hash = "#" + i; }, zid);
        opened = await page.waitForFunction(() => { const t = document.getElementById("repTitle"); return t && !t.__qcOld && t.textContent.trim(); }, null, { timeout: 7000, polling: 80 }).then(() => true, () => false);
      }
      if (tries > 1) { const c = C("zone.open", "구역 리포트가 열림"); (c.retries = c.retries || []).push(`${where}: opened ${opened} after ${tries} tries`); FLAKY_LOG.push({ label: "zone.open " + where, ids: ["zone.open"], attempts: tries, result: opened ? "pass" : "fail" }); }
      if (!opened) { bad("zone.open", "구역 리포트가 열림", `${where}: report did not render (${tries} tries)`); continue; }
      ok("zone.open", "구역 리포트가 열림");
      // tx.json은 리포트를 열 때 늦게 불러온다 → 글자가 멈출 때까지
      await page.waitForFunction(() => /믿어도 될까|최근 구역 안 거래 없음|계산 안 함|계산 보류/.test((document.getElementById("report") || {}).innerText || ""), null, { timeout: 5000, polling: 150 }).catch(() => {});
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
    await flaky("ui.tiles", "ui.tiles", async (a) => {
      const TT = "홈 빠른 메뉴 한 줄 = 순위·실거래·경공매·고시공고·출퇴근·입주 계산(각각 그 화면) · 격자 없음 · 도구(ZP_TOOLS)는 MY 도구 묶음(관심·소식은 아래 탭)에 전부";
      if (a > 1) { await loadHome(page); await settle(page, 600); }
      const g = await page.evaluate(() => ({ grid: !!document.getElementById("sTiles") || !!document.querySelector(".s-t[data-view]"), q: [...document.querySelectorAll("#sQuick a")].map((a) => ({ t: a.querySelector("span").textContent.trim(), h: (a.getAttribute("href") || "").slice(1), lab: a.getAttribute("aria-label") || "" })), my: [...document.querySelectorAll("#myTools a")].map((a) => a.dataset.menu || (a.getAttribute("href") || "").replace(/^#/, "")), ids: (window.ZP_TOOLS || []).map((t) => t[0]) }));
      const lack = g.ids.filter((id) => !g.my.includes(id) && id !== "favTop" && id !== "news");
      const want = ["순위", "실거래", "경공매", "고시공고", "출퇴근", "입주 계산"];
      expect(!g.grid && g.ids.length && !lack.length && JSON.stringify(g.q.map((x) => x.t)) === JSON.stringify(want) && g.q.every((x) => x.lab.startsWith(x.t)), "ui.tiles", TT, `grid ${g.grid} · quick ${JSON.stringify(g.q.map((x) => x.t))} · not in MY: [${lack.join(", ")}]`);
      const TGT = { rankHub: ["rankHub", null], txrTop: ["rankHub", "txr"], aucTop: ["news", "auc"], ntcTop: ["news", ""], commuteTop: ["commuteTop", null], planner: ["planner", null] };
      for (const x of g.q) {
        await loadHome(page); await settle(page, 300);
        const r = await page.evaluate(async (h) => { const a = document.querySelector(`#sQuick a[href="#${h}"]`); const y0 = scrollY; a.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 120)); const y1 = scrollY; a.click(); await new Promise((r) => setTimeout(r, 700)); const on = [...document.querySelectorAll(".s-on")].map((e) => e.id); const chip = document.querySelector("#ntcF [aria-pressed=\"true\"]"); const tab = document.querySelector("#rankHub [role=tab][aria-selected=\"true\"]"); return { on, chip: chip ? chip.dataset.c : null, tab: tab ? tab.dataset.tab : null, y1, auc: (document.getElementById("ntcOut") || {}).textContent || "" }; }, x.h);
        const [view, sub] = TGT[x.h] || [];
        const okV = r.on.includes(view) && (x.h !== "aucTop" || r.chip === "auc") && (x.h !== "ntcTop" || r.chip === "ntc") && (x.h !== "txrTop" || /txr|실거래/.test(String(r.tab)));
        expect(okV, "ui.tiles", TT, `${x.t} (#${x.h}): open ${r.on.join(",")} chip ${r.chip} tab ${r.tab}`);
        // 돌아가기 → 홈의 빠른 메뉴 자리로
        const back = await page.evaluate(async () => { history.back(); await new Promise((r) => setTimeout(r, 700)); return { view: document.documentElement.classList.contains("s-view"), y: scrollY }; });
        expect(!back.view && Math.abs(back.y - r.y1) <= 80, "ui.tiles", TT, `${x.t}: 뒤로 가기 → 홈 ${!back.view} · scroll ${Math.round(back.y)} (was ${Math.round(r.y1)})`);
      }
    });
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
      // /#map(전체 지도)에서 누름이 늦게 먹는 일이 알려진 불안정(hash "#map" s-full true) → flaky
      await flaky("ui.favTab", "ui.favTab from #map", async () => {
        await loadHome(page, "#map"); await page.waitForTimeout(800);
        await tapFav(); { const s = await fav(); expect(s.hash === "#favTop" && s.on && s.vis && !s.full, "ui.favTab", T, `from full map: hash "${s.hash}" s-on ${s.on} visible ${s.vis} s-full ${s.full}`); }
      });
      const zid = api.zones[1].id;
      await flaky("ui.favTab", "ui.favTab after report", async () => {
        await loadHome(page, "#" + zid); await page.waitForFunction(() => !!document.querySelector("#report.sheet .rep-head"), null, { timeout: 8000 }).catch(() => {});
        await page.evaluate(() => { const b = document.getElementById("sheetClose"); b && b.click(); }); await page.waitForTimeout(500);
        await tapFav(); { const s = await fav(); expect(s.hash === "#favTop" && s.on && s.vis, "ui.favTab", T, `report #${zid} closed → tab: hash "${s.hash}" s-on ${s.on} visible ${s.vis}`); }
      });
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
    for (const [h, k] of [["", "home"], ["#favTop", "fav"], ["#news", "news"], ["#my", "my"], ["#rankHub", "my"], ["#planner", "my"]]) { await loadHome(page, h); await page.waitForTimeout(700); await want(h || "/", k); }
    // /#map 진입(전체 지도 붙이기)은 알려진 불안정 — 같은 판정을 최대 3번
    await flaky("ui.tabs4", "ui.tabs4 /#map", async () => { await loadHome(page, "#map"); await page.waitForTimeout(700); await want("#map", "home"); });
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
      // 24차: 브라우저로 연 앱 화면에서는 웹 푸터(소개·약관·개인정보·문의)가 보여야 하고, 설치 앱(display-mode: standalone)에서만 숨긴다
      expect(t.foot, "ui.tabs4", T, "1440: web footer hidden in browser mode (should be visible; hidden only in standalone)");
      const sa = await dp.evaluate(() => { const hit = []; const walk = (rs, mq) => { for (const r of rs) { if (r.media && r.cssRules) walk(r.cssRules, r.media.mediaText); else if (r.cssRules && r.conditionText) walk(r.cssRules, r.conditionText); else if (r.selectorText && r.selectorText.split(",").some((x) => /\.site-foot$/.test(x.trim()) && !/:has\(#my\.s-on\)/.test(x)) && r.style && r.style.display === "none") hit.push(mq || ""); } }; for (const sh of document.styleSheets) { try { walk(sh.cssRules, ""); } catch (e) {} } return hit; });
      expect(sa.some((m) => /display-mode:\s*standalone/.test(m)), "ui.tabs4", T, "no @media (display-mode: standalone) rule hides .site-foot");
      expect(!sa.some((m) => !/display-mode/.test(m)), "ui.tabs4", T, `.site-foot hidden outside display-mode media: [${sa.filter((m) => !/display-mode/.test(m)).join(" | ")}]`);
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
  {
  const TM_M = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
  // --- ui.myToggles: MY 알림 종류 스위치는 폰 알림이 꺼져 있어도 늘 누를 수 있다(처음엔 모두 켜짐) · 누르면 바로 aria-checked가 바뀌고
  //     새로 열어도 그대로(zp-alert-off) · 소식 목록에서 그 종류가 빠지고 N 배지(경공매 타일·종)도 꺼짐 · 폰 알림이 켜져 있으면 서버 o 목록도 맞춤
  {
    const T = "MY 알림 종류 스위치: 폰 알림 꺼져 있어도 누르면 바로 바뀜(줄 전체 44px+) · 새로 열어도 유지 · 소식 목록·N 배지에 적용 · 폰 알림 켜져 있으면 서버 o 동기화";
    const ctx = await browser.newContext({ ...TM_M, serviceWorkers: "block" });
    try {
      await ctx.route(BLOCK, (r) => r.abort());
      await ctx.addInitScript(IN_PAGE);
      const page = await ctx.newPage(); page.__where = "/#my (toggles)";
      page.on("pageerror", (e) => errs.push({ where: "/#my (toggles)", msg: "pageerror: " + (e.message || String(e)).split("\n")[0].slice(0, 200) }));
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      // 실거래 소식이 있는 구역을 관심 구역으로(목록에서 빠지는지 보려고)
      const pick = await page.evaluate(async (fb) => { let ids = []; try { const j = await (await fetch("data/changes.json", { cache: "no-store" })).json(); const s = new Set(); (j.items || []).forEach((e) => { if (e.type === "trade" && s.size < 3) s.add(e.id); }); ids = [...s]; } catch (e) {} if (!ids.length) ids = fb; localStorage.setItem("jg-fav", JSON.stringify(ids)); localStorage.removeItem("zp-alert-off"); localStorage.setItem("zp.seen.auc", "2000-01-01"); localStorage.setItem("zp.seen.ntc", "2000-01-01"); return ids; }, api.zones.slice(0, 2).map((z) => z.id));
      await loadHome(page, "#my"); await page.waitForTimeout(1000);
      const st = () => page.evaluate(() => { const S = [...document.querySelectorAll("#myKinds [role=switch]")], c = document.getElementById("myKindsC"), I = window.ZP_INBOX, dot = document.querySelector('#sQuick a[href="#aucTop"] .nb-dot'); return { on: !!(I && I.st().on), can: !!(I && I.st().can), n: S.length, dis: S.filter((b) => b.disabled || b.getAttribute("aria-disabled") === "true").length, chk: Object.fromEntries(S.map((b) => [b.dataset.kind, b.getAttribute("aria-checked")])), small: S.filter((b) => b.getBoundingClientRect().height < 44).length, cap: c && !c.hidden ? c.textContent : "", capBtn: !!(c && c.querySelector("[data-push-on]")), ls: localStorage.getItem("zp-alert-off"), aucN: !!(window.NEWB && NEWB.unseen("auc")), aucDot: !!(dot && !dot.hidden), hasAucD: !!(window.NEWB && NEWB.NEWD && NEWB.NEWD.auc) }; });
      const a = await st();
      expect(!a.on && a.n === 5 && !a.dis && Object.values(a.chk).every((v) => v === "true") && !a.small, "ui.myToggles", T, `push off first open: ${a.n} switches, ${a.dis} disabled, checked ${JSON.stringify(a.chk)}, <44px ${a.small}`);
      expect(/앱 안 소식에만/.test(a.cap) && a.capBtn === a.can, "ui.myToggles", T, `caption "${a.cap}" button ${a.capBtn} (push can ${a.can})`);
      // 실제 탭(줄 왼쪽 글자 위를 눌러도 바뀜)
      const tap = async (k) => { await page.evaluate((k) => document.querySelector(`#myKinds [data-kind="${k}"]`).scrollIntoView({ block: "center", behavior: "instant" }), k); await page.waitForTimeout(400); const r = await page.evaluate((k) => { const b = document.querySelector(`#myKinds [data-kind="${k}"]`), q = b.getBoundingClientRect(), x = q.left + 24, y = q.top + q.height / 2, e = document.elementFromPoint(x, y); return { x, y, hit: !!(e && b.contains(e)), top: e ? window.__qc.sel(e) : "" }; }, k); if (!r.hit) expect(false, "ui.myToggles", T, `switch row "${k}" covered by ${r.top}`); await page.mouse.click(r.x, r.y); await page.waitForTimeout(250); };
      await tap("trade"); await tap("auction");
      const b = await st();
      expect(b.chk.trade === "false" && b.chk.auction === "false" && b.chk.stage === "true" && /trade/.test(b.ls || "") && /auction/.test(b.ls || ""), "ui.myToggles", T, `after tap trade+auction: ${JSON.stringify(b.chk)} stored ${b.ls}`);
      expect(!b.hasAucD || (a.aucN && !b.aucN && !b.aucDot), "ui.myToggles", T, `경매 끔 → 경공매 N 배지: before ${a.aucN} after ${b.aucN} dot ${b.aucDot}`);
      await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(1200);
      const c = await st();
      expect(c.chk.trade === "false" && c.chk.auction === "false" && c.chk.stage === "true", "ui.myToggles", T, `after reload: ${JSON.stringify(c.chk)}`);
      // 소식 목록: 실거래가 빠짐 → 다시 켜면 돌아옴
      const trN = async () => { await page.evaluate(() => { location.hash = "#news"; }); await page.waitForFunction(() => { const m = document.getElementById("nwMine"); return !!(m && m.querySelector("#ibPT")); }, null, { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(300); return page.evaluate(() => document.querySelectorAll("#nwMine .ib-tg.tr").length); };
      const t0 = await trN();
      await page.evaluate(() => { location.hash = "#my"; }); await page.waitForTimeout(600);
      await tap("trade");
      const t1 = await trN();
      expect(t0 === 0 && (pick.length === 0 || t1 > 0), "ui.myToggles", T, `소식 목록 실거래 줄: off ${t0} → on ${t1} (pins ${pick.length})`);
    } catch (e) { bad("ui.myToggles", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // 폰 알림 켜진 상태(구독 흉내): 종류를 끄면 서버로 o 목록을 다시 보낸다 · 안내 줄은 '켜 둔 소식만 폰 알림으로'
  {
    const T = "MY 알림 종류: 폰 알림 켜져 있으면 끄는 즉시 서버(POST /api/push/sub)의 o 목록에 반영 · 안내 '켜 둔 소식만 폰 알림으로 보내요'";
    const ctx = await browser.newContext({ ...TM_M, serviceWorkers: "allow" });
    try {
      await ctx.route(BLOCK, (r) => r.abort());
      await ctx.grantPermissions(["notifications"], { origin: BASE });
      await ctx.route("**/api/push/key", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: PUSH_KEY }) }));
      const posts = [];
      await ctx.route("**/api/push/sub", (r) => { try { posts.push(JSON.parse(r.request().postData() || "{}")); } catch (e) {} r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
      await ctx.addInitScript(IN_PAGE);
      await ctx.addInitScript(() => { try { localStorage.setItem("zp-push", JSON.stringify({ on: 1, at: Date.now() })); localStorage.removeItem("zp-alert-off"); const S = { endpoint: "https://x.invalid/1", options: {}, toJSON() { return { endpoint: "https://x.invalid/1" }; } }; PushManager.prototype.getSubscription = () => Promise.resolve(S); PushManager.prototype.subscribe = () => Promise.resolve(S); } catch (e) {} });
      const page = await ctx.newPage(); page.__where = "/#my (toggles push)";
      page.on("pageerror", (e) => errs.push({ where: "/#my (toggles push)", msg: "pageerror: " + (e.message || String(e)).split("\n")[0].slice(0, 200) }));
      await loadHome(page, "#my"); await page.waitForTimeout(1200);
      const cap = await page.evaluate(() => { const c = document.getElementById("myKindsC"); return { on: window.ZP_INBOX.st().on, t: c && !c.hidden ? c.textContent : "" }; });
      expect(cap.on && /켜 둔 소식만 폰 알림으로/.test(cap.t), "ui.myToggles", T, `push on: st.on ${cap.on} caption "${cap.t}"`);
      posts.length = 0;
      await page.evaluate(() => document.querySelector('#myKinds [data-kind="notice"]').click());
      const t0 = Date.now();
      while (!posts.length && Date.now() - t0 < 6000) await page.waitForTimeout(200);
      const o = posts.length ? posts[posts.length - 1].o : null;
      expect(Array.isArray(o) && o.includes("notice"), "ui.myToggles", T, `sync POST o = ${JSON.stringify(o)} (${posts.length} posts)`);
    } catch (e) { bad("ui.myToggles", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  }
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
      // desk.hover는 알려진 불안정(지도가 아직 움직이는 중 마우스) → flaky
      await flaky("desk.hover", "desk.hover", async (a) => {
      if (a > 1) { await page2.mouse.move(5, 500); await page2.waitForTimeout(800); }
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
      });
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
    const T = "첫 방문 카드(화면을 덮지 않음 · 한 단계 · 나중에 닫기): 처음엔 '지금 쓸 수 있는 현금' 질문 · 2억 고르면 카드 2억·곳 수 == ZP_count(2) · 딥링크(#구역)·두 번째 방문은 질문 없음";
    const ctx = await browser.newContext({ ...M, serviceWorkers: "block" });   // IN_PAGE(질문 답한 사용자) 없이
    try {
      await ctx.route(BLOCK, (r) => r.abort());
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errs.push({ where: "/ (onboard)", msg: "pageerror: " + (e.message || String(e)).split("\n")[0].slice(0, 200) }));
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      // 25차: 화면을 덮는 전체 화면 질문 대신 홈 맨 위 카드(한 단계 · '나중에' 닫기) — 목록·읽을거리·푸터가 그대로 보이고 스크롤된다
      const a = await page.evaluate(() => { const o = document.getElementById("onb"), r = o && o.getBoundingClientRect(), cs = o && getComputedStyle(o), rd = document.getElementById("sRd"), H = getComputedStyle(document.documentElement).overflow + getComputedStyle(document.body).overflow;
        return { on: !!o && !o.hidden && r.width > 200 && r.height > 80, inline: !!cs && cs.position !== "fixed" && cs.position !== "absolute" && r.height < innerHeight * 0.6, lock: /hidden/.test(H), later: !!(o && o.querySelector("[data-olater]")), reads: !!rd && rd.getClientRects().length > 0, q: o ? o.innerText : "", chips: o ? [...o.querySelectorAll("[data-oc]")].map((b) => b.textContent.trim()) : [] }; });
      expect(a.on && a.inline && !a.lock && a.later && a.reads && /지금 쓸 수 있는 현금을 골라 주세요/.test(a.q) && !/집 있어요/.test(a.q) && a.chips.join(",") === "5,000만,1억,2억,3억,5억,7억,10억,15억+", "ui.onboard", T, `first run: shown ${a.on} · inline ${a.inline} · scroll lock ${a.lock} · 나중에 ${a.later} · reads visible ${a.reads} · chips [${a.chips.join(", ")}]`);
      await page.tap('#onb [data-oc="2"]').catch(() => page.click('#onb [data-oc="2"]'));
      await page.waitForTimeout(250);
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
          // 24차: 페이지 끝에는 웹 푸터가 있어 그 구간에서는 지도가 보통 웹페이지처럼 함께 올라간다 → '왼쪽 칸 끝까지' 스크롤했을 때 sticky를 본다
          const sr = document.getElementById("sRight"); if (sr && document.querySelector(".site-foot") && document.querySelector(".site-foot").offsetHeight) y = Math.min(y, Math.max(0, Math.floor(sr.getBoundingClientRect().bottom + scrollY - innerHeight)));
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
        const hit = await page.evaluate((g) => { const e = document.querySelector(`#lmap .zgu[data-gu="${g}"]`); if (!e) return null; const l2 = (e.querySelector("span") || {}).textContent || ""; e.click(); return { l2 }; }, gn);
        if (!hit) { wrn("map.guPills", TG, `${w}px ${gn}: 묶음이 화면에 없음(칩 안)`); continue; }
        await page.waitForTimeout(900); await mapIdle(page); await page.waitForTimeout(500);
        const r = await page.evaluate(() => ({ v: document.getElementById("mapbox").dataset.view, pills: document.querySelectorAll("#lmap button.zpill[data-zid]").length, gus: document.querySelectorAll("#lmap .zgu").length, chip: !!(document.getElementById("lmGuMore") && !document.getElementById("lmGuMore").hidden), z: window.ZP_lmx.map().getZoom() }));
        expect(r.v === "gu" && r.pills > 0 && !r.gus && !r.chip, "map.guPills", TG, `${w}px ${gn}: view ${r.v} pills ${r.pills} clusters ${r.gus} chip ${r.chip} z${r.z.toFixed(2)}`);
        // 23차: 그 구의 갈 수 있는 곳이 하나씩 알약(≥ min(구 곳 수, 6) · 같은 자리에 겹친 곳(점 사이 알약 높이 28px 안)은 묶여도 됨) · 가장 싼 곳 알약 == 구 묶음 '~' 금액 · '+N'은 그 구 곳만 · 알약끼리 글자 안 겹침
        const q = await page.evaluate((g) => {
          const m = ZP_lmx.map(), own = __ZPD.recs.filter((x) => x.g === g && window.ZP_ok(x)), ids = new Set(own.map((x) => x.id));
          const P = ZP_lmx.pills().filter((p) => ids.has(p.id) && p.st === "ok"), pid = new Set(P.map((p) => p.id));
          const pt = (id) => { const ll = ZP_lmx.llOf(id); return ll ? m.project(ll) : null; };
          const anc = P.map((p) => pt(p.id)).filter(Boolean);
          const stacked = own.filter((x) => !pid.has(x.id)).filter((x) => { const a = pt(x.id); return a && anc.some((b) => Math.abs(a.x - b.x) < 28 && Math.abs(a.y - b.y) < 28); }).length;
          const more = P.reduce((a, p) => a + p.more, 0);
          const B = [...document.querySelectorAll("#lmap button.zpill[data-zid] .zp-in")].map((e) => e.getBoundingClientRect()); let ov = 0;
          for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], b = B[j]; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 10 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4) ov++; /* 둥근 모서리끼리 살짝 닿는 것(10×4 안)은 글자를 안 가림 */ }
          return { cnt: own.length, pills: P.length, stacked, more, ts: P.map((p) => p.t), ov };
        }, gn);
        const need = Math.min(q.cnt, 6), cheap = hit.l2.replace(/~$/, "");
        expect(q.pills + q.stacked >= need && q.more <= q.cnt - q.pills, "map.guPills", TG, `${w}px ${gn}: ${q.cnt}곳 · pills ${q.pills} + stacked ${q.stacked} (need ${need}) · +N ${q.more}`);
        expect(!cheap || q.ts.includes(cheap), "map.guPills", TG, `${w}px ${gn}: 묶음 '${hit.l2}' · 알약 ${q.ts.join(" ")}`);
        expect(!q.ov, "map.guPills", TG, `${w}px ${gn}: 알약 겹침 ${q.ov}`);
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
          else if (p.st === "near") { const want = zfShort(p.need - c) + " 부족"; /* 28차: 모자란 곳은 정확한 만 원 '5,636만 부족' */ expect(p.need > c && p.need <= c * 1.2 + 1e-9 && p.t === want && list[p.id] == null && /조금 모자람/.test(p.lab), "map.pills", T, `${where} ${p.id}: near pill "${p.t}" want "${want}" need ${p.need} in list ${list[p.id] != null}`); }
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
          const radios = s.querySelectorAll('.cf-r input[type=radio]').length, kind = (s.querySelector('.cf-k input:checked') || s.querySelector('input[type=hidden][name$="kind"]') || {}).value, kindQ = s.querySelectorAll('.cf-k input').length;   /* 23차: 숫자 신고 시트는 종류 줄 없이 '숫자 오류' 고정 */
          const st = s.querySelector('.cf-r input[value="stage"]'); if (st) st.click();
          const tx = s.querySelector("textarea"); tx.value = "QA 확인 · 단계 날짜가 달라요"; tx.dispatchEvent(new Event("input", { bubbles: true }));
          s.querySelector(".cf-go").click();
          for (let i = 0; i < 30 && !s.querySelector(".cf-ok"); i++) await new Promise((r) => setTimeout(r, 100));
          const out = { radios, kind, kindQ, ok: (s.querySelector(".cf-ok") || {}).innerText || "", at: /@/.test(s.innerText) };
          const x = s.querySelector(".cf-x"); if (x) x.click(); await new Promise((r) => setTimeout(r, 150));
          out.closed = !document.getElementById("cfSheet");
          return out;
        });
        await page.unroute("**/api/contact").catch(() => {});
        if (rr.none || rr.nosheet) bad("zone.report", TR, `#${zid}: ${rr.none ? "no button" : "sheet did not open"}`);
        else {
          const m = sent[0] || {};
          expect(rr.radios === 5 && rr.kind === "error" && !rr.kindQ && !rr.at, "zone.report", TR, `#${zid}: radios ${rr.radios} kind ${rr.kind} 종류 줄 ${rr.kindQ} address shown ${rr.at}`);
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
  await flaky("map.attachJank", "map.attachJank", async () => {
    const TJ = "실제 지도를 붙이는 동안 가장 긴 작업 ≤ 300ms(이 기계 1배) · 붙는 중 막대 끌기 숫자 지연 중앙값 ≤ 100ms · 최대 ≤ 200ms";
    // 27차: 이 기계가 바쁘면(다른 검사·브라우저가 같이 돌면) 한 번 더 재고, 바쁜 배수(loadFactor)만큼 기준을 늘린다 — 공유 기계에서의 거짓 실패
    const once = async () => {
      const { ctx, page } = await newPage(browser, mob(390, 844), errs);
      try {
        await ctx.addInitScript(() => { window.__lt19 = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt19.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: "longtask", buffered: true }); } catch (e) {} });
        page.__where = "/?cash=2 attach";
        await page.goto(BASE + `/?cash=2&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForFunction(() => performance.getEntriesByName("zp-fade").length, null, { timeout: 60000, polling: 200 }).catch(() => {});
        return await page.evaluate(() => { const a = (performance.getEntriesByName("zp-att")[0] || {}).startTime, f = (performance.getEntriesByName("zp-fade")[0] || {}).startTime; const L = (window.__lt19 || []).filter((x) => a != null && x[0] >= a - 5 && x[0] <= (f || 1e9) + 300); return { a, f, max: Math.max(0, ...L.map((x) => x[1])), n: L.length }; });
      } finally { await ctx.close().catch(() => {}); }
    };
    try {
      let r = await once(), lf = 1, tries = 1;
      if (r.a != null && r.f != null && r.max > 300) { lf = await loadFactor(browser); r = await once(); tries = 2; if (r.max > 300 * Math.min(2, lf)) lf = Math.max(lf, await loadFactor(browser)); }
      const lim = Math.round(300 * Math.min(2, lf));
      if (r.a == null || r.f == null) bad("map.attachJank", TJ, `붙이기 표시 없음 zp-att ${r.a} zp-fade ${r.f}`);
      else expect(r.max <= lim, "map.attachJank", TJ, `attach ${Math.round(r.a)}→${Math.round(r.f)}ms · longest task ${r.max}ms (${r.n} long tasks) · limit ${lim} (load ×${lf.toFixed(2)}, tries ${tries})`);
    } catch (e) { bad("runtime", "검사 실행", "attachJank crashed: " + String(e.message || e).split("\n")[0]); }
    // 붙는 동안(첫 화면 2.5초) 손가락으로 끌기 — 27차: 넘으면 바쁜 배수를 재고 한 번 더(기준 × 배수, 최대 2배)
    const drag1 = async () => {
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
        return sends.map((s0) => { const m = mu.find((t) => t >= s0); return m == null ? null : m - s0; }).filter((v) => v != null).sort((a, b) => a - b);
      } finally { await c2.close().catch(() => {}); }
    };
    try {
      let lat = await drag1(), lf = 1, tries = 1;
      const okL = (L, f) => L.length >= 6 && L[L.length >> 1] <= 100 * f && L[L.length - 1] <= 200 * f;
      if (!okL(lat, 1)) { lf = Math.min(2, await loadFactor(browser)); lat = await drag1(); tries = 2; }
      if (lat.length < 6) bad("map.attachJank", TJ, `첫 끌기: 숫자가 거의 바뀌지 않음(${lat.length}번)`);
      else { const med = lat[lat.length >> 1], mx = lat[lat.length - 1]; expect(okL(lat, lf), "map.attachJank", TJ, `first drag at 2.5s: median ${Math.round(med)}ms max ${Math.round(mx)}ms (n ${lat.length}) · load ×${lf.toFixed(2)} tries ${tries}`); }
    } catch (e) { bad("runtime", "검사 실행", "firstDrag crashed: " + String(e.message || e).split("\n")[0]); }
  });
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
        const r = await page.evaluate(() => { const m = ZP_lmx.map(), b = m && m.getBounds(), n = window.ZP_simple ? ZP_simple.list().length : null; return { lt: document.getElementById("sLT").textContent, view: document.getElementById("mapbox").dataset.view, gu: document.getElementById("mapbox").dataset.gu, n, inB: b ? (() => { const ok = __ZPD.recs.filter((x) => x.g === "강북구" && window.ZP_ok && ZP_ok(x)).map((x) => ZP_lmx.llOf(x.id)).filter(Boolean); return ok.length ? ok.every((ll) => b.contains(ll)) : b.contains([127.0257, 37.6396]); })() : false,   /* 23차: 구 화면은 그 구의 갈 수 있는 곳에 맞춘다(폰) — 그 곳들이 다 보이면 맞춤 */ z: m ? m.getZoom() : 0 }; });
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
  // --- search.noZeroShort(28차): 검색 배지에 '0원 부족' 없음 · 배지 'N 부족' == 상세 'N 더 필요해요'(정확한 만 원 · 오목교역 o332 2억 100만 → '0원 부족'이던 것)
  {
    const TZ = "검색 배지 '내 돈 N 부족'에 0원 없음 · 상세 'N 더 필요해요'와 같은 금액";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      for (const q of ["신정", "오목교", "장위", "한남"]) {
        await page.goto(BASE + `/?cash=2&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1 && typeof window.ZP_count === "function", null, { timeout: 25000 }).catch(() => {});
        await page.evaluate(() => { const q = document.getElementById("q"); if (!q.offsetWidth) document.getElementById("sSearch").click(); }); await page.waitForTimeout(300);
        await page.fill("#q", q); await page.waitForTimeout(800);
        const rows = await page.evaluate(() => [...document.querySelectorAll("#sugg button[data-id]")].map((b) => ({ id: b.dataset.id, t: ((b.querySelector(".sg-no:not(.sg-na)") || {}).textContent || "") })).filter((x) => /부족/.test(x.t)));
        for (const x of rows) expect(!/(^|\s)0원 부족/.test(x.t), "search.noZeroShort", TZ, `'${q}' ${x.id}: "${x.t}"`);
        // 29차 한 규칙: 1억 아래 정확한 만 원('470만') · 1억부터 0.1억 올림 '약 16.8억'(딱 떨어지면 '약' 없이) — '16억 7,267만' 같은 섞인 꼴 없음
        for (const x of rows) { const a = (/내 돈 (.+?) 부족/.exec(x.t) || [])[1] || ""; expect(/^[1-9][\d,]*만$/.test(a) && intOf(a) < 10000 || /^(약 )?\d[\d,]*(\.\d)?억$/.test(a), "search.noZeroShort", TZ + " · 한 규칙(1억 아래 만 원 · 1억부터 '약 N.N억')", `'${q}' ${x.id}: "${x.t}"`); }
        const x = rows[0];
        if (x) {
          await page.evaluate((id) => { const b = document.querySelector(`#sugg button[data-id="${id}"]`); b && b.click(); }, x.id); await page.waitForTimeout(1200);
          const d = await page.evaluate(() => { const e = document.querySelector("#report .dt-vd.no b"); return e ? e.textContent.trim() : ""; });
          const a = (/내 돈 (.+?) 부족/.exec(x.t) || [])[1], b2 = (/^(.+?) 더 필요해요/.exec(d) || [])[1];
          if (d) expect(a && b2 && a === b2, "search.noZeroShort", TZ, `'${q}' ${x.id}: badge "${x.t}" vs detail "${d}"`);
        } else skip("search.noZeroShort", TZ, `'${q}': no 부족 rows`);
      }
    } catch (e) { bad("runtime", "검사 실행", "search.noZeroShort crashed: " + String(e.message || e).split("\n")[0]); }
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
  }  // --- search.values (23차): 검색 배지 '지금 X' == 목록 '지금' == /z '지금 필요한 돈'(같은 ZF.cash 꼴) · '가능'이면 X ≤ 내 돈 · 'N 부족'이면 X > 내 돈이고 N = X − 내 돈(한 칸 안)
  {
    const TV = "검색 배지 금액 = 목록·/z와 같은 꼴(0.1억 올림 · 1억 아래 만) · 가능/부족이 같은 숫자에서";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      await page.goto(BASE + `/?cash=2&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1, null, { timeout: 30000, polling: 100 }).catch(() => {});
      await settle(page, 400);
      await page.evaluate(() => { const q = document.getElementById("q"); if (!q.offsetWidth) document.getElementById("sSearch").click(); }); await page.waitForTimeout(300);
      // 목록 '지금'(화면에 뜬 줄)
      const listNow = await page.evaluate(() => { const o = {}; document.querySelectorAll("#sList li").forEach((li) => { const a = li.querySelector("a[data-id]"), b = li.querySelector(".s-amt"); if (a && b) { const m = /([\d.,]+억|[\d,]+만|0원)/.exec(b.innerText); if (m) o[a.dataset.id] = m[1]; } }); return o; });
      const rows = {};
      const grab = () => page.evaluate(() => [...document.querySelectorAll("#sugg button[data-id]")].map((b) => { const c = b.querySelector(".sg-c b"), k = b.querySelector(".sg-ok"); return { id: b.dataset.id, amt: c ? c.textContent.replace(/^(지금|입주까지)\s*/, "").trim() : null, tot: !!c && /^입주까지/.test(c.textContent.trim()), ok: k ? k.textContent.trim() : "" }; }));
      for (const q of ["미아", "신길", "장위", "ㅎㄴ", "구로", "성수"]) { await page.fill("#q", q); await page.waitForTimeout(450); for (const x of await grab()) rows[x.id] = x; }
      // 모든 구역(이름으로 하나씩 · 2곳에 1곳) — 그 구역 줄의 배지
      const names = await page.evaluate(() => __ZPD.recs.filter((r, i) => i % 2 === 0 && r.s < 9 && r.src !== "moa").map((r) => [r.id, r.n]));
      const got = await page.evaluate(async (names) => {
        const q = document.getElementById("q"), out = [];
        for (const [id, n] of names) {
          q.value = n; q.dispatchEvent(new Event("input", { bubbles: true }));
          await new Promise((ok) => setTimeout(ok, 110));
          const b = document.querySelector(`#sugg button[data-id="${id}"]`); if (!b) continue;
          const c = b.querySelector(".sg-c b"), k = b.querySelector(".sg-ok");
          out.push({ id, amt: c ? c.textContent.replace(/^(지금|입주까지)\s*/, "").trim() : null, tot: !!c && /^입주까지/.test(c.textContent.trim()), ok: k ? k.textContent.trim() : "" });
        }
        return out;
      }, names);
      for (const x of got) rows[x.id] = x;
      const all = Object.values(rows).filter((x) => x.amt && !x.tot);
      const zs = await pool(all, 12, async (x) => { const r = await getPage("/z/" + x.id); return r.status === 200 ? parseZ(r.text).key : null; });
      const bad1 = [], bad2 = [], bad3 = []; let nz = 0, nl = 0;
      all.forEach((x, j) => {
        const z = zs[j];
        if (z && z.now) { nz++; if (z.now !== x.amt) bad1.push(`${x.id} 검색 ${x.amt} vs /z ${z.now}`); }
        if (listNow[x.id]) { nl++; if (listNow[x.id] !== x.amt) bad2.push(`${x.id} 검색 ${x.amt} vs 목록 ${listNow[x.id]}`); }
        const a = money(x.amt); if (!a) { bad3.push(`${x.id} '${x.amt}'`); return; }
        if (/(^|[^\d.])0\.\d+억/.test(x.amt)) bad3.push(`${x.id} ${x.amt}(1억 아래는 만)`);
        if (/가능/.test(x.ok) && a.v > 2 + 1e-9) bad3.push(`${x.id} ${x.amt} 가능?`);
        const m = /내 돈 (.+) 부족/.exec(x.ok);
        if (m) { const d = money(m[1].replace(/^약\s*/, "")); if (!(a.v > 2 + 1e-9) || !d || Math.abs(a.v - 2 - d.v) > 0.1 + 1e-6) bad3.push(`${x.id} ${x.amt} / ${m[1]} 부족`); }
      });
      expect(all.length > 100 && nz > 100 && !bad1.length, "search.values", TV, `${all.length} badges · ${nz} vs /z · differ ${bad1.length}: ${bad1.slice(0, 5).join(" ; ")}`);
      expect(!bad2.length, "search.values", TV, `${nl} vs list rows · differ: ${bad2.slice(0, 5).join(" ; ")}`);
      expect(!bad3.length, "search.values", TV, `가능/부족·꼴: ${bad3.slice(0, 6).join(" ; ")}`);
    } catch (e) { bad("runtime", "검사 실행", "search.values crashed: " + String(e.message || e).split("\n")[0]); }
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
    // 27차: 넘으면 바쁜 배수를 재고 한 번 더(지연 기준 × 배수 · 33ms 넘는 프레임 비율 10% × 배수, 최대 2배)
    const scrub1 = async () => {
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
      return { mid, r };
    } finally { await ctx.close().catch(() => {}); }
      };
    try {
      let { mid, r } = await scrub1(), lf = 1, tries = 1;
      const okS = (r, f) => r.L >= 5 && r.med <= 100 * f && r.s33 / Math.max(1, r.n) <= 0.1 * f;
      if (!okS(r, 1)) { lf = Math.min(2, await loadFactor(browser)); ({ mid, r } = await scrub1()); tries = 2; }
      expect(mid && mid.drag && /translate3d/.test(mid.tf), "ui.scrubSmooth", TD, `mid-drag thumb transform "${mid && mid.tf}" drag ${mid && mid.drag}`);
      expect(okS(r, lf), "ui.scrubSmooth", TD, `count changes ${r.L} · median latency ${Math.round(r.med)}ms · frames >33ms ${r.s33}/${r.n} · load ×${lf.toFixed(2)} tries ${tries}`);
      expect(!r.drag && !r.tf && r.p === r.want, "ui.scrubSmooth", TD, `after release: --p ${r.p} want ${r.want} transform "${r.tf}" drag ${r.drag}`);
    } catch (e) { bad("runtime", "검사 실행", "r21 scrub crashed: " + String(e.message || e).split("\n")[0]); }
  }
  // --- list.rowFit · list.noOverflow: 목록 줄(360·390·412 · 밝은·어두운): 역·도보 분이 다 보임 · 줄 안 글자가 줄 상자 밖(다음 줄·구분선)으로 안 나감
  {
    const TR = "목록 줄 둘째 줄: 역 이름·도보 분이 다 보임 · 역 이름이 '…'로 잘리지 않음(좁으면 '가까운 역 N분') · 360·390·412 · 1억·2억·3억 모든 줄";
    const TO = "목록 줄: 모든 글자·칩이 줄 상자 안(scrollHeight ≤ clientHeight) · 다음 줄과 겹치지 않음(360·390·412 · 밝은·어두운)";
    // 27차: 2억·1억(역 이름이 잘리던 신길4 · 미아사거리 줄이 나오는 금액)과 3억 · 모든 줄 — 역 이름이 '…'로 잘려도 실패(줄어들면 '가까운 역 N분'으로 바뀌어야 함)
    for (const [w, cs, cash] of [[360, "light", 2], [360, "light", 1], [360, "dark", 3], [390, "light", 2], [390, "light", 1], [390, "dark", 3], [412, "light", 2], [412, "light", 1], [412, "dark", 3]]) {
      const { ctx, page } = await newPage(browser, mob(w, 800, cs), errs);
      try {
        await page.goto(BASE + `/?cash=${cash}&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1 && document.querySelectorAll("#sList li.s-card").length >= 6, null, { timeout: 30000, polling: 100 }).catch(() => {});
        await page.waitForTimeout(500);
        for (let i = 0; i < 6; i++) { const more = await page.evaluate(() => { const m = document.getElementById("sMore"); if (!m || m.hidden) return false; m.click(); return true; }); if (!more) break; await page.waitForTimeout(200); }
        const r = await page.evaluate(() => [...document.querySelectorAll("#sList li.s-card")].map((li) => {
          const R0 = li.getBoundingClientRect(), bad = [];
          // 보이는 상자 = 자기 상자 ∩ 넘침을 자르는 조상(overflow hidden·clip) 상자 — 잘려서 안 보이는 부분(자리가 없어 다음 줄로 밀려 숨은 '남는 돈')은 세지 않는다
          const vb = (e) => { let b = e.getBoundingClientRect(), r = [b.left, b.top, b.right, b.bottom]; for (let a = e.parentElement; a && a !== li; a = a.parentElement) { const cs = getComputedStyle(a); if (/hidden|clip/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const c = a.getBoundingClientRect(); r = [Math.max(r[0], c.left), Math.max(r[1], c.top), Math.min(r[2], c.right), Math.min(r[3], c.bottom)]; } } return r; };
          li.querySelectorAll("*").forEach((e) => { const b = e.getBoundingClientRect(); if (b.width < 1 || b.height < 1 || getComputedStyle(e).visibility === "hidden" || e.closest("[hidden]")) return; const r = vb(e); if (r[2] - r[0] < 1 || r[3] - r[1] < 1) return; if (r[1] < R0.top - 1 || r[3] > R0.bottom + 1 || r[0] < R0.left - 1 || r[2] > R0.right + 1) bad.push((e.className && e.className.baseVal == null ? e.className : e.tagName) + " " + Math.round(r[3] - R0.bottom)); });
          const wk = li.querySelector(".s-wk"), sub = li.querySelector(".s-sub"), a = wk && wk.getBoundingClientRect(), c = sub && sub.getBoundingClientRect();
          // 23차: '역 N분'(.s-wm)이 끝까지 보임 — 줄어드는 건 역 이름(.s-wn)뿐 · 둘째 줄 전체도 말줄임 없음 · 420px 아래는 '동 ·' 없음
          const wm = li.querySelector(".s-wm"), m = wm && wm.getBoundingClientRect(), dg = li.querySelector(".s-dg.s-dgw");
          const wn = li.querySelector(".s-wn"), wnCut = !!wn && wn.offsetWidth > 0 && wn.scrollWidth > wn.clientWidth + 1;
          const cutM = !!wm && (m.width < 4 || m.right > c.right + 1 || m.right > a.right + 1 || wm.scrollWidth > wm.clientWidth + 1 || wnCut);
          const dgOn = !!dg && dg.getBoundingClientRect().width > 0 && innerWidth < 420;
          return { id: li.dataset.zid, over: li.scrollHeight > li.clientHeight + 1, bad: bad.slice(0, 3), wk: wk ? wk.textContent : "", cut: !!wk && (!wm || cutM || sub.scrollWidth > sub.clientWidth + 1 || a.width < 4 || dgOn) };
        }));
        const ob = r.filter((x) => x.over || x.bad.length), cut = r.filter((x) => x.cut);
        expect(r.length >= (cash >= 2 ? 6 : 1) && !ob.length, "list.noOverflow", TO, `${w} ${cs} ${cash}억: ${r.length} rows · overflow ${ob.map((x) => x.id + "[" + x.bad.join("|") + "]").join(", ")}`);
        expect(r.length > 0 && !cut.length, "list.rowFit", TR, `${w}px ${cash}억: ${r.length} rows · cut ${cut.map((x) => x.id + " " + x.wk).join(", ")}`);
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
      const vis = () => page.evaluate(() => { const v = (s) => { const e = document.querySelector(s); return !!(e && !e.hidden && getComputedStyle(e).display !== "none"); }; /* 타일은 도구 화면이 열린 동안 숨어 있어도 점 상태(hidden)로 본다 */ return { auc: v('#sQuick a[href="#aucTop"] .nb-dot'), ntc: v('#sQuick a[href="#ntcTop"] .nb-dot'), tab: v('#sNav [data-nav="news"] .nb-dot'), bell: (() => { const e = document.querySelector("#hdrBell .nb-dot"); return !!(e && !e.hidden); })(), bellShown: v("#hdrBell"), bl: (document.getElementById("hdrBell") || {}).getAttribute ? document.getElementById("hdrBell").getAttribute("aria-label") : "" }; });
      const a = await vis();
      expect(!!(D0 && D0.auc && D0.ntc) && a.auc && a.ntc && a.tab && a.bell && /새 소식/.test(a.bl), "ui.newBadge", TB, `stale seen: ${JSON.stringify(a)} NEWD ${JSON.stringify(D0)}`);
      // 26차: 폰은 아래 탭(소식)이 있으니 머리 종을 숨긴다(점 상태는 그대로 둠 · PC 머리 종과 같은 키)
      expect(!a.bellShown, "ui.newBadge", TB, `390: header bell still visible next to the 소식 tab`);
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
          if (Date.now() - t0 > (step === 1 ? Math.max(FZ_MS / 1.25, 150000) : FZ_MS / 5)) break;   // 27차: 폰 전체 줄은 적어도 150초(/z 비교 300곳 넘게 · 공유 기계에서 283곳에서 끊기던 것)
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
// ================================================================ 26차(애드센스 2차 + 제품 2차 레드팀)
// app.standaloneClean · my.layout · zone.eligibleConsistent · desk.stickyEnd · ui.onboardKey · home.readsTop
const FORCE_SA = () => {   // (display-mode: standalone) 규칙을 그대로 꺼내 강제로 켠다(크롬 헤드리스는 display-mode를 흉내 못 냄)
  let css = "";
  const walk = (rules) => { for (const r of rules) { if (r.media && /display-mode:\s*standalone/.test(r.media.mediaText)) { for (const x of r.cssRules) css += x.cssText + "\n"; } else if (r.cssRules && !r.media) walk(r.cssRules); } };
  for (const s of document.styleSheets) { try { walk(s.cssRules); } catch (e) {} }
  const st = document.createElement("style"); st.id = "qaSA"; st.textContent = css; document.head.appendChild(st);
  return css.length;
};
// ================================================================ 설치 앱 화면(안드로이드 TWA·홈 화면 앱 · html.is-tapp)
// 크롬 헤드리스는 display-mode를 흉내 못 내므로 TWA와 같은 진입(document.referrer = android-app://…)으로 켠다 · 브라우저(웹)는 그대로인지도 같이
// 1라운드 B: 이 크로미움은 CDP display-mode 흉내가 듣지 않는다 → referrer(android-app://) 덮어쓰기 + 세션 표시(zp.tapp=1)를 둘 다 넣고, 각 검사 전에 html.is-tapp가 켜졌는지부터 단언(tapp.on)
const TWA = () => { try { Object.defineProperty(Document.prototype, "referrer", { get: () => "android-app://kr.alwaysquestions.zippin/" }); } catch (e) {} try { sessionStorage.setItem("zp.tapp", "1"); } catch (e) {} };
async function tappLane(browser, api, errs) {
  const SEC = secGate("tapp");   // 묶음마다 시간 재기 · QAC_PART=tapp:k/n 이면 k번째 몫만(나눠서 따로 돌림)
  const mob = (w, h, cs = "light") => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: cs });
  const ADRX = /googlesyndication|adsbygoogle|pagead2/i;
  const appPage = async (vp, onb) => {
    const r = await newPage(browser, vp, errs);
    await r.ctx.addInitScript(TWA);
    // 배포 서버처럼 깨끗한 주소(/years · /report/2026-10 · /guide/x)를 .html로(로컬 python 서버는 못 함)
    await r.ctx.route(/^https?:\/\/[^/]+\/(?:years|report\/\d{4}-\d\d|guide\/[a-z0-9-]+)(?:[?#].*)?$/, (q) => { const u = new URL(q.request().url()); u.pathname += ".html"; return q.continue({ url: u.toString() }); });
    if (!onb) await r.ctx.addInitScript(() => { try { localStorage.setItem("zp.tonb", "1"); } catch (e) {} });
    r.ads = []; r.tReq = [];
    // 광고 요청은 앱 첫 화면(/)에서 나간 것만 센다 — 정적 페이지는 결정 A로 리터럴 태그(심사 전 광고 없음 · tapp.static이 따로 확인)
    r.page.on("request", (q) => { const u = q.url(); let fu = ""; try { fu = new URL(q.frame().url()).pathname; } catch (e) {} if (ADRX.test(u) && /^\/(index\.html)?$/.test(fu)) r.ads.push(u); if (/\/b\/t\.[0-9a-f]{10}\.(js|css)/.test(u)) r.tReq.push(u); });
    return r;
  };
  const appHome = async (page, u = "/?src=app") => {
    page.__where = "tapp " + u;
    await page.goto(BASE + u, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => document.documentElement.classList.contains("tapp-on"), null, { timeout: 25000, polling: 100 }).catch(() => {});
    await page.waitForTimeout(500);
    const on = await page.evaluate(() => document.documentElement.classList.contains("is-tapp") && document.documentElement.classList.contains("tapp-on")).catch(() => false);
    expect(on, "tapp.on", "설치 앱 검사 레인이 실제로 앱 모드(html.is-tapp · tapp-on)를 켠 뒤 검사한다", `${u}: is-tapp/tapp-on 꺼짐`);
  };
  let CH = null; try { CH = JSON.parse((await get(BASE + "/data/changes.json")).text); } catch (e) {}
  // 2라운드(리드 결정): 앱 전체 소식은 같은 실거래·경매(날짜·종류·문구·구 같음)를 겹친 구역끼리 한 소식으로 합쳐 센다 → 칩 수 = 합친 수.
  // 원본 changes.json 항목 수(RAW) = 합친 소식들이 품은 항목 수의 합 · 단계·고시·필요한 돈은 구역마다 따로(합치지 않음)
  const RAW = {}, EXP = {}, UK = new Set(); (CH ? CH.items : []).forEach((e) => { RAW[e.type] = (RAW[e.type] || 0) + 1; const k = /^(trade|auction)$/.test(e.type) ? `${e.date}|${e.type}|${e.text}|${e.g || ""}` : `${e.id}|${e.date}|${e.type}|${e.text}`; if (!UK.has(k)) { UK.add(k); EXP[e.type] = (EXP[e.type] || 0) + 1; } });
  // --- tapp.web: 브라우저(웹)에는 앱 화면이 하나도 없다 · 앱 묶음(/b/t.*)도 안 받는다 · 정적 페이지 광고는 예전처럼 받는다
  if (SEC(0, "tapp.web")) {
    const T = "브라우저(웹): html.is-tapp·앱 첫 화면·전체 소식·처음 안내 없음 · 아래 탭 4개 그대로 · 앱 묶음(/b/t.*) 안 받음 · 광고 스크립트는 정적 페이지에서 그대로 요청";
    for (const [vp, tag] of [[mob(390, 844), "390"], [{ viewport: { width: 1440, height: 900 } }, "1440"]]) {
      const { ctx, page } = await newPage(browser, vp, errs);
      const ads = [], tq = [];
      page.on("request", (q) => { const u = q.url(); if (ADRX.test(u)) ads.push(u); if (/\/b\/t\.[0-9a-f]{10}\./.test(u)) tq.push(u); });
      try {
        page.__where = "tapp.web " + tag;
        await loadHome(page); await settle(page, 400);
        await page.evaluate(() => { const b = document.querySelector('#sNav [data-nav="news"]'); if (b) b.click(); });
        await page.waitForTimeout(600);
        const r = await page.evaluate(() => ({ cls: document.documentElement.className.includes("is-tapp"), home: !!document.getElementById("tHome"), feed: !!document.getElementById("tFeed"), onb: !!document.getElementById("tOnb"), nav: [...document.querySelectorAll("#sNav [data-nav]")].map((b) => b.dataset.nav).join(","), tapi: !!window.ZP_TAPP }));
        const st = [];
        for (const u of ["/z/o144.html", "/report/2026-10.html"]) {
          const n0 = ads.length;
          await page.goto(BASE + u, { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(300);
          const x = await page.evaluate(() => ({ cls: document.documentElement.classList.contains("is-tapp"), tabs: document.querySelectorAll(".zp-tabs a").length }));
          st.push([u, ads.length > n0, x.cls, x.tabs]);
        }
        const okSt = st.every(([, ad, cls, tabs]) => ad && !cls && (tag === "1440" || tabs === 4));
        expect(!r.cls && !r.home && !r.feed && !r.onb && !r.tapi && r.nav === "home,fav,news,my" && !tq.length && okSt, "tapp.web", T, `${tag}: ${JSON.stringify(r)} t-bundle ${tq.length} static ${JSON.stringify(st)}`);
      } catch (e) { bad("runtime", "검사 실행", "tapp.web crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- web.sheetInView(1·2라운드 · 웹 결함): 관심 탭 줄 → 리포트가 실제로 보임 — 폰(390: 시트)·PC/태블릿(1024·1280: 두 칸 리포트) · 뒤로 = 관심 탭
  //     | 모아타운 관리지역(웹·앱 같음) = 큰 숫자 없이 안내 한 줄 + 안의 사업구역 목록(56px 줄 · 단계) + 참고값 한 줄 · 입주권 판정 없음 · 목록 단계 = 그 구역 시트 칩
  if (SEC(1, "web.sheetInView")) for (const W of [390, 1024, 1280]) {
    const T = "브라우저(390·1024·1280): 관심 탭 줄 → 구역 리포트 보임(폰 시트 · PC 두 칸) · 뒤로 = 관심 탭 | 모아타운 관리지역 첫 화면 = 안내 한 줄 + 사업구역 목록 + 참고값('가능'·입주권 판정 없음) · 목록 단계 = 그 시트 칩";
    const { ctx, page } = await newPage(browser, W < 900 ? mob(W, 844) : { viewport: { width: W, height: 860 } }, errs);
    try {
      await ctx.addInitScript(() => { try { if (!localStorage.getItem("jg-fav")) localStorage.setItem("jg-fav", '["o497"]'); localStorage.setItem("zp.onb", "1"); } catch (e) {} });
      page.__where = "web.sheetInView " + W;
      await loadHome(page); await settle(page, 400);
      await page.click('#sNav [data-nav="fav"]'); await page.waitForTimeout(1200);
      const o = { W };
      const fb = await page.$("#favTop [data-open]");
      if (fb) {
        await fb.click(); await page.waitForTimeout(1500);
        o.vis = await page.evaluate(() => { const r = document.getElementById("report"), b = r.getBoundingClientRect(), t = document.getElementById("repTitle"); return b.width > 300 && b.height > 300 && !!t && t.getBoundingClientRect().height > 0 && t.getBoundingClientRect().bottom > 0 && t.getBoundingClientRect().top < innerHeight; });
        await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(1000);
        o.back = await page.evaluate(() => !!document.querySelector("#favTop.s-on") && !document.getElementById("report").classList.contains("sheet") && getComputedStyle(document.getElementById("favTop")).display !== "none");
      }
      if (W === 390) {
        await page.evaluate(() => { location.hash = "m10"; }); await page.waitForTimeout(1800);
        o.moa = await page.evaluate(() => { const k = [...document.querySelectorAll("#report .dt-moa .dt-kid")]; return { moa: !!document.querySelector("#report .dt-moa"), big: document.querySelectorAll("#report .dt-k .dt-v").length, rows: k.length, h: k.length ? Math.round(k[0].getBoundingClientRect().height) : 0, ref: /참고/.test((document.querySelector("#report .dt-ref") || {}).textContent || ""), ok: !!document.querySelector("#report .dt-vd.ok"), ip: !!document.querySelector("#report .dt-top .dt-ip"), lab: k.length ? [k[0].dataset.go, k[0].querySelector(".dt-kst").textContent] : null, inView: k.length ? k[0].getBoundingClientRect().bottom < innerHeight : false }; });
        if (o.moa.lab) { await page.click(`#report .dt-kid[data-go="${o.moa.lab[0]}"]`); await page.waitForTimeout(1500); o.chip = await page.evaluate(() => (document.querySelector("#report .stg") || {}).textContent); }
      }
      const ok = o.vis === true && o.back === true && (W !== 390 || (o.moa.moa && o.moa.big === 0 && o.moa.rows > 0 && o.moa.h >= 56 && o.moa.ref && !o.moa.ok && !o.moa.ip && o.moa.inView && (o.chip || "").replace(/ · 확인 중$/, "") === o.moa.lab[1]));
      expect(ok, "web.sheetInView", T, JSON.stringify(o));
    } catch (e) { bad("runtime", "검사 실행", "web.sheetInView crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- web.loanPill(2라운드 5): '대출 끼고' 가정 알약 = 실제 계산(아파트 시세·빌라 감정가) — '감정가 40%'만 쓰지 않는다(웹·앱 같음)
  if (SEC(2, "web.loanPill")) {
    const T = "'대출 끼고' 가정 알약: '시세·감정가 N% 대출 가정'(아파트는 시세, 빌라는 감정가 — 계산과 같음)";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      await ctx.addInitScript(() => { try { localStorage.setItem("zp.onb", "1"); } catch (e) {} });
      page.__where = "web.loanPill"; await loadHome(page); await settle(page, 400);
      await page.click('#sGauge .s-mode button[data-f="cash"]').catch(() => {}); await page.waitForTimeout(600);
      const t = await page.evaluate(() => { const a = document.getElementById("sAsm"); return a && !a.hidden ? a.textContent : null; });
      expect(!!t && /시세·감정가 \d+%/.test(t), "web.loanPill", T, String(t));
    } catch (e) { bad("runtime", "검사 실행", "web.loanPill crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.home: 첫 화면(아이콘 10개 = 있는 화면 · 종 배지 · 배너 3장 실제 글) · 아래 탭 5개 · 뒤로 = 홈
  if (SEC(3, "tapp.home")) {
    const T = "설치 앱 첫 화면: 아이콘 10개 모두 있는 화면으로 열림(앱 화면·페이지 200) · 종 N 배지 = 새 소식 수 · 배너 3장(실제 링크 · 1 / 3) · 내 돈 카드 그대로";
    const T2 = "설치 앱 아래 탭 5개(홈·지도·관심·소식·MY): 누르면 그 화면 · 지도 = 화면 가득 · 탭은 홈 위 한 칸(뒤로 = 홈) · 표시(aria-current) 맞음";
    const { ctx, page, ads } = await appPage(mob(390, 844));
    try {
      await appHome(page);
      const h = await page.evaluate(() => {
        const g = [...document.querySelectorAll("#tHome .th-grid a")].map((a) => ({ k: a.dataset.tile, href: a.getAttribute("href"), menu: a.dataset.menu || "", map: a.hasAttribute("data-tmap"), t: a.textContent.trim() }));
        const B = [...document.querySelectorAll("#tHome .th-b")].map((a) => ({ href: a.getAttribute("href"), t: a.textContent.trim(), lab: a.getAttribute("aria-label") || "", al: a.hasAttribute("data-talert") }));
        const bn = document.querySelector("#hdrBell .t-bn");
        return { cls: document.documentElement.classList.contains("is-tapp"), g, B, cnt: (document.getElementById("tCarN") || {}).textContent, bn: bn ? { hid: bn.hidden, t: bn.textContent } : null, nNew: window.ZP_TAPP ? ZP_TAPP.newCount("") : -1,
          gauge: !!document.querySelector("#sGauge #sN"), nav: [...document.querySelectorAll("#sNav [data-nav]")].map((b) => b.dataset.nav).join(","), mapHidden: getComputedStyle(document.querySelector("#mapTop .mapcard")).display === "none", tD: (history.state && history.state.tD) || 0 };
      });
      // 아이콘 = 지금 있는 화면만: 앱 화면 id는 문서에 있거나 예전 주소 별칭 · 페이지는 200
      const pg = []; for (const x of h.g.filter((x) => !x.menu && !x.map)) { const r = await getPage("/" + x.href.replace(/^\//, "")); pg.push([x.href, r.status]); }
      const ids = await page.evaluate((L) => L.map((id) => !!document.getElementById(id) || !!(window.ZP_ALIAS && ZP_ALIAS[id])), h.g.filter((x) => x.menu).map((x) => x.menu));
      // 배너 글의 숫자 = 그 페이지 글에 그대로 있는 숫자(리포트 호수·곳 수 등)
      const bp = [], bnum = []; for (const b of h.B.filter((b) => !b.al)) { const r = await getPage("/" + b.href.replace(/^\//, "")); bp.push([b.href, r.status]); const body = String(r.text || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); for (const n of (b.lab + " " + b.t).match(/\d[\d,.]*(?:곳|호|억|건|월|년)/g) || []) if (!body.includes(n)) bnum.push(b.href + " " + n); }
      expect(h.cls && h.g.length === 10 && ids.every(Boolean) && pg.every((x) => x[1] === 200) && h.g.filter((x) => x.map).length === 1 && h.B.length === 3 && bp.every((x) => x[1] === 200) && !bnum.length && h.B.some((b) => b.al) && h.cnt === "1 / 3" && h.bn && (h.bn.hid === !(h.nNew > 0)) && h.gauge && h.mapHidden && !h.g.some((x) => /준비/.test(x.t)),
        "tapp.home", T, `${JSON.stringify({ g: h.g.map((x) => x.t), ids, pg, bp, bnum, cnt: h.cnt, bn: h.bn, nNew: h.nNew, gauge: h.gauge, mapHidden: h.mapHidden })}`);
      // 아이콘마다 실제로 눌러 본다: 앱 화면은 s-view + 그 칸 s-on(지도는 화면 가득) → 뒤로 = 홈 · 페이지는 200으로 이동 → 뒤로
      const tl = [];
      for (const x of h.g) {
        const sel = `#tHome .th-grid a[data-tile="${x.k}"]`;
        if (x.menu || x.map) {
          await page.click(sel); await page.waitForTimeout(500);
          const s = await page.evaluate((id) => { const H = document.documentElement, al = window.ZP_ALIAS && ZP_ALIAS[id], v = al ? al[0] : id; return { view: H.classList.contains("s-view"), full: H.classList.contains("s-full"), on: !!(document.getElementById(v) && document.getElementById(v).classList.contains("s-on")), tD: (history.state && history.state.tD) || 0 }; }, x.menu || "map");
          await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(500);
          const b = await page.evaluate(() => ({ home: !document.documentElement.classList.contains("s-view") && !document.documentElement.classList.contains("s-full"), tD: (history.state && history.state.tD) || 0 }));
          tl.push([x.k, x.map ? s.full : s.view && s.on, s.tD === 1, b.home && b.tD === 0]);
        } else {
          const [resp] = await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => null), page.click(sel)]);
          let st = resp ? resp.status() : 0;
          // 응답을 놓친 경우(마지막 타일에서 가끔): 실제로 그 주소로 갔고 본문 제목이 있으면 열린 것
          if (!st) { await page.waitForLoadState("load").catch(() => {}); const u = page.url(), want = x.href.replace(/^\//, "").replace(/\.html$/, ""); if (u.includes("/" + want) && await page.evaluate(() => !!document.querySelector("h1")).catch(() => false)) st = 200; }
          // 로컬 python 서버는 깨끗한 주소(.html 없음)를 못 준다 → 같은 주소를 .html로 받아 200이면 통과(배포 서버는 깨끗한 주소)
          if (st === 404) { const r2 = await getPage("/" + x.href.replace(/^\//, "")); if (r2.status === 200) st = 200; }
          await page.goBack({ waitUntil: "load" }).catch(() => {});
          await page.waitForFunction(() => document.documentElement.classList.contains("tapp-on"), null, { timeout: 20000 }).catch(() => {});
          tl.push([x.k, st === 200 || st === 304, true, true]);
        }
      }
      const kit = await page.evaluate(() => ({ grid: document.querySelectorAll("#tHome .th-ic svg.tk").length, ban: document.querySelectorAll("#tHome .th-bi svg.tk").length, nav: document.querySelectorAll("#sNav .tn-i svg.tk").length }));
      let man = null; try { man = JSON.parse((await get(BASE + "/manifest.webmanifest")).text); } catch (e) {}
      const sc = []; for (const x of (man && man.shortcuts) || []) { const i96 = (x.icons || []).find((i) => /^(9[6-9]|1\d\d)x/.test(i.sizes)); const r = i96 ? await getPage(i96.src) : { status: 0 }; sc.push([x.short_name, i96 && i96.src, r.status]); }
      expect(kit.grid >= 10 && kit.ban >= 3 && kit.nav >= 10 && sc.length === 4 && sc.every((x) => x[2] === 200) && new Set(sc.map((x) => x[1])).size === 4, "tapp.kit", "설치 앱 디자인 키트 v2: 아이콘 10·배너 그림 3·아래 탭 그림(외곽선·채움) · manifest 바로가기 4개 서로 다른 96px+ 아이콘(200)", JSON.stringify({ kit, sc }));
      expect(tl.every((t) => t[1] && t[2] && t[3]), "tapp.home", T, "누름: " + JSON.stringify(tl.filter((t) => !(t[1] && t[2] && t[3]))));
      // 아래 탭
      await appHome(page);
      const res = [];
      for (const k of ["map", "fav", "news", "my", "map", "home"]) {
        await page.click(`#sNav [data-nav="${k}"]`); await page.waitForTimeout(900);
        res.push(await page.evaluate((k) => {
          const H = document.documentElement, cur = (document.querySelector('#sNav [aria-current="page"]') || {}).dataset, mb = document.getElementById("mapbox").getBoundingClientRect();
          const want = { map: H.classList.contains("s-full") && mb.height > innerHeight * 0.6, fav: !!document.querySelector("#favTop.s-on"), news: !!document.querySelector("#news.s-on") && getComputedStyle(document.getElementById("tFeed")).display !== "none", my: !!document.querySelector("#my.s-on"), home: !H.classList.contains("s-view") && !H.classList.contains("s-full") && scrollY < 5 }[k];
          return [k, want, cur && cur.nav, (history.state && history.state.tD) || 0];
        }, k));
      }
      const tabOk = res.every(([k, w, c, d]) => w && c === k && d === (k === "home" ? 0 : 1));
      // 뒤로: 소식 → 뒤로 = 홈
      await page.click('#sNav [data-nav="news"]'); await page.waitForTimeout(700);
      await page.click('#sNav [data-nav="my"]'); await page.waitForTimeout(700);
      await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(700);
      const back = await page.evaluate(() => ({ home: !document.documentElement.classList.contains("s-view") && !document.documentElement.classList.contains("s-full"), tD: (history.state && history.state.tD) || 0, cur: (document.querySelector('#sNav [aria-current="page"]') || {}).dataset }));
      expect(h.nav === "home,map,fav,news,my" && tabOk && back.home && back.tD === 0 && back.cur && back.cur.nav === "home", "tapp.tabs", T2, `${h.nav} ${JSON.stringify(res)} back ${JSON.stringify(back)}`);
      expect(!ads.length, "tapp.noAds", "설치 앱 첫 화면: 광고 스크립트(adsbygoogle) 요청 없음(아이콘 10개 · 아래 탭을 모두 눌러 본 뒤까지)", `index: ${ads.slice(0, 2).join(" ")}`);
    } catch (e) { bad("runtime", "검사 실행", "tapp.home crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.static: (리드 결정 A) 정적 페이지 HTML은 simple-home과 같게 — 광고 태그는 예전 리터럴 그대로(심사 전엔 광고가 안 나옴), 앱 전용 주입 없음
  if (SEC(4, "tapp.static")) {
    const T = "정적 페이지 전수: 애드센스 리터럴 태그 그대로(심사 기준 · tools/fixtures/ads_tag_pages.json의 페이지마다 한 번 · 바이트 같음) · 앱 전용 광고 로더(data-zp-ads) 없음 · 다른 페이지엔 광고 태그 없음";
    const bad1 = [];
    const TAG = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9772652926977648" crossorigin="anonymous"></script>';
    const P = require("path"), PUBD = P.join(__dirname, "..", "public"), want = new Set(JSON.parse(fs.readFileSync(P.join(__dirname, "fixtures", "ads_tag_pages.json"), "utf8")));
    let nf = 0;
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = P.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith(".html")) { const rel = P.relative(PUBD, f).split(P.sep).join("/"), h = fs.readFileSync(f, "utf8"); nf++;
      const k = h.split(TAG).length - 1, any = (h.match(/<script[^>]*adsbygoogle/g) || []).length;
      if (want.has(rel) ? k !== 1 || any !== 1 : any !== 0) bad1.push(`${rel} 태그 ${k}/${any}`);
      if (/data-zp-ads/.test(h)) bad1.push(rel + " 광고 로더 있음"); } } };
    walk(PUBD);
    for (const rel of want) if (!fs.existsSync(P.join(PUBD, rel))) bad1.push(rel + " 없음");
    for (const u of ["/z/o144.html", "/report/2026-10.html", "/guide/moatown.html", "/about.html"]) { const r = await getPage(u), h = String(r.text || ""); if (!h.includes(TAG)) bad1.push(u + " 서버 응답에 리터럴 태그 없음"); }
    expect(!bad1.length && nf > 900 && want.size > 50, "tapp.static", T, `${nf}쪽 · 태그 ${want.size}쪽 · ` + bad1.slice(0, 6).join(" ; "));
  }
  // --- tapp.staticSA: 앱(display-mode standalone)에서 연 정적 페이지 — 아래 탭 '지금 여기'(MY) 표시 없음 · 새 소식 = 작은 빨간 점 (pages.css display-mode 규칙만 · 브라우저는 그대로)
  if (SEC(5, "tapp.staticSA")) {
    const T = "앱에서 연 정적 페이지: 아래 탭 MY가 현재 위치로 강조되지 않음 · 소식 표시 = 8px 빨간 점(글자 없음) — pages.css display-mode 규칙";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      page.__where = "tapp.staticSA";
      await page.goto(BASE + "/report/2026-10.html", { waitUntil: "load", timeout: 30000 });
      const before = await page.evaluate(() => { const a = document.querySelector('.zp-tabs a[aria-current="page"]'), b = document.querySelector('.zp-tabs a:not([aria-current])'); return a && b ? [getComputedStyle(a).color, getComputedStyle(b).color] : null; });
      const n = await page.evaluate(FORCE_SA);
      const r = await page.evaluate(() => { const a = document.querySelector('.zp-tabs a[aria-current="page"]'), b = document.querySelector('.zp-tabs a:not([aria-current])'), d = document.querySelector(".zp-tabs .nb-dot"); if (d) d.hidden = false; const ds = d && getComputedStyle(d); return { cur: a && getComputedStyle(a).color + getComputedStyle(a).fontWeight, oth: b && getComputedStyle(b).color + getComputedStyle(b).fontWeight, dot: ds ? [ds.width, ds.fontSize] : null }; });
      expect(n > 0 && before && before[0] !== before[1] && r.cur === r.oth && r.dot && r.dot[0] === "8px" && r.dot[1] === "0px", "tapp.staticSA", T, `rules ${n} web ${JSON.stringify(before)} app ${JSON.stringify(r)}`);
    } catch (e) { bad("runtime", "검사 실행", "tapp.staticSA crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.noAds(첫 화면): 앱 첫 화면은 광고 스크립트를 안 받는다(정적 페이지는 결정 A로 리터럴 태그 — 별도 브랜치 ads-app-guard에 로더)
  // pre-adsense 3: 앱에서 연 정적 페이지 = 아래 탭 5개(홈·지도·관심·소식·MY) · 브라우저는 4개 그대로(광고 태그는 결정 A로 리터럴 그대로라 광고 요청은 여기서 세지 않음)
  if (SEC(6, "tapp.static5")) {
    const T = "설치 앱에서 연 정적 페이지(/z·리포트·가이드): 아래 탭 5개(홈·지도·관심·소식·MY) · 같은 페이지 브라우저는 4개";
    const { ctx, page } = await appPage(mob(390, 844)); const ads = [];
    try {
      const st = [];
      for (const u of ["/z/o144.html", "/report/2026-10.html", "/guide/moatown.html"]) {
        page.__where = "tapp.noAds " + u;
        await page.goto(BASE + u, { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(600);
        st.push([u, await page.evaluate(() => ({ cls: document.documentElement.classList.contains("is-tapp"), tabs: [...document.querySelectorAll(".zp-tabs a span")].map((s) => s.textContent).join(",") }))]);
      }
      const wc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const wp = await wc.newPage(); await wp.goto(BASE + "/report/2026-10.html", { waitUntil: "load", timeout: 30000 }); await wp.waitForTimeout(400);
      const web = await wp.evaluate(() => [...document.querySelectorAll(".zp-tabs a span")].map((s) => s.textContent).join(",")); await wc.close();
      expect(st.every(([, x]) => x.cls && x.tabs === "홈,지도,관심,소식,MY") && web.split(",").length === 4, "tapp.static5", T, `web ${web} ${JSON.stringify(st)}`);
    } catch (e) { bad("runtime", "검사 실행", "tapp.noAds crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.split(pre-adsense 5): 설치 앱은 앱 코드를 덩이로 나눠 도는 판(/b/ta.*.js)만 받고, 웹은 예전 판(/b/a.*.js)만 받는다(파일 수 같음) · 앱은 마지막 덩이까지 돈 뒤 붙음 · 덩이 사이 예약(타이머·프레임) 잡아 두기가 끝나 원래 함수로 돌아옴 · 웹 서비스 워커 미리 받기에 ta 없음
  if (SEC(7, "tapp.split")) {
    const T = "앱 코드 나눠 실행: 설치 앱 = /b/ta.*.js 하나(a.*.js 안 받음) · 웹 = /b/a.*.js 하나(ta 안 받음 · 받는 파일 수 그대로) · 앱 ZP_aWait 풀린 뒤 zp:hydrated · setTimeout 원래 함수 · sw 미리 받기 정규식에 ta 안 걸림";
    const R = [];
    for (const mode of ["app", "web"]) {
      const { ctx, page } = mode === "app" ? await appPage(mob(390, 844)) : await newPage(browser, mob(390, 844), errs);
      try {
        const U = []; page.on("request", (q) => { const m = /\/b\/(t?a)\.[0-9a-f]{10}\.js/.exec(q.url()); if (m) U.push(m[1]); });
        await page.goto(BASE + "/#map", { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(5000);
        const st = await page.evaluate(async () => ({ aw: !!window.ZP_aWait, done: window.ZP_aWait ? await Promise.race([window.ZP_aWait.then(() => 1), new Promise((r) => setTimeout(() => r(0), 3000))]) : null, hyd: window.ZP_boot && ZP_boot.hyd, booted: window.ZP_booted, st: String(window.setTimeout).includes("[native code]"), raf: String(window.requestAnimationFrame).includes("[native code]") }));
        const want = mode === "app" ? "ta" : "a";
        if (U.join(",") !== want) R.push(`${mode} 받은 앱 코드 ${U.join(",") || "없음"}`);
        if (mode === "app" && (!st.aw || st.done !== 1)) R.push(`app 덩이 끝 ${JSON.stringify(st)}`);
        if (mode === "web" && st.aw) R.push("web에 ZP_aWait");
        if (st.hyd !== 1 || st.booted !== 1 || !st.st || !st.raf) R.push(`${mode} ${JSON.stringify(st)}`);
      } catch (e) { R.push(mode + " crash " + String(e.message || e).split("\n")[0]); } finally { await ctx.close().catch(() => {}); }
    }
    const sw = String((await getPage("/sw.js")).text || ""), idx = String((await getPage("/")).text || "");
    const rx = /\/b\/[a-su-z]\.[0-9a-f]{10}\.(?:js|css|json)/g, pre = [...new Set(idx.match(rx) || [])];
    if (!/\[a-su-z\]/.test(sw)) R.push("sw.js 미리 받기 정규식이 바뀜");
    if (pre.some((u) => /\/b\/ta\./.test(u)) || !/\/b\/ta\.[0-9a-f]{10}\.js/.test(idx)) R.push("index의 ta 표기/미리 받기 " + pre.join(","));
    expect(!R.length, "tapp.split", T, R.join(" ; "));
  }
  // --- tapp.toggleDark(pre-adsense · 실기기 다크 모드): MY 알림 스위치 켜짐·꺼짐·막힘 — 계산 색 = 지정 색 · 비텍스트 대비(켜짐 트랙/카드 ≥ 3 · 꺼짐 손잡이/카드 ≥ 3 · 막힘 손잡이/카드 ≥ 3) · 막힘 글자 대비 ≥ 4.5 · 라이트는 예전 색 그대로
  if (SEC(8, "tapp.toggleDark")) {
    const T = "설치 앱 다크 MY 알림 스위치: 켜짐 트랙 #8EA8F5·흰 손잡이 · 꺼짐 트랙 #3A3F47(+1px 밝은 테두리)·손잡이 #B0B8C1 · 막힘 손잡이 #6B7280 · 비텍스트 대비 3:1 이상 · 막힘 글자 4.5:1 이상 · 라이트 켜짐 #1F3A87 그대로";
    const R = [];
    for (const cs of ["dark", "light"]) {
      const { ctx, page } = await appPage({ ...mob(390, 844), colorScheme: cs });
      try {
        await page.goto(BASE + "/#my", { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(3500);
        const st = await page.evaluate(async () => {
          const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
          const L = (c) => { const [r, g, b] = rgb(c).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
          const CR = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
          const card = (e) => { while (e) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c) && rgb(c)[3] !== 0) return c; e = e.parentElement; } return "rgb(255, 255, 255)"; };
          const one = (b) => { const t = b.querySelector(".my-tg"), k = getComputedStyle(t, "::after"), bg = card(b.parentElement); const tx = b.querySelector(".my-t b") || b; return { track: getComputedStyle(t).backgroundColor, shadow: getComputedStyle(t).boxShadow, knob: k.backgroundColor, card: bg, crTrack: +CR(getComputedStyle(t).backgroundColor, bg).toFixed(2), crKnob: +CR(k.backgroundColor, bg).toFixed(2), crText: +CR(getComputedStyle(tx).color, bg).toFixed(2) }; };
          const sw = [...document.querySelectorAll("#myKinds .my-sw")]; if (sw.length < 2) return { n: sw.length };
          sw.forEach((b) => b.setAttribute("aria-checked", "true"));
          const w = () => new Promise((r) => setTimeout(r, 400)); await w(); const on2 = one(sw[0]); sw[1].setAttribute("aria-checked", "false"); await w(); const off = one(sw[1]);
          sw[1].setAttribute("aria-disabled", "true"); document.getElementById("my").classList.add("t-pdeny"); await w(); const dis = one(sw[1]);
          return { n: sw.length, on: on2, off, dis };
        });
        const E = (a, b) => String(a).replace(/\s/g, "") === b;
        if (!st.on) R.push(`${cs} 스위치 ${st.n}개`);
        else if (cs === "dark") {
          if (!E(st.on.track, "rgb(142,168,245)") || !E(st.on.knob, "rgb(255,255,255)") || st.on.crTrack < 3) R.push(`켜짐 ${JSON.stringify(st.on)}`);
          if (!E(st.off.track, "rgb(58,63,71)") || !E(st.off.knob, "rgb(176,184,193)") || !/rgba\(255, 255, 255, 0\.12\)/.test(st.off.shadow) || st.off.crKnob < 3) R.push(`꺼짐 ${JSON.stringify(st.off)}`);
          if (!E(st.dis.track, "rgb(58,63,71)") || !E(st.dis.knob, "rgb(107,114,128)") || st.dis.crKnob < 3 || st.dis.crText < 4.5) R.push(`막힘 ${JSON.stringify(st.dis)}`);
        } else if (!E(st.on.track, "rgb(31,58,135)") || !E(st.on.knob, "rgb(255,255,255)")) R.push(`라이트 켜짐 ${JSON.stringify(st.on)}`);
      } catch (e) { R.push(cs + " crash " + String(e.message || e).split("\n")[0]); } finally { await ctx.close().catch(() => {}); }
    }
    expect(!R.length, "tapp.toggleDark", T, R.join(" ; "));
  }
  // --- tapp.noHomeFlash(tabfix): 아래 탭으로 화면을 바꾸는 동안 목적 화면이 아닌 홈 요소(홈 카드·그리드·배너·목록)가 한 프레임도 안 보임 — 4×CPU · 경로마다 5번
  // 탭끼리 20쌍 · 도구 화면(입주 계산·순위) → 탭 · 구역 시트 → 탭 · 정적 페이지(리포트·/z·가이드·소개) → 탭(새 문서: 덮개는 남색 스플래시가 아니라 탭 바탕) · 콜드 스타트는 그대로 스플래시
  // 매 프레임(requestAnimationFrame) 화면 여섯 곳에서 맨 위 요소를 집어 홈 요소 안이면 '홈 보임'. 홈에서 떠날 때는 홈이 한 번 가려진 뒤 다시 보이면 셈
  if (SEC(9, "tapp.noHomeFlash")) {
    const T = "설치 앱 탭 전환 중 홈 비침 없음(4×CPU · 경로마다 5번): 탭 20쌍 · 도구 → 탭 · 시트 → 탭 · 정적 페이지 → 탭(덮개 = 탭 바탕, 남색 스플래시 아님) · 콜드 스타트는 스플래시";
    const R = []; let nT = 0;
    const PROBE = () => { window.__fr = []; window.__pr = 0; try { if (sessionStorage.getItem("__prOn") === "1") { window.__pr = 1; sessionStorage.removeItem("__prOn"); } } catch (e) {}
      const HS = "#tHome,#sGauge,#sListW,#sMini,.th-b", pts = [[0.5, 0.25], [0.5, 0.45], [0.5, 0.65], [0.25, 0.5], [0.75, 0.5], [0.5, 0.85]];
      const tick = () => { if (window.__pr) { let hit = 0; for (const [x, y] of pts) { const e = document.elementFromPoint(innerWidth * x, innerHeight * y); if (e && e.closest && e.closest(HS)) { hit = 1; break; } } const c = document.documentElement.className; window.__fr.push([hit, /tapp-cover/.test(c) ? 1 : 0, /tapp-tab/.test(c) ? 1 : 0]); } requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
    const mk = async () => {
      const r = await newPage(browser, mob(390, 844), errs);
      await r.ctx.addInitScript(() => { let fs = 0; try { fs = sessionStorage.getItem("__prOn") === "1"; } catch (e) {} if (!fs) try { Object.defineProperty(Document.prototype, "referrer", { get: () => "android-app://kr.alwaysquestions.zippin/" }); } catch (e) {} try { sessionStorage.setItem("zp.tapp", "1"); localStorage.setItem("zp.tonb", "1"); localStorage.setItem("zp.onb", "1"); } catch (e) {} });
      await r.ctx.addInitScript(PROBE);
      await r.ctx.route(/^https?:\/\/[^/]+\/(?:years|report\/\d{4}-\d\d|guide\/[a-z0-9-]+)(?:[?#].*)?$/, (q) => { const u = new URL(q.request().url()); u.pathname += ".html"; return q.continue({ url: u.toString() }); });
      const cdp = await r.ctx.newCDPSession(r.page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      return r;
    };
    const ready = (p) => p.waitForFunction(() => document.documentElement.classList.contains("tapp-on") && !document.documentElement.classList.contains("tapp-cover"), null, { timeout: 40000 }).then(() => p.waitForTimeout(900));
    const tab = (p, k) => p.evaluate((k) => { const b = document.querySelector(`#sNav [data-nav="${k}"]`); if (b) b.click(); return !!b; }, k);
    const measure = async (p, act) => { await p.evaluate(() => { window.__fr = []; window.__pr = 1; }); await act(); await p.waitForTimeout(1800); return p.evaluate(() => { window.__pr = 0; return window.__fr; }); };
    const cnt = (fr, from) => { if (from === "home") { const i = fr.findIndex((f) => !f[0]); return i < 0 ? 0 : fr.slice(i).filter((f) => f[0]).length; } return fr.filter((f) => f[0]).length; };
    const TABS = ["home", "map", "fav", "news", "my"];
    try {
      const RUNS = +process.env.QAC_NHF_RUNS || 5;   // 개발 때만 줄여 돌림 · 게이트는 5
      // QAC_NHF_SLICE="k/n": 5번 중 run % n == k-1 인 것만(단위 nhf1..n이 나눠 돌림 · 합치면 5번 그대로)
      const [sk, sn] = (process.env.QAC_NHF_SLICE || "1/1").split("/").map(Number);
      for (let run = 0; run < RUNS; run++) {
        if (run % sn !== sk - 1) continue;
        { const { ctx, page } = await mk();
          try {
            await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 40000 }); await ready(page);
            for (const a of TABS) for (const z of TABS) { if (a === z || z === "home") continue; await tab(page, a); await page.waitForTimeout(900); const fr = await measure(page, () => tab(page, z)); nT++; const n = cnt(fr, a); if (n) R.push(`${a}→${z} ${n}프레임`); }
            for (const t of ["calc", "rank"]) for (const z of ["map", "fav", "news", "my"]) { await tab(page, "home"); await page.waitForTimeout(700); await page.click(`#tHome .th-grid a[data-tile="${t}"]`); await page.waitForTimeout(1000); const fr = await measure(page, () => tab(page, z)); nT++; const n = cnt(fr, "tool"); if (n) R.push(`도구 ${t}→${z} ${n}프레임`); }
            for (const a of ["home", "fav", "news"]) for (const z of ["map", "fav", "news", "my"]) { if (a === z) continue; await tab(page, a); await page.waitForTimeout(700); await page.evaluate(() => { location.hash = "o497"; }); await page.waitForTimeout(1200); const fr = await measure(page, () => tab(page, z)); nT++; const n = cnt(fr, "sheet"); if (n) R.push(`시트(${a})→${z} ${n}프레임`); }
          } catch (e) { R.push("SPA crash " + String(e.message || e).split("\n")[0]); } finally { await ctx.close().catch(() => {}); } }
        for (const pg of ["/report/2026-10.html", "/z/o144.html", "/guide/moatown.html", "/about.html"]) for (const [lab, z] of [["지도", "map"], ["관심", "fav"], ["소식", "news"], ["MY", "my"]]) {
          const { ctx, page } = await mk();
          try {
            await page.goto(BASE + pg, { waitUntil: "load", timeout: 40000 }); await page.waitForTimeout(500);
            await page.evaluate(() => sessionStorage.setItem("__prOn", "1"));
            const a = await page.$(`.zp-tabs a:has(span:text-is("${lab}"))`); if (!a) { R.push(`${pg} '${lab}' 링크 없음`); continue; }
            await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => {}), a.click()]);
            await page.waitForFunction(() => window.__fr && window.__fr.length > 5 && !document.documentElement.classList.contains("tapp-cover"), null, { timeout: 40000 }).catch(() => {});
            await page.waitForTimeout(1500);
            const fr = await page.evaluate(() => window.__fr || []); nT++;
            const n = fr.filter((f) => f[0] && !f[1]).length, cov = fr.filter((f) => f[1]).length, tabC = fr.filter((f) => f[1] && f[2]).length;
            if (n) R.push(`${pg}→${z} ${n}프레임`);
            if (!fr.length) R.push(`${pg}→${z} 프레임 기록 없음`);
            if (cov && tabC !== cov) R.push(`${pg}→${z} 덮개가 탭 바탕이 아님(${tabC}/${cov})`);
          } catch (e) { R.push(`${pg}→${z} crash ` + String(e.message || e).split("\n")[0]); } finally { await ctx.close().catch(() => {}); }
        }
      }
      // 콜드 스타트(앱 아이콘)는 예전 그대로 남색 스플래시(탭 바탕 덮개 아님) — 나눠 돌 때는 첫 몫에서만
      if (sk === 1) { const { ctx, page } = await appPage(mob(390, 844)); try { await page.goto(BASE + "/#news", { waitUntil: "domcontentloaded", timeout: 40000 }); const c = await page.evaluate(() => document.documentElement.className); if (/tapp-tab/.test(c) || !/tapp-cover|tapp-on/.test(c)) R.push("콜드 스타트 덮개 " + c.slice(0, 80)); } finally { await ctx.close().catch(() => {}); } }
    } catch (e) { R.push("crash " + String(e.message || e).split("\n")[0]); }
    { const [sk, sn] = (process.env.QAC_NHF_SLICE || "1/1").split("/").map(Number), RUNS = +process.env.QAC_NHF_RUNS || 5, mine = Array.from({ length: RUNS }, (_, r) => r).filter((r) => r % sn === sk - 1).length;
      expect(!R.length && nT >= mine * (16 + 8 + 10 + 16), "tapp.noHomeFlash", T, `${nT}번 전환(이 몫 ${mine}번 × 50) · ` + R.slice(0, 8).join(" ; ")); }
  }
  // --- tapp.feed: 전체 소식 = data/changes.json(종류별 수 같음) · 칩으로 거르기 · 줄을 누르면 그 구역 · 관심 구역(예전 소식) 칸 그대로
  if (SEC(10, "tapp.feed")) {
    const T = "설치 앱 전체 소식: 칩 수 = changes.json을 같은 거래끼리 합친 종류별 건수(실거래·경공매만 합침 · 합친 소식의 항목 합 = 원본 수) · 칩 거르기 · 줄 → 구역 열림 · '관심 구역' 칸 = 예전 내 소식";
    const { ctx, page } = await appPage(mob(390, 844));
    try {
      await appHome(page);
      await page.click('#sNav [data-nav="news"]'); await page.waitForTimeout(1200);
      const f = await page.evaluate(() => {
        const ch = {}; document.querySelectorAll("#tFeed [data-ft]").forEach((b) => { ch[b.dataset.ft || "all"] = +(b.querySelector("small").textContent.replace(/,/g, "")); });
        return { ch, rows: document.querySelectorAll("#tFeed .tf-it").length, api: window.ZP_TAPP.feedCounts() };
      });
      const all = Object.values(EXP).reduce((a, b) => a + b, 0), raw = CH ? CH.items.length : -1;
      const un = await page.evaluate(() => window.ZP_TAPP.feedUnits());
      const sumN = un.reduce((a, u) => a + u.n, 0);
      const cntOk = f.ch.all === all && ["trade", "auction", "notice", "stage", "price"].every((k) => (f.ch[k] || 0) === (EXP[k] || 0)) && sumN === raw && un.length === all && all <= raw;
      await page.click('#tFeed [data-ft="auction"]'); await page.waitForTimeout(300);
      const au = await page.evaluate(() => [...document.querySelectorAll("#tFeed .tf-it .tf-tg")].map((t) => t.textContent));
      const id = await page.evaluate(() => { const b = document.querySelector("#tFeed .tf-it[data-open]"); return b && b.dataset.open; });
      await page.click("#tFeed .tf-it[data-open]"); await page.waitForTimeout(1500);
      const z = await page.evaluate(() => { const r = document.getElementById("report").getBoundingClientRect(); return { sheet: document.getElementById("report").classList.contains("sheet") && r.height > innerHeight * 0.6 && r.width > innerWidth * 0.9 && !!document.getElementById("repTitle") && document.getElementById("repTitle").getBoundingClientRect().height > 0, h: location.hash.slice(1) }; });
      await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(800);
      await page.click("#tSegM"); await page.waitForTimeout(400);
      const mine = await page.evaluate(() => ({ seg: document.getElementById("news").dataset.tseg, mineVis: getComputedStyle(document.querySelector("#news > .nw-mine")).display !== "none", feedVis: getComputedStyle(document.getElementById("tFeed")).display !== "none" }));
      expect(cntOk && f.rows > 0 && au.length > 0 && au.every((t) => t === "경매") && z.sheet && mine.seg === "mine" && mine.mineVis && !mine.feedVis, "tapp.feed", T, `chips ${JSON.stringify(f.ch)} expect all ${all} ${JSON.stringify(EXP)} (raw ${raw} ${JSON.stringify(RAW)} · 합친 소식 항목 합 ${sumN}) · rows ${f.rows} · auction tags ${au.length}/${au.filter((t) => t === "경매").length} · open ${id} ${JSON.stringify(z)} · mine ${JSON.stringify(mine)}`);
    } catch (e) { bad("runtime", "검사 실행", "tapp.feed crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.onboard: 처음 실행 안내 3장 · 한 번만(건너뛰면 다시 안 뜸) · 뒤로 가기로도 닫힘
  if (SEC(11, "tapp.onboard")) {
    const T = "설치 앱 처음 실행 안내: 처음엔 뜸(3장 · 건너뛰기 있음) · 건너뛴 뒤 다시 열면 안 뜸 · 닫은 뒤 홈에서 기록 깊이 0";
    const { ctx, page } = await appPage(mob(390, 844), true);
    try {
      await appHome(page); await page.waitForTimeout(300);
      const a = await page.evaluate(() => ({ on: !!document.getElementById("tOnb"), skip: !!document.querySelector("#tOnb [data-oskip]"), step: (document.querySelector("#tOnb .tob-k") || {}).textContent }));
      await page.click("#tOnb [data-onext]"); await page.waitForTimeout(200);
      await page.click("#tOnb [data-onext]"); await page.waitForTimeout(200);
      const c = await page.evaluate(() => (document.querySelector("#tOnb .tob-k") || {}).textContent);
      await page.click("#tOnb [data-oskip]"); await page.waitForTimeout(600);
      const b = await page.evaluate(() => ({ on: !!document.getElementById("tOnb"), ls: localStorage.getItem("zp.tonb"), tD: (history.state && history.state.tD) || 0 }));
      await appHome(page, "/?src=app&qac=" + (++LOADS)); await page.waitForTimeout(400);
      const d = await page.evaluate(() => !!document.getElementById("tOnb"));
      expect(a.on && a.skip && /^1 \/ 3/.test(a.step || "") && /^3 \/ 3/.test(c || "") && !b.on && b.ls === "1" && b.tD === 0 && !d, "tapp.onboard", T, `${JSON.stringify(a)} step3 ${c} after ${JSON.stringify(b)} again ${d}`);
    } catch (e) { bad("runtime", "검사 실행", "tapp.onboard crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.a11y · tapp.overflow · tapp.cls: axe 심각·치명 0(밝게·어둡게: 홈·소식·안내) · 360/390/412 가로 넘침 없음 · 첫 화면 밀림 ≈ 0
  if (SEC(12, "tapp.a11y")) {
    const T = "설치 앱 접근성: axe serious·critical 0 — 홈·전체 소식·지도 탭·처음 안내(밝게·어둡게)";
    const T2 = "설치 앱 가로 넘침 없음(360·390·412): 홈·소식·관심·MY·지도 탭(레이아웃 뷰포트 = 창 폭)";
    const T3 = "설치 앱 첫 화면 밀림(CLS) 0.02 미만";
    let AXE = null; try { const ap = process.env.AXE_PATH || require.resolve("axe-core/axe.min.js"); AXE = fs.readFileSync(ap, "utf8"); } catch (e) {}
    const AX = async (page) => { await page.addScriptTag({ content: AXE }).catch(() => {}); return page.evaluate(async () => { const r = await window.axe.run(document, { resultTypes: ["violations"] }); return r.violations.filter((x) => x.impact === "serious" || x.impact === "critical").flatMap((x) => x.nodes.slice(0, 3).map((n) => x.id + " " + n.target.join(" "))); }); };
    for (const cs of ["light", "dark"]) {
      const { ctx, page } = await appPage(mob(390, 844, cs), true);
      try {
        await appHome(page);
        const v = [];
        if (AXE) {
          v.push(...(await AX(page)).map((x) => "onb " + x));
          await page.click("#tOnb [data-oskip]"); await page.waitForTimeout(500);
          v.push(...(await AX(page)).map((x) => "home " + x));
          await page.click('#sNav [data-nav="news"]'); await page.waitForTimeout(1200);
          v.push(...(await AX(page)).map((x) => "news " + x));
          await page.click('#sNav [data-nav="map"]'); await page.waitForTimeout(1500);
          v.push(...(await AX(page)).map((x) => "map " + x));
          expect(!v.length, "tapp.a11y", T, `${cs}: ${v.length}: ${v.slice(0, 6).join(" ; ")}`);
        } else skip("tapp.a11y", T, "axe-core 없음(AXE_PATH)");
      } catch (e) { bad("runtime", "검사 실행", "tapp.a11y crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
    for (const w of [360, 390, 412]) {
      const { ctx, page } = await appPage(mob(w, 800));
      try {
        await page.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: "layout-shift", buffered: true }); } catch (e) {} });
        await appHome(page); await page.waitForTimeout(1500);
        const cls = await page.evaluate(() => window.__cls);
        const ov = [];
        // 레이아웃 뷰포트가 넓어지면 innerWidth도 같이 커진다(364/360) → 창 폭(w)과 비교
        const chk = async (k) => { const o = await page.evaluate((w) => Math.max(document.documentElement.scrollWidth, innerWidth) - w, w); if (o > 1) ov.push(`${k} +${o}px`); };
        await chk("home");
        const lab = await page.evaluate(() => [...document.querySelectorAll("#tHome .th-l")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
        if (lab.length) ov.push("잘린 아이콘 이름 " + lab.join(","));
        for (const k of ["news", "fav", "my", "map"]) { await page.click(`#sNav [data-nav="${k}"]`); await page.waitForTimeout(1100); await chk(k); }
        expect(!ov.length, "tapp.overflow", T2, `${w}: ${ov.join(" ; ")}`);
        expect(cls < 0.02, "tapp.cls", T3, `${w}: CLS ${cls.toFixed(4)}`);
      } catch (e) { bad("runtime", "검사 실행", "tapp.overflow crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // ================= 1라운드 레드팀 수정이 되돌아가지 않게 =================
  // --- tapp.race(D1): 4×CPU 감속으로 10번 — 웹 코드가 아래 탭을 다시 그려도 5탭(지도 포함) 유지
  if (SEC(13, "tapp.race")) {
    const T = "설치 앱 아래 탭 5개 경쟁 상태: 4×CPU 감속 10번 모두 홈·지도·관심·소식·MY(지도 탭 사라짐 없음)";
    await flaky("tapp.race", "tapp.race", async (a) => {   // 알려진 불안정(감속 중 로컬 서버 응답 늦음) → 10번 묶음을 최대 3번
    const R = [];
    for (let i = 0; i < 10; i++) {
      const { ctx, page } = await appPage(mob(390, 844));
      try {
        const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        page.__where = "tapp.race " + i;
        // 로컬 python 서버가 감속 중 가끔 응답을 늦게 준다 → 문서 준비까지만 기다리고, 주소 열기 자체가 실패하면 한 번 더(탭 판정과 무관한 실패)
        await page.goto(BASE + "/?src=app&race=" + i + "-" + a, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => page.goto(BASE + "/?src=app&race=" + i + "b" + a, { waitUntil: "domcontentloaded", timeout: 60000 }));
        await page.waitForFunction(() => document.documentElement.classList.contains("tapp-on"), null, { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(2500);
        R.push(await page.evaluate(() => [...document.querySelectorAll("#sNav [data-nav]")].map((b) => b.dataset.nav).join(",") + (document.querySelectorAll("#sNav .tn-i svg").length >= 10 ? "" : " (그림 없음)")));
      } catch (e) { R.push("crash " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
    expect(R.every((x) => x === "home,map,fav,news,my"), "tapp.race", T, JSON.stringify(R));
    });
  }
  // --- tapp.lcp(18): 4×CPU에서 앱 첫 화면 LCP ≤ 1.0초(3번 가운데 값)
  if (SEC(14, "tapp.lcp")) {
    const T = "설치 앱 첫 화면 LCP ≤ 1,000ms (4×CPU 감속 · 3번 가운데 값) — 섬 위에 앱 첫 화면을 먼저 그림";
    const L = [];
    for (let i = 0; i < 3; i++) {
      const { ctx, page } = await appPage(mob(390, 844));
      try {
        const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.addInitScript(() => { window.__lcp = 0; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { window.__lcp = e.startTime; })).observe({ type: "largest-contentful-paint", buffered: true }); } catch (e) {} });
        page.__where = "tapp.lcp";
        await page.goto(BASE + "/?src=app&lcp=" + i, { waitUntil: "load", timeout: 40000 }); await page.waitForTimeout(3500);
        L.push(Math.round(await page.evaluate(() => window.__lcp)));
      } catch (e) { L.push(99999); }
      finally { await ctx.close().catch(() => {}); }
    }
    const med = L.slice().sort((a, b) => a - b)[1];
    expect(med > 0 && med <= 1000, "tapp.lcp", T, `LCP ${L.join(", ")}ms`);
  }
  if (SEC(15, "tapp.chips")) {
    const { ctx, page } = await appPage(mob(390, 844));
    try {
      // --- tapp.order(8): 머리 → 가치 한 줄(= 내 돈 카드 숫자) → 검색 → 내 돈 카드 → 아이콘 → 배너 → 목록 · 아이콘 순서·이름
      await appHome(page);
      const o = await page.evaluate(() => {
        const y = (s) => { const e = document.querySelector(s); return e && e.getClientRects().length ? Math.round(e.getBoundingClientRect().top + scrollY) : -1; };
        const v = document.getElementById("tVal");
        return { ys: ["#tVal", "#sSearch", "#sGauge", "#tHome .th-grid", "#tHome .th-car", "#sListW"].map(y), val: v && v.textContent, n: (document.getElementById("sN") || {}).textContent, cash: ((document.getElementById("sCashV") || {}).textContent || "").replace(/\s+/g, ""), tiles: [...document.querySelectorAll("#tHome .th-l")].map((e) => e.textContent).join(","), rail: !!(document.getElementById("sSum") && document.getElementById("sSum").offsetParent), cut: [...document.querySelectorAll("#tHome .th-l")].filter((e) => e.scrollHeight > e.clientHeight + 2).map((e) => e.textContent) };
      });
      const asc = o.ys.every((v, i) => v >= 0 && (i === 0 || v > o.ys[i - 1]));
      expect(asc && o.val === "내 돈으로 갈 수 있는 서울 재개발" && o.tiles === "지도,입주 계산,출퇴근,입주권,매수 전 규정,순위,모으면 언제,통계,월간 리포트,몇 년 걸리나" && !o.rail && !o.cut.length, "tapp.order", "설치 앱 첫 화면 순서: 가치 한 줄(내 돈·곳 수 = 내 돈 카드) → 검색 → 내 돈 카드 → 아이콘(첫 줄 매일 쓰는 것) → 배너 → 목록 · 가로 카드 3장 없음(목록과 중복) · 아이콘 이름 안 잘림", JSON.stringify(o));
      // --- tapp.chips(13): '예산 거의 다 씀'은 남는 돈 1,000만 이하만 · 유형 칩 선택 = 남색, 검은 고리 없음
      const ch = await page.evaluate(() => { const L = [...document.querySelectorAll("#sList li.s-card")].map((li) => ({ fit: !!li.querySelector(".s-fit"), left: (li.querySelector(".s-left") || {}).textContent || "" })); const b = document.querySelector('.s-flt button[aria-pressed="true"]'), bs = getComputedStyle(b), be = getComputedStyle(b, "::before"); return { L, bg: bs.backgroundColor, sh: bs.boxShadow, before: be.backgroundColor }; });
      const NAV = await page.evaluate(() => { const c = document.createElement("i"); c.style.color = "#1F3A87"; document.body.appendChild(c); const v = getComputedStyle(c).color; c.remove(); return v; });
      expect(ch.before === NAV && (ch.bg === "rgba(0, 0, 0, 0)" || ch.bg === "transparent") && ch.sh === "none", "tapp.chips", "설치 앱 목록 유형 칩: 선택 = 남색 알약 하나(검은 고리·이중 배경 없음)", JSON.stringify({ bg: ch.bg, sh: ch.sh, before: ch.before }));
      // --- tapp.minFont(12): 보이는 글자 12px 이상(홈·지도·관심·소식·MY)
      const small = [];
      const scan = (k) => page.evaluate((k) => { const o = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.textContent.trim(); if (!t || /^[↗›‹·]$/.test(t)) continue; const e = n.parentElement; if (!e || !e.getClientRects().length || e.closest(".sr-only,[hidden],.t-bn,.tob")) continue; const cs = getComputedStyle(e); if (cs.visibility === "hidden" || +cs.opacity === 0 || e.getBoundingClientRect().width < 2) continue; if (parseFloat(cs.fontSize) < 11.9) o.push(k + ":" + e.tagName + "." + String(e.className.baseVal != null ? e.className.baseVal : e.className).split(" ")[0] + " " + cs.fontSize + " " + t.slice(0, 10)); } return o.slice(0, 4); }, k);
      small.push(...await scan("home"));
      for (const k of ["map", "fav", "news", "my"]) { await page.click(`#sNav [data-nav="${k}"]`); await page.waitForTimeout(1100); small.push(...await scan(k)); }
      expect(!small.length, "tapp.minFont", "설치 앱 보이는 글자 12px 이상(홈·지도·관심·소식·MY)", small.join(" ; "));
      // --- tapp.feedText(14·7): 칩 순서 · 새 소식 = 빨간 점(숫자 알약 아님) · 실거래 글 다듬기 · 이름 가운뎃점 공백 · 합계 줄에 기간·종류 · 소식 칸 선택 표시
      await page.click('#sNav [data-nav="news"]'); await page.waitForTimeout(1200);
      const f = await page.evaluate(() => ({ chips: [...document.querySelectorAll("#tFeed [data-ft]")].map((b) => b.dataset.ft || "all").join(","), pill: [...document.querySelectorAll("#tFeed .tf-chips .tf-n")].filter((i) => i.textContent.trim()).length, txt: [...document.querySelectorAll("#tFeed .tf-tx small")].map((x) => x.textContent).filter((t) => /새 실거래 1건|\(\d+\.\d+ 계약\)|· 신고가$/.test(t)).slice(0, 2), nm: [...document.querySelectorAll("#tFeed .tf-tx b")].map((x) => x.textContent).filter((t) => /\s·/.test(t)).slice(0, 2), seg: [...document.querySelectorAll(".tf-seg [role=tab]")].map((b) => b.getAttribute("aria-selected")).join(","), sum: (document.querySelector("#tFeed .tf-sum") || {}).textContent }));
      await page.click('#tFeed [data-ft="stage"]'); await page.waitForTimeout(300);
      const sum2 = await page.evaluate(() => (document.querySelector("#tFeed .tf-sum") || {}).textContent);
      const bk = await page.evaluate(() => (document.querySelector("#tHome .th-b.b1 .th-bk") || {}).textContent);
      expect(f.chips === "all,stage,notice,auction,trade,price" && !f.pill && !f.txt.length && !f.nm.length && f.seg === "true,false" && /최근 30일 단계 변경 \d+건/.test(sum2 || "") && /기준/.test(bk || ""), "tapp.feedText", "설치 앱 소식: 칩 순서 단계 변경→고시·공고→경공매→실거래 · 새 소식 = 점 · '아파트 44.8㎡ · 2.8억 · 10월 7일 계약' · 이름 '·' 앞 공백 없음 · 합계 줄 '최근 30일 단계 변경 N건' · 배너 키커에 리포트 기간 · 전체 소식 칸 선택 표시", JSON.stringify({ f, sum2, bk }));
      // --- tapp.mineSheet(1): 관심 구역 칸 줄 → 시트가 실제로 보임 · 뒤로 = 소식
    } catch (e) { bad("runtime", "검사 실행", "tapp.r1 home crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.sheets(1·4): 관심 탭 줄 → 시트 보임 → 뒤로 = 관심 탭 · 지도 탭(구) → 구역 시트 → 뒤로 = 지도 탭 · 홈으로 → 구 거르기 안 샘 · 모아타운 → 개별 조합 → 뒤로 = 모아타운 시트(단계 표기 같음)
  if (SEC(16, "tapp.sheets")) {
    const T = "설치 앱 시트: 관심 탭 줄 → 시트 보임 · 뒤로 = 관심 탭 | 지도 탭 구 → 구역 → 뒤로 = 지도 탭 · 홈에 구 거르기 안 샘 | 모아타운 → 개별 조합(목록 단계 = 시트 칩) → 뒤로 = 모아타운";
    const { ctx, page } = await appPage(mob(390, 844));
    try {
      await ctx.addInitScript(() => { try { if (!localStorage.getItem("jg-fav")) localStorage.setItem("jg-fav", '["o497"]'); } catch (e) {} });
      await appHome(page);
      const vis = () => page.evaluate(() => { const r = document.getElementById("report"); const b = r.getBoundingClientRect(); return r.classList.contains("sheet") && b.height > innerHeight * 0.6 && !!document.getElementById("repTitle") && document.getElementById("repTitle").getBoundingClientRect().height > 0; });
      const st = () => page.evaluate(() => ({ full: document.documentElement.classList.contains("s-full"), view: document.documentElement.classList.contains("s-view"), sheet: document.getElementById("report").classList.contains("sheet"), fav: !!document.querySelector("#favTop.s-on"), cur: (document.querySelector('#sNav [aria-current="page"]') || {}).dataset?.nav, title: (document.getElementById("repTitle") || {}).textContent, gu: !document.getElementById("sGu").hidden }));
      const out = {};
      await page.click('#sNav [data-nav="fav"]'); await page.waitForTimeout(1200);
      const fb = await page.$("#favTop [data-open]");
      if (fb) { await fb.click(); await page.waitForTimeout(1500); out.favVis = await vis(); await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(900); out.favBack = await st(); } else out.favVis = "관심 줄 없음";
      await page.click('#sNav [data-nav="map"]'); await page.waitForTimeout(1500);
      await page.evaluate(() => { const g = document.querySelector('#mapbox button.zgu[data-gu="양천구"]') || document.querySelector("#mapbox button.zgu[data-gu]"); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await page.waitForTimeout(1800);
      await page.evaluate(() => { const z = document.querySelector("#mapbox button.zpill"); z && z.click(); }); await page.waitForTimeout(1200);
      await page.evaluate(() => { const a = document.querySelector(".pk-a"); a && a.click(); }); await page.waitForTimeout(1500);
      out.mapVis = await vis();
      await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(1200);
      out.mapBack = await st();
      await page.click('#sNav [data-nav="home"]'); await page.waitForTimeout(1500);
      out.home = await st();
      await page.click('#sNav [data-nav="news"]'); await page.waitForTimeout(1000);
      await page.evaluate(() => { location.hash = "m10"; }); await page.waitForTimeout(1800);
      await page.click("#tab-biz").catch(() => {}); await page.waitForTimeout(500);
      const lab = await page.evaluate(() => { const b = document.querySelector("#report .child[data-go] small"); return b ? [b.closest("[data-go]").dataset.go, b.textContent.split(" · ")[0]] : null; });
      if (lab) { await page.click(`#report .child[data-go="${lab[0]}"]`); await page.waitForTimeout(1500); }
      out.chip = await page.evaluate(() => (document.querySelector("#report .stg") || {}).textContent);
      out.lab = lab && lab[1];
      await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(1200);
      out.moaBack = await st();
      const okAll = out.favVis === true && out.favBack && out.favBack.fav && !out.favBack.sheet && out.mapVis === true && out.mapBack.full && !out.mapBack.sheet && out.mapBack.cur === "map" && !out.home.full && !out.home.gu && out.home.cur === "home" && lab && out.chip && out.chip.replace(/ · 확인 중$/, "") === out.lab && out.moaBack.sheet && /모아타운/.test(out.moaBack.title || "");
      expect(okAll, "tapp.sheets", T, JSON.stringify(out));
      // --- tapp.moa(5·22): 모아타운 시트 = 관리지역 평균은 참고값만(큰 숫자 '사업구역별' · '가능' 판정 없음) · 검색 줄도 '사업구역별'
      await page.evaluate(() => { location.hash = "m10"; }); await page.waitForTimeout(1500);
      const m = await page.evaluate(() => ({ moa: !!document.querySelector("#report .dt-moa"), big: document.querySelectorAll("#report .dt-k .dt-v").length, rows: document.querySelectorAll("#report .dt-moa .dt-kid").length, vd: !!document.querySelector("#report .dt-vd.ok"), ip: !!document.querySelector("#report .dt-top .dt-ip"), ref: (document.querySelector("#report .dt-ref") || {}).textContent }));
      expect(m.moa && !m.big && m.rows > 0 && !m.vd && !m.ip && /참고/.test(m.ref || ""), "tapp.moa", "설치 앱 모아타운 관리지역: 큰 숫자 없이 안내 한 줄 + 사업구역 목록 + 참고값 한 줄 · '가능해요'·입주권 판정 없음 — 곳 수(모아타운 제외)·검색('사업구역별')과 한 규칙", JSON.stringify(m));
    } catch (e) { bad("runtime", "검사 실행", "tapp.sheets crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.appbar(9·10·11·17): 아이콘 화면 = 56px 앱바(← 44×44 · 제목 17px · 남색 막대 없음 · 테두리 카드 없음) · 웹 바닥글 숨김 · MY 정부 무관 고지 · MY 제목 28px · 알림 경로 '(또는 앱)'
  if (SEC(17, "tapp.appbar")) {
    const T = "설치 앱 아이콘 화면: 로고 머리 숨김 · 맨 위 56px 앱바(top 0 · 스크롤해도 · ← 44×44 · 제목 17px) · 남색 막대·테두리 카드 없음 · '모으면 언제' 따로 주소(#saveTop)·그 칸 맨 위 · 화면·MY 이름 '입주권 나오나' · 웹 바닥글 없음 · MY 정부 무관 고지 · 제목 28px";
    const { ctx, page } = await appPage(mob(390, 844));
    try {
      await appHome(page);
      const foot = await page.evaluate(() => { const f = document.querySelector(".site-foot"); return !!(f && f.getClientRects().length); });
      const res = [];
      for (const k of ["commute", "stats", "rank", "diag", "rules", "calc", "save"]) {
        await page.click(`#tHome .th-grid a[data-tile="${k}"]`); await page.waitForTimeout(900);
        await page.evaluate(() => window.scrollTo(0, 600)); await page.waitForTimeout(150);
        res.push(await page.evaluate((k) => { const bar = document.getElementById("tBar"), bk = bar && bar.querySelector(".t-bk"), t = document.getElementById("tBarT"), hd = document.getElementById("hdr"); if (!bar || !bk) return k + ":없음"; const br = bar.getBoundingClientRect(), kr = bk.getBoundingClientRect(), s = (document.querySelector(".s-on > .s-back") || {}).parentElement, h = s && s.querySelector(":scope > .sec-h h2, :scope > .pl-in > .pl-t"), pb = h ? getComputedStyle(h, "::before") : null, pn = s && s.querySelector(".panel"); return [k, Math.round(br.top) === 0 && Math.round(br.height) === 56 && Math.round(kr.width) === 44 && Math.round(kr.height) === 44 && getComputedStyle(t).fontSize === "17px" && !!t.textContent.trim(), getComputedStyle(hd).display === "none", !pb || pb.display === "none" || pb.content === "none", !pn || getComputedStyle(pn).borderTopWidth === "0px"].join("/") + ":" + t.textContent; }, k));
        await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(600);
      }
      await page.click('#sNav [data-nav="my"]'); await page.waitForTimeout(1000);
      const my = await page.evaluate(() => ({ gov: ((document.getElementById("tGov") || {}).textContent || "").includes("정부"), h: getComputedStyle(document.querySelector("#my > .sec-h h2")).fontSize }));
      // 모으면 언제: 따로 주소(#saveTop) · 그 칸 맨 위에서 시작
      await page.click('#sNav [data-nav="home"]'); await page.waitForTimeout(900);
      await page.click('#tHome .th-grid a[data-tile="save"]'); await page.waitForTimeout(1200);
      const sv = await page.evaluate(() => ({ h: location.hash, top: Math.round(document.getElementById("saveTop").getBoundingClientRect().top), t: (document.getElementById("tBarT") || {}).textContent }));
      await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(600);
      const dg = await page.evaluate(() => ((document.querySelector('#my a[data-menu="diagTop"] b') || {}).textContent || ""));
      expect(!foot && res.every((x) => /true\/true\/true\/true:/.test(x)) && res.some((x) => /:입주권 나오나$/.test(x)) && res.some((x) => /:모으면 언제$/.test(x)) && sv.h === "#saveTop" && sv.top >= 56 && sv.top <= 90 && sv.t === "모으면 언제" && dg === "입주권 나오나" && my.gov && my.h === "28px", "tapp.appbar", T, JSON.stringify({ foot, res, sv, dg, my }));
    } catch (e) { bad("runtime", "검사 실행", "tapp.appbar crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.onbPolish(16): 안내 제목 초점 테두리 없음 · 진행 점 남색 · 2장 목록 페이드 · 끝나면 토스트 닫힘
  if (SEC(18, "tapp.onbPolish")) {
    const T = "설치 앱 처음 안내: 제목 프로그램 초점 테두리 없음 · 진행 점 남색 · 2장 목록 아래 페이드 · 안내에서 담은 '관심 구역에 추가' 토스트는 안내가 끝나면 닫힘";
    const { ctx, page } = await appPage(mob(390, 844), true);
    try {
      await appHome(page); await page.waitForTimeout(300);
      const a = await page.evaluate(() => { const h = document.getElementById("tobT"), d = document.querySelector(".tob-dots i.on"); return { ol: h && getComputedStyle(h).outlineStyle, dot: d && getComputedStyle(d).backgroundColor }; });
      await page.click("#tOnb [data-onext]"); await page.waitForTimeout(300);
      const m = await page.evaluate(() => { const l = document.querySelector(".tob-zl"); return l ? getComputedStyle(l).maskImage || getComputedStyle(l).webkitMaskImage : "none"; });
      const fb = await page.$("#tOnb [data-fav]"); if (fb) { await fb.click(); await page.waitForTimeout(300); }
      await page.click("#tOnb [data-onext]"); await page.waitForTimeout(200);
      await page.click("#tOnb [data-odone], #tOnb [data-oskip]"); await page.waitForTimeout(500);
      const t = await page.evaluate(() => { const x = document.getElementById("pnToast"); return !!(x && x.classList.contains("on")); });
      expect(a.ol === "none" && a.dot === "rgb(31, 58, 135)" && /gradient/.test(m || "") && !t, "tapp.onbPolish", T, JSON.stringify({ a, m, toast: t }));
    } catch (e) { bad("runtime", "검사 실행", "tapp.onbPolish crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // ================= 2라운드 레드팀 수정이 되돌아가지 않게 =================
  if (SEC(19, "tapp.r2misc")) for (const W of [360, 390]) {
    const { ctx, page } = await appPage(mob(W, 800));
    try {
      await appHome(page);
      // tapp.tileLabel(7): 타일 이름 한 줄(넘침 없음) · 이름 사이 간격 ≥ 8px · 두 줄 행 높이 같음
      const tl = await page.evaluate(() => { const L = [...document.querySelectorAll("#tHome .th-l")], T = [...document.querySelectorAll("#tHome .th-t")]; const r = L.map((e) => e.getBoundingClientRect()); const gaps = []; for (let i = 0; i < r.length; i++) if (i % 5 !== 4) gaps.push(Math.round(r[i + 1].left - r[i].right)); return { over: L.filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().height > 36).map((e) => e.textContent), gap: Math.min(...gaps), h: [...new Set(T.map((t) => Math.round(t.getBoundingClientRect().height)))] }; });
      expect(!tl.over.length && tl.gap >= 8 && tl.h.length === 1, "tapp.tileLabel", "설치 앱 타일 이름 두 줄까지(넘침 없음 · 4라운드 큰 글씨) · 이름 사이 8px 이상 · 두 줄 행 높이 같음(360·390)", `${W}: ${JSON.stringify(tl)}`);
      if (W !== 390) continue;
      // tapp.mapCtl(2·3·4): 지도 ⓘ 그림 한 번(반복 없음)·40×40·확대 버튼과 8px · 레이어 칩 ::before 없음·36px·6개 이름표·마지막 칩까지 스크롤 · 범례 ↔ 목록 보기 ↔ +N곳 겹치지 않음
      await page.click('#sNav [data-nav="map"]'); await page.waitForTimeout(1500);
      const mc = await page.evaluate(() => {
        const R = (e) => e && e.getBoundingClientRect(), ab = document.querySelector("#mapbox .maplibregl-ctrl-attrib-button"), as = ab && getComputedStyle(ab), zm = document.querySelector("#mapbox .lm-zoom"), ar = R(ab), zr = R(zm);
        const ch = [...document.querySelectorAll("#mapbox .s-rail > button")], w = document.querySelector("#mapbox .s-rail-w");
        const key = R(document.querySelector("#mapbox .lm-key")), fx = R(document.getElementById("sFullX")), gm = R(document.querySelector("#mapbox .lm-gumore-b"));
        const ov = (a, b) => a && b && a.width && b.width && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        w.scrollLeft = 9999; const last = R(ch[ch.length - 1]); w.scrollLeft = 0;
        return { rep: as && as.backgroundRepeat, aw: ar && [Math.round(ar.width), Math.round(ar.height)], zgap: zr && zr.height && ar ? Math.round(ar.top - zr.bottom) : 99, before: ch.filter((b) => { const c = getComputedStyle(b, "::before").content; return c && c !== "none" && c !== "normal"; }).length, hs: [...new Set(ch.map((b) => Math.round(R(b).height)))], labels: ch.map((b) => b.textContent.trim()).filter(Boolean).length, lastIn: last.right <= innerWidth, keyFx: ov(key, fx), gmKey: ov(gm, key) };
      });
      expect(mc.rep === "no-repeat" && mc.aw && mc.aw[0] === 44 && mc.aw[1] === 44 && mc.zgap >= 8 && mc.before === 0 && mc.hs.length === 1 && mc.hs[0] === 36 && mc.labels === 6 && mc.lastIn && !mc.keyFx && !mc.gmKey, "tapp.mapCtl", "설치 앱 지도 탭: ⓘ 한 번(no-repeat)·44×44(4라운드)·확대 버튼과 8px 이상 · 레이어 칩 겹선(::before) 없음·36px·이름표 6개·마지막 칩까지 스크롤 · 범례·목록 보기·+N곳 안 겹침", JSON.stringify(mc));
      // tapp.mapList(13): 지도 탭 '목록 보기' = 아래 탭 '지도' 그대로 · 목록에서 연 구역을 닫으면 목록(지도 탭)
      await page.click("#sFullX"); await page.waitForTimeout(900);
      const l1 = await page.evaluate(() => ({ cur: (document.querySelector('#sNav [aria-current="page"]') || {}).dataset?.nav, full: document.documentElement.classList.contains("s-full") }));
      const row = await page.$("#sList a[data-id], #sList [data-id]");
      if (row) { await row.click(); await page.waitForTimeout(1300); await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(900); }
      const l2 = await page.evaluate(() => ({ cur: (document.querySelector('#sNav [aria-current="page"]') || {}).dataset?.nav, sheet: document.getElementById("report").classList.contains("sheet"), list: !!document.getElementById("sList").offsetParent }));
      expect(l1.cur === "map" && !l1.full && l2.cur === "map" && !l2.sheet && l2.list, "tapp.mapList", "설치 앱 지도 탭 '목록 보기': 아래 탭 '지도' 그대로 · 목록에서 연 구역을 닫으면 목록", JSON.stringify({ l1, l2 }));
      // tapp.feedR2(9·8): 신고가만 노란 태그 그림 · 그냥 실거래는 회색 태그 · 날짜 머리 '신고·등록분' · 실거래 줄 '등록 · 계약' · 겹친 구역 같은 거래 한 줄('외 N곳') · 선택 칩 = 남색
      await page.click('#sNav [data-nav="news"]'); await page.waitForTimeout(1300);
      const fd = await page.evaluate(() => {
        const rows = [...document.querySelectorAll("#tFeed .tf-it")];
        const ic = (r) => (r.querySelector(".tf-ic svg [id]") || {}).id || "";
        const tr = rows.filter((r) => /실거래/.test((r.querySelector(".tf-tg") || {}).textContent || "")), hi = rows.filter((r) => /신고가/.test((r.querySelector(".tf-tg") || {}).textContent || ""));
        const sel = document.querySelector("#tFeed [data-ft][aria-pressed=true]");
        const keys = rows.map((r) => (r.querySelector(".tf-tx small") || {}).textContent + "|" + (r.querySelector(".tf-g") || {}).textContent + "|" + r.closest("ul").previousElementSibling.textContent);
        return { trPlain: tr.slice(0, 5).every((r) => /deal_plain/.test(ic(r))), hiYel: hi.slice(0, 5).every((r) => /deal_price/.test(ic(r))), nTr: tr.length, nHi: hi.length, dh: (document.querySelector("#tFeed .tf-dh") || {}).textContent, reg: tr.slice(0, 5).every((r) => /등록 · \d+월 \d+일 계약/.test(r.textContent)), dup: keys.length - new Set(keys).size, sel: sel && getComputedStyle(sel).backgroundColor };
      });
      expect(fd.nTr > 0 && fd.trPlain && (!fd.nHi || fd.hiYel) && / 등록$/.test(fd.dh || "") && fd.reg && fd.dup === 0 && fd.sel === "rgb(31, 58, 135)", "tapp.feedR2", "설치 앱 소식: 실거래 = 회색 태그(↑ 없음) · 신고가만 노란 태그 ↑ · 날짜 머리 'M.D (요일) 신고·등록분' · 실거래 줄 'M.D 등록 · M월 D일 계약' · 같은 거래 겹친 구역 한 줄 · 선택 칩 남색", JSON.stringify(fd));
      // tapp.myDeny(1): 알림이 막혀 있으면 종류 스위치 aria-disabled + 꺼짐 모양(회색 트랙) · 흐리게(opacity) 안 함 · 안내 한 줄 · axe 대비 위반 없음
      await page.click('#sNav [data-nav="my"]'); await page.waitForTimeout(900);
      await page.evaluate(() => { const ib = window.ZP_T0.inbox(), st = ib.st.bind(ib); ib.st = () => Object.assign({}, st(), { perm: "denied" }); window.dispatchEvent(new Event("zp:alerts")); });
      await page.waitForTimeout(500);
      const md = await page.evaluate(() => { const B = [...document.querySelectorAll("#myKinds [data-kind]")]; return { n: B.length, dis: B.every((b) => b.getAttribute("aria-disabled") === "true"), op: B.map((b) => getComputedStyle(b).opacity + getComputedStyle(b.closest("li")).opacity).filter((x) => x !== "11").length, tg: B.length ? getComputedStyle(B[0].querySelector(".my-tg")).backgroundColor : "", lab: B.length ? getComputedStyle(B[0].querySelector("b")).color : "", c: (document.getElementById("myKindsC") || {}).textContent }; });
      expect(md.n > 0 && md.dis && !md.op && md.tg === "rgb(209, 214, 219)" && md.lab === "rgb(139, 149, 161)" && /^폰 설정/.test(md.c || ""), "tapp.myDeny", "설치 앱 MY 알림이 막혔을 때: 종류 스위치 aria-disabled · 꺼짐 모양(회색 트랙 #D1D6DB) · 라벨 #8B95A1 · opacity 없음 · 안내 한 줄", JSON.stringify(md));
    } catch (e) { bad("runtime", "검사 실행", "tapp.r2 crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // tapp.onbToast(12): 처음 안내 2장에서 담아도 토스트가 안내를 가리지 않음
  if (SEC(20, "tapp.onbToast")) {
    const { ctx, page } = await appPage(mob(390, 844), true);
    try {
      await appHome(page); await page.waitForTimeout(300);
      await page.click("#tOnb [data-onext]"); await page.waitForTimeout(300);
      const fb = await page.$("#tOnb [data-fav]"); if (fb) { await fb.click(); await page.waitForTimeout(400); }
      const t = await page.evaluate(() => { const x = document.getElementById("pnToast"); return !!(x && x.getClientRects().length && getComputedStyle(x).display !== "none" && x.classList.contains("on")); });
      expect(!!fb && !t, "tapp.onbToast", "설치 앱 처음 안내 2장: 담기를 눌러도 '관심 구역에 추가했어요' 토스트가 뜨지 않음(단추 '담았어요'로 충분)", `fav ${!!fb} toast ${t}`);
    } catch (e) { bad("runtime", "검사 실행", "tapp.onbToast crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // ================= 3라운드: 고친 것마다 모든 진입 경로·같은 부품 모든 화면 =================
  const feedOk = (page) => page.evaluate(() => ({ chips: document.querySelectorAll("#tFeed [data-ft]").length, rows: document.querySelectorAll("#tFeed .tf-it").length, seg: (document.getElementById("news") || {}).dataset?.tseg }));
  // --- tapp.newsEntry(1): 소식 탭 빈 화면 없음 — 콜드 /#news ×10 · 정적 페이지(리포트)에서 아래 '소식' ×5 · 홈에서 탭 · 앱 안에서 주소만 #news(알림 클릭이 여는 길)
  if (SEC(21, "tapp.newsEntry")) {
    const T = "설치 앱 소식 탭: 콜드 /#news ×10 · 정적 페이지 → '소식' 탭 ×5 · 탭 누름 · 알림 클릭 주소(#news) 모두 칩 6개·목록 있음";
    const R = [];
    for (let i = 0; i < 10; i++) {
      const { ctx, page } = await appPage(mob(390, 844));
      try { page.__where = "tapp.newsEntry cold"; await page.goto(BASE + "/?src=app&n=" + i + "#news", { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForFunction(() => document.querySelectorAll("#tFeed .tf-it").length > 0, null, { timeout: 8000 }).catch(() => {}); const f = await feedOk(page); if (!(f.chips === 6 && f.rows > 0)) R.push("cold" + i + JSON.stringify(f)); } catch (e) { R.push("cold" + i + " crash"); } finally { await ctx.close().catch(() => {}); }
    }
    for (let i = 0; i < 5; i++) {
      const { ctx, page } = await appPage(mob(390, 844));
      try {
        page.__where = "tapp.newsEntry static";
        await page.goto(BASE + "/report/2026-10.html", { waitUntil: "load", timeout: 60000 }); await page.waitForTimeout(300);
        await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => {}), page.click('.zp-tabs a[href="/#news"]')]);
        await page.waitForFunction(() => document.querySelectorAll("#tFeed .tf-it").length > 0, null, { timeout: 8000 }).catch(() => {});
        const f = await feedOk(page); if (!(f.chips === 6 && f.rows > 0)) R.push("static" + i + JSON.stringify(f));
      } catch (e) { R.push("static" + i + " crash " + String(e.message).split("\n")[0]); } finally { await ctx.close().catch(() => {}); }
    }
    {
      const { ctx, page } = await appPage(mob(390, 844));
      try {
        await appHome(page);
        await page.evaluate(() => { location.hash = "news"; }); await page.waitForTimeout(1200);
        let f = await feedOk(page); if (!(f.chips === 6 && f.rows > 0)) R.push("hash" + JSON.stringify(f));
        await page.click('#sNav [data-nav="home"]'); await page.waitForTimeout(800); await page.click('#sNav [data-nav="news"]'); await page.waitForTimeout(1000);
        f = await feedOk(page); if (!(f.chips === 6 && f.rows > 0)) R.push("tab" + JSON.stringify(f));
      } catch (e) { R.push("hash crash"); } finally { await ctx.close().catch(() => {}); }
    }
    expect(!R.length, "tapp.newsEntry", T, R.join(" ; "));
  }
  // --- tapp.onbPush(2): 푸시 키가 200이면 처음 안내 3/3에 '알림 켜기'(MY를 열지 않아도)
  if (SEC(22, "tapp.onbPush")) {
    const T = "설치 앱 처음 안내 3/3: /api/push/key 200(정상 키)이면 '알림 켜기' 단추가 보임(안내를 열 때 키를 미리 받음)";
    const { ctx, page } = await appPage(mob(390, 844), true);
    try {
      await ctx.grantPermissions(["notifications"]).catch(() => {});
      const KEY = "B" + "x".repeat(86);
      let keyReq = 0;
      await ctx.route(/\/api\/push\/key/, (r) => { keyReq++; return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: KEY }) }); });
      await appHome(page); await page.waitForTimeout(300);
      await page.click("#tOnb [data-onext]"); await page.waitForTimeout(200);
      await page.click("#tOnb [data-onext]"); await page.waitForTimeout(600);
      const o = await page.evaluate(() => ({ cta: !!document.querySelector("#tOnb [data-oalert]"), txt: (document.querySelector("#tOnb .tob-body") || {}).textContent }));
      expect(o.cta && keyReq >= 1, "tapp.onbPush", T, `key ${keyReq} ${JSON.stringify(o).slice(0, 200)}`);
    } catch (e) { bad("runtime", "검사 실행", "tapp.onbPush crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.toolEntry(4·14): 도구 7개 — 타일로 열기 · 콜드 해시(/?src=app#…)로 열기 모두 앱바(제목)·로고 머리 없음·같은 제목 화면에서 숨김(읽어 주기 유지)·앱바 아래 첫 줄 16px 안팎 · 콜드 #saveTop ×6 = 모으면 언제
  if (SEC(23, "tapp.toolEntry")) {
    const T = "설치 앱 도구 화면(순위·출퇴근·입주권 나오나·매수 전 규정·통계·입주 계산·모으면 언제): 타일·콜드 해시 모두 앱바 제목 · 아래 중복 제목은 화면에서 숨김(sr) · 콜드 #saveTop 6번 모두 '모으면 언제'";
    const TOOLS = [["rank", "#rankHub", "순위"], ["commute", "#commuteTop", "출퇴근"], ["diag", "#diagTop", "입주권 나오나"], ["rules", "#rulesTop", "매수 전 규정"], ["stats", "#statsTop", "통계"], ["calc", "#planner", "입주 계산"], ["save", "#saveTop", "모으면 언제"]];
    const chk = (page, want) => page.evaluate((want) => { const H = document.documentElement, t = (document.getElementById("tBarT") || {}).textContent, hd = getComputedStyle(document.getElementById("hdr")).display; const sec = document.querySelector(H.classList.contains("t-save") ? "#saveTop" : ".s-on"); const h = sec && sec.querySelector(".sec-h h2, .pl-in > .pl-t"); const hw = h ? h.getBoundingClientRect().width : 0; return { ok: H.classList.contains("t-tool") && t === want && hd === "none" && (!h || hw <= 1), t, hw: Math.round(hw) }; }, want);
    const R = [];
    {
      const { ctx, page } = await appPage(mob(390, 844));
      try {
        await appHome(page);
        for (const [k, , want] of TOOLS) { await page.click('#sNav [data-nav="home"]').catch(() => {}); await page.waitForTimeout(500); await page.click(`#tHome .th-grid a[data-tile="${k}"]`); await page.waitForTimeout(1000); const o = await chk(page, want); if (!o.ok) R.push("tap " + k + JSON.stringify(o)); }
      } catch (e) { R.push("tap crash " + String(e.message).split("\n")[0]); } finally { await ctx.close().catch(() => {}); }
    }
    for (const [k, h, want] of TOOLS) {
      const { ctx, page } = await appPage(mob(390, 844));
      try { page.__where = "tapp.toolEntry cold " + h; await page.goto(BASE + "/?src=app" + h, { waitUntil: "load", timeout: 60000 }); await page.waitForFunction(() => document.documentElement.classList.contains("tapp-on"), null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1200); const o = await chk(page, want); if (!o.ok) R.push("cold " + h + JSON.stringify(o)); } catch (e) { R.push("cold crash " + h); } finally { await ctx.close().catch(() => {}); }
    }
    for (let i = 0; i < 5; i++) {
      const { ctx, page } = await appPage(mob(390, 844));
      try { await page.goto(BASE + "/?src=app&s=" + i + "#saveTop", { waitUntil: "load", timeout: 60000 }); await page.waitForFunction(() => document.documentElement.classList.contains("tapp-on"), null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1000); const o = await page.evaluate(() => ({ h: location.hash, save: document.documentElement.classList.contains("t-save"), t: (document.getElementById("tBarT") || {}).textContent })); if (!(o.h === "#saveTop" && o.save && o.t === "모으면 언제")) R.push("save" + i + JSON.stringify(o)); } catch (e) { R.push("save crash"); } finally { await ctx.close().catch(() => {}); }
    }
    expect(!R.length, "tapp.toolEntry", T, R.join(" ; "));
  }
  // --- tapp.segAll(5): 단일 선택 모양 하나 — 홈 카드·지도 카드·MY·순위·입주 계산·모으면 언제·출퇴근·소식(전체/관심 · 그 밖 소식) 선택 = 흰 바탕 · 진한 글자 · 트랙 연회색(라이트)
  if (SEC(24, "tapp.segAll")) for (const cs of ["light", "dark"]) {
    const { ctx, page } = await appPage(mob(390, 844, cs));
    try {
      await appHome(page);
      const SEL = ".s-mode, .my-seg, .hub-tabs, .seg, .tf-seg";
      const scan = (tag) => page.evaluate(([tag, SEL]) => [...document.querySelectorAll(SEL)].filter((g) => g.getClientRects().length && g.getBoundingClientRect().width > 0).map((g) => { const s = g.querySelector('[aria-pressed="true"], [aria-checked="true"], [aria-selected="true"]'); if (!s) return null; const c = getComputedStyle(s); return [tag + ":" + (g.id || g.className.split(" ")[0]), getComputedStyle(g).backgroundColor, c.backgroundColor, c.color]; }).filter(Boolean), [tag, SEL]);
      const L = [...await scan("home")];
      await page.click('#sNav [data-nav="map"]'); await page.waitForTimeout(1200); L.push(...await scan("map"));
      await page.click('#sNav [data-nav="my"]'); await page.waitForTimeout(900); L.push(...await scan("my"));
      await page.click('#sNav [data-nav="news"]'); await page.waitForTimeout(900); L.push(...await scan("news")); await page.click("#tSegM"); await page.waitForTimeout(500); L.push(...await scan("news-mine"));
      for (const k of ["rank", "calc", "save", "commute"]) { await page.click('#sNav [data-nav="home"]'); await page.waitForTimeout(500); await page.click(`#tHome .th-grid a[data-tile="${k}"]`); await page.waitForTimeout(1000); L.push(...await scan(k)); }
      const want = cs === "light" ? ["rgb(242, 244, 246)", "rgb(255, 255, 255)", "rgb(25, 31, 40)"] : ["rgb(27, 30, 36)", "rgb(58, 64, 75)", "rgb(229, 232, 235)"];
      const badL = L.filter((x) => x[1] !== want[0] || x[2] !== want[1] || x[3] !== want[2]);
      const tags = new Set(L.map((x) => x[0].split(":")[0]));
      expect(!badL.length && ["home", "map", "my", "news", "news-mine", "rank", "calc", "save", "commute"].every((t) => tags.has(t)), "tapp.segAll", "설치 앱 단일 선택(2~4지) 모양 하나: 회색 트랙 + 흰 thumb + 진한 글자(다크 #1B1E24·#3A404B(4라운드)·#E5E8EB) — 홈·지도·MY·소식(두 곳)·순위·입주 계산·모으면 언제·출퇴근", `${cs}: ${JSON.stringify(badL.slice(0, 5))} tags ${[...tags].join(",")}`);
    } catch (e) { bad("runtime", "검사 실행", "tapp.segAll crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.r3misc: 가치 한 줄(숫자 없음) · '왜 이 금액?' 시트 뒤로 = 닫힘(앱 안 그대로) · 지도 목록 → 뒤로 = 지도 · 날짜 머리 종류별 · '외 N곳' 함께 이름 · 모아타운 행(› · 입주 완료) · MY 막힘 한 줄(중복 없음) · 모으면 언제 문구·바꾸기
  if (SEC(25, "tapp.r3misc")) {
    const { ctx, page } = await appPage(mob(390, 844));
    try {
      await appHome(page);
      const o = {};
      o.val = await page.evaluate(() => (document.getElementById("tVal") || {}).textContent);
      const wb = await page.$("#sList [data-why]");
      if (wb) { await wb.click(); await page.waitForTimeout(500); o.whyOpen = await page.evaluate(() => !!document.querySelector(".s-why:not([hidden])")); await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(700); o.whyBack = await page.evaluate(() => ({ closed: !document.querySelector(".s-why:not([hidden])"), home: location.pathname === "/" && document.documentElement.classList.contains("tapp-on") })); }
      await page.click('#sNav [data-nav="map"]'); await page.waitForTimeout(1200);
      await page.click("#sFullX"); await page.waitForTimeout(900);
      await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(900);
      o.listBack = await page.evaluate(() => ({ full: document.documentElement.classList.contains("s-full"), cur: (document.querySelector('#sNav [aria-current="page"]') || {}).dataset?.nav }));
      await page.click('#sNav [data-nav="news"]'); await page.waitForTimeout(1000);
      o.dh = {};
      for (const t of ["", "trade", "auction", "notice"]) { await page.click(`#tFeed [data-ft="${t}"]`); await page.waitForTimeout(250); o.dh[t || "all"] = await page.evaluate(() => (document.querySelector("#tFeed .tf-dh") || {}).textContent); }
      await page.click('#tFeed [data-ft=""]'); await page.waitForTimeout(250);
      o.oth = await page.evaluate(() => { const r = [...document.querySelectorAll("#tFeed .tf-it")].find((x) => x.querySelector(".tf-more2")); return r ? !!(r.querySelector(".tf-oth") && /함께: \S/.test(r.querySelector(".tf-oth").textContent)) : "none"; });
      await page.evaluate(() => { location.hash = "m10"; }); await page.waitForTimeout(1500);
      o.moa = await page.evaluate(() => { const k = [...document.querySelectorAll("#report .dt-kid")]; return { n: k.length, chev: k.every((x) => !!x.querySelector(".dt-kc")), done: k.some((x) => /입주 완료/.test(x.textContent)), chip: k.length ? getComputedStyle(k[0].querySelector(".dt-kst")).backgroundColor : "" }; });
      await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(700);
      await page.click('#sNav [data-nav="my"]'); await page.waitForTimeout(900);
      await page.evaluate(() => { const ib = window.ZP_T0.inbox(), st = ib.st.bind(ib); ib.st = () => Object.assign({}, st(), { perm: "denied" }); window.dispatchEvent(new Event("zp:alerts")); }); await page.waitForTimeout(500);
      o.my = await page.evaluate(() => { const t = (document.getElementById("my").innerText || ""); return (t.match(/막혀 있어요/g) || []).length; });
      await page.click('#sNav [data-nav="home"]'); await page.waitForTimeout(600); await page.click('#tHome .th-grid a[data-tile="save"]'); await page.waitForTimeout(1000);
      o.save = await page.evaluate(() => ({ sub: (document.querySelector("#saveTop .pl-save-sub") || {}).textContent, row: !!document.querySelector("#tSvCash .t-svch") }));
      await page.click("#tSvCash .t-svch"); await page.waitForTimeout(700);
      o.sheet = await page.evaluate(() => { const b = document.getElementById("bSheet"); return !!b && !b.hidden && b.getBoundingClientRect().height > 100; });
      const ok = /^내 돈으로 갈 수 있는 서울 재개발$/.test(o.val || "") && (o.whyOpen === undefined || (o.whyOpen && o.whyBack.closed && o.whyBack.home)) && o.listBack.full && o.listBack.cur === "map" && /등록$/.test(o.dh.all || "") && /신고·등록분$/.test(o.dh.trade || "") && /공고분$/.test(o.dh.auction || "") && /고시일$/.test(o.dh.notice || "") && o.oth !== false && o.moa.n > 0 && o.moa.chev && o.moa.done && o.moa.chip === "rgb(242, 244, 246)" && o.my <= 1 && /^지금 현금 \S+에 매달/.test(o.save.sub || "") && o.save.row && o.sheet;
      expect(ok, "tapp.r3misc", "설치 앱: 가치 한 줄 숫자 없음 · '왜 이 금액?' 시트 뒤로 = 닫힘(앱 그대로) · 지도 목록 → 뒤로 = 지도 · 소식 날짜 머리 종류별(등록·신고·등록분·공고분·고시일) · '외 N곳' 함께 이름 · 모아타운 행 ›·입주 완료·회색 단계 칩 · MY '막혀 있어요' 한 번 · 모으면 언제 '지금 현금 N에…'·바꾸기 → 금액 시트", JSON.stringify(o));
    } catch (e) { bad("runtime", "검사 실행", "tapp.r3misc crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- web.why(6): 브라우저(390)도 '왜 이 금액?' 바텀시트는 뒤로 = 닫힘(페이지를 떠나지 않음)
  if (SEC(26, "web.why")) {
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      await ctx.addInitScript(() => { try { localStorage.setItem("zp.onb", "1"); } catch (e) {} });
      page.__where = "web.why"; await loadHome(page); await settle(page, 400);
      const wb = await page.$("#sList [data-why]");
      let o = { found: !!wb };
      if (wb) { await wb.click(); await page.waitForTimeout(500); o.open = await page.evaluate(() => !!document.querySelector(".s-why:not([hidden])")); await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(700); o.closed = await page.evaluate(() => !document.querySelector(".s-why:not([hidden])") && location.pathname === "/"); }
      expect(o.found && o.open && o.closed, "web.why", "브라우저(390): '왜 이 금액?' 바텀시트를 연 채 뒤로 = 시트만 닫힘(페이지 그대로)", JSON.stringify(o));
    } catch (e) { bad("runtime", "검사 실행", "web.why crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- web.wideScroll(R3-2): 넓은 화면(1024·1280·1440) — 관심 아래쪽 줄 → 두 칸 리포트 제목이 화면 안 · 칩 '← 관심 구역' · 뒤로 = 관심(보던 자리 ±40px)
  if (SEC(27, "web.wideScroll")) for (const W of [1024, 1280, 1440]) {
    const { ctx, page } = await newPage(browser, { viewport: { width: W, height: 860 } }, errs);
    try {
      await ctx.addInitScript(() => { try { localStorage.setItem("jg-fav", JSON.stringify(["o497", "o111", "o144", "o392", "o960", "o337", "o890", "o913", "s21", "s69", "o28", "o58", "o10", "o24"])); localStorage.setItem("zp.onb", "1"); } catch (e) {} });
      page.__where = "web.wideScroll " + W; await loadHome(page); await settle(page, 400);
      await page.click('#sNav [data-nav="fav"]'); await page.waitForTimeout(1200);
      const rows = await page.$$("#favTop [data-open]"); const last = rows[rows.length - 1];
      await last.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      const y0 = await page.evaluate(() => scrollY);
      await last.click(); await page.waitForTimeout(1500);
      const o = await page.evaluate(() => { const t = document.getElementById("repTitle").getBoundingClientRect(); return { t: Math.round(t.top), b: Math.round(t.bottom), ih: innerHeight, chip: (document.getElementById("sToList") || {}).textContent }; });
      await page.goBack({ waitUntil: "commit" }).catch(() => {}); await page.waitForTimeout(1200);
      const bk = await page.evaluate(() => ({ fav: !!document.querySelector("#favTop.s-on"), y: Math.round(scrollY) }));
      expect(rows.length > 8 && o.t >= 0 && o.b <= o.ih && o.chip === "← 관심 구역" && bk.fav && Math.abs(bk.y - y0) <= 40, "web.wideScroll", "브라우저 넓은 화면(1024·1280·1440): 관심 아래쪽 줄 → 두 칸 리포트 제목이 화면 안 · 왼쪽 위 칩 '← 관심 구역' · 뒤로 = 관심 탭 보던 자리", `${W}: y0 ${y0} ${JSON.stringify(o)} back ${JSON.stringify(bk)}`);
    } catch (e) { bad("runtime", "검사 실행", "web.wideScroll crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- tapp.axeAll(3): 앱 모드 모든 화면 axe serious·critical 0 — 라이트·다크 × 홈·지도·관심·소식(전체·관심 구역)·MY·도구 7개·구역 시트·모아타운 시트
  if (SEC(28, "tapp.axeAll")) {
    let AXE = null; try { const ap = process.env.AXE_PATH || require.resolve("axe-core/axe.min.js"); AXE = fs.readFileSync(ap, "utf8"); } catch (e) {}
    const T = "설치 앱 axe serious·critical 0 — 라이트·다크 × 홈·지도·관심·소식(전체·관심 구역)·MY·도구 7개·구역 시트·모아타운 시트";
    if (!AXE) skip("tapp.axeAll", T, "axe-core 없음");
    else for (const cs of ["light", "dark"]) {
      const { ctx, page } = await appPage(mob(390, 844, cs));
      try {
        await appHome(page);
        const AX = async (k) => { await page.addScriptTag({ content: AXE }).catch(() => {}); return (await page.evaluate(async () => { /* 색이 바뀌는 중(0.18초 전환)에 재면 중간 색으로 대비를 잼 — 돌고 있는 CSS 전환이 끝난 뒤(최대 1.5초) */ await new Promise((res) => { const t0 = performance.now(); (function f() { const a = (document.getAnimations ? document.getAnimations() : []).filter((x) => x.playState === "running" && x.constructor && x.constructor.name === "CSSTransition"); if (!a.length || performance.now() - t0 > 1500) return res(); setTimeout(f, 50); })(); }); const r = await window.axe.run(document, { resultTypes: ["violations"] }); return r.violations.filter((x) => x.impact === "serious" || x.impact === "critical").flatMap((x) => x.nodes.slice(0, 2).map((n) => x.id + " " + n.target.join(" "))); })).map((x) => k + " " + x); };
        const v = [...await AX("home")];
        for (const k of ["map", "fav", "news", "my"]) { await page.click(`#sNav [data-nav="${k}"]`); await page.waitForTimeout(1100); v.push(...await AX(k)); if (k === "news") { await page.click("#tSegM"); await page.waitForTimeout(500); v.push(...await AX("news-mine")); } }
        for (const k of ["rank", "commute", "diag", "rules", "stats", "calc", "save"]) { await page.click('#sNav [data-nav="home"]'); await page.waitForTimeout(500); await page.click(`#tHome .th-grid a[data-tile="${k}"]`); await page.waitForTimeout(1100); v.push(...await AX(k)); }
        await page.click('#sNav [data-nav="home"]'); await page.waitForTimeout(500);
        await page.evaluate(() => { location.hash = "o497"; }); await page.waitForTimeout(1500); v.push(...await AX("sheet"));
        await page.evaluate(() => { location.hash = "m10"; }); await page.waitForTimeout(1500); v.push(...await AX("moa"));
        expect(!v.length, "tapp.axeAll", T, `${cs}: ${v.length}: ${v.slice(0, 6).join(" ; ")}`);
      } catch (e) { bad("runtime", "검사 실행", "tapp.axeAll crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- tapp.entry(4라운드 진입 경로 매트릭스): 콜드 해시(소식·inbox·지도·관심·MY·도구 7개·#oID) · 숏컷(/?src=app#map·#favTop) · 정적 페이지 → 탭 · 앱 안 알림(zp-open) × 390·1280
  //   (a) 그 화면이 뜬다 (b) scrollY 0(1.5초·3.5초 · 넓은 화면 두 칸 리포트는 제목도 화면 안) (c) 뒤로 1번 = 홈(앱 안 알림은 누르기 전 탭) · 홈에서 뒤로 = 앱 닫힘
  if (SEC(29, "tapp.entry")) {
    const T = "설치 앱 진입 경로 매트릭스(콜드 해시·숏컷·정적 페이지 → 탭·앱 안 알림 × 390·1280): 화면이 뜨고 맨 위(scrollY 0)에서 열리며, 뒤로 1번 = 홈(알림은 원래 탭) · 홈에서 뒤로 = 앱 닫힘";
    const SCR = { news: "#news", inbox: "#news", favTop: "#favTop", my: "#my", rankHub: "#rankHub", commuteTop: "#commuteTop", diagTop: "#diagTop", rulesTop: "#rulesTop", statsTop: "#statsTop", planner: "#planner", saveTop: "#saveTop" };
    const ENT = ["#news", "#inbox", "#map", "#favTop", "#my", "#rankHub", "#planner", "#saveTop", "#commuteTop", "#diagTop", "#rulesTop", "#statsTop", "#o890", "src#map", "src#favTop", "static", "zpopen"];
    const st = (page) => page.evaluate(() => { const H = document.documentElement, c = (k) => H.classList.contains(k), on = document.querySelector("main .s-on, .sec.s-on, #planner.s-on"), rt = document.getElementById("repTitle"); return { u: location.pathname + location.hash, h: location.hash, y: Math.round(scrollY), view: c("s-view"), full: c("s-full"), sheet: c("sheet-open"), rep: c("s-rep"), on: on ? on.id : "", save: c("t-save"), rt: rt && c("s-rep") ? Math.round(rt.getBoundingClientRect().top) : null, ih: innerHeight, tab: ((document.querySelector("#sNav [aria-current=page]") || {}).dataset || {}).nav || "" }; }).catch(() => null);
    const shows = (e, s, wide) => { if (!s) return false; const k = e.replace(/^src/, "").replace(/^#/, ""); if (k === "map") return s.full; if (/^o\d+$/.test(k)) return wide ? s.rep : s.sheet; if (k === "saveTop") return s.view && (wide || s.save); if (SCR[k]) return s.view && "#" + s.on === (k === "inbox" ? "#news" : k === "saveTop" ? "#planner" : SCR[k]); return true; };
    const topOk = (e, s, wide) => s.y === 0 && (/^#o\d+$/.test(e) && wide ? s.rt != null && s.rt >= 0 && s.rt < s.ih - 120 : true);   // 넓은 화면 두 칸 리포트: 맨 위 + 제목이 화면 안
    const isHome = (s) => !!s && !s.h && !s.view && !s.full && !s.sheet && !s.rep;
    const R = []; let n = 0;
    for (const [W, H] of [[390, 844], [1280, 800]]) {
      const wide = W > 980;
      for (const e of ENT) {
        const { ctx, page } = await appPage(wide ? { viewport: { width: W, height: H } } : mob(W, H));
        try {
          page.__where = "tapp.entry " + W + " " + e; n++;
          let s1, s2, s3, sb;
          if (e === "static") {
            await page.goto(BASE + "/about.html", { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(500);
            await page.evaluate(() => { location.href = "/#news"; });
            await page.waitForFunction(() => document.documentElement.classList.contains("tapp-on"), null, { timeout: 25000 }).catch(() => {}); await page.waitForTimeout(1500);
            s1 = await st(page); await page.waitForTimeout(2000); s2 = await st(page);
            await page.goBack({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1000);
            sb = page.url();
            const back1 = /about\.html/.test(sb) ? "static" : isHome(await st(page)) ? "home" : "bad:" + sb;
            if (!shows("#news", s1, wide) || s1.y !== 0 || s2.y !== 0 || back1.startsWith("bad")) R.push(`${W} static→소식 ${JSON.stringify({ s1, y2: s2 && s2.y, back1 })}`);
            continue;
          }
          if (e === "zpopen") {
            await appHome(page); await page.click('#sNav [data-nav="my"]').catch(() => {}); await page.waitForTimeout(1200);
            if (wide) await page.evaluate(() => { location.hash = "#my"; }).catch(() => {});
            await page.waitForTimeout(400);
            const ok = await page.evaluate(() => { if (!navigator.serviceWorker) return false; navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { t: "zp-open", url: location.origin + "/#inbox" } })); return true; });
            await page.waitForTimeout(1800); s1 = await st(page);
            await page.goBack({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1000); s3 = await st(page);
            if (ok && (!shows("#news", s1, wide) || s1.y !== 0 || !(s3 && s3.view && s3.on === "my"))) R.push(`${W} zp-open MY→inbox ${JSON.stringify({ s1, s3 })}`);
            continue;
          }
          const u = e.startsWith("src") ? "/?src=app" + e.slice(3) : "/" + e;
          await page.goto(BASE + u, { waitUntil: "load", timeout: 30000 });
          await page.waitForFunction(() => document.documentElement.classList.contains("tapp-on"), null, { timeout: 25000 }).catch(() => {});
          await page.waitForTimeout(1500); s1 = await st(page); await page.waitForTimeout(2000); s2 = await st(page);
          await page.goBack({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1200); s3 = await st(page);
          await page.goBack({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800); sb = page.url();
          const k = e.replace(/^src/, "");
          if (!shows(k, s1, wide) || !topOk(k, s1, wide) || !topOk(k, s2, wide) || !isHome(s3) || sb !== "about:blank") R.push(`${W} ${e} ${JSON.stringify({ s1, y2: s2 && s2.y, back: s3 && s3.u + (s3.view ? "{view}" : "") + (s3.full ? "{full}" : "") + (s3.sheet ? "{sheet}" : "") + (s3.rep ? "{rep}" : ""), exit: sb })}`);
        } catch (er) { R.push(`${W} ${e} crash ${String(er.message || er).split("\n")[0]}`); }
        finally { await ctx.close().catch(() => {}); }
      }
    }
    expect(!R.length, "tapp.entry", T, `${n}경로 · ` + R.slice(0, 6).join(" ; "));
  }
  // --- tapp.coldTop(4라운드 1): 도구 7개 콜드 해시 × 390·412 — 1.5초·3.5초·8초 모두 scrollY 0(앱바 아래 첫 블록 · 48px 내려가던 것)
  if (SEC(30, "tapp.coldTop")) {
    const T = "설치 앱 도구 7개 콜드 해시(390·412): 1.5·3.5·8초 모두 scrollY 0";
    const R = [];
    const H = ["#rankHub", "#planner", "#saveTop", "#commuteTop", "#diagTop", "#rulesTop", "#statsTop"];
    for (const W of [390, 412]) {
      await Promise.all(H.map(async (h) => {
        const { ctx, page } = await appPage(mob(W, 844));
        try {
          page.__where = "tapp.coldTop " + W + h;
          await page.goto(BASE + "/" + h, { waitUntil: "load", timeout: 40000 });
          const ys = []; let t = 0; for (const at of [1500, 3500, 8000]) { await page.waitForTimeout(at - t); t = at; ys.push(await page.evaluate(() => Math.round(scrollY))); }
          if (ys.some((y) => y !== 0)) R.push(`${W}${h} ${ys.join("/")}`);
        } catch (er) { R.push(`${W}${h} crash`); } finally { await ctx.close().catch(() => {}); }
      }));
    }
    expect(!R.length, "tapp.coldTop", T, R.join(" ; "));
  }
  // --- tapp.cashBack(4라운드 3 · 웹도 web.cashBack): 금액 시트에서 고른 뒤 뒤로·×·'N곳 보기' — 주소 ?cash = 화면 금액 · 홈에서 뒤로 = 닫힘 · 모으면 언제 '바꾸기'도
  if (SEC(31, "tapp.cashBack")) {
    const T = "금액 시트에서 고른 뒤 닫기(뒤로·×·N곳 보기): 주소 cash = 화면 금액 · 그다음 뒤로 = 앱 닫힘(홈) / 도구 '바꾸기'는 그 도구 화면 그대로";
    const R = [];
    for (const app of [true, false]) for (const how of ["back", "x", "go"]) {
      const r = app ? await appPage(mob(390, 844)) : await newPage(browser, mob(390, 844), errs);
      const { ctx, page } = r;
      try {
        page.__where = "cashBack " + (app ? "app " : "web ") + how;
        await ctx.addInitScript(() => { try { localStorage.setItem("zp.onb", "1"); localStorage.setItem("zp.tonb", "1"); } catch (e) {} });
        await page.goto(BASE + "/?cash=2&mode=jeonse", { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(2200);
        await page.click("#sCashBtn"); await page.waitForTimeout(500);
        await page.click('#bSheet [data-bc="3"]'); await page.waitForTimeout(500);
        if (how === "back") await page.goBack().catch(() => {}); else if (how === "x") await page.click("#bSheet button.bs-x"); else await page.click("#bGo");
        await page.waitForTimeout(900);
        const s = await page.evaluate(() => ({ q: new URLSearchParams(location.search).get("cash"), v: (document.getElementById("pCash") || {}).value, open: !document.getElementById("bSheet").hidden }));
        await page.goBack().catch(() => {}); await page.waitForTimeout(700);
        const ex = page.url();
        if (s.q !== "3" || String(s.v) !== "3" || s.open || ex !== "about:blank") R.push(`${app ? "app" : "web"} ${how} ${JSON.stringify(s)} → ${ex}`);
      } catch (er) { R.push(`${app ? "app" : "web"} ${how} crash ${String(er.message || er).split("\n")[0]}`); } finally { await ctx.close().catch(() => {}); }
    }
    for (const W of [390, 1280]) {
      const { ctx, page } = await appPage(W > 980 ? { viewport: { width: W, height: 800 } } : mob(W, 844));
      try {
        page.__where = "cashBack save " + W;
        await page.goto(BASE + "/#saveTop", { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(2500);
        await page.click("#tSvCash button"); await page.waitForTimeout(500);
        await page.click('#bSheet [data-bc="3"]'); await page.waitForTimeout(400); await page.click("#bSheet button.bs-x"); await page.waitForTimeout(900);
        const s = await page.evaluate(() => ({ q: new URLSearchParams(location.search).get("cash"), h: location.hash, view: document.documentElement.classList.contains("s-view") }));
        await page.goBack().catch(() => {}); await page.waitForTimeout(900);
        const b = await page.evaluate(() => ({ h: location.hash, view: document.documentElement.classList.contains("s-view") })).catch(() => null);
        if (s.q !== "3" || s.h !== "#saveTop" || !s.view || !b || b.h || b.view) R.push(`save ${W} ${JSON.stringify({ s, b })}`);
      } catch (er) { R.push(`save ${W} crash ${String(er.message || er).split("\n")[0]}`); } finally { await ctx.close().catch(() => {}); }
    }
    expect(!R.length, "tapp.cashBack", T, R.join(" ; "));
  }
  // --- tapp.mapMin(4라운드 5): 앱 지도 탭 첫 화면 360·390·412 × 1·2·3·5억 × 전세·대출 — 화면 안 구 묶음 최저 = 홈 최저 · 묶음이 화면 가장자리 8px 안 · 화면 밖 묶음 없음 · '+N곳' 칩에 최저가
  if (SEC(32, "tapp.mapMin")) {
    const T = "설치 앱 지도 탭 첫 화면(360·390·412 × 1·2·3·5억 × 전세·대출): 보이는 최저 = 홈 최저 · 묶음은 가장자리 8px 안 · 화면 밖 묶음 없음 · '+N곳 · 금액~' · 묶음 합 + 칩 = 홈 곳 수";
    const R = []; let n = 0;
    await Promise.all([360, 390, 412].map(async (W) => {
      const { ctx, page } = await appPage(mob(W, W === 360 ? 780 : 844));
      try {
        for (const m of ["jeonse", "loan"]) for (const c of [1, 2, 3, 5]) {
          page.__where = `tapp.mapMin ${W} ${m} ${c}`; n++;
          await page.goto(BASE + `/?cash=${c}&mode=${m}`, { waitUntil: "load", timeout: 40000 }); await page.waitForTimeout(1800);
          await page.click('#sNav [data-nav="map"]'); await page.waitForTimeout(3800);
          const r = await page.evaluate(() => {
            const mins = ZP_simple.guMins(), cnt = ZP_simple.guCounts(); let hm = 1e9, tot = 0; for (const k in mins) if (cnt[k]) hm = Math.min(hm, mins[k]); for (const k in cnt) tot += cnt[k];
            const W = innerWidth, H = innerHeight, vis = [], off = [];
            document.querySelectorAll("#lmap .zgu").forEach((e) => { const r = e.getBoundingClientRect(); (r.left >= 0 && r.right <= W && r.top >= 0 && r.bottom <= H ? vis : off).push({ g: e.dataset.gu, m: +e.dataset.m, n: +e.dataset.n, l: Math.round(r.left), r: Math.round(W - r.right) }); });
            const mo = document.getElementById("lmGuMore"), mb = mo && !mo.hidden ? mo.querySelector(".lm-gumore-b") : null;
            const vm = vis.length ? Math.min(...vis.map((v) => v.m)) : null;
            return { hm, vm, tot, sum: vis.reduce((a, v) => a + v.n, 0) + (mb ? +mo.dataset.n : 0), more: mb ? mb.textContent.replace(/\s+/g, " ").trim() : "", moreVis: mb ? getComputedStyle(mb.querySelector("small")).display !== "none" : true, edge: vis.filter((v) => v.l < 8 || v.r < 8).map((v) => v.g), off: off.map((v) => v.g) };
          });
          if (Math.abs(r.vm - r.hm) > 1e-9 || r.edge.length || r.off.length || r.sum !== r.tot || (r.more && (!/만~|억~/.test(r.more) || !r.moreVis))) R.push(`${W} ${m} ${c}억 ${JSON.stringify(r)}`);
        }
      } catch (er) { R.push(`${W} crash ${String(er.message || er).split("\n")[0]}`); } finally { await ctx.close().catch(() => {}); }
    }));
    expect(!R.length, "tapp.mapMin", T, `${n}경우 · ` + R.slice(0, 5).join(" ; "));
  }
  // --- tapp.bigFont(4라운드 레인 2): 360 · 글자 1.3배(모든 요소 글자 크기 ×1.3 — 안드로이드 글꼴 크게) × 라이트·다크 — 홈 목록·아이콘 이름·관심 행·구역 시트: 겹침 없음 · 단어 중간 끊김 없음 · 가로 넘침 없음
  if (SEC(33, "tapp.bigFont")) {
    const T = "큰 글씨(360 · 글자 1.3배 · 라이트·다크): 홈 목록 행(이름 ↔ 금액)·아이콘 이름·관심 행·구역 시트 머리가 겹치지 않고 이름이 단어 중간에서 끊기지 않음 · 가로 넘침 0";
    const grow = (page) => page.evaluate(() => { const els = [...document.querySelectorAll("body *")]; const v = els.map((e) => { const s = getComputedStyle(e); return [parseFloat(s.fontSize), s.lineHeight]; }); els.forEach((e, i) => { if (e.dataset.g13) return; e.dataset.g13 = 1; e.style.setProperty("font-size", v[i][0] * 1.3 + "px", "important"); if (/px/.test(v[i][1])) e.style.setProperty("line-height", parseFloat(v[i][1]) * 1.3 + "px", "important"); }); });
    const probe = (page, tag) => page.evaluate((tag) => {
      const out = [], hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1, vis = (r) => r.width && r.bottom > 0 && r.top < innerHeight;
      // 단어 중간 줄바꿈: 글자마다 줄(top)을 보고, 줄이 바뀐 자리 앞뒤가 둘 다 공백·구두점이 아니면 끊김
      const midBreak = (el) => { const t = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : null; if (!t) return false; const s = t.textContent, rg = document.createRange(); let prev = null; for (let i = 0; i < s.length; i++) { rg.setStart(t, i); rg.setEnd(t, i + 1); const r = rg.getClientRects()[0]; if (!r) continue; if (prev != null && r.top > prev + 4 && !/[\s·(\-/,]/.test(s[i - 1]) && !/[\s·)]/.test(s[i])) return true; prev = r.top; } return false; };
      document.querySelectorAll("#sList li.s-card").forEach((li) => { const a = li.querySelector(".s-nm b"), m = li.querySelector(".s-amt"); if (!a || !m) return; const ra = a.getBoundingClientRect(), rm = m.getBoundingClientRect(); if (!vis(ra)) return; if (hit(ra, rm)) out.push(tag + " 목록 겹침 " + a.textContent.slice(0, 8)); if (midBreak(a)) out.push(tag + " 목록 끊김 " + a.textContent.slice(0, 10)); });
      document.querySelectorAll(".pn-row").forEach((rw) => { const a = rw.querySelector(".pn-nm > b"), m = rw.querySelector(".pn-r"); if (!a || !m || !a.offsetParent) return; if (hit(a.getBoundingClientRect(), m.getBoundingClientRect())) out.push(tag + " 관심 겹침 " + a.textContent.slice(0, 8)); if (midBreak(a)) out.push(tag + " 관심 끊김 " + a.textContent.slice(0, 10)); });
      const L = [...document.querySelectorAll("#tHome .th-l")].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect()); for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (hit(L[i], L[j])) out.push(tag + " 아이콘 이름 겹침 " + i + "/" + j);
      const b1 = document.querySelector("#tHome .th-b.b1 .th-bt"), bar = document.querySelector("#tHome .th-bar"); if (b1 && bar && b1.offsetParent) { const tx = [...b1.querySelectorAll(".th-bh,.th-rd")].map((e) => e.getBoundingClientRect()); if (tx.some((r) => hit(r, bar.getBoundingClientRect()))) out.push(tag + " 배너 글 ↔ 1/3 겹침"); }
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push(tag + " 가로 넘침 " + document.documentElement.scrollWidth);
      return out;
    }, tag);
    const R = [];
    for (const cs of ["light", "dark"]) {
      const { ctx, page } = await appPage(mob(360, 780, cs));
      try {
        await ctx.addInitScript(() => { try { localStorage.setItem("jg-fav", '["o497","o111","o890"]'); } catch (e) {} });
        page.__where = "tapp.bigFont " + cs;
        await appHome(page, "/?src=app&cash=2"); await page.waitForTimeout(1500); await grow(page); await page.waitForTimeout(400);
        R.push(...(await probe(page, cs + " 홈")));
        await page.evaluate(() => { const l = document.getElementById("sList"); if (l) window.scrollTo(0, l.getBoundingClientRect().top + scrollY - 120); }); await page.waitForTimeout(400); await grow(page); await page.waitForTimeout(300);
        R.push(...(await probe(page, cs + " 목록")));
        await page.click('#sNav [data-nav="fav"]'); await page.waitForTimeout(1500); await grow(page); await page.waitForTimeout(400);
        R.push(...(await probe(page, cs + " 관심")));
        await page.click("#favTop .pn-main"); await page.waitForTimeout(1500); await grow(page); await page.waitForTimeout(400);
        R.push(...(await probe(page, cs + " 시트")));
      } catch (er) { R.push(cs + " crash " + String(er.message || er).split("\n")[0]); } finally { await ctx.close().catch(() => {}); }
    }
    expect(!R.length, "tapp.bigFont", T, R.slice(0, 8).join(" ; "));
  }
  // --- tapp.r4misc: 넓은 화면 #tVal 숨김 · 지도 ⓘ 44 · 경매 범례 ↔ 서울 전체 막대 안 겹침 · 지도 탭 시트 aria-current 지도 · 소식 칩 aria 전부 같은 꼴 · '내 구역만' · 배너 1 쉼표 없음 · 통계 '이주·철거' · 입주권 문구 · 다크 세그먼트 #3A404B·굵기 700/500 · 넓은 화면 순위 보조 글 대비 · 넓은 화면 소식 세그먼트 흰 thumb
  if (SEC(34, "tapp.r4misc")) {
    const T = "설치 앱 4라운드 마감: 넓은 화면 #tVal 숨김 · 지도 ⓘ 44×44 · 경매 범례 ↔ '서울 전체' 안 겹침 · 지도 탭 시트에도 aria-current=지도 · 소식 칩 aria 같은 꼴 · '내 구역만' · 배너 1 쉼표 없음 · 통계 '이주·철거' · 입주권 '원칙적으로 없음'(!) · 다크 세그먼트 · 넓은 화면 순위 보조 글 대비";
    const R = [];
    try {
      { const { ctx, page } = await appPage({ viewport: { width: 1280, height: 800 } }); try { await appHome(page); const o = await page.evaluate(() => { const v = document.getElementById("tVal"); return !v || getComputedStyle(v).display === "none"; }); if (!o) R.push("tVal 1280 보임"); await page.goto(BASE + "/#rankHub", { waitUntil: "load" }); await page.waitForTimeout(2000); const c = await page.evaluate(() => { const s = document.querySelector('#rankHub .hub-tabs [aria-selected="true"] small'); return s ? getComputedStyle(s).color : "none"; }); if (!/255, 255, 255|rgba\(255|srgb 1 1 1/.test(c) && c !== "none") R.push("순위 보조 글 " + c); await page.goto(BASE + "/#news", { waitUntil: "load" }); await page.waitForTimeout(2000); const ns = await page.evaluate(() => { const b = document.querySelector('#news .tf-seg [aria-selected="true"]'); return b ? getComputedStyle(b).backgroundColor : "none"; }); if (ns !== "rgb(255, 255, 255)" && ns !== "none") R.push("넓은 소식 세그먼트 " + ns); } finally { await ctx.close().catch(() => {}); } }
      { const { ctx, page } = await appPage(mob(390, 844)); try {
        await appHome(page, "/?src=app&cash=1");
        const ban = await page.evaluate(() => new Promise((r) => setTimeout(() => { const h = document.querySelector("#tHome .th-b.b1 .th-bh"); r(h ? h.textContent : ""); }, 2200)));
        if (/,\s*날짜|,\s*$/.test(ban.split("날짜")[0].trim() + (ban.includes("날짜") ? " 날짜" : ""))) R.push("배너 1 쉼표 " + ban);
        await page.click('#sNav [data-nav="map"]'); await page.waitForTimeout(3500);
        const ib = await page.evaluate(() => { const a = document.querySelector("#mapbox .maplibregl-ctrl-attrib-button"); if (!a) return null; const r = a.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
        if (ib && (ib[0] < 44 || ib[1] < 44)) R.push("ⓘ " + ib);
        await page.evaluate(() => { location.hash = "#o890"; }); await page.waitForTimeout(1800);
        const ac = await page.evaluate(() => ((document.querySelector("#sNav [aria-current=page]") || {}).dataset || {}).nav || "");
        if (ac !== "map") R.push("지도 탭 시트 aria-current " + ac);
        await page.goBack(); await page.waitForTimeout(2200);
        const ov = await page.evaluate(() => { const a = document.getElementById("lmAucLg"), b = document.getElementById("mapBack"); if (!a || !b || a.hidden || !b.offsetParent) return null; const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom; });
        if (ov) R.push("경매 범례 ↔ 서울 전체 겹침");
        await page.goto(BASE + "/#news", { waitUntil: "load" }); await page.waitForTimeout(2500);
        const ch = await page.evaluate(() => [...document.querySelectorAll("#tFeed .tf-chips button, #news .tf-chips button")].filter((b) => b.offsetParent).map((b) => b.getAttribute("aria-label") || ""));
        if (!ch.length || ch.some((l) => !/^\S.* [\d,]+건, 새 소식 [\d,]+건$/.test(l))) R.push("소식 칩 aria " + JSON.stringify(ch));
        await page.click("#tSegM").catch(() => {}); await page.waitForTimeout(1200);
        const fc = await page.evaluate(() => { const c = document.querySelector('#ntcF [data-c="fav"]'); return c ? c.textContent.replace(/N$/, "").trim() : "none"; });
        if (fc !== "내 구역만" && fc !== "none") R.push("관심 구역 칩 " + fc);
        await page.goto(BASE + "/#statsTop", { waitUntil: "load" }); await page.waitForTimeout(2500);
        const sk = await page.evaluate(() => document.getElementById("statsTop").textContent);
        if (/이주·착공/.test(sk)) R.push("통계 '이주·착공' 남음");
        await page.goto(BASE + "/#diagTop", { waitUntil: "load" }); await page.waitForTimeout(2500);
        const dg = await page.evaluate(() => { const li = [...document.querySelectorAll("#dgR li")].find((l) => /입주권/.test(l.textContent) && !/지위양도/.test(l.textContent)); return li ? [li.className, li.textContent.replace(/\s+/g, " ").slice(0, 80)] : null; });
        if (dg && /관리처분인가 이후 매수분/.test(dg[1])) R.push("입주권 문구 " + dg[1]);
        if (dg && /원칙적으로 없음/.test(dg[1]) && dg[0] !== "warn") R.push("입주권 표시 " + dg[0]);
      } finally { await ctx.close().catch(() => {}); } }
      { const { ctx, page } = await appPage(mob(390, 844, "dark")); try {
        await appHome(page, "/?src=app#my"); await page.waitForTimeout(1500);
        const sg = await page.evaluate(() => { const on = document.querySelector('#my :is(.my-seg,.seg) :is([aria-pressed="true"],[aria-checked="true"])'), off = document.querySelector('#my :is(.my-seg,.seg) :is([aria-pressed="false"],[aria-checked="false"])'); return on && off ? [getComputedStyle(on).backgroundColor, getComputedStyle(on).fontWeight, getComputedStyle(off).fontWeight] : null; });
        if (sg && (sg[0] !== "rgb(58, 64, 75)" || +sg[1] < 700 || +sg[2] > 500)) R.push("다크 세그먼트 " + sg);
      } finally { await ctx.close().catch(() => {}); } }
    } catch (er) { R.push("crash " + String(er.message || er).split("\n")[0]); }
    expect(!R.length, "tapp.r4misc", T, R.join(" ; "));
  }
  // --- tapp.overscroll(4라운드 22): 앱 모드 html·body overscroll-behavior-y = none/contain(당겨서 새로고침 없음) · 첫 그림 덮개 남색(#1F3A87·다크 #13265E) · 브라우저는 auto 그대로(덮개 없음)
  if (SEC(35, "tapp.overscroll")) {
    const T = "당겨서 새로고침: 설치 앱 html·body overscroll-behavior-y none/contain · 첫 그림 덮개는 스플래시 남색 · 브라우저(웹)는 auto 그대로";
    const R = [];
    for (const cs of ["light", "dark"]) {
      const { ctx, page } = await appPage(mob(390, 844, cs));
      try { await appHome(page); const o = await page.evaluate(() => { const H = document.documentElement; return [getComputedStyle(H).overscrollBehaviorY, getComputedStyle(document.body).overscrollBehaviorY, getComputedStyle(H, "::after").backgroundColor, getComputedStyle(H, "::after").opacity]; }); const nv = cs === "light" ? "rgb(31, 58, 135)" : "rgb(19, 38, 94)"; if (!/none|contain/.test(o[0]) || !/none|contain/.test(o[1]) || o[2] !== nv || o[3] !== "0") R.push("app " + cs + " " + JSON.stringify(o)); } catch (er) { R.push("app crash"); } finally { await ctx.close().catch(() => {}); }
    }
    { const { ctx, page } = await newPage(browser, mob(390, 844), errs); try { await page.goto(BASE + "/", { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(800); const o = await page.evaluate(() => [getComputedStyle(document.documentElement).overscrollBehaviorY, getComputedStyle(document.body).overscrollBehaviorY, getComputedStyle(document.documentElement, "::after").content]); if (o[0] !== "auto" || o[1] !== "auto" || (o[2] !== "none" && o[2] !== "normal")) R.push("web " + JSON.stringify(o)); } catch (er) { R.push("web crash"); } finally { await ctx.close().catch(() => {}); } }
    expect(!R.length, "tapp.overscroll", T, R.join(" ; "));
  }
  // --- tapp.cover(5라운드 A·B): 시작 덮개 = 스플래시 마크(흰 핀·노란 문 · data URI · 240px 칸 · 가운데) · 첫 무거운 작업 뒤 걷힘(앱이 붙은 뒤 2.5초 안) · 덮개 동안 theme-color 남색, 걷으면 되돌림 · 해시 진입도 같음 · 웹은 덮개 없음
  if (SEC(36, "tapp.cover")) {
    const T = "설치 앱 시작 덮개: 스플래시와 같은 마크(흰 핀·노란 문, 인라인)·가운데 · 첫 계산·홈 그리기 뒤 걷힘(앱 붙은 뒤 ≤2.5초) · 덮개 동안 theme-color 남색 → 걷으면 원래 값 · 걷은 뒤 앱 5탭(웹 화면 노출 없음) · 웹은 덮개 없음";
    const R = [];
    for (const [u, cs] of [["/?src=app", "light"], ["/#news", "dark"], ["/#map", "light"], ["/#o497", "light"]]) {
      const { ctx, page } = await appPage(mob(390, 844, cs));
      try {
        page.__where = "tapp.cover " + u;
        await page.goto(BASE + u, { waitUntil: "commit", timeout: 30000 });
        await page.waitForFunction(() => document.documentElement && document.documentElement.classList.contains("is-tapp"), null, { timeout: 15000 }).catch(() => {});
        const a = await page.evaluate(() => { const H = document.documentElement, s = getComputedStyle(H, "::after"); return { cov: H.classList.contains("tapp-cover"), bg: s.backgroundImage.slice(0, 40), mark: /F5C33B/i.test(decodeURIComponent(s.backgroundImage)), pos: s.backgroundPosition, size: s.backgroundSize, tc: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content).join(",") }; }).catch(() => null);
        const t = await page.waitForFunction(() => !document.documentElement.classList.contains("tapp-cover"), null, { timeout: 30000, polling: 50 }).then(() => page.evaluate(() => { const m = performance.getEntriesByName("zp-cover-off")[0], h = performance.getEntriesByName("zp-hyd")[0]; return { off: m ? Math.round(m.startTime) : null, hyd: h ? Math.round(h.startTime) : null, why: window.ZP_coverWhy, on: document.documentElement.classList.contains("tapp-on"), nav: document.querySelectorAll("#sNav [data-nav]").length, tc: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content).join(",") }; })).catch(() => null);
        if (!a || !a.cov || !/^url\("data:image\/svg/.test(a.bg) || !a.mark || !/50% 50%/.test(a.pos) || a.size !== "240px 240px" || !/#1F3A87|#13265E/i.test(a.tc)) R.push(u + " 덮개 " + JSON.stringify(a));
        if (!t || !t.on || t.nav !== 5 || t.off == null || (t.hyd != null && t.off - t.hyd > 2500 + 600) || /#1F3A87|#13265E/i.test(t.tc)) R.push(u + " 걷힘 " + JSON.stringify(t));
      } catch (er) { R.push(u + " crash " + String(er.message || er).split("\n")[0]); } finally { await ctx.close().catch(() => {}); }
    }
    { const { ctx, page } = await newPage(browser, mob(390, 844), errs); try { await page.goto(BASE + "/", { waitUntil: "load", timeout: 30000 }); const w = await page.evaluate(() => ({ cov: document.documentElement.classList.contains("tapp-cover"), c: getComputedStyle(document.documentElement, "::after").content, tc: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content).join(",") })); if (w.cov || (w.c !== "none" && w.c !== "normal") || w.tc !== "#FFFFFF,#15181D") R.push("web " + JSON.stringify(w)); } catch (er) { R.push("web crash"); } finally { await ctx.close().catch(() => {}); } }
    expect(!R.length, "tapp.cover", T, R.join(" ; "));
  }
  // --- tapp.r5misc(5라운드): 오프라인 안내 = 페이지 안 판단(서비스 워커 전역 값 없음) · 시트 열린 채 새로고침해도 기록 안 늘어남 · 리포트 → 하단 탭 → 뒤로 = 리포트 · 지위양도 ! · 날짜 YYYY.M.D · 모아타운 행 단정 없음 · 자리 그림 ⓘ 44 · 홈 → 흰 원 없음 · 390 '갈 수 있는 곳' 제목 아래 탭 위 · 메타 줄 한 줄(기본 글씨)
  if (SEC(37, "tapp.r5misc")) {
    const T = "설치 앱 5라운드 마감: 오프라인 탭 판단이 페이지 안 · 시트 새로고침 기록 불어남 없음 · 정적→탭→뒤로 = 그 페이지 · 지위양도 !·말투 · 날짜 YYYY.M.D · 모아타운 행 '원칙적으로' · 지도 자리 그림 ⓘ 44 · 홈 → 흰 원 없음 · 제목 접힘선 위 · 목록 메타 한 줄";
    const R = [];
    try {
      const sw = String((await getPage("/sw.js")).text || "");
      if (/\bTAPP\b/.test(sw) || !/sessionStorage\.getItem\("zp\.tapp"\)/.test(sw)) R.push("sw.js 오프라인 판단");
      { const { ctx, page } = await appPage(mob(390, 844)); try {
        await page.goto(BASE + "/#o497", { waitUntil: "load" }); await page.waitForTimeout(2500); const h0 = await page.evaluate(() => history.length);
        await page.reload({ waitUntil: "load" }); await page.waitForTimeout(2500); await page.reload({ waitUntil: "load" }); await page.waitForTimeout(2500);
        const h1 = await page.evaluate(() => history.length); if (h1 !== h0) R.push(`시트 새로고침 기록 ${h0}→${h1}`);
      } finally { await ctx.close().catch(() => {}); } }
      { const { ctx, page } = await appPage(mob(390, 844)); try {
        await page.goto(BASE + "/report/2026-10.html", { waitUntil: "load" }); await page.waitForTimeout(800);
        await page.evaluate(() => { location.href = "/#favTop"; }); await page.waitForFunction(() => document.documentElement.classList.contains("tapp-on"), null, { timeout: 25000 }).catch(() => {}); await page.waitForTimeout(1500);
        await page.goBack().catch(() => {}); await page.waitForTimeout(1200); if (!/report\/2026-10/.test(page.url())) R.push("정적→탭→뒤로 " + page.url());
      } finally { await ctx.close().catch(() => {}); } }
      { const { ctx, page } = await appPage(mob(390, 844)); try {
        await appHome(page, "/?src=app&cash=3");
        const hm = await page.evaluate(() => { const a = document.querySelector("#sGauge .s-arrow"), h = [...document.querySelectorAll("h2")].find((x) => /^갈 수 있는 곳 ·/.test(x.textContent.trim())), nav = document.getElementById("sNav"); const meta = [...document.querySelectorAll("#sList li.s-card .s-mt")].slice(0, 8).map((m) => Math.round(m.getBoundingClientRect().height)); return { arrBg: a ? getComputedStyle(a).backgroundColor : "", t: h ? Math.round(h.getBoundingClientRect().bottom) : 0, n: Math.round(nav.getBoundingClientRect().top), meta, big: document.documentElement.classList.contains("t-big") }; });
        if (hm.arrBg !== "rgba(0, 0, 0, 0)" || hm.t > hm.n || hm.big || hm.meta.some((x) => x > 22)) R.push("홈 " + JSON.stringify(hm));
        await page.click('#sNav [data-nav="map"]'); await page.waitForTimeout(2500);
        const ib = await page.evaluate(() => { const e = document.querySelector(".zp-ph .zg-attr"); if (!e || !e.offsetWidth) return "none"; const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), /stroke/.test(decodeURIComponent(getComputedStyle(e).backgroundImage))]; });
        if (ib !== "none" && (ib[0] !== 44 || ib[1] !== 44 || !ib[2])) R.push("자리 그림 ⓘ " + ib);
        await page.goto(BASE + "/#diagTop", { waitUntil: "load" }); await page.waitForTimeout(2500);
        const dg = await page.evaluate(() => [...document.querySelectorAll("#dgR li")].map((l) => [l.className, l.textContent.replace(/\s+/g, " ")]));
        const tr = dg.find((x) => /조합원 지위양도/.test(x[1])); if (tr && /승계 불가\(/.test(tr[1])) R.push("지위양도 문구 " + tr[1].slice(0, 60));
        if (tr && /지금 이 단계/.test(tr[1]) && tr[0] !== "warn") R.push("지위양도 표시 " + tr[0]);
        const bd = dg.map((x) => x[1]).join(" ").match(/\b\d{4}\.(0\d|\d{1,2}\.0\d)\b|\b\d\d\.\d\d\.\d\d\b/g); if (bd) R.push("날짜 꼴 " + bd.join(","));
        await page.goto(BASE + "/#m10", { waitUntil: "load" }); await page.waitForTimeout(3000);
        const mo = await page.evaluate(() => [...document.querySelectorAll("#report .dt-kid")].map((b) => b.textContent.replace(/\s+/g, " ")));
        if (mo.some((t) => /입주권 없음/.test(t))) R.push("모아타운 행 단정 " + mo.join(" / ").slice(0, 120));
      } finally { await ctx.close().catch(() => {}); } }
    } catch (er) { R.push("crash " + String(er.message || er).split("\n")[0]); }
    expect(!R.length, "tapp.r5misc", T, R.join(" ; "));
  }
  // --- search.parcel(5라운드 16 · 웹·앱): 구역 안 필지 지번 → 그 구역 1위(모아타운 하위 조합 먼저) · 구역 밖 지번 → '구역 밖' 안내 · 기존 검색어(이름·동·역·구·초성·로마자) 상위 6줄 = 지번 검색 넣기 전(tools/fixtures/search_base.json) · 색인은 지번 꼴일 때만 받음
  if (SEC(38, "search.parcel")) {
    const T = "지번 검색(웹·앱): 구역 안 필지 5개 → 그 구역 1위(모아타운은 필지가 든 사업구역 먼저) · 구역 밖 3개 → '구역 밖' 안내 · 기존 검색 상위 6줄 그대로 · 첫 화면에서 색인(pcli) 안 받음";
    const R = [];
    const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 900 } }, errs);
    try {
      const pcliReq = []; page.on("request", (q) => { if (/\/pcli\//.test(q.url())) pcliReq.push(q.url()); });
      await ctx.addInitScript(() => { try { localStorage.setItem("zp.onb", "1"); } catch (e) {} });
      await page.goto(BASE + "/", { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(3500);
      if (pcliReq.length) R.push("첫 화면에서 색인 받음 " + pcliReq.join(","));
      const run = async (q) => { await page.evaluate((q) => { const i = document.getElementById("q"); i.value = q; i.dispatchEvent(new Event("input", { bubbles: true })); }, q); await page.waitForTimeout(700); await page.waitForFunction(() => !document.getElementById("sugg").hidden, null, { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(500); return page.evaluate(() => ({ ids: [...document.querySelectorAll("#sugg [data-id],#sugg [data-stn],#sugg [data-gu]")].slice(0, 6).map((b) => b.dataset.id || "S:" + (b.dataset.stn || b.dataset.gu)), t: document.getElementById("sugg").innerText.replace(/\s+/g, " ").slice(0, 200) })); };
      for (const [q, want] of [["면목동 86-15", "o58"], ["면목동86-15", "o58"], ["중랑구 면목동 86-15", "o58"], ["행당동 128-417", "o498"], ["신림동 412-88", "o960"], ["성수동2가 344-7", "o509"], ["한남동 647-10번지", "o151"], ["개봉동 270-13", "m46"]]) { const r = await run(q); if (r.ids[0] !== want || !/안 필지/.test(r.t)) R.push(`${q} → ${r.ids[0]}(${want}) ${r.t.slice(0, 60)}`); }
      // 6라운드: 표기 변형(서울·서울특별시·붙여 쓰기·전각/엔대시·N번지 M·N번지M호·N의M·'한강로 3가'·성수2가) · 행정동 → 법정동 · 압구정동(구 이름 오인 없음) · 묶음 머리 줄
      for (const [q, want, hd] of [["서울 중랑구 면목동 86-15", "o58"], ["서울특별시 중랑구 면목동 86-15", "o58"], ["중랑구면목동86-15", "o58"], ["면목동 86－15", "o58"], ["면목동 86–15", "o58"], ["면목동 86번지 15", "o58"], ["면목동 86번지15호", "o58"], ["면목동 86의15", "o58"], ["면목본동 86-15", "o58", /법정동/], ["면목2동 86-15", "o58", /법정동/], ["한강로 3가 40-10", "o159"], ["압구정동 480", null, /압구정동 480번지 →/], ["자양동 799", "m78", /다른 검색 결과/]]) {
        const r = await run(q); const top = r.ids[0];
        if ((want && top !== want) || (hd && !hd.test(r.t)) || /정동 480 ·/.test(r.t)) R.push(`변형 ${q} → ${top}(${want}) ${r.t.slice(0, 70)}`);
      }
      { const r = await run("성수2가 300"); if (!/성수동2가/.test(r.t)) R.push("성수2가 → 성수동2가 " + r.t.slice(0, 60)); }
      { const r = await run("면목3동 99999"); if (!/구역 밖|법정동 이름/.test(r.t)) R.push("행정동 구역 밖 " + r.t.slice(0, 60)); }
      for (const q of ["면목동 700", "행당동 1", "신림동 1-1"]) { const r = await run(q); if (!/구역 밖/.test(r.t)) R.push(`${q} 구역 밖 안내 없음: ${r.t.slice(0, 80)}`); }
      // 6라운드: 전수 — 필지 자료가 있는 모든 구역(739곳)마다 그 구역에만 든 필지 하나를 검색하면 그 구역이 1위(모아타운 관리지역은 그 안 사업구역이 먼저 나와도 같은 묶음이면 통과)
      { const P = require("path"), dir = P.join(__dirname, "..", "public", "pcli"), byz = {};
        for (const f of fs.readdirSync(dir).filter((x) => /\.json$/.test(x)).sort()) { const J = JSON.parse(fs.readFileSync(P.join(dir, f), "utf8")); for (const d of Object.keys(J).sort()) for (const k of Object.keys(J[d]).sort()) { const v = J[d][k]; if (typeof v === "string" && !byz[v] && !/^산/.test(k) && /-/.test(k)) byz[v] = [d, k]; } }
        const ent = Object.entries(byz); let ok = 0; const bad = [];
        for (const [id, [d, k]] of ent) {
          let r = await page.evaluate((q) => { const i = document.getElementById("q"); i.value = q; i.dispatchEvent(new Event("input", { bubbles: true })); return new Promise((res) => setTimeout(() => res([...document.querySelectorAll("#sugg [data-id]")].slice(0, 4).map((b) => b.dataset.id).concat([document.getElementById("sugg").innerText.slice(0, 60)])), 260)); }, `${d} ${k}`);
          if (r[0] !== id && !(r.indexOf(id) > 0 && /^m/.test(id))) { await page.waitForTimeout(600); r = await page.evaluate(() => [...document.querySelectorAll("#sugg [data-id]")].slice(0, 4).map((b) => b.dataset.id)); }
          if (r[0] === id || (/^m/.test(id) && r.slice(0, 3).includes(id))) ok++; else bad.push(`${id} ${d} ${k}→${r[0]}`);
        }
        if (bad.length || ent.length < 650) R.push(`전수 ${ok}/${ent.length} ` + bad.slice(0, 5).join(","));
      }
      let base = null; try { base = JSON.parse(fs.readFileSync(require("path").join(__dirname, "fixtures", "search_base.json"), "utf8")); } catch (e) {}
      if (base) for (const q of Object.keys(base)) { const r = await run(q); if (JSON.stringify(r.ids) !== JSON.stringify(base[q])) R.push(`회귀 ${q}: ${base[q].join(",")} → ${r.ids.join(",")}`); }
      else R.push("search_base.json 없음");
    } catch (er) { R.push("crash " + String(er.message || er).split("\n")[0]); } finally { await ctx.close().catch(() => {}); }
    expect(!R.length, "search.parcel", T, R.join(" ; "));
  }
  // --- search.names(출시 전 검수 B1 · 웹·앱 공통 검색): 구역 956곳을 각자 이름으로 검색 — 라이브가 찾던 곳은 하나도 빠지지 않음(tools/fixtures/search_names_live.json = 라이브 전수 결과) · 이름이 '동 + 번지' 꼴이어도 '구역 밖' 안내로 가리지 않음 · 이름이 똑같은 곳 1위(수유동 310-15 → s43)
  if (SEC(39, "search.names")) {
    const T = "이름 전수 검색: 라이브가 찾던 구역은 후보도 전부 찾음(사라진 곳 0) · 찾은 줄 금액 = 정적 /z '지금 필요한 돈'(0 불일치) · '동+번지' 꼴 이름도 '구역 밖'으로 안 가림 · 이름 같은 곳 1위";
    const R = []; let n = 0, lost = [];
    const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 900 } }, errs);
    try {
      const L = JSON.parse(fs.readFileSync(require("path").join(__dirname, "fixtures", "search_names_live.json"), "utf8")).filter((x) => x.s != null);
      if (L.length < 800) R.push("기준 자료가 너무 적음 " + L.length);
      await ctx.addInitScript(() => { try { localStorage.setItem("zp.onb", "1"); } catch (e) {} });
      await page.goto(BASE + "/", { waitUntil: "load", timeout: 30000 });
      await page.waitForFunction(() => window.ZP_boot && ZP_boot.hyd === 1, null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1000);
      // after-adsense 1: 956곳 전부 — 라이브가 찾던 곳은 반드시 찾고, 찾은 줄의 금액('지금 X'·'계산 보류') = 정적 /z '지금 필요한 돈'(검색 줄만 '계산 보류'이던 373곳 · 이름 칩으로만 걸리던 곳 없음)
      const AL = JSON.parse(fs.readFileSync(require("path").join(__dirname, "fixtures", "search_names_live.json"), "utf8")), liveF = new Set(L.map((x) => x.id));
      const zCell = async (id) => { const z = await getPage("/z/" + id); if (z.status !== 200) return null; const t = String(z.text).slice(String(z.text).indexOf("<body")).replace(/<[^>]+>/g, " | ").replace(/(\s*\|\s*)+/g, " | "); const m = / \| 지금 필요한 돈 \| ([^|]+?) \|/.exec(t); return m ? m[1].trim() : null; };
      const mis = []; let nv = 0;
      for (const x of AL) {
        n++;
        await page.fill("#q", ""); await page.fill("#q", x.name);
        const v = await page.waitForFunction((id) => { const e = document.querySelector(`#sugg [data-id="${id}"]`); if (!e) return false; const c = e.querySelector(".sg-c"); return c ? c.innerText.split("\n")[0].replace(/^지금\s*/, "").trim() : "(칩만)"; }, x.id, { timeout: 2000 }).then((h) => h.jsonValue()).catch(() => null);
        if (v == null) { if (liveF.has(x.id)) lost.push(`${x.id} '${x.name}' ${(await page.evaluate(() => document.getElementById("sugg").innerText.replace(/\s+/g, " ").slice(0, 40)))}`); continue; }
        const zv = await zCell(x.id); if (zv == null) continue;
        nv++; if (v !== zv) mis.push(`${x.id} 검색 ${v} · /z ${zv}`);
      }
      if (lost.length) R.push(`사라진 곳 ${lost.length}: ` + lost.slice(0, 6).join(" ; "));
      if (mis.length || nv < 800) R.push(`금액 다름 ${mis.length}/${nv}: ` + mis.slice(0, 6).join(" ; "));
      for (const [q, want] of [["수유동 310-15", "s43"], ["창동 608", "s51"], ["중화동324", "o6"], ["무교다동4", "s79"]]) {
        await page.fill("#q", ""); await page.fill("#q", q); await page.waitForTimeout(1500);
        const r = await page.evaluate(() => ({ top: (document.querySelector("#sugg [data-id]") || {}).dataset?.id, t: document.getElementById("sugg").innerText.replace(/\s+/g, " ").slice(0, 80) }));
        if (/구역 밖/.test(r.t)) R.push(`${q}: '구역 밖' 안내 ${r.t}`);
        if (q === "수유동 310-15" && r.top !== want) R.push(`${q} 1위 ${r.top}(${want})`);
        else if (!(await page.$(`#sugg [data-id="${want}"]`))) R.push(`${q}: ${want} 없음`);
      }
    } catch (er) { R.push("crash " + String(er.message || er).split("\n")[0]); } finally { await ctx.close().catch(() => {}); }
    expect(!R.length, "search.names", T, `${n}곳 · ` + R.join(" ; "));
  }
  // --- moa.rows(6라운드 1 · 웹): 모아타운 관리지역(m1~m140) 하위 행 전부 — 행 값 = 그 구역 시트 '지금 필요한 돈' = 정적 /z 같은 칸(전수 · 0 불일치) · 입주권 없는 행은 '계산 보류' + '입주권 원칙적으로 없음 · 예외 매물만'
  if (SEC(40, "moa.rows")) {
    const T = "모아타운 하위 행 값 = 시트 '지금 필요한 돈' = 정적 /z(전수) · 입주권 없는 행은 '계산 보류'·'원칙적으로 없음'(웹)";
    const R = []; let nRow = 0;
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      await ctx.addInitScript(() => { try { localStorage.setItem("zp.onb", "1"); } catch (e) {} });
      await page.goto(BASE + "/", { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(3000);
      const rows = {};
      for (let i = 1; i <= 140; i++) {
        await page.evaluate((m) => { location.hash = m; }, "m" + i); await page.waitForTimeout(380);
        const r = await page.evaluate(() => [...document.querySelectorAll("#report .dt-kid")].map((x) => [x.dataset.go, x.querySelector(".dt-kv b").textContent.trim(), (x.querySelector(".dt-kv small") || {}).textContent || ""]));
        r.forEach((x) => { rows[x[0]] = rows[x[0]] || x; });
        await page.evaluate(() => history.back()); await page.waitForTimeout(150);
      }
      for (const [id, v, sub] of Object.values(rows)) {
        if (v === "입주 완료") continue;
        nRow++;
        await page.evaluate((id) => { location.hash = id; }, id); await page.waitForTimeout(450);
        const sv = await page.evaluate(() => { const b = document.querySelector('#report [data-k="now"] .dt-v'); return b ? b.textContent.trim() : null; });
        await page.evaluate(() => history.back()); await page.waitForTimeout(150);
        const z = await getPage("/z/" + id); let zv = null;
        if (z.status === 200) { const t = String(z.text).slice(String(z.text).indexOf("<body")).replace(/<[^>]+>/g, " | ").replace(/(\s*\|\s*)+/g, " | "); const m = / \| 지금 필요한 돈 \| ([^|]+?) \|/.exec(t); zv = m ? m[1].trim() : null; }
        if (sv !== v || (zv != null && zv !== v)) R.push(`${id}: 행 ${v} · 시트 ${sv} · /z ${zv}`);
        if (v === "계산 보류" && /입주권/.test(sub) && !/원칙적으로 없음/.test(sub)) R.push(`${id}: 보조 줄 ${sub}`);
        if (/일반 매매/.test(v)) R.push(`${id}: 일반 매매 값`);
      }
    } catch (er) { R.push("crash " + String(er.message || er).split("\n")[0]); } finally { await ctx.close().catch(() => {}); }
    expect(!R.length && nRow > 50, "moa.rows", T, `${nRow}행 · ` + R.slice(0, 6).join(" ; "));
  }
  // --- tapp.coverSafe(6라운드 5): 덮개 안전장치 — 덮개가 있는 동안 아래로 터치가 새지 않음(pointer-events) · 앱 코드(a.js) 실패 → 바로 걷고 웹 머리·4탭 숨김 · 느린 앱 코드(11초) → 10초 안내 한 줄 · 배너 자동 넘김은 덮개를 걷은 뒤
  if (SEC(41, "tapp.coverSafe")) {
    const T = "설치 앱 덮개 안전장치: 덮개 동안 터치 막힘 · 앱 코드 실패 땐 바로 걷고 웹 머리·4탭 숨김 · 10초 넘으면 안내 한 줄 · 배너 자동 넘김은 걷은 뒤";
    const R = [];
    const twaPage = async () => { const r = await newPage(browser, mob(390, 844), []); await r.ctx.addInitScript(TWA); await r.ctx.addInitScript(() => { try { localStorage.setItem("zp.tonb", "1"); localStorage.setItem("zp.onb", "1"); } catch (e) {} }); return r; };   // 일부러 막는 요청의 콘솔 오류는 전체 오류 검사(err.console)에 넣지 않는다
    { const { ctx, page } = await twaPage(); try {
      await ctx.route(/\/b\/t\.[0-9a-f]+\.(js|css)/, (q) => setTimeout(() => q.continue().catch(() => {}), 11500));
      await page.goto(BASE + "/?src=app", { waitUntil: "commit", timeout: 30000 }); await page.waitForTimeout(1500);
      const pe = await page.evaluate(() => getComputedStyle(document.documentElement, "::after").pointerEvents);
      if (pe !== "auto") R.push("덮개 pointer-events " + pe);
      await page.waitForTimeout(9200);
      const m = await page.evaluate(() => { const e = document.getElementById("tcMsg"); return e ? [e.textContent, getComputedStyle(e).display, document.documentElement.classList.contains("tapp-slow")] : null; });
      if (!m || !/처음 실행이라/.test(m[0]) || m[1] === "none" || !m[2]) R.push("10초 안내 " + JSON.stringify(m));
      await page.waitForFunction(() => !document.documentElement.classList.contains("tapp-cover"), null, { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const o = await page.evaluate(() => ({ on: document.documentElement.classList.contains("tapp-on"), msg: !!document.getElementById("tcMsg") && getComputedStyle(document.getElementById("tcMsg")).display !== "none" }));
      if (!o.on || o.msg) R.push("느린 앱 묶음 뒤 " + JSON.stringify(o));
    } catch (er) { R.push("slow crash"); } finally { await ctx.close().catch(() => {}); } }
    { const { ctx, page } = await twaPage(); try {
      await ctx.route(/\/b\/t\.[0-9a-f]+\.js/, (q) => q.abort());
      await page.goto(BASE + "/?src=app", { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(2500);
      const o = await page.evaluate(() => ({ cov: document.documentElement.classList.contains("tapp-cover"), bare: document.documentElement.classList.contains("tapp-bare"), hdr: getComputedStyle(document.getElementById("hdr")).visibility, nav: getComputedStyle(document.getElementById("sNav")).visibility }));
      if (o.cov || !o.bare || o.hdr !== "hidden" || o.nav !== "hidden") R.push("앱 묶음 실패 " + JSON.stringify(o));
    } catch (er) { R.push("t fail crash"); } finally { await ctx.close().catch(() => {}); } }
    { const { ctx, page } = await twaPage(); try {
      await ctx.route(/\/b\/a\.[0-9a-f]+\.js/, (q) => q.abort());
      await page.goto(BASE + "/?src=app", { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(2500);
      const o = await page.evaluate(() => ({ cov: document.documentElement.classList.contains("tapp-cover"), hdr: getComputedStyle(document.getElementById("hdr")).visibility, nav: document.querySelectorAll("#sNav [data-nav]").length, navV: getComputedStyle(document.getElementById("sNav")).visibility }));
      if (o.cov || !(o.hdr === "hidden" || o.nav === 5)) R.push("앱 코드 실패 " + JSON.stringify(o));
    } catch (er) { R.push("a fail crash"); } finally { await ctx.close().catch(() => {}); } }
    try { const sh = String((await get(BASE + "/")).text || ""); if (!/prefers-reduced-motion:reduce\)\{html\.tapp-cover\.tapp-slow::before\{animation:none/.test(sh)) R.push("진행 링 움직임 줄이기 없음"); if (!/setTimeout\(window\.ZP_cover,25000\)/.test(sh)) R.push("전체 상한 25초 아님"); } catch (e) {}
    expect(!R.length, "tapp.coverSafe", T, R.join(" ; "));
  }
  // --- tapp.files(19·20): SW 미리 저장에서 앱 묶음(/b/t.*) 빼기 · assetlinks.json(JSON · TODO 없음 · 패키지 이름 · SHA-256 지문)
  if (SEC(42, "tapp.files")) {
    const sw = String((await getPage("/sw.js")).text || ""), al = await get(BASE + "/.well-known/assetlinks.json").catch(() => ({ text: "" }));
    let j = null; try { j = JSON.parse(al.text); } catch (e) {}
    const fp = j && j[0] && j[0].target && j[0].target.sha256_cert_fingerprints;
    expect(/\/\\\/b\\\/\[a-su-z\]\\\./.test(sw), "tapp.swPre", "SW 설치 때 미리 저장하는 묶음에서 설치 앱 묶음(/b/t.*) 제외(브라우저 방문자가 받지 않게)", "sw.js 정규식 확인");
    expect(!!(j && j[0].target.package_name === "kr.alwaysquestions.zippin" && Array.isArray(fp) && fp.length && fp.every((x) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(x)) && !/TODO/.test(al.text) && /application\/json/.test(al.ct || "")), "tapp.assetlinks", "/.well-known/assetlinks.json: application/json · 패키지 이름 · SHA-256 지문만(TODO 없음)", (al.ct || "") + " " + al.text.slice(0, 200));
  }
  SEC.close();
}
async function r26Lane(browser, api, errs) {
  const mob = (w, h, cs = "light") => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: cs });
  const WEB = [".s-rd", ".s-reads", ".site-foot", ".ad-slot", ".s-about", ".s-read3", "#sAbout", "#sRead3"];
  // --- home.readsTop: 브라우저 첫 화면(폰·PC) 검색칸 바로 밑 읽을거리 한 줄(리포트·가이드 두 링크 · 한 줄 · 누르는 높이 40px 이상)이 첫 화면 안에 · '재개발 공부하기'는 목록 뒤 · '집핀이 뭔가요' 상자 없음
  {
    const T = "홈 읽을거리: 검색칸 밑 한 줄(리포트·가이드 · 줄바꿈 없음 · 40px 이상)이 첫 화면 안 · 맨 아래 공부하기 카드·푸터 가이드 링크 없음(들어가는 곳 둘: 한 줄 + MY) · 소개 상자 없음";
    for (const [vp, tag] of [[mob(360, 740), "360"], [mob(390, 844), "390"], [mob(412, 915), "412"], [{ viewport: { width: 1440, height: 900 } }, "1440"]]) {
      const { ctx, page } = await newPage(browser, vp, errs);
      try {
        page.__where = "readsTop " + tag;
        await loadHome(page); await settle(page, 400);
        const r = await page.evaluate(() => { const d = document.getElementById("sRd"), b = d && d.getBoundingClientRect(), L = d ? [...d.querySelectorAll("a")] : [], rd = document.getElementById("sReads"), li = document.getElementById("sList");
          return { ok: !!d && b.height > 0, top: b ? Math.round(b.top) : null, h: b ? Math.round(b.height) : 0, vh: innerHeight, links: L.map((a) => [a.getAttribute("href"), Math.round(a.getBoundingClientRect().height), a.scrollWidth > a.clientWidth + 1]), lines: d ? Math.round(b.height / 44) : 0,
            reads: !!rd, about: !!document.getElementById("sAbout"), read3: !!document.getElementById("sRead3") }; });
        const linksOk = r.links.length === 2 && r.links.some((x) => /^report\//.test(x[0])) && r.links.some((x) => /^guide\//.test(x[0])) && r.links.every((x) => x[1] >= 40);
        // 27차: 가이드·리포트로 가는 곳은 읽을거리 한 줄 + MY 둘만 — 맨 아래 '재개발 공부하기' 카드 없음 · 웹 푸터에 가이드·리포트 링크 없음
        r.foot = await page.evaluate(() => [...document.querySelectorAll(".site-foot a")].map((a) => a.getAttribute("href")).filter((h) => /^(\/)?(guide|report)\//.test(h || "")));
        expect(r.ok && r.top != null && r.top + r.h <= r.vh && r.h <= 52 && linksOk && !r.reads && !r.foot.length && !r.about && !r.read3, "home.readsTop", T, `${tag}: ${JSON.stringify(r)}`);
      } catch (e) { bad("runtime", "검사 실행", "r26 readsTop crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- app.standaloneClean: 설치 앱 규칙을 강제로 켜면 웹 덩이가 하나도 안 보임(폰 두 상태 · PC)
  {
    const T = "설치 앱(standalone): 읽을거리 한 줄·재개발 공부하기·웹 푸터·광고 자리·소개 상자 모두 숨김(앱 화면만)";
    for (const [vp, u, tag] of [[mob(390, 844), "/?cash=2", "390"], [mob(360, 740, "dark"), "/?cash=1", "360 dark"], [{ viewport: { width: 1440, height: 900 } }, "/?cash=2", "1440"]]) {
      const { ctx, page } = await newPage(browser, vp, errs);
      try {
        page.__where = "standalone " + tag;
        await page.goto(BASE + u, { waitUntil: "load" });
        await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1, null, { timeout: 20000 }).catch(() => {});
        await settle(page, 500);
        const n = await page.evaluate(FORCE_SA);
        await page.waitForTimeout(200);
        const vis = await page.evaluate((W) => W.flatMap((s) => [...document.querySelectorAll(s)]).filter((e) => { const cs = getComputedStyle(e), b = e.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && b.height > 0 && b.width > 0; }).map((e) => (e.id || e.className) + "@" + Math.round(e.getBoundingClientRect().top + scrollY)), WEB);
        const app = await page.evaluate(() => ({ list: !!document.querySelector("#sList .s-card"), nav: getComputedStyle(document.getElementById("sNav")).display !== "none" }));
        expect(n > 0 && !vis.length && app.list && app.nav, "app.standaloneClean", T, `${tag}: rules ${n}B · still visible ${vis.join(", ")} · app list ${app.list} nav ${app.nav}`);
      } catch (e) { bad("runtime", "검사 실행", "r26 standalone crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- my.layout: MY '집 있어요?' 줄 — 440px 아래에서는 제목 한 줄(눌리지 않음) · 칩은 그 아래 · 넘침 없음 · 칩 40px 이상
  {
    const T = "MY '집 있어요?': 제목이 한 글자 폭으로 눌리지 않음(폭 100px 이상·높이 60px 이하) · 좁으면 칩은 제목 아래 · 칩 높이 40px 이상 · 가로 넘침 없음";
    for (const w of [360, 390, 412]) {
      const { ctx, page } = await newPage(browser, mob(w, 800), errs);
      try {
        page.__where = "my " + w;
        await loadHome(page, "#my"); await settle(page, 500);
        const r = await page.evaluate(() => { const row = document.querySelector("#my .my-hm"), t = row && row.querySelector(".my-t"), sg = row && row.querySelector(".my-seg4"); if (!row || !t || !sg) return null; const a = t.getBoundingClientRect(), b = sg.getBoundingClientRect(), c = row.getBoundingClientRect();
          return { tw: Math.round(a.width), th: Math.round(a.height), below: b.top >= a.bottom - 2, segR: Math.round(b.right), rowR: Math.round(c.right), btn: Math.min(...[...sg.querySelectorAll("button")].map((x) => x.getBoundingClientRect().height)), over: document.documentElement.scrollWidth > innerWidth + 1 }; });
        expect(r && r.tw >= 100 && r.th <= 60 && r.below && r.segR <= r.rowR + 1 && r.btn >= 40 && !r.over, "my.layout", T, `${w}: ${JSON.stringify(r)}`);
      } catch (e) { bad("runtime", "검사 실행", "r26 my crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- zone.eligibleConsistent: 2억 · 지금 필요한 돈이 2억 안인 모든 구역 — 곳 수에 드는 곳(ZP_ok)만 상세 '가능해요' · 빠지는 곳(추정·참고값)은 상세·검색·/z 모두 '추정 신뢰 낮아 목록에서 뺐어요'
  {
    const T = "한 판정: 2억에서 상세 '가능해요' ⇔ 곳 수에 듦(ZP_ok) · 추정 신뢰가 낮아 빠지는 곳은 상세·검색·/z가 같은 말 '추정 신뢰 낮아 목록에서 뺐어요'";
    const EX = "추정 신뢰 낮아 목록에서 뺐어요";
    const cand = api.zones.filter((z) => z.need && z.need.gap && z.need.gap.now != null && Math.ceil(z.need.gap.now * 100 - 1e-6) / 100 <= 2 + 1e-9).map((z) => z.id);
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      page.__where = "eligible /?cash=2";
      await page.goto(BASE + "/?cash=2&mode=jeonse", { waitUntil: "load" });
      await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1 && typeof window.ZP_ok === "function", null, { timeout: 20000 }).catch(() => {});
      await settle(page, 600);
      const got = await page.evaluate(async (ids) => {
        const out = {}, wait = (f, ms) => new Promise((ok) => { const s = performance.now(); const tick = () => { const v = f(); if (v || performance.now() - s > ms) ok(v); else requestAnimationFrame(tick); }; tick(); });
        const by = {}; (window.__ZPD && __ZPD.recs || []).forEach((r) => (by[r.id] = r));
        for (const id of ids) {
          const t = document.getElementById("repTitle"); if (t) t.__ec = 1;
          location.hash = "#" + id;
          await wait(() => { const e = document.getElementById("repTitle"); return e && !e.__ec && e.textContent.trim(); }, 4000);
          await new Promise((r) => setTimeout(r, 30));
          const vd = document.querySelector("#report .dt-k .dt-vd");
          out[id] = { ok: !!(by[id] && window.ZP_ok(by[id])), vd: vd ? vd.textContent.replace(/\s+/g, " ").trim() : "", now: ((document.querySelector('#report .dt-k [data-k="now"] .dt-v') || {}).textContent || "").trim() };
        }
        return out;
      }, cand);
      const bad1 = [], exIds = [];
      for (const [id, v] of Object.entries(got)) {
        const says = /가능해요/.test(v.vd);
        if (v.ok !== says) bad1.push(`${id} ok ${v.ok} vd "${v.vd}"`);
        if (!v.ok && v.now && v.now !== "계산 보류") { if (!v.vd.includes(EX) && !/더 필요/.test(v.vd)) bad1.push(`${id} excluded but vd "${v.vd}"`); if (v.vd.includes(EX)) exIds.push(id); }
      }
      expect(Object.keys(got).length === cand.length && !bad1.length, "zone.eligibleConsistent", T, `${cand.length} zones (need ≤ 2억) · ${bad1.length} differ: ${bad1.slice(0, 5).join(" ; ")}`);
      // 검색 배지(빠지는 곳 3곳까지)
      const sb = [];
      for (const id of exIds.slice(0, 3)) {
        const r = await page.evaluate(async ([id, EX]) => { const rec = (__ZPD.recs || []).find((x) => x.id === id); const q = document.getElementById("q"); if (!q || !rec) return "no q"; try { location.hash = ""; } catch (e) {} q.value = (window.ZP_shortName ? ZP_shortName(rec.n) : rec.n).slice(0, 12); q.dispatchEvent(new Event("input", { bubbles: true })); await new Promise((r) => setTimeout(r, 500)); const row = document.querySelector(`#sugg [data-id="${id}"]`); const t = row ? row.textContent.replace(/\s+/g, " ") : "row missing"; q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true })); return t; }, [id, EX]);
        if (r !== "row missing" && r !== "no q" && (!r.includes(EX) || /내 돈으로 가능/.test(r))) sb.push(`${id} search "${r.slice(0, 80)}"`);
      }
      // /z 페이지(빠지는 곳)
      const zb = [];
      for (const id of exIds) { const z = await getPage("/z/" + id); if (z.status === 200 && !z.text.includes(EX)) zb.push(id); }
      expect(!sb.length && !zb.length, "zone.eligibleConsistent", T, `excluded ${exIds.length} · search ${sb.join(" ; ")} · /z missing phrase ${zb.join(" ")}`);
    } catch (e) { bad("runtime", "검사 실행", "r26 eligible crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- desk.stickyEnd: PC 1440 · 맨 아래까지 내려도 붙은 지도와 겹쳐 보기 단추가 머리 아래(가리지 않음)
  {
    const T = "PC: 페이지 끝까지 내려도 지도 칸 위쪽·겹쳐 보기 단추가 머리 밑으로 들어가지 않음(웹 푸터는 왼쪽 칸 맨 아래)";
    for (const cs of ["light", "dark"]) {
      const { ctx, page } = await newPage(browser, { viewport: { width: 1440, height: 900 }, colorScheme: cs }, errs);
      try {
        page.__where = "stickyEnd " + cs;
        await loadHome(page); await settle(page, 600);
        const r = [];
        for (const y of [800, 99999]) {
          await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(500);
          r.push(await page.evaluate(() => { const h = document.getElementById("hdr").getBoundingClientRect().bottom, m = document.getElementById("mapbox").getBoundingClientRect(), rl = document.querySelector("#mapbox .s-rail"), b = rl ? rl.getBoundingClientRect() : null, f = document.querySelector(".site-foot"); return { hdr: Math.round(h), map: Math.round(m.top), rail: b ? Math.round(b.top) : null, end: Math.round(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2, foot: f ? f.getBoundingClientRect().height > 0 : false }; }));
        }
        expect(r.every((x) => x.map >= x.hdr - 1 && (x.rail == null || x.rail >= x.hdr)) && r[1].end && r[1].foot, "desk.stickyEnd", T, `${cs}: ${JSON.stringify(r)}`);
      } catch (e) { bad("runtime", "검사 실행", "r26 stickyEnd crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- ui.onboardKey: 첫 방문 카드가 떠 있을 때 키보드로 막대를 움직여도 칩처럼(카드 닫힘 · ?cash= · jg-cond 저장 · 다시 열어도 그 금액) · 기본 1억 칩 눌린 상태 · '나중에' 44px
  {
    const T = "첫 방문 카드: 키보드로 금액을 바꿔도 칩과 같이 닫히고 저장(?cash= · jg-cond · 다시 열면 그 금액) · 기본 1억 칩이 눌린 상태 · '나중에 ×' 44px 이상";
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });   // 27차: 폰 첫 방문은 칩 카드가 막대 대신(막대·사는 방식은 고른 뒤) — 키보드 막대는 넓은 화면에서 잰다
    try {
      await ctx.route(BLOCK, (r) => r.abort());
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errs.push({ where: "/ (onboardKey)", msg: "pageerror: " + (e.message || String(e)).split("\n")[0].slice(0, 200) }));
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1 && typeof window.ZP_count === "function", null, { timeout: 20000 }).catch(() => {});
      await page.evaluate(() => { try { window.ZP_boot && ZP_boot.quietNow && ZP_boot.quietNow(); } catch (e) {} });
      await settle(page, 600);
      const a = await page.evaluate(() => { const o = document.getElementById("onb"), b1 = o && o.querySelector('[data-oc="1"]'), x = o && o.querySelector("[data-olater]"); return { on: !!o && !o.hidden, p1: b1 ? b1.getAttribute("aria-pressed") : null, lh: x ? Math.round(x.getBoundingClientRect().height) : 0 }; });
      await page.focus("#sScrub"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(1400); await settle(page, 400);
      const b = await page.evaluate(() => ({ hidden: document.getElementById("onb").hidden, v: document.getElementById("sCashV").textContent.trim(), url: location.search, cond: localStorage.getItem("jg-cond") || "", onb: localStorage.getItem("zp.onb") }));
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(500);
      const c = await page.evaluate(() => ({ on: !document.getElementById("onb").hidden, v: document.getElementById("sCashV").textContent.trim() }));
      expect(a.on && a.p1 === "true" && a.lh >= 44 && b.hidden && b.v !== "1억" && /[?&]cash=/.test(b.url) && /cash=/.test(b.cond) && !c.on && c.v === b.v, "ui.onboardKey", T, `first ${JSON.stringify(a)} · after keys ${JSON.stringify(b)} · revisit ${JSON.stringify(c)}`);
    } catch (e) { bad("ui.onboardKey", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
}

// ================================================================ 27차(애드센스 3차 + 제품 3차 레드팀)
// fresh.cls · map.guLabels · gu.sumProse
// 이 기계가 바쁜 정도(가벼운 기준 일을 몇 번 재서 느려진 배수) — 긴 작업·프레임 검사의 기준을 그만큼만 늘리고 한 번 더 잰다(공유 기계에서 거짓 실패 막기)
async function cpuLoad(browser) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  try {
    const t = await page.evaluate(() => { const one = () => { const t0 = performance.now(); let x = 0; for (let i = 0; i < 3e6; i++) x += Math.sqrt(i); return performance.now() - t0 + (x < 0 ? 1 : 0); }; one(); const L = [one(), one(), one(), one(), one()].sort((a, b) => a - b); return L[2]; });
    return t;
  } catch (e) { return null; } finally { await ctx.close().catch(() => {}); }
}
let CPU0 = null;   // 첫 잰 값(조용할 때 기준 ≈ 이 기계 1배)
async function loadFactor(browser) {
  const t = await cpuLoad(browser);
  if (t == null) return 1;
  if (CPU0 == null || t < CPU0) CPU0 = Math.min(t, CPU0 == null ? t : CPU0);
  return Math.max(1, t / CPU0);
}
async function r27Lane(browser, api, errs) {
  const mob = (w, h, cs) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: cs || "light" });
  // --- fresh.cls: 처음 온 사람(저장된 것 없음 · ?cash= 없음) 홈의 레이아웃 밀림 합 < 0.02 (360·390·412) · 첫 화면에 구역 이름 3곳(이름 줄) · 지도가 아래 탭 위로 120px 이상 보임(360)
  {
    const T = "첫 방문(?cash= 없음) 홈: 레이아웃 밀림(CLS) < 0.02 · 첫 방문 카드가 있어도 구역 이름 줄이 첫 화면에 · 카드 줄 '1억이면 … N곳'(게이지와 겹침) 없음 · 360에서 지도가 탭 위로 120px 이상";
    for (const [w, h] of [[360, 740], [390, 844], [412, 823]]) {
      const ctx = await browser.newContext({ ...mob(w, h), serviceWorkers: "block" });
      try {
        await ctx.route(BLOCK, (r) => r.abort());
        await ctx.addInitScript(() => { window.__cls = 0; window.__clsS = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__clsS.push((e.sources || []).map((x) => (x.node && (x.node.id || x.node.className)) || "?").slice(0, 3).join(",") + " " + e.value.toFixed(3)); } }).observe({ type: "layout-shift", buffered: true }); } catch (e) {} });
        const page = await ctx.newPage();
        page.on("pageerror", (e) => errs.push({ where: "/ (fresh.cls)", msg: "pageerror: " + (e.message || String(e)).split("\n")[0].slice(0, 200) }));
        await page.goto(BASE + "/", { waitUntil: "load", timeout: 30000 });
        await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1, null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);
        const r = await page.evaluate(() => { const o = document.getElementById("onb"), s = document.getElementById("sSum"), m = document.getElementById("mapbox"), nav = document.getElementById("sNav"); const R = (e) => (e ? e.getBoundingClientRect() : null); const sr = R(s), mr = R(m), nr = R(nav);
          return { cls: +window.__cls.toFixed(4), src: window.__clsS.slice(0, 3), onb: !!o && !o.hidden && o.offsetHeight > 0, names: s ? s.querySelectorAll(".s-rail3 [data-id]").length : 0, namesIn: !!sr && sr.height > 0 && sr.bottom <= innerHeight, pv: !!document.getElementById("onbPv"), peek: mr && nr ? Math.round(nr.top - mr.top) : null }; });
        expect(r.cls < (w === 360 ? 0.005 : 0.02) && r.onb && r.names >= 1 && r.namesIn && !r.pv && (w !== 360 || (r.peek != null && r.peek >= 150)), "fresh.cls", T + " · 29차: 360은 CLS < 0.005 · 지도 150px 이상", `${w}: ${JSON.stringify(r)}`);
      } catch (e) { bad("fresh.cls", T, `${w} crashed: ` + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- map.guLabels: 구 화면(구 묶음을 누른 줌 ≈ 12.7)에 바탕 이름(동·역·구) 글자가 그려진다 · 서울 보기에서 묶음이 있는 구는 바탕 구 이름을 겹쳐 쓰지 않는다
  {
    const T = "구 화면(줌 11~13.5): 동·역·구 이름 글자가 4개 이상 그려짐(밝게·어둡게) · 서울 보기: 묶음('강북 1곳')이 있는 구는 바탕 구 이름을 따로 안 씀";
    for (const cs of ["light", "dark"]) {
      const { ctx, page } = await newPage(browser, mob(390, 844, cs), errs);
      try {
        page.__where = "guLabels " + cs;
        await page.goto(BASE + `/?cash=2&mode=jeonse&qac=${++LOADS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1, null, { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => { try { ZP_boot.quietNow && ZP_boot.quietNow(); } catch (e) {} });
        await page.waitForFunction(() => window.ZP_lmx && ZP_lmx.map() && ZP_lmx.gus().length && !(window.ZP_G && ZP_G.on()), null, { timeout: 40000, polling: 200 }).catch(() => {});
        await page.evaluate(() => { const m = document.getElementById("mapbox"); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 60); });
        await page.waitForTimeout(800);
        const sv = await page.evaluate(() => { const m = ZP_lmx.map(), names = new Set([...document.querySelectorAll("#lmap .zgu")].map((e) => e.dataset.gu)); const lab = m.getLayer("gu-lab") ? m.queryRenderedFeatures({ layers: ["gu-lab"] }).map((f) => f.properties.n) : []; return { bub: names.size, dup: lab.filter((n) => names.has(n)) }; });
        await page.evaluate(() => { const e = [...document.querySelectorAll("#lmap .zgu")].sort((a, b) => +b.dataset.n - +a.dataset.n)[0]; if (e) e.click(); });
        await page.waitForFunction(() => document.getElementById("mapbox").dataset.view === "gu" && !ZP_lmx.map().isMoving(), null, { timeout: 15000, polling: 200 }).catch(() => {});
        await page.waitForTimeout(1500);
        const r = await page.evaluate(() => { const m = ZP_lmx.map(), o = { z: +m.getZoom().toFixed(2), gu: document.getElementById("mapbox").dataset.gu }; let n = 0; for (const id of ["gu-lab", "dong-lab", "stn-mj-lab", "stn-mid-lab", "place"]) { const k = m.getLayer(id) ? m.queryRenderedFeatures({ layers: [id] }).length : 0; o[id] = k; n += k; } o.n = n; return o; });
        expect(r.z >= 11 && r.z <= 14 && r.n >= 4 && !sv.dup.length, "map.guLabels", T, `${cs}: seoul bubbles ${sv.bub} dup base names ${sv.dup.join(",")} · gu view ${JSON.stringify(r)}`);
      } catch (e) { bad("map.guLabels", T, `${cs} crashed: ` + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
}
// --- gu.sumProse(정적): /gu 25곳 해설 문단의 숫자 합 — 사업 종류 합 == 전체 · '나온 곳 N' + '나머지 M' == 전체 · 내역 합 == M('모두 N곳'이면 N) · 내역 == 아래 표의 빈칸 이유 갈래 수 · 5곳 미만이면 서울 견주기 없음
async function guProse() {
  const T = "/gu 해설 문단: 사업 종류 합·'나온 곳'+'나머지'·이유 내역 합이 전체 곳 수와 맞음 · 내역 = 아래 표 갈래 · 계산되는 곳 5곳 미만이면 서울 견주기 문장 없음 · 앞에 센 곳 없으면 '나머지' 대신 '모두'";
  const idx = await getPage("/gu/");
  const gus = [...new Set([...(idx.text || "").matchAll(/href="(?:\.\.\/gu\/|\/gu\/|\.\/)?([가-힣]+구)"/g)].map((m) => m[1]))];
  if (gus.length < 25) { bad("gu.sumProse", T, `/gu/ index lists ${gus.length} gu`); return; }
  const WHY = { 토지거래허가구역: "토허제", "이주·철거로 세입자 없음": "세입자 없음", "입주권 없음": "입주권 없음", "입주권 판정 보류": "판정 보류", "계산 대상 아님": "대상 아님", "매수가·전세 자료 부족": "자료 부족" };
  for (const g of gus) {
    const r = await getPage("/gu/" + g);
    const p = htmlText(((/<p class="gnote">([\s\S]*?)<\/p>/.exec(r.text || "") || [])[1]) || "");
    const N = +(((/<h1>[^<]*?([\d,]+)곳<\/h1>/.exec(r.text || "") || [])[1]) || "0").replace(/,/g, "");
    const errs2 = [];
    if (!p || !N) { bad("gu.sumProse", T, `${g}: no gnote/h1 (${r.status})`); continue; }
    const kinds = /정비사업 ([\d,]+)곳은 모두 /.exec(p) || /정비사업 ([\d,]+)곳은 (.*?)이에요\./.exec(p);
    if (!kinds || +kinds[1].replace(/,/g, "") !== N) errs2.push(`intro total ${kinds && kinds[1]} vs h1 ${N}`);
    else if (kinds[2]) { const s = [...kinds[2].matchAll(/([\d,]+)곳/g)].reduce((a, m) => a + +m[1].replace(/,/g, ""), 0); if (s !== N) errs2.push(`kinds sum ${s} ≠ ${N}`); }
    if (/나머지/.test(p) && !/나온 곳은/.test(p)) errs2.push("'나머지' without a preceding count");
    const got = /나온 곳은 ([\d,]+)곳/.exec(p), rest = /나머지 ([\d,]+)곳은 아직 계산하지 않았어요: ([^.]*)\./.exec(p), all = /([\d,]+)곳 모두 전세 끼고 지금 필요한 돈은 아직 계산하지 않았어요: ([^.]*)\./.exec(p);
    if (/비어 있어요/.test(p)) errs2.push("'비어 있어요' (→ 아직 계산하지 않았어요)");
    const tbl = {}; [...(r.text || "").matchAll(/class="gr-v gr-na"><i>전세 끼고<\/i> <b class="gr-now">([^<]+?)(?:<sup>\*<\/sup>)?<\/b>/g)].forEach((m) => (tbl[m[1]] = (tbl[m[1]] || 0) + 1));
    const tN = Object.values(tbl).reduce((a, b) => a + b, 0);
    const part = (txt) => { const o = {}; [...txt.matchAll(/([^,]+?) ([\d,]+)곳/g)].forEach((m) => { const k = WHY[m[1].trim()] || m[1].trim(); o[k] = (o[k] || 0) + +m[2].replace(/,/g, ""); }); return o; };
    if (all) { const o = part(all[2]), s = Object.values(o).reduce((a, b) => a + b, 0); if (+all[1] !== N || s !== N) errs2.push(`모두 ${all[1]} / sum ${s} vs ${N}`); if (JSON.stringify(Object.entries(o).sort()) !== JSON.stringify(Object.entries(tbl).sort())) errs2.push(`breakdown ${JSON.stringify(o)} vs table ${JSON.stringify(tbl)}`); }
    else if (got) {
      const k = +got[1].replace(/,/g, ""), m = rest ? +rest[1].replace(/,/g, "") : 0;
      if (k + m !== N) errs2.push(`나온 ${k} + 나머지 ${m} ≠ ${N}`);
      if (rest) { const o = part(rest[2]), s = Object.values(o).reduce((a, b) => a + b, 0); if (s !== m) errs2.push(`나머지 ${m} vs breakdown sum ${s}`); if (JSON.stringify(Object.entries(o).sort()) !== JSON.stringify(Object.entries(tbl).sort())) errs2.push(`breakdown ${JSON.stringify(o)} vs table ${JSON.stringify(tbl)}`); }
      else if (tN) errs2.push(`table has ${tN} blank rows but no 나머지`);
      const cmp = /서울 전체 가운데 값/.test(p), base = /참고값을 뺀 ([\d,]+)곳/.exec(p), nOk = base ? +base[1] : k;
      if (cmp && nOk < 5) errs2.push(`compares with Seoul on ${nOk} zones (<5)`);
    } else errs2.push("no 나온 곳/모두 sentence");
    expect(!errs2.length, "gu.sumProse", T, `${g}: ${errs2.join(" ; ")} · "${p.slice(0, 140)}"`);
  }
}
// ================================================================ 29차(애드센스·제품 5차 레드팀)
async function r29Lane(browser, api, errs) {
  const mob = (w, h, cs) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: cs || "light" });
  // --- a11y.headContrast: 축 다섯 화면(홈 · 상세 시트 · /z · /gu · MY) 밝게·어둡게 — 보이는 h1·h2 글자 대비 4.5:1(큰 글자 3:1) · axe-core가 있으면 color-contrast 'serious' 0
  {
    const T = "홈·상세·/z·/gu·MY(밝게·어둡게): 보이는 h1·h2 글자 대비 4.5:1(큰 글자 3:1) · axe color-contrast 심각 0(axe-core 있을 때) — 5차: 어두운 홈 h1 1.16:1";
    let AXE = null; try { const ap = process.env.AXE_PATH || require.resolve("axe-core/axe.min.js"); AXE = fs.readFileSync(ap, "utf8"); } catch (e) {}
    const SCR = [["/", ""], ["/?cash=2&mode=jeonse", "#o337"], ["/z/o916.html", ""], ["/gu/" + "구로구.html", ""], ["/?cash=2", "#my"]];
    for (const cs of ["light", "dark"]) for (const [u, h] of SCR) {
      const { ctx, page } = await newPage(browser, mob(390, 844, cs), errs);
      try {
        page.__where = `headContrast ${cs} ${u}${h}`;
        await page.goto(BASE + encodeURI(u) + (u.includes("?") ? "&" : "?") + "qac=" + (++LOADS) + h, { waitUntil: "load", timeout: 30000 });
        await page.waitForFunction(() => !window.ZP_boot || window.ZP_boot.hyd === 1, null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const c = await page.evaluate(CONTRAST_JS, "h1, h2");
        expect(!c.length, "a11y.headContrast", T, `${cs} ${u}${h}: ${c.length} low: ${c.slice(0, 4).join(" ; ")}`);
        if (AXE) {
          await page.addScriptTag({ content: AXE });
          const v = await page.evaluate(async () => { const r = await window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast"] }, resultTypes: ["violations"] }); return r.violations.filter((x) => x.impact === "serious" || x.impact === "critical").flatMap((x) => x.nodes.map((n) => n.target.join(" ") + " " + ((n.any[0] || {}).message || "").slice(0, 60))); });
          const hv = v.filter((t) => /(^|[\s>])h[12]\b|s-site|#sSite/.test(t));
          expect(!hv.length, "a11y.headContrast", T, `${cs} ${u}${h}: axe ${hv.length}: ${hv.slice(0, 3).join(" ; ")}`);
          if (v.length) wrn("a11y.headContrast", T, `${cs} ${u}${h}: axe color-contrast (h1·h2 밖) ${v.length}: ${v.slice(0, 2).join(" ; ")}`);
        } else skip("a11y.headContrast", T, "axe-core 없음(AXE_PATH) — 대비 계산만");
      } catch (e) { bad("a11y.headContrast", T, `${cs} ${u}${h} crashed: ` + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- home.h1Slot: 홈 h1이 첫 페인트부터 제자리(폰: 검색 위 · PC: 왼쪽 칸 맨 위 · 둘 다 읽을거리 줄 위) · 18~22px · 아래 카드와 겹치지 않음 · 첫 방문 카드 질문이 h1을 되풀이하지 않음
  {
    const T = "홈 h1: 읽을거리 줄 위 · 폰 18~20px/PC 22px · 다른 요소와 겹치지 않음 · 첫 방문 카드 질문 ≠ h1 말";
    for (const [w, h] of [[360, 740], [390, 844], [1440, 900]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900, serviceWorkers: "block" });
      try {
        await ctx.route(BLOCK, (r) => r.abort());
        const page = await ctx.newPage();
        await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
        const first = await page.evaluate(() => { const a = document.getElementById("sSite"), b = document.getElementById("sRd"); return a && b ? [Math.round(a.getBoundingClientRect().bottom), Math.round(b.getBoundingClientRect().top)] : null; });
        await page.waitForFunction(() => window.ZP_boot && window.ZP_boot.hyd === 1, null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const r = await page.evaluate(() => { const a = document.getElementById("sSite"), b = document.getElementById("sRd"), q = document.getElementById("onbQ1"); if (!a || !b) return null; const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); const hit = (x, y) => { const e = document.elementFromPoint(x, y); return !e || e === a || a.contains(e); }; return { above: A.bottom <= B.top + 0.5, fs: parseFloat(getComputedStyle(a).fontSize), clear: hit(A.left + 6, A.top + A.height * 0.75) && hit(A.left + Math.min(A.width - 6, 120), A.bottom - 3), q: q ? q.textContent.trim() : "", h1: a.textContent.trim(), first: null }; });
        const okFs = r && (w > 980 ? r.fs >= 21.5 && r.fs <= 22.5 : r.fs >= 17.5 && r.fs <= 20.5);
        const rep = r && r.q && /내 돈으로 갈 수 있는/.test(r.q);
        expect(!!r && r.above && okFs && r.clear && !rep && !!first && first[0] <= first[1] + 0.5, "home.h1Slot", T, `${w}: ${JSON.stringify(r)} first-paint h1.bottom/sRd.top ${JSON.stringify(first)}`);
      } catch (e) { bad("home.h1Slot", T, `${w} crashed: ` + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- seo.dateAgree: 사이트맵의 모든 주소 — 구조화 데이터 dateModified == 사이트맵 lastmod(한 날짜 출처)
  {
    const T = "사이트맵 모든 주소: JSON-LD dateModified == sitemap lastmod (본문 해시가 바뀐 날 하나)";
    const sm = await get(BASE + "/sitemap.xml");
    const U = [...(sm.text || "").matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((m) => [decodeURIComponent(new URL(m[1]).pathname), m[2]]);
    if (U.length < 20) bad("seo.dateAgree", T, `sitemap has ${U.length} urls`);
    let n = 0;
    for (const [u, d] of U) {
      const r = await getPage(u);
      const ds = [...(r.text || "").matchAll(/"dateModified":\s*"(\d{4}-\d\d-\d\d)/g)].map((m) => m[1]);
      if (!ds.length) continue;
      n++;
      const badD = ds.filter((x) => x !== d);
      expect(!badD.length, "seo.dateAgree", T, `${u}: lastmod ${d} vs dateModified ${[...new Set(ds)].join(",")}`);
    }
    if (!n) bad("seo.dateAgree", T, "no page with dateModified");
  }
  // --- name.generic: 구역 짧은 이름이 동·구·도시 이름 한 낱말뿐이 아님(서울 · 상도 · 월계동 · 용답동 …)
  {
    const T = "구역 짧은 이름(API name = 화면 shortName)이 동·구·도시 이름 한 낱말뿐이 아님";
    const GU = new Set(), DONG = new Set();
    for (const z of api.zones) { if (z.gu) { GU.add(z.gu); GU.add(z.gu.replace(/구$/, "")); } const d = String(z.dong || (z.jibun || "").split(" ")[0] || ""); if (/동$/.test(d)) { DONG.add(d); DONG.add(d.replace(/\d*동$/, "")); } }
    const gen = (n) => !/\s/.test(n) && (n === "서울" || GU.has(n) || DONG.has(n) || /^[가-힣]{1,3}동$/.test(n));
    const badN = api.zones.filter((z) => z.name && gen(z.name)).map((z) => `${z.id} "${z.name}"`);
    expect(!badN.length, "name.generic", T, `${badN.length}: ${badN.slice(0, 8).join(", ")}`);
  }
  // --- gu.unitsScope: /gu '세대수가 가장 많은 곳' 문장은 '세대수 자료가 있는 N곳 가운데'처럼 범위를 밝힘
  {
    const T = "/gu 해설 '세대수가 가장 많은 곳'은 범위(구 전체 N곳 또는 세대수 자료가 있는 N곳)를 밝힘";
    const idx = await getPage("/gu/");
    const gus = [...new Set([...(idx.text || "").matchAll(/href="(?:\.\.\/gu\/|\/gu\/|\.\/)?([가-힣]+구)"/g)].map((m) => m[1]))];
    let seen = 0;
    for (const g of gus) {
      const r = await getPage("/gu/" + g);
      const p = htmlText(((/<p class="gnote">([\s\S]*?)<\/p>/.exec(r.text || "") || [])[1]) || "");
      const m = /[^.]*세대수가 가장 많은 곳[^.]*\./.exec(p);
      if (m) { seen++; expect(/자료가 있는 [\d,]+곳 가운데|구역 [\d,]+곳 가운데/.test(m[0]), "gu.unitsScope", T, `${g}: "${m[0]}"`); }
    }
    if (!seen) skip("gu.unitsScope", T, `${gus.length}개 구 모두 세대수 문장 없음`);
  }
}
// ================================================================ 30차(애드센스·제품 6차 레드팀)
// 계산식 한 줄(대출 끼고 · 전세 끼고 ①②③)을 '보이는 칸'으로 다시 더한다: 괄호 안 설명은 빼고, 마지막 '=' 앞 칸들의 ± 합 == '=' 뒤 값(정확한 만 원)
function flowSegs(txt) {
  const out = [];
  const segs = String(txt || "").replace(/\([^()]*\)/g, " ").split(/\s·\s(?=[①②③])/);
  for (const sg of segs) {
    const i = sg.lastIndexOf("=");
    if (i < 0) continue;
    const rhs = money(sg.slice(i + 1).trim().split(/\s{2,}/)[0]);
    let lhs = sg.slice(0, i); const j = lhs.lastIndexOf("="); if (j >= 0) lhs = lhs.slice(j + 1);
    let sum = 0, n = 0;
    for (const m of lhs.matchAll(/([+−-])?\s*[^\d+−-]*?((?:\d[\d,]*억(?:\s*[\d,]+만)?)|(?:[\d,]+만)|(?:0원))/g)) { const v = money(m[2]); if (!v) continue; sum += (m[1] === "−" || m[1] === "-" ? -1 : 1) * v.v; n++; }
    out.push({ seg: sg.trim().slice(0, 160), n, sum: Math.round(sum * 1e4), rhs: rhs ? Math.round(rhs.v * 1e4) : null });
  }
  return out;
}
async function r30Lane(browser, api, errs) {
  const mob = (w, h) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const goZone = async (page, id, cash, mode) => {
    page.__where = `r30 #${id} ${mode} ${cash}`;
    await page.goto(`${BASE}/?cash=${cash}&mode=${mode}&qac=${++LOADS}#${id}`, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => !!document.querySelector("#report .dt-k"), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(900);
  };
  // --- count.guStrip: 구를 고른 동안 이름 줄 카드 수 + '외 N곳' == 큰 숫자(그 구 곳 수) == 목록 제목 곳 수 (2억 · 1억, 구 여러 개)
  {
    const T = "구 화면: 이름 줄 카드 + '외 N곳' == 큰 숫자(그 구 곳 수) == 목록 제목 '구 · N곳' (2억·1억 · 구 4곳까지) — 6차: '구로구 3곳' 밑 '외 51곳'";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      await loadHome(page); await settle(page, 500);
      let seen = 0;
      for (const c of [2, 1]) {
        await setCash(page, c);
        const gus = await page.evaluate(() => Object.entries(window.ZP_simple.guCounts()).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([g]) => g));
        let done = 0;
        for (const g of gus) {
          if (done >= 4) break;
          await page.evaluate(() => { const x = document.getElementById("sGuX"); if (x) x.click(); }); await page.waitForTimeout(500);
          const hit = await page.evaluate((g) => { const m = document.getElementById("mapbox"); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 70); const b = document.querySelector(`.zgu[data-gu="${g}"]`); if (!b) return false; b.click(); return true; }, g);
          if (!hit) continue;
          await page.waitForTimeout(1300); await settle(page, 300);
          const r = await page.evaluate(() => ({ n: +document.getElementById("sN").textContent.replace(/,/g, ""), lt: document.getElementById("sLT").textContent, cards: document.querySelectorAll("#sSum .s-rail3 li:not(.s-rmore)").length, more: (document.querySelector("#sSum .s-rmore b") || {}).textContent || "", gu: !!document.getElementById("sGuX") && !document.getElementById("sGu").hidden }));
          if (!r.gu) continue;
          done++; seen++;
          const m = intOf(r.more) || 0;
          expect(r.cards + m === r.n && cntOf(r.lt) === r.n && (r.n > 3 || !r.more), "count.guStrip", T, `${c}억 ${g}: cards ${r.cards} + 외 ${m} vs big ${r.n} · title "${r.lt}"`);
        }
      }
      if (!seen) bad("count.guStrip", T, "구 묶음을 하나도 누르지 못함");
    } catch (e) { bad("count.guStrip", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- zone.flowSum: 계산식 한 줄(대출 끼고 · 전세 끼고 ①②③)과 '들어가는 돈 합계' 칸 — 보이는 칸을 더하면 보이는 결과(정확한 만 원) · 머리 숫자와는 0.1억 안
  //     전세 ① 매수가 == 머리(dt-s) 매수가(올려 쓰지 않음) · '합이 조금 다를 수 있어요' 같은 핑계 없음
  {
    const T = "계산식 한 줄과 합계 칸: 보이는 칸의 합 == 보이는 결과(만 원까지) · 머리 '입주까지 현금'과 0.1억 안 · 전세 ① 매수가 == 머리 매수가 · '합이 조금 다를' 없음 (두 방식 · 여러 구역)";
    const pool = api.zones.filter((z) => z.need.gap.total != null && z.need.cash.total != null && z.membership && z.membership.status === "ok").map((z) => z.id);
    const ids = ["o337", "o332", "o1070"].filter((i) => api.zones.some((z) => z.id === i)).concat(pool.filter((i) => !["o337", "o332", "o1070"].includes(i)).slice(0, 3));
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      for (const id of ids) for (const mode of ["loan", "jeonse"]) {
        await goZone(page, id, 2, mode);
        const r = await page.evaluate(() => {
          const p = document.getElementById("pane") || document; const fl = p.querySelector("details.flow p");
          const tot = p.querySelector(".fx-tot dd"), big = p.querySelector(".bigrow .big.cash b");
          const hero = [...document.querySelectorAll("#report .dt-k .dt-s")].map((e) => e.textContent).join(" | ");
          const cards = [...p.querySelectorAll(".bigrow .big")].filter((e) => !e.closest("[hidden]")).map((e) => ({ k: (e.querySelector("span") || {}).textContent || "", b: (e.querySelector("b") || {}).textContent || "", sm: (e.querySelector("small") || {}).textContent || "" }));
          const br = [...p.querySelectorAll(".cash-brw:not([hidden]) .cash-br, .gpane .cash-br")].map((e) => e.textContent.replace(/\s+/g, " "));
          return { flow: fl ? fl.textContent.replace(/\s+/g, " ") : "", tot: tot ? [tot.firstChild ? tot.firstChild.textContent : "", (tot.querySelector("small") || {}).textContent || ""] : null, big: big ? big.textContent : "", hero, all: (p.innerText || ""), cards, br };
        });
        if (!r.flow) { wrn("zone.flowSum", T, `${id} ${mode}: no 계산식`); continue; }
        expect(!/합이 조금 다를/.test(r.all), "zone.flowSum", T, `${id} ${mode}: '합이 조금 다를 수 있어요'`);
        const S = flowSegs(r.flow);
        expect(S.length >= (mode === "jeonse" ? 3 : 1), "zone.flowSum", T, `${id} ${mode}: ${S.length} segments in "${r.flow.slice(0, 120)}"`);
        for (const s of S) expect(s.n >= 2 && s.rhs != null && s.sum === s.rhs, "zone.flowSum", T, `${id} ${mode}: ${s.n} terms sum ${s.sum}만 vs shown ${s.rhs}만 · "${s.seg}"`);
        const last = S[S.length - 1], head = money(r.big);
        if (last && head && last.rhs != null) expect(Math.abs(last.rhs / 1e4 - head.v) <= 0.0501 + head.tol, "zone.flowSum", T, `${id} ${mode}: flow total ${last.rhs}만 vs head "${r.big}"`);
        // 7차: 큰 칸(입주까지 현금 · 추가 분담금) == 계산식 칸을 0.1억 반올림한 값(엔진 needTotal·g.total과 같은 규칙) · 그 말도 '반올림' · '지금'은 화면 올림이라 '올림'(맞춘 값이라 쓰지 않음) · 다리 줄 칸의 합 == 결과 == 계산식 결과
        const r1 = (m) => Math.round(m / 1e3) / 10;
        expect(!/단위로 맞춘 값|단위 올림\(입주까지/.test(r.flow + " " + r.cards.map((c) => c.sm).join(" ")) && !/입주까지 현금 [^()]*(?<!반)올림한 값/.test(r.flow), "zone.flowSum", T, `${id} ${mode}: 반올림·올림 말이 실제 규칙과 다름 · "${r.flow.slice(-120)}"`);
        const cc = r.cards.find((c) => /입주까지 현금/.test(c.k));
        if (cc && last && last.rhs != null) expect([-1, 0, 1].some((d) => zfCash(r1(last.rhs + d)) === cc.b.trim()), "zone.flowSum", T, `${id} ${mode}: 큰 칸 '${cc.k} ${cc.b}' vs 계산식 ${last.rhs}만 반올림 ${zfCash(r1(last.rhs))}`);
        const cb = r.cards.find((c) => /추가 분담금/.test(c.k)), fc = /분담금 ((?:\d[\d,]*억)?\s*(?:[\d,]+만)?)/.exec(r.flow);
        if (cb && fc && money(fc[1])) { const v = Math.round(money(fc[1]).v * 1e4), bv = money(cb.b); expect(bv && (v < 1e4 ? Math.abs(bv.v * 1e4 - v) < 0.5 : Math.abs(bv.v - r1(v)) < 1e-6) && (cb.b.replace(/\s/g, "") === fc[1].replace(/\s/g, "") || /반올림/.test(cb.sm)), "zone.flowSum", T, `${id} ${mode}: 추가 분담금 '${cb.b}' (${cb.sm.slice(-50)}) vs 계산식 분담금 ${fc[1]}`); }
        for (const b0 of r.br) { const b = b0.replace(/= 입주까지 현금 \S+ \(([^)·]+?)(?: · [^)]*)?\)/, "= 입주까지 현금 $1"); const sg = flowSegs(b.replace(/^입주까지 들어가는 돈|^지금/, "").replace(/= 입주까지 현금/, "=").replace(/− 입주 잔금대출/, "−").replace(/\+ 이주 때/, "+"))[0]; expect(sg && sg.n >= 2 && sg.sum === sg.rhs && (!last || last.rhs == null || Math.abs(sg.rhs - last.rhs) <= 2 || /이주 때/.test(b)), "zone.flowSum", T, `${id} ${mode}: 다리 줄 "${b}" 합 ${sg && sg.sum} vs ${sg && sg.rhs} · 계산식 ${last && last.rhs}`); }
        if (r.tot && r.tot[1]) { const t = flowSegs(r.tot[1].split(" · ")[0] + " = " + r.tot[0])[0]; expect(t && t.sum === t.rhs, "zone.flowSum", T, `${id} ${mode}: 합계 "${r.tot[0]}" vs 칸 "${r.tot[1].slice(0, 100)}"`); }
        if (mode === "jeonse") { const a = /매수가 ([\d,억만 ]+?)\s*[+−]/.exec(r.flow), b = /매수가 ([\d,억만 ]+?)\s*−/.exec(r.hero); if (a && b) expect(money(a[1]) && money(b[1]) && Math.abs(money(a[1]).v - money(b[1]).v) < 0.00011, "zone.flowSum", T, `${id}: 계산식 매수가 "${a[1]}" vs 머리 "${b[1]}"`); }
      }
    } catch (e) { bad("zone.flowSum", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- zone.blockVerdict: 전세 끼고는 못 사는 곳(토허 등)도 대출 끼고 값에 판정 한 줄 · '대출 끼고'를 한 칸에 두 번 쓰지 않음
  {
    const T = "전세 끼고 못 사는 곳(전세 모드): '지금' 칸에 판정(더 필요해요/내 돈 안) · 입주까지 칸에 '대출 끼고' 한 번만 — 6차 #o1173";
    const z = api.zones.filter((x) => x.need.gap.blocked && /^전세 낀 매수 불가/.test(x.need.gap.blocked) && x.need.cash.now != null && x.need.cash.total != null && !x.lowConfidence).slice(0, 2);
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      for (const x of z) {
        await goZone(page, x.id, 2, "jeonse");
        const r = await page.evaluate(() => { const g = (k) => document.querySelector(`#report .dt-k .dt-i[data-k="${k}"]`); const n = g("now"), t = g("tot"); return { vd: n ? (n.querySelector(".dt-vd") || {}).textContent || "" : "", now: n ? n.innerText.replace(/\s+/g, " ") : "", tot: t ? t.innerText.replace(/\s+/g, " ") : "" }; });
        expect(/더 필요해요|내 돈 .* 안이에요/.test(r.vd) && (r.tot.match(/대출 끼고/g) || []).length <= 1 && (r.now.match(/대출 끼고/g) || []).length <= 1 && /더 필요해요|안이에요/.test(r.tot), "zone.blockVerdict", T, `${x.id}: verdict "${r.vd}" · now "${r.now}" · tot "${r.tot}"`);
      }
      if (!z.length) skip("zone.blockVerdict", T, "no blocked zone");
    } catch (e) { bad("zone.blockVerdict", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- term.short: 모자란 돈 말 한 규칙 — 짧은 꼬리표(목록 줄·지도 알약·검색 배지·머리 칸 작은 글)는 'N 부족', 문장(상세 판정 줄)은 'N 더 필요해요'
  {
    const T = "모자란 돈: 꼬리표(목록·알약·검색 배지)는 'N 부족' · 상세 판정 문장(.dt-vd)은 'N 더 필요해요' — 섞어 쓰지 않음";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      await loadHome(page); await settle(page, 400); await setCash(page, 1);
      const L = await page.evaluate(() => [...document.querySelectorAll("#sList li.s-card, .zpill")].map((e) => e.innerText.replace(/\s+/g, " ")).filter((t) => /필요해요|부족/.test(t)));
      expect(!L.some((t) => /더 필요해요/.test(t)), "term.short", T, `list/pill: ${L.filter((t) => /더 필요해요/.test(t)).slice(0, 2).join(" ; ")}`);
      await goZone(page, "o337", 1, "loan");
      const V = await page.evaluate(() => [...document.querySelectorAll("#report .dt-vd")].map((e) => e.textContent));
      expect(V.length && V.every((t) => !/부족/.test(t)) && V.some((t) => /더 필요해요/.test(t)), "term.short", T, `detail verdicts: ${V.join(" ; ")}`);
    } catch (e) { bad("term.short", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- ui.r30Layout: 360 '+N곳' 칩이 레이어 막대에 가리지 않음 · 구 묶음 글자 ≥ 11px · 폰 묶음이 제 구 중심에서 48px 넘게 비키지 않음 ·
  //     '+N곳' 펼친 목록은 적게 드는 구부터, 금액 한 줄 · 상세 시트 붙는 탭 줄과 머리 줄 사이 틈 ≤ 1px · 오프라인 알약이 시트 아래 단추를 가리지 않음
  {
    const T = "360 칩 안 가림 · 묶음 글자 ≥11px · 묶음 제자리(≤48px · 다른 구 중심보다 가깝지 않음) · 묶음 사이 ≥2px · 가장 싼 구는 지도에 · +N 목록 싼 순·한 줄·지도 칸 안 · 시트 탭 틈 ≤1px · 오프라인 알약 ↔ 시트 단추 안 겹침 — 7차: 마포 묶음이 강서 땅에";
    for (const w of [360, 390]) {
      const { ctx, page } = await newPage(browser, mob(w, w === 360 ? 740 : 844), errs);
      try {
        await loadHome(page); await settle(page, 500);
        for (const c of [7.5, 15]) {
          await setCash(page, c);
          await page.evaluate(() => { const m = document.getElementById("mapbox"); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 70); });
          await page.waitForTimeout(2500);
          const r = await page.evaluate(() => {
            const fs = [...document.querySelectorAll(".zgu b, .zgu span")].filter((e) => e.getClientRects().length && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize));
            const offs = window.ZP_lmx && window.ZP_lmx.gus ? window.ZP_lmx.gus().map((g) => [g.n, g.off, g.dOther, g.other, g.at]) : [];
            const vis = (e) => { const r = e.getBoundingClientRect(); if (!e.classList.contains("sm")) return r; const cs = getComputedStyle(e, "::before"), w = parseFloat(cs.width) || r.width, h = parseFloat(cs.height) || r.height, cx = r.left + r.width / 2, cy = r.top + r.height / 2; return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 }; };
            const P = [...document.querySelectorAll("#lmap .zgu")].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden").map((e) => ({ n: e.dataset.gu, r: vis(e), m: +e.dataset.m }));
            let gap = Infinity, gp = "";
            for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a = P[i].r, b = P[j].r, sep = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom); if (sep < gap) { gap = sep; gp = P[i].n + "×" + P[j].n; } }
            const mapB = document.getElementById("lmap").getBoundingClientRect(), nav = document.getElementById("sNav"), vb = Math.min(mapB.bottom, innerHeight - (nav && nav.offsetHeight && getComputedStyle(nav).position === "fixed" ? nav.offsetHeight : 0));
            let fit = null;
            const ch = [...document.querySelectorAll(".lm-gumore")].find((e) => !e.hidden && e.getClientRects().length);
            let cov = null, list = null;
            if (ch) {
              const b = ch.querySelector(".lm-gumore-b").getBoundingClientRect();
              const pts = [[b.right - 4, b.top + b.height / 2], [b.left + 6, b.top + b.height / 2]];
              cov = pts.filter(([x, y]) => { const e = document.elementFromPoint(x, y); return !(e && e.closest(".lm-gumore")); }).length;
              ch.querySelector(".lm-gumore-b").click();
              { const lb = ch.querySelector(".lm-gumore-l").getBoundingClientRect(); fit = [Math.round(lb.top), Math.round(lb.bottom), Math.round(Math.max(mapB.top, 0)), Math.round(vb)]; }
              const li = [...ch.querySelectorAll(".lm-gumore-l li button")];
              list = li.map((x) => { const m = x.querySelector(".gm-m"); return { t: x.textContent, h: m ? m.getBoundingClientRect().height : 0, lh: m ? parseFloat(getComputedStyle(m).fontSize) * 1.6 : 99 }; });
              ch.querySelector(".lm-gumore-b").click();
            }
            return { min: fs.length ? Math.min(...fs) : null, offs, cov, list, gap: Math.round(gap * 10) / 10, gp, pms: P.map((p) => p.m).filter(isFinite), fit };
          });
          if (r.min != null) expect(r.min >= 10.99, "ui.r30Layout", T, `${w} ${c}억: 구 묶음 글자 ${r.min}px`);
          // 8차: 48px 넘게(띠·버튼 밑 구만 72px까지) 비킨 묶음은 가운데 점이 제 구 땅 안 · 어느 묶음이든 가운데 점이 다른 구 땅 위면 안 됨
          const far = r.offs.filter(([n, o, dO, , at]) => o > 72.5 || (o > 48.5 && at !== n) || (o > 0 && o <= 48.5 && o > dO + 10.5));
          expect(!far.length, "ui.r30Layout", T, `${w} ${c}억: 제 구에서 먼(>48px · 72px 안이면 제 구 땅 안) · 다른 구 중심이 더 가까운 묶음 ${far.map(([n, o, dO, on, at]) => `${n} ${o}px (${on} ${dO}px · 가운데 ${at || "서울 밖"})`).join(", ")}`);
          const onOther = r.offs.filter(([n, , , , at]) => at && at !== n);
          expect(!onOther.length, "ui.r30Layout", T, `${w} ${c}억: 묶음 가운데 점이 이웃 구 땅 위 ${onOther.map(([n, o, , , at]) => `${n}→${at} ${o}px`).join(", ")}`);
          if (isFinite(r.gap)) expect(r.gap >= 1.95, "ui.r30Layout", T, `${w} ${c}억: 묶음 사이 ${r.gap}px (${r.gp})`);
          if (r.fit) expect(r.fit[0] >= r.fit[2] - 1 && r.fit[1] <= r.fit[3] + 1, "ui.r30Layout", T, `${w} ${c}억: +N 목록 ${r.fit[0]}–${r.fit[1]} vs 보이는 지도 ${r.fit[2]}–${r.fit[3]}`);
          if (r.cov != null) expect(r.cov === 0, "ui.r30Layout", T, `${w} ${c}억: '+N곳' 칩 가림 ${r.cov}/2 점`);
          if (r.list && r.list.length) {
            const v = r.list.map((x) => { const m = /곳\s*([\d,.]+(?:억|만))~/.exec(x.t); return m ? money(m[1]).v : Infinity; });
            const sorted = v.every((x, i) => !i || x >= v[i - 1] - 1e-9);
            if (isFinite(v[0])) { const k = r.pms.filter((m) => m <= v[0] + 1e-9).length; expect(k >= Math.min(2, r.pms.length), "ui.r30Layout", T, `${w} ${c}억: '+N'에 숨은 ${r.list[0].t.replace(/\s+/g, " ")}보다 싼 지도 묶음 ${k}개 — 가장 싼 두 구 안에 드는 구가 숨음`); }
            expect(sorted && r.list.every((x) => x.h <= x.lh), "ui.r30Layout", T, `${w} ${c}억: +N 목록 ${r.list.map((x) => x.t.replace(/\s+/g, " ") + "[" + Math.round(x.h) + "]").join(" / ")}`);
          }
        }
      } catch (e) { bad("ui.r30Layout", T, `${w} crashed: ` + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
    // 8차: 폰 대출 끼고 5·7.5·10·15억 — '+N곳' 칩에 숨은 곳 ≤ 25%(목표 20% 안팎 · 7차 390에서 30–33%) · 가장 적게 드는 두 구는 늘 지도에 · 묶음 가운데 점이 이웃 구 땅 위 아님
    for (const w of [360, 390]) {
      const { ctx, page } = await newPage(browser, mob(w, w === 360 ? 740 : 844), errs);
      try {
        await loadHome(page); await settle(page, 500); await setMode(page, "cash");
        for (const c of [5, 7.5, 10, 15]) {
          await setCash(page, c);
          await page.evaluate(() => { const m = document.getElementById("mapbox"); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 70); });
          await page.waitForTimeout(2500);
          const r = await page.evaluate(() => {
            const root = document.querySelector("#lmap .zgu") ? document.getElementById("lmap") : document.querySelector(".zp-ph");
            if (!root) return null;
            const B = [...root.querySelectorAll(".zgu")].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden").map((e) => { const sp = e.querySelector("span"); return { n: e.dataset.gu, c: +e.dataset.n || 0, m: sp ? sp.textContent : "" }; });
            const ch = [...root.querySelectorAll(".lm-gumore")].find((e) => !e.hidden && e.getClientRects().length);
            const H = ch ? [...ch.querySelectorAll(".lm-gumore-l li button")].map((b) => ({ n: b.dataset.gu, m: (b.querySelector(".gm-m") || {}).textContent || "" })) : [];
            const offs = window.ZP_lmx && window.ZP_lmx.gus && root.id === "lmap" ? window.ZP_lmx.gus().map((g) => [g.n, g.off, g.at]) : [];
            return { B, H, more: ch ? +ch.dataset.n || 0 : 0, sN: (document.getElementById("sN") || {}).textContent || "", offs, real: root.id === "lmap" };
          });
          if (!r) { wrn("ui.r30Layout", T, `${w} 대출 ${c}억: 지도 묶음 없음`); continue; }
          const tot = intOf(r.sN), share = tot ? r.more / tot : 0;
          expect(share <= 0.25, "ui.r30Layout", T, `${w} 대출 ${c}억: '+N곳'에 숨은 곳 ${r.more}/${tot} = ${Math.round(share * 100)}% (> 25%) · 숨은 구 ${r.H.map((x) => x.n).join(", ")}`);
          const all = r.B.map((x) => ({ n: x.n, v: (money(x.m.replace("~", "")) || { v: Infinity }).v, vis: 1 })).concat(r.H.map((x) => ({ n: x.n, v: (money(x.m.replace("~", "")) || { v: Infinity }).v, vis: 0 }))).filter((x) => isFinite(x.v)).sort((a, b) => a.v - b.v);
          const hid2 = all.slice(0, 2).filter((x) => !x.vis);
          expect(!hid2.length, "ui.r30Layout", T, `${w} 대출 ${c}억: 가장 적게 드는 두 구 중 '+N'에 숨은 구 ${hid2.map((x) => x.n + " " + x.v + "억").join(", ")}`);
          const onO = r.offs.filter(([n, , at]) => at && at !== n);
          expect(!onO.length, "ui.r30Layout", T, `${w} 대출 ${c}억: 묶음 가운데 점이 이웃 구 땅 위 ${onO.map(([n, o, at]) => `${n}→${at} ${o}px`).join(", ")}`);
        }
      } catch (e) { bad("ui.r30Layout", T, `${w} 대출 crashed: ` + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
    // 8차 sheet.left: 상세 시트 '남음' = 내 돈 − 보인 필요한 돈(내림) — 보인 필요한 돈 + 남음 ≤ 내 돈('1.2억 · 내 돈 2억 중 8,300만 남음'이던 것 · o337 대출 2억)
    {
      const T2 = "상세 시트 '남음'이 보인 필요한 돈과 맞음(필요한 돈 + 남음 ≤ 내 돈) — 8차: 2 − 1.1792를 올려 8,300만";
      const { ctx, page } = await newPage(browser, mob(390, 844), errs);
      try {
        let seen = 0;
        for (const [id, c] of [["o337", 2], ["o1173", 2], ["o332", 2], ["o1070", 2], ["o337", 5], ["o332", 7.5]]) {
          await goZone(page, id, c, "loan");
          const rows = await page.evaluate(() => {
            const out = [];
            document.querySelectorAll("#report .cstrip, #report .big.cash, #report .bud, .cstrip").forEach((e) => {
              const t = e.innerText.replace(/\s+/g, " "); if (!/남음/.test(t)) return;
              const nb = e.classList.contains("bud") ? e.querySelector(".bl b") : e.querySelector("b");
              out.push({ need: nb ? nb.firstChild.textContent.trim() : "", left: (/([\d,.]+(?:억|만)) 남음/.exec(t) || [])[1] || "", t: t.slice(0, 90) });
            });
            return out;
          });
          for (const x of rows) {
            const n = money(x.need), l = money(x.left); if (!n || !l) continue; seen++;
            expect(n.v + l.v <= c + 1e-6, "sheet.left", T2, `#${id} 대출 ${c}억: 필요한 돈 ${x.need} + 남음 ${x.left} > 내 돈 ${c}억 · "${x.t}"`);
          }
        }
        expect(seen > 0, "sheet.left", T2, "'남음' 줄을 하나도 못 읽음");
      } catch (e) { bad("sheet.left", T2, "crashed: " + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      await goZone(page, "o332", 2, "jeonse");
      const g = await page.evaluate(async () => {
        const sb = document.querySelector("#report .sheet-bar"), tb = document.querySelector("#report .tabs"), sc = document.getElementById("report");
        if (!sb || !tb) return null; sc.scrollTop = 1600; await new Promise((r) => setTimeout(r, 400));
        return { gap: Math.round(tb.getBoundingClientRect().top - sb.getBoundingClientRect().bottom), stuck: getComputedStyle(tb).position };
      });
      if (g) expect(g.gap <= 1, "ui.r30Layout", T, `시트 탭 줄 틈 ${g.gap}px (${g.stuck})`);
      await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event("offline"))); await page.waitForTimeout(800);
      const o = await page.evaluate(() => { const a = document.getElementById("offBar"), b = document.querySelector("#report .dt-bar"); if (!a || a.hidden || !a.getClientRects().length || !b) return null; const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return { hit: A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom, A: [A.top, A.bottom].map(Math.round), B: [B.top, B.bottom].map(Math.round) }; });
      if (o) expect(!o.hit, "ui.r30Layout", T, `오프라인 알약 ${o.A} ↔ 시트 단추 줄 ${o.B}`); else wrn("ui.r30Layout", T, "오프라인 알약이 시트에서 안 보임");
      await ctx.setOffline(false);
    } catch (e) { bad("ui.r30Layout", T, "sheet crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
    // 정적 페이지 누름 자리: /guide/ 제목 링크 높이 · /z 출처 줄 RSS 너비
    const s = await newPage(browser, mob(390, 844), errs);
    try {
      await s.page.goto(BASE + "/guide/", { waitUntil: "load" });
      const a = await s.page.evaluate(() => [...document.querySelectorAll(".qsum li > a")].map((e) => Math.round(e.getBoundingClientRect().height)));
      expect(a.length && Math.min(...a) >= 40, "ui.r30Layout", T, `/guide/ 제목 링크 높이 최소 ${Math.min(...a)}px (${a.length})`);
      await s.page.goto(BASE + "/z/o1059.html", { waitUntil: "load" });
      const b = await s.page.evaluate(() => [...document.querySelectorAll(".zrow a")].map((e) => [e.textContent.trim(), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]));
      const sm = b.filter(([, w, h]) => w < 40 || h < 40);
      expect(b.length && !sm.length, "ui.r30Layout", T, `/z 출처 줄 작은 링크 ${JSON.stringify(sm)}`);
    } catch (e) { bad("ui.r30Layout", T, "static crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await s.ctx.close().catch(() => {}); }
  }
  // ---------------- 정적(내려받기만) ----------------
  // --- rep.cross: 리포트 정정이 다른 페이지(가이드·다음 호·목록·RSS·홈 읽을거리)까지 따라옴
  {
    const T = "리포트 숫자가 다른 페이지와 맞음: 'N월에는 인가가 X건'·'N월호에 실은 X건'·RSS '인가 X건' == issues.json · 최근 36개월 월평균은 한 쪽 안에서 한 값·창(YYYY.M~) 밝힘 · 2026년 연간 건수 한 값(‘약’ 없이) · /report/ 백분율 = 실제 비율 · 리포트 카드마다 입주까지 줄";
    const iss = (await get(BASE + "/report/feed.xml")).text || "";
    let IJ = []; try { IJ = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "pipeline", "report", "issues.json"), "utf8")); } catch (e) {}
    const N = Object.fromEntries(IJ.map((i) => [+i.ym.slice(5, 7), i.n]));
    const pages = ["/guide/howto-1", "/guide/howto-2", "/guide/howto-3", "/guide/status", "/report/", "/", ...IJ.map((i) => "/report/" + i.ym)];
    const y26 = new Set();
    for (const p of pages) {
      const r = await getPage(p); const t = htmlText(r.text || "");
      for (const m of t.matchAll(/(\d{1,2})월에는 인가가 (\d+)건/g)) expect(N[+m[1]] == null || N[+m[1]] === +m[2], "rep.cross", T, `${p}: "${m[0]}" vs ${m[1]}월호 ${N[+m[1]]}건`);
      for (const m of t.matchAll(/(\d{1,2})월호(?:는|에 실은) (\d+)건/g)) expect(N[+m[1]] == null || N[+m[1]] === +m[2], "rep.cross", T, `${p}: "${m[0]}" vs ${m[1]}월호 ${N[+m[1]]}건`);
      const av = new Set([...t.matchAll(/최근 36개월(?:\([^)]*\))? (?:월평균\(약? ?|평균이 한 달 약? ?)(\d+)건/g)].map((m) => m[1]));
      expect(av.size <= 1, "rep.cross", T, `${p}: 최근 36개월 월평균이 여러 값 ${[...av].join("/")}`);
      if (av.size && p.startsWith("/report/2")) expect(/최근 36개월\(\d{4}\.\d{1,2}~\d{4}\.\d{1,2}\)/.test(t), "rep.cross", T, `${p}: 36개월 창(YYYY.M~YYYY.M)을 밝히지 않음`);
      for (const m of t.matchAll(/2026년 (?:집계분|9월까지) (약 )?(\d+)건/g)) { y26.add(m[2]); expect(!m[1], "rep.cross", T, `${p}: "${m[0]}" ('약' 없이 한 값)`); }
      const pc = /모두 (\d+)건[^.]*?그중 (\d+)건\(([\d.]+)%\)/.exec(t);
      if (pc) { const want = (+pc[2] / +pc[1] * 100); expect(Math.abs(+pc[3] - want) < 0.051, "rep.cross", T, `${p}: ${pc[2]}/${pc[1]} = ${want.toFixed(2)}% vs "${pc[3]}%"`); }
      if (p.startsWith("/report/2")) {
        const cards = [...(r.text || "").matchAll(/<article class="zcard">([\s\S]*?)<\/article>/g)].map((m) => m[1]);
        const miss = cards.filter((c) => !/입주까지/.test(c)).map((c) => ((/<h3>(.*?)<\/h3>/.exec(c) || [])[1] || "?"));
        expect(!miss.length, "rep.cross", T, `${p}: 입주까지 줄 없는 카드 ${miss.join(", ")}`);
      }
    }
    expect(y26.size <= 1, "rep.cross", T, `2026년 연간 인가 건수가 페이지마다 다름: ${[...y26].join(" / ")}`);
    for (const m of iss.matchAll(/report\/(\d{4})-(\d{2})<\/link>(?:(?!<\/item>)[\s\S])*?<description>인가 (\d+)건/g)) { const i = IJ.find((x) => x.ym === `${m[1]}-${m[2]}`); if (i) expect(i.n === +m[3], "rep.cross", T, `RSS ${m[1]}-${m[2]}: 인가 ${m[3]}건 vs ${i.n}`); }
  }
  // --- rep.zones: 9월호처럼 구역이 적은 호는 3줄 요약이 모든 구역의 처리(계산됨·입주권 없음·보류·참고값)를 밝힘 · 같은 구 시세로 추정한(est) 구역은 리포트에서 금액 대신 계산 보류(/z·/gu와 같은 규칙)
  {
    const T = "리포트 3줄 요약이 이 호 구역(≤9곳)을 모두 밝힘 · 구 평균 추정(est) 구역 카드는 '계산 보류'(/gu '자료 부족'과 같은 규칙)";
    const est = new Set(api.zones.filter((z) => z.priceSample && z.priceSample.source === "est").map((z) => z.id));
    let IJ = []; try { IJ = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "pipeline", "report", "issues.json"), "utf8")); } catch (e) {}
    for (const i of IJ.filter((x) => !x.partial)) {
      const r = await getPage("/report/" + i.ym); const h = r.text || "";
      const sum = htmlText((/<div class="sum3">([\s\S]*?)<\/div>/.exec(h) || [])[1] || "");
      const cards = [...h.matchAll(/<article class="zcard">([\s\S]*?)<\/article>/g)].map((m) => m[1]).filter((c) => !/인가 아님/.test(c));
      if (cards.length <= 9) for (const c of cards) {
        const nm = htmlText((/<h3>(.*?)<\/h3>/.exec(c) || [])[1] || ""), alt = (/원문 명칭: ([^<]+)/.exec(c) || [])[1] || "";
        const core = (s) => s.replace(/(아파트|번지 일대|번지|일대)$/g, "").trim();
        expect(sum.includes(core(nm)) || (alt && sum.includes(alt.trim())), "rep.zones", T, `${i.ym}: 3줄 요약에 '${nm}' 없음`);
      }
      for (const c of cards) {
        const id = (/#(o\d+|s\d+|m\d+)"/.exec(c) || [])[1]; if (!id || !est.has(id)) continue;
        const v = htmlText(((/입주까지 현금[\s\S]*?<b>([^<]*)<\/b>/.exec(c)) || [])[1] || "");
        expect(/계산 보류/.test(v), "rep.zones", T, `${i.ym} ${id}(구 평균 추정): 입주까지 "${v}"`);
      }
    }
  }
  // --- seo.visibleDate: 화면의 '글 고친 날'(time.zp-mod) == JSON-LD dateModified · /about·/years
  {
    const T = "화면 '글 고친 날'·'… 수정' 날짜(<time>) == JSON-LD dateModified(없으면 사이트맵 lastmod) — /about·/years·/method·가이드 모두·10월호 — 6차: /about 10월 20일 vs 10-25 · 7차: 가이드 '2026.10.20 수정' vs 10-25";
    const sm = (await getPage("/sitemap.xml")).text || "", LM = {};
    for (const m of sm.matchAll(/<loc>[^<]*?\.kr\/([^<]*)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) LM["/" + decodeURIComponent(m[1])] = m[2];
    const gd = Object.keys(LM).filter((k) => /^\/guide\//.test(k) && k !== "/guide/rebuild-30y");
    for (const p of ["/about", "/years", "/method", "/report/2026-10", ...gd]) {
      const r = await getPage(p); const h = r.text || "";
      const by = (/<p class="byline">([\s\S]*?)<\/p>/.exec(h) || [])[1] || "";
      const t = (/<time class="zp-mod" datetime="(\d{4}-\d\d-\d\d)">/.exec(h) || [])[1] || (/<time datetime="(\d{4}-\d\d-\d\d)">[^<]*<\/time>\s*수정/.exec(by) || /수정\s*<time datetime="(\d{4}-\d\d-\d\d)">/.exec(by) || [])[1];
      const shown = (/<time datetime="\d{4}-\d\d-\d\d">(\d{4})\.(\d\d)\.(\d\d)<\/time>\s*수정/.exec(by) || /수정\s*<time datetime="\d{4}-\d\d-\d\d">(\d{4})\.(\d\d)\.(\d\d)/.exec(by));
      const d = (/"dateModified":\s*"(\d{4}-\d\d-\d\d)/.exec(h) || [])[1] || LM[p];
      expect(t && d && t === d && (!shown || shown.slice(1).join("-") === t) && !/마지막 점검/.test(h), "seo.visibleDate", T, `${p}: 화면 ${t}${shown ? " (" + shown[0].replace(/<[^>]+>/g, "") + ")" : ""} vs dateModified ${d}`);
    }
  }
  // --- home.rawLabel: JS 전 원본 HTML에 '0곳 보기' 같은 빈 숫자 버튼 없음
  {
    const r = await getPage("/");
    expect(!/>\s*0곳 보기\s*</.test(r.text || ""), "home.rawLabel", "홈 원본 HTML(JS 전)에 '0곳 보기' 없음", "raw index.html has '0곳 보기'");
  }
  // --- gu.r30: /gu 범례 '자료 부족' == 표 꼬리표 · 참고값이 섞인 구는 '참고값을 뺀 N곳'을 밝힘 · '가장 앞선 곳은 X 단계인 Y'는 그 단계가 한 곳일 때만 · /method 참고값 규칙에 모호한 '3~5건' 없음
  {
    const T = "/gu: 범례 '자료 부족'(‘–는’ 없음) · 참고값 섞이면 '참고값을 뺀 N곳' · '가장 앞선 곳' 문장은 동률 없을 때만 · /method 실제 규칙";
    const idx = await getPage("/gu/");
    const gus = [...new Set([...(idx.text || "").matchAll(/href="(?:\.\.\/gu\/|\/gu\/|\.\/)?([가-힣]+구)"/g)].map((m) => m[1]))];
    for (const g of gus) {
      const h = (await getPage("/gu/" + g)).text || "";
      const p = htmlText(((/<p class="gnote">([\s\S]*?)<\/p>/.exec(h) || [])[1]) || "");
      expect(!/–는 /.test(h), "gu.r30", T, `${g}: 범례 '–는'`);
      const nd = (h.match(/gr-now">자료 부족</g) || []).length;
      if (nd) expect(new RegExp(`자료 부족</b>\\(${nd}곳\\)`).test(h), "gu.r30", T, `${g}: 표 '자료 부족' ${nd}줄인데 범례에 없음/다름`);
      const ex = (h.match(/class="gr-ex"/g) || []).length;
      if (ex && /나온 곳은/.test(p)) expect(/참고값을 뺀 \d+곳/.test(p), "gu.r30", T, `${g}: 참고값 ${ex}줄인데 '참고값을 뺀 N곳' 없음`);
      const m = /가장 앞선 곳은 (.+?) 단계인/.exec(p);
      if (m) { const n = (h.match(new RegExp(`<em>${m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</em>`, "g")) || []).length; expect(n <= 1, "gu.r30", T, `${g}: '가장 앞선 곳' 한 곳만 말하는데 ${m[1]} ${n}곳`); }
    }
    const me = htmlText((await getPage("/method")).text || "");
    expect(!/3~5건 미만/.test(me) && /3~4건/.test(me) && /자료 부족/.test(me), "gu.r30", T, "/method 참고값 규칙이 모호함(3~5건 미만) 또는 /gu '자료 부족' 처리를 밝히지 않음");
  }
}
// ================================================================ 31차(7차 레드팀 · 마지막 고침): 접근 이름 · Esc 초점 · 바꿔 보기 칸 · 정적 글 숫자 한 기준 · 작은 링크
async function r31Lane(browser, api, errs) {
  const mob = (w, h, cs) => ({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: cs || "light" });
  const goZone = async (page, id, cash, mode) => {
    page.__where = `r31 #${id} ${mode} ${cash}`;
    await page.goto(`${BASE}/?cash=${cash}&mode=${mode}&qac=${++LOADS}#${id}`, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => !!document.querySelector("#report .dt-k"), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(900);
  };
  // --- a11y.r31: 토허 구역 상세(밝게·어둡게) — 보이는 단추마다 접근 이름 · '전세 끼고 ✕' 칩은 이유까지 읽힘 · axe 심각(critical) 0(axe-core 있을 때)
  {
    const T = "토허 구역 상세(밝게·어둡게): 모든 단추에 접근 이름 · '전세 끼고' 불가 칩 이름·글에 이유 · axe critical 0 — 7차: .ov-p.dt-gap button-name(451곳)";
    let AXE = null; try { const ap = process.env.AXE_PATH || require.resolve("axe-core/axe.min.js"); AXE = fs.readFileSync(ap, "utf8"); } catch (e) {}
    const z = api.zones.find((x) => /토지거래허가/.test(x.need.gap.blocked || "") && x.need.cash.now != null && x.membership && x.membership.status === "ok");
    if (!z) skip("a11y.r31", T, "토허 구역 없음");
    else for (const cs of ["light", "dark"]) {
      const { ctx, page } = await newPage(browser, mob(390, 844, cs), errs);
      try {
        await goZone(page, z.id, 2, "jeonse");
        const r = await page.evaluate(() => {
          const nm = (b) => (b.getAttribute("aria-label") || (b.getAttribute("aria-labelledby") || "").split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || "").join(" ") || b.innerText || b.getAttribute("title") || "").trim();
          const bs = [...document.querySelectorAll("#report button, #report [role=button]")].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== "hidden");
          const g = document.querySelector("#report .dt-gap");
          return { none: bs.filter((b) => !nm(b)).map((b) => b.className || b.tagName).slice(0, 5), n: bs.length, gap: g ? { lab: g.getAttribute("aria-label") || "", txt: g.innerText.replace(/\s+/g, " ").trim() } : null };
        });
        expect(r.n > 3 && !r.none.length, "a11y.r31", T, `${cs} #${z.id}: 이름 없는 단추 ${r.none.join(", ")}`);
        expect(!!r.gap && /전세 끼고/.test(r.gap.lab) && /불가/.test(r.gap.lab) && /불가/.test(r.gap.txt), "a11y.r31", T, `${cs} #${z.id}: 전세 끼고 칩 ${JSON.stringify(r.gap)}`);
        if (AXE) {
          await page.addScriptTag({ content: AXE });
          const v = await page.evaluate(async () => { const r = await window.axe.run(document, { resultTypes: ["violations"] }); return r.violations.filter((x) => x.impact === "critical").map((x) => x.id + " " + x.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(";")); });
          expect(!v.length, "a11y.r31", T, `${cs} #${z.id}: axe critical ${v.join(" | ")}`);
        } else wrn("a11y.r31", T, "axe-core 없음(AXE_PATH) — 접근 이름만 셈");
      } catch (e) { bad("a11y.r31", T, `${cs} crashed: ` + String(e.message || e).split("\n")[0]); }
      finally { await ctx.close().catch(() => {}); }
    }
  }
  // --- desk.escFocus: PC 목록 줄을 눌러 연 상세를 Esc로 닫으면 그 줄로 초점이 돌아감
  {
    const T = "PC: 목록 줄로 연 상세를 Esc로 닫으면 초점이 그 줄(a.s-cm)로 — 7차: 첫 줄로 가던 것";
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
    try {
      await ctx.route(BLOCK, (r) => r.abort());
      const page = await ctx.newPage(); page.__where = "r31 desk esc";
      await loadHome(page); await settle(page, 500);
      const a = page.locator("#sList a.s-cm").nth(3); const id = await a.getAttribute("data-id");
      await a.click(); await page.waitForTimeout(1200);
      await page.keyboard.press("Escape"); await page.waitForTimeout(700);
      const f = await page.evaluate(() => { const e = document.activeElement; return e ? (e.dataset.id || e.tagName + "." + e.className) : ""; });
      expect(f === id, "desk.escFocus", T, `연 줄 ${id} · Esc 뒤 초점 ${f}`);
    } catch (e) { bad("desk.escFocus", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- zone.inputsExact: '숫자 바꿔 보기' 칸에는 계산에 쓴 값 그대로(1.93 · 올린 '2' 아님) · 손대지 않은 칸을 다시 넣어도 계산식이 그대로
  {
    const T = "'숫자 바꿔 보기' 칸 = 계산에 쓴 만 원까지 값(합계 칸 매수가와 같음) · 그대로 다시 넣으면 결과 그대로 — 7차: 매수가 '2' vs 1억 9,300만";
    const { ctx, page } = await newPage(browser, mob(390, 844), errs);
    try {
      for (const id of ["o337", "o916"].filter((i) => api.zones.some((z) => z.id === i))) {
        await goZone(page, id, 2, "loan");
        const r = await page.evaluate(async () => {
          const P = document.getElementById("pane"), i = document.getElementById("mPrice"), nv = document.getElementById("mNv"), tot = P.querySelector(".fx-tot dd small"), fl = () => (P.querySelector("details.flow p") || {}).textContent || "";
          if (!i || !tot) return null;
          const before = fl(); const nv0 = nv ? nv.value : "";
          if (nv) { nv.value = nv0; nv.dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 500)); }
          return { v: i.value, tot: tot.textContent, same: fl() === before, nv0 };
        });
        if (!r) { wrn("zone.inputsExact", T, `${id}: 칸 없음`); continue; }
        const m = /매수가 ((?:\d[\d,]*억)?\s*(?:[\d,]+만)?)/.exec(r.tot);
        expect(m && money(m[1]) && Math.abs(parseFloat(r.v) - money(m[1]).v) < 1e-6 && r.same, "zone.inputsExact", T, `${id}: 칸 '${r.v}' vs 합계 칸 '${m && m[1]}' · 입주 때 시세 '${r.nv0}' 다시 넣은 뒤 계산식 그대로 ${r.same}`);
      }
    } catch (e) { bad("zone.inputsExact", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await ctx.close().catch(() => {}); }
  }
  // --- ui.r31Targets: 정적 페이지 작은 링크 — /gu RSS · 리포트 카드 링크 · 표 '원문' · 가이드 '함께 보면 좋은 질문' · /faq · 푸터 ≥ 40px
  {
    const T = "정적 페이지 누름 자리 ≥ 40px: /gu RSS · 리포트 카드 '구역 페이지·내 돈으로 계산' · 표 '원문' 폭 · 가이드 함께 읽기 · /faq 링크 · 푸터 — 7차";
    const s = await newPage(browser, mob(390, 844), errs);
    try {
      const L = [["/gu/구로구", 'p.meta a[href*="feed/"]'], ["/report/2026-09", ".zc-a a, main table td > a"], ["/guide/status", "main h2 + ul > li > a"], ["/faq", ".fq-more a, .fq-a a"], ["/about", "footer.f p:first-child a"]];
      for (const [u, sel] of L) {
        const r0 = await getPage(u); const url = r0.url && /\.html$/.test(r0.url) ? r0.url : BASE + encodeURI(u) + (/\/$/.test(u) ? "" : ".html");
        await s.page.goto(url, { waitUntil: "load" });
        if (/^\/faq/.test(u)) await s.page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
        const sm = await s.page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((a) => a.getClientRects().length).map((a) => { const b = a.getBoundingClientRect(); return [a.textContent.trim().slice(0, 12), Math.round(b.width), Math.round(b.height)]; }), sel);
        const bad2 = sm.filter(([, w, h]) => w < 40 || h < 39.5);
        expect(sm.length && !bad2.length, "ui.r31Targets", T, `${u} ${sel}: ${sm.length}개 중 작은 것 ${JSON.stringify(bad2.slice(0, 4))}`);
      }
    } catch (e) { bad("ui.r31Targets", T, "crashed: " + String(e.message || e).split("\n")[0]); }
    finally { await s.ctx.close().catch(() => {}); }
  }
}
async function r31Static(api) {
  let IJ = []; try { IJ = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "pipeline", "report", "issues.json"), "utf8")); } catch (e) {}
  const pubs = IJ.filter((i) => !i.draft).sort((a, b) => b.ym.localeCompare(a.ym));
  // --- home.r31: 홈 가이드 카드 곳 수 한 기준(9.26 · 953 + 모아타운 131 = 1,084) · 읽을거리·/about에 최신 호
  {
    const T = "홈 가이드 카드: 진행 중 곳 수 한 기준(9.26)·1,084 = 진행 중 + 모아타운 · 홈 읽을거리와 /about '지금까지 낸 리포트'에 최신 호 — 7차: 956+131≠1,084 · 3호가 최신";
    const h = (await getPage("/")).text || "";
    const q = (/<ul class="rd-q">([\s\S]*?)<\/ul>/.exec(h) || [])[1] || "";
    const ns = [...q.matchAll(/진행 중인?(?: 정비사업)? ([\d,]+)곳/g)].map((m) => +m[1].replace(/,/g, ""));
    const tot = /([\d,]+)곳\(9\.26 기준 진행 중인 ([\d,]+)곳 \+ 모아타운 ([\d,]+)곳\)/.exec(q);
    expect(ns.length >= 2 && new Set(ns).size === 1 && tot && +tot[1].replace(/,/g, "") === +tot[2].replace(/,/g, "") + +tot[3].replace(/,/g, "") && +tot[2].replace(/,/g, "") === ns[0] && /9\.26 기준/.test(q), "home.r31", T, `가이드 카드 진행 중 ${ns.join("/")} · ${tot ? tot[0] : "1,084 문장 없음"}`);
    if (pubs.length) {
      const ym = pubs[0].ym;
      expect(new RegExp(`<article class="rd-card"><span class="rd-k">월간 리포트 ${pubs[0].no}호[^<]*</span><h3><a href="report/${ym}"`).test(h), "home.r31", T, `홈 읽을거리 리포트 카드가 최신 ${ym}(${pubs[0].no}호)가 아님`);
      const ab = (await getPage("/about")).text || "";
      const li = (/<h2>지금까지 낸 리포트<\/h2>\s*<ul>([\s\S]*?)<\/ul>/.exec(ab) || [])[1] || "";
      expect(pubs.every((i) => li.includes(`report/${i.ym}"`)) && li.indexOf(`report/${ym}"`) === li.indexOf("report/"), "home.r31", T, `/about 리포트 목록에 ${pubs.map((i) => i.ym).join(",")}가 최신부터 다 있지 않음`);
    }
  }
  // --- guide.hub30y: /guide/ 목록의 '30년 넘은 아파트' 소개 숫자 == 그 글 본문
  {
    const T = "/guide/ 목록 rebuild-30y 소개 숫자(단지·이미 진행 중) == /guide/rebuild-30y 제목·본문 — 7차: 1,077·245 vs 1,058·234";
    const a = htmlText((await getPage("/guide/")).text || ""), b = (await getPage("/guide/rebuild-30y")).text || "";
    const h1 = (/<h1>준공 30년 넘은 서울 아파트 ([\d,]+)단지<\/h1>/.exec(b) || [])[1], zn = (/이 가운데 <b>([\d,]+)단지<\/b>는 이미 정비사업/.exec(b) || [])[1];
    const x = /준공 30년 넘은 서울 아파트 ([\d,]+)단지/.exec(a), y = /([\d,]+)단지는 이미 정비사업이 진행 중이라/.exec(a);
    expect(h1 && zn && x && y && x[1] === h1 && y[1].replace(/,/g, "") === zn.replace(/,/g, ""), "guide.hub30y", T, `목록 ${x && x[1]}·${y && y[1]} vs 글 ${h1}·${zn}`);
  }
  // --- rep.r31: 리포트 카드 '매수가(발행 당시)' · 'N종' = 0이 아닌 막대 수 · 'N곳 가운데 N곳' 없음 · 계산기 링크는 열리는 구역만 · 10월호 기간 = /years 표 · 9월호 읽는 법 이어짐 · 염리4 카드 금액 없음
  {
    const T = "리포트: 카드 '지금 매수가' 없음 · 요약 'N종' == 0 아닌 인가 종류 수 · 'N곳 가운데 N곳' 없음 · 계산기 링크 구역 == 앱/구역 페이지에 있음 · 10월호 단계 기간 == /years · 9월호 '7곳' 뒤 바로 망원동 · 구 평균 추정 카드 금액 없음 — 7차";
    const ids = new Set(api.zones.map((z) => z.id));
    const yh = (await getPage("/years")).text || "";
    let YS = null; try { YS = JSON.parse((/const S=(\{.*?\});\n/.exec(yh) || [])[1]).large; } catch (e) {}
    for (const i of IJ.filter((x) => !x.draft)) {
      const h = (await getPage("/report/" + i.ym)).text || "", t = htmlText(h);
      expect(!/지금 매수가/.test(h), "rep.r31", T, `${i.ym}: '지금 매수가' 남음`);
      const s3 = htmlText((/<div class="sum3">([\s\S]*?)<\/div>/.exec(h) || [])[1] || "");
      const nk = /인가 (\d)종/.exec(s3), bars = /이번 달 어떤 인가가 났나<\/h2>\s*<div class="hbars"[^>]*>([\s\S]*?)<\/div><\/div>\n/.exec(h);
      if (nk && bars) { const v = [...bars[1].matchAll(/<b>(\d+)<\/b>/g)].map((m) => +m[1]); if (v.length >= 5) expect(+nk[1] === v.filter((x) => x > 0).length, "rep.r31", T, `${i.ym}: 요약 ${nk[0]} vs 막대 ${v.join(",")}`); }
      const kp = /<span>인가 이벤트<\/span><b>\d+건<\/b><small>([^<]*)<\/small>/.exec(h);
      if (nk && kp) expect(kp[1].split("·").length === +nk[1], "rep.r31", T, `${i.ym}: 인가 이벤트 칸 '${kp[1]}' vs ${nk[0]}`);
      const dup = /(\d+)곳 가운데 \1곳/.exec(t); expect(!dup, "rep.r31", T, `${i.ym}: '${dup && dup[0]}'`);
      const dead = [];
      for (const m of h.matchAll(/href="\.\.\/\?from=report#([a-z]\d+)"/g)) { if (ids.has(m[1]) || /^m\d+$/.test(m[1])) continue;   /* m = 모아타운 관리지역(앱에서 열림 · API 구역 목록 밖) */ const z = await getPage("/z/" + m[1]); if (z.status !== 200) dead.push(m[1]); }
      expect(!dead.length, "rep.r31", T, `${i.ym}: 계산기 링크인데 앱 목록·구역 페이지에 없는 구역 ${[...new Set(dead)].join(", ")}`);
      if (i.ym >= "2026-10" && YS) {
        const tb = (/<caption class="sr-only">단계별 걸린 기간<\/caption>([\s\S]*?)<\/table>/.exec(h) || [])[1] || "";
        const rows = [...tb.matchAll(/<tr><td class="t"[^>]*>([^<]+)<\/td><td[^>]*>([\d.]+)년<\/td><td[^>]*>(\d+)%<\/td>/g)];
        const want = Object.values(YS).map((v) => [v.km_med.toFixed(1), String(Math.round(v.reach5 * 100))]);
        expect(rows.length === want.length && rows.every((m, k) => m[2] === want[k][0] && m[3] === want[k][1]), "rep.r31", T, `${i.ym}: 부록 ${rows.map((m) => m[2] + "/" + m[3]).join(" ")} vs /years ${want.map((w) => w.join("/")).join(" ")}`);
        const meds = new Set(Object.values(YS).map((v) => v.km_med.toFixed(1)));
        const cardY = [...h.matchAll(/<span>다음 인가까지 보통<\/span><b>([\d.]+)년<\/b>/g)].map((m) => m[1]);
        expect(cardY.every((y) => meds.has(y)), "rep.r31", T, `${i.ym}: 카드 '다음 인가까지 보통' ${cardY.join(",")} ∉ /years`);
      }
      if (i.ym === "2026-09") expect(/구역으로는 7곳이에요\. 망원동 459번지/.test(t), "rep.r31", T, "9월호 '이번 호를 읽는 법': '7곳이에요' 뒤에 망원동 설명이 바로 오지 않음");
      for (const c of h.matchAll(/<article class="zcard">([\s\S]*?)<\/article>/g)) {
        const id = (/#([a-z]\d+)"/.exec(c[1]) || [])[1]; const z = api.zones.find((x) => x.id === id);
        if (!z || !z.priceSample || z.priceSample.source !== "est") continue;
        const v = htmlText((/<span>매수가[^<]*<\/span><b>([^<]*)<\/b>/.exec(c[1]) || [])[1] || "");
        expect(!/[\d.]+억|[\d,]+만/.test(v) && /자료 부족/.test(v), "rep.r31", T, `${i.ym} ${id}(구 평균 추정): 매수가 칸 '${v}'`);
      }
    }
  }
  // --- seo.r31copy: /method·/faq 매수가 출처 순서 한 문장 · /z·/gu 대출 끼고 이름(현금 매수 시·현금으로 사면 없음) · /z 전세는 만 원까지
  {
    const T = "/method·/faq 매수가 출처 순서(구역 안 → 같은 본번 → 반경 → 같은 동 → 같은 구) · /z·/gu '현금 매수 시/현금으로 사면' 없음(= 대출 끼고) · /z 전세 = API 전세(만 원까지) — 7차";
    for (const p of ["/method", "/faq"]) { const t = htmlText((await getPage(p)).text || ""); expect(/구역 안 → 대표지번과 같은 본번 → 구역 반경 300~800m → 같은 동 → 같은 구/.test(t) && !/구역 반경 300~800m 안 오래된 빌라 실거래의 가운데 값이에요/.test(t), "seo.r31copy", T, `${p}: 매수가 출처 순서 문장 없음`); }
    const g = (await getPage("/gu/구로구")).text || ""; expect(!/현금 매수 시/.test(g), "seo.r31copy", T, "/gu/구로구: '현금 매수 시'");
    let n = 0;
    for (const z of api.zones.filter((x) => x.page && x.jeonse != null).slice(0, 25)) {
      const h = (await getPage("/z/" + z.id)).text || ""; if (!h) continue; n++;
      expect(!/현금으로 사면|현금 매수 ·/.test(h), "seo.r31copy", T, `/z/${z.id}: '현금으로 사면·현금 매수' 이름`);
      const m = /− 전세 ((?:\d[\d,]*억)?\s*(?:[\d,]+만)?) \(\+취득세\)/.exec(h);
      if (m && money(m[1])) expect(Math.abs(money(m[1]).v - z.jeonse) < 0.0011, "seo.r31copy", T, `/z/${z.id}: 전세 ${m[1]} vs api ${z.jeonse}`);
    }
    if (!n) wrn("seo.r31copy", T, "/z 표본 없음");
  }
}
// ================================================================ main
// 레인을 '단위'로 나눠 단위마다 자식 프로세스 하나 · 브라우저 하나(한 레인이 브라우저를 죽여도 다른 레인은 그대로).
// 부모가 단위를 차례·동시에(QAC_PAR, 기본 2) 띄우고, 단위마다 시간 한도(QAC_LANE_MS 또는 아래 표)를 넘으면
// SIGTERM → 그때까지 잰 검사는 살리고 그 단위를 SKIP(시간 초과)으로 보고한다. 결과 꼴(PASS/FAIL 줄 · JSON)은 예전 그대로.
//   전체:        node tools/qa_consistency.js [baseUrl]
//   바뀐 곳만:   node tools/qa_consistency.js [baseUrl] --changed[=origin/main]   (git diff → 레인 · static은 늘)
//   파일 지정:   --files=src/ext/72_inbox.js,tools/feeds.py   (훅·CI에서 바뀐 파일 목록을 직접)
//   몇 개만:     QAC_ONLY=r14,tapp  (예전처럼 하나도 됨 · static은 늘)    목록 보기: --list
//   종료 코드:   0 전부 통과 · 1 FAIL 있음 · 3 FAIL은 없지만 SKIP(시간 초과·죽음)된 단위가 있어 불완전 · 2 실행 불가
const UNIT = process.env.QAC_UNIT || "";
const SHARED_DIR = process.env.QAC_SHARED || "";
const putShared = (k, v) => { if (SHARED_DIR) fs.writeFileSync(path.join(SHARED_DIR, k + ".json"), JSON.stringify(v)); };
const getShared = (k) => { try { return JSON.parse(fs.readFileSync(path.join(SHARED_DIR, k + ".json"), "utf8")); } catch (e) { return null; } };
const TAPP_N = +process.env.QAC_TAPP_PARTS || 5;
// 단위 표: est = 이 기계(2코어 · 다른 트랙과 같이 씀) 대략 초 · limit = 시간 한도(초) · solo = 시간을 재는 검사라 혼자(다른 단위와 겹치지 않게)
// deps = 먼저 끝나야 하는 단위(공유 자료: static → liveCounts · core → listMap)
const UNITS = {
  static: { est: 20, limit: 180, browser: false, files: [/./] },
  core: { est: 280, limit: 600, files: [/^src\/(app\.js|data\.json|premium\.json|shell\.html|island\.js|boot\.js)$/, /^src\/ext\/(20_zone|30_api|40_home|60_simple|61_budget|76_detail|95_desk|10_lmap)\./, /^tools\/(calc\.js|build\.py|prerender\.js|enrich\.py|api\.py)$/] },
  ui: { est: 200, limit: 600, deps: ["static"], files: [/^src\/(app\.js|app\.css|shell\.html|island\.js|boot\.js)$/, /^src\/ext\/(10_lmap|02_layers|62_extra|63_newb|64_overview|66_tools|70_pins|72_inbox|74_my|90_theme|99)/] },
  r14: { est: 125, limit: 400, files: [/^src\/ext\/(70_pins|72_inbox|74_my)\./, /^worker\//, /^src\/(net|contact)\.js$/] },
  r1: { est: 40, limit: 240, files: [/^src\/ext\/(74_my|68_app|60_simple)\./, /^src\/(shell\.html|app\.css)$/] },
  r3: { est: 60, limit: 300, files: [/^src\/ext\/(10_lmap|65_pills|02_layers|61_budget)\./] },
  r4: { est: 35, limit: 240, files: [/^src\/ext\/(20_zone|76_detail|05_facts)\./, /^tools\/zpages\.py$/] },
  r17: { est: 140, limit: 400, files: [/^src\/ext\/(10_lmap|20_zone|97_r17)\./, /^src\/app\.js$/] },
  r17b: { est: 35, limit: 240, solo: true, files: [/^src\/ext\/(20_zone|72_inbox|97_r17)\./, /^tools\/(report|zpages)\.py$/] },
  r19: { est: 190, limit: 600, solo: true, files: [/^src\/ext\/(10_lmap|11_ghost|61_budget|02_layers)\./, /^src\/(ghost|island|boot)\.js$/, /^tools\/(ghost_geo|zmap|prerender)\./] },
  r21: { est: 95, limit: 400, solo: true, files: [/^src\/ext\/(10_lmap|65_pills|98_r21|61_budget)\./] },
  r26: { est: 100, limit: 400, files: [/^src\/tapp\//, /^src\/ext\/(74_my|77_tbridge|95_desk|99zzzz_r26)/] },
  r27: { est: 35, limit: 240, files: [/^src\/ext\/(64_overview|99zzzzz_r27)/, /^tools\/zpages\.py$/] },
  r29: { est: 60, limit: 300, files: [/^src\/(app\.css|shell\.html)$/, /^src\/ext\/.*\.css$/, /^tools\/zpages\.py$/] },
  r30: { est: 140, limit: 400, files: [/^src\/ext\/(10_lmap|56_toheo|20_zone|99zzzzzzzz_r30)/, /^tools\/(report|zpages|toheo)\.py$/] },
  r31: { est: 70, limit: 300, files: [/^src\/(app\.js|app\.css|shell\.html)$/, /^tools\/(zpages|report)\.py$/] },
  r22: { est: 590, limit: 1500, deps: ["core"], files: [/^src\/(app\.js|data\.json|premium\.json)$/, /^src\/ext\/68_app\./, /^tools\/(enrich|calc|api)\./] },
};
const NHF_N = Math.min(5, +process.env.QAC_NHF_RUNS || 5);
const TAPP_FILES = [/^src\/tapp\//, /^src\/ext\/(68_app|69_install|77_tbridge|72_inbox|74_my)\./, /^src\/(shell\.html|island\.js|boot\.js)$/, /^tools\/static_tabs\.py$/, /^public\/(sw\.js|manifest\.webmanifest|\.well-known\/)/];
// tapp.noHomeFlash(4×CPU · 5번 × 50 전환)는 혼자 15분 넘게 걸려 → 5번을 nhf1..5 단위로 나눠(합은 같음), 나머지 42묶음은 tapp1..3
for (let k = 1; k <= NHF_N; k++) UNITS["nhf" + k] = { est: 600, limit: 900, part: "tapp:=tapp.noHomeFlash", env: { QAC_NHF_SLICE: `${k}/${NHF_N}` }, files: TAPP_FILES };
for (let k = 1; k <= TAPP_N; k++) UNITS["tapp" + k] = { est: 500, limit: 1200, solo: false, part: `tapp:${k}/${TAPP_N}:-tapp.noHomeFlash`, files: [/^src\/tapp\//, /^src\/ext\/(68_app|69_install|77_tbridge|72_inbox|74_my)\./, /^src\/(shell\.html|island\.js|boot\.js)$/, /^tools\/static_tabs\.py$/, /^public\/(sw\.js|manifest\.webmanifest|\.well-known\/)/] };
// 흔한 몸통(app.js·data.json)은 위 표에 이미 · 생성물(public/b 등)은 소스와 같은 레인 — 표에 없는 파일만 바뀌면 static만

async function runUnit(name, api, shortSrc, zoneIds, errs) {
  const shared = {};
  const u = UNITS[name];
  if (!u) throw new Error("unknown unit " + name);
  const browser = u.browser === false ? null : await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const cut = Math.ceil(zoneIds.length * 0.6);
  const guard = (lab, p) => p.catch((e) => bad("runtime", "검사 실행", `${lab} crashed: ` + String(e && e.message || e).split("\n")[0]));
  try {
    switch (name) {
      case "static": { const st = await guard("static", staticLane(api)); putShared("liveCounts", (st && st.liveCounts) || []); break; }
      case "core": await guard("countsLane", countsLane(browser, api, errs, shared)); putShared("listMap", shared.listMap ? [...shared.listMap] : []);
        await guard("zoneLane", zoneLane(browser, api, errs, shared, zoneIds.slice(0, cut))); await guard("deskLane", deskLane(browser, errs)); break;
      case "ui": await guard("mapLane", mapLane(browser, api, errs, shortSrc)); shared.liveCounts = getShared("liveCounts") || [];
        await guard("uiLane", uiLane(browser, api, errs, shared)); await guard("zoneLane", zoneLane(browser, api, errs, shared, zoneIds.slice(cut))); break;
      case "r14": await guard("r14Lane", r14Lane(browser, api, errs)); break;
      case "r1": await guard("r1Lane", r1Lane(browser, api, errs)); break;
      case "r3": await guard("r3Lane", r3Lane(browser, errs)); break;
      case "r4": await guard("r4Lane", r4Lane(browser, api, errs)); break;
      case "r17": await guard("navLane", navLane(browser, api, errs)); break;
      case "r17b": await guard("r17bLane", r17bLane(browser, api, errs)); break;
      case "r19": await guard("r19Lane", r19Lane(browser, api, errs)); break;
      case "r21": await guard("r21Lane", r21Lane(browser, api, errs)); break;
      case "r26": await guard("r26Lane", r26Lane(browser, api, errs)); break;
      case "r27": await guard("r27Lane", Promise.all([r27Lane(browser, api, errs), guProse()])); break;
      case "r29": await guard("r29Lane", r29Lane(browser, api, errs)); break;
      case "r30": await guard("r30Lane", r30Lane(browser, api, errs)); break;
      case "r31": await guard("r31Lane", Promise.all([r31Lane(browser, api, errs), r31Static(api)])); break;
      case "r22": { const lm = getShared("listMap"); if (lm) shared.listMap = new Map(lm); await guard("r22Lane", r22Lane(browser, api, errs, shared)); break; }
      default: if (/^(tapp|nhf)\d+$/.test(name)) { await guard("tappLane", tappLane(browser, api, errs)); break; } throw new Error("no runner for " + name);
    }
  } finally { if (browser) await browser.close().catch(() => {}); }
}

function unitResult(name, errs, partial) {
  return { unit: name, partial: !!partial, ms: el(), checks: [...CHECKS.values()], errs, sect: SECT_T, flaky: FLAKY_LOG };
}

async function child(api, shortSrc, zoneIds) {
  const out = process.env.QAC_UNIT_OUT;
  const errs = [];   // 레인들이 콘솔 오류를 여기에 쌓는다 → 시간 초과(SIGTERM) 때도 그때까지 것을 남긴다
  const dump = (partial) => { try { fs.writeFileSync(out, JSON.stringify(unitResult(UNIT, errs, partial))); } catch (e) {} };
  setInterval(() => { if (process.ppid === 1) { dump(true); process.exit(0); } }, 2000).unref();   // 부모가 죽으면 같이 끝(고아 브라우저가 기계를 붙잡지 않게)
  process.on("SIGTERM", () => { GATES.forEach((g) => { try { g.close(); } catch (e) {} }); SECT_T["(cut at)"] = el(); dump(true); process.exit(0); });
  try { await runUnit(UNIT, api, shortSrc, zoneIds, errs); }
  catch (e) { bad("runtime", "검사 실행", `${UNIT} crashed: ` + String(e && e.message || e).split("\n")[0]); }
  dump(false);
  process.exit(0);
}

function changedUnits(baseRef) {
  const { execSync } = require("child_process");
  const root = path.join(__dirname, "..");
  const sh = (c) => { try { return execSync(c, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch (e) { return ""; } };
  const mb = sh(`git merge-base HEAD ${baseRef}`) || baseRef;
  const files = [...new Set((sh(`git diff --name-only ${mb}`) + "\n" + sh("git ls-files --others --exclude-standard")).split("\n").filter(Boolean))];
  const pick = new Set(["static"]);
  for (const f of files) for (const [k, u] of Object.entries(UNITS)) if (k !== "static" && u.files.some((re) => re.test(f))) pick.add(k);
  return { files, units: [...pick] };
}

function withDeps(list) {
  const s = new Set(list);
  for (let ch = true; ch; ) { ch = false; for (const k of [...s]) for (const d of UNITS[k].deps || []) if (!s.has(d)) { s.add(d); ch = true; } }
  return Object.keys(UNITS).filter((k) => s.has(k));
}

async function parent(api, zoneIds) {
  const { spawn } = require("child_process");
  const os = require("os");
  if (argv.includes("--list")) { for (const [k, u] of Object.entries(UNITS)) console.log(`${k.padEnd(7)} est ${String(u.est).padStart(4)}s · limit ${u.limit}s${u.solo ? " · solo" : ""}${u.deps ? " · after " + u.deps.join(",") : ""}`); process.exit(0); }
  const chArg = argv.find((a) => a === "--changed" || a.startsWith("--changed="));
  let want, why = "full";
  if (process.env.QAC_ONLY) { const only = process.env.QAC_ONLY.split(",").map((s) => s.trim()).filter(Boolean).flatMap((s) => (s === "tapp" ? Object.keys(UNITS).filter((k) => /^(tapp|nhf)\d+$/.test(k)) : [s])); want = ["static", ...only]; why = "QAC_ONLY=" + process.env.QAC_ONLY; }
  else if (argv.some((a) => a.startsWith("--files="))) { const files = argv.find((a) => a.startsWith("--files=")).slice(8).split(",").filter(Boolean); const pick = new Set(["static"]); for (const f of files) for (const [k, u] of Object.entries(UNITS)) if (k !== "static" && u.files.some((re) => re.test(f))) pick.add(k); want = [...pick]; why = `files ${files.join(",")}`; }
  else if (chArg) { const base = chArg.includes("=") ? chArg.split("=")[1] : "origin/main"; const c = changedUnits(base); want = c.units; why = `changed vs ${base}: ${c.files.length} files`; if (c.files.length) console.log("changed files: " + c.files.slice(0, 30).join(" ") + (c.files.length > 30 ? ` … +${c.files.length - 30}` : "")); }
  else want = Object.keys(UNITS);
  for (const k of want) if (!UNITS[k]) { console.error(`unknown lane '${k}' — node tools/qa_consistency.js --list`); process.exit(2); }
  const units = withDeps(want);
  const PAR = Math.max(1, +process.env.QAC_PAR || 3);
  // 시간 한도는 '멈춤' 보호용 — 공용 기계가 바쁘면(1분 부하 ÷ 코어 수) 그만큼 늘린다(최대 4배). 성능 판정이 아님.
  const busy = () => Math.min(4, Math.max(1, os.loadavg()[0] / Math.max(1, os.cpus().length)));
  const kids = new Set();
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { for (const c of kids) try { c.kill("SIGTERM"); } catch (e) {} process.exit(130); });
  const LANE_MS = +process.env.QAC_LANE_MS || 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qac-"));
  console.log(`qa_consistency ${BASE} · ${why} · units ${units.join(" ")} · ${PAR} at a time · shared ${tmp}`);
  const state = Object.fromEntries(units.map((k) => [k, "wait"])), res = {}, timing = {}, skipped = {}, limits = {};
  const running = new Map();
  const ready = (k) => state[k] === "wait" && (UNITS[k].deps || []).every((d) => !state[d] || state[d] === "done");
  const start = (k) => new Promise((resolve) => {
    const u = UNITS[k], out = path.join(tmp, k + ".json"), t = Date.now(), bf = busy(), lim = LANE_MS || Math.round(u.limit * 1000 * bf);
    const env = { ...process.env, QAC_UNIT: k, QAC_UNIT_OUT: out, QAC_SHARED: tmp, QAC_PART: u.part || "", ...(u.env || {}) };
    const p = spawn(process.execPath, [__filename, BASE], { env, stdio: ["ignore", "ignore", "pipe"] }); kids.add(p);
    let errTxt = ""; p.stderr.on("data", (d) => { errTxt = (errTxt + d).slice(-2000); });
    let killed = null;
    const tm = setTimeout(() => { killed = "time limit " + Math.round(lim / 1000) + "s"; p.kill("SIGTERM"); setTimeout(() => p.kill("SIGKILL"), 8000); }, lim);
    state[k] = "run"; running.set(k, p);
    p.on("exit", (code, sig) => {
      clearTimeout(tm); running.delete(k); kids.delete(p); timing[k] = Date.now() - t; limits[k] = Math.round(lim / 1000);
      let r = null; try { r = JSON.parse(fs.readFileSync(out, "utf8")); } catch (e) {}
      if (killed || !r || r.partial || code) skipped[k] = killed || (r && r.partial ? "partial" : `exit ${code}${sig ? " " + sig : ""}: ${errTxt.split("\n").filter(Boolean).slice(-1)[0] || "no result"}`);
      res[k] = r; state[k] = "done";
      console.log(`  ${skipped[k] ? "SKIP" : "done"} ${k.padEnd(7)} ${(timing[k] / 1000).toFixed(0).padStart(4)}s${skipped[k] ? " — " + skipped[k] : ""}`);
      resolve();
    });
  });
  // 순서: 의존 먼저 → 오래 걸리는 것 먼저(LPT) · solo는 혼자 · 나머지는 PAR개까지
  const pre = (k) => (units.some((x) => (UNITS[x].deps || []).includes(k)) ? 1 : 0);   // 다른 단위가 기다리는 단위(static·core) 먼저
  const order = () => units.filter(ready).sort((a, b) => pre(b) - pre(a) || UNITS[b].est - UNITS[a].est);
  await new Promise((done) => {
    const tick = () => {
      if (units.every((k) => state[k] === "done")) return done();
      const soloRun = [...running.keys()].some((k) => UNITS[k].solo);
      if (!soloRun) for (const k of order()) {
        if (running.size >= PAR) break;
        if (UNITS[k].solo) { if (running.size) continue; start(k).then(tick); break; }
        if (UNITS[k].browser === false || running.size < PAR) start(k).then(tick);
      }
      // solo가 기다리는데 일반 단위만 남아 있으면 solo부터(굶지 않게): 남은 일반 단위가 없을 때 위에서 처리됨
    };
    tick();
  });
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  // 합치기
  const errs = [], flakyLog = [], sect = {};
  for (const k of units) {
    const r = res[k]; if (!r) continue;
    for (const c of r.checks) { const m = C(c.id, c.title); m.n += c.n; m.fails.push(...c.fails); m.warns.push(...c.warns); if (c.skipped && !m.skipped) m.skipped = c.skipped; if (c.retries) m.retries = (m.retries || []).concat(c.retries.map((x) => `${k}: ${x}`)); }
    errs.push(...(r.errs || [])); flakyLog.push(...(r.flaky || []).map((f) => ({ unit: k, ...f }))); Object.assign(sect, r.sect || {});
  }
  for (const [k, why2] of Object.entries(skipped)) { const c = C("lane." + k, `레인 ${k}가 시간 한도 안에 끝남(SKIP이면 일부 검사를 못 잼)`); c.skipped = why2; }
  for (const c of CHECKS.values()) if (c.n && c.skipped && !c.fails.length && !c.id.startsWith("lane.")) c.skipped = null;   // 다른 단위에서 잰 검사
  return { errs, timing, skipped, flakyLog, sect, units, why, limits, par: PAR };
}

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

  if (UNIT) return child(api, shortSrc, zoneIds);
  const P = await parent(api, zoneIds);
  const errs = P.errs, timing = P.timing;

  // 콘솔 오류
  const localPush = /localhost|127\.0\.0\.1/.test(BASE || "") ;
  const own = errs.filter((e) => !e.external && !(localPush && /api\/push\//.test(e.msg))), ext = errs.filter((e) => e.external);
  const uniq = [...new Map(own.map((e) => [e.msg, e])).values()];
  expect(!uniq.length, "err.console", "콘솔 오류·페이지 오류 없음(우리 사이트 파일)", uniq.slice(0, 5).map((e) => `${e.where}: ${e.msg}`).join(" ; "));
  if (ext.length) wrn("err.console", "콘솔 오류·페이지 오류 없음(우리 사이트 파일)", `${ext.length} external resource errors (tiles/CDN) e.g. ${ext[0].msg}`);

  // 출력
  const list = [...CHECKS.values()].sort((a, b) => a.id.localeCompare(b.id));
  const nFail = list.filter((c) => c.fails.length).length;
  const nSkipLane = Object.keys(P.skipped).length;
  const res = { base: BASE, at: new Date().toISOString(), ms: el(), mode: P.why, units: P.units, par: P.par, limits: P.limits, load: require("os").loadavg(), timing, skippedLanes: P.skipped, flaky: P.flakyLog, sections: P.sect, pass: nFail === 0 && !nSkipLane, zones: zoneIds, checks: list };
  try { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(res, null, 2)); } catch (e) { console.error("could not write " + OUT + ": " + e.message); }
  console.log(`\nqa_consistency ${BASE}  ${(el() / 1000).toFixed(1)}s  zones: ${zoneIds.join(" ")}`);
  for (const c of list) {
    const tag = c.fails.length ? "FAIL" : c.skipped && !c.n ? "SKIP" : "PASS";
    console.log(`${tag} ${c.id.padEnd(16)} ${c.title}  [${c.n - c.fails.length}/${c.n}]${c.warns.length ? ` (${c.warns.length} warn)` : ""}${c.skipped ? ` (skipped: ${c.skipped})` : ""}${c.retries ? ` (retried ${c.retries.length})` : ""}`);
    c.fails.slice(0, 4).forEach((f) => console.log(`       - ${f}`));
    if (c.fails.length > 4) console.log(`       … +${c.fails.length - 4} more (JSON)`);
  }
  const fl = P.flakyLog.filter((f) => f.attempts > 1);
  if (fl.length) console.log(`\nflaky retries: ${fl.map((f) => `${f.label} ${f.result} after ${f.attempts}`).join(" · ")}`);
  console.log(`lanes: ${Object.entries(timing).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / 1000)}s`).join(" · ")}`);
  console.log(`\n${nFail ? "FAILED" : nSkipLane ? "INCOMPLETE" : "PASSED"} · ${nFail} failing check(s) of ${list.length}${nSkipLane ? ` · ${nSkipLane} lane(s) SKIP: ${Object.entries(P.skipped).map(([k, v]) => k + " (" + v + ")").join(", ")}` : ""} · JSON ${OUT}`);
  process.exit(nFail ? 1 : nSkipLane ? 3 : 0);
})().catch((e) => { console.error("qa_consistency crashed:", e); process.exit(2); });
