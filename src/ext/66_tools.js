/* ===================== 더 알아보기 도구(경쟁 서비스 조사 반영) =====================
   갭 순위(아실 갭투자) · 매물진단(재개발뷰) · 입주 물량(부동산지인·아실)
   섹션은 SIMPLE.init 전에 만들어 두어야 '지도로' 버튼·열기 동작이 붙는다. */
const TOOLS = (() => {
  const mk = (id, title) => {
    if (document.getElementById(id)) return;
    const s = document.createElement("section");
    s.className = "sec tool"; s.id = id;
    s.innerHTML = `<div class="sec-h"><div><h2>${title}</h2></div></div><div class="panel tpanel"><div class="t-out" id="${id}Out"></div></div>`;
    const ref = document.getElementById("ntcTop") || document.getElementById("favTop");
    ref ? ref.after(s) : document.querySelector("main")?.appendChild(s);
  };
  mk("gapTop", "갭 순위");
  mk("diagTop", "매물진단");
  mk("supplyTop", "입주 물량");
  const e1 = (v) => (v == null || !isFinite(v) ? "–" : v < 0.05 ? "0원" : `${(Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "")}억`);
  const ok = (r) => !(r.s >= 9) && !r.dn && !r.cx && r.src !== "moa" && !r.lc && r.tag !== "mk";
  // ---------- 갭 순위: 전세 끼고 지금 필요한 돈이 적은 순 ----------
  let gapF = "all", gapN = 20;
  function gapRender() {
    const out = document.getElementById("gapTopOut"); if (!out) return;
    const L = R.filter(ok).map((r) => ({ r, g: gapOf(r) })).filter((x) => !x.g.block && !x.g.na && x.g.now != null && isFinite(x.g.now));
    const c = CASH;
    const F = gapF === "near" ? L.filter((x) => Math.abs(x.g.now - c) <= 1) : gapF === "redev" ? L.filter((x) => !/재건축/.test(x.r.k)) : L;
    F.sort((a, b) => a.g.now - b.g.now);
    { const seen = new Set(); for (let i = F.length - 1; i >= 0; i--) {} const U = []; F.forEach((x) => { const k = shortName(x.r.n) + x.r.g; if (!seen.has(k)) { seen.add(k); U.push(x); } }); F.length = 0; U.forEach((x) => F.push(x)); }
    const rate = (x) => { try { const p = investC(x.r).price; return p ? Math.round((x.g.D / p) * 100) : null; } catch (e) { return null; } };
    out.innerHTML = `<div class="fchips tl-f" role="group" aria-label="거르기">${[["all", "전체"], ["near", `내 현금 ${e1(c)} ±1억`], ["redev", "재개발만"]].map(([k, t]) => `<button type="button" class="ichip" data-gf="${k}" aria-pressed="${gapF === k}">${t}</button>`).join("")}</div>
      <ol class="tl-l">${F.slice(0, gapN).map((x, i) => { const jr = rate(x); return `<li><a href="#${x.r.id}" data-id="${x.r.id}"><span class="tl-k">${i + 1}</span><span class="tl-n"><b>${esc(shortName(x.r.n))}</b><small>${esc(x.r.g)} · ${esc(stageName(x.r))}</small></span><span class="tl-v"><b>${e1(x.g.now)}</b><small>${x.g.x && x.g.x.ok && x.g.total != null ? `입주까지 ${e1(x.g.total)}` : '<span class="tl-na" title="주변 신축 시세 자료가 없어 입주 때 돈을 계산하지 못했어요">계산 불가 · 신축 시세 없음</span>'}</small></span></a></li>`; }).join("") || '<li class="tl-e">조건에 맞는 구역이 없어요</li>'}</ol>
      ${F.length > gapN ? `<button type="button" class="btn secondary s-more" id="gapMore">더 보기 (${F.length - gapN}곳)</button>` : ""}`;
    out.querySelectorAll("[data-gf]").forEach((b) => (b.onclick = () => { gapF = b.dataset.gf; gapN = 20; gapRender(); }));
    const m = document.getElementById("gapMore"); if (m) m.onclick = () => { gapN += 20; gapRender(); };
  }
  // ---------- 매물진단: 이 구역 매물 사도 입주권이 나오나 ----------
  let dSel = null;
  function diagRender() {
    const out = document.getElementById("diagTopOut"); if (!out) return;
    out.innerHTML = `<p class="tl-lead">구역을 고르면 지금 사도 입주권이 나오는지, 막히는 규정이 있는지 한 번에 봐요.</p><label class="tl-q"><span>구역 이름</span><input id="dgQ" type="search" placeholder="예: 미아11, 봉천14" autocomplete="off"></label><ul class="tl-s" id="dgS"></ul><div id="dgR"></div>`;
    const q = document.getElementById("dgQ"), sl = document.getElementById("dgS");
    q.oninput = () => {
      const v = q.value.replace(/\s/g, ""); if (!v) { sl.innerHTML = ""; return; }
      const hits = R.filter((r) => r.src !== "moa" && !(r.s >= 9) && (shortName(r.n).replace(/\s/g, "").includes(v) || (r.n || "").replace(/\s/g, "").includes(v))).slice(0, 8);
      sl.innerHTML = hits.map((r) => `<li><button type="button" data-d="${r.id}">${esc(shortName(r.n))}<small>${esc(r.g)} · ${esc(stageName(r))}</small></button></li>`).join("") || '<li class="tl-e">찾는 구역이 없어요</li>';
      sl.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => { dSel = byId[b.dataset.d]; sl.innerHTML = ""; q.value = shortName(dSel.n); diagShow(); }));
    };
    // 처음 열면 빈 화면 대신 예시 구역을 보여 준다
    let ex = false;
    if (!dSel) {
      const pick = (t) => R.find((r) => r.src !== "moa" && !(r.s >= 9) && !r.dn && shortName(r.n).replace(/\s/g, "") === t);
      dSel = pick("한남3구역") || pick("성수1지구") || R.filter((r) => r.tx && r.tx.n3 && !(r.s >= 9) && r.src !== "moa").sort((a, b) => b.tx.n3 - a.tx.n3)[0] || null;
      ex = !!dSel;
    }
    if (dSel) { q.value = shortName(dSel.n); diagShow(ex); }
    q.addEventListener("focus", () => { if (ex) { q.select(); } }, { once: true });
  }
  function diagShow(ex) {
    const r = dSel, box = document.getElementById("dgR"); if (!r || !box) return;
    const items = [];
    const w = buyWindow(r);
    items.push([w.cls === "ok" ? "ok" : w.cls === "no" ? "no" : "warn", "입주권", w.t + (w.due ? ` · ${w.due}` : "")]);
    // 토허: 서울 전역(아파트)·신통·구역 안 허가 기록·구 단위 기록까지 본 뒤에만 말한다(56_toheo.js). 허가 자료가 오면 다시 그림
    let th = null;
    try { th = TOH.lookup(r); } catch (e) {}
    if (th) items.push([th.cls, "토지거래허가", th.t]);
    else { const lp = landPermit(r); items.push([lp ? "no" : "warn", "토지거래허가", lp ? lp.t : "허가 기록 불러오는 중 · 계약 전 구청 확인"]); }
    try { if (!TOH.loaded()) TOH.load().then(() => { if (dSel === r) diagShow(ex); }); } catch (e) {}
    try { const rt = ZX.rights(r); items.push([rt.k === "set" ? (rt.c === "low" ? "warn" : "ok") : "warn", "권리산정기준일", rt.k === "set" ? `${rt.d} 전 준공·등기 건물만 단독 입주권${rt.c === "low" ? " · 추정이라 확인 필요" : ""}` : rt.k === "chg" ? "확인 필요 · 등록된 구역지정일이 변경 지정일이라 추정하지 않아요" : "날짜 미확정 · 구청 확인"]); } catch (e) {}
    items.push(["warn", "여러 채 보유", "한 구역에 여러 채면 입주권 1개만(다물권) · 세대원 합산"]);
    items.push(["warn", "재당첨 제한", "투기과열지구 조합원 분양을 5년 안에 받았으면 제한"]);
    if (/재건축/.test(r.k) && r.s >= 4) items.push(["warn", "조합원 지위양도", "조합설립인가 뒤 매수는 원칙적으로 조합원 지위 승계 불가(예외 매물만)"]);
    box.innerHTML = `${ex ? '<p class="dg-ex">예시로 한 곳을 보여 드려요 · 구역 이름으로 다른 곳을 찾아 보세요</p>' : ""}<div class="dg-h"><b>${esc(shortName(r.n))}</b><span>${esc(r.g)} · ${esc(stageName(r))}</span><button type="button" class="btn text sm" data-open="${r.id}">구역 보기 →</button></div>
      <ul class="dg-l">${items.map(([c, k, v]) => `<li class="${c}"><i aria-hidden="true">${c === "ok" ? "✓" : c === "no" ? "✕" : c === "na" ? "?" : "!"}</i><span><b>${k}</b><small>${esc(v)}</small></span></li>`).join("")}</ul>`;
    box.querySelector("[data-open]").onclick = () => { curTab = "money"; select(r.id, true, false, { scroll: true }); };
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
      <div class="sp-hb" role="list">${ys.map((y) => `<button type="button" role="listitem" class="sp-r${y > now ? " est" : ""}" data-y="${y}" aria-label="${y}년 ${y > now ? "추정 " : ""}약 ${fmt(Y[y].n)}세대"${Y[y].n ? "" : " disabled"}><span class="sp-y">${y}${y > now ? "<small>추정</small>" : "<small>올해</small>"}</span><span class="sp-t"><i style="width:${Y[y].n ? Math.max(2, Math.round((Y[y].n / mx) * 100)) : 0}%"></i></span><b>${Y[y].n ? "약 " + fmt(Y[y].n) + "세대" : "–"}</b></button>`).join("")}</div>
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
  return { init };
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
    if (box.querySelector(".s-rail")) return true;
    if (!p.querySelector("input[type=checkbox]")) return false;
    document.querySelectorAll(".s-lyr").forEach((x) => x.remove());
    const chk = (k) => p.querySelector(`input[value="${k}"]`);
    const btn = (k) => { const c = chk(k); return c ? `<button type="button" data-l="${k}" aria-pressed="${c.checked}" aria-label="${NM[k]} 겹쳐 보기">${IC[k]}<span>${NM[k]}</span></button>` : ""; };
    const w = document.createElement("div");
    w.className = "s-rail-w";
    w.innerHTML = `<div class="s-rail" role="group" aria-label="지도에 겹쳐 보기">${MAIN.map(btn).join("")}</div><div class="s-fly" role="group" aria-label="겹쳐 보기 더보기" hidden>${EXTRA.map(btn).join("")}</div><span class="s-tip" aria-live="polite"></span>`;
    // 탭 순서: 겹쳐 보기 레일 → 확대·축소 → 지도(레일을 지도 앞에 둔다. 겹침 순서는 z-index로)
    const lm = box.querySelector("#lmap");
    lm ? box.insertBefore(w, lm) : box.appendChild(w);
    const fly = w.querySelector(".s-fly"), more = null, tip = w.querySelector(".s-tip");
    const dot = () => {};
    let tt = 0;
    w.addEventListener("click", (e) => {
      
      const b = e.target.closest("button[data-l]"); if (!b) return;
      const c = chk(b.dataset.l); if (!c) return;
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
