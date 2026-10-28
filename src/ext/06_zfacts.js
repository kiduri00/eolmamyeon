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
    // 사이클 4: 가로·소규모·모아 사업장의 다음 구간에 자기 통계(uses small)가 없는가 — 단계 날짜(premium)가 오기 전후로 같은 판정(입주 범위 숨김에 씀)
    function smallNostat(r) {
      if (!r || r.src === "moa" || r.dn || r.s >= 9 || !smallK(r)) return false;
      let k = NEXT[r.s]; if (r.s === 5 || r.s === 6) k = "사업시행>착공"; if (!k) return false;
      const ts = (((D.etaMeta || {}).transitions || {}).small || {})[k];
      return !(ts && ts.uses === "small" && statOf(r, k));
    }
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
      if (pr.unsure) o.note = `준공되는 경우만 보면 ${pr.unsure}이지만, 준공하지 못하는 경우까지 넣은 10년 안 준공 가능성이 ${probTxt(p10)}라 입주 범위를 싣지 않아요`;
      // 사이클 4: 칸 글자(txt)가 파생된 범위 — 범위를 싣는 곳만(숨김·정체·자료 부족이면 null)
      if (show && !pr.unsure) { const g = rngOf(r); if (g) o.rng = { txt: g.txt, eLo: g.eLo, eHi: g.eHi, lo: g.lo, hi: g.hi }; }
      if (pr.nostat) o.why = o.why || "가로·소규모 서울 기록 적음";
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
    // ===================== 사이클 4: ZoneFacts v2 — 화면에 나오는 숫자 =====================
    //   같은 양은 객체에서 한 번 만들고, 문자열도 반올림 함수 하나(fmt)로 여기서 만든다. 화면·정적 생성기(calc.json f.num)는 문자열만 꽂는다.
    //   c3까지 남은 불일치(참고 시세 '1년' vs 12개월 0건 · 입주 칸 vs 범위 · 정체인데 이주 칸 · 분담금 반올림/올림 · 면적·전세 반올림)가 모두 '표시 숫자'를 화면마다 따로 만든 데서 났다.
    //   fmt 종류: cash(억 금액 · 화면 올림 규칙 ZF.cash) · won(정확한 만 원 ZF.manT) · m2p(만원 단위 시세 ZF.eok) · area(㎡ 반올림) · n(개수)
    const FMT = {
      cash: (v) => ZF.cash(v), won: (v) => ZF.manT(v), m2p: (m) => ZF.eok(m),
      area: (v) => `${Math.round(v).toLocaleString("ko-KR")}㎡`, n: (v) => Math.round(v).toLocaleString("ko-KR"),
    };
    const fmt = (k, v) => (v == null || !isFinite(v) ? null : FMT[k](v));
    // 받침 있으면 '으로', 없거나 ㄹ이면 '로' — 괄호·숫자 뒤 조사(가운데 값(26.05–26.10)으로)
    const ro = (w) => { const s = String(w || "").replace(/[)\]\s]+$/, ""), c = s.charCodeAt(s.length - 1); if (c >= 0xac00 && c <= 0xd7a3) { const j = (c - 0xac00) % 28; return j === 0 || j === 8 ? "로" : "으로"; } return /[013678]$/.test(s) ? "으로" : "로"; };
    const ymT = (d) => { const s = String(d || ""); return s.length >= 6 ? `${s.slice(2, 4)}.${s.slice(4, 6)}` : ""; };
    // ---------- 참고 시세(시트 첫 칸 '참고 시세' 줄 = 거래 탭 맨 위 큰 숫자) — 표본 기간·건수를 숫자와 함께 ----------
    //   tx.hd(대표 거래: 1년/2년/최근 거래 창 w) 있으면 그것 · 없으면 쓴 값의 실제 기간(tools/tx.py: am 12개월 · im iw개월 · med nwin개월 · pp 2023.11 뒤 전체)
    function refOf(r) {
      const t = r.tx || {}, h = t.hd;
      // 거래 탭 맨 위 큰 숫자가 매수가 표본(ZF.headline 'u'·'p')이면 참고 시세도 그것 — 같은 화면에 두 기준이 '참고 시세'·'맨 위 숫자'로 갈리지 않게
      let H = null; try { H = ZF.headline(r, h && h.u ? h : null); } catch (e) {}
      if (H && H.kind === "u") return { k: "u", lab: "빌라·단독 대지 3.3㎡당", v: H.v, n: H.n, win: "", basis: H.basis, vt: fmt("m2p", H.v), txt: `참고 시세 · 빌라·단독 대지 3.3㎡당(${H.basis}) ${fmt("m2p", H.v)}` };
      if (H && H.kind === "p") return { k: "p", lab: H.label, v: H.v, n: H.n, win: "", basis: H.basis, vt: fmt("won", H.v / 1e4), txt: `참고 시세 · ${H.label}(${H.basis}) ${fmt("won", H.v / 1e4)}` };
      if (h && h.u) {
        const BN = { i: "입주권", a: "아파트", v: "빌라·단독 대지" }[h.b] || "대지", win = h.w === 0 ? "최근 거래" : h.w === 24 ? "2년" : "1년";
        const basis = h.n === 1 ? `${win} 구역 안 거래 1건` : `${win} 대표 거래 ${h.n}건 가운데 값`;
        return { k: "hd", lab: `${BN} 3.3㎡당`, v: h.u, n: h.n, win, basis, to: h.to || "", vt: fmt("m2p", h.u), txt: `참고 시세 · ${BN} 3.3㎡당 ${basis} ${fmt("m2p", h.u)}` };
      }
      const A = !!t.am && (/재건축/.test(r.k || "") || (!t.pp && !t.med));
      const L = r.s >= 8 && t.im ? ["입주권 매매", t.im, `${t.iw === 24 ? "2년" : "1년"} 가운데 값`, t.in]
        : A ? ["아파트 매매", t.am, "1년 가운데 값", t.an]
        : t.med ? ["빌라 매매", t.med, `${t.nwin || 18}개월 가운데 값`, t.no]
        : t.pp ? ["대지 3.3㎡당", t.pp, "2023.11 뒤 거래 전체 가운데 값", t.n]
        : t.am ? ["아파트 매매", t.am, "1년 가운데 값", t.an] : null;
      if (!L) return null;
      return { k: "tx", lab: L[0], v: L[1], n: L[3] || null, win: L[2], basis: `${L[2]}${L[3] ? ` · ${L[3]}건` : ""}`, vt: fmt("m2p", L[1]), txt: `참고 시세 · ${L[0]} ${L[2]}${L[3] ? `(${L[3]}건)` : ""} ${fmt("m2p", L[1])}` };
    }
    // ---------- 입주 시기 글자(범위에서 파생) — '언제 입주' 칸 = 준공 범위(eLo~eHi)를 '지금부터 몇 년'으로 반올림한 것 ----------
    //   c3까지는 가운데 값으로 '10~15년 뒤' 같은 칸을 골라 범위(2036~2043 · 10~17년)와 어긋났다. 이제 칸 글자 = 범위 양 끝(반올림 1년)
    const YN = () => { try { return ETA_NOW.getFullYear() + (ETA_NOW.getMonth() + (ETA_NOW.getDate() - 0.5) / 30.44) / 12; } catch (e) { return new Date().getFullYear(); } };
    const yOf = (ym2) => { const m = /^(\d{4})-(\d{2})/.exec(String(ym2 || "")); return m ? +m[1] + (+m[2] - 0.5) / 12 : null; };
    function spanTxt(lo, hi) {
      if (lo == null || hi == null) return null;
      const a = Math.max(1, Math.round(lo)), b = Math.max(a, Math.round(hi));
      if (a > 15) return "15년 넘게";
      return a === b ? `약 ${a}년 뒤` : `${a}~${b}년 뒤`;
    }
    // 범위 글자(정적 /z '준공 예상 범위'·시트 '빠르면 … 늦으면 …'과 같은 끝값)와 그 지금부터의 햇수
    function rngOf(r) {
      const e = r.eta; if (!e || !e.eLo || !e.eHi) return null;
      const n = YN(), lo = yOf(e.eLo) - n, hi = yOf(e.eHi) - n;
      return { eLo: e.eLo, eHi: e.eHi, lo, hi, txt: `${e.eLo.replace("-", ".")}~${e.eHi.replace("-", ".")}` };
    }
    // ---------- 돈 탭 시간표 칸(지금 · 이주 · 입주) ----------
    //   입주 칸 = eta.txt · 이주 칸 = 같은 범위에서 공사 기간(착공→준공 가운데 값)을 뺀 것 · 입주를 내지 않는 곳(정체·자료 부족·범위 숨김·가로·소규모 기록 부족)은 이주 칸도 '시점 미정'
    function tlOf(r, eta) {
      let pr = {}; try { pr = projection(r); } catch (e) {}
      const omit = !hasEta(pr) || !!pr.unsure;
      if (omit) return { omit: true, move: "시점 미정", in: eta.txt, calc: !!(pr.stall || pr.nodata || pr.nostat) };
      const g = rngOf(r); let cj = 3; try { cj = CJ(); } catch (e) {}
      const near = /^\d{4}(~\d\d)?년$/.test(eta.txt);
      let move = null;
      if (g && !near) move = spanTxt(Math.max(0.25, g.lo - cj), Math.max(0.25, g.hi - cj));
      else if (g) { const a = Math.max(ETA_NOW.getFullYear(), Math.floor(g.lo - cj + YN())); move = `${a}년 무렵`; }
      return { omit: false, move: move || "시점 미정", in: eta.txt, calc: false };
    }
    // ---------- 그 밖의 표시 숫자 ----------
    const UL = { "분양 세대수(정보몽땅)": ["분양 세대", "정보몽땅 분양 세대수"], "계획 세대수(신통 추진현황)": ["계획 세대", "신통 추진현황 계획 세대수"], "총 세대수(정보몽땅 분양+임대)": ["총 세대", "정보몽땅 분양+임대"], "세대수 확인 중": ["세대수", "원천 확인 중"] };
    function numOf(r, eta) {
      const t = r.tx || {}, sm = r.sm || {};
      let x = null; try { x = investC(r); } catch (e) {}
      let nt = false; try { nt = noTicket(r); } catch (e) {}
      const o = { ref: refOf(r), tl: r.src === "moa" ? null : tlOf(r, eta) };
      // 분담금(기본 가정 · 비례율 100%) — 요약 칸·비례율 표 100% 줄·'이미 가진 집이면'이 같은 fmt('cash')
      if (!nt && x && x.ok && isFinite(x.contrib)) o.contrib = { v: x.contrib, refund: x.contrib < 0, txt: fmt("cash", Math.abs(x.contrib)), exact: ZF.exact(Math.abs(x.contrib)) };
      // 매수가(계산 매수가) — 정확한 만 원 하나(카드 '3.2억' vs /z '3억 1,050만'이 갈리던 것)
      if (!nt && x && x.price != null && isFinite(x.price)) o.price = { v: x.price, txt: fmt("won", x.price) };
      if (sm.area) o.area = { v: Math.round(sm.area), txt: fmt("area", sm.area) };
      if (t.jm) o.jeonse = { v: t.jm, n: t.jn || null, txt: fmt("m2p", t.jm) };
      // 3.3㎡당(1km 표·비교 표): 머리 큰 숫자가 3.3㎡당이면 그 값(같은 표본), 아니면 구역 대표 거래 — 기준을 글로
      try { const u = ZF.u33(r), h = t.hd; if (u && u.v) { const win = h && h.w === 0 ? "최근 거래" : h && h.w === 24 ? "2년" : "1년"; o.u33 = { v: u.v, txt: fmt("m2p", u.v), same: !u.zone && !!(ZF.headline(r, h) || {}).kind && (ZF.headline(r, h) || {}).kind === "u", basis: (ZF.headline(r, h) || {}).kind === "u" ? "거래 탭 맨 위와 같은 값(매수가 표본의 대지 3.3㎡당)" : `구역 ${win} 대표 거래 ${u.n || ""}건 가운데 값(거래 탭 '다른 기준 보기'의 대표 거래 값)`.replace(" 건", "건") }; } } catch (e) {}
      if (sm.units || sm.uTbd) { const L = UL[sm.uL] || ["계획 세대", ""]; o.units = { v: sm.units || null, lab: L[0], src: L[1], txt: sm.uTbd ? "확인 중" : `${fmt("n", sm.units)}세대` }; }
      return o;
    }
    // ===================== 사이클 4: 투기과열지구 기간(구별 · tools/tgj.json → D.policy.tgj) =====================
    //   매수 시점 규칙(도시정비법 제39조② · 소규모주택정비법 제24조②)은 '산 때 그 구가 투기과열지구였는지'로 갈린다고 본다(추정·확인 필요)
    const TG = () => (D.policy && D.policy.tgj) || null;
    const dT = (s) => String(s || "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, (m, y, a, b) => `${y}.${+a}.${+b}`);
    //   2023년 21개 구 해제 효력일은 공식 출처로 확인 못 해 날짜를 쓰지 않는다(seg.toTxt '2023년 초(해제일 확인 필요)')
    const FOUR = () => (TG() && TG().four) || ["강남구", "서초구", "송파구", "용산구"];
    const isFour = (gu) => FOUR().includes(gu);
    // 구 하나의 지정 기간 [{from, to, toTxt}] (확인한 구간만)
    function tgjSegs(gu) {
      const T = TG(); if (!T) return [];
      return T.seg.filter((s) => s.gu === "*" || (s.gu === "rest" && !isFour(gu)) || (Array.isArray(s.gu) && s.gu.includes(gu))).map((s) => ({ from: s.from, to: s.to || null, toTxt: s.toTxt || null })).sort((a, b) => (a.from < b.from ? -1 : 1));
    }
    const segTxt = (s) => `${dT(s.from)}${s.to ? `~${dT(s.to)}` : s.toTxt ? `~${s.toTxt}` : "부터"}`;
    // 기간 글: '강동구 투기과열지구 지정 기간 2017.8.3~2023년 초(해제일 확인 필요) · 2025.10.16부터' · 4개 구 '2017.8.3부터 계속 지정'
    function tgjTxt(gu) {
      const S2 = tgjSegs(gu); if (!S2.length) return "";
      return S2.length === 1 && !S2[0].to && !S2[0].toTxt ? `${gu} 투기과열지구 ${dT(S2[0].from)}부터 계속 지정` : `${gu} 투기과열지구 지정 기간 ${S2.map(segTxt).join(" · ")}`;
    }
    // 구역 하나의 매수 시점 판정: 제한이 시작되는 인가(재개발 관리처분인가 · 재건축·가로·소규모 조합설립인가) 뒤 지정이 풀려 있던 기간이 있었는가
    function buyOf(r) {
      if (!r || r.src === "moa" || r.dn || r.s >= 9) return null;
      const g = /가로|소규모|모아/.test(r.k || "") ? "small" : r.k === "재건축" ? "rebuild" : /재개발/.test(r.k || "") ? "redev" : null;
      if (!g) return null;
      const dt = r.dt || {}, lab = g === "redev" ? "관리처분인가" : "조합설립인가", d0 = String((g === "redev" ? dt["관리처분"] : dt["조합설립"] || dt["시행자지정"]) || "").slice(0, 10);
      const T = TG(), gu = r.g || "", four = isFour(gu), has = /^\d{4}-\d{2}-\d{2}$/.test(d0);
      const pre = has && d0 < "2017-08-03" ? ` · ${dT(d0)}~2017.8.2 매수는 그때 지정 여부를 확인 필요` : "";
      const tg = tgjTxt(gu) + (T ? " · 2017.8.3 전 이력은 확인 필요" : "");
      // 해제 기간(2023년 초 해제 ~ 2025.10.15)이 인가 뒤에 있었는가: 4개 구는 없음 · 2025.10.16 뒤 인가면 없음
      const off = !four && !(has && d0 >= "2025-10-16");
      const txt = four ? `${lab}${has ? `(${dT(d0)})` : ""} 뒤 ${gu}는 계속 투기과열지구라 그 뒤에 산 집은 이 제한을 받아요${pre}`
        : off ? `${lab}${has ? `(${dT(d0)})` : ""} 뒤에 샀어도 ${gu}가 투기과열지구가 아니던 기간(2023년 초 해제 ~ 2025.10.15)에 산 집은 제한이 달랐을 수 있어요 · 확인 필요${pre}`
        : `${lab}(${dT(d0)}) 뒤 ${gu}는 계속 투기과열지구라 그 뒤에 산 집은 이 제한을 받아요`;
      return { g, lab, d0: has ? d0 : null, gu, off, tg, txt, src: T ? [...new Set(T.seg.flatMap((s) => s.src.map((x) => x.u)))] : [] };
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
      const eta = etaOf(r);
      let num = null; try { num = numOf(r, eta); } catch (e) { num = { err: String(e && e.message) }; }
      let buy = null; try { buy = buyOf(r); } catch (e) {}
      return { id: r.id, s: r.s, stage, kind: { g: g0, t: SHAPE[shapeOf(r)] || "" }, eta, stall, next: nextOf(r), hold: holdOf(r, gap), jr, win, mode: gap ? "gap" : "cash", num, buy, notice: r.notice || null };
    }
    function of(r) {
      if (!r) return null;
      const k = condKey() + "|" + P.fund + "|" + P.jr + "|" + P.est;
      if (k !== KEY) { CACHE = new Map(); KEY = k; }
      const ck = r.id + "|" + (r._prem ? 1 : 0) + "|" + JSON.stringify(OV[r.id] || 0);   // 사이클 4: 단계 날짜(premium)가 오면 다시 만든다(매수 시점·다음 단계가 dt를 읽음)
      let f = CACHE.get(ck);
      if (!f) { f = build(r); CACHE.set(ck, f); }
      return f;
    }
    const clear = () => { CACHE = new Map(); };
    // 전세가율 짧은 꼴(시트 첫 칸 · /z 첫 칸 같은 글): '3.4% · 구역 실측' · '56.6% · 서울 평균'
    const JRS = { user: "직접 설정", zone: "구역 실측", zoneLow: "구역 실측", gu: "구 평균", seoul: "서울 평균" };
    const jrShort = (r) => { const j = jrInfo(r); return `${String(Math.round(j.v * 10) / 10)}% · ${JRS[j.src] || ""}`; };
    return { of, clear, jrInfo, jrShort, JRS, nextOf, smallNostat, ym, ymd, yr, condQ, NM, refOf, spanTxt, rngOf, tgjSegs, tgjTxt, buyOf, fmt, ro };
  })();
  window.ZP_facts = (id) => { try { return ZFX.of(byId[id]); } catch (e) { return null; } };   // 점검(QA): 문장 대조
