/* 구역 실거래 순위(아실 순위분석 대응) · 고시·공고 소식(재개발닷컴 대응) */
const BD = (() => {
  const ymd = (d) => `${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
  const eok = (man) => (man >= 10000 ? `${(man / 10000).toFixed(man >= 100000 ? 0 : 1)}억` : `${fmt(man)}만`);
  const go = (id) => `<button type="button" class="txr-go" data-txgo="${esc(id)}">${esc(byId[id].n)}</button>`;
  const okC = (r) => { try { return dotState(r) === "y" ? `<em class="txr-ok">${gapMode() ? "전세 끼고 내 현금 가능" : "내 현금 가능"}</em>` : ""; } catch (e) { return ""; } };
  const live = () => R.filter((r) => !r.dn && r.s < 9 && r.tx);
  let K = "n3";
  function rank() {
    const out = document.getElementById("txrOut"), note = document.getElementById("txrNote");
    if (!out) return;
    let L = [], head = "", row;
    if (K === "n3") {
      L = live().filter((r) => r.tx.n3 > 0).sort((a, b) => b.tx.n3 - a.tx.n3 || (b.tx.n12 || 0) - (a.tx.n12 || 0));
      note.textContent = "계약일 기준 최근 3개월 구역 안 매매 건수(빌라·단독·아파트) · 거래가 몰리면 손바뀜이 활발하다는 뜻이에요.";
      head = "<th class=n>3개월</th><th class=n>12개월</th><th class=n>빌라 가운데 값</th>";
      row = (r) => `<td class=n><b>${r.tx.n3}건</b></td><td class=n>${r.tx.n12 || 0}건</td><td class=n>${r.tx.med ? eok(r.tx.med) : "–"}</td>`;
    } else if (K === "yoy") {
      L = live().filter((r) => r.tx.yoy != null && r.tx.yon && r.tx.yon[0] >= 10 && r.tx.yon[1] >= 10).sort((a, b) => b.tx.yoy - a.tx.yoy);
      note.textContent = "대지지분 3.3㎡당 매매가 가운데 값: 최근 12개월 vs 그 전 12개월 · 두 기간 모두 10건 이상인 구역만 · 표본이 바뀌면 크게 흔들려요.";
      head = "<th class=n>1년 변화</th><th class=n>표본(최근/전)</th>";
      row = (r) => `<td class="n ${r.tx.yoy >= 0 ? "up" : "dn"}"><b>${r.tx.yoy > 0 ? "+" : ""}${r.tx.yoy}%</b></td><td class=n>${r.tx.yon[0]} / ${r.tx.yon[1]}건</td>`;
    } else {
      L = live().filter((r) => r.tx.hi).sort((a, b) => b.tx.hi[1].localeCompare(a.tx.hi[1]) || b.tx.hi[0] - a.tx.hi[0]);
      note.textContent = "최근 3개월 안에 그 구역 3.3㎡당 가격(빌라는 대지, 아파트는 전용 기준)이 2024년 이후 최고를 넘은 거래 · 앞선 거래가 5건 이상인 구역만.";
      head = "<th class=n>신고가 날짜</th><th class=n>3.3㎡당</th><th class=n>건수</th>";
      row = (r) => `<td class=n><b>${ymd(r.tx.hi[1])}</b></td><td class=n>${eok(r.tx.hi[2])}${r.tx.hi[3] === "a" ? " <small>아파트</small>" : ""}</td><td class=n>${r.tx.hi[0]}건</td>`;
    }
    L = L.slice(0, 30);
    out.innerHTML = L.length
      ? `<div class="txl"><table class="tx txr"><thead><tr><th>#</th><th>구역</th>${head}</tr></thead><tbody>${L.map((r, i) => `<tr><td class=txr-n>${i + 1}</td><td>${go(r.id)}<small>${esc(r.g)} · ${esc(stageName(r))}</small>${okC(r)}</td>${row(r)}</tr>`).join("")}</tbody></table></div>`
      : `<p class="mut">조건에 맞는 구역이 없어요.</p>`;
  }
  const evT = (t) => t.replace(/^\[([^\]]*)\]\s*(.*)$/, (m, a, b) => (b ? `${a} · ${b}` : a));
  let NT = null, C = "";
  const CL = { ok: "인가·고시", chg: "변경 인가", con: "시공자", req: "신청·공람", etc: "기타" };
  function notice() {
    const out = document.getElementById("ntcOut");
    if (!out || !NT) return;
    const L = NT.items.filter((x) => byId[x[1]] && (C === "fav" ? isFav(x[1]) : C ? x[4] === C : x[4] !== "etc"));
    out.innerHTML = L.length
      ? `<ul class="ntl">${L.slice(0, 60).map(([d, id, sec, t, c]) => `<li class="c-${c}"><span class="nt-d mono">${d.replaceAll("-", ".")}</span><span class="nt-b">${go(id)}<small>${esc(byId[id].g)}</small><span class="nt-t"><em class="nt-c">${CL[c]}</em><b>${esc(sec)}</b> ${esc(evT(t))}</span></span></li>`).join("")}</ul><p class="t-note">출처: 서울시 정비사업 정보몽땅 사업장별 추진경과 · ${esc(NT.asOf.replaceAll("-", "."))} 기준 · '전체'는 법인등기·용역 계약 변경 같은 기타 기록을 빼고 보여 줘요. '변경 인가'는 이미 받은 인가의 내용을 바꾼 것이라 단계가 올라간 게 아니에요.</p>`
      : `<p class="mut">${C === "fav" ? "찜한 구역의 최근 90일 기록이 없어요. 구역 카드의 ☆로 찜해 보세요." : "최근 90일 기록이 없어요."}</p>`;
  }
  function init() {
    const seg = document.getElementById("txrSeg");
    if (seg) seg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      K = b.dataset.k; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); rank();
    });
    const f = document.getElementById("ntcF");
    if (f) f.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-c]"); if (!b) return;
      C = b.dataset.c; f.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); notice();
    });
    document.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-txgo]"); if (!b) return;
      curTab = "money"; select(b.dataset.txgo, true, false, { scroll: true });
    });
    const once = (id, fn) => {
      const el = document.getElementById(id); if (!el) return;
      if (!window.IntersectionObserver) return fn();
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: "800px 0px" });
      io.observe(el);
    };
    once("txrTop", rank);
    once("ntcTop", () => fetch(`data/notice.json?v=${(D.dv && D.dv.notice) || D.upd || ""}`).then((r) => r.json()).then((j) => { NT = j; notice(); }).catch(() => { const o = document.getElementById("ntcOut"); if (o) o.innerHTML = '<p class="mut">소식을 불러오지 못했어요.</p>'; }));
    // 계산기 현금이 바뀌면 '내 현금 가능' 표시 갱신
    {
      const _plan = plan;
      plan = function () { const r = _plan.apply(this, arguments); try { if (document.getElementById("txrOut").innerHTML) rank(); } catch (e) {} return r; };
    }
  }
  return { init };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", BD.init) : setTimeout(BD.init, 0);
