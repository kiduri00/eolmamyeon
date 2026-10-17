/* ===================== 내 핀 (옛 찜) =====================
   핀 목록 자체는 앱 본문 FAV(localStorage "jg-fav", 옛 찜과 같은 키)를 그대로 쓴다.
   여기서는 꽂을 때의 스냅샷(단계·필요한 돈·신고가 날짜)을 따로 저장해 두고,
   지금 값과 비교한 '소식'(배지)·안 읽은 소식 수·홈 요약 카드·핀 지도 이미지를 만든다.
   지도 담당용 전역: window.PINS = { list(), has(id), on(fn) } */
const PINS = (() => {
  const SK = "zp-pin-snap", SEENK = "zp-pin-seen", SORTK = "zp-pin-sort", HOMEK = "zp-pin-home";
  const MAX = 20;
  const lsR = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const lsW = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let SNAP = lsR(SK, {}); if (!SNAP || typeof SNAP !== "object" || Array.isArray(SNAP)) SNAP = {};
  let SEEN = lsR(SEENK, { at: 0, sig: {} }); if (!SEEN || typeof SEEN.sig !== "object") SEEN = { at: 0, sig: {} };
  let SORT = lsR(SORTK, "news"); if (!["news", "need", "recent"].includes(SORT)) SORT = "news";
  let SEL = false, CMPON = false, EDIT = "", LAST = null, toastT = 0;
  const cbs = [];
  const saveS = () => lsW(SK, SNAP);

  // ---------- 아이콘 ----------
  const PIN_D = "M12 22c-3.4-4.1-7.2-8.4-7.2-12.6a7.2 7.2 0 0 1 14.4 0c0 4.2-3.8 8.5-7.2 12.6z";
  const pinY = (s = 26) => `<svg class="pn-yp" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PIN_D}"/><circle cx="12" cy="9.4" r="2.7"/></svg>`;
  const pinLine = `<path d="${PIN_D}"/><circle cx="12" cy="9.4" r="2.6"/>`;

  // ---------- 숫자 ----------
  const amt = (v) => { v = Math.abs(v); if (v >= 0.95) return `${Math.round(v * 10) / 10}억`; const c = Math.round(v * 10); return c >= 1 ? `${c}천` : `${Math.max(100, Math.round((v * 1e4) / 100) * 100)}만`; };
  const hiAmt = (m) => (m == null || !isFinite(m) ? "" : m >= 10000 ? `${Math.round(m / 1000) / 10}억` : `${Math.round(m).toLocaleString("ko-KR")}만`);
  const ymdOf = (t) => { const d = new Date(t + 9 * 36e5); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`; };
  const dot = (t) => { const s = ymdOf(t); return `${s.slice(2, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`; };
  const mode = () => (gapMode() ? "gap" : "cash");
  function needNow(r, m = mode()) {
    try {
      if (m === "gap") { const g = gapOf(r); return g && !g.block && !g.na && g.now != null && isFinite(g.now) ? g.now : null; }
      const x = investC(r); return x && x.needBuy != null && isFinite(x.needBuy) ? x.needBuy : null;
    } catch (e) { return null; }
  }
  // 전세 끼고가 막힌 구역(토허 등)은 대출 끼고 값으로 대신 보여 준다(구역 리포트와 같은 방식)
  const modeFor = (r) => (mode() === "gap" && needNow(r, "gap") == null && needNow(r, "cash") != null ? "cash" : mode());
  const snapOf = (r) => { const m = modeFor(r), now = needNow(r, m); return { t: Date.now(), s: r.s, sn: stageName(r), now, m, c: CASH, ok: now == null ? null : now <= CASH + 1e-9, hi: (r.tx && r.tx.hi && r.tx.hi[1]) || null }; };

  // 옛 찜(스냅샷 없음)은 처음 볼 때 지금 값으로 스냅샷을 만든다 = 자동 이전
  function ensure() {
    let ch = 0;
    FAV.forEach((id) => {
      const r = byId[id]; if (!r) return;
      const sp = SNAP[id];
      if (!sp) { SNAP[id] = Object.assign(snapOf(r), { mig: 1 }); ch = 1; }
      else if (sp.now == null) { const m = needNow(r, sp.m) != null ? sp.m : modeFor(r), n = needNow(r, m); if (n != null) { sp.now = n; sp.m = m; sp.ok = n <= sp.c + 1e-9; ch = 1; } }   // 시세가 늦게 불러와진 경우 채움
    });
    Object.keys(SNAP).forEach((id) => { if (!FAV.includes(id)) { delete SNAP[id]; ch = 1; } });
    if (ch) saveS();
  }

  // ---------- 꽂은 뒤 바뀐 것 ----------
  function news(id) {
    const r = byId[id], sp = SNAP[id];
    if (!r || !sp) return { r, sp, b: [], now: null, d: null, sig: "" };
    const m = modeFor(r), now = needNow(r, m), b = [];
    if (r.s > sp.s) b.push({ k: "st", t: `${sp.sn} → ${stageName(r)}`, c: "up", h: "단계 올라감", v: r.s });
    const hi = r.tx && r.tx.hi;
    if (hi && hi[1] && (sp.hi ? hi[1] > sp.hi : hi[1] > ymdOf(sp.t))) b.push({ k: "hi", t: hi[2] ? `신고가 평당 ${hiAmt(hi[2])}` : "신고가", c: "hi", h: "신고가", v: hi[1] });
    const ok = now == null ? null : now <= CASH + 1e-9;
    if (ok === true && sp.ok === false) b.push({ k: "ok", t: "이제 살 수 있어요", c: "good", h: "이제 살 수 있어요", v: "" });
    if (ok === false && sp.ok === true) b.push({ k: "short", t: `${amt(now - CASH)} 모자라요`, c: "bad", h: "돈이 모자라요", v: "" });
    const d = now != null && sp.now != null && sp.m === m && Math.abs(now - sp.now) >= 0.05 ? now - sp.now : null;
    return { r, sp, b, now, d, ok, alt: m !== mode(), sig: b.map((x) => x.k + x.v).join("|") };
  }
  const unread = (n) => !!n.sig && SEEN.sig[n.r.id] !== n.sig;
  const all = () => (ensure(), FAV.filter((id) => byId[id]).map(news));
  const unreadN = () => all().filter(unread).length;

  function markSeen() {
    const L = all(); let ch = 0;
    L.forEach((n) => { if (SEEN.sig[n.r.id] !== n.sig) { SEEN.sig[n.r.id] = n.sig; ch = 1; } });
    Object.keys(SEEN.sig).forEach((id) => { if (!FAV.includes(id)) { delete SEEN.sig[id]; ch = 1; } });
    condsAll().forEach((n) => { if (n.c.seen !== n.sig) { n.c.seen = n.sig; ch = 2; } });
    if (ch === 2) saveC();
    if (ch) { SEEN.at = Date.now(); lsW(SEENK, SEEN); badges(); }
  }

  // ---------- 목록 ----------
  function rowHTML(n, i) {
    const { r, sp, b, now, d, alt } = n;
    const nw = unread(n);
    const chip = d == null ? "" : `<span class="pn-chip ${d > 0 ? "up" : "dn"}" title="꽂은 날보다 필요한 돈이 ${amt(d)} ${d > 0 ? "늘었어요" : "줄었어요"}"><span aria-hidden="true">${d > 0 ? "▲" : "▼"}</span>${amt(d)}<span class="sr-only"> ${d > 0 ? "늘었어요" : "줄었어요"}</span></span>`;
    const bd = b.length ? `<div class="pn-bd">${b.slice(0, 2).map((x) => `<span class="pn-b ${x.c}">${esc(x.t)}</span>`).join("")}${b.length > 2 ? `<span class="pn-b more" title="${esc(b.slice(2).map((x) => x.t).join(" · "))}">+${b.length - 2}</span>` : ""}</div>` : "";
    let goal = "";
    if (sp.goal && now != null) {
      const p = Math.max(0, Math.min(1, CASH / Math.max(now, 0.01)));
      goal = now <= CASH + 1e-9 ? `<p class="pn-goal done">${pinY(14)}목표 달성! 이제 살 수 있어요</p>` : `<p class="pn-goal"><span class="pn-gbar" aria-hidden="true"><i style="width:${Math.round(p * 100)}%"></i></span>여기까지 <b>${amt(now - CASH)}</b> 더</p>`;
    }
    const sub = `${esc(r.g)} · ${esc(stageName(r))}`;
    const main = `<span class="pn-pin">${pinY(26)}${nw ? '<i class="pn-new" aria-hidden="true"></i>' : ""}</span>
      <span class="pn-nm"><b>${esc(shortName(r.n))}</b><small>${sub}${nw ? '<span class="sr-only"> · 새 소식</span>' : ""}</small>${sp.memo ? `<small class="pn-memo">${esc(sp.memo)}</small>` : ""}</span>
      <span class="pn-r"><span class="pn-now"><span class="sr-only">지금 필요한 돈 </span><b>${alt ? '<small class="pn-alt" title="전세 끼고는 살 수 없는 구역이라 대출 끼고 금액">대출</small>' : ""}${now != null ? `${e2(now)}억` : "–"}</b>${chip}</span><small>꽂을 때 ${sp.now != null ? `${e2(sp.now)}억` : "–"}</small></span>`;
    const head = SEL
      ? `<button type="button" class="pn-main sel" data-cmp="${r.id}" aria-pressed="${CMP.includes(r.id)}"><span class="pn-ck" aria-hidden="true"></span>${main}</button>`
      : `<button type="button" class="pn-main" data-open="${r.id}" aria-label="${esc(shortName(r.n))} 리포트 열기">${main}</button><button type="button" class="pn-more" data-pedit="${r.id}" aria-expanded="${EDIT === r.id}" aria-controls="pnEd${i}" title="메모·목표"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg><span class="sr-only">${esc(shortName(r.n))} 메모·목표</span></button>`;
    const ed = !SEL && EDIT === r.id
      ? `<div class="pn-ed" id="pnEd${i}"><label class="sr-only" for="pnMemo${i}">메모</label><input id="pnMemo${i}" class="pn-memo-in" data-pmemo="${r.id}" maxlength="20" placeholder="메모 (예: 부모님 근처)" value="${esc(sp.memo || "")}" enterkeyhint="done"><button type="button" class="btn secondary sm" data-pgoal="${r.id}" aria-pressed="${!!sp.goal}">${sp.goal ? "목표 지우기" : "목표 세우기"}</button><button type="button" class="btn text sm" data-punpin="${r.id}">핀 빼기</button><small class="pn-since">${dot(sp.t)}에 꽂음${sp.mig ? " · 찜에서 옮겨 옴" : ""}</small></div>`
      : "";
    return `<div class="pn-row${nw ? " new" : ""}${SEL && CMP.includes(r.id) ? " on" : ""}" role="listitem"><div class="pn-top">${head}</div>${bd}${goal}${ed}</div>`;
  }
  function sorted() {
    const L = all(), ix = (n) => FAV.indexOf(n.r.id);
    const by = {
      news: (a, b) => unread(b) - unread(a) || b.b.length - a.b.length || ix(b) - ix(a),
      need: (a, b) => (a.now ?? 1e9) - (b.now ?? 1e9) || ix(b) - ix(a),
      recent: (a, b) => (b.sp?.t || 0) - (a.sp?.t || 0) || ix(b) - ix(a),
    };
    return L.sort(by[SORT]);
  }
  function listHTML() {
    const L = sorted(), nw = L.filter(unread).length;
    const srt = [["news", "소식 많은 순"], ["need", "필요한 돈 적은 순"], ["recent", "최근 꽂은 순"]].map(([k, t]) => `<button type="button" data-psort="${k}" aria-pressed="${SORT === k}">${t}</button>`).join("");
    const top = SEL
      ? `<div class="pn-selbar" role="group" aria-label="비교할 구역 고르기"><span><b>비교할 구역 2~3곳</b>을 골라 주세요</span><button type="button" class="btn text sm" id="pnSelX">취소</button><button type="button" class="btn primary sm" id="pnGo"${CMP.length >= 2 ? "" : " disabled"}>비교하기 (${CMP.length})</button></div>`
      : `<div class="pn-h"><p><b>내 핀 ${L.length}곳</b>${nw ? `<span class="pn-nwn">새 소식 ${nw}곳</span>` : ""}</p><div class="pn-ha">${L.length >= 2 ? '<button type="button" class="btn secondary sm" id="pnCmp">비교</button>' : ""}<button type="button" class="btn secondary sm" id="pnShare">내 핀 지도 공유</button></div></div>
      <div class="pn-tools"><div class="pn-sort" role="group" aria-label="정렬">${srt}</div><label class="pn-money"><input type="checkbox" id="pnMoney"${MONEY ? " checked" : ""}>공유 이미지에 금액 넣기</label></div>`;
    return `${condHTML()}${top}<p class="pn-base">오른쪽은 ${gapMode() ? "전세 끼고" : "대출 끼고"} 지금 살 때 필요한 돈 · 내 현금 ${e2(CASH)}억 기준 · 꽂은 날과 비교</p><div class="pn-list" role="list" aria-label="내 핀 목록">${L.map(rowHTML).join("")}</div><span class="share-fb" id="pnShareFb" role="status"></span>`;
  }
  const emptyHTML = () => `${condHTML()}<div class="x-empty pn-empty">${pinY(36)}<p><b>아직 꽂은 핀이 없어요</b><br>구역을 눌러 핀을 꽂으면 소식을 모아드려요</p><button type="button" class="btn primary sm" id="pnEmptyGo">지도 보기</button></div>`;
  let MONEY = false;

  // ---------- 꽂기·빼기 ----------
  function add(id) {
    const r = byId[id]; if (!r) return;
    SNAP[id] = LAST && LAST.id === id ? LAST.sp : snapOf(r);
    LAST = null;
    if (!SEEN.sig[id]) { SEEN.sig[id] = ""; lsW(SEENK, SEEN); }
    saveS();
  }
  function drop(id) { if (SNAP[id]) LAST = { id, sp: SNAP[id] }; delete SNAP[id]; if (EDIT === id) EDIT = ""; saveS(); }
  function clear() { SNAP = {}; SEL = false; CMPON = false; EDIT = ""; saveS(); }
  function room(id) { if (FAV.length < MAX) return true; full(id); return false; }
  function feedback(b, id, on) {
    try { navigator.vibrate && navigator.vibrate(10); } catch (e) {}
    if (on && !reduceMotion()) { b.classList.remove("pn-drop"); void b.offsetWidth; b.classList.add("pn-drop"); setTimeout(() => b.classList.remove("pn-drop"), 320); }
    const nm = byId[id] ? shortName(byId[id].n) : "";
    if (on) toast(`핀 꽂음`, "실행 취소", () => { if (isFav(id)) { toggleFav(id); toast("핀 뺐어요"); } }, nm);
    else toast("핀 뺐어요", "", null, nm);
  }
  function toast(msg, act, fn, sub) {
    let t = $("pnToast");
    if (!t) { t = document.createElement("div"); t.id = "pnToast"; t.className = "pn-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    clearTimeout(toastT);
    t.innerHTML = `<span>${pinY(18)}<b>${esc(msg)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>${act ? `<button type="button">${esc(act)}</button>` : ""}`;
    const bt = t.querySelector("button"); if (bt) bt.onclick = () => { clearTimeout(toastT); t.classList.remove("on"); fn && fn(); };
    t.classList.add("on");
    toastT = setTimeout(() => t.classList.remove("on"), 4000);
  }
  // 21번째 핀: 오래된 핀 하나를 빼고 꽂기
  function full(id) {
    const back = document.activeElement;
    const old = FAV.filter((x) => byId[x]).sort((a, b) => (SNAP[a]?.t || 0) - (SNAP[b]?.t || 0)).slice(0, 5);
    const ov = document.createElement("div");
    ov.className = "pn-ov"; ov.id = "pnFull";
    ov.innerHTML = `<div class="pn-dlg" role="dialog" aria-modal="true" aria-labelledby="pnFullT"><h3 id="pnFullT">핀은 ${MAX}개까지예요. 하나 빼고 꽂을까요?</h3><p>오래 전에 꽂은 핀부터 보여 드려요.</p><div class="pn-old">${old.map((x) => `<button type="button" data-pswap="${x}">${pinY(18)}<span><b>${esc(shortName(byId[x].n))}</b><small>${esc(byId[x].g)} · ${SNAP[x] ? dot(SNAP[x].t) + "에 꽂음" : ""}</small></span><em>빼고 꽂기</em></button>`).join("")}</div><button type="button" class="btn secondary sm" id="pnFullX">그만두기</button></div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener("keydown", esc_); try { back && back.focus(); } catch (e) {} };
    const esc_ = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc_);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("#pnFullX")) return close();
      const s = e.target.closest("[data-pswap]"); if (!s) return;
      const o = s.dataset.pswap; close();
      if (isFav(o)) toggleFav(o);
      if (!isFav(id)) toggleFav(id);
      try { navigator.vibrate && navigator.vibrate(10); } catch (e2) {}
      toast("핀 꽂음", "", null, `${shortName(byId[o].n)} 빼고 ${shortName(byId[id].n)}`);
    });
    const f = ov.querySelector("[data-pswap]") || ov.querySelector("#pnFullX"); f && f.focus();
  }

  // ---------- 배지(헤더·하단 탭·홈 카드) ----------
  const nTxt = (n) => (n > 9 ? "9+" : String(n));
  function badges() {
    if (typeof T3 !== "undefined" && !T3.ready) return;
    let L; try { L = all(); } catch (e) { return; }
    const U = L.filter(unread);
    let CN = []; try { CN = condsAll().filter(condUnread); } catch (e) {}
    const n = U.length + CN.length;
    const fn = $("favN");
    if (fn) { fn.hidden = !n; fn.textContent = nTxt(n); fn.classList.add("pn-nb"); }
    const hf = $("huFav");
    if (hf) { hf.setAttribute("aria-label", `내 핀${FAV.length ? ` ${FAV.length}곳` : ""}${n ? ` · 새 소식 ${n}곳` : ""}`); }
    relabel();
    const nb = document.querySelector('#sNav [data-nav="fav"]');
    if (nb) {
      let i = nb.querySelector(".pn-nb");
      if (!i) { i = document.createElement("b"); i.className = "pn-nb"; i.setAttribute("aria-hidden", "true"); nb.appendChild(i); }
      i.hidden = !n; i.textContent = nTxt(n);
      nb.setAttribute("aria-label", `내 핀${n ? `, 새 소식 ${n}곳` : ""}`);
    }
    condBtn();
    home(U, CN);
  }
  const weekKey = () => Math.floor((Date.now() + 9 * 36e5) / 864e5 + 3) / 7 | 0;
  function home(U, CN = []) {
    const hero = $("sHero");
    let c = $("pnHome");
    const off = !hero || !(U.length || CN.length) || lsR(HOMEK, -1) === weekKey() || !isMember();
    if (off) { if (c) c.hidden = true; return; }
    if (!c) {
      c = document.createElement("div"); c.className = "pn-home"; c.id = "pnHome";
      c.addEventListener("click", (e) => {
        if (e.target.closest(".pn-hm-x")) { lsW(HOMEK, weekKey()); c.hidden = true; return; }
        if (e.target.closest(".pn-hm-go")) openView();
      });
    }
    if (c.nextElementSibling !== hero) hero.before(c);
    const f = U[0], cn = CN[0];
    const txt = f
      ? `<b>내 핀 ${U.length}곳에 소식</b> · ${esc(shortName(f.r.n))} ${esc(f.b[0].h)}${cn && cn.add.length ? ` · 새로 들어온 곳 ${cn.add.length}` : ""}`
      : `<b>${esc(cn.c.name)}</b> · ${cn.add.length ? `새로 들어온 곳 ${cn.add.length}` : ""}${cn.add.length && cn.out.length ? " · " : ""}${cn.out.length ? `빠진 곳 ${cn.out.length}` : ""}`;
    c.innerHTML = `<button type="button" class="pn-hm-go">${pinY(22)}<span>${txt}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button><button type="button" class="pn-hm-x" aria-label="이번 주 동안 닫기"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    c.hidden = false;
  }
  function openView() {
    try { if (typeof SIMPLE !== "undefined" && SIMPLE.open && SIMPLE.open("favTop")) return; } catch (e) {}
    location.hash = "#favTop";
  }
  // 하단 탭(60_simple.js가 만든다)·기능 타일 이름과 아이콘을 '내 핀'으로
  function relabel() {
    const nb = document.querySelector('#sNav [data-nav="fav"]');
    if (nb && !nb.dataset.pin) {
      nb.dataset.pin = "1";
      const sp = nb.querySelector("span"); if (sp) sp.textContent = "내 핀";
      const sv = nb.querySelector("svg"); if (sv) sv.innerHTML = pinLine;
    }
    const tl = document.querySelector('#sTiles [data-view="favTop"]');
    if (tl && !tl.dataset.pin) {
      tl.dataset.pin = "1";
      const b = tl.querySelector("b"), sm = tl.querySelector("small"), sv = tl.querySelector("svg");
      if (b) b.textContent = "내 핀"; if (sm) sm.textContent = "핀 꽂은 구역 소식"; if (sv) sv.innerHTML = pinLine;
    }
    return !!nb;
  }

  // ---------- 내 핀 지도 이미지(1080×1350) ----------
  function mapCard(money) {
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), F = (w, s) => `${w} ${s}px "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#1f3a87"); gr.addColorStop(1, "#142659");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const L = all().filter((n) => n.r);
    g.fillStyle = "rgba(255,255,255,.65)"; g.font = F(600, 36); g.fillText("집핀 · 내 핀 지도", 80, 120);
    g.fillStyle = "#fff"; g.font = F(800, 84); g.fillText(`내 핀 ${L.length}곳`, 80, 222);
    // 서울 지도
    const S = 0.86, OX = (W - D.map.w * S) / 2, OY = 270;
    g.save(); g.translate(OX, OY); g.scale(S, S);
    g.fillStyle = "rgba(255,255,255,.07)"; g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = 1.6 / S; g.lineJoin = "round";
    D.map.gu.forEach(([, d]) => { const p = new Path2D(d); g.fill(p); g.stroke(p); });
    try { g.strokeStyle = "rgba(140,175,255,.45)"; g.lineWidth = 9; g.lineCap = "round"; g.stroke(new Path2D(D.map.river)); } catch (e) {}
    g.restore();
    const pts = L.map((n) => { const r = n.r, xy = r.xy || (r.ll ? toXY(r.ll[0], r.ll[1]) : null); return xy ? { n, x: OX + xy[0] * S, y: OY + xy[1] * S } : null; }).filter(Boolean);
    const boxes = [];
    const hit = (b) => boxes.some((o) => !(b[0] + b[2] < o[0] || o[0] + o[2] < b[0] || b[1] + b[3] < o[1] || o[1] + o[3] < b[1]));
    pts.forEach((p) => boxes.push([p.x - 16, p.y - 46, 32, 48]));
    // 핀
    pts.forEach((p) => {
      g.save(); g.translate(p.x - 22, p.y - 48); g.scale(44 / 24, 44 / 24);
      g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 6; g.shadowOffsetY = 2;
      g.fillStyle = "#F5C33B"; g.fill(new Path2D(PIN_D)); g.shadowColor = "transparent";
      g.fillStyle = "#1f3a87"; g.beginPath(); g.arc(12, 9.4, 2.9, 0, 7); g.fill(); g.restore();
    });
    // 이름표(겹치면 다른 자리)
    g.font = F(700, 28); g.textBaseline = "middle";
    pts.slice(0, 10).forEach((p) => {
      const t = shortName(p.n.r.n), w = g.measureText(t).width + 20, h = 40;
      const cand = [[p.x + 18, p.y - 46], [p.x - 18 - w, p.y - 46], [p.x - w / 2, p.y - 92], [p.x - w / 2, p.y + 4], [p.x + 18, p.y - 2], [p.x - 18 - w, p.y - 2]];
      const c = cand.find(([x, y]) => x > 20 && x + w < W - 20 && y > OY - 30 && !hit([x, y, w, h]));
      if (!c) return;   // 자리가 없으면 이름은 아래 목록에만
      boxes.push([c[0], c[1], w, h]);
      g.fillStyle = "rgba(10,20,52,.82)"; EXTRA.rr(g, c[0], c[1], w, h, 12); g.fill();
      g.fillStyle = "#fff"; g.fillText(t, c[0] + 10, c[1] + h / 2 + 1);
    });
    g.textBaseline = "alphabetic";
    // 아래 목록
    const top = OY + D.map.h * S + 40, rows = L.slice(0, 8);
    g.font = F(600, 30);
    rows.forEach((n, i) => {
      const x = 80 + (i % 2) * 470, y = top + Math.floor(i / 2) * 46;
      g.fillStyle = "#F5C33B"; g.beginPath(); g.arc(x + 8, y - 10, 8, 0, 7); g.fill();
      g.fillStyle = "#fff"; const t = `${shortName(n.r.n)}${money && n.now != null ? ` · ${e2(n.now)}억` : ""}`;
      g.fillText(t, x + 26, y, 420);
    });
    if (L.length > 8) { g.fillStyle = "rgba(255,255,255,.6)"; g.fillText(`외 ${L.length - 8}곳`, 80, top + 4 * 46); }
    g.fillStyle = "rgba(255,255,255,.55)"; g.font = F(500, 26);
    g.fillText(money ? `${gapMode() ? "전세 끼고" : "대출 끼고"} 지금 필요한 돈 추정 · 투자 권유 아님` : "집핀 · 서울 재개발 지도", 80, H - 96);
    g.fillStyle = "#fff"; g.font = F(700, 34); g.fillText("jaegaebal.alwaysquestions.kr", 80, H - 48);
    return cv;
  }
  async function shareMap() {
    try { await (document.fonts && document.fonts.ready); } catch (e) {}
    const fb = $("pnShareFb"); if (fb) fb.textContent = "";
    await EXTRA.shareCv(mapCard(MONEY), "zippin_my_pins.png", "내 핀 지도", `내 핀 ${FAV.length}곳 · 집핀 https://jaegaebal.alwaysquestions.kr/`, fb);
  }


  // ===================== 조건 핀: 저장형 스마트 필터 =====================
  // {id, name, cash, mode, gu, kind, minS, cm:{dest,max}|null, sure, strict, base:[ids], at, seen}
  const CK = "zp-cond", CMAX = 3;
  let CONDS = lsR(CK, []); if (!Array.isArray(CONDS)) CONDS = [];
  const saveC = () => lsW(CK, CONDS);
  const KINDS = [["", "전체 유형"], ["redev", "재개발"], ["rebuild", "재건축"], ["small", "가로·소규모"]];
  const STAGES = [[0, "단계 상관없음"], [4, "조합설립 이상"], [5, "사업시행 이상"], [6, "관리처분 이상"]];
  const kindOf = (r) => (/재건축/.test(r.k) ? "rebuild" : /가로|소규모/.test(r.k) ? "small" : "redev");
  let POPSET = null;
  const CMC = new Map();
  const cmRoute = (dest) => CMC.get(dest) || (CMC.set(dest, commuteFrom(dest)), CMC.get(dest));
  // 앱 엔진 그대로(지도·목록의 okR과 같은 기준): 전세 끼고 = gapOf, 대출 끼고 = investC 지금 매수
  function condOk(c, r) {
    if (!(POPSET || (POPSET = new Set(POP.map((x) => x.id)))).has(r.id) || r.lc || estHide(r)) return false;
    if (c.gu && r.g !== c.gu) return false;
    if (c.kind && kindOf(r) !== c.kind) return false;
    if (c.minS && !(r.s >= c.minS)) return false;
    if (c.strict && (isEst(r) || landPermit(r))) return false;
    if (c.sure && restricted(r)) return false;
    if (c.mode === "gap") { const g = gapOf(r); if (g.block || g.na || !(g.now <= c.cash + 1e-9)) return false; }
    else {
      if (r.dn || r.s >= 9 || r.cx || r.src === "moa" || rewinBlocked(r)) return false;
      const x = investC(r); if (!(x.needBuy != null && x.needBuy <= c.cash + 1e-9)) return false;
    }
    if (c.cm) { if (!r.ll) return false; const z = zoneStn(r), rt = z && cmRoute(c.cm.dest).route(z.n); if (!rt || Math.round(z.walk + rt.min) > c.cm.max) return false; }
    return true;
  }
  const EC = new Map();
  const ckey = (c) => [c.cash, c.mode, c.gu, c.kind, c.minS, c.cm ? c.cm.dest + c.cm.max : "", c.sure, c.strict, condKey(), P.jr].join("|");
  function evalCond(c) {
    const k = ckey(c), h = EC.get(k);
    if (h && Date.now() - h.at < 15e3) return h.ids;
    const ids = R.filter((r) => { try { return condOk(c, r); } catch (e) { return false; } }).map((r) => r.id);
    if (EC.size > 20) EC.clear();
    EC.set(k, { ids, at: Date.now() });
    return ids;
  }
  function condNews(c) {
    const ids = evalCond(c), B = new Set(c.base || []), N = new Set(ids);
    const add = ids.filter((id) => !B.has(id)), out = (c.base || []).filter((id) => byId[id] && !N.has(id));
    return { c, ids, add, out, sig: add.length || out.length ? `${add.slice().sort().join(",")}/${out.length}` : "" };
  }
  const condUnread = (n) => !!n.sig && n.c.seen !== n.sig;
  const condsAll = () => CONDS.map(condNews);
  const cashT = (v) => `${Math.round(v * 10) / 10}억`;
  const autoName = (c) => [cashT(c.cash), c.mode === "gap" ? "전세" : "대출", c.gu ? c.gu.replace(/구$/, "") : "", c.kind ? KINDS.find((k) => k[0] === c.kind)[1] : "", c.cm ? `출퇴근 ${c.cm.max}분` : ""].filter(Boolean).join(" ").slice(0, 20);
  const condSum = (c) => [`현금 ${cashT(c.cash)} · ${c.mode === "gap" ? "전세 끼고" : "대출 끼고"}`, c.gu || "서울 전체", c.kind ? KINDS.find((k) => k[0] === c.kind)[1] : "", c.minS ? STAGES.find((x) => x[0] === c.minS)[1] : "", c.cm ? `${c.cm.dest}역 ${c.cm.max}분 안` : "", c.sure ? "입주권 확실만" : "", c.strict ? "토허·추정 제외" : ""].filter(Boolean).join(" · ");
  function curCond() {
    const kb = document.querySelector('.s-flt button[aria-pressed="true"]');
    const cmOn = typeof CM_SHOW !== "undefined" && CM_SHOW && CM_SET.size;
    return { cash: Math.round(CASH * 100) / 100, mode: gapMode() ? "gap" : "cash", gu: "", kind: (kb && kb.dataset.k) || "", minS: 0, cm: cmOn ? { dest: CM.dest, max: CM.max } : null, sure: !!($("pTrade") && $("pTrade").checked), strict: false };
  }
  function condHTML() {
    if (!CONDS.length) return "";
    const L = condsAll();
    return `<section class="pc-wrap" aria-labelledby="pcT"><div class="pc-hd"><h3 id="pcT">조건 핀</h3><small>내 돈으로 새로 되는 곳이 생기면 알려드려요</small></div><div class="pc-cards">${L.map((n) => {
      const c = n.c, nw = condUnread(n);
      const z = n.add.length ? `<div class="pc-z" aria-label="새로 들어온 곳">${n.add.slice(0, 4).map((id) => `<button type="button" class="pc-zn" data-open="${id}"><i>새로</i>${esc(shortName(byId[id].n))}</button>`).join("")}${n.add.length > 4 ? `<span class="pc-zm">외 ${n.add.length - 4}곳</span>` : ""}</div>` : "";
      return `<div class="pc-card${nw ? " new" : ""}"><button type="button" class="pc-main" data-capply="${c.id}" aria-label="${esc(c.name)} 조건을 홈에 적용"><span class="pc-t"><b>${esc(c.name)}</b>${n.add.length ? `<em class="pc-new">새로 들어온 곳 ${n.add.length}</em>` : ""}${n.out.length ? `<em class="pc-out">빠진 곳 ${n.out.length}</em>` : ""}</span><small>${esc(condSum(c))}</small><span class="pc-n">조건에 맞는 곳 <b>${fmt(n.ids.length)}곳</b><span class="pc-go">홈에 적용 →</span></span></button>${z}<div class="pc-a"><button type="button" class="btn text sm" data-cedit="${c.id}">수정</button>${n.sig ? `<button type="button" class="btn text sm" data-crebase="${c.id}">지금 목록을 새 기준으로</button>` : ""}<button type="button" class="btn text sm" data-cdel="${c.id}">삭제</button></div></div>`;
    }).join("")}</div></section>`;
  }
  // 조건 편집 시트(칩 6개 이내)
  function condSheet(edit) {
    const back = document.activeElement;
    const full = !edit && CONDS.length >= CMAX;
    let c = edit ? JSON.parse(JSON.stringify(edit)) : curCond();
    const cmAvail = !!(c.cm || curCond().cm);
    const cm0 = c.cm || curCond().cm;
    const ov = document.createElement("div");
    ov.className = "pn-ov"; ov.id = "pcSheet";
    const chips = () => `<div class="pc-chips" role="group" aria-label="조건">
      <label class="pc-chip sel"><span class="sr-only">구</span><select data-cg>${['<option value="">서울 전체</option>'].concat(GUS.map((g) => `<option${g === c.gu ? " selected" : ""}>${g}</option>`)).join("")}</select></label>
      <button type="button" class="pc-chip" data-cc="kind" aria-pressed="${!!c.kind}">${KINDS.find((k) => k[0] === (c.kind || ""))[1]}</button>
      <button type="button" class="pc-chip" data-cc="minS" aria-pressed="${!!c.minS}">${STAGES.find((x) => x[0] === (c.minS || 0))[1]}</button>
      ${cmAvail ? `<button type="button" class="pc-chip" data-cc="cm" aria-pressed="${!!c.cm}">출퇴근 ${esc(cm0.dest)} ${cm0.max}분</button>` : ""}
      <button type="button" class="pc-chip" data-cc="sure" aria-pressed="${!!c.sure}">입주권 확실만</button>
      <button type="button" class="pc-chip" data-cc="strict" aria-pressed="${!!c.strict}" title="토지거래허가 구역·구 평균 시세로 추정한 구역 제외">토허·추정 제외</button></div>`;
    const cnt = () => `조건에 맞는 곳 <b>${fmt(evalCond(c).length)}곳</b>`;
    const body = () => full
      ? `<h3 id="pcST">조건 핀은 ${CMAX}개까지예요</h3><p>하나를 지우고 다시 저장해 주세요.</p><div class="pn-old">${CONDS.map((x) => `<button type="button" data-cdel2="${x.id}">${pinY(18)}<span><b>${esc(x.name)}</b><small>${esc(condSum(x))}</small></span><em>지우기</em></button>`).join("")}</div><div class="pc-btns"><button type="button" class="btn secondary sm" data-cx>닫기</button></div>`
      : `<h3 id="pcST">${edit ? "조건 핀 수정" : "이 조건으로 핀 꽂기"}</h3><p class="pc-cash">현금 <b>${cashT(c.cash)}</b> · ${c.mode === "gap" ? "전세 끼고" : "대출 끼고"}${edit ? "" : " <small>(금액·방식은 홈 게이지에서)</small>"}</p>
        <label class="pc-nm"><span>이름</span><input data-cn maxlength="20" value="${esc(c.name || autoName(c))}" placeholder="${esc(autoName(c))}"></label>
        <div data-cchips>${chips()}</div>
        <p class="pc-cnt" data-ccnt aria-live="polite">${cnt()}</p>
        <p class="pc-why">내 돈으로 새로 되는 곳이 생기면 알려드려요</p>
        <div class="pc-btns"><button type="button" class="btn secondary sm" data-cx>그만두기</button><button type="button" class="btn primary sm" data-csave>이 조건 저장</button></div>`;
    ov.innerHTML = `<div class="pn-dlg pc-dlg" role="dialog" aria-modal="true" aria-labelledby="pcST">${body()}</div>`;
    document.body.appendChild(ov);
    const dlg = ov.firstElementChild;
    let named = !!(edit && edit.name && edit.name !== autoName(edit));
    const refresh = () => { const nm = dlg.querySelector("[data-cn]"); if (nm && !named) nm.value = autoName(c); dlg.querySelector("[data-cchips]").innerHTML = chips(); dlg.querySelector("[data-ccnt]").innerHTML = cnt(); };
    const close = () => { ov.remove(); document.removeEventListener("keydown", kd); try { back && back.focus(); } catch (e) {} };
    const kd = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", kd);
    dlg.addEventListener("input", (e) => { if (e.target.matches("[data-cn]")) named = true; });
    dlg.addEventListener("change", (e) => { if (e.target.matches("[data-cg]")) { c.gu = e.target.value; refresh(); dlg.querySelector("[data-cg]").focus(); } });
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-cx]")) return close();
      const d2 = e.target.closest("[data-cdel2]");
      if (d2) { CONDS = CONDS.filter((x) => x.id !== d2.dataset.cdel2); saveC(); close(); renderFav(); badges(); condSheet(); return; }
      const ch = e.target.closest("[data-cc]");
      if (ch) {
        const k = ch.dataset.cc;
        if (k === "kind") { const i = KINDS.findIndex((x) => x[0] === (c.kind || "")); c.kind = KINDS[(i + 1) % KINDS.length][0]; }
        else if (k === "minS") { const i = STAGES.findIndex((x) => x[0] === (c.minS || 0)); c.minS = STAGES[(i + 1) % STAGES.length][0]; }
        else if (k === "cm") c.cm = c.cm ? null : cm0;
        else c[k] = !c[k];
        refresh(); const f = dlg.querySelector(`[data-cc="${k}"]`); f && f.focus(); return;
      }
      if (e.target.closest("[data-csave]")) {
        const nm = (dlg.querySelector("[data-cn]").value || "").trim().slice(0, 20) || autoName(c);
        const ids = evalCond(c);
        if (edit) { const i = CONDS.findIndex((x) => x.id === edit.id); if (i >= 0) CONDS[i] = Object.assign({}, c, { name: nm, base: ids, at: Date.now(), seen: "" }); }
        else CONDS.push(Object.assign({}, c, { id: "c" + Date.now().toString(36), name: nm, base: ids, at: Date.now(), seen: "", asOf: D.upd || D.asOf }));
        saveC(); close(); renderFav(); badges(); emit();
        try { navigator.vibrate && navigator.vibrate(10); } catch (er) {}
        toast(edit ? "조건 핀 수정함" : "조건 핀 꽂음", edit ? "" : "내 핀에서 보기", edit ? null : openView, `${nm} · ${fmt(ids.length)}곳`);
      }
    });
    const f = dlg.querySelector("[data-cn]") || dlg.querySelector("button"); f && f.focus();
  }
  function applyCond(c) {
    try { if (P.fund !== c.mode) { const b = document.querySelector(`.s-mode button[data-f="${c.mode}"]`); if (b) b.click(); else setFund(c.mode); } } catch (e) {}
    try { if ($("pTrade") && $("pTrade").checked !== !!c.sure) { $("pTrade").checked = !!c.sure; $("pTrade").dispatchEvent(new Event("change", { bubbles: true })); } } catch (e) {}
    try { $("pCash").value = String(c.cash); PREV_CASH = null; planN = PLAN0(); plan(); } catch (e) {}
    try { const kb = document.querySelector(`.s-flt button[data-k="${c.kind || ""}"]`); if (kb && kb.getAttribute("aria-pressed") !== "true") kb.click(); } catch (e) {}
    if (c.cm) { CM.dest = c.cm.dest; CM.max = c.cm.max; }
    try { SIMPLE.close(); } catch (e) {}
    try { if (c.gu) enterGu(c.gu); else if (mapView === "gu") exitGu(); } catch (e) {}
    try { LMX.fitAff(true); } catch (e) {}
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    toast("조건 적용함", "", null, c.name);
  }
  function condBtn() {
    const hero = $("sHero"); if (!hero) return;
    const ex = $("pcSave"), g0 = document.querySelector(".s-gauge");
    if (ex) { if (g0 && ex.previousElementSibling !== g0) g0.after(ex); return; }
    const b = document.createElement("button");
    b.type = "button"; b.id = "pcSave"; b.className = "pc-save";
    b.innerHTML = `${pinY(18)}<span>이 조건으로 핀 꽂기</span><small>새로 되는 곳 알림</small>`;
    b.onclick = () => { if (!isMember()) { try { mbOpen("fav"); } catch (e) {} return; } condSheet(); };
    const g = document.querySelector(".s-gauge");
    g ? g.after(b) : hero.appendChild(b);
  }
  const newIds = () => [...new Set(condsAll().flatMap((n) => n.add))];

  // ---------- 화면 이벤트 ----------
  function onClick(e) {
    const t = e.target.closest && e.target.closest("[data-capply],[data-cedit],[data-cdel],[data-crebase],[data-psort],[data-pedit],[data-pgoal],[data-punpin],#pnCmp,#pnSelX,#pnGo,#pnShare,#pnEmptyGo,#pnCmpX");
    if (!t) return;
    const cf = (id) => CONDS.find((x) => x.id === id);
    if (t.dataset.capply) { const c = cf(t.dataset.capply); if (c) applyCond(c); return; }
    if (t.dataset.cedit) { const c = cf(t.dataset.cedit); if (c) condSheet(c); return; }
    if (t.dataset.cdel) { const c = cf(t.dataset.cdel); CONDS = CONDS.filter((x) => x.id !== t.dataset.cdel); saveC(); renderFav(); badges(); emit(); if (c) toast("조건 핀 지웠어요", "되돌리기", () => { if (CONDS.length < CMAX) { CONDS.push(c); saveC(); renderFav(); badges(); emit(); } }, c.name); return; }
    if (t.dataset.crebase) { const c = cf(t.dataset.crebase); if (c) { c.base = evalCond(c); c.seen = ""; c.at = Date.now(); saveC(); renderFav(); badges(); emit(); } return; }
    if (t.dataset.psort) { SORT = t.dataset.psort; lsW(SORTK, SORT); renderFav(); return; }
    if (t.dataset.pedit) { EDIT = EDIT === t.dataset.pedit ? "" : t.dataset.pedit; renderFav(); const i = EDIT && $("fvOut").querySelector(`[data-pmemo="${EDIT}"]`); if (i) i.focus(); else { const b = $("fvOut").querySelector(`[data-pedit="${t.dataset.pedit}"]`); b && b.focus(); } return; }
    if (t.dataset.pgoal) { const sp = SNAP[t.dataset.pgoal]; if (sp) { sp.goal = !sp.goal; saveS(); renderFav(); const b = $("fvOut").querySelector(`[data-pgoal="${t.dataset.pgoal}"]`); b && b.focus(); } return; }
    if (t.dataset.punpin) { const id = t.dataset.punpin; if (isFav(id)) { toggleFav(id); toast("핀 뺐어요", "되돌리기", () => { if (!isFav(id) && room(id)) toggleFav(id); }, byId[id] ? shortName(byId[id].n) : ""); } return; }
    if (t.id === "pnCmp") { SEL = true; CMPON = false; CMP = []; renderFav(); const s = $("pnSelX"); s && s.focus(); return; }
    if (t.id === "pnSelX") { SEL = false; renderFav(); const b = $("pnCmp"); b && b.focus(); return; }
    if (t.id === "pnGo") { if (CMP.length < 2) return; SEL = false; CMPON = true; renderFav(); requestAnimationFrame(() => { const h = $("pnCmpT"); if (h) { h.scrollIntoView({ block: "start", behavior: smooth() }); h.focus({ preventScroll: true }); } }); return; }
    if (t.id === "pnCmpX") { CMPON = false; renderFav(); const b = $("pnCmp"); b && b.focus(); return; }
    if (t.id === "pnShare") { shareMap(); return; }
    if (t.id === "pnEmptyGo") { try { SIMPLE.close(); } catch (e2) {} requestAnimationFrame(() => { const m = $("mapTop"); if (m) window.scrollTo({ top: m.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); }); }
  }
  function after() {
    const out = $("fvOut"); if (!out) return;
    const go = $("pnGo"); if (go) { go.disabled = CMP.length < 2; go.textContent = `비교하기 (${CMP.length})`; }
  }
  function init() {
    const out = $("fvOut");
    if (out) {
      out.addEventListener("click", onClick);
      $("pnCmpOut") && $("pnCmpOut").addEventListener("click", onClick);
      out.addEventListener("input", (e) => { const i = e.target.closest && e.target.closest("[data-pmemo]"); if (!i) return; const sp = SNAP[i.dataset.pmemo]; if (sp) { sp.memo = i.value.slice(0, 20).trim(); saveS(); } });
      out.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches && e.target.matches("[data-pmemo]")) e.target.blur(); });
      out.addEventListener("change", (e) => {
        if (e.target.matches && e.target.matches("[data-pmemo]")) { const id = e.target.dataset.pmemo; EDIT = ""; renderFav(); const b = out.querySelector(`[data-pedit="${id}"]`); b && b.focus(); }
        if (e.target.id === "pnMoney") MONEY = e.target.checked;
      });
      // 화면에 보이면 '읽음'(배지 지움). 목록의 '새 소식' 표시는 다음에 다시 그릴 때까지 남는다
      let tm = 0;
      if ("IntersectionObserver" in window) new IntersectionObserver((es) => { es.forEach((x) => { clearTimeout(tm); if (x.isIntersecting && (FAV.length || CONDS.length)) tm = setTimeout(markSeen, 1200); }); }, { threshold: 0.15 }).observe(out);
    }
    let k = 0; const tick = () => { if (!relabel() && k++ < 40) setTimeout(tick, 250); else badges(); }; tick();
    window.addEventListener("pageshow", () => badges());
  }
  // 바깥(지도 등)에서 쓰는 전역
  const list = () => FAV.filter((id) => byId[id]);
  const has = (id) => isFav(id);
  function on(fn) { if (typeof fn === "function") cbs.push(fn); return () => { const i = cbs.indexOf(fn); if (i >= 0) cbs.splice(i, 1); }; }
  function emit() {
    const ids = list();
    cbs.slice().forEach((f) => { try { f(ids); } catch (e) { console.warn(e); } });
    try { window.dispatchEvent(new CustomEvent("pins:change", { detail: ids })); } catch (e) {}
    try { LMX.pins(); } catch (e) {}
  }
  const cmpShown = () => CMPON;
  return { init, list, has, on, emit, newIds, conds: () => CONDS.slice(), evalCond, condOk, add, drop, clear, room, feedback, badges, listHTML, emptyHTML, after, cmpShown, markSeen, news, mapCard, unreadN, MAX };
})();
window.PINS = { list: PINS.list, has: PINS.has, on: PINS.on, newIds: PINS.newIds };
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", PINS.init) : setTimeout(PINS.init, 0);
