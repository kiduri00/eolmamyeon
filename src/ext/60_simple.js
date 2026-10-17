/* ===================== 첫 화면 단순화(사용자 피드백) =====================
   메인 = 현금 게이지 + 서울 지도 + "지역 · 필요한 돈" 목록. 글자는 최소로.
   나머지 기능(계산기 세부 조건·출퇴근·순위·고시 등)은 아래 타일을 눌러 하나씩 연다.
   기존 섹션과 계산 엔진은 그대로 두고, 화면 구성만 바꾼다. */
const SIMPLE = (() => {
  // [화면 id, 이름, 아이콘 경로, 아이콘 색]
  const VIEWS = [
    ["planner", "세부 계산", "M4 6h16M4 12h10M4 18h7", "#1f3a87"],
    ["commuteTop", "출퇴근", "M7 3h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 10h14M8 20l2-4M16 20l-2-4", "#2f6feb"],
    ["rankTop", "입지 순위", "M5 20V11M12 20V4M19 20v-6", "#d97706"],
    ["txrTop", "실거래", "M4 18l5-6 4 3 7-9M15 6h5v5", "#dc2626"],
    ["ntcTop", "고시·공고", "M6 3h9l4 4v14H6zM9 12h7M9 16h5", "#0e7490"],
    ["saveTop", "모으면 언제", "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l3 2M9 2h6", "#4f46e5"],
    ["favTop", "찜·비교", "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z", "#db2777"],
    ["newTop", "단계 변경", "M4 12a8 8 0 1 0 3-6.2M4 4v4h4", "#059669"],
    ["rulesTop", "매수 규정", "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z", "#475569"],
    ["readsTop", "읽을거리", "M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z", "#7c3aed"],
  ];
  const LINKS = [["guide/rebuild-30y", "재건축 30년", "M4 21V8l8-5 8 5v13M9 21v-6h6v6", "#b45309"], ["report/", "월간 리포트", "M5 4h14v17H5zM8 9h8M8 13h8M8 17h5", "#1f3a87"]];
  const IDS = VIEWS.map((v) => v[0]);
  let gu = "", kind = "", shown = 6, timer = 0;
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const eokS = (v) => (v == null || !isFinite(v) ? "–" : v < 0.05 ? "0원" : `${(Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "")}억`);
  const dongOf = (r) => { const m = /^([가-힣0-9]+?(?:동\d*가|동|가))\s/.exec((r.j || "") + " "); return m ? m[1] : ""; };
  const KIND = (r) => (/재건축/.test(r.k) ? "rebuild" : /가로|소규모/.test(r.k) ? "small" : "redev");
  function needOf(r) {
    if (gapMode()) { const g = gapOf(r); return { now: g.now, total: g.total }; }
    const x = investC(r);
    return { now: x.needBuy, total: x.ok ? x.needTotal : null };
  }
  function rows() {
    return R.filter((r) => r.ll && dotState(r) === "y" && (!gu || r.g === gu) && (!kind || KIND(r) === kind))
      .map((r) => ({ r, n: needOf(r), early: r.s <= 1 || r.eta?.p10 == null }))
      .sort((a, b) => a.early - b.early || (gapMode() || effBasis() !== "total" ? (a.n.now ?? 99) - (b.n.now ?? 99) : (a.n.total ?? 99) - (b.n.total ?? 99)));
  }
  // ---------- 화면 만들기 ----------
  function build() {
    document.documentElement.classList.add("simple");
    try { hdrH = 0; } catch (e) {}   // 탭바를 숨겼으니 머리 높이를 다시 잰다
    const map = $("mapTop");
    const hero = document.createElement("div");
    hero.className = "s-hero"; hero.id = "sHero";
    hero.innerHTML = `
      <button type="button" class="s-search" id="sSearch"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>구역 이름, 주소, 역으로 검색</button>
      <h1 class="s-h1">내 돈으로 서울 재개발 어디까지?</h1>
      <div class="s-gauge">
        <div class="s-gtop"><label for="sCash" class="s-cash"><b id="sCashV">1억</b><span>있으면</span></label>
          <div class="s-mode" role="group" aria-label="사는 방식"><button type="button" data-f="gap">전세 끼고</button><button type="button" data-f="cash">현금만</button></div></div>
        <input type="range" id="sCash" min="0.5" max="15" step="0.5" value="1" aria-describedby="sCount" aria-label="가진 현금(억)">
        <div class="s-ticks" aria-hidden="true"><span>0.5억</span><span>5억</span><span>10억</span><span>15억</span></div>
        <p class="s-count" id="sCount" aria-live="polite"><b id="sN">0</b><span id="sNL">곳 가능</span><span class="s-hint">아래 지도에 바로 표시돼요</span></p>
      </div>`;
    map.insertBefore(hero, map.firstChild);
    const list = document.createElement("div");
    list.className = "s-list-w"; list.id = "sListW";
    list.innerHTML = `<div class="s-lh"><h2 id="sLT">살 수 있는 곳</h2><div class="s-flt" role="group" aria-label="유형"><button type="button" data-k="" aria-pressed="true">전체</button><button type="button" data-k="redev" aria-pressed="false">재개발</button><button type="button" data-k="rebuild" aria-pressed="false">재건축</button><button type="button" data-k="small" aria-pressed="false">가로·소규모</button></div></div>
      <p class="s-gu" id="sGu" hidden></p><ol class="s-list" id="sList"></ol><button type="button" class="btn secondary s-more" id="sMore" hidden></button>`;
    map.querySelector(".main").after(list);
    // 스크롤해 지도를 볼 때 게이지가 머리 아래에 작게 붙어 있도록(움직이면 지도가 바로 바뀌는 걸 보며 조절)
    const g = hero.querySelector(".s-gauge"), sen = document.createElement("i");
    hero.after(g); sen.className = "s-sen"; g.before(sen);
    document.documentElement.style.setProperty("--hdr-h", (HDR() || 60) + "px");
    if (window.IntersectionObserver) new IntersectionObserver((es) => es.forEach((x) => g.classList.toggle("stuck", !x.isIntersecting && x.boundingClientRect.top < 0)), { rootMargin: `-${(HDR() || 60) + 1}px 0px 0px 0px` }).observe(sen);
    const tiles = document.createElement("section");
    tiles.className = "sec s-tiles"; tiles.id = "sTiles"; tiles.setAttribute("aria-labelledby", "sTT");
    const ic = (d, c) => `<i aria-hidden="true" style="--ic:${c}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></i>`;
    tiles.innerHTML = `<h2 id="sTT">더 알아보기</h2><div class="s-tg">${VIEWS.map(([id, t, d, c]) => `<a href="#${id}" class="s-t" data-view="${id}">${ic(d, c)}<b>${t}</b></a>`).join("")}${LINKS.map(([u, t, d, c]) => `<a href="${u}" class="s-t">${ic(d, c)}<b>${t}</b></a>`).join("")}</div>`;
    list.after(tiles);
    hero.insertBefore(hero.querySelector('#sSearch'), hero.firstChild);
    // 모바일 아래 탭바(앱처럼)
    const nav = document.createElement("nav");
    nav.className = "s-nav"; nav.id = "sNav"; nav.setAttribute("aria-label", "주요 메뉴");
    nav.innerHTML = [["home", "홈", "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"], ["map", "지도", "M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"], ["search", "검색", "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5"], ["fav", "찜", "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"], ["more", "전체", "M4 6h16M4 12h16M4 18h16"]]
      .map(([k, t, d]) => `<button type="button" data-nav="${k}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg><span>${t}</span></button>`).join("");
    document.body.appendChild(nav);
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("[data-nav]"); if (!b) return;
      const k = b.dataset.nav;
      if (k === "home") { close(); if ($("report").classList.contains("sheet")) closeSheetNow(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (k === "map") { close(); requestAnimationFrame(() => { const m = $("mapbox"); window.scrollTo({ top: m.getBoundingClientRect().top + scrollY - HDR() - 12, behavior: "smooth" }); }); }
      else if (k === "search") search();
      else if (k === "fav") open("favTop");
      else if (k === "more") $("menuBtn").click();
    });
    $("sSearch").onclick = search;
    // 각 기능 화면 위에 '지도로' 버튼
    IDS.forEach((id) => {
      const s = $(id); if (!s || s.querySelector(".s-back")) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "s-back"; b.innerHTML = "← 지도로";
      b.onclick = () => close(true);
      s.insertBefore(b, s.firstChild);
    });
    // 이벤트
    const sl = $("sCash");
    sl.addEventListener("input", () => { label(+sl.value); clearTimeout(timer); timer = setTimeout(() => setCash(+sl.value), 90); });
    sl.addEventListener("change", () => { clearTimeout(timer); setCash(+sl.value); });
    map.querySelector(".s-mode").addEventListener("click", (e) => { const b = e.target.closest("button[data-f]"); if (b) setFund(b.dataset.f); });
    list.querySelector(".s-flt").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      kind = b.dataset.k; shown = 6;
      $$(".s-flt button", list).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
    });
    $("sMore").onclick = () => { shown += 10; render(); };
    $("sList").addEventListener("click", (e) => {
      const a = e.target.closest("[data-id]"); if (!a) return;
      e.preventDefault(); curTab = "money"; select(a.dataset.id, true, false, { scroll: true });
    });
    tiles.addEventListener("click", (e) => { const a = e.target.closest("[data-view]"); if (!a) return; e.preventDefault(); open(a.dataset.view); });
  }
  function search() {
    const b = $("sOpen");
    if (b && getComputedStyle(b).display !== "none") b.click();
    else { window.scrollTo({ top: 0, behavior: "smooth" }); $("q").focus(); }
  }
  function label(v) {
    $("sCashV").textContent = `${String(v).replace(/\.0$/, "")}억`;
    const pct = ((v - 0.5) / 14.5) * 100;
    $("sCash").style.setProperty("--p", pct + "%");
  }
  function setCash(v) {
    const el = $("pCash");
    if (+el.value === v) return render();
    el.value = String(v);
    try { PREV_CASH = null; } catch (e) {}
    planN = PLAN0();
    plan();
  }
  // ---------- 목록 ----------
  function render() {
    if (!$("sList")) return;
    const gap = gapMode();
    const v = +$("pCash").value || 1;
    if (+$("sCash").value !== v) { $("sCash").value = Math.min(15, Math.max(0.5, v)); }
    label(+$("sCash").value);
    $$(".s-mode button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.f === "gap") === gap)));
    gu = mapView === "gu" && mapGu ? mapGu : "";
    const L = rows();
    const all = R.filter((r) => r.ll && dotState(r) === "y").length;
    $("sN").textContent = fmt(all);
    $("sNL").textContent = gap ? "곳 계약 가능" : effBasis() === "total" ? "곳 입주까지 가능" : "곳 지금 매수 가능";
    $("sLT").textContent = gu ? `${gu} · ${fmt(L.length)}곳` : `살 수 있는 곳 · ${fmt(L.length)}곳`;
    const sg = $("sGu");
    sg.hidden = !gu;
    if (gu) sg.innerHTML = `지도에서 고른 <b>${esc(gu)}</b>만 보고 있어요 <button type="button" class="btn text sm" id="sGuX">서울 전체</button>`;
    if (gu) $("sGuX").onclick = () => { exitGu({}); };
    $("sList").innerHTML = L.length
      ? L.slice(0, shown).map(({ r, n, early }) => `<li><a href="#${r.id}" data-id="${r.id}"><span class="s-nm"><b>${esc(shortName(r.n))}</b><small>${esc(r.g)} ${esc(dongOf(r))}${early ? ' · <em>초기 단계</em>' : ""}</small></span><span class="s-amt"><b>${eokS(gap || effBasis() !== "total" ? n.now : n.total)}</b><small>${gap || effBasis() !== "total" ? (n.total != null ? `입주까지 ${eokS(n.total)}` : "계약할 때") : "입주까지"}</small></span></a></li>`).join("")
      : `<li class="s-empty">${gu ? `${esc(gu)}에는 이 금액으로 되는 곳이 없어요.` : "이 금액으로 되는 곳이 없어요."} 게이지를 올려 보세요.</li>`;
    const m = $("sMore");
    m.hidden = L.length <= shown;
    m.textContent = `더 보기 (${fmt(L.length - shown)}곳)`;
  }
  // ---------- 기능 화면 열기/닫기 ----------
  let cur = "";
  function open(id, noScroll) {
    if (!IDS.includes(id)) return false;
    IDS.forEach((x) => { const s = $(x); if (s) s.classList.toggle("s-on", x === id); });
    document.documentElement.classList.add("s-view");
    cur = id;
    const f = SECT[id]; if (f) f();
    if (id === "results" || id === "planner") { planN = PLAN0(); plan(); }
    window.dispatchEvent(new Event("resize"));
    if (!noScroll) requestAnimationFrame(() => { const s = $(id); if (s) window.scrollTo({ top: s.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); });
    try { if (location.hash.slice(1) !== id) history.pushState({ sView: id }, "", "#" + id); } catch (e) {}
    return true;
  }
  function close(scroll) {
    IDS.forEach((x) => { const s = $(x); if (s) s.classList.remove("s-on"); });
    document.documentElement.classList.remove("s-view");
    cur = "";
    if (location.hash && IDS.includes(location.hash.slice(1))) try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {}
    if (scroll) requestAnimationFrame(() => { const t = $("sTiles"); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); });
  }
  function init() {
    build();
    try { SECT.mapTop(); } catch (e) {}
    // 기존 '바로가기'(메뉴·다음 단계·히어로 링크)는 해당 기능 화면을 연다
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("[data-menu],[data-jump2],[data-sec],a[href^='#']");
      if (!a || a.closest("#sTiles") || a.closest("#sList")) return;
      const id = a.dataset.menu || a.dataset.jump2 || a.dataset.sec || (a.getAttribute("href") || "").slice(1);
      if (IDS.includes(id)) { e.preventDefault(); e.stopImmediatePropagation(); if (a.closest("#menuPop")) $("menuBtn").click(); open(id); }
      else if (id === "mapTop" || id === "planner0") { e.preventDefault(); close(); }
    }, true);
    const fromHash = () => { const h = location.hash.slice(1); if (IDS.includes(h)) open(h, false); else if (cur && !byId[h]) close(); };
    addEventListener("popstate", fromHash);
    fromHash();
    const _p = plan;
    plan = function () { const x = _p.apply(this, arguments); try { render(); } catch (e) {} return x; };
    const _eg = enterGu, _xg = exitGu;
    enterGu = function () { const x = _eg.apply(this, arguments); shown = 6; render(); return x; };
    exitGu = function () { const x = _xg.apply(this, arguments); shown = 6; render(); return x; };
    render();
  }
  return { init, open, close, render };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", SIMPLE.init) : setTimeout(SIMPLE.init, 0);
