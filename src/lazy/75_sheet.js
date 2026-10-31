/* 사이클 5 D 지연 묶음 "sheet" (src/lazy → /b/zsheet.*.js · ZP_lazy) — 원래 src/todayd 45_onb.js · 50_watch.js · 60_inst.js */
// 사이클 5 M 지연 묶음 등록 — 몸통은 init() 때 돈다(A 자료·문구 묶음 window.ZP_today가 먼저 열려 있어야 해서 · 73_today.js lz가 연 뒤 부름)
(window.ZP_L || (window.ZP_L = {})).sheet = { v: 1, init() {
  if (!this.Y) {
/* 첫 방문 결과 카드(웹 · w 묶음): 금액을 고른 뒤 질문 카드 자리에 '그 돈으로 갈 수 있는 곳 N곳' + 아침에 받기 · 닫으면 다시 안 뜸(zp-onb-res) */
(function () {
  "use strict";
  const Y = window.ZPT, e = Y.esc;
  // 첫 방문 결과(웹): 금액을 고른 뒤 질문 카드 자리에 '그 돈으로 갈 수 있는 곳 N곳' + 아침에 받기 · 닫으면 다시 안 뜸
  Y.onb = (ctx) => {
    try { sessionStorage.removeItem("zp.onbR"); } catch (er) {}
    if (Y.tapp() || document.getElementById("tdOnb") || Y.ls("zp-onb-res", 0)) return;
    const o = document.getElementById("onb"); if (!o) return;
    Y.css();
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
      ${canI ? `<button type="button" class="btn ${push ? "secondary" : "primary"} ws-in" data-wsin aria-expanded="false"><img src="/icons/icon-192.png" alt="" width="22" height="22">앱으로 설치하면 바로 열 수 있어요</button>
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
})();
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
    const lead = why === "push" ? "알림을 켰어요. 앱으로 두면 아침 알림을 바로 열 수 있어요" : "관심 구역에 넣었어요. 앱처럼 바로 열어 보세요";
    el.innerHTML = `<img src="/icons/icon-192.png" alt="" width="40" height="40"><div class="zi-t"><b>홈 화면에 ${BRAND} 추가</b><span>${lead}</span>` +
      (h.ios ? `<span class="zi-ios">아래 <svg viewBox="0 0 24 24" width="15" height="15" aria-label="공유"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 공유 → <b>홈 화면에 추가</b></span>` : "") +
      `</div>${h.ios ? "" : `<button type="button" class="zi-go" data-zio>추가</button>`}<button type="button" class="zi-x" data-zix aria-label="닫기">✕</button>`;
    el.hidden = false; requestAnimationFrame(() => el.classList.add("on"));
  };
})();
    this.Y = window.ZPT;
  }
  return this.Y;
} };
