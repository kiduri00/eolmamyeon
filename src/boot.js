/* 첫 화면 로더(빌드가 index.html <head>에 그대로 넣는다 · __X__ 자리는 빌드가 채움).
   첫 페인트 = 미리 그린 HTML + 첫 페인트용 CSS + 작은 섬(h.*.js: 게이지·사는 방식·목록·'이 돈이면'·지도 자리 점).
   전체 앱(d: 데이터, a: 앱 코드, c: 전체 CSS, 글꼴)은 아래 때만 불러 붙인다(hydrate):
   - 사용자가 처음 손댈 때(누르기·키·스크롤·휠·마우스 움직임·입력·주소 #바뀜)
   - 바로: 주소에 #(구역·도구 딥링크), 저장된 가정이 기본값과 다를 때, 내 핀이 있을 때, 서비스 워커가 붙은 재방문, 빠른 연결(유휴 시간에)
   전체 앱이 붙으면 window 'zp:hydrated' 이벤트. 섬이 받아 둔 누르기는 그때 다시 눌러 준다. */
(function () {
  var B = (window.ZP_boot = { a: "__A__", d: "__D__", c: "__C__", f: "__F__", st: 0, hyd: 0 });
  var H = document.documentElement, W = window;
  // pre-adsense 5: 설치 앱(html.is-tapp · scheduler.yield 있음)은 같은 앱 코드를 몇 덩이로 나눠 도는 판(ta.*.js)을 받는다 — 웹은 예전 a.*.js 그대로(받을 때 고른다: 앱 표시는 머리 스크립트가 붙임)
  var isApp = function () { if (H.classList.contains("is-tapp")) return true; var m = function (q) { try { return W.matchMedia(q).matches; } catch (e) { return false; } }; if (m("(display-mode: standalone)") || m("(display-mode: fullscreen)") || m("(display-mode: minimal-ui)") || navigator.standalone === true || /^android-app:\/\//.test(document.referrer || "")) return true; try { return sessionStorage.getItem("zp.tapp") === "1"; } catch (e) { return false; } };   // 머리 스크립트(shell.html 설치 앱 알아채기)와 같은 규칙 — 주소 #로 바로 받을 때는 그 스크립트보다 먼저 돈다
  var aPick = function () { try { if (isApp() && W.scheduler && typeof W.scheduler.yield === "function" && /^\/b\/ta\./.test("__AA__")) B.a = "__AA__"; } catch (e) {} };
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
  // 사이클 3(B): 'scroll'은 뺀다 — 앱이 스스로 하는 스크롤(#map 딥링크·지도 칸으로 맞춤)도 scroll을 내서, 사람이 손대기 전(붙기도 전)에 '조용해짐'이 켜졌다.
  //   사람의 스크롤은 그 앞에 touchstart·wheel·keydown·pointerdown이 오므로 그대로 잡힌다(스크롤 막대 끌기만 5.5초 조용함 규칙으로).
  var QUI = ["pointerdown", "touchstart", "keydown", "wheel", "input", "focusin"];
  QUI.forEach(function (t) { W.addEventListener(t, qEv, { capture: true, passive: true }); });
  var qArm = function () { clearTimeout(qT); qT = setTimeout(qFire, 5500); };
  try { new PerformanceObserver(function () { if (B.hyd && !qOn) qArm(); }).observe({ type: "longtask" }); } catch (e) {}
  B.quiet = function (fn) { if (qOn) { fn(); return; } QF.push(fn); };
  B.quietNow = qFire;
  W.addEventListener("zp:hydrated", function () { qArm(); setTimeout(qFire, 30000); });
  B.font = function () {
    if (B.fo) return; B.fo = 1;
    // 23차: 웹글꼴로 바꾸기를 몇 조각으로(한 번에 html.fo → 문서 전체 스타일 다시 계산 · 4배 느린 CPU에서 300~500ms 긴 작업 하나였던 것).
    //       맨 위 칸들(머리·지도 칸 아이들·나머지)에 .fp(--font = 웹글꼴)를 한가할 때 하나씩 — 뿌리(html·body)는 건드리지 않는다. 나중에 붙는 칸(시트·알림)도 .fp
    var FP = ["#hdr,#sNav", "#sGauge,#sListW", "#mapbox>*", "#mapTop .main>*", "#mapTop>*", "main.wrap>*:not(#mapTop)", "body>*:not(main):not(#hdr):not(#sNav):not(script):not(style)"];
    var fpAdd = function (e) { if (e && e.nodeType === 1 && e.classList && !/^(SCRIPT|STYLE|LINK)$/.test(e.tagName)) e.classList.add("fp"); };
    // 사이클 3(B): 조각 하나가 크면(#map 아래 본문 전체 등 · 4×CPU에서 한 조각 200ms 넘는 다시 짜기) 그 아이들로 나눠 묶음마다 요소 약 FPN개씩 —
    //   아이들 먼저, 그 칸 자신은 맨 뒤(바뀌는 글꼴·끝 상태는 예전과 같음: 모든 글자가 .fp 조상의 --font · 본문 CSS는 글꼴을 var(--font)/inherit로만 씀)
    var FPN = 260, fq = [];
    var fpOk = function (e) { return e && e.nodeType === 1 && e.classList && !/^(SCRIPT|STYLE|LINK)$/.test(e.tagName); };
    var fpQ = function (e) { if (!fpOk(e) || e.classList.contains("fp")) return; var n = e.getElementsByTagName("*").length; if (n > FPN && e.children.length) { [].forEach.call(e.children, fpQ); fq.push([e, 0]); } else fq.push([e, n + 1]); };
    var fpStep = function (i) {
      if (!fq.length && i >= FP.length) {
        try { var mo = new MutationObserver(function (L) { L.forEach(function (m) { [].forEach.call(m.addedNodes, fpAdd); }); }); [document.body, document.querySelector("main.wrap"), document.getElementById("mapTop")].forEach(function (x) { if (x) mo.observe(x, { childList: true }); }); } catch (e) {}
        B.fp = 1; return;
      }
      // 조각마다 그 자리에서 스타일·배치를 끝내고(offsetHeight) 다음 프레임 뒤 한가할 때 다음 조각 — 여러 조각이 한 프레임에 몰려 다시 긴 작업 하나가 되지 않게
      (W.requestIdleCallback || setTimeout)(function () {
        if (!fq.length) { [].forEach.call(document.querySelectorAll(FP[i]), fpQ); i++; }
        var n = 0; while (fq.length && (n === 0 || n + fq[0][1] <= FPN)) { var x = fq.shift(); fpAdd(x[0]); n += x[1] || 1; }
        void document.body.offsetHeight; requestAnimationFrame(function () { setTimeout(function () { fpStep(i); }, 0); });
      }, { timeout: 1500 });
    };
    var on = function () { if (on.d) return; on.d = 1; B.quiet(function () { fpStep(0); }); };
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
    B.st = 1; B.why = why; aPick();
    var DS = String(B.d).split(",");
    DS.concat([B.a]).forEach(function (u) { document.head.appendChild(add("link", { rel: "preload", as: "script", href: u })); });
    var run = function () {
      if (run.d) return;
      if (document.readyState === "loading") return document.addEventListener("DOMContentLoaded", run);
      run.d = 1;
      try { performance.mark("zp-hyd0"); } catch (e) {}
      // 자료 조각들 → 앱 코드 순서대로(각 조각은 따로 실행 = 짧은 작업 여러 개)
      var ds = DS.map(function (u) { var x = add("script", { src: u }); x.async = false; return x; }), a = add("script", { src: B.a });
      a.async = false;
      a.onload = function () {
        // pre-adsense 5: 설치 앱은 a.js 실행을 몇 덩이로 나눠 돈다 — 마지막 덩이까지 끝난 뒤(ZP_aWait)에 '붙음'(웹은 ZP_aWait 없음 = 예전 그대로)
        if (W.ZP_aWait && !a.w8) { a.w8 = 1; var once = function () { if (once.d) return; once.d = 1; a.onload(); }; W.ZP_aWait.then(once, once); setTimeout(once, 20000); return; }
        // 확장 모듈 init(setTimeout 0)들이 먼저 돌고 난 다음
        setTimeout(function () { requestAnimationFrame(function () { try { performance.mark("zp-hyd"); } catch (e) {} B.hyd = 1; H.classList.remove("zp-wait"); try { W.dispatchEvent(new Event("zp:hydrated")); } catch (e) {} setTimeout(B.font, 300); }); }, 60);
      };
      a.onerror = function () { B.st = 0; H.classList.remove("zp-wait"); try { W.ZP_cover && W.ZP_cover(); } catch (e) {} };   // 6라운드: 앱 코드를 못 받으면 설치 앱 시작 덮개도 바로 걷음
      ds.forEach(function (x) { x.onerror = function () { try { W.ZP_cover && W.ZP_cover(); } catch (e) {} }; });
      ds.forEach(function (x) { document.body.appendChild(x); }); document.body.appendChild(a);
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
  // 첫 화면 섬이 그대로 그릴 수 있는 조건(금액이 막대 칸 · 전세 끼고/대출 끼고 기본 기준)이면 전체 앱을 바로 받지 않는다(19차 · 첫 화면 JS를 섬 하나로)
  var islOk = function (qs) {
    try {
      var p = new URLSearchParams(qs || ""), m = p.get("mode"), b = p.get("basis");
      if (["homes", "first", "unit", "inc", "income", "kind", "jr", "fund"].some(function (k) { return p.has(k); })) return false;
      if (m && m !== "jeonse" && m !== "loan") return false;
      if (b && b !== (m === "loan" ? "now" : "total")) return false;
      if (!p.has("cash")) return true;
      var c = +p.get("cash"), e = 1e-6;
      return c >= 0.5 && c <= 15 && (c < 2 ? Math.abs(c * 10 - Math.round(c * 10)) < e : c < 10 ? Math.abs(c * 2 - Math.round(c * 2)) < e : Math.abs(c - Math.round(c)) < e);
    } catch (e) { return false; }
  };
  var now = "";
  try {
    var q = window.ZP_CQ || "", fav = ls("jg-fav"), so = ls("emr.sort");   // 사이클 3: 조건은 # 뒤·ZP_CQ(주소 ?에는 없음)
    if (ls("zp_full") === "1") now = "flag";
    else if (location.hash.length > 1) now = "hash";
    else if ((/[?&](cash|mode|homes|first|unit|inc|income|basis|kind|fund|jr)=/.test(q) || ls("jg-cond")) && !islOk(/[?&](cash|mode|fund|inc|income)=/.test(q) ? q : ls("jg-cond") || "")) now = "cond";
    else if (so && so !== "fit") now = "sort";
    else if (fav && fav !== "[]") now = "pins";
    else if (navigator.serviceWorker && navigator.serviceWorker.controller) now = "sw";
  } catch (e) { now = "err"; }
  B.now = now;
  var c = navigator.connection, fast = !!(c && c.effectiveType === "4g" && c.rtt && c.rtt < 150 && !c.saveData) && ls("zp_slow") !== "1";
  B.fast = fast;
  if (fast || now === "sw") B.font();
  if (now) B.full(now);
  // 손대지 않아도: 첫 화면이 다 뜬 뒤 브라우저가 한가할 때 전체 앱(지도 포함)을 붙인다 — 느린 연결은 조금 더 기다렸다가
  else W.addEventListener("load", function () { setTimeout(function () { (W.requestIdleCallback || setTimeout)(function () { B.full("idle"); }, { timeout: fast ? 2000 : 4000 }); }, fast ? 0 : 2500); });
})();
