/* ===================== MY 화면(#my) =====================
   뼈대(줄 목록)는 shell.html에 있고, 여기서는 지금 값만 채우고 누르면 하는 일을 붙인다.
   - 내 조건: 내 돈(첫 화면 게이지와 같은 값 · 여기서 바로 바꿈) · 사는 방식(전세 끼고/대출 끼고 — 첫 화면 단추를 대신 누름)
   - 알림 설정: 폰 알림 켜기/끄기(72_inbox) · 권한 상태와 푸는 법 · 종류별 끄기(zp-alert-off)
   - 관심 구역 옮기기: 관심 구역 화면의 '링크 복사'와 같은 것(70_pins PINS.move)
   - 앱 설치(69_install) · 앱 버전·데이터 기준일
   - 내 데이터 모두 지우기: 화면 안 확인 단계 → 이 기기 저장소를 비우고 첫 실행 상태로 다시 연다 */
const MY = (() => {
  const H = document.documentElement;
  const on = () => { const s = $("my"); return !!(s && s.classList.contains("s-on")); };
  const T = (f) => { try { return f(); } catch (e) { return undefined; } };
  // ---------- 내 조건 ----------
  function cond() {
    const c = T(() => CASH), g = T(() => gapMode());
    const b = $("myCash"); if (b && c != null) b.textContent = ZF.cash(c);
    const n = T(() => window.ZP_count(c));
    const nn = $("myCashN"); if (nn && n != null) nn.textContent = `갈 수 있는 곳 ${fmt(n)}곳`;
    const r = $("myCashR"); if (r && c != null && document.activeElement !== r) T(() => { r.value = String(SIMPLE.toPos(c)); r.setAttribute("aria-valuetext", ZF.cash(c)); });
    document.querySelectorAll("#myMode button[data-f]").forEach((x) => x.setAttribute("aria-pressed", String((x.dataset.f === "gap") === !!g)));
  }
  // ---------- 알림 ----------
  // 폰 알림이 꺼져 있으면 종류 스위치는 흐리게·누를 수 없게(켜진 것처럼 보이지 않게) + 한 줄 안내
  const SW = (k, t, onv, dis) => `<li><button type="button" class="my-r my-sw" role="switch" aria-checked="${dis ? "false" : onv}" data-kind="${k}"${dis ? ' disabled aria-disabled="true" aria-describedby="myKindsC"' : ""}><span class="my-t"><b>${t}</b></span><i class="my-tg" aria-hidden="true"></i></button></li>`;
  function alerts() {
    if (typeof INBOX === "undefined") return;
    const s = INBOX.st(), S = $("myPermS"), B = $("myPermB"), Hh = $("myPermH");
    if (!S || !B) return;
    let txt, btn = "", help = "";
    if (s.perm === "denied") { txt = "막혀 있어요"; help = "푸는 법: 주소창 왼쪽 자물쇠(사이트 설정) → 알림 → 허용으로 바꾼 뒤 이 화면을 다시 열어 주세요. iPhone 홈 화면 앱은 설정 → 알림 → 집핀에서 켜요."; }
    else if (s.on) { txt = "켜져 있어요 · 매일 아침 새 소식이 있으면 알려 드려요"; btn = `<button type="button" class="btn secondary sm" id="myPushOff">끄기</button>`; help = "끄면 이 기기로 폰 알림을 보내지 않아요. 소식 탭은 그대로 볼 수 있어요."; }
    else if (!s.can) { txt = "이 브라우저에선 폰 알림을 켤 수 없어요"; help = "새 소식은 아래 소식 탭에 모아 드려요. iPhone은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요."; }
    else { txt = "꺼져 있어요"; btn = `<button type="button" class="btn primary sm" id="myPushOn">알림 받기</button>`; help = "켜면 브라우저가 알림 권한을 물어요. 나중에 사이트 설정에서 언제든 끌 수 있어요."; }
    if (s.msg && s.perm !== "denied" && !s.on) help = s.msg;
    S.textContent = txt;
    if (B.innerHTML !== btn) B.innerHTML = btn;
    if (Hh) { Hh.textContent = help; Hh.hidden = !help; }
    const K = $("myKinds"), dis = !s.on;
    if (K) {
      K.innerHTML = INBOX.KINDS.map(([k, t]) => SW(k, t, !INBOX.isOff(k), dis)).join("");
      K.classList.toggle("off", dis);
      let c = $("myKindsC");
      if (!c) { c = document.createElement("p"); c.id = "myKindsC"; c.className = "my-kc"; K.before(c); }
      c.textContent = "폰 알림을 켜면 골라 받을 수 있어요"; c.hidden = !dis;
    }
  }
  // ---------- 관심 구역 옮기기 ----------
  function move() {
    const n = T(() => PINS.list().length) || 0, c = T(() => PINS.conds().length) || 0;
    const b = $("myMove"), s = $("myMoveS");
    if (b) b.disabled = !(n || c);
    if (s) s.textContent = n || c ? `${c ? `관심 구역 ${n}곳 · 알림 조건 ${c}개를` : `관심 구역 ${n}곳을`} 링크 하나로 옮겨요` : "관심 구역을 더하면 링크 하나로 다른 기기에 옮길 수 있어요";
    if (n || c) T(() => PINS.moveURL().catch(() => {}));   // 미리 만들어 둠 → 누르는 순간 복사(사파리 사용자 동작 제한)
  }
  // ---------- 앱 설치 ----------
  function inst() {
    const I = window.ZP_INSTALL, b = $("myInstB"), s = $("myInstS"); if (!b || !s) return;
    const st = I && I.state ? I.state() : { app: false };
    // 18차: 설치 창을 띄울 수 있을 때(beforeinstallprompt)만 '설치' 버튼 줄 · iOS는 홈 화면에 추가 방법 · 그 밖(이미 설치·지원 안 함)은 줄을 숨긴다
    const row = $("myInst");
    if (row) row.hidden = !!(st.app || st.done || (!st.prompt && !st.ios));
    if (st.app || st.done) { s.textContent = "이 기기에 설치돼 있어요"; b.hidden = true; return; }
    b.hidden = false;
    s.textContent = st.prompt ? "홈 화면에 추가하면 앱처럼 바로 열려요" : st.ios ? "Safari 공유 버튼 → 홈 화면에 추가" : st.inApp ? "카카오톡·인스타그램 안에서는 안 돼요 · 기본 브라우저로 열어 주세요" : "브라우저 메뉴(⋮)에서 '앱 설치' 또는 '홈 화면에 추가'를 눌러요";
    b.textContent = st.ios ? "방법 보기" : "설치";
    b.hidden = !st.prompt && !st.ios;
  }
  function paint() {
    if (!$("my")) return;
    cond(); alerts(); move(); inst();
    const a = $("myAsof"), src = $("asof"); if (a && src && src.textContent.trim()) a.textContent = src.textContent.trim();
  }
  // ---------- 지우기 ----------
  function wipeOpen(v, pop) {
    const box = $("myWipeBox"), b = $("myWipe"); if (!box || !b) return;
    if (!v && box.hidden) return;
    if (v) ZL.open("wipe", () => wipeOpen(false, true)); else if (pop !== true) ZL.done("wipe");
    box.hidden = !v; b.setAttribute("aria-expanded", String(v));
    // 18차: 확인은 아래에서 올라오는 시트 + 어두운 바탕(아래 탭 뒤에 숨지 않게) · 바탕을 누르면 닫기
    let bg = $("myWipeBg");
    if (v && !bg) { bg = document.createElement("div"); bg.id = "myWipeBg"; bg.className = "my-wipe-bg"; bg.addEventListener("click", () => wipeOpen(false)); document.body.appendChild(bg); }
    if (bg) bg.hidden = !v;
    document.documentElement.classList.toggle("my-wipe-on", !!v);
    if (v) { const n = $("myWipeN"); if (n) n.textContent = String(T(() => PINS.list().length) || 0); const g = $("myWipeNo"); g && g.focus({ preventScroll: true }); }
    else b.focus({ preventScroll: true });
  }
  async function wipe() {
    const go = $("myWipeGo"); if (go) { go.disabled = true; go.textContent = "지우는 중…"; }
    // 폰 알림을 받고 있었다면 서버의 구독도 지운다(조용히 · 2.5초 안)
    try { if (typeof INBOX !== "undefined" && INBOX.st().on) await Promise.race([INBOX.unsubscribe(), new Promise((r) => setTimeout(r, 2500))]); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); sessionStorage.setItem("zp_wiped", "1"); } catch (e) {}   // 지운 직후 새로 연 화면은 방문 수 같은 기록도 새로 쓰지 않는다(정말 다 지워졌는지 보이게)
    try { if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {}); } catch (e) {}
    // 첫 실행 상태로: 주소·조건 없이 새로 연다
    location.replace(location.pathname);
  }
  function init() {
    const s = $("my"); if (!s) return;
    T(() => markNewWin(s));   // 저작권 줄의 바깥 링크에 ↗
    s.addEventListener("click", (e) => {
      const t = e.target.closest("button, a"); if (!t) return;
      if (t.id === "myCash") { const box = $("myCashBox"); box.hidden = !box.hidden; t.setAttribute("aria-expanded", String(!box.hidden)); if (!box.hidden) { cond(); $("myCashR").focus({ preventScroll: true }); } return; }
      if (t.closest("#myMode") && t.dataset.f) { const o = document.querySelector(`#mapTop .s-mode button[data-f="${t.dataset.f}"]`); if (o) o.click(); setTimeout(cond, 60); return; }
      if (t.id === "myPushOn") { INBOX.subscribe(t).then(alerts); return; }
      if (t.id === "myPushOff") { INBOX.unsubscribe().then(alerts); return; }
      if (t.dataset.kind) { if (t.disabled) return; const v = t.getAttribute("aria-checked") !== "true"; INBOX.setKind(t.dataset.kind, v); t.setAttribute("aria-checked", String(v)); return; }
      if (t.id === "myMove") { T(() => PINS.move($("myMoveFb"))); return; }
      if (t.id === "myInstB") {
        const I = window.ZP_INSTALL, st = I && I.state ? I.state() : {};
        if (st.ios) { const b = $("myIos"); b.hidden = !b.hidden; t.setAttribute("aria-expanded", String(!b.hidden)); return; }
        if (st.prompt) I.prompt().then(inst);
        return;
      }
      if (t.id === "myWipe") { wipeOpen($("myWipeBox").hidden); return; }
      if (t.id === "myWipeNo") { wipeOpen(false); return; }
      if (t.id === "myWipeGo") { wipe(); return; }
    });
    const r = $("myCashR");
    if (r) {
      r.addEventListener("input", () => { const c = SIMPLE.toCash(+r.value); $("myCash").textContent = ZF.cash(c); const n = T(() => window.ZP_count(c)); if (n != null) $("myCashN").textContent = `갈 수 있는 곳 ${fmt(n)}곳`; r.setAttribute("aria-valuetext", ZF.cash(c)); });
      r.addEventListener("change", () => { T(() => SIMPLE.setCash(SIMPLE.toCash(+r.value))); setTimeout(cond, 80); });
    }
    s.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("myWipeBox").hidden) { e.stopPropagation(); wipeOpen(false); } });
    // 지우기 확인은 MY를 떠나면(다른 탭·화면) 접힌 처음 상태로
    const wipeReset = () => { const box = $("myWipeBox"), b = $("myWipe"); if (!box || box.hidden) return; T(() => ZL.done("wipe")); box.hidden = true; if (b) b.setAttribute("aria-expanded", "false"); };
    addEventListener("zp:view", (e) => { if (e.detail === "my") { wipeReset(); paint(); T(() => INBOX.pushKey().then(alerts)); } else wipeReset(); });
    T(() => new MutationObserver(() => { if (!s.classList.contains("s-on")) wipeReset(); }).observe(s, { attributes: true, attributeFilter: ["class"] }));
    addEventListener("zp:alerts", () => { if (on()) alerts(); });
    addEventListener("zp:bip", () => inst()); addEventListener("appinstalled", () => setTimeout(inst, 0));
    inst();
    T(() => PINS.on(() => { if (on()) move(); }));
    addEventListener("beforeinstallprompt", () => setTimeout(() => { if (on()) inst(); }, 0));
    if (on()) { paint(); T(() => INBOX.pushKey().then(alerts)); }
  }
  return { init, paint };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", MY.init) : setTimeout(MY.init, 0);
