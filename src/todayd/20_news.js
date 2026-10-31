/* 소식 칸: 서울 오늘(today.json 7일) · 주간(최근 7일 리포트) · 내 돈 레이더(내 소식 칸 위) */
(function () {
  "use strict";
  const Y = window.ZPT, W = Y.W, e = Y.esc;
  const FT = [["", "전체"], ["trade", "거래"], ["notice", "고시"], ["tho", "허가"], ["auction", "경매"], ["stage", "단계"]];
  const TAGC = { trade: "tr", notice: "nt", tho: "th", auction: "au", stage: "st" };
  let ft = "", mine = false, shown = 60;
  // 줄 하나의 건수(거래허가 줄은 그 구역 그날 허가 건수 · 나머지는 1) — 날짜 머리 합 = 오늘 카드 칸 숫자
  const nOf = (x) => Y.nOf(x);
  // 내 돈 안만: 구역 판정이 '갈 수 있음'(앱 zstate) · 경매 줄은 그 구역 일정 물건 최저가가 내 돈 안이어도(최저가 기준 · 낙찰가 아님)
  const inMoney = (ctx, x, T) => { const r = ctx.byId[x[0]]; let ok = false; try { ok = !!r && ctx.zst(r).st === "ok"; } catch (er) {} if (ok || x[1] !== "auction") return ok; return ((T && T.auc) || []).some((a) => { const n = Y.aucN(a); return n.id === x[0] && n.min != null && n.min <= ctx.cash() + 1e-9; }); };
  function dayHead(ctx, T, d, L) {
    // 그날 칸 숫자: 오늘(기준일)은 today.json seoul.d 그대로, 지난 날은 seoul.days가 있으면 그것 · 없으면 목록 합
    const o = Y.dayOf(T, d);
    const c = {}; L.forEach((x) => { const k = x[1] === "auction" ? "auc_new" : x[1] === "stage" ? "notice" : x[1]; c[k] = (c[k] || 0) + nOf(x); });
    const ks = ["trade", "notice", "tho", "auc_new"].map((k) => [k, o && !ft && !mine ? Y.val(o, k) : c[k] || 0]).filter((v) => v[1] > 0);
    return `<h4 class="nt-dh">${e(Y.md(d))}${d === T.asOf ? ' <span class="nt-td">기준일</span>' : ""}<small>${ks.map(([k, n]) => `${e(W.ks[k])} ${Y.n(n)}`).join(" · ")}</small></h4>`;
  }
  function todayHTML(ctx, T) {
    const all = Y.evs(T).filter((x) => TAGC[x[1]] && !Y.fl(x).bf);
    const bf = Y.evs(T).filter((x) => Y.fl(x).bf).length;
    const L0 = mine ? all.filter((x) => inMoney(ctx, x, T)) : all;
    const cnt = (t) => L0.filter((x) => !t || x[1] === t).reduce((s, x) => s + nOf(x), 0);
    const L = L0.filter((x) => !ft || x[1] === ft).sort((a, b) => (a[2] < b[2] ? 1 : a[2] > b[2] ? -1 : 0));
    const sh = L.slice(0, shown), by = new Map(); sh.forEach((x) => { if (!by.has(x[2])) by.set(x[2], []); by.get(x[2]).push(x); });
    const row = (x) => { const nm = Y.name(ctx, x[0]), f = Y.fl(x); return `<li><button type="button" class="nt-it" data-open="${e(x[0])}"><i class="td-tg t-${x[1]}">${e(W.ks[x[1]] || "")}</i><span class="td-rt"><b>${e(nm)}</b><small>${e(x[3])}${f.x ? " · 해제된 거래" : ""}</small></span></button></li>`; };
    const off = navigator.onLine === false || navigator.onLine === false;
    return `<div class="nt-h"><h3>서울 오늘</h3><span class="td-as${off ? " off" : ""}">${e(Y.f(off ? W.off : W.asof, { d: Y.md(T.asOf) }))}</span></div>` +
      `<div class="nt-tiles">${Y.tiles(T, false)}</div>` +
      `<div class="nt-chips" role="group" aria-label="소식 종류">${FT.map(([t, l]) => `<button type="button" data-ntf="${t}" aria-pressed="${t === ft}" aria-label="${l} ${Y.n(cnt(t))}건">${l} <small>${Y.n(cnt(t))}</small></button>`).join("")}<button type="button" class="nt-mine" data-ntm aria-pressed="${mine}">내 돈 안만</button></div>` +
      (mine ? `<p class="nt-sub">${e(`내 돈 ${Y.cashT(ctx, ctx.cash())}·${Y.modeT(ctx)}으로 갈 수 있는 구역(경매는 최저가 기준)만`)}</p>` : "") +
      (sh.length ? `<ol class="nt-list">${[...by].map(([d, rs]) => `<li>${dayHead(ctx, T, d, L.filter((x) => x[2] === d))}<ul>${rs.map(row).join("")}</ul></li>`).join("")}</ol>` : `<p class="nt-empty">최근 7일 동안 이 조건의 소식이 없어요 · 다른 종류를 눌러 보세요</p>`) +
      (L.length > sh.length ? `<button type="button" class="btn secondary nt-more" data-ntmore>더 보기 (${Y.n(L.length - sh.length)}줄)</button>` : "") +
      `<p class="nt-foot">${e(W.dateNote)}${bf ? `<br>${e(Y.f(W.bf, { n: Y.n(bf) }))}` : ""}</p>`;
  }
  function weekHTML(ctx, T) {
    const S = T.seoul || {}, w = S.w || {}, d1 = Y.add(T.asOf, -6);
    const ks = ["trade", "notice", "tho", "auc_sale", "auc_new"].filter((k) => Y.val(w, k) > 0);
    const R = Y.radar(ctx);
    let wk = 0; try { wk = ctx.inbox.ready() ? ctx.inbox.week().length : null; } catch (er) {}
    const bf = Object.values(S.bf || {}).reduce((s, v) => s + (+v || 0), 0);
    // 거래허가 많은 구역(최근 7일 · 주거용 허가) — 허가 ≠ 거래 성사
    const th = Object.entries(T.tho || {}).filter(([id, v]) => ctx.byId[id] && v && v[0] > 0).sort((a, b) => b[1][0] - a[1][0]).slice(0, 3);
    let fav = 0; try { fav = ctx.pins.list().length; } catch (er) {}
    return `<div class="nt-h"><h3>최근 7일 리포트</h3><span class="td-as">${e(`${Y.md(d1)}~${Y.md(T.asOf)}`)}</span></div>` +
      `<section class="wk-c"><h4>서울 전체</h4><ul class="td-s">${ks.map((k) => `<li><b>${Y.n(Y.val(w, k))}</b><span>${e(W.k[k])}</span></li>`).join("")}</ul>${bf ? `<p class="nt-sub">${e(Y.f(W.bfW, { n: Y.n(bf) }))}</p>` : ""}</section>` +
      `<section class="wk-c"><h4>${e(`내 돈 ${Y.cashT(ctx, ctx.cash())}·${Y.modeT(ctx)}`)}</h4><p class="wk-l">${R.nw.length || R.far.length ? [R.nw.length ? e(Y.f(W.radNew, { n: R.nw.length })) : "", R.far.length ? e(Y.f(W.radFar, { n: R.far.length })) : ""].filter(Boolean).join(" · ") : e(W.radNone)}</p><button type="button" class="btn text sm" data-ntrad>내 돈 레이더 보기 ›</button><p class="nt-sub">${e(W.calc)}</p></section>` +
      (fav ? `<section class="wk-c"><h4>관심 구역 ${fav}곳</h4><p class="wk-l">${wk == null ? "소식을 불러오는 중이에요" : wk ? `이번 주 소식 ${Y.n(wk)}건` : "이번 주에는 새 소식이 없어요"}</p></section>` : "") +
      (th.length ? `<section class="wk-c"><h4>거래허가가 많았던 구역</h4><ol class="wk-th">${th.map(([id, v]) => `<li><button type="button" class="nt-it" data-open="${e(id)}"><span class="td-rt"><b>${e(Y.name(ctx, id))}</b><small>최근 7일 주거용 허가 ${Y.n(v[0])}건</small></span></button></li>`).join("")}</ol><p class="nt-sub">허가는 계약 전 단계라 실거래보다 먼저 보여요 · 허가가 거래 성사를 뜻하지는 않아요</p></section>` : "") +
      `<p class="nt-foot">매일 아침 최근 7일로 다시 셉니다 · 월간 정리는 <a href="${e((document.getElementById("sRdRpt") || {}).getAttribute ? document.getElementById("sRdRpt").getAttribute("href") : "report/")}">월간 리포트</a>에서</p>`;
  }
  // 내 돈 레이더(내 소식 칸 위) — 새로 가능 · 멀어짐 · 조금만 더(0~3,000만, 가까운 5곳)
  function radHTML(ctx, T) {
    const R = Y.radar(ctx), gp = ctx.gap() ? "g" : "c", rad = (T.rad && T.rad[gp]) || {}, c = ctx.cash();
    const row = (id, sub) => `<li><button type="button" class="nt-it" data-open="${e(id)}"><span class="td-rt"><b>${e(Y.name(ctx, id))}</b><small>${sub}</small></span></button></li>`;
    const chg = (id) => { const a = rad[id]; return `필요한 돈 ${e(Y.cashT(ctx, a[0]))} → ${e(Y.cashT(ctx, a[1]))} · ${e(Y.WHY[a[2]] || "원인 확인 중")}`; };
    const near = [];
    for (const id in ctx.byId) { const r = ctx.byId[id]; let z = null; try { z = ctx.zst(r); } catch (er) {} if (z && z.st !== "ok" && z.st !== "na" && z.need != null && z.need > c + 1e-9 && z.need - c <= 0.3 + 1e-9) near.push([id, z.need]); }
    near.sort((a, b) => a[1] - b[1]);
    const nn = Y.nearN(ctx);
    const g = (h, L, f) => (L.length ? `<section class="rd-g"><h4>${h}</h4><ul>${L.map(f).join("")}</ul></section>` : "");
    return `<div class="rd-h"><h4 class="rd-t">${e(`내 돈 ${Y.cashT(ctx, c)}·${Y.modeT(ctx)} · 최근 7일`)}</h4><p class="nt-sub">${e(W.calc)} · ${e(Y.md(T.asOf))} 기준</p></div>` +
      (R.nw.length || R.far.length ? "" : `<p class="rd-none">${e(W.radNone)}</p>`) +
      g(`<em class="td-new">${e(Y.f(W.radNew, { n: R.nw.length }))}</em>`, R.nw, (id) => row(id, chg(id))) +
      g(e(Y.f(W.radFar, { n: R.far.length })), R.far, (id) => row(id, chg(id))) +
      g(e(Y.f(W.radNear, { n: Y.n(nn != null ? nn : near.length) })) + " <small>가까운 순 3곳</small>", near.slice(0, 3), ([id, n]) => row(id, `지금 ${e(Y.cashT(ctx, n))} · ${e("+" + ctx.ZF.gap(n, c))}이면 닿아요`));
  }
  let bound = {};
  Y.rad = (ctx) => {
    const el = document.getElementById("nwRad"); if (!el) return; Y.css();
    ctx.today.load().then((T) => { el.innerHTML = T ? radHTML(ctx, T) : ""; });
  };
  Y.news = (ctx, seg) => {
    Y.css();
    if (seg === "mine") return Y.rad(ctx);
    if (seg === "cal") return Y.cal(ctx);
    const el = document.getElementById(seg === "wk" ? "nwWk" : "nwToday"); if (!el) return;
    ctx.today.load().then((T) => {
      if (!T) { el.innerHTML = `<p class="nt-empty">${e(navigator.onLine === false ? "오프라인이에요 · 연결되면 오늘 소식을 불러와요" : "오늘 소식 자료를 불러오지 못했어요 · 잠시 뒤 다시 열어 주세요")}</p>`; return; }
      const draw = () => { el.innerHTML = seg === "wk" ? weekHTML(ctx, T) : todayHTML(ctx, T); };
      draw();
      if (seg === "wk" && !ctx.inbox.ready()) ctx.inbox.load().then(draw);
      if (!bound[seg]) {
        bound[seg] = 1;
        el.addEventListener("click", (ev) => {
          const t = ev.target.closest("button"); if (!t) return;
          if (t.hasAttribute("data-ntf")) { ft = t.dataset.ntf; shown = 60; draw(); const b = el.querySelector(`[data-ntf="${ft}"]`); if (b) b.focus({ preventScroll: true }); }
          else if (t.hasAttribute("data-ntm")) { mine = !mine; shown = 60; draw(); const b = el.querySelector("[data-ntm]"); if (b) b.focus({ preventScroll: true }); }
          else if (t.hasAttribute("data-ntmore")) { shown += 100; draw(); }
          else if (t.hasAttribute("data-ntrad")) { Y.seg(ctx, "mine", true); setTimeout(() => { const r = document.getElementById("nwRad"); if (r) r.scrollIntoView({ block: "start" }); }, 100); }
        });
      }
    });
  };
})();
