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
   facts.urls   앱이 만드는 공유 주소(공유 버튼·구역 공유·관심 링크·비교·시나리오·옮기기)의 ? 부분에 cash·inc·sv 같은 조건이 없음
   facts.same   사이클 4 · 같은 화면 정합: 시트 한 장(머리·돈·일정·거래 탭)과 /z 한 쪽 안에서 같은 양(라벨 사전 SAME)이 두 번 나오면 문자열이 같아야 한다
                 + 파생 규칙: '1년 …' 참고 시세면 12개월 표본 > 0 · '언제 입주' 글자 = 범위(eLo~eHi) 양 끝 · 정체·생략이면 이주·입주 칸 모두 시점 없음 ·
                 보류(전세가율 등)면 '살 수 없는' 금지 · 분담금 요약 = 비례율 표 100% 줄 · ZoneFacts num 문자열(참고 시세·면적·전세·세대 라벨)과 같음 */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const BASE = process.argv[2] || "http://localhost:8941";
const OUTJ = (() => { const i = process.argv.indexOf("--json"); return i > 0 ? process.argv[i + 1] : null; })();
const ROOT = path.join(__dirname, "..");
const ONLY = process.env.QAF_IDS ? process.env.QAF_IDS.split(",") : null, MIN = ONLY ? 0 : 900;
const SAME = process.env.QAF_SAME !== "0";   // 사이클 4: 같은 화면 정합(거래 탭까지 연다 · 끄려면 QAF_SAME=0)
const fails = [], res = {}, log = (...a) => console.log(...a);
const check = (ok, id, msg, n) => { log(`${ok ? "PASS" : "FAIL"} ${id}${ok ? "" : " — " + msg}`); if (n != null) log(`  ${id}: ${n}곳`); res[id] = { ok, msg: ok ? "" : msg, n }; if (!ok) fails.push(id); };
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const GLUE = [/[가-힣]\)\s*뒤에 산/, /\b0곳뿐/, /·\s*·/, /이전 이전/, /\(\s*\)/, /undefined|NaN|null원|\[object/];
// 보류 이유 코드별 문장(다른 코드의 문장이 같은 머리에 나오면 '이유 여럿')
const HOLD_ALT = ["매수가로 쓸 거래가 없어", "이주·철거가 시작됐어요", "입주 시점·신축 시세 자료가 부족해요", "주변 신축 실거래가 없어 입주 때 시세를 못 정했어요"];
// ===================== 사이클 4: 같은 화면 정합 규칙 =====================
//   라벨 사전(SAME_LAB): 같은 양을 가리키는 라벨들 → 화면 글자에서 값 문자열을 뽑아 모두 같은지 + ZoneFacts num 문자열과 같은지
const MONEY = "(\\d+(?:\\.\\d)?억(?: [\\d,]+만)?|[\\d,]+만|0원)";
const allM = (re, t) => { const o = []; let m; const g = new RegExp(re.source, "g"); while ((m = g.exec(t || ""))) o.push(m[1]); return o; };
const uniqs = (a) => [...new Set(a)];
function sameRules(id, f, S, bad, where) {
  const N = f.num || {}, E = (m) => bad.push(`${id} ${where} ${m}`);
  // ① 참고 시세: 머리 '참고 시세' 줄 = ZoneFacts num.ref.txt · '1년 …' 이면 12개월 표본 > 0
  const ref = /참고 시세 · [^\n]+/.exec(S.head || "");
  if (ref) { if (!N.ref || norm(ref[0]) !== norm(N.ref.txt)) E(`참고 시세 '${ref[0]}' ≠ '${N.ref && N.ref.txt}'`);
    if (/1년 (대표 거래|가운데 값)/.test(ref[0]) && !(N.ref && N.ref.k === "hd") && !(S.n12 > 0)) E(`'1년' 참고 시세인데 12개월 표본 ${S.n12}건`);
    // 거래 탭 맨 위 큰 숫자 = 참고 시세 값(표본 없는 곳은 같은 표본이 큰 숫자)
    if (N.ref && S.tx && !S.tx.includes(N.ref.vt)) E(`거래 탭에 참고 시세 값 ${N.ref.vt} 없음`); }
  // ② 언제 입주 = 범위 양 끝(파생) · 일정 탭 '빠르면 …, 늦으면 …'과 같은 끝
  const er = f.eta.rng, et = f.eta.txt;
  if (er) { const m = /^(?:약 )?(\d+)(?:~(\d+))?년 뒤$/.exec(et);
    if (m) { const a = +m[1], b = +(m[2] || m[1]); if (a !== Math.max(1, Math.round(er.lo)) || b !== Math.max(a, Math.round(er.hi))) E(`언제 입주 '${et}' ≠ 범위 ${er.txt}(${er.lo}~${er.hi}년)`); }
    else if (/^\d{4}(~\d\d)?년$/.test(et)) { const y = +et.slice(0, 4), y2 = et.length > 6 ? 2000 + +et.slice(5, 7) : y; if (y2 !== +er.eHi.slice(0, 4) || y > +er.eHi.slice(0, 4)) E(`언제 입주 '${et}' ≠ 범위 ${er.txt}`); }
    else if (et !== "15년 넘게") E(`언제 입주 '${et}' 꼴이 범위 파생이 아님`);
    if (S.biz && /예상 준공·입주 범위/.test(S.biz)) { const ym = (x) => `${+x.slice(0, 4)}.${+x.slice(5, 7)}`; const bz = /빠르면 ([^,]+), 늦으면 ([^\n]+)/.exec(S.biz); if (bz && !(norm(bz[1]) === ym(er.eLo) || bz[1] === "곧") ) E(`일정 탭 빠르면 '${bz[1]}' ≠ ${ym(er.eLo)}`); if (bz && !(norm(bz[2]).startsWith(ym(er.eHi)) || /15년 넘게/.test(bz[2]))) E(`일정 탭 늦으면 '${bz[2]}' ≠ ${ym(er.eHi)}`); } }
  // 머리 '언제 입주' 칸 = 돈 탭 시간표 입주 칸
  const gin = (S.gtw || []).find((x) => /^입주/.test(x)), gmv = (S.gtw || []).find((x) => /^이주/.test(x));
  if (gin && !/^입주$/.test(gin)) { const v = gin.replace(/^입주 · /, "").replace(/ \(계산용 가정\)$/, ""); if (f.hold.one?.code !== "nt" && v !== et) E(`돈 탭 입주 칸 '${v}' ≠ 언제 입주 '${et}'`); }
  // ③ 정체·자료 부족·범위 숨김(입주 시점을 내지 않음)이면 이주 칸도 시점 없음
  const omit = !er; if (omit && gmv && /\d+(~\d+)?년 뒤|\d{4}년/.test(gmv)) E(`입주 시점 생략(${et})인데 이주 칸 '${gmv}'`);
  if (er && gmv && /\d/.test(gmv)) { const mm = /(\d+)~?(\d+)?년 뒤/.exec(gmv); if (mm && et && /년 뒤$/.test(et)) { const b = +(mm[2] || mm[1]), eb = +((/~(\d+)년/.exec(et) || [])[1] || (/(\d+)년/.exec(et) || [])[1]); if (b > eb) E(`이주 칸 '${gmv}'가 입주 '${et}'보다 늦음`); } }
  // ④ 보류면 '살 수 없는'(금지) 문구 금지
  const hn = f.hold.now; if (hn && hn.code !== "gapBlock" && hn.code !== "nt" && /살 수 없/.test(S.all)) E(`보류(${hn.code})인데 '살 수 없' 문구`);
  // ⑤ 분담금: 요약 칸 = 비례율 표 100% 줄 = ZoneFacts num.contrib
  if (S.money && N.contrib) { const sm = /(?:추가 분담금|환급 추정)\n([^\n]+)/.exec(S.money), tb = /\n100%\t[^\t\n]*\t(?:환급 )?([^\n]+)/.exec(S.money);
    if (sm && sm[1].trim() !== N.contrib.txt) E(`추가 분담금 '${sm[1].trim()}' ≠ ${N.contrib.txt}`);
    if (sm && tb && sm[1].trim() !== tb[1].trim()) E(`분담금 요약 '${sm[1].trim()}' ≠ 비례율 100% '${tb[1].trim()}'`); }
  // ⑥ 라벨 사전: 계산 매수가(정확한 만 원 하나)
  if (N.price) { const L = uniqs(allM(new RegExp(`(?:계산 매수가|매수가)\\s?\\n?${MONEY}`), S.all)).filter((v) => !/^0원$/.test(v)); const odd = L.filter((v) => v !== N.price.txt); if (odd.length && f.hold.one?.code !== "nt") E(`매수가 표기 ${odd.join("/")} ≠ ${N.price.txt}`); }
  // 구역 면적 · 빌라 전세 가운데 값 · 세대 라벨
  if (N.area && S.biz) { const L = uniqs(allM(/구역 면적\n([\d,]+㎡)/, S.biz)); if (L.some((v) => v !== N.area.txt)) E(`구역 면적 ${L.join("/")} ≠ ${N.area.txt}`); }
  if (N.jeonse && S.tx) { const L = uniqs(allM(/빌라 전세 가운데 값\n([^\n]+)/, S.tx)); if (L.some((v) => v.trim() !== N.jeonse.txt)) E(`빌라 전세 가운데 값 ${L.join("/")} ≠ ${N.jeonse.txt}`); }
  if (N.units && S.biz && /조합·사업 정보/.test(S.biz) && !new RegExp(`\\n${N.units.lab}\\n`).test(S.biz) && !/\n계획 세대\n약 /.test(S.biz)) E(`세대수 칸 이름 '${N.units.lab}' 없음`);
  // 동의율: 일정 탭 막대 = 조합·사업 정보 칸(같은 값 하나)
  if (S.biz) { const L = uniqs(allM(/(?:조합설립|추진위원회|추진위) 동의율\n(?:법정 기준 \d+%\n)?([\d.]+%)/, S.biz)); if (L.length > 1) E(`동의율 ${L.join(" vs ")}`); if (/동의율 0%/.test(S.biz)) E("동의율 0% 원자료 노출"); }
  // 다음 단계: 머리 칸 = 일정 탭(이미 가진 집이면)
  if (f.next && S.head && /다음 단계\n/.test(S.head)) { const m = /다음 단계\n([^\n]+)/.exec(S.head); if (m && m[1].trim() !== f.next.toName) E(`머리 다음 단계 '${m[1]}' ≠ ${f.next.toName}`); }
  // 권리산정기준일 '?'·'추정' 겹침
  if (/\d{4}\.\d\d\.\d\d\?/.test(S.all)) E("권리산정기준일 '?' 표기");
  // ⑦ 사이클 4 D+(진단 6): 역 도보 분 = ZoneFacts walk(ZF.walkMin 한 함수) — 시트 안 그 역 'N분'이 모두 같은 값 · 목록 카드 글자 = ZF.walkTxt
  walkRule(f, S.all, E, "시트");
  if (S.cw != null && f.walk) { const want = f.walk.far ? "역에서 멀어요" : `${f.walk.n}역 ${f.walk.min}분`; if (norm(S.cw) !== want) E(`목록 카드 역 도보 '${S.cw}' ≠ '${want}'`); }
}
function walkRule(f, t, E, where) {
  const w = f.walk; if (!w || !t) return;
  const re = new RegExp(w.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "역[^\\n\\d]{0,24}?(\\d+)분", "g"); let m, L = [];
  while ((m = re.exec(t))) L.push(+m[1]);
  const odd = uniqs(L).filter((v) => v !== w.min); if (odd.length) E(`${where} ${w.n}역 도보 ${odd.join("/")}분 ≠ ${w.min}분(ZF.walkMin)`);
}
// /z 한 쪽 안: 참고 시세(ZoneFacts num.ref) · 면적 · 빌라 전세 · 보류면 '살 수 없' 금지 · 범위 파생
function sameZ(id, f, t, bad) {
  const N = f.num || {}, E = (m) => bad.push(`${id} /z ${m}`);
  // 참고 시세 줄(있으면 모두) = ZoneFacts num.ref.txt
  for (let i = t.indexOf("참고 시세 · "); i >= 0; i = t.indexOf("참고 시세 · ", i + 1)) { if (!N.ref) { E(`참고 시세 '${t.slice(i, i + 50)}'인데 ZoneFacts에 없음`); break; } if (!t.startsWith(norm(N.ref.txt), i)) E(`참고 시세 '${t.slice(i, i + norm(N.ref.txt).length + 4)}' ≠ '${N.ref.txt}'`); }
  if (N.area) { const L = uniqs(allM(/구역 면적 ([\d,]+㎡)/, t)); if (L.some((v) => v !== N.area.txt)) E(`구역 면적 ${L.join("/")} ≠ ${N.area.txt}`); }
  if (N.jeonse) { const L = uniqs(allM(/빌라 전세 ([\d.,]+(?:억|만))/, t)); if (L.some((v) => v !== N.jeonse.txt)) E(`빌라 전세 ${L.join("/")} ≠ ${N.jeonse.txt}`); }
  const hn = f.hold.now; if (hn && hn.code !== "gapBlock" && hn.code !== "nt" && /살 수 없/.test(t.replace(/토지거래허가[^.]{0,80}살 수 없/g, ""))) E(`보류(${hn.code})인데 '살 수 없' 문구`);
  if (f.eta.rng) { const m = /(\d{4})~(\d{4})년 준공 예상 범위|준공 예상 범위\(추정\)[^\d]{0,20}(\d{4})\.\d+~(\d{4})/.exec(t); if (m) { const a = m[1] || m[3], b = m[2] || m[4]; if (a !== f.eta.rng.eLo.slice(0, 4) || b !== f.eta.rng.eHi.slice(0, 4)) E(`준공 예상 범위 ${a}~${b} ≠ ${f.eta.rng.txt}`); } }
  if (/\d{4}\.\d\d\.\d\d\?/.test(t)) E("권리산정기준일 '?' 표기");
  // c4 최종: 손글 '이런 사람에게 맞아요'의 기다릴 기간 = ZoneFacts 입주 글자 범위('9~17년 뒤' → '9~17년을 기다릴') · 범위가 없으면 기간 문장 금지
  { const want = (/^(\d+~\d+년) 뒤$/.exec(f.eta.txt || "") || [])[1]; const re = /(\d+(?:~\d+)?년)(?: 넘게| 안팎)?(?:을|를)? 기다릴/g; let m;
    while ((m = re.exec(t))) if (m[1] !== want) E(`'${m[0]}' ≠ 언제 입주 ${f.eta.txt}`); }
  // c4 최종: 세대수 라벨 = ZoneFacts num.units.lab(분양 세대·계획 세대·총 세대) — '계획 세대수 2,000세대'(o448)·'계획은 311세대'(o27)처럼 /z가 다른 이름을 쓰던 것
  if (N.units && N.units.v) { const ds = N.units.txt.replace(/세대$/, ""), lw = N.units.lab.replace(/ 세대$/, ""), re = new RegExp(`(계획|분양|총)(?: 세대수| 세대| 가구|은|는)?\\s?(?:[^\\d\\s]{0,4}\\s)?${ds.replace(/,/g, ",")}\\s?세대`, "g"); let m;
    while ((m = re.exec(t))) if (m[1] !== lw) E(`세대수 '${m[0]}' ≠ ${N.units.lab}`); }
  walkRule(f, t, E, "/z");
}
(async () => {
  const C = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/calc.json"), "utf8"));
  const API = JSON.parse(fs.readFileSync(path.join(ROOT, "public/api/v1/zones.json"), "utf8")); const A = {}; (API.items || []).forEach((z) => (A[z.id] = z));
  const b = await chromium.launch();
  const cx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await cx.addInitScript(() => { try { localStorage.setItem("zp.tonb", "1"); localStorage.setItem("zp.onb", "1"); } catch (e) {} });
  // 통합 c3: QAF_TAPP=1이면 앱 모드(TWA)로 — 첫 문서에서만 referrer를 앱으로 · sessionStorage zp.tapp=1 (rt_common '앱 모드 켜는 법')
  if (process.env.QAF_TAPP) await cx.addInitScript(() => { try { if (!sessionStorage.getItem("zp.tapp")) Object.defineProperty(Document.prototype, "referrer", { get: () => "android-app://kr.alwaysquestions.jaegaepick/" }); sessionStorage.setItem("zp.tapp", "1"); } catch (e) {} });
  await cx.route("**/*", (r) => (/^http:\/\/(localhost|127\.0\.0\.1)/.test(r.request().url()) ? r.continue() : r.abort()));
  const p = await cx.newPage(); const perr = []; p.on("pageerror", (e) => perr.push(e.message)); p.on("console", (m) => { if (/^sheet /.test(m.text())) log("  " + m.text()); });
  await p.goto(BASE + "/?cash=3", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => window.ZP_boot && ZP_boot.hyd === 1 && window.ZP_facts && window.ZP_feat, null, { timeout: 90000 });
  if (process.env.QAF_TAPP) { const on = await p.evaluate(() => document.documentElement.classList.contains("is-tapp")); log(`  tapp mode: html.is-tapp ${on}`); if (!on) { check(false, "facts.tapp", "html.is-tapp가 붙지 않음"); } }
  // ---------- 1) 앱 ZoneFacts = calc.json f ----------
  const ids = ONLY || (await p.evaluate(() => ZP_feat.ctx().R.filter((r) => !(r.s >= 9) && !r.dn).map((r) => r.id)));
  log(`  zones ${ids.length}`); const t0 = Date.now();
  const F = await p.evaluate((ids) => { const o = {}; ids.forEach((id) => { const f = ZP_facts(id); if (f) o[id] = f; }); return o; }, ids);
  log(`  facts ${Object.keys(F).length} in ${Date.now() - t0}ms`);
  { const bad = []; let n = 0;
    for (const id of ids) { const a = F[id], c = (C[id] || {}).f; if (!a) continue; n++;
      if (!c) { bad.push(`${id} calc.json f 없음`); continue; }
      const nk = (n) => (n ? [n.ref ? n.ref.txt : null, n.area ? n.area.txt : null, n.jeonse ? n.jeonse.txt : null, n.units ? [n.units.lab, n.units.txt] : null, n.tl ? [n.tl.move, n.tl.in] : null] : null);   // 사이클 4: 표시 숫자(ZoneFacts v2 num)도 정적 생성기와 같은 문자열
      const k = (f) => JSON.stringify([f.eta.txt, f.eta.p10 == null ? null : Math.round(f.eta.p10 * 1000), f.stall, f.next ? [f.next.toName, f.next.state, f.next.txt] : null, f.hold.one ? [f.hold.one.code, f.hold.one.txt] : null, Math.round(f.jr.v * 10), f.jr.hold, nk(f.num), f.eta.rng ? f.eta.rng.txt : null]);
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
  const SH = await p.evaluate(async ([ids, SAME]) => {
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
      // 돈 탭 비례율 표(#mSens)는 같은 틱 뒤에 채워진다
      await wait(() => { const pn = document.getElementById("pane"); return pn && (!pn.querySelector("#mSens") || pn.querySelector("#mSens tr")) ? 1 : null; }, 800);
      o.money = (document.getElementById("pane") || {}).innerText || "";
      o.gtw = [...document.querySelectorAll("#pane .gtl .gt-w")].map((e) => e.textContent.trim());   // 돈 탭 시간표 칸 이름(지금 · 이주 · 입주)
      // 사이클 4: 같은 화면 정합 — 거래 탭 글자 · 구역 자료(12개월 표본)
      if (SAME) { const tx = document.getElementById("tab-tx"); if (tx) { tx.click(); await wait(() => { const pn = document.getElementById("pane"); return ctx.tab() === "tx" && pn && pn.querySelector(".ov-tx, .sect") ? 1 : null; }, 2500); await wait(() => { const pn = document.getElementById("pane"); return pn && pn.querySelector(".zpx") ? 1 : null; }, 600); o.tx = (document.getElementById("pane") || {}).innerText || ""; }
        const rr = ctx.R.find((q) => q.id === id) || {}; o.n12 = rr.tx ? rr.tx.n12 : null;
        try { const d = document.createElement("div"); d.innerHTML = SIMPLE.cardHTML(rr); const wk = d.querySelector(".s-wk"); o.cw = wk ? wk.textContent : ""; } catch (e) { o.cw = null; } }
      out[id] = o;
    }
    return out;
  }, [sheetIds, SAME]);
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
    // c4 최종(회귀 · c3 users 9 · c4 ux_re 결함 7): 권리산정기준일 = /api/v1 rightsDate(모아타운 안 사업구역은 소속 모아타운 날짜를 물려받음 — 시트·api·/z 같은 날짜)
    { const rb = []; let rn = 0;
      for (const id of sheetIds) { const s = SH[id], a = A[id]; if (!s || !a || s.owner == null) continue;
        const d = a.rightsDate ? a.rightsDate.slice(0, 10).replace(/-/g, ".") : null;
        if (d) { rn++; if (!s.owner.includes(d)) rb.push(`${id} 시트 '이미 가진 집이면'에 ${d} 없음`); }
        else if (/권리산정기준일 \d{4}\.\d\d\.\d\d/.test(s.owner)) rb.push(`${id} api rightsDate 없음인데 시트에 날짜`);
        const fp = path.join(ROOT, "public/z", id + ".html");
        if (d && fs.existsSync(fp)) { const zh = fs.readFileSync(fp, "utf8"); if (/권리산정기준일/.test(zh.replace(/<script[\s\S]*?<\/script>/g, "")) && !zh.includes(d) && !zh.includes(a.rightsDate.slice(0, 10)) && !/권리산정기준일[^<]{0,40}<\/h2><p><b>확인 필요/.test(zh)) rb.push(`${id} /z 권리산정기준일 ≠ ${d}`); }
      }
      // 고정 표본: 면목역1(o27) = 소속 모아타운 면목동 86-3(m10)의 2022.01.20
      if (A.o27 && (A.o27.rightsDate || "").slice(0, 10) !== "2022-01-20") rb.push(`o27 api rightsDate ${A.o27.rightsDate} ≠ 2022-01-20(m10 물려받기)`);
      if (SH.o27 && SH.o27.owner != null && !SH.o27.owner.includes("2022.01.20")) rb.push("o27 시트에 2022.01.20 없음");
      check(!rb.length && rn > 50, "facts.rights", `${rb.length} 불일치 · ${rb.slice(0, 6).join(" ; ")}`, rn); res["facts.rights"].bad = rb; }
    // ---------- 2b) 사이클 4 · 같은 화면 정합(시트 한 장 안) ----------
    if (SAME) { const sb = []; let sn = 0;
      for (const id of sheetIds) { const f = F[id], s = SH[id]; if (!s || s.head == null || s.tx == null) continue; sn++;
        const all = [s.head, s.money, s.biz, s.tx].join("\n");
        sameRules(id, f, { head: s.head, money: s.money, biz: s.biz, tx: s.tx, all, n12: s.n12, gtw: s.gtw || [], cw: s.cw }, sb, "시트");
      }
      check(!sb.length && sn > MIN, "facts.same", `${sb.length} 불일치 · ${sb.slice(0, 8).join(" ; ")}`, sn); res["facts.same"].bad = sb; }
    // ---------- 3) /z ----------
    const zb = [], zsb = []; let zn = 0, zsn = 0;
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
      if (SAME) { zsn++; sameZ(id, f, t, zsb); }
      GLUE.forEach((re) => { const m = re.exec(t); if (m) glue.push(`${id} /z '${t.slice(Math.max(0, m.index - 20), m.index + 20)}'`); });
    }
    check(!zb.length && zn > MIN / 2, "facts.z", `${zb.length} 불일치 · ${zb.slice(0, 6).join(" ; ")}`, zn); res["facts.z"].bad = zb;
    if (SAME) { check(!zsb.length && zsn > MIN / 2, "facts.sameZ", `${zsb.length} 불일치 · ${zsb.slice(0, 8).join(" ; ")}`, zsn); res["facts.sameZ"].bad = zsb; }
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
