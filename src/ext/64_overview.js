/* ===================== 구역 상세 맨 위: 위치 지도 · 실거래 · 노후도 =====================
   사람들이 제일 먼저 보는 것(어디인지, 얼마에 거래되는지, 얼마나 낡았는지)을 탭보다 먼저 보여 준다. */
const OVX = (() => {
  let mm = null, mmId = null;
  const ym = (d) => (d && d.length >= 6 ? `${d.slice(2, 4)}.${d.slice(4, 6)}` : "");
  const eok = (m) => (m == null || !isFinite(m) ? "–" : m >= 10000 ? (Math.round(m / 1000) / 10).toLocaleString("ko-KR") + "억" : Math.round(m).toLocaleString("ko-KR") + "만");
  const e1 = (v) => (v == null || !isFinite(v) ? "–" : v >= 1e4 ? `${(v / 1e4).toFixed(1).replace(/\.0$/, "")}억` : `${Math.round(v).toLocaleString()}만`);
  // 노후도 게이지(반원): 기준선 60%
  function gauge(pct) {
    const R = 54, C = Math.PI * R, v = Math.max(0, Math.min(100, pct));
    const lv = v >= 60 ? "hi" : "lo";
    const ang = Math.PI * (1 - 0.6), tx = 70 + Math.cos(ang) * R, ty = 66 - Math.sin(ang) * R;
    const ang2 = Math.PI * (1 - 2 / 3);
    return `<svg class="ov-g ${lv}" viewBox="0 -12 140 92" role="img" aria-label="노후 건축물 ${v}%, 재개발 기준 60%">
      <path d="M16 66a54 54 0 0 1 108 0" class="tr"/>
      <path d="M16 66a54 54 0 0 1 108 0" class="fg" stroke-dasharray="${(C * v / 100).toFixed(1)} ${C.toFixed(1)}"/>
      <line x1="${(70 + Math.cos(ang) * (R - 10)).toFixed(1)}" y1="${(66 - Math.sin(ang) * (R - 10)).toFixed(1)}" x2="${(70 + Math.cos(ang) * (R + 10)).toFixed(1)}" y2="${(66 - Math.sin(ang) * (R + 10)).toFixed(1)}" class="tk"/>
      <line x1="${(70 + Math.cos(ang2) * (R - 8)).toFixed(1)}" y1="${(66 - Math.sin(ang2) * (R - 8)).toFixed(1)}" x2="${(70 + Math.cos(ang2) * (R + 8)).toFixed(1)}" y2="${(66 - Math.sin(ang2) * (R + 8)).toFixed(1)}" class="tk t2"/>
      <text x="${(tx - 4).toFixed(1)}" y="${(ty - 13).toFixed(1)}" class="tl" text-anchor="end">60</text>
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
  function verdicts(r) {
    const out = [], fin = isDone(r); let noIp = false;
    if (!fin) {
      try {
        const w = buyWindow(r), rt = (() => { try { return ZX.rights(r); } catch (e) { return {}; } })();
        const [c, v] = w.cls === "ok" ? ["ok", "✓ 나와요"] : w.cls === "no" ? ["no", "✕ 안 나와요"] : ["warn", "! 확인 필요"];
        noIp = c === "no";
        out.push({ k: "입주권", c, v, why: () => [w.due || w.t, rt.k === "set" ? `권리산정기준일 ${rt.d} 전 건물만` : ""].filter(Boolean).join(" · ") });
      } catch (e) {}
      if (!noIp) try {
        const lp = landPermit(r);
        let blk = null; try { blk = gapOf(r).block; } catch (e) { blk = typeof gapBlock === "function" ? gapBlock(r) : null; }
        if (lp) out.push({ k: "전세 끼고", c: "no", v: /가능성/.test(lp.t) ? "! 토지거래허가 가능성" : "✕ 토지거래허가·실거주 2년", why: () => (/가능성/.test(lp.t) ? "신속통합기획 구역은 토지거래허가로 묶이는 경우가 많아요 · 구청 확인" : "토지거래허가구역 · 2년 실거주라 전세 낀 매수 불가") });
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
    return `<div class="ov-vd" role="group" aria-label="판정">${V.map((x, i) => `<button type="button" class="ov-p ${x.c}" data-vi="${i}" aria-expanded="false"><span>${esc(x.k)}</span><b>${esc(x.v)}</b></button>`).join("")}</div><p class="ov-why" hidden></p>`;
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
    const sm = isSmallR(r);
    return [["구역지정", 2], ["추진위", 3], [r.trust ? "시행자지정" : "조합설립", 4], ["사업시행", 5], ["관리처분", 6], ["착공", 8], ["준공", 9]].filter(([k]) => !(sm && (k === "구역지정" || k === "관리처분")) && !(r.trust && k === "추진위"));
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
    const pre = i < 0 ? `<span class="ov-tl-now">지금 ${esc(stageName(r))}</span>` : "";
    const li = T.map(([k], n) => { const d = stepDate(r, k), st = n < i || (n === i && done) ? "dn" : n === i ? "on" : ""; return `<li class="${st}"><i></i><b>${k === "시행자지정" ? "시행자" : k}</b><small>${d ? esc(d.slice(2, 7).replace("-", ".")) : n <= i ? "–" : ""}</small></li>`; }).join("");
    return `<div class="ov-c ov-tl"><h3>진행 단계 ${pre}<em class="ov-pv" hidden></em></h3><div class="ov-tl-sc"><ol style="--n:${T.length}">${li}</ol></div></div>`;
  }
  function srcHTML(r) {
    const s = D.txAsOf && D.txAsOf.sale, d = s && s.length >= 8 ? `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}` : "";
    const cafe = r.cafe ? `<a href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl=${encodeURIComponent(r.cafe)}" target="_blank" rel="noopener">정비몽땅 ↗</a>` : "정비몽땅";
    return `<p class="ov-src">자료 기준${d ? ` 실거래 ${d}` : ""} · ${cafe} · <a href="https://www.eum.go.kr/" target="_blank" rel="noopener">토지이음 ↗</a></p>`;
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
  // 분기별 가운데 값 막대(최근 3년): 마지막 분기 값과 최고 값만 숫자로
  function chart(r, q, unit) {
    const cut = String(new Date().getFullYear() - 3).slice(-2);
    const nd = new Date(), curQ = `${String(nd.getFullYear()).slice(2)}Q${Math.floor(nd.getMonth() / 3) + 1}`;
    const qq = q.filter((x) => x[0].slice(0, 2) >= cut && x[0] !== curQ).slice(-12);
    if (qq.length < 3) return "";
    const W = 320, H = 132, pb = 20, pt = 18, n = qq.length, gap = 4, bw = Math.min(26, (W - gap * (n - 1)) / n);
    const mx = Math.max(...qq.map((x) => x[1])), mn = Math.min(...qq.map((x) => x[1])) * 0.7;
    const X = (i) => i * (bw + gap) + (W - n * (bw + gap) + gap) / 2, Y = (v) => pt + (H - pt - pb) * (1 - (v - mn) / Math.max(1, mx - mn));
    const imx = qq.findIndex((x) => x[1] === mx);
    let lastYr = "";
    const bars = qq.map((x, i) => {
      const y = Y(x[1]), yr = "20" + x[0].slice(0, 2), lab = yr !== lastYr ? ((lastYr = yr), `<text x="${(X(i)).toFixed(1)}" y="${H - 4}" class="yr">${yr}</text>`) : "";
      const cx = X(i) + bw / 2, anc = i === n - 1 && cx > W - 90 ? "end" : cx > W - 24 ? "end" : cx < 24 ? "start" : "middle", tx = anc === "end" ? X(i) + bw : anc === "start" ? X(i) : cx;
      const v = i === n - 1 || (i === imx && imx < n - 2) ? `<text x="${tx.toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="${anc}" class="bv${i === n - 1 ? " last" : ""}">${eok(x[1])}</text>` : "";
      return `<rect x="${X(i).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - pb - y).toFixed(1)}" rx="4" class="${i === n - 1 ? "on" : ""}"><title>${x[0]} · ${eok(x[1])} · ${x[2]}건</title></rect>${v}${lab}`;
    }).join("");
    return `<div class="ov-ch"><div class="ov-cht">${unit} · 분기별 <b>최근 ${eok(qq[n - 1][1])}</b></div><svg class="ov-bar" viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit} 분기별 가운데 값">${bars}</svg></div>`;
  }
  // 파이프라인이 만든 한 기준(hd)으로 큰 숫자·칩·그래프·최근 거래를 모두 맞춘다
  function hdHTML(h, t, r) {
    const BN = { i: "입주권", a: "아파트", v: "빌라·단독 대지" }[h.b];
    const yoy = h.b === "v" && r.tx && r.tx.yoy != null ? `<em class="${r.tx.yoy >= 0 ? "up" : "dn"}">1년 ${r.tx.yoy >= 0 ? "▲" : "▼"} ${Math.abs(r.tx.yoy)}%</em>` : "";
    const per = `${BN} 3.3㎡당`;
    const win = h.w === 0 ? "최근 거래" : h.w === 24 ? "2년" : "1년";
    const sz = h.b !== "v" && h.pa ? `전용 ${Math.round(h.pa)}㎡ 기준 ${eok(h.p)}` : h.p ? `가운데 거래가 ${eok(h.p)}` : "";
    const chips = [sz, `${win} ${h.n}건`, h.to ? `최근 ${ym(h.to)}` : ""].filter(Boolean);
    const TY = ["빌라", "단독", "아파트", "입주권"], S = (h.r || []).slice(0, matchMedia("(max-width:640px)").matches ? 2 : 3);
    return `<div class="ov-c ov-tx"><h3>실거래 ${yoy}</h3>
      <div class="ov-big"><span>${per}</span><b>${eok(h.u)}</b></div>
      <div class="ov-chips">${chips.map((c) => `<span>${c}</span>`).join("")}</div>
      ${h.q && h.q.length > 2 ? chart(r, h.q, per) : ""}
      ${S.length ? `<ul class="ov-l">${S.map((x) => `<li><span>${esc(ym(x[0]))}</span><span>${TY[x[1]] || ""}${x[6] ? ` ${+x[6] < 0 ? "지하" + -x[6] : esc(String(x[6]))}층` : ""}${x[3] ? ` · ${x[3]}㎡` : ""}</span><b>${eok(x[5])}</b></li>`).join("")}</ul>` : ""}
      <button type="button" class="ov-more" data-tab="tx">거래 전체 보기 →</button></div>`;
  }
  function txHTML(t, r, d) {
    if (t.hd && t.hd.u) return hdHTML(t.hd, t, r);
    const S = (d && Array.isArray(d.s) ? d.s : []).slice(0, 3);
    const has = t.pp || t.med || t.am || t.im;
    if (!has) return `<div class="ov-c ov-tx"><h3>실거래</h3><p class="ov-none">최근 구역 안 거래 없음</p>${t.nb ? nearHTML(t.nb) : ""}</div>`;
    const yoy = r.tx && r.tx.yoy != null ? `<em class="${r.tx.yoy >= 0 ? "up" : "dn"}">1년 ${r.tx.yoy >= 0 ? "▲" : "▼"} ${Math.abs(r.tx.yoy)}%</em>` : "";
    const last = S[0] ? ym(S[0][0]) : "";
    const TY = ["빌라", "단독", "아파트", "입주권"];
    const A = !!t.am && (/재건축/.test(r.k) || (!t.pp && !t.med));   // 재건축은 아파트 값이 기준
    const IP = r.s >= 8 && t.im;                                        // 착공 뒤엔 입주권 거래가 기준
    const big = IP ? ["입주권 · 1년", eok(t.im)] : A ? ["아파트 매매 · 1년", eok(t.am)] : t.pp ? ["대지 3.3㎡당 · 1년", eok(t.pp)] : t.med ? ["빌라 매매 · 1년", eok(t.med)] : t.am ? ["아파트 매매 · 1년", eok(t.am)] : null;
    const ser = IP ? [t.qi, "입주권"] : A || (!t.pp && t.am) ? [t.qa, "아파트 매매"] : t.pp ? [(t.q || []).filter((x) => x[2] >= 2), "대지 3.3㎡당"] : [null, ""];
    const chips = [!IP && !A && t.med && big && !/빌라/.test(big[0]) ? `빌라 ${eok(t.med)}` : "", (t.n12 || t.n) ? `거래 ${t.n12 || t.n}건` : "", last ? `최근 ${last}` : ""].filter(Boolean);
    return `<div class="ov-c ov-tx"><h3>실거래 ${yoy}</h3>
      ${big ? `<div class="ov-big"><span>${big[0]}</span><b>${big[1]}</b></div>` : ""}
      ${chips.length ? `<div class="ov-chips">${chips.map((c) => `<span>${c}</span>`).join("")}</div>` : ""}
      ${ser[0] && ser[0].length > 2 ? chart(r, ser[0], ser[1]) : ""}
      ${S.length ? `<ul class="ov-l">${S.map((x) => `<li><span>${esc(ym(x[0]))}</span><span>${TY[x[1]] || ""}${x[6] ? ` ${+x[6] < 0 ? "지하" + -x[6] : esc(String(x[6]))}층` : ""}${x[3] ? ` · ${x[3]}㎡` : ""}</span><b>${eok(x[5])}</b></li>`).join("")}</ul>` : ""}
      <button type="button" class="ov-more" data-tab="tx">거래 전체 보기 →</button></div>`;
  }
  function nearHTML(nr) {
    return nr && nr.n ? `<div class="ov-near"><span>같은 동(${esc(nr.dong || "")}) 빌라 매매 · 1년 ${nr.n}건</span><b>${eok(nr.med)}</b></div>` : "";
  }
  function apt(t, r) {   // 재건축 아파트 단지 거래
    const a = t.apt; if (!a || !a.n) return "";
    return `<div class="ov-c ov-tx"><h3>단지 실거래</h3><div class="ov-k"><div><span>최근 거래</span><b>${eok(a.last)}</b></div><div><span>1년 가운데 값</span><b>${a.med ? eok(a.med) : "–"}</b></div><div><span>거래 수(1년)</span><b>${a.n}건</b></div></div></div>`;
  }
  function mini(r) {
    const box = document.getElementById("ovMap"); if (!box) return;
    if (!window.matchMedia("(max-width:980px)").matches) { box.remove(); return; }
    Promise.all([LMX.lib(), LMX.geo()]).then(([, g]) => {
      if (!document.getElementById("ovMap") || cur !== r || !window.maplibregl) return;
      const z0 = g && g.z && g.z[r.id], z = z0 && !z0.e ? z0 : null;   // 추정 원은 경계처럼 그리지 않는다
      if (!z && !r.ll) { box.remove(); return; }
      let bb;
      if (z) { let a = 180, b = 90, c = -180, d = -90; z.g.forEach((rg) => rg.forEach(([x, y]) => { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; })); bb = [[a, b], [c, d]]; }
      try { if (mm) mm.remove(); } catch (e) {}
      mm = new maplibregl.Map({ container: "ovMap", style: LMX.style(), interactive: false, attributionControl: false, preserveDrawingBuffer: true, fadeDuration: 0, ...(bb ? { bounds: bb, fitBoundsOptions: { padding: 28, maxZoom: 16.2 } } : { center: [r.ll[1], r.ll[0]], zoom: 15 }) });
      mmId = r.id;
      const fit = () => { try { mm.resize(); if (bb) mm.fitBounds(bb, { padding: 28, maxZoom: 16.2, duration: 0 }); } catch (e) {} };
      try { new ResizeObserver(fit).observe(box); } catch (e) {}
      setTimeout(fit, 350); setTimeout(fit, 900);
      // 다 그려지면 그림으로 바꿔 WebGL을 놓아 준다(시트 스크롤·메모리)
      mm.once("idle", () => setTimeout(() => { try { if (!mm || mmId !== r.id) return; const url = mm.getCanvas().toDataURL("image/png"); const im = new Image(); im.alt = ""; im.src = url; im.className = "ov-img"; const m = mm; mm = null; m.remove(); box.innerHTML = ""; box.appendChild(im); } catch (e) {} }, 120));
      mm.on("load", () => {
        try { mm.addSource("sub", { type: "geojson", data: LMX.subway() }); mm.addLayer({ id: "sub", type: "line", source: "sub", paint: { "line-color": ["get", "c"], "line-width": 3, "line-opacity": 0.85 } }); } catch (e) {}
        if (z) {
          mm.addSource("z", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: {} } });
          mm.addLayer({ id: "zf", type: "fill", source: "z", paint: { "fill-color": "#2f6feb", "fill-opacity": 0.16 } });
          mm.addLayer({ id: "zl", type: "line", source: "z", paint: { "line-color": matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light" || document.documentElement.dataset.theme === "dark" ? "#8fb0ff" : "#1f3a87", "line-width": 2.5 } });
        } else {
          mm.addSource("p", { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: [r.ll[1], r.ll[0]] }, properties: {} } });
          mm.addLayer({ id: "p", type: "circle", source: "p", paint: { "circle-radius": 8, "circle-color": "#1f3a87", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
        }
      });
      box.onclick = () => { try { closeSheetNow(); } catch (e) {} setTimeout(() => { try { LMX.focus(true); } catch (e) {} }, 250); };
    }).catch(() => box.remove());
  }
  function render(r) {
    const head = document.querySelector("#report .rep-head");
    if (!head || !r || head.querySelector(".ov-top")) return;
    const w = document.createElement("div");
    w.className = "ov-top"; w.id = "ovTop";
    const t0 = r.tx || {};
    const V = verdicts(r);
    w.innerHTML = `<div class="ov-vdw">${vdHTML(V)}</div><div class="ov-map" id="ovMap" role="img" aria-label="${esc(shortName(r.n))} 위치"></div><div class="ov-row"><div class="ov-oldw">${oldHTML(t0, r)}</div><div class="ov-txw">${txHTML(t0, r, null)}</div></div><div class="ov-tlw">${tlHTML(r)}</div><div class="ov-srcw">${srcHTML(r)}</div>`;
    vdBind(w, V);
    // 주소 줄: 구 동 · 단계 · 역 도보
    const wh = head.querySelector(".where");
    if (wh) { const dong = ((r.j || r.bj || "").match(/^(?:서울(?:특별)?시\s*)?(?:[가-힣]+구\s+)?([가-힣]+?(?:\d+(?:·\d+)*)?(?:동\d+가|로\d+가|\d+가|동|로|가))(?=[\s\d(산]|$)/) || [, r.dg || ""])[1]; const wm = r.st && r.st.d ? Math.max(1, Math.round(r.st.d * 1.3 / 67)) : 0, st = wm ? (wm > 20 ? "역에서 멀어요" : `${r.st.n.replace(/역$/, "")}역 ${wm}분`) : ""; wh.classList.add("ov-w"); wh.removeAttribute("title"); wh.innerHTML = `<b>${esc(r.g)} ${esc(dong)}</b><span class="ov-chip">${esc(stageName(r))}</span>${st ? `<span class="ov-chip g">${esc(st)}</span>` : ""}${r.lc ? `<span class="ov-chip w">거래 적어 추정</span>` : r.nbp ? `<span class="ov-chip g">주변 시세 기준</span>` : ""}${r.sl && r.sl.k ? `<span class="ov-chip g ov-sl"${r.sl.d != null && isFinite(r.sl.d) ? ` title="고저차 ${Math.round(+r.sl.d)}m"` : ""}>경사 ${esc(r.sl.k)}</span>` : ""}`; }
    const where = head.querySelector(".where");
    (where || head.firstElementChild).after(w);
    w.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; const tb = document.getElementById("tab-" + b.dataset.tab); if (tb) { tb.click(); tb.scrollIntoView({ block: "start", behavior: "smooth" }); } });
    mini(r);
    late(r, w);
    if (!r._prem && FREE) premLoad(r).then(() => late(r, w)).catch(() => {});
    // 착공 뒤: 입주권 거래는 있지만 투기과열지구라 예외 매물만 — 한 줄로
    const rk = head.querySelector(".lb-risk"); if (rk && r.s >= 8) rk.textContent = "착공 구역 · 입주권은 예외 매물만 살 수 있어요";
    ZX.loadTx().then((d) => {
      if (cur !== r || !document.getElementById("ovTop")) return;
      const t = { ...(r.tx || {}), ...((d && d[r.id] && d[r.id].x) || {}) };
      const tw = w.querySelector(".ov-txw");
      tw.innerHTML = apt(t, r) || txHTML(t, r, d && d[r.id]);
      const ow = w.querySelector(".ov-oldw");
      if (ow && !ow.innerHTML.trim()) ow.innerHTML = oldHTML(t, r);
    }).catch(() => {});
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
    if (curTab === "money" && apt) p.querySelectorAll(".rvj").forEach((x) => (x.hidden = true));
    if (curTab === "req") hideSect(/적용 기준|동의 기준|접도|조례/);
    // 입주 현금 탭이 접힌 근거만 남아 비면, 위 카드의 결론을 한 번 더 크게
    if (curTab === "money") {
      const vis = [...p.children].filter((x) => !x.hidden && getComputedStyle(x).display !== "none" && !x.classList.contains("s-fold"));
      if (!vis.length) { const cs = document.querySelector("#report .rep-head .cstrip"); p.insertAdjacentHTML("afterbegin", `<p class="ov-msg">${cs && cs.classList.contains("gblock") ? "전세 끼고는 살 수 없는 구역이에요. 위 '대출 끼고' 금액을 보세요." : "이 구역은 아직 계산할 자료가 부족해요."}</p>`); }
    }
    p.querySelectorAll("dl.facts > div").forEach((d) => { const t = d.textContent; if (/자료 없음|미공개|계산 불가|일반분양 비율/.test(t)) d.hidden = true; });
  }
  function init() {
    const _rp = renderPane; renderPane = function () { const x = _rp.apply(this, arguments); try { tidyPane(); } catch (e) {} return x; };
    // 탭을 누르면 탭 막대가 위로 오게
    document.addEventListener("click", (e) => { const t = e.target.closest("#report [role=tab]"); if (!t) return; requestAnimationFrame(() => { const tb = document.querySelector("#report .tabs"); if (tb) tb.scrollIntoView({ block: "start", behavior: "smooth" }); }); });
    const _rr = renderReport;
    renderReport = function () { const x = _rr.apply(this, arguments); try { if (cur) { render(cur); if (matchMedia("(min-width:981px)").matches && document.documentElement.classList.contains("simple")) document.documentElement.classList.add("s-rep"); } } catch (e) { console.warn(e); } return x; };
    try { if (cur && document.querySelector("#report .rep-head")) { render(cur); if (matchMedia("(min-width:981px)").matches) document.documentElement.classList.add("s-rep"); } } catch (e) {}
  }
  return { init, render, gauge };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", OVX.init) : setTimeout(OVX.init, 0);
