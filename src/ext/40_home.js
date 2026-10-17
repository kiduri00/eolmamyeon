/* 모바일: 리포트를 연 채 나갔다가 다시 열면(새로고침·탭 복원·뒤로가기) 주소의 #구역이 남아 첫 화면 대신 리포트가 뜨던 문제
   → 같은 탭에서 돌아온 경우엔 구역·지도 해시를 지우고 첫 화면부터. 처음 받은 공유 링크(#구역)는 그대로 연다. */
(() => {
  try {
    const h = location.hash.slice(1);
    let back = false;
    try { back = sessionStorage.getItem("emr_seen") === "1"; sessionStorage.setItem("emr_seen", "1"); } catch (e) {}
    const nt = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0] || {}).type;
    if (nt === "reload" || nt === "back_forward") {
      if (h && matchMedia("(max-width:980px)").matches && !/^(join=|membership)/.test(h) && !/^[a-z]+Top$|^(results|planner)$/.test(h)) {
        history.replaceState(null, "", location.pathname + location.search);
        if ("scrollRestoration" in history) history.scrollRestoration = "manual";
        window.scrollTo(0, 0);
      }
    }
  } catch (e) {}
})();
/* 메인 섹션: '펼쳐 보기' 대신 처음 5건을 보여 주고 '더보기' */
initFold = function () {};
const HM = (() => {
  // [박스 선택자, 줄 선택자, PC 개수, 모바일 개수]
  const MOB = () => matchMedia("(max-width:640px)").matches;
  const cfg = [
    ["#cmOut", "tbody > tr, ul > li, ol > li, .cm-row, .card", 4, 3],
    ["#rank", "tbody > tr", 5, 3],
    ["#svOut", "tbody > tr", 5, 3],
    ["#fvOut", "tbody > tr, ul > li", 5, 3],
    ["#nwOut", "tbody > tr, ul > li, ol > li", 5, 3],
    ["#txrOut", "tbody > tr", 5, 3],
    ["#ntcOut", "ul.ntl > li", 5, 3],
    ["#guList", ":scope > li", 99, 6],
    ["#rules .rules-col", ":scope > article", 99, 2],
    [".rd-card ol, .rd-card ul", ":scope > li", 99, 3],
  ];
  // 버튼은 상자마다 하나만 만들어 두고 글자·aria만 바꾼다(포커스 유지). 숨김은 속성 변경이라 관찰에 걸리지 않아 루프가 없다.
  function clamp(box, sel, n, nm) {
    const N = (MOB() ? nm : n) || 5;
    const rows = [...box.querySelectorAll(sel)].filter((x) => !x.closest(".hm-more"));
    const open = !!box.__hmOpen;
    rows.forEach((x, i) => (x.hidden = !open && i >= N));
    let b = box.__hmBtn;
    if (rows.length <= N) { if (b) b.hidden = true; return; }
    if (!b) {
      b = box.__hmBtn = document.createElement("button");
      b.type = "button";
      b.className = "btn secondary sm more-b hm-more";
      b.onclick = () => {
        box.__hmOpen = !box.__hmOpen;
        clamp(box, sel, n, nm);
        if (!box.__hmOpen) { const r = box.getBoundingClientRect(); if (r.top < 0) window.scrollBy(0, r.top - 120); }
      };
    }
    b.hidden = false;
    b.textContent = open ? "접기" : `더보기 (${rows.length - N}건)`;
    b.setAttribute("aria-expanded", String(open));
    const host = /^(TABLE|UL|OL)$/.test(box.tagName) ? box.parentElement : box;
    if (b.parentElement !== host || b.nextSibling) host.appendChild(b);
  }
  function bind(box, sel, n, nm) {
    if (box.__hmOn) return;
    box.__hmOn = 1;
    let t;
    const mo = new MutationObserver((ms) => {
      if (ms.every((m) => (box.__hmBtn && box.__hmBtn.contains(m.target)) || [...m.addedNodes, ...m.removedNodes].every((x) => x === box.__hmBtn))) return;   // 버튼 글자 바뀜은 무시
      box.__hmOpen = 0;
      clearTimeout(t);
      t = setTimeout(() => { clamp(box, sel, n, nm); mo.takeRecords(); }, 30);
    });
    mo.observe(box, { childList: true, subtree: true });
    clamp(box, sel, n, nm);
  }
  function init() {
    const all = () => cfg.forEach(([q, sel, n, nm]) => document.querySelectorAll(q).forEach((box) => bind(box, sel, n, nm)));
    all();
    let tt;
    new MutationObserver(() => { clearTimeout(tt); tt = setTimeout(all, 150); }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
    let w = innerWidth;
    addEventListener("resize", () => { if ((w <= 640) !== (innerWidth <= 640)) cfg.forEach(([q, sel, n, nm]) => document.querySelectorAll(q).forEach((box) => clamp(box, sel, n, nm))); w = innerWidth; });
  }
  return { init };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", HM.init) : setTimeout(HM.init, 0);
/* 로고: 계산기(#planner)가 아니라 맨 위 첫 화면으로 */
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("a.logo");
  if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  if (document.getElementById("report").classList.contains("sheet")) closeSheetNow();
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  window.scrollTo({ top: 0, behavior: "auto" });
}, true);
/* 섹션 이동(탭바·메뉴·다음 단계)도 방문 기록에 남겨, 뒤로가기가 사이트 밖으로 나가지 않고 이전 위치로 돌아오게 */
(() => {
  const SEL = '#tabbar a[data-sec], [data-menu], [data-jump2], .next-steps a[href^="#"]';
  document.addEventListener("click", (e) => {
    if (document.documentElement.classList.contains("simple")) return;   // 단순 화면은 60_simple.js가 기록을 관리
    const a = e.target.closest && e.target.closest(SEL);
    if (!a || e.metaKey || e.ctrlKey) return;
    if (document.getElementById("report").classList.contains("sheet")) return;
    const id = a.dataset.sec || a.dataset.menu || a.dataset.jump2 || (a.getAttribute("href") || "").slice(1);
    if (!id || !document.getElementById(id)) return;
    try {
      history.replaceState({ ...(history.state || {}), emrY: Math.round(scrollY) }, "");
      history.pushState({ emrSec: id }, "", location.pathname + location.search);
    } catch (err) {}
  }, true);
  addEventListener("popstate", (e) => {
    const st = e.state || {};
    if (st.emrY != null) { JUMP_GEN++; requestAnimationFrame(() => window.scrollTo({ top: st.emrY, behavior: "auto" })); }
    else if (st.emrSec && document.getElementById(st.emrSec)) requestAnimationFrame(() => jumpTo(st.emrSec));
  });
})();
/* 리포트 탭: 고른 탭이 가로로 보이게 하고, 시트에서 탭 줄이 고정된 상태면 내용 맨 위로 */
{
  const _st = setTab;
  setTab = function (k) {
    _st(k);
    const rp = document.getElementById("report"), b = rp && rp.querySelector(`[role=tab][data-tab="${k}"]`);
    if (b) { const t = b.parentElement; t.scrollLeft = Math.max(0, b.offsetLeft - (t.clientWidth - b.offsetWidth) / 2); }
    if (rp && rp.classList.contains("sheet")) {
      const tabs = rp.querySelector(".tabs"), pane = document.getElementById("pane");
      if (tabs && pane && tabs.getBoundingClientRect().top <= 60) rp.scrollTop += pane.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom - 8;
    }
  };
}
