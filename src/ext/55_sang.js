/* 서울시 상권분석서비스: 지도 레이어용 로더 + 구역 리포트 '주변 상권·학원가' */
const ZXS = (() => {
  let S = null, P = null;
  const load = () => (S ? Promise.resolve(S) : P || (P = fetch("data/sang.json").then((r) => (r.ok ? r.json() : null)).then((j) => (S = j)).catch(() => ((P = null), null))));
  const dist = (a, b, c, d) => { const k = Math.PI / 180, x = (d - b) * k * Math.cos(((a + c) / 2) * k), y = (c - a) * k; return Math.sqrt(x * x + y * y) * 6371000; };
  const KN = { a: "골목상권", d: "발달상권", r: "전통시장", u: "관광특구" };
  function centerOf(r) { return r.ll ? [r.ll[0], r.ll[1]] : null; }
  function html(r, S) {
    const c = centerOf(r); if (!c) return "";
    const near = S.items.map((x) => ({ x, d: dist(c[0], c[1], x[1], x[0]) })).filter((o) => o.d <= 1000).sort((a, b) => a.d - b.d);
    const stores = near.reduce((s, o) => s + o.x[4], 0), acad = near.reduce((s, o) => s + o.x[5], 0);
    const big = near.slice().sort((a, b) => b.x[4] - a.x[4]).slice(0, 3);
    const hub = S.items.filter((x) => x[5] >= 100).map((x) => ({ x, d: dist(c[0], c[1], x[1], x[0]) })).sort((a, b) => a.d - b.d)[0];
    const km = (m) => (m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`);
    return `<div class="sect sang"><h3>주변 상권·학원가 <small>반경 1km · 서울시 상권분석서비스 ${esc(S.q)}</small></h3>
      <dl class="sg-k"><div><dt>상권</dt><dd><b>${fmt(near.length)}</b>곳</dd></div><div><dt>점포</dt><dd><b>${fmt(stores)}</b>개</dd></div><div><dt>학원</dt><dd><b>${fmt(acad)}</b>개</dd></div></dl>
      ${big.length ? `<ul class="sg-l">${big.map((o) => `<li><b>${esc(o.x[2])}</b><span>${KN[o.x[3]] || ""} · ${km(o.d)} · 점포 ${fmt(o.x[4])}${o.x[5] ? ` · 학원 ${fmt(o.x[5])}` : ""}${o.x[6] ? ` · 추정매출 ${fmt(o.x[6], o.x[6] < 10 ? 1 : 0)}억` : ""}</span></li>`).join("")}</ul>` : `<p class="note">반경 1km 안에 서울시가 정한 상권이 없어요(주거 위주 지역).</p>`}
      ${hub ? `<p class="note">가장 가까운 큰 학원가(학원 100곳 이상): <b>${esc(hub.x[2])}</b> ${esc(hub.x[7])} · 직선 ${km(hub.d)} · 학원 ${fmt(hub.x[5])}곳</p>` : ""}
      <p class="note src">학원 = 일반교습·외국어·예술·컴퓨터학원 점포 수(체육 강습 제외) · 거리는 구역 대표 좌표에서 상권 중심까지 직선거리.</p></div>`;
  }
  {
    const _l = paneLoc;
    paneLoc = function (r) {
      _l(r);
      const p = $("pane"), slot = document.createElement("div");
      slot.className = "sang-slot";
      const inf = p.querySelector(".sect.infra");
      if (inf) inf.after(slot); else p.appendChild(slot);
      load().then((S) => { if (S && slot.isConnected) slot.innerHTML = html(r, S); });
    };
  }
  return { load };
})();
