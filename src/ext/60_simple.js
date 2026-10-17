/* ===================== 첫 화면 단순화(사용자 피드백) =====================
   메인 = 현금 게이지 + 서울 지도 + "지역 · 필요한 돈" 목록. 글자는 최소로.
   나머지 기능(계산기 세부 조건·출퇴근·순위·고시 등)은 아래 타일을 눌러 하나씩 연다.
   기존 섹션과 계산 엔진은 그대로 두고, 화면 구성만 바꾼다. */
const SIMPLE = (() => {
  // [화면 id, 이름, 아이콘 경로, 아이콘 색]
  const VIEWS = [
    ["gapTop", "갭 순위", "M4 20h16M7 16V9M12 16V5M17 16v-4", "#1f3a87"],
    ["diagTop", "매물진단", "M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "#16a34a"],
    ["planner", "입주 계산", "M4 4h16v16H4zM8 8h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h4", "#4f46e5"],
    ["txrTop", "실거래 순위", "M4 18l5-6 4 3 7-9M15 6h5v5", "#dc2626"],
    ["ntcTop", "단계 소식", "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4", "#0e7490"],
    ["favTop", "구역 비교", "M4 5h7v14H4zM13 5h7v14h-7z", "#d97706"],
    ["commuteTop", "출퇴근", "M7 3h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 10h14M8 20l2-4M16 20l-2-4", "#2f6feb"],
    ["supplyTop", "입주 물량", "M3 21V10l5-3v14M8 21V5l7-3v19M15 21V9l6 3v9", "#b45309"],
  ];
  // 아이콘 격자에는 안 넣지만 메뉴(⋯)·링크로 여는 화면
  const MORE = ["results", "newTop", "rulesTop", "readsTop", "statsTop", "rankTop", "saveTop"];
  const LINKS = [];
  const IDS = VIEWS.map((v) => v[0]).concat(MORE, ["favTop"]);
  const KN = [[0, 0.5], [28, 2], [58, 5], [88, 10], [100, 15]];
  const toCash = (p) => { for (let i = 1; i < KN.length; i++) if (p <= KN[i][0]) { const [a, x] = KN[i - 1], [b, y] = KN[i]; const v = x + ((p - a) / (b - a)) * (y - x); return v < 2 ? Math.round(v * 10) / 10 : v < 10 ? Math.round(v * 2) / 2 : Math.round(v); } return 15; };
  const toPos = (c) => { c = Math.min(15, Math.max(0.5, c)); for (let i = 1; i < KN.length; i++) if (c <= KN[i][1]) { const [a, x] = KN[i - 1], [b, y] = KN[i]; return a + ((c - x) / (y - x)) * (b - a); } return 100; };
  let POPS = null;   // POP은 앱 본문에서 나중에 만들어지므로 처음 쓸 때 채운다
  // 지도 구별 숫자와 같은 기준(지도 색칠 기준이 '지금 매수'로 바뀌면 목록도 같이)
  const okR = (r) => (POPS || (POPS = new Set(POP.map((x) => x.id)))).has(r.id) && (effBasis() === "now" ? affOk(r, "now") : affOk(r));
  // 홈 '살 수 있는 곳' 곳 수 — 다른 화면도 이 함수 하나로 센다(cash 생략 시 지금 게이지 금액)
  const countAt = (cash) => {
    if (cash == null || !isFinite(cash)) return R.filter(okR).length;
    const save = CASH;
    try { CASH = +cash; return R.filter(okR).length; } finally { CASH = save; }
  };
  window.ZP_count = countAt;
  // 목록 정렬: 맞춤(내 돈에 가장 가까운 곳 먼저) · 적은 돈 · 입주 빠른
  const SORTS = [["fit", "맞춤순"], ["low", "적은 돈순"], ["eta", "입주 빠른순"]];
  let sortK = "fit";
  try { const s0 = localStorage.getItem("emr.sort"); if (SORTS.some((x) => x[0] === s0)) sortK = s0; } catch (e) {}
  let listGu = "", gu = "", kind = "", shown = 6, timer = 0, keepY = null;
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const eokS = (v) => (v == null || !isFinite(v) ? "–" : v < 0.05 ? "0원" : `${(Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "")}억`);
  const dongOf = (r) => { const m = /^(?:서울(?:특별)?시\s*)?(?:[가-힣]+구\s+)?([가-힣]+?(?:\d+(?:·\d+)*)?(?:동\d+가|로\d+가|\d+가|동|로|가))(?=[\s\d(산]|$)/.exec(r.j || r.bj || ""); return m ? m[1] : r.dg || ""; };
  const KIND = (r) => (/재건축/.test(r.k) ? "rebuild" : /가로|소규모/.test(r.k) ? "small" : "redev");
  function needOf(r) {
    if (gapMode()) { const g = gapOf(r); return { now: g.now, total: g.total }; }
    const x = investC(r);
    return { now: x.needBuy, total: x.ok ? x.needTotal : null };
  }
  function rows() {
    const nowK = gapMode() || effBasis() !== "total";
    const etaT = (r) => { try { const p = projection(r); return p && p.eMid && !p.past ? +p.eMid : Infinity; } catch (e) { return Infinity; } };
    const L = R.filter((r) => okR(r) && !r.lc && (!gu || r.g === gu) && (!kind || KIND(r) === kind))
      .map((r) => { const n = needOf(r), m = (nowK ? n.now : n.total) ?? 99; return { r, n, m, early: r.s <= 1 || r.eta?.p10 == null, eta: sortK === "eta" ? etaT(r) : 0 }; });
    // '입주까지 계산 전'은 어떤 정렬이든 맨 아래로
    return L.sort((a, b) => (a.n.total == null) - (b.n.total == null)
      || (sortK === "fit" ? Math.round(b.m * 10) - Math.round(a.m * 10) : sortK === "eta" ? (a.eta === b.eta ? 0 : a.eta < b.eta ? -1 : 1) : Math.round(a.m * 10) - Math.round(b.m * 10))
      || a.m - b.m);
  }
  // 아래 탭바: 지금 보는 화면에 맞는 탭을 켠다
  function navMark(k) {
    document.querySelectorAll("#sNav button").forEach((x) => { if (x.dataset.nav === k) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); });
  }
  // 폰: 하단 '지도'를 누르면 지도를 화면 가득(호갱노노처럼). 게이지는 위 작은 막대로.
  // 주소 #map = 전체 지도(뒤로가기로 닫힘, /#map 링크로 바로 열림). 지도 탭에 불이 들어온다
  function fullMap(on) {
    const h = document.documentElement;
    if (on == null) on = !h.classList.contains("s-full");
    if (on === h.classList.contains("s-full")) { if (on) navMark("map"); return; }
    h.classList.toggle("s-full", on);
    const m = $("sMini"); if (m) m.hidden = !on && m.hidden;
    if (on && m) m.hidden = false;
    navMark(on ? "map" : "home");
    setTimeout(() => window.dispatchEvent(new Event("resize")), 30);
    [60, 300, 800].forEach((t) => setTimeout(() => { try { LMX.fit(); } catch (e) {} }, t));
    try {
      const base = location.pathname + location.search;
      // /#map 으로 바로 들어온 경우(root)는 뒤로 갈 곳이 사이트 밖이라 주소만 지운다
      if (on && !(history.state && history.state.sFull)) { if (location.hash === "#map") history.replaceState({ sFull: 1, root: 1 }, "", base + "#map"); else history.pushState({ sFull: 1 }, "", base + "#map"); }
      else if (!on && history.state && history.state.sFull) { if (history.state.root) history.replaceState(null, "", base); else history.back(); }
      else if (!on && location.hash === "#map") history.replaceState(null, "", base);
    } catch (e) {}
  }
  // ---------- 화면 만들기 ----------
  function build() {
    document.documentElement.classList.add("simple", "s-built");
    try { hdrH = 0; } catch (e) {}   // 탭바를 숨겼으니 머리 높이를 다시 잰다
    const map = $("mapTop");
    // shell.html에 뼈대(게이지·목록·오른쪽 칸)가 이미 있으면 그대로 이어 쓴다 — 첫 페인트와 같은 높이라 화면이 밀리지 않는다
    let hero = $("sHero"), list = $("sListW"), right = $("sRight");
    const main = map.querySelector(".main");
    if (!hero) {
      hero = document.createElement("div");
      hero.className = "s-hero"; hero.id = "sHero";
      hero.innerHTML = `
      <button type="button" class="s-search" id="sSearch"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>구역 이름, 주소, 역으로 검색</button>
      <div class="s-gauge">
        <div class="s-ghead"><h1 class="s-h1">내 돈으로 살 수 있는 <em>서울 재개발</em></h1>
          <div class="s-mode" role="group" aria-label="사는 방식"><button type="button" data-f="gap">전세 끼고</button><button type="button" data-f="cash">대출 끼고</button></div><button type="button" class="s-asm" id="sAsm" hidden aria-haspopup="dialog"></button></div>
        <div class="s-gmain">
          <label for="sCash" class="s-cash"><small>내 현금</small><b id="sCashV">1억</b></label>
          <span class="s-arrow" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
          <p class="s-count" id="sCount" aria-live="polite"><small id="sNL">살 수 있는 곳</small><b><span id="sN">0</span><i>곳</i></b></p>
        </div>
        <input type="range" id="sCash" min="0" max="100" step="0.1" value="8.33" aria-describedby="sCount" aria-label="가진 현금(억)">
        <div class="s-ticks" aria-hidden="true"><span>0.5억</span><span>2</span><span>5</span><span>10</span><span>15</span></div>
      </div>`;
      map.insertBefore(hero, map.firstChild);
    }
    if (!list) {
      list = document.createElement("div");
      list.className = "s-list-w"; list.id = "sListW";
      list.innerHTML = `<div class="s-lh"><div><h2 id="sLT">살 수 있는 곳</h2><p class="s-lsub"><span id="sLS"></span><label class="s-sort"><span class="sr-only">정렬</span><select id="sSort">${SORTS.map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label></p></div><div class="s-flt" role="group" aria-label="유형"><button type="button" data-k="" aria-pressed="true">전체</button><button type="button" data-k="redev" aria-pressed="false">재개발</button><button type="button" data-k="rebuild" aria-pressed="false">재건축</button><button type="button" data-k="small" aria-pressed="false">가로·소규모</button></div></div>
      <p class="s-gu" id="sGu" hidden></p><ol class="s-list" id="sList"></ol><button type="button" class="btn secondary s-more" id="sMore" hidden></button>`;
    }
    try { $("sSort").value = sortK; } catch (e) {}
    if (!right) {
      right = document.createElement("div");
      right.className = "s-right"; right.id = "sRight";
      right.innerHTML = `<button type="button" class="s-tolist" id="sToList">← 살 수 있는 곳 목록</button>`;
      main.appendChild(right); right.appendChild($("report"));
    }
    const place = () => { if (matchMedia("(min-width:981px)").matches) { if (list.nextElementSibling !== $("report")) right.insertBefore(list, $("report")); } else if (main.nextElementSibling !== list) main.after(list); };
    place(); matchMedia("(min-width:981px)").addEventListener("change", place);
    $("sToList").onclick = () => document.documentElement.classList.remove("s-rep");
    // 스크롤해 지도를 볼 때 게이지가 머리 아래에 작게 붙어 있도록(움직이면 지도가 바로 바뀌는 걸 보며 조절)
    const g = map.querySelector(".s-gauge");
    if (g.parentNode === hero) { const sen = document.createElement("i"); hero.after(g); sen.className = "s-sen"; g.before(sen); }
    document.documentElement.style.setProperty("--hdr-h", (HDR() || 60) + "px");
    // 머리 높이가 바뀌면(화면 회전·검색 열기) 붙는 막대 위치도 같이
    try { new ResizeObserver(() => { const h = $("hdr").offsetHeight; if (h) { try { hdrH = h; } catch (e) {} document.documentElement.style.setProperty("--hdr-h", h + "px"); } }).observe($("hdr")); } catch (e) {}
    // 큰 게이지가 화면 위로 지나가면, 지도·목록을 보는 동안만 머리 아래에 한 줄짜리 게이지를 띄운다(흐름 높이는 그대로)
    const mini = document.createElement("div");
    mini.className = "s-mini"; mini.id = "sMini"; mini.hidden = true;
    mini.innerHTML = `<b id="sMiniV">1억</b><input type="range" id="sMiniR" min="0" max="100" step="0.1" value="8.33" aria-label="가진 현금(억)"><span><i id="sMiniM">전세</i> <b id="sMiniN">0</b>곳</span>`;
    document.body.appendChild(mini);
    const mr = mini.querySelector("#sMiniR");
    mr.addEventListener("input", () => { $("sCash").value = mr.value; label(toCash(+mr.value)); live(toCash(+mr.value)); });
    mr.addEventListener("change", () => { clearTimeout(timer); clearTimeout(idleT); setCash(toCash(+mr.value), true); });
    let gaugeOut = false, areaIn = true;
    const sync = () => { if (document.documentElement.classList.contains("s-full")) { mini.hidden = false; return; } mini.hidden = !(gaugeOut && areaIn && !document.documentElement.classList.contains("s-view")) || !matchMedia("(max-width:980px)").matches; };
    if (window.IntersectionObserver) {
      new IntersectionObserver((es) => es.forEach((x) => { gaugeOut = !x.isIntersecting && x.boundingClientRect.top < (x.rootBounds ? x.rootBounds.top : 0) + 1; sync(); }), { rootMargin: `-${(HDR() || 56)}px 0px 0px 0px` }).observe(g);
      new IntersectionObserver((es) => es.forEach((x) => { areaIn = x.isIntersecting; sync(); }), { rootMargin: `-${(HDR() || 56) + 60}px 0px -40% 0px` }).observe(list);
      new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { areaIn = true; sync(); } }), { rootMargin: `-${(HDR() || 56) + 60}px 0px 0px 0px` }).observe(map.querySelector(".main"));
    }
    const tiles = document.createElement("section");
    tiles.className = "sec s-tiles"; tiles.id = "sTiles"; tiles.setAttribute("aria-labelledby", "sTT");
    const ic = (d, c) => `<i aria-hidden="true" style="--ic:${c}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></i>`;
    const SUB = { gapTop: "적은 돈으로 들어갈 곳", diagTop: "이 매물 입주권 나오나", planner: "내 조건으로 입주까지 얼마", txrTop: "신고가·거래 많은 곳", ntcTop: "인가·시공자 선정 새 소식", favTop: "찜한 구역 나란히", commuteTop: "회사까지 몇 분 안", supplyTop: "해마다 입주 몇 세대" }, LSUB = { "guide/rebuild-30y": "30년 넘은 아파트 1,077단지", "report/": "매달 단계 변경 정리" };
    tiles.innerHTML = `<h2 id="sTT">더 알아보기</h2><div class="s-tg">${VIEWS.map(([id, t, d, c]) => `<a href="#${id}" class="s-t" data-view="${id}">${ic(d, c)}<span class="s-tx"><b>${t}</b><small>${SUB[id] || ""}</small></span></a>`).join("")}${LINKS.map(([u, t, d, c]) => `<a href="${u}" class="s-t">${ic(d, c)}<span class="s-tx"><b>${t}</b><small>${LSUB[u] || ""}</small></span></a>`).join("")}</div>`;
    map.after(tiles);
    hero.insertBefore(hero.querySelector('#sSearch'), hero.firstChild);
    // 모바일 아래 탭바(앱처럼)
    const nav = document.createElement("nav");
    nav.className = "s-nav"; nav.id = "sNav"; nav.setAttribute("aria-label", "주요 메뉴");
    nav.innerHTML = [["home", "홈", "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"], ["map", "지도", "M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"], ["search", "검색", "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5"], ["fav", "찜", "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"], ["more", "더보기", "M4 6h16M4 12h16M4 18h16"]]
      .map(([k, t, d]) => `<button type="button" data-nav="${k}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg><span>${t}</span></button>`).join("");
    document.body.appendChild(nav);
    const fx = document.createElement("button");
    fx.type = "button"; fx.className = "s-fullx"; fx.id = "sFullX"; fx.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>목록 보기`;
    // 목록 머리(유형 칩)가 위에 붙는 한 줄 게이지에 가리지 않게 그 높이만큼 더 띄운다. 뒤로가기 스크롤 복원 뒤에도 한 번 더
    const toList = () => { const l = $("sListW"); if (l) window.scrollTo({ top: l.getBoundingClientRect().top + scrollY - HDR() - 8 - (matchMedia("(max-width:980px)").matches ? 66 : 0), behavior: "auto" }); };
    fx.onclick = () => { fullMap(false); requestAnimationFrame(toList); setTimeout(toList, 120); };
    document.body.appendChild(fx);
    nav.querySelector('[data-nav="home"]').setAttribute("aria-current", "page");
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("[data-nav]"); if (!b) return;
      const k = b.dataset.nav;
      nav.querySelectorAll("button").forEach((x) => x.removeAttribute("aria-current"));
      if (k !== "search" && k !== "more") b.setAttribute("aria-current", "page");
      if (k !== "map") fullMap(false);
      if (k === "home") { close(); if ($("report").classList.contains("sheet")) closeSheetNow(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (k === "map") { const v = history.state && history.state.sView; close(); if (v) setTimeout(() => fullMap(true), 120); else fullMap(true); }
      else if (k === "search") search();
      else if (k === "fav") open("favTop");
      else if (k === "more") setTimeout(() => $("menuBtn").click(), 0);
    });
    $("sSearch").onclick = search;
    // 각 기능 화면 위에 '지도로' 버튼
    IDS.forEach((id) => {
      const s = $(id); if (!s || s.querySelector(".s-back")) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "s-back"; b.innerHTML = "← 돌아가기";
      b.onclick = () => close(true);
      s.insertBefore(b, s.firstChild);
    });
    // 이벤트
    const sl = $("sCash");
    sl.addEventListener("input", () => { label(toCash(+sl.value)); live(toCash(+sl.value)); });
    sl.addEventListener("pointerdown", () => { dragging = true; });
    // 키보드: 2억 아래는 0.1억, 5억 아래는 0.25억, 그 위는 0.5억씩
    const key = (e) => {
      const c = +$("pCash").value || 1, st = c < 2 ? 0.1 : c < 5 ? 0.25 : 0.5;
      const nx = { ArrowRight: c + st, ArrowUp: c + st, ArrowLeft: c - st, ArrowDown: c - st, PageUp: c + 1, PageDown: c - 1, Home: 0.5, End: 15 }[e.key];
      if (nx == null) return;
      e.preventDefault();
      const v = Math.min(15, Math.max(0.5, Math.round(nx * 100) / 100));
      label(v); clearTimeout(idleT); setCash(v, true);
    };
    sl.addEventListener("keydown", key);
    $("sMiniR") && $("sMiniR").addEventListener("keydown", key);
    const up = () => { if (!dragging) return; dragging = false; clearTimeout(idleT); idleT = setTimeout(() => setCash(toCash(+sl.value), true), 30); };
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    sl.addEventListener("change", () => { clearTimeout(timer); clearTimeout(idleT); setCash(toCash(+sl.value), true); });
    map.querySelector(".s-mode").addEventListener("click", (e) => { const b = e.target.closest("button[data-f]"); if (!b) return; if (b.dataset.f === "cash") { P.basis = "now"; try { setSeg("pBasis", "now"); } catch (er) {} } setFund(b.dataset.f); setTimeout(() => { try { LMX.fitAff(true); } catch (er) {} }, 60); });
    list.querySelector(".s-flt").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      kind = b.dataset.k; shown = 6;
      $$(".s-flt button", list).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
      try { window.dispatchEvent(new CustomEvent("zp:filter", { detail: { kind } })); } catch (er) {}   // 지도(10_lmap.js)도 같은 유형만
    });
    $("sMore").onclick = () => { shown += 10; render(); };
    $("sSort").addEventListener("change", (e) => { sortK = e.target.value; shown = 6; try { localStorage.setItem("emr.sort", sortK); } catch (er) {} render(); });
    $("sAsm").onclick = (e) => asm(e.currentTarget);
    $("sList").addEventListener("click", (e) => {
      const w = e.target.closest("[data-why]"); if (w) { e.preventDefault(); e.stopPropagation(); why(w.dataset.why, w); return; }
      const a = e.target.closest("[data-id]"); if (!a) return;
      e.preventDefault(); curTab = "money"; keepY = scrollY; select(a.dataset.id, false, false, { scroll: !MQ_SHEET.matches });
    });
    tiles.addEventListener("click", (e) => { const a = e.target.closest("[data-view]"); if (!a) return; e.preventDefault(); open(a.dataset.view); });
  }
  // 상세 '입주 현금' 탭: 맨 위엔 지금·이주·입주 숫자만, 나머지(가정·근거·숫자 바꿔 보기)는 접어 둔다
  function foldMoney(r) {
    const p = $("pane"); if (!p || p.querySelector(".s-fold")) return;
    const g = p.querySelector(".gpane");
    const keep = g || p.querySelector(".bigrow") || p.firstElementChild;
    if (!keep) return;
    const d = document.createElement("details"); d.className = "s-fold";
    d.innerHTML = `<summary>계산 근거 · 숫자 바꿔 보기</summary>`;
    if (g) g.querySelectorAll(":scope > .t-note, :scope > .gap-honest, :scope > .gj-f").forEach((el) => d.appendChild(el));
    [...p.children].filter((el) => el !== keep && el !== d).forEach((el) => d.appendChild(el));
    keep.after(d);
    const x = investC(r);
    const tot = d.querySelector(".bigrow .big:first-child small");
    if (tot && x && x.loanEnd > 0.05) tot.insertAdjacentHTML("beforeend", ` · 분담금은 입주 때 잔금대출 ${eokS(x.loanEnd)}을 받는다고 보고 뺀 금액`);
  }
  function search() {
    const b = $("sOpen");
    const box = $("searchBox");
    if (b && box && getComputedStyle(box).display === "none") b.click();   // 폰: 헤더 검색 아이콘을 숨겨도 같은 전체 화면 검색을 연다
    else { window.scrollTo({ top: 0, behavior: "smooth" }); $("q").focus(); }
  }
  function label(v, real) {
    const t = real != null && real > 15 ? "15억+" : `${String(real != null ? Math.round(real * 100) / 100 : v).replace(/\.0$/, "")}억`;
    const m = t.match(/^([\d.]+)(억\+?)$/) || [, t, ""];
    $("sCashV").innerHTML = `${m[1]}<small>${m[2].replace("+", "")}${/\+/.test(t) ? "+" : ""}</small>`;
    const pct = toPos(v);
    if ($("sMiniV")) { $("sMiniV").textContent = t; if (!dragging || document.activeElement !== $("sMiniR")) $("sMiniR").value = pct; $("sMiniR").style.setProperty("--p", pct + "%"); }
    if (!dragging || document.activeElement !== $("sCash")) { if (Math.abs(+$("sCash").value - pct) > 0.6) $("sCash").value = pct; }
    $("sCash").style.setProperty("--p", pct + "%");
    $("sCash").setAttribute("aria-valuetext", t);
    if ($("sMiniR")) $("sMiniR").setAttribute("aria-valuetext", t);
  }
  // 끄는 동안에도 지도·숫자가 따라오게(계산은 약 30ms라 프레임마다 한 번까지만)
  // 끄는 동안: 무거운 전체 계산 대신 '필요한 돈 ≤ 현금' 판정만 다시 해 숫자·목록·구별 말풍선을 매 프레임 갱신.
  // 손을 떼거나 잠깐 멈추면 전체 계산(지도 색·구 통계)을 한 번 돌린다.
  let liveT = 0, liveV = null, idleT = 0, bubK = "", bubT = 0, dragging = false;
  function live(v) {
    liveV = Math.round(v * 10) / 10;
    if (!liveT) liveT = requestAnimationFrame(() => {
      liveT = 0;
      try {
        $("pCash").value = String(liveV); CASH = liveV;
        render();
        if (mapView === "seoul") {
          const o = {}; R.forEach((r) => { if (okR(r)) o[r.g] = (o[r.g] || 0) + 1; });
          const k = JSON.stringify(o), now = performance.now();
          if (k !== bubK && now - bubT > 90) { bubK = k; bubT = now; LMX.counts(o); }
        }
      } catch (e) {}
    });
    clearTimeout(idleT); if (!dragging) idleT = setTimeout(() => setCash(liveV, true), 220);
  }
  function setCash(v, force) {
    v = Math.round(v * 100) / 100;
    const el = $("pCash");
    if (+el.value === v && !force) return render();
    el.value = String(v);
    try { PREV_CASH = null; } catch (e) {}
    planN = PLAN0();
    plan();
    // 금액을 정하면 그 돈으로 되는 구역까지 지도가 따라 넓어진다
    try { LMX.fitAff(true); } catch (e) {}
  }
  // ---------- 목록 줄 보조: 최근 2년 실거래 흐름(작은 선) ----------
  // txs.json[id] = [["26Q2", 값], …] 최근 8분기(build.py가 tx.json에서 뽑은 경량본, ~100KB) — 처음 그린 뒤 한 번만 늦게 불러와 다시 그린다.
  // 큰 tx.json(1.8MB)은 구역 리포트·신고가 층을 열 때만 ZX.loadTx로 받는다.
  let TX = null, txAsk = false;
  const SP = new Map();
  const qIdx = (q) => { const m = /^(\d\d)Q([1-4])$/.exec(q || ""); return m ? +m[1] * 4 + +m[2] - 1 : null; };
  const Q_NOW = (() => { const d = new Date(); return (d.getFullYear() % 100) * 4 + Math.floor(d.getMonth() / 3); })();
  function spark(id) {
    if (!TX) return "";
    if (!fitSp.on) { fitSp.on = 1; addEventListener("resize", () => fitSp()); }
    if (SP.has(id)) return SP.get(id);
    let out = "";
    try {
      const q = TX[id] || [];
      const pts = q.map((e) => [qIdx(e[0]), +e[1]]).filter((p) => p[0] != null && isFinite(p[1]) && p[1] > 0).sort((a, b) => a[0] - b[0]);
      const last = pts.length ? pts[pts.length - 1][0] : null;
      const P8 = last != null && last >= Q_NOW - 4 ? pts.filter((p) => p[0] > last - 8) : [];
      if (P8.length >= 3) {
        const W = 44, H = 16, pad = 2, x0 = last - 7;
        const vs = P8.map((p) => p[1]), lo = Math.min(...vs), hi = Math.max(...vs), rg = hi - lo || 1;
        const xy = P8.map(([i, v]) => [((i - x0) / 7) * (W - pad * 2) + pad, H - pad - ((v - lo) / rg) * (H - pad * 2)].map((n) => Math.round(n * 10) / 10));
        const [ex, ey] = xy[xy.length - 1];
        let chg = null;
        if (P8.length >= 6) { const b = P8.filter((p) => p[0] <= last - 4).pop(); if (b) chg = (P8[P8.length - 1][1] / b[1] - 1) * 100; }
        const tr = chg != null && Math.abs(chg) >= 3 ? `<i class="${chg > 0 ? "up" : "dn"}">${chg > 0 ? "▲" : "▼"}${Math.round(Math.abs(chg))}%</i>` : "";
        out = `<span class="s-sp" title="최근 2년 실거래 흐름${tr ? ` · 1년 ${chg > 0 ? "+" : "−"}${Math.round(Math.abs(chg))}%` : ""}"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${xy.map((p) => p.join(",")).join(" ")}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${ex}" cy="${ey}" r="1.9" fill="currentColor"/></svg>${tr}</span>`;
      }
    } catch (e) { out = ""; }
    SP.set(id, out);
    return out;
  }
  function askTx() {
    if (txAsk) return;
    txAsk = true;
    const v = (D.dv && (D.dv.txs || D.dv.tx)) || D.asOf;
    const go = () => { try { fetch(`data/txs.json?v=${v}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && typeof d === "object" && Object.keys(d).length) { TX = d; SP.clear(); render(); } }).catch(() => {}); } catch (e) {} };
    (window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 2500 }) : (f) => setTimeout(f, 900))(go);
  }
  // ---------- '왜 이 금액?' 작은 설명(새 화면 없이) ----------
  let whyEl = null, whyFor = null;
  function whyClose() { if (!whyEl || whyEl.hidden) return; whyEl.hidden = true; const b = whyFor; whyFor = null; if (b && document.contains(b) && whyEl.contains(document.activeElement)) b.focus(); }
  function whyBox() {
    if (!whyEl) {
      whyEl = document.createElement("div"); whyEl.className = "s-why"; whyEl.id = "sWhy"; whyEl.hidden = true;
      whyEl.setAttribute("role", "dialog"); whyEl.setAttribute("aria-labelledby", "sWhyT");
      document.body.appendChild(whyEl);
      whyEl.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) whyClose(); else if (e.target.closest("[data-open]")) { const v = e.target.closest("[data-open]").dataset.open; whyClose(); open(v); } else if (e.target.closest("[data-go]")) { const z = e.target.closest("[data-go]").dataset.go; whyClose(); curTab = "money"; keepY = scrollY; select(z, false, false, { scroll: !MQ_SHEET.matches }); } });
      document.addEventListener("pointerdown", (e) => { if (whyEl && !whyEl.hidden && !whyEl.contains(e.target) && !e.target.closest("[data-why],#sAsm")) whyClose(); }, true);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") whyClose(); });
      window.addEventListener("resize", whyClose);
    }
    return whyEl;
  }
  function whyShow(btn, html) {
    whyBox().innerHTML = html;
    whyFor = btn; whyEl.hidden = false;
    const sheet = matchMedia("(max-width:640px)").matches;
    whyEl.classList.toggle("bs", sheet);
    if (sheet) { whyEl.style.left = whyEl.style.top = ""; }
    else {
      const b = btn.getBoundingClientRect(), w = whyEl.offsetWidth, h = whyEl.offsetHeight;
      let top = b.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, b.top - h - 6);
      whyEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.right - w)) + "px"; whyEl.style.top = top + "px";
    }
    const xb = whyEl.querySelector("[data-x]"); if (xb) xb.focus({ preventScroll: true });
  }
  // 대출 끼고: 어떤 가정으로 대출을 잡았는지(작은 칩 → 설명)
  function asmText() {
    const inc = num("pIncome");
    return `LTV ${Math.round(ltvBuy() * 100)}% · ${inc != null && inc > 0 ? "DSR 40%" : "가정"}`.replace(" · 가정", " 가정");
  }
  function asm(btn) {
    if (whyEl && !whyEl.hidden && whyFor === btn) return whyClose();
    const inc = num("pIncome"), rate = num("aRate") ?? 4.5;
    const li = (k, v) => `<li><span>${k}</span><b>${v}</b></li>`;
    whyShow(btn, `<div class="s-wh"><b id="sWhyT">대출 가정</b><span>지금 규제 기준 추정</span><button type="button" data-x aria-label="닫기">×</button></div><ul>${li("담보인정(LTV)", `${Math.round(ltvBuy() * 100)}%`)}${li("한도(집값 구간)", "15억↓ 6억 · 25억↓ 4억")}${li("DSR 40%", inc != null && inc > 0 ? `연소득 ${fmt(inc)}만원` : "소득 넣으면 적용")}${li("금리", `${rate}% (+3%p 스트레스)`)}</ul><p>${P.homes === 0 ? (P.first ? "무주택 생애최초 기준" : "무주택 기준") : P.homes === 1 ? "1주택 기준" : "다주택은 대출 없음으로 계산"} · 실제 한도는 은행 심사로 달라져요</p><button type="button" class="s-wgo" data-open="planner">소득·조건 바꾸기 →</button>`);
  }
  function why(id, btn) {
    const r = byId[id]; if (!r) return;
    if (whyEl && !whyEl.hidden && whyFor === btn) return whyClose();
    whyBox();
    const gap = gapMode(), x = investC(r), est = !!(OV[r.id] && OV[r.id].est);
    const wS = (v) => (v > 0 && v < 0.1 ? `${fmt(Math.round(v * 1e4))}만원` : eokS(v));
    const ln = (op, k, v, c) => `<li${c ? ` class="${c}"` : ""}><span>${op ? `<i>${op}</i>` : ""}${k}</span><b>${wS(v)}</b></li>`;
    let rowsH = "", tail = "";
    if (gap) {
      const g = gapOf(r);
      if (g.na) rowsH = `<li class="s-wna">매수가 자료가 아직 없어요</li>`;
      else {
        rowsH = ln("", `매수가${est ? " <small>(추정)</small>" : ""}`, x.price) + ln("−", `전세${g.userJ ? "" : ` <small>(${Math.round(g.jr)}%)</small>`}`, g.D) + ln("+", "세금", x.tax) + ln("=", "지금 필요한 돈", g.now, "s-wsum");
        if (g.total != null) tail = `입주까지 ${eokS(g.total)} · 이주비·분담금 포함`;
      }
    } else if (x.price == null) rowsH = `<li class="s-wna">매수가 자료가 아직 없어요</li>`;
    else {
      rowsH = ln("", `매수가${est ? " <small>(추정)</small>" : ""}`, x.price) + ln("−", "대출", x.loanCap || 0) + ln("+", "세금", x.tax) + ln("=", "지금 필요한 돈", x.needBuy, "s-wsum");
      if (x.ok && x.needTotal != null) tail = `입주까지 ${eokS(x.needTotal)} · 분담금·이자 포함`;
    }
    whyShow(btn, `<div class="s-wh"><b id="sWhyT">왜 이 금액?</b><span>${esc(shortName(r.n))}</span><button type="button" data-x aria-label="닫기">×</button></div><ul>${rowsH}</ul><p>${tail ? `${tail} · ` : ""}공개 자료로 낸 추정치예요</p><button type="button" class="s-wgo" data-go="${r.id}">계산 근거 자세히 →</button>`);
  }
  // ---------- 첫 방문 안내 한 번: 게이지를 끌어 보라고 ----------
  function coach() {
    try { if (localStorage.getItem("emr.coach1")) return; } catch (e) { return; }
    const g = document.querySelector(".s-gauge"), sl = $("sCash"); if (!g || !sl || g.querySelector(".s-coach")) return;
    const t = document.createElement("div"); t.className = "s-coach"; t.setAttribute("role", "status"); t.textContent = "끌어서 내 현금을 맞춰 보세요";
    // 손잡이 옆(트랙 높이)에 띄워 눈금·숫자를 가리지 않는다. 손잡이가 오른쪽 절반이면 왼쪽에
    const place = () => {
      const gr = g.getBoundingClientRect(), sr = sl.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
      const x = sr.left - gr.left + 12 + ((sr.width - 24) * (parseFloat(sl.style.getPropertyValue("--p")) || 8)) / 100;
      const right = x < gr.width / 2, L = right ? x + 22 : x - 22 - w;
      t.classList.toggle("l", !right);
      t.style.top = Math.round(sr.top - gr.top + sr.height / 2 - h / 2) + "px"; t.style.left = Math.round(Math.max(4, Math.min(gr.width - w - 4, L))) + "px";
    };
    g.appendChild(t); place(); addEventListener("resize", place);
    const ev = ["pointerdown", "keydown", "wheel", "touchstart"];
    const done = () => { t.remove(); removeEventListener("resize", place); ev.forEach((k) => removeEventListener(k, done, true)); [sl, $("sMiniR")].forEach((x) => x && x.removeEventListener("input", done)); try { localStorage.setItem("emr.coach1", "1"); } catch (e) {} };
    ev.forEach((k) => addEventListener(k, done, { capture: true, passive: true }));
    [sl, $("sMiniR")].forEach((x) => x && x.addEventListener("input", done));
  }
  // ---------- 목록 ----------
  function render() {
    if (!$("sList")) return;
    const gap = gapMode();
    const v = +$("pCash").value || 1;
    label(Math.min(15, Math.max(0.5, v)), v);
    $$(".s-mode button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.f === "gap") === gap)));
    gu = mapView === "gu" && mapGu && mapGu === listGu ? mapGu : "";   // 구역을 열며 자동으로 들어간 구는 목록을 거르지 않는다
    const L = rows();
    const all = R.filter(okR).length;
    $("sN").textContent = fmt(all);   // 굴러가는 숫자 대신 바로(목록 곳 수와 어긋나 보이지 않게)
    const ab = $("sAsm"); if (ab) { ab.hidden = gap; if (!gap) { const t = asmText(); ab.innerHTML = `${t}<i aria-hidden="true">?</i>`; ab.setAttribute("aria-label", `대출 가정: ${t} · 설명 보기`); } }
    try { if (!dragging) { const o = {}; R.forEach((r) => { if (okR(r)) o[r.g] = (o[r.g] || 0) + 1; }); LMX.counts(o); } } catch (e) {}
    if ($("sMiniN")) { $("sMiniN").textContent = fmt(kind ? R.filter((r) => okR(r) && KIND(r) === kind).length : all); $("sMiniM").textContent = kind ? ({ redev: "재개발", rebuild: "재건축", small: "가로·소규모" })[kind] : gap ? "전세 끼고" : "대출 끼고"; }
    // 전세 끼고는 전세 시세가 있는 구역만 셀 수 있어 금액을 올려도 상한이 있다 → 그 상한을 같이 보여 준다
    const cap = gap ? countAt(999) : 0;
    $("sNL").textContent = gap ? (cap ? `전세 시세 있는 ${fmt(cap)}곳 중` : "전세 끼고 살 수 있는 곳") : effBasis() === "total" ? "입주까지 되는 곳" : "대출 끼고 살 수 있는 곳";
    $("sLT").textContent = gu ? `${gu} · ${fmt(L.length)}곳` : `살 수 있는 곳 · ${fmt(L.length)}곳`;
    $("sLS").textContent = gap || effBasis() !== "total" ? "지금 필요한 돈 · 추정" : "입주까지 필요한 돈 · 추정";
    const sg = $("sGu");
    sg.hidden = !gu;
    if (gu) sg.innerHTML = `지도에서 고른 <b>${esc(gu)}</b>만 보고 있어요 <button type="button" class="btn text sm" id="sGuX">서울 전체</button>`;
    if (gu) $("sGuX").onclick = () => { exitGu({}); if (/^#map-/.test(location.hash)) try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} };
    $("sList").innerHTML = L.length
      ? L.slice(0, shown).map(({ r, n, early }) => `<li><a href="#${r.id}" data-id="${r.id}"><span class="s-nm"><b>${esc(shortName(r.n))}</b><small>${esc(r.g)} ${esc(dongOf(r))}${early ? ' · <em>초기 단계</em>' : ""}${r.nbp ? ' · <em class="s-tag nb">주변 시세 기준</em>' : ""}${r.tag === "lt" && !/장기전세/.test(shortName(r.n)) ? ' · <em class="s-tag">장기전세</em>' : r.tag === "mk" ? ' · <em class="s-tag">상가·시장</em>' : ""}</small></span>${spark(r.id)}</a><button type="button" class="s-amt" data-why="${r.id}" aria-label="${esc(shortName(r.n))} 필요한 돈 추정 ${eokS(gap || effBasis() !== "total" ? n.now : n.total)} · 왜 이 금액인지 보기" aria-haspopup="dialog"><b>${eokS(gap || effBasis() !== "total" ? n.now : n.total)}</b><small>${gap || effBasis() !== "total" ? (n.total != null ? `입주까지 ${eokS(n.total)}` : "입주까지 계산 전") : `계약 ${eokS(n.now)}`}</small></button></li>`).join("")
      : `<li class="s-empty">${gu ? `${esc(gu)}에는 이 금액으로 되는 곳이 없어요.` : "이 금액으로 되는 곳이 없어요."} 게이지를 올려 보세요.</li>`;
    const m = $("sMore");
    m.hidden = L.length <= shown;
    m.textContent = `더 보기 (${fmt(Math.max(0, L.length - shown))}곳)`;
    if (whyEl && !whyEl.hidden && whyFor && !document.contains(whyFor)) { const nb = $("sList").querySelector(`[data-why="${whyFor.dataset.why}"]`); if (nb) whyFor = nb; else whyClose(); }
    askTx();
    if (TX) fitSp();
  }
  // 좁은 화면: 흐름선 때문에 이름·동네가 잘리거나 줄이 바뀌면 그 줄만 흐름선을 뺀다
  let fitT = 0;
  function fitSp() {
    cancelAnimationFrame(fitT);
    fitT = requestAnimationFrame(() => $$("#sList li").forEach((li) => {
      const sp = li.querySelector(".s-sp"); if (!sp) return;
      li.classList.remove("s-nosp");
      const b = li.querySelector(".s-nm b"), sm = li.querySelector(".s-nm small");
      if ((b && b.scrollWidth > b.clientWidth + 1) || (sm && sm.getClientRects().length && sm.offsetHeight > parseFloat(getComputedStyle(sm).lineHeight || "0") * 1.5)) li.classList.add("s-nosp");
    }));
  }
  // ---------- 기능 화면 열기/닫기 ----------
  let cur = "";
  function open(id, noScroll) {
    if (!IDS.includes(id)) return false;
    IDS.forEach((x) => { const s = $(x); if (s) s.classList.toggle("s-on", x === id); });
    document.documentElement.classList.add("s-view");
    cur = id;
    navMark(id === "favTop" ? "fav" : "more");
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
    if (!document.documentElement.classList.contains("s-full")) navMark("home");
    if (history.state && history.state.sView) { try { history.back(); } catch (e) {} }
    else if (location.hash && IDS.includes(location.hash.slice(1))) try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {}
    if (scroll) requestAnimationFrame(() => { const t = $("sTiles"); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); });
  }
  function init() {
    // 같은 페이지에서 주소의 #도구 이름만 바뀌어도(링크·뒤로가기) 그 도구를 연다
    window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (IDS.includes(h) && cur !== h) { try { if ($("report").classList.contains("sheet")) closeSheetNow(); } catch (e) {} open(h); } });
    window.addEventListener("popstate", () => { const on = document.documentElement.classList.contains("s-full"), want = !!(history.state && history.state.sFull) || location.hash === "#map"; if (on && !want) fullMap(false); else if (!on && want && history.state && history.state.sFull) fullMap(true); });
    if (P.fund === "cash" && P.basis !== "now") { P.basis = "now"; try { setSeg("pBasis", "now"); } catch (e) {} }
    build();
    // 메뉴(⋯)는 shell.html에 도구·자료·사이트로 묶어 둔다
    try { SECT.mapTop(); } catch (e) {}
    try { LMX.seoul(); } catch (e) {}   // 첫 지도도 실제 지도(구역 경계·지하철)로
    if (location.hash === "#map") fullMap(true);   // /#map 링크 = 전체 지도로 바로
    // 기존 '바로가기'(메뉴·다음 단계·히어로 링크)는 해당 기능 화면을 연다
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("[data-menu],[data-jump2],[data-sec],a[href^='#']");
      if (!a || a.closest("#sTiles") || a.closest("#sList")) return;
      // 본문 바로가기: 열린 기능 화면을 닫고 첫 화면 본문(제목)으로 초점
      if (a.classList.contains("skip")) { e.preventDefault(); e.stopImmediatePropagation(); const wasOpen = !!cur; close(); const t = document.querySelector(".s-h1") || $("mapTop"); if (t) { if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1"); const f = () => t.focus({ preventScroll: true }); f(); setTimeout(() => { f(); window.scrollTo({ top: 0, behavior: "auto" }); }, wasOpen ? 120 : 0); } return; }
      const id = a.dataset.menu || a.dataset.jump2 || a.dataset.sec || (a.getAttribute("href") || "").slice(1);
      if (IDS.includes(id)) { e.preventDefault(); e.stopImmediatePropagation(); if (a.closest("#menuPop")) $("menuBtn").click(); open(id); }
      else if (id === "mapTop" || id === "planner0") { e.preventDefault(); close(); }
    }, true);
    const fromHash = () => { const h = location.hash.slice(1); if (IDS.includes(h)) open(h, false); else if (cur && !byId[h]) close(); };
    addEventListener("popstate", fromHash);
    fromHash();
    // 딥링크: 브라우저 앵커 이동이 끝난 뒤 다시 맞춘다
    const fix = () => { if (cur) { const el = $(cur); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); } };
    if (document.readyState === "complete") setTimeout(fix, 60); else addEventListener("load", () => setTimeout(fix, 60), { once: true });
    const _p = plan;
    plan = function () { const x = _p.apply(this, arguments); try { render(); } catch (e) {} return x; };
    const _eg = enterGu, _xg = exitGu;
    enterGu = function (n, o) { listGu = o && o.keepReport ? listGu : n; const x = _eg.apply(this, arguments); shown = 6; render(); return x; };
    exitGu = function () { listGu = ""; const x = _xg.apply(this, arguments); shown = 6; render(); return x; };
    // 상세 '입주 현금' 탭: 맨 위엔 지금·이주·입주 숫자만, 나머지(가정·근거·숫자 바꿔 보기)는 접어 둔다
    const _rp = renderPane;
    renderPane = function () {
      const x0 = _rp.apply(this, arguments);
      try { if (curTab === "money") foldMoney(cur); } catch (e) {}
      return x0;
    };
    // PC: 구역을 열면 오른쪽이 상세로, '목록' 버튼으로 다시 목록
    const _sel = select;
    select = function () { const x = _sel.apply(this, arguments); if (matchMedia("(min-width:981px)").matches) document.documentElement.classList.add("s-rep"); return x; };
    // 서울 전체 화면에서도 실제 지도를 다시 칠한다(구 숫자·구역 색)
    const _rm2 = refreshMap; refreshMap = function () { const x = _rm2.apply(this, arguments); try { if (mapView === "seoul") LMX.paint(); } catch (e) {} return x; };
    // 상세(시트)를 닫으면 보던 자리로
    const _cs = closeSheetNow;
    closeSheetNow = function () { const x = _cs.apply(this, arguments); if (keepY != null) { const y = keepY; keepY = null; requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" })); } return x; };
    // 구별 요약: 가능 0곳인 구는 숨김
    const zero = () => document.querySelectorAll(".gu-list li").forEach((li) => { const b = li.querySelector(".gl-a b"); li.classList.toggle("s-zero", !!b && b.textContent.trim() === "0"); });
    const _rm = refreshMap; refreshMap = function () { const x = _rm.apply(this, arguments); try { zero(); } catch (e) {} return x; };
    zero();
    // 지도 레이어 기본값: 아무것도 켜지 않음(잔글씨 방지). 사용자가 켠 적이 있으면 그대로
    try { if (localStorage.getItem("emr.lyr") == null) localStorage.setItem("emr.lyr", "[]"); } catch (e) {}
    try { const q = $("q"); if (q && matchMedia("(max-width:640px)").matches) q.placeholder = "구역·동·역 검색"; } catch (e) {}
    render();
    try { coach(); } catch (e) {}
    // 키보드: '/' 검색, Esc 열린 화면 닫기(입력 중·대화상자·메뉴가 열려 있으면 그쪽에 맡긴다)
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const H = document.documentElement;
      if (e.key === "/" && !typing) { e.preventDefault(); search(); return; }
      if (e.key !== "Escape" || typing || H.classList.contains("sheet-open") || H.classList.contains("menu-open") || document.querySelector("dialog[open]") || (whyEl && !whyEl.hidden)) return;
      if (H.classList.contains("s-full")) fullMap(false);
      else if (H.classList.contains("s-rep")) { H.classList.remove("s-rep"); const l = $("sList"); if (l) l.focus && l.querySelector("a") && l.querySelector("a").focus({ preventScroll: true }); }
      else if (cur) close(true);
    });
  }
  return { init, open, close, render, fullMap: (on) => fullMap(on) };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", SIMPLE.init) : setTimeout(SIMPLE.init, 0);
