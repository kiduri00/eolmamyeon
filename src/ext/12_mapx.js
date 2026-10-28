  /* ===================== 사이클 4(M): 새 지도 조작부 · 내 돈 다이얼 · 다음 문턱 · 갈 수 있는 곳만 · N년 뒤 =====================
     SPEC_C4_DESIGN C5(한 손 조작부)·E(A·B·C·D). 전체 지도(html.s-full · 웹 /#map · 앱 지도 탭)에서만 보인다.
     · 위: 검색 한 줄(48px) + 레이어 6칸(기존 .s-rail 단추 그대로 · CSS로 격자) + 칩 줄(← 뒤로 · 세는 범위 · 다음 문턱 · 갈 수 있는 곳만 · N년 뒤)
     · 아래: 내 돈 막대(기존 #sMini를 다시 꾸밈: '내 돈 2억 ▾'(누르면 다이얼) · 전세 끼고/대출 끼고 · '서울 갈 수 있는 곳 54곳'(누르면 목록)) + 둥근 단추(현재 위치 · 구 이동)
     숫자는 모두 앱 함수(ZP_count · SIMPLE.guCounts·guCount · SIMPLE.zstate · ZF.cash)에서 — 지도에서 따로 세지 않는다. */
  const MXU = (() => {
    const H = document.documentElement;
    const fmtN = (n) => Number(n || 0).toLocaleString("ko-KR");
    const esc2 = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const IC = {
      search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
      loc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>',
      gu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z"/><path d="M9 4.5v13M15 6.5v13"/></svg>',
      down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
      back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
      check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    };
    let built = false, top = null, chips = null, fabs = null, dial = null, gus = null, cashB = null, cntB = null;
    const view = () => { try { return { v: mapView, g: mapGu || "" }; } catch (e) { return { v: "seoul", g: "" }; } };
    const guNow = () => { const g = (LMX.gu && LMX.gu()) || (view().v === "gu" ? view().g : ""); return g || ""; };
    const cntAll = (c) => { try { return window.ZP_count(c); } catch (e) { return 0; } };
    // 그 구 목록 곳 수(목록 머리 'OO구 · N곳'과 같은 함수 SIMPLE.guCount) · 금액 c에서 셀 때는 앱의 CASH를 잠깐 바꿔 같은 함수로(ZP_count와 같은 방식)
    const cntGu = (g, c) => { if (!g) return 0; if (c == null) { try { return SIMPLE.guCount(g); } catch (e) { return 0; } } const save = CASH; try { CASH = c; return SIMPLE.guCount(g); } catch (e) { return 0; } finally { CASH = save; } };
    const step = 0.5;   // 다음 문턱 = +5,000만(SPEC E-B)
    function build() {
      if (built) return; const box = $("mapbox"); if (!box) return;
      built = true; H.classList.add("mx");
      top = document.createElement("div"); top.className = "mx-top";
      top.innerHTML = `<button type="button" class="mx-q" aria-label="구역·동·지번·역 검색"><i class="mx-mark" aria-hidden="true"></i><span>구역·동·지번·역 검색</span>${IC.search}</button>`;
      top.querySelector(".mx-q").onclick = () => { const b = $("sSearch"); if (b) b.click(); };
      box.appendChild(top);
      chips = document.createElement("div"); chips.className = "mx-chips"; chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "지도 보기");
      box.appendChild(chips);
      chips.addEventListener("click", onChip);
      fabs = document.createElement("div"); fabs.className = "mx-fabs";
      fabs.innerHTML = `<button type="button" class="mx-fab" data-mx="loc" aria-label="현재 위치로">${IC.loc}</button><button type="button" class="mx-fab" data-mx="gus" aria-haspopup="dialog" aria-label="구 이동">${IC.gu}<span>구 이동</span></button>`;
      fabs.addEventListener("click", (e) => { const b = e.target.closest("[data-mx]"); if (!b) return; if (b.dataset.mx === "loc") locate(b); else gusOpen(); });
      box.appendChild(fabs);
      // 아래 내 돈 막대: 기존 #sMini 안에 단추 두 개를 더하고(금액 → 다이얼 · 곳 수 → 목록) 끄는 막대는 숨긴다(CSS)
      const mini = $("sMini");
      if (mini) {
        cashB = document.createElement("button"); cashB.type = "button"; cashB.className = "mx-cash"; cashB.setAttribute("aria-haspopup", "dialog");
        cashB.onclick = () => dialOpen("cash");
        cntB = document.createElement("button"); cntB.type = "button"; cntB.className = "mx-cnt";
        cntB.onclick = () => { const x = $("sFullX"); if (x) x.click(); };
        mini.insertBefore(cashB, mini.firstChild); mini.appendChild(cntB);
        try { new MutationObserver(() => paintBar()).observe(mini, { subtree: true, childList: true, characterData: true }); } catch (e) {}
      }
      ["zp:maplayout", "zp:mapfocus", "zp:mapready", "resize", "zp:filter"].forEach((t) => addEventListener(t, () => sched()));
      try { new MutationObserver(() => sched()).observe(H, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
      try { const mb = $("mapbox"); new MutationObserver(() => sched()).observe(mb, { attributes: true, attributeFilter: ["data-view", "data-gu"] }); } catch (e) {}
      paint();
    }
    let schT = 0; const sched = () => { if (schT) return; schT = requestAnimationFrame(() => { schT = 0; paint(); }); };
    function paintBar() {
      if (!cashB || !cntB) return;
      const v = ($("sMiniV") && $("sMiniV").textContent) || "", n = ($("sMiniN") && $("sMiniN").textContent) || "0";
      const h1 = `<small>내 돈</small><b>${esc2(v)}${IC.down}</b>`;
      if (cashB.dataset.h !== h1) { cashB.dataset.h = h1; cashB.innerHTML = h1; cashB.setAttribute("aria-label", `내 돈 ${v} · 눌러서 다이얼로 바꾸기`); }
      // 세는 범위를 이름으로 밝힌다(SPEC D5 · 목록 머리와 같은 숫자 #sMiniN): 구 안이면 'OO구 갈 수 있는 곳'
      const g = guNow(), sc = g || "서울";
      const h2 = g ? `<small>${esc2(g)}</small><b>${esc2(n)}곳</b>` : `<small>서울 갈 수 있는 곳</small><b>${esc2(n)}곳</b>`;
      if (cntB.dataset.h !== h2) { cntB.dataset.h = h2; cntB.innerHTML = h2; cntB.setAttribute("aria-label", `${sc} 갈 수 있는 곳 ${n}곳 · 눌러서 목록 보기`); }
    }
    // 칩 줄: 지금 단계(서울·구·고른 곳)에 따라
    function paint() {
      if (!built) return;
      paintBar();
      const full = H.classList.contains("s-full");
      if (!full) return;
      { const nv = $("sNav"), hN = nv && nv.offsetHeight && getComputedStyle(nv).position === "fixed" && nv.getBoundingClientRect().top > innerHeight / 2 ? Math.round(innerHeight - nv.getBoundingClientRect().top) : 0; const hv = hN + "px"; if (H.style.getPropertyValue("--mx-nav") !== hv) H.style.setProperty("--mx-nav", hv); }   // 아래 탭바 실제 높이(앱·웹이 다름)
      { const mb = $("mapbox"); if (mb) { const r = mb.getBoundingClientRect(), ml = Math.max(0, Math.round(r.left)) + "px", mr = Math.max(0, Math.round(innerWidth - r.right)) + "px"; if (H.style.getPropertyValue("--mx-ml") !== ml) H.style.setProperty("--mx-ml", ml); if (H.style.getPropertyValue("--mx-mr") !== mr) H.style.setProperty("--mx-mr", mr); } }   // PC: 지도 칸 좌우 가장자리
      const g = guNow(), pk = (LMX.peek && LMX.peek()) || null, foc = H.classList.contains("mx-focus"), mx = (LMX.mx && LMX.mx()) || {};
      const fid = pk || (foc && typeof cur !== "undefined" && cur && cur.id) || null, r = fid && byId[fid];
      let h = "";
      if (r && foc) {
        const sm = r.sm || {}, a = sm.area, o = sm.owners || sm.members;
        h += `<button type="button" class="mx-c mx-back" data-c="unfocus">${IC.back}${esc2(r.g || "서울")}로</button>`;
        if (a || o) h += `<span class="mx-c mx-scope" role="note">${a ? `경계 ${fmtN(Math.round(a))}㎡` : ""}${a && o ? " · " : ""}${o ? `소유자 ${fmtN(o)}명` : ""}</span>`;
        const fl = LMX.map && LMX.map(), src = fl && fl.getSource && fl.getSource("fline");
        const sd = src && src._data && src._data.properties;
        if (sd && sd.n && isFinite(sd.d)) h += `<span class="mx-c mx-stn" role="note">${esc2(String(sd.n).replace(/역$/, ""))}역 · ${ZF.walkMin(sd.d) > 30 ? "역에서 멀어요" : `걸어서 ${ZF.walkMin(sd.d)}분`}</span>`;
      } else if (g) {
        h += `<button type="button" class="mx-c mx-back" data-c="seoul">${IC.back}서울</button><span class="mx-c mx-scope" role="status">${esc2(g)} · 갈 수 있는 곳 ${fmtN(cntGu(g))}곳</span>`;
      } else {
        let cnt = {}; try { cnt = SIMPLE.guCounts(); } catch (e) {}
        const ng = Object.keys(cnt).filter((k) => cnt[k] > 0).length;
        h += `<span class="mx-c mx-scope" role="status">서울 25개 구 중 ${ng}개 구에 갈 수 있는 곳 · 구를 누르면 금액</span>`;
      }
      if (!foc) {
        // 다음 문턱(아이디어 B): '+5,000만이면 N곳 더' — 목록과 같은 셈(ZP_count · SIMPLE.guCount)
        const c = CASH, nx = Math.min(15, Math.round((c + step) * 100) / 100);
        if (nx > c) {
          const a0 = g ? cntGu(g) : cntAll(c), a1 = g ? cntGu(g, nx) : cntAll(nx);
          if (a1 > a0) h += `<button type="button" class="mx-c mx-thr" data-c="thr" data-v="${nx}" aria-label="내 돈 ${ZF.cash(nx)}이면 ${g || "서울"} 갈 수 있는 곳 ${fmtN(a1)}곳(${fmtN(a1 - a0)}곳 더) · 눌러서 ${ZF.cash(nx)}으로">+${ZF.cash(step)}이면 ${fmtN(a1 - a0)}곳 더</button>`;
        }
        h += `<button type="button" class="mx-c mx-tg" data-c="ok" aria-pressed="${!!mx.ok}">${mx.ok ? IC.check : ""}갈 수 있는 곳만</button>`;
        if (mx.ok) h += `<button type="button" class="mx-c mx-tg" data-c="names" aria-pressed="${!!mx.names}">이름 함께</button>`;
        h += `<button type="button" class="mx-c mx-tg" data-c="yr" aria-pressed="${!!mx.yr}" aria-haspopup="dialog">${mx.yr ? `${mx.yr}년 뒤 지도` : "N년 뒤"}</button>`;
      }
      if (chips.dataset.h !== h) { chips.dataset.h = h; chips.innerHTML = h; }
      // 서울 단계(자리 그림 SVG)의 범례: 자리 그림 안 범례는 화면 고정이 안 돼(변환된 칸) 조작부 쪽에 같은 글을 둔다
      { const gh = !!document.querySelector(".zp-ph") && ZP_G.on && ZP_G.on(); let k = $("mxGKey"); if (!k) { k = document.createElement("p"); k.id = "mxGKey"; k.className = "lm-key mx-gkey"; $("mapbox").appendChild(k); } if (gh && ZP_G.KEY2) { if (k.dataset.h !== ZP_G.KEY2) { k.dataset.h = ZP_G.KEY2; k.innerHTML = ZP_G.KEY2; k.setAttribute("aria-label", ZP_G.KEY2_L); } } k.hidden = !gh; }
    }
    function onChip(e) {
      const b = e.target.closest("[data-c]"); if (!b) return;
      const c = b.dataset.c, mx = (LMX.mx && LMX.mx()) || {};
      if (c === "seoul") { const bk = $("mapBack"); if (bk) bk.click(); return; }
      if (c === "unfocus") {
        const pk = LMX.peek && LMX.peek();
        if (pk) { LMX.pick(null); try { LMX.fitGu(byId[pk] && byId[pk].g); } catch (er) {} }
        else { try { if ($("report").classList.contains("sheet")) closeSheetNow(); } catch (er) {} H.classList.remove("s-rep"); try { history.back(); } catch (er) {} }
        return;
      }
      if (c === "thr") { try { SIMPLE.setCash(+b.dataset.v); } catch (er) {} return; }
      if (c === "ok") { LMX.mode({ ok: !mx.ok, yr: 0, names: mx.ok ? false : mx.names }); paint(); return; }
      if (c === "names") { LMX.mode({ names: !mx.names }); paint(); return; }
      if (c === "yr") { if (mx.yr) { LMX.mode({ yr: 0 }); paint(); dialClose(); } else dialOpen("yr"); }
    }
    // ---------- 다이얼 시트(아이디어 A · D 공용) ----------
    let dMode = "cash", dT = [], dStart = null;
    window.__mxDialT = dT;   // 점검(QA): 끄는 동안 색 다시 칠하기 한 번에 걸린 ms
    function dialOpen(mode) {
      dMode = mode;
      if (!dial) {
        dial = document.createElement("div"); dial.className = "mx-dial"; dial.setAttribute("role", "dialog"); dial.setAttribute("aria-modal", "false"); dial.hidden = true;
        dial.innerHTML = `<div class="mx-grab" aria-hidden="true"></div><div class="mx-dh"><span class="mx-dk"></span><b class="mx-dv"></b><span class="mx-dn" aria-live="polite"></span><button type="button" class="mx-dx" aria-label="닫기"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><input type="range" class="mx-dr" min="0" max="100" step="0.1"><div class="mx-ticks" aria-hidden="true"></div><p class="mx-dt"></p>`;
        $("mapbox").appendChild(dial);
        dial.querySelector(".mx-dx").onclick = dialClose;
        const rg = dial.querySelector(".mx-dr");
        rg.addEventListener("input", () => dialInput(+rg.value));
        rg.addEventListener("change", () => dialCommit(+rg.value));
        addEventListener("keydown", (e) => { if (e.key === "Escape" && dial && !dial.hidden) dialClose(); });
      }
      const rg = dial.querySelector(".mx-dr");
      if (mode === "cash") {
        dial.setAttribute("aria-label", "내 돈 다이얼");
        dial.querySelector(".mx-dk").textContent = "내 돈";
        rg.min = 0; rg.max = 100; rg.step = 0.1; rg.value = SIMPLE.toPos(CASH); rg.setAttribute("aria-label", "내 돈(억)");
        dial.querySelector(".mx-ticks").innerHTML = "<span>5,000만</span><span>2억</span><span>5억</span><span>15억+</span>";
        dStart = CASH;
        try { LMX.dialStart(); } catch (e) {}
      } else {
        dial.setAttribute("aria-label", "N년 뒤 지도");
        dial.querySelector(".mx-dk").textContent = "몇 년 뒤";
        const y0 = new Date().getFullYear();
        rg.min = y0; rg.max = y0 + 19; rg.step = 1; rg.value = (LMX.mx().yr || y0 + 9); rg.setAttribute("aria-label", "연도");
        dial.querySelector(".mx-ticks").innerHTML = [0, 4, 9, 14, 19].map((k) => `<span>${y0 + k}</span>`).join("");
        LMX.mode({ yr: +rg.value, ok: false });
      }
      dialText(+rg.value);
      dial.hidden = false; H.classList.add("mx-dialon");
      try { ZL.open("mxdial", () => dialClose(true)); } catch (e) {}
      setTimeout(() => { try { rg.focus({ preventScroll: true }); } catch (e) {} }, 0);
      paint();
    }
    function dialText(pos) {
      if (!dial) return;
      const g = guNow();
      if (dMode === "cash") {
        const v = SIMPLE.toCash(pos), n = cntAll(v), gn = g ? cntGu(g, v) : null;
        dial.querySelector(".mx-dv").textContent = ZF.cash(v) + (v >= 15 ? "+" : "");
        dial.querySelector(".mx-dn").innerHTML = g ? `${esc2(g)} <b>${fmtN(gn)}곳</b> <small>(서울 ${fmtN(n)}곳)</small>` : `서울 <b>${fmtN(n)}곳</b>`;
        const nx = Math.min(15, Math.round((v + step) * 100) / 100), n1 = nx > v ? (g ? cntGu(g, nx) : cntAll(nx)) : null, n0 = g ? gn : n;
        dial.querySelector(".mx-dt").innerHTML = (n1 != null && n1 > n0 ? `<span class="mx-thr2">+${ZF.cash(step)}이면 ${esc2(g || "서울")} ${fmtN(n1 - n0)}곳 더</span> ` : "") + `<span class="mx-newk">새로</span> 끄는 동안 지도 색이 바로 바뀌어요 · 노란 테두리 = ${esc2(ZF.cash(dStart))}에서는 안 되던 곳`;
        dial.querySelector(".mx-dr").setAttribute("aria-valuetext", `${ZF.cash(v)}, ${g ? `${g} ${gn}곳, ` : ""}서울 ${n}곳`);
      } else {
        dial.querySelector(".mx-dv").textContent = `${pos}년`;
        dial.querySelector(".mx-dn").textContent = "준공 범위 · 추정";
        dial.querySelector(".mx-dt").textContent = `채운 꼬리표 = ${pos}년이면 '언제 입주' 범위에 든 곳 · 테두리 = 아직 범위 전 · 꼬리표 글자는 구역 시트 '언제 입주'와 같은 추정 범위예요(서울 정비사업 실제 단계 기록)`;
        dial.querySelector(".mx-dr").setAttribute("aria-valuetext", `${pos}년`);
      }
    }
    // 끄는 동안: 판정(zstate) + 지도 색(feature-state)만 다시 — 목록·말풍선은 손을 뗄 때(SPEC G-12)
    let dRaf = 0, dPos = null;
    function dialInput(pos) {
      dPos = pos; dialText(pos);
      if (dRaf) return;
      dRaf = requestAnimationFrame(() => {
        dRaf = 0;
        if (dMode === "cash") {
          const v = SIMPLE.toCash(dPos);
          CASH = v; try { $("pCash").value = String(v); } catch (e) {}
          const t = LMX.dialPaint(); if (t >= 0) { dT.push(Math.round(t * 10) / 10); if (dT.length > 200) dT.shift(); }
          try { LMX.dragLite(); } catch (e) {}
        } else LMX.mode({ yr: Math.round(dPos) });
      });
    }
    function dialCommit(pos) {
      if (dMode === "cash") { const v = SIMPLE.toCash(pos); try { SIMPLE.setCash(v); } catch (e) {} try { LMX.dialEnd(); } catch (e) {} }
      else LMX.mode({ yr: Math.round(pos) });
      paint();
    }
    function dialClose(pop) {
      if (!dial || dial.hidden) return;
      dial.hidden = true; H.classList.remove("mx-dialon");
      if (dMode === "cash") { try { LMX.dialClose(); } catch (e) {} }
      if (pop !== true) { try { ZL.done("mxdial"); } catch (e) {} }
      paint();
    }
    // ---------- 구 이동 시트 ----------
    function gusOpen() {
      if (!gus) {
        gus = document.createElement("div"); gus.className = "mx-gus"; gus.setAttribute("role", "dialog"); gus.setAttribute("aria-label", "구 이동"); gus.hidden = true;
        $("mapbox").appendChild(gus);
        gus.addEventListener("click", (e) => { const b = e.target.closest("[data-gu]"); if (b) { gusClose(); try { enterGu(b.dataset.gu, { hist: true }); } catch (er) {} return; } if (e.target.closest(".mx-dx")) gusClose(); });
      }
      let cnt = {}; try { cnt = SIMPLE.guCounts(); } catch (e) {}
      const L = ((window.ZP_G && ZP_G.GD && ZP_G.GD.gu) || []).map((g) => g[0]).sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0) || a.localeCompare(b, "ko"));
      gus.innerHTML = `<div class="mx-dh"><b>구 이동</b><button type="button" class="mx-dx" aria-label="닫기"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><ul>${L.map((n) => `<li><button type="button" data-gu="${esc2(n)}"><span>${esc2(n)}</span><b>${cnt[n] ? `${fmtN(cnt[n])}곳` : "–"}</b></button></li>`).join("")}</ul>`;
      gus.hidden = false;
      try { ZL.open("mxgus", () => gusClose(true)); } catch (e) {}
      const f = gus.querySelector("button[data-gu]"); if (f) f.focus({ preventScroll: true });
    }
    function gusClose(pop) { if (!gus || gus.hidden) return; gus.hidden = true; if (pop !== true) { try { ZL.done("mxgus"); } catch (e) {} } }
    function locate(b) {
      if (!navigator.geolocation) return;
      b.classList.add("busy");
      navigator.geolocation.getCurrentPosition((p) => { b.classList.remove("busy"); try { LMX.flyTo(p.coords.longitude, p.coords.latitude, 14.5, "현재 위치"); } catch (e) {} }, () => b.classList.remove("busy"), { timeout: 8000, maximumAge: 60000 });
    }
    return { build, paint, dialOpen, dialClose, gusOpen };
  })();
  window.ZP_mx = MXU;
  // 전체 지도가 처음 열릴 때 만든다(홈 첫 화면에는 0 — 홈 TBT 그대로)
  { const go = () => { if (document.documentElement.classList.contains("s-full") && $("sMini")) MXU.build(); }; try { new MutationObserver(go).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch (e) {} setTimeout(go, 0); }
