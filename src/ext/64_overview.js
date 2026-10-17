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
    const lv = v >= 75 ? "hi" : v >= 60 ? "ok" : "lo";
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
    if (!o || !o.k || r.s >= 7) return "";
    const ok = o.pol >= 60;
    return `<div class="ov-c ov-old"><div class="ov-gw">${gauge(o.pol)}<div class="ov-gs"><h3>노후도</h3><b class="${ok ? "ok" : "no"}">${ok ? "요건 충족" : "요건 미달"}</b><span>30년+ ${o.p30}% · 평균 ${o.avg}년${o.new10 ? ` · 신축 ${o.new10}동` : ""}</span></div></div></div>`;
  }
  // 분기별 가운데 값 막대(최근 3년): 마지막 분기 값과 최고 값만 숫자로
  function chart(r, q, unit) {
    const cut = String(new Date().getFullYear() - 3).slice(-2);
    const qq = q.filter((x) => x[0].slice(0, 2) >= cut).slice(-12);
    if (qq.length < 3) return "";
    const W = 320, H = 132, pb = 20, pt = 18, n = qq.length, gap = 4, bw = Math.min(26, (W - gap * (n - 1)) / n);
    const mx = Math.max(...qq.map((x) => x[1])), mn = Math.min(...qq.map((x) => x[1])) * 0.7;
    const X = (i) => i * (bw + gap) + (W - n * (bw + gap) + gap) / 2, Y = (v) => pt + (H - pt - pb) * (1 - (v - mn) / Math.max(1, mx - mn));
    const imx = qq.findIndex((x) => x[1] === mx);
    let lastYr = "";
    const bars = qq.map((x, i) => {
      const y = Y(x[1]), yr = "20" + x[0].slice(0, 2), lab = yr !== lastYr ? ((lastYr = yr), `<text x="${(X(i)).toFixed(1)}" y="${H - 4}" class="yr">${yr}</text>`) : "";
      const cx = X(i) + bw / 2, anc = cx > W - 24 ? "end" : cx < 24 ? "start" : "middle", tx = anc === "end" ? X(i) + bw : anc === "start" ? X(i) : cx;
      const v = i === n - 1 || (i === imx && imx < n - 2) ? `<text x="${tx.toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="${anc}" class="bv${i === n - 1 ? " last" : ""}">${eok(x[1])}</text>` : "";
      return `<rect x="${X(i).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - pb - y).toFixed(1)}" rx="4" class="${i === n - 1 ? "on" : ""}"><title>${x[0]} · ${eok(x[1])} · ${x[2]}건</title></rect>${v}${lab}`;
    }).join("");
    return `<div class="ov-ch"><div class="ov-cht">${unit} · 분기별</div><svg class="ov-bar" viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit} 분기별 가운데 값">${bars}</svg></div>`;
  }
  function txHTML(t, r, d) {
    const S = (d && Array.isArray(d.s) ? d.s : []).slice(0, 3);
    const has = t.n || t.jn;
    if (!has) return `<div class="ov-c ov-tx"><h3>실거래</h3><p class="ov-none">최근 구역 안 거래 없음</p>${t.nb ? nearHTML(t.nb) : ""}</div>`;
    const yoy = r.tx && r.tx.yoy != null ? `<em class="${r.tx.yoy >= 0 ? "up" : "dn"}">1년 ${r.tx.yoy >= 0 ? "▲" : "▼"} ${Math.abs(r.tx.yoy)}%</em>` : "";
    const last = S[0] ? ym(S[0][0]) : "";
    const TY = ["빌라", "단독", "아파트", "입주권"];
    const A = !!t.am && (/재건축/.test(r.k) || (!t.pp && !t.med));   // 재건축은 아파트 값이 기준
    const big = A ? ["아파트 매매", eok(t.am)] : t.pp ? ["대지 3.3㎡당", eok(t.pp)] : t.med ? ["빌라 매매", eok(t.med)] : t.am ? ["아파트 매매", eok(t.am)] : null;
    const chips = [!A && t.med && big && big[0] !== "빌라 매매" ? `빌라 ${eok(t.med)}` : "", A && t.pp ? `대지 평당 ${eok(t.pp)}` : "", t.jm ? `전세 ${eok(t.jm)}` : "", last ? `최근 ${last}` : ""].filter(Boolean);
    return `<div class="ov-c ov-tx"><h3>실거래 ${yoy}</h3>
      ${big ? `<div class="ov-big"><span>${big[0]}</span><b>${big[1]}</b></div>` : ""}
      ${chips.length ? `<div class="ov-chips">${chips.map((c) => `<span>${c}</span>`).join("")}</div>` : ""}
      ${A && t.qa && t.qa.length > 2 ? chart(r, t.qa, "아파트 매매") : chart(r, (t.q || []).filter((x) => x[2] >= 2), "대지 3.3㎡당") || (t.qa ? chart(r, t.qa, "아파트 매매") : "")}
      ${S.length ? `<ul class="ov-l">${S.map((x) => `<li><span>${esc(ym(x[0]))}</span><span>${TY[x[1]] || ""}${x[6] ? ` ${esc(String(x[6]))}층` : ""}${x[3] ? ` · ${x[3]}㎡` : ""}</span><b>${eok(x[5])}</b></li>`).join("")}</ul>` : ""}
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
          mm.addLayer({ id: "zl", type: "line", source: "z", paint: { "line-color": "#1f3a87", "line-width": 2.5 } });
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
    w.innerHTML = `<div class="ov-map" id="ovMap" role="img" aria-label="${esc(shortName(r.n))} 위치"></div><div class="ov-row"><div class="ov-oldw">${oldHTML(t0, r)}</div><div class="ov-txw">${txHTML(t0, r, null)}</div></div>`;
    // 주소 줄: 구 동 · 단계 · 역 도보
    const wh = head.querySelector(".where");
    if (wh) { const dong = ((r.bj || r.j || "").match(/^[가-힣0-9]+?(?:동\d*가|동|가|로)/) || [""])[0]; const st = r.st && r.st.d ? `${r.st.n.replace(/역$/, "")}역 ${Math.max(1, Math.round(r.st.d * 1.3 / 67))}분` : ""; wh.classList.add("ov-w"); wh.removeAttribute("title"); wh.innerHTML = `<b>${esc(r.g)} ${esc(dong)}</b><span class="ov-chip">${esc(stageName(r))}</span>${st ? `<span class="ov-chip g">${esc(st)}</span>` : ""}`; }
    const where = head.querySelector(".where");
    (where || head.firstElementChild).after(w);
    w.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; const tb = document.getElementById("tab-" + b.dataset.tab); if (tb) { tb.click(); tb.scrollIntoView({ block: "start", behavior: "smooth" }); } });
    mini(r);
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
    const p = document.getElementById("pane"); if (!p) return;
    p.querySelectorAll("dl.facts > div").forEach((d) => { const t = d.textContent; if (/자료 없음|미공개|계산 불가|일반분양 비율/.test(t)) d.hidden = true; });
  }
  function init() {
    const _rp = renderPane; renderPane = function () { const x = _rp.apply(this, arguments); try { tidyPane(); } catch (e) {} return x; };
    const _rr = renderReport;
    renderReport = function () { const x = _rr.apply(this, arguments); try { if (cur) { render(cur); if (matchMedia("(min-width:981px)").matches && document.documentElement.classList.contains("simple")) document.documentElement.classList.add("s-rep"); } } catch (e) { console.warn(e); } return x; };
    try { if (cur && document.querySelector("#report .rep-head")) { render(cur); if (matchMedia("(min-width:981px)").matches) document.documentElement.classList.add("s-rep"); } } catch (e) {}
  }
  return { init, render, gauge };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", OVX.init) : setTimeout(OVX.init, 0);
