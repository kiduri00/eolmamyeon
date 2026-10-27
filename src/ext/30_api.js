  // 리포트·구역 페이지 생성기(tools/report.py)가 같은 계산 엔진을 쓰도록 여는 읽기 전용 함수
  window.__emrCalc = (ids) => {
    const keep = { fund: P.fund, homes: P.homes, unit: P.unit, basis: P.basis, first: P.first };
    Object.assign(P, { fund: "cash", homes: 0, unit: 84, basis: "total", first: 0 });
    const out = {};
    try {
      for (const id of ids) {
        const r = byId[id];
        if (!r) continue;
        let x = {};
        try { x = invest(r); } catch (e) {}
        const w = buyWindow(r);
        let g = null;
        let gE = false, cE = false;
        // 사이클 3: 판단은 ZoneFacts 한 객체(f · 정적 /z·api·og·zhand가 이것만 읽는다) — 첫 화면 기본(전세 끼고)과 대출 끼고 보류 이유(hc)
        let f = null, hc = null;
        try { P.fund = "gap"; g = gapOf(r); gE = gapOk(r, 1e9); f = ZFX.of(r); } catch (e) {} finally { P.fund = "cash"; }
        try { hc = ZFX.of(r).hold; } catch (e) {}
        try { cE = !estHide(r) && !r.dn && r.s < 9 && !r.cx && r.src !== "moa" && !($("pTrade").checked && restricted(r)) && !rewinBlocked(r); } catch (e) {}
        out[id] = { gapOk: gE, cashOk: cE, gapNow: g && !g.block && !g.na ? g.now : null, gapTotal: g && !g.block && !g.na ? g.total ?? null : null, gapBlock: g ? (g.block ? String(g.block === true ? "block" : g.block) : g.na ? "na" : null) : null, jeonse: g && g.D != null ? g.D : null,
          price: x.price ?? null, priceSrc: x.priceSrc ?? null, need: x.ok ? x.needTotal : null, now: x.needBuy ?? null, p10: f && f.eta ? f.eta.p10 : null, p10raw: r.eta?.p10 ?? null, f, hc, eMid: r.eta?.eMid ?? null, win: w.cls, winT: w.t, st: r.st ? { n: r.st.n, d: r.st.d } : null, ln: r.ln || [], owners: r.sm?.owners || r.sm?.members || null, stage: stageName(r) };
      }
    } finally { Object.assign(P, keep); }
    return out;
  };
