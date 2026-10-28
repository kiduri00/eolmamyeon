  /* ===================== ZoneFacts — 구역 판단 한 객체(사이클 3) =====================
     계산 함수는 c2에서 하나로 모았지만 '판단 문장'(보류 이유·다음 단계·입주 범위와 확률·정체 생략·전세가율)은 화면마다 따로 만들어
     o61(입주 7~10년 vs 10년 안 28%)·장위14 1km 표(11%)·o973(보류 이유 셋)·가로주택 다음 단계(관리처분)가 어긋났다.
     이제 구역마다 판단을 여기서 한 번만 만든다. 앱의 모든 화면(시트 머리·돈·일정 탭·목록·관심·근처·1km 표·비교·F2·'이미 가진 집이면')과
     정적 생성기(tools/zpages·zhand·og·api — tools/calc.js가 window.__emrCalc로 받은 calc.json 'f' 칸)는 이 객체만 읽는다.
     필드(모두 JSON으로 옮길 수 있는 값):
       kind  사업 유형 { g: redev|rebuild|small|moa|other, t: 화면 이름 }
       stage 현재 단계 이름 · s 단계 번호
       eta   { txt: 언제 입주 글자, p10: 화면에 싣는 10년 안 준공 확률(못 싣으면 null), p10Txt, why: 확률을 못 싣는 까닭, hid: 'range'면 범위를 숨긴 것, note }
             — 입주 범위(준공되는 경우 가운데 값)와 10년 확률은 같은 몬테카를로 분포(r.eta)에서. 범위가 '10년 안'을 말하는데 확률이 50% 아래면 범위를 숨긴다
       stall 같은 단계 8년 이상이면 그 햇수(통계 생략) · 아니면 0
       next  다음 단계 { to, k, state: before|in|over|stall|nostat, lo, mid, hi(연 소수 · F.yr 꼴), fromD, el, n, na, p25, med, p75, txt }
             — 가로·소규모·모아 사업시행인가 다음은 '이주·착공'(관리처분계획이 사업시행계획인가에 포함 · 소규모주택정비법 · 조항은 확인 필요)
               소규모 자체 통계(uses small)가 있을 때만 기간을 낸다
       hold  계산 보류 이유 하나 { now: 지금 필요한 돈 보류 {code, short, txt}, tot: 입주까지 보류, one: 화면에 쓸 한 가지 }
       jr    전세가율 { v: 계산에 쓴 %, src: user|zone|zoneLow|gu|seoul, txt: 출처, zone: 구역 실측 {v, n, no}|null, hold: 표본이 적은데 크게 낮아 전세 끼고 계산 보류 }
       win   입주권 판정 { cls, t, due } */
  const ZFX = (() => {
    const YMS = 365.25 * 864e5;
    const yr = (d) => { const m = /^(\d{4})[-.](\d{1,2})(?:[-.](\d{1,2}))?/.exec(String(d || "")); return m ? 1970 + Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1)) / YMS : null; };   // ZPF.yr과 같은 셈
    const ym = (y) => { if (y == null || !isFinite(y)) return "–"; const t = new Date((y - 1970) * YMS); return `${t.getUTCFullYear()}.${t.getUTCMonth() + 1}`; };
    const ymd = (d) => String(d || "").replace(/^(\d{4})-(\d{2})-(\d{2}).*/, (m, y, a, b) => `${y}.${+a}.${+b}`);
    // ---------- 다음 단계 ----------
    const NM = { 구역지정: "구역 지정", 추진위: "추진위 승인", 조합설립: "조합설립인가", 시행자지정: "사업시행자 지정", 사업시행: "사업시행인가", 관리처분: "관리처분인가", 착공: "착공", 준공: "준공", 이주착공: "이주·착공" };
    const NEXT = { 2: "구역지정>조합설립", 3: "추진위>조합설립", 4: "조합설립>사업시행", 5: "사업시행>관리처분", 6: "관리처분>착공", 8: "착공>준공" };
    const smallK = (r) => /가로|소규모|모아/.test(r.k || "");
    // 조건부 남은 기간(F2와 같은 셈): 서울 구간 기간을 로그정규로 근사 · 지금까지 el년 안 넘어간 사업장의 25·50·75%
    const erf2 = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
    const Phi2 = (z) => 0.5 * (1 + erf2(z / Math.SQRT2));
    const PhiInv = (p) => { let a = -8, b = 8; for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (Phi2(m) < p) a = m; else b = m; } return (a + b) / 2; };
    const condQ = (el, st) => { const mu = Math.log(st.med), sg = Math.max(0.05, (Math.log(st.p75) - Math.log(st.p25)) / 1.349), F0 = Phi2((Math.log(Math.max(el, 1e-6)) - mu) / sg); return [0.25, 0.5, 0.75].map((q) => Math.exp(mu + sg * PhiInv(F0 + q * (1 - F0)))); };
    const statOf = (r, k) => { const s = ZF.stageStat(r, k); return s && s.med != null && s.p25 != null ? s : null; };
    function nextOf(r) {
      if (!r || r.src === "moa" || r.dn || r.s >= 9) return null;
      const sm = smallK(r);
      // 가로·소규모: 사업시행계획인가에 관리처분계획이 들어 있어 다음은 이주·착공(관리처분인가 단계가 따로 없음)
      let k = NEXT[r.s], to = k ? k.split(">")[1] : null;
      if (sm && (r.s === 5 || r.s === 6)) { k = "사업시행>착공"; to = "이주착공"; }
      if (!k) return null;
      const from = k.split(">")[0], dt = r.dt || {};
      const fd = (from === "사업시행" && r.s === 6 ? dt["관리처분"] || dt["사업시행"] : dt[from]) || (from === "조합설립" ? dt["시행자지정"] : null) || r.sd;
      if (!fd || yr(fd) == null) return null;
      const y0 = yr(fd), el = ZF.yrsSince(fd);
      const base = { k, to, toName: NM[to] || to, fromName: NM[from] || from, fromD: fd, el };
      // 소규모 사업장은 자기 통계(uses small)가 있을 때만 기간을 낸다 — 큰 사업장 기간을 빌려 '다음 단계 예상'을 만들지 않는다
      const ts = sm ? (((D.etaMeta || {}).transitions || {}).small || {})[k] : null;
      const st = sm ? (ts && ts.uses === "small" ? statOf(r, k) : null) : statOf(r, k);
      let stall = 0; try { stall = stallYrs(r) || 0; } catch (e) {}
      let o;
      if (!st) o = { ...base, state: "nostat" };
      else {
        const b2 = { ...base, n: st.n, na: st.na, p25: st.p25, med: st.med, p75: st.p75 };
        if (stall) o = { ...b2, state: "stall", stall };
        else if (el > st.p75) o = { ...b2, state: "over" };
        else if (el >= st.p25) { const c = condQ(el, st); o = { ...b2, state: "in", lo: y0 + c[0], mid: y0 + c[1], hi: y0 + c[2] }; }
        else o = { ...b2, state: "before", lo: y0 + st.p25, mid: y0 + st.med, hi: y0 + st.p75 };
      }
      o.txt = o.state === "before" || o.state === "in" ? `${o.toName} 예상 ${ym(o.lo)} ~ ${ym(o.hi)}`
        : o.state === "over" ? `${o.toName} · 서울 보통 범위를 넘었어요`
        : o.state === "stall" ? `${o.toName} · 같은 단계에 ${ZF.dur(el)}째라 예상 시점을 내지 않아요`
        : sm ? `${o.toName} · 가로·소규모 사업장의 서울 기록이 적어 예상 시점을 내지 않아요` : `${o.toName} · 서울 비교 기록이 없어 예상 시점을 내지 않아요`;
      o.loTxt = o.lo != null ? ym(o.lo) : null; o.hiTxt = o.hi != null ? ym(o.hi) : null;
      return o;
    }
    // ---------- 입주 범위·10년 확률 ----------
    function etaOf(r) {
      let pr = {}; try { pr = projection(r); } catch (e) {}
      const show = hasEta(pr);
      const p10 = show && pr.p10 != null ? pr.p10 : null;
      let why = ""; try { why = p10Why(r); } catch (e) {}
      const o = { txt: etaShow(r), p10, p10Txt: p10 != null ? probTxt(p10) : null, why, hid: pr.unsure ? "range" : null, done: !!pr.done };
      if (pr.unsure) o.note = `준공되는 경우만 보면 가운데 값이 ${pr.unsure}이지만, 준공하지 못하는 경우까지 넣은 10년 안 준공 가능성이 ${probTxt(p10)}라 입주 범위를 싣지 않아요`;
      return o;
    }
    // ---------- 계산 보류 이유(하나) ----------
    const H = (code, short, txt) => ({ code, short, txt });
    function priceHold(r, x) {
      if (r.nx === "biz") return H("biz", "계산 대상 아님", "업무·상업 중심 사업이라 입주권 계산 대상이 아니에요");
      if (r.tag === "mk" || r.nx === "mk") return H("mk", "시장·상가 정비", "시장·상가 정비사업이라 빌라 시세로 매수가를 정하지 않아요");
      if (r.s >= 7 && r.s < 9) return H("move", "이주·철거 시작", "이주·철거가 시작돼 옛 집 매매가로는 매수가를 정할 수 없어요 · 아는 입주권 매물가를 넣으면 계산해요");
      if (r.s >= 6 && r.s < 9) return H("mp", "관리처분 뒤 거래", "관리처분인가 뒤 거래가에는 입주권 웃돈이 섞여 매수가로 쓰지 않아요 · 아는 매물가를 넣으면 계산해요");
      if (x && x.noApt) return H("noApt", "단지 거래 없음", "재건축 단지 아파트 거래가 없어 매수가를 정하지 못했어요 · 아는 매물가를 넣으면 계산해요");
      const t = r.tx || {};
      if (r.k === "재건축" || r.k === "소규모재건축") return H("noApt", "단지 거래 없음", t.na ? "단지 매매가 2년에 2건이 안 돼 매수가를 정하지 못했어요" : "단지 매매 신고가 없어 매수가를 정하지 못했어요");
      if (!r.ll) return H("noLoc", "위치 미공개", "위치가 공개되지 않은 후보지라 매수가를 정하지 못했어요");
      return H("noTx", "빌라 거래 부족", "구역 안팎 구축 빌라 매매가 적어 매수가를 정하지 못했어요 · 아는 매물가를 넣으면 계산해요");
    }
    function totHold(r, x) {
      if (!x || x.price == null) return null;
      if (x.nvThin || x.nv == null) { const t = ZF.noCalcTxt(r, x); return H("nv", "신축 시세 없음", t); }
      return H("tot", "입주까지 자료 부족", "입주까지 계산에 필요한 자료가 부족해요");
    }
    function holdOf(r, gap) {
      const out = { now: null, tot: null, one: null };
      let done = false; try { done = isDone(r); } catch (e) {}
      if (done || r.s >= 9) return out;
      if (r.src === "moa") { out.now = out.tot = H("moa", "사업구역별", "모아타운 관리지역은 사업구역마다 분담금·입주 시점이 달라 안의 사업구역에서 계산해요"); out.one = out.now; return out; }
      let nt = false; try { nt = noTicket(r); } catch (e) {}
      if (nt) { out.now = out.tot = H("nt", "입주권 없음", "지금 사면 입주권이 원칙적으로 없어 새 아파트 입주까지 계산하지 않아요"); out.one = out.now; return out; }
      let x = null; try { x = investC(r); } catch (e) {}
      let est = false; try { est = estHide(r); } catch (e) {}
      if (!x || x.price == null) out.now = priceHold(r, x);
      else if (gap) {
        let g = null; try { g = gapOf(r); } catch (e) {}
        const jr = jrInfo(r), jb = g && g.block && /^전세 끼고 계산 보류/.test(String(g.block));
        if (jb && jr.hold) out.now = H("jrLow", "전세가율 확인 필요", jr.holdTxt);
        else if (g && g.block && g.block !== "계산 대상 아님") {
          // 전세 끼고는 못 사는 곳: 지금 필요한 돈은 대출 끼고 값으로 보여 준다(보류 아님) · 입주권 판정 보류만 이유로
          if (!(x && x.needBuy != null && isFinite(x.needBuy) && !r.lc && r.tag !== "mk")) out.now = H("gapBlock", "전세 끼고 불가", String(g.block).replace(/\s*\(.*\)\s*$/, ""));
        }
      }
      if (!out.now) out.tot = gap ? (() => { let g = null; try { g = gapOf(r); } catch (e) {} if (g && !g.block && !g.na && g.total == null) return totHold(r, x); if (g && g.block && x && !x.ok) return totHold(r, x); return null; })() : x && !x.ok ? totHold(r, x) : null;
      if (est && !out.now) out.est = H("est", ZF.EXCL, `구역 거래가 적어 같은 구(${r.g}) 빌라 시세로 추정했어요 · ${ZF.EXCL}`);
      out.one = out.now || out.tot;
      return out;
    }
    // ---------- 전세가율 ----------
    //   구역 실측: 같은 건물 매매·전세 비교(tx.jr · 5곳 이상) 또는 ㎡당 비교(구축 빌라 전세 jn건·매매 no건, 면적대 ±30%) — tools/tx.py와 같은 재료
    //   기본(자치구·서울 평균)보다 크게 낮으면(35% 미만): 표본이 충분하면(전세·매매 각 5건 이상) 실측을 쓰고, 적으면 전세 끼고 계산을 보류한다
    const JR_LOW = 35;
    function zoneMeasured(r) {
      const t = r.tx, en = r.mk && r.mk.entry;
      if (!t || !en || en.src !== "villa") return null;
      if (t.jr && t.jrn >= 3) return { v: Math.round(t.jr * 1000) / 10, n: t.jrn, how: "bld" };
      if (t.jn >= 2 && t.no >= 2 && t.ja && t.ar && t.jm && t.med && Math.abs(t.ja - t.ar) / t.ar <= 0.3) return { v: Math.round(((t.jm / t.ja) / (t.med / t.ar)) * 1000) / 10, n: t.jn, no: t.no, how: "m2" };
      return null;
    }
    function jrInfo(r) {
      const base = JR_GU[r.g] ?? JR_SEOUL, zj = zoneJr0(r), m = zoneMeasured(r);
      if (P.jr != null) return { v: P.jr, src: "user", txt: "직접 설정", zone: m, hold: false };
      if (zj != null) return { v: zj, src: "zone", txt: r.tx.jr && r.tx.jrn >= 5 ? `구역 안 같은 건물 매매·전세 ${r.tx.jrn}곳 비교` : `구역 안 빌라 전세 ${r.tx.jn}건·매매 시세 비교`, zone: m, hold: false };
      if (m && m.v < JR_LOW && m.v < base) {
        const enough = m.how === "bld" ? m.n >= 5 : m.n >= 5 && m.no >= 5;
        if (enough) return { v: Math.max(1, m.v), src: "zoneLow", txt: m.how === "bld" ? `구역 안 같은 건물 매매·전세 ${m.n}곳 비교(실측 · ${r.g ? (JR_GU[r.g] != null ? r.g : "서울") : "서울"} 평균 ${base}%보다 크게 낮아 실측을 써요)` : `구역 안 구축 빌라 전세 ${m.n}건·매매 ${m.no}건 ㎡당 비교(실측 · ${JR_GU[r.g] != null ? r.g : "서울"} 평균 ${base}%보다 크게 낮아 실측을 써요)`, zone: m, hold: false };
        return { v: base, src: JR_GU[r.g] != null ? "gu" : "seoul", txt: JR_GU[r.g] != null ? `${r.g} 연립·다세대 평균(2026.3)` : "서울 연립·다세대 평균(2026.3)", zone: m, hold: true,
          holdTxt: `구역 안 전세 실측(${m.how === "bld" ? `같은 건물 매매·전세 ${m.n}곳 비교` : `전세 ${m.n}건·매매 ${m.no}건`})이 ${m.v}%로 평균 ${base}%보다 크게 낮은데 표본이 적어 전세 끼고 계산을 보류해요 · 실제 전세금을 넣으면 계산해요` };
      }
      return { v: base, src: JR_GU[r.g] != null ? "gu" : "seoul", txt: JR_GU[r.g] != null ? `${r.g} 연립·다세대 평균(2026.3)` : "서울 연립·다세대 평균(2026.3)", zone: m, hold: false };
    }
    // ---------- 한 객체 ----------
    let CACHE = new Map(), KEY = "";
    function build(r) {
      const g0 = r.src === "moa" ? "moa" : smallK(r) ? "small" : r.k === "재건축" ? "rebuild" : r.k === "재개발" || r.k === "도시정비형 재개발" ? "redev" : "other";
      let stage = ""; try { stage = stageName(r); } catch (e) {}
      let win = null; try { const w = buyWindow(r); win = { cls: w.cls, t: w.t, due: w.due || "" }; } catch (e) {}
      let stall = 0; try { stall = r.src === "moa" ? 0 : stallYrs(r) || 0; } catch (e) {}
      const gap = gapMode();
      const jr = jrInfo(r); jr.short = `${String(Math.round(jr.v * 10) / 10)}% · ${JRS[jr.src] || ""}`;
      return { id: r.id, s: r.s, stage, kind: { g: g0, t: SHAPE[shapeOf(r)] || "" }, eta: etaOf(r), stall, next: nextOf(r), hold: holdOf(r, gap), jr, win, mode: gap ? "gap" : "cash" };
    }
    function of(r) {
      if (!r) return null;
      const k = condKey() + "|" + P.fund + "|" + P.jr + "|" + P.est;
      if (k !== KEY) { CACHE = new Map(); KEY = k; }
      const ck = r.id + "|" + JSON.stringify(OV[r.id] || 0);
      let f = CACHE.get(ck);
      if (!f) { f = build(r); CACHE.set(ck, f); }
      return f;
    }
    const clear = () => { CACHE = new Map(); };
    // 전세가율 짧은 꼴(시트 첫 칸 · /z 첫 칸 같은 글): '3.4% · 구역 실측' · '56.6% · 서울 평균'
    const JRS = { user: "직접 설정", zone: "구역 실측", zoneLow: "구역 실측", gu: "구 평균", seoul: "서울 평균" };
    const jrShort = (r) => { const j = jrInfo(r); return `${String(Math.round(j.v * 10) / 10)}% · ${JRS[j.src] || ""}`; };
    return { of, clear, jrInfo, jrShort, JRS, nextOf, ym, ymd, yr, condQ, NM };
  })();
  window.ZP_facts = (id) => { try { return ZFX.of(byId[id]); } catch (e) { return null; } };   // 점검(QA): 문장 대조
