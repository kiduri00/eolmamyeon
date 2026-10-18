/* 첫 화면 로더(빌드가 index.html <head>에 그대로 넣는다 · __X__ 자리는 빌드가 채움).
   첫 페인트 = 미리 그린 HTML + 첫 페인트용 CSS + 작은 섬(h.*.js: 게이지·사는 방식·목록·'이 돈이면'·지도 자리 점).
   전체 앱(d: 데이터, a: 앱 코드, c: 전체 CSS, 글꼴)은 아래 때만 불러 붙인다(hydrate):
   - 사용자가 처음 손댈 때(누르기·키·스크롤·휠·마우스 움직임·입력·주소 #바뀜)
   - 바로: 주소에 #(구역·도구 딥링크), 저장된 가정이 기본값과 다를 때, 내 핀이 있을 때, 서비스 워커가 붙은 재방문, 빠른 연결(유휴 시간에)
   전체 앱이 붙으면 window 'zp:hydrated' 이벤트. 섬이 받아 둔 누르기는 그때 다시 눌러 준다. */
(function () {
  var B = (window.ZP_boot = { a: "__A__", d: "__D__", c: "__C__", f: "__F__", st: 0, hyd: 0 });
  var H = document.documentElement, W = window;
  // 설치 창 신호는 앱 코드(69_install)가 붙기 전에 올 수 있다 → 받아 두었다가 넘긴다
  W.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); W.__bip = e; });
  var ls = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var add = function (t, o) { var e = document.createElement(t); for (var k in o) e[k] = o[k]; return e; };
  var css = function (u, cb, co) { var l = add("link", { rel: "stylesheet", href: u }); if (co) l.crossOrigin = "anonymous"; if (cb) l.onload = l.onerror = cb; document.head.appendChild(l); };
  // 글꼴: 받는 동안은 대체 글꼴 그대로 → 이 화면 글자에 필요한 조각이 다 오면 html.fo 한 번으로 바꾼다(조각마다 화면을 다시 짜던 4~5번의 긴 작업 → 1번).
  // 바꾸는 순간은 브라우저가 한가할 때(첫 화면 긴 작업과 겹치지 않게)
  // 조용해진 뒤에 할 일: 전체 앱이 붙은 다음 긴 작업 없이 5.5초가 지나거나(= 첫 화면이 반응할 수 있게 된 뒤), 사람이 처음 손댈 때(먼저 오는 쪽) 한 번.
  // 첫 화면 숫자·목록이 다 뜬 뒤 무거운 일(지도 그리기 · 글꼴 바꿔 다시 짜기)이 첫 화면 반응을 막지 않게(18차 성능)
  var QF = [], qOn = false, qT = 0;
  var qFire = function () { if (qOn) return; qOn = true; clearTimeout(qT); QUI.forEach(function (t) { W.removeEventListener(t, qEv, true); }); var L = QF.splice(0); for (var i = 0; i < L.length; i++) try { L[i](); } catch (e) {} };
  // 금액 막대를 끄기 시작한 손길은 '조용해짐'으로 치지 않는다 — 글꼴 바꾸기(화면 다시 짜기)가 끄는 숫자를 늦추지 않게 손을 뗀 뒤로 미룬다(19차)
  var qEv = function (e) {
    var t = e.target;
    if (e.type !== "keydown" && e.type !== "scroll" && t && t.closest && t.closest("#sScrub,#sCash,#sMiniR,.scrub")) {
      if (!qEv.w) { qEv.w = 1; W.addEventListener("pointerup", function () { setTimeout(qFire, 700); }, { once: true, capture: true }); W.addEventListener("touchend", function () { setTimeout(qFire, 700); }, { once: true, capture: true }); }
      return;
    }
    qFire();
  };
  var QUI = ["pointerdown", "touchstart", "keydown", "wheel", "scroll", "input", "focusin"];
  QUI.forEach(function (t) { W.addEventListener(t, qEv, { capture: true, passive: true }); });
  var qArm = function () { clearTimeout(qT); qT = setTimeout(qFire, 5500); };
  try { new PerformanceObserver(function () { if (B.hyd && !qOn) qArm(); }).observe({ type: "longtask" }); } catch (e) {}
  B.quiet = function (fn) { if (qOn) { fn(); return; } QF.push(fn); };
  B.quietNow = qFire;
  W.addEventListener("zp:hydrated", function () { qArm(); setTimeout(qFire, 30000); });
  B.font = function () {
    if (B.fo) return; B.fo = 1;
    var on = function () { if (on.d) return; on.d = 1; B.quiet(function () { (W.requestIdleCallback || setTimeout)(function () { H.classList.add("fo"); }, { timeout: 1500 }); }); };
    css(B.f, function () {
      try {
        var t = ((document.body && document.body.innerText) || "").replace(/\s+/g, ""), u = {}, x = "";
        for (var i = 0; i < t.length && x.length < 1500; i++) if (!u[t[i]]) { u[t[i]] = 1; x += t[i]; }
        document.fonts.load('16px "Pretendard Variable"', x + "0123456789억만곳").then(on, on);
      } catch (e) { on(); }
      setTimeout(on, 10000);
    }, 1);
  };
  B.full = function (why) {
    if (B.st || ls("zp_nohyd") === "1") return;
    B.st = 1; B.why = why;
    [B.d, B.a].forEach(function (u) { document.head.appendChild(add("link", { rel: "preload", as: "script", href: u })); });
    var run = function () {
      if (run.d) return;
      if (document.readyState === "loading") return document.addEventListener("DOMContentLoaded", run);
      run.d = 1;
      try { performance.mark("zp-hyd0"); } catch (e) {}
      var d = add("script", { src: B.d }), a = add("script", { src: B.a });
      d.async = a.async = false;
      a.onload = function () {
        // 확장 모듈 init(setTimeout 0)들이 먼저 돌고 난 다음
        setTimeout(function () { requestAnimationFrame(function () { try { performance.mark("zp-hyd"); } catch (e) {} B.hyd = 1; H.classList.remove("zp-wait"); try { W.dispatchEvent(new Event("zp:hydrated")); } catch (e) {} setTimeout(B.font, 300); }); }, 60);
      };
      a.onerror = function () { B.st = 0; H.classList.remove("zp-wait"); };
      document.body.appendChild(d); document.body.appendChild(a);
    };
    // 전체 CSS가 먼저 붙어야 앱이 만드는 요소(탭바·타일 등)가 맨몸으로 보이지 않는다
    css(B.c, run);
    setTimeout(run, 15000);
  };
  var EV = ["pointerdown", "touchstart", "keydown", "wheel", "mousemove", "scroll", "click", "input", "change", "focusin"];
  var on = function (e) { EV.forEach(function (t) { W.removeEventListener(t, on, true); }); W.removeEventListener("hashchange", on); B.full(e.type); };
  EV.forEach(function (t) { W.addEventListener(t, on, { capture: true, passive: true }); });
  W.addEventListener("hashchange", on);
  // 바로 붙일 때
  var now = "";
  try {
    var q = location.search, fav = ls("jg-fav"), so = ls("emr.sort");
    if (ls("zp_full") === "1") now = "flag";
    else if (location.hash.length > 1) now = "hash";
    else if (/[?&](cash|mode|homes|first|unit|inc|income|basis|kind|fund|jr)=/.test(q) || ls("jg-cond")) now = "cond";
    else if (so && so !== "fit") now = "sort";
    else if (fav && fav !== "[]") now = "pins";
    else if (navigator.serviceWorker && navigator.serviceWorker.controller) now = "sw";
  } catch (e) { now = "err"; }
  B.now = now;
  var c = navigator.connection, fast = !!(c && c.effectiveType === "4g" && c.rtt && c.rtt < 150 && !c.saveData) && ls("zp_slow") !== "1";
  B.fast = fast;
  if (fast || now === "sw") B.font();
  if (now) B.full(now);
  else if (fast) W.addEventListener("load", function () { (W.requestIdleCallback || setTimeout)(function () { B.full("idle"); }, { timeout: 2000 }); });
})();
