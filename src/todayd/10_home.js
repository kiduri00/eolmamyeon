/* 홈 '오늘의 재개발' 카드 — 개인 줄 3개(오늘 한 줄 · 내 돈 이번 주 · 관심 구역 지난번 본 뒤) + 아침에 받기 · 오프라인 기준일 */
(function () {
  "use strict";
  const Y = window.ZPT, W = Y.W, e = Y.esc;
  // 오늘 한 줄: 가장 최근 날의 사건 가운데 무게 순(단계 → 고시 → 새 경매 → 거래허가 많은 곳 → 거래) · 열 때마다 다음 것(기기에 차례만 저장)
  const PR = { stage: 0, notice: 1, auction: 2, tho: 3, trade: 4 };
  function picks(ctx, T) {
    const L = Y.evs(T).filter((x) => x[2] === T.asOf && PR[x[1]] != null && !Y.fl(x).bf && !Y.fl(x).x && ctx.byId[x[0]]);
    L.sort((a, b) => PR[a[1]] - PR[b[1]] || (b[1] === "tho" ? (parseInt(String(b[3]).replace(/\D+/, "")) || 0) - (parseInt(String(a[3]).replace(/\D+/, "")) || 0) : 0));
    const seen = new Set(), out = [];
    L.forEach((x) => { const k = x[1] + x[0]; if (seen.has(k) || out.length >= 8) return; seen.add(k); out.push(x); });
    // 다가오는 매각기일(관심 구역 · 3일 안): 날짜가 정해진 공고만(출처: 법원 공고 · today.json auc)
    let fav = []; try { fav = ctx.pins.list(); } catch (er) {}
    const td = Y.day();
    ((T.auc) || []).map(Y.aucN).filter((a) => fav.includes(a.id) && a.d >= td && Y.diff(td, a.d) <= 3 && a.st !== "gone").slice(0, 2).forEach((a) => out.unshift([a.id, "auc_d", a.d, `경매 매각기일 ${Y.md(a.d)} · 최저가 기준 ${Y.cashT(ctx, a.min)}`, ""]));
    return out;
  }
  const TAG = { stage: "단계", notice: "고시", auction: "경매", tho: "허가", trade: "거래", auc_d: "일정" };
  // 홈 머리글에는 '신고가'를 쓰지 않는다(해제 거래 정정 전 · c5 전략 패널 결정)
  const clean = (t) => String(t).replace(/\s*·\s*신고가\s*$/, "");
  function rowSpot(ctx, T) {
    const L = picks(ctx, T);
    if (!L.length) return `<p class="td-r td-spot0"><span class="td-rt"><b>${e(W.few)}</b><small>${e(Y.f(W.weekL, { r: "기록은 소식 › 서울 오늘에서" }))}</small></span></p>`;
    const st = Y.ls("zp-today-rot", {}), i = st.d === T.asOf ? (st.i || 0) % L.length : 0;
    Y.lsw("zp-today-rot", { d: T.asOf, i: i + 1 });
    const x = L[i];
    return `<button type="button" class="td-r td-spot" data-open="${e(x[0])}"><i class="td-tg t-${x[1]}">${TAG[x[1]]}</i><span class="td-rt"><b>${e(Y.name(ctx, x[0]))}</b><small>${e(clean(x[3]))}</small></span>${Y.chev}</button>`;
  }
  function rowMoney(ctx) {
    const R = Y.radar(ctx), nn = Y.nearN(ctx), P = [];
    if (R.nw.length) P.push(`<em class="td-new">${e(Y.f(W.radNew, { n: R.nw.length }))}</em>`);
    if (R.far.length) P.push(e(Y.f(W.radFar, { n: R.far.length })));
    const near = nn ? e(Y.f(W.radNear, { n: Y.n(nn) })) : "";
    const sub = P.length ? P.concat(near ? [near] : []).join(" · ") : `${e(W.radNone)}${near ? " · " + near : ""}`;
    return `<button type="button" class="td-r" data-tdgo="rad"><span class="td-rt"><b>${e(Y.f(W.me, { c: Y.cashT(ctx, ctx.cash()), m: Y.modeT(ctx) }))}</b><small>${sub}</small></span>${Y.chev}</button>`;
  }
  function rowFav(ctx) {
    let z = 0, c = 0; try { z = ctx.pins.list().length; c = ctx.pins.condsAll().length; } catch (er) {}
    if (!z && !c) return `<button type="button" class="td-r" data-tdgo="map"><span class="td-rt"><b>관심 구역</b><small>${e(W.favEmpty)}</small></span>${Y.chev}</button>`;
    const b = ctx.inbox.ready() ? ctx.inbox.brk() : null, t = Y.ls("zp-seen-t", 0);
    const head = `관심 구역 ${Y.n(z)}곳${c ? ` · 알림 조건 ${c}개` : ""}`;
    let sub = "소식을 불러오는 중이에요";
    if (b) sub = !t ? Y.f(W.favFirst, { z: Y.n(z), n: Y.n(b.n) }) : b.n ? Y.f(W.favSince, { d: Y.md0(Y.day(t)), n: Y.n(b.n) }) + (b.zones ? ` · ${b.zones}곳에서` : "") : Y.f(W.favNone, { d: Y.md0(Y.day(t)) });
    return `<button type="button" class="td-r${b && b.n ? " on" : ""}" data-tdgo="mine"><span class="td-rt"><b>${e(head)}</b><small>${b && b.n ? `<em class="td-nb">${e(sub)}</em>` : e(sub)}</small></span>${Y.chev}</button>`;
  }
  function head(T) {
    const as = document.getElementById("tdAs"); if (!as || !T) return;
    const off = navigator.onLine === false;
    as.textContent = Y.f(off ? W.off : W.asof, { d: Y.md(T.asOf) }); as.classList.toggle("off", off);
  }
  let bound = false;
  Y.home = (ctx) => {
    const card = document.getElementById("tdCard"), me = document.getElementById("tdMe"); if (!card || !me) return;
    Y.css();
    ctx.today.load().then((T) => {
      if (!T) { me.innerHTML = `<p class="td-r"><span class="td-rt"><b>${e(W.off.replace(/ · .*$/, ""))}</b><small>연결되면 다시 불러와요</small></span></p>`; return; }
      // 화면(HTML)이 오늘 자료보다 오래됐으면(캐시된 첫 화면) 서울 줄도 이 자료로 다시 — 카드·소식이 같은 숫자
      if (card.dataset.asof !== T.asOf) {
        card.querySelectorAll("#tdS,#tdW").forEach((x) => x.remove());
        card.querySelector(".td-h").insertAdjacentHTML("afterend", Y.tiles(T, true)); card.dataset.asof = T.asOf;
      }
      head(T);
      const draw = () => { me.innerHTML = rowSpot(ctx, T) + rowMoney(ctx) + rowFav(ctx); Y.mornFoot(ctx, card); };
      draw();
      if (!ctx.inbox.ready()) { let has = false; try { has = ctx.pins.list().length || ctx.pins.condsAll().length; } catch (er) {} if (has) ctx.inbox.load().then(() => { me.querySelector('[data-tdgo="mine"]') && (me.querySelector('[data-tdgo="mine"]').outerHTML = rowFav(ctx)); }); }
      if (!bound) {
        bound = true;
        me.addEventListener("click", (ev) => {
          const g = ev.target.closest("[data-tdgo]"); if (!g) return;
          const k = g.dataset.tdgo;
          if (k === "map") { const m = document.getElementById("mapTop"); if (m) m.scrollIntoView({ block: "start" }); return; }
          Y.go(ctx, "mine");
          if (k === "rad") setTimeout(() => { const r = document.getElementById("nwRad"); if (r) r.scrollIntoView({ block: "start" }); }, 350);
        });
        // 금액·방식·관심 구역이 바뀌면 개인 줄만 다시(오늘 한 줄 차례는 그대로)
        const re = () => { const a = me.querySelector('[data-tdgo="rad"]'), b = me.querySelector('[data-tdgo="mine"],[data-tdgo="map"]'); if (a) a.outerHTML = rowMoney(ctx); if (b) b.outerHTML = rowFav(ctx); };
        let t = 0; const later = () => { clearTimeout(t); t = setTimeout(re, 400); };
        addEventListener("zp:alerts", later); try { ctx.pins.on(later); } catch (er) {}
        // 금액(#sCashV 글자)·방식(.s-mode 눌림)이 바뀌면 — 앱에 금액 바뀜 알림이 따로 없어서 화면을 본다
        try { const g = document.getElementById("sGauge"); if (g) new MutationObserver(later).observe(g, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-pressed"] }); } catch (er) {}
        addEventListener("online", () => { ctx.today.load().then(head); }); addEventListener("offline", () => head(T));
      }
    });
  };
})();
