/* ===================== 첫 화면 단순화(사용자 피드백) =====================
   메인 = 현금 게이지 + 서울 지도 + "지역 · 필요한 돈" 목록. 글자는 최소로.
   나머지 기능(계산기 세부 조건·출퇴근·순위·고시 등)은 아래 타일을 눌러 하나씩 연다.
   기존 섹션과 계산 엔진은 그대로 두고, 화면 구성만 바꾼다. */
window.__zpCur = () => (cur && cur.id) || null;   // 지금 연 구역 id(SIMPLE 안의 cur는 기능 화면 id라 이름이 겹친다)
const SIMPLE = (() => {
  // 도구 목록은 여기 한 곳만: 홈 '더 알아보기' 격자와 ⋯ 메뉴 '도구' 묶음을 둘 다 이것으로 만든다("적게, 완벽하게" — 6개)
  // [화면 id, 이름, 아이콘 경로, 아이콘 색, 한 줄 설명]
  const TOOLS_ALL = window.ZP_TOOLS = [
    ["rankHub", "순위", "M4 20h16M7 16V9M12 16V5M17 16v-4", "#1f3a87", "전세 끼고·실거래·입지"],
    ["planner", "입주 계산", "M4 4h16v16H4zM8 8h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h4", "#4f46e5", "입주까지 현금·모으면 언제"],
    ["news", "소식", "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4", "#0e7490", "단계 변경·입주 물량"],
    ["commuteTop", "출퇴근", "M7 3h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 10h14M8 20l2-4M16 20l-2-4", "#2f6feb", "회사까지 몇 분 안"],
    ["diagTop", "매물진단", "M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "#16a34a", "이 매물 입주권 나오나"],
    ["favTop", "관심 구역", "M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.4 7.2 4.4c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z", "#1f3a87", "관심 구역 소식"],
  ];
  // 예전 도구 주소(#gapTop 등)는 합친 화면 + 그 탭으로 연다(정적 페이지·공유 링크가 그대로 동작) — [화면, 탭]
  const ALIAS = window.ZP_ALIAS = { gapTop: ["rankHub", "gap"], txrTop: ["rankHub", "txr"], rankTop: ["rankHub", "loc"], ntcTop: ["news", "feed"], aucTop: ["news", "feed"], newTop: ["news", "feed"], supplyTop: ["news", "supply"], saveTop: ["planner", "save"] };
  // 격자 = 도구 6개 전부(폰 3×2 · PC 한 줄/두 줄), 더보기 없음
  const VIEWS = TOOLS_ALL;
  // ⋯ 메뉴 '도구' 묶음: 전부(shell.html #mpTools는 비워 두고 여기서 채운다)
  { const g = document.getElementById("mpTools"); if (g) g.innerHTML = TOOLS_ALL.map(([id, t, d, c]) => `<a href="#${id}" data-menu="${id}"><i class="mp-ic" aria-hidden="true" style="--ic:${c}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></i><b>${t}</b></a>`).join(""); }
  // 아이콘 격자에는 안 넣지만 메뉴(⋯)·링크로 여는 화면
  const MORE = ["results", "rulesTop", "readsTop", "statsTop", "my"];
  const LINKS = [];
  const IDS = VIEWS.map((v) => v[0]).concat(MORE);
  const known = (id) => IDS.includes(id) || !!ALIAS[id];
  const KN = [[0, 0.5], [28, 2], [58, 5], [88, 10], [100, 15]];
  const toCash = (p) => { for (let i = 1; i < KN.length; i++) if (p <= KN[i][0]) { const [a, x] = KN[i - 1], [b, y] = KN[i]; const v = x + ((p - a) / (b - a)) * (y - x); return v < 2 ? Math.round(v * 10) / 10 : v < 10 ? Math.round(v * 2) / 2 : Math.round(v); } return 15; };
  const toPos = (c) => { c = Math.min(15, Math.max(0.5, c)); for (let i = 1; i < KN.length; i++) if (c <= KN[i][1]) { const [a, x] = KN[i - 1], [b, y] = KN[i]; return a + ((c - x) / (y - x)) * (b - a); } return 100; };
  let POPS = null;   // POP은 앱 본문에서 나중에 만들어지므로 처음 쓸 때 채운다
  // 지도 구별 숫자와 같은 기준(지도 색칠 기준이 '지금 매수'로 바뀌면 목록도 같이)
  const okR = (r) => (POPS || (POPS = new Set(POP.map((x) => x.id)))).has(r.id) && (effBasis() === "now" ? affOk(r, "now") : affOk(r));
  // 홈 '갈 수 있는 곳' 곳 수 — 다른 화면도 이 함수 하나로 센다(cash 생략 시 지금 게이지 금액)
  const countAt = (cash) => {
    if (cash == null || !isFinite(cash)) return R.filter(okR).length;
    const save = CASH;
    try { CASH = +cash; return R.filter(okR).length; } finally { CASH = save; }
  };
  window.ZP_count = countAt;
  // 목록 정렬(정렬 시트): 맞춤(내 돈에 가장 가까운 곳 먼저) · 적은 돈 · 입주까지 현금 · 입주 빠른 · 역 가까운 · 시세 차이 — [키, 이름, 한 줄 설명]
  const SORTS = [["fit", "맞춤순", "내 돈에 가까운 순"], ["low", "적은 돈 순", "지금 필요한 돈이 적은 곳부터"], ["move", `${LBL.cashToMoveIn} 적은 순`, "입주할 때까지 드는 현금의 합"], ["eta", "입주 빠른 순", "예상 입주가 이른 곳부터"], ["near", "역 가까운 순", "가장 가까운 역까지 걸어서"], ["gain", "입주 때 시세 차이 큰 순", "입주 때 새 아파트 시세 − 들어간 돈"]];
  // 입주 때 시세 차이(현금 매수 계산 · 리포트 '입주 때 시세 차이'와 같은 값). 계산 못 하면 null → 맨 아래
  const gainOf = (r) => { try { const x = investC(r); return x && x.ok && x.gain != null && isFinite(x.gain) ? x.gain : null; } catch (e) { return null; } };
  let sortK = "fit";
  try { const s0 = localStorage.getItem("emr.sort"); if (SORTS.some((x) => x[0] === s0)) sortK = s0; } catch (e) {}
  // 처음 보이는 줄 수: PC는 옆 지도 높이를 채울 만큼(카드 84px), 폰은 8줄 · 그 뒤는 끝에 닿으면 20곳씩 더(무한 스크롤 · 10줄 넘게 그리지 않아 첫 화면이 가볍다)
  const SHOW0 = () => { try { return matchMedia("(min-width:981px)").matches ? Math.max(6, Math.min(12, Math.floor((Math.min(innerHeight - 79, 902) - 120) / 84) + 2)) : 8; } catch (e) { return 8; } };
  const STEP = 20;
  // 지도 범위만: 전체 지도를 확대해 둔 채 '목록 보기'를 누르면 그 화면 안 구역만(칩 ✕로 해제). [서,남,동,북]
  // 줌 12.5 이상(구보다 확대)인 서울 지도면 '이 지도 범위만 보기' 칩을 띄우고(PC·폰 공통), 켜 두면 지도를 옮길 때마다 목록이 따라온다.
  // 12.5 아래로 빼면 저절로 풀린다. 켜 둔 동안은 금액을 바꿔도 지도가 자동으로 옮겨 가지 않는다(10_lmap.js fitAff가 ZP_bbOn을 봄)
  let bbF = null, bbCan = false;
  const bbGet = () => { try { const m = LMX.map(), dv = $("mapbox") && $("mapbox").dataset.view; if (m && LMX.on() && dv !== "gu" && mapView === "seoul" && m.getZoom() >= 12.5) {
    // PC 끼운 지도는 아래쪽이 창 밖일 수 있다 → 화면에 보이는 부분만(머리 아래 ~ 창 아래)
    const cv = m.getCanvas(), r = cv.getBoundingClientRect(), y0 = Math.max(0, (HDR() || 56) - r.top), y1 = Math.min(r.height, innerHeight - r.top);
    if (matchMedia("(min-width:981px)").matches && y1 - y0 > 120 && (y0 > 0 || y1 < r.height)) { const a = m.unproject([0, y0]), c = m.unproject([r.width, y1]); return [a.lng, c.lat, c.lng, a.lat]; }
    const b = m.getBounds(); return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]; } } catch (e) {} return null; };
  window.ZP_bbOn = () => !!bbF;
  // 사람이 지도를 옮기거나 확대하면(줌 12.5 이상) 목록이 저절로 '지도 범위만'으로 → 칩 '지도 범위만 · N곳 ✕'. ✕로 풀면 다음에 사람이 옮길 때까지 서울 전체
  const bbMove = (e) => {
    const d = (e && e.detail) || {}, b = bbGet();
    bbCan = !!b;
    if (!bbF && d.user && b && !gu) { bbF = b; shown = SHOW0(); render(); return; }
    if (bbF && String(b) !== String(bbF)) { bbF = b; shown = SHOW0(); render(); }
  };
  addEventListener("zp:mapmove", bbMove);
  // PC: 페이지를 내려 지도 칸이 머리 밑에 붙으면 보이는 부분이 바뀐다
  { let t = 0; addEventListener("scroll", () => { if (!bbF) return; clearTimeout(t); t = setTimeout(() => { if (matchMedia("(min-width:981px)").matches) bbMove(); }, 180); }, { passive: true }); }
  const inBB = (r) => !bbF || (r.ll && r.ll[1] >= bbF[0] && r.ll[1] <= bbF[2] && r.ll[0] >= bbF[1] && r.ll[0] <= bbF[3]);
  let listGu = "", gu = "", kind = "", shown = SHOW0(), timer = 0, keepY = null;
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  // 1억 아래는 만 원(9,515만 → 9,500만) · 1억부터 '1.2억'
  const eokS = ZF.cash;   // 지도·핀·리포트와 같은 ZF 꼴
  const dongOf = (r) => { const m = /^(?:서울(?:특별)?시\s*)?(?:[가-힣]+구\s+)?([가-힣]+?(?:\d+(?:·\d+)*)?(?:동\d+가|로\d+가|\d+가|동|로|가))(?=[\s\d(산]|$)/.exec(r.j || r.bj || ""); return m ? m[1] : r.dg || ""; };
  const KIND = (r) => (/재건축/.test(r.k) ? "rebuild" : /가로|소규모/.test(r.k) ? "small" : "redev");
  function needOf(r) {
    if (gapMode()) { const g = gapOf(r); return { now: g.now, total: g.total }; }
    const x = investC(r);
    return { now: x.needBuy, total: x.ok ? x.needTotal : null };
  }
  // '입주 빠른순'일 때 줄마다 예상 입주(계산용 추정) — 정렬 기준이 눈에 보이게
  const etaTag = (r) => { try { const t = etaShow(r); return /\d/.test(t) ? ` · <em class="s-tag eta">입주 ${esc(t)}</em>` : ` · <em>입주 ${esc(t)}</em>`; } catch (e) { return ""; } };
  // '입주 때 시세 차이 큰 순'일 때 줄마다 그 값(정렬 기준이 보이게)
  const gainTag = (r) => { const g = gainOf(r); return g == null ? " · <em>시세 차이 계산 못 함</em>" : ` · <em class="s-tag">시세 차이 ${g > 0 ? "+" : ""}${esc(eokS(g))}</em>`; };
  const NA_WHY = "입주 시점·신축 시세 자료가 부족해요";
  const NA_L = "입주까지 현금 계산 보류";   // 계산 안 되는 상태의 이름 하나(목록·/gu·/z·상세 · 20차 G8)
  function rows() {
    const nowK = gapMode() || effBasis() !== "total";
    const etaT = (r) => { try { const p = projection(r); return p && p.eMid && !p.past ? +p.eMid : Infinity; } catch (e) { return Infinity; } };
    const L = R.filter((r) => okR(r) && !r.lc && (!gu || r.g === gu) && (!kind || KIND(r) === kind) && (gu || inBB(r)))
      .map((r) => { const n = needOf(r), m = (nowK ? n.now : n.total) ?? 99; return { r, n, m, early: r.s <= 1 || r.eta?.p10 == null, eta: sortK === "eta" ? etaT(r) : 0, gn: sortK === "gain" ? gainOf(r) : null, sd: sortK === "near" ? (r.st && isFinite(r.st.d) ? r.st.d : Infinity) : 0 }; });
    // '입주 계산 불가'(입주까지 금액 없음)는 어떤 정렬·유형 칩이든 맨 아래로
    return L.sort((a, b) => (a.n.total == null) - (b.n.total == null)
      || (sortK === "fit" ? Math.abs(CASH - a.m) - Math.abs(CASH - b.m)
        : sortK === "eta" ? (a.eta === b.eta ? 0 : a.eta < b.eta ? -1 : 1)
        : sortK === "near" ? (a.sd === b.sd ? 0 : a.sd < b.sd ? -1 : 1)
        : sortK === "move" ? (a.n.total ?? 99) - (b.n.total ?? 99)
        : sortK === "gain" ? (a.gn == null) - (b.gn == null) || (b.gn ?? 0) - (a.gn ?? 0)
        : Math.round(a.m * 10) - Math.round(b.m * 10))
      || a.m - b.m);
  }
  // 유형 칩으로 0곳일 때: 그 유형은 지금 방식으로 최소 얼마부터 되는지(목록과 같은 판정·금액)
  const KNAME = { redev: "재개발", rebuild: "재건축", small: "가로·소규모" };
  function kindEmpty() {
    const nowK = gapMode() || effBasis() !== "total", save = CASH;
    let lo = Infinity;
    try {
      CASH = 999;
      R.forEach((r) => { if ((kind && KIND(r) !== kind) || r.lc || (gu && r.g !== gu) || (!gu && !inBB(r)) || !okR(r)) return; const n = needOf(r), m = nowK ? n.now : n.total; if (m != null && isFinite(m) && m < lo) lo = m; });
    } catch (e) {} finally { CASH = save; }
    // 이름: 유형 > 구 > 지도 범위 순으로 무엇을 거르고 있는지
    const up = isFinite(lo) ? Math.max(0.1, Math.ceil(lo * 10) / 10) : null;
    const wide = kind ? `<button type="button" class="btn text" id="sKindAll">전체 유형 보기</button>` : gu ? `<button type="button" class="btn text" id="sGuAll">서울 전체 보기</button>` : bbF ? `<button type="button" class="btn text" id="sBbAll">서울 전체 보기</button>` : "";
    return `<b class="s-et">이 범위엔 아직 없어요</b>${up != null ? `<small class="s-es">${gapMode() ? "전세 끼고" : "대출 끼고"} 가장 적게 드는 곳이 ${eokS(lo)}부터예요</small>` : ""}<span class="s-eact">${up != null ? `<button type="button" class="btn primary" id="sKindUp" data-v="${up}">${eokS(up)}으로 올려 보기</button>` : ""}${wide}</span>`;
  }
  // ---------- 구역 상태 4가지(지도 알약·점·목록 카드가 같은 함수) ----------
  // ok 가능(지금 필요한 돈 ≤ 내 돈 · 목록 '갈 수 있는 곳'과 같은 판정 okR) · near 조금 모자람(내 돈 × 1.2 안) · far 멀다 · na 정보 부족(계산 보류·구 평균 추정)
  const NEAR_K = 1.2;
  const ST_WORD = { ok: "가능", near: "조금 모자람", far: "더 필요해요", na: "자료 없음" };   // 21차: '멀다'(거리로 읽힘)·'정보 부족' → 쉬운 말
  function zstate(r) {
    let need = null, total = null;
    try { const n = needOf(r); need = n.now != null && isFinite(n.now) ? n.now : null; total = n.total != null && isFinite(n.total) ? n.total : null; } catch (e) {}
    if (okR(r)) return { st: "ok", need, total };
    let d = "n"; try { d = dotState(r); } catch (e) {}
    if (d === "u" || d === "e" || (need == null && d !== "x")) return { st: "na", need, total };
    if (d === "n" && need != null && need > CASH + 1e-9 && need <= CASH * NEAR_K + 1e-9) return { st: "near", need, total, gap: need - CASH };
    return { st: "far", need, total };
  }
  // 모자란 돈: 지금 필요한 돈(화면에 보이는 올림 값) − 내 돈 → '+2,000만' · '+0.2억'(ZF 꼴, 1억 아래 만 단위)
  const shortTxt = (need) => "+" + ZF.short(need - CASH);
  // 예산 시트 −/+ 한 번에 가는 금액(2억까지 1,000만 · 그 위 5,000만 칸에 맞춤) — 단추 이름(aria-label)도 이 값으로(29차: 2.1억에서 '5,000만 줄이기'인데 1,000만 내려가던 것)
  const bStepTo = (c0, d) => { let v = d < 0 ? (c0 <= 2 + 1e-9 ? Math.ceil(c0 * 10 - 1e-9) / 10 - 0.1 : Math.ceil(c0 * 2 - 1e-9) / 2 - 0.5) : (c0 <= 2 + 1e-9 ? Math.floor(c0 * 10 + 1e-9) / 10 + 0.1 : Math.floor(c0 * 2 + 1e-9) / 2 + 0.5); return Math.min(15, Math.max(0.5, Math.round(v * 100) / 100)); };   // 28차: 정확한 만 원(표시 올림 값끼리 뺀 100만 단위가 아님 · 최소 1만)
  // 단계 칩: 짧은 이름
  const stgShort = (r) => { let t = ""; try { t = stageName(r) || ""; } catch (e) {} return /주민합의/.test(t) ? "합의체" : /후보지|대상지/.test(t) ? "후보지" : /정비계획/.test(t) ? "정비계획" : /구역\s?지정/.test(t) ? "구역지정" : /추진위|주민대표/.test(t) ? "추진위" : /조합|시행자 지정/.test(t) ? "조합설립" : /사업시행/.test(t) ? "사업시행" : /관리처분/.test(t) ? "관리처분" : /이주|철거/.test(t) ? "이주·철거" : /착공|분양/.test(t) ? "착공" : /준공|입주/.test(t) ? "준공" : t.slice(0, 5); };
  const walkTxt = (r) => { if (!r.st || !r.st.n || !isFinite(r.st.d)) return ""; const m = ZF.walkMin(r.st.d); return m > 30 ? "" : `${String(r.st.n).replace(/역$/, "")}역 ${m}분`; };
  const tkOf = (r) => { try { const c = buyWindow(r).cls; return c === "ok" ? "y" : c === "no" ? "n" : ""; } catch (e) { return ""; } };
  // NEW: 이번 주(7일)에 '지금 필요한 돈'이 내려가 지금 내 돈으로 새로 갈 수 있게 된 곳(data/changes.json price 사건 · 없으면 표시 안 함)
  let NEWP = null, newAsk = false;
  function newLoad() {
    if (newAsk) return; newAsk = true;
    // 소식 탭과 같은 자료·같은 캐시(72_inbox INBOX.load) — 두 번 받지 않는다 · 첫 화면이 다 뜬 한참 뒤(한가할 때)
    const go = () => (typeof INBOX !== "undefined" && INBOX.load ? INBOX.load() : Promise.resolve(null)).then((j) => {
      const it = (j && Array.isArray(j.items) ? j.items : []).filter((e) => e && e.type === "price" && e.v);
      if (!it.length) return;
      const cut = new Date(new Date((j.asOf || D.asOf || "") + "T00:00:00+09:00").getTime() - 6 * 864e5).toISOString().slice(0, 10);
      NEWP = new Map(); it.forEach((e) => { if (String(e.date || "") >= cut) NEWP.set(e.id, e.v); });
      if (NEWP.size) { render(); try { LMX.paint(); } catch (er) {} }
    }).catch(() => {});
    setTimeout(() => (window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 6000 }) : (f) => setTimeout(f, 1500))(go), 5000);
  }
  const isNew = (r, need) => { if (!NEWP || !NEWP.has(r.id) || need == null) return false; const v = NEWP.get(r.id), a = (gapMode() ? v.g : v.c) || []; return a.length === 2 && a[0] > CASH + 1e-9 && a[1] <= CASH + 1e-9 && need <= CASH + 1e-9; };
  const HEART = (on) => `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.4 7.2 4.4c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
  const heartLbl = (r, on) => `${shortName(r.n)} ${on ? "관심 구역에서 빼기" : "관심 구역에 추가"}`;
  // 목록 카드 한 장(지도 알약을 눌렀을 때 뜨는 미리보기도 같은 카드): 1줄 이름 + 단계 칩 · 2줄 구·동 · 역 도보 N분 · 오른쪽 '지금 X' / '입주까지 Y' · ♡
  // 26차: 목록 줄 이름만 긴 사업 방식 말을 줄인다(상세·검색·/z 이름은 그대로) — '신길4구역 도심공공주택복합' → '신길4구역 도심복합'
  const listNm = (nm) => String(nm).replace(/도심공공주택복합(?:사업)?/g, "도심복합").replace(/신속통합기획/g, "신통기획").replace(/공공재개발/g, "공공").replace(/\s*주택정비형(?=\s|$)/g, "").replace(/\s{2,}/g, " ").trim();
  function cardHTML(r, o = {}) {
    const z = o.z || zstate(r), nowK = gapMode() || effBasis() !== "total";
    const main = nowK ? z.need : z.total, nm = shortName(r.n), fav = isFav(r.id), stg = stgShort(r), wk = walkTxt(r), tk = tkOf(r), nw = isNew(r, z.need);
    const tag = sortK === "eta" ? etaTag(r) : sortK === "gain" ? gainTag(r) : "";   // 초기 단계는 단계 칩이 말한다
    // 2줄: 동 · 역 N분(구는 뺀다 — 짧게, 이름이 먼저) · 동을 못 찾으면 구
    // 동은 좁으면 먼저 줄어들고(…) 역·분은 늘 다 보인다
    const sub = `<span class="s-dg${wk ? " s-dgw" : ""}">${esc(dongOf(r) || r.g)}${wk ? " ·\u00a0" : tag}</span>${wk ? `<span class="s-wk">${(() => { const m = /^(.*?)(역 \d+분)$/.exec(wk); return m ? `<span class="s-wn">${esc(m[1])}</span><span class="s-wm">${esc(m[2])}${tag}</span>` : esc(wk) + tag; })()}</span>` : ""}`;   // 23차: 좁으면 역 이름만 줄고(…) '역 N분'은 늘 다 보인다
    // 입주권 ✓는 화면 읽기 이름에만(카드 2줄을 동·역에 양보) · ✕만 주황 배지
    const bdg = `${tk === "n" ? '<em class="s-b s-b-no">입주권 ✕</em>' : ""}${nw ? '<em class="s-b s-b-new">NEW</em>' : ""}`;
    const mt = main != null ? eokS(main) : "–";
    // 27차: 좁은 폰(≤420)은 '현금 '을 숨겨 오른쪽 칸을 줄인다(글은 그대로 · 화면 읽기는 aria-label) — 2줄 역 이름이 잘리던 것
    const line2 = nowK ? (z.total != null ? `입주까지 현금 <b>${eokS(z.total)}</b>` : `입주까지 <span class="s-nah">현금 </span>계산 보류<i class="s-nai" aria-hidden="true">i</i>`) : `계약 ${eokS(z.need)}`;
    // 17차: 가능한 곳은 '남는 돈 1,000만'(12/600 회색) · 내 돈의 10% 안으로 딱 맞으면 '딱 맞아요' 작은 꼬리표
    const needR = z.need != null ? Math.ceil(z.need * 100 - 1e-6) / 100 : null, left = z.st === "ok" && nowK && needR != null ? Math.max(0, Math.round((CASH - needR) * 100) / 100) : null;
    const fit = left != null && left <= CASH * 0.1 + 1e-9;
    const fitH = left == null ? "" : fit ? '<em class="s-fit">예산 거의 다 씀</em>' : left >= 0.01 ? `<span class="s-left">예산에서 남는 돈 ${esc(eokS(left))}</span>` : "";
    const word = ST_WORD[z.st], gapT = z.st === "near" && z.need != null ? `, ${shortTxt(z.need).slice(1)} 더 필요` : "";
    const lab = `${nm}, ${nowK ? "지금 필요한 돈" : LBL.cashToMoveIn} ${mt}, ${word}${gapT}${z.total != null && nowK ? `, ${LBL.cashToMoveIn} ${eokS(z.total)}` : ""}, ${stg}${tk === "n" ? ", 입주권 안 나옴" : tk === "y" ? ", 입주권 나옴" : ""}${nw ? ", 이번 주 새로 가능" : ""}${left == null ? "" : fit ? ", 예산 거의 다 씀" : left >= 0.01 ? `, 예산에서 남는 돈 ${eokS(left)}` : ""}`;
    // 지도 고른 카드(#lmPick): 두 칸 — 왼쪽 이름 한 줄 · 배지 · 남는 돈 / 오른쪽 '지금 X' 위 '입주까지 현금 Y' · 끝에 ›
    if (o.peek) return `<li class="s-card s-peek st-${z.st}${fav ? " fav" : ""}" data-zid="${r.id}"><a href="#${r.id}" data-id="${r.id}" data-zid="${r.id}" class="pk-a" aria-label="${esc(lab)} · 눌러서 자세히"><span class="pk-l"><b class="pk-n">${esc(nm)}</b><span class="pk-b"><em class="s-b s-stg">${esc(stg)}</em>${bdg}${fit ? '<em class="s-fit">예산 거의 다 씀</em>' : ""}</span>${!fit && left != null && left >= 0.01 ? `<small class="pk-left">예산에서 남는 돈 ${esc(eokS(left))}</small>` : z.st === "near" && z.need != null ? `<small class="pk-left">${esc(shortTxt(z.need))} 더 필요</small>` : ""}</span><span class="pk-r"><span class="pk-v"><i>${nowK ? "지금" : "입주까지"}</i> <b>${mt}</b></span>${nowK ? `<small>${z.total != null ? `입주까지 현금 <b>${eokS(z.total)}</b>` : NA_L}</small>` : ""}</span><span class="pk-go" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></span></a></li>`;
    return `<li class="s-card st-${z.st}${fav ? " fav" : ""}${o.cls ? " " + o.cls : ""}" data-zid="${r.id}"${left != null ? ` data-need="${needR}"` : ""}><a href="#${r.id}" data-id="${r.id}" class="s-cm" aria-label="${esc(lab)}"><span class="s-nm"><b title="${esc(nm)}">${esc(listNm(nm))}</b></span><span class="s-l2"><span class="s-mt"><em class="s-b s-stg">${esc(stg)}</em>${bdg}<small class="s-sub">${sub}</small></span><span class="s-fx">${fitH}</span></span></a><button type="button" class="s-amt" data-why="${r.id}" aria-label="${esc(nm)} ${nowK ? "지금 필요한 돈" : LBL.cashToMoveIn} 추정 ${mt}${z.total == null ? ` · ${NA_L}: ${NA_WHY}` : ` · ${LBL.cashToMoveIn} ${eokS(z.total)}`} · 왜 이 금액인지 보기" aria-haspopup="dialog"><span class="s-av"><i class="s-al" aria-hidden="true">${nowK ? "지금" : "입주까지"}</i><b>${mt}</b></span><small${z.total == null && nowK ? ' class="s-na"' : ""}>${z.st === "near" ? `<span class="s-gapt">${shortTxt(z.need)} 더 필요</span>` : line2}</small></button><button type="button" class="s-heart" data-heart="${r.id}" aria-pressed="${fav}" aria-label="${esc(heartLbl(r, fav))}">${HEART(fav)}</button></li>`;
  }
  // ♡ 누르면 관심 구역(핀과 같은 toggleFav → 되돌리기 토스트·관심 탭·지도 하트 모두 같은 길)
  function heartSync() {
    $$("[data-heart]").forEach((b) => { const id = b.dataset.heart, r = byId[id], on = isFav(id); if (b.getAttribute("aria-pressed") === String(on)) return; b.setAttribute("aria-pressed", String(on)); if (r) b.setAttribute("aria-label", heartLbl(r, on)); b.innerHTML = HEART(on); const li = b.closest(".s-card"); if (li) li.classList.toggle("fav", on); });
  }
  document.addEventListener("click", (e) => {
    const h = e.target.closest && e.target.closest("[data-heart]"); if (!h) return;
    e.preventDefault(); e.stopPropagation();
    const id = h.dataset.heart; if (!byId[id]) return;
    if (!isFav(id) && !PINS.room(id)) return;
    toggleFav(id);
    try { PINS.feedback(h, id, isFav(id)); } catch (er) {}
    heartSync();
  }, true);
  addEventListener("pins:change", () => heartSync());
  // 구별 곳 수 한 번에(rows()에서 구를 고른 것과 같은 거르기: okR · 참고값 제외 · 유형 칩) — 지도 구 묶음 숫자
  const guCounts = () => { const o = {}; R.forEach((r) => { if (okR(r) && !r.lc && (!kind || KIND(r) === kind)) o[r.g] = (o[r.g] || 0) + 1; }); return o; };
  // 21차: 구 묶음 둘째 줄 '7,400만~' = 그 구의 갈 수 있는 곳 중 지금 필요한 돈이 가장 적은 값(구 묶음 숫자와 같은 거르기)
  const guMins = () => { const o = {}; R.forEach((r) => { if (!okR(r) || r.lc || (kind && KIND(r) !== kind)) return; let v = null; try { v = needOf(r).now; } catch (e) {} if (v != null && isFinite(v) && (o[r.g] == null || v < o[r.g])) o[r.g] = v; }); return o; };
  // 구 묶음(지도 줌 11 이하) 숫자 = 그 구를 고르면 보이는 목록 곳 수(같은 rows 거르기)
  const guCount = (g) => { const save = gu; try { gu = g; return rows().length; } finally { gu = save; } };
  // 지도 알약을 누르면: 목록의 그 카드로(PC는 목록 칸 안에서 스크롤, 폰은 카드만 표시 — 지도가 화면 밖으로 밀리지 않게)
  let pickId = null;
  function pick(id, scroll) {
    pickId = id || null;
    $$("#sList .s-card.sel").forEach((x) => x.classList.remove("sel"));
    if (!id) return false;
    let li = $("sList").querySelector(`.s-card[data-zid="${CSS.escape(id)}"]`);
    if (!li) { const L = rows(), i = L.findIndex((x) => x.r.id === id); if (i >= shown) { shown = i + 1; render(); li = $("sList").querySelector(`.s-card[data-zid="${CSS.escape(id)}"]`); } }
    if (!li) return false;
    li.classList.add("sel");
    // PC 목록은 칸 안에서 스크롤 → 그 칸 안에서 카드가 보이게(가장 가까운 자리)
    if (scroll) try { li.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" }); } catch (e) {}
    return true;
  }
  // 아래 탭바(4개: 찾기·관심·소식·MY): 지금 보는 화면에서 탭을 정한다(인자는 예전 호출과 맞추려고 받기만 함)
  // 기능 화면이 열려 있으면 그 화면의 탭(관심 구역 = 관심 · 소식 = 소식 · 나머지 도구·가이드 = MY) · 아니면(첫 화면·전체 지도·검색) 찾기
  const TAB_IDS = ["favTop", "news", "my"];
  const TAB_OF = (id) => (id === "favTop" ? "fav" : id === "news" ? "news" : id ? "my" : "home");
  function navMark() {
    const k = document.documentElement.classList.contains("s-view") ? TAB_OF(cur) : "home";
    document.querySelectorAll("#sNav [data-nav]").forEach((x) => { if (x.dataset.nav === k) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); });
  }
  // 폰: 하단 '지도'를 누르면 지도를 화면 가득(호갱노노처럼). 게이지는 위 작은 막대로.
  // 주소 #map = 전체 지도(뒤로가기로 닫힘, /#map 링크로 바로 열림). 지도 탭에 불이 들어온다
  function fullMap(on) {
    const h = document.documentElement;
    if (on == null) on = !h.classList.contains("s-full");
    if (on === h.classList.contains("s-full")) { if (on) navMark("map"); return; }
    h.classList.toggle("s-full", on);
    const m = $("sMini"); if (m) m.hidden = !on && m.hidden;
    if (on && m) m.hidden = false;
    navMark(on ? "map" : "home");
    setTimeout(() => window.dispatchEvent(new Event("resize")), 30);
    [60, 300, 800].forEach((t) => setTimeout(() => { try { LMX.fit(); } catch (e) {} }, t));
    try {
      const base = location.pathname + location.search;
      // /#map 으로 바로 들어온 경우(root)는 뒤로 갈 곳이 사이트 밖이라 주소만 지운다
      if (on && !(history.state && history.state.sFull)) { if (location.hash === "#map") history.replaceState({ sFull: 1, root: 1 }, "", base + "#map"); else history.pushState({ sFull: 1 }, "", base + "#map"); }
      else if (!on && history.state && history.state.sFull) { if (history.state.root) history.replaceState(null, "", base); else history.back(); }
      else if (!on && location.hash === "#map") history.replaceState(null, "", base);
    } catch (e) {}
  }
  // ---------- 화면 만들기 ----------
  function build() {
    document.documentElement.classList.add("simple", "s-built");
    try { hdrH = 0; } catch (e) {}   // 탭바를 숨겼으니 머리 높이를 다시 잰다
    const map = $("mapTop");
    // shell.html에 뼈대(게이지·목록·오른쪽 칸)가 이미 있으면 그대로 이어 쓴다 — 첫 페인트와 같은 높이라 화면이 밀리지 않는다
    let hero = $("sHero"), list = $("sListW"), right = $("sRight");
    const main = map.querySelector(".main");
    if (!list) {
      list = document.createElement("div");
      list.className = "s-list-w"; list.id = "sListW";
      list.innerHTML = `<div class="s-lh"><div><h2 id="sLT">갈 수 있는 곳</h2><p class="s-lsub"><span id="sLS"></span><button type="button" class="s-sortb" id="sSortB" aria-haspopup="dialog" aria-expanded="false"><span class="sr-only">정렬: </span><span id="sSortT">맞춤순</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></p></div><div class="s-flt" role="group" aria-label="유형"><button type="button" data-k="" aria-pressed="true">전체</button><button type="button" data-k="redev" aria-pressed="false">재개발</button><button type="button" data-k="rebuild" aria-pressed="false">재건축</button><button type="button" data-k="small" aria-pressed="false">가로·소규모</button></div></div>
      <p class="s-gu" id="sGu" hidden></p><ol class="s-list" id="sList"></ol><button type="button" class="btn secondary s-more" id="sMore" hidden></button>`;
    }
    if (!right) {
      right = document.createElement("div");
      right.className = "s-right"; right.id = "sRight";
      right.innerHTML = `<button type="button" class="s-tolist" id="sToList">← 갈 수 있는 곳 목록</button>`;
      main.appendChild(right); right.appendChild($("report"));
    }
    // 예산 카드(#sGauge): PC는 왼쪽 목록 칸 맨 위, 폰은 검색 밑(지도 바로 위) — shell.html 첫 페인트 스크립트와 같은 규칙
    const gg = $("sGauge");
    const place = () => {
      // PC: 왼쪽 칸(예산 카드·목록)이 문서 순서로도 지도보다 먼저(Tab이 예산 카드 → 목록 → 지도 버튼 순)
      // 빠른 메뉴 한 줄(#sQuick, 21차): 폰은 지도 밑·목록 머리 위, PC는 왼쪽 칸 맨 아래(목록 밑)
      const qk = $("sQuick");
      if (matchMedia("(min-width:981px)").matches) { if (list.nextElementSibling !== $("report")) right.insertBefore(list, $("report")); const ob = $("onb"); if (ob && ob.parentNode !== list) list.insertBefore(ob, list.firstElementChild); if (gg && (ob ? ob.nextElementSibling : list.firstElementChild) !== gg) { if (ob) ob.after(gg); else list.insertBefore(gg, list.firstElementChild); } if (main.firstElementChild !== right) main.insertBefore(right, main.firstElementChild); const sd = $("sRd"), sh = $("sSite"); if (sh) { if (list.firstElementChild !== sh) list.insertBefore(sh, list.firstElementChild); if (sd && sh.nextElementSibling !== sd) sh.after(sd); } else if (sd && list.firstElementChild !== sd) list.insertBefore(sd, list.firstElementChild); const rd = $("sReads"), ft = document.querySelector("body > .site-foot, #sListW > .site-foot"); if (rd && rd.nextElementSibling !== ft && list.lastElementChild !== rd) list.appendChild(rd); if (qk && qk.nextElementSibling !== rd) list.insertBefore(qk, rd || null); ftPlace(); }
      else { if (main.lastElementChild !== right) main.appendChild(right); if (main.nextElementSibling !== list) main.after(list); const sen = map.querySelector(":scope > .s-sen"); if (gg && sen && sen.nextElementSibling !== gg) sen.after(gg); const ob = $("onb"); if (ob && ob.parentNode !== map && sen) sen.before(ob); const sd = $("sRd"), ss = $("sSearch"), sh = $("sSite"); if (sh && ss && sh.nextElementSibling !== ss) ss.before(sh); if (sd && ss && ss.nextElementSibling !== sd) ss.after(sd); ftPlace(); const lh = list.querySelector(":scope > .s-lh"); if (qk && lh && lh.previousElementSibling !== qk) lh.before(qk); }
    };
    // 26차: PC 첫 화면(목록 칸이 보일 때)은 웹 푸터를 목록 칸 맨 아래로(붙은 지도가 끝까지) · 도구 화면·폰은 본래 자리(본문 아래)
    function ftPlace() { const ft = document.querySelector(".site-foot"); if (!ft) return; const ab = document.querySelector('.ad-slot[data-slot="bottom"]'); if (matchMedia("(min-width:981px)").matches && !document.documentElement.classList.contains("s-view") && getComputedStyle(list).display !== "none") { if (list.lastElementChild !== ft) list.appendChild(ft); } else if (ab && ab.nextElementSibling !== ft) ab.after(ft); }
    try { new MutationObserver(ftPlace).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    place(); matchMedia("(min-width:981px)").addEventListener("change", place);
    // 상세 위 '← 목록' 단추는 하나: 구 화면에서 열었으면 '← 강북구 · 갈 수 있는 곳 6곳'(같은 목록으로) · 구 화면 기록 칸이면 뒤로 가기와 같은 길
    $("sToList").onclick = () => { const hs = history.state || {}; if (hs.det && hs.gu) { try { history.back(); return; } catch (e) {} } document.documentElement.classList.remove("s-rep"); };
    window.ZP_toListLbl = () => { const b = $("sToList"); if (!b) return; const m = /^(.+?) · ([\d,]+)곳$/.exec(($("sLT") && $("sLT").textContent) || ""); const t = mapView === "gu" && mapGu && m && m[1] === mapGu ? `← ${mapGu} · 갈 수 있는 곳 ${m[2]}곳` : "← 갈 수 있는 곳 목록"; if (b.textContent !== t) b.textContent = t; };
    // 스크롤해 지도를 볼 때 게이지가 머리 아래에 작게 붙어 있도록(움직이면 지도가 바로 바뀌는 걸 보며 조절)
    const g = map.querySelector(".s-gauge");
    // 넓은 PC: 게이지 오른쪽 칸 '이 돈이면'(가장 싼 3곳 · 입주까지 현금 범위). 폭이 좁으면 CSS로 숨김
    let sum = $("sSum"); if (!sum) { sum = document.createElement("div"); sum.className = "s-sum"; sum.id = "sSum"; g.appendChild(sum); }
    sum.addEventListener("click", (e) => {
      const u = e.target.closest("[data-up]"); if (u) { setCash(+u.dataset.up, true); return; }
      if (e.target.closest("[data-more]")) { const l = $("sListW"); if (l) window.scrollTo({ top: Math.max(0, l.getBoundingClientRect().top + scrollY - HDR() - 74), behavior: reduceMotion() ? "auto" : "smooth" }); const f = $("sList").querySelector("[data-id]"); if (f) f.focus({ preventScroll: true }); return; }
      const a = e.target.closest("[data-id]"); if (!a) return; curTab = "money"; keepY = scrollY; select(a.dataset.id, false, false, { scroll: !MQ_SHEET.matches });
    });
    if (g.parentNode === hero) { const sen = document.createElement("i"); hero.after(g); sen.className = "s-sen"; g.before(sen); }
    document.documentElement.style.setProperty("--hdr-h", (HDR() || 60) + "px");
    // 머리 높이가 바뀌면(화면 회전·검색 열기) 붙는 막대 위치도 같이
    try { new ResizeObserver(() => { const h = $("hdr").offsetHeight; if (h) { try { hdrH = h; } catch (e) {} document.documentElement.style.setProperty("--hdr-h", h + "px"); } }).observe($("hdr")); } catch (e) {}
    // 큰 게이지가 화면 위로 지나가면, 지도·목록을 보는 동안만 머리 아래에 한 줄짜리 게이지를 띄운다(흐름 높이는 그대로)
    // 랜드마크 밖에 떠 있는 막대라 aside로(화면 읽기 '영역' 목록에 '내 돈 요약')
    const mini = document.createElement("aside");
    mini.className = "s-mini"; mini.id = "sMini"; mini.hidden = true; mini.setAttribute("aria-label", "내 돈 요약");
    mini.innerHTML = `<b id="sMiniV">1억</b><input type="range" id="sMiniR" min="0" max="100" step="0.1" value="8.33" aria-label="내 돈(억)"><span><i id="sMiniM">전세</i> <b id="sMiniN">0</b>곳</span><div class="s-mode s-mm" role="group" aria-label="사는 방식"><button type="button" data-f="gap">전세 끼고</button><button type="button" data-f="cash">대출 끼고</button></div>`;
    document.body.appendChild(mini);
    // 전체 지도 위 막대에서도 전세 끼고/대출 끼고 전환(본 버튼을 대신 누른다 → 상태·목록·지도 모두 같은 길)
    mini.querySelector(".s-mm").addEventListener("click", (e) => { const b = e.target.closest("button[data-f]"); if (!b) return; const o = map.querySelector(`.s-mode button[data-f="${b.dataset.f}"]`); if (o) o.click(); });
    const mr = mini.querySelector("#sMiniR");
    mr.addEventListener("input", () => { const v = toCash(+mr.value); if (dragging && rangeEl === mr) { mr.style.setProperty("--p", mr.value + "%"); dragTo(v); return; } $("sCash").value = mr.value; label(v); live(v); });
    mr.addEventListener("pointerdown", () => { dragging = true; rangeEl = mr; dragN0 = null; try { histData(); } catch (e) {} }, { passive: true });
    mr.addEventListener("change", () => { clearTimeout(timer); clearTimeout(idleT); if (snapFn || dragging) return; setCash(toCash(+mr.value), true); });
    let gaugeOut = false, areaIn = true;
    const sync = () => { if (document.documentElement.classList.contains("s-full")) { mini.hidden = false; return; } mini.hidden = !(gaugeOut && areaIn && !document.documentElement.classList.contains("s-view")) || !matchMedia("(max-width:980px)").matches; };
    if (window.IntersectionObserver) {
      new IntersectionObserver((es) => es.forEach((x) => { gaugeOut = !x.isIntersecting && x.boundingClientRect.top < (x.rootBounds ? x.rootBounds.top : 0) + 1; sync(); }), { rootMargin: `-${(HDR() || 56)}px 0px 0px 0px` }).observe(g);
      new IntersectionObserver((es) => es.forEach((x) => { areaIn = x.isIntersecting; sync(); }), { rootMargin: `-${(HDR() || 56) + 60}px 0px -40% 0px` }).observe(list);
      new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { areaIn = true; sync(); } }), { rootMargin: `-${(HDR() || 56) + 60}px 0px 0px 0px` }).observe(map.querySelector(".main"));
    }
    { const ss = hero.querySelector('#sSearch'), sh = $("sSite"); if (sh && sh.parentNode === hero) { if (sh.nextElementSibling !== ss) sh.after(ss); } else if (hero.firstElementChild !== ss) hero.insertBefore(ss, hero.firstChild); }  // 29차: h1(폰) → 검색 → 읽을거리 = 첫 페인트 순서 그대로
    // 모바일 아래 탭바(앱처럼)
    // shell.html이 첫 페인트부터 같은 탭바를 깔아 둔다(섬 단계에서 자리가 비지 않게) → 있으면 그것을 이어 쓴다
    const nav = $("sNav") || document.createElement("nav");
    nav.className = "s-nav"; nav.id = "sNav"; nav.setAttribute("aria-label", "주요 메뉴");
    nav.innerHTML = [["home", "찾기", "M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"], ["fav", "관심", "M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.4 7.2 4.4c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z"], ["news", "소식", "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4zM10 20.5a2.2 2.2 0 0 0 4 0"], ["my", "MY", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0"]]
      .map(([k, t, d]) => `<button type="button" data-nav="${k}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg><span>${t}</span></button>`).join("");
    if (!nav.isConnected) document.body.appendChild(nav);
    // 넓은 화면: 탭 4개를 머리 오른쪽(.hdr-r)에 · 폰: 화면 아래(body 끝). 머리는 backdrop-filter라 fixed 자식을 품지 못해 자리를 옮긴다
    const navPlace = () => { const r = document.querySelector("#hdr .hdr-r"); if (matchMedia("(min-width:981px)").matches) { if (r && nav.parentNode !== r) r.insertBefore(nav, r.querySelector(".nav-ph")); } else if (nav.parentNode !== document.body) document.body.appendChild(nav); };
    navPlace(); matchMedia("(min-width:981px)").addEventListener("change", navPlace);
    const fx = document.createElement("button");
    fx.type = "button"; fx.className = "s-fullx"; fx.id = "sFullX"; fx.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>목록 보기`;
    // 목록 머리(유형 칩)가 위에 붙는 한 줄 게이지에 가리지 않게 그 높이만큼 더 띄운다. 뒤로가기 스크롤 복원 뒤에도 한 번 더
    const toList = () => { const l = $("sListW"); if (l) window.scrollTo({ top: l.getBoundingClientRect().top + scrollY - HDR() - 8 - (matchMedia("(max-width:980px)").matches ? 66 : 0), behavior: "auto" }); };
    fx.onclick = () => {
      // 구 단위보다 확대해 둔 지도(줌 12.5 이상)면 목록도 그 화면 안 구역만. 서울 전체 줌이면 거르지 않는다
      bbF = bbGet();
      shown = SHOW0(); render();
      fullMap(false); requestAnimationFrame(toList); setTimeout(toList, 120); };
    document.body.appendChild(fx);
    navMark();
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("[data-nav]"); if (!b) return;
      const k = b.dataset.nav, wasFull = document.documentElement.classList.contains("s-full");
      // 찾기 = 첫 화면(지도·목록·검색) 맨 위로: 열린 시트·도구·전체 지도를 닫는다(로고와 같은 길)
      if (k === "home") { if (typeof ZP_home === "function") ZP_home(); else { fullMap(false); close(); window.scrollTo({ top: 0, behavior: "auto" }); } navMark(); return; }
      const id = k === "fav" ? "favTop" : k;   // 관심 → #favTop · 소식 → #news · MY → #my
      // 전체 지도에서 누르면 지도를 닫는 뒤로 가기(popstate)가 끝난 뒤에 연다(먼저 열면 popstate가 홈으로 되돌렸다) · 열린 시트는 닫고 · 주소는 늘 #화면
      const go = () => { try { if ($("report").classList.contains("sheet")) closeSheetNow(); } catch (er) {} document.documentElement.classList.remove("s-rep"); if (cur === id) { const s = $(id); if (s) window.scrollTo({ top: s.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); } else open(id); if (location.hash !== "#" + id) try { history.replaceState(history.state, "", location.pathname + location.search + "#" + id); } catch (er) {} navMark(); };
      // 전체 지도를 바로 연 주소(#map, root)면 닫을 때 뒤로 가기가 없으니 바로 연다
      const willPop = wasFull && !!(history.state && history.state.sFull && !history.state.root);
      if (wasFull && !willPop) { fullMap(false); go(); }
      else if (wasFull) { fullMap(false); let done = false; const g2 = () => { if (done) return; done = true; removeEventListener("popstate", pop); go(); }; const pop = () => setTimeout(g2, 30); addEventListener("popstate", pop); setTimeout(g2, 450); }
      else go();
    });
    $("sSearch").onclick = search;
    // 아래 탭 '검색': 검색이 열려 있는 동안만 켜 두고, 닫히면 보던 화면(전체 지도·홈) 탭으로
    try { let was = false; new MutationObserver(() => { const on = $("hdr").classList.contains("searching"); if (on === was) return; was = on; if (on) navMark("search"); else if (nav.querySelector('[data-nav="search"][aria-current]')) navMark(document.documentElement.classList.contains("s-full") ? "map" : "home"); }).observe($("hdr"), { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    // 각 기능 화면 위에 '지도로' 버튼
    IDS.forEach((id) => {
      if (TAB_IDS.includes(id)) return;   // 관심·소식·MY는 아래 탭이 길잡이 → 돌아가기 없음
      const s = $(id); if (!s || s.querySelector(".s-back")) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "s-back"; b.innerHTML = "← 돌아가기";
      b.onclick = () => close(true);
      s.insertBefore(b, s.firstChild);
    });
    // 이벤트
    const sl = $("sCash");
    // 손가락으로 끄는 중: 채움(--p)은 손잡이를 그대로 따라가고(원래 값), 숫자는 다음 프레임 · 키보드·프로그램 입력은 예전 길(live)
    sl.addEventListener("input", () => { const v = toCash(+sl.value); if (dragging && rangeEl === sl) { sl.style.setProperty("--p", sl.value + "%"); dragTo(v); } else { label(v); live(v); } });
    sl.addEventListener("pointerdown", () => { dragging = true; rangeEl = sl; dragN0 = null; try { histData(); } catch (e) {} }, { passive: true });
    // 키보드: 2억 아래는 0.1억, 5억 아래는 0.25억, 그 위는 0.5억씩
    const key = (e) => {
      const c = +$("pCash").value || 1, st = c < 2 ? 0.1 : c < 5 ? 0.25 : 0.5;
      const nx = { ArrowRight: c + st, ArrowUp: c + st, ArrowLeft: c - st, ArrowDown: c - st, PageUp: c + 1, PageDown: c - 1, Home: 0.5, End: 15 }[e.key];
      if (nx == null) return;
      e.preventDefault();
      const v = Math.min(15, Math.max(0.5, Math.round(nx * 100) / 100));
      keyCash(v);
    };
    sl.addEventListener("keydown", key);
    $("sMiniR") && $("sMiniR").addEventListener("keydown", key);
    // 놓으면: 숫자 마지막 프레임 → 손잡이를 금액 자리로 살짝 → 전체 계산(목록·지도) 한 번
    const up = () => { if (!dragging || !rangeEl) return; const el = rangeEl; dragging = false; rangeEl = null; dragEnd(); clearTimeout(idleT); rangeSnap(el, () => setCash(toCash(+el.value), true)); };
    window.addEventListener("pointerup", up, { passive: true }); window.addEventListener("pointercancel", up, { passive: true });
    sl.addEventListener("change", () => { clearTimeout(timer); clearTimeout(idleT); if (snapFn || dragging) { if (dragging && rangeEl === sl) up(); return; } setCash(toCash(+sl.value), true); });
    map.querySelector(".s-mode").addEventListener("click", (e) => { const b = e.target.closest("button[data-f]"); if (!b) return; if (b.dataset.f === "cash") { P.basis = "now"; try { setSeg("pBasis", "now"); } catch (er) {} } setFund(b.dataset.f); setTimeout(() => { try { LMX.fitAff(true); } catch (er) {} }, 60); });
    list.querySelector(".s-flt").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      kind = b.dataset.k; shown = SHOW0();
      $$(".s-flt button", list).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
      try { window.dispatchEvent(new CustomEvent("zp:filter", { detail: { kind } })); } catch (er) {}   // 지도(10_lmap.js)도 같은 유형만
    });
    $("sMore").onclick = () => { shown += STEP; render(); const f = $("sList").children[shown - STEP]; const a = f && f.querySelector("[data-id]"); if (a) a.focus({ preventScroll: true }); };
    moreIO();
    sortInit();
    scrubInit();
    $("sAsm").onclick = (e) => asm(e.currentTarget);
    $("sList").addEventListener("click", (e) => {
      const w = e.target.closest("[data-why]"); if (w) { e.preventDefault(); e.stopPropagation(); why(w.dataset.why, w); return; }
      const a = e.target.closest("[data-id]"); if (!a) return;
      e.preventDefault(); curTab = "money"; keepY = scrollY; select(a.dataset.id, false, false, { scroll: !MQ_SHEET.matches });
    });
  }
  // 상세 '입주 현금' 탭: 맨 위엔 지금·이주·입주 숫자만, 나머지(가정·근거·숫자 바꿔 보기)는 접어 둔다
  function foldMoney(r) {
    const p = $("pane"); if (!p || p.querySelector(".s-fold")) return;
    const g = p.querySelector(".gpane");
    const keep = g || p.querySelector(".bigrow") || p.firstElementChild;
    if (!keep) return;
    const d = document.createElement("details"); d.className = "s-fold";
    d.innerHTML = `<summary>계산 근거 · 숫자 바꿔 보기</summary>`;
    if (g) g.querySelectorAll(":scope > .t-note, :scope > .gap-honest, :scope > .gj-f").forEach((el) => d.appendChild(el));
    [...p.children].filter((el) => el !== keep && el !== d).forEach((el) => d.appendChild(el));
    keep.after(d);
    const x = investC(r);
    const tot = d.querySelector(".bigrow .big:first-child small");
    if (tot && x && x.loanEnd > 0.05) tot.insertAdjacentHTML("beforeend", ` · 분담금은 입주 때 잔금대출 ${eokS(x.loanEnd)}을 받는다고 보고 뺀 금액`);
  }
  function search() {
    const b = $("sOpen");
    const box = $("searchBox");
    if (b && box && getComputedStyle(box).display === "none") b.click();   // 폰: 헤더 검색 아이콘을 숨겨도 같은 전체 화면 검색을 연다
    else { window.scrollTo({ top: 0, behavior: "smooth" }); $("q").focus(); }
  }
  // 금액 글자: ZF.cash와 같은 꼴(1억 아래는 '5,000만', 1억부터 '1.5억', 15억 넘으면 '15억+') — 카드 '내 돈 1억 ▾'·한 줄 막대·예산 시트가 같은 글
  const cashTxt = (v, real) => (real != null && real > 15 ? "15억+" : ZF.cash(real != null ? Math.round(real * 100) / 100 : v));
  const cashHTML = (t) => { const m = t.match(/^([\d,.]+)(만|억\+?)$/) || [, t, ""]; return `${m[1]}<small>${m[2]}</small>`; };
  let labT = "";
  function label(v, real) {
    const t = cashTxt(v, real), pct = toPos(v), rg = dragging && rangeEl;   // 손가락으로 끄는 기본 막대(range)는 손잡이·채움을 손가락이 정한다(21차: 단계 자리로 튀지 않게)
    if (t !== labT) { labT = t; $("sCashV").innerHTML = cashHTML(t); if ($("sMiniV")) $("sMiniV").textContent = t; if ($("sMiniR")) $("sMiniR").setAttribute("aria-valuetext", t); if ($("bCash")) $("bCash").innerHTML = cashHTML(t); }
    if ($("sMiniR") && rg !== $("sMiniR")) { if (Math.abs(+$("sMiniR").value - pct) > 0.6 || !dragging) $("sMiniR").value = pct; $("sMiniR").style.setProperty("--p", pct + "%"); }
    if (rg !== $("sCash")) { if (Math.abs(+$("sCash").value - pct) > 0.6) $("sCash").value = pct; $("sCash").style.setProperty("--p", pct + "%"); }
  }
  // 끄는 동안에도 지도·숫자가 따라오게(계산은 약 30ms라 프레임마다 한 번까지만)
  // 끄는 동안: 무거운 전체 계산 대신 '필요한 돈 ≤ 현금' 판정만 다시 해 숫자·목록·구별 말풍선을 매 프레임 갱신.
  // 손을 떼거나 잠깐 멈추면 전체 계산(지도 색·구 통계)을 한 번 돌린다.
  let liveT = 0, liveV = null, idleT = 0, dragging = false, liveNow = false, heavyT = 0;
  function live(v) {
    liveV = Math.round(v * 10) / 10;
    if (!liveT) liveT = requestAnimationFrame(() => {
      liveT = 0;
      try {
        $("pCash").value = String(liveV); CASH = liveV;
        liveNow = true; render();
      } catch (e) {} finally { liveNow = false; }
      // 끄는 동안엔 숫자·제목·이름 줄만 바로(가벼운 길) — 목록 줄·지도 알약은 손이 잠깐 멈추면(180ms) 한 번에(17차 성능: 끄는 중 숫자 ≤100ms)
      clearTimeout(heavyT); heavyT = setTimeout(() => { heavyT = 0; try { render(); } catch (e) {} }, 250);
    });
    clearTimeout(idleT); if (!dragging) idleT = setTimeout(() => setCash(liveV, true), 220);
  }
  // ---------- 21차: 손가락으로 끄는 동안(홈 막대 · 예산 시트 · 전체 지도 위 막대) ----------
  // 손잡이·채움·말풍선 = pointermove에서 바로(transform · 레이아웃 읽기 없음) · 금액 글자·큰 숫자 = 다음 프레임(rAF, 곳 수는 미리 센 금액별 막대 자료에서 바로)
  // 목록·지도·'이 돈이면' 칸 = 150ms 멈추거나 손을 뗄 때 한 번
  let dragV = null, dragRaf = 0, dragIdleT = 0, dragN0 = null, rangeEl = null, liteT = 0;
  const DRAG_IDLE = 150;
  const fastCount = (v) => { const k = condK(); if (!hist || histK !== k) histData(); const i = STOPS.indexOf(v); return i >= 0 && hist ? hist[i][1] : countAt(v); };
  function dragTo(v) {
    if (v === dragV) return;
    dragV = v;
    if (!dragRaf) dragRaf = requestAnimationFrame(dragFrame);
    clearTimeout(dragIdleT); dragIdleT = setTimeout(dragIdle, DRAG_IDLE);
  }
  function dragFrame() {
    dragRaf = 0;
    const v = dragV; if (v == null) return;
    $("pCash").value = String(v); CASH = v;
    label(v);
    const all = fastCount(v), vt = `${cashTxt(v)}, ${fmt(all)}곳`;
    if (dragN0 == null) dragN0 = all;
    $("sN").textContent = fmt(all); countTo($("sNB"), all);
    $("sCash").setAttribute("aria-valuetext", vt);
    SCRS.forEach((x) => { if (x.getAttribute("role") === "slider") { x.setAttribute("aria-valuenow", String(v)); x.setAttribute("aria-valuetext", vt); } });
    if ($("sMiniN") && !gu && !bbF && !kind) $("sMiniN").textContent = fmt(all);
    if (bsOpen()) { $("bN").textContent = fmt(all); countTo($("bNB"), all); $("bGo").textContent = all ? `${fmt(all)}곳 보기` : "지도에서 보기"; }
    // 23차: 끄는 동안에도 지도 구 묶음 숫자를 말풍선과 같은 값으로(표에서 · 100ms에 한 번) — 묶음 합이 말풍선보다 늦던 것(84 vs 97)
    // 26차: 말풍선과 같은 프레임에(예전엔 100ms에 한 번이라 끄는 중 구 묶음 합이 말풍선보다 늦었다: 89 vs 102) — 바뀐 묶음만 다시 쓰므로 가볍다
    liteT = performance.now(); try { LMX.dragLite(); } catch (e) {}
    if (scr) { const bub = scr.el.querySelector(".scr-bub"), d = all - scr.n0; if (bub) { const t = `${cashTxt(v)} · ${fmt(all)}곳${d ? ` (${d > 0 ? "+" : "−"}${fmt(Math.abs(d))})` : ""}`; if (bub.textContent !== t) bub.textContent = t; bub.hidden = false; } }
  }
  // 손이 150ms 멈추면: 목록·제목·'이 돈이면'·지도 구 묶음(가벼운 길) 한 번
  function dragIdle() {
    dragIdleT = 0;
    if (!dragging || dragV == null) return;
    try { render(); } catch (e) {}
    try { LMX.dragLite(); } catch (e) {}
  }
  function dragEnd() { clearTimeout(dragIdleT); dragIdleT = 0; if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; dragFrame(); } dragV = null; dragN0 = null; }
  // 기본 막대(range)를 놓으면: 손잡이를 가까운 금액 자리로 살짝(90ms) 옮긴 뒤 전체 계산 — 움직임 줄이기 설정이면 바로
  let snapRaf = 0, snapFn = null;
  function rangeSnap(el, fn) {
    snapFn = fn; cancelAnimationFrame(snapRaf);
    const to = toPos(toCash(+el.value)), from = +el.value, rd = reduceMotion() || Math.abs(to - from) < 0.05;
    const done = () => { snapRaf = 0; el.value = String(to); el.style.setProperty("--p", to + "%"); const f = snapFn; snapFn = null; if (f) setTimeout(f, 0); };
    if (rd) return done();
    const t0 = performance.now(), D = 90;
    const step = (t) => { const k = Math.min(1, (t - t0) / D), e = 1 - (1 - k) * (1 - k), x = from + (to - from) * e; el.value = String(x); el.style.setProperty("--p", x + "%"); if (k < 1) snapRaf = requestAnimationFrame(step); else done(); };
    snapRaf = requestAnimationFrame(step);
  }
  // 키보드로 막대를 움직일 때(20차 A3): 숫자·제목·슬라이더 글은 그 자리에서 바로(가벼운 길) — 목록·지도·계획 전체 계산은 키를 멈춘 뒤 0.4초에 한 번
  let keyT = 0, keyOn = false;
  function keyCash(v) {
    v = Math.min(15, Math.max(0.5, Math.round(v * 100) / 100));
    keyOn = true; clearTimeout(idleT); clearTimeout(keyT);
    label(v);
    try { $("pCash").value = String(v); CASH = v; liveNow = true; render(); } catch (e) {} finally { liveNow = false; }
    try { LMX.dragLite(); } catch (e) {}   // 지도(자리 그림 포함) 구 묶음·칩도 같은 순간에
    keyT = setTimeout(() => { keyOn = false; setCash(v, true); }, 400);
  }
  function setCash(v, force) {
    v = Math.round(v * 100) / 100;
    const el = $("pCash");
    if (+el.value === v && !force) return render();
    el.value = String(v);
    try { PREV_CASH = null; } catch (e) {}
    planN = PLAN0();
    plan();
    // 금액을 정하면 그 돈으로 되는 구역까지 지도가 따라 넓어진다
    // 26차 성능: 금액을 바꾼 뒤 지도 맞춤은 움직임 없이 한 번(0.7초 이동 동안 프레임마다 지도를 다시 그려 손을 뗀 뒤 긴 작업이 몰리던 것)
    try { LMX.fitAff(false); } catch (e) {}
    // 26차: 첫 방문 카드가 떠 있을 때 어떤 길로든 금액이 정해지면 카드 칩과 똑같이 닫고 저장(shell.html #onb)
    if (document.documentElement.classList.contains("onb-on")) try { window.dispatchEvent(new CustomEvent("zp:cashpick", { detail: v })); } catch (e) {}
  }
  // ---------- 구역 상세 '실거래' 칸의 최근 2년 시세 흐름(작은 선) — 목록 카드에서 상세로 옮김(리뉴얼 3단계) ----------
  // txs.json[id] = [["26Q2", 값], …] 최근 8분기(build.py가 tx.json에서 뽑은 경량본, ~100KB) — 처음 그린 뒤 한 번만 늦게 불러와 다시 그린다.
  // 큰 tx.json(1.8MB)은 구역 리포트·신고가 층을 열 때만 ZX.loadTx로 받는다.
  let TX = null, txAsk = false;
  const SP = new Map();
  const qIdx = (q) => { const m = /^(\d\d)Q([1-4])$/.exec(q || ""); return m ? +m[1] * 4 + +m[2] - 1 : null; };
  const Q_NOW = (() => { const d = new Date(); return (d.getFullYear() % 100) * 4 + Math.floor(d.getMonth() / 3); })();
  function spark(id) {
    if (!TX) return "";
    if (SP.has(id)) return SP.get(id);
    let out = "";
    try {
      const q = TX[id] || [];
      const pts = q.map((e) => [qIdx(e[0]), +e[1]]).filter((p) => p[0] != null && isFinite(p[1]) && p[1] > 0).sort((a, b) => a[0] - b[0]);
      const last = pts.length ? pts[pts.length - 1][0] : null;
      const P8 = last != null && last >= Q_NOW - 4 ? pts.filter((p) => p[0] > last - 8) : [];
      if (P8.length >= 3) {
        const W = 44, H = 16, pad = 2, x0 = last - 7;
        const vs = P8.map((p) => p[1]), lo = Math.min(...vs), hi = Math.max(...vs), rg = hi - lo || 1;
        const xy = P8.map(([i, v]) => [((i - x0) / 7) * (W - pad * 2) + pad, H - pad - ((v - lo) / rg) * (H - pad * 2)].map((n) => Math.round(n * 10) / 10));
        const [ex, ey] = xy[xy.length - 1];
        let chg = null;
        if (P8.length >= 6) { const b = P8.filter((p) => p[0] <= last - 4).pop(); if (b) chg = (P8[P8.length - 1][1] / b[1] - 1) * 100; }
        // 작은 선만 있으면 무엇인지 몰라('√'처럼 보임) 아래에 늘 이름표: '1년▲64%'(1년 바뀜) 또는 '시세'
        // 이름표는 모든 줄이 같은 꼴 '2년 시세'(1년 바뀜 %는 줄마다 꼴이 달라 보여 title·화면 읽기로만)
        const tr = `<i aria-hidden="true">2년 시세</i>`;
        const lab = `최근 2년 시세 흐름${chg != null && Math.abs(chg) >= 3 ? ` · 1년 ${chg > 0 ? "+" : "−"}${Math.round(Math.abs(chg))}%` : ""}`;
        out = `<span class="s-sp" role="img" aria-label="${lab}" title="${lab}"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${xy.map((p) => p.join(",")).join(" ")}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${ex}" cy="${ey}" r="1.9" fill="currentColor"/></svg>${tr}</span>`;
      }
    } catch (e) { out = ""; }
    SP.set(id, out);
    return out;
  }
  function askTx() {
    if (txAsk) return;
    txAsk = true;
    const v = (D.dv && (D.dv.txs || D.dv.tx)) || D.asOf;
    try { fetch(`data/txs.json?v=${v}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && typeof d === "object" && Object.keys(d).length) { TX = d; SP.clear(); repSpark(); } }).catch(() => {}); } catch (e) {}
  }
  // 상세가 그려질 때마다: 실거래 칸 큰 숫자 옆에 흐름선(자료는 처음 상세를 열 때 한 번 받는다)
  function repSpark() {
    const rp = $("report"), a = rp && rp.querySelector(".ov-tx .ov-big"), id = typeof window.__zpCur === "function" ? window.__zpCur() : null;
    if (!a || !id) return;
    if (!TX) { askTx(); return; }
    const old = a.querySelector(".s-sp"); if (old && old.dataset.id === id) return; if (old) old.remove();
    const h = spark(id); if (h) a.insertAdjacentHTML("beforeend", h.replace('class="s-sp"', `class="s-sp" data-id="${id}"`));
  }
  // ---------- '왜 이 금액?' 작은 설명(새 화면 없이) ----------
  let whyEl = null, whyFor = null, whyScr = null;
  function whyClose() { if (!whyEl || whyEl.hidden) return; whyEl.hidden = true; whyEl.style.transform = ""; if (whyScr) whyScr.hidden = true; const b = whyFor; whyFor = null; if (b && document.contains(b) && whyEl.contains(document.activeElement)) b.focus(); }
  function whyBox() {
    if (!whyEl) {
      whyEl = document.createElement("div"); whyEl.className = "s-why"; whyEl.id = "sWhy"; whyEl.hidden = true;
      whyEl.setAttribute("role", "dialog"); whyEl.setAttribute("aria-labelledby", "sWhyT");
      // 폰 아래 시트: 뒤를 어둡게 덮는 막(누르면 닫힘) + 손잡이를 아래로 끌어 닫기
      whyScr = document.createElement("div"); whyScr.className = "s-why-scr"; whyScr.hidden = true; whyScr.setAttribute("aria-hidden", "true");
      document.body.appendChild(whyScr); document.body.appendChild(whyEl);
      let y0 = null, dy = 0;
      whyEl.addEventListener("pointerdown", (e) => { if (!whyEl.classList.contains("bs") || !e.target.closest(".s-wgrab,.s-wh") || e.target.closest("button")) return; y0 = e.clientY; dy = 0; try { whyEl.setPointerCapture(e.pointerId); } catch (er) {} });
      whyEl.addEventListener("pointermove", (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); whyEl.style.transform = dy ? `translateY(${dy}px)` : ""; });
      const end = () => { if (y0 == null) return; y0 = null; if (dy > 60) whyClose(); else whyEl.style.transform = ""; };
      whyEl.addEventListener("pointerup", end); whyEl.addEventListener("pointercancel", end);
      whyEl.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) whyClose(); else if (e.target.closest("[data-open]")) { const v = e.target.closest("[data-open]").dataset.open; whyClose(); open(v); } else if (e.target.closest("[data-go]")) { const z = e.target.closest("[data-go]").dataset.go; whyClose(); curTab = "money"; keepY = scrollY; select(z, false, false, { scroll: !MQ_SHEET.matches }); } });
      document.addEventListener("pointerdown", (e) => { if (whyEl && !whyEl.hidden && !whyEl.contains(e.target) && !e.target.closest("[data-why],#sAsm")) whyClose(); }, true);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") whyClose(); });
      window.addEventListener("resize", whyClose);
    }
    return whyEl;
  }
  function whyShow(btn, html) {
    whyBox().innerHTML = html;
    whyFor = btn; whyEl.hidden = false;
    const sheet = matchMedia("(max-width:640px)").matches;
    whyEl.classList.toggle("bs", sheet); whyScr.hidden = !sheet; whyEl.style.transform = "";
    if (sheet) { whyEl.style.left = whyEl.style.top = ""; whyEl.insertAdjacentHTML("afterbegin", '<div class="s-wgrab" aria-hidden="true"></div>'); }
    else {
      const b = btn.getBoundingClientRect(), w = whyEl.offsetWidth, h = whyEl.offsetHeight;
      let top = b.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, b.top - h - 6);
      whyEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.right - w)) + "px"; whyEl.style.top = top + "px";
    }
    const xb = whyEl.querySelector("[data-x]"); if (xb) xb.focus({ preventScroll: true });
  }
  // 대출 끼고: 어떤 가정으로 대출을 잡았는지(작은 칩 → 설명)
  function asmText() {
    const inc = num("pIncome");
    return ltvBuy() ? `감정가 ${Math.round(ltvBuy() * 100)}%${inc != null && inc > 0 ? " · DSR 40%" : " 대출 가정"}` : "대출 없음 가정";
  }
  function asm(btn) {
    if (whyEl && !whyEl.hidden && whyFor === btn) return whyClose();
    const inc = num("pIncome"), rate = num("aRate") ?? 4.5;
    const li = (k, v) => `<li><span>${k}</span><b>${v}</b></li>`;
    whyShow(btn, `<div class="s-wh"><b id="sWhyT">대출 가정</b><span>지금 규제 기준 추정</span><button type="button" data-x aria-label="닫기">×</button></div><ul>${li("담보인정(LTV)", `${Math.round(ltvBuy() * 100)}%`)}${li("담보 기준", "아파트 시세 · 빌라 감정가")}${li("한도(집값 구간)", "15억↓ 6억 · 25억↓ 4억")}${li("DSR 40%", inc != null && inc > 0 ? `연소득 ${fmt(inc)}만` : "소득 넣으면 적용")}${li("금리", `${rate}% (+3%p 스트레스)`)}</ul><p>${P.homes === 0 ? (P.first ? "무주택 생애최초 기준" : "무주택 기준") : P.homes === 1 ? "1주택 기준" : "다주택은 대출 없음으로 계산"} · 실제 한도는 은행 심사로 달라져요</p><button type="button" class="s-wgo" data-open="planner">소득·조건 바꾸기 →</button>`);
  }
  // 대출이 무엇의 몇 %인지(계산 엔진 loanOn과 같은 순서: 담보 × LTV, 가격구간 한도, DSR 중 가장 작은 값)
  // 담보 = 아파트는 매수가, 빌라·주택은 감정가 추정 × 1.2(매수가 상한) — 그래서 매수가의 40%보다 적게 나올 수 있다
  function loanBasis(r, x, wS, M) {
    const lt = Math.round(ltvBuy() * 100);
    if (!x.loanCap) return x.land0 ? "멸실 뒤 토지 매수라 주담대 없음" : lt === 0 ? "규제지역 다주택은 LTV 0%" : "연소득 0이라 DSR상 대출 없음";
    const cx = ((r.mk || {}).entry || {}).src === "complex", coll = cx ? x.price : Math.min(x.price, x.appr * 1.2);
    const near = (a) => Math.abs(a - x.loanCap) < 0.005;
    if (near(coll * ltvBuy())) return coll < x.price - 0.005 ? `대출 = 감정가 추정 ${wS(M(x.appr))} × 1.2 × ${lt}% <small>· 빌라·주택은 매수가보다 낮은 감정가로 담보를 잡아요</small>` : `대출 = 매수가 × ${lt}%`;
    if (near(bandCap(x.price))) return `대출 = 집값 ${x.price <= 15 ? "15억 이하" : x.price <= 25 ? "25억 이하" : "25억 초과"} 한도 ${bandCap(x.price)}억`;
    return `대출 = 연소득 기준 DSR 40% 한도`;
  }
  function why(id, btn) {
    const r = byId[id]; if (!r) return;
    if (whyEl && !whyEl.hidden && whyFor === btn) return whyClose();
    whyBox();
    const gap = gapMode(), x = investC(r), est = !!(OV[r.id] && OV[r.id].est);
    // 만원 단위로 반올림해 세 줄을 보여 주고, 합계는 보이는 숫자 그대로 더해 눈으로 맞춰 볼 수 있게(1억 5,450만 − 8,740만 + 170만 = 6,880만)
    const M = (v) => Math.round((v || 0) * 1e4);
    const wS = (m) => { if (m <= 0) return "0원"; const e = Math.floor(m / 1e4), r = m % 1e4; return `${e ? `${fmt(e)}억` : ""}${e && r ? " " : ""}${r ? `${fmt(r)}만` : ""}`; };
    const ln = (op, k, m, c) => `<li${c ? ` class="${c}"` : ""}><span>${op ? `<i>${op}</i>` : ""}${k}</span><b>${wS(m)}</b></li>`;
    const sum3 = (a, b, c) => Math.max(0, M(a) - M(b) + M(c));
    // 28차: 합계는 정확한 만 원, 목록·지도·상세 큰 숫자는 올림 표시 — 둘이 다르면 한 줄로 밝힌다(3억 7,059만 → 3.8억)
    const rnd = (m) => { const t = eokS(m / 1e4); return m > 0 && t !== wS(m) ? `<li class="s-wbase s-wrnd">화면에는 ${t}으로 보여요 (표시는 ${m < 1e4 ? "100만" : "0.1억"} 단위 올림)</li>` : ""; };
    let rowsH = "", tail = "";
    // 매수가 바로 밑에 표본 한 줄(어떤 거래 몇 건의 가운데 값인지)
    const en = (r.mk || {}).entry || {}, ps = x.priceSrc;
    const src = ps === "user" && !est ? "직접 넣은 값" : esc(ZF.smpTxt(r, x));   // 리포트·/z/와 같은 표본 한 문장
    const srcL = src ? `<li class="s-wbase">${src}</li>` : "";
    if (gap) {
      const g = gapOf(r);
      if (g.na) rowsH = `<li class="s-wna">매수가 자료가 아직 없어요</li>`;
      else {
        rowsH = ln("", `매수가${est ? " <small>(추정)</small>" : ""}`, M(x.price)) + srcL + ln("−", `전세${g.userJ ? "" : ` <small>(${Math.round(g.jr)}%)</small>`}`, M(g.D)) + ln("+", "세금", M(x.tax)) + ln("=", "지금 필요한 돈", sum3(x.price, g.D, x.tax), "s-wsum") + rnd(sum3(x.price, g.D, x.tax));
        if (g.total != null) tail = `${LBL.cashToMoveIn} ${eokS(g.total)} · 이주비·분담금 포함, 잔금대출 제외`;
        else tail = `${LBL.cashToMoveIn}은 계산 못 함: 입주 시점·신축 시세 자료 부족`;
      }
    } else if (x.price == null) rowsH = `<li class="s-wna">매수가 자료가 아직 없어요</li>`;
    else {
      rowsH = ln("", `매수가${est ? " <small>(추정)</small>" : ""}`, M(x.price)) + srcL + ln("−", "대출", M(x.loanCap)) + `<li class="s-wbase">${loanBasis(r, x, wS, M)}</li>` + ln("+", "세금", M(x.tax)) + ln("=", "지금 필요한 돈", sum3(x.price, x.loanCap, x.tax), "s-wsum") + rnd(sum3(x.price, x.loanCap, x.tax));
      if (x.ok && x.needTotal != null) tail = `${LBL.cashToMoveIn} ${eokS(x.needTotal)} · 분담금·이자 포함, 잔금대출 제외`;
      else tail = `${LBL.cashToMoveIn}은 계산 못 함: 입주 시점·신축 시세 자료 부족`;
    }
    whyShow(btn, `<div class="s-wh"><b id="sWhyT">왜 이 금액?</b><span>${esc(shortName(r.n))}</span><button type="button" data-x aria-label="닫기">×</button></div><ul>${rowsH}</ul><p>${tail ? `${tail} · ` : ""}공개 자료로 낸 추정치예요</p><button type="button" class="s-wgo" data-go="${r.id}">계산 근거 자세히 →</button>`);
  }
  // ---------- 예산 카드 · 예산 시트(리뉴얼 2단계) ----------
  // 카드: '내 돈 1억 ▾ → 갈 수 있는 곳 9곳' + [전세 끼고 | 대출 끼고] (i). '1억 ▾'를 누르면 시트: 큰 숫자 · 프리셋 칩 · 금액별 막대 · 막대 아래 같은 게이지(#sCash) · '+0.5억이면 N곳 더' · [N곳 보기]
  // 곳 수는 모두 countAt(= ZP_count) 하나: 막대 높이도 그 금액에서의 countAt → 지금 금액 막대 == 카드 숫자 == 목록 제목
  // 숫자 카운트업: 글자(#sN)는 늘 최종 값, 보이는 숫자는 CSS 카운터(--n)가 굴러간다(61_budget.css)
  const countTo = (el, n) => { if (el && el.style.getPropertyValue("--n") !== String(n)) el.style.setProperty("--n", String(n)); };
  const STOPS = (() => { const o = []; for (let i = 0; i <= 1000; i++) { const c = toCash(i / 10); if (!o.includes(c)) o.push(c); } return o; })();
  let hist = null, histK = "", bsLast = null;
  const condK = () => { try { return `${gapMode()}|${effBasis()}|${JSON.stringify(P)}|${$("pIncome").value}`; } catch (e) { return String(Math.random()); } };
  const bsOpen = () => { const b = $("bSheet"); return !!b && !b.hidden; };
  // 금액별 막대(게이지 단계마다 한 칸 · 높이 = 그 금액의 곳 수 countAt) — 홈 카드 막대와 예산 시트 막대가 같은 자료
  // 23차: 같은 한 바퀴에서 금액마다 구별 곳 수·가장 적게 드는 돈도 표로(GTAB) — 끄는 동안 지도 구 묶음이 머리 숫자(말풍선)와 같은 값을 바로 쓴다
  let GTAB = null, GK = "";
  function histData() {
    const k = condK(); if (hist && k === histK && GK === kind) return hist;
    histK = k; GTAB = []; GK = kind;
    const nowC = new Map(), nowOf = (r) => { if (!nowC.has(r.id)) { let v = null; try { v = needOf(r).now; } catch (e) {} nowC.set(r.id, v != null && isFinite(v) ? v : null); } return nowC.get(r.id); };
    const save = CASH;
    try {
      hist = STOPS.map((c) => {
        CASH = +c; let n = 0; const cnt = {}, min = {};
        R.forEach((r) => {
          if (!okR(r)) return; n++;
          if (r.lc || (kind && KIND(r) !== kind)) return;
          cnt[r.g] = (cnt[r.g] || 0) + 1;
          const v = nowOf(r); if (v != null && (min[r.g] == null || v < min[r.g])) min[r.g] = v;
        });
        GTAB.push({ cnt, min });
        return [c, n];
      });
    } finally { CASH = save; }
    return hist;
  }
  // 지금 금액이 표에 있는 금액이면 그 칸(없으면 null → 그 자리에서 셈)
  const guTab = () => { if (!hist || !GTAB || GK !== kind || histK !== condK()) return null; const i = STOPS.indexOf(CASH); return i >= 0 ? GTAB[i] : null; };
  // ---------- 막대로 금액 드래그(홈 카드 · 예산 시트): 막대 어디를 눌러 옆으로 끌어도 금액이 바뀐다 ----------
  // touch-action: pan-y → 세로로 밀면 페이지 스크롤, 가로로 끌면 금액. 끄는 동안 숫자·지도·목록이 바로 따라오고(rAF), 손을 떼면 전체 계산 한 번
  const PRESET = [1, 2, 3, 5, 7, 10];
  const SCRS = [];
  let scr = null, histIdle = 0;
  const TICKS = [[0.5, "5,000만"], [2, "2억"], [5, "5억"], [15, "15억+"]];
  function scrubMount(el, big) {
    if (!el || el._scr) return; el._scr = 1;
    el.classList.add("scrub"); if (big) el.classList.add("scr-lg");
    // 19차: 홈 금액 막대도 화면 읽기·키보드로 쓸 수 있는 슬라이더(←→ 한 칸 · PageUp/Down 다섯 칸 · Home/End)
    el.removeAttribute("aria-hidden");
    el.setAttribute("role", "slider"); el.tabIndex = 0;
    el.setAttribute("aria-label", "내 돈");
    el.setAttribute("aria-valuemin", String(STOPS[0])); el.setAttribute("aria-valuemax", String(STOPS[STOPS.length - 1]));
    el.addEventListener("keydown", (e) => {
      const c = +$("pCash").value || 1; let i = STOPS.findIndex((v) => v >= c - 1e-9); if (i < 0) i = STOPS.length - 1;
      const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key];
      let j = k != null ? i + k : e.key === "Home" ? 0 : e.key === "End" ? STOPS.length - 1 : null;
      if (j == null) return;
      e.preventDefault();
      j = Math.max(0, Math.min(STOPS.length - 1, j));
      if (j !== i || STOPS[j] !== c) keyCash(STOPS[j]);
    });
    const keepBars = (el.querySelector(".scr-bars") || {}).innerHTML || "";   // 첫 화면 섬이 그려 둔 막대는 그대로(곳 수 계산이 한가할 때 끝나기 전까지 빈 막대가 되지 않게)
    el.innerHTML = `<div class="scr-bars" aria-hidden="true">${keepBars}</div><i class="scr-h" aria-hidden="true"></i><span class="scr-bub" hidden aria-hidden="true"></span><div class="scr-t" aria-hidden="true">${TICKS.map(([c, t]) => `<span style="left:${toPos(c)}%">${t}</span>`).join("")}</div>`;
    let S = null, G0 = null;
    const bars = el.querySelector(".scr-bars"), hEl = el.querySelector(".scr-h"), bub = el.querySelector(".scr-bub");
    // 21차: 끄는 동안 레이아웃을 읽지 않는다 — 막대 자리·폭은 손을 댈 때 한 번만 재고, 손잡이·말풍선은 transform으로만 옮긴다
    const measure = () => { const b = bars.getBoundingClientRect(), c = +$("pCash").value || 1; G0 = { l: b.left, w: b.width, p0: (toPos(Math.min(15, Math.max(0.5, c))) / 100) * b.width }; };
    const fill = (v) => { for (const i of bars.children) { const c = +i.dataset.c; i.classList.toggle("on", c <= v + 1e-9); i.classList.toggle("cur", Math.abs(c - v) < 1e-9); } };
    const at = (x) => {
      if (!G0 || !G0.w) return;
      const px = Math.min(G0.w, Math.max(0, x - G0.l)), v = toCash((px / G0.w) * 100);
      hEl.style.transform = `translate3d(${(px - G0.p0).toFixed(1)}px,0,0)`;
      if (bub) bub.style.transform = `translate3d(${Math.min(G0.w - 70, Math.max(70, px)).toFixed(1)}px,0,0) translateX(-50%)`;
      if (scr.last != null && v !== scr.last) { const lo = Math.min(scr.last, v), hi = Math.max(scr.last, v); if (PRESET.some((q) => q > lo + 1e-9 && q <= hi + 1e-9)) try { navigator.vibrate && navigator.vibrate(8); } catch (er) {} }
      if (v === scr.last) return;
      scr.last = v; fill(v); dragTo(v);
    };
    const start = (e) => {
      S.on = true; try { el.setPointerCapture(e.pointerId); } catch (er) {}
      // 놓은 뒤 미끄러지는 중에 다시 잡아도 손잡이가 튀지 않게: 자리(--p)를 지금 금액으로 먼저 맞추고 transform을 비운다
      clearTimeout(el._snapT); el.classList.remove("snap"); hEl.style.transform = ""; el.style.setProperty("--p", toPos(Math.min(15, Math.max(0.5, +$("pCash").value || 1))) + "%");
      measure();
      try { histData(); } catch (er) {}
      scr = { el, n0: fastCount(+$("pCash").value || 1), last: null };
      document.documentElement.classList.add("scrub-on"); el.classList.add("on", "drag"); dragging = true; dragN0 = null;
      at(e.clientX);
    };
    // 놓으면: 손잡이가 가까운 금액 자리로 살짝 미끄러지고(140ms, 합성 단계에서 — 무거운 계산이 막지 않음) 그다음 전체 계산 한 번
    const finish = () => {
      dragging = false; document.documentElement.classList.remove("scrub-on"); el.classList.remove("on");
      const v = scr && scr.last; scr = null; dragEnd();
      SCRS.forEach((x) => { const bb = x.querySelector(".scr-bub"); if (bb) { bb.hidden = true; bb.style.transform = ""; } });
      clearTimeout(idleT); clearTimeout(timer);
      const settle = () => { el.classList.remove("snap", "drag"); hEl.style.transform = ""; if (v != null) el.style.setProperty("--p", toPos(v) + "%"); };
      if (v != null && G0 && !reduceMotion()) {
        el.classList.add("snap");
        hEl.style.transform = `translate3d(${((toPos(v) / 100) * G0.w - G0.p0).toFixed(1)}px,0,0)`;
        el._snapT = setTimeout(settle, 160);
        // 미끄러짐이 합성 단계에서 시작된 뒤(두 프레임) 무거운 계산
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => setCash(v, true), 0)));
      } else { settle(); if (v != null) setCash(v, true); }
    };
    el.addEventListener("pointerdown", (e) => { if (e.button > 0) return; S = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false }; if (e.pointerType === "mouse") { e.preventDefault(); start(e); } });
    el.addEventListener("pointermove", (e) => {
      if (!S || e.pointerId !== S.id) return;
      if (!S.on) { const dx = Math.abs(e.clientX - S.x), dy = Math.abs(e.clientY - S.y); if (dy > 10 && dy > dx * 1.2) { S = null; return; } if (dx < 6) return; start(e); }
      at(e.clientX);
    }, { passive: true });
    const end = (e, cancel) => { if (!S || e.pointerId !== S.id) return; const was = S; S = null; if (was.on) { at(e.clientX); finish(); } else if (!cancel) { S = was; start(e); S = null; finish(); } };
    el.addEventListener("pointerup", (e) => end(e, false), { passive: true });
    el.addEventListener("pointercancel", (e) => { if (S && S.on) { S = null; finish(); } else S = null; }, { passive: true });
    SCRS.push(el);
  }
  // 막대 다시 그리기: 자료(곳 수)가 바뀐 때만 막대를 새로 만들고, 금액이 바뀌면 칠·손잡이·말풍선만
  function scrubPaint(all) {
    if (!SCRS.length) return;
    const k = condK();
    if (!hist || histK !== k) {
      // 처음(첫 화면)·조건이 바뀐 때: 37개 금액 곳 수 계산은 한가한 때에(첫 그리기·LCP를 막지 않게). 시트가 열려 있거나 끄는 중이면 바로
      if (!bsOpen() && !scr && !histIdle) { histIdle = 1; (window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 2500 }) : (f) => setTimeout(f, 600))(() => { histIdle = 0; histData(); scrubPaint(R.filter(okR).length); }); }
      if (bsOpen() || scr) histData();
    }
    const c = +$("pCash").value || 1, H = hist && histK === k ? hist : null, mx = H ? Math.max(1, ...H.map((h) => h[1])) : 1, ps = STOPS.map(toPos);
    SCRS.forEach((el) => {
      const bars = el.querySelector(".scr-bars");
      if (H && el._k !== histK) {
        el._k = histK;
        bars.innerHTML = H.map(([v, n], i) => { const a = i ? (ps[i - 1] + ps[i]) / 2 : 0, b = i < ps.length - 1 ? (ps[i] + ps[i + 1]) / 2 : 100; return `<i data-c="${v}" data-n="${n}" style="left:${a.toFixed(2)}%;width:${(b - a).toFixed(2)}%;height:${n ? Math.max(8, Math.round((n / mx) * 100)) : 4}%"></i>`; }).join("");
      }
      for (const i of bars.children) { const v = +i.dataset.c; i.classList.toggle("on", v <= c + 1e-9); i.classList.toggle("cur", Math.abs(v - c) < 1e-9); }
      const p = toPos(c);
      if (!el.classList.contains("drag")) el.style.setProperty("--p", p + "%");   // 끄는 중·미끄러지는 중에는 손잡이를 손가락(transform)이 정한다
      // 막대 맨 왼쪽 눈금 = 실제 최솟값(5,000만 아래로 정해 두면 그 금액을 쓴다 — 손잡이가 눈금 밖에 있지 않게)
      { const t0 = el.querySelector(".scr-t span"), tx = c < 0.5 - 1e-9 ? cashTxt(c) : "5,000만"; if (t0 && t0.textContent !== tx) t0.textContent = tx; }
      const bub = el.querySelector(".scr-bub");
      if (scr && scr.el === el && all != null) { const d = all - scr.n0, t = `${cashTxt(c)} · ${fmt(all)}곳${d ? ` (${d > 0 ? "+" : "−"}${fmt(Math.abs(d))})` : ""}`; if (bub.textContent !== t) bub.textContent = t; bub.hidden = false; }
    });
  }
  // '+0.5억이면 N곳 더' — 0.5억 더 넣어도 그대로면 처음 늘어나는 금액까지(15억 안)
  function moreTxt(c, n0) {
    for (const d of [0.5, 1, 1.5, 2, 3, 5]) { const c2 = Math.round((c + d) * 10) / 10; if (c2 > 15) break; const n = countAt(c2); if (n > n0) return { d, c2, n: n - n0 }; }
    return null;
  }
  function sheetSync(all) {
    if (!bsOpen()) return;
    const c = +$("pCash").value || 1;
    countTo($("bNB"), all); $("bN").textContent = fmt(all);
    $("bGo").textContent = all ? `${fmt(all)}곳 보기` : "지도에서 보기";
    $$("#bSheet [data-bc]").forEach((b) => b.setAttribute("aria-pressed", String(Math.abs(+b.dataset.bc - c) < 1e-9)));
    $$("#bSheet [data-bstep]").forEach((b) => { const dn = +b.dataset.bstep < 0; b.disabled = dn ? c <= 0.5 + 1e-9 : c >= 15 - 1e-9; const dv = Math.abs(bStepTo(c, dn ? -1 : 1) - c); b.setAttribute("aria-label", `${dv > 0.005 ? ZF.cash(dv) : dn ? "1,000만" : "5,000만"} ${dn ? "줄이기" : "늘리기"}`); });
    histData(); scrubPaint(all);
    if (dragging) return;   // 끄는 동안엔 '+0.5억이면'을 다시 세지 않는다(손을 떼면 한 번)
    const m = moreTxt(c, all), el = $("bMore");
    el.innerHTML = m ? `<button type="button" data-bc="${m.c2}"><span><b>${ZF.cash(m.d)}</b> 더 있으면 <b>${fmt(m.n)}곳</b> 더</span><span aria-hidden="true">→</span></button>` : c >= 15 ? "가장 큰 금액이에요" : "더 올려도 늘지 않아요";
  }
  function sheetOpen() {
    const b = $("bSheet"); if (!b) return;
    bsLast = document.activeElement;
    b.hidden = false; document.documentElement.classList.add("bs-on");
    $("sCashBtn").setAttribute("aria-expanded", "true");
    histK = ""; sheetSync(R.filter(okR).length);
    requestAnimationFrame(() => { b.classList.add("in"); try { $("sCash").focus({ preventScroll: true }); } catch (e) {} });
    ZL.open("budget", () => sheetClose(false, true));
  }
  function sheetClose(go, pop) {
    const b = $("bSheet"); if (!b || b.hidden) return;
    const hp = pop === true ? null : ZL.done("budget");
    b.classList.remove("in"); b.hidden = true; document.documentElement.classList.remove("bs-on");
    $("sCashBtn").setAttribute("aria-expanded", "false");
    if (go) {
      // 결과로: 폰은 지도·목록이 이어지는 자리(카드 바로 밑 지도), PC는 왼쪽 목록 맨 위
      const l = matchMedia("(min-width:981px)").matches ? $("sList") : $("sListW");
      const toL = () => { if (l) window.scrollTo({ top: Math.max(0, l.getBoundingClientRect().top + scrollY - HDR() - (matchMedia("(max-width:980px)").matches ? 74 : 8)), behavior: "auto" }); };
      toL(); if (hp) hp.then((r) => { if (r) requestAnimationFrame(toL); });
      const f = $("sList").querySelector("[data-id]"); if (f) f.focus({ preventScroll: true }); else $("sCashBtn").focus({ preventScroll: true });
    } else if (bsLast && document.contains(bsLast)) bsLast.focus({ preventScroll: true });
  }
  function budgetInit() {
    const b = $("bSheet"); if (!b) return;
    $("sCashBtn").addEventListener("click", sheetOpen);
    b.addEventListener("click", (e) => {
      if (e.target.closest("[data-bx]")) return sheetClose(false);
      const c = e.target.closest("[data-bc]"); if (c) { setCash(+c.dataset.bc, true); try { navigator.vibrate && navigator.vibrate(8); } catch (er) {} return; }
      // −0.5억 / +0.5억(17차: 시트의 막대 그림 대신) — 1억 아래에서 줄이면 5,000만에서 멈춘다
      const st = e.target.closest("[data-bstep]"); if (st) { const c0 = +$("pCash").value || 1, d = +st.dataset.bstep; const v = bStepTo(c0, d); setCash(v, true); return; }   // 27차·28차: 2억까지(2억 포함, +·− 같게)는 1,000만씩(9,000만에 바로 닿게) · 2억 넘으면 5,000만씩
      if (e.target.closest("#bGo")) sheetClose(true);
    });
    b.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); sheetClose(false); return; }
      if (e.key !== "Tab") return;   // 시트 안에서만 돈다
      const f = $$("button:not([hidden]),input", b.querySelector(".bs-card")).filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    // 폰: 손잡이·제목 줄을 아래로 끌어 닫기
    let y0 = null, dy = 0; const card = b.querySelector(".bs-card");
    card.addEventListener("pointerdown", (e) => { if (!e.target.closest(".bs-grab,.bs-h") || e.target.closest("button")) return; y0 = e.clientY; dy = 0; try { card.setPointerCapture(e.pointerId); } catch (er) {} });
    card.addEventListener("pointermove", (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); card.style.transform = dy ? `translateY(${dy}px)` : ""; });
    const end = () => { if (y0 == null) return; y0 = null; card.style.transform = ""; if (dy > 70) sheetClose(false); };
    card.addEventListener("pointerup", end); card.addEventListener("pointercancel", end);
    // (i) 전세 끼고·대출 끼고 한 줄 설명
    const ib = $("sModeI"), it = $("sModeT");
    if (ib && it) ib.addEventListener("click", () => { const on = it.hidden; it.hidden = !on; ib.setAttribute("aria-expanded", String(on)); });
    // 손을 뗀 뒤 '+0.5억이면'을 한 번 다시
    addEventListener("pointerup", () => setTimeout(() => { if (bsOpen()) sheetSync(R.filter(okR).length); }, 60));
  }
  function scrubInit() {
    scrubMount($("sScrub"), false);
    scrubMount($("bHist"), true);
  }
  // ---------- 정렬 시트 ----------
  const sortName = () => (SORTS.find((x) => x[0] === sortK) || SORTS[0])[1];
  function sortInit() {
    const b = $("sSortB"); if (!b || $("sortSheet")) return;
    const sh = document.createElement("div");
    sh.className = "bsheet ssheet"; sh.id = "sortSheet"; sh.hidden = true;
    sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true"); sh.setAttribute("aria-labelledby", "sortT");
    sh.innerHTML = `<div class="bs-scr" data-sx aria-hidden="true"></div><div class="bs-card"><div class="bs-grab" aria-hidden="true"></div><div class="bs-h"><h2 id="sortT">정렬</h2><button type="button" class="bs-x" data-sx>닫기</button></div><div class="ss-l" role="radiogroup" aria-labelledby="sortT">${SORTS.map(([k, t, d]) => `<button type="button" role="radio" data-sort="${k}" aria-checked="false"><span><b>${esc(t)}</b><small>${esc(d)}</small></span><i aria-hidden="true"></i></button>`).join("")}</div></div>`;
    document.body.appendChild(sh);
    const opts = () => $$("[data-sort]", sh);
    const close = (back, pop) => { if (sh.hidden) return; if (pop !== true) ZL.done("sort"); sh.classList.remove("in"); sh.hidden = true; document.documentElement.classList.remove("bs-on"); b.setAttribute("aria-expanded", "false"); if (back !== false) b.focus({ preventScroll: true }); };
    b.addEventListener("click", () => {
      opts().forEach((o) => { const on = o.dataset.sort === sortK; o.setAttribute("aria-checked", String(on)); o.tabIndex = on ? 0 : -1; });
      sh.hidden = false; document.documentElement.classList.add("bs-on"); b.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => { sh.classList.add("in"); const c = sh.querySelector('[aria-checked="true"]'); if (c) c.focus({ preventScroll: true }); });
      ZL.open("sort", () => close(false, true));
    });
    sh.addEventListener("click", (e) => {
      if (e.target.closest("[data-sx]")) return close();
      const o = e.target.closest("[data-sort]"); if (!o) return;
      sortK = o.dataset.sort; shown = SHOW0();
      try { localStorage.setItem("emr.sort", sortK); } catch (er) {}
      close(); render();
    });
    sh.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return close(); }
      const L = opts(), i = L.indexOf(document.activeElement);
      if (/^Arrow(Down|Up)$/.test(e.key) && i >= 0) { e.preventDefault(); const n = L[(i + (e.key === "ArrowDown" ? 1 : L.length - 1)) % L.length]; L.forEach((o) => (o.tabIndex = o === n ? 0 : -1)); n.focus(); return; }
      if (e.key !== "Tab") return;
      const F = [sh.querySelector(".bs-x"), ...L.filter((o) => o.tabIndex === 0)];
      if (e.shiftKey && document.activeElement === F[0]) { e.preventDefault(); F[F.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === F[F.length - 1]) { e.preventDefault(); F[0].focus(); }
    });
  }
  // ---------- 무한 스크롤: 마지막 카드가 화면(PC는 목록 칸) 300px 안에 들어오면 20곳씩 더 · #sMore '더 보기 (N곳)'는 키보드·화면 읽기용 버튼으로 남는다 ----------
  let mIO = null, mRoot = null, mLast = null;
  function moreIO() { moreWatch(); }
  function moreWatch() {
    const ol = $("sList"), m = $("sMore"); if (!ol || !m || !window.IntersectionObserver) return;
    const box = matchMedia("(min-width:981px)").matches && /auto|scroll/.test(getComputedStyle(ol).overflowY) ? ol : null;
    if (!mIO || mRoot !== box) { if (mIO) mIO.disconnect(); mRoot = box; mLast = null; mIO = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) setTimeout(moreGo, 0); }, { root: box, rootMargin: "0px 0px 300px 0px" }); }
    const last = m.hidden ? null : ol.lastElementChild;
    if (last === mLast) return;
    mIO.disconnect(); mLast = last; if (last) mIO.observe(last);
  }
  function moreGo() {
    const m = $("sMore"), H = document.documentElement; if (!m || m.hidden || !$("sList").offsetParent || /\b(sheet-open|s-view|s-full|bs-on)\b/.test(H.className)) return;
    shown += STEP; render();
  }
  // 첫 실행 질문(shell.html #onb)·외부에서 쓰는 손잡이: 금액·보유 주택을 앱과 같은 길로 바꾼다
  window.ZP_budget = {
    ready: 1,
    set: (c) => { c = +c; if (!isFinite(c) || c <= 0) return; if (Math.abs((+$("pCash").value || 0) - c) > 1e-9) setCash(c, true); else render(); },
    homes: (h) => { const b = document.querySelector(`#pHomes button[data-v="${h}"]`); if (b && P.homes !== +h) b.click(); },
    open: sheetOpen, close: sheetClose,
    hist: () => (histData() || []).map(([c, n]) => ({ c, n })),
  };
  // ---------- 목록 ----------
  let mapDragT = 0;
  const RMEMO = new Map();
  function render() {
    if (!$("sList")) return;
    const gap = gapMode();
    const v = +$("pCash").value || 1;
    label(Math.min(15, Math.max(0.5, v)), v);
    $$(".s-mode button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.f === "gap") === gap)));
    gu = mapView === "gu" && mapGu && mapGu === listGu ? mapGu : "";   // 구역을 열며 자동으로 들어간 구는 목록을 거르지 않는다
    // 29차: 금액 칸마다 한 번만 셈(막대를 끌며 같은 칸을 오가면 바로) — 조건(사는 방식·금액·구·유형·범위·정렬·내 조건·직접 넣은 값)이 같으면 지난 결과
    let mk = ""; try { mk = `${gap}|${v}|${gu}|${kind}|${bbF ? JSON.stringify(bbF) : ""}|${sortK}|${condK()}|${JSON.stringify(OV)}`; } catch (e) {}
    let hit = mk && RMEMO.get(mk);
    if (!hit) { hit = { L: rows(), all: R.filter(okR).length }; if (mk) { if (RMEMO.size > 60) RMEMO.clear(); RMEMO.set(mk, hit); } }
    const L = hit.L, all = hit.all;
    $("sN").textContent = fmt(all);   // 글자는 늘 최종 값(검사·화면 읽기) · 보이는 숫자만 CSS 카운터로 굴러간다(countTo)
    const ab = $("sAsm"); if (ab) { ab.hidden = gap; if (!gap) { const t = asmText(); ab.innerHTML = `${t}<i aria-hidden="true">?</i>`; ab.setAttribute("aria-label", `대출 가정: ${t} · 설명 보기`); } }
    const lite = liveNow && (dragging || keyOn);   // 손가락·마우스로 끄는 중: 숫자·제목·이름 줄만 · 목록 줄과 지도는 멈추거나 떼면
    // 손가락이 막대 위에 있는 동안(dragging)은 지도를 다시 그리지 않는다 — 손을 떼면(setCash) 한 번. 지도 한 장이 느린 기기에서 숫자가 늦게 바뀌던 것(17차)
    if (!lite) { clearTimeout(heavyT); heavyT = 0; if (!dragging) try { LMX.states(false); } catch (e) {} }
    // 끄는 동안에도 지도 구 묶음·알약 색을 150ms마다 한 번(숫자가 먼저 그려진 다음 프레임에 — 숫자 지연은 그대로)
    else if (performance.now() - mapDragT > 150) { mapDragT = performance.now(); setTimeout(() => { try { LMX.dragLite(); } catch (e) {} }, 0); }   // 지도 알약·점·구 묶음: 같은 판정(zstate)
    // 한 줄 막대도 목록과 같은 거르기(구·지도 범위·유형)를 그대로: 숫자 = 목록 곳 수
    if ($("sMiniN")) {
      const area = gu || (bbF ? "지도 범위" : ""), kn = kind ? ({ redev: "재개발", rebuild: "재건축", small: area ? "가로" : "가로·소규모" })[kind] : "";
      $("sMiniN").textContent = fmt(area || kind ? L.length : all);
      $("sMiniM").textContent = area && kn ? `${bbF && !gu ? "범위" : area}·${kn}` : area || kn || (gap ? "전세 끼고" : "대출 끼고");
    }
    // 분모('전세 시세 있는 N곳 중')는 쓰지 않는다(리뉴얼 2단계) — 카드 한 줄 '내 돈 1억 → 갈 수 있는 곳 9곳'
    // 28차: 구를 고른 동안은 머리 숫자(서울 전체)가 무엇인지 + 그 구 곳 수를 한 줄로(목록 '강북구 · 6곳'과 같은 값)
    // 29차: 구를 고른 동안 큰 숫자 = 그 구 곳 수(목록 '강북구 · 6곳'과 같은 값) · 서울 전체는 그 밑 작은 글자 — '은평구 8곳' 위에 '54곳'이 서던 것
    { const nl = $("sNL"), t = gu ? `${gu}에서 갈 수 있는 곳` : "갈 수 있는 곳"; if (nl.textContent !== t) nl.textContent = t; nl.classList.toggle("bc-gu", !!gu);
      if (gu) { const sn = $("sN"), v = fmt(L.length); if (sn.textContent !== v) sn.textContent = v; }
      let sa = $("sNAll"); if (!sa && gu) { sa = document.createElement("small"); sa.id = "sNAll"; sa.className = "bc-all"; $("sNB").after(sa); }
      if (sa) { sa.hidden = !gu; const v = gu ? `서울 전체 ${fmt(all)}곳` : ""; if (sa.textContent !== v) sa.textContent = v; } }
    countTo($("sNB"), gu ? L.length : all);
    $("sCash").setAttribute("aria-valuetext", `${cashTxt(Math.min(15, Math.max(0.5, v)), v)}, ${fmt(all)}곳`);
    SCRS.forEach((x) => { if (x.getAttribute("role") !== "slider") return; x.setAttribute("aria-valuenow", String(Math.min(15, Math.max(0.5, v)))); x.setAttribute("aria-valuetext", `${cashTxt(Math.min(15, Math.max(0.5, v)), v)}, ${fmt(all)}곳`); });
    $("sLT").textContent = gu ? `${gu} · ${fmt(L.length)}곳` : `갈 수 있는 곳 · ${fmt(L.length)}곳`;
    sheetSync(all);
    $("sLS").textContent = (gap || effBasis() !== "total" ? "지금 필요한 돈 · 추정" : "입주까지 필요한 돈 · 추정");
    $("sLS").removeAttribute("title");
    { const t = $("sSortT"); if (t && t.textContent !== sortName()) t.textContent = sortName(); }
    scrubPaint(all);
    if (lite) { sumR(L, all); return; }
    const sg = $("sGu");
    sg.hidden = !gu && !bbF;
    if (!gu && bbF) { sg.innerHTML = `<button type="button" class="s-bbx" id="sBbX" aria-label="지도 범위만 보기 해제 · 지금 ${fmt(L.length)}곳">지도 범위만 · ${fmt(L.length)}곳<i aria-hidden="true">✕</i></button>`; $("sBbX").onclick = () => { bbF = null; shown = SHOW0(); render(); const f = $("sList").querySelector("[data-id]"); if (f) f.focus({ preventScroll: true }); }; }
    if (gu) sg.innerHTML = `지도에서 고른 <b>${esc(gu)}</b>만 보고 있어요 <button type="button" class="btn text sm" id="sGuX">서울 전체</button>`;
    if (gu) $("sGuX").onclick = () => { if (history.state && history.state.gu && !history.state.zl) { try { history.back(); return; } catch (e) {} } exitGu({}); if (/^#map-/.test(location.hash)) try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} };
    { const pcs = $("pcSave"); if (pcs && $("sList").contains(pcs)) $("sList").after(pcs); }   // 알림 줄(70_pins)을 목록 밖으로 잠깐 — 다시 그린 뒤 다섯째 줄 뒤로
    $("mapbox") && $("mapbox").classList.toggle("s-none", !all);
    $("sList").innerHTML = L.length
      ? L.slice(0, shown).map(({ r, n }) => cardHTML(r, { z: { st: "ok", need: n.now != null && isFinite(n.now) ? n.now : null, total: n.total != null && isFinite(n.total) ? n.total : null }, cls: r.id === pickId ? "sel" : "" })).join("")
      : `<li class="s-empty">${kindEmpty()}</li>`;
    { const kx = $("sKindAll"); if (kx) kx.onclick = () => { const b = $$(".s-flt button", $("sListW")).find((x) => x.dataset.k === ""); if (b) b.click(); }; }
    { const gx = $("sGuAll"); if (gx) gx.onclick = () => { const x = $("sGuX"); if (x) x.click(); }; }
    { const bx = $("sBbAll"); if (bx) bx.onclick = () => { bbF = null; render(); }; }
    { const ku = $("sKindUp"); if (ku) ku.onclick = () => { setCash(+ku.dataset.v, true); const f = $("sList").querySelector("[data-id]"); if (f) f.focus({ preventScroll: true }); }; }
    sumR(L, all);
    try { window.ZP_alSlot && window.ZP_alSlot(); } catch (e) {}
    const m = $("sMore");
    m.hidden = L.length <= shown;
    m.textContent = `더 보기 (${fmt(Math.max(0, L.length - shown))}곳)`;
    moreWatch();
    if (whyEl && !whyEl.hidden && whyFor && !document.contains(whyFor)) { const nb = $("sList").querySelector(`[data-why="${whyFor.dataset.why}"]`); if (nb) whyFor = nb; else whyClose(); }
    newLoad();
    rowFit();
  }
  // 27차·28차: 목록 2줄(단계 · 동 · 역 N분)이 좁아 역 이름이 잘리면 — NEW 칩 숨김(1단계) → 역 이름 대신 '가까운 역 N분'(2단계) → 단계 칩 숨김(3단계) · 맨 '역 N분'은 쓰지 않는다
  // '분'은 늘 다 보인다. 읽기 한 번 → 쓰기 한 번(단계마다 남은 줄만 다시 잰다)
  let rowFitT = 0;
  function rowFit(root) {
    const L = [...(root || document).querySelectorAll("#sList li.s-card .s-l2")];
    if (!L.length) return;
    L.forEach((e) => e.classList.remove("wf1", "wf2", "wf3"));
    const over = (e) => { const sub = e.querySelector(".s-sub"), wn = e.querySelector(".s-wn"), wm = e.querySelector(".s-wm"); if (!sub || !wm) return false; const a = sub.getBoundingClientRect(), m = wm.getBoundingClientRect(); return (wn && wn.offsetWidth && wn.scrollWidth > wn.clientWidth + 1) || m.right > a.right + 0.5 || m.width < 4; };
    let bad = L.filter(over);
    for (const c of ["wf1", "wf2", "wf3"]) { if (!bad.length) break; bad.forEach((e) => e.classList.add(c)); bad = bad.filter(over); }
  }
  addEventListener("resize", () => { clearTimeout(rowFitT); rowFitT = setTimeout(() => rowFit(), 150); }, { passive: true });
  try { window.ZP_rowFit = rowFit; } catch (e) {}
  // 게이지 '이 돈이면' 칸: 넓은 PC는 오른쪽 칸(3곳 · 입주까지 현금 범위), 좁은 화면은 숫자 밑 한 줄 칩(첫 목록 줄이 화면 아래로 밀려도 바로 열 수 있게)
  // 입주까지 계산되는 곳을 먼저(계산 불가 곳만 3개 뜨지 않게), 그 안에서 적은 돈순
  // 17차: 첫 화면이 이름으로 답한다 — 폰은 예산 카드 바로 밑 가로 카드 3장(맞춤순 위 3곳: 이름 · '지금 1.9억' · 단계) + '외 N곳' 카드.
  // 끄는 동안에도(가벼운 길) 같은 함수로 바로 바뀐다. 0곳이면 '6,300만부터 있어요' + [7,000만으로 보기]. PC 두 칸에선 CSS로 숨김(목록이 바로 옆)
  let sumK = "";
  function sumR(L, all) {
    const el = $("sSum"); if (!el) return;
    L = L || []; all = all == null ? L.length : all;
    const nowK = gapMode() || effBasis() !== "total";
    let h = "";
    if (!all) {
      // 가장 적게 드는 곳(지금 방식 · 거르기 없이) — 목록 빈 칸 kindEmpty와 같은 판정
      let lo = Infinity; const save = CASH;
      try { CASH = 999; R.forEach((r) => { if (r.lc || !okR(r)) return; const n = needOf(r), m = nowK ? n.now : n.total; if (m != null && isFinite(m) && m < lo) lo = m; }); } catch (e) {} finally { CASH = save; }
      if (isFinite(lo)) { const up = Math.max(0.1, Math.ceil(lo * 10) / 10), upR = up < 1 ? Math.ceil(up * 10) / 10 : up; h = `<div class="s-zero"><p><b>${esc(eokS(lo))}부터 있어요</b><small>${gapMode() ? "전세 끼고" : "대출 끼고"} 가장 적게 드는 곳</small></p><button type="button" class="s-zbtn" data-up="${upR}">${esc(eokS(upR))}으로 보기</button></div>`; }
    } else {
      const T = L.slice(0, 3), more = all - T.length;
      h = `<ol class="s-rail3" aria-label="${esc(cashTxt(CASH))}이면 갈 수 있는 곳 ${fmt(all)}곳 중 맞춤순 ${T.length}곳">${T.map(({ r, n }) => { const v = nowK ? n.now : n.total; return `<li><button type="button" data-id="${r.id}" aria-label="${esc(shortName(r.n))}, 지금 필요한 돈 ${esc(v != null ? eokS(v) : "–")}, ${esc(stgShort(r))}"><b class="s-rn">${esc(window.ZP_labName ? ZP_labName(r) : shortName(r.n))}</b><span class="s-rv"><small>${nowK ? "지금" : "입주까지"}</small>${esc(v != null ? eokS(v) : "–")}</span><em class="s-rs">${esc(stgShort(r))}</em></button></li>`; }).join("")}${more > 0 ? `<li class="s-rmore"><button type="button" data-more="1"><b>외 ${fmt(more)}곳</b><small>목록 보기</small></button></li>` : ""}</ol>`;
    }
    if (h === sumK) return;
    sumK = h; el.innerHTML = h;
  }
  // ---------- 기능 화면 열기/닫기 ----------
  let cur = "", curT = "";
  function open(id, noScroll) {
    // 예전 주소(#txrTop 등) → 합친 화면 + 그 탭(66_tools.js ZP_HUB)
    const from = id, al = ALIAS[id];
    if (al) { id = al[0]; try { window.ZP_HUB && ZP_HUB.pick(al[0], al[1]); } catch (e) {} }
    try { window.dispatchEvent(new CustomEvent("zp:alias", { detail: from })); } catch (e) {}   // 21차: 빠른 메뉴 '경공매'(#aucTop)·'고시공고'(#ntcTop) → 소식 거르기 칩
    if (!IDS.includes(id)) return false;
    if (!cur && !noScroll) tileY = scrollY;   // 홈 화면이 숨기 전에(숨으면 문서가 짧아져 scrollY가 줄어든다)
    IDS.forEach((x) => { const s = $(x); if (s) s.classList.toggle("s-on", x === id); });
    document.documentElement.classList.add("s-view");
    // 홈 제목(h1)이 숨는 동안은 이 도구의 제목을 1단계 제목으로(화면 읽기·axe page-has-heading-one)
    lvl(id);
    cur = id; curT = al && al[1] === "save" ? "saveTop" : id;
    navMark();
    const f = SECT[id]; if (f) f();
    try { window.dispatchEvent(new CustomEvent("zp:view", { detail: id })); } catch (e) {}
    if (id === "results" || id === "planner") { planN = PLAN0(); plan(); }
    window.dispatchEvent(new Event("resize"));
    if (!noScroll) requestAnimationFrame(() => { const s = (al && al[1] === "save" && $("saveTop")) || $(id); if (s) window.scrollTo({ top: s.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); });
    try { const h = location.hash.slice(1); if (h !== id) { if (al && h === from) history.replaceState(history.state, "", "#" + id); else history.pushState({ sView: id }, "", "#" + id); } } catch (e) {}
    return true;
  }
  let tileY = null, h1El = null;
  let subH = [], subMO = null;
  function lvl(id) {
    if (h1El) { h1El.removeAttribute("aria-level"); h1El = null; }
    subH.forEach((e) => e.removeAttribute("aria-level")); subH = [];
    if (subMO) { subMO.disconnect(); subMO = null; }
    const s = id && $(id); if (!s) return;
    const h = s.querySelector("h1, h2");
    if (h && h.tagName === "H2") {
      h.setAttribute("aria-level", "1"); h1El = h;
      // 제목을 1단계로 올렸으면 그 화면 안 소제목도 한 단계씩(1 → 3으로 건너뛰지 않게 · axe heading-order) — 나중에 그려지는 소제목도
      const down = () => s.querySelectorAll("h3, h4, h5, h6").forEach((x) => { if (x.hasAttribute("aria-level")) return; x.setAttribute("aria-level", String(+x.tagName[1] - 1)); subH.push(x); });
      down();
      try { subMO = new MutationObserver(down); subMO.observe(s, { childList: true, subtree: true }); } catch (e) {}
    }
  }
  function close(scroll) {
    IDS.forEach((x) => { const s = $(x); if (s) s.classList.remove("s-on"); });
    document.documentElement.classList.remove("s-view");
    lvl(null);
    const wasOpen = !!cur;
    cur = "";
    navMark();
    let popB = false;
    if (history.state && history.state.sView) { try { history.back(); popB = true; } catch (e) {} }
    else if (location.hash && known(location.hash.slice(1))) try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {}
    // 돌아가기·뒤로: 도구를 열기 전 보던 자리(타일 격자 등)로. history.back()의 스크롤 복원이 늦게 덮어쓰므로 한 번 더
    const y0 = tileY; tileY = null;
    const back = () => { if (y0 != null) window.scrollTo({ top: y0, behavior: "auto" }); else if (scroll) { const t = $("sTiles"); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); } };
    if (wasOpen && scroll) {
      const go = () => { requestAnimationFrame(back); setTimeout(back, 80); setTimeout(back, 200); };
      go();
      // history.back()이면 브라우저가 popstate 때 예전 자리(홈이 숨은 뒤 줄어든 값)로 되돌리므로 그 뒤에 한 번 더
      if (popB) { addEventListener("popstate", go, { once: true }); setTimeout(() => removeEventListener("popstate", go), 8000); }
    }
  }
  function init() {
    // 같은 페이지에서 주소의 #도구 이름만 바뀌어도(링크·뒤로가기) 그 도구를 연다
    window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (known(h) && cur !== h) { try { if ($("report").classList.contains("sheet")) closeSheetNow(); } catch (e) {} open(h); } });
    window.addEventListener("popstate", () => { const on = document.documentElement.classList.contains("s-full"), want = !!(history.state && history.state.sFull) || location.hash === "#map"; if (on && !want) fullMap(false); else if (!on && want && history.state && history.state.sFull) fullMap(true); });
    if (P.fund === "cash" && P.basis !== "now") { P.basis = "now"; try { setSeg("pBasis", "now"); } catch (e) {} }
    build();
    try { budgetInit(); } catch (e) {}
    // 메뉴(⋯)는 shell.html에 도구·자료·사이트로 묶어 둔다
    try { SECT.mapTop(); } catch (e) {}
    // 첫 지도도 실제 지도(구역 경계·지하철)로 — 앱이 먼저 #map-구 주소로 구 화면에 들어갔으면 그 구 그대로(20차 G2: 새로 열기·새로고침)
    try { if (mapView === "gu" && mapGu) LMX.enter(mapGu); else LMX.seoul(); } catch (e) {}
    if (location.hash === "#map") fullMap(true);   // /#map 링크 = 전체 지도로 바로
    // 기존 '바로가기'(메뉴·다음 단계·히어로 링크)는 해당 기능 화면을 연다
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("[data-menu],[data-jump2],[data-sec],a[href^='#']");
      if (!a || a.closest("#sTiles") || a.closest("#sList")) return;
      // 본문 바로가기: 열린 기능 화면을 닫고 첫 화면 본문(제목)으로 초점
      if (a.classList.contains("skip")) { e.preventDefault(); e.stopImmediatePropagation(); const wasOpen = !!cur; close(); const t = document.querySelector(".s-h1") || $("mapTop"); if (t) { if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1"); const f = () => t.focus({ preventScroll: true }); f(); setTimeout(() => { f(); window.scrollTo({ top: 0, behavior: "auto" }); }, wasOpen ? 120 : 0); } return; }
      const id = a.dataset.menu || a.dataset.jump2 || a.dataset.sec || (a.getAttribute("href") || "").slice(1);
      if (known(id)) { e.preventDefault(); e.stopImmediatePropagation(); if (a.closest("#menuPop")) $("menuBtn").click(); open(id); }
      else if (id === "mapTop" || id === "planner0") { e.preventDefault(); close(); }
    }, true);
    // 같은 화면 위의 겹(시트·확인 상자)만 닫힌 뒤로 가기면 화면을 다시 열지(맨 위로 스크롤) 않는다
    const fromHash = () => { if (window.ZL && ZL.skipping()) return; const h = location.hash.slice(1); if (known(h)) { if (cur !== ((ALIAS[h] && ALIAS[h][0]) || h)) open(h, false); } else if (cur && !byId[h]) close("pop"); };
    addEventListener("popstate", fromHash);
    fromHash();
    // 딥링크: 브라우저 앵커 이동이 끝난 뒤 다시 맞춘다
    const fix = () => { if (cur) { const el = $(curT) || $(cur); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); } };
    if (document.readyState === "complete") setTimeout(fix, 60); else addEventListener("load", () => setTimeout(fix, 60), { once: true });
    // #saveTop(입주 계산 아래 칸)은 위 계산기 답이 늦게 채워지며 밀리므로 한 번 더(그 사이 사용자가 스크롤했으면 두지 않음)
    if (curT === "saveTop") { let touched = false; const t = () => (touched = true); ["pointerdown", "wheel", "touchstart", "keydown"].forEach((k) => addEventListener(k, t, { once: true, passive: true })); [400, 1000].forEach((ms) => setTimeout(() => { if (curT === "saveTop" && !touched) fix(); }, ms)); }
    const _p = plan;
    plan = function () { const x = _p.apply(this, arguments); try { render(); } catch (e) {} return x; };
    const _eg = enterGu, _xg = exitGu;
    enterGu = function (n, o) { listGu = o && o.keepReport ? listGu : n; const x = _eg.apply(this, arguments); shown = SHOW0(); render(); return x; };
    exitGu = function () { listGu = ""; const x = _xg.apply(this, arguments); shown = SHOW0(); render(); return x; };
    // 감싸기 전에 이미 구 화면으로 들어왔으면(주소 #map-구로 연 첫 화면) 목록도 그 구로 거른다('강북구 · 6곳')
    if (mapView === "gu" && mapGu && !listGu) { listGu = mapGu; shown = SHOW0(); try { render(); } catch (e) {} }
    // 상세 '입주 현금' 탭: 맨 위엔 지금·이주·입주 숫자만, 나머지(가정·근거·숫자 바꿔 보기)는 접어 둔다
    { const _rr = renderReport; renderReport = function () { const x = _rr.apply(this, arguments); try { requestAnimationFrame(repSpark); setTimeout(repSpark, 400); } catch (e) {} return x; }; }
    const _rp = renderPane;
    renderPane = function () {
      const x0 = _rp.apply(this, arguments);
      try { if (curTab === "money") foldMoney(cur); } catch (e) {}
      return x0;
    };
    // PC: 구역을 열면 오른쪽이 상세로, '목록' 버튼으로 다시 목록
    const _sel = select;
    // PC 상세는 칸 안에서 따로 스크롤하지 않고 페이지와 함께 흐른다(지도는 옆에 붙어 따라옴) → 열 때 상세 머리가 머리 밑에 오게,
    // 닫을 때(Esc·목록 버튼) 열기 전 보던 자리로. 딥링크로 처음 열릴 때도 같은 규칙(아래 관찰자)
    const PCQ = () => matchMedia("(min-width:981px)").matches;
    let repY = null, selBusy = false, repId = null;
    const repTop = () => { const H = document.documentElement; if (!PCQ() || H.classList.contains("s-full")) return; const w = document.querySelector("#mapTop .main") || $("report"); if (!w) return; const t = Math.max(0, Math.round(w.getBoundingClientRect().top + scrollY - HDR() - 8)); if (Math.abs(scrollY - t) > 2) window.scrollTo({ top: t, behavior: "auto" }); };
    select = function () {
      const H = document.documentElement, pc = PCQ(), was = H.classList.contains("s-rep"), y0 = keepY != null ? keepY : scrollY;
      selBusy = true;
      let x; try { x = _sel.apply(this, arguments); } finally { selBusy = false; }
      // 같은 구역을 다시 고르는 늦은 호출(딥링크 첫 그리기·자료 도착)은 사람이 내려 본 자리를 되돌리지 않는다
      if (pc) { if (!was) repY = y0; keepY = null; H.classList.add("s-rep"); const id = cur && cur.id; if (!was || id !== repId) repTop(); repId = id; try { window.ZP_toListLbl(); } catch (e) {} }
      return x;
    };
    {
      const H = document.documentElement; let on = H.classList.contains("s-rep");
      if (on && PCQ()) { repY = 0; repId = cur && cur.id; requestAnimationFrame(repTop); }
      try { new MutationObserver(() => {
        const v = H.classList.contains("s-rep"); if (v === on) return; on = v;
        if (!PCQ() || selBusy) return;
        if (v) { if (repY == null) repY = scrollY; repId = cur && cur.id; requestAnimationFrame(repTop); }
        else if ((repId = null), repY != null) { const y = repY; repY = null; requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" })); }
      }).observe(H, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    }
    // 서울 전체 화면에서도 실제 지도를 다시 칠한다(구 숫자·구역 색)
    const _rm2 = refreshMap; refreshMap = function () { const x = _rm2.apply(this, arguments); try { if (mapView === "seoul") LMX.paint(); } catch (e) {} return x; };
    // 상세(시트)를 닫으면 보던 자리로
    const _cs = closeSheetNow;
    closeSheetNow = function () { const x = _cs.apply(this, arguments); if (keepY != null) { const y = keepY; keepY = null; requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" })); } return x; };
    // 구별 요약: 가능 0곳인 구는 숨김
    const zero = () => document.querySelectorAll(".gu-list li").forEach((li) => { const b = li.querySelector(".gl-a b"); li.classList.toggle("s-zero", !!b && b.textContent.trim() === "0"); });
    const _rm = refreshMap; refreshMap = function () { const x = _rm.apply(this, arguments); try { zero(); } catch (e) {} return x; };
    zero();
    // 지도 레이어 기본값: 아무것도 켜지 않음(잔글씨 방지). 사용자가 켠 적이 있으면 그대로
    // (레이어 기본값은 10_lmap.js가 '없으면 빈 목록'으로 읽는다 — 미리 써 두지 않는다: 모두 지우기 뒤 키가 되살아나 보이지 않게)
    render();
    // 키보드: '/' 검색, Esc 열린 화면 닫기(입력 중·대화상자·메뉴가 열려 있으면 그쪽에 맡긴다)
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const H = document.documentElement;
      if (e.key === "/" && !typing) { e.preventDefault(); search(); return; }
      if (e.key !== "Escape" || typing || H.classList.contains("sheet-open") || H.classList.contains("menu-open") || document.querySelector("dialog[open]") || (whyEl && !whyEl.hidden)) return;
      if (H.classList.contains("s-full")) fullMap(false);
      else if (H.classList.contains("s-rep") && history.state && history.state.det && history.state.gu) { try { history.back(); } catch (er) { H.classList.remove("s-rep"); } }
      else if (H.classList.contains("s-rep")) { H.classList.remove("s-rep"); const l = $("sList"); if (l) l.focus && l.querySelector("a") && l.querySelector("a").focus({ preventScroll: true }); }
      else if (cur) close(true);
    });
  }
  // 검색에서 구·역을 고르면(폰) 전체 지도로 — 예전 아래 탭 '지도'와 같은 길
  const mapTab = () => { const v = history.state && history.state.sView; close(); if (v) setTimeout(() => fullMap(true), 120); else fullMap(true); };
  return { init, open, close, render, fullMap: (on) => fullMap(on), mapTab, cur: () => cur, setCash: (v) => setCash(v, true), toCash, toPos, zstate, shortTxt, cardHTML, guCount, guCounts, guMins, guTab, pick, spark: (id) => spark(id), stWord: ST_WORD, isNew: (r, n) => isNew(r, n), list: () => rows().map((x) => x.r.id) };
})();
window.ZP_simple = SIMPLE;   // 점검(QA)·다른 화면에서 같은 판정을 읽을 때
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", SIMPLE.init) : setTimeout(SIMPLE.init, 0);
