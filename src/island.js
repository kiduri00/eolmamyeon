/* 첫 화면 섬(island) — 빌드가 h.<해시>.js로 내보낸다: window.__ZPH(미리 떠 둔 첫 화면 상태) + 이 코드.
   전체 앱(a·d)이 붙기 전까지 게이지·사는 방식·목록·'이 돈이면'·지도 자리 점을 앱이 그린 것과 똑같은 마크업으로 바꿔 끼운다.
   숫자·문구·목록 줄은 모두 빌드 때 실제 앱 계산으로 뜬 값(tools/prerender.js) → 앱이 붙어도 숫자가 바뀌지 않는다.
   앱이 붙으면(ZP_count가 생기면) 손을 떼고, 앱이 없던 동안 누른 단추는 'zp:hydrated' 때 한 번 다시 눌러 준다. */
(function () {
  var P = window.__ZPH;
  if (!P || !P.st) return;
  var B = window.ZP_boot || { full: function () {} };
  var H = document.documentElement, W = window;
  var $ = function (i) { return document.getElementById(i); };
  var KN = P.KN, STOPS = P.stops;
  // 23차: 목록 줄 자료는 따로(빌드 r.<해시>.json) — 바로 받아 두고, 받기 전에 바꾼 금액이 있으면 오는 대로 그 줄을 채운다
  var rowsWant = null;
  if (!P.rows && P.ru) {
    try {
      fetch(P.ru).then(function (r) { return r.ok ? r.json() : null; }).then(function (a) {
        if (!a) return; P.rows = a;
        if (rowsWant && !hyd()) { var w = rowsWant, st = P.st[w[0]] && P.st[w[0]][w[1]]; rowsWant = null; if (st && cur.f === w[0] && cur.i === w[1]) { var L = $("sList"); L.innerHTML = st[1].slice(0, show0()).map(function (r) { return P.rows[r]; }).join(""); fx(L, STOPS[w[1]]); } }
      }).catch(function () {});
    } catch (e) {}
  }
  var hyd = function () { return !!B.hyd || typeof W.ZP_count === "function"; };
  var S = function (i) { return i == null || i < 0 ? null : P.strs[i]; };
  var fmt = function (n) { try { return Number(n).toLocaleString("ko-KR"); } catch (e) { return String(n); } };
  var num = function (s) { var m = String(s || "").replace(/,/g, "").match(/(\d+)\s*곳\s*$/); return m ? +m[1] : 0; };
  var toCash = function (p) { for (var i = 1; i < KN.length; i++) if (p <= KN[i][0]) { var a = KN[i - 1][0], x = KN[i - 1][1], b = KN[i][0], y = KN[i][1], v = x + ((p - a) / (b - a)) * (y - x); return v < 2 ? Math.round(v * 10) / 10 : v < 10 ? Math.round(v * 2) / 2 : Math.round(v); } return KN[KN.length - 1][1]; };
  // 60_simple.js SHOW0와 같은 줄 수
  var show0 = function () { try { return matchMedia("(min-width:981px)").matches ? Math.max(6, Math.min(12, Math.floor((Math.min(innerHeight - 79, 902) - 120) / 84) + 2)) : 8; } catch (e) { return 8; } };
  // 목록 줄 '남는 돈 · 딱 맞아요'(60_simple cardHTML과 같은 식·같은 ZF.cash 꼴) — 미리 뜬 줄에는 비워 두고 여기서 채운다
  var cashT = function (v) { var a = Math.abs(v), m = Math.ceil(a * 100 - 1e-6); if (a < 0.005) return "0원"; if (m < 100) return (m * 100).toLocaleString("ko-KR") + "만"; var u = Math.ceil(a * 10 - 1e-6) / 10; return u.toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "억"; };
  function fx(L, c) {
    var li = L ? L.querySelectorAll("li[data-need]") : [];
    for (var k = 0; k < li.length; k++) {
      var n = +li[k].getAttribute("data-need"), el = li[k].querySelector(".s-fx"), a = li[k].querySelector("a.s-cm");
      if (!el || !isFinite(n)) continue;
      var left = Math.max(0, Math.round((c - n) * 100) / 100), fit = left <= c * 0.1 + 1e-9, t = fit ? "예산 거의 다 씀" : left >= 0.01 ? "예산에서 남는 돈 " + cashT(left) : "";
      el.innerHTML = fit ? '<em class="s-fit">예산 거의 다 씀</em>' : t ? '<span class="s-left">' + t + "</span>" : "";
      if (a && t && !/, (예산 거의 다 씀|예산에서 남는 돈)/.test(a.getAttribute("aria-label") || "")) a.setAttribute("aria-label", (a.getAttribute("aria-label") || "") + ", " + t);
    }
  }
  var moreT = null;
  ["gap", "cash"].forEach(function (f) { P.st[f].forEach(function (s) { var t = S(s[0][6]); if (!moreT && t && /\d/.test(t)) moreT = t.replace(/[\d,]+(?=곳)/, "{n}"); }); });
  var cur = { f: P.def.f, i: STOPS.indexOf(P.def.c) };
  var dotEl = null;
  var fit = function () {};   // 목록 카드에 흐름선이 없어 줄 맞춤이 필요 없다(리뉴얼 3단계)

  // 금액 막대(#sScrub) 막대그림: 앱 scrubMount·scrubPaint와 같은 마크업 — 첫 페인트부터 막대가 보이게(20차 G6 · 앱이 붙으면 같은 값으로 다시 그린다)
  var TICKS = [[0.5, "5,000만"], [2, "2억"], [5, "5억"], [15, "15억+"]];
  function bars(f, i) {
    var el = $("sScrub"); if (!el || el._scr) return;
    var B = el.querySelector(".scr-bars"); if (!B) return;
    var ps = P.pos, c = STOPS[i], N = STOPS.map(function (v, k) { var s0 = P.st[f] && P.st[f][k]; return s0 ? num(S(s0[0][0]) + "곳") : 0; }), mx = Math.max.apply(null, [1].concat(N));
    if (B.dataset.f !== f) {
      B.dataset.f = f;
      B.innerHTML = STOPS.map(function (v, k) { var a = k ? (ps[k - 1] + ps[k]) / 2 : 0, b = k < ps.length - 1 ? (ps[k] + ps[k + 1]) / 2 : 100, n = N[k]; return '<i data-c="' + v + '" data-n="' + n + '" style="left:' + a.toFixed(2) + "%;width:" + (b - a).toFixed(2) + "%;height:" + (n ? Math.max(8, Math.round((n / mx) * 100)) : 4) + '%"></i>'; }).join("");
      if (!el.querySelector(".scr-h")) el.insertAdjacentHTML("beforeend", '<i class="scr-h" aria-hidden="true"></i><div class="scr-t" aria-hidden="true">' + TICKS.map(function (x) { var k = STOPS.indexOf(x[0]); return '<span style="left:' + (k >= 0 ? ps[k] : 0) + '%">' + x[1] + "</span>"; }).join("") + "</div>");
    }
    for (var k = 0; k < B.children.length; k++) { var v = +B.children[k].getAttribute("data-c"); B.children[k].classList.toggle("on", v <= c + 1e-9); B.children[k].classList.toggle("cur", Math.abs(v - c) < 1e-9); }
    el.style.setProperty("--p", ps[i] + "%");
  }
  function apply(f, i, fromInput, still) {
    var st = P.st[f] && P.st[f][i];
    if (!st || hyd()) return;
    cur.f = f; cur.i = i;
    var t = st[0], el;
    $("sN").textContent = S(t[0]);
    // 주소의 금액으로 처음 맞출 때는 숫자를 굴리지 않는다(9 → 54로 올라가던 것 · 20차 G6)
    el = $("sNB"); if (el) { if (still) { el.style.transition = "none"; } el.style.setProperty("--n", String(num(S(t[0]) + "곳"))); if (still) { void el.offsetWidth; requestAnimationFrame(function () { requestAnimationFrame(function () { el.style.transition = ""; }); }); } }
    try { bars(f, i); } catch (e) {}
    $("sNL").textContent = S(t[1]);
    $("sLT").textContent = S(t[2]);
    $("sLS").textContent = S(t[3]);
    $("sCashV").innerHTML = S(t[4]);
    $("sSum").innerHTML = S(t[5]);
    var n = show0(), L = $("sList"), tot = num(S(t[2]));
    if (P.rows) { L.innerHTML = st[1].slice(0, n).map(function (r) { return P.rows[r]; }).join(""); fx(L, STOPS[i]); }
    else rowsWant = [f, i];   // 줄 자료(r.json)가 아직이면 오는 대로 이 금액의 줄을 채운다
    el = $("sMore");
    if (el) { el.hidden = !(tot > n); if (tot > n && moreT) el.textContent = moreT.replace("{n}", fmt(tot - n)); }
    el = $("sAsm");
    if (el) { var a = S(t[7]); el.hidden = a == null; if (a != null) { el.innerHTML = a; if (S(t[8]) != null) el.setAttribute("aria-label", S(t[8])); } }
    el = $("sCash");
    if (el) {
      el.style.setProperty("--p", S(t[9]));
      if (S(t[10]) != null) el.setAttribute("aria-valuetext", S(t[10]));
      if (!fromInput && Math.abs(+el.value - P.pos[i]) > 0.6) el.value = P.pos[i];
    }
    el = $("sScrub");
    if (el && el.getAttribute("role") === "slider") { el.setAttribute("aria-valuenow", String(Math.min(15, Math.max(0.5, STOPS[i])))); if (S(t[10]) != null) el.setAttribute("aria-valuetext", S(t[10])); }
    var bs = document.querySelectorAll(".s-mode button");
    for (var k = 0; k < bs.length; k++) if (st[2][k] != null) bs[k].setAttribute("aria-pressed", st[2][k]);
    H.classList.toggle("gapm", !!st[3]);
    el = $("pCash"); if (el) el.value = String(STOPS[i]);
    dots();
    fit();
  }
  // 앱과 같은 자리(주소 ?cash=…·localStorage jg-cond)에 남겨 → 앱이 붙을 때 그대로 이어받는다
  var saveT = 0;
  function save(now) {
    clearTimeout(saveT);
    var go = function () {
      if (hyd()) return;
      try {
        var keys = ["cash", "mode", "homes", "first", "unit", "inc", "basis", "kind", "fund", "jr"];
        var c = new URLSearchParams(P.conds[cur.f] || ""), q = new URLSearchParams(location.search);
        keys.forEach(function (k) { q.delete(k); });
        // 주소 꼴 ?cash=1&mode=jeonse(앱 condQuery와 같음) — 금액·방식은 늘 적는다
        c.delete("fund"); c.set("cash", String(STOPS[cur.i])); c.set("mode", cur.f === "cash" ? "loan" : "jeonse");
        if (cur.f === "gap") c.delete("basis");
        // 사이클 3: 조건은 주소에 싣지 않는다(window.ZP_CQ · jg-cond만) — 서버 요청에 금액이 실리지 않게
        var cq = new URLSearchParams(); c.forEach(function (v, k) { cq.set(k, v); });
        var s = cq.toString() ? "?" + cq.toString() : "", qs = q.toString();
        window.ZP_CQ = s;
        history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
        localStorage.setItem("jg-cond", s);
      } catch (e) {}
    };
    if (now) go(); else saveT = setTimeout(go, 250);
  }
  // 저장된 조건 → 섬이 그릴 수 있는 상태면 그 상태로(아니면 그대로 두고 전체 앱을 기다린다 — boot.js가 이미 부름)
  function initial() {
    try {
      var qs = window.ZP_CQ || "";
      if (!/[?&](cash|mode|fund|inc|income)=/.test(qs)) qs = localStorage.getItem("jg-cond") || "";
      var q = new URLSearchParams(qs), f = "gap";
      if (["homes", "first", "unit", "inc", "income", "kind", "jr"].some(function (k) { return q.has(k); })) return;
      // 대출 끼고(mode=loan · 예전 fund=cash)는 '지금 매수' 기준이 기본(basis 생략) — 그 밖의 기준은 앱을 기다린다
      var loan = q.get("mode") === "loan" || q.get("fund") === "cash";
      if (loan) { if (q.has("basis") && q.get("basis") !== "now") return; f = "cash"; }
      else if ((q.has("basis") && q.get("basis") !== "total") || (q.has("fund") && q.get("fund") !== "gap")) return;
      var c = q.has("cash") ? parseFloat(q.get("cash")) : 1, i = STOPS.indexOf(c);
      if (i < 0) return;
      if (f !== cur.f || i !== cur.i) apply(f, i, false, true); else try { bars(f, i); } catch (e) {}
    } catch (e) {}
  }
  // 지도 자리: 실제 지도와 같은 구 묶음·범례·'+N곳' 칩(src/ghost.js · 지금 금액의 구별 곳 수) — 앱이 붙으면 앱(10_lmap.js)이 이어받고, 실제 지도가 다 그려지면 걷힌다
  function ghostSt() {
    var t = P.thr && P.thr[cur.f], cnt = {}, ok = [], ids = [], min = {}, ni = cur.f === "cash" ? 5 : 4;
    if (t) for (var k = 0; k < P.zones.length; k++) if (t[k] >= 0 && t[k] <= cur.i) { var z = P.zones[k], v = z[ni]; cnt[z[0]] = (cnt[z[0]] || 0) + 1; if (z[1] != null) ok.push([z[1], z[2], z[0]]); if (z[3]) ids.push(z[3]); if (v != null && (min[z[0]] == null || v < min[z[0]])) min[z[0]] = v; }
    return { cnt: cnt, ok: ok, ids: ids, min: min };
  }
  function ph() {
    if (!W.ZP_G || !P.thr || !$("mapbox")) return;
    W.ZP_G.mount($("mapbox"));
    dots();
  }
  var dragI = false;
  function dots() {
    if (!W.ZP_G || !W.ZP_G.on() || hyd()) return;
    var g = ghostSt();
    if (dragI) W.ZP_G.lite(g.cnt, g.ids, g.min); else W.ZP_G.draw(g);
  }
  // 앱이 붙기 전에 누른 단추: 앱이 붙으면 마지막 것 한 번만 다시
  var pend = null, pendCh = [];
  var keyOf = function (el) {
    if (el.id) return "#" + el.id;
    var at = ["data-why", "data-id", "data-k", "data-f", "data-v", "data-menu", "data-nav", "data-m", "aria-controls"], sel = el.tagName.toLowerCase();
    for (var i = 0; i < at.length; i++) if (el.hasAttribute(at[i])) { sel += "[" + at[i] + '="' + el.getAttribute(at[i]) + '"]'; break; }
    var p = el.parentElement, path = sel;
    while (p && !p.id && p !== document.body) p = p.parentElement;
    if (sel === el.tagName.toLowerCase()) {
      var sib = el.parentElement ? [].filter.call(el.parentElement.children, function (x) { return x.tagName === el.tagName; }) : [];
      path = sel + ":nth-of-type(" + (sib.indexOf(el) + 1) + ")";
      if (el.parentElement && el.parentElement !== p) path = keyOf(el.parentElement) + " > " + path;
      else if (p && p.id) path = "#" + p.id + " > " + path;
      return path;
    }
    return (p && p.id ? "#" + p.id + " " : "") + path;
  };
  var wait = function () { H.classList.add("zp-wait"); };
  document.addEventListener("click", function (e) {
    if (hyd()) return;
    var t = e.target, b = t.closest && t.closest("button,[role=button],[role=tab]");
    if (!b) return;
    if (b.closest(".zp-ph")) { wait(); return; }   // 지도 자리 그림의 누르기는 ghost.js가 받아 두었다가 앱에 넘긴다(ZP_G.onTap)
    var mo = b.closest(".s-mode");
    if (mo && b.dataset.f) { apply(b.dataset.f === "cash" ? "cash" : "gap", cur.i); save(true); return; }
    if (b.closest("#sSum") && b.dataset.id) { location.hash = "#" + b.dataset.id; wait(); return; }
    if (b.closest("#sCash")) return;
    try { pend = keyOf(b); } catch (er) { pend = null; }
    wait();
  }, true);
  document.addEventListener("change", function (e) {
    if (hyd()) return;
    var t = e.target;
    if (t.id === "sCash") { coachOff(); var i = STOPS.indexOf(toCash(+t.value)); if (i >= 0) apply(cur.f, i, true); save(true); return; }
    if (t.tagName === "SELECT") { try { pendCh.push(keyOf(t)); } catch (er) {} wait(); }
  }, true);
  var rq = 0;
  // 섬에서 게이지를 만졌으면 앱이 붙은 뒤 '끌어서 맞춰 보세요' 안내를 띄우지 않는다(60_simple.js coach와 같은 키)
  var coachOff = function () { try { localStorage.setItem("emr.coach1", "1"); } catch (e) {} };
  document.addEventListener("pointerdown", function (e) { if (!hyd() && e.target && e.target.id === "sCash") { coachOff(); dragI = true; } }, true);
  W.addEventListener("pointerup", function () { if (dragI) { dragI = false; if (!hyd()) dots(); } }, true);
  var keyQ = [];
  document.addEventListener("keydown", function (e) {
    if (!e.target) return;
    // 앱 코드는 실렸지만 막대 키 처리(scrubMount)가 아직 안 붙은 틈에 누른 키: 받아 두었다가 앱이 붙으면 그대로 다시 누른다(키가 사라지지 않게)
    if (hyd() && e.target.id === "sScrub" && !e.target._scr && /^(Arrow(Left|Right|Up|Down)|Page(Up|Down)|Home|End)$/.test(e.key)) { e.preventDefault(); keyQ.push(e.key); return; }
    if (hyd()) return;
    if (e.target.id === "sCash") coachOff();
    // 앱이 붙기 전에도 금액 막대(role=slider)를 키보드로 — 누른 키가 사라지지 않게 섬이 바로 칸을 옮긴다(앱 scrubMount와 같은 칸 · 20차)
    if (e.target.id === "sScrub") {
      var k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key];
      var j = k != null ? cur.i + k : e.key === "Home" ? 0 : e.key === "End" ? STOPS.length - 1 : null;
      if (j == null) return;
      e.preventDefault(); coachOff();
      j = Math.max(STOPS.indexOf(0.5) >= 0 ? STOPS.indexOf(0.5) : 0, Math.min(STOPS.length - 1, j));
      if (j !== cur.i) { apply(cur.f, j); save(true); }
    }
  }, true);
  document.addEventListener("input", function (e) {
    if (hyd() || e.target.id !== "sCash") return;
    coachOff();
    var v = +e.target.value;
    cancelAnimationFrame(rq);
    rq = requestAnimationFrame(function () { var i = STOPS.indexOf(toCash(v)); if (i >= 0 && (i !== cur.i || true)) apply(cur.f, i, true); save(false); });
  }, true);
  W.addEventListener("zp:hydrated", function () {
    var sc = $("sScrub"); keyQ.splice(0).forEach(function (k) { try { sc.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); } catch (e) {} });
    var q = $("q");
    try { if (q && q.value) q.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
    pendCh.forEach(function (k) { try { var el = document.querySelector(k); if (el) el.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {} });
    if (pend) { try { var el = document.querySelector(pend); if (el) el.click(); } catch (e) {} }
    pend = null; pendCh = [];
  });
  W.addEventListener("resize", function () { if (!hyd() && $("sList").children.length !== Math.min(show0(), P.st[cur.f][cur.i][1].length)) apply(cur.f, cur.i, true); else fit(); });
  ph();
  initial();
  fx($("sList"), STOPS[cur.i]);
  requestAnimationFrame(function () { setTimeout(function () { if (!hyd()) fit(); }, 0); });
  W.ZP_island = { ready: 1, set: function (f, c) { var i = STOPS.indexOf(c); if (i >= 0) apply(f, i); }, state: function () { return { f: cur.f, c: STOPS[cur.i] }; } };
})();
