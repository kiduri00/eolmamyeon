  // ===================== 구역 리포트 보강: 실거래 · 권리산정기준일 · 공급 계획 · 진행 속도 · 인근 비교 · 경공매 · 물건 확인 =====================
  const ZX = (() => {
    const ymd = (d) => (d && d.length >= 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : "");
    const ymd2 = (d) => (d && d.length >= 8 ? `${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : "");
    const eok = (m) => (m == null || !isFinite(m) ? "–" : m >= 10000 ? (Math.round(m / 1000) / 10).toLocaleString("ko-KR") + "억" : Math.round(m).toLocaleString("ko-KR") + "만");
    const dv = (k) => (D.dv && D.dv[k]) || D.asOf;
    let TXD = null, TXP = null;
    const loadTx = () => TXP || (TXP = fetch(`data/tx.json?v=${dv("tx")}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => (TXD = d && typeof d === "object" ? d : {})));
    const PCL = new Map();
    const loadPcl = (id) => PCL.get(id) || (PCL.set(id, fetch(`data/pcl/${id}.json?v=${dv("tx")}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)), PCL.get(id));
    const bandOf = (r) => (r.s >= 9 || r.dn ? "done" : r.s <= 2 ? "early" : r.s <= 4 ? "mid" : "late");

    // ---------- 권리산정기준일 ----------
    function rights(r) {
      const x = r.rdx;
      if (x && x.d) return { d: x.d.replaceAll("-", "."), b: x.b, u: x.u, c: x.c, k: "set" };
      if (typeof r.rd === "string" && r.rd.trim()) return { d: r.rd.trim().replace(/^’/, "20").replace(/\.$/, ""), b: "서울시 모아타운 대상지 권리산정기준일 고시", u: "https://news.seoul.go.kr/citybuild/archives/525003", c: "high", k: "set" };
      const dz = r.dt && r.dt["구역지정"];
      if (dz && r.s >= 2) return { d: dz.replaceAll("-", "."), b: "정비구역 지정 고시일(도시정비법 제77조 원칙) · 별도 고시가 있었다면 그 날짜", u: "https://www.law.go.kr/법령/도시및주거환경정비법/제77조", c: "mid", k: "set" };
      if (r.src === "moa" || /가로|모아/.test(r.k))
        return { k: "moa", b: "모아타운은 대상지 선정 뒤 서울시가 권리산정기준일을 따로 고시해요(2026.10.12부터 구역계 공개일로 앞당김). 가로주택·모아주택 개별 사업은 조합설립인가 전 착공신고·등기 여부로 갈려요.", u: "https://news.seoul.go.kr/citybuild/archives/525003" };
      if ((r.pg || []).some((p) => p.startsWith("신속통합기획")) || r.src === "sintong")
        return { k: "sin", b: "신속통합기획 후보지는 2024년부터 후보지마다 구청장 추천일 등으로 따로 정해 공개하지 않는 경우가 많아요. 구청 도시재생·주택과에 꼭 확인하세요.", u: "https://cleanup.seoul.go.kr/cleanup/bsnssttus/lscrMainIndx.do" };
      if (r.s < 2) return { k: "pre", b: "구역지정 전이라 아직 정해지지 않았어요. 원칙은 정비구역 지정 고시일이고, 그 전에 시장이 따로 고시하면 그 날이에요.", u: "https://www.law.go.kr/법령/도시및주거환경정비법/제77조" };
      return { k: "unk", b: "공개 자료에서 날짜를 찾지 못했어요. 구청 고시·조합 공지로 확인하세요.", u: "https://www.law.go.kr/법령/도시및주거환경정비법/제77조" };
    }
    function rightsHTML(r, compact) {
      const x = rights(r);
      const conf = x.c === "high" ? "고시·보도자료 확인" : x.c === "mid" ? "법 원칙으로 추정" : x.c === "low" ? "추정 · 확인 필요" : "";
      const old = x.k === "set" && x.c !== "high" && x.d < "2010.07.16" ? " 2010.7.15 이전에 기본계획이 세워진 구역은 옛 서울시 조례 부칙(2003.12.30 다세대 전환 기준·2008.7.30 지분 쪼개기 기준 등)이 따로 적용될 수 있어 날짜가 다를 수 있어요." : "";
      if (x.k === "set")
        return `<div class="rdx"><div class="rdx-h"><span class="rdx-l">권리산정기준일</span><b class="mono">${esc(x.d)}</b>${conf ? `<span class="rdx-c ${x.c}">${conf}</span>` : ""}</div>${compact ? "" : `<p>${esc(x.b)} · 이날 뒤에 새로 짓거나 쪼갠 지분(신축 빌라·지분 분할)은 입주권이 안 나오거나 여럿이 하나를 나눠 받을 수 있어요.${old} <a href="${esc(x.u)}" target="_blank" rel="noopener">근거</a></p>`}</div>`;
      return `<div class="rdx none"><div class="rdx-h"><span class="rdx-l">권리산정기준일</span><b>${x.k === "pre" ? "아직 없음" : "구청 확인 필요"}</b></div>${compact ? "" : `<p>${esc(x.b)} <a href="${esc(x.u)}" target="_blank" rel="noopener">근거</a></p>`}</div>`;
    }

    // ---------- 진행 속도 ----------
    const PACE_KEY = { 2: "구역지정>조합설립", 3: "추진위>조합설립", 4: "조합설립>사업시행", 5: "사업시행>관리처분", 6: "관리처분>착공", 8: "착공>준공" };
    const STAGE_DT = { 2: "구역지정", 3: "추진위", 4: "조합설립", 5: "사업시행", 6: "관리처분", 8: "착공" };
    function pace(r) {
      if (r.dn || r.s >= 9 || r.src === "moa") return null;
      const k = PACE_KEY[r.s], dk = STAGE_DT[r.s];
      const st0 = (/가로|소규모/.test(r.k) && D.stats.small[k]) || D.stats.large[k];
      const d = r.dt && (r.dt[dk] || (r.s === 4 && r.dt["시행자지정"]));
      if (!k || !st0 || !d) return null;
      const yrs = (Date.now() - new Date(d).getTime()) / (365.25 * 864e5);
      if (!(yrs >= 0)) return null;
      const lvl = yrs > st0.p75 * 1.5 ? "slow2" : yrs > st0.p75 ? "slow" : yrs < st0.p25 ? "fast" : "norm";
      return { yrs, med: st0.med, p25: st0.p25, p75: st0.p75, lvl, from: d, k };
    }
    function paceHTML(r) {
      const p = pace(r);
      if (!p) return "";
      const T = { fast: "빠른 편", norm: "보통", slow: "늦은 편", slow2: "많이 늦음" };
      const w = Math.min(100, (p.yrs / Math.max(p.p75 * 1.6, p.yrs)) * 100), m = Math.min(100, (p.med / Math.max(p.p75 * 1.6, p.yrs)) * 100);
      return `<div class="pace ${p.lvl}"><div class="pace-h"><b>현재 단계 ${p.yrs < 1 ? Math.round(p.yrs * 12) + "개월" : p.yrs.toFixed(1) + "년"}째</b><span class="pace-t">${T[p.lvl]}</span></div><div class="pace-bar" role="img" aria-label="서울 같은 단계 가운데 값 ${p.med}년 대비 ${p.yrs.toFixed(1)}년"><i style="width:${w.toFixed(1)}%"></i><s style="left:${m.toFixed(1)}%"></s></div><small>${esc(p.k.replace(">", " → "))} 서울 실제 소요 가운데 값 ${p.med}년 (보통 ${p.p25}~${p.p75}년) · ${esc(p.from.replaceAll("-", "."))}부터</small></div>`;
    }

    // ---------- 공급 계획 ----------
    function supplyHTML(r) {
      const sm = r.sm || {};
      const units = sm.units ?? (sm.saleUnits != null && sm.rental != null ? sm.saleUnits + sm.rental : null);
      const own = sm.members || sm.owners;
      if (!units || !own || units < own * 0.6) return "";
      if (sm.rental == null) return `<div class="sect supply"><h3>공급 계획 <small>계획 세대 ${fmt(units)} · 소유자 ${fmt(own)}명</small></h3><p class="note">임대 세대 수 자료가 없어 일반분양 비율을 계산하지 않았어요. 재개발은 보통 계획 세대의 15~20% 안팎이 임대예요. 정비계획 결정 고시문의 '주택 규모별 건설계획'으로 확인하세요.</p></div>`;
      const rent = sm.rental, mem = Math.min(own, units - rent), gen = Math.max(0, units - rent - mem);
      const pc = (v) => Math.round((v / units) * 1000) / 10;
      const genR = gen / units;
      const hint = genR >= 0.3 ? "일반분양이 많아 분담금 부담이 줄어드는 쪽이에요" : genR >= 0.15 ? "서울 정비사업 보통 수준이에요" : "일반분양이 적어 사업비를 조합원이 더 나눠 내야 할 수 있어요(비례율 낮아질 가능성)";
      return `<div class="sect supply"><h3>공급 계획 <small>계획 세대 ${fmt(units)} · ${r.k === "재건축" ? "조합원" : "토지등소유자"} ${fmt(own)}명 기준 추정</small></h3>
        <div class="sp-bar" role="img" aria-label="조합원 ${pc(mem)}%, 일반분양 ${pc(gen)}%, 임대 ${pc(rent)}%"><i class="m" style="width:${pc(mem)}%"></i><i class="g" style="width:${pc(gen)}%"></i><i class="t" style="width:${pc(rent)}%"></i></div>
        <ul class="sp-key"><li><i class="m"></i>조합원 몫 ${fmt(mem)}세대 · ${pc(mem)}%</li><li><i class="g"></i>일반분양 ${fmt(gen)}세대 · ${pc(gen)}%</li><li><i class="t"></i>임대 ${fmt(rent)}세대 · ${pc(rent)}%</li></ul>
        <p class="note">일반분양 ${pc(gen)}%: ${hint}. 조합원 몫은 소유자 1명당 1세대로 단순 계산했고, 실제 분양 신청자 수·상가 조합원에 따라 달라요.</p></div>`;
    }

    // ---------- 인근 구역 비교 ----------
    function hav(a, b) {
      const R0 = 6371000, t = Math.PI / 180, x = Math.sin(((b[0] - a[0]) * t) / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(((b[1] - a[1]) * t) / 2) ** 2;
      return 2 * R0 * Math.asin(Math.sqrt(x));
    }
    function needOf(r) {
      if (r.src === "moa") return null;
      try {
        if (gapMode()) { const g = gapOf(r); return g && !g.block && !g.na ? g.now : null; }
        const x = investC(r);
        return effBasis() === "total" ? (x.ok ? x.needTotal : null) : x.needBuy;
      } catch (e) { return null; }
    }
    function nearbyHTML(r) {
      if (!r.ll) return "";
      const near = R.filter((q) => q !== r && q.ll && !q.dn && q.s < 9 && q.src !== "moa" && hav(r.ll, q.ll) <= 1000)
        .map((q) => [q, hav(r.ll, q.ll)]).sort((a, b) => a[1] - b[1]).slice(0, 6);
      if (!near.length) return "";
      const cols = [[r, 0], ...near];
      const lab = gapMode() ? "전세 끼고 지금" : effBasis() === "total" ? "입주까지 현금" : "지금 매수";
      const rows = [
        ["거리", (q, d) => (d ? `${fmt(d)}m` : "이 구역")],
        ["사업", (q) => esc(SHAPE[shapeOf(q)])],
        ["단계", (q) => esc(stageName(q))],
        ["계획 세대", (q) => (q.sm?.units ? fmt(q.sm.units) : "–")],
        ["대지 3.3㎡당", (q) => (q.tx?.pp ? eok(q.tx.pp) : "–")],
        [lab, (q) => { const n = needOf(q); return n == null ? "–" : `${e2(n)}억`; }, (q) => needOf(q)],
        ["10년 안 준공", (q) => (q.eta?.p10 != null ? prob(q.eta.p10) + "%" : "–"), (q) => (q.eta?.p10 != null ? -q.eta.p10 : null)],
      ];
      const best = rows.map(([, , k]) => { if (!k) return null; const v = cols.map(([q]) => k(q)).filter((x) => x != null); return v.length ? Math.min(...v) : null; });
      return `<div class="sect nearcmp"><h3>1km 안 다른 구역과 비교 <small>${near.length}곳 · 같은 내 조건으로 계산 · 굵은 값이 가장 유리</small></h3><div class="nc-wrap"><table class="nc"><thead><tr><th scope="col"></th>${cols.map(([q], i) => `<th scope="col">${i ? `<button type="button" class="nc-go" data-go="${q.id}">${esc(shortName(q.n))}</button>` : `<b>${esc(shortName(q.n))}</b>`}</th>`).join("")}</tr></thead><tbody>${rows
        .map(([t, f, k], ri) => `<tr><th scope="row">${t}</th>${cols.map(([q, d]) => { const v = k ? k(q) : null; return `<td${v != null && v === best[ri] ? ' class="b"' : ""}>${f(q, d)}</td>`; }).join("")}</tr>`)
        .join("")}</tbody></table></div></div>`;
    }

    // ---------- 경매·공매 ----------
    function auctionHTML(r) {
      const dong = (r.bj || r.j || "").split(" ")[0];
      const addr = `서울특별시 ${r.g} ${dong}`.trim();
      return `<div class="sect auc"><h3>경매·공매 <small>법원경매·온비드에서 이 동네 물건 찾기</small></h3>
        <div class="auc-addr"><span>검색할 주소</span><b id="aucAddr">${esc(addr)}</b><button type="button" class="btn secondary sm" id="aucCopy">복사</button><span class="share-fb" id="aucFb" role="status"></span></div>
        <div class="auc-links"><a class="btn secondary sm" href="https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151F00.xml" target="_blank" rel="noopener">법원경매정보 물건 검색 ↗</a><a class="btn secondary sm" href="https://www.onbid.co.kr/op/cta/cltrdtl/collateralRealEstateList.do" target="_blank" rel="noopener">온비드 부동산 공매 ↗</a></div>
        <p class="note">두 사이트 모두 주소로 바로 이어지는 링크를 공개하지 않아, 위 주소를 복사해 '소재지'에 넣어 찾으세요. 경매로 산 물건도 권리산정기준일·조합원 지위 양도 제한이 똑같이 적용되고, 현금청산 대상이면 입주권이 없어요.</p></div>`;
    }
    function bindAuction() {
      const b = $("aucCopy");
      if (!b) return;
      b.onclick = () => {
        const t = $("aucAddr").textContent, fb = $("aucFb");
        const ok = () => { fb.textContent = "복사했어요"; setTimeout(() => (fb.textContent = ""), 1800); };
        try { navigator.clipboard.writeText(t).then(ok, () => selectText()); } catch (e) { selectText(); }
        function selectText() { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents($("aucAddr")); s.removeAllRanges(); s.addRange(rg); fb.textContent = "선택했어요 · Ctrl+C로 복사"; }
      };
    }

    // ---------- 주소로 물건 확인 ----------
    function addrHTML(r) {
      if (!r.pcl || r.src === "moa") return `<div class="sect acheck"><h3>매물 지번으로 확인</h3><p class="note">이 구역은 공식 경계가 공개되지 않아(후보지·구역지정 전 등) 지번별 경계 판정을 할 수 없어요. 구청 도시정비과에 구역계 도면을 확인하세요.</p></div>`;
      return `<div class="sect acheck"><h3>매물 지번으로 확인 <small>구역 경계 안인지 · 언제 지은 건물인지</small></h3>
        <form class="ac-f" id="acForm" autocomplete="off"><label class="sr-only" for="acIn">지번</label><div class="inp"><input id="acIn" placeholder="예: ${esc(((r.bj || r.j || "").split(" ")[1]) || "123-4")}" inputmode="text"></div><button type="submit" class="btn secondary sm">확인</button></form>
        <div id="acOut" aria-live="polite"></div>
        <p class="note">서울도시공간포털 연속지적 필지와 실거래·전월세 신고의 준공연도로 판정한 참고용이에요. 등기부·건축물대장과 조합에 꼭 확인하세요.</p></div>`;
    }
    function bindAddr(r) {
      const f = $("acForm");
      if (!f) return;
      f.onsubmit = (e) => {
        e.preventDefault();
        const raw = $("acIn").value.trim().replace(/\s+/g, "").replace(/번지$/, "");
        const m = raw.match(/(산)?(\d+)(?:-(\d+))?$/);
        const out = $("acOut");
        if (!m) { out.innerHTML = `<p class="note">지번을 '본번-부번' 형태로 넣어 주세요. 예: 123-4</p>`; return; }
        const key = (m[1] || "") + String(+m[2]) + (m[3] && +m[3] ? "-" + +m[3] : "");
        out.innerHTML = `<p class="note">찾는 중…</p>`;
        loadPcl(r.id).then((d) => {
          if (cur !== r) return;
          const geo = GEO_Z && GEO_Z[r.id];
          if (!d || !d.p) { out.innerHTML = `<p class="note">${geo && geo.e ? "이 구역은 공식 경계가 없어 필지 판정을 할 수 없어요." : "필지 자료를 불러오지 못했어요."}</p>`; return; }
          const hits = d.p.filter((x) => x[1] === key);
          const ri = rights(r);
          if (!hits.length) {
            out.innerHTML = `<ul class="acl"><li class="warn"><b>경계 안 필지 목록에 없어요</b> 이 구역 공식 경계 안 ${fmt(d.p.length)}필지(${esc(Object.values(d.d).filter(Boolean).join("·"))}) 중에 '${esc(key)}'가 없어요. 지번을 잘못 넣었거나, 합필·분필로 번호가 바뀌었거나, 경계 밖일 수 있어요. 등기부·토지대장의 지번으로 다시 확인하세요.</li></ul>`;
            return;
          }
          out.innerHTML = `<ul class="acl">${hits.map((x) => {
            const dn = d.d[x[0]] || "";
            const yr = x[4];
            const rdY = ri.k === "set" ? +ri.d.slice(0, 4) : null;
            const yrLine = !yr ? `<li class="na"><b>준공연도 미확인</b> 최근 거래 신고가 없어 준공연도를 몰라요. 건축물대장으로 사용승인일을 확인하세요.</li>`
              : rdY && yr > rdY ? `<li class="bad"><b>${yr}년 준공 · 권리산정기준일(${esc(ri.d)}) 뒤</b> 기준일 뒤 신축이면 입주권이 안 나오거나 나눠 받을 수 있어요.</li>`
              : rdY && yr === rdY ? `<li class="warn"><b>${yr}년 준공 · 기준일과 같은 해</b> 사용승인일이 ${esc(ri.d)} 전인지 건축물대장으로 확인하세요.</li>`
              : `<li class="ok"><b>${yr}년 준공</b> ${rdY ? `권리산정기준일(${esc(ri.d)}) 전에 지은 건물이에요.` : "권리산정기준일이 정해지면 그 전 준공인지가 중요해요."}${2026 - yr <= 10 ? " 10년 이하 신축이라 지분 쪼개기 여부를 꼭 확인하세요." : ""}</li>`;
            return `<li class="ok"><b>구역 경계 안</b> ${esc(dn)} ${esc(x[1])} · 지목 ${esc(x[3])} · 필지 면적 ${fmt(x[2])}㎡${x[2] < 90 && /^대/.test(x[3]) ? " (90㎡ 미만 과소필지)" : ""}</li>${yrLine}`;
          }).join("")}</ul>`;
        });
      };
    }

    // ---------- 몇 개만 보여 주고 '더보기' ----------
    function moreRows(box, n) {
      const rows = [...box.querySelectorAll("tbody > tr, ul > li")];
      if (rows.length <= n) return;
      rows.slice(n).forEach((x) => (x.hidden = true));
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn secondary sm more-b"; b.textContent = `더보기 (${rows.length - n}건)`; b.setAttribute("aria-expanded", "false");
      b.onclick = () => { const open = b.getAttribute("aria-expanded") !== "true"; rows.slice(n).forEach((x) => (x.hidden = !open)); b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "접기" : `더보기 (${rows.length - n}건)`; };
      box.appendChild(b);
    }

    // ---------- 실거래 탭 ----------
    function chartSVG(r, q) {
      if (!q || q.length < 2) return "";
      const W = 560, H = 150, pl = 8, pr = 8, pt = 16, pb = 22;
      const vs = q.map((x) => x[1]), mn = Math.min(...vs), mx = Math.max(...vs), rg = Math.max(1, mx - mn);
      const t0 = qT(q[0][0]), t1 = qT(q[q.length - 1][0]) + 0.25;
      const X = (t) => pl + ((t - t0) / Math.max(0.25, t1 - t0)) * (W - pl - pr), Y = (v) => pt + (H - pt - pb) * (1 - (v - mn) / rg);
      const pts = q.map((x) => [X(qT(x[0]) + 0.125), Y(x[1]), x]);
      const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
      const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${H - pb}L${pts[0][0].toFixed(1)},${H - pb}Z`;
      const ms = Object.entries(r.dt || {}).filter(([k, d]) => d && ["구역지정", "추진위", "조합설립", "사업시행", "관리처분"].includes(k)).map(([k, d]) => [k, +d.slice(0, 4) + (+d.slice(5, 7) - 1) / 12]).filter(([, t]) => t >= t0 && t <= t1);
      const yr0 = Math.ceil(t0), ticks = []; for (let y = yr0; y <= t1; y++) ticks.push(y);
      return `<svg class="txc" viewBox="0 0 ${W} ${H}" role="img" aria-label="분기별 대지 3.3㎡당 가격 가운데 값 추이${ms.length ? "와 인가 시점" : ""}">
        ${ticks.map((y) => `<line x1="${X(y).toFixed(1)}" x2="${X(y).toFixed(1)}" y1="${pt}" y2="${H - pb}" class="g"/><text x="${X(y).toFixed(1)}" y="${H - 6}" class="x">${y}</text>`).join("")}
        ${ms.map(([k, t]) => `<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${pt - 6}" y2="${H - pb}" class="m"/><text x="${(X(t) + 3).toFixed(1)}" y="${pt - 4}" class="mt">${k}</text>`).join("")}
        <path d="${area}" class="a"/><path d="${line}" class="l"/>
        ${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${p[2][2] >= 5 ? 3 : 2}" class="d"><title>${p[2][0]} · ${eok(p[2][1])} · ${p[2][2]}건</title></circle>`).join("")}
        <text x="${(pts[pts.length - 1][0] - 2).toFixed(1)}" y="${(pts[pts.length - 1][1] - 7).toFixed(1)}" class="v" text-anchor="end">${eok(vs[vs.length - 1])}</text></svg>`;
    }
    const qT = (s) => 2000 + +s.slice(0, 2) + (+s.slice(3) - 1) / 4;
    function paneTx(r) {
      const p = $("pane"), z = GEO_Z && GEO_Z[r.id];
      if (!TXD) { p.innerHTML = `<p class="note">구역 실거래를 불러오는 중…</p>`; loadTx().then(() => { if (cur === r && curTab === "tx" && $("pane")) paneTx(r); }); return; }
      const t = { ...(r.tx || {}), ...((TXD[r.id] && TXD[r.id].x) || {}) };
      if (!t.n && !t.jn && !t.pc) {
        p.innerHTML = `<div class="sect"><p class="note">${z && !z.e ? "2024년 이후 이 구역 경계 안에서 신고된 빌라·단독 매매와 빌라 전세가 없어요." : "이 구역은 공식 경계가 없어(후보지·구역지정 전 등) 경계 안 거래만 따로 모을 수 없어요."} 주변 시세는 '호재·매물' 탭의 KB부동산에서 확인하세요.</p></div>${rightsHTML(r)}`;
        return;
      }
      const pc = t.pc, age = t.age || {}, agn = t.agn || {};
      const qq = (t.q || []).filter((x) => x[2] >= 3);
      const x = (() => { try { return invest(r); } catch (e) { return {}; } })();
      p.innerHTML = `
        <div class="bigrow b3">
          <div class="big hl"><span>땅 1평(3.3㎡)당 가운데 값</span><b>${t.pp ? eok(t.pp) : "–"}</b><small>${t.n ? `매매 ${fmt(t.n)}건 · 2024.1~${ymd2(t.last)}` : ""}</small></div>
          <div class="big"><span>빌라 매매 가운데 값</span><b>${t.med ? eok(t.med) : "–"}</b><small>${t.no ? `2015년 이전 준공 빌라 최근 ${t.nwin || 18}개월 ${fmt(t.no)}건 · 전용 ${t.ar}㎡ · 대지 ${t.ld}㎡` : "최근 18개월 구축 빌라 거래 없음"}</small></div>
          <div class="big"><span>빌라 전세 가운데 값</span><b>${t.jm ? eok(t.jm) : "–"}</b><small>${t.jn ? `전세 ${fmt(t.jn)}건 · 임대 ${t.ja}㎡${t.jr ? ` · 전세가율 ${Math.round(t.jr * 100)}%` : t.jr2 ? ` · 전세가율 약 ${Math.round(t.jr2 * 100)}%` : ""}` : "전세 거래 없음"}</small></div>
        </div>
        ${x.price != null && x.priceSrc !== "user" && r.mk?.entry?.fill !== "zone" && t.no ? `<p class="note warnbox"><b>계산은 다른 값을 써요</b> ${r.src === "moa" ? "모아타운 관리지역은 블록별로 사업이 따로 진행돼, 관리지역 전체가 아니라 주변 빌라 시세로 계산했어요." : r.mk?.entry?.src === "complex" ? "재건축 단지라 같은 단지 아파트 매매로 계산했어요." : `구역 안 구축 빌라 매매(최근 ${t.nwin || 18}개월 ${t.no}건)가 기준(5건)에 못 미쳐 주변 빌라 시세로 계산했어요.`} 실제 매물가는 '입주 현금' 탭에 넣어 다시 계산하세요.</p>` : ""}
        ${x.price != null ? `<p class="note"><b>계산에 쓴 매수가 ${e2(x.price)}억</b> ${x.priceSrc === "user" ? "직접 입력한 값" : r.mk?.entry?.scope ? esc(r.mk.entry.scope) + " 실거래 가운데 값" : x.priceSrc === "complex" ? "같은 단지 아파트 실거래" : "구역 주변 구축 빌라 실거래"} · '입주 현금' 탭에서 바꿀 수 있어요</p>` : ""}
        ${qq.length > 2 ? `<div class="sect"><h3>대지 3.3㎡당 가격 추이 <small>분기별 가운데 값(3건 이상인 분기) · 연립다세대·단독${Object.keys(r.dt || {}).length ? " · 세로선 = 인가 시점" : ""}</small></h3><div class="txc-w">${chartSVG(r, qq)}</div></div>` : ""}
        ${t.age ? `<div class="sect"><h3>연식별 대지 3.3㎡당 <small>새 건물일수록 비싸지만 권리산정기준일 뒤 신축이면 입주권이 문제될 수 있어요</small></h3><dl class="facts">
          <div><dt>10년 이하</dt><dd>${age.a ? eok(age.a) : "–"}<small>${agn.a || 0}건</small></dd></div><div><dt>11~30년</dt><dd>${age.b ? eok(age.b) : "–"}<small>${agn.b || 0}건</small></dd></div><div><dt>31년 이상</dt><dd>${age.c ? eok(age.c) : "–"}<small>${agn.c || 0}건</small></dd></div>
          <div><dt>쪼개기 의심 거래</dt><dd>${t.split ? t.split + "건" : "없음"}<small>2016년 이후 준공 · 대지 15㎡ 이하</small></dd></div></dl></div>` : ""}
        ${t.old && t.old.k ? `<div class="sect"><h3>노후도 <small>구역 경계 안 건축물 ${fmt(t.old.n)}동 전수 · 사용승인연도 확인 ${fmt(t.old.k)}동 · 서울도시공간포털 건물 정보</small></h3><div class="oldbar" role="img" aria-label="노후·불량 건축물 ${t.old.pol}%, 기준선 60%"><i style="width:${t.old.pol}%"></i><s style="left:60%"></s></div><dl class="facts"><div><dt>노후·불량 건축물</dt><dd>${t.old.pol}%<small>철근콘크리트·철골조 30년, 그 밖의 구조 20년 이상(서울 조례 기준 단순화) · 구역지정 요건 60% 이상</small></dd></div><div><dt>30년 이상 건물</dt><dd>${t.old.p30}%<small>평균 ${t.old.avg}년 된 건물</small></dd></div><div><dt>10년 이하 신축</dt><dd>${fmt(t.old.new10)}동<small>권리산정기준일 뒤 신축이면 입주권 문제 확인</small></dd></div></dl></div>` : ""}
        ${pc ? `<div class="sect"><h3>구역 필지 현황 <small>서울도시공간포털 연속지적 ${fmt(pc.n)}필지 · 합계 ${fmt(pc.ar)}㎡</small></h3><dl class="facts">
          <div><dt>과소필지 (90㎡ 미만)</dt><dd>${pc.sm}%<small>도로·하천 제외 · 재개발 지정 요건 40% 이상</small></dd></div>
          <div><dt>국공유지</dt><dd>${pc.pub}%<small>필지 수 기준 · 많으면 무상양도 협의가 사업성에 영향</small></dd></div>
          <div><dt>도로 필지</dt><dd>${pc.rd}%<small>필지 수 기준</small></dd></div>
          ${pc.jm ? `<div><dt>지목 구성</dt><dd class="tx">${pc.jm.map(([k, v]) => `${esc(k)} ${fmt(v)}`).join(" · ")}</dd></div>` : ""}</dl></div>` : ""}
        <div class="sect"><h3>최근 매매 <small>구역 경계 안 · 국토부 신고 기준</small></h3><div id="txList" class="txl"><p class="note">불러오는 중…</p></div></div>
        <div class="sect"><h3>최근 전세 <small>연립다세대</small></h3><div id="jList" class="txl"></div></div>
        <p class="note src">자료: 서울시 부동산 실거래가·전월세가 정보(서울 열린데이터광장, 매매 ${esc(ymd(D.txAsOf?.sale))}·전세 ${esc(ymd(D.txAsOf?.rent))}까지), 정비구역 경계·필지 서울도시공간포털. 구역 경계 안 필지 번호와 맞춘 거래만 셉니다.</p>`;
      loadTx().then((d) => {
        if (cur !== r || !$("txList")) return;
        const z0 = d[r.id] || {}, S = Array.isArray(z0.s) ? z0.s : [], J = Array.isArray(z0.j) ? z0.j : [];
        const TY = ["빌라", "단독"];
        const rdY = (() => { const x = rights(r); return x.k === "set" ? +x.d.slice(0, 4) : null; })();
        $("txList").innerHTML = S.length
          ? `<table class="tx"><thead><tr><th scope="col">계약일</th><th scope="col">유형</th><th scope="col" class="n">준공</th><th scope="col" class="n">전용</th><th scope="col" class="n">대지</th><th scope="col" class="n">가격</th><th scope="col" class="n">대지 3.3㎡당</th></tr></thead><tbody>${S.slice(0, 40)
              .map((x) => `<tr><td>${ymd2(x[0])}</td><td>${TY[x[1]] || ""}${x[6] ? ` ${esc(String(x[6]))}층` : ""}${x[2] >= 2016 && x[4] > 0 && x[4] <= 15 ? ' <em class="flag" title="최근 준공·대지 15㎡ 이하: 지분 쪼개기 신축일 수 있어요">쪼개기 의심</em>' : rdY && x[2] > rdY ? ' <em class="flag" title="권리산정기준일 뒤 준공">기준일 뒤 준공</em>' : ""}</td><td class="n">${x[2] || "–"}</td><td class="n">${x[3]}㎡</td><td class="n">${x[4] || "–"}㎡</td><td class="n"><b>${eok(x[5])}</b></td><td class="n">${x[4] > 0 ? eok(Math.round((x[5] / x[4]) * 3.3058)) : "–"}</td></tr>`)
              .join("")}</tbody></table>`
          : '<p class="note">2024년 이후 구역 안 매매 신고가 없어요.</p>';
        $("jList").innerHTML = J.length
          ? `<table class="tx"><thead><tr><th scope="col">계약일</th><th scope="col" class="n">준공</th><th scope="col" class="n">임대 면적</th><th scope="col" class="n">보증금</th></tr></thead><tbody>${J.slice(0, 20).map((x) => `<tr><td>${ymd2(x[0])}</td><td class="n">${x[1] || "–"}</td><td class="n">${x[2]}㎡</td><td class="n"><b>${eok(x[3])}</b></td></tr>`).join("")}</tbody></table>`
          : '<p class="note">2025년 이후 구역 안 빌라 전세 신고가 없어요.</p>';
        moreRows($("txList"), 5); moreRows($("jList"), 5);
      });
    }

    // 지도 경계 데이터(경계 유무 판정용)
    let GEO_Z = null;
    const geoReady = () => { if (!GEO_Z && D.dv && D.dv.geo) LMX.geo().then((g) => { GEO_Z = g ? g.z : {}; }); };

    // ---------- 정보몽땅 최근 기록(다음 인가 선행 신호) ----------
    const SIG = [[/분양신청/, "관리처분인가가 가까워졌다는 신호(조합원 분양신청)"], [/총회개최/, "총회 개최"], [/인가신청|승인신청/, "다음 인가를 신청함"], [/업체선정/, "업체 선정"], [/공람|설명회/, "주민 공람·설명회"]];
    function evHTML(r) {
      const ev = r.ev;
      if (!Array.isArray(ev) || !ev.length) return "";
      const rows = ev.slice(0, 6).map(([d, sec, t]) => { const s = SIG.find(([re]) => re.test(t)); return `<li><span class="ev-d mono">${esc(d.replaceAll("-", "."))}</span><span class="ev-t"><b>${esc(sec)}</b> ${esc(t.replace(/^\[|\]/g, (m) => (m === "[" ? "" : " ·")))}${s ? ` <em class="ev-s">${esc(s[1])}</em>` : ""}</span></li>`; }).join("");
      return `<div class="sect evl"><h3>정보몽땅 최근 기록 <small>추진경과 · 매일 갱신 · 인가 전 신청·총회가 먼저 올라와요</small></h3><ul>${rows}</ul>${r.cafe ? `<p class="note"><a href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl=${encodeURIComponent(r.cafe)}" target="_blank" rel="noopener">정보몽땅 사업장 원문 보기</a></p>` : ""}</div>`;
    }
    // ---------- 역전세 위험(전세 끼고 사기) ----------
    function rvjHTML(r) {
      const v = D.rvj && D.rvj[r.g];
      if (!v) return "";
      const lvl = v.down >= 15 || v.chg <= 0 ? "hi" : v.down >= 7 ? "mid" : "lo";
      const T = { hi: "주의", mid: "보통", lo: "낮음" };
      return `<div class="rvj ${lvl}"><div class="rvj-h"><b>역전세 위험 · ${esc(r.g)}</b><span>${T[lvl]}</span></div><p>최근 6개월 연립·다세대 전세 <b>갱신계약 ${fmt(v.n)}건</b> 중 보증금을 낮춘 곳 <b>${v.down}%</b>, 보증금 변화 가운데 값 <b>${v.chg > 0 ? "+" : ""}${v.chg}%</b>.</p><p class="note">전세를 끼고 사면 만기 때 보증금을 돌려줘야 할 수 있어요. ${lvl === "hi" ? "이 구는 보증금을 낮춰 재계약하는 비율이 높아, 갭 금액에 여유 자금을 더 두세요." : "새 세입자가 더 낮은 보증금으로 들어올 경우를 대비해 여유 자금을 두세요."} 출처: 서울시 전월세 신고(종전 보증금).</p></div>`;
    }

    // ---------- 기존 탭에 덧붙이기 ----------
    const _biz = paneBiz, _req = paneReq, _near = paneNear, _money = paneMoney;
    paneMoney = function (r) {
      _money(r);
      if (gapMode() && r.src !== "moa") { const h = rvjHTML(r); if (h) $("pane").insertAdjacentHTML("beforeend", h); }
    };
    paneBiz = function (r) {
      _biz(r);
      const p = $("pane");
      const old = p.querySelector(".note b");
      p.querySelectorAll("p.note").forEach((n) => { if (/^권리산정기준일/.test((n.querySelector("b") || {}).textContent || "")) n.remove(); });
      const lad = p.querySelector(".sect");
      const feed = `<p class="feedl"><a href="feed/gu/${encodeURIComponent(r.g)}.xml" target="_blank" rel="noopener">${esc(r.g)} 정비사업 새 소식 구독(RSS)</a> <span>단계 변경·새 인가가 생기면 RSS 앱으로 받아 볼 수 있어요 · <a href="feed/">전체 구 목록</a></span></p>`;
      const add = `${paceHTML(r)}${evHTML(r)}${feed}${rightsHTML(r)}`;
      if (lad) lad.insertAdjacentHTML("afterend", add); else p.insertAdjacentHTML("afterbegin", add);
      const ev = p.querySelector(".evl"); if (ev) moreRows(ev, 3);
      const facts = p.querySelector("dl.facts");
      const sup = supplyHTML(r);
      if (sup) (facts || p.lastElementChild).insertAdjacentHTML("afterend", sup);
    };
    paneReq = function (r) {
      _req(r);
      const p = $("pane");
      const first = p.querySelector("p.note");
      const h = rightsHTML(r) + addrHTML(r);
      if (first) first.insertAdjacentHTML("afterend", h); else p.insertAdjacentHTML("afterbegin", h);
      geoReady();
      bindAddr(r);
    };
    paneNear = function (r) {
      _near(r);
      const p = $("pane");
      const chk = p.querySelector(".chk3");
      const h = auctionHTML(r) + nearbyHTML(r);
      if (chk) chk.insertAdjacentHTML("beforebegin", h); else p.insertAdjacentHTML("beforeend", h);
      bindAuction();
      const hj = p.querySelector(".hjl"); if (hj) moreRows(hj.parentElement, 3);
      p.querySelectorAll(".nc-go").forEach((b) => (b.onclick = () => { curTab = "money"; select(b.dataset.go, false, false, { scroll: !MQ_SHEET.matches }); }));
    };
    return { paneTx, rights, rightsHTML, pace, geoReady, loadTx };
  })();
  function paneTx(r) { ZX.geoReady(); ZX.paneTx(r); }
  // 매수가가 없을 때 이유를 구역 성격에 맞게
  function noPriceTxt(r) {
    if (!r) return "매수가 추정 불가";
    if (r.nx === "biz") return "업무·상업 중심 도시정비형이라 아파트 입주권 계산 대상 아님";
    if (r.k === "재건축" || r.k === "소규모재건축") return "단지 매매가 최근 2년 2건 미만이라 매수가 추정 불가";
    if (r.s >= 7) return "이주·철거 단계라 현재 매수가 없음";
    if (!r.ll) return "위치가 공개되지 않은 후보지라 주변 시세를 못 찾았어요";
    return "매수가 추정 불가 · 주변 빌라 거래가 적어요";
  }
  // 공공재개발 후보지·구역도 토지거래허가(실거주 2년) 대상인 경우가 많아 전세 낀 매수에서 뺀다
  {
    const _lp = landPermit;
    landPermit = function (r) {
      const x = _lp(r);
      if (x) return x;
      const pub = (isPublic(r) || /공공재개발|\s공공$|공공\s*재개발|공공\)/.test(r.n) || (r.pg || []).some((p) => /공공재개발/.test(p))) && !/공공임대|장기전세/.test(r.n);
      if (pub && isRedev(r))
        return { t: "토지거래허가 가능성 · 공공재개발", d: "공공재개발 후보지·구역은 토지거래허가구역으로 지정돼 2년 실거주 의무가 붙는 경우가 많아요(2021년 1차 후보지부터). 지정 여부와 기간은 구청에서 확인하세요." };
      return null;
    };
  }
