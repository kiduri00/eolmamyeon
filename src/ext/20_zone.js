  // ===================== 구역 리포트 보강: 실거래 · 권리산정기준일 · 공급 계획 · 진행 속도 · 인근 비교 · 경공매 · 물건 확인 =====================
  const ZX = (() => {
    const ymd = (d) => (d && d.length >= 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : "");
    const ymd2 = (d) => (d && d.length >= 8 ? `${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : "");
    const eok = ZF.eok;   // 숫자 꼴은 ZF 하나(05_facts.js)
    const dv = (k) => (D.dv && D.dv[k]) || D.asOf;
    let TXD = null, TXP = null;
    const loadTx = () => TXP || (TXP = fetch(`data/tx.json?v=${dv("tx")}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => (TXD = d && typeof d === "object" ? d : {})));
    // 주변 빌라 매수가 표본(tools/near.py) — 구역 경계에서 반경 안 거래 하나하나(머리 큰 숫자·계산 매수가를 거래 탭에서 맞춰 볼 수 있게)
    let NRD = null, NRP = null;
    const loadNear = () => NRP || (NRP = fetch(`data/near.json?v=${dv("near")}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => (NRD = (d && d.z) || {})));
    // 이 구역 계산 매수가가 주변 표본이고, 목록이 표본 건수와 맞을 때만 돌려준다(어긋나면 보여 주지 않음)
    const nearOf = (r) => { const en = r && r.mk && r.mk.entry, z = NRD && r && NRD[r.id]; return en && en.src === "villa" && (en.radius || 0) >= 100 && z && z.s && z.s.length === en.n ? z : null; };
    const PCL = new Map();
    const loadPcl = (id) => PCL.get(id) || (PCL.set(id, fetch(`data/pcl/${id}.json?v=${dv("tx")}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)), PCL.get(id));
    const bandOf = (r) => (r.s >= 9 || r.dn ? "done" : r.s <= 2 ? "early" : r.s <= 4 ? "mid" : "late");

    // ---------- 권리산정기준일 ----------
    // 2010.7.16 전에 지정된 구역: 지정일을 법 원칙(제77조)으로 확신하지 않는다 — 옛 서울시 조례 부칙 기준일이 따로 적용될 수 있음
    function rights(r) {
      const v = rights0(r);
      if (v.k === "set" && v.c !== "high" && v.d && v.d < "2010.07.16") Object.assign(v, { c: "low", old: 1 });
      return v;
    }
    function rights0(r) {
      const x = r.rdx;
      if (x && x.c === "chg") return { k: "chg", b: x.b, u: x.u };   // 구역지정일이 변경 지정일 → 날짜를 추정하지 않음(tools/enrich.py)
      if (x && x.d) return { d: x.d.replaceAll("-", "."), b: x.b, u: x.u, c: x.c, k: "set" };
      if (typeof r.rd === "string" && r.rd.trim()) return { d: r.rd.trim().replace(/^’/, "20").replace(/\.$/, ""), b: "서울시 모아타운 대상지 권리산정기준일 고시", u: "https://news.seoul.go.kr/citybuild/archives/525003", c: "high", k: "set" };
      const dt0 = r.dt || {}, dz = dt0["구역지정"];
      const zEarly = dz && ["조합설립", "시행자지정", "사업시행", "관리처분", "착공"].find((k) => dt0[k] && dt0[k] < dz);
      if (zEarly) return { k: "chg", b: `등록된 구역지정일(${dz.replaceAll("-", ".")})이 ${zEarly}(${dt0[zEarly].slice(0, 7).replace("-", ".")})보다 늦어 변경 지정일로 보여요. 최초 지정 고시일이나 따로 고시된 기준일을 구청에 확인하세요.`, u: "https://www.law.go.kr/법령/도시및주거환경정비법/제77조" };
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
      const conf = x.old ? "추정 · 서울시 조례 부칙(2010.7.16 이전 지정) 확인 필요" : x.c === "high" ? "고시·보도자료 확인" : x.c === "mid" ? "법 원칙으로 추정" : x.c === "low" ? "추정 · 확인 필요" : "";
      const old = x.old ? " 2010.7.16 전에 지정된 구역은 옛 서울시 조례 부칙(2003.12.30 다세대 전환 기준·2008.7.30 지분 쪼개기 기준 등)이 적용될 수 있어 이 날짜가 아닐 수 있어요. 구청에 확인하세요." : "";
      if (x.k === "set" && x.old)
        return `<div class="rdx"><div class="rdx-h"><span class="rdx-l">권리산정기준일</span><b class="mono">${esc(x.d)}?</b><span class="rdx-c low">${conf}</span></div>${compact ? "" : `<p>지정 고시일(${esc(x.d)})로 추정했어요.${old} <a href="${esc(x.u)}" target="_blank" rel="noopener">근거</a></p>`}</div>`;
      if (x.k === "set")
        return `<div class="rdx"><div class="rdx-h"><span class="rdx-l">권리산정기준일</span><b class="mono">${esc(x.d)}</b>${conf ? `<span class="rdx-c ${x.c}">${conf}</span>` : ""}</div>${compact ? "" : `<p>${esc(x.b)} · 이날 뒤에 새로 짓거나 쪼갠 지분(신축 빌라·지분 분할)은 입주권이 안 나오거나 여럿이 하나를 나눠 받을 수 있어요.${old} <a href="${esc(x.u)}" target="_blank" rel="noopener">근거</a></p>`}</div>`;
      return `<div class="rdx none"><div class="rdx-h"><span class="rdx-l">권리산정기준일</span><b>${x.k === "pre" ? "아직 없음" : x.k === "chg" ? "확인 필요" : "구청 확인 필요"}</b></div>${compact ? "" : `<p>${esc(x.b)} <a href="${esc(x.u)}" target="_blank" rel="noopener">근거</a></p>`}</div>`;
    }

    // ---------- 진행 속도 ----------
    const PACE_KEY = { 2: "구역지정>조합설립", 3: "추진위>조합설립", 4: "조합설립>사업시행", 5: "사업시행>관리처분", 6: "관리처분>착공", 8: "착공>준공" };
    const STAGE_DT = { 2: "구역지정", 3: "추진위", 4: "조합설립", 5: "사업시행", 6: "관리처분", 8: "착공" };
    function pace(r) {
      if (r.dn || r.s >= 9 || r.src === "moa") return null;
      const k = PACE_KEY[r.s], dk = STAGE_DT[r.s];
      const st0 = k ? ZF.stageStat(r, k) : null;   // 사이클 2: 단계 기간 통계 한 곳(/years·F2 타임라인과 같은 기준)
      const d = r.dt && (r.dt[dk] || (r.s === 4 && r.dt["시행자지정"]));
      if (!k || !st0 || !d) return null;
      const yrs = ZF.yrsSince(d);   // 사이클 2: 경과 연수 한 곳(F2 타임라인·장기 정체 판정과 같은 셈)
      if (!(yrs >= 0)) return null;
      const lvl = yrs > st0.p75 * 1.5 ? "slow2" : yrs > st0.p75 ? "slow" : yrs < st0.p25 ? "fast" : "norm";
      return { yrs, med: st0.med, p25: st0.p25, p75: st0.p75, n: st0.n, na: st0.na, st: st0, lvl, from: d, k };
    }
    function paceHTML(r) {
      const p = pace(r);
      if (!p) return "";
      const T = { fast: "빠른 편", norm: "보통", slow: "늦은 편", slow2: "많이 늦음" };
      const w = Math.min(100, (p.yrs / Math.max(p.p75 * 1.6, p.yrs)) * 100), m = Math.min(100, (p.med / Math.max(p.p75 * 1.6, p.yrs)) * 100);
      return `<div class="pace ${p.lvl}"><div class="pace-h"><b>현재 단계 ${ZF.dur(p.yrs)}째</b><span class="pace-t">${T[p.lvl]}</span></div><div class="pace-bar" role="img" aria-label="서울 같은 구간 가운데 값 ${ZF.durS(p.med)} 대비 ${ZF.dur(p.yrs)}"><i style="width:${w.toFixed(1)}%"></i><s style="left:${m.toFixed(1)}%"></s></div><small>${esc(p.k.replace(">", " → "))} 서울 실제 소요 ${ZF.stageStatTxt(p.st)} · ${esc(p.from.replaceAll("-", "."))}부터 · 같은 기준 <a href="years">몇 년 걸리나</a></small></div>`;
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
    // 사이클 2: 비교 표 돈도 시트 첫 칸 판정(DTL.shown) 하나로 — 고른 사는 방식 값만(전세 끼고면 대출 끼고 값 'lnow'는 섞지 않고 '–')
    function needOf(r) {
      if (r.src === "moa") return null;
      try {
        const w = DTL.shown(r);
        if (w.kind !== "need" && !(w.kind === "lnow" && !gapMode())) return null;
        return !gapMode() && effBasis() === "total" ? (w.total ?? null) : w.v;
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
        // 이 구역 리포트 머리 큰 숫자와 같은 값(ZF.u33: 매수가 표본의 3.3㎡당 · 머리가 매수가인 곳은 구역 안 대표 거래 값)
        ["3.3㎡당 실거래(기준)", (q) => { const h = ZF.u33(q); return h ? `${eok(h.v)}<span class="dim" style="display:block;font-size:11px;font-weight:400;color:var(--text-3)">${h.zone ? `구역 안 ${h.n || ""}건(참고 · 매수가 표본 아님)` : HDB[h.b] || ""}${h.st ? " · 오래된 거래" : ""}</span>` : "–"; }],
        [lab, (q) => { const n = needOf(q); return n == null ? "–" : `${ZF.cash(n)}`; }, (q) => needOf(q)],
        ["10년 안 준공", (q) => (q.eta?.p10 != null ? probTxt(q.eta.p10) : "–"), (q) => (q.eta?.p10 != null ? -q.eta.p10 : null)],
      ];
      // 비교하는 곳 절반 넘게 '–'인 '계획 세대' 줄은 뺀다
      for (let i = rows.length - 1; i >= 0; i--) { if (rows[i][0] !== "계획 세대") continue; const v = cols.map(([q, d]) => String(rows[i][1](q, d))); if (v.filter((x) => x === "–").length > cols.length / 2) rows.splice(i, 1); }
      // 20차: 비교가 안 되는 줄(값이 있는 곳이 둘 미만)과 숫자 칸이 모두 '–'인 구역 열은 빼서 '– 2.4억 – – –' 같은 줄이 없게
      const DATA = (t) => !/^(거리|사업|단계)$/.test(t), dash = (x) => String(x).replace(/<[^>]*>/g, "").trim() === "–";
      for (let i = rows.length - 1; i >= 0; i--) { if (!DATA(rows[i][0])) continue; const v = cols.map(([q, d]) => rows[i][1](q, d)); if (v.filter((x) => !dash(x)).length < 2) rows.splice(i, 1); }
      for (let j = cols.length - 1; j >= 1; j--) { const [q, d] = cols[j]; const dr = rows.filter((x) => DATA(x[0])); if (dr.length && dr.every((x) => dash(x[1](q, d)))) cols.splice(j, 1); }
      if (cols.length < 2 || !rows.some((x) => DATA(x[0]))) return "";
      const best = rows.map(([, , k]) => { if (!k) return null; const v = cols.map(([q]) => k(q)).filter((x) => x != null); return v.length ? Math.min(...v) : null; });
      return `<div class="sect nearcmp"><h3>1km 안 다른 구역과 비교 <small>${cols.length - 1}곳 · 같은 내 조건으로 계산 · 굵은 값이 가장 유리 · 3.3㎡당 값은 각 구역 실거래 탭 맨 위와 같은 기준</small></h3><div class="nc-wrap"><table class="nc"><thead><tr><th scope="col"></th>${cols.map(([q], i) => `<th scope="col">${i ? `<button type="button" class="nc-go" data-go="${q.id}">${esc(shortName(q.n))}</button>` : `<b>${esc(shortName(q.n))}</b>`}</th>`).join("")}</tr></thead><tbody>${rows
        .map(([t, f, k], ri) => `<tr><th scope="row">${t}</th>${cols.map(([q, d]) => { const v = k ? k(q) : null; return `<td${v != null && v === best[ri] ? ' class="b"' : ""}>${f(q, d)}</td>`; }).join("")}</tr>`)
        .join("")}</tbody></table></div></div>`;
    }

    // ---------- 경매 물건(법원경매정보 · tools/auction.js → tools/auction_match.py → data/auction.json) ----------
    // 리포트를 열 때 한 번 받아 둔다(작은 파일). 구역 경계 안 필지와 지번이 맞는 물건만. '거래' 탭 맨 아래 블록(#aucSec).
    let AUC = null, AUCP = null;
    const loadAuc = () => AUCP || (AUCP = fetch(`data/auction.json?v=${dv("auction")}`).then((x) => (x.ok ? x.json() : null)).catch(() => null).then((d) => (AUC = d && typeof d === "object" ? d : { ok: false, byZone: {} })));
    // 물건 상태: 예정(up) / 목록에서 빠짐(gone) / 기일 지남·확인 중(chk). 날짜는 보는 날 기준으로 다시 따진다(파일이 며칠 묵어도)
    const aucToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const aucSt = (o) => (o.st === "chk" || (o.date && o.date < aucToday()) ? "chk" : o.st === "gone" ? "gone" : "up");
    const AUC_K = { up: 0, gone: 1, chk: 2 };
    const aucOf = (r) => {
      const xs = (AUC && AUC.ok && !(AUC.miss || []).includes(r.g) && AUC.byZone && AUC.byZone[r.id]) || [];
      return xs.slice().sort((a, b) => AUC_K[aucSt(a)] - AUC_K[aucSt(b)] || (aucSt(a) === "chk" ? String(b.date || "").localeCompare(String(a.date || "")) : String(a.date || "9").localeCompare(String(b.date || "9"))) || (a.no || 1) - (b.no || 1));
    };
    // 사건번호(+법원)로 묶기 — 순서는 aucOf 순서(묶음 안 가장 앞 물건 기준)
    const aucGroups = (xs) => { const m = new Map(); for (const o of xs) { const k = `${o.court}|${o.cs}`; if (!m.has(k)) m.set(k, []); m.get(k).push(o); } return [...m.values()]; };
    // 셈은 사건 단위(카드 하나 = 사건 하나) — 칩·머리·/z가 같은 셈 · 물건 수는 따로
    const aucUpX = (r) => aucOf(r).filter((o) => aucSt(o) === "up");
    const aucUp = (r) => aucGroups(aucUpX(r)).length;
    // 같은 땅(지번)의 사건끼리 붙여 번호를 매긴다 — 지도에는 그 땅 점 하나에 '1·2'(점이 겹쳐 쌓이던 것)
    const aucPk = (o) => String(o.addr || (o.ll ? o.ll.join(",") : o.cs)).replace(/\s+/g, "");
    const aucOrd = (xs) => { const m = new Map(); for (const g of aucGroups(xs)) { const k = aucPk(g[0]); if (!m.has(k)) m.set(k, []); m.get(k).push(g); } return [...m.values()].flat(); };
    const aucWon = (v) => { if (v == null || !isFinite(v)) return "–"; const e = Math.floor(v / 1e8), m = Math.round((v % 1e8) / 1e4); return e ? `${e}억${m ? ` ${m.toLocaleString("ko-KR")}만` : ""}원` : `${m.toLocaleString("ko-KR")}만`; };
    const aucEok = ZF.aucAmt;   // /z·알림함과 같은 반올림(05_facts.js)
    const aucDay = (d) => { if (!d) return "–"; const t = new Date(d + "T00:00:00+09:00"); return `${d.replaceAll("-", ".")} (${"일월화수목금토"[t.getDay()]})`; };
    const aucMd = (d) => (d ? `${+d.slice(5, 7)}.${+d.slice(8, 10)}` : "");
    const aucCourt = (c) => String(c || "").replace(/^서울(.+)지방법원$/, "서울$1지법");
    const aucUse = (u) => ZF.aucUse(u);
    const aucLot = (o) => { const m = String(o.addr || "").match(/(산\s*)?\d+(?:-\d+)?$/); return m ? m[0].replace(/\s/g, "") : ""; };
    const aucDd = (d) => { if (!d) return ""; const n = Math.round((Date.parse(d + "T00:00:00Z") - Date.parse(aucToday() + "T00:00:00Z")) / 864e5); return n > 0 ? `D-${n}` : n === 0 ? "D-day" : ""; };
    const AUC_BADGE = { gone: ["목록에서 빠짐 · 확인 중", "법원 목록에서 이번에 안 보였어요 — 기일 변경·취하·정지일 수 있어요"], chk: ["기일 지남 · 확인 중", "매각기일이 지났고 다음 기일이 아직 안 보여요(보통 유찰 뒤 4~5주 뒤)"] };
    const aucBadge = (s) => (AUC_BADGE[s] ? `<span class="auc-s ${s}" title="${AUC_BADGE[s][1]}">${AUC_BADGE[s][0]}</span>` : "");
    const aucJibun = (o) => !!o.jb;   // 지분 매각(auction_match.py가 몫만 남김: '13분의2' · 몫 모름 '1')
    const aucJb = (o) => { if (!o.jb) return ""; const f = o.jb !== "1" ? ZF.aucJb(o.jb) : null; return `<span class="auc-f j" title="${f ? `지분 ${esc(f.frac)}만 매각` : "지분만 매각"} — 낙찰받아도 전체 소유가 아니에요">${f ? esc(f.txt) : "지분"}</span>`; };
    const aucFail = (o) => (o.fail == null ? "" : o.fail > 0 ? `<span class="auc-f n">유찰 ${o.fail}회</span>` : `<span class="auc-f">신건</span>`);
    const aucSub = (o) => [aucUse(o.use), String(o.addr || "").replace(/^\S+구\s+/, "").replace(/\^/g, ", ")].filter(Boolean).join(" · ");
    // 물건 한 건: 사건번호(·물건번호) · 유찰 / 용도 · 지번 / 최저가(감정가 %) · 감정가 · 입찰기일(D-day)
    function aucItem(o, k, inG) {
      const s = aucSt(o), dd = s === "up" ? aucDd(o.date) : "";
      const num = k ? `<span class="auc-k" aria-label="지도 번호 ${k}">${k}</span>` : "";
      const title = inG ? `<b>물건 ${o.no || 1}</b>` : `<b class="mono">${esc(o.cs)}${o.no ? `<span class="auc-no">· 물건 ${o.no}</span>` : ""}</b>`;
      return `<li class="auc-i ${s}"${!inG && k ? ` id="aucC-${k}"` : ""}><div class="auc-ih">${num}${title}<span class="auc-cs">${aucBadge(s)}${aucJb(o)}${aucFail(o)}</span></div>
        <div class="auc-sub">${esc(aucSub(o))}</div>
        <div class="auc-pr"><div class="auc-min"><span>최저가</span><b>${aucEok(o.min)}</b>${o.rate != null ? `<em>감정가의 ${o.rate}%</em>` : ""}</div><div><span>감정가</span><b>${aucEok(o.appr)}</b></div><div><span>${s === "chk" ? "지난 입찰기일" : "입찰기일"}</span><b>${o.date ? `${aucMd(o.date)}(${"일월화수목금토"[new Date(o.date + "T00:00:00+09:00").getDay()]})` : "–"}</b>${dd ? `<em class="auc-dd">${dd}</em>` : ""}</div></div></li>`;
    }
    // 묶음 안 물건 한 줄: 물건 N · 용도·지번 · 최저가(감정가 %) · 유찰/지분 · 기일이 다르면 기일
    // 묶음 안 물건 한 줄: 최저가 · 감정가 · 감정가의 N% (사건 머리에 이미 쓴 유찰·지분은 줄마다 되풀이하지 않는다)
    function aucRow(o, d0, gFail, gJb) {
      const s = aucSt(o), dd = o.date && o.date !== d0 ? ` · ${s === "chk" ? "지난 기일 " : "입찰 "}${aucMd(o.date)}` : "";
      const ap = o.appr > 0 ? `<em>감정가 ${aucEok(o.appr)}${o.rate != null ? ` · <i>감정가의 ${o.rate}%</i>` : ""}</em>` : o.rate != null ? `<em><i>감정가의 ${o.rate}%</i></em>` : "";
      return `<li class="auc-r ${s}"><div class="auc-rt"><b>물건 ${o.no || 1}</b><span>${esc(aucSub(o))}${dd}</span></div><div class="auc-rv"><b>${aucEok(o.min)}</b>${ap}</div><div class="auc-rc">${aucBadge(s)}${gJb ? "" : aucJb(o)}${o.fail > 0 && !gFail ? aucFail(o) : ""}</div></li>`;
    }
    // 사건 하나에 물건이 여럿이면 접는 카드 하나로("물건 N개 · 최저 X~Y")
    function aucCase(g, k) {
      if (g.length === 1) return aucItem(g[0], k, false);
      const o = g[0], s = aucSt(o), mins = g.map((x) => x.min).filter((v) => v > 0);
      const lo = mins.length ? Math.min(...mins) : null, hi = mins.length ? Math.max(...mins) : null;
      const rng = lo == null ? "" : lo === hi ? ` · 최저 ${aucEok(lo)}` : ` · 최저 ${aucEok(lo)}~${aucEok(hi)}`;
      const ds = [...new Set(g.filter((x) => aucSt(x) === "up").map((x) => x.date).filter(Boolean))].sort();
      const when = ds.length ? `입찰 ${aucMd(ds[0])}${ds.length > 1 ? " 외" : ""} <em class="auc-dd">${aucDd(ds[0])}</em>` : o.date ? `지난 입찰기일 ${aucMd(o.date)}` : "";
      const fails = [...new Set(g.map((x) => x.fail).filter((v) => v != null))];
      const jbs = [...new Set(g.map((x) => x.jb || ""))], gJb = jbs.length === 1 && !!jbs[0];
      const fl = (g.some(aucJibun) ? aucJb(g.find(aucJibun)) : "") + (fails.length === 1 ? aucFail(o) : "");
      return `<li class="auc-g ${s}" id="aucC-${k}"><details><summary><div class="auc-ih"><span class="auc-k" aria-label="지도 번호 ${k}">${k}</span><b class="mono">${esc(o.cs)}</b><span class="auc-cs">${aucBadge(s)}${fl}</span></div>
        <div class="auc-gs">물건 ${g.length}개${rng}</div><div class="auc-sub">${esc(ZF.aucUses(g.map((x) => x.use)))}${when ? ` · ${when}` : ""}</div></summary>
        <ul class="auc-rl">${g.map((x) => aucRow(x, ds[0], fails.length === 1, gJb)).join("")}</ul></details></li>`;
    }
    function aucBody(r) {
      const asOf = AUC && AUC.asOf ? String(AUC.asOf).replaceAll("-", ".") : "";
      if (!AUC) return `<p class="auc-st">경매 물건 불러오는 중…</p>`;
      if (!AUC.ok || (AUC.miss || []).includes(r.g)) return `<p class="auc-st na">경매 물건 정보를 아직 못 가져왔어요${asOf && AUC.ok ? ` (기준 ${asOf})` : ""}</p>`;
      const xs = aucOf(r), up = xs.filter((o) => aucSt(o) === "up").length;
      if (!xs.length) return `<p class="auc-st">지금 이 구역 안에 진행 중인 경매 물건이 없어요 (기준 ${asOf})</p>`;
      const none = up ? "" : `<p class="auc-st">입찰기일이 잡힌 물건은 지금 없어요 — 아래는 기일이 지나 다음 기일을 확인 중인 물건이에요</p>`;
      const G = aucOrd(xs), pc = new Map(); G.forEach((g, i) => { const k = aucPk(g[0]); if (!pc.has(k)) pc.set(k, []); pc.get(k).push(i + 1); });
      const ph = (g, i) => { const L = pc.get(aucPk(g[0])); return L.length > 1 && L[0] === i + 1 ? `<li class="auc-pg">같은 땅${g[0].addr ? ` ${esc(String(g[0].addr).replace(/^\S+구\s+/, ""))}` : ""} · 사건 ${L.length}건(지도 ${L.join("·")})</li>` : ""; };
      return `${none}<ul class="auc-l">${G.map((g, i) => ph(g, i) + aucCase(g, i + 1)).join("")}</ul><p class="auc-src">법원경매정보 기준(${asOf}) · 2주 안 기일은 매일 갱신, 그 밖은 마지막으로 확인한 정보 · 번호 = 지도의 경매 표시</p>`;
    }
    function auctionHTML(r) {
      loadAuc();
      // 'N건' = 사건(카드) 수 · 물건이 더 많으면 '물건 M개'를 덧붙인다(칩 '경매 N건'과 같은 셈)
      const xs = aucOf(r), up = xs.filter((o) => aucSt(o) === "up"), n = aucGroups(up).length, ni = up.length, m = aucGroups(xs.filter((o) => aucSt(o) !== "up")).length;
      return `<div class="sect auc" id="aucSec" data-id="${esc(r.id)}"><h3>경매 물건 ${n ? `<span class="auc-n" data-cases="${n}">예정 ${n}건${ni > n ? ` · 물건 ${ni}개` : ""}</span>` : ""}${m ? `<span class="auc-n c">확인 중 ${m}건</span>` : ""}<small>구역 경계 안 필지</small></h3>
        <div class="auc-b" aria-live="polite">${aucBody(r)}</div>
        <p class="auc-nt">경매로 사도 권리산정기준일·조합원 지위 양도 제한은 똑같이 적용되고, 현금청산 대상이면 입주권이 없어요.</p></div>`;
    }
    function bindAuction() {
      const s = $("aucSec");
      if (!s || AUC) return;
      loadAuc().then(() => { const s2 = $("aucSec"), r = byId[s2 && s2.dataset.id]; if (s2 && r) s2.outerHTML = auctionHTML(r); aucMapSync(); });
    }
    // 카드로 가기(지도 표시·칩): 거래 탭으로 바꾸고 그 카드(번호 k, 없으면 블록)로. 묶음 카드는 펼친다
    function aucGo(k) {
      let tries = 0;
      const go = () => {
        const c = k ? $("aucC-" + k) : null, s = c || $("aucSec");
        if (!s) { if (tries++ < 25) setTimeout(go, 100); return; }
        const d = c && c.querySelector("details"); if (d) d.open = true;
        s.scrollIntoView({ behavior: smooth(), block: "start" });
        if (c) { c.classList.add("auc-hl"); setTimeout(() => c.classList.remove("auc-hl"), 1600); }
      };
      if (curTab !== "tx" && $("tab-tx")) { setTab("tx"); requestAnimationFrame(go); } else go();
    }
    // ---------- 지도에 경매 물건 표시(10_lmap 지도에 소스·레이어만 얹는다: 고른 구역은 번호 점, 줌 14부터는 다른 구역도 작은 점) ----------
    const AUCL = ["auc-o", "auc-s", "auc-sn"];
    const aucDark = () => { const t = document.documentElement.dataset.theme; return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
    function aucFeatures() {
      const F = new Map(), sel = cur && cur.id;
      if (!AUC || !AUC.ok || !AUC.byZone) return [];
      const num = {};
      if (sel && byId[sel]) aucOrd(aucOf(byId[sel])).forEach((g, i) => g.forEach((o) => (num[`${o.cs}#${o.no || 1}`] = i + 1)));
      for (const [z, v] of Object.entries(AUC.byZone)) {
        if ((AUC.miss || []).includes((byId[z] || {}).g)) continue;
        for (const o of v) {
          if (!o.ll) continue;
          // 같은 땅(지번)은 점 하나: 고른 구역이면 그 땅 사건 번호들을 '1·2'로
          const ik = `${o.cs}#${o.no || 1}`, key = aucPk(o), f = F.get(key), nn = z === sel ? num[ik] || 0 : 0;
          if (f) { if (!f.properties.zs.includes(`|${z}|`)) f.properties.zs += z + "|"; if (nn) { f.properties.sel = 1; f._ns.add(nn); } if (aucSt(o) === "up") f.properties.c = 1; continue; }
          const nf = { type: "Feature", geometry: { type: "Point", coordinates: o.ll }, properties: { zs: `|${z}|`, z, sel: z === sel ? 1 : 0, n: 0, t: "", c: aucSt(o) === "up" ? 1 : 0 }, _ns: new Set(nn ? [nn] : []) };
          F.set(key, nf);
        }
      }
      return [...F.values()].map((f) => { const ns = [...f._ns].sort((a, b) => a - b); f.properties.n = ns[0] || 0; f.properties.t = ns.join("·"); delete f._ns; return f; });
    }
    let aucMapB = null;
    function aucMapLayers(map) {
      if (!map.isStyleLoaded || !map.getStyle()) return;
      const dk = aucDark(), C = dk ? "#5b7fe6" : "#14275E", W = dk ? "#11161D" : "#ffffff";
      if (!map.getSource("auc")) map.addSource("auc", { type: "geojson", data: { type: "FeatureCollection", features: aucFeatures() } });
      const L = (o) => { if (!map.getLayer(o.id)) map.addLayer(o, undefined, { validate: false }); };
      L({ id: "auc-o", type: "circle", source: "auc", minzoom: 14, filter: ["!=", ["get", "sel"], 1], paint: { "circle-radius": 4.5, "circle-color": C, "circle-stroke-color": W, "circle-stroke-width": 1.5, "circle-opacity": ["case", ["==", ["get", "c"], 1], 0.95, 0.45], "circle-stroke-opacity": ["case", ["==", ["get", "c"], 1], 1, 0.5] } });
      L({ id: "auc-s", type: "circle", source: "auc", filter: ["==", ["get", "sel"], 1], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["case", [">", ["length", ["get", "t"]], 2], 9, 6], 15, ["case", [">", ["length", ["get", "t"]], 2], 13, 9]], "circle-color": C, "circle-stroke-color": W, "circle-stroke-width": 2, "circle-opacity": ["case", ["==", ["get", "c"], 1], 1, 0.55] } });
      L({ id: "auc-sn", type: "symbol", source: "auc", filter: ["all", ["==", ["get", "sel"], 1], [">", ["get", "n"], 0]], layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 15, 11], "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#ffffff" } });
      // 구역 이름표(zone-lab) 밑으로: 360px에서 경매 점이 '화곡동 1087' 같은 이름을 덮었다 — 이름표가 위, 점은 그 아래(이름표 밖으로 보임)
      const bf = map.getLayer("zone-lab") ? "zone-lab" : undefined;
      for (const id of AUCL) if (map.getLayer(id)) try { map.moveLayer(id, bf); } catch (e) {}
      try { map.setPaintProperty("auc-o", "circle-color", C); map.setPaintProperty("auc-s", "circle-color", C); map.setPaintProperty("auc-o", "circle-stroke-color", W); map.setPaintProperty("auc-s", "circle-stroke-color", W); } catch (e) {}
    }
    function aucLegend(map) {
      const on = map && !$("lmap").hidden && AUC && AUC.ok && (map.getZoom() >= 14 || (cur && aucOf(cur).some((o) => o.ll)));
      let el = $("lmAucLg");
      const host = ($("mapbox") && $("mapbox").querySelector(".s-rail-w")) || $("lmap");
      if (!el && on && host) { el = document.createElement("p"); el.id = "lmAucLg"; el.className = "lm-auc-lg"; el.innerHTML = `<i aria-hidden="true"></i>경매 물건`; }
      if (el && host && el.parentNode !== host) host.appendChild(el);
      if (el) el.hidden = !on;
    }
    function aucMapSync() {
      const L = window.__lmx, map = L && L.map && L.map();
      if (!map) return;
      if (aucMapB !== map) {
        aucMapB = map;
        const re = () => { try { aucMapLayers(map); aucLegend(map); } catch (e) {} };
        map.on("styledata", () => { if (!map.getLayer("auc-s")) re(); });
        map.on("zoomend", () => aucLegend(map));
        // 표시를 누르면: 그 구역 리포트의 그 카드로(지도 구역 클릭이 먼저 구역을 고른다)
        const hit = (e) => {
          const f = e.features && e.features[0]; if (!f) return;
          const zs = String(f.properties.zs || "").split("|").filter(Boolean), z = cur && zs.includes(cur.id) ? cur.id : zs[0];
          setTimeout(() => {
            if (!cur || cur.id !== z) { curTab = "tx"; select(z, false, false, { scroll: !MQ_SHEET.matches }); }
            setTimeout(() => { const ff = aucFeatures().find((x) => x.properties.sel && String(x.geometry.coordinates) === String(f.geometry.coordinates)); aucGo(ff ? ff.properties.n : 0); }, 120);
          }, 60);
        };
        ["auc-s", "auc-o"].forEach((l) => { map.on("click", l, hit); map.on("mouseenter", l, () => (map.getCanvas().style.cursor = "pointer")); map.on("mouseleave", l, () => (map.getCanvas().style.cursor = "")); });
      }
      // 경매 물건 표시는 지도가 바탕까지 다 그리고(자리 그림이 걷힌 뒤) 브라우저가 한가할 때 받는다(첫 화면·지도 붙이기와 겹치지 않게 · 19차)
      const go = () => loadAuc().then(() => { try { aucMapLayers(map); const s = map.getSource("auc"); if (s) s.setData({ type: "FeatureCollection", features: aucFeatures() }); aucLegend(map); } catch (e) {} });
      const idle = () => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 5000 }) : setTimeout(go, 1500));
      const w = () => { if (window.ZP_G && ZP_G.on()) { setTimeout(w, 600); return; } idle(); };
      if (AUC) go(); else if (map.loaded()) w(); else map.once("idle", w);
    }
    // 지도가 늦게 생기므로: 리포트를 그릴 때·처음 몇 초 동안 붙여 본다
    { let n = 0; const t = setInterval(() => { const L = window.__lmx; if ((L && L.map && L.map()) || ++n > 60) { clearInterval(t); aucMapSync(); } }, 1000); }
    // 리포트 머리에 '경매 N건' 칩(예정 물건이 있을 때만) → 누르면 거래 탭의 경매 물건 블록으로
    try {
      const _rrA = renderReport;
      renderReport = function () {
        const x = _rrA.apply(this, arguments);
        const r0 = cur;
        try { aucMapSync(); } catch (e) {}
        loadAuc().then(() => {
          if (cur !== r0 || !r0) return;
          const h = document.querySelector("#report .rep-head");
          const n = aucUp(r0);   // 칩은 매각기일이 앞에 있는 물건만 센다
          if (!h || !n || h.querySelector(".auc-chip")) return;
          // 주소 줄(구 동 · 역 · 경사 칩) 끝에 붙인다 — 없으면 머리 끝
          const w = h.querySelector(".where");
          const ni = aucUpX(r0).length;
          const b = `<button type="button" class="auc-chip" data-cases="${n}" title="이 구역 안 매각기일이 잡힌 법원경매 ${n}건${ni > n ? `(물건 ${ni}개)` : ""} 보기">경매 ${n}건</button>`;
          if (w) w.insertAdjacentHTML("beforeend", b); else h.insertAdjacentHTML("beforeend", `<div class="auc-cw">${b}</div>`);
          h.querySelector(".auc-chip").onclick = () => aucGo(0);
        });
        return x;
      };
    } catch (e) {}

    // ---------- 주소로 물건 확인 ----------
    function addrHTML(r) {
      if (!r.pcl || r.src === "moa") return `<div class="sect acheck"><h3>매물 지번으로 확인</h3><p class="note">${esc(ZF.bndTxt(r, "지번별 경계 판정을 할 수 없어요"))}. 구청 도시정비과에 구역계 도면을 확인하세요.</p></div>`;
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
              : rdY && yr > rdY ? `<li class="bad"><b>${yr}년 준공 · 권리산정기준일(${esc(ri.d)}) 뒤 <em class="dg-est">추정·확인 필요</em></b> 기준일 뒤 신축이면 입주권이 안 나오거나 나눠 받을 수 있어요.</li>`
              : rdY && yr === rdY ? `<li class="warn"><b>${yr}년 준공 · 기준일과 같은 해 <em class="dg-est">추정·확인 필요</em></b> 사용승인일이 ${esc(ri.d)} 전인지 건축물대장으로 확인하세요.</li>`
              // 사이클 2: ✓는 확정 근거(기준일이 정해졌고 그 전 준공)일 때만 · 기준일 미확정이면 ?(회색) · 연도 하드코딩·'10년 이하 신축' 경험칙은 뺌 · '추정·확인 필요'
              : rdY ? `<li class="ok"><b>${yr}년 준공 · 권리산정기준일(${esc(ri.d)}) 전 <em class="dg-est">추정·확인 필요</em></b> 연도 기준이라 사용승인일·등기일을 건축물대장으로 확인하세요.</li>`
              : `<li class="na"><b>${yr}년 준공 <em class="dg-est">추정·확인 필요</em></b> 권리산정기준일이 정해지지 않아 견줄 수 없어요. 기준일 고시 뒤 그 전 준공인지가 중요해요.</li>`;
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
      b.type = "button"; b.className = "btn secondary sm more-b"; b.textContent = `더 보기 (${rows.length - n}건)`; b.setAttribute("aria-expanded", "false");
      b.onclick = () => { const open = b.getAttribute("aria-expanded") !== "true"; rows.slice(n).forEach((x) => (x.hidden = !open)); b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "접기" : `더 보기 (${rows.length - n}건)`; };
      box.appendChild(b);
    }

    // ---------- 실거래 탭 ----------
    function chartSVG(r, q, lab) {
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
      return `<svg class="txc" viewBox="0 0 ${W} ${H}" role="img" aria-label="분기별 ${lab || "대지 3.3㎡당"} 가격 가운데 값 추이${ms.length ? "와 인가 시점" : ""}">
        ${ticks.map((y) => `<line x1="${X(y).toFixed(1)}" x2="${X(y).toFixed(1)}" y1="${pt}" y2="${H - pb}" class="g"/><text x="${X(y).toFixed(1)}" y="${H - 6}" class="x">${y}</text>`).join("")}
        ${ms.map(([k, t]) => `<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${pt - 6}" y2="${H - pb}" class="m"/><text x="${(X(t) + 3).toFixed(1)}" y="${pt - 4}" class="mt">${k}</text>`).join("")}
        <path d="${area}" class="a"/><path d="${line}" class="l"/>
        ${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${p[2][2] >= 5 ? 3 : 2}" class="d"><title>${p[2][0]} · ${eok(p[2][1])} · ${p[2][2]}건</title></circle>`).join("")}
        <text x="${(pts[pts.length - 1][0] - 2).toFixed(1)}" y="${(pts[pts.length - 1][1] - 7).toFixed(1)}" class="v" text-anchor="end">${eok(vs[vs.length - 1])}</text></svg>`;
    }
    const qT = (s) => 2000 + +s.slice(0, 2) + (+s.slice(3) - 1) / 4;
    // 실거래 머리글 기준(tools/tx.py headline): v 빌라·단독 대지 · a 아파트 전용 · i 입주권 전용
    const HDB = { v: "빌라·단독 대지", a: "아파트 전용", i: "입주권 전용" };
    const hdWin = (h) => (h.w === 0 ? "가장 최근 1건" : `최근 ${h.w === 24 ? "2년" : "1년"} ${fmt(h.n)}건`);
    // 머리 '거래 전체 보기 →'가 가리키는 매수가 표본(주변 300m 빌라 n건 등)을 거래 탭에서도 같은 값·같은 말로
    function smpBig(r) {
      let S = null; try { S = ZF.sample(r); } catch (e) {}
      if (!S || !S.n || !(S.med > 0)) return "";
      try { if (noTicket(r)) return ""; } catch (e) {}   // 입주권 없는 곳: 계산 매수가 표본이 없다(계산 보류)
      const en = r.mk.entry, iq = en.p25 && en.p75 && S.n >= 3 ? ` · 가운데 50% ${eok(en.p25)}~${eok(en.p75)}` : "";
      return `<div class="bigrow"><div class="big"><span>매수가 표본 · ${esc(S.text.replace(/\(.*\)$/, ""))}</span><b>${ZF.manT(S.med / 1e4)}</b><small>${esc(S.text)}${en.area_med ? ` · 전용 ${en.area_med}㎡ 안팎` : ""}${iq}${S.last ? ` · 마지막 ${esc(S.last)}` : ""} · 머리 숫자·계산 매수가와 같은 표본</small></div></div>`;
    }
    function noTxHTML(r, t, z) {
      const nb = r.tag === "mk" || r.nx === "mk" ? null : t.nb;   // 시장·상가 정비는 빌라 시세를 쓰지 않는다
      // 제목만 남지 않게: 안내 문장은 note 클래스가 아닌 문단(간단 보기에서도 보임)
      return `<div class="sect tx-none"><p style="margin:4px 0 8px;color:var(--text-2)">${(z && !z.e) || r.pcl || !GEO_Z ? "최근 구역 안 매매·전세 신고가 없어요." : ZF.bndTxt(r, "경계 안 거래만 따로 모을 수 없어요") + "."}${r.ll ? " 주변 시세는 '입지' 탭 아래 KB부동산 링크에서 볼 수 있어요." : ""}</p>${nearOf(r) ? "" : smpBig(r)}${nb && nb.n ? `<div class="bigrow"><div class="big"><span>같은 동${nb.dong ? `(${esc(nb.dong)})` : ""} 빌라 매매 가운데 값 · 참고</span><b>${eok(nb.med)}</b><small>최근 1년 ${fmt(nb.n)}건 · 구역 밖 거래 포함</small></div></div>` : ""}</div>`;
    }
    // 거래 탭 = 실거래(paneTx0) + 맨 아래 경매 물건 블록
    function paneTx(r) {
      paneTx0(r);
      const p = $("pane");
      if (!p || p.querySelector("#aucSec") || /불러오는 중/.test(p.textContent.slice(0, 40))) return;
      p.insertAdjacentHTML("beforeend", auctionHTML(r));
      bindAuction();
      try { window.ZP_feat && window.ZP_feat.hook("tx", r); } catch (e) {}   // renew-feat F5: 가격 흐름(산점도·전세가율·분기 가운데 값)
    }
    function paneTx0(r) {
      const p = $("pane"), z = GEO_Z && GEO_Z[r.id];
      if (!TXD || !NRD) { p.innerHTML = `<p class="note">구역 실거래를 불러오는 중…</p>`; Promise.all([loadTx(), loadNear()]).then(() => { if (cur === r && curTab === "tx" && $("pane")) paneTx(r); }); return; }
      const z0 = TXD[r.id] || {}, S = Array.isArray(z0.s) ? z0.s : [], J = Array.isArray(z0.j) ? z0.j : [];
      const t = { ...(r.tx || {}), ...(z0.x || {}) }, h = t.hd && t.hd.u ? t.hd : null;
      const rdx = rights(r);
      if (!h && !S.length && !J.length && !nearOf(r)) {   // 거래가 없으면 짧게(필지·노후도만 따로) — 주변 매수가 표본이 있으면 아래에서 그 표를 보인다
        p.innerHTML = noTxHTML(r, t, z) + (rdx.k === "set" ? rightsHTML(r, true) : "");
        return;
      }
      const pc = t.pc, age = t.age || {}, agn = t.agn || {};
      const x = (() => { try { return invest(r); } catch (e) { return {}; } })();
      const en = r.mk?.entry;
      const per = h ? `${HDB[h.b]} 3.3㎡당` : "";
      const big = [];
      // 표본을 이름에 박는다: 위 머리 큰 숫자(매수가 표본 · 주변 300m 등)와 다른 표본이라 같은 '대지 3.3㎡당'이 두 값으로 보이지 않게
      // 18차: 위 '실거래' 머리(매수가 표본)가 큰 숫자 하나 — 구역 안 거래 기준 3.3㎡당은 '다른 기준 보기'에 접어 둔다(큰 숫자 둘 X)
      let S0 = null; try { S0 = ZF.sample(r); } catch (e) {}
      const mainS = !!(S0 && S0.n && S0.med > 0), hb = [];
      if (h) (mainS && h.b === "v" ? hb : big).push(`<div class="big hl"><span>${per} · ${h.n === 1 || h.w === 0 ? "구역 안 거래 1건" : `구역 안 ${fmt(h.n)}건 가운데 값`}</span><b>${eok(h.u)}</b><small>${hdWin(h)} · ${esc(ymd2(h.from))}${h.from !== h.to ? "~" + esc(ymd2(h.to)) : ""}${h.st ? ' · <em class="flag">오래된 거래</em>' : ""}${h.xo ? ` · 시세와 크게 다른 ${h.xo}건 제외` : ""}${h.xn ? ` · 2016년 이후 신축·대지 10㎡ 미만 ${h.xn}건 제외` : ""}</small></div>`);
      if (h && h.b !== "v") big.push(`<div class="big"><span>${h.b === "i" ? "입주권" : "아파트"} 거래가 가운데 값</span><b>${eok(h.p)}</b><small>같은 ${fmt(h.n)}건 · 전용 ${h.pa}㎡ 가운데</small></div>`);
      else if (t.med) big.push(`<div class="big"><span>구축 빌라 매매 가운데 값</span><b>${eok(t.med)}</b><small>2015년 이전 준공 빌라 최근 ${t.nwin || 18}개월 ${fmt(t.no)}건 · 전용 ${t.ar}㎡ · 대지 ${t.ld}㎡</small></div>`);
      if (t.jm) big.push(`<div class="big"><span>빌라 전세 가운데 값</span><b>${eok(t.jm)}</b><small>${t.jy ? `${t.jy[0] === t.jy[1] ? t.jy[0] : t.jy[0] + "~" + t.jy[1]}년 준공(매매 표본과 같은 연식) ` : ""}전세 ${fmt(t.jn)}건 · 임대 ${t.ja}㎡${t.jr ? ` · 전세가율 ${Math.round(t.jr * 100)}%` : t.jr2 ? ` · 전세가율 약 ${Math.round(t.jr2 * 100)}%` : ""}${(() => {
        // 전세 표본과 매수가 표본은 면적이 달라 바로 빼면 안 된다 → 계산에 쓴 전세(전세가율)를 함께
        try { const g = gapOf(r), am = en && en.area_med, dif = am && t.ja && Math.abs(t.ja - am) / am > 0.15; if (!g || g.block || g.na || !(g.D > 0)) return ""; return `${dif ? ` · 매수가 표본(전용 ${am}㎡)과 면적이 달라 직접 비교 불가` : ""} · 계산엔 전세 ${ZF.cash(g.D)}(전세가율 ${fmt(g.jr, 1)}%)`; } catch (e) { return ""; }
      })()}</small></div>`);
      const villaSec = h && h.b === "v";
      const ageOk = villaSec && ["a", "b", "c"].some((k) => age[k] != null);
      const doneI = h && h.b === "i" && r.s >= 9;
      // 유형 이름: 준공(s>=9) 구역의 '입주권' 신고는 보존등기 전 아파트 거래라 '아파트(입주권 신고)'
      const TY = ["빌라", "단독", "아파트", r.s >= 9 ? "아파트(입주권 신고)" : "입주권"];
      const rdY = rdx.k === "set" ? +rdx.d.slice(0, 4) : null;
      // 아파트·입주권: 같은 유형·전용 ±10㎡·앞뒤 1년 거래 가운데 값의 0.75~1.35배 밖이면 표시(머리글 이상치 기준과 같음)
      const dd = (v) => Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8));
      // 빌라·단독: 대지 3.3㎡당이 구역 빌라 거래 가운데 값의 20% 아래면(대지 지분 오기·큰 필지 공유 지분) 시세와 다른 거래로(tools/near.py 표본 기준과 같음)
      const lu = S.filter((w) => w[1] <= 1 && w[4] > 0).map((w) => w[5] / w[4]).sort((a, b) => a - b);
      const luM = lu.length >= 3 ? (lu.length % 2 ? lu[lu.length >> 1] : (lu[lu.length / 2 - 1] + lu[lu.length / 2]) / 2) : null;
      const odd = (v) => {
        if (v[1] <= 1) return !!(luM && v[4] > 0 && v[5] / v[4] < luM * 0.2);
        if (v[1] < 2 || !(v[3] > 0)) return false;
        const u = (w) => w[5] / w[3], band = S.filter((w) => w[1] === v[1] && w[3] > 0 && Math.abs(w[3] - v[3]) <= 10 && Math.abs(dd(w[0]) - dd(v[0])) <= 365 * 864e5).map(u).sort((a, b) => a - b);
        if (band.length < 3) return false;
        const m = band.length % 2 ? band[band.length >> 1] : (band[band.length / 2 - 1] + band[band.length / 2]) / 2;
        return u(v) < 0.75 * m || u(v) > 1.35 * m;
      };
      const flr = (v) => (v[6] ? ` ${+v[6] < 0 ? "지하" + -v[6] : esc(String(v[6]))}층` : "");
      const flag = (v) => (rdY && v[2] > rdY && v[1] <= 1 ? ' <em class="flag" title="권리산정기준일 뒤 준공">기준일 뒤 준공</em>' : odd(v) ? ' <em class="flag" title="같은 면적대 시세와 크게 달라 큰 숫자·추이 계산에서 뺀 거래(직거래·특수관계 등일 수 있어요)">시세와 다름</em>' : "");
      // 빌라·단독(대지 3.3㎡당)과 아파트·입주권(전용 3.3㎡당)은 기준이 달라 표를 나눈다
      // 좁은 화면(360px)에서도 가로로 잘리지 않게 3칸: [계약일 · 유형 층 / 준공 · 전용 · 대지] [가격] [3.3㎡당]
      const SV = S.filter((v) => v[1] <= 1), SA = S.filter((v) => v[1] >= 2);
      const TS = ' style="min-width:0;table-layout:auto"', C1 = ' style="white-space:normal"', SM = ' style="display:block;font-size:11.5px;color:var(--text-3);margin-top:2px"';
      const row = (v, land) => `<tr><td${C1}>${ymd2(v[0])} · ${TY[v[1]]}${flr(v)} · <span style="white-space:nowrap">${land ? (v[4] ? `대지 ${v[4]}㎡` : `전용 ${v[3]}㎡`) : `${v[3]}㎡`}</span>${flag(v)}<small${SM}>${v[2] ? v[2] + "년 준공" : "준공 미상"}${land && v[4] ? ` · 전용 ${v[3]}㎡` : ""}</small></td><td class="n"><b>${eok(v[5])}</b></td><td class="n">${land ? (v[4] > 0 ? eok(Math.round((v[5] / v[4]) * 3.3058)) : "–") : v[3] > 0 ? eok(Math.round((v[5] / v[3]) * 3.3058)) : "–"}</td></tr>`;
      const head = (land) => `<thead><tr><th scope="col">계약일 · 유형</th><th scope="col" class="n">가격</th><th scope="col" class="n">${land ? "대지" : "전용"} 3.3㎡당</th></tr></thead>`;
      // 같은 면적대 시세와 크게 다른 거래(머리글·추이 계산에서 뺀 것)는 맨 위에 올리지 않고 접어 둔다
      const split = (L) => { const a = [], o = []; L.slice(0, 40).forEach((v) => (odd(v) ? o : a).push(v)); return [a, o]; };
      const tbl = (L, land, id) => {
        if (!L.length) return "";
        const [a, o] = split(L);
        const main = a.length ? `<div id="${id}" class="txl"><table class="tx"${TS}>${head(land)}<tbody>${a.map((v) => row(v, land)).join("")}</tbody></table></div>` : "";
        const off = o.length ? `<details class="tx-odd" style="margin-top:8px"><summary style="cursor:pointer;font-size:13px;color:var(--text-2)">시세와 다른 거래 ${o.length}건</summary><div class="txl"><table class="tx" style="min-width:0;opacity:.75">${head(land)}<tbody>${o.map((v) => row(v, land)).join("")}</tbody></table></div></details>` : "";
        return main + off;
      };
      const tblV = tbl(SV, true, "txListV"), tblA = tbl(SA, false, "txListA");
      const scope = t.m === "jibun" ? "대표지번과 같은 본번" : t.m === "name" ? `단지 이름으로 찾은 ${esc((t.cx && t.cx.nm) || "같은 단지")}` : "구역 경계 안";
      const nearB = !!(r.mk && r.mk.entry && r.mk.entry.src === "villa" && (r.mk.entry.radius || 0) >= 100);
      const secV = tblV ? `<div class="sect"><h3>최근 매매 · ${scope === "구역 경계 안" ? "구역 안 " : ""}빌라·단독 <small>${scope} · 대지 3.3㎡당 · 국토부 신고 기준${nearB ? " · 계산 매수가 표본 아님(참고)" : h && h.b === "v" ? " · 위 큰 숫자 기준" : ""}</small></h3>${tblV}</div>` : "";
      const aLab = SA.some((v) => v[1] === 2) && SA.some((v) => v[1] === 3) ? `아파트·${TY[3]}` : SA.some((v) => v[1] === 3) ? TY[3] : "아파트";
      const secA = tblA ? `<div class="sect"><h3>최근 매매 · ${scope === "구역 경계 안" ? "구역 안 " : ""}${aLab} <small>${scope} · 전용 3.3㎡당 · 국토부 신고 기준${h && h.b !== "v" ? " · 위 큰 숫자 기준" : ""}</small></h3>${tblA}</div>` : "";
      const salesSecs = h && h.b !== "v" ? secA + secV : secV + secA;
      // 매수가 표본(주변 빌라): 머리 큰 숫자·'이 숫자 믿어도 될까'·계산 매수가가 쓰는 바로 그 거래들, 새 거래부터
      const nz = nearOf(r), nen = r.mk && r.mk.entry;
      let ntR = false; try { ntR = noTicket(r); } catch (e) {}   // 23차: 입주권 없는 곳은 '계산 매수가'라 부르지 않는다(머리·돈 탭 '계산 보류'와 같게)
      const secN = nz ? (() => {
        const rowN = (v) => `<tr><td${C1}>${ymd2(v[0])} · 빌라${v[5] ? ` ${+v[5] < 0 ? "지하" + -v[5] : esc(String(v[5]))}층` : ""} · <span style="white-space:nowrap">전용 ${v[1]}㎡</span><small${SM}>${esc(v[6])} · ${v[7] ? `경계에서 ${fmt(v[7])}m` : "구역 안"} · ${v[3]}년 준공${v[2] > 0 ? ` · 대지 ${v[2]}㎡` : ""}</small></td><td class="n"><b>${eok(v[4])}</b></td><td class="n">${v[2] > 0 ? eok(Math.round((v[4] / v[2]) * 3.3058)) : "–"}</td></tr>`;
        return `<div class="sect nearsmp"><h3>매수가 표본 · 주변 ${fmt(nz.r)}m 빌라 ${fmt(nz.s.length)}건</h3><p class="nz-def">${ntR ? "주변 빌라 매매" : "계산 매수가"} <b>${ZF.manT(nen.med / 1e4)}</b> = 아래 ${fmt(nz.s.length)}건의 가운데 값${ntR ? " · 참고(지금 사면 입주권이 없어 계산에는 안 써요)" : ""} · 새 거래부터 · 최근 ${nz.w}개월 · ${nen.yr_cap || 2010}년 이전 준공 · 전용 30~70㎡ · 구역 경계에서 ${fmt(nz.r)}m 안(경계 안 포함)</p><div id="txListN" class="txl"><table class="tx"${TS}><thead><tr><th scope="col">계약일 · 위치</th><th scope="col" class="n">가격</th><th scope="col" class="n">대지 3.3㎡당</th></tr></thead><tbody>${nz.s.reduce((a, v) => { const k = v.join("|"), l = a[a.length - 1]; if (l && l.k === k) l.n++; else a.push({ k, v, n: 1 }); return a; }, []).map(({ v, n }) => rowN(v).replace("</small></td>", `${n > 1 ? ` · 같은 조건 ${n}건` : ""}</small></td>`)).join("")}</tbody></table></div></div>`;
      })() : "";
      const calcNote = (() => {
        if (x.price == null || ntR) return "";
        const LCW = { n: "매수가 표본이 3건 미만이라", old: "매수가에 쓴 거래가 1년 넘게 지난 것이라", thin: "구역 안 거래가 1~2건뿐이고 1년 넘게 지나 주변 시세로 정한 값을 확인할 수 없어" };
        const lc = en && en.lc && x.priceSrc !== "user" ? ` <em class="flag">참고값</em> ${LCW[en.lcw] || `구역 안 비교 거래가 적거나 구역 거래 구성(${h && h.b === "a" ? "아파트 위주" : "표본 적음"})과 달라`} '갈 수 있는 곳' 순위에서는 빼요.` : "";
        const warn = x.priceSrc !== "user" && en?.fill !== "zone" && en?.fill !== "zoneapt" && t.no
          ? `<p class="note warnbox"><b>계산은 다른 값을 써요</b> ${r.src === "moa" ? "모아타운 관리지역은 블록별로 사업이 따로 진행돼, 관리지역 전체가 아니라 주변 빌라 시세로 계산했어요." : en?.src === "complex" ? "재건축 단지라 같은 단지 아파트 매매로 계산했어요." : `구역 안 구축 빌라 매매(최근 ${t.nwin || 18}개월 ${t.no}건)가 기준(5건)에 못 미쳐 주변 빌라 시세로 계산했어요.`} 실제 매물가는 '돈' 탭에 넣어 다시 계산하세요.</p>` : "";
        // 머리 카드·/z/ 페이지와 같은 한 문장(64_overview.js OVX.smp)
        const one = typeof OVX !== "undefined" && OVX.smp && x.priceSrc !== "user" ? OVX.smp(r, x) : "";
        if (one) return `${warn}<p class="note"><b>계산 매수가 ${OVX.manT(x.price)}</b> = ${esc(one)} · '돈' 탭에서 바꿀 수 있어요${lc}</p>`;
        return `${warn}<p class="note"><b>계산에 쓴 매수가 ${ZF.cash(x.price)}</b> ${x.priceSrc === "user" ? "직접 입력한 값" : en?.scope ? esc(en.scope) + ` 실거래 가운데 값${en.n ? ` (${fmt(en.n)}건${en.area_med ? ` · 전용 ${en.area_med}㎡` : ""})` : ""}` : x.priceSrc === "complex" ? "같은 단지 아파트 실거래" : "구역 주변 구축 빌라 실거래"} · '돈' 탭에서 바꿀 수 있어요${lc}</p>`;
      })();
      p.innerHTML = `
        ${h || S.length ? "" : noTxHTML(r, t, z) + secN}
        ${big.length ? `<div class="bigrow${big.length >= 2 ? " b3" : ""}">${big.join("")}</div>` : ""}
        ${hb.length ? `<details class="sect ov-alt tx-alt"><summary><h3>다른 기준 보기 · 구역 안 거래 ${h.n === 1 || h.w === 0 ? "1건" : fmt(h.n) + "건"} 3.3㎡당 <small>위 큰 숫자(매수가 표본)와 기준이 달라요</small></h3></summary><div class="bigrow">${hb.join("")}</div></details>` : ""}
        ${h && h.st ? `<p class="note warnbox"><b>오래된 거래</b> 위 값은 ${esc(ymd(h.to))} 거래 1건이에요. 1년 넘게 같은 기준 거래가 없어 지금 시세와 다를 수 있어요.</p>` : ""}
        ${doneI ? `<p class="note"><b>준공한 단지예요</b> 입주는 끝났지만 이전고시·소유권 보존등기 전이라 실거래 신고상 '입주권'으로 올라와요.</p>` : ""}
        ${calcNote}
        ${ageOk ? `<details class="sect ov-alt"><summary><h3>다른 기준 보기 · 연식별 대지 3.3㎡당 <small>구역 안 빌라·단독 전체 기간이라 위 큰 숫자와 기준이 달라요 · 권리산정기준일 뒤 신축이면 입주권이 문제될 수 있어요</small></h3></summary><dl class="facts">
          ${[["a", "10년 이하"], ["b", "11~30년"], ["c", "31년 이상"]].filter(([k]) => age[k] != null).map(([k, l]) => `<div><dt>${l}</dt><dd>${eok(age[k])}<small>${agn[k] || 0}건</small></dd></div>`).join("")}
</dl></details>` : ""}
        ${t.old && t.old.k && r.s < 7 ? `<div class="sect"><h3>노후도 <small>구역 경계 안 건축물 ${fmt(t.old.n)}동 전수 · 사용승인연도 확인 ${fmt(t.old.k)}동 · 서울도시공간포털 건물 정보(사용승인 2022년까지 반영)</small></h3><div class="oldbar" role="img" aria-label="노후·불량 건축물 ${t.old.pol}%, 기준선 60%"><i style="width:${t.old.pol}%"></i><s style="left:60%"></s></div><dl class="facts"><div><dt>노후·불량 건축물</dt><dd>${t.old.pol}%<small>철근콘크리트·철골조 30년, 그 밖의 구조 20년 이상(서울 조례 기준 단순화) · 구역지정 요건 60% 이상</small></dd></div><div><dt>30년 이상 건물</dt><dd>${t.old.p30}%<small>평균 ${t.old.avg}년 된 건물</small></dd></div><div><dt>10년 이하 신축</dt><dd>${fmt(t.old.new10)}동<small>권리산정기준일 뒤 신축이면 입주권 문제 확인</small></dd></div></dl></div>` : ""}
        ${pc ? `<div class="sect"><h3>구역 필지 현황 <small>서울도시공간포털 연속지적 ${fmt(pc.n)}필지 · 합계 ${fmt(pc.ar)}㎡</small></h3><dl class="facts">
          <div><dt>과소필지 (90㎡ 미만)</dt><dd>${pc.sm}%<small>도로·하천 제외 · 재개발 지정 요건 40% 이상</small></dd></div>
          <div><dt>국공유지</dt><dd>${pc.pub}%<small>필지 수 기준 · 많으면 무상양도 협의가 사업성에 영향</small></dd></div>
          <div><dt>도로 필지</dt><dd>${pc.rd}%<small>필지 수 기준</small></dd></div>
          ${pc.jm ? `<div><dt>지목 구성</dt><dd class="tx">${pc.jm.map(([k, v]) => `${esc(k)} ${fmt(v)}`).join(" · ")}</dd></div>` : ""}</dl></div>` : ""}
        ${h || S.length ? secN : ""}
        ${salesSecs}
        ${J.length ? `<div class="sect"><h3>최근 전세 <small>연립다세대</small></h3><div id="jList" class="txl"><table class="tx" style="min-width:0"><thead><tr><th scope="col">계약일</th><th scope="col" class="n">준공</th><th scope="col" class="n">임대 면적</th><th scope="col" class="n">보증금</th></tr></thead><tbody>${J.reduce((a, v) => { const k = v.join("|"), l = a[a.length - 1]; if (l && l.k === k) l.n++; else a.push({ k, v, n: 1 }); return a; }, []).slice(0, 20).map(({ v, n }) => `<tr><td>${ymd2(v[0])}${n > 1 ? ` <small class="mut">같은 조건 ${n}건</small>` : ""}</td><td class="n">${v[1] || "–"}</td><td class="n">${v[2]}㎡</td><td class="n"><b>${eok(v[3])}</b></td></tr>`).join("")}</tbody></table></div></div>` : ""}
        <p class="note src">자료: 서울시 부동산 실거래가·전월세가 정보(서울 열린데이터광장, 매매 ${esc(ymd(D.txAsOf?.sale))}·전세 ${esc(ymd(D.txAsOf?.rent))}까지), 정비구역 경계·필지 서울도시공간포털. 구역 경계 안 필지 번호와 맞춘 거래만 셉니다.</p>`;
      if ($("txListN")) moreRows($("txListN"), 5);
      if ($("txListV")) moreRows($("txListV"), 5);
      if ($("txListA")) moreRows($("txListA"), 5);
      if ($("jList")) moreRows($("jList"), 5);
    }

    // 지도 경계 데이터(경계 유무 판정용)
    let GEO_Z = null;
    const geoReady = () => { if (!GEO_Z && D.dv && D.dv.geo) LMX.geo().then((g) => { GEO_Z = g ? g.z : {}; }); };

    // ---------- 정보몽땅 최근 기록(다음 인가 선행 신호) ----------
    const SIG = [[/분양신청/, "관리처분인가가 가까워졌다는 신호(조합원 분양신청)"], [/총회개최/, "총회 개최"], [/인가신청|승인신청/, "다음 인가를 신청함"], [/업체선정/, "업체 선정"], [/공람|설명회/, "주민 공람·설명회"]];
    const evText = ZF.evText;   // 정보몽땅 원문 정리는 ZF 하나(단계 소식 화면과 같은 글)
    function evHTML(r) {
      const ev = r.ev;
      if (!Array.isArray(ev) || !ev.length) return "";
      const rows = ev.slice(0, 6).map(([d, sec, t]) => { const e = evText(r, d, sec, t), s = e.chg ? null : SIG.find(([re]) => re.test(String(t).replace(/\s/g, ""))); return `<li><span class="ev-d mono">${esc(d.replaceAll("-", "."))}</span><span class="ev-t"><b>${esc(sec)}</b> ${esc(e.txt)}${s ? ` <em class="ev-s">${esc(s[1])}</em>` : ""}</span></li>`; }).join("");
      return `<div class="sect evl"><h3>정비사업 정보몽땅 최근 기록 <small>추진경과 · 매일 갱신 · 인가 전 신청·총회가 먼저 올라와요</small></h3><ul>${rows}</ul>${r.cafe ? `<p class="note"><a href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl=${encodeURIComponent(r.cafe)}" target="_blank" rel="noopener">정보몽땅 사업장 원문 보기</a></p>` : ""}</div>`;
    }
    // ---------- 역전세 위험(전세 끼고 사기) ----------
    function rvjHTML(r) {
      const v = D.rvj && D.rvj[r.g];
      const hb = r.tx && r.tx.hd && r.tx.hd.b;
      if (hb === "a" || hb === "i" || /재건축/.test(r.k || "") || r.tag === "mk") return "";   // 연립·다세대 전세 지표라 아파트 기준 구역(재건축 등)에는 붙이지 않는다
      if (!v) return "";
      const lvl = v.down >= 15 || v.chg <= 0 ? "hi" : v.down >= 7 ? "mid" : "lo";
      const T = { hi: "주의", mid: "보통", lo: "낮음" };
      return `<div class="rvj ${lvl}"><div class="rvj-h"><b>역전세 위험 · ${esc(r.g)}</b><span>${T[lvl]}</span></div><p>최근 6개월 연립·다세대 전세 <b>갱신계약 ${fmt(v.n)}건</b> 중 보증금을 낮춘 곳 <b>${v.down}%</b>, 보증금 변화 가운데 값 <b>${v.chg > 0 ? "+" : ""}${v.chg}%</b>.</p><p class="note">전세를 끼고 사면 만기 때 보증금을 돌려줘야 할 수 있어요. ${lvl === "hi" ? "이 구는 보증금을 낮춰 재계약하는 비율이 높아, 전세 끼고 드는 돈에 여유 자금을 더 두세요." : "새 세입자가 더 낮은 보증금으로 들어올 경우를 대비해 여유 자금을 두세요."} 출처: 서울시 전월세 신고(종전 보증금).</p></div>`;
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
      // 규제 요약 목록(.dg-l)에 이미 '권리산정기준일' 줄이 있으면 같은 상자를 또 붙이지 않는다(일정 탭에는 그대로)
      const dupRd = [...p.querySelectorAll(".dg-l li b")].some((b) => /권리산정기준일/.test(b.textContent));
      const h = (dupRd ? "" : rightsHTML(r)) + addrHTML(r);
      if (first) first.insertAdjacentHTML("afterend", h); else p.insertAdjacentHTML("afterbegin", h);
      geoReady();
      bindAddr(r);
    };
    paneNear = function (r) {
      _near(r);
      const p = $("pane");
      const chk = p.querySelector(".chk3");
      const h = nearbyHTML(r);
      if (chk) chk.insertAdjacentHTML("beforebegin", h); else p.insertAdjacentHTML("beforeend", h);
      const hj = p.querySelector(".hjl"); if (hj) moreRows(hj.parentElement, 3);
      p.querySelectorAll(".nc-go").forEach((b) => (b.onclick = () => { curTab = "money"; select(b.dataset.go, false, false, { scroll: !MQ_SHEET.matches }); }));
    };
    return { chartSVG, paneTx, rights, rightsHTML, pace, loadPcl, geoReady, loadTx, loadNear, near: nearOf, moreRows, geoZ: () => GEO_Z };
  })();
  function paneTx(r) { ZX.geoReady(); ZX.paneTx(r); }
  // 매수가가 없을 때 이유(짧게 · 20자 안팎). 자세한 설명은 실거래·입주 현금 탭에
  function noPriceTxt(r) {
    if (!r) return "매수가 추정 불가";
    const en = r.mk && r.mk.entry, t = r.tx || {};
    if (r.nx === "biz") return "업무·상업 중심 · 입주권 계산 대상 아님";
    if (r.tag === "mk" || r.nx === "mk") return "시장·상가 정비 · 매수가 계산 전";
    // 관리처분(6)·이주·철거(7) 뒤: 거래가에 입주권 프리미엄이 섞여 자동 매수가를 쓰지 않는다(tools/enrich.py가 매수가를 비움) — 한 규칙
    if (r.s >= 7 && r.s < 9) return "이주·철거 후 · 매물가 직접 입력";
    if (r.s >= 6 && r.s < 9) return "관리처분 후 · 매물가 직접 입력";
    if (en && en.src === "villa" && r.k === "재건축") return "단지 거래 없음 · 매물가 직접 입력";
    if (r.k === "재건축" || r.k === "소규모재건축") return t.na ? "단지 매매 2년 2건 미만 · 추정 불가" : "단지 매매 신고 없음 · 추정 불가";
    if (!r.ll) return "위치 미공개 후보지 · 추정 불가";
    return "구축 빌라 매매 부족 · 추정 불가";
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
