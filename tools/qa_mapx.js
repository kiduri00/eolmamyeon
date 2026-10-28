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
   mapx.layers6  레이어 단추 6개(이름표 그대로) · 켬 = aria-pressed + 남색 채움 + 노란 점(색 말고 점으로도) · 넘기지 않아도 6개가 다 보임 */
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

async function open(b, { w, h, dark, tapp, cpu, cash = 2 }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: dark ? "dark" : "light", isMobile: w < 981, hasTouch: w < 981, serviceWorkers: "block" });
  if (tapp) await ctx.addInitScript(TAPP);
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
        const c = await p.evaluate(() => { const L0 = (window.ZP_lmx ? ZP_lmx.labels() : []).filter((x) => x.k === "gu"), seen = new Set(), L = L0.filter((x) => !seen.has(x.id) && seen.add(x.id)); const box = (document.querySelector(".zp-ph") || document.querySelector("#lmap")).getBoundingClientRect(); let ov = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i].b, d = L[j].b; if (a[0] < d[2] - 1 && d[0] < a[2] - 1 && a[1] < d[3] - 1 && d[1] < a[3] - 1) ov++; } const out = L.filter((x) => x.b[0] < box.left + 5.5 || x.b[2] > box.right - 5.5).map((x) => x.t); const sum = L.reduce((a, x) => a + (/\d+곳/.test(x.t) ? +(x.t.match(/(\d+)곳/) || [0, 0])[1] : 0), 0); const two = L.filter((x) => /~/.test(x.t)); return { n: L.length, ov, out, sum, two: two.length, cnt: window.ZP_count ? ZP_count() : -1, ghost: !!document.querySelector(".zp-ph"), more: window.ZP_G && ZP_G.more ? ZP_G.more() : 0 }; });
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
          cards.forEach((e) => { const st = (e.className.match(/st-(\w+)/) || [])[1], g = (e.querySelector(".zc-g") || {}).textContent || "", v = (e.querySelector(".zp-v") || {}).textContent || ""; const W = { ok: /^가능$/, near: /^\+ 부족$/, far: /^부족$/, no: /✕/, na: /^보류$/, moa: /모아타운/ }; if (W[st] && !W[st].test(g)) o.bad.push(`card ${st} chip '${g}'`); if (st === "near" && !/^\+/.test(v)) o.bad.push(`card near value '${v}'`); const cs = getComputedStyle(e.querySelector(".zc-in")); if (st === "na" && cs.borderTopStyle !== "dashed") o.bad.push("card na not dashed"); if (st === "moa" && cs.borderTopStyle !== "dashed") o.bad.push("card moa not dashed"); });
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
        const s = await p.evaluate(() => { const st = ZP_lmx.map().getStyle(), L = {}; st.layers.forEach((l) => (L[l.id] = l)); const pc = (id, k) => L[id] && L[id].paint && L[id].paint[k]; return { bg: pc("bg", "background-color"), art: pc("art", "line-color"), artc: pc("art-c", "line-color"), water: pc("water", "fill-color"), park: pc("park", "fill-color"), place: !!L.place, yellow: JSON.stringify(st.layers).match(/#FBE3A6|#E0BE6A/gi), sub: [pc("subway", "line-opacity"), L.subway && L.subway.minzoom], dong: [L["dong-lab"] && L["dong-lab"].layout["text-size"], pc("dong-lab", "text-color"), pc("dong-lab", "text-halo-color")], stn: L["stn-mj-lab"] && L["stn-mj-lab"].layout["text-size"], zcase: !!L["zone-case"], sel: pc("sel-line", "line-color") }; });
        const W = dark ? { bg: "#10161E", art: "#3A4759", artc: "#1A222D", water: "#183A58", park: "#193020" } : { bg: "#ECEEF1", art: "#D5DBE3", artc: "#A3ADBA", water: "#B0CCE6", park: "#CDE2C8" };
        const tokBad = Object.keys(W).filter((k) => String(s[k]).toUpperCase() !== W[k]);
        expect(!tokBad.length && !s.place && !s.yellow && s.sub[0] === 0.35 && s.sub[1] === 12 && s.dong[0] === 12 && s.stn === 12 && s.zcase && s.sel === "#F5C33B", "mapx.base", `${dark ? "다크" : "라이트"}: ${tokBad.map((k) => `${k} ${s[k]}≠${W[k]}`).join(" ")} ${JSON.stringify(s)}`);
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
  } finally { await b.close(); }
  let nf = 0;
  for (const [id, r] of R) { if (r.f.length) { nf++; console.log(`FAIL ${id} — ${r.f.length}/${r.n} · ${r.f.slice(0, 4).join(" | ")}`); } else console.log(`PASS ${id} — ${r.n}건${r.m.length ? " · " + r.m.slice(0, 2).join(" | ") : ""}`); }
  console.log(`qa_mapx ${nf ? "FAILED" : "PASSED"} · ${R.size} 검사 · ${Math.round((Date.now() - T0) / 1000)}s`);
  process.exit(nf ? 1 : 0);
})().catch((e) => { console.error("qa_mapx crashed:", e); process.exit(2); });
