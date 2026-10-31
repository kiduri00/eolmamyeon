/* 홈 첫 화면 강점 노출(사이클 4 D1) — 첫 화면 섬(h.js)과 전체 앱(a.js)이 같은 이 코드를 쓴다(먼저 실린 쪽 하나만 살아 있음).
   빌드(tools/build.py · tools/hm_map.py)도 기본 금액의 첫 페인트를 같은 규칙으로 HTML에 넣는다 — 세 곳이 같은 글·같은 자리(레이아웃 밀림 없음).
   · ZP_HM.paint(cnt, sel) : 미니 서울 지도. cnt = {구 이름: 갈 수 있는 곳 수}(앱 ZP_simple.guCounts · 섬은 미리 뜬 같은 판정) · sel = 고른 구
     c4 최종: 지도 서울 줌과 같은 표기 — 구 채움 2단계(있음 남색 · 없음 옅게 · CSS) · '✓ 은평 8' 태그 → 자리가 없으면 노란 숫자 원(1곳 이상인 구만 · 많은 구가 먼저 자리).
   · ZP_HM.next(up, f1, n1) : '다음 문턱' 줄 HTML. up = {d: 더 넣는 돈(억), c: 그 금액, n: 그 금액의 곳 수} 또는 null · f1 = 다른 사는 방식(gap|cash) · n1 = 그 방식의 곳 수
   숫자는 여기서 세지 않는다(모두 앱의 판정 함수 countAt·guCounts 또는 그 값을 빌드 때 뜬 것). 지도 엔진·타일 없음. */
(function () {
  if (window.ZP_HM) return;
  var D = document, key = "";
  var bk = function (n) { return n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0; };
  var DT = { 0.5: "5,000만", 1: "1억", 1.5: "1.5억", 2: "2억", 3: "3억", 5: "5억" };
  var fmt = function (n) { return Number(n).toLocaleString("ko-KR"); };
  // c4 최종: 지도 서울 줌(D+ · ghost.js placeMx)과 같은 표기 — '✓ 은평 8' 태그(노란 체크 + 남색 태그) · 자리가 없으면 노란 숫자 원 · 그래도 없으면 가장 덜 겹치는 둘레(숫자는 절대 잃지 않음).
  //   자리는 픽셀로 잡는다(미니 지도 칸 폭 PW · 기본 290 = 최대 폭) · 빌드 첫 페인트(tools/hm_map.py place)와 같은 식
  var CK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var tw = function (t, px) { var w = 0; t = String(t); for (var i = 0; i < t.length; i++) { var c = t.charCodeAt(i); w += c >= 0xac00 && c <= 0xd7a3 ? 0.95 : c === 32 ? 0.28 : c >= 48 && c <= 57 ? 0.6 : 0.62; } return Math.ceil(w * px); };
  var sn = function (g) { return g.length > 2 ? g.replace(/구$/, "") : g; };
  var NU = [[0, 0], [0, -12], [0, 12], [-16, 0], [16, 0], [-12, -10], [12, -10], [-12, 10], [12, 10]];
  var NU3 = NU.concat([16, 24].reduce(function (a, r) { for (var k = 0; k < 8; k++) a.push([Math.round(r * Math.cos(k * Math.PI / 4)), Math.round(r * Math.sin(k * Math.PI / 4))]); return a; }, []));
  var NU4 = NU3.concat([32, 40].reduce(function (a, r) { for (var k = 0; k < 8; k++) a.push([Math.round(r * Math.cos(k * Math.PI / 4)), Math.round(r * Math.sin(k * Math.PI / 4))]); return a; }, []));
  // L = [[구, x%, y%, 곳 수]…](곳 수 많은 구부터) → [[구, left%, top%, 'tag'|'num']…]
  function place(PW, PH, L, TB) {
    TB = TB || 1; var put = [], out = [], G = 2;
    var hit = function (a, b) { return a[0] < b[2] + G && b[0] < a[2] + G && a[1] < b[3] + G && b[1] < a[3] + G; };
    var inb = function (b) { return b[0] >= 2 && b[2] <= PW - 2 && b[1] >= 2 && b[3] <= PH - 2; };
    L.forEach(function (p) {
      var x0 = (p[1] / 100) * PW, y0 = (p[2] / 100) * PH, got = null, k, j;
      var S = [[Math.ceil((tw(sn(p[0]) + " " + p[3], 12) + 15 + 3 + 11) * 1.04 * TB), Math.ceil(24 * TB), NU, "tag"], [Math.ceil((tw(sn(p[0]) + " " + p[3], 11) + 13 + 2 + 8) * 1.04 * TB), Math.ceil(22 * TB), NU, "tagx"], [Math.ceil(Math.max(22, tw(String(p[3]), 12.5) + 8) * TB) + 4, Math.ceil(22 * TB) + 4, NU3, "num"]];
      for (k = 0; k < S.length && !got; k++) for (j = 0; j < S[k][2].length && !got; j++) {
        var x = x0 + S[k][2][j][0], y = y0 + S[k][2][j][1], b = [x - S[k][0] / 2, y - S[k][1] / 2, x + S[k][0] / 2, y + S[k][1] / 2];
        if (inb(b) && !put.some(function (q) { return hit(q, b); })) got = [x, y, b, S[k][3]];
      }
      if (!got) {   // 숫자 원을 가장 덜 겹치는 둘레 자리에(칸 안으로 당김)
        var w = S[2][0], h = S[2][1], best = null;
        NU4.forEach(function (d, i) { var x = Math.max(2 + w / 2, Math.min(PW - 2 - w / 2, x0 + d[0])), y = Math.max(2 + h / 2, Math.min(PH - 2 - h / 2, y0 + d[1])), b = [x - w / 2, y - h / 2, x + w / 2, y + h / 2], a = i * 0.01; put.forEach(function (q) { var ox = Math.min(q[2], b[2]) - Math.max(q[0], b[0]), oy = Math.min(q[3], b[3]) - Math.max(q[1], b[1]); if (ox > 0 && oy > 0) a += ox * oy; }); if (!best || a < best[3]) best = [x, y, b, a]; });
        got = [best[0], best[1], best[2], "num"];
      }
      put.push(got[2]);
      out.push([p[0], ((got[0] / PW) * 100).toFixed(2) + "%", ((got[1] / PH) * 100).toFixed(2) + "%", got[3]]);
    });
    return out;
  }
  var inner = function (gu, n, k) { return k === "num" ? '<span class="hm-in">' + fmt(n) + "</span>" : '<span class="hm-in"><i class="zg-ck">' + CK + '</i><span class="gn">' + sn(gu) + '</span> <b class="mn">' + fmt(n) + "</b></span>"; };
  function paint(cnt, sel) {
    var box = D.getElementById("hmMw"); if (!box) return;
    cnt = cnt || {};
    var big = D.documentElement.classList.contains("t-big"), PW = box.clientWidth || 290;
    var k = JSON.stringify(cnt) + "|" + (sel || "") + "|" + PW + (big ? "b" : "");
    if (k === key) return; key = k;
    var gs = box.querySelectorAll(".hm-g");
    for (var i = 0; i < gs.length; i++) { var g = gs[i], n = cnt[g.getAttribute("data-gu")] || 0, v = String(bk(n)); if (g.getAttribute("data-b") !== v) g.setAttribute("data-b", v); g.classList.toggle("sel", g.getAttribute("data-gu") === sel); }
    var bs = [].slice.call(box.querySelectorAll(".hm-gb")), on = [];
    bs.forEach(function (b) {
      var gu = b.getAttribute("data-gu"), n = cnt[gu] || 0;
      if (b.hidden !== !n) b.hidden = !n;
      if (!n) return;
      var al = gu + " 갈 수 있는 곳 " + n + "곳, 그 구 지도 보기"; if (b.getAttribute("aria-label") !== al) b.setAttribute("aria-label", al);
      b.classList.toggle("is-picked", gu === sel);
      on.push(b);
    });
    on.sort(function (a, b) { return (cnt[b.getAttribute("data-gu")] || 0) - (cnt[a.getAttribute("data-gu")] || 0); });
    var vb = (box.querySelector("svg").getAttribute("viewBox") || "0 0 100 100").split(" "), PH = PW * (+vb[3] / +vb[2]);
    var P = place(PW, PH, on.map(function (b) { var gu = b.getAttribute("data-gu"); return [gu, +b.getAttribute("data-x"), +b.getAttribute("data-y"), cnt[gu]]; }), big ? 1.3 : 1);
    P.forEach(function (p, i) {
      var b = on[i], h = inner(p[0], cnt[p[0]], p[3]);
      if (b.style.left !== p[1]) b.style.left = p[1]; if (b.style.top !== p[2]) b.style.top = p[2];
      b.classList.add("hm-t"); b.classList.toggle("hm-n", p[3] === "num"); b.classList.toggle("hm-x", p[3] === "tagx");
      if (b.innerHTML !== h) b.innerHTML = h;
    });
  }
  function next(up, f1, n1) {
    var a = up && DT[up.d] ? '<button type="button" class="hm-nb" data-hup="' + up.c + '">+' + DT[up.d] + "이면 <b>" + fmt(up.n) + "곳</b></button>" : "";
    var b = n1 != null ? '<button type="button" class="hm-nb" data-hmode="' + f1 + '">' + (f1 === "cash" ? "대출 끼고" : "전세 끼고") + "면 <b>" + fmt(n1) + "곳</b></button>" : "";
    return a + (a && b ? '<i aria-hidden="true">·</i>' : "") + b;
  }
  window.ZP_HM = { paint: paint, next: next, DT: DT, reset: function () { key = ""; } };
})();
