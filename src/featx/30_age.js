/* F8 필지 연식 지도 — 일정 탭(노후도 게이지 아래)
   ① 연식 분포: 구역 안 필지(data/pcl · 매물진단과 같은 원자료)의 건물 사용승인연도를 30년 이상·20~30년·10~20년·10년 안으로 · 권리산정기준일 뒤 준공(신축) 필지 수
   ② 지도: 필지 가운데 점이 있는 구역(data/age/<id>.json · tools/agexy.py)만 — 구역 경계 위에 필지 점을 연식 색으로(신축은 테두리)
   노후도 % 머리 숫자는 시트 게이지(tx.old · 건물 전수)와 같은 값을 그대로 쓴다 — 여기 분포는 '필지' 단위라 따로 이름 붙인다 */
(function () {
  "use strict";
  const X = window.ZPX;
  const AGE = new Map();
  // 점 자료가 있는 구역 목록(data/age/index.json · tools/agexy.py)을 먼저 받아, 없는 구역은 파일을 부르지 않는다(404 없이)
  let IDX = null;
  const v = (ctx) => encodeURIComponent((ctx.D && (ctx.D.upd || ctx.D.asOf)) || "");
  const loadIdx = (ctx) => IDX || (IDX = fetch(`data/age/index.json?v=${v(ctx)}`).then((x) => (x.ok ? x.json() : [])).then((a) => new Set(Array.isArray(a) ? a : [])).catch(() => new Set()));
  const loadAge = (id, ctx) => AGE.get(id) || (AGE.set(id, loadIdx(ctx).then((S) => (S.has(id) ? fetch(`data/age/${id}.json?v=${v(ctx)}`).then((x) => (x.ok ? x.json() : null)).catch(() => null) : null))), AGE.get(id));
  const BANDS = [["o30", "30년 이상", 30, 1e9], ["o20", "20~30년", 20, 30], ["o10", "10~20년", 10, 20], ["n10", "10년 안", -1, 10]];
  // 숫자만(화면·QA 같은 값)
  X.ageDist = (pc, rd, nowY) => {
    const P = (pc && pc.p) || [], ry = rd ? +String(rd).slice(0, 4) : null, c = { o30: 0, o20: 0, o10: 0, n10: 0, none: 0, after: 0 };
    P.forEach((x) => { const y = +x[4] || 0; if (!y) { c.none++; return; } const a = nowY - y; const b = BANDS.find(([, , lo, hi]) => a >= lo && a < hi) || BANDS[0]; c[b[0]]++; if (ry && y > ry) c.after++; });
    const k = P.length - c.none;
    return { n: P.length, k, ...c, pct30: k ? Math.round((c.o30 / k) * 100) : null, ry };
  };
  const bandOf = (y, nowY) => { if (!y) return "none"; const a = nowY - y; return (BANDS.find(([, , lo, hi]) => a >= lo && a < hi) || BANDS[0])[0]; };
  const mapSVG = (A, geo, ry, nowY, esc, name) => {
    if (!A || !A.p || !A.p.length || !geo || !geo.g) return "";
    const ring = geo.g[0] || [], all = ring.concat(A.p.map((p) => [p[1], p[0]]));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; all.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180), W = 320, w = (x1 - x0) * k || 1e-4, h = y1 - y0 || 1e-4, H = Math.round(Math.min(300, Math.max(140, (W * h) / w))), s = Math.min((W - 12) / w, (H - 12) / h);
    const px = (x) => (6 + (x - x0) * k * s).toFixed(1), py = (y) => (H - 6 - (y - y0) * s).toFixed(1);
    const poly = geo.g.map((rg) => `<path class="zg" d="${rg.map(([x, y], i) => `${i ? "L" : "M"}${px(x)} ${py(y)}`).join(" ")}Z"/>`).join("");
    const dots = A.p.map((p) => { const b = bandOf(p[3] || p[2], nowY), nw = ry && p[3] > ry; return `<circle class="za ${b}${nw ? " nw" : ""}" cx="${px(p[1])}" cy="${py(p[0])}" r="${nw ? 3.2 : 2.4}"/>`; }).join("");
    return `<svg class="zxa-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)} 필지 ${A.k}곳의 건물 연식 지도">${poly}${dots}</svg>`;
  };
  X.agePane = (r, pane, ctx) => {
    if (!r || r.src === "moa" || !r.pcl || r.s >= 7) { const o = pane.querySelector('[data-f="age"]'); if (o) o.remove(); return; }
    X.css();
    const nowY = +String((ctx.D && (ctx.D.upd || ctx.D.asOf)) || "").slice(0, 4) || new Date().getFullYear();
    Promise.all([ctx.pcl(r.id), loadAge(r.id, ctx)]).then(([pc, A]) => {
      if (ctx.cur() !== r || !pane.isConnected) return;
      let rt = null; try { rt = ctx.rights(r); } catch (e) {}
      const rd = rt && rt.k === "set" ? rt.d : null, esc = ctx.esc, fmt = ctx.fmt;
      const d = X.ageDist(pc, rd ? rd.replace(/\./g, "-") : null, nowY);
      if (!d.k) { const o = pane.querySelector('[data-f="age"]'); if (o) o.remove(); return; }
      const bar = BANDS.map(([k, t]) => d[k] ? `<i class="${k}" style="width:${((d[k] / d.k) * 100).toFixed(1)}%" title="${t} ${d[k]}필지"></i>` : "").join("");
      const svg = mapSVG(A, ctx.geo ? ctx.geo(r.id) : null, d.ry, nowY, esc, ctx.shortName(r.n));
      const html = `<div class="sect zxa"><h3>필지 연식 지도 <small>구역 안 필지 ${fmt(d.n)}곳 · 건물 사용승인연도 확인 ${fmt(d.k)}곳 · ${nowY}년 기준</small></h3>
        ${svg || ""}
        <div class="zxa-bar" role="img" aria-label="${BANDS.map(([k, t]) => `${t} ${d[k]}필지`).join(", ")}">${bar}</div>
        <ul class="zxa-key">${BANDS.map(([k, t]) => `<li><i class="${k}"></i>${t} <b>${fmt(d[k])}</b></li>`).join("")}${d.ry ? `<li><i class="nw"></i>권리산정기준일(${esc(rd)}) 뒤 준공 <b>${fmt(d.after)}</b></li>` : ""}</ul>
        <p class="zxa-n">필지 단위 30년 이상 비율 <b>${d.pct30}%</b> · 위 노후도 게이지는 건물 ${r.tx && r.tx.old ? fmt(r.tx.old.n) + "동" : ""} 전수 기준이라 값이 다를 수 있어요${svg ? "" : " · 필지 위치 자료가 아직 없어 지도 대신 분포만 보여요"}</p>
        <p class="zxa-src">자료: 서울도시공간포털 건물 정보(사용승인연도) · 연속지적 필지 · 한 필지에 건물이 여러 동이면 가장 새 건물 기준 · 신축 여부는 권리산정기준일과의 비교로만 판단해요(추정·확인 필요)</p></div>`;
      const F = window.ZPF;
      const put = (n) => { const tl = pane.querySelector('[data-f="timeline"]'), ow = pane.querySelector(".ov-oldw"); if (ow) ow.after(n); else if (tl) tl.after(n); else pane.appendChild(n); };
      if (F && F.put) F.put(pane, "age", html, put);
    });
  };
})();
