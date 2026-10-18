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
  var hyd = function () { return !!B.hyd || typeof W.ZP_count === "function"; };
  var S = function (i) { return i == null || i < 0 ? null : P.strs[i]; };
  var fmt = function (n) { try { return Number(n).toLocaleString("ko-KR"); } catch (e) { return String(n); } };
  var num = function (s) { var m = String(s || "").replace(/,/g, "").match(/(\d+)\s*곳\s*$/); return m ? +m[1] : 0; };
  var toCash = function (p) { for (var i = 1; i < KN.length; i++) if (p <= KN[i][0]) { var a = KN[i - 1][0], x = KN[i - 1][1], b = KN[i][0], y = KN[i][1], v = x + ((p - a) / (b - a)) * (y - x); return v < 2 ? Math.round(v * 10) / 10 : v < 10 ? Math.round(v * 2) / 2 : Math.round(v); } return KN[KN.length - 1][1]; };
  // 60_simple.js SHOW0와 같은 줄 수
  var show0 = function () { try { return matchMedia("(min-width:981px)").matches ? Math.max(6, Math.min(10, Math.floor((Math.min(innerHeight - 79, 902) - 144) / 75))) : 6; } catch (e) { return 6; } };
  var moreT = null;
  ["gap", "cash"].forEach(function (f) { P.st[f].forEach(function (s) { var t = S(s[0][6]); if (!moreT && t && /\d/.test(t)) moreT = t.replace(/[\d,]+(?=곳)/, "{n}"); }); });
  var cur = { f: P.def.f, i: STOPS.indexOf(P.def.c) };
  var dotEl = null;
  // 좁은 화면: 흐름선 때문에 이름·동네가 잘리거나 줄이 바뀌면 그 줄만 흐름선을 뺀다(60_simple.js fitSp와 같은 판정)
  var fit = function () {
    var ls = document.querySelectorAll("#sList li");
    for (var i = 0; i < ls.length; i++) {
      var li = ls[i]; if (!li.querySelector(".s-sp")) continue;
      li.classList.remove("s-nosp");
      var b = li.querySelector(".s-nm b"), sm = li.querySelector(".s-nm small");
      if ((b && b.scrollWidth > b.clientWidth + 1) || (sm && sm.getClientRects().length && sm.offsetHeight > parseFloat(getComputedStyle(sm).lineHeight || "0") * 1.5)) li.classList.add("s-nosp");
    }
  };

  function apply(f, i, fromInput) {
    var st = P.st[f] && P.st[f][i];
    if (!st || hyd()) return;
    cur.f = f; cur.i = i;
    var t = st[0], el;
    $("sN").textContent = S(t[0]);
    $("sNL").textContent = S(t[1]);
    $("sLT").textContent = S(t[2]);
    $("sLS").textContent = S(t[3]);
    $("sCashV").innerHTML = S(t[4]);
    $("sSum").innerHTML = S(t[5]);
    var n = show0(), L = $("sList"), tot = num(S(t[2]));
    L.innerHTML = st[1].slice(0, n).map(function (r) { return P.rows[r]; }).join("");
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
        var keys = ["cash", "homes", "first", "unit", "inc", "basis", "kind", "fund", "jr"];
        var c = new URLSearchParams(P.conds[cur.f] || ""), q = new URLSearchParams(location.search);
        keys.forEach(function (k) { q.delete(k); });
        if (STOPS[cur.i] === P.def.c) c.delete("cash"); else c.set("cash", String(STOPS[cur.i]));
        if (cur.f === "gap") { c.delete("fund"); c.delete("basis"); }
        c.forEach(function (v, k) { q.set(k, v); });
        var cq = new URLSearchParams(); c.forEach(function (v, k) { cq.set(k, v); });
        var s = cq.toString() ? "?" + cq.toString() : "", qs = q.toString();
        history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
        localStorage.setItem("jg-cond", s);
      } catch (e) {}
    };
    if (now) go(); else saveT = setTimeout(go, 250);
  }
  // 저장된 조건 → 섬이 그릴 수 있는 상태면 그 상태로(아니면 그대로 두고 전체 앱을 기다린다 — boot.js가 이미 부름)
  function initial() {
    try {
      var qs = location.search;
      if (!/[?&](cash|fund|inc|income)=/.test(qs)) qs = localStorage.getItem("jg-cond") || "";
      var q = new URLSearchParams(qs), f = "gap";
      if (["homes", "first", "unit", "inc", "income", "kind", "jr"].some(function (k) { return q.has(k); })) return;
      if (q.get("fund") === "cash" && q.get("basis") === "now") f = "cash";
      else if (q.has("basis") || (q.has("fund") && q.get("fund") !== "gap")) return;
      var c = q.has("cash") ? parseFloat(q.get("cash")) : 1, i = STOPS.indexOf(c);
      if (i < 0) return;
      if (f !== cur.f || i !== cur.i) apply(f, i);
    } catch (e) {}
  }
  // 지도 자리: 서울 구 윤곽 + 지금 금액으로 되는 구역 점(MapLibre가 뜨면 걷어 낸다)
  function ph() {
    var box = $("mapbox"), m = P.map;
    if (!box || !m || box.querySelector(".zp-ph")) return;
    var d = document.createElement("div");
    d.className = "zp-ph"; d.setAttribute("aria-hidden", "true");
    d.innerHTML = '<svg viewBox="' + [-4, -26, m.w + 8, m.h + 34].join(" ") + '" preserveAspectRatio="xMidYMid meet"><g class="zp-gu">' + m.gu.map(function (g) { return '<path d="' + g[1] + '"/>'; }).join("") + '</g><path class="zp-dot" d=""/></svg>';
    box.insertBefore(d, box.firstChild);
    dotEl = d.querySelector(".zp-dot");
    dots();
  }
  function dots() {
    if (!dotEl || !P.thr) return;
    var t = P.thr[cur.f], p = "";
    for (var k = 0; k < P.zones.length; k++) if (t[k] >= 0 && t[k] <= cur.i) p += "M" + (P.zones[k][0] - 6) + " " + P.zones[k][1] + "a6 6 0 1 0 12 0a6 6 0 1 0-12 0";
    dotEl.setAttribute("d", p);
  }
  function phDone() {
    var d = document.querySelector(".zp-ph");
    if (!d) return;
    var n = 0, tick = function () {
      var L = W.ZP_lmx, m = L && L.map && L.map(), lm = $("lmap"), sv = $("map");
      var real = m && lm && !lm.hidden && m.loaded && m.loaded() && m.areTilesLoaded && m.areTilesLoaded();
      var svg = sv && sv.childElementCount > 0 && (!lm || lm.hidden);
      if (real || svg || ++n > 400) { d.remove(); return; }
      setTimeout(tick, 150);
    };
    tick();
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
  document.addEventListener("pointerdown", function (e) { if (!hyd() && e.target && e.target.id === "sCash") coachOff(); }, true);
  document.addEventListener("keydown", function (e) { if (!hyd() && e.target && e.target.id === "sCash") coachOff(); }, true);
  document.addEventListener("input", function (e) {
    if (hyd() || e.target.id !== "sCash") return;
    coachOff();
    var v = +e.target.value;
    cancelAnimationFrame(rq);
    rq = requestAnimationFrame(function () { var i = STOPS.indexOf(toCash(v)); if (i >= 0 && (i !== cur.i || true)) apply(cur.f, i, true); save(false); });
  }, true);
  W.addEventListener("zp:hydrated", function () {
    phDone();
    var q = $("q");
    try { if (q && q.value) q.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
    pendCh.forEach(function (k) { try { var el = document.querySelector(k); if (el) el.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {} });
    if (pend) { try { var el = document.querySelector(pend); if (el) el.click(); } catch (e) {} }
    pend = null; pendCh = [];
  });
  W.addEventListener("resize", function () { if (!hyd() && $("sList").children.length !== Math.min(show0(), P.st[cur.f][cur.i][1].length)) apply(cur.f, cur.i, true); else fit(); });
  ph();
  initial();
  requestAnimationFrame(function () { setTimeout(function () { if (!hyd()) fit(); }, 0); });
  W.ZP_island = { ready: 1, set: function (f, c) { var i = STOPS.indexOf(c); if (i >= 0) apply(f, i); }, state: function () { return { f: cur.f, c: STOPS[cur.i] }; } };
  if (B.hyd) phDone();
})();
