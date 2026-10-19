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
  function tw(t, px) { var w = 0; t = String(t); for (var i = 0; i < t.length; i++) { var c = t.charCodeAt(i); w += c >= 0xac00 && c <= 0xd7a3 ? 0.95 : c === 32 ? 0.28 : c >= 48 && c <= 57 ? 0.6 : 0.62; } return Math.ceil(w * px); }
  // 첫 화면 범위: 서울 가운데(CORE) + 갈 수 있는 곳 + 그 구 묶음 자리(폰) · PC는 서울 전체(10_lmap.js affBB와 같은 규칙)
  function bb(okLL, cnt, phone) {
    var a = CORE[0][0], b = CORE[0][1], c = CORE[1][0], d = CORE[1][1];
    var P = okLL || [];
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
    if (phone && H > w * 1.15 && hh > 0 && H / hh > 1.3) z += Math.min(0.45, Math.log2(H / hh) * 0.5);
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
  var hit = function (a, b) { return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]; };
  // 23차: 묶음 색은 한 가지(중간 남색) — 곳 수는 숫자가 말한다. 범례에 없는 '진함 세 단계'를 없앰(뜻 모를 색 없음)
  var tier = function () { return 2; };
  // 구 묶음 자리 잡기(실제 지도 guLayout과 같은 함수): 겹치면 ① 둘레로 비켜 ② 작게 ③ 안 되면(또는 화면 밖) '+N곳' 칩으로
  function place(o) {
    var w = o.W, h = o.H, obs = o.obs || [], phone = o.phone;
    var L = o.gus.slice().sort(function (a, b) { return b.c - a.c; });
    var m = 1; L.forEach(function (x) { if (x.c > m) m = x.c; });
    var ANG = [0, 1, 2, 3, 4, 5, 6, 7].map(function (k) { return (k * Math.PI) / 4 + Math.PI / 2; });
    // 폰: 맨 아래 20px 띠에는 묶음을 두지 않는다(범례·ⓘ는 따로 피함 · 20차)
    var bot = phone ? 20 : 2;
    var boxOf = function (g) { var x = g.q.x + g.dx, y = g.q.y + g.dy; return [x - g.w / 2, y - g.h / 2, x + g.w / 2, y + g.h / 2]; };
    // pre = 이미 자리 잡은 묶음(그대로 둔다) · only = 이번에 자리 잡을 구 이름(없으면 전부)
    var run = function (extra, pre, only) {
      var placed = (extra ? [extra] : []).concat((pre || []).map(boxOf)), keep = (pre || []).slice(), left = [];
      // m = 보이는 상자 밖 투명 누름 자리(작은 묶음은 40px 상자 안에 보이는 30·22px) — 그 둘레까지 지도 칸 안에(23차: 위 가장자리 묶음이 칸 밖으로 5px 나가던 것)
      var free = function (bx, m) { m = m || 0; return bx[0] >= 2 && bx[2] <= w - 2 && bx[1] - m >= 2 && bx[3] + m <= h - bot && !obs.some(function (q) { return hit(q, bx); }) && !placed.some(function (q) { return hit(q, bx); }); };
      L.forEach(function (g0) {
        if (!g0.c) return;
        if (only && !only[g0.n]) return;
        var g = { n: g0.n, ll: g0.ll, c: g0.c, m: g0.m }, q = o.proj(g.ll), sn = g.n.length > 2 ? g.n.replace(/구$/, "") : g.n, l1 = sn + " " + fmt(g.c) + "곳", l2 = g.m != null ? MT(g.m) : "";
        if (q.x < -8 || q.x > w + 8 || q.y < -8 || q.y > h + 8) { left.push(g); return; }
        var got = null;
        // 23차: 좁은 폰(380px 아래)은 칩으로 보내기 전에 한 줄('영등포 7곳') 작은 묶음으로 한 번 더(s = 2)
        for (var s = 0; s < (w < 380 ? 3 : 2) && !got; s++) {
          // 21차: 둥근 네모 두 줄('강북 1곳' / '7,400만~') — 폭 = 글자 폭 + 여백, 높이 40(누르는 자리 · 작게 줄인 것은 보이는 30 + 투명 둘레로 40)
          var one = s === 2, L2 = one ? "" : l2, sm = s >= 1, bw = sm ? Math.max(tw(l1, 11), tw(L2, 9.5)) + 12 : Math.max(tw(l1, 12.5), tw(L2, 10.5)) + 18, bh = sm ? (L2 ? 30 : 22) : 40, d = Math.max(bw, bh);
          var RR = sm ? [0, d * 0.45, d * 0.75, d * 1.05, d * 1.4, d * 1.8] : [0, d * 0.45, d * 0.75, d * 1.05];
          for (var i = 0; i < RR.length && !got; i++) {
            var A = RR[i] ? ANG : [0];
            for (var j = 0; j < A.length; j++) {
              var x = q.x + RR[i] * Math.cos(A[j]), y = q.y + RR[i] * Math.sin(A[j]) * (bh / d), bx = [x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2];
              if (free(bx, sm ? (40 - bh) / 2 : 0)) { got = { bx: bx, w: bw, h: bh, sm: sm, one: one, dx: x - q.x, dy: y - q.y }; break; }
            }
          }
        }
        if (!got) { left.push(g); return; }
        placed.push(got.bx);
        g.sn = sn; g.l1 = l1; g.l2 = got.one ? "" : l2; g.w = Math.ceil(got.w); g.h = got.h; g.sm = got.sm; g.dx = Math.round(got.dx); g.dy = Math.round(got.dy); g.t = tier(g.c, m); g.q = q;
        keep.push(g);
      });
      return { keep: keep, left: left };
    };
    var r = run(null);
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
  var KEY = '<span><i class="k-gu"></i>숫자 = <span class="k-x">내 돈으로 </span>갈 수 있는 곳</span><span class="k-s">금액 = 가장 적게 드는 곳</span>';
  var KEY_L = "범례: 구 묶음의 숫자는 그 구에서 내 돈으로 갈 수 있는 곳 수, 금액은 그중 지금 필요한 돈이 가장 적은 곳, 남색으로 칠한 구역은 내 돈으로 가능한 곳";
  var fmt = function (n) { try { return Number(n).toLocaleString("ko-KR"); } catch (e) { return String(n); } };
  // 금액 꼴 = 앱 ZF.cash와 같은 규칙(1억 아래 100만 단위 '7,400만' · 1억부터 '1.2억' · 올림) — 섬(앱 전)도 같은 글자
  var up = function (x, k) { return Math.ceil(x * k - 1e-6) / k; };
  var cash = function (v) { if (v == null || !isFinite(v)) return "–"; var a = Math.abs(v); if (a < 0.005) return "0원"; var c = Math.ceil(a * 100 - 1e-6); if (c < 100) return (v < 0 ? "-" : "") + (c * 100).toLocaleString("ko-KR") + "만"; return (v < 0 ? "-" : "") + up(a, 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "억"; };
  var MT = function (m) { return cash(m) + "~"; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function chipHTML(L, c) {
    return '<button type="button" class="lm-gumore-b" aria-expanded="false" aria-label="지도에 다 못 보인 ' + L.length + "개 구, 갈 수 있는 곳 " + fmt(c) + '곳 더 보기">+' + fmt(c) + "곳 <small>· " + L.length + '개 구</small></button><ul class="lm-gumore-l">' + L.map(function (g) { return '<li><button type="button" data-gu="' + esc(g.n) + '">' + esc(g.n) + " <b>" + fmt(g.c) + "곳" + (g.m != null ? " · " + MT(g.m) : "") + "</b></button></li>"; }).join("") + "</ul>";
  }
  var ZOOM = '<button type="button" data-z="full" class="lm-fs" aria-label="지도 크게 보기" aria-pressed="false" title="지도 크게 보기"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" data-z="1" aria-label="확대"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button><button type="button" data-z="-1" aria-label="축소"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button>';
  var GU_LBL = function (n, c, m) { return n + ", 내 돈으로 갈 수 있는 곳 " + fmt(c) + "곳" + (m != null ? ", 가장 적게 드는 곳 " + cash(m) : "") + ", 눌러서 " + n + " 보기"; };
  // 구 묶음 한 개의 마크업(실제 지도 gusSet도 이 함수) — 두 줄: '강북 1곳' / '7,400만~'
  function guEl(el, g) {
    el.className = "zgu t" + g.t + (g.sm ? " sm" : "") + (g.l2 ? "" : " one");
    el.dataset.n = String(g.c); el.dataset.gu = g.n;
    el.style.setProperty("--w", g.w + "px"); el.style.setProperty("--h", g.h + "px");
    el.innerHTML = "<b>" + esc(g.l1) + "</b>" + (g.l2 ? "<span>" + esc(g.l2) + "</span>" : "");
    el.setAttribute("aria-label", GU_LBL(g.n, g.c, g.m));
  }
  // ---------------------------------------------------------------- 자리 그림 DOM
  var S = { el: null, box: null, st: null, tap: null, ro: null, last: null, out: false, dim: null };
  var phoneQ = function () { try { return matchMedia("(max-width:980px)").matches; } catch (e) { return true; } };
  function short(box) { var fs = Dc.documentElement.classList.contains("s-full"), sh = !fs && box.clientHeight > 0 && box.clientHeight < 400; if (sh !== box.classList.contains("lm-short")) box.classList.toggle("lm-short", sh); }
  function mount(box) {
    if (S.el && S.el.isConnected) return S.el;
    if (!box || !GD) return null;
    S.box = box;
    var d = Dc.createElement("div");
    d.className = "zp-ph"; d.setAttribute("role", "group"); d.setAttribute("aria-label", "서울 지도 · 구 묶음을 누르면 그 구로 확대");
    d.innerHTML = '<svg class="zg-bg" aria-hidden="true" width="100%" height="100%"></svg><div class="zg-mk"></div><div class="lm-gumore" hidden></div><p class="lm-key" aria-label="' + KEY_L + '">' + KEY + '</p><div class="lm-zoom" role="group" aria-label="지도 확대·축소">' + ZOOM + '</div><span class="zg-attr" aria-hidden="true"></span>';
    box.insertBefore(d, box.firstChild);
    S.el = d; S.out = false;
    // 옛 SVG 구 지도(#map · 구 25개 누르기 자리)는 자리 그림 밑에서 보이지도 눌리지도 않게(20차 A4 · 실제 지도가 붙으면 lm-on이 숨김)
    var om = Dc.getElementById("map"); if (om) { om.style.visibility = "hidden"; om.setAttribute("aria-hidden", "true"); }
    d.addEventListener("click", function (e) {
      var t = e.target, b = t.closest && t.closest("button");
      if (b && b.closest(".lm-gumore") && b.classList.contains("lm-gumore-b")) { var ch = b.parentNode, on = ch.classList.toggle("open"); b.setAttribute("aria-expanded", String(on)); go({ chip: 1 }); return; }
      var a = b && (b.dataset.gu ? { gu: b.dataset.gu } : b.dataset.z ? { zoom: b.dataset.z } : null);
      if (b && b.dataset.gu && b.closest(".lm-gumore")) b.closest(".lm-gumore").classList.remove("open");
      if (b && a) { if (a.gu) { zoomGu(a.gu); var nb = d.querySelector('.zg-mk .zgu[data-gu="' + a.gu + '"]'); if (nb) nb.classList.add("zg-busy"); } else b.classList.add("zg-busy"); go(a); return; }
      go({ bg: 1 });
    });
    d.addEventListener("pointerdown", function () { go({ touch: 1 }); }, { passive: true });
    if (W.ResizeObserver) { S.ro = new ResizeObserver(function () { if (S.st && !S.out) draw(S.st); }); S.ro.observe(box); }
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
    el.querySelectorAll(".lm-zoom, .lm-key, .zg-attr").forEach(function (e) { if (e.offsetWidth) add(e.getBoundingClientRect()); });
    var full = Dc.documentElement.classList.contains("s-full");
    Dc.querySelectorAll(".s-mini, .s-fullx").forEach(function (e) { if (e.classList.contains("s-mini") && !full) return; if (e.offsetWidth && !e.hidden) add(e.getBoundingClientRect()); });
    return out;
  }
  function padOf(el, box) {
    var P = { top: 14, bottom: 14, left: 20, right: 20 };
    try {
      var cv = el.getBoundingClientRect();
      if (!phoneQ()) {
        var rail = box.querySelector(".s-rail"), rp = rail && rail.offsetWidth ? Math.max(16, Math.round(cv.right - rail.getBoundingClientRect().left) + 8) : 114;
        P.left = 40; P.right = Math.max(40, rp); P.top = 30; P.bottom = 24 + Math.round(Math.min(cv.height * 0.62, Math.max(0, cv.bottom - innerHeight)));
      }
      var ov = function (sel) { var e = Dc.querySelector(sel); if (!e || e.hidden || !e.offsetWidth) return null; var b = e.getBoundingClientRect(); return b.bottom > cv.top && b.top < cv.bottom && b.right > cv.left && b.left < cv.right ? b : null; };
      var m = Dc.documentElement.classList.contains("s-full") ? ov(".s-mini") : null; if (m && m.width > cv.width * 0.6 && m.top <= cv.top + 40) P.top = Math.round(m.bottom - cv.top + 10);
      var x = ov(".s-fullx"); if (x) P.bottom = Math.round(cv.bottom - x.top + 6);
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
  function draw(st, keep) {
    if (!S.ze) { S.ze = {}; ((GD && GD.ze) || []).forEach(function (i) { S.ze[i] = 1; }); if (GD && GD.zp && !GD.za) { var a = ""; for (var i in GD.zp) a += GD.zp[i]; GD.za = a; } }
    if (!keep) S.st = st; else if (S.st) S.st = { cnt: st.cnt, min: st.min || S.st.min, ok: S.st.ok, ids: st.ids || S.st.ids, pad: S.st.pad };
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
    var gus = GD.gu.map(function (g) { return { n: g[0], ll: [g[1], g[2]], c: (st.cnt && st.cnt[g[0]]) || 0, m: mins[g[0]] != null ? mins[g[0]] : null }; });
    // 구를 눌러 확대한 동안: 그 구 묶음 하나만(실제 지도가 알약을 그릴 때까지 '불러오는 중' 반짝임) · 칩 없음
    if (S.dim) gus = gus.filter(function (g) { return g.n === S.dim; }).map(function (g) { g.c = g.c || 0; return g; });
    var key = el.querySelector(".lm-key"), cb = el.getBoundingClientRect(), ky = h - 40;
    try { if (key.offsetWidth) ky = key.getBoundingClientRect().top - cb.top - 6; } catch (e) {}
    var R = place({ W: w, H: h, obs: obsOf(el, box), gus: gus, proj: P, phone: phone, chip: [4, ky - 40, 120, ky] });
    var mk = el.querySelector(".zg-mk"), have = {};
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
    if (c) { var kk = R.left.map(function (g) { return g.n + g.c; }).join(","); if (ch.dataset.k !== kk) { ch.dataset.k = kk; ch.innerHTML = chipHTML(R.left, c); ch.classList.remove("open"); } ch.dataset.n = String(c); ch.style.top = Math.max(6, Math.round(ky - 40)) + "px"; }
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
        + (GD.rv ? '<path class="zg-river" d="' + GD.rv + '" vector-effect="non-scaling-stroke" style="stroke-width:' + Math.max(6, Math.min(80, 950 / mpp)).toFixed(1) + 'px"/>' : "")
        + '<path class="zg-gu" d="' + GD.gp + '" vector-effect="non-scaling-stroke"/>'
        + (GD.za ? '<path class="zg-zall" d="' + GD.za + '"/><g class="zg-z"></g>' : "")
        + '<path class="zg-mask" fill-rule="evenodd" d="' + M + GD.sp + '"/>'
        + '<path class="zg-seoul" d="' + GD.sp + '" vector-effect="non-scaling-stroke"/>'
        + (gi >= 0 && GD.gpl ? '<path class="zg-dim" fill="#0B1530" fill-opacity=".3" fill-rule="evenodd" d="' + M + GD.gpl[gi] + '"/><path class="zg-sel" fill="none" stroke="#1F3A87" stroke-width="2.2" d="' + GD.gpl[gi] + '" vector-effect="non-scaling-stroke"/>' : "")
        + '</g><g class="zg-zd"></g><g class="zg-t">' + txt + "</g>";
    } else { var tg = svg.querySelector(".zg-t"); if (tg.innerHTML !== txt) tg.innerHTML = txt; }
    zoneDraw(svg, (S.st && S.st.ids) || st.ids, C.z, [k, tx, ty]);
    return { cam: C, keep: R.keep, left: R.left, more: c };
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
    if (+b.dataset.n === c && b.dataset.m === String(mn)) return;
    b.dataset.n = String(c); b.dataset.m = String(mn);
    var n = b.dataset.gu, sn = n.length > 2 ? n.replace(/구$/, "") : n, x = b.querySelector("b"), sp = b.querySelector("span");
    if (x) x.textContent = sn + " " + fmt(c) + "곳";
    if (sp) sp.textContent = mn != null ? MT(mn) : "";
    b.classList.remove("t1", "t2", "t3"); b.classList.add("t" + tier(c, mx)); b.classList.toggle("z0", !c);
    b.setAttribute("aria-label", GU_LBL(n, c, mn));
  }
  function lite(cnt, ids, mins) {
    if (!S.el || S.out) return;
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
    GD: GD, tw: tw, bb: bb, cam: cam, proj: proj, place: place, tier: tier, KEY: KEY, KEY_L: KEY_L, guEl: guEl, guLite: guLite, cash: cash, MT: MT, ZOOM: ZOOM, chipHTML: chipHTML, GU_LBL: GU_LBL,
    mount: mount, draw: draw, lite: lite, fade: fade, drop: drop, guCam: guCam, guPad: guPad, zoomGu: zoomGu, dimGu: function () { return S.dim; },
    on: function () { return !!(S.el && S.el.isConnected && !S.out); },
    el: function () { return S.el && S.el.isConnected ? S.el : null; },
    last: function () { return S.last; },
    onTap: function (fn) { S.tap = fn; var p = W.__zgPend; W.__zgPend = null; if (p && fn) try { fn(p); } catch (e) {} },
    gus: function () { return S.el ? [].map.call(S.el.querySelectorAll(".zg-mk .zgu"), function (b) { return { n: b.dataset.gu, c: +b.dataset.n }; }) : []; },
    more: function () { var c = S.el && S.el.querySelector(".lm-gumore"); return c && !c.hidden ? +c.dataset.n || 0 : 0; },
  };
})();
