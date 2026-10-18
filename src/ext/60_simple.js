/* ===================== 첫 화면 단순화(사용자 피드백) =====================
   메인 = 현금 게이지 + 서울 지도 + "지역 · 필요한 돈" 목록. 글자는 최소로.
   나머지 기능(계산기 세부 조건·출퇴근·순위·고시 등)은 아래 타일을 눌러 하나씩 연다.
   기존 섹션과 계산 엔진은 그대로 두고, 화면 구성만 바꾼다. */
const SIMPLE = (() => {
  // 도구 목록은 여기 한 곳만: 홈 '더 알아보기' 격자와 ⋯ 메뉴 '도구' 묶음을 둘 다 이것으로 만든다("적게, 완벽하게" — 6개)
  // [화면 id, 이름, 아이콘 경로, 아이콘 색, 한 줄 설명]
  const TOOLS_ALL = window.ZP_TOOLS = [
    ["rankHub", "순위", "M4 20h16M7 16V9M12 16V5M17 16v-4", "#1f3a87", "갭·실거래·입지"],
    ["planner", "입주 계산", "M4 4h16v16H4zM8 8h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h4", "#4f46e5", "입주까지 현금·모으면 언제"],
    ["news", "소식", "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4", "#0e7490", "단계 변경·입주 물량"],
    ["commuteTop", "출퇴근", "M7 3h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 10h14M8 20l2-4M16 20l-2-4", "#2f6feb", "회사까지 몇 분 안"],
    ["diagTop", "매물진단", "M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "#16a34a", "이 매물 입주권 나오나"],
    ["favTop", "관심 구역", "M12 22c-3.4-4.1-7.2-8.4-7.2-12.6a7.2 7.2 0 0 1 14.4 0c0 4.2-3.8 8.5-7.2 12.6zM12 12a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z", "#d97706", "핀 꽂은 구역 소식"],
  ];
  // 예전 도구 주소(#gapTop 등)는 합친 화면 + 그 탭으로 연다(정적 페이지·공유 링크가 그대로 동작) — [화면, 탭]
  const ALIAS = window.ZP_ALIAS = { gapTop: ["rankHub", "gap"], txrTop: ["rankHub", "txr"], rankTop: ["rankHub", "loc"], ntcTop: ["news", "feed"], newTop: ["news", "feed"], supplyTop: ["news", "supply"], saveTop: ["planner", "save"] };
  // 격자 = 도구 6개 전부(폰 3×2 · PC 한 줄/두 줄), 더보기 없음
  const VIEWS = TOOLS_ALL;
  // ⋯ 메뉴 '도구' 묶음: 전부(shell.html #mpTools는 비워 두고 여기서 채운다)
  { const g = document.getElementById("mpTools"); if (g) g.innerHTML = TOOLS_ALL.map(([id, t, d, c]) => `<a href="#${id}" data-menu="${id}"><i class="mp-ic" aria-hidden="true" style="--ic:${c}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></i><b>${t}</b></a>`).join(""); }
  // 아이콘 격자에는 안 넣지만 메뉴(⋯)·링크로 여는 화면
  const MORE = ["results", "rulesTop", "readsTop", "statsTop"];
  const LINKS = [];
  const IDS = VIEWS.map((v) => v[0]).concat(MORE);
  const known = (id) => IDS.includes(id) || !!ALIAS[id];
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
  const SORTS = [["fit", "맞춤순"], ["low", "적은 돈순"], ["move", `${LBL.cashToMoveIn} 적은 순`], ["gain", "입주 때 시세 차이 큰 순"], ["eta", "입주 빠른순"]];
  // 입주 때 시세 차이(현금 매수 계산 · 리포트 '입주 때 시세 차이'와 같은 값). 계산 못 하면 null → 맨 아래
  const gainOf = (r) => { try { const x = investC(r); return x && x.ok && x.gain != null && isFinite(x.gain) ? x.gain : null; } catch (e) { return null; } };
  let sortK = "fit";
  try { const s0 = localStorage.getItem("emr.sort"); if (SORTS.some((x) => x[0] === s0)) sortK = s0; } catch (e) {}
  // 처음 보이는 줄 수: PC는 옆 지도 높이(창 높이 − 79, 최대 902)를 채울 만큼(줄 75px · 제목·칩 두 줄·더보기 144px), 폰은 6줄
  const SHOW0 = () => { try { return matchMedia("(min-width:981px)").matches ? Math.max(6, Math.min(10, Math.floor((Math.min(innerHeight - 79, 902) - 144) / 75))) : 6; } catch (e) { return 6; } };
  // 지도 범위만: 전체 지도를 확대해 둔 채 '목록 보기'를 누르면 그 화면 안 구역만(칩 ✕로 해제). [서,남,동,북]
  // 줌 12.5 이상(구보다 확대)인 서울 지도면 '이 지도 범위만 보기' 칩을 띄우고(PC·폰 공통), 켜 두면 지도를 옮길 때마다 목록이 따라온다.
  // 12.5 아래로 빼면 저절로 풀린다. 켜 둔 동안은 금액을 바꿔도 지도가 자동으로 옮겨 가지 않는다(10_lmap.js fitAff가 ZP_bbOn을 봄)
  let bbF = null, bbCan = false;
  const bbGet = () => { try { const m = LMX.map(), dv = $("mapbox") && $("mapbox").dataset.view; if (m && LMX.on() && dv !== "gu" && mapView === "seoul" && m.getZoom() >= 12.5) {
    // PC 끼운 지도는 아래쪽이 창 밖일 수 있다 → 화면에 보이는 부분만(머리 아래 ~ 창 아래)
    const cv = m.getCanvas(), r = cv.getBoundingClientRect(), y0 = Math.max(0, (HDR() || 56) - r.top), y1 = Math.min(r.height, innerHeight - r.top);
    if (matchMedia("(min-width:981px)").matches && y1 - y0 > 120 && (y0 > 0 || y1 < r.height)) { const a = m.unproject([0, y0]), c = m.unproject([r.width, y1]); return [a.lng, c.lat, c.lng, a.lat]; }
    const b = m.getBounds(); return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]; } } catch (e) {} return null; };
  window.ZP_bbOn = () => !!bbF;
  const bbMove = () => { const b = bbGet(), was = bbCan; bbCan = !!b; if (bbF) { if (String(b) !== String(bbF)) { bbF = b; render(); } } else if (was !== bbCan) render(); };
  addEventListener("zp:mapmove", bbMove);
  // PC: 페이지를 내려 지도 칸이 머리 밑에 붙으면 보이는 부분이 바뀐다
  { let t = 0; addEventListener("scroll", () => { if (!bbF) return; clearTimeout(t); t = setTimeout(() => { if (matchMedia("(min-width:981px)").matches) bbMove(); }, 180); }, { passive: true }); }
  const inBB = (r) => !bbF || (r.ll && r.ll[1] >= bbF[0] && r.ll[1] <= bbF[2] && r.ll[0] >= bbF[1] && r.ll[0] <= bbF[3]);
  let listGu = "", gu = "", kind = "", shown = SHOW0(), timer = 0, keepY = null;
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  // 1억 아래는 소수 둘째 자리까지(9,515만 → 0.95억, '1억'으로 올려 보이지 않게)
  const eokS = ZF.cash;   // 1억 아래는 소수 둘째 자리까지(0.95억) — 지도·핀·리포트와 같은 ZF 꼴
  const dongOf = (r) => { const m = /^(?:서울(?:특별)?시\s*)?(?:[가-힣]+구\s+)?([가-힣]+?(?:\d+(?:·\d+)*)?(?:동\d+가|로\d+가|\d+가|동|로|가))(?=[\s\d(산]|$)/.exec(r.j || r.bj || ""); return m ? m[1] : r.dg || ""; };
  const KIND = (r) => (/재건축/.test(r.k) ? "rebuild" : /가로|소규모/.test(r.k) ? "small" : "redev");
  function needOf(r) {
    if (gapMode()) { const g = gapOf(r); return { now: g.now, total: g.total }; }
    const x = investC(r);
    return { now: x.needBuy, total: x.ok ? x.needTotal : null };
  }
  // '입주 빠른순'일 때 줄마다 예상 입주(계산용 추정) — 정렬 기준이 눈에 보이게
  const etaTag = (r) => { try { const t = etaShow(r); return /\d/.test(t) ? ` · <em class="s-tag eta">입주 ${esc(t)}</em>` : ` · <em>입주 ${esc(t)}</em>`; } catch (e) { return ""; } };
  const NA_WHY = "입주 시점·신축 시세 자료가 부족해요";
  const NA_L = "입주 비용 자료 부족";
  function rows() {
    const nowK = gapMode() || effBasis() !== "total";
    const etaT = (r) => { try { const p = projection(r); return p && p.eMid && !p.past ? +p.eMid : Infinity; } catch (e) { return Infinity; } };
    const L = R.filter((r) => okR(r) && !r.lc && (!gu || r.g === gu) && (!kind || KIND(r) === kind) && (gu || inBB(r)))
      .map((r) => { const n = needOf(r), m = (nowK ? n.now : n.total) ?? 99; return { r, n, m, early: r.s <= 1 || r.eta?.p10 == null, eta: sortK === "eta" ? etaT(r) : 0, gn: sortK === "gain" ? gainOf(r) : null }; });
    // '입주 계산 불가'(입주까지 금액 없음)는 어떤 정렬·유형 칩이든 맨 아래로
    return L.sort((a, b) => (a.n.total == null) - (b.n.total == null)
      || (sortK === "fit" ? Math.abs(CASH - a.m) - Math.abs(CASH - b.m)
        : sortK === "eta" ? (a.eta === b.eta ? 0 : a.eta < b.eta ? -1 : 1)
        : sortK === "move" ? (a.n.total ?? 99) - (b.n.total ?? 99)
        : sortK === "gain" ? (a.gn == null) - (b.gn == null) || (b.gn ?? 0) - (a.gn ?? 0)
        : Math.round(a.m * 10) - Math.round(b.m * 10))
      || a.m - b.m);
  }
  // 유형 칩으로 0곳일 때: 그 유형은 지금 방식으로 최소 얼마부터 되는지(목록과 같은 판정·금액)
  const KNAME = { redev: "재개발", rebuild: "재건축", small: "가로·소규모" };
  function kindEmpty() {
    const nowK = gapMode() || effBasis() !== "total", save = CASH;
    let lo = Infinity;
    try {
      CASH = 999;
      R.forEach((r) => { if ((kind && KIND(r) !== kind) || r.lc || (gu && r.g !== gu) || (!gu && !inBB(r)) || !okR(r)) return; const n = needOf(r), m = nowK ? n.now : n.total; if (m != null && isFinite(m) && m < lo) lo = m; });
    } catch (e) {} finally { CASH = save; }
    // 이름: 유형 > 구 > 지도 범위 순으로 무엇을 거르고 있는지
    const nm0 = kind ? `${gu ? `${esc(gu)} ` : ""}${KNAME[kind] || "이 유형"}` : gu ? esc(gu) : bbF ? "이 지도 범위" : "서울";
    const lc = nm0.charCodeAt(nm0.length - 1), nm = nm0 + (lc >= 0xac00 && lc <= 0xd7a3 && (lc - 0xac00) % 28 ? "은" : "는");
    const up = isFinite(lo) ? Math.max(0.1, Math.ceil(lo * 10) / 10) : null;
    const msg = up != null ? `${nm} 최소 <b>${eokS(lo)}</b>부터 살 수 있어요` : `${nm} ${gapMode() ? "전세 끼고" : "지금 방식으로"} 살 수 있는 곳이 없어요`;
    const wide = kind ? `<button type="button" class="btn secondary" id="sKindAll">전체 유형 보기</button>` : gu ? `<button type="button" class="btn secondary" id="sGuAll">서울 전체</button>` : bbF ? `<button type="button" class="btn secondary" id="sBbAll">서울 전체</button>` : "";
    return `${msg}<span class="s-eact">${up != null ? `<button type="button" class="btn primary" id="sKindUp" data-v="${up}">${eokS(up)}으로 올려 보기</button>` : ""}${wide}</span>`;
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
      <button type="button" class="s-search" id="sSearch"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>구역·동·지번·역 검색</button>
      <div class="s-gauge">
        <div class="s-ghead"><h1 class="s-h1">내 돈으로 살 수 있는 <em>서울 재개발</em></h1>
          <div class="s-mode" role="group" aria-label="사는 방식"><button type="button" data-f="gap">${LBL.gap}</button><button type="button" data-f="cash">${LBL.loan}</button></div><button type="button" class="s-asm" id="sAsm" hidden aria-haspopup="dialog"></button></div>
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
    // 넓은 PC: 게이지 오른쪽 칸 '이 돈이면'(가장 싼 3곳 · 입주까지 현금 범위). 폭이 좁으면 CSS로 숨김
    let sum = $("sSum"); if (!sum) { sum = document.createElement("div"); sum.className = "s-sum"; sum.id = "sSum"; g.appendChild(sum); }
    sum.addEventListener("click", (e) => { const a = e.target.closest("[data-id]"); if (!a) return; curTab = "money"; keepY = scrollY; select(a.dataset.id, false, false, { scroll: !MQ_SHEET.matches }); });
    if (g.parentNode === hero) { const sen = document.createElement("i"); hero.after(g); sen.className = "s-sen"; g.before(sen); }
    document.documentElement.style.setProperty("--hdr-h", (HDR() || 60) + "px");
    // 머리 높이가 바뀌면(화면 회전·검색 열기) 붙는 막대 위치도 같이
    try { new ResizeObserver(() => { const h = $("hdr").offsetHeight; if (h) { try { hdrH = h; } catch (e) {} document.documentElement.style.setProperty("--hdr-h", h + "px"); } }).observe($("hdr")); } catch (e) {}
    // 큰 게이지가 화면 위로 지나가면, 지도·목록을 보는 동안만 머리 아래에 한 줄짜리 게이지를 띄운다(흐름 높이는 그대로)
    // 랜드마크 밖에 떠 있는 막대라 aside로(화면 읽기 '영역' 목록에 '내 현금 요약')
    const mini = document.createElement("aside");
    mini.className = "s-mini"; mini.id = "sMini"; mini.hidden = true; mini.setAttribute("aria-label", "내 현금 요약");
    mini.innerHTML = `<b id="sMiniV">1억</b><input type="range" id="sMiniR" min="0" max="100" step="0.1" value="8.33" aria-label="가진 현금(억)"><span><i id="sMiniM">전세</i> <b id="sMiniN">0</b>곳</span><div class="s-mode s-mm" role="group" aria-label="사는 방식"><button type="button" data-f="gap">전세 끼고</button><button type="button" data-f="cash">대출 끼고</button></div>`;
    document.body.appendChild(mini);
    // 전체 지도 위 막대에서도 전세 끼고/대출 끼고 전환(본 버튼을 대신 누른다 → 상태·목록·지도 모두 같은 길)
    mini.querySelector(".s-mm").addEventListener("click", (e) => { const b = e.target.closest("button[data-f]"); if (!b) return; const o = map.querySelector(`.s-mode button[data-f="${b.dataset.f}"]`); if (o) o.click(); });
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
    const LSUB = { "guide/rebuild-30y": "30년 넘은 아파트 1,077단지", "report/": "매달 단계 변경 정리" };
    tiles.innerHTML = `<h2 id="sTT">더 알아보기</h2><div class="s-tg">${VIEWS.map(([id, t, d, c, sub]) => `<a href="#${id}" class="s-t" data-view="${id}">${ic(d, c)}<span class="s-tx"><b>${t}</b><small>${sub || ""}</small></span></a>`).join("")}${LINKS.map(([u, t, d, c]) => `<a href="${u}" class="s-t">${ic(d, c)}<span class="s-tx"><b>${t}</b><small>${LSUB[u] || ""}</small></span></a>`).join("")}</div>`;
    map.after(tiles);
    hero.insertBefore(hero.querySelector('#sSearch'), hero.firstChild);
    // 모바일 아래 탭바(앱처럼)
    // shell.html이 첫 페인트부터 같은 탭바를 깔아 둔다(섬 단계에서 자리가 비지 않게) → 있으면 그것을 이어 쓴다
    const nav = $("sNav") || document.createElement("nav");
    nav.className = "s-nav"; nav.id = "sNav"; nav.setAttribute("aria-label", "주요 메뉴");
    nav.innerHTML = [["home", "홈", "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"], ["map", "지도", "M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"], ["search", "검색", "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5"], ["fav", "관심 구역", "M12 22c-3.4-4.1-7.2-8.4-7.2-12.6a7.2 7.2 0 0 1 14.4 0c0 4.2-3.8 8.5-7.2 12.6zM12 12a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z"], ["more", "더보기", "M4 6h16M4 12h16M4 18h16"]]
      .map(([k, t, d]) => `<button type="button" data-nav="${k}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg><span>${t}</span></button>`).join("");
    if (!nav.isConnected) document.body.appendChild(nav);
    const fx = document.createElement("button");
    fx.type = "button"; fx.className = "s-fullx"; fx.id = "sFullX"; fx.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>목록 보기`;
    // 목록 머리(유형 칩)가 위에 붙는 한 줄 게이지에 가리지 않게 그 높이만큼 더 띄운다. 뒤로가기 스크롤 복원 뒤에도 한 번 더
    const toList = () => { const l = $("sListW"); if (l) window.scrollTo({ top: l.getBoundingClientRect().top + scrollY - HDR() - 8 - (matchMedia("(max-width:980px)").matches ? 66 : 0), behavior: "auto" }); };
    fx.onclick = () => {
      // 구 단위보다 확대해 둔 지도(줌 12.5 이상)면 목록도 그 화면 안 구역만. 서울 전체 줌이면 거르지 않는다
      bbF = bbGet();
      shown = SHOW0(); render();
      fullMap(false); requestAnimationFrame(toList); setTimeout(toList, 120); };
    document.body.appendChild(fx);
    nav.querySelector('[data-nav="home"]').setAttribute("aria-current", "page");
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("[data-nav]"); if (!b) return;
      const k = b.dataset.nav, wasFull = document.documentElement.classList.contains("s-full");
      nav.querySelectorAll("button").forEach((x) => x.removeAttribute("aria-current"));
      if (k !== "more") b.setAttribute("aria-current", "page");
      if (k !== "map") fullMap(false);
      // 전체 지도에서 '검색': 지도를 닫는 뒤로 가기(popstate)가 끝난 뒤에 검색을 연다 — 먼저 열면 popstate가 검색을 다시 닫았다(두 번 눌러야 했음)
      if (k === "search" && wasFull) { let done = false; const go = () => { if (done) return; done = true; removeEventListener("popstate", pop); search(); }; const pop = () => setTimeout(go, 30); addEventListener("popstate", pop); setTimeout(go, 450); return; }
      if (k === "home") { close(); if ($("report").classList.contains("sheet")) closeSheetNow(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (k === "map") { const v = history.state && history.state.sView; close(); if (v) setTimeout(() => fullMap(true), 120); else fullMap(true); }
      else if (k === "search") search();
      else if (k === "fav") open("favTop");
      else if (k === "more") setTimeout(() => $("menuBtn").click(), 0);
    });
    $("sSearch").onclick = search;
    // 아래 탭 '검색': 검색이 열려 있는 동안만 켜 두고, 닫히면 보던 화면(전체 지도·홈) 탭으로
    try { let was = false; new MutationObserver(() => { const on = $("hdr").classList.contains("searching"); if (on === was) return; was = on; if (on) navMark("search"); else if (nav.querySelector('[data-nav="search"][aria-current]')) navMark(document.documentElement.classList.contains("s-full") ? "map" : "home"); }).observe($("hdr"), { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
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
      kind = b.dataset.k; shown = SHOW0();
      $$(".s-flt button", list).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
      try { window.dispatchEvent(new CustomEvent("zp:filter", { detail: { kind } })); } catch (er) {}   // 지도(10_lmap.js)도 같은 유형만
    });
    $("sMore").onclick = () => { shown += 10; render(); };
    $("sSort").addEventListener("change", (e) => { sortK = e.target.value; shown = SHOW0(); try { localStorage.setItem("emr.sort", sortK); } catch (er) {} render(); });
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
        // 작은 선만 있으면 무엇인지 몰라('√'처럼 보임) 아래에 늘 이름표: '1년▲64%'(1년 바뀜) 또는 '시세'
        const tr = chg != null && Math.abs(chg) >= 3 ? `<i class="${chg > 0 ? "up" : "dn"}" aria-hidden="true">1년${chg > 0 ? "▲" : "▼"}${Math.round(Math.abs(chg))}%</i>` : `<i aria-hidden="true">시세</i>`;
        const lab = `최근 2년 시세 흐름${chg != null && Math.abs(chg) >= 3 ? ` · 1년 ${chg > 0 ? "+" : "−"}${Math.round(Math.abs(chg))}%` : ""}`;
        out = `<span class="s-sp" role="img" aria-label="${lab}" title="${lab}"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${xy.map((p) => p.join(",")).join(" ")}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${ex}" cy="${ey}" r="1.9" fill="currentColor"/></svg>${tr}</span>`;
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
  let whyEl = null, whyFor = null, whyScr = null;
  function whyClose() { if (!whyEl || whyEl.hidden) return; whyEl.hidden = true; whyEl.style.transform = ""; if (whyScr) whyScr.hidden = true; const b = whyFor; whyFor = null; if (b && document.contains(b) && whyEl.contains(document.activeElement)) b.focus(); }
  function whyBox() {
    if (!whyEl) {
      whyEl = document.createElement("div"); whyEl.className = "s-why"; whyEl.id = "sWhy"; whyEl.hidden = true;
      whyEl.setAttribute("role", "dialog"); whyEl.setAttribute("aria-labelledby", "sWhyT");
      // 폰 아래 시트: 뒤를 어둡게 덮는 막(누르면 닫힘) + 손잡이를 아래로 끌어 닫기
      whyScr = document.createElement("div"); whyScr.className = "s-why-scr"; whyScr.hidden = true; whyScr.setAttribute("aria-hidden", "true");
      document.body.appendChild(whyScr); document.body.appendChild(whyEl);
      let y0 = null, dy = 0;
      whyEl.addEventListener("pointerdown", (e) => { if (!whyEl.classList.contains("bs") || !e.target.closest(".s-wgrab,.s-wh") || e.target.closest("button")) return; y0 = e.clientY; dy = 0; try { whyEl.setPointerCapture(e.pointerId); } catch (er) {} });
      whyEl.addEventListener("pointermove", (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); whyEl.style.transform = dy ? `translateY(${dy}px)` : ""; });
      const end = () => { if (y0 == null) return; y0 = null; if (dy > 60) whyClose(); else whyEl.style.transform = ""; };
      whyEl.addEventListener("pointerup", end); whyEl.addEventListener("pointercancel", end);
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
    whyEl.classList.toggle("bs", sheet); whyScr.hidden = !sheet; whyEl.style.transform = "";
    if (sheet) { whyEl.style.left = whyEl.style.top = ""; whyEl.insertAdjacentHTML("afterbegin", '<div class="s-wgrab" aria-hidden="true"></div>'); }
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
    return ltvBuy() ? `감정가 ${Math.round(ltvBuy() * 100)}%${inc != null && inc > 0 ? " · DSR 40%" : " 대출 가정"}` : "대출 없음 가정";
  }
  function asm(btn) {
    if (whyEl && !whyEl.hidden && whyFor === btn) return whyClose();
    const inc = num("pIncome"), rate = num("aRate") ?? 4.5;
    const li = (k, v) => `<li><span>${k}</span><b>${v}</b></li>`;
    whyShow(btn, `<div class="s-wh"><b id="sWhyT">대출 가정</b><span>지금 규제 기준 추정</span><button type="button" data-x aria-label="닫기">×</button></div><ul>${li("담보인정(LTV)", `${Math.round(ltvBuy() * 100)}%`)}${li("담보 기준", "아파트 시세 · 빌라 감정가")}${li("한도(집값 구간)", "15억↓ 6억 · 25억↓ 4억")}${li("DSR 40%", inc != null && inc > 0 ? `연소득 ${fmt(inc)}만원` : "소득 넣으면 적용")}${li("금리", `${rate}% (+3%p 스트레스)`)}</ul><p>${P.homes === 0 ? (P.first ? "무주택 생애최초 기준" : "무주택 기준") : P.homes === 1 ? "1주택 기준" : "다주택은 대출 없음으로 계산"} · 실제 한도는 은행 심사로 달라져요</p><button type="button" class="s-wgo" data-open="planner">소득·조건 바꾸기 →</button>`);
  }
  // 대출이 무엇의 몇 %인지(계산 엔진 loanOn과 같은 순서: 담보 × LTV, 가격구간 한도, DSR 중 가장 작은 값)
  // 담보 = 아파트는 매수가, 빌라·주택은 감정가 추정 × 1.2(매수가 상한) — 그래서 매수가의 40%보다 적게 나올 수 있다
  function loanBasis(r, x, wS, M) {
    const lt = Math.round(ltvBuy() * 100);
    if (!x.loanCap) return x.land0 ? "멸실 뒤 토지 매수라 주담대 없음" : lt === 0 ? "규제지역 다주택은 LTV 0%" : "연소득 0이라 DSR상 대출 없음";
    const cx = ((r.mk || {}).entry || {}).src === "complex", coll = cx ? x.price : Math.min(x.price, x.appr * 1.2);
    const near = (a) => Math.abs(a - x.loanCap) < 0.005;
    if (near(coll * ltvBuy())) return coll < x.price - 0.005 ? `대출 = 감정가 추정 ${wS(M(x.appr))} × 1.2 × ${lt}% <small>· 빌라·주택은 매수가보다 낮은 감정가로 담보를 잡아요</small>` : `대출 = 매수가 × ${lt}%`;
    if (near(bandCap(x.price))) return `대출 = 집값 ${x.price <= 15 ? "15억 이하" : x.price <= 25 ? "25억 이하" : "25억 초과"} 한도 ${bandCap(x.price)}억`;
    return `대출 = 연소득 기준 DSR 40% 한도`;
  }
  function why(id, btn) {
    const r = byId[id]; if (!r) return;
    if (whyEl && !whyEl.hidden && whyFor === btn) return whyClose();
    whyBox();
    const gap = gapMode(), x = investC(r), est = !!(OV[r.id] && OV[r.id].est);
    // 만원 단위로 반올림해 세 줄을 보여 주고, 합계는 보이는 숫자 그대로 더해 눈으로 맞춰 볼 수 있게(1억 5,450만 − 8,740만 + 170만 = 6,880만)
    const M = (v) => Math.round((v || 0) * 1e4);
    const wS = (m) => { if (m <= 0) return "0원"; const e = Math.floor(m / 1e4), r = m % 1e4; return `${e ? `${fmt(e)}억` : ""}${e && r ? " " : ""}${r ? `${fmt(r)}만` : ""}`; };
    const ln = (op, k, m, c) => `<li${c ? ` class="${c}"` : ""}><span>${op ? `<i>${op}</i>` : ""}${k}</span><b>${wS(m)}</b></li>`;
    const sum3 = (a, b, c) => Math.max(0, M(a) - M(b) + M(c));
    let rowsH = "", tail = "";
    // 매수가 바로 밑에 표본 한 줄(어떤 거래 몇 건의 가운데 값인지)
    const en = (r.mk || {}).entry || {}, ps = x.priceSrc;
    const src = ps === "user" && !est ? "직접 넣은 값" : esc(ZF.smpTxt(r, x));   // 리포트·/z/와 같은 표본 한 문장
    const srcL = src ? `<li class="s-wbase">${src}</li>` : "";
    if (gap) {
      const g = gapOf(r);
      if (g.na) rowsH = `<li class="s-wna">매수가 자료가 아직 없어요</li>`;
      else {
        rowsH = ln("", `매수가${est ? " <small>(추정)</small>" : ""}`, M(x.price)) + srcL + ln("−", `전세${g.userJ ? "" : ` <small>(${Math.round(g.jr)}%)</small>`}`, M(g.D)) + ln("+", "세금", M(x.tax)) + ln("=", "지금 필요한 돈", sum3(x.price, g.D, x.tax), "s-wsum");
        if (g.total != null) tail = `${LBL.cashToMoveIn} ${eokS(g.total)} · 이주비·분담금 포함, 잔금대출 제외`;
        else tail = `${LBL.cashToMoveIn}은 계산 못 함: 입주 시점·신축 시세 자료 부족`;
      }
    } else if (x.price == null) rowsH = `<li class="s-wna">매수가 자료가 아직 없어요</li>`;
    else {
      rowsH = ln("", `매수가${est ? " <small>(추정)</small>" : ""}`, M(x.price)) + srcL + ln("−", "대출", M(x.loanCap)) + `<li class="s-wbase">${loanBasis(r, x, wS, M)}</li>` + ln("+", "세금", M(x.tax)) + ln("=", "지금 필요한 돈", sum3(x.price, x.loanCap, x.tax), "s-wsum");
      if (x.ok && x.needTotal != null) tail = `${LBL.cashToMoveIn} ${eokS(x.needTotal)} · 분담금·이자 포함, 잔금대출 제외`;
      else tail = `${LBL.cashToMoveIn}은 계산 못 함: 입주 시점·신축 시세 자료 부족`;
    }
    whyShow(btn, `<div class="s-wh"><b id="sWhyT">왜 이 금액?</b><span>${esc(shortName(r.n))}</span><button type="button" data-x aria-label="닫기">×</button></div><ul>${rowsH}</ul><p>${tail ? `${tail} · ` : ""}공개 자료로 낸 추정치예요</p><button type="button" class="s-wgo" data-go="${r.id}">계산 근거 자세히 →</button>`);
  }
  // ---------- 첫 방문 안내 한 번: 게이지를 끌어 보라고 ----------
  function coach() {
    try { if (localStorage.getItem("emr.coach1")) return; } catch (e) { return; }
    const g = document.querySelector(".s-gauge"), sl = $("sCash"); if (!g || !sl || g.querySelector(".s-coach")) return;
    // 앱이 붙기 전(섬)에 이미 게이지를 움직였으면(현금이 기본 1억이 아님) 안내는 필요 없다
    try { if (typeof CASH !== "undefined" && Math.abs(CASH - 1) > 1e-9) { localStorage.setItem("emr.coach1", "1"); return; } } catch (e) {}
    const t = document.createElement("div"); t.className = "s-coach"; t.setAttribute("role", "status"); t.textContent = "끌어서 내 현금을 맞춰 보세요";
    // 손잡이 옆(트랙 높이)에 띄워 눈금·숫자를 가리지 않는다. 손잡이가 오른쪽 절반이면 왼쪽에
    // 자리는 레이아웃이 끝난 뒤(rAF)에 잰다 — 도구 화면에서 돌아올 때처럼 막대가 아직 0폭이면 숨겨 두고 다음 크기 변화 때 다시
    const place = () => {
      const gr = g.getBoundingClientRect(), sr = sl.getBoundingClientRect();
      t.classList.toggle("off", !sr.width || !gr.width);
      if (!sr.width || !gr.width) return;
      const w = t.offsetWidth, h = t.offsetHeight;
      const x = sr.left - gr.left + 12 + ((sr.width - 24) * (parseFloat(sl.style.getPropertyValue("--p")) || 8)) / 100;
      const right = x < gr.width / 2, L = right ? x + 22 : x - 22 - w;
      t.classList.toggle("l", !right);
      t.style.top = Math.round(sr.top - gr.top + sr.height / 2 - h / 2) + "px"; t.style.left = Math.round(Math.max(4, Math.min(gr.width - w - 4, L))) + "px";
    };
    let pf = 0; const later = () => { cancelAnimationFrame(pf); pf = requestAnimationFrame(() => requestAnimationFrame(place)); };
    let ro = null; try { ro = new ResizeObserver(later); ro.observe(g); ro.observe(sl); } catch (e) {}
    g.appendChild(t); later(); addEventListener("resize", later); addEventListener("hashchange", later); addEventListener("popstate", later);
    const ev = ["pointerdown", "keydown", "wheel", "touchstart"];
    const done = () => { t.remove(); cancelAnimationFrame(pf); try { ro && ro.disconnect(); } catch (e) {} removeEventListener("resize", later); removeEventListener("hashchange", later); removeEventListener("popstate", later); ev.forEach((k) => removeEventListener(k, done, true)); [sl, $("sMiniR")].forEach((x) => x && x.removeEventListener("input", done)); try { localStorage.setItem("emr.coach1", "1"); } catch (e) {} };
    ev.forEach((k) => addEventListener(k, done, { capture: true, passive: true }));
    [sl, $("sMiniR")].forEach((x) => x && x.addEventListener("input", done));
  }
  // ---------- 목록 ----------
  let capC = ["", 0];
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
    // 한 줄 막대도 목록과 같은 거르기(구·지도 범위·유형)를 그대로: 숫자 = 목록 곳 수
    if ($("sMiniN")) {
      const area = gu || (bbF ? "지도 범위" : ""), kn = kind ? ({ redev: "재개발", rebuild: "재건축", small: area ? "가로" : "가로·소규모" })[kind] : "";
      $("sMiniN").textContent = fmt(area || kind ? L.length : all);
      $("sMiniM").textContent = area && kn ? `${bbF && !gu ? "범위" : area}·${kn}` : area || kn || (gap ? "전세 끼고" : "대출 끼고");
    }
    // 전세 끼고는 전세 시세가 있는 구역만 셀 수 있어 금액을 올려도 상한이 있다 → 그 상한을 같이 보여 준다
    // 대출 끼고도 분모를 같이(전세 끼고와 같은 꼴): 15억까지 올렸을 때 셀 수 있는 곳
    const capK = `${gap}|${effBasis()}`;
    if (!dragging || capK !== capC[0]) capC = [capK, countAt(999)];   // 금액과 무관 → 끄는 동안엔 다시 세지 않는다
    const cap = capC[1];
    $("sNL").textContent = gap ? (cap ? `전세 시세 있는 ${fmt(cap)}곳 중` : "전세 끼고 살 수 있는 곳") : cap ? `${effBasis() === "total" ? "입주까지 계산되는" : "매수가 계산되는"} ${fmt(cap)}곳 중` : effBasis() === "total" ? "입주까지 되는 곳" : "대출 끼고 살 수 있는 곳";
    $("sLT").textContent = gu ? `${gu} · ${fmt(L.length)}곳` : `살 수 있는 곳 · ${fmt(L.length)}곳`;
    $("sLS").textContent = gap || effBasis() !== "total" ? "지금 필요한 돈 · 추정" : "입주까지 필요한 돈 · 추정";
    const sg = $("sGu");
    sg.hidden = !gu && !bbF && !bbCan;
    if (!gu && bbF) { sg.innerHTML = `<button type="button" class="s-bbx" id="sBbX" aria-label="지도 범위만 보기 해제 · 지금 ${fmt(L.length)}곳">지도 범위만 · ${fmt(L.length)}곳<i aria-hidden="true">✕</i></button>`; $("sBbX").onclick = () => { bbF = null; render(); const f = $("sBbO") || $("sList").querySelector("[data-id]"); if (f) f.focus({ preventScroll: true }); }; }
    else if (!gu && bbCan) { sg.innerHTML = `<button type="button" class="s-bbx s-bbo" id="sBbO"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/></svg>이 지도 범위만 보기</button>`; $("sBbO").onclick = () => { bbF = bbGet(); shown = SHOW0(); render(); const x = $("sBbX"); if (x) x.focus({ preventScroll: true }); }; }
    if (gu) sg.innerHTML = `지도에서 고른 <b>${esc(gu)}</b>만 보고 있어요 <button type="button" class="btn text sm" id="sGuX">서울 전체</button>`;
    if (gu) $("sGuX").onclick = () => { exitGu({}); if (/^#map-/.test(location.hash)) try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} };
    $("sList").innerHTML = L.length
      ? L.slice(0, shown).map(({ r, n, early }) => `<li${TX && NOSP.get(r.id) ? ' class="s-nosp"' : ""}><a href="#${r.id}" data-id="${r.id}"><span class="s-nm"><b>${esc(shortName(r.n))}</b><small>${esc(r.g)} ${esc(dongOf(r))}${sortK === "eta" ? etaTag(r) : early ? ' · <em>초기 단계</em>' : ""}${r.nbp ? ' · <em class="s-tag nb">주변 시세 기준</em>' : ""}${r.tag === "lt" && !/장기전세/.test(shortName(r.n)) ? ' · <em class="s-tag">장기전세</em>' : r.tag === "mk" ? ' · <em class="s-tag">상가·시장</em>' : ""}</small></span>${spark(r.id)}</a><button type="button" class="s-amt" data-why="${r.id}" aria-label="${esc(shortName(r.n))} 필요한 돈 추정 ${eokS(gap || effBasis() !== "total" ? n.now : n.total)}${n.total == null ? ` · ${NA_L}: ${NA_WHY}` : ` · 입주까지 내 현금 ${eokS(n.total)}`} · 왜 이 금액인지 보기" aria-haspopup="dialog" title="${n.total == null ? `${NA_L} · ${NA_WHY}` : `${LBL.cashToMoveIn}: 분담금·이자 포함, 입주 잔금대출은 뺀 금액`}"><span class="s-av"><i class="s-al" aria-hidden="true">${gap || effBasis() !== "total" ? "지금" : "입주까지"}</i><b>${eokS(gap || effBasis() !== "total" ? n.now : n.total)}</b></span><small${n.total == null ? ' class="s-na"' : ""}>${gap || effBasis() !== "total" ? (n.total != null ? `${LBL.cashToMoveIn} ${eokS(n.total)}` : `${NA_L}<i class="s-nai" aria-hidden="true">i</i>`) : `계약 ${eokS(n.now)}`}</small></button></li>`).join("")
      : `<li class="s-empty">${kindEmpty()}</li>`;
    { const kx = $("sKindAll"); if (kx) kx.onclick = () => { const b = $$(".s-flt button", $("sListW")).find((x) => x.dataset.k === ""); if (b) b.click(); }; }
    { const gx = $("sGuAll"); if (gx) gx.onclick = () => { const x = $("sGuX"); if (x) x.click(); }; }
    { const bx = $("sBbAll"); if (bx) bx.onclick = () => { bbF = null; render(); }; }
    { const ku = $("sKindUp"); if (ku) ku.onclick = () => { setCash(+ku.dataset.v, true); const f = $("sList").querySelector("[data-id]"); if (f) f.focus({ preventScroll: true }); }; }
    sumR(L);
    const m = $("sMore");
    m.hidden = L.length <= shown;
    m.textContent = `더 보기 (${fmt(Math.max(0, L.length - shown))}곳)`;
    if (whyEl && !whyEl.hidden && whyFor && !document.contains(whyFor)) { const nb = $("sList").querySelector(`[data-why="${whyFor.dataset.why}"]`); if (nb) whyFor = nb; else whyClose(); }
    askTx();
    if (TX) fitSp();
  }
  // 게이지 '이 돈이면' 칸: 넓은 PC는 오른쪽 칸(3곳 · 입주까지 현금 범위), 좁은 화면은 숫자 밑 한 줄 칩(첫 목록 줄이 화면 아래로 밀려도 바로 열 수 있게)
  // 입주까지 계산되는 곳을 먼저(계산 불가 곳만 3개 뜨지 않게), 그 안에서 적은 돈순
  const MQ_SUM = matchMedia("(min-width:1180px)");
  function sumR(L) {
    const el = $("sSum"); if (!el) return;
    const ok = L.filter((o) => o.m < 99);
    const top = ok.slice().sort((a, b) => (a.n.total == null) - (b.n.total == null) || a.m - b.m).slice(0, 3);
    const skip = top.length && ok.some((o) => o.n.total == null && o.m < top[top.length - 1].m - 1e-9);
    const tt = L.map((o) => o.n.total).filter((v) => v != null && isFinite(v));
    const lo = tt.length ? Math.min(...tt) : null, hi = tt.length ? Math.max(...tt) : null;
    el.innerHTML = top.length
      ? `<p class="s-sum-h"><b>이 돈이면</b><span>${skip ? "입주 계산되는 곳 중 " : "가장 싼 "}${top.length}곳</span></p><ol>${top.map(({ r, m, n }) => `<li><button type="button" data-id="${r.id}" aria-label="${esc(shortName(r.n))} ${esc(r.g)} · 지금 ${eokS(m)}${n.total != null ? ` · 입주까지 현금 ${eokS(n.total)}` : ""} · 리포트 열기"><span>${esc(shortName(r.n))}<small>${esc(r.g)}</small></span><b>${eokS(m)}</b></button></li>`).join("")}</ol>${lo != null ? `<p class="s-sum-f"><span>입주까지 현금 <b>${lo === hi ? eokS(lo) : `${eokS(lo)}~${eokS(hi)}`}</b><small> · 잔금대출 제외</small></span></p>` : ""}`
      : `<p class="s-sum-h"><b>이 돈이면</b></p><p class="s-sum-e">아직 되는 곳이 없어요. <br>게이지를 올려 보세요.</p>`;
    // 넓은 PC에서 1~2곳뿐이면 남는 자리에 '조금 더 있으면 몇 곳'을 한 줄로(끄는 중엔 계산하지 않고, 멈춘 뒤 한 번)
    clearTimeout(sumT);
    if (MQ_SUM.matches && top.length < 3) sumT = setTimeout(() => { try { sumMore(); } catch (e) {} }, 350);
  }
  let sumT = 0, sumK = "";
  function sumMore() {
    const el = $("sSum"); if (!el || dragging || el.querySelector(".s-sum-x")) return;
    const k = `${CASH}|${gapMode()}|${effBasis()}|${kind}|${gu}`; if (k === sumK && el.dataset.x) { const a = el.querySelector("ol") || el.querySelector(".s-sum-e"); if (a) a.insertAdjacentHTML("afterend", el.dataset.x); bindX(); return; }
    let hit = null; const n0 = countAt(CASH);   // 곳 수는 첫 화면 큰 숫자와 같은 기준(ZP_count)
    for (const d of [0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5]) { const c = Math.round((CASH + d) * 10) / 10; if (c > 15) break; const n = countAt(c); if (n >= n0 + 2) { hit = [c, n]; break; } }
    const h = hit ? `<p class="s-sum-x"><button type="button" data-sumup="${hit[0]}" aria-label="내 현금 ${eokS(hit[0])}으로 올려 ${fmt(hit[1])}곳 보기"><span>${eokS(hit[0])}이면 ${fmt(hit[1])}곳 <small>지금보다 ${fmt(hit[1] - n0)}곳 더</small></span><b>보기 →</b></button></p>` : "";
    sumK = k; el.dataset.x = h;
    if (h) { put(h); bindX(); }
    function put(x) { const a = el.querySelector("ol") || el.querySelector(".s-sum-e"); if (a) a.insertAdjacentHTML("afterend", x); else el.insertAdjacentHTML("beforeend", x); }
    function bindX() { const b = el.querySelector("[data-sumup]"); if (b) b.onclick = () => setCash(+b.dataset.sumup, true); }
  }
  MQ_SUM.addEventListener("change", () => { try { render(); } catch (e) {} });
  // 좁은 화면: 흐름선 때문에 이름·동네가 잘리거나 줄이 바뀌면 그 줄만 흐름선을 뺀다
  // 판정은 목록 폭마다 한 번(같은 폭이면 다시 그려도 같은 결과). 목록이 숨어 있으면(도구 화면) 재지 않고 다음에
  let fitT = 0, fitW = 0;
  const NOSP = new Map();
  function fitSp() {
    cancelAnimationFrame(fitT);
    fitT = requestAnimationFrame(() => {
      const ol = $("sList"), w = ol ? ol.clientWidth : 0; if (!w) return;
      if (w !== fitW) { fitW = w; NOSP.clear(); }
      $$("#sList li").forEach((li) => {
        const sp = li.querySelector(".s-sp"), a = li.querySelector("[data-id]"); if (!sp || !a) return;
        const k = a.dataset.id;
        if (!NOSP.has(k)) {
          li.classList.remove("s-nosp");
          const b = li.querySelector(".s-nm b"), sm = li.querySelector(".s-nm small");
          NOSP.set(k, !!((b && b.scrollWidth > b.clientWidth + 1) || (sm && sm.getClientRects().length && sm.offsetHeight > parseFloat(getComputedStyle(sm).lineHeight || "0") * 1.5)));
        }
        li.classList.toggle("s-nosp", NOSP.get(k));
      });
    });
  }
  // ---------- 기능 화면 열기/닫기 ----------
  let cur = "", curT = "";
  function open(id, noScroll) {
    // 예전 주소(#txrTop 등) → 합친 화면 + 그 탭(66_tools.js ZP_HUB)
    const from = id, al = ALIAS[id];
    if (al) { id = al[0]; try { window.ZP_HUB && ZP_HUB.pick(al[0], al[1]); } catch (e) {} }
    if (!IDS.includes(id)) return false;
    if (!cur && !noScroll) tileY = scrollY;   // 홈 화면이 숨기 전에(숨으면 문서가 짧아져 scrollY가 줄어든다)
    IDS.forEach((x) => { const s = $(x); if (s) s.classList.toggle("s-on", x === id); });
    document.documentElement.classList.add("s-view");
    // 홈 제목(h1)이 숨는 동안은 이 도구의 제목을 1단계 제목으로(화면 읽기·axe page-has-heading-one)
    lvl(id);
    cur = id; curT = al && al[1] === "save" ? "saveTop" : id;
    navMark(id === "favTop" ? "fav" : "more");
    const f = SECT[id]; if (f) f();
    if (id === "results" || id === "planner") { planN = PLAN0(); plan(); }
    window.dispatchEvent(new Event("resize"));
    if (!noScroll) requestAnimationFrame(() => { const s = (al && al[1] === "save" && $("saveTop")) || $(id); if (s) window.scrollTo({ top: s.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); });
    try { const h = location.hash.slice(1); if (h !== id) { if (al && h === from) history.replaceState(history.state, "", "#" + id); else history.pushState({ sView: id }, "", "#" + id); } } catch (e) {}
    return true;
  }
  let tileY = null, h1El = null;
  function lvl(id) {
    if (h1El) { h1El.removeAttribute("aria-level"); h1El = null; }
    const s = id && $(id); if (!s) return;
    const h = s.querySelector("h1, h2"); if (h && h.tagName === "H2") { h.setAttribute("aria-level", "1"); h1El = h; }
  }
  function close(scroll) {
    IDS.forEach((x) => { const s = $(x); if (s) s.classList.remove("s-on"); });
    document.documentElement.classList.remove("s-view");
    lvl(null);
    const wasOpen = !!cur;
    cur = "";
    if (!document.documentElement.classList.contains("s-full")) navMark("home");
    let popB = false;
    if (history.state && history.state.sView) { try { history.back(); popB = true; } catch (e) {} }
    else if (location.hash && known(location.hash.slice(1))) try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {}
    // 돌아가기·뒤로: 도구를 열기 전 보던 자리(타일 격자 등)로. history.back()의 스크롤 복원이 늦게 덮어쓰므로 한 번 더
    const y0 = tileY; tileY = null;
    const back = () => { if (y0 != null) window.scrollTo({ top: y0, behavior: "auto" }); else if (scroll) { const t = $("sTiles"); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); } };
    if (wasOpen && scroll) {
      const go = () => { requestAnimationFrame(back); setTimeout(back, 80); setTimeout(back, 200); };
      go();
      // history.back()이면 브라우저가 popstate 때 예전 자리(홈이 숨은 뒤 줄어든 값)로 되돌리므로 그 뒤에 한 번 더
      if (popB) { addEventListener("popstate", go, { once: true }); setTimeout(() => removeEventListener("popstate", go), 8000); }
    }
    if (wasOpen) fitSp();
  }
  function init() {
    // 같은 페이지에서 주소의 #도구 이름만 바뀌어도(링크·뒤로가기) 그 도구를 연다
    window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (known(h) && cur !== h) { try { if ($("report").classList.contains("sheet")) closeSheetNow(); } catch (e) {} open(h); } });
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
      if (known(id)) { e.preventDefault(); e.stopImmediatePropagation(); if (a.closest("#menuPop")) $("menuBtn").click(); open(id); }
      else if (id === "mapTop" || id === "planner0") { e.preventDefault(); close(); }
    }, true);
    const fromHash = () => { const h = location.hash.slice(1); if (known(h)) open(h, false); else if (cur && !byId[h]) close("pop"); };
    addEventListener("popstate", fromHash);
    fromHash();
    // 딥링크: 브라우저 앵커 이동이 끝난 뒤 다시 맞춘다
    const fix = () => { if (cur) { const el = $(curT) || $(cur); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); } };
    if (document.readyState === "complete") setTimeout(fix, 60); else addEventListener("load", () => setTimeout(fix, 60), { once: true });
    // #saveTop(입주 계산 아래 칸)은 위 계산기 답이 늦게 채워지며 밀리므로 한 번 더(그 사이 사용자가 스크롤했으면 두지 않음)
    if (curT === "saveTop") { let touched = false; const t = () => (touched = true); ["pointerdown", "wheel", "touchstart", "keydown"].forEach((k) => addEventListener(k, t, { once: true, passive: true })); [400, 1000].forEach((ms) => setTimeout(() => { if (curT === "saveTop" && !touched) fix(); }, ms)); }
    const _p = plan;
    plan = function () { const x = _p.apply(this, arguments); try { render(); } catch (e) {} return x; };
    const _eg = enterGu, _xg = exitGu;
    enterGu = function (n, o) { listGu = o && o.keepReport ? listGu : n; const x = _eg.apply(this, arguments); shown = SHOW0(); render(); return x; };
    exitGu = function () { listGu = ""; const x = _xg.apply(this, arguments); shown = SHOW0(); render(); return x; };
    // 상세 '입주 현금' 탭: 맨 위엔 지금·이주·입주 숫자만, 나머지(가정·근거·숫자 바꿔 보기)는 접어 둔다
    const _rp = renderPane;
    renderPane = function () {
      const x0 = _rp.apply(this, arguments);
      try { if (curTab === "money") foldMoney(cur); } catch (e) {}
      return x0;
    };
    // PC: 구역을 열면 오른쪽이 상세로, '목록' 버튼으로 다시 목록
    const _sel = select;
    // PC 상세는 칸 안에서 따로 스크롤하지 않고 페이지와 함께 흐른다(지도는 옆에 붙어 따라옴) → 열 때 상세 머리가 머리 밑에 오게,
    // 닫을 때(Esc·목록 버튼) 열기 전 보던 자리로. 딥링크로 처음 열릴 때도 같은 규칙(아래 관찰자)
    const PCQ = () => matchMedia("(min-width:981px)").matches;
    let repY = null, selBusy = false, repId = null;
    const repTop = () => { const H = document.documentElement; if (!PCQ() || H.classList.contains("s-full")) return; const w = document.querySelector("#mapTop .main") || $("report"); if (!w) return; const t = Math.max(0, Math.round(w.getBoundingClientRect().top + scrollY - HDR() - 8)); if (Math.abs(scrollY - t) > 2) window.scrollTo({ top: t, behavior: "auto" }); };
    select = function () {
      const H = document.documentElement, pc = PCQ(), was = H.classList.contains("s-rep"), y0 = keepY != null ? keepY : scrollY;
      selBusy = true;
      let x; try { x = _sel.apply(this, arguments); } finally { selBusy = false; }
      // 같은 구역을 다시 고르는 늦은 호출(딥링크 첫 그리기·자료 도착)은 사람이 내려 본 자리를 되돌리지 않는다
      if (pc) { if (!was) repY = y0; keepY = null; H.classList.add("s-rep"); const id = cur && cur.id; if (!was || id !== repId) repTop(); repId = id; }
      return x;
    };
    {
      const H = document.documentElement; let on = H.classList.contains("s-rep");
      if (on && PCQ()) { repY = 0; repId = cur && cur.id; requestAnimationFrame(repTop); }
      try { new MutationObserver(() => {
        const v = H.classList.contains("s-rep"); if (v === on) return; on = v;
        if (!PCQ() || selBusy) return;
        if (v) { if (repY == null) repY = scrollY; repId = cur && cur.id; requestAnimationFrame(repTop); }
        else if ((repId = null), repY != null) { const y = repY; repY = null; requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" })); }
      }).observe(H, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    }
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
