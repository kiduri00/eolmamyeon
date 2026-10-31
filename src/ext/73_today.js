/* ===================== 사이클 5 D: 오늘 카드 · 소식 4칸 · '이번 주 새로 가능' 정의(붙임 코드 — 첫 묶음 무게를 늘리지 않게 최소만) =====================
   그리기·칸 바꾸기는 지연 묶음(src/lazy 73_today·74_news·75_sheet → /b/z*). 여기엔 묶음을 부르는 자리만.
   자료·문구·레이더 셈은 A 묶음(window.ZP_today · INBOX.today) — '이번 주 새로 가능' 칩은 60_simple isNew = ZP_today.isNew + 앱 판정(레이더 nw와 같은 셈). */
const TDAY = (() => {
  let NP = null;
  const js = (src, k) => new Promise((res, rej) => { if (window[k]) return res(window[k]); const s = document.createElement("script"); s.src = src; s.async = true; s.onload = () => (window[k] ? res(window[k]) : rej()); s.onerror = rej; document.head.appendChild(s); });
  // A 자료·문구 묶음(/b/n · window.ZP_today = INBOX.today) — today.json 주소는 changes.json과 같은 버전 규칙(서비스 워커 DATA 캐시)
  const nLoad = () => NP || (NP = js("__TODAY__", "ZP_today").then((Z) => { Z.url = `data/today.json?v=${D.upd || D.asOf || ""}-${(D.dv && D.dv.today) || ""}`; return Z; }).catch((e) => { NP = null; throw e; }));
  // D 화면 묶음(사이클 5 M 규칙: src/lazy → ZP_lazy.load): today = 오늘 카드 개인 줄·아침에 받기 · news = 소식 4칸 · sheet = 첫 방문 결과·알림 받을 준비·홈 화면 추가
  //   A 자료·문구 묶음과 today.json을 연 뒤에(오프라인·자료 없음이면 그 문구를 그린다)
  let YP = null;
  const lz = (n) => () => (YP = YP || nLoad().then((Z) => Promise.all([Z.load(Z.url).catch(() => null), ZP_lazy.load("today")])).then(([, M]) => M.init()).catch((e) => { YP = null; throw e; })).then((Y) => (n === "today" ? Y : ZP_lazy.load(n).then((M) => M.init())));
  const yLoad = lz("today"), zLoad = lz("news"), wLoad = lz("sheet");
  const ctx = () => ({ byId, esc, shortName, ZF, BRAND, cash: () => CASH, gap: () => gapMode(), zst: (r) => SIMPLE.zstate(r), inbox: INBOX, pins: PINS, ZL: typeof ZL !== "undefined" ? ZL : null, simple: SIMPLE, z: () => zLoad() });
  const run = (f, L) => (L || zLoad)().then((Y) => f(Y, ctx())).catch(() => {});
  function init() {
    const s = $("nwSeg");
    if (s) s.addEventListener("click", (e) => { const b = e.target.closest("[data-nseg]"); if (b) run((Y, c) => Y.seg(c, b.dataset.nseg, true)); });
    if (s) s.addEventListener("keydown", (e) => { if (/^(Arrow(Left|Right)|Home|End)$/.test(e.key)) { e.preventDefault(); run((Y, c) => Y.segKey(c, e)); } });
    addEventListener("zp:view", (e) => { if (e.detail === "news") run((Y, c) => Y.enter(c)); });
    // 빠른 메뉴 경공매·고시공고(예전 주소 #ntcTop 등): 고시·단계 기록이 있는 칸을 바로 보이게(묶음을 기다리지 않음 · 웹 '서울 오늘' · 앱 '내 소식') → 내용은 묶음이
    const al = (d) => { if (!/^(ntc|auc|new|supply)Top$/.test(d || "")) return; window.__zpAlias = ""; const n = $("news"), v = document.documentElement.classList.contains("is-tapp") ? "mine" : "today"; window.__zpNseg = v; if (n) { n.dataset.nseg = v; n.querySelectorAll("#nwSeg [role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.nseg === v))); } run((Y, c) => Y.alias(c, d)); };
    addEventListener("zp:alias", (e) => al(e.detail)); al(window.__zpAlias);
    const n = $("news"); if (n && n.classList.contains("s-on")) run((Y, c) => Y.enter(c));
    // 오늘 카드: 화면에 보이거나 쉴 때(최대 3초)·첫 손길에 개인 줄(사이클 5 M ZP_lazy.when)
    const card = $("tdCard");
    if (card) ZP_lazy.when("today", { el: card, idle: 3000, touch: true }).then(() => run((Y, c) => Y.home(c), yLoad)).catch(() => {});
    // 첫 방문 금액을 고른 뒤 결과 카드(섬에서 이미 골랐으면 붙은 뒤에)
    addEventListener("zp:onboarded", () => run((Y, c) => Y.onb(c), wLoad));
    try { if (sessionStorage.getItem("zp.onbR") === "1") run((Y, c) => Y.onb(c), wLoad); } catch (e) {}
  }
  return { init, nLoad, yLoad, wLoad, ctx };
})();
window.ZP_TODAY = TDAY;   // 점검(QA) · 설치 앱 처음 안내(src/tapp)가 '아침에 받기' 칸을 부를 때
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", TDAY.init) : setTimeout(TDAY.init, 0);
