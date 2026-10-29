#!/usr/bin/env node
/* 사이클 4(M) 새 지도 검사(SPEC_C4_DESIGN C1~C6 · I) — 'PASS id — 내용' · 'FAIL id — 이유' 줄(qa_consistency 바깥 검사 단위 mapx)
   실행: NODE_PATH=$(npm root -g) node tools/qa_mapx.js [baseUrl]   (python3 -m http.server 8765 -d public)
   mapx.labels   줌 단계별 이름표 수 상한(서울 ≤ 25 · 구 폰 ≤ 24 / PC ≤ 40 · 구역 ≤ 14) · DOM 이름표 겹침 0 · 지도 칸 밖 잘림 0(360·390·412·1280)
   mapx.shapes   상태 5종이 색 말고도 모양·글자로 갈림(가능 채운 말풍선 · 조금 부족 '+금액' 테두리 · 보류 점선 '보류' · 부족 점 · 조건 밖 ✕) · 범례 = 그린 상태
   mapx.numbers  말풍선·카드 숫자 = 목록 판정(SIMPLE.zstate) · ZF 꼴(지도 전용 계산 없음) · 아래 막대 곳 수 = 목록 곳 수
   mapx.dial     다이얼을 끄는 동안 색 다시 칠하기 한 번 < 50ms(4×CPU · 가운데 값 · 90번째도 < 80ms) · 끄는 동안 말풍선 DOM 그대로 · 손을 떼면 곳 수 = ZP_count
   mapx.dark     다크: 말풍선·카드·칩·범례·막대 글자 대비 ≥ 4.5:1 · 바탕 동·역 글자 대비(스타일 색) ≥ 4.5:1
   mapx.touch    지도 조작부·말풍선 누르는 자리 ≥ 44×44(가운데에서 ±21px이 같은 단추에 닿음)
   mapx.flow     3탭 흐름: 구 라벨 → 말풍선 → 미리보기(판정 띠 '갈 수 있어요' · 금액 = 말풍선) → 전체 시트(웹·앱)
   mapx.base     바탕지도 레벨 2 토큰(라이트·다크 bg·간선·물·공원 · 노란 고속도로 없음 · place 레이어 없음 · 노선 0.35·줌 12부터 · 동·역 12px · 구역 후광)
   mapx.layers6  레이어 단추 6개(이름표 그대로) · 켬 = aria-pressed + 남색 채움 + 흰 점(색 말고 점으로도) · 넘기지 않아도 6개가 다 보임
   ---- 사이클 4 D+ '금액 태그 + 체크'(SPEC_C4_DESIGN J2-4) ----
   map.noTail        .zpill.tl·.zcard.tl 0개 · 표식 ::after(꼬리) 표시 0(구·구역 줌)
   map.pickCheck     구 줌 st-ok 태그 수 = .zp-ck 수 · 구역 줌 st-ok 카드 수 = .zc-ck 수
   map.yellowOnly    노란색(#F5C33B) 계산 색 = 체크·'새로'·숫자 원뿐(관심·선택·레이어 켬에 노랑 0) · GL 레이어 노랑은 '새로'(-nw)뿐
   map.guCountKept   서울 줌: 갈 수 있는 구 수 = 숫자 라벨 수 · 숫자 합(+ 화면 밖 칩) = 목록 곳 수(100%·130% × 360·390·412)
   map.dropKeepsState 탈락 점의 t = 그 구역 zstate.st(가능이 부족 점으로 바뀌면 실패)
   a11y.tap44        모든 표식(태그·카드·구 라벨) 누르는 영역 ≥ 44×44(::before/::after 투명 둘레 포함)
   map.nameAvoidDot  구 줌 동·역 이름 상자와 표식 점(±6px) 겹침 0(GL 배치 결과)
   map.sheetReveal   태그를 누른 뒤 고른 구역 라벨 점이 '위 조작부 아래 ~ 미리보기 시트 위' 띠 안
   map.dialReveal    다이얼을 연 상태에서 그 구 갈 수 있는 곳 라벨 점이 모두 다이얼 위
   map.farGapText    부족 시트 '+X 더 필요해요'의 X = 화면 금액 − 내 돈(ZF.gap)
   map.big130        글자 130%: 내 돈 막대 '2억' 한 줄 · 범례 단추 1개 · 가로 넘침 0
   map.stripDefault  처음 로드 때 카드 줄 닫힘 · 곳 수 단추 aria-expanded=false · 열면 카드에 숫자 번호 0 · 정렬 단추 2개
   map.contrast      부족 칩 ≥ 4.5 · 다크 가능 태그 테두리 대 채움 ≥ 3 · 빈 구 이름 ≥ 4.5 · axe serious·critical 0(지도 · 라이트·다크·130%) */
"use strict";
const { chromium } = require("playwright");
const BASE = (process.argv.slice(2).find((a) => !a.startsWith("--")) || "http://localhost:8765").replace(/\/+$/, "");
const EXE = process.env.QA_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const R = new Map();
const ok = (id, m) => { if (!R.has(id)) R.set(id, { f: [], n: 0, m: [] }); const r = R.get(id); r.n++; if (m) r.m.push(m); };
const bad = (id, m) => { if (!R.has(id)) R.set(id, { f: [], n: 0, m: [] }); const r = R.get(id); r.n++; r.f.push(String(m).slice(0, 300)); };
const expect = (c, id, m) => (c ? ok(id) : bad(id, m));
const BLOCK = /googlesyndication|googletagmanager|google-analytics|doubleclick|adservice|adtrafficquality|fundingchoices|pagead2/i;
const TAPP = () => { try { if (!sessionStorage.getItem("zp.tapp")) Object.defineProperty(Document.prototype, "referrer", { get: () => "android-app://kr.alwaysquestions.jaegaepick/" }); sessionStorage.setItem("zp.tapp", "1"); } catch (e) {} };
const lum = (c) => { c = String(c); const cs = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(c); const m = cs ? [cs[1] * 255, cs[2] * 255, cs[3] * 255] : c.match(/[\d.]+/g); if (!m) return 1; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]); };
const hexRgb = (h) => { h = h.replace("#", ""); return `rgb(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)})`; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function open(b, { w, h, dark, tapp, cpu, cash = 2, fs = 100 }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: dark ? "dark" : "light", isMobile: w < 981, hasTouch: w < 981, serviceWorkers: "block" });
  if (tapp) await ctx.addInitScript(TAPP);
  // 큰 글씨(안드로이드 글꼴 크게와 같은 효과): 문서 글자 배율 text-size-adjust
  if (fs > 100) await ctx.addInitScript((k) => { const f = () => { const s = document.createElement("style"); s.textContent = `html{-webkit-text-size-adjust:${k}%!important;text-size-adjust:${k}%!important}`; (document.head || document.documentElement).appendChild(s); }; if (document.documentElement) f(); else document.addEventListener("DOMContentLoaded", f); }, fs);
  await ctx.route(BLOCK, (r) => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  if (cpu) { const c = await ctx.newCDPSession(p); await c.send("Emulation.setCPUThrottlingRate", { rate: cpu }); }
  await p.goto(`${BASE}/?cash=${cash}&mode=jeonse${tapp ? "" : "#map"}`, { waitUntil: "load", timeout: 60000 });
  await p.waitForFunction(() => window.ZP_lmx && window.SIMPLE !== undefined || window.ZP_lmx, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) { const n = await p.$('button:visible:has-text("건너뛰기")'); if (n) { await n.click().catch(() => {}); await p.waitForTimeout(400); } else break; }
  if (tapp) { await p.evaluate(() => { const x = [...document.querySelectorAll("button,a")].find((e) => /^지도$/.test(e.innerText.trim()) && e.offsetWidth); if (x) x.click(); }); await p.waitForTimeout(1500); }
  await p.waitForFunction(() => document.documentElement.classList.contains("mx") && document.documentElement.classList.contains("s-full"), null, { timeout: 20000 }).catch(() => {});
  return { ctx, p, errs };
}
// 실제 지도가 붙고 구로 들어간 뒤(구 단계)까지
async function toGu(p, gu) {
  await p.evaluate((g) => { const b = [...document.querySelectorAll(".zgu")].find((x) => x.dataset.gu === g && x.offsetWidth); if (b) b.click(); else { try { ZP_lmx.attach(); } catch (e) {} } }, gu);
  await p.waitForFunction((g) => { try { const m = ZP_lmx.map(); return m && m.loaded() && ZP_lmx.gu() === g && !document.querySelector(".zp-ph") && document.querySelectorAll("#lmap .zpill").length > 0; } catch (e) { return false; } }, gu, { timeout: 40000 }).catch(() => {});
  await p.waitForTimeout(1200);
}
const LAB = () => {
  const cv = (ZP_lmx.map() ? ZP_lmx.map().getCanvas() : document.querySelector(".zp-ph")).getBoundingClientRect();
  const L = ZP_lmx.labels().filter((x) => x.b[2] > x.b[0]);
  let ov = []; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i].b, c = L[j].b; if (a[0] < c[2] - 1 && c[0] < a[2] - 1 && a[1] < c[3] - 1 && c[1] < a[3] - 1) ov.push(L[i].t.slice(0, 10) + "×" + L[j].t.slice(0, 10)); }
  const out = L.filter((x) => x.b[0] < cv.left - 0.5 || x.b[2] > cv.right + 0.5 || x.b[1] < cv.top - 0.5 || x.b[3] > cv.bottom + 0.5).map((x) => x.t.slice(0, 12));
  // 조작부(위 칸·칩·막대·둥근 단추·범례) 밑에 깔린 이름표
  const obs = [...document.querySelectorAll(".mx-top,.s-rail,.mx-chips .mx-c,.s-mini,.mx-fabs,#lmKey:not([hidden]),.zp-ph .lm-key")].filter((e) => e.offsetWidth && getComputedStyle(e).visibility !== "hidden").map((e) => e.getBoundingClientRect());
  const under = L.filter((x) => obs.some((o) => x.b[0] < o.right - 2 && o.left < x.b[2] - 2 && x.b[1] < o.bottom - 2 && o.top < x.b[3] - 2)).map((x) => x.t.slice(0, 12));
  return { n: L.length, k: L.reduce((o, x) => ((o[x.k] = (o[x.k] || 0) + 1), o), {}), ov, out, under, tier: ZP_lmx.tier(), z: ZP_lmx.map() ? ZP_lmx.map().getZoom() : 0 };
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const T0 = Date.now();
  try {
    // ---------------- 1. 이름표 상한·겹침·잘림 (폰 360·390·412 앱/웹 · PC 1280) ----------------
    for (const [w, h, tapp] of [[360, 740, 1], [390, 844, 0], [390, 844, 1], [412, 915, 1], [1280, 800, 0]]) {
      const where = `${w}${tapp ? " 앱" : " 웹"}`, phone = w < 981;
      const { ctx, p, errs } = await open(b, { w, h, tapp });
      try {
        // 서울 단계(자리 그림 SVG 또는 실제 지도)
        const c = await p.evaluate(() => { const L0 = (window.ZP_lmx ? ZP_lmx.labels() : []).filter((x) => x.k === "gu"), seen = new Set(), L = L0.filter((x) => !seen.has(x.id) && seen.add(x.id)); const box = (document.querySelector(".zp-ph") || document.querySelector("#lmap")).getBoundingClientRect(); const frc = new Set([...document.querySelectorAll(".zgu.frc")].map((e) => e.dataset.gu)); let ov = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { if (frc.has(L[i].id) || frc.has(L[j].id)) continue;   /* 사이클 4 D+(SPEC J2-1 ④): 자리가 끝내 없는 갈 수 있는 구는 숫자 원을 겹쳐서라도 둔다(숫자 보장 · map.guCountKept가 셈) */ const a = L[i].b, d = L[j].b; if (a[0] < d[2] - 1 && d[0] < a[2] - 1 && a[1] < d[3] - 1 && d[1] < a[3] - 1) ov++; } const out = L.filter((x) => x.b[0] < box.left + 5.5 || x.b[2] > box.right - 5.5).map((x) => x.t); const sum = L.reduce((a, x) => a + (+((/갈 수 있는 곳 ([\d,]+)곳/.exec(x.lab) || [0, "0"])[1].replace(/,/g, ""))), 0);   /* 사이클 4 D+: 라벨 글자는 '✓ 은평 8'(곳 없음) — 숫자는 접근 이름 '…곳'에서 */ const two = L.filter((x) => /~/.test(x.t)); return { n: L.length, ov, out, sum, two: two.length, cnt: window.ZP_count ? ZP_count() : -1, ghost: !!document.querySelector(".zp-ph"), more: window.ZP_G && ZP_G.more ? ZP_G.more() : 0 }; });
        expect(c.n > 0 && c.n <= 25 && !c.ov && !c.out.length && !c.two, "mapx.labels", `${where} 서울 단계: 구 라벨 ${c.n}개 겹침 ${c.ov} 가장자리 6px 밖 ${c.out.join(",")} 두 줄 ${c.two}`);
        expect(c.sum + c.more === c.cnt, "mapx.numbers", `${where} 서울 단계: 구 라벨 곳 수 합 ${c.sum} + 못 놓은 ${c.more} vs 목록 ${c.cnt}`);
        if (phone && !tapp) expect(c.ghost, "mapx.labels", `${where}: #map 서울 단계가 SVG 자리 그림이 아님(WebGL을 먼저 붙임)`);
        await toGu(p, "성북구");
        const g = await p.evaluate(LAB);
        expect(g.tier === "gu" && g.n > 0 && g.n <= (phone ? 24 : 40) && !g.ov.length && !g.out.length && !g.under.length, "mapx.labels", `${where} 구 단계(성북구 z${g.z.toFixed(2)}): ${JSON.stringify(g)}`);
        // 숫자: 말풍선 = 목록 판정(zstate)·ZF 꼴 · 막대 곳 수 = 목록
        const nm = await p.evaluate(() => { const bad = []; const P = ZP_lmx.pills(); for (const x of P) { const r = window.__lmx && null; const s = ZP_lmx.zst([x.id])[0][1], F = ZP_lmx.fx(); const want = s === "near" ? "+" + F.gap(x.need) : s === "na" ? (x.need != null ? "보류 " + F.cash(x.need) : "보류") : F.cash(x.need); if (x.t !== want) bad.push(`${x.id} ${x.t}≠${want}`); } const bar = (document.querySelector(".mx-cnt b") || {}).textContent || "", sl = (document.getElementById("sMiniN") || {}).textContent; return { bad, n: P.length, bar, sl, gc: ZP_lmx.fx().guCount(ZP_lmx.gu()) }; });
        expect(!nm.bad.length && nm.n > 0, "mapx.numbers", `${where} 말풍선 숫자 ≠ 판정·ZF 꼴: ${nm.bad.slice(0, 5).join(" · ")}`);
        if (phone) expect(nm.bar === nm.sl + "곳" && +nm.sl.replace(/,/g, "") === nm.gc, "mapx.numbers", `${where} 아래 막대 '${nm.bar}' vs 목록 ${nm.sl} vs guCount ${nm.gc}`);
        // 구역 단계(한성대입구 일대 · 시안과 같은 자리)
        await p.evaluate(() => ZP_lmx.map().jumpTo({ center: [127.0072, 37.5888], zoom: 14.15 }));
        await p.waitForTimeout(2500);
        const z = await p.evaluate(LAB);
        expect(z.tier === "zone" && z.n > 0 && z.n <= 14 && !z.ov.length && !z.out.length && !z.under.length && (z.k.card || 0) > 0, "mapx.labels", `${where} 구역 단계 z14.15: ${JSON.stringify(z)}`);
        // ---------------- 2. 모양·글자(상태 5종) · 범례 ----------------
        const sh = await p.evaluate(() => {
          const m = ZP_lmx.map(), o = { bad: [] };
          const cards = [...document.querySelectorAll("#lmap .zcard")];
          cards.forEach((e) => { const st = (e.className.match(/st-(\w+)/) || [])[1], g = (e.querySelector(".zc-g") || {}).textContent || "", v = (e.querySelector(".zp-v") || {}).textContent || ""; const W = { ok: /^갈 수 있음$/, near: /^\+ 조금 부족$/, far: /^부족$/, no: /^✕ 조건 밖$/, na: /^계산 보류$/, moa: /모아타운/ };   /* 사이클 4 통합: 칩 = ST_WORD(목록·범례·시트와 같은 말) */ if (W[st] && !W[st].test(g)) o.bad.push(`card ${st} chip '${g}'`); if (st === "near" && !/^\+/.test(v)) o.bad.push(`card near value '${v}'`); const cs = getComputedStyle(e.querySelector(".zc-in")); if (st === "na" && cs.borderTopStyle !== "dashed") o.bad.push("card na not dashed"); if (st === "moa" && cs.borderTopStyle !== "dashed") o.bad.push("card moa not dashed"); });
          ["zd-far", "zd-no", "zd-na", "zd-moa"].forEach((i) => { if (!m.hasImage(i)) o.bad.push("no image " + i); });
          // 같은 회색이라도 부족(점)과 조건 밖(✕)은 다른 그림: 알파 채널 픽셀 수가 달라야 한다
          try { const a = m.style.getImage("zd-far").data, c = m.style.getImage("zd-no").data; const cnt = (im) => { let n = 0; for (let i = 3; i < im.data.length; i += 4) if (im.data[i] > 128) n++; return n; }; if (Math.abs(cnt(a) - cnt(c)) < 4) o.bad.push("far·no 표식 모양이 같음"); } catch (e) {}
          const key = document.getElementById("lmKey"); o.key = key && !key.hidden ? key.textContent : "";
          const drawn = new Set(cards.map((e) => (e.className.match(/st-(\w+)/) || [])[1]));
          const KT = { ok: "갈 수 있음", near: "조금 부족", far: "부족", no: "조건 밖", na: "계산 보류", moa: "모아타운" };
          drawn.forEach((s) => { if (KT[s] && !o.key.includes(KT[s])) o.bad.push(`범례에 '${KT[s]}' 없음(그린 상태)`); });
          o.cards = cards.length; return o;
        });
        expect(!sh.bad.length && sh.cards > 0, "mapx.shapes", `${where} 구역 단계: ${sh.bad.join(" · ")} (cards ${sh.cards})`);
        // ---------------- 3. 누르는 자리 44px ----------------
        const tc = await p.evaluate(() => {
          const T = [...document.querySelectorAll(".mx-q, #mapbox .s-rail>button, .mx-chips button, .mx-fab, .mx-cash, .mx-cnt, .s-mini .s-mm button, #lmap .zpill .zp-in, #lmap .zcard .zc-in")].filter((e) => e.offsetWidth && getComputedStyle(e).visibility !== "hidden");
          const bad = []; T.forEach((e) => { const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; const own = (x, y) => { if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true; const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h) || h.contains(e)); }; const okW = r.width >= 43.5 || (own(cx - 21.5, cy) && own(cx + 21.5, cy)), okH = r.height >= 43.5 || (own(cx, cy - 21.5) && own(cx, cy + 21.5)); if (!(okW && okH)) bad.push(`${(e.className || e.tagName).toString().slice(0, 20)} '${e.textContent.trim().slice(0, 10)}' ${Math.round(r.width)}×${Math.round(r.height)}`); });
          return { n: T.length, bad };
        });
        expect(tc.n > 10 && !tc.bad.length, "mapx.touch", `${where}: ${tc.bad.slice(0, 6).join(" · ")} (n ${tc.n})`);
        // ---------------- 4. 레이어 6칸 ----------------
        const ly = await p.evaluate(() => { const B = [...document.querySelectorAll("#mapbox .s-rail>button")].filter((e) => e.offsetWidth); const box = document.getElementById("mapbox").getBoundingClientRect(); const names = B.map((e) => e.textContent.trim()); const vis = B.every((e) => { const r = e.getBoundingClientRect(); return r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.width >= 40; }); B[0].click(); const on = B[0]; const st = getComputedStyle(on), dot = getComputedStyle(on, "::after"); const r = { names, vis, pressed: on.getAttribute("aria-pressed"), bg: st.backgroundColor, dot: dot.content !== "none" && dot.backgroundColor }; on.click(); return r; });
        expect(ly.names.join(",") === "호재,신고가,학교,학원가,상권,병원" && ly.vis && ly.pressed === "true" && ly.dot && lum(ly.bg) < 0.2, "mapx.layers6", `${where}: ${JSON.stringify(ly)}`);
        if (errs.length) bad("mapx.labels", `${where} 페이지 오류: ${errs[0]}`);
      } catch (e) { bad("mapx.labels", `${where} crashed: ${String(e.message || e).split("\n")[0]}`); }
      await ctx.close();
    }
    // ---------------- 5. 3탭 흐름(웹 390 · 앱 390) ----------------
    for (const tapp of [0, 1]) {
      const { ctx, p } = await open(b, { w: 390, h: 844, tapp });
      try {
        let taps = 0;
        const g = await p.$('.zgu[data-gu="성북구"]'); if (g) { await g.tap(); taps++; }
        await p.waitForFunction(() => { try { return ZP_lmx.gu() === "성북구" && document.querySelectorAll("#lmap .zpill.st-ok").length > 0 && !document.querySelector(".zp-ph"); } catch (e) { return false; } }, null, { timeout: 40000 }).catch(() => {});
        await p.waitForTimeout(800);
        const pill = await p.evaluateHandle(() => [...document.querySelectorAll("#lmap .zpill.st-ok .zp-in")].sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0]);
        const pt = await p.evaluate((e) => (e ? e.textContent : null), pill);
        if (pt) { await pill.asElement().tap(); taps++; }
        await p.waitForTimeout(1500);
        const pk = await p.evaluate(() => { const e = document.querySelector("#lmPick.mx-peek:not([hidden])"); return e ? { vd: (e.querySelector(".pk-vd") || {}).textContent, v: (e.querySelector(".pk-band .zp-v") || {}).textContent, cmp: !!e.querySelector("[data-cx-add]"), cells: e.querySelectorAll(".pk-3>div").length, sel: (document.querySelector("#lmap .zpill.sel, #lmap .zcard.sel") || {}).className || "", foc: document.documentElement.classList.contains("mx-focus") } : null; });
        expect(taps === 2 && pk && /갈 수 있어요/.test(pk.vd) && pt.includes(pk.v) && pk.cmp && pk.cells === 3 && pk.foc, "mapx.flow", `${tapp ? "앱" : "웹"}: 탭 ${taps} · 말풍선 '${pt}' · 미리보기 ${JSON.stringify(pk)}`);
        const band = await p.$("#lmPick .pk-band"); if (band) { await band.tap(); taps++; }
        await p.waitForTimeout(2500);
        const sh = await p.evaluate(() => ({ open: document.documentElement.classList.contains("sheet-open") || document.documentElement.classList.contains("s-rep") || !!document.querySelector("#report.sheet"), txt: ((document.getElementById("report") || {}).innerText || "").slice(0, 3000) }));
        expect(taps === 3 && sh.open && pk && sh.txt.includes(pk.v), "mapx.flow", `${tapp ? "앱" : "웹"}: 3탭째 전체 시트 ${sh.open} · 금액 '${pk && pk.v}' 시트에 ${pk && sh.txt.includes(pk.v)}`);
      } catch (e) { bad("mapx.flow", `${tapp ? "앱" : "웹"} crashed: ${String(e.message || e).split("\n")[0]}`); }
      await ctx.close();
    }
    // ---------------- 6. 다이얼(4×CPU) ----------------
    {
      const { ctx, p } = await open(b, { w: 390, h: 844, tapp: 1 });
      try {
        await toGu(p, "성북구");
        const c = await (await ctx.newCDPSession(p)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await p.evaluate(() => { window.__mxDialT.length = 0; ZP_mx.dialOpen("cash"); });
        await p.waitForTimeout(800);
        const n0 = await p.evaluate(() => document.querySelectorAll("#lmap .zpill").length);
        const rg = await p.$(".mx-dial .mx-dr"), bb = await rg.boundingBox();
        await p.mouse.move(bb.x + bb.width * 0.25, bb.y + bb.height / 2); await p.mouse.down();
        let domSame = true;
        for (let i = 1; i <= 24; i++) { await p.mouse.move(bb.x + bb.width * (0.25 + i * 0.01), bb.y + bb.height / 2); await p.waitForTimeout(90); if (i === 12) domSame = (await p.evaluate(() => document.querySelectorAll("#lmap .zpill").length)) === n0; }
        await p.mouse.up();
        await p.waitForTimeout(2500);
        const r = await p.evaluate(() => { const T = window.__mxDialT.slice().sort((a, b) => a - b); return { n: T.length, med: T[T.length >> 1], p90: T[Math.floor(T.length * 0.9)], cash: ZP_lmx.fx().CASH, cnt: ZP_lmx.gu() ? ZP_lmx.fx().guCount(ZP_lmx.gu()) : ZP_count(), bar: (document.getElementById("sMiniN") || {}).textContent, nw: document.querySelectorAll("#lmap .zpill.nw").length }; });
        expect(r.n >= 6 && r.med < 50 && r.p90 < 80, "mapx.dial", `4×CPU 끄는 동안 색 다시 칠하기: 가운데 ${r.med}ms · 90% ${r.p90}ms (n ${r.n})`);
        expect(domSame, "mapx.dial", "끄는 동안 말풍선 DOM이 바뀜(손을 뗄 때 한 번이어야)");
        expect(String(r.cnt) === String(r.bar).replace(/,/g, ""), "mapx.dial", `손을 뗀 뒤 막대 곳 수 ${r.bar} vs 목록 셈(구 안이면 guCount) ${r.cnt}`);
      } catch (e) { bad("mapx.dial", `crashed: ${String(e.message || e).split("\n")[0]}`); }
      await ctx.close();
    }
    // ---------------- 7. 바탕지도 레벨 2 · 다크 대비 ----------------
    for (const dark of [0, 1]) {
      const { ctx, p } = await open(b, { w: 390, h: 844, tapp: 1, dark });
      try {
        await toGu(p, "성북구");
        const s = await p.evaluate(() => { const st = ZP_lmx.map().getStyle(), L = {}; st.layers.forEach((l) => (L[l.id] = l)); const pc = (id, k) => L[id] && L[id].paint && L[id].paint[k]; return { bg: pc("bg", "background-color"), art: pc("art", "line-color"), artc: pc("art-c", "line-color"), water: pc("water", "fill-color"), park: pc("park", "fill-color"), place: !!L.place, yellow: JSON.stringify(st.layers).match(/#FBE3A6|#E0BE6A/gi), sub: [pc("subway", "line-opacity"), L.subway && L.subway.minzoom], dong: [L["dong-lab"] && L["dong-lab"].layout["text-size"], pc("dong-lab", "text-color"), pc("dong-lab", "text-halo-color")], stn: L["stn-mj-lab"] && L["stn-mj-lab"].layout["text-size"], zcase: !!L["zone-case"], sel: pc("sel-line", "line-color"), pick: (() => { const i = document.createElement("i"); i.style.color = "var(--zp-pick)"; document.body.appendChild(i); const c = getComputedStyle(i).color; i.remove(); return c; })() }; });   /* 사이클 4 통합: 고른 곳 노랑은 공용 토큰 --zp-pick에서 읽음(GL엔 rgb 문자열) */
        const W = dark ? { bg: "#10161E", art: "#3A4759", artc: "#1A222D", water: "#183A58", park: "#193020" } : { bg: "#ECEEF1", art: "#D5DBE3", artc: "#A3ADBA", water: "#B0CCE6", park: "#CDE2C8" };
        const tokBad = Object.keys(W).filter((k) => String(s[k]).toUpperCase() !== W[k]);
        expect(!tokBad.length && !s.place && !s.yellow && s.sub[0] === 0.35 && s.sub[1] === 12 && s.dong[0] === 12 && s.stn === 12 && s.zcase && s.sel === (dark ? "#C7D6FF" : "#1F3A87") /* 사이클 4 D+: 고른 곳 = 남색 3px(노랑 아님) */, "mapx.base", `${dark ? "다크" : "라이트"}: ${tokBad.map((k) => `${k} ${s[k]}≠${W[k]}`).join(" ")} ${JSON.stringify(s)}`);
        // 바탕 글자(동·역) 대비: 가장 불리한 바탕(물·간선·공원·건물) 위
        const bgs = dark ? ["#10161E", "#183A58", "#3A4759", "#193020", "#1B2430"] : ["#ECEEF1", "#B0CCE6", "#D5DBE3", "#CDE2C8", "#DADFE6"];
        const worst = Math.min(...bgs.map((x) => ratio(hexRgb(s.dong[1]), hexRgb(x))));
        expect(worst >= 4.5, "mapx.dark", `${dark ? "다크" : "라이트"} 동·역 글자 ${s.dong[1]} 가장 불리한 바탕 대비 ${worst.toFixed(2)}`);
        await p.evaluate(() => ZP_lmx.map().jumpTo({ center: [127.0072, 37.5888], zoom: 14.15 }));
        await p.waitForTimeout(2500);
        const cs = await p.evaluate(() => {
          const out = [];
          const bgOf = (e) => { while (e) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c) && !/rgba\([^)]*, 0\)/.test(c)) return c; e = e.parentElement; } return "rgb(255,255,255)"; };
          document.querySelectorAll("#lmap .zpill .zp-v, #lmap .zcard .zc-n, #lmap .zcard .zp-v, #lmap .zcard .zc-g, #lmap .zcard .zc-c em, .mx-chips .mx-c, #lmKey span, .mx-cnt b, .mx-cash b, .mx-q span, #mapbox .s-rail>button span").forEach((e) => { if (!e.offsetWidth) return; const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; out.push([e.className || e.tagName, e.textContent.trim().slice(0, 10), getComputedStyle(e).color, bgOf(e)]); });
          return out;
        });
        const low = cs.map(([c, t, fg, bg]) => [c, t, ratio(fg, bg)]).filter((x) => x[2] < 4.5);
        expect(cs.length > 8 && !low.length, "mapx.dark", `${dark ? "다크" : "라이트"} 글자 대비 4.5 미만: ${low.slice(0, 6).map((x) => `${x[0]} '${x[1]}' ${x[2].toFixed(2)}`).join(" · ")} (n ${cs.length})`);
      } catch (e) { bad("mapx.base", `${dark ? "다크" : "라이트"} crashed: ${String(e.message || e).split("\n")[0]}`); }
      await ctx.close();
    }
    // ======================= 사이클 4 D+ '금액 태그 + 체크'(SPEC_C4_DESIGN J2-4) =======================
    const AXE = (() => { try { return require("fs").readFileSync(process.env.AXE_PATH || "/tmp/claude-0/-home-claude/887bff60-b663-5701-90e9-e402cebc9114/scratchpad/node_modules/axe-core/axe.min.js", "utf8"); } catch (e) { try { return require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"); } catch (e2) { return null; } } })();
    const axeRun = async (p) => { if (!AXE) return null; await p.addScriptTag({ content: AXE }).catch(() => {}); return p.evaluate(async () => { const r = await window.axe.run(document.getElementById("mapbox") || document, { resultTypes: ["violations"] }); return r.violations.filter((x) => x.impact === "serious" || x.impact === "critical").map((x) => `${x.id}(${x.nodes.length}) ${x.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`); }); };
    const idleMap = (p) => p.waitForFunction(() => { try { const m = ZP_lmx.map(); return m && m.loaded() && !m.isMoving() && m.areTilesLoaded(); } catch (e) { return false; } }, null, { timeout: 20000, polling: 200 }).catch(() => {});
    // 서울 줌 숫자 보장
    const CITY = () => {
      const L0 = (window.ZP_lmx ? ZP_lmx.labels() : []).filter((x) => x.k === "gu"), seen = new Set(), L = L0.filter((x) => !seen.has(x.id) && seen.add(x.id));
      const has = L.filter((x) => /갈 수 있는 곳 [\d,]+곳/.test(x.lab));
      const numL = has.filter((x) => /\d/.test(x.t));
      const sum = has.reduce((a, x) => a + +((/갈 수 있는 곳 ([\d,]+)곳/.exec(x.lab) || [0, "0"])[1].replace(/,/g, "")), 0);
      const shown = has.map((x) => +((/(\d[\d,]*)\s*$/.exec(x.t) || [0, "-1"])[1].replace(/,/g, ""))), want = has.map((x) => +((/갈 수 있는 곳 ([\d,]+)곳/.exec(x.lab) || [0, "0"])[1].replace(/,/g, "")));
      const more = window.ZP_G && ZP_G.on() ? ZP_G.more() : (ZP_lmx.gusMore ? ZP_lmx.gusMore() : 0);
      const tgt = typeof ZP_count === "function" ? ZP_count() : -1;
      return { has: has.length, num: numL.length, mism: has.filter((x, i) => shown[i] !== want[i]).map((x) => x.t), sum, more, tgt, steps: window.ZP_G && ZP_G.steps ? ZP_G.steps() : null };
    };
    const TAP44 = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetWidth && getComputedStyle(e).visibility !== "hidden").map((e) => { const r = e.getBoundingClientRect(); let w = r.width, h = r.height; for (const ps of ["::before", "::after"]) { const c = getComputedStyle(e, ps); if (c.content && c.content !== "none" && c.content !== "normal" && c.display !== "none" && c.position === "absolute") { w = Math.max(w, parseFloat(c.width) || 0); h = Math.max(h, parseFloat(c.height) || 0); } } return [e.className.toString().slice(0, 24) + " '" + e.textContent.trim().slice(0, 8) + "'", Math.round(w), Math.round(h)]; }).filter((x) => x[1] < 43.5 || x[2] < 43.5);
    const YEL = () => {
      const Y = /rgb\(245, 195, 59\)/, OK = ".zp-ck,.zc-ck,.zg-ck,.zg-num,.zp-new,.mx-newk,.k-nw,.k-ok,.k-gu", bad = [];
      document.querySelectorAll("#mapbox *, #sMini *, #lmPick *, .mx-strip *").forEach((e) => {
        if (!e.getClientRects().length) return; const cs = getComputedStyle(e);
        const y = Y.test(cs.backgroundColor) || (parseFloat(cs.borderTopWidth) > 0 && Y.test(cs.borderTopColor)) || Y.test(cs.boxShadow) || Y.test(cs.color) || (e instanceof SVGElement && (Y.test(cs.fill) || Y.test(cs.stroke)));
        if (!y || e.closest(OK)) return;
        if (e.matches(".zp-in,.zc-in") && e.parentElement.classList.contains("nw")) return;   // '새로' 노란 테두리
        bad.push(`${(e.className && e.className.baseVal != null ? e.className.baseVal : e.className).toString().slice(0, 30)}`);
      });
      ["::after", "::before"].forEach((ps) => document.querySelectorAll("#mapbox .s-rail>button, .mx-tg").forEach((e) => { if (Y.test(getComputedStyle(e, ps).backgroundColor)) bad.push(e.textContent.trim() + ps); }));
      const sel = [...document.querySelectorAll("#lmap .zpill.sel .zp-in, #lmap .zcard.sel .zc-in, #lmap .zp-fav, #lmap .zpill.fav .zp-in, #lmap .zcard.fav .zc-in")].filter((e) => Y.test(getComputedStyle(e).boxShadow + getComputedStyle(e).backgroundColor + getComputedStyle(e).borderTopColor)).length;
      let gl = []; try { const st = ZP_lmx.map().getStyle(); gl = st.layers.filter((l) => !/-nw$/.test(l.id) && /#F5C33B|245, ?195, ?59/i.test(JSON.stringify(l.paint || {}))).map((l) => l.id); } catch (e) {}
      return { bad: [...new Set(bad)], sel, gl };
    };
    for (const [w, h, fs, tapp] of [[390, 844, 100, 1], [390, 844, 130, 1], [360, 740, 100, 1], [360, 740, 130, 1], [412, 915, 100, 1], [412, 915, 130, 1], [390, 844, 100, 0]]) {
      const where = `${w} ${fs}%${tapp ? " 앱" : " 웹"}`, full = w === 390;
      const { ctx, p, errs } = await open(b, { w, h, tapp, fs });
      try {
        // 처음 로드: 카드 줄 닫힘
        const sd = await p.evaluate(() => { const c = document.querySelector(".mx-cnt"), s = document.getElementById("mxStrip"); return { exp: c && c.getAttribute("aria-expanded"), shown: !!(s && !s.hidden && s.offsetHeight) }; });
        expect(sd.exp === "false" && !sd.shown, "map.stripDefault", `${where}: 처음 aria-expanded ${sd.exp} · 카드 줄 보임 ${sd.shown}`);
        // 서울 줌 숫자 보장
        await p.waitForTimeout(800);
        const c = await p.evaluate(CITY);
        expect(c.has > 0 && c.num === c.has && !c.mism.length && c.sum + c.more === c.tgt, "map.guCountKept", `${where}: 갈 수 있는 구 라벨 ${c.has} · 숫자 보임 ${c.num} · 숫자≠이름 ${c.mism.join(",")} · 합 ${c.sum}+칩 ${c.more} vs 목록 ${c.tgt} · 단계 ${JSON.stringify(c.steps)}`);
        if (full || fs > 100) { const t = await p.evaluate(TAP44, ".zp-ph .zgu, #lmap .zgu"); expect(!t.length, "a11y.tap44", `${where} 서울 줌: ${t.slice(0, 5).map((x) => x.join(" ")).join(" · ")}`); }
        if (fs > 100) {
          const g = await p.evaluate(() => { const b = document.querySelector(".mx-cash b"), fsz = b ? parseFloat(getComputedStyle(b).fontSize) : 0, r = b && b.getBoundingClientRect(); const lg = [...document.querySelectorAll(".mx-lgb")].filter((e) => e.offsetWidth && getComputedStyle(e).visibility !== "hidden"); return { txt: b && b.textContent, h: r && Math.round(r.height), fsz, lg: lg.length, sw: document.scrollingElement.scrollWidth, iw: innerWidth, big: document.documentElement.classList.contains("fs-big") }; });
          expect(g.big && /2억/.test(g.txt) && g.h < g.fsz * 1.7 && g.lg === 1 && g.sw <= g.iw, "map.big130", `${where} 서울 줌: ${JSON.stringify(g)}`);
        }
        if (!full && fs === 100) { await ctx.close(); continue; }
        // 카드 줄 열기 → 카드에 숫자 번호 없음
        if (full && fs === 100) {
          await p.evaluate(() => document.querySelector(".mx-cnt").click()); await p.waitForTimeout(700);
          const st = await p.evaluate(() => { const s = document.getElementById("mxStrip"), c = document.querySelector(".mx-cnt"); const C = s ? [...s.querySelectorAll(".ms-c")] : []; return { exp: c.getAttribute("aria-expanded"), shown: !!(s && !s.hidden && s.offsetHeight), n: C.length, num: C.filter((e) => [...e.querySelectorAll("*")].some((x) => /^\s*\d+\s*\.?\s*$/.test(x.textContent))).length, sw: s ? s.querySelectorAll(".ms-sw button").length : 0, h: s ? Math.round(s.getBoundingClientRect().height) : 0 }; });
          expect(st.exp === "true" && st.shown && st.n > 0 && !st.num && st.sw === 2 && st.h === 132, "map.stripDefault", `${where} 열기: ${JSON.stringify(st)}`);
          await p.evaluate(() => document.querySelector(".mx-cnt").click()); await p.waitForTimeout(400);
        }
        await toGu(p, "성북구"); await idleMap(p); await p.waitForTimeout(600);
        // 구 줌
        const gz = await p.evaluate(() => {
          const P = [...document.querySelectorAll("#lmap .zpill")].filter((e) => e.offsetWidth), tl = document.querySelectorAll("#lmap .zpill.tl, #lmap .zcard.tl").length;
          const after = P.filter((e) => { const a = getComputedStyle(e.querySelector(".zp-in"), "::after"); return a.content !== "none" && a.content !== "normal" && a.display !== "none"; }).length;
          const ok = P.filter((e) => e.classList.contains("st-ok") && !e.classList.contains("yr")).length, ck = document.querySelectorAll("#lmap .zpill .zp-ck").length;
          const S = new Map(ZP_lmx.zst().map(([id, st]) => [id, st])), D = ZP_lmx.dots(), drop = D.filter((d) => S.get(d.id) !== d.t).map((d) => `${d.id} ${d.t}≠${S.get(d.id)}`);
          const m = ZP_lmx.map(), L = ["dong-lab", "stn-mj-lab", "stn-mid-lab", "stn-lab"].filter((l) => m.getLayer(l)), cv = m.getCanvas(), hits = [];
          let nd = 0; for (const d of D) { const ll = ZP_lmx.llOf(d.id); if (!ll) continue; const q = m.project(ll); if (q.x < 0 || q.y < 0 || q.x > cv.clientWidth || q.y > cv.clientHeight) continue; nd++; const f = m.queryRenderedFeatures([[q.x - 6, q.y - 6], [q.x + 6, q.y + 6]], { layers: L }); if (f.length) hits.push(`${d.id}:${f[0].properties.n}`); }
          return { n: P.length, tl, after, ok, ck, drop, nd, hits, z: m.getZoom() };
        });
        expect(gz.n > 0 && !gz.tl && !gz.after, "map.noTail", `${where} 구 줌: 태그 ${gz.n} · .tl ${gz.tl} · 꼬리 ::after ${gz.after}`);
        expect(gz.ok > 0 && gz.ok === gz.ck, "map.pickCheck", `${where} 구 줌: st-ok ${gz.ok} vs .zp-ck ${gz.ck}`);
        expect(!gz.drop.length && gz.nd > 0, "map.dropKeepsState", `${where}: ${gz.drop.slice(0, 5).join(" · ")} (화면 안 점 ${gz.nd})`);
        expect(!gz.hits.length, "map.nameAvoidDot", `${where} z${gz.z.toFixed(2)}: 점 ${gz.nd} 중 이름 겹침 ${gz.hits.length} · ${gz.hits.slice(0, 5).join(" · ")}`);
        { const t = await p.evaluate(TAP44, "#lmap .zpill .zp-in"); expect(!t.length, "a11y.tap44", `${where} 구 줌: ${t.slice(0, 5).map((x) => x.join(" ")).join(" · ")}`); }
        { const y = await p.evaluate(YEL); expect(!y.bad.length && !y.sel && !y.gl.length, "map.yellowOnly", `${where} 구 줌: 노랑 요소 ${y.bad.slice(0, 6).join(",")} · 선택·관심 노랑 ${y.sel} · GL ${y.gl.join(",")}`); }
        if (fs > 100) {
          const g = await p.evaluate(() => { const b = document.querySelector(".mx-cash b"), fsz = b ? parseFloat(getComputedStyle(b).fontSize) : 0, r = b && b.getBoundingClientRect(); const lg = [...document.querySelectorAll(".mx-lgb")].filter((e) => e.offsetWidth && getComputedStyle(e).visibility !== "hidden"); return { txt: b && b.textContent, h: r && Math.round(r.height), fsz, lg: lg.length, sw: document.scrollingElement.scrollWidth, iw: innerWidth }; });
          expect(/2억/.test(g.txt) && g.h < g.fsz * 1.7 && g.lg === 1 && g.sw <= g.iw, "map.big130", `${where} 구 줌: ${JSON.stringify(g)}`);
          const ax = await axeRun(p); if (ax) expect(!ax.length, "map.contrast", `${where} 구 줌 axe: ${ax.join(" ; ")}`);
          await ctx.close(); continue;
        }
        if (w !== 390) { await ctx.close(); continue; }
        // 다이얼: 그 구 갈 수 있는 곳이 모두 다이얼 위
        await p.evaluate(() => ZP_mx.dialOpen("cash")); await p.waitForTimeout(1200); await idleMap(p); await p.waitForTimeout(300);
        const dr = await p.evaluate(() => { const m = ZP_lmx.map(), cv = m.getCanvas().getBoundingClientRect(), dt = document.querySelector(".mx-dial").getBoundingClientRect().top, g = ZP_lmx.gu(), S = new Map(ZP_lmx.zst().map(([id, st]) => [id, st])); const out = []; let n = 0; (window.__ZPD ? __ZPD.recs : []).forEach((r) => { if (r.g !== g || S.get(r.id) !== "ok") return; const ll = ZP_lmx.llOf(r.id); if (!ll) return; n++; const q = m.project(ll), y = cv.top + q.y, x = cv.left + q.x; if (!(y > cv.top && y < dt && x > cv.left && x < cv.right)) out.push(`${r.id} y${Math.round(y)}`); }); return { n, out, dt: Math.round(dt), z: m.getZoom() }; });
        expect(dr.n > 0 && !dr.out.length, "map.dialReveal", `${where}: 갈 수 있는 곳 ${dr.n} · 다이얼 위 밖 ${dr.out.join(",")} · 다이얼 위 ${dr.dt} · z${dr.z.toFixed(2)}`);
        await p.evaluate(() => ZP_mx.dialClose()); await p.waitForTimeout(800); await idleMap(p);
        // 태그 누름 → 미리보기 → 라벨 점이 띠 안
        const tag = await p.evaluateHandle(() => [...document.querySelectorAll("#lmap .zpill.st-ok .zp-in")].sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0]);
        if (await p.evaluate((e) => !!e, tag)) { await tag.asElement().tap(); await p.waitForTimeout(1600); await idleMap(p); }
        const sr = await p.evaluate(() => { const id = ZP_lmx.peek(), m = ZP_lmx.map(); if (!id) return null; const cv = m.getCanvas().getBoundingClientRect(), q = m.project(ZP_lmx.llOf(id)), pk = document.querySelector("#lmPick:not([hidden])").getBoundingClientRect(), ch = document.querySelector(".mx-chips").getBoundingClientRect(); return { id, y: Math.round(cv.top + q.y), x: Math.round(cv.left + q.x), top: Math.round(ch.bottom), bot: Math.round(pk.top), W: innerWidth }; });
        expect(sr && sr.y > sr.top && sr.y < sr.bot && sr.x > 0 && sr.x < sr.W, "map.sheetReveal", `${where}: ${JSON.stringify(sr)}`);
        // 선택 상태 노랑 0
        { const y = await p.evaluate(YEL); expect(!y.bad.length && !y.sel && !y.gl.length, "map.yellowOnly", `${where} 고른 뒤: ${y.bad.slice(0, 6).join(",")} · 선택·관심 노랑 ${y.sel} · GL ${y.gl.join(",")}`); }
        await p.evaluate(() => ZP_lmx.pick(null)); await p.waitForTimeout(600);
        // 부족 시트 문장
        const fg = await p.evaluate(async () => { const g = ZP_lmx.gu(); const far = ZP_lmx.zst().find(([id, st, need]) => st === "far" && need != null && (window.__ZPD ? (__ZPD.recs.find((r) => r.id === id) || {}).g === g : true)); if (!far) return null; ZP_lmx.pick(far[0]); await new Promise((r) => setTimeout(r, 1500)); const e = document.querySelector("#lmPick:not([hidden])"); const vd = (e.querySelector(".pk-vd") || {}).textContent || "", amt = (e.querySelector(".pk-band .zp-v") || {}).textContent || "", F = ZP_lmx.fx(); const N = (t) => { t = String(t).replace(/약\s*|,/g, ""); const a = /([\d.]+)억(?:\s*([\d]+)만)?/.exec(t); if (a) return +a[1] + (a[2] ? +a[2] / 1e4 : 0); const m = /([\d]+)만/.exec(t); return m ? +m[1] / 1e4 : NaN; }; const X = (/^\+(.+?) 더 필요해요$/.exec(vd.trim()) || [])[1]; return { id: far[0], vd, amt, X, want: "+" + F.gap(far[2]) + " 더 필요해요", d: X ? Math.abs(N(X) - (N(amt) - F.CASH)) : 9 }; });
        expect(fg && fg.vd.trim() === fg.want && fg.d < 1e-6, "map.farGapText", `${where}: ${JSON.stringify(fg)}`);
        await p.evaluate(() => ZP_lmx.pick(null)); await p.waitForTimeout(600);
        // 구역 줌 카드
        await p.evaluate(() => ZP_lmx.map().jumpTo({ center: [127.0072, 37.5888], zoom: 14.15 })); await p.waitForTimeout(2500); await idleMap(p);
        const zz = await p.evaluate(() => { const C = [...document.querySelectorAll("#lmap .zcard")].filter((e) => e.offsetWidth); const after = C.filter((e) => { const a = getComputedStyle(e.querySelector(".zc-in"), "::after"); return a.content !== "none" && a.content !== "normal" && a.display !== "none"; }).length; return { n: C.length, tl: document.querySelectorAll("#lmap .zcard.tl").length, after, ok: C.filter((e) => e.classList.contains("st-ok")).length, ck: document.querySelectorAll("#lmap .zcard .zc-ck").length, ckPos: [...document.querySelectorAll("#lmap .zcard .zc-ck")].every((k) => { const a = k.getBoundingClientRect(), c = k.closest(".zc-in").getBoundingClientRect(); return a.right > c.right && a.top < c.top; }) }; });
        expect(zz.n > 0 && !zz.tl && !zz.after, "map.noTail", `${where} 구역 줌: 카드 ${zz.n} · .tl ${zz.tl} · ::after ${zz.after}`);
        expect(zz.ok > 0 && zz.ok === zz.ck && zz.ckPos, "map.pickCheck", `${where} 구역 줌: st-ok 카드 ${zz.ok} vs .zc-ck ${zz.ck} · 오른쪽 위 ${zz.ckPos}`);
        { const t = await p.evaluate(TAP44, "#lmap .zcard .zc-in"); expect(!t.length, "a11y.tap44", `${where} 구역 줌: ${t.slice(0, 5).map((x) => x.join(" ")).join(" · ")}`); }
        { const y = await p.evaluate(YEL); expect(!y.bad.length && !y.sel && !y.gl.length, "map.yellowOnly", `${where} 구역 줌: ${y.bad.slice(0, 6).join(",")} · ${y.sel} · GL ${y.gl.join(",")}`); }
        { const ax = await axeRun(p); if (ax) expect(!ax.length, "map.contrast", `${where} 구역 줌 axe: ${ax.join(" ; ")}`); }
        if (errs.length) bad("map.noTail", `${where} 페이지 오류: ${errs[0]}`);
      } catch (e) { bad("map.noTail", `${where} crashed: ${String(e.message || e).split("\n")[0]}`); }
      await ctx.close();
    }
    // 대비(토큰 · 라이트·다크) + 다크 axe
    for (const dark of [0, 1]) {
      const { ctx, p } = await open(b, { w: 390, h: 844, tapp: 1, dark });
      try {
        const sw = await p.evaluate(() => { const H = getComputedStyle(document.documentElement); return { name: H.getPropertyValue("--gu-name").trim(), none: H.getPropertyValue("--gu-none").trim() }; });
        await toGu(p, "성북구"); await idleMap(p);
        const t = await p.evaluate(() => { const L = document.getElementById("lmap"), d = document.createElement("div"); d.style.cssText = "position:absolute;left:-999px;top:0"; d.innerHTML = '<button class="zcard st-far"><span class="zc-in"><span class="zc-m"><em class="zc-g">부족</em></span></span></button><button class="zpill st-ok"><span class="zp-in"><b class="zp-v">1억</b></span></button>'; L.appendChild(d); const g = getComputedStyle(d.querySelector(".zc-g")), pi = getComputedStyle(d.querySelector(".zp-in")); const o = { chipFg: g.color, chipBg: g.backgroundColor, okBg: pi.backgroundColor, okSh: (/rgb\([^)]+\)/.exec(pi.boxShadow) || [""])[0] }; d.remove(); return o; });
        const r1 = ratio(t.chipFg, t.chipBg), r2 = ratio(t.okSh, t.okBg), r3 = ratio(hexRgb(sw.name), hexRgb(sw.none));
        expect(r1 >= 4.5 && r3 >= 4.5 && (!dark || r2 >= 3), "map.contrast", `${dark ? "다크" : "라이트"}: 부족 칩 ${r1.toFixed(2)} · 가능 태그 테두리/채움 ${r2.toFixed(2)} · 빈 구 이름 ${sw.name}/${sw.none} ${r3.toFixed(2)}`);
        const ax = await axeRun(p); if (ax) expect(!ax.length, "map.contrast", `${dark ? "다크" : "라이트"} 구 줌 axe: ${ax.join(" ; ")}`);
      } catch (e) { bad("map.contrast", `${dark ? "다크" : "라이트"} crashed: ${String(e.message || e).split("\n")[0]}`); }
      await ctx.close();
    }
  } finally { await b.close(); }
  let nf = 0;
  for (const [id, r] of R) { if (r.f.length) { nf++; console.log(`FAIL ${id} — ${r.f.length}/${r.n} · ${r.f.slice(0, 4).join(" | ")}`); } else console.log(`PASS ${id} — ${r.n}건${r.m.length ? " · " + r.m.slice(0, 2).join(" | ") : ""}`); }
  console.log(`qa_mapx ${nf ? "FAILED" : "PASSED"} · ${R.size} 검사 · ${Math.round((Date.now() - T0) / 1000)}s`);
  process.exit(nf ? 1 : 0);
})().catch((e) => { console.error("qa_mapx crashed:", e); process.exit(2); });
