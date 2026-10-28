/* F5 가격 흐름 — 거래 탭
   ① 실거래 산점도(3.3㎡당 · 빌라·단독은 대지, 아파트·입주권은 전용) + 분기 가운데 값 선 · 전용면적 거르기
   ② 분기 가운데 값 표(최근 8분기, 건수와 함께)
   ③ 전세가율 추이: 같은 구역 연립·다세대의 분기별 전세 보증금 ㎡당 가운데 값 ÷ 매매 ㎡당 가운데 값(분기마다 양쪽 2건 이상만) — 추정
   자료: 국토부 실거래(서울 열린데이터광장) — 거래 탭 표와 같은 구역 거래(data/tx.json) */
(function () {
  "use strict";
  const F = window.ZPF;
  const P33 = 3.3058;
  const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const qOf = (d) => { const s = String(d); return `${s.slice(2, 4)}Q${Math.floor((+s.slice(4, 6) - 1) / 3) + 1}`; };
  const yOf = (d) => { const s = String(d); return +s.slice(0, 4) + (+s.slice(4, 6) - 1) / 12 + (+s.slice(6, 8) - 1) / 365; };
  const AREA = [["all", "전체", 0, 1e9], ["s", "40㎡ 이하", 0, 40], ["m", "40~60㎡", 40, 60], ["l", "60~85㎡", 60, 85], ["x", "85㎡ 넘게", 85, 1e9]];
  // 숫자만(화면·QA 같은 값). basis 'v' = 빌라·단독(대지 3.3㎡당) · 'a' = 아파트·입주권(전용 3.3㎡당)
  F.px = (z, basis, ak) => {
    const S = (z && Array.isArray(z.s) ? z.s : []), J = (z && Array.isArray(z.j) ? z.j : []);
    const A = AREA.find((x) => x[0] === (ak || "all")) || AREA[0];
    const inA = (a) => a > A[2] && a <= A[3] || (A[0] === "all");
    const pts = S.filter((v) => (basis === "v" ? v[1] <= 1 && v[4] > 0 : v[1] >= 2 && v[3] > 0) && (A[0] === "all" || (v[3] > 0 && inA(v[3]))))
      .map((v) => ({ d: v[0], y: yOf(v[0]), q: qOf(v[0]), t: v[1], u: v[5] / ((basis === "v" ? v[4] : v[3]) / P33) }));
    const Q = {};
    pts.forEach((p) => { (Q[p.q] = Q[p.q] || []).push(p.u); });
    const qs = Object.keys(Q).sort((a, b) => (a.slice(0, 2) + a.slice(3)).localeCompare(b.slice(0, 2) + b.slice(3))).map((q) => ({ q, m: Math.round(med(Q[q])), n: Q[q].length }));
    // 전세가율: 연립·다세대(유형 0) 매매 ㎡당 vs 전세 ㎡당, 분기마다 양쪽 2건 이상
    const SQ = {}, JQ = {};
    S.filter((v) => v[1] === 0 && v[3] > 0).forEach((v) => { (SQ[qOf(v[0])] = SQ[qOf(v[0])] || []).push(v[5] / v[3]); });
    J.filter((v) => v[2] > 0 && v[3] > 0).forEach((v) => { (JQ[qOf(v[0])] = JQ[qOf(v[0])] || []).push(v[3] / v[2]); });
    const jr = Object.keys(JQ).filter((q) => SQ[q] && SQ[q].length >= 2 && JQ[q].length >= 2).sort((a, b) => (a.slice(0, 2) + a.slice(3)).localeCompare(b.slice(0, 2) + b.slice(3)))
      .map((q) => ({ q, r: Math.round((med(JQ[q]) / med(SQ[q])) * 100), ns: SQ[q].length, nj: JQ[q].length }));
    return { pts, qs, jr };
  };
  const basisOf = (r, z) => {
    const S = (z && z.s) || [], nv = S.filter((v) => v[1] <= 1 && v[4] > 0).length, na = S.filter((v) => v[1] >= 2 && v[3] > 0).length;
    const hb = z && z.x && z.x.hd && z.x.hd.b;
    return { nv, na, def: hb ? (hb === "v" ? "v" : "a") : nv >= na ? "v" : "a" };
  };
  // 사이클 2: y축은 반올림한 눈금(1·2·2.5·5 × 10^k) · 단위 표기 · x축은 처음·끝 시점(YY.MM)과 그 사이 해 경계만 · 기준일 뒤(미래) 눈금 없음
  F.nice = (lo, hi, n) => { const raw = (hi - lo) / Math.max(1, n || 3); if (!(raw > 0)) return [lo]; const k = Math.pow(10, Math.floor(Math.log10(raw))); const st = [1, 2, 2.5, 5, 10].map((m) => m * k).find((v) => v >= raw) || 10 * k; const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(Math.round(v / k * 1000) / 1000 * k); return out; };
  F.xTicks = (x0, x1, nowY) => { const ends = [x0, Math.min(x1, nowY)], mid = []; for (let y = Math.ceil(x0); y <= Math.floor(Math.min(x1, nowY)); y++) if (y - ends[0] > 0.35 && ends[1] - y > 0.35) mid.push(y); return { ends, mid }; };
  const ym = (v) => { const y = Math.floor(v + 1e-9), m = Math.min(12, Math.floor((v - y) * 12 + 1e-6) + 1); return `${String(y).slice(2)}.${String(m).padStart(2, "0")}`; };
  const svg = (X, eok, nowY) => {
    const W = 320, H = 176, L = 44, Rr = 14, T = 16, B = 22;
    if (!X.pts.length) return "";
    const xs = X.pts.map((p) => p.y), us = X.pts.map((p) => p.u);
    let d0 = Math.min(...xs), d1 = Math.min(nowY, Math.max(...xs)), x0 = d0, x1 = d1; if (x1 - x0 < 0.5) { x0 -= 0.25; x1 = Math.min(nowY, x1 + 0.25); if (x1 - x0 < 0.5) x0 = x1 - 0.5; }
    let y0 = Math.min(...us), y1 = Math.max(...us); const pad = (y1 - y0) * 0.12 || y1 * 0.1 || 1; y0 = Math.max(0, y0 - pad); y1 += pad;
    const sx = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - Rr), sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const qy = (q) => 2000 + +q.slice(0, 2) + ((+q.slice(3) - 1) * 3 + 1.5) / 12;
    const line = X.qs.filter((q) => qy(q.q) >= x0 - 0.2 && qy(q.q) <= x1 + 0.2).map((q, i) => `${i ? "L" : "M"}${sx(Math.min(x1, Math.max(x0, qy(q.q)))).toFixed(1)} ${sy(q.m).toFixed(1)}`).join(" ");
    const yt = F.nice(y0, y1, 3);
    const xt = F.xTicks(d0, d1, nowY);
    return `<svg class="zpx-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="3.3㎡당 실거래 ${X.pts.length}건 산점도와 분기 가운데 값 선 · ${ym(d0)}~${ym(d1)}">
      <text class="yl yu" x="${L - 4}" y="10" text-anchor="end">3.3㎡당</text>
      ${yt.map((v) => `<line class="g" x1="${L}" x2="${W - Rr}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"/><text class="yl" x="${L - 4}" y="${(sy(v) + 3.5).toFixed(1)}" text-anchor="end">${eok(v)}</text>`).join("")}
      ${xt.ends.map((y, i) => `<text class="xl" x="${sx(y).toFixed(1)}" y="${H - 6}" text-anchor="${i ? "end" : "start"}">${ym(y)}</text>`).join("")}
      ${xt.mid.map((y) => `<line class="g gx" x1="${sx(y).toFixed(1)}" x2="${sx(y).toFixed(1)}" y1="${T}" y2="${H - B}"/><text class="xl" x="${sx(y).toFixed(1)}" y="${H - 6}" text-anchor="middle">${y}</text>`).join("")}
      ${X.pts.map((p) => `<circle class="p t${p.t}" cx="${sx(p.y).toFixed(1)}" cy="${sy(p.u).toFixed(1)}" r="3"/>`).join("")}
      ${line ? `<path class="ml" d="${line}"/>` : ""}
    </svg>`;
  };
  const st = new Map();   // 구역별 고른 기준·면적(탭을 다시 그려도 유지)
  F.mods.price = {
    key: "price", tab: "tx",
    run(r, pane, ctx) {
      ctx.tx().then((TXD) => {
        if (ctx.cur() !== r || ctx.tab() !== "tx" || !pane.isConnected) return;
        const z = TXD && TXD[r.id];
        if (!z || !Array.isArray(z.s) || z.s.length < 3) { F.put(pane, "price", ""); return; }
        const b = basisOf(r, z), s0 = st.get(r.id) || { basis: b.def, ak: "all" };
        const draw = () => {
          const X = F.px(z, s0.basis, s0.ak), eok = ctx.ZF.eok, esc = ctx.esc;
          const asOf = String((ctx.D && (ctx.D.upd || ctx.D.asOf)) || "").replace(/-/g, ""), nowY = asOf.length >= 8 ? yOf(asOf) : 9999;
          const fewJ = X.jr.length < 4 || X.jr.some((j) => j.ns < 3 || j.nj < 3);
          const lastQ = X.qs.slice(-8).reverse();
          const chips = AREA.map(([k, t]) => `<button type="button" class="zpx-c" data-ak="${k}" aria-pressed="${s0.ak === k}">${t}</button>`).join("");
          const bsw = b.nv && b.na ? `<div class="zpx-seg" role="group" aria-label="기준"><button type="button" data-b="v" aria-pressed="${s0.basis === "v"}">빌라·단독 <small>대지</small></button><button type="button" data-b="a" aria-pressed="${s0.basis === "a"}">아파트·입주권 <small>전용</small></button></div>` : "";
          const html = `<div class="sect zpx"><h3>가격 흐름 <small>국토부 실거래 · ${s0.basis === "v" ? "대지" : "전용"} 3.3㎡당 · 구역 안 거래 ${ctx.fmt(X.pts.length)}건${X.pts.length ? ` · ${ym(Math.min(...X.pts.map((q) => q.y)))}~${ym(Math.max(...X.pts.map((q) => q.y)))}` : ""}${z.s.length >= 40 ? "(최근 40건까지)" : ""}</small></h3>
            ${bsw}<div class="zpx-cs" role="group" aria-label="전용면적">${chips}</div>
            ${X.pts.length ? svg(X, eok, nowY) + `<p class="zpx-key" aria-hidden="true"><span><i class="k0"></i>빌라</span><span><i class="k1"></i>단독</span><span><i class="k2"></i>아파트</span><span><i class="k3"></i>입주권</span><span><i class="kl"></i>분기 가운데 값</span></p>` : `<p class="zpx-none">이 면적대 거래가 없어요</p>`}
            ${lastQ.length ? `<table class="zpx-q"><caption>분기 가운데 값 · 최근 ${lastQ.length}분기</caption><thead><tr><th scope="col">분기</th><th scope="col" class="n">3.3㎡당</th><th scope="col" class="n">건수</th></tr></thead><tbody>${lastQ.map((q) => `<tr><td>20${q.q.slice(0, 2)}년 ${q.q.slice(3)}분기</td><td class="n">${eok(q.m)}</td><td class="n">${q.n}건${q.n < 3 ? ' <em class="zpx-few">적음</em>' : ""}</td></tr>`).join("")}</tbody></table>` : ""}
            ${X.jr.length ? `<div class="zpx-jr"><h4>전세가율 추이 <em class="zpx-est">추정</em></h4><ol>${X.jr.slice(-6).map((j) => `<li><span>20${j.q.slice(0, 2)}.${j.q.slice(3)}분기</span><i style="width:${Math.min(100, j.r)}%" aria-hidden="true"></i><b>${j.r}%</b><small>매매 ${j.ns} · 전세 ${j.nj}건${j.ns < 3 || j.nj < 3 ? ' <em class="zpx-few">적음</em>' : ""}</small></li>`).join("")}</ol>${fewJ ? `<p class="zpx-warn">${X.jr.length < 4 ? `양쪽 거래가 2건 이상인 분기가 ${X.jr.length}개뿐이라 추이로 읽기 어려워요` : "거래가 적은 분기가 있어 값이 크게 흔들릴 수 있어요"}</p>` : ""}<p>같은 구역 연립·다세대의 분기별 전세 보증금 ÷ 매매가(둘 다 전용 ㎡당 가운데 값)예요 · 면적·연식 구성이 분기마다 달라 흔들릴 수 있어요</p>${(() => { let f = null; try { f = ctx.facts(r); } catch (e) {} const j = f && f.jr, jh = !!(j && j.hold && f.hold && f.hold.now && f.hold.now.code === "jrLow"); return j ? `<p class="zpx-use"><b>돈 계산에 쓴 전세가율 ${jh ? "보류" : `${j.short.split(" · ")[0]}`}</b> ${ctx.esc(jh ? "구역 실측이 평균보다 크게 낮은데 표본이 적어 전세 끼고 계산을 보류했어요" : j.txt)}</p>` : ""; })()}</div>` : ""}
            <p class="zpx-src">자료: 국토부 실거래가(서울 열린데이터광장) · 2023년 11월 이후 신고분 · 분기 가운데 값은 거래 3건 미만이면 '적음' 표시</p></div>`;
          const n = F.put(pane, "price", html, (el) => { const h3 = [...pane.querySelectorAll(".sect > h3")].find((h) => /최근 매매/.test(h.textContent)); const sec = h3 && h3.parentElement; if (sec) sec.before(el); else { const a = pane.querySelector("#aucSec"); if (a) a.before(el); else pane.appendChild(el); } });
          if (!n) return;
          n.querySelectorAll("[data-ak]").forEach((x) => (x.onclick = () => { s0.ak = x.dataset.ak; st.set(r.id, s0); draw(); }));
          n.querySelectorAll("[data-b]").forEach((x) => (x.onclick = () => { s0.basis = x.dataset.b; st.set(r.id, s0); draw(); }));
        };
        draw();
      }).catch(() => {});
    },
  };
})();
