/* 사이클 5 D 지연 묶음 "today" (src/lazy → /b/ztoday.*.js · ZP_lazy) — 원래 src/todayd 00_core.js · 10_home.js · 40_morn.js */
// 사이클 5 M 지연 묶음 등록 — 몸통은 init() 때 돈다(A 자료·문구 묶음 window.ZP_today가 먼저 열려 있어야 해서 · 73_today.js lz가 연 뒤 부름)
(window.ZP_L || (window.ZP_L = {})).today = { v: 1, init() {
  if (!this.Y) {
/* ===================== 사이클 5 D 화면 묶음(/b/y.*.js) — 오늘 카드 개인 줄 · 소식 서울 오늘·일정·주간 · 내 돈 레이더 · 아침에 받기 =====================
   자료·문구·셈은 A 묶음(window.ZP_today · /b/n.*.js)만 쓴다: 숫자 = today.json(ZP_today.seoul·feed·feedCount·sched·radar), 문구 = tools/feed_words.json(ZP_today.W · 화면 말은 W.ui),
   판정 = 앱 zstate(ctx.zst). 이 묶음은 그리기만 한다(새 셈 없음). 앱 닫힘 범위 밖이라 값·함수는 ctx(73_today.js)로만. */
(function () {
  "use strict";
  const Y = (window.ZPT = window.ZPT || {});
  Y.v = 1;
  Y.css = () => {};   // CSS는 빌드가 같은 이름 .css를 묶음 앞에 <style>로 붙인다(사이클 5 M src/lazy 규칙)
  const Z = window.ZP_today, W = (Y.W = Z.W), U = (Y.U = "__FWUI__");   // 화면 말 = tools/feed_words.json ui(빌드가 넣음)
  Y.Z = Z;
  Y.f = Z.fill;
  Y.esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  Y.n = (v) => Number(v || 0).toLocaleString("ko-KR");
  Y.T = () => Z.get();
  Y.tapp = () => document.documentElement.classList.contains("is-tapp");
  // 날짜: 기기 서울 날짜(내 일정 입력 최소값) · 표시 'M.D(요)'
  Y.day = (t) => new Date((t || Date.now()) + 9 * 36e5).toISOString().slice(0, 10);
  Y.add = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  Y.md = Z.mdw;
  Y.md0 = Z.md;
  Y.ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  Y.lsw = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  // 서울 줄 칸: ZP_today.seoul(t) 그대로(조용한 날 = 새로 올라온 숫자 0 → '적어요 · 이번 주 N건' 줄 + 허가·매각 칸) · 이번 주 줄 = 푸시 주간 줄(ZP_today.weekLine)
  //   tools/td_card.py tiles()가 같은 규칙으로 첫 페인트 HTML을 쓴다
  Y.tiles = (T, id) => {
    const S = Z.seoul(T), p = id ? "" : "x";
    const L = (S.quiet ? S.parts.filter((x) => x.k === "tho" || x.k === "auc_sale") : S.parts).slice(0, 4);
    const lab = (k) => U.tile[k] + (k === "tho" && T.tho_d && T.tho_d !== T.asOf ? ` · ${Z.md(T.tho_d)}` : "");
    const li = L.map((x) => `<li><b>${Y.n(x.n)}</b><span>${Y.esc(lab(x.k))}</span></li>`).join("");
    return (S.quiet ? `<p class="td-few" id="${p}tdF">${Y.esc(S.quietT)}</p>` : "") + (li ? `<ul class="td-s" id="${p}tdS">${li}</ul>` : "") + `<p class="td-w" id="${p}tdW">${Y.esc(Z.weekLine(T))}</p>`;
  };
  Y.cashT = (ctx, v) => { try { return ctx.ZF.cash(v); } catch (e) { return v + "억"; } };
  Y.modeT = (ctx) => (ctx.gap() ? "전세 끼고" : "대출 끼고");
  Y.name = (ctx, id) => { const r = ctx.byId[id]; return r ? ctx.shortName(r.n) : ""; };
  Y.chev = '<svg class="td-cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  // 레이더 ctx(A ZP_today.radar): 판정은 앱 zstate · 끈 구역 제외
  const muteZ = (ctx) => { try { return new Set((Y.ls("zp-alert-mute", {}) || {}).z || []); } catch (e) { return new Set(); } };
  const rctx = (ctx, ids) => ({ cash: ctx.cash(), gap: ctx.gap(), mute: muteZ(ctx), ids, zstate: (id) => { const r = ctx.byId[id]; return r ? ctx.zst(r) : null; } });
  let RC = null, NC = null;
  // 새로 가능 · 멀어짐(같은 금액·방식·자료면 다시 세지 않음) — nw 수 = 목록 '이번 주 새로 가능' 칩 수(60_simple isNew = ZP_today.isNew + 앱 판정)
  Y.radar = (ctx) => { const T = Y.T(), k = `${ctx.cash()}|${ctx.gap()}|${T && T.asOf}`; if (RC && RC.k === k) return RC; const r = T ? Z.radar(T, rctx(ctx)) : { nw: [], far: [], near: [] }; return (RC = Object.assign(r, { k })); };
  // 조금만 더(3,000만 안): ZP_today.radar near와 같은 거르기, 다 센 수(레이더는 가까운 5곳만 돌려줌) — 구역 1천여 곳이라 한 번 세고 금액·방식이 바뀔 때만 다시
  // 이미 센 값만(없으면 null) · 세기는 쉴 때(Y.nearLater) — 소식 탭 열기·카드 채우기 한 덩이를 줄인다(INP·TBT)
  Y.nearC = (ctx) => { const T = Y.T(); return NC && NC.k === `${ctx.cash()}|${ctx.gap()}|${T && T.asOf}` ? NC : null; };
  Y.nearLater = (ctx, f) => (window.requestIdleCallback ? (g) => requestIdleCallback(g, { timeout: 1500 }) : (g) => setTimeout(g, 200))(() => { Y.near(ctx); f(); });
  Y.near = (ctx) => { const T = Y.T(), c = ctx.cash(), k = `${c}|${ctx.gap()}|${T && T.asOf}`; if (NC && NC.k === k) return NC; const m = muteZ(ctx), L = []; for (const id in ctx.byId) { if (m.has(id)) continue; let z = null; try { z = ctx.zst(ctx.byId[id]); } catch (e) {} if (z && z.st === "near" && z.need != null && z.need - c <= 0.3 + 1e-9) L.push({ id, need: z.need, gap: z.need - c }); } L.sort((a, b) => a.gap - b.gap || a.need - b.need); return (NC = { k, n: L.length, top: L.slice(0, 5) }); };
  // 구역 시트 '토지거래허가' 첫 줄(56_toheo): 오늘 카드·/gu와 같은 셈 — today.json tho[구역][1] 최근 30일 주거용 허가 · 문구 feed_words.json tho.sheet/none/note
  Y.th1 = (id, since, el) => { const t = Y.T(), v = t && t.tho && t.tho[id], H = W.tho; if (!el || !t || !H) return; el.textContent = v && v[1] ? Y.f(H.sheet, { n: v[1], d: Z.md(t.tho_d || t.asOf) }) + " · " + H.note : Y.f(H.none, { since }); el.hidden = false; };
})();
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
    // 맨 앞: 내 일정 3일 안 → 관심 구역 매각기일 3일 안(ZP_today.homeFirst · D-day = max(기기 날짜, asOf) · 법원 확인 3일 넘은 물건 뺌)
    out.unshift(...Z.homeFirst(T, new Set(fav), ctx.gap(), U.auc_tag, (id) => ctx.byId[id]));
    return out;
  }
  const TAG = { stage: "단계", notice: "고시", auction: "경매", tho: "허가", trade: "거래", auc_d: "일정", mine: "내 일정" };
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
    const R = Y.radar(ctx), N = Y.nearC(ctx) || { n: 0 }, P = [];
    if (!Y.nearC(ctx)) Y.nearLater(ctx, () => { const a = document.querySelector('#tdMe [data-tdgo="rad"]'); if (a) a.outerHTML = rowMoney(ctx); });
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
    // 자료가 기기 날짜보다 이르면 'N일 전 자료' · 계산 방식 고친 날 안내(ZP_today.note)
    const t = Z.note(T), h = document.querySelector("#tdCard .td-h"); let p = document.getElementById("tdNt");
    if (!p && t && h) { h.insertAdjacentHTML("afterend", '<p class="td-nt" id="tdNt" role="note"></p>'); p = h.nextSibling; }
    if (p) { p.textContent = t; p.hidden = !t; }
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
      const rad = g.dataset.tdgo === "rad";
      ctx.z().then(() => { Y.go(ctx, "mine"); if (rad) setTimeout(() => { const r = document.getElementById("nwRad"); if (r) r.scrollIntoView({ block: "start" }); }, 400); }).catch(() => {});
    });
    // 금액·방식·관심 구역이 바뀌면 개인 줄만 다시(오늘 한 줄 차례는 그대로) — 앱에 금액 바뀜 알림이 따로 없어 예산 카드 글자·눌림을 본다
    const re = () => { const a = me.querySelector('[data-tdgo="rad"]'), b = me.querySelector('[data-tdgo="mine"],[data-tdgo="map"]'); if (a) a.outerHTML = rowMoney(ctx); if (b) b.outerHTML = rowFav(ctx); };
    let t = 0; const later = () => { clearTimeout(t); t = setTimeout(re, 400); };
    addEventListener("zp:alerts", later); try { ctx.pins.on(later); } catch (er) {}
    try { const g = document.getElementById("sGauge"); if (g) new MutationObserver(later).observe(g, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-pressed"] }); } catch (er) {}
    addEventListener("online", () => head(T)); addEventListener("offline", () => head(T));
  };
})();
/* '아침에 받기' — 빈도(중요한 것만 기본 · 매일 · 주 1회)를 고르고 단추를 누를 때만 조건 저장 → 알림 권한 → 구독(72_inbox subscribe 한 길)
   권한 창은 이 단추를 누를 때만 뜬다. 거부됐으면 다시 묻지 않고 폰 설정 안내만. */
(function () {
  "use strict";
  const Y = window.ZPT, W = Y.W, U = Y.U, e = Y.esc;
  let N = 0;
  const st = (ctx) => { try { return ctx.inbox.st(); } catch (er) { return null; } };
  // 받을 수 있는 기기인지(서버 키가 왔고 막히지 않음) — 아니면 단추를 보이지 않는다
  const can = (s) => !!(s && s.can && s.perm !== "denied" && s.perm !== "unsupported");
  function boxHTML(ctx, where) {
    const s = st(ctx); if (!s) return "";
    const f = ctx.inbox.freq(), id = "mo" + ++N;
    if (s.on) return `<div class="mo-box on" data-mo="${where}"><p class="mo-t"><b>${e(Y.f(U.morning_on, { f: W.freq[f] }))}</b><small>${e(W.freq_note[f])}</small></p><div class="mo-f" role="radiogroup" aria-label="알림 빈도">${["i", "d", "w"].map((k) => `<button type="button" role="radio" aria-checked="${k === f}" data-mof="${k}">${e(W.freq[k])}</button>`).join("")}</div></div>`;
    if (!can(s)) return s && s.perm === "denied" ? `<div class="mo-box" data-mo="${where}"><p class="mo-t"><b>알림이 막혀 있어요</b><small>${e(Y.tapp() ? `폰 설정 → 애플리케이션(또는 앱) → ${ctx.BRAND} → 알림에서 허용할 수 있어요` : "주소창 왼쪽 자물쇠(사이트 설정)에서 알림을 허용할 수 있어요")}</small></p></div>` : "";
    return `<div class="mo-box" data-mo="${where}"><p class="mo-t" id="${id}"><b>${e(U.morning)}</b><small>${e(`내 돈 ${Y.cashT(ctx, ctx.cash())}·${Y.modeT(ctx)} 조건 · 관심 구역`)}</small></p>` +
      `<div class="mo-f" role="radiogroup" aria-labelledby="${id}">${["i", "d", "w"].map((k) => `<button type="button" role="radio" aria-checked="${k === f}" data-mof="${k}">${e(W.freq[k])}</button>`).join("")}</div>` +
      `<p class="mo-h" data-moh>${e(W.freq_note[f])}</p><button type="button" class="btn primary mo-go" data-mogo>아침에 받기</button><p class="mo-m" role="status" data-mom></p></div>`;
  }
  Y.mornBox = (ctx, where) => boxHTML(ctx, where);
  Y.mornBind = (ctx, root) => {
    if (!root || root.dataset.mob) return; root.dataset.mob = "1";
    root.addEventListener("click", async (ev) => {
      const t = ev.target.closest("[data-mof],[data-mogo]"); if (!t) return;
      const box = t.closest("[data-mo]"); if (!box) return;
      if (t.hasAttribute("data-mof")) {
        const v = t.dataset.mof, on = box.classList.contains("on");
        // 고르기만(권한 창 없음) · 이미 켜져 있으면 바로 서버 구독에 반영(72_inbox freq → sync)
        if (on) ctx.inbox.setFreq(v); else box.dataset.f = v;
        box.querySelectorAll("[data-mof]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mof === v)));
        const h = box.querySelector("[data-moh]") || box.querySelector(".mo-t small"); if (h) h.textContent = W.freq_note[v];
        if (on) { const b = box.querySelector(".mo-t b"); if (b) b.textContent = Y.f(U.morning_on, { f: W.freq[v] }); }
        return;
      }
      // 누름: 빈도 저장 → 지금 조건을 알림 조건으로(이미 같은 조건이면 그대로) → 권한(이때만) → 구독
      const f = box.dataset.f || ctx.inbox.freq();
      ctx.inbox.setFreq(f);
      try { ctx.pins.condSave(); } catch (er) {}
      const r = await ctx.inbox.subscribe(t);
      const m = box.querySelector("[data-mom]");
      if (r && r.ok) { box.outerHTML = boxHTML(ctx, box.dataset.mo); try { window.dispatchEvent(new Event("zp:alerts")); } catch (er) {} }
      else if (m) { m.textContent = (r && r.msg) || "알림을 켜지 못했어요 · MY › 알림 설정에서 다시 켤 수 있어요"; if (r && r.denied) t.hidden = true; }
    });
  };
  // 오늘 카드 끝: 받을 수 있는데 아직 안 받는 기기만 '아침에 받기' 한 단추(누르면 빈도 고르는 칸이 펼쳐짐 — 권한은 그 안 단추에서)
  Y.mornFoot = (ctx, card) => {
    const f = card.querySelector(".td-f"); if (!f) return;
    const put = () => {
      const s = st(ctx), old = f.querySelector(".mo-open"); if (old) old.remove();
      if (!can(s) || s.on) return;
      f.insertAdjacentHTML("afterbegin", '<button type="button" class="btn text sm mo-open" aria-expanded="false" aria-controls="tdMo">아침에 받기</button>');
    };
    put(); ctx.inbox.pushKey().then(put);
    if (card.dataset.mof) return; card.dataset.mof = "1";
    card.addEventListener("click", (ev) => {
      const o = ev.target.closest(".mo-open"); if (!o) return;
      let p = card.querySelector("#tdMo");
      if (p) { p.remove(); o.setAttribute("aria-expanded", "false"); return; }
      f.insertAdjacentHTML("beforebegin", `<div id="tdMo">${boxHTML(ctx, "home")}</div>`); o.setAttribute("aria-expanded", "true");
      p = card.querySelector("#tdMo"); Y.mornBind(ctx, p); const g = p.querySelector("[data-mof]"); if (g) g.focus();
    });
  };
})();
    this.Y = window.ZPT;
  }
  return this.Y;
} };
