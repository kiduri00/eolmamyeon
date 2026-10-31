/* 홈 '오늘의 재개발' 카드 — 개인 줄 3개(오늘 한 줄 · 내 돈 이번 주 · 관심 구역 지난번 본 뒤) + 아침에 받기 · 오프라인 기준일(today.json asOf) */
(function () {
  "use strict";
  const Y = window.ZPT, Z = Y.Z, W = Y.W, U = Y.U, e = Y.esc;
  // 오늘 한 줄: 기준일 사건 가운데 무게 순(단계 → 고시 → 경매 → 거래허가 많은 곳 → 거래) · 열 때마다 다음 것(차례만 기기에 저장 zp-today-rot)
  //   관심 구역 경매 매각기일 3일 안(법원 공고 날짜만)이 있으면 맨 앞. '신고가'는 홈 머리에 쓰지 않는다(해제 정정 전 · 전략 패널 결정)
  const PR = { stage: 0, notice: 1, auction: 2, tho: 3, trade: 4 };
  function picks(ctx, T) {
    const L = Z.feed(T, {}).filter((x) => PR[x.type] != null && !x.x && ctx.byId[x.id]);
    L.sort((a, b) => PR[a.type] - PR[b.type] || (a.type === "tho" ? b.n - a.n : 0));
    const seen = new Set(), out = [];
    L.forEach((x) => { const k = x.type + x.id; if (seen.has(k) || out.length >= 8) return; seen.add(k); out.push(x); });
    let fav = []; try { fav = ctx.pins.list(); } catch (er) {}
    Z.sched(T, { ids: new Set(fav) }).forEach((g) => { const n = Z.dday(g.date, T.asOf); if (!n || (n !== W.sched.d0 && +n.slice(2) > 3)) return; g.items.slice(0, 1).forEach((r) => out.unshift({ id: r.id, type: "auc_d", text: `${W.type.auction} 매각기일 ${g.dateT} ${n} · 최저가 ${r.minT}(${U.auc_tag})` })); });
    return out;
  }
  const TAG = { stage: "단계", notice: "고시", auction: "경매", tho: "허가", trade: "거래", auc_d: "일정" };
  const clean = (t) => String(t).replace(/\s*·\s*신고가\s*$/, "");
  function rowSpot(ctx, T) {
    const L = picks(ctx, T);
    if (!L.length) return `<p class="td-r td-spot0"><span class="td-rt"><b>${e(Z.seoul(T).quietT || W.home.week.replace("{n}", "–"))}</b><small>${e(U.seg.today)}에서 7일 기록을 볼 수 있어요</small></span></p>`;
    const st = Y.ls("zp-today-rot", {}), i = st.d === T.asOf ? (st.i || 0) % L.length : 0;
    Y.lsw("zp-today-rot", { d: T.asOf, i: i + 1 });
    const x = L[i];
    return `<button type="button" class="td-r td-spot" data-open="${e(x.id)}"><i class="td-tg t-${x.type}">${TAG[x.type]}</i><span class="td-rt"><b>${e(Y.name(ctx, x.id))}</b><small>${e(clean(x.text))}</small></span>${Y.chev}</button>`;
  }
  function rowMoney(ctx) {
    const R = Y.radar(ctx), N = Y.near(ctx), P = [];
    if (R.nw.length) P.push(`<em class="td-new">${e(Y.f(U.nw, { n: R.nw.length }))}</em>`);
    if (R.far.length) P.push(e(Y.f(U.far, { n: R.far.length })));
    const near = N.n ? e(Y.f(U.near, { n: N.n })) : "";
    const sub = P.length ? P.concat(near ? [near] : []).join(" · ") : `${e(U.none)}${near ? " · " + near : ""}`;
    return `<button type="button" class="td-r" data-tdgo="rad"><span class="td-rt"><b>${e(Y.f(U.me, { c: Y.cashT(ctx, ctx.cash()), m: Y.modeT(ctx) }))}</b><small>${sub}</small></span>${Y.chev}</button>`;
  }
  // 관심 줄 숫자 = 아래 탭 관심 배지 = 소식 '내 소식' 새 소식 수(INBOX.count와 같은 셈 brk.n · 밀린 자료 뺌)
  function rowFav(ctx) {
    let z = 0, c = 0; try { z = ctx.pins.list().length; c = ctx.pins.condsAll().length; } catch (er) {}
    if (!z && !c) return `<button type="button" class="td-r" data-tdgo="map"><span class="td-rt"><b>${e(Y.f(U.fav, { z: 0 }))}</b><small>${e(U.fav0)}</small></span>${Y.chev}</button>`;
    const b = ctx.inbox.ready() ? ctx.inbox.brk() : null, t = Y.ls("zp-seen-t", 0);
    const head = Y.f(U.fav, { z }) + (c ? ` · ${Y.f(U.fav_c, { c })}` : "");
    let sub = "소식을 불러오는 중이에요";
    if (b) sub = !t ? Y.f(U.first, { n: b.n }) : b.n ? Y.f(U.since, { d: Z.md(Y.day(t)), n: b.n }) : Y.f(U.since0, { d: Z.md(Y.day(t)) });
    return `<button type="button" class="td-r${b && b.n ? " on" : ""}" data-tdgo="mine"><span class="td-rt"><b>${e(head)}</b><small>${b && b.n ? `<em class="td-nb">${e(sub)}</em>` : e(sub)}</small></span>${Y.chev}</button>`;
  }
  function head(T) {
    const as = document.getElementById("tdAs"); if (!as || !T) return;
    const off = navigator.onLine === false;
    as.textContent = off ? Z.offLine(T) : Z.asOfT(T); as.classList.toggle("off", off);
  }
  let bound = false;
  Y.home = (ctx) => {
    const card = document.getElementById("tdCard"), me = document.getElementById("tdMe"); if (!card || !me) return;
    Y.css();
    const T = Y.T();
    if (!T) { me.innerHTML = `<p class="td-r"><span class="td-rt"><b>${e(navigator.onLine === false ? "오프라인이에요" : "오늘 자료를 불러오지 못했어요")}</b><small>연결되면 다시 불러와요 · 위 숫자는 ${e(card.dataset.asof ? Z.md(card.dataset.asof) : "")} 기준</small></span></p>`; return; }
    // 첫 화면(HTML)이 오늘 자료보다 오래됐으면(캐시된 첫 화면) 서울 줄도 이 자료로 다시 — 카드·소식이 같은 숫자
    if (card.dataset.asof !== T.asOf) {
      card.querySelectorAll("#tdS,#tdW,#tdF").forEach((x) => x.remove());
      card.querySelector(".td-h").insertAdjacentHTML("afterend", Y.tiles(T, true)); card.dataset.asof = T.asOf;
    }
    head(T);
    me.innerHTML = rowSpot(ctx, T) + rowMoney(ctx) + rowFav(ctx); Y.mornFoot(ctx, card);
    if (!ctx.inbox.ready()) { let has = false; try { has = ctx.pins.list().length || ctx.pins.condsAll().length; } catch (er) {} if (has) ctx.inbox.load().then(() => { const b = me.querySelector('[data-tdgo="mine"]'); if (b) b.outerHTML = rowFav(ctx); }); }
    if (bound) return; bound = true;
    me.addEventListener("click", (ev) => {
      const g = ev.target.closest("[data-tdgo]"); if (!g) return;
      if (g.dataset.tdgo === "map") { const m = document.getElementById("mapTop"); if (m) m.scrollIntoView({ block: "start" }); return; }
      Y.go(ctx, "mine");
      if (g.dataset.tdgo === "rad") setTimeout(() => { const r = document.getElementById("nwRad"); if (r) r.scrollIntoView({ block: "start" }); }, 400);
    });
    // 금액·방식·관심 구역이 바뀌면 개인 줄만 다시(오늘 한 줄 차례는 그대로) — 앱에 금액 바뀜 알림이 따로 없어 예산 카드 글자·눌림을 본다
    const re = () => { const a = me.querySelector('[data-tdgo="rad"]'), b = me.querySelector('[data-tdgo="mine"],[data-tdgo="map"]'); if (a) a.outerHTML = rowMoney(ctx); if (b) b.outerHTML = rowFav(ctx); };
    let t = 0; const later = () => { clearTimeout(t); t = setTimeout(re, 400); };
    addEventListener("zp:alerts", later); try { ctx.pins.on(later); } catch (er) {}
    try { const g = document.getElementById("sGauge"); if (g) new MutationObserver(later).observe(g, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-pressed"] }); } catch (er) {}
    addEventListener("online", () => head(T)); addEventListener("offline", () => head(T));
  };
})();
