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
const ONLY = process.env.QAF_ONLY || "";   // "alerts" = F9 화면만(개발용)
const wd = (p, ms, m) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(m || "timeout")), ms))]);
(async () => {
  const ref = JSON.parse(execFileSync("python3", [path.join(__dirname, "qa_feat_ref.py")], { maxBuffer: 1 << 28 }).toString());
  const b = await chromium.launch({ executablePath: EXE });
  try { if (!ONLY) {
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
    }
    // ---------- 5) F1 매물진단: 신축 쪼개기 위험 = 필지 준공연도·거래 직접 셈(파이썬 기준식) · 화면 줄 글자 = 셈 결과 · 규정 펼치기 · 지번 찾기 ----------
    if (!ONLY || ONLY === "diag") {
      const c5 = await b.newContext({ viewport: { width: 390, height: 844 } });
      await c5.route("**/*", (r) => (/^http:\/\/localhost/.test(r.request().url()) ? r.continue() : r.abort()));
      const p5 = await c5.newPage(); const perr5 = []; p5.on("pageerror", (e) => perr5.push(e.message));
      await wd(p5.goto(BASE + "/#map", { waitUntil: "domcontentloaded" }), 60000, "goto");
      await wd(p5.waitForFunction(() => window.ZP_boot && ZP_boot.hyd === 1 && window.ZP_feat, null, { timeout: 60000 }), 61000, "hyd");
      const got5 = await wd(p5.evaluate(async () => {
        const F = await ZP_feat.load(), ctx = ZP_feat.ctx(), T = await ctx.tx(), o = {}, rd = {};
        for (const r of ctx.R) { if (r.src === "moa" || r.s >= 9) continue; const rt = ctx.rights(r), pc = r.pcl ? await ctx.pcl(r.id) : null; const x = F.split(pc, T[r.id], rt); rd[r.id] = x.set ? x.rd : null; o[r.id] = [x.n, x.after, x.same, x.txn, x.txf, x.pct]; }
        return { o, rd };
      }), 300000, "split");
      const ref5 = JSON.parse(execFileSync("python3", [path.join(__dirname, "qa_feat_split.py")], { input: JSON.stringify(got5.rd), maxBuffer: 1 << 26 }).toString());
      const bad5 = Object.keys(got5.o).filter((id) => JSON.stringify(got5.o[id]) !== JSON.stringify(ref5[id])).map((id) => `${id} ${JSON.stringify(got5.o[id])} vs ${JSON.stringify(ref5[id])}`);
      const nz = Object.keys(got5.o).length, nA = Object.values(got5.o).filter((v) => v[1] > 0).length, nF = Object.values(got5.o).filter((v) => v[4] > 0).length;
      check(!bad5.length, "feat.split", `${bad5.length}곳 · ${bad5.slice(0, 4).join(" ; ")}`); log(`  split ${nz}곳 · 기준일 뒤 준공 필지 있음 ${nA} · 쪼개기 의심 거래 있음 ${nF}`);
      // 화면: 매물진단에서 구역 몇 곳을 골라 줄 글자·규정 펼치기 · 지번 찾기(필지 색인)
      const ZD = Object.keys(got5.o).filter((id) => got5.o[id][1] > 0).slice(0, 3).concat(Object.keys(got5.o).filter((id) => got5.rd[id] && got5.o[id][0] && !got5.o[id][1]).slice(0, 2));
      const bad6 = [];
      for (const [mode, cs] of [["web", "light"], ["app", "dark"]]) {
        const c6 = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, colorScheme: cs });
        await c6.addInitScript((m) => { if (m === "app") Object.defineProperty(Document.prototype, "referrer", { get: () => "android-app://kr.alwaysquestions.jaegaegak/" }); try { localStorage.setItem("zp.tonb", "1"); localStorage.setItem("zp.onb", "1"); } catch (e) {} }, mode);
        await c6.route("**/*", (r) => (/^http:\/\/localhost/.test(r.request().url()) ? r.continue() : r.abort()));
        const pg = await c6.newPage(); pg.on("pageerror", (e) => perr5.push(`${mode}: ${e.message}`));
        await wd(pg.goto(BASE + "/#diagTop", { waitUntil: "domcontentloaded" }), 60000, "goto");
        await wd(pg.waitForFunction(() => document.querySelector("#dgR .dg-l") && window.ZP_feat, null, { timeout: 30000 }), 31000, "diag");
        for (const id of ZD) {
          const s = await wd(pg.evaluate(async (id) => {
            const ctx = ZP_feat.ctx(), r = ctx.byId[id], q = document.getElementById("dgQ");
            q.value = ctx.shortName(r.n); q.dispatchEvent(new Event("input"));
            const b = [...document.querySelectorAll("#dgS [data-d]")].find((x) => x.dataset.d === id); if (!b) return { miss: 1 };
            b.click();
            for (let i = 0; i < 60 && !document.querySelector('#dgR [data-f="split"]'); i++) await new Promise((r) => setTimeout(r, 100));
            const li = document.querySelector('#dgR [data-f="split"]'), dt = document.querySelector('#dgR [data-f="rules"]');
            const ov = [...document.querySelectorAll("#dgR, #dgR *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length;
            const F = window.ZPF, pc = await ctx.pcl(id), T = await ctx.tx(), exp = F.splitItem(F.split(pc, T[id], ctx.rights(r)), ctx);
            const prevLabel = li && li.previousElementSibling ? li.previousElementSibling.textContent : "";
            return { txt: li ? li.querySelector("small").textContent : null, exp: exp ? exp.t : null, cls: li && li.className, ecls: exp && exp.cls, rules: !!(dt && dt.querySelector(".rules-g")), dupId: dt ? dt.querySelectorAll("[id]").length : -1, ov, prevOk: /권리산정기준일/.test(prevLabel) };
          }, id), 30000, "pick");
          if (s.miss) { bad6.push(`${mode} ${id} 검색에 안 나옴`); continue; }
          if (!s.txt || !s.txt.startsWith(s.exp) || s.cls !== s.ecls || !s.prevOk) bad6.push(`${mode} ${id} 줄 ${s.cls}/${s.ecls} '${(s.txt || "").slice(0, 60)}' 위치 ${s.prevOk}`);
          if (!s.rules || s.dupId) bad6.push(`${mode} ${id} 규정 펼치기 ${s.rules} 아이디 ${s.dupId}`);
          if (s.ov) bad6.push(`${mode} ${id} 가로 넘침 ${s.ov}`);
        }
        // 지번 찾기: 필지 목록의 첫 지번 → 그 구역이 결과에 있어야
        const id0 = ZD[0];
        const j = await wd(pg.evaluate(async (id) => {
          const ctx = ZP_feat.ctx(), pc = await ctx.pcl(id); if (!pc || !pc.p.length) return { skip: 1 };
          const x = pc.p[0], qv = `${pc.d[x[0]]} ${x[1]}`, q = document.getElementById("dgQ");
          q.value = qv; q.dispatchEvent(new Event("input"));
          for (let i = 0; i < 50 && !document.querySelector("#dgS [data-d]") && !/밖이에요/.test(document.getElementById("dgS").textContent); i++) await new Promise((r) => setTimeout(r, 100));
          return { qv, ids: [...document.querySelectorAll("#dgS [data-d]")].map((b) => b.dataset.d) };
        }, id0), 20000, "jibun");
        if (!j.skip && !j.ids.includes(id0)) bad6.push(`${mode} 지번 '${j.qv}' → ${j.ids} (${id0} 없음)`);
        await pg.screenshot({ path: `${process.env.QAF_SHOTS || "/tmp"}/f1_${mode}_${cs}.png` }).catch(() => {});
        await c6.close();
      }
      check(!bad6.length, "feat.diag", bad6.slice(0, 5).join(" ; "));
      check(!perr5.length, "feat.errors5", perr5.slice(0, 3).join(" | "));
      await c5.close();
    }
    // ---------- 4) F9 알림 세부 설정(MY): 구역별·조건별 끄기 → 소식·배지·폰 알림 목록(서버로 보내는 것)에서 빠짐 · 미리 보기 수 = 소식 자료 직접 셈 ----------
    if (!ONLY || ONLY === "alerts") {
      const CH = JSON.parse(require("fs").readFileSync(path.join(__dirname, "..", "public", "data", "changes.json"), "utf8"));
      const day = () => new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
      const addDay = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
      const d0 = addDay(day(), -6), TY = new Set(["stage", "trade", "notice", "auction"]);
      const wk = CH.items.filter((e) => e.date >= d0 && TY.has(e.type));
      const cnt = {}; wk.forEach((e) => (cnt[e.id] = (cnt[e.id] || 0) + 1));
      const cand = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || (a < b ? -1 : 1)).slice(0, 6).concat(["o127", "o637"]);
      const expOf = (ids) => { const P = new Set(ids), s = new Set(); return wk.filter((e) => P.has(e.id)).filter((e) => { const k = `${e.id}|${e.date}|${e.type}|${e.text}`; if (s.has(k)) return false; s.add(k); return true; }); };
      const bad4 = [], perr4 = [];
      const COND = [{ id: "cqa1", cash: 3, mode: "loan", base: [], at: Date.now() - 60 * 864e5, seen: "", asOf: "" }];
      for (const mode of ["web", "app"]) for (const cs of ["light", "dark"]) {
        const w = `${mode}/${cs}`;
        const c4 = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, colorScheme: cs });
        await c4.addInitScript(([m, fav, cond]) => { if (m === "app") Object.defineProperty(Document.prototype, "referrer", { get: () => "android-app://kr.alwaysquestions.jaegaegak/" }); try { if (!sessionStorage.getItem("qa4")) { sessionStorage.setItem("qa4", "1"); localStorage.clear(); localStorage.setItem("zp.tonb", "1"); localStorage.setItem("zp.onb", "1"); localStorage.setItem("jg-fav", JSON.stringify(fav)); localStorage.setItem("zp-cond", JSON.stringify(cond)); } } catch (e) {} }, [mode, cand, COND]);
        await c4.route("**/*", (r) => (/^http:\/\/localhost/.test(r.request().url()) ? r.continue() : r.abort()));
        const pg = await c4.newPage(); pg.on("pageerror", (e) => perr4.push(`${w}: ${e.message}`));
        try {
          await wd(pg.goto(BASE + "/#my", { waitUntil: "domcontentloaded" }), 60000, "goto");
          await wd(pg.waitForFunction(() => document.querySelector("#myMute .zal-c b"), null, { timeout: 30000 }), 31000, "myMute");
          const st = () => pg.evaluate(() => {
            const I = window.ZP_INBOX, box = document.getElementById("myMute");
            const z = [...box.querySelectorAll("[data-mz]")].map((x) => [x.dataset.mz, x.getAttribute("aria-checked")]), c = [...box.querySelectorAll("[data-mc]")].map((x) => [x.dataset.mc, x.getAttribute("aria-checked")]);
            const pl = I.payloadOf(), d0 = I.d0();
            const ov = [...document.querySelectorAll("#myMute, #myMute *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length;
            return { pins: window.PINS.list(), z, c, shown: +box.querySelector(".zal-c b").textContent.replace(/[^\d]/g, ""), out: (/꺼 둔 설정으로 ([\d,]+)건/.exec(box.querySelector(".zal-c").textContent) || [0, "0"])[1].replace(/,/g, "") | 0,
              zones: pl.zones, conds: pl.conds.length, pinEv: I.pinEvents().map((e) => e.id), auc: I.condAuc().filter((e) => e.date >= d0).length, d0, ov, docW: document.documentElement.scrollWidth };
          });
          let s = await st();
          if (s.d0 !== d0) bad4.push(`${w} d0 ${s.d0} vs ${d0}`);
          const E = expOf(s.pins);
          if (s.z.length !== s.pins.length || s.c.length !== 1) bad4.push(`${w} 스위치 구역 ${s.z.length}/${s.pins.length} 조건 ${s.c.length}`);
          if (s.shown !== E.length + s.auc || s.out) bad4.push(`${w} 처음 미리 보기 ${s.shown} vs ${E.length}+${s.auc} · 빠짐 ${s.out}`);
          if (s.ov || s.docW > 361) bad4.push(`${w} 가로 넘침 ${s.ov} · ${s.docW}`);
          await pg.screenshot({ path: `${process.env.QAF_SHOTS || "/tmp"}/f9_${mode}_${cs}_0.png`, fullPage: false }).catch(() => {});
          // 1) 첫 구역 끄기
          const z0 = s.pins[0], n0 = E.filter((e) => e.id === z0).length;
          await pg.evaluate((id) => { const x = document.querySelector(`#myMute [data-mz="${id}"]`); x.scrollIntoView({ block: "center" }); x.click(); }, z0); await pg.waitForTimeout(400);
          s = await st();
          const m1 = await pg.evaluate(() => JSON.parse(localStorage.getItem("zp-alert-mute") || "{}"));
          if (!(m1.z || []).includes(z0) || s.zones.includes(z0) || s.zones.length !== s.pins.length - 1 || s.pinEv.includes(z0)) bad4.push(`${w} 구역 끄기: 저장 ${JSON.stringify(m1)} · 폰 알림 목록 ${s.zones.includes(z0)} · 소식 ${s.pinEv.includes(z0)}`);
          if (s.shown !== E.length - n0 + s.auc || s.out !== n0) bad4.push(`${w} 구역 끈 뒤 미리 보기 ${s.shown} vs ${E.length - n0}+${s.auc} · 빠짐 ${s.out}/${n0}`);
          if ((s.z.find((x) => x[0] === z0) || [])[1] !== "false") bad4.push(`${w} 구역 스위치 상태`);
          await pg.screenshot({ path: `${process.env.QAF_SHOTS || "/tmp"}/f9_${mode}_${cs}_1.png` }).catch(() => {});
          // 2) 조건 끄기
          await pg.evaluate(() => { const x = document.querySelector("#myMute [data-mc]"); x.scrollIntoView({ block: "center" }); x.click(); }); await pg.waitForTimeout(400);
          s = await st();
          if (s.conds !== 0 || s.auc !== 0 || s.shown !== E.length - n0) bad4.push(`${w} 조건 끄기: 폰 알림 조건 ${s.conds} · 경매 ${s.auc} · 미리 보기 ${s.shown}`);
          // 3) 다시 열어도 그대로 → 다시 켜면 원래대로
          await pg.reload({ waitUntil: "domcontentloaded" }); await wd(pg.waitForFunction(() => document.querySelector("#myMute .zal-c b"), null, { timeout: 30000 }), 31000, "reload");
          s = await st();
          if ((s.z.find((x) => x[0] === z0) || [])[1] !== "false" || s.c[0][1] !== "false") bad4.push(`${w} 다시 연 뒤 상태 ${JSON.stringify(s.z[0])} ${JSON.stringify(s.c[0])}`);
          await pg.evaluate((id) => { document.querySelector(`#myMute [data-mz="${id}"]`).click(); }, z0); await pg.waitForTimeout(300);
          await pg.evaluate(() => { document.querySelector("#myMute [data-mc]").click(); }); await pg.waitForTimeout(400);
          s = await st();
          if (s.zones.length !== s.pins.length || s.conds !== 1 || s.shown !== E.length + s.auc || s.out) bad4.push(`${w} 다시 켠 뒤 ${s.zones.length}/${s.pins.length} 조건 ${s.conds} 미리 보기 ${s.shown}`);
          if (mode === "web" && cs === "light") log(`  alerts 구역 ${s.pins.length} · 7일 소식 ${E.length} · 조건 경매 ${s.auc} · 끈 구역 ${z0} ${n0}건`);
        } catch (e) { bad4.push(`${w} ${e.message}`); }
        await c4.close();
      }
      check(!bad4.length, "feat.alerts", bad4.slice(0, 6).join(" ; "));
      check(!perr4.length, "feat.errors4", perr4.slice(0, 3).join(" | "));
    }
  } catch (e) { check(false, "feat.crash", String(e.message || e).split("\n")[0]); }
  await b.close();
  log(fails.length ? `FAILED ${fails.length}: ${fails.join(", ")}` : "PASSED");
  process.exit(fails.length ? 1 : 0);
})();
