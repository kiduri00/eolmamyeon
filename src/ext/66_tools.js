/* ===================== 합친 도구 화면(탭) =====================
   "적게, 완벽하게": 순위(#rankHub = 갭·실거래·입지) · 소식(#news = 단계 소식·입주 물량).
   탭 하나 = 예전 도구 섹션 하나(#gapTop·#txrTop·#rankTop·#ntcTop·#supplyTop)를 그대로 품는다 — 그리는 함수는 예전 그대로,
   켜진 탭 섹션에만 s-on을 붙여 '보일 때 그리기'가 그대로 동작한다. 예전 주소는 60_simple.js ZP_ALIAS가 여기 pick()으로 넘긴다. */
const HUB = window.ZP_HUB = (() => {
  const T = { rankHub: [["gap", "gapTop"], ["txr", "txrTop"], ["loc", "rankTop"]], news: [["feed", "ntcTop"], ["supply", "supplyTop"]] };
  const LEAD = {
    gap: "전세 끼고 지금 필요한 돈이 적은 순 · 작은 글씨는 입주까지 현금(잔금대출 제외)",
    loc: "입지 점수 100 = 교통 30 · 업무지구 20 · 한강 10 · 호재 10 · 생활 인프라 30 · 가중치는 가정값이에요",
    feed: "정비사업 정보몽땅 추진경과 최근 90일 · 매일 갱신 · '단계 변경'은 인가·승인으로 단계가 오른 곳",
  };
  const now = {};
  const get = (h) => { if (now[h]) return now[h]; try { const v = sessionStorage.getItem("zp.hub." + h); if (T[h].some((x) => x[0] === v)) return v; } catch (e) {} return T[h][0][0]; };
  function paint(h) {
    const el = document.getElementById(h); if (!el) return;
    const on = el.classList.contains("s-on"), t = get(h);
    el.querySelectorAll('[role="tab"]:not(.tf-seg *):not(.nw-seg *)').forEach((b) => { const s = b.dataset.tab === t; b.setAttribute("aria-selected", String(s)); b.tabIndex = s ? 0 : -1; });
    T[h].forEach(([k, id]) => { const p = document.getElementById(id); if (!p) return; p.classList.remove("fold"); p.classList.toggle("s-on", on && k === t); });
    const ld = el.querySelector(".hub-lead"); if (ld) { ld.textContent = LEAD[t] || ""; ld.hidden = !LEAD[t]; }
    el.dataset.tab = t;
    if (on && t === "loc") { try { SECT.rankTop(); } catch (e) {} }
  }
  function pick(h, t, user) {
    if (!T[h] || !T[h].some((x) => x[0] === t)) return;
    now[h] = t; try { sessionStorage.setItem("zp.hub." + h, t); } catch (e) {}
    paint(h);
    if (user) {
      // 탭 줄이 머리 밑으로 올라가 있으면 탭 줄이 보이게(새 목록 맨 위부터)
      const tl = document.querySelector(`#${h} .hub-tabs`); if (tl) { const y = tl.getBoundingClientRect().top - (HDR() || 56) - 8; if (y < 0) window.scrollTo({ top: scrollY + y, behavior: "auto" }); }
      window.dispatchEvent(new Event("resize"));
    }
  }
  Object.keys(T).forEach((h) => {
    const el = document.getElementById(h); if (!el) return;
    const tl = el.querySelector(".hub-tabs");
    if (tl && !el.querySelector(".hub-lead")) { const p = document.createElement("p"); p.className = "hub-lead"; tl.after(p); }
    tl && tl.addEventListener("click", (e) => { const b = e.target.closest('[role="tab"]'); if (b) pick(h, b.dataset.tab, true); });
    tl && tl.addEventListener("keydown", (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1, Home: -99, End: 99 }[e.key]; if (!d) return;
      const L = [...tl.querySelectorAll('[role="tab"]')], i = L.findIndex((b) => b.dataset.tab === get(h));
      const j = Math.max(0, Math.min(L.length - 1, d === 99 ? L.length - 1 : d === -99 ? 0 : (i + d + L.length) % L.length));
      e.preventDefault(); pick(h, L[j].dataset.tab, true); L[j].focus();
    });
    new MutationObserver(() => paint(h)).observe(el, { attributes: true, attributeFilter: ["class"] });
    paint(h);
  });
  return { pick, tab: get };
})();
/* ===================== 도구 그리기: 갭(순위 탭) · 매물진단 · 입주 물량(소식 탭) =====================
   섹션 뼈대는 shell.html에 있다(없으면 여기서 만든다). */
const TOOLS = (() => {
  const mk = (id, title) => {
    if (document.getElementById(id)) return;
    const s = document.createElement("section");
    s.className = "sec tool"; s.id = id;
    s.innerHTML = `<div class="sec-h"><div><h2>${title}</h2></div></div><div class="panel tpanel"><div class="t-out" id="${id}Out"></div></div>`;
    const ref = document.getElementById("favTop");
    ref ? ref.before(s) : document.querySelector("main")?.appendChild(s);
  };
  mk("gapTop", "전세 끼고 순위");
  mk("diagTop", "매물진단");
  mk("supplyTop", "입주 물량");
  const e1 = ZF.cash;
  // ---------- 갭 순위: 전세 끼고 지금 필요한 돈이 적은 순 ----------
  let gapF = "all", gapN = 20;
  function gapRender() {
    const out = document.getElementById("gapTopOut"); if (!out) return;
    // 홈 '전세 시세 있는 N곳 중'과 같은 모집단·같은 판정(진행 중 POP · 추정 숨김 · gapOk를 현금 무한대로) — 구 가운데 값 추정(eligible:false)은 빠진다
    const pop = new Set(POP.map((x) => x.id));
    const L = R.filter((r) => pop.has(r.id) && !r.lc && gapOk(r, 999)).map((r) => ({ r, g: gapOf(r) })).filter((x) => x.g.now != null && isFinite(x.g.now));
    const c = CASH;
    const F = gapF === "near" ? L.filter((x) => Math.abs(x.g.now - c) <= 1) : gapF === "redev" ? L.filter((x) => !/재건축/.test(x.r.k)) : L;
    // 입주까지 돈이 계산되는 곳을 위로, 신축 시세가 없어 계산 안 되는 곳은 맨 아래로
    const calc = (x) => !!(x.g.x && x.g.x.ok && x.g.total != null);
    F.sort((a, b) => calc(b) - calc(a) || a.g.now - b.g.now);
    { const seen = new Set(); for (let i = F.length - 1; i >= 0; i--) {} const U = []; F.forEach((x) => { const k = shortName(x.r.n) + x.r.g; if (!seen.has(k)) { seen.add(k); U.push(x); } }); F.length = 0; U.forEach((x) => F.push(x)); }
    const rate = (x) => { try { const p = investC(x.r).price; return p ? Math.round((x.g.D / p) * 100) : null; } catch (e) { return null; } };
    out.innerHTML = `<div class="fchips tl-f" role="group" aria-label="거르기">${[["all", "전체"], ["near", `내 돈 ${e1(c)} ±1억`], ["redev", "재개발만"]].map(([k, t]) => `<button type="button" class="ichip" data-gf="${k}" aria-pressed="${gapF === k}">${t}</button>`).join("")}</div>
      <p class="tl-lead" data-gapn="${L.length}">전세 시세 있는 ${fmt(L.length)}곳 · 홈 '갈 수 있는 곳'과 같은 기준</p>
      ${(() => { const na = F.filter((x) => !calc(x)).length; return na ? `<p class="tl-lead">${LBL.cashToMoveIn}이 계산 안 되는 ${na}곳(주변 신축 시세 없음)은 맨 아래에 있어요</p>` : ""; })()}
      <ol class="tl-l">${F.slice(0, gapN).map((x, i) => { const jr = rate(x); return `<li><a href="#${x.r.id}" data-id="${x.r.id}"><span class="tl-k">${i + 1}</span><span class="tl-n"><b>${esc(shortName(x.r.n))}</b><small>${esc(x.r.g)} · ${esc(stageName(x.r))}</small></span><span class="tl-v"><b>${e1(x.g.now)}</b><small>${x.g.x && x.g.x.ok && x.g.total != null ? `${LBL.cashToMoveIn} ${e1(x.g.total)}` : '<span class="tl-na" title="주변 신축 시세 자료가 없어 입주 때 돈을 계산하지 못했어요">입주까지 현금 계산 불가</span>'}</small></span></a></li>`; }).join("") || '<li class="tl-e">조건에 맞는 구역이 없어요</li>'}</ol>
      ${F.length > gapN ? `<button type="button" class="btn secondary s-more" id="gapMore">더 보기 (${F.length - gapN}곳)</button>` : ""}`;
    out.querySelectorAll("[data-gf]").forEach((b) => (b.onclick = () => { gapF = b.dataset.gf; gapN = 20; gapRender(); }));
    const m = document.getElementById("gapMore"); if (m) m.onclick = () => { gapN += 20; gapRender(); };
  }
  // ---------- 매물진단: 이 구역 매물 사도 입주권이 나오나 ----------
  let dSel = null;
  function diagRender() {
    const out = document.getElementById("diagTopOut"); if (!out) return;
    // renew-feat: 열린 직후 한 번 더 그려질 때(첫 화면 → 앱 붙기) 이미 친 검색어·초점을 지우지 않는다(main에도 있던 일)
    const q0 = document.getElementById("dgQ"), qv0 = q0 ? q0.value : "", qf0 = !!q0 && document.activeElement === q0;
    out.innerHTML = `<p class="tl-lead">구역을 고르면 지금 사도 입주권이 나오는지, 막히는 규정이 있는지 한 번에 봐요.</p><label class="tl-q"><span>구역 이름 · 지번</span><input id="dgQ" type="search" placeholder="구역 이름 또는 지번(예: 미아11, 미아동 791-2)" autocomplete="off"></label><ul class="tl-s" id="dgS"></ul><div id="dgR"></div>`;
    const q = document.getElementById("dgQ"), sl = document.getElementById("dgS");
    const pick = (b) => (b.onclick = () => { dSel = byId[b.dataset.d]; sl.innerHTML = ""; q.value = shortName(dSel.n); diagShow(); });
    // renew-feat F1: 지번으로도 찾기('미아동 791-2' · 검색창과 같은 필지 색인 public/pcli)
    // 사이클 2: 지번 꼴('미아동 791-2')은 지번 검색이 먼저 · 이름이 부분만 같은 구역('미아동 791-2882')은 따로 묶어 아래에(필지가 그 구역 안이라고 오해하지 않게)
    const byJibun = (raw, pq, nameHits) => {
      const h = pcliHits(pq), nz = (t) => String(t || "").replace(/\s/g, ""), v0 = nz(raw);
      // 이름이 검색어와 똑같은 구역(예: '미아동 791-2882')은 맨 위 따로 — 지번 색인을 받는 동안에도 바로 보인다
      const E = (nameHits || []).filter((r) => nz(shortName(r.n)) === v0), eH = E.length ? `<li class="tl-g" role="presentation">이 이름의 구역</li>` + E.map((r) => `<li><button type="button" data-d="${r.id}">${esc(shortName(r.n))}<small>${esc(r.g)} · ${esc(stageName(r))}</small></button></li>`).join("") : "";
      if (h === null) { sl.innerHTML = eH + '<li class="tl-e">지번 찾는 중…</li>'; sl.querySelectorAll("[data-d]").forEach(pick); Promise.all(pcliAlt(pq.dong).map(pcliLoad)).then(() => { if (q.value === raw) byJibun(raw, pq, nameHits); }); return; }
      const eIds = new Set(E.map((r) => r.id));
      const L = h.own.filter((r) => r.src !== "moa" && !(r.s >= 9) && !eIds.has(r.id)).slice(0, 8), jb = `${h.dong || pq.dong} ${pq.san ? "산" : ""}${pq.bon}${pq.bu ? "-" + pq.bu : ""}`, ids = new Set(L.map((r) => r.id).concat([...eIds]));
      const N = (nameHits || []).filter((r) => !ids.has(r.id)).slice(0, 5);
      sl.innerHTML = eH + (!L.length && E.length ? "" : `<li class="tl-g" role="presentation">지번 ${esc(jb)}</li>` + (L.map((r) => `<li><button type="button" data-d="${r.id}">${esc(shortName(r.n))}<small>${esc(r.g)} · ${esc(stageName(r))} · ${esc(jb)} 필지가 구역 안</small></button></li>`).join("") || `<li class="tl-e">${esc(window.ZP_josa ? ZP_josa(jb, "은", "는") : jb + "은")} 지도에 있는 진행 중 재개발 구역 밖이에요</li>`))
        + (N.length ? `<li class="tl-g" role="presentation">이름에 '${esc(q.value.trim())}'이 들어간 구역 · 지번과는 별개</li>` + N.map((r) => `<li><button type="button" data-d="${r.id}">${esc(shortName(r.n))}<small>${esc(r.g)} · ${esc(stageName(r))} · 이름만 비슷해요</small></button></li>`).join("") : "");
      sl.querySelectorAll("[data-d]").forEach(pick);
    };
    q.oninput = () => {
      const v = q.value.replace(/\s/g, ""); if (!v) { sl.innerHTML = ""; return; }
      const hits = R.filter((r) => r.src !== "moa" && !(r.s >= 9) && (shortName(r.n).replace(/\s/g, "").includes(v) || (r.n || "").replace(/\s/g, "").includes(v))).slice(0, 8);
      // '동 + 번지' 꼴이면 지번 검색이 먼저 · 이름 부분 일치는 따로 아래에(사이클 2 · 라이브 검색창과 같은 필지 색인)
      const pq = /\d/.test(v) ? pcliQ(q.value) : null; if (pq) { byJibun(q.value, pq, hits); return; }
      sl.innerHTML = hits.map((r) => `<li><button type="button" data-d="${r.id}">${esc(shortName(r.n))}<small>${esc(r.g)} · ${esc(stageName(r))}</small></button></li>`).join("") || '<li class="tl-e">찾는 구역이 없어요</li>';
      sl.querySelectorAll("[data-d]").forEach(pick);
    };
    // 처음 열면 빈 화면 대신 예시 구역을 보여 준다
    let ex = false;
    if (!dSel) {
      const pick = (t) => R.find((r) => r.src !== "moa" && !(r.s >= 9) && !r.dn && shortName(r.n).replace(/\s/g, "") === t);
      dSel = pick("한남3구역") || pick("성수1지구") || R.filter((r) => r.tx && r.tx.n3 && !(r.s >= 9) && r.src !== "moa").sort((a, b) => b.tx.n3 - a.tx.n3)[0] || null;
      ex = !!dSel;
    }
    if (dSel) { q.value = shortName(dSel.n); diagShow(ex); }
    if (qv0 && qv0 !== q.value) { q.value = qv0; q.oninput(); }
    if (qf0) q.focus({ preventScroll: true });
    q.addEventListener("focus", () => { if (ex) { q.select(); } }, { once: true });
  }
  // 매물진단 판정 목록(구역 리포트 '규제' 탭도 이 함수를 그대로 쓴다): [cls, 항목, 설명, 출처 링크?]
  function diagItems(r, redraw) {
    const items = [], pol = (D && D.policy) || {}, LAW = "https://www.law.go.kr/법령/도시및주거환경정비법";
    // 사이클 2: 사업 유형에 맞는 법 — 가로·소규모·모아주택은 빈집 및 소규모주택 정비에 관한 특례법(소규모주택정비법), 재개발·재건축은 도시정비법
    const SM = isSmall(r) || r.src === "moa", LAWS = "https://www.law.go.kr/법령/빈집및소규모주택정비에관한특례법";
    const tLaw = SM ? [LAWS + "/제24조", "소규모주택정비법 제24조"] : [LAW + "/제39조", "도정법 제39조"];
    const w = buyWindow(r);
    // 28차: 착공 뒤 입주권 거래가 있는 곳(o903 고척4)은 '✕ 입주권 없음'으로 시작하지 않고 길을 함께 — 집(지금 매물)을 사면 없음 · 조합원 입주권은 따로 거래돼요(/z key3 '조합원 입주권을 사야 해요'와 같은 판정)
    const imT = w.cls === "no" && r.s >= 8 && r.tx && r.tx.im ? r.tx.im : null;
    if (imT) items.push(["warn", "입주권", `집을 사면 입주권 없음 · 조합원 입주권은 따로 살 수 있어요 · 참고 입주권 시세 ${ZF.eok(imT)}`, tLaw]);
    // 4라운드: 관리처분인가(재건축은 조합설립인가) 뒤 매수는 '원칙적으로 없음' — 예외 매물(10년 보유·5년 거주 1주택 등)은 승계되므로 ✕ 대신 !(아래 '조합원 지위양도' 줄과 같은 말)
    else if (w.cls === "no" && / 이후 매수분$/.test(w.due || "") && /예외:/.test(w.d || "")) items.push(["warn", "입주권", `원칙적으로 없음(${w.due.replace(/ 이후 매수분$/, "")} 이후 매수) · 예외 매물(10년 보유·5년 거주 1주택 등)만 승계`, tLaw]);
    else items.push([w.cls === "ok" ? "ok" : w.cls === "no" ? "no" : "warn", "입주권", w.t + (w.due ? ` · ${w.due}` : ""), tLaw]);
    // 토허: 서울 전역(아파트)·신통·구역 안 허가 기록·구 단위 기록까지 본 뒤에만 말한다(56_toheo.js). 허가 자료가 오면 다시 그림
    let th = null;
    try { th = TOH.lookup(r); } catch (e) {}
    const lpSrc = ["https://land.seoul.go.kr/", "서울부동산정보광장"];
    if (th) items.push([th.cls, "토지거래허가", th.t, lpSrc]);
    else { const lp = landPermit(r); items.push([lp ? "no" : "warn", "토지거래허가", lp ? lp.t : "허가 기록 불러오는 중 · 계약 전 구청 확인", lpSrc]); }
    try { if (!TOH.loaded() && redraw) TOH.load().then(redraw); } catch (e) {}
    const sp = pol.speculation || {};
    items.push(["warn", "투기과열·조정대상지역", `서울 25개 구 전역 (${(sp.date || "2025-10-16").replaceAll("-", ".")}~)${/강남|서초|송파|용산/.test(r.g) ? ` · ${r.g}는 2017.8.3부터 연속` : ""} · 대출·세금·전매 규제 적용`, [sp.src || "https://www.korea.kr", "정책브리핑"]]);
    try { const rt = ZX.rights(r); items.push([rt.k === "set" ? (rt.c === "low" ? "warn" : "ok") : "warn", "권리산정기준일", rt.k === "set" ? (rt.old ? `${rt.d}(지정일)로 추정 · 서울시 조례 부칙(2010.7.16 이전 지정) 확인 필요` : `${rt.d} 전 준공·등기 건물만 단독 입주권${rt.c === "low" ? " · 추정이라 확인 필요" : ""}`) : rt.k === "chg" ? "확인 필요 · 등록된 구역지정일이 변경 지정일이라 추정하지 않아요" : rt.k === "moa" ? "모아타운·가로주택은 기준일을 따로 고시해요 · 구청 확인" : "날짜 미확정 · 구청 확인", SM ? [rt.u && !/law\.go\.kr/.test(rt.u) ? rt.u : LAWS, rt.u && !/law\.go\.kr/.test(rt.u) ? "서울시 고시·보도" : "소규모주택정비법"] : [LAW + "/제77조", "도정법 제77조"]]); } catch (e) {}
    if (SM) {
      items.push(["warn", "여러 채 보유(다물권)", "가로·소규모·모아주택은 소규모주택정비법의 분양 기준과 조합 정관을 따라요 · 한 구역에 여러 채면 입주권이 몇 개인지 조합·구청에 확인", [LAWS, "소규모주택정비법"]]);
      items.push(["warn", "재당첨 제한", "가로·소규모·모아주택의 재당첨 제한 적용 여부는 소규모주택정비법과 조합원 모집 공고로 확인", [LAWS, "소규모주택정비법"]]);
    } else {
      items.push(["warn", "여러 채 보유(다물권)", "한 구역에 여러 채면 원칙적으로 입주권 1개(세대원 합산) · 1+1 분양은 종전 가격·주거전용면적 범위 안에서만(추가 1채는 60㎡ 이하·3년 전매 제한) · 투기과열지구 재건축은 다주택 조합원도 1주택만", [LAW + "/제76조", "도정법 제76조"]]);
      items.push(["warn", "재당첨 제한", "투기과열지구 정비사업에서 조합원 분양을 받은 세대는 5년 동안 다른 투기과열지구 정비사업 분양신청 불가(세대원 포함)", [LAW + "/제72조", "도정법 제72조"]]);
    }
    const rb = /재건축/.test(r.k), lock = rb || SM ? r.s >= 4 : r.s >= 6;
    // 5라운드: 위 '입주권' 줄과 같은 규정 — 같은 표시(!)·같은 말투('원칙적으로 … 예외 매물만') · 사이클 2: 사업 유형별 조항
    // 사이클 2: 재개발 부칙(2018.1.24까지 사업시행인가 '신청' 구역은 관리처분인가 뒤에도 제한 없음) — 시트 입주권 줄과 같은 판정(b18Of)
    const b8 = !rb && !SM ? b18Of(r) : { st: "ap" }, d8 = (d) => String(d || "").replace(/^(\d{4})-(\d{2})-(\d{2}).*/, (m, y, a, c) => `${y}.${+a}.${+c}`);
    if (b8.st === "ex") items.push(["ok", "조합원 지위양도", `${b8.by === "app" ? `사업시행인가 신청(${d8(b8.d)})` : `사업시행인가(${d8(b8.d)})`}이 2018.1.24까지라 관리처분인가 뒤에도 지위양도 제한이 적용되지 않아요(도시정비법 부칙 제2조 · 신청일 기준)`, [LAW + "/제39조", "도정법 제39조·부칙"]]);
    else if (b8.st === "unk") items.push(["warn", "조합원 지위양도", `사업시행인가(${d8(b8.d)})가 2018.1.25 시행 직후라 신청이 2018.1.24까지였다면 관리처분인가 뒤에도 제한이 없어요 · 신청일 자료가 없어 단정하지 않아요(조합·구청 확인)${lock ? "" : " · 지금은 아직 관리처분인가 전"}`, [LAW + "/제39조", "도정법 제39조·부칙"]]);
    else items.push([lock ? "warn" : "ok", "조합원 지위양도", `${SM ? "가로·소규모·모아주택은 조합설립인가" : rb ? "재건축은 조합설립인가" : "재개발은 관리처분인가"} 뒤 매수는 원칙적으로 승계 불가 · 예외 매물(10년 보유·5년 거주 1주택 등)만 승계 · ${lock ? "지금 이 단계라 예외 매물만" : "지금은 아직 그 전"}`, tLaw]);
    // 사이클 2: 판정 줄마다 '추정·확인 필요'(공식 사실인 투기과열 지정은 빼고)
    items.forEach((it) => { if (it[1] !== "투기과열·조정대상지역") it[4] = 1; });
    // 5라운드(설치 앱): 날짜 꼴 하나(YYYY.M.D) — '2009.10.01'·'2026.09.23' → '2009.10.1'·'2026.9.23'
    if (document.documentElement.classList.contains("is-tapp")) items.forEach((it) => { it[2] = String(it[2]).replace(/\b(\d{4})\.(\d{1,2})\.(\d{1,2})\b/g, (m, y, a, b) => `${y}.${+a}.${+b}`); });
    return items;
  }
  const dgLi = ([c, k, v, src, est]) => `<li class="${c}"><i aria-hidden="true">${c === "ok" ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : c === "no" ? "✕" : c === "na" ? "?" : "!"}</i><span><b>${k}${est ? ' <em class="dg-est">추정·확인 필요</em>' : ""}</b><small>${esc(v)}${src ? ` <a href="${esc(src[0])}" target="_blank" rel="noopener">${esc(src[1])} ↗</a>` : ""}</small></span></li>`;
  function diagShow(ex) {
    const r = dSel, box = document.getElementById("dgR"); if (!r || !box) return;
    const items = diagItems(r, () => { if (dSel === r) diagShow(ex); });
    box.innerHTML = `${ex ? '<p class="dg-ex">예시로 한 곳을 보여 드려요 · 구역 이름으로 다른 곳을 찾아 보세요</p>' : ""}<div class="dg-h"><b>${esc(shortName(r.n))}</b><span>${esc(r.g)} · ${esc(stageName(r))}</span><button type="button" class="btn text sm" data-open="${r.id}">구역 보기 →</button></div>
      <ul class="dg-l">${items.map(dgLi).join("")}</ul>`;
    box.querySelector("[data-open]").onclick = () => { curTab = "money"; select(r.id, true, false, { scroll: true }); };
    // renew-feat F1: 신축 쪼개기 위험(필지 준공연도 vs 권리산정기준일) · 매수 전 규정(모든 구역 공통) 펼치기 — 기능 묶음 /b/f
    try { window.ZP_feat.load().then((F) => { if (dSel === r && F.diag) F.diag(r, box, window.ZP_feat.ctx()); }).catch(() => {}); } catch (e) {}
  }
  // ---------- 입주 물량: 연도별 예상 입주 세대(진행 단계가 늦은 곳만) ----------
  let supGu = "";
  // 입주 물량: 구역마다 준공 시점 분포(eLo·eMid·eHi = 25/50/75%, cond = 관측 범위 안 준공 비율)를 로그정규로 펴서
  // 해마다 '준공될 확률 × 세대 수'를 더한 기대 입주 세대. 한 해에 몰아 넣지 않아 덜 들쭉날쭉하다.
  const ym2t = (s, t0) => { const m = /^(\d{4})-(\d{2})/.exec(String(s || "")); return m ? +m[1] + (+m[2] - 0.5) / 12 - t0 : null; };
  const ncdf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2), y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2); return x >= 0 ? (1 + y) / 2 : (1 - y) / 2; };
  function supRender() {
    const out = document.getElementById("supplyTopOut"); if (!out) return;
    const d0 = new Date(), now = d0.getFullYear(), t0 = now + d0.getMonth() / 12, Y = {};
    for (let y = now; y < now + 10; y++) Y[y] = { n: 0, z: [] };
    let stale = 0;
    R.forEach((r) => {
      if (r.src === "moa" || r.dn || r.cx || r.s < 5 || r.s >= 9 || (supGu && r.g !== supGu)) return;
      const u = r.sm && (r.sm.units || r.sm.hh); if (!u) return;
      const e = r.eta || {};
      if (r.stale || e.stale) { stale++; return; }
      const m = ym2t(e.eMid, t0); if (m == null) return;
      const lo = ym2t(e.eLo, t0), hi = ym2t(e.eHi, t0);
      const mu = Math.log(Math.max(0.15, m)), sg = lo != null && hi != null ? Math.max(0.08, Math.log(Math.max(0.2, hi) / Math.max(0.1, lo)) / 1.349) : 0.35;
      const pc = e.cond != null ? e.cond : 1;
      const F = (t) => (t <= 0 ? 0 : ncdf((Math.log(t) - mu) / sg));
      for (let y = now; y < now + 10; y++) {
        const p = pc * (F(y + 1 - t0) - F(Math.max(0, y - t0)));
        if (p > 0.005) { Y[y].n += u * p; Y[y].z.push({ r, p, u }); }
      }
    });
    const ys = Object.keys(Y).map(Number); ys.forEach((y) => (Y[y].n = Math.round(Y[y].n)));
    const mx = Math.max(1, ...ys.map((y) => Y[y].n));
    const gus = [...new Set(R.map((r) => r.g))].sort();
    const tot = ys.reduce((a, y) => a + Y[y].n, 0);
    const big = (y) => Y[y].z.filter((x) => x.p >= 0.1);
    out.innerHTML = `<label class="tl-q"><span>지역</span><select id="supG"><option value="">서울 전체</option>${gus.map((g) => `<option${g === supGu ? " selected" : ""}>${esc(g)}</option>`).join("")}</select></label>
      <p class="tl-lead">사업시행인가 이후 정비구역의 해마다 <b>기대 입주 세대</b>(구역별 준공 확률 × 계획 세대) · 일반 분양 아파트는 빠져요 · 서울 사업장 기록으로 낸 <b>추정</b>이라 해가 멀수록 크게 달라질 수 있어요${stale ? ` · 진행 확인 필요 ${fmt(stale)}곳은 뺐어요` : ""}</p>
      <p class="sp-key"><span><i class="sp-k0"></i>올해</span><span><i class="sp-k1"></i>추정</span><span class="sp-tot">10년 합계 약 ${fmt(tot)}세대</span></p>
      <div class="sp-hb" role="list">${ys.map((y) => `<button type="button" role="listitem" class="sp-r${y > now ? " est" : ""}" data-y="${y}" aria-label="${y}년 ${y > now ? "추정 " : ""}약 ${fmt(Y[y].n)}세대"${Y[y].n ? "" : " disabled"}><span class="sp-y">${y}${y > now ? "<small>추정</small>" : "<small>올해</small>"}</span><span class="sp-t"><i style="width:${Y[y].n ? Math.max(2, Math.round((Y[y].n / mx) * 100)) : 0}%"></i></span><b>${Y[y].n ? "약 " + fmt(Y[y].n) + "세대" : "거의 없음"}</b></button>`).join("")}</div>
      <div id="supZ"></div>`;
    document.getElementById("supG").onchange = (e) => { supGu = e.target.value; supRender(); };
    out.querySelectorAll("[data-y]").forEach((b) => (b.onclick = () => {
      const y = +b.dataset.y, z = big(y).sort((a, c) => c.u * c.p - a.u * a.p);
      out.querySelectorAll("[data-y]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      document.getElementById("supZ").innerHTML = `<h3>${y}년 입주 가능성이 있는 곳 · ${z.length}곳</h3><p class="tl-lead">그해 준공될 확률 10% 이상만 · 확률이 높은 세대 순</p><ul class="tl-l">${z.map(({ r, p, u }) => `<li><a href="#${r.id}" data-id="${r.id}"><span class="tl-n"><b>${esc(shortName(r.n))}</b><small>${esc(r.g)} · ${esc(stageName(r))}</small></span><span class="tl-v"><b>${fmt(u)}세대</b><small>그해 확률 ${Math.round(p * 100)}%</small></span></a></li>`).join("") || '<li class="tl-e">확률 10% 넘는 곳이 없어요</li>'}</ul>`;
    }));
    // 넓은 화면은 오른쪽 칸이 비지 않게 가장 많은 해를 먼저 펼친다
    if (matchMedia("(min-width:1200px)").matches) { const top = ys.filter((y) => Y[y].n).sort((a, b) => Y[b].n - Y[a].n)[0]; const tb = top != null && out.querySelector(`[data-y="${top}"]`); if (tb) tb.click(); }
  }
  const RENDER = { gapTop: gapRender, diagTop: diagRender, supplyTop: supRender };
  function init() {
    Object.keys(RENDER).forEach((id) => {
      const s = document.getElementById(id); if (!s) return;
      new MutationObserver(() => { if (s.classList.contains("s-on")) RENDER[id](); }).observe(s, { attributes: true, attributeFilter: ["class"] });
      if (s.classList.contains("s-on") || location.hash === "#" + id) setTimeout(() => RENDER[id](), 50);
      s.addEventListener("click", (e) => { const a = e.target.closest("a[data-id]"); if (!a) return; e.preventDefault(); curTab = "money"; select(a.dataset.id, true, false, { scroll: !MQ_SHEET.matches }); });
    });
    // 현금·방식이 바뀌면 열린 갭 순위도 다시
    const _p = plan; plan = function () { const x = _p.apply(this, arguments); try { const g = document.getElementById("gapTop"); if (g && g.classList.contains("s-on")) gapRender(); } catch (e) {} return x; };
  }
  return { init, diagItems, dgLi };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", TOOLS.init) : setTimeout(TOOLS.init, 0);
/* ===================== 지도 겹쳐 보기: 오른쪽 위 세로 아이콘 레일(디자이너 안) =====================
   호재·신고가·학교는 늘 보이고, 나머지(학원가·상권·병원·마트)는 ⋯ 를 누르면 왼쪽으로 펼쳐진다. 한 번 탭 = 켜고 끄기. */
(() => {
  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    hj: P('<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 10h12M9 13.5h.01M15 13.5h.01M8 21l2-4M16 21l-2-4"/>'),
    hi: P('<path d="M3 17l6-6 4 4 8-8M16 7h5v5"/>'),
    edu: P('<path d="M3 9l9-6 9 6M5 9v12h14V9M12 3V1.5h3M10 21v-5h4v5"/>'),
    acad: P('<path d="M12 6C9.5 4.5 6 4.5 3 5.5v13c3-1 6.5-1 9 .5 2.5-1.5 6-1.5 9-.5v-13c-3-1-6.5-1-9 .5zM12 6v14"/>'),
    biz: P('<path d="M3 8l2-4h14l2 4M3 8c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3M5 11v10h14V11M10 21v-5h4v5"/>'),
    med: P('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>'),
    mart: P('<path d="M2 4h3l2 10h11l2-8H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>'),
    more: P('<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3"/>'),
  };
  const NM = { hj: "호재", hi: "신고가", edu: "학교", acad: "학원가", biz: "상권", med: "병원", mart: "마트" };
  const MAIN = ["hj", "hi", "edu", "acad", "biz", "med"], EXTRA = [];
  function build() {
    const p = document.getElementById("lmLayers"), box = document.getElementById("mapbox");
    if (!p || !box) return false;
    const st0 = box.querySelector(".s-rail-w[data-static]");
    if (box.querySelector(".s-rail") && !st0) return true;
    if (!p.querySelector("input[type=checkbox]")) return false;
    document.querySelectorAll(".s-lyr").forEach((x) => x.remove());
    const chk = (k) => p.querySelector(`input[value="${k}"]`);
    const btn = (k) => { const c = chk(k); return c ? `<button type="button" data-l="${k}" aria-pressed="${c.checked}" aria-label="${NM[k]} 겹쳐 보기">${IC[k]}<span>${NM[k]}</span></button>` : ""; };
    let w = st0;
    if (w) {
      // 23차: 첫 화면 HTML에 미리 그린 레일(shell.html)을 그대로 쓴다 — 켜짐 상태만 저장된 겹쳐 보기에 맞춘다(첫 페인트 == 최종)
      delete w.dataset.static;
      w.querySelectorAll("button[data-l]").forEach((b) => { const c = chk(b.dataset.l); if (c) b.setAttribute("aria-pressed", String(c.checked)); });
    } else {
      w = document.createElement("div");
      w.className = "s-rail-w";
      w.innerHTML = `<div class="s-rail" role="group" aria-label="지도에 겹쳐 보기">${MAIN.map(btn).join("")}</div><div class="s-fly" role="group" aria-label="겹쳐 보기 더보기" hidden>${EXTRA.map(btn).join("")}</div><span class="s-tip" aria-live="polite"></span>`;
      // 탭 순서: 겹쳐 보기 레일 → 확대·축소 → 지도(레일을 지도 앞에 둔다. 겹침 순서는 z-index로)
      const lm = box.querySelector("#lmap");
      lm ? box.insertBefore(w, lm) : box.appendChild(w);
    }
    const fly = w.querySelector(".s-fly"), more = null, tip = w.querySelector(".s-tip");
    const dot = () => {};
    let tt = 0;
    w.addEventListener("click", (e) => {
      
      const b = e.target.closest("button[data-l]"); if (!b) return;
      const c = chk(b.dataset.l); if (!c) return;
      try { dispatchEvent(new Event("zp:mapgo")); } catch (er) {}   // 레이어를 켜면 실제 지도를 바로 붙인다(켠 레이어는 지도가 준비되면 반영)
      c.checked = !c.checked; c.dispatchEvent(new Event("change", { bubbles: true }));
      b.setAttribute("aria-pressed", String(c.checked)); dot();
      try { navigator.vibrate && navigator.vibrate(10); } catch (er) {}
      tip.textContent = `${NM[b.dataset.l]} ${c.checked ? "켜짐" : "꺼짐"}`; tip.classList.add("on");
      clearTimeout(tt); tt = setTimeout(() => tip.classList.remove("on"), 1200);
    });
    
    dot();
    return true;
  }
  const t = setInterval(() => { if (build()) clearInterval(t); }, 150);
  setTimeout(() => clearInterval(t), 30000);
})();
