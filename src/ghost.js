/* 지도 자리 그림(ghost) — 실제 지도(MapLibre)가 붙기 전에 지도 칸에 보이는 가벼운 SVG/DOM 지도(19차).
   실제 지도와 같은 것만 쓴다: 같은 투영(웹 메르카토르 512 타일) · 같은 첫 카메라(ZP_G.cam) · 같은 구 묶음 자리 잡기(ZP_G.place)
   · 같은 범례·'+N곳 N개 구' 칩·확대 버튼 마크업 → 실제 지도가 붙어도 구 묶음이 제자리에 그대로 있고 바탕(타일)만 서서히 나타난다.
   첫 화면 섬(h.js)과 전체 앱(a.js)이 같은 이 코드를 쓴다(먼저 실린 쪽 하나만 살아 있음). 경계 자료는 빌드가 넣는다(tools/ghost_geo.py). */
(function () {
  if (window.ZP_G) return;
  var GD = /*GHOST*/ null;
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
  var hit = function (a, b) { return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]; };
  var tier = function (c, m) { return c / m > 0.6 ? 3 : c / m > 0.25 ? 2 : 1; };
  // 구 묶음 자리 잡기(실제 지도 guLayout과 같은 함수): 겹치면 ① 둘레로 비켜 ② 작게 ③ 안 되면(또는 화면 밖) '+N곳' 칩으로
  function place(o) {
    var w = o.W, h = o.H, obs = o.obs || [], phone = o.phone;
    var L = o.gus.slice().sort(function (a, b) { return b.c - a.c; });
    var m = 1; L.forEach(function (x) { if (x.c > m) m = x.c; });
    var ANG = [0, 1, 2, 3, 4, 5, 6, 7].map(function (k) { return (k * Math.PI) / 4 + Math.PI / 2; });
    var run = function (extra) {
      var placed = extra ? [extra] : [], keep = [], left = [];
      var free = function (bx) { return bx[0] >= 2 && bx[2] <= w - 2 && bx[1] >= 2 && bx[3] <= h - 2 && !obs.some(function (q) { return hit(q, bx); }) && !placed.some(function (q) { return hit(q, bx); }); };
      L.forEach(function (g0) {
        if (!g0.c) return;
        var g = { n: g0.n, ll: g0.ll, c: g0.c }, q = o.proj(g.ll), sn = g.n.length > 2 ? g.n.replace(/구$/, "") : g.n;
        if (q.x < -8 || q.x > w + 8 || q.y < -8 || q.y > h + 8) { left.push(g); return; }
        var got = null;
        for (var s = 0; s < 2 && !got; s++) {
          var sm = s === 1, d = sm ? Math.max(32, Math.max(tw(sn, 10), tw("가능 " + g.c, 10)) + 6) : Math.max(phone ? 42 : 46, Math.max(tw(sn, 12), tw("가능 " + g.c, 11)) + 14);
          var RR = sm ? [0, d * 0.45, d * 0.75, d * 1.05, d * 1.4, d * 1.8] : [0, d * 0.45, d * 0.75, d * 1.05];
          for (var i = 0; i < RR.length && !got; i++) {
            var A = RR[i] ? ANG : [0];
            for (var j = 0; j < A.length; j++) {
              var x = q.x + RR[i] * Math.cos(A[j]), y = q.y + RR[i] * Math.sin(A[j]), bx = [x - d / 2, y - d / 2, x + d / 2, y + d / 2];
              if (free(bx)) { got = { bx: bx, d: d, sm: sm, dx: x - q.x, dy: y - q.y }; break; }
            }
          }
        }
        if (!got) { left.push(g); return; }
        placed.push(got.bx);
        g.sn = sn; g.d = got.d; g.sm = got.sm; g.dx = Math.round(got.dx); g.dy = Math.round(got.dy); g.t = tier(g.c, m); g.q = q;
        keep.push(g);
      });
      return { keep: keep, left: left };
    };
    var r = run(null);
    if (r.left.length) r = run(o.chip);
    return r;
  }
  var KEY = '<span><i class="k-gu"></i>많음</span><span><i class="k-gu k-gu2"></i>적음</span><span>숫자 = 갈 수 있는 곳</span>';
  var KEY_L = "범례: 구 묶음 숫자는 그 구에서 갈 수 있는 곳 수, 진한 원은 많은 구, 옅은 원은 적은 구";
  var fmt = function (n) { try { return Number(n).toLocaleString("ko-KR"); } catch (e) { return String(n); } };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function chipHTML(L, c) {
    return '<button type="button" class="lm-gumore-b" aria-expanded="false" aria-label="지도에 다 못 보인 ' + L.length + "개 구, 갈 수 있는 곳 " + fmt(c) + '곳 더 보기">+' + fmt(c) + "곳 <small>" + L.length + '개 구</small></button><ul class="lm-gumore-l">' + L.map(function (g) { return '<li><button type="button" data-gu="' + esc(g.n) + '">' + esc(g.n) + " <b>가능 " + fmt(g.c) + "</b></button></li>"; }).join("") + "</ul>";
  }
  var ZOOM = '<button type="button" data-z="full" class="lm-fs" aria-label="지도 크게 보기" aria-pressed="false" title="지도 크게 보기"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" data-z="1" aria-label="확대"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button><button type="button" data-z="-1" aria-label="축소"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button>';
  var GU_LBL = function (n, c) { return n + ", 갈 수 있는 곳 " + fmt(c) + "곳, 눌러서 " + n + " 보기"; };
  // 구 묶음 한 개의 마크업(실제 지도 gusSet과 같은 꼴)
  function guEl(el, g) {
    el.className = "zgu t" + g.t + (g.sm ? " sm" : "");
    el.dataset.n = String(g.c); el.dataset.gu = g.n;
    el.style.setProperty("--d", g.d + "px");
    el.innerHTML = "<b>" + esc(g.sn) + "</b><span>가능 " + fmt(g.c) + "</span>";
    el.setAttribute("aria-label", GU_LBL(g.n, g.c));
  }
  // ---------------------------------------------------------------- 자리 그림 DOM
  var S = { el: null, box: null, st: null, tap: null, ro: null, last: null, out: false };
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
    d.addEventListener("click", function (e) {
      var t = e.target, b = t.closest && t.closest("button");
      if (b && b.closest(".lm-gumore") && b.classList.contains("lm-gumore-b")) { var ch = b.parentNode, on = ch.classList.toggle("open"); b.setAttribute("aria-expanded", String(on)); go({ chip: 1 }); return; }
      var a = b && (b.dataset.gu ? { gu: b.dataset.gu } : b.dataset.z ? { zoom: b.dataset.z } : null);
      if (b && b.dataset.gu && b.closest(".lm-gumore")) b.closest(".lm-gumore").classList.remove("open");
      if (b && a) { b.classList.add("zg-busy"); go(a); return; }
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
    Dc.querySelectorAll(".s-mini, .s-fullx").forEach(function (e) { if (e.offsetWidth && !e.hidden) add(e.getBoundingClientRect()); });
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
      var m = ov(".s-mini"); if (m && m.width > cv.width * 0.6 && m.top <= cv.top + 40) P.top = Math.round(m.bottom - cv.top + 10);
      var x = ov(".s-fullx"); if (x) P.bottom = Math.round(cv.bottom - x.top + 6);
    } catch (e) {}
    return P;
  }
  // st = { cnt: {구: 곳 수}, ok: [[lat,lng]…] (갈 수 있는 곳 좌표), pad?: 실제 지도 여백, cam?: 정해진 카메라 }
  function draw(st) {
    S.st = st;
    var el = mount(S.box || Dc.getElementById("mapbox"));
    if (!el || S.out) return null;
    var box = S.box; short(box);
    var w = el.clientWidth, h = el.clientHeight;
    if (w < 50 || h < 50) return null;
    var phone = phoneQ(), pad = st.pad || padOf(el, box);
    var C = st.cam || cam(bb(st.ok, st.cnt, phone), w, h, pad, phone, 12);
    if (!C) return null;
    S.last = C;
    var P = proj(C, w, h), ws = 512 * Math.pow(2, C.z), k = ws / GD.S, tx = (GD.o[0] / GD.S - mx(C.c[0])) * ws + w / 2, ty = (GD.o[1] / GD.S - my(C.c[1])) * ws + h / 2;
    var mpp = (40075016.7 * Math.cos((C.c[1] * Math.PI) / 180)) / ws;
    // 구 묶음
    var gus = GD.gu.map(function (g) { return { n: g[0], ll: [g[1], g[2]], c: (st.cnt && st.cnt[g[0]]) || 0 }; });
    var key = el.querySelector(".lm-key"), cb = el.getBoundingClientRect(), ky = h - 40;
    try { if (key.offsetWidth) ky = key.getBoundingClientRect().top - cb.top - 6; } catch (e) {}
    var R = place({ W: w, H: h, obs: obsOf(el, box), gus: gus, proj: P, phone: phone, chip: [4, ky - 36, 120, ky] });
    var mk = el.querySelector(".zg-mk"), have = {};
    [].forEach.call(mk.children, function (b) { have[b.dataset.gu] = b; });
    R.keep.forEach(function (g) {
      var b = have[g.n]; delete have[g.n];
      if (!b) { b = Dc.createElement("button"); b.type = "button"; b.tabIndex = -1; mk.appendChild(b); }
      guEl(b, g);
      b.style.transform = "translate(" + Math.round(g.q.x + g.dx) + "px," + Math.round(g.q.y + g.dy) + "px) translate(-50%,-50%)";
    });
    for (var n in have) have[n].remove();
    // '+N곳 N개 구' 칩
    var ch = el.querySelector(".lm-gumore"), c = R.left.reduce(function (a, g) { return a + g.c; }, 0);
    ch.hidden = !c;
    if (c) { var kk = R.left.map(function (g) { return g.n + g.c; }).join(","); if (ch.dataset.k !== kk) { ch.dataset.k = kk; ch.innerHTML = chipHTML(R.left, c); ch.classList.remove("open"); } ch.dataset.n = String(c); ch.style.top = Math.max(6, Math.round(ky - 36)) + "px"; }
    // 바탕: 땅 · 한강 · 구 경계(점선) · 서울 밖 옅게 · 서울 경계 · 묶음 없는 구 이름
    var txt = "", used = R.keep.map(function (g) { var x = g.q.x + g.dx, y = g.q.y + g.dy; return [x - g.d / 2, y - g.d / 2, x + g.d / 2, y + g.d / 2]; }).concat(obsOf(el, box));
    var fs = C.z <= 10 ? 10.5 : C.z >= 12.5 ? 12.5 : 10.5 + (C.z - 10) * 0.8;
    GD.gu.forEach(function (g) {
      if (R.keep.some(function (x) { return x.n === g[0]; })) return;
      var q = P([g[1], g[2]]), tw0 = tw(g[0], fs) + 4, bx = [q.x - tw0 / 2, q.y - fs * 0.7, q.x + tw0 / 2, q.y + fs * 0.7];
      if (bx[0] < 2 || bx[2] > w - 2 || bx[1] < 2 || bx[3] > h - 2 || used.some(function (u) { return hit(u, bx); })) return;
      used.push(bx);
      txt += '<text x="' + q.x.toFixed(1) + '" y="' + (q.y + fs * 0.35).toFixed(1) + '" font-size="' + fs.toFixed(1) + '">' + g[0] + "</text>";
    });
    var M = "M-9e5 -9e5H9e5V9e5H-9e5Z";
    el.querySelector(".zg-bg").innerHTML = '<rect class="zg-land" width="100%" height="100%"/><g transform="matrix(' + [k, 0, 0, k, tx, ty].map(function (v) { return +v.toFixed(5); }).join(" ") + ')">'
      + (GD.rv ? '<path class="zg-river" d="' + GD.rv + '" vector-effect="non-scaling-stroke" style="stroke-width:' + Math.max(6, Math.min(80, 950 / mpp)).toFixed(1) + 'px"/>' : "")
      + '<path class="zg-gu" d="' + GD.gp + '" vector-effect="non-scaling-stroke"/>'
      + '<path class="zg-mask" fill-rule="evenodd" d="' + M + GD.sp + '"/>'
      + '<path class="zg-seoul" d="' + GD.sp + '" vector-effect="non-scaling-stroke"/></g><g class="zg-t">' + txt + "</g>";
    return { cam: C, keep: R.keep, left: R.left, more: c };
  }
  // 끄는 동안: 자리는 그대로 숫자·농도만(실제 지도 dragLite와 같음)
  function lite(cnt) {
    if (!S.el || S.out) return;
    var m = 1; for (var k in cnt) if (cnt[k] > m) m = cnt[k];
    [].forEach.call(S.el.querySelectorAll(".zg-mk .zgu"), function (b) {
      var c = cnt[b.dataset.gu] || 0; if (+b.dataset.n === c) return;
      b.dataset.n = String(c); var sp = b.querySelector("span"); if (sp) sp.textContent = "가능 " + fmt(c);
      b.classList.remove("t1", "t2", "t3"); b.classList.add("t" + tier(c, m)); b.classList.toggle("z0", !c);
    });
    var ch = S.el.querySelector(".lm-gumore");
    if (ch && !ch.hidden) { var t = 0; [].forEach.call(ch.querySelectorAll("button[data-gu]"), function (b) { t += cnt[b.dataset.gu] || 0; }); ch.dataset.n = String(t); var bb0 = ch.querySelector(".lm-gumore-b"); if (bb0 && bb0.firstChild) bb0.firstChild.textContent = "+" + fmt(t) + "곳 "; }
  }
  // 실제 지도가 바탕까지 다 그린 뒤: 200ms 동안 서서히 걷어 낸다(빈 회색 화면 없음)
  function fade() {
    var el = S.el; if (!el || S.out) return;
    S.out = true;
    if (S.ro) { S.ro.disconnect(); S.ro = null; }
    var rm = function () { if (el.isConnected) el.remove(); };
    var rd = false; try { rd = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    if (rd) return rm();
    el.classList.add("zg-out"); setTimeout(rm, 260);
  }
  function drop() { if (S.el) { S.out = true; if (S.ro) { S.ro.disconnect(); S.ro = null; } S.el.remove(); } }
  W.ZP_G = {
    GD: GD, tw: tw, bb: bb, cam: cam, proj: proj, place: place, tier: tier, KEY: KEY, KEY_L: KEY_L, ZOOM: ZOOM, chipHTML: chipHTML, GU_LBL: GU_LBL,
    mount: mount, draw: draw, lite: lite, fade: fade, drop: drop,
    on: function () { return !!(S.el && S.el.isConnected && !S.out); },
    el: function () { return S.el && S.el.isConnected ? S.el : null; },
    last: function () { return S.last; },
    onTap: function (fn) { S.tap = fn; var p = W.__zgPend; W.__zgPend = null; if (p && fn) try { fn(p); } catch (e) {} },
    gus: function () { return S.el ? [].map.call(S.el.querySelectorAll(".zg-mk .zgu"), function (b) { return { n: b.dataset.gu, c: +b.dataset.n }; }) : []; },
    more: function () { var c = S.el && S.el.querySelector(".lm-gumore"); return c && !c.hidden ? +c.dataset.n || 0 : 0; },
  };
})();
