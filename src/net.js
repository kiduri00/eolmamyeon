/* 22차: 앱 묶음 맨 앞(tools/build.py) — 모든 앱 코드보다 먼저.
   1) 자료 받기(같은 출처 GET /data/ · /api/v1/ · /b/): 응답 머리가 20초 안에 안 오면 끊고, 연결이 끊겼거나(네트워크 오류) 서버가 잠깐 아플 때(5xx·408·429)
      0.8초 · 2.4초 쉬고 두 번까지 다시 받는다. 받는 쪽 코드(loadTx 등)는 그대로 — 한 번 실패로 그 자료가 세션 내내 비는 일을 줄인다.
   2) 잡히지 않은 오류: 콘솔에 남기고, 화면이 깨진 채로 두지 않게 작은 알림 '화면 일부를 그리지 못했어요 · 다시 시도'(1분에 한 번 · 우리 파일에서 난 오류만). */
(function () {
  "use strict";
  var W = window;
  if (W.__zpNet) return; W.__zpNet = 1;
  var F = W.fetch && W.fetch.bind(W);
  var RX = /^\/(data|api\/v1|b)\//;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  if (F && W.AbortController) {
    W.fetch = function (input, init) {
      // 글 주소로 부른 GET만(Request 객체 · 다른 방식 · 호출자가 끊기 신호를 준 경우는 그대로)
      if (typeof input !== "string" && !(W.URL && input instanceof URL)) return F(input, init);
      var u, m = (init && init.method) || "GET";
      try { u = new URL(String(input), location.href); } catch (e) { return F(input, init); }
      if (u.origin !== location.origin || !RX.test(u.pathname) || String(m).toUpperCase() !== "GET" || (init && init.signal)) return F(input, init);
      var tries = 0;
      var one = function () {
        var ac = new AbortController(), t = setTimeout(function () { ac.abort(); }, 20000);
        var o = {}; if (init) for (var k in init) o[k] = init[k]; o.signal = ac.signal;
        return F(input, o).then(function (r) {
          clearTimeout(t);
          if ((r.status >= 500 || r.status === 408 || r.status === 429) && tries < 2) { tries++; return sleep(tries === 1 ? 800 : 2400).then(one); }
          return r;
        }, function (e) {
          clearTimeout(t);
          if (tries < 2 && navigator.onLine !== false) { tries++; return sleep(tries === 1 ? 800 : 2400).then(one); }
          throw e;
        });
      };
      return one();
    };
  }
  // ---- 잡히지 않은 오류 → 콘솔 + 작은 '다시 시도' 알림 ----
  var last = 0, box = null;
  var ours = function (src) { return !src || src.indexOf(location.origin) === 0 || /^\/b\//.test(src); };
  var show = function () {
    var now = Date.now(); if (now - last < 60000 || !document.body) return; last = now;
    if (!box) {
      box = document.createElement("div"); box.id = "zpErr"; box.className = "zp-err"; box.setAttribute("role", "alert");
      box.innerHTML = '<span>화면 일부를 그리지 못했어요</span><button type="button" data-r="1">다시 시도</button><button type="button" data-x="1" aria-label="닫기">×</button>';
      box.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("button"); if (!b) return;
        box.classList.remove("on");
        if (b.getAttribute("data-r")) { try { location.reload(); } catch (x) {} }
      });
      document.body.appendChild(box);
    }
    box.classList.add("on");
    clearTimeout(show.t); show.t = setTimeout(function () { box.classList.remove("on"); }, 8000);
  };
  W.ZP_err = { show: show, n: 0 };
  W.addEventListener("error", function (e) {
    if (!e || e.target !== W && e.target && e.target.tagName) return;   // 그림·스크립트 못 받음은 각자 처리
    var src = e.filename || "";
    if (!ours(src) || !e.error) return;
    W.ZP_err.n++;
    try { console.warn("[__BRAND__] 처리하지 못한 오류:", e.error); } catch (x) {}
    show();
  });
  W.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    if (!r || r.name === "AbortError" || !(r instanceof Error) || !/TypeError|ReferenceError|RangeError|SyntaxError/.test(r.name)) return;
    var st = String(r.stack || "");
    if (st && st.indexOf(location.origin) < 0) return;
    W.ZP_err.n++;
    try { console.warn("[__BRAND__] 처리하지 못한 약속 오류:", r); } catch (x) {}
    show();
  });
})();
