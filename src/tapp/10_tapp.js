/* ===================== 설치 앱 화면(html.is-tapp) =====================
   웹 묶음(a·c)과 따로 받는다: 첫 화면 머리 스크립트가 설치 앱(standalone·fullscreen·minimal-ui 또는 android-app:// 진입)일 때만 붙인다.
   - 첫 화면: 검색 · 아이콘 10개(있는 화면만) · 배너 3장(실제 글) · 내 돈 카드(그대로)
   - 아래 탭 5개(홈·지도·관심·소식·MY) · 탭은 늘 '홈 위 한 칸' → 뒤로 = 홈, 홈에서 뒤로 = 앱 닫힘
   - 소식: 전체 소식(data/changes.json 30일) / 관심 구역(예전 소식 그대로)
   - 처음 실행 안내 3장(내 돈 → 관심 구역 → 알림) · 한 번만 */
const H = document.documentElement;
const $ = (id) => document.getElementById(id);
const lsG = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const ssG = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssS = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
const RM = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const X = () => window.ZP_T0;
const S = () => window.ZP_simple;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmtN = (n) => Number(n || 0).toLocaleString("ko-KR");
const T = (f, d) => { try { return f(); } catch (e) { return d; } };

/* ---------- 1. 방문 기록: 모든 칸에 깊이(tD)를 적어 둔다 → 탭은 '홈(0) 위 한 칸', 홈 탭 = 처음 칸으로 ---------- */
const dep = () => (history.state && typeof history.state === "object" && history.state.tD) || 0;
function patchHistory() {
  if (history.__tD) return; history.__tD = 1;
  const P = history.pushState.bind(history), Rp = history.replaceState.bind(history);
  // tF: 지도 탭(화면 가득 지도) 안에서 쌓은 칸(구 화면·구역 시트·하위 시트) — 뒤로 와도 지도 탭으로(60_simple.js popstate가 읽음)
  const inMap = () => H.classList.contains("s-full");
  history.pushState = function (s, t, u) { const d = dep() + 1; if (s == null || typeof s === "object") { s = Object.assign({}, s || {}, { tD: d }); if (inMap() && !s.sFull) s.tF = 1; } return P(s, t, u); };
  history.replaceState = function (s, t, u) { const d = dep(), f = !!(history.state && history.state.tF) && inMap(); if ((d || f) && (s == null || typeof s === "object")) { s = Object.assign({}, s || {}); if (d) s.tD = d; if (f && !s.sFull) s.tF = 1; } return Rp(s, t, u); };
}
// 처음 칸(홈)으로 돌아간 뒤 cb — 열린 화면·시트·전체 지도는 각자의 뒤로 가기(popstate) 처리로 닫힌다
function toBase(cb) {
  const d = dep();
  if (d <= 0) { cb(); return; }
  let done = false;
  const fin = () => { if (done) return; done = true; removeEventListener("popstate", on); setTimeout(cb, 40); };
  const on = () => { if (dep() <= 0) fin(); };
  addEventListener("popstate", on);
  T(() => window.ZL && ZL.noskip());
  try { history.go(-d); } catch (e) { fin(); }
  setTimeout(fin, 900);
}

/* ---------- 2. 아래 탭 5개 ---------- */
const TAB_VIEW = { fav: "favTop", news: "news", my: "my" };
const VIEW_TAB = { favTop: "fav", news: "news", my: "my" };
let lastTab = "home", homeReset = false;
function curTab() {
  if (H.classList.contains("s-full")) return "map";
  if (H.classList.contains("s-view")) { const v = T(() => S().cur(), ""); return VIEW_TAB[v] || (lastTab === "map" ? "home" : lastTab); }
  return "home";
}
function navMark() {
  const k = curTab();
  document.querySelectorAll("#sNav [data-nav]").forEach((b) => {
    const on = b.dataset.nav === k;
    if (on && b.getAttribute("aria-current") !== "page") b.setAttribute("aria-current", "page");
    else if (!on && b.hasAttribute("aria-current")) b.removeAttribute("aria-current");
  });
}
// 아래 탭 그림: 외곽선(평소) + 채움(지금 탭) — 키트(tab-X · tab-X-on)가 있으면 키트
const NAVO = {
  home: TNAV.home, map: TNAV.map,
  fav: "M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.4 7.2 4.4c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z",
  news: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4zM10 20.5a2.2 2.2 0 0 0 4 0",
  my: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0",
};
const SV = (b) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"`;
const NAVF = {
  home: `<path d="${TNAV.home}" fill="currentColor"/>`,
  map: `<path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z" fill="currentColor"/><path d="M9 4.6v13.2M15 6.4v13.2" stroke="var(--t-pg)" stroke-width="1.6"/>`,
  fav: `<path d="${"M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.4 7.2 4.4c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z"}" fill="currentColor"/>`,
  news: `<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z" fill="currentColor"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>`,
  my: `<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0z" fill="currentColor"/>`,
};
const navIcon = (k) => {
  const o = tKit("tab-" + k) ? tIcon("", 24, "tn-o", "tab-" + k) : `${SV()} class="tn-o"><path d="${NAVO[k]}"/></svg>`;
  const f = tKit("tab-" + k + "-on") ? tIcon("", 24, "tn-f", "tab-" + k + "-on") : `${SV()} class="tn-f">${NAVF[k]}</svg>`;
  return `<span class="tn-i">${o}${f}</span>`;
};
// 웹 코드(60_simple.js build)가 #sNav를 늦게 다시 그리면(innerHTML) 지도 탭이 사라진다 → 플래그 대신 '지도 탭·그림이 있나'로 판단하고, 다시 그려지면 곧바로 또 만든다
const navDone = (nav) => !!(nav && nav.querySelector('[data-nav="map"]') && nav.querySelectorAll("[data-nav] .tn-i").length >= 5 && nav.querySelector('[data-nav="news"] .t-bn'));
function navBuild() {
  const nav = $("sNav"); if (!nav) return;
  if (!nav.__tmo) {
    nav.__tmo = 1;
    // 웹 코드가 aria-current를 다시 붙여도(navMark) 앱 탭 기준으로 고친다 · 탭바가 다시 그려지면(자식이 바뀌면) 5탭을 다시 만든다
    try { new MutationObserver(navMark).observe(nav, { subtree: true, attributes: true, attributeFilter: ["aria-current"] }); } catch (e) {}
    try { new MutationObserver(() => { if (!navDone(nav)) navBuild(); }).observe(nav, { childList: true }); } catch (e) {}
  }
  if (navDone(nav)) return;
  nav.dataset.t5 = "1";
  const hb = nav.querySelector('[data-nav="home"]');
  if (hb) { hb.innerHTML = "<span>홈</span>"; }
  if (!nav.querySelector('[data-nav="map"]')) {
    const mb = document.createElement("button");
    mb.type = "button"; mb.dataset.nav = "map"; mb.innerHTML = "<span>지도</span>";
    if (hb) hb.after(mb); else nav.prepend(mb);
  }
  // 그림만 바꾼다(이름·배지·aria는 그대로)
  nav.querySelectorAll("[data-nav]").forEach((b) => { const k = b.dataset.nav; if (!NAVO[k]) return; const old = b.querySelector(":scope > svg"); if (old) old.remove(); if (!b.querySelector(".tn-i")) b.insertAdjacentHTML("afterbegin", navIcon(k)); });
  const nb = nav.querySelector('[data-nav="news"]');
  [nb, $("hdrBell")].forEach((x) => { if (x && !x.querySelector(".t-bn")) { const i = document.createElement("b"); i.className = "t-bn"; i.hidden = true; i.setAttribute("aria-hidden", "true"); x.appendChild(i); } });
  navMark();
  if (CH) badge();
  if (!H.__tmo) { H.__tmo = 1; try { new MutationObserver(() => { navMark(); const n = $("sNav"); if (n && !navDone(n)) navBuild(); }).observe(H, { attributes: true, attributeFilter: ["class"] }); } catch (e) {} }
}
function goTab(k) {
  const now = curTab();
  if (k === now && k !== "home") { window.scrollTo({ top: 0, behavior: "auto" }); return; }
  if (k !== "map" && k !== "home") lastTab = k;
  toBase(() => {
    lastTab = k === "map" ? lastTab : k;
    if (k === "home") {
      // 로고와 같은 '처음으로'(열린 것 모두 닫고 맨 위) — 40_home.js ZP_home을 로고 누르기로 부른다
      const lg = document.querySelector("#hdr a.logo");
      if (lg) { homeReset = true; try { lg.click(); } finally { homeReset = false; } } else window.scrollTo({ top: 0, behavior: "auto" });
      lastTab = "home";
    } else if (k === "map") {
      T(() => S().fullMap(true));
    } else {
      T(() => S().open(TAB_VIEW[k]));
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    navMark();
  });
}
function bindClicks() {
  // 창(window) 캡처: 웹 코드(문서 캡처)보다 먼저 받아 탭·종·로고·지도 타일을 앱 방식(기록 한 칸)으로
  window.addEventListener("click", (e) => {
    if (!e.target || !e.target.closest || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    const nb = e.target.closest("#sNav [data-nav]");
    const wide = T(() => matchMedia("(min-width:981px)").matches, false);
    if (nb && !wide) { e.preventDefault(); e.stopImmediatePropagation(); goTab(nb.dataset.nav); return; }
    if (wide) return;
    if (e.target.closest("#hdrBell")) { e.preventDefault(); e.stopImmediatePropagation(); goTab("news"); return; }
    if (!homeReset && e.target.closest("#hdr a.logo")) { e.preventDefault(); e.stopImmediatePropagation(); goTab("home"); return; }
    const tm = e.target.closest("[data-tmap]");
    if (tm) { e.preventDefault(); e.stopImmediatePropagation(); goTab("map"); return; }
    const ta = e.target.closest("[data-talert]");
    if (ta) {
      e.preventDefault(); e.stopImmediatePropagation();
      goTab("my");
      setTimeout(() => { const g = $("myG2"); if (g) window.scrollTo({ top: g.getBoundingClientRect().top + scrollY - ((($("hdr") || {}).offsetHeight) || 56) - 8, behavior: "auto" }); }, 400);
    }
  }, true);
  addEventListener("zp:view", (e) => { const t = VIEW_TAB[e.detail]; if (t) lastTab = t; navMark(); });
  addEventListener("popstate", () => setTimeout(navMark, 50));
}

/* ---------- 3. 첫 화면: 검색 · 아이콘 10개 · 배너 ---------- */
// 아이콘 = 지금 있는 화면만(MY > 도구·가이드와 같은 곳) · [아이콘, 이름, 주소, 화면 id(앱 안) | null(페이지)]
function tiles() {
  const rp = document.querySelector('#readsTop .rd-card h3 a[href^="report/"]');
  const rpHref = (rp && rp.getAttribute("href")) || "report/";
  return [
    ["map", "지도", "#map", "map"],
    ["rank", "순위", "#rankHub", "rankHub"],
    ["calc", "입주 계산", "#planner", "planner"],
    ["save", "모으면 언제", "#saveTop", "saveTop"],
    ["commute", "출퇴근", "#commuteTop", "commuteTop"],
    ["diag", "매물진단", "#diagTop", "diagTop"],
    ["rules", "매수 전 규정", "#rulesTop", "rulesTop"],
    ["stats", "통계", "#statsTop", "statsTop"],
    ["report", "월간 리포트", rpHref, null],
    ["years", "몇 년 걸리나", "years", null],
  ];
}
function banners() {
  const a = document.querySelector('#readsTop .rd-card h3 a[href^="report/"]'), k = a && a.closest(".rd-card") && a.closest(".rd-card").querySelector(".rd-k");
  const full = (a && a.textContent.trim()) || "", m = /^(.*?)(?:\([^)]*\))?\s*:\s*(.+)$/.exec(full);
  const no = k && /(\d+)호/.exec(k.textContent), mo = /^(\d{1,2})월/.exec(full);
  const on = T(() => X().inbox().st().on, false);
  return [
    // 제목 = 리포트 제목 뒷부분 그대로(숫자 포함 · 예: 조합설립인가 3곳, 전세 끼고 3억 안쪽 80곳)
    { k: `${mo ? `${mo[1]}월 리포트` : "월간 리포트"}${no ? ` · ${no[1]}호` : ""}`, h: m ? m[2].trim() : full || "매달 단계가 바뀐 구역을 원문과 대조해 정리해요", s: m ? m[1].trim() : "", href: (a && a.getAttribute("href")) || "report/", ic: "report" },
    // 숫자는 가이드 본문 그대로(관리지역 131곳 · 글 기준 2026.09.26) — qa_consistency tapp.home이 페이지 글과 대조
    { k: "가이드 · 모아타운", h: "서울 모아타운 관리지역 131곳, 진행 단계 한눈에", s: "서울 모아타운 현황과 진행 단계", href: "guide/moatown", ic: "guide" },
    on ? { k: "알림 · 켜져 있어요", h: "알림 종류는 MY에서 골라요", s: "관심 구역 알림 설정", href: "#my", ic: "bell", alert: 1 }
       : { k: "알림", h: "관심 구역 새 소식, 폰 알림으로 받기", s: "새 실거래·단계·경매 소식", href: "#my", ic: "bell", alert: 1 },
  ];
}
let carT = 0, carPause = false, carTouch = 0, carIdx = 0;
function homeBuild() {
  const map = $("mapTop"); if (!map || $("tHome")) return;
  const sen = map.querySelector(":scope > .s-sen") || $("sGauge");
  const sec = document.createElement("section");
  sec.className = "th"; sec.id = "tHome"; sec.setAttribute("aria-label", "바로가기");
  const B = banners();
  sec.innerHTML =
    `<nav class="th-grid" aria-label="도구 바로가기">${tiles().map(([ic, t, href, id]) => `<a class="th-t" href="${esc(href)}"${id === "map" ? " data-tmap" : id ? ` data-menu="${id}"` : ""} data-tile="${ic}"><span class="th-ic">${tIcon(ic, 42, "", "grid-" + ic)}</span><span class="th-l">${esc(t)}</span></a>`).join("")}</nav>` +
    `<div class="th-car" role="region" aria-roledescription="carousel" aria-label="알림판"><div class="th-track" id="tCarT">${B.map((b, i) => `<a class="th-b b${i + 1}" href="${esc(b.href)}"${b.alert ? " data-talert" : ""} role="group" aria-roledescription="slide" aria-label="${i + 1} / ${B.length}: ${esc(b.k)} · ${esc(b.h)}${b.s ? ` (${esc(b.s)})` : ""}"><span class="th-bt"><span class="th-bk">${esc(b.k)}</span><span class="th-bh">${esc(b.h).split(", ").map((x) => `<i>${x}</i>`).join(",<br>")}</span></span><span class="th-bi">${tIcon(b.ic, 96, "", ["banner-report", "banner-guide", "banner-alert"][i])}</span></a>`).join("")}</div>` +
    `<div class="th-bar"><span class="th-cnt" id="tCarN" aria-hidden="true">1 / ${B.length}</span><button type="button" class="th-pz" id="tCarP" aria-label="배너 자동 넘김 멈추기" aria-pressed="false"><i>${RM() ? PLAY : PAUSE}</i></button></div></div>`;
  sen.before(sec);
  // 검색 칸 글: 이름·동·지번·역(지금 검색이 찾는 그대로)
  const sb = $("sSearch");
  if (sb) { const tn = [...sb.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()); if (tn) tn.textContent = "구역 이름·동·지번·역으로 검색"; sb.setAttribute("aria-label", "구역 이름·동·지번·역으로 검색"); }
  carBind();
}
const PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2" width="2.4" height="8" rx="1" fill="currentColor"/><rect x="7.1" y="2" width="2.4" height="8" rx="1" fill="currentColor"/></svg>';
const PLAY = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 2.2v7.6L10 6z" fill="currentColor"/></svg>';
function carBind() {
  const tr = $("tCarT"), n = $("tCarN"), pz = $("tCarP"); if (!tr) return;
  const N = tr.children.length;
  const idx = () => Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth));
  let raf = 0;
  tr.addEventListener("scroll", () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const i = Math.min(N - 1, Math.max(0, idx())); if (i !== carIdx) { carIdx = i; n.textContent = `${i + 1} / ${N}`; } }); }, { passive: true });
  ["pointerdown", "touchstart", "focusin", "wheel"].forEach((t) => tr.addEventListener(t, () => { carTouch = Date.now(); }, { passive: true }));
  if (RM()) carPause = true;
  const sync = () => { pz.setAttribute("aria-pressed", String(carPause)); pz.setAttribute("aria-label", carPause ? "배너 자동 넘김 다시 켜기" : "배너 자동 넘김 멈추기"); pz.firstElementChild.innerHTML = carPause ? PLAY : PAUSE; };
  sync();
  pz.addEventListener("click", () => { carPause = !carPause; sync(); });
  let vis = true;
  try { new IntersectionObserver((es) => es.forEach((x) => { vis = x.isIntersecting; }), { threshold: 0.6 }).observe(tr); } catch (e) {}
  clearInterval(carT);
  carT = setInterval(() => {
    if (carPause || !vis || document.hidden || H.classList.contains("s-view") || H.classList.contains("s-full") || H.classList.contains("tob-on") || Date.now() - carTouch < 8000) return;
    if (tr.contains(document.activeElement)) return;
    const i = (idx() + 1) % N;
    tr.scrollTo({ left: i * tr.clientWidth, behavior: RM() ? "auto" : "smooth" });
  }, 5000);
}

/* ---------- 4. 전체 소식(data/changes.json · 최근 30일) ---------- */
const FT = [
  ["", "전체"],
  ["trade", "실거래·신고가"],
  ["auction", "경공매"],
  ["notice", "고시·공고"],
  ["stage", "단계"],
  ["price", "필요한 돈"],
];
const TAG = { trade: ["실거래", "tr"], auction: ["경매", "au"], notice: ["고시·공고", "nt"], stage: ["단계", "st"], price: ["필요한 돈", "pr"] };
const FK = "zp.tfeed";
let CH = null, fType = "", fShown = 50, fSeen0 = null, fSeenT = 0;
const dayAdd = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const today = () => new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
function fSeen() {
  let s = null; try { s = JSON.parse(lsG(FK) || "null"); } catch (e) {}
  if (!s || typeof s.at !== "string" || !Array.isArray(s.k)) {
    // 처음: 가장 최근 날의 소식만 '새 소식'(30일치가 한꺼번에 새 것으로 뜨지 않게)
    const top = CH && CH.items.length ? CH.items.reduce((m, e) => (e.date > m ? e.date : m), "") : today();
    const at = dayAdd(top, -1);
    s = { at, k: CH ? CH.items.filter((e) => e.date === at).map((e) => e.k) : [] }; lsS(FK, JSON.stringify(s));
  }
  return s;
}
const isNew = (e, s) => e.date > s.at || (e.date === s.at && !s.k.includes(e.k));
const muted = (t) => T(() => X().inbox().isOff(t), false);
function newCount(type) {
  if (!CH) return 0;
  const s = fSeen();
  return CH.items.filter((e) => (!type || e.type === type) && TAG[e.type] && isNew(e, s) && !muted(e.type)).length;
}
function feedLoad() {
  if (CH) return Promise.resolve(CH);
  const ib = T(() => X().inbox(), null);
  const p = ib ? ib.load() : fetch("data/changes.json").then((r) => r.json());
  return p.then((j) => { CH = j && Array.isArray(j.items) ? j : { items: [] }; return CH; }).catch(() => null);
}
function badge() {
  const n = newCount("");
  const t = n > 99 ? "99+" : String(n);
  // 종·소식 탭 = 'N'(새 소식 있음 · 수는 화면 읽기와 소식 종류 칩에) — 하루 수십 건이라 큰 숫자 대신
  document.querySelectorAll(".t-bn").forEach((b) => { b.hidden = !n; b.textContent = "N"; });
  const bell = $("hdrBell"); if (bell) bell.setAttribute("aria-label", n ? `소식, 새 소식 ${t}건` : "소식");
  const nb = document.querySelector('#sNav [data-nav="news"]'); if (nb) nb.setAttribute("aria-label", n ? `소식, 새 소식 ${t}건` : "소식");
  const sn = $("tSegN"); if (sn) { sn.hidden = !n; sn.textContent = t; }
}
function dLabel(d) {
  const t = today(), x = new Date(d + "T00:00:00Z"), md = `${x.getUTCMonth() + 1}.${x.getUTCDate()} (${"일월화수목금토"[x.getUTCDay()]})`;
  return d === t ? `오늘 · ${md}` : d === dayAdd(t, -1) ? `어제 · ${md}` : md;
}
function feedRows() {
  // 같은 구역·같은 날·같은 글은 한 줄(건수는 그대로 셈)
  const L = [], m = new Map();
  CH.items.filter((e) => TAG[e.type] && (!fType || e.type === fType)).forEach((e) => {
    const k = `${e.id}|${e.date}|${e.type}|${e.text}`;
    if (m.has(k)) { m.get(k).n++; m.get(k).ks.push(e.k); return; }
    const r = { e, n: 1, ks: [e.k] }; m.set(k, r); L.push(r);
  });
  // 날짜 최신순 · 같은 날은 단계 → 고시·공고 → 경매 → 신고가 → 실거래 → 필요한 돈
  const pr = (e) => ({ stage: 0, notice: 1, auction: 2, trade: e.hi ? 3 : 4, price: 5 })[e.type];
  return L.sort((a, b) => (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : pr(a.e) - pr(b.e)));
}
function feedHTML() {
  if (!CH) return `<p class="tf-empty">소식을 불러오는 중이에요…</p>`;
  const s = fSeen0 || fSeen(), cnt = (t) => CH.items.filter((e) => TAG[e.type] && (!t || e.type === t)).length;
  const nw = (t) => CH.items.filter((e) => TAG[e.type] && (!t || e.type === t) && isNew(e, s) && !muted(e.type)).length;
  const chips = FT.map(([t, l]) => { const n = nw(t); return `<button type="button" data-ft="${t}" aria-pressed="${t === fType}"${n ? ` aria-label="${l} ${fmtN(cnt(t))}건, 새 소식 ${n}건"` : ""}>${l} <small>${fmtN(cnt(t))}</small>${n && t ? `<i class="tf-n" aria-hidden="true">${n > 99 ? "99+" : n}</i>` : ""}</button>`; }).join("");
  const R = feedRows(), sh = R.slice(0, fShown);
  const asOf = (CH.asOf || "").replace(/^(\d{4})-(\d\d)-(\d\d)$/, (_, y, mo, d) => `${+mo}.${d}`);
  const by = new Map(); sh.forEach((r) => { if (!by.has(r.e.date)) by.set(r.e.date, []); by.get(r.e.date).push(r); });
  const X0 = X();
  const row = ({ e, n }) => {
    const r = T(() => X0.byId(e.id), null), nm = r ? T(() => (window.ZP_labName ? ZP_labName(r) : X0.name(r.n)), e.n) : e.n;
    const [tl, tc] = e.type === "trade" && e.hi ? ["신고가", "hi"] : TAG[e.type];
    const isN = isNew(e, s) && !muted(e.type);
    const fs = "feed-" + e.type, ic = tKit(fs) ? `<span class="tf-ic">${tIcon("", 28, "", fs)}</span>` : "";
    const inner = `${ic}<span class="tf-tx"><b>${esc(nm)}</b><small>${esc(e.type === "price" ? e.text.replace(/^필요한 돈\s*/, "") : e.text)}${n > 1 ? ` · 같은 소식 ${n}건` : ""}</small><span class="tf-meta"><span class="tf-tg ${tc}">${tl}</span><span class="tf-g">${esc(e.g || "")}</span></span></span>${isN ? '<i class="tf-dot" aria-hidden="true"></i>' : ""}`;
    return `<li>${r ? `<button type="button" class="tf-it" data-open="${esc(e.id)}"${isN ? ' aria-describedby="tfNewL"' : ""}>${inner}</button>` : `<a class="tf-it" href="z/${encodeURIComponent(e.id)}">${inner}</a>`}</li>`;
  };
  const list = sh.length ? `<ol class="tf-list">${[...by].map(([d, rs]) => `<li><h3 class="tf-dh">${dLabel(d)}</h3><ul class="tf-dl">${rs.map(row).join("")}</ul></li>`).join("")}</ol>` : `<p class="tf-empty">${tKit("empty-feed") ? tIcon("", 160, "", "empty-feed") : ""}최근 ${CH.days || 30}일 동안 이 종류 소식이 없어요</p>`;
  const more = R.length > sh.length ? `<button type="button" class="tf-more" data-fmore>더 보기 (${fmtN(R.length - sh.length)}줄)</button>` : "";
  return `<div class="tf-chips" role="group" aria-label="소식 종류">${chips}</div>` +
    `<p class="tf-sum">최근 ${CH.days || 30}일 <b>${fmtN(cnt(fType))}건</b>${nw(fType) ? ` · 새 소식 <b>${fmtN(nw(fType))}건</b>` : ""}${asOf ? ` · ${asOf} 기준` : ""}</p><span class="sr-only" id="tfNewL">새 소식</span>` +
    list + more + `<p class="tf-foot">서울시 정비사업 정보몽땅·실거래가 공개 자료·법원 경매 공고에서 매일 아침 모아요. 줄을 누르면 그 구역이 열려요.</p>`;
}
function feedRender() { const el = $("tFeed"); if (el) el.innerHTML = feedHTML(); }
function feedMarkSeen() {
  if (!CH) return;
  const at = CH.items.reduce((m, e) => (e.date > m ? e.date : m), fSeen().at);
  lsS(FK, JSON.stringify({ at, k: CH.items.filter((e) => e.date === at).map((e) => e.k) }));
  T(() => { window.NEWB && NEWB.seen("auc"); NEWB.seen("ntc"); });
  badge();
}
const newsOn = () => { const s = $("news"); return !!(s && s.classList.contains("s-on")); };
function segSet(v, user) {
  const n = $("news"); if (!n) return;
  n.dataset.tseg = v; if (user) ssS("zp.tseg", v);
  n.querySelectorAll(".tf-seg [role=tab]").forEach((b) => { const on = b.dataset.seg === v; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  if (v === "all") {
    fSeen0 = fSeen0 || (CH ? fSeen() : null);
    feedRender();
    clearTimeout(fSeenT); fSeenT = setTimeout(() => { if (newsOn() && n.dataset.tseg === "all") feedMarkSeen(); }, 1500);
  }
}
function feedBuild() {
  const n = $("news"); if (!n || $("tFeed")) return;
  const h = n.querySelector(":scope > .sec-h");
  const seg = document.createElement("div");
  seg.className = "tf-seg"; seg.setAttribute("role", "tablist"); seg.setAttribute("aria-label", "소식 보기");
  seg.innerHTML = `<button type="button" role="tab" id="tSegA" data-seg="all" aria-controls="tFeed" aria-selected="true">전체 소식 <i class="tf-n" id="tSegN" aria-hidden="true" hidden></i></button><button type="button" role="tab" id="tSegM" data-seg="mine" aria-selected="false" tabindex="-1">관심 구역</button>`;
  const p = document.createElement("div");
  p.id = "tFeed"; p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", "tSegA");
  (h || n.firstElementChild).after(seg); seg.after(p);
  seg.addEventListener("click", (e) => { const b = e.target.closest("[data-seg]"); if (b) segSet(b.dataset.seg, true); });
  seg.addEventListener("keydown", (e) => { if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; const v = n.dataset.tseg === "all" ? "mine" : "all"; segSet(v, true); seg.querySelector(`[data-seg="${v}"]`).focus(); e.preventDefault(); });
  p.addEventListener("click", (e) => {
    const c = e.target.closest("[data-ft]");
    if (c) { fType = c.dataset.ft; fShown = 50; feedRender(); const nc = $("tFeed").querySelector(`[data-ft="${fType}"]`); if (nc) nc.focus({ preventScroll: true }); return; }
    if (e.target.closest("[data-fmore]")) { fShown += 100; feedRender(); }
  });
  n.dataset.tseg = "all";
  addEventListener("zp:view", (e) => {
    if (e.detail !== "news") return;
    fSeen0 = null;
    // 관심 구역에 새 소식이 있으면 그쪽부터(빨간 숫자를 누르고 들어온 사람) · 아니면 이번에 고른 쪽 · 처음엔 전체 소식
    const mine = T(() => X().inbox().count(), 0);
    feedLoad().then(() => { fSeen0 = fSeen(); segSet(mine > 0 ? "mine" : ssG("zp.tseg") || "all"); });
    segSet(mine > 0 ? "mine" : ssG("zp.tseg") || "all");
  });
}

/* ---------- 5. 처음 실행 안내(3장 · 한 번) ---------- */
const OK = "zp.tonb";
const CASHES = [[0.5, "5,000만"], [1, "1억"], [2, "2억"], [3, "3억"], [5, "5억"], [7, "7억"], [10, "10억"], [15, "15억"]];
let ob = null, obStep = 0, obCash = null;
function onbNeed() { return lsG(OK) !== "1" && !(location.hash.length > 1); }
function onbClose(done, pop) {
  if (!ob) return;
  // 단추로 닫으면 안내가 쌓은 기록 한 칸을 되돌린다(빈 칸을 남기면 홈에서 뒤로가 한 번 헛돈다)
  if (!pop && history.state && history.state.zl === "tonb") { try { history.back(); } catch (e) {} }
  lsS(OK, "1"); lsS("zp.onb", "1");
  ob.remove(); ob = null;
  H.classList.remove("tob-on");
  document.querySelectorAll("body > [data-tinert]").forEach((x) => { x.inert = false; x.removeAttribute("data-tinert"); });
  if (done) { const f = $("sCashBtn") || document.querySelector(".th-t"); T(() => f && f.focus({ preventScroll: true })); }
  window.scrollTo({ top: 0, behavior: "auto" });
}
function onbHTML() {
  const X0 = X(), dots = `<span class="tob-dots" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i === obStep ? "on" : ""}"></i>`).join("")}</span>`;
  const top = `<div class="tob-top">${dots}<span class="sr-only">${obStep + 1} / 3</span><button type="button" class="tob-skip" data-oskip>건너뛰기</button></div>`;
  let body = "", foot = "";
  if (obStep === 0) {
    const c = obCash != null ? obCash : T(() => X0.cash(), 1), n = T(() => window.ZP_count(c), null);
    body = `<span class="tob-art${tKit("onb-1") ? " k" : ""}">${tIcon("calc", 68, "", "onb-1")}</span><p class="tob-k">1 / 3 · 내 돈</p><h2 id="tobT" tabindex="-1">지금 쓸 수 있는 현금을 골라 주세요</h2><p class="tob-p">그 돈으로 갈 수 있는 서울 재개발·재건축 구역만 골라 보여 드려요. 언제든 바꿀 수 있어요.</p>` +
      `<div class="tob-cash" role="group" aria-label="내 돈">${CASHES.map(([v, l]) => `<button type="button" data-oc="${v}" aria-pressed="${Math.abs(v - c) < 1e-9}">${l}</button>`).join("")}</div>` +
      (n != null ? `<p class="tob-res" aria-live="polite">${esc(T(() => X0.ZF().cash(c), c + "억"))}이면 갈 수 있는 곳 <b>${fmtN(n)}곳</b></p>` : "");
    foot = `<button type="button" class="tob-go" data-onext>다음</button>`;
  } else if (obStep === 1) {
    const ids = T(() => S().list().slice(0, 5), []);
    body = `<span class="tob-art${tKit("onb-2") ? " k" : ""}">${tIcon("heart", 68, "", "onb-2")}</span><p class="tob-k">2 / 3 · 관심 구역</p><h2 id="tobT" tabindex="-1">관심 구역을 담아 두세요</h2><p class="tob-p">담아 두면 새 실거래·단계·경매 소식을 소식 탭에 모아 드려요. 내 돈으로 갈 수 있는 곳 가운데 내 돈에 가까운 순이에요.</p>` +
      (ids.length ? `<ul class="tob-zl">${ids.map((id) => { const r = X0.byId(id); if (!r) return ""; const on = T(() => X0.pins().has(id), false); return `<li><span class="tob-zt"><b>${esc(T(() => (window.ZP_labName ? ZP_labName(r) : X0.name(r.n)), r.n))}</b><small>${esc(r.g || "")} · ${esc(T(() => X0.stage(r), ""))}</small></span><button type="button" data-fav="${esc(id)}" aria-pressed="${on}">${on ? "담았어요" : "담기"}</button></li>`; }).join("")}</ul>` : `<p class="tob-ok">이 돈으로 갈 수 있는 곳이 아직 없어요. 지도에서 구역을 눌러 ♡로 담을 수 있어요.</p>`) +
      `<p class="tob-note">지도·목록에서 구역을 열고 ♡를 눌러도 담겨요.</p>`;
    foot = `<button type="button" class="tob-go" data-onext>다음</button>`;
  } else {
    const st = T(() => X0.inbox().st(), null), can = st && st.can && st.perm !== "denied";
    body = `<span class="tob-art${tKit("onb-3") ? " k" : ""}">${tIcon("bell", 68, "", "onb-3")}</span><p class="tob-k">3 / 3 · 알림</p><h2 id="tobT" tabindex="-1">새 소식을 알림으로 받을까요?</h2><p class="tob-p">관심 구역에 새 실거래·단계·경매 소식이 생기면 매일 아침 한 번 알려 드려요. 종류는 MY › 알림 설정에서 골라요.</p>` +
      (st && st.on ? `<p class="tob-ok" role="status">알림이 켜져 있어요</p>` : can ? `<p class="tob-ok" id="tobMsg" role="status" hidden></p>` : `<p class="tob-ok" role="status">${st && st.perm === "denied" ? "알림이 막혀 있어요 · 폰 설정 → 애플리케이션 → 집핀 → 알림에서 허용할 수 있어요" : "지금은 이 기기에서 폰 알림을 켤 수 없어요 · 새 소식은 소식 탭에 모아 드려요"}</p>`);
    foot = (can && !(st && st.on) ? `<button type="button" class="tob-go" data-oalert>알림 켜기</button><button type="button" class="tob-sub" data-odone>나중에</button>` : `<button type="button" class="tob-go" data-odone>시작하기</button>`);
  }
  return `${top}<div class="tob-body">${body}</div><div class="tob-foot">${foot}</div>`;
}
function onbPaint(focus) {
  if (!ob) return;
  ob.innerHTML = onbHTML();
  if (focus) { const h = $("tobT"); if (h) h.focus({ preventScroll: true }); }
}
function onbOpen() {
  if (ob || !onbNeed()) return;
  ob = document.createElement("div");
  ob.className = "tob"; ob.id = "tOnb"; ob.setAttribute("role", "dialog"); ob.setAttribute("aria-modal", "true"); ob.setAttribute("aria-labelledby", "tobT");
  document.body.appendChild(ob);
  document.querySelectorAll("body > *").forEach((x) => { if (x !== ob && !x.inert && !/^(SCRIPT|STYLE|LINK)$/.test(x.tagName)) { x.inert = true; x.setAttribute("data-tinert", ""); } });
  H.classList.add("tob-on");
  obStep = 0; obCash = null;
  onbPaint(true);
  // 뒤로 가기 = 안내 닫기(건너뛰기와 같음 · 다시 안 뜸)
  T(() => window.ZL && ZL.open("tonb", () => onbClose(false, true)));
  // 꽂기·빼기는 앱 공통 길([data-fav] 문서 캡처)이 맡는다 → 그 뒤 이 줄 단추 글만 다시
  window.addEventListener("click", (e) => { if (ob && e.target.closest && e.target.closest(".tob [data-fav]")) setTimeout(() => { if (!ob) return; ob.querySelectorAll("[data-fav]").forEach((b) => { const on = T(() => X().pins().has(b.dataset.fav), false); b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "담았어요" : "담기"; }); }, 0); }, true);
  ob.addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.hasAttribute("data-oskip") || t.hasAttribute("data-odone")) { onbClose(true); return; }
    if (t.dataset.oc) {
      obCash = +t.dataset.oc;
      T(() => (window.ZP_budget && ZP_budget.ready ? ZP_budget.set(obCash) : S().setCash(obCash)));
      onbPaint(false); const b = ob.querySelector(`[data-oc="${t.dataset.oc}"]`); if (b) b.focus({ preventScroll: true });
      return;
    }
    if (t.hasAttribute("data-onext")) { obStep = Math.min(2, obStep + 1); onbPaint(true); return; }
    if (t.hasAttribute("data-oalert")) {
      const ib = T(() => X().inbox(), null); if (!ib) return;
      Promise.resolve(ib.subscribe(t)).then((r) => {
        if (!ob) return;
        if (r && r.ok) { onbClose(true); return; }
        const m = $("tobMsg"); if (m) { m.hidden = false; m.textContent = (r && r.msg) || "알림을 켜지 못했어요 · MY › 알림 설정에서 다시 켤 수 있어요"; }
        t.disabled = false; t.removeAttribute("aria-busy"); t.textContent = "다시 해 보기";
      }).catch(() => {});
    }
  });
  ob.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { onbClose(true); return; }
    if (e.key !== "Tab") return;
    const F = [...ob.querySelectorAll("button:not([disabled]),[href],[tabindex='-1']")].filter((x) => x.offsetParent !== null);
    if (!F.length) return;
    const a = F[0], z = F[F.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });
}

/* ---------- 빈 관심 구역: 키트 그림(empty-fav)으로 ---------- */
function emptyDeco() {
  if (!tKit("empty-fav")) return;
  const run = () => document.querySelectorAll(".pn-empty:not([data-tk])").forEach((e) => { e.dataset.tk = "1"; const sv = e.querySelector(":scope > .pn-tile, :scope > svg"); const w = document.createElement("span"); w.className = "t-empty"; w.innerHTML = tIcon("", 160, "", "empty-fav"); if (sv) sv.replaceWith(w); else e.prepend(w); });
  run();
  const f = $("favTop"); if (f) try { new MutationObserver(run).observe(f, { childList: true, subtree: true }); } catch (e) {}
}

/* ---------- 시작 ---------- */
function ready() { return !!(window.ZP_simple && window.ZP_T0 && $("sNav") && H.classList.contains("s-built") && document.body); }
function start() {
  if (start.d) return; start.d = 1;
  H.classList.add("is-app");
  patchHistory();
  navBuild(); bindClicks(); homeBuild(); feedBuild(); emptyDeco();
  H.classList.remove("tapp-wait");
  H.classList.add("tapp-on");
  // 관심 구역·소식 숫자: 자료를 받으면 종·소식 탭에
  feedLoad().then(() => { badge(); if (newsOn()) segSet($("news").dataset.tseg || "all"); });
  addEventListener("storage", (e) => { if (!e.key || e.key === FK || e.key === "zp-alert-off") badge(); });
  addEventListener("zp:alerts", badge);
  if (onbNeed()) setTimeout(onbOpen, 60);
  try { window.dispatchEvent(new Event("zp:tapp")); } catch (e) {}
}
window.ZP_TAPP = { goTab, curTab, dep, feedCounts: () => (CH ? CH.items.reduce((o, e) => { o[e.type] = (o[e.type] || 0) + 1; return o; }, {}) : null), newCount, tiles: () => tiles().map((t) => ({ k: t[0], t: t[1], href: t[2], id: t[3] })), onb: () => !!ob, onbOpen };
(function wait(n) { if (ready()) start(); else if (n < 600) setTimeout(() => wait(n + 1), 25); else H.classList.remove("tapp-wait"); })(0);
