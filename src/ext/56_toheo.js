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
  // 한 구역의 토지거래허가 판정(진단·요약용): 서울 전역 아파트 규칙 → 신통·모아 지정 → 구역 안 실제 허가 기록 → 구 단위 기록 순으로 본다.
  // '지정 없음'이라고 단정하지 않는다(빌라·단독만 서울 전역 규칙에서 빠질 뿐, 개별 지정은 구청 확인).
  function lookup(r, T0) {
    const T1 = T0 || T, lp = landPermit(r);
    if (lp) return { cls: "no", t: lp.t };
    const z = T1 && T1.z && T1.z[r.id], gu = T1 && T1.gu && T1.gu[r.g];
    const zl = z && z.r && z.r[0] ? ` · 최근 ${ymd(z.r[0][0]).slice(2)}` : "";
    if (z && z.res) return { cls: "no", t: `구역 안 주거용 필지 허가 ${fmt(z.res)}건(${ymd(T1.since).slice(2)}~${zl}) · 허가구역 필지가 있어요 · 사면 2년 실거주` };
    if (z && z.n) return { cls: "warn", t: `구역 안 필지 허가 ${fmt(z.n)}건(${ymd(T1.since).slice(2)}~${zl}, 주거용 아님) · 매물 필지 지정 여부 구청 확인` };
    if (r.src === "moa" || /가로|모아/.test(r.k || "")) return { cls: "warn", t: "모아타운은 도로 지목만 지정되는 경우가 많아요 · 빌라·단독은 서울 전역 지정(아파트만)에서 빠져요 · 구청 확인" };
    if (T1 && !z) return { cls: "warn", t: `구역 안 허가 0건(${ymd(T1.since).slice(2)}~${ymd(T1.asOf).slice(2)}) · 빌라·단독은 서울 전역 지정(아파트만)에서 빠져요${gu ? ` · ${r.g} 최근 허가 ${fmt(gu[0])}건` : ""} · 개별 지정은 구청 확인` };
    return { cls: "warn", t: `빌라·단독은 서울 전역 지정(아파트만)에서 빠져요${gu ? ` · ${r.g} 최근 허가 ${fmt(gu[0])}건` : ""} · 개별 지정은 구청 확인` };
  }
  window.ZP_toheo = (r) => lookup(r);
  return { load, lookup, loaded: () => !!T };
})();
