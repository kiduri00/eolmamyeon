/* 지도 자리 그림(ghost) — 실제 지도(MapLibre)가 붙기 전에 지도 칸에 보이는 가벼운 SVG/DOM 지도(19차).
   실제 지도와 같은 것만 쓴다: 같은 투영(웹 메르카토르 512 타일) · 같은 첫 카메라(ZP_G.cam) · 같은 구 묶음 자리 잡기(ZP_G.place)
   · 같은 범례·'+N곳 N개 구' 칩·확대 버튼 마크업 → 실제 지도가 붙어도 구 묶음이 제자리에 그대로 있고 바탕(타일)만 서서히 나타난다.
   첫 화면 섬(h.js)과 전체 앱(a.js)이 같은 이 코드를 쓴다(먼저 실린 쪽 하나만 살아 있음). 경계 자료는 빌드가 넣는다(tools/ghost_geo.py). */
(function () {
  if (window.ZP_G) return;
  var GD = /*GHOST*/ null;
  if (GD && !GD.gp && GD.gpl) GD.gp = GD.gpl.join("");
  var W = window, Dc = document;
  var CORE = [[126.882, 37.494], [127.118, 37.562]], SEOUL_BB = [[126.76, 37.413], [127.185, 37.716]];
  var MINZ = 8.8, MAXZ = 17.6;
  var mx = function (l) { return (l + 180) / 360; };
  var my = function (la) { var s = Math.sin((la * Math.PI) / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
  var lx = function (x) { return x * 360 - 180; };
  var ly = function (y) { var t = Math.PI * (1 - 2 * y); return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(t) - Math.exp(-t))); };
  // 글자 폭 어림(글꼴이 아직 안 와도 같은 값 — 실제 지도와 자리 그림이 같은 크기 원을 쓰게)
  // 사이클 4 통합: 큰 글씨(안드로이드 글꼴 크게 · text-size-adjust) 배율 — 앱은 10_tapp bigCheck가 html.t-big을 붙이지만 웹은 아무도 안 붙여
  //   웹 폰 큰 글씨에서 서울 라벨 글자가 상자를 넘쳐 겹치던 것. 100px 글자의 계산 크기·실제 폭으로 한 번 재고(1.15배 넘으면) html.t-big
  function bigK() {
    var H0 = Dc.documentElement;
    if (bigK.v == null) {
      bigK.v = 1;
      try { var p = Dc.createElement("i"); p.setAttribute("aria-hidden", "true"); p.style.cssText = "position:absolute;left:-999px;top:0;visibility:hidden;white-space:nowrap;font-size:100px;line-height:1;font-style:normal"; p.textContent = "가가가가"; (Dc.body || H0).appendChild(p); var k1 = (parseFloat(W.getComputedStyle(p).fontSize) || 100) / 100, k2 = p.getBoundingClientRect().width / 400; p.remove(); bigK.v = Math.max(k1, k2 >= 1.15 ? k2 : 1); } catch (e) {}
      if (bigK.v >= 1.15) H0.classList.add("t-big");
    }
    return H0.classList.contains("t-big") ? Math.max(1.3, bigK.v) : 1;
  }
  function tw(t, px) { var w = 0; t = String(t); for (var i = 0; i < t.length; i++) { var c = t.charCodeAt(i); w += c >= 0xac00 && c <= 0xd7a3 ? 0.95 : c === 32 ? 0.28 : c >= 48 && c <= 57 ? 0.6 : 0.62; } return Math.ceil(w * px); }
  // 첫 화면 범위: 서울 가운데(CORE) + 갈 수 있는 곳 + 그 구 묶음 자리(폰) · PC는 서울 전체(10_lmap.js affBB와 같은 규칙)
  function bb(okLL, cnt, phone) {
    var a = CORE[0][0], b = CORE[0][1], c = CORE[1][0], d = CORE[1][1];
    var cl = Dc.documentElement.classList; if (cl.contains("mx") && cl.contains("s-full")) return [SEOUL_BB[0].slice(), SEOUL_BB[1].slice()];   // 사이클 4(M): 새 전체 지도 서울 단계 = 서울 전체(구 25개 한 줄 라벨)
    var P = okLL || [];
    if (phone && P.length && appFull()) { a = c = P[0][1]; b = d = P[0][0]; }   // 앱 지도 탭: 서울 가운데 대신 갈 수 있는 곳 전체 상자(+ 그 구 묶음 자리)
    if (P.length) {
      var la = P.map(function (x) { return x[0]; }).sort(function (x, y) { return x - y; }), lo = P.map(function (x) { return x[1]; }).sort(function (x, y) { return x - y; });
      var q = function (A, f) { return A[Math.max(0, Math.min(A.length - 1, Math.round((A.length - 1) * f)))]; };
      var t = P.length >= 8 && !phone ? 0.04 : 0;
      a = Math.min(a, q(lo, t)); c = Math.max(c, q(lo, 1 - t)); b = Math.min(b, q(la, t)); d = Math.max(d, q(la, 1 - t));
    }
    if (phone && GD) GD.gu.forEach(function (g) { if (!cnt || !cnt[g[0]]) return; a = Math.min(a, g[1]); c = Math.max(c, g[1]); b = Math.min(b, g[2]); d = Math.max(d, g[2]); });
    if (!phone) { a = Math.min(a, SEOUL_BB[0][0]); b = Math.min(b, SEOUL_BB[0][1]); c = Math.max(c, SEOUL_BB[1][0]); d = Math.max(d, SEOUL_BB[1][1]); }
    return [[a, b], [c, d]];
  }
  // MapLibre cameraForBounds(기울기 0) + 10_lmap.js fitTo의 '세로로 긴 폰 화면이면 조금 더 당김'을 그대로
  function cam(B, w, h, pad, phone, maxZ) {
    var x0 = mx(B[0][0]), x1 = mx(B[1][0]), y0 = my(B[1][1]), y1 = my(B[0][1]);
    var sx = (w - pad.left - pad.right) / ((x1 - x0) * 512), sy = (h - pad.top - pad.bottom) / ((y1 - y0) * 512);
    if (!(sx > 0 && sy > 0)) return null;
    var z = Math.min(Math.log2(Math.min(sx, sy)), maxZ);
    var ws = 512 * Math.pow(2, z), ox = (pad.left - pad.right) / 2, oy = (pad.top - pad.bottom) / 2;
    var cx = (x0 + x1) / 2 - ox / ws, cy = (y0 + y1) / 2 - oy / ws;
    var H = h - pad.top - pad.bottom, hh = (y1 - y0) * ws;
    if (phone && !appFull() && H > w * 1.15 && hh > 0 && H / hh > 1.3) z += Math.min(0.45, Math.log2(H / hh) * 0.5);
    z = Math.max(MINZ, Math.min(MAXZ, Math.min(z, maxZ + 0.75)));
    return { c: [lx(cx), ly(cy)], z: z };
  }
  function proj(C, w, h) { var ws = 512 * Math.pow(2, C.z), cx = mx(C.c[0]), cy = my(C.c[1]); return function (ll) { return { x: (mx(ll[0]) - cx) * ws + w / 2, y: (my(ll[1]) - cy) * ws + h / 2 }; }; }
  // 구 하나에 맞춘 카메라(경계 상자 전체가 보이게 · 폰 당김 없음) — 자리 그림에서 구를 누를 때와 실제 지도 fitGu가 같은 함수(20차 G4)
  function guIdx(n) { if (!GD) return -1; for (var i = 0; i < GD.gu.length; i++) if (GD.gu[i][0] === n) return i; return -1; }
  // 23차: pts(그 구의 갈 수 있는 곳 [위도, 경도, 구] — 자리 그림 st.ok · 실제 지도 fitGu가 같은 목록)가 있으면 그 곳들이 모인 상자에 맞춘다
  // (구 경계 전체에 맞추면 폰에서 줌 11 → 알약이 한데 뭉쳐 '+N' 하나가 되던 것). 알약은 점 위로 서므로 위·양옆을 알약 자리만큼 더 비운다
  function guCam(n, w, h, pad, pts) {
    var i = guIdx(n), g = i >= 0 ? GD.gu[i] : null; if (!g || g.length < 7) return null;
    var P = (pts || []).filter(function (x) { return x && x[2] === n && isFinite(x[0]) && isFinite(x[1]); });
    if (P.length && phoneQ()) {   // 폰만(PC 큰 지도는 구 경계 전체가 보이는 예전 맞춤 그대로)
      var a = 999, b = 999, c = -999, d = -999;
      P.forEach(function (x) { a = Math.min(a, x[1]); c = Math.max(c, x[1]); b = Math.min(b, x[0]); d = Math.max(d, x[0]); });
      var ex = 0.0015;
      var pp = { top: pad.top + 32, bottom: pad.bottom + 4, left: pad.left + 30, right: pad.right + 30 };
      var B = [[a - ex, b - ex], [c + ex, d + ex]], C1 = cam(B, w, h, pp, false, 13.6);
      if (C1) {
        if (phoneQ() && C1.z < 11) C1.z = 11;
        // 남는 세로 자리가 있으면 곳들을 아래쪽에 붙인다 — 위 두 모서리의 떠 있는 것(왼쪽 '← 서울 전체' 막대 · 오른쪽 겹쳐 보기 레일) 밑에 가장 싼 곳이 깔리지 않게
        var ws = 512 * Math.pow(2, C1.z), hh = (my(b - ex) - my(d + ex)) * ws, sl = h - pp.top - pp.bottom - hh;
        if (sl > 2) C1.c = [C1.c[0], ly(my(C1.c[1]) - sl / 2 / ws)];
        // 그래도 오른쪽 위 레일 밑에 깔린 곳이 있으면: 아래로 밀 자리가 있으면 밀고, 없으면 조금씩 줄여(줌 −0.15) 다시 — 자리 그림·실제 지도가 같은 DOM(레일)을 재므로 같은 카메라
        var ro = railBox(w);
        for (var it = 0; ro && it < 10; it++) {
          var PJ = proj(C1, w, h), qs = P.map(function (x) { return PJ([x[1], x[0]]); }), dy = 0, lo = -1e9;
          qs.forEach(function (q) { lo = Math.max(lo, q.y); if (q.x > ro[0] - 14 && q.y < ro[3] + 4) dy = Math.max(dy, ro[3] + 4 - q.y); });
          if (!dy) break;
          ws = 512 * Math.pow(2, C1.z);
          if (lo + dy <= h - pp.bottom + 4) { C1.c = [C1.c[0], ly(my(C1.c[1]) - dy / ws)]; break; }
          var z2 = C1.z - 0.15; if (z2 < (phoneQ() ? 11 : 9)) break;
          C1 = { c: C1.c, z: z2 };
        }
        return C1;
      }
    }
    var C = cam([[g[3], g[4]], [g[5], g[6]]], w, h, pad, false, 14); if (C && phoneQ() && C.z < 11) C.z = 11; return C;
  }
  // 지도 칸 안 오른쪽 위 겹쳐 보기 레일 상자 [왼, 위, 오른, 아래](지도 칸 기준 · 없으면 null) — 폰에서만
  function railBox(w) {
    try {
      if (!phoneQ()) return null;
      var mb = Dc.getElementById("mapbox"), rl = mb && mb.querySelector(".s-rail");
      if (!rl || !rl.offsetWidth) return null;
      var a = mb.getBoundingClientRect(), b = rl.getBoundingClientRect(), ox = (a.width - w) / 2;
      return [b.left - a.left - ox, b.top - a.top, b.right - a.left - ox, b.bottom - a.top];
    } catch (e) { return null; }
  }
  function guPad(P, phone) {
    var top = P.top + (phone ? 6 : 18);
    // 지도 위에 떠 있는 '← 서울 전체 | 구 이름' 막대 밑으로 경계 윗부분이 숨지 않게
    try { var mb = Dc.getElementById("mapBar"); if (mb && !mb.hidden && mb.offsetHeight && getComputedStyle(mb).position === "absolute") top = Math.max(top, mb.offsetTop + mb.offsetHeight + 8); } catch (e) {}
    return { top: top, bottom: P.bottom + (phone ? 52 : 18), left: phone ? 16 : 30, right: phone ? 16 : Math.max(30, P.right) };
  }
  // 8차: 구 경계 고리(GD.gpl 경로 → 웹 메르카토르 0~1 좌표) — 묶음 자리 후보가 다른 구 땅 위인지 점-다각형으로 본다(한 번만 읽음)
  var RINGS = null;
  function rings() {
    if (RINGS || !GD || !GD.gpl) return RINGS;
    RINGS = GD.gpl.map(function (d) {
      return d.split("M").filter(Boolean).map(function (sp) {
        var n = (sp.match(/-?\d+(\.\d+)?/g) || []).map(Number), x = n[0], y = n[1], R = [[(x + GD.o[0]) / GD.S, (y + GD.o[1]) / GD.S]];
        for (var i = 2; i + 1 < n.length; i += 2) { x += n[i]; y += n[i + 1]; R.push([(x + GD.o[0]) / GD.S, (y + GD.o[1]) / GD.S]); }
        return R;
      });
    });
    RINGS.forEach(function (RS) { var b = [9, 9, -9, -9]; RS.forEach(function (R) { R.forEach(function (p) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; }); }); RS.bb = b; });   // 구 상자로 먼저 거른다(끄는 동안에도 가볍게)
    return RINGS;
  }
  function inRings(RS, X, Y) { var c = false, b = RS.bb; if (b && (X < b[0] || X > b[2] || Y < b[1] || Y > b[3])) return false; RS.forEach(function (R) { for (var i = 0, j = R.length - 1; i < R.length; j = i++) { var a = R[i], b = R[j]; if ((a[1] > Y) !== (b[1] > Y) && X < ((b[0] - a[0]) * (Y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } }); return c; }
  var hit = function (a, b) { return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]; };
  // 23차: 묶음 색은 한 가지(중간 남색) — 곳 수는 숫자가 말한다. 범례에 없는 '진함 세 단계'를 없앰(뜻 모를 색 없음)
  var tier = function () { return 2; };
  // 구 묶음 자리 잡기(실제 지도 guLayout과 같은 함수): 겹치면 ① 둘레로 비켜 ② 작게 ③ 안 되면(또는 화면 밖) '+N곳' 칩으로
  var CC = { k: "", m: {}, n: 0 }, DPL = true;
  // 사이클 4 D+(SPEC J2-1 서울 줌): 새 전체 지도는 한 줄 태그 '✓ 은평 8' — 갈 수 있는 구는 숫자를 절대 잃지 않는다(물러남 4단계)
  //   ① 같은 태그(높이 28 · 13.5px · 체크 17)를 가운데 → 위아래 ±12 → 좌우 ±16 → 대각 ② 작은 태그(높이 24 · 12.5px · 체크 15) ③ 숫자 원(22px 노란 원 + 남색 숫자)
  //   ④ 구 중심에 숫자 원을 겹쳐서라도(force). 화면 밖 구만 '+N곳' 칩(left)으로. 갈 수 있는 곳 없이 조금 부족만 있는 구 = 테두리 태그 '동작 조금 부족 3'(자리 없으면 생략)
  var NUDGE = [[0, 0], [0, -12], [0, 12], [-16, 0], [16, 0], [-12, -10], [12, -10], [-12, 10], [12, 10]];
  // 숫자 원(③)은 작아서 한 겹 더 바깥(20·28px · 8방향)까지 본 뒤에야 겹쳐 놓는다(④)
  var NUDGE3 = NUDGE.concat([20, 28].reduce(function (a, r) { for (var k = 0; k < 8; k++) a.push([Math.round(r * Math.cos(k * Math.PI / 4)), Math.round(r * Math.sin(k * Math.PI / 4))]); return a; }, []));
  function placeMx(o) {
    var w = o.W, h = o.H, obs = o.obs || [], TB = bigK(), EX = 7, GAP = 3;
    var L = o.gus.slice().sort(function (a, b) { return (a.m == null ? 1e9 : a.m) - (b.m == null ? 1e9 : b.m) || b.c - a.c; });
    var placed = [], keep = [], left = [], steps = [0, 0, 0, 0, 0];
    var free = function (bx) { if (bx[0] < EX || bx[2] > w - EX || bx[1] < 2 || bx[3] > h - 2) return false; if (obs.some(function (q) { return hit(q, bx); })) return false; var gx = [bx[0] - GAP, bx[1] - GAP, bx[2] + GAP, bx[3] + GAP]; return !placed.some(function (p) { return hit(p, gx); }); };
    var sizeOf = function (g, k) {
      var l1 = g.c ? g.sn + " " + fmt(g.c) : g.sn + " 조금 부족 " + fmt(g.nr);
      if (k === 3) { var d = Math.ceil(Math.max(22, tw(fmt(g.c), 12.5) + 8) * TB); return { l1: l1, w: d, h: Math.ceil(22 * TB), bw: d + 4, bh: Math.ceil(22 * TB) + 4 }; }
      // c4 최종(ux_re 14 · 가능한 만큼 구 이름): 숫자 원으로 가기 전에 한 번 더 — 좁은 태그(11.5px · 체크 13 · 여백 좁게 · 높이 22)
      if (k === 2) { var w2 = Math.ceil((tw(l1, 11.5) + (g.c ? 13 + 3 : 0) + 10) * 1.04 * TB); return { l1: l1, w: w2, h: Math.ceil(22 * TB), bw: w2, bh: Math.ceil(22 * TB) }; }
      var fs = k ? 12.5 : 13.5, ck = g.c ? (k ? 15 : 17) + 4 : 0, ww = Math.ceil((tw(l1, fs) + ck + (k ? 14 : 18)) * 1.04 * TB), hh = Math.ceil((k ? 24 : 28) * TB);
      return { l1: l1, w: ww, h: hh, bw: ww, bh: hh };
    };
    var full = mxf();
    // c4 최종: 폰에서 태그·숫자 원(겹쳐 놓기 ④ 말고)의 가운데 점은 제 구 땅이나 서울 밖에만(이웃 구 땅 위에 서던 것 · 옛 place의 okAt과 같은 고리)
    var RS = o.phone ? rings() : null, P1 = o.proj([126.9, 37.5]), P2 = o.proj([127.1, 37.6]), X1 = mx(126.9), Y1 = my(37.5), KX = (P2.x - P1.x) / (mx(127.1) - X1), KY = (P2.y - P1.y) / (my(37.6) - Y1), GI = {};
    if (GD) GD.gu.forEach(function (g, i) { GI[g[0]] = i; });
    var ANC = o.phone ? o.gus.map(function (g) { return { n: g.n, q: o.proj(g.ll) }; }) : [];
    var own = function (n, x, y) {
      if (!RS || !KX || !KY) return true; var X = X1 + (x - P1.x) / KX, Y = Y1 + (y - P1.y) / KY, me = null;
      for (var i = 0; i < RS.length; i++) if (inRings(RS[i], X, Y)) { if (i !== GI[n]) return false; break; }
      // 옛 place의 mine과 같은 잣대: 비킨 자리가 다른 구 중심에 (10px 넘게) 더 가깝지 않게
      ANC.forEach(function (a) { if (a.n === n) me = a.q; }); if (!me) return true; var d0 = Math.hypot(x - me.x, y - me.y);
      return ANC.every(function (a) { return a.n === n || d0 <= Math.hypot(x - a.q.x, y - a.q.y) + 10; });
    };
    // 사이클 5 통합(130% 서울 줌 이름 없는 숫자 원): 앞 구가 큰 태그로 자리를 다 쓰면 뒤 구가 숫자 원만 남는다 → 갈 수 있는 구의 시작 단계를 ①·②·좁은 태그로 바꿔 다시 놓아 보고
    //   이름 없는 숫자 원(③·④)이 가장 적은 배치를 쓴다(같으면 앞 배치 = 큰 태그). 숫자는 어느 배치에서도 잃지 않는다(④ 그대로)
    var best = null;
    for (var k0 = 0; k0 < 3; k0++) {
      if (best && (!(best.steps[3] + best.steps[4]) || TB < 1.05)) break;   // 다시 놓기는 큰 글씨(130% 등)만 — 100%에서는 첫 페인트 전 자리 잡기 비용(#map LCP)이 이득(이름 없는 원 5→4)보다 커서
      placed = []; keep = []; left = []; steps = [0, 0, 0, 0, 0];
      pass(k0);
      var nn = steps[3] + steps[4];
      if (!best || nn < best.nn) best = { nn: nn, placed: placed, keep: keep, left: left, steps: steps };
    }
    placed = best.placed; keep = best.keep; left = best.left; steps = best.steps;
    function pass(k0) { L.forEach(function (g0) {
      if (!g0.c && !(full && g0.nr)) return;
      var g = { n: g0.n, ll: g0.ll, c: g0.c, m: g0.m, nr: g0.c ? 0 : g0.nr || 0 }, q = o.proj(g.ll);
      g.sn = g.n.length > 2 ? g.n.replace(/구$/, "") : g.n;
      if (q.x < -8 || q.x > w + 8 || q.y < -8 || q.y > h + 8) { if (g.c) left.push(g); return; }
      var got = null, k, j;
      for (k = g.c ? k0 : 0; k < (g.c ? 4 : 1) && !got; k++) {
        var S0 = sizeOf(g, k);
        var NU = k === 3 ? NUDGE3 : NUDGE;
        for (j = 0; j < NU.length && !got; j++) {
          var x = q.x + NU[j][0], y = q.y + NU[j][1], bx = [x - S0.bw / 2, y - S0.bh / 2, x + S0.bw / 2, y + S0.bh / 2];
          if (free(bx) && (!NU[j][0] && !NU[j][1] || own(g.n, x, y))) got = { S: S0, k: k, dx: NU[j][0], dy: NU[j][1], bx: bx };
        }
      }
      if (!got && g.c) {   // ④ 겹쳐서라도 — 사이클 4 통합: 가운데 고정 대신 둘레(NUDGE3 + 한 겹 더 36·44px) 가운데 이미 놓인 태그와 가장 적게 겹치는 자리(큰 글씨 360에서 '⑦'이 '양천 4'의 숫자를 덮던 것)
        var S3 = sizeOf(g, 3), best = null, ov = function (bx) { var a = 0; placed.forEach(function (p) { var ox = Math.min(p[2], bx[2]) - Math.max(p[0], bx[0]), oy = Math.min(p[3], bx[3]) - Math.max(p[1], bx[1]); if (ox > 0 && oy > 0) a += ox * oy; }); obs.forEach(function (p) { var ox = Math.min(p[2], bx[2]) - Math.max(p[0], bx[0]), oy = Math.min(p[3], bx[3]) - Math.max(p[1], bx[1]); if (ox > 0 && oy > 0) a += 4 * ox * oy; }); return a; };
        var NU4 = NUDGE3.concat([36, 44].reduce(function (a, r) { for (var k = 0; k < 8; k++) a.push([Math.round(r * Math.cos(k * Math.PI / 4)), Math.round(r * Math.sin(k * Math.PI / 4))]); return a; }, []));
        NU4.forEach(function (d, i) { var x3 = Math.max(EX + S3.bw / 2, Math.min(w - EX - S3.bw / 2, q.x + d[0])), y3 = Math.max(2 + S3.bh / 2, Math.min(h - 2 - S3.bh / 2, q.y + d[1])), bx = [x3 - S3.bw / 2, y3 - S3.bh / 2, x3 + S3.bw / 2, y3 + S3.bh / 2], a = ov(bx) + i * 0.01; if (!best || a < best.a) best = { a: a, x3: x3, y3: y3, bx: bx }; });
        got = { S: S3, k: 4, dx: best.x3 - q.x, dy: best.y3 - q.y, bx: best.bx };
      }
      if (!got) return;
      if (g.c) steps[got.k]++;
      g.l1 = got.S.l1; g.l2 = ""; g.t = 2; g.q = q; g.w = got.S.w; g.h = got.S.h; g.sm = got.k === 1; g.xs = got.k === 2; g.tt = false; g.num = got.k >= 3; g.frc = got.k === 4; g.dx = Math.round(got.dx); g.dy = Math.round(got.dy);
      placed.push(got.bx); keep.push(g);
    }); }
    placeMx.steps = steps;
    return { keep: keep, left: left, steps: steps };
  }
  function place(o) {
    // c4 최종(ux_re 결함 1): 서울 보기 구 표기는 어디서나 D+ 하나 — 웹 홈 지도(자리 그림·실제 지도)도 '✓ 은평 8' · 숫자 보장 · '+N곳' 배지 없음(#map·앱 미니 지도와 같은 표기)
    //   아래 옛 두 줄 묶음('은평 8곳 / 9,800만~') 자리 잡기는 쓰지 않는다(남겨 둔 것은 되돌릴 때 참고용)
    if (DPL) return placeMx(o);
    var w = o.W, h = o.H, obs = o.obs || [], phone = o.phone;
    // 7차: 자리 잡는 차례 = 가장 적게 드는 구부터(같으면 곳 수 많은 구) — 구로 6,900만~·종로 1.2억~가 '+N'에 숨고 관악 5.2억~·서초가 남던 것 · 노원 18곳(1.4억~)이 숨고 광진 3곳(2.8억~)이 남던 것
    var L = o.gus.slice().sort(function (a, b) { return (a.m == null ? 1e9 : a.m) - (b.m == null ? 1e9 : b.m) || b.c - a.c; });
    // 8차: 폰은 가장 적게 드는 세 구를 먼저, 나머지는 곳 수 많은 구부터 — 싼 구는 그대로 지도에 두고 '+N곳'에 숨는 곳 수를 줄인다(390 대출 5억~에서 30%대가 칩에 숨던 것)
    if (phone) { var top3 = L.filter(function (g) { return g.c; }).slice(0, 3); L = top3.concat(L.filter(function (g) { return top3.indexOf(g) < 0; }).sort(function (a, b) { return b.c - a.c; })); }
    var m = 1; L.forEach(function (x) { if (x.c > m) m = x.c; });
    // 8차: 폰은 16방향(바른 8방향 먼저) — 좁은 지도에서 비킬 자리를 더 찾는다
    var ANG = (phone ? [0, 2, 4, 6, 8, 10, 12, 14, 1, 3, 5, 7, 9, 11, 13, 15].map(function (k) { return (k * Math.PI) / 8 + Math.PI / 2; }) : [0, 1, 2, 3, 4, 5, 6, 7].map(function (k) { return (k * Math.PI) / 4 + Math.PI / 2; }));
    // 폰: 맨 아래 20px 띠에는 묶음을 두지 않는다(범례·ⓘ는 따로 피함 · 20차)
    var TB = bigK();
    var MXF = Dc.documentElement.classList.contains("mx") && Dc.documentElement.classList.contains("s-full"), bot = phone && !MXF ? 20 : 2, EX = phone && appFull() ? 8 : MXF ? 7 : 2, AF36 = phone && appFull();   // 4라운드: 앱 지도 탭은 묶음이 화면 가장자리 8px 안으로(양천 묶음이 왼쪽 끝 2px에 반쯤 잘려 보이던 것)
    var GAP = AF36 ? 4 : 6, MAXOFF = 48, MAXOFF2 = 72, MK = 1.0;
    if (Dc.documentElement.classList.contains("mx") && Dc.documentElement.classList.contains("s-full")) { GAP = 3; MAXOFF = 72; }   // 사이클 4(M): 한 줄 라벨이라 조금 더 비켜도 제 구 안   // 7차: 폰은 제 구 중심에서 48px 안 · 다른 구 중심보다 가깝지 않은 자리만(130px·2.5배로 풀었더니 마포 묶음이 강서 땅에 서던 것) · 묶음 사이 실제 2px 넘게(어림 폭보다 글자가 조금 넓어 4px 띄움이 1px로 닿던 것)
    // 30차: 비킨 자리가 다른 구 중심에 더 가까우면(그 구 땅 위로 넘어가면) 쓰지 않는다 — 360에서 서대문 묶음이 동대문 남쪽에 서던 것
    var ANC = o.gus.map(function (g) { return { n: g.n, q: o.proj(g.ll) }; });
    var mine = function (g, x, y) { var d0 = Math.hypot(x - g.q0.x, y - g.q0.y); return ANC.every(function (a) { return a.n === g.n || d0 <= Math.hypot(x - a.q.x, y - a.q.y) * MK + 10; }); };
    // 8차: 화면 점 → 그 점이 든 구 번호(GD.gu 차례 · 없으면 -1). 투영(자리 그림 proj · 실제 지도 map.project)은 메르카토르에 선형이라 두 점으로 거꾸로 푼다
    var RS = phone ? rings() : null, P1 = o.proj([126.9, 37.5]), P2 = o.proj([127.1, 37.6]), X1 = mx(126.9), Y1 = my(37.5), KX = (P2.x - P1.x) / (mx(127.1) - X1), KY = (P2.y - P1.y) / (my(37.6) - Y1);
    var guAt = function (x, y) { if (!RS || !KX || !KY) return -1; var X = X1 + (x - P1.x) / KX, Y = Y1 + (y - P1.y) / KY; for (var i = 0; i < RS.length; i++) if (inRings(RS[i], X, Y)) return i; return -1; };
    var GI = {}; if (GD) GD.gu.forEach(function (g, i) { GI[g[0]] = i; });
    var ck0 = [w, h, phone ? 1 : 0, P1.x, P1.y, P2.x, P2.y].join(",") + "|" + obs.map(function (b) { return b.join(","); }).join(";");
    if (CC.k !== ck0) CC = { k: ck0, m: {}, n: 0 };
    // 비킨 자리 허용: 다른 구 땅 위(가운데 점)면 안 됨 · 48px 넘게(띠·버튼에 깔린 구만 72px까지) 비키면 가운데 점이 제 구 땅 안이어야
    // 가운데 점과 그 둘레 3px 네 점 모두 — 경계선 바로 위 가운데 점이 반올림(정수 px)으로 이웃 구에 넘어가던 것
    var okAt = function (n, x, y, far) {
      if (!RS) return true; var me = GI[n];
      return [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].every(function (d) { var k = guAt(x + d[0], y + d[1]); return far ? k === me : k < 0 || k === me; });
    };
    var boxOf = function (g) { var x = g.q.x + g.dx, y = g.q.y + g.dy; return [x - g.w / 2, y - g.h / 2, x + g.w / 2, y + g.h / 2]; };
    // pre = 이미 자리 잡은 묶음(그대로 둔다) · only = 이번에 자리 잡을 구 이름(없으면 전부)
    var run = function (extra, pre, only) {
      // placed = 놓인 상자 {bx, g}(g 없음 = 칩 자리 · fx = 이미 놓인 것이라 옮기지 않음)
      var placed = (extra ? [{ bx: extra, fx: 1 }] : []).concat((pre || []).map(function (g) { return { bx: boxOf(g), g: g, fx: 1 }; })), keep = (pre || []).slice(), left = [];
      // m = 보이는 상자 밖 투명 누름 자리(작은 묶음은 40px 상자 안에 보이는 30·22px) — 그 둘레까지 지도 칸 안에(23차: 위 가장자리 묶음이 칸 밖으로 5px 나가던 것)
      var inb = function (bx, m) { m = m || 0; return bx[0] >= EX && bx[2] <= w - EX && bx[1] - m >= 2 && bx[3] + m <= h - bot && !obs.some(function (q) { return hit(q, bx); }); };
      // 29차: 묶음끼리 최소 GAP 띄움(한쪽 GAP — 실제 글자 폭이 어림보다 조금 넓어도 닿지 않게)
      var clash = function (bx, skip) { var gx = [bx[0] - GAP, bx[1] - GAP, bx[2] + GAP, bx[3] + GAP]; return placed.filter(function (p) { return p !== skip && hit(p.bx, gx); }); };
      // 자리 후보(차례대로): 크기 3단계 × 비키는 거리 × 8방향 — 지도 칸·장애물·제 구 땅 조건을 넘는 것만
      var cands = function (g, q, l1, l2) {
        var ck = g.n + "|" + l1 + "|" + l2; if (CC.m[ck]) return CC.m[ck];   // 8차: 같은 카메라·같은 글자면 지난 후보 그대로(끄는 동안 다시 만들지 않음)
        var C = [], b0 = [q.x - 30, q.y - 20, q.x + 30, q.y + 20], lim = phone && (b0[1] < 2 || obs.some(function (o2) { return hit(o2, b0); })) ? MAXOFF2 : MAXOFF;   // 8차: 구 중심이 띠·버튼 밑이면 72px까지
        // 23차: 좁은 폰(380px 아래)은 칩으로 보내기 전에 한 줄('영등포 7곳') 작은 묶음으로 한 번 더(s = 2)
        for (var s = 0; s < (AF36 ? 2 : phone || w < 380 ? 3 : 2); s++) {   /* 6라운드: 앱 지도 탭은 높이 36 한 가지 — 둘째 단계는 작은 글씨(40 칸) 대신 같은 글씨에 좁은 여백(tt) */
          // 21차: 둥근 네모 두 줄('강북 1곳' / '7,400만~') — 폭 = 글자 폭 + 여백, 높이 40(누르는 자리 · 작게 줄인 것은 보이는 30 + 투명 둘레로 40)
          // 27차: 셋째 단계도 금액 줄('6,700만~')을 지운 한 줄이 아니라 더 작은 두 줄(xs · 보이는 높이 26) — 높은 금액에서 구 묶음 금액 줄이 빠지던 것
          var tt = AF36 && s === 1, xs = s === 2, one = false, L2 = l2, sm = s >= 1 && !tt, bw = tt ? Math.ceil((Math.max(tw(l1, 12.5), tw(L2, 11)) + 8) * 1.06) : Math.ceil((xs ? Math.max(tw(l1, 11), tw(L2, 11)) + 8 : sm ? Math.max(tw(l1, 11), tw(L2, 11)) + 12 : Math.max(tw(l1, 12.5), tw(L2, 11)) + 18) * (AF36 ? 1.06 : 1.04)), bh = !MXF ? (xs ? (L2 ? 28 : 20) : sm ? (L2 ? 32 : 22) : AF36 ? 36 : 40) : xs ? (L2 ? 28 : 22) : sm ? (L2 ? 32 : 26) : L2 ? (AF36 ? 36 : 40) : 32, d = Math.max(bw, bh);   // 5라운드: 앱 지도 탭 큰 묶음 36(서울을 더 크게 · 묶음 줄임)
          if (TB !== 1) { bw = Math.ceil(bw * TB); bh = Math.ceil(bh * TB); d = Math.max(bw, bh); }   // 사이클 4(M): 큰 글씨(html.t-big)면 라벨 상자도 크게(겹침 0)
          var RR = (phone ? [0, d * 0.45, d * 0.75, d * 1.05, 16, 32, 48, 60, 72] : sm ? [0, d * 0.45, d * 0.75, d * 1.05, d * 1.4, d * 1.8] : [0, d * 0.45, d * 0.75, d * 1.05]).filter(function (r) { return !phone || r <= lim; }).sort(function (a, b) { return a - b; });   // 8차: 폰은 16px 걸음(다른 구 땅 검사가 생겨 좁은 걸음이 안전)   // 30차: 폰은 제 구 중심에서 MAXOFF px 안에서만 비킨다(못 비키면 '+N곳' 칩으로)
          for (var i = 0; i < RR.length; i++) {
            var A = RR[i] ? ANG : [0];
            for (var j = 0; j < A.length; j++) {
              var x = q.x + RR[i] * Math.cos(A[j]), y = q.y + RR[i] * Math.sin(A[j]) * (bh / d), bx = [x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2];
              if (inb(bx, MXF ? ((44 - bh) / 2 > 0 ? Math.min(4, (44 - bh) / 2) : 0) : sm ? (40 - bh) / 2 : 0)) C.push({ bx: bx, w: bw, h: bh, sm: sm, xs: xs, tt: tt, one: one, dx: x - q.x, dy: y - q.y, n: g.n, x: x, y: y, q: q, pc: phone && RR[i] ? (RR[i] > MAXOFF ? 2 : 1) : 0 });   // 구 땅 검사(pc)는 고를 때만(ok)
            }
          }
        }
        if (++CC.n > 120) { CC.m = {}; CC.n = 1; }   // 끄는 동안 글자 조합이 많이 쌓이면 비움
        CC.m[ck] = C;
        return C;
      };
      var ok = function (c) { if (!c.pc) return true; if (c.ok == null) c.ok = (c.pc === 2 || mine({ n: c.n, q0: c.q }, c.x, c.y)) && okAt(c.n, c.x, c.y, c.pc === 2); return c.ok; };   // 폰 비킨 자리: 제 구 중심이 가장 가까움(48px 안) · 구 땅 검사
      var put = function (g, got) { g.l2 = got.one ? "" : g.l2o; g.w = Math.ceil(got.w); g.h = got.h; g.sm = got.sm; g.xs = got.xs; g.tt = got.tt; g.dx = Math.round(got.dx); g.dy = Math.round(got.dy); };
      L.forEach(function (g0) {
        if (!g0.c && !(MXF && g0.nr)) return;
        if (only && !only[g0.n]) return;
        // 사이클 4(M · SPEC C1): 한 줄 라벨 '은평 8곳'(금액은 이름표 aria·구를 누르면) · 갈 수 있는 곳 없이 조금 부족만 있는 구 = 테두리 라벨 '동작 조금 부족 3'
        var g = { n: g0.n, ll: g0.ll, c: g0.c, m: g0.m, nr: g0.c || !MXF ? 0 : g0.nr || 0 }, q = o.proj(g.ll), sn = g.n.length > 2 ? g.n.replace(/구$/, "") : g.n, l1 = g.c ? sn + " " + fmt(g.c) + "곳" : sn + " 조금 부족 " + fmt(g.nr), l2 = MXF || g.m == null ? "" : MT(g.m);   // 홈 지도(전체 지도 아님)는 예전 두 줄
        if (q.x < -8 || q.x > w + 8 || q.y < -8 || q.y > h + 8) { if (g.c) left.push(g); return; }
        var C = cands(g, q, l1, l2), got = null, k;
        for (k = 0; k < C.length && !got; k++) if (!clash(C[k].bx).length && ok(C[k])) got = C[k];
        // 7차: 폰에서 자리가 없으면 그 자리를 막은 묶음 하나를 제 구 안 다른 자리로 옮겨 본다(성북 묶음이 종로 자리를 막아 종로 1.2억~이 '+N'에 숨던 것)
        var FK = {};
        if (!got && phone) for (k = 0; k < C.length && !got; k++) {
          var cl = clash(C[k].bx); if (cl.length !== 1 || cl[0].fx || !cl[0].g || !cl[0].C || !ok(C[k])) continue;
          var K = cl[0], cb = C[k].bx, gx = [cb[0] - GAP, cb[1] - GAP, cb[2] + GAP, cb[3] + GAP];
          // 8차: 옮길 자리(다른 묶음과 안 겹치고 제 구 조건을 넘는 K 후보)는 K마다 한 번만 거른다 — 후보가 늘어 끄는 동안 느려지던 것(같은 차례·같은 결과)
          var fk = FK[K.g.n] || (FK[K.g.n] = K.C.filter(function (kc) { return !clash(kc.bx, K).length && ok(kc); }));
          for (var t = 0; t < fk.length; t++) { var kc = fk[t]; if (hit(kc.bx, gx)) continue; K.bx = kc.bx; put(K.g, kc); got = C[k]; break; }
        }
        if (!got) { if (g.c) left.push(g); return; }
        g.sn = sn; g.l1 = l1; g.l2o = l2; g.t = tier(g.c, m); g.q = q; put(g, got);
        placed.push({ bx: got.bx, g: g, C: C });
        keep.push(g);
      });
      keep.forEach(function (g) { delete g.l2o; });
      return { keep: keep, left: left };
    };
    var r = run(null);
    // 사이클 4 통합: 새 전체 지도(한 줄 라벨) 폰에서 못 놓인 구(390 종로·강동)가 있으면 그 구를 먼저 놓는 차례로 한 번 더 — 숨는 곳 수가 줄 때만 바꾼다(같으면 원래 차례)
    if (MXF && phone && r.left.length) {
      var sum = function (x) { return x.left.reduce(function (a, g) { return a + (g.c || 0); }, 0); }, L0 = L, ln = r.left.map(function (g) { return g.n; });
      L = L0.filter(function (g) { return ln.indexOf(g.n) >= 0; }).concat(L0.filter(function (g) { return ln.indexOf(g.n) < 0; }));
      var r1 = run(null);
      if (sum(r1) < sum(r) || (sum(r1) === sum(r) && r1.left.length < r.left.length)) r = r1; else L = L0;
    }
    if (r.left.length) {
      // 칩이 필요해도 이미 놓인 묶음은 그대로 — 칩 자리에 걸린 것만 다시 자리 잡는다(성북·동작처럼 화면 안 묶음이 칩으로 밀려 들어가지 않게 · 20차)
      var ch = o.chip, stay = [], redo = {}, n0 = r.left.slice();
      r.keep.forEach(function (g) { if (ch && hit(ch, boxOf(g))) redo[g.n] = 1; else stay.push(g); });
      var r2 = Object.keys(redo).length ? run(ch, stay, redo) : { keep: stay, left: [] };
      r = { keep: r2.keep, left: n0.concat(r2.left) };
    }
    return r;
  }
  // 서울 보기 범례(21차) — 구 묶음 두 줄의 뜻
  // 23차: 좁은 폰(380px 아래)은 '내 돈으로 '를 숨겨 한 줄로(지도 칸을 덜 가림 · 뜻은 aria-label에 다)
  var KEY = '<span><i class="k-gu"></i>점·숫자 = <span class="k-x">내 돈으로 </span>갈 수 있는 곳</span><span class="k-s">금액 = 가장 적게 드는 곳</span>';
  var KEY_L = "범례: 구 묶음의 숫자는 그 구에서 내 돈으로 갈 수 있는 곳 수, 금액은 그중 지금 필요한 돈이 가장 적은 곳, 남색으로 칠한 구역은 내 돈으로 가능한 곳";
  // 사이클 4(M): 새 전체 지도 서울 단계(한 줄 라벨 · 구 채움 4단계 · 조금 부족만 있는 구 테두리 라벨)
  var KEY2 = '<span><i class="k-gu"><b>' + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' + '</b></i>✓ 숫자 = <span class="k-x">내 돈으로 </span>갈 수 있는 곳</span><span class="k-s"><i class="k-gun"></i>조금 부족만 있는 구</span>';
  var KEY2_L = "범례: 체크와 구 이름 옆 숫자는 그 구에서 내 돈으로 갈 수 있는 곳 수, 자리가 좁으면 노란 원 숫자, 남색으로 칠한 구는 갈 수 있는 곳이 있는 구, 테두리 라벨은 갈 수 있는 곳 없이 조금 부족한 곳만 있는 구";
  var mxf = function () { var c = Dc.documentElement.classList; return c.contains("mx") && c.contains("s-full"); };
  // c4 최종: 홈 지도 범례 = 새 지도와 같은 견본('✓ 숫자') · 조금 부족 테두리 태그는 전체 지도에서만 그리므로 그 칸은 뺀다
  var KEYH = KEY2.slice(0, KEY2.indexOf('<span class="k-s">'));
  var KEYH_L = "범례: 체크와 구 이름 옆 숫자는 그 구에서 내 돈으로 갈 수 있는 곳 수, 자리가 좁으면 노란 원 숫자, 남색으로 칠한 구는 갈 수 있는 곳이 있는 구";
  var keyOf = function () { return mxf() ? { h: KEY2, l: KEY2_L } : DPL ? { h: KEYH, l: KEYH_L } : { h: KEY, l: KEY_L }; };
  var fmt = function (n) { try { return Number(n).toLocaleString("ko-KR"); } catch (e) { return String(n); } };
  // 금액 꼴 = 앱 ZF.cash와 같은 규칙(1억 아래 100만 단위 '7,400만' · 1억부터 '1.2억' · 올림) — 섬(앱 전)도 같은 글자
  var up = function (x, k) { return Math.ceil(x * k - 1e-6) / k; };
  var cash = function (v) { if (v == null || !isFinite(v)) return "–"; var a = Math.abs(v); if (a < 0.005) return "0원"; var c = Math.ceil(a * 100 - 1e-6); if (c < 100) return (v < 0 ? "-" : "") + (c * 100).toLocaleString("ko-KR") + "만"; return (v < 0 ? "-" : "") + up(a, 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "억"; };
  var MT = function (m) { return cash(m) + "~"; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function chipHTML(L, c) {
    // 4라운드(앱 지도 탭): 숨은 곳의 가장 적은 금액을 칩에 — '+7곳 · 6,700만~'(보이는 최저보다 싼 곳이 칩 안에 있어도 첫눈에 보이게)
    var mn = null; L.forEach(function (g) { if (g.m != null && (mn == null || g.m < mn)) mn = g.m; });
    var am = appFull() && mn != null;
    return '<button type="button" class="lm-gumore-b" aria-expanded="false" aria-label="' + (appFull() ? "지도에 이름이 안 보인 갈 수 있는 곳 " + fmt(c) + "곳(" + L.length + "개 구)" + (am ? ", 가장 적게 드는 곳 " + cash(mn) : "") + ", 목록 보기" : "지도에 다 못 보인 " + L.length + "개 구, 갈 수 있는 곳 " + fmt(c) + "곳 더 보기") + '">+' + fmt(c) + "곳 <small>· " + (am ? MT(mn) : L.length + "개 구") + '</small></button><ul class="lm-gumore-l">' + L.slice().sort(function (a, b) { return (a.m == null ? 1e9 : a.m) - (b.m == null ? 1e9 : b.m) || b.c - a.c; }).map(function (g) { return '<li><button type="button" data-gu="' + esc(g.n) + '"><span class="gm-n">' + esc(g.n) + '</span> <b><i>' + fmt(g.c) + "곳</i>" + (g.m != null ? '<i class="gm-m">' + MT(g.m) + "</i>" : "") + "</b></button></li>"; }).join("") + "</ul>";   // 30차: 펼친 목록은 적게 드는 구부터 · 곳 수·금액 두 칸을 줄 맞춤(금액 '~'가 따로 줄바꿈되던 것)
  }
  var ZOOM = '<button type="button" data-z="full" class="lm-fs" aria-label="지도 크게 보기" aria-pressed="false" title="지도 크게 보기"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" data-z="1" aria-label="확대"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button><button type="button" data-z="-1" aria-label="축소"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button>';
  var GU_LBL = function (n, c, m) { return n + ", 내 돈으로 갈 수 있는 곳 " + fmt(c) + "곳" + (m != null ? ", 가장 적게 드는 곳 " + cash(m) : "") + ", 눌러서 " + n + " 보기"; };
  // 구 묶음 한 개의 마크업(실제 지도 gusSet도 이 함수) — 두 줄: '강북 1곳' / '7,400만~'
  var CK17 = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function guEl(el, g) {
    el.className = "zgu t" + g.t + (g.sm ? " sm" : "") + (g.xs ? " xs" : "") + (g.tt ? " tt" : "") + (g.l2 ? "" : " one") + (g.c ? "" : " nr") + (g.num ? " num" : "") + (g.frc ? " frc" : "");
    el.dataset.n = String(g.c); el.dataset.gu = g.n;
    if (g.m != null) el.dataset.m = String(g.m); else delete el.dataset.m;   // 사이클 4 통합: 한 줄 라벨이라 최저 금액은 이름표(접근 이름)와 data-m(실제 지도 gusSet과 같음)
    el.style.setProperty("--w", g.w + "px"); el.style.setProperty("--h", g.h + "px");
    // 사이클 4 D+: 새 전체 지도 서울 줌 = '✓ 은평 8'(노란 체크 + 남색 태그) · 자리가 없으면 숫자 원(노란 원 + 남색 숫자) — 접근 이름은 그대로 '…곳'
    if ((DPL || mxf()) && !g.l2 && g.c) el.innerHTML = g.num ? '<b class="zg-num">' + fmt(g.c) + "</b>" : '<i class="zg-ck">' + CK17 + '</i><b><span class="gn">' + esc(g.sn || g.l1.replace(/\s[\d,]+$/, "")) + '</span> <span class="mn">' + fmt(g.c) + "</span></b>";   // 시각 언어 v2: 이름 500 + 숫자 700
    else el.innerHTML = "<b>" + esc(g.l1) + "</b>" + (g.l2 ? "<span>" + esc(g.l2) + "</span>" : "");
    el.setAttribute("aria-label", g.c ? GU_LBL(g.n, g.c, g.m) : g.n + ", 갈 수 있는 곳은 없고 조금 부족한 곳 " + fmt(g.nr || 0) + "곳, 눌러서 " + g.n + " 보기");
  }
  // ---------------------------------------------------------------- 자리 그림 DOM
  var S = { el: null, box: null, st: null, tap: null, ro: null, last: null, out: false, dim: null };
  // 4라운드: 설치 앱 지도 탭(폰 · 화면 가득 지도) — 첫 카메라·묶음 가장자리·'+N곳' 최저가를 앱만 따로(웹 지도 픽셀 그대로)
  var appFull = function () { var c = Dc.documentElement.classList; return c.contains("is-tapp") && c.contains("s-full") && phoneQ(); };
  var APAD = { left: 26, right: 32, top: 150, bottom: 130 };   /* 6라운드: 서쪽 +10(강서 끝 잘림) */   // 5라운드: 200·170·56 → 150·130·32(서울을 더 크게 · 묶음 줄임)
  var phoneQ = function () { try { return matchMedia("(max-width:980px)").matches; } catch (e) { return true; } };
  function short(box) { var fs = Dc.documentElement.classList.contains("s-full"), sh = !fs && box.clientHeight > 0 && box.clientHeight < 400; if (sh !== box.classList.contains("lm-short")) box.classList.toggle("lm-short", sh); }
  function mount(box) {
    if (S.el && S.el.isConnected) return S.el;
    if (!box || !GD) return null;
    S.box = box;
    var d = Dc.createElement("div");
    d.className = "zp-ph"; d.setAttribute("role", "group"); d.setAttribute("aria-label", "서울 지도 · 구 묶음을 누르면 그 구로 확대");
    d.innerHTML = '<svg class="zg-bg" aria-hidden="true" width="100%" height="100%"></svg><div class="zg-mk"></div><div class="lm-gumore" hidden></div><p class="lm-key" aria-label="' + keyOf().l + '" data-h="' + esc(keyOf().h) + '">' + keyOf().h + '</p><div class="lm-zoom" role="group" aria-label="지도 확대·축소">' + ZOOM + '</div><span class="zg-attr" aria-hidden="true"></span>';
    box.insertBefore(d, box.firstChild);
    S.el = d; S.out = false;
    // 옛 SVG 구 지도(#map · 구 25개 누르기 자리)는 자리 그림 밑에서 보이지도 눌리지도 않게(20차 A4 · 실제 지도가 붙으면 lm-on이 숨김)
    var om = Dc.getElementById("map"); if (om) { om.style.visibility = "hidden"; om.setAttribute("aria-hidden", "true"); }
    d.addEventListener("click", function (e) {
      S.mk = null;
      var t = e.target, b = t.closest && t.closest("button");
      if (b && b.closest(".lm-gumore") && b.classList.contains("lm-gumore-b")) { var ch = b.parentNode, on = ch.classList.toggle("open"); b.setAttribute("aria-expanded", String(on)); go({ chip: 1 }); return; }
      var a = b && (b.dataset.gu ? { gu: b.dataset.gu } : b.dataset.z ? { zoom: b.dataset.z } : null);
      if (b && b.dataset.gu && b.closest(".lm-gumore")) b.closest(".lm-gumore").classList.remove("open");
      if (b && a) { if (a.gu) { zoomGu(a.gu); var nb = d.querySelector('.zg-mk .zgu[data-gu="' + a.gu + '"]'); if (nb) nb.classList.add("zg-busy"); } else b.classList.add("zg-busy"); go(a); return; }
      go({ bg: 1 });
    });
    d.addEventListener("pointerdown", function () { go({ touch: 1 }); }, { passive: true });
    // 4라운드(설치 앱): 지도 탭으로 바뀌며 칸 크기가 변할 때 다시 그리기(~55ms@4×CPU)를 첫 그림 뒤로 — 탭 전환 INP
    if (W.ResizeObserver) { var roT = 0; S.ro = new ResizeObserver(function () { if (!(S.st && !S.out)) return; if (!Dc.documentElement.classList.contains("is-tapp")) { draw(S.st); return; } if (roT) return; roT = 1; requestAnimationFrame(function () { setTimeout(function () { roT = 0; if (S.st && !S.out) draw(S.st); }, 0); }); }); S.ro.observe(box); }
    return d;
  }
  function go(a) { if (S.tap) { try { S.tap(a); } catch (e) {} } else if (!a.touch) { W.__zgPend = a; } }
  // 떠 있는 것 자리(실제 지도 obstacles()와 같은 것): 레일 · 확대 버튼 · 범례 · 출처 버튼 · 위 작은 막대·아래 버튼
  function obsOf(el, box) {
    var out = [], cb = el.getBoundingClientRect(), w = cb.width;
    var add = function (b) { if (b.bottom <= cb.top || b.top >= cb.bottom || b.right <= cb.left || b.left >= cb.right) return; out.push([b.left - cb.left - 4, b.top - cb.top - 4, b.right - cb.left + 4, b.bottom - cb.top + 4]); };
    var rail = box.querySelector(".s-rail");
    if (rail && rail.offsetWidth) add(rail.getBoundingClientRect());
    else if (box.classList.contains("lm-short")) add({ left: cb.left + w - 6 - 122, right: cb.left + w - 6, top: cb.top + 6, bottom: cb.top + 88 });
    else if (!phoneQ()) add({ left: cb.left + w - 12 - 94, right: cb.left + w - 12, top: cb.top + 12, bottom: cb.top + 146 });
    el.querySelectorAll(".lm-zoom, .lm-key, .zg-attr").forEach(function (e) { if (e.offsetWidth) add(e.getBoundingClientRect()); });   // 숨긴 확대 단추도 장애물(실제 지도는 그 자리에 단추가 보임 · 자리 그림 = 실제 지도 같은 자리)
    var full = Dc.documentElement.classList.contains("s-full");
    Dc.querySelectorAll(".s-mini, .s-fullx").forEach(function (e) { if (e.classList.contains("s-mini") && !full) return; if (e.offsetWidth && !e.hidden) add(e.getBoundingClientRect()); });
    if (mxf()) Dc.querySelectorAll(".mx-top, .mx-chips .mx-c, .mx-fabs, #mxGKey:not([hidden]), .lm-gumore:not([hidden]), #mapbox .lm-zoom, .mx-strip:not([hidden]), .mx-dial:not([hidden])").forEach(function (e) { if (e.offsetWidth && !e.closest(".zp-ph")) add(e.getBoundingClientRect()); });   // 사이클 4(M): 새 조작부 밑에 라벨을 두지 않는다
    return out;
  }
  // 8차: 폰 서울 보기 카메라 위 여백에 12px 더(아래 범례 쪽 여백은 그만큼 덜) — 맨 북쪽 구 중심(도봉)이 겹쳐 보기 띠 바로 밑에 서서 그 묶음이 띠에 걸려 '+N곳'으로 빠지던 것(390) · 10_lmap.js fitPad도 같은 값
  var PADB = 12;
  // 사이클 4(M): 새 전체 지도(html.mx.s-full)는 위 검색·레이어·칩 줄과 아래 범례·내 돈 막대를 피해 맞춘다(실제 지도 fitPad도 이 값)
  function mxPad(cv) {
    var c = Dc.documentElement.classList; if (!c.contains("mx") || !c.contains("s-full")) return null;
    var P = { top: 14, bottom: 14, left: 16, right: 16 }, q = function (s) { var e = Dc.querySelector(s); return e && e.offsetWidth && !e.hidden ? e.getBoundingClientRect() : null; };
    var t = q(".mx-chips") || q("#mapbox .s-rail") || q(".mx-top"); if (t && t.bottom > cv.top && t.top < cv.top + cv.height / 2) P.top = Math.round(t.bottom - cv.top) + 10;
    var bs = [q("#lmKey:not([hidden])"), q("#mxGKey:not([hidden])"), q("#sMini"), q(".mx-dial:not([hidden])"), q(".mx-strip:not([hidden])")].filter(function (b) { return b && b.top > cv.top + cv.height / 2 && b.top < cv.bottom; });
    if (bs.length) P.bottom = Math.round(cv.bottom - Math.min.apply(null, bs.map(function (b) { return b.top; }))) + 8;
    if (phoneQ()) { var f = q(".mx-fabs"); if (f) P.right = Math.max(P.right, 0); }
    else { var rl = q("#mapbox .s-rail"); if (rl) P.top = Math.max(P.top, Math.round(rl.bottom - cv.top) + 10); }
    return P;
  }
  function padOf(el, box) {
    var P = { top: 14, bottom: 14, left: 20, right: 20 };
    try {
      var cv = el.getBoundingClientRect();
      if (!phoneQ()) {
        var rail = box.querySelector(".s-rail"), rp = rail && rail.offsetWidth ? Math.max(16, Math.round(cv.right - rail.getBoundingClientRect().left) + 8) : 114;
        P.left = 40; P.right = Math.max(40, rp); P.top = 30; P.bottom = 24 + Math.round(Math.min(cv.height * 0.62, Math.max(0, cv.bottom - innerHeight)));
      } else if (!Dc.documentElement.classList.contains("s-full")) {
        // 27차: 폰 서울 보기 — 위 겹쳐 보기 띠·아래 범례 자리를 비워 맞춘다(띠·범례에 걸린 북쪽·남쪽 구 묶음이 '+N곳'으로 빠지던 것 · 10_lmap.js fitPad와 같은 값)
        var rl = box.querySelector(".s-rail"); if (rl && rl.offsetWidth) { var rb = rl.getBoundingClientRect(); if (rb.top < cv.top + 60 && rb.bottom > cv.top) P.top = Math.max(P.top, Math.round(rb.bottom - cv.top) + 4 + PADB); }
        P.bottom = 50;   // 8차: 62 → 50(위에 PADB 12px을 더한 만큼 · 줌은 그대로, 지도를 조금 아래로)
      }
      var ov = function (sel) { var e = Dc.querySelector(sel); if (!e || e.hidden || !e.offsetWidth) return null; var b = e.getBoundingClientRect(); return b.bottom > cv.top && b.top < cv.bottom && b.right > cv.left && b.left < cv.right ? b : null; };
      var m = Dc.documentElement.classList.contains("s-full") ? ov(".s-mini") : null; if (m && m.width > cv.width * 0.6 && m.top <= cv.top + 40) P.top = Math.round(m.bottom - cv.top + 10);
      var x = ov(".s-fullx"); if (x) P.bottom = Math.round(cv.bottom - x.top + 6);
      if (appFull()) P = { left: APAD.left, right: APAD.right, top: Math.max(P.top, APAD.top), bottom: Math.max(P.bottom, APAD.bottom) };
      var MP = mxPad(cv); if (MP) P = MP;
    } catch (e) {}
    return P;
  }
  // st = { cnt: {구: 곳 수}, ok: [[lat,lng]…] (갈 수 있는 곳 좌표), pad?: 실제 지도 여백, cam?: 정해진 카메라 }
  // keep = 끄는 중(카메라는 그대로 · 같은 자리 잡기로 숫자·묶음·칩만 다시) — 화면 숫자 합 + 칩 == 큰 숫자가 끄는 동안에도 맞게(20차 G1)
  // 21차: '내 돈으로 가능' 구역 면(실제 지도 zone-fill과 같은 남색·농도) — 금액이 바뀌면 이 경로만 새로
  var ZOK = function (ids) { var a = "", b = "", E = S.ze; if (!GD || !GD.zp || !ids) return ["", ""]; for (var i = 0; i < ids.length; i++) { var d = GD.zp[ids[i]]; if (!d) continue; if (E[ids[i]]) b += d; else a += d; } return [a, b]; };
  // m = [배율, x 이동, y 이동](경계 그림과 같은 변환) · 작은 구역 원(GD.zl)은 화면 좌표로(반지름 4px — 실제 지도 zone-okdot) · 구를 눌러 확대한 동안은 원 없음
  function zoneDraw(svg, ids, z, m) {
    var g = svg.querySelector(".zg-z"), gd = svg.querySelector(".zg-zd"); if (!g) return;
    var sw = Math.max(1, Math.min(1.5, 1 + (z - 10) * 0.25)), k = (ids || []).join(",") + "|" + sw.toFixed(2), mk = k + "|" + (m && !S.dim ? m.join(",") : "-");
    if (g.dataset.k !== k) {
      g.dataset.k = k;
      var P = ZOK(ids);
      g.innerHTML = (P[0] ? '<path class="zg-zok" d="' + P[0] + '" vector-effect="non-scaling-stroke" style="stroke-width:' + sw.toFixed(2) + 'px"/>' : "")
        + (P[1] ? '<path class="zg-zok zg-zest" d="' + P[1] + '" vector-effect="non-scaling-stroke" style="stroke-width:' + sw.toFixed(2) + "px;stroke-dasharray:" + (2.2 * sw).toFixed(1) + " " + (1.6 * sw).toFixed(1) + '"/>' : "");
    }
    if (gd && gd.dataset.k !== mk) {
      gd.dataset.k = mk;
      var c = "";
      if (m && !S.dim && GD.zl && ids) for (var i = 0; i < ids.length; i++) { var p = GD.zl[ids[i]]; if (p) c += '<circle cx="' + (p[0] * m[0] + m[1]).toFixed(1) + '" cy="' + (p[1] * m[0] + m[2]).toFixed(1) + '" r="4"/>'; }
      gd.innerHTML = c;
    }
  }
  // 사이클 4(M · SPEC C1): 구 채움 4단계(0 · 1~2 · 3~5 · 6곳 이상) — 실제 지도 gu-fill과 같은 단계
  function guFill(svg, cnt) {
    var g = svg.querySelector(".zg-gf"); if (!g || !GD.gpl) return;
    if (!DPL && !mxf()) cnt = {};   // c4 최종: 구 채움 2단계도 홈 지도·미니 지도·전체 지도 같은 표기
    // 사이클 4 D+(SPEC J2-1): 2단계 — 갈 수 있는 곳이 있는 구 = 남색(라이트 #6F87C8 · 다크 #4A6FD6) · 없는 구 = 옅은 바탕(#F4F5F7 · #141A22) · 색은 CSS(--gu-has · --gu-none)
    var mx2 = DPL || mxf(), t = function (c) { return c >= 1 ? 1 : 0; }, h = "", k = mx2 ? "m" : "h";
    // 색은 디자인 토큰(--gu-has · --gu-none · 99zzzzzzzzzz_c4map.css) — 인라인 style의 var()라 테마가 바뀌어도 그대로 따라간다
    if (mx2) GD.gu.forEach(function (x, i) { var v = t((cnt && cnt[x[0]]) || 0); k += v; if (GD.gpl[i]) h += '<path class="gf' + (v ? "1" : "0") + '" style="fill:var(' + (v ? "--gu-has" : "--gu-none") + ')" d="' + GD.gpl[i] + '"/>'; });
    if (g.dataset.k !== k) { g.dataset.k = k; g.innerHTML = h; }
  }
  function draw(st, keep) {
    if (!S.ze) { S.ze = {}; ((GD && GD.ze) || []).forEach(function (i) { S.ze[i] = 1; }); if (GD && GD.zp && !GD.za) { var a = ""; for (var i in GD.zp) a += GD.zp[i]; GD.za = a; } }
    if (!keep) S.st = st; else if (S.st) S.st = { cnt: st.cnt, min: st.min || S.st.min, nr: st.nr || S.st.nr, ok: S.st.ok, ids: st.ids || S.st.ids, pad: S.st.pad };
    var el = mount(S.box || Dc.getElementById("mapbox"));
    if (!el || S.out) return null;
    var box = S.box; short(box);
    var w = el.clientWidth, h = el.clientHeight;
    if (w < 50 || h < 50) return null;
    var phone = phoneQ(), pad = st.pad || padOf(el, box);
    var C = st.cam || (S.dim ? guCam(S.dim, w, h, guPad(padOf(el, box), phone), (S.st && S.st.ok) || st.ok) : null) || cam(bb(st.ok, st.cnt, phone), w, h, pad, phone, 12);
    if (!C) return null;
    S.last = C;
    var P = proj(C, w, h), ws = 512 * Math.pow(2, C.z), k = ws / GD.S, tx = (GD.o[0] / GD.S - mx(C.c[0])) * ws + w / 2, ty = (GD.o[1] / GD.S - my(C.c[1])) * ws + h / 2;
    var mpp = (40075016.7 * Math.cos((C.c[1] * Math.PI) / 180)) / ws;
    // 구 묶음
    var mins = (S.st && S.st.min) || st.min || {};
    var nrs = (S.st && S.st.nr) || st.nr || {};
    var gus = GD.gu.map(function (g) { return { n: g[0], ll: [g[1], g[2]], c: (st.cnt && st.cnt[g[0]]) || 0, m: mins[g[0]] != null ? mins[g[0]] : null, nr: nrs[g[0]] || 0 }; });
    // 구를 눌러 확대한 동안: 그 구 묶음 하나만(실제 지도가 알약을 그릴 때까지 '불러오는 중' 반짝임) · 칩 없음
    if (S.dim) gus = gus.filter(function (g) { return g.n === S.dim; }).map(function (g) { g.c = g.c || 0; return g; });
    var key = el.querySelector(".lm-key"), cb = el.getBoundingClientRect(), ky = h - 40;
    { var KO = keyOf(), kh = KO.h; if (key && key.dataset.h !== kh) { key.dataset.h = kh; key.innerHTML = kh; key.setAttribute("aria-label", KO.l); } }
    try { if (key.offsetWidth) ky = key.getBoundingClientRect().top - cb.top - 6; } catch (e) {}
    // 27차: 폰 서울 보기는 '+N곳' 칩을 왼쪽 위(서울 밖 고양 쪽 빈 자리)에 — 왼쪽 아래에 두면 구로·양천 묶음 자리를 칩이 차지했다(10_lmap.js chipBox와 같은 규칙)
    var ctop = phone && !Dc.documentElement.classList.contains("s-full");
    var CHH = bigK() > 1 ? 54 : 40;   // 사이클 4 통합: 큰 글씨면 '+N곳' 칩이 40px보다 커서 범례에 겹치던 것
    var obs = obsOf(el, box);
    // 사이클 5(M · 성능): 같은 입력이면 다시 그리지 않는다 — 섬이 그린 자리 그림을 앱이 붙으며 같은 값으로 2~3번 다시 그리던 것(4×CPU 한 번 60~150ms)
    //   열쇠 = 그림을 정하는 값 전부(카메라·칸 크기·구 숫자·최저가·부족 수·고른 구·범례·칩 자리·장애물·글자 배율·새 지도 모드·면 id) · 그려 둔 DOM이 그대로일 때만
    var mk = el.querySelector(".zg-mk"), sv0 = el.querySelector(".zg-bg");
    var mkey = JSON.stringify([C, w, h, st.cnt || null, mins, nrs, S.dim, key && key.dataset.h, ky, ctop, CHH, obs, phone, mxf(), appFull(), bigK(), ((S.st && S.st.ids) || st.ids || []).join(",")]);
    if (S.mk === mkey && S.mr && mk && mk.children.length && sv0 && sv0.querySelector(".zg-t") && S.mel === el) return S.mr;
    S.mk = null;
    var R = place({ W: w, H: h, obs: obs, gus: gus, proj: P, phone: phone, chip: ctop ? [4, 6, 120, 6 + CHH] : [4, ky - CHH, 120, ky] });
    var have = {};
    [].forEach.call(mk.children, function (b) { have[b.dataset.gu] = b; });
    R.keep.forEach(function (g) {
      var b = have[g.n]; delete have[g.n];
      if (!b) { b = Dc.createElement("button"); b.type = "button"; b.tabIndex = 0; mk.appendChild(b); }
      guEl(b, g);
      b.style.transform = "translate(" + Math.round(g.q.x + g.dx) + "px," + Math.round(g.q.y + g.dy) + "px) translate(-50%,-50%)";
    });
    for (var n in have) have[n].remove();
    // '+N곳 N개 구' 칩
    var ch = el.querySelector(".lm-gumore"), c = S.dim ? 0 : R.left.reduce(function (a, g) { return a + g.c; }, 0);
    ch.hidden = !c;
    if (S.dim) [].forEach.call(mk.children, function (b) { b.classList.add("zg-busy"); });
    if (c) { var kk = R.left.map(function (g) { return g.n + g.c + ":" + g.m; }).join(",") + (appFull() ? "f" : ""); /* 5라운드: 지도 탭이 된 뒤 다시 그려 최저가를 붙인다(실제 지도 칩과 같은 글) */ if (ch.dataset.k !== kk) { ch.dataset.k = kk; ch.innerHTML = chipHTML(R.left, c); ch.classList.remove("open"); } ch.dataset.n = String(c); ch.style.top = (ctop ? 6 : Math.max(6, Math.round(ky - CHH))) + "px"; ch.classList.toggle("top", !!ctop); }
    // 바탕: 땅 · 한강 · 구 경계(점선) · 서울 밖 옅게 · 서울 경계 · 묶음 없는 구 이름
    var txt = "", used = R.keep.map(function (g) { var x = g.q.x + g.dx, y = g.q.y + g.dy; return [x - g.w / 2, y - g.h / 2, x + g.w / 2, y + g.h / 2]; }).concat(obsOf(el, box));
    var fs = C.z <= 10 ? 10.5 : C.z >= 12.5 ? 12.5 : 10.5 + (C.z - 10) * 0.8;
    GD.gu.forEach(function (g) {
      if (R.keep.some(function (x) { return x.n === g[0]; })) return;
      var q = P([g[1], g[2]]), tw0 = tw(g[0], fs) + 4, bx = [q.x - tw0 / 2, q.y - fs * 0.7, q.x + tw0 / 2, q.y + fs * 0.7];
      if (bx[0] < 2 || bx[2] > w - 2 || bx[1] < 2 || bx[3] > h - 2 || used.some(function (u) { return hit(u, bx); })) return;
      used.push(bx);
      txt += '<text x="' + q.x.toFixed(1) + '" y="' + (q.y + fs * 0.35).toFixed(1) + '" font-size="' + fs.toFixed(1) + '">' + g[0] + "</text>";
    });
    var M = "M-9e5 -9e5H9e5V9e5H-9e5Z", svg = el.querySelector(".zg-bg"), mtx = [k, 0, 0, k, tx, ty].map(function (v) { return +v.toFixed(5); }).join(" ");
    // 경계 그림(큰 path)은 카메라·크기가 바뀔 때만 새로 — 금액만 바뀌면 구 이름 글자만(끄는 동안 가볍게)
    var gi = S.dim ? guIdx(S.dim) : -1, bk = mtx + "|" + w + "x" + h + "|" + gi;
    if (svg.dataset.k !== bk || !svg.querySelector(".zg-t")) {
      svg.dataset.k = bk;
      svg.innerHTML = '<rect class="zg-land" width="100%" height="100%"/><g transform="matrix(' + mtx + ')">'
        + '<g class="zg-gf"></g>' + (GD.rv ? '<path class="zg-river" d="' + GD.rv + '" vector-effect="non-scaling-stroke" style="stroke-width:' + Math.max(6, Math.min(80, 950 / mpp)).toFixed(1) + 'px"/>' : "")
        + '<path class="zg-gu" d="' + GD.gp + '" vector-effect="non-scaling-stroke"/>'
        + (GD.za ? '<path class="zg-zall" d="' + GD.za + '"/><g class="zg-z"></g>' : "")
        + '<path class="zg-mask" fill-rule="evenodd" d="' + M + GD.sp + '"/>'
        + '<path class="zg-seoul" d="' + GD.sp + '" vector-effect="non-scaling-stroke"/>'
        + (gi >= 0 && GD.gpl ? '<path class="zg-dim" style="fill:var(--mxt-gu-dim)" fill-rule="evenodd" d="' + M + GD.gpl[gi] + '"/><path class="zg-sel" fill="none" style="stroke:var(--mxt-navy)" stroke-width="2.2" d="' + GD.gpl[gi] + '" vector-effect="non-scaling-stroke"/>' : "")
        + '</g><g class="zg-zd"></g><g class="zg-t">' + txt + "</g>";
    } else { var tg = svg.querySelector(".zg-t"); if (tg.innerHTML !== txt) tg.innerHTML = txt; }
    zoneDraw(svg, (S.st && S.st.ids) || st.ids, C.z, [k, tx, ty]);
    guFill(svg, st.cnt);
    S.mr = { cam: C, keep: R.keep, left: R.left, more: c }; S.mk = mkey; S.mel = el;
    return S.mr;
  }
  // 구를 누르면 바로: 같은 투영으로 그 구에 맞춰 확대하고 다른 구는 어둡게(실제 지도가 붙기 전에도 누른 반응이 즉시 · 20차 A1)
  function zoomGu(n) {
    if (!S.el || S.out || !GD) return;
    if ((n || null) === S.dim) return;
    S.dim = n || null;
    if (S.st) draw(S.st);
  }
  // 끄는 동안: 자리는 그대로 숫자·농도만(실제 지도 dragLite와 같음)
  // 끄는 동안 묶음 한 개의 글자·농도만(자리·크기는 손을 뗄 때) — 실제 지도 dragLite도 이 함수
  function guLite(b, c, mn, mx) {
    S.mk = null;   // 끄는 동안 바뀐 글자 → 다음 draw는 꼭 다시
    if (+b.dataset.n === c && b.dataset.m === String(mn)) return;
    b.dataset.n = String(c); b.dataset.m = String(mn);
    var n = b.dataset.gu, sn = n.length > 2 ? n.replace(/구$/, "") : n, x = b.querySelector("b"), sp = b.querySelector("span");
    if (x && (c || !b.classList.contains("nr"))) { if (x.classList.contains("zg-num")) x.textContent = fmt(c); else if ((DPL || mxf()) && b.classList.contains("one")) x.innerHTML = '<span class="gn">' + esc(sn) + '</span> <span class="mn">' + fmt(c) + "</span>"; else x.textContent = sn + " " + fmt(c) + "곳"; }
    if (sp) sp.textContent = mn != null ? MT(mn) : "";
    b.classList.remove("t1", "t2", "t3"); b.classList.add("t" + tier(c, mx)); b.classList.toggle("z0", !c);
    var sv = S.el && S.el.querySelector(".zg-bg"); if (sv && S.st && S.st.cnt) { S.st.cnt[n] = c; guFill(sv, S.st.cnt); }
    b.setAttribute("aria-label", GU_LBL(n, c, mn));
  }
  function lite(cnt, ids, mins) {
    if (!S.el || S.out) return;
    S.mk = null;
    if (ids && S.st) S.st.ids = ids;
    if (mins && S.st) S.st.min = mins;
    if (S.last && !S.dim) { draw({ cnt: cnt, min: mins, ok: (S.st && S.st.ok) || [], ids: ids, cam: S.last }, 1); return; }
    if (ids && S.last) { var sv = S.el.querySelector(".zg-bg"); if (sv) zoneDraw(sv, ids, S.last.z, null); }
    var m = 1; for (var k in cnt) if (cnt[k] > m) m = cnt[k];
    [].forEach.call(S.el.querySelectorAll(".zg-mk .zgu"), function (b) {
      var c = cnt[b.dataset.gu] || 0, mm = (S.st && S.st.min) || {}; guLite(b, c, mm[b.dataset.gu] != null ? mm[b.dataset.gu] : null, m);
    });
    var ch = S.el.querySelector(".lm-gumore");
    if (ch && !ch.hidden) { var t = 0; [].forEach.call(ch.querySelectorAll("button[data-gu]"), function (b) { t += cnt[b.dataset.gu] || 0; }); ch.dataset.n = String(t); var bb0 = ch.querySelector(".lm-gumore-b"); if (bb0 && bb0.firstChild) bb0.firstChild.textContent = "+" + fmt(t) + "곳 "; }   // 칩 글자 '+7곳 · 3개 구'(· 는 small 안)
  }
  // 실제 지도가 바탕까지 다 그린 뒤: 200ms 동안 서서히 걷어 낸다(빈 회색 화면 없음)
  function fade() {
    var el = S.el; if (!el || S.out) return;
    S.out = true;
    if (S.ro) { S.ro.disconnect(); S.ro = null; }
    var rm = function () { if (el.isConnected) el.remove(); unhide(); };
    var rd = false; try { rd = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    if (rd) return rm();
    // 걷히는 동안 범례·칩이 실제 지도 것과 겹쳐 두 번 보이지 않게 먼저 숨긴다(20차 G7)
    [].forEach.call(el.querySelectorAll(".lm-key, .lm-gumore, .lm-zoom, .zg-attr"), function (x) { x.style.visibility = "hidden"; });
    el.classList.add("zg-out"); setTimeout(rm, 260);
  }
  function unhide() { var om = Dc.getElementById("map"); if (om) { om.style.visibility = ""; om.removeAttribute("aria-hidden"); } }
  function drop() { if (S.el) { S.out = true; if (S.ro) { S.ro.disconnect(); S.ro = null; } S.el.remove(); unhide(); } }
  W.ZP_G = {
    GD: GD, PADB: PADB, mxPad: mxPad, KEY2: KEY2, KEY2_L: KEY2_L, mxf: mxf, keyOf: keyOf, dpl: function () { return DPL; }, appFull: appFull, APAD: APAD, tw: tw, bb: bb, cam: cam, proj: proj, place: place, tier: tier, KEY: KEY, KEY_L: KEY_L, guEl: guEl, guLite: guLite, cash: cash, MT: MT, ZOOM: ZOOM, chipHTML: chipHTML, GU_LBL: GU_LBL,
    mount: mount, draw: draw, lite: lite, redraw: function () { if (S.st && !S.out) draw(S.st); }, steps: function () { return (placeMx.steps || []).slice(); }, fade: fade, drop: drop, guCam: guCam, guPad: guPad, zoomGu: zoomGu, dimGu: function () { return S.dim; },
    on: function () { return !!(S.el && S.el.isConnected && !S.out); },
    el: function () { return S.el && S.el.isConnected ? S.el : null; },
    last: function () { return S.last; },
    onTap: function (fn) { S.tap = fn; var p = W.__zgPend; W.__zgPend = null; if (p && fn) try { fn(p); } catch (e) {} },
    // 8차: 경위도 점이 든 구 이름(없으면 '') — 묶음 자리 검사(qa ui.r30Layout)와 place()가 같은 고리
    guAt: function (lng, lat) { var R0 = rings(); if (!R0) return ""; for (var i = 0; i < R0.length; i++) if (inRings(R0[i], mx(lng), my(lat))) return GD.gu[i][0]; return ""; },
    gus: function () { return S.el ? [].map.call(S.el.querySelectorAll(".zg-mk .zgu"), function (b) { return { n: b.dataset.gu, c: +b.dataset.n }; }) : []; },
    more: function () { var c = S.el && S.el.querySelector(".lm-gumore"); return c && !c.hidden ? +c.dataset.n || 0 : 0; },
  };
})();
