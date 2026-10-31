/* 소식 칸: 서울 오늘(ZP_today.feed 7일 · 날짜 머리 = feedCount = 서울 줄 숫자) · 주간(최근 7일) · 내 돈 레이더(내 소식 칸 아래) */
(function () {
  "use strict";
  const Y = window.ZPT, Z = Y.Z, W = Y.W, U = Y.U, e = Y.esc;
  const FT = ["", "trade", "notice", "tho", "auction", "stage"];
  const CK = { trade: "trade", notice: "notice", stage: "stage", tho: "tho", auction: "auc_new" };
  let ft = "", mine = false, shown = 60;
  // 내 돈 안만: 구역 판정이 '갈 수 있음'(앱 zstate) · 경매 줄은 그 구역 14일 일정 물건 최저가가 내 돈 안이어도(최저가 기준 · 낙찰가 아님)
  function okOf(ctx, T) {
    const c = ctx.cash(), au = new Set(); (T.auc || []).forEach((a) => { if (a[5] > 0 && a[5] <= c * 1e8 + 1) au.add(a[0]); });
    const memo = new Map();
    return (id, type) => { if (type === "auction" && au.has(id)) return true; if (!memo.has(id)) { const r = ctx.byId[id]; let ok = false; try { ok = !!r && ctx.zst(r).st === "ok"; } catch (er) {} memo.set(id, ok); } return memo.get(id); };
  }
  function dayHead(T, d) {
    const c = Z.feedCount(T, d), ks = [["trade", c.trade], ["notice", c.notice + c.stage], ["tho", c.tho], ["auction", c.auc_new + c.auc_drop]].filter((x) => x[1] > 0);
    return `<h4 class="nt-dh">${e(Z.mdw(d))}${d === T.asOf ? ' <span class="nt-td">기준일</span>' : ""}<small>${ks.map(([k, n]) => `${e(W.chip[k])} ${Y.n(n)}`).join(" · ")}</small></h4>`;
  }
  function todayHTML(ctx, T) {
    const ok = okOf(ctx, T);
    const all = Z.feed(T, { week: true }), bf = Z.feed(T, { week: true, bf: true }).length;
    const L0 = mine ? all.filter((x) => ok(x.id, x.type)) : all;
    const cnt = (t) => L0.filter((x) => !t || x.type === t).reduce((s, x) => s + (x.type === "trade" || x.type === "auction" || x.type === "tho" ? x.n : 1), 0);
    const L = L0.filter((x) => !ft || x.type === ft).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const sh = L.slice(0, shown), by = new Map(); sh.forEach((x) => { if (!by.has(x.date)) by.set(x.date, []); by.get(x.date).push(x); });
    const row = (x) => `<li><button type="button" class="nt-it" data-open="${e(x.id)}"><i class="td-tg t-${x.type}">${e(W.chip[x.type] || "")}</i><span class="td-rt"><b>${e(Y.name(ctx, x.id))}</b><small>${e(x.text)}${x.tag ? ` · ${e(x.tag)}` : ""}</small></span></button></li>`;
    const off = navigator.onLine === false;
    return `<div class="nt-h"><h3>${e(U.seg.today)}</h3><span class="td-as${off ? " off" : ""}">${e(off ? Z.offLine(T) : Z.asOfT(T))}</span></div>` +
      `<div class="nt-tiles">${Y.tiles(T, false)}</div>` +
      `<div class="nt-chips" role="group" aria-label="소식 종류">${FT.map((t) => { const l = t ? W.chip[t] : "전체"; return `<button type="button" data-ntf="${t}" aria-pressed="${t === ft}" aria-label="${l} ${Y.n(cnt(t))}건">${l} <small>${Y.n(cnt(t))}</small></button>`; }).join("")}<button type="button" class="nt-mine" data-ntm aria-pressed="${mine}">${e(W.chip.mine)}</button></div>` +
      (mine ? `<p class="nt-sub">${e(`내 돈 ${Y.cashT(ctx, ctx.cash())}·${Y.modeT(ctx)}으로 갈 수 있는 구역(경매는 ${U.auc_tag})만`)}</p>` : "") +
      (sh.length ? `<ol class="nt-list">${[...by].map(([d, rs]) => `<li>${mine || ft ? `<h4 class="nt-dh">${e(Z.mdw(d))}</h4>` : dayHead(T, d)}<ul>${rs.map(row).join("")}</ul></li>`).join("")}</ol>` : `<p class="nt-empty">${e(U.few_list)}</p>`) +
      (L.length > sh.length ? `<button type="button" class="btn secondary nt-more" data-ntmore>더 보기 (${Y.n(L.length - sh.length)}줄)</button>` : "") +
      `<p class="nt-foot">${e(W.dates)} · ${e(U.tho_note)}${bf ? `<br>${e(Y.f(W.home.bf, { n: bf }))} · ${e(W.home.bf_note)}` : ""}</p>`;
  }
  function weekHTML(ctx, T) {
    const S = T.seoul || {}, w = S.w || {}, d1 = Y.add(T.asOf, -6);
    const ks = ["trade", "notice", "stage", "tho", "auc_sale", "auc_new", "auc_drop"].filter((k) => (w[k] || 0) > 0);
    const R = Y.radar(ctx);
    let wk = null; try { wk = ctx.inbox.ready() ? ctx.inbox.week().length : null; } catch (er) {}
    const bf = Object.values(S.bfw || {}).reduce((s, v) => s + (+v || 0), 0);
    // 거래허가 많은 구역(최근 7일 · 주거용) — 허가 ≠ 거래 성사
    const th = Object.entries(T.tho || {}).filter(([id, v]) => ctx.byId[id] && v && v[0] > 0).sort((a, b) => b[1][0] - a[1][0]).slice(0, 3);
    let fav = 0; try { fav = ctx.pins.list().length; } catch (er) {}
    const rp = document.getElementById("sRdRpt");
    return `<div class="nt-h"><h3>${e(U.wk_head)}</h3><span class="td-as">${e(`${Z.mdw(d1)}~${Z.mdw(T.asOf)}`)}</span></div>` +
      `<section class="wk-c"><h4>서울 전체</h4><ul class="td-s">${ks.map((k) => `<li><b>${Y.n(w[k])}</b><span>${e(U.tile[k])}</span></li>`).join("")}</ul><p class="nt-sub">${e(Z.weekLine(T))}${bf ? ` · ${e(Y.f(W.home.bf, { n: bf }))}는 뺐어요` : ""}</p></section>` +
      `<section class="wk-c"><h4>${e(`내 돈 ${Y.cashT(ctx, ctx.cash())}·${Y.modeT(ctx)}`)}</h4><p class="wk-l">${R.nw.length || R.far.length ? [R.nw.length ? e(Y.f(U.nw, { n: R.nw.length })) : "", R.far.length ? e(Y.f(U.far, { n: R.far.length })) : ""].filter(Boolean).join(" · ") : e(U.none)}</p><button type="button" class="btn text sm" data-ntrad>내 돈 레이더 보기 ›</button><p class="nt-sub">${e(W.rad.head)}</p></section>` +
      (fav ? `<section class="wk-c"><h4>${e(Y.f(U.fav, { z: fav }))}</h4><p class="wk-l">${wk == null ? "소식을 불러오는 중이에요" : wk ? `이번 주 소식 ${Y.n(wk)}건` : "이번 주에는 새 소식이 없어요"}</p></section>` : "") +
      (th.length ? `<section class="wk-c"><h4>거래허가가 많았던 구역</h4><ol class="wk-th">${th.map(([id, v]) => `<li><button type="button" class="nt-it" data-open="${e(id)}"><span class="td-rt"><b>${e(Y.name(ctx, id))}</b><small>최근 7일 주거용 허가 ${Y.n(v[0])}건 · 30일 ${Y.n(v[1])}건</small></span></button></li>`).join("")}</ol><p class="nt-sub">${e(U.tho_note)}</p></section>` : "") +
      `<p class="nt-foot">매일 아침 최근 7일로 다시 셉니다 · 월간 정리는 <a href="${e(rp ? rp.getAttribute("href") : "report/")}">월간 리포트</a>에서</p>`;
  }
  // 내 돈 레이더(내 소식 칸) — ZP_today.radar 새로 가능 · 멀어짐(원인 문구 그대로) · 조금만 더(가까운 5곳)
  function radHTML(ctx, T) {
    const R = Y.radar(ctx), N = Y.near(ctx), c = ctx.cash();
    const row = (id, sub) => `<li><button type="button" class="nt-it" data-open="${e(id)}"><span class="td-rt"><b>${e(Y.name(ctx, id))}</b><small>${sub}</small></span></button></li>`;
    const chg = (x) => `필요한 돈 ${e(Y.cashT(ctx, x.old))} → ${e(Y.cashT(ctx, x.now))} · ${e(x.why)}`;
    const g = (h, L, f) => (L.length ? `<section class="rd-g"><h4>${h}</h4><ul>${L.map(f).join("")}</ul></section>` : "");
    return `<div class="rd-h"><h4 class="rd-t">${e(`내 돈 ${Y.cashT(ctx, c)}·${Y.modeT(ctx)} · 최근 7일`)}</h4><p class="nt-sub">${e(W.rad.head)} · ${e(Z.asOfT(T))}</p></div>` +
      (R.nw.length || R.far.length ? "" : `<p class="rd-none">${e(W.rad.none)}</p>`) +
      g(`<em class="td-new">${e(W.rad.nw)} ${R.nw.length}곳</em>`, R.nw, (x) => row(x.id, chg(x))) +
      g(e(`${W.rad.far} ${R.far.length}곳`), R.far, (x) => row(x.id, chg(x))) +
      g(e(`${W.rad.near} ${N.n}곳`) + " <small>가까운 순 5곳</small>", N.top, (x) => row(x.id, `지금 ${e(Y.cashT(ctx, x.need))} · ${e(Y.f(W.rad.near_t, { gap: ctx.ZF.gap(x.need, c) }))}`));
  }
  const bound = {};
  // 폰 알림이 켜져 있으면 레이더 아래에 빈도 바꾸기(중요한 것만·매일·주 1회 · 고르기만 하면 서버 구독에 반영)
  Y.rad = (ctx) => { const el = document.getElementById("nwRad"); if (!el) return; Y.css(); Y.css2(); const T = Y.T(); let on = false; try { on = ctx.inbox.st().on; } catch (er) {} el.innerHTML = T ? radHTML(ctx, T) + (on ? Y.mornBox(ctx, "news") : "") : ""; Y.mornBind(ctx, el); };
  Y.news = (ctx, seg) => {
    Y.css(); Y.css2();
    if (seg === "mine") return Y.rad(ctx);
    if (seg === "cal") return Y.cal(ctx);
    const el = document.getElementById(seg === "wk" ? "nwWk" : "nwToday"); if (!el) return;
    const T = Y.T();
    if (!T) { el.innerHTML = `<p class="nt-empty">${e(navigator.onLine === false ? "오프라인이에요 · 연결되면 오늘 소식을 불러와요" : "오늘 소식 자료를 불러오지 못했어요 · 잠시 뒤 다시 열어 주세요")}</p>`; return; }
    const draw = () => { el.innerHTML = seg === "wk" ? weekHTML(ctx, T) : todayHTML(ctx, T); };
    draw();
    if (seg === "wk" && !ctx.inbox.ready()) ctx.inbox.load().then(draw);
    if (bound[seg]) return; bound[seg] = 1;
    el.addEventListener("click", (ev) => {
      const t = ev.target.closest("button"); if (!t) return;
      if (t.hasAttribute("data-ntf")) { ft = t.dataset.ntf; shown = 60; draw(); const b = el.querySelector(`[data-ntf="${ft}"]`); if (b) b.focus({ preventScroll: true }); }
      else if (t.hasAttribute("data-ntm")) { mine = !mine; shown = 60; draw(); const b = el.querySelector("[data-ntm]"); if (b) b.focus({ preventScroll: true }); }
      else if (t.hasAttribute("data-ntmore")) { shown += 100; draw(); }
      else if (t.hasAttribute("data-ntrad")) { Y.seg(ctx, "mine", true); setTimeout(() => { const r = document.getElementById("nwRad"); if (r) r.scrollIntoView({ block: "start" }); }, 100); }
    });
  };
})();
