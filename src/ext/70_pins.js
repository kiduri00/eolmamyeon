/* ===================== 내 핀 (옛 찜) =====================
   핀 목록 자체는 앱 본문 FAV(localStorage "jg-fav", 옛 찜과 같은 키)를 그대로 쓴다.
   여기서는 꽂을 때의 스냅샷(단계·필요한 돈·신고가 날짜)을 따로 저장해 두고,
   지금 값과 비교한 '소식'(배지)·안 읽은 소식 수·홈 요약 카드·핀 지도 이미지를 만든다.
   지도 담당용 전역: window.PINS = { list(), has(id), on(fn) } */
const PINS = (() => {
  const SK = "zp-pin-snap", SEENK = "zp-pin-seen", SORTK = "zp-pin-sort", HOMEK = "zp-pin-home";
  const MAX = 20;
  // 받침 따라 조사(을/를·이/가·은/는): 마지막 글자가 한글이면 받침, 숫자면 읽는 소리(영·일·삼·육·칠·팔)
  const josa = window.ZP_josa = (w, a, b) => { const s = String(w == null ? "" : w).replace(/[\s)\]]+$/, ""), ch = s.slice(-1), c = ch.charCodeAt(0); const bat = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : /\d/.test(ch) ? "013678".includes(ch) : false; return w + (bat ? a : b); };
  const lsR = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const lsW = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let SNAP = lsR(SK, {}); if (!SNAP || typeof SNAP !== "object" || Array.isArray(SNAP)) SNAP = {};
  let SEEN = lsR(SEENK, { at: 0, sig: {} }); if (!SEEN || typeof SEEN.sig !== "object") SEEN = { at: 0, sig: {} };
  let SORT = lsR(SORTK, "news"); if (!["news", "need", "recent"].includes(SORT)) SORT = "news";
  let SEL = false, CMPON = false, EDIT = "", LAST = null, toastT = 0, PEND = 0, ACT = null, TRADE0 = null;
  const cbs = [];
  // 받은 핀 링크(?fav=)는 앱 본문이 12곳까지만 꽂는다 → 나머지(핀 최대 ${MAX}곳)를 init에서 마저 꽂도록 원래 값을 먼저 잡아 둔다
  // 옛 링크(?fav=id.id)는 핀 목록만. 앱 본문은 주소만 지우고, 여기서 '가져올까요?' 시트로 묻는다
  const FAV_IN = (() => { try { return new URLSearchParams(location.search).get("fav") || ""; } catch (e) { return ""; } })();
  // 새 링크(#pins=…): 핀·메모·목표·꽂을 때 값·조건 핀까지 압축해 담는다. 열자마자 주소에서 지우고 내 핀 화면으로
  // 잘못된 #pins= 링크도 조용히 넘기지 않는다: PIN_BAD로 표시해 토스트로 알린다
  let PIN_BAD = false;
  const pinHash = () => { try { const h = location.hash || ""; if (!/^#pins=/.test(h)) return null; history.replaceState(history.state, "", location.pathname + location.search + "#favTop"); const m = /^#pins=([jz][A-Za-z0-9_-]+)$/.exec(h); return m ? m[1] : ""; } catch (e) { return null; } };
  const PIN_IN = (() => { const v = pinHash(); if (v === "") PIN_BAD = true; return v || ""; })();
  const saveS = () => lsW(SK, SNAP);

  // ---------- 아이콘 ----------
  const PIN_D = "M12 22c-3.4-4.1-7.2-8.4-7.2-12.6a7.2 7.2 0 0 1 14.4 0c0 4.2-3.8 8.5-7.2 12.6z";
  const PIN_H = "M12 5.3 16.3 9.1H15v4H9v-4H7.7zM10.9 13.1v-2.8h2.2v2.8z";   // 핀 머리 안 집(앱 아이콘과 같은 꼴, 문은 뚫림)
  const pinY = (s = 26) => `<svg class="pn-yp" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PIN_D}"/><path class="h" fill-rule="evenodd" d="${PIN_H}"/></svg>`;
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

  // 사업 확실성: 10년 안 준공 확률(app projection) · 단계
  const p10Of = (r) => { try { const pr = projection(r); return hasEta(pr) && pr.p10 != null ? prob(pr.p10) : null; } catch (e) { return null; } };
  const riskT = (r) => { const p = p10Of(r); return p == null ? "" : `10년 안 준공 ${p}%`; };
  const riskH = (r, cls = "pn-risk") => { const p = p10Of(r); return p == null ? "" : `<span class="${cls}${p < 30 ? " lo" : p >= 60 ? " hi" : ""}">10년 안 준공 ${p}%</span>`; };
  const firmOk = (r) => { const p = p10Of(r); return p != null ? p >= 40 : r.s >= 4 && !(r.s >= 9); };
  const MODE_T = { gap: "전세 끼고", cash: "대출 끼고" };

  // ---------- 꽂은 뒤 바뀐 것 ----------
  // 비교는 늘 꽂을 때와 같은 방식(sp.m)으로: 지금 방식이 달라도 꽂을 때 방식으로 다시 계산해 견준다
  function news(id) {
    const r = byId[id], sp = SNAP[id];
    if (!r || !sp) return { r, sp, b: [], now: null, d: null, sig: "" };
    const m = modeFor(r), now = needNow(r, m), b = [];
    const sm = sp.m || m, cmp = sm === m ? now : needNow(r, sm);
    if (r.s > sp.s) b.push({ k: "st", t: `${sp.sn} → ${stageName(r)}`, c: "up", h: "단계 올라감", v: r.s });
    const hi = r.tx && r.tx.hi;
    if (hi && hi[1] && (sp.hi ? hi[1] > sp.hi : hi[1] > ymdOf(sp.t))) b.push({ k: "hi", t: hi[2] ? `신고가 평당 ${hiAmt(hi[2])}` : "신고가", c: "hi", h: "신고가", v: hi[1] });
    const ok = cmp == null ? null : cmp <= CASH + 1e-9;
    if (ok === true && sp.ok === false) b.push({ k: "ok", t: sm === m ? "이제 살 수 있어요" : `${MODE_T[sm]} 이제 살 수 있어요`, c: "good", h: "이제 살 수 있어요", v: "" });
    if (ok === false && sp.ok === true) b.push({ k: "short", t: `${sm === m ? "" : MODE_T[sm] + " "}${amt(cmp - CASH)} 모자라요`, c: "bad", h: "돈이 모자라요", v: "" });
    const d = cmp != null && sp.now != null && Math.abs(cmp - sp.now) >= 0.05 ? cmp - sp.now : null;
    return { r, sp, b, now, cmp, sm, d, ok, alt: m !== mode(), salt: sm !== m, sig: b.map((x) => x.k + x.v).join("|") };
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
    const { r, sp, b, now, d, alt, salt, sm } = n;
    const nw = unread(n);
    const chip = d == null ? "" : `<span class="pn-chip ${d > 0 ? "up" : "dn"}" title="꽂은 날보다 ${salt ? MODE_T[sm] + " 기준 " : ""}필요한 돈이 ${amt(d)} ${d > 0 ? "늘었어요" : "줄었어요"}"><span aria-hidden="true">${d > 0 ? "▲" : "▼"}</span>${amt(d)}<span class="sr-only"> ${d > 0 ? "늘었어요" : "줄었어요"}</span></span>`;
    const bd = b.length ? `<div class="pn-bd">${b.slice(0, 2).map((x) => `<span class="pn-b ${x.c}">${esc(x.t)}</span>`).join("")}${b.length > 2 ? `<span class="pn-b more" title="${esc(b.slice(2).map((x) => x.t).join(" · "))}">+${b.length - 2}</span>` : ""}</div>` : "";
    let goal = "";
    if (sp.goal && now != null) {
      const p = Math.max(0, Math.min(1, CASH / Math.max(now, 0.01)));
      goal = now <= CASH + 1e-9 ? `<p class="pn-goal done">${pinY(14)}목표 달성! 이제 살 수 있어요</p>` : `<p class="pn-goal"><span class="pn-gbar" aria-hidden="true"><i style="width:${Math.round(p * 100)}%"></i></span>여기까지 <b>${amt(now - CASH)}</b> 더</p>`;
    }
    const sub = `${esc(r.g)} · ${esc(stageName(r))}`;
    // 꽂을 때와 지금 방식이 다르면 '꽂을 때'는 그 방식 값끼리 비교(라벨에 방식 표시)
    // 방식이 다르면: '전세 3.2→2.4억'(꽂을 때 방식 값끼리)
    const then = salt ? `<span class="pn-alt">${sm === "gap" ? "전세" : "대출"}</span>${sp.now != null ? e2(sp.now) : "–"}→<b class="pn-cmpv${d == null ? "" : d > 0 ? " up" : " dn"}">${n.cmp != null ? `${e2(n.cmp)}억` : "–"}</b>` : `꽂을 때 ${sp.now != null ? `${e2(sp.now)}억` : "–"}`;
    const main = `<span class="pn-pin">${pinY(26)}${nw ? '<i class="pn-new" aria-hidden="true"></i>' : ""}</span>
      <span class="pn-nm"><b>${esc(shortName(r.n))}</b><small>${sub}${nw ? '<span class="sr-only"> · 새 소식</span>' : ""}</small>${riskH(r) ? `<small class="pn-rk">${riskH(r)}</small>` : ""}${sp.memo ? `<small class="pn-memo">${esc(sp.memo)}</small>` : ""}</span>
      <span class="pn-r"><span class="pn-now"><span class="sr-only">지금 필요한 돈 </span><b>${alt ? '<small class="pn-alt" title="전세 끼고는 살 수 없는 구역이라 대출 끼고 금액">대출</small>' : ""}${now != null ? `${e2(now)}억` : "–"}</b>${salt ? "" : chip}</span><small title="${salt ? `꽂을 때와 같은 ${MODE_T[sm]} 기준 비교` : ""}">${then}</small></span>`;
    const head = SEL
      ? `<button type="button" class="pn-main sel" data-cmp="${r.id}" aria-pressed="${CMP.includes(r.id)}"><span class="pn-ck" aria-hidden="true"></span>${main}</button>`
      : `<button type="button" class="pn-main" data-open="${r.id}" aria-label="${esc(shortName(r.n))} 리포트 열기">${main}</button><button type="button" class="pn-more" data-pedit="${r.id}" aria-expanded="${EDIT === r.id}" aria-controls="pnEd${i}" title="메모·목표·핀 빼기" aria-label="${esc(shortName(r.n))} 메모·목표·핀 빼기"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>`;
    const ed = !SEL && EDIT === r.id
      ? `<div class="pn-ed" id="pnEd${i}"><label class="sr-only" for="pnMemo${i}">메모</label><input id="pnMemo${i}" class="pn-memo-in" data-pmemo="${r.id}" maxlength="20" placeholder="메모 (예: 부모님 근처)" value="${esc(sp.memo || "")}" enterkeyhint="done">${!sp.goal && now != null && now <= CASH + 1e-9 ? `<span class="pn-gok">${pinY(14)}이미 살 수 있어요</span>` : `<button type="button" class="btn secondary sm" data-pgoal="${r.id}" aria-pressed="${!!sp.goal}">${sp.goal ? "목표 지우기" : "목표 세우기"}</button>`}<button type="button" class="btn text sm" data-punpin="${r.id}">핀 빼기</button><small class="pn-since">${dot(sp.t)}에 꽂음${sp.mig ? " · 찜에서 옮겨 옴" : ""}</small></div>`
      : "";
    const mb = !SEL && EDIT !== r.id ? `<div class="pn-foot"><button type="button" class="pn-addm" data-pedit="${r.id}" aria-expanded="false" aria-label="${esc(shortName(r.n))} ${sp.memo ? "메모 고치기" : "메모 추가"}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">${sp.memo ? '<path d="M4 20h4L19 9l-4-4L4 16z"/>' : '<path d="M12 5v14M5 12h14"/>'}</svg>${sp.memo ? "메모 고치기" : "메모 추가"}</button></div>` : "";
    return `<div class="pn-row${nw ? " new" : ""}${SEL && CMP.includes(r.id) ? " on" : ""}" role="listitem"><div class="pn-top">${head}</div>${bd}${goal}${mb}${ed}</div>`;
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
    return `${condHTML()}${top}<p class="pn-base">오른쪽은 ${gapMode() ? "전세 끼고" : "대출 끼고"} 지금 살 때 필요한 돈 · 내 현금 ${e2(CASH)}억 기준 · 꽂은 날과 비교</p><div class="pn-list" role="list" aria-label="내 핀 목록">${L.map(rowHTML).join("")}</div><span class="share-fb" id="pnShareFb" role="status"></span>${SEL ? "" : moveHTML(L.length)}`;
  }
  // 다른 기기로 옮기기: 핀·메모·목표·꽂을 때 값·조건 핀을 압축해 주소(#pins=)에 담아 복사(로그인 불필요)
  const moveHTML = (n) => { const m = FAV.filter((id) => SNAP[id] && SNAP[id].memo).length; return `<div class="pn-move"><div><b>다른 기기로 옮기기</b><small>다른 폰·PC에서 열면 ${josa(`핀 ${n}곳${CONDS.length ? ` · 조건 ${CONDS.length}개` : ""}${m ? ` · 메모` : ""}`, "을", "를")} 그대로 가져와요</small></div><button type="button" class="btn secondary sm" id="pnMove">링크 복사</button><span class="share-fb" id="pnMoveFb" role="status"></span></div>`; };
  // ----- 옮기기 링크 인코딩: [1, 핀[], 조건[]] JSON → deflate-raw(되면) → base64url. 키 없이 배열·뒤쪽 빈 값 생략
  // 핀: [id, 꽂은 날(일-19000), 단계, 필요한 돈, 전세끼고1, 그때 현금, 신고가일-20000000, 메모, 목표1, 찜이전1, 그때 단계 이름(바뀐 경우만)]
  // 조건: [이름(자동이면 ""), 현금, 전세끼고1, 구, 유형, 최소 단계, 출퇴근 역, 분, 입주권1|토허2|확실성4]
  const r2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
  // 필요한 돈은 만원 단위(소수 넷째 자리)로 옮긴다 — 1.246을 1.25로 올려 보내면 받은 기기에서 '꽂을 때 1.3억'처럼 달라짐
  const r4 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
  const trimA = (a) => { while (a.length > 1 && (a[a.length - 1] == null || a[a.length - 1] === "" || a[a.length - 1] === 0)) a.pop(); return a; };
  function packJSON() {
    ensure();
    const P = FAV.filter((id) => byId[id]).map((id) => {
      const sp = SNAP[id] || {}, r = byId[id], hi = sp.hi && /^\d{8}$/.test(String(sp.hi)) ? +sp.hi - 2e7 : sp.hi || 0;
      return trimA([id, sp.t ? Math.round(sp.t / 864e5) - 19000 : 0, sp.s || 0, r4(sp.now), sp.m === "gap" ? 1 : 0, r4(sp.c), hi, sp.memo || "", sp.goal ? 1 : 0, sp.mig ? 1 : 0, sp.sn && r.s !== sp.s ? sp.sn : ""]);
    });
    const C = CONDS.map((c) => trimA([c.name && c.name !== autoName(c) ? c.name : "", r2(c.cash), c.mode === "gap" ? 1 : 0, c.gu || "", c.kind || "", c.minS || 0, c.cm ? c.cm.dest : "", c.cm ? c.cm.max : 0, (c.sure ? 1 : 0) | (c.strict ? 2 : 0) | (c.firm ? 4 : 0)]));
    return JSON.stringify(C.length ? [1, P, C] : [1, P]);
  }
  const b64u = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64u = (s) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/")), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const zpipe = async (u8, S) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new S("deflate-raw"))).arrayBuffer());
  let MV = { k: "", u: "" };
  async function moveURL() {
    const js = packJSON();
    if (MV.k === js && MV.u) return MV.u;
    const u8 = new TextEncoder().encode(js);
    let s = "j" + b64u(u8);
    try { if (typeof CompressionStream !== "undefined") { const z = "z" + b64u(await zpipe(u8, CompressionStream)); if (z.length < s.length) s = z; } } catch (e) {}
    const u = pageURL() + condQuery() + "#pins=" + s;
    MV = { k: js, u };
    return u;
  }
  async function unpack(s) {
    const u = unb64u(s.slice(1));
    const raw = s[0] === "z" ? await zpipe(u, DecompressionStream) : u;
    const a = JSON.parse(new TextDecoder().decode(raw));
    if (!Array.isArray(a) || a[0] !== 1) throw new Error("ver");
    const pins = (a[1] || []).filter((x) => Array.isArray(x) && byId[x[0]]).slice(0, MAX).map(([id, d, s0, now, g, c, hi, memo, goal, mig, sn]) => {
      const r = byId[id], c0 = c == null ? CASH : +c, n0 = now == null ? null : +now, st = s0 == null ? r.s : +s0;
      const sp = { t: d ? (+d + 19000) * 864e5 : Date.now(), s: st, sn: sn || (st === r.s ? stageName(r) : stageName(Object.assign({}, r, { s: st }))), now: n0, m: g ? "gap" : "cash", c: c0, ok: n0 == null ? null : n0 <= c0 + 1e-9, hi: hi ? (typeof hi === "number" ? String(hi + 2e7) : hi) : null };
      if (memo) sp.memo = String(memo).slice(0, 20); if (goal) sp.goal = true; if (mig) sp.mig = 1;
      return { id, sp };
    });
    const conds = (a[2] || []).filter(Array.isArray).slice(0, CMAX).map(([nm, cash, g, gu, kind, minS, dest, max, fl]) => {
      const c = { cash: +cash || 1, mode: g ? "gap" : "cash", gu: GUS.includes(gu) ? gu : "", kind: KINDS.some((k) => k[0] === kind) ? kind || "" : "", minS: +minS || 0, cm: dest && max ? { dest: String(dest), max: +max } : null, sure: !!(fl & 1), strict: !!(fl & 2), firm: !!(fl & 4) };
      c.name = String(nm || "").slice(0, 30) || autoName(c);
      return c;
    });
    return { pins, conds };
  }
  // 받은 링크 미리보기: 합치기 / 바꾸기 / 취소 — 묻지 않고 덮어쓰지 않는다
  function importSheet(d) {
    const P = d.pins, C = d.conds, nm = P.filter((x) => x.sp && x.sp.memo).length, ng = P.filter((x) => x.sp && x.sp.goal).length;
    if (!P.length && !C.length) return badLink();
    const old0 = $("pnImp"); if (old0) old0.remove();
    const back = document.activeElement, has = FAV.length || CONDS.length;
    const parts = [P.length ? `핀 ${P.length}곳` : "", C.length ? `조건 ${C.length}개` : "", nm ? `메모 ${nm}개` : "", ng ? `목표 ${ng}개` : ""].filter(Boolean).join(" · ");
    const nNew = P.filter((x) => !isFav(x.id)).length, over = FAV.length + nNew > MAX;
    const ov = document.createElement("div");
    ov.className = "pn-ov"; ov.id = "pnImp";
    ov.innerHTML = `<div class="pn-dlg pi-dlg" role="dialog" aria-modal="true" aria-labelledby="piT" aria-describedby="piD"><h3 id="piT">${parts} 가져올까요?</h3>
      <p id="piD">${d.old ? "받은 링크의 핀 목록이에요." : "다른 기기에서 보낸 내 핀이에요."}${has ? ` 이 기기에 있는 것: 핀 ${FAV.length}곳${CONDS.length ? ` · 조건 ${CONDS.length}개` : ""}` : ""}</p>
      ${P.length ? `<ul class="pi-nm" aria-label="받은 핀">${P.slice(0, 6).map((x) => `<li>${pinY(14)}${esc(shortName(byId[x.id].n))}${isFav(x.id) ? "<small>이미 꽂음</small>" : ""}</li>`).join("")}${P.length > 6 ? `<li class="pi-more">외 ${P.length - 6}곳</li>` : ""}</ul>` : ""}
      ${C.length ? `<ul class="pi-nm pi-c" aria-label="받은 조건 핀">${C.map((c) => `<li>${esc(c.name)}</li>`).join("")}</ul>` : ""}
      ${has ? `<p class="pi-how"><b>합치기</b> 지금 핀은 두고 더해요${over ? ` (핀은 ${MAX}곳까지)` : ""} · <b>바꾸기</b> 받은 것으로 바꿔요</p>` : ""}
      <div class="pc-btns pi-btns"><button type="button" class="btn text sm" data-pix>취소</button>${has ? `<button type="button" class="btn secondary sm" data-pirep>바꾸기</button><button type="button" class="btn primary sm" data-pimrg>합치기</button>` : `<button type="button" class="btn primary sm" data-pimrg>가져오기</button>`}</div></div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener("keydown", kd); try { back && back.focus && back.focus(); } catch (e) {} };
    const kd = (e) => { if (e.key === "Escape") { close(); toast("가져오지 않았어요", "", null, "지금 핀은 그대로예요"); } };
    document.addEventListener("keydown", kd);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-pix]")) { close(); toast("가져오지 않았어요", "", null, "지금 핀은 그대로예요"); return; }
      const rep = !!e.target.closest("[data-pirep]");
      if (rep || e.target.closest("[data-pimrg]")) { close(); doImport(d, rep); }
    });
    const f = ov.querySelector("[data-pimrg]"); f && f.focus();
  }
  function doImport(d, rep) {
    const bk = { fav: FAV.slice(), snap: JSON.parse(JSON.stringify(SNAP)), conds: JSON.parse(JSON.stringify(CONDS)) };
    if (rep) { FAV = []; SNAP = {}; CONDS = []; }
    let np = 0, nc = 0;
    d.pins.forEach((x) => {
      if (isFav(x.id)) { const sp = SNAP[x.id]; if (sp && x.sp) { if (!sp.memo && x.sp.memo) sp.memo = x.sp.memo; if (!sp.goal && x.sp.goal) sp.goal = true; } return; }
      if (FAV.length >= MAX) return;
      FAV.push(x.id); SNAP[x.id] = x.sp || snapOf(byId[x.id]); if (!SEEN.sig[x.id]) SEEN.sig[x.id] = ""; np++;
    });
    d.conds.forEach((c) => {
      if (CONDS.length >= CMAX || CONDS.some((o) => ckey(o) === ckey(c))) return;
      const ids = evalCond(c);
      CONDS.push(Object.assign(c, { id: "c" + (Date.now() + nc).toString(36), base: ids, sv: snapVals(c, ids), at: Date.now(), seen: "", asOf: D.upd || D.asOf })); nc++;
    });
    CMP = CMP.filter(isFav); if (!CMP.length) CMP = FAV.slice(0, 3);
    FAV_NOTE = "";
    saveFav(); saveS(); saveC(); lsW(SEENK, SEEN);
    syncFav();
    const sub = np || nc ? `핀 ${np}곳${nc ? ` · 조건 ${nc}개` : ""} 더함` : "새로 더할 핀이 없어요";
    toast(rep ? "받은 핀으로 바꿨어요" : "받은 핀 합쳤어요", "되돌리기", () => { FAV = bk.fav; SNAP = bk.snap; CONDS = bk.conds; CMP = CMP.filter(isFav); saveFav(); saveS(); saveC(); syncFav(); toast("가져오기 되돌렸어요"); }, sub);
  }
  function badLink() { const o = $("pnImp"); if (o) o.remove(); toast("링크가 손상됐어요", "", null, "보낸 기기에서 다시 복사해 주세요"); }
  const readPins = (v) => unpack(v).then((d) => setTimeout(() => importSheet(d), 250)).catch(() => setTimeout(badLink, 80));
  // 같은 탭에서 다른 #pins= 링크를 열면: 열려 있던 가져오기 창을 닫고 새 링크로 다시
  addEventListener("hashchange", () => { if (!/^#pins=/.test(location.hash || "")) return; const o = $("pnImp"); if (o) o.remove(); const v = pinHash(); if (v) readPins(v); else if (v === "") setTimeout(badLink, 80); });   // 같은 hashchange의 hideToast 뒤에 띄움
  function importIn() {
    if (PIN_BAD) return setTimeout(badLink, 900);   // 첫 화면 이동(hashchange → 토스트 숨김)이 끝난 뒤
    if (PIN_IN) return readPins(PIN_IN);
    if (!FAV_IN) return;
    const ids = [...new Set(FAV_IN.split(/[.,]/))].filter((id) => byId[id]).slice(0, MAX);
    if (ids.length) setTimeout(() => importSheet({ old: 1, pins: ids.map((id) => ({ id })), conds: [] }), 250);
  }
  const emptyHTML = () => `${condHTML()}<div class="x-empty pn-empty">${pinY(36)}<p><b>아직 꽂은 핀이 없어요</b><br>구역을 눌러 핀을 꽂으면 다시 열 때 바뀐 소식을 모아 보여 드려요</p><button type="button" class="btn primary sm" id="pnEmptyGo">지도 보기</button></div>`;
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
    // 토스트는 toggleFav 감싼 notify가 띄운다(모든 꽂기·빼기 경로 공통)
  }
  // 핀 꽂기·빼기 확인 토스트 + 되돌리기: toggleFav를 감싸서 구역 시트·출퇴근·비교·지도·목록 어디서 바꿔도 한 곳에서
  let QUIET = 0;
  const quiet = (f) => { QUIET++; try { return f(); } finally { QUIET--; } };
  function notify(id, on) {
    const nm = byId[id] ? shortName(byId[id].n) : "";
    if (on) toast("핀 꽂음", "실행 취소", () => { if (isFav(id)) quiet(() => toggleFav(id)); toast("핀 뺐어요", "", null, nm); }, `${nm} · 내 핀 ${FAV.length}곳`);
    else toast("핀 뺐어요", "되돌리기", () => { if (!isFav(id) && room(id)) { quiet(() => toggleFav(id)); toast("다시 꽂았어요", "", null, nm); } }, nm);
  }
  function toast(msg, act, fn, sub) {
    let t = $("pnToast");
    if (!t) { t = document.createElement("div"); t.id = "pnToast"; t.className = "pn-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    clearTimeout(toastT);
    t.innerHTML = `<span>${pinY(18)}<span class="pn-tt"><b>${esc(msg)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span></span>${act ? `<button type="button">${esc(act)}</button>` : ""}`;
    const bt = t.querySelector("button"); if (bt) bt.onclick = () => { clearTimeout(toastT); t.classList.remove("on"); fn && fn(); };
    t.classList.add("on");
    toastT = setTimeout(() => t.classList.remove("on"), 4000);
  }
  // 화면이 바뀌면(내 핀·기능 화면 열기/닫기, 전체 지도, 하단 탭) 토스트를 바로 걷는다
  function hideToast() { clearTimeout(toastT); const t = $("pnToast"); if (t) t.classList.remove("on"); }
  function toastWatch() {
    let prev = document.documentElement.className;
    const key = (c) => ["s-view", "s-full"].map((k) => (` ${c} `).includes(` ${k} `)).join();
    if ("MutationObserver" in window) new MutationObserver(() => { const c = document.documentElement.className; if (key(c) !== key(prev)) hideToast(); prev = c; }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("#sNav button,#sTiles a,[data-menu]")) hideToast(); }, true);
    addEventListener("hashchange", hideToast);
  }
  // 21번째 핀: 오래된 핀 하나를 빼고 꽂기
  function full(id) {
    const back = document.activeElement;
    const old = FAV.filter((x) => byId[x]).sort((a, b) => (SNAP[a]?.t || 0) - (SNAP[b]?.t || 0)).slice(0, 5);
    const ov = document.createElement("div");
    ov.className = "pn-ov"; ov.id = "pnFull";
    ov.innerHTML = `<div class="pn-dlg" role="dialog" aria-modal="true" aria-labelledby="pnFullT"><h3 id="pnFullT">핀은 ${MAX}개까지예요. 하나 빼고 꽂을까요?</h3><p>오래 전에 꽂은 핀부터 보여 드려요.</p><div class="pn-old">${old.map((x) => `<button type="button" data-pswap="${x}">${pinY(18)}<span><b>${esc(shortName(byId[x].n))}</b><small>${esc(byId[x].g)} · ${SNAP[x] ? dot(SNAP[x].t) + "에 꽂음" : ""}</small></span><em>빼고 꽂기</em></button>`).join("")}</div><button type="button" class="btn secondary sm" id="pnFullX">그만두기</button></div>`;
    document.body.appendChild(ov);
    const close = (nav) => { ov.remove(); document.removeEventListener("keydown", esc_); removeEventListener("hashchange", onNav); removeEventListener("popstate", onNav); if (nav !== true) try { back && back.focus(); } catch (e) {} };
    const onNav = () => close(true);
    const esc_ = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc_); addEventListener("hashchange", onNav); addEventListener("popstate", onNav);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("#pnFullX")) return close();
      const s = e.target.closest("[data-pswap]"); if (!s) return;
      const o = s.dataset.pswap; close();
      quiet(() => { if (isFav(o)) toggleFav(o); if (!isFav(id)) toggleFav(id); });
      try { navigator.vibrate && navigator.vibrate(10); } catch (e2) {}
      toast("핀 꽂음", "실행 취소", () => { quiet(() => { if (isFav(id)) toggleFav(id); if (!isFav(o)) toggleFav(o); }); toast("되돌렸어요", "", null, shortName(byId[o].n)); }, `${shortName(byId[o].n)} 빼고 ${shortName(byId[id].n)}`);
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
    try { if (isApp() && navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) {}
    home(U, CN);
    try { if (typeof INBOX !== "undefined") INBOX.paint(); } catch (e) {}   // 알림함 종 배지(72_inbox)
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
      ? `<b>내 핀 ${U.length}곳에 소식</b> · ${esc(shortName(f.r.n))} ${esc(f.b[0].h)}${cn && cn.add.length ? ` · 조건 핀 새 구역 ${freshIds().length || newIds().length}` : ""}`
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
      g.fillStyle = "#1f3a87"; g.fill(new Path2D(PIN_H), "evenodd"); g.restore();
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
  // {id, name, cash, mode, gu, kind, minS, cm:{dest,max}|null, sure, strict, firm, base:[ids], sv:{id:[필요한 돈, 단계, 신고가일]}, at, seen}
  const CK = "zp-cond", CMAX = 3;
  let CONDS = lsR(CK, []); if (!Array.isArray(CONDS)) CONDS = [];
  const saveC = () => lsW(CK, CONDS);
  const KINDS = [["", "전체 유형"], ["redev", "재개발"], ["rebuild", "재건축"], ["small", "가로·소규모"]];
  const STAGES = [[0, "단계 상관없음"], [4, "조합설립 이상"], [5, "사업시행 이상"], [6, "관리처분 이상"]];
  const kindOf = (r) => (/재건축/.test(r.k) ? "rebuild" : /가로|소규모/.test(r.k) ? "small" : "redev");
  let POPSET = null;
  const inPop = (r) => (POPSET || (POPSET = new Set(POP.map((x) => x.id)))).has(r.id);
  const CMC = new Map();
  const cmRoute = (dest) => CMC.get(dest) || (CMC.set(dest, commuteFrom(dest)), CMC.get(dest));
  // 돈 말고 나머지 조건(구·유형·단계·출퇴근·입주권·토허·사업 확실성). 홈에 적용할 때도 이 함수 하나로 거른다
  function condExtra(c, r) {
    if (c.gu && r.g !== c.gu) return false;
    if (c.kind && kindOf(r) !== c.kind) return false;
    if (c.minS && !(r.s >= c.minS)) return false;
    if (c.strict && (isEst(r) || landPermit(r))) return false;
    if (c.sure && restricted(r)) return false;
    if (c.firm && !firmOk(r)) return false;
    if (c.cm) { if (!r.ll) return false; const z = zoneStn(r), rt = z && cmRoute(c.cm.dest).route(z.n); if (!rt || Math.round(z.walk + rt.min) > c.cm.max) return false; }
    return true;
  }
  // 이 조건 방식으로 지금 필요한 돈(계산 안 되면 null)
  function needC(c, r) {
    try {
      if (c.mode === "gap") { const g = gapOf(r); return g.block || g.na || g.now == null || !isFinite(g.now) ? null : g.now; }
      if (r.dn || r.s >= 9 || r.cx || r.src === "moa" || rewinBlocked(r)) return null;
      const x = investC(r); return x.needBuy != null && isFinite(x.needBuy) ? x.needBuy : null;
    } catch (e) { return null; }
  }
  const condPre = (c, r) => inPop(r) && !r.lc && !estHide(r) && condExtra(c, r);
  // 앱 엔진 그대로(홈 숫자 okR과 같은 기준): 전세 끼고 = gapOf, 대출 끼고 = investC 지금 매수
  function condOk(c, r) {
    if (!condPre(c, r)) return false;
    const n = needC(c, r);
    return n != null && n <= c.cash + 1e-9;
  }
  // 홈 숫자·핀과 같은 기준(60_simple okR과 같은 식): 지도 핀·게이지 토스트가 이걸 함께 쓴다
  const zpOk = (r) => { try { return inPop(r) && (effBasis() === "now" ? affOk(r, "now") : affOk(r)); } catch (e) { return false; } };
  // 저장할 때 '아직 안 되는' 후보 구역의 값을 적어 둔다 → 새로 들어오면 왜 들어왔는지(돈 ▼·단계·실거래) 보여 줌
  function snapVals(c, base) {
    const B = new Set(base), sv = {};
    R.forEach((r) => { try { if (B.has(r.id) || !condPre(c, r)) return; const n = needC(c, r); sv[r.id] = [n == null ? null : Math.round(n * 1e4) / 1e4, r.s || 0, (r.tx && r.tx.hi && r.tx.hi[1]) || 0, r.tx && r.tx.n3 != null ? r.tx.n3 : null]; } catch (e) {} });
    return sv;
  }
  function whyNew(c, id) {
    const r = byId[id]; if (!r || !c.sv) return "";
    const v = c.sv[id], w = [];
    if (!v) return c.minS && r.s >= c.minS ? "단계 올라감" : c.firm ? "사업 확실성 올라감" : "새로 잡힌 구역";
    const [n0, s0, h0, t0] = v, n = needC(c, r);
    if (r.s > s0) w.push("단계 올라감");
    if (n != null && n0 != null && n0 - n >= 0.005) w.push(`필요한 돈 ▼${amt(n0 - n)}`);
    else if (n != null && n0 == null) w.push("시세 새로 잡힘");
    const hi = r.tx && r.tx.hi && r.tx.hi[1];
    if ((hi && hi > (h0 || 0)) || (t0 != null && r.tx && r.tx.n3 != null && r.tx.n3 !== t0)) w.push("새 실거래");
    return w.slice(0, 2).join(" · ") || "계산 기준 바뀜";
  }
  const EC = new Map();
  const ckey = (c) => [c.cash, c.mode, c.gu, c.kind, c.minS, c.cm ? c.cm.dest + c.cm.max : "", c.sure, c.strict, c.firm, condKey(), P.jr].join("|");
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
  const cashT = ZF.cash;
  const stShort = (m) => (STAGES.find((x) => x[0] === m) || [0, ""])[1];
  const autoName = (c) => [`${cashT(c.cash)} ${c.mode === "gap" ? "전세" : "대출"}`, c.gu ? c.gu.replace(/구$/, "") : "", c.kind ? KINDS.find((k) => k[0] === c.kind)[1] : "", c.minS ? stShort(c.minS) : "", c.firm ? "확실성 높음" : "", c.cm ? `출퇴근 ${c.cm.max}분` : ""].filter(Boolean).reduce((a, x) => (a && (a + " · " + x).length > 30 ? a : a ? a + " · " + x : x), "");
  const condSum = (c) => [`현금 ${cashT(c.cash)} · ${c.mode === "gap" ? "전세 끼고" : "대출 끼고"}`, c.gu || "서울 전체", c.kind ? KINDS.find((k) => k[0] === c.kind)[1] : "", c.minS ? stShort(c.minS) : "", c.cm ? `${c.cm.dest}역 ${c.cm.max}분 안` : "", c.sure ? "입주권 확실만" : "", c.strict ? "토지거래허가·추정치 빼기" : "", c.firm ? "사업 확실성 높은 곳만" : ""].filter(Boolean).join(" · ");
  function curCond() {
    const kb = document.querySelector('.s-flt button[aria-pressed="true"]');
    const cmOn = typeof CM_SHOW !== "undefined" && CM_SHOW && CM_SET.size;
    return { cash: Math.round(CASH * 100) / 100, mode: gapMode() ? "gap" : "cash", gu: "", kind: (kb && kb.dataset.k) || "", minS: 0, cm: cmOn ? { dest: CM.dest, max: CM.max } : null, sure: false, strict: false, firm: false };
  }
  function condHTML() {
    if (!CONDS.length) return "";
    const L = condsAll();
    return `<section class="pc-wrap" aria-labelledby="pcT"><div class="pc-hd"><h3 id="pcT">조건 핀</h3><small>다시 열면 새로 들어온 곳을 보여 드려요</small></div>${pwaHint()}<div class="pc-cards">${L.map((n) => {
      const c = n.c, nw = condUnread(n);
      const z = n.add.length ? `<ul class="pc-z" aria-label="새로 들어온 곳">${n.add.slice(0, 4).map((id) => { const r = byId[id], wy = whyNew(c, id); return `<li><button type="button" class="pc-zl" data-open="${id}"><i>새로</i><span><b>${esc(shortName(r.n))}</b><small>${esc(stageName(r))}${riskT(r) ? ` · ${riskH(r, "pc-rk")}` : ""}</small></span>${wy ? `<em class="pc-why2">${esc(wy)}</em>` : ""}</button></li>`; }).join("")}${n.add.length > 4 ? `<li class="pc-zm">외 ${n.add.length - 4}곳</li>` : ""}</ul>` : "";
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
      <label class="pc-chip sel${c.kind ? " on" : ""}"><span class="sr-only">유형</span><select data-ck>${KINDS.map(([v, t]) => `<option value="${v}"${v === (c.kind || "") ? " selected" : ""}>유형: ${v ? t : "전체"}</option>`).join("")}</select></label>
      <label class="pc-chip sel${c.minS ? " on" : ""}"><span class="sr-only">단계</span><select data-cs>${STAGES.map(([v, t]) => `<option value="${v}"${v === (c.minS || 0) ? " selected" : ""}>단계: ${v ? t : "상관없음"}</option>`).join("")}</select></label>
      ${cmAvail ? `<button type="button" class="pc-chip" data-cc="cm" aria-pressed="${!!c.cm}">출퇴근 ${esc(cm0.dest)} ${cm0.max}분</button>` : ""}
      <button type="button" class="pc-chip" data-cc="sure" aria-pressed="${!!c.sure}">입주권 확실만</button>
      <button type="button" class="pc-chip" data-cc="strict" aria-pressed="${!!c.strict}" title="토지거래허가 구역·구 평균 시세로 추정한 구역 빼기">토지거래허가·추정치 빼기</button>
      <button type="button" class="pc-chip" data-cc="firm" aria-pressed="${!!c.firm}" title="10년 안 준공 가능성 40% 이상(추정이 없으면 조합설립 이상)">사업 확실성 높은 곳만</button></div>`;
    const cnt = () => `조건에 맞는 곳 <b>${fmt(evalCond(c).length)}곳</b>`;
    const body = () => full
      ? `<h3 id="pcST">조건 핀은 ${CMAX}개까지예요</h3><p>하나를 지우고 다시 저장해 주세요.</p><div class="pn-old">${CONDS.map((x) => `<button type="button" data-cdel2="${x.id}">${pinY(18)}<span><b>${esc(x.name)}</b><small>${esc(condSum(x))}</small></span><em>지우기</em></button>`).join("")}</div><div class="pc-btns"><button type="button" class="btn secondary sm" data-cx>닫기</button></div>`
      : `<h3 id="pcST">${edit ? "조건 핀 수정" : "이 조건으로 핀 꽂기"}</h3><div class="pc-cashf"><div class="pc-cin"><label for="pcCash">내 현금</label><span class="pc-cbox"><button type="button" data-cstep="-0.5" aria-label="0.5억 줄이기">−</button><input id="pcCash" data-ccash inputmode="decimal" autocomplete="off" aria-describedby="pcCErr" value="${Math.round(c.cash * 100) / 100}"><i aria-hidden="true">억</i><button type="button" data-cstep="0.5" aria-label="0.5억 늘리기">+</button></span><small class="pc-cerr" id="pcCErr" data-cerr role="alert" hidden></small></div><div class="pc-mode" role="group" aria-label="사는 방법"><button type="button" data-cmode="gap" aria-pressed="${c.mode === "gap"}">전세 끼고</button><button type="button" data-cmode="cash" aria-pressed="${c.mode !== "gap"}">대출 끼고</button></div></div>
        <label class="pc-nm"><span>이름</span><input data-cn maxlength="30" value="${esc(c.name || autoName(c))}" placeholder="${esc(autoName(c))}"></label>
        <div data-cchips>${chips()}</div>
        <p class="pc-cnt" data-ccnt aria-live="polite">${cnt()}</p>
        <p class="pc-why">다시 열면 새로 들어온 곳을 보여 드려요</p>
        <div class="pc-btns"><button type="button" class="btn secondary sm" data-cx>그만두기</button><button type="button" class="btn primary sm" data-csave>이 조건 저장</button></div>`;
    ov.innerHTML = `<div class="pn-dlg pc-dlg" role="dialog" aria-modal="true" aria-labelledby="pcST">${body()}</div>`;
    document.body.appendChild(ov);
    const dlg = ov.firstElementChild;
    let named = !!(edit && edit.name && edit.name !== autoName(edit));
    const refresh = () => { const nm = dlg.querySelector("[data-cn]"); if (nm && !named) nm.value = autoName(c); dlg.querySelector("[data-cchips]").innerHTML = chips(); dlg.querySelector("[data-ccnt]").innerHTML = cnt(); };
    // 주소가 바뀌면(뒤로 가기·#구역 이동) 시트를 닫는다 — 열린 채 남아 다른 화면을 가리지 않게
    const close = (nav) => { ov.remove(); document.removeEventListener("keydown", kd); removeEventListener("hashchange", onNav); removeEventListener("popstate", onNav); if (nav !== true) try { back && back.focus(); } catch (e) {} };
    const onNav = () => close(true);
    const kd = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", kd); addEventListener("hashchange", onNav); addEventListener("popstate", onNav);
    const lite = () => { const nm = dlg.querySelector("[data-cn]"); if (nm && !named) nm.value = autoName(c); dlg.querySelector("[data-ccnt]").innerHTML = cnt(); };
    let cT = 0, cashBad = false;
    dlg.addEventListener("input", (e) => {
      if (e.target.matches("[data-cn]")) named = true;
      if (e.target.matches("[data-ccash]")) {
        // 숫자(소수점)와 끝의 '억'만 받는다 — 글자를 지워 숫자만 남기면 '2억 성북'이 22억이 됐다
        const raw = String(e.target.value).replace(/,/g, "").trim(), m = /^(\d+(?:\.\d+)?|\.\d+)\s*(억)?$/.exec(raw), v = m ? +m[1] : NaN, okv = isFinite(v) && v > 0 && v <= 100;
        cashBad = raw === "" || !okv; e.target.setAttribute("aria-invalid", String(cashBad));
        const er = dlg.querySelector("[data-cerr]"); if (er) { er.hidden = !cashBad; er.textContent = raw && m && !okv ? "0.1~100억 사이로 넣어 주세요" : "숫자만 넣어 주세요(예: 2.5)"; }
        const sv = dlg.querySelector("[data-csave]"); if (sv) sv.disabled = cashBad;
        if (okv) { c.cash = Math.round(v * 100) / 100; clearTimeout(cT); cT = setTimeout(lite, 160); }
      }
    });
    dlg.addEventListener("change", (e) => {
      const t = e.target;
      if (t.matches("[data-cg]")) c.gu = t.value;
      else if (t.matches("[data-ck]")) c.kind = t.value;
      else if (t.matches("[data-cs]")) c.minS = +t.value;
      else return;
      const sel = ["[data-cg]", "[data-ck]", "[data-cs]"].find((q) => t.matches(q));
      refresh(); const f = dlg.querySelector(sel); f && f.focus();
    });
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-cx]")) return close();
      const d2 = e.target.closest("[data-cdel2]");
      if (d2) { CONDS = CONDS.filter((x) => x.id !== d2.dataset.cdel2); saveC(); close(); renderFav(); badges(); condSheet(); return; }
      const cs = e.target.closest("[data-cstep]");
      if (cs) { c.cash = Math.min(100, Math.max(0.1, Math.round((c.cash + +cs.dataset.cstep) * 10) / 10)); const i = dlg.querySelector("[data-ccash]"); if (i) { i.value = String(c.cash); i.dispatchEvent(new Event("input", { bubbles: true })); } lite(); return; }
      const cmd = e.target.closest("[data-cmode]");
      if (cmd) { c.mode = cmd.dataset.cmode; dlg.querySelectorAll("[data-cmode]").forEach((b) => b.setAttribute("aria-pressed", String(b === cmd))); lite(); return; }
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
        if (cashBad) { const i = dlg.querySelector("[data-ccash]"); if (i) i.focus(); return; }
        const nm = (dlg.querySelector("[data-cn]").value || "").trim().slice(0, 30) || autoName(c);
        const ids = evalCond(c);
        const sv = snapVals(c, ids);
        if (edit) { const i = CONDS.findIndex((x) => x.id === edit.id); if (i >= 0) CONDS[i] = Object.assign({}, c, { name: nm, base: ids, sv, at: Date.now(), seen: "" }); }
        else CONDS.push(Object.assign({}, c, { id: "c" + Date.now().toString(36), name: nm, base: ids, sv, at: Date.now(), seen: "", asOf: D.upd || D.asOf }));
        saveC(); close(); renderFav(); badges(); emit();
        try { navigator.vibrate && navigator.vibrate(10); } catch (er) {}
        toast(edit ? "조건 핀 수정함" : "조건 핀 꽂음", edit ? "" : "내 핀에서 보기", edit ? null : openView, `${nm} · ${fmt(ids.length)}곳`);
      }
    });
    // 이름 칸에 바로 포커스를 주면 폰 키보드가 칩·저장 버튼을 가려서, 제목에 둔다
    const h = dlg.querySelector("#pcST"); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } else { const f = dlg.querySelector("button"); f && f.focus(); }
  }
  // 홈에 적용: 금액·방식·입주권뿐 아니라 구·유형·단계·출퇴근·토허·확실성까지 그대로 → 홈 숫자 = 카드 숫자
  function applyCond(c) {
    if (!ACT) { try { TRADE0 = $("pTrade") ? $("pTrade").checked : null; } catch (e) {} }
    ACT = JSON.parse(JSON.stringify(c));
    try { if (P.fund !== c.mode) { const b = document.querySelector(`.s-mode button[data-f="${c.mode}"]`); if (b) b.click(); else setFund(c.mode); } } catch (e) {}
    try { if ($("pTrade") && $("pTrade").checked !== !!c.sure) { $("pTrade").checked = !!c.sure; $("pTrade").dispatchEvent(new Event("change", { bubbles: true })); } } catch (e) {}
    if (c.cm) { CM.dest = c.cm.dest; CM.max = c.cm.max; }
    try { $("pCash").value = String(c.cash); PREV_CASH = null; planN = PLAN0(); plan(); } catch (e) {}
    try { const kb = document.querySelector(`.s-flt button[data-k="${c.kind || ""}"]`); if (kb && kb.getAttribute("aria-pressed") !== "true") kb.click(); } catch (e) {}
    try { SIMPLE.close(); } catch (e) {}
    try { if (c.gu) enterGu(c.gu); else if (mapView === "gu") exitGu(); } catch (e) {}
    actRefresh();
    try { LMX.fitAff(true); } catch (e) {}
    // 하단 탭 표시를 '홈'으로
    try { document.querySelectorAll("#sNav button").forEach((x) => x.removeAttribute("aria-current")); const hb = document.querySelector('#sNav [data-nav="home"]'); hb && hb.setAttribute("aria-current", "page"); } catch (e) {}
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    setTimeout(() => toast("조건 적용함", "", null, `${c.name} · ${fmt(R.filter(zpOk).length)}곳`), 60);
  }
  function actClear() {
    ACT = null;
    // 적용하며 바꾼 '입주권이 나오는 구역만'을 원래대로
    try { if (TRADE0 != null && $("pTrade") && $("pTrade").checked !== TRADE0) { $("pTrade").checked = TRADE0; $("pTrade").dispatchEvent(new Event("change", { bubbles: true })); } } catch (e) {}
    TRADE0 = null; actRefresh(); try { if (mapView === "gu") exitGu(); } catch (e) {} try { LMX.fitAff(true); } catch (e) {} }
  function actRefresh() {
    try { planN = PLAN0(); plan(); } catch (e) {}
    try { refreshMap(); } catch (e) {}
    try { SIMPLE.render(); } catch (e) {}
    try { LMX.paint(); } catch (e) {}
    actBar();
  }
  // 적용 중인 조건 띠(게이지 아래): 무엇이 걸려 있는지 + 해제
  function actBar() {
    let el = $("pcAct");
    const extra = ACT && condSum(Object.assign({}, ACT, { cash: 0 })).split(" · ").slice(2).filter((x) => x !== "서울 전체");
    if (!ACT || !extra || !extra.length) { if (el) el.hidden = true; return; }
    const g0 = document.querySelector(".s-gauge"); if (!g0) return;
    if (!el) {
      el = document.createElement("div"); el.id = "pcAct"; el.className = "pc-act"; el.setAttribute("role", "status");
      el.addEventListener("click", (e) => { if (e.target.closest("[data-actx]")) actClear(); });
    }
    const an = $("pcSave") || g0; if (el.previousElementSibling !== an) an.after(el);
    el.innerHTML = `${pinY(16)}<span><b>조건 핀 적용 중</b> · ${esc(extra.join(" · "))}</span><button type="button" class="btn text sm" data-actx>해제</button>`;
    el.hidden = false;
  }
  // 소식 배지: 홈 화면 앱(standalone)에서만 아이콘 배지를 띄울 수 있어 그때 한 번 안내
  const isApp = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } };
  function pwaHint() {
    if (!isApp() || lsR("zp-pwa-hint", 0)) return "";
    setTimeout(() => lsW("zp-pwa-hint", 1), 3000);
    return `<p class="pc-pwa">${pinY(14)}홈 화면 앱에서 열면 소식 배지가 떠요</p>`;
  }
  // 구역 시트 머리(제목 줄)에 '핀 꽂기' — 스크롤 없이 보이게. 아래 원래 버튼도 그대로 둔다(둘 다 data-fav라 함께 바뀜)
  function headPin() {
    const rep = $("report"); if (!rep) return;
    const fb = rep.querySelector(".rep-acts [data-fav]"); if (!fb) return;
    const id = fb.dataset.fav, on = isFav(id), r = byId[id];
    const mk = () => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn secondary sm favb pn-hpin"; b.dataset.fav = id;
      b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", `${r ? shortName(r.n) : ""} ${on ? "핀 빼기" : "핀 꽂기"}`);
      b.innerHTML = fb.innerHTML; return b;
    };
    // 폰 시트: 위에 붙는 닫기 줄(스크롤해도 늘 보임). PC: 제목 줄
    const bar = rep.querySelector(".sheet-bar"), x = $("sheetClose");
    if (bar && x && !bar.querySelector(".pn-hpin")) bar.insertBefore(mk(), x);
    const t = rep.querySelector(".rep-t");
    if (t && !t.querySelector(".pn-hpin")) { const gb = t.lastElementChild && t.lastElementChild !== t.firstElementChild ? t.lastElementChild : null; gb ? t.insertBefore(mk(), gb) : t.appendChild(mk()); }
  }

  // 홈 게이지 아래 띠: 왼쪽 '이 조건으로 핀 꽂기'(저장 시트) · 오른쪽은 조건 핀이 있을 때만 '새로 들어온 곳 N곳'(내 핀의 조건 핀 목록으로)
  function condBtn() {
    const hero = $("sHero"); if (!hero) return;
    let w = $("pcSave"); const g0 = document.querySelector(".s-gauge");
    if (!w) {
      w = document.createElement("div"); w.id = "pcSave"; w.className = "pc-save";
      w.innerHTML = `<button type="button" class="pc-sv-m">${pinY(18)}<span>이 조건으로 핀 꽂기</span></button><button type="button" class="pc-sv-n" hidden></button>`;
      w.querySelector(".pc-sv-m").onclick = () => { if (!isMember()) { try { mbOpen("fav"); } catch (e) {} return; } condSheet(); };
      w.querySelector(".pc-sv-n").onclick = () => { openView(); setTimeout(() => { const h = $("pcT"); if (h) { h.scrollIntoView({ block: "start", behavior: "auto" }); h.tabIndex = -1; h.focus({ preventScroll: true }); } }, 120); };
      g0 ? g0.after(w) : hero.appendChild(w);
    } else if (g0 && w.previousElementSibling !== g0 && !(w.previousElementSibling && w.previousElementSibling.id === "pcAct")) g0.after(w);
    const n = CONDS.length ? newIds().length : 0, f = CONDS.length ? freshIds().length : 0, nb = w.querySelector(".pc-sv-n");
    if (!CONDS.length) { nb.hidden = true; return; }
    nb.hidden = false;
    // 마지막으로 본 뒤 새로 조건에 들어온 구역 = '+N 새 구역' 배지(내 핀에서 보면 지워짐)
    nb.innerHTML = f ? `<b class="pc-nb">+${f} 새 구역</b><span class="pc-nbt">조건 핀</span> →` : n ? `새로 들어온 곳 <b>${n}곳</b> →` : `조건 핀 ${CONDS.length}개 보기 →`;
    nb.setAttribute("aria-label", f ? `조건 핀에 새로 들어온 구역 ${f}곳 보기` : n ? `조건 핀에 새로 들어온 곳 ${n}곳 보기` : `조건 핀 ${CONDS.length}개 보기`);
  }
  const newIds = () => [...new Set(condsAll().flatMap((n) => n.add))];
  // 본 적 없는 새 구역만: seen(마지막으로 본 sig)의 '새로 들어온' id 목록을 빼고 센다
  // 알림함(72_inbox)에서 조건 핀 새 구역을 보여 줬을 때: 조건 핀만 '읽음'(핀 소식 배지는 그대로)
  function markCondSeen() { let ch = 0; condsAll().forEach((n) => { if (n.c.seen !== n.sig) { n.c.seen = n.sig; ch = 1; } }); if (ch) { saveC(); badges(); } }
  const freshIds = () => [...new Set(condsAll().flatMap((n) => { const sn = new Set(String(n.c.seen || "").split("/")[0].split(",").filter(Boolean)); return n.add.filter((id) => !sn.has(id)); }))];

  // ---------- 화면 이벤트 ----------
  function onClick(e) {
    const t = e.target.closest && e.target.closest("[data-capply],[data-cedit],[data-cdel],[data-crebase],[data-psort],[data-pedit],[data-pgoal],[data-punpin],#pnCmp,#pnSelX,#pnGo,#pnShare,#pnEmptyGo,#pnCmpX,#pnMove");
    if (!t) return;
    const cf = (id) => CONDS.find((x) => x.id === id);
    if (t.dataset.capply) { const c = cf(t.dataset.capply); if (c) applyCond(c); return; }
    if (t.dataset.cedit) { const c = cf(t.dataset.cedit); if (c) condSheet(c); return; }
    if (t.dataset.cdel) { const c = cf(t.dataset.cdel); CONDS = CONDS.filter((x) => x.id !== t.dataset.cdel); saveC(); renderFav(); badges(); emit(); if (c) toast("조건 핀 지웠어요", "되돌리기", () => { if (CONDS.length < CMAX) { CONDS.push(c); saveC(); renderFav(); badges(); emit(); } }, c.name); return; }
    if (t.dataset.crebase) { const c = cf(t.dataset.crebase); if (c) { c.base = evalCond(c); c.sv = snapVals(c, c.base); c.seen = ""; c.at = Date.now(); saveC(); renderFav(); badges(); emit(); } return; }
    if (t.dataset.psort) { SORT = t.dataset.psort; lsW(SORTK, SORT); renderFav(); return; }
    if (t.dataset.pedit) { EDIT = EDIT === t.dataset.pedit ? "" : t.dataset.pedit; renderFav(); const i = EDIT && $("fvOut").querySelector(`[data-pmemo="${EDIT}"]`); if (i) i.focus(); else { const b = $("fvOut").querySelector(`[data-pedit="${t.dataset.pedit}"]`); b && b.focus(); } return; }
    if (t.dataset.pgoal) { const sp = SNAP[t.dataset.pgoal], r = byId[t.dataset.pgoal]; if (sp && r) { if (!sp.goal) { const nw = needNow(r, modeFor(r)); if (nw != null && nw <= CASH + 1e-9) { renderFav(); return; } } sp.goal = !sp.goal; PEND = 0; saveS(); renderFav(); const b = $("fvOut").querySelector(`[data-pgoal="${t.dataset.pgoal}"]`); b && b.focus(); } return; }
    if (t.dataset.punpin) { PEND = 0; const id = t.dataset.punpin; if (isFav(id)) toggleFav(id); return; }
    // 핀이 딱 2곳이면 고를 것 없이 바로 나란히 보기
    if (t.id === "pnCmp" && FAV.filter((id) => byId[id]).length === 2) { SEL = false; CMPON = true; CMP = FAV.filter((id) => byId[id]); renderFav(); requestAnimationFrame(() => { const h = $("pnCmpT"); if (h) { h.scrollIntoView({ block: "start", behavior: smooth() }); h.focus({ preventScroll: true }); } }); return; }
    if (t.id === "pnCmp") { SEL = true; CMPON = false; CMP = []; renderFav(); const s = $("pnSelX"); s && s.focus(); return; }
    if (t.id === "pnSelX") { SEL = false; renderFav(); const b = $("pnCmp"); b && b.focus(); return; }
    if (t.id === "pnGo") { if (CMP.length < 2) return; SEL = false; CMPON = true; renderFav(); requestAnimationFrame(() => { const h = $("pnCmpT"); if (h) { h.scrollIntoView({ block: "start", behavior: smooth() }); h.focus({ preventScroll: true }); } }); return; }
    if (t.id === "pnCmpX") { CMPON = false; renderFav(); const b = $("pnCmp"); b && b.focus(); return; }
    if (t.id === "pnShare") { shareMap(); return; }
    if (t.id === "pnMove") { const fb = $("pnMoveFb"); moveURL().then((u) => shareLink(u, fb)); return; }
    if (t.id === "pnEmptyGo") { try { SIMPLE.close(); } catch (e2) {} requestAnimationFrame(() => { const m = $("mapTop"); if (m) window.scrollTo({ top: m.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); }); }
  }
  function after() {
    const out = $("fvOut"); if (!out) return;
    const go = $("pnGo"); if (go) { go.disabled = CMP.length < 2; go.textContent = `비교하기 (${CMP.length})`; }
    if ($("pnMove")) moveURL().catch(() => {});   // 미리 만들어 둠 → 누르는 순간 바로 복사(사파리 사용자 동작 제한)
  }
  function init() {
    try { const _tf = toggleFav; toggleFav = function (id) { const was = isFav(id), x = _tf.apply(this, arguments); try { if (!QUIET && isFav(id) !== was) notify(id, !was); } catch (e) {} return x; }; } catch (e) {}
    // '핀 모두 빼기'(앱 본문)도 되돌리기
    document.addEventListener("click", (e) => {
      if (!(e.target.closest && e.target.closest("#fvClear")) || !FAV.length) return;
      const bk = { fav: FAV.slice(), snap: JSON.parse(JSON.stringify(SNAP)) };
      setTimeout(() => toast(`핀 ${bk.fav.length}곳 모두 뺐어요`, "되돌리기", () => { FAV = bk.fav; SNAP = bk.snap; saveFav(); saveS(); syncFav(); toast("다시 꽂았어요"); }), 0);
    }, true);
    try { importIn(); } catch (e) {}
    const out = $("fvOut");
    if (out) {
      out.addEventListener("click", onClick);
      $("pnCmpOut") && $("pnCmpOut").addEventListener("click", onClick);
      out.addEventListener("input", (e) => { const i = e.target.closest && e.target.closest("[data-pmemo]"); if (!i) return; const sp = SNAP[i.dataset.pmemo]; if (sp) { sp.memo = i.value.slice(0, 20).trim(); saveS(); } });
      out.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing && e.target.matches && e.target.matches("[data-pmemo]")) { e.preventDefault(); e.target.blur(); } }, true);
      // 메모 입력 중에 '목표 세우기'·'핀 빼기'를 누르면: 포커스가 빠지며(change) 목록을 다시 그려 버튼이 사라지던 문제.
      // 편집 줄 버튼을 누르는 순간(pointerdown)을 기억해 그때는 다시 그리지 않고, 포커스 이동 자체도 막는다.
      out.addEventListener("pointerdown", (e) => { if (e.target.closest && e.target.closest(".pn-ed button")) PEND = Date.now(); }, true);
      out.addEventListener("mousedown", (e) => { if (e.target.closest && e.target.closest(".pn-ed button") && document.activeElement && document.activeElement.matches && document.activeElement.matches("[data-pmemo]")) e.preventDefault(); }, true);
      out.addEventListener("change", (e) => {
        if (e.target.matches && e.target.matches("[data-pmemo]") && Date.now() - PEND < 1500) return;
        if (e.target.matches && e.target.matches("[data-pmemo]")) { const id = e.target.dataset.pmemo; EDIT = ""; renderFav(); const b = out.querySelector(`[data-pedit="${id}"]`); b && b.focus(); }
        if (e.target.id === "pnMoney") MONEY = e.target.checked;
      });
      // 화면에 보이면 '읽음'(배지 지움). 목록의 '새 소식' 표시는 다음에 다시 그릴 때까지 남는다
      let tm = 0;
      if ("IntersectionObserver" in window) new IntersectionObserver((es) => { es.forEach((x) => { clearTimeout(tm); if (x.isIntersecting && (FAV.length || CONDS.length)) tm = setTimeout(markSeen, 1200); }); }, { threshold: 0.15 }).observe(out);
    }
    // 조건 핀 '홈에 적용': 홈 숫자(okR)·지도·핀이 모두 affOk를 거치므로 여기에 나머지 조건을 덧붙인다
    try {
      const _aff = affOk;
      affOk = function (r) { const ok = _aff.apply(this, arguments); if (!ok || !ACT) return ok; try { return condExtra(ACT, r); } catch (e) { return ok; } };
    } catch (e) {}
    // 적용 뒤 사용자가 유형·구를 직접 바꾸면 그 조건은 풀어 준다(목록 표시와 숫자가 어긋나지 않게)
    document.addEventListener("click", (e) => {
      const b = ACT && e.target.closest && e.target.closest(".s-flt button[data-k]");
      if (b) { ACT.kind = b.dataset.k || ""; actBar(); }
    }, true);
    try { const _xg = exitGu; exitGu = function () { if (ACT && ACT.gu) { ACT.gu = ""; setTimeout(actBar, 0); } return _xg.apply(this, arguments); }; } catch (e) {}
    try { const _rr = renderReport; renderReport = function () { const x = _rr.apply(this, arguments); try { headPin(); } catch (e) {} return x; }; } catch (e) {}
    try { headPin(); } catch (e) {}
    toastWatch();
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
  return { init, zpOk, list, has, on, emit, newIds, conds: () => CONDS.slice(), evalCond, condOk, add, drop, clear, room, feedback, badges, listHTML, emptyHTML, after, cmpShown, markSeen, news, mapCard, unreadN, MAX, condsAll, freshIds, whyNew, markCondSeen, snapT: (id) => (SNAP[id] ? SNAP[id].t : 0) };
})();
window.PINS = { list: PINS.list, has: PINS.has, on: PINS.on, newIds: PINS.newIds };
window.ZP_ok = PINS.zpOk;   // 홈 '살 수 있는 곳' 숫자와 같은 판정(지도 핀·게이지 토스트용)
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", PINS.init) : setTimeout(PINS.init, 0);
