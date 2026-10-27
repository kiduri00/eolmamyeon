/* F1 1차: 매물진단(입주권 나오나) + 매수 전 규정을 한 흐름으로
   - 신축 쪼개기 위험: 구역 경계 안 필지의 준공연도(실거래 신고 건축연도 · 서울도시공간포털 건물 사용승인연도, 확인된 필지만)를
     권리산정기준일(ZX.rights — 시트 '권리산정기준일'과 같은 값)과 견준다. 연도 단위라 같은 해는 '날짜 확인 필요'로 따로 센다.
     모두 추정 · 확인 필요(건축물대장 사용승인일로 확인).
   - 매수 전 규정(모든 구역 공통)을 진단 결과 아래에서 펼쳐 보기(#rules와 같은 내용 · 매수 전 규정 화면도 그대로 둔다) */
(function () {
  "use strict";
  const F = window.ZPF;
  const LAW77 = "https://www.law.go.kr/법령/도시및주거환경정비법/제77조";
  // 사이클 3: 가로·소규모·모아는 도시정비법 제77조가 아니라 소규모주택정비법과 서울시 기준 — 조항 번호는 확인 전이라 법령 첫 화면으로
  const LAWSM = "https://www.law.go.kr/법령/빈집및소규모주택정비에관한특례법";
  // 순수 계산(QA 기준식과 대조): pcl = {d, p:[[동코드, 지번, 면적, 지목, 준공연도]]} · tz = tx.json의 구역 자료 · rt = rights(r)
  F.split = (pcl, tz, rt) => {
    // 사이클 2: 근거 없는 경험칙(2016년 뒤 준공·대지 15㎡ 이하 = 쪼개기 의심)은 뺐다 — 권리산정기준일과 필지 준공연도 비교만
    const o = { set: !!(rt && rt.k === "set" && rt.d), rd: rt && rt.d ? rt.d : null, rdY: null, n: 0, after: 0, same: 0, all: 0, pct: null };
    if (o.set) o.rdY = +String(rt.d).slice(0, 4);
    if (pcl && Array.isArray(pcl.p)) {
      o.all = pcl.p.length;
      pcl.p.forEach((x) => { const y = +x[4] || 0; if (!y) return; o.n++; if (o.set) { if (y > o.rdY) o.after++; else if (y === o.rdY) o.same++; } });
    }
    if (o.set && o.n) o.pct = Math.round((o.after / o.n) * 100);
    return o;
  };
  F.splitItem = (o, ctx) => {
    const fmt = ctx.fmt;
    const src = "필지 준공연도: 실거래 신고 건축연도·서울도시공간포털 건물 사용승인연도(확인된 필지만)";
    if (!o.n) return null;
    if (!o.set) return { cls: "na", t: "권리산정기준일이 확정되지 않아 견줄 수 없어요 · 매수 전 건축물대장 사용승인일과 구청 고시를 확인하세요", src };
    const parts = [`준공연도가 확인된 필지 ${fmt(o.n)}곳 중 기준일(${String(o.rd || "").replace(/^(\d{4})[.-](\d{2})[.-](\d{2}).*/, (m, y, a, c) => `${y}.${+a}.${+c}`)}) 뒤 준공 ${fmt(o.after)}곳(${o.pct}%)${o.same ? ` · 같은 해 ${fmt(o.same)}곳은 날짜 확인 필요` : ""}`, "기준일 뒤 신축·지분 쪼개기 물건은 입주권이 안 나오거나 나눠 받을 수 있어요"];
    // ✓는 확정 근거가 있을 때만 — 필지 연도는 확인된 곳만이라 '없음'도 확정이 아니다(? 회색) · 있으면 !
    return { cls: o.after || o.same ? "warn" : "na", t: parts.join(" · "), src };
  };
  const ico = (c) => (c === "ok" ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : c === "na" ? "?" : "!");
  F.diag = (r, box, ctx) => {
    F.css();
    const ul = box.querySelector("ul.dg-l"); if (!ul) return;
    // 1) 신축 쪼개기 위험(권리산정기준일 줄 바로 뒤)
    Promise.all([ctx.pcl(r.id).catch(() => null)]).then(([pcl]) => {
      if (!box.isConnected || !box.contains(ul)) return;
      const o = F.split(pcl, null, ctx.rights(r)), it = F.splitItem(o, ctx);
      const old = ul.querySelector('[data-f="split"]'); if (old) old.remove();
      if (!it) return;
      const li = document.createElement("li"); li.className = it.cls; li.setAttribute("data-f", "split");
      li.innerHTML = `<i aria-hidden="true">${ico(it.cls)}</i><span><b>신축 쪼개기 위험 <em class="dg-est">추정·확인 필요</em></b><small>${ctx.esc(it.t)} ${/가로|소규모|모아/.test(r.k || "") || r.src === "moa" ? `<a href="${LAWSM}" target="_blank" rel="noopener">소규모주택정비법</a> · 서울시 기준(구청 확인)` : `<a href="${LAW77}" target="_blank" rel="noopener">도정법 제77조</a>`}<span class="zdg-src">${ctx.esc(it.src)}</span></small></span>`;
      const after = [...ul.children].find((x) => /권리산정기준일/.test(x.textContent));
      if (after) after.after(li); else ul.appendChild(li);
    });
    // 2) 매수 전 규정(모든 구역 공통) 펼치기 — #rules 내용을 그대로(아이디는 빼고)
    try { ctx.rules && ctx.rules(); } catch (e) {}
    const R0 = document.getElementById("rules");
    let dt = box.querySelector('[data-f="rules"]');
    if (R0 && R0.innerHTML.trim()) {
      if (!dt) { dt = document.createElement("details"); dt.className = "zdg-rules"; dt.setAttribute("data-f", "rules"); box.appendChild(dt); }
      const c = R0.cloneNode(true); c.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id")); c.querySelectorAll("[data-rules-dg]").forEach((e) => e.remove());
      dt.innerHTML = `<summary><b>매수 전 규정 한눈에</b><small>모든 구역 공통 · 지위양도·재당첨·대출·세금·사업 요건</small></summary><div class="zdg-rb">${c.innerHTML}</div>`;
    }
  };
})();
