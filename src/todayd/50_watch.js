/* '알림 받을 준비' 시트(첫 관심 구역·첫 알림 조건 뒤 한 번) — 72_inbox.js에서 옮김(같은 동작 · 첫 묶음 무게 줄이기). 알림 권한은 시트 안 '알림 받기'를 누를 때만 */
(function () {
  "use strict";
  const Y = window.ZPT;
  const IC = {
    tr: '<path d="M4 17l5-5 3 3 7-7"/><path d="M14 8h5v5"/>',
    st: '<path d="M5 19h14M7 15h10M9 11h6M11 7h2"/>',
    au: '<path d="M14 4l6 6M11 7l6 6M5 19l7-7M12.5 5.5l6 6"/><path d="M3 21h8"/>',
    ok: '<path d="M4 12l5 5L20 6"/>',
    dn: '<path d="M4 7l6 6 4-4 6 6"/><path d="M20 10v5h-5"/>',
  };
  const ic = (k) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
  Y.watch = (c, kind, id, h) => {
    const { byId, shortName, esc, BRAND } = c, $ = (x) => document.getElementById(x), ZL = c.ZL || { open() {}, done() {} };
    const { subscribe, pushKey, tst, bellSvg } = h, P_FAIL = h.P_FAIL();
    Y.css();
    const r = byId[id];
    const items = kind === "cond"
      ? [["ok", "내 돈으로 갈 수 있는 새 구역"], ["dn", "필요한 돈이 줄어든 곳"], ["au", "경매 물건 등장"], ["st", "단계 변경·인가"]]
      : [["tr", "새 실거래·신고가"], ["st", "단계 변경·인가"], ["au", "경매 물건 등장"], ["ok", "내 돈으로 갈 수 있게 된 곳"]];
    const IN = window.ZP_INSTALL, canI = !!(IN && IN.can()), ios = !!(IN && IN.ios);
    const back = document.activeElement;
    const ov = document.createElement("div");
    ov.className = "pn-ov ws-ov"; ov.id = "wsSheet";
    const render = (push) => `<div class="pn-dlg ws-dlg" role="dialog" aria-modal="true" aria-labelledby="wsT" aria-describedby="wsD">
      <span class="ws-ic" aria-hidden="true">${bellSvg(26)}</span>
      <h3 id="wsT" tabindex="-1">${kind === "cond" ? "이 돈으로 갈 수 있는 곳이 생기면 알려 드릴게요" : `${esc(r ? shortName(r.n) : "관심 구역")} 소식을 알려 드릴게요`}</h3>
      <p id="wsD">${push ? "이런 일이 생기면 폰 알림으로 알려 드려요" : "이런 일이 생기면 소식 탭에 모아 알려 드려요"}</p>
      <ul class="ws-l">${items.map(([k, t]) => `<li><span class="ws-li ${k}">${ic(k)}</span>${t}</li>`).join("")}</ul>
      ${push ? `<button type="button" class="btn primary ws-go" data-wson>${bellSvg(18)}알림 받기</button>` : ios && canI ? "" : `<p class="ws-note">새 소식은 아래 ${bellSvg(14)} 소식 탭에 모아 드려요</p>`}
      ${canI ? `<button type="button" class="btn ${push ? "secondary" : "primary"} ws-in" data-wsin aria-expanded="false"><img src="/icons/icon-192.png" alt="" width="22" height="22">앱으로 설치하면 놓치지 않아요</button>
        <div class="ws-ios" data-wsios hidden><b>홈 화면에 추가하는 법</b><ol><li>Safari 아래 <svg viewBox="0 0 24 24" width="15" height="15" aria-label="공유"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 공유 버튼</li><li><b>홈 화면에 추가</b></li><li>홈 화면의 ${BRAND} 앱을 열고 소식 탭에서 <b>알림 받기</b></li></ol><small>iPhone은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요</small></div>` : ""}
      <button type="button" class="btn text sm ws-x" data-wsx>${push || canI ? "나중에" : "확인"}</button></div>`;
    let closed = false;
    const close = (later, pop) => { if (closed) return; closed = true; if (pop !== true) ZL.done("ws"); ov.remove(); document.removeEventListener("keydown", kd); removeEventListener("hashchange", close); if (later === true && canI) try { IN.later(); } catch (e) {} try { back && back.focus && back.focus(); } catch (e) {} };
    const kd = (e) => { if (e.key === "Escape") close(true); };
    const draw = (push) => { ov.innerHTML = render(push); const h = ov.querySelector("#wsT"); h && h.focus({ preventScroll: true }); };
    ov.addEventListener("click", async (e) => {
      if (e.target === ov || e.target.closest("[data-wsx]")) return close(true);
      const on = e.target.closest("[data-wson]");
      if (on) {
        const r = await subscribe(on);
        if (r.ok) { close(); return; }
        // 실패: 버튼은 되돌리고(막힘이면 숨김) 바로 아래에 이유
        let m = ov.querySelector("[data-wsmsg]");
        if (!m) { m = document.createElement("p"); m.className = "ws-msg"; m.dataset.wsmsg = "1"; m.setAttribute("role", "alert"); on.after(m); }
        m.textContent = r.msg;
        if (r.denied || r.msg === P_FAIL) { on.hidden = true; const d = ov.querySelector("#wsD"); if (d) d.textContent = "이런 일이 생기면 소식 탭에 모아 알려 드려요"; const x = ov.querySelector("[data-wsx]"); if (x) x.textContent = "확인"; }
        return;
      }
      const ins = e.target.closest("[data-wsin]");
      if (ins) {
        if (ios) { const box = ov.querySelector("[data-wsios]"); box.hidden = !box.hidden; ins.setAttribute("aria-expanded", String(!box.hidden)); return; }
        const ok = await IN.prompt(); if (ok) { tst(`${BRAND} 앱을 설치했어요`, "홈 화면에서 바로 열 수 있어요"); close(); }
      }
    });
    try { IN && IN.seen(); } catch (e) {}
    try { const t = $("pnToast"); if (t) t.classList.remove("on"); } catch (e) {}
    document.body.appendChild(ov);
    draw(false);
    document.addEventListener("keydown", kd); addEventListener("hashchange", close, { once: true });
    ZL.open("ws", () => close(false, true));
    pushKey().then((k) => { if (k && ov.isConnected && Notification.permission !== "denied") draw(true); });
  };
  window.ZPTw = 1;
})();
