  /* ===================== 구역 사실 한 곳(ZF) · 용어(LBL) =====================
     같은 구역의 같은 숫자가 화면마다 다르게 뜨지 않게, 표본 한 문장·머리 큰 숫자·입주까지 현금·숫자 꼴·정식 용어를 여기서만 만든다.
     읽는 곳: 구역 리포트 머리(64_overview) · 1km 비교표(20_zone) · 목록·'왜 이 금액?'(60_simple) · 계산기·도구 화면(app.js) · 단계 소식(50_board).
     정적 쪽 같은 규칙: tools/zsample.py (LBL · smpTxt · headline) — 둘을 같이 고친다.
     3.3㎡당 표본 값(entry.u·nl)은 tools/enrich.py가 매수가 표본에서 한 번 계산해 둔 것(화면이 거래 목록으로 다시 찾지 않는다). */
  const LBL = { cashToMoveIn: "입주까지 현금", gap: "전세 끼고", loan: "대출 끼고" };
  const ZF = (() => {
    // 만원 → '3,905만' · '1.5억'(큰 숫자·표) / 억 → '1억 5,450만'(계산 매수가)
    const eok = (m) => (m == null || !isFinite(m) ? "–" : m >= 10000 ? (Math.round(m / 1000) / 10).toLocaleString("ko-KR") + "억" : Math.round(m).toLocaleString("ko-KR") + "만");
    const manT = (v) => { const m = Math.round(v * 1e4), a = Math.floor(m / 1e4), b = m % 1e4; return a ? `${a}억${b ? ` ${b.toLocaleString("ko-KR")}만` : ""}` : `${b.toLocaleString("ko-KR")}만`; };
    // 억 단위 금액 한 꼴(지금 필요한 돈·입주까지 현금·핀·지도 이름표·리포트 시간표 모두): 1억 아래는 소수 둘째 자리(0.97), 1억부터 첫째 자리(1.2 · 1)
    // num → 단위 없는 숫자('0.97' · '1.2' · '0'), cash → '9,700만' · '1.2억' · '0원'
    // 올림(아주 작은 부동소수 오차는 무시): 화면 금액이 실제보다 작게 보이지 않게 — '1억'이라 써 놓고 1.001억이라 1억으로 못 사는 곳이 되던 것
    const up = (x, k) => Math.ceil(x * k - 1e-6) / k;
    const num = (v) => { if (v == null || !isFinite(v)) return "–"; const a = Math.abs(v), sg = v < 0 ? "-" : ""; if (a < 0.005) return "0"; if (up(a, 100) < 1) return sg + up(a, 100).toFixed(2).replace(/0$/, ""); return sg + up(a, 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 }); };
    // cash → 단위까지 붙인 꼴: 1억 아래는 만 원(100만 단위 · '4,100만'), 1억부터 '1.2억', 0은 '0원' — 화면의 모든 'X억' 금액이 이것 하나(tools/zsample.py cash와 같은 규칙)
    const cash = (v) => { const t = num(v); if (t === "–") return t; if (t === "0") return "0원"; const a = Math.abs(v); if (Math.ceil(a * 100 - 1e-6) < 100) return (v < 0 ? "-" : "") + (Math.ceil(a * 100 - 1e-6) * 100).toLocaleString("ko-KR") + "만"; return t + "억"; };
    // 28차: 모자라는 돈('N 부족' · 'N 더 필요해요')은 표시용 올림(0.1억·100만)이 아니라 정확한 만 원으로 — 한 곳에서만 만든다(0원 부족이 나오지 않게 최소 1만)
    const short = (d) => { let m = Math.ceil((d || 0) * 1e4 - 1e-6); if (!(m >= 1)) m = 1; const a = Math.floor(m / 1e4), b = m % 1e4; return a ? `${a.toLocaleString("ko-KR")}억${b ? ` ${b.toLocaleString("ko-KR")}만` : ""}` : `${b.toLocaleString("ko-KR")}만`; };
    // 정확한 만 원 꼴(왜 이 금액? 합계 등): 3억 7,059만
    const exact = (v) => { const m = Math.round((v || 0) * 1e4); if (m <= 0) return "0원"; const a = Math.floor(m / 1e4), b = m % 1e4; return `${a ? `${a.toLocaleString("ko-KR")}억` : ""}${a && b ? " " : ""}${b ? `${b.toLocaleString("ko-KR")}만` : ""}`; };
    const entry = (r) => (r && r.mk && r.mk.entry) || null;
    const est = (r) => { try { return isEst(r); } catch (e) { return false; } };
    const calc = (r) => { try { return investC(r); } catch (e) { return null; } };
    // 매수가 표본 한 문장 — /z/·API(zsample.smpTxt)와 같은 규칙 · 1건이면 '가운데 값'이라 하지 않는다
    function smpTxt(r, x) {
      const en = entry(r);
      if (est(r) || (x && x.priceSrc === "est")) return `같은 구(${r.g}) 빌라 시세 가운데 값으로 추정`;
      if (!en || !en.n) return "";
      const where = en.src === "complex" ? (en.fill === "zoneapt" ? "구역 안 아파트" : en.name ? en.name : "단지") : en.fill === "dong" ? "같은 동 빌라" : en.radius ? `주변 ${en.radius}m 빌라` : en.m === "jibun" ? "같은 본번 빌라" : "구역 안 빌라";
      const span = en.f ? `(${en.f}${en.t && en.t !== en.f ? "–" + en.t : ""})` : en.last ? `(최근 ${en.last.slice(0, 5)})` : "";
      return en.n === 1 ? `${where} 거래 1건${span}` : `${where} ${en.n}건 가운데 값${span}`;
    }
    // 매수가 표본: 몇 건·기간·마지막 거래·같은 표본의 대지 3.3㎡당
    function sample(r) {
      const en = entry(r);
      if (!en || !en.n) return null;
      return { n: en.n, from: en.f || "", to: en.t || "", last: en.last || "", med: en.med, u: en.u || null, nl: en.nl || en.n, near: en.src === "villa" && !!(en.radius || en.fill === "dong"), text: smpTxt(r) };
    }
    /* 머리 큰 숫자 하나(zsample.headline과 같은 규칙) — 계산 매수가가 있으면 그 표본으로만 말한다.
       'u' 매수가 표본의 대지 3.3㎡당 · 'p' 매수가 자체(3.3㎡당을 같은 표본으로 못 낼 때) · 'hd' 대표 거래 기준(표본 없음·추정·직접 입력·아파트 기준) */
    function headline(r, h) {
      const en = entry(r) || {}, x = calc(r);
      let nt = false; try { nt = noTicket(r); } catch (e) {}   // 지금 사면 입주권이 안 나오는 구역은 매수가를 계산하지 않는다(리포트 '입주 현금 계산 · 안 함') → 대표 거래 기준
      const has = !nt && en.n > 0 && en.med > 0 && x && x.price != null && isFinite(x.price) && x.priceSrc !== "user" && x.priceSrc !== "est" && !est(r);
      if (has && h && h.b === "v" && en.src === "villa" && en.u) {
        const nl = en.nl || en.n;
        return { kind: "u", v: en.u, n: en.n, to: en.t ? "20" + en.t.replace(".", "") : "", label: "빌라·단독 대지 3.3㎡당", basis: `${smpTxt(r, x)}${nl < en.n ? ` · 대지 면적 있는 ${nl}건` : ""} · 매수가와 같은 표본` };
      }
      if (has && (!h || h.b === "v")) {
        const near = en.src === "villa" && !!(en.radius || en.fill === "dong");
        return { kind: "p", v: en.med, n: en.n, near, to: en.last ? "20" + en.last.slice(0, 2) + en.last.slice(3, 5) : "", label: near ? "주변 빌라 매매가 · 계산 매수가" : "매매가 · 계산 매수가", basis: `${smpTxt(r, x)}${en.area_med ? ` · 전용 ${en.area_med}㎡ 안팎` : ""}` };
      }
      return h && h.u ? { kind: "hd", v: h.u, n: h.n, to: h.to } : null;
    }
    // 1km 비교표 같은 곳의 '3.3㎡당' 칸: 머리 큰 숫자가 3.3㎡당이면 그 값, 아니면 구역 대표 거래 값
    const u33 = (r) => { const h = r.tx && r.tx.hd; if (!h || !h.u) return null; const H = headline(r, h); return { v: H && H.kind === "u" ? H.v : h.u, b: h.b, st: !!h.st, zone: !!(H && H.kind === "p"), n: h.n }; };
    // 입주까지 현금(잔금대출 뺀 값): 전세 끼고면 갭 총액, 아니면 계산기 총액 — 목록·왜 시트·리포트가 같은 함수
    function cashToMoveIn(r, gap) {
      try {
        if (gap) { const g = gapOf(r); return g && !g.na && !g.block && g.total != null ? g.total : null; }
        const x = investC(r); return x && x.ok && x.needTotal != null ? x.needTotal : null;
      } catch (e) { return null; }
    }
    // 정보몽땅 원문 '[(변경)인가신청]', '동의율 : 89.85' → '변경인가 신청', '동의율 89.85%'
    // '(변경)'은 양식 이름이라, 그 단계 날짜가 이 기록보다 앞서 있을 때만 '변경'으로 읽는다
    const EVK = { 조합설립인가: "조합설립", 사업시행인가: "사업시행", 관리처분인가: "관리처분", 정비구역지정: "구역지정", 조합설립추진위원회승인: "추진위", 사업시행자지정: "시행자지정", 준공인가: "준공" };
    function evText(r, d, sec, t) {
      const m = String(t || "").match(/^\[([^\]]*)\]\s*(.*)$/), k = EVK[sec], sd = k && r && r.dt && r.dt[k];
      let a = m ? m[1] : "", b = m ? m[2] : String(t || "");
      const chg = /\(변경\)/.test(a) && !!sd && sd < d;
      a = a.replace(/\(변경\)\s*/, chg ? "변경" : "").replace(/(인가|승인)(신청|고시)/, "$1 $2").replace(/계약\(변경\)/, "계약 변경").replace(/\s*:\s*/, " ");
      b = b.replace(/동의율\s*:\s*(\d+(?:\.\d+)?)\s*%?/, "동의율 $1%").replace(/동의율\s*:\s*(해당없음|[.\-]?)\s*$/, "").replace(/\(최초인가시\)/, " (최초 인가 때)")
        .replace(/(\S*?)일자\s*:\s*/, (x, p) => (p.endsWith("일") ? p : p + "일") + " ").replace(/선정업체명\s*:\s*/, "").replace(/(\d{4})-(\d{2})-(\d{2})/g, "$1.$2.$3").replace(/\b(20\d\d)(\d\d)(\d\d)\b/g, "$1.$2.$3").replace(/\s*:\s*/g, " ").trim();
      if (b && a && b.replace(/\s/g, "") === a.replace(/\s/g, "")) b = "";
      return { txt: b ? (a ? `${a} · ${b}` : b) : a, chg };
    }
    // 역에서 걸어서 N분 안 구역 — 검색 '○○역 걸어서 15분 안'과 지도 역 고리·안내가 같은 함수·같은 문구
    // 분속 67m, 길 돌아가는 몫 1.3배 → 직선 515m(10분)·773m(15분). 그 역이 가장 가까운 역인 구역은 구역 자료의 역 거리(r.st.d), 아니면 구역 중심까지 직선
    const W10 = 515, W15 = 773, stN = (s) => String(s || "").replace(/역$/, "");
    function walkD(r, ll, name) {
      if (name && r.st && r.st.n && stN(r.st.n) === stN(name) && isFinite(r.st.d)) return r.st.d;
      if (!r.ll || !ll) return Infinity;
      return Math.hypot((r.ll[1] - ll[0]) * 88200, (r.ll[0] - ll[1]) * 111000);
    }
    // ll = [경도, 위도] · 결과 [[구역, 거리m], …] 가까운 순(진행 중·모아타운 관리지역 제외)
    function walkNear(ll, name, max = W15) {
      let done = () => false; try { done = isDone; } catch (e) {}
      // 같은 곳이 두 자료에 따로 실린 것(이름·지번이 같음: 행당동 300-1)은 한 곳으로 센다 — 검색 목록과 같은 기준
      const seen = new Set(), key = (r) => { let n = r.n; try { n = shortName(r.n); } catch (e) {} return `${n}|${String(r.j || "").replace(/\s+/g, "")}`; };
      return R.filter((r) => !done(r) && r.src !== "moa").map((r) => [r, walkD(r, ll, name)]).filter((x) => x[1] <= max).sort((a, b) => a[1] - b[1])
        .filter((x) => { const k = key(x[0]); if (seen.has(k)) return false; seen.add(k); return true; });
    }
    const walkMin = (d) => Math.max(1, Math.round((d * 1.3) / 67));
    const walkLbl = (name, n) => `${name ? stN(name) + "역 " : ""}걸어서 15분 안 · ${Number(n).toLocaleString("ko-KR")}곳`;
    // 경매 물건 용도(법원경매정보 원문 → 읽기 쉬운 말) · 지분 몫('333.4분의32.79' → 약 9.8%) — /z(zsample.auc_use·auc_jb)와 같은 규칙
    const AUSE = { 단독주택다가구: "단독·다가구", "연립주택,다세대,빌라": "연립·다세대", "상가,오피스텔,근린시설": "상가·근린시설", "대지,임야,전답": "대지·임야", 다가구주택: "다가구" };
    const aucUse = (u) => { const t = String(u || "").trim(); return AUSE[t.replace(/\s+/g, "")] || t.replace(/\s*,\s*/g, "·"); };
    // 여러 물건 대표 용도: '기타'보다 구체적인 용도를 먼저
    const aucUses = (us) => { const xs = [...new Set(us.map(aucUse).filter(Boolean))], top = xs.filter((x) => x !== "기타"); const a = top[0] || xs[0] || "부동산"; return xs.length > 1 ? `${a} 외` : a; };
    const aucJb = (jb) => { const m = String(jb || "").match(/^([\d.]+)분의([\d.]+)$/); if (!m || !(+m[1] > 0)) return null; const p = (+m[2] / +m[1]) * 100, t = p >= 10 ? Math.round(p) : Math.round(p * 10) / 10; return { pct: t, txt: `지분 약 ${t}%`, frac: `${m[1]}분의 ${m[2]}` }; };
    // 경사(rec.sl: a 평균 경사(°) · d 고저차(m) · p 10° 넘는 땅 비율(%) · k 평지·완만·경사·급경사 — tools/slope.py·enrich.py) → '경사 완만(5%)'
    // %는 평균 경사각을 기울기(높이/거리 ×100)로 바꾼 값: tan(3.1°) ≈ 5%
    function slope(r) {
      const s = r && r.sl; if (!s || !s.k) return null;
      const pct = s.a != null && isFinite(s.a) ? Math.round(Math.tan((+s.a * Math.PI) / 180) * 100) : null;
      const name = s.k === "평지" ? "평지" : s.k === "급경사" ? "급경사" : s.k === "경사" ? "경사 있음" : "경사 " + s.k;
      const tip = [pct != null ? `평균 기울기 ${pct}%(100m 가면 ${pct}m 오르내림)` : "", s.d != null && isFinite(s.d) ? `높낮이 차 ${Math.round(+s.d)}m` : "", s.p ? `가파른 땅(10° 넘음) ${Math.round(+s.p)}%` : ""].filter(Boolean).join(" · ");
      return { pct, k: s.k, txt: pct != null ? `${name}(${pct}%)` : name, tip };
    }
    // 매수가는 있는데 입주까지를 계산 못 한 까닭(무엇이 없는지) — 머리 줄·입주 현금 탭·관심 구역 카드가 같은 말
    function noCalcTxt(r, x) {
      if (!x) x = calc(r);
      if (!x || x.price == null) return "";
      const mk = (r && r.mk) || {}; let u = 84; try { u = P.unit === 59 ? 59 : 84; } catch (e) {}
      const ref = u === 59 ? mk.new59 || mk.new84 : mk.new84;
      const miss = x.nvThin ? `주변 신축 아파트 거래가 ${ref && ref.n ? ref.n + "건뿐" : "적어"}이라 입주 때 시세를 못 잡았어요` : x.nv == null ? "주변 신축 아파트 시세 자료가 없어 입주 때 시세를 못 잡았어요" : "";
      if (r && r.src === "moa") return "모아타운 관리지역은 사업구역마다 분담금·입주 시점이 달라 입주까지는 안의 사업구역에서 계산해요";
      return miss || "입주까지 계산에 필요한 자료가 부족해요";
    }
    // 경매 금액(원) → '3.3억'(첫째 자리 반올림) · 1억 아래 '9,500만' — /z·알림함(tools/zsample.auc_amt)과 같은 규칙
    const aucAmt = (v) => (v == null || !isFinite(v) || v <= 0 ? "–" : v >= 1e8 ? `${(Math.round(v / 1e7) / 10).toLocaleString("ko-KR")}억` : `${Math.round(v / 1e4).toLocaleString("ko-KR")}만`);
    // 26차: 경계가 없을 때 이유는 자료로 — 구역지정 이후(면적·인가가 있는 곳)는 '경계 도면 자료가 아직 없어', 그 전은 '공식 경계가 없는 곳(후보지 등)'
    const bndTxt = (r, what) => { const a = r && r.sm && r.sm.area; return (r && (r.s >= 2 || a)) ? `구역 면적${a ? `(${Math.round(a).toLocaleString("ko-KR")}㎡)` : ""}은 정보몽땅에 등록돼 있지만 경계 도면(서울도시공간포털)을 아직 받지 못해 ${what}` : `아직 공식 경계가 없는 곳(후보지 등)이라 ${what}`; };
    return { EXCL: "추정 신뢰 낮아 목록에서 뺐어요", bndTxt, aucAmt, noCalcTxt, aucUse, aucUses, aucJb, eok, manT, num, cash, short, exact, smpTxt, sample, headline, u33, cashToMoveIn, evText, LBL, W10, W15, walkD, walkNear, walkMin, walkLbl, slope };
  })();
  // 정적 HTML(shell.html)의 방식 버튼 글자도 LBL에서: data-lbl="gap|loan|cashToMoveIn"
  { const lbl = () => document.querySelectorAll("[data-lbl]").forEach((e) => { const t = LBL[e.dataset.lbl]; if (t && e.textContent !== t) e.textContent = t; }); document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", lbl) : lbl(); }
