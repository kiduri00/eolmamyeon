#!/usr/bin/env node
/* 사이클 3 문장 대조 QA — 구역마다 ZoneFacts(판단 한 객체)와 화면·/z·API의 숫자·판단 문장을 전 구역 대조(0 불일치가 기준)
   usage: NODE_PATH=$(npm root -g) node tools/qa_facts.js http://localhost:8941 [--json out.json]
   facts.calc   앱 ZoneFacts(ZP_facts) = calc.json f(정적 생성기가 읽는 값) — 입주 글자·10년 확률·정체·다음 단계·보류 이유·전세가율
   facts.sheet  시트를 실제로 열어(웹 390px · 전세 끼고 기본) 화면 글자와 대조
                 머리 '언제 입주' = eta.txt · 보류면 첫 칸 근거 = hold.now.txt · 신뢰 줄 = hold.one.short · 다른 보류 이유 문장이 같은 머리에 없음
                 일정 탭 큰 칸 '예상 입주' = eta.txt · '10년 안 준공' = p10Txt(없으면 숫자 % 없음) · '이미 가진 집이면' 다음 단계 = next.txt · F2 다음 단계 이름 = next.toName
   facts.z      정적 /z/<id>.html: '언제 입주'·보류 이유·10년 확률(정체·숨김이면 % 없음)
   facts.api    /api/v1/zones.json: facts·completion = ZoneFacts
   facts.glue   이어 붙인 문장 패턴(괄호 뒤 '뒤에', '0곳뿐', '· ·', '이전 이전') — 시트·/z 글자 전체
   facts.urls   앱이 만드는 공유 주소(공유 버튼·구역 공유·관심 링크·비교·시나리오·옮기기)의 ? 부분에 cash·inc·sv 같은 조건이 없음 */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const BASE = process.argv[2] || "http://localhost:8941";
const OUTJ = (() => { const i = process.argv.indexOf("--json"); return i > 0 ? process.argv[i + 1] : null; })();
const ROOT = path.join(__dirname, "..");
const ONLY = process.env.QAF_IDS ? process.env.QAF_IDS.split(",") : null, MIN = ONLY ? 0 : 900;
const fails = [], res = {}, log = (...a) => console.log(...a);
const check = (ok, id, msg, n) => { log(`${ok ? "PASS" : "FAIL"} ${id}${ok ? "" : " — " + msg}`); if (n != null) log(`  ${id}: ${n}곳`); res[id] = { ok, msg: ok ? "" : msg, n }; if (!ok) fails.push(id); };
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const GLUE = [/[가-힣]\)\s*뒤에 산/, /\b0곳뿐/, /·\s*·/, /이전 이전/, /\(\s*\)/, /undefined|NaN|null원|\[object/];
// 보류 이유 코드별 문장(다른 코드의 문장이 같은 머리에 나오면 '이유 여럿')
const HOLD_ALT = ["매수가로 쓸 거래가 없어", "이주·철거가 시작됐어요", "입주 시점·신축 시세 자료가 부족해요", "주변 신축 실거래가 없어 입주 때 시세를 못 정했어요"];
(async () => {
  const C = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/calc.json"), "utf8"));
  const API = JSON.parse(fs.readFileSync(path.join(ROOT, "public/api/v1/zones.json"), "utf8")); const A = {}; (API.items || []).forEach((z) => (A[z.id] = z));
  const b = await chromium.launch();
  const cx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await cx.addInitScript(() => { try { localStorage.setItem("zp.tonb", "1"); localStorage.setItem("zp.onb", "1"); } catch (e) {} });
  await cx.route("**/*", (r) => (/^http:\/\/(localhost|127\.0\.0\.1)/.test(r.request().url()) ? r.continue() : r.abort()));
  const p = await cx.newPage(); const perr = []; p.on("pageerror", (e) => perr.push(e.message)); p.on("console", (m) => { if (/^sheet /.test(m.text())) log("  " + m.text()); });
  await p.goto(BASE + "/?cash=3", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => window.ZP_boot && ZP_boot.hyd === 1 && window.ZP_facts && window.ZP_feat, null, { timeout: 90000 });
  // ---------- 1) 앱 ZoneFacts = calc.json f ----------
  const ids = ONLY || (await p.evaluate(() => ZP_feat.ctx().R.filter((r) => !(r.s >= 9) && !r.dn).map((r) => r.id)));
  log(`  zones ${ids.length}`); const t0 = Date.now();
  const F = await p.evaluate((ids) => { const o = {}; ids.forEach((id) => { const f = ZP_facts(id); if (f) o[id] = f; }); return o; }, ids);
  log(`  facts ${Object.keys(F).length} in ${Date.now() - t0}ms`);
  { const bad = []; let n = 0;
    for (const id of ids) { const a = F[id], c = (C[id] || {}).f; if (!a) continue; n++;
      if (!c) { bad.push(`${id} calc.json f 없음`); continue; }
      const k = (f) => JSON.stringify([f.eta.txt, f.eta.p10 == null ? null : Math.round(f.eta.p10 * 1000), f.stall, f.next ? [f.next.toName, f.next.state, f.next.txt] : null, f.hold.one ? [f.hold.one.code, f.hold.one.txt] : null, Math.round(f.jr.v * 10), f.jr.hold]);
      if (k(a) !== k(c)) bad.push(`${id} 앱 ${k(a)} ≠ calc ${k(c)}`);
      // 같은 객체 안 모순: 범위를 숨기지 않았는데 '10년 안'을 말하는 범위 + 10년 확률 50% 미만
      if (!a.eta.hid && a.eta.p10 != null && a.eta.p10 < 0.5 && /^(4~7년 뒤|7~10년 뒤|20\d\d)/.test(a.eta.txt)) bad.push(`${id} 범위 ${a.eta.txt} vs 10년 ${a.eta.p10Txt}`);
      if (a.stall && a.eta.p10 != null) bad.push(`${id} 정체 ${a.stall}년인데 확률 ${a.eta.p10Txt}`);
      if (a.kind.g === "small" && a.next && /관리처분/.test(a.next.toName)) bad.push(`${id} 가로·소규모 다음 단계 ${a.next.toName}`);
      if (a.jr.zone && a.jr.zone.v < 35 && a.jr.v >= 50 && !a.jr.hold && a.jr.src !== "user") bad.push(`${id} 전세가율 실측 ${a.jr.zone.v}% 인데 ${a.jr.v}% 사용`);
    }
    check(!bad.length && n > MIN, "facts.calc", `${bad.length} 불일치 · ${bad.slice(0, 5).join(" ; ")}`, n); res["facts.calc"].bad = bad; }
  // ---------- 2) 시트 화면 ----------
  const sheetIds = ids.filter((id) => F[id] && F[id].kind.g !== "moa");
  const SH = await p.evaluate(async (ids) => {
    const ctx = ZP_feat.ctx(), out = {}, wait = (f, ms) => new Promise((res) => { const t0 = Date.now(); const k = () => { let v = null; try { v = f(); } catch (e) {} if (v || Date.now() - t0 > ms) return res(v); setTimeout(k, 30); }; k(); });
    await ZP_feat.load();
    let k0 = 0; for (const id of ids) { if (++k0 % 100 === 0) console.log("sheet", k0, Date.now());
      ctx.open(id);
      const head = await wait(() => { const rp = document.getElementById("report"); const k = rp && rp.querySelector(".dt-top"); return k && ctx.cur() && ctx.cur().id === id ? k : null; }, 4000);
      const o = { head: head ? head.innerText : null };
      const tb = document.getElementById("tab-biz"); if (tb) tb.click();
      await wait(() => { const pn = document.getElementById("pane"); return pn && ctx.tab() === "biz" && pn.querySelector(".bigrow") ? 1 : null; }, 2500);
      // '이미 가진 집이면'은 기능 묶음이 같은 틱에 그린다(F.owner가 null인 구역은 없음) — 짧게만 기다린다
      await wait(() => { const pn = document.getElementById("pane"); return pn && (pn.querySelector('[data-f="owner"]') || pn.querySelector('[data-f="timeline"]')) ? 1 : null; }, 400);
      const pn = document.getElementById("pane");
      const big = pn ? [...pn.querySelectorAll(".bigrow .big")].map((x) => [((x.querySelector("span") || {}).textContent || "").trim(), ((x.querySelector("b") || {}).textContent || "").trim()]) : [];
      o.big = big; o.owner = pn && pn.querySelector('[data-f="owner"]') ? pn.querySelector('[data-f="owner"]').innerText : null;
      o.tl = pn && pn.querySelector(".ztl-next .ztl-nh b") ? pn.querySelector(".ztl-next .ztl-nh b").textContent.trim() : null;
      o.biz = pn ? pn.innerText : "";
      const tm = document.getElementById("tab-money"); if (tm) tm.click();
      await wait(() => ctx.tab() === "money" ? 1 : null, 500);
      o.money = (document.getElementById("pane") || {}).innerText || "";
      out[id] = o;
    }
    return out;
  }, sheetIds);
  { const bad = [], glue = [];
    for (const id of sheetIds) { const f = F[id], s = SH[id]; if (!s || s.head == null) { bad.push(`${id} 시트 안 열림`); continue; }
      const H = norm(s.head), nt = f.hold.one && f.hold.one.code === "nt";
      if (!nt && f.hold.one?.code !== "moa" && !H.includes(norm(f.eta.txt))) bad.push(`${id} 머리 언제 입주 ≠ ${f.eta.txt}`);
      if (f.hold.now && !nt && f.hold.now.code !== "gapBlock" && !H.includes(norm(f.hold.now.txt))) bad.push(`${id} 머리 보류 근거 ≠ ${f.hold.now.code}`);
      if (f.hold.one && !nt && /계산 보류.*이유 보기/.test(H) && !H.includes(f.hold.one.short)) bad.push(`${id} 신뢰 줄 ≠ ${f.hold.one.short}`);
      HOLD_ALT.forEach((t) => { if (H.includes(t) && !(f.hold.one && f.hold.one.txt.includes(t))) bad.push(`${id} 머리에 다른 보류 이유 '${t}'`); });
      const be = s.big.find((x) => /예상 입주/.test(x[0])), bp = s.big.find((x) => /준공 가능성/.test(x[0]));
      if (be && norm(be[1]) !== norm(f.eta.txt) && !(f.eta.done)) bad.push(`${id} 일정 예상 입주 '${be[1]}' ≠ '${f.eta.txt}'`);
      if (bp) { if (f.eta.p10Txt ? bp[1] !== f.eta.p10Txt : /%/.test(bp[1])) bad.push(`${id} 일정 10년 '${bp[1]}' ≠ '${f.eta.p10Txt}'`); }
      if (f.stall && /10년 안 준공\s*\d+%/.test(norm(s.biz))) bad.push(`${id} 정체인데 일정 탭에 10년 %`);
      if (f.next && s.owner && !norm(s.owner).includes(norm(f.next.txt))) bad.push(`${id} 이미 가진 집이면 다음 단계 ≠ ${f.next.txt}`);
      if (f.next && s.tl && s.tl !== f.next.toName) bad.push(`${id} F2 다음 단계 ${s.tl} ≠ ${f.next.toName}`);
      if (f.kind.g === "small" && /다음 단계[^\n]{0,20}관리처분인가/.test(s.biz)) bad.push(`${id} 가로·소규모에 다음 단계 관리처분`);
      for (const t of [s.head, s.biz, s.money]) GLUE.forEach((re) => { const m = re.exec(t || ""); if (m) glue.push(`${id} '${String(t).slice(Math.max(0, m.index - 20), m.index + 20).replace(/\n/g, " ")}'`); });
    }
    check(!bad.length && sheetIds.length > MIN, "facts.sheet", `${bad.length} 불일치 · ${bad.slice(0, 6).join(" ; ")}`, sheetIds.length); res["facts.sheet"].bad = bad;
    // ---------- 3) /z ----------
    const zb = []; let zn = 0;
    for (const id of sheetIds) { const fp = path.join(ROOT, "public/z", id + ".html"); if (!fs.existsSync(fp)) continue; const f = F[id];
      let h = fs.readFileSync(fp, "utf8"); if (/http-equiv="refresh"/.test(h)) continue; zn++;
      const t = norm(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;|&#160;/g, " "));
      const nt = f.hold.one && f.hold.one.code === "nt";
      if (!nt && !t.includes(norm(f.eta.txt))) zb.push(`${id} /z 언제 입주 ≠ ${f.eta.txt}`);
      if (f.hold.now && !nt && f.hold.now.code !== "gapBlock" && !t.includes(norm(f.hold.now.txt))) zb.push(`${id} /z 보류 근거 ≠ ${f.hold.now.code}`);
      if (f.eta.p10 == null && /10년 안 준공 가능성은 약 \d+%|준공 가능성<\/span><b>\d+%/.test(h.replace(/\s+/g, " "))) zb.push(`${id} /z 확률 생략 구역인데 %`);
      if (f.eta.p10 != null && /준공 가능성은 약 (\d+)%/.test(t) && RegExp.$1 + "%" !== f.eta.p10Txt) zb.push(`${id} /z 10년 ${RegExp.$1}% ≠ ${f.eta.p10Txt}`);
      if (f.eta.hid && /준공 예상 범위\(추정\)/.test(t)) zb.push(`${id} /z 숨긴 범위가 실림`);
      HOLD_ALT.forEach((x) => { if (t.includes(x) && !(f.hold.one && f.hold.one.txt.includes(x))) zb.push(`${id} /z 다른 보류 이유 '${x}'`); });
      GLUE.forEach((re) => { const m = re.exec(t); if (m) glue.push(`${id} /z '${t.slice(Math.max(0, m.index - 20), m.index + 20)}'`); });
    }
    check(!zb.length && zn > MIN / 2, "facts.z", `${zb.length} 불일치 · ${zb.slice(0, 6).join(" ; ")}`, zn); res["facts.z"].bad = zb;
    check(!glue.length, "facts.glue", `${glue.length}곳 · ${glue.slice(0, 6).join(" ; ")}`); res["facts.glue"].bad = glue;
  }
  // ---------- 4) API ----------
  { const bad = []; let n = 0;
    for (const id of sheetIds) { const z = A[id], f = F[id]; if (!z) continue; n++;
      if (!z.facts) { bad.push(`${id} facts 없음`); continue; }
      if (z.facts.eta !== f.eta.txt) bad.push(`${id} api eta ${z.facts.eta} ≠ ${f.eta.txt}`);
      const ap = z.completion ? z.completion.p10 : null; if ((ap == null) !== (f.eta.p10 == null) || (ap != null && Math.abs(ap - f.eta.p10) > 1e-6)) bad.push(`${id} api p10 ${ap} ≠ ${f.eta.p10}`);
      if ((z.facts.next ? z.facts.next.text : null) !== (f.next ? f.next.txt : null)) bad.push(`${id} api next`);
      if ((z.facts.hold ? z.facts.hold.code : null) !== (f.hold.one ? f.hold.one.code : null)) bad.push(`${id} api hold ${z.facts.hold && z.facts.hold.code} ≠ ${f.hold.one && f.hold.one.code}`);
    }
    check(!bad.length && n > MIN, "facts.api", `${bad.length} 불일치 · ${bad.slice(0, 5).join(" ; ")}`, n); res["facts.api"].bad = bad; }
  // ---------- 5) 공유 주소에 조건 쿼리 없음 ----------
  { const U = await p.evaluate(async () => {
      const out = [], ctx = ZP_feat.ctx();
      const orig = navigator.clipboard && navigator.clipboard.writeText; let last = "";
      try { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); } catch (e) {}
      try { navigator.clipboard.writeText = (t) => { last = t; return Promise.resolve(); }; } catch (e) {}
      const grab = async (fn) => { last = ""; try { await fn(); } catch (e) {} await new Promise((r) => setTimeout(r, 120)); if (!last) { const i = document.querySelector(".share-fall input"); if (i) last = i.value; } return last; };
      out.push(["shareBtn", await grab(() => document.getElementById("shareBtn").click())]);
      ctx.open("o191"); await new Promise((r) => setTimeout(r, 600));
      out.push(["condLink zone", ctx.condLink("o61")]);
      out.push(["condLink cmp", ctx.condLink("cmp", "cmp=o61.o27")]);
      const X = await ZP_feat.loadX(); out.push(["scenURL", X.scenURL(ctx, { q: ctx.condQ(), x: { sv: "100", ar: "95" } })]);
      out.push(["addr", location.href]);
      return out;
    });
    const bad = U.filter(([k, u]) => { if (!u) return k !== "shareBtn"; const q = u.split("#")[0].split("?")[1] || ""; return /(^|&)(cash|inc|income|mode|fund|homes|sv|ar|ag|at|jr|unit|first|basis|kind)=/.test(q); });
    // 옛 쿼리 링크: 열면 읽고 주소에서 지움(내 돈 반영)
    const p2 = await cx.newPage();
    await p2.goto(BASE + "/?cash=7&mode=loan&inc=5000#o61", { waitUntil: "domcontentloaded" });
    await p2.waitForFunction(() => window.ZP_boot && ZP_boot.hyd === 1, null, { timeout: 60000 });
    const old = await p2.evaluate(() => ({ href: location.href, cq: window.ZP_CQ, cash: (document.getElementById("pCash") || {}).value, inc: (document.getElementById("pIncome") || {}).value }));
    const p3 = await cx.newPage();
    await p3.goto(BASE + "/#planner?cash=4&mode=jeonse&inc=6000", { waitUntil: "domcontentloaded" });
    await p3.waitForFunction(() => window.ZP_boot && ZP_boot.hyd === 1, null, { timeout: 60000 });
    const neu = await p3.evaluate(() => ({ href: location.href, cash: (document.getElementById("pCash") || {}).value, inc: (document.getElementById("pIncome") || {}).value }));
    await p2.close(); await p3.close();
    const okOld = !/[?&](cash|inc|mode)=/.test(old.href) && /#o61$/.test(old.href) && +old.cash === 7 && old.inc === "5000";
    const okNew = !/[?&#]cash=/.test(neu.href.split("#")[0]) && /#planner$/.test(neu.href) && +neu.cash === 4 && neu.inc === "6000";
    check(!bad.length && okOld && okNew, "facts.urls", `조건 쿼리 ${JSON.stringify(bad)} · 옛 링크 ${JSON.stringify(old)} · # 링크 ${JSON.stringify(neu)}`, U.length);
    res["facts.urls"].urls = U; }
  check(!perr.length, "facts.errors", perr.slice(0, 3).join(" | "));
  await b.close();
  if (OUTJ) fs.writeFileSync(OUTJ, JSON.stringify({ base: BASE, at: new Date().toISOString(), res }, null, 1));
  log(fails.length ? `FAILED ${fails.length}: ${fails.join(", ")}` : "PASSED");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
