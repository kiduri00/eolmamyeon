/* 토지거래허가 최근 내역(서울부동산정보광장·국토부 K-Geo, 매일 수집해 누적) → 리포트 '규제·요건' 탭 */
const TOH = (() => {
  let T = null, P = null;
  const load = () => (T ? Promise.resolve(T) : P || (P = fetch(`data/toheo.json?v=${(D.dv && D.dv.toheo) || D.upd || ""}`).then((r) => (r.ok ? r.json() : null)).then((j) => (T = j)).catch(() => ((P = null), null))));
  const ymd = (d) => d.replaceAll("-", ".");
  function html(r, T) {
    const z = T.z[r.id], gu = T.gu[r.g];
    const head = `<h3>토지거래허가 최근 내역 <small>서울부동산정보광장(국토부 K-Geo 연계) · ${ymd(T.since)}~${ymd(T.asOf)} · 매일 수집</small></h3>`;
    const guTxt = gu ? `${esc(r.g)} 전체로는 최근 62일 ${fmt(gu[0])}건(주거용 ${fmt(gu[1])}건)이 허가됐어요.` : "";
    if (!z) return `<div class="sect toh">${head}<p class="note">이 기간에 구역 경계 안 필지로 허가된 기록이 없어요. ${guTxt} ${geoHas(r) ? "" : "공식 경계가 없는 구역은 필지를 맞출 수 없어 비어 보일 수 있어요."}</p></div>`;
    const rows = z.r.map(([d, jb, jm, use, res]) => `<li${res !== "허가" ? ' class="no"' : ""}><span class="mono">${ymd(d)}</span><b>${esc(jb)}</b><span>${esc(jm)} · ${esc(use)}${res !== "허가" ? ` · <em>${esc(res)}</em>` : ""}</span></li>`).join("");
    return `<div class="sect toh">${head}<dl class="sg-k"><div><dt>구역 안 허가</dt><dd><b>${fmt(z.n)}</b>건</dd></div><div><dt>최근 30일</dt><dd><b>${fmt(z.n30)}</b>건</dd></div><div><dt>주거용</dt><dd><b>${fmt(z.res)}</b>건</dd></div></dl>
      <ul class="toh-l">${rows}</ul><p class="note">허가 1건 = 접수번호별 대표 지번 1개라 여러 필지를 함께 산 거래도 1건으로 보여요. 주거용 허가를 받으면 2년 실거주 의무가 붙어 전세를 끼고 살 수 없어요. ${guTxt}</p></div>`;
  }
  const geoHas = (r) => { const g = ZX.geoZ(); return !!(g && g[r.id] && !g[r.id].e); };
  {
    const _q = paneReq;
    paneReq = function (r) {
      _q(r);
      const p = $("pane"), slot = document.createElement("div");
      const first = p.querySelector(".sect");
      if (first) first.before(slot); else p.appendChild(slot);
      load().then((T) => { if (T && slot.isConnected) { slot.innerHTML = html(r, T); const l = slot.querySelector(".toh-l"); if (l) ZX.moreRows(l.parentElement, 5); } });
    };
  }
  return { load };
})();
