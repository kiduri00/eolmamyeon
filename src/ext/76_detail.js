/* ===================== 구역 상세 첫 화면 · 섹션 탭 · 아래 고정 버튼 · 숫자 신고 (리뉴얼 4단계) =====================
   첫 화면(390×844) 안에: 이름 줄(짧은 이름 · 구 동 · 단계 칩) → 핵심 3숫자(지금 필요한 돈 · 입주까지 현금 · 언제 입주/입주권) → 신뢰 한 줄.
   숫자는 목록 카드와 같은 함수(SIMPLE.zstate)에서, 꼴은 ZF.cash 하나. 정적 /z/<id> 페이지도 같은 이름·같은 값(tools/zpages.py key3).
   그 밖 머리 블록(실거래·노후도·신뢰 상자·진행 단계·작은 지도)은 섹션 탭(돈·일정·거래·입지·규제) 안으로 옮긴다 — 지우지 않는다.
   맨 아래: 출처 · '이 숫자가 틀렸어요'(메일 · 구역 ID 자동) · 면책 한 번. 아래 고정: [♡ 관심 구역에 추가] [공유]. */
const DTL = (() => {
  const MAIL = "choi3kim1@gmail.com";
  const SITE = "https://jaegaebal.alwaysquestions.kr";
  const ok = (v) => v != null && isFinite(v);
  const C = (v) => ZF.cash(v);
  const asOf = () => String(D.upd || D.asOf || "").replace(/-/g, ".");
  const isPC = () => matchMedia("(min-width:981px)").matches;
  const pageOf = (r) => (r.src !== "moa" && !(r.s >= 9 || (r.dn && r.s < 7)) && /^[\w-]+$/.test(r.id) ? `${SITE}/z/${r.id}` : `${SITE}/#${r.id}`);
  const HEART = (on) => `<svg class="dt-ht" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-7.6-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.6 2.6c0 5.5-7.6 10.1-7.6 10.1z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

  // ---------- 핵심 3숫자 ----------
  function nums(r) {
    let z = null; try { z = SIMPLE.zstate(r); } catch (e) {}
    let nt = false; try { nt = noTicket(r); } catch (e) {}
    const done = (() => { try { return isDone(r); } catch (e) { return false; } })();
    const o = { nt, done, moa: r.src === "moa", need: z && ok(z.need) ? z.need : null, total: z && ok(z.total) ? z.total : null, basis: "", alt: "", why2: "" };
    let x = null; try { x = investC(r); } catch (e) {}
    if (o.moa) { o.basis = "모아타운은 사업구역마다 달라요 · 안의 구역을 열어 보세요"; o.why2 = o.basis; return o; }
    if (done) { o.basis = "사업이 끝난 곳이에요 · 일반 아파트 매매"; o.why2 = "새 아파트 입주까지 계산 대상이 아니에요"; return o; }
    if (nt) { o.need = null; o.total = null; o.basis = "지금 사면 입주권이 안 나와 계산하지 않아요"; o.why2 = "새 아파트를 받지 못해 계산 안 해요"; return o; }
    if (gapMode()) {
      let g = null; try { g = gapOf(r); } catch (e) {}
      if (g && g.block && g.block !== "계산 대상 아님") {
        // 전세 끼고는 못 사는 곳: 전세 낀 숫자는 내지 않고(머리 '전세 끼고 사기 불가'와 같은 판정) 대출 끼고 사는 길을 한 줄로 — /z 페이지(zsample.key3)와 같은 글
        o.need = null; o.total = null; o.why2 = "전세 끼고는 계산하지 않아요";
        o.basis = `전세 끼고는 못 사요 · ${String(g.block).replace(/\s*\(.*\)\s*$/, "").replace(/^전세 낀 매수 불가\s*·\s*/, "")}`;
        if (x && ok(x.needBuy) && !r.lc && r.tag !== "mk") o.alt = `대출 끼고 사면 지금 ${C(x.needBuy)}${x.ok ? ` · 입주까지 ${C(x.needTotal)}` : ""}`;
      } else if (!g || g.na || !g.x || !ok(g.x.price)) o.basis = noPriceTxt(r);
      else o.basis = `전세 끼고 · 매수가 ${ZF.manT(g.x.price)} − 전세 ${ZF.manT(g.D)}${g.x.tax >= 0.005 ? " (+취득세)" : ""}`;
    } else if (!x || !ok(x.needBuy)) o.basis = x && x.price == null ? noPriceTxt(r) : "지금 필요한 돈을 계산하지 못했어요";
    else o.basis = x.loanCap >= 0.005 ? `대출 끼고 · 매수가 ${ZF.manT(x.price)} − 대출 ${ZF.manT(x.loanCap)}${x.tax >= 0.005 ? " (+취득세)" : ""}` : `대출 안 나와요 · 매수가 ${ZF.manT(x.price)}${x.tax >= 0.005 ? " (+취득세)" : ""}`;
    if (o.total == null && !o.why2) o.why2 = x && x.price != null ? ZF.noCalcTxt(r, x) : "입주 시점·신축 시세 자료가 부족해요";
    return o;
  }
  // 지금 필요한 돈을 내지 않는 곳(입주권 없음·전세 끼고 불가·매수가 없음): 첫 화면에 참고 시세 한 줄(실거래 탭 큰 숫자와 같은 1년 가운데 값 · /z zsample.ref_price와 같은 규칙)
  function refPrice(r) {
    const t = r.tx || {};
    const L = r.s >= 8 && t.im ? ["입주권 매매", t.im] : t.am && (/재건축/.test(r.k) || (!t.pp && !t.med)) ? ["아파트 매매", t.am] : t.med ? ["빌라 매매", t.med] : t.pp ? ["대지 3.3㎡당", t.pp] : null;
    return L ? `참고 시세 · ${L[0]} 1년 가운데 값 ${ZF.eok(L[1])}` : "";
  }
  const upC = (v) => Math.ceil(v * 100 - 1e-6) / 100;   // 화면 금액(올림)으로 판정 — 목록 '+2,000만'과 같은 셈
  function keyHTML(r) {
    const n = nums(r);
    const v1 = n.need != null ? C(n.need) : "–", v2 = n.total != null ? C(n.total) : "–";
    const fit = n.need != null && upC(n.need) <= CASH + 1e-9;
    const vd1 = n.need == null ? "" : fit ? `<em class="dt-vd ok">✓ 내 돈 ${C(CASH)}으로 가능</em>` : `<em class="dt-vd no">${(SIMPLE.shortTxt ? SIMPLE.shortTxt(n.need).slice(1) : C(n.need - CASH))} 더 필요해요</em>`;
    const sub2 = n.total == null ? esc(n.why2) : upC(n.total) > CASH + 1e-9 ? `내 돈 빼면 <b>${C(n.total - CASH)}</b> 더 필요해요` : `내 돈 ${C(CASH)} 안이에요`;
    let eta = "–"; try { eta = etaShow(r); } catch (e) {}
    return `<section class="dt-k" aria-label="핵심 숫자">
      <div class="dt-i" data-k="now"><span class="dt-l">지금 필요한 돈</span><b class="dt-v">${v1}</b><span class="dt-s">${esc(n.basis)}</span>${n.alt ? `<span class="dt-s dt-alt">${esc(n.alt)}</span>` : n.need == null && !n.moa && !n.done && refPrice(r) ? `<span class="dt-s dt-alt">${esc(refPrice(r))}</span>` : ""}<span class="dt-m">${vd1}<span class="dt-slot" data-slot="gap"></span></span></div>
      <div class="dt-i" data-k="tot"><span class="dt-l">${LBL.cashToMoveIn}</span><b class="dt-v">${v2}</b><span class="dt-s">${sub2}</span></div>
      <div class="dt-i" data-k="eta"><span class="dt-l">언제 입주</span><b class="dt-v dt-eta">${esc(eta)}</b><span class="dt-m"><span class="dt-slot" data-slot="ip"></span></span></div>
    </section>`;
  }
  // ---------- 신뢰 한 줄: 추정 칩 하나 · 표본 · 믿을 만함 › (누르면 '돈' 탭의 '이 숫자 믿어도 될까'로) ----------
  function trustLine(r) {
    const tb = document.getElementById("ovTrust"), lvEl = tb && tb.querySelector(".ov-lv");
    const lv = lvEl ? lvEl.textContent.trim() : "", cls = tb ? (["hi", "md", "lo", "na"].find((c) => tb.classList.contains(c)) || "") : "";
    if (!lv) return "";
    if (cls === "na" || lv === "안 함") {
      let x = null; try { x = investC(r); } catch (e) {}
      let nt = false; try { nt = noTicket(r); } catch (e) {}
      const why = r.src === "moa" ? "모아타운은 사업구역마다 달라요" : nt ? "입주권이 안 나와요" : x && x.stale ? "이주·철거가 시작됐어요" : x && x.noApt ? "단지 거래가 없어요" : "매수가로 쓸 거래가 없어요";
      return `<button type="button" class="dt-trust na" data-dttrust><span class="dt-tc">계산 안 함</span><span class="dt-tt">${esc(why)} · 이유 보기</span><i aria-hidden="true">›</i></button>`;
    }
    let est = false; try { est = isEst(r); } catch (e) {}
    let x = null; try { x = investC(r); } catch (e) {}
    const en = (r.mk && r.mk.entry) || {};
    const basis = x && x.priceSrc === "user" && !est ? "내가 넣은 매수가 기준"
      : est ? `같은 구(${r.g}) 빌라 시세 기준`
      : en.n ? `${en.src === "complex" ? (en.fill === "zoneapt" ? "구역 안 아파트" : "단지") : en.fill === "dong" ? "같은 동 빌라" : en.radius ? "주변 빌라" : en.m === "jibun" ? "같은 본번 빌라" : "구역 안 빌라"} ${en.n}건 기준` : "실거래 기준";
    return `<button type="button" class="dt-trust ${cls}" data-dttrust><span class="dt-tc">추정</span><span class="dt-tt">${esc(basis)} · 믿을 만함: <b>${esc(lv)}</b></span><i aria-hidden="true">›</i></button>`;
  }
  function toTrust() {
    const go = () => { const t = document.getElementById("ovTrust"); if (!t) return; t.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" }); t.classList.remove("dt-flash"); void t.offsetWidth; t.classList.add("dt-flash"); };
    if (curTab !== "money") { setTab("money"); requestAnimationFrame(() => requestAnimationFrame(go)); } else go();
  }

  // ---------- 머리 정리 ----------
  function decorate() {
    const r = cur, rp = $("report"); if (!r || !rp) return;
    const head = rp.querySelector(".rep-head"); if (!head || head.querySelector(".dt-k")) return;
    const w = document.getElementById("ovTop");
    rp.classList.add("dt");
    // 판정 칩(누르면 한 줄 이유 · 64_overview vdBind가 붙인 그대로 옮긴다)
    const vds = w ? [...w.querySelectorAll(".ov-vd .ov-p")] : [];
    const by = (re) => vds.find((b) => re.test((b.querySelector("span") || {}).textContent || ""));
    const bIp = by(/입주권/), bGap = by(/전세 끼고/), bSt = vds.find((b) => b.classList.contains("st"));
    // 이름 줄: 구 동 · 단계 칩 · 역 도보 · 경사
    const wh = head.querySelector(".where");
    if (wh && bSt) { bSt.classList.add("dt-stg"); const b0 = wh.querySelector("b"); b0 ? b0.after(bSt) : wh.prepend(bSt); }
    const wa = w && w.querySelector(".ov-wa"); if (wa && wh) wh.after(wa);
    // 핵심 3숫자 + 신뢰 한 줄
    const box = document.createElement("div"); box.className = "dt-top";
    box.innerHTML = keyHTML(r);
    (wa || wh || head.querySelector(".rep-t")).after(box);
    if (bIp) { const s = bIp.querySelector("span"); if (s) s.textContent = "입주권"; bIp.classList.add("dt-ip"); box.querySelector('[data-slot="ip"]').appendChild(bIp); }
    if (bGap) { bGap.classList.add("dt-gap"); box.querySelector('[data-slot="gap"]').appendChild(bGap); }
    const why = w && w.querySelector(".ov-vdw .ov-why"); if (why) box.querySelector(".dt-k").after(why);
    const noip = w && w.querySelector(".ov-noip"); if (noip) box.appendChild(noip);
    const risk = head.querySelector(".lb-risk"); if (risk) box.appendChild(risk);
    box.insertAdjacentHTML("beforeend", trustLine(r));
    // 첫 화면에서 내리는 것: 입지 점수(입지 탭 맨 위에 있음) · 머리 현금 띠(3숫자와 같은 값) · 공식 이름(맨 아래 출처로) · 판정 줄 자리
    head.querySelectorAll(".rep-t > .gb, .cstrip, .hjsum").forEach((e) => e.classList.add("dt-hide"));
    const vdw = w && w.querySelector(".ov-vdw"); if (vdw) vdw.remove();
    const mp = w && w.querySelector("#ovMap"); if (mp) mp.remove();
    if (w) { w.hidden = true; w.classList.add("dt-hold"); held = {}; SELS.forEach((q) => { const n = w.querySelector(q); if (n) held[q] = n; }); }
    mapBox = null; mapId = null;
    // 아래 고정 버튼: 관심 구역 · 공유(옛 머리 버튼 줄을 옮김 — 이벤트 그대로) · 시트 머리 핀 버튼은 뺀다(관심 버튼은 하나만)
    rp.querySelectorAll(".pn-hpin").forEach((b) => b.remove());
    const acts = head.querySelector(".rep-acts");
    let bar = rp.querySelector(".dt-bar");
    if (!bar) { bar = document.createElement("div"); bar.className = "dt-bar"; rp.appendChild(bar); }
    const fav = acts && acts.querySelector("[data-fav]"), sh = $("zoneShare"), fb = $("zoneShareFb");
    if (fav) { fav.className = "favb dt-fav"; bar.appendChild(fav); favPaint(); }
    if (sh) { sh.className = "btn secondary dt-share"; sh.textContent = "공유"; bar.appendChild(sh); }
    if (fb) bar.appendChild(fb);
    const card = acts && acts.querySelector(".x-card");
    if (acts) acts.classList.add("dt-hide");
    // 맨 아래: 출처 · 공식 이름 · 신고 · 이미지 · 면책(한 번)
    let end = rp.querySelector(".dt-end");
    if (!end) { end = document.createElement("div"); end.className = "dt-end"; const pane = $("pane"), gate = rp.querySelector(".rep-gate"); (pane || gate || head).after(end); }
    end.innerHTML = `<div class="dt-src"></div><div class="dt-acts"><button type="button" class="btn secondary dt-rep" data-dtrep>이 숫자가 틀렸어요</button></div><p class="dt-disc">숫자는 공개 실거래와 기본 가정(시세 상승 0% 등)으로 낸 추정이에요. 투자 권유가 아니에요. 입주권 자격·토지거래허가는 계약 전에 조합·구청에서 꼭 확인하세요.</p>`;
    const src = w && w.querySelector(".ov-srcw"); if (src) end.querySelector(".dt-src").appendChild(src);
    const fm = head.querySelector(".ov-formal") || head.querySelector(".formal"); if (fm) { fm.classList.add("dt-fm"); end.querySelector(".dt-src").appendChild(fm); }
    if (card) { card.className = "btn secondary dt-card"; card.textContent = "공유 이미지 저장하기"; end.querySelector(".dt-acts").appendChild(card); }
    place();
  }
  // 관심 버튼 글자·아이콘(목록 ♡와 같은 하트) — syncFav가 [data-fav]를 다시 그린 뒤에도
  function favPaint() {
    document.querySelectorAll("#report .dt-fav[data-fav]").forEach((b) => {
      const on = isFav(b.dataset.fav), r = byId[b.dataset.fav];
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", `${r ? shortName(r.n) : ""} ${on ? "관심 구역에서 빼기" : "관심 구역에 추가하기"}`);
      const t = on ? "관심 구역에 있어요" : "관심 구역에 추가";
      const ht = b.querySelector(".dt-ht");
      if (b.textContent !== t || !ht || (ht.querySelector("path").getAttribute("fill") !== "none") !== on) b.innerHTML = `${HEART(on)}<span>${t}</span>`;
    });
  }

  // ---------- 머리 블록을 섹션(탭) 안으로 ----------
  // 돈: 맨 아래 '이 숫자 믿어도 될까' · 일정: 맨 위 진행 단계 + 노후도 · 거래: 맨 위 실거래 카드 · 입지: 맨 위 작은 지도(폰)
  // 탭 내용(#pane)은 여러 길(자료 도착·숫자 바꿔 보기)로 통째 다시 그려지므로, 옮긴 블록은 참조로 들고 있다가 빠지면 다시 끼운다.
  // 지금 탭이 아닌 블록은 머리 보관함(.ov-top, 숨김)에 둔다 — 64_overview가 늦게 오는 자료로 그 블록을 고칠 수 있게.
  const SLOT = { money: [".ov-trw"], biz: [".ov-tlw", ".ov-oldw"], tx: [".ov-txw"] };
  const SELS = [".ov-trw", ".ov-tlw", ".ov-oldw", ".ov-txw"];
  let held = {}, mapBox = null, mapId = null, busy = false;
  function place() {
    const w = document.getElementById("ovTop"), p = $("pane"), r = cur; if (!w || !p || !r || busy) return;
    busy = true;
    try {
      const want = SLOT[curTab] || [];
      SELS.forEach((s) => { const n = held[s]; if (n && !want.includes(s) && n.parentElement !== w) w.appendChild(n); });
      const need = want.map((s) => held[s]).filter((n) => n && n.textContent.trim());
      let pv = p.querySelector(":scope > .dt-pv:not(.dt-map)");
      if (need.length) {
        if (!pv) { pv = document.createElement("div"); pv.className = "dt-pv"; }
        need.forEach((n, i) => { if (pv.children[i] !== n) pv.insertBefore(n, pv.children[i] || null); });
        if (curTab === "money") { if (p.lastElementChild !== pv) p.appendChild(pv); }
        else if (p.firstElementChild !== pv) p.prepend(pv);
      } else if (pv) pv.remove();
      // 입지: 작은 지도(폰만 · PC는 옆 큰 지도) — 한 번 그린 그림을 다시 쓴다
      const mp = p.querySelector(":scope > .dt-map");
      if (curTab === "loc" && !isPC()) {
        if (!mapBox || mapId !== r.id) { mapBox = document.createElement("div"); mapBox.className = "dt-pv dt-map"; mapBox.innerHTML = `<div class="ov-map" id="ovMap" role="img" aria-label="${esc(shortName(r.n))} 위치"></div>`; mapId = r.id; p.prepend(mapBox); try { OVX.mini(r); } catch (e) {} }
        else if (p.firstElementChild !== mapBox) p.prepend(mapBox);
      } else if (mp) mp.remove();
      plain(rp0());
    } finally { busy = false; }
  }
  const rp0 = () => document.getElementById("report");

  // ---------- 전문용어 풀어 쓰기: 화면에 처음 보이는 '권리가액'·'프리미엄'은 '내 지분 값(권리가액)'·'웃돈(프리미엄)', 그 뒤는 쉬운 말만 ----------
  const JARGON = [[/내 지분 값\(권리가액\)|권리가액/g, "내 지분 값(권리가액)", "내 지분 값"], [/웃돈\(프리미엄\)|프리미엄/g, "웃돈(프리미엄)", "웃돈"]];
  function plain(root) {
    if (!root) return;
    const vis = (n) => { const e = n.parentElement; if (!e) return false; try { return e.checkVisibility ? e.checkVisibility() : !!e.offsetParent; } catch (er) { return true; } };
    const seen = JARGON.map(() => false), tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const t = n.data; if (!/권리가액|프리미엄/.test(t)) continue;
      if (n.parentElement && n.parentElement.closest("input,textarea,script,style")) continue;
      const v = vis(n); let out = t;
      JARGON.forEach(([re, full, easy], i) => { out = out.replace(re, () => { if (v && !seen[i]) { seen[i] = true; return full; } return easy; }); });
      if (out !== t) n.data = out;
    }
  }

  // ---------- '이 숫자가 틀렸어요' 시트 ----------
  const REASONS = [["price", "가격", "지금 필요한 돈·입주까지 현금·시세가 이상해요"], ["stage", "단계", "진행 단계·날짜가 달라요"], ["loc", "위치", "경계·주소·역 거리가 달라요"], ["name", "이름", "구역 이름이 달라요"], ["etc", "기타", "그 밖의 것"]];
  let lastFocus = null;
  function mailto(r, why, txt) {
    const n = nums(r), subj = `[집핀 신고] ${r.id} ${shortName(r.n)}`;
    const body = [`구역 ID: ${r.id}`, `구역: ${shortName(r.n)} (${r.g})`, `주소: ${pageOf(r)}`, `데이터 기준: ${asOf()}`, `틀린 곳: ${why}`,
      `화면 숫자: 지금 필요한 돈 ${n.need != null ? C(n.need) : "–"} · ${LBL.cashToMoveIn} ${n.total != null ? C(n.total) : "–"} (${gapMode() ? LBL.gap : LBL.loan} · 내 돈 ${C(CASH)})`,
      "", "내용:", txt || "(적지 않음)"].join("\n");
    return `mailto:${MAIL}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  }
  function repOpen() {
    const r = cur; if (!r) return;
    lastFocus = document.activeElement;
    let s = $("dtRep");
    if (s) s.remove();
    s = document.createElement("div"); s.id = "dtRep"; s.className = "dt-rs"; s.setAttribute("role", "dialog"); s.setAttribute("aria-modal", "true"); s.setAttribute("aria-labelledby", "dtRepT");
    s.innerHTML = `<div class="dt-rs-bg" data-dtx></div><div class="dt-rs-in"><i class="dt-rs-h" aria-hidden="true"></i>
      <h3 id="dtRepT">이 숫자가 틀렸어요</h3><p class="dt-rs-z">${esc(shortName(r.n))} · 구역 ID <b>${esc(r.id)}</b> · ${asOf()} 기준</p>
      <fieldset class="dt-rs-r"><legend>어디가 틀렸나요</legend>${REASONS.map(([k, t, d], i) => `<label><input type="radio" name="dtWhy" value="${k}"${i ? "" : " checked"}><span><b>${t}</b><small>${d}</small></span></label>`).join("")}</fieldset>
      <label class="dt-rs-t"><span>무엇이 다른지 적어 주세요 <small>(안 적어도 돼요)</small></span><textarea id="dtRepTx" rows="3" maxlength="600" placeholder="예: 최근 매물은 1.4억이에요"></textarea></label>
      <a class="btn primary dt-rs-go" id="dtRepGo" href="#">메일로 보내기</a>
      <p class="dt-rs-ok" id="dtRepOk" role="status" hidden><b>고마워요. 확인 후 반영할게요</b><span>답은 보내 주신 메일 주소로 드려요.</span></p>
      <div class="dt-rs-ad"><label for="dtRepAd">메일 앱이 안 열리면 이 주소로 보내 주세요</label><div><input id="dtRepAd" readonly value="${MAIL}"><button type="button" class="btn secondary sm" id="dtRepCp">주소 복사</button></div></div>
      <button type="button" class="btn ghost dt-rs-x" data-dtx>닫기</button></div>`;
    document.body.appendChild(s);
    document.documentElement.classList.add("dt-rs-on");
    const go = $("dtRepGo"), tx = $("dtRepTx");
    const upd = () => { const k = (s.querySelector("input[name=dtWhy]:checked") || {}).value || "etc", R0 = REASONS.find((x) => x[0] === k) || REASONS[4]; go.href = mailto(r, `${R0[1]} (${R0[2]})`, tx.value.trim()); };
    s.addEventListener("change", upd); tx.addEventListener("input", upd); upd();
    go.addEventListener("click", () => { upd(); setTimeout(() => { const o = $("dtRepOk"); if (o) o.hidden = false; go.textContent = "메일 다시 열기"; }, 250); });
    $("dtRepCp").onclick = async () => { const i = $("dtRepAd"); let done = false; try { await navigator.clipboard.writeText(MAIL); done = true; } catch (e) { try { i.select(); done = document.execCommand("copy"); } catch (er) {} } $("dtRepCp").textContent = done ? "복사했어요" : "주소를 길게 눌러 복사"; };
    s.addEventListener("click", (e) => { if (e.target.closest("[data-dtx]")) repClose(); });
    s.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); repClose(); } });
    requestAnimationFrame(() => { const f = s.querySelector("input[name=dtWhy]:checked"); if (f) f.focus({ preventScroll: true }); });
  }
  function repClose() {
    const s = $("dtRep"); if (s) s.remove();
    document.documentElement.classList.remove("dt-rs-on");
    if (lastFocus && lastFocus.isConnected) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }

  function init() {
    // 탭: '호재'(near)는 '입지' 아래에 이어 붙인다 — 옛 링크·버튼이 near를 불러도 입지 탭으로
    const _rp = renderPane;
    renderPane = function () {
      if (curTab === "near") curTab = "loc";
      const x = _rp.apply(this, arguments);
      try {
        const p = $("pane");
        if (p && cur && curTab === "loc" && (cur._prem || !FREE || !PREM_TABS.has("near"))) {
          const sub = document.createElement("div"); sub.className = "dt-near"; p.appendChild(sub);
          p.id = "paneLoc0"; sub.id = "pane"; curTab = "near";
          try { _rp.apply(this, arguments); } finally { curTab = "loc"; sub.id = "dtNear"; p.id = "pane"; }
        }
      } catch (e) { console.warn(e); }
      try { place(); } catch (e) { console.warn(e); }
      return x;
    };
    const _st = setTab;
    setTab = function (k) {
      if (k === "near") { _st("loc"); requestAnimationFrame(() => { const n = $("dtNear"); if (n) n.scrollIntoView({ block: "start", behavior: "auto" }); }); return; }
      return _st(k);
    };
    try { new MutationObserver(() => { if (!busy && cur) place(); }).observe($("report"), { childList: true, subtree: true }); } catch (e) {}
    const _rr = renderReport;
    renderReport = function () { const x = _rr.apply(this, arguments); try { decorate(); } catch (e) { console.warn(e); } return x; };
    const _sf = syncFav;
    syncFav = function () { const x = _sf.apply(this, arguments); try { favPaint(); } catch (e) {} return x; };
    addEventListener("pins:change", () => { try { favPaint(); } catch (e) {} });
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("#report [data-dttrust]")) { e.preventDefault(); toTrust(); return; }
      if (t.closest("#report [data-dtrep]")) { e.preventDefault(); repOpen(); return; }
      // 옮긴 블록 안의 '거래 전체 보기 →'·'항목별 점수 →'·'근거 보기 ↓'(64_overview는 머리 상자 안 클릭만 받는다)
      const ob = t.closest("#report [data-tab]:not([role=tab]), #report [data-ovtrust]");
      if (ob && !ob.closest(".ov-top")) { e.preventDefault(); if (ob.dataset.ovtrust != null) toTrust(); else setTab(ob.dataset.tab); }
    });
    try { if (cur && document.querySelector("#report .rep-head")) decorate(); } catch (e) {}
  }
  return { init, nums, repOpen, repClose, mailto };
})();
window.ZP_detail = DTL;   // 점검(QA): 첫 화면 숫자·신고 메일 주소
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", DTL.init) : setTimeout(DTL.init, 0);
