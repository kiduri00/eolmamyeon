/* ===================== 사이클 5 D: 오늘 카드 · 소식 4칸 · '이번 주 새로 가능' 정의(붙임 코드 — 첫 묶음 무게를 늘리지 않게 최소만) =====================
   그리기·칸 바꾸기·레이더 묶음은 지연 묶음(src/todayd → /b/y.*.js). 여기엔 목록 칩·지도 '새로'가 같이 쓰는 정의와 묶음을 부르는 자리만.
   이번 주 새로 가능 = today.json rad의 7일 전 필요한 돈 > 내 돈 ≥ 지금 필요한 돈 · 원인이 있고(계산 방식 변경 cv 아님) · 앱 판정도 '갈 수 있음'(목록 칩 = 레이더 = 주간 = 지도 '새로'). */
const TDAY = (() => {
  let TJ = null, TP = null, YP = null;
  // 주소는 changes.json과 같은 버전 규칙(서비스 워커 DATA 캐시를 탐) · 오프라인이면 캐시된 판 → 기준일은 그 판의 asOf
  const load = () => (TJ ? Promise.resolve(TJ) : TP || (TP = fetch(`data/today.json?v=${D.upd || D.asOf || ""}-${(D.dv && D.dv.today) || ""}`).then((r) => (r.ok ? r.json() : null)).then((j) => (TJ = j && j.asOf ? j : null)).catch(() => (TP = null))));
  function isNew(id, need) {
    const R = TJ && TJ.rad && TJ.rad[gapMode() ? "g" : "c"], a = R && R[id];
    return !!(Array.isArray(a) && a[2] && a[2] !== "cv" && need != null && a[0] > CASH + 1e-9 && a[1] <= CASH + 1e-9 && need <= CASH + 1e-9);
  }
  const yLoad = () => YP || (YP = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "__TODAYD__"; s.async = true; s.onload = () => (window.ZPT ? res(window.ZPT) : rej()); s.onerror = () => { YP = null; rej(); }; document.head.appendChild(s); }));
  const ctx = () => ({ D, byId, esc, shortName, stageName, ZF, BRAND, CASH: () => CASH, cash: () => CASH, gap: () => gapMode(), zst: (r) => SIMPLE.zstate(r), inbox: INBOX, pins: PINS, today: API, $, ZL: typeof ZL !== "undefined" ? ZL : null, open: (id) => { curTab = "money"; select(id, true, false, { scroll: true }); }, simple: SIMPLE });
  const run = (f) => yLoad().then((Y) => f(Y, ctx())).catch(() => {});
  function init() {
    const s = $("nwSeg");
    if (s) s.addEventListener("click", (e) => { const b = e.target.closest("[data-nseg]"); if (b) run((Y, c) => Y.seg(c, b.dataset.nseg, true)); });
    if (s) s.addEventListener("keydown", (e) => { if (/^(Arrow(Left|Right)|Home|End)$/.test(e.key)) { e.preventDefault(); run((Y, c) => Y.segKey(c, e)); } });
    addEventListener("zp:view", (e) => { if (e.detail === "news") run((Y, c) => Y.enter(c)); });
    addEventListener("zp:alias", (e) => run((Y, c) => Y.alias(c, e.detail)));
    const n = $("news"); if (n && n.classList.contains("s-on")) run((Y, c) => Y.enter(c));
    // 오늘 카드: 화면에 보이거나 브라우저가 쉴 때(최대 3초) 개인 줄
    const card = $("tdCard");
    if (card) { let go = 0; const fire = () => { if (!go) { go = 1; run((Y, c) => Y.home(c)); } }; try { const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); fire(); } }); io.observe(card); } catch (e) {} (window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 3000 }) : (f) => setTimeout(f, 1500))(fire); }
    // 첫 방문 금액을 고른 뒤 결과 카드(섬에서 이미 골랐으면 붙은 뒤에)
    addEventListener("zp:onboarded", () => run((Y, c) => Y.onb(c)));
    try { if (sessionStorage.getItem("zp.onbR") === "1") run((Y, c) => Y.onb(c)); } catch (e) {}
  }
  const API = { init, load, isNew, data: () => TJ, yLoad, ctx };
  return API;
})();
window.ZP_TODAY = TDAY;   // 점검(QA) · 설치 앱 처음 안내(src/tapp)가 '아침에 받기' 칸을 부를 때
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", TDAY.init) : setTimeout(TDAY.init, 0);
