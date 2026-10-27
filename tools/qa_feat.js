#!/usr/bin/env node
/* renew-feat QA — 새 기능(F2 단계 타임라인 · F3 사업 정보 카드 · F4 근처 구역 추천 · F5 가격 흐름) 숫자 전수 대조 + 화면 검사
   usage: NODE_PATH=$(npm root -g) node tools/qa_feat.js http://localhost:8777
   1) 화면 함수(ZPF.tl · ZPF.org · ZPF.px)를 구역 전체에 돌려 파이썬 기준식(tools/qa_feat_ref.py)과 대조(0 불일치)
   2) 근처 구역 추천: 1km · 같은 유형 · 단계 ±1 · 진행 중 · 돈 적은 순 · 돈 = 시트 '지금 필요한 돈'(DTL.nums)과 같은 값 · 화면 글자 = ZF.cash
   3) 화면: 웹·앱 × 밝게·어둡게 × 360px — 일정·입지·거래 탭에 블록이 붙고 가로 넘침 0 · 페이지 오류 0 */
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const path = require("path");
const BASE = process.argv[2] || "http://localhost:8777";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const fails = [], log = (...a) => console.log(...a);
const check = (ok, id, msg) => { log(`${ok ? "PASS" : "FAIL"} ${id}${ok ? "" : " — " + msg}`); if (!ok) fails.push(id); };
const wd = (p, ms, m) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(m || "timeout")), ms))]);
(async () => {
  const ref = JSON.parse(execFileSync("python3", [path.join(__dirname, "qa_feat_ref.py")], { maxBuffer: 1 << 28 }).toString());
  const b = await chromium.launch({ executablePath: EXE });
  try {
    // ---------- 1) 숫자 전수 대조 ----------
    const c = await b.newContext({ viewport: { width: 390, height: 844 } });
    await c.route("**/*", (r) => (/^http:\/\/localhost/.test(r.request().url()) ? r.continue() : r.abort()));
    const p = await c.newPage(); const perr = []; p.on("pageerror", (e) => perr.push(e.message));
    await wd(p.goto(BASE + "/#map", { waitUntil: "domcontentloaded" }), 60000, "goto");
    await wd(p.waitForFunction(() => window.ZP_boot && ZP_boot.hyd === 1 && window.ZP_feat, null, { timeout: 60000 }), 61000, "hyd");
    const got = await wd(p.evaluate(async () => {
      const F = await ZP_feat.load(), ctx = ZP_feat.ctx(), P = await (await fetch("premium.json")).json(), TXD = await ctx.tx();
      const r4 = (v) => Math.round(v * 1e4) / 1e4;
      const merged = (r) => { const pp = P[r.id] || {}, m = Object.assign(Object.create(Object.getPrototypeOf(r)), r); ["dt", "b", "cafe"].forEach((k) => { if (pp[k] !== undefined) m[k] = pp[k]; }); m.sm = Object.assign({}, r.sm || {}, pp.sm || {}); if (pp.cs && r.cs) { m.cs = {}; Object.keys(r.cs).forEach((k) => (m.cs[k] = Object.assign({}, r.cs[k], pp.cs[k] || {}))); } return m; };
      const tl = {}, org = {}, px = {};
      ctx.R.forEach((r) => {
        if (r.src === "moa") return;
        const m = merged(r), T = F.tl(m, ctx);
        if (T) tl[r.id] = { gaps: T.gaps.map((g) => [g.a, g.b, r4(g.yrs), g.st ? g.st.med : null, g.lvl]), next: T.next ? [T.next.k, r4(T.next.lo), r4(T.next.hi), T.next.state] : null };
        const o = F.org(m, ctx); org[r.id] = { builder: o.builder, consent: o.consent ? o.consent.v : null, owners: o.owners, units: o.units, sale: o.sale, far: o.far };
      });
      Object.keys(TXD).forEach((id) => {
        const z = TXD[id]; if (!z || !Array.isArray(z.s) || z.s.length < 3) return;
        const q = {}; ["v", "a"].forEach((bs) => { q[bs] = {}; ["all", "s", "m", "l", "x"].forEach((ak) => { q[bs][ak] = F.px(z, bs, ak).qs.map((x) => [x.q, x.m, x.n]); }); });
        px[id] = { q, jr: F.px(z, "v", "all").jr.map((x) => [x.q, x.r]) };
      });
      return { tl, org, px };
    }), 240000, "eval");
    const near = (a, b) => (a == null && b == null) || (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= 1e-3 : a === b);
    const cmpArr = (x, y) => JSON.stringify(x.length) === JSON.stringify(y.length) && x.every((v, i) => Array.isArray(v) ? cmpArr(v, y[i]) : near(v, y[i]));
    { const bad = []; const ids = new Set([...Object.keys(ref.tl), ...Object.keys(got.tl)]);
      ids.forEach((id) => { const a = ref.tl[id], g = got.tl[id]; if (!a || !g || !cmpArr(a.gaps, g.gaps) || !((a.next == null && g.next == null) || (a.next && g.next && cmpArr(a.next, g.next)))) bad.push(`${id} ref ${JSON.stringify(a)} 화면 ${JSON.stringify(g)}`); });
      check(!bad.length && ids.size > 600, "feat.tl", `단계 타임라인 ${ids.size}곳 중 ${bad.length} 불일치 · ${bad.slice(0, 3).join(" ; ")}`); log(`  tl ${ids.size}곳`); }
    { const bad = []; Object.keys(ref.org).forEach((id) => { const a = ref.org[id], g = got.org[id]; if (!g || Object.keys(a).some((k) => !near(a[k], g[k]))) bad.push(`${id} ${JSON.stringify(a)} vs ${JSON.stringify(g)}`); });
      check(!bad.length && Object.keys(ref.org).length > 1000, "feat.org", `사업 정보 ${Object.keys(ref.org).length}곳 중 ${bad.length} 불일치 · ${bad.slice(0, 3).join(" ; ")}`); log(`  org ${Object.keys(ref.org).length}곳`); }
    { const bad = []; let n = 0; Object.keys(ref.px).forEach((id) => { const a = ref.px[id], g = got.px[id]; if (!g) { bad.push(id + " 화면 없음"); return; }
        ["v", "a"].forEach((bs) => Object.keys(a.q[bs]).forEach((ak) => { n++; if (!cmpArr(a.q[bs][ak], g.q[bs][ak])) bad.push(`${id} ${bs}/${ak} ${JSON.stringify(a.q[bs][ak]).slice(0, 80)} vs ${JSON.stringify(g.q[bs][ak]).slice(0, 80)}`); }));
        if (!cmpArr(a.jr, g.jr)) bad.push(`${id} 전세가율 ${JSON.stringify(a.jr)} vs ${JSON.stringify(g.jr)}`); });
      check(!bad.length && Object.keys(ref.px).length > 500, "feat.px", `가격 흐름 ${Object.keys(ref.px).length}곳 · ${n}조합 중 ${bad.length} 불일치 · ${bad.slice(0, 3).join(" ; ")}`); log(`  px ${Object.keys(ref.px).length}곳 · 기준×면적 ${n}조합`); }
    // ---------- 2) 근처 구역 추천 ----------
    const nr = await wd(p.evaluate(async () => {
      const F = await ZP_feat.load(), ctx = ZP_feat.ctx(), out = [];
      const hav = (a, b) => { const R0 = 6371000, t = Math.PI / 180, x = Math.sin(((b[0] - a[0]) * t) / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(((b[1] - a[1]) * t) / 2) ** 2; return 2 * R0 * Math.asin(Math.sqrt(x)); };
      let n = 0, withRec = 0;
      ctx.R.forEach((r) => {
        if (r.src === "moa" || !r.ll || ctx.isDone(r) || r.dn) return; n++;
        const L = F.near(r, ctx); if (L.length) withRec++;
        let prev = -Infinity;
        L.forEach(({ q, d, n: m }) => {
          const nm = ctx.nums(q), v = nm.need != null ? nm.need : nm.lnow;
          if (q === r || q.src === "moa" || ctx.isDone(q) || q.dn) out.push(`${r.id}→${q.id} 대상 아님`);
          if (ctx.shape(q) !== ctx.shape(r)) out.push(`${r.id}→${q.id} 유형 다름`);
          if (Math.abs(q.s - r.s) > 1) out.push(`${r.id}→${q.id} 단계 차이`);
          if (Math.abs(hav(r.ll, q.ll) - d) > 1 || d > 1000) out.push(`${r.id}→${q.id} 거리 ${d}`);
          if (v == null || Math.abs(v - m.v) > 1e-9) out.push(`${r.id}→${q.id} 돈 ${m.v} vs 시트 ${v}`);
          if (m.v < prev - 1e-12) out.push(`${r.id} 순서`); prev = m.v;
        });
        if (L.length > 5) out.push(`${r.id} ${L.length}곳`);
      });
      return { out, n, withRec };
    }), 240000, "near");
    check(!nr.out.length && nr.withRec > 100, "feat.near", `${nr.n}곳 중 추천 있는 곳 ${nr.withRec} · ${nr.out.length} 위반 · ${nr.out.slice(0, 4).join(" ; ")}`); log(`  near ${nr.n}곳 · 추천 있음 ${nr.withRec}`);
    check(!perr.length, "feat.errors1", perr.slice(0, 3).join(" | "));
    await c.close();
    // ---------- 3) 화면: 웹·앱 × 밝게·어둡게 × 360 ----------
    const ZS = ["o127", "o637", "o317", "o58", "o497", "s43", "o1176", "o909"];
    const bad = []; const perr2 = [];
    for (const mode of ["web", "app"]) for (const cs of ["light", "dark"]) {
      const c2 = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, colorScheme: cs });
      await c2.addInitScript((m) => { if (m === "app") Object.defineProperty(Document.prototype, "referrer", { get: () => "android-app://kr.alwaysquestions.jaegaegak/" }); try { localStorage.setItem("zp.tonb", "1"); localStorage.setItem("zp.onb", "1"); } catch (e) {} }, mode);
      await c2.route("**/*", (r) => (/^http:\/\/localhost/.test(r.request().url()) ? r.continue() : r.abort()));
      const pg = await c2.newPage(); pg.on("pageerror", (e) => perr2.push(`${mode}/${cs}: ${e.message}`));
      for (const id of ZS) {
        try {
          await wd(pg.goto(BASE + "/#" + id, { waitUntil: "domcontentloaded" }), 60000, "goto"); await pg.waitForTimeout(3500);
          for (const tab of ["biz", "loc", "tx"]) {
            await pg.evaluate((t) => { const x = document.getElementById("tab-" + t); if (x) x.click(); }, tab); await pg.waitForTimeout(tab === "tx" ? 2500 : 1500);
            const s = await wd(pg.evaluate(async (t) => {
              const F = window.ZPF, ctx = ZP_feat.ctx(), r = ctx.cur(), pane = document.getElementById("pane"); if (!r || !pane) return { skip: 1 };
              const has = (k) => !!pane.querySelector(`[data-f="${k}"]`);
              const ov = [...pane.querySelectorAll("[data-f], [data-f] *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".zpx-cs")).length;
              const o = { ov, docW: document.documentElement.scrollWidth, w: innerWidth };
              if (t === "biz") { o.tlWant = !!(F && F.tl(r, ctx) && (F.tl(r, ctx).gaps.length || F.tl(r, ctx).next)); o.tl = has("timeline"); o.org = has("org"); o.facts = !!pane.querySelector("dl.facts"); }
              if (t === "loc") { const L = F ? F.near(r, ctx) : []; o.nWant = L.length; o.n = has("near") ? pane.querySelectorAll('[data-f="near"] .znr-i').length : 0;
                o.nTxt = has("near") ? [...pane.querySelectorAll('[data-f="near"] .znr-v b')].map((x) => x.textContent) : []; o.nExp = L.map((x) => ctx.ZF.cash(x.n.v)); }
              if (t === "tx") { const z = (await ctx.tx())[r.id]; o.pWant = !!(z && z.s && z.s.length >= 3); o.p = has("price"); }
              return o;
            }, tab), 20000, "eval");
            if (s.skip) continue;
            const w = `${mode}/${cs}/${id}/${tab}`;
            if (s.ov || s.docW > s.w + 1) bad.push(`${w} 가로 넘침 ${s.ov}개 · 문서 ${s.docW}`);
            if (tab === "biz" && (s.tl !== s.tlWant || !s.org || s.facts)) bad.push(`${w} 타임라인 ${s.tl}/${s.tlWant} 카드 ${s.org} 옛 목록 ${s.facts}`);
            if (tab === "loc" && (s.n !== s.nWant || JSON.stringify(s.nTxt) !== JSON.stringify(s.nExp))) bad.push(`${w} 추천 ${s.n}/${s.nWant} 글자 ${s.nTxt} vs ${s.nExp}`);
            if (tab === "tx" && s.p !== s.pWant) bad.push(`${w} 가격 흐름 ${s.p}/${s.pWant}`);
          }
        } catch (e) { bad.push(`${mode}/${cs}/${id} ${e.message}`); }
      }
      await c2.close();
    }
    check(!bad.length, "feat.render", bad.slice(0, 6).join(" ; "));
    check(!perr2.length, "feat.errors2", perr2.slice(0, 3).join(" | "));
  } catch (e) { check(false, "feat.crash", String(e.message || e).split("\n")[0]); }
  await b.close();
  log(fails.length ? `FAILED ${fails.length}: ${fails.join(", ")}` : "PASSED");
  process.exit(fails.length ? 1 : 0);
})();
