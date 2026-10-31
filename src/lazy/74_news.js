/* 사이클 5 D 지연 묶음 "news" (src/lazy → /b/znews.*.js · ZP_lazy) — 원래 src/todayd 05_seg.js · 20_news.js · 30_cal.js */
// 사이클 5 M 지연 묶음 등록 — 몸통은 init() 때 돈다(A 자료·문구 묶음 window.ZP_today가 먼저 열려 있어야 해서 · 73_today.js lz가 연 뒤 부름)
(window.ZP_L || (window.ZP_L = {})).news = { v: 1, init() {
  if (!this.Y) {
/* 소식 4칸 바꾸기(내 소식 · 서울 오늘 · 일정 · 주간) · 내 돈 레이더 묶음 · 소식을 보면 서랍의 아침 알림 닫기 */
(function () {
  "use strict";
  const Y = window.ZPT;
  Object.assign(Y.U, "__FWUIZ__");   // 소식 칸만 쓰는 화면 말(feed_words.json ui)
  Y.css2 = () => {};
  const SEGS = ["mine", "today", "cal", "wk"];
  let NSEG = "", USER = false, HQ = true;
  const news = () => document.getElementById("news");
  // 설치 앱: 예전 두 칸(전체 소식 tseg=all · 관심 구역 tseg=mine)을 이 칸에 맞춘다(30일 전체 소식은 '서울 오늘' 칸 아래)
  const want = () => (NSEG === "mine" ? "mine" : "all");
  function syncT() {
    const n = news(); if (!n || !Y.tapp() || !NSEG) return;
    if (n.dataset.tseg !== want()) { const b = n.querySelector(`.tf-seg [data-seg="${want()}"]`); if (b) b.click(); else n.dataset.tseg = want(); }
  }
  let mo = false;
  Y.seg = (ctx, v, user) => {
    const n = news(); if (!n || !SEGS.includes(v)) return;
    NSEG = v; if (user) { USER = true; try { sessionStorage.setItem("zp.nseg", v); } catch (e) {} }
    n.dataset.nseg = v;
    n.querySelectorAll("#nwSeg [role=tab]").forEach((b) => { const on = b.dataset.nseg === v; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    syncT();
    if (!mo) { mo = true; try { new MutationObserver(() => { if (Y.tapp() && NSEG && n.dataset.tseg !== want()) n.dataset.tseg = want(); }).observe(n, { attributes: true, attributeFilter: ["data-tseg"] }); } catch (e) {} }
    Y.news(ctx, v);
  };
  Y.segKey = (ctx, e) => {
    const k = { ArrowRight: 1, ArrowLeft: -1, Home: -9, End: 9 }[e.key]; if (!k) return;
    const i = SEGS.indexOf(NSEG || "mine"), j = k === -9 ? 0 : k === 9 ? 3 : (i + k + 4) % 4;
    Y.seg(ctx, SEGS[j], true); const b = document.querySelector(`#nwSeg [data-nseg="${SEGS[j]}"]`); if (b) b.focus();
  };
  // 고시·단계 기록(빠른 메뉴 경공매·고시공고가 가는 곳)이 있는 칸: 웹 '서울 오늘' · 앱 '내 소식'(예전 자리)
  // 빠른 메뉴 경공매·고시공고: 그 칸을 열고 고시·단계 기록 머리가 보이게(서울 오늘 7일 목록 아래에 있어서)
  Y.alias = (ctx, d) => { if (!/^(ntc|auc|new|supply)Top$/.test(d)) return; Y.seg(ctx, Y.tapp() ? "mine" : "today", true); const go = () => { const t = document.querySelector("#news .nw-oh"), hd = document.getElementById("hdr"); if (t) { const y = t.getBoundingClientRect().top + scrollY - ((hd && hd.offsetHeight) || 56) - 8; window.scrollTo({ top: y, behavior: "instant" }); if (Math.abs(scrollY - y) > 4) document.scrollingElement.scrollTop = y; } }; document.readyState === "complete" ? setTimeout(go, 120) : addEventListener("load", () => { setTimeout(go, 160); setTimeout(go, 900); }, { once: true }); };   // 첫 진입이면 앱의 load 뒤 맨 위 맞추기(60_simple) 다음에
  // 앱 바로가기 '오늘'(/?src=app#news?today)·알림(#news?from=today): 첫 스크립트가 # 뒤 ?를 떼어 ZP_CQ에 둔다 → 처음 한 번만 그 칸으로
  const hashSeg = () => { if (!HQ) return ""; HQ = false; try { const q = new URLSearchParams(window.ZP_CQ || ""), f = q.get("from") || q.get("seg") || ""; return q.has("today") || f === "today" ? "today" : q.has("cal") || f === "cal" ? "cal" : q.has("wk") || f === "wk" ? "wk" : ""; } catch (e) { return ""; } };
  Y.enter = (ctx) => {
    const n = news(), s = document.getElementById("nwSeg"), h = n && n.querySelector(":scope > .sec-h");
    if (s && h && h.nextElementSibling !== s) h.after(s);   // 앱이 나중에 끼우는 예전 칸(tf-seg) 위로
    // 설치 앱: 30일 전체 소식(tFeed)은 '서울 오늘' 7일 요약 아래로, 머리 한 줄을 붙여
    const tf = document.getElementById("tFeed"), td = document.getElementById("nwToday");
    if (tf && td && td.nextElementSibling !== tf && td.nextElementSibling?.id !== "nwT30") { let hh = document.getElementById("nwT30"); if (!hh) { hh = document.createElement("h3"); hh.className = "nw-h"; hh.id = "nwT30"; hh.textContent = "최근 30일 전체 기록"; } td.after(hh); hh.after(tf); }
    let v = NSEG;
    const hs = window.__zpNseg || hashSeg(); window.__zpNseg = "";   // 빠른 메뉴로 온 칸(73_today.js가 먼저 정함)이 먼저
    if (hs) { v = hs; USER = true; }
    else if (!USER) {
      let c = 0, has = false, ss = "";
      try { c = ctx.inbox.count(); } catch (e) {}
      try { has = ctx.pins.list().length > 0 || ctx.pins.condsAll().length > 0; } catch (e) {}
      try { ss = sessionStorage.getItem("zp.nseg") || ""; } catch (e) {}
      v = c > 0 ? "mine" : SEGS.includes(ss) ? ss : has ? "mine" : "today";
    }
    Y.seg(ctx, v);
    // 소식을 봤으면 서랍에 남은 아침 알림(태그 jp-날짜 · 운영 알림 admin 제외)을 닫는다 → Android 아이콘 점도 사라짐(점은 서랍 알림 기준)
    try { if (navigator.serviceWorker) navigator.serviceWorker.getRegistration("/").then((r) => (r && r.getNotifications ? r.getNotifications() : [])).then((L) => (L || []).forEach((x) => { if (/^jp-/.test(x.tag || "") && !/admin/.test(x.tag)) x.close(); })).catch(() => {}); } catch (e) {}
  };
  // 다른 화면에서 소식 칸으로(오늘 카드 줄 누름)
  Y.go = (ctx, v) => { USER = true; try { if (ctx.simple.open("news")) { Y.seg(ctx, v, true); return; } } catch (e) {} location.hash = "#news"; setTimeout(() => Y.seg(ctx, v, true), 50); };
})();
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
    const R = Y.radar(ctx), N = Y.nearC(ctx) || { n: "…", top: [] }, c = ctx.cash();
    if (!Y.nearC(ctx)) Y.nearLater(ctx, () => Y.rad(ctx));
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
/* 소식 › 일정: 경매 매각기일(법원 공고 · today.json 14일 · ZP_today.sched) · 내 일정(직접 넣음 · ZP_today.mySched, 기기에만 zp-sched) · 캘린더 파일(ZP_today.ics · 기기에서 만듦 · 서버 요청 0)
   개인 이름은 저장·표시하지 않는다(사건번호·법원·기일·감정가·최저가·유찰·용도만). D-day는 법원 기일과 사용자가 넣은 날짜에만(지어낸 미래 날짜 없음). */
(function () {
  "use strict";
  const Y = window.ZPT, Z = Y.Z, W = Y.W, U = Y.U, e = Y.esc;
  let flt = "", form = false;
  const COURT = (c) => String(c || "").replace(/^서울/, "").replace(/지방법원$/, "지법");
  function groups(ctx, T) {
    let fav = []; try { fav = ctx.pins.list(); } catch (er) {}
    const F = new Set(fav), c = ctx.cash();
    const G = Z.sched(T, { cash: c });
    G.forEach((g) => g.items.forEach((r) => { r.fav = F.has(r.id); r.inC = !!r.inT; }));
    return G;
  }
  function html(ctx, T) {
    const G = groups(ctx, T), all = G.flatMap((g) => g.items), M = Z.mySched.get().filter((m) => m.d >= T.asOf).sort((a, b) => (a.d < b.d ? -1 : 1));
    const keep = (r) => (flt === "fav" ? r.fav : flt === "in" ? r.inC : true);
    let fav = []; try { fav = ctx.pins.list(); } catch (er) {}
    const row = (r) => {
      const tags = `<span class="cl-t">${e(U.auc_tag)}</span>${r.inC ? `<span class="cl-t in">${e(W.auc.in)}</span>` : ""}${r.fav ? '<span class="cl-t fv">관심 구역</span>' : ""}${r.jb ? '<span class="cl-t">지분</span>' : ""}${(r.fav || r.inC) && r.dday ? `<b class="cl-dd">${e(r.dday)}</b>` : ""}`;
      return `<li><button type="button" class="nt-it cl-it" data-open="${e(r.id)}"><span class="td-rt"><b>${e(Y.name(ctx, r.id))}${r.use ? ` <small class="cl-u">${e(r.use)}</small>` : ""}</b><small>${e([r.cs + (r.no > 1 ? `(${r.no})` : ""), COURT(r.court), r.time].filter(Boolean).join(" · "))}</small><small class="cl-m">감정 ${e(Z.aucAmt(r.appr))} · 최저 <b>${e(r.minT)}</b>${r.rateT ? ` (${e(r.rateT)})` : ""}${r.failT ? ` · ${e(r.failT)}` : ""}${r.dropT ? ` · ${e(r.dropT)}` : ""}</small><span class="cl-tags">${tags}</span></span></button></li>`;
    };
    const myRow = (m) => `<li><span class="td-rt"><b>${e(m.title)}</b><small>${e(Z.mdw(m.d))}${m.t ? ` ${e(m.t)}` : ""}${m.z && ctx.byId[m.z] ? ` · ${e(Y.name(ctx, m.z))}` : ""} · ${e(W.sched.mine)}</small></span><b class="cl-dd">${e(Z.dday(m.d, T.asOf))}</b><button type="button" class="cl-x" data-cldel="${e(m.k)}" aria-label="${e(m.title)} 일정 지우기">지우기</button></li>`;
    const shown = G.map((g) => ({ g, L: g.items.filter(keep) })).filter((x) => x.L.length);
    const exp = all.filter((r) => r.fav || r.inC);
    return `<div class="nt-h"><h3>${e(W.sched.head)}</h3><span class="td-as">${e(Z.asOfT(T))}</span></div>` +
      `<section class="wk-c"><div class="cl-h"><h4>${e(W.sched.mine)}</h4><button type="button" class="btn text sm" data-cladd aria-expanded="${form}">${form ? "닫기" : "일정 넣기"}</button></div>` +
      (form ? `<form class="cl-f" data-clform><label>날짜<input type="date" name="d" required min="${Y.day()}"></label><label>내용<input type="text" name="t" required maxlength="30" placeholder="예: 조합 총회 · 분양신청 마감"></label>${fav.length ? `<label>구역(선택)<select name="z"><option value="">고르지 않음</option>${fav.filter((id) => ctx.byId[id]).map((id) => `<option value="${e(id)}">${e(Y.name(ctx, id))}</option>`).join("")}</select></label>` : ""}<button type="submit" class="btn primary sm">넣기</button><p class="nt-sub">${e(W.sched.mine_note)}</p></form>` : "") +
      (M.length ? `<ul class="cl-my">${M.map(myRow).join("")}</ul>` : `<p class="nt-sub">조합 문자로 받은 총회·감정평가·분양신청 날짜를 넣어 두면 D-day로 보여 드려요</p>`) + `</section>` +
      `<section class="wk-c"><h4>경매 매각기일 <small>${e(W.sched.sub)}</small></h4><p class="cl-warn">${e(W.auc.note)}</p>` +
      `<div class="nt-chips" role="group" aria-label="경매 거르기">${[["", "전체", all.length], ["fav", "관심 구역", all.filter((r) => r.fav).length], ["in", W.auc.in, all.filter((r) => r.inC).length]].map(([k, l, n]) => `<button type="button" data-clf="${k}" aria-pressed="${k === flt}">${e(l)} <small>${Y.n(n)}</small></button>`).join("")}</div>` +
      (shown.length ? `<ol class="nt-list">${shown.map(({ g, L }) => `<li><h4 class="nt-dh">${e(g.dateT)} <span class="nt-td">${e(g.dday)}</span><small>${e(Y.f(W.sched.auc, { n: L.length }))}</small></h4><ul>${L.map(row).join("")}</ul></li>`).join("")}</ol>` : `<p class="nt-empty">${flt ? "이 조건의 매각기일이 14일 안에 없어요" : "14일 안에 잡힌 구역 안 매각기일이 없어요"}</p>`) +
      `<p class="nt-sub">${e(W.auc.src)}</p></section>` +
      `<section class="wk-c cl-exp"><h4>${e(W.sched.ics)}</h4><p class="nt-sub">${e(W.sched.mine)} ${M.length}건 · 관심 구역·${e(W.auc.in)} 경매 ${exp.length}건 · ${e(W.sched.ics_note)}</p><button type="button" class="btn secondary sm" data-clics${M.length + exp.length ? "" : " disabled"}>캘린더 파일 만들기</button><span class="share-fb" role="status" data-clfb></span></section>`;
  }
  let bound = false;
  Y.cal = (ctx) => {
    const el = document.getElementById("nwCal"); if (!el) return; Y.css();
    const T = Y.T();
    const draw = () => { el.innerHTML = T ? html(ctx, T) : `<p class="nt-empty">일정 자료를 불러오지 못했어요${navigator.onLine === false ? " · 오프라인" : ""}</p>`; };
    draw();
    if (bound || !T) return; bound = true;
    el.addEventListener("click", (ev) => {
      const t = ev.target.closest("button"); if (!t || t.type === "submit") return;
      if (t.hasAttribute("data-clf")) { flt = t.dataset.clf; draw(); const b = el.querySelector(`[data-clf="${flt}"]`); if (b) b.focus({ preventScroll: true }); }
      else if (t.hasAttribute("data-cladd")) { form = !form; draw(); const i = el.querySelector('[name="d"]'); if (i) i.focus(); else { const b = el.querySelector("[data-cladd]"); b && b.focus(); } }
      else if (t.hasAttribute("data-cldel")) { Z.mySched.remove(t.dataset.cldel); draw(); const b = el.querySelector("[data-cladd]"); b && b.focus(); }
      else if (t.hasAttribute("data-clics")) {
        const rows = groups(ctx, T).flatMap((g) => g.items).filter((r) => r.fav || r.inC);
        const evs = Z.icsAuc(rows, (id) => Y.name(ctx, id)).concat(Z.icsMine().filter((x) => x.date >= T.asOf));
        Z.icsDownload(evs, `jaegaepick-${T.asOf}.ics`);
        const fb = el.querySelector("[data-clfb]"); if (fb) fb.textContent = `캘린더 파일을 만들었어요 · ${evs.length}건`;
      }
    });
    el.addEventListener("submit", (ev) => {
      const f = ev.target.closest("[data-clform]"); if (!f) return; ev.preventDefault();
      if (!Z.mySched.add({ d: f.d.value, title: String(f.t.value || "").trim().slice(0, 30), z: f.z ? f.z.value : "" })) return;
      form = false; draw(); const b = el.querySelector("[data-cladd]"); b && b.focus();
    });
  };
})();
    this.Y = window.ZPT;
  }
  return this.Y;
} };
