/* '홈 화면에 추가' 안내 띠 — 69_install.js에서 옮김(같은 동작 · 첫 묶음 무게 줄이기). 관심 구역을 더했을 때·폰 알림을 켰을 때만(69_install allowed) · 닫으면 30일 쉼 */
(function () {
  "use strict";
  const Y = window.ZPT;
  let el = null;
  const hide = () => { if (el) { el.classList.remove("on"); setTimeout(() => el && (el.hidden = true), 250); } };
  Y.inst = (why, h) => {
    const BRAND = h.BRAND;
    if (!el) {
      el = document.createElement("div"); el.className = "zi"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `홈 화면에 ${BRAND} 추가`);
      document.body.appendChild(el);
      el.addEventListener("click", async (e) => {
        if (e.target.closest("[data-zix]")) { h.put({ no: Date.now() }); return hide(); }
        if (e.target.closest("[data-zio]")) { const ok = await h.prompt(); if (!ok) h.put({ no: Date.now() }); hide(); }
      });
    }
    const lead = why === "push" ? "알림을 켰어요. 앱으로 두면 놓치지 않아요" : "관심 구역에 넣었어요. 앱처럼 바로 열어 보세요";
    el.innerHTML = `<img src="/icons/icon-192.png" alt="" width="40" height="40"><div class="zi-t"><b>홈 화면에 ${BRAND} 추가</b><span>${lead}</span>` +
      (h.ios ? `<span class="zi-ios">아래 <svg viewBox="0 0 24 24" width="15" height="15" aria-label="공유"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 공유 → <b>홈 화면에 추가</b></span>` : "") +
      `</div>${h.ios ? "" : `<button type="button" class="zi-go" data-zio>추가</button>`}<button type="button" class="zi-x" data-zix aria-label="닫기">✕</button>`;
    el.hidden = false; requestAnimationFrame(() => el.classList.add("on"));
  };
})();
