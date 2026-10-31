/* 첫 방문 결과 카드(웹 · w 묶음): 금액을 고른 뒤 질문 카드 자리에 '그 돈으로 갈 수 있는 곳 N곳' + 아침에 받기 · 닫으면 다시 안 뜸(zp-onb-res) */
(function () {
  "use strict";
  const Y = window.ZPT, e = Y.esc;
  const CSS3 = "__WCSS__";
  // 첫 방문 결과(웹): 금액을 고른 뒤 질문 카드 자리에 '그 돈으로 갈 수 있는 곳 N곳' + 아침에 받기 · 닫으면 다시 안 뜸
  Y.onb = (ctx) => {
    try { sessionStorage.removeItem("zp.onbR"); } catch (er) {}
    if (Y.tapp() || document.getElementById("tdOnb") || Y.ls("zp-onb-res", 0)) return;
    const o = document.getElementById("onb"); if (!o) return;
    Y.css(); if (!document.getElementById("zptCss3")) { const st = document.createElement("style"); st.id = "zptCss3"; st.textContent = CSS3; document.head.appendChild(st); }
    const draw = () => {
      let n = null; try { n = window.ZP_count(ctx.cash()); } catch (er) {}
      const box = Y.mornBox(ctx, "onb");
      return `<div class="onr-h"><p class="onr-k">고른 조건</p><button type="button" class="onr-x" data-onrx aria-label="결과 카드 닫기">닫기</button></div><h2 class="onr-t" id="tdOnbT">${e(`${Y.cashT(ctx, ctx.cash())}·${Y.modeT(ctx)}면`)} 갈 수 있는 곳 <b>${n == null ? "–" : Y.n(n)}곳</b></h2><p class="onr-s">새로 갈 수 있게 되거나 관심 구역에 소식이 생기면 아침에 한 번 알려 드릴 수 있어요.</p>${box || `<p class="onr-s">새 소식은 아래 소식 탭에 모아 드려요.</p>`}`;
    };
    const sec = document.createElement("section"); sec.className = "onr"; sec.id = "tdOnb"; sec.setAttribute("aria-labelledby", "tdOnbT");
    o.after(sec);
    const paint = () => { sec.innerHTML = draw(); };
    paint(); Y.mornBind(ctx, sec);
    ctx.inbox.pushKey().then(() => { if (sec.isConnected && !sec.querySelector("[data-mo]")) paint(); });
    sec.addEventListener("click", (ev) => { if (ev.target.closest("[data-onrx]")) { Y.lsw("zp-onb-res", 1); sec.remove(); const b = document.getElementById("sCashBtn"); b && b.focus({ preventScroll: true }); } });
  };
})();
