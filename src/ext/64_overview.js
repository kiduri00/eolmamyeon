/* ===================== 구역 상세 맨 위: 위치 지도 · 실거래 · 노후도 =====================
   사람들이 제일 먼저 보는 것(어디인지, 얼마에 거래되는지, 얼마나 낡았는지)을 탭보다 먼저 보여 준다. */
const OVX = (() => {
  let mm = null, mmId = null;
  const ym = (d) => (d && d.length >= 6 ? `${d.slice(2, 4)}.${d.slice(4, 6)}` : "");
  const eok = ZF.eok;   // 숫자 꼴은 ZF 하나(05_facts.js)
  const e1 = (v) => (v == null || !isFinite(v) ? "–" : v >= 1e4 ? `${(v / 1e4).toFixed(1).replace(/\.0$/, "")}억` : `${Math.round(v).toLocaleString()}만`);
  // 노후도 게이지(반원): 기준선 60%
  function gauge(pct) {
    const R = 54, C = Math.PI * R, v = Math.max(0, Math.min(100, pct));
    const lv = v >= 60 ? "hi" : "lo";
    const ang = Math.PI * (1 - 0.6);
    const ox = 70 + Math.cos(ang) * (R + 10), oy = 66 - Math.sin(ang) * (R + 10);
    return `<svg class="ov-g ${lv}" viewBox="0 -12 140 92" role="img" aria-label="노후 건축물 ${v}%, 재개발 요건 60% 이상">
      <path d="M16 66a54 54 0 0 1 108 0" class="tr"/>
      <path d="M16 66a54 54 0 0 1 108 0" class="fg" stroke-dasharray="${(C * v / 100).toFixed(1)} ${C.toFixed(1)}"/>
      <line x1="${(70 + Math.cos(ang) * (R - 10)).toFixed(1)}" y1="${(66 - Math.sin(ang) * (R - 10)).toFixed(1)}" x2="${(70 + Math.cos(ang) * (R + 10)).toFixed(1)}" y2="${(66 - Math.sin(ang) * (R + 10)).toFixed(1)}" class="tk"/>
      <text x="${(ox + 3).toFixed(1)}" y="${(oy + 3).toFixed(1)}" class="tl">기준 60%</text>
      <text x="70" y="62" class="v">${v}<tspan>%</tspan></text></svg>`;
  }
  function oldHTML(t, r) {
    const o = t.old;
    if (!o || !o.k || r.s >= 7 || /재건축/.test(r.k)) return "";   // 재건축은 노후도 요건이 아니라 준공 30년 기준
    const ok = o.pol >= 60;
    return `<div class="ov-c ov-old"><div class="ov-gw">${gauge(o.pol)}<div class="ov-gs"><h3>노후도</h3><b class="${ok ? "ok" : "no"}">${ok ? "요건 충족" : "요건 미달"}</b><span>평균 ${Math.round(o.avg)}년${o.new10 ? ` · 신축 ${o.new10}동` : ""}</span></div></div></div>`;
  }

  // ---------- 판정: 입주권 · 전세 끼고 · 단계 (누르면 한 줄 이유) ----------
  const ymd = (d) => (d ? String(d).replaceAll("-", ".").slice(0, 10) : "");
  const curStep = (r) => { const T = tlSteps(r), i = T.reduce((a, s, k) => (s[1] <= r.s ? k : a), -1); return [T, i]; };
  // 지금 사면 입주권이 안 나오는 구역(목록 '주변 시세만 보기'와 같은 판정 · app.js noTicket)
  const noIpR = (r) => { try { return noTicket(r); } catch (e) { return false; } };
  const refTag = (r) => (noIpR(r) ? `<em class="ov-ref">참고용 · 사도 입주권 없음</em>` : "");
  function verdicts(r) {
    const out = [], fin = isDone(r); let noIp = false;
    if (!fin) {
      try {
        const w = buyWindow(r), rt = (() => { try { return ZX.rights(r); } catch (e) { return {}; } })();
        const [c, v] = w.cls === "ok" ? ["ok", "✓ 나와요"] : w.cls === "no" ? ["no", "✕ 안 나와요"] : ["warn", "! 확인 필요"];
        noIp = c === "no";
        out.push({ k: "지금 사면 입주권", c, v, w, why: () => [w.due || w.t, rt.k === "set" ? (rt.old ? `권리산정기준일 ${rt.d}(추정 · 조례 부칙 확인 필요)` : `권리산정기준일 ${rt.d} 전 건물만`) : ""].filter(Boolean).join(" · ") });
      } catch (e) {}
      if (!noIp) try {
        const lp = landPermit(r);
        let blk = null; try { blk = gapOf(r).block; } catch (e) { blk = typeof gapBlock === "function" ? gapBlock(r) : null; }
        // 아래 '전세 끼고 사기 불가' 카드·계산과 같은 판정(가능성 구역도 계산에서 빼므로 '불가')
        if (lp) out.push({ k: "전세 끼고", c: "no", v: "✕ 불가 · 토허 실거주 2년", why: () => (/가능성/.test(lp.t) ? `${/공공재개발/.test(lp.t) ? "공공재개발" : "신속통합기획"} 구역은 토지거래허가(2년 실거주)로 묶이는 경우가 많아 전세 낀 매수에서 빼요 · 지정 여부는 구청 확인` : "토지거래허가구역 · 2년 실거주라 전세 낀 매수 불가") });
        else if (blk && !/대상 아님/.test(blk)) out.push({ k: "전세 끼고", c: /보류/.test(blk) ? "warn" : "no", v: /세입자/.test(blk) ? "✕ 세입자 없음" : /입주권 없음/.test(blk) ? "✕ 입주권 없음" : "! 확인 필요", why: () => blk });
        else if (!blk) out.push({ k: "전세 끼고", c: "ok", v: "✓ 가능", why: () => "토지거래허가 대상 아님 · 전세금만큼 덜 내고 살 수 있어요" });
      } catch (e) {}
    }
    out.push({ k: "단계", c: "st", v: stageName(r), why: () => {
      const [T, i] = curStep(r), d = i >= 0 ? stepDate(r, T[i][0]) : null;
      let p = null; try { p = ZX.pace(r); } catch (e) {}
      if (p) return `${ymd(p.from)}부터 ${p.yrs < 1 ? Math.round(p.yrs * 12) + "개월" : p.yrs.toFixed(1) + "년"}째 · 서울 가운데 값 ${p.med}년`;
      return d ? `${ymd(d)} ${T[i][0]}` : r._prem || !FREE ? "단계 날짜 기록 없음" : "불러오는 중";
    } });
    return out;
  }
  function vdHTML(V) {
    // 입주권이 안 나오는 구역: 지금 사면 무엇을 사는 건지 맨 위에 한 번(아래 아파트·빌라 시세 카드에 헷갈리지 않게)
    const ip = V.find((x) => x.w && x.c === "no");
    const due = ip ? String(ip.w.due || "").replace(/\s*이후 매수분$/, "") : "";
    const nb = ip ? `<div class="ov-noip" role="note"><b>지금 사면 새 아파트 입주권이 안 나와요</b><span>${due ? `${esc(due)} 뒤에 산 집은` : "지금 산 집은"} 조합원이 될 수 없어요(예외 매물 빼고). 새 아파트를 원하면 일반분양·분양권을 알아보세요. 아래 시세는 참고용이에요.</span></div>` : "";
    return `<div class="ov-vd" role="group" aria-label="판정">${V.map((x, i) => `<button type="button" class="ov-p ${x.c}" data-vi="${i}" aria-expanded="false"><span>${esc(x.k)}</span><b>${esc(x.v)}</b></button>`).join("")}</div><p class="ov-why" hidden></p>${nb}`;
  }
  function vdBind(w, V) {
    const why = w.querySelector(".ov-why");
    w.querySelectorAll(".ov-p").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const on = b.getAttribute("aria-expanded") === "true";
      w.querySelectorAll(".ov-p").forEach((x) => x.setAttribute("aria-expanded", "false"));
      if (on) { why.hidden = true; return; }
      b.setAttribute("aria-expanded", "true");
      why.textContent = V[+b.dataset.vi].why() || "";
      why.className = "ov-why " + V[+b.dataset.vi].c;
      why.hidden = !why.textContent;
    }));
  }

  // ---------- 단계 타임라인 ----------
  function tlSteps(r) {
    const sm = isSmallR(r), early = (r.s || 0) < 2;   // 정비계획 수립·후보지: '계획' 칸을 앞에(추진위는 건너뛰는 곳이 많아 생략)
    return [["계획", 0], ["구역지정", 2], ["추진위", 3], [r.trust ? "시행자지정" : "조합설립", 4], ["사업시행", 5], ["관리처분", 6], ["착공", 8], ["준공", 9]].filter(([k]) => (k !== "계획" || early) && !(early && k === "추진위") && !(sm && (k === "구역지정" || k === "관리처분")) && !(r.trust && k === "추진위"));
  }
  const stepDate = (r, k, dt) => { dt = dt || r.dt || {}; return dt[k] || (k === "조합설립" ? dt["시행자지정"] : k === "시행자지정" ? dt["조합설립"] : null) || null; };
  const yrs = (a, b) => (new Date(b) - new Date(a)) / (365.25 * 864e5);
  let AVGP = null; const AVG = new Map();
  function allDt() {
    if (!AVGP) AVGP = (FREE ? premAll() : Promise.resolve(null)).then((all) => {
      const m = [];
      R.forEach((x) => { const dt = (all && all[x.id] && all[x.id].dt) || x.dt; if (dt) m.push([x, dt]); });
      return m;
    }).catch(() => []);
    return AVGP;
  }
  // 이 구역의 직전 단계 → 지금 단계 걸린 해 vs 같은 두 단계 날짜가 다 있는 서울 구역 평균
  function paceVs(r) {
    if (r.src === "moa") return Promise.resolve(null);
    const [T, i] = curStep(r);
    if (i < 1) return Promise.resolve(null);
    const cd = stepDate(r, T[i][0]); if (!cd) return Promise.resolve(null);
    const j = i - 1;   // 바로 앞 단계 날짜가 있을 때만 비교(단계 건너뛴 비교 금지)
    if (!stepDate(r, T[j][0])) return Promise.resolve(null);
    const a = T[j][0], b = T[i][0], mine = yrs(stepDate(r, a), cd), sm = isSmallR(r);
    if (!(mine > 0)) return Promise.resolve(null);
    const key = a + ">" + b + (sm ? "|s" : "");
    return allDt().then((L) => {
      if (!AVG.has(key)) {
        let s = 0, n = 0;
        L.forEach(([x, dt]) => { if (isSmallR(x) !== sm) return; const p = stepDate(x, a, dt), q = stepDate(x, b, dt); if (!p || !q) return; const y = yrs(p, q); if (y > 0 && y < 40) { s += y; n++; } });
        AVG.set(key, n >= 8 ? { avg: s / n, n } : null);
      }
      const v = AVG.get(key); if (!v) return null;
      return { a, b, mine, avg: v.avg, n: v.n, diff: mine - v.avg };
    });
  }
  function tlHTML(r) {
    if (r.src === "moa") return "";
    const [T, i] = curStep(r), done = isDone(r);
    // 단계 이름이 칸 이름과 다르면(정비계획 수립·이주·철거 등) 머리에 '지금 ○○'
    const sn = stageName(r), nz = (x) => String(x).replace(/인가|\s|·/g, "");
    const pre = !done && (i < 0 || !nz(sn).startsWith(nz(T[i][0]))) ? `<span class="ov-tl-now">지금 ${esc(sn)}</span>` : "";
    // 앞 칸 날짜가 뒤 칸보다 늦으면 변경 지정·고시일로 본다(최초 날짜는 더 이름) → '(변경)' 표시
    const ds = T.map(([k]) => stepDate(r, k));
    const li = T.map(([k], n) => { const d = ds[n], chg = d && ds.slice(n + 1).some((x, j) => x && x < d && !(k === "구역지정" && T[n + 1 + j][0] === "추진위")), st = n < i || (n === i && done) ? "dn" : n === i ? "on" : ""; return `<li class="${st}"${n === i && !done ? ' aria-current="step"' : ""}${chg ? ' title="변경 지정·고시일로 보여요(최초 날짜는 더 이름)"' : ""}><i></i><b>${k === "시행자지정" ? "시행자" : k}</b><small>${d ? esc(d.slice(2, 7).replace("-", ".")) + (chg ? '<br><em class="ov-chg">(변경)</em>' : "") : n === i && !done ? "지금" : n < i ? "–" : ""}</small></li>`; }).join("");
    const stl = r.stale && !done ? `<span class="ov-tl-now ov-stl" title="오랫동안 새 인가·공고 기록이 없어요">진행 확인 필요</span>` : "";
    return `<div class="ov-c ov-tl"><h3>진행 단계 ${pre}${stl}<em class="ov-pv" hidden></em></h3><div class="ov-tl-sc" tabindex="0" role="group" aria-label="진행 단계 ${T.length}칸${i >= 0 ? ` · 지금 ${esc(sn)}` : ""}"><ol style="--n:${T.length}">${li}</ol></div></div>`;
  }
  function srcHTML(r) {
    const s = D.txAsOf && D.txAsOf.sale, d = s && s.length >= 8 ? `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}` : "";
    const cafe = r.cafe ? `<a href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl=${encodeURIComponent(r.cafe)}" target="_blank" rel="noopener">정비사업 정보몽땅 ↗</a>` : "정비사업 정보몽땅";
    return `<p class="ov-src"><span>자료 기준${d ? ` 실거래 ${d}` : ""}</span>${cafe.startsWith("<a") ? cafe : `<span>${cafe}</span>`}<a href="https://www.eum.go.kr/" target="_blank" rel="noopener">토지이음 ↗</a></p>`;
  }
  // 단계 날짜·사업장 주소는 따로 불러오는 자료라, 오면 타임라인·출처 줄을 다시 그린다
  function late(r, w) {
    if (cur !== r || !w.isConnected) return;
    const tl = w.querySelector(".ov-tlw"); if (tl) tl.innerHTML = tlHTML(r);
    const sr = w.querySelector(".ov-srcw"); if (sr) sr.innerHTML = srcHTML(r);
    paceVs(r).then((p) => {
      const em = w.querySelector(".ov-pv"); if (!p || !em || cur !== r) return;
      const ad = Math.abs(p.diff), n = ad >= 2 ? Math.round(ad) : Math.round(ad * 10) / 10;
      em.textContent = ad < 0.5 ? "평균 수준" : `서울 평균보다 ${n}년 ${p.diff < 0 ? "빠름" : "늦음"}`;
      em.className = "ov-pv " + (ad < 0.5 ? "eq" : p.diff < 0 ? "fast" : "slow");
      em.title = `${p.a} → ${p.b} ${p.mine.toFixed(1)}년 · 서울 ${p.n}곳 평균 ${p.avg.toFixed(1)}년`;
      em.hidden = false;
    }).catch(() => {});
  }
  // 분기별 가운데 값 막대(최근 3년): 0부터 그린 막대 + 눈금 2~3줄 · 막대 아래 거래 수 · 마지막 분기 값과 최고 값만 숫자로
  const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))), m = v / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  function chart(r, q, unit) {
    const cut = String(new Date().getFullYear() - 3).slice(-2);
    const nd = new Date(), curQ = `${String(nd.getFullYear()).slice(2)}Q${Math.floor(nd.getMonth() / 3) + 1}`;
    const qq = q.filter((x) => x[0].slice(0, 2) >= cut && x[0] !== curQ).slice(-12);
    if (qq.length < 3) return "";
    const W = 320, H = 150, pl = 42, pr = 2, pt = 18, pb = 32, n = qq.length, gap = 4, bw = Math.min(24, (W - pl - pr - gap * (n - 1)) / n);
    const mx = Math.max(...qq.map((x) => x[1])), st = nice(mx / 2), ticks = [];
    for (let t = st; !ticks.length || ticks[ticks.length - 1] < mx; t += st) ticks.push(t);
    const top = Math.max(mx, ticks[ticks.length - 1]), base = H - pb;
    const off = pl + (W - pl - pr - (n * (bw + gap) - gap)) / 2;
    const X = (i) => off + i * (bw + gap), Y = (v) => pt + (base - pt) * (1 - v / top);
    const imx = qq.findIndex((x) => x[1] === mx);
    const grid = ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="gl"/><text x="${pl - 6}" y="${(Y(t) + 3.5).toFixed(1)}" class="ax">${eok(t)}</text>`).join("") + `<line x1="${pl}" x2="${W - pr}" y1="${base}" y2="${base}" class="gl b"/>`;
    let lastYr = "";
    const bars = qq.map((x, i) => {
      const y = Y(x[1]), yr = "20" + x[0].slice(0, 2), lab = yr !== lastYr ? ((lastYr = yr), `<text x="${X(i).toFixed(1)}" y="${H - 3}" class="yr">${yr}</text>`) : "", bh = base - y;
      const cx = X(i) + bw / 2, anc = cx > W - 40 ? "end" : "middle", tx = anc === "end" ? X(i) + bw : cx;
      const v = i === n - 1 || (i === imx && imx < n - 2) ? `<text x="${tx.toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="${anc}" class="bv${i === n - 1 ? " last" : ""}">${eok(x[1])}</text>` : "";
      const cls = [i === n - 1 ? "on" : "", x[2] < 3 ? "lo" : ""].filter(Boolean).join(" ");
      return `<rect x="${X(i).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, base - y).toFixed(1)}" rx="3"${cls ? ` class="${cls}"` : ""}><title>20${x[0].slice(0, 2)}년 ${x[0].slice(3)}분기 · ${eok(x[1])} · ${x[2]}건</title></rect>${v}<text x="${cx.toFixed(1)}" y="${base + 12}" class="bq">${x[0].slice(2)}</text>${bh >= 15 ? `<text x="${cx.toFixed(1)}" y="${(base - 4).toFixed(1)}" class="bn${i === n - 1 ? " on" : ""}">${x[2]}</text>` : ""}${lab}`;
    }).join("");
    const anyLo = qq.some((x) => x[2] < 3);
    return `<div class="ov-ch"><div class="ov-cht">${unit} · 분기별 가운데 값 <b>최근 분기 ${eok(qq[n - 1][1])}</b></div><svg class="ov-bar" viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit} 분기별 가운데 값, 최근 ${eok(qq[n - 1][1])}, 최고 ${eok(mx)}">${grid}${bars}</svg><p class="ov-chn">막대 안 숫자는 분기 거래 수${anyLo ? " · 흐린 막대는 3건 미만" : ""}</p></div>`;
  }
  // 표본이 얇은 값(3건 미만이거나 마지막 거래가 1년 넘음)은 큰 숫자를 회색으로 + '거래 적음' 표시
  const monthsAgo = (d) => { if (!d || String(d).length < 6) return null; d = String(d); const nd = new Date(); return (nd.getFullYear() - +d.slice(0, 4)) * 12 + (nd.getMonth() + 1 - +d.slice(4, 6)); };
  function thinTag(n, to) {
    const ma = monthsAgo(to), few = n != null && n < 3, old = ma != null && ma > 12;
    if (!few && !old) return "";
    return `${few ? "거래 적음" : "오래된 거래"}${to ? ` · 최근 ${ym(to)}` : ""}`;
  }
  // 다른 기준(대표 거래·최근 분기·연식별)은 큰 숫자 밑에 접어 둔다
  function altHTML(items, ch) {
    const L = items.filter(Boolean);
    if (!L.length && !ch) return "";
    return `<details class="ov-alt"><summary>다른 기준 보기</summary>${L.length ? `<dl class="ov-altl">${L.map(([k, v, s]) => `<div><dt>${k}${s ? `<small>${s}</small>` : ""}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}${ch || ""}</details>`;
  }
  function lastQ(q) { const nd = new Date(), cq = `${String(nd.getFullYear()).slice(2)}Q${Math.floor(nd.getMonth() / 3) + 1}`; const L = (q || []).filter((x) => x[0] !== cq); return L.length ? L[L.length - 1] : null; }
  // 머리 큰 숫자 = ZF.headline 하나(/z/ 페이지와 같은 규칙): 매수가 표본의 3.3㎡당('u') · 매수가 자체('p') · 대표 거래 기준('hd')
  function hdHTML(h, t, r, dd) {
    const BN = { i: "입주권", a: "아파트", v: "빌라·단독 대지" }[h.b];
    const yoy = h.b === "v" && r.tx && r.tx.yoy != null ? `<em class="${r.tx.yoy >= 0 ? "up" : "dn"}">1년 ${r.tx.yoy >= 0 ? "▲" : "▼"} ${Math.abs(r.tx.yoy)}%</em>` : "";
    const per = `${BN} 3.3㎡당`;
    const win = h.w === 0 ? "최근 거래" : h.w === 24 ? "2년" : "1년";
    const H = ZF.headline(r, h) || { kind: "hd", v: h.u, n: h.n, to: h.to };
    // 1건이면 '가운데 값'이라 하지 않는다
    const hdBasis = h.n === 1 ? `${win} 구역 안 거래 1건${h.to ? ` · ${ym(h.to)}` : ""}` : `${win} 대표 거래 ${h.n}건 가운데 값${h.from && h.to && h.from !== h.to ? ` · ${ym(h.from)}–${ym(h.to)}` : ""}`;
    const P = H.kind === "p", U = H.kind === "u";
    const basis = U || P ? H.basis : hdBasis;
    const thin = U || P ? thinTag(H.n, H.to) : thinTag(h.n, h.to) || (h.st || h.w === 0 ? `오래된 거래${h.to ? ` · 최근 ${ym(h.to)}` : ""}` : "");
    // 계산 매수가가 주변 빌라 표본이면 아래 몇 건도 그 표본에서(머리 '마지막 거래'와 같은 거래가 맨 위) — 표본 목록이 없으면 구역 안 거래에 '표본 아님' 이름표
    const NZ = !noIpR(r) && ZX.near && ZX.near(r), nearB = !noIpR(r) && !!(r.mk && r.mk.entry && r.mk.entry.src === "villa" && (r.mk.entry.radius || 0) >= 100);
    const S = NZ ? NZ.s.slice(0, matchMedia("(max-width:640px)").matches ? 2 : 3).map((v) => [v[0], 0, v[3], v[1], 0, v[4], v[5]])   /* 주변 표본 줄은 거래 탭 '매수가 표본' 표처럼 전용 면적으로(대지 29㎡ vs 전용 59.4㎡로 갈리던 것) */ : txRows(dd, h.r);
    const lq = lastQ(h.q), ag = dd && dd.x && dd.x.age, agn = (dd && dd.x && dd.x.agn) || {};
    const alts = [
      P ? [h.b === "v" ? `구역 안 대표 거래 · 대지 3.3㎡` : `구역 안 ${per}`, eok(h.u), hdBasis] : null,
      U && h.u && Math.abs(h.u - H.v) >= 1 ? ["대표 거래 · 대지 3.3㎡", eok(h.u), hdBasis] : null,
      lq && !(h.q && h.q.length > 2) && !(P && lq[2] >= h.n) ? ["최근 분기", eok(lq[1]), `${lq[0].replace(/^(\d\d)Q/, "'$1년 ")}분기 · ${lq[2]}건`] : null,
      h.b === "v" && ag && ag.c != null ? ["31년 이상 건물", eok(ag.c), `구역 안 전체 기간 · ${agn.c || 0}건`] : null,
    ];
    const ch = h.q && h.q.length > 2 ? chart(r, h.q, per) : "";
    // 'p'(매수가가 큰 숫자)일 때 아래 몇 건은 구역 안 거래라 표본과 다를 수 있다 → 이름을 붙여 둔다
    const li = liHTML(S);
    return `<div class="ov-c ov-tx${thin ? " thin" : ""}"><h3>실거래 ${yoy}${refTag(r)}</h3>
      <div class="ov-big"><span>${P ? H.label : per}</span><b${thin ? ' title="표본이 적거나 오래돼 지금 시세와 다를 수 있어요"' : ""}>${P ? ZF.manT(H.v / 1e4) : eok(H.v)}</b>${thin ? `<em class="ov-thin">${thin}</em>` : ""}</div>
      <p class="ov-basis">기준 · ${esc(basis)}</p>
      ${P ? calcRow(r, false, H.v) : calcRow(r, U)}
      ${altHTML(alts, ch)}
      ${li ? (NZ ? `<p class="ov-lh">매수가 표본 최근 거래 · 주변 ${NZ.r}m</p>` : P || nearB ? `<p class="ov-lh">구역 안 최근 거래(매수가 표본 아님)</p>` : "") : ""}${li}
      <button type="button" class="ov-more" data-tab="tx">거래 전체 보기 →</button></div>`;
  }
  // 입주 현금 계산에 실제로 쓴 매수가와 그 표본 — /z/ 페이지·API와 같은 한 문장(ZF.smpTxt)
  const manT = ZF.manT, smpTxt = ZF.smpTxt;
  // 최근 거래 몇 건: 거래 탭과 같은 목록(최신 먼저) · 빌라·단독은 대지, 아파트·입주권은 전용
  const TY = ["빌라", "단독", "아파트", "입주권"];
  function txRows(dd, fb) {
    const k = matchMedia("(max-width:640px)").matches ? 2 : 3;
    const L = dd && Array.isArray(dd.s) && dd.s.length ? [...dd.s] : [...(fb || [])];
    return L.sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0)).slice(0, k);
  }
  const areaT = (x) => (x[1] <= 1 && x[4] > 0 ? `대지 ${x[4]}㎡` : x[3] ? `전용 ${x[3]}㎡` : "");
  const liHTML = (S) => (S.length ? `<ul class="ov-l">${S.map((x) => `<li><span>${esc(ym(x[0]))}</span><span>${TY[x[1]] || ""}${x[6] ? ` ${+x[6] < 0 ? "지하" + -x[6] : esc(String(x[6]))}층` : ""}${areaT(x) ? ` · ${areaT(x)}` : ""}</span><b>${eok(x[5])}</b></li>`).join("")}</ul>` : "");
  function calcRow(r, same, dup) {
    if (noIpR(r)) return "";   // 입주권 없는 구역: 계산 매수가 없음(신뢰 상자 '입주 현금 계산 · 안 함'과 같게)
    let x = null; try { x = investC(r); } catch (e) {}
    if (!x || x.price == null || !isFinite(x.price)) return "";
    if (dup && x.priceSrc !== "user" && Math.abs(x.price * 1e4 - dup) < 1) return "";   // 위 큰 숫자가 곧 계산 매수가(기준 줄에 '계산 매수가와 같은 표본')
    let est = false; try { est = isEst(r); } catch (e) {}
    const en = (r.mk && r.mk.entry) || {};
    const smp = x.priceSrc === "user" && !est ? "직접 입력" : same ? (en.n === 1 ? "위와 같은 거래 1건의 매매가" : `위와 같은 ${en.n}건의 매매가 가운데 값`) : smpTxt(r, x);
    return `<div class="ov-calc"><span>계산 매수가</span><b>${manT(x.price)}</b><small>${smp ? `= ${esc(smp)}` : "입주 현금 계산 기준"}</small></div>`;
  }
  // '이 숫자 믿어도 될까': 표본 수·마지막 거래·신뢰도(표본 수·최근성·참고값(lc)·주변 시세(nbp))
  function trustHTML(r) {
    let x = null; try { x = investC(r); } catch (e) {}
    const en = (r.mk && r.mk.entry) || {}, t = r.tx || {};
    const H = (lv, cls, rows, msg, tt) => `<div class="ov-c ov-trust ${cls}" id="ovTrust"><div class="ov-trh"><h3>${tt || "이 숫자 믿어도 될까"}</h3><b class="ov-lv">${lv}</b></div>${rows.length ? `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}<p>${msg}</p></div>`;
    // 구역 안 거래 줄: 거래 탭 '구축 빌라 매매'와 같은 정의·기간(2015년 이전 준공 빌라 · 최근 nwin개월)을 쓰고, 그 값이 없을 때만 모든 거래 12개월
    const n12 = t.no != null ? [[`구역 안 빌라 ${t.nwin || 18}개월`, `${t.no}건`]] : t.n12 != null ? [["구역 안 거래 12개월", `${t.n12}건`]] : [];
    const nearL = en.src === "villa" && (en.radius || 0) >= 100 ? `주변 ${en.radius}m 빌라 ` : en.fill === "dong" ? "같은 동 빌라 " : "";
    // 계산 안 한 까닭을 한 줄로(입주권 없음 · 모아타운 · 이주 뒤 · 재건축 단지 거래 없음 · 표본 없음)
    if (!x || x.price == null || !isFinite(x.price) || noIpR(r)) {
      const TT = "입주 현금 계산";
      if (r.src === "moa") return H("안 함", "na", [], "모아타운 관리지역은 사업구역마다 조건이 달라 한 숫자로 계산하지 않아요. 안의 사업구역을 열어 보세요.", TT);
      if (noIpR(r)) return H("안 함", "na", [], "지금 사면 입주권이 안 나와서 입주 현금(새 아파트 받을 때까지 드는 돈)을 계산하지 않아요.", TT);
      if (x && x.stale) return H("안 함", "na", n12, "이주·철거가 시작돼 옛 집 매매가로는 계산할 수 없어요. 아는 입주권 매물가를 입주 현금 탭에 넣으면 계산해요.", TT);
      if (x && x.noApt) return H("안 함", "na", n12, "재건축 단지 아파트 거래가 없어 매수가를 못 잡았어요. 아는 매물가를 입주 현금 탭에 넣으면 계산해요.", TT);
      return H("안 함", "na", n12, "매수가로 쓸 거래가 없어 계산하지 않아요. 아는 매물가를 입주 현금 탭에 넣으면 계산해요.", TT);
    }
    let est = false; try { est = isEst(r); } catch (e) {}
    if (est) return H("낮음", "lo", n12, `구역 안 거래가 적어 같은 구(${esc(r.g)}) 빌라 시세로 추정한 값이에요 · 계약 전 매물 시세로 꼭 확인`);
    if (x.priceSrc === "user") return H("직접 입력", "hi", [], "내가 넣은 매수가로 계산했어요.");
    const n = en.n || 0, last = en.last || (en.t ? en.t : ""), lastY = last ? "20" + last.slice(0, 2) + (last.slice(3, 5) || "01") : "";
    const ma = lastY ? (TODAY.getFullYear() - +lastY.slice(0, 4)) * 12 + (TODAY.getMonth() + 1 - +lastY.slice(4, 6)) : null;
    const why = [];
    if (n && n < 3) why.push(`표본 ${n}건뿐`);
    if (ma != null && ma > 12) why.push("마지막 거래가 1년 넘음");
    if (r.lc && !why.length) why.push(r.lcw === "thin" ? "구역 안 거래로 확인 안 됨" : "표본이 적거나 구역 거래와 구성이 달라 참고값");
    const low = why.length > 0;
    if (!low) {
      if (r.nbp || en.radius || en.fill === "dong") why.push("구역 밖 주변 시세 기준");
      if (n < 10) why.push(`표본 ${n}건이라 몇 건에 값이 흔들릴 수 있어요`);
      if (ma != null && ma > 6) why.push("마지막 거래 6개월 넘음");
    }
    const [lv, cls] = low ? ["낮음", "lo"] : why.length ? ["보통", "md"] : ["높음", "hi"];
    const rows = [["매수가 표본", n ? `${nearL}${n}건` : "–"], [nearL ? "표본 마지막 거래" : "마지막 거래", last ? esc(last) : "–"], ...(en.p25 && en.p75 && en.p75 > en.p25 ? [["가운데 50%", `${eok(en.p25)}~${eok(en.p75)}`]] : []), ...n12];
    return H(lv, cls, rows, why.length ? why.join(" · ") + (low ? " · 계약 전 매물 시세로 꼭 확인" : "") : "구역 안 최근 거래가 충분해요");
  }
  function txHTML(t, r, d) {
    if (t.hd && t.hd.u) return hdHTML(t.hd, t, r, d);
    const S = txRows(d, null);
    const has = t.pp || t.med || t.am || t.im;
    if (!has) {
      // 구역 안 거래가 없어도 계산 매수가 표본(주변 300m 빌라 등)이 있으면 그 표본 하나로 말한다 — '같은 동 빌라 1년 38건'을 따로 띄우면 매수가·신뢰 상자와 표본이 갈린다(o776)
      const H0 = ZF.headline(r, null);
      if (H0 && H0.kind === "p") { const th = thinTag(H0.n, H0.to); return `<div class="ov-c ov-tx${th ? " thin" : ""}"><h3>실거래${refTag(r)}</h3><div class="ov-big"><span>${H0.label}</span><b>${ZF.manT(H0.v / 1e4)}</b>${th ? `<em class="ov-thin">${th}</em>` : ""}</div><p class="ov-basis">기준 · ${esc(H0.basis)}</p>${calcRow(r, false, H0.v)}<p class="ov-none">구역 안 최근 거래 없음</p><button type="button" class="ov-more" data-tab="tx">거래 전체 보기 →</button></div>`; }
      return `<div class="ov-c ov-tx"><h3>실거래${refTag(r)}</h3><p class="ov-none">최근 구역 안 거래 없음</p>${t.nb ? nearHTML(t.nb) : ""}</div>`;
    }
    const yoy = r.tx && r.tx.yoy != null ? `<em class="${r.tx.yoy >= 0 ? "up" : "dn"}">1년 ${r.tx.yoy >= 0 ? "▲" : "▼"} ${Math.abs(r.tx.yoy)}%</em>` : "";
    const last = S[0] ? ym(S[0][0]) : "";
    const A = !!t.am && (/재건축/.test(r.k) || (!t.pp && !t.med));   // 재건축은 아파트 값이 기준
    const IP = r.s >= 8 && t.im;                                        // 착공 뒤엔 입주권 거래가 기준
    // 대표 거래 기준(hd)이 없는 빌라 구역도 계산 매수가가 있으면 그 표본이 큰 숫자(ZF.headline 'p' · /z/와 같은 규칙)
    const H = !IP && !A ? ZF.headline(r, null) : null, P = H && H.kind === "p";
    const big = P ? [H.label, ZF.manT(H.v / 1e4)] : IP ? ["입주권 · 1년", eok(t.im)] : A ? ["아파트 매매 · 1년", eok(t.am)] : t.pp ? ["대지 3.3㎡당 · 1년", eok(t.pp)] : t.med ? ["빌라 매매 · 1년", eok(t.med)] : t.am ? ["아파트 매매 · 1년", eok(t.am)] : null;
    const ser = IP ? [t.qi, "입주권"] : A || (!t.pp && t.am) ? [t.qa, "아파트 매매"] : t.pp ? [(t.q || []).filter((x) => x[2] >= 2), "대지 3.3㎡당"] : [null, ""];
    const nn = t.n12 || t.n, thin = P ? thinTag(H.n, H.to) : big ? thinTag(nn == null ? null : nn, S[0] ? S[0][0] : null) : "";
    const chips = [P && t.pp ? `구역 안 대지 3.3㎡ ${eok(t.pp)}` : "", !P && !IP && !A && t.med && big && !/빌라/.test(big[0]) ? `빌라 ${eok(t.med)}` : "", nn ? `구역 안 ${t.n12 ? "12개월 " : ""}거래 ${nn}건` : "", last && !thin ? `최근 ${last}` : ""].filter(Boolean);
    return `<div class="ov-c ov-tx${thin ? " thin" : ""}"><h3>실거래 ${yoy}${refTag(r)}</h3>
      ${big ? `<div class="ov-big"><span>${big[0]}</span><b>${big[1]}</b>${thin ? `<em class="ov-thin">${thin}</em>` : ""}</div>` : ""}${P ? `<p class="ov-basis">기준 · ${esc(H.basis)}</p>` : ""}
      ${P ? calcRow(r, false, H.v) : calcRow(r)}${chips.length ? `<div class="ov-chips">${chips.map((c) => `<span>${c}</span>`).join("")}</div>` : ""}
      ${ser[0] && ser[0].length > 2 ? altHTML([], chart(r, ser[0], ser[1])) : ""}
      ${P && S.length ? `<p class="ov-lh">구역 안 최근 거래</p>` : ""}${liHTML(S)}
      <button type="button" class="ov-more" data-tab="tx">거래 전체 보기 →</button></div>`;
  }
  function nearHTML(nr) {
    return nr && nr.n ? `<div class="ov-near"><span>같은 동(${esc(nr.dong || "")}) 빌라 매매 · 1년 ${nr.n}건</span><b>${eok(nr.med)}</b></div>` : "";
  }
  function apt(t, r) {   // 재건축 아파트 단지 거래
    const a = t.apt; if (!a || !a.n) return "";
    return `<div class="ov-c ov-tx"><h3>단지 실거래${refTag(r)}</h3><div class="ov-k"><div><span>최근 거래</span><b>${eok(a.last)}</b></div><div><span>1년 가운데 값</span><b>${a.med ? eok(a.med) : "–"}</b></div><div><span>거래 수(1년)</span><b>${a.n}건</b></div></div></div>`;
  }
  function mini(r) {
    const box = document.getElementById("ovMap"); if (!box) return;
    if (!window.matchMedia("(max-width:980px)").matches) { box.remove(); return; }
    Promise.all([LMX.lib(), LMX.geo()]).then(([, g]) => {
      if (!document.getElementById("ovMap") || cur !== r || !window.maplibregl) return;
      const z = g && g.z && g.z[r.id] && g.z[r.id].g ? g.z[r.id] : null, est = !!(z && z.e);   // 추정 범위는 점선으로(경계처럼 보이지 않게)
      if (!z && !r.ll) { box.remove(); return; }
      let bb;
      if (z) { let a = 180, b = 90, c = -180, d = -90; z.g.forEach((rg) => rg.forEach(([x, y]) => { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; })); bb = [[a, b], [c, d]]; }
      try { if (mm) mm.remove(); } catch (e) {}
      mm = new maplibregl.Map({ container: "ovMap", style: LMX.style(), interactive: false, attributionControl: false, preserveDrawingBuffer: true, fadeDuration: 0, ...(bb ? { bounds: bb, fitBoundsOptions: { padding: est ? 56 : 28, maxZoom: est ? 15.6 : 16.2 } } : { center: [r.ll[1], r.ll[0]], zoom: 15 }) });
      mmId = r.id;
      const fit = () => { try { mm.resize(); if (bb) mm.fitBounds(bb, { padding: est ? 56 : 28, maxZoom: est ? 15.6 : 16.2, duration: 0 }); } catch (e) {} };
      try { new ResizeObserver(fit).observe(box); } catch (e) {}
      setTimeout(fit, 350); setTimeout(fit, 900);
      // 다 그려지면 그림으로 바꿔 WebGL을 놓아 준다(시트 스크롤·메모리)
      mm.once("idle", () => setTimeout(() => { try { if (!mm || mmId !== r.id) return; const url = mm.getCanvas().toDataURL("image/png"); const im = new Image(); im.alt = ""; im.src = url; im.className = "ov-img"; const m = mm; mm = null; m.remove(); const tg = box.querySelector(".ov-mtag"); box.innerHTML = ""; box.appendChild(im); if (tg) box.appendChild(tg); } catch (e) {} }, 120));
      mm.on("load", () => {
        try { mm.addSource("sub", { type: "geojson", data: LMX.subway() }); mm.addLayer({ id: "sub", type: "line", source: "sub", paint: { "line-color": ["get", "c"], "line-width": 3, "line-opacity": 0.85 } }); } catch (e) {}
        if (z) {
          mm.addSource("z", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: {} } });
          mm.addLayer({ id: "zf", type: "fill", source: "z", paint: { "fill-color": "#2f6feb", "fill-opacity": est ? 0.08 : 0.16 } });
          mm.addLayer({ id: "zl", type: "line", source: "z", paint: { "line-color": matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light" || document.documentElement.dataset.theme === "dark" ? "#8fb0ff" : "#1f3a87", "line-width": est ? 2 : 2.5, ...(est ? { "line-dasharray": [2, 1.5] } : {}) } });
          if (est) box.insertAdjacentHTML("beforeend", '<span class="ov-mtag">대략 범위 · 경계 미공개</span>');
        } else {
          mm.addSource("p", { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: [r.ll[1], r.ll[0]] }, properties: {} } });
          mm.addLayer({ id: "p", type: "circle", source: "p", paint: { "circle-radius": 8, "circle-color": "#1f3a87", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
        }
      });
      box.onclick = () => { try { closeSheetNow(); } catch (e) {} setTimeout(() => { try { LMX.focus(true); } catch (e) {} }, 250); };
    }).catch(() => box.remove());
  }
  // 주소 줄 칩: 무엇에 대한 말인지 글자에 다 넣고(역 도보 · 매수가 추정/주변 시세 · 경사 %), 누르면 한 줄 설명
  function addrChips(r) {
    const C = [];
    if (r.st && r.st.d) {
      const wm = Math.max(1, Math.round(r.st.d * 1.3 / 67)), sn = r.st.n.replace(/역$/, "") + "역";
      C.push({ c: "g", t: wm > 20 ? "역에서 멀어요" : `${sn} 걸어서 ${wm}분`, tip: `가까운 역 ${esc(sn)}까지 직선 ${Math.round(r.st.d).toLocaleString("ko-KR")}m · 걸어서 걸리는 시간은 직선×1.3을 분당 67m로 나눈 어림값이에요` });
    }
    let x = null; try { x = investC(r); } catch (e) {}
    const has = x && x.price != null && isFinite(x.price) && x.priceSrc !== "user" && !noIpR(r);   // 입주권 없는 구역은 계산 안 함 → 매수가 칩도 없음
    let est = false; try { est = isEst(r); } catch (e) {}
    const en = (r.mk && r.mk.entry) || {}, smp = has ? smpTxt(r, x) : "";
    const more = ` <button type="button" class="ov-wl" data-ovtrust>근거 보기 ↓</button>`;
    if (has && est) C.push({ c: "w", t: "매수가 추정 · 구 평균", tip: `구역 안 빌라 거래가 적어 입주 현금 계산의 매수가를 같은 구(${esc(r.g)}) 빌라 시세 가운데 값으로 잡았어요 · 실제 매물가와 다를 수 있어요.${more}` });
    else if (has && r.lc) {
      const n = en.n || 0, why = r.lcw === "old" || en.lcw === "old" ? "거래 오래됨" : n && n < 5 ? `거래 ${n}건뿐` : "거래 적음";
      C.push({ c: "w", t: `매수가 추정 · ${why}`, tip: `입주 현금 계산에 쓴 매수가는 ${esc(smp || "적은 거래로 잡은 값")}이에요. 표본이 적거나 오래돼 실제 매물가와 다를 수 있어요.${more}` });
    } else if (has && (r.nbp || en.radius || en.fill === "dong")) C.push({ c: "g", t: "매수가 = 주변 시세", tip: `구역 안 거래가 드물어 매수가를 구역 밖 주변 거래로 잡았어요${smp ? ` · ${esc(smp)}` : ""}.${more}` });
    const sl = ZF.slope(r);
    if (sl) C.push({ c: "g", t: sl.txt, tip: `${esc(sl.tip)} · 지형 자료로 잰 어림값이에요` });
    return C;
  }
  function render(r) {
    const head = document.querySelector("#report .rep-head");
    if (!head || !r || head.querySelector(".ov-top")) return;
    const w = document.createElement("div");
    w.className = "ov-top"; w.id = "ovTop";
    const t0 = r.tx || {};
    const V = verdicts(r);
    w.innerHTML = `<div class="ov-vdw">${vdHTML(V)}</div><div class="ov-map" id="ovMap" role="img" aria-label="${esc(shortName(r.n))} 위치"></div><div class="ov-row"><div class="ov-oldw">${oldHTML(t0, r)}</div><div class="ov-txw">${txHTML(t0, r, null)}</div></div><div class="ov-trw">${trustHTML(r)}</div><div class="ov-tlw">${tlHTML(r)}</div><div class="ov-srcw">${srcHTML(r)}</div>`;
    vdBind(w, V);
    locWhy(head, w, r);
    // 공식 이름(/z/ 페이지 제목과 같은 규칙 · tools/zpages.py short)이 화면 이름과 다르면 한 줄
    try {
      let fn = String(r.n || "").replace(/^\s*\d{1,3}\.\s+(?=\S)/, "").replace(/^\s*(\(가칭\)|\[임시\]|\(임시\))\s*/, "").replace(/\s*(\(가칭\)|\[임시\]|\(임시\))\s*$/, "").replace(/\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)?\s*(정비)?(사업)?\s*(조합|추진위원회|조합설립추진위원회|주민대표회의)?\s*$/, "").trim();
      for (let i = 0; i < 3; i++) fn = fn.replace(/\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)\s*(정비)?(사업|구역)?\s*$/, "").trim();   // '도시정비형 재개발사업' 같은 겹친 꼬리(tools/zpages.py short와 같은 규칙)
      const h2 = head.querySelector("#repTitle");
      const f0 = fn.replace(/\s/g, ""), s0 = shortName(r.n).replace(/\s/g, "");
      if (h2 && fn && f0 !== s0 && !(f0.startsWith(s0) && f0.length - s0.length <= 3) && !head.querySelector(".ov-formal")) h2.insertAdjacentHTML("afterend", `<p class="ov-formal">공식 이름 ${esc(fn)}</p>`);
    } catch (e) {}
    // 주소 줄: 구 동 · 단계 · 역 도보
    const wh = head.querySelector(".where");
    if (wh) {
      const dong = ((r.j || r.bj || "").match(/^(?:서울(?:특별)?시\s*)?(?:[가-힣]+구\s+)?([가-힣]+?(?:\d+(?:·\d+)*)?(?:동\d+가|로\d+가|\d+가|동|로|가))(?=[\s\d(산]|$)/) || [, r.dg || ""])[1];
      const C = addrChips(r);
      wh.classList.add("ov-w"); wh.removeAttribute("title");
      wh.innerHTML = `<b>${esc(r.g)} ${esc(dong)}</b>${C.map((c, i) => `<button type="button" class="ov-chip ${c.c}" data-ai="${i}" aria-expanded="false" aria-controls="ovWa">${esc(c.t)}</button>`).join("")}`;
      w.insertAdjacentHTML("afterbegin", `<p class="ov-why ov-wa" id="ovWa" hidden></p>`);
      const wa = w.querySelector(".ov-wa");
      wh.querySelectorAll("[data-ai]").forEach((b) => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const on = b.getAttribute("aria-expanded") === "true";
        wh.querySelectorAll("[data-ai]").forEach((x) => x.setAttribute("aria-expanded", "false"));
        if (on) { wa.hidden = true; return; }
        const c = C[+b.dataset.ai]; b.setAttribute("aria-expanded", "true");
        wa.className = "ov-why ov-wa " + (c.c === "w" ? "warn" : "st"); wa.innerHTML = c.tip; wa.hidden = false;
      }));
    }
    const where = head.querySelector(".where");
    (where || head.firstElementChild).after(w);
    w.addEventListener("click", (e) => { const tj = e.target.closest("[data-ovtrust]"); if (tj) { const t = document.getElementById("ovTrust"); if (t) t.scrollIntoView({ block: "center", behavior: "smooth" }); return; } const b = e.target.closest("[data-tab]"); if (!b) return; const tb = document.getElementById("tab-" + b.dataset.tab); if (tb) tb.click(); });
    mini(r);
    late(r, w);
    if (!r._prem && FREE) premLoad(r).then(() => late(r, w)).catch(() => {});
    // 착공 뒤: 입주권 거래는 있지만 투기과열지구라 예외 매물만 — 한 줄로
    const rk = head.querySelector(".lb-risk"); if (rk && w.querySelector(".ov-noip")) rk.remove();
    Promise.all([ZX.loadTx(), ZX.loadNear ? ZX.loadNear() : null]).then(([d]) => {
      if (cur !== r || !document.getElementById("ovTop")) return;
      const t = { ...(r.tx || {}), ...((d && d[r.id] && d[r.id].x) || {}) };
      const tw = w.querySelector(".ov-txw");
      tw.innerHTML = apt(t, r) || txHTML(t, r, d && d[r.id]);
      const ow = w.querySelector(".ov-oldw");
      if (ow && !ow.innerHTML.trim()) ow.innerHTML = oldHTML(t, r);
    }).catch(() => {});
  }
  // 머리의 '입지 50' 칩: 눌러서 무슨 점수인지 한 줄(판정 줄 설명 자리 재사용)
  function locWhy(head, w, r) {
    const g = head.querySelector(".gb.lb"); if (!g || r.score == null) return;
    const why = w.querySelector(".ov-why");
    g.removeAttribute("title");
    g.setAttribute("role", "button"); g.tabIndex = 0; g.setAttribute("aria-expanded", "false");
    g.setAttribute("aria-label", `입지 점수 ${r.score}점, 100점 만점 · 설명 보기`);
    const tog = () => {
      const on = g.getAttribute("aria-expanded") === "true";
      w.querySelectorAll(".ov-p").forEach((x) => x.setAttribute("aria-expanded", "false"));
      g.setAttribute("aria-expanded", String(!on));
      if (on) { why.hidden = true; return; }
      why.className = "ov-why st";
      why.innerHTML = `입지 ${r.score}/100 · 역·업무지구·한강·호재·생활시설까지 거리로 매긴 서울 구역 비교용 점수예요(투자 등급 아님). <button type="button" class="ov-wl" data-tab="loc">항목별 점수 →</button>`;
      why.hidden = false;
    };
    g.addEventListener("click", (e) => { e.stopPropagation(); tog(); });
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tog(); } });
    w.querySelectorAll(".ov-p").forEach((b) => b.addEventListener("click", () => g.setAttribute("aria-expanded", "false")));
  }
  // 입주 현금 탭 시간표: 사업·일정 탭과 같은 한 값(etaShow · src/app.js)
  function fixGtl(p, r) {
    const gt = p.querySelector(".gtl"); if (!gt) return;
    const e3 = gt.querySelector(".gt3 .gt-w"), e2w = gt.querySelector(".gt2 .gt-w");
    let lab = ""; try { lab = etaShow(r); } catch (e) {}
    if (e3 && lab && !e3.textContent.startsWith(`입주 · ${lab}`)) e3.textContent = `입주 · ${lab}`;
    if (e2w && /시점 미정/.test(e2w.textContent)) e2w.textContent = r.s >= 7 ? "이주 · 진행 중" : "이주 · 관리처분 뒤";
  }
  function tidyPane() {
    const p = document.getElementById("pane"); if (!p || !cur) return;
    const r = cur, apt = /재건축/.test(r.k) || !!(r.tx && r.tx.hd && r.tx.hd.b && r.tx.hd.b !== "v");
    const hideSect = (re) => p.querySelectorAll(".sect, .chk3").forEach((x) => { const h = x.querySelector("h3"); if (h && re.test(h.textContent)) x.hidden = true; });
    if (curTab === "tx" && apt) hideSect(/연식별|필지 현황|최근 전세/);
    if (curTab === "req" && r.s >= 2) hideSect(/구역지정 요건/);
    if (curTab === "near") {
      p.querySelectorAll("table tr").forEach((tr) => { const td = [...tr.querySelectorAll("td")]; if (td.length > 1 && td.slice(1).every((c) => /^\s*[–-]?\s*$/.test(c.textContent))) tr.hidden = true; });
      p.querySelectorAll(".chk3, .lead-card, .leadc, [class*=lead]").forEach((x) => (x.hidden = true));
    }
    if (curTab === "money") try { fixGtl(p, r); } catch (e) {}
    // 입주 현금 탭이 짧아 아래가 비면 '계산 근거 · 숫자 바꿔 보기'를 펼쳐 둔다(한 번만 · 사용자가 접으면 그대로)
    if (curTab === "money") requestAnimationFrame(() => { const pp = document.getElementById("pane"), f = pp && pp.querySelector(".s-fold"); if (!f || f.dataset.auto || cur !== r) return; f.dataset.auto = "1"; if (pp.getBoundingClientRect().height < innerHeight * 0.9) f.open = true; });
    if (curTab === "money" && apt) p.querySelectorAll(".rvj").forEach((x) => (x.hidden = true));
    if (curTab === "req") hideSect(/적용 기준|동의 기준|접도|조례/);
    // 입주 현금 탭이 접힌 근거만 남아 비면, 위 카드의 결론을 한 번 더 크게
    if (curTab === "money") {
      const vis = [...p.children].filter((x) => !x.hidden && getComputedStyle(x).display !== "none" && !x.classList.contains("s-fold"));
      if (!vis.length) { const cs = document.querySelector("#report .rep-head .cstrip"); p.insertAdjacentHTML("afterbegin", `<p class="ov-msg">${cs && cs.classList.contains("gblock") ? "전세 끼고는 살 수 없는 구역이에요. 위 '대출 끼고' 금액을 보세요." : (() => { let x = null; try { x = investC(r); } catch (e) {} return x && x.price != null ? `지금 사는 값(계산 매수가 ${ZF.manT(x.price)})까지만 계산했어요. ${ZF.noCalcTxt(r, x)}.` : "매수가로 쓸 거래가 없어 계산하지 않아요. 아는 매물가를 넣으면 계산해요."; })()}</p>`); }
    }
    p.querySelectorAll("dl.facts > div").forEach((d) => { const t = d.textContent; if (/자료 없음|미공개|계산 불가|일반분양 비율/.test(t)) d.hidden = true; });
  }
  // 탭 막대: 오른쪽에 더 있으면 흐림 + '›'(누르면 넘김), 끝까지 가면 사라짐 · 왼쪽으로 넘긴 뒤엔 왼쪽 흐림
  function tabAff() {
    const tb = document.querySelector("#report .tabs"); if (!tb || tb.dataset.aff) return;
    tb.dataset.aff = "1";
    const nx = document.createElement("span");
    nx.className = "tab-nx"; nx.setAttribute("aria-hidden", "true"); nx.textContent = "›";
    tb.appendChild(nx);
    const upd = () => { nx.style.right = -(parseFloat(getComputedStyle(tb).paddingRight) || 0) + "px"; const m = tb.scrollWidth - tb.clientWidth; tb.classList.toggle("more-r", tb.scrollLeft < m - 4); tb.classList.toggle("more-l", tb.scrollLeft > 4); };
    nx.addEventListener("click", (e) => { e.stopPropagation(); tb.scrollBy({ left: tb.clientWidth * 0.6, behavior: "smooth" }); });
    tb.addEventListener("scroll", upd, { passive: true });
    try { new ResizeObserver(upd).observe(tb); } catch (e) {}
    upd();
    // 고른 탭이 가려져 있으면 보이게
    const sel = tb.querySelector('[aria-selected="true"]'); if (sel && sel.offsetLeft + sel.offsetWidth > tb.scrollLeft + tb.clientWidth - 28) tb.scrollLeft = sel.offsetLeft - 16;
  }
  // 규제 탭 맨 위: 매물진단(66_tools.js)과 같은 판정 목록 · 출처 링크
  function reqBox(r) {
    const p = document.getElementById("pane"); if (!p || typeof TOOLS === "undefined" || !TOOLS.diagItems) return;
    const draw = () => {
      const pp = document.getElementById("pane"); if (!pp || cur !== r || curTab !== "req") return;
      const h = `<div class="sect rq"><h3>사기 전 확인할 규제</h3><ul class="dg-l rq-l">${TOOLS.diagItems(r, draw).map(TOOLS.dgLi).join("")}</ul></div>`;
      const old = pp.querySelector(".rq"); if (old) old.outerHTML = h; else pp.insertAdjacentHTML("afterbegin", h);
    };
    draw();
  }
  // 탭 막대를 시트(또는 화면) 맨 위로: 새 탭 내용의 시작이 막대 바로 아래에 오게
  function tabTop() {
    const tb = document.querySelector("#report .tabs"), pane = document.getElementById("pane"); if (!tb || !pane) return;
    let sc = tb.parentElement;
    while (sc && sc !== document.body) { const o = getComputedStyle(sc).overflowY; if ((o === "auto" || o === "scroll") && sc.scrollHeight > sc.clientHeight + 1) break; sc = sc.parentElement; }
    const doc = !sc || sc === document.body, cs = getComputedStyle(tb);
    const off = cs.position === "sticky" ? parseFloat(cs.top) || 0 : doc ? parseFloat(cs.scrollMarginTop) || 0 : 0;
    const base = doc ? 0 : sc.getBoundingClientRect().top;
    const d = pane.getBoundingClientRect().top - tb.offsetHeight - base - off;
    if (Math.abs(d) < 2) return;
    if (doc) window.scrollBy(0, d); else sc.scrollTop += d;
  }
  // PC: 목록에서 구역을 열면 포커스를 상세 제목으로 · 상세를 닫으면(Esc·목록 버튼) 주소의 #구역id를 지워 새로고침해도 다시 열리지 않게
  function deskFocus() {
    const PC = () => matchMedia("(min-width:981px)").matches;
    const toH = () => requestAnimationFrame(() => requestAnimationFrame(() => { const h = document.getElementById("repTitle"); if (h && h.offsetParent) h.focus({ preventScroll: true }); }));
    document.addEventListener("click", (e) => { if (PC() && e.target.closest && e.target.closest("#sList [data-id]") && !e.target.closest("[data-why]")) toH(); });
    const H = document.documentElement; let was = H.classList.contains("s-rep");
    const clr = () => { try { const id = location.hash.slice(1); if (id && byId[id]) history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {} };
    try { new MutationObserver(() => { const on = H.classList.contains("s-rep"); if (was && !on && PC()) clr(); was = on; }).observe(H, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
  }
  function init() {
    try { deskFocus(); } catch (e) {}
    const _rq = paneReq; paneReq = function (r) { const x = _rq.apply(this, arguments); try { reqBox(r); } catch (e) { console.warn(e); } return x; };
    const _rp = renderPane; renderPane = function () { const x = _rp.apply(this, arguments); try { tidyPane(); } catch (e) {} return x; };
    // 입주 현금 시간표는 첫 렌더·자료 도착 때 다른 경로로도 다시 그려져, 바뀔 때마다 '시점 미정'을 고친다
    let gq = 0;
    try { new MutationObserver(() => { if (gq) return; gq = requestAnimationFrame(() => { gq = 0; const p = document.getElementById("pane"); if (p && cur) try { fixGtl(p, cur); } catch (e) {} }); }).observe(document.getElementById("report"), { childList: true, subtree: true }); } catch (e) {}
    // 탭을 누르면 탭 막대가 위로 오게
    // (부드러운 스크롤은 새 탭 내용 높이가 바뀌며 중간에 멈춰 이전 탭 자리(scrollTop 893 등)에 남았다 → 바로 맞춘다)
    document.addEventListener("click", (e) => { const t = e.target.closest("#report [role=tab]"); if (!t) return; requestAnimationFrame(tabTop); });
    const _rr = renderReport;
    renderReport = function () { const x = _rr.apply(this, arguments); try { tabAff(); } catch (e) {} try { if (cur) { render(cur); if (matchMedia("(min-width:981px)").matches && document.documentElement.classList.contains("simple")) document.documentElement.classList.add("s-rep"); } } catch (e) { console.warn(e); } return x; };
    try { tabAff(); } catch (e) {}
    try { if (cur && document.querySelector("#report .rep-head")) { render(cur); if (matchMedia("(min-width:981px)").matches) document.documentElement.classList.add("s-rep"); } } catch (e) {}
  }
  return { init, render, gauge, smp: smpTxt, manT };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", OVX.init) : setTimeout(OVX.init, 0);
