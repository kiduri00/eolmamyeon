/* F4 근처 구역 추천 — 입지 탭
   반경 1km 안 · 같은 사업 유형(재개발/재건축/가로·소규모) · 단계 ±1 · 진행 중 · 지금 필요한 돈이 계산되는 곳 → 돈이 적은 순 3~5곳
   돈은 시트 '지금 필요한 돈'과 같은 함수(ctx.shown: 고른 사는 방식 값, 전세 끼고 못 사는 곳은 대출 끼고 값). 추천 = 거리·유형·단계·돈으로만 고른 목록(투자 권유 아님) */
(function () {
  "use strict";
  const F = window.ZPF;
  const hav = (a, b) => { const R0 = 6371000, t = Math.PI / 180, x = Math.sin(((b[0] - a[0]) * t) / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(((b[1] - a[1]) * t) / 2) ** 2; return 2 * R0 * Math.asin(Math.sqrt(x)); };
  // 사이클 2: 돈은 시트 첫 칸과 같은 판정 함수(ctx.shown) 하나로 — 고른 사는 방식(전세 끼고/대출 끼고) 한 가지 값만 · 그 방식으로 못 사는 곳은 '전세 끼고 불가'로 뒤에(값을 섞지 않는다)
  const needOf = (q, ctx) => { let w = null; try { w = ctx.shown(q); } catch (e) {} if (!w || w.v == null || !isFinite(w.v)) return null; if (w.kind === "lnow" && ctx.gap()) return null; return { v: w.v, loan: false, kind: w.kind }; };
  const HOLD = { nt: "입주권 없음", moa: "사업구역별", hold: "계산 보류" };
  const holdOf = (q, ctx) => { let w = null; try { w = ctx.shown(q); } catch (e) {} if (w && w.kind === "lnow" && ctx.gap()) return "전세 끼고 불가"; return HOLD[(w && w.kind) || "hold"] || "계산 보류"; };
  // 계산되는 곳은 돈이 적은 순, 계산 보류 곳은 뒤로(가까운 순 · 최대 2곳) — 돈 대신 단계·최근 소식을 보여 준다
  F.near = (r, ctx) => {
    if (!r || !r.ll || r.src === "moa") return [];
    const sh = ctx.shape(r);
    const all = ctx.R.filter((q) => q !== r && q.ll && !q.dn && !ctx.isDone(q) && q.src !== "moa" && ctx.shape(q) === sh && Math.abs((q.s || 0) - (r.s || 0)) <= 1)
      .map((q) => ({ q, d: hav(r.ll, q.ll) })).filter((x) => x.d <= 1000)
      .map((x) => ({ ...x, n: needOf(x.q, ctx) }));
    const ok = all.filter((x) => x.n).sort((a, b) => a.n.v - b.n.v || a.d - b.d).slice(0, 5);
    const hold = all.filter((x) => !x.n).sort((a, b) => a.d - b.d).slice(0, Math.max(0, Math.min(2, 5 - ok.length + 1)));
    return ok.concat(hold.map((x) => ({ ...x, n: null, hold: holdOf(x.q, ctx) })));
  };
  F.mods.near = {
    key: "near", tab: "loc",
    run(r, pane, ctx) {
      const L = F.near(r, ctx), esc = ctx.esc;
      if (!L.length) { F.put(pane, "near", ""); return; }
      const cash = ctx.cash(), me = needOf(r, ctx);
      const walk = (d) => Math.max(1, Math.round((d * 1.3) / 67));
      const li = ({ q, d, n, hold }) => {
        if (!n) { const ev = ctx.news ? ctx.news(q.id) : ""; return `<li><button type="button" class="znr-i znr-h" data-zid="${esc(q.id)}"><span class="znr-n"><b>${esc(ctx.shortName(q.n))}</b><small>${esc(ctx.stageName(q))} · ${ctx.fmt(Math.round(d / 10) * 10)}m · 걸어서 약 ${walk(d)}분${ev ? ` · ${esc(ev)}` : ""}</small></span><span class="znr-v"><b class="znr-hb">${esc(hold)}</b><small>돈은 계산하지 않아요</small></span></button></li>`; }
        const short = n.v > cash + 1e-9 ? `내 돈 ${ctx.ZF.gap(n.v, cash)} 부족` : ctx.ok(q) ? "내 돈으로 가능" : "";
        return `<li><button type="button" class="znr-i" data-zid="${esc(q.id)}"><span class="znr-n"><b>${esc(ctx.shortName(q.n))}</b><small>${esc(ctx.stageName(q))} · ${ctx.fmt(Math.round(d / 10) * 10)}m · 걸어서 약 ${walk(d)}분</small></span><span class="znr-v"><b>${ctx.ZF.cash(n.v)}</b><small>${short}</small></span></button></li>`;
      };
      const html = `<div class="sect znr"><h3>근처 비슷한 구역 <small>1km 안 · 같은 ${esc(ctx.SHAPE[ctx.shape(r)] || "유형")} · 단계 비슷 · ${ctx.gap() ? "전세 끼고" : "대출 끼고"} 지금 필요한 돈이 적은 순 · 계산 보류는 뒤에</small></h3>
        ${me ? `<p class="znr-me">이 구역 지금 필요한 돈 <b>${ctx.ZF.cash(me.v)}</b> · ${ctx.gap() ? "전세 끼고" : "대출 끼고"}</p>` : ""}
        <ol class="znr-l">${L.map(li).join("")}</ol>
        <p class="znr-src">거리·사업 유형·단계·내 조건으로 계산한 돈으로만 고른 목록이에요 · 추천 순위가 아니에요${L.filter((x) => x.n).length < 3 ? ` · 돈이 계산되는 곳이 ${L.filter((x) => x.n).length}곳뿐이에요` : ""}</p></div>`;
      const n = F.put(pane, "near", html, (el) => { const nc = pane.querySelector(".nearcmp"); if (nc) nc.before(el); else pane.appendChild(el); });
      if (n) n.querySelectorAll("[data-zid]").forEach((b) => (b.onclick = () => ctx.open(b.dataset.zid)));
    },
  };
})();
