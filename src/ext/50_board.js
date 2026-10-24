/* 순위 > 실거래 탭(아실 순위분석 대응) · 소식 > 단계 소식(정보몽땅 추진경과 + 월간 리포트 단계 변경) */
const BD = (() => {
  const ymd = (d) => `${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
  const eok = (man) => (man >= 10000 ? `${(man / 10000).toFixed(man >= 100000 ? 0 : 1)}억` : `${fmt(man)}만`);
  const go = (id) => `<button type="button" class="txr-go" data-txgo="${esc(id)}">${esc(shortName(byId[id].n))}</button>`;
  const okC = (r) => { try { return dotState(r) === "y" ? `<em class="txr-ok">${gapMode() ? "전세 끼고 내 돈 가능" : "내 돈 가능"}</em>` : ""; } catch (e) { return ""; } };
  const live = () => R.filter((r) => !r.dn && r.s < 9 && r.tx);
  let K = "n3";
  // 순위 > 실거래 탭: 갭 탭과 같은 카드 목록(폰은 한 줄 카드, 넓은 PC는 2단) — 큰 숫자 = 그 기준 값, 작은 글씨 = 보조 값
  function rank() {
    const out = document.getElementById("txrOut"), note = document.getElementById("txrNote");
    if (!out) return;
    let L = [], val;
    if (K === "n3") {
      L = live().filter((r) => r.tx.n3 > 0).sort((a, b) => b.tx.n3 - a.tx.n3 || (b.tx.n12 || 0) - (a.tx.n12 || 0));
      note.textContent = "최근 3개월 구역 안 매매 건수(계약일 기준) · 많을수록 손바뀜이 활발해요";
      // 빌라 표본이 없으면 아파트 매매 → 입주권 순으로 가운데 값을 보여 준다(종류를 함께 적음)
      const mid = (t) => (t.med ? [t.med, "빌라"] : t.am ? [t.am, "아파트"] : t.im ? [t.im, "입주권"] : null);
      val = (r) => { const m = mid(r.tx); return [`${fmt(r.tx.n3)}건`, `1년 ${fmt(r.tx.n12 || 0)}건${m ? `<span class="txr-x"> · ${m[1]} 가운데 ${eok(m[0])}</span>` : ""}`]; };
    } else if (K === "yoy") {
      L = live().filter((r) => r.tx.yoy != null && r.tx.yon && r.tx.yon[0] >= 10 && r.tx.yon[1] >= 10).sort((a, b) => b.tx.yoy - a.tx.yoy);
      note.textContent = "대지 3.3㎡당 매매가 가운데 값 · 최근 12개월과 그 전 12개월 비교 · 두 기간 모두 10건 이상인 곳만";
      val = (r) => [`${r.tx.yoy > 0 ? "+" : r.tx.yoy < 0 ? "−" : ""}${Math.abs(r.tx.yoy)}%`, `표본 ${fmt(r.tx.yon[0])}·${fmt(r.tx.yon[1])}건`, r.tx.yoy >= 0 ? "up" : "dn"];
    } else {
      L = live().filter((r) => r.tx.hi).sort((a, b) => b.tx.hi[1].localeCompare(a.tx.hi[1]) || b.tx.hi[0] - a.tx.hi[0]);
      note.textContent = "최근 3개월 안에 3.3㎡당 가격이 2024년 이후 최고를 넘은 거래 · 앞선 거래가 5건 이상인 곳만";
      val = (r) => [ymd(r.tx.hi[1]), `3.3㎡당 ${eok(r.tx.hi[2])}${r.tx.hi[3] === "a" ? "<span class=\"txr-x\">(아파트)</span>" : ""}<span class="txr-x"> · ${fmt(r.tx.hi[0])}건</span>`];
    }
    L = L.slice(0, 30);
    out.innerHTML = L.length
      ? `<ol class="tl-l txr-l">${L.map((r, i) => { const [b, sm, c] = val(r); return `<li><a href="#${r.id}" data-txgo="${esc(r.id)}"><span class="tl-k">${i + 1}</span><span class="tl-n"><b>${esc(shortName(r.n))}</b><small>${esc(r.g)} · ${esc(stageName(r))}</small>${okC(r)}</span><span class="tl-v"><b${c ? ` class="${c}"` : ""}>${b}</b><small>${sm}</small></span></a></li>`; }).join("")}</ol>`
      : `<p class="mut">조건에 맞는 구역이 없어요.</p>`;
  }
  const evT = (id, d, sec, t) => ZF.evText(byId[id], d, sec, t);   // 구역 리포트 '정보몽땅 최근 기록'과 같은 글(동의율 89.85% 등)
  // 소식 > 단계 소식: 정보몽땅 추진경과(최근 90일) + 월간 리포트 단계 변경을 한 줄기로.
  // '단계 변경' = 인가·승인으로 단계가 오른 기록(같은 단계를 고친 '변경 인가'·신청·공람 제외) — 구역·단계마다 처음 한 번만
  let NT = null, C = "";
  const CL = { up: "단계 변경", ok: "인가·고시", chg: "변경 인가", con: "시공자", req: "신청·공람" };
  // 한 줄 글: 칩(인가·고시 등)과 단계 이름이 이미 말한 낱말은 빼고 남은 것만 — '인가·고시 관리처분인가 인가 고시' → '인가·고시 관리처분인가'(17차)
  const ACTW = new Set(["인가", "고시", "승인", "신청", "공람", "변경"]);
  function ntBody(x) {
    const lab = CL[x.c] || "", lt = new Set(lab.split(/[·\s]+/).filter(Boolean));
    let sec = String(x.sec || "");
    if (lab && sec.startsWith(lab) && sec.length > lab.length) sec = sec.slice(lab.length);   // '시공자 · 시공자선정' → '시공자 · 선정'
    const parts = String(x.txt || "").split(" · "), act = parts.shift() || "";
    const aw = act.split(/\s+/).filter((w) => w && !(ACTW.has(w) && (lt.has(w) || sec.endsWith(w) || x.c === "up" || x.c === "ok")) && !(sec && w === sec));
    const tail = [aw.join(" "), ...parts].filter(Boolean).join(" · ");
    return `<b>${esc(sec)}</b>${tail ? " " + esc(tail) : ""}`;
  }
  function feed() {
    const L = [], key = new Map();
    NT.items.slice().sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).forEach(([d, id, sec, t, c]) => {
      if (!byId[id] || c === "etc" || !CL[c]) return;
      let ev = { txt: t, chg: false }; try { ev = evT(id, d, sec, t); } catch (e) {}
      const st = NT_STEP[sec], k = id + "|" + st;
      const up = c === "ok" && !!st && !/신청|공람/.test(t) && !ev.chg && !key.has(k);
      const it = { d, id, sec, txt: ev.txt, c: up ? "up" : c, src: "", nt: 1 };   // nt = 고시·공고 원문에서 온 줄(23차 '고시·공고' 칩)
      if (up) key.set(k, it);
      L.push(it);
    });
    const lim = NT.items.reduce((m, x) => (x[0] < m ? x[0] : m), NT.asOf || "9999");
    if (MO && MO.items) MO.items.forEach((m) => {
      if (!byId[m.id] || m.date < lim) return;
      const k = m.id + "|" + m.step, ex = key.get(k);
      if (ex) { if (!ex.src && m.src) ex.src = m.src; return; }
      const it = { d: m.date, id: m.id, sec: STEP_K[m.step] || m.step, txt: "월간 리포트 기록", c: "up", src: m.src || "" };
      key.set(k, it); L.push(it);
    });
    L.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
    // 같은 구역·같은 단계의 인가와 고시가 며칠 사이로 두 번 실린 것 · 똑같은 줄 → 한 줄(단계 변경이 있으면 그것을 남김)
    const dd = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;
    const out = [];
    L.forEach((x) => {
      const same = out.find((y) => y.id === x.id && y.sec === x.sec && ((y.txt === x.txt && y.c === x.c) || (dd(y.d, x.d) <= 7 && ((y.c === "up" && x.c === "ok") || (y.c === "ok" && x.c === "up")))));
      if (!same) { out.push(x); return; }
      if (x.c === "up" && same.c === "ok") { Object.assign(same, { c: "up", d: same.d > x.d ? same.d : x.d }); }
      if (!same.src && x.src) same.src = x.src;
    });
    return out;
  }
  // 단계가 오른 줄: 지금 사면 입주까지 현금(목록·리포트와 같은 ZF.cashToMoveIn)
  function money(r) {
    try {
      if (buyWindow(r).cls === "no") return '<span class="nt-m mut">지금 사면 입주권 없음</span>';
      const v = ZF.cashToMoveIn(r, gapMode());
      if (v == null) return `<span class="nt-m mut">${LBL.cashToMoveIn} 계산 불가</span>`;
      return `<span class="nt-m${v <= CASH + 1e-9 ? " ok" : ""}">${LBL.cashToMoveIn} ${ZF.cash(v)}${v <= CASH + 1e-9 ? " · 내 돈으로 됨" : ""}</span>`;
    } catch (e) { return ""; }
  }
  // 21차: 소식 > '경공매' 칩 — 구역 안 경매 물건 중 매각기일이 남은 사건(법원경매정보 · data/auction.json), 기일 가까운 순
  let AU = null, AUP = null, auPrev = "";
  const auLoad = () => AUP || (AUP = fetch(`data/auction.json?v=${(D.dv && D.dv.auction) || D.upd || ""}`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => (AU = j && j.ok && j.byZone ? j : { byZone: {} })));
  const auToday = () => new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const auDay = (d) => { const t = new Date(d + "T00:00:00+09:00"); return `${+d.slice(5, 7)}.${+d.slice(8, 10)} (${"일월화수목금토"[t.getDay()]})`; };
  function aucList() {
    const out = document.getElementById("ntcOut"); if (!out) return;
    if (!AU) { out.innerHTML = '<p class="mut">경매 물건 불러오는 중…</p>'; auLoad().then(() => { if (C === "auc") aucList(); }); return; }
    const t0 = auToday(), cases = new Map();
    Object.entries(AU.byZone).forEach(([id, xs]) => { if (!byId[id] || (AU.miss || []).includes(byId[id].g)) return; (xs || []).forEach((o) => { if (!o.date || o.date < t0 || o.st === "gone" || o.st === "chk") return; const k = `${o.court}|${o.cs}`; const c = cases.get(k) || { id, o, n: 0, fs: "" }; c.n++; if ((o.fs || "") > c.fs) c.fs = o.fs || ""; if ((o.min || 1e15) < (c.o.min || 1e15)) c.o = o; cases.set(k, c); }); });
    const L = [...cases.values()].sort((a, b) => a.o.date.localeCompare(b.o.date) || (a.o.min || 0) - (b.o.min || 0));
    const nw = L.filter((c) => c.fs && c.fs > auPrev).length;
    const sum = `<p class="nt-sum"><b>매각기일 남은 경매 ${fmt(L.length)}건</b>${nw ? ` · 새로 올라온 ${fmt(nw)}건` : ""} · 정비구역 안 필지만</p>`;
    out.innerHTML = L.length
      ? `${sum}<ul class="ntl aul">${L.map((c) => { const r = byId[c.id], o = c.o, isN = c.fs && c.fs > auPrev; return `<li class="c-auc${isFav(c.id) ? " fav" : ""}"><span class="nt-d mono">${auDay(o.date)}</span><span class="nt-b">${go(c.id)}<small>${esc(r.g)} · ${esc(stageName(r))}</small><span class="nt-t"><em class="nt-c">${isN ? "새 물건" : "경매"}</em><b>${esc(ZF.aucUse(o.use) || "부동산")}</b> 최저 ${esc(ZF.aucAmt(o.min))}${o.rate ? ` (감정가 ${o.rate}%)` : ""}${o.fail ? ` · 유찰 ${o.fail}회` : " · 신건"}${c.n > 1 ? ` · 물건 ${c.n}개` : ""}</span></span></li>`; }).join("")}</ul><p class="t-note">출처: 대법원 법원경매정보 · ${esc(String(AU.asOf || "").replaceAll("-", "."))} 기준 · 구역 경계 안 지번과 맞는 물건만 · 입찰 전 법원 공고를 꼭 확인하세요</p>`
      : `${sum}<p class="mut nt-e">지금은 매각기일이 남은 구역 안 경매 물건이 없어요.</p>`;
  }
  // 칩 고르기(빠른 메뉴에서 바로 오는 길도 같은 함수) — 보면 그 목록의 '새 소식' 표시(N)를 지운다
  function setC(c) {
    C = c;
    const f = document.getElementById("ntcF"); if (f) f.querySelectorAll("button[data-c]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.c === c)));
    if (c === "auc") { auPrev = (window.NEWB && NEWB.last("auc")) || ""; aucList(); try { NEWB.seen("auc"); } catch (e) {} return; }
    try { NEWB.seen("ntc"); } catch (e) {}
    if (NT) notice(); else ntLoad().then((j) => { if (j) { NT = j; if (C === c) notice(); } });
  }
  function notice() {
    const out = document.getElementById("ntcOut");
    if (C === "auc") return aucList();
    if (!out || !NT) return;
    const A = feed();
    const L = A.filter((x) => (C === "fav" ? isFav(x.id) : C === "up" ? x.c === "up" : C === "ntc" ? !!x.nt : true));
    const ups = new Set(A.filter((x) => x.c === "up").map((x) => x.id)).size, pins = A.filter((x) => isFav(x.id)).length;
    const sum = `<p class="nt-sum"><b>최근 90일 ${fmt(A.length)}건</b> · 단계 오른 곳 ${fmt(ups)}곳${FAV.length ? ` · 관심 구역 소식 ${fmt(pins)}건` : ""}</p>`;
    out.innerHTML = L.length
      ? `${sum}<ul class="ntl">${L.map((x) => { const r = byId[x.id], fav = isFav(x.id); return `<li class="c-${x.c}${fav ? " fav" : ""}"><span class="nt-d mono">${x.d.slice(2).replaceAll("-", ".")}</span><span class="nt-b">${fav ? `<i class="nt-pin" aria-label="관심 구역">${SVG_PIN(true)}</i>` : ""}${go(x.id)}<small>${esc(r.g)} · ${esc(stageName(r))}</small><span class="nt-t"><em class="nt-c">${CL[x.c]}</em>${ntBody(x)}${x.src ? ` <a href="${esc(x.src)}" target="_blank" rel="noopener" data-nw="1">기사 ↗<span class="sr-only"> (새 창)</span></a>` : ""}</span>${x.c === "up" ? money(r) : ""}</span></li>`; }).join("")}</ul><p class="t-note">출처: 서울시 정비사업 정보몽땅 사업장별 추진경과·월간 리포트 · ${esc(String(NT.asOf).replaceAll("-", "."))} 기준 · '변경 인가'는 이미 받은 인가 내용을 고친 것이라 단계가 오른 게 아니에요${MO ? ` · 달마다 정리한 목록: <a href="${MO.url}">${moLabel()} 리포트</a>` : ""}</p>`
      : `${sum}<p class="mut nt-e">${C === "fav" ? (FAV.length ? "관심 구역의 최근 90일 소식이 없어요." : "구역을 열고 관심 구역에 추가하면 그 구역 소식만 모아 볼 수 있어요.") : "최근 90일 기록이 없어요."}</p>`;
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
      setC(b.dataset.c);
    });
    document.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-txgo]"); if (!b) return;
      e.preventDefault(); curTab = "money"; select(b.dataset.txgo, true, false, { scroll: true });
    });
    const once = (id, fn) => {
      const el = document.getElementById(id); if (!el) return;
      if (!window.IntersectionObserver) return fn();
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: "800px 0px" });
      io.observe(el);
    };
    once("txrTop", rank);
    // 빠른 메뉴: '경공매'(#aucTop) = 소식 + 경공매 칩 · '고시공고'(#ntcTop) = 소식 + 고시·공고 칩(23차) · 소식 탭을 열면 고시·공고는 본 것으로
    addEventListener("zp:alias", (e) => { if (e.detail === "aucTop") setC("auc"); else if (e.detail === "ntcTop") setC("ntc"); });
    addEventListener("zp:view", (e) => { if (e.detail === "news" && C !== "auc") { try { NEWB.seen("ntc"); } catch (er) {} } });
    once("ntcTop", () => ntLoad().then((j) => { if (!j) throw 0; NT = j; notice(); }).catch(() => { const o = document.getElementById("ntcOut"); if (o) o.innerHTML = '<p class="mut">소식을 불러오지 못했어요.</p>'; }));
    // 계산기 현금이 바뀌면 '내 돈 가능' 표시 갱신
    {
      const _plan = plan;
      plan = function () { const r = _plan.apply(this, arguments); try { if (document.getElementById("txrOut").innerHTML) rank(); if (NT) notice(); } catch (e) {} return r; };
    }
  }
  return { init };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", BD.init) : setTimeout(BD.init, 0);
