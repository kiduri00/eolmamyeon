/* F7 내 시나리오 저장·공유 — 금액·사는 방식·주택 수·생애최초·평형·연소득·기준·유형·전세가율(계산기 주소 조건 condQuery 그대로)
   + 매달 모으는 돈(svMon) · 비례율(aRatio) · 시세 상승률(aGrowth) · 대출 금리(aRate)를 이름 붙여 이 기기(localStorage 'zp-scen')에 저장
   불러오기 = 그 조건 주소로 다시 열기(첫 화면·목록·지도·시트·관심·소식 미리보기까지 모두 같은 조건으로) · 공유 = 같은 주소 */
(function () {
  "use strict";
  const X = window.ZPX;
  const KEY = "zp-scen", MAX = 10;
  const XID = [["sv", "svMon"], ["ar", "aRatio"], ["ag", "aGrowth"], ["at", "aRate"]];
  X.scenList = () => { const a = X.get(KEY, []); return Array.isArray(a) ? a.filter((s) => s && typeof s.n === "string" && typeof s.q === "string").slice(0, MAX) : []; };
  // 지금 화면의 조건 → 시나리오 하나
  X.scenNow = (ctx, name) => {
    const x = {}; XID.forEach(([k, id]) => { const el = document.getElementById(id); const v = el && String(el.value || "").trim(); if (v) x[k] = v.slice(0, 12); });
    return { n: String(name || "").trim().slice(0, 20), q: ctx.condQ(), x, at: new Date().toISOString().slice(0, 10) };
  };
  // 시나리오 → 주소(?조건&sv=…#planner)
  X.scenURL = (ctx, s) => {
    const base = location.href.split(/[?#]/)[0], q = new URLSearchParams((s.q || "").replace(/^\?/, ""));
    XID.forEach(([k]) => { if (s.x && s.x[k] != null && s.x[k] !== "") q.set(k, s.x[k]); });
    return base + "?" + q.toString() + "#planner";
  };
  // 한 줄 요약(저장 목록·공유 미리보기)
  X.scenSum = (ctx, s) => {
    const q = new URLSearchParams((s.q || "").replace(/^\?/, "")), b = [];
    const c = parseFloat(q.get("cash")); if (isFinite(c)) b.push(`내 돈 ${ctx.ZF.cash(c)}`);
    b.push(q.get("mode") === "loan" ? "대출 끼고" : "전세 끼고");
    const h = q.get("homes"); b.push(h === "1" ? "1주택" : h === "2" ? "다주택" : "무주택");
    if (q.get("inc")) b.push(`연소득 ${q.get("inc")}`);
    if (s.x && s.x.sv) b.push(`매달 ${s.x.sv}만`);
    if (s.x && s.x.ar) b.push(`비례율 ${s.x.ar}%`);
    if (s.x && s.x.ag) b.push(`상승 연 ${s.x.ag}%`);
    return b.join(" · ");
  };
  X.scenApply = (ctx, s) => {
    const u = new URL(X.scenURL(ctx, s));
    if (u.search === location.search) { location.hash = "planner"; location.reload(); }
    else location.assign(u.toString());
  };
  const html = (ctx) => {
    const esc = ctx.esc, L = X.scenList();
    return `<form class="zx-sf" data-sc-form><label for="zxScN">지금 조건에 이름 붙여 저장</label><div class="zx-sr"><input id="zxScN" maxlength="20" placeholder="예: 3억 전세 끼고" autocomplete="off" required><button type="submit" class="btn primary">저장</button></div>
      <p class="zx-sn">${esc(X.scenSum(ctx, X.scenNow(ctx, "")))}</p></form>
      ${L.length ? `<ul class="zx-sl">${L.map((s, i) => `<li><div><b>${esc(s.n)}</b><small>${esc(X.scenSum(ctx, s))} · ${esc(s.at || "")} 저장</small></div><div class="zx-sa"><button type="button" class="btn secondary" data-sc-go="${i}">불러오기</button><button type="button" class="btn secondary" data-sc-sh="${i}">공유</button><button type="button" class="zx-rm" data-sc-rm="${i}" aria-label="${esc(s.n)} 지우기">지우기</button></div></li>`).join("")}</ul><span class="share-fb" data-sc-fb aria-live="polite"></span>` : `<p class="zx-empty">저장한 시나리오가 없어요. 금액·사는 방식·소득·모으는 돈·비례율 같은 가정을 바꿔 가며 이름 붙여 두면, 한 번에 다시 불러올 수 있어요.</p>`}
      <p class="zx-src">이 기기에만 저장돼요(최대 ${MAX}개) · 불러오면 모든 화면이 그 조건으로 다시 계산돼요 · 공유 링크를 연 사람도 같은 조건으로 봐요</p>`;
  };
  X.scenOpen = (ctx) => {
    const D = X.dlg("zxScen", "내 시나리오", html(ctx), ctx);
    const bind = () => {
      const f = D.body.querySelector("[data-sc-form]");
      if (f) f.onsubmit = (e) => { e.preventDefault(); const n = D.body.querySelector("#zxScN").value.trim(); if (!n) return; const L = X.scenList().filter((s) => s.n !== n); L.unshift(X.scenNow(ctx, n)); X.set(KEY, L.slice(0, MAX)); D.body.innerHTML = html(ctx); bind(); };
      D.body.querySelectorAll("[data-sc-go]").forEach((b) => (b.onclick = () => { const s = X.scenList()[+b.dataset.scGo]; if (s) X.scenApply(ctx, s); }));
      D.body.querySelectorAll("[data-sc-sh]").forEach((b) => (b.onclick = () => { const s = X.scenList()[+b.dataset.scSh]; if (s) ctx.share(X.scenURL(ctx, s), D.body.querySelector("[data-sc-fb]"), `내 조건 · ${s.n}`); }));
      D.body.querySelectorAll("[data-sc-rm]").forEach((b) => (b.onclick = () => { const L = X.scenList(); L.splice(+b.dataset.scRm, 1); X.set(KEY, L); D.body.innerHTML = html(ctx); bind(); }));
    };
    bind();
    return D;
  };
})();
