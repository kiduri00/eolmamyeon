/* ===================== renew-feat 기능 묶음(/b/f.*.js) — 처음 쓸 때 받는다 =====================
   앱 닫힘 범위 밖이라 값·함수는 ctx(app.js featCtx)로만 받는다. 숫자는 시트·정적 /z와 같은 함수(ctx.nums · ctx.pace · ctx.rights)에서.
   모든 추정에는 범위·'추정' 표기와 출처를 붙인다. */
(function () {
  "use strict";
  const F = (window.ZPF = window.ZPF || {});
  F.v = 1;
  F.mods = F.mods || {};
  const CSS = "__FCSS__";
  F.css = () => { if (document.getElementById("zpfCss")) return; const s = document.createElement("style"); s.id = "zpfCss"; s.textContent = CSS; document.head.appendChild(s); };
  // 날짜: 'YYYY-MM-DD' ↔ 연(소수) · 보이는 꼴 YYYY.M
  // 연 = 1970 + UTC 밀리초 ÷ 365.25일 (QA 파이썬 기준식과 같은 셈)
  const YMS = 365.25 * 864e5;
  F.yr = (d) => { const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(d || "")); return m ? 1970 + Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1)) / YMS : null; };
  F.ym = (y) => { if (y == null || !isFinite(y)) return "–"; const t = new Date((y - 1970) * YMS); return `${t.getUTCFullYear()}.${t.getUTCMonth() + 1}`; };
  F.ymd = (d) => String(d || "").replace(/^(\d{4})-(\d{2})-(\d{2}).*/, (m, y, a, b) => `${y}.${+a}.${+b}`);
  F.dur = (y) => (y == null || !isFinite(y) ? "–" : y < 1 ? `${Math.max(1, Math.round(y * 12))}개월` : `${(Math.round(y * 10) / 10).toFixed(1).replace(/\.0$/, "")}년`);
  F.asOf = (ctx) => F.yr(ctx.D.asOf) || new Date().getFullYear() + new Date().getMonth() / 12;
  // 시트 탭에 붙이기: 같은 자리(data-f)가 있으면 바꿔 끼운다(탭을 다시 그려도 한 번만)
  F.put = (pane, key, html, where) => {
    let el = pane.querySelector(`[data-f="${key}"]`);
    if (!html) { if (el) el.remove(); return null; }
    const box = document.createElement("div"); box.innerHTML = html.trim(); const n = box.firstElementChild; n.setAttribute("data-f", key);
    if (el) el.replaceWith(n); else if (typeof where === "function") where(n); else pane.appendChild(n);
    return n;
  };
  F.pane = (tab, r, pane, ctx) => {
    F.css();
    Object.values(F.mods).forEach((m) => { if (m.tab === tab) { try { m.run(r, pane, ctx); } catch (e) { console.warn("feat", m.key, e); } } });
  };
})();
