/* ===================== 사이클 2 두 번째 지연 묶음(/b/g.*.js) — 처음 누를 때만 받는다 =====================
   F6 구역 비교 · F7 내 시나리오 저장·공유 · F8 필지 연식 지도. 값·함수는 ctx(app.js featCtx = ZP_feat.ctx())로만 받는다.
   숫자는 시트와 같은 함수(ctx.shown · ctx.win · ctx.etaShow · ctx.ZF)에서 — 새 셈을 만들지 않는다. */
(function () {
  "use strict";
  const X = (window.ZPX = window.ZPX || {});
  X.v = 1;
  const CSS = "__XCSS__";
  X.css = () => { if (document.getElementById("zpxCss")) return; const s = document.createElement("style"); s.id = "zpxCss"; s.textContent = CSS; document.head.appendChild(s); };
  // 전체 화면 창(dialog): 뒤로 가기 = 닫기(ZL 겹 기록) · Esc · × · 열 때 제목에 초점, 닫으면 연 버튼으로 초점
  X.dlg = (id, title, html, ctx, onClose) => {
    X.css();
    let d = document.getElementById(id);
    const back = document.activeElement;
    if (!d) {
      d = document.createElement("dialog"); d.id = id; d.className = "zx-dlg"; d.setAttribute("aria-labelledby", id + "T");
      document.body.appendChild(d);
      d.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    }
    d.innerHTML = `<div class="zx-in"><div class="zx-h"><h2 id="${id}T" tabindex="-1">${title}</h2><button type="button" class="zx-x" data-zx-x aria-label="닫기">×</button></div><div class="zx-b">${html}</div></div>`;
    let closed = false;
    function close(fromBack) {
      if (closed) return; closed = true;
      try { d.close(); } catch (e) { d.removeAttribute("open"); }
      if (!fromBack && ctx && ctx.ZL) ctx.ZL.done(id);
      try { if (back && back.focus) back.focus(); } catch (e) {}
      if (onClose) onClose();
    }
    d.querySelector("[data-zx-x]").onclick = () => close();
    try { d.showModal(); } catch (e) { d.setAttribute("open", ""); }
    if (ctx && ctx.ZL) ctx.ZL.open(id, () => close(true));
    const h = d.querySelector("h2"); if (h) h.focus();
    return { el: d, close, body: d.querySelector(".zx-b"), title: (t) => { if (h) h.textContent = t; } };
  };
  // 보관(이 기기만): 실패해도 화면은 그대로
  X.get = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? def : v; } catch (e) { return def; } };
  X.set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
})();
