#!/usr/bin/env node
/* QA data.sync — 같은 숫자가 앱 화면·공개 API·계산 엔진 결과(calc.json)·정적 /z 페이지에서 같은지 전수 대조.
   usage: NODE_PATH=$(npm root -g) node tools/qa_sync.js http://localhost:8777
   대상(진행 중 구역 전체):
   - 가까운 역: 이름 · 도보 분(거리×1.3÷67, Math.round) · 노선(앱 r.ln = API lines = calc ln)
   - 10년 안 준공 가능성 p10 · 예상 준공 가운데·범위(eMid·eLo·eHi): 앱(가로·소규모 보정 뒤 r.eta) = API completion = calc
   - /z 글자: '가까운 역 … 도보 N분' · '10년 안 준공 가능성은 약 N%'(probTxt) · '언제 입주' 칸(etaShow)
   /z는 매일 생성기가 다시 쓰므로, 코드를 고친 날에는 생성기를 다시 돌려야 맞는다(data.sync.z만 따로 실패로 보임). */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const BASE = process.argv[2] || "http://localhost:8777";
const ROOT = path.resolve(__dirname, "..");
const EXE = process.env.QA_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const fails = [];
const check = (ok, id, msg) => { console.log(`${ok ? "PASS" : "FAIL"} ${id}${ok ? "" : " — " + msg}`); if (!ok) fails.push(id); };
const wm = (d) => Math.max(1, Math.round((d * 1.3) / 67));
const eq = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-6);
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage();
  await p.route("**/*", (r) => (/^http:\/\/localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto(BASE + "/#map", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => window.ZP_feat && window.ZP_boot && ZP_boot.hyd === 1, null, { timeout: 60000 });
  const app = await p.evaluate(() => { const c = ZP_feat.ctx(), o = {}; c.R.forEach((r) => { let et = null; try { et = c.etaShow(r); } catch (e) {} o[r.id] = { st: r.st ? [r.st.n, r.st.d] : null, ln: r.ln || [], e: (() => { if (!r.eta) return null; const f = c.facts(r), h = f && f.eta && f.eta.hid; return [f && f.eta ? f.eta.p10 : null, h ? null : r.eta.eLo ?? null, h ? null : r.eta.eMid ?? null, h ? null : r.eta.eHi ?? null]; })(), em: r.eta ? r.eta.eMid ?? null : null, pr: r.eta ? r.eta.p10 ?? null : null, pt: (() => { const f = c.facts(r); return f && f.eta ? f.eta.p10Txt : null; })(), et }; }); return o; });   // 사이클 3: 화면에 싣는 확률·범위는 ZoneFacts(정체면 null · 범위가 10년 확률과 어긋나면 범위 null)
  await b.close();
  const C = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline", "calc.json"), "utf8"));
  const ZD = path.join(ROOT, "public", "api", "v1", "zones");
  const bad = { st: [], ln: [], eta: [], calc: [], z: [], zh: [] }; let n = 0, nz = 0, nh = 0;
  for (const f of fs.readdirSync(ZD)) {
    const id = f.slice(0, -5), a = JSON.parse(fs.readFileSync(path.join(ZD, f), "utf8")), x = app[id], c = C[id];
    if (!x) { bad.st.push(`${id} 앱에 없음`); continue; }
    n++;
    const S = a.station, xs = x.st;
    if (!!S !== !!xs || (S && (S.name !== xs[0] || S.walkMin !== wm(xs[1])))) bad.st.push(`${id} API ${S && S.name} ${S && S.walkMin}분 vs 앱 ${xs && xs[0]} ${xs && wm(xs[1])}분`);
    if (S && JSON.stringify(S.lines || []) !== JSON.stringify(x.ln)) bad.ln.push(`${id} API ${S.lines} vs 앱 ${x.ln}`);
    const K = a.completion, xe = x.e;
    if (xe && (K ? !(eq(K.p10, xe[0]) && (K.lo ?? null) == xe[1] && (K.mid ?? null) == xe[2] && (K.hi ?? null) == xe[3]) : xe[0] != null)) bad.eta.push(`${id} API ${JSON.stringify(K)} vs 앱 ${JSON.stringify(xe)}`);
    if (K && !xe) bad.eta.push(`${id} API에만 준공 값`);
    if (c) {
      if (!!c.st !== !!xs || (c.st && (c.st.n !== xs[0] || c.st.d !== xs[1]))) bad.calc.push(`${id} calc 역 ${JSON.stringify(c.st)} vs 앱 ${xs}`);
      if (JSON.stringify(c.ln || []) !== JSON.stringify(x.ln)) bad.calc.push(`${id} calc 노선`);
      if (xe && !(eq(c.p10, xe[0]) && eq(c.p10raw ?? null, x.pr) && (c.eMid ?? null) == x.em)) bad.calc.push(`${id} calc p10/eMid ${c.p10}/${c.eMid} vs 앱 ${xe[0]}/${xe[2]}`);
    }
    const zf = path.join(ROOT, "public", "z", id + ".html");
    if (fs.existsSync(zf)) {
      const h = fs.readFileSync(zf, "utf8"); nz++;
      const hand = !/<meta name="emr-auto" content="1">/.test(h), B = hand ? bad.zh : bad.z; if (hand) nh++;
      const ms = /<span>가까운 역<\/span><b>(.*?) 도보 (\d+)분<\/b>/.exec(h);
      if (ms && xs && (ms[1] !== xs[0] || +ms[2] !== wm(xs[1]))) B.push(`${id} /z 역 ${ms[1]} ${ms[2]}분 vs 앱 ${xs[0]} ${wm(xs[1])}분`);
      const mp = /10년 안 준공 가능성은 (1% 미만이|약 (\d+)%)/.exec(h);
      if (mp && x.pt && (mp[2] ? mp[2] + "%" : "1% 미만") !== x.pt) B.push(`${id} /z 준공 가능성 ${mp[1]} vs 앱 ${x.pt}`);
      const me = /<b class="zk-v zk-eta">(.*?)<\/b>/.exec(h);
      if (me && x.et && /년/.test(me[1]) && me[1] !== x.et) B.push(`${id} /z 언제 입주 ${me[1]} vs 앱 ${x.et}`);
    }
  }
  console.log(`  구역 ${n}곳 · /z ${nz}쪽(손글 ${nh})`);
  check(!bad.st.length, "data.sync.station", `${bad.st.length}곳 · ${bad.st.slice(0, 4).join(" ; ")}`);
  check(!bad.ln.length, "data.sync.lines", `${bad.ln.length}곳 · ${bad.ln.slice(0, 3).join(" ; ")}`);
  check(!bad.eta.length, "data.sync.eta", `${bad.eta.length}곳 · ${bad.eta.slice(0, 3).join(" ; ")}`);
  check(!bad.calc.length, "data.sync.calc", `${bad.calc.length}곳 · ${bad.calc.slice(0, 3).join(" ; ")}`);
  check(!bad.z.length, "data.sync.z", `${bad.z.length}곳 · ${bad.z.slice(0, 4).join(" ; ")}`);
  // 손글 /z(emr-auto 없음): 글 속 숫자는 글쓰기 트랙의 data-zv 치환(매일 calc·API 값으로 다시 씀)이 맡는다 — 따로 센다
  check(!bad.zh.length, "data.sync.zhand", `${bad.zh.length}곳 · ${bad.zh.slice(0, 4).join(" ; ")}`);
  console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(", ")}` : "PASSED");
  process.exit(fails.length ? 1 : 0);
})();
