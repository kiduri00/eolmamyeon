/* 메인 섹션: '펼쳐 보기' 대신 처음 5건을 보여 주고 '더보기' */
initFold = function () {};
const HM = (() => {
  const cfg = [
    ["cmOut", "tbody > tr, ul > li, ol > li, .cm-row, .card", 4],
    ["rank", "tbody > tr"],
    ["svOut", "tbody > tr"],
    ["fvOut", "tbody > tr, ul > li"],
    ["nwOut", "tbody > tr, ul > li, ol > li"],
    ["rules", ":scope > *"],
  ];
  function clamp(box, sel, n) {
    const N = n || 5;
    if (box.__hmBusy) return;
    box.__hmBusy = 1;
    box.querySelectorAll(":scope .hm-more").forEach((b) => b.remove());
    const rows = [...box.querySelectorAll(sel)].filter((x) => !x.classList.contains("hm-more") && !x.closest(".hm-more"));
    const open = box.__hmOpen;
    rows.forEach((x, i) => (x.hidden = !open && i >= N));
    if (rows.length > N) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn secondary sm more-b hm-more";
      b.textContent = open ? "접기" : `더보기 (${rows.length - N}건)`;
      b.setAttribute("aria-expanded", String(!!open));
      b.onclick = () => {
        box.__hmOpen = !box.__hmOpen;
        clamp(box, sel, n);
        if (!box.__hmOpen) {
          const r = box.getBoundingClientRect();
          if (r.top < 0) window.scrollBy(0, r.top - 120);
        }
      };
      const host = box.tagName === "TABLE" ? box.parentElement : box;
      host.appendChild(b);
    }
    requestAnimationFrame(() => (box.__hmBusy = 0));
  }
  function init() {
    cfg.forEach(([id, sel, n]) => {
      const box = document.getElementById(id);
      if (!box) return;
      let t;
      new MutationObserver((ms) => {
        if (box.__hmBusy) return;
        if (ms.every((m) => [...m.addedNodes, ...m.removedNodes].every((n) => n.classList && n.classList.contains("hm-more")))) return;
        box.__hmOpen = 0;
        clearTimeout(t);
        t = setTimeout(() => clamp(box, sel, n), 30);
      }).observe(box, { childList: true, subtree: true });
      clamp(box, sel, n);
    });
  }
  return { init };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", HM.init) : setTimeout(HM.init, 0);
