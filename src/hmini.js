/* 홈 첫 화면 강점 노출(사이클 4 D1) — 첫 화면 섬(h.js)과 전체 앱(a.js)이 같은 이 코드를 쓴다(먼저 실린 쪽 하나만 살아 있음).
   빌드(tools/build.py · tools/hm_map.py)도 기본 금액의 첫 페인트를 같은 규칙으로 HTML에 넣는다 — 세 곳이 같은 글·같은 자리(레이아웃 밀림 없음).
   · ZP_HM.paint(cnt, sel) : 미니 서울 지도. cnt = {구 이름: 갈 수 있는 곳 수}(앱 ZP_simple.guCounts · 섬은 미리 뜬 같은 판정) · sel = 고른 구
     채움 4단계(SPEC C1): 0 · 1~2 · 3~5 · 6곳 이상. 숫자 단추는 1곳 이상인 구만. 겹치면 비켜 선다(많은 구가 먼저 자리) — 자리는 지도 칸 비율로만 정해 화면 폭과 무관.
   · ZP_HM.next(up, f1, n1) : '다음 문턱' 줄 HTML. up = {d: 더 넣는 돈(억), c: 그 금액, n: 그 금액의 곳 수} 또는 null · f1 = 다른 사는 방식(gap|cash) · n1 = 그 방식의 곳 수
   숫자는 여기서 세지 않는다(모두 앱의 판정 함수 countAt·guCounts 또는 그 값을 빌드 때 뜬 것). 지도 엔진·타일 없음. */
(function () {
  if (window.ZP_HM) return;
  var D = document, key = "";
  var bk = function (n) { return n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0; };
  var DT = { 0.5: "5,000만", 1: "1억", 1.5: "1.5억", 2: "2억", 3: "3억", 5: "5억" };
  var fmt = function (n) { return Number(n).toLocaleString("ko-KR"); };
  // 단추 자리(지도 칸 단위): 기본 = 구 면적 중심. 이미 선 단추와 겹치면 위·아래·오른쪽·왼쪽·대각으로 비켜 본다(tools/hm_map.py place와 같은 식)
  var OFF = [[0, 0], [0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1], [0, -1.6], [0, 1.6], [1.6, 0], [-1.6, 0]];
  function place(W, H, L) {
    var put = [], r = W * 0.044, step = r * 1.45, out = [];
    L.forEach(function (p) {
      var x0 = (p[1] / 100) * W, y0 = (p[2] / 100) * H, best = null;
      for (var i = 0; i < OFF.length; i++) {
        var x = x0 + OFF[i][0] * step, y = y0 + OFF[i][1] * step;
        if (x < r || x > W - r || y < r || y > H - r) continue;
        var ok = true;
        for (var j = 0; j < put.length; j++) { var dx = put[j][0] - x, dy = put[j][1] - y; if (dx * dx + dy * dy < 4.4 * r * r) { ok = false; break; } }
        if (ok) { best = [x, y]; break; }
      }
      if (!best) best = [x0, y0];
      put.push(best);
      out.push([p[0], ((best[0] / W) * 100).toFixed(2) + "%", ((best[1] / H) * 100).toFixed(2) + "%"]);
    });
    return out;
  }
  function paint(cnt, sel) {
    var box = D.getElementById("hmMw"); if (!box) return;
    cnt = cnt || {};
    var k = JSON.stringify(cnt) + "|" + (sel || "");
    if (k === key) return; key = k;
    var gs = box.querySelectorAll(".hm-g");
    for (var i = 0; i < gs.length; i++) { var g = gs[i], n = cnt[g.getAttribute("data-gu")] || 0, v = String(bk(n)); if (g.getAttribute("data-b") !== v) g.setAttribute("data-b", v); g.classList.toggle("sel", g.getAttribute("data-gu") === sel); }
    var bs = [].slice.call(box.querySelectorAll(".hm-gb")), on = [];
    bs.forEach(function (b) {
      var gu = b.getAttribute("data-gu"), n = cnt[gu] || 0;
      if (b.hidden !== !n) b.hidden = !n;
      if (!n) return;
      var t = String(n); if (b.textContent !== t) b.textContent = t;
      var al = gu + " 갈 수 있는 곳 " + n + "곳, 그 구 지도 보기"; if (b.getAttribute("aria-label") !== al) b.setAttribute("aria-label", al);
      b.classList.toggle("is-picked", gu === sel);
      on.push(b);
    });
    on.sort(function (a, b) { return (cnt[b.getAttribute("data-gu")] || 0) - (cnt[a.getAttribute("data-gu")] || 0); });
    var vb = (box.querySelector("svg").getAttribute("viewBox") || "0 0 100 100").split(" ");
    var P = place(+vb[2], +vb[3], on.map(function (b) { return [b, +b.getAttribute("data-x"), +b.getAttribute("data-y")]; }));
    P.forEach(function (p) { if (p[0].style.left !== p[1]) p[0].style.left = p[1]; if (p[0].style.top !== p[2]) p[0].style.top = p[2]; });
  }
  function next(up, f1, n1) {
    var a = up && DT[up.d] ? '<button type="button" class="hm-nb" data-hup="' + up.c + '">+' + DT[up.d] + "이면 <b>" + fmt(up.n) + "곳</b></button>" : "";
    var b = n1 != null ? '<button type="button" class="hm-nb" data-hmode="' + f1 + '">' + (f1 === "cash" ? "대출 끼고" : "전세 끼고") + "면 <b>" + fmt(n1) + "곳</b></button>" : "";
    return a + (a && b ? '<i aria-hidden="true">·</i>' : "") + b;
  }
  window.ZP_HM = { paint: paint, next: next, DT: DT, reset: function () { key = ""; } };
})();
