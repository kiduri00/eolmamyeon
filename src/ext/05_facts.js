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
    // num → 단위 없는 숫자('0.97' · '1.2' · '0'), cash → '0.97억' · '0원'
    const num = (v) => { if (v == null || !isFinite(v)) return "–"; const a = Math.abs(v), sg = v < 0 ? "-" : ""; if (a < 0.005) return "0"; if (a < 0.995) return sg + (Math.round(a * 100) / 100).toFixed(2).replace(/0$/, ""); return sg + (Math.round(a * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 }); };
    const cash = (v) => { const t = num(v); return t === "–" ? t : t === "0" ? "0원" : t + "억"; };
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
      const has = en.n > 0 && en.med > 0 && x && x.price != null && isFinite(x.price) && x.priceSrc !== "user" && x.priceSrc !== "est" && !est(r);
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
    return { eok, manT, num, cash, smpTxt, sample, headline, u33, cashToMoveIn, evText, LBL };
  })();
  // 정적 HTML(shell.html)의 방식 버튼 글자도 LBL에서: data-lbl="gap|loan|cashToMoveIn"
  { const lbl = () => document.querySelectorAll("[data-lbl]").forEach((e) => { const t = LBL[e.dataset.lbl]; if (t && e.textContent !== t) e.textContent = t; }); document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", lbl) : lbl(); }
