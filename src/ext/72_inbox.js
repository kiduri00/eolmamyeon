/* ===================== 알림함(종) + 웹 푸시 =====================
   서버 없이 동작: 매일 파이프라인이 만드는 data/changes.json(최근 30일 구역별 사건: 단계·실거래·고시·필요한 돈)에서
   핀 꽂은 구역 것만 골라 보여 주고, 조건 핀은 앱 엔진(PINS.condsAll)의 '새로 들어온 곳'을 그대로 쓴다
   → 조건 핀 '+N 새 구역'은 홈 띠(condBtn)·내 핀 배지와 같은 수(PINS.freshIds).
   읽음: localStorage zp-inbox-seen {at: 마지막으로 연 날의 최신 날짜, k: 그날 본 사건 키}.
   웹 푸시: /api/push/key가 200일 때만(Worker 배포 뒤) '알림 받기'가 보인다. 404·오류면 숨김. */
const INBOX = (() => {
  const SK = "zp-inbox-seen", PK = "zp-push", AK = "zp-push-ask", SYK = "zp-push-sync";
  const lsR = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const lsW = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let CH = null, CHP = null, SEEN = lsR(SK, null), OPEN = null;
  const day = (t) => new Date((t || Date.now()) + 9 * 36e5).toISOString().slice(0, 10);   // 서울 날짜
  const addDay = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const BELL = '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>';
  const bellSvg = (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${BELL}</svg>`;
  const TY = { stage: ["단계", "st"], trade: ["실거래", "tr"], notice: ["고시·공고", "nt"] };

  // ---------- 데이터 ----------
  function load() {
    if (CH) return Promise.resolve(CH);
    return CHP || (CHP = fetch(`data/changes.json?v=${D.upd || D.asOf || ""}-${(D.dv && D.dv.changes) || ""}`)
      .then((r) => (r.ok ? r.json() : null)).then((j) => { CH = j && Array.isArray(j.items) ? j : { asOf: "", items: [] }; return CH; })
      .catch(() => { CHP = null; return null; }));
  }
  const pinIds = () => { try { return PINS.list(); } catch (e) { return []; } };
  const conds = () => { try { return PINS.condsAll(); } catch (e) { return []; } };
  function seen() {
    // 처음 쓰는 기기: 지난 7일 소식만 '새 소식'으로(30일치가 한꺼번에 뜨지 않게)
    if (!SEEN || typeof SEEN.at !== "string" || !Array.isArray(SEEN.k)) { SEEN = { at: addDay((CH && CH.asOf) || day(), -7), k: [] }; lsW(SK, SEEN); }
    return SEEN;
  }
  function pinEvents() {
    if (!CH) return [];
    const P = new Set(pinIds());
    return CH.items.filter((e) => P.has(e.id) && TY[e.type] && byId[e.id]);
  }
  function unread(e) {
    const s = seen(), pd = day(PINS.snapT(e.id) || 0);
    if (e.date < pd) return false;   // 핀 꽂기 전 일은 목록에만
    return e.date > s.at || (e.date === s.at && !s.k.includes(e.k));
  }
  const freshN = () => { try { return PINS.freshIds().length; } catch (e) { return 0; } };
  const count = () => pinEvents().filter(unread).length + freshN();
  function markSeen() {
    if (!CH) return;
    const at = CH.items.reduce((m, e) => (e.date > m ? e.date : m), seen().at);
    SEEN = { at, k: CH.items.filter((e) => e.date === at).map((e) => e.k) };
    lsW(SK, SEEN);
    try { PINS.markCondSeen(); } catch (e) {}
    paint();
  }

  // ---------- 종 버튼(머리) ----------
  function bell() {
    let b = $("huBell");
    if (b) return b;
    const r = document.querySelector(".hdr-r"); if (!r) return null;
    b = document.createElement("button");
    b.type = "button"; b.id = "huBell"; b.className = "hu-bell"; b.setAttribute("aria-haspopup", "dialog");
    b.innerHTML = `${bellSvg(20)}<b class="ib-n" id="bellN" hidden></b>`;
    b.addEventListener("click", () => open());
    const at = $("huFav") || $("mbHdr") || $("menuBtn");
    at ? r.insertBefore(b, at) : r.appendChild(b);
    return b;
  }
  function paint() {
    const b = bell(); if (!b) return;
    let n = 0; try { n = count(); } catch (e) {}
    const i = b.querySelector(".ib-n");
    i.hidden = !n; i.textContent = n > 9 ? "9+" : String(n);
    b.setAttribute("aria-label", `알림함${n ? `, 새 알림 ${n}개` : ""}`);
  }

  // ---------- 알림함 시트 ----------
  const dLabel = (d) => { const t = day(); if (d === t) return "오늘"; if (d === addDay(t, -1)) return "어제"; const x = new Date(d + "T00:00:00Z"); return `${x.getUTCMonth() + 1}.${x.getUTCDate()} (${"일월화수목금토"[x.getUTCDay()]})`; };
  function condHTML() {
    const L = conds().filter((n) => n.add.length);
    if (!L.length) return "";
    const F = new Set(freshN() ? PINS.freshIds() : []);
    return `<section class="ib-sec" aria-labelledby="ibCT"><h4 id="ibCT">조건 핀</h4>${L.map((n) => {
      const f = n.add.filter((id) => F.has(id)).length;
      return `<div class="ib-cond"><p class="ib-ch"><b>${esc(n.c.name)}</b>${f ? `<em class="pc-nb">+${f} 새 구역</em>` : `<small>새로 들어온 곳 ${n.add.length}곳</small>`}</p><ul>${n.add.slice(0, 5).map((id) => { const r = byId[id]; if (!r) return ""; let wy = ""; try { wy = PINS.whyNew(n.c, id); } catch (e) {} return `<li><button type="button" class="ib-it${F.has(id) ? " new" : ""}" data-open="${id}"><span class="ib-tg cd">조건</span><span class="ib-tx"><b>${esc(shortName(r.n))}</b><small>${esc(stageName(r))}${wy ? ` · ${esc(wy)}` : ""}</small></span>${F.has(id) ? '<i class="ib-dot" aria-label="새 소식"></i>' : ""}</button></li>`; }).join("")}${n.add.length > 5 ? `<li class="ib-more">외 ${n.add.length - 5}곳 · 내 핀 화면에서 모두 보기</li>` : ""}</ul></div>`;
    }).join("")}</section>`;
  }
  function pinHTML() {
    const P = pinIds();
    if (!P.length) return conds().length ? "" : `<div class="ib-empty">${bellSvg(30)}<p><b>핀 꽂은 구역 소식을 여기 모아 드려요</b><br>단계가 오르거나 새 실거래·고시가 나오면 알려 드려요</p><button type="button" class="btn primary sm" data-ibmap>지도에서 핀 꽂기</button></div>`;
    if (!CH) return `<p class="ib-note">소식을 불러오는 중이에요…</p>`;
    const E = pinEvents();
    if (!E.length) return `<section class="ib-sec" aria-labelledby="ibPT"><h4 id="ibPT">내 핀 소식</h4><p class="ib-note">최근 30일 동안 핀 꽂은 ${P.length}곳에 새 소식이 없어요</p></section>`;
    const by = new Map(); E.slice(0, 80).forEach((e) => { if (!by.has(e.date)) by.set(e.date, []); by.get(e.date).push(e); });
    return `<section class="ib-sec" aria-labelledby="ibPT"><h4 id="ibPT">내 핀 소식</h4>${[...by].map(([d, L]) => `<h5 class="ib-d">${dLabel(d)}</h5><ul>${L.map((e) => { const r = byId[e.id], [tl, tc] = TY[e.type], nw = unread(e); return `<li><button type="button" class="ib-it${nw ? " new" : ""}" data-open="${e.id}"><span class="ib-tg ${e.hi ? "hi" : tc}">${e.hi ? "신고가" : tl}</span><span class="ib-tx"><b>${esc(shortName(r.n))}</b><small>${esc(e.text)}</small></span>${nw ? '<i class="ib-dot" aria-label="새 소식"></i>' : ""}</button></li>`; }).join("")}</ul>`).join("")}</section>`;
  }
  const foot = () => (CH && CH.asOf ? `<p class="ib-foot">최근 ${CH.days || 30}일 · 매일 아침 갱신 · ${CH.asOf.slice(5).replace("-", ".")} 기준</p>` : "");
  function body() { return `${pushBox()}${condHTML()}${pinHTML()}${foot()}`; }
  function open() {
    if (OPEN) return;
    const back = document.activeElement;
    const ov = document.createElement("div");
    ov.className = "pn-ov ib-ov"; ov.id = "ibSheet";
    ov.innerHTML = `<div class="pn-dlg ib-dlg" role="dialog" aria-modal="true" aria-labelledby="ibT"><div class="ib-hd"><h3 id="ibT" tabindex="-1">알림함</h3><button type="button" class="ib-x" data-ibx aria-label="닫기"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="ib-body" data-ibbody>${body()}</div></div>`;
    document.body.appendChild(ov);
    document.documentElement.classList.add("ib-lock");
    const dlg = ov.firstElementChild, bodyEl = dlg.querySelector("[data-ibbody]");
    const close = (nav) => {
      if (!OPEN) return; OPEN = null; ov.remove(); document.documentElement.classList.remove("ib-lock");
      document.removeEventListener("keydown", kd); removeEventListener("hashchange", onNav); removeEventListener("popstate", onNav);
      if (nav !== true) try { back && back.focus && back.focus(); } catch (e) {}
    };
    const onNav = () => close(true);
    const kd = (e) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "Tab") { const f = [...dlg.querySelectorAll("button:not([disabled]),[href]")].filter((x) => x.offsetParent); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    };
    OPEN = { close, rerender: () => { bodyEl.innerHTML = body(); } };
    document.addEventListener("keydown", kd); addEventListener("hashchange", onNav); addEventListener("popstate", onNav);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-ibx]")) return close();
      if (e.target.closest("[data-open]")) { close(true); return; }   // 구역 열기는 앱 본문 [data-open] 처리가 이어서 한다
      if (e.target.closest("[data-ibmap]")) { close(true); try { SIMPLE.close(); } catch (e2) {} requestAnimationFrame(() => { const m = $("mapTop"); if (m) window.scrollTo({ top: m.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); }); return; }
      if (e.target.closest("[data-ibon]")) { subscribe(e.target.closest("[data-ibon]")); return; }
      if (e.target.closest("[data-iboff]")) { unsubscribe(); return; }
    });
    dlg.querySelector("#ibT").focus({ preventScroll: true });
    const fin = () => { if (!OPEN) return; OPEN.rerender(); setTimeout(() => { if (OPEN) markSeen(); }, 600); };
    load().then(fin);
    pushKey().then(() => { if (OPEN) OPEN.rerender(); });
  }

  // ---------- 웹 푸시 ----------
  const okHost = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const canPush = () => okHost && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  let KEY, KEYP = null, PMSG = "";
  // Worker가 배포되기 전(정적 404)·오류면 null → 알림 받기 버튼은 아예 안 보인다
  const pushKey = () => {
    if (!canPush()) return Promise.resolve(null);
    if (KEY !== undefined) return Promise.resolve(KEY);
    return KEYP || (KEYP = fetch("/api/push/key", { cache: "no-store", headers: { Accept: "application/json" } })
      .then((r) => (r.ok && /json/.test(r.headers.get("content-type") || "") ? r.json() : null))
      .then((j) => (KEY = j && typeof j.key === "string" && /^[A-Za-z0-9_-]{80,100}$/.test(j.key) ? j.key : null))
      .catch(() => (KEY = null)));
  };
  const isOn = () => !!(lsR(PK, null) || {}).on;
  function pushBox() {
    if (!KEY || !canPush()) return "";
    const perm = Notification.permission;
    if (isOn() && perm === "granted") return `<div class="ib-push on" role="group" aria-label="폰 알림">${bellSvg(18)}<span><b>폰 알림 켜짐</b><small>매일 아침 핀·조건 핀에 새 소식이 있으면 알려 드려요</small></span><button type="button" class="btn text sm" data-iboff>끄기</button></div>`;
    if (perm === "denied") return `<div class="ib-push" role="group" aria-label="폰 알림">${bellSvg(18)}<span><b>알림이 막혀 있어요</b><small>브라우저 사이트 설정에서 알림을 허용하면 켤 수 있어요</small></span></div>`;
    return `<div class="ib-push" role="group" aria-label="폰 알림">${bellSvg(18)}<span><b>새 소식을 폰 알림으로 받기</b><small>${PMSG ? esc(PMSG) : "단계·실거래·고시, 조건 핀에 새로 들어올 곳"}</small></span><button type="button" class="btn primary sm" data-ibon>알림 받기</button></div>`;
  }
  const u8 = (s) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  const b64 = (buf) => { const a = new Uint8Array(buf); let s = ""; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const swReady = (ms = 8000) => Promise.race([navigator.serviceWorker.getRegistration("/").then((r) => r || navigator.serviceWorker.register("/sw.js", { scope: "/" })).then(() => navigator.serviceWorker.ready), new Promise((_, no) => setTimeout(() => no(new Error("sw")), ms))]);
  const payload = (sub) => ({ sub: sub.toJSON(), zones: pinIds().slice(0, 20), conds: (PINS.conds() || []).map((c) => ({ n: c.name, cash: c.cash, mode: c.mode, gu: c.gu || "", kind: c.kind || "", minS: c.minS || 0 })) });
  const postSub = (sub) => fetch("/api/push/sub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(sub)) }).then((r) => { if (!r.ok) throw new Error("sub " + r.status); lsW(SYK, day()); return r; });
  // 구독 키가 서버 키와 다르면(서버 키를 바꾼 경우) 새로 구독
  const sameKey = (sub) => { try { const k = sub.options && sub.options.applicationServerKey; return !k || b64(k) === KEY; } catch (e) { return true; } };
  async function getSub(create) {
    const reg = await swReady();
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub)) { try { await sub.unsubscribe(); } catch (e) {} sub = null; }
    if (!sub && create) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(KEY) });
    return sub;
  }
  async function subscribe(btn) {
    if (btn) { btn.disabled = true; btn.textContent = "켜는 중…"; }
    PMSG = "";
    try {
      if (!(await pushKey())) throw new Error("key");
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (perm !== "granted") { PMSG = perm === "denied" ? "" : "알림을 허용해야 받을 수 있어요"; }
      else {
        const sub = await getSub(true);
        await postSub(sub);
        lsW(PK, { on: 1, at: Date.now() });
        tst("폰 알림 켰어요", "매일 아침 새 소식이 있으면 알려 드려요");
      }
    } catch (e) { PMSG = "지금은 켤 수 없어요. 잠시 뒤 다시 해 주세요"; }
    if (OPEN) OPEN.rerender();
    hideOffer();
  }
  async function unsubscribe() {
    try { const sub = await getSub(false); if (sub) { const ep = sub.endpoint; await sub.unsubscribe(); await fetch("/api/push/unsub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: ep }) }).catch(() => {}); } } catch (e) {}
    lsW(PK, { on: 0 });
    if (OPEN) OPEN.rerender();
    tst("폰 알림 껐어요", "알림함은 그대로 볼 수 있어요");
  }
  // 핀·조건이 바뀌면 서버의 구역 목록도 맞춘다(2초 모아서). 켜 둔 기기에서는 하루 한 번 다시 확인(키 바뀜·구독 사라짐)
  let syT = 0;
  function sync(force) {
    if (!isOn() || !canPush()) return;
    clearTimeout(syT);
    syT = setTimeout(async () => {
      try {
        if (!(await pushKey())) return;
        if (Notification.permission !== "granted") { lsW(PK, { on: 0 }); return; }
        if (!force && lsR(SYK, "") === day()) return;
        const sub = await getSub(true);
        if (sub) await postSub(sub);
      } catch (e) {}
    }, force ? 2000 : 4000);
  }
  const tst = (a, b) => { try { const t = document.createElement("div"); t.className = "ib-toast"; t.setAttribute("role", "status"); t.innerHTML = `${bellSvg(18)}<span><b>${esc(a)}</b><small>${esc(b)}</small></span>`; document.body.appendChild(t); requestAnimationFrame(() => t.classList.add("on")); setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 300); }, 3200); } catch (e) {} };

  // 첫 핀을 꽂은 뒤 한 번: '소식이 생기면 알려 드릴까요?'(핀 토스트가 지나간 뒤)
  let prevN = -1;
  function hideOffer() { const o = $("ibOffer"); if (o) o.remove(); }
  function maybeOffer(ids) {
    const n = ids.length, was = prevN; prevN = n;
    if (!(was === 0 && n >= 1) || isOn() || lsR(AK, 0) || !canPush() || Notification.permission !== "default") return;
    pushKey().then((k) => {
      if (!k) return;
      setTimeout(() => {
        if (!pinIds().length || $("ibOffer") || lsR(AK, 0)) return;
        lsW(AK, 1);
        const o = document.createElement("div");
        o.id = "ibOffer"; o.className = "ib-offer"; o.setAttribute("role", "dialog"); o.setAttribute("aria-labelledby", "ibOfT");
        o.innerHTML = `<span class="ib-of-i">${bellSvg(20)}</span><div><b id="ibOfT">핀 꽂은 구역에 새 소식이 생기면 알려 드릴까요?</b><small>단계가 오르거나 새 실거래·고시가 나오면 폰 알림으로</small><div class="ib-of-b"><button type="button" class="btn text sm" data-ofx>괜찮아요</button><button type="button" class="btn primary sm" data-ofon>알림 받기</button></div></div>`;
        o.addEventListener("click", (e) => { if (e.target.closest("[data-ofx]")) hideOffer(); else if (e.target.closest("[data-ofon]")) subscribe(e.target.closest("[data-ofon]")); });
        document.body.appendChild(o);
        setTimeout(hideOffer, 20000);
      }, 4600);
    });
  }

  // 알림을 눌러 열린 창: 서비스 워커가 {t:"zp-open", url} → 구역 열기 또는 알림함
  function go(url) {
    let h = ""; try { h = new URL(url, location.origin).hash.slice(1); } catch (e) {}
    if (h === "inbox") return open();
    if (byId[h]) { if (location.hash.slice(1) === h) { try { curTab = "money"; select(h, true, false, { scroll: true }); } catch (e) {} } else location.hash = "#" + h; }
  }

  function init() {
    let k = 0; const tick = () => { if (!bell() && k++ < 40) setTimeout(tick, 250); else paint(); }; tick();
    if ((location.hash || "") === "#inbox") { try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {} setTimeout(open, 400); }
    // 핀·조건 핀이 있을 때만 미리 받아 배지 계산(없으면 열 때 받음)
    const pre = () => { if (pinIds().length || conds().length) load().then(paint); };
    "requestIdleCallback" in window ? requestIdleCallback(pre, { timeout: 3000 }) : setTimeout(pre, 1500);
    prevN = pinIds().length;
    try { PINS.on((ids) => { maybeOffer(ids); sync(true); paint(); if (OPEN) OPEN.rerender(); if (ids.length && !CH) load().then(paint); }); } catch (e) {}
    try { navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.t === "zp-open") go(e.data.url); }); } catch (e) {}
    setTimeout(() => sync(false), 5000);
  }
  return { init, paint, open, count, load, pushKey };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", INBOX.init) : setTimeout(INBOX.init, 0);
