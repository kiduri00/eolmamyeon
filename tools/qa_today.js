// 사이클 5(A): 오늘 묶음 QA — node tools/qa_today.js   (qa_consistency 단위 'today' · 브라우저 없음)
// 지난 30일을 하루씩 재생(tools/today.py --replay)해 today.json을 만들고, 앱 묶음(src/today · 같은 함수)으로 홈 카드·소식·푸시 문장을 만들어 본다.
//   today.sim30  홈 카드(날짜 머리 뺀 본문)가 전날과 같은 날 ≤ 20% · 0건 날에 '0'을 크게 쓰지 않음
//   today.same   숫자 대조: 홈 줄 = 소식 목록 셈 = 원자료(changes.json·auction.json) = 푸시 주간 줄(worker/push.js compose)
//   today.bf     밀린 자료(경매 첫 수집 10.18 · bf) 분리: 오늘 숫자 0 · '새로 확인한 지난 자료 N건'
//   today.words  금지어·법적 표현(최저가 ≠ 낙찰가 · §37③5 요건 · 확인 필요 · 레이더 '계산상') · 모든 줄 기준일
//   today.names  개인 이름 0(today.json·auction.json 저장 값 · 문구)
//   today.cv     가짜 변화 0: 계산 버전을 바꾼 시험 실행 → price 사건 bf · 레이더 0 · 푸시 0 (대조군: 같은 버전이면 레이더에 원인과 함께 나옴)
//   today.sched  일정 날짜는 법원 매각기일(auction.json)에 있는 것만 · 지난 날 0
//   today.ics    캘린더 파일 RFC 5545(CRLF · 75옥텟 접기 · Asia/Seoul) · 개인 이름 0 · fetch 0
//   today.clock  가짜 시계(기기 11.01 · 자료 asOf 10.25): 지난 기일 0 · D-n = 기기 날짜 기준 · ICS에 지난 기일 0 · 'N일 전 자료' 띠 · 내 일정은 기기 날짜만
//   today.stale  법원 확인 3일 넘은 물건: D-day·홈 일정 줄 숨김 · '법원 확인' 표시 · 사업 종류별 고지(소규모주택정비법 §24 · auc.small)
//   today.dedup  겹치는 구역 한 번만: 서울 숫자 = 거래 지문·사건번호·허가 접수번호 고유 수 · 같은 날 같은 고시 하나(o645)
//   today.xe2e   해제 정정 끝까지: tools/tx.py(합성 CSV · 취소일) → tx_cancel.json → changes.py → today.json → 푸시 정정 줄
//   today.size   today.json gzip ≤ 10KB · 묶음(src/today) gzip ≤ 6KB · 사전 사본(pipeline·worker) = tools/feed_words.json
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), zlib = require("zlib"), vm = require("vm");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), P = (p) => path.join(ROOT, p);
const res = [];
const check = (ok, id, why) => { res.push([ok, id, why]); console.log(ok ? `PASS ${id}` : `FAIL ${id} — ${why}`); };
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const FW = J(P("tools/feed_words.json"));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "qa_today-"));
const py = (args, env) => { const r = spawnSync("python3", args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env } }); if (r.status !== 0) throw new Error(args.join(" ") + ": " + (r.stderr || r.stdout).slice(-400)); return r.stdout; };
// ---------- 앱 묶음을 node에서(같은 함수) ----------
function bundle() {
  const src = fs.readFileSync(P("src/today/00_today.js"), "utf8").replace('"__FEED_WORD__"', JSON.stringify(FW)).replace(/__BRAND_EN__/g, "JaegaePick");
  const g = { console, TextEncoder, URL, Date, JSON, Math, Number, String, Object, Array, Set, Map, Promise, fetch: () => { throw new Error("fetch 금지(qa)"); }, localStorage: memLS() };
  vm.createContext(g); vm.runInContext(src, g); return g.ZP_today;
}
function memLS() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
// ---------- 모래 상자: 저장소 자료를 건드리지 않고 changes.py · today.py ----------
function sandbox(name, mut) {
  const R = path.join(TMP, name);
  for (const d of ["pipeline/cache", "public/data"]) fs.mkdirSync(path.join(R, d), { recursive: true });
  for (const f of ["pipeline/data.enriched.json", "pipeline/calc.json", "public/data/tx.json", "public/data/notice.json", "public/data/auction.json", "pipeline/cache/toheo.json", "pipeline/cache/parcels.json", "pipeline/cache/tx_cancel.json"])
    if (fs.existsSync(P(f))) fs.symlinkSync(P(f), path.join(R, f));
  for (const f of ["pipeline/cache/changes_state.json", "public/data/changes.json", "pipeline/calc_ver.json"]) if (fs.existsSync(P(f))) fs.copyFileSync(P(f), path.join(R, f));
  if (mut) mut(R);
  return R;
}
const BAN = new RegExp(FW.banned.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));
const banHit = (s) => { let t = String(s); for (const ok of FW.banned_ok) t = t.split(ok).join(""); const m = BAN.exec(t); return m ? m[0] : null; };
// 법원 자료에 이름이 붙는 꼴: '채무자: 홍길동' · '홍길동 외 2인' · '홍○동' (고지 문장 '임차인 보증금' 같은 일반 말은 아님)
const NAME_RE = /(소유자|채무자|채권자|임차인|신청인|공유자|매수인)\s*[:：]\s*[가-힣]{2,4}|[가-힣]{2,4}\s*외\s*\d+\s*인|[가-힣][○*][가-힣]/;

(async () => {
  const Z = bundle();
  const at = (d, hm) => Z.clock(() => Date.parse(`${d}T${hm || "08:30"}:00+09:00`));   // 가짜 시계(기기 서울 날짜)
  // today.py ev_keys와 같은 열쇠(겹치는 구역 한 번만)
  const evKeys = (e) => { const n = Number.isInteger(e.cnt) ? e.cnt : 1; if (e.type === "trade" && e.tk) return e.tk.map((x) => "t" + x); if (e.type === "auction" && e.ck) return e.ck.map((x) => "a" + (e.ak || "") + x); if (e.type === "trade" || e.type === "auction") return [...Array(n).keys()].map((i) => [e.type[0] + (e.ak || ""), e.date, e.g || "", e.text, i].join("|")); return [[e.type, e.id, e.date, e.type === "notice" ? e.text.replace(/\s+/g, "").replace(/(고시|공고)$/, "") : e.text].join("|")]; };
  const uniqN = (L) => new Set(L.flatMap(evKeys)).size;
  const CH = J(P("public/data/changes.json")), asOf = CH.asOf;
  // 1) 저장소 자료 그대로 하루씩 재생(같은 날 다시 돌린 changes.py로 밀린 자료 표시를 붙인 뒤)
  const R0 = sandbox("r0");
  py(["tools/changes.py"], { ZP_ROOT: R0, CHANGES_TODAY: asOf });
  py(["tools/today.py", "--replay", "30", "--out", path.join(R0, "rep"), "--asof", asOf, "--tho-lag", "1"], { ZP_ROOT: R0 });
  const CH0 = J(path.join(R0, "public/data/changes.json")), AU = J(P("public/data/auction.json"));
  const days = fs.readdirSync(path.join(R0, "rep")).sort().map((f) => J(path.join(R0, "rep", f)));
  // ---------- sim30 ----------
  {
    const card = (t) => { const s = Z.seoul(t); return [s.text, s.bf].filter(Boolean).join(" / "); };
    let same = 0, zeroBig = [], bad = [];
    days.forEach((t, i) => {
      const s = Z.seoul(t), c = card(t);
      if (i && c === card(days[i - 1])) same++;
      if (/(^|\s)0(\s|$|건)/.test(s.parts.map((p) => p.t).join(" "))) zeroBig.push(t.asOf);
      if (!s.text) bad.push(t.asOf);
    });
    const ratio = same / Math.max(1, days.length - 1);
    check(ratio <= 0.2 && !zeroBig.length && !bad.length, "today.sim30", `같은 날 ${same}/${days.length - 1}(${Math.round(ratio * 100)}%) · 0 강조 ${zeroBig.join(",")} · 빈 카드 ${bad.join(",")}`);
    console.log(`  sim30 같은 날 비율 ${Math.round(ratio * 100)}% · 조용한 날 ${days.filter((t) => Z.seoul(t).quiet).map((t) => t.asOf.slice(5)).join(" ")}`);
  }
  // ---------- same: 홈 = 소식 목록 = 원자료 = 푸시 ----------
  {
    const { compose, match } = await import(P("worker/push.js"));
    const errs = [];
    for (const t of days) {
      at(t.asOf);
      const d = t.seoul.d, fc = Z.feedCount(t, t.asOf);
      for (const k of ["trade", "hi", "notice", "stage", "auc_new", "auc_drop"]) if (d[k] !== fc[k]) errs.push(`${t.asOf} ${k} 홈 ${d[k]} ≠ 목록 ${fc[k]}`);
      if (t.tho_d && d.tho !== Z.feedCount(t, t.tho_d).tho) errs.push(`${t.asOf} tho 홈 ${d.tho} ≠ 목록(${t.tho_d}) ${Z.feedCount(t, t.tho_d).tho}`);
      const sc = Z.sched(t, { today: true }).filter((g) => g.date === t.asOf).reduce((a, g) => a + g.n, 0);
      if (d.auc_sale !== sc) errs.push(`${t.asOf} 매각 오늘 홈 ${d.auc_sale} ≠ 일정 ${sc}`);
      // 원자료(changes.json): 그날 올라온 사건 · 밀린 자료 뺌
      const raw = CH0.items.filter((e) => e.date === t.asOf && !e.bf);
      const rt = uniqN(raw.filter((e) => e.type === "trade")), rn = uniqN(raw.filter((e) => e.type === "notice")), ra = uniqN(raw.filter((e) => e.type === "auction" && e.ak !== "drop"));   // 겹치는 구역 한 번만
      if (rt !== d.trade || rn !== d.notice || ra !== d.auc_new) errs.push(`${t.asOf} 원자료 거래 ${rt}/${d.trade} 고시 ${rn}/${d.notice} 경매 ${ra}/${d.auc_new}`);
      // 원자료(auction.json): 그날 매각기일 사건·물건(그날 기준 예정)
      const ks = new Set(); Object.values(AU.byZone || {}).forEach((L) => L.forEach((o) => { if (o.date === t.asOf && String(o.fs || "9") <= t.asOf && !(o.st === "gone" && String(o.ls || "") < t.asOf)) ks.add(`${o.cs}#${o.no || 1}`); }));
      if (ks.size !== d.auc_sale) errs.push(`${t.asOf} 매각 원자료 ${ks.size} ≠ ${d.auc_sale}`);
      // 이번 주 = 7일 목록 합
      const w = t.seoul.w, wk = { trade: 0, notice: 0, stage: 0 };
      t.ev.forEach((e) => { if (e[4].includes("b")) return; if (e[1] === "trade") wk.trade += e[6] != null ? e[6] : e[5]; else if (e[1] === "notice" || e[1] === "stage") wk[e[1]]++; });
      for (const k of Object.keys(wk)) if (wk[k] !== w[k] && !t.cut) errs.push(`${t.asOf} 주 ${k} ${w[k]} ≠ 목록 ${wk[k]}`);
      // 푸시 주간 줄(worker) = 앱 미리보기 줄
      const msg = compose(match({ z: ["qa"], c: [] }, [], { f: "w" }), t.asOf, { f: "w", asOf: t.asOf, wk: w });
      if (!msg || !msg.body.includes(Z.weekLine(t))) errs.push(`${t.asOf} 푸시 주간 줄 다름: ${msg && msg.body.split("\n")[1]} / ${Z.weekLine(t)}`);
    }
    check(!errs.length, "today.same", errs.slice(0, 4).join(" · ") + (errs.length > 4 ? ` 외 ${errs.length - 4}` : ""));
  }
  // ---------- bf: 경매 첫 수집(10.18) ----------
  {
    const t = days.find((x) => Object.values(x.seoul.bf || {}).some((v) => v > 0));
    const raw18 = CH0.items.filter((e) => e.type === "auction" && e.date === "2026-10-18");
    const errs = [];
    if (!raw18.length || raw18.some((e) => !e.bf)) errs.push(`10.18 경매 ${raw18.length}건 중 bf 없음 ${raw18.filter((e) => !e.bf).length}`);
    if (!t) errs.push("밀린 자료 날 없음");
    else {
      const s = Z.seoul(t);
      if (t.seoul.d.auc_new !== 0 && t.asOf === "2026-10-18") errs.push(`10.18 오늘 경매 ${t.seoul.d.auc_new}`);
      if (!/새로 확인한 지난 자료 [\d,]+건/.test(s.bf)) errs.push("밀린 자료 줄 없음");
      if (Z.feed(t).some((r) => r.bf)) errs.push("오늘 목록에 밀린 자료");
      if (!Z.feed(t, { bf: true }).length) errs.push("밀린 자료 묶음 비어 있음");
    }
    check(!errs.length, "today.bf", errs.join(" · "));
    if (t) console.log(`  bf ${t.asOf}: ${Z.seoul(t).bf} · 오늘 줄 '${Z.seoul(t).text}'`);
  }
  // ---------- words: 금지어·법적 표현·기준일 ----------
  {
    const errs = [];
    const walk = (o, at) => { if (typeof o === "string") { if (!at.startsWith("banned")) { const h = banHit(o); if (h) errs.push(`사전 ${at}: ${h}`); } } else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, at ? at + "." + k : k); };
    walk(FW, "");
    const { compose, match } = await import(P("worker/push.js"));
    for (const t of days) {
      const s = Z.seoul(t);
      for (const x of [s.head, s.text, s.bf, s.tho]) { const h = banHit(x); if (h) errs.push(`${t.asOf} 홈 '${h}'`); }
      if (!/\d+\.\d+\(.\)/.test(s.head)) errs.push(`${t.asOf} 머리에 기준일 없음`);
      for (const e of t.ev) if (e[1] !== "notice") { const h = banHit(e[3]); if (h) errs.push(`${t.asOf} 소식 '${e[3]}'`); }   // 고시 제목은 원문(기관 문서 이름) 그대로라 뺀다
      const z = [...new Set(t.ev.map((e) => e[0]))].slice(0, 5);
      const items = CH0.items.filter((e) => e.date === t.asOf);
      for (const f of ["i", "d", "w"]) { const m = compose(match({ z, c: [{ cash: 3, mode: "gap" }] }, items, { f, sched: t.auc.slice(0, 3) }), t.asOf, { f, asOf: t.asOf, wk: t.seoul.w }); if (m) { const h = banHit(m.title + m.body); if (h) errs.push(`${t.asOf} 푸시 '${h}'`); if (FW.banned_head.some((w) => m.title.includes(w))) errs.push(`${t.asOf} 푸시 제목 신고가`); if (!/^\d+\.\d+ 기준/.test(m.body)) errs.push(`${t.asOf} 푸시 기준일 없음`); } }
    }
    const note = FW.auc.note;
    if (!/낙찰가가 아니에요/.test(note) || !/제37조제3항제5호/.test(note) || !/확인 필요/.test(note) || !/요건/.test(note)) errs.push("경매 고지: 최저가≠낙찰가·§37③5 요건·확인 필요");
    if (!/계산상/.test(FW.rad.head) || !/추천 목록이 아니에요/.test(FW.rad.head)) errs.push("레이더 머리 '계산상 · 추천 목록이 아니에요'");
    if (!/계산상/.test(FW.push.cond)) errs.push("푸시 조건 줄 '계산상'");
    check(!errs.length, "today.words", [...new Set(errs)].slice(0, 5).join(" · "));
  }
  // ---------- names ----------
  {
    const errs = [];
    const KEEP = new Set(["cs", "no", "court", "dept", "date", "time", "appr", "min", "rate", "fail", "use", "addr", "jb", "ll", "fs", "ls", "st", "est", "mh"]);
    Object.values(AU.byZone || {}).forEach((L) => L.forEach((o) => { for (const k of Object.keys(o)) if (!KEEP.has(k)) errs.push(`auction.json 키 ${k}`); for (const v of Object.values(o)) if (typeof v === "string" && NAME_RE.test(v)) errs.push(`auction.json '${v}'`); }));
    for (const t of days) {
      const s = JSON.stringify(t);
      const m = NAME_RE.exec(s); if (m) errs.push(`${t.asOf} today.json '${m[0]}'`);
    }
    const ics = Z.ics(Z.icsAuc(Z.sched(days[days.length - 1]).flatMap((g) => g.items), (id) => id));
    if (NAME_RE.test(ics)) errs.push("ics 이름");
    check(!errs.length, "today.names", [...new Set(errs)].slice(0, 5).join(" · "));
  }
  // ---------- cv: 계산 버전 바꾼 시험 실행 ----------
  {
    const CALC = J(P("pipeline/calc.json")), st0 = J(P("pipeline/cache/changes_state.json"));
    const ids = Object.keys(CALC).filter((i) => CALC[i] && CALC[i].gapNow != null && CALC[i].jeonse != null && st0.prev && st0.prev[i]).slice(0, 6);
    // 대조군 준비: 어제 스냅숏을 오늘 계산값 + 전세 기준 0.6억 낮음·필요한 돈 0.6억 높음으로(전세 기준이 오른 원인 → 필요한 돈 내려감)
    const prep = (R, cvOn) => {
      const f = path.join(R, "pipeline/cache/changes_state.json"), st = J(f);
      for (const i of ids) { const c = CALC[i], n = (((c.f || {}).num || {}).ref || {}).n; st.prev[i] = { ...st.prev[i], g: +(c.gapNow + 0.6).toFixed(4), c: c.now, j: +(c.jeonse - 0.6).toFixed(4), p: c.price, n: Number.isInteger(n) ? n : null, s: st.snap[i] ? st.snap[i].s : st.prev[i].s }; }
      st.pver = "calc-qa-old"; fs.writeFileSync(f, JSON.stringify(st));
      fs.writeFileSync(path.join(R, "pipeline/calc_ver.json"), JSON.stringify({ ver: cvOn ? "calc-qa-new" : "calc-qa-old" }));
    };
    const run = (name, cvOn) => {
      const R = sandbox(name, (R) => prep(R, cvOn));
      py(["tools/changes.py"], { ZP_ROOT: R, CHANGES_TODAY: st0.day });
      py(["tools/today.py", "--asof", st0.day], { ZP_ROOT: R });
      return { ch: J(path.join(R, "public/data/changes.json")), td: J(path.join(R, "public/data/today.json")) };
    };
    const { match } = await import(P("worker/push.js"));
    const A = run("cv_on", true), B = run("cv_off", false), errs = [];
    const pa = A.ch.items.filter((e) => e.type === "price" && e.date === st0.day);
    if (!pa.length || pa.some((e) => !e.bf || !(e.why || []).includes("cv"))) errs.push(`버전 바뀐 날 price ${pa.length}건 중 bf·cv 없음 ${pa.filter((e) => !e.bf).length}`);
    const radA = ids.filter((i) => A.td.rad.g[i]);
    if (radA.length) errs.push(`버전 바뀐 날 레이더에 ${radA.length}곳`);
    const subs = [0.5, 1, 2, 3, 5, 8].map((cash) => ({ z: [], c: [{ cash, mode: "gap" }, { cash, mode: "cash" }] }));
    const pushA = subs.reduce((a, s) => a + match(s, pa, { f: "d" }).cond.length, 0);
    if (pushA) errs.push(`버전 바뀐 날 푸시 ${pushA}건`);
    // 대조군: 같은 버전이면 원인(전세 기준)과 함께 레이더에 나온다 → 앱 판정(zstate 대신 시험용)으로 '새로 가능'
    const radB = ids.filter((i) => B.td.rad.g[i] && /전세 기준 ▲0\.6억/.test(B.td.rad.g[i][2]));
    if (radB.length !== ids.length) errs.push(`대조군 레이더 ${radB.length}/${ids.length}`);
    const i0 = ids[0], v = B.td.rad.g[i0];
    if (v) { const cash = (v[0] + v[1]) / 2, r = Z.radar(B.td, { cash, gap: true, zstate: (id) => (id === i0 ? { st: "ok", need: v[1] } : { st: "far" }) }); if (!r.nw.some((x) => x.id === i0)) errs.push("대조군 radar() 새로 가능 아님"); }
    const pb = B.ch.items.filter((e) => e.type === "price" && e.date === st0.day && ids.includes(e.id));
    if (pb.some((e) => e.bf || !(e.why || []).includes("jr"))) errs.push("대조군 price 원인 jr 아님");
    check(!errs.length, "today.cv", errs.join(" · "));
    console.log(`  cv: 버전 바뀐 날 price ${pa.length}건 모두 bf · 레이더 ${radA.length} · 푸시 ${pushA} / 대조군 레이더 ${radB.length}/${ids.length}`);
  }
  // ---------- x: 신고가 소식으로 낸 거래가 해제되면 '해제됨' 표시(지우지 않음) ----------
  {
    const errs = [], st0 = J(P("pipeline/cache/changes_state.json"));
    const e0 = (st0.ev || []).find((e) => e.type === "trade" && Array.isArray(e.tk) && e.tk.length && e.hi) || (st0.ev || []).find((e) => e.type === "trade" && Array.isArray(e.tk) && e.tk.length);
    if (!e0) errs.push("거래 지문(tk) 있는 사건 없음");
    else {
      const R = sandbox("xcan", (R) => { const f = path.join(R, "pipeline/cache/tx_cancel.json"); try { fs.unlinkSync(f); } catch (e) {} fs.writeFileSync(f, JSON.stringify({ [e0.tk[0]]: "20261024" })); });
      py(["tools/changes.py"], { ZP_ROOT: R, CHANGES_TODAY: st0.day }); py(["tools/today.py", "--asof", st0.day], { ZP_ROOT: R });
      const ch = J(path.join(R, "public/data/changes.json")), td = J(path.join(R, "public/data/today.json"));
      const e1 = ch.items.find((e) => e.k === e0.k);
      if (!e1) errs.push("해제된 사건이 지워짐"); else if (!(e1.x === 1 && e1.xd === st0.day && e1.xc === "2026-10-24")) errs.push(`표시 ${JSON.stringify({ x: e1.x, xd: e1.xd, xc: e1.xc })}`);
      const row = td.ev.find((x) => x[0] === e0.id && x[2] === e0.date && x[1] === "trade" && x[3] === e0.text);
      if (row && !row[4].includes("x")) errs.push("today.json 표시 x 없음");
      if (row && Z.feed(td, { day: row[2] }).find((r) => r.text === row[3] && r.id === row[0]).tag !== FW.x.tag) errs.push("목록 꼬리표 '해제됨' 없음");
      if (e0.hi && row && td.seoul.d.hi > Z.feedCount(td).hi) errs.push("해제된 신고가가 신고가 수에 남음");
      const { match, compose } = await import(P("worker/push.js"));
      const m = match({ z: [e0.id], c: [] }, [], { f: "d", all: ch.items, from: "2000-01-01", to: st0.day });
      if (m.fix !== 1) errs.push(`푸시 정정 셈 ${m.fix}`);
    }
    check(!errs.length, "today.x", errs.join(" · "));
  }
  // ---------- sched: 출처 있는 날짜만 ----------
  {
    const errs = [], src = new Set();
    Object.entries(AU.byZone || {}).forEach(([z, L]) => L.forEach((o) => src.add(`${z}|${o.cs}|${o.date}`)));
    for (const t of days) for (const a of t.auc) { if (!src.has(`${a[0]}|${a[1]}|${a[3]}`)) errs.push(`${t.asOf} ${a[1]} ${a[3]} 출처 없음`); if (a[3] < t.asOf) errs.push(`${t.asOf} 지난 기일 ${a[3]}`); }
    for (const t of days) { at(t.asOf); for (const g of Z.sched(t)) if (g.items.every((r) => r.old) ? g.dday !== "" : !/^D-(day|\d+)$/.test(g.dday)) errs.push(`${t.asOf} D-day '${g.dday}'`); }
    check(!errs.length, "today.sched", errs.slice(0, 4).join(" · "));
  }
  // ---------- ics ----------
  {
    const errs = [], t = days[days.length - 1];
    at(t.asOf);
    Z.mySched.add({ d: "2026-11-20", title: "조합 총회(직접 확인; 2차)", t: "14:00" });
    const s = Z.ics(Z.icsAuc(Z.sched(t).flatMap((g) => g.items), (id) => "구역" + id).concat(Z.icsMine()), "2026-10-31T00:00:00Z");
    const lines = s.split("\r\n");
    if (!s.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n") || !s.endsWith("END:VCALENDAR\r\n")) errs.push("머리·끝");
    if (/[^\r]\n/.test(s)) errs.push("LF만 있는 줄");
    if (lines.some((l) => Buffer.byteLength(l) > 75)) errs.push("75옥텟 넘는 줄");
    if (!/TZID:Asia\/Seoul/.test(s) || !/DTSTART;TZID=Asia\/Seoul:\d{8}T\d{6}/.test(s)) errs.push("시간대");
    const nEv = (s.match(/BEGIN:VEVENT/g) || []).length, want = Z.sched(t).reduce((a, g) => a + g.n, 0) + 1;
    if (nEv !== want) errs.push(`VEVENT ${nEv} ≠ ${want}`);
    const un = s.replace(/\r\n /g, "");
    if (!/최저가는 낙찰가가 아니에요/.test(un)) errs.push("최저가 고지");
    if (!/직접 넣은 일정/.test(un)) errs.push("직접 넣은 일정 표시");
    if (banHit(un)) errs.push("금지어 " + banHit(un));
    if (!/SUMMARY:조합 총회\(직접 확인\\; 2차\)/.test(un)) errs.push("세미콜론 이스케이프(\\;) 안 됨");
    // 범위(icsFor): mine = 내 일정만 · fav = 관심 구역 경매만 · 기본 mf = 둘 다 · all = + 내 돈 안
    const R0 = Z.sched(t).flatMap((g) => g.items), fz = new Set(R0.slice(0, 2).map((r) => r.id));
    const sc = (k) => Z.icsFor(t, k, { fav: fz, cash: 3, name: (id) => id });
    const nf = R0.filter((r) => fz.has(r.id)).length, nIn = R0.filter((r) => fz.has(r.id) || (r.min > 0 && r.min <= 3e8 + 1)).length;
    if (sc("mine").nAuc !== 0 || sc("mine").nMine !== 1) errs.push("범위 mine");
    if (sc("fav").nMine !== 0 || sc("fav").nAuc !== nf) errs.push(`범위 fav ${sc("fav").nAuc}/${nf}`);
    if (sc().scope !== "mf" || sc().nAuc !== nf || sc().nMine !== 1) errs.push("기본 범위 mf");
    if (sc("all").nAuc !== nIn) errs.push(`범위 all ${sc("all").nAuc}/${nIn}`);
    check(!errs.length, "today.ics", errs.join(" · "));
  }
  // ---------- clock: 기기 11.01 · 자료 10.25 ----------
  {
    const errs = [], t = days.find((x) => x.asOf === "2026-10-25") || days[days.length - 1];
    at("2026-11-01", "07:00");
    if (Z.ref(t) !== "2026-11-01") errs.push(`기준 날짜 ${Z.ref(t)}`);
    const G = Z.sched(t), R = G.flatMap((g) => g.items);
    if (R.some((r) => r.date < "2026-11-01")) errs.push(`지난 기일 ${R.filter((r) => r.date < "2026-11-01").length}건`);
    const fresh = { ...t, cts: Object.fromEntries(Object.keys(t.cts || {}).map((c) => [c, "2026-11-01"])) };   // 법원 확인이 새것이면 D-n은 기기 날짜로
    for (const g of Z.sched(fresh)) { const n = Math.round((Date.parse(g.date) - Date.parse("2026-11-01")) / 864e5), want = n === 0 ? "D-day" : `D-${n}`; if (g.dday !== want) errs.push(`${g.date} ${g.dday} ≠ ${want}`); }
    if (Z.dday("2026-11-03", Z.kd()) !== "D-2") errs.push(`내 일정 11.3 ${Z.dday("2026-11-03", Z.kd())}`);
    if (!/^7일 전 자료예요/.test(Z.stale(t))) errs.push(`띠 '${Z.stale(t)}'`);
    Z.mySched.add({ d: "2026-10-28", title: "지난 일정" }); Z.mySched.add({ d: "2026-11-03", title: "총회" });
    const ev = Z.icsFor(t, "all", { fav: new Set(R.map((r) => r.id)), cash: 100, name: (id) => id }).evs, ics = Z.ics(ev);
    if (ev.some((e) => e.date < "2026-11-01")) errs.push("ICS 지난 날짜");
    if (!ics.includes("DTSTART;VALUE=DATE:20261103")) errs.push("ICS 내 일정 11.3 없음");
    if (/2026102[5-9]|2026103[01]/.test(ics.replace(/DTSTAMP:\S+/g, ""))) errs.push("ICS에 10.25~10.31 날짜");
    const soon = Z.mySoon(3); if (soon.length !== 1 || soon[0].dday !== "D-2") errs.push(`내 일정 3일 안 ${JSON.stringify(soon.map((x) => x.dday))}`);
    at("2026-10-25"); if (Z.stale(t)) errs.push("같은 날인데 띠");
    check(!errs.length, "today.clock", errs.join(" · "));
    console.log(`  clock 11.01/10.25: 다가오는 ${R.length}건 · 띠 '${(at("2026-11-01"), Z.stale(t))}'`);
  }
  // ---------- stale: 법원 확인 3일 ----------
  {
    const errs = [], t = days.find((x) => x.asOf === "2026-10-25") || days[days.length - 1];
    at(t.asOf);
    const R = Z.sched(t).flatMap((g) => g.items);
    for (const r of R) { const d = [((t.cts || {})[r.court]) || "", r.chk].sort().pop(), old = (Date.parse(t.asOf) - Date.parse(d)) / 864e5 > 3; if (old !== r.old) errs.push(`${r.cs} old ${r.old}`); if (r.old && r.dday) errs.push(`${r.cs} 오래된 자료에 D-day`); if (!r.chkT) errs.push(`${r.cs} 법원 확인 표시 없음`); }
    const fav = new Set(R.filter((r) => r.old).map((r) => r.id).slice(0, 5));
    if (Z.homeFirst(t, fav, false, "최저가 기준", () => true).some((x) => x.type === "auc_d" && R.find((r) => r.id === x.id && r.old && !R.some((q) => q.id === x.id && !q.old)))) errs.push("홈 일정 줄에 오래된 물건");
    const sm = R.filter((r) => r.sm), city = R.filter((r) => !r.sm);
    if (!sm.length || sm.some((r) => r.noteT !== FW.auc.small) || city.some((r) => r.noteT !== FW.auc.note)) errs.push(`사업 종류별 고지 소규모 ${sm.length}`);
    if (!/소규모주택정비법 제24조/.test(FW.auc.small) || !/확인 필요/.test(FW.auc.small)) errs.push("auc.small 문구");
    const rk = R.filter((r) => r.riskT); if (rk.some((r) => !(r.fail >= 3 || r.min < r.appr * 0.5))) errs.push("위험 꼬리 조건");
    if (!R.some((r) => r.fail >= 3) || R.filter((r) => r.fail >= 3).some((r) => !r.riskT)) errs.push("유찰 3회 이상인데 꼬리 없음");
    const ics = Z.ics(Z.icsAuc(sm.slice(0, 1))).replace(/\r\n /g, ""); if (sm.length && !/소규모주택정비법/.test(ics)) errs.push("ICS 소규모 고지");
    // 푸시 D-1: 법원 자료 묵음 → 0통(worker aucOld와 같은 셈)
    const { aucOld } = await import(P("worker/push.js"));
    for (const a of t.auc) { const r = R.find((x) => x.cs === a[1] && x.no === a[2]); if (r && aucOld(a, t.cts, Z.ref(t), t.asOf) !== r.old) errs.push(`${a[1]} 푸시 old ≠ 화면 old`); }
    check(!errs.length, "today.stale", errs.slice(0, 5).join(" · "));
    console.log(`  stale: ${t.asOf} 일정 ${R.length}건 중 법원 확인 3일 넘음 ${R.filter((r) => r.old).length} · 소규모 ${sm.length} · 위험 꼬리 ${rk.length}`);
  }
  // ---------- dedup: 겹치는 구역 한 번만 ----------
  {
    const errs = [], t = days.find((x) => x.asOf === "2026-10-25") || days[days.length - 1];
    const raw = CH0.items.filter((e) => e.date === t.asOf && !e.bf && e.type === "trade");
    const naive = raw.reduce((a, e) => a + (e.cnt || 1), 0), u = uniqN(raw);
    if (t.seoul.d.trade !== u) errs.push(`서울 거래 ${t.seoul.d.trade} ≠ 고유 ${u}`);
    if (u > naive) errs.push("고유 > 단순 합");
    // 허가: 접수번호 고유 = 구역 줄 u 합
    const TH = J(P("pipeline/cache/toheo.json")), PAR = J(P("pipeline/cache/parcels.json")), p2z = {};
    for (const [rid, v] of Object.entries(PAR)) for (const q of v.p || []) (p2z[q[0]] = p2z[q[0]] || []).push(rid);
    const dd = (t.tho_d || ""), ks = new Set(); let nz = 0;
    for (const [k, v] of Object.entries(TH)) if (v[5] === "허가" && v[4] === "주거용" && `${v[0].slice(0, 4)}-${v[0].slice(4, 6)}-${v[0].slice(6)}` === dd && p2z[v[1]]) { ks.add(k); nz += new Set(p2z[v[1]]).size; }
    if (t.seoul.d.tho !== ks.size) errs.push(`허가 ${t.seoul.d.tho} ≠ 접수번호 고유 ${ks.size}(구역 합 ${nz})`);
    // 같은 날 같은 고시(o645 '(변경)인가고시'·'(변경)인가')는 한 줄
    const o645 = t.ev.filter((e) => e[0] === "o645" && e[1] === "notice" && e[2] === "2026-10-22");
    if (days.some((x) => x.asOf >= "2026-10-22") && o645.length !== 1) errs.push(`o645 고시 ${o645.length}줄`);
    // 계산 버전 바뀐 날(10.25 · price 모두 cv): cvd · home.cv · rad.cv
    if (t.asOf === "2026-10-25") { if (!(t.cvd || []).includes("2026-10-25")) errs.push(`cvd ${JSON.stringify(t.cvd)}`); if (Z.seoul(t).cv !== FW.home.cv) errs.push("home.cv 없음"); if (Z.radar(t, { cash: 3, gap: true, zstate: () => null }).cv !== FW.rad.cv) errs.push("rad.cv 없음"); }
    // '내 돈 안만' 경매는 물건 단위(최저가 ≤ 내 돈): 줄마다 mn
    if (t.ev.some((e) => e[1] === "auction" && e.length !== 8)) errs.push("경매 줄 mn 칸 없음");
    check(!errs.length, "today.dedup", errs.join(" · "));
    console.log(`  dedup ${t.asOf}: 거래 단순 합 ${naive} → 고유 ${u} · 허가 구역 합 ${nz} → 접수번호 ${ks.size}`);
  }
  // ---------- xe2e: 해제 정정 끝까지(tx.py → tx_cancel.json → changes.py → today.json → 푸시) ----------
  {
    const errs = [], st0 = J(P("pipeline/cache/changes_state.json")), TX = J(P("public/data/tx.json"));
    // 오늘 거래 사건 하나 → 그 구역 tx.json 행 중 지문(tk)이 같은 행을 찾아 합성 CSV 한 줄(취소일 있음)로
    const tkey = (x) => require("crypto").createHash("md5").update(`${x[0]}|${x[1]}|${x[3]}|${x[4]}|${x[5]}|${x[6] != null ? x[6] : ""}`).digest("hex").slice(0, 8);
    let e0 = null, row = null;
    for (const e of st0.ev || []) { if (e.type !== "trade" || !e.tk || e.x) continue; const r = ((TX[e.id] || {}).s || []).find((x) => tkey(x) === e.tk[0]); if (r && (r[1] === 0 || r[1] === 2)) { e0 = e; row = r; break; } }
    if (!e0) errs.push("오늘 거래 사건과 맞는 tx.json 행 없음");
    else {
      const R = sandbox("xe2e", (R) => { try { fs.unlinkSync(path.join(R, "pipeline/cache/tx_cancel.json")); } catch (e) {} fs.mkdirSync(path.join(R, "tools"), { recursive: true }); for (const f of ["tx.py", "junk.py", "changes.py", "today.py", "zsample.py", "feed_words.json", "jsnum.py"]) if (fs.existsSync(P("tools/" + f))) fs.copyFileSync(P("tools/" + f), path.join(R, "tools", f)); fs.mkdirSync(path.join(R, "src"), { recursive: true }); fs.symlinkSync(P("src/data.json"), path.join(R, "src/data.json")); });
      const H = ["자치구코드", "자치구명", "법정동코드", "법정동명", "지번구분", "본번", "부번", "건물명", "계약일", "물건금액(만원)", "건물면적(㎡)", "토지면적(㎡)", "층", "권리구분", "취소일", "건축년도", "건물용도"];
      const use = row[1] === 2 ? "아파트" : "연립다세대";
      const line = ["11110", "종로구", "10100", "청운동", "1", "0001", "0000", "QA", row[0], String(row[5]), String(row[3]), String(row[4]), String(row[6]), "", "20261024", String(row[2] || 2000), use];
      const csv = path.join(R, "sale_qa.csv"); fs.writeFileSync(csv, "\ufeff" + H.join(",") + "\n" + line.join(",") + "\n");
      spawnSync("python3", ["tools/tx.py", "--sale", csv, "--rent", csv], { cwd: R, encoding: "utf8" });   // 행이 하나라 집계는 멈추지만 해제 지문은 먼저 쓴다
      const cx = fs.existsSync(path.join(R, "pipeline/cache/tx_cancel.json")) ? J(path.join(R, "pipeline/cache/tx_cancel.json")) : {};
      if (cx[e0.tk[0]] !== "20261024") errs.push(`tx.py 해제 지문 ${JSON.stringify(cx).slice(0, 80)} · 찾는 ${e0.tk[0]}`);
      py(["tools/changes.py"], { ZP_ROOT: R, CHANGES_TODAY: st0.day }); py(["tools/today.py", "--asof", st0.day], { ZP_ROOT: R });
      const ch = J(path.join(R, "public/data/changes.json")), td = J(path.join(R, "public/data/today.json"));
      const e1 = ch.items.find((e) => e.k === e0.k);
      if (!e1 || e1.x !== 1 || e1.xc !== "2026-10-24") errs.push(`changes.json 표시 ${JSON.stringify(e1 && { x: e1.x, xc: e1.xc })}`);
      const r1 = td.ev.find((x) => x[0] === e0.id && x[1] === "trade" && x[3] === e0.text);
      if (!r1 || !r1[4].includes("x")) errs.push("today.json x 없음");
      const { match, compose } = await import(P("worker/push.js"));
      const m = match({ z: [e0.id], c: [] }, [], { f: "d", all: ch.items, from: "2000-01-01", to: st0.day });
      const c = compose(m, st0.day, { f: "d" }) || compose({ ...m, zone: [{ id: e0.id, n: "q", text: "q", type: "stage" }] }, st0.day, { f: "d" });
      if (m.fix !== 1 || !/지난 소식 정정 1건\(거래 해제\)/.test(c.body)) errs.push(`푸시 정정 ${m.fix}`);
    }
    check(!errs.length, "today.xe2e", errs.join(" · "));
  }
  // ---------- size ----------
  {
    const errs = [];
    const td = P("public/data/today.json");
    if (fs.existsSync(td)) { const gz = zlib.gzipSync(fs.readFileSync(td), { level: 9 }).length; if (gz > 10240) errs.push(`today.json gzip ${gz}B`); console.log(`  today.json gzip ${gz}B`); } else errs.push("public/data/today.json 없음");
    const big = days.map((t) => zlib.gzipSync(JSON.stringify(t), { level: 9 }).length); if (Math.max(...big) > 10240) errs.push(`재생 중 가장 큰 날 gzip ${Math.max(...big)}B`);
    const nb = fs.existsSync(P("public/b")) ? fs.readdirSync(P("public/b")).filter((f) => /^n\.[0-9a-f]+\.js$/.test(f)).map((f) => [f, fs.statSync(P("public/b/" + f)).mtimeMs]).sort((a, b) => b[1] - a[1])[0] : null;
    if (nb) { const gz = zlib.gzipSync(fs.readFileSync(P("public/b/" + nb[0])), { level: 9 }).length; if (gz > 6144) errs.push(`묶음 gzip ${gz}B`); console.log(`  묶음 ${nb[0]} gzip ${gz}B`); }
    const fw = JSON.stringify(FW);
    if (fs.existsSync(P("pipeline/feed_words.json")) && fs.readFileSync(P("pipeline/feed_words.json"), "utf8") !== fw) errs.push("pipeline/feed_words.json 사본 다름(build.py)");
    if (!fs.readFileSync(P("worker/feed_words.js"), "utf8").includes("export default " + fw + ";")) errs.push("worker/feed_words.js 사본 다름(build.py)");
    check(!errs.length, "today.size", errs.join(" · "));
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  const bad = res.filter((r) => !r[0]).length;
  console.log(`qa_today ${res.length - bad}/${res.length} PASS`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log("FAIL today.run — " + String(e && e.stack || e).split("\n").slice(0, 3).join(" / ")); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(1); });
