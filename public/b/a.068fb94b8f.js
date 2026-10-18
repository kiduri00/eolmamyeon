(function () {
  "use strict";
  const D = window.__ZPD || JSON.parse(document.getElementById("data").textContent);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const MEMBER_CFG = { supabaseUrl: "", supabaseAnonKey: "", price: "", passPrice: "", joinUrl: "", passUrl: "", freeReportsPerDay: 3 };
  const MO = (() => {
    try {
      return JSON.parse($("monthlyData").textContent);
    } catch (e) {
      return null;
    }
  })();
  const moLabel = () => (MO ? `${+MO.ym.slice(5, 7)}월` : "");
  const SB_JS = {};
  const PREM_DEMO_EL = document.getElementById("premiumDemo");
  const FREE_CFG = (() => {
    try {
      return JSON.parse(document.getElementById("freeMode").textContent);
    } catch (e) {
      return null;
    }
  })();
  const FREE = !!FREE_CFG;
  if (FREE) document.documentElement.classList.add("free");
  const MB = {
    demo: !!PREM_DEMO_EL || !MEMBER_CFG.supabaseUrl || !MEMBER_CFG.supabaseAnonKey,
    user: null,
    paid: null,
    sb: null,
    ready: false,
    demoData: null,
    sdkErr: false,
    ctx: "",
  };
  const KST = 9 * 36e5,
    GRACE_MS = 3 * 864e5;
  function track(name, src) {
    try {
      if (FREE || MB.demo || !MEMBER_CFG.supabaseUrl) return;
      const k = "jg_ev_" + name;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
      if (name === "visit") {
        sessionStorage.setItem("jg_ev_src", src || "direct");
        try {
          const f = JSON.parse(localStorage.getItem("jg_first") || "null");
          if (!f || f.t < Date.now() - 30 * 864e5) localStorage.setItem("jg_first", JSON.stringify({ s: src || "direct", t: Date.now() }));
        } catch (e) {}
      } else {
        let base = sessionStorage.getItem("jg_ev_src") || "direct";
        if (["login", "join_click", "paid_redeem", "pass_click", "pass_redeem"].includes(name)) {
          try {
            const f = JSON.parse(localStorage.getItem("jg_first") || "null");
            if (f && f.t > Date.now() - 30 * 864e5) base = f.s;
          } catch (e) {}
        }
        src = base + (src ? "|" + src : "");
      }
      fetch(MEMBER_CFG.supabaseUrl + "/rest/v1/site_events", {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: MEMBER_CFG.supabaseAnonKey,
          Authorization: "Bearer " + MEMBER_CFG.supabaseAnonKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ name: String(name).slice(0, 40), src: String(src || "").slice(0, 60) }),
      }).catch(() => {});
    } catch (e) {}
  }
  const kstDay = (t = Date.now()) => new Date(t + KST).toISOString().slice(0, 10);
  const kstMD = (t) => {
    const d = new Date(t + KST);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  };
  const monthEndKST = () => {
    const d = new Date(Date.now() + KST);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - KST - 1e3;
  };
  const isMember = () => FREE || !!(MB.paid && MB.paid.getTime() > Date.now());
  const memberUntil = () => `${kstMD(MB.paid.getTime())}까지`;
  const lsGet = (k) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  };
  const lsSet = (k, v) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };
  const FREE_KEY = "jg_free_v1";
  function freeState() {
    const s = lsGet(FREE_KEY),
      day = kstDay(),
      u = MB.user ? MB.user.id : "";
    return s && s.d === day && s.u === u && Array.isArray(s.ids) ? s : { d: day, u, ids: [] };
  }
  const freeLeft = () => Math.max(0, MEMBER_CFG.freeReportsPerDay - freeState().ids.length);
  function freeAdd(id) {
    const s = freeState();
    if (!s.ids.includes(id)) s.ids.push(id);
    lsSet(FREE_KEY, s);
  }
  function freeSync(ids) {
    if (!Array.isArray(ids)) return;
    const s = freeState();
    s.ids = [...new Set(ids)];
    lsSet(FREE_KEY, s);
  }
  const zoneOpen = (id) => isMember() || freeState().ids.includes(id);
  const KAKAO_SYM = "";
  const LOCK_SVG =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><path d="M12 14.6v2.2"/></svg>';
  const kakaoBtn = () => "";
  const MB_PERKS = [];
  const SK_BAR = (w, h = 10) => `<i class="skb" style="width:${w}%;height:${h}px"></i>`;
  const SKEL = {
    report: () =>
      `<div class="sk-tabs">${[18, 16, 17, 16, 17].map((w) => SK_BAR(w, 30)).join("")}</div><div class="sk-row">${[1, 2, 3].map(() => `<div class="sk-tile">${SK_BAR(60, 9)}${SK_BAR(42, 22)}${SK_BAR(70, 8)}</div>`).join("")}</div>${[92, 76, 84, 58].map((w) => SK_BAR(w)).join("")}<div class="sk-lad">${[0, 1, 2, 3].map(() => `<div>${SK_BAR(8, 16)}${SK_BAR(50)}${SK_BAR(20)}</div>`).join("")}</div>`,
    list: () => [0, 1, 2].map(() => `<div class="sk-li">${SK_BAR(46, 12)}${SK_BAR(24, 18)}${SK_BAR(70, 8)}</div>`).join(""),
    table: () =>
      `<div class="sk-tb">${[0, 1, 2, 3, 4].map(() => `<div>${SK_BAR(30)}${SK_BAR(14)}${SK_BAR(14)}${SK_BAR(18)}</div>`).join("")}</div>`,
    note: () => `${SK_BAR(40, 14)}${[96, 88, 92, 64].map((w) => SK_BAR(w)).join("")}${SK_BAR(80)}${SK_BAR(52)}`,
  };
  function lockCard(o) {
    return "";
  }
  function reportGate(r) {
    return "";
  }
  const nickOf = (u) => {
    const m = (u && u.user_metadata) || {};
    return String(m.nickname || m.name || m.full_name || m.preferred_username || m.user_name || "회원").slice(0, 20);
  };
  function loadSB() {
    return new Promise((ok, no) => {
      if (window.supabase && window.supabase.createClient) return ok();
      const s = document.createElement("script");
      s.src = SB_JS.src;
      s.integrity = SB_JS.sri;
      s.crossOrigin = "anonymous";
      s.onload = ok;
      s.onerror = () => no(new Error("sdk"));
      document.head.appendChild(s);
    });
  }
  function mbDialogBind() {
    const dlg = $("mbSheet");
    if (!dlg || dlg._b) return;
    dlg._b = true;
    dlg.addEventListener("close", () => {
      document.documentElement.classList.remove("mb-open");
      if (MB.from && document.contains(MB.from)) MB.from.focus({ preventScroll: true });
    });
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "Escape") e.stopPropagation();
    });
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) mbClose();
    });
  }
  const JOIN_KEY = "jg_join";
  function mbGrabLink() {
    const m = /^#join=([A-Za-z0-9-]{4,24})(?:&z=([A-Za-z0-9_-]{1,40}))?$/.exec(location.hash || "");
    if (!m) return;
    try {
      localStorage.setItem(JOIN_KEY, m[1]);
      if (m[2]) localStorage.setItem(JOIN_KEY + "_z", m[2]);
      else localStorage.removeItem(JOIN_KEY + "_z");
    } catch (e) {}
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) {}
  }
  const joinPending = () => {
    try {
      return localStorage.getItem(JOIN_KEY) || "";
    } catch (e) {
      return "";
    }
  };
  async function mbAutoJoin() {
    const c = joinPending();
    if (!c) return;
    let z = "";
    try {
      z = localStorage.getItem(JOIN_KEY + "_z") || "";
    } catch (e) {}
    if (!MB.user) {
      try {
        if (z) sessionStorage.setItem("jg_ret", z);
      } catch (e) {}
      if (MB.demo) {
        mbOpen("join");
        return;
      }
      try {
        if (sessionStorage.getItem("jg_join_try")) {
          mbOpen("join");
          return;
        }
        sessionStorage.setItem("jg_join_try", "1");
      } catch (e) {}
      mbLogin();
      return;
    }
    try {
      localStorage.removeItem(JOIN_KEY);
      localStorage.removeItem(JOIN_KEY + "_z");
      sessionStorage.removeItem("jg_join_try");
    } catch (e) {}
    const res = await mbRedeem(c);
    if (res.ok) {
      PREM_P.clear();
      track(isPassCode(c) ? "pass_redeem" : "paid_redeem");
    }
    MB.msg = res.ok
      ? { ok: true, t: `열렸어요 · ${memberUntil()}` }
      : { ok: false, t: MB_LINK_ERR[res.err] || MB_ERR[res.err] || MB_ERR.net };
    if (res.ok && z && byId[z]) {
      MB.msg = null;
      mbClose();
      mbPaint();
      if (!cur || cur.id !== z) {
        curTab = "money";
        select(z, true, false, { scroll: true });
      }
      return;
    }
    mbPaint();
    mbOpen("", true);
  }
  async function mbInit() {
    if (FREE) {
      MB.ready = true;
      mbPaint();
      return;
    }
    mbDialogBind();
    mbGrabLink();
    window.addEventListener("hashchange", () => {
      if (/^#join=/.test(location.hash)) {
        mbGrabLink();
        if (MB.ready) mbAutoJoin();
      }
    });
    if (MB.demo) {
      try {
        MB.demoData = PREM_DEMO_EL ? JSON.parse(PREM_DEMO_EL.textContent) : null;
      } catch (e) {
        MB.demoData = null;
      }
      MB.user = lsGet("jg_demo_user");
      const p = lsGet("jg_demo_paid");
      MB.paid = p ? new Date(p) : null;
      MB.ready = true;
      mbPaint();
      mbAutoJoin();
      return;
    }
    try {
      await loadSB();
    } catch (e) {
      MB.sdkErr = true;
      MB.ready = true;
      mbPaint();
      return;
    }
    MB.sb = window.supabase.createClient(MEMBER_CFG.supabaseUrl, MEMBER_CFG.supabaseAnonKey, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    MB.sb.auth.onAuthStateChange((ev, session) => {
      setTimeout(() => mbSession(session), 0);
    });
    try {
      const { data } = await MB.sb.auth.getSession();
      await mbSession(data && data.session);
    } catch (e) {
      MB.ready = true;
      mbPaint();
    }
  }
  let mbLast = "";
  async function mbSession(session) {
    const u = session && session.user,
      key = u ? u.id : "";
    if (MB.ready && key === mbLast) return;
    mbLast = key;
    MB.user = u ? { id: u.id, nick: nickOf(u) } : null;
    MB.paid = null;
    if (u) await mbFetchPaid();
    MB.ready = true;
    mbPaint();
    if (u) mbReturn();
    if (joinPending()) mbAutoJoin();
  }
  async function mbFetchPaid() {
    return;
  }
  function mbReturn() {
    let id = "";
    try {
      id = sessionStorage.getItem("jg_ret") || "";
      sessionStorage.removeItem("jg_ret");
    } catch (e) {}
    if (id && byId[id] && (!cur || cur.id !== id)) {
      curTab = "money";
      select(id, true, false, { scroll: true });
    }
  }
  function mbLogin() {
    return;
  }
  async function mbLogout() {
    return;
  }
  const isPassCode = (c) => /^\s*(jp-|demo-pass)/i.test(String(c || ""));
  async function mbRedeem(code) {
    return { ok: false, err: "net" };
  }
  const MB_ERR = {};
  const MB_LINK_ERR = {};
  const PREM_P = new Map();
  let PREM_ALL = null;
  function premAll() {
    if (!PREM_ALL)
      PREM_ALL = fetch(FREE_CFG.prem, { cache: "force-cache" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((j) => {
          if (!j) PREM_ALL = null;
          return j;
        });
    return PREM_ALL;
  }
  let HJ_PREM = false;
  const fixZoning = (z) => String(z).replace(/(^|[^\d·])([1-3]{2,3})종/g, (m, a, d) => a + d.split("").join("·") + "종");
  function premApply(r, p) {
    p = p || {};
    ["dt", "sin", "news", "cafe", "rd", "b", "dq", "ev"].forEach((k) => {
      if (p[k] !== undefined) r[k] = p[k];
    });
    if (p.sm) {
      r.sm = r.sm || {};
      Object.assign(r.sm, p.sm);
      if (r.sm.zoning) r.sm.zoning = fixZoning(r.sm.zoning);
    }
    if (p.cs && r.cs)
      Object.entries(p.cs).forEach(([k, v]) => {
        if (r.cs[k]) Object.assign(r.cs[k], v);
      });
    if (p.inf) {
      r.infP = p.inf;
      r._inf = undefined;
    }
    r._prem = true;
  }
  function hjApply(p) {
    if (!p || HJ_PREM) return;
    const m = p.items || {};
    HJD.items.forEach((h) => {
      if (m[h.id]) Object.assign(h, m[h.id]);
    });
    HJ_PREM = true;
  }
  function premLoad(r) {
    if (r._prem) return Promise.resolve("ok");
    if (PREM_P.has(r.id)) return PREM_P.get(r.id);
    const p = (async () => {
      if (FREE) {
        const all = await premAll();
        if (!all) return "err";
        premApply(r, all[r.id]);
        hjApply(all._hojae);
        return "ok";
      }
      if (MB.demo) {
        if (!isMember()) {
          if (!MB.user) return "login";
          const s = freeState();
          if (!s.ids.includes(r.id)) {
            if (s.ids.length >= MEMBER_CFG.freeReportsPerDay) return "limit";
            freeAdd(r.id);
          }
        }
        if (!MB.demoData) return "none";
        premApply(r, MB.demoData[r.id]);
        hjApply(MB.demoData._hojae);
        return "ok";
      }
      if (!MB.sb) return "err";
      try {
        if (isMember()) {
          const ids = HJ_PREM ? [r.id] : [r.id, "_hojae"];
          const { data, error } = await MB.sb.from("premium_zones").select("id,payload").in("id", ids);
          if (error) return "err";
          if (!HJ_PREM && !(data || []).some((x) => x.id === "_hojae")) {
            await mbFetchPaid();
            if (!isMember()) {
              mbPaint();
              return "limit";
            }
          }
          (data || []).forEach((x) => {
            if (x.id === "_hojae") hjApply(x.payload);
          });
          premApply(r, ((data || []).find((x) => x.id === r.id) || {}).payload);
          return "ok";
        }
        if (!MB.user) return "login";
        const { data, error } = await MB.sb.rpc("free_zone", { p_id: r.id });
        if (error) {
          const m = error.message || "";
          if (/FREE_LIMIT/.test(m)) {
            freeSync(Array.from({ length: MEMBER_CFG.freeReportsPerDay }, (_, i) => freeState().ids[i] || "_" + i));
            return "limit";
          }
          return /LOGIN_REQUIRED/.test(m) ? "login" : "err";
        }
        if (data) {
          hjApply(data.hj);
          premApply(r, data.z);
          freeSync(data.ids);
          freeAdd(r.id);
        }
        return "ok";
      } catch (e) {
        return "err";
      }
    })();
    PREM_P.set(r.id, p);
    p.then(() => PREM_P.delete(r.id));
    return p;
  }
  const PREM_TABS = new Set(["biz", "loc", "near", "tx"]);
  function premPane(r) {
    const p = $("pane");
    p.innerHTML = `<div class="prem-wait" role="status"><span class="sr-only">상세 자료를 불러오는 중</span>${SKEL.note()}</div>`;
    premLoad(r).then((res) => {
      if (cur !== r || !PREM_TABS.has(curTab)) return;
      if (res === "ok") {
        renderPane();
        return;
      }
      if (res === "none") {
        p.innerHTML = `<p class="note">상세 자료가 없는 빌드예요.</p>`;
        return;
      }
      if (res === "err") {
        p.innerHTML = `<p class="note">상세 자료를 불러오지 못했어요. <button type="button" class="btn text sm" id="premRetry">다시 시도</button></p>`;
        $("premRetry").onclick = () => renderPane();
        return;
      }
      renderReport();
    });
  }
  async function mbFree(id) {
    return;
  }
  function mbPaint() {
    if (MB.user) track("login");
    const h = $("mbHdr");
    if (h && FREE) h.innerHTML = "";
    else if (h) h.innerHTML = "";
    const bar = $("demoBar");
    if (bar) bar.hidden = !MB.demo;
    if (typeof sumBtnPaint === "function") sumBtnPaint();
    document.documentElement.classList.toggle("is-member", isMember());
    const dlg = $("mbSheet");
    if (dlg && dlg.open) mbSheetRender();
    if (typeof reportReady !== "undefined" && reportReady && cur && $("report").querySelector("#repTitle")) renderReport();
    if (T3.ready) {
      runCommute();
      renderSave();
      renderFav();
    }
  }
  const MB_CTX = {};
  function mbOpen(ctx, keep) {
    return;
  }
  function mbClose() {
    const dlg = $("mbSheet");
    if (dlg && dlg.open) dlg.close();
  }
  function mbSheetRender() {
    return;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-mb]");
    if (!b) return;
    const a = b.dataset.mb;
    if (a === "login") {
      e.preventDefault();
      mbLogin();
    } else if (a === "open") {
      e.preventDefault();
      mbOpen(b.dataset.mbctx);
    } else if (a === "close") {
      e.preventDefault();
      mbClose();
    } else if (a === "logout") {
      e.preventDefault();
      mbLogout();
    } else if (a === "free") {
      e.preventDefault();
      mbFree(b.dataset.id);
    }
  });
  const STEP_K = {
    추진위: "추진위원회 승인",
    구역지정: "정비구역 지정",
    조합설립: "조합설립인가",
    사업시행: "사업시행인가",
    관리처분: "관리처분인가",
  };
  // 정비사업 정보몽땅 추진경과(data/notice.json) — 소식 > 단계 소식(50_board)·구역 리포트가 같은 파일 하나를 쓴다
  let NTD = null, NTP = null;
  function ntLoad() { return NTD ? Promise.resolve(NTD) : NTP || (NTP = fetch(`data/notice.json?v=${(D.dv && D.dv.notice) || D.upd || ""}`).then((r) => (r.ok ? r.json() : null)).then((j) => (NTD = j)).catch(() => ((NTP = null), null))); }
  // 정보몽땅 단계 이름 → 짧은 단계 키(소식 > 단계 소식 50_board.js가 단계 변경을 가릴 때 씀)
  const NT_STEP = { 조합설립인가: "조합설립", 사업시행인가: "사업시행", 관리처분인가: "관리처분", 정비구역지정: "구역지정", 조합설립추진위원회승인: "추진위" };
  const NF = {};
  const nf = (d) => NF[d] || (NF[d] = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: d, minimumFractionDigits: d }));
  const fmt = (n, d = 0) => (n == null || !isFinite(n) ? "–" : nf(d).format(n));
  const NF1 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
  const TODAY = new Date(D.asOf + "T00:00:00");
  const ETA_NOW = new Date((D.upd || D.asOf) + "T00:00:00");   // 입주 시점이 지났는지·몇 년 남았는지는 데이터 갱신일 기준
  const ym = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  const ASOF = D.asOf.replaceAll("-", ".");
  const UPD = (D.upd || D.asOf).replaceAll("-", ".");
  // 머리·푸터 같은 한 줄: "실거래 10.14 신고분까지 · 10.18 갱신" (build.py가 첫 화면 HTML에도 같은 글을 박는다)
  window.ZP_fresh = (() => { const md = (s) => { const m = /(\d{4})-?(\d\d)-?(\d\d)/.exec(s || ""); return m ? `${+m[2]}.${m[3]}` : ""; }; const t = D.txAsOf && md(D.txAsOf.sale), u = md(D.upd || D.asOf); return t ? `실거래 ${t} 신고분까지${u ? ` · ${u} 갱신` : ""}` : `${u} 갱신`; })();
  const LADDER = D.ladder;
  const R = D.recs;
  /* ===================== 구역 사실 한 곳(ZF) · 용어(LBL) =====================
     같은 구역의 같은 숫자가 화면마다 다르게 뜨지 않게, 표본 한 문장·머리 큰 숫자·입주까지 현금·숫자 꼴·정식 용어를 여기서만 만든다.
     읽는 곳: 구역 리포트 머리(64_overview) · 1km 비교표(20_zone) · 목록·'왜 이 금액?'(60_simple) · 계산기·도구 화면(app.js) · 단계 소식(50_board).
     정적 쪽 같은 규칙: tools/zsample.py (LBL · smpTxt · headline) — 둘을 같이 고친다.
     3.3㎡당 표본 값(entry.u·nl)은 tools/enrich.py가 매수가 표본에서 한 번 계산해 둔 것(화면이 거래 목록으로 다시 찾지 않는다). */
  const LBL = { cashToMoveIn: "입주까지 현금", gap: "전세 끼고", loan: "대출 끼고" };
  const ZF = (() => {
    // 만원 → '3,905만' · '1.5억'(큰 숫자·표) / 억 → '1억 5,450만'(계산 매수가)
    const eok = (m) => (m == null || !isFinite(m) ? "–" : m >= 10000 ? (Math.round(m / 1000) / 10).toLocaleString("ko-KR") + "억" : Math.round(m).toLocaleString("ko-KR") + "만");
    const manT = (v) => { const m = Math.round(v * 1e4), a = Math.floor(m / 1e4), b = m % 1e4; return a ? `${a}억${b ? ` ${b.toLocaleString("ko-KR")}만` : ""}` : `${b.toLocaleString("ko-KR")}만`; };
    // 억 단위 금액 한 꼴(지금 필요한 돈·입주까지 현금·핀·지도 이름표·리포트 시간표 모두): 1억 아래는 소수 둘째 자리(0.97), 1억부터 첫째 자리(1.2 · 1)
    // num → 단위 없는 숫자('0.97' · '1.2' · '0'), cash → '0.97억' · '0원'
    const num = (v) => { if (v == null || !isFinite(v)) return "–"; const a = Math.abs(v), sg = v < 0 ? "-" : ""; if (a < 0.005) return "0"; if (a < 0.995) return sg + (Math.round(a * 100) / 100).toFixed(2).replace(/0$/, ""); return sg + (Math.round(a * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 }); };
    const cash = (v) => { const t = num(v); return t === "–" ? t : t === "0" ? "0원" : t + "억"; };
    const entry = (r) => (r && r.mk && r.mk.entry) || null;
    const est = (r) => { try { return isEst(r); } catch (e) { return false; } };
    const calc = (r) => { try { return investC(r); } catch (e) { return null; } };
    // 매수가 표본 한 문장 — /z/·API(zsample.smpTxt)와 같은 규칙 · 1건이면 '가운데 값'이라 하지 않는다
    function smpTxt(r, x) {
      const en = entry(r);
      if (est(r) || (x && x.priceSrc === "est")) return `같은 구(${r.g}) 빌라 시세 가운데 값으로 추정`;
      if (!en || !en.n) return "";
      const where = en.src === "complex" ? (en.fill === "zoneapt" ? "구역 안 아파트" : en.name ? en.name : "단지") : en.fill === "dong" ? "같은 동 빌라" : en.radius ? `주변 ${en.radius}m 빌라` : en.m === "jibun" ? "같은 본번 빌라" : "구역 안 빌라";
      const span = en.f ? `(${en.f}${en.t && en.t !== en.f ? "–" + en.t : ""})` : en.last ? `(최근 ${en.last.slice(0, 5)})` : "";
      return en.n === 1 ? `${where} 거래 1건${span}` : `${where} ${en.n}건 가운데 값${span}`;
    }
    // 매수가 표본: 몇 건·기간·마지막 거래·같은 표본의 대지 3.3㎡당
    function sample(r) {
      const en = entry(r);
      if (!en || !en.n) return null;
      return { n: en.n, from: en.f || "", to: en.t || "", last: en.last || "", med: en.med, u: en.u || null, nl: en.nl || en.n, near: en.src === "villa" && !!(en.radius || en.fill === "dong"), text: smpTxt(r) };
    }
    /* 머리 큰 숫자 하나(zsample.headline과 같은 규칙) — 계산 매수가가 있으면 그 표본으로만 말한다.
       'u' 매수가 표본의 대지 3.3㎡당 · 'p' 매수가 자체(3.3㎡당을 같은 표본으로 못 낼 때) · 'hd' 대표 거래 기준(표본 없음·추정·직접 입력·아파트 기준) */
    function headline(r, h) {
      const en = entry(r) || {}, x = calc(r);
      const has = en.n > 0 && en.med > 0 && x && x.price != null && isFinite(x.price) && x.priceSrc !== "user" && x.priceSrc !== "est" && !est(r);
      if (has && h && h.b === "v" && en.src === "villa" && en.u) {
        const nl = en.nl || en.n;
        return { kind: "u", v: en.u, n: en.n, to: en.t ? "20" + en.t.replace(".", "") : "", label: "빌라·단독 대지 3.3㎡당", basis: `${smpTxt(r, x)}${nl < en.n ? ` · 대지 면적 있는 ${nl}건` : ""} · 매수가와 같은 표본` };
      }
      if (has && (!h || h.b === "v")) {
        const near = en.src === "villa" && !!(en.radius || en.fill === "dong");
        return { kind: "p", v: en.med, n: en.n, near, to: en.last ? "20" + en.last.slice(0, 2) + en.last.slice(3, 5) : "", label: near ? "주변 빌라 매매가 · 계산 매수가" : "매매가 · 계산 매수가", basis: `${smpTxt(r, x)}${en.area_med ? ` · 전용 ${en.area_med}㎡ 안팎` : ""}` };
      }
      return h && h.u ? { kind: "hd", v: h.u, n: h.n, to: h.to } : null;
    }
    // 1km 비교표 같은 곳의 '3.3㎡당' 칸: 머리 큰 숫자가 3.3㎡당이면 그 값, 아니면 구역 대표 거래 값
    const u33 = (r) => { const h = r.tx && r.tx.hd; if (!h || !h.u) return null; const H = headline(r, h); return { v: H && H.kind === "u" ? H.v : h.u, b: h.b, st: !!h.st, zone: !!(H && H.kind === "p"), n: h.n }; };
    // 입주까지 현금(잔금대출 뺀 값): 전세 끼고면 갭 총액, 아니면 계산기 총액 — 목록·왜 시트·리포트가 같은 함수
    function cashToMoveIn(r, gap) {
      try {
        if (gap) { const g = gapOf(r); return g && !g.na && !g.block && g.total != null ? g.total : null; }
        const x = investC(r); return x && x.ok && x.needTotal != null ? x.needTotal : null;
      } catch (e) { return null; }
    }
    // 정보몽땅 원문 '[(변경)인가신청]', '동의율 : 89.85' → '변경인가 신청', '동의율 89.85%'
    // '(변경)'은 양식 이름이라, 그 단계 날짜가 이 기록보다 앞서 있을 때만 '변경'으로 읽는다
    const EVK = { 조합설립인가: "조합설립", 사업시행인가: "사업시행", 관리처분인가: "관리처분", 정비구역지정: "구역지정", 조합설립추진위원회승인: "추진위", 사업시행자지정: "시행자지정", 준공인가: "준공" };
    function evText(r, d, sec, t) {
      const m = String(t || "").match(/^\[([^\]]*)\]\s*(.*)$/), k = EVK[sec], sd = k && r && r.dt && r.dt[k];
      let a = m ? m[1] : "", b = m ? m[2] : String(t || "");
      const chg = /\(변경\)/.test(a) && !!sd && sd < d;
      a = a.replace(/\(변경\)\s*/, chg ? "변경" : "").replace(/(인가|승인)(신청|고시)/, "$1 $2").replace(/계약\(변경\)/, "계약 변경").replace(/\s*:\s*/, " ");
      b = b.replace(/동의율\s*:\s*(\d+(?:\.\d+)?)\s*%?/, "동의율 $1%").replace(/동의율\s*:\s*(해당없음|[.\-]?)\s*$/, "").replace(/\(최초인가시\)/, " (최초 인가 때)")
        .replace(/(\S*?)일자\s*:\s*/, (x, p) => (p.endsWith("일") ? p : p + "일") + " ").replace(/선정업체명\s*:\s*/, "").replace(/(\d{4})-(\d{2})-(\d{2})/g, "$1.$2.$3").replace(/\b(20\d\d)(\d\d)(\d\d)\b/g, "$1.$2.$3").replace(/\s*:\s*/g, " ").trim();
      if (b && a && b.replace(/\s/g, "") === a.replace(/\s/g, "")) b = "";
      return { txt: b ? (a ? `${a} · ${b}` : b) : a, chg };
    }
    return { eok, manT, num, cash, smpTxt, sample, headline, u33, cashToMoveIn, evText, LBL };
  })();
  // 정적 HTML(shell.html)의 방식 버튼 글자도 LBL에서: data-lbl="gap|loan|cashToMoveIn"
  { const lbl = () => document.querySelectorAll("[data-lbl]").forEach((e) => { const t = LBL[e.dataset.lbl]; if (t && e.textContent !== t) e.textContent = t; }); document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", lbl) : lbl(); }
  // ===================== 실제 지도 (MapLibre · OpenFreeMap 벡터 타일) =====================
  // 서울 전체 = 기존 구 단위 지도(SVG). 구를 누르면 실제 지도로 바뀌고 정비구역 경계를 그린다.
  // 경계: 서울도시공간포털 정비구역(UQ181) + 서울시 정비사업 현황(UQ120). 공식 경계가 없으면 면적 기준 추정 범위(점선).
  const LMX = (() => {
    const MLV = "4.7.1";
    const ML_JS = { src: `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MLV}/maplibre-gl.min.js`, sri: "sha512-dXgoFR02YHJ9Fa29P3D/1umNaZ0EXS2N0w29Lm3b/1BK8UDLMdLWDFwuujIyJJdU27/PLuk3dmS1V9NO8ABX1A==" };
    const ML_CSS = { src: `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MLV}/maplibre-gl.min.css`, sri: "sha512-qN/uDg9bS3IAldWq4lswyC+9ZSoShtfyNDp+FaJhdtXJqdgubHA+s4nB8BajW0m90Y0+RBGbqu2anzbxiQYdHA==" };
    const LINE_COL = { "1호선": "#0052A4", "2호선": "#00A84D", "3호선": "#EF7C1C", "4호선": "#00A5DE", "5호선": "#996CAC", "6호선": "#CD7C2F", "7호선": "#747F00", "8호선": "#E6186C", "9호선": "#BDB092", 신분당선: "#D4003B", 수인분당선: "#F5A200", 경의중앙선: "#77C4A3", 공항철도: "#0090D2", 경춘선: "#0C8E72", 우이신설선: "#B0CE18", 신림선: "#6789CA", "GTX-A": "#9A6292", 서해선: "#8FC31F" };
    const SEOUL_BB = [[126.76, 37.413], [127.185, 37.716]];
    const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
    let pendFocus = false;
    let map = null, libP = null, geo = null, geoP = null, ready = false, active = false, gu = null, failed = false;
    let want = store.get("emr.map", "real") !== "svg";
    let colorBy = store.get("emr.mapc", "cash");
    const MODES = [["cash", "내 현금"], ["stage", "단계"], ["kind", "사업 방식"], ["old", "노후도"], ["vol", "거래량"], ["yoy", "1년 가격 변화"]];
    if (!MODES.some(([k]) => k === colorBy)) colorBy = "cash";
    // 겹쳐 보는 레이어(호갱노노식): 지도 바탕 POI는 OpenFreeMap 벡터 타일, 나머지는 사이트 자료
    const LAYERS = [["hj", "개발 호재", "신설 노선 역·복합개발"], ["hi", "신고가", "최근 3개월, 2024년 이후 최고가"], ["edu", "학교", "초·중·고"], ["acad", "학원가", "학원 점포가 많은 상권"], ["biz", "상권", "점포 수·분기 매출"], ["med", "병원", "종합·대형병원"], ["mart", "대형마트", "이마트·홈플러스 등"]];
    const POIZ = 14;
    // 목록 머리 유형 칩(60_simple.js가 'zp:filter' 이벤트로 알림) → 지도 구역·핀도 같은 유형만
    const KINDOF = (r) => (/재건축/.test(r.k) ? "rebuild" : /가로|소규모/.test(r.k) ? "small" : "redev");
    let kindF = "";
    const kindOk = (r) => !kindF || KINDOF(r) === kindF;
    addEventListener("zp:filter", (e) => { const k = (e && e.detail && e.detail.kind) || ""; if (k === kindF) return; kindF = k; if (map && ready) paint(); });
    let lyr = (() => { try { return new Set(JSON.parse(store.get("emr.lyr", '[]'))); } catch (e) { return new Set(); } })();
    const BINS = { old: [[40, "40% 미만"], [60, "40~60%"], [67, "60~67%"], [80, "67~80%"], [101, "80% 이상"]], vol: [[1, "0건"], [5, "1~4건"], [15, "5~14건"], [40, "15~39건"], [1e9, "40건 이상"]], yoy: [[-10, "−10% 미만"], [0, "−10~0%"], [10, "0~+10%"], [25, "+10~25%"], [1e9, "+25% 이상"]] };
    const metric = (r) => { const t = r.tx || {}; if (colorBy === "old") return t.old && r.s < 7 ? t.old.pol : null; if (colorBy === "vol") return t.n12 != null ? t.n12 : r.tx ? 0 : null; if (colorBy === "yoy") return t.yoy != null && t.yon && t.yon[0] >= 10 && t.yon[1] >= 10 ? t.yoy : null; return null; };
    const dark = () => { const t = document.documentElement.dataset.theme; return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
    function loadLib() {
      if (window.maplibregl && window.maplibregl.Map) return Promise.resolve();
      if (libP) return libP;
      libP = new Promise((ok, no) => {
        const l = document.createElement("link");
        l.rel = "stylesheet"; l.href = ML_CSS.src; l.integrity = ML_CSS.sri; l.crossOrigin = "anonymous";
        document.head.appendChild(l);
        const s = document.createElement("script");
        s.src = ML_JS.src; s.integrity = ML_JS.sri; s.crossOrigin = "anonymous";
        s.onload = () => (window.maplibregl && window.maplibregl.Map ? ok() : no(new Error("lib")));
        s.onerror = () => no(new Error("lib"));
        document.head.appendChild(s);
      }).catch((e) => { libP = null; throw e; });
      return libP;
    }
    function loadGeo() {
      if (geo) return Promise.resolve(geo);
      if (!geoP) geoP = fetch(`data/geo.json?v=${(D.dv && D.dv.geo) || D.asOf}`).then((r) => (r.ok ? r.json() : null)).then((g) => { geo = g && g.z ? g : null; if (!geo) geoP = null; return geo; }).catch(() => { geoP = null; return null; });
      return geoP;
    }
    // 색: 페이지 CSS 토큰에서 읽어 디자인 변경을 그대로 따른다
    const probe = (() => { let el = null; return (css) => { if (!el) { el = document.createElement("i"); el.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden"; document.body.appendChild(el); } el.style.color = ""; el.style.color = css; return getComputedStyle(el).color; }; })();
    const CASH_LAB = { y: null, n: "현금 부족", u: "계산 보류", e: "구 평균 시세 추정", x: "" };
    function palette() {
      const v = (n, d) => probe(`var(${n}, ${d})`);
      return { y: v("--brand", "#2B59F0"), n: v("--text-3", "#5c6573"), u: v("--text-4", "#8B95A1"), e: v("--acc2", "#8B6FE8"), x: v("--text-4", "#8B95A1"), ink: v("--text-1", "#191F28"), sub: v("--text-3", "#5F6B7A"), surf: v("--surface", "#fff"), line: v("--border", "#E5E8EB"), sel: v("--focus", "#2B59F0") };
    }
    // 겹쳐 보기 아이콘 색: [동그라미, 글자]. 남색(구역)·파랑과 겹치지 않는 청록·빨강·자홍
    const POIC = (dk) => (dk ? { edu: ["#2BA894", "#6FD8C6"], med: ["#E0484E", "#F59A9A"], mart: ["#C2479A", "#F09ACD"] } : { edu: ["#0B8070", "#0A6F61"], med: ["#D0343A", "#B4232A"], mart: ["#B0327F", "#9A2470"] });
    function poiIcon(k, dk, px) {
      const S = 20, c = document.createElement("canvas"); c.width = c.height = S * px;
      const x = c.getContext("2d"); x.scale(px, px);
      x.beginPath(); x.arc(10, 10, 8.6, 0, Math.PI * 2); x.fillStyle = POIC(dk)[k][0]; x.fill(); x.lineWidth = 1.6; x.strokeStyle = dk ? "#11161D" : "#FFFFFF"; x.stroke();
      x.fillStyle = "#FFFFFF"; x.strokeStyle = "#FFFFFF"; x.lineJoin = "round"; x.lineCap = "round";
      if (k === "edu") { x.beginPath(); x.moveTo(5, 9.2); x.lineTo(10, 5.4); x.lineTo(15, 9.2); x.closePath(); x.fill(); x.fillRect(6.4, 9.2, 7.2, 5.4); x.fillStyle = POIC(dk)[k][0]; x.fillRect(9, 11.4, 2, 3.2); }
      else if (k === "med") { x.fillRect(8.6, 5.2, 2.8, 9.6); x.fillRect(5.2, 8.6, 9.6, 2.8); }
      else { x.lineWidth = 1.5; x.beginPath(); x.moveTo(5, 6.2); x.lineTo(6.6, 6.2); x.lineTo(8, 12.4); x.lineTo(14, 12.4); x.lineTo(15, 8.2); x.lineTo(7.1, 8.2); x.stroke(); x.beginPath(); x.arc(8.6, 14.4, 1.1, 0, 7); x.arc(13.2, 14.4, 1.1, 0, 7); x.fill(); }
      return c;
    }
    const POIURL = {};
    const poiUrl = (k) => { const key = k + (dark() ? "d" : ""); if (!POIURL[key]) { try { POIURL[key] = poiIcon(k, dark(), 3).toDataURL(); } catch (e) { POIURL[key] = ""; } } return POIURL[key]; };
    function style() {
      const dk = dark();
      const C = dk
        ? { bg: "#11161D", park: "#152019", water: "#15283A", wline: "#1E3D55", res: "#141B23", bld: "#1A222C", bldl: "#232D39", mw: "#4A3E22", mwc: "#2E2716", pr: "#2A3441", prc: "#1D242E", mn: "#202833", rail: "#3A4553", txt: "#C3CCD8", txt2: "#8A95A5", halo: "#11161D", wtxt: "#6E9EBF" }
        : { bg: "#F3F4F6", park: "#E1EEDC", water: "#BFD9EC", wline: "#A3C6E0", res: "#EDEFF2", bld: "#ECEEF1", bldl: "#E2E5EA", mw: "#FBE3A6", mwc: "#E0BE6A", pr: "#FFFFFF", prc: "#D3D8E0", mn: "#FFFFFF", rail: "#A6AFBB", txt: "#2F3846", txt2: "#6A7482", halo: "#FFFFFF", wtxt: "#3F7DA6" };
      const name = ["coalesce", ["get", "name:ko"], ["get", "name"]];
      const road = (id, cls, color, w, minz) => ({ id, type: "line", source: "omt", "source-layer": "transportation", minzoom: minz || 0, filter: ["in", ["get", "class"], ["literal", cls]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 10, w[0], 14, w[1], 17, w[2]] } });
      return {
        version: 8,
        glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
        sources: { omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": C.bg } },
          { id: "res", type: "fill", source: "omt", "source-layer": "landuse", filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood"]]], paint: { "fill-color": C.res } },
          { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": C.park } },
          { id: "wood", type: "fill", source: "omt", "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["wood", "grass"]]], paint: { "fill-color": C.park, "fill-opacity": 0.8 } },
          { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": C.water } },
          { id: "waterway", type: "line", source: "omt", "source-layer": "waterway", paint: { "line-color": C.wline, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 15, 2] } },
          { id: "bld", type: "fill", source: "omt", "source-layer": "building", minzoom: 14, paint: { "fill-color": C.bld, "fill-outline-color": C.bldl, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1] } },
          road("minor", ["minor", "service"], C.mn, [0, 1.5, 7], 12.5),
          road("pri-c", ["primary", "secondary", "tertiary"], C.prc, [0.8, 4.5, 14]),
          road("pri", ["primary", "secondary", "tertiary"], C.pr, [0.4, 3, 11.5]),
          road("mw-c", ["motorway", "trunk"], C.mwc, [1.2, 5.5, 16]),
          road("mw", ["motorway", "trunk"], C.mw, [0.7, 3.8, 13]),
          { id: "rail", type: "line", source: "omt", "source-layer": "transportation", filter: ["in", ["get", "class"], ["literal", ["rail", "transit"]]], paint: { "line-color": C.rail, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 15, 1.6], "line-dasharray": [3, 2] } },
          { id: "water-name-l", type: "symbol", source: "omt", "source-layer": "water_name", filter: ["==", ["geometry-type"], "LineString"], layout: { "text-field": name, "text-font": ["Noto Sans Italic"], "text-size": 13, "symbol-placement": "line" }, paint: { "text-color": C.wtxt, "text-halo-color": C.halo, "text-halo-width": 1.5 } },
          { id: "water-name-p", type: "symbol", source: "omt", "source-layer": "water_name", filter: ["==", ["geometry-type"], "Point"], layout: { "text-field": name, "text-font": ["Noto Sans Italic"], "text-size": 13 }, paint: { "text-color": C.wtxt, "text-halo-color": C.halo, "text-halo-width": 1.5 } },
          // 도로 이름: 큰길(고속·간선)은 13부터, 나머지 큰 도로는 15부터. 분기점·나들목 같은 이름은 뺀다. 구역 카드보다 늘 뒤에 자리 잡는다(겹치면 숨음)
          { id: "road-name-mj", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 13, filter: ["all", ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]], ["!", ["in", "분기점", name]], ["!", ["in", "나들목", name]], ["!", ["in", "IC", name]]], layout: { "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10.5, 16, 12], "symbol-placement": "line", "symbol-spacing": 420, "text-padding": 6, "text-max-angle": 30 }, paint: { "text-color": C.txt2, "text-opacity": 0.85, "text-halo-color": C.halo, "text-halo-width": 1.6 } },
          { id: "road-name", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 15, filter: ["all", ["in", ["get", "class"], ["literal", ["secondary", "tertiary"]]], ["!", ["in", "분기점", name]]], layout: { "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": 11, "symbol-placement": "line", "symbol-spacing": 360, "text-padding": 6 }, paint: { "text-color": C.txt2, "text-opacity": 0.8, "text-halo-color": C.halo, "text-halo-width": 1.6 } },
          { id: "place", type: "symbol", source: "omt", "source-layer": "place", minzoom: 12.5, filter: ["in", ["get", "class"], ["literal", ["suburb", "quarter", "neighbourhood"]]], layout: { "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 12.5, 11, 16, 14] }, paint: { "text-color": C.txt2, "text-halo-color": C.halo, "text-halo-width": 1.6 } },
        ],
      };
    }
    const FC = (f) => ({ type: "FeatureCollection", features: f });
    function overlays() {
      if (!map || !geo) return;
      const dk = dark(), P = palette(), halo = dk ? "#11161D" : "#ffffff";
      const add = (id) => { if (!map.getSource(id)) map.addSource(id, Object.assign({ type: "geojson", data: FC([]) }, /^(zones|zest|zlab|pts)$/.test(id) ? { promoteId: "id" } : {})); };
      ["mask", "seoul", "gul", "zones", "zest", "zlab", "pts", "stn", "sel", "hj", "hi", "sang", "subway", "gun", "dong", "sdim", "sring", "spt", "hov", "sellab", "gudim", "gusel"].forEach(add);
      map.getSource("gun").setData(guLabels());
      map.getSource("dong").setData(dongLabels());
      if (!map.getSource("zpa")) map.addSource("zpa", { type: "geojson", data: FC([]), cluster: true, clusterRadius: 8, clusterMaxZoom: 15 });
      ["zpm", "zps", "zpsh"].forEach(add);
      map.getSource("subway").setData(subwayGeo());
      const outer = [[124, 32], [132, 32], [132, 40], [124, 40], [124, 32]];
      map.getSource("mask").setData({ type: "Feature", geometry: { type: "Polygon", coordinates: [outer, ...geo.seoul] }, properties: {} });
      map.getSource("seoul").setData({ type: "Feature", geometry: { type: "MultiLineString", coordinates: geo.seoul }, properties: {} });
      map.getSource("gul").setData(FC(geo.gu.map((g) => ({ type: "Feature", geometry: { type: "MultiLineString", coordinates: g.r }, properties: { n: g.n } }))));
      map.getSource("stn").setData(FC(D.stations.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s[2], s[1]] }, properties: { n: s[0].replace(/역$/, ""), c: LINE_COL[(s[3] || [])[0]] || "#7A8594", t: (s[3] || []).length } }))));
      const L = (o) => { if (!map.getLayer(o.id)) map.addLayer(o); };
      L({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": dk ? "#0B0F14" : "#ffffff", "fill-opacity": dk ? 0.7 : 0.75 } });
      L({ id: "gu-line", type: "line", source: "gul", paint: { "line-color": dk ? "#3B4656" : "#AEB7C4", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 1.3], "line-dasharray": [2, 2] } });
      L({ id: "seoul-line", type: "line", source: "seoul", paint: { "line-color": P.sub, "line-width": 1.6, "line-opacity": 0.7 } });
      L({ id: "subway-case", type: "line", source: "subway", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": halo, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.8, 14, 4], "line-opacity": 0.5 } });
      L({ id: "subway", type: "line", source: "subway", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 12, 1.2, 14, 2, 16, 2.6], "line-opacity": 0.5 } });
      // 바탕 이름: 구(줌 9.5~13.4) → 동(13.2부터) → 큰 역(12부터, 환승역). 회색으로 작게, 구역 카드가 먼저 자리 잡는다
      const T1 = dk ? "#8A95A5" : "#6A7482", T2 = dk ? "#7A8696" : "#7C8693";
      L({ id: "gu-lab", type: "symbol", source: "gun", minzoom: 8.8, maxzoom: 13.4, layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10.5, 12.5, 12.5], "text-padding": 4, "text-letter-spacing": 0.04, "text-variable-anchor": ["center", "top", "bottom", "right", "left"], "text-radial-offset": 0.7, "text-justify": "auto" }, paint: { "text-color": T1, "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.6, 0.95, 13.4, 0], "text-halo-color": halo, "text-halo-width": 1.6 } });
      L({ id: "dong-lab", type: "symbol", source: "dong", minzoom: 13.2, layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 13.2, 10.5, 16, 12], "text-padding": 6, "text-variable-anchor": ["center", "top", "bottom"], "text-radial-offset": 0.9, "symbol-sort-key": ["get", "k"] }, paint: { "text-color": T2, "text-halo-color": halo, "text-halo-width": 1.6 } });
      // 구역: 네이버 부동산처럼 한 가지 색(브랜드 남색) 반투명 면 + 같은 색 선. 공식 경계 없는 추정 범위는 점선.
      // 내 돈으로 안 되는 곳은 같은 남색을 아주 옅게(feature-state a=false) → 되는 곳만 또렷하게
      const ZC = dk ? "#5B8CFF" : "#1F3A87", ZL = dk ? "#7FA6FF" : "#1F3A87";
      const A = ["boolean", ["feature-state", "a"], true];
      const zo = (k) => (dk ? [10, 0.46, 12, 0.36, 14, 0.25, 16, 0.2] : [10, 0.42, 12, 0.32, 14, 0.2, 16, 0.16]).map((v, i) => (i % 2 ? ["case", A, v * k, (dk ? 0.11 : 0.085) * k] : v));
      const zop = ["interpolate", ["linear"], ["zoom"], ...zo(1)];
      const zlw = ["interpolate", ["linear"], ["zoom"], 10, ["case", A, 0.9, 0.5], 12, ["case", A, 1.3, 0.7], 14, ["case", A, 1.8, 0.9], 16, ["case", A, 2.1, 1]];
      const zlo = ["case", A, 0.95, dk ? 0.42 : 0.38];
      L({ id: "zest-fill", type: "fill", source: "zest", paint: { "fill-color": ZC, "fill-opacity": ["interpolate", ["linear"], ["zoom"], ...zo(0.8)] } });
      L({ id: "zest-line", type: "line", source: "zest", layout: { "line-join": "round" }, paint: { "line-color": ZL, "line-width": zlw, "line-dasharray": [2.2, 1.6], "line-opacity": zlo } });
      L({ id: "zone-fill", type: "fill", source: "zones", paint: { "fill-color": ZC, "fill-opacity": zop, "fill-antialias": true } });
      L({ id: "zone-line", type: "line", source: "zones", layout: { "line-join": "round" }, paint: { "line-color": ZL, "line-width": zlw, "line-opacity": zlo } });
      L({ id: "pts", type: "circle", source: "pts", minzoom: 13, paint: { "circle-color": ZC, "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 4, 16, 6], "circle-stroke-color": halo, "circle-stroke-width": 1.5, "circle-opacity": ["case", A, 0.85, 0.3] } });
      // 구를 고르면(검색·구 누르기): 다른 구는 옅게 덮고 그 구 경계를 굵게
      L({ id: "gu-dim", type: "fill", source: "gudim", paint: { "fill-color": dk ? "#0B0F14" : "#F3F4F6", "fill-opacity": dk ? 0.5 : 0.55 } });
      L({ id: "gu-sel-case", type: "line", source: "gusel", layout: { "line-join": "round" }, paint: { "line-color": halo, "line-width": 5, "line-opacity": 0.85 } });
      L({ id: "gu-sel", type: "line", source: "gusel", layout: { "line-join": "round" }, paint: { "line-color": dk ? "#9DBBFF" : "#1F3A87", "line-width": 2.4 } });
      // 역으로 찾기: 걸어서 1km 밖은 옅게 덮고, 500m·1km 고리를 흐리게
      L({ id: "stn-dim", type: "fill", source: "sdim", paint: { "fill-color": dk ? "#0B0F14" : "#F3F4F6", "fill-opacity": dk ? 0.55 : 0.6 } });
      L({ id: "stn-ring", type: "line", source: "sring", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": dk ? "#9DBBFF" : "#1F3A87", "line-width": 1.4, "line-opacity": ["case", ["==", ["get", "m"], 515], 0.35, 0.55], "line-dasharray": [3, 2] } });
      // 목록에 마우스를 올린 구역(데스크톱)
      L({ id: "hov-fill", type: "fill", source: "hov", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": dk ? "#F5C33B" : "#E8A400", "fill-opacity": 0.22 } });
      L({ id: "hov-line", type: "line", source: "hov", filter: ["==", ["geometry-type"], "Polygon"], layout: { "line-join": "round" }, paint: { "line-color": dk ? "#F5C33B" : "#C98A00", "line-width": 3 } });
      L({ id: "hov-pt", type: "circle", source: "hov", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 13, 14, 10], "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": dk ? "#F5C33B" : "#C98A00", "circle-stroke-width": 3 } });
      // 고른 구역: 면은 조금 진하게 + 굵은 테두리(바깥 흰 테 + 안쪽 남색)
      L({ id: "sel-fill", type: "fill", source: "sel", paint: { "fill-color": ZC, "fill-opacity": dk ? 0.32 : 0.26 } });
      L({ id: "sel-case", type: "line", source: "sel", layout: { "line-join": "round" }, paint: { "line-color": halo, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 16, 8], "line-opacity": 0.9 } });
      L({ id: "sel-line", type: "line", source: "sel", layout: { "line-join": "round" }, paint: { "line-color": dk ? "#9DBBFF" : "#1F3A87", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.6, 16, 4.5] } });
      L({ id: "stn", type: "circle", source: "stn", minzoom: 14, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3.5, 16, 5.5], "circle-color": dk ? "#151B23" : "#ffffff", "circle-stroke-color": ["get", "c"], "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 14, 2, 16, 2.6] } });
      // 큰 역(환승역)은 12부터 작은 점 + '○○역'
      L({ id: "stn-mj", type: "circle", source: "stn", minzoom: 12, maxzoom: 14, filter: [">=", ["get", "t"], 2], paint: { "circle-radius": 2.6, "circle-color": dk ? "#151B23" : "#ffffff", "circle-stroke-color": dk ? "#8A95A5" : "#5F6B7A", "circle-stroke-width": 1.4 } });
      L({ id: "stn-mj-lab", type: "symbol", source: "stn", minzoom: 12, maxzoom: 14, filter: [">=", ["get", "t"], 2], layout: { "text-field": ["concat", ["get", "n"], "역"], "text-font": ["Noto Sans Regular"], "text-size": 10.5, "text-offset": [0, 0.75], "text-anchor": "top", "text-padding": 4, "text-optional": true }, paint: { "text-color": T1, "text-halo-color": halo, "text-halo-width": 1.6 } });
      L({ id: "stn-lab", type: "symbol", source: "stn", minzoom: 14, layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": P.sub, "text-halo-color": halo, "text-halo-width": 1.6 } });
      // ---- 겹쳐 보기 레이어 ----
      const nm = ["coalesce", ["get", "name:ko"], ["get", "name"], ""];
      // 학교·병원·마트: 구역(남색)과 헷갈리지 않게 레이어마다 다른 색 + 그림 아이콘(동그라미 안 흰 그림)
      ["edu", "med", "mart"].forEach((k) => { const c = poiIcon(k, dk, 2); if (map.hasImage("poi-" + k)) map.removeImage("poi-" + k); map.addImage("poi-" + k, c.getContext("2d").getImageData(0, 0, c.width, c.height), { pixelRatio: 2 }); });
      const poiTxt = (id, filter, color, minz) => [
        { id: id, type: "symbol", source: "omt", "source-layer": "poi", minzoom: minz, filter, layout: { visibility: "none", "icon-image": "poi-" + id.slice(3), "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.85, 16, 1.1], "icon-allow-overlap": true, "icon-ignore-placement": false, "icon-padding": 1 }, paint: {} },
        { id: id + "-lab", type: "symbol", source: "omt", "source-layer": "poi", minzoom: Math.max(minz, 14), filter, layout: { visibility: "none", "text-field": nm, "text-font": ["Noto Sans Regular"], "text-size": 10, "text-offset": [0, 1.15], "text-anchor": "top", "text-optional": true, "text-max-width": 8 }, paint: { "text-color": color, "text-halo-color": halo, "text-halo-width": 1.6 } },
      ];
      const SHOPC = ["shop", "grocery", "restaurant", "cafe", "fast_food", "bar", "beer", "bakery", "clothing_store", "ice_cream", "alcohol_shop", "convenience", "hairdresser", "laundry", "shoe_shop", "jewelry", "optician", "furniture", "mobile_phone", "cosmetics", "florist", "butcher", "deli", "pharmacy"];
      const sz = (f, k) => ["interpolate", ["exponential", 1.6], ["zoom"], 10, ["*", ["sqrt", ["get", f]], k * 0.35], 13, ["*", ["sqrt", ["get", f]], k], 16, ["*", ["sqrt", ["get", f]], k * 3.2]];
      // 상권: 서울·구 줌(13 아래)은 원 수백 개가 주황 덩어리가 되므로 열지도(진할수록 점포 많음), 13부터 원(크기 = 점포 수)으로 바뀐다
      const bizFade = (a, b) => ["interpolate", ["linear"], ["zoom"], 12.6, a, 13.2, b];
      L({ id: "ly-biz-heat", type: "heatmap", source: "sang", maxzoom: 13.3, filter: [">=", ["get", "st"], 80], layout: { visibility: "none" }, paint: { "heatmap-weight": ["interpolate", ["linear"], ["get", "st"], 80, 0.15, 400, 0.6, 1200, 1], "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 9, 0.7, 13, 1.3], "heatmap-radius": ["interpolate", ["exponential", 1.6], ["zoom"], 9, 7, 11, 14, 13, 30], "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(232,140,40,0)", 0.2, dk ? "rgba(236,150,60,.22)" : "rgba(240,160,70,.22)", 0.5, dk ? "rgba(236,150,60,.45)" : "rgba(226,128,32,.42)", 0.8, dk ? "rgba(245,170,90,.62)" : "rgba(205,105,15,.56)", 1, dk ? "rgba(255,190,120,.75)" : "rgba(180,85,5,.68)"], "heatmap-opacity": bizFade(0.9, 0) } });
      L({ id: "ly-biz", type: "circle", source: "sang", minzoom: 12.6, filter: [">=", ["get", "st"], 80], layout: { visibility: "none" }, paint: { "circle-radius": sz("st", 0.9), "circle-color": dk ? "rgba(236,150,60,.16)" : "rgba(232,140,40,.12)", "circle-stroke-color": dk ? "rgba(236,150,60,.7)" : "rgba(200,110,20,.6)", "circle-stroke-width": 1, "circle-opacity": bizFade(0, 1), "circle-stroke-opacity": bizFade(0, 1) } });
      L({ id: "ly-biz-lab", type: "symbol", source: "sang", minzoom: 13, filter: [">=", ["get", "st"], 80], layout: { visibility: "none", "text-field": ["format", ["get", "n"], {}, "\n", {}, ["concat", "점포 ", ["to-string", ["get", "st"]], ["case", [">", ["get", "sa"], 0], ["concat", " · 분기 매출 ", ["to-string", ["get", "sa"]], "억"], ""]], { "font-scale": 0.85 }], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-optional": true, "text-max-width": 9 }, paint: { "text-color": dk ? "#F2B37A" : "#9A4E0C", "text-halo-color": halo, "text-halo-width": 1.8 } });
      L({ id: "ly-acad", type: "circle", source: "sang", filter: [">=", ["get", "ac"], 15], layout: { visibility: "none" }, paint: { "circle-radius": sz("ac", 1.9), "circle-color": dk ? "rgba(190,150,240,.3)" : "rgba(122,63,184,.2)", "circle-stroke-color": dk ? "#C9A0F0" : "#7A3FB8", "circle-stroke-width": 1.2 } });
      L({ id: "ly-acad-lab", type: "symbol", source: "sang", minzoom: 11.5, filter: [">=", ["get", "ac"], 40], layout: { visibility: "none", "text-field": ["concat", ["get", "n"], "\n학원 ", ["to-string", ["get", "ac"]]], "text-font": ["Noto Sans Regular"], "text-size": 10, "text-optional": true, "text-max-width": 8 }, paint: { "text-color": dk ? "#D8B8F6" : "#5E2A96", "text-halo-color": halo, "text-halo-width": 2 } });
      poiTxt("ly-edu", ["all", ["in", ["get", "class"], ["literal", ["school"]]], ["any", ["in", "초등학교", nm], ["in", "중학교", nm], ["in", "고등학교", nm]]], POIC(dk).edu[1], POIZ).forEach(L);
      poiTxt("ly-med", ["all", ["==", ["get", "class"], "hospital"], ["any", ["in", "병원", nm], ["in", "의료원", nm], ["in", "의료센터", nm]]], POIC(dk).med[1], POIZ).forEach(L);
      poiTxt("ly-mart", ["all", ["in", ["get", "subclass"], ["literal", ["supermarket", "department_store", "mall", "wholesale"]]], ["any", ["in", "이마트", nm], ["in", "홈플러스", nm], ["in", "롯데마트", nm], ["in", "코스트코", nm], ["in", "트레이더스", nm], ["in", "백화점", nm], ["in", "하나로", nm]]], POIC(dk).mart[1], POIZ).forEach(L);
      L({ id: "ly-hj", type: "circle", source: "hj", layout: { visibility: "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 8], "circle-color": halo, "circle-stroke-color": ["get", "c"], "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 15, 4] } });
      L({ id: "ly-hj-lab", type: "symbol", source: "hj", minzoom: 13.5, layout: { visibility: "none", "text-field": ["get", "sn"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 16, 11], "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true, "text-max-width": 8, "symbol-sort-key": 10 }, paint: { "text-color": dk ? "#AAB3C0" : "#5B6472", "text-halo-color": halo, "text-halo-width": 1 } });
      // 신고가: 줌 13 아래는 구역 가운데 작은 빨간 점, 13부터는 구역 카드 아래 칸에 '▲신고가' 배지(카드 데이터 h)
      L({ id: "ly-hi", type: "circle", source: "hi", maxzoom: 13, layout: { visibility: "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 13, 4.5], "circle-color": dk ? "#FF8A75" : "#D92D20", "circle-stroke-color": halo, "circle-stroke-width": 1.4 } });
      // ---- 구역 카드(네이버·리치고식): 위 칸 남색에 이름, 아래 흰 칸에 핵심 숫자. 줌 13부터(그 아래는 면만, 살 수 있는 곳엔 핀) ----
      // 9-patch 이미지 하나로 두 칸 배경을 만들고 icon-text-fit으로 글자에 맞춘다(위·아래 늘림 구간이 같아 두 줄 경계가 가운데에 온다)
      const CARD_TOP = dk ? "#3E6AE0" : "#1F3A87", CARD_BOT = dk ? "#1A2130" : "#FFFFFF", CARD_INK = dk ? "#E8EDF5" : "#191F28";
      const rr = (x, X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
      const img = (id, two, lite) => {
        const TOP = lite ? (dk ? "#273041" : "#E8ECF4") : CARD_TOP, EDGE = lite ? (dk ? "#3B4656" : "#B8C2D6") : CARD_TOP;
        if (map.hasImage(id)) map.removeImage(id);
        const k = 2, W = 40, H = two ? 38 : 22, sh = 2, c = document.createElement("canvas"); c.width = W * k; c.height = (H + sh) * k;
        const x = c.getContext("2d"); x.scale(k, k);
        x.fillStyle = dk ? "rgba(0,0,0,.35)" : "rgba(15,30,70,.16)"; rr(x, 0.5, 1.5, W - 1, H - 1, 6); x.fill();   // 아래로 살짝 그림자
        rr(x, 0.5, 0.5, W - 1, H - 1, 6); x.save(); x.clip();
        x.fillStyle = TOP; x.fillRect(0, 0, W, H);
        if (two) { x.fillStyle = CARD_BOT; x.fillRect(0, H / 2, W, H / 2); }
        x.restore(); x.strokeStyle = EDGE; x.lineWidth = 1; rr(x, 0.5, 0.5, W - 1, H - 1, 6); x.stroke();
        const m = H / 2;
        map.addImage(id, x.getImageData(0, 0, W * k, (H + sh) * k), { pixelRatio: k, stretchX: [[8 * k, 32 * k]], stretchY: two ? [[5 * k, (m - 4) * k], [(m + 4) * k, (H - 5) * k]] : [[7 * k, (H - 7) * k]], content: two ? [7 * k, 4 * k, 33 * k, (H - 4) * k] : [7 * k, 4 * k, 33 * k, (H - 4) * k] });
      };
      img("zcard", true); img("zcard1", false); img("zcardL", true, true); img("zcardL1", false, true);
      const csz = ["interpolate", ["linear"], ["zoom"], 13, 11, 16, 12.5];
      // 카드 형식은 하나: 금액이 있으면 '이름 / X억'(두 칸), 없으면 이름만(한 칸). 신고가를 켜면 아래 칸에 빨간 '▲신고가'
      // 내 돈으로 되는 곳 = 남색 카드, 안 되는 곳 = 옅은 회청색 카드(면과 같은 규칙)
      const NM_C = ["case", ["==", ["get", "y"], 1], "#FFFFFF", dk ? "#C3CCD8" : "#2E3A55"];
      const HI = dk ? "#FF9C8A" : "#C0261B", two = ["any", ["!=", ["get", "s"], ""], ["!=", ["get", "h"], ""]];
      const card = (id, f, maxz, src, top) => L({ id, type: "symbol", source: src || "zlab", minzoom: top ? 11 : 13, maxzoom: maxz || 24, filter: f, layout: { ...(top ? { "icon-allow-overlap": true, "text-allow-overlap": true } : {}), "icon-image": ["concat", ["case", ["==", ["get", "y"], 1], "zcard", "zcardL"], ["case", two, "", "1"]], "icon-text-fit": "both", "icon-text-fit-padding": [2, 2, 2, 2], "text-field": ["case", two, ["format", ["get", "n"], { "text-color": NM_C }, "\n", {}, ["get", "s"], { "text-color": CARD_INK }, ["case", ["all", ["!=", ["get", "s"], ""], ["!=", ["get", "h"], ""]], " ", ""], {}, ["get", "h"], { "text-color": HI, "font-scale": 0.9 }], ["format", ["get", "n"], { "text-color": NM_C }]], "text-font": ["Noto Sans Bold"], "text-size": csz, "text-line-height": 1.55, "text-max-width": 20, "text-padding": 3, ...(top ? { "text-anchor": "top", "text-offset": [0, 0.35] } : { "text-variable-anchor": ["top", "bottom", "right", "left"], "text-radial-offset": 0.35, "text-justify": "center" }), "symbol-sort-key": ["get", "k"] }, paint: {} });
      card("zone-lab", ["==", ["get", "p"], 0]);
      card("zone-lab-p", ["==", ["get", "p"], 1], 16);   // 핀 있는 곳은 16부터 핀 라벨('이름 · X억')로
      // ---- 핀: 핀 끝 = 구역 중심. 순서 선택 > 내 핀 > 살 수 있는 핀(위 레이어가 먼저 자리 잡음) ----
      pinImgs(dk);
      const pinL = (id, src, minz, extra) => L(Object.assign({ id, type: "symbol", source: src, minzoom: minz || 0, layout: { "icon-image": ["concat", "zpin-", ["get", "t"], ["get", "x"]], "icon-anchor": "bottom", "icon-size": ["get", "s"], "icon-offset": ["get", "off"], "icon-allow-overlap": false, "icon-ignore-placement": src === "zpa", "icon-padding": 0, "symbol-sort-key": ["get", "k"], "text-field": ["step", ["zoom"], "", 16, ["get", "lb"]], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-anchor": "left", "text-offset": [0.9, -1.25], "text-max-width": 16, "text-optional": true }, paint: { "icon-opacity": ["get", "o"], "text-opacity": ["get", "o"], "text-color": P.ink, "text-halo-color": halo, "text-halo-width": 1.8 } }, extra || {}));
      L({ id: "pin-sh", type: "circle", source: "zpsh", minzoom: 12, paint: { "circle-radius": ["get", "r"], "circle-opacity": ["get", "o"], "circle-color": dk ? "#000000" : "#1F3A87", "circle-blur": 0.5, "circle-pitch-alignment": "map" } });
      L({ id: "pin-clu", type: "symbol", source: "zpa", filter: ["has", "point_count"], layout: { "icon-image": ["step", ["zoom"], "zpin-a", 12, "zclu"], "icon-size": ["step", ["zoom"], 0.55, 12, 1], "icon-anchor": ["step", ["zoom"], "bottom", 12, "center"], "icon-allow-overlap": false, "icon-ignore-placement": true, "text-field": ["step", ["zoom"], "", 12, ["get", "point_count_abbreviated"]], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#FFFFFF" } });
      pinL("pin-a", "zpa", 0, { filter: ["!", ["has", "point_count"]] });
      pinL("pin-m", "zpm", 10);
      pinL("pin-s", "zps", 0);
      // 보이지 않는 핀 자리표: 서울·구 줌(13 아래)에서 구 이름·큰 역 이름이 ₩ 핀 밑에 깔리지 않고 옆으로 비켜 가게(핀 자체는 배치 계산에서 빠져 있음)
      // 핀 레이어들 아래에 둬서 핀끼리의 배치(겹치면 숨김)에는 끼어들지 않는다
      if (!map.getLayer("pin-blk")) map.addLayer({ id: "pin-blk", type: "symbol", source: "zpa", layout: { "icon-image": "zpin-a", "icon-anchor": "bottom", "icon-size": ["coalesce", ["get", "s"], 0.55], "icon-allow-overlap": true, "icon-padding": 1 }, paint: { "icon-opacity": 0 } }, "pin-sh");
      // 보이지 않는 역 자리표(줌 14+): 구역 카드가 역 점을 덮지 않고 아래·위·옆으로 비켜 가게(카드는 자리 4곳 중 빈 곳으로)
      if (!map.getLayer("stn-blk")) map.addLayer({ id: "stn-blk", type: "symbol", source: "stn", minzoom: 14, layout: { "text-field": "●", "text-font": ["Noto Sans Regular"], "text-size": 14, "text-allow-overlap": true, "text-padding": 1 }, paint: { "text-opacity": 0 } }, "pin-sh");
      // 고른 구역 카드: 다른 카드·핀에 밀려 숨지 않게 맨 위에 늘 그린다(값은 그 구역 id로 계산)
      card("sel-lab", ["==", ["get", "p"], 0], 24, "sellab", true);
      card("sel-lab-p", ["==", ["get", "p"], 1], 16, "sellab", true);
      // 역 표시: 흰 점 + 남색 테두리 + '○○역'
      L({ id: "spt-c", type: "circle", source: "spt", filter: ["==", ["get", "k"], "s"], paint: { "circle-radius": 7, "circle-color": dk ? "#151B23" : "#FFFFFF", "circle-stroke-color": dk ? "#9DBBFF" : "#1F3A87", "circle-stroke-width": 3 } });
      // 고리 이름('걸어서 10분·15분')은 고리 위 끝에 고정
      L({ id: "spt-rlab", type: "symbol", source: "spt", filter: ["==", ["get", "k"], "r"], layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Regular"], "text-size": 10.5, "text-anchor": "bottom", "text-offset": [0, -0.2], "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": dk ? "#C7D6FF" : "#1F3A87", "text-halo-color": halo, "text-halo-width": 2 } });
      // 역 이름: 구역 카드가 먼저 자리 잡고(카드 레이어 아래에 둠), 역 이름은 아래·오른쪽·왼쪽·위 중 비어 있는 쪽에. 다 막히면 아래에 겹쳐서라도 보인다
      if (!map.getLayer("spt-lab")) map.addLayer({ id: "spt-lab", type: "symbol", source: "spt", filter: ["==", ["get", "k"], "s"], layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-variable-anchor": ["bottom", "left", "right", "top"], "text-radial-offset": 0.85, "text-padding": 2, "text-justify": "auto", "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": dk ? "#C7D6FF" : "#1F3A87", "text-halo-color": halo, "text-halo-width": 2 } }, "zone-lab");
      // 목록 줄에 마우스: 그 구역 이름표를 맨 위에(줌과 상관없이, 다른 카드에 안 가림)
      L({ id: "hov-lab", type: "symbol", source: "hov", filter: ["==", ["geometry-type"], "Point"], layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": 12.5, "text-anchor": "bottom", "text-offset": [0, -1.35], "text-allow-overlap": true, "text-ignore-placement": false }, paint: { "text-color": dk ? "#F5C33B" : "#7A5200", "text-halo-color": halo, "text-halo-width": 2.4 } });
      stnDraw(); hovDraw(); guDraw();
      PIN.clear(); pinAnim.clear(); pinK = null;
      ready = true;
      layerData();
      layers();
      paint();
      focus(pendFocus); pendFocus = false;
      if (stnF && stnPend) stnGo();
      notes(); edgeSoon();
    }
    // 구 이름 자리: 가장 큰 고리의 면적 중심. 동 이름 자리: 그 동(지번 주소 첫 낱말) 구역들의 평균 위치
    function guLabels() {
      const F = [];
      ((geo && geo.gu) || []).forEach((g) => {
        let best = null, ba = 0;
        (g.r || []).forEach((rg) => {
          let a = 0, x = 0, y = 0;
          for (let i = 0, n = rg.length - 1; i < n; i++) { const [x0, y0] = rg[i], [x1, y1] = rg[i + 1], f = x0 * y1 - x1 * y0; a += f; x += (x0 + x1) * f; y += (y0 + y1) * f; }
          if (Math.abs(a) > ba) { ba = Math.abs(a); best = [x / (3 * a), y / (3 * a)]; }
        });
        if (best && isFinite(best[0])) F.push({ type: "Feature", geometry: { type: "Point", coordinates: best }, properties: { n: g.n } });
      });
      return FC(F);
    }
    function dongLabels() {
      const M = new Map();
      R.forEach((r) => {
        if (!r.ll) return;
        const t = String(r.j || "").trim().split(/\s+/)[0] || "";
        if (!/^[가-힣\d]{1,8}(동|가)$/.test(t)) return;
        // 같은 이름 동끼리 3km 안이면 하나로(구 경계에 걸친 동이 두 번 찍히지 않게)
        const L = M.get(t) || []; M.set(t, L);
        let m = L.find((q) => Math.hypot((q.a / q.c - r.ll[0]) * 111, (q.b / q.c - r.ll[1]) * 88) < 3);
        if (!m) { m = { n: t, a: 0, b: 0, c: 0 }; L.push(m); }
        m.a += r.ll[0]; m.b += r.ll[1]; m.c++;
      });
      return FC([...M.values()].flat().map((m) => ({ type: "Feature", geometry: { type: "Point", coordinates: [m.b / m.c, m.a / m.c] }, properties: { n: m.n, k: -m.c } })));
    }
    // 노선: 사이트 SVG 지도 좌표(xy)를 역 좌표로 맞춘 1차 변환의 역변환으로 위경도로 바꿔 그린다
    let SUBG = null;
    function subwayGeo() {
      if (SUBG) return SUBG;
      const S = (D.stations || []).filter((s) => s[4] != null && s[5] != null);
      const fit = (ix) => {   // v = a*lng + b*lat + c (최소제곱)
        let m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
        S.forEach((s) => { const x = [s[2], s[1], 1]; for (let i = 0; i < 3; i++) { v[i] += x[i] * s[ix]; for (let j = 0; j < 3; j++) m[i][j] += x[i] * x[j]; } });
        const det = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
        const d0 = det(m);
        return [0, 1, 2].map((k) => det(m.map((row, i) => row.map((c, j) => (j === k ? v[i] : c)))) / d0);
      };
      const X = fit(4), Y = fit(5);
      const dd = X[0] * Y[1] - X[1] * Y[0];
      const toLL = (x, y) => { const px = x - X[2], py = y - Y[2]; return [(px * Y[1] - py * X[1]) / dd, (X[0] * py - Y[0] * px) / dd]; };
      const F = [];
      Object.entries(TRD.paths || {}).forEach(([li, arr]) => {
        const c = (TRD.col || [])[+li] || "#888";
        (Array.isArray(arr) ? arr : [arr]).forEach((str) => {
          const pts = String(str).trim().split(/\s+/).map((q) => q.split(",").map(Number)).filter((q) => q.length === 2 && isFinite(q[0]));
          if (pts.length > 1) F.push({ type: "Feature", geometry: { type: "LineString", coordinates: pts.map(([x, y]) => toLL(x, y)) }, properties: { c, n: (TRD.lines || [])[+li] || "" } });
        });
      });
      return (SUBG = FC(F));
    }
    // 기본은 압구정을 가운데 둔 한강 W자 구간. 내 돈으로 되는 구역이 그 밖에 있으면 거기까지 넓힌다.
    const CORE = [[126.882, 37.494], [127.118, 37.562]];   // 망원~잠실, 가운데가 반포·압구정 사이(한강 W자가 좌우 대칭으로 들어오게)
    function affBB() {
      let [[a, b], [c, d]] = CORE;
      try {
        const f = okSafe(), P = R.filter((r) => r.ll && f(r)).map((r) => r.ll);
        if (P.length) {
          const la = P.map((x) => x[0]).sort((x, y) => x - y), lo = P.map((x) => x[1]).sort((x, y) => x - y);
          const q = (A, f) => A[Math.max(0, Math.min(A.length - 1, Math.round((A.length - 1) * f)))];
          const t = P.length >= 8 ? 0.04 : 0;   // 동떨어진 한두 곳 때문에 너무 멀어지지 않게
          a = Math.min(a, q(lo, t)); c = Math.max(c, q(lo, 1 - t)); b = Math.min(b, q(la, t)); d = Math.max(d, q(la, 1 - t));
        }
      } catch (e) {}
      // PC: 첫 화면에서 서울 전체가 보이게(보이는 부분 안에) — 폰은 작은 지도라 내 돈으로 되는 곳 둘레만
      if (!MQ_SHEET.matches) { a = Math.min(a, SEOUL_BB[0][0]); b = Math.min(b, SEOUL_BB[0][1]); c = Math.max(c, SEOUL_BB[1][0]); d = Math.max(d, SEOUL_BB[1][1]); }
      return [[a, b], [c, d]];
    }
    // 지도 위에 떠 있는 것(위 게이지·아래 '목록 보기')을 피한 여백
    // settled = 곧 페이지가 지도 칸이 머리 밑에 붙는 자리까지 스크롤된다(구 고르기). 지금 자리가 아니라 그 자리 기준으로 보이는 부분을 잰다
    function fitPad(settled) {
      const P = { top: 14, bottom: 14, left: 20, right: 20 };   // 양끝 핀·구 이름이 가장자리에 붙지 않게
      try {
        const cv = map.getCanvas().getBoundingClientRect();
        // 데스크톱 끼워 둔 지도: 오른쪽 위 레일·가장자리 카드 자리를 비워 양끝 구역(강서·양천 등)이 잘리지 않게
        // 처음 화면에서 지도 아래쪽이 창 밖이면 보이는 부분 안에 맞춘다
        if (!MQ_SHEET.matches) {
          let bot = cv.bottom;
          if (settled && !document.documentElement.classList.contains("s-full")) { const mc = document.querySelector("#mapTop .main>.mapcard"); if (mc) { const top0 = (HDR() || 56) + 8 + (cv.top - mc.getBoundingClientRect().top); bot = Math.min(cv.bottom, top0 + cv.height); } }
          P.left = 40; P.right = Math.max(40, railPad()); P.top = 30; P.bottom = 24 + Math.round(Math.min(cv.height * 0.62, Math.max(0, bot - innerHeight)));
        }
        const ov = (sel) => { const e = document.querySelector(sel); if (!e || e.hidden || !e.offsetWidth) return null; const b = e.getBoundingClientRect(); return b.bottom > cv.top && b.top < cv.bottom && b.right > cv.left && b.left < cv.right ? b : null; };
        const m = ov(".s-mini"); if (m && m.width > cv.width * 0.6 && m.top <= cv.top + 40) P.top = Math.round(m.bottom - cv.top + 10);
        const x = ov(".s-fullx"); if (x) P.bottom = Math.round(cv.bottom - x.top + 6);
      } catch (e) {}
      return P;
    }
    function fitTo(bb, anim, maxZ) {
      const pad = fitPad(), cam = map.cameraForBounds(bb, { padding: pad, maxZoom: maxZ });
      if (!cam) return;
      let z = cam.zoom;
      // 세로로 긴 폰 화면: 서울(가로로 넓음)이 위아래로 남으면 조금 더 당겨서 채운다(양옆은 살짝 잘려도 손가락으로 밀어 봄)
      try {
        const cv = map.getCanvas(), H = cv.clientHeight - pad.top - pad.bottom, W = cv.clientWidth;
        const y0 = maplibregl.MercatorCoordinate.fromLngLat([bb[0][0], bb[1][1]]).y, y1 = maplibregl.MercatorCoordinate.fromLngLat([bb[0][0], bb[0][1]]).y;
        const h = (y1 - y0) * 512 * Math.pow(2, z);
        if (MQ_SHEET.matches && H > W * 1.15 && h > 0 && H / h > 1.3) z +=Math.min(0.45, Math.log2(H / h) * 0.5);
      } catch (e) {}
      map.easeTo({ center: cam.center, zoom: Math.min(z, maxZ + 0.75), duration: anim && !reduceMotion() ? 700 : 0 });
    }
    function fitAff(anim, force) {
      if (!map || !ready || mapView !== "seoul" || gu) return;
      map.resize();
      if (stnF) return;   // 역을 보고 있는 동안은 자동 맞춤으로 옮기지 않는다
      if (!force && typeof window.ZP_bbOn === "function" && window.ZP_bbOn()) return;   // 목록이 '지도 범위만'을 따르는 동안도(금액을 바꿔도 보던 곳 그대로)
      fitTo(affBB(), anim, 12);
    }
    // 지도 라이브러리(~180KB)·경계(geo.json ~115KB)·타일은 지도 칸이 화면 근처에 올 때 처음 불러온다(도구 화면으로 바로 들어온 경우 등).
    // 그 전엔 SVG 간단 지도(또는 첫 화면 섬의 자리 그림)가 그대로 보인다. 한 번 뜬 뒤 동작은 예전과 같다.
    let nearIO = null;
    const isNear = () => { const b = $("mapbox"); if (!b) return true; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > -400 && r.top < innerHeight + 400; };
    function whenNear(fn) {
      if (isNear() || typeof IntersectionObserver !== "function") return true;
      if (!nearIO) {
        nearIO = new IntersectionObserver((es) => { if (!es.some((e) => e.isIntersecting)) return; nearIO.disconnect(); nearIO = null; fn(); }, { rootMargin: "400px 0px" });
        nearIO.observe($("mapbox"));
      }
      return false;
    }
    function seoul() {
      gu = null; guDraw();
      ui();
      if (!want || failed) return show(false);
      if (!map && !whenNear(() => { if (mapView === "seoul" && !gu) seoul(); })) return;
      show(true);
      Promise.all([loadLib(), loadGeo()])
        .then(() => {
          if (mapView !== "seoul") return;
          if (!init()) { show(false); return; }
          // 처음엔 서울 전체가 아니라 '내 돈으로 되는 구역'이 모인 곳에 맞춘다(폰 지도는 작아서 전체는 답답함)
          const fitS = () => { if (stnF) { if (stnPend) stnGo(); return; } if (mapView === "seoul" && !gu) { map.resize(); if (ready) fitTo(affBB(), false, 12); else map.fitBounds(CORE, { padding: 12, duration: 0 }); } };
          fitS(); requestAnimationFrame(fitS); map.once("idle", fitS);
          map.once("idle", () => { try { dispatchEvent(new Event("zp:mapready")); } catch (e) {} });
          if (ready) paint();
        })
        .catch(() => { failed = true; show(false); });
    }
    function layerData() {
      const F = [];
      (HJD.items || []).forEach((h) => {
        if (/개통/.test(h.st || "") && !(h.stn || []).some(([, s]) => !/개통/.test(s))) return;
        (h.stn || []).forEach(([n, s]) => { if (/개통/.test(s)) return; const st = stnBy(n); if (st) F.push({ type: "Feature", geometry: { type: "Point", coordinates: [st.ll[1], st.ll[0]] }, properties: { n: `${h.n} ${n}`, sn: (`${h.n.replace(/\s*\(.*\)$/, "")} ${n}`).slice(0, 10), s, c: h.c || "#7A3FB8" } }); });
        if (h.pt && h.pt.length === 2) { const [a, b] = h.pt; const ll = a > 90 ? [a, b] : [b, a]; F.push({ type: "Feature", geometry: { type: "Point", coordinates: ll }, properties: { n: h.n.replace(/\s*\(.*\)$/, ""), sn: h.n.replace(/\s*\(.*\)$/, "").slice(0, 10), s: h.st || "", c: h.c || "#7A3FB8" } }); }
      });
      map.getSource("hj").setData(FC(F));
      const H = [];
      R.forEach((r) => { const t = r.tx && r.tx.hi, z = geo && geo.z[r.id]; if (!t || r.dn) return; const c = z ? z.l : r.ll ? [r.ll[1], r.ll[0]] : null; if (c) H.push({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: { t: `▲ 24년 이후 최고 ${t[1].slice(2, 4)}.${t[1].slice(4, 6)}` } }); });
      map.getSource("hi").setData(FC(H));
      if (lyr.has("biz") || lyr.has("acad")) ZXS.load().then((S) => { if (!S || !map.getSource("sang")) return; map.getSource("sang").setData(FC(S.items.map((x) => ({ type: "Feature", geometry: { type: "Point", coordinates: [x[0], x[1]] }, properties: { n: x[2], st: x[4], ac: x[5], sa: x[6] } })))); const q = $("lmSangQ"); if (q) q.textContent = `(${S.q})`; });
    }
    function layers() {
      if (!map || !ready) return;
      const ids = { hj: ["ly-hj", "ly-hj-lab"], hi: ["ly-hi"], edu: ["ly-edu", "ly-edu-lab"], acad: ["ly-acad", "ly-acad-lab"], biz: ["ly-biz-heat", "ly-biz", "ly-biz-lab"], med: ["ly-med", "ly-med-lab"], mart: ["ly-mart", "ly-mart-lab"] };
      Object.entries(ids).forEach(([k, ls]) => ls.forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, "visibility", lyr.has(k) ? "visible" : "none")));
    }
    function labelOf(r) {
      if (BINS[colorBy]) { const v = metric(r); if (v == null) return ""; return colorBy === "old" ? `노후 ${v}%` : colorBy === "vol" ? `1년 ${v}건` : `1년 ${v > 0 ? "+" : ""}${v}%`; }
      if (colorBy === "cash") {
        const k = dotState(r);
        if (k === "y" || k === "n") {
          const x = gapMode() ? gapOf(r) : investC(r);
          const need = gapMode() ? x.now : effBasis() === "total" ? x.needTotal : x.needBuy;
          if (need != null && isFinite(need)) return `${gapMode() ? "지금" : effBasis() === "total" ? "입주까지" : "지금"} ${e2(need)}억`;
        }
        return CASH_LAB[k] || "";
      }
      return r.src === "moa" ? "모아타운" : stageName(r);
    }
    // 카드 아래 칸: 값이 있으면 금액(지금 X억), 없으면 단계
    // 카드 아래 칸: 금액(X억)만. 금액이 없으면 빈칸 → 카드는 이름만 한 칸
    function cardVal(r) {
      const t = labelOf(r);
      if (BINS[colorBy]) return t || "";
      const m = /([\d.]+억)/.exec(t || "");
      return m ? m[1] : "";
    }
    // 같은 짧은 이름이 둘 이상이면(예: '역촌역세권 장기전세' 3곳) 지도 글자에 동을 붙여 구분한다
    let NMC = null;
    const dongOfR = (r) => { const t = String(r.j || "").trim().split(/\s+/)[0] || ""; return /^[가-힣\d]{1,8}(동|가)$/.test(t) ? t : r.g || ""; };
    const nmOf = (r) => {
      if (!NMC) { NMC = new Map(); R.forEach((x) => { const k = shortName(x.n) || ""; NMC.set(k, (NMC.get(k) || 0) + 1); }); }
      const n = shortName(r.n) || "";
      return NMC.get(n) > 1 ? { n, d: dongOfR(r) } : { n, d: "" };
    };
    const cardName = (r) => {
      let { n, d } = nmOf(r);
      // 이름이 이미 '…(동)'으로 끝나면(검색 쪽 shortName이 붙인 구분) 그 괄호는 자르지 않는다
      const m = /^(.*\S)\s*\(([^()]{1,8})\)$/.exec(n);
      if (m) { n = m[1]; d = d || m[2]; }
      if (!d) return n.length > 10 ? n.slice(0, 9) + "…" : n;
      const a = n.length + d.length + 2 <= 13 ? n : n.split(/\s+/)[0].slice(0, 9);
      return `${a}(${d})`;
    };
    const fullName = (r) => { const { n, d } = nmOf(r); return d ? `${n}(${d})` : n; };
    let labSel = null;
    const hiOf = (r) => { const t = r.tx && r.tx.hi; return t && !r.dn ? t : null; };
    function paint() {
      if (!map || !ready || !geo) return;
      const Z = geo.z;
      const vis = R.filter((r) => r.ll && visible(r) && kindOk(r));
      const off = [], est = [], lab = [], pts = [], MS = mineSet(), okF = okSafe(), hiOn = lyr.has("hi"), selId = cur && cur.id;
      let selF = null;
      for (const r of vis) {
        const z = Z[r.id];
        const s = cardVal(r), y = okF(r) ? 1 : 0, pp = y || MS.has(r.id) ? 1 : 0, h = hiOn && hiOf(r) ? "▲신고가" : "";
        // 정렬 키: 살 수 있는 곳 → 신고가(켰을 때) → 금액 있는 곳 → 나머지 (작을수록 먼저 자리 잡음)
        const k = (y ? 0 : s ? 2 : 3) - (h ? 1 : 0);
        const lf = { type: "Feature", geometry: { type: "Point", coordinates: z ? z.l : [r.ll[1], r.ll[0]] }, properties: { id: r.id, n: cardName(r), s, h, y, k: z ? k : k + 0.5, p: pp } };
        if (r.id === selId) selF = lf; else lab.push(lf);   // 고른 구역 카드는 따로(sel-lab) 늘 보이게
        if (z) (z.e ? est : off).push({ type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: { id: r.id } });
        else pts.push({ type: "Feature", geometry: { type: "Point", coordinates: [r.ll[1], r.ll[0]] }, properties: { id: r.id } });
      }
      labSel = selId || null;
      map.getSource("zones").setData(FC(off));
      map.getSource("zest").setData(FC(est));
      map.getSource("zlab").setData(FC(lab));
      map.getSource("sellab").setData(FC(selF ? [selF] : []));
      map.getSource("pts").setData(FC(pts));
      legend();
      pins(true);
    }
    // ===================== 핀: 핀이 꽂힌 구역 = 내 돈으로 살 수 있는 곳 =====================
    // 크기: 줌 12 아래 15px(머리 10.5px), 12~13 16px, 14~15 22px, 16 이상 28px(+'이름 · X억'). 핀 끝이 구역 중심.
    // 살 수 있는 핀 = 남색 머리 + 흰 집, 내 핀 = 노란 머리 + 남색 집(줌 10부터 늘 보임), 선택 = 1.25배 + 후광. 집 모양 = 앱 아이콘(icon.svg)과 같은 꼴.
    // 게이지를 움직이면 새로 되는 곳은 24px 위에서 떨어져 꽂히고(320ms, 살짝 튕김 + 그림자 펄스), 안 되는 곳은 줄며 사라진다.
    const PIN = new Map();      // id → { ll, r } 지금 꽂혀 있어야 하는 '살 수 있는' 핀
    const pinAnim = new Map();  // id → { kind: drop|fi|fo|out, t0, d, ll, r }
    let pinK = null, pinRaf = 0, pinT = 0, pinTm = 0, pinSnap = null, pinHooked = false, toastEl = null, toastTm = 0;
    const PIN_COL = (dk) => (dk ? { a: "#6C8CFF", m: "#FFD45C", b: "#0F1730", wa: "#FFFFFF", wm: "#0F1730", halo: "rgba(108,140,255,.30)" } : { a: "#1F3A87", m: "#F5C33B", b: "#FFFFFF", wa: "#FFFFFF", wm: "#1F3A87", halo: "rgba(31,58,135,.24)" });
    function pinImgs(dk) {
      const C = PIN_COL(dk), k = 3;
      const put = (id, W, H, draw) => { if (map.hasImage(id)) map.removeImage(id); const c = document.createElement("canvas"); c.width = W * k; c.height = H * k; const x = c.getContext("2d"); x.scale(k, k); draw(x); map.addImage(id, x.getImageData(0, 0, W * k, H * k), { pixelRatio: k }); };
      // 핀 28px(머리 r10) + 후광 자리 5px. 아래 끝이 앵커
      const PAD = 5, R0 = 9.6, W = 2 * (R0 + PAD) + 2, H = 28 + PAD, cx = W / 2, cy = PAD + R0 + 1;
      // 핀 머리 안 집(지붕 + 몸통 + 문): icon.svg 64칸 좌표(머리 반지름 19.5)를 머리 R0에 맞춰 줄인 것
      const house = (x, hx, hy, fg, door) => {
        const s = (R0 * 0.94) / 19.5, P = (a, b) => [hx + a * s, hy + b * s];
        x.beginPath(); [[0, -11.9], [12.4, -0.8], [8.5, -0.8], [8.5, 10.7], [-8.5, 10.7], [-8.5, -0.8], [-12.4, -0.8]].forEach(([a, b], i) => x[i ? "lineTo" : "moveTo"](...P(a, b))); x.closePath();
        x.fillStyle = fg; x.strokeStyle = fg; x.lineWidth = 1.8 * s; x.lineJoin = "round"; x.fill(); x.stroke();
        x.fillStyle = door; x.fillRect(...P(-3.2, 2.4), 6.4 * s, 8.3 * s);
      };
      const tear = (x) => { x.beginPath(); x.moveTo(cx, H - 0.6); x.bezierCurveTo(cx - 2, H - 6, cx - R0, cy + 7.5, cx - R0, cy); x.arc(cx, cy, R0, Math.PI, 0); x.bezierCurveTo(cx + R0, cy + 7.5, cx + 2, H - 6, cx, H - 0.6); x.closePath(); };
      ["a", "m"].forEach((t) => ["", "-s"].forEach((sx) => put(`zpin-${t}${sx}`, W, H, (x) => {
        if (sx) { x.beginPath(); x.arc(cx, cy, R0 + 4, 0, Math.PI * 2); x.fillStyle = C.halo; x.fill(); }
        tear(x); x.fillStyle = C[t]; x.fill(); x.lineWidth = 2; x.strokeStyle = C.b; x.stroke();
        house(x, cx, cy, t === "a" ? C.wa : C.wm, C[t]);
      })));
      ["a", "m"].forEach((t) => put(`zdot-${t}`, 7, 7, (x) => { x.beginPath(); x.arc(3.5, 3.5, 3, 0, Math.PI * 2); x.fillStyle = C[t]; x.fill(); x.lineWidth = 1; x.strokeStyle = C.b; x.stroke(); }));
      put("zclu", 22, 22, (x) => { x.beginPath(); x.arc(11, 11, 9.5, 0, Math.PI * 2); x.fillStyle = C.a; x.fill(); x.lineWidth = 2; x.strokeStyle = C.b; x.stroke(); });
    }
    function mineSet() {
      let L = null;
      try { const PZ = typeof PINS !== "undefined" ? PINS : window.PINS; if (PZ && typeof PZ.list === "function") L = PZ.list(); } catch (e) {}
      if (!Array.isArray(L)) { try { L = FAV; } catch (e) { L = []; } }
      return new Set((L || []).map((x) => (x && typeof x === "object" ? x.id : x)).filter(Boolean));
    }
    // cubic-bezier(.34,1.56,.64,1): 살짝 넘쳤다 돌아오는 낙하
    const bez = (() => { const X1 = 0.34, Y1 = 1.56, X2 = 0.64, Y2 = 1; const f = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t; return (x) => { let t = x; for (let i = 0; i < 6; i++) { const d = (f(t + 1e-4, X1, X2) - f(t, X1, X2)) / 1e-4; if (!d) break; t -= (f(t, X1, X2) - x) / d; t = Math.min(1, Math.max(0, t)); } return f(t, Y1, Y2); }; })();
    const llOf = (r) => { const z = geo && geo.z[r.id]; return z ? z.l : r.ll ? [r.ll[1], r.ll[0]] : null; };
    const LB = new Map();
    function pinLab(r) {
      if (LB.has(r.id)) return LB.get(r.id);
      const t = labelOf(r), m = /([\d.]+억)/.exec(t || "");
      const v = `${fullName(r)} · ${m ? m[1] : cardVal(r) || ""}`.replace(/ · $/, "");
      LB.set(r.id, v); return v;
    }
    // 줌 구간별 핀 배율(이미지 높이 28px 기준)
    const pinBand = () => { const z = map.getZoom(); return z < 12 ? 0.55 : z < 14 ? 16 / 28 : z < 16 ? 22 / 28 : 1; };   // 서울 전체(12 아래)도 머리 약 10.5px 핀
    let pinB = 0;
    function pinDraw(now) {
      if (!map || !ready || !map.getSource("zpa")) return;
      now = now || performance.now();
      const sz = pinBand();
      const mine = mineSet(), sel = cur && cur.id, A = [], M = [], S = [], SH = [];
      const F = (r, ll, t, o, dy, sc, k) => {
        const s0 = (r.id === sel ? 1.25 : 1) * sc * sz;   // 크기는 줌 구간마다 JS에서 정한다(배치 계산이 타일 줌 기준이라 식으로는 어긋남)
        return { type: "Feature", geometry: { type: "Point", coordinates: ll }, properties: { id: r.id, t, x: r.id === sel ? "-s" : "", s: s0, o, off: [0, dy / (s0 || 1)], k, lb: pinLab(r) } };
      };
      const st = (a, ll) => {
        const e = now - a.t0;
        if (e < 0) return { o: 0, dy: 0, sc: 1 };
        if (a.kind === "drop") {
          if (e >= 320 && e < 440) { const q = (e - 320) / 120; SH.push({ type: "Feature", geometry: { type: "Point", coordinates: ll }, properties: { r: (2 + 7 * q) * Math.max(sz, 0.6), o: 0.34 * (1 - q) } }); }
          return { o: Math.min(1, e / 90), dy: -24 * (1 - bez(Math.min(1, e / 320))), sc: 1 };
        }
        if (a.kind === "fi") return { o: Math.min(1, e / a.d), dy: 0, sc: 1 };
        if (a.kind === "fo") return { o: Math.max(0, 1 - e / a.d), dy: 0, sc: 1 };
        const t = Math.min(1, e / 180); return { o: 1 - t, dy: 0, sc: 1 - 0.55 * t };
      };
      PIN.forEach((p, id) => {
        if (id === sel || mine.has(id)) return;
        const a = pinAnim.get(id), v = a ? st(a, p.ll) : { o: 1, dy: 0, sc: 1 };
        A.push(F(p.r, p.ll, "a", v.o, v.dy, v.sc, 2));
      });
      pinAnim.forEach((a, id) => { if (PIN.has(id) || id === sel || mine.has(id)) return; const v = st(a, a.ll); A.push(F(a.r, a.ll, "a", v.o, v.dy, v.sc, 2)); });
      mine.forEach((id) => { const r = byId[id]; if (!r || id === sel) return; const ll = llOf(r); if (ll) M.push(F(r, ll, "m", 1, 0, 1, 1)); });
      if (sel && (PIN.has(sel) || mine.has(sel))) { const r = byId[sel], ll = r && llOf(r); if (ll) S.push(F(r, ll, mine.has(sel) ? "m" : "a", 1, 0, 1, 0)); }
      map.getSource("zpa").setData(FC(A));
      map.getSource("zpm").setData(FC(M));
      map.getSource("zps").setData(FC(S));
      map.getSource("zpsh").setData(FC(SH));
    }
    function pinTick() {
      pinRaf = 0;
      if (!map || !ready) return;
      const now = performance.now();
      pinDraw(now);
      pinAnim.forEach((a, id) => { const end = a.kind === "drop" ? 440 : a.kind === "out" ? 180 : a.d; if (now - a.t0 >= end) pinAnim.delete(id); });
      if (pinAnim.size) pinRaf = requestAnimationFrame(pinTick);
      else pinDraw(now);
    }
    function pins(force) {
      if (!map || !ready || !geo || !map.getSource("zpa")) return;
      pinHooks();
      const now = performance.now();
      if (!force && now - pinT < 120) { clearTimeout(pinTm); pinTm = setTimeout(() => pins(false), 124 - (now - pinT)); return; }
      clearTimeout(pinTm); pinT = now;
      const next = new Map(), okF = pinOkF(), okS = new Set();
      for (const r of R) {
        let y = false; try { y = okF(r); } catch (e) {}
        if (!y) continue;
        okS.add(r.id);
        if (!kindOk(r)) continue;   // 목록 유형 칩(재개발·재건축·가로)과 같은 것만 핀
        const ll = llOf(r);
        if (ll) next.set(r.id, { ll, r });
      }
      affState(okS, force);
      const key = [...next.keys()].join(",");
      if (key === pinK) { if (force) { LB.clear(); pinDraw(); } return; }
      LB.clear();
      // 처음 로딩·지도 움직이는 중·움직임 줄이기 → 150ms 페이드만
      const calm = pinK == null || reduceMotion() || map.isMoving();
      pinK = key;
      const add = [], rm = [];
      next.forEach((p, id) => { if (!PIN.has(id) || (pinAnim.get(id) || {}).kind === "out" || (pinAnim.get(id) || {}).kind === "fo") add.push([id, p]); });
      PIN.forEach((p, id) => { if (!next.has(id)) rm.push([id, p]); });
      rm.forEach(([id, p]) => pinAnim.set(id, calm ? { kind: "fo", t0: now, d: 150, ll: p.ll, r: p.r } : { kind: "out", t0: now, ll: p.ll, r: p.r }));
      if (calm) add.forEach(([id, p]) => pinAnim.set(id, { kind: "fi", t0: now, d: 150, ll: p.ll, r: p.r }));
      else {
        // 30개 넘게 바뀌면 화면 가운데 가까운 30개만 떨어뜨리고 나머지는 200ms 페이드. 30ms 간격이라 한 프레임에 6개를 넘지 않는다
        const cv = map.getCanvas(), c = [cv.clientWidth / 2, cv.clientHeight / 2];
        const d2 = (ll) => { try { const q = map.project(ll); return (q.x - c[0]) ** 2 + (q.y - c[1]) ** 2; } catch (e) { return 1e12; } };
        add.map(([id, p]) => [id, p, d2(p.ll)]).sort((a, b) => a[2] - b[2]).forEach(([id, p], i) => pinAnim.set(id, i < 30 ? { kind: "drop", t0: now + i * 30, ll: p.ll, r: p.r } : { kind: "fi", t0: now, d: 200, ll: p.ll, r: p.r }));
      }
      PIN.clear(); next.forEach((p, id) => PIN.set(id, p));
      if (pinAnim.size) { if (!pinRaf) pinRaf = requestAnimationFrame(pinTick); }
      else pinDraw(now);
    }
    // 게이지를 놓으면: 진동 한 번 + '핀 4개 새로 꽂혔어요 · 2개 빠졌어요'(바뀐 게 있을 때만, 2초)
    // 핀 = 홈 '살 수 있는 곳' 숫자와 같은 판정(70_pins.js window.ZP_ok). 없으면 예전 점 상태
    const pinOkF = () => (typeof window.ZP_ok === "function" ? window.ZP_ok : (r) => r.ll && visible(r) && dotState(r) === "y");
    const okSafe = () => { const f = pinOkF(); return (r) => { try { return !!f(r); } catch (e) { return false; } }; };
    // 예산 반영: 되는 구역만 진한 남색, 나머지는 옅게(feature-state a). 게이지를 끄는 중에도 바로 바뀐다
    let affK = null;
    function affState(okS, force) {
      if (!map || !ready || !geo) return;
      const key = okS.size + ":" + [...okS].join(",");
      if (key === affK && !force) return;
      affK = key;
      const Z = geo.z;
      for (const r of R) {
        if (!r.ll) continue;
        const z = Z[r.id], src = z ? (z.e ? "zest" : "zones") : "pts";
        try { map.setFeatureState({ source: src, id: r.id }, { a: okS.has(r.id) }); } catch (e) {}
      }
    }
    // 내 돈으로 되는데 위치(좌표)가 없어 지도에 못 그리는 구역 → 홈 카드 등에서 '위치 미확인 n곳'
    function noLoc() { const f = okSafe(), ids = R.filter((r) => f(r) && !llOf(r)).map((r) => r.id); return { n: ids.length, ids }; }
    const okIds = () => { const f = pinOkF(), S = new Set(); R.forEach((r) => { try { if (f(r)) S.add(r.id); } catch (e) {} }); return S; };
    function pinToast(msg) {
      if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "app-toast lm-toast"; toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite"); document.body.appendChild(toastEl); }
      toastEl.textContent = msg; toastEl.classList.add("on");
      clearTimeout(toastTm); toastTm = setTimeout(() => toastEl.classList.remove("on"), 2000);
    }
    function pinHooks() {
      if (pinHooked) return; pinHooked = true;
      map.on("zoom", () => { const b = pinBand(); if (b !== pinB) { pinB = b; if (!pinRaf) pinDraw(); } });
      const isG = (t) => t && (t.id === "sCash" || t.id === "sMiniR");
      document.addEventListener("pointerdown", (e) => { if (isG(e.target)) pinSnap = okIds(); }, true);
      document.addEventListener("change", (e) => {
        if (!isG(e.target) || !pinSnap) return;
        const snap = pinSnap; pinSnap = null;
        try { if (navigator.vibrate) navigator.vibrate(10); } catch (er) {}
        setTimeout(() => {
          if (!map || !$("lmap") || $("lmap").hidden) return;
          pins(true);
          // 토스트 숫자 = 홈 숫자 변화(좌표 없는 구역도 셈)
          const nowS = okIds(); let a = 0, b = 0; nowS.forEach((id) => { if (!snap.has(id)) a++; }); snap.forEach((id) => { if (!nowS.has(id)) b++; });
          if (a || b) pinToast([a ? `새로 살 수 있는 곳 ${a}곳` : "", b ? `${b}곳 빠졌어요` : ""].filter(Boolean).join(" · "));
        }, 380);
      }, true);
      // 내 핀(관심 구역) 토글 → 노란 핀 다시 그리기
      document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("[data-fav]")) setTimeout(() => pinDraw(), 60); }, true);
      addEventListener("storage", () => pinDraw());
    }
    // 오른쪽 위 겹쳐 보기 레일 폭만큼 오른쪽 여백(카드가 레일 밑에 깔리지 않게)
    function railPad() { try { const w = $("mapbox") && $("mapbox").querySelector(".s-rail"); const cv = map.getCanvas().getBoundingClientRect(); if (w && w.offsetWidth) return Math.max(16, Math.round(cv.right - w.getBoundingClientRect().left) + 8); } catch (e) {} return 16; }
    function bboxOf(rings) { let a = 180, b = 90, c = -180, d = -90; rings.forEach((rg) => rg.forEach(([x, y]) => { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; })); return [[a, b], [c, d]]; }
    function focus(zoom) {
      if (!map || !ready) return;
      if (((cur && cur.id) || null) !== labSel) paint();
      const src = map.getSource("sel");
      const z = cur && geo && geo.z[cur.id];
      if (!cur || !(z || cur.ll)) { src.setData(FC([])); pinDraw(); return; }
      src.setData(z ? { type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: {} } : FC([]));
      pinDraw();
      if (!zoom) return;
      const dur = reduceMotion() ? 0 : 650;
      if (zoom === "soft") {
        if (map.isMoving()) return;
        // 데스크톱에서 구역을 고르면: 이미 화면 안에 잘 보이면 그대로, 아니면 그 구역으로 부드럽게 이동(줌 14.5~15.5)
        const bb = z ? bboxOf(z.g) : [[cur.ll[1], cur.ll[0]], [cur.ll[1], cur.ll[0]]];
        const cv = map.getCanvas(), a = map.project(bb[0]), b = map.project(bb[1]), rp = railPad();
        const inV = Math.min(a.x, b.x) > 40 && Math.max(a.x, b.x) < cv.clientWidth - rp && Math.min(a.y, b.y) > 50 && Math.max(a.y, b.y) < cv.clientHeight - 50;
        if (inV && map.getZoom() >= 13.5) return;
        map.fitBounds(bb, { padding: { top: 80, bottom: 80, left: 60, right: Math.max(60, rp) }, maxZoom: Math.min(15.5, Math.max(14.5, map.getZoom())), duration: dur });
        return;
      }
      // 작은 구역도 골목 몇 개만 보일 만큼 당기지 않는다(주변 역·동네가 보이게). 추정 범위(점선)는 더 넓게
      // PC 첫 화면처럼 지도 아래쪽이 창 밖이면 그만큼 아래 여백을 더 둔다(구역이 보이는 부분 가운데에 오게)
      const bp = MQ_SHEET.matches ? 70 : Math.max(70, fitPad().bottom + 30);
      if (z) map.fitBounds(bboxOf(z.g), { padding: { top: 70, bottom: bp, left: 60, right: Math.max(60, railPad()) }, maxZoom: z.e ? 14.8 : 15.5, duration: dur });
      else map.flyTo({ center: [cur.ll[1], cur.ll[0]], zoom: Math.min(15.5, Math.max(map.getZoom(), 15)), duration: dur });
    }
    // ===================== 역으로 찾기: flyTo · 역 표시 · 걸어서 500m/1km 고리 =====================
    // stnF = { ll:[lng,lat], z, n } 지금 보고 있는 역(없으면 null). 있는 동안은 자동 맞춤(fitAff·fit)이 화면을 옮기지 않는다.
    // 사용자가 2km 넘게 밀거나 줌 12 아래로 빼면, 또는 clearStation()·확대 초기화(zoom(0))면 풀린다.
    let stnF = null, stnPend = false;
    // 걸어서 10분·15분 고리: 검색 '○○역 걸어서 15분 안'과 같은 기준(분속 67m, 길 돌아가는 몫 1.3배 → 직선 515m·773m)
    const W10 = 515, W15 = 773;
    const circ = (ll, m, n) => { const [lo, la] = ll, dy = m / 111320, dx = m / (111320 * Math.cos((la * Math.PI) / 180)), P = []; for (let i = 0; i <= (n || 72); i++) { const a = (i / (n || 72)) * 2 * Math.PI; P.push([lo + dx * Math.sin(a), la + dy * Math.cos(a)]); } return P; };
    function stnDraw() {
      if (!map || !ready || !map.getSource("sdim")) return;
      if (!stnF) { ["sdim", "sring", "spt"].forEach((s) => map.getSource(s).setData(FC([]))); return; }
      const ll = stnF.ll, outer = [[124, 32], [132, 32], [132, 40], [124, 40], [124, 32]];
      map.getSource("sdim").setData({ type: "Feature", geometry: { type: "Polygon", coordinates: [outer, circ(ll, W15).reverse()] }, properties: {} });
      map.getSource("sring").setData(FC([W10, W15].map((m) => ({ type: "Feature", geometry: { type: "LineString", coordinates: circ(ll, m) }, properties: { m } }))));
      const top = (m) => [ll[0], ll[1] + m / 111320];
      map.getSource("spt").setData(FC([
        { type: "Feature", geometry: { type: "Point", coordinates: ll }, properties: { k: "s", n: stnF.n ? stnF.n.replace(/역$/, "") + "역" : "" } },
        { type: "Feature", geometry: { type: "Point", coordinates: top(W10) }, properties: { k: "r", n: "걸어서 10분" } },
        { type: "Feature", geometry: { type: "Point", coordinates: top(W15) }, properties: { k: "r", n: "걸어서 15분" } },
      ]));
    }
    function stnGo() {
      if (!map || !stnF) return;
      stnPend = false;
      try { map.resize(); } catch (e) {}
      map.stop();
      // 걸어서 10분 고리가 화면(위 게이지·아래 버튼 자리 뺀) 안에 다 들어오는 줌, 그래도 14 이상(폰 390폭 ≈ 14.4 · 15분 고리는 가장자리 밖으로 나갈 수 있음)
      try {
        if (stnF.z0 == null) stnF.z0 = stnF.z;
        const cv = map.getCanvas(), r = Math.min(cv.clientWidth, cv.clientHeight - 150) / 2 - 14;
        if (r > 80) stnF.z = Math.max(14, Math.min(stnF.z0, Math.log2((r * 78271.5 * Math.cos((stnF.ll[1] * Math.PI) / 180)) / W10)));
      } catch (e) {}
      // 지도가 막 생기거나(첫 맞춤) 전체 지도로 커지는 동안 다른 맞춤이 끼어들어도 이 시간 안에는 역 자리로 되돌린다(아래 moveend 지킴이)
      stnF.until = Date.now() + (reduceMotion() ? 2500 : 3500);
      map.flyTo({ center: stnF.ll, zoom: stnF.z, duration: reduceMotion() ? 0 : 900, essential: true });
      stnDraw();
      if (snEl) snEl.hidden = true;
      clearTimeout(snGo); snGo = setTimeout(stnNote, reduceMotion() ? 60 : 1000);
    }
    function flyTo(lng, lat, zoom, name) {
      lng = +lng; lat = +lat;
      if (!isFinite(lng) || !isFinite(lat)) return false;
      if (lng < 90 && lat > 90) { const t = lng; lng = lat; lat = t; }   // [lat,lng]로 넘겨도 받아 준다
      stnF = { ll: [lng, lat], z: isFinite(+zoom) && +zoom > 0 ? +zoom : 14.5, n: name || "", until: Date.now() + 8000 };
      stnPend = true;
      // 아직 지도가 없으면(간단 지도 → 실제 지도, 첫 로딩) 만들고, 준비되면 이어서 옮긴다
      if (!want || failed) return false;
      if (!map) { if (mapView === "seoul" || !mapView) { try { seoul(); } catch (e) {} } return true; }
      stnGo();
      // 전체 지도가 열리며 크기가 바뀌는 동안(60·300·800ms) 다른 맞춤이 끼어들어도 마지막에 한 번 더 제자리로
      [350, 950].forEach((t) => setTimeout(() => { if (!stnF || !map) return; map.resize(); const c = map.getCenter(); if (Math.hypot((c.lng - stnF.ll[0]) * 88, (c.lat - stnF.ll[1]) * 111) > 0.25 && !map.isMoving()) map.jumpTo({ center: stnF.ll, zoom: Math.max(map.getZoom(), stnF.z - 0.3) }); }, t + (reduceMotion() ? 0 : 900)));
      return true;
    }
    function stnFind(q) {
      if (Array.isArray(q)) return q.length >= 3 && isFinite(q[1]) ? q : null;
      const b = String(q || "").replace(/\s/g, "").replace(/역$/, "");
      if (!b) return null;
      const L = (D.stations || []).filter((s) => isFinite(s[1]) && isFinite(s[2]));
      return L.find((s) => s[0].replace(/역$/, "") === b) || L.find((s) => s[0].replace(/역$/, "").startsWith(b)) || null;
    }
    // 역 주변에 구역이 없으면 말없이 빈 지도만 보이지 않게: '500m 안 0곳 · 1km 안 3곳 [보기]'
    let snEl = null, snTm = 0, snGo = 0;
    const mDist = (a, b) => Math.hypot((a[0] - b[0]) * 88200, (a[1] - b[1]) * 111000);
    function stnNote() {
      if (snEl) { snEl.hidden = true; clearTimeout(snTm); }
      if (!stnF || !map || !geo) return;
      const ll = stnF.ll, D2 = R.filter((r) => r.ll && visible(r) && kindOk(r)).map((r) => { const z = geo.z[r.id]; let d = mDist(llOf(r), ll); if (z) z.g.forEach((rg) => rg.forEach((q) => { const e = mDist(q, ll); if (e < d) d = e; })); return [r, d]; }).sort((a, b) => a[1] - b[1]);
      const n5 = D2.filter((x) => x[1] <= W10).length, n10 = D2.filter((x) => x[1] <= W15).length;
      if (n5 || !D2.length) return;
      const near = D2[0];
      const msg = n10 ? `걸어서 10분 안 구역 없음 · 15분 안 ${n10}곳` : `걸어서 15분 안 구역 없음 · 가장 가까운 곳 ${(near[1] / 1000).toFixed(1)}km`;
      if (!snEl) {
        snEl = document.createElement("div"); snEl.className = "lm-snote"; snEl.setAttribute("role", "status");
        snEl.innerHTML = `<span></span><button type="button"></button>`;
        $("lmap").appendChild(snEl);
      }
      snEl.querySelector("span").textContent = msg;
      const bt = snEl.querySelector("button");
      bt.textContent = "보기";
      bt.onclick = () => {
        snEl.hidden = true; if (stnF) stnF.until = 0;
        const d = Math.max(W15 + 60, near[1] + 150), dy = d / 111000, dx = d / 88200;
        if (n10) map.fitBounds([[ll[0] - dx, ll[1] - dy], [ll[0] + dx, ll[1] + dy]], { padding: 20, duration: reduceMotion() ? 0 : 500 });
        else map.fitBounds([[Math.min(ll[0], llOf(near[0])[0]) - 0.004, Math.min(ll[1], llOf(near[0])[1]) - 0.004], [Math.max(ll[0], llOf(near[0])[0]) + 0.004, Math.max(ll[1], llOf(near[0])[1]) + 0.004]], { padding: 40, duration: reduceMotion() ? 0 : 500 });
      };
      // '목록 보기'·확대 버튼 위, 가운데
      try { const cv = map.getCanvas().getBoundingClientRect(), fx = document.querySelector(".s-fullx"), fb = fx && fx.offsetWidth ? fx.getBoundingClientRect() : null; let bo = fb && fb.top < cv.bottom && fb.bottom > cv.top ? Math.round(cv.bottom - fb.top + 10) : 16; const zm = $("lmap").querySelector(".lm-zoom"); if (zm && zm.offsetWidth && cv.width < 560) { const zb = zm.getBoundingClientRect(); bo = Math.max(bo, Math.round(cv.bottom - zb.top + 10)); } snEl.style.bottom = bo + "px"; } catch (e) {}
      snEl.hidden = false;
      snTm = setTimeout(() => { if (snEl) snEl.hidden = true; }, 7000);
    }
    function flyToStation(q, zoom) {
      const s = stnFind(q);
      if (!s) return false;
      return flyTo(s[2], s[1], zoom, s[0]);
    }
    function clearStation() { if (snEl) snEl.hidden = true; if (!stnF) return; stnF = null; stnPend = false; stnDraw(); }
    // ===================== 목록 ↔ 지도 마우스 연결(데스크톱) =====================
    let hovId = null;
    function hovDraw() {
      if (!map || !ready || !map.getSource("hov")) return;
      const r = hovId && byId[hovId], z = r && geo && geo.z[r.id];
      const c = r && llOf(r);
      map.getSource("hov").setData(!r || !c ? FC([]) : FC([].concat(z ? [{ type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: {} }] : [], [{ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: { n: fullName(r) } }])));
    }
    function hover(id) { id = id || null; if (id === hovId) return; hovId = id; hovDraw(); }
    // 지도 위 구역에 마우스 → 목록 줄에 .lm-hov
    let rowHov = null;
    function rowMark(id) {
      const el = id ? document.querySelector(`#sList [data-id="${CSS.escape(id)}"]`) : null, li = el && (el.closest("li") || el);
      if (li === rowHov) return;
      if (rowHov) rowHov.classList.remove("lm-hov");
      rowHov = li || null;
      if (rowHov) rowHov.classList.add("lm-hov");
    }
    function guDraw() {
      if (!map || !ready || !map.getSource("gusel")) return;
      const g = gu && geo && geo.gu.find((x) => x.n === gu);
      const outer = [[124, 32], [132, 32], [132, 40], [124, 40], [124, 32]];
      map.getSource("gusel").setData(g ? { type: "Feature", geometry: { type: "MultiLineString", coordinates: g.r }, properties: {} } : FC([]));
      map.getSource("gudim").setData(g ? { type: "Feature", geometry: { type: "Polygon", coordinates: [outer, ...g.r] }, properties: {} } : FC([]));
    }
    function fitGu(n) {
      if (!map || !geo) return;
      const g = geo.gu.find((x) => x.n === n);
      guDraw();
      if (!g) return;
      // 폰: 레일은 오른쪽 위 한 모서리뿐 → 오른쪽 전체를 비우지 않는다(구가 작게 보이던 문제). 위 게이지·아래 '목록 보기'만 피한다
      const P = fitPad(true), mob = MQ_SHEET.matches;
      map.fitBounds(bboxOf(g.r), { padding: { top: P.top + (mob ? 6 : 18), bottom: P.bottom + (mob ? 6 : 18), left: mob ? 16 : 30, right: mob ? 16 : Math.max(30, railPad()) }, maxZoom: 14.5, duration: reduceMotion() ? 0 : 500 });
    }
    function legend() {
      const el = $("lmLegend");
      if (!el) return;
      const P = palette();
      // 구역 색은 한 가지. 고른 기준(내 현금·단계 등)은 카드 아래 칸 값으로 보여 준다
      const items = [[dark() ? "#5B8CFF" : "#1F3A87", "정비구역 (카드 아래 칸 = " + (MODES.find(([k]) => k === colorBy) || ["", "내 현금"])[1] + ")"]];
      const note = { old: "노후도 = 경계 안 건축물 중 사용승인 후 30년(철근콘크리트)·20년(그 외) 지난 비율 · 서울도시공간포털 건물 레이어(사용승인 2022년까지 반영)로 직접 계산 · 이주·철거 이후 구역과 연도 확인 건물이 적은 곳은 빼요", vol: "최근 12개월 구역 안 연립·다세대 매매 건수(단독·아파트 제외, 서울시 실거래)", yoy: "대지지분 3.3㎡당 매매가 가운데 값, 최근 12개월 vs 그 전 12개월 · 두 기간 5건 이상" }[colorBy];
      const PC = PIN_COL(dark());
      // 범례 핀 = 지도 핀과 같은 꼴(집 든 핀)
      const hp = (c, w) => `<svg class="lm-hp" width="12" height="15" viewBox="10 3 44 60" aria-hidden="true"><path d="M32 61C25.5 52.5 12.5 40.5 12.5 24.5a19.5 19.5 0 0 1 39 0C51.5 40.5 38.5 52.5 32 61z" fill="${c}"/><path d="M32 12.6 44.4 23.7h-3.9V35.2H23.5V23.7h-3.9z" fill="${w}"/><rect x="28.8" y="26.9" width="6.4" height="8.3" fill="${c}"/></svg>`;
      el.innerHTML = `<span>${hp(PC.a, PC.wa)}핀 = 내 돈으로 살 수 있는 곳</span><span>${hp(PC.m, PC.wm)}내 핀</span>${items.map(([c, t]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join("")}<span class="lm-est"><i></i>점선 = 공식 경계 없음(면적 기준 추정 범위)</span>${note ? `<small class="lm-note">${esc(note)}</small>` : ""}`;
    }
    // 레이어 범례·'확대하면 보여요' 안내: 오른쪽 위 레일 바로 아래에 작은 글자로
    // 학교·병원(OpenFreeMap POI)은 타일 줌 14부터만 들어 있다 → 레이어도 14부터, 안내도 14 기준
    const LMINZ = { edu: POIZ, med: POIZ };
    const NUMK = ["", "한 번", "두 번", "세 번", "네 번"];
    function notes() {
      if (!map) return;
      const short = $("mapbox") && $("mapbox").classList.contains("lm-short");
      const host = (!short && $("mapbox") && $("mapbox").querySelector(".s-rail-w")) || $("lmap");
      let el = $("lmNotes");
      if (!el) { el = document.createElement("div"); el.id = "lmNotes"; el.className = "lm-notes"; el.setAttribute("aria-live", "polite"); }
      if (el.parentNode !== host) host.appendChild(el);
      const on = !$("lmap").hidden, z = map.getZoom(), H = [];
      // 확대 버튼 한 번 = 줌 +1. 몇 번 더 눌러야 보이는지 알려 준다(보이기 시작하면 안내는 사라짐)
      const G = {};
      Object.keys(LMINZ).forEach((k) => { if (!lyr.has(k) || z >= LMINZ[k] - 0.001) return; const n = Math.ceil(LMINZ[k] - z - 0.001); (G[n] = G[n] || []).push({ edu: "학교", med: "병원" }[k]); });
      Object.keys(G).sort((a, b) => a - b).forEach((n) => {
        const far = G[n], last = far[far.length - 1];
        H.push(`<p class="lm-n-hint"><svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 10.5 14 14M7 5v4M5 7h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${far.join("·")}${(last.charCodeAt(last.length - 1) - 0xac00) % 28 ? "은" : "는"} ${NUMK[n] ? NUMK[n] + " 더 " : "더 "}확대하면 보여요</p>`);
      });
      if (lyr.has("hj")) H.push(`<p><i class="lm-n-hj"></i>새 역·개발 예정지<small>테두리 색 = 노선</small></p>`);
      [["edu", "학교", "초·중·고"], ["med", "병원", "종합·대형"], ["mart", "대형마트", ""]].forEach(([k, t, sub]) => { if (lyr.has(k)) H.push(`<p><img class="lm-n-ic" src="${poiUrl(k)}" alt="" width="14" height="14">${t}${sub ? `<small>${sub}</small>` : ""}</p>`); });
      if (lyr.has("acad")) H.push(`<p><i class="lm-n-acad"></i>학원가<small>원 크기 = 학원 수</small></p>`);
      if (lyr.has("biz")) H.push(z < 13 ? `<p><i class="lm-n-biz lm-n-heat"></i>상권<small>진할수록 점포 많음</small></p>` : `<p><i class="lm-n-biz"></i>상권<small>원 크기 = 점포 수</small></p>`);
      if (lyr.has("hi")) H.push(`<p><i class="lm-n-hi"></i>신고가<small>최근 3개월</small></p>`);
      const html = H.join("");
      if (el._h !== html) { el._h = html; el.innerHTML = html; edgeSoon(); }
      el.hidden = !on || !H.length;
    }
    // 구역 카드는 화면 가장자리·떠 있는 버튼(레일·확대 버튼·목록 보기) 밑에서는 그리지 않는다 → 잘리거나 가려진 카드 없음
    let edgeT = 0;
    function edgeFilter() {
      if (!map || !ready || !map.getLayer("zone-lab")) return;
      try {
        const cv = map.getCanvas(), W = cv.clientWidth, H = cv.clientHeight, cb = cv.getBoundingClientRect();
        if (W < 50 || H < 50) return;
        let top = 4;
        const holes = [];
        document.querySelectorAll("#mapbox .s-rail, #lmap .lm-zoom, .s-mini, .s-fullx, #lmNotes").forEach((e) => {
          if (!e.offsetWidth || e.hidden) return;
          const b = e.getBoundingClientRect();
          if (b.bottom <= cb.top || b.top >= cb.bottom || b.right <= cb.left || b.left >= cb.right) return;
          const r = [b.left - cb.left, b.top - cb.top, b.right - cb.left, b.bottom - cb.top];
          if (r[2] - r[0] > W * 0.6 && r[1] <= 40) { top = Math.max(top, r[3] + 2); return; }
          holes.push([r[0] - 46, r[1] - 42, r[2] + 46, r[3] + 2]);
        });
        const O = [34, top, W - 34, H - 40];
        // 겹치는 구멍은 하나로 합친다(짝홀 규칙이 꼬이지 않게)
        for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) {
          const a = holes[i], b = holes[j];
          if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) { holes[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; holes.splice(j, 1); i = -1; break; }
        }
        const ring = (x0, y0, x1, y1) => { const u = (x, y) => { const l = map.unproject([x, y]); return [l.lng, l.lat]; }; return [u(x0, y0), u(x0, y1), u(x1, y1), u(x1, y0), u(x0, y0)]; };
        const cl = (h) => [Math.max(h[0], O[0] + 1), Math.max(h[1], O[1] + 1), Math.min(h[2], O[2] - 1), Math.min(h[3], O[3] - 1)];
        const rings = [ring(...O)].concat(holes.map(cl).filter((h) => h[2] > h[0] && h[3] > h[1]).map((h) => ring(...h)));
        const poly = { type: "Polygon", coordinates: rings };
        map.setFilter("zone-lab", ["all", ["==", ["get", "p"], 0], ["within", poly]]);
        map.setFilter("zone-lab-p", ["all", ["==", ["get", "p"], 1], ["within", poly]]);
        // 구 이름도 가장자리에서 반쯤 잘려 보이지 않게(예: 왼쪽 끝 '강서구'), 레일·확대 버튼 밑에서는 빼기
        if (map.getLayer("gu-lab")) map.setFilter("gu-lab", ["within", poly]);
        // 핀(₩·내 핀·클러스터)도 레일·확대 버튼·위 작은 게이지 밑에 깔리지 않게: 핀 끝(아래)이 그 칸 바로 아래 30px 안이면 머리가 칸에 가려서 같이 뺀다
        const PH = [], pinTop = top > 4 ? top + 26 : 0;
        document.querySelectorAll("#mapbox .s-rail, #lmap .lm-zoom, .s-fullx, #lmNotes").forEach((e) => {
          if (!e.offsetWidth || e.hidden) return;
          const b = e.getBoundingClientRect();
          if (b.bottom <= cb.top || b.top >= cb.bottom || b.right <= cb.left || b.left >= cb.right) return;
          PH.push([Math.max(1, b.left - cb.left - 12), Math.max(pinTop + 1, b.top - cb.top - 2), Math.min(W - 1, b.right - cb.left + 12), Math.min(H - 1, b.bottom - cb.top + 30)]);
        });
        const pPoly = { type: "Polygon", coordinates: [ring(0, pinTop, W, H)].concat(PH.filter((h) => h[2] > h[0] && h[3] > h[1]).map((h) => ring(...h))) };
        [["pin-a", ["!", ["has", "point_count"]]], ["pin-clu", ["has", "point_count"]], ["pin-m", null], ["pin-s", null]].forEach(([l, f]) => { if (map.getLayer(l)) map.setFilter(l, f ? ["all", f, ["within", pPoly]] : ["within", pPoly]); });
      } catch (e) {}
    }
    const edgeSoon = () => { clearTimeout(edgeT); edgeT = setTimeout(edgeFilter, 60); };
    function ui() {
      const box = $("mapbox");
      if (!box || $("lmap")) return;
      const d = document.createElement("div");
      d.id = "lmap"; d.className = "lmap"; d.hidden = true;
      d.innerHTML = `<div class="lm-ctl" role="group" aria-label="지도 보기"><label class="lm-sel"><span>카드 값</span><select id="lmColor" aria-label="구역 카드에 보일 값">${MODES.map(([k, t]) => `<option value="${k}"${colorBy === k ? " selected" : ""}>${t}</option>`).join("")}</select></label><button type="button" class="lm-ly" aria-expanded="false" aria-controls="lmLayers" aria-label="겹쳐 보기(학교·학원·상권 등)" title="겹쳐 보기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 13 10 5 10-5"/></svg>${lyr.size ? ` <b>${lyr.size}</b>` : ""}</button><button type="button" class="lm-lg" aria-expanded="false" aria-controls="lmLegend">범례</button></div><div class="lm-layers" id="lmLayers" hidden><p>겹쳐 보기</p>${LAYERS.map(([k, t, sub]) => `<label><input type="checkbox" value="${k}"${lyr.has(k) ? " checked" : ""}><span>${t}<small>${sub}</small></span></label>`).join("")}<p class="lm-ln">상권·학원가: 서울시 상권분석서비스 <span id="lmSangQ"></span> 점포 수·추정매출. 학교·병원·마트: OpenStreetMap 기준이라 빠진 곳이 있을 수 있어요.</p></div><div class="lm-legend" id="lmLegend" hidden></div>`;
      d.querySelector(".lm-lg").onclick = (e) => { const lg = $("lmLegend"), on = lg.hidden; lg.hidden = !on; e.currentTarget.setAttribute("aria-expanded", String(on)); if (on) { $("lmLayers").hidden = true; d.querySelector(".lm-ly").setAttribute("aria-expanded", "false"); } };
      const zm = document.createElement("div");
      zm.className = "lm-zoom"; zm.setAttribute("role", "group"); zm.setAttribute("aria-label", "지도 확대·축소");
      // ⤢ 크게 보기(PC): 지도를 화면 가득. 폰은 아래 탭 '지도'가 같은 일을 한다
      zm.innerHTML = `<button type="button" data-z="full" class="lm-fs" aria-label="지도 크게 보기" aria-pressed="false" title="지도 크게 보기"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" data-z="1" aria-label="확대"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button><button type="button" data-z="-1" aria-label="축소"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button>`;
      zm.addEventListener("click", (e) => { const b = e.target.closest("button[data-z]"); if (!b) return; if (b.dataset.z === "full") { try { SIMPLE.fullMap(); } catch (er) {} return; } if (!map) return; const o = { duration: reduceMotion() ? 0 : 250 }; if (+b.dataset.z > 0) map.zoomIn(o); else map.zoomOut(o); });
      d.appendChild(zm);
      box.appendChild(d);
      d.querySelector("#lmColor").addEventListener("change", (e) => {
        colorBy = e.target.value; store.set("emr.mapc", colorBy);
        paint();
      });
      d.querySelector(".lm-ly").onclick = (e) => {
        const p = $("lmLayers"), on = p.hidden, c = d.querySelector(".lm-ctl");
        p.style.top = c.offsetTop + c.offsetHeight + 6 + "px";
        p.hidden = !on; e.currentTarget.setAttribute("aria-expanded", String(on));
        if (on) { $("lmLegend").hidden = true; d.querySelector(".lm-lg").setAttribute("aria-expanded", "false"); }
      };
      $("lmLayers").addEventListener("change", (e) => {
        const c = e.target.closest("input[type=checkbox]"); if (!c) return;
        if (c.checked) lyr.add(c.value); else lyr.delete(c.value);
        store.set("emr.lyr", JSON.stringify([...lyr]));
        d.querySelector(".lm-ly").innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 13 10 5 10-5"/></svg>${lyr.size ? ` <b>${lyr.size}</b>` : ""}`;
        layerData();
        layers();
        if (c.value === "hi") paint();
        notes();
      });
      const bar = $("mapBar");
      if (bar && !$("mapKind")) {
        const t = document.createElement("div");
        t.className = "seg sm map-kind"; t.id = "mapKind"; t.setAttribute("role", "group"); t.setAttribute("aria-label", "지도 종류");
        t.innerHTML = `<button type="button" data-m="real" aria-pressed="${want}">실제 지도</button><button type="button" data-m="svg" aria-pressed="${!want}">간단 지도</button>`;
        bar.appendChild(t);
        t.addEventListener("click", (e) => { const b = e.target.closest("button[data-m]"); if (!b) return; use(b.dataset.m === "real", true); });
      }
    }
    function init() {
      if (map) return true;
      try {
        map = new maplibregl.Map({
          container: "lmap", style: style(), bounds: SEOUL_BB, fitBoundsOptions: { padding: 12 },
          minZoom: 8.8, maxZoom: 17.6, maxBounds: [[126.2, 37.05], [127.75, 38.05]], attributionControl: false,
          localIdeographFontFamily: "'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif",
          cooperativeGestures: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
          locale: { "CooperativeGesturesHandler.WindowsHelpText": "Ctrl 키를 누른 채 스크롤하면 확대·축소돼요", "CooperativeGesturesHandler.MacHelpText": "⌘ 키를 누른 채 스크롤하면 확대·축소돼요", "CooperativeGesturesHandler.MobileHelpText": "두 손가락으로 지도를 움직여 보세요", "AttributionControl.ToggleAttribution": "지도 출처", "AttributionControl.MapFeedback": "지도 고치기 제안" },
        });
      } catch (e) { map = null; failed = true; return false; }
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '정비구역 경계 <a href="https://urban.seoul.go.kr" target="_blank" rel="noopener">서울도시공간포털</a>' }), "bottom-right");
      map.on("style.load", () => { ready = false; loadGeo().then(overlays); });
      map.on("moveend", edgeSoon);
      // 목록 '이 지도 범위만'(60_simple.js)이 지도를 옮길 때마다 따라오게: 보이는 범위·줌을 알린다
      map.on("moveend", () => { try { if (!ready || $("lmap").hidden) return; const b = map.getBounds(); dispatchEvent(new CustomEvent("zp:mapmove", { detail: { bb: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], z: map.getZoom() } })); } catch (e) {} });
      // 사용자가 역에서 2km 넘게 밀거나 크게 빼면 역 표시(어둡게 덮기·고리)를 푼다
      // 역 지킴이: 역을 고른 직후(stnF.until 전) 사람이 옮긴 게 아닌 이동(첫 맞춤·크기 바뀜 뒤 맞춤)이 역에서 벗어나 끝나면 제자리로
      map.on("moveend", (e) => {
        if (!stnF || (e && e.originalEvent) || !stnF.until || Date.now() > stnF.until || map.isMoving()) return;
        const c = map.getCenter();
        if (Math.hypot((c.lng - stnF.ll[0]) * 88, (c.lat - stnF.ll[1]) * 111) > 0.12 || map.getZoom() < stnF.z - 0.3) map.jumpTo({ center: stnF.ll, zoom: stnF.z });
      });
      map.on("moveend", (e) => { if (!stnF || !e || !e.originalEvent) return; const c = map.getCenter(); if (map.getZoom() < 12 || Math.hypot((c.lng - stnF.ll[0]) * 88, (c.lat - stnF.ll[1]) * 111) > 2) clearStation(); }); map.on("resize", () => { shortMark(); edgeSoon(); });
      let nRaf = 0;
      map.on("zoom", () => { if (!nRaf) nRaf = requestAnimationFrame(() => { nRaf = 0; notes(); }); });
      // 출처는 접힌 'i' 단추로만(라이브러리가 로딩 중 저절로 펼쳤다 접으면 자리가 흔들림 = CLS). 사람이 누를 때만 펼친다
      {
        const at = $("lmap").querySelector(".maplibregl-ctrl-attrib");
        if (at) {
          let userT = 0;
          const fold = () => { if (Date.now() - userT < 800) return; if (at.classList.contains("maplibregl-compact-show")) at.classList.remove("maplibregl-compact-show"); if (at.hasAttribute("open")) at.removeAttribute("open"); };
          ["pointerdown", "keydown", "click"].forEach((t) => at.addEventListener(t, () => { userT = Date.now(); }, true));
          try { new MutationObserver(fold).observe(at, { attributes: true, attributeFilter: ["class", "open"] }); } catch (e) {}
          fold();
        }
      }
      map.on("error", (e) => {
        const m = String((e && e.error && e.error.message) || "");
        if (/openfreemap|Failed to fetch|NetworkError/.test(m) && !$("lmap").querySelector(".lm-err")) {
          const n = document.createElement("div");
          n.className = "lm-err";
          n.innerHTML = '지도 바탕을 불러오지 못했어요. <button type="button" class="btn secondary sm">간단 지도로 보기</button>';
          n.querySelector("button").onclick = () => use(false, true);
          $("lmap").appendChild(n);
        }
      });
      const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "lm-pop", offset: 10, maxWidth: "260px" });
      const hit = ["zone-fill", "zest-fill", "pts"];
      const tipOf = (r) => `<b>${esc(fullName(r))}</b><small>${esc([SHAPE[shapeOf(r)], r.src === "moa" ? srLabel(r) : stageName(r)].join(" · "))}</small><small>${esc(labelOf(r))}${geo && geo.z[r.id] && geo.z[r.id].e ? " · 경계 추정" : ""}</small>`;
      hit.forEach((l) => {
        map.on("mousemove", l, (e) => { const r = byId[e.features[0].properties.id]; if (!r) return; map.getCanvas().style.cursor = "pointer"; pop.setLngLat(e.lngLat).setHTML(tipOf(r)).addTo(map); rowMark(r.id); });
        map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; pop.remove(); rowMark(null); });
      });
      let lastPT = "touch";
      map.getCanvasContainer().addEventListener("pointerdown", (e) => { lastPT = e.pointerType || "mouse"; }, true);
      map.on("click", (e) => {
        const ls = ["pin-s", "pin-m", "pin-a", "pin-clu", "zone-lab", "zone-lab-p"].concat(hit).filter((l) => map.getLayer(l));
        let fs = map.queryRenderedFeatures(e.point, { layers: ls });
        // 손가락은 넓게: 정확히 안 맞으면 둘레 12px(마우스 5px) 안에서 가장 가까운 구역
        if (!fs.length) {
          const t = lastPT === "mouse" ? 5 : 12, p = e.point;
          const near = map.queryRenderedFeatures([[p.x - t, p.y - t], [p.x + t, p.y + t]], { layers: ls });
          if (near.length) {
            const d = (f) => { try { const c = f.geometry.type === "Point" ? f.geometry.coordinates : null; if (c) { const q = map.project(c); return Math.hypot(q.x - p.x, q.y - p.y); } } catch (er) {} return t; };
            fs = near.sort((a, b) => d(a) - d(b));
          }
        }
        if (!fs.length) return;
        if (fs[0].layer.id === "pin-clu") { const c = fs[0]; Promise.resolve(map.getSource("zpa").getClusterExpansionZoom(c.properties.cluster_id)).then((zm) => map.easeTo({ center: c.geometry.coordinates, zoom: zm + 0.2, duration: reduceMotion() ? 0 : 400 })).catch(() => {}); return; }
        // 겹치면 작은(구체적인) 구역 우선
        const area = (f) => { const z = geo && geo.z[f.properties.id]; return z ? z.a || 1e9 : 1e9; };
        const f = fs.find((x) => /^(pin-[sma]|zone-lab(-p)?)$/.test(x.layer.id)) || fs.slice().sort((a, b) => (a.layer.id === "zest-fill") - (b.layer.id === "zest-fill") || area(a) - area(b))[0];
        const id = f.properties.id;
        if (!byId[id]) return;
        pop.remove();
        curTab = "money";
        const rt = $("report").getBoundingClientRect().top;
        select(id, false, false, { scroll: !MQ_SHEET.matches && (rt < HDR() - 4 || rt > innerHeight * 0.5) });
      });
      try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", restyle); } catch (e) {}
      try { new MutationObserver(restyle).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) {}
      try { map.getCanvas().setAttribute("aria-label", "정비구역 경계 지도. 키보드로는 옆의 구역 목록을 쓰세요"); } catch (e) {}
      return true;
    }
    // 키 작은 지도(폰 홈 지도): 레일 3열×2줄, 확대·축소는 가로 → 서로 겹치지 않게
    function shortMark() {
      const b = $("mapbox"); if (!b) return;
      const fs = document.documentElement.classList.contains("s-full"), sh = !fs && b.clientHeight > 0 && b.clientHeight < 400;
      if (sh !== b.classList.contains("lm-short")) { b.classList.toggle("lm-short", sh); if (map) notes(); }
      const f = $("lmap") && $("lmap").querySelector(".lm-fs");
      if (f) { f.setAttribute("aria-pressed", String(fs)); f.setAttribute("aria-label", fs ? "지도 작게 보기" : "지도 크게 보기"); f.title = f.getAttribute("aria-label"); }
    }
    function restyle() { if (map) { ready = false; map.setStyle(style(), { diff: false }); } }
    function show(on) {
      const el = $("lmap");
      if (!el) return;
      el.hidden = !on;
      $("mapbox").classList.toggle("lm-on", on);
      shortMark();
      const bar = $("mapBar");
      if (on && bar && getComputedStyle(bar).position !== "absolute") $("mapbox").style.setProperty("--lm-top", bar.offsetHeight + "px");
      else $("mapbox").style.removeProperty("--lm-top");
      if (on && map) requestAnimationFrame(() => { map.resize(); notes(); edgeSoon(); });
      else if (!on && $("lmNotes")) $("lmNotes").hidden = true;
    }
    function enter(n) {
      gu = n;
      ui();
      if (!want || failed) return show(false);
      show(true);
      Promise.all([loadLib(), loadGeo()])
        .then(() => {
          if (mapView !== "gu" || !want) return;
          if (!init()) { show(false); return; }
          map.resize();
          if (cur && cur.g === n && geo && (geo.z[cur.id] || cur.ll)) { if (ready) focus(true); else pendFocus = true; }
          else fitGu(n);
          if (ready) paint();
        })
        .catch(() => { failed = true; show(false); });
    }
    function exit() { gu = null; guDraw(); if (document.documentElement.classList.contains("simple")) seoul(); else show(false); }
    function use(on, user) {
      want = on;
      if (user) store.set("emr.map", on ? "real" : "svg");
      document.querySelectorAll("#mapKind button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.m === "real") === on)));
      if (mapView === "gu" && mapGu) { if (on) enter(mapGu); else show(false); }
    }
    return {
      enter, exit, use, seoul,
      on: () => !!(map && $("lmap") && !$("lmap").hidden),
      paint: () => { if (map && ready) paint(); },
      counts: () => { if (map && ready) pins(false); },
      pins: () => { if (map && ready) pins(true); },   // 내 핀이 바뀌면 불러 주세요   // 구별 숫자 말풍선은 없앰. 끄는 동안 핀만 다시 꽂는다(120ms 간격)
      focus: (zoom) => { if (map && ready && !$("lmap").hidden) focus(zoom); },
      noLoc: () => noLoc(),
      zoom: (k) => { if (!map) return; if (k > 0) map.zoomIn(); else if (k < 0) map.zoomOut(); else { clearStation(); if (gu) fitGu(gu); else fitAff(true, true); } },
      geo: () => loadGeo(),
      fitAff: (anim) => fitAff(anim),
      fit: () => { shortMark(); if (!map) return; map.resize(); if (!cur) fitAff(false); },   // 고른 구역이 있으면 보던 자리 그대로
      lib: () => loadLib(), style: () => style(), subway: () => subwayGeo(),
      map: () => map,
      // 역·좌표로 지도 옮기기(검색에서 역을 고를 때). 끼워 둔 지도·전체 지도 모두, 지도가 아직 준비 전이면 준비되면 이어서 옮긴다.
      // flyToStation('봉천' | '봉천역' | D.stations 한 줄[이름,lat,lng,…], zoom?=14.5) → true/false(역 못 찾음·간단 지도)
      // flyTo(lng, lat, zoom?=14.5, 이름?) · clearStation() · station() = 지금 보는 역 {ll,z,n} 또는 null
      flyToStation: (q, z) => flyToStation(q, z),
      flyTo: (lng, lat, z, n) => flyTo(lng, lat, z, n),
      clearStation: () => clearStation(),
      station: () => (stnF ? { ll: stnF.ll.slice(), z: stnF.z, n: stnF.n } : null),
      hover: (id) => hover(id),
    };
  })();
  window.ZP_lmx = window.__lmx = LMX;
  // 데스크톱: 목록 줄에 마우스를 올리면 지도에서 그 구역 테두리를 노랗게(목록 코드는 그대로, 이벤트 위임)
  {
    let hv = null;
    const fine = () => matchMedia("(hover:hover) and (pointer:fine)").matches;
    document.addEventListener("mouseover", (e) => { if (!fine()) return; const a = e.target.closest && e.target.closest("#sList [data-id]"), li = e.target.closest && e.target.closest("#sList li"); const id = a ? a.dataset.id : li && li.querySelector("[data-id]") ? li.querySelector("[data-id]").dataset.id : null; if (id === hv) return; hv = id; try { LMX.hover(id); } catch (er) {} });
    document.addEventListener("mouseout", (e) => { if (!hv || !e.target.closest || !e.target.closest("#sList")) return; const to = e.relatedTarget; if (to && to.closest && to.closest("#sList li")) return; hv = null; try { LMX.hover(null); } catch (er) {} });
  }   // 점검(QA)·다른 화면에서 지도 상태를 읽을 때
  // 데스크톱: 목록·검색에서 구역을 고르면 실제 지도가 그 구역으로 가서 굵은 테두리로 보여 준다
  {
    const _selL = select;
    select = function (id) {
      const x = _selL.apply(this, arguments);
      try { if (!MQ_SHEET.matches && cur && cur.id === id && LMX.on()) setTimeout(() => LMX.focus("soft"), 30); } catch (e) {}
      // 데스크톱: 상세로 스크롤한 뒤 지도 칸이 머리 밑으로 밀려 올라가면(붙는 칸의 끝) 머리+8 자리까지 되돌린다
      try {
        if (!MQ_SHEET.matches) {
          const fix = () => { const mc = document.querySelector("#mapTop .main>.mapcard"); if (!mc || document.documentElement.classList.contains("s-full") || !document.documentElement.classList.contains("s-rep") || cur !== sel0) return; const t = mc.getBoundingClientRect().top, want = (HDR() || 56) + 8; if (t < want - 2 && t > want - 400) window.scrollBy({ top: t - want, behavior: "auto" }); };
          const sel0 = cur;   // 상세를 닫았거나(Esc·목록 버튼 → 보던 자리로 되돌림) 다른 구역을 열었으면 손대지 않는다
          [450, 1000].forEach((t) => setTimeout(fix, t));
        }
      } catch (e) {}
      return x;
    };
  }
  // ===================== 구역 리포트 보강: 실거래 · 권리산정기준일 · 공급 계획 · 진행 속도 · 인근 비교 · 경공매 · 물건 확인 =====================
  const ZX = (() => {
    const ymd = (d) => (d && d.length >= 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : "");
    const ymd2 = (d) => (d && d.length >= 8 ? `${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : "");
    const eok = ZF.eok;   // 숫자 꼴은 ZF 하나(05_facts.js)
    const dv = (k) => (D.dv && D.dv[k]) || D.asOf;
    let TXD = null, TXP = null;
    const loadTx = () => TXP || (TXP = fetch(`data/tx.json?v=${dv("tx")}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => (TXD = d && typeof d === "object" ? d : {})));
    // 주변 빌라 매수가 표본(tools/near.py) — 구역 경계에서 반경 안 거래 하나하나(머리 큰 숫자·계산 매수가를 거래 탭에서 맞춰 볼 수 있게)
    let NRD = null, NRP = null;
    const loadNear = () => NRP || (NRP = fetch(`data/near.json?v=${dv("near")}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => (NRD = (d && d.z) || {})));
    // 이 구역 계산 매수가가 주변 표본이고, 목록이 표본 건수와 맞을 때만 돌려준다(어긋나면 보여 주지 않음)
    const nearOf = (r) => { const en = r && r.mk && r.mk.entry, z = NRD && r && NRD[r.id]; return en && en.src === "villa" && (en.radius || 0) >= 100 && z && z.s && z.s.length === en.n ? z : null; };
    const PCL = new Map();
    const loadPcl = (id) => PCL.get(id) || (PCL.set(id, fetch(`data/pcl/${id}.json?v=${dv("tx")}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)), PCL.get(id));
    const bandOf = (r) => (r.s >= 9 || r.dn ? "done" : r.s <= 2 ? "early" : r.s <= 4 ? "mid" : "late");

    // ---------- 권리산정기준일 ----------
    // 2010.7.16 전에 지정된 구역: 지정일을 법 원칙(제77조)으로 확신하지 않는다 — 옛 서울시 조례 부칙 기준일이 따로 적용될 수 있음
    function rights(r) {
      const v = rights0(r);
      if (v.k === "set" && v.c !== "high" && v.d && v.d < "2010.07.16") Object.assign(v, { c: "low", old: 1 });
      return v;
    }
    function rights0(r) {
      const x = r.rdx;
      if (x && x.c === "chg") return { k: "chg", b: x.b, u: x.u };   // 구역지정일이 변경 지정일 → 날짜를 추정하지 않음(tools/enrich.py)
      if (x && x.d) return { d: x.d.replaceAll("-", "."), b: x.b, u: x.u, c: x.c, k: "set" };
      if (typeof r.rd === "string" && r.rd.trim()) return { d: r.rd.trim().replace(/^’/, "20").replace(/\.$/, ""), b: "서울시 모아타운 대상지 권리산정기준일 고시", u: "https://news.seoul.go.kr/citybuild/archives/525003", c: "high", k: "set" };
      const dt0 = r.dt || {}, dz = dt0["구역지정"];
      const zEarly = dz && ["조합설립", "시행자지정", "사업시행", "관리처분", "착공"].find((k) => dt0[k] && dt0[k] < dz);
      if (zEarly) return { k: "chg", b: `등록된 구역지정일(${dz.replaceAll("-", ".")})이 ${zEarly}(${dt0[zEarly].slice(0, 7).replace("-", ".")})보다 늦어 변경 지정일로 보여요. 최초 지정 고시일이나 따로 고시된 기준일을 구청에 확인하세요.`, u: "https://www.law.go.kr/법령/도시및주거환경정비법/제77조" };
      if (dz && r.s >= 2) return { d: dz.replaceAll("-", "."), b: "정비구역 지정 고시일(도시정비법 제77조 원칙) · 별도 고시가 있었다면 그 날짜", u: "https://www.law.go.kr/법령/도시및주거환경정비법/제77조", c: "mid", k: "set" };
      if (r.src === "moa" || /가로|모아/.test(r.k))
        return { k: "moa", b: "모아타운은 대상지 선정 뒤 서울시가 권리산정기준일을 따로 고시해요(2026.10.12부터 구역계 공개일로 앞당김). 가로주택·모아주택 개별 사업은 조합설립인가 전 착공신고·등기 여부로 갈려요.", u: "https://news.seoul.go.kr/citybuild/archives/525003" };
      if ((r.pg || []).some((p) => p.startsWith("신속통합기획")) || r.src === "sintong")
        return { k: "sin", b: "신속통합기획 후보지는 2024년부터 후보지마다 구청장 추천일 등으로 따로 정해 공개하지 않는 경우가 많아요. 구청 도시재생·주택과에 꼭 확인하세요.", u: "https://cleanup.seoul.go.kr/cleanup/bsnssttus/lscrMainIndx.do" };
      if (r.s < 2) return { k: "pre", b: "구역지정 전이라 아직 정해지지 않았어요. 원칙은 정비구역 지정 고시일이고, 그 전에 시장이 따로 고시하면 그 날이에요.", u: "https://www.law.go.kr/법령/도시및주거환경정비법/제77조" };
      return { k: "unk", b: "공개 자료에서 날짜를 찾지 못했어요. 구청 고시·조합 공지로 확인하세요.", u: "https://www.law.go.kr/법령/도시및주거환경정비법/제77조" };
    }
    function rightsHTML(r, compact) {
      const x = rights(r);
      const conf = x.old ? "추정 · 서울시 조례 부칙(2010.7.16 이전 지정) 확인 필요" : x.c === "high" ? "고시·보도자료 확인" : x.c === "mid" ? "법 원칙으로 추정" : x.c === "low" ? "추정 · 확인 필요" : "";
      const old = x.old ? " 2010.7.16 전에 지정된 구역은 옛 서울시 조례 부칙(2003.12.30 다세대 전환 기준·2008.7.30 지분 쪼개기 기준 등)이 적용될 수 있어 이 날짜가 아닐 수 있어요. 구청에 확인하세요." : "";
      if (x.k === "set" && x.old)
        return `<div class="rdx"><div class="rdx-h"><span class="rdx-l">권리산정기준일</span><b class="mono">${esc(x.d)}?</b><span class="rdx-c low">${conf}</span></div>${compact ? "" : `<p>지정 고시일(${esc(x.d)})로 추정했어요.${old} <a href="${esc(x.u)}" target="_blank" rel="noopener">근거</a></p>`}</div>`;
      if (x.k === "set")
        return `<div class="rdx"><div class="rdx-h"><span class="rdx-l">권리산정기준일</span><b class="mono">${esc(x.d)}</b>${conf ? `<span class="rdx-c ${x.c}">${conf}</span>` : ""}</div>${compact ? "" : `<p>${esc(x.b)} · 이날 뒤에 새로 짓거나 쪼갠 지분(신축 빌라·지분 분할)은 입주권이 안 나오거나 여럿이 하나를 나눠 받을 수 있어요.${old} <a href="${esc(x.u)}" target="_blank" rel="noopener">근거</a></p>`}</div>`;
      return `<div class="rdx none"><div class="rdx-h"><span class="rdx-l">권리산정기준일</span><b>${x.k === "pre" ? "아직 없음" : x.k === "chg" ? "확인 필요" : "구청 확인 필요"}</b></div>${compact ? "" : `<p>${esc(x.b)} <a href="${esc(x.u)}" target="_blank" rel="noopener">근거</a></p>`}</div>`;
    }

    // ---------- 진행 속도 ----------
    const PACE_KEY = { 2: "구역지정>조합설립", 3: "추진위>조합설립", 4: "조합설립>사업시행", 5: "사업시행>관리처분", 6: "관리처분>착공", 8: "착공>준공" };
    const STAGE_DT = { 2: "구역지정", 3: "추진위", 4: "조합설립", 5: "사업시행", 6: "관리처분", 8: "착공" };
    function pace(r) {
      if (r.dn || r.s >= 9 || r.src === "moa") return null;
      const k = PACE_KEY[r.s], dk = STAGE_DT[r.s];
      const st0 = (/가로|소규모/.test(r.k) && D.stats.small[k]) || D.stats.large[k];
      const d = r.dt && (r.dt[dk] || (r.s === 4 && r.dt["시행자지정"]));
      if (!k || !st0 || !d) return null;
      const yrs = (Date.now() - new Date(d).getTime()) / (365.25 * 864e5);
      if (!(yrs >= 0)) return null;
      const lvl = yrs > st0.p75 * 1.5 ? "slow2" : yrs > st0.p75 ? "slow" : yrs < st0.p25 ? "fast" : "norm";
      return { yrs, med: st0.med, p25: st0.p25, p75: st0.p75, lvl, from: d, k };
    }
    function paceHTML(r) {
      const p = pace(r);
      if (!p) return "";
      const T = { fast: "빠른 편", norm: "보통", slow: "늦은 편", slow2: "많이 늦음" };
      const w = Math.min(100, (p.yrs / Math.max(p.p75 * 1.6, p.yrs)) * 100), m = Math.min(100, (p.med / Math.max(p.p75 * 1.6, p.yrs)) * 100);
      return `<div class="pace ${p.lvl}"><div class="pace-h"><b>현재 단계 ${p.yrs < 1 ? Math.round(p.yrs * 12) + "개월" : p.yrs.toFixed(1) + "년"}째</b><span class="pace-t">${T[p.lvl]}</span></div><div class="pace-bar" role="img" aria-label="서울 같은 단계 가운데 값 ${p.med}년 대비 ${p.yrs.toFixed(1)}년"><i style="width:${w.toFixed(1)}%"></i><s style="left:${m.toFixed(1)}%"></s></div><small>${esc(p.k.replace(">", " → "))} 서울 실제 소요 가운데 값 ${p.med}년 (보통 ${p.p25}~${p.p75}년) · ${esc(p.from.replaceAll("-", "."))}부터</small></div>`;
    }

    // ---------- 공급 계획 ----------
    function supplyHTML(r) {
      const sm = r.sm || {};
      const units = sm.units ?? (sm.saleUnits != null && sm.rental != null ? sm.saleUnits + sm.rental : null);
      const own = sm.members || sm.owners;
      if (!units || !own || units < own * 0.6) return "";
      if (sm.rental == null) return `<div class="sect supply"><h3>공급 계획 <small>계획 세대 ${fmt(units)} · 소유자 ${fmt(own)}명</small></h3><p class="note">임대 세대 수 자료가 없어 일반분양 비율을 계산하지 않았어요. 재개발은 보통 계획 세대의 15~20% 안팎이 임대예요. 정비계획 결정 고시문의 '주택 규모별 건설계획'으로 확인하세요.</p></div>`;
      const rent = sm.rental, mem = Math.min(own, units - rent), gen = Math.max(0, units - rent - mem);
      const pc = (v) => Math.round((v / units) * 1000) / 10;
      const genR = gen / units;
      const hint = genR >= 0.3 ? "일반분양이 많아 분담금 부담이 줄어드는 쪽이에요" : genR >= 0.15 ? "서울 정비사업 보통 수준이에요" : "일반분양이 적어 사업비를 조합원이 더 나눠 내야 할 수 있어요(비례율 낮아질 가능성)";
      return `<div class="sect supply"><h3>공급 계획 <small>계획 세대 ${fmt(units)} · ${r.k === "재건축" ? "조합원" : "토지등소유자"} ${fmt(own)}명 기준 추정</small></h3>
        <div class="sp-bar" role="img" aria-label="조합원 ${pc(mem)}%, 일반분양 ${pc(gen)}%, 임대 ${pc(rent)}%"><i class="m" style="width:${pc(mem)}%"></i><i class="g" style="width:${pc(gen)}%"></i><i class="t" style="width:${pc(rent)}%"></i></div>
        <ul class="sp-key"><li><i class="m"></i>조합원 몫 ${fmt(mem)}세대 · ${pc(mem)}%</li><li><i class="g"></i>일반분양 ${fmt(gen)}세대 · ${pc(gen)}%</li><li><i class="t"></i>임대 ${fmt(rent)}세대 · ${pc(rent)}%</li></ul>
        <p class="note">일반분양 ${pc(gen)}%: ${hint}. 조합원 몫은 소유자 1명당 1세대로 단순 계산했고, 실제 분양 신청자 수·상가 조합원에 따라 달라요.</p></div>`;
    }

    // ---------- 인근 구역 비교 ----------
    function hav(a, b) {
      const R0 = 6371000, t = Math.PI / 180, x = Math.sin(((b[0] - a[0]) * t) / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(((b[1] - a[1]) * t) / 2) ** 2;
      return 2 * R0 * Math.asin(Math.sqrt(x));
    }
    function needOf(r) {
      if (r.src === "moa") return null;
      try {
        if (gapMode()) { const g = gapOf(r); return g && !g.block && !g.na ? g.now : null; }
        const x = investC(r);
        return effBasis() === "total" ? (x.ok ? x.needTotal : null) : x.needBuy;
      } catch (e) { return null; }
    }
    function nearbyHTML(r) {
      if (!r.ll) return "";
      const near = R.filter((q) => q !== r && q.ll && !q.dn && q.s < 9 && q.src !== "moa" && hav(r.ll, q.ll) <= 1000)
        .map((q) => [q, hav(r.ll, q.ll)]).sort((a, b) => a[1] - b[1]).slice(0, 6);
      if (!near.length) return "";
      const cols = [[r, 0], ...near];
      const lab = gapMode() ? "전세 끼고 지금" : effBasis() === "total" ? "입주까지 현금" : "지금 매수";
      const rows = [
        ["거리", (q, d) => (d ? `${fmt(d)}m` : "이 구역")],
        ["사업", (q) => esc(SHAPE[shapeOf(q)])],
        ["단계", (q) => esc(stageName(q))],
        ["계획 세대", (q) => (q.sm?.units ? fmt(q.sm.units) : "–")],
        // 이 구역 리포트 머리 큰 숫자와 같은 값(ZF.u33: 매수가 표본의 3.3㎡당 · 머리가 매수가인 곳은 구역 안 대표 거래 값)
        ["3.3㎡당 실거래(기준)", (q) => { const h = ZF.u33(q); return h ? `${eok(h.v)}<span class="dim" style="display:block;font-size:11px;font-weight:400;color:var(--text-3)">${h.zone ? `구역 안 ${h.n || ""}건(참고 · 매수가 표본 아님)` : HDB[h.b] || ""}${h.st ? " · 오래된 거래" : ""}</span>` : "–"; }],
        [lab, (q) => { const n = needOf(q); return n == null ? "–" : `${e2(n)}억`; }, (q) => needOf(q)],
        ["10년 안 준공", (q) => (q.eta?.p10 != null ? prob(q.eta.p10) + "%" : "–"), (q) => (q.eta?.p10 != null ? -q.eta.p10 : null)],
      ];
      // 비교하는 곳 절반 넘게 '–'인 '계획 세대' 줄은 뺀다
      for (let i = rows.length - 1; i >= 0; i--) { if (rows[i][0] !== "계획 세대") continue; const v = cols.map(([q, d]) => String(rows[i][1](q, d))); if (v.filter((x) => x === "–").length > cols.length / 2) rows.splice(i, 1); }
      const best = rows.map(([, , k]) => { if (!k) return null; const v = cols.map(([q]) => k(q)).filter((x) => x != null); return v.length ? Math.min(...v) : null; });
      return `<div class="sect nearcmp"><h3>1km 안 다른 구역과 비교 <small>${near.length}곳 · 같은 내 조건으로 계산 · 굵은 값이 가장 유리 · 3.3㎡당 값은 각 구역 실거래 탭 맨 위와 같은 기준</small></h3><div class="nc-wrap"><table class="nc"><thead><tr><th scope="col"></th>${cols.map(([q], i) => `<th scope="col">${i ? `<button type="button" class="nc-go" data-go="${q.id}">${esc(shortName(q.n))}</button>` : `<b>${esc(shortName(q.n))}</b>`}</th>`).join("")}</tr></thead><tbody>${rows
        .map(([t, f, k], ri) => `<tr><th scope="row">${t}</th>${cols.map(([q, d]) => { const v = k ? k(q) : null; return `<td${v != null && v === best[ri] ? ' class="b"' : ""}>${f(q, d)}</td>`; }).join("")}</tr>`)
        .join("")}</tbody></table></div></div>`;
    }

    // ---------- 경매 물건(법원경매정보 · tools/auction.js → tools/auction_match.py → data/auction.json) ----------
    // 리포트를 열 때 한 번 받아 둔다(작은 파일). 구역 경계 안 필지와 지번이 맞는 물건만.
    let AUC = null, AUCP = null;
    const loadAuc = () => AUCP || (AUCP = fetch(`data/auction.json?v=${dv("auction")}`).then((x) => (x.ok ? x.json() : null)).catch(() => null).then((d) => (AUC = d && typeof d === "object" ? d : { ok: false, byZone: {} })));
    const aucOf = (r) => (AUC && AUC.ok && !(AUC.miss || []).includes(r.g) && AUC.byZone && AUC.byZone[r.id]) || [];
    const aucWon = (v) => { if (v == null || !isFinite(v)) return "–"; const e = Math.floor(v / 1e8), m = Math.round((v % 1e8) / 1e4); return e ? `${e}억${m ? ` ${m.toLocaleString("ko-KR")}만` : ""}원` : `${m.toLocaleString("ko-KR")}만원`; };
    const aucDay = (d) => { if (!d) return "–"; const t = new Date(d + "T00:00:00+09:00"); return `${d.replaceAll("-", ".")} (${"일월화수목금토"[t.getDay()]})`; };
    const aucCourt = (c) => String(c || "").replace(/^서울(.+)지방법원$/, "서울$1지법");
    function aucItem(o) {
      const fail = o.fail == null ? "" : o.fail > 0 ? `<span class="auc-f n">유찰 ${o.fail}회</span>` : `<span class="auc-f">신건</span>`;
      const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : "");
      return `<li class="auc-i"><div class="auc-ih"><b class="mono">${esc(o.cs)}${o.no ? `<span class="auc-no">물건 ${o.no}</span>` : ""}</b><span class="auc-ct">${esc(aucCourt(o.court))}${o.dept ? ` ${esc(o.dept)}` : ""}</span>${fail}</div>
        <div class="auc-pr"><div><span>최저 입찰가</span><b>${aucWon(o.min)}</b>${o.rate != null ? `<em>감정가의 ${o.rate}%</em>` : ""}</div><div><span>감정가</span><b>${aucWon(o.appr)}</b></div><div><span>매각기일</span><b>${aucDay(o.date)}</b>${o.time ? `<em>${esc(o.time)}</em>` : ""}</div></div>
        <dl class="auc-dl">${row("용도", esc(o.use || ""))}${row("소재지", esc(o.addr || "") + (o.bld ? ` <span class="dim">${esc(o.bld)}</span>` : ""))}${row("면적", esc(o.area || ""))}${row("비고", esc(o.note || ""))}</dl></li>`;
    }
    function aucBody(r) {
      const asOf = AUC && AUC.asOf ? String(AUC.asOf).replaceAll("-", ".") : "";
      if (!AUC) return `<p class="auc-st">경매 물건 불러오는 중…</p>`;
      if (!AUC.ok || (AUC.miss || []).includes(r.g)) return `<p class="auc-st na">경매 물건 정보를 아직 못 가져왔어요${asOf && AUC.ok ? ` (기준 ${asOf})` : ""}</p>`;
      const xs = aucOf(r);
      if (!xs.length) return `<p class="auc-st">지금 이 구역 안에 진행 중인 경매 물건이 없어요 (기준 ${asOf})</p>`;
      return `<ul class="auc-l">${xs.map(aucItem).join("")}</ul><p class="auc-src">법원경매정보 ${asOf} 기준 · 구역 경계 안 필지와 지번이 맞는 진행 중 물건 · 최저 입찰가는 다음 매각기일 기준</p>`;
    }
    function auctionHTML(r) {
      loadAuc();
      const asOf = AUC && AUC.asOf ? ` · ${String(AUC.asOf).replaceAll("-", ".")} 기준` : "";
      const n = aucOf(r).length;
      return `<div class="sect auc" id="aucSec" data-id="${esc(r.id)}"><h3>경매 물건 ${n ? `<span class="auc-n">${n}건</span>` : ""}<small>법원경매정보 · 구역 경계 안 필지${asOf}</small></h3>
        <div class="auc-b" aria-live="polite">${aucBody(r)}</div>
        <p class="auc-nt">경매로 사도 권리산정기준일·조합원 지위 양도 제한은 똑같이 적용되고, 현금청산 대상이면 입주권이 없어요.</p></div>`;
    }
    function bindAuction() {
      const s = $("aucSec");
      if (!s || AUC) return;
      loadAuc().then(() => { const s2 = $("aucSec"), r = byId[s2 && s2.dataset.id]; if (s2 && r) s2.outerHTML = auctionHTML(r); });
    }
    // 리포트 머리에 '경매 N건' 칩(물건이 있을 때만) → 누르면 호재·매물 탭의 경매 물건으로
    try {
      const _rrA = renderReport;
      renderReport = function () {
        const x = _rrA.apply(this, arguments);
        const r0 = cur;
        loadAuc().then(() => {
          if (cur !== r0 || !r0) return;
          const h = document.querySelector("#report .rep-head");
          const n = aucOf(r0).length;
          if (!h || !n || h.querySelector(".auc-chip")) return;
          // 주소 줄(구 동 · 역 · 경사 칩) 끝에 붙인다 — 없으면 머리 끝
          const w = h.querySelector(".where");
          const b = `<button type="button" class="auc-chip" title="이 구역 안 진행 중인 법원경매 물건 ${n}건 보기">경매 ${n}건</button>`;
          if (w) w.insertAdjacentHTML("beforeend", b); else h.insertAdjacentHTML("beforeend", `<div class="auc-cw">${b}</div>`);
          h.querySelector(".auc-chip").onclick = () => {
            const go = () => { const s = $("aucSec"); if (s) s.scrollIntoView({ behavior: smooth(), block: "start" }); };
            if (curTab !== "near" && $("tab-near")) { setTab("near"); requestAnimationFrame(go); } else go();
          };
        });
        return x;
      };
    } catch (e) {}

    // ---------- 주소로 물건 확인 ----------
    function addrHTML(r) {
      if (!r.pcl || r.src === "moa") return `<div class="sect acheck"><h3>매물 지번으로 확인</h3><p class="note">이 구역은 공식 경계가 공개되지 않아(후보지·구역지정 전 등) 지번별 경계 판정을 할 수 없어요. 구청 도시정비과에 구역계 도면을 확인하세요.</p></div>`;
      return `<div class="sect acheck"><h3>매물 지번으로 확인 <small>구역 경계 안인지 · 언제 지은 건물인지</small></h3>
        <form class="ac-f" id="acForm" autocomplete="off"><label class="sr-only" for="acIn">지번</label><div class="inp"><input id="acIn" placeholder="예: ${esc(((r.bj || r.j || "").split(" ")[1]) || "123-4")}" inputmode="text"></div><button type="submit" class="btn secondary sm">확인</button></form>
        <div id="acOut" aria-live="polite"></div>
        <p class="note">서울도시공간포털 연속지적 필지와 실거래·전월세 신고의 준공연도로 판정한 참고용이에요. 등기부·건축물대장과 조합에 꼭 확인하세요.</p></div>`;
    }
    function bindAddr(r) {
      const f = $("acForm");
      if (!f) return;
      f.onsubmit = (e) => {
        e.preventDefault();
        const raw = $("acIn").value.trim().replace(/\s+/g, "").replace(/번지$/, "");
        const m = raw.match(/(산)?(\d+)(?:-(\d+))?$/);
        const out = $("acOut");
        if (!m) { out.innerHTML = `<p class="note">지번을 '본번-부번' 형태로 넣어 주세요. 예: 123-4</p>`; return; }
        const key = (m[1] || "") + String(+m[2]) + (m[3] && +m[3] ? "-" + +m[3] : "");
        out.innerHTML = `<p class="note">찾는 중…</p>`;
        loadPcl(r.id).then((d) => {
          if (cur !== r) return;
          const geo = GEO_Z && GEO_Z[r.id];
          if (!d || !d.p) { out.innerHTML = `<p class="note">${geo && geo.e ? "이 구역은 공식 경계가 없어 필지 판정을 할 수 없어요." : "필지 자료를 불러오지 못했어요."}</p>`; return; }
          const hits = d.p.filter((x) => x[1] === key);
          const ri = rights(r);
          if (!hits.length) {
            out.innerHTML = `<ul class="acl"><li class="warn"><b>경계 안 필지 목록에 없어요</b> 이 구역 공식 경계 안 ${fmt(d.p.length)}필지(${esc(Object.values(d.d).filter(Boolean).join("·"))}) 중에 '${esc(key)}'가 없어요. 지번을 잘못 넣었거나, 합필·분필로 번호가 바뀌었거나, 경계 밖일 수 있어요. 등기부·토지대장의 지번으로 다시 확인하세요.</li></ul>`;
            return;
          }
          out.innerHTML = `<ul class="acl">${hits.map((x) => {
            const dn = d.d[x[0]] || "";
            const yr = x[4];
            const rdY = ri.k === "set" ? +ri.d.slice(0, 4) : null;
            const yrLine = !yr ? `<li class="na"><b>준공연도 미확인</b> 최근 거래 신고가 없어 준공연도를 몰라요. 건축물대장으로 사용승인일을 확인하세요.</li>`
              : rdY && yr > rdY ? `<li class="bad"><b>${yr}년 준공 · 권리산정기준일(${esc(ri.d)}) 뒤</b> 기준일 뒤 신축이면 입주권이 안 나오거나 나눠 받을 수 있어요.</li>`
              : rdY && yr === rdY ? `<li class="warn"><b>${yr}년 준공 · 기준일과 같은 해</b> 사용승인일이 ${esc(ri.d)} 전인지 건축물대장으로 확인하세요.</li>`
              : `<li class="ok"><b>${yr}년 준공</b> ${rdY ? `권리산정기준일(${esc(ri.d)}) 전에 지은 건물이에요.` : "권리산정기준일이 정해지면 그 전 준공인지가 중요해요."}${2026 - yr <= 10 ? " 10년 이하 신축이라 지분 쪼개기 여부를 꼭 확인하세요." : ""}</li>`;
            return `<li class="ok"><b>구역 경계 안</b> ${esc(dn)} ${esc(x[1])} · 지목 ${esc(x[3])} · 필지 면적 ${fmt(x[2])}㎡${x[2] < 90 && /^대/.test(x[3]) ? " (90㎡ 미만 과소필지)" : ""}</li>${yrLine}`;
          }).join("")}</ul>`;
        });
      };
    }

    // ---------- 몇 개만 보여 주고 '더보기' ----------
    function moreRows(box, n) {
      const rows = [...box.querySelectorAll("tbody > tr, ul > li")];
      if (rows.length <= n) return;
      rows.slice(n).forEach((x) => (x.hidden = true));
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn secondary sm more-b"; b.textContent = `더 보기 (${rows.length - n}건)`; b.setAttribute("aria-expanded", "false");
      b.onclick = () => { const open = b.getAttribute("aria-expanded") !== "true"; rows.slice(n).forEach((x) => (x.hidden = !open)); b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "접기" : `더 보기 (${rows.length - n}건)`; };
      box.appendChild(b);
    }

    // ---------- 실거래 탭 ----------
    function chartSVG(r, q, lab) {
      if (!q || q.length < 2) return "";
      const W = 560, H = 150, pl = 8, pr = 8, pt = 16, pb = 22;
      const vs = q.map((x) => x[1]), mn = Math.min(...vs), mx = Math.max(...vs), rg = Math.max(1, mx - mn);
      const t0 = qT(q[0][0]), t1 = qT(q[q.length - 1][0]) + 0.25;
      const X = (t) => pl + ((t - t0) / Math.max(0.25, t1 - t0)) * (W - pl - pr), Y = (v) => pt + (H - pt - pb) * (1 - (v - mn) / rg);
      const pts = q.map((x) => [X(qT(x[0]) + 0.125), Y(x[1]), x]);
      const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
      const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${H - pb}L${pts[0][0].toFixed(1)},${H - pb}Z`;
      const ms = Object.entries(r.dt || {}).filter(([k, d]) => d && ["구역지정", "추진위", "조합설립", "사업시행", "관리처분"].includes(k)).map(([k, d]) => [k, +d.slice(0, 4) + (+d.slice(5, 7) - 1) / 12]).filter(([, t]) => t >= t0 && t <= t1);
      const yr0 = Math.ceil(t0), ticks = []; for (let y = yr0; y <= t1; y++) ticks.push(y);
      return `<svg class="txc" viewBox="0 0 ${W} ${H}" role="img" aria-label="분기별 ${lab || "대지 3.3㎡당"} 가격 가운데 값 추이${ms.length ? "와 인가 시점" : ""}">
        ${ticks.map((y) => `<line x1="${X(y).toFixed(1)}" x2="${X(y).toFixed(1)}" y1="${pt}" y2="${H - pb}" class="g"/><text x="${X(y).toFixed(1)}" y="${H - 6}" class="x">${y}</text>`).join("")}
        ${ms.map(([k, t]) => `<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${pt - 6}" y2="${H - pb}" class="m"/><text x="${(X(t) + 3).toFixed(1)}" y="${pt - 4}" class="mt">${k}</text>`).join("")}
        <path d="${area}" class="a"/><path d="${line}" class="l"/>
        ${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${p[2][2] >= 5 ? 3 : 2}" class="d"><title>${p[2][0]} · ${eok(p[2][1])} · ${p[2][2]}건</title></circle>`).join("")}
        <text x="${(pts[pts.length - 1][0] - 2).toFixed(1)}" y="${(pts[pts.length - 1][1] - 7).toFixed(1)}" class="v" text-anchor="end">${eok(vs[vs.length - 1])}</text></svg>`;
    }
    const qT = (s) => 2000 + +s.slice(0, 2) + (+s.slice(3) - 1) / 4;
    // 실거래 머리글 기준(tools/tx.py headline): v 빌라·단독 대지 · a 아파트 전용 · i 입주권 전용
    const HDB = { v: "빌라·단독 대지", a: "아파트 전용", i: "입주권 전용" };
    const hdWin = (h) => (h.w === 0 ? "가장 최근 1건" : `최근 ${h.w === 24 ? "2년" : "1년"} ${fmt(h.n)}건`);
    function noTxHTML(r, t, z) {
      const nb = r.tag === "mk" || r.nx === "mk" ? null : t.nb;   // 시장·상가 정비는 빌라 시세를 쓰지 않는다
      // 제목만 남지 않게: 안내 문장은 note 클래스가 아닌 문단(간단 보기에서도 보임)
      return `<div class="sect tx-none"><p style="margin:4px 0 8px;color:var(--text-2)">${(z && !z.e) || r.pcl ? "최근 구역 안 매매·전세 신고가 없어요." : "공식 경계가 없는 구역(후보지·구역지정 전 등)이라 경계 안 거래만 따로 모을 수 없어요."} 주변 시세는 '호재·매물' 탭의 KB부동산에서 확인할 수 있어요.</p>${nb && nb.n ? `<div class="bigrow"><div class="big"><span>같은 동${nb.dong ? `(${esc(nb.dong)})` : ""} 빌라 매매 가운데 값 · 참고</span><b>${eok(nb.med)}</b><small>최근 1년 ${fmt(nb.n)}건 · 구역 밖 거래 포함</small></div></div>` : ""}</div>`;
    }
    function paneTx(r) {
      const p = $("pane"), z = GEO_Z && GEO_Z[r.id];
      if (!TXD || !NRD) { p.innerHTML = `<p class="note">구역 실거래를 불러오는 중…</p>`; Promise.all([loadTx(), loadNear()]).then(() => { if (cur === r && curTab === "tx" && $("pane")) paneTx(r); }); return; }
      const z0 = TXD[r.id] || {}, S = Array.isArray(z0.s) ? z0.s : [], J = Array.isArray(z0.j) ? z0.j : [];
      const t = { ...(r.tx || {}), ...(z0.x || {}) }, h = t.hd && t.hd.u ? t.hd : null;
      const rdx = rights(r);
      if (!h && !S.length && !J.length) {   // 거래가 없으면 짧게(필지·노후도만 따로)
        p.innerHTML = noTxHTML(r, t, z) + (rdx.k === "set" ? rightsHTML(r, true) : "");
        return;
      }
      const pc = t.pc, age = t.age || {}, agn = t.agn || {};
      const x = (() => { try { return invest(r); } catch (e) { return {}; } })();
      const en = r.mk?.entry;
      const per = h ? `${HDB[h.b]} 3.3㎡당` : "";
      const big = [];
      if (h) big.push(`<div class="big hl"><span>${per}${h.n === 1 || h.w === 0 ? " · 거래 1건" : " 가운데 값"}</span><b>${eok(h.u)}</b><small>${hdWin(h)} · ${esc(ymd2(h.from))}${h.from !== h.to ? "~" + esc(ymd2(h.to)) : ""}${h.st ? ' · <em class="flag">오래된 거래</em>' : ""}${h.xo ? ` · 시세와 크게 다른 ${h.xo}건 제외` : ""}${h.xn ? ` · 2016년 이후 신축·대지 10㎡ 미만 ${h.xn}건 제외` : ""}</small></div>`);
      if (h && h.b !== "v") big.push(`<div class="big"><span>${h.b === "i" ? "입주권" : "아파트"} 거래가 가운데 값</span><b>${eok(h.p)}</b><small>같은 ${fmt(h.n)}건 · 전용 ${h.pa}㎡ 가운데</small></div>`);
      else if (t.med) big.push(`<div class="big"><span>구축 빌라 매매 가운데 값</span><b>${eok(t.med)}</b><small>2015년 이전 준공 빌라 최근 ${t.nwin || 18}개월 ${fmt(t.no)}건 · 전용 ${t.ar}㎡ · 대지 ${t.ld}㎡</small></div>`);
      if (t.jm) big.push(`<div class="big"><span>빌라 전세 가운데 값</span><b>${eok(t.jm)}</b><small>${t.jy ? `${t.jy[0] === t.jy[1] ? t.jy[0] : t.jy[0] + "~" + t.jy[1]}년 준공(매매 표본과 같은 연식) ` : ""}전세 ${fmt(t.jn)}건 · 임대 ${t.ja}㎡${t.jr ? ` · 전세가율 ${Math.round(t.jr * 100)}%` : t.jr2 ? ` · 전세가율 약 ${Math.round(t.jr2 * 100)}%` : ""}${(() => {
        // 전세 표본과 매수가 표본은 면적이 달라 바로 빼면 안 된다 → 계산에 쓴 전세(전세가율)를 함께
        try { const g = gapOf(r), am = en && en.area_med, dif = am && t.ja && Math.abs(t.ja - am) / am > 0.15; if (!g || g.block || g.na || !(g.D > 0)) return ""; return `${dif ? ` · 매수가 표본(전용 ${am}㎡)과 면적이 달라 직접 비교 불가` : ""} · 계산엔 전세 ${e2(g.D)}억(전세가율 ${fmt(g.jr, 1)}%)`; } catch (e) { return ""; }
      })()}</small></div>`);
      const villaSec = h && h.b === "v";
      const ageOk = villaSec && ["a", "b", "c"].some((k) => age[k] != null);
      const doneI = h && h.b === "i" && r.s >= 9;
      // 유형 이름: 준공(s>=9) 구역의 '입주권' 신고는 보존등기 전 아파트 거래라 '아파트(입주권 신고)'
      const TY = ["빌라", "단독", "아파트", r.s >= 9 ? "아파트(입주권 신고)" : "입주권"];
      const rdY = rdx.k === "set" ? +rdx.d.slice(0, 4) : null;
      // 아파트·입주권: 같은 유형·전용 ±10㎡·앞뒤 1년 거래 가운데 값의 0.75~1.35배 밖이면 표시(머리글 이상치 기준과 같음)
      const dd = (v) => Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8));
      const odd = (v) => {
        if (v[1] < 2 || !(v[3] > 0)) return false;
        const u = (w) => w[5] / w[3], band = S.filter((w) => w[1] === v[1] && w[3] > 0 && Math.abs(w[3] - v[3]) <= 10 && Math.abs(dd(w[0]) - dd(v[0])) <= 365 * 864e5).map(u).sort((a, b) => a - b);
        if (band.length < 3) return false;
        const m = band.length % 2 ? band[band.length >> 1] : (band[band.length / 2 - 1] + band[band.length / 2]) / 2;
        return u(v) < 0.75 * m || u(v) > 1.35 * m;
      };
      const flr = (v) => (v[6] ? ` ${+v[6] < 0 ? "지하" + -v[6] : esc(String(v[6]))}층` : "");
      const flag = (v) => (v[2] >= 2016 && v[4] > 0 && v[4] <= 15 ? ' <em class="flag" title="최근 준공·대지 15㎡ 이하: 지분 쪼개기 신축일 수 있어요">쪼개기 의심</em>' : rdY && v[2] > rdY && v[1] <= 1 ? ' <em class="flag" title="권리산정기준일 뒤 준공">기준일 뒤 준공</em>' : odd(v) ? ' <em class="flag" title="같은 면적대 시세와 크게 달라 큰 숫자·추이 계산에서 뺀 거래(직거래·특수관계 등일 수 있어요)">시세와 다름</em>' : "");
      // 빌라·단독(대지 3.3㎡당)과 아파트·입주권(전용 3.3㎡당)은 기준이 달라 표를 나눈다
      // 좁은 화면(360px)에서도 가로로 잘리지 않게 3칸: [계약일 · 유형 층 / 준공 · 전용 · 대지] [가격] [3.3㎡당]
      const SV = S.filter((v) => v[1] <= 1), SA = S.filter((v) => v[1] >= 2);
      const TS = ' style="min-width:0;table-layout:auto"', C1 = ' style="white-space:normal"', SM = ' style="display:block;font-size:11.5px;color:var(--text-3);margin-top:2px"';
      const row = (v, land) => `<tr><td${C1}>${ymd2(v[0])} · ${TY[v[1]]}${flr(v)} · <span style="white-space:nowrap">${land ? (v[4] ? `대지 ${v[4]}㎡` : `전용 ${v[3]}㎡`) : `${v[3]}㎡`}</span>${flag(v)}<small${SM}>${v[2] ? v[2] + "년 준공" : "준공 미상"}${land && v[4] ? ` · 전용 ${v[3]}㎡` : ""}</small></td><td class="n"><b>${eok(v[5])}</b></td><td class="n">${land ? (v[4] > 0 ? eok(Math.round((v[5] / v[4]) * 3.3058)) : "–") : v[3] > 0 ? eok(Math.round((v[5] / v[3]) * 3.3058)) : "–"}</td></tr>`;
      const head = (land) => `<thead><tr><th scope="col">계약일 · 유형</th><th scope="col" class="n">가격</th><th scope="col" class="n">${land ? "대지" : "전용"} 3.3㎡당</th></tr></thead>`;
      // 같은 면적대 시세와 크게 다른 거래(머리글·추이 계산에서 뺀 것)는 맨 위에 올리지 않고 접어 둔다
      const split = (L) => { const a = [], o = []; L.slice(0, 40).forEach((v) => (odd(v) ? o : a).push(v)); return [a, o]; };
      const tbl = (L, land, id) => {
        if (!L.length) return "";
        const [a, o] = split(L);
        const main = a.length ? `<div id="${id}" class="txl"><table class="tx"${TS}>${head(land)}<tbody>${a.map((v) => row(v, land)).join("")}</tbody></table></div>` : "";
        const off = o.length ? `<details class="tx-odd" style="margin-top:8px"><summary style="cursor:pointer;font-size:13px;color:var(--text-2)">시세와 다른 거래 ${o.length}건</summary><div class="txl"><table class="tx" style="min-width:0;opacity:.75">${head(land)}<tbody>${o.map((v) => row(v, land)).join("")}</tbody></table></div></details>` : "";
        return main + off;
      };
      const tblV = tbl(SV, true, "txListV"), tblA = tbl(SA, false, "txListA");
      const scope = t.m === "jibun" ? "대표지번과 같은 본번" : t.m === "name" ? `단지 이름으로 찾은 ${esc((t.cx && t.cx.nm) || "같은 단지")}` : "구역 경계 안";
      const nearB = !!(r.mk && r.mk.entry && r.mk.entry.src === "villa" && (r.mk.entry.radius || 0) >= 100);
      const secV = tblV ? `<div class="sect"><h3>최근 매매 · 빌라·단독 <small>${scope} · 대지 3.3㎡당 · 국토부 신고 기준${nearB ? " · 계산 매수가 표본 아님(참고)" : h && h.b === "v" ? " · 위 큰 숫자 기준" : ""}</small></h3>${tblV}</div>` : "";
      const aLab = SA.some((v) => v[1] === 2) && SA.some((v) => v[1] === 3) ? `아파트·${TY[3]}` : SA.some((v) => v[1] === 3) ? TY[3] : "아파트";
      const secA = tblA ? `<div class="sect"><h3>최근 매매 · ${aLab} <small>${scope} · 전용 3.3㎡당 · 국토부 신고 기준${h && h.b !== "v" ? " · 위 큰 숫자 기준" : ""}</small></h3>${tblA}</div>` : "";
      const salesSecs = h && h.b !== "v" ? secA + secV : secV + secA;
      // 매수가 표본(주변 빌라): 머리 큰 숫자·'이 숫자 믿어도 될까'·계산 매수가가 쓰는 바로 그 거래들, 새 거래부터
      const nz = nearOf(r), nen = r.mk && r.mk.entry;
      const secN = nz ? (() => {
        const rowN = (v) => `<tr><td${C1}>${ymd2(v[0])} · 빌라${v[5] ? ` ${+v[5] < 0 ? "지하" + -v[5] : esc(String(v[5]))}층` : ""} · <span style="white-space:nowrap">전용 ${v[1]}㎡</span><small${SM}>${esc(v[6])} · ${v[7] ? `경계에서 ${fmt(v[7])}m` : "구역 안"} · ${v[3]}년 준공${v[2] > 0 ? ` · 대지 ${v[2]}㎡` : ""}</small></td><td class="n"><b>${eok(v[4])}</b></td><td class="n">${v[2] > 0 ? eok(Math.round((v[4] / v[2]) * 3.3058)) : "–"}</td></tr>`;
        return `<div class="sect nearsmp"><h3>매수가 표본 · 주변 ${fmt(nz.r)}m 빌라 ${fmt(nz.s.length)}건</h3><p class="nz-def">계산 매수가 <b>${ZF.manT(nen.med / 1e4)}</b> = 아래 ${fmt(nz.s.length)}건의 가운데 값 · 새 거래부터 · 최근 ${nz.w}개월 · ${nen.yr_cap || 2010}년 이전 준공 · 전용 30~70㎡ · 구역 경계에서 ${fmt(nz.r)}m 안(경계 안 포함)</p><div id="txListN" class="txl"><table class="tx"${TS}><thead><tr><th scope="col">계약일 · 위치</th><th scope="col" class="n">가격</th><th scope="col" class="n">대지 3.3㎡당</th></tr></thead><tbody>${nz.s.reduce((a, v) => { const k = v.join("|"), l = a[a.length - 1]; if (l && l.k === k) l.n++; else a.push({ k, v, n: 1 }); return a; }, []).map(({ v, n }) => rowN(v).replace("</small></td>", `${n > 1 ? ` · 같은 조건 ${n}건` : ""}</small></td>`)).join("")}</tbody></table></div></div>`;
      })() : "";
      const calcNote = (() => {
        if (x.price == null) return "";
        const LCW = { n: "매수가 표본이 3건 미만이라", old: "매수가에 쓴 거래가 1년 넘게 지난 것이라", thin: "구역 안 거래가 1~2건뿐이고 1년 넘게 지나 주변 시세로 정한 값을 확인할 수 없어" };
        const lc = en && en.lc && x.priceSrc !== "user" ? ` <em class="flag">참고값</em> ${LCW[en.lcw] || `구역 안 비교 거래가 적거나 구역 거래 구성(${h && h.b === "a" ? "아파트 위주" : "표본 적음"})과 달라`} '살 수 있는 곳' 순위에서는 빼요.` : "";
        const warn = x.priceSrc !== "user" && en?.fill !== "zone" && en?.fill !== "zoneapt" && t.no
          ? `<p class="note warnbox"><b>계산은 다른 값을 써요</b> ${r.src === "moa" ? "모아타운 관리지역은 블록별로 사업이 따로 진행돼, 관리지역 전체가 아니라 주변 빌라 시세로 계산했어요." : en?.src === "complex" ? "재건축 단지라 같은 단지 아파트 매매로 계산했어요." : `구역 안 구축 빌라 매매(최근 ${t.nwin || 18}개월 ${t.no}건)가 기준(5건)에 못 미쳐 주변 빌라 시세로 계산했어요.`} 실제 매물가는 '입주 현금' 탭에 넣어 다시 계산하세요.</p>` : "";
        // 머리 카드·/z/ 페이지와 같은 한 문장(64_overview.js OVX.smp)
        const one = typeof OVX !== "undefined" && OVX.smp && x.priceSrc !== "user" ? OVX.smp(r, x) : "";
        if (one) return `${warn}<p class="note"><b>계산 매수가 ${OVX.manT(x.price)}</b> = ${esc(one)} · '입주 현금' 탭에서 바꿀 수 있어요${lc}</p>`;
        return `${warn}<p class="note"><b>계산에 쓴 매수가 ${e2(x.price)}억</b> ${x.priceSrc === "user" ? "직접 입력한 값" : en?.scope ? esc(en.scope) + ` 실거래 가운데 값${en.n ? ` (${fmt(en.n)}건${en.area_med ? ` · 전용 ${en.area_med}㎡` : ""})` : ""}` : x.priceSrc === "complex" ? "같은 단지 아파트 실거래" : "구역 주변 구축 빌라 실거래"} · '입주 현금' 탭에서 바꿀 수 있어요${lc}</p>`;
      })();
      p.innerHTML = `
        ${h || S.length ? "" : noTxHTML(r, t, z)}
        ${big.length ? `<div class="bigrow${big.length >= 2 ? " b3" : ""}">${big.join("")}</div>` : ""}
        ${h && h.st ? `<p class="note warnbox"><b>오래된 거래</b> 위 값은 ${esc(ymd(h.to))} 거래 1건이에요. 1년 넘게 같은 기준 거래가 없어 지금 시세와 다를 수 있어요.</p>` : ""}
        ${doneI ? `<p class="note"><b>준공한 단지예요</b> 입주는 끝났지만 이전고시·소유권 보존등기 전이라 실거래 신고상 '입주권'으로 올라와요.</p>` : ""}
        ${calcNote}
        ${ageOk ? `<details class="sect ov-alt"><summary><h3>다른 기준 보기 · 연식별 대지 3.3㎡당 <small>구역 안 빌라·단독 전체 기간이라 위 큰 숫자와 기준이 달라요 · 권리산정기준일 뒤 신축이면 입주권이 문제될 수 있어요</small></h3></summary><dl class="facts">
          ${[["a", "10년 이하"], ["b", "11~30년"], ["c", "31년 이상"]].filter(([k]) => age[k] != null).map(([k, l]) => `<div><dt>${l}</dt><dd>${eok(age[k])}<small>${agn[k] || 0}건</small></dd></div>`).join("")}
          <div><dt>쪼개기 의심 거래</dt><dd>${t.split ? t.split + "건" : "없음"}<small>2016년 이후 준공 · 대지 15㎡ 이하</small></dd></div></dl></details>` : ""}
        ${t.old && t.old.k && r.s < 7 ? `<div class="sect"><h3>노후도 <small>구역 경계 안 건축물 ${fmt(t.old.n)}동 전수 · 사용승인연도 확인 ${fmt(t.old.k)}동 · 서울도시공간포털 건물 정보(사용승인 2022년까지 반영)</small></h3><div class="oldbar" role="img" aria-label="노후·불량 건축물 ${t.old.pol}%, 기준선 60%"><i style="width:${t.old.pol}%"></i><s style="left:60%"></s></div><dl class="facts"><div><dt>노후·불량 건축물</dt><dd>${t.old.pol}%<small>철근콘크리트·철골조 30년, 그 밖의 구조 20년 이상(서울 조례 기준 단순화) · 구역지정 요건 60% 이상</small></dd></div><div><dt>30년 이상 건물</dt><dd>${t.old.p30}%<small>평균 ${t.old.avg}년 된 건물</small></dd></div><div><dt>10년 이하 신축</dt><dd>${fmt(t.old.new10)}동<small>권리산정기준일 뒤 신축이면 입주권 문제 확인</small></dd></div></dl></div>` : ""}
        ${pc ? `<div class="sect"><h3>구역 필지 현황 <small>서울도시공간포털 연속지적 ${fmt(pc.n)}필지 · 합계 ${fmt(pc.ar)}㎡</small></h3><dl class="facts">
          <div><dt>과소필지 (90㎡ 미만)</dt><dd>${pc.sm}%<small>도로·하천 제외 · 재개발 지정 요건 40% 이상</small></dd></div>
          <div><dt>국공유지</dt><dd>${pc.pub}%<small>필지 수 기준 · 많으면 무상양도 협의가 사업성에 영향</small></dd></div>
          <div><dt>도로 필지</dt><dd>${pc.rd}%<small>필지 수 기준</small></dd></div>
          ${pc.jm ? `<div><dt>지목 구성</dt><dd class="tx">${pc.jm.map(([k, v]) => `${esc(k)} ${fmt(v)}`).join(" · ")}</dd></div>` : ""}</dl></div>` : ""}
        ${secN}
        ${salesSecs}
        ${J.length ? `<div class="sect"><h3>최근 전세 <small>연립다세대</small></h3><div id="jList" class="txl"><table class="tx" style="min-width:0"><thead><tr><th scope="col">계약일</th><th scope="col" class="n">준공</th><th scope="col" class="n">임대 면적</th><th scope="col" class="n">보증금</th></tr></thead><tbody>${J.reduce((a, v) => { const k = v.join("|"), l = a[a.length - 1]; if (l && l.k === k) l.n++; else a.push({ k, v, n: 1 }); return a; }, []).slice(0, 20).map(({ v, n }) => `<tr><td>${ymd2(v[0])}${n > 1 ? ` <small class="mut">같은 조건 ${n}건</small>` : ""}</td><td class="n">${v[1] || "–"}</td><td class="n">${v[2]}㎡</td><td class="n"><b>${eok(v[3])}</b></td></tr>`).join("")}</tbody></table></div></div>` : ""}
        <p class="note src">자료: 서울시 부동산 실거래가·전월세가 정보(서울 열린데이터광장, 매매 ${esc(ymd(D.txAsOf?.sale))}·전세 ${esc(ymd(D.txAsOf?.rent))}까지), 정비구역 경계·필지 서울도시공간포털. 구역 경계 안 필지 번호와 맞춘 거래만 셉니다.</p>`;
      if ($("txListN")) moreRows($("txListN"), 5);
      if ($("txListV")) moreRows($("txListV"), 5);
      if ($("txListA")) moreRows($("txListA"), 5);
      if ($("jList")) moreRows($("jList"), 5);
    }

    // 지도 경계 데이터(경계 유무 판정용)
    let GEO_Z = null;
    const geoReady = () => { if (!GEO_Z && D.dv && D.dv.geo) LMX.geo().then((g) => { GEO_Z = g ? g.z : {}; }); };

    // ---------- 정보몽땅 최근 기록(다음 인가 선행 신호) ----------
    const SIG = [[/분양신청/, "관리처분인가가 가까워졌다는 신호(조합원 분양신청)"], [/총회개최/, "총회 개최"], [/인가신청|승인신청/, "다음 인가를 신청함"], [/업체선정/, "업체 선정"], [/공람|설명회/, "주민 공람·설명회"]];
    const evText = ZF.evText;   // 정보몽땅 원문 정리는 ZF 하나(단계 소식 화면과 같은 글)
    function evHTML(r) {
      const ev = r.ev;
      if (!Array.isArray(ev) || !ev.length) return "";
      const rows = ev.slice(0, 6).map(([d, sec, t]) => { const e = evText(r, d, sec, t), s = e.chg ? null : SIG.find(([re]) => re.test(String(t).replace(/\s/g, ""))); return `<li><span class="ev-d mono">${esc(d.replaceAll("-", "."))}</span><span class="ev-t"><b>${esc(sec)}</b> ${esc(e.txt)}${s ? ` <em class="ev-s">${esc(s[1])}</em>` : ""}</span></li>`; }).join("");
      return `<div class="sect evl"><h3>정비사업 정보몽땅 최근 기록 <small>추진경과 · 매일 갱신 · 인가 전 신청·총회가 먼저 올라와요</small></h3><ul>${rows}</ul>${r.cafe ? `<p class="note"><a href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl=${encodeURIComponent(r.cafe)}" target="_blank" rel="noopener">정보몽땅 사업장 원문 보기</a></p>` : ""}</div>`;
    }
    // ---------- 역전세 위험(전세 끼고 사기) ----------
    function rvjHTML(r) {
      const v = D.rvj && D.rvj[r.g];
      const hb = r.tx && r.tx.hd && r.tx.hd.b;
      if (hb === "a" || hb === "i" || /재건축/.test(r.k || "") || r.tag === "mk") return "";   // 연립·다세대 전세 지표라 아파트 기준 구역(재건축 등)에는 붙이지 않는다
      if (!v) return "";
      const lvl = v.down >= 15 || v.chg <= 0 ? "hi" : v.down >= 7 ? "mid" : "lo";
      const T = { hi: "주의", mid: "보통", lo: "낮음" };
      return `<div class="rvj ${lvl}"><div class="rvj-h"><b>역전세 위험 · ${esc(r.g)}</b><span>${T[lvl]}</span></div><p>최근 6개월 연립·다세대 전세 <b>갱신계약 ${fmt(v.n)}건</b> 중 보증금을 낮춘 곳 <b>${v.down}%</b>, 보증금 변화 가운데 값 <b>${v.chg > 0 ? "+" : ""}${v.chg}%</b>.</p><p class="note">전세를 끼고 사면 만기 때 보증금을 돌려줘야 할 수 있어요. ${lvl === "hi" ? "이 구는 보증금을 낮춰 재계약하는 비율이 높아, 갭 금액에 여유 자금을 더 두세요." : "새 세입자가 더 낮은 보증금으로 들어올 경우를 대비해 여유 자금을 두세요."} 출처: 서울시 전월세 신고(종전 보증금).</p></div>`;
    }

    // ---------- 기존 탭에 덧붙이기 ----------
    const _biz = paneBiz, _req = paneReq, _near = paneNear, _money = paneMoney;
    paneMoney = function (r) {
      _money(r);
      if (gapMode() && r.src !== "moa") { const h = rvjHTML(r); if (h) $("pane").insertAdjacentHTML("beforeend", h); }
    };
    paneBiz = function (r) {
      _biz(r);
      const p = $("pane");
      const old = p.querySelector(".note b");
      p.querySelectorAll("p.note").forEach((n) => { if (/^권리산정기준일/.test((n.querySelector("b") || {}).textContent || "")) n.remove(); });
      const lad = p.querySelector(".sect");
      const feed = `<p class="feedl"><a href="feed/gu/${encodeURIComponent(r.g)}.xml" target="_blank" rel="noopener">${esc(r.g)} 정비사업 새 소식 구독(RSS)</a> <span>단계 변경·새 인가가 생기면 RSS 앱으로 받아 볼 수 있어요 · <a href="feed/">전체 구 목록</a></span></p>`;
      const add = `${paceHTML(r)}${evHTML(r)}${feed}${rightsHTML(r)}`;
      if (lad) lad.insertAdjacentHTML("afterend", add); else p.insertAdjacentHTML("afterbegin", add);
      const ev = p.querySelector(".evl"); if (ev) moreRows(ev, 3);
      const facts = p.querySelector("dl.facts");
      const sup = supplyHTML(r);
      if (sup) (facts || p.lastElementChild).insertAdjacentHTML("afterend", sup);
    };
    paneReq = function (r) {
      _req(r);
      const p = $("pane");
      const first = p.querySelector("p.note");
      const h = rightsHTML(r) + addrHTML(r);
      if (first) first.insertAdjacentHTML("afterend", h); else p.insertAdjacentHTML("afterbegin", h);
      geoReady();
      bindAddr(r);
    };
    paneNear = function (r) {
      _near(r);
      const p = $("pane");
      const chk = p.querySelector(".chk3");
      const h = auctionHTML(r) + nearbyHTML(r);
      if (chk) chk.insertAdjacentHTML("beforebegin", h); else p.insertAdjacentHTML("beforeend", h);
      bindAuction();
      const hj = p.querySelector(".hjl"); if (hj) moreRows(hj.parentElement, 3);
      p.querySelectorAll(".nc-go").forEach((b) => (b.onclick = () => { curTab = "money"; select(b.dataset.go, false, false, { scroll: !MQ_SHEET.matches }); }));
    };
    return { chartSVG, paneTx, rights, rightsHTML, pace, geoReady, loadTx, loadNear, near: nearOf, moreRows, geoZ: () => GEO_Z };
  })();
  function paneTx(r) { ZX.geoReady(); ZX.paneTx(r); }
  // 매수가가 없을 때 이유(짧게 · 20자 안팎). 자세한 설명은 실거래·입주 현금 탭에
  function noPriceTxt(r) {
    if (!r) return "매수가 추정 불가";
    const en = r.mk && r.mk.entry, t = r.tx || {};
    if (r.nx === "biz") return "업무·상업 중심 · 입주권 계산 대상 아님";
    if (r.tag === "mk" || r.nx === "mk") return "시장·상가 정비 · 매수가 계산 전";
    // 관리처분(6)·이주·철거(7) 뒤: 거래가에 입주권 프리미엄이 섞여 자동 매수가를 쓰지 않는다(tools/enrich.py가 매수가를 비움) — 한 규칙
    if (r.s >= 7 && r.s < 9) return "이주·철거 후 · 매물가 직접 입력";
    if (r.s >= 6 && r.s < 9) return "관리처분 후 · 매물가 직접 입력";
    if (en && en.src === "villa" && r.k === "재건축") return "단지 거래 없음 · 매물가 직접 입력";
    if (r.k === "재건축" || r.k === "소규모재건축") return t.na ? "단지 매매 2년 2건 미만 · 추정 불가" : "단지 매매 신고 없음 · 추정 불가";
    if (!r.ll) return "위치 미공개 후보지 · 추정 불가";
    return "구축 빌라 매매 부족 · 추정 불가";
  }
  // 공공재개발 후보지·구역도 토지거래허가(실거주 2년) 대상인 경우가 많아 전세 낀 매수에서 뺀다
  {
    const _lp = landPermit;
    landPermit = function (r) {
      const x = _lp(r);
      if (x) return x;
      const pub = (isPublic(r) || /공공재개발|\s공공$|공공\s*재개발|공공\)/.test(r.n) || (r.pg || []).some((p) => /공공재개발/.test(p))) && !/공공임대|장기전세/.test(r.n);
      if (pub && isRedev(r))
        return { t: "토지거래허가 가능성 · 공공재개발", d: "공공재개발 후보지·구역은 토지거래허가구역으로 지정돼 2년 실거주 의무가 붙는 경우가 많아요(2021년 1차 후보지부터). 지정 여부와 기간은 구청에서 확인하세요." };
      return null;
    };
  }
  // 리포트·구역 페이지 생성기(tools/report.py)가 같은 계산 엔진을 쓰도록 여는 읽기 전용 함수
  window.__emrCalc = (ids) => {
    const keep = { fund: P.fund, homes: P.homes, unit: P.unit, basis: P.basis, first: P.first };
    Object.assign(P, { fund: "cash", homes: 0, unit: 84, basis: "total", first: 0 });
    const out = {};
    try {
      for (const id of ids) {
        const r = byId[id];
        if (!r) continue;
        let x = {};
        try { x = invest(r); } catch (e) {}
        const w = buyWindow(r);
        let g = null;
        let gE = false, cE = false;
        try { P.fund = "gap"; g = gapOf(r); gE = gapOk(r, 1e9); } catch (e) {} finally { P.fund = "cash"; }
        try { cE = !estHide(r) && !r.dn && r.s < 9 && !r.cx && r.src !== "moa" && !($("pTrade").checked && restricted(r)) && !rewinBlocked(r); } catch (e) {}
        out[id] = { gapOk: gE, cashOk: cE, gapNow: g && !g.block && !g.na ? g.now : null, gapTotal: g && !g.block && !g.na ? g.total ?? null : null, gapBlock: g ? (g.block ? String(g.block === true ? "block" : g.block) : g.na ? "na" : null) : null, jeonse: g && g.D != null ? g.D : null,
          price: x.price ?? null, priceSrc: x.priceSrc ?? null, need: x.ok ? x.needTotal : null, now: x.needBuy ?? null, p10: r.eta?.p10 ?? null, eMid: r.eta?.eMid ?? null, win: w.cls, winT: w.t, st: r.st ? { n: r.st.n, d: r.st.d } : null, ln: r.ln || [], owners: r.sm?.owners || r.sm?.members || null, stage: stageName(r) };
      }
    } finally { Object.assign(P, keep); }
    return out;
  };
/* 모바일: 리포트를 연 채 나갔다가 다시 열면(새로고침·탭 복원·뒤로가기) 주소의 #구역이 남아 첫 화면 대신 리포트가 뜨던 문제
   → 같은 탭에서 돌아온 경우엔 구역·지도 해시를 지우고 첫 화면부터. 처음 받은 공유 링크(#구역)는 그대로 연다. */
(() => {
  try {
    const h = location.hash.slice(1);
    let back = false;
    try { back = sessionStorage.getItem("emr_seen") === "1"; sessionStorage.setItem("emr_seen", "1"); } catch (e) {}
    const nt = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0] || {}).type;
    if (nt === "reload" || nt === "back_forward") {
      if (h && matchMedia("(max-width:980px)").matches && !/^(join=|membership)/.test(h) && !/^[a-z]+Top$|^(results|planner|map|rankHub|news)$/.test(h)) {
        history.replaceState(null, "", location.pathname + location.search);
        if ("scrollRestoration" in history) history.scrollRestoration = "manual";
        window.scrollTo(0, 0);
      }
    }
  } catch (e) {}
})();
/* 메인 섹션: '펼쳐 보기' 대신 처음 5건을 보여 주고 '더보기' */
initFold = function () {};
const HM = (() => {
  // [박스 선택자, 줄 선택자, PC 개수, 모바일 개수]
  const MOB = () => matchMedia("(max-width:640px)").matches;
  const cfg = [
    ["#cmOut", "tbody > tr, ul > li, ol > li, .cm-row, .card", 4, 3],
    ["#rank", "tbody > tr", 5, 3],
    ["#svOut", "table.gsv-t tbody > tr", 5, 3],
    ["#fvOut", "tbody > tr, ul > li", 5, 3],
    ["#txrOut", "ol.tl-l > li", 10, 10],
    ["#ntcOut", "ul.ntl > li", 12, 6],
    ["#guList", ":scope > li", 99, 6],
    ["#rules .rules-col", ":scope > article", 99, 2],
    [".rd-card ol, .rd-card ul", ":scope > li", 99, 3],
  ];
  // 버튼은 상자마다 하나만 만들어 두고 글자·aria만 바꾼다(포커스 유지). 숨김은 속성 변경이라 관찰에 걸리지 않아 루프가 없다.
  function clamp(box, sel, n, nm) {
    const N = (MOB() ? nm : n) || 5;
    const rows = [...box.querySelectorAll(sel)].filter((x) => !x.closest(".hm-more"));
    const open = !!box.__hmOpen;
    rows.forEach((x, i) => (x.hidden = !open && i >= N));
    let b = box.__hmBtn;
    if (rows.length <= N) { if (b) b.hidden = true; return; }
    if (!b) {
      b = box.__hmBtn = document.createElement("button");
      b.type = "button";
      b.className = "btn secondary sm more-b hm-more";
      b.onclick = () => {
        box.__hmOpen = !box.__hmOpen;
        clamp(box, sel, n, nm);
        if (!box.__hmOpen) { const r = box.getBoundingClientRect(); if (r.top < 0) window.scrollBy(0, r.top - 120); }
      };
    }
    b.hidden = false;
    b.textContent = open ? "접기" : `더 보기 (${rows.length - N}${box.matches("#cmOut,#rank,#svOut,#fvOut,#guList,#cmOut *") ? "곳" : "건"})`;
    b.setAttribute("aria-expanded", String(open));
    const host = /^(TABLE|UL|OL)$/.test(box.tagName) ? box.parentElement : box;
    if (b.parentElement !== host || b.nextSibling) host.appendChild(b);
  }
  function bind(box, sel, n, nm) {
    if (box.__hmOn) return;
    box.__hmOn = 1;
    let t;
    const mo = new MutationObserver((ms) => {
      if (ms.every((m) => (box.__hmBtn && box.__hmBtn.contains(m.target)) || [...m.addedNodes, ...m.removedNodes].every((x) => x === box.__hmBtn))) return;   // 버튼 글자 바뀜은 무시
      box.__hmOpen = 0;
      clearTimeout(t);
      t = setTimeout(() => { clamp(box, sel, n, nm); mo.takeRecords(); }, 30);
    });
    mo.observe(box, { childList: true, subtree: true });
    clamp(box, sel, n, nm);
  }
  function init() {
    const all = () => cfg.forEach(([q, sel, n, nm]) => document.querySelectorAll(q).forEach((box) => bind(box, sel, n, nm)));
    all();
    let tt;
    new MutationObserver(() => { clearTimeout(tt); tt = setTimeout(all, 150); }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
    let w = innerWidth;
    addEventListener("resize", () => { if ((w <= 640) !== (innerWidth <= 640)) cfg.forEach(([q, sel, n, nm]) => document.querySelectorAll(q).forEach((box) => clamp(box, sel, n, nm))); w = innerWidth; });
  }
  return { init };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", HM.init) : setTimeout(HM.init, 0);
/* 로고: 계산기(#planner)가 아니라 맨 위 첫 화면으로 */
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("a.logo");
  if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  if (document.getElementById("report").classList.contains("sheet")) closeSheetNow();
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  window.scrollTo({ top: 0, behavior: "auto" });
}, true);
/* 섹션 이동(탭바·메뉴·다음 단계)도 방문 기록에 남겨, 뒤로가기가 사이트 밖으로 나가지 않고 이전 위치로 돌아오게 */
(() => {
  const SEL = '#tabbar a[data-sec], [data-menu], [data-jump2], .next-steps a[href^="#"]';
  document.addEventListener("click", (e) => {
    if (document.documentElement.classList.contains("simple")) return;   // 단순 화면은 60_simple.js가 기록을 관리
    const a = e.target.closest && e.target.closest(SEL);
    if (!a || e.metaKey || e.ctrlKey) return;
    if (document.getElementById("report").classList.contains("sheet")) return;
    const id = a.dataset.sec || a.dataset.menu || a.dataset.jump2 || (a.getAttribute("href") || "").slice(1);
    if (!id || !document.getElementById(id)) return;
    try {
      history.replaceState({ ...(history.state || {}), emrY: Math.round(scrollY) }, "");
      history.pushState({ emrSec: id }, "", location.pathname + location.search);
    } catch (err) {}
  }, true);
  addEventListener("popstate", (e) => {
    const st = e.state || {};
    if (st.emrY != null) { JUMP_GEN++; requestAnimationFrame(() => window.scrollTo({ top: st.emrY, behavior: "auto" })); }
    else if (st.emrSec && document.getElementById(st.emrSec)) requestAnimationFrame(() => jumpTo(st.emrSec));
  });
})();
/* 리포트 탭: 고른 탭이 가로로 보이게 하고, 시트에서 탭 줄이 고정된 상태면 내용 맨 위로 */
{
  const _st = setTab;
  setTab = function (k) {
    _st(k);
    const rp = document.getElementById("report"), b = rp && rp.querySelector(`[role=tab][data-tab="${k}"]`);
    if (b) { const t = b.parentElement; t.scrollLeft = Math.max(0, b.offsetLeft - (t.clientWidth - b.offsetWidth) / 2); }
    if (rp && rp.classList.contains("sheet")) {
      const tabs = rp.querySelector(".tabs"), pane = document.getElementById("pane");
      if (tabs && pane && tabs.getBoundingClientRect().top <= 60) rp.scrollTop += pane.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom - 8;
    }
  };
}
/* 순위 > 실거래 탭(아실 순위분석 대응) · 소식 > 단계 소식(정보몽땅 추진경과 + 월간 리포트 단계 변경) */
const BD = (() => {
  const ymd = (d) => `${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
  const eok = (man) => (man >= 10000 ? `${(man / 10000).toFixed(man >= 100000 ? 0 : 1)}억` : `${fmt(man)}만`);
  const go = (id) => `<button type="button" class="txr-go" data-txgo="${esc(id)}">${esc(shortName(byId[id].n))}</button>`;
  const okC = (r) => { try { return dotState(r) === "y" ? `<em class="txr-ok">${gapMode() ? "전세 끼고 내 현금 가능" : "내 현금 가능"}</em>` : ""; } catch (e) { return ""; } };
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
  function feed() {
    const L = [], key = new Map();
    NT.items.slice().sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).forEach(([d, id, sec, t, c]) => {
      if (!byId[id] || c === "etc" || !CL[c]) return;
      let ev = { txt: t, chg: false }; try { ev = evT(id, d, sec, t); } catch (e) {}
      const st = NT_STEP[sec], k = id + "|" + st;
      const up = c === "ok" && !!st && !/신청|공람/.test(t) && !ev.chg && !key.has(k);
      const it = { d, id, sec, txt: ev.txt, c: up ? "up" : c, src: "" };
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
    return L.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  }
  // 단계가 오른 줄: 지금 사면 입주까지 현금(목록·리포트와 같은 ZF.cashToMoveIn)
  function money(r) {
    try {
      if (buyWindow(r).cls === "no") return '<span class="nt-m mut">지금 사면 입주권 없음</span>';
      const v = ZF.cashToMoveIn(r, gapMode());
      if (v == null) return `<span class="nt-m mut">${LBL.cashToMoveIn} 계산 불가</span>`;
      return `<span class="nt-m${v <= CASH + 1e-9 ? " ok" : ""}">${LBL.cashToMoveIn} ${ZF.cash(v)}${v <= CASH + 1e-9 ? " · 내 현금으로 됨" : ""}</span>`;
    } catch (e) { return ""; }
  }
  function notice() {
    const out = document.getElementById("ntcOut");
    if (!out || !NT) return;
    const A = feed();
    const L = A.filter((x) => (C === "fav" ? isFav(x.id) : C === "up" ? x.c === "up" : true));
    const ups = new Set(A.filter((x) => x.c === "up").map((x) => x.id)).size, pins = A.filter((x) => isFav(x.id)).length;
    const sum = `<p class="nt-sum"><b>최근 90일 ${fmt(A.length)}건</b> · 단계 오른 곳 ${fmt(ups)}곳${FAV.length ? ` · 내 핀 소식 ${fmt(pins)}건` : ""}</p>`;
    out.innerHTML = L.length
      ? `${sum}<ul class="ntl">${L.slice(0, 80).map((x) => { const r = byId[x.id], fav = isFav(x.id); return `<li class="c-${x.c}${fav ? " fav" : ""}"><span class="nt-d mono">${x.d.slice(2).replaceAll("-", ".")}</span><span class="nt-b">${fav ? `<i class="nt-pin" aria-label="내 핀">${SVG_PIN(true)}</i>` : ""}${go(x.id)}<small>${esc(r.g)} · ${esc(stageName(r))}</small><span class="nt-t"><em class="nt-c">${CL[x.c]}</em><b>${esc(x.sec)}</b> ${esc(x.txt)}${x.src ? ` <a href="${esc(x.src)}" target="_blank" rel="noopener" data-nw="1">기사 ↗<span class="sr-only"> (새 창)</span></a>` : ""}</span>${x.c === "up" ? money(r) : ""}</span></li>`; }).join("")}</ul><p class="t-note">출처: 서울시 정비사업 정보몽땅 사업장별 추진경과·월간 리포트 · ${esc(String(NT.asOf).replaceAll("-", "."))} 기준 · '변경 인가'는 이미 받은 인가 내용을 고친 것이라 단계가 오른 게 아니에요${MO ? ` · 달마다 정리한 목록: <a href="${MO.url}">${moLabel()} 리포트</a>` : ""}</p>`
      : `${sum}<p class="mut nt-e">${C === "fav" ? (FAV.length ? "핀 꽂은 구역의 최근 90일 소식이 없어요." : "구역을 열고 핀을 꽂으면 그 구역 소식만 모아 볼 수 있어요.") : "최근 90일 기록이 없어요."}</p>`;
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
      e.preventDefault(); curTab = "money"; select(b.dataset.txgo, true, false, { scroll: true });
    });
    const once = (id, fn) => {
      const el = document.getElementById(id); if (!el) return;
      if (!window.IntersectionObserver) return fn();
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: "800px 0px" });
      io.observe(el);
    };
    once("txrTop", rank);
    once("ntcTop", () => ntLoad().then((j) => { if (!j) throw 0; NT = j; notice(); }).catch(() => { const o = document.getElementById("ntcOut"); if (o) o.innerHTML = '<p class="mut">소식을 불러오지 못했어요.</p>'; }));
    // 계산기 현금이 바뀌면 '내 현금 가능' 표시 갱신
    {
      const _plan = plan;
      plan = function () { const r = _plan.apply(this, arguments); try { if (document.getElementById("txrOut").innerHTML) rank(); if (NT) notice(); } catch (e) {} return r; };
    }
  }
  return { init };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", BD.init) : setTimeout(BD.init, 0);
/* 서울시 상권분석서비스: 지도 레이어용 로더 + 구역 리포트 '주변 상권·학원가' */
const ZXS = (() => {
  let S = null, P = null;
  const load = () => (S ? Promise.resolve(S) : P || (P = fetch(`data/sang.json?v=${(D.dv && D.dv.sang) || D.upd || ""}`).then((r) => (r.ok ? r.json() : null)).then((j) => (S = j)).catch(() => ((P = null), null))));
  const dist = (a, b, c, d) => { const k = Math.PI / 180, x = (d - b) * k * Math.cos(((a + c) / 2) * k), y = (c - a) * k; return Math.sqrt(x * x + y * y) * 6371000; };
  const KN = { a: "골목상권", d: "발달상권", r: "전통시장", u: "관광특구" };
  function centerOf(r) { return r.ll ? [r.ll[0], r.ll[1]] : null; }
  function html(r, S) {
    const c = centerOf(r); if (!c) return "";
    const near = S.items.map((x) => ({ x, d: dist(c[0], c[1], x[1], x[0]) })).filter((o) => o.d <= 1000).sort((a, b) => a.d - b.d);
    const stores = near.reduce((s, o) => s + o.x[4], 0), acad = near.reduce((s, o) => s + o.x[5], 0);
    const big = near.slice().sort((a, b) => b.x[4] - a.x[4]).slice(0, 3);
    const hub = S.items.filter((x) => x[5] >= 100).map((x) => ({ x, d: dist(c[0], c[1], x[1], x[0]) })).sort((a, b) => a.d - b.d)[0];
    const km = (m) => (m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`);
    return `<div class="sect sang"><h3>주변 상권·학원가 <small>반경 1km · 서울시 상권분석서비스 ${esc(S.q)}</small></h3>
      <dl class="sg-k"><div><dt>상권</dt><dd><b>${fmt(near.length)}</b>곳</dd></div><div><dt>점포</dt><dd><b>${fmt(stores)}</b>개</dd></div><div><dt>학원</dt><dd><b>${fmt(acad)}</b>개</dd></div></dl>
      ${big.length ? `<ul class="sg-l">${big.map((o) => `<li><b>${esc(o.x[2])}</b><span>${KN[o.x[3]] || ""} · ${km(o.d)} · 점포 ${fmt(o.x[4])}${o.x[5] ? ` · 학원 ${fmt(o.x[5])}` : ""}${o.x[6] ? ` · 분기 추정매출 ${fmt(o.x[6], o.x[6] < 10 ? 1 : 0)}억` : ""}</span></li>`).join("")}</ul>` : `<p class="note">반경 1km 안에 서울시가 정한 상권이 없어요(주거 위주 지역).</p>`}
      ${hub ? `<p class="note">가장 가까운 큰 학원가(학원 100곳 이상): <b>${esc(hub.x[2])}</b> ${esc(hub.x[7])} · 직선 ${km(hub.d)} · 학원 ${fmt(hub.x[5])}곳</p>` : ""}
      <p class="note src">학원 = 일반교습·외국어·예술·컴퓨터학원 점포 수(체육 강습 제외) · 거리는 구역 대표 좌표에서 상권 중심까지 직선거리.</p></div>`;
  }
  {
    const _l = paneLoc;
    paneLoc = function (r) {
      _l(r);
      const p = $("pane"), slot = document.createElement("div");
      slot.className = "sang-slot";
      const inf = p.querySelector(".sect.infra");
      if (inf) inf.after(slot); else p.appendChild(slot);
      load().then((S) => { if (S && slot.isConnected) slot.innerHTML = html(r, S); });
    };
  }
  return { load };
})();
/* 토지거래허가 최근 내역(서울부동산정보광장·국토부 K-Geo, 매일 수집해 누적) → 리포트 '규제·요건' 탭 */
const TOH = (() => {
  let T = null, P = null;
  const load = () => (T ? Promise.resolve(T) : P || (P = fetch(`data/toheo.json?v=${(D.dv && D.dv.toheo) || D.upd || ""}`).then((r) => (r.ok ? r.json() : null)).then((j) => (T = j)).catch(() => ((P = null), null))));
  const ymd = (d) => d.replaceAll("-", ".");
  function html(r, T) {
    const z = T.z[r.id], gu = T.gu[r.g];
    const head = `<h3>토지거래허가 최근 내역 <small>서울부동산정보광장(국토부 K-Geo 연계) · ${ymd(T.since)}~${ymd(T.asOf)} · 매일 수집</small></h3>`;
    const guTxt = gu ? `${esc(r.g)} 전체로는 최근 62일 ${fmt(gu[0])}건(주거용 ${fmt(gu[1])}건)이 허가됐어요.` : "";
    if (!z) return `<div class="sect toh">${head}<p class="note">이 기간에 구역 경계 안 필지로 허가된 기록이 없어요. ${guTxt} ${geoHas(r) ? "" : "공식 경계가 없는 구역은 필지를 맞출 수 없어 비어 보일 수 있어요."}</p></div>`;
    const rows = z.r.map(([d, jb, jm, use, res]) => `<li${res !== "허가" ? ' class="no"' : ""}><span class="mono">${ymd(d)}</span><b>${esc(jb)}</b><span>${esc(jm)} · ${esc(use)}${res !== "허가" ? ` · <em>${esc(res)}</em>` : ""}</span></li>`).join("");
    return `<div class="sect toh">${head}<dl class="sg-k"><div><dt>구역 안 허가</dt><dd><b>${fmt(z.n)}</b>건</dd></div><div><dt>최근 30일</dt><dd><b>${fmt(z.n30)}</b>건</dd></div><div><dt>주거용</dt><dd><b>${fmt(z.res)}</b>건</dd></div></dl>
      <ul class="toh-l">${rows}</ul><p class="note">허가 1건 = 접수번호별 대표 지번 1개라 여러 필지를 함께 산 거래도 1건으로 보여요. 주거용 허가를 받으면 2년 실거주 의무가 붙어 전세를 끼고 살 수 없어요. ${guTxt}</p></div>`;
  }
  const geoHas = (r) => { const g = ZX.geoZ(); return !!(g && g[r.id] && !g[r.id].e); };
  {
    const _q = paneReq;
    paneReq = function (r) {
      _q(r);
      const p = $("pane"), slot = document.createElement("div");
      const first = p.querySelector(".sect");
      if (first) first.before(slot); else p.appendChild(slot);
      load().then((T) => { if (T && slot.isConnected) { slot.innerHTML = html(r, T); const l = slot.querySelector(".toh-l"); if (l) ZX.moreRows(l.parentElement, 5); } });
    };
  }
  // 한 구역의 토지거래허가 판정(진단·요약용): 서울 전역 아파트 규칙 → 신통·모아 지정 → 구역 안 실제 허가 기록 → 구 단위 기록 순으로 본다.
  // '지정 없음'이라고 단정하지 않는다(빌라·단독만 서울 전역 규칙에서 빠질 뿐, 개별 지정은 구청 확인).
  function lookup(r, T0) {
    const T1 = T0 || T, lp = landPermit(r);
    if (lp) return { cls: "no", t: lp.t };
    const z = T1 && T1.z && T1.z[r.id], gu = T1 && T1.gu && T1.gu[r.g];
    const zl = z && z.r && z.r[0] ? ` · 최근 ${ymd(z.r[0][0]).slice(2)}` : "";
    if (z && z.res) return { cls: "no", t: `구역 안 주거용 필지 허가 ${fmt(z.res)}건(${ymd(T1.since).slice(2)}~${zl}) · 허가구역 필지가 있어요 · 사면 2년 실거주` };
    if (z && z.n) return { cls: "warn", t: `구역 안 필지 허가 ${fmt(z.n)}건(${ymd(T1.since).slice(2)}~${zl}, 주거용 아님) · 매물 필지 지정 여부 구청 확인` };
    if (r.src === "moa" || /가로|모아/.test(r.k || "")) return { cls: "warn", t: "모아타운은 도로 지목만 지정되는 경우가 많아요 · 빌라·단독은 서울 전역 지정(아파트만)에서 빠져요 · 구청 확인" };
    if (T1 && !z) return { cls: "warn", t: `구역 안 허가 0건(${ymd(T1.since).slice(2)}~${ymd(T1.asOf).slice(2)}) · 빌라·단독은 서울 전역 지정(아파트만)에서 빠져요${gu ? ` · ${r.g} 최근 허가 ${fmt(gu[0])}건` : ""} · 개별 지정은 구청 확인` };
    return { cls: "warn", t: `빌라·단독은 서울 전역 지정(아파트만)에서 빠져요${gu ? ` · ${r.g} 최근 허가 ${fmt(gu[0])}건` : ""} · 개별 지정은 구청 확인` };
  }
  window.ZP_toheo = (r) => lookup(r);
  return { load, lookup, loaded: () => !!T };
})();
/* ===================== 첫 화면 단순화(사용자 피드백) =====================
   메인 = 현금 게이지 + 서울 지도 + "지역 · 필요한 돈" 목록. 글자는 최소로.
   나머지 기능(계산기 세부 조건·출퇴근·순위·고시 등)은 아래 타일을 눌러 하나씩 연다.
   기존 섹션과 계산 엔진은 그대로 두고, 화면 구성만 바꾼다. */
const SIMPLE = (() => {
  // 도구 목록은 여기 한 곳만: 홈 '더 알아보기' 격자와 ⋯ 메뉴 '도구' 묶음을 둘 다 이것으로 만든다("적게, 완벽하게" — 6개)
  // [화면 id, 이름, 아이콘 경로, 아이콘 색, 한 줄 설명]
  const TOOLS_ALL = window.ZP_TOOLS = [
    ["rankHub", "순위", "M4 20h16M7 16V9M12 16V5M17 16v-4", "#1f3a87", "갭·실거래·입지"],
    ["planner", "입주 계산", "M4 4h16v16H4zM8 8h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h4", "#4f46e5", "입주까지 현금·모으면 언제"],
    ["news", "소식", "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4", "#0e7490", "단계 변경·입주 물량"],
    ["commuteTop", "출퇴근", "M7 3h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 10h14M8 20l2-4M16 20l-2-4", "#2f6feb", "회사까지 몇 분 안"],
    ["diagTop", "매물진단", "M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "#16a34a", "이 매물 입주권 나오나"],
    ["favTop", "내 핀", "M12 22c-3.4-4.1-7.2-8.4-7.2-12.6a7.2 7.2 0 0 1 14.4 0c0 4.2-3.8 8.5-7.2 12.6zM12 12a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z", "#d97706", "핀 꽂은 구역 소식"],
  ];
  // 예전 도구 주소(#gapTop 등)는 합친 화면 + 그 탭으로 연다(정적 페이지·공유 링크가 그대로 동작) — [화면, 탭]
  const ALIAS = window.ZP_ALIAS = { gapTop: ["rankHub", "gap"], txrTop: ["rankHub", "txr"], rankTop: ["rankHub", "loc"], ntcTop: ["news", "feed"], newTop: ["news", "feed"], supplyTop: ["news", "supply"], saveTop: ["planner", "save"] };
  // 격자 = 도구 6개 전부(폰 3×2 · PC 한 줄/두 줄), 더보기 없음
  const VIEWS = TOOLS_ALL;
  // ⋯ 메뉴 '도구' 묶음: 전부(shell.html #mpTools는 비워 두고 여기서 채운다)
  { const g = document.getElementById("mpTools"); if (g) g.innerHTML = TOOLS_ALL.map(([id, t, d, c]) => `<a href="#${id}" data-menu="${id}"><i class="mp-ic" aria-hidden="true" style="--ic:${c}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></i><b>${t}</b></a>`).join(""); }
  // 아이콘 격자에는 안 넣지만 메뉴(⋯)·링크로 여는 화면
  const MORE = ["results", "rulesTop", "readsTop", "statsTop"];
  const LINKS = [];
  const IDS = VIEWS.map((v) => v[0]).concat(MORE);
  const known = (id) => IDS.includes(id) || !!ALIAS[id];
  const KN = [[0, 0.5], [28, 2], [58, 5], [88, 10], [100, 15]];
  const toCash = (p) => { for (let i = 1; i < KN.length; i++) if (p <= KN[i][0]) { const [a, x] = KN[i - 1], [b, y] = KN[i]; const v = x + ((p - a) / (b - a)) * (y - x); return v < 2 ? Math.round(v * 10) / 10 : v < 10 ? Math.round(v * 2) / 2 : Math.round(v); } return 15; };
  const toPos = (c) => { c = Math.min(15, Math.max(0.5, c)); for (let i = 1; i < KN.length; i++) if (c <= KN[i][1]) { const [a, x] = KN[i - 1], [b, y] = KN[i]; return a + ((c - x) / (y - x)) * (b - a); } return 100; };
  let POPS = null;   // POP은 앱 본문에서 나중에 만들어지므로 처음 쓸 때 채운다
  // 지도 구별 숫자와 같은 기준(지도 색칠 기준이 '지금 매수'로 바뀌면 목록도 같이)
  const okR = (r) => (POPS || (POPS = new Set(POP.map((x) => x.id)))).has(r.id) && (effBasis() === "now" ? affOk(r, "now") : affOk(r));
  // 홈 '살 수 있는 곳' 곳 수 — 다른 화면도 이 함수 하나로 센다(cash 생략 시 지금 게이지 금액)
  const countAt = (cash) => {
    if (cash == null || !isFinite(cash)) return R.filter(okR).length;
    const save = CASH;
    try { CASH = +cash; return R.filter(okR).length; } finally { CASH = save; }
  };
  window.ZP_count = countAt;
  // 목록 정렬: 맞춤(내 돈에 가장 가까운 곳 먼저) · 적은 돈 · 입주 빠른
  const SORTS = [["fit", "맞춤순"], ["low", "적은 돈순"], ["eta", "입주 빠른순"]];
  let sortK = "fit";
  try { const s0 = localStorage.getItem("emr.sort"); if (SORTS.some((x) => x[0] === s0)) sortK = s0; } catch (e) {}
  // 처음 보이는 줄 수: PC는 옆 지도 높이(창 높이 − 79, 최대 902)를 채울 만큼(줄 75px · 제목·칩 두 줄·더보기 144px), 폰은 6줄
  const SHOW0 = () => { try { return matchMedia("(min-width:981px)").matches ? Math.max(6, Math.min(10, Math.floor((Math.min(innerHeight - 79, 902) - 144) / 75))) : 6; } catch (e) { return 6; } };
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
  const bbMove = () => { const b = bbGet(), was = bbCan; bbCan = !!b; if (bbF) { if (String(b) !== String(bbF)) { bbF = b; render(); } } else if (was !== bbCan) render(); };
  addEventListener("zp:mapmove", bbMove);
  // PC: 페이지를 내려 지도 칸이 머리 밑에 붙으면 보이는 부분이 바뀐다
  { let t = 0; addEventListener("scroll", () => { if (!bbF) return; clearTimeout(t); t = setTimeout(() => { if (matchMedia("(min-width:981px)").matches) bbMove(); }, 180); }, { passive: true }); }
  const inBB = (r) => !bbF || (r.ll && r.ll[1] >= bbF[0] && r.ll[1] <= bbF[2] && r.ll[0] >= bbF[1] && r.ll[0] <= bbF[3]);
  let listGu = "", gu = "", kind = "", shown = SHOW0(), timer = 0, keepY = null;
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  // 1억 아래는 소수 둘째 자리까지(9,515만 → 0.95억, '1억'으로 올려 보이지 않게)
  const eokS = ZF.cash;   // 1억 아래는 소수 둘째 자리까지(0.95억) — 지도·핀·리포트와 같은 ZF 꼴
  const dongOf = (r) => { const m = /^(?:서울(?:특별)?시\s*)?(?:[가-힣]+구\s+)?([가-힣]+?(?:\d+(?:·\d+)*)?(?:동\d+가|로\d+가|\d+가|동|로|가))(?=[\s\d(산]|$)/.exec(r.j || r.bj || ""); return m ? m[1] : r.dg || ""; };
  const KIND = (r) => (/재건축/.test(r.k) ? "rebuild" : /가로|소규모/.test(r.k) ? "small" : "redev");
  function needOf(r) {
    if (gapMode()) { const g = gapOf(r); return { now: g.now, total: g.total }; }
    const x = investC(r);
    return { now: x.needBuy, total: x.ok ? x.needTotal : null };
  }
  // '입주 빠른순'일 때 줄마다 예상 입주(계산용 추정) — 정렬 기준이 눈에 보이게
  const etaTag = (r) => { try { const t = etaShow(r); return /\d/.test(t) ? ` · <em class="s-tag eta">입주 ${esc(t)}</em>` : ` · <em>입주 ${esc(t)}</em>`; } catch (e) { return ""; } };
  const NA_WHY = "입주 시점·신축 시세 자료가 부족해요";
  const NA_L = "입주 비용 자료 부족";
  function rows() {
    const nowK = gapMode() || effBasis() !== "total";
    const etaT = (r) => { try { const p = projection(r); return p && p.eMid && !p.past ? +p.eMid : Infinity; } catch (e) { return Infinity; } };
    const L = R.filter((r) => okR(r) && !r.lc && (!gu || r.g === gu) && (!kind || KIND(r) === kind) && (gu || inBB(r)))
      .map((r) => { const n = needOf(r), m = (nowK ? n.now : n.total) ?? 99; return { r, n, m, early: r.s <= 1 || r.eta?.p10 == null, eta: sortK === "eta" ? etaT(r) : 0 }; });
    // '입주 계산 불가'(입주까지 금액 없음)는 어떤 정렬·유형 칩이든 맨 아래로
    return L.sort((a, b) => (a.n.total == null) - (b.n.total == null)
      || (sortK === "fit" ? Math.abs(CASH - a.m) - Math.abs(CASH - b.m) : sortK === "eta" ? (a.eta === b.eta ? 0 : a.eta < b.eta ? -1 : 1) : Math.round(a.m * 10) - Math.round(b.m * 10))
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
    const nm0 = kind ? `${gu ? `${esc(gu)} ` : ""}${KNAME[kind] || "이 유형"}` : gu ? esc(gu) : bbF ? "이 지도 범위" : "서울";
    const lc = nm0.charCodeAt(nm0.length - 1), nm = nm0 + (lc >= 0xac00 && lc <= 0xd7a3 && (lc - 0xac00) % 28 ? "은" : "는");
    const up = isFinite(lo) ? Math.max(0.1, Math.ceil(lo * 10) / 10) : null;
    const msg = up != null ? `${nm} 최소 <b>${eokS(up)}</b>부터 살 수 있어요` : `${nm} ${gapMode() ? "전세 끼고" : "지금 방식으로"} 살 수 있는 곳이 없어요`;
    const wide = kind ? `<button type="button" class="btn secondary" id="sKindAll">전체 유형 보기</button>` : gu ? `<button type="button" class="btn secondary" id="sGuAll">서울 전체</button>` : bbF ? `<button type="button" class="btn secondary" id="sBbAll">서울 전체</button>` : "";
    return `${msg}<span class="s-eact">${up != null ? `<button type="button" class="btn primary" id="sKindUp" data-v="${up}">${eokS(up)}으로 올려 보기</button>` : ""}${wide}</span>`;
  }
  // 아래 탭바: 지금 보는 화면에 맞는 탭을 켠다
  function navMark(k) {
    document.querySelectorAll("#sNav button").forEach((x) => { if (x.dataset.nav === k) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); });
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
    if (!hero) {
      hero = document.createElement("div");
      hero.className = "s-hero"; hero.id = "sHero";
      hero.innerHTML = `
      <button type="button" class="s-search" id="sSearch"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>구역·동·지번·역 검색</button>
      <div class="s-gauge">
        <div class="s-ghead"><h1 class="s-h1">내 돈으로 살 수 있는 <em>서울 재개발</em></h1>
          <div class="s-mode" role="group" aria-label="사는 방식"><button type="button" data-f="gap">${LBL.gap}</button><button type="button" data-f="cash">${LBL.loan}</button></div><button type="button" class="s-asm" id="sAsm" hidden aria-haspopup="dialog"></button></div>
        <div class="s-gmain">
          <label for="sCash" class="s-cash"><small>내 현금</small><b id="sCashV">1억</b></label>
          <span class="s-arrow" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
          <p class="s-count" id="sCount" aria-live="polite"><small id="sNL">살 수 있는 곳</small><b><span id="sN">0</span><i>곳</i></b></p>
        </div>
        <input type="range" id="sCash" min="0" max="100" step="0.1" value="8.33" aria-describedby="sCount" aria-label="가진 현금(억)">
        <div class="s-ticks" aria-hidden="true"><span>0.5억</span><span>2</span><span>5</span><span>10</span><span>15</span></div>
      </div>`;
      map.insertBefore(hero, map.firstChild);
    }
    if (!list) {
      list = document.createElement("div");
      list.className = "s-list-w"; list.id = "sListW";
      list.innerHTML = `<div class="s-lh"><div><h2 id="sLT">살 수 있는 곳</h2><p class="s-lsub"><span id="sLS"></span><label class="s-sort"><span class="sr-only">정렬</span><select id="sSort">${SORTS.map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label></p></div><div class="s-flt" role="group" aria-label="유형"><button type="button" data-k="" aria-pressed="true">전체</button><button type="button" data-k="redev" aria-pressed="false">재개발</button><button type="button" data-k="rebuild" aria-pressed="false">재건축</button><button type="button" data-k="small" aria-pressed="false">가로·소규모</button></div></div>
      <p class="s-gu" id="sGu" hidden></p><ol class="s-list" id="sList"></ol><button type="button" class="btn secondary s-more" id="sMore" hidden></button>`;
    }
    try { $("sSort").value = sortK; } catch (e) {}
    if (!right) {
      right = document.createElement("div");
      right.className = "s-right"; right.id = "sRight";
      right.innerHTML = `<button type="button" class="s-tolist" id="sToList">← 살 수 있는 곳 목록</button>`;
      main.appendChild(right); right.appendChild($("report"));
    }
    const place = () => { if (matchMedia("(min-width:981px)").matches) { if (list.nextElementSibling !== $("report")) right.insertBefore(list, $("report")); } else if (main.nextElementSibling !== list) main.after(list); };
    place(); matchMedia("(min-width:981px)").addEventListener("change", place);
    $("sToList").onclick = () => document.documentElement.classList.remove("s-rep");
    // 스크롤해 지도를 볼 때 게이지가 머리 아래에 작게 붙어 있도록(움직이면 지도가 바로 바뀌는 걸 보며 조절)
    const g = map.querySelector(".s-gauge");
    // 넓은 PC: 게이지 오른쪽 칸 '이 돈이면'(가장 싼 3곳 · 입주까지 현금 범위). 폭이 좁으면 CSS로 숨김
    let sum = $("sSum"); if (!sum) { sum = document.createElement("div"); sum.className = "s-sum"; sum.id = "sSum"; g.appendChild(sum); }
    sum.addEventListener("click", (e) => { const a = e.target.closest("[data-id]"); if (!a) return; curTab = "money"; keepY = scrollY; select(a.dataset.id, false, false, { scroll: !MQ_SHEET.matches }); });
    if (g.parentNode === hero) { const sen = document.createElement("i"); hero.after(g); sen.className = "s-sen"; g.before(sen); }
    document.documentElement.style.setProperty("--hdr-h", (HDR() || 60) + "px");
    // 머리 높이가 바뀌면(화면 회전·검색 열기) 붙는 막대 위치도 같이
    try { new ResizeObserver(() => { const h = $("hdr").offsetHeight; if (h) { try { hdrH = h; } catch (e) {} document.documentElement.style.setProperty("--hdr-h", h + "px"); } }).observe($("hdr")); } catch (e) {}
    // 큰 게이지가 화면 위로 지나가면, 지도·목록을 보는 동안만 머리 아래에 한 줄짜리 게이지를 띄운다(흐름 높이는 그대로)
    // 랜드마크 밖에 떠 있는 막대라 aside로(화면 읽기 '영역' 목록에 '내 현금 요약')
    const mini = document.createElement("aside");
    mini.className = "s-mini"; mini.id = "sMini"; mini.hidden = true; mini.setAttribute("aria-label", "내 현금 요약");
    mini.innerHTML = `<b id="sMiniV">1억</b><input type="range" id="sMiniR" min="0" max="100" step="0.1" value="8.33" aria-label="가진 현금(억)"><span><i id="sMiniM">전세</i> <b id="sMiniN">0</b>곳</span><div class="s-mode s-mm" role="group" aria-label="사는 방식"><button type="button" data-f="gap">전세 끼고</button><button type="button" data-f="cash">대출 끼고</button></div>`;
    document.body.appendChild(mini);
    // 전체 지도 위 막대에서도 전세 끼고/대출 끼고 전환(본 버튼을 대신 누른다 → 상태·목록·지도 모두 같은 길)
    mini.querySelector(".s-mm").addEventListener("click", (e) => { const b = e.target.closest("button[data-f]"); if (!b) return; const o = map.querySelector(`.s-mode button[data-f="${b.dataset.f}"]`); if (o) o.click(); });
    const mr = mini.querySelector("#sMiniR");
    mr.addEventListener("input", () => { $("sCash").value = mr.value; label(toCash(+mr.value)); live(toCash(+mr.value)); });
    mr.addEventListener("change", () => { clearTimeout(timer); clearTimeout(idleT); setCash(toCash(+mr.value), true); });
    let gaugeOut = false, areaIn = true;
    const sync = () => { if (document.documentElement.classList.contains("s-full")) { mini.hidden = false; return; } mini.hidden = !(gaugeOut && areaIn && !document.documentElement.classList.contains("s-view")) || !matchMedia("(max-width:980px)").matches; };
    if (window.IntersectionObserver) {
      new IntersectionObserver((es) => es.forEach((x) => { gaugeOut = !x.isIntersecting && x.boundingClientRect.top < (x.rootBounds ? x.rootBounds.top : 0) + 1; sync(); }), { rootMargin: `-${(HDR() || 56)}px 0px 0px 0px` }).observe(g);
      new IntersectionObserver((es) => es.forEach((x) => { areaIn = x.isIntersecting; sync(); }), { rootMargin: `-${(HDR() || 56) + 60}px 0px -40% 0px` }).observe(list);
      new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { areaIn = true; sync(); } }), { rootMargin: `-${(HDR() || 56) + 60}px 0px 0px 0px` }).observe(map.querySelector(".main"));
    }
    const tiles = document.createElement("section");
    tiles.className = "sec s-tiles"; tiles.id = "sTiles"; tiles.setAttribute("aria-labelledby", "sTT");
    const ic = (d, c) => `<i aria-hidden="true" style="--ic:${c}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></i>`;
    const LSUB = { "guide/rebuild-30y": "30년 넘은 아파트 1,077단지", "report/": "매달 단계 변경 정리" };
    tiles.innerHTML = `<h2 id="sTT">더 알아보기</h2><div class="s-tg">${VIEWS.map(([id, t, d, c, sub]) => `<a href="#${id}" class="s-t" data-view="${id}">${ic(d, c)}<span class="s-tx"><b>${t}</b><small>${sub || ""}</small></span></a>`).join("")}${LINKS.map(([u, t, d, c]) => `<a href="${u}" class="s-t">${ic(d, c)}<span class="s-tx"><b>${t}</b><small>${LSUB[u] || ""}</small></span></a>`).join("")}</div>`;
    map.after(tiles);
    hero.insertBefore(hero.querySelector('#sSearch'), hero.firstChild);
    // 모바일 아래 탭바(앱처럼)
    const nav = document.createElement("nav");
    nav.className = "s-nav"; nav.id = "sNav"; nav.setAttribute("aria-label", "주요 메뉴");
    nav.innerHTML = [["home", "홈", "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"], ["map", "지도", "M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"], ["search", "검색", "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5"], ["fav", "찜", "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"], ["more", "더보기", "M4 6h16M4 12h16M4 18h16"]]
      .map(([k, t, d]) => `<button type="button" data-nav="${k}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg><span>${t}</span></button>`).join("");
    document.body.appendChild(nav);
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
    nav.querySelector('[data-nav="home"]').setAttribute("aria-current", "page");
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("[data-nav]"); if (!b) return;
      const k = b.dataset.nav, wasFull = document.documentElement.classList.contains("s-full");
      nav.querySelectorAll("button").forEach((x) => x.removeAttribute("aria-current"));
      if (k !== "more") b.setAttribute("aria-current", "page");
      if (k !== "map") fullMap(false);
      // 전체 지도에서 '검색': 지도를 닫는 뒤로 가기(popstate)가 끝난 뒤에 검색을 연다 — 먼저 열면 popstate가 검색을 다시 닫았다(두 번 눌러야 했음)
      if (k === "search" && wasFull) { let done = false; const go = () => { if (done) return; done = true; removeEventListener("popstate", pop); search(); }; const pop = () => setTimeout(go, 30); addEventListener("popstate", pop); setTimeout(go, 450); return; }
      if (k === "home") { close(); if ($("report").classList.contains("sheet")) closeSheetNow(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (k === "map") { const v = history.state && history.state.sView; close(); if (v) setTimeout(() => fullMap(true), 120); else fullMap(true); }
      else if (k === "search") search();
      else if (k === "fav") open("favTop");
      else if (k === "more") setTimeout(() => $("menuBtn").click(), 0);
    });
    $("sSearch").onclick = search;
    // 아래 탭 '검색': 검색이 열려 있는 동안만 켜 두고, 닫히면 보던 화면(전체 지도·홈) 탭으로
    try { let was = false; new MutationObserver(() => { const on = $("hdr").classList.contains("searching"); if (on === was) return; was = on; if (on) navMark("search"); else if (nav.querySelector('[data-nav="search"][aria-current]')) navMark(document.documentElement.classList.contains("s-full") ? "map" : "home"); }).observe($("hdr"), { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    // 각 기능 화면 위에 '지도로' 버튼
    IDS.forEach((id) => {
      const s = $(id); if (!s || s.querySelector(".s-back")) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "s-back"; b.innerHTML = "← 돌아가기";
      b.onclick = () => close(true);
      s.insertBefore(b, s.firstChild);
    });
    // 이벤트
    const sl = $("sCash");
    sl.addEventListener("input", () => { label(toCash(+sl.value)); live(toCash(+sl.value)); });
    sl.addEventListener("pointerdown", () => { dragging = true; });
    // 키보드: 2억 아래는 0.1억, 5억 아래는 0.25억, 그 위는 0.5억씩
    const key = (e) => {
      const c = +$("pCash").value || 1, st = c < 2 ? 0.1 : c < 5 ? 0.25 : 0.5;
      const nx = { ArrowRight: c + st, ArrowUp: c + st, ArrowLeft: c - st, ArrowDown: c - st, PageUp: c + 1, PageDown: c - 1, Home: 0.5, End: 15 }[e.key];
      if (nx == null) return;
      e.preventDefault();
      const v = Math.min(15, Math.max(0.5, Math.round(nx * 100) / 100));
      label(v); clearTimeout(idleT); setCash(v, true);
    };
    sl.addEventListener("keydown", key);
    $("sMiniR") && $("sMiniR").addEventListener("keydown", key);
    const up = () => { if (!dragging) return; dragging = false; clearTimeout(idleT); idleT = setTimeout(() => setCash(toCash(+sl.value), true), 30); };
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    sl.addEventListener("change", () => { clearTimeout(timer); clearTimeout(idleT); setCash(toCash(+sl.value), true); });
    map.querySelector(".s-mode").addEventListener("click", (e) => { const b = e.target.closest("button[data-f]"); if (!b) return; if (b.dataset.f === "cash") { P.basis = "now"; try { setSeg("pBasis", "now"); } catch (er) {} } setFund(b.dataset.f); setTimeout(() => { try { LMX.fitAff(true); } catch (er) {} }, 60); });
    list.querySelector(".s-flt").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      kind = b.dataset.k; shown = SHOW0();
      $$(".s-flt button", list).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
      try { window.dispatchEvent(new CustomEvent("zp:filter", { detail: { kind } })); } catch (er) {}   // 지도(10_lmap.js)도 같은 유형만
    });
    $("sMore").onclick = () => { shown += 10; render(); };
    $("sSort").addEventListener("change", (e) => { sortK = e.target.value; shown = SHOW0(); try { localStorage.setItem("emr.sort", sortK); } catch (er) {} render(); });
    $("sAsm").onclick = (e) => asm(e.currentTarget);
    $("sList").addEventListener("click", (e) => {
      const w = e.target.closest("[data-why]"); if (w) { e.preventDefault(); e.stopPropagation(); why(w.dataset.why, w); return; }
      const a = e.target.closest("[data-id]"); if (!a) return;
      e.preventDefault(); curTab = "money"; keepY = scrollY; select(a.dataset.id, false, false, { scroll: !MQ_SHEET.matches });
    });
    tiles.addEventListener("click", (e) => { const a = e.target.closest("[data-view]"); if (!a) return; e.preventDefault(); open(a.dataset.view); });
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
  function label(v, real) {
    const t = real != null && real > 15 ? "15억+" : `${String(real != null ? Math.round(real * 100) / 100 : v).replace(/\.0$/, "")}억`;
    const m = t.match(/^([\d.]+)(억\+?)$/) || [, t, ""];
    $("sCashV").innerHTML = `${m[1]}<small>${m[2].replace("+", "")}${/\+/.test(t) ? "+" : ""}</small>`;
    const pct = toPos(v);
    if ($("sMiniV")) { $("sMiniV").textContent = t; if (!dragging || document.activeElement !== $("sMiniR")) $("sMiniR").value = pct; $("sMiniR").style.setProperty("--p", pct + "%"); }
    if (!dragging || document.activeElement !== $("sCash")) { if (Math.abs(+$("sCash").value - pct) > 0.6) $("sCash").value = pct; }
    $("sCash").style.setProperty("--p", pct + "%");
    $("sCash").setAttribute("aria-valuetext", t);
    if ($("sMiniR")) $("sMiniR").setAttribute("aria-valuetext", t);
  }
  // 끄는 동안에도 지도·숫자가 따라오게(계산은 약 30ms라 프레임마다 한 번까지만)
  // 끄는 동안: 무거운 전체 계산 대신 '필요한 돈 ≤ 현금' 판정만 다시 해 숫자·목록·구별 말풍선을 매 프레임 갱신.
  // 손을 떼거나 잠깐 멈추면 전체 계산(지도 색·구 통계)을 한 번 돌린다.
  let liveT = 0, liveV = null, idleT = 0, bubK = "", bubT = 0, dragging = false;
  function live(v) {
    liveV = Math.round(v * 10) / 10;
    if (!liveT) liveT = requestAnimationFrame(() => {
      liveT = 0;
      try {
        $("pCash").value = String(liveV); CASH = liveV;
        render();
        if (mapView === "seoul") {
          const o = {}; R.forEach((r) => { if (okR(r)) o[r.g] = (o[r.g] || 0) + 1; });
          const k = JSON.stringify(o), now = performance.now();
          if (k !== bubK && now - bubT > 90) { bubK = k; bubT = now; LMX.counts(o); }
        }
      } catch (e) {}
    });
    clearTimeout(idleT); if (!dragging) idleT = setTimeout(() => setCash(liveV, true), 220);
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
    try { LMX.fitAff(true); } catch (e) {}
  }
  // ---------- 목록 줄 보조: 최근 2년 실거래 흐름(작은 선) ----------
  // txs.json[id] = [["26Q2", 값], …] 최근 8분기(build.py가 tx.json에서 뽑은 경량본, ~100KB) — 처음 그린 뒤 한 번만 늦게 불러와 다시 그린다.
  // 큰 tx.json(1.8MB)은 구역 리포트·신고가 층을 열 때만 ZX.loadTx로 받는다.
  let TX = null, txAsk = false;
  const SP = new Map();
  const qIdx = (q) => { const m = /^(\d\d)Q([1-4])$/.exec(q || ""); return m ? +m[1] * 4 + +m[2] - 1 : null; };
  const Q_NOW = (() => { const d = new Date(); return (d.getFullYear() % 100) * 4 + Math.floor(d.getMonth() / 3); })();
  function spark(id) {
    if (!TX) return "";
    if (!fitSp.on) { fitSp.on = 1; addEventListener("resize", () => fitSp()); }
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
        const tr = chg != null && Math.abs(chg) >= 3 ? `<i class="${chg > 0 ? "up" : "dn"}">${chg > 0 ? "▲" : "▼"}${Math.round(Math.abs(chg))}%</i>` : "";
        out = `<span class="s-sp" title="최근 2년 실거래 흐름${tr ? ` · 1년 ${chg > 0 ? "+" : "−"}${Math.round(Math.abs(chg))}%` : ""}"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${xy.map((p) => p.join(",")).join(" ")}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${ex}" cy="${ey}" r="1.9" fill="currentColor"/></svg>${tr}</span>`;
      }
    } catch (e) { out = ""; }
    SP.set(id, out);
    return out;
  }
  function askTx() {
    if (txAsk) return;
    txAsk = true;
    const v = (D.dv && (D.dv.txs || D.dv.tx)) || D.asOf;
    const go = () => { try { fetch(`data/txs.json?v=${v}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && typeof d === "object" && Object.keys(d).length) { TX = d; SP.clear(); render(); } }).catch(() => {}); } catch (e) {} };
    (window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 2500 }) : (f) => setTimeout(f, 900))(go);
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
    whyShow(btn, `<div class="s-wh"><b id="sWhyT">대출 가정</b><span>지금 규제 기준 추정</span><button type="button" data-x aria-label="닫기">×</button></div><ul>${li("담보인정(LTV)", `${Math.round(ltvBuy() * 100)}%`)}${li("담보 기준", "아파트 시세 · 빌라 감정가")}${li("한도(집값 구간)", "15억↓ 6억 · 25억↓ 4억")}${li("DSR 40%", inc != null && inc > 0 ? `연소득 ${fmt(inc)}만원` : "소득 넣으면 적용")}${li("금리", `${rate}% (+3%p 스트레스)`)}</ul><p>${P.homes === 0 ? (P.first ? "무주택 생애최초 기준" : "무주택 기준") : P.homes === 1 ? "1주택 기준" : "다주택은 대출 없음으로 계산"} · 실제 한도는 은행 심사로 달라져요</p><button type="button" class="s-wgo" data-open="planner">소득·조건 바꾸기 →</button>`);
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
    let rowsH = "", tail = "";
    // 매수가 바로 밑에 표본 한 줄(어떤 거래 몇 건의 가운데 값인지)
    const en = (r.mk || {}).entry || {}, ps = x.priceSrc;
    const src = ps === "user" && !est ? "직접 넣은 값" : esc(ZF.smpTxt(r, x));   // 리포트·/z/와 같은 표본 한 문장
    const srcL = src ? `<li class="s-wbase">${src}</li>` : "";
    if (gap) {
      const g = gapOf(r);
      if (g.na) rowsH = `<li class="s-wna">매수가 자료가 아직 없어요</li>`;
      else {
        rowsH = ln("", `매수가${est ? " <small>(추정)</small>" : ""}`, M(x.price)) + srcL + ln("−", `전세${g.userJ ? "" : ` <small>(${Math.round(g.jr)}%)</small>`}`, M(g.D)) + ln("+", "세금", M(x.tax)) + ln("=", "지금 필요한 돈", sum3(x.price, g.D, x.tax), "s-wsum");
        if (g.total != null) tail = `${LBL.cashToMoveIn} ${eokS(g.total)} · 이주비·분담금 포함, 잔금대출 제외`;
        else tail = `${LBL.cashToMoveIn}은 계산 못 함: 입주 시점·신축 시세 자료 부족`;
      }
    } else if (x.price == null) rowsH = `<li class="s-wna">매수가 자료가 아직 없어요</li>`;
    else {
      rowsH = ln("", `매수가${est ? " <small>(추정)</small>" : ""}`, M(x.price)) + srcL + ln("−", "대출", M(x.loanCap)) + `<li class="s-wbase">${loanBasis(r, x, wS, M)}</li>` + ln("+", "세금", M(x.tax)) + ln("=", "지금 필요한 돈", sum3(x.price, x.loanCap, x.tax), "s-wsum");
      if (x.ok && x.needTotal != null) tail = `${LBL.cashToMoveIn} ${eokS(x.needTotal)} · 분담금·이자 포함, 잔금대출 제외`;
      else tail = `${LBL.cashToMoveIn}은 계산 못 함: 입주 시점·신축 시세 자료 부족`;
    }
    whyShow(btn, `<div class="s-wh"><b id="sWhyT">왜 이 금액?</b><span>${esc(shortName(r.n))}</span><button type="button" data-x aria-label="닫기">×</button></div><ul>${rowsH}</ul><p>${tail ? `${tail} · ` : ""}공개 자료로 낸 추정치예요</p><button type="button" class="s-wgo" data-go="${r.id}">계산 근거 자세히 →</button>`);
  }
  // ---------- 첫 방문 안내 한 번: 게이지를 끌어 보라고 ----------
  function coach() {
    try { if (localStorage.getItem("emr.coach1")) return; } catch (e) { return; }
    const g = document.querySelector(".s-gauge"), sl = $("sCash"); if (!g || !sl || g.querySelector(".s-coach")) return;
    const t = document.createElement("div"); t.className = "s-coach"; t.setAttribute("role", "status"); t.textContent = "끌어서 내 현금을 맞춰 보세요";
    // 손잡이 옆(트랙 높이)에 띄워 눈금·숫자를 가리지 않는다. 손잡이가 오른쪽 절반이면 왼쪽에
    // 자리는 레이아웃이 끝난 뒤(rAF)에 잰다 — 도구 화면에서 돌아올 때처럼 막대가 아직 0폭이면 숨겨 두고 다음 크기 변화 때 다시
    const place = () => {
      const gr = g.getBoundingClientRect(), sr = sl.getBoundingClientRect();
      t.classList.toggle("off", !sr.width || !gr.width);
      if (!sr.width || !gr.width) return;
      const w = t.offsetWidth, h = t.offsetHeight;
      const x = sr.left - gr.left + 12 + ((sr.width - 24) * (parseFloat(sl.style.getPropertyValue("--p")) || 8)) / 100;
      const right = x < gr.width / 2, L = right ? x + 22 : x - 22 - w;
      t.classList.toggle("l", !right);
      t.style.top = Math.round(sr.top - gr.top + sr.height / 2 - h / 2) + "px"; t.style.left = Math.round(Math.max(4, Math.min(gr.width - w - 4, L))) + "px";
    };
    let pf = 0; const later = () => { cancelAnimationFrame(pf); pf = requestAnimationFrame(() => requestAnimationFrame(place)); };
    let ro = null; try { ro = new ResizeObserver(later); ro.observe(g); ro.observe(sl); } catch (e) {}
    g.appendChild(t); later(); addEventListener("resize", later); addEventListener("hashchange", later); addEventListener("popstate", later);
    const ev = ["pointerdown", "keydown", "wheel", "touchstart"];
    const done = () => { t.remove(); cancelAnimationFrame(pf); try { ro && ro.disconnect(); } catch (e) {} removeEventListener("resize", later); removeEventListener("hashchange", later); removeEventListener("popstate", later); ev.forEach((k) => removeEventListener(k, done, true)); [sl, $("sMiniR")].forEach((x) => x && x.removeEventListener("input", done)); try { localStorage.setItem("emr.coach1", "1"); } catch (e) {} };
    ev.forEach((k) => addEventListener(k, done, { capture: true, passive: true }));
    [sl, $("sMiniR")].forEach((x) => x && x.addEventListener("input", done));
  }
  // ---------- 목록 ----------
  let capC = ["", 0];
  function render() {
    if (!$("sList")) return;
    const gap = gapMode();
    const v = +$("pCash").value || 1;
    label(Math.min(15, Math.max(0.5, v)), v);
    $$(".s-mode button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.f === "gap") === gap)));
    gu = mapView === "gu" && mapGu && mapGu === listGu ? mapGu : "";   // 구역을 열며 자동으로 들어간 구는 목록을 거르지 않는다
    const L = rows();
    const all = R.filter(okR).length;
    $("sN").textContent = fmt(all);   // 굴러가는 숫자 대신 바로(목록 곳 수와 어긋나 보이지 않게)
    const ab = $("sAsm"); if (ab) { ab.hidden = gap; if (!gap) { const t = asmText(); ab.innerHTML = `${t}<i aria-hidden="true">?</i>`; ab.setAttribute("aria-label", `대출 가정: ${t} · 설명 보기`); } }
    try { if (!dragging) { const o = {}; R.forEach((r) => { if (okR(r)) o[r.g] = (o[r.g] || 0) + 1; }); LMX.counts(o); } } catch (e) {}
    // 한 줄 막대도 목록과 같은 거르기(구·지도 범위·유형)를 그대로: 숫자 = 목록 곳 수
    if ($("sMiniN")) {
      const area = gu || (bbF ? "지도 범위" : ""), kn = kind ? ({ redev: "재개발", rebuild: "재건축", small: area ? "가로" : "가로·소규모" })[kind] : "";
      $("sMiniN").textContent = fmt(area || kind ? L.length : all);
      $("sMiniM").textContent = area && kn ? `${bbF && !gu ? "범위" : area}·${kn}` : area || kn || (gap ? "전세 끼고" : "대출 끼고");
    }
    // 전세 끼고는 전세 시세가 있는 구역만 셀 수 있어 금액을 올려도 상한이 있다 → 그 상한을 같이 보여 준다
    // 대출 끼고도 분모를 같이(전세 끼고와 같은 꼴): 15억까지 올렸을 때 셀 수 있는 곳
    const capK = `${gap}|${effBasis()}`;
    if (!dragging || capK !== capC[0]) capC = [capK, countAt(999)];   // 금액과 무관 → 끄는 동안엔 다시 세지 않는다
    const cap = capC[1];
    $("sNL").textContent = gap ? (cap ? `전세 시세 있는 ${fmt(cap)}곳 중` : "전세 끼고 살 수 있는 곳") : cap ? `${effBasis() === "total" ? "입주까지 계산되는" : "매수가 계산되는"} ${fmt(cap)}곳 중` : effBasis() === "total" ? "입주까지 되는 곳" : "대출 끼고 살 수 있는 곳";
    $("sLT").textContent = gu ? `${gu} · ${fmt(L.length)}곳` : `살 수 있는 곳 · ${fmt(L.length)}곳`;
    $("sLS").textContent = gap || effBasis() !== "total" ? "지금 필요한 돈 · 추정" : "입주까지 필요한 돈 · 추정";
    const sg = $("sGu");
    sg.hidden = !gu && !bbF && !bbCan;
    if (!gu && bbF) { sg.innerHTML = `<button type="button" class="s-bbx" id="sBbX" aria-label="지도 범위만 보기 해제 · 지금 ${fmt(L.length)}곳">지도 범위만 · ${fmt(L.length)}곳<i aria-hidden="true">✕</i></button>`; $("sBbX").onclick = () => { bbF = null; render(); const f = $("sBbO") || $("sList").querySelector("[data-id]"); if (f) f.focus({ preventScroll: true }); }; }
    else if (!gu && bbCan) { sg.innerHTML = `<button type="button" class="s-bbx s-bbo" id="sBbO"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/></svg>이 지도 범위만 보기</button>`; $("sBbO").onclick = () => { bbF = bbGet(); shown = SHOW0(); render(); const x = $("sBbX"); if (x) x.focus({ preventScroll: true }); }; }
    if (gu) sg.innerHTML = `지도에서 고른 <b>${esc(gu)}</b>만 보고 있어요 <button type="button" class="btn text sm" id="sGuX">서울 전체</button>`;
    if (gu) $("sGuX").onclick = () => { exitGu({}); if (/^#map-/.test(location.hash)) try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} };
    $("sList").innerHTML = L.length
      ? L.slice(0, shown).map(({ r, n, early }) => `<li${TX && NOSP.get(r.id) ? ' class="s-nosp"' : ""}><a href="#${r.id}" data-id="${r.id}"><span class="s-nm"><b>${esc(shortName(r.n))}</b><small>${esc(r.g)} ${esc(dongOf(r))}${sortK === "eta" ? etaTag(r) : early ? ' · <em>초기 단계</em>' : ""}${r.nbp ? ' · <em class="s-tag nb">주변 시세 기준</em>' : ""}${r.tag === "lt" && !/장기전세/.test(shortName(r.n)) ? ' · <em class="s-tag">장기전세</em>' : r.tag === "mk" ? ' · <em class="s-tag">상가·시장</em>' : ""}</small></span>${spark(r.id)}</a><button type="button" class="s-amt" data-why="${r.id}" aria-label="${esc(shortName(r.n))} 필요한 돈 추정 ${eokS(gap || effBasis() !== "total" ? n.now : n.total)}${n.total == null ? ` · ${NA_L}: ${NA_WHY}` : ` · 입주까지 내 현금 ${eokS(n.total)}`} · 왜 이 금액인지 보기" aria-haspopup="dialog" title="${n.total == null ? `${NA_L} · ${NA_WHY}` : `${LBL.cashToMoveIn}: 분담금·이자 포함, 입주 잔금대출은 뺀 금액`}"><b>${eokS(gap || effBasis() !== "total" ? n.now : n.total)}</b><small${n.total == null ? ' class="s-na"' : ""}>${gap || effBasis() !== "total" ? (n.total != null ? `${LBL.cashToMoveIn} ${eokS(n.total)}` : `${NA_L}<i class="s-nai" aria-hidden="true">i</i>`) : `계약 ${eokS(n.now)}`}</small></button></li>`).join("")
      : `<li class="s-empty">${kindEmpty()}</li>`;
    { const kx = $("sKindAll"); if (kx) kx.onclick = () => { const b = $$(".s-flt button", $("sListW")).find((x) => x.dataset.k === ""); if (b) b.click(); }; }
    { const gx = $("sGuAll"); if (gx) gx.onclick = () => { const x = $("sGuX"); if (x) x.click(); }; }
    { const bx = $("sBbAll"); if (bx) bx.onclick = () => { bbF = null; render(); }; }
    { const ku = $("sKindUp"); if (ku) ku.onclick = () => { setCash(+ku.dataset.v, true); const f = $("sList").querySelector("[data-id]"); if (f) f.focus({ preventScroll: true }); }; }
    sumR(L);
    const m = $("sMore");
    m.hidden = L.length <= shown;
    m.textContent = `더 보기 (${fmt(Math.max(0, L.length - shown))}곳)`;
    if (whyEl && !whyEl.hidden && whyFor && !document.contains(whyFor)) { const nb = $("sList").querySelector(`[data-why="${whyFor.dataset.why}"]`); if (nb) whyFor = nb; else whyClose(); }
    askTx();
    if (TX) fitSp();
  }
  // 게이지 '이 돈이면' 칸: 넓은 PC는 오른쪽 칸(3곳 · 입주까지 현금 범위), 좁은 화면은 숫자 밑 한 줄 칩(첫 목록 줄이 화면 아래로 밀려도 바로 열 수 있게)
  // 입주까지 계산되는 곳을 먼저(계산 불가 곳만 3개 뜨지 않게), 그 안에서 적은 돈순
  const MQ_SUM = matchMedia("(min-width:1180px)");
  function sumR(L) {
    const el = $("sSum"); if (!el) return;
    const ok = L.filter((o) => o.m < 99);
    const top = ok.slice().sort((a, b) => (a.n.total == null) - (b.n.total == null) || a.m - b.m).slice(0, 3);
    const skip = top.length && ok.some((o) => o.n.total == null && o.m < top[top.length - 1].m - 1e-9);
    const tt = L.map((o) => o.n.total).filter((v) => v != null && isFinite(v));
    const lo = tt.length ? Math.min(...tt) : null, hi = tt.length ? Math.max(...tt) : null;
    el.innerHTML = top.length
      ? `<p class="s-sum-h"><b>이 돈이면</b><span>${skip ? "입주 계산되는 곳 중 " : "가장 싼 "}${top.length}곳</span></p><ol>${top.map(({ r, m, n }) => `<li><button type="button" data-id="${r.id}" aria-label="${esc(shortName(r.n))} ${esc(r.g)} · 지금 ${eokS(m)}${n.total != null ? ` · 입주까지 현금 ${eokS(n.total)}` : ""} · 리포트 열기"><span>${esc(shortName(r.n))}<small>${esc(r.g)}</small></span><b>${eokS(m)}</b></button></li>`).join("")}</ol>${lo != null ? `<p class="s-sum-f"><span>입주까지 현금 <b>${lo === hi ? eokS(lo) : `${eokS(lo)}~${eokS(hi)}`}</b><small> · 잔금대출 제외</small></span></p>` : ""}`
      : `<p class="s-sum-h"><b>이 돈이면</b></p><p class="s-sum-e">아직 되는 곳이 없어요. <br>게이지를 올려 보세요.</p>`;
    // 넓은 PC에서 1~2곳뿐이면 남는 자리에 '조금 더 있으면 몇 곳'을 한 줄로(끄는 중엔 계산하지 않고, 멈춘 뒤 한 번)
    clearTimeout(sumT);
    if (MQ_SUM.matches && top.length < 3) sumT = setTimeout(() => { try { sumMore(); } catch (e) {} }, 350);
  }
  let sumT = 0, sumK = "";
  function sumMore() {
    const el = $("sSum"); if (!el || dragging || el.querySelector(".s-sum-x")) return;
    const k = `${CASH}|${gapMode()}|${effBasis()}|${kind}|${gu}`; if (k === sumK && el.dataset.x) { const a = el.querySelector("ol") || el.querySelector(".s-sum-e"); if (a) a.insertAdjacentHTML("afterend", el.dataset.x); bindX(); return; }
    let hit = null; const n0 = countAt(CASH);   // 곳 수는 첫 화면 큰 숫자와 같은 기준(ZP_count)
    for (const d of [0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5]) { const c = Math.round((CASH + d) * 10) / 10; if (c > 15) break; const n = countAt(c); if (n >= n0 + 2) { hit = [c, n]; break; } }
    const h = hit ? `<p class="s-sum-x"><button type="button" data-sumup="${hit[0]}" aria-label="내 현금 ${eokS(hit[0])}으로 올려 ${fmt(hit[1])}곳 보기"><span>${eokS(hit[0])}이면 ${fmt(hit[1])}곳 <small>지금보다 ${fmt(hit[1] - n0)}곳 더</small></span><b>보기 →</b></button></p>` : "";
    sumK = k; el.dataset.x = h;
    if (h) { put(h); bindX(); }
    function put(x) { const a = el.querySelector("ol") || el.querySelector(".s-sum-e"); if (a) a.insertAdjacentHTML("afterend", x); else el.insertAdjacentHTML("beforeend", x); }
    function bindX() { const b = el.querySelector("[data-sumup]"); if (b) b.onclick = () => setCash(+b.dataset.sumup, true); }
  }
  MQ_SUM.addEventListener("change", () => { try { render(); } catch (e) {} });
  // 좁은 화면: 흐름선 때문에 이름·동네가 잘리거나 줄이 바뀌면 그 줄만 흐름선을 뺀다
  // 판정은 목록 폭마다 한 번(같은 폭이면 다시 그려도 같은 결과). 목록이 숨어 있으면(도구 화면) 재지 않고 다음에
  let fitT = 0, fitW = 0;
  const NOSP = new Map();
  function fitSp() {
    cancelAnimationFrame(fitT);
    fitT = requestAnimationFrame(() => {
      const ol = $("sList"), w = ol ? ol.clientWidth : 0; if (!w) return;
      if (w !== fitW) { fitW = w; NOSP.clear(); }
      $$("#sList li").forEach((li) => {
        const sp = li.querySelector(".s-sp"), a = li.querySelector("[data-id]"); if (!sp || !a) return;
        const k = a.dataset.id;
        if (!NOSP.has(k)) {
          li.classList.remove("s-nosp");
          const b = li.querySelector(".s-nm b"), sm = li.querySelector(".s-nm small");
          NOSP.set(k, !!((b && b.scrollWidth > b.clientWidth + 1) || (sm && sm.getClientRects().length && sm.offsetHeight > parseFloat(getComputedStyle(sm).lineHeight || "0") * 1.5)));
        }
        li.classList.toggle("s-nosp", NOSP.get(k));
      });
    });
  }
  // ---------- 기능 화면 열기/닫기 ----------
  let cur = "", curT = "";
  function open(id, noScroll) {
    // 예전 주소(#txrTop 등) → 합친 화면 + 그 탭(66_tools.js ZP_HUB)
    const from = id, al = ALIAS[id];
    if (al) { id = al[0]; try { window.ZP_HUB && ZP_HUB.pick(al[0], al[1]); } catch (e) {} }
    if (!IDS.includes(id)) return false;
    if (!cur && !noScroll) tileY = scrollY;   // 홈 화면이 숨기 전에(숨으면 문서가 짧아져 scrollY가 줄어든다)
    IDS.forEach((x) => { const s = $(x); if (s) s.classList.toggle("s-on", x === id); });
    document.documentElement.classList.add("s-view");
    // 홈 제목(h1)이 숨는 동안은 이 도구의 제목을 1단계 제목으로(화면 읽기·axe page-has-heading-one)
    lvl(id);
    cur = id; curT = al && al[1] === "save" ? "saveTop" : id;
    navMark(id === "favTop" ? "fav" : "more");
    const f = SECT[id]; if (f) f();
    if (id === "results" || id === "planner") { planN = PLAN0(); plan(); }
    window.dispatchEvent(new Event("resize"));
    if (!noScroll) requestAnimationFrame(() => { const s = (al && al[1] === "save" && $("saveTop")) || $(id); if (s) window.scrollTo({ top: s.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); });
    try { const h = location.hash.slice(1); if (h !== id) { if (al && h === from) history.replaceState(history.state, "", "#" + id); else history.pushState({ sView: id }, "", "#" + id); } } catch (e) {}
    return true;
  }
  let tileY = null, h1El = null;
  function lvl(id) {
    if (h1El) { h1El.removeAttribute("aria-level"); h1El = null; }
    const s = id && $(id); if (!s) return;
    const h = s.querySelector("h1, h2"); if (h && h.tagName === "H2") { h.setAttribute("aria-level", "1"); h1El = h; }
  }
  function close(scroll) {
    IDS.forEach((x) => { const s = $(x); if (s) s.classList.remove("s-on"); });
    document.documentElement.classList.remove("s-view");
    lvl(null);
    const wasOpen = !!cur;
    cur = "";
    if (!document.documentElement.classList.contains("s-full")) navMark("home");
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
    if (wasOpen) fitSp();
  }
  function init() {
    // 같은 페이지에서 주소의 #도구 이름만 바뀌어도(링크·뒤로가기) 그 도구를 연다
    window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (known(h) && cur !== h) { try { if ($("report").classList.contains("sheet")) closeSheetNow(); } catch (e) {} open(h); } });
    window.addEventListener("popstate", () => { const on = document.documentElement.classList.contains("s-full"), want = !!(history.state && history.state.sFull) || location.hash === "#map"; if (on && !want) fullMap(false); else if (!on && want && history.state && history.state.sFull) fullMap(true); });
    if (P.fund === "cash" && P.basis !== "now") { P.basis = "now"; try { setSeg("pBasis", "now"); } catch (e) {} }
    build();
    // 메뉴(⋯)는 shell.html에 도구·자료·사이트로 묶어 둔다
    try { SECT.mapTop(); } catch (e) {}
    try { LMX.seoul(); } catch (e) {}   // 첫 지도도 실제 지도(구역 경계·지하철)로
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
    const fromHash = () => { const h = location.hash.slice(1); if (known(h)) open(h, false); else if (cur && !byId[h]) close("pop"); };
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
    // 상세 '입주 현금' 탭: 맨 위엔 지금·이주·입주 숫자만, 나머지(가정·근거·숫자 바꿔 보기)는 접어 둔다
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
      if (pc) { if (!was) repY = y0; keepY = null; H.classList.add("s-rep"); const id = cur && cur.id; if (!was || id !== repId) repTop(); repId = id; }
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
    try { if (localStorage.getItem("emr.lyr") == null) localStorage.setItem("emr.lyr", "[]"); } catch (e) {}
    render();
    try { coach(); } catch (e) {}
    // 키보드: '/' 검색, Esc 열린 화면 닫기(입력 중·대화상자·메뉴가 열려 있으면 그쪽에 맡긴다)
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const H = document.documentElement;
      if (e.key === "/" && !typing) { e.preventDefault(); search(); return; }
      if (e.key !== "Escape" || typing || H.classList.contains("sheet-open") || H.classList.contains("menu-open") || document.querySelector("dialog[open]") || (whyEl && !whyEl.hidden)) return;
      if (H.classList.contains("s-full")) fullMap(false);
      else if (H.classList.contains("s-rep")) { H.classList.remove("s-rep"); const l = $("sList"); if (l) l.focus && l.querySelector("a") && l.querySelector("a").focus({ preventScroll: true }); }
      else if (cur) close(true);
    });
  }
  return { init, open, close, render, fullMap: (on) => fullMap(on) };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", SIMPLE.init) : setTimeout(SIMPLE.init, 0);
/* ===================== 검색 최근·인기 · 공유 카드 (내 핀 빈 화면은 70_pins.js) ===================== */
const EXTRA = (() => {
  const RK = "emr.recent";
  const getR = () => { try { return JSON.parse(localStorage.getItem(RK) || "[]").filter((id) => byId[id]); } catch (e) { return []; } };
  const pushR = (id) => { try { const a = [id].concat(getR().filter((x) => x !== id)).slice(0, 6); localStorage.setItem(RK, JSON.stringify(a)); } catch (e) {} };
  const QK = "emr.recentQ";   // 최근 검색어(app.js saveQ가 고를 때 저장)
  const getQ = () => { try { return JSON.parse(localStorage.getItem(QK) || "[]").filter((x) => typeof x === "string" && x).slice(0, 5); } catch (e) { return []; } };
  let HOT = null;
  // 인기 = 최근 3개월 구역 안 거래가 많은 곳(진행 중만)
  const hot = () => HOT || (HOT = R.filter((r) => r.tx && r.tx.n3 && !(r.s >= 9) && r.src !== "moa").sort((a, b) => b.tx.n3 - a.tx.n3).slice(0, 8).map((r) => r.id));
  const chip = (id) => `<button type="button" class="x-chip" role="option" data-id="${id}" tabindex="-1">${esc(shortName(byId[id].n))}<small>${esc(byId[id].g.replace(/구$/, ""))}</small></button>`;
  function empty() {
    const q = $("q");
    if (!q || q.value.trim() || document.activeElement !== q) return false;
    const rc = getR(), ht = hot().filter((id) => !rc.includes(id)).slice(0, 6), rq = getQ();
    if (!rc.length && !ht.length && !rq.length) return false;
    const s = $("sugg");
    const qChip = (v) => `<button type="button" class="x-chip x-q" role="option" data-q="${esc(v)}" tabindex="-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${esc(v)}</button>`;
    s.innerHTML = (rq.length ? `<div class="x-h" role="presentation">최근 검색<button type="button" class="x-clr" id="xClrQ" tabindex="-1">지우기</button></div><div class="x-row">${rq.map(qChip).join("")}</div>` : "") + (rc.length ? `<div class="x-h" role="presentation">최근 본 구역<button type="button" class="x-clr" id="xClr" tabindex="-1">지우기</button></div><div class="x-row">${rc.map(chip).join("")}</div>` : "") +
      (ht.length ? `<div class="x-h" role="presentation">요즘 거래 많은 구역</div><div class="x-row">${ht.map(chip).join("")}</div>` : "");
    s.hidden = false; q.setAttribute("aria-expanded", "true");
    s.querySelectorAll(".x-chip[data-id]").forEach((b) => (b.onmousedown = (e) => e.preventDefault(), b.onclick = () => pickSugg(b.dataset.id)));
    s.querySelectorAll(".x-chip[data-q]").forEach((b) => (b.onmousedown = (e) => e.preventDefault(), b.onclick = () => { q.value = b.dataset.q; renderSugg(); }));
    const cq = $("xClrQ"); if (cq) { cq.onmousedown = (e) => e.preventDefault(); cq.onclick = () => { try { localStorage.removeItem(QK); } catch (e) {} empty(); }; }
    const c = $("xClr"); if (c) { c.onmousedown = (e) => e.preventDefault(); c.onclick = () => { try { localStorage.removeItem(RK); } catch (e) {} empty(); }; }
    return true;
  }
  // ---------- 공유 카드(이미지) ----------
  function card(r) {
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), F = (w, s) => `${w} ${s}px "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#1f3a87"); gr.addColorStop(1, "#142659");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,.6)"; g.font = F(600, 38); g.fillText("집핀 Zippin · 서울 재개발 지도", 88, 130);
    g.fillStyle = "#fff"; g.font = F(800, shortName(r.n).length > 10 ? 76 : 96);
    g.fillText(shortName(r.n), 88, 300, W - 176);
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = F(500, 40); g.fillText(`${r.g} ${dongOfR(r)} · ${String(srLabel(r)).replace(/(회|합)(승인|인가)/, "$1 $2")}`, 88, 375, W - 176);
    const gp = gapMode() ? gapOf(r) : null, x = investC(r);
    const rowsC = [];
    if (gp && gp.now != null) rowsC.push(["전세 끼고 지금", eokT(gp.now)]);
    else if (x && x.needBuy != null) rowsC.push(["지금 살 때 필요한 돈", eokT(x.needBuy)]);
    if (gp && gp.total != null) rowsC.push(["입주까지 현금", eokT(gp.total)]);
    else if (x && x.ok) rowsC.push(["입주까지 현금", eokT(x.needTotal)]);
    try { const pr = projection(r); if (hasEta(pr) && !pr.past) rowsC.push(["예상 입주", etaSpan(r, pr)]); } catch (e) {}
    let y = 520;
    rowsC.forEach(([k, v]) => {
      g.fillStyle = "rgba(255,255,255,.1)"; rr(g, 72, y - 92, W - 144, 170, 32); g.fill();
      g.textBaseline = "middle"; g.fillStyle = "rgba(255,255,255,.75)"; g.font = F(600, 38); g.fillText(k, 112, y - 7);
      g.fillStyle = "#fff"; g.font = F(800, 72); g.textAlign = "right"; g.fillText(v, W - 112, y - 7); g.textAlign = "left"; g.textBaseline = "alphabetic";
      y += 200;
    });
    g.fillStyle = "rgba(255,255,255,.55)"; g.font = F(500, 30);
    g.fillText("무주택·84㎡·기본 가정 추정 · 투자 권유 아님", 88, H - 150);
    g.fillStyle = "#fff"; g.font = F(700, 40); g.fillText("jaegaebal.alwaysquestions.kr", 88, H - 90);
    return cv;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const eokT = ZF.cash;
  const dongOfR = (r) => { const m = /^([가-힣0-9]+?(?:동\d*가|동|가))\s/.exec((r.j || "") + " "); return m ? m[1] : ""; };
  async function shareCard(r, fb) {
    try { await (document.fonts && document.fonts.ready); } catch (e) {}
    const url = `https://jaegaebal.alwaysquestions.kr/z/${r.id}`;
    return shareCv(card(r), `jaegaebal_${r.id}.png`, shortName(r.n), `${shortName(r.n)} · 집핀 ${url}`, fb);
  }
  // 캔버스를 공유 시트로(안 되면 파일로 저장)
  async function shareCv(cv, name, title, text, fb) {
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
    const file = blob && typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title, text }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    if (fb) fb.textContent = "카드 이미지를 저장했어요";
  }
  function init() {
    const q = $("q");
    if (q) {
      q.addEventListener("focus", () => setTimeout(empty, 0));
      q.addEventListener("input", () => { if (!q.value.trim()) setTimeout(empty, 90); });
      q.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== q && $("sugg").querySelector(".x-row")) { $("sugg").hidden = true; q.setAttribute("aria-expanded", "false"); } }, 150));
    }
    const _sel = select;
    select = function (id) { const x = _sel.apply(this, arguments); try { if (byId[id]) pushR(id); } catch (e) {} return x; };
    const _rr = renderReport; renderReport = function () { const x = _rr.apply(this, arguments); try { addCardBtn(cur); } catch (e) {} return x; };
    try { addCardBtn(cur); } catch (e) {}
  }
  function addCardBtn(r) {
    const acts = document.querySelector("#report .rep-acts");
    if (!r || !acts || acts.querySelector(".x-card")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn secondary sm x-card"; b.textContent = "이미지";
    b.onclick = () => shareCard(r, $("zoneShareFb"));
    const sh = $("zoneShare"); sh ? sh.after(b) : acts.appendChild(b);
  }
  return { init, card, shareCv, rr };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", EXTRA.init) : setTimeout(EXTRA.init, 0);
/* ===================== 구역 상세 맨 위: 위치 지도 · 실거래 · 노후도 =====================
   사람들이 제일 먼저 보는 것(어디인지, 얼마에 거래되는지, 얼마나 낡았는지)을 탭보다 먼저 보여 준다. */
const OVX = (() => {
  let mm = null, mmId = null;
  const ym = (d) => (d && d.length >= 6 ? `${d.slice(2, 4)}.${d.slice(4, 6)}` : "");
  const eok = ZF.eok;   // 숫자 꼴은 ZF 하나(05_facts.js)
  const e1 = (v) => (v == null || !isFinite(v) ? "–" : v >= 1e4 ? `${(v / 1e4).toFixed(1).replace(/\.0$/, "")}억` : `${Math.round(v).toLocaleString()}만`);
  // 노후도 게이지(반원): 기준선 60%
  function gauge(pct) {
    const R = 54, C = Math.PI * R, v = Math.max(0, Math.min(100, pct));
    const lv = v >= 60 ? "hi" : "lo";
    const ang = Math.PI * (1 - 0.6);
    const ox = 70 + Math.cos(ang) * (R + 10), oy = 66 - Math.sin(ang) * (R + 10);
    return `<svg class="ov-g ${lv}" viewBox="0 -12 140 92" role="img" aria-label="노후 건축물 ${v}%, 재개발 요건 60% 이상">
      <path d="M16 66a54 54 0 0 1 108 0" class="tr"/>
      <path d="M16 66a54 54 0 0 1 108 0" class="fg" stroke-dasharray="${(C * v / 100).toFixed(1)} ${C.toFixed(1)}"/>
      <line x1="${(70 + Math.cos(ang) * (R - 10)).toFixed(1)}" y1="${(66 - Math.sin(ang) * (R - 10)).toFixed(1)}" x2="${(70 + Math.cos(ang) * (R + 10)).toFixed(1)}" y2="${(66 - Math.sin(ang) * (R + 10)).toFixed(1)}" class="tk"/>
      <text x="${(ox + 3).toFixed(1)}" y="${(oy + 3).toFixed(1)}" class="tl">기준 60%</text>
      <text x="70" y="62" class="v">${v}<tspan>%</tspan></text></svg>`;
  }
  function oldHTML(t, r) {
    const o = t.old;
    if (!o || !o.k || r.s >= 7 || /재건축/.test(r.k)) return "";   // 재건축은 노후도 요건이 아니라 준공 30년 기준
    const ok = o.pol >= 60;
    return `<div class="ov-c ov-old"><div class="ov-gw">${gauge(o.pol)}<div class="ov-gs"><h3>노후도</h3><b class="${ok ? "ok" : "no"}">${ok ? "요건 충족" : "요건 미달"}</b><span>평균 ${Math.round(o.avg)}년${o.new10 ? ` · 신축 ${o.new10}동` : ""}</span></div></div></div>`;
  }

  // ---------- 판정: 입주권 · 전세 끼고 · 단계 (누르면 한 줄 이유) ----------
  const ymd = (d) => (d ? String(d).replaceAll("-", ".").slice(0, 10) : "");
  const curStep = (r) => { const T = tlSteps(r), i = T.reduce((a, s, k) => (s[1] <= r.s ? k : a), -1); return [T, i]; };
  function verdicts(r) {
    const out = [], fin = isDone(r); let noIp = false;
    if (!fin) {
      try {
        const w = buyWindow(r), rt = (() => { try { return ZX.rights(r); } catch (e) { return {}; } })();
        const [c, v] = w.cls === "ok" ? ["ok", "✓ 나와요"] : w.cls === "no" ? ["no", "✕ 안 나와요"] : ["warn", "! 확인 필요"];
        noIp = c === "no";
        out.push({ k: "입주권", c, v, why: () => [w.due || w.t, rt.k === "set" ? (rt.old ? `권리산정기준일 ${rt.d}(추정 · 조례 부칙 확인 필요)` : `권리산정기준일 ${rt.d} 전 건물만`) : ""].filter(Boolean).join(" · ") });
      } catch (e) {}
      if (!noIp) try {
        const lp = landPermit(r);
        let blk = null; try { blk = gapOf(r).block; } catch (e) { blk = typeof gapBlock === "function" ? gapBlock(r) : null; }
        // 아래 '전세 끼고 사기 불가' 카드·계산과 같은 판정(가능성 구역도 계산에서 빼므로 '불가')
        if (lp) out.push({ k: "전세 끼고", c: "no", v: "✕ 불가 · 토허 실거주 2년", why: () => (/가능성/.test(lp.t) ? `${/공공재개발/.test(lp.t) ? "공공재개발" : "신속통합기획"} 구역은 토지거래허가(2년 실거주)로 묶이는 경우가 많아 전세 낀 매수에서 빼요 · 지정 여부는 구청 확인` : "토지거래허가구역 · 2년 실거주라 전세 낀 매수 불가") });
        else if (blk && !/대상 아님/.test(blk)) out.push({ k: "전세 끼고", c: /보류/.test(blk) ? "warn" : "no", v: /세입자/.test(blk) ? "✕ 세입자 없음" : /입주권 없음/.test(blk) ? "✕ 입주권 없음" : "! 확인 필요", why: () => blk });
        else if (!blk) out.push({ k: "전세 끼고", c: "ok", v: "✓ 가능", why: () => "토지거래허가 대상 아님 · 전세금만큼 덜 내고 살 수 있어요" });
      } catch (e) {}
    }
    out.push({ k: "단계", c: "st", v: stageName(r), why: () => {
      const [T, i] = curStep(r), d = i >= 0 ? stepDate(r, T[i][0]) : null;
      let p = null; try { p = ZX.pace(r); } catch (e) {}
      if (p) return `${ymd(p.from)}부터 ${p.yrs < 1 ? Math.round(p.yrs * 12) + "개월" : p.yrs.toFixed(1) + "년"}째 · 서울 가운데 값 ${p.med}년`;
      return d ? `${ymd(d)} ${T[i][0]}` : r._prem || !FREE ? "단계 날짜 기록 없음" : "불러오는 중";
    } });
    return out;
  }
  function vdHTML(V) {
    return `<div class="ov-vd" role="group" aria-label="판정">${V.map((x, i) => `<button type="button" class="ov-p ${x.c}" data-vi="${i}" aria-expanded="false"><span>${esc(x.k)}</span><b>${esc(x.v)}</b></button>`).join("")}</div><p class="ov-why" hidden></p>`;
  }
  function vdBind(w, V) {
    const why = w.querySelector(".ov-why");
    w.querySelectorAll(".ov-p").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const on = b.getAttribute("aria-expanded") === "true";
      w.querySelectorAll(".ov-p").forEach((x) => x.setAttribute("aria-expanded", "false"));
      if (on) { why.hidden = true; return; }
      b.setAttribute("aria-expanded", "true");
      why.textContent = V[+b.dataset.vi].why() || "";
      why.className = "ov-why " + V[+b.dataset.vi].c;
      why.hidden = !why.textContent;
    }));
  }

  // ---------- 단계 타임라인 ----------
  function tlSteps(r) {
    const sm = isSmallR(r), early = (r.s || 0) < 2;   // 정비계획 수립·후보지: '계획' 칸을 앞에(추진위는 건너뛰는 곳이 많아 생략)
    return [["계획", 0], ["구역지정", 2], ["추진위", 3], [r.trust ? "시행자지정" : "조합설립", 4], ["사업시행", 5], ["관리처분", 6], ["착공", 8], ["준공", 9]].filter(([k]) => (k !== "계획" || early) && !(early && k === "추진위") && !(sm && (k === "구역지정" || k === "관리처분")) && !(r.trust && k === "추진위"));
  }
  const stepDate = (r, k, dt) => { dt = dt || r.dt || {}; return dt[k] || (k === "조합설립" ? dt["시행자지정"] : k === "시행자지정" ? dt["조합설립"] : null) || null; };
  const yrs = (a, b) => (new Date(b) - new Date(a)) / (365.25 * 864e5);
  let AVGP = null; const AVG = new Map();
  function allDt() {
    if (!AVGP) AVGP = (FREE ? premAll() : Promise.resolve(null)).then((all) => {
      const m = [];
      R.forEach((x) => { const dt = (all && all[x.id] && all[x.id].dt) || x.dt; if (dt) m.push([x, dt]); });
      return m;
    }).catch(() => []);
    return AVGP;
  }
  // 이 구역의 직전 단계 → 지금 단계 걸린 해 vs 같은 두 단계 날짜가 다 있는 서울 구역 평균
  function paceVs(r) {
    if (r.src === "moa") return Promise.resolve(null);
    const [T, i] = curStep(r);
    if (i < 1) return Promise.resolve(null);
    const cd = stepDate(r, T[i][0]); if (!cd) return Promise.resolve(null);
    const j = i - 1;   // 바로 앞 단계 날짜가 있을 때만 비교(단계 건너뛴 비교 금지)
    if (!stepDate(r, T[j][0])) return Promise.resolve(null);
    const a = T[j][0], b = T[i][0], mine = yrs(stepDate(r, a), cd), sm = isSmallR(r);
    if (!(mine > 0)) return Promise.resolve(null);
    const key = a + ">" + b + (sm ? "|s" : "");
    return allDt().then((L) => {
      if (!AVG.has(key)) {
        let s = 0, n = 0;
        L.forEach(([x, dt]) => { if (isSmallR(x) !== sm) return; const p = stepDate(x, a, dt), q = stepDate(x, b, dt); if (!p || !q) return; const y = yrs(p, q); if (y > 0 && y < 40) { s += y; n++; } });
        AVG.set(key, n >= 8 ? { avg: s / n, n } : null);
      }
      const v = AVG.get(key); if (!v) return null;
      return { a, b, mine, avg: v.avg, n: v.n, diff: mine - v.avg };
    });
  }
  function tlHTML(r) {
    if (r.src === "moa") return "";
    const [T, i] = curStep(r), done = isDone(r);
    // 단계 이름이 칸 이름과 다르면(정비계획 수립·이주·철거 등) 머리에 '지금 ○○'
    const sn = stageName(r), nz = (x) => String(x).replace(/인가|\s|·/g, "");
    const pre = !done && (i < 0 || !nz(sn).startsWith(nz(T[i][0]))) ? `<span class="ov-tl-now">지금 ${esc(sn)}</span>` : "";
    // 앞 칸 날짜가 뒤 칸보다 늦으면 변경 지정·고시일로 본다(최초 날짜는 더 이름) → '(변경)' 표시
    const ds = T.map(([k]) => stepDate(r, k));
    const li = T.map(([k], n) => { const d = ds[n], chg = d && ds.slice(n + 1).some((x, j) => x && x < d && !(k === "구역지정" && T[n + 1 + j][0] === "추진위")), st = n < i || (n === i && done) ? "dn" : n === i ? "on" : ""; return `<li class="${st}"${n === i && !done ? ' aria-current="step"' : ""}${chg ? ' title="변경 지정·고시일로 보여요(최초 날짜는 더 이름)"' : ""}><i></i><b>${k === "시행자지정" ? "시행자" : k}</b><small>${d ? esc(d.slice(2, 7).replace("-", ".")) + (chg ? '<br><em class="ov-chg">(변경)</em>' : "") : n === i && !done ? "지금" : n < i ? "–" : ""}</small></li>`; }).join("");
    const stl = r.stale && !done ? `<span class="ov-tl-now ov-stl" title="오랫동안 새 인가·공고 기록이 없어요">진행 확인 필요</span>` : "";
    return `<div class="ov-c ov-tl"><h3>진행 단계 ${pre}${stl}<em class="ov-pv" hidden></em></h3><div class="ov-tl-sc" tabindex="0" role="group" aria-label="진행 단계 ${T.length}칸${i >= 0 ? ` · 지금 ${esc(sn)}` : ""}"><ol style="--n:${T.length}">${li}</ol></div></div>`;
  }
  function srcHTML(r) {
    const s = D.txAsOf && D.txAsOf.sale, d = s && s.length >= 8 ? `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}` : "";
    const cafe = r.cafe ? `<a href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl=${encodeURIComponent(r.cafe)}" target="_blank" rel="noopener">정비사업 정보몽땅 ↗</a>` : "정비사업 정보몽땅";
    return `<p class="ov-src"><span>자료 기준${d ? ` 실거래 ${d}` : ""}</span>${cafe.startsWith("<a") ? cafe : `<span>${cafe}</span>`}<a href="https://www.eum.go.kr/" target="_blank" rel="noopener">토지이음 ↗</a></p>`;
  }
  // 단계 날짜·사업장 주소는 따로 불러오는 자료라, 오면 타임라인·출처 줄을 다시 그린다
  function late(r, w) {
    if (cur !== r || !w.isConnected) return;
    const tl = w.querySelector(".ov-tlw"); if (tl) tl.innerHTML = tlHTML(r);
    const sr = w.querySelector(".ov-srcw"); if (sr) sr.innerHTML = srcHTML(r);
    paceVs(r).then((p) => {
      const em = w.querySelector(".ov-pv"); if (!p || !em || cur !== r) return;
      const ad = Math.abs(p.diff), n = ad >= 2 ? Math.round(ad) : Math.round(ad * 10) / 10;
      em.textContent = ad < 0.5 ? "평균 수준" : `서울 평균보다 ${n}년 ${p.diff < 0 ? "빠름" : "늦음"}`;
      em.className = "ov-pv " + (ad < 0.5 ? "eq" : p.diff < 0 ? "fast" : "slow");
      em.title = `${p.a} → ${p.b} ${p.mine.toFixed(1)}년 · 서울 ${p.n}곳 평균 ${p.avg.toFixed(1)}년`;
      em.hidden = false;
    }).catch(() => {});
  }
  // 분기별 가운데 값 막대(최근 3년): 0부터 그린 막대 + 눈금 2~3줄 · 막대 아래 거래 수 · 마지막 분기 값과 최고 값만 숫자로
  const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))), m = v / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  function chart(r, q, unit) {
    const cut = String(new Date().getFullYear() - 3).slice(-2);
    const nd = new Date(), curQ = `${String(nd.getFullYear()).slice(2)}Q${Math.floor(nd.getMonth() / 3) + 1}`;
    const qq = q.filter((x) => x[0].slice(0, 2) >= cut && x[0] !== curQ).slice(-12);
    if (qq.length < 3) return "";
    const W = 320, H = 150, pl = 42, pr = 2, pt = 18, pb = 32, n = qq.length, gap = 4, bw = Math.min(24, (W - pl - pr - gap * (n - 1)) / n);
    const mx = Math.max(...qq.map((x) => x[1])), st = nice(mx / 2), ticks = [];
    for (let t = st; !ticks.length || ticks[ticks.length - 1] < mx; t += st) ticks.push(t);
    const top = Math.max(mx, ticks[ticks.length - 1]), base = H - pb;
    const off = pl + (W - pl - pr - (n * (bw + gap) - gap)) / 2;
    const X = (i) => off + i * (bw + gap), Y = (v) => pt + (base - pt) * (1 - v / top);
    const imx = qq.findIndex((x) => x[1] === mx);
    const grid = ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="gl"/><text x="${pl - 6}" y="${(Y(t) + 3.5).toFixed(1)}" class="ax">${eok(t)}</text>`).join("") + `<line x1="${pl}" x2="${W - pr}" y1="${base}" y2="${base}" class="gl b"/>`;
    let lastYr = "";
    const bars = qq.map((x, i) => {
      const y = Y(x[1]), yr = "20" + x[0].slice(0, 2), lab = yr !== lastYr ? ((lastYr = yr), `<text x="${X(i).toFixed(1)}" y="${H - 3}" class="yr">${yr}</text>`) : "", bh = base - y;
      const cx = X(i) + bw / 2, anc = cx > W - 40 ? "end" : "middle", tx = anc === "end" ? X(i) + bw : cx;
      const v = i === n - 1 || (i === imx && imx < n - 2) ? `<text x="${tx.toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="${anc}" class="bv${i === n - 1 ? " last" : ""}">${eok(x[1])}</text>` : "";
      const cls = [i === n - 1 ? "on" : "", x[2] < 3 ? "lo" : ""].filter(Boolean).join(" ");
      return `<rect x="${X(i).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, base - y).toFixed(1)}" rx="3"${cls ? ` class="${cls}"` : ""}><title>20${x[0].slice(0, 2)}년 ${x[0].slice(3)}분기 · ${eok(x[1])} · ${x[2]}건</title></rect>${v}<text x="${cx.toFixed(1)}" y="${base + 12}" class="bq">${x[0].slice(2)}</text>${bh >= 15 ? `<text x="${cx.toFixed(1)}" y="${(base - 4).toFixed(1)}" class="bn${i === n - 1 ? " on" : ""}">${x[2]}</text>` : ""}${lab}`;
    }).join("");
    const anyLo = qq.some((x) => x[2] < 3);
    return `<div class="ov-ch"><div class="ov-cht">${unit} · 분기별 가운데 값 <b>최근 분기 ${eok(qq[n - 1][1])}</b></div><svg class="ov-bar" viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit} 분기별 가운데 값, 최근 ${eok(qq[n - 1][1])}, 최고 ${eok(mx)}">${grid}${bars}</svg><p class="ov-chn">막대 안 숫자는 분기 거래 수${anyLo ? " · 흐린 막대는 3건 미만" : ""}</p></div>`;
  }
  // 표본이 얇은 값(3건 미만이거나 마지막 거래가 1년 넘음)은 큰 숫자를 회색으로 + '거래 적음' 표시
  const monthsAgo = (d) => { if (!d || String(d).length < 6) return null; d = String(d); const nd = new Date(); return (nd.getFullYear() - +d.slice(0, 4)) * 12 + (nd.getMonth() + 1 - +d.slice(4, 6)); };
  function thinTag(n, to) {
    const ma = monthsAgo(to), few = n != null && n < 3, old = ma != null && ma > 12;
    if (!few && !old) return "";
    return `${few ? "거래 적음" : "오래된 거래"}${to ? ` · 최근 ${ym(to)}` : ""}`;
  }
  // 다른 기준(대표 거래·최근 분기·연식별)은 큰 숫자 밑에 접어 둔다
  function altHTML(items, ch) {
    const L = items.filter(Boolean);
    if (!L.length && !ch) return "";
    return `<details class="ov-alt"><summary>다른 기준 보기</summary>${L.length ? `<dl class="ov-altl">${L.map(([k, v, s]) => `<div><dt>${k}${s ? `<small>${s}</small>` : ""}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}${ch || ""}</details>`;
  }
  function lastQ(q) { const nd = new Date(), cq = `${String(nd.getFullYear()).slice(2)}Q${Math.floor(nd.getMonth() / 3) + 1}`; const L = (q || []).filter((x) => x[0] !== cq); return L.length ? L[L.length - 1] : null; }
  // 머리 큰 숫자 = ZF.headline 하나(/z/ 페이지와 같은 규칙): 매수가 표본의 3.3㎡당('u') · 매수가 자체('p') · 대표 거래 기준('hd')
  function hdHTML(h, t, r, dd) {
    const BN = { i: "입주권", a: "아파트", v: "빌라·단독 대지" }[h.b];
    const yoy = h.b === "v" && r.tx && r.tx.yoy != null ? `<em class="${r.tx.yoy >= 0 ? "up" : "dn"}">1년 ${r.tx.yoy >= 0 ? "▲" : "▼"} ${Math.abs(r.tx.yoy)}%</em>` : "";
    const per = `${BN} 3.3㎡당`;
    const win = h.w === 0 ? "최근 거래" : h.w === 24 ? "2년" : "1년";
    const H = ZF.headline(r, h) || { kind: "hd", v: h.u, n: h.n, to: h.to };
    // 1건이면 '가운데 값'이라 하지 않는다
    const hdBasis = h.n === 1 ? `${win} 구역 안 거래 1건${h.to ? ` · ${ym(h.to)}` : ""}` : `${win} 대표 거래 ${h.n}건 가운데 값${h.from && h.to && h.from !== h.to ? ` · ${ym(h.from)}–${ym(h.to)}` : ""}`;
    const P = H.kind === "p", U = H.kind === "u";
    const basis = U || P ? H.basis : hdBasis;
    const thin = U || P ? thinTag(H.n, H.to) : thinTag(h.n, h.to) || (h.st || h.w === 0 ? `오래된 거래${h.to ? ` · 최근 ${ym(h.to)}` : ""}` : "");
    // 계산 매수가가 주변 빌라 표본이면 아래 몇 건도 그 표본에서(머리 '마지막 거래'와 같은 거래가 맨 위) — 표본 목록이 없으면 구역 안 거래에 '표본 아님' 이름표
    const NZ = ZX.near && ZX.near(r), nearB = !!(r.mk && r.mk.entry && r.mk.entry.src === "villa" && (r.mk.entry.radius || 0) >= 100);
    const S = NZ ? NZ.s.slice(0, matchMedia("(max-width:640px)").matches ? 2 : 3).map((v) => [v[0], 0, v[3], v[1], v[2], v[4], v[5]]) : txRows(dd, h.r);
    const lq = lastQ(h.q), ag = dd && dd.x && dd.x.age, agn = (dd && dd.x && dd.x.agn) || {};
    const alts = [
      P ? [h.b === "v" ? `구역 안 대표 거래 · 대지 3.3㎡` : `구역 안 ${per}`, eok(h.u), hdBasis] : null,
      U && h.u && Math.abs(h.u - H.v) >= 1 ? ["대표 거래 · 대지 3.3㎡", eok(h.u), hdBasis] : null,
      lq && !(h.q && h.q.length > 2) && !(P && lq[2] >= h.n) ? ["최근 분기", eok(lq[1]), `${lq[0].replace(/^(\d\d)Q/, "'$1년 ")}분기 · ${lq[2]}건`] : null,
      h.b === "v" && ag && ag.c != null ? ["31년 이상 건물", eok(ag.c), `구역 안 전체 기간 · ${agn.c || 0}건`] : null,
    ];
    const ch = h.q && h.q.length > 2 ? chart(r, h.q, per) : "";
    // 'p'(매수가가 큰 숫자)일 때 아래 몇 건은 구역 안 거래라 표본과 다를 수 있다 → 이름을 붙여 둔다
    const li = liHTML(S);
    return `<div class="ov-c ov-tx${thin ? " thin" : ""}"><h3>실거래 ${yoy}</h3>
      <div class="ov-big"><span>${P ? H.label : per}</span><b${thin ? ' title="표본이 적거나 오래돼 지금 시세와 다를 수 있어요"' : ""}>${P ? ZF.manT(H.v / 1e4) : eok(H.v)}</b>${thin ? `<em class="ov-thin">${thin}</em>` : ""}</div>
      <p class="ov-basis">기준 · ${esc(basis)}</p>
      ${P ? calcRow(r, false, H.v) : calcRow(r, U)}
      ${altHTML(alts, ch)}
      ${li ? (NZ ? `<p class="ov-lh">매수가 표본 최근 거래 · 주변 ${NZ.r}m</p>` : P || nearB ? `<p class="ov-lh">구역 안 최근 거래(매수가 표본 아님)</p>` : "") : ""}${li}
      <button type="button" class="ov-more" data-tab="tx">거래 전체 보기 →</button></div>`;
  }
  // 입주 현금 계산에 실제로 쓴 매수가와 그 표본 — /z/ 페이지·API와 같은 한 문장(ZF.smpTxt)
  const manT = ZF.manT, smpTxt = ZF.smpTxt;
  // 최근 거래 몇 건: 거래 탭과 같은 목록(최신 먼저) · 빌라·단독은 대지, 아파트·입주권은 전용
  const TY = ["빌라", "단독", "아파트", "입주권"];
  function txRows(dd, fb) {
    const k = matchMedia("(max-width:640px)").matches ? 2 : 3;
    const L = dd && Array.isArray(dd.s) && dd.s.length ? [...dd.s] : [...(fb || [])];
    return L.sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0)).slice(0, k);
  }
  const areaT = (x) => (x[1] <= 1 && x[4] > 0 ? `대지 ${x[4]}㎡` : x[3] ? `전용 ${x[3]}㎡` : "");
  const liHTML = (S) => (S.length ? `<ul class="ov-l">${S.map((x) => `<li><span>${esc(ym(x[0]))}</span><span>${TY[x[1]] || ""}${x[6] ? ` ${+x[6] < 0 ? "지하" + -x[6] : esc(String(x[6]))}층` : ""}${areaT(x) ? ` · ${areaT(x)}` : ""}</span><b>${eok(x[5])}</b></li>`).join("")}</ul>` : "");
  function calcRow(r, same, dup) {
    let x = null; try { x = investC(r); } catch (e) {}
    if (!x || x.price == null || !isFinite(x.price)) return "";
    if (dup && x.priceSrc !== "user" && Math.abs(x.price * 1e4 - dup) < 1) return "";   // 위 큰 숫자가 곧 계산 매수가(기준 줄에 '계산 매수가와 같은 표본')
    let est = false; try { est = isEst(r); } catch (e) {}
    const en = (r.mk && r.mk.entry) || {};
    const smp = x.priceSrc === "user" && !est ? "직접 입력" : same ? (en.n === 1 ? "위와 같은 거래 1건의 매매가" : `위와 같은 ${en.n}건의 매매가 가운데 값`) : smpTxt(r, x);
    return `<div class="ov-calc"><span>계산 매수가</span><b>${manT(x.price)}</b><small>${smp ? `= ${esc(smp)}` : "입주 현금 계산 기준"}</small></div>`;
  }
  // '이 숫자 믿어도 될까': 표본 수·마지막 거래·신뢰도(표본 수·최근성·참고값(lc)·주변 시세(nbp))
  function trustHTML(r) {
    let x = null; try { x = investC(r); } catch (e) {}
    const en = (r.mk && r.mk.entry) || {}, t = r.tx || {};
    const H = (lv, cls, rows, msg) => `<div class="ov-c ov-trust ${cls}"><div class="ov-trh"><h3>이 숫자 믿어도 될까</h3><b class="ov-lv">${lv}</b></div>${rows.length ? `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}<p>${msg}</p></div>`;
    // 구역 안 거래 줄: 거래 탭 '구축 빌라 매매'와 같은 정의·기간(2015년 이전 준공 빌라 · 최근 nwin개월)을 쓰고, 그 값이 없을 때만 모든 거래 12개월
    const n12 = t.no != null ? [[`구역 안 빌라 ${t.nwin || 18}개월`, `${t.no}건`]] : t.n12 != null ? [["구역 안 거래 12개월", `${t.n12}건`]] : [];
    const nearL = en.src === "villa" && (en.radius || 0) >= 100 ? `주변 ${en.radius}m 빌라 ` : en.fill === "dong" ? "같은 동 빌라 " : "";
    if (!x || x.price == null || !isFinite(x.price)) return H("계산 안 함", "na", n12, "입주 현금을 자동으로 계산할 매수가 표본이 없어요. 아는 매물가를 입주 현금 탭에 넣어 보세요.");
    let est = false; try { est = isEst(r); } catch (e) {}
    if (est) return H("낮음", "lo", n12, `구역 안 거래가 적어 같은 구(${esc(r.g)}) 빌라 시세로 추정한 값이에요 · 계약 전 매물 시세로 꼭 확인`);
    if (x.priceSrc === "user") return H("직접 입력", "hi", [], "내가 넣은 매수가로 계산했어요.");
    const n = en.n || 0, last = en.last || (en.t ? en.t : ""), lastY = last ? "20" + last.slice(0, 2) + (last.slice(3, 5) || "01") : "";
    const ma = lastY ? (TODAY.getFullYear() - +lastY.slice(0, 4)) * 12 + (TODAY.getMonth() + 1 - +lastY.slice(4, 6)) : null;
    const why = [];
    if (n && n < 3) why.push(`표본 ${n}건뿐`);
    if (ma != null && ma > 12) why.push("마지막 거래가 1년 넘음");
    if (r.lc && !why.length) why.push(r.lcw === "thin" ? "구역 안 거래로 확인 안 됨" : "표본이 적거나 구역 거래와 구성이 달라 참고값");
    const low = why.length > 0;
    if (!low) {
      if (r.nbp || en.radius || en.fill === "dong") why.push("구역 밖 주변 시세 기준");
      if (n < 10) why.push(`표본 ${n}건이라 몇 건에 값이 흔들릴 수 있어요`);
      if (ma != null && ma > 6) why.push("마지막 거래 6개월 넘음");
    }
    const [lv, cls] = low ? ["낮음", "lo"] : why.length ? ["보통", "md"] : ["높음", "hi"];
    const rows = [["매수가 표본", n ? `${nearL}${n}건` : "–"], [nearL ? "표본 마지막 거래" : "마지막 거래", last ? esc(last) : "–"], ...(en.p25 && en.p75 && en.p75 > en.p25 ? [["가운데 50%", `${eok(en.p25)}~${eok(en.p75)}`]] : []), ...n12];
    return H(lv, cls, rows, why.length ? why.join(" · ") + (low ? " · 계약 전 매물 시세로 꼭 확인" : "") : "구역 안 최근 거래가 충분해요");
  }
  function txHTML(t, r, d) {
    if (t.hd && t.hd.u) return hdHTML(t.hd, t, r, d);
    const S = txRows(d, null);
    const has = t.pp || t.med || t.am || t.im;
    if (!has) return `<div class="ov-c ov-tx"><h3>실거래</h3><p class="ov-none">최근 구역 안 거래 없음</p>${t.nb ? nearHTML(t.nb) : ""}</div>`;
    const yoy = r.tx && r.tx.yoy != null ? `<em class="${r.tx.yoy >= 0 ? "up" : "dn"}">1년 ${r.tx.yoy >= 0 ? "▲" : "▼"} ${Math.abs(r.tx.yoy)}%</em>` : "";
    const last = S[0] ? ym(S[0][0]) : "";
    const A = !!t.am && (/재건축/.test(r.k) || (!t.pp && !t.med));   // 재건축은 아파트 값이 기준
    const IP = r.s >= 8 && t.im;                                        // 착공 뒤엔 입주권 거래가 기준
    // 대표 거래 기준(hd)이 없는 빌라 구역도 계산 매수가가 있으면 그 표본이 큰 숫자(ZF.headline 'p' · /z/와 같은 규칙)
    const H = !IP && !A ? ZF.headline(r, null) : null, P = H && H.kind === "p";
    const big = P ? [H.label, ZF.manT(H.v / 1e4)] : IP ? ["입주권 · 1년", eok(t.im)] : A ? ["아파트 매매 · 1년", eok(t.am)] : t.pp ? ["대지 3.3㎡당 · 1년", eok(t.pp)] : t.med ? ["빌라 매매 · 1년", eok(t.med)] : t.am ? ["아파트 매매 · 1년", eok(t.am)] : null;
    const ser = IP ? [t.qi, "입주권"] : A || (!t.pp && t.am) ? [t.qa, "아파트 매매"] : t.pp ? [(t.q || []).filter((x) => x[2] >= 2), "대지 3.3㎡당"] : [null, ""];
    const nn = t.n12 || t.n, thin = P ? thinTag(H.n, H.to) : big ? thinTag(nn == null ? null : nn, S[0] ? S[0][0] : null) : "";
    const chips = [P && t.pp ? `구역 안 대지 3.3㎡ ${eok(t.pp)}` : "", !P && !IP && !A && t.med && big && !/빌라/.test(big[0]) ? `빌라 ${eok(t.med)}` : "", nn ? `구역 안 ${t.n12 ? "12개월 " : ""}거래 ${nn}건` : "", last && !thin ? `최근 ${last}` : ""].filter(Boolean);
    return `<div class="ov-c ov-tx${thin ? " thin" : ""}"><h3>실거래 ${yoy}</h3>
      ${big ? `<div class="ov-big"><span>${big[0]}</span><b>${big[1]}</b>${thin ? `<em class="ov-thin">${thin}</em>` : ""}</div>` : ""}${P ? `<p class="ov-basis">기준 · ${esc(H.basis)}</p>` : ""}
      ${P ? calcRow(r, false, H.v) : calcRow(r)}${chips.length ? `<div class="ov-chips">${chips.map((c) => `<span>${c}</span>`).join("")}</div>` : ""}
      ${ser[0] && ser[0].length > 2 ? altHTML([], chart(r, ser[0], ser[1])) : ""}
      ${P && S.length ? `<p class="ov-lh">구역 안 최근 거래</p>` : ""}${liHTML(S)}
      <button type="button" class="ov-more" data-tab="tx">거래 전체 보기 →</button></div>`;
  }
  function nearHTML(nr) {
    return nr && nr.n ? `<div class="ov-near"><span>같은 동(${esc(nr.dong || "")}) 빌라 매매 · 1년 ${nr.n}건</span><b>${eok(nr.med)}</b></div>` : "";
  }
  function apt(t, r) {   // 재건축 아파트 단지 거래
    const a = t.apt; if (!a || !a.n) return "";
    return `<div class="ov-c ov-tx"><h3>단지 실거래</h3><div class="ov-k"><div><span>최근 거래</span><b>${eok(a.last)}</b></div><div><span>1년 가운데 값</span><b>${a.med ? eok(a.med) : "–"}</b></div><div><span>거래 수(1년)</span><b>${a.n}건</b></div></div></div>`;
  }
  function mini(r) {
    const box = document.getElementById("ovMap"); if (!box) return;
    if (!window.matchMedia("(max-width:980px)").matches) { box.remove(); return; }
    Promise.all([LMX.lib(), LMX.geo()]).then(([, g]) => {
      if (!document.getElementById("ovMap") || cur !== r || !window.maplibregl) return;
      const z = g && g.z && g.z[r.id] && g.z[r.id].g ? g.z[r.id] : null, est = !!(z && z.e);   // 추정 범위는 점선으로(경계처럼 보이지 않게)
      if (!z && !r.ll) { box.remove(); return; }
      let bb;
      if (z) { let a = 180, b = 90, c = -180, d = -90; z.g.forEach((rg) => rg.forEach(([x, y]) => { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; })); bb = [[a, b], [c, d]]; }
      try { if (mm) mm.remove(); } catch (e) {}
      mm = new maplibregl.Map({ container: "ovMap", style: LMX.style(), interactive: false, attributionControl: false, preserveDrawingBuffer: true, fadeDuration: 0, ...(bb ? { bounds: bb, fitBoundsOptions: { padding: est ? 56 : 28, maxZoom: est ? 15.6 : 16.2 } } : { center: [r.ll[1], r.ll[0]], zoom: 15 }) });
      mmId = r.id;
      const fit = () => { try { mm.resize(); if (bb) mm.fitBounds(bb, { padding: est ? 56 : 28, maxZoom: est ? 15.6 : 16.2, duration: 0 }); } catch (e) {} };
      try { new ResizeObserver(fit).observe(box); } catch (e) {}
      setTimeout(fit, 350); setTimeout(fit, 900);
      // 다 그려지면 그림으로 바꿔 WebGL을 놓아 준다(시트 스크롤·메모리)
      mm.once("idle", () => setTimeout(() => { try { if (!mm || mmId !== r.id) return; const url = mm.getCanvas().toDataURL("image/png"); const im = new Image(); im.alt = ""; im.src = url; im.className = "ov-img"; const m = mm; mm = null; m.remove(); const tg = box.querySelector(".ov-mtag"); box.innerHTML = ""; box.appendChild(im); if (tg) box.appendChild(tg); } catch (e) {} }, 120));
      mm.on("load", () => {
        try { mm.addSource("sub", { type: "geojson", data: LMX.subway() }); mm.addLayer({ id: "sub", type: "line", source: "sub", paint: { "line-color": ["get", "c"], "line-width": 3, "line-opacity": 0.85 } }); } catch (e) {}
        if (z) {
          mm.addSource("z", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: {} } });
          mm.addLayer({ id: "zf", type: "fill", source: "z", paint: { "fill-color": "#2f6feb", "fill-opacity": est ? 0.08 : 0.16 } });
          mm.addLayer({ id: "zl", type: "line", source: "z", paint: { "line-color": matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light" || document.documentElement.dataset.theme === "dark" ? "#8fb0ff" : "#1f3a87", "line-width": est ? 2 : 2.5, ...(est ? { "line-dasharray": [2, 1.5] } : {}) } });
          if (est) box.insertAdjacentHTML("beforeend", '<span class="ov-mtag">대략 범위 · 경계 미공개</span>');
        } else {
          mm.addSource("p", { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: [r.ll[1], r.ll[0]] }, properties: {} } });
          mm.addLayer({ id: "p", type: "circle", source: "p", paint: { "circle-radius": 8, "circle-color": "#1f3a87", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
        }
      });
      box.onclick = () => { try { closeSheetNow(); } catch (e) {} setTimeout(() => { try { LMX.focus(true); } catch (e) {} }, 250); };
    }).catch(() => box.remove());
  }
  function render(r) {
    const head = document.querySelector("#report .rep-head");
    if (!head || !r || head.querySelector(".ov-top")) return;
    const w = document.createElement("div");
    w.className = "ov-top"; w.id = "ovTop";
    const t0 = r.tx || {};
    const V = verdicts(r);
    w.innerHTML = `<div class="ov-vdw">${vdHTML(V)}</div><div class="ov-map" id="ovMap" role="img" aria-label="${esc(shortName(r.n))} 위치"></div><div class="ov-row"><div class="ov-oldw">${oldHTML(t0, r)}</div><div class="ov-txw">${txHTML(t0, r, null)}</div></div><div class="ov-trw">${trustHTML(r)}</div><div class="ov-tlw">${tlHTML(r)}</div><div class="ov-srcw">${srcHTML(r)}</div>`;
    vdBind(w, V);
    locWhy(head, w, r);
    // 공식 이름(/z/ 페이지 제목과 같은 규칙 · tools/zpages.py short)이 화면 이름과 다르면 한 줄
    try {
      let fn = String(r.n || "").replace(/^\s*(\(가칭\)|\[임시\]|\(임시\))\s*/, "").replace(/\s*(\(가칭\)|\[임시\]|\(임시\))\s*$/, "").replace(/\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)?\s*(정비)?(사업)?\s*(조합|추진위원회|조합설립추진위원회|주민대표회의)?\s*$/, "").trim();
      for (let i = 0; i < 3; i++) fn = fn.replace(/\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)\s*(정비)?(사업|구역)?\s*$/, "").trim();   // '도시정비형 재개발사업' 같은 겹친 꼬리(tools/zpages.py short와 같은 규칙)
      const h2 = head.querySelector("#repTitle");
      const f0 = fn.replace(/\s/g, ""), s0 = shortName(r.n).replace(/\s/g, "");
      if (h2 && fn && f0 !== s0 && !(f0.startsWith(s0) && f0.length - s0.length <= 3) && !head.querySelector(".ov-formal")) h2.insertAdjacentHTML("afterend", `<p class="ov-formal">공식 이름 ${esc(fn)}</p>`);
    } catch (e) {}
    // 주소 줄: 구 동 · 단계 · 역 도보
    const wh = head.querySelector(".where");
    if (wh) { const dong = ((r.j || r.bj || "").match(/^(?:서울(?:특별)?시\s*)?(?:[가-힣]+구\s+)?([가-힣]+?(?:\d+(?:·\d+)*)?(?:동\d+가|로\d+가|\d+가|동|로|가))(?=[\s\d(산]|$)/) || [, r.dg || ""])[1]; const wm = r.st && r.st.d ? Math.max(1, Math.round(r.st.d * 1.3 / 67)) : 0, st = wm ? (wm > 20 ? "역에서 멀어요" : `${r.st.n.replace(/역$/, "")}역 ${wm}분`) : ""; wh.classList.add("ov-w"); wh.removeAttribute("title"); wh.innerHTML = `<b>${esc(r.g)} ${esc(dong)}</b>${st ? `<span class="ov-chip g">${esc(st)}</span>` : ""}${r.lc ? `<span class="ov-chip w">거래 적어 추정</span>` : r.nbp ? `<span class="ov-chip g">주변 시세 기준</span>` : ""}${r.sl && r.sl.k ? `<span class="ov-chip g ov-sl"${r.sl.d != null && isFinite(r.sl.d) ? ` title="고저차 ${Math.round(+r.sl.d)}m"` : ""}>${esc(/경사/.test(r.sl.k) ? (r.sl.k === "경사" ? "경사 있음" : r.sl.k) : "경사 " + r.sl.k)}</span>` : ""}`; }
    const where = head.querySelector(".where");
    (where || head.firstElementChild).after(w);
    w.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; const tb = document.getElementById("tab-" + b.dataset.tab); if (tb) tb.click(); });
    mini(r);
    late(r, w);
    if (!r._prem && FREE) premLoad(r).then(() => late(r, w)).catch(() => {});
    // 착공 뒤: 입주권 거래는 있지만 투기과열지구라 예외 매물만 — 한 줄로
    const rk = head.querySelector(".lb-risk"); if (rk && r.s >= 8) rk.textContent = "착공 구역 · 입주권은 예외 매물만 살 수 있어요";
    Promise.all([ZX.loadTx(), ZX.loadNear ? ZX.loadNear() : null]).then(([d]) => {
      if (cur !== r || !document.getElementById("ovTop")) return;
      const t = { ...(r.tx || {}), ...((d && d[r.id] && d[r.id].x) || {}) };
      const tw = w.querySelector(".ov-txw");
      tw.innerHTML = apt(t, r) || txHTML(t, r, d && d[r.id]);
      const ow = w.querySelector(".ov-oldw");
      if (ow && !ow.innerHTML.trim()) ow.innerHTML = oldHTML(t, r);
    }).catch(() => {});
  }
  // 머리의 '입지 50' 칩: 눌러서 무슨 점수인지 한 줄(판정 줄 설명 자리 재사용)
  function locWhy(head, w, r) {
    const g = head.querySelector(".gb.lb"); if (!g || r.score == null) return;
    const why = w.querySelector(".ov-why");
    g.removeAttribute("title");
    g.setAttribute("role", "button"); g.tabIndex = 0; g.setAttribute("aria-expanded", "false");
    g.setAttribute("aria-label", `입지 점수 ${r.score}점, 100점 만점 · 설명 보기`);
    const tog = () => {
      const on = g.getAttribute("aria-expanded") === "true";
      w.querySelectorAll(".ov-p").forEach((x) => x.setAttribute("aria-expanded", "false"));
      g.setAttribute("aria-expanded", String(!on));
      if (on) { why.hidden = true; return; }
      why.className = "ov-why st";
      why.innerHTML = `입지 ${r.score}/100 · 역·업무지구·한강·호재·생활시설까지 거리로 매긴 서울 구역 비교용 점수예요(투자 등급 아님). <button type="button" class="ov-wl" data-tab="loc">항목별 점수 →</button>`;
      why.hidden = false;
    };
    g.addEventListener("click", (e) => { e.stopPropagation(); tog(); });
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tog(); } });
    w.querySelectorAll(".ov-p").forEach((b) => b.addEventListener("click", () => g.setAttribute("aria-expanded", "false")));
  }
  // 입주 현금 탭 시간표: 사업·일정 탭과 같은 한 값(etaShow · src/app.js)
  function fixGtl(p, r) {
    const gt = p.querySelector(".gtl"); if (!gt) return;
    const e3 = gt.querySelector(".gt3 .gt-w"), e2w = gt.querySelector(".gt2 .gt-w");
    let lab = ""; try { lab = etaShow(r); } catch (e) {}
    if (e3 && lab && !e3.textContent.startsWith(`입주 · ${lab}`)) e3.textContent = `입주 · ${lab}`;
    if (e2w && /시점 미정/.test(e2w.textContent)) e2w.textContent = r.s >= 7 ? "이주 · 진행 중" : "이주 · 관리처분 뒤";
  }
  function tidyPane() {
    const p = document.getElementById("pane"); if (!p || !cur) return;
    const r = cur, apt = /재건축/.test(r.k) || !!(r.tx && r.tx.hd && r.tx.hd.b && r.tx.hd.b !== "v");
    const hideSect = (re) => p.querySelectorAll(".sect, .chk3").forEach((x) => { const h = x.querySelector("h3"); if (h && re.test(h.textContent)) x.hidden = true; });
    if (curTab === "tx" && apt) hideSect(/연식별|필지 현황|최근 전세/);
    if (curTab === "req" && r.s >= 2) hideSect(/구역지정 요건/);
    if (curTab === "near") {
      p.querySelectorAll("table tr").forEach((tr) => { const td = [...tr.querySelectorAll("td")]; if (td.length > 1 && td.slice(1).every((c) => /^\s*[–-]?\s*$/.test(c.textContent))) tr.hidden = true; });
      p.querySelectorAll(".chk3, .lead-card, .leadc, [class*=lead]").forEach((x) => (x.hidden = true));
    }
    if (curTab === "money") try { fixGtl(p, r); } catch (e) {}
    // 입주 현금 탭이 짧아 아래가 비면 '계산 근거 · 숫자 바꿔 보기'를 펼쳐 둔다(한 번만 · 사용자가 접으면 그대로)
    if (curTab === "money") requestAnimationFrame(() => { const pp = document.getElementById("pane"), f = pp && pp.querySelector(".s-fold"); if (!f || f.dataset.auto || cur !== r) return; f.dataset.auto = "1"; if (pp.getBoundingClientRect().height < innerHeight * 0.9) f.open = true; });
    if (curTab === "money" && apt) p.querySelectorAll(".rvj").forEach((x) => (x.hidden = true));
    if (curTab === "req") hideSect(/적용 기준|동의 기준|접도|조례/);
    // 입주 현금 탭이 접힌 근거만 남아 비면, 위 카드의 결론을 한 번 더 크게
    if (curTab === "money") {
      const vis = [...p.children].filter((x) => !x.hidden && getComputedStyle(x).display !== "none" && !x.classList.contains("s-fold"));
      if (!vis.length) { const cs = document.querySelector("#report .rep-head .cstrip"); p.insertAdjacentHTML("afterbegin", `<p class="ov-msg">${cs && cs.classList.contains("gblock") ? "전세 끼고는 살 수 없는 구역이에요. 위 '대출 끼고' 금액을 보세요." : "이 구역은 아직 계산할 자료가 부족해요."}</p>`); }
    }
    p.querySelectorAll("dl.facts > div").forEach((d) => { const t = d.textContent; if (/자료 없음|미공개|계산 불가|일반분양 비율/.test(t)) d.hidden = true; });
  }
  // 탭 막대: 오른쪽에 더 있으면 흐림 + '›'(누르면 넘김), 끝까지 가면 사라짐 · 왼쪽으로 넘긴 뒤엔 왼쪽 흐림
  function tabAff() {
    const tb = document.querySelector("#report .tabs"); if (!tb || tb.dataset.aff) return;
    tb.dataset.aff = "1";
    const nx = document.createElement("span");
    nx.className = "tab-nx"; nx.setAttribute("aria-hidden", "true"); nx.textContent = "›";
    tb.appendChild(nx);
    const upd = () => { nx.style.right = -(parseFloat(getComputedStyle(tb).paddingRight) || 0) + "px"; const m = tb.scrollWidth - tb.clientWidth; tb.classList.toggle("more-r", tb.scrollLeft < m - 4); tb.classList.toggle("more-l", tb.scrollLeft > 4); };
    nx.addEventListener("click", (e) => { e.stopPropagation(); tb.scrollBy({ left: tb.clientWidth * 0.6, behavior: "smooth" }); });
    tb.addEventListener("scroll", upd, { passive: true });
    try { new ResizeObserver(upd).observe(tb); } catch (e) {}
    upd();
    // 고른 탭이 가려져 있으면 보이게
    const sel = tb.querySelector('[aria-selected="true"]'); if (sel && sel.offsetLeft + sel.offsetWidth > tb.scrollLeft + tb.clientWidth - 28) tb.scrollLeft = sel.offsetLeft - 16;
  }
  // 규제 탭 맨 위: 매물진단(66_tools.js)과 같은 판정 목록 · 출처 링크
  function reqBox(r) {
    const p = document.getElementById("pane"); if (!p || typeof TOOLS === "undefined" || !TOOLS.diagItems) return;
    const draw = () => {
      const pp = document.getElementById("pane"); if (!pp || cur !== r || curTab !== "req") return;
      const h = `<div class="sect rq"><h3>사기 전 확인할 규제</h3><ul class="dg-l rq-l">${TOOLS.diagItems(r, draw).map(TOOLS.dgLi).join("")}</ul></div>`;
      const old = pp.querySelector(".rq"); if (old) old.outerHTML = h; else pp.insertAdjacentHTML("afterbegin", h);
    };
    draw();
  }
  // 탭 막대를 시트(또는 화면) 맨 위로: 새 탭 내용의 시작이 막대 바로 아래에 오게
  function tabTop() {
    const tb = document.querySelector("#report .tabs"), pane = document.getElementById("pane"); if (!tb || !pane) return;
    let sc = tb.parentElement;
    while (sc && sc !== document.body) { const o = getComputedStyle(sc).overflowY; if ((o === "auto" || o === "scroll") && sc.scrollHeight > sc.clientHeight + 1) break; sc = sc.parentElement; }
    const doc = !sc || sc === document.body, cs = getComputedStyle(tb);
    const off = cs.position === "sticky" ? parseFloat(cs.top) || 0 : doc ? parseFloat(cs.scrollMarginTop) || 0 : 0;
    const base = doc ? 0 : sc.getBoundingClientRect().top;
    const d = pane.getBoundingClientRect().top - tb.offsetHeight - base - off;
    if (Math.abs(d) < 2) return;
    if (doc) window.scrollBy(0, d); else sc.scrollTop += d;
  }
  // PC: 목록에서 구역을 열면 포커스를 상세 제목으로 · 상세를 닫으면(Esc·목록 버튼) 주소의 #구역id를 지워 새로고침해도 다시 열리지 않게
  function deskFocus() {
    const PC = () => matchMedia("(min-width:981px)").matches;
    const toH = () => requestAnimationFrame(() => requestAnimationFrame(() => { const h = document.getElementById("repTitle"); if (h && h.offsetParent) h.focus({ preventScroll: true }); }));
    document.addEventListener("click", (e) => { if (PC() && e.target.closest && e.target.closest("#sList [data-id]") && !e.target.closest("[data-why]")) toH(); });
    const H = document.documentElement; let was = H.classList.contains("s-rep");
    const clr = () => { try { const id = location.hash.slice(1); if (id && byId[id]) history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {} };
    try { new MutationObserver(() => { const on = H.classList.contains("s-rep"); if (was && !on && PC()) clr(); was = on; }).observe(H, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
  }
  function init() {
    try { deskFocus(); } catch (e) {}
    const _rq = paneReq; paneReq = function (r) { const x = _rq.apply(this, arguments); try { reqBox(r); } catch (e) { console.warn(e); } return x; };
    const _rp = renderPane; renderPane = function () { const x = _rp.apply(this, arguments); try { tidyPane(); } catch (e) {} return x; };
    // 입주 현금 시간표는 첫 렌더·자료 도착 때 다른 경로로도 다시 그려져, 바뀔 때마다 '시점 미정'을 고친다
    let gq = 0;
    try { new MutationObserver(() => { if (gq) return; gq = requestAnimationFrame(() => { gq = 0; const p = document.getElementById("pane"); if (p && cur) try { fixGtl(p, cur); } catch (e) {} }); }).observe(document.getElementById("report"), { childList: true, subtree: true }); } catch (e) {}
    // 탭을 누르면 탭 막대가 위로 오게
    // (부드러운 스크롤은 새 탭 내용 높이가 바뀌며 중간에 멈춰 이전 탭 자리(scrollTop 893 등)에 남았다 → 바로 맞춘다)
    document.addEventListener("click", (e) => { const t = e.target.closest("#report [role=tab]"); if (!t) return; requestAnimationFrame(tabTop); });
    const _rr = renderReport;
    renderReport = function () { const x = _rr.apply(this, arguments); try { tabAff(); } catch (e) {} try { if (cur) { render(cur); if (matchMedia("(min-width:981px)").matches && document.documentElement.classList.contains("simple")) document.documentElement.classList.add("s-rep"); } } catch (e) { console.warn(e); } return x; };
    try { tabAff(); } catch (e) {}
    try { if (cur && document.querySelector("#report .rep-head")) { render(cur); if (matchMedia("(min-width:981px)").matches) document.documentElement.classList.add("s-rep"); } } catch (e) {}
  }
  return { init, render, gauge, smp: smpTxt, manT };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", OVX.init) : setTimeout(OVX.init, 0);
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
    el.querySelectorAll('[role="tab"]').forEach((b) => { const s = b.dataset.tab === t; b.setAttribute("aria-selected", String(s)); b.tabIndex = s ? 0 : -1; });
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
  mk("gapTop", "갭 순위");
  mk("diagTop", "매물진단");
  mk("supplyTop", "입주 물량");
  const e1 = ZF.cash;
  const ok = (r) => !(r.s >= 9) && !r.dn && !r.cx && r.src !== "moa" && !r.lc && r.tag !== "mk";
  // ---------- 갭 순위: 전세 끼고 지금 필요한 돈이 적은 순 ----------
  let gapF = "all", gapN = 20;
  function gapRender() {
    const out = document.getElementById("gapTopOut"); if (!out) return;
    const L = R.filter(ok).map((r) => ({ r, g: gapOf(r) })).filter((x) => !x.g.block && !x.g.na && x.g.now != null && isFinite(x.g.now));
    const c = CASH;
    const F = gapF === "near" ? L.filter((x) => Math.abs(x.g.now - c) <= 1) : gapF === "redev" ? L.filter((x) => !/재건축/.test(x.r.k)) : L;
    // 입주까지 돈이 계산되는 곳을 위로, 신축 시세가 없어 계산 안 되는 곳은 맨 아래로
    const calc = (x) => !!(x.g.x && x.g.x.ok && x.g.total != null);
    F.sort((a, b) => calc(b) - calc(a) || a.g.now - b.g.now);
    { const seen = new Set(); for (let i = F.length - 1; i >= 0; i--) {} const U = []; F.forEach((x) => { const k = shortName(x.r.n) + x.r.g; if (!seen.has(k)) { seen.add(k); U.push(x); } }); F.length = 0; U.forEach((x) => F.push(x)); }
    const rate = (x) => { try { const p = investC(x.r).price; return p ? Math.round((x.g.D / p) * 100) : null; } catch (e) { return null; } };
    out.innerHTML = `<div class="fchips tl-f" role="group" aria-label="거르기">${[["all", "전체"], ["near", `내 현금 ${e1(c)} ±1억`], ["redev", "재개발만"]].map(([k, t]) => `<button type="button" class="ichip" data-gf="${k}" aria-pressed="${gapF === k}">${t}</button>`).join("")}</div>
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
  // 매물진단 판정 목록(구역 리포트 '규제' 탭도 이 함수를 그대로 쓴다): [cls, 항목, 설명, 출처 링크?]
  function diagItems(r, redraw) {
    const items = [], pol = (D && D.policy) || {}, LAW = "https://www.law.go.kr/법령/도시및주거환경정비법";
    const w = buyWindow(r);
    items.push([w.cls === "ok" ? "ok" : w.cls === "no" ? "no" : "warn", "입주권", w.t + (w.due ? ` · ${w.due}` : ""), [LAW + "/제39조", "도정법 제39조"]]);
    // 토허: 서울 전역(아파트)·신통·구역 안 허가 기록·구 단위 기록까지 본 뒤에만 말한다(56_toheo.js). 허가 자료가 오면 다시 그림
    let th = null;
    try { th = TOH.lookup(r); } catch (e) {}
    const lpSrc = ["https://land.seoul.go.kr/", "서울부동산정보광장"];
    if (th) items.push([th.cls, "토지거래허가", th.t, lpSrc]);
    else { const lp = landPermit(r); items.push([lp ? "no" : "warn", "토지거래허가", lp ? lp.t : "허가 기록 불러오는 중 · 계약 전 구청 확인", lpSrc]); }
    try { if (!TOH.loaded() && redraw) TOH.load().then(redraw); } catch (e) {}
    const sp = pol.speculation || {};
    items.push(["warn", "투기과열·조정대상지역", `서울 25개 구 전역 (${(sp.date || "2025-10-16").replaceAll("-", ".")}~)${/강남|서초|송파|용산/.test(r.g) ? ` · ${r.g}는 2017.8.3부터 연속` : ""} · 대출·세금·전매 규제 적용`, [sp.src || "https://www.korea.kr", "정책브리핑"]]);
    try { const rt = ZX.rights(r); items.push([rt.k === "set" ? (rt.c === "low" ? "warn" : "ok") : "warn", "권리산정기준일", rt.k === "set" ? (rt.old ? `${rt.d}(지정일)로 추정 · 서울시 조례 부칙(2010.7.16 이전 지정) 확인 필요` : `${rt.d} 전 준공·등기 건물만 단독 입주권${rt.c === "low" ? " · 추정이라 확인 필요" : ""}`) : rt.k === "chg" ? "확인 필요 · 등록된 구역지정일이 변경 지정일이라 추정하지 않아요" : "날짜 미확정 · 구청 확인", [LAW + "/제77조", "도정법 제77조"]]); } catch (e) {}
    items.push(["warn", "여러 채 보유(다물권)", "한 구역에 여러 채면 원칙적으로 입주권 1개(세대원 합산) · 1+1 분양은 종전 가격·주거전용면적 범위 안에서만(추가 1채는 60㎡ 이하·3년 전매 제한) · 투기과열지구 재건축은 다주택 조합원도 1주택만", [LAW + "/제76조", "도정법 제76조"]]);
    items.push(["warn", "재당첨 제한", "투기과열지구 정비사업에서 조합원 분양을 받은 세대는 5년 동안 다른 투기과열지구 정비사업 분양신청 불가(세대원 포함)", [LAW + "/제72조", "도정법 제72조"]]);
    const rb = /재건축/.test(r.k), lock = rb ? r.s >= 4 : r.s >= 6;
    items.push([lock ? "no" : "ok", "조합원 지위양도", `${rb ? "재건축은 조합설립인가" : "재개발은 관리처분인가"} 뒤 매수는 조합원 승계 불가(10년 보유·5년 거주 1주택 등 예외 매물만) · ${lock ? "지금 이 단계라 예외 매물만" : "지금은 아직 그 전"}`, [LAW + "/제39조", "도정법 제39조"]]);
    return items;
  }
  const dgLi = ([c, k, v, src]) => `<li class="${c}"><i aria-hidden="true">${c === "ok" ? "✓" : c === "no" ? "✕" : c === "na" ? "?" : "!"}</i><span><b>${k}</b><small>${esc(v)}${src ? ` <a href="${esc(src[0])}" target="_blank" rel="noopener">${esc(src[1])} ↗</a>` : ""}</small></span></li>`;
  function diagShow(ex) {
    const r = dSel, box = document.getElementById("dgR"); if (!r || !box) return;
    const items = diagItems(r, () => { if (dSel === r) diagShow(ex); });
    box.innerHTML = `${ex ? '<p class="dg-ex">예시로 한 곳을 보여 드려요 · 구역 이름으로 다른 곳을 찾아 보세요</p>' : ""}<div class="dg-h"><b>${esc(shortName(r.n))}</b><span>${esc(r.g)} · ${esc(stageName(r))}</span><button type="button" class="btn text sm" data-open="${r.id}">구역 보기 →</button></div>
      <ul class="dg-l">${items.map(dgLi).join("")}</ul>`;
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
/* ===================== 앱(PWA·홈 화면 설치) 대응 =====================
   - 홈 화면 앱으로 열리면(display-mode: standalone 또는 ?src=app) html.is-app
   - 오프라인 안내 토스트
   - 서비스 워커 등록(https 또는 localhost, load 이후) */
(() => {
  const H = document.documentElement;
  const mq = (q) => { try { return matchMedia(q).matches; } catch (_) { return false; } };
  let fromApp = false;
  try { fromApp = new URLSearchParams(location.search).get("src") === "app"; } catch (_) {}
  try { if (fromApp) sessionStorage.setItem("isApp", "1"); else fromApp = sessionStorage.getItem("isApp") === "1"; } catch (_) {}
  const standalone = () => mq("(display-mode: standalone)") || mq("(display-mode: fullscreen)") || mq("(display-mode: minimal-ui)") || navigator.standalone === true;
  const mark = () => H.classList.toggle("is-app", fromApp || standalone());
  mark();
  try { matchMedia("(display-mode: standalone)").addEventListener("change", mark); } catch (_) {}

  // 오프라인 토스트: 조용히 잠깐 보였다 사라진다
  let el = null, tm = 0;
  const toast = (msg, ms) => {
    if (!document.body) return;
    if (!el) {
      el = document.createElement("div");
      el.className = "app-toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(tm); tm = setTimeout(() => el.classList.remove("on"), ms);
  };
  addEventListener("offline", () => { H.classList.add("is-offline"); toast("오프라인이에요 · 저장된 자료로 보여요", 4200); });
  addEventListener("online", () => { if (!H.classList.contains("is-offline")) return; H.classList.remove("is-offline"); toast("다시 연결됐어요", 1800); });
  const boot = () => { if (navigator.onLine === false) { H.classList.add("is-offline"); toast("오프라인이에요 · 저장된 자료로 보여요", 4200); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();

  // 화면 읽기: 결과 목록 전체(#maxBox·#cmOut)를 다시 읽지 않고 곳 수 한 줄만 알린다(바뀐 뒤 잠깐 쉬었을 때 한 번)
  const liveSum = (srcId, outId, pick) => {
    const src = document.getElementById(srcId), out = document.getElementById(outId); if (!src || !out) return;
    let t = 0, last = "";
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => {
      if (!src.offsetParent) return;
      const s = (pick() || "").replace(/\s+/g, " ").trim();
      if (s && s !== last) { last = s; out.textContent = s; }
    }, 700); }).observe(src, { childList: true, subtree: true });
  };
  const liveBoot = () => {
    liveSum("maxBox", "maxLive", () => { const q = document.getElementById("qAns"); return q && q.firstElementChild ? q.firstElementChild.textContent : ""; });
    liveSum("cmOut", "cmLive", () => { const p = document.querySelector("#cmOut .cm-sum p"); return p ? p.textContent : ""; });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", liveBoot, { once: true }); else liveBoot();

  // 서비스 워커: 안전한 출처에서만, 첫 화면을 다 그린 뒤에
  const okHost = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && okHost) {
    // 핀 꽂은 구역의 /z 페이지는 미리 받아 둔다(오프라인에서 핀 → 구역 페이지)
    const keepPins = () => navigator.serviceWorker.ready.then((r) => { try { const ids = (window.PINS && PINS.list()) || []; if (r.active && ids.length) r.active.postMessage({ t: "keep", u: ids.slice(0, 40).map((id) => "/z/" + encodeURIComponent(id)) }); } catch (_) {} }).catch(() => {});
    const reg = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(() => { keepPins(); try { window.PINS && PINS.on(keepPins); } catch (_) {} }).catch(() => {});
    if (document.readyState === "complete") setTimeout(reg, 1500); else addEventListener("load", () => setTimeout(reg, 1500), { once: true });
  }
})();
/* ===================== 홈 화면에 추가 안내 =====================
   - 모바일 브라우저(앱으로 이미 열린 경우 제외)에서만
   - 때: 세 번째 방문(첫 핀 직후는 72_inbox 알림 시트가 ZP_INSTALL로 함께 권한다)
   - 안드로이드·크롬: 설치 창(beforeinstallprompt) / iOS 사파리: '공유 → 홈 화면에 추가' 안내
   - 닫으면 30일 동안 다시 안 띄움 */
(() => {
  const K = "zp-inst", H = document.documentElement;
  const get = () => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch (e) { return {}; } };
  const put = (o) => { try { localStorage.setItem(K, JSON.stringify(Object.assign(get(), o))); } catch (e) {} };
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const inApp = /KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|Line\//i.test(ua);
  const mobile = () => { try { return matchMedia("(max-width:980px)").matches && matchMedia("(pointer:coarse)").matches; } catch (e) { return false; } };
  let deferred = null, shown = false;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; });
  addEventListener("appinstalled", () => { put({ done: 1 }); hide(); });
  const allowed = () => {
    if (H.classList.contains("is-app") || !mobile() || inApp) return false;
    const s = get(); if (s.done) return false;
    if (s.no && Date.now() - s.no < 30 * 864e5) return false;
    return ios || !!deferred;
  };
  let el = null;
  function hide() { if (el) { el.classList.remove("on"); setTimeout(() => el && (el.hidden = true), 250); } }
  function show(why) {
    if (shown || !allowed()) return; shown = true;
    if (!el) {
      el = document.createElement("div"); el.className = "zi"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "홈 화면에 집핀 추가");
      document.body.appendChild(el);
      el.addEventListener("click", async (e) => {
        if (e.target.closest("[data-zix]")) { put({ no: Date.now() }); return hide(); }
        if (e.target.closest("[data-zio]") && deferred) {
          try { deferred.prompt(); const r = await deferred.userChoice; if (r && r.outcome === "accepted") put({ done: 1 }); else put({ no: Date.now() }); } catch (_) {}
          deferred = null; hide();
        }
      });
    }
    const lead = why === "pin" ? "핀을 저장했어요. 앱처럼 바로 열어 보세요" : "자주 오시네요. 앱처럼 바로 열어 보세요";
    el.innerHTML = `<img src="/icon-192.png" alt="" width="40" height="40"><div class="zi-t"><b>홈 화면에 집핀 추가</b><span>${lead}</span>` +
      (ios ? `<span class="zi-ios">아래 <svg viewBox="0 0 24 24" width="15" height="15" aria-label="공유"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 공유 → <b>홈 화면에 추가</b></span>` : "") +
      `</div>${ios ? "" : `<button type="button" class="zi-go" data-zio>추가</button>`}<button type="button" class="zi-x" data-zix aria-label="닫기">✕</button>`;
    el.hidden = false; requestAnimationFrame(() => el.classList.add("on"));
  }
  // 다른 화면(알림 시트)에서 쓰는 설치 도우미: can() 설치를 권할 수 있나 · prompt() 안드로이드 설치 창(true=설치함) · ios
  window.ZP_INSTALL = {
    ios, inApp,
    app: () => H.classList.contains("is-app") || (() => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } })(),
    can: () => !window.ZP_INSTALL.app() && !inApp && !get().done && (ios || !!deferred),
    prompt: async () => { if (!deferred) return false; try { deferred.prompt(); const r = await deferred.userChoice; deferred = null; if (r && r.outcome === "accepted") { put({ done: 1 }); return true; } } catch (_) {} return false; },
    seen: () => { shown = true; },
  };
  const boot = () => {
    const s = get(), n = (s.v || 0) + 1; put({ v: n });
    if (n >= 3) setTimeout(() => show("visit"), 9000);
    // 핀을 꽂은 직후 안내는 72_inbox의 '알림 받을 준비' 시트가 함께 한다(ZP_INSTALL로 설치 창을 띄움)
  };
  document.readyState === "complete" ? setTimeout(boot, 0) : addEventListener("load", () => setTimeout(boot, 0), { once: true });
})();
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
    // 최근 소식 한 줄(data/changes.json: 실거래·단계·고시·경매)
    let ev = "";
    try { if (typeof INBOX !== "undefined") { const e = INBOX.evOf(r.id)[0]; if (e) { const [tl, tc] = INBOX.TY[e.type]; ev = `<small class="pn-ev"><i class="ib-tg ${e.hi ? "hi" : tc}">${e.hi ? "신고가" : tl}</i><span>${esc(INBOX.dLabel(e.date).replace(/ \(.\)$/, ""))} · ${esc(e.text)}</span></small>`; } } } catch (e) {}
    // 꽂을 때와 지금 방식이 다르면 '꽂을 때'는 그 방식 값끼리 비교(라벨에 방식 표시)
    // 방식이 다르면: '전세 3.2→2.4억'(꽂을 때 방식 값끼리)
    const then = salt ? `<span class="pn-alt">${sm === "gap" ? "전세" : "대출"}</span>${sp.now != null ? e2(sp.now) : "–"}→<b class="pn-cmpv${d == null ? "" : d > 0 ? " up" : " dn"}">${n.cmp != null ? `${e2(n.cmp)}억` : "–"}</b>` : `꽂을 때 ${sp.now != null ? `${e2(sp.now)}억` : "–"}`;
    const main = `<span class="pn-pin">${pinY(26)}${nw ? '<i class="pn-new" aria-hidden="true"></i>' : ""}</span>
      <span class="pn-nm"><b>${esc(shortName(r.n))}</b><small>${sub}${nw ? '<span class="sr-only"> · 새 소식</span>' : ""}</small>${riskH(r) ? `<small class="pn-rk">${riskH(r)}</small>` : ""}${ev}${sp.memo ? `<small class="pn-memo">${esc(sp.memo)}</small>` : ""}</span>
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
      : `${sumHTML(L)}<div class="pn-h"><p><b>관심 구역 ${L.length}곳</b>${nw ? `<span class="pn-nwn">새 소식 ${nw}곳</span>` : ""}</p><div class="pn-ha">${L.length >= 2 ? '<button type="button" class="btn secondary sm" id="pnCmp">비교</button>' : ""}<button type="button" class="btn secondary sm" id="pnShare">카드로 공유</button></div></div>
      <div class="pn-tools"><div class="pn-sort" role="group" aria-label="정렬">${srt}</div><label class="pn-money"><input type="checkbox" id="pnMoney"${MONEY ? " checked" : ""}>공유 이미지에 금액 넣기</label></div>`;
    return `${top}${condHTML()}<p class="pn-base">오른쪽은 ${gapMode() ? "전세 끼고" : "대출 끼고"} 지금 살 때 필요한 돈 · 내 현금 ${e2(CASH)}억 기준 · 꽂은 날과 비교</p><div class="pn-list" role="list" aria-label="내 핀 목록">${L.map(rowHTML).join("")}</div><span class="share-fb" id="pnShareFb" role="status"></span>${SEL ? "" : moveHTML(L.length)}`;
  }
  // 관심 구역 요약 카드: 관심 구역 N곳 · 이번 주 소식 N건 · 살 수 있게 된 곳 N곳 + 이번 주 요약(구역별 소식 묶음)
  let DIG = false;
  function sumHTML(L) {
    const has = typeof INBOX !== "undefined";
    if (has && !INBOX.ready()) INBOX.load().then(() => { if (!SEL && $("fvOut") && $("fvOut").querySelector(".pn-sum")) renderFav(); });
    const W = has && INBOX.ready() ? INBOX.week() : [], okN = L.filter((n) => n.b.some((x) => x.k === "ok")).length;
    const by = new Map(); W.forEach((e) => { if (!by.has(e.id)) by.set(e.id, []); by.get(e.id).push(e); });
    const dig = DIG ? `<ul class="pn-dg" id="pnDg" aria-label="이번 주 요약">${by.size ? [...by].map(([id, E]) => { const r = byId[id], c = {}; E.forEach((e) => { const t = e.hi ? "신고가" : INBOX.TY[e.type][0]; c[t] = (c[t] || 0) + 1; }); return `<li><button type="button" data-open="${id}"><b>${esc(shortName(r.n))}</b><span class="pn-dgc">${Object.entries(c).map(([t, k]) => `${t} ${k}`).join(" · ")}</span><small>${esc(E[0].text)}</small></button></li>`; }).join("") : '<li class="pn-dg0">이번 주에는 새 소식이 없어요</li>'}</ul>` : "";
    return `<div class="pn-sum"><div class="pn-sum-n"><span><b>${L.length}<i>곳</i></b><small>관심 구역</small></span><span><b>${has && INBOX.ready() ? W.length : "–"}<i>건</i></b><small>이번 주 소식</small></span><span class="${okN ? "ok" : ""}"><b>${okN}<i>곳</i></b><small>살 수 있게 됨</small></span></div><button type="button" class="pn-sum-dg" id="pnDgB" aria-expanded="${DIG}" aria-controls="pnDg">${DIG ? "이번 주 요약 접기" : "이번 주 요약 보기"}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="${DIG ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"}"/></svg></button>${dig}</div>`;
  }
  // 다른 기기로 옮기기: 핀·메모·목표·꽂을 때 값·조건 핀을 압축해 주소(#pins=)에 담아 복사(로그인 불필요)
  const moveHTML = (n) => { const m = FAV.filter((id) => SNAP[id] && SNAP[id].memo).length; return `<div class="pn-move"><div><b>다른 기기로 옮기기</b><small>다른 폰·PC에서 열면 ${josa(`관심 구역 ${n}곳${CONDS.length ? ` · 알림 조건 ${CONDS.length}개` : ""}${m ? ` · 메모` : ""}`, "을", "를")} 그대로 가져와요</small></div><button type="button" class="btn secondary sm" id="pnMove">링크 복사</button><span class="share-fb" id="pnMoveFb" role="status"></span></div>`; };
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
  const emptyHTML = () => `<div class="x-empty pn-empty">${pinY(36)}<p><b>아직 관심 구역이 없어요</b><br>구역에서 <b>핀 꽂고 알림 받기</b>를 누르면 새 실거래·단계·경매 소식과 필요한 돈 변화를 모아 알려 드려요</p><button type="button" class="btn primary sm" id="pnEmptyGo">지도에서 고르기</button></div>${condHTML()}`;
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
    if (on) toast("핀 꽂음 · 소식이 생기면 알려 드려요", "실행 취소", () => { if (isFav(id)) quiet(() => toggleFav(id)); toast("핀 뺐어요", "", null, nm); }, `${nm} · 관심 구역 ${FAV.length}곳`);
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
    if (hf) { hf.setAttribute("aria-label", `관심 구역${FAV.length ? ` ${FAV.length}곳` : ""}${n ? ` · 새 소식 ${n}곳` : ""}`); }
    relabel();
    const nb = document.querySelector('#sNav [data-nav="fav"]');
    if (nb) {
      let i = nb.querySelector(".pn-nb");
      if (!i) { i = document.createElement("b"); i.className = "pn-nb"; i.setAttribute("aria-hidden", "true"); nb.appendChild(i); }
      i.hidden = !n; i.textContent = nTxt(n);
      nb.setAttribute("aria-label", `관심 구역${n ? `, 새 소식 ${n}곳` : ""}`);
    }
    condBtn();
    // 앱 아이콘 숫자는 알림함(72_inbox paint)이 종 숫자와 같게 맞춘다
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
      ? `<b>관심 구역 ${U.length}곳에 새 소식</b> · ${esc(shortName(f.r.n))} ${esc(f.b[0].h)}${cn && cn.add.length ? ` · 살 수 있는 새 구역 ${freshIds().length || newIds().length}` : ""}`
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
      const sp = nb.querySelector("span"); if (sp) sp.textContent = "관심 구역";
      const sv = nb.querySelector("svg"); if (sv) sv.innerHTML = pinLine;
    }
    const tl = document.querySelector('#sTiles [data-view="favTop"]');
    if (tl && !tl.dataset.pin) {
      tl.dataset.pin = "1";
      const b = tl.querySelector("b"), sm = tl.querySelector("small"), sv = tl.querySelector("svg");
      if (b) b.textContent = "관심 구역"; if (sm) sm.textContent = "새 소식·알림"; if (sv) sv.innerHTML = pinLine;
    }
    // 머리 링크·화면 제목: '내 핀' → '관심 구역'(핀 = 지켜보기)
    const hl = document.querySelector("#huFav .hu-l"); if (hl && hl.textContent !== "관심 구역") hl.textContent = "관심 구역";
    const ft = $("fvT"); if (ft && !ft.dataset.pin) { ft.dataset.pin = "1"; ft.textContent = "내 관심 구역"; const p = ft.parentElement && ft.parentElement.querySelector("p"); if (p) p.textContent = "핀 꽂은 구역의 새 실거래·단계·경매 소식과 필요한 돈 변화를 모아 봐요. 소식이 생기면 알려 드려요."; }
    return !!nb;
  }

  // ---------- 내 핀 지도 이미지(1080×1350) ----------
  function mapCard(money) {
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), F = (w, s) => `${w} ${s}px "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#1f3a87"); gr.addColorStop(1, "#142659");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const L = all().filter((n) => n.r);
    g.fillStyle = "rgba(255,255,255,.65)"; g.font = F(600, 36); g.fillText("집핀 · 내 관심 구역", 80, 120);
    g.fillStyle = "#fff"; g.font = F(800, 84); g.fillText(`관심 구역 ${L.length}곳`, 80, 222);
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
    await EXTRA.shareCv(mapCard(MONEY), "zippin_my_pins.png", "내 관심 구역", `내 관심 구역 ${FAV.length}곳 · 소식이 생기면 알려 주는 집핀 https://jaegaebal.alwaysquestions.kr/`, fb);
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
    return `<section class="pc-wrap" aria-labelledby="pcT"><div class="pc-hd"><h3 id="pcT">알림 조건</h3><small>이 돈으로 살 수 있는 곳이 새로 생기면 알려 드려요</small></div>${pwaHint()}<div class="pc-cards">${L.map((n) => {
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
      ? `<h3 id="pcST">알림 조건은 ${CMAX}개까지예요</h3><p>하나를 지우고 다시 저장해 주세요.</p><div class="pn-old">${CONDS.map((x) => `<button type="button" data-cdel2="${x.id}">${pinY(18)}<span><b>${esc(x.name)}</b><small>${esc(condSum(x))}</small></span><em>지우기</em></button>`).join("")}</div><div class="pc-btns"><button type="button" class="btn secondary sm" data-cx>닫기</button></div>`
      : `<h3 id="pcST">${edit ? "알림 조건 바꾸기" : "이 조건으로 알림 받기"}</h3><div class="pc-cashf"><div class="pc-cin"><label for="pcCash">내 현금</label><span class="pc-cbox"><button type="button" data-cstep="-0.5" aria-label="0.5억 줄이기">−</button><input id="pcCash" data-ccash inputmode="decimal" autocomplete="off" aria-describedby="pcCErr" value="${Math.round(c.cash * 100) / 100}"><i aria-hidden="true">억</i><button type="button" data-cstep="0.5" aria-label="0.5억 늘리기">+</button></span><small class="pc-cerr" id="pcCErr" data-cerr role="alert" hidden></small></div><div class="pc-mode" role="group" aria-label="사는 방법"><button type="button" data-cmode="gap" aria-pressed="${c.mode === "gap"}">전세 끼고</button><button type="button" data-cmode="cash" aria-pressed="${c.mode !== "gap"}">대출 끼고</button></div></div>
        <label class="pc-nm"><span>이름</span><input data-cn maxlength="30" value="${esc(c.name || autoName(c))}" placeholder="${esc(autoName(c))}"></label>
        <div data-cchips>${chips()}</div>
        <p class="pc-cnt" data-ccnt aria-live="polite">${cnt()}</p>
        <p class="pc-why">새로 살 수 있게 된 곳·경매 물건이 생기면 알려 드려요</p>
        <div class="pc-btns"><button type="button" class="btn secondary sm" data-cx>그만두기</button><button type="button" class="btn primary sm" data-csave>${edit ? "저장" : "알림 켜기"}</button></div>`;
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
        toast(edit ? "알림 조건 바꿨어요" : "알림 켰어요", edit ? "" : "관심 구역에서 보기", edit ? null : openView, `${nm} · ${fmt(ids.length)}곳`);
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
      b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", `${r ? shortName(r.n) : ""} ${on ? "핀 빼기" : "핀 꽂고 알림 받기"}`);
      b.innerHTML = fb.innerHTML; return b;
    };
    // 폰 시트: 위에 붙는 닫기 줄(스크롤해도 늘 보임). PC: 제목 줄
    const bar = rep.querySelector(".sheet-bar"), x = $("sheetClose");
    if (bar && x && !bar.querySelector(".pn-hpin")) bar.insertBefore(mk(), x);
    const t = rep.querySelector(".rep-t");
    if (t && !t.querySelector(".pn-hpin")) { const gb = t.lastElementChild && t.lastElementChild !== t.firstElementChild ? t.lastElementChild : null; gb ? t.insertBefore(mk(), gb) : t.appendChild(mk()); }
  }

  // 홈 게이지 아래 알림 버튼(예전 '이 조건으로 핀 꽂기'·'조건 핀 N개' 두 알약 대신 하나):
  //  지금 게이지(현금·방식·유형·출퇴근)와 같은 알림 조건이 없으면 '이 돈으로 살 수 있는 곳 생기면 알려 줘' → 누르면 바로 조건 저장
  //  있으면 '알림 켜짐 · 새 구역 N곳 →'(N = 홈·내 핀 배지와 같은 freshIds 기준) → 알림함
  const sameCond = () => { const k = ckey(curCond()); return CONDS.find((c) => ckey(c) === k) || null; };
  const BELL_D = '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>';
  const bellI = (s2 = 20) => `<svg width="${s2}" height="${s2}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${BELL_D}</svg>`;
  function quickCond() {
    if (!isMember()) { try { mbOpen("fav"); } catch (e) {} return; }
    if (CONDS.length >= CMAX) return condSheet();   // 3개 꽉 참: 하나 지우고 저장하는 시트
    const c = curCond(), ids = evalCond(c), nm = autoName(c);
    const x = Object.assign({}, c, { id: "c" + Date.now().toString(36), name: nm, base: ids, sv: snapVals(c, ids), at: Date.now(), seen: "", asOf: D.upd || D.asOf });
    CONDS.push(x); saveC(); renderFav(); badges(); emit();
    try { navigator.vibrate && navigator.vibrate(10); } catch (e) {}
    toast("알림 켰어요", "조건 바꾸기", () => condSheet(CONDS.find((y) => y.id === x.id)), `${nm} · 지금 ${fmt(ids.length)}곳`);
    try { if (typeof INBOX !== "undefined") setTimeout(() => INBOX.watch("cond"), 900); } catch (e) {}
  }
  function condBtn() {
    const hero = $("sHero"); if (!hero) return;
    let w = $("pcSave"); const g0 = document.querySelector(".s-gauge");
    if (!w) {
      w = document.createElement("div"); w.id = "pcSave"; w.className = "pc-save pc-alert";
      w.innerHTML = `<button type="button" class="pc-al"></button>`;
      w.firstElementChild.onclick = () => {
        const sc = sameCond();
        if (!sc) return quickCond();
        const n = condNews(sc), f = freshIds().length;
        if ((f || n.add.length) && typeof INBOX !== "undefined") return INBOX.open();
        openView(); setTimeout(() => { const h = $("pcT"); if (h) { h.scrollIntoView({ block: "start", behavior: "auto" }); h.tabIndex = -1; h.focus({ preventScroll: true }); } }, 120);
      };
      g0 ? g0.after(w) : hero.appendChild(w);
    } else if (g0 && w.previousElementSibling !== g0 && !(w.previousElementSibling && w.previousElementSibling.id === "pcAct")) g0.after(w);
    const b = w.firstElementChild, sc = sameCond();
    if (!sc) {
      b.classList.remove("on");
      b.innerHTML = `<span class="pc-al-i">${bellI(20)}</span><span class="pc-al-t"><b>이 돈으로 살 수 있는 곳 생기면 알려 줘</b><small>새 구역·가격 하락·경매 물건 등장 시 알림</small></span><span class="pc-al-go">알림 받기</span>`;
      b.setAttribute("aria-label", "이 돈으로 살 수 있는 곳 생기면 알려 줘 — 새 구역·가격 하락·경매 물건 등장 시 알림");
      return;
    }
    const n = condNews(sc), sn = new Set(String(sc.seen || "").split("/")[0].split(",").filter(Boolean)), f = n.add.filter((id) => !sn.has(id)).length, N = f || n.add.length;
    b.classList.add("on");
    b.innerHTML = `<span class="pc-al-i">${bellI(20)}</span><span class="pc-al-t"><b>알림 켜짐${N ? ` · 새 구역 ${N}곳` : ""}</b><small>${N ? `${esc(sc.name)} · ${f ? "아직 안 본 곳" : "새로 살 수 있게 된 곳"}` : `지금 ${fmt(n.ids.length)}곳 · 새로 생기면 알려 드려요`}</small></span><span class="pc-al-go">${N ? "보기" : "알림 조건"} →</span>`;
    b.setAttribute("aria-label", `알림 켜짐${N ? `, 새 구역 ${N}곳 보기` : ", 알림 조건 보기"}`);
  }
  const newIds = () => [...new Set(condsAll().flatMap((n) => n.add))];
  // 본 적 없는 새 구역만: seen(마지막으로 본 sig)의 '새로 들어온' id 목록을 빼고 센다
  // 알림함(72_inbox)에서 조건 핀 새 구역을 보여 줬을 때: 조건 핀만 '읽음'(핀 소식 배지는 그대로)
  function markCondSeen() { let ch = 0; condsAll().forEach((n) => { if (n.c.seen !== n.sig) { n.c.seen = n.sig; ch = 1; } }); if (ch) { saveC(); badges(); } }
  const freshIds = () => [...new Set(condsAll().flatMap((n) => { const sn = new Set(String(n.c.seen || "").split("/")[0].split(",").filter(Boolean)); return n.add.filter((id) => !sn.has(id)); }))];

  // ---------- 화면 이벤트 ----------
  function onClick(e) {
    const t = e.target.closest && e.target.closest("[data-capply],[data-cedit],[data-cdel],[data-crebase],[data-psort],[data-pedit],[data-pgoal],[data-punpin],#pnCmp,#pnSelX,#pnGo,#pnShare,#pnEmptyGo,#pnCmpX,#pnMove,#pnDgB");
    if (!t) return;
    const cf = (id) => CONDS.find((x) => x.id === id);
    if (t.dataset.capply) { const c = cf(t.dataset.capply); if (c) applyCond(c); return; }
    if (t.dataset.cedit) { const c = cf(t.dataset.cedit); if (c) condSheet(c); return; }
    if (t.dataset.cdel) { const c = cf(t.dataset.cdel); CONDS = CONDS.filter((x) => x.id !== t.dataset.cdel); saveC(); renderFav(); badges(); emit(); if (c) toast("알림 조건 지웠어요", "되돌리기", () => { if (CONDS.length < CMAX) { CONDS.push(c); saveC(); renderFav(); badges(); emit(); } }, c.name); return; }
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
    if (t.id === "pnDgB") { DIG = !DIG; renderFav(); const b = $("pnDgB"); b && b.focus(); return; }
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
    // 현금·방식·유형을 바꾸면 홈 알림 버튼(켜짐/알려 줘)을 다시
    let cbT = 0; const cbLater = () => { clearTimeout(cbT); cbT = setTimeout(() => { try { condBtn(); } catch (e) {} }, 150); };
    document.addEventListener("input", (e) => { if (e.target && (e.target.id === "sCash" || e.target.id === "pCash")) cbLater(); }, true);
    document.addEventListener("change", (e) => { if (e.target && (e.target.id === "sCash" || e.target.id === "pCash")) cbLater(); }, true);
    document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest(".s-mode button,.s-flt button,.s-ticks,#sSum")) cbLater(); }, true);
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
  const TY = { stage: ["단계", "st"], trade: ["실거래", "tr"], notice: ["고시·공고", "nt"], auction: ["경매", "au"] };

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
  const unreadC = (e) => { const s = seen(); return e.date > s.at || (e.date === s.at && !s.k.includes(e.k)); };
  // 알림 조건에 맞는 구역의 경매(핀 꽂은 구역은 핀 소식으로 이미 셈)
  const condAuc = () => { if (!CH) return []; const P = new Set(pinIds()), out = new Map(); conds().forEach((n) => { const I = new Set(n.ids), d0 = day(n.c.at || 0); CH.items.forEach((e) => { if (e.type === "auction" && I.has(e.id) && !P.has(e.id) && byId[e.id] && e.date >= d0) out.set(e.k, e); }); }); return [...out.values()]; };
  const count = () => pinEvents().filter(unread).length + freshN() + condAuc().filter(unreadC).length;
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
    // 홈 화면 앱 아이콘 숫자(설치한 앱에서만 보임) = 종 숫자. 알림함을 열면 0으로 지워진다
    try { if (installed() && navigator.setAppBadge && (!CH ? false : true)) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) {}
  }
  const installed = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } };

  // ---------- 알림함 시트 ----------
  const dLabel = (d) => { const t = day(); if (d === t) return "오늘"; if (d === addDay(t, -1)) return "어제"; const x = new Date(d + "T00:00:00Z"); return `${x.getUTCMonth() + 1}.${x.getUTCDate()} (${"일월화수목금토"[x.getUTCDay()]})`; };
  function condHTML() {
    const A = CH ? CH.items.filter((e) => e.type === "auction" && byId[e.id]) : [], P = new Set(pinIds());
    const L = conds().map((n) => { const I = new Set(n.ids); return Object.assign(n, { au: A.filter((e) => I.has(e.id) && !P.has(e.id) && e.date >= day(n.c.at || 0)) }); }).filter((n) => n.add.length || n.au.length);
    if (!L.length) return "";
    const F = new Set(freshN() ? PINS.freshIds() : []);
    return `<section class="ib-sec" aria-labelledby="ibCT"><h4 id="ibCT">이 돈으로 살 수 있는 곳 알림</h4>${L.map((n) => {
      const f = n.add.filter((id) => F.has(id)).length;
      const au = n.au.slice(0, 3).map((e) => { const r = byId[e.id], nw = unreadC(e); return `<li><button type="button" class="ib-it${nw ? " new" : ""}" data-open="${e.id}"><span class="ib-tg au">경매</span><span class="ib-tx"><b>${esc(shortName(r.n))}</b><small>${esc(e.text)}</small></span>${nw ? '<i class="ib-dot" aria-label="새 소식"></i>' : ""}</button></li>`; }).join("");
      return `<div class="ib-cond"><p class="ib-ch"><b>${esc(n.c.name)}</b>${f ? `<em class="pc-nb">+${f} 새 구역</em>` : n.add.length ? `<small>새로 들어온 곳 ${n.add.length}곳</small>` : ""}</p><ul>${au}${n.add.slice(0, 5).map((id) => { const r = byId[id]; if (!r) return ""; let wy = ""; try { wy = PINS.whyNew(n.c, id); } catch (e) {} return `<li><button type="button" class="ib-it${F.has(id) ? " new" : ""}" data-open="${id}"><span class="ib-tg cd">조건</span><span class="ib-tx"><b>${esc(shortName(r.n))}</b><small>${esc(stageName(r))}${wy ? ` · ${esc(wy)}` : ""}</small></span>${F.has(id) ? '<i class="ib-dot" aria-label="새 소식"></i>' : ""}</button></li>`; }).join("")}${n.add.length > 5 ? `<li class="ib-more">외 ${n.add.length - 5}곳 · 내 핀 화면에서 모두 보기</li>` : ""}</ul></div>`;
    }).join("")}</section>`;
  }
  function pinHTML() {
    const P = pinIds();
    if (!P.length) return conds().length ? "" : `<div class="ib-empty">${bellSvg(30)}<p><b>관심 구역 소식을 여기 모아 드려요</b><br>구역에서 '핀 꽂고 알림 받기'를 누르면 새 실거래·단계·경매 소식을 알려 드려요</p><button type="button" class="btn primary sm" data-ibmap>지도에서 구역 고르기</button></div>`;
    if (!CH) return `<p class="ib-note">소식을 불러오는 중이에요…</p>`;
    const E = pinEvents();
    if (!E.length) return `<section class="ib-sec" aria-labelledby="ibPT"><h4 id="ibPT">관심 구역 소식</h4><p class="ib-note">최근 30일 동안 관심 구역 ${P.length}곳에 새 소식이 없어요</p></section>`;
    const by = new Map(); E.slice(0, 80).forEach((e) => { if (!by.has(e.date)) by.set(e.date, []); by.get(e.date).push(e); });
    return `<section class="ib-sec" aria-labelledby="ibPT"><h4 id="ibPT">관심 구역 소식</h4>${[...by].map(([d, L]) => `<h5 class="ib-d">${dLabel(d)}</h5><ul>${L.map((e) => { const r = byId[e.id], [tl, tc] = TY[e.type], nw = unread(e); return `<li><button type="button" class="ib-it${nw ? " new" : ""}" data-open="${e.id}"><span class="ib-tg ${e.hi ? "hi" : tc}">${e.hi ? "신고가" : tl}</span><span class="ib-tx"><b>${esc(shortName(r.n))}</b><small>${esc(e.text)}</small></span>${nw ? '<i class="ib-dot" aria-label="새 소식"></i>' : ""}</button></li>`; }).join("")}</ul>`).join("")}</section>`;
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
    if (isOn() && perm === "granted") return `<div class="ib-push on" role="group" aria-label="폰 알림">${bellSvg(18)}<span><b>폰 알림 켜짐</b><small>매일 아침 관심 구역·알림 조건에 새 소식이 있으면 알려 드려요</small></span><button type="button" class="btn text sm" data-iboff>끄기</button></div>`;
    if (perm === "denied") return `<div class="ib-push" role="group" aria-label="폰 알림">${bellSvg(18)}<span><b>알림이 막혀 있어요</b><small>브라우저 사이트 설정에서 알림을 허용하면 켤 수 있어요</small></span></div>`;
    return `<div class="ib-push" role="group" aria-label="폰 알림">${bellSvg(18)}<span><b>새 소식을 폰 알림으로 받기</b><small>${PMSG ? esc(PMSG) : "새 실거래·단계·경매, 살 수 있게 된 곳"}</small></span><button type="button" class="btn primary sm" data-ibon>알림 받기</button></div>`;
  }
  const u8 = (s) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  const b64 = (buf) => { const a = new Uint8Array(buf); let s = ""; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const swReady = (ms = 8000) => Promise.race([navigator.serviceWorker.getRegistration("/").then((r) => r || navigator.serviceWorker.register("/sw.js", { scope: "/" })).then(() => navigator.serviceWorker.ready), new Promise((_, no) => setTimeout(() => no(new Error("sw")), ms))]);
  const payload = (sub) => ({ sub: sub.toJSON(), zones: pinIds().slice(0, 20), conds: conds().map((n) => ({ n: n.c.name, cash: n.c.cash, mode: n.c.mode, gu: n.c.gu || "", kind: n.c.kind || "", minS: n.c.minS || 0, z: n.ids.slice(0, 150) })) });
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

  // ---------- '알림 받을 준비' 시트: 첫 핀·첫 알림 조건 뒤에 한 번 ----------
  // 무엇을 알려 주는지 + 알림 받기(웹 푸시, 서버가 켜져 있을 때) + 앱 설치(안드로이드 설치 창 / iOS 홈 화면에 추가 안내)
  let prevN = -1;
  const IC = {
    tr: '<path d="M4 17l5-5 3 3 7-7"/><path d="M14 8h5v5"/>',
    st: '<path d="M5 19h14M7 15h10M9 11h6M11 7h2"/>',
    au: '<path d="M14 4l6 6M11 7l6 6M5 19l7-7M12.5 5.5l6 6"/><path d="M3 21h8"/>',
    ok: '<path d="M4 12l5 5L20 6"/>',
    dn: '<path d="M4 7l6 6 4-4 6 6"/><path d="M20 10v5h-5"/>',
  };
  const ic = (k) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
  function watch(kind, id) {
    const K = kind === "cond" ? "zp-watch-cond" : "zp-watch-pin";
    if (lsR(K, 0) || $("wsSheet") || OPEN) return;
    lsW(K, 1);
    if (isOn() && Notification.permission === "granted") return;   // 이미 폰 알림을 받는 기기
    const r = byId[id];
    const items = kind === "cond"
      ? [["ok", "내 돈으로 살 수 있는 새 구역"], ["dn", "필요한 돈이 줄어든 곳"], ["au", "경매 물건 등장"], ["st", "단계 변경·인가"]]
      : [["tr", "새 실거래·신고가"], ["st", "단계 변경·인가"], ["au", "경매 물건 등장"], ["ok", "내 돈으로 살 수 있게 됨"]];
    const IN = window.ZP_INSTALL, canI = !!(IN && IN.can()), ios = !!(IN && IN.ios);
    const back = document.activeElement;
    const ov = document.createElement("div");
    ov.className = "pn-ov ws-ov"; ov.id = "wsSheet";
    const render = (push) => `<div class="pn-dlg ws-dlg" role="dialog" aria-modal="true" aria-labelledby="wsT" aria-describedby="wsD">
      <span class="ws-ic" aria-hidden="true">${bellSvg(26)}</span>
      <h3 id="wsT" tabindex="-1">${kind === "cond" ? "이 돈으로 살 수 있는 곳이 생기면 알려 드릴게요" : `${esc(r ? shortName(r.n) : "관심 구역")} 소식을 알려 드릴게요`}</h3>
      <p id="wsD">이런 일이 생기면 바로 알려 드려요</p>
      <ul class="ws-l">${items.map(([k, t]) => `<li><span class="ws-li ${k}">${ic(k)}</span>${t}</li>`).join("")}</ul>
      ${push ? `<button type="button" class="btn primary ws-go" data-wson>${bellSvg(18)}알림 받기</button>` : ios && canI ? "" : `<p class="ws-note">새 소식은 위 ${bellSvg(14)} 알림함에 모아 드려요</p>`}
      ${canI ? `<button type="button" class="btn ${push ? "secondary" : "primary"} ws-in" data-wsin aria-expanded="false"><img src="/icon-192.png" alt="" width="22" height="22">앱으로 설치하면 놓치지 않아요</button>
        <div class="ws-ios" data-wsios hidden><b>홈 화면에 추가하는 법</b><ol><li>Safari 아래 <svg viewBox="0 0 24 24" width="15" height="15" aria-label="공유"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 공유 버튼</li><li><b>홈 화면에 추가</b></li><li>홈 화면의 집핀을 열고 알림함에서 <b>알림 받기</b></li></ol><small>iPhone은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요</small></div>` : ""}
      <button type="button" class="btn text sm ws-x" data-wsx>${push || canI ? "나중에" : "확인"}</button></div>`;
    const close = () => { ov.remove(); document.removeEventListener("keydown", kd); removeEventListener("hashchange", close); try { back && back.focus && back.focus(); } catch (e) {} };
    const kd = (e) => { if (e.key === "Escape") close(); };
    const draw = (push) => { ov.innerHTML = render(push); const h = ov.querySelector("#wsT"); h && h.focus({ preventScroll: true }); };
    ov.addEventListener("click", async (e) => {
      if (e.target === ov || e.target.closest("[data-wsx]")) return close();
      const on = e.target.closest("[data-wson]");
      if (on) { await subscribe(on); if (isOn()) close(); return; }
      const ins = e.target.closest("[data-wsin]");
      if (ins) {
        if (ios) { const box = ov.querySelector("[data-wsios]"); box.hidden = !box.hidden; ins.setAttribute("aria-expanded", String(!box.hidden)); return; }
        const ok = await IN.prompt(); if (ok) { tst("집핀을 설치했어요", "홈 화면에서 바로 열 수 있어요"); close(); }
      }
    });
    try { IN && IN.seen(); } catch (e) {}
    try { const t = $("pnToast"); if (t) t.classList.remove("on"); } catch (e) {}
    document.body.appendChild(ov);
    draw(false);
    document.addEventListener("keydown", kd); addEventListener("hashchange", close, { once: true });
    pushKey().then((k) => { if (k && ov.isConnected && Notification.permission !== "denied") draw(true); });
  }
  function onPins(ids) {
    const n = ids.length, was = prevN; prevN = n;
    if (n > was && was >= 0 && !lsR("zp-watch-pin", 0)) setTimeout(() => { const cur = pinIds(); if (cur.length) watch("pin", cur[cur.length - 1]); }, 900);
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
    try { PINS.on((ids) => { onPins(ids); sync(true); paint(); if (OPEN) OPEN.rerender(); if (ids.length && !CH) load().then(paint); }); } catch (e) {}
    try { navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.t === "zp-open") go(e.data.url); }); } catch (e) {}
    setTimeout(() => sync(false), 5000);
  }
  // 관심 구역 화면(70_pins)에서 쓰는 것: 구역별 최근 소식·이번 주 소식
  const evOf = (id) => (CH ? CH.items.filter((e) => e.id === id && TY[e.type]) : []);
  const week = () => { const d0 = addDay(day(), -6); return pinEvents().filter((e) => e.date >= d0); };
  return { init, paint, open, count, load, pushKey, watch, evOf, week, ready: () => !!CH, TY, dLabel: (d) => dLabel(d) };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", INBOX.init) : setTimeout(INBOX.init, 0);

  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smooth = () => (reduceMotion() ? "auto" : "smooth");
  const hav = (a, b) => {
    const t = Math.PI / 180,
      dl = (b[0] - a[0]) * t,
      dn = (b[1] - a[1]) * t;
    const x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dn / 2) ** 2;
    return 12742e3 * Math.asin(Math.sqrt(x));
  };
  const ST_FIX = {
    당고개역: "불암산역",
    구회의사당역: "국회의사당역",
    "영등포 구청역": "영등포구청역",
    잠실시내역: "잠실새내역",
    시가정역: "사가정역",
  };
  const LN_FIX = { 경의중앙: "경의중앙선", "김포 골드라인": "김포골드라인", 신림역: "신림선" };
  const stName = (n) => ST_FIX[n] || n.replace(/(\S) (구청역|시청역)$/, "$1$2");
  D.stations.forEach((s) => {
    s[0] = stName(s[0]);
    s[3] = [...new Set(s[3].map((l) => LN_FIX[l] || l))];
  });
  const NEW_ST = [
    ["천왕역", 37.486637, 126.838713, ["7호선"]],
    ["온수역", 37.492258, 126.823388, ["1호선", "7호선"]],
    ["오류동역", 37.494526, 126.845365, ["1호선"]],
    ["개봉역", 37.494594, 126.85868, ["1호선"]],
    ["사당역", 37.47653, 126.981685, ["2호선", "4호선"]],
    ["영등포역", 37.515504, 126.907628, ["1호선"]],
    ["여의나루역", 37.527098, 126.932901, ["5호선"]],
    ["마포역", 37.539574, 126.945932, ["5호선"]],
    ["가좌역", 37.568491, 126.915487, ["경의중앙선"]],
    ["서강대역", 37.551881, 126.935711, ["경의중앙선"]],
    ["압구정로데오역", 37.527381, 127.040534, ["수인분당선"]],
    ["남태령역", 37.463873, 126.989134, ["4호선"]],
    ["중앙보훈병원역", 37.528807, 127.148488, ["9호선"]],
    ["보라매공원역", 37.4954, 126.9182, ["신림선"]],
  ];
  const toXY = (lat, lng) => [
    Math.round((2272.72439 * lng - 0.00834955 * lat - 288078.866) * 10) / 10,
    Math.round((-0.0013117628 * lng - 2866.9639 * lat + 108107.651) * 10) / 10,
  ];
  NEW_ST.forEach((s) => {
    const [x, y] = toXY(s[1], s[2]);
    D.stations.push([s[0], s[1], s[2], s[3], x, y]);
  });
  let ST_CHANGED = 0;
  R.forEach((r) => {
    if (r.st) r.st.n = stName(r.st.n);
    (r.s3 || []).forEach((x) => {
      x[0] = stName(x[0]);
      x[2] = [...new Set((x[2] || []).map((l) => LN_FIX[l] || l))];
    });
    if (r.s3) {
      const seen = new Set();
      r.s3 = r.s3.filter((x) => {
        const k = x[0].replace(/\s/g, "");
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    if (r.ln) r.ln = [...new Set(r.ln.map((l) => LN_FIX[l] || l))];
    if (!r.ll || !r.st) return;
    const worst = r.s3 && r.s3.length >= 3 ? r.s3[2][1] : Infinity;
    if (
      !NEW_ST.some((s) => {
        const d = hav(r.ll, [s[1], s[2]]);
        return d < worst || d <= 1e3;
      })
    )
      return;
    const all = D.stations.map((s) => [s, hav(r.ll, [s[1], s[2]])]).sort((a, b) => a[1] - b[1]);
    const seen = new Set(),
      s3 = [];
    for (const [s, d] of all) {
      if (seen.has(s[0])) continue;
      seen.add(s[0]);
      s3.push([s[0], Math.round(d), s[3]]);
      if (s3.length === 3) break;
    }
    const before = r.st.n;
    r.st = { n: s3[0][0], d: s3[0][1] };
    r.s3 = s3;
    r.ln = [...new Set(all.filter(([, d]) => d <= 1e3).flatMap(([s]) => s[3]))];
    if (before !== r.st.n) ST_CHANGED++;
  });
  R.forEach((r) => {
    r.n = r.n
      .replace(/^\s*\[임시\]\s*/, "")
      .replace(/\s*\(임시\)/g, "")
      .replace(/^\s*가칭\)\s*/, "")
      .trim();
    if (r.sm && r.sm.zoning) r.sm.zoning = fixZoning(r.sm.zoning);
  });
  if (Array.isArray(D.nvTab))
    R.forEach((r) => {
      const mk = r.mk;
      if (!mk) return;
      if (typeof mk.new84 === "number") mk.new84 = D.nvTab[mk.new84];
      if (typeof mk.new59 === "number") mk.new59 = D.nvTab[mk.new59];
    });
  const byId = Object.fromEntries(R.map((r) => [r.id, r]));
  function pw(x, pts) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++)
      if (x <= pts[i][0]) {
        const [x0, y0] = pts[i - 1],
          [x1, y1] = pts[i];
        return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
      }
    return pts[pts.length - 1][1];
  }
  const LOC_G = { 교통: "g1", 일자리: "g2", 호재: "g3", 생활: "g4", 한강: "g5" };
  const LOC_AX = [
    {
      k: "역세권",
      g: "교통",
      w: 0.2,
      why: "가장 가까운 역 250m 100점 → 3km 0점",
      f: (r) =>
        pw(r.st.d, [
          [250, 100],
          [500, 85],
          [800, 65],
          [1200, 40],
          [2e3, 10],
          [3e3, 0],
        ]),
    },
    {
      k: "노선 수",
      g: "교통",
      w: 0.1,
      why: "1km 안 노선 1개 45 · 2개 75 · 3개 90 · 4개+ 100",
      f: (r) => [0, 45, 75, 90, 100][Math.min(r.ln.length, 4)],
    },
    {
      k: "업무지구",
      g: "일자리",
      w: 0.2,
      why: "광화문·강남·여의도 중 가까운 곳 2km 100 → 18km 0",
      f: (r) =>
        pw(Math.min(...Object.values(r.hb)), [
          [2e3, 100],
          [5e3, 75],
          [8e3, 50],
          [12e3, 25],
          [18e3, 0],
        ]),
    },
    {
      k: "한강",
      g: "한강",
      w: 0.1,
      why: "한강 중심선 900m 100 → 6km 0",
      f: (r) =>
        pw(r.h, [
          [900, 100],
          [1500, 80],
          [2500, 55],
          [4e3, 25],
          [6e3, 0],
        ]),
    },
    {
      k: "주변 호재",
      g: "호재",
      w: 0.1,
      why: "1.5km 안 정리된 호재 1건 50 · 2건 75 · 3건 90 · 4건+ 100",
      f: (r) => [0, 50, 75, 90, 100][Math.min(nearHojae(r).length, 4)],
    },
    {
      k: "초등학교",
      g: "생활",
      w: 0.1,
      why: "가장 가까운 초등학교 300m 100 → 1.6km 0",
      f: (r) => {
        const i = infraOf(r);
        return i
          ? pw(i.e.d, [
              [300, 100],
              [500, 75],
              [800, 45],
              [1200, 15],
              [1600, 0],
            ])
          : null;
      },
    },
    {
      k: "중·고교",
      g: "생활",
      w: 0.05,
      why: "가장 가까운 중학교·고등학교 평균 · 500m 100 → 2.5km 0",
      f: (r) => {
        const i = infraOf(r);
        if (!i) return null;
        const s = (d) =>
          pw(d, [
            [500, 100],
            [1e3, 65],
            [1500, 35],
            [2500, 0],
          ]);
        return (s(i.m.d) + s(i.h.d)) / 2;
      },
    },
    {
      k: "대형병원",
      g: "생활",
      w: 0.07,
      why: "상급종합·종합병원급 1km 100 → 8km 0",
      f: (r) => {
        const i = infraOf(r);
        return i
          ? pw(i.hp.d, [
              [1e3, 100],
              [2e3, 75],
              [3e3, 50],
              [5e3, 20],
              [8e3, 0],
            ])
          : null;
      },
    },
    {
      k: "대형마트",
      g: "생활",
      w: 0.08,
      why: "대형마트 500m 100 → 4km 0",
      f: (r) => {
        const i = infraOf(r);
        return i
          ? pw(i.mt.d, [
              [500, 100],
              [1e3, 80],
              [1500, 55],
              [2500, 25],
              [4e3, 0],
            ])
          : null;
      },
    },
  ];
  const PROG = [0, 10, 25, 35, 55, 70, 85, 92, 97, 100];
  function scoreAll() {
    R.forEach((r) => {
      if (!r.st) return;
      const v = LOC_AX.map((a) => {
        const x = a.f(r);
        return x == null ? null : Math.round(x);
      });
      const wsum = LOC_AX.reduce((s, a, i) => s + (v[i] == null ? 0 : a.w), 0);
      r.ax = v;
      r.pts = v.map((x, i) => (x == null ? 0 : (x * LOC_AX[i].w) / wsum));
      r.score = Math.round(r.pts.reduce((s, x) => s + x, 0));
    });
    R.forEach((r) => {
      if (r.score == null || r.dn) return;
      const c = r.cs && (r.cs["조합설립"] || r.cs["추진위"]) ? (r.cs["조합설립"] || r.cs["추진위"]).v : null;
      const drive =
        c != null && r.cs["조합설립"]
          ? pw(c, [
              [75, 60],
              [95, 100],
            ])
          : r.s >= 5
            ? 80
            : r.s === 4
              ? 70
              : r.s === 3
                ? 55
                : 45;
      r.comp = Math.round(r.score * 0.5 + PROG[r.s] * 0.3 + drive * 0.2);
      r.compAx = [r.score, PROG[r.s], Math.round(drive)];
    });
    scored.length = 0;
    POP_LOC.forEach((r) => scored.push(r.score));
    scored.sort((a, b) => a - b);
  }
  const grade = (s) => (s >= 85 ? "S" : s >= 72 ? "A" : s >= 58 ? "B" : s >= 45 ? "C" : "D");
  const isDone = (r) => r.s >= 9 || (!!r.dn && r.s < 7);
  const POP = R.filter((r) => !isDone(r) && r.src !== "moa");
  const MOA_ALL = R.filter((r) => !r.dn && r.src === "moa");
  const POP_LOC = POP.filter((r) => !!r.st);
  const scored = [];
  const pct = (v) => {
    let lo = 0,
      hi = scored.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (scored[m] < v) lo = m + 1;
      else hi = m;
    }
    return Math.round((lo / scored.length) * 100);
  };
  const jgs = POP.filter((r) => r.jg)
    .map((r) => r.jg)
    .sort((a, b) => a - b);
  const jgPct = (v) => {
    let lo = 0,
      hi = jgs.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (jgs[m] < v) lo = m + 1;
      else hi = m;
    }
    return Math.round((lo / Math.max(1, jgs.length)) * 100);
  };
  const posTxt = (below) => {
    const top = Math.max(1, 100 - below);
    return top <= 50 ? `상위 ${top}%` : `하위 ${Math.max(1, below)}%`;
  };
  const moas = R.filter((r) => r.src === "moa" && r.ll);
  R.filter((r) => r.src === "official" && r.ll && /모아|가로주택|소규모/.test(r.n + r.k)).forEach((c) => {
    let best = null,
      bd = 1e9;
    moas.forEach((m) => {
      if (m.g !== c.g) return;
      const d = hav(m.ll, c.ll);
      const lim = Math.sqrt((m.sm?.area || 6e4) / Math.PI) + 150;
      if (d < lim && d < bd) {
        bd = d;
        best = m;
      }
    });
    if (best) {
      c.parent = best.id;
      (best.kids = best.kids || []).push(c.id);
    }
  });
  const TR = (D.etaMeta && D.etaMeta.transitions) || {};
  const DUP = TR.small?.["사업시행>관리처분"]?.med || 0;
  const erf = (x) => {
    const s = Math.sign(x);
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const yrOf = (s) => {
    const [y, m] = s.split("-").map(Number);
    return y + (m - 0.5) / 12 - (TODAY.getFullYear() + TODAY.getMonth() / 12);
  };
  const ymOf = (t) => {
    const d = new Date(TODAY.getTime() + t * 365.25 * 864e5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  let ETA_ADJ = 0;
  R.forEach((r) => {
    const e = r.eta;
    if (!DUP || !e || !e.eMid || e.grp !== "small" || r.src === "moa" || r.dn || r.s > 5) return;
    const t25 = Math.max(0.25, yrOf(e.eLo)),
      t50 = Math.max(0.3, yrOf(e.eMid)),
      t75 = Math.max(0.35, yrOf(e.eHi));
    const mu = Math.log(t50),
      sig = Math.max(0.08, (Math.log(t75) - Math.log(t25)) / 1.349),
      cond = e.cond ?? 1;
    const F = (h) => Phi((Math.log(Math.max(h, 0.001)) - mu) / sig);
    const adj = (p, h) => Math.max(0, Math.min(cond, p + cond * (F(h + DUP) - F(h))));
    const sh = (s) => ymOf(Math.max(0.25, yrOf(s) - DUP));
    r.etaRaw = e;
    r.eta = { ...e, p10: adj(e.p10, 10), p15: adj(e.p15, 15), eLo: sh(e.eLo), eMid: sh(e.eMid), eHi: sh(e.eHi), adj: DUP };
    ETA_ADJ++;
  });
  const isRedev = (r) => r.k === "재개발" || r.k === "도시정비형 재개발";
  const isRebuild = (r) => r.k === "재건축" || r.k === "소규모재건축";
  const isSmall = (r) => /가로|소규모/.test(r.k);
  const isSmallR = (r) => isSmall(r) && r.src !== "moa";
  const isPublic = (r) => /공공재개발|공공시행|\(LH\)|\(SH\)/.test(r.n);
  function ladderLabels(r) {
    const L = LADDER.slice(),
      skip = new Set();
    if (r.src === "moa") {
      L[0] = "대상지 선정";
      L[1] = "관리계획 수립";
      L[2] = "관리계획 승인";
      return { L: L.slice(0, 3), skip };
    }
    if (isSmallR(r)) {
      L[0] = "사업 대상지";
      L[1] = "사업계획 수립";
      L[2] = "구역지정 (가로·소규모는 해당 없음)";
      L[3] = "주민합의체·준비위원회 (임의)";
      L[5] = "사업시행계획인가 (관리처분 포함)";
      L[6] = "관리처분 (사업시행인가에 포함)";
      skip.add(2);
      skip.add(6);
    }
    if (r.trust) {
      L[3] = "추진위원회 (신탁 방식은 해당 없음)";
      L[4] = "사업시행자 지정 (신탁)";
      skip.add(3);
    } else if (isPublic(r)) {
      L[3] = "주민대표회의·추진위";
      L[4] = "조합설립 또는 사업시행자 지정 (공공)";
    }
    return { L, skip };
  }
  const stageName = (r) =>
    (r.src === "moa" ? r.sr : (ladderLabels(r).L[isSmallR(r) && r.s === 6 ? 5 : r.s] || r.sr).replace(/ \(.*\)$/, "")).replace("조합설립 또는 사업시행자 지정", "조합·시행자 지정").replace(/^정비구역지정$/, "정비구역 지정").replace(/사업시행계획인가/, "사업시행인가");
  const srLabel = (r) => (isPublic(r) && r.s === 4 && /조합설립/.test(r.sr) ? "조합설립·시행자 지정(공공)" : r.sr);
  function chkText(r) {
    const c = r.chk || "";
    if (/인가 아님|이벤트/.test(c)) return "단계 근거로 쓰인 날짜가 인가가 아닌 다른 공고일 수 있어요.";
    if (/가 있는데 s=/.test(c)) return "공식 목록의 단계보다 늦은 단계의 인가일 기록이 있어 실제로는 더 진행됐을 수 있어요.";
    if (/준공/.test(c)) return "이미 준공됐을 가능성이 있지만 공식 준공 기록이 없어요.";
    if (/없음/.test(c)) return `공식 목록에는 '${srLabel(r)}' 단계로 나오지만 인가일 기록이 없어 단계를 확정하지 못했어요.`;
    return "공식 자료끼리 단계 정보가 맞지 않아요.";
  }
  function dirWord(from, to) {
    const dy = (to[0] - from[0]) * 110540,
      dx = (to[1] - from[1]) * 88e3;
    const a = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    return ["동", "북동", "북", "북서", "서", "남서", "남", "남동"][Math.round(a / 45) % 8];
  }
  function whereText(r) {
    if (!r.st) return "";
    const s = D.stations.find((x) => x[0] === r.st.n);
    const dir = s ? dirWord([s[1], s[2]], r.ll) : "";
    const x = stnInfo(r);
    return `${x.n}역에서 ${dir}쪽 ${fmt(x.d)}m · 도보 약 ${x.min}분`;
  }
  const grpOf = (r) => (r.dn || r.s >= 9 ? 4 : r.s <= 2 ? 0 : r.s <= 4 ? 1 : r.s <= 6 ? 2 : 3);
  const st6 = (r) => (isDone(r) ? 0 : r.s <= 2 ? 1 : r.s === 3 ? 2 : r.s === 4 ? 3 : r.s === 5 ? 4 : r.s === 6 ? 5 : 6);
  const STCOL = (i) => (i ? `var(--st-${i})` : "var(--st-done)");
  const ST_LAB = ["완료", "후보지·계획·지정", "추진위", "조합설립", "사업시행", "관리처분", "이주·착공"];
  const GRCOL = { S: "var(--gr-S)", A: "var(--gr-A)", B: "var(--gr-B)", C: "var(--gr-C)", D: "var(--gr-D)" };
  const ICON = {
    filter:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    wallet:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 9h18"/></svg>',
    close:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };
  let hdrH = 0;
  const HDR = () => hdrH || ($("hdr") ? (hdrH = $("hdr").offsetHeight) : 0);
  if (window.ResizeObserver && $("hdr"))
    new ResizeObserver(() => {
      hdrH = $("hdr").offsetHeight;
    }).observe($("hdr"));
  const josa = (w, a, b) => {
    const c = String(w).trim().slice(-1).charCodeAt(0);
    if (c < 44032 || c > 55203) return w + b;
    return w + ((c - 44032) % 28 ? a : b);
  };
  function fadeHint(el) {
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle("fade-r", max > 2 && el.scrollLeft < max - 2);
    el.classList.toggle("fade-l", el.scrollLeft > 2);
  }
  function bindFade(el) {
    if (!el || el._fade) return;
    el._fade = true;
    el.addEventListener("scroll", () => fadeHint(el), { passive: true });
  }
  let rfT = 0;
  const refreshFades = () => {
    cancelAnimationFrame(rfT);
    rfT = requestAnimationFrame(() =>
      document.querySelectorAll(".hs").forEach((el) => {
        bindFade(el);
        fadeHint(el);
      }),
    );
  };
  function focusKey(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    if (el.id) return "#" + CSS.escape(el.id);
    for (const a of [
      "data-tab",
      "data-k",
      "data-c",
      "data-grp",
      "data-cm",
      "data-gu",
      "data-unset",
      "data-alt",
      "data-cash",
      "data-go",
      "data-v",
      "data-reset",
      "data-open",
      "data-lmore",
      "data-maff",
      "data-st",
      "data-kind",
      "data-id",
    ]) {
      if (el.hasAttribute(a)) {
        const par = el.parentElement && el.parentElement.closest("[id]");
        return (par ? "#" + CSS.escape(par.id) + " " : "") + `[${a}="${CSS.escape(el.getAttribute(a))}"]`;
      }
    }
    return null;
  }
  function keepFocus(fn, fallback) {
    const k = focusKey(document.activeElement);
    const r = fn();
    if (k && (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected)) {
      const el =
        document.querySelector(k) ||
        (fallback
          ? fallback
              .split(",")
              .map((f) => document.querySelector(f.trim()))
              .find(Boolean)
          : null);
      if (el) {
        if (!el.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute("tabindex", "-1");
        el.focus({ preventScroll: true });
      }
    }
    return r;
  }
  function markNewWin(root) {
    (root || document).querySelectorAll('a[target="_blank"]:not([data-nw])').forEach((a) => {
      a.dataset.nw = "1";
      a.insertAdjacentHTML("beforeend", '<span class="sr-only"> (새 창)</span>');
    });
  }
  const yieldT = () => (window.scheduler && scheduler.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0)));
  // 구역 수는 한 기준만: 진행 중 = 준공·해산 빼고 모아타운 관리지역 뺀 곳(tools/zpages.py의 /z·/gu 숫자와 같음)
  window.ZP_zones = { live: POP.length, done: R.filter((r) => isDone(r) && r.src !== "moa").length, moa: MOA_ALL.length };
  try { $("eyebrow").title = `진행 중 ${fmt(POP.length)}곳 = 준공·해산 ${fmt(window.ZP_zones.done)}곳과 모아타운 관리지역 ${fmt(MOA_ALL.length)}곳을 뺀 숫자`; } catch (e) {}
  document.querySelectorAll("[data-zcount]").forEach((el) => (el.textContent = `진행 중 ${fmt(POP.length)}곳 한 장씩`));
  $("eyebrow").innerHTML =
    `<span class="live" aria-hidden="true"></span><span class="eb-l">서울 진행 중 정비사업 ${fmt(POP.length)}곳 · 모아타운 관리지역 ${fmt(MOA_ALL.length)}곳 별도 · 데이터 갱신 ${UPD}</span><span class="eb-s">서울 정비사업 ${fmt(POP.length)}곳 · ${+(D.upd || D.asOf).slice(5, 7)}.${+(D.upd || D.asOf).slice(8, 10)} 갱신</span>`;
  $("asof").textContent = window.ZP_fresh;
  const KINDS = [
    ["재개발", (r) => r.k === "재개발" || r.k === "도시정비형 재개발"],
    ["재건축", (r) => r.k === "재건축"],
    ["모아타운", (r) => r.src === "moa"],
    ["가로·소규모", (r) => /가로|소규모/.test(r.k) && r.src !== "moa"],
  ];
  const GROUPS = [
    ["계획·지정", (r) => r.s <= 2],
    ["추진위·조합", (r) => r.s === 3 || r.s === 4],
    ["사업·관리처분", (r) => r.s === 5 || r.s === 6],
    ["이주·착공", (r) => r.s === 7 || r.s === 8],
    ["완료", (r) => r.dn || r.s === 9],
  ];
  const F = { kind: new Set(KINDS.map((k) => k[0])), st: new Set([1, 2, 3, 4, 5, 6]), done: false };
  const SHAPE = { rd: "재개발", rc: "재건축", sm: "가로·소규모", moa: "모아타운" };
  const shapeOf = (r) => (r.src === "moa" ? "moa" : /가로|소규모/.test(r.k) ? "sm" : r.k === "재건축" ? "rc" : "rd");
  function visible(r) {
    if (!r.xy) return false;
    const k = KINDS.find(([n, f]) => f(r));
    if (!k || !F.kind.has(k[0])) return false;
    const s = st6(r);
    return s ? F.st.has(s) : F.done;
  }
  const GEO = {
    rl: [524.9, 563.5, -11.9],
    gu: {
      강동구:
        "M814.7,425l1,3.6 0,15.1-1.9,5.8-1.4,5.2-.8,5.6-1.2,3-4.5,8.7 17.1,6.1 3.2,1.2 2.3,1.3 2.1,1.9 2.6,1.9 3.7,1.8-2.6,9.4-1.9,6.1-1.9,8-2.9,6.4 3.4,1.9 14.4,8.1 14.1,7.9 5.3,2.8 6.2,3.4 11.3,6.4 3.2,1.4 1-.2-.5-2.9 .1-.7-.3-3.2 2.4-7.4 4.3-.2 1.2-2.2 .5-.6 .2-1.2 1-2.1 .2-1.2 1-1.6-.1-1.4 .8-1.3 1.2-.8 .4-.7 2.4-3.1 .9-.6 1.6-1.8 1.4-2.3 0-2.2 .6-.6 .1-2-.1-2.9 0-5.6 .7-.5 .1-1 1.2-.7 1-2 .8-1.8 0-.8 .7-.3 1.1-1.3 .4-1.2 1-.4 .8-1.3 .2-1.6 2.8-3.5 2.1-2.9 1.7-1.4 1-1.1 1.5-2.8 1.3-2.1 1.5-1.6 1.2-2.2 .8-1.1 2.1,.4 1.3,.5 1.3,.2 2.2,1 1-.5 .5-2 .7-.4 2.2,.7 1-.4 1.5,.4 .7,.6 2.7-.5 3.6-1.6 .7,.1 3.1,0 .9,.9 2.7,0 3.1-2.1 1.6-.8 3.2-1.2 2.4,.6 1.8,1.6 1.4,1.9 4.1-.6 .5-1.2-1.6-2.1-.3-4.4 .4-2.4-.1-3.1 .4-1.7 .4-.3-.1-2.8-1.6-.9-2.4-2.4 .3-2.5 .3-.1-.4-3.7 .5-2.9-.2-4.5 .9-5.1 0-2.3-.1-2.1-.3-1.1-1.6-3.2-2.6-7-.5-.4-.4-1.8-.3-3.4 0-2.1-.5-3.6-.3-1-1.3-2.6-.5-2-1.1-2 0-1.8-1-1.5-1-1.9-2-2.8-.6-1.7-.4-4.6-.6-2.4 .3-3.1 1.2-.3 1.4-1.4 .8-1.4 .1-1.2 .8-1 .6-1.7-1.6,.3-4.4,1.9-2.4,1.4-4.6,.4-3.1-.1-5.2,.6-5.1-1-3,.2-4.6,3.4-10.5,6.4-11.5,6.8-13.2,5.8-13.3,4.1-17.1,5.3-5.6,2.8-20.7,9.2-3.4,2.1-3.2,2.5-4,4.8-2.1,2.7-2.7,.5-5.4-1.4z",
      송파구:
        "M709.5,539.3l.5,5.1 .6,3.7 .2,1.9 .5,3.5 .4,4.5 .5,3.4 .2,5.8 .7-.2 1.5,11.2 .9,4 3.2,4.4 4.5,3.9 2.7,2.1 9.1,2.2 41.7,13.8 5.2,2.8 7.3,3.8 3.2,2.3 2.6,2 2,1.8 7.7,8.3 2,3.4 .5,1.1 1.1,3.8 1.3,1.7 2.4,4.2-1.2,1.1-1.6,.7 1.5,1.4 6.4,10.9 5.6,9.7 4.1,7 4,7 2.2,4.4 1.8,4.6-.2,2.8 .4,.5 0,1.4-.2,1.1 3.5-3.1 3.1-2.1-.3-5.4-.4-1.2 .6-.6 2.9,2.2 .4-.2 4.8,2.7 9,0 6.2-4-4.6-3.1-.7-.2-1.7-1.6-1.2,0-1-.6-1.4-.4-.4-.8 .9-.3-.6-10.5 5.5-1 1.2,1 1.3,1.3 10.9,4.4 2.1-.9 .2-1.2 2.2-1.8 1.6,.7 .8-5.7 10-.3 2.9-1.9 3.8-3.3-.1-5.3 .5-3.2 .5-1.7 1.9-4.9 .7-2.7 1.2-5.7 .1-1 .7-1.9 1.9-1.1 2,.4 3-.9 1.4-.8 1.5-.4 1.5-.9 .7-1.8 .9-1.4 1.8-1.6-.1-1.3 .8-3.6 .7-1.4 1.9-2.3 .7-2.4-.1-2.9-.5-2.5 .2-1.5 .5-.9 1-1 .2-3 1.7-3 0-1.9-1.9-2.5-3.1-1-1-.5-1.7-3.5-.8-.6-2.6,3.4-5.7-2.5-1.7,0-1.4-1-1.6-.1-2.4-2.7-1.7-1.2-3.3,2.2-1.2,.5-1,.9-1.1-.5-.7,.2-2.9-.2-.9-.2-.6-1.5-1.3-1-1.9-.2-2.8-1.6-.2-.4-2.5-.9-.9-1.4 .4-2.2 .8-.7-1.3-1.8-.7-.3-.4-2-.5-.6 .3-1.1 .3-2.5 2-7.1 1.5-.1 .6-1.2 3.3,.3-.2-3.1-1.4-.9-.7-.8-5.2-1.6-1.1-1.8 1.3-.2 2.9,.1 1.4-.2 5.5,.1 1.8-1.4 0-1.1-1.8-1.4-3.2-1.4-11.3-6.4-6.2-3.4-5.3-2.8-14.1-7.9-14.4-8.1-3.4-1.9 2.9-6.4 1.9-8 1.9-6.1 2.6-9.4-3.7-1.8-2.6-1.9-2.1-1.9-2.3-1.3-3.2-1.2-17.1-6.1-9.1,15.6-6.5,11.5-9,18.3-14.8,2.4-3.6,2.1-4.9,1.7 7,16.3-6.3,1.8-9.1,1.5-8.1,.2-6.7-.8-26.2-4.8z",
      강남구:
        "M595.6,531l1.2,2.3 1.6,4.5 1.7,6.5 1.1,5.8-.3,.4 .7,1.6 1.3,5.4 .6,2.5 1.8,4.6-2.3,.9 .1,.4 2.3-.9 13.3,35.1 10,26.5 4.9,12.8 .8,1.5 8.4-1.6 8-1.3 .9,2.8 3.5,10.2 1.5,3.8 1.4,4.4 1.1,2.6 1.5,1.8 5.1,6.3 7.1,8.5-3.4,2.9 1.1,1.1 3.6-.1 3.1,2.3 1.8,1.7 1.7,.6 1.5-.6 .9-.1 1.4,1.1 1.2-.1 1.1-1.3 .9-.4 1.1,.3 1.2-.1 .7-.6 1.5,.4 1.6,0 1,.3 2-.2 1.2-1.9 .8-4.6 .1-4.6 15.2-3 1.2-2.5 .1-1.3 .9,.2 2.4,1.4 1.3,.1 1.9-.5 2.8,5.6 .8-1 1.7-.6 2.1-1.1 1.3-2.1 1.5-1.4 .8,0 1.5,.7 1.1-.7 .9,.5 2-.4 1,.3 1.5-.9 2.6-.4 1.9-.2 .6-.4 .9,.2 1.4-.1 2,.6-1.5,6.9 1.6,3.8 2.3,3.4 2.2,.6 .7,1 .9,.2 0,1.4 .4,.3 .5,1.6 0,.8 .9,.7 1.3,0 .7,.8 .3,1.2 .9,.4 .5,.7 2.2-.2 1.9,4.3 2.2,2.1 .6,1.2 1.6,1.2 2.2,.9 1,2.4 1.2,1 .7,3 1.3,5.3 1.3,.6 1.6,1.9 1.8-.9 .5,.1 1.5-1 1.1,.9 1.4-.5 1.1,0 4.8-1.2 1-1.4 .2-1.4 1-1.2 .8-.4-1.2-2.9 2.9-.1 1.6-.9 6.7,1.5 4.7,.8 1.6,.5 2.3,1.1 .9,.3-.1,.7-1.1,.9 .8,.5 0,.8 5.4,4.2 2.6,0 .5-7.7 .5-1.6 .6-1 3.8-2.5 2.2-1.1 3.1-2.6 1-2.4 .9-.1 .2-1.1 0-1.4-.4-.5 .2-2.8-1.8-4.6-2.2-4.4-4-7-4.1-7-5.6-9.7-6.4-10.9-1.5-1.4 1.6-.7 1.2-1.1-2.4-4.2-1.3-1.7-1.1-3.8-.5-1.1-2-3.4-7.7-8.3-2-1.8-2.6-2-3.2-2.3-7.3-3.8-5.2-2.8-41.7-13.8-9.1-2.2-2.7-2.1-4.5-3.9-3.2-4.4-.9-4-1.5-11.2-.7,.2-.2-5.8-.5-3.4-.4-4.5-.5-3.5-.2-1.9-.6-3.7-.5-5.1-.9-1.5-2-.4-3.1-2.3-2.1-.8-1.8-2.3-2.6-2-8.1-5.1-3.1-2.7-5.2-5.8-4.7-2.6-.4-.8-6.6-1.2-25.9-8.7-5.9-2.4-3.1-2.7-5.9-1.6-7,.2-3.2,.8-4.3,2-5.5,5.5-.5-.1-.9,.7-6.1,8.7-9.8,10.3z",
      서초구:
        "M512.1,585.2l.3,1.9 .6,1.7 1,1.3 4,2.4 4.9,4.1 2.6,2.8 1.7,1.2 2,0-.2,1.1-1.9-.2-1.5-.8-1.1-1-2.2-2.5-.3,2.4-.5,1.3-2.2,2.8-1.3,3.3-.3,3.3-.1,7-.2,5.9-.2,3.7-.8,4-.3,7.6-.1,3.5-.3,4.7-.4,9.9-.4,7 .3-.1 .4,5.8 1.5,5.4 1.6,3.5 3,5.2 2,2.2 3.3,3.2 1.6,2.6 1.3,4.1 .2,4.7-.7,4.7-.7,2.7-.4,2.6 .4,2.8 2.3,3.7 1.5-1.1 .9-1.8 2.3-1.5 1.3-1.3 1.1,1.3 .9-1.3 .4,.1 .4-1.1 1.6-2.7 .8-.5 2,.3 1.6-.4 3.8-1.6 .3-.9-.1-2.2 .6-.8 .1-1.2-1.7-2.4-.4-5.5 1.7-1.4 2.1-.5 4,.6 .5,.3 1.6,0 1.1-.8 .8,.1 1,.9 1.6-.1 1.8-.7 .4,1.4 .9,1-.1,1.6 .8,1.3-.3,1.8 1.8,3.3 .7,2.9 2.3,1.3 1,2.5 .7,1.2-.1,1.5 1.5,1.5 2.1,4.3 .3,1.3 .7,1.5 2.6,1.8 1,1.3 1.1,2.6 4-.5 3.5,.3 4.1,.2 3.8-.7 6.1-1.6 9.4-4.7 3.3-2 2-3.9 4-6.5 2.5-3.8 .5-2.1-.5-3.6 3.2-.9 3.3,1.5 1,.6 .8,1.4 1.3,.4 1.5,1.6-.8,.6 .1,1.3-1.8,4.9 .8,3.3 1.2,.7 .9-.3 .1,1.4-.6,.6 .5,2-.2,1.7 .7,1.7 1.6,.1 2,2.7 .9,3.7-.1,2.1-.7,1.6-.7,1 .1,3-.8,3.1 1.5,1.8 1,2.5 1.2,2 .2,1-1,1.9-.3,1.5 .4,1.4-.4,1.6 .4,1.1 1.6,1.2 .4,1.5-.3,2.1-1.5,3.7-1.1,1.4-.8,2.7-2.3,1.7-.7,.7 .1,2.1 .7,1.9 .2,1.8 1.7,.7 1.3,1.1 .7,.2 2.7-.2 1.3,.3 1.3-.2 2.7,.9 .8,2.1 2.1,1.5 1,.9 3.4,4 1,2.5 .9,.8 2.5,1.1 .6,.6 .7,2.5 1.2,2 .6,3.1 2.1,.8 1.2,0 2.1,.7 2.3,1.8 2.8,3.2 .7,.2 1.1-.6 1.9-1.4 1.9-.7 1.9-.3 5.6-1.7 2.4,.9 1.7,.2 3.1-1 1.9,.7 3.6,.6 1.8,1.2 3.2,.6 .8-1.7 1.6-1.5 2.6-.8 .9-.7 1.3,.8 1.1-.2 1.4-1 1.2,1.6 .3,.8 1.4-1.8 .1-1.1-.8-2.6-.7-1-.1-1 .5-1.2 1.2-2.4 .3-1.6 0-2.4-.5-.5 .6-1.7 3.3-1.6 .9-1.1 1.4-.5 .7-1.2 .6-2 .1-1.7-2-1.1-3.9-2.3-.1-3.6-.6-1.6 .6-.8 1.1-.8 1.8,.6 .9-.5 2.6-.3 1.5,.4 1-.1 2,.4 1.4,1.1 1.4-.4 .9,.8 .8-.1 1.1,.6 1-.1 1.4,.5 1.7,1.1 1.3-.1 1.7-.6 .6-.7 1.5-3.1 0-.9 1.4-1.8 .6-1.5 1.7-.7 .8-.8 .5-1.2 .5-.2 3.5,.6 1.8-.7 .9-2.1-.4-1.7 .4-.7-.4-.8 .3-1.5 .6-1.2-.7-2.7 .2-1.2 1.2-1.4-.1-1.2 .6-.1 1-.9-.1-1.3 .4-.8 1.3-.6 .6-.8-.1-.8 .8-2.5 2.5-2.4 1.5-.1 1.1-3-.2-.6 .9-1.7-.1-.7 .7-1 1.4-1.1 1.9-.1 .6-3.7-.2-1-1.5-1.7 1.2-2.5 .6-1.8 .6-.5 .4-1.7 1-1.1-.7-3-1.2-1-1-2.4-2.2-.9-1.6-1.2-.6-1.2-2.2-2.1-1.9-4.3-2.2,.2-.5-.7-.9-.4-.3-1.2-.7-.8-1.3,0-.9-.7 0-.8-.5-1.6-.4-.3 0-1.4-.9-.2-.7-1-2.2-.6-2.3-3.4-1.6-3.8 1.5-6.9-2-.6-1.4,.1-.9-.2-.6,.4-1.9,.2-2.6,.4-1.5,.9-1-.3-2,.4-.9-.5-1.1,.7-1.5-.7-.8,0-1.5,1.4-1.3,2.1-2.1,1.1-1.7,.6-.8,1-2.8-5.6-1.9,.5-1.3-.1-2.4-1.4-.9-.2-.1,1.3-1.2,2.5-15.2,3-.1,4.6-.8,4.6-1.2,1.9-2,.2-1-.3-1.6,0-1.5-.4-.7,.6-1.2,.1-1.1-.3-.9,.4-1.1,1.3-1.2,.1-1.4-1.1-.9,.1-1.5,.6-1.7-.6-1.8-1.7-3.1-2.3-3.6,.1-1.1-1.1 3.4-2.9-7.1-8.5-5.1-6.3-1.5-1.8-1.1-2.6-1.4-4.4-1.5-3.8-3.5-10.2-.9-2.8-8,1.3-8.4,1.6-.8-1.5-4.9-12.8-10-26.5-13.3-35.1-2.3,.9-.1-.4 2.3-.9-1.8-4.6-.6-2.5-1.3-5.4-.7-1.6 .3-.4-1.1-5.8-1.7-6.5-1.6-4.5-1.2-2.3-4.8-6.5-2,2-15.1,16.9-2.2,2.2-3.6,1.2-.6,3.3-1,1.8-2.7,1.1-5.1,4.8-6.1,2.1-2.5,1.4-11.6,11.8-1.5,2-7,2.5-6.7-1-5.9,1.9-5.2-.2zM548.3,559.8l-.8,.1-.8,1.3 .9,.1 1-1zM545.4,561.6l-1.1,1.3 0,.9 .5,.2 .8-.4 .5-1.8zM526.9,576.3l1.7,.4 .9-.3 .5-1.3 1.3,.9 1.2,.1 .8-.5 .9-1.6 1.7-.4 1.4-1.4 1.2-.6 1.9-1.9 .1-.5-.6-.1-13.1,6.5z",
      관악구:
        "M504.4,663.8l-4.6,.9-5.8,1.3-4.3,1.3-.4-1-.2-2.6-3.2-.1-1.6-2.2-.9-1.5-.9-.3-1-1.4-1.5-1.7-1.5-.6-.5-.7-1-.4-1.1-1.8-.1-1.1-.6-1.2-1.9-1.3-1-1.7-1-1.1-.5-1.7-1.8-.9 .1-.9 1-.9 .7-3.1-.3-1.8 .2-1.5 .6-1.8-.1-.7-1.3-.8 .7-1.4-.8-.2-.1-.9 .5-.5-.8-1.9-1.1-2-.4-1.2-.1-1.5 1.3-1.7-.2-.6-.3-3.5-.4-.3 .4-1.2-2.2-1.4-2.5,0-.4,.2-.1,1.2-.5,1.3 .1,1-3.5,1.6 .4,.7-1.5,.7-3.1-.1-1.2,1.1-2.1,.5-.6-.7-.4,.4-1.1-1.2-1.1-.6-1.4-1.7-1.4-.2-3.1-1-1.4-2-1.2-.8-2.3,.1-1.3-1-.7,.8-2.4,1.1-1.8,.4-3.2,1.8-.7,.1 .4,1-.6,.2-1.7-.3-1.8,.1-1.1,1.6-1.2,.6-1.2,1-1.4,.7-1.1-1.1 .7-1.4-1-.7-2.1,.2-1.3-.6-.9,.3-1.1-.1-.9-1-2.1-1.4-1.3-.5-2.6,.1-2.5,.5 0-.4-2.3-.7-3-2.1-.5-.1-3-2.2-.9-.4-1.6-.1-.4,1.4-.9,.3-.7,1.3 .1,1.3-2.5,1.4-.1,.9 .9,.1-.6,3.2-.6-.1-.4,1.9-1.4-.2-.4,2.8-2.4,.2-3.1,.1-3.4,.2-3.4,.7-2.9,0-1.3,.4-8.7,6.3-.3-.4-4.4,2.5-7.9,3.1-3.9,1.2-1.9,0-4.3,0-2.1,3.3-3.8,5.4-2.7,4.6 2.8,2.9 3.2-.6 17.3-4 .5,1.9-2.2,.5 .4,1.5-.8,.2 .3,1.3 .3-.1 .4,1.5 .6,1 1.8-.4 .5,.2 .2,.8 2.3-.6 .8,3.6-.8,2.5 .1,1.6 .9,1.2 .1,1-1.9,.2-.1,.9-.5,1.4-.6,.7-2.6,1.4-.8,.1-1.7,.7-.6,.7 .8,1.2 1,2.3 0,.7 .9,1.3 .3,1.1 1.4,2.9 0,1.7 .3,.9 1.5,.8 .2,.9 .8,1.8 .6,1.8 1.7,1.1 0,1.3 3.1,1.3-.8,1.7-.9,.8-.3,1.2 .2,1.5 1.3,1.7 .8,1.9-.1,.8 1.1,1.2-.4,1.4 .3,2.6-.6,.9-.1,.7 .5,1.7-.5,.9 .4,1.7 1.2,1 3.4,.1 1.4-.2 1.6,1 2.6,.8 .8-.1 1.3,.4 3-.2 2.8,.7 .8-1.2-.1,1.5 .5,3.4 .8,1.6 .4,1.6 1.6,.7 2.6,3.9 1.5-.1 3.2,3.4 1.5,1.1 2,.7 .4,.5-.1,2 1.5,.7 1.5,1.6 .1,.6 1.1,1.4 .9,1.5-.3,1.6 0,1.9 .4,1.4 0,2.1 1.4,1.1 2,.9 .7,.7 3.1,2.3 1.1,1.2 2.1,.9 1.5,2.5 .7,.2 1.5,1 2.8,4.7-.3,1-1.1,1.3 0,2.4 .8,1.2 .1,2.3 1.8,2.4 .9,1.9 1.3-.5 1.4-.1 2.3-1.5 1.5-2.6 3.7-.3 2,.4 1-.1 1.3-.6 .5-.6 2.1-1.8 2.8-1.3 1.6,.9 1.4-.1 .9-.5 3.3-1.3 4.1-.3 3.1,1 1.8,.2 2.1-.2 1.8-.5 3.2-.5 1.3-2.8 .8-.7 2.1,.4 2.5,.1 2-.2 1.9-1.2 .6-1.7 1.6-1.5-.1-2.5-.5-3.3 .4-1.8 .9-2.1 2.7-1.5 1.6,.3 1.6-.1 .9-.5 .3-.8 1.3-.8 2.9,0 2.1-1.1 1.7-1.1 2,0 1.7-.5 3,.3 3.7-5.7 .4-1.1 1-1.4 1.5-.8 1.1,.1 2.4-1.8 .5-1.6 1.4-1.2 3.6-2 .1-1.6 2.5-2.2 .5-1.1 .3-1.3-.1-1.7-.4-1.3 .2-.9 1.2-.6 4.4-.4 2.4-1.1 2.5-.4 2-.9 2.1-1.2-2.3-3.7-.4-2.8 .4-2.6 .7-2.7 .7-4.7-.2-4.7-1.3-4.1-1.6-2.6-3.3-3.2-2-2.2-3-5.2-1.6-3.5-1.5-5.4-.4-5.8-.3,.1z",
      동작구:
        "M424.9,546.7l-6,1.3-8.3,2-7.3,1.8-9.3-.1-5.3-1.2-2,3.4 1.2,.6 3,.7-.5,1.4 .8,0-.2,1.3 .1,1.5-1.5,.7-2.3,.2-1.8,5.9-4.1,12.6-1.6,5.3-2.2,6.6-.7,1.9-1.3,4.8-.2,4.4-1.1,1.4-3,1-7.4,2-5.9,.8-1.6,1.4-3.6,7-5.1,7.3-1.5,2.4-2.3,3.3-2.6,4.4-4.4,6.9 4.3,0 1.9,0 3.9-1.2 7.9-3.1 4.4-2.5 .3,.4 8.7-6.3 1.3-.4 2.9,0 3.4-.7 3.4-.2 3.1-.1 2.4-.2 .4-2.8 1.4,.2 .4-1.9 .6,.1 .6-3.2-.9-.1 .1-.9 2.5-1.4-.1-1.3 .7-1.3 .9-.3 .4-1.4 1.6,.1 .9,.4 3,2.2 .5,.1 3,2.1 2.3,.7 0,.4 2.5-.5 2.6-.1 1.3,.5 2.1,1.4 .9,1 1.1,.1 .9-.3 1.3,.6 2.1-.2 1,.7-.7,1.4 1.1,1.1 1.4-.7 1.2-1 1.2-.6 1.1-1.6 1.8-.1 1.7,.3 .6-.2-.4-1 .7-.1 3.2-1.8 1.8-.4 2.4-1.1 .7-.8 1.3,1 2.3-.1 1.2,.8 1.4,2 3.1,1 1.4,.2 1.4,1.7 1.1,.6 1.1,1.2 .4-.4 .6,.7 2.1-.5 1.2-1.1 3.1,.1 1.5-.7-.4-.7 3.5-1.6-.1-1 .5-1.3 .1-1.2 .4-.2 2.5,0 2.2,1.4-.4,1.2 .4,.3 .3,3.5 .2,.6-1.3,1.7 .1,1.5 .4,1.2 1.1,2 .8,1.9-.5,.5 .1,.9 .8,.2-.7,1.4 1.3,.8 .1,.7-.6,1.8-.2,1.5 .3,1.8-.7,3.1-1,.9-.1,.9 1.8,.9 .5,1.7 1,1.1 1,1.7 1.9,1.3 .6,1.2 .1,1.1 1.1,1.8 1,.4 .5,.7 1.5,.6 1.5,1.7 1,1.4 .9,.3 .9,1.5 1.6,2.2 3.2,.1 .2,2.6 .4,1 4.3-1.3 5.8-1.3 4.6-.9 10.5-.2 .4-7 .4-9.9 .3-4.7 .1-3.5 .3-7.6 .8-4 .2-3.7 .2-5.9 .1-7 .3-3.3 1.3-3.3 2.2-2.8 .5-1.3 .3-2.4 2.2,2.5 1.1,1 1.5,.8 1.9,.2 .2-1.1-2,0-1.7-1.2-2.6-2.8-4.9-4.1-4-2.4-1-1.3-.6-1.7-.3-1.9-.1-6.9-12.4-.5-7-1.5-4.2-2.6-10.1-4.1-1.6-2.6-12-8.3-4.6-2.5-14.1-6-9.4-5.3-3.3-.9-.6-.7z",
      영등포구:
        "M300.2,459.4l.3,.7-1.4,.5-3,3.3 1,5.7 1,2 2.5,.6 1.4,2.9 2.6,5.8 5.2,13 .7,3.9-.2,3.8-3.4,7.9-3.6-1-1.9,3.6-1.5,2.4-1.5,1.7-2.2,1.3-8.2,3.7-2.8,3.1-.9,4.5-.6,4.2 .1,.4-.4,4.5 .1,3-.5,3.6-.1,4 4.8,2.6 3.6,2.4 7.4,4.3 4.7,2.5 2.6,1.7 1.8,1.5 1,1.4 2.7,4.7 2-.1 1.4,2 3.6,1.8-2.9,1.9 .3,2.9 0,1.9-1.4,7.6-.2,4.7 .3,9.3 .7,4.4 2,7.5 4.3,14.5 .9,2 1.5,2.2 2.3,2.5 4.4,3.1 .8-.1 .8,.4-.2,.5 2.7,.8 2.1,.3 4.4-6.9 2.6-4.4 2.3-3.3 1.5-2.4 5.1-7.3 3.6-7 1.6-1.4 5.9-.8 7.4-2 3-1 1.1-1.4 .2-4.4 1.3-4.8 .7-1.9 2.2-6.6 1.6-5.3 4.1-12.6 1.8-5.9 2.3-.2 1.5-.7-.1-1.5 .2-1.3-.8,0 .5-1.4-3-.7-1.2-.6 2-3.4 5.3,1.2 9.3,.1 7.3-1.8 8.3-2 6-1.3 7.8-3.4-2.3-2.5-1.8-4.2-20.6-21.8-5.4-5-5.8-3.7-9.4-4.7-6.4-2.3-24.5-5.9-2,.2-1.7,1.7 .3,.5 1,.2 1.3-.9 2.1,.4 .8,.8-.9,.6-5.4,.2-.8,1.1-1.9-1.4-1.2-.2-2.9-2.7-1.7-3.5-1.6-.7-1.3-1.8-31.3-24.7-.9-1.3-1.7-.7-3-2.9-.1-.7-.9,.2-.5-.4zM399.7,491.3l3.9,1.8 3.2,.8 1.4-1.2 0,0zM331.2,470.1l-1-.7-2.3-1.4-.8,.1-5.3-2-.9,.1-.5,.5 0,1 1.8,2 9.5,6.1 3.6,1.6 1.1-.1 .9-1 0-1.4-2.5-3.1z",
      금천구:
        "M327.4,655.5l-.3,1.5-5.5,1.3-.3-.6-1.1,.7-2.5-.2-10-2.1-3-1-2.1-1.5-1.2-1.3-3.8-5.7-2.1-1.5-6.5-5.8-3.4-2.4-2.4-.6-2.1-1.2-3.7,2.1-1.6,.7-3.7,.7-1.7,.9-.4,.7-.8,.4 1.9,6.6 3,8.3 2.4,5.5 2.6,5.4 1.5,2.8 3.2,5.5 1.8,2.7 6.9,10.3 11.2,16.5 1,2.7-.5,1.8-1.1,.3-1.7-.9-1.9,.8-.2-.4-1.5,1 .3,.3-2,1.4 .4,1.6 1.6,.1 .5,2.5-1.1,1.3 .1,1.3 .6,1.2 0,2.5 2.2,2.3 1.8,.2 1,1.3 1.4-.3 .9,1.9-.8,.7 .2,.8 .8,.5 .4,.8-.5,2.2 .3,1.2 1.5-.5 1.4,.5 2.5,.1 .8,1 .7,.1 .9-1.8 .9-.7 1.5,.4 1.7,5.2 2.1,5.7 .6,1.5-2.1-.3-1,1.7 .2,2.7 .2,1 1,1 .7,1.4 1.2-.4 1.8,.7 1.4,1.1 1.6,1.6 .6,2.3 1.1,2.1 .2,1.5-.2,1.2 .3,3.3 1.2,2.1 1.8,.2 .3,1.3-1.8,.6-1.2-.3-1.2,1.1 .4,1.4 1.1,1.9 1.4,.6 .9,.9 1,1.8 .6,.2 2.2,1.7 .7,1 .8,.1 .2,5.3 5.1,.2 3.3,.4 1.7,.8 2.2-.2 1.2-.4 1.3-1 1.1-2.3 1.2-.8 1.1-3.9 .7-.9 .5-1.8 1.2-.9 .9-2 .9-.3 1.1-1.4 2.7-2.5 2.8-.1 2.6-1.1 2.8,1.6 3.4-2.5 1.1-1.5-.1-1.1 .6-2.3 1.8-3.1 .4-1.7 1.3-1.5 .8-.5 .2-.9 1.1-1.3 1.1-1.8 .9-1 1.5-.7 1.8-1.7 1-.3 1.4-2.7 2.3-1.1 3-2.4 1-1.4 .1-2-.4-.5-2-.7-1.5-1.1-3.2-3.4-1.5,.1-2.6-3.9-1.6-.7-.4-1.6-.8-1.6-.5-3.4 .1-1.5-.8,1.2-2.8-.7-3,.2-1.3-.4-.8,.1-2.6-.8-1.6-1-1.4,.2-3.4-.1-1.2-1-.4-1.7 .5-.9-.5-1.7 .1-.7 .6-.9-.3-2.6 .4-1.4-1.1-1.2 .1-.8-.8-1.9-1.3-1.7-.2-1.5 .3-1.2 .9-.8 .8-1.7-3.1-1.3 0-1.3-1.7-1.1-.6-1.8-.8-1.8-.2-.9-1.5-.8-.3-.9 0-1.7-1.4-2.9-.3-1.1-.9-1.3 0-.7-1-2.3-.8-1.2 .6-.7 1.7-.7 .8-.1 2.6-1.4 .6-.7 .5-1.4 .1-.9 1.9-.2-.1-1-.9-1.2-.1-1.6 .8-2.5-.8-3.6-2.3,.6-.2-.8-.5-.2-1.8,.4-.6-1-.4-1.5-.3,.1-.3-1.3 .8-.2-.4-1.5 2.2-.5-.5-1.9-17.3,4-3.2,.6-2.8-2.9z",
      구로구:
        "M156.5,573.2l-2.1,1.1-.8,.1-.1,2.4 .3,2 .6,1.1-.3,.8-1.2,1.1-.4,1.4 .6,.6 .4,1.3-1.6,2.7 .1,1.3-.7,1.6-2,1-1.7,1.2-1,1.8 .2,2.8-.6,1.1-1.4,1.6-1-.1-1.6,.6-.4,1-2,1.2-2,.8-1.4-.7-1.8-.1-1.7-.7-.9,.1 .1,2.8-1.1,1.2 .2,1.3 .9,1.5 .4,1.1 .7,.6 0,.8 1,.9 .3,2.5 .5,1 1.2,.5 .6-.6 .7,.4 .9,1.8 4.4,2.7 1.6-.2 2.1,.9-.2,.6 .9,.6 .8,0 1.3,1 1.2,.2 1.3,.7 .7-.1 1.4,.9 .5,1.6 .1,1.5 1.1,3.2-2,2-.6,1-1.4,.4-.9,1.1-3.1,1.2-1,.6 .3,.4-.4,1.1 0,1.4-.4,1.1 .5,1.2-.1,.7 .4,3.5 .8,.8 0,.9-1.1,2.6 .4,8.1 3.6,4.8 1,.4-.1,2.5 .6-.2 .4-1.2 2.6-.6-.1-.6 1.2-.4 .7,.3 1.1-.6 3.9,.9 3.7,.3 2-.2 1.2-.5 .8-1.2 .2-.8 1.5-.9 .3-.7 2.8-.7 .1,.5 3.1,2 .6,0 1,.6 .1,.7 1.6,2 1.9,1.2 3.2,.8 2-.7 2.5-.5 1.4-.7 .5,1.6 .7,1 2.3,.5 2-.6 1.9-.3 1.3,.3 .8,1.2 1.7-.4 .1,1.6 2.1,.5 .4-1.3 .1-1.9 .4-2.9 .3-3.7 .4-7.4-.2-3.3 1.2-2.1 1.3-1 2.7-.9 0,.7 2.1,.5 1.9,.8 2.4,.3 1.9-.2 1.5-.9 1.5-1.3 1.2-1.4 1.2-2.3 1.9-4.3 1.6-1 4.3-1 1.1-1.2 7-10.1 1.4-1.6 2.7-1.6 1.7-.2 2.3-.8 1.6-1.4 .8-1.4 1.8-1.7 1.4-.6 .5-.5 .6-1.5-.5-2.2 .8-1.3 1.6-.7 .7,.4 1.5,3.1 .2,4.3 .6,.7 .2,1 1.3,.3 1.7,2 1.7,.1 .6,.2 .7,1.2 2.8-1.6 1,0 .3,.6-.6,2.7-.4,.9-.9,0-.1-1.6-1.5,.6-.5,.8-.1,1.4 .6,2.7 2.5-1.3 1-.1 1.2,1 .9-.4 1.4-1.3 2.7,3.2-.2,1.2-2.3,1-1.1,1.2-1.1,.5-.4,2.5-.5,1 3.7-.7 1.6-.7 3.7-2.1 2.1,1.2 2.4,.6 3.4,2.4 6.5,5.8 2.1,1.5 3.8,5.7 1.2,1.3 2.1,1.5 3,1 10,2.1 2.5,.2 1.1-.7 .3,.6 5.5-1.3 .3-1.5 .9-2.5 2.7-4.6 3.8-5.4 2.1-3.3-2.1-.3-2.7-.8 .2-.5-.8-.4-.8,.1-4.4-3.1-2.3-2.5-1.5-2.2-.9-2-4.3-14.5-2-7.5-.7-4.4-.3-9.3 .2-4.7 1.4-7.6 0-1.9-.3-2.9 2.9-1.9-3.6-1.8-1.4-2-2,.1-2.7-4.7-1-1.4-1.8-1.5-2.6-1.7-4.7-2.5-7.4-4.3-3.6-2.4-4.8-2.6-.1,1.6-2.2,5.6-7.6,11-3.8,5.5-1.5,4.5-1.3,4.4-4.7-1.2-2,2.2 .1,.5-3,0-1.9-1-.9-.1-2.1-.8-2.3,0-.3,1.5-1.1-.2-1.6,.4-.8-.8-.8-1.7-.8-2.4 3.2-4.2-1.7,.8-1,1.3-3.1,.9-.2-.1-2.5,1.3-4.5-9.4-2.9,1-.8-.1-1,.5-.3,.9-.6,.4-1.2-1.8-.2-.8-2.4-1.1-.5,.1-2-.9-1.8,.4-.2,.3-1.8,.9-2.6-.3-.9,1-.7,.2-.7,1.9-.9,.6-2.5,.6-.9-.5-1.4,.3-.8,.9-2.3,1 .6,1.6-1.2,.5-.8,2.1 .5,1.8 0,.8-1.5,.6-.3,1-3.4,1-.5-.4 .1-1.9-1.3-1.1-1.5-.1-.8-.4-.9,1.4-.7,.3 1.2,3.7 .1,.7-1.6,1-.5,1.2-1.7,.9-2.1,.1 1.5,2 0,.7-2.1,.5 1.4,.8-.1,3.8-1.8,.5-.7-.2-.4-1.5-1.5-.2 .3-.9-.6-2.4 .3-1.9-.5-1.7-1.1-1-3.1-1.1-1.1-.9-.1-.8-2.7-1.9-1.2-.4-.9-1.4-.1-1-1-1.5-1.3-.9 .1-2.1 1-1.6 0-1.5-.7-.6-3.4-.4-.4,2.3-3.9-.8-5.9,.8-.1-.2z",
      강서구:
        "M102.6,300.1l-.6,1.8 0,1.9 .3,1.1-.3,1.2-1.6,.1-1.8,.6-1.1,.9-1,2.2-.6,1.9-.4,2.4 .2,3.5 .3,2 .7,2.4 2.5,5.6 1.8,2.9-.5,0-.4,1.9 .4,2.7 3.6,6.2 .1,.8-.2,2.1-.2,.3-4.2-.9-1.1,1.2-.2,1.9-.9,1.3-1.2,3.1-.8,1 .1,3.1-2.6,2.9-.8-3.9-2,0 .4,3.4-2.4,1 .5,1.1 0,1.7-.7,1.3-.7,3-.5,.3 .3,8.9-.6,.9-1.1-1.4-1.1-.1-5.5,0-1.5,.1-.6,.8 .4,2-.8,.4-1.1-1.1-2.8,3.3-2.7,.9-3.1,2.3-1.1,.9-2.1,1.3-.7,1-.6,3.1-.9,1.2 .2,.5 1.6,1.6 .2,1.5-.3,1-3,.6-1.3,0-.3,.3 1.5,1.9 1.2,.9-.4,.8-1.5-.3-1.2,1.8-.5,2.4-.3,0-.6-1.4-1.5-1.4-.4,.2 0,2.5-2.8,.9-1.1,.9-1.4,2.2-.2-2.3-.4-1-2-.7-.1-2.5-1.2,1-.7,1.6 1.2,2.4 .1,1.5 .6,1 0,.7 1.9,2.4 1.1,1.1-.2,3.3 0,2.9 2.2,0 .7,3.4 .1,1.7-.3,.9-1.4-2.2-2.7-3.1-1.1-.2-.1,1.8-1.8,.1 .7,.8-1.3,1.1-.6,.9 .4,.8-.5,.6-.7-.7-1.8,1.2-1,1.8-1.9,.3 0,.5 2.8,2.8 .1,.5-.8,.7-1.3,.5-2.8-.3-2.8-.2-.8,.2-1.3,1.1-.3,2.8-3.2,.5-5.3,0-1.5,.8 .7,.6 1.6,.4 1.3-.1 2.2,.9-.6,.8 .7,1.4 1-1 1.2,.5-.3,2.3 .7,.5-.1,1.2 1,.7 .4,.7 3.8,6.3 2.1,3.8 8.1-.8 1.7,.2 1.9,1.3 8.2,6.3 .9,.3 2,0 9.1,0 1.5-.6 2,.1 1.4,1.9 3,3.5 .9,.8 1.6,.8 1.2,.2 3.3-.1-.5,2.8 .1,.9 .5,1.1 0,1 3.5,.8 3.4,.3-.3,1.7-2.2,4 .5,3-.3,3.1 1.3,4.3 .9,0 4.8-3.9 1.9-.9 1.1,.2 1.4-1.1-.2-1.9 .9-.4 .6-2.6 .6-1.2 .2-1.4 .7-.2 1.5-1.2 .9,0 2-1.7 0-.5-.9-1.4 0-.8 1.5-.4 1.3-1.4 1.1,.6 1.4-.1 2.5-.7 2.1-.2 4.8,.1 2-.1 .9,.3 .7,1.5-.5,.7 1.8,1 .3,1.1 1.5,.5 2.2,1.2 1.2,.3 1.5-3.4 .3-1.1 .6-1 .5,.9 2,2-.4,1 .4,2.4 4.5,.4 2.4-.4 5-.3 2.1-.1 3,.3 3.1-.6 2.6-.7 .3,.4 1.4-.2 1.2-.5 1-1.3 1-.6 1.5-3.8 .2-2.2 .8-2.1 .4-2 1.8-2.8 1.1-.4 .7,.4 1.3,2.1-.1,1.8-.9,2.2 .2,1.8 .5,.8 .4,2.1-.4,.7-.1,1.9 .5,.5 .3-.6 6.2-.2 1.5,5.9 2.9,5.8 .2,3-1.6,.7 5.2,10.9 4.7,9.8 3.8,7.7 6.4-1.1 12.7-2.8 34.3-5.4-.4-4.3-.5-8.6-.3-3.3-.1-3.4 .8-11.2-.1-1.2-3.2-7.6-.4-1.5 .1-1.1 .8-3.8 1.7-6.3 2.3-9.6 1.7,.9 9,6.9 3.8,2.9 3.9,1.6 3.7,.5 6.4-.4 2.9-.4 5.9-1.9 5.8,6.6 4.3,5.6 2.3,0-1-2-1-5.7 3-3.3 1.4-.5-.3-.7 2-2.2-10.5-8.7-5-2.5-6.6-4.4-6.2-2.4-15.2-15.3-4.5-3.6-58.2-42.6-6.3-3.7-21.2-10.5-6.4-5.9-10.6-6.1-3.9-3.6-4.1-2.4-12.7-11.4-5-7.2-10.8-13.4-5.7-5.3-4.1-6.4-2.3-2.3z",
      양천구:
        "M151.8,482l-.6,.5 .5,.9 1,4.1-.3,1.5 .4,3.6-.7,1.7-.4,1.8 .1,.8 1.6,1.6 .4,1.5 1.8-.2 0,3.3 1,1.6 .1,.9 1.4,1.6 .4,1.6 .8,1.3 1.1,.9 1.3,.3 1-.2 1.6,.6 1.8,1.6 .3,.8-.6,1.2 .1,1 1,3.8 .9,.5-1.3,.6-.3,1.5-.5,0-1.8,1.7-1.6,.6-.3,1-1,.7 .1,.9-.7,1.8-.8,.9 .1,.9 .9,1.7-.4,1.6 .3,2.1-.2,3.5-.3,.7 0,1.1-.4,1.7-1,1.6-.3,.8-2,2.7-1.3,1.5-.1,.9 .4,.9 .3,2.2 2,1.4-.1,1.4 .6,1.7-.6,3.7-.6,2-.1,1.8 .8,2.5-.1,2.4 1.1,1.8 .1,.2 5.9-.8 3.9,.8 .4-2.3 3.4,.4 .7,.6 0,1.5-1,1.6-.1,2.1 1.3,.9 1,1.5 .1,1 .9,1.4 1.2,.4 2.7,1.9 .1,.8 1.1,.9 3.1,1.1 1.1,1 .5,1.7-.3,1.9 .6,2.4-.3,.9 1.5,.2 .4,1.5 .7,.2 1.8-.5 .1-3.8-1.4-.8 2.1-.5 0-.7-1.5-2 2.1-.1 1.7-.9 .5-1.2 1.6-1-.1-.7-1.2-3.7 .7-.3 .9-1.4 .8,.4 1.5,.1 1.3,1.1-.1,1.9 .5,.4 3.4-1 .3-1 1.5-.6 0-.8-.5-1.8 .8-2.1 1.2-.5-.6-1.6 2.3-1 .8-.9 1.4-.3 .9,.5 2.5-.6 .9-.6 .7-1.9 .7-.2 .9-1 2.6,.3 1.8-.9 .2-.3 1.8-.4 2,.9 .5-.1 2.4,1.1 .2,.8 1.2,1.8 .6-.4 .3-.9 1-.5 .8,.1 2.9-1 4.5,9.4 2.5-1.3 .2,.1 3.1-.9 1-1.3 1.7-.8-3.2,4.2 .8,2.4 .8,1.7 .8,.8 1.6-.4 1.1,.2 .3-1.5 2.3,0 2.1,.8 .9,.1 1.9,1 3,0-.1-.5 2-2.2 4.7,1.2 1.3-4.4 1.5-4.5 3.8-5.5 7.6-11 2.2-5.6 .1-1.6 .1-4 .5-3.6-.1-3 .4-4.5-.1-.4 .6-4.2 .9-4.5 2.8-3.1 8.2-3.7 2.2-1.3 1.5-1.7 1.5-2.4 1.9-3.6 3.6,1 3.4-7.9 .2-3.8-.7-3.9-5.2-13-2.6-5.8-1.4-2.9-2.5-.6-2.3,0-4.3-5.6-5.8-6.6-5.9,1.9-2.9,.4-6.4,.4-3.7-.5-3.9-1.6-3.8-2.9-9-6.9-1.7-.9-2.3,9.6-1.7,6.3-.8,3.8-.1,1.1 .4,1.5 3.2,7.6 .1,1.2-.8,11.2 .1,3.4 .3,3.3 .5,8.6 .4,4.3-34.3,5.4-12.7,2.8-6.4,1.1-3.8-7.7-4.7-9.8-5.2-10.9 1.6-.7-.2-3-2.9-5.8-1.5-5.9-6.2,.2-.3,.6-.5-.5 .1-1.9 .4-.7-.4-2.1-.5-.8-.2-1.8 .9-2.2 .1-1.8-1.3-2.1-.7-.4-1.1,.4-1.8,2.8-.4,2-.8,2.1-.2,2.2-1.5,3.8-1,.6-1,1.3-1.2,.5-1.4,.2-.3-.4-2.6,.7-3.1,.6z",
      마포구:
        "M431.9,497.6l.1-1.1 1.1-.2-.3-.6 2.2-1.5 .2,.4 2,1.1 .3-1.8 .7,.6 2.5-.1 1.7-.9 2.5-.4 1.3-.5 2.1-1.5 .9-1.2 .7-.5 .2-1.9-.1-1.2 1.5,.7 .8-1.5 1.4-1.1 1.2-.3 1-.6 1.2-2 .8-.6-.2-.6 1.3-1.9 .5-1.6 1.2-.8 1.4-1.9-2.1-1.1 .4-1.3 .1-1.6 1-2.5-.7-.2 .3-1.2 1.4,.1 1.2-.9 2.7-1.6-.2-.7 .8-.3 0-.8 .9-.7-.6-.6 1-.7 1.6-.3 .6-.3-.6-.8 .5-.6-.1-.8 1.1-.1 0-.5 1.1,0 .3,.5 1.3-.2 .8-2.7-1.6-2.2-.6-1.1-1.3-1.5-.1-.4-.7-1.7-.7-.8-.2-2.6 .1-1.5 .6-1.5-.6-2.9 .8,0 .8-1.6 1.5-1.5 .3-2.1-.7-.4 .3-.5 0-2.1-.5,.3-1.7-1.1-1,0-.3-1.1-2.1,1.9-4.2,4.4-.3-1.7-3.4-.4-.1-.3-4.7,.2 0,.2-6.9,.6-4.7,.3-7,.5 0-.3-4.8,.4 0,.3-8.3,.8-9.4,3.8-1-.2-3.1-1.4 .1-.2-2.6-1.2-9.1-4-6.5-3.1-1.2-.6-.1-1.6 .4-4.6 .9-2.1 2.5-4.6-3-3.2-2.8-2.4-2.1-1.2-2.2-.8-9.1-2.1-1.7-.6-3-1.5-6.6-4.2-6.7-3.8-3.9-1.9-4.8-2.8-2.4-1.3-5-3-2-1.4-3.1-2.6-2.1-1.9 3.4-4.1-.7-.8-2.6,3.6-8-6.9-.4-1.1-.1-1.4-2.9-3.8-.9-1-2.2-1.7-3.6-1.5-1.1-.7-7.4-6.3-1.2-1.2-5.8-6.1-2.8-3.3-5.4-5.6-2.3-2.5-4.5,3.7-.6,1.9-1.2,2.5-1.1,4.4-1,.6-1.4,.1-.7,.4-2.2,5.9 .8,.9 1,0 .1,.7-1.7,.9 .8,2.2-.5,1.8-.9,1.4-.4,1.2 0,1.7-.4,1.4-.6,.8-1.8,.2-4,2-5.9,3.1-6.2,1-3.1,2.7-1.4,2.2-1,.6-4.7-3.3-4.1,2.2-4.8,.4 2.7,1.2 2.1,1.7 .7,1.5 1.8-1.4 .4,.3-1.2,1.6 .1,.5 2.7,1.1 4.9,3.4 2.8,2.6 .9,1.4 2.2,.2 2.6,1.6 5.3,5.1 5.1,6.3 4,3.4 12,4.8 5.6,3.9 1.3-.3 1.4,.5 .5,.6-.6,1.1 11.6,8.1 13,12.5 32.4,28.3 6,2.8 8.1,1.9 3.2,.2 4.3-.2 1.8-.5 .3-.5-.8-1.2 1.5-1 1.3,1.5 4.3-2.1 3.2-.7 3.1,.1 2.1,.4 6.8,3.6 8.7,3.8 3.9-.5 2.6,.1 1.5,.6 4.8,3.8 9.2,15.3 2.9,1.7 .8,0zM408.2,492.7l.4-.5-.5-2.3-2.4-2.7-.2-1.1-2.2-.7-2.1-1.4-5-2.3-2.7,1.8-.4,1 .8,.4 2.4-.5 1.9,.3 .3,.4-.5,2.2-1.9-.1-1-.7 1.5-1.2-.2-.5-1.1,.7-2-.5-.3,.5 .5,1.4 .7,.2 1.2,2.2 4.3,2zM390.8,477.7l-2.3,.4-3.2-.2-2.5,.4-3.1,1.6-.8,1.2 10.4,4.3 2.9,.6 .6-.1 .1-2.2 2-2-1-2zM331.2,470.1l3.6,1.7-.5-.5-1.7-.6 0-.6-1-.5-.5,.3-.9-.5z",
      서대문구:
        "M443.4,287.7l-1.7,.1-.6-.9-1.1,.3-.8-.2-.9,.8-1.7-.4-.4,1-1.3,1.1-1.1,3.3-1.7,1.8-.5,1.5-5.1-.1-.9,.5 .1,.5-1.3,1.4-.4,.8-.2,1.7-.7,.5-1.7,.3-1.3-.2-.3,1 0,1.9 1,.2 1.1,1.7 1,.4 .3,.6-.7,5.2-.5,1.2-3.1,2.4-1.6,.7-1.9-.4-1,.7-1.2,.3-4.1,2.2-3.1,.6-1.6,1.1-1.1,2.1-4.1,2.3-.6,.7-1.2,2-2.1,2.3-1.5,3.1-.9,3.4 .5,3 0,3-2.1,1.8-2.5,1.7-1.4,.4-.3-.6-2.6,.2-.7-.1-.7,3-1.7,1.5 .6,.8-.1,1-.5,.3-.7,1.2-.4,1.3-.7-.2-.8,.9 .2,.9-1.3,.4-.8,1.2-2.3-.3-.3-.9-1.8-.2-.2,.4-1.1-.3-1.3,.2-1.4-.3 0,.3-3,.4-.1-2-.6-1.1 .5-.8-.2-1.3 1.2-1.7-.3-.4-1.3,.6 .5-1.4-5-2.7-.8-.3-.7,2-.6,.9-7.9,9.3-6.4,7.6-4.5,5.5-2.7,3.8-3.4,4.1 2.1,1.9 3.1,2.6 2,1.4 5,3 2.4,1.3 4.8,2.8 3.9,1.9 6.7,3.8 6.6,4.2 3,1.5 1.7,.6 9.1,2.1 2.2,.8 2.1,1.2 2.8,2.4 3,3.2-2.5,4.6-.9,2.1-.4,4.6 .1,1.6 1.2,.6 6.5,3.1 9.1,4 2.6,1.2-.1,.2 3.1,1.4 1,.2 9.4-3.8 8.3-.8 0-.3 4.8-.4 0,.3 7-.5 4.7-.3 6.9-.6 0-.2 4.7-.2 .1,.3 3.4,.4 .3,1.7 4.2-4.4 2.1-1.9 1.3-1.2 3.5-.1 1.4-.8 2.3-1.7 3.8-3.2 2.3-1 3.8-1.1-5.3-9.3-1.4-1.9-1.9-2.1-3.4-4.7-2.9-3.4-1.4-1.9-4.2-5-2.6-3.5-5.1-5.6-1.1-1.1-1.9-2.5-2.1-3.2-3.1-4.1 4.3-.3 .6-1 .1-4 1.7-.5-.1-1.1 1.2-.9 1.2,0 1.7-.3 1.9,.4 3.5,2.2-2.2-4.9-6.8-6.3 1.8-8.3 2-6.9 .2-1.6-.3-2.7-1.8-3.4-1.7-3.8-1-3.3-.1-2.3 .5-.9 1.4-5.7-.4-1-1.4-.2-.5,.6-4.6-.2-1.3-1.7-1.8-3.7 .1-6.5 1-.9 .7-4.6-.4-2.3-1.3-1.6-.2-1.8-2-2-.3-1.2-.8-1.6-1.4-.2-.8,1.3z",
      은평구:
        "M493.6,216.4l-3-1.1-1.1-2.9-1.5-3.1-.9-2.4-.8-.6-.5-1.1 .2-6.2-.9-.8-.6-1.5-.9-.5-1.4-2-.9-.6-.9-1.1-1-1.6-1.3-1.8-.8-1.8-1.3-.9-3.1-.8-2.1-.4-.9-2-.1-2.8-1.2-1.7-1-2.2 .2-1.6-.9-2.9-.7-.7-5.7-2.4-.3-.3-.1-3.6-1-4.8-.5-1.3-2.3-2.6-.6-.6-.5-1.3-.9-.6-1.2-2.4-1-.1-.9,1-1.3,.7-1.4,0-2.5-.7-.9-1.5-.7-.8-1.8-.9-1.1-1.8-1.4-.9-1.8-.7-.3-.4-.3-2.7-.6-1.7-.6-.1-1.7,.3-1.8,1-.8,0-3.5,1.1-2.5,1-2,1.5-1.4,.6-1.5,1.2-.6,1.1-1.7,2.2-1.3,2.2-.3,.8-3.7,7.2-5.2,3.7-.6,.2-7.3-.1-2,.1-1.5,.5-1.9,1.2-7.9,7.3-4.7,3.1-2.1,1.2-2.6,1.1-2.9,.4-4.9,.1-2.7,.5-2.4,.9-3.2,.6-.7-.1-1.1-1.2-.6,.4-1.3-.4-1.2-1-2-.9 .2-.2-2.4-1.6-.8-.7-3.4-2.3-3.7-1.7-.6-.5 .4-.8-3.1-1.2-.1,.3 2.4,2.4 .7,.4 .2,1.2 1.3,1.3 .6,.2 .3,1.6 7.4,4.2 3.6,1.7-.5,3-.1,2.6 .6,1.5-.4,1.1-1.3,1.2-.8-.1-1.4,.5 .1,2.8-1.3,3.5 .4,2.2 .1,1.9 .7,1.5 .2,2.4-.3,1.2-.7,.9-1.4,.1-1.4,1-1.1,1.7-1.6,1.1-.3,.8-.9,.3-2.1,2.5 .2,2.3 .7,.8 .5,2.5 .6,1.1 2.5,1.9 .7,1.4-.1,.7 .7,1.1 0,1.1-.7,2.1-.1,3.2-.8,1.4-1.8,1.9-1.2,.8-1.4,2.1 .7,1.6 .1,1.3 1,.7 0,2.5-.4,.6-1.6,1.1-.9,.2-1.3,2-.6,2.1 .3,.9-.3,1.2-1.3,.5-2.7,.3 0,1.6-.9,1.1 .5,1.5-1.6,1.5 0,.6-1.2,1.9-.2,1 .3,1.2-.6,1.2 .2,2.1-.7,.9-.6,1.5-.7,1.2 .6,1.2 0,3.8 .7,1 .8,1.9 .2,1.8-.3,1.4 .5,2 .3,3.2-1.2,3.4 .4,1.9-.1,1 .4,1 .3,2-.9,1.2-.6,.4-1.9,.1-.8,.3 .6,1.4-.6,1.8 .7,1.3-.2,.8 .9,1.5 .8,1.9 .1,1.5 .5,.6-.3,3.4 .1,1-.6,1.4 .5,2 0,1.4 .8,.6 .4,1.1 0,1.4-3,2.3-1.4,1.5-.3,1.1-1.1,.4-.8,1.7 .7,2 1,1.3 0,1.2-.3,1.8 .6,1.7-3.9,.9-1.3,1.5-1.4,1.1-1.4-.4-1.3,0-1.3-.5-1.4,.2-1.7-.9-1.3,.1-2,1.3-2.2,.7-1.1-.4-1.1-.7-2.1-.6-.4,.6-4.1,.5-.6,.2-1.5-2-1.9-1 .2-.7-.2-2.2-.8-1.2 .7-1.4 1.2-1.8 1-2.4 1.3-2.2-1.2,0-1.9-.5-1.9,.5-1.7,3.2-.9,1.4-1.2,1.4-1.4,.8-1.2,1.4 2.3,2.5 5.4,5.6 2.8,3.3 5.8,6.1 1.2,1.2 7.4,6.3 1.1,.7 3.6,1.5 2.2,1.7 .9,1 2.9,3.8 .1,1.4 .4,1.1 8,6.9 2.6-3.6 .7,.8 2.7-3.8 4.5-5.5 6.4-7.6 7.9-9.3 .6-.9 .7-2 .8,.3 5,2.7-.5,1.4 1.3-.6 .3,.4-1.2,1.7 .2,1.3-.5,.8 .6,1.1 .1,2 3-.4 0-.3 1.4,.3 1.3-.2 1.1,.3 .2-.4 1.8,.2 .3,.9 2.3,.3 .8-1.2 1.3-.4-.2-.9 .8-.9 .7,.2 .4-1.3 .7-1.2 .5-.3 .1-1-.6-.8 1.7-1.5 .7-3 .7,.1 2.6-.2 .3,.6 1.4-.4 2.5-1.7 2.1-1.8 0-3-.5-3 .9-3.4 1.5-3.1 2.1-2.3 1.2-2 .6-.7 4.1-2.3 1.1-2.1 1.6-1.1 3.1-.6 4.1-2.2 1.2-.3 1-.7 1.9,.4 1.6-.7 3.1-2.4 .5-1.2 .7-5.2-.3-.6-1-.4-1.1-1.7-1-.2 0-1.9 .3-1 1.3,.2 1.7-.3 .7-.5 .2-1.7 .4-.8 1.3-1.4-.1-.5 .9-.5 5.1,.1 .5-1.5 1.7-1.8 1.1-3.3 1.3-1.1 .4-1 1.7,.4 .9-.8 .8,.2 1.1-.3 .6,.9 1.7-.1 .6-.4-1.3-2.6 .7-3.8-.2-.6 1.4-1.8 .1-1.5 .7-1.7-.7-7.3 0-2.3-.6-2-1.6-2.1-.1-1-.7-1.5 2.2-1.8 .9-1.6-.1-2.9 .7,.2 1.3-2.5-.3-.8 .9-1 .1-.6-1.7-.9 .3-2.7 1.3-3.4-.2-1 1-1.4 2.3-1 2.3-.4 5.8-.1 6.4-9 3.3-.1 .7-.3 8.8-2.3 2.3-3.2 1.3,0 1.9,2.1 3.7-1.2 2.2-1.8 1.1-1.8 2.5-2.3z",
      노원구:
        "M797,249.7l-1.6-.5-2.1-1.5-.3-1.2-.9-2.3 .5-1.2 1.4-2 .7-1.9 1.3-1.5 .2-2.4-.1-2.5 .5-1 2.9-1.9 2.5-.8 1.2-2 1.2-1.5 1-.8 2.4-1.2 1.3-1.3 1.5-3.2 .5-2.2 .4-.4-.8-2.7 .6-1.5 .6-.6 .1-1.9 .3-.8-.7-1.6 0-1.1 .3-.8-.6-2.7-.6-1.8-.5,.2-1.4-.8-.9-2.2 .6-1.3 1-1 1.5,.1 .3-1.3-.6-1 0-1-.7-.9-.1-2.2-.2-1-.6-.7-2.8,.3-1.6-1.6-.2-.7-1.8-2.7-.3-1.2-1.7-.5-1.1-.7-1.3-.1-.9,.5-1.6-1.2-2.6,.7-2.1,0-.5-.4-3.3-.4-1.2-.4-.7-.5-1.5,.2-1.2,1.1-2.8,.3-.7-.4-1.9-.5-3.2,0-1.9-.3-.7-.6-.1-.8-.9-.7-.9-1.2-.3-1.2 .3-1.4-1.4-1.4-.9-2.1-.7-3.1 1.7-2.6 .7-2.3-.1-.8 1.8-2.6-1.1-1.5-1.2-2.7-.5-1.8-1.6-1.2-.6-1-.1-1-1.3,.7-1.5,2.5-3.2-.2-4.7-1.1-.7-.4-1.1,0-.7-1.2 5.5-2.1 9-4.2 7.6-4.1 2.1-4-.8-2.7-5.4-2 2.9-3.2-1.2-.9-.7-1.1 .5-1.6-.2-1.1-.7-.4-.3-2.3 .8-1.8 1.7-1.9-.3-3.2 .8-2.6 1.1-1.8-.4-.6-.1-2.2-.3-1.2 .5-.9-.5-2.6-1.5-.6-1-1.4-.1-1.9-.7-1 0-1.8-.4-.2-.1-1.7-.6-2.3-1-.8-.4-1.1-1.7-.6-.5-1.2-.5-3.7 1.4-1.2 .7-2.2-.1-3.4 3.1-4.3 0-.7 1.4-2 2.2-.9 .5-1.2 0-1.5 1-1.3-.1-1.4-.8-1.8 .3-.6-.4-1.5 .2-.4-1.1-.9-.1-.5 .9-1.9-2-.9-1.3,.6-1.3,.1-1.1-1.5-1.1-.6-1.4-.2-1.7,.2-1.5,.6-2-1.2-2.1,.3-.7-.3-1.5-1.6-1-.1-1.3,.5-1.8-.1-2.9-1.5 .4-.4 0-1.2-.9-2.3-.8-1.3-.4-1.3 .3-.9-.1-1.7-1.2-1.8-.6,.1-1.4-1.4-.5-1.3-1.7-1.7-.3-.6-9.2,0-.9-.1-1.6,1.3-1.6,0-.9,.5-1.5,.4-.8,.4-.9,0-2.2,1.7-.5,1.3-2.1,.5-1.5-.1-.7,.5-1.4,.2-2.3-.9-1.4,.9-1.2,1.7-1.2,3-1.9,1.3-2.7,3.3-.2,1-1.2,1.8-1.5,.6-.5-.1-1.6,.5-1.3,1-1.4-.5-1.8,1.6-2.6,.2-1.4-.9-2.1,.2-1.9-.7-1.1-.6-1.6-.5-1.1,.4-3.5,.2-.4,.2-5.1,4.6-1.3,1.6-1.5,0-.9,.3 1,2 1.6,4.3 .3,2.9-.4,3.8-1.1,1.7-1,5-.4,4.3-.6,3.5-1.2,4.2-.9,4-1,4.1-.5,5.4 0,5-.2,1.2 .4,2.9 1.5,4.2 2.7,4.8 .5,1 .6,2.7 .5,8.8 .9,3.5 1.1,3.4 3,4.7 .8,2.3 .3,2.4-.1,1.2 .1,5.6 .1,4.6 .6,3.6 1.5,3.8 1.6,6.8-.4,1.9-1.5,5.5 .1,1.6-.1,3.4-.3,2.5-1.8,.3-2.1-2.1-1.4-2-.6-1.4-1-3.1-1.5-4.4-.6,.7-.9-.5-.7,0-.2,1.4 .5,.7 .3,1.3-2.2,1-.6,2.2-.8,1.4-2.2,1.8-.6,.3-.2,.9-1.3-.1-1.5,.2 0,2.5 .5,1.5-.3,1.4-1,2.1-.3,2.1-.9,.2-1.2,2.8-.2,2.7-1.2,2.2 0,1.4-1,3.5-.9,1.1-1.5,.9-.6,1.1-2.6,3.1 3.2,2.4 1.2,1.3 2.3,2.6 1.7,1.5 3.7,2.2 1.3,1 1.2,1.5 2.7,4.4 2,2.8 5.7,7.6 2,2.5 1.9,2.1 3.8,3 1.7,1.7 1.3,2.1 2.2,2 5.8,3.8-.6,.7 1.1,.7 0,.9 2.5,1.7 .9,.2 1.6-.3 2.7,.2 1.9,.5 2.1-.4 .3-.6 3.5-2 .6-1 4.8-1.1 2.1-.9 .3-.3 .5,2.1 1.2,.3 2.2-1.4 13.4-6.1 2.6-1 1.5-.1 1.3-1.5 3.6-.9 1.3-.4 3.6-.4 1.8-1.2 .4-.6 2.1,0 2,.3 .5,.7 .8,.1 1.2-1 .9,1.2 5.9,2.9 1.1,1.2 1.8,1 2.7,.9 2.1,.4 2.3,1.4 2.1,.1 .1-.5 3-2.7 1.2,.4 1.9-.2 1.1-1.7 1.7-1.7 1-1.5 1.9-.4 2-.8 2.9-.6 0-.2 2.8-.9z",
      도봉구:
        "M670.8,57.9l-.2-1-.1-2.8 .2-1.8 0-1.5-1.4-5.8-.3-1.5-.9-3-1.7,.1-1,1.9-.5-.2-.7,.9-1.1,.8-2.6,.9-1.2-.1-.2-1.2-2.3-.9-.6-1.2-1.6-.4-.3-.3 .7-1.2 0-2.2-.6-.5-1.4,.6-1.3-1-.7,.1-1.4,1.1-.9,.3-1.7,2.1-1.2,.1-.7,1.3-1.2,1.1-1.7,.3-.9,.3-1,1.2-2,1.1-1.1-.6-2.4,1.4-1.6,.1-1.3,.4-1.4,0-.3-2.1-.5-.5-1.6-.3-.4-.3-.6-2.4-.8-1.5-.3-1.5-.8-1.4-.8-2.7-.1-4-1.1-4.1-.8-1.6-1.7-2.8-2.1-.5-.7,1.2-2.2,1.3-.6,.6-1.7,.6-1.2-.2-2.3-.9-2.9,.6-1.9-1.1-.6-.6-1.6-.9-1.1-.9-1-1.6-3,.4-2.1,.8-2.7-.3-.6,1.8-1.1,1.7-.5,1.5 .2,1.9-1,1-.6,.2-5.4,0-3.3,4-.9,2.4-2,2.2-.8,1.5 .1,3.1-1.2,3.6-.6,1.3 .6,1.2-.8,2.8 .1,4.1 .2,.8 1.1,1.3 .1,2.2 .5,1.2 .1,1.7-.4,3.6-.4,1.4-.7,.5 .1,2-.9,1.9 1.2,2.4 .5,.7 .2,1-.8,1.5-.7,3.2 1.1,1.5 3,.7 1.2-.2 3.5,.9 .9,2.5 .7,.6 1.1,2 .2,2.2 1.1,2.3 .2,1.5 1.7,2.8 1.5,1.2 1.4,1.9 1.7,1.8 1.7,2.7 2.6,5.1-.2,1.6-.6,1.8-1.2,1.4-1.6,1.1-2.9,3.5-.5,1.5 0,1.8 .7,2.3-.7,2.8 0,.8 1.3,1.6 .6,2.7 .4,.7-.7,.8-2.2-.4-1.1-1.2-.5,.2 .5,1.4-.2,2.9-.6,1.1-1,3-.5,3.3-2.3,13-.2,3.2 .3,1.7 1.2,3.4 1.3-.2 1.5,.5 .8,2 1.8,1.5 3.2,1.1 2.7,.3 1.7-.3 2.9-1 2.1,.2 1.1,.7 1,1.6 .7,.6 1.5,.7 3.2,.8 .7,.7 2.1,3.9 2.1,1.4 1.8,.9 5.3,4.1 2.5,2.2 2.2,1.6 2,1.9 1.1,2 .9,2.6 2.1,6.3 1.1,1.3 1.3,.8 3.2,1.1 1.4,1.2 .9,1.8 .7,3.7 .5,1.4 1.3,2 2.1,2.8 3.4,2.7 2.6-3.1 .6-1.1 1.5-.9 .9-1.1 1-3.5 0-1.4 1.2-2.2 .2-2.7 1.2-2.8 .9-.2 .3-2.1 1-2.1 .3-1.4-.5-1.5 0-2.5 1.5-.2 1.3,.1 .2-.9 .6-.3 2.2-1.8 .8-1.4 .6-2.2 2.2-1-.3-1.3-.5-.7 .2-1.4 .7,0 .9,.5 .6-.7 1.5,4.4 1,3.1 .6,1.4 1.4,2 2.1,2.1 1.8-.3 .3-2.5 .1-3.4-.1-1.6 1.5-5.5 .4-1.9-1.6-6.8-1.5-3.8-.6-3.6-.1-4.6-.1-5.6 .1-1.2-.3-2.4-.8-2.3-3-4.7-1.1-3.4-.9-3.5-.5-8.8-.6-2.7-.5-1-2.7-4.8-1.5-4.2-.4-2.9 .2-1.2 0-5 .5-5.4 1-4.1 .9-4 1.2-4.2 .6-3.5 .4-4.3 1-5 1.1-1.7 .4-3.8-.3-2.9-1.6-4.3-1-2z",
      강북구:
        "M574.8,67.1l-4.7-1.5-1.6,.5-1.3-.4-2.3,.3-.9,2-2.8,1.8-.5-.4-.9-1.6-.5,0-2.6,.9-2.2,.3-2.5,.7-1.8,2.3-2.3,2.1-1,1.3-2.5,1.5-1.2,1.4-.3,1.3-1.8,1.2-2.2,.7-.9,.6 1.9,1.9 .5,1.1 .4,2.3 .1,2.2-.4,1.7 .3,1.7 1.9,2.1-.3,1.9-.5,1 .5,2.6 1.1,2.2-.7,2.4 .1,1.7-.4,8.3 .1,1.4 1.1,2.2-.2,1.1-1.1,.9-1.8,2.7-1,.5-3,1.2-2.9,1.5-1,.3-2.7,0-.8,2.3-1.8,2-1.5,3.8-3.2,4.8-4.4,3.4-.9,1.5-2.8,.3-1.6,1.4-1.7,1.2-1.2,2.1 .3,.8 .2,1.9 2.1,3.1 1.1,3.3 .2,1.2 .9,1.5 1.6,1.2 .5,2 1.4,.8 1.4,1.6 .2,1.3 0,2.6 .1,.5 1.5,1.5 .3,.7 .3,2.4 .4,1.8-.5,1.6-.7,1.1-.5,1.7-1.7,1.5-.5,.7 1.3,2.7 .2,1.7 .9,1.1 .9,.5 1.5,.1 .6,1.6 .7,1.3 1-.3-.4,1.3-1,.9-.8,2.1-.6,3.8-.5,1.7-.8,1.7 .2,.3 2.2,3.2 1,.7 1.7,.2 2.3,2.7 3.2,2.2 2.9,2.1 1.8,1.9 1.2-.8 1.9-.5 .6,.2 .7,1.1 .3,1.4 1.3,3 .3,1.4 1.1,.5 .9-.4 3.7,2.5 4.4,5 3.4,4.5 1.9,.5 2.1-.3 1.4,.3 1.2,.7 2.9,2.2 2.4,.8 2.8-.1 2,.5 1.2,.7-.1,1.7-1,2.6 .2,1.3-.4,1.5 1,2-.1,.8 .9,2.1-.1,1.1 .9,1.1 .2,1.3 2.1,1 1.1,1.3 0,1.4 .3,.6 1.5,1.7 1.4-.1 .5,.5 3.4,1.7 1.6-.1 .8,.3 1.5,.1 .6,1.2 0,1 1.9,.1 .9-.5 3.1,1.1 1.3,1.7 1.2,.6 1.2,.1 .6,1.2 .6,.2 1.2,1.1 .1,.7 .7,.4 2,.2 1.1,.4 .5,2.9 .9-.6 3.8-1.7 2.2,.1 1.7-.6 .9-1.2 2,.3 1.5-.1 2.1,.5 3,.3 .2,3.4-.2,3.8 .4,1.9 9.8-6.5 4.8-3.2 1.1-.9 5.8-8-1.5-1-.2-1 2.5,1.1 2.5-2.4 2.3-2 3.7-3.4 1.8-2.6 2-4.6 1.4-2.6 1.2-1.3 7.3-5.4-2-2.8-2.7-4.4-1.2-1.5-1.3-1-3.7-2.2-1.7-1.5-2.3-2.6-1.2-1.3-3.2-2.4-3.4-2.7-2.1-2.8-1.3-2-.5-1.4-.7-3.7-.9-1.8-1.4-1.2-3.2-1.1-1.3-.8-1.1-1.3-2.1-6.3-.9-2.6-1.1-2-2-1.9-2.2-1.6-2.5-2.2-5.3-4.1-1.8-.9-2.1-1.4-2.1-3.9-.7-.7-3.2-.8-1.5-.7-.7-.6-1-1.6-1.1-.7-2.1-.2-2.9,1-1.7,.3-2.7-.3-3.2-1.1-1.8-1.5-.8-2-1.5-.5-1.3,.2-1.2-3.4-.3-1.7 .2-3.2 2.3-13 .5-3.3 1-3 .6-1.1 .2-2.9-.5-1.4 .5-.2 1.1,1.2 2.2,.4 .7-.8-.4-.7-.6-2.7-1.3-1.6 0-.8 .7-2.8-.7-2.3 0-1.8 .5-1.5 2.9-3.5 1.6-1.1 1.2-1.4 .6-1.8 .2-1.6-2.6-5.1-1.7-2.7-1.7-1.8-1.4-1.9-1.5-1.2-1.7-2.8-.2-1.5-1.1-2.3-.2-2.2-1.1-2-.7-.6-.9-2.5-3.5-.9-1.2,.2-3-.7-1.1-1.5 .7-3.2 .8-1.5-.2-1-.5-.7-1.2-2.4 .9-1.9-.1-2z",
      성북구:
        "M502.8,221l.6,2.6-.3,2.4-1.1,1.1 1.8,.1 3.5,1.2 3-2.2 1.3-.2 .9,.6 0,1.2-1.9,1.9-.5,2.9 .6,2-.7,1-.2,1.1 .4,.9-.6,1.8 2.2,3 .4,1.3 1.1,1 .3,1.7 .9,1.2 .2,2.5 1.4,2.7-.6,1.7 .5,1.7 2,2.6-.4,1 .5,.9-.4,1.3 1,1.1 1.7,.6 3.1,1.6 3.1,2.5 .8,3.2-.5,1.2 .1,1.8 .2,5.6-1.6,1.8-.6,3.3-.2,4.7 1.5,5.8 2.7,11.2-3.1,3.3-3.4,1.8-4.9,.2-2.7,.7 0,5.6 1,3.8 1.5,2.1 2.8,3.6 1.8,1.5 2.5,1.6 1.6,.8 2.3,.7 2.9,.4 1.6,.9-.9,1.2 .3,.6 1-.6 2.1-.3 1.8,.4 1.4-1.5 1.2-.1 2.4,.7 1.8,1.2 1.6-1.3 .8-1.3 .5-.2 2.3,.5 .9-.5 1.1,0 2.3-.8 2,.4 2.4-.2 1.1,.1 1.4,1.4 .8,1.9-.5,1.9-.5-.1 .1,1.2 1,.7 1,2.6 1.9,.8 .4,1.2 1.8,1.2-.1,1.8 1,.9 3,.2 1.4,2.3-.2,1.4 .9,.9 0,1.2 .7,2 .4,3-.9,2.3 .2,.8 2,1.6 1.1,1.2 1,1.9 2.3,.6 1,0 1-1.1 .6-1.4 .9-.8 1.6-.4 1.6,.6 2.4-1.1 1.9-1.5 1.8,1.1 2.1,0 .9,.8 .2,1.9 .7,.4 0,.9 .8,2 1.1,.6 .5,1.2 .1,1.6-.7,1.8 .2,.8 .9-.1 .6,.5 1.1-1.1 0-.5 4.8-2.2 1.2-.1 2,1.5-.5,.7 .8,.8 .7-.6 0-.9 2.9-2.4 4.5-4 6.1-5.2 .9-1 3-3.9 3.8-5.6 2.5-3.3 6.3-7.8-.2-.9 .1-2.9 6.2-.1 1.4-4.7 .9-2.6 .3-1.3 .9-2.6 .4-1.8-.1,2.2 .8,.2 1.3-3.2 .7-2.4 .5,1.4 1.4-1 1-1.2 1.8,2.6 2.1-.2 1.5-.7 1.1-.1 2,1.6 1.5-.6 1.2-3.6 1.8-1.9 .2-1.7 1.8-4.1 1-1.4 0-1.1 1.6-1.3 .8-.2 .9,3.4 .7,1.4 1.4-.4 1.7-1.3 2-.3 1.8-1.9 .8,.8 2-.8 2.4-.6-.1,1 4.2,.5 .2-.8 1.7-.7 1.2-1.2-1.1-.4-.2-.6 .4-2.2 .6-.9 1.5-.9 .3-1.2 .5-.5 1.7-2.4 3.5-.4 2.9-1.7 1,1 1.8-.1 .1-.8 2.3-1.2 .2-.7 1.7-.1 0-.8 1.5-.2-.4-7 4.3-.1 .2,7 2.6,.3 .1-2.3-.3-2.3-.1-6.8-.2-7.1-.1-5.5-.1-1.3-.5-2.1-.3,.3-2.1,.9-4.8,1.1-.6,1-3.5,2-.3,.6-2.1,.4-1.9-.5-2.7-.2-1.6,.3-.9-.2-2.5-1.7 0-.9-1.1-.7 .6-.7-5.8-3.8-2.2-2-1.3-2.1-1.7-1.7-3.8-3-1.9-2.1-2-2.5-5.7-7.6-7.3,5.4-1.2,1.3-1.4,2.6-2,4.6-1.8,2.6-3.7,3.4-2.3,2-2.5,2.4-2.5-1.1 .2,1 1.5,1-5.8,8-1.1,.9-4.8,3.2-9.8,6.5-.4-1.9 .2-3.8-.2-3.4-3-.3-2.1-.5-1.5,.1-2-.3-.9,1.2-1.7,.6-2.2-.1-3.8,1.7-.9,.6-.5-2.9-1.1-.4-2-.2-.7-.4-.1-.7-1.2-1.1-.6-.2-.6-1.2-1.2-.1-1.2-.6-1.3-1.7-3.1-1.1-.9,.5-1.9-.1 0-1-.6-1.2-1.5-.1-.8-.3-1.6,.1-3.4-1.7-.5-.5-1.4,.1-1.5-1.7-.3-.6 0-1.4-1.1-1.3-2.1-1-.2-1.3-.9-1.1 .1-1.1-.9-2.1 .1-.8-1-2 .4-1.5-.2-1.3 1-2.6 .1-1.7-1.2-.7-2-.5-2.8,.1-2.4-.8-2.9-2.2-1.2-.7-1.4-.3-2.1,.3-1.9-.5-3.4-4.5-4.4-5-3.7-2.5-.9,.4-1.1-.5-.3-1.4-1.3-3-.3-1.4-.7-1.1-.6-.2-1.9,.5-1.2,.8-1.8-1.9-2.9-2.1-3.2-2.2-2.3-2.7-1.7-.2-1-.7-2.2-3.2-1.2,.7-1.2-.4-2.2,1.9-.8,.2-1.4,2.6-.3,.3-1.6-.2-1,.4-1.6,1.4-1.4,.8-1.5,0-2.5,1-1.3,2.7-1.7,1.9-1.7,1.5-.3,0z",
      중랑구:
        "M719.2,266.4l.1,5.5 .2,7.1 .1,6.8 .3,2.3-.1,2.3 0,1.4 .5,3.1 .9,1.7 .9,5.3-.1,3.2-.5,1.6-1.9,3.7-3.6,4.8-.7,1.7-.5,1.9-.2,2 .5,3.8 .7,3.3 1.5,5.7 .6,5.5 .7,3.1 2.1,4.2 8.4,12.8 2.8,4.2 1.9,4.7 .7,4.8 .7,7.4 .4,8.1-.2,2.2 11,1.4 6.2,1.6 4.6,0 .5,2.1 1.4-.3 .7,.2 1.5,1.2 2.7,.4 1.5-.3 1.1-.6 .8-1.6 1.5,.3 2-.4 2.9-1.6 3-1.2 1.2-1 1.8-.8 .5-1 1-.4 1.7,.1 1.7-1.3 1.5-1.7-.1-1.8 .7-.9 .2-1.4-.5-2.1 1.3-2.3 .8-1.9 0-.8 1.6-2.4 .2-3.7-.3-2 .3-2.4-.3-1.2 .3-.6-5.2-2.3-1.3-.5-1.1,.2-2.1-.2-2.8,.3 1.1-.9 2.2-.8 2.4,.5 3.2-.8 0-1.4 .6,0 2.1-1 .7,.2 4-.5 2.8-.8 2.1-.2 .9-.6 .6-1.3 3.1,1.4 1.6,.4 1.3-4.3 .3-2.7 .6-1.8 0-1 .5-3.2 1-.8 1.2-3.6 .5-.3 .6-1.5 1-1.5 1.1-1.2 .2-2.2 .9-.7 2.7-.2 1.8-.4 2.4-1.1 1,.1 2.2-.4 1.3-2.9-5.5-6.5-2.2-1.8-2.1-3.1-.5-2.8 1-1.3 1.4-1.1 1.8-3.4 1.1-1.3 1.6-1.3 0-.7 .9-2.3 1.7-1.8 0-2.3-.3-1 .9-1.6 .1-3.8-1-1.5-1.7-1.4-1.2-.6 .4-3.8 1.1-2.3 .1-.9 .6-1.3-.4-1.6-.4-.2 .3-1.3-.6-1.3-.2-2.9-.9-1.2 .4-1-.3-3.3 1-1.4 .1-.7-.4-1.5 .2-1-.9-1.1-2.5-1.4 .2-1.8-.8-.8-3,.4-1.4-1.3-1.9-.7-2.7-1.5-1.6-.4-1.2,.1-3.1,.8-1.2-.3-.8,.3-1.3-.1-1.9-.5-.7,.2-1-.6-2.8,.9 0,.2-2.9,.6-2,.8-1.9,.4-1,1.5-1.7,1.7-1.1,1.7-1.9,.2-1.2-.4-3,2.7-.1,.5-2.1-.1-2.3-1.4-2.1-.4-2.7-.9-1.8-1-1.1-1.2-5.9-2.9-.9-1.2-1.2,1-.8-.1-.5-.7-2-.3-2.1,0-.4,.6-1.8,1.2-3.6,.4-1.3,.4-3.6,.9-1.3,1.5-1.5,.1-2.6,1-13.4,6.1-2.2,1.4-1.2-.3z",
      동대문구:
        "M609.6,380l.3,10.9 6.8,2.5 7.7,2.7 1.4,.3 2.3,0 1.5-.5 1.6-1 1.9-1.5 2.7-2.5 1.6-1.1 2.5-1.1 2.2-.2 .9-.9 1.7-.1 4,0 4-.2 4.1,2.7 9,4.9 1.8,1.5 4.4,4.2 4.1,3.9 9.9,9.3 3.1,3 1.9,1.2 .9,.2 8.9,1.6-.1,.5 5,1 .1-.6 8.7,1.6 3.2,.7 3,1.5 4.6-10.1 5.1-11.5 2.8-6.2 1.2-2.9 1-3.2 .2-2.2-.4-8.1-.7-7.4-.7-4.8-1.9-4.7-2.8-4.2-8.4-12.8-2.1-4.2-.7-3.1-.6-5.5-1.5-5.7-.7-3.3-.5-3.8 .2-2 .5-1.9 .7-1.7 3.6-4.8 1.9-3.7 .5-1.6 .1-3.2-.9-5.3-.9-1.7-.5-3.1 0-1.4-2.6-.3-.2-7-4.3,.1 .4,7-1.5,.2 0,.8-1.7,.1-.2,.7-2.3,1.2-.1,.8-1.8,.1-1-1-2.9,1.7-3.5,.4-1.7,2.4-.5,.5-.3,1.2-1.5,.9-.6,.9-.4,2.2 .2,.6 1.1,.4-1.2,1.2-1.7,.7-.2,.8-4.2-.5 .1-1-2.4,.6-2,.8-.8-.8-1.8,1.9-2,.3-1.7,1.3-1.4,.4-.7-1.4-.9-3.4-.8,.2-1.6,1.3 0,1.1-1,1.4-1.8,4.1-.2,1.7-1.8,1.9-1.2,3.6-1.5,.6-2-1.6-1.1,.1-1.5,.7-2.1,.2-1.8-2.6-1,1.2-1.4,1-.5-1.4-.7,2.4-1.3,3.2-.8-.2 .1-2.2-.4,1.8-.9,2.6-.3,1.3-.9,2.6-1.4,4.7-6.2,.1-.1,2.9 .2,.9-6.3,7.8-2.5,3.3-3.8,5.6-3,3.9-.9,1-6.1,5.2-4.5,4-2.9,2.4 0,.9z",
      광진구:
        "M762.9,521.9l3.6-2.1 14.8-2.4 9-18.3 6.5-11.5 9.1-15.6 4.5-8.7 1.2-3 .8-5.6 1.4-5.2 1.9-5.8 0-15.1-1-3.6-.8-1.4-3.3,.2-2.4,1.3-13.7-.1-7.8-.5 .2-.7-.3-1.8 .6-2.5 1.2-.9 .2-.8-.6-1.7 .2-2 1.1-1.7 .6-5.7 .4-2.4 .8-2.8 .6-4.6 .4-1 1.5-2.6-.5-2.3-1.8-1.6-1-.3-1.6,0-1-.6-1.4-2.1-.1-.7-1.5,1.7-1.7,1.3-1.7-.1-1,.4-.5,1-1.8,.8-1.2,1-3,1.2-2.9,1.6-2,.4-1.5-.3-.8,1.6-1.1,.6-1.5,.3-2.7-.4-1.5-1.2-.7-.2-1.4,.3-.5-2.1-4.6,0-6.2-1.6-11-1.4-1,3.2-1.2,2.9-2.8,6.2-5.1,11.5-4.6,10.1 3.6,1.7-1.8,4.2-4,9-2.2,5.1-2.5,5.6-5,11.3-2,4.4-2,4.2-9,19.9-1.1,2.8-1.7,3.4-3,6.8 12.2,7.7 4.6,2.1 8.6,3.1 15.2,3.7 4.9,.7 3.6,.2 17-1.1 1.9,4.3z",
      성동구:
        "M693,496.1l1.7-3.4 1.1-2.8 9-19.9 2-4.2 2-4.4 5-11.3 2.5-5.6 2.2-5.1 4-9 1.8-4.2-3.6-1.7-3-1.5-3.2-.7-8.7-1.6-.1,.6-5-1 .1-.5-8.9-1.6-.9-.2-1.9-1.2-3.1-3-9.9-9.3-4.1-3.9-4.4-4.2-1.8-1.5-9-4.9-4.1-2.7-4,.2-4,0-1.7,.1-.9,.9-2.2,.2-2.5,1.1-1.6,1.1-2.7,2.5-1.9,1.5-1.6,1-1.5,.5-2.3,0-1.4-.3-7.7-2.7-6.8-2.5 .3,11.2 .3,7.7 1.6,.2 5.4,.3-.2,1.3 .4,.1-.2,1.8-1,2.5-.7-.2-.1,.6-1.8,1-.5,1.3-1.2,.8-.8,1.5-.7,.3-.5,1.2-.3,0 0,2-1.2,1.9-.9,1 .8,.7 .2,2.6-2,.5-1.9-.6-3.4,1.1-.4,.5-2.5,1.4-1.3,1-.1,.8-.8,.7-.3,1.4-.1,1.8-.5,1 .1,1.1-.6,2.2-3.7,3.8-.1,1.2-3.2,3.4-.8,.5-.4,.9-.9,.5-.5,1.1-2.1,2.5-1.8,1.2-2.8,.2-.2,1.2-.9,1.7 0,2.1-.6,1.4 3.2,3.1 1,.3-1.7,.1-.3-.5-1.2,0-.9,.6 0,1-.7,.6-.4,3.2-.2,2.9 2.3,2.1-.3,1.7 .4,2-.2,.5 1.4,.6 0,.2 2,.4 1.6,.8 1.4-.5 0-.4 1.1-.4 2.1,1.2 .6-.3 .9,.4 1.3,.2 .7,1.5 1-.2 1.7,1.5 1.1,.8 1.7-3.2 1.9-2.4 5.6-4.6 9.9-1.1 6.4,.3 7.6,1.2 4.8,1.4 19.7,8.3 6.3,1.7 16.7,5.8 .2,.9 .9,.3 .6-.4 4,1.2 4.4,1.9 4.4,2.9z",
      용산구:
        "M593.8,487.9l-1.7-1.5-1,.2-.7-1.5-1.3-.2-.9-.4-.6,.3-2.1-1.2-1.1,.4 0,.4-1.4,.5-1.6-.8-2-.4 0-.2-1.4-.6 .2-.5-.4-2 .3-1.7-2.3-2.1 .2-2.9 .4-3.2-3.1,.5-5.5-6.8 1-2.2-.6-1 .7-.6 0-.9 1.3-1.1-2.7-.4-.7-2.4 .2-2.2-.6-1.2-3.5,2.2-1.3-.6-3,.8-1.9-.1-1.9-.9-1.3-.1-.4,.7-1.4,.9-.9,1.3-1.3,1.1-.1,2.1-.8,1.1-2.4,.5-2.5-3.3-2.3-1.9-.2-.6-1.7-2.4-2.1-1.3-.6-1-2.1-1.5-2-.2-1.4-.6-2.2,.6-.5-.3-.6-1.3-2.2-2.3-.5-1.2-1.6-1.4-1.3,1.3-.9,.6-1.6,.2-1.6-1.1 .3-.5-1.1-.6-.8,.6-2-1-1.4,0-.7,1.5-1.6,0-2.2-.4-.2-1.4-3.7-2.7-1-.1-.3,.4-.2,5-1.4-.7-3.7-.6-2.6-1.6-2.3-.8-.5,.6 .7,0 0,.9-7.1,0 0-3.7-1.3-.6-1.8,1.6-2,1.1-1.6,.4-.9,.6-2,1.7-2.6,2.8-3,3 .1,.4 1.3,1.5 .6,1.1 1.6,2.2-.8,2.7-1.3,.2-.3-.5-1.1,0 0,.5-1.1,.1 .1,.8-.5,.6 .6,.8-.6,.3-1.6,.3-1,.7 .6,.6-.9,.7 0,.8-.8,.3 .2,.7-2.7,1.6-1.2,.9-1.4-.1-.3,1.2 .7,.2-1,2.5-.1,1.6-.4,1.3 2.1,1.1-1.4,1.9-1.2,.8-.5,1.6-1.3,1.9 .2,.6-.8,.6-1.2,2-1,.6-1.2,.3-1.4,1.1-.8,1.5-1.5-.7 .1,1.2-.2,1.9-.7,.5-.9,1.2-2.1,1.5-1.3,.5-2.5,.4-1.7,.9-2.5,.1-.7-.6-.3,1.8-2-1.1-.2-.4-2.2,1.5 .3,.6-1.1,.2-.1,1.1-.3,1 2.9,.2 2,.8 10.3,11.4-.6,.3 1.6,2.1 .4,6 1.4,6.1 2.3,5.1 3.1,2.8 10.2,3 20.5,10.7 10.5,4.9 7.6,1.9 7.1,.7 8-.1 7.8-1.3 5-2 6.6-4.6 1.4,.9-.4,1 4.1-1.9-.1-.3-2.7,1.2-.3-.4 3.2-1.7 0-1.8 .8-1.3 14.7-8.8 2.4-2.9 2.8-5.7 2-2.8 4.4-3.7 9.6-6.2 4.4-3.6 10.3-19.9zM470.8,547.7l-1.3-1-4.7-2.6-4.9-1.9-3.7-.8-1,.2-.9,.9 0,1.3 .7,1.1 7.2,3.8 5.5,1.7 3.2-.2 .8-1.1z",
      중구: "M607.4,390.4l-2.2,.1-2,.5-3.6,2.1-3,2-1.4,.7-2.5,.7-9.5,0-4.6,0-6.6,.4-8.7,0-2.8,.2-7.5,1.9-3.7,.6-9.8,1-3.4,.4-4.5,.3-5.2-.3-5-1.1-3.9-.8-11.1-1-3,.2 0-.4-1.6-.3-1.5,.4-1.8,.1-1-.2-2.3,.3-.5-.1-.4,1 .2,1.2-1.7,.5-.7-1.1-.9-.4-3.5,1.8-.3-.7-.9,.7-4.5,5.6-1,.9 1.4,1.9 5.3,9.3-3.8,1.1-2.3,1-3.8,3.2-2.3,1.7-1.4,.8-3.5,.1-1.3,1.2 .3,1.1 1,0 1.7,1.1 .5-.3 0,2.1-.3,.5 .7,.4-.3,2.1-1.5,1.5-.8,1.6-.8,0 .6,2.9-.6,1.5-.1,1.5 .2,2.6 .7,.8 .7,1.7 3-3 2.6-2.8 2-1.7 .9-.6 1.6-.4 2-1.1 1.8-1.6 1.3,.6 0,3.7 7.1,0 0-.9-.7,0 .5-.6 2.3,.8 2.6,1.6 3.7,.6 1.4,.7 .2-5 .3-.4 1,.1 3.7,2.7 .2,1.4 2.2,.4 1.6,0 .7-1.5 1.4,0 2,1 .8-.6 1.1,.6-.3,.5 1.6,1.1 1.6-.2 .9-.6 1.3-1.3 1.6,1.4 .5,1.2 2.2,2.3 .6,1.3 .5,.3 2.2-.6 1.4,.6 2,.2 2.1,1.5 .6,1 2.1,1.3 1.7,2.4 .2,.6 2.3,1.9 2.5,3.3 2.4-.5 .8-1.1 .1-2.1 1.3-1.1 .9-1.3 1.4-.9 .4-.7 1.3,.1 1.9,.9 1.9,.1 3-.8 1.3,.6 3.5-2.2 .6,1.2-.2,2.2 .7,2.4 2.7,.4-1.3,1.1 0,.9-.7,.6 .6,1-1,2.2 5.5,6.8 3.1-.5 .7-.6 0-1 .9-.6 1.2,0 .3,.5 1.7-.1-1-.3-3.2-3.1 .6-1.4 0-2.1 .9-1.7 .2-1.2 2.8-.2 1.8-1.2 2.1-2.5 .5-1.1 .9-.5 .4-.9 .8-.5 3.2-3.4 .1-1.2 3.7-3.8 .6-2.2-.1-1.1 .5-1 .1-1.8 .3-1.4 .8-.7 .1-.8 1.3-1 2.5-1.4 .4-.5 3.4-1.1 1.9,.6 2-.5-.2-2.6-.8-.7 .9-1 1.2-1.9 0-2 .3,0 .5-1.2 .7-.3 .8-1.5 1.2-.8 .5-1.3 1.8-1 .1-.6 .7,.2 1-2.5 .2-1.8-.4-.1 .2-1.3-5.4-.3-1.6-.2-.3-7.7-.3-11.2z",
      종로구:
        "M490.2,219.6l-1.1,1.8-2.2,1.8-3.7,1.2-1.9-2.1-1.3,0-2.3,3.2-8.8,2.3-.7,.3-3.3,.1-6.4,9-5.8,.1-2.3,.4-2.3,1-1,1.4 .2,1-1.3,3.4-.3,2.7 1.7,.9-.1,.6-.9,1 .3,.8-1.3,2.5-.7-.2 .1,2.9-.9,1.6-2.2,1.8 .7,1.5 .1,1 1.6,2.1 .6,2 0,2.3 .7,7.3-.7,1.7-.1,1.5-1.4,1.8 .2,.6-.7,3.8 1.3,2.6 .8-1.3 1.4,.2 .8,1.6 .3,1.2 2,2 .2,1.8 1.3,1.6 .4,2.3-.7,4.6-1,.9-.1,6.5 1.8,3.7 1.3,1.7 4.6,.2 .5-.6 1.4,.2 .4,1-1.4,5.7-.5,.9 .1,2.3 1,3.3 1.7,3.8 1.8,3.4 .3,2.7-.2,1.6-2,6.9-1.8,8.3 6.8,6.3 2.2,4.9-3.5-2.2-1.9-.4-1.7,.3-1.2,0-1.2,.9 .1,1.1-1.7,.5-.1,4-.6,1-4.3,.3 3.1,4.1 2.1,3.2 1.9,2.5 1.1,1.1 5.1,5.6 2.6,3.5 4.2,5 1.4,1.9 2.9,3.4 3.4,4.7 1.9,2.1 1-.9 4.5-5.6 .9-.7 .3,.7 3.5-1.8 .9,.4 .7,1.1 1.7-.5-.2-1.2 .4-1 .5,.1 2.3-.3 1,.2 1.8-.1 1.5-.4 1.6,.3 0,.4 3-.2 11.1,1 3.9,.8 5,1.1 5.2,.3 4.5-.3 3.4-.4 9.8-1 3.7-.6 7.5-1.9 2.8-.2 8.7,0 6.6-.4 4.6,0 9.5,0 2.5-.7 1.4-.7 3-2 3.6-2.1 2-.5 2.2-.1 2.5,.5-.3-10.9-.1-7.1-.7,.6-.8-.8 .5-.7-2-1.5-1.2,.1-4.8,2.2 0,.5-1.1,1.1-.6-.5-.9,.1-.2-.8 .7-1.8-.1-1.6-.5-1.2-1.1-.6-.8-2 0-.9-.7-.4-.2-1.9-.9-.8-2.1,0-1.8-1.1-1.9,1.5-2.4,1.1-1.6-.6-1.6,.4-.9,.8-.6,1.4-1,1.1-1,0-2.3-.6-1-1.9-1.1-1.2-2-1.6-.2-.8 .9-2.3-.4-3-.7-2 0-1.2-.9-.9 .2-1.4-1.4-2.3-3-.2-1-.9 .1-1.8-1.8-1.2-.4-1.2-1.9-.8-1-2.6-1-.7-.1-1.2 .5,.1 .5-1.9-.8-1.9-1.4-1.4-1.1-.1-2.4,.2-2-.4-2.3,.8-1.1,0-.9,.5-2.3-.5-.5,.2-.8,1.3-1.6,1.3-1.8-1.2-2.4-.7-1.2,.1-1.4,1.5-1.8-.4-2.1,.3-1,.6-.3-.6 .9-1.2-1.6-.9-2.9-.4-2.3-.7-1.6-.8-2.5-1.6-1.8-1.5-2.8-3.6-1.5-2.1-1-3.8 0-5.6 2.7-.7 4.9-.2 3.4-1.8 3.1-3.3-2.7-11.2-1.5-5.8 .2-4.7 .6-3.3 1.6-1.8-.2-5.6-.1-1.8 .5-1.2-.8-3.2-3.1-2.5-3.1-1.6-1.7-.6-1-1.1 .4-1.3-.5-.9 .4-1-2-2.6-.5-1.7 .6-1.7-1.4-2.7-.2-2.5-.9-1.2-.3-1.7-1.1-1-.4-1.3-2.2-3 .6-1.8-.4-.9 .2-1.1 .7-1-.6-2 .5-2.9 1.9-1.9 0-1.2-.9-.6-1.3,.2-3,2.2-3.5-1.2-1.8-.1 1.1-1.1 .3-2.4-.6-2.6-2.6-1.1-1.4-1.4-2.5-.4-3.6-.8z",
    },
    river:
      "M449.6,525.5l-1.4-6.1-.4-6-1.6-2.1 .6-.3-10.3-11.4-2-.8-3.7-.2-2.9-1.7-9.2-15.3-4.8-3.8-1.5-.6-2.6-.1-3.9,.5-8.7-3.8-6.8-3.6-2.1-.4-3.1-.1-3.2,.7-4.3,2.1-1.3-1.5-1.5,1 .8,1.2-.3,.5-1.8,.5-4.3,.2-3.2-.2-8.1-1.9-6-2.8-32.4-28.3-13-12.5-11.6-8.1 .6-1.1-.5-.6-1.4-.5-1.3,.3-5.6-3.9-12-4.8-4-3.4-5.1-6.3-5.3-5.1-2.6-1.6-2.2-.2-.9-1.4-2.8-2.6-4.9-3.4-2.7-1.1-.1-.5 1.2-1.6-.4-.3-1.8,1.4-.7-1.5-2.1-1.7-3.6-1.6-3.4,.3-.4,2.7-14.8-2.8-54.7-36.4-6.8-2.6-7.7-4.5-8.8-8.7-21.2-24.2-5.2-4.9-3.4-1.5-4-.4-2.3,1-1.5,1.6-.1,.4 2.7,2.7 4.1,6.4 5.7,5.3 10.8,13.4 5,7.2 12.7,11.4 4.1,2.4 3.9,3.6 10.6,6.1 6.4,5.9 21.2,10.5 6.3,3.7 58.2,42.6 4.5,3.6 15.2,15.3 6.2,2.4 6.6,4.4 5,2.5 11,9.1 .9-.2 .1,.7 3,2.9 1.7,.7 .9,1.3 31.3,24.7 1.3,1.8 1.6,.7 1.7,3.5 2.9,2.7 1.2,.2 1.9,1.4 .8-1.1 5.4-.2 .9-.6-.8-.8-2.1-.4-1.3,.9-1-.2-.3-.5 1.7-1.7 2-.2 24.5,5.9 6.4,2.3 9.4,4.7 5.8,3.7 5.4,5 20.6,21.8 1.8,4.2 2.9,3.2 3.3,.9 9.4,5.3 14.1,6 4.6,2.5 12,8.3 1.6,2.6 10.1,4.1 4.2,2.6 7,1.5 17.6,.7 5.9-1.9 6.7,1 7-2.5 1.5-2 11.6-11.8 2.5-1.4 6.1-2.1 5.1-4.8 2.7-1.1 1-1.8 .6-3.3 3.6-1.2 2.2-2.2 15.1-16.9 11.8-12.3 6.1-8.7 .9-.7 .5,.1 5.5-5.5 4.3-2 3.2-.8 7-.2 5.9,1.6 3.1,2.7 5.9,2.4 25.9,8.7 6.6,1.2 .4,.8 4.7,2.6 5.2,5.8 3.1,2.7 8.1,5.1 2.6,2 1.8,2.3 2.1,.8 3.1,2.3 28.2,5.2 6.7,.8 8.1-.2 9.1-1.5 6.3-1.8-8.9-20.6-17,1.1-3.6-.2-4.9-.7-15.2-3.7-8.6-3.1-4.6-2.1-16.6-10.6-4.4-1.9-4-1.2-.6,.4-.9-.3-.2-.9-16.7-5.8-6.3-1.7-19.7-8.3-4.8-1.4-7.6-1.2-6.4-.3-9.9,1.1-5.6,4.6-1.9,2.4-12,23.1-4.4,3.6-9.6,6.2-4.4,3.7-2,2.8-2.8,5.7-2.4,2.9-14.7,8.8-.8,1.3 0,1.8-3.2,1.7 .3,.4 2.7-1.2 .1,.3-4.1,1.9 .4-1-1.4-.9-6.6,4.6-5,2-7.8,1.3-8,.1-7.1-.7-7.6-1.9-10.5-4.9-20.5-10.7-10.2-3-3.1-2.8zM548.6,560.3l-1,1-.9-.1 .8-1.3 .8-.1zM546.1,561.8l-.5,1.8-.8,.4-.5-.2 0-.9 1.1-1.3zM545.4,560.7l-.9,.1-.2-.3 1.1-.5zM544.3,566.1l-.5-.5 .7-.5 .4,.5zM526.8,575.6l13.1-6.5 .6,.1-.1,.5-1.9,1.9-1.2,.6-1.4,1.4-1.7,.4-.9,1.6-.8,.5-1.2-.1-1.3-.9-.5,1.3-.9,.3-1.7-.4zM471.7,549.1l-.8,1.1-3.2,.2-5.5-1.7-7.2-3.8-.7-1.1 0-1.3 .9-.9 1-.2 3.7,.8 4.9,1.9 4.7,2.6 1.3,1zM396.2,481.7l5,2.3 2.1,1.4 2.2,.7 .2,1.1 2.4,2.7 .5,2.3-.4,.5-1.4,1.2-3.2-.8-8.2-3.8-1.2-2.2-.7-.2-.5-1.4 .3-.5 2,.5 1.1-.7 .2,.5-1.5,1.2 1,.7 1.9,.1 .5-2.2-.3-.4-1.9-.3-2.4,.5-.8-.4 .4-1zM393.9,479.7l1,2-2,2-.1,2.2-.6,.1-2.9-.6-10.4-4.3 .8-1.2 3.1-1.6 2.5-.4 3.2,.2 2.3-.4zM345.3,492.2l-.6-.1 .2-.3zM334.3,471.3l3,3.6 0,1.4-.9,1-1.1,.1-3.6-1.6-9.5-6.1-1.8-2 0-1 .5-.5 .9-.1 5.3,2 .8-.1 3.2,1.9 .5-.3 1,.5 0,.6z",
    outline:
      "M488,209.3l-.9-2.4-.8-.6-.5-1.1 .2-6.2-.9-.8-.6-1.5-.9-.5-1.4-2-.9-.6-.9-1.1-1-1.6-1.3-1.8-.8-1.8-1.3-.9-3.1-.8-2.1-.4-.9-2-.1-2.8-1.2-1.7-1-2.2 .2-1.6-.9-2.9-.7-.7-5.7-2.4-.3-.3-.1-3.6-1-4.8-.5-1.3-2.3-2.6-.6-.6-.5-1.3-.9-.6-1.2-2.4-1-.1-.9,1-1.3,.7-1.4,0-2.5-.7-.9-1.5-.7-.8-1.8-.9-1.1-1.8-1.4-.9-1.8-.7-.3-.4-.3-2.7-.6-1.7-.6-.1-1.7,.3-1.8,1-.8,0-3.5,1.1-2.5,1-2,1.5-1.4,.6-1.5,1.2-.6,1.1-1.7,2.2-1.3,2.2-.3,.8-3.7,7.2-5.2,3.7-.6,.2-7.3-.1-2,.1-1.5,.5-1.9,1.2-7.9,7.3-4.7,3.1-2.1,1.2-2.6,1.1-2.9,.4-4.9,.1-2.7,.5-2.4,.9-3.2,.6-.7-.1-1.1-1.2-.6,.4-1.3-.4-1.2-1-2-.9 .2-.2-2.4-1.6-.8-.7-3.4-2.3-3.7-1.7-.6-.5 .4-.8-3.1-1.2-.1,.3 2.4,2.4 .7,.4 .2,1.2 1.3,1.3 .6,.2 .3,1.6 7.4,4.2 3.6,1.7-.5,3-.1,2.6 .6,1.5-.4,1.1-1.3,1.2-.8-.1-1.4,.5 .1,2.8-1.3,3.5 .4,2.2 .1,1.9 .7,1.5 .2,2.4-.3,1.2-.7,.9-1.4,.1-1.4,1-1.1,1.7-1.6,1.1-.3,.8-.9,.3-2.1,2.5 .2,2.3 .7,.8 .5,2.5 .6,1.1 2.5,1.9 .7,1.4-.1,.7 .7,1.1 0,1.1-.7,2.1-.1,3.2-.8,1.4-1.8,1.9-1.2,.8-1.4,2.1 .7,1.6 .1,1.3 1,.7 0,2.5-.4,.6-1.6,1.1-.9,.2-1.3,2-.6,2.1 .3,.9-.3,1.2-1.3,.5-2.7,.3 0,1.6-.9,1.1 .5,1.5-1.6,1.5 0,.6-1.2,1.9-.2,1 .3,1.2-.6,1.2 .2,2.1-.7,.9-.6,1.5-.7,1.2 .6,1.2 0,3.8 .7,1 .8,1.9 .2,1.8-.3,1.4 .5,2 .3,3.2-1.2,3.4 .4,1.9-.1,1 .4,1 .3,2-.9,1.2-.6,.4-1.9,.1-.8,.3 .6,1.4-.6,1.8 .7,1.3-.2,.8 .9,1.5 .8,1.9 .1,1.5 .5,.6-.3,3.4 .1,1-.6,1.4 .5,2 0,1.4 .8,.6 .4,1.1 0,1.4-3,2.3-1.4,1.5-.3,1.1-1.1,.4-.8,1.7 .7,2 1,1.3 0,1.2-.3,1.8 .6,1.7-3.9,.9-1.3,1.5-1.4,1.1-1.4-.4-1.3,0-1.3-.5-1.4,.2-1.7-.9-1.3,.1-2,1.3-2.2,.7-1.1-.4-1.1-.7-2.1-.6-.4,.6-4.1,.5-.6,.2-1.5-2-1.9-1 .2-.7-.2-2.2-.8-1.2 .7-1.4 1.2-1.8 1-2.4 1.3-2.2-1.2,0-1.9-.5-1.9,.5-1.7,3.2-.9,1.4-1.2,1.4-1.4,.8-1.2,1.4-4.5,3.7-.6,1.9-1.2,2.5-1.1,4.4-1,.6-1.4,.1-.7,.4-2.2,5.9 .8,.9 1,0 .1,.7-1.7,.9 .8,2.2-.5,1.8-.9,1.4-.4,1.2 0,1.7-.4,1.4-.6,.8-1.8,.2-4,2-5.9,3.1-6.2,1-3.1,2.7-1.4,2.2-1,.6-4.7-3.3-4.1,2.2-8.8,.7-.2,2.8-.2,.1-15.3-2.9-20.8-13.9-34-22.6-6.7-2.6-3.7-1.9-4.1-2.6-5.4-5.2-3.5-3.6-1.1-1.3-14-16.1-7.4-8.1-2.5-2.6-1.3-.9-2.2-1.2-2.5-.5-2.4-.1-1.3,.4-1.5,1.1-1,2-.6,1.8 0,1.9 .3,1.1-.3,1.2-1.6,.1-1.8,.6-1.1,.9-1,2.2-.6,1.9-.4,2.4 .2,3.5 .3,2 .7,2.4 2.5,5.6 1.8,2.9-.5,0-.4,1.9 .4,2.7 3.6,6.2 .1,.8-.2,2.1-.2,.3-4.2-.9-1.1,1.2-.2,1.9-.9,1.3-1.2,3.1-.8,1 .1,3.1-2.6,2.9-.8-3.9-2,0 .4,3.4-2.4,1 .5,1.1 0,1.7-.7,1.3-.7,3-.5,.3 .3,8.9-.6,.9-1.1-1.4-1.1-.1-5.5,0-1.5,.1-.6,.8 .4,2-.8,.4-1.1-1.1-2.8,3.3-2.7,.9-3.1,2.3-1.1,.9-2.1,1.3-.7,1-.6,3.1-.9,1.2 .2,.5 1.6,1.6 .2,1.5-.3,1-3,.6-1.3,0-.3,.3 1.5,1.9 1.2,.9-.4,.8-1.5-.3-1.2,1.8-.5,2.4-.3,0-.6-1.4-1.5-1.4-.4,.2 0,2.5-2.8,.9-1.1,.9-1.4,2.2-.2-2.3-.4-1-2-.7-.1-2.5-1.2,1-.7,1.6 1.2,2.4 .1,1.5 .6,1 0,.7 1.9,2.4 1.1,1.1-.2,3.3 0,2.9 2.2,0 .7,3.4 .1,1.7-.3,.9-1.4-2.2-2.7-3.1-1.1-.2-.1,1.8-1.8,.1 .7,.8-1.3,1.1-.6,.9 .4,.8-.5,.6-.7-.7-1.8,1.2-1,1.8-1.9,.3 0,.5 2.8,2.8 .1,.5-.8,.7-1.3,.5-2.8-.3-2.8-.2-.8,.2-1.3,1.1-.3,2.8-3.2,.5-5.3,0-1.5,.8 .7,.6 1.6,.4 1.3-.1 2.2,.9-.6,.8 .7,1.4 1-1 1.2,.5-.3,2.3 .7,.5-.1,1.2 1,.7 .4,.7 3.8,6.3 2.1,3.8 8.1-.8 1.7,.2 1.9,1.3 8.2,6.3 .9,.3 2,0 9.1,0 1.5-.6 2,.1 1.4,1.9 3,3.5 .9,.8 1.6,.8 1.2,.2 3.3-.1-.5,2.8 .1,.9 .5,1.1 0,1 3.5,.8 3.4,.3-.3,1.7-2.2,4 .5,3-.3,3.1 1.3,4.3 .9,0 4.8-3.9 1.9-.9 1.1,.2 1.4-1.1-.2-1.9 .9-.4 .6-2.6 .6-1.2 .2-1.4 .7-.2 1.5-1.2 .9,0 2-1.7 0-.5-.9-1.4 0-.8 1.5-.4 1.3-1.4 1.1,.6 1.4-.1 2.5-.7 2.1-.2 4.8,.1 2-.1 .9,.3 .7,1.5-.5,.7 1.8,1 .3,1.1 1.5,.5 2.2,1.2 1.2,.3 1.5-3.4 .3-1.1 .6-1 .5,.9 2,2-.4,1 .4,2.4 4.5,.4 2.4-.4 5-.3 2.1-.1 3,.3-.8,2-.6,.5 .5,.9 1,4.1-.3,1.5 .4,3.6-.7,1.7-.4,1.8 .1,.8 1.6,1.6 .4,1.5 1.8-.2 0,3.3 1,1.6 .1,.9 1.4,1.6 .4,1.6 .8,1.3 1.1,.9 1.3,.3 1-.2 1.6,.6 1.8,1.6 .3,.8-.6,1.2 .1,1 1,3.8 .9,.5-1.3,.6-.3,1.5-.5,0-1.8,1.7-1.6,.6-.3,1-1,.7 .1,.9-.7,1.8-.8,.9 .1,.9 .9,1.7-.4,1.6 .3,2.1-.2,3.5-.3,.7 0,1.1-.4,1.7-1,1.6-.3,.8-2,2.7-1.3,1.5-.1,.9 .4,.9 .3,2.2 2,1.4-.1,1.4 .6,1.7-.6,3.7-.6,2-.1,1.8 .8,2.5-.1,2.4 1.1,1.8-2.1,.3-2.1,1.1-.8,.1-.1,2.4 .3,2 .6,1.1-.3,.8-1.2,1.1-.4,1.4 .6,.6 .4,1.3-1.6,2.7 .1,1.3-.7,1.6-2,1-1.7,1.2-1,1.8 .2,2.8-.6,1.1-1.4,1.6-1-.1-1.6,.6-.4,1-2,1.2-2,.8-1.4-.7-1.8-.1-1.7-.7-.9,.1 .1,2.8-1.1,1.2 .2,1.3 .9,1.5 .4,1.1 .7,.6 0,.8 1,.9 .3,2.5 .5,1 1.2,.5 .6-.6 .7,.4 .9,1.8 4.4,2.7 1.6-.2 2.1,.9-.2,.6 .9,.6 .8,0 1.3,1 1.2,.2 1.3,.7 .7-.1 1.4,.9 .5,1.6 .1,1.5 1.1,3.2-2,2-.6,1-1.4,.4-.9,1.1-3.1,1.2-1,.6 .3,.4-.4,1.1 0,1.4-.4,1.1 .5,1.2-.1,.7 .4,3.5 .8,.8 0,.9-1.1,2.6 .4,8.1 3.6,4.8 1,.4-.1,2.5 .6-.2 .4-1.2 2.6-.6-.1-.6 1.2-.4 .7,.3 1.1-.6 3.9,.9 3.7,.3 2-.2 1.2-.5 .8-1.2 .2-.8 1.5-.9 .3-.7 2.8-.7 .1,.5 3.1,2 .6,0 1,.6 .1,.7 1.6,2 1.9,1.2 3.2,.8 2-.7 2.5-.5 1.4-.7 .5,1.6 .7,1 2.3,.5 2-.6 1.9-.3 1.3,.3 .8,1.2 1.7-.4 .1,1.6 2.1,.5 .4-1.3 .1-1.9 .4-2.9 .3-3.7 .4-7.4-.2-3.3 1.2-2.1 1.3-1 2.7-.9 0,.7 2.1,.5 1.9,.8 2.4,.3 1.9-.2 1.5-.9 1.5-1.3 1.2-1.4 1.2-2.3 1.9-4.3 1.6-1 4.3-1 1.1-1.2 7-10.1 1.4-1.6 2.7-1.6 1.7-.2 2.3-.8 1.6-1.4 .8-1.4 1.8-1.7 1.4-.6 .5-.5 .6-1.5-.5-2.2 .8-1.3 1.6-.7 .7,.4 1.5,3.1 .2,4.3 .6,.7 .2,1 1.3,.3 1.7,2 1.7,.1 .6,.2 .7,1.2 2.8-1.6 1,0 .3,.6-.6,2.7-.4,.9-.9,0-.1-1.6-1.5,.6-.5,.8-.1,1.4 .6,2.7 2.5-1.3 1-.1 1.2,1 .9-.4 1.4-1.3 2.7,3.2-.2,1.2-2.3,1-1.1,1.2-1.1,.5-.4,2.5-.5,1-1.7,.9-.4,.7-.8,.4 1.9,6.6 3,8.3 2.4,5.5 2.6,5.4 1.5,2.8 3.2,5.5 1.8,2.7 6.9,10.3 11.2,16.5 1,2.7-.5,1.8-1.1,.3-1.7-.9-1.9,.8-.2-.4-1.5,1 .3,.3-2,1.4 .4,1.6 1.6,.1 .5,2.5-1.1,1.3 .1,1.3 .6,1.2 0,2.5 2.2,2.3 1.8,.2 1,1.3 1.4-.3 .9,1.9-.8,.7 .2,.8 .8,.5 .4,.8-.5,2.2 .3,1.2 1.5-.5 1.4,.5 2.5,.1 .8,1 .7,.1 .9-1.8 .9-.7 1.5,.4 1.7,5.2 2.1,5.7 .6,1.5-2.1-.3-1,1.7 .2,2.7 .2,1 1,1 .7,1.4 1.2-.4 1.8,.7 1.4,1.1 1.6,1.6 .6,2.3 1.1,2.1 .2,1.5-.2,1.2 .3,3.3 1.2,2.1 1.8,.2 .3,1.3-1.8,.6-1.2-.3-1.2,1.1 .4,1.4 1.1,1.9 1.4,.6 .9,.9 1,1.8 .6,.2 2.2,1.7 .7,1 .8,.1 .2,5.3 5.1,.2 3.3,.4 1.7,.8 2.2-.2 1.2-.4 1.3-1 1.1-2.3 1.2-.8 1.1-3.9 .7-.9 .5-1.8 1.2-.9 .9-2 .9-.3 1.1-1.4 2.7-2.5 2.8-.1 2.6-1.1 2.8,1.6 3.4-2.5 1.1-1.5-.1-1.1 .6-2.3 1.8-3.1 .4-1.7 1.3-1.5 .8-.5 .2-.9 1.1-1.3 1.1-1.8 .9-1 1.5-.7 1.8-1.7 1-.3 1.4-2.7 2.3-1.1 3-2.4 1-1.4 1.5,.7 1.5,1.6 .1,.6 1.1,1.4 .9,1.5-.3,1.6 0,1.9 .4,1.4 0,2.1 1.4,1.1 2,.9 .7,.7 3.1,2.3 1.1,1.2 2.1,.9 1.5,2.5 .7,.2 1.5,1 2.8,4.7-.3,1-1.1,1.3 0,2.4 .8,1.2 .1,2.3 1.8,2.4 .9,1.9 1.3-.5 1.4-.1 2.3-1.5 1.5-2.6 3.7-.3 2,.4 1-.1 1.3-.6 .5-.6 2.1-1.8 2.8-1.3 1.6,.9 1.4-.1 .9-.5 3.3-1.3 4.1-.3 3.1,1 1.8,.2 2.1-.2 1.8-.5 3.2-.5 1.3-2.8 .8-.7 2.1,.4 2.5,.1 2-.2 1.9-1.2 .6-1.7 1.6-1.5-.1-2.5-.5-3.3 .4-1.8 .9-2.1 2.7-1.5 1.6,.3 1.6-.1 .9-.5 .3-.8 1.3-.8 2.9,0 2.1-1.1 1.7-1.1 2,0 1.7-.5 3,.3 3.7-5.7 .4-1.1 1-1.4 1.5-.8 1.1,.1 2.4-1.8 .5-1.6 1.4-1.2 3.6-2 .1-1.6 2.5-2.2 .5-1.1 .3-1.3-.1-1.7-.4-1.3 .2-.9 1.2-.6 4.4-.4 2.4-1.1 2.5-.4 2-.9 2.1-1.2 1.5-1.1 .9-1.8 2.3-1.5 1.3-1.3 1.1,1.3 .9-1.3 .4,.1 .4-1.1 1.6-2.7 .8-.5 2,.3 1.6-.4 3.8-1.6 .3-.9-.1-2.2 .6-.8 .1-1.2-1.7-2.4-.4-5.5 1.7-1.4 2.1-.5 4,.6 .5,.3 1.6,0 1.1-.8 .8,.1 1,.9 1.6-.1 1.8-.7 .4,1.4 .9,1-.1,1.6 .8,1.3-.3,1.8 1.8,3.3 .7,2.9 2.3,1.3 1,2.5 .7,1.2-.1,1.5 1.5,1.5 2.1,4.3 .3,1.3 .7,1.5 2.6,1.8 1,1.3 1.1,2.6 4-.5 3.5,.3 4.1,.2 3.8-.7 6.1-1.6 9.4-4.7 3.3-2 2-3.9 4-6.5 2.5-3.8 .5-2.1-.5-3.6 3.2-.9 3.3,1.5 1,.6 .8,1.4 1.3,.4 1.5,1.6-.8,.6 .1,1.3-1.8,4.9 .8,3.3 1.2,.7 .9-.3 .1,1.4-.6,.6 .5,2-.2,1.7 .7,1.7 1.6,.1 2,2.7 .9,3.7-.1,2.1-.7,1.6-.7,1 .1,3-.8,3.1 1.5,1.8 1,2.5 1.2,2 .2,1-1,1.9-.3,1.5 .4,1.4-.4,1.6 .4,1.1 1.6,1.2 .4,1.5-.3,2.1-1.5,3.7-1.1,1.4-.8,2.7-2.3,1.7-.7,.7 .1,2.1 .7,1.9 .2,1.8 1.7,.7 1.3,1.1 .7,.2 2.7-.2 1.3,.3 1.3-.2 2.7,.9 .8,2.1 2.1,1.5 1,.9 3.4,4 1,2.5 .9,.8 2.5,1.1 .6,.6 .7,2.5 1.2,2 .6,3.1 2.1,.8 1.2,0 2.1,.7 2.3,1.8 2.8,3.2 .7,.2 1.1-.6 1.9-1.4 1.9-.7 1.9-.3 5.6-1.7 2.4,.9 1.7,.2 3.1-1 1.9,.7 3.6,.6 1.8,1.2 3.2,.6 .8-1.7 1.6-1.5 2.6-.8 .9-.7 1.3,.8 1.1-.2 1.4-1 1.2,1.6 .3,.8 1.4-1.8 .1-1.1-.8-2.6-.7-1-.1-1 .5-1.2 1.2-2.4 .3-1.6 0-2.4-.5-.5 .6-1.7 3.3-1.6 .9-1.1 1.4-.5 .7-1.2 .6-2 .1-1.7-2-1.1-3.9-2.3-.1-3.6-.6-1.6 .6-.8 1.1-.8 1.8,.6 .9-.5 2.6-.3 1.5,.4 1-.1 2,.4 1.4,1.1 1.4-.4 .9,.8 .8-.1 1.1,.6 1-.1 1.4,.5 1.7,1.1 1.3-.1 1.7-.6 .6-.7 1.5-3.1 0-.9 1.4-1.8 .6-1.5 1.7-.7 .8-.8 .5-1.2 .5-.2 3.5,.6 1.8-.7 .9-2.1-.4-1.7 .4-.7-.4-.8 .3-1.5 .6-1.2-.7-2.7 .2-1.2 1.2-1.4-.1-1.2 .6-.1 1-.9-.1-1.3 .4-.8 1.3-.6 .6-.8-.1-.8 .8-2.5 2.5-2.4 1.5-.1 1.1-3-.2-.6 .9-1.7-.1-.7 .7-1 1.4-1.1 1.9-.1 .6-3.7-.2-1-1.5-1.7 1.2-2.5 .6-1.8 .6-.5 .4-1.7 1-1.1 1.3,5.3 1.3,.6 1.6,1.9 1.8-.9 .5,.1 1.5-1 1.1,.9 1.4-.5 1.1,0 4.8-1.2 1-1.4 .2-1.4 1-1.2 .8-.4-1.2-2.9 2.9-.1 1.6-.9 6.7,1.5 4.7,.8 1.6,.5 2.3,1.1 .9,.3-.1,.7-1.1,.9 .8,.5 0,.8 5.4,4.2 2.6,0 .5-7.7 .5-1.6 .6-1 3.8-2.5 2.2-1.1 3.1-2.6 1-2.4 .9-.1 3.5-3.1 3.1-2.1-.3-5.4-.4-1.2 .6-.6 2.9,2.2 .4-.2 4.8,2.7 9,0 6.2-4-4.6-3.1-.7-.2-1.7-1.6-1.2,0-1-.6-1.4-.4-.4-.8 .9-.3-.6-10.5 5.5-1 1.2,1 1.3,1.3 10.9,4.4 2.1-.9 .2-1.2 2.2-1.8 1.6,.7 .8-5.7 10-.3 2.9-1.9 3.8-3.3-.1-5.3 .5-3.2 .5-1.7 1.9-4.9 .7-2.7 1.2-5.7 .1-1 .7-1.9 1.9-1.1 2,.4 3-.9 1.4-.8 1.5-.4 1.5-.9 .7-1.8 .9-1.4 1.8-1.6-.1-1.3 .8-3.6 .7-1.4 1.9-2.3 .7-2.4-.1-2.9-.5-2.5 .2-1.5 .5-.9 1-1 .2-3 1.7-3 0-1.9-1.9-2.5-3.1-1-1-.5-1.7-3.5-.8-.6-2.6,3.4-5.7-2.5-1.7,0-1.4-1-1.6-.1-2.4-2.7-1.7-1.2-3.3,2.2-1.2,.5-1,.9-1.1-.5-.7,.2-2.9-.2-.9-.2-.6-1.5-1.3-1-1.9-.2-2.8-1.6-.2-.4-2.5-.9-.9-1.4 .4-2.2 .8-.7-1.3-1.8-.7-.3-.4-2-.5-.6 .3-1.1 .3-2.5 2-7.1 1.5-.1 .6-1.2 3.3,.3-.2-3.1-1.4-.9-.7-.8-5.2-1.6-1.1-1.8 1.3-.2 2.9,.1 1.4-.2 5.5,.1 1.8-1.4 0-1.1-1.8-1.4 1-.2-.5-2.9 .1-.7-.3-3.2 2.4-7.4 4.3-.2 1.2-2.2 .5-.6 .2-1.2 1-2.1 .2-1.2 1-1.6-.1-1.4 .8-1.3 1.2-.8 .4-.7 2.4-3.1 .9-.6 1.6-1.8 1.4-2.3 0-2.2 .6-.6 .1-2-.1-2.9 0-5.6 .7-.5 .1-1 1.2-.7 1-2 .8-1.8 0-.8 .7-.3 1.1-1.3 .4-1.2 1-.4 .8-1.3 .2-1.6 2.8-3.5 2.1-2.9 1.7-1.4 1-1.1 1.5-2.8 1.3-2.1 1.5-1.6 1.2-2.2 .8-1.1 2.1,.4 1.3,.5 1.3,.2 2.2,1 1-.5 .5-2 .7-.4 2.2,.7 1-.4 1.5,.4 .7,.6 2.7-.5 3.6-1.6 .7,.1 3.1,0 .9,.9 2.7,0 3.1-2.1 1.6-.8 3.2-1.2 2.4,.6 1.8,1.6 1.4,1.9 4.1-.6 .5-1.2-1.6-2.1-.3-4.4 .4-2.4-.1-3.1 .4-1.7 .4-.3-.1-2.8-1.6-.9-2.4-2.4 .3-2.5 .3-.1-.4-3.7 .5-2.9-.2-4.5 .9-5.1 0-2.3-.1-2.1-.3-1.1-1.6-3.2-2.6-7-.5-.4-.4-1.8-.3-3.4 0-2.1-.5-3.6-.3-1-1.3-2.6-.5-2-1.1-2 0-1.8-1-1.5-1-1.9-2-2.8-.6-1.7-.4-4.6-.6-2.4 .3-3.1 1.2-.3 1.4-1.4 .8-1.4 .1-1.2 .8-1 .6-1.7-1.6,.3-4.4,1.9-2.4,1.4-4.6,.4-3.1-.1-5.2,.6-5.1-1-3,.2-4.6,3.4-10.5,6.4-11.5,6.8-13.2,5.8-13.3,4.1-17.1,5.3-5.6,2.8-20.7,9.2-3.4,2.1-3.2,2.5-4,4.8-2.1,2.7-2.7,.5-5.4-1.4-3.3,.2-2.4,1.3-13.7-.1-7.8-.5 .2-.7-.3-1.8 .6-2.5 1.2-.9 .2-.8-.6-1.7 .2-2 1.1-1.7 .6-5.7 .4-2.4 .8-2.8 .6-4.6 .4-1 1.5-2.6-.5-2.3-1.8-1.6-1-.3-1.6,0-1-.6-1.4-2.1-.1-.7-.1-1.8 .7-.9 .2-1.4-.5-2.1 1.3-2.3 .8-1.9 0-.8 1.6-2.4 .2-3.7-.3-2 .3-2.4-.3-1.2 .3-.6-5.2-2.3-1.3-.5-1.1,.2-2.1-.2-2.8,.3 1.1-.9 2.2-.8 2.4,.5 3.2-.8 0-1.4 .6,0 2.1-1 .7,.2 4-.5 2.8-.8 2.1-.2 .9-.6 .6-1.3 3.1,1.4 1.6,.4 1.3-4.3 .3-2.7 .6-1.8 0-1 .5-3.2 1-.8 1.2-3.6 .5-.3 .6-1.5 1-1.5 1.1-1.2 .2-2.2 .9-.7 2.7-.2 1.8-.4 2.4-1.1 1,.1 2.2-.4 1.3-2.9-5.5-6.5-2.2-1.8-2.1-3.1-.5-2.8 1-1.3 1.4-1.1 1.8-3.4 1.1-1.3 1.6-1.3 0-.7 .9-2.3 1.7-1.8 0-2.3-.3-1 .9-1.6 .1-3.8-1-1.5-1.7-1.4-1.2-.6 .4-3.8 1.1-2.3 .1-.9 .6-1.3-.4-1.6-.4-.2 .3-1.3-.6-1.3-.2-2.9-.9-1.2 .4-1-.3-3.3 1-1.4 .1-.7-.4-1.5 .2-1-.9-1.1-2.5-1.4 .2-1.8-.8-.8-3,.4-1.4-1.3-1.9-.7-2.7-1.5-1.6-.4-1.2,.1-3.1,.8-1.2-.3-.8,.3-1.3-.1-1.9-.5-.7,.2-1-.6-.1-.5-1.6-.5-2.1-1.5-.3-1.2-.9-2.3 .5-1.2 1.4-2 .7-1.9 1.3-1.5 .2-2.4-.1-2.5 .5-1 2.9-1.9 2.5-.8 1.2-2 1.2-1.5 1-.8 2.4-1.2 1.3-1.3 1.5-3.2 .5-2.2 .4-.4-.8-2.7 .6-1.5 .6-.6 .1-1.9 .3-.8-.7-1.6 0-1.1 .3-.8-.6-2.7-.6-1.8-.5,.2-1.4-.8-.9-2.2 .6-1.3 1-1 1.5,.1 .3-1.3-.6-1 0-1-.7-.9-.1-2.2-.2-1-.6-.7-2.8,.3-1.6-1.6-.2-.7-1.8-2.7-.3-1.2-1.7-.5-1.1-.7-1.3-.1-.9,.5-1.6-1.2-2.6,.7-2.1,0-.5-.4-3.3-.4-1.2-.4-.7-.5-1.5,.2-1.2,1.1-2.8,.3-.7-.4-1.9-.5-3.2,0-1.9-.3-.7-.6-.1-.8-.9-.7-.9-1.2-.3-1.2 .3-1.4-1.4-1.4-.9-2.1-.7-3.1 1.7-2.6 .7-2.3-.1-.8 1.8-2.6-1.1-1.5-1.2-2.7-.5-1.8-1.6-1.2-.6-1-.1-1-1.3,.7-1.5,2.5-3.2-.2-4.7-1.1-.7-.4-1.1,0-.7-1.2 5.5-2.1 9-4.2 7.6-4.1 2.1-4-.8-2.7-5.4-2 2.9-3.2-1.2-.9-.7-1.1 .5-1.6-.2-1.1-.7-.4-.3-2.3 .8-1.8 1.7-1.9-.3-3.2 .8-2.6 1.1-1.8-.4-.6-.1-2.2-.3-1.2 .5-.9-.5-2.6-1.5-.6-1-1.4-.1-1.9-.7-1 0-1.8-.4-.2-.1-1.7-.6-2.3-1-.8-.4-1.1-1.7-.6-.5-1.2-.5-3.7 1.4-1.2 .7-2.2-.1-3.4 3.1-4.3 0-.7 1.4-2 2.2-.9 .5-1.2 0-1.5 1-1.3-.1-1.4-.8-1.8 .3-.6-.4-1.5 .2-.4-1.1-.9-.1-.5 .9-1.9-2-.9-1.3,.6-1.3,.1-1.1-1.5-1.1-.6-1.4-.2-1.7,.2-1.5,.6-2-1.2-2.1,.3-.7-.3-1.5-1.6-1-.1-1.3,.5-1.8-.1-2.9-1.5 .4-.4 0-1.2-.9-2.3-.8-1.3-.4-1.3 .3-.9-.1-1.7-1.2-1.8-.6,.1-1.4-1.4-.5-1.3-1.7-1.7-.3-.6-9.2,0-.9-.1-1.6,1.3-1.6,0-.9,.5-1.5,.4-.8,.4-.9,0-2.2,1.7-.5,1.3-2.1,.5-1.5-.1-.7,.5-1.4,.2-2.3-.9-1.4,.9-1.2,1.7-1.2,3-1.9,1.3-2.7,3.3-.2,1-1.2,1.8-1.5,.6-.5-.1-1.6,.5-1.3,1-1.4-.5-1.8,1.6-2.6,.2-1.4-.9-2.1,.2-1.9-.7-1.1-.6-1.6-.5-1.1,.4-3.5,.2-.4,.2-5.1,4.6-1.3,1.6-1.5,0-.9,.3-1.4-2.5-.2-1-.1-2.8 .2-1.8 0-1.5-1.4-5.8-.3-1.5-.9-3-1.7,.1-1,1.9-.5-.2-.7,.9-1.1,.8-2.6,.9-1.2-.1-.2-1.2-2.3-.9-.6-1.2-1.6-.4-.3-.3 .7-1.2 0-2.2-.6-.5-1.4,.6-1.3-1-.7,.1-1.4,1.1-.9,.3-1.7,2.1-1.2,.1-.7,1.3-1.2,1.1-1.7,.3-.9,.3-1,1.2-2,1.1-1.1-.6-2.4,1.4-1.6,.1-1.3,.4-1.4,0-.3-2.1-.5-.5-1.6-.3-.4-.3-.6-2.4-.8-1.5-.3-1.5-.8-1.4-.8-2.7-.1-4-1.1-4.1-.8-1.6-1.7-2.8-2.1-.5-.7,1.2-2.2,1.3-.6,.6-1.7,.6-1.2-.2-2.3-.9-2.9,.6-1.9-1.1-.6-.6-1.6-.9-1.1-.9-1-1.6-3,.4-2.1,.8-2.7-.3-.6,1.8-1.1,1.7-.5,1.5 .2,1.9-1,1-.6,.2-5.4,0-3.3,4-.9,2.4-2,2.2-.8,1.5 .1,3.1-1.2,3.6-.6,1.3 .6,1.2-.8,2.8 .1,4.1 .2,.8 1.1,1.3 .1,2.2 .5,1.2 .1,1.7-.4,3.6-.4,1.4-.7,.5-.9,0-4.7-1.5-1.6,.5-1.3-.4-2.3,.3-.9,2-2.8,1.8-.5-.4-.9-1.6-.5,0-2.6,.9-2.2,.3-2.5,.7-1.8,2.3-2.3,2.1-1,1.3-2.5,1.5-1.2,1.4-.3,1.3-1.8,1.2-2.2,.7-.9,.6 1.9,1.9 .5,1.1 .4,2.3 .1,2.2-.4,1.7 .3,1.7 1.9,2.1-.3,1.9-.5,1 .5,2.6 1.1,2.2-.7,2.4 .1,1.7-.4,8.3 .1,1.4 1.1,2.2-.2,1.1-1.1,.9-1.8,2.7-1,.5-3,1.2-2.9,1.5-1,.3-2.7,0-.8,2.3-1.8,2-1.5,3.8-3.2,4.8-4.4,3.4-.9,1.5-2.8,.3-1.6,1.4-1.7,1.2-1.2,2.1 .3,.8 .2,1.9 2.1,3.1 1.1,3.3 .2,1.2 .9,1.5 1.6,1.2 .5,2 1.4,.8 1.4,1.6 .2,1.3 0,2.6 .1,.5 1.5,1.5 .3,.7 .3,2.4 .4,1.8-.5,1.6-.7,1.1-.5,1.7-1.7,1.5-.5,.7 1.3,2.7 .2,1.7 .9,1.1 .9,.5 1.5,.1 .6,1.6 .7,1.3 1-.3-.4,1.3-1,.9-.8,2.1-.6,3.8-.5,1.7-.8,1.7 .2,.3-1.2,.7-1.2-.4-2.2,1.9-.8,.2-1.4,2.6-.3,.3-1.6-.2-1,.4-1.6,1.4-1.4,.8-1.5,0-2.5,1-1.3,2.7-1.7,1.9-1.7,1.5-.3,0-1.4-1.4-2.5-.4-3.6-.8 .9-.9-3-1.1-1.1-2.9z",
    lab: {
      강동구: [875.5, 451.2],
      송파구: [821.6, 573.5],
      강남구: [661.1, 568],
      서초구: [572.7, 635.7],
      관악구: [442.5, 703],
      동작구: [420.6, 583.1],
      영등포구: [345.9, 540.4],
      금천구: [332.4, 709.6],
      구로구: [186.1, 627.4],
      강서구: [134.2, 413.3],
      양천구: [251.7, 542],
      마포구: [358.8, 433.2],
      서대문구: [412.6, 378.3],
      은평구: [400.2, 225],
      노원구: [720.9, 109.3],
      도봉구: [633.9, 139.6],
      강북구: [612, 233],
      성북구: [600.8, 319.1],
      중랑구: [768.5, 312.8],
      동대문구: [681.1, 357.4],
      광진구: [759.1, 461.4],
      성동구: [652.1, 441.3],
      용산구: [509.8, 499.7],
      중구: [569.3, 424.6],
      종로구: [487, 284],
    },
  };
  const svg = $("map"),
    mapbox = $("mapbox");
  const VB0 = [-4, -26, D.map.w + 8, D.map.h + 34];
  let vb = VB0.slice();
  svg.setAttribute("viewBox", vb.join(" "));
  let pendingGuOpts = null,
    mapReady = false,
    mapView = "seoul",
    mapGu = null,
    guHist = false,
    mapAff = true,
    pendingGu = null;
  const GU = new Map(D.map.gu.map((g) => [g[0], g]));
  const GU_NUDGE = { 중구: [0, 6], 종로구: [-6, -4], 동대문구: [4, 0], 성동구: [0, 4], 광진구: [4, 0] };
  const MK_SYM = `<defs>\n  <symbol id="mk-rd" overflow="visible"><circle r="5.5"/></symbol>\n  <symbol id="mk-rc" overflow="visible"><rect x="-4.9" y="-4.9" width="9.8" height="9.8" rx="1.5"/></symbol>\n  <symbol id="mk-sm" overflow="visible"><path d="M0 -6.6 L7.4 5.3 L-7.4 5.3 Z"/></symbol>\n  <symbol id="mk-moa" overflow="visible"><path d="M0 -6.9 L6.9 0 L0 6.9 L-6.9 0 Z"/></symbol></defs>`;
  function initMap() {
    const gd = (n, d) => GEO.gu[n] || d;
    let html =
      MK_SYM +
      `<defs><filter id="fSea" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#0B1B3A" flood-opacity=".14"/></filter><filter id="fLift" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0B1B3A" flood-opacity=".28"/></filter></defs>`;
    html += `<g id="world"><path class="sbase" d="${GEO.outline}"/><g id="guFill">`;
    D.map.gu.forEach(([n, d]) => {
      html += `<path class="gu" data-gu="${n}" d="${gd(n, d)}" tabindex="0" role="button"/>`;
    });
    html += `</g><g id="guLine">`;
    D.map.gu.forEach(([n, d]) => {
      html += `<path class="gl" data-gu="${n}" d="${gd(n, d)}" vector-effect="non-scaling-stroke"/>`;
    });
    html += `</g><path class="river" d="${GEO.river}" vector-effect="non-scaling-stroke"/><text class="rivl" id="rivL" x="${GEO.rl[0]}" y="${GEO.rl[1]}" transform="rotate(${GEO.rl[2]} ${GEO.rl[0]} ${GEO.rl[1]})">한강</text><path class="soutline" d="${GEO.outline}" vector-effect="non-scaling-stroke"/><g id="guLift"></g>`;
    html +=
      '<g id="tlines"></g><g id="dlw"><g id="dongl"></g></g><g id="stns"></g><g id="leaders"></g><g id="okg"></g><g id="marks"></g><g id="mlw"><g id="mlab"></g></g><g id="stnl"></g><circle class="range" id="range" r="0" cx="-99" cy="-99"/><text class="rangel" id="rangeL" x="-99" y="-99">대략 범위</text><circle class="hjring" id="hjRing" r="0" cx="-99" cy="-99"/><g id="selRing"><circle class="ring2" id="ring2" r="0" cx="-99" cy="-99"/><circle class="ring" id="ring" r="0" cx="-99" cy="-99"/></g></g><g id="guLabels"></g>';
    svg.innerHTML = html;
    drawLines();
    svg.querySelectorAll("#guFill .gu").forEach((p) =>
      p.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          enterGu(p.dataset.gu, { hist: true });
        }
      }),
    );
    mapReady = true;
    refreshMap();
    drawStns();
    if (pendingGu) {
      const g = pendingGu;
      pendingGu = null;
      enterGu(g, pendingGuOpts || {});
    }
  }
  function scaleK() {
    return vb[2] / VB0[2];
  }
  let svgW = 0;
  function ppu() {
    const w = svgW || (svgW = svg.getBoundingClientRect().width) || svg.parentNode.clientWidth || 700;
    return w / vb[2];
  }
  if (window.ResizeObserver)
    new ResizeObserver(() => {
      svgW = svg.getBoundingClientRect().width;
    }).observe(svg);
  function affOk(r, basis) {
    if (estHide(r) || r.lc) return false;
    if (P.fund === "gap") return gapOk(r);
    if (r.dn || r.s >= 9 || r.cx || r.src === "moa") return false;
    if ($("pTrade").checked && restricted(r)) return false;
    if (rewinBlocked(r)) return false;
    const x = investC(r);
    return (basis || P.basis) === "total" ? x.ok && x.needTotal <= CASH : x.needBuy != null && x.needBuy <= CASH;
  }
  function mkState(r) {
    if (isDone(r)) return { a: "d", tbd: 0 };
    if (r.src === "moa") return { a: "n", tbd: 1, moa: 1 };
    const w = buyWindow(r);
    if (w.cls === "no" || w.cls === "chk" || r.dn) return { a: "x", tbd: 0, w };
    const b = effBasis(),
      x = investC(r),
      known = b === "total" ? x.ok && x.annual != null : x.needBuy != null;
    return { a: mapAff && affOk(r, b) ? "y" : "n", tbd: known ? 0 : 1 };
  }
  const BIN_AFF = [
    [0, 0, "0"],
    [1, 1, "1"],
    [2, 4, "2–4"],
    [5, 9, "5–9"],
    [10, Infinity, "10+"],
  ];
  const BIN_PROG = [
    [0, 0, "0"],
    [1, 19, "1–19"],
    [20, 39, "20–39"],
    [40, 59, "40–59"],
    [60, Infinity, "60+"],
  ];
  let MAP_MODE = "total";
  const modeOf = () => (!mapAff && !document.documentElement.classList.contains("simple") ? "prog" : MAP_MODE);
  const effBasis = () => (MAP_MODE === "now" ? "now" : P.basis);
  const binOf = (v) => (modeOf() === "prog" ? BIN_PROG : BIN_AFF).findIndex(([a, b]) => v >= a && v <= b);
  const NICE_MAX = [5, 10, 20, 30, 50, 100, 150, 200, 300, 500];
  let SMAX = 5;
  const tOf = (v) => (v <= 0 ? -1 : Math.sqrt(Math.min(1, (v - 1) / Math.max(1, SMAX - 1))));
  function fillVars(t) {
    if (t < 0) return "--a:var(--q-z);--b:var(--q-z);--f:0%";
    const x = t * 4,
      i = Math.min(3, Math.floor(x)),
      f = x - i;
    return `--a:var(--q${i});--b:var(--q${i + 1});--f:${(f * 100).toFixed(1)}%`;
  }
  function scaleTicks() {
    const c = [1, 2, 3, 5, 10, 20, 25, 30, 50, 100, 150, 200, 300, 500].filter((v) => v < SMAX),
      out = [1];
    c.forEach((v) => {
      if (tOf(v) - tOf(out[out.length - 1]) >= 0.2 && tOf(SMAX) - tOf(v) >= 0.16) out.push(v);
    });
    out.push(SMAX);
    return [...new Set(out)];
  }
  let GU_STAT = new Map();
  function guStats() {
    const m = new Map(D.map.gu.map((g) => [g[0], { aff: 0, now: 0, prog: 0, moa: 0, done: 0, pop: 0, st: [0, 0, 0, 0, 0, 0, 0] }]));
    R.forEach((r) => {
      if (!r.xy) return;
      const o = m.get(r.g);
      if (!o) return;
      if (isDone(r)) {
        o.done++;
        return;
      }
      o.prog++;
      o.st[st6(r)]++;
      if (r.src === "moa") o.moa++;
    });
    POP.forEach((r) => {
      const o = m.get(r.g);
      if (!o) return;
      o.pop++;
      if (affOk(r)) o.aff++;
      if (P.basis === "total" && affOk(r, "now")) o.now++;
    });
    const sum = (k) => [...m.values()].reduce((a, o) => a + o[k], 0);
    MAP_MODE = P.basis !== "total" ? "basis" : sum("aff") ? "total" : sum("now") ? "now" : "prog";
    return m;
  }
  const guMetric = (g) => {
    const o = GU_STAT.get(g);
    if (!o) return 0;
    const md = modeOf();
    return md === "prog" ? o.prog : md === "now" ? o.now : o.aff;
  };
  const guOrder = () => [...GU_STAT.entries()].sort((a, b) => guMetric(b[0]) - guMetric(a[0]) || b[1].prog - a[1].prog).map((e) => e[0]);
  function stBar(st, w) {
    return `<span class="stbar" style="width:${w}px">${[1, 2, 3, 4, 5, 6].map((i) => (st[i] ? `<i style="flex:${st[i]};background:${STCOL(i)}" title="${ST_LAB[i]} ${st[i]}곳"></i>` : "")).join("")}</span>`;
  }
  const STAGE_KEY = () =>
    `<span class="stkey" aria-hidden="true"><span class="stk-l">막대 색 = 사업 단계</span>${[1, 2, 3, 4, 5, 6].map((i) => `<span><i style="background:${STCOL(i)}"></i>${ST_LAB[i]}</span>`).join("")}</span>`;
  function modeNote() {
    const md = modeOf();
    if (md === "now") return `${e2(CASH)}억으로 입주까지 가능한 구가 없어 '지금 매수' 가능 수로 칠했어요`;
    if (md === "prog" && mapAff) return `${e2(CASH)}억으로 가능한 구가 없어 진행 중 구역 수로 칠했어요`;
    return "";
  }
  function modeTitle() {
    const md = modeOf();
    return md === "prog"
      ? "진행 중 구역 수"
      : md === "now"
        ? `<span class="lt-f">내 현금 ${e2(CASH)}억으로 지금 매수 가능한 구역 수 (입주까지는 부족)</span><span class="lt-s">${e2(CASH)}억 · 지금 매수 가능 (입주까지 부족)</span>`
        : `<span class="lt-f">내 현금 ${e2(CASH)}억으로 ${P.basis === "total" ? "입주까지" : "지금 매수"} 가능한 구역 수</span><span class="lt-s">${e2(CASH)}억 · ${P.basis === "total" ? "입주까지" : "지금 매수"} 가능</span>`;
  }
  function refreshMap() {
    GU_STAT = guStats();
    {
      const m = Math.max(0, ...[...GU_STAT.keys()].map(guMetric));
      SMAX = NICE_MAX.find((n) => n >= m) || m;
    }
    drawGuList();
    if (!mapReady) return;
    svg.querySelectorAll("#guFill .gu").forEach((p) => {
      const g = p.dataset.gu,
        o = GU_STAT.get(g) || { aff: 0, prog: 0 },
        v = guMetric(g);
      p.dataset.bin = binOf(v);
      p.setAttribute("style", fillVars(tOf(v)));
      p.setAttribute("aria-label", `${g}, 내 현금으로 가능 ${o.aff}곳, 지도 ${o.prog}곳 · 누르면 확대`);
      p.setAttribute("tabindex", mapView === "seoul" ? "0" : "-1");
    });
    drawGuLabels();
    drawLegend();
    setMapSub();
    drawOk();
    if (mapView === "gu") {
      paintDots();
      LMX.paint();
      if ($("report").querySelector(".gu-zones") || $("guListBox")?.dataset.gu) renderGuPanel(!$("report").querySelector(".gu-zones"));
    }
  }
  const DK = '<span class="w-l">진할수록</span><span class="w-d">밝을수록</span>';
  const GU_SUB = () => `점을 누르면 구역 리포트가 열려요 · 휠·두 손가락·+/−로 확대`;
  function setMapSub() {
    const md = modeOf(),
      sub = $("mapSub");
    if (sub && mapView === "gu") sub.textContent = GU_SUB();
    else if (sub)
      sub.innerHTML = `<span class="ms-c">${md === "prog" ? "색이 ${DK} 진행 중 구역이 많은 구예요" : md === "now" ? `색이 ${DK} 내 현금 ${e2(CASH)}억으로 지금 매수 가능한 구역이 많은 구예요 (입주까지 가능한 구가 없어 기준을 바꿨어요)` : `색이 ${DK} 내 현금 ${e2(CASH)}억으로 ${P.basis === "total" ? "입주까지" : "지금 매수"} 가능한 구역이 많은 구예요`}${md === "prog" && mapAff ? ` (내 현금 ${e2(CASH)}억으로 가능한 구가 없어요)` : ""}. </span>구를 누르면 확대되고, 확대한 지도에서 구역을 누르면 리포트가 열립니다`;
  }
  const GU_SHORT = (g) => (g === "중구" ? "중구" : g.replace(/구$/, ""));
  let GU_LBOX = [];
  function hideHubHits() {
    const g = $("stns");
    if (!g) return;
    const ov = mapView === "seoul",
      u = ppu(),
      m = 8 / u;
    for (const el of g.children) {
      if (!ov) {
        el.classList.remove("hid");
        continue;
      }
      const x = +el.dataset.x,
        y = +el.dataset.y;
      el.classList.toggle(
        "hid",
        GU_LBOX.some((b) => x + m > b[0] && x - m < b[2] && y + m > b[1] && y - m < b[3]),
      );
    }
  }
  function drawGuLabels() {
    const box = $("guLabels");
    if (!box) return;
    if (mapView !== "seoul" || vbAnim) {
      box.innerHTML = "";
      return;
    }
    const u = ppu(),
      W = svgW || svg.getBoundingClientRect().width,
      wide = W >= 560,
      tiny = W < 340;
    const NF = wide ? 11.5 : tiny ? 8 : 9,
      VF = wide ? 17 : tiny ? 11 : 13,
      ZF = wide ? 11 : tiny ? 7.5 : 8.5,
      LH = NF * 1.18;
    const tw = (s, fs) => [...s].reduce((a, ch) => a + (/[0-9]/.test(ch) ? 0.62 : /[가-힣]/.test(ch) ? 0.98 : 0.5) * fs, 0);
    const placed = [],
      lines = [],
      out = [];
    const hit = (b) =>
      placed.reduce(
        (m, o) => m + Math.max(0, Math.min(b[2], o[2]) - Math.max(b[0], o[0])) * Math.max(0, Math.min(b[3], o[3]) - Math.max(b[1], o[1])),
        0,
      );
    const area = (g) => {
      const x = GU.get(g);
      return x ? x[4] * x[5] : 0;
    };
    const order = [...GU_STAT.keys()].sort((a, b) => (guMetric(b) > 0) - (guMetric(a) > 0) || area(a) - area(b));
    const OFF = [
      [0, 0],
      [0, -0.35],
      [0, 0.35],
      [-0.35, 0],
      [0.35, 0],
      [0, -0.7],
      [0, 0.7],
      [-0.6, 0],
      [0.6, 0],
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
      [0, -1.05],
      [0, 1.05],
      [-1, 0],
      [1, 0],
      [-0.9, -0.9],
      [0.9, -0.9],
      [-0.9, 0.9],
      [0.9, 0.9],
      [0, -1.5],
      [0, 1.5],
      [-1.4, 0],
      [1.4, 0],
    ];
    order.forEach((g) => {
      const gg = GU.get(g);
      if (!gg) return;
      const v = guMetric(g),
        name = GU_SHORT(g),
        gp = svg.querySelector(`#guFill .gu[data-gu="${g}"]`);
      const a0 = GEO.lab[g] || [gg[2], gg[3]];
      const inside = (x, y) => (gp ? gp.isPointInFill(new DOMPoint(x, y)) : true);
      const forms =
        v > 0
          ? [
              ["two", Math.max(tw(name, NF), tw(String(v), VF)) + 4, LH + VF * 1.02],
              ["one", tw(name, NF) + 3 + tw(String(v), VF) + 4, VF * 1.1],
            ]
          : [["zero", tw(name, ZF) + 4, ZF * 1.3]];
      let best = null;
      for (const [form, wp, hp] of forms) {
        const w = wp / u,
          h = hp / u;
        for (const [ox, oy] of OFF) {
          const cx = a0[0] + ox * w,
            cy = a0[1] + oy * h,
            b = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
          const ov = hit(b);
          const ix = w * 0.38,
            iy = h * 0.38,
            pin = [
              [cx, cy],
              [cx - ix, cy - iy],
              [cx + ix, cy - iy],
              [cx - ix, cy + iy],
              [cx + ix, cy + iy],
            ].filter(([x, y]) => inside(x, y)).length;
          const sc = ov * u * u * 50 + (5 - pin) * (pin ? 120 : 600) + Math.hypot(ox, oy) * 40 + (form === "one" ? 60 : 0);
          if (!best || sc < best.sc) best = { sc, form, cx, cy, b, w, h, ov, pin };
          if (!ov && pin === 5 && !ox && !oy) break;
        }
        if (best && !best.ov && best.pin >= 4) break;
      }
      placed.push(best.b);
      const { form, cx, cy, b } = best,
        moved = !inside(cx, cy);
      if (moved)
        lines.push(
          `<line x1="${a0[0]}" y1="${a0[1]}" x2="${cx}" y2="${cy}" style="stroke-width:${1 / u}px"/><circle cx="${a0[0]}" cy="${a0[1]}" r="${1.8 / u}"/>`,
        );
      const t = tOf(v),
        cls = `glab${moved ? " out" : t >= 0.5 ? " hi" : ""}${v > 0 ? "" : " z"}`,
        sty = moved ? "" : fillVars(t),
        hs = `stroke-width:${(wide ? 3 : 2.5) / u}px`;
      if (form === "two")
        out.push(
          `<g class="${cls}" data-gu="${g}" style="${sty}"><text class="gn" x="${cx}" y="${b[1] + (LH * 0.52) / u}" style="font-size:${NF / u}px;${hs}">${esc(name)}</text><text class="gv" x="${cx}" y="${b[1] + (LH + VF * 0.52) / u}" style="font-size:${VF / u}px;${hs}">${v}</text></g>`,
        );
      else if (form === "one")
        out.push(
          `<g class="${cls}" data-gu="${g}" style="${sty}"><text x="${cx}" y="${cy}" style="${hs}"><tspan class="gn" style="font-size:${NF / u}px">${esc(name)} </tspan><tspan class="gv" style="font-size:${VF / u}px">${v}</tspan></text></g>`,
        );
      else
        out.push(
          `<g class="${cls}" data-gu="${g}" style="${sty}"><text class="gn" x="${cx}" y="${cy}" style="font-size:${ZF / u}px;${hs}">${esc(name)}</text></g>`,
        );
    });
    box.innerHTML = `<g class="glead">${lines.join("")}</g>${out.join("")}`;
    GU_LBOX = placed.slice();
    hideHubHits();
    const rl = $("rivL");
    if (rl) rl.style.fontSize = (wide ? 11 : 10) / u + "px";
  }
  function drawGuList() {
    const md = modeOf(),
      lab = md === "now" ? "지금 매수" : "가능";
    const rows = guOrder()
      .map((g) => {
        const o = GU_STAT.get(g),
          v = md === "now" ? o.now : o.aff;
        return `<li><button type="button" class="gl-row" data-gu="${g}" title="지도 ${o.prog}곳 = 진행 중 ${o.prog - o.moa} + 모아타운 관리지역 ${o.moa}${o.done ? ` (완료 ${o.done}곳 별도)` : ""}" aria-label="${g}: 내 현금으로 ${lab} ${v}곳, 지도 ${o.prog}곳 (${[1, 2, 3, 4, 5, 6].map((i) => `${ST_LAB[i]} ${o.st[i]}`).join(", ")}) · 지도에서 확대"><span class="gl-n"><i class="gl-sw" style="${fillVars(tOf(md === "prog" ? o.prog : v))}" aria-hidden="true"></i>${g}</span><span class="gl-a">${lab} <b>${fmt(v)}</b>곳</span>${stBar(o.st, 120)}<span class="gl-p">지도 ${fmt(o.prog)}곳</span></button></li>`;
      })
      .join("");
    const head = `<p class="gl-cap">구를 누르면 지도가 그 구로 확대돼요 · ${lab} = 내 현금 ${e2(CASH)}억으로 ${P.fund === "gap" ? "전세 끼고 지금 계약" : md === "now" || P.basis !== "total" ? "지금 매수" : "입주까지"}<br>지도 N곳 = 위치 확인된 진행 중 구역 + 모아타운 관리지역(완료 제외). 통계의 자치구 수는 모아타운 제외·위치 미확인 포함이라 다를 수 있어요</p>${STAGE_KEY()}`;
    [
      ["guList", "guListBox"],
      ["guListD", null],
    ].forEach(([id]) => {
      const el = $(id);
      if (el) setHTML(el, rows);
    });
    if ($("guListCap")) $("guListCap").innerHTML = head;
    if ($("guListCapD")) $("guListCapD").innerHTML = head;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".gl-row");
    if (!b) return;
    enterGu(b.dataset.gu, { hist: true, scroll: true });
  });
  const POS = new Map();
  const VIS = new Set();
  const LAYOUT = new Map();
  let BASEVB = null,
    BASEGU = null,
    layT = 0,
    hovMk = null;
  const minGap = () => (coarse() ? 13 : 14);
  const MK_R = { y: 7, n: 5, e: 5, u: 4, x: 3 };
  const zoomK = () => (BASEVB ? BASEVB[2] / vb[2] : 1);
  function dotState(r) {
    if (isDone(r) || r.src === "moa" || r.dn) return "x";
    const w = buyWindow(r);
    if (w.cls === "no" || w.cls === "chk") return "x";
    if (estHide(r)) return "e";
    if (P.fund === "gap") {
      const g = gapOf(r);
      return g.block ? "x" : g.na ? "u" : g.now <= CASH ? "y" : "n";
    }
    const b = effBasis(),
      x = investC(r),
      known = b === "total" ? x.ok : x.needBuy != null;
    if (!known) return "u";
    return affOk(r, b) ? "y" : "n";
  }
  const DOT_TXT = {
    y: "내 현금으로 입주 가능",
    n: "현금 부족",
    u: "거래 적어 계산 보류",
    e: "구 평균 시세로 추정 · 곳 수에서 제외",
    x: "계산 제외",
  };
  const dotTxt = (a) =>
    a === "u" || a === "e" || a === "x"
      ? DOT_TXT[a]
      : P.fund === "gap"
        ? a === "y"
          ? "전세 끼고 내 현금으로 살 수 있음"
          : "전세 끼고도 현금 부족"
        : a === "y"
          ? effBasis() === "total"
            ? DOT_TXT.y
            : "내 현금으로 지금 매수 가능"
          : effBasis() === "total"
            ? DOT_TXT.n
            : "지금 매수하기엔 현금 부족";
  function layoutGu(list) {
    const W = svg.clientWidth || svgW || 700,
      key = [mapGu, Math.round(W), minGap()].join("|");
    if (LAYOUT.has(key)) return LAYOUT.get(key);
    const bv = BASEVB || vb,
      u = W / bv[2],
      Hp = (W * bv[3]) / bv[2];
    const D0 = minGap(),
      n = list.length,
      p = list.map((r) => [(r.xy[0] - bv[0]) * u, (r.xy[1] - bv[1]) * u]);
    for (let it = 0; it < 80; it++) {
      const grid = new Map(),
        cell = (x, y) => Math.floor(x / D0) + "," + Math.floor(y / D0);
      for (let i = 0; i < n; i++) {
        const k = cell(p[i][0], p[i][1]);
        (grid.get(k) || grid.set(k, []).get(k)).push(i);
      }
      let worst = 0;
      for (let i = 0; i < n; i++) {
        const cx = Math.floor(p[i][0] / D0),
          cy = Math.floor(p[i][1] / D0);
        for (let gx = cx - 1; gx <= cx + 1; gx++)
          for (let gy = cy - 1; gy <= cy + 1; gy++) {
            const b = grid.get(gx + "," + gy);
            if (!b) continue;
            for (const j of b) {
              if (j <= i) continue;
              const dx = p[j][0] - p[i][0],
                dy = p[j][1] - p[i][1];
              let d = Math.hypot(dx, dy);
              if (d >= D0) continue;
              let ux, uy;
              if (d < 1e-6) {
                const a = (i * 2.399963 + j) % (2 * Math.PI);
                ux = Math.cos(a);
                uy = Math.sin(a);
                d = 0;
              } else {
                ux = dx / d;
                uy = dy / d;
              }
              const h = (D0 - d) / 2;
              worst = Math.max(worst, h);
              p[i][0] -= ux * h;
              p[i][1] -= uy * h;
              p[j][0] += ux * h;
              p[j][1] += uy * h;
            }
          }
      }
      for (let i = 0; i < n; i++) {
        p[i][0] = Math.min(W - 9, Math.max(9, p[i][0]));
        p[i][1] = Math.min(Hp - 9, Math.max(9, p[i][1]));
      }
      if (worst < 0.25) break;
    }
    const out = new Map(list.map((r, i) => [r.id, [bv[0] + p[i][0] / u, bv[1] + p[i][1] / u]]));
    if (LAYOUT.size > 40) LAYOUT.clear();
    LAYOUT.set(key, out);
    return out;
  }
  function shortLabel(r) {
    let s = shortName(r.n)
      .replace(/^\[[^\]]*\]\s*/, "")
      .replace(/^\(?가칭\)\s*/, "")
      .replace(/\([^)]*\)?/g, " ");
    const zone = /구역|지구/.test(s);
    s = s.replace(
      /^(\S+?)(아파트)?지구\s*특별계획구역\s*([①②③④⑤⑥⑦⑧⑨]|\d+).*$/,
      (m, a, b, c) => a + " 특별" + ("①②③④⑤⑥⑦⑧⑨".indexOf(c) + 1 || c),
    );
    const m2 = s.match(/지구\s+(\S+?\d[\d-]*)\s*(재정비촉진)?구역/);
    if (m2) s = m2[1];
    s = s
      .replace(/재정비촉진(지구)?/g, " ")
      .replace(
        /(주택정비형|도시정비형|공공재개발|LH참여형|장기전세주택|장기전세|건립|활성화|모아타운|재개발|재건축|정비|사업|아파트|준비위원회|추진위원회|주민대표회의|조합|소규모주택|소규모|통합|SHIFT|공공임대주택|임대주택|시장정비|장기전세)/g,
        " ",
      )
      .replace(/(^|\s)(공공|LH|일대|일원)(?=\s|$)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    s = s.replace(/(\d+)의(\d+)/g, "$1-$2");
    s = s
      .replace(/^(\D+?)\s*(\d+)\s*구역\s*(\d+)\s*지구$/, "$1$2-$3")
      .replace(/^(\D+?)(\d+)\s*지구\s*(\d+)\s*구역$/, "$1$2-$3")
      .replace(/^(\D+?\d+)\s+(\d+(?:-\d+)?)\s*구역$/, "$1-$2")
      .replace(/^(\S+?\d*동)\s*(\d+(?:-\d+)?)\s*구역$/, "$1$2")
      .replace(/\s*제?\s*([A-Z]?\d+(?:-\d+)*)\s*구역$/, "$1")
      .replace(/(\S)구역$/, "$1");
    if (zone) s = s.replace(/^([가-힣]{2,})동(\d+(?:-\d+)*)$/, "$1$2");
    s = zone
      ? s.replace(/^(\S+?(?:동|가))\s+(\d+)(?:-\d+)?(\s.*)?$/, "$1 $2")
      : s.replace(/^(\S+?(?:동|가))\s*(\d+)(?:-\d+)?(\s.*)?$/, "$1 $2");
    s = s.replace(/^\S+동\s+(\D\S*)$/, "$1");
    s = s
      .replace(/역 역세권$/, "역")
      .replace(/\s+/g, " ")
      .trim();
    if (s.length > 8) s = s.replace(/역세권$/, "역");
    if (!s) s = shortName(r.n);
    return s.length > 11 ? s.slice(0, 10) + "…" : s;
  }
  const TRD = (() => {
    try {
      return JSON.parse($("transitData").textContent);
    } catch (e) {
      return { lines: [], col: [], st: [], paths: {} };
    }
  })();
  const HJD = (() => {
    try {
      return JSON.parse($("hojaeData").textContent);
    } catch (e) {
      return { items: [] };
    }
  })();
  const LNS = TRD.lines,
    LCOL = TRD.col;
  const STN = TRD.st.map(([n, lat, lng, ls, k]) => ({ n, ll: [lat, lng], ls, k, xy: toXY(lat, lng), gx: [] }));
  // 역 이름 → 역(시작 때 구역×호재마다 불려 전체 훑기가 수백 ms였다 → 이름별로 한 번만)
  const STN_BY = new Map();
  const stnBy = (n) => {
    if (STN_BY.has(n)) return STN_BY.get(n);
    const a = STN.filter((s) => s.n === n);
    const v = a.find((s) => s.ls.some((i) => i < 9)) || a[0] || null;
    STN_BY.set(n, v);
    return v;
  };
  HJD.items
    .filter((h) => /^gtx/.test(h.id))
    .forEach((h) =>
      (h.stn || []).forEach(([n, st]) => {
        const s = stnBy(n);
        if (s) s.gx.push({ l: h.n.replace("GTX-", ""), open: st === "개통" });
      }),
    );
  STN.forEach((s) => {
    s.hub = !!(s.k || s.gx.length);
    s.hubOpen = !!(s.k || s.gx.some((g) => g.open));
    s.xfer = s.ls.length > 1;
  });
  function hubTag(s) {
    const a = [];
    if (s.k) a.push(s.k);
    const o = s.gx.filter((g) => g.open).map((g) => g.l),
      p = s.gx.filter((g) => !g.open).map((g) => g.l);
    if (o.length) a.push("GTX-" + o.join("·"));
    if (p.length) a.push((o.length ? "" : "GTX-") + p.join("·") + "(예정)");
    return a.join(" · ");
  }
  const HJ_STN = new Set(HJD.items.flatMap((h) => (h.stn || []).map(([n]) => n)));
  const stnLines = (s) => s.ls.map((i) => LNS[i]).join("·");
  function nearStn(r) {
    if (!r.ll) return null;
    if (r._ns !== undefined) return r._ns;
    let b = null,
      bd = Infinity;
    for (const s of STN) {
      const d = hav(r.ll, s.ll);
      if (d < bd) {
        bd = d;
        b = s;
      }
    }
    return (r._ns = b ? { s: b, d: bd } : null);
  }
  const walkM = (d) => Math.max(1, Math.round((d * 1.3) / 67));
  function stnInfo(r) {
    if (r._si !== undefined) return r._si;
    let o = null;
    if (r.st && r.st.n) {
      const n = r.st.n.replace(/역$/, "");
      o = { n, d: Math.round(r.st.d), s: stnBy(n) };
    } else {
      const x = nearStn(r);
      if (x) o = { n: x.s.n, d: Math.round(x.d), s: x.s };
    }
    if (o) o.min = walkM(o.d);
    return (r._si = o);
  }
  const stnTxt = (r, pre = "가까운 역 ") => {
    const x = stnInfo(r);
    return x ? `${pre}${x.n}역 ${fmt(x.d)}m · 도보 약 ${x.min}분 (직선거리 기준)` : "";
  };
  const nearTxt = (r) => stnTxt(r);
  let showStn = true;
  try {
    showStn = localStorage.getItem("jg-stn") !== "0";
  } catch (e) {}
  function drawLines() {
    const g = $("tlines");
    if (!g) return;
    g.innerHTML = Object.entries(TRD.paths)
      .map(
        ([i, arr]) =>
          `<g class="tl${LNS[i] === "GTX-A" ? " gtx" : ""}" style="--lc:${LCOL[i]}">${arr.map((p) => `<polyline points="${p}"/>`).join("")}</g>`,
      )
      .join("");
  }
  function stnSym(s, ov) {
    if (s.hub) {
      const solid = s.hubOpen,
        c = !s.k && s.gx.length ? "#9A6292" : "";
      const sz = ov ? 9 : 12,
        h = sz / 2,
        rx = ov ? 2.2 : 3;
      return solid
        ? `<rect class="hb" x="${-h}" y="${-h}" width="${sz}" height="${sz}" rx="${rx}"${c ? ` style="fill:${c}"` : ""}/><circle class="hbc" r="${ov ? 1.6 : 2.2}"/>`
        : `<rect class="hb p" x="${-h}" y="${-h}" width="${sz}" height="${sz}" rx="${rx}"/><circle class="hbp" r="${ov ? 1.5 : 2}"/>`;
    }
    const c = LCOL[s.ls[0]] || "var(--text-3)";
    return s.xfer
      ? `<circle class="sx2" r="5.2"/><circle class="sx1" r="2.9" style="stroke:${c}"/>`
      : `<circle class="sx1" r="3.5" style="stroke:${c}"/>`;
  }
  let STN_VIS = [];
  function drawStns() {
    const g = $("stns");
    if (!g) return;
    mapbox.classList.toggle("no-stn", !showStn);
    if (!showStn || vbAnim) {
      g.innerHTML = "";
      STN_VIS = [];
      return;
    }
    const ov = mapView !== "gu",
      B = ov ? VB0 : BASEVB || vb,
      m = ov ? 0 : B[2] * 0.25;
    STN_VIS = STN.filter(
      (s) => (!ov || s.hub) && s.xy[0] > B[0] - m && s.xy[0] < B[0] + B[2] + m && s.xy[1] > B[1] - m && s.xy[1] < B[1] + B[3] + m,
    );
    STN_VIS.sort((a, b) => a.hub - b.hub || a.xfer - b.xfer);
    g.innerHTML = STN_VIS.map(
      (s) => `<g class="sx${s.hub ? " hub" : ""}${ov ? " ov" : ""}" data-x="${s.xy[0]}" data-y="${s.xy[1]}">${stnSym(s, ov)}</g>`,
    ).join("");
    rescaleStns();
    if (ov) hideHubHits();
  }
  function rescaleStns() {
    const g = $("stns");
    if (!g || !g.firstChild) return;
    const k = 1 / ppu();
    for (const el of g.children) el.setAttribute("transform", `translate(${el.dataset.x} ${el.dataset.y}) scale(${k})`);
  }
  const aptZone = (r) => r.k === "재건축";
  const KBC = {
    o1173: 36392,
    o1172: 147,
    o1175: 136,
    o1176: 144,
    o1168: 141,
    o1166: 5,
    o1165: 1,
    o1163: 188,
    o1160: 186,
    o1162: 201,
    o1161: 192,
    o1159: 187,
    o1157: 345179,
    o1158: 36403,
    o1153: 161,
    o1152: 157,
    o1150: 165,
    o1146: 36367,
    o1145: 95,
    o1143: 103,
    o1144: 92,
    o1141: 101,
    o1137: 121,
    o1142: 96,
    o1135: 135,
    o1133: 132,
    o1134: 134,
    o1136: 123,
    o1115: 350,
    o1118: 346,
    o1116: 351,
    o1125: 208,
    o1114: 352,
    o1113: 353,
    o1112: 345,
    o1102: 266,
    o1104: 377,
    o1091: 243,
    o1001: 557,
    o1000: 20465,
    o1011: 536,
    o951: 594,
    o946: 606,
    o945: 728,
    o952: 602,
    o944: 726,
    o926: 679,
    o906: 819,
    o909: 841,
    o921: 749,
    o895: 768,
    o905: 824,
    o896: 769,
    o888: 876,
    o883: 874,
    o881: 872,
    o878: 878,
    o857: 929,
    o867: 925,
    o868: 916,
    o843: 965,
    o845: 963,
    o855: 912,
    o842: 966,
    o841: 986,
    o835: 940,
    o836: 36400,
    o837: 938,
    o830: 1022,
    o829: 1071,
    o828: 1062,
    o817: 1160,
    o826: 1117,
    o827: 1063,
    o813: 1192,
    o786: 22167,
    o770: 1238,
    o812: 1195,
    o691: 1353,
    o675: 36559,
    o597: 1580,
    o591: 1576,
    o589: 1578,
    o590: 1596,
    o588: 48262,
    o581: 1608,
    o580: 1622,
    o573: 1614,
    o569: 1629,
    o568: 1612,
    o564: 1668,
    o566: 1611,
    o554: 1740,
    o552: 1524,
    o547: 1519,
    o548: 1538,
    o539: 1533,
    o543: 1561,
    o538: 1541,
    o536: 1530,
    o518: 1750,
    o535: 1520,
    o514: 1788,
    o507: 1777,
    o416: 1956,
    o415: 1944,
    o411: 1943,
    o410: 1949,
    o397: 1988,
    o412: 1945,
    o392: 1940,
    o393: 1985,
    o391: 1920,
    o390: 1922,
    o385: 1972,
    o387: 28902,
    o384: 1969,
    o386: 1968,
    o383: 1970,
    o381: 2005,
    o372: 1911,
    o376: 1908,
    o371: 1907,
    o370: 2e3,
    o369: 2001,
    o366: 1870,
    o363: 1868,
    o356: 2023,
    o357: 36630,
    o355: 2016,
    o353: 49362,
    o354: 2021,
    o352: 2017,
    o351: 338097,
    o333: 2128,
    o330: 2075,
    o329: 2074,
    o328: 36311,
    o327: 36650,
    o325: 2080,
    o326: 2073,
    o311: 2212,
    o314: 2203,
    o307: 2197,
    o291: 2262,
    o289: 2261,
    o304: 2247,
    o288: 2261,
    o285: 2264,
    o287: 2260,
    o270: 2231,
    o267: 2223,
    o251: 2222,
    o266: 2224,
    o250: 2232,
    o242: 2290,
    o240: 2189,
    o246: 2283,
    o249: 2235,
    o239: 2180,
    o237: 2176,
    o236: 2178,
    o238: 2175,
    o235: 2173,
    o234: 2181,
    o233: 2172,
    o232: 2176,
    o228: 2184,
    o231: 2183,
    o229: 2177,
    o226: 2171,
    o225: 2179,
    o185: 2384,
    o224: 2182,
    o223: 2174,
    o179: 2341,
    o177: 2330,
    o180: 2348,
    o173: 2315,
    o170: 2362,
    o174: 2320,
    o175: 2317,
    o126: 2402,
    o154: 2304,
    o68: 2620,
    o80: 2480,
    o14: 2549,
    o1151: 166,
    o1149: 167,
    o1110: 348,
    o999: 500,
    o814: 44281,
    o766: 1211,
    o541: 1540,
    o368: 2002,
    o316: 2092,
    o331: 2076,
  };
  const IS_MOBILE =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ""));
  function listingURL(r) {
    if (!r || !r.ll) return null;
    const q = `${r.ll[0].toFixed(6)},${r.ll[1].toFixed(6)},17`;
    if (aptZone(r) && KBC[r.id]) return `https://kbland.kr/c/${KBC[r.id]}`;
    return `https://kbland.kr/map?xy=${r.ll[0].toFixed(6)},${r.ll[1].toFixed(6)},17`;
  }
  const LIST_NOTE = "매물 가격이 계산기 기준 매수가보다 높으면 입주 현금도 늘어나요. 입주권 여부는 조합·중개사무소에서 꼭 확인하세요.";
  const noTicket = (r) => !isDone(r) && !r.dn && !r.cx && r.src !== "moa" && buyWindow(r).cls === "no";
  const listBtn = (r, cls = "") => {
    const u = listingURL(r);
    if (!u) return "";
    if (noTicket(r))
      return `<p class="note riskbox lb-risk">이 구역은 지금 사면 입주권이 나오지 않아요</p><a class="btn secondary sm list-btn" href="${esc(u)}" target="_blank" rel="noopener">주변 시세만 보기 <span aria-hidden="true">↗</span></a>`;
    return `<a class="btn list-btn ${cls}" href="${esc(u)}" target="_blank" rel="noopener">이 구역 매물 보기 <span aria-hidden="true">↗</span></a>`;
  };
  function cashStrip(r) {
    if (P.fund === "gap" && typeof gapStrip === "function") return gapStrip(r);
    if (isDone(r) || r.dn || r.cx || r.src === "moa" || noTicket(r)) return "";
    const x = investC(r),
      tot = P.basis === "total",
      need = tot ? (x.ok ? x.needTotal : null) : x.needBuy,
      lab = tot ? "입주까지 필요한 현금" : "지금 매수에 필요한 현금";
    if (need == null)
      return `<p class="cstrip na"><span>${lab}</span><b>–</b><small>${x.price == null ? noPriceTxt(r) : "신축 시세·입주 시점 자료가 부족해 입주까지는 계산 보류"}</small></p>`;
    const estN = isEst(r) ? `<span class="zb est">구 평균 시세로 추정${P.est ? "" : " · 곳 수 제외"}</span>` : "";
    const left = CASH - need;
    return `<p class="cstrip ${left >= 0 ? "ok" : "short"}"><span>${lab}${estN}</span><b>${e2(need)}억</b><small>${left >= 0 ? `내 현금 ${e2(CASH)}억 중 ${e2(left) === "0" ? "남는 돈 없음" : e2(left) + "억 남음"}` : `내 현금 ${e2(CASH)}억보다 ${e2(-left)}억 더 필요`}</small></p>`;
  }
  const HJ_R = 1500;
  const HJ_BADGE = { 개통: "b-ok", "공사 중": "b-go", 확정: "b-fix", "예타 통과": "b-fix", "기본계획 수립": "b-fix", 계획: "b-plan" };
  function nearHojae(r) {
    if (!r || !r.ll) return [];
    if (r._hj) return r._hj;
    const out = [];
    HJD.items.forEach((h) => {
      if (h.pt) {
        const d = hav(r.ll, h.pt);
        if (d <= HJ_R) out.push({ h, d, st: h.st });
        return;
      }
      let best = null;
      const si = stnInfo(r);
      (h.stn || []).forEach(([n, st]) => {
        const s = stnBy(n);
        if (!s) return;
        const d = si && si.n === n ? si.d : hav(r.ll, s.ll);
        if (!best || d < best.d) best = { d, at: n, st };
      });
      if (best && best.d <= HJ_R) out.push({ h, d: best.d, at: best.at, st: best.st });
    });
    return (r._hj = out.sort((a, b) => a.d - b.d));
  }
  const INF = (() => {
    try {
      return JSON.parse($("infraData").textContent);
    } catch (e) {
      return null;
    }
  })();
  const INF_LAB = { e: "초등학교", m: "중학교", h: "고등학교", hp: "대형병원", mt: "대형마트" };
  function infraOf(r) {
    if (!INF || !r) return null;
    if (r._inf !== undefined) return r._inf;
    const z = INF.z[r.id];
    if (!z) return (r._inf = null);
    const o = {},
      full = !!INF.poi;
    INF.cats.forEach((k, i) => {
      const p = full ? INF.poi[k][z[i * 2]] : r.infP && r.infP[i];
      o[k] = { n: p ? p[0] : null, ll: p ? [p[1], p[2]] : null, t: p ? p[3] || "" : "", d: full ? z[i * 2 + 1] : z[i] };
    });
    return (r._inf = o);
  }
  const INF_F = {
    e300: (r) => {
      const i = infraOf(r);
      return !!i && i.e.d <= 300;
    },
    mt1k: (r) => {
      const i = infraOf(r);
      return !!i && i.mt.d <= 1e3;
    },
    hp2k: (r) => {
      const i = infraOf(r);
      return !!i && i.hp.d <= 2e3;
    },
  };
  scoreAll();
  const kmTxt = (d) => (d < 1e3 ? `${fmt(Math.round(d))}m` : `${(d / 1e3).toFixed(1)}km`);
  const hjBadge = (st) => `<span class="hjb ${HJ_BADGE[st] || "b-plan"}">${esc(st)}</span>`;
  function drawOk() {
    const g = $("okg");
    if (!g) return;
    if (mapView !== "seoul" || vbAnim || modeOf() === "prog") {
      g.innerHTML = "";
      return;
    }
    const u = ppu();
    let h = "";
    R.forEach((r) => {
      if (!r.xy || isDone(r) || dotState(r) !== "y") return;
      h += `<circle class="okh" cx="${r.xy[0]}" cy="${r.xy[1]}" r="${7 / u}" style="animation-delay:${(((r.xy[0] * 7 + r.xy[1] * 3) % 24) / 10).toFixed(1)}s"/><circle class="okd" cx="${r.xy[0]}" cy="${r.xy[1]}" r="${3.2 / u}" style="stroke-width:${1.3 / u}px"/>`;
    });
    g.innerHTML = h;
  }
  function paintDots() {
    if (!mapReady) return;
    POS.clear();
    VIS.clear();
    cancelIdle(layT);
    drawOk();
    if (mapView !== "gu" || vbAnim) {
      ["marks", "leaders", "mlab", "dongl"].forEach((id) => {
        if ($(id)) $(id).innerHTML = "";
      });
      LABS = [];
      DLABS = [];
      drawStns();
      placeRing();
      return;
    }
    if (BASEGU !== mapGu) {
      BASEGU = mapGu;
      BASEVB = vb.slice();
    }
    const all = R.filter((r) => r.g === mapGu && r.xy && !isDone(r));
    const W = svg.clientWidth || svgW || 700,
      cached = LAYOUT.get([mapGu, Math.round(W), minGap()].join("|"));
    const lay = cached || new Map(all.map((r) => [r.id, r.xy]));
    if (!cached)
      layT = onIdle(() => {
        layoutGu(all);
        if (mapView === "gu" && BASEGU === all[0]?.g) paintDots();
      });
    const ORD = { x: 0, u: 1, e: 2, n: 3, y: 4 };
    const items = all.map((r) => ({ r, a: dotState(r), p: lay.get(r.id) })).sort((a, b) => ORD[a.a] - ORD[b.a]);
    let marks = "",
      leads = "";
    items.forEach(({ r, a, p }) => {
      POS.set(r.id, p);
      if (Math.hypot(p[0] - r.xy[0], p[1] - r.xy[1]) > 1e-6)
        leads += `<line data-id="${r.id}" x1="${r.xy[0]}" y1="${r.xy[1]}" x2="${p[0]}" y2="${p[1]}"/>`;
      const w = mkState(r),
        stg = r.src === "moa" ? "관리계획" : stageName(r);
      marks += `<circle class="mc${typeof CM_SET !== "undefined" && CM_SHOW && CM_SET.has(r.id) ? " cm" : ""}" data-id="${r.id}" data-a="${a}" cx="${p[0]}" cy="${p[1]}" r="1" tabindex="0" role="button" aria-label="${esc(shortName(r.n))}, ${esc(dongOf(r))} · ${esc(SHAPE[shapeOf(r)])} · ${esc(stg)}, ${a === "u" && w.a === "x" ? "입주권 없음" : dotTxt(a)}"/>`;
    });
    $("leaders").innerHTML = leads;
    $("marks").innerHTML = marks;
    hovMk = null;
    drawStns();
    $("marks")
      .querySelectorAll(".mc")
      .forEach((el) =>
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select(el.dataset.id, false, false, { fromMk: true });
          }
        }),
      );
    applyVis();
    pickedId = null;
    markPick();
  }
  function applyVis() {
    VIS.clear();
    R.forEach((r) => {
      if (r.g === mapGu && POS.has(r.id) && visible(r)) VIS.add(r.id);
    });
    ["marks", "leaders"].forEach((id) =>
      $(id)
        .querySelectorAll("[data-id]")
        .forEach((el) => el.classList.toggle("off", !VIS.has(el.dataset.id))),
    );
    rescale();
    setGuCnt();
    drawLegend();
  }
  const dongOf = (r) => {
    const m = (r.bj || r.j || "").match(/^([가-힣]+?)(\d*)(동|가)(?=[\s\d-]|$)/);
    if (!m) return "";
    return m[3] === "가" ? m[1] : m[1] + "동";
  };
  function rescaleDots() {
    const u = ppu();
    for (const el of $("marks").children) {
      if (!el.classList.contains("mc")) continue;
      ((el) => {
        const a = el.dataset.a,
          f = el.classList.contains("sel") ? 1.4 : el === hovMk ? 1.25 : 1;
        el.setAttribute("r", (MK_R[a] * f) / u);
        el.style.strokeWidth = (el.classList.contains("cm") ? 3 : 1.5) / u + "px";
      })(el);
    }
  }
  function rescale() {
    if (mapView !== "gu") return;
    const u = ppu();
    rescaleDots();
    rescaleStns();
    $("leaders").style.strokeWidth = 1 / u + "px";
    const now = performance.now();
    if (!gest) {
      drawZoneLabels();
      labAt = now;
      labW = vb[2];
      mapbox.classList.remove("lab-off");
    } else if (Math.abs(vb[2] - labW) > 1e-6) mapbox.classList.add("lab-off");
    else moveLabels();
    placeRing();
    const k = zoomK();
    mapbox.classList.toggle("zoomed", k > 1.02);
    const zi = $("mzIn"),
      zo = $("mzOut"),
      zf = $("mzFit");
    if (zi) {
      zi.disabled = k >= MAXK - 0.02;
      zo.disabled = zf.disabled = k <= 1.02;
    }
  }
  let LABS = [],
    DLABS = [],
    labAt = 0,
    labW = 0;
  const TW = new Map();
  let twCtx = null;
  function textW(t, fs, wt) {
    const k = t + "|" + wt;
    let w = TW.get(k);
    if (w == null) {
      try {
        twCtx = twCtx || document.createElement("canvas").getContext("2d");
        twCtx.font = `${wt} 100px ${getComputedStyle(document.body).fontFamily}`;
        w = twCtx.measureText(t).width / 100;
      } catch (e) {
        w = [...t].reduce((a, ch) => a + (/[0-9]/.test(ch) ? 0.58 : /[가-힣]/.test(ch) ? 0.95 : ch === " " ? 0.28 : 0.55), 0);
      }
      TW.set(k, w);
    }
    return w * fs + 2;
  }
  document.fonts &&
    document.fonts.ready.then(() => {
      TW.clear();
      if (mapView === "gu") schedRescale();
    });
  function labWrap() {
    const u = ppu(),
      t = `translate(${vb[0]} ${vb[1]}) scale(${1 / u})`;
    ["dlw", "mlw"].forEach((id) => {
      const g = $(id);
      if (g) g.setAttribute("transform", t);
    });
  }
  function moveLabels() {
    const u = ppu();
    labWrap();
    [
      [$("mlab"), LABS],
      [$("dongl"), DLABS],
    ].forEach(([box, arr]) => {
      if (!box) return;
      const els = box.children;
      arr.forEach(([p, ox, oy], i) => {
        const el = els[i];
        if (!el) return;
        el.setAttribute("x", (p[0] - vb[0]) * u + ox);
        el.setAttribute("y", (p[1] - vb[1]) * u + oy);
      });
    });
  }
  function drawZoneLabels() {
    const L = $("mlab"),
      DL = $("dongl");
    if (!L) return;
    LABS = [];
    DLABS = [];
    labWrap();
    const u = ppu(),
      fs = 11.5,
      pad = 2,
      x0 = vb[0],
      y0 = vb[1],
      x1 = vb[0] + vb[2],
      y1 = vb[1] + vb[3];
    const boxes = [];
    {
      const sb = svg.getBoundingClientRect();
      ["mapBar", "mapZoom", "mpop"].forEach((id) => {
        const el = $(id);
        if (!el || el.hidden) return;
        const b = el.getBoundingClientRect();
        if (b.width) boxes.push([b.left - sb.left - 4, b.top - sb.top - 4, b.right - sb.left + 4, b.bottom - sb.top + 4, 9]);
      });
      const at = mapbox.querySelector(".map-attr");
      if (at) {
        const b = at.getBoundingClientRect();
        if (b.width) boxes.push([b.left - sb.left, b.top - sb.top - 2, b.right - sb.left, b.bottom - sb.top, 9]);
      }
    }
    const S = (p) => [(p[0] - x0) * u, (p[1] - y0) * u];
    const inV = (p) => p && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
    const vis = [...VIS].map((id) => [byId[id], POS.get(id)]).filter(([, p]) => inV(p));
    vis.forEach(([r, p]) => {
      const q = S(p),
        a = dotState(r),
        m = MK_R[a] + 1;
      boxes.push([q[0] - m, q[1] - m, q[0] + m, q[1] + m, a === "y" ? 2 : 1]);
    });
    const sv = showStn ? STN_VIS.filter((s) => inV(s.xy)) : [];
    sv.forEach((s) => {
      const q = S(s.xy),
        m = s.hub ? 7 : s.xfer ? 6 : 4.5;
      boxes.push([q[0] - m, q[1] - m, q[0] + m, q[1] + m, 1]);
    });
    const hit = (b, soft) => boxes.some((o) => (!soft || o[4] !== 1) && b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    const Wv = vb[2] * u,
      Hv = vb[3] * u;
    const out = (b) => b[0] < 2 || b[1] < 2 || b[2] > Wv - 2 || b[3] > Hv - 2;
    const k = zoomK();
    let html = "";
    const put = (p, m, w, f, passes, body) => {
      const q = S(p),
        v = f * 0.9;
      const C = [
        [m, 0, "s"],
        [-m, 0, "e"],
        [0, -m - f * 0.55, "m"],
        [0, m + f * 0.6, "m"],
        [m * 0.7, -v, "s"],
        [-m * 0.7, -v, "e"],
        [m * 0.7, v, "s"],
        [-m * 0.7, v, "e"],
      ];
      for (const soft of passes)
        for (const [dx, dy, anc] of C) {
          const lx = anc === "s" ? q[0] + dx : anc === "e" ? q[0] + dx - w : q[0] - w / 2,
            ly = q[1] + dy;
          const b = [lx - pad, ly - f * 0.62 - pad, lx + w + pad, ly + f * 0.5 + pad, 3];
          if (hit(b, soft) || out(b)) continue;
          boxes.push(b);
          LABS.push([p, lx - q[0], ly - q[1], f, 4.5]);
          html += body(lx, ly, f);
          return true;
        }
      return false;
    };
    const doneZ = new Set(),
      doneS = new Set();
    const labCnt = new Map();
    vis.forEach(([r]) => {
      const t = shortLabel(r);
      labCnt.set(t, (labCnt.get(t) || 0) + 1);
    });
    const labOf = (r) => {
      const t = shortLabel(r);
      if ((labCnt.get(t) || 0) < 2) return t;
      const j = (r.bj || r.j || "").replace(/\s+/g, " ").trim();
      return j && j !== t ? (j.length > 13 ? j.slice(0, 12) + "…" : j) : t;
    };
    const placedT = new Set();
    const zoneLab = ([r, p], sel) => {
      if (doneZ.has(r.id)) return;
      doneZ.add(r.id);
      const a = dotState(r),
        t = labOf(r);
      if (placedT.has(t) && !sel) return;
      const wt = a === "y" || sel ? 700 : 500;
      if (
        put(
          p,
          sel ? 18 : MK_R[a] + 3,
          textW(t, fs, wt),
          fs,
          a === "y" || sel ? [false, true] : [false],
          (x, y, f) =>
            `<text class="ml ${a}${sel ? " sel" : ""}" x="${x}" y="${y}" style="font-size:${f}px;stroke-width:4.5px">${esc(t)}</text>`,
        )
      )
        placedT.add(t);
    };
    const stnLab = (s, must) => {
      if (doneS.has(s)) return;
      doneS.add(s);
      const f = s.hub ? 11.5 : 11,
        tag = s.hub ? hubTag(s) : "",
        wt = s.hub ? 700 : 500;
      const w = textW(s.n, f, wt) + (tag ? textW(" " + tag, f * 0.82, 600) : 0);
      put(
        s.xy,
        s.hub ? 9 : s.xfer ? 8 : 6.5,
        w,
        f,
        must ? [false, true] : [false],
        (x, y, f2) =>
          `<text class="sl${s.hub ? " h" : ""}${s.hub && !s.hubOpen ? " p" : ""}" x="${x}" y="${y}" style="font-size:${f2}px;stroke-width:4.5px">${esc(s.n)}${tag ? `<tspan class="tg" dx=".3em">${esc(tag)}</tspan>` : ""}</text>`,
      );
    };
    const by = (a) => vis.filter(([r]) => dotState(r) === a);
    const selE = cur && vis.find(([r]) => r.id === cur.id);
    if (selE) {
      const q = S(selE[1]);
      boxes.push([q[0] - 16, q[1] - 16, q[0] + 16, q[1] + 16, 2]);
      zoneLab(selE, true);
    }
    sv.filter((s) => HJ_STN.has(s.n)).forEach((s) => stnLab(s, true));
    by("y").forEach((e) => zoneLab(e));
    sv.filter((s) => s.hub).forEach((s) => stnLab(s));
    sv.filter((s) => !s.hub)
      .sort((a, b) => b.ls.length - a.ls.length)
      .forEach((s) => stnLab(s));
    by("n").forEach((e) => zoneLab(e));
    if (k >= 1.6 || vis.length <= 25) by("u").forEach((e) => zoneLab(e));
    L.innerHTML = html;
    const dm = new Map();
    R.forEach((r) => {
      if (r.g !== mapGu || !r.xy) return;
      if (k >= 2 && !inV(r.xy)) return;
      const d = dongOf(r);
      if (!d) return;
      const o = dm.get(d) || dm.set(d, [0, 0, 0]).get(d);
      o[0] += r.xy[0];
      o[1] += r.xy[1];
      o[2]++;
    });
    let dh = "";
    const dfs = 12.5;
    [...dm.entries()]
      .sort((a, b) => b[1][2] - a[1][2])
      .forEach(([d, o]) => {
        const p = [o[0] / o[2], o[1] / o[2]];
        if (!inV(p)) return;
        const q = S(p),
          w = textW(d, dfs, 600);
        for (const [ox, oy] of [
          [0, 0],
          [0, -16],
          [0, 16],
          [0, -30],
          [0, 30],
          [-w * 0.6, 0],
          [w * 0.6, 0],
          [0, -44],
          [0, 44],
        ]) {
          const b = [q[0] + ox - w / 2 - 2, q[1] + oy - dfs * 0.6, q[0] + ox + w / 2 + 2, q[1] + oy + dfs * 0.55];
          if (hit(b) || out(b)) continue;
          boxes.push([...b, 3]);
          DLABS.push([p, ox, oy, dfs, 3]);
          dh += `<text class="dl${k >= 2 ? " on" : ""}" x="${q[0] + ox}" y="${q[1] + oy}" style="font-size:${dfs}px;stroke-width:3px">${esc(d)}</text>`;
          break;
        }
      });
    DL.innerHTML = dh;
  }
  const MAXK = 4;
  function clampVB(nv) {
    const B = BASEVB,
      w = Math.min(B[2], Math.max(B[2] / MAXK, nv[2])),
      h = (w * B[3]) / B[2],
      k = B[2] / w;
    const mx = B[2] * 0.06 * (1 - 1 / k),
      my = B[3] * 0.06 * (1 - 1 / k);
    let cx = nv[0] + nv[2] / 2,
      cy = nv[1] + nv[3] / 2;
    cx = Math.min(B[0] + B[2] + mx - w / 2, Math.max(B[0] - mx + w / 2, cx));
    cy = Math.min(B[1] + B[3] + my - h / 2, Math.max(B[1] - my + h / 2, cy));
    return [cx - w / 2, cy - h / 2, w, h];
  }
  function setVB(nv, raw) {
    if (!BASEVB) return;
    vb = raw ? nv.slice() : clampVB(nv);
    svg.setAttribute("viewBox", vb.join(" "));
    schedRescale();
  }
  let rsT = 0;
  const schedRescale = () => {
    if (rsT) return;
    rsT = requestAnimationFrame(() => {
      rsT = 0;
      rescale();
    });
  };
  let gest = false,
    gestT = 0;
  const gestOn = () => {
    gest = true;
    clearTimeout(gestT);
  };
  let labIdle = 0;
  const gestOff = (ms = 140) => {
    clearTimeout(gestT);
    gestT = setTimeout(() => {
      gest = false;
      cancelIdle(labIdle);
      labIdle = window.requestIdleCallback
        ? requestIdleCallback(
            () => {
              labIdle = 0;
              schedRescale();
            },
            { timeout: 180 },
          )
        : setTimeout(schedRescale, 60);
    }, ms);
  };
  function zoomVB(f, px, py, from = vb) {
    const W = svg.clientWidth || 700,
      H = svg.clientHeight || 580,
      sx = px / W,
      sy = py / H;
    const gx = from[0] + sx * from[2],
      gy = from[1] + sy * from[3];
    const w = Math.min(BASEVB[2], Math.max(BASEVB[2] / MAXK, from[2] / f)),
      h = (w * from[3]) / from[2];
    return [gx - sx * w, gy - sy * h, w, h];
  }
  function zoomAt(f, px, py) {
    setVB(zoomVB(f, px, py));
  }
  let zAnim = 0,
    zTo = null;
  function animTo(target, dur = 250) {
    if (!BASEVB) return;
    const to = clampVB(target),
      from = vb.slice();
    zTo = to;
    cancelAnimationFrame(zAnim);
    zAnim = 0;
    if (reduceMotion() || !dur) {
      setVB(to);
      gestOff(0);
      return;
    }
    const dw = from[2] - to[2],
      fx = Math.abs(dw) > 1e-9,
      t0 = performance.now();
    const P = fx ? [(to[0] * from[2] - from[0] * to[2]) / dw, (to[1] * from[2] - from[1] * to[2]) / dw] : null;
    const s = fx ? [(P[0] - from[0]) / from[2], (P[1] - from[1]) / from[3]] : null;
    gestOn();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur),
        e = 1 - Math.pow(1 - t, 3);
      let v;
      if (fx) {
        const w = from[2] * Math.pow(to[2] / from[2], e),
          h = (w * from[3]) / from[2];
        v = [P[0] - s[0] * w, P[1] - s[1] * h, w, h];
      } else v = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2], from[3]];
      if (t >= 1) v = to;
      vb = v;
      svg.setAttribute("viewBox", vb.join(" "));
      rescale();
      if (t < 1) zAnim = requestAnimationFrame(step);
      else {
        zAnim = 0;
        gestOff(0);
      }
    };
    zAnim = requestAnimationFrame(step);
  }
  const mzC = () => {
    const W = svg.clientWidth || 700,
      H = svg.clientHeight || 580,
      c = [W / 2, H / 2],
      u = ppu();
    const pts = [...VIS]
      .map((id) => [POS.get(id), dotState(byId[id])])
      .filter(([p]) => p)
      .map(([p, a]) => [(p[0] - vb[0]) * u, (p[1] - vb[1]) * u, a === "y" ? 3 : 1])
      .filter(([x, y]) => x >= 0 && y >= 0 && x <= W && y <= H);
    if (!pts.length || pts.some(([x, y]) => Math.hypot(x - c[0], y - c[1]) < 120)) return c;
    const w = pts.reduce((a, q) => a + q[2], 0);
    return [pts.reduce((a, q) => a + q[0] * q[2], 0) / w, pts.reduce((a, q) => a + q[1] * q[2], 0) / w];
  };
  const mzInVB = () => {
    const from = zAnim && zTo ? zTo : vb,
      W = svg.clientWidth || 700,
      H = svg.clientHeight || 580;
    const w = Math.min(BASEVB[2], Math.max(BASEVB[2] / MAXK, from[2] / 2)),
      h = (w * from[3]) / from[2];
    const pts = [...VIS]
      .map((id) => [POS.get(id), dotState(byId[id])])
      .filter(([p]) => p && p[0] >= from[0] && p[1] >= from[1] && p[0] <= from[0] + from[2] && p[1] <= from[1] + from[3])
      .map(([p, a]) => [p[0], p[1], a === "y" ? 3 : 1]);
    const score = (cx, cy) => {
      const v = clampVB([cx - w / 2, cy - h / 2, w, h]),
        m = w * 0.06;
      return pts.reduce((a, q) => a + (q[0] >= v[0] + m && q[0] <= v[0] + w - m && q[1] >= v[1] + m && q[1] <= v[1] + h - m ? q[2] : 0), 0);
    };
    const c0 = [from[0] + from[2] / 2, from[1] + from[3] / 2],
      s0 = score(...c0);
    let best = c0,
      bs = s0;
    pts.forEach((q) => {
      const sc = score(q[0], q[1]);
      if (sc > bs) {
        bs = sc;
        best = [q[0], q[1]];
      }
    });
    if (bs && s0 >= bs * 0.6) best = c0;
    else if (bs) {
      const inn = pts.filter((q) => Math.abs(q[0] - best[0]) <= w * 0.44 && Math.abs(q[1] - best[1]) <= h * 0.44),
        t = inn.reduce((a, q) => a + q[2], 0);
      if (t) best = [inn.reduce((a, q) => a + q[0] * q[2], 0) / t, inn.reduce((a, q) => a + q[1] * q[2], 0) / t];
    }
    return [best[0] - w / 2, best[1] - h / 2, w, h];
  };
  $("mzIn").onclick = () => {
    if (LMX.on()) return LMX.zoom(1);
    if (mapView === "gu" && BASEVB) animTo(mzInVB());
  };
  $("mzOut").onclick = () => {
    if (LMX.on()) return LMX.zoom(-1);
    if (mapView === "gu" && BASEVB) animTo(zoomVB(0.5, ...mzC(), zAnim && zTo ? zTo : vb));
  };
  $("mzFit").onclick = () => {
    if (LMX.on()) return LMX.zoom(0);
    if (mapView === "gu" && BASEVB) animTo(BASEVB.slice(), 300);
  };
  svg.addEventListener(
    "wheel",
    (e) => {
      if (mapView !== "gu" || vbAnim || !BASEVB) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      if (dy > 0 && zoomK() <= 1.001) return;
      e.preventDefault();
      if (zAnim) {
        cancelAnimationFrame(zAnim);
        zAnim = 0;
      }
      gestOn();
      const b = svg.getBoundingClientRect();
      zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX - b.left, e.clientY - b.top);
      gestOff(160);
    },
    { passive: false },
  );
  const PTR = new Map();
  let pan = null,
    dragged = false,
    lastTap = null,
    tapZoomAt = 0,
    tapStart = null;
  const pinchStart = () => {
    const [a, b] = [...PTR.values()];
    pan = { pinch: true, d0: Math.hypot(a[0] - b[0], a[1] - b[1]), vb0: vb.slice(), c0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  };
  svg.addEventListener("pointerdown", (e) => {
    if (mapView !== "gu" || vbAnim || !BASEVB) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    PTR.set(e.pointerId, [e.clientX, e.clientY]);
    if (zAnim) {
      cancelAnimationFrame(zAnim);
      zAnim = 0;
    }
    if (PTR.size === 1) {
      dragged = false;
      tapStart = e.pointerType === "touch" ? { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } : null;
    } else tapStart = null;
    if (PTR.size === 2) {
      pinchStart();
      gestOn();
    } else if (PTR.size === 1 && (e.pointerType !== "touch" || zoomK() > 1.02)) pan = { x: e.clientX, y: e.clientY, vb0: vb.slice() };
    if (pan) {
      try {
        svg.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!pan || !PTR.has(e.pointerId)) return;
    PTR.set(e.pointerId, [e.clientX, e.clientY]);
    const bx = svg.getBoundingClientRect(),
      u0 = bx.width / pan.vb0[2];
    if (pan.pinch) {
      if (PTR.size < 2) return;
      const [a, b] = [...PTR.values()],
        d = Math.hypot(a[0] - b[0], a[1] - b[1]),
        c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const f = d / Math.max(10, pan.d0),
        w = Math.min(BASEVB[2], Math.max(BASEVB[2] / MAXK, pan.vb0[2] / f)),
        h = (w * pan.vb0[3]) / pan.vb0[2];
      const sx = (pan.c0[0] - bx.left) / bx.width,
        sy = (pan.c0[1] - bx.top) / bx.height;
      const gx = pan.vb0[0] + sx * pan.vb0[2],
        gy = pan.vb0[1] + sy * pan.vb0[3];
      const sx2 = (c[0] - bx.left) / bx.width,
        sy2 = (c[1] - bx.top) / bx.height;
      setVB([gx - sx2 * w, gy - sy2 * h, w, h]);
      dragged = true;
      return;
    }
    const dx = e.clientX - pan.x,
      dy = e.clientY - pan.y;
    if (!dragged && Math.hypot(dx, dy) < 5) return;
    if (!dragged) gestOn();
    dragged = true;
    mapbox.classList.add("dragging");
    setVB([pan.vb0[0] - dx / u0, pan.vb0[1] - dy / u0, pan.vb0[2], pan.vb0[3]]);
  });
  const endPtr = (e) => {
    if (!PTR.has(e.pointerId)) return;
    PTR.delete(e.pointerId);
    if (pan && pan.pinch && PTR.size === 1) {
      const [p] = [...PTR.values()];
      pan = zoomK() > 1.02 ? { x: p[0], y: p[1], vb0: vb.slice() } : null;
    }
    if (!PTR.size) {
      if (pan || dragged) gestOff(0);
      pan = null;
      mapbox.classList.remove("dragging");
      const ts = tapStart;
      tapStart = null;
      if (
        e.type === "pointerup" &&
        e.pointerType === "touch" &&
        ts &&
        ts.id === e.pointerId &&
        Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 8 &&
        performance.now() - ts.t < 300 &&
        mapView === "gu" &&
        nearestDot(e, HIT_R())
      ) {
        dragged = false;
        touchTapAt = performance.now();
        lastTap = null;
        mapTap(e);
        return;
      }
      if (e.type === "pointerup" && e.pointerType === "touch" && !dragged && mapView === "gu") {
        const now = performance.now();
        if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
          lastTap = null;
          tapZoomAt = now;
          const b = svg.getBoundingClientRect();
          animTo(zoomVB(2, e.clientX - b.left, e.clientY - b.top));
        } else lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
    }
  };
  svg.addEventListener("pointerup", endPtr);
  svg.addEventListener("pointercancel", endPtr);
  svg.addEventListener("dblclick", (e) => {
    if (mapView !== "gu" || !BASEVB || vbAnim || performance.now() - tapZoomAt < 600) return;
    e.preventDefault();
    const b = svg.getBoundingClientRect();
    animTo(zoomVB(e.shiftKey ? 0.5 : 2, e.clientX - b.left, e.clientY - b.top));
  });
  const tBlock = (e) => {
    if (mapView === "gu" && (e.touches.length > 1 || zoomK() > 1.02)) e.preventDefault();
  };
  svg.addEventListener("touchstart", tBlock, { passive: false });
  svg.addEventListener("touchmove", tBlock, { passive: false });
  const onIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 200 }) : setTimeout(fn, 16));
  const cancelIdle = (h) => {
    if (!h) return;
    if (window.cancelIdleCallback) cancelIdleCallback(h);
    else clearTimeout(h);
  };
  let vbAnim = null;
  function animateVB(to, done) {
    const AR = svgAR();
    let from = vb.slice();
    if (Math.abs(from[2] / from[3] - AR) > 0.001) {
      const cx = from[0] + from[2] / 2,
        cy = from[1] + from[3] / 2;
      let w = from[2],
        h = from[3];
      if (w / h < AR) w = h * AR;
      else h = w / AR;
      from = [cx - w / 2, cy - h / 2, w, h];
      vb = from.slice();
      svg.setAttribute("viewBox", vb.join(" "));
    }
    if (Math.abs(to[2] / to[3] - AR) > 0.001) {
      const cx = to[0] + to[2] / 2,
        cy = to[1] + to[3] / 2;
      let w = to[2],
        h = to[3];
      if (w / h < AR) w = h * AR;
      else h = w / AR;
      to = [cx - w / 2, cy - h / 2, w, h];
    }
    const world = $("world"),
      dur = reduceMotion() ? 0 : 380;
    if (vbAnim) {
      vbAnim.cancel();
      vbAnim = null;
    }
    const finish = () => {
      vb = to.slice();
      svg.setAttribute("viewBox", vb.join(" "));
      if (world) world.style.transform = "";
      vbAnim = null;
      drawGuLabels();
      paintDots();
      mapbox.classList.add("mk-in");
      if (done) done();
    };
    mapbox.classList.remove("mk-in");
    if (!dur || !world || !world.animate) {
      finish();
      return;
    }
    ["marks", "rings", "leaders", "hits", "stns", "stnl", "guLabels"].forEach((id) => {
      if ($(id)) $(id).innerHTML = "";
    });
    const s = from[2] / to[2],
      tx = from[0] - to[0] * s,
      ty = from[1] - to[1] * s;
    vbAnim = world.animate([{ transform: "translate(0px,0px) scale(1)" }, { transform: `translate(${tx}px,${ty}px) scale(${s})` }], {
      duration: dur,
      easing: "cubic-bezier(.45,0,.55,1)",
      fill: "forwards",
    });
    vbAnim.onfinish = () => {
      vbAnim && vbAnim.cancel();
      vbAnim = null;
      finish();
    };
  }
  let rzT = null;
  window.addEventListener("resize", () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      svgW = 0;
      drawGuLabels();
      paintDots();
      refreshFades();
      if (LADDER_ARGS) drawLadder(...LADDER_ARGS);
    }, 150);
  });
  function svgAR() {
    const w = svg.clientWidth,
      h = svg.clientHeight;
    return w && h ? w / h : VB0[2] / VB0[3];
  }
  function guBox(n) {
    const g = GU.get(n);
    if (!g) return null;
    const [, , cx, cy, bw, bh] = g;
    const AR = svgAR(),
      W = svg.clientWidth || svgW || 700,
      gb = [cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2];
    const topBar = MQ_SHEET.matches ? 0 : 60;
    const pts = R.filter((r) => r.g === n && r.xy && visible(r)).map((r) => r.xy);
    let b = [gb[0] - bw * 0.04, gb[1] - bh * 0.04, gb[2] + bw * 0.04, gb[3] + bh * 0.04],
      useM = false,
      mb;
    if (pts.length) {
      mb = [
        Math.min(...pts.map((p) => p[0])),
        Math.min(...pts.map((p) => p[1])),
        Math.max(...pts.map((p) => p[0])),
        Math.max(...pts.map((p) => p[1])),
      ];
      useM = (mb[2] - mb[0]) * (mb[3] - mb[1]) < 0.6 * bw * bh;
    }
    const fit = (box, mt, mb2, ms) => {
      let w = Math.max(box[2] - box[0], (box[3] - box[1]) * AR, 120);
      for (let k = 0; k < 3; k++) {
        const q = w / W;
        w = Math.max(box[2] - box[0] + 2 * ms * q, (box[3] - box[1] + (mt + mb2) * q) * AR, 120);
      }
      return w;
    };
    let w, top, bot;
    if (useM) {
      w = fit(mb, 40 + topBar, 48, 40);
      const q = w / W;
      const bb = [
        Math.max(gb[0], mb[0] - 40 * q),
        Math.max(gb[1], mb[1] - 40 * q),
        Math.min(gb[2], mb[2] + 40 * q),
        Math.min(gb[3], mb[3] + 48 * q),
      ];
      w = fit(bb, topBar, 0, 0);
      const q2 = w / W;
      top = bb[1] - topBar * q2;
      bot = bb[3];
      const h = w / AR,
        mid = (top + bot) / 2,
        bcx = (bb[0] + bb[2]) / 2;
      return [bcx - w / 2, Math.min(top, mid - h / 2), w, h];
    }
    w = fit(b, topBar, 0, 0);
    const q = w / W;
    top = b[1] - topBar * q;
    bot = b[3];
    const h = w / AR,
      mid = (top + bot) / 2,
      bcx = (b[0] + b[2]) / 2;
    return [bcx - w / 2, Math.min(top, mid - h / 2), w, h];
  }
  function zoomGu(n) {
    enterGu(n, {});
  }
  function enterGu(n, opts = {}) {
    if (!GU.has(n)) return;
    if (!mapReady) {
      pendingGu = n;
      pendingGuOpts = opts;
      return;
    }
    const from = mapView;
    setHoverGu(null);
    mapGu = n;
    mapView = "gu";
    mapbox.dataset.view = "gu";
    mapbox.dataset.gu = n;
    $("legend").dataset.view = "gu";
    svg.querySelectorAll("#guFill .gu").forEach((p) => {
      p.classList.toggle("sel", p.dataset.gu === n);
      p.setAttribute("tabindex", "-1");
    });
    svg.querySelectorAll("#guLine .gl").forEach((p) => p.classList.toggle("sel", p.dataset.gu === n));
    const o = GU_STAT.get(n) || { aff: 0, prog: 0 };
    $("mapBar").hidden = false;
    $("mapGuName").textContent = n;
    setGuCnt();
    if (opts.hist) {
      try {
        if (history.state && history.state.gu) history.replaceState({ gu: n }, "", urlWith("map-" + n));
        else history.pushState({ gu: n }, "", urlWith("map-" + n));
      } catch (e) {}
      guHist = true;
    }
    tip.hidden = true;
    if (opts.scroll) {
      const mb = $("mapbox").getBoundingClientRect();
      if (mb.top < HDR() || mb.bottom > innerHeight) window.scrollTo({ top: mb.top + window.scrollY - HDR() - 16, behavior: smooth() });
    }
    animateVB(guBox(n), () => {
      if (opts.focusBack) $("mapBack").focus({ preventScroll: true });
    });
    LMX.enter(n);
    if (from !== "gu") drawLegend();
    setMapSub();
    if (!opts.keepReport) renderGuPanel();
    else renderGuPanel(true);
  }
  let REP_HOME = null,
    GLBOX_HOME = null;
  function guZonesHTML(g) {
    const zs = R.filter((r) => r.g === g && r.xy && !isDone(r)),
      b = effBasis(),
      lab = b === "total" ? "입주까지" : "지금 매수";
    const grp = { y: [], n: [], e: [], u: [], x: [] };
    zs.forEach((r) => grp[dotState(r)].push(r));
    const needOf = (r) => {
      if (r.src === "moa") return null;
      const x = investC(r);
      return b === "total" ? (x.ok ? x.needTotal : null) : x.needBuy;
    };
    const LAB = {
      y: P.fund === "gap" ? `전세 끼고 지금 ${e2(CASH)}억으로 가능` : `내 현금으로 ${b === "total" ? "입주" : "지금 매수"} 가능`,
      n: "현금 부족",
      e: "구 평균 시세로 추정 (곳 수 제외)",
      u: "거래 적어 계산 보류",
      x: "계산 제외",
    };
    const why = (r) => {
      if (r.src === "moa") return "관리지역 · 블록별 계산";
      const w = buyWindow(r);
      if (w.cls === "no") return "입주권 없음";
      if (w.cls === "chk") return w.t;
      if (P.fund === "gap") {
        const g = gapOf(r);
        if (g.block) return g.block.split(" · ")[0];
      }
      return noPriceTxt(r);
    };
    const row = (r, k) => {
      const nd = k === "u" || k === "x" ? null : needOf(r);
      return `<li><button type="button" class="gz-row" data-zid="${r.id}"><span class="gz-n">${esc(shortName(r.n))}<small>${esc([dongOf(r), SHAPE[shapeOf(r)], r.src === "moa" ? "관리계획" : stageName(r)].filter(Boolean).join(" · "))}</small></span><span class="gz-v ${k}">${k === "u" || k === "x" ? esc(why(r)) : nd == null ? "–" : k === "n" ? `${e2(nd - CASH)}억 부족` : `${lab} ${e2(nd)}억`}</span></button></li>`;
    };
    const sorter = (a, c) => (needOf(a) ?? 999) - (needOf(c) ?? 999);
    return `<h3 class="gl-h">${esc(g)} 구역 ${fmt(zs.length)}곳</h3><p class="gl-cap">지도와 같은 묶음 · 행을 누르면 구역 리포트</p>${[
      "y",
      "n",
      "e",
      "u",
      "x",
    ]
      .filter((k) => grp[k].length)
      .map(
        (k) =>
          `<div class="gz-g"><h4><i class="gz-d ${k}" aria-hidden="true"></i>${LAB[k]} <b>${grp[k].length}곳</b></h4><ol class="gu-list">${grp[
            k
          ]
            .sort(sorter)
            .map((r) => row(r, k))
            .join("")}</ol></div>`,
      )
      .join("")}`;
  }
  function renderGuPanel(mobileOnly) {
    if (mapView !== "gu" || !mapGu) return;
    const html = guZonesHTML(mapGu);
    const box = $("guListBox");
    if (box) {
      if (GLBOX_HOME == null) GLBOX_HOME = box.innerHTML;
      box.innerHTML = html;
      box.dataset.gu = mapGu;
    }
    if (mobileOnly || MQ_SHEET.matches) return;
    const rp = $("report");
    if (REP_HOME == null) REP_HOME = rp.innerHTML;
    rp.innerHTML = `<div class="rep-empty gu-zones">${html}</div>`;
  }
  function restoreSeoulPanels() {
    const box = $("guListBox");
    if (box && GLBOX_HOME != null && box.dataset.gu) {
      box.innerHTML = GLBOX_HOME;
      delete box.dataset.gu;
    }
    const rp = $("report");
    if (rp.querySelector(".gu-zones") && REP_HOME != null) rp.innerHTML = REP_HOME;
    drawGuList();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".gz-row");
    if (!b) return;
    curTab = "money";
    select(b.dataset.zid, false, false, { from: b, scroll: !MQ_SHEET.matches });
  });
  function setGuCnt() {
    if (!mapGu) return;
    const o = GU_STAT.get(mapGu) || { aff: 0 };
    const vis = R.filter((r) => r.g === mapGu && r.xy && visible(r)),
      dn = vis.filter(isDone).length;
    const now = effBasis() === "now" && P.basis === "total";
    $("mapGuCnt").textContent =
      `${mapAff ? (now ? `지금 매수 ${fmt(o.now)}곳 (입주까지 ${fmt(o.aff)}) · ` : `가능 ${fmt(o.aff)}곳 · `) : ""}지도 ${fmt(vis.length - dn)}곳${dn ? ` + 완료 ${fmt(dn)}곳` : ""}`;
  }
  function exitGu(opts = {}) {
    if (mapView !== "gu") return;
    const prev = mapGu;
    mapView = "seoul";
    mapGu = null;
    guHist = false;
    HJHL = null;
    mapbox.dataset.view = "seoul";
    mapbox.dataset.gu = "";
    $("legend").dataset.view = "seoul";
    BASEGU = null;
    BASEVB = null;
    svg.querySelectorAll("#guFill .gu").forEach((p) => {
      p.classList.remove("sel");
      p.setAttribute("tabindex", "0");
    });
    svg.querySelectorAll("#guLine .gl").forEach((p) => p.classList.remove("sel"));
    $("mapBar").hidden = true;
    tip.hidden = true;
    if ($("mpop")) $("mpop").hidden = true;
    POS.clear();
    LMX.exit();
    restoreSeoulPanels();
    animateVB(VB0.slice(), () => {
      if (opts.focus) {
        const p = svg.querySelector(`#guFill .gu[data-gu="${prev}"]`);
        if (p) p.focus({ preventScroll: true });
      }
    });
    drawLegend();
    setMapSub();
  }
  function backToSeoul(focus) {
    if (history.state && history.state.gu) {
      mapFocusBack = focus;
      history.back();
    } else exitGu({ focus });
  }
  let mapFocusBack = false;
  $("mapBack").onclick = () => backToSeoul(true);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || mapView !== "gu") return;
    if ($("report").classList.contains("sheet") || $("hdr").classList.contains("searching")) return;
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest("input,select,textarea,.sugg")) return;
    backToSeoul(true);
  });
  const coarse = () => matchMedia("(pointer:coarse)").matches || MQ_SHEET.matches;
  function svgPt(e) {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }
  function nearestDot(e, radPx) {
    if (mapView !== "gu" || !POS.size) return null;
    const p = svgPt(e);
    if (!p) return null;
    const u = ppu(),
      lim = radPx / u;
    let best = null,
      bd = lim * lim;
    POS.forEach((q, id) => {
      if (!VIS.has(id)) return;
      const dx = q[0] - p[0],
        dy = q[1] - p[1],
        d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = byId[id];
      }
    });
    return best;
  }
  const guAt = (e) => {
    const el = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList && x.classList.contains("gu"));
    return el ? el.dataset.gu : null;
  };
  const HIT_R = () => (coarse() ? 24 : 16);
  let touchTapAt = 0;
  svg.addEventListener("click", (e) => {
    if (vbAnim) return;
    if (performance.now() - touchTapAt < 600) return;
    if (dragged) {
      dragged = false;
      return;
    }
    mapTap(e);
  });
  function mapTap(e) {
    if (mapView === "seoul") {
      const g = guAt(e);
      if (g) enterGu(g, { hist: true });
      return;
    }
    const d = nearestDot(e, HIT_R());
    if (d) {
      tip.hidden = true;
      const rt = $("report").getBoundingClientRect().top;
      select(d.id, false, false, {
        from: $("marks").querySelector(`.mc[data-id="${d.id}"]`),
        scroll: !MQ_SHEET.matches && (rt < HDR() - 4 || rt > innerHeight * 0.5),
      });
      ringPulse();
      return;
    }
    const g = guAt(e);
    if (g && g !== mapGu) enterGu(g, { hist: true });
  }
  const tip = $("tip");
  svg.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || vbAnim) return;
    const box = $("mapbox").getBoundingClientRect();
    const place = () => {
      tip.style.left = e.clientX - box.left + "px";
      tip.style.top = e.clientY - box.top + "px";
      tip.hidden = false;
    };
    if (mapView === "seoul") {
      const g = guAt(e);
      setHoverGu(g);
      if (!g) {
        tip.hidden = true;
        return;
      }
      tip.innerHTML = guTipHTML(g);
      place();
      return;
    }
    const r = nearestDot(e, HIT_R());
    const hEl = r ? $("marks").querySelector(`.mc[data-id="${r.id}"]`) : null;
    if (hovMk !== hEl) {
      hovMk = hEl;
      rescaleDots();
    }
    if (!r) {
      tip.hidden = true;
      svg.style.cursor = "";
      return;
    }
    svg.style.cursor = "pointer";
    tip.innerHTML = dotTipHTML(r);
    place();
  });
  svg.addEventListener("pointerleave", () => {
    tip.hidden = true;
    if (hovMk) {
      hovMk = null;
      rescaleDots();
    }
    setHoverGu(null);
  });
  function zoneLines(r) {
    const a = dotState(r),
      w = buyWindow(r),
      b = effBasis(),
      x = r.src === "moa" ? null : investC(r);
    const need = x ? (b === "total" ? (x.ok ? x.needTotal : null) : x.needBuy) : null,
      lab = b === "total" ? "입주까지 필요한 현금" : "지금 매수에 필요한 현금";
    const l3 =
      r.src === "moa"
        ? "관리지역 · 블록별 조합에서 계산"
        : w.cls === "no" || w.cls === "chk"
          ? [w.t, w.due].filter(Boolean).join(" · ")
          : isEst(r) && !P.est
            ? "구 평균 시세로 추정 · 곳 수에서 제외"
            : need == null
              ? "매수가 추정 불가 · 주변 빌라 거래가 적어요"
              : a === "y"
                ? `${lab} ${e2(need)}억`
                : `현금 ${e2(need - CASH)}억 부족 (${b === "total" ? "입주까지" : "지금 매수"} ${e2(need)}억)`;
    return {
      a,
      l2: [dongOf(r), SHAPE[shapeOf(r)], r.src === "moa" ? "관리계획" : stageName(r)].filter(Boolean).join(" · "),
      l3,
      l4: nearTxt(r),
      hj: nearHojae(r).length,
    };
  }
  function dotTipHTML(r) {
    const z = zoneLines(r);
    return `<b>${esc(shortName(r.n))}</b><small>${esc(z.l2)}</small><small class="tt-3 ${z.a}">${esc(z.l3)}</small>${z.l4 ? `<small class="tt-4">${esc(z.l4)}</small>` : ""}${z.hj ? `<small class="tt-4">1.5km 안 주변 호재 ${z.hj}건 · 누르면 리포트</small>` : ""}`;
  }
  function guTipHTML(g) {
    const o = GU_STAT.get(g) || { aff: 0, now: 0, prog: 0, st: [0, 0, 0, 0, 0, 0, 0] },
      md = modeOf(),
      v = guMetric(g);
    const lab =
      md === "prog"
        ? "진행 중 구역"
        : P.fund === "gap"
          ? `전세 끼고 ${e2(CASH)}억으로 지금 계약`
          : md === "now"
            ? `내 현금 ${e2(CASH)}억으로 지금 매수`
            : `내 현금 ${e2(CASH)}억으로 ${P.basis === "total" ? "입주까지" : "지금 매수"}`;
    return `<b>${esc(g)}</b><span class="tt-v">${lab} <strong>${fmt(v)}곳</strong></span><small>지도 ${fmt(o.prog)}곳 · 단계 구성</small>${stBar(o.st, 180)}<small class="tt-go">누르면 확대</small>`;
  }
  let hovGu = null;
  function setHoverGu(g) {
    if (mapView !== "seoul") g = null;
    if (hovGu === g) return;
    hovGu = g;
    const L = $("guLift");
    if (!L) return;
    const cur = $("mlCur");
    if (!g) {
      L.innerHTML = "";
      if (cur) cur.hidden = true;
      box0();
      return;
    }
    const p = svg.querySelector(`#guFill .gu[data-gu="${g}"]`);
    if (!p) return;
    const u = ppu();
    L.innerHTML = `<path class="lift" d="${p.getAttribute("d")}" style="${p.getAttribute("style") || ""};transform:translate(0px,${(-2.5 / u).toFixed(2)}px)" vector-effect="non-scaling-stroke"/>`;
    box0(g);
    const v = guMetric(g),
      t = tOf(v);
    if (cur) {
      cur.hidden = false;
      cur.style.left = t < 0 ? "" : (t * 100).toFixed(1) + "%";
      cur.classList.toggle("z", t < 0);
      cur.textContent = fmt(v);
    }
  }
  function box0(g) {
    document.querySelectorAll("#guLabels .glab.up").forEach((x) => x.classList.remove("up"));
    if (g) {
      const l = document.querySelector(`#guLabels .glab[data-gu="${g}"]:not(.out)`);
      if (l) {
        l.classList.add("up");
        l.style.setProperty("--lift", (-2.5 / ppu()).toFixed(2) + "px");
      }
    }
  }
  document.addEventListener("pointerover", (e) => {
    const b = e.target.closest && e.target.closest(".gl-row");
    if (b) setHoverGu(b.dataset.gu);
  });
  document.addEventListener("pointerout", (e) => {
    const b = e.target.closest && e.target.closest(".gl-row");
    if (b && !b.contains(e.relatedTarget)) setHoverGu(null);
  });
  svg.addEventListener("focusin", (e) => {
    const p = e.target.closest && e.target.closest(".gu");
    if (p) setHoverGu(p.dataset.gu);
  });
  svg.addEventListener("focusout", () => setHoverGu(null));
  const UNIT_PER_M = 2272.72439 / (111320 * Math.cos((37.55 * Math.PI) / 180));
  let HJHL = null;
  function placeRing() {
    const ring = $("ring"),
      ring2 = $("ring2"),
      rg = $("range");
    if (!ring) return;
    {
      const h = $("hjRing");
      if (h) {
        if (HJHL && mapView === "gu") {
          const u = ppu();
          h.setAttribute("cx", HJHL.xy[0]);
          h.setAttribute("cy", HJHL.xy[1]);
          h.setAttribute("r", 15 / u);
          h.style.stroke = HJHL.c;
          h.style.strokeWidth = 4 / u + "px";
        } else h.setAttribute("r", 0);
      }
    }
    const p = cur && POS.get(cur.id);
    const rl = $("rangeL");
    if (!cur || !cur.xy || mapView !== "gu" || !p) {
      ring.setAttribute("r", 0);
      ring2.setAttribute("r", 0);
      rg.setAttribute("r", 0);
      rl.setAttribute("x", -99);
      return;
    }
    const u = ppu();
    ring.setAttribute("cx", p[0]);
    ring.setAttribute("cy", p[1]);
    ring.setAttribute("r", 13 / u);
    ring.style.strokeWidth = 3 / u + "px";
    ring2.setAttribute("cx", p[0]);
    ring2.setAttribute("cy", p[1]);
    ring2.setAttribute("r", 11 / u);
    ring2.style.strokeWidth = 1.5 / u + "px";
    if (cur.src === "moa" && cur.sm?.area) {
      rg.setAttribute("cx", cur.xy[0]);
      rg.setAttribute("cy", cur.xy[1]);
      rg.setAttribute("r", Math.sqrt(cur.sm.area / Math.PI) * UNIT_PER_M);
      rg.style.strokeWidth = 1.5 / u + "px";
      rg.style.strokeDasharray = `${4 / u} ${3 / u}`;
      const R0 = Math.sqrt(cur.sm.area / Math.PI) * UNIT_PER_M;
      rl.setAttribute("x", cur.xy[0]);
      rl.setAttribute("y", cur.xy[1] + R0 + 14 / u);
      rl.style.fontSize = 11 / u + "px";
      rl.style.strokeWidth = 4 / u + "px";
    } else {
      rg.setAttribute("r", 0);
      rl.setAttribute("x", -99);
    }
  }
  const SHAPE_ICON = (sh) =>
    `<svg class="shp" width="14" height="14" viewBox="-8 -8 16 16" aria-hidden="true"><use href="#mk-${sh}"/></svg>`;
  const KF = (cls) =>
    `<svg class="shp" width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true">${cls === "y" ? '<circle r="7.6" class="kf yr"/><circle r="6.2" class="kf y"/>' : cls === "u" ? '<circle r="5.5" class="kf u"/>' : cls === "x" ? '<circle r="5.5" class="kf x"/>' : cls === "d" ? '<circle r="5.5" class="kf d"/>' : '<circle r="5.5" class="kf n"/>'}</svg>`;
  const STN_KEY = `<span class="sk"><svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><circle r="3.5" class="k-s1"/></svg>지하철역</span><span class="sk"><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><circle r="5.2" class="k-s2"/><circle r="2.9" class="k-s1"/></svg>환승역</span><span class="sk"><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><rect x="-6" y="-6" width="12" height="12" rx="3" class="k-hb"/><circle r="2.2" class="k-hbc"/></svg>KTX·SRT·GTX</span><span class="sk"><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><rect x="-6" y="-6" width="12" height="12" rx="3" class="k-hp"/><circle r="2" class="k-hpc"/></svg>GTX 예정역</span><span class="sk ln"><i aria-hidden="true"></i>선 색 = 노선</span>`;
  const HUB_KEY = `<span class="sk"><svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><rect x="-4.5" y="-4.5" width="9" height="9" rx="2.2" class="k-hb"/><circle r="1.6" class="k-hbc"/></svg>KTX·SRT·GTX역</span><span class="sk"><svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><rect x="-4.5" y="-4.5" width="9" height="9" rx="2.2" class="k-hp"/><circle r="1.5" class="k-hpc"/></svg>GTX 예정역</span><span class="sk dim">구를 누르면 지하철역까지 보여요</span>`;
  let legMore = false;
  let stkOpen = false;
  function drawLegend() {
    keepFocus(() => {
      const el = $("legend");
      if (!el) return;
      const sw = `<button type="button" class="mswitch" data-maff aria-pressed="${mapAff}"><span class="sw" aria-hidden="true"></span>내 현금</button>`;
      el.classList.toggle("stk-open", stkOpen);
      const stkChip = showStn
        ? `<button type="button" class="stkchip" data-stk aria-expanded="${stkOpen}" aria-controls="mlStk">역 기호</button>`
        : "";
      const stnChip = `<button type="button" class="stchip" data-stn aria-pressed="${showStn}"><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><circle r="4.6"/></svg>역 표시</button>`;
      if (mapView === "seoul") {
        const note = modeNote(),
          ticks = scaleTicks();
        const md = modeOf(),
          dk = '<span class="w-l">진할수록</span><span class="w-d">밝을수록</span>',
          sent =
            md === "prog"
              ? `색이 ${dk} 진행 중 구역이 많은 구`
              : P.fund === "gap"
                ? `색이 ${dk} 전세 끼고 ${e2(CASH)}억으로 살 수 있는 구역이 많은 구`
                : md === "now"
                  ? `색이 ${dk} 내 현금 ${e2(CASH)}억으로 지금 매수 가능한 구역이 많은 구 (입주까지는 부족)`
                  : `색이 ${dk} 내 현금 ${e2(CASH)}억으로 ${P.basis === "total" ? "입주" : "지금 매수"} 가능한 구역이 많은 구`;
        const shortS = `색이 ${dk} ${md === "prog" ? "진행 중 구역" : P.fund === "gap" ? `전세 끼고 ${e2(CASH)}억 가능 구역` : md === "now" || P.basis !== "total" ? `${e2(CASH)}억 지금 매수 가능 구역` : `${e2(CASH)}억 입주 가능 구역`} 많음`;
        el.innerHTML = `<div class="ml-h"><b><span class="ml-lf">${sent}</span><span class="ml-ls">${shortS}</span></b><span class="ml-sw">${stnChip}${stkChip}${sw}</span></div>${note ? `<p class="ml-mode">${esc(note)}</p>` : ""}${
          md !== "prog"
            ? (() => {
                const n = R.filter((r) => r.xy && !isDone(r) && dotState(r) === "y").length;
                return `<p class="ml-glow"><i class="gd" aria-hidden="true"></i>반짝이는 점 = ${P.fund === "gap" ? "전세 끼고 지금 계약할 수 있는 구역" : P.basis === "total" ? "내 현금으로 입주까지 되는 구역" : "내 현금으로 지금 살 수 있는 구역"} <b>${fmt(n)}곳</b>${n ? " · 구를 누르면 하나씩 볼 수 있어요" : " · 금액을 바꿔 보세요"}</p>`;
              })()
            : ""
        }<div class="ml-scale" role="img" aria-label="색 범례: 회색 0곳, 옅은 파랑 1곳부터 진한 파랑 ${SMAX}곳 이상까지"><span class="ml-zero"><i></i>0</span><div class="ml-bar"><div class="ml-grad"></div><span class="ml-cur" id="mlCur" hidden></span><div class="ml-ticks">${ticks.map((v) => `<span style="left:${(tOf(v) * 100).toFixed(1)}%">${v}</span>`).join("")}</div></div><span class="ml-unit">곳</span></div>${showStn ? `<p class="ml-stk" id="mlStk">${HUB_KEY}</p>` : ""}`;
      } else {
        const c = { y: 0, n: 0, u: 0, e: 0, x: 0 };
        VIS.forEach((id) => {
          c[dotState(byId[id])]++;
        });
        const lab =
          P.fund === "gap" ? `지금 ${e2(CASH)}억으로 전세 끼고 매수 가능` : effBasis() === "total" ? "입주 가능" : "지금 매수 가능";
        el.innerHTML = `<div class="ml-top"><p class="ml-dots"><span class="lk"><i class="d y"></i>${lab} <b>${fmt(c.y)}</b></span><span class="lk"><i class="d n"></i>현금 부족 <b>${fmt(c.n)}</b></span>${c.e ? `<span class="lk" title="주변 빌라 거래가 적어 같은 구 빌라 시세 가운데 값으로 추정한 구역 · 곳 수에서 제외(조건 더 보기 → 추정 구역 포함)"><i class="d e"></i>구 평균 시세로 추정 <b>${fmt(c.e)}</b></span>` : ""}<span class="lk mu" title="주변 빌라 거래가 적거나 신축 시세·입주 시점 자료가 부족해 계산을 미룬 구역"><i class="d u"></i>거래 적어 계산 보류 <b>${fmt(c.u)}</b></span><span class="lk mu" title="입주권이 안 나오거나 전세 낀 매수가 막힌(토지거래허가) 구역 · 모아타운 관리지역"><i class="d x"></i>계산 제외 <b>${fmt(c.x)}</b></span>${typeof CM_SHOW !== "undefined" && CM_SHOW && CM_SET.size ? `<span class="lk cmk"><i class="d cm"></i>보라 테두리 = 출퇴근 ${esc(CM.dest)} ${CM.max}분 안<button type="button" class="cm-x" data-cmoff aria-label="출퇴근 강조 지우기">지우기</button></span>` : ""}</p><span class="ml-sw">${stnChip}${stkChip}</span></div>${showStn ? `<p class="ml-stk" id="mlStk">${STN_KEY}</p>` : ""}${effBasis() !== P.basis ? `<p class="ml-mode">입주까지 가능한 곳이 없어 '지금 매수' 기준으로 표시</p>` : ""}`;
      }
      el.querySelectorAll("[data-cmoff]").forEach(
        (b) =>
          (b.onclick = () => {
            CM_SHOW = false;
            document.querySelectorAll("#marks .mc.cm").forEach((m) => m.classList.remove("cm"));
            drawLegend();
          }),
      );
      el.querySelectorAll("[data-stk]").forEach(
        (b) =>
          (b.onclick = () => {
            stkOpen = !stkOpen;
            drawLegend();
          }),
      );
      el.querySelectorAll("[data-lmore]").forEach(
        (b) =>
          (b.onclick = () => {
            legMore = !legMore;
            drawLegend();
            const lv = $("mapLive");
            if (lv) {
              lv.textContent = "";
              setTimeout(() => {
                lv.textContent = legMore ? "범례 펼침" : "범례 접음";
              }, 30);
            }
          }),
      );
      el.querySelectorAll("[data-stn]").forEach(
        (b) =>
          (b.onclick = () => {
            showStn = !showStn;
            try {
              localStorage.setItem("jg-stn", showStn ? "1" : "0");
            } catch (e) {}
            drawStns();
            drawLegend();
            if (mapView === "gu") {
              labAt = 0;
              drawZoneLabels();
            }
            const lv = $("mapLive");
            if (lv) {
              lv.textContent = "";
              setTimeout(() => {
                lv.textContent = `역 표시 ${showStn ? "켜짐" : "꺼짐"}`;
              }, 30);
            }
          }),
      );
      el.querySelectorAll("[data-maff]").forEach(
        (b) =>
          (b.onclick = () => {
            mapAff = !mapAff;
            refreshMap();
            const lv = $("mapLive");
            if (lv) {
              lv.textContent = "";
              setTimeout(() => {
                lv.textContent = `내 현금 기준 ${mapAff ? "켜짐" : "꺼짐"} · ${
                  mapView === "gu"
                    ? $("mapGuCnt").textContent
                    : modeTitle()
                        .replace(/<[^>]+>/g, " ")
                        .split("  ")[0]
                }`;
              }, 30);
            }
          }),
      );
      const say = (t) => {
        const lv = $("mapLive");
        if (!lv) return;
        lv.textContent = "";
        setTimeout(() => {
          lv.textContent = `${t} · ${$("mapGuCnt").textContent}`;
        }, 30);
      };
      el.querySelectorAll("[data-st]").forEach(
        (b) =>
          (b.onclick = () => {
            const i = +b.dataset.st;
            let on;
            if (i === 0) on = F.done = !F.done;
            else {
              on = !F.st.has(i);
              on ? F.st.add(i) : F.st.delete(i);
            }
            applyVis();
            say(`${ST_LAB[i]} ${on ? "표시" : "숨김"}`);
          }),
      );
      el.querySelectorAll("[data-kind]").forEach(
        (b) =>
          (b.onclick = () => {
            const k = b.dataset.kind;
            const on = !F.kind.has(k);
            on ? F.kind.add(k) : F.kind.delete(k);
            applyVis();
            say(`${k} ${on ? "표시" : "숨김"}`);
          }),
      );
    });
  }
  const prob = (v) => (v == null ? null : Math.min(97, Math.round(v * 100)));
  function projection(r) {
    if (r.dn || r.s >= 9) return { done: true };
    if (r.src === "moa") return { moa: true };
    const e = r.eta;
    // 착공·이주 단계인데 5년 넘게 새 기록이 없는 등(tools/enrich.py r.stale): 준공됐는지 멈췄는지 알 수 없어 확률·시점을 보이지 않는다
    if (r.stale || e?.stale) return { stale: true, why: r.stale?.why || "최근 기록이 오래됐어요" };
    if (!e || e.na) return r.s <= 2 ? { pre: true } : { nodata: true };
    const stl = stallYrs(r);
    if (stl) return { stall: stl };
    if (!e.eMid) return { nodata: true };
    const d = (x) => new Date(x + "-15T00:00:00");
    const eMid = d(e.eMid);
    return {
      eLo: d(e.eLo),
      eMid,
      eHi: d(e.eHi),
      p10: e.p10,
      p15: e.p15,
      cond: e.cond,
      noDate: e.noDate,
      grp: e.grp,
      adj: e.adj,
      past: eMid < ETA_NOW,
      far: (eMid - ETA_NOW) / (365.25 * 864e5) > 15,
    };
  }
  const hasEta = (pr) => !pr.done && !pr.pre && !pr.nodata && !pr.moa && !pr.stall && !pr.stale && !pr.past;
  function stallYrs(r) {
    if (!(r.s >= 2 && r.s <= 6)) return 0;
    const d = curStageDate(r);
    if (!d) return 0;
    const [y, m] = d.split(".").map(Number);
    const t = TODAY.getFullYear() + TODAY.getMonth() / 12 - (y + ((m || 1) - 1) / 12);
    return t >= 8 ? Math.floor(t) : 0;
  }
  // 입주 시기: 4년 안쪽이면 연도, 그보다 멀면 단계별 남은 기간(가짜 정밀 연도 대신)
  function etaSpan(r, pr) {
    pr = pr || projection(r);
    if (pr.stale) return "진행 확인 필요";
    const yrs = pr.eMid ? (pr.eMid - ETA_NOW) / (365.25 * 864e5) : null;
    if (yrs != null && yrs < 0) return "확인 필요";   // 지난 입주 시점은 보이지 않는다
    if (yrs != null && yrs <= 4 && pr.eLo && pr.eHi) { const a = Math.max(ETA_NOW.getFullYear(), pr.eLo.getFullYear()), b = pr.eHi.getFullYear(); return a === b ? `${a}년` : `${a}~${String(b).slice(2)}년`; }
    // 4년보다 멀면 연도 대신 남은 기간(구역별 가운데 값 기준) · 15년 넘으면 날짜를 말하지 않는다
    if (yrs != null) return yrs > 15 ? "15년 넘게" : yrs > 10 ? "10~15년 뒤" : yrs > 7 ? "7~10년 뒤" : "4~7년 뒤";
    const s = r.s || 0;
    return s >= 6 ? "4~7년 뒤" : s === 5 ? "7~10년 뒤" : s === 4 ? "10~15년 뒤" : "15년 넘게";
  }
  // 리포트의 입주 시점 표시(사업·일정 큰 숫자 · 입주 현금 시간표)는 모두 이 한 값을 쓴다
  function etaShow(r) {
    const pr = projection(r);
    return pr.done ? "완료" : pr.moa ? "사업구역별" : pr.stale ? "진행 확인 필요" : pr.nodata || pr.stall ? "산정 불가" : pr.past ? "준공 여부 확인 필요" : etaSpan(r, pr);
  }
  function etaYearTxt(r) {
    const pr = projection(r);
    return pr.done
      ? "완료"
      : pr.moa
        ? "블록별"
        : pr.pre
          ? "미정"
          : pr.stale
            ? "진행 확인 필요"
            : pr.nodata || pr.stall
              ? "산정 불가"
              : pr.past
                ? "확인 필요"
                : etaSpan(r, pr);
  }
  function p10Txt(r) {
    const pr = projection(r);
    return hasEta(pr) ? prob(pr.p10) + "%" : pr.done ? "완료" : "–";
  }
  function p10Why(r) {
    const pr = projection(r);
    return hasEta(pr) || pr.done
      ? ""
      : pr.pre
        ? "구역지정 전"
        : pr.moa
          ? "사업구역별"
          : pr.stale
            ? "진행 확인 필요"
            : pr.stall
            ? `${pr.stall}년째 같은 단계 · 표본 부족`
            : "일정 자료 부족";
  }
  let cur = null,
    curTab = "money";
  const MQ_SHEET = matchMedia("(max-width:980px)");
  let sheetFrom = null,
    popNav = false;
  const urlWith = (hash) => location.pathname + location.search + (hash ? "#" + hash : "");
  const pushSt = (st, hash) => {
    try {
      history.pushState(st, "", urlWith(hash));
    } catch (e) {}
  };
  const replSt = (st, hash) => {
    try {
      history.replaceState(st, "", hash === undefined ? location.pathname + location.search + location.hash : urlWith(hash));
    } catch (e) {}
  };
  // 시트(모바일 구역 상세) 뒤: #report 바깥 모든 형제를 조상 줄을 따라 올라가며 inert
  // (목록·검색·하단 막대까지) · 대화상자·알림 영역·이미 inert인 요소는 건드리지 않는다
  function outsideOf(el) {
    const out = [];
    for (let n = el; n && n.parentElement && n !== document.body; n = n.parentElement)
      for (const s of n.parentElement.children)
        if (s !== n && !/^(SCRIPT|STYLE|TEMPLATE|DIALOG|LINK|META|NOSCRIPT)$/.test(s.tagName) && !s.matches('[role=dialog],[aria-modal],[aria-live],[role=status],[role=alert],[inert]')) out.push(s);
    return out;
  }
  let sheetBg = [];
  function bgFor(kind) {
    if (kind === "sheet") return sheetBg;
    return [
      document.querySelector("main"),
      document.querySelector(".site-foot"),
      document.querySelector(".skip"),
      document.querySelector(".tabbar"),
      document.querySelector(".logo"),
      document.querySelector(".hdr-r"),
    ].filter(Boolean);
  }
  let inertT = 0;
  const setInert = (els, on) => {
    cancelAnimationFrame(inertT);
    if (on) inertT = requestAnimationFrame(() => els.forEach((el) => el.setAttribute("inert", "")));
    else els.forEach((el) => el.removeAttribute("inert"));
  };
  function openSheet(opts = {}) {
    const rp = $("report");
    if (!MQ_SHEET.matches) return;
    if (!rp.classList.contains("sheet")) {
      sheetFrom = opts.from || document.activeElement;
      rp.classList.add("sheet");
      document.documentElement.classList.add("sheet-open");
      rp.setAttribute("role", "dialog");
      rp.setAttribute("aria-modal", "true");
      rp.setAttribute("aria-labelledby", "repTitle");
      sheetBg = outsideOf(rp);
      setInert(sheetBg, true);
      if (opts.deep) {
        replSt(null, "");
        pushSt({ sheet: cur.id }, cur.id);
      } else if (!opts.noHistory) {
        if (opts.replace) replSt({ sheet: cur.id }, cur.id);
        else pushSt({ sheet: cur.id }, cur.id);
      }
    } else if (!opts.noHistory) replSt({ sheet: cur.id }, cur.id);
    rp.scrollTop = 0;
    // 처음 포커스는 제목(닫기 버튼에 포커스 링이 뜨지 않게) · 시트 안에서 Tab이 끝에서 처음으로 돈다
    let ft = 0;   // 리포트가 비동기로 그려져 아직 없으면 몇 프레임 기다린다
    const fx = () => {
      const x = $("repTitle") || $("sheetClose");
      if (!rp.classList.contains("sheet") || rp.contains(document.activeElement)) return;
      if (x && rp.contains(x)) x.focus({ preventScroll: true });
      if (document.activeElement !== x && ft++ < 90) requestAnimationFrame(fx);
    };
    requestAnimationFrame(fx);
    if (!rp.dataset.trap) {
      rp.dataset.trap = "1";
      rp.addEventListener("keydown", (e) => {
        if (e.key !== "Tab" || !rp.classList.contains("sheet")) return;
        const F = [...rp.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex]:not([tabindex="-1"])')].filter((el) => el.tabIndex >= 0 && el.getClientRects().length && !el.closest("[hidden],[inert]"));
        if (!F.length) return;
        const a0 = F[0], z = F[F.length - 1], ae = document.activeElement;
        if (e.shiftKey ? ae === a0 || !F.includes(ae) && !(a0.compareDocumentPosition(ae) & 4) : ae === z) { e.preventDefault(); (e.shiftKey ? z : a0).focus(); }
      });
    }
  }
  function closeSheetNow() {
    const rp = $("report");
    if (!rp.classList.contains("sheet")) return;
    rp.classList.remove("sheet");
    rp.classList.remove("stuck");
    document.documentElement.classList.remove("sheet-open");
    rp.removeAttribute("role");
    rp.removeAttribute("aria-modal");
    rp.removeAttribute("aria-labelledby");
    setInert(sheetBg, false);
    sheetBg = [];
    // 연 자리로 포커스(목록이 다시 그려져 그 요소가 없어졌으면 같은 구역 줄 → 검색 버튼)
    const back = sheetFrom && document.contains(sheetFrom) && sheetFrom !== document.body ? sheetFrom : (cur && document.querySelector(`#sList [data-id="${cur.id}"], [data-id="${cur.id}"]:not(#report *)`)) || $("sSearch");
    if (back) back.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (history.state && history.state.sheet) history.back();
    else closeSheetNow();
  }
  MQ_SHEET.addEventListener("change", () => {
    if (!MQ_SHEET.matches) closeSheetNow();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("report").classList.contains("sheet")) closeSheet();
  });
  window.addEventListener("popstate", (e) => {
    if (e.state) {
      popNav = true;
      setTimeout(() => {
        popNav = false;
      }, 50);
    }
    const st = e.state || {};
    if (!st.sheet && $("report").classList.contains("sheet")) closeSheetNow();
    if (!st.search && $("hdr").classList.contains("searching")) closeSearchNow();
    if (st.sheet && byId[st.sheet] && MQ_SHEET.matches && !$("report").classList.contains("sheet")) {
      cur = byId[st.sheet];
      renderReport();
      openSheet({ noHistory: true });
    }
    if (st.gu && GU.has(st.gu)) {
      if (mapGu !== st.gu || mapView !== "gu") enterGu(st.gu, {});
      guHist = true;
    } else if (!st.sheet && mapView === "gu" && guHist) {
      exitGu({ focus: mapFocusBack });
      mapFocusBack = false;
    }
  });
  $("report").addEventListener(
    "scroll",
    () => {
      const rp = $("report");
      if (rp.classList.contains("sheet")) rp.classList.toggle("stuck", rp.scrollTop > 80);
    },
    { passive: true },
  );
  (function () {
    let y0 = null;
    $("report").addEventListener(
      "touchstart",
      (e) => {
        const b = e.target.closest(".sheet-bar");
        y0 = b && $("report").scrollTop <= 0 ? e.touches[0].clientY : null;
      },
      { passive: true },
    );
    $("report").addEventListener(
      "touchend",
      (e) => {
        if (y0 != null && e.changedTouches[0].clientY - y0 > 70) closeSheet();
        y0 = null;
      },
      { passive: true },
    );
  })();
  let pickedId = null;
  function ringPulse() {
    const g = $("selRing");
    if (!g || reduceMotion()) return;
    g.classList.remove("pulse");
    void g.getBBox();
    g.classList.add("pulse");
  }
  function showPop() {
    const el = $("mpop");
    if (!el) return;
    if (!cur || mapView !== "gu" || cur.g !== mapGu || MQ_SHEET.matches || !POS.has(cur.id) || matchMedia("(min-width:981px)").matches) {
      el.hidden = true;
      return;
    }
    const z = zoneLines(cur);
    el.innerHTML = `<button type="button" class="mp-x" id="mpX" aria-label="요약 닫기">${ICON.close}</button><b class="mp-n">${esc(shortName(cur.n))}</b><small>${esc(z.l2)}</small><p class="mp-3 ${z.a}">${esc(z.l3)}</p>${z.l4 ? `<p class="mp-4">${esc(z.l4)}</p>` : ""}${z.hj ? `<p class="mp-4">주변 호재 ${z.hj}건 · 리포트 '호재·매물' 탭</p>` : ""}<div class="mp-acts">${listBtn(cur, "primary sm")}${favBtn(cur, "sm")}</div>`;
    el.hidden = false;
    markNewWin(el);
    $("mpX").onclick = () => {
      el.hidden = true;
      schedRescale();
    };
  }
  function markPick() {
    if (!mapReady) return;
    const mk = $("marks");
    if (pickedId && (!cur || pickedId !== cur.id)) {
      const el = mk.querySelector(`.mc[data-id="${pickedId}"]`);
      if (el) el.classList.remove("sel");
    }
    if (cur) {
      const el = mk.querySelector(`.mc[data-id="${cur.id}"]`);
      if (el) {
        const had = document.activeElement === el;
        el.classList.add("sel");
        mk.appendChild(el);
        if (had) el.focus({ preventScroll: true });
      }
    }
    pickedId = cur ? cur.id : null;
    rescaleDots();
    placeRing();
    showPop();
    if (mapView === "gu" && !gest) drawZoneLabels();
  }
  function select(id, zoom = true, fromCard = false, opts = {}) {
    cur = byId[id];
    if (!cur) return;
    HJHL = null;
    if (!fromCard) backTo = null;
    renderReport();
    markPick();
    markRankRow();
    LMX.focus(!!zoom || mapView === "gu");
    if (zoom && cur.xy && GU.has(cur.g) && (mapGu !== cur.g || mapView !== "gu")) {
      const g = cur.g;
      if (MQ_SHEET.matches) requestAnimationFrame(() => setTimeout(() => enterGu(g, { keepReport: true }), 0));
      else enterGu(g, { keepReport: true });
    }
    if (opts.fromMk) {
      const lv = $("mapLive");
      if (lv) {
        lv.textContent = "";
        setTimeout(() => {
          lv.textContent = `${shortName(cur.n)} 리포트 열림`;
        }, 30);
      }
    }
    if (MQ_SHEET.matches) openSheet(opts);
    else {
      replSt(history.state && history.state.gu ? { gu: history.state.gu } : null, id);
      if (fromCard || opts.scroll) {
        const el = $("report");
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - HDR() - 16, behavior: smooth() });
        el.scrollTop = 0;
      }
      if (opts.focus)
        requestAnimationFrame(() => {
          const h = $("repTitle");
          if (h) h.focus({ preventScroll: true });
        });
    }
  }
  function stagePill(r) {
    return `<span class="stg" title="원자료: ${esc(srLabel(r))}${r.chk ? ` · 확인 중: ${esc(chkText(r))} 입주권 판정은 이 단계 기준` : ""}"><i style="background:${STCOL(st6(r))}"></i>${esc(r.src === "moa" ? srLabel(r) : stageName(r))}${r.chk ? " · 확인 중" : ""}</span>`;
  }
  function curStageDate(r) {
    const dt = r.dt || {};
    const m = { 2: "구역지정", 3: "추진위", 4: r.trust ? "시행자지정" : "조합설립", 5: "사업시행", 6: "관리처분", 8: "착공", 9: "준공" };
    const d = dt[m[r.s]] || (r.s === 4 ? dt["조합설립"] || dt["시행자지정"] : null) || r.sd;
    return d ? d.replaceAll("-", ".") : "";
  }
  const LOC_GS = ["교통", "일자리", "한강", "호재", "생활"];
  const locGroups = (r) =>
    LOC_GS.map((g) => [
      g,
      LOC_AX.reduce((s, a, i) => s + (a.g === g ? r.pts[i] : 0), 0),
      LOC_AX.reduce((s, a) => s + (a.g === g ? a.w * 100 : 0), 0),
    ]);
  function ptsBar(r, cls = "") {
    if (r.score == null || !r.pts) return "";
    const gs = locGroups(r);
    return `<span class="pb ${cls}" role="img" aria-label="입지 ${r.score}점: ${gs.map(([g, v, m]) => `${g} ${Math.round(v)}/${m}`).join(", ")}">${gs.map(([g, v]) => (v > 0.4 ? `<i class="${LOC_G[g]}" style="width:${v.toFixed(1)}%" title="${g} ${Math.round(v)}점"></i>` : "")).join("")}</span>`;
  }
  const gradeBadge = (r, sm) =>
    r.score != null && !r.dn
      ? `<span class="gb lb${sm ? " sm" : ""}" title="입지 점수 = 교통 30 + 업무지구 20 + 한강 10 + 호재 10 + 생활 인프라 30 (작성자 가정 가중치 · 투자 등급 아님)"><span class="gb-l">입지</span><b>${r.score}</b>${ptsBar(r, "pb-sm")}</span>`
      : "";
  const locKeyHTML = () =>
    LOC_GS.map(
      (g) => `<span class="lk2"><i class="${LOC_G[g]}"></i>${g} ${LOC_AX.reduce((s, a) => s + (a.g === g ? a.w * 100 : 0), 0)}</span>`,
    ).join("");
  const TABS = [
    ["money", "현금"],
    ["tx", "거래"],
    ["loc", "입지"],
    ["near", "호재"],
    ["biz", "일정"],
    ["req", "규제"],
  ];
  const TABF = { money: "입주 현금", tx: "실거래", loc: "입지·생활", near: "호재·매물", biz: "사업·일정", req: "규제·요건" };
  function renderReport() {
    keepFocus(() => {
      const r = cur;
      if (!r) return;
      const rp = $("report"),
        keepTop = rp.classList.contains("sheet") ? rp.scrollTop : null;
      const parent = r.parent ? byId[r.parent] : null;
      const w = !isDone(r) && !r.dn && !r.cx ? buyWindow(r) : null;
      const main = [
        w ? `<span class="bw ${w.cls}" title="${esc(w.d)}"><i></i>${esc(w.t)}</span>` : "",
        stagePill(r),
        r.cx ? '<span class="pill risk">대상지 취소</span>' : "",
        isDone(r) ? '<span class="pill">사업 완료 · 일반 매매</span>' : "",
        isPublic(r) ? '<span class="pill">공공재개발(LH·SH 참여)</span>' : "",
        r.trust ? '<span class="pill">신탁 방식</span>' : "",
      ].filter(Boolean);
      const extra = (r.pg || []).map((p) => `<span class="pill">${esc(p)}</span>`);
      const open = zoneOpen(r.id);
      rp.classList.toggle("rep-locked", !open);
      rp.innerHTML = `<div class="sheet-bar"><b aria-hidden="true">${esc(shortName(r.n))}</b><button type="button" class="btn ghost sm" id="sheetClose" aria-label="구역 리포트 닫기">${ICON.close}닫기</button></div>\n    ${backTo ? `<button type="button" class="back" id="backList">← 목록으로</button>` : mapView === "gu" && mapGu && !MQ_SHEET.matches ? `<button type="button" class="back" id="backGu" data-gu="${esc(mapGu)}">← ${esc(mapGu)} 구역 목록</button>` : ""}\n    <div class="rep-head">\n      <div class="rep-t"><div><h2 id="repTitle" tabindex="-1">${esc(shortName(r.n))}</h2>${shortName(r.n) !== r.n ? `<div class="formal">${esc(r.n)}</div>` : ""}</div>${gradeBadge(r)}</div>\n      <div class="where" title="역까지 직선거리 기준 · 도보 분은 직선×1.3, 분당 67m 추정"><b>${esc(r.g)} ${esc(r.bj || r.j)}</b> · ${esc(r.k)}${r.st ? ` · ${esc(whereText(r))}` : ""}</div>\n      ${parent ? `<div class="where">소속 모아타운: <a href="#${parent.id}" data-go="${parent.id}">${esc(parent.n)}</a></div>` : ""}\n      <div class="kind">${main.join("")}${extra.length ? `<span class="kx" id="kindX" hidden>${extra.join("")}</span><button type="button" class="pill more-p" id="kindMore" aria-expanded="false" aria-controls="kindX" title="사업 방식 태그 더 보기">사업 방식 ${extra.length}개 더 보기</button>` : ""}</div>\n      ${cashStrip(r)}\n      ${open ? hjSummary(r) : ""}\n      <div class="rep-acts">${listBtn(r, "primary sm")}${favBtn(r, "sm")}<button type="button" class="btn secondary sm" id="zoneShare">공유</button><span class="share-fb" id="zoneShareFb" role="status"></span></div>\n    </div>\n    ${open ? `<div class="tabs" role="tablist" aria-label="구역 리포트">\n      ${TABS.map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" data-tab="${k}" aria-label="${TABF[k] || l}" aria-selected="${curTab === k}" aria-controls="pane" tabindex="${curTab === k ? 0 : -1}">${l}</button>`).join("")}\n    </div>\n    <div class="tabpane" id="pane" role="tabpanel" aria-labelledby="tab-${curTab}" tabindex="0"></div>` : `<div class="rep-gate">${reportGate(r)}</div>`}\n    <div class="sheet-foot"><button type="button" class="btn secondary" id="sheetClose2">닫고 목록으로</button></div>`;
      if ($("kindMore"))
        $("kindMore").onclick = () => {
          $("kindX").hidden = false;
          $("kindMore").setAttribute("aria-expanded", "true");
          $("kindMore").hidden = true;
          const f = $("kindX").querySelector(".pill");
          if (f) {
            f.setAttribute("tabindex", "-1");
            f.focus({ preventScroll: true });
          }
        };
      $("sheetClose").onclick = closeSheet;
      $("sheetClose2").onclick = closeSheet;
      // 구역 페이지(/z/<id>)가 있는 곳은 그 주소로: 미리보기 카드·검색 노출이 구역마다 붙는다
      $("zoneShare").onclick = () => shareLink(r.src !== "moa" && !(r.s >= 9 || (r.dn && r.s < 7)) && /^[\w-]+$/.test(r.id) ? `https://jaegaebal.alwaysquestions.kr/z/${r.id}` : pageURL() + condQuery() + "#" + r.id, $("zoneShareFb"), `${shortName(r.n)} · 집핀`);
      const tabs = [...rp.querySelectorAll("[role=tab]")];
      tabs.forEach((b, i) => {
        b.onclick = () => setTab(b.dataset.tab);
        b.onkeydown = (e) => {
          const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -99 : e.key === "End" ? 99 : 0;
          if (!d) return;
          e.preventDefault();
          const j = d === -99 ? 0 : d === 99 ? tabs.length - 1 : (i + d + tabs.length) % tabs.length;
          setTab(tabs[j].dataset.tab);
          tabs[j].focus();
        };
      });
      if ($("backGu"))
        $("backGu").onclick = () => {
          const g0 = $("backGu").dataset.gu;
          if (mapView !== "gu" && g0) enterGu(g0);
          renderGuPanel();
          const f = $("report").querySelector(".gz-row");
          if (f) f.focus({ preventScroll: true });
        };
      if ($("backList"))
        $("backList").onclick = () => {
          const c = document.querySelector(`[data-card="${backTo}"]`);
          if (c) window.scrollTo({ top: c.getBoundingClientRect().top + window.scrollY - HDR() - 16, behavior: smooth() });
        };
      rp.querySelectorAll(".rep-head [data-go]").forEach(
        (a) =>
          (a.onclick = (e) => {
            e.preventDefault();
            select(a.dataset.go);
          }),
      );
      rp.querySelectorAll("[data-hjgo]").forEach(
        (b) =>
          (b.onclick = () => {
            setTab("near");
            const t = $("tab-near");
            if (t) t.focus({ preventScroll: true });
          }),
      );
      if (open) renderPane();
      if (keepTop != null) rp.scrollTop = keepTop;
      markNewWin(rp);
    });
  }
  function hjSummary(r) {
    const hs = nearHojae(r);
    if (!hs.length) return "";
    return `<div class="hjsum"><span class="hjs-l">주변 호재 <b>${hs.length}</b></span>${hs
      .slice(0, 3)
      .map(
        ({ h, d, at, st }) =>
          `<button type="button" class="hjchip" data-hjgo><i style="background:${h.c}" aria-hidden="true"></i>${esc(h.n.replace(/\s*\(.*\)$/, ""))}${at ? ` ${esc(at)}` : ""} <span class="mono">${kmTxt(d)}</span>${hjBadge(st)}</button>`,
      )
      .join("")}${hs.length > 3 ? `<button type="button" class="hjchip more" data-hjgo>+${hs.length - 3}</button>` : ""}</div>`;
  }
  const CHK3 = [
    [
      "매수 시점",
      "투기과열지구에서는 재건축은 조합설립인가 뒤, 재개발은 관리처분인가 뒤에 사면 조합원 지위를 넘겨받지 못해 입주권이 안 나올 수 있어요 (도시정비법 §39②).",
    ],
    [
      "쪼갠 지분",
      "권리산정기준일 뒤에 새로 짓거나 나눈 지분(신축 빌라·지분 분할)은 입주권이 안 나오거나 여러 명이 하나를 나눠 받을 수 있어요.",
    ],
    ["토지거래허가·실거주", "토지거래허가구역이면 계약 전에 구청 허가를 받아야 하고 실거주 의무가 붙어 전세를 낀 매수가 어려워요."],
  ];
  function paneNear(r) {
    const p = $("pane"),
      hs = nearHojae(r),
      ns = stnInfo(r);
    const rows = hs
      .map(
        ({ h, d, at, st }) =>
          `<li class="hj"><div class="hj-t"><i class="hj-sw" style="background:${h.c}" aria-hidden="true"></i><b>${esc(h.n)}</b>${hjBadge(st)}<span class="hj-d mono">${at ? `${esc(at)}역까지 ` : ""}${kmTxt(d)}</span></div><p class="hj-s">${esc(h.s)}</p>${h.note ? `<p class="hj-n">${esc(h.note)}</p>` : ""}<p class="hj-src">출처 ${h.src.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(" · ")}</p>${r.xy ? `<button type="button" class="btn text sm hj-map" data-hjmap="${h.id}">지도에서 보기</button>` : ""}</li>`,
      )
      .join("");
    p.innerHTML = `\n    <div class="sect"><h3>주변 호재 <small>구역 대표 좌표에서 약 1.5km 안 · 직선거리 · ${HJD.asOf.replaceAll("-", ".")} 기준</small></h3>\n      ${hs.length ? `<ul class="hjl">${rows}</ul>` : `<p class="hj-none">1.5km 안 정리된 호재 없음 <span>(GTX·새 철도·대형 복합개발 ${HJD.items.length}건 중)</span></p>`}\n      <p class="hj-warn">계획은 변경·지연될 수 있어요. 공식 발표로 확인하세요.</p></div>\n    <div class="sect"><h3>매물 보기</h3>\n      ${ns ? `<p class="hj-st">${esc(nearTxt(r))}${ns.s && ns.s.ls.length ? ` · ${esc(stnLines(ns.s))}` : ""}</p>` : ""}\n      ${listBtn(r, "primary") || '<p class="note">대표 좌표가 없어 지도 매물 링크를 만들 수 없어요.</p>'}\n      ${listingURL(r) ? `<p class="list-note">${noTicket(r) ? "" : LIST_NOTE + " "}${aptZone(r) && KBC[r.id] ? "KB부동산 단지 화면이 새 창으로 열려요(매매·전세 매물)." : "KB부동산 지도가 구역 대표 좌표를 가운데에 두고 새 창으로 열려요(매물·시세)."}</p>` : ""}</div>\n    <div class="chk3"><h3>매물 볼 때 체크할 3가지</h3><ol>${CHK3.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join("")}</ol><p class="note">구역별 판정은 '규제·요건' 탭에서 볼 수 있어요.</p></div>\n    ${leadCard("in-rep")}`;
    p.querySelectorAll("[data-hjmap]").forEach(
      (b) =>
        (b.onclick = () => {
          const it = hs.find((z) => z.h.id === b.dataset.hjmap);
          if (it) showHjOnMap(r, it);
        }),
    );
  }
  function showHjOnMap(r, it) {
    const tll = it.at ? (stnBy(it.at) || {}).ll : it.h.pt;
    if (!tll || !r.xy) return;
    if (LMX.on()) LMX.use(false);
    HJHL = { xy: toXY(tll[0], tll[1]), c: it.h.c };
    if (MQ_SHEET.matches) closeSheet();
    const go = () => {
      if (!BASEVB) return;
      const a = POS.get(r.id) || r.xy,
        b = HJHL.xy,
        AR = svgAR();
      const cx = (a[0] + b[0]) / 2,
        cy = (a[1] + b[1]) / 2;
      let w = Math.max(Math.abs(a[0] - b[0]) * 1.5, Math.abs(a[1] - b[1]) * 1.5 * AR, BASEVB[2] / MAXK);
      w = Math.min(w, BASEVB[2]);
      const h = w / AR;
      animTo([cx - w / 2, cy - h / 2, w, h], 450);
      placeRing();
    };
    const mt = $("mapbox").getBoundingClientRect();
    if (mt.bottom < HDR() + 80 || mt.top > innerHeight - 80) jumpTo("mapTop");
    if (mapView !== "gu" || mapGu !== r.g) {
      enterGu(r.g, { keepReport: true });
      setTimeout(go, reduceMotion() ? 50 : 600);
    } else setTimeout(go, MQ_SHEET.matches ? 350 : 0);
  }
  function setTab(k) {
    curTab = k;
    $("report")
      .querySelectorAll("[role=tab]")
      .forEach((b) => {
        const on = b.dataset.tab === k;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      });
    $("pane").setAttribute("aria-labelledby", "tab-" + k);
    renderPane();
  }
  function renderPane() {
    if (!$("pane")) return;
    if (PREM_TABS.has(curTab) && !cur._prem) {
      premPane(cur);
      return;
    }
    ({ loc: paneLoc, biz: paneBiz, money: paneMoney, req: paneReq, near: paneNear, tx: paneTx })[curTab](cur);
    if (curTab === "money" && gapMode()) {
      const h = gapPaneHTML(cur);
      if (h) {
        $("pane").insertAdjacentHTML("afterbegin", h);
        gapPaneBind(cur);
        gapBigrow(cur);
      }
    }
    markNewWin($("pane"));
  }
  function gaugeSvg(v) {
    const a = Math.PI * 1.5 * (v / 100),
      R0 = 46,
      cx = 59,
      cy = 59,
      st = -Math.PI * 1.25;
    const pt = (t) => [cx + R0 * Math.cos(st + t), cy + R0 * Math.sin(st + t)];
    const [x0, y0] = pt(0),
      [x1, y1] = pt(Math.PI * 1.5),
      [xv, yv] = pt(a);
    return `<svg viewBox="0 0 118 118" aria-hidden="true"><path d="M${x0} ${y0} A${R0} ${R0} 0 1 1 ${x1} ${y1}" fill="none" stroke="var(--surface-3)" stroke-width="9" stroke-linecap="round"/><path class="v" style="--len:${Math.round(R0 * a) + 2};stroke-dasharray:${Math.round(R0 * a) + 2}" d="M${x0} ${y0} A${R0} ${R0} 0 ${a > Math.PI ? 1 : 0} 1 ${xv} ${yv}" fill="none" stroke="var(--brand)" stroke-width="9" stroke-linecap="round"/></svg>`;
  }
  function paneLoc(r) {
    const p = $("pane");
    if (!r.st) {
      p.innerHTML = `<p class="note">대표 지번의 좌표를 찾지 못해 입지 점수가 없는 사업장입니다. 준공 뒤 지번이 합쳐진 단지에서 흔한 경우.</p>`;
      return;
    }
    const sameGu = POP_LOC.filter((x) => x.g === r.g).sort((a, b) => b.score - a.score);
    const rankGu = sameGu.findIndex((x) => x.id === r.id) + 1;
    const rankAll = scored.length - scored.filter((v) => v < r.score).length - scored.filter((v) => v === r.score).length + 1;
    const inf = infraOf(r),
      walk2 = (d) => Math.max(1, Math.round((d * 1.3) / 67));
    const irow = (k, lab) => {
      const o = inf && inf[k];
      if (!o) return "";
      const tag = k === "hp" ? (o.t === "t" ? "상급종합병원" : "종합병원급(추정)") : k === "e" && o.d <= 300 ? "초품아" : "";
      return `<li><span class="if-k">${lab}</span><span class="if-n">${esc(o.n)}${tag ? ` <em class="if-t${o.t === "t" || tag === "초품아" ? " on" : ""}">${tag}</em>` : ""}</span><span class="if-d mono">${kmTxt(o.d)}<small>도보 약 ${walk2(o.d)}분</small></span></li>`;
    };
    p.innerHTML = `\n    <div class="locbox">\n      <div class="lb-top"><div class="lb-v"><b>${r.score}</b><span>/100 입지 점수</span></div><p class="lb-pos">${posTxt(Math.round(((scored.length - Math.max(1, rankAll)) / scored.length) * 100))} <small>위치 확인된 진행 중 ${fmt(scored.length)}곳 중 약 ${fmt(Math.max(1, rankAll))}위 · ${esc(r.g)} ${rankGu ? `${rankGu}위/${sameGu.length}곳` : ""}</small></p></div>\n      ${ptsBar(r, "pb-lg")}\n      <div class="lb-key">${locKeyHTML()}</div>\n      <table class="lb-t"><caption class="sr-only">입지 점수 항목별 점수</caption><thead><tr><th scope="col">항목</th><th scope="col" class="n">가중치</th><th scope="col" class="n">항목 점수</th><th scope="col" class="n">얻은 점수</th></tr></thead><tbody>\n        ${LOC_AX.map((a, i) => `<tr><th scope="row"><i class="${LOC_G[a.g]}"></i>${a.k}<small>${esc(a.why)}</small></th><td class="n">${Math.round(a.w * 100)}</td><td class="n">${r.ax[i] == null ? "–" : r.ax[i]}</td><td class="n"><b>${r.pts[i].toFixed(1)}</b></td></tr>`).join("")}\n      </tbody></table>\n      <p class="sc-why">가중치와 거리별 점수는 작성자 가정값이에요. 교통·일자리·생활 편의를 거리로만 본 값이라 학군 수준·병원 진료과·상권 질은 반영하지 않아요. 투자 등급이 아니에요.${r.comp != null && !r.dn ? ` 입지·진척 점수 ${r.comp} = 입지 ${r.compAx[0]}×50% + 사업 진척 ${r.compAx[1]}×30% + 추진력 ${r.compAx[2]}×20%.` : ""}</p>\n    </div>\n    <div class="sect infra"><h3>생활 인프라 <small>가장 가까운 곳 · 직선거리 기준 · 도보는 직선×1.3, 분당 67m 추정</small></h3>\n      ${inf ? `<ul class="iflist">${irow("e", "초등학교")}${irow("m", "중학교")}${irow("h", "고등학교")}${irow("hp", "대형병원")}${irow("mt", "대형마트")}</ul>\n      <p class="note">학교: OpenStreetMap 학교 이름 기준(배정 학교와 다를 수 있음) · 대형병원: 보건복지부 제5기 상급종합병원 서울 14곳 + OSM 병원 중 이름 규칙으로 고른 종합병원급(추정) · 대형마트: 영업 중 지점 목록(나무위키 지점 문서)과 OSM 좌표를 맞춘 이마트·홈플러스·롯데마트·코스트코·트레이더스 · ${INF.asOf.replaceAll("-", ".")} 기준 · © OpenStreetMap contributors (ODbL)</p>` : '<p class="note">대표 좌표가 없어 생활 인프라 거리를 계산하지 못했어요.</p>'}</div>\n    <dl class="facts">\n      <div><dt>가장 가까운 역</dt><dd>${(() => {
      const x = stnInfo(r);
      return x ? `${esc(x.n)}역 ${fmt(x.d)}m<small>도보 약 ${x.min}분 · 직선거리 기준</small>` : "–";
    })()}</dd></div>\n      <div><dt>한강 중심선까지</dt><dd>${(r.h / 1e3).toFixed(2)}km</dd></div>\n      <div><dt>주변 호재 (1.5km)</dt><dd>${nearHojae(r).length}건<small>'호재·매물' 탭에서 목록</small></dd></div>\n      ${r.jg ? `<div><dt>주변 150m 대지 공시지가 가운데 값</dt><dd>㎡당 ${fmt(r.jg / 1e4)}만원<small>3.3㎡당 약 ${fmt((r.jg * 3.3058) / 1e4)}만원 · 진행 중 사업장 중 ${posTxt(jgPct(r.jg))}</small></dd></div>` : ""}\n    </dl>\n    <div class="sect"><h3>주변 역 <small>반경 1km 노선 ${r.ln.length ? r.ln.map(esc).join(", ") : "없음"}</small></h3>\n      <ul class="list">${r.s3.map(([n, d, l]) => `<li><span>${esc(n)} <small>${l.map(esc).join("·")}</small></span><span class="mono">${fmt(d)}m</span></li>`).join("")}</ul></div>\n    <div class="sect"><h3>업무지구까지 직선거리</h3>\n      <ul class="list">${Object.entries(
      r.hb,
    )
      .map(([k, v]) => `<li><span>${esc(k)}</span><span class="mono">${(v / 1e3).toFixed(1)}km</span></li>`)
      .join(
        "",
      )}</ul></div>\n    <p class="note"><b>좌표</b> 서울 도시계획포털 연속지적도의 대표 지번 필지 중심이라 구역 가장자리와는 수백 m 차이가 날 수 있어요.${r.stFix ? " 역 거리는 누락됐던 역(천왕·온수·오류동·개봉·사당 등)을 보완해 다시 계산했어요." : ""}</p>`;
  }
  function areaSuspect(r) {
    const sm = r.sm || {},
      u = sm.units ?? (sm.saleUnits != null && sm.rental != null ? sm.saleUnits + sm.rental : null);
    return !!(sm.area && u && sm.area / u < 15);
  }
  function naReason(field, r) {
    if (field === "builder") return r.s < 4 ? "미선정 (조합설립 이후 선정)" : r.s < 5 ? "미선정 또는 미공개" : "자료 없음";
    if (r.src === "moa") return "관리지역 단위 자료 없음 · 블록별 조합에서 확인";
    if (field === "units") return r.s <= 1 ? "자료 없음 (정비계획 고시 전 공개 안 됨)" : "미공개";
    if (field === "far" || field === "owners") return r.s <= 2 ? "자료 없음 (정비계획 고시 전 공개 안 됨)" : "미공개";
    if (field === "consent") return r.s < 3 ? "해당 없음 (추진위 전)" : "미공개";
    return "자료 없음";
  }
  function paneBiz(r) {
    const p = $("pane"),
      sm = r.sm || {},
      dt = r.dt || {},
      cs = r.cs || {};
    const pr = projection(r);
    const units = sm.units ?? (sm.saleUnits != null && sm.rental != null ? sm.saleUnits + sm.rental : null);
    const areaBad = areaSuspect(r);
    const owners = sm.owners ?? sm.members;
    const saleRatio = units && owners && units > owners ? (units - owners - (sm.rental || 0)) / units : null;
    const fact = (lab, v, small, na) =>
      `<div><dt>${lab}</dt>${v == null || v === "" ? `<dd class="na">${na || "자료 없음"}</dd>` : `<dd>${v}${small ? `<small>${small}</small>` : ""}</dd>`}</div>`;
    let consentHtml = "";
    const c = cs["조합설립"] || cs["추진위"];
    if (c) {
      const isUnion = !!cs["조합설립"];
      const th = isUnion ? (r.k === "재건축" ? 70 : /가로|소규모재개발/.test(r.k) ? 75 : r.k === "소규모재건축" ? 70 : 75) : 50;
      consentHtml = `<div class="sect"><h3>${isUnion ? "조합설립 동의율" : "추진위원회 동의율"} <small>정비사업 정보몽땅 추진경과 · ${esc(c.d)}</small></h3>\n      <div class="meter"><i style="width:${Math.min(100, c.v)}%"></i><div class="th" style="left:${th}%"><span>법정 기준 ${th}%</span></div></div>\n      <div class="meter-v"><b>${c.v.toFixed(2)}%</b><span>${c.first != null && c.first !== c.v ? `최초 인가 때 ${c.first}%` : ""}</span></div></div>`;
    } else if (r.uc) {
      consentHtml = `<div class="sect"><h3>조합설립 동의율 <small>출처: ${esc(r.uc.src)}</small></h3><div class="meter"><i style="width:76%"></i><div class="th" style="left:75%"><span>법정 기준 75%</span></div></div><div class="meter-v"><b>75% 초과</b><span class="pill">조합 발표</span></div><p class="note" style="margin-top:12px">${esc(r.uc.t)}. ${esc(r.uc.note)}</p></div>`;
    } else {
      consentHtml = `<p class="note"><b>동의율</b> 공식 추진경과에 기록된 동의율이 없어요.${r.src === "moa" ? ((r.kids || []).length ? " 모아타운은 관리지역 안의 개별 조합(가로주택 등) 단위로 동의를 받습니다. 동의율은 아래 소속 조합에서 확인." : " 모아타운은 관리지역 안의 개별 조합(가로주택 등) 단위로 동의를 받는데 이 관리지역의 개별 조합은 아직 정보몽땅에 등록되지 않아 공식 동의율이 없는 상태.") : r.s < 4 ? " 조합설립 전 단계라 조합설립 동의율은 아직 없어요." : " 조합이 추진경과에 동의율을 입력하지 않은 경우입니다."}</p>`;
    }
    const kids = (r.kids || []).map((id) => byId[id]);
    const { L, skip } = ladderLabels(r);
    const ladderIdx = r.dn ? 9 : isSmallR(r) && r.s === 6 ? 5 : r.s;
    const dMap = { 2: "구역지정", 3: "추진위", 4: r.trust ? "시행자지정" : "조합설립", 5: "사업시행", 6: "관리처분", 8: "착공", 9: "준공" };
    const dOf = (i) => dt[dMap[i]] || (i === 4 ? dt["조합설립"] || dt["시행자지정"] : null);
    const dates = L.map((_, i) => dOf(i));
    const etaRow =
      hasEta(pr) && !pr.past
        ? `<li class="eta"><span class="d" aria-hidden="true">◷</span><div><b>예상 준공·입주</b><p>준공되는 경우의 가운데 값 · 빠르면 ${pr.eLo < ETA_NOW ? "곧" : ym(pr.eLo)}, 늦으면 ${(pr.eHi - ETA_NOW) / (365.25 * 864e5) > 15 ? "15년 넘게" : ym(pr.eHi)}</p></div><span class="t">${etaSpan(r, pr)}</span></li>`
        : "";
    const kidDist = kids.length
      ? Object.entries(
          kids.reduce((m, k) => {
            const g = GROUPS[grpOf(k)][0];
            m[g] = (m[g] || 0) + 1;
            return m;
          }, {}),
        )
          .map(([g, n]) => `${g} ${n}`)
          .join(" · ")
      : "";
    const big1 = pr.done
      ? ["완료", ""]
      : pr.moa
        ? ["사업구역별", kids.length ? "소속 조합 리포트에서 확인" : "등록된 개별 조합 없음"]
        : pr.pre
          ? [etaShow(r), "구역지정 전 · 단계별 평균으로 어림"]
          : pr.stale
            ? ["진행 확인 필요", pr.why + " · 준공됐는지 멈췄는지 자료로 확인되지 않아 입주 시점과 확률을 보여 주지 않아요"]
            : pr.nodata
            ? ["산정 불가", "일정 자료 부족"]
            : pr.stall
              ? ["산정 불가", `${pr.stall}년째 같은 단계라 통계 표본이 거의 없어요`]
              : pr.past
                ? ["준공 여부 확인 필요", `예상 시점(${ym(pr.eMid)})이 기준일보다 앞섬`]
                : [etaSpan(r, pr), ""];
    const pShow = hasEta(pr);
    p.innerHTML = `\n    <div class="bigrow">\n      <div class="big"><span>예상 입주 <em class="lbl">준공되는 경우의 가운데 값</em></span><b${/\d/.test(big1[0]) ? "" : ' class="t"'}>${big1[0]}</b><small>${big1[1]}</small></div>\n      <div class="big"><span>${pr.done ? "준공" : "10년 안 준공 가능성"}</span><b>${pShow ? prob(pr.p10) + "%" : pr.done ? "준공 완료" : "–"}</b><small>${pShow ? (pr.noDate ? "현재 단계 날짜 없음 · 추정" : "서울 사업장 생존분석(KM·몬테카를로 4,000회)") : p10Why(r)}</small></div>\n      <div class="big"><span>현재 단계</span><b class="t">${esc(stageName(r))}</b><small>${curStageDate(r) ? esc(curStageDate(r)) + (r.chk ? " · 확인 필요(인가일이 아닐 수 있음)" : " · 공식 인가·고시일") : r.chk ? "단계 정보 확인 중" : ""}</small></div>\n    </div>\n    ${pr.adj ? `<p class="note"><b>가로·소규모 보정</b> 가로주택·소규모 표본이 적어 조합설립→사업시행 외 구간은 대규모 재개발·재건축 기간을 빌려 씁니다. 사업시행계획인가에 관리처분이 포함되므로 '사업시행→관리처분' 대기(${DUP.toFixed(1)}년)는 빼고 근사 보정했어요.</p>` : pr.grp === "small" && pShow ? `<p class="note"><b>가로·소규모</b> 표본이 적어 조합설립→사업시행 외 구간은 대규모 재개발·재건축 기간을 빌려 씁니다.</p>` : ""}\n    ${r.chk ? `<p class="note warnbox"><b>단계 정보 확인 중</b> ${esc(chkText(r))} 조합·구청 공고로 확인하세요.</p>` : ""}\n    ${r.cx ? `<p class="note riskbox"><b>대상지 취소</b> ${esc(r.cx)} 서울시가 모아타운 대상지에서 취소했습니다.</p>` : ""}\n    ${(r.news || []).length ? `<div class="sect"><h3>최근 확인된 소식 <small>공식 목록보다 최신</small></h3>${r.news.map((n) => `<p class="note">${n.d ? `<b>${esc(n.d.replaceAll("-", "."))}</b> ` : ""}${esc(n.t)} <a href="${esc(n.src)}" target="_blank" rel="noopener">출처</a></p>`).join("")}</div>` : ""}\n    ${r.sin ? `<p class="note"><b>신속통합기획 현황</b> ${esc(r.sin.stage && r.sin.stage !== "-" ? r.sin.stage : "진행 중")}${r.sin.designated && r.sin.designated !== "-" ? ` · 구역지정 ${esc(r.sin.designated)}` : ""}${r.sin.note && r.sin.note.trim() !== "-" ? ` · ${esc(r.sin.note)}` : ""} <span class="dim">(서울시 ${esc(r.sin.asOf)} 기준)</span></p>` : ""}\n    ${pr.moa ? `<p class="note"><b>일정</b> 모아타운 관리지역은 사업구역(블록)별로 따로 진행돼 관리지역 전체의 입주 시점은 계산하지 않아요.${kidDist ? ` 소속 조합 진행: ${kidDist}. 입주 시점은 아래 소속 조합 리포트에서 확인하세요.` : " 아직 정보몽땅에 등록된 개별 조합이 없어 입주 시점을 알 수 없어요."}</p>` : ""}\n    ${pr.pre ? `<p class="note"><b>일정</b> 구역지정 전이라 입주 시점과 준공 확률은 계산하지 않아요. 구역지정 시점은 서울시·구청 고시로 확인하세요.</p>` : ""}\n    ${pr.nodata ? `<p class="note"><b>일정 자료 부족</b> 현재 단계의 인가일 등 일정 자료가 모자라 준공 확률과 입주 시점을 산정하지 못했어요.</p>` : ""}\n    ${consentHtml}\n    <dl class="facts">\n      ${fact("구역 면적", sm.area ? (areaBad ? "확인 중" : fmt(sm.area) + "㎡") : null, sm.area ? (areaBad ? `원자료 ${fmt(sm.area)}㎡는 계획 세대수(${fmt(units)}세대)에 비해 너무 작아 필지 하나의 면적일 수 있어요` : `약 ${fmt(sm.area / 3.3058)}평`) : "", "자료 없음")}\n      ${fact("계획 세대수", units ? fmt(units) + "세대" : null, sm.rental ? `임대 ${fmt(sm.rental)} 포함` : "", naReason("units", r))}\n      ${fact(r.k === "재건축" || r.k === "소규모재건축" ? "조합원 수" : "토지등소유자", owners ? fmt(owners) + "명" : null, sm.members && sm.owners && sm.members !== sm.owners ? `조합원 ${fmt(sm.members)}명` : "", naReason("owners", r))}\n      ${fact("일반분양 비율(추정)", saleRatio != null ? (saleRatio * 100).toFixed(0) + "%" : null, saleRatio != null ? "(세대−소유자−임대)÷세대" : "", "계산 불가 (세대·소유자 자료 부족)")}\n      ${fact("계획 용적률", sm.far ? sm.far + "%" : null, sm.zoning || "", naReason("far", r))}\n      ${fact("시공자", r.b || null, r.b ? "정보몽땅 추진경과·기사 대조 · 늦게 반영될 수 있음" : "", naReason("builder", r))}\n    </dl>\n    ${kids.length ? `<div class="sect"><h3>관리지역 안 개별 조합 <small>${kids.length}곳 · 누르면 이동</small></h3><div class="children">${kids.map((k) => `<button type="button" class="child" data-go="${k.id}"><span>${esc(k.n)}<small>${esc(srLabel(k))}${k.cs && (k.cs["조합설립"] || k.cs["추진위"]) ? ` · 동의율 ${(k.cs["조합설립"] || k.cs["추진위"]).v.toFixed(1)}%` : ""}</small></span><span class="pill">${esc(k.k)}</span></button>`).join("")}</div></div>` : ""}\n    <div class="sect"><h3>추진 단계 <small>날짜는 공식 인가·고시일</small></h3>\n      <ol class="ladder">${L.map(
      (l, i) => {
        const st = i < ladderIdx ? "done" : i === ladderIdx ? "now" : "";
        const d = dates[i];
        const sk = skip.has(i) || (i === 3 && (r.skip || []).includes("추진위"));
        // 뒤 단계 날짜가 더 이르면 변경 지정·고시일. 단 구역지정보다 이른 추진위는 2009년 전 제도상 정상이라 보지 않는다
        const later = d && dates.slice(i + 1).some((x, j) => x && x < d && !(dMap[i] === "구역지정" && dMap[i + 1 + j] === "추진위"));
        return `<li class="${st}${sk ? " skip" : ""}"><span class="d">${sk ? "–" : i < ladderIdx ? "✓" : i}</span><div><b>${esc(l)}</b>${sk && i === 3 && (r.skip || []).includes("추진위") && !r.trust ? "<p>생략 (공공지원 조합직접설립)</p>" : ""}${later ? "<p>이 날짜는 변경 지정·고시일로 보여요 (최초 지정은 더 이름)</p>" : ""}</div><span class="t">${d ? d.replaceAll("-", ".") + ((r.dq || []).includes(dMap[i]) ? " ?" : "") + (later ? " (변경)" : "") : i === ladderIdx ? "현재" : ""}</span></li>`;
      },
    ).join(
      "",
    )}${pr.moa ? '<li><span class="d" aria-hidden="true">…</span><div><b>사업구역(블록)별 조합 진행</b><p>소속 조합 리포트에서 확인</p></div><span class="t"></span></li>' : ""}${etaRow}</ol></div>\n    ${r.rd ? `<p class="note"><b>권리산정기준일</b> ${esc(r.rd)} · 이날 이후 쪼갠 지분은 입주권이 안 나올 수 있습니다.</p>` : ""}\n    ${(() => {
      const bw = buyWindow(r);
      return bw.b18
        ? `<p class="note"><b>2018년 전 사업시행인가</b> ${esc(bw.b18)} · 관리처분인가 뒤에도 조합원 지위 양도 가능 (도시정비법 부칙)</p>`
        : "";
    })()}\n    ${r.cafe ? `<p class="note">공식 추정분담금·총회 자료는 <a href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl=${encodeURIComponent(r.cafe)}" target="_blank" rel="noopener">정비사업 정보몽땅 사업장 페이지</a>에서 확인하세요. 이 사이트의 분담금은 자체 추정치입니다.</p>` : ""}`;
    p.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => select(b.dataset.go)));
  }
  const won = (x) =>
    x == null || !isFinite(x)
      ? "–"
      : Math.abs(x) < 1 && Math.round(Math.abs(x) * 1e4) < 1e4
        ? Math.round(Math.abs(x) * 1e4) === 0
          ? "0원"
          : fmt(Math.round(x * 1e4)) + "만원"
        : NF2.format(Math.round(x * 100) / 100) + "억";
  const NF2 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
  function taxDesc(x) {
    if (x.land0) return "멸실 후 토지 취득 4.6% (취득세 4% + 교육세·농특세)";
    if (P.homes === 2) return "조정지역 3주택 이상 중과 12% + 지방교육세 0.4%" + (x.big ? " + 농특세" : "");
    if (P.homes === 3) return "조정지역 2주택 중과 8% + 지방교육세 0.4%" + (x.big ? " + 농특세" : "");
    return `${(acqRate(x.price, false, false) * 100).toFixed(1)}% (1~3% + 지방교육세) · 매수 시 납부`;
  }
  function tiParts(x) {
    const rate = num("aRate") ?? 4.5;
    return [
      `원시취득세 ${won(x.origTax)} (${NF2.format(Math.round(Math.max(x.contrib, x.unitPrice * 0.35) * 100) / 100)}억 × ${x.unitArea > 85 ? "3.16" : "2.96"}%)`,
      x.loanNow
        ? `매수대출 이자 ${won(x.interest)} (${won(x.loanNow)} × ${rate}% × ${x.yrs ? NF1.format(x.yrs) + "년" : `${CONS_YRS}년(입주 시점 미정 · 보수 가정)`} 단리)`
        : "매수대출 이자 없음 (매수 대출 안 받음)",
      x.midInt ? `중도금 이자 ${won(x.midInt)} (분담금 60% × ${rate}% × 2년)` : "중도금 이자 없음",
    ].join(" · ");
  }
  function paneMoney(r) {
    const p = $("pane");
    if (isDone(r)) {
      p.innerHTML = `<p class="note"><b>사업이 끝난 구역 · 일반 매매</b> 준공·입주(또는 사업 완료)가 확인된 구역이라 입주권이 아니라 일반 아파트로 거래돼요. 이 계산기(입주권 매수 → 입주)의 대상이 아니에요.</p>`;
      return;
    }
    const x = invest(r),
      o = OV[r.id] || {};
    const w0 = buyWindow(r);
    if (w0.cls === "no") {
      const rb = isRebuild(r) || isSmall(r);
      p.innerHTML = `<div class="bigrow"><div class="big hl off"><span>입주 때 시세 차이</span><b>입주권 없음</b><small>지금 사면 ${rb ? "매도청구 대상" : "현금청산 대상"}</small></div></div>\n      <p class="note riskbox"><b>${esc(w0.t)} · ${esc(w0.due)}</b> ${esc(w0.d)}</p>\n      ${rb ? `<p class="note"><b>보상 방식</b> ${isSmall(r) ? "가로·소규모는 협의 → 매도청구(시가 기준, 소규모주택정비법 §35·36)로" : "재건축은 매도청구(시가 기준)로"} 보상액이 달라집니다 · 법률 검토 권장</p>` : x.price != null && x.appr != null ? `<p class="note"><b>현금청산 시 예상 손실</b> 약 ${won(x.price - x.appr + x.tax)} (매수가 ${won(x.price)} − 감정가 추정 ${won(x.appr)} + 취득세 ${won(x.tax)}) · 재개발 수용 보상 기준의 참고값</p>` : ""}\n      <p class="note">${rb ? "" : "현금청산은 감정평가액 기준 보상이라 매수가에 붙은 프리미엄은 돌려받지 못합니다. "}예외 매물(매도인이 10년 보유·5년 거주 1세대1주택 등)을 사는 경우에만 조합원 지위가 승계되며, 이때는 조합에 승계 가능 여부를 먼저 확인하십시오.</p>`;
      return;
    }
    if (x.price == null && !o.price) {
      p.innerHTML = `<p class="note">${x.stale ? "이주·철거가 시작된 구역이라 거래는 입주권으로만 이뤄집니다. 주변 빌라 시세로는 추정할 수 없어 입주권 매물 호가를 넣어야 계산됩니다." : "반경 800m 안에 비교할 실거래가 없어 매수가를 추정하지 못했습니다. 매물가를 넣으면 계산합니다."}</p><div class="ff"><div class="f"><label for="mPrice">매수가<small>프리미엄 포함 실제 매물가</small></label><div class="inp"><input id="mPrice" inputmode="decimal" placeholder="예: 5"><span>억</span></div></div></div>`;
      $("mPrice").addEventListener("change", () => {
        const v = parseFloat($("mPrice").value);
        if (v > 0) {
          OV[r.id] = { ...(OV[r.id] || {}), price: v };
          paneMoney(r);
          plan();
        }
      });
      return;
    }
    const w = buyWindow(r),
      lp = landPermit(r);
    const f = (id, lab, sub, val, est, unit) => {
      const chg = val != null && val !== "";
      return `<div class="f${chg ? " chg" : ""}"><label for="${id}">${lab}${chg ? `<button type="button" class="rs" data-reset="${id}">초기화</button>` : est !== "" && est !== "–" ? '<span class="est">추정</span>' : ""}<small>${sub}</small></label><div class="inp"><input id="${id}" inputmode="decimal" value="${chg ? val : est === "–" ? "" : est}" data-est="${est}"><span>${unit}</span></div></div>`;
    };
    const ratioChg = Math.round(x.ratio * 100) !== 100;
    const cons = x.ok && x.annual == null;
    const gainCls = !x.ok ? "off" : cons ? "ref" : x.gain >= 0.05 ? "up" : x.gain <= -0.05 ? "dn" : "";
    const left = CASH - x.needTotal;
    // 입주 때 시세를 못 정해 입주까지 계산이 안 되면 빈 '–' 카드 셋 대신 이유 한 장 + 넣을 칸으로 바로 가기
    const noCalc = x.ok ? "" : `<div class="big cash nocalc"><span>입주까지 필요한 현금</span><b class="t">아직 계산 못 해요</b><small>${x.nvThin ? "주변 신축 거래가 적어" : "주변 신축 실거래가 없어"} 입주 때 시세를 못 정했어요.${x.needBuy != null && isFinite(x.needBuy) ? ` 지금 사는 데는 대출 끼고 <b>${f1(x.needBuy)}억</b>(매수가 ${e2(x.price)}억 · ${o.est ? "구 평균 추정" : x.priceSrc === "user" ? "직접 입력" : "추정"})` : ""}</small><span class="nc-a"><button type="button" class="btn secondary sm" data-nc="mNv">입주 때 시세 넣기</button><button type="button" class="btn text sm" data-nc="mPrice">매수가 넣기</button></span></div>`;
    p.innerHTML = `\n    ${noCalc}<div class="bigrow"${x.ok ? "" : " hidden"}>\n      <div class="big cash"><span>입주까지 필요한 현금</span><b>${x.ok ? e2(x.needTotal) + "억" : "–"}</b><small>${x.ok ? (x.needTotal <= CASH ? `내 현금 ${e2(CASH)}억 · ${e2(left) === "0" ? "남는 돈 없음" : e2(left) + "억 남음"}` : `내 현금 ${e2(CASH)}억 · ${e2(x.needTotal - CASH)}억 부족`) : ""}</small></div>\n      <div class="big gain ${gainCls}"><span>입주 때 시세 차이</span><b>${x.ok ? sg(x.gain) + "억" : x.nvThin ? "표본 부족" : "–"}</b><small>${x.ok ? (x.gain <= 0 ? "손실 예상" : x.annual != null ? `연 ${pcIrr(x.annual)} (연 복리 수익률)${x.annual < DEP ? ' · <span class="lowp">예금 3.0% 미만</span>' : ""}${r.eta?.p10 != null && r.eta.p10 < 0.3 ? ` · <span class="lowp">10년 내 준공 ${prob(r.eta.p10)}%</span>` : ""}` : `입주 시점 미정 · 참고값${x.loanNow ? ` (매수대출 이자 ${CONS_YRS}년 가정)` : ""}`) : x.nvThin ? "주변 신축 비교 거래가 부족해 차익을 계산하지 않아요" : ""}</small><small class="lbl2">추정 · 시세 상승 ${num("aGrowth") ? `연 ${num("aGrowth")}%` : "0%"} 가정${isMulti() ? " · " + MULTI_NOTE : ""}</small></div>\n      <div class="big"><span>${x.refund ? "환급 추정" : "추가 분담금"}</span><b>${x.ok ? e2(Math.abs(x.contrib)) + "억" : "–"}</b><small>${x.ok ? `조합원 분양가 ${e2(x.unitPrice)} − 권리가액 ${e2(x.right)}` : ""}</small></div>\n    </div>\n    ${x.ok ? `<div class="cash-brw">${cashBr(x.needTotal, x.loanEnd).html}</div>` : ""}\n    ${x.ok ? `<details class="note flow"><summary><b>필요 현금 계산식</b></summary><p>${esc(flowLine(x))}</p></details>` : ""}\n    ${x.ok && r.s >= 5 && x.prem < x.right * 0.2 && x.priceSrc !== "user" ? `<p class="note warnbox"><b>매수가가 낮게 잡혔을 수 있음</b> 사업시행인가 이후인데 프리미엄 추정(${won(x.prem)})이 권리가액의 20% 미만이에요. 실제 매물가를 아래 '매수가'에 넣어 보세요.</p>` : ""}\n    ${o.appr != null && x.price != null && o.appr > x.price ? `<p class="note warnbox"><b>감정가가 매수가보다 높아요</b> 매수가(현재 시세)도 함께 바꿔야 결과가 과하게 좋게 나오지 않아요.</p>` : ""}\n    ${isEst(r) ? `<p class="note warnbox"><b>구 평균 시세로 추정</b> 주변 빌라 거래가 적어 매수가를 정할 수 없는 구역이라, 같은 구(${esc(r.g)}) 다른 구역 ${EST_N[r.g] || 0}곳의 주변 빌라 실거래 가운데 값 ${e2(o.price)}억을 매수가로 넣었어요. 실제 매물가를 아래 '매수가'에 넣으면 그 값으로 계산해요.${P.est ? "" : " 기본 설정에서는 곳 수·목록에서 빠져 있어요(조건 더 보기 → 추정 구역 포함)."}</p>` : ""}\n    ${r.src === "moa" ? `<p class="note warnbox"><b>관리지역 평균값</b> 모아타운 관리지역 전체 기준의 참고값이에요. 실제 분담금·입주권은 사업구역(블록)별로 달라요.</p>` : ""}\n    <p class="note ${w.cls === "no" ? "riskbox" : ""}"><b>${esc(w.t)}</b> ${esc(w.d)}${lp ? ` · <b>${esc(lp.t)}</b> ${esc(lp.d)}` : ""}</p>\n    <div class="sect"><h3>숫자 바꿔 보기 <small>'추정'은 자동 계산값 · 바꾸면 목록 카드에도 반영</small></h3><div class="ff">\n      ${f("mPrice", "매수가", "프리미엄 포함 실제 매물가", o.price, e2(x.price), "억")}\n      ${f("mAppr", "종전자산 감정가", "관리처분 뒤에는 조합 공개값", o.appr, e2(x.appr), "억")}\n      ${f("mRatio", "비례율", "모든 구역 일괄 변경은 고급 가정에서", ratioChg ? Math.round(x.ratio * 100) : "", ratioChg ? "" : Math.round(x.ratio * 100), "%")}\n      ${f("mUnit", "조합원 분양가", `${P.unit}㎡ 기준`, o.unitPrice, x.ok ? e2(x.unitPrice) : "", "억")}\n      ${f("mNv", "입주 때 시세", x.ref ? `주변 신축 ${esc(x.ref.scope || "")} ${x.ref.n}건${x.ref.complexes ? " · " + x.ref.complexes.slice(0, 2).map(esc).join(", ") : ""}` : "주변 신축 실거래 기준", o.nv, x.ok ? e2(x.nv) : "", "억")}\n    </div></div>\n    ${x.ok ? `<dl class="facts">\n      <div><dt>권리가액</dt><dd>${won(x.right)}<small>감정가 ${won(x.appr)} × 비례율 ${Math.round(x.ratio * 100)}%</small></dd></div>\n      <div><dt>프리미엄 추정</dt><dd>${won(x.prem)}<small>매수가 − 권리가액 (표시값은 반올림)</small></dd></div>\n      <div><dt>취득세</dt><dd>${won(x.tax)}<small>${taxDesc(x)} · '지금 필요한 현금'에 포함</small></dd></div>\n      <div><dt>매수 대출</dt><dd>${loanWhy(x)}</dd></div>\n      <div class="fx-ti"><dt>세금·이자 (입주까지)</dt><dd>${e2(flowParts(x).ti)}억<small>${tiParts(x)}</small></dd></div>\n      <div class="fx-tot"><dt>입주까지 들어가는 돈 합계(잔금대출 빼기 전)</dt><dd>${f1(cashBr(x.needTotal, x.loanEnd).s)}억<small>매수가 + 취득세 + 분담금 + 세금·이자(입주까지)</small></dd></div>\n      <div><dt>입주 잔금대출</dt><dd>${e2(x.loanEnd)}억<small>신축 시세 기준 LTV ${Math.round(ltvEnd() * 100)}%·가격구간 한도${P.first ? " (생애최초 70%는 매수 대출에만)" : ""}${r.s >= 6 ? " · 2025.10.15 이전 관리처분인가 구역은 종전 규정 적용 가능(은행 확인)" : ""} · 현행 규제(2025.10.16~) 기준 · 입주 시점 규제에 따라 달라짐</small></dd></div>\n    </dl>\n    <div class="sect"><h3>비례율에 따른 결과 <small>현금 매수 기준 · 나머지 조건 고정</small></h3><table class="sens"><caption class="sr-only">비례율별 입주 때 시세 차이와 분담금</caption><thead><tr><th scope="col">비례율</th><th scope="col">입주 때 시세 차이</th><th scope="col">분담금</th></tr></thead><tbody id="mSens"></tbody></table></div>` : ""}\n    <p class="note">감정가 추정: ${esc(x.apprWhy || "")}. ${r.k === "재건축" ? "재건축초과이익환수 부담금은 미반영. " : ""}실제 감정가·비례율·조합원 분양가는 관리처분계획에서 확정됩니다.</p>\n    <p class="note"><b>포함하지 않은 비용</b> ${MISSING_COSTS}</p>`;
    p.querySelectorAll("[data-nc]").forEach((b) => b.addEventListener("click", () => { const i = $(b.dataset.nc); if (!i) return; i.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => { try { i.focus({ preventScroll: true }); i.select(); } catch (e) {} }, 300); }));
    const map = { mPrice: "price", mAppr: "appr", mUnit: "unitPrice", mNv: "nv" };
    Object.entries(map).forEach(([id, k]) =>
      $(id).addEventListener("change", () => {
        const v = parseFloat($(id).value);
        OV[r.id] = OV[r.id] || {};
        if (isFinite(v) && v > 0 && String(v) !== $(id).dataset.est) {
          OV[r.id][k] = v;
          if (k === "price") delete OV[r.id].est;
        } else delete OV[r.id][k];
        estSync();
        invalidate();
        GCACHE = new Map();
        paneMoney(r);
        plan();
      }),
    );
    $("mRatio").addEventListener("change", () => {
      const v = parseFloat($("mRatio").value);
      if (isFinite(v) && v > 0) {
        $("aRatio").value = v;
        readAV();
        invalidate();
        paneMoney(r);
        plan();
      }
    });
    p.querySelectorAll("[data-reset]").forEach(
      (b) =>
        (b.onclick = (e) => {
          e.preventDefault();
          const id = b.dataset.reset;
          if (id === "mRatio") {
            $("aRatio").value = 100;
            readAV();
          } else if (OV[r.id]) delete OV[r.id][map[id]];
          estSync();
          invalidate();
          GCACHE = new Map();
          paneMoney(r);
          plan();
        }),
    );
    if (x.ok && $("mSens")) {
      const save = AV.aRatio,
        rows = [80, 90, 100, 110, 120].map((v) => {
          AV.aRatio = v;
          const y = invest(r);
          return [v, y];
        });
      AV.aRatio = save;
      const mx = Math.max(...rows.map(([, y]) => Math.abs(y.gain)), 0.1),
        curV = Math.round(x.ratio * 100);
      $("mSens").innerHTML = rows
        .map(
          ([v, y]) =>
            `<tr${v === curV ? ' class="cur"' : ""}><td>${v}%</td><td class="gv"><span class="sb" style="width:${Math.round((Math.abs(y.gain) / mx) * 56)}px"></span><span class="${y.gain >= 0.05 ? "up" : y.gain <= -0.05 ? "dn" : ""}">${sg(y.gain)}억</span></td><td>${y.contrib >= 0 ? e2(y.contrib) : "환급 " + e2(-y.contrib)}억</td></tr>`,
        )
        .join("");
    }
    if (r.src === "moa") {
      const kids = (r.kids || []).map((id) => byId[id]).filter(Boolean);
      const box = document.createElement("details");
      box.className = "note flow moa-calc";
      box.innerHTML = "<summary><b>관리지역 평균 기준 참고 계산 보기</b></summary>";
      while (p.firstChild) box.appendChild(p.firstChild);
      p.innerHTML = `<p class="note warnbox"><b>블록별로 계산하세요</b> 모아타운 관리지역은 사업구역(블록)마다 조합·분담금·입주권 판정이 달라요. ${kids.length ? "아래 소속 조합 리포트에서 계산하세요." : "아직 정보몽땅에 등록된 소속 조합이 없어요."}</p>${kids.length ? `<div class="children">${kids.map((k) => `<button type="button" class="child" data-go="${k.id}"><span>${esc(k.n)}<small>${esc(srLabel(k))}</small></span><span class="pill">${esc(k.k)}</span></button>`).join("")}</div>` : ""}`;
      p.appendChild(box);
      p.querySelectorAll(".children [data-go]").forEach((b) => (b.onclick = () => select(b.dataset.go)));
    }
  }
  const MISSING_COSTS =
    "중개보수·등기비·보유세(재산세·종부세)·양도세·이주비 이자·이사비·재건축부담금·생애최초 취득세 감면은 계산에 넣지 않았어요.";
  function ruleById(id) {
    return (D.rules || []).find((x) => x.id === id);
  }
  function paneReq(r) {
    const p = $("pane");
    const isRb = r.k === "재건축";
    const isMoaT = r.src === "moa" || isSmall(r);
    const w = buyWindow(r),
      lp = landPermit(r);
    let body = `<p class="note ${w.cls === "no" ? "riskbox" : ""}"><b>${esc(w.t)}</b> ${esc(w.d)} 서울 전역 투기과열지구 효력 2025.10.16 (강남·서초·송파·용산은 2017.8.3부터 연속 지정).</p>`;
    if (lp) body += `<p class="note"><b>${esc(lp.t)}</b> ${esc(lp.d)}</p>`;
    if (r.src === "moa" || r.parent)
      body += `<p class="note"><b>모아타운 토지거래허가</b> 토지거래허가로 지정된 모아타운이라도 대상은 지목 '도로'인 토지뿐이라 빌라·단독 매수는 허가·실거주 의무가 없어요. 이 관리지역의 지정 여부는 구청에서 확인하세요.</p>`;
    if (!isRb && !isMoaT) {
      body += `<div class="sect"><h3>재개발 구역지정 요건 체크 <small>서울 도시정비조례 제6조</small></h3>${r.s >= 2 ? '<p class="note">이미 정비구역으로 지정된 곳이라 이 체크는 참고용이에요. 공식 구역 면적은 지정 고시문으로 확인하세요.</p>' : ""}\n      <div class="f"><label for="q1">노후·불량 건축물 비율<small>동수 기준 · 필수 60% 이상</small></label><div class="inp"><input id="q1" inputmode="decimal" placeholder="예: 72" value="${r.tx && r.tx.old && r.s < 7 ? r.tx.old.pol : ""}"><span>%</span></div></div>\n      <div class="f"><label for="q2">구역 면적<small>필수 1만㎡ 이상</small></label><div class="inp"><input id="q2" inputmode="decimal" value="${r.sm?.area && !areaSuspect(r) ? Math.round(r.sm.area) : ""}" placeholder="${areaSuspect(r) ? "면적 확인 중" : ""}"><span>㎡</span></div></div>\n      <div class="f"><label for="q3">과소필지(90㎡ 미만) 비율<small>선택 40% 이상</small></label><div class="inp"><input id="q3" inputmode="decimal"><span>%</span></div></div>\n      <div class="f"><label for="q4">주택접도율<small>선택 40% 이하 · 6m 도로 기준</small></label><div class="inp"><input id="q4" inputmode="decimal"><span>%</span></div></div>\n      <div class="f"><label for="q5">호수밀도<small>선택 ha당 60동 이상</small></label><div class="inp"><input id="q5" inputmode="decimal"><span>동/ha</span></div></div>\n      <div class="f"><label for="q6">노후 건축물 연면적 비율<small>선택 60% 이상 (시행령)</small></label><div class="inp"><input id="q6" inputmode="decimal"><span>%</span></div></div>\n      <ul class="checks" id="qOut" aria-live="polite"></ul></div>`;
    }
    const rule = isRb ? ruleById("rebuild-diagnosis") : isMoaT ? ruleById("moa-town") : ruleById("redev-zone-seoul");
    const cons = ruleById("consent-committee-union");
    const rn = Object.entries(rule?.numbers || {});
    const smallKey = r.k === "소규모재건축" ? "소규모재건축" : r.k === "소규모재개발" ? "소규모재개발" : "가로";
    const rows =
      isMoaT && r.src !== "moa"
        ? rn.filter(([k]) => k.includes(smallKey) || (smallKey !== "소규모재개발" && k === "가로·소규모재건축_노후도"))
        : rn.slice(0, 6);
    body += `<div class="sect"><h3>${isRb ? "재건축진단" : isMoaT ? (r.src === "moa" ? "모아타운·모아주택 요건" : `${esc(r.k.replace("(모아주택)", ""))} 요건 (소규모주택정비법)`) : "적용 기준"} <small>현행 법령·조례 기준</small></h3><dl class="facts">${rows.map(([k, v]) => `<div><dt>${esc(k.replaceAll("_", " "))}</dt><dd class="tx">${esc(v)}</dd></div>`).join("")}</dl>${r.k === "소규모재건축" ? '<p class="note">소규모재건축은 소규모주택정비법 사업이라 도시정비법의 재건축진단(구 안전진단) 절차가 없어요. 조합설립 동의는 같은 법 제23조 기준입니다.</p>' : ""}</div>`;
    if (!isMoaT)
      body += `<div class="sect"><h3>조합설립 동의 기준</h3><dl class="facts">${Object.entries(cons?.numbers || {})
        .map(([k, v]) => `<div><dt>${esc(k.replaceAll("_", " "))}</dt><dd class="tx">${esc(v)}</dd></div>`)
        .join("")}</dl></div>`;
    p.innerHTML = body;
    if (!isRb && !isMoaT) {
      const chk = () => {
        const v = (id) => {
          const x = parseFloat($(id).value);
          return isFinite(x) ? x : null;
        };
        const a = v("q1"),
          b = v("q2"),
          c = v("q3"),
          d = v("q4"),
          e5 = v("q5"),
          f = v("q6");
        const it = (ok, t) =>
          `<li><span class="mk ${ok == null ? "q" : ok ? "ok" : "no"}" aria-hidden="true">${ok == null ? "?" : ok ? "✓" : "!"}</span><span>${ok == null ? '<span class="sr-only">미확인: </span>' : ok ? '<span class="sr-only">충족: </span>' : '<span class="sr-only">미충족: </span>'}${t}</span></li>`;
        const opt = [
          c != null ? c >= 40 : null,
          d != null ? d <= 40 : null,
          e5 != null ? e5 >= 60 : null,
          f != null ? f >= 60 : null,
          a != null ? a >= 75 : null,
        ];
        const optOk = opt.some((x) => x === true) ? true : opt.every((x) => x === false) ? false : null;
        const all = a != null && b != null ? a >= 60 && b >= 1e4 && optOk === true : null;
        $("qOut").innerHTML =
          it(a == null ? null : a >= 60, "노후·불량 건축물 60% 이상") +
          it(b == null ? null : b >= 1e4, "면적 1만㎡ 이상 (심의 인정 시 5천㎡)") +
          it(optOk, "선택요건 하나 이상 (노후도 75% 이상이면 자동 충족)") +
          it(all, all ? "정비구역 지정 요건 충족" : "모든 값을 넣으면 종합 판정 표시");
      };
      ["q1", "q2", "q3", "q4", "q5", "q6"].forEach((id) => $(id).addEventListener("input", chk));
      chk();
    }
  }
  const shortNameS = (n) => n.replace(/\([^)]*\)/g, "").replace(/(주택)?(재개발|재건축|정비|사업|조합|추진위원회|\s)+$/g, "");
  const normQ = (t) =>
    t
      .toLowerCase()
      .replace(/제\s*(\d)/g, "$1")
      .replace(
        /재정비촉진구역|재정비촉진지구|재정비촉진|정비구역|주택재개발|주택재건축|재개발|재건축|정비사업|사업|구역|조합|번지|일대|\s/g,
        "",
      );
  const idx = R.map((r) => {
    const nm = (r.n + " " + shortNameS(r.n)).toLowerCase();
    const t = (nm + " " + r.g + " " + r.j + " " + (r.bj || "") + " " + (r.st?.n || "")).replace(/\s+/g, " ").toLowerCase();
    return { r, t, nm: nm.replace(/\s/g, ""), c: t.replace(/\s/g, ""), a: normQ(r.n) + "|" + normQ(r.j) };
  });
  function qVariants(q) {
    const v = [q];
    const m = q.match(/^(\D+?)(\d+)-(\d+)$/);
    if (m) {
      v.push(`${m[1]}${m[2]}구역${m[3]}지구`, `${m[1]}${m[2]}동${m[3]}구역`, `${m[1]}${m[2]}-${m[3]}`);
    }
    return v;
  }
  let sIdx = -1;
  // 초성(ㅎㄴ → 한남)·로마자(hannam → 한남) 찾기: 처음 쓸 때 한 번만 만든다
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const RO_I = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"],
    RO_M = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"],
    RO_F = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];
  const hg = (s, f) => [...s].map((ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? f(c) : /[0-9a-z]/i.test(ch) ? ch.toLowerCase() : ""; }).join("");
  const choOf = (s) => hg(s, (c) => CHO[Math.floor(c / 588)]);
  const romOf = (s) => hg(s, (c) => RO_I[Math.floor(c / 588)] + RO_M[Math.floor((c % 588) / 28)] + RO_F[c % 28]);
  let altIdx = false;
  const altKeys = () => {
    if (altIdx) return;
    altIdx = true;
    idx.forEach((x) => {
      const ws = [shortNameS(x.r.n), shortName(x.r.n), (x.r.j || "").split(/\s/)[0], x.r.g];
      x.cho = ws.map(choOf).join("|");
      x.rom = ws.map(romOf).join("|");
    });
  };
  const STN_ALL = () => (D.stations || []).filter((s) => isFinite(s[1]) && isFinite(s[2]));
  function stnHit(q) {
    const b = q.replace(/\s/g, "").replace(/역$/, "");
    if (b.length < 2) return null;
    const L = STN_ALL();
    return L.find((s) => s[0].replace(/역$/, "") === b) || (/역$/.test(q.trim()) ? L.find((s) => s[0].startsWith(b)) : null) || null;
  }
  // 최근 검색어(빈 검색창에 칩으로 · 62_extra.js)
  const saveQ = () => { try { const v = $("q").value.trim().slice(0, 30), k = "emr.recentQ"; if (!v) return; localStorage.setItem(k, JSON.stringify([v].concat(JSON.parse(localStorage.getItem(k) || "[]").filter((x) => x !== v)).slice(0, 5))); } catch (e) {} };
  const GU_ALL = [...new Set(R.map((r) => r.g))];
  const guHit = (qc) => (qc.length >= 2 ? GU_ALL.find((g) => g === qc || g === qc + "구") || null : null);
  function goGu(g) {
    saveQ();
    $("sugg").hidden = true;
    $("q").setAttribute("aria-expanded", "false");
    $("q").value = "";
    if ($("hdr").classList.contains("searching")) closeSearchNow({ keepHistory: true });
    const mob = matchMedia("(max-width:980px)").matches,
      nb = document.querySelector('#sNav [data-nav="map"]');
    if (mob && nb) nb.click();
    else ($("mapbox") || $("mapTop"))?.scrollIntoView({ block: "start", behavior: "smooth" });
    setTimeout(() => { try { enterGu(g, { hist: true }); } catch (e) {} }, mob ? 450 : 50);
  }
  function goStation(s) {
    saveQ();
    $("sugg").hidden = true;
    $("q").setAttribute("aria-expanded", "false");
    $("q").value = "";
    if ($("hdr").classList.contains("searching")) closeSearchNow({ keepHistory: true });
    const mob = matchMedia("(max-width:980px)").matches,
      nb = document.querySelector('#sNav [data-nav="map"]');
    if (mob && nb) {
      nb.click();
      setTimeout(() => { document.querySelectorAll("#sNav [data-nav]").forEach((x) => x.removeAttribute("aria-current")); nb.setAttribute("aria-current", "page"); }, 120);
    }
    else ($("mapbox") || $("mapTop"))?.scrollIntoView({ block: "center", behavior: "smooth" });
    const L = window.ZP_lmx || window.__lmx;
    const fly = () => {
      try {
        // 지도 쪽 API: 지도가 아직 없거나 로딩 중이면 줄 세워 두었다가 준비되면 옮기고, 역 표시·도보 고리를 그린다
        if (L && typeof L.flyToStation === "function") return L.flyToStation(s, 14.5);
        const m = L && L.map && L.map();
        if (m) m.flyTo({ center: [s[2], s[1]], zoom: 14.5, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700 });
        return !!m;
      } catch (e) {
        return false;
      }
    };
    const off = () => { try { const m = L && L.map && L.map(); if (!m) return true; const c = m.getCenter(); return m.getZoom() < 13.5 || Math.hypot((c.lng - s[2]) * 88, (c.lat - s[1]) * 111) > 0.4; } catch (e) { return false; } };
    fly();
    // 폰 전체 지도는 열리며 서울 전체로 맞추므로, 그 뒤에도 역에서 벗어나 있으면 한 번 더
    [mob ? 1000 : 450, 2200].forEach((t) => setTimeout(() => { if (off()) fly(); }, t));
  }
  const needS = (r) => {
    try {
      if (r.s >= 9 || r.dn || r.src === "moa") return null;
      if (gapMode()) { const g = gapOf(r); return g.block || g.na || g.now == null || !isFinite(g.now) ? null : { v: g.now, l: "전세 끼고" }; }
      const x = investC(r), tot = effBasis() === "total";
      const v = tot ? (x.ok ? x.needTotal : null) : x.needBuy;
      return v == null || !isFinite(v) ? null : { v, l: tot ? "입주까지" : "지금" };
    } catch (e) {
      return null;
    }
  };
  const e1S = (v) => (v < 0.05 ? "0원" : `${(Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "")}억`);
  function renderSugg() {
    const q = $("q")
      .value.trim()
      .toLowerCase()
      .replace(/번지|일대/g, "");
    if (q.length < 1) {
      $("sugg").hidden = true;
      $("q").setAttribute("aria-expanded", "false");
      $("suggLive").textContent = "";
      return;
    }
    const vs = qVariants(q.replace(/\s/g, ""));
    const terms = q.split(/\s+/);
    const nameHit = (x) => vs.some((v) => x.nm.includes(v) || (normQ(v).length >= 2 && normQ(x.r.n).includes(normQ(v))));
    const qn = normQ(q);
    const lvl = (x) => {
      if (!x.sn) x.sn = normQ(shortName(x.r.n));
      if (qn.length >= 2 && (x.sn === qn || normQ(x.r.n) === qn)) return 0;
      if (qn.length >= 2 && (x.sn.startsWith(qn) || normQ(x.r.n).startsWith(qn))) return 1;   // 이름 앞부분이 맞으면 위로
      return nameHit(x) ? 2 : 3;
    };
    const qc = q.replace(/\s/g, ""),
      isCho = /^[ㄱ-ㅎ0-9]+$/.test(qc) && /[ㄱ-ㅎ]/.test(qc) && qc.length >= 2,
      isRom = /^[a-z0-9-]+$/.test(qc) && /[a-z]{3}/.test(qc);
    if (isCho || isRom) altKeys();
    const altHit = (x) => (isCho ? x.cho.includes(qc) : isRom ? x.rom.includes(qc) : false);
    const stn = stnHit(q);
    const gu = guHit(qc);
    // 지번(1-3)은 낱말째 맞는 곳 먼저: 중화동131-35처럼 숫자 가운데 걸린 곳은 뒤로
    const jt = terms.find((t) => /^\d+(-\d+)?$/.test(t)),
      jRe = jt ? new RegExp(`(^|[^0-9-])${jt}(?![0-9])`) : null,
      jb = (r) => (jRe && !jRe.test(`${r.j || ""} ${r.bj || ""} ${r.n}`) ? 1 : 0);
    const done = (r) => (isDone(r) ? 1 : 0);   // 완료·해제 구역은 이름이 딱 맞아도 맨 아래
    const all = idx
      .filter(
        (x) =>
          terms.every((t) => x.t.includes(t)) ||
          vs.some((v) => x.c.includes(v)) ||
          (normQ(q).length >= 2 && vs.some((v) => x.a.includes(normQ(v)))) ||
          altHit(x),
      )
      .map((x) => ({ ...x, nh: altHit(x) && !nameHit(x) ? ((isCho ? x.cho : x.rom).split("|").some((w) => w.startsWith(qc)) ? 1 : 2) : lvl(x) }))
      .sort(
        (a, b) =>
          done(a.r) - done(b.r) ||
          jb(a.r) - jb(b.r) ||
          a.nh - b.nh ||
          (a.r.dn || 0) - (b.r.dn || 0) ||
          Number(restricted(a.r)) - Number(restricted(b.r)) ||
          (b.r.score || 0) - (a.r.score || 0),
      );
    // 역 이름 검색: 역 줄 바로 아래에 그 역에서 걸어서 15분(직선 약 770m) 안 구역을 가까운 순으로(최대 8곳)
    // 그 역이 가장 가까운 역인 구역은 구역 자료의 역 거리(r.st.d)를, 아니면 구역 중심까지 직선거리를 쓴다
    const stnW = (r) => { if (!stn) return Infinity; if (r.st && r.st.n && r.st.n.replace(/역$/, "") === stn[0].replace(/역$/, "")) return r.st.d; if (!r.ll) return Infinity; const dx = (r.ll[1] - stn[2]) * 88200, dy = (r.ll[0] - stn[1]) * 111000; return Math.hypot(dx, dy); };
    const stnZ = stn ? R.filter((r) => !isDone(r) && r.src !== "moa" && stnW(r) <= 773).sort((a, b) => stnW(a) - stnW(b)).slice(0, 8) : [];
    const stnSet = new Set(stnZ.map((r) => r.id));
    // 같은 지번의 모아타운 관리지역은 따로 줄을 세우지 않고 사업 구역 줄에 '모아타운' 꼬리표로 합친다
    const pk = (r) => `${r.g}|${(r.j || "").replace(/\s+/g, "")}`;
    const zoneJ = new Set(R.filter((r) => r.src !== "moa" && r.j).map(pk));
    const moaJ = new Set(R.filter((r) => r.src === "moa" && r.j).map(pk));
    const hits = stnZ
      .map((r) => ({ r, near: true }))
      .concat(all.filter((x) => !stnSet.has(x.r.id) && !(x.r.src === "moa" && x.r.j && zoneJ.has(pk(x.r)))))
      .slice(0, 20);
    sIdx = -1;
    $("q").removeAttribute("aria-activedescendant");
    const walkT = (r) => (r.st ? (Math.round((r.st.d * 1.3) / 67) > 20 ? "역에서 멀어요" : esc(r.st.n.replace(/역$/, "")) + "역 " + Math.max(1, Math.round((r.st.d * 1.3) / 67)) + "분") : "");
    const okZ = (r) => { try { return !!(window.ZP_ok && window.ZP_ok(r)); } catch (e) { return false; } };
    const row = (r, i, near) => {
      const n = needS(r), ok = okZ(r);
      const wt = near ? `${esc(stn[0].replace(/역$/, ""))}역 ${Math.max(1, Math.round((stnW(r) * 1.3) / 67))}분` : r.st ? walkT(r) : "";
      return `<button type="button" role="option" id="sg${i}" aria-selected="false" data-id="${r.id}" tabindex="-1"><span>${esc(shortName(r.n))}${r.s >= 9 ? " <i class=\"sg-done\">완료</i>" : ""}<small>${esc(r.g)} ${esc(r.j)} · ${esc(stageName(r))}${r.src !== "moa" && r.j && moaJ.has(pk(r)) ? " · 모아타운" : ""}${wt ? " · " + wt : ""}</small></span><em class="sg-c">${n ? `<b>${e1S(n.v)}</b><small>${n.l}</small>` : ""}${ok ? '<i class="sg-ok">살 수 있음</i>' : ""}</em></button>`;
    };
    const stnRow = stn
      ? `<button type="button" role="option" id="sgS" aria-selected="false" data-stn="${esc(stn[0])}" tabindex="-1" class="sg-stn"><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 10h12M8 21l2-4M16 21l-2-4"/></svg>${esc(stn[0])}<small>${esc((stn[3] || []).join(" · "))} · 지도에서 역 주변 보기</small></span><em>지도 →</em></button>`
      : "";
    const guN = gu ? R.filter((r) => r.g === gu && !isDone(r) && r.src !== "moa").length : 0;
    const guRow = gu
      ? `<div class="sg-gu" role="presentation"><button type="button" role="option" id="sgG" aria-selected="false" data-gu="${esc(gu)}" tabindex="-1" class="sg-stn"><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>${esc(gu)}<small>진행 중 구역 ${fmt(guN)}곳 · 지도에서 보기</small></span><em>지도 →</em></button><a class="sg-gup" role="option" id="sgGp" aria-selected="false" tabindex="-1" href="/gu/${encodeURIComponent(gu)}">구 페이지</a></div>`
      : "";
    const noneHTML = () => {
      const near = qc.length >= 2 ? idx.filter((x) => !(x.r.s >= 9) && x.r.src !== "moa" && shortName(x.r.n).includes(qc.slice(0, 2))).slice(0, 4).map((x) => x.r) : [];
      const pop = R.filter((r) => r.tx && r.tx.n3 && !(r.s >= 9) && r.src !== "moa" && !near.includes(r)).sort((a, b) => b.tx.n3 - a.tx.n3).slice(0, 6);
      const chip = (r) => `<button type="button" class="x-chip" role="option" data-id="${r.id}" tabindex="-1">${esc(shortName(r.n))}<small>${esc(r.g.replace(/구$/, ""))}</small></button>`;
      return `<div class="s-none" role="presentation"><b>'${esc(q)}'(으)로 찾은 구역이 없어요</b><br>동 이름(성수동), 지번(자양동 799), 역 이름(왕십리역), 초성(ㅎㄴ)으로도 찾을 수 있어요.</div>${near.length ? `<div class="x-h" role="presentation">비슷한 이름</div><div class="x-row">${near.map(chip).join("")}</div>` : ""}<div class="x-h" role="presentation">요즘 거래 많은 구역</div><div class="x-row">${pop.map(chip).join("")}</div>`;
    };
    $("sugg").innerHTML =
      guRow +
      stnRow +
      (hits.length
        ? hits.map((h, i) => {
            // 역 주변 목록 뒤: 이름이 실제로 맞는 곳만 "이름에 'q'", 주소·역 글자로 걸린 곳은 "주변 더 보기"
            let hd = "";
            if (h.near && i === 0) hd = `<div class="x-h" role="presentation">${esc(stn[0].replace(/역$/, ""))}역 걸어서 15분 안 · ${fmt(stnZ.length)}곳${stnZ.length >= 8 ? " (가까운 순)" : ""}</div>`;
            else if (!h.near && stnZ.length) {
              const grp = (x) => (x && !x.near && x.nh <= 2 ? "n" : "m");
              if (i === stnZ.length || grp(hits[i - 1]) !== grp(h))
                hd = `<div class="x-h" role="presentation">${grp(h) === "n" ? `이름에 '${esc(q)}'` : `${esc(stn[0].replace(/역$/, ""))}역 주변 더 보기`}</div>`;
            }
            return hd + row(h.r, i, h.near);
          }).join("") +
          (all.length > hits.length
            ? `<div class="more-hits" role="presentation">외 ${all.length - hits.length}곳 · 지번이나 구 이름을 더 넣어 좁혀 보세요</div>`
            : "")
        : stn || gu
          ? ""
          : noneHTML());
    $("sugg").hidden = false;
    $("q").setAttribute("aria-expanded", "true");
    $("suggLive").textContent = hits.length ? `${all.length}곳 찾음` : stn ? `${stn[0]} 찾음` : gu ? `${gu} 찾음` : "일치하는 사업장 없음";
    $("sugg")
      .querySelectorAll("button[data-id]")
      .forEach((b) => ((b.onmousedown = (e) => e.preventDefault()), (b.onclick = () => pickSugg(b.dataset.id))));
    const sb = $("sugg").querySelector("[data-stn]");
    if (sb) (sb.onmousedown = (e) => e.preventDefault()), (sb.onclick = () => goStation(stn));
    const gb = $("sugg").querySelector("[data-gu]");
    if (gb) (gb.onmousedown = (e) => e.preventDefault()), (gb.onclick = () => goGu(gu));
    const gp = $("sugg").querySelector(".sg-gup");
    if (gp) gp.onclick = saveQ;
  }
  function pickSugg(id) {
    saveQ();
    $("sugg").hidden = true;
    $("q").setAttribute("aria-expanded", "false");
    $("q").value = "";
    const searching = $("hdr").classList.contains("searching");
    if (searching) closeSearchNow({ keepHistory: true });
    curTab = "money";
    select(id, true, false, { scroll: true, focus: true, replace: searching });
  }
  let sT = 0;
  $("q").addEventListener("input", () => {
    clearTimeout(sT);
    sT = setTimeout(renderSugg, 80);
  });
  $("q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(sT);
      renderSugg();
    }
    const bs = $("sugg").hidden ? [] : [...$("sugg").querySelectorAll("button[data-id],button[data-stn],button[data-gu],a.sg-gup")];
    if (e.key === "Escape") {
      if (!$("sugg").hidden) {
        $("sugg").hidden = true;
        $("q").setAttribute("aria-expanded", "false");
      }
      return;
    }
    // 콤보박스: Tab은 결과 목록을 건너뛰고 다음 요소로(목록은 화살표로)
    if (e.key === "Tab") {
      $("sugg").hidden = true;
      $("q").setAttribute("aria-expanded", "false");
      $("q").removeAttribute("aria-activedescendant");
      return;
    }
    if (!bs.length) return;
    if (e.key === "Home" || e.key === "End") return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sIdx = (sIdx + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length;
      bs.forEach((b, i) => {
        b.classList.toggle("on", i === sIdx);
        b.setAttribute("aria-selected", String(i === sIdx));
      });
      if (!bs[sIdx].id) bs[sIdx].id = "sgx" + sIdx;
      $("q").setAttribute("aria-activedescendant", bs[sIdx].id);
      bs[sIdx].scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter") {
      const b = bs[sIdx] || bs[0];
      b.click();
    }
  });
  // 결과 목록이 어디서 닫히든(Esc·바깥 누름·검색 닫기) aria-expanded·activedescendant를 목록 상태와 맞춘다
  try { new MutationObserver(() => { const h = $("sugg").hidden; $("q").setAttribute("aria-expanded", String(!h)); if (h) { $("q").removeAttribute("aria-activedescendant"); sIdx = -1; } }).observe($("sugg"), { attributes: true, attributeFilter: ["hidden"] }); } catch (e) {}
  // /?q=검색어 (404 페이지 검색창 등): 검색창을 열고 결과를 바로 보여 준다
  try {
    const q0 = new URLSearchParams(location.search).get("q");
    if (q0 && q0.trim())
      setTimeout(() => {
        const sb = $("sSearch") || $("sOpen");
        if (matchMedia("(max-width:980px)").matches && sb && !$("hdr").classList.contains("searching")) sb.click();
        $("q").value = q0.trim().slice(0, 40);
        $("q").focus({ preventScroll: true });
        renderSugg();
      }, 700);
  } catch (e) {}
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search")) {
      $("sugg").hidden = true;
      $("q").setAttribute("aria-expanded", "false");
    }
  });
  const GUS = [...new Set(R.map((r) => r.g))].sort();
  $("rGu").innerHTML = '<option value="">서울 전체</option>' + GUS.map((g) => `<option>${g}</option>`).join("");
  $("rKind").innerHTML = '<option value="">모든 유형</option>' + KINDS.map((k) => `<option>${k[0]}</option>`).join("");
  $("rStage").innerHTML =
    '<option value="">진행 중 전체</option>' +
    GROUPS.slice(0, 4)
      .map((g) => `<option>${g[0]}</option>`)
      .join("");
  let sortKey = "score",
    sortDir = -1,
    rankReady = false;
  function emptyState(o) {
    return `<div class="es" role="status"><span class="es-ic" aria-hidden="true">${o.icon || ICON.filter}</span><p class="es-t">${o.title}</p>${o.desc ? `<p class="es-d">${o.desc}</p>` : ""}${(o.acts || []).length ? `<div class="es-acts">${o.acts.map((a) => `<button type="button" class="btn ${a.primary ? "primary" : "secondary"}" ${a.attr}>${a.label}${a.n != null ? ` <b>${fmt(a.n)}곳</b>` : ""}</button>`).join("")}</div>` : ""}</div>`;
  }
  const RANK_BASE = (r) => r.score != null && !isDone(r);
  const RF = new Set();
  function rankFilter(f) {
    return R.filter(
      (r) =>
        RANK_BASE(r) &&
        [...(f.inf || RF)].every((k) => INF_F[k](r)) &&
        (r.src !== "moa" || f.k === "모아타운") &&
        (!f.g || r.g === f.g) &&
        (!f.k || KINDS.find((x) => x[0] === f.k)[1](r)) &&
        (!f.s || GROUPS.find((x) => x[0] === f.s)[1](r)) &&
        (!f.af || AFF.has(r.id)),
    );
  }
  let NEED = new Map(),
    XOF = new Map();
  function markRankRow() {
    if (!rankReady) return;
    $("rank")
      .querySelectorAll("tbody tr[data-id]")
      .forEach((tr) => tr.classList.toggle("sel", !!cur && tr.dataset.id === cur.id));
  }
  const dash = (why) => `<span class="na-d" title="${why}">–<span class="sr-only">${why}</span></span>`;
  let rankNear = true,
    rankDirty = false;
  if (window.IntersectionObserver)
    new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          rankNear = e.isIntersecting;
          if (rankNear && rankDirty) drawRank();
        }),
      { rootMargin: "400px 0px" },
    ).observe($("rankTop"));
  function drawRank(force) {
    if (!rankReady) return;
    if (!rankNear && !force) {
      rankDirty = true;
      return;
    }
    rankDirty = false;
    keepFocus(() => {
      const f = { g: $("rGu").value, k: $("rKind").value, s: $("rStage").value, af: $("rAfford").checked, inf: new Set(RF) };
      let list = rankFilter(f);
      const val = {
        comp: (r) => r.comp ?? -1,
        score: (r) => r.score,
        stn: (r) => r.st.d,
        han: (r) => r.h,
        el: (r) => infraOf(r)?.e.d ?? 1e9,
        stage: (r) => r.s,
        consent: (r) => (r.cs?.["조합설립"] || r.cs?.["추진위"])?.v ?? -1,
        units: (r) => r.sm?.units ?? -1,
        name: (r) => r.n,
      };
      list.sort((a, b) => {
        const x = val[sortKey](a),
          y = val[sortKey](b);
        return (x > y ? 1 : x < y ? -1 : 0) * sortDir;
      });
      const total = list.length;
      list = list.slice(0, 60);
      // 대부분 '–'인 열(동의율·계획 세대)은 숨긴다 — 보이는 줄의 40% 이상에 값이 있을 때만 보여 줌
      const has = (f) => list.length && list.filter(f).length >= list.length * 0.4;
      const showCs = has((r) => r.cs?.["조합설립"] || r.cs?.["추진위"]), showUn = has((r) => r.sm?.units);
      const th = (k, l, n) =>
        `<th${n ? ' class="r"' : ""} scope="col"${sortKey === k ? ` aria-sort="${sortDir > 0 ? "ascending" : "descending"}"` : ""}><button type="button" data-k="${k}"${sortKey === k ? ` data-dir="${sortDir > 0 ? "▲" : "▼"}"` : ""}>${l}</button></th>`;
      const cols =
        '<colgroup><col style="width:52px"><col><col style="width:128px"><col style="width:150px"><col style="width:104px"><col style="width:136px"><col style="width:132px">' + (showCs ? '<col style="width:84px">' : "") + (showUn ? '<col style="width:96px">' : "") + "</colgroup>";
      const head = `<caption class="sr-only">입지 순위 (열 머리를 눌러 정렬, 행을 누르면 구역 리포트)</caption><thead><tr><th scope="col">#</th>${th("name", "사업장")}${th("stage", "단계")}${th("score", "입지 점수")}${th("comp", "입지·진척 점수", 1)}${th("stn", "가장 가까운 역", 1)}${th("el", "초등학교·마트", 1)}${showCs ? th("consent", "동의율", 1) : ""}${showUn ? th("units", "계획 세대", 1) : ""}</tr></thead>`;
      let body;
      if (total) {
        body = list
          .map((r, i) => {
            const c = r.cs?.["조합설립"] || r.cs?.["추진위"];
            return `<tr data-id="${r.id}" tabindex="0" aria-label="${esc(r.n)} 리포트 열기"><td class="rn">${i + 1}</td><td class="nm"><b title="${esc(r.n)}">${esc(shortName(r.n))}</b><small>${esc(r.g)} ${esc(r.j)} · ${esc(r.k)}</small></td><td class="stc">${stagePill(r)}</td><td class="sc">${ptsBar(r)}<span class="mlab">입지</span><b>${r.score}</b></td><td class="n cm">${r.comp != null ? `<span class="mlab">입지·진척</span><span class="gb sm" title="투자 등급 아님"><b>${r.comp}</b></span>` : dash("자료 없음")}</td><td class="n stn">${esc(r.st.n)} ${fmt(r.st.d)}m</td><td class="n xo inf">${(() => {
              const i = infraOf(r);
              return i
                ? `<span${i.e.d <= 300 ? ' class="ok"' : ""}>초 ${kmTxt(i.e.d)}</span><span${i.mt.d <= 1e3 ? ' class="ok"' : ""}>마트 ${kmTxt(i.mt.d)}</span>`
                : "–";
            })()}</td>${showCs ? `<td class="n xo">${c ? c.v.toFixed(1) + "%" : dash(naReason("consent", r))}</td>` : ""}${showUn ? `<td class="n xo">${r.sm?.units ? fmt(r.sm.units) : dash(naReason("units", r))}</td>` : ""}</tr>`;
          })
          .join("");
      } else body = `<tr class="es-row"><td class="es-cell" colspan="${7 + showCs + showUn}">${rankEmpty(f)}</td></tr>`;
      setHTML($("rank"), cols + head + `<tbody>${body}</tbody>`);
      const nf = [f.g, f.k, f.s, f.af].filter(Boolean).length + RF.size;
      const moaK = f.k === "모아타운";
      const noLoc = (moaK ? MOA_ALL : POP).filter(
        (r) =>
          r.score == null &&
          (!f.g || r.g === f.g) &&
          (!f.k || KINDS.find((x) => x[0] === f.k)[1](r)) &&
          (!f.s || GROUPS.find((x) => x[0] === f.s)[1](r)),
      ).length;
      $("rankSub").innerHTML =
        `<b>${total > 60 ? `상위 60곳` : `${fmt(total)}곳`}</b>${total > 60 ? ` · 전체 ${fmt(total)}곳` : ""}${f.af ? ` · 현금 ${e2(CASH)}억 기준` : ""}${!total && nf ? ` · 조건 ${nf}개 적용` : ""}<span class="rs-note"> · ${[noLoc ? `위치 정보 없는 ${fmt(noLoc)}곳은 빼고 셌어요` : "", moaK ? "모아타운 관리지역만" : `모아타운 관리지역 ${fmt(MOA_ALL.length)}곳은 유형 '모아타운'에서`].filter(Boolean).join(" · ")}</span>`;
      $("rankPop").textContent =
        `모집단: 진행 중 사업장 ${fmt(POP.length)}곳 중 위치가 확인된 ${fmt(POP_LOC.length)}곳 (위치 미확인 ${fmt(POP.length - POP_LOC.length)}곳은 입지 점수가 없어 검색·계산기에서만 보여요)`;
      $("rAffordLab").textContent = `내 현금 ${e2(CASH)}억으로 되는 곳`;
      [
        ["rGu", "g"],
        ["rKind", "k"],
        ["rStage", "s"],
      ].forEach(([id, key]) => $(id).closest(".fsel").classList.toggle("on", !!f[key]));
      $("rReset").hidden = !(f.g || f.k || f.s || !f.af || RF.size) || !total;
      $("rInf")
        .querySelectorAll("[data-inf]")
        .forEach((b) => {
          b.setAttribute("aria-pressed", String(RF.has(b.dataset.inf)));
          b.textContent = b.textContent.replace(/ \d+곳$/, "");
        });
      if ($("locKey") && !$("locKey").innerHTML) $("locKey").innerHTML = locKeyHTML();
      $("rank")
        .querySelectorAll("th button")
        .forEach(
          (b) =>
            (b.onclick = () => {
              if (sortKey === b.dataset.k) sortDir *= -1;
              else {
                sortKey = b.dataset.k;
                sortDir = ["stn", "han", "name"].includes(sortKey) ? 1 : -1;
              }
              drawRank();
            }),
        );
      $("rank")
        .querySelectorAll("tbody tr[data-id]")
        .forEach((tr) => {
          tr.onclick = () => {
            curTab = "money";
            select(tr.dataset.id, true, true);
          };
          tr.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              tr.onclick();
            }
          };
        });
      $("rank")
        .querySelectorAll("[data-unset]")
        .forEach(
          (b) =>
            (b.onclick = () => {
              const u = b.dataset.unset;
              if (u === "all") {
                $("rGu").value = "";
                $("rKind").value = "";
                $("rStage").value = "";
                $("rAfford").checked = b.dataset.keepaf === "1";
                RF.clear();
              } else if (u === "inf") RF.clear();
              else if (u === "af") $("rAfford").checked = false;
              else if (u === "moa") {
                $("rKind").value = "가로·소규모";
              } else $({ g: "rGu", k: "rKind", s: "rStage" }[u]).value = "";
              drawRank();
            }),
        );
      markRankRow();
      refreshFades();
    }, "#rank tbody tr[data-id], #rankSub");
  }
  function rankEmpty(f) {
    const cash = `현금 ${e2(CASH)}억으로`,
      basisTxt = P.basis === "total" ? "입주까지" : "지금 매수";
    const where = f.g || "서울";
    const subj = `${f.s ? f.s + " 단계 " : ""}${f.k || "구역"}`;
    const title = f.af ? `${where}에서 ${cash} 되는 ${josa(subj, "이", "가")} 없어요` : `${where}에 ${josa(subj, "이", "가")} 없어요`;
    const LAB = {
      af: "내 현금 조건 끄고 보기",
      s: "모든 단계 보기",
      k: "모든 유형 보기",
      g: "서울 전체로 보기",
      inf: "생활 인프라 조건 풀기",
    };
    const acts = ["af", "inf", "s", "k", "g"]
      .filter((key) => (key === "inf" ? f.inf && f.inf.size : f[key]))
      .map((key) => ({ key, n: rankFilter({ ...f, [key]: key === "af" ? false : key === "inf" ? new Set() : "" }).length }))
      .filter((a) => a.n > 0);
    let desc = "";
    if (f.af && f.k === "모아타운") {
      const n = rankFilter({ ...f, k: "가로·소규모" }).length;
      desc =
        "모아타운 관리지역은 사업구역(블록)별로 계산이 달라 '내 현금' 조건에서 빠져요. 관리지역 안 개별 가로주택·소규모 조합으로 보세요.";
      return emptyState({
        icon: ICON.filter,
        title: "모아타운은 '내 현금' 조건과 함께 볼 수 없어요",
        desc,
        acts: [
          ...(n ? [{ label: "가로·소규모로 보기", n, attr: 'data-unset="moa"' }] : []),
          ...acts.map((a) => ({ label: LAB[a.key], n: a.n, attr: `data-unset="${a.key}"` })),
        ].map((a, i) => ({ ...a, primary: i === 0 })),
      });
    }
    if (f.af) {
      const pool = rankFilter({ ...f, af: false });
      if (pool.length) {
        const xs = pool.map((r) => XOF.get(r.id)).filter(Boolean);
        const ch = !f.g && !f.k && !f.s ? CHEAP : cheapestOf(xs, (x) => NEED.get(x.r.id));
        const nNo = pool.filter((r) => restricted(r) || r.dn).length,
          nNa = pool.filter((r) => !restricted(r) && !r.dn && NEED.get(r.id) == null).length,
          nCash = pool.length - nNo - nNa;
        const why = [
          nNo ? `입주권 없음 ${fmt(nNo)}곳` : "",
          nCash ? `현금 부족 ${fmt(nCash)}곳` : "",
          nNa ? `가격·입주 시점 미정 ${fmt(nNa)}곳` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        desc =
          `${where}의 위치가 확인된 진행 중 ${josa(subj, "은", "는")} ${fmt(pool.length)}곳이지만 ${cash} ${basisTxt} 가능한 곳은 없어요 (${why}).` +
          (ch ? " " + cheapSentence(ch, NEED.get(ch.r.id), basisTxt === "입주까지" ? "입주까지" : "지금") : "");
      }
    }
    if (!desc)
      desc = `적용한 조건: ${[f.g || "서울 전체", f.k || "모든 유형", f.s ? f.s + " 단계" : "진행 중 전체", f.af ? `내 현금 ${e2(CASH)}억` : null].filter(Boolean).join(" · ")}`;
    if (!acts.length) {
      const all = rankFilter({ af: false, inf: new Set() }).length;
      return emptyState({
        title: "이 조건에 맞는 구역이 없어요",
        desc,
        acts: [{ label: "필터 모두 풀기", n: all, attr: 'data-unset="all" data-keepaf="0"', primary: true }],
      });
    }
    const nf2 = [f.g, f.k, f.s, f.af].filter(Boolean).length;
    const allA =
      nf2 >= 2
        ? [{ label: "필터 모두 풀기", n: rankFilter({ af: false, inf: new Set() }).length, attr: 'data-unset="all" data-keepaf="0"' }]
        : [];
    return emptyState({
      icon: f.af ? ICON.wallet : ICON.filter,
      title,
      desc,
      acts: [...acts.map((a) => ({ label: LAB[a.key], n: a.n, attr: `data-unset="${a.key}"` })), ...allA].map((a, i) => ({
        ...a,
        primary: i === 0,
      })),
    });
  }
  ["rGu", "rKind", "rStage", "rAfford"].forEach((id) => ($(id).onchange = drawRank));
  $("rReset").onclick = () => {
    $("rGu").value = "";
    $("rKind").value = "";
    $("rStage").value = "";
    $("rAfford").checked = true;
    RF.clear();
    drawRank();
  };
  $("rInf")
    .querySelectorAll("[data-inf]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.dataset.inf;
          RF.has(k) ? RF.delete(k) : RF.add(k);
          drawRank(true);
        }),
    );
  let guAll = false;
  function drawGu() {
    keepFocus(() => {
      const rows = GUS.map((g) => {
        const l = POP.filter((r) => r.g === g);
        return [g, l.length, [1, 2, 3, 4, 5, 6].map((i) => l.filter((r) => st6(r) === i).length)];
      })
        .filter((r) => r[1])
        .sort((a, b) => b[1] - a[1]);
      const mx = rows[0][1];
      $("guLegend").innerHTML = [1, 2, 3, 4, 5, 6]
        .map((i) => `<span class="lg"><i style="background:${STCOL(i)}"></i>${ST_LAB[i]}</span>`)
        .join("");
      const topN = matchMedia("(min-width:981px)").matches ? 16 : 10,
        shown = guAll ? rows : rows.slice(0, topN);
      $("gubars").innerHTML =
        shown
          .map(
            ([g, n, parts]) =>
              `<button type="button" class="gub" data-gu="${g}" aria-label="${g} ${n}곳 (${parts.map((v, i) => `${ST_LAB[i + 1]} ${v}`).join(", ")}) · 지도에서 보기"><span>${g}</span><span class="st" style="width:${(n / mx) * 100}%">${parts.map((v, i) => (v ? `<i style="flex:${v};background:${STCOL(i + 1)}" title="${ST_LAB[i + 1]} ${v}곳"></i>` : "")).join("")}</span><b>${n}</b></button>`,
          )
          .join("") +
        `<button type="button" class="btn text sm gu-more" id="guMore" aria-expanded="${guAll}">${guAll ? `상위 ${topN}개만 보기` : `전체 ${rows.length}개 구 보기`}</button>`;
      $("guMore").onclick = () => {
        guAll = !guAll;
        drawGu();
      };
      $("gubars")
        .querySelectorAll(".gub")
        .forEach(
          (b) =>
            (b.onclick = () => {
              enterGu(b.dataset.gu, { hist: true });
              $("rGu").value = b.dataset.gu;
              drawRank();
              window.scrollTo({ top: $("mapbox").getBoundingClientRect().top + window.scrollY - HDR() - 16, behavior: smooth() });
            }),
        );
      $("popNote").textContent =
        `모집단: 진행 중 사업장 ${fmt(POP.length)}곳(해제·준공 이후 제외) · 모아타운 관리지역 ${fmt(MOA_ALL.length)}곳은 사업구역 묶음이라 별도 · 지도·입지 점수는 위치가 확인된 ${fmt(POP_LOC.length)}곳 기준(위치 미확인 ${fmt(POP.length - POP_LOC.length)}곳은 목록·검색에서만)`;
    });
  }
  function drawDur() {
    const T = TR.large || {};
    const labels = {
      "구역지정>조합설립": "구역지정 → 조합설립",
      "추진위>조합설립": "추진위 → 조합설립",
      "조합설립>사업시행": "조합설립 → 사업시행인가",
      "사업시행>관리처분": "사업시행 → 관리처분인가",
      "관리처분>착공": "관리처분 → 착공",
      "착공>준공": "착공 → 준공",
    };
    const keys = Object.keys(labels).filter((k) => T[k]?.med);
    const mx = Math.max(...keys.map((k) => T[k].med), 1);
    $("durs").innerHTML = `<ul class="dur">${keys
      .map((k) => {
        const s = T[k];
        return `<li><div class="dl"><span>${labels[k]}<small>완료 ${s.nEv}곳 · 진행 중(중도절단) ${s.nCen}곳 · 5년 안 도달 ${Math.round((1 - s.S5) * 100)}%</small></span></div><div class="db"><i style="width:calc((100% - 56px) * ${(s.med / mx).toFixed(3)})"></i><b>${s.med.toFixed(1)}년</b></div></li>`;
      })
      .join(
        "",
      )}</ul>\n    <p class="note">단계별 가운데 값입니다. 구역마다 현재 단계에서 이미 흐른 기간을 반영해 남은 기간을 따로 뽑기 때문에, 이 가운데 값을 그냥 더한 값과 리포트의 예상 입주는 다를 수 있어요. 대규모 재개발·재건축 기준이며, 해제 구역이 자료에 없어 실제보다 조금 빠르게 나올 수 있어요.</p>`;
    const m = D.etaMeta || {};
    $("method").innerHTML =
      `<summary>방법 보기</summary><div class="method-in"><p>${esc(m.method || "")}</p><ul>\n    <li>카플란–마이어(KM) 생존분석: 아직 다음 단계에 도달하지 않은 구역은 '${esc(m.asOf || D.asOf)}까지 미도달(중도절단)'로 반영</li>\n    <li>몬테카를로 ${fmt(m.draws || 4e3)}회 (seed ${esc(m.seed || "")}) · 전이마다 사건 ${fmt(m.minEvents || 15)}건 미만이면 대규모 표본 값을 빌려 씀</li>\n    <li>'예상 입주'는 <b>준공되는 경우의 가운데 값</b>(조건부)이고, '10년 안 준공 가능성'은 준공하지 못하는 경우까지 포함한 확률이에요. 그래서 확률이 낮아도 예상 입주 날짜가 표시될 수 있어요.</li>\n    <li>가로주택·소규모: 표본이 적어 조합설립→사업시행 외 구간은 대규모 값을 빌려 쓰고, 사업시행인가에 관리처분이 포함되는 점을 반영해 '사업시행→관리처분' 대기(${DUP.toFixed(1)}년)를 빼고 근사 보정 (${fmt(ETA_ADJ)}곳)</li>\n  </ul></div>`;
  }
  function ruleVal(v) {
    const t = String(v);
    const parts =
      t.length > 34
        ? t
            .split(/\s\/\s|\.\s(?=\S)/)
            .map((x) => x.trim())
            .filter(Boolean)
        : [t];
    return parts.length > 1 ? `<ul>${parts.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : esc(t);
  }
  const fixEff = (s) =>
    String(s || "")
      .replace(/\(2026년 9월 국회 제출 예정, 미시행\)/, "(2026.9.18 도시정비법 개정안 발의 · 국회 계류, 미시행)")
      .replace(/2025\.11 보도상 2025\.10\.16 소급 적용/, "2025.10.16부터 적용(보도 기준 · 개정 조문 미확인)");
  const OFFICIAL = /(\.go\.kr|law\.go\.kr|korea\.kr)(\/|$)/;
  const SRC_DROP = /tossbank\.com|supple\.kr/;
  const srcLinks = (arr) =>
    (arr || [])
      .filter((s) => !SRC_DROP.test(s.url))
      .sort((a, b) => OFFICIAL.test(b.url) - OFFICIAL.test(a.url))
      .slice(0, 4)
      .map(
        (s) =>
          `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>${OFFICIAL.test(s.url) ? "" : ' <small class="sec2">2차 자료</small>'}`,
      )
      .join("<br>");
  function ruleCard(o) {
    return `<article class="panel rule${o.cls ? " " + o.cls : ""}"><h3>${o.title}</h3>${o.lead ? `<ul class="rule-lead">${o.lead.map((l) => `<li>${l}</li>`).join("")}</ul>` : ""}<details class="rule-more"><summary>자세히 보기 · 예외·근거</summary>${o.dl && o.dl.length ? `<dl>${o.dl.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>` : ""}${o.body || ""}<details class="src"><summary>시행일·근거</summary>${o.eff ? `<p>${esc(o.eff)}</p>` : ""}${o.full ? `<p class="rule-full">${esc(o.full)}</p>` : ""}<p>${srcLinks(o.src)}</p></details></details></article>`;
  }
  function drawRules() {
    const tr = ruleById("transfer-restriction"),
      fin = (id) => (D.fin || []).find((x) => x.id === id);
    const buyer = [];
    if (tr)
      buyer.push(
        ruleCard({
          title: "투기과열지구 조합원 지위양도 제한",
          lead: [
            "<b>재건축</b>: 조합설립인가(신탁은 사업시행자 지정) 뒤 매수 → 조합원 불가 (도시정비법 §39②)",
            "<b>재개발</b>: 관리처분계획인가 뒤 매수 → 조합원 불가 · 2018.1.24 이후 최초 사업시행인가 신청 구역부터 (구법 부칙)",
            "<b>가로·소규모·모아주택</b>: 조합설립인가 뒤 매수 → 조합원 불가 (소규모주택정비법 §24②)",
            "<b>효력</b>: 서울 전역 투기과열지구 2025.10.16~ (강남·서초·송파·용산은 2017.8.3부터 연속 지정)",
          ],
          dl: [
            ["매도인 예외", "1세대1주택 <b>매도인</b>이 10년 보유 + 5년 거주 (매수자 요건이 아님)"],
            ["사업 지연 예외", "조합설립 후 3년 넘게 사업시행인가 신청이 없는 경우 등 + 매도인 3년 이상 보유"],
            ["지정 전 계약", "지정일부터 60일 이내 거래신고한 경우"],
          ],
          eff: fixEff(tr.effective),
          full: tr.rule,
          src: tr.sources,
        }),
      );
    buyer.push(
      ruleCard({
        title: "재당첨 제한",
        lead: [
          "투기과열지구에서 정비사업 분양대상자로 선정된 세대(세대원 포함)는 선정일부터 <b>5년</b> 동안 투기과열지구의 다른 정비사업 분양신청을 할 수 없어요.",
          "최근 분양대상자로 선정된 적이 있다면 계산기 조건의 '고급 가정 → 최근 분양대상자 선정 연도'에 넣으면 해당 구역을 걸러 줍니다.",
        ],
        eff: "도시 및 주거환경정비법 제72조제6항 (현행)",
        src: [{ title: "도시 및 주거환경정비법 제72조", url: "https://www.law.go.kr/법령/도시및주거환경정비법" }],
      }),
    );
    buyer.push(
      ruleCard({
        title: "무주택자가 매수하기 전에",
        lead: [
          "정비구역 빌라·입주권을 사면 <b>주택 소유 이력</b>이 생겨 청약 무주택 자격(신혼부부·생애최초 특별공급 등)을 잃어요.",
          "<b>생애최초 LTV 70%</b>는 최초 주택 구입 때 한 번 받는 혜택이고 6개월 안에 전입해야 해요. 입주 때 잔금대출은 일반 40%로 계산합니다.",
          "아파트(같은 단지 연립·다세대 포함)는 토지거래허가 대상이라 <b>2년 실거주</b> 의무가 있어요 (2025.10.20~2026.12.31, 재지정 여부 확인).",
        ],
        eff: "LTV: 10·15 대책(2025.10.16) · 토지거래허가: 2025.10.20~2026.12.31",
        src: [
          ...(fin("ltv-seoul")?.sources || []).slice(0, 2),
          { title: "정책브리핑: 서울 전역 토지거래허가구역 지정", url: D.policy?.landPermit?.src || "https://www.korea.kr" },
        ],
      }),
    );
    const FINC = [
      [
        "ltv-seoul",
        "대출 한도 · LTV (서울 규제지역)",
        [
          "무주택·처분조건부 1주택 <b>40%</b>, 생애최초 <b>70%</b>(6개월 내 전입), 1주택 유지·다주택 <b>0%</b>",
          "시가 15억 이하 6억 · 25억 이하 4억 · 25억 초과 2억 한도",
          "2025.10.15 이전 관리처분인가 구역 조합원 잔금대출은 종전 규정(경과조치)",
        ],
      ],
      [
        "dsr",
        "DSR · 스트레스 금리",
        [
          "은행 DSR 40% (총대출 1억 초과 차주)",
          "수도권·규제지역 주담대 스트레스 금리 하한 3%p",
          "이주비·중도금은 DSR 제외, 잔금대출은 DSR 적용",
          "계산기 가정: 30년 원리금균등 · 기존 대출 없음 · 실제 금리 + 3%p",
        ],
      ],
      [
        "acq-tax-house",
        "주택 취득세 (서울 전역 조정대상지역)",
        [
          "1주택: 6억 이하 1% · 6~9억 1~3% · 9억 초과 3% (+지방교육세)",
          "<b>2주택(1주택 유지) 8%</b> · 3주택 이상 12% (+지방교육세 0.4%)",
          "일시적 2주택(종전 주택 처분 기한 내)은 1주택 세율 · 기한을 넘기면 중과 추징",
          "멸실 후 입주권 매수는 토지 4.6%, 준공 때 원시취득세 2.96%(85㎡ 초과 3.16%)",
        ],
      ],
      [
        "transfer-tax",
        "양도세 (1주택 유지·다주택 주의)",
        [
          "1세대1주택 비과세 12억 이하 · 조정대상지역 취득분은 2년 거주",
          "조정대상지역 다주택 중과(2주택 +20%p, 3주택 +30%p) 2026.5.10 양도분부터 재적용",
          "계산기는 양도세·보유세(재산세·종부세)를 반영하지 않아요",
        ],
      ],
      [
        "relocation-loan",
        "이주비 대출",
        [
          "10·15 가격구간 한도 축소는 이주비·중도금 대출에 미적용",
          "2026.8.31부터 담보가치를 종전·종후 자산 중 큰 금액으로 인정(8·13 대책)",
          "다주택 조합원은 LTV 0%로 사실상 불가",
        ],
      ],
    ];
    FINC.forEach(([id, title, lead]) => {
      const x = fin(id);
      if (x) buyer.push(ruleCard({ title, lead, eff: x.effective, full: x.rule, src: x.sources }));
    });
    const biz = (D.rules || [])
      .filter((x) => x.id !== "transfer-restriction")
      .map((x) =>
        ruleCard({
          title: esc(x.topic),
          dl: Object.entries(x.numbers || {})
            .slice(0, 5)
            .map(([k, v]) => [k.replaceAll("_", " "), ruleVal(v)]),
          eff: fixEff(x.effective),
          src: x.sources,
        }),
      );
    $("rules").innerHTML =
      `<h3 class="rules-g">매수 전에 확인할 것 <small>지위양도·재당첨·대출·세금</small></h3><div class="rules-col">${buyer.join("")}</div><h3 class="rules-g">사업 진행 요건 <small>구역지정·동의율·모아타운</small></h3><div class="rules-col">${biz.join("")}</div>`;
    markNewWin($("rules"));
    drawSources();
  }
  const SRC_PLUS = {
    "https://edaily.co.kr/News/Read?mediaCodeNo=257&newsId=02686326642235504": {
      t: "이데일리 · 대치미도 정비구역 지정 고시…강남구, 조합설립 지원 본격화 (2025.7.17)",
    },
    "https://www.theguru.co.kr/news/article.html?no=103885": { t: "더구루 · 은마 사업시행인가 (2026.7.2)" },
    "https://m.ekn.kr/view.php?key=20260701024477940": { t: "에너지경제 · 잠실주공5단지 사업시행인가 결재 (2026.7.1)" },
    "https://www.arunews.com/news/articleView.html?idxno=67116": { t: "한국주택경제 · 자양4동 A구역, 재개발조합설립인가 (2026.9.11)" },
    "https://www.hankyung.com/article/2026091313011": { t: "한국경제 · 추진위 건너뛰고…8개월 만에 조합 설립한 자양4동 (2026.9.14)" },
    "https://cleanup.seoul.go.kr/cleanup/bsnssttus/lscrMainIndx.do": { d: `수집 ${ASOF}` },
    "https://cleanup.seoul.go.kr/cleanup/view/moaTown.do": { d: "수집 2026.9" },
    "https://urban.seoul.go.kr": { d: "수집 2026.9" },
    "https://www.law.go.kr": { d: "현행본 확인 2026.9" },
    "https://gist.github.com/jhj0517/9bd253175c4410493af024d5e0a1c01f": { d: "수집 2026.9", g: "etc" },
    "https://news.seoul.go.kr/citybuild/archives/531417": { g: "press", t: "서울시 보도자료 · 광진구 자양동 227-147 일대 재개발" },
  };
  const SRC_ADD = [
    {
      g: "pub",
      t: "국토교통부 실거래가(서울 부동산정보광장 연계) · 연립다세대·아파트 매매",
      d: "계약일 2025.10.1~2026.9.26",
      u: "https://land.seoul.go.kr/land/rtms/rtmsMultiHouse.do",
    },
    {
      g: "pub",
      t: "개별공시지가 · 서울 도시계획포털 연속지적도(필지별 공시지가)",
      d: "수집 2026.9 · 기준연도 원천 미표기, 공시가격알리미에서 확인 가능",
      u: "https://www.realtyprice.kr",
    },
    {
      g: "pub",
      t: "지도: 통계청(KOSTAT) 행정구역 경계 · 서울 자치구(2013, southkorea/seoul-maps 배포본)",
      d: "경계 단순화·좌표계 보정",
      u: "https://github.com/southkorea/seoul-maps",
    },
    {
      g: "etc",
      t: "지도: 한강 수면 © OpenStreetMap contributors (ODbL)",
      d: "OSM relation 152336 · 서울 경계로 자름",
      u: "https://www.openstreetmap.org/copyright",
    },
    {
      g: "etc",
      t: "누락 역 좌표 보완(천왕·온수·오류동·개봉·사당 등 14개 역) · 위키백과 역 문서 좌표",
      d: "확인 2026.9",
      u: "https://en.wikipedia.org/wiki/Cheonwang_station",
    },
    {
      g: "etc",
      t: "누락 역 좌표 교차 확인 · gaussian37 「수도권 지하철 좌표」",
      d: "확인 2026.9",
      u: "https://gaussian37.github.io/python-etc-%EC%88%98%EB%8F%84%EA%B6%8C-%EC%A7%80%ED%95%98%EC%B2%A0/",
    },
  ];
  function drawSources() {
    const items = D.sources
      .map((s) => {
        const o = SRC_PLUS[s.u] || {};
        return { u: s.u, t: o.t || s.t, d: o.d || "", g: o.g || (/\.go\.kr/.test(s.u) ? "pub" : "press") };
      })
      .concat(SRC_ADD);
    const li = (s) =>
      `<li><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>${s.d ? `<small>${esc(s.d)}</small>` : ""}</li>`;
    const pub = items
      .filter((s) => s.g === "pub")
      .sort(
        (a, b) => (a.t.startsWith("국토") || a.t.startsWith("개별") ? -1 : 0) - (b.t.startsWith("국토") || b.t.startsWith("개별") ? -1 : 0),
      );
    const etc = items.filter((s) => s.g === "etc"),
      press = items.filter((s) => s.g === "press");
    $("srcPub").innerHTML = pub.map(li).join("");
    $("srcPubH").textContent = `공공 데이터 ${pub.length}건`;
    $("srcEtc").innerHTML = etc.map(li).join("");
    $("srcEtcH").textContent = `기타 공개 자료 ${etc.length}건`;
    $("srcPress").innerHTML = press.map(li).join("");
    $("pressSum").textContent = `언론·보도자료 ${press.length}건 보기 (구역별 최신 소식 근거)`;
    $("footAsof").textContent = window.ZP_fresh || "";
    markNewWin(document.querySelector(".site-foot"));
  }
  $("pGu").innerHTML = '<option value="">서울 전체</option>' + GUS.map((g) => `<option>${g}</option>`).join("");
  const P = { homes: 0, first: 0, unit: 84, kind: "", basis: "total", sort: "total", est: false };
  const OV = {};
  function parseKMoney(t) {
    t = String(t ?? "").replace(/[,\s원]/g, "");
    if (!t) return null;
    if (/^\d+(\.\d+)?$/.test(t)) return +t;
    let m,
      total = 0,
      rest = t;
    if ((m = rest.match(/^(\d+(?:\.\d+)?)억(.*)$/))) {
      total += +m[1] * 1e4;
      rest = m[2];
    }
    if ((m = rest.match(/^(\d+(?:\.\d+)?)천(.*)$/))) {
      total += +m[1] * 1e3;
      rest = m[2];
    }
    if ((m = rest.match(/^(\d+(?:\.\d+)?)백(.*)$/))) {
      total += +m[1] * 100;
      rest = m[2];
    }
    if ((m = rest.match(/^(\d+(?:\.\d+)?)만?$/))) {
      total += +m[1];
      rest = "";
    } else if (rest === "만") rest = "";
    return rest === "" && total > 0 ? total : NaN;
  }
  const AV = {};
  const AV_IDS = ["aUnit", "aRatio", "aRate", "pIncome", "pRewin", "aGrowth"];
  function readAV() {
    AV_IDS.forEach((id) => {
      const raw = $(id).value;
      if (id === "pIncome") {
        const v = parseKMoney(raw);
        AV[id] = v == null || isNaN(v) ? null : v;
        AV.incomeBad = v != null && isNaN(v);
      } else {
        const v = parseFloat(String(raw).replace(/,/g, ""));
        AV[id] = isFinite(v) ? v : null;
      }
    });
  }
  const num = (id) => AV[id] ?? null;
  const e2 = ZF.num;   // 억 금액 숫자 꼴은 ZF.num 하나(05_facts.js · 1억 아래 소수 둘째 자리)
  const sg = (x) => (Math.abs(x) < 0.05 ? "0" : (x >= 0 ? "+" : "−") + e2(Math.abs(x)));
  const pc = (x) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(1) + "%";
  const DEP = 0.03;
  const pcIrr = (x) => (x < DEP && Math.abs(x - DEP) < 6e-4 ? "+" + (Math.floor(x * 1e3) / 10).toFixed(1) + "%" : pc(x));
  const CONS_YRS = 15;
  const bandCap = (p) => (p <= 15 ? 6 : p <= 25 ? 4 : 2);
  function acqRate(p, land, big) {
    if (land) return 0.046;
    if (P.homes === 2) return big ? 0.134 : 0.124;
    if (P.homes === 3) return big ? 0.09 : 0.084;
    const base = p <= 6 ? 0.01 : p <= 9 ? ((p * 2) / 3 - 3) / 100 : 0.03;
    return base * 1.1 + (big ? 0.002 : 0);
  }
  const monthlyPay = () => {
    const r = ((num("aRate") ?? 4.5) + 3) / 100 / 12,
      n = 360;
    return r / (1 - Math.pow(1 + r, -n));
  };
  function dsrCap() {
    const inc = num("pIncome");
    if (inc == null) return Infinity;
    if (inc <= 0) return 0;
    return ((inc / 1e4) * 0.4) / 12 / monthlyPay();
  }
  const incomeFor = (loan) => (loan * monthlyPay() * 12) / 0.4;
  function ltvBuy() {
    return P.homes === 2 || P.homes === 3 ? 0 : P.first && P.homes === 0 ? 0.7 : 0.4;
  }
  function ltvEnd() {
    return P.homes === 2 || P.homes === 3 ? 0 : 0.4;
  }
  function loanOn(collateral, price) {
    return Math.max(0, Math.min(collateral * ltvBuy(), bandCap(price), dsrCap()));
  }
  function maxBuy(cash) {
    let lo = 0,
      hi = 200;
    for (let k = 0; k < 50; k++) {
      const m = (lo + hi) / 2;
      if (m + m * acqRate(m, false, false) - loanOn(m, m) <= cash) lo = m;
      else hi = m;
    }
    return lo;
  }
  function etaYears(r) {
    const e = r.eta;
    if (!e || !e.eMid) return null;
    const [y, m] = e.eMid.split("-").map(Number);
    return Math.max(0.5, y + (m - 0.5) / 12 - (TODAY.getFullYear() + (TODAY.getMonth() + (TODAY.getDate() - 0.5) / 30.44) / 12));
  }
  function unitRatio(nv) {
    const u = num("aUnit");
    if (u != null) return u / 100;
    return Math.min(0.75, Math.max(0.42, 0.75 * Math.pow(12 / nv, 0.35)));
  }
  const REQ = " 분양대상 요건·권리산정기준일·재당첨 제한을 충족해야 해요.";
  function buyWindow(r) {
    const ex = " 예외: 매도인이 10년 보유·5년 거주한 1세대1주택 매물 등.";
    if (r.src === "moa") {
      const ks = (r.kids || []).map((id) => byId[id]),
        done = ks.filter((k) => k.s >= 4);
      if (done.length)
        return {
          cls: "warn",
          t: "사업구역별로 다름",
          due: `설립인가 조합 ${done.length}곳 구역 매물은 조합원 불가`,
          d: `등록된 조합 ${done.length}곳은 설립인가 후라 해당 사업구역 매물은 조합원 불가(소규모주택정비법 §24②). 그 밖의 블록은 관리계획상 사업구역 포함 여부와 권리산정기준일을 구청에 확인하세요.`,
        };
      return {
        cls: "ok",
        t: "입주권 가능",
        due: "모아주택 조합설립 전 매수",
        d:
          "모아주택 조합설립인가 전 매수·등기 시 조합원 자격 취득. 관리계획상 사업구역에 포함되는지, 권리산정기준일 이후 신축·쪼개기 매물이 아닌지 확인하세요." +
          REQ,
      };
    }
    if (isRedev(r)) {
      if (r.s >= 6) {
        if (r.b18)
          return {
            cls: "ok",
            t: "입주권 가능",
            due: "2018년 전 사업시행 구역",
            b18: r.b18,
            d:
              `사업시행인가(${r.b18})가 2018.1.24 이전이라 관리처분인가 뒤 지위양도 제한(도시정비법 제39조②) 미적용.${r.s >= 7 ? " 멸실 뒤에는 토지 취득세 4.6%." : ""}` +
              REQ,
          };
        if (r.b18p)
          return {
            cls: "chk",
            t: "입주권 여부 자료 부족",
            due: "법률 검토 필요",
            d: `사업시행인가 신청(${r.b18p})은 2018.1.24 이전, 인가는 이후. 부칙 적용 여부는 법률 검토 대상.`,
          };
        return {
          cls: "no",
          t: "입주권 없음",
          due: "관리처분인가 이후 매수분",
          d: "관리처분계획인가 뒤 매수자는 조합원 불가(현금청산)." + ex,
        };
      }
      if (r.b18)
        return {
          cls: "ok",
          t: "입주권 가능",
          due: "2018년 전 사업시행 구역 · 관리처분인가 뒤에도 지위양도 가능",
          b18: r.b18,
          d: `사업시행인가(${r.b18})가 2018.1.24 이전이라 관리처분인가 뒤 지위양도 제한(도시정비법 제39조②)이 적용되지 않아요(부칙).` + REQ,
        };
      if (r.b18p && r.s === 5)
        return {
          cls: "ok",
          t: "입주권 가능",
          due: "관리처분인가 전 매수 · 다음 단계부터는 법률 검토 필요",
          near: true,
          d: `사업시행인가 신청(${r.b18p})은 2018.1.24 이전, 인가는 이후라 관리처분인가 뒤 부칙 적용 여부는 법률 검토 대상.` + REQ,
        };
      return {
        cls: "ok",
        t: "입주권 가능",
        due: r.s === 5 ? "관리처분인가 전 매수 · 다음 단계부터 매수자 입주권 없음" : "관리처분인가 전 매수",
        near: r.s === 5,
        d: "관리처분계획인가 전 매수·등기 시 조합원 자격 취득. 권리산정기준일 이후 분할 지분은 제외." + REQ,
      };
    }
    if (isRebuild(r) || isSmall(r)) {
      const lab = r.trust ? "사업시행자 지정" : "조합설립인가";
      const law = isSmall(r) ? "소규모주택정비법 제24조" : "도시정비법 제39조②";
      if (r.s >= 5) return { cls: "no", t: "입주권 없음", due: `${lab} 이후 매수분`, d: `${lab} 뒤 매수자는 조합원 불가(${law}).` + ex };
      if (r.s === 4) {
        if (!((r.dt || {})["조합설립"] || r.u4) && r.chk)
          return {
            cls: "chk",
            t: "조합설립 자료 없음",
            due: "인가 여부 미확인",
            d: "공식 목록은 조합설립 단계지만 인가일 기록이 없어 판정 보류. 인가됐다면 새로 산 사람은 조합원 불가.",
          };
        return { cls: "no", t: "입주권 없음", due: `${lab} 이후 매수분`, d: `${lab} 뒤 매수자는 조합원 불가(${law}).` + ex };
      }
      return {
        cls: "ok",
        t: "입주권 가능",
        due: `${lab} 전 매수${r.s === 3 || r.uc ? ` · 다음 단계(${lab})부터 매수자 입주권 없음` : ""}`,
        near: r.s === 3 || !!r.uc,
        d: `${lab} 전 매수·등기 시 조합원 자격 취득.` + REQ,
      };
    }
    return { cls: "ok", t: "입주권 가능", due: "", d: REQ.trim() };
  }
  const restricted = (r) => {
    const c = buyWindow(r).cls;
    return c === "no" || c === "chk";
  };
  const LP_UNTIL = (D.policy?.landPermit?.until || "2026-12-31").replaceAll("-", ".");
  function landPermit(r) {
    if (r.mk?.entry?.src === "complex" || (r.k === "재건축" && r.mk?.entry?.src !== "villa"))
      return {
        t: "토지거래허가 · 2년 실거주",
        d: `서울 아파트(같은 단지 연립·다세대 포함)는 토지거래허가구역(2025.10.20~${LP_UNTIL}, 재지정 여부 확인). 2년 실거주 의무로 전세 낀 매수 불가.`,
      };
    if (isRedev(r) && (r.pg || []).some((p) => p.startsWith("신속통합기획")))
      return {
        t: "토지거래허가 가능성 · 신속통합기획",
        d: "신속통합기획 재개발 후보지·선정지는 사업구역 전체(전 지목)를 토지거래허가구역으로 지정하는 사례가 많음(2026.5 18곳 등). 지정 여부와 기간은 구청 확인.",
      };
    return null;
  }
  function irr(flows) {
    const npv = (r) => flows.reduce((s, [t, c]) => s + c / Math.pow(1 + r, t), 0);
    let lo = -0.5,
      hi = 1.5;
    if (npv(lo) * npv(hi) > 0) return null;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if (npv(lo) * npv(m) <= 0) hi = m;
      else lo = m;
    }
    return (lo + hi) / 2;
  }
  function nvThin(mk) {
    const a = mk.new84,
      b = mk.new59;
    if (P.unit === 59) {
      const ref = b || a;
      return !ref || ref.n < 10;
    }
    return !a || a.n < 10 || (!!b && b.med > a.med);
  }
  function invest(r) {
    const mk = r.mk || {},
      en = mk.entry,
      o = OV[r.id] || {},
      sm = r.sm || {};
    const x = { r, ok: false };
    const land = r.s >= 7;
    const cx = en && en.src === "complex";
    const stale = r.s >= 7 || (r.s >= 6 && !!r.b18);
    const villaForApt = r.k === "재건축" && en && en.src === "villa";
    const price = o.price ?? (en && !stale && !villaForApt ? en.med / 1e4 : null);
    x.price = price;
    x.priceSrc = o.price != null ? "user" : price != null ? en.src : null;
    x.stale = stale && o.price == null;
    x.noApt = villaForApt && o.price == null;
    x.yrs = etaYears(r);
    if (price == null) return x;
    const area = en?.area_med || (cx ? 84 : 40);
    const big = area > 85;
    x.big = big;
    const ref = P.unit === 59 ? mk.new59 || mk.new84 : mk.new84;
    let nv = o.nv ?? (ref ? ref.med / 1e4 : null),
      unitArea = P.unit;
    if (o.nv == null && ref && nvThin(mk)) {
      nv = null;
      x.nvThin = true;
    }
    if (nv != null && o.nv == null && cx && area >= 100 && mk.new84) {
      nv = (mk.new84.med / 1e4 / 84) * area;
      unitArea = Math.round(area);
      x.same = true;
    }
    if (o.nv == null && cx && nv != null) {
      const oldAt = (price / area) * unitArea;
      if (nv < oldAt * 1.05) {
        nv = oldAt * 1.15;
        x.nvFix = true;
      }
    }
    x.nv = nv;
    x.unitArea = unitArea;
    x.ref = ref;
    let appr, apprWhy;
    if (o.appr != null) {
      appr = o.appr;
      apprWhy = "직접 입력";
    } else if (cx) {
      const owners = sm.owners || sm.members || (sm.units ? sm.units / 1.25 : null);
      const L = o.land ?? (sm.area && owners ? Math.round(((sm.area * 0.8) / owners) * 10) / 10 : null);
      if (L && L >= 5 && L <= 300 && r.jg) {
        x.land = L;
        appr = Math.min(price * 0.75, (L * r.jg * 1.35) / 1e8 + 0.2);
        apprWhy = `세대당 대지지분 약 ${L}㎡(구역 면적 × 80% ÷ 소유자 수) × 공시지가 ㎡당 ${fmt(r.jg / 1e4)}만원 × 1.35 + 건물 0.2억 (시세의 75% 상한)`;
      } else {
        appr = price * 0.65;
        apprWhy = "대지지분 자료 없음 · 시세의 65%";
        x.weak = true;
      }
    } else if (r.jg) {
      const L = o.land ?? Math.round(area * 0.55 * 10) / 10;
      x.land = L;
      appr = Math.min(price * 0.95, (L * r.jg * 1.4) / 1e8 + 0.2);
      x.landDef = o.land == null;
      apprWhy = `대지지분 ${L}㎡${o.land == null ? " (가정값 · 입력으로 수정)" : ""} × ${r.jgf ? "같은 동 사업장" : "주변"} 공시지가 ㎡당 ${fmt(r.jg / 1e4)}만원 × 1.4 + 건물 0.2억 (매수가의 95% 상한)`;
    } else {
      appr = price * 0.5;
      apprWhy = "공시지가 자료 없음 · 매수가의 50%";
      x.weak = true;
    }
    const ratio = (num("aRatio") ?? 100) / 100;
    x.appr = appr;
    x.apprWhy = apprWhy;
    x.ratio = ratio;
    x.right = appr * ratio;
    x.prem = price - x.right;
    x.tax = price * acqRate(price, land, big);
    x.land0 = land;
    x.loanCap = land ? 0 : loanOn(cx ? price : Math.min(price, appr * 1.2), price);
    x.loanNow = x.loanCap;
    x.needNow = x.needBuy = price + x.tax - x.loanCap;
    if (nv == null) return x;
    const g = (num("aGrowth") ?? 0) / 100,
      yrs = x.yrs;
    x.nvEnd = nv * Math.pow(1 + g, yrs || 0);
    const floor = (unitArea >= 80 ? 7 : 5.2) * (x.same ? unitArea / 84 : 1);
    x.floor = floor;
    x.unitPrice = o.unitPrice ?? Math.max(nv * unitRatio(nv), floor);
    x.contrib = x.unitPrice - x.right;
    x.origTax = Math.max(x.contrib, x.unitPrice * 0.35) * (unitArea > 85 ? 0.0316 : 0.0296);
    const rate = (num("aRate") ?? 4.5) / 100;
    const iy = rate * (yrs || CONS_YRS);
    x.consYrs = !yrs;
    x.midInt = x.contrib > 0 ? x.contrib * 0.6 * rate * 2 : 0;
    x.loanEnd = Math.max(0, Math.min(x.nvEnd * ltvEnd(), bandCap(x.nvEnd), dsrCap()));
    const A = price + x.tax,
      B = A + x.contrib + x.origTax + x.midInt - x.loanEnd;
    x.loanNow = Math.max(0, Math.min(x.loanCap, (A - B) / (1 + iy)));
    if (x.loanNow < 0.005) x.loanNow = 0;
    x.needNow = A - x.loanNow;
    x.interest = x.loanNow * iy;
    x.total = price + x.tax + x.contrib + x.origTax + x.interest + x.midInt;
    x.flow = x.total - x.loanEnd;
    x.needTotal = Math.max(x.needNow, x.flow);
    x.needTotal = Math.max(
      Math.round(x.needNow * 10) / 10,
      Math.round((x.needNow + x.loanNow + x.contrib + x.origTax + x.interest + x.midInt - x.loanEnd) * 10) / 10,
    );
    x.gain = x.nvEnd - x.total;
    if (yrs && yrs >= 2) {
      const C = x.contrib,
        fl = [[0, -(price + x.tax)]];
      const I = x.loanNow * rate;
      if (I > 0 && !window.__irrLegacy) {
        for (let t = 1; t <= Math.floor(yrs); t++) fl.push([t, -I]);
        const rem = yrs - Math.floor(yrs);
        if (rem > 1e-6) fl.push([yrs, -I * rem]);
      }
      if (C > 0) {
        fl.push([Math.max(0.5, yrs - 3), -0.1 * C]);
        fl.push([yrs, x.nvEnd - 0.9 * C - x.origTax - x.midInt]);
      } else fl.push([yrs, x.nvEnd - C - x.origTax]);
      x.annual = irr(fl);
    } else x.annual = null;
    x.refund = x.contrib < 0;
    x.ok = true;
    const p10 = r.eta?.p10;
    x.tier = x.annual == null ? 2 : x.annual < DEP || (p10 != null && p10 < 0.3) || x.gain <= 0 ? 1 : 0;
    x.lowPrem = r.s >= 5 && x.prem < x.right * 0.2 && x.priceSrc !== "user";
    x.held = x.lowPrem || !!r.chk;
    if (x.held && x.tier === 0) {
      x.tier = 1;
      x.passHeld = true;
    }
    const pp = Math.min(0.97, r.eta?.p10 ?? 0.3);
    x.rec = x.annual != null ? (x.tier === 0 ? x.annual * pp : x.annual * pp * pp) : -9;
    return x;
  }
  let ICACHE = new Map();
  const condKey = () => [P.homes, P.first, P.unit, AV.aUnit, AV.aRatio, AV.aRate, AV.pIncome, AV.aGrowth].join("|");
  function PLAN0() {
    return matchMedia("(max-width:640px)").matches ? 5 : 12;
  }
  function investC(r) {
    const k = condKey();
    let m = ICACHE.get(k);
    if (!m) {
      if (ICACHE.size > 12) ICACHE = new Map();
      m = new Map();
      ICACHE.set(k, m);
    }
    let x = m.get(r.id);
    if (!x) {
      x = invest(r);
      m.set(r.id, x);
    }
    return x;
  }
  const invalidate = () => {
    ICACHE = new Map();
  };
  const EST = new Map(),
    EST_N = {};
  {
    const by = {};
    R.forEach((r) => {
      const en = r.mk?.entry;
      if (en && en.src === "villa") (by[r.g] = by[r.g] || []).push(en.med / 1e4);
    });
    const MED = {};
    Object.entries(by).forEach(([g, v]) => {
      if (v.length < 3) return;
      v.sort((a, b) => a - b);
      const m = v.length >> 1;
      MED[g] = Math.round((v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) * 100) / 100;
      EST_N[g] = v.length;
    });
    R.forEach((r) => {
      if (r.dn || r.cx || r.src === "moa" || r.tag === "mk" || r.s >= 7 || (r.s >= 6 && r.b18) || r.k === "재건축" || r.mk?.entry || MED[r.g] == null) return;
      EST.set(r.id, MED[r.g]);
    });
  }
  function estSync() {
    EST.forEach((p, id) => {
      const o = OV[id];
      if (!o || o.price == null) OV[id] = { ...(o || {}), price: p, est: 1 };
    });
  }
  estSync();
  const estHide = (r) => !P.est && !!(OV[r.id] && OV[r.id].est);
  window.__est = () => ({ n: EST.size, byGu: EST_N });
  let lastRaw = null,
    planN = PLAN0(),
    CASH = 1,
    MAXP = 0,
    LAST = [],
    AFF = new Set(),
    TOP = null,
    PREV_CASH = null,
    lastValidCash = 1;
  function setSeg(id, v) {
    $(id)
      .querySelectorAll("button")
      .forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === String(v))));
  }
  function segBind(id, key, conv) {
    $(id)
      .querySelectorAll("button")
      .forEach(
        (b) =>
          (b.onclick = () => {
            setSeg(id, b.dataset.v);
            P[key] = conv ? conv(b.dataset.v) : b.dataset.v;
            if (key === "homes") syncFirst();
            planN = PLAN0();
            plan();
          }),
      );
  }
  function syncFirst() {
    const dis = P.homes !== 0;
    if (dis && P.first) P.first = 0;
    $("pFirst").setAttribute("aria-pressed", String(!!P.first));
    $("pFirst").disabled = dis;
    $("pFirst").setAttribute("aria-disabled", String(dis));
    $("firstHint").textContent = dis
      ? "생애최초는 무주택 세대만 해당돼요."
      : "6개월 내 전입 · 사면 청약 무주택 자격을 대부분 잃음(소형·저가 예외)";
    const H = {
      0: "",
      1: "대출·취득세는 무주택과 같게 계산해요. 대출: 대출 실행 후 6개월 안에 기존 주택 처분 · 취득세: 조정대상지역 일시적 2주택은 3년 안에 처분하지 않으면 중과(8%) 추징.",
      3: "규제지역 2주택: 주담대 LTV 0%(대출 없음) · 취득세 중과 8.4% · 양도세 중과·보유세 미반영.",
      2: "규제지역 다주택: 주담대 LTV 0%(대출 없음) · 취득세 중과 12.4% · 양도세 중과·보유세 미반영.",
    };
    $("homesHint").textContent = H[P.homes] || "";
    $("homesHint").hidden = !H[P.homes];
    $("pHomes2").setAttribute("aria-pressed", String(P.homes === 2));
  }
  segBind("pHomes", "homes", Number);
  segBind("pKind", "kind");
  segBind("pUnit", "unit", Number);
  segBind("pBasis", "basis");
  segBind("pSort", "sort");
  $("pHomes2").onclick = () => {
    const v = P.homes === 2 ? 0 : 2;
    P.homes = v;
    setSeg("pHomes", v);
    syncFirst();
    planN = PLAN0();
    plan();
  };
  $("pEst").onclick = () => {
    P.est = !P.est;
    $("pEst").setAttribute("aria-pressed", String(P.est));
    invalidate();
    GCACHE = new Map();
    planN = PLAN0();
    plan();
  };
  $("lFilt")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          LF = LF === b.dataset.v ? "" : b.dataset.v;
          $("lFilt")
            .querySelectorAll("button")
            .forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === LF)));
          planN = PLAN0();
          plan();
        }),
    );
  $("plMore").addEventListener("toggle", () => {
    if ($("plMore").open && LADDER_ARGS && !gapMode()) drawLadder(...LADDER_ARGS);
  });
  $("pFirst").onclick = () => {
    if (P.homes !== 0) return;
    P.first = P.first ? 0 : 1;
    syncFirst();
    plan();
  };
  $("cashQuick")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          PREV_CASH = null;
          $("pCash").value = b.dataset.v;
          cashNote("");
          planN = PLAN0();
          plan();
        }),
    );
  let inT = 0;
  const debPlan = () => {
    clearTimeout(inT);
    inT = setTimeout(() => {
      planN = PLAN0();
      plan();
    }, 150);
  };
  ["aUnit", "aRatio", "aRate", "pIncome", "pRewin", "aGrowth"].forEach((id) =>
    $(id).addEventListener("input", () => {
      readAV();
      debPlan();
    }),
  );
  $("pCash").addEventListener("input", () => {
    PREV_CASH = null;
    cashNote("");
    sizeCash();
    debPlan();
  });
  $("pCash").addEventListener("change", () => {
    convertCash();
    if ($("pCash").value !== lastRaw) {
      clearTimeout(inT);
      planN = PLAN0();
      plan();
    }
  });
  $("pCash").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      convertCash();
      planN = PLAN0();
      plan();
    }
  });
  ["pGu", "pTrade", "pAfford"].forEach((id) =>
    $(id).addEventListener("change", () => {
      planN = PLAN0();
      plan();
      if (id === "pGu") {
        const g = $("pGu").value;
        if (g) enterGu(g, {});
        else if (mapView === "gu") exitGu({});
      }
    }),
  );
  function cashNote(t) {
    $("cashNote").textContent = t;
    $("cashNote").hidden = !t;
  }
  function sizeCash() {
    const el = $("pCash");
    el.style.width = Math.max(0.9, String(el.value).length * 0.6 + 0.15) + "em";
  }
  function convertCash() {
    const raw = String($("pCash").value).trim(),
      v = parseKMoney(raw);
    if (v == null || isNaN(v)) return;
    if (/[억천백만]/.test(raw)) {
      const e = v / 1e4;
      $("pCash").value = String(Math.round(e * 100) / 100);
      cashNote(`${raw} → ${e2(e)}억으로 계산했어요.`);
      sizeCash();
      return;
    }
    if (v >= 1e7) {
      const e = v / 1e8;
      $("pCash").value = String(Math.round(e * 100) / 100);
      cashNote(`${fmt(v)}원 → ${e2(e)}억으로 바꿔 계산했어요. (억 단위로 입력: 예 3.5)`);
      sizeCash();
      return;
    }
    if (v >= 1e3) {
      const e = v / 1e4;
      $("pCash").value = String(Math.round(e * 100) / 100);
      cashNote(`${fmt(v)}만원 → ${e2(e)}억으로 바꿔 계산했어요. (억 단위로 입력: 예 3.5)`);
      sizeCash();
      return;
    }
  }
  const NAME_TAIL =
    /\s*(주택)?(재정비촉진구역|정비구역)?\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)?\s*(정비)?\s*(사업)?\s*(조합설립)?\s*(정비사업)?\s*(추진위원회|추진위|조합|준비위원회|주민협의체|주민대표회의|사업시행자|위원회)?\s*(재개발구역)?\s*$/;
  let SN_DIS = null;   // 짧은 이름이 겹치는 구역 → 동 붙인 이름(한 번만 계산)
  function shortName(n) {
    if (!SN_DIS) {
      SN_DIS = new Map();
      const g = new Map();
      R.forEach((r) => { if (!r.n) return; const k = shortName0(r.n); if (!g.has(k)) g.set(k, new Map()); g.get(k).set(r.n, r); });
      g.forEach((m, k) => {
        if (m.size < 2) return;
        const dn = (r) => (r.bj || r.j || "").split(" ")[0];
        const jb = (r) => ((r.bj || r.j || "").split(" ")[1] || "").split("-")[0];
        const kd = (r) => (/재건축/.test(r.n) ? "재건축" : /도시환경|도시정비형/.test(r.n) ? "도시정비형" : /가로/.test(r.n) ? "가로주택" : /재개발/.test(r.n) ? "재개발" : "");
        const V = [...m.values()], diffD = new Set(V.map(dn)).size === V.length;
        // 동이 다르면 동을, 같은 동끼리면 사업 유형을, 유형도 같으면 동+지번 본번을 붙인다(예: 홍제3구역(재건축) · 홍제3구역(도시정비형))
        const diffK = !diffD && new Set(V.map(kd)).size === V.length && V.every(kd);
        m.forEach((r, full) => {
          const d = dn(r);
          const tag = diffD ? (d && !k.includes(d) ? d : "") : diffK ? kd(r) : d && jb(r) ? `${d} ${jb(r)}` : "";
          if (tag) SN_DIS.set(full, `${k}(${tag})`);
        });
      });
    }
    return SN_DIS.get(n) || shortName0(n);
  }
  // 이름이 '…제'로 끝나는 동(홍제·인제 등) — 지번 주소 첫 낱말에서
  let JE0 = null;
  const JE = () => JE0 || (JE0 = new Set(R.map((r) => ((r.bj || r.j || "").split(" ")[0] || "").replace(/\d*동$/, "")).filter((d) => /제$/.test(d)).flatMap((d) => [d, d.slice(-2), d.slice(-3)])));
  function shortName0(n) {
    let s = n
      .replace(/^\s*\[[^\]]*\]\s*/, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/^[^(]*\)\s*/, (m) => (/\(/.test(m) ? m : ""))
      .replace(/\s+/g, " ")
      .trim()
      // '미아제4구역'·'노량진 제1구역' → '…4구역'·'…1구역'. 단, 동 이름이 '제'로 끝나면(홍제동 → '홍제3구역') 그 '제'는 남긴다
      .replace(/([가-힣]*?)\s*(제?)\s*(\d+)\s*(재정비촉진구역|구역)/, (m, a, j, d) => (j && a && JE().has(a.slice(-3) + "제") ? `${a}제${d}구역` : `${a}${d}구역`));
    for (let i = 0; i < 3; i++)
      s = s
        .replace(NAME_TAIL, "")
        .replace(/(아파트)$/, "")
        .trim();
    s = s
      .replace(/\s*(주택정비형|도시정비형|역세권활성화)?\s*$/, "")
      .replace(/번지/g, "")
      .replace(/\s*일[대원](?=\s|$)/g, "")
      .replace(/^\S*재정비촉진지구\s+(?=\S+구역)/, "")
      .replace(/\s+\d+동(,\s*\d+동)+$/, "")
      .replace(/\s*(장기전세주택|소규모재건축|가로주택정비|도시정비형)(\s|$)/g, "$2")
      .replace(/\s+/g, " ")
      .trim();
    return s.length >= 2 ? s : n;
  }
  const walk = walkM;
  function rewinBlocked(r) {
    const y = num("pRewin");
    if (!y || y < 2e3) return false;
    const until = y + 5,
      now = TODAY.getFullYear() + TODAY.getMonth() / 12;
    const apply = r.s >= 5 ? now : r.eta?.eMid ? +r.eta.eMid.slice(0, 4) - 6.5 : null;
    return apply == null ? false : apply < until;
  }
  const GAIN_LBL = () => `입주 때 시세 차이 (추정·시세 상승 ${num("aGrowth") ? `연 ${num("aGrowth")}%` : "0%"} 가정)`;
  const MULTI_NOTE = "세전 · 전액 현금 · 양도세 중과·보유세 미반영 · 무주택과 직접 비교 불가";
  const isMulti = () => P.homes === 2 || P.homes === 3;
  function loanWhy(x) {
    if (!x.loanCap)
      return `없음 <small>${isMulti() ? "규제지역 다주택 LTV 0%" : x.land0 ? "멸실 뒤 입주권(토지) 매수라 주담대 없음" : num("pIncome") === 0 ? "연소득 0 → DSR상 0" : "한도 없음"}</small>`;
    const part = x.loanNow < x.loanCap - 0.005;
    const coll = x.priceSrc === "complex" ? x.price : Math.min(x.price, x.appr * 1.2);
    const how = `한도 = min(${coll < x.price - 0.005 ? `감정가 추정 ${won(x.appr)} × 1.2` : `매수가 ${won(x.price)}`} × LTV ${Math.round(ltvBuy() * 100)}%, 가격구간 ${bandCap(x.price)}억${num("pIncome") != null ? ", DSR" : ""})`;
    return `${won(x.loanNow)} <small>${how} · 한도 ${won(x.loanCap)}${part ? ` 중 입주까지 필요한 현금이 가장 적은 금액${x.loanNow ? "" : "(대출 안 받음)"} · 대출을 더 받으면 이자만큼 입주 때 현금이 더 들어요` : " 전액 · 지금 필요한 현금을 줄이려면 한도까지 필요"}</small>`;
  }
  function heroHTML(x) {
    const r = x.r,
      w = buyWindow(r);
    if (w.cls === "no")
      return `<div class="hv off"><span>입주 때 시세 차이</span><b>입주권 없음</b><small>지금 사면 ${isRebuild(r) || isSmall(r) ? "매도청구" : "현금청산"} 대상 · 수익 계산 제외</small></div>`;
    if (!x.ok)
      return `<div class="hv off"><span>입주 때 시세 차이</span><b>${x.price == null ? (x.stale ? "입주권 시세 미공개" : "매수가 미공개") : x.nvThin ? "표본 부족" : "신축 시세 미공개"}</b><small>${x.price == null ? (x.stale ? "관리처분·이주 이후라 입주권 호가 입력 필요" : x.noApt ? "해당 단지 실거래 없음 · 매물가 입력 필요" : "반경 800m 안 비교 실거래 없음 · 매물가 입력 필요") : x.nvThin ? "주변 신축 비교 거래가 10건 미만이거나 84㎡가 59㎡보다 싸게 잡혀 차익을 내지 않아요" : "주변 신축 실거래 없음"}</small></div>`;
    const p10 = r.eta?.p10,
      slow = p10 != null && p10 < 0.3;
    if (x.annual == null)
      return `<div class="hv ref"><span>${GAIN_LBL()}</span><b>${sg(x.gain)}<i>억</i> <em class="refb">시점 미정 · 참고값</em></b><small>${x.yrs ? "입주 2년 이내 · 연환산 생략" : `입주 시점 미정${x.loanNow ? ` · 매수대출 이자는 ${CONS_YRS}년(보수 가정)` : ""}`}</small>${isMulti() ? `<small class="mh">${MULTI_NOTE}</small>` : ""}</div>`;
    const sub =
      x.gain <= 0
        ? "손실 예상 · 연수익 없음"
        : `<span title="매수대출 이자와 분담금 납부 시점을 반영한 연 복리 수익률(연 복리 수익률)">연 ${pcIrr(x.annual)} (연 복리 수익률)</span>${x.annual < DEP ? ` · <span class="lowp">예금 ${(DEP * 100).toFixed(1)}% 미만</span>` : ""}${slow ? ` · <span class="lowp" title="10년 안 준공 가능성이 낮아요">10년 내 준공 ${prob(p10)}%로 낮음</span>` : ""}`;
    const cls = x.gain >= 0.05 ? "up" : x.gain <= -0.05 ? "dn" : "";
    return `<div class="hv ${cls}"><span>${GAIN_LBL()}</span><b>${sg(x.gain)}<i>억</i></b><small>${sub}${x.refund ? " · 환급 추정(조합 추정분담금 확인)" : ""}</small>${isMulti() ? `<small class="mh">${MULTI_NOTE}</small>` : ""}</div>`;
  }
  function flowParts(x) {
    const r1 = (v) => Math.round(v * 10) / 10;
    const now = r1(x.needNow),
      rep = r1(x.loanNow),
      c = r1(x.contrib),
      ti = r1(x.origTax + x.interest + x.midInt),
      le = r1(x.loanEnd);
    return { now, rep, c, ti, le, sum: r1(now + rep + c + ti - le) };
  }
  function flowLine(x) {
    if (!x.ok)
      return x.needNow != null
        ? `지금 ${e2(x.needNow)}억 (매수가 ${e2(x.price)}억 + 취득세 ${won(x.tax)}${x.loanNow ? ` − 대출 ${e2(x.loanNow)}억` : ""})`
        : "";
    const f = flowParts(x);
    const parts = [
      `지금 ${e2(f.now)}`,
      f.rep ? `대출상환 ${e2(f.rep)}` : null,
      `${f.c < 0 ? "환급 −" + e2(-f.c) : "분담금 " + e2(f.c)}`,
      `세금·이자 ${e2(f.ti)}`,
    ]
      .filter(Boolean)
      .join(" + ")
      .replace("+ 환급 −", "− 환급 ");
    return f.sum >= f.now ? `${parts} − 잔금대출 ${e2(f.le)} = ${e2(f.sum)}억` : `지금 ${e2(f.now)}억이 최대 (입주 때는 잔금대출로 충당)`;
  }
  const DUPN = (() => {
    const c = new Map();
    R.forEach((r) => {
      const k = shortName(r.n);
      c.set(k, (c.get(k) || 0) + 1);
    });
    return new Set([...c].filter(([, n]) => n > 1).map(([k]) => k));
  })();
  function cardHTML(x, rank, passRank) {
    const r = x.r,
      w = buyWindow(r),
      lp = landPermit(r),
      mk = r.mk || {},
      en = mk.entry;
    const total = P.basis === "total" && x.ok;
    const need = total ? x.needTotal : x.needBuy;
    const fill = need != null ? (need / Math.max(CASH, 0.01)) * 100 : 0;
    const facts = `<div class="kv">\n      <div><span>예상 입주</span><b>${etaYearTxt(r)}</b></div>\n      <div><span>10년 내 준공</span><b>${p10Txt(r)}${p10Why(r) ? ` <small class="why-s">${p10Why(r)}</small>` : ""}</b></div>\n      <div><span>단계</span><b title="${esc(stageName(r))}">${esc(stageName(r))}</b></div>\n    </div>`;
    let budget = "";
    if (need != null && w.cls !== "no") {
      const over = need > CASH + 1e-9,
        left = CASH - need,
        tight = !over && left < 0.5 - 1e-9,
        loss = x.ok && x.gain <= -0.05;
      const short = !total && x.ok && x.needTotal > CASH;
      const st = over
        ? `${e2(need - CASH)}억 부족`
        : loss
          ? `손실 예상 · ${e2(left) === "0" ? "남는 돈 없음" : e2(left) + "억 남음"}`
          : tight
            ? e2(left) === "0"
              ? "예산에 딱 맞음"
              : `${e2(left)}억 남음 · 빠듯`
            : `${e2(left)}억 남음`;
      const inc = num("pIncome"),
        le = x.ok ? Math.max(x.loanEnd, x.loanNow) : x.loanNow;
      const dsrNote =
        inc != null && total && x.ok && x.loanEnd > 0.05
          ? `<p class="dsr-s">입주 잔금대출 ${e2(x.loanEnd)}억 · 현행 규제(2025.10.16~) 기준 · 입주 시점 규제에 따라 달라짐</p>`
          : inc == null && total && le > 0.05
            ? `<p class="dsr-s">${x.ok && x.loanEnd >= x.loanNow ? "입주 잔금대출" : "대출"} ${e2(le)}억 → DSR상 연소득 약 ${incTxt(le)} 필요 (연소득 미입력 · 현행 규제 기준)</p>`
            : "";
      budget = `<div class="bud ${over || short ? "over" : loss ? "neutral" : tight ? "tight" : ""}">\n      <div class="bl"><span>${total ? "입주까지 필요한 현금" : "지금 필요한 현금"}</span><b>${e2(need)}억 <small>/ ${e2(CASH)}억</small></b></div>\n      <div class="bt" role="img" aria-label="필요 현금 ${e2(need)}억, 내 현금 ${e2(CASH)}억, ${st}"><i style="width:${Math.min(100, fill)}%"></i></div>\n      <div class="bs"><small>${esc(flowLine(x))}</small><span class="st">${st}</span></div>\n      ${dsrNote}${short ? `<p class="warnline">입주까지 ${e2(x.needTotal)}억 필요 · ${e2(x.needTotal - CASH)}억 부족 — 분담금을 못 내면 중간에 팔아야 할 수 있어요</p>` : ""}\n    </div>`;
    }
    const earlyT = "구역지정·조합설립 전 초기 단계. 권리산정기준일 이후 신축·지분 쪼개기 매물은 입주권이 나오지 않습니다.";
    const second = lp
      ? `<span class="chip-s warn" title="${esc(lp.d)}">${esc(lp.t)}</span>`
      : r.s <= 2
        ? `<span class="chip-s warn" title="${earlyT}">초기 단계 · 권리산정기준일 확인</span>`
        : "";
    const lowPrem = x.ok && x.lowPrem;
    const notes = [
      lp && r.s <= 2 ? ["초기 단계 · 권리산정기준일 확인", earlyT] : null,
      lp ? [lp.t, lp.d] : null,
      r.k === "재건축"
        ? ["재건축부담금 미반영", "재건축초과이익환수 부담금은 추정에 넣지 않았습니다. 고가 단지는 수억 원이 될 수 있습니다."]
        : null,
      en && (en.n < 5 || en.thin) ? [`거래 ${en.n}건`, "비교 거래가 적어 매수가 추정이 불안정"] : null,
      lowPrem
        ? [
            "매수가가 낮게 잡혔을 수 있음",
            `사업시행인가 이후인데 프리미엄 추정이 권리가액의 20% 미만이에요. 실제 매물가를 아래에 넣어 보세요.${x.passHeld ? " 수익·확률 기준은 넘지만 매수가 확인 전이라 기준 통과에서 뺐어요." : ""}`,
          ]
        : null,
      x.nvFix ? ["신축 시세 보정", "주변 신축 시세가 이 단지 구축보다 낮아 구축 ㎡단가 × 1.15로 보정"] : null,
      x.consYrs && x.ok && x.loanNow ? ["이자 기간 가정", `입주 시점이 없어 매수대출 이자를 ${CONS_YRS}년으로 보수적으로 넣었어요.`] : null,
      r.chk && w.cls !== "chk"
        ? ["단계 정보 확인 중", chkText(r) + (x.passHeld ? " 수익·확률 기준은 넘지만 단계가 확정되지 않아 기준 통과에서 뺐어요." : "")]
        : null,
    ].filter(Boolean);
    const ti = x.ok ? flowParts(x).ti : null;
    const why = `<details class="why"><summary>계산 근거${notes.length ? ` · 참고 ${notes.length}` : ""}</summary><div class="why-in">\n      ${notes.length ? `<ul class="why-notes">${notes.map(([t, d]) => `<li><b>${esc(t)}</b>${esc(d)}</li>`).join("")}</ul>` : ""}\n      ${x.price != null ? `<dl>\n        <dt>매수가</dt><dd>${e2(x.price)}억 <small>${x.priceSrc === "user" ? "직접 입력" : x.priceSrc === "complex" ? `${esc(en.name)} 실거래 ${en.n}건 가운데 값 (전용 ${en.area_med}㎡ · 계약 2025.10~2026.9)` : x.priceSrc === "villa" ? `${en.scope ? esc(en.scope) : `반경 ${fmt(en.radius)}m 구축 빌라`} 실거래 ${en.n}건 가운데 값 (전용 ${en.area_med}㎡ · 계약 2025.10~2026.9)` : ""}</small></dd>\n        <dt>취득세</dt><dd>${won(x.tax)} <small>${taxDesc(x)} · '지금'에 포함</small></dd>\n        ${x.ok ? `<dt>매수 대출</dt><dd>${loanWhy(x)}</dd>` : ""}\n        <dt>감정가 추정</dt><dd>${e2(x.appr)}억 <small>${esc(x.apprWhy)}</small></dd>\n        <dt>권리가액 · 프리미엄</dt><dd>${won(x.right)} · ${won(x.prem)} <small>비례율 ${Math.round(x.ratio * 100)}% 가정</small></dd>\n        ${x.ok ? `<dt>조합원 분양가</dt><dd>${e2(x.unitPrice)}억 <small>${x.unitArea}㎡ · 신축 시세의 ${Math.round((x.unitPrice / x.nv) * 100)}% (${x.unitArea}㎡ 원가 하한 ${e2(x.floor)}억 · 비율은 작성자 가정값)</small></dd>\n        <dt>신축 시세</dt><dd>${e2(x.nv)}억 <small>${x.nvFix ? "구축 ㎡단가 × 1.15로 보정 · " : ""}${x.same ? `같은 평형(${x.unitArea}㎡) 환산 · ` : ""}${esc(x.ref?.scope || "")} 2016년 이후 준공 ${x.ref?.n || ""}건${x.ref?.complexes ? " · " + x.ref.complexes.slice(0, 2).map(esc).join(", ") : ""}</small></dd>\n        <dt>세금·이자 (입주까지)</dt><dd>${e2(ti)}억 <small>${tiParts(x)}</small></dd>\n        <dt>입주까지 들어가는 돈 합계(잔금대출 빼기 전)</dt><dd>${e2(x.total)}억 <small>매수가 + 취득세 + 분담금 + 세금·이자 (각 값은 반올림 전 합계)</small></dd>` : ""}\n      </dl>` : ""}\n      <div class="ov">\n        <label>매수가<span class="inp"><input inputmode="decimal" data-ov="price" data-id="${r.id}" value="${OV[r.id]?.price ?? ""}" placeholder="${x.price != null ? e2(x.price) : "예: 5"}"><span>억</span></span></label>\n        ${x.land != null ? `<label>대지지분${x.landDef ? ' <small class="lab-def">가정값 · 입력으로 수정</small>' : ""}<span class="inp"><input inputmode="decimal" data-ov="land" data-id="${r.id}" value="${OV[r.id]?.land ?? ""}" placeholder="${x.land}"><span>㎡</span></span></label>` : x.price != null ? `<label>감정가<span class="inp"><input inputmode="decimal" data-ov="appr" data-id="${r.id}" value="${OV[r.id]?.appr ?? ""}" placeholder="${e2(x.appr)}"><span>억</span></span></label>` : ""}\n      </div>\n    </div></details>`;
    const cap = `${esc(r.g)} ${esc(DUPN.has(shortName(r.n)) ? r.bj || r.j : (r.bj || r.j).split(" ")[0])} · ${esc(r.k.replace("(모아주택)", ""))}${(() => {
      const x = r.st ? stnInfo(r) : null;
      return !x ? "" : x.min > 20 ? ` · ${esc(x.n)}역 ${(x.d / 1e3).toFixed(1)}km` : ` · ${esc(x.n)}역 ${fmt(x.d)}m·도보 ${x.min}분`;
    })()}`;
    const keep =
      (lowPrem
        ? `<span class="chip-s warn" title="사업시행인가 이후인데 프리미엄 추정이 권리가액의 20% 미만이에요. 실제 매물가를 넣어 보세요.">매수가 낮게 잡혔을 수 있음</span>`
        : "") +
      (r.chk ? `<span class="chip-s warn" title="${esc(chkText(r))} 기준 통과·순위에서 제외했어요.">단계 확인 중</span>` : "") +
      (x.passHeld ? '<span class="chip-s plain">기준 통과에서 제외</span>' : "") +
      (x.ok && x.ref && x.ref.radius > 1500
        ? `<span class="chip-s plain" title="반경 1.5km 안 신축 거래가 부족해 ${esc(x.ref.scope || "")}로 넓혔어요">신축 비교 반경 확대</span>`
        : "");
    return `<article class="iv" data-card="${r.id}">\n    <div class="iv-a">\n      <div class="iv-h"><div class="nm">${passRank != null ? `<em class="rk">기준 통과 ${passRank + 1}위</em>` : ""}<h3 title="${esc(shortName(r.n))}">${esc(shortName(r.n))}</h3><p class="cap" title="${cap}">${cap}</p></div><div class="iv-hr">${gradeBadge(r)}${favBtn(r, "sm ic")}</div></div>\n      <div class="iv-chips"><span class="io ${w.cls}" title="${esc(w.d)}">${esc(w.t)}</span>${second}${keep}${w.due ? `<span class="due ${w.near ? "near" : ""}">${esc(w.due)}</span>` : ""}${(() => {
      const hs = nearHojae(r);
      if (!hs.length) return "";
      const h = hs[0];
      return `<span class="iv-hj" title="1.5km 안 주변 호재 ${hs.length}건 · 리포트 '호재·매물' 탭"><i style="background:${h.h.c}" aria-hidden="true"></i>호재 ${hs.length} · ${esc(h.h.n.replace(/\s*\(.*\)$/, ""))} ${kmTxt(h.d)}</span>`;
    })()}</div>\n      ${facts}\n    </div>\n    <div class="iv-b">${heroHTML(x)}${budget}</div>\n    <div class="foot">${why}<button type="button" class="go" data-open="${r.id}">분석 보기 <span aria-hidden="true">→</span><span class="sr-only">: ${esc(shortName(r.n))}</span></button></div>\n  </article>`;
  }
  function baseList(over) {
    const gu = $("pGu").value,
      trade = $("pTrade").checked;
    return R.filter(
      (r) =>
        !r.dn &&
        r.s < 9 &&
        !r.cx &&
        r.src !== "moa" &&
        (!gu || r.g === gu) &&
        (!P.kind || KINDS.find((x) => x[0] === P.kind)[1](r)) &&
        (!trade || !restricted(r)) &&
        !rewinBlocked(r) &&
        !estHide(r),
    );
  }
  function computeOk(over) {
    const save = { ...P },
      cashSave = CASH;
    Object.assign(P, over.P || {});
    if (over.cash != null) CASH = over.cash;
    const n = baseList()
      .filter((r) => !r.lc)
      .map(investC)
      .filter((x) => (P.basis === "total" ? x.ok && x.needTotal <= CASH : x.needBuy != null && x.needBuy <= CASH)).length;
    Object.assign(P, save);
    CASH = cashSave;
    return n;
  }
  function readCash() {
    const raw = String($("pCash").value).trim();
    let t = raw.replace(/,(\d{3})(?!\d)/g, "$1");
    let cv = /[억천백만]/.test(t) ? parseKMoney(t) / 1e4 : parseFloat(t);
    if (/^\d+,\d{1,2}$/.test(raw)) {
      cv = parseFloat(raw.replace(",", "."));
      cashNote(`쉼표를 소수점으로 보고 ${e2(cv)}억으로 계산했어요.`);
    }
    const bad = raw === "" || !isFinite(cv) || cv <= 0 || !/^[\d.,억천백만\s]+$/.test(raw) || (raw.match(/\./g) || []).length > 1;
    const big = !bad && cv > 100;
    return { bad, big, cv };
  }
  function setHTML(el, html) {
    if (el._h === html) return false;
    el.innerHTML = html;
    el._h = html;
    return true;
  }
  const incTxt = (loan) => {
    const y = incomeFor(loan);
    return y >= 1 ? `${e2(y)}억` : `${fmt(Math.round((y * 1e4) / 100) * 100)}만원`;
  };
  let ansOpen = false;
  let CHEAP = null;
  function cheapestOf(xs, needOf) {
    return xs.filter((x) => needOf(x) != null).sort((p, q) => needOf(p) - needOf(q) || (p.annual == null) - (q.annual == null))[0] || null;
  }
  const cheapFlag = (x) =>
    x.ok && x.gain <= -0.05
      ? "손실 예상"
      : x.annual == null
        ? "입주 시점 미정"
        : (x.r.eta?.p10 ?? 1) < 0.3
          ? `10년 내 준공 ${prob(x.r.eta.p10)}%`
          : "";
  const cheapSentence = (x, need, lab) =>
    `가장 적게 드는 곳은 <b>${esc(shortName(x.r.n))}</b>, ${lab} <b>${e2(need)}억</b>이에요${cheapFlag(x) ? ` <span class="flag">(${cheapFlag(x)})</span>` : ""}.`;
  // 내 핀 아이콘: 남색 물방울 핀 + 노란 점(public/icon.svg와 같은 모양)
  const SVG_PIN = (on) =>
    `<svg class="pin-ic" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c-3.4-4.1-7.2-8.4-7.2-12.6a7.2 7.2 0 0 1 14.4 0c0 4.2-3.8 8.5-7.2 12.6z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="12" cy="9.4" r="2.6" fill="${on ? "var(--pin-dot, #F5C33B)" : "none"}" stroke="${on ? "none" : "currentColor"}" stroke-width="1.7"/></svg>`;
  const SVG_STAR = SVG_PIN;
  const byName = (a, b) => a.localeCompare(b, "ko");
  const FAV_KEY = "jg-fav";
  let FAV = [];
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    if (Array.isArray(v)) FAV = v.filter((id) => byId[id]);
  } catch (e) {
    FAV = [];
  }
  const saveFav = () => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(FAV));
    } catch (e) {}
  };
  const isFav = (id) => FAV.includes(id);
  const favBtn = (r, cls = "") =>
    r
      ? `<button type="button" class="favb ${cls}" data-fav="${r.id}" aria-pressed="${isFav(r.id)}" aria-label="${esc(shortName(r.n))} ${isFav(r.id) ? "핀 빼기" : "핀 꽂고 알림 받기"}">${SVG_PIN(isFav(r.id))}<span>${isFav(r.id) ? "알림 받는 중" : "핀 꽂고 알림 받기"}</span></button>`
      : "";
  const BLOG_URL = "https://blog.naver.com/always_questions";
  const leadCard = (cls = "") =>
    MO
      ? `<aside class="lead ${cls}" aria-label="월간 단계 변경 리포트"><div class="ld-t"><b>${moLabel()}에 서울 정비사업 인가 ${MO.items.length}건(구역 ${new Set(MO.items.map((x) => x.id)).size}곳)</b><p>매달 추진위 승인·구역지정·조합설립·사업시행·관리처분 인가가 난 구역을 원문 링크, 입주까지 필요한 현금과 함께 정리해요.</p><ul class="ld-p"><li>매달 발행</li><li>기사·고시 원문 대조</li><li>가입 없이 열람</li></ul></div><div class="ld-a"><a class="btn secondary sm" href="${MO.url}">최신 리포트 보기</a><small><a href="years">우리 단계는 몇 년 걸리나</a> · <a href="z/">구역별 페이지</a></small></div></aside>`
      : "";
  const JR_SEOUL = 56.6;
  const JR_GU = { 도봉구: 83.7, 강서구: 76.6, 금천구: 70.3, 종로구: 65.6 };
  const GAP_SRC = [
    [
      "머니투데이 2026.5.26 · 서울 연립·다세대 전세가율 평균 56.6%(3월)·자치구별",
      "https://www.mt.co.kr/estate/2026/05/26/2026052610102059836",
    ],
    ["한국경제 2026.2.24 · 한국부동산원 서울 빌라 전세가율 60.4%(1월)", "https://www.hankyung.com/article/2026022419281"],
    [
      "정책브리핑 · 서울 전역 토지거래허가구역(아파트·같은 단지 연립·다세대, 실거주 2년)",
      "https://www.korea.kr/news/policyNewsView.do?newsId=148950973",
    ],
    ["뉴스핌 2026.5.7 · 신통 재개발 후보지 전 지목 토지거래허가", "https://www.newspim.com/news/view/20260507000491"],
    ["금융위 10·15 정책문답 · 이주비 대출 LTV 40%·다주택 0%, 가격구간 한도 미적용", "https://www.fsc.go.kr/po020201/85518"],
    [
      "머니투데이 2026.8.13 · 이주비 대출 담보가치 = 종전자산·조합원 분양가 중 큰 금액(8.31부터)",
      "https://www.mt.co.kr/finance/2026/08/13/2026081309103477259",
    ],
  ];
  const RELOC_CAP = 6,
    RELOC_LTV = 0.4;
  P.fund = "gap";
  P.jr = null;
  const gapMode = () => P.fund === "gap";
  // 구역 경계 안 실거래로 구한 전세가율(같은 건물 매매·전세 비교 5곳 이상 또는 ㎡당 시세 비교)이 있으면 그것을 먼저 쓴다
  const zoneJr = (r) => {
    const t = r.tx, en = r.mk && r.mk.entry;
    if (!t || !en || en.src !== "villa") return null;
    const v = t.jr && t.jrn >= 5 ? t.jr : t.jr2 && t.jn >= 8 ? t.jr2 : null;
    return v == null ? null : Math.round(Math.min(0.9, Math.max(0.15, v)) * 1000) / 10;
  };
  const jrOf = (r) => (P.jr != null ? P.jr : (zoneJr(r) ?? JR_GU[r.g] ?? JR_SEOUL));
  const jrSrcTxt = (r) =>
    P.jr != null ? "직접 설정" : zoneJr(r) != null ? (r.tx.jr && r.tx.jrn >= 5 ? `구역 안 같은 건물 매매·전세 ${r.tx.jrn}곳 비교` : `구역 안 빌라 전세 ${r.tx.jn}건·매매 시세 비교`) : JR_GU[r.g] != null ? `${r.g} 연립·다세대 평균(2026.3)` : "서울 연립·다세대 평균(2026.3)";
  const CJ = () => (TR.large && TR.large["착공>준공"] && TR.large["착공>준공"].med) || 3;
  function gapBlock(r) {
    if (r.src === "moa" || isDone(r) || r.dn || r.cx) return "계산 대상 아님";
    if (r.s >= 7) return "이주·철거가 시작된 구역이라 세입자가 없어요 (입주권 매수)";
    const lp = landPermit(r);
    if (lp)
      return lp.t.includes("공공재개발")
        ? "전세 낀 매수 불가 · 공공재개발 토지거래허가(실거주 2년)"
        : lp.t.includes("신속통합기획")
        ? "전세 낀 매수 불가 · 신속통합기획 후보지 토지거래허가(실거주 2년)"
        : "전세 낀 매수 불가 · 아파트 단지 토지거래허가(실거주 2년)";
    const w = buyWindow(r);
    if (w.cls === "no") return `입주권 없음 · ${w.due || ""}`.replace(/ · $/, "");
    if (w.cls === "chk") return `입주권 판정 보류 · ${w.t}`;
    return null;
  }
  let GCACHE = new Map(),
    GKEY = "";
  function gapOf(r) {
    const k = condKey() + "|" + P.jr;
    if (k !== GKEY) {
      GCACHE = new Map();
      GKEY = k;
    }
    const ck = r.id + "|" + (OV[r.id]?.jeonse ?? "") + "|" + (OV[r.id]?.price ?? "");
    let g = GCACHE.get(ck);
    if (g) return g;
    const x = investC(r);
    g = { r, x, block: gapBlock(r) };
    if (x.price == null) {
      g.na = true;
      GCACHE.set(ck, g);
      return g;
    }
    const jo = OV[r.id]?.jeonse;
    g.jr = jrOf(r);
    g.userJ = jo != null;
    g.D = Math.min(x.price, jo != null ? jo : (x.price * g.jr) / 100);
    g.now = Math.max(0, x.price + x.tax - g.D);
    if (x.ok) {
      const multi = P.homes === 2 || P.homes === 3;
      g.Mcap = multi ? 0 : Math.min(RELOC_CAP, RELOC_LTV * Math.max(x.appr || 0, x.unitPrice || 0));
      g.M = Math.min(g.D, g.Mcap);
      g.reloc = g.D - g.M;
      g.relocAlt = g.D - Math.min(g.D, multi ? 0 : Math.min(RELOC_CAP, RELOC_LTV * (x.appr || 0)));
      const rate = (num("aRate") ?? 4.5) / 100;
      g.intM = g.M * rate * CJ();
      const r1 = (v) => Math.round(v * 10) / 10;
      const flow = r1(x.price + x.tax + x.contrib + x.origTax + x.midInt + g.intM - x.loanEnd);
      g.total = Math.max(r1(g.now + g.reloc), flow);
      g.tR = x.yrs ? Math.max(0.25, x.yrs - CJ()) : null;
      g.tM = x.yrs || null;
      g.gain = x.nvEnd - (x.price + x.tax + x.contrib + x.origTax + x.midInt + g.intM);
    }
    GCACHE.set(ck, g);
    return g;
  }
  const gapOk = (r, cash = CASH) => {
    if (estHide(r)) return false;
    const g = gapOf(r);
    return !g.block && !g.na && g.now <= cash + 1e-9;
  };
  // 곳 수는 홈 '살 수 있는 곳'(affOk)과 같은 기준: 참고값(lc · 매수가 표본 부족) 구역은 세지 않는다
  const gapCount = (cash) => baseList().filter((r) => !r.lc && gapOk(r, cash)).length;
  const yrTxt = (t) => {
    if (t == null) return "시점 미정";
    if (t > 4) return t > 15 ? "15년 넘게" : t > 10 ? "10~15년 뒤" : t > 7 ? "7~10년 뒤" : "4~7년 뒤";
    const d = new Date(TODAY.getTime() + t * 365.25 * 864e5);
    return `${d.getFullYear()}년`;
  };
  const f1 = ZF.num;
  // '입주까지 현금' 다리 줄: 들어가는 돈 − 입주 잔금대출 = 입주까지 현금(표시값끼리 맞게 0.1억 단위)
  // 전세 끼고 사서 '지금 + 이주' 쪽이 더 크면(잔금대출이 분담금보다 큼) 그 합으로 설명
  function cashBr(T, L, g) {
    const t = Math.round(T * 10) / 10, l = Math.round(L * 10) / 10;
    const fl = g ? g.x.price + g.x.tax + g.x.contrib + g.x.origTax + g.x.midInt + g.intM - g.x.loanEnd : 0;
    if (g && g.now + g.reloc > fl + 0.05)
      return { s: null, html: `<p class="cash-br"><span>지금 <b>${f1(g.now)}억</b></span><span>+ 이주 때 <b>${f1(g.reloc)}억</b></span><span>= 입주까지 현금 <b>${f1(t)}억</b></span></p>` };
    const s = Math.round((t + l) * 10) / 10;
    return { s, html: `<p class="cash-br"><span>입주까지 들어가는 돈 <b>${f1(s)}억</b></span><span>− 입주 잔금대출 <b>${f1(l)}억</b></span><span>= 입주까지 현금 <b>${f1(t)}억</b></span></p>` };
  }
  const taxT =(v) => (v < 0.095 ? (Math.round(v * 100) / 100).toFixed(2) : e2(v));
  window.__count = (f, c) => {
    const s = P.fund;
    P.fund = f;
    const n = f === "gap" ? gapCount(c) : computeOk({ cash: c });
    P.fund = s;
    return n;
  };
  window.__gap = (id) => {
    const g = gapOf(byId[id]),
      x = g.x,
      r2 = (v) => (v == null ? null : Math.round(v * 1e3) / 1e3);
    return {
      name: byId[id].n,
      block: g.block,
      price: x.price,
      tax: r2(x.tax),
      jr: g.jr,
      D: r2(g.D),
      now: r2(g.now),
      Mcap: r2(g.Mcap),
      M: r2(g.M),
      reloc: r2(g.reloc),
      contrib: r2(x.contrib),
      origTax: r2(x.origTax),
      midInt: r2(x.midInt),
      intM: r2(g.intM),
      loanEnd: r2(x.loanEnd),
      total: g.total,
      cashTotal: x.needTotal,
      cashLoanNow: r2(x.loanNow),
      cashInterest: r2(x.interest),
      tR: r2(g.tR),
      tM: r2(g.tM),
    };
  };
  const leadAt = () => (matchMedia("(max-width:640px)").matches ? -1 : 2);
  const modeSw = () =>
    `<div class="ans-mode" role="group" aria-label="사는 방법"><button type="button" data-fundset="gap" aria-pressed="${P.fund === "gap"}">${LBL.gap}</button><button type="button" data-fundset="cash" aria-pressed="${P.fund === "cash"}">${LBL.loan}</button></div>`;
  const gapLine = "전세를 끼면 지금 들어가는 돈은 줄지만, 이주 때 전세금을 돌려줘야 해서 입주까지 필요한 총액은 거의 같아요.";
  function gapTL(g, small) {
    const x = g.x;
    const s1 = `<li class="gt1"><span class="gt-w">지금 · 매수</span><b>${f1(g.now)}억</b><small>매수가 ${e2(x.price)} − 전세 ${e2(g.D)} + 취득세 ${taxT(x.tax)}</small></li>`;
    const s2 =
      x.ok && g.reloc < 0.05
        ? `<li class="gt2 z"><span class="gt-w">이주 · ${yrTxt(g.tR)}${g.tR != null && g.tR <= 4 ? " 무렵" : ""}</span><b class="z0">이주비 대출로 전세금 반환</b><small>이주비 대출 ${e2(g.M)}억으로 전세금 ${e2(g.D)}억 반환 · 추정 · 입주 때 상환</small></li>`
        : x.ok
          ? `<li class="gt2"><span class="gt-w">이주 · ${yrTxt(g.tR)}${g.tR != null && g.tR <= 4 ? " 무렵" : ""}</span><b>+${e2(g.reloc)}억</b><small>전세금 ${e2(g.D)} 반환${g.M > 0.04 ? ` − 이주비 대출 ${e2(g.M)}(추정·입주 때 상환)` : g.Mcap === 0 ? " · 다주택은 이주비 대출 불가" : ""}</small></li>`
          : `<li class="gt2 na"><span class="gt-w">이주</span><b>+${e2(g.D)}억</b><small>전세금 반환 · 이주비 대출로 일부 충당 가능(조합·규제에 따라 다름)</small></li>`;
    const s3 = x.ok
      ? `<li class="gt3"><span class="gt-w">입주 · ${etaShow(g.r)}${(() => { const pr = projection(g.r); return pr.stall || pr.nodata ? " (계산용 가정)" : ""; })()}</span><b>${f1(g.total)}억</b><em class="gt-l">${LBL.cashToMoveIn}</em><small>${small ? `${LBL.cashToMoveIn} = 분담금·세금·이자 − 잔금대출` : `${LBL.cashToMoveIn} = 분담금·세금·이자 − 잔금대출 · 참고: 현금으로 사면 ${f1(x.needTotal)}억(매수대출 이자 대신 이주비 이자라 차이)`}</small></li>`
      : `<li class="gt3 na"><span class="gt-w">입주</span><b>계산 전</b><small>입주 시점·신축 시세 자료가 부족해요</small></li>`;
    return `<ol class="gtl${small ? " sm" : ""}">${s1}${s2}${s3}</ol>`;
  }
  function gapGainTxt(g) {
    const x = g.x;
    if (!x.ok) return x.nvThin ? "입주 때 시세 차이: 신축 시세 표본 부족" : "입주 때 시세 차이: 계산 전";
    const gg = g.gain,
      ann = x.annual != null ? ` · 연수익 ${pcIrr(x.annual)}(현금으로 샀을 때)` : "";
    if (gg <= -0.3) return `시세 그대로면 손실 예상 <b>${sg(gg)}억</b>${ann}`;
    if (gg < 0.3) return `시세 그대로면 차익 거의 없음 (${sg(gg)}억)${ann}`;
    return `입주 때 시세 차이 <b>${sg(gg)}억</b> (시세 상승 0% 가정)${ann}`;
  }
  function gapCard(g) {
    const r = g.r,
      cap = `${esc(r.g)} ${esc((r.bj || r.j || "").split(" ")[0])} · ${esc(stageName(r))}`;
    const w = buyWindow(r);
    return `<article class="iv gp" data-card="${r.id}" tabindex="0" aria-label="${esc(shortName(r.n))} 리포트 열기">\n    <div class="iv-h"><div class="nm"><h3 title="${esc(shortName(r.n))}">${esc(shortName(r.n))}</h3><p class="cap">${cap}</p></div><div class="iv-hr">${favBtn(r, "sm ic")}</div></div>\n    <div class="iv-chips"><span class="io ${w.cls}" title="${esc(w.d)}">${esc(w.t)}</span><span class="jr-c" title="전세가 = 매수가 × 전세가율 (${esc(jrSrcTxt(r))}) · 리포트에서 실제 전세금 입력 가능">${g.userJ ? `전세 ${e2(g.D)}억 (입력)` : `전세 ${e2(g.D)}억 · 가정 ${fmt(g.jr, 1)}%`}</span></div>\n    ${gapTL(g, true)}\n    <p class="gp-gain ${g.x.ok && g.gain >= 0.3 ? "up" : g.x.ok && g.gain <= -0.3 ? "dn" : ""}">${gapGainTxt(g)}</p>\n  </article>`;
  }
  const rng = (a) => {
    const v = a.filter((x) => x != null && isFinite(x)).sort((p, q) => p - q);
    if (!v.length) return null;
    const lo = f1(v[0]),
      hi = f1(v[v.length - 1]);
    return lo === hi ? `${lo}억` : `${lo}~<wbr>${hi}억`;
  };
  let LF = "";
  const LF_FN = { redev: isRedev, rebuild: (r) => r.k === "재건축", small: isSmall };
  const LF_LAB = { redev: "재개발", rebuild: "재건축", small: "모아·가로" };
  const p10Of = (r) => r.eta?.p10 ?? -1;
  const stnD = (r) => {
    const s = r.st ? stnInfo(r) : null;
    return s ? s.d : 1e9;
  };
  // 총액 순에서도 구역지정 전·준공 확률을 낼 수 없는 초기 구역은 뒤로(가장 불확실한 곳이 맨 위에 오지 않게)
  const early = (r) => (r.s <= 1 || r.eta?.p10 == null ? 1 : 0);
  function sortZ(list, totOf, nowOf) {
    const k = P.sort,
      t = (z) => totOf(z) ?? 1e9;
    const by =
      k === "p10"
        ? (a, b) => p10Of(b.r) - p10Of(a.r) || t(a) - t(b)
        : k === "stn"
          ? (a, b) => stnD(a.r) - stnD(b.r) || t(a) - t(b)
          : (a, b) => early(a.r) - early(b.r) || t(a) - t(b) || (nowOf(a) ?? 1e9) - (nowOf(b) ?? 1e9);
    return list.slice().sort(by);
  }
  const isEst = (r) => !!(OV[r.id] && OV[r.id].est);
  const estBadge = (r) =>
    `<span class="zb est" title="주변 빌라 실거래가 적어, 같은 구(${esc(r.g)}) 다른 구역 주변 빌라 실거래 가운데 값 ${e2(OV[r.id].price)}억을 매수가로 넣은 추정이에요(구역 ${EST_N[r.g] || 0}곳의 가운데 값). 실제 매물가와 다를 수 있어요.">구 평균 시세로 추정</span>`;
  function zoneCard(r, o) {
    const si = r.st || r.ll ? stnInfo(r) : null,
      hj = nearHojae(r).length,
      p = r.eta?.p10;
    const loc = `${esc(r.g)} ${esc(dongOf(r) || (r.bj || r.j || "").split(" ")[0])}`;
    const loss = o.loss
      ? '<span class="zb warn" title="입주 때 신축 시세 추정이 들어간 돈보다 낮아요(시세 상승 0% 가정).">입주 때 시세가 들어간 돈보다 낮게 추정</span> '
      : "";
    const pub =
      gapMode() && /공공재개발/.test(r.n)
        ? '<span class="zb warn" title="공공재개발 후보지 상당수가 토지거래허가구역으로 지정돼 왔어요(2026년 1월까지 확인). 지정돼 있으면 실거주 의무로 전세 끼고 사기가 어려워요. 계약 전 구청에서 지금 지정 여부를 확인하세요.">공공재개발: 토지거래허가 여부 확인</span> '
        : "";
    const rent = /장기전세|공공임대/.test(r.n)
      ? '<span class="zb" title="구역 이름의 장기전세·공공임대는 사업 방식 이름이에요. 조합원(입주권 보유자)은 일반 아파트를 받아요.">조합원은 일반 아파트</span> '
      : "";
    const early =
      p != null && p < 0.2
        ? '<span class="zb warn" title="10년 안 준공 가능성이 20% 미만인 초기 단계 구역이에요. 순서가 위라고 추천하는 뜻은 아니에요.">초기 단계·불확실</span>'
        : "";
    const meta = [
      si ? (si.min > 25 ? `${esc(si.n)}역 ${(si.d / 1e3).toFixed(1)}km` : `${esc(si.n)}역 도보 ${si.min}분`) : "역 정보 없음",
      `호재 ${hj}`,
      p != null ? `10년 준공 ${prob(p)}%` : "준공 확률 산정 전",
    ].join(" · ");
    const tot = o.tot != null ? `<b class="zc-big">${f1(o.tot)}<i>억</i></b>` : `<b class="zc-big na">계산 전</b>`;
    const over = o.tot != null && o.tot > CASH + 1e-9 ? `<span class="zc-more">입주까지 내 현금보다 ${f1(o.tot - CASH)}억 더</span>` : "";
    return `<article class="zc" data-card="${r.id}">\n    <div class="zc-1"><h3 title="${esc(r.n)}">${esc(shortName(r.n))}</h3><span class="zc-loc">${loc}</span>${stagePill(r)}</div>\n    <div class="zc-2"><span class="zc-k">③ ${LBL.cashToMoveIn}</span>${tot}<span class="zc-now">① 지금 <b>${o.now != null ? f1(o.now) + "억" : "–"}</b></span>${over}</div>\n    <div class="zc-3">${pub}${loss}${rent}${early ? early + " " : ""}${meta}</div>\n    <div class="zc-act">${favBtn(r, "sm ic")}${o.badge || ""}<button type="button" class="go" data-open="${r.id}">리포트<span class="sr-only">: ${esc(shortName(r.n))}</span> <span aria-hidden="true">→</span></button></div>\n  </article>`;
  }
  function ansHTML(o) {
    const tile = (n, k, v, sub, cls) =>
      `<li class="pt ${cls || ""}"><span class="pt-k"><i>${n}</i>${k}</span><b class="pt-v">${v || "–"}</b><small>${sub}</small></li>`;
    return `<div class="ans pa${o.n ? "" : " zero"}">\n    <p class="pa-l">${o.stale ? '<span class="lowp">금액을 확인해 주세요 · 마지막 유효값 기준</span> ' : ""}${o.lab}</p>\n    <p class="pa-n"><b>${fmt(o.n)}</b><span>곳</span>${o.side ? `<span class="pa-side">${o.side}</span>` : ""}</p>\n    ${o.n ? `<ol class="ptl" aria-label="언제 얼마가 필요한지">${tile("1", "지금", o.t1, o.s1)}${tile("2", "이주 때", o.t2, o.s2, o.t2z ? "z" : "")}${tile("3", LBL.cashToMoveIn, o.t3, o.s3, "hi")}</ol>` : o.empty || ""}\n    <p class="pa-honest">${o.honest}</p>\n    <div class="pa-act">${o.n ? `<a class="btn primary pa-go" href="#results" data-jump="results">${fmt(o.n)}곳 보기<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>` : ""}${o.alt || ""}</div>\n  </div>`;
  }
  function setMore(html, sub) {
    const b = $("plMoreBody");
    if (b) setHTML(b, html);
    if ($("plMoreS")) $("plMoreS").textContent = sub;
  }
  function listHTML(cards, total, more) {
    return `${cards.length ? `<div class="zl">${cards.map((h, i) => h + (i === leadAt2() ? leadCard("in-list") : "")).join("")}</div>` : ""}${more}`;
  }
  const leadAt2 = () => 2;
  function resHead(base, nAll, nShown, nFit) {
    $("resTitle").innerHTML =
      `${base} <b>${fmt(nAll)}곳</b>${nFit != null ? (nFit ? `<span class="rt-f"> · 입주까지 되는 곳 <b>${fmt(nFit)}곳</b></span>` : `<span class="rt-f rt-0"> · 입주까지 ${e2(CASH)}억 안에 끝나는 곳은 아직 없어요</span>`) : ""}${LF ? `<span class="rt-f"> · ${LF_LAB[LF]} ${fmt(nShown)}곳</span>` : ""}`;
  }
  function planGap(stale) {
    const all = baseList(),
      gs = all.map(gapOf);
    const ok = gs.filter((g) => !g.r.lc && !g.block && !g.na && g.now <= CASH);   // 홈 숫자와 같게 참고값(lc) 제외
    const blocked = gs.filter((g) => g.block && !g.na && g.block !== "계산 대상 아님" && g.now <= CASH);
    AFF = new Set(ok.map((g) => g.r.id));
    LAST = ok.map((g) => g.x);
    const withTot = ok.filter((g) => g.x.ok);
    const cheap = withTot.slice().sort((a, b) => a.total - b.total)[0];
    const lv = [1, 2, 3, 5].map((c) => [c, gapCount(c)]);
    const nextLv = lv.find(([c, n]) => c > CASH && n > ok.length);
    const estN = P.est ? ok.filter((g) => isEst(g.r)).length : 0;
    keepFocus(() => {
      setHTML(
        $("maxBox"),
        ansHTML({
          stale,
          n: ok.length,
          lab: `전세 끼고 <b>${e2(CASH)}억</b>으로 지금 살 수 있는 곳`,
          side: estN ? `추정 구역 ${fmt(estN)}곳 포함` : "",
          t1: rng(ok.map((g) => g.now)),
          s1: "매수가 − 전세금 + 취득세",
          t2: withTot.length && withTot.every((g) => g.reloc < 0.05) ? "추가 없음" : rng(withTot.map((g) => g.reloc)),
          t2z: withTot.length && withTot.every((g) => g.reloc < 0.05),
          s2: (() => {
            const ex = withTot.length ? Math.max(...withTot.map((g) => (g.relocAlt ?? g.reloc) - g.reloc)) : 0;
            return "전세금 반환 − 이주비 대출(추정)" + (ex >= 0.05 ? ` · 대출을 감정가 기준으로만 잡으면 최대 ${f1(ex)}억 더` : "");
          })(),
          t3: rng(withTot.map((g) => g.total)),
          s3: cheap ? `가장 적은 곳 ${esc(shortName(cheap.r.n))} ${f1(cheap.total)}억` : "입주까지 계산된 곳 없음",
          honest: `전세를 끼면 지금 드는 돈은 줄지만, 이주 때 전세금을 돌려줘야 해서 ${LBL.cashToMoveIn}은 현금으로 살 때와 비슷해요.${withTot.length < ok.length ? ` ${fmt(ok.length - withTot.length)}곳은 입주 시점·신축 시세 자료가 부족해 ③을 계산하지 않았어요.` : ""}`,
          empty: `<div class="pa-empty"><p>전세 끼고 ${e2(CASH)}억으로 지금 살 수 있는 곳이 아직 없어요.${nextLv ? ` ${nextLv[0]}억이면 ${fmt(nextLv[1])}곳이에요.` : ""}</p></div>`,
          alt:
            !ok.length && nextLv
              ? `<button type="button" class="btn secondary" data-cash="${nextLv[0]}">${nextLv[0]}억으로 보기</button>`
              : "",
        }),
      );
    });
    setMore(
      `<div class="pm-lv"><p class="pm-h">금액별 전세 끼고 살 수 있는 곳</p><div class="gap-lv" role="group" aria-label="금액별 전세 끼고 살 수 있는 곳">${lv.map(([c, n]) => `<button type="button" data-cash="${c}" aria-pressed="${Math.abs(c - CASH) < 1e-9}"><span>${c}억</span><b>${fmt(n)}곳</b></button>`).join("")}</div></div>\n      ${blocked.length ? `<p class="pm-p">금액으로는 되지만 토지거래허가(실거주 2년)·입주권 문제로 전세를 끼고 살 수 없는 곳 <b>${fmt(blocked.length)}곳</b>은 목록 아래에 따로 모았어요.</p>` : ""}\n      <ul class="gap-as">\n        <li>전세가 = 매수가 × 전세가율 (${P.jr != null ? `직접 설정 ${fmt(P.jr, 1)}%` : `구역 경계 안 실거래로 전세가율을 구할 수 있는 곳은 그 값, 나머지는 서울 연립·다세대 평균 ${JR_SEOUL}%(도봉 83.7·강서 76.6·금천 70.3·종로 65.6%는 자치구 값, 2026.3)`}). 노후 빌라는 실제 전세가율이 더 낮은 경우가 많아요 → 리포트에서 실제 전세금을 넣어 보세요.</li>\n        <li>제외: 토지거래허가(실거주 2년)로 전세 낀 매수가 막힌 곳, 입주권이 안 나오는 곳, 이주·철거가 시작된 곳${P.est ? "" : ", 주변 빌라 거래가 적어 매수가를 못 정한 곳(조건 더 보기 → 추정 구역 포함)"}.</li>\n        <li>이주비 대출 = min(전세금, 6억, 40% × max(종전자산평가액, 조합원 분양가)) · 다주택은 0 · 조합·은행에 따라 다름 (추정).</li>\n        <li>이주 시점 = 예상 입주 − 착공→준공 가운데 값 ${CJ().toFixed(1)}년 (추정) · 이주비 대출 이자는 이주~입주 동안.</li>\n        <li>취득세는 보유 주택 수 기준 · 매수 대출 없음 · 시세 상승 0% 가정 · 투자 권유 아님.</li>\n      </ul>\n      <p class="gap-src">출처: ${GAP_SRC.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(t)}</a>`).join(" · ")}</p>`,
      "금액별 곳 수·가정·출처",
    );
    $("qAns").innerHTML =
      `<span>전세 끼고 ${e2(CASH)}억이면 <b>${fmt(ok.length)}곳</b></span><a href="#maxBox" class="qa-go">결과 보기</a>`;
    NEED = new Map(gs.map((g) => [g.r.id, g.na || g.block ? null : g.now]));
    XOF = new Map(gs.map((g) => [g.r.id, g.x]));
    $("condSum").textContent = condText();
    drawRank();
    refreshMap();
    syncURL();
    if (cur && reportReady) renderReport();
    $("results").hidden = false;
    const fl = LF ? ok.filter((g) => LF_FN[LF](g.r)) : ok;
    resHead(
      `전세 끼고 ${e2(CASH)}억으로 지금 계약할 수 있는 구역`,
      ok.length,
      fl.length,
      withTot.filter((g) => g.total <= CASH + 1e-9).length,
    );
    {
      const mn = withTot.length ? Math.min(...withTot.map((g) => g.total)) : null,
        fit = withTot.filter((g) => g.total <= CASH + 1e-9).length;
      $("resSub").textContent =
        (!fit && mn != null ? `입주까지 가려면 가장 적은 곳도 약 ${f1(mn)}억이 들어요 · ` : "") +
        `'입주까지 되는 곳'은 이주 때 전세금 반환과 분담금까지 ${e2(CASH)}억 안에 드는 곳이에요 · 추정치${num("pIncome") == null ? " · 연소득 미입력이라 잔금대출을 최대로 잡았어요" : ""}`;
    }
    $("resSub").hidden = false;
    const sorted = sortZ(
      fl,
      (g) => (g.x.ok ? g.total : null),
      (g) => g.now,
    );
    const shown = sorted.slice(0, planN);
    const badge = (g) =>
      isEst(g.r)
        ? estBadge(g.r)
        : g.x.ok && g.gain <= -0.3
          ? '<span class="zb dn" title="입주 때 시세가 지금 그대로면(상승 0% 가정) 총비용보다 낮아요">손실 예상</span>'
          : "";
    keepFocus(() => {
      setHTML(
        $("planList"),
        listHTML(
          shown.map((g) => zoneCard(g.r, { tot: g.x.ok ? g.total : null, now: g.now, badge: badge(g) })),
          fl.length,
          `${!shown.length ? `<div class="t-empty"><b>${LF ? `${LF_LAB[LF]} 중에는 없어요` : `전세 끼고 ${e2(CASH)}억으로 살 수 있는 곳이 아직 없어요`}</b><p>${LF ? "유형 거르기를 풀어 보세요." : "금액을 올리거나 전세가율을 바꿔 보세요."}</p></div>` : ""}${fl.length > planN ? `<button type="button" class="btn-more" id="planMore">${fmt(Math.min(12, fl.length - planN))}곳 더 보기 · 남은 ${fmt(fl.length - planN)}곳</button>` : ""}\n    ${
            blocked.length
              ? `<details class="early gblk"><summary><b>전세 낀 매수 불가</b><span class="cnt">${fmt(blocked.length)}곳</span><small>금액으로는 되지만 토지거래허가(실거주 2년)·입주권 문제로 전세를 끼고 살 수 없는 구역</small></summary><ul class="gblk-l">${blocked
                  .slice(0, 40)
                  .map(
                    (g) =>
                      `<li><button type="button" class="linklike" data-open="${g.r.id}">${esc(shortName(g.r.n))}</button><small>${esc(g.r.g)}</small><span>${esc(g.block)}</span></li>`,
                  )
                  .join("")}</ul></details>`
              : ""
          }`,
        ),
      );
    });
    const pm = $("planMore");
    if (pm)
      pm.onclick = () => {
        planN += 12;
        plan();
      };
    bindCards($("planList"));
    if (window.__t3) window.__t3();
    refreshFades();
  }
  function gapStrip(r) {
    const g = gapOf(r);
    if (g.block === "계산 대상 아님") return "";
    if (g.block) {
      // 전세 끼고는 안 되면 대출 끼고 사는 길을 바로 보여 준다
      let alt = "";
      try { const x = investC(r); if (x && x.needBuy != null && !r.lc && r.tag !== "mk") alt = `<b class="gb-alt">대출 끼고 사면 지금 ${f1(x.needBuy)}억${x.ok && !noTicket(r) ? ` · 입주까지 ${f1(x.needTotal)}억` : ""}</b>`; } catch (e) {}
      return `<p class="cstrip gblock"><span>전세 끼고 사기 <b class="gb-t">불가</b></span>${alt}<small>${esc(g.block)}</small></p>`;
    }
    if (g.na)
      return `<p class="cstrip na"><span>전세 끼고 지금 필요한 돈</span><b>–</b><small>${noPriceTxt(r)}</small></p>`;
    return `<div class="cstrip gstrip ${CASH - g.now >= -0.05 ? "ok" : "short"}"><span>전세 끼고 사면${isEst(r) ? `<span class="zb est">구 평균 시세로 추정${P.est ? "" : " · 곳 수 제외"}</span>` : ""}</span><b>${g.now <= CASH + 0.05 ? `지금 ${f1(g.now)}억이면 계약 가능` : `지금 ${f1(g.now)}억 필요 <em class="gs-sh">${f1(g.now - CASH)}억 모자라요</em>`}</b><small class="gs-2">${g.x.ok ? `입주까지 현금 ${f1(g.total)}억${g.total > CASH ? ` · 내 돈 ${e2(CASH)}억 빼면 ${f1(g.total - CASH)}억 더` : ""}` : "입주까지는 계산 전"}</small></div>`;
  }
  function gapFrame(g) {
    const ok = g.now <= CASH + 1e-9;
    const a = ok
      ? `지금 ${f1(g.now)}억이면 계약 가능(내 현금 ${e2(CASH)}억 안)`
      : `지금 ${f1(g.now)}억 필요 · 내 현금보다 ${f1(g.now - CASH)}억 부족`;
    if (!g.x.ok) return `${a} · 입주까지는 계산 전`;
    return `${a} · 입주까지 현금 ${f1(g.total)}억${g.total > CASH ? ` → 입주 전까지 ${f1(g.total - CASH)}억 더 필요` : ""}`;
  }
  function gapPaneHTML(r) {
    const g = gapOf(r);
    if (g.block || g.na)
      return g.block && g.block !== "계산 대상 아님"
        ? `<div class="gpane"><p class="note riskbox"><b>전세 끼고 사기 불가</b> ${esc(g.block)}</p></div>`
        : "";
    return `<div class="gpane"><h3>전세 끼고 사면 <small>언제 얼마가 필요한지</small></h3>\n    ${/공공재개발/.test(r.n) ? '<p class="note riskbox"><b>먼저 확인</b> 공공재개발 후보지 상당수가 토지거래허가구역으로 지정돼 왔어요(2026년 1월까지 확인). 지금도 지정돼 있으면 실거주 의무 때문에 전세 끼고 사기가 어려워요. 계약 전 구청에 지정 여부를 물어보세요.</p>' : ""}\n    ${gapTL(g, false)}${g.x.ok ? cashBr(g.total, g.x.loanEnd, g).html : ""}${g.relocAlt != null && g.relocAlt - g.reloc >= 0.05 ? `<p class="t-note">이주비 대출을 감정가만 기준으로 잡으면 이주 때 ${f1(g.relocAlt - g.reloc)}억이 더 필요해요(조합·은행마다 기준이 달라요).</p>` : ""}\n    <p class="gap-honest">${gapLine}</p>\n    <div class="gj-f"><label for="gJ">이 매물 전세금 <small>${g.userJ ? "직접 입력" : `기본 = 매수가 × ${fmt(g.jr, 1)}% (${esc(jrSrcTxt(r))})`}</small></label><div class="inp"><input id="gJ" inputmode="decimal" placeholder="${e2(g.D)}" value="${OV[r.id]?.jeonse ?? ""}"><span>억</span></div>${g.userJ ? '<button type="button" class="btn text sm" id="gJx">초기화</button>' : ""}</div>\n    <p class="t-note">이주비 대출·이주 시점은 추정(조합·은행에 따라 다름) · 입력값 기준 계산 · 투자 권유 아님</p></div>`;
  }
  function gapBigrow(r) {
    const g = gapOf(r),
      p = $("pane");
    if (g.block || g.na || !g.x.ok) return;
    const c = p.querySelector(".bigrow .big.cash");
    if (c)
      c.outerHTML = `<div class="big cash"><span>전세 끼고 입주까지 현금</span><b>${f1(g.total)}억</b><small>${esc(gapFrame(g))}</small></div>`;
    const gn = p.querySelector(".bigrow .big.gain");
    if (gn)
      gn.outerHTML = `<div class="big gain ${g.gain >= 0.05 ? "up" : g.gain <= -0.05 ? "dn" : ""}"><span>입주 때 시세 차이 (전세 끼고 산 경우·추정)</span><b>${sg(g.gain)}억</b><small>${g.gain > -0.3 && g.gain < 0.3 ? "시세 그대로면 차익 거의 없음 · " : ""}${g.x.annual != null ? `연수익 ${pcIrr(g.x.annual)}(현금으로 샀을 때) · ` : ""}추정 · 시세 상승 0% 가정</small></div>`;
    // 비례율 표도 위 큰 숫자와 같은 '전세 끼고' 기준(차이 = 매수대출 이자 대신 이주비 이자 · 비례율과 무관한 상수)
    const sb = $("mSens");
    if (sb && isFinite(g.x.gain)) {
      const dg = g.gain - g.x.gain, cap = sb.closest(".sect") && sb.closest(".sect").querySelector("h3 small");
      if (cap) cap.textContent = "전세 끼고 산 경우 · 나머지 조건 고정";
      sb.querySelectorAll("tr").forEach((tr) => {
        const v = parseFloat(tr.cells[0].textContent), save = AV.aRatio;
        AV.aRatio = v; const y = invest(r); AV.aRatio = save;
        const gg = y.gain + dg, sp = tr.cells[1].querySelector("span:last-child");
        if (sp) { sp.textContent = `${sg(gg)}억`; sp.className = gg >= 0.05 ? "up" : gg <= -0.05 ? "dn" : ""; }
      });
    }
    // 다리 줄·합계·세금이자 칸도 '전세 끼고' 숫자로(위 타임라인 '총'과 같은 값)
    const br = cashBr(g.total, g.x.loanEnd, g), bw = p.querySelector(".cash-brw");
    if (bw) { bw.innerHTML = br.html; bw.hidden = !!p.querySelector(".gpane .cash-br"); }   // 위 타임라인 밑에 이미 있으면 한 번만
    const ftot = p.querySelector(".fx-tot dd"), fti = p.querySelector(".fx-ti dd");
    if (ftot && br.s != null) ftot.innerHTML = `${f1(br.s)}억<small>매수가 + 취득세 + 분담금 + 세금·이자(이주비 이자 포함) · 전세 끼고 산 경우</small>`;
    if (fti) fti.innerHTML = `${e2(g.x.origTax + g.x.midInt + g.intM)}억<small>원시취득세 ${won(g.x.origTax)} · 중도금 이자 ${won(g.x.midInt)} · 이주비 대출 이자 ${won(g.intM)} (전세 끼고 산 경우)</small>`;
    const fl = p.querySelector("details.flow");
    if (fl)
      fl.innerHTML = `<summary><b>필요 돈 계산식 (갭)</b></summary><p>① 지금 = 매수가 ${e2(g.x.price)} + 취득세 ${taxT(g.x.tax)} − 전세 ${e2(g.D)} = ${f1(g.now)}억 · ② 이주 = 전세 ${e2(g.D)} − 이주비 대출 ${e2(g.M)} = ${f1(g.reloc)}억 · ③ ${LBL.cashToMoveIn} = 매수가·취득세 + 분담금 ${e2(g.x.contrib)} + 원시취득세·중도금 이자·이주비 이자 ${e2(g.x.origTax + g.x.midInt + g.intM)} − 잔금대출 ${e2(g.x.loanEnd)} = ${f1(g.total)}억 (0.1억 단위 반올림)</p>`;
  }
  function gapPaneBind(r) {
    const i = $("gJ");
    if (!i) return;
    i.addEventListener("change", () => {
      const v = parseFloat(i.value);
      OV[r.id] = OV[r.id] || {};
      if (isFinite(v) && v >= 0) OV[r.id].jeonse = v;
      else delete OV[r.id].jeonse;
      GCACHE = new Map();
      plan();
    });
    const x = $("gJx");
    if (x)
      x.onclick = () => {
        if (OV[r.id]) delete OV[r.id].jeonse;
        GCACHE = new Map();
        plan();
      };
  }
  function syncFundUI() {
    setSeg("pFund", P.fund);
    document.querySelectorAll("[data-fundset]").forEach((b) => {
      if (b.closest(".ans-mode")) b.setAttribute("aria-pressed", String(b.dataset.fundset === P.fund));
    });
    $("gapCtl").hidden = P.fund !== "gap";
    document.documentElement.classList.toggle("gapm", P.fund === "gap");
    $("fundH").textContent = P.fund === "gap" ? "세입자 전세금을 안고 사서, 이주 때 돌려주고 입주까지" : "현금·대출로 사서 입주까지";
    $("gJrV").textContent = P.jr != null ? `${fmt(P.jr, 0)}% (모든 구역)` : "자치구 평균 (기본)";
    $("gJrReset").hidden = P.jr == null;
    if (P.jr != null) $("gJr").value = P.jr;
  }
  function setFund(v) {
    P.fund = v === "gap" ? "gap" : "cash";
    syncFundUI();
    planN = PLAN0();
    plan();
  }
  $("pFund")
    .querySelectorAll("button")
    .forEach((b) => (b.onclick = () => setFund(b.dataset.v)));
  $("gJr").addEventListener("input", () => {
    P.jr = +$("gJr").value;
    GCACHE = new Map();
    syncFundUI();
    plan();
  });
  $("gJrReset").onclick = () => {
    P.jr = null;
    GCACHE = new Map();
    syncFundUI();
    plan();
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-cashgo]");
    if (!b) return;
    e.preventDefault();
    $("pCash").value = b.dataset.cashgo;
    setFund("cash");
    jumpTo("planner");
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-jumplead]");
    if (!b) return;
    e.preventDefault();
    const el = [...document.querySelectorAll("#maxBox .lead, #planList .lead, #leadRes .lead")].find((x) => x.offsetParent !== null);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - HDR() - 16, behavior: smooth() });
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-fundset]");
    if (!b) return;
    e.preventDefault();
    if (P.fund === b.dataset.fundset) return;
    setFund(b.dataset.fundset);
    const m = $("maxBox");
    if (m && m.getBoundingClientRect().top < HDR()) jumpTo("planner");
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-gapgo]");
    if (!b) return;
    e.preventDefault();
    if (b.dataset.cash) {
      $("pCash").value = b.dataset.cash;
    }
    setFund("gap");
    jumpTo("planner");
  });
  function plan() {
    readAV();
    lastRaw = $("pCash").value;
    const c = readCash();
    $("pCash").classList.toggle("bad", c.bad || c.big);
    $("pCash").setAttribute("aria-invalid", String(c.bad || c.big));
    $("cashErr").hidden = !(c.bad || c.big);
    $("cashErrT").textContent = c.big
      ? "100억이 넘어요. 억 단위로 입력하세요 (예: 3.5). 만원·원 단위는 입력을 마치면 자동으로 바꿔요."
      : "현금은 0보다 큰 숫자로 입력 (예: 3.5)";
    const stale = c.bad || c.big;
    if (!stale) {
      CASH = c.cv;
      lastValidCash = CASH;
    }
    ["maxBox", "results", "cashfig"].forEach((id) => {
      const el = $(id) || document.querySelector("." + id);
      if (el) el.classList.toggle("stale", stale);
    });
    $("staleNote").hidden = !stale;
    $("staleNote").textContent = `입력값을 확인하세요 · 아래 결과는 마지막 유효값 ${e2(lastValidCash)}억 기준`;
    $("incErr").hidden = !AV.incomeBad;
    sizeCash();
    $("cashQuick")
      .querySelectorAll("button")
      .forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.v === CASH)));
    MAXP = maxBuy(CASH);
    {
      const cf = document.querySelector(".cashfig");
      if (cf) cf.hidden = gapMode();
    }
    if (gapMode()) {
      planGap(stale);
      return;
    }
    const afford = $("pAfford").checked,
      gu = $("pGu").value;
    const all = baseList().map(investC);
    const needOf = (x) => (P.basis === "total" ? (x.ok ? x.needTotal : null) : x.needBuy);
    const okNow = all.filter((x) => !x.r.lc && x.needBuy != null && x.needBuy <= CASH),   // 홈 숫자와 같게 참고값(lc) 제외
      okTotal = all.filter((x) => !x.r.lc && x.ok && x.needTotal <= CASH);
    const ok = P.basis === "total" ? okTotal : okNow;
    AFF = new Set(ok.map((x) => x.r.id));
    const list = afford ? ok.slice() : all.slice();
    const S = {
      rec: (a, b) =>
        (a.tier ?? 3) - (b.tier ?? 3) ||
        (a.ok && a.gain <= 0) - (b.ok && b.gain <= 0) ||
        !!a.held - !!b.held ||
        (b.rec ?? -9) - (a.rec ?? -9) ||
        (b.r.comp || 0) - (a.r.comp || 0),
      gain: (a, b) => (b.ok ? b.gain : -99) - (a.ok ? a.gain : -99),
      eta: (a, b) => (a.r.eta?.eMid || "9999").localeCompare(b.r.eta?.eMid || "9999") || (b.rec ?? -9) - (a.rec ?? -9),
      cash: (a, b) => (needOf(a) ?? 999) - (needOf(b) ?? 999),
    };
    const main = list.filter((x) => x.ok && x.annual != null && buyWindow(x.r).cls !== "no").sort(S.rec);
    const early = list.filter((x) => !main.includes(x)).sort(S.rec);
    LAST = main;
    TOP = ok.filter((x) => x.tier === 0).sort(S.rec)[0] || null;
    const best =
      TOP || ok.filter((x) => x.tier === 1 && !x.held && x.annual != null && x.gain > 0 && (x.r.eta?.p10 ?? 0) >= 0.05).sort(S.rec)[0];
    const unlock = TOP ? null : all.filter((x) => x.tier === 0 && needOf(x) != null).sort((p, q) => needOf(p) - needOf(q))[0];
    const ln = loanOn(MAXP, MAXP);
    const passN = ok.filter((x) => x.tier === 0).length;
    const okMain = ok.filter((x) => x.ok && x.annual != null && buyWindow(x.r).cls !== "no").length;
    const basisLab = P.basis === "total" ? "입주까지" : "지금 매수";
    const tightTxt = (z) => {
      const lf = CASH - needOf(z);
      return lf < 0.5 - 1e-9 ? ` · <span class="lowp">빠듯 (여유 ${won(Math.max(0, lf))})</span>` : "";
    };
    const zline = (z) =>
      `${sg(z.gain)}억 <span class="est2">(추정·시세 상승 0% 가정)</span> · 연 ${pcIrr(z.annual)} · 준공 ${prob(z.r.eta?.p10)}%`;
    const unlockCash = unlock ? Math.ceil(needOf(unlock) * 10) / 10 : null;
    const otherTxt = P.basis === "total" ? "매수까지만 보면" : "입주까지 보면",
      otherN = P.basis === "total" ? okNow.length : okTotal.length;
    CHEAP = cheapestOf(all, needOf);
    const cheapest = CHEAP;
    let profitMin =
      cheapest && cheapFlag(cheapest)
        ? all.filter((x) => needOf(x) != null && x.annual != null && x.gain >= 0.05).sort((p, q) => needOf(p) - needOf(q))[0]
        : null;
    if (profitMin && profitMin.r.id === cheapest.r.id) profitMin = null;
    const passAll = all.filter((x) => x.tier === 0).length;
    const inc = num("pIncome");
    const usePool = ok.length ? ok : cheapest ? [cheapest] : [];
    const usedLoan = usePool.reduce((m, x) => Math.max(m, x.loanNow || 0, x.ok ? x.loanEnd || 0 : 0), 0);
    const usedEnd = usePool.some((x) => x.ok && x.loanEnd >= usedLoan - 1e-9 && x.loanEnd > 0.05);
    const dsrWarn =
      inc === 0
        ? `<p class="ans-warn" role="note"><span class="wi" aria-hidden="true"></span>연소득 0 → DSR상 은행 대출 0으로 계산했어요 (매수·입주 잔금 모두 현금)</p>`
        : inc == null && usedLoan > 0.05
          ? `<p class="ans-cap">연소득 미입력 → DSR 미반영 · ${ok.length ? "이 구역들은" : "이 구역은"} ${usedEnd ? "입주 잔금대출" : "대출"} 최대 ${e2(usedLoan)}억 가정 (${e2(usedLoan)}억 받으려면 연소득 약 ${incTxt(usedLoan)} 필요)</p>`
          : "";
    const revert =
      PREV_CASH != null && PREV_CASH !== CASH
        ? `<button type="button" class="btn text sm rev" data-cash="${PREV_CASH}" data-rev="1">← ${e2(PREV_CASH)}억으로 되돌리기</button>`
        : "";
    document.querySelector(".cashfig figcaption b").textContent = `현금별로 ${basisLab} 가능한 구역 수`;
    const maxLine = `최대 매수가 ${e2(MAXP)}억 (대출 ${e2(ln)}억 · 매수가 전액을 담보로 인정할 때)`;
    const gapN = gapCount(CASH),
      gapCta =
        gapN > ok.length
          ? `<button type="button" class="btn primary gapcta" data-fundset="gap">전세 끼고 사면 ${e2(CASH)}억으로 ${fmt(gapN)}곳 보기 →</button>`
          : "";
    let qa,
      empty = "",
      alt = "";
    if (!ok.length) {
      const acts = [];
      let n;
      const n59 = P.unit === 84 ? computeOk({ P: { unit: 59 } }) : 0;
      const nBoth = P.unit === 84 && !P.first && P.homes === 0 ? computeOk({ P: { unit: 59, first: 1 } }) : 0;
      const nFirst = !P.first && P.homes === 0 && P.unit === 59 ? computeOk({ P: { first: 1 } }) : 0;
      if (gapN > 0) acts.push({ label: `전세 끼고 사면 ${e2(CASH)}억으로 ${fmt(gapN)}곳 보기 →`, attr: 'data-fundset="gap"' });
      if (n59) acts.push({ label: "59㎡로 보기", n: n59, attr: 'data-alt="unit59"' });
      if (nBoth > n59) acts.push({ label: "생애최초 대상이면 · 59㎡", n: nBoth, attr: 'data-alt="both"' });
      if (nFirst) acts.push({ label: "생애최초 대상이면", n: nFirst, attr: 'data-alt="first"' });
      if (cheapest) {
        const cc = Math.ceil(needOf(cheapest) * 10) / 10,
          fl = cheapFlag(cheapest);
        acts.push({
          label: `${e2(cc)}억이면 어떻게 되나 보기${fl ? ` <small class="flag">${fl} 구역</small>` : ""}`,
          attr: `data-cash="${cc}"`,
        });
      }
      if (P.basis === "total" && (n = computeOk({ P: { basis: "now" } })))
        acts.push({ label: "매수까지만 보기 (입주까지는 부족)", n, attr: 'data-alt="now"' });
      acts.forEach((a, i) => {
        a.primary = i === 0;
      });
      empty = `<div class="pa-empty"><p>${cheapest ? cheapSentence(cheapest, needOf(cheapest), P.basis === "total" ? "입주까지" : "지금") : ""}${profitMin ? ` 수익이 계산되는 곳 중에서는 <b>${esc(shortName(profitMin.r.n))}</b> ${e2(needOf(profitMin))}억부터예요.` : ""}${P.homes === 3 || P.homes === 2 ? " 규제지역 다주택은 주담대가 막혀(LTV 0%) 현금이 많이 필요해요." : ""}</p></div>`;
      alt = `<div class="es-acts">${acts.map((a) => `<button type="button" class="btn ${a.primary ? "primary" : "secondary"}" ${a.attr}>${a.label}${a.n != null ? ` <b>${fmt(a.n)}곳</b>` : ""}</button>`).join("")}</div>`;
      qa = `${basisLab} <b>0곳</b>${cheapest ? ` · 가장 적게 드는 곳 ${e2(needOf(cheapest))}억` : ""}`;
    } else qa = `${basisLab} <b>${fmt(ok.length)}곳</b>`;
    const okT = ok.filter((x) => x.ok),
      cheapT = okT.slice().sort((p, q) => p.needTotal - q.needTotal)[0];
    const estN = P.est ? ok.filter((x) => isEst(x.r)).length : 0;
    keepFocus(() => {
      setHTML(
        $("maxBox"),
        ansHTML({
          stale,
          n: ok.length,
          lab: `현금 <b>${e2(CASH)}억</b>으로 ${P.basis === "total" ? "입주까지 감당할 수 있는 곳" : "지금 살 수 있는 곳"}${revert}`,
          side: estN ? `추정 구역 ${fmt(estN)}곳 포함` : "",
          t1: rng(ok.map((x) => x.needNow)),
          s1: "매수가 + 취득세 − 매수 대출",
          t2: "추가 없음",
          t2z: true,
          s2: "돌려줄 전세금 없음 · 분담금은 입주 때",
          t3: rng(okT.map((x) => x.needTotal)),
          s3: cheapT ? `가장 적은 곳 ${esc(shortName(cheapT.r.n))} ${f1(cheapT.needTotal)}억` : "입주까지 계산된 곳 없음",
          honest: `③은 분담금·세금·이자를 더하고 입주 잔금대출을 뺀 추정치예요 · 시세 상승 0% · 대출 한도는 현행 규제 기준${inc == null ? " · 연소득을 넣으면 DSR까지 반영" : ""}.`,
          empty,
          alt: ok.length && ok.length < 20 && gapCta ? gapCta.replace("btn primary gapcta", "btn secondary gapcta") : alt,
        }) + (ok.length ? "" : ""),
      );
      $("maxBox").setAttribute("aria-disabled", String(stale));
    });
    const next = TOP
      ? `<button type="button" class="ans-top" data-go="${TOP.r.id}"><span><span class="t1">연수익 3%·준공 30% 넘는 곳 중 1순위</span><span class="t2">${esc(shortName(TOP.r.n))}</span><span class="t3">${zline(TOP)}${tightTxt(TOP)}</span></span><span class="go">보기 →</span></button>`
      : unlock
        ? `<div class="ans-next"><p>연수익 3%·10년 내 준공 30%를 넘는 곳은 <b>${e2(unlockCash)}억</b>부터 나와요 · 서울 전체 ${fmt(passAll)}곳<small>${esc(shortName(unlock.r.n))} · ${zline(unlock)}</small></p><div class="ans-acts"><button type="button" class="btn secondary sm" data-cash="${unlockCash}">${e2(unlockCash)}억이면 어떻게 되나 보기</button></div></div>`
        : "";
    setMore(
      `${dsrWarn}<div class="ans-row${passN ? "" : " one"}">\n      ${passN ? `<div><span>연수익 3%·준공 30% 넘는 곳</span><b class="okc">${fmt(passN)}곳</b><small>연수익 3%↑ · 10년 안 준공 가능성 30%↑</small></div>` : ""}\n      <div><span>${otherTxt}</span><b>${fmt(otherN)}곳</b><small>${maxLine}</small></div>\n    </div>${next}`,
      "대출·기준·다음 금액·현금별 곳 수",
    );
    $("qAns").innerHTML = `<span>${e2(CASH)}억이면 ${qa}</span><a href="#maxBox" class="qa-go">결과 보기</a>`;
    LADDER_ARGS = [all, needOf];
    drawLadder(all, needOf);
    NEED = new Map(all.map((x) => [x.r.id, needOf(x)]));
    XOF = new Map(all.map((x) => [x.r.id, x]));
    $("condSum").textContent = condText();
    const uTxt = num("aUnit") != null ? `신축 시세의 ${num("aUnit")}%` : "신축 시세에 따라 75%→42% (84㎡ 원가 하한 7억 · 59㎡ 5.2억)";
    $("resNoteList").innerHTML =
      `\n      <li>매수가: 구역 반경 300~800m 구축 빌라 또는 해당 단지의 국토부 실거래(서울 부동산정보광장, 계약 2025.10.1~2026.9.26) 가운데 값. 관리처분·이주 이후 구역은 입주권 호가 입력 필요${P.est ? " · 추정 구역은 같은 구 빌라 시세 가운데 값(구 평균 시세로 추정 배지)" : ""}</li>\n      <li>신축 시세: 반경 1.5km 안 2016년 이후 준공 아파트 ${P.unit}㎡ 실거래 가운데 값. 비교 거래 10건 미만이거나 84㎡가 59㎡보다 싸면 '표본 부족'으로 차익을 내지 않음</li>\n      <li>감정가: 빌라는 대지지분 × 공시지가 × 1.4(매수가의 95% 상한), 아파트는 세대당 대지지분 × 공시지가 × 1.35(시세의 75% 상한) · 권리가액 = 감정가 × 비례율 · 계수는 작성자 가정값</li>\n      <li>조합원 분양가: ${esc(uTxt)} · 작성자 가정값</li>\n      <li>필요 현금: 지금(매수가 + 취득세 − 매수대출) + 대출상환 + 분담금 + 세금·이자 − 입주 잔금대출(LTV ${Math.round(ltvEnd() * 100)}%${ltvEnd() ? "·가격구간 한도" : ""}${num("pIncome") != null ? "·DSR" : ""}) · 현행 규제(2025.10.16~) 기준</li>\n      <li>입주 시점·준공 확률: 서울 사업장 실제 인가일 생존분석. 해제 구역이 빠져 있어 다소 낙관적</li>\n      <li>${MISSING_COSTS}${num("pIncome") != null ? "" : " 연소득을 넣으면 DSR 한도 반영"}</li>`;
    drawRank();
    refreshMap();
    syncURL();
    if (cur && reportReady) renderReport();
    $("results").hidden = false;
    const flt = (xs) => (LF ? xs.filter((x) => LF_FN[LF](x.r)) : xs);
    const mainF = flt(main),
      earlyF = flt(early);
    const _fitN =
      afford && P.basis !== "total"
        ? main.concat(early).filter((x) => x.ok && x.needTotal != null && x.needTotal <= CASH + 1e-9).length
        : null;
    resHead(
      afford ? `현금 ${e2(CASH)}억으로 ${P.basis === "total" ? "입주까지 가능한" : "지금 계약할 수 있는"} 구역` : `${gu || "서울"} 구역`,
      main.length + early.length,
      mainF.length + earlyF.length,
      _fitN,
    );
    const _mn =
      _fitN === 0
        ? Math.min(
            ...main
              .concat(early)
              .filter((x) => x.ok && x.needTotal != null)
              .map((x) => x.needTotal),
          )
        : null;
    $("resSub").textContent =
      !main.length && !early.length
        ? ""
        : (_mn != null && isFinite(_mn) ? `입주까지 가려면 가장 적은 곳도 약 ${f1(_mn)}억이 들어요 · ` : "") +
          "③ 총액 = 입주까지 필요한 현금(잔금대출 뺀 값) · ① = 지금 필요한 현금 · 추정치" +
          (num("pIncome") == null
            ? " · 연소득을 넣지 않아 잔금대출을 규정상 최대로 잡았어요(넣으면 총액이 늘 수 있어요)"
            : " · 연소득 기준 DSR 한도를 반영했어요");
    $("resSub").hidden = !$("resSub").textContent;
    const sorted = sortZ(
      mainF,
      (x) => (x.ok ? x.needTotal : null),
      (x) => x.needNow,
    );
    const shown = sorted.slice(0, planN);
    const badge = (x) => {
      const r = x.r,
        lp = landPermit(r);
      return isEst(r)
        ? estBadge(r)
        : x.held
          ? `<span class="zb warn" title="${esc(x.lowPrem ? "사업시행인가 이후인데 프리미엄 추정이 권리가액의 20% 미만이에요. 실제 매물가를 리포트에 넣어 보세요." : chkText(r))}">${x.lowPrem ? "매수가 확인 필요" : "단계 확인 중"}</span>`
          : lp
            ? `<span class="zb warn" title="${esc(lp.d)}">토지거래허가</span>`
            : x.ok && x.gain <= -0.3
              ? '<span class="zb dn" title="입주 때 시세가 지금 그대로면(상승 0% 가정) 총비용보다 낮아요">손실 예상</span>'
              : "";
    };
    const card = (x) =>
      zoneCard(x.r, { tot: x.ok ? x.needTotal : null, now: x.needNow, badge: badge(x), loss: x.ok && x.gain != null && x.gain <= 0 });
    let listChanged = false;
    keepFocus(() => {
      listChanged = setHTML(
        $("planList"),
        listHTML(
          shown.map(card),
          mainF.length,
          `${!shown.length && !earlyF.length ? `<div class="t-empty"><b>${LF ? `${LF_LAB[LF]} 중에는 없어요` : `현금 ${e2(CASH)}억으로 ${basisLab} 가능한 곳이 아직 없어요`}</b><p>${LF ? "유형 거르기를 풀어 보세요." : "위 답 카드의 다음 금액이나 전세 끼고 보기를 눌러 보세요."}</p></div>` : ""}${mainF.length > planN ? `<button type="button" class="btn-more" id="planMore">${fmt(Math.min(12, mainF.length - planN))}곳 더 보기 · 남은 ${fmt(mainF.length - planN)}곳</button>` : ""}\n    ${earlyF.length ? `<details class="early" id="earlyBox"${mainF.length ? "" : " open"}><summary><b>입주 시점 미정</b><span class="cnt">${fmt(earlyF.length)}곳</span><small>입주 시점·매수가·신축 시세 표본이 없어 연수익을 계산하지 않은 구역</small></summary><div class="zl" id="earlyList">${!mainF.length ? earlyF.slice(0, 24).map(card).join("") : ""}</div>${earlyF.length > 24 ? `<p class="early-more">외 ${fmt(earlyF.length - 24)}곳은 지도에서 확인</p>` : ""}</details>` : ""}`,
        ),
      );
    });
    if (window.__t3) window.__t3();
    if (!listChanged) return;
    const eb = $("earlyBox");
    if (eb) {
      const fill = () => {
        if (!$("earlyList").children.length) {
          $("earlyList").innerHTML = earlyF.slice(0, 24).map(card).join("");
          bindCards($("earlyList"));
        }
      };
      if (eb.open) fill();
      eb.addEventListener("toggle", () => {
        if (eb.open) fill();
      });
    }
    const pm = $("planMore");
    if (pm)
      pm.onclick = () => {
        planN += 12;
        plan();
      };
    bindCards($("planList"));
    refreshFades();
  }
  function condText() {
    const homes = { 0: "무주택", 1: "1주택·처분 예정", 3: "1주택 유지", 2: "2주택+" }[P.homes];
    const adv =
      (num("aRate") ?? 4.5) !== 4.5 ||
      num("aUnit") != null ||
      (num("aGrowth") ?? 0) !== 0 ||
      (num("aRatio") ?? 100) !== 100 ||
      num("pRewin") ||
      !$("pTrade").checked ||
      !$("pAfford").checked;
    return [
      homes,
      P.first ? "생애최초" : null,
      `${P.unit}㎡`,
      $("pGu").value || "서울 전체",
      P.kind || null,
      P.basis === "now" ? "지금 매수 기준" : null,
      num("pIncome") != null ? (num("pIncome") > 0 ? `연소득 ${fmt(num("pIncome"))}만원` : "연소득 없음(대출 0)") : null,
      adv ? "고급 가정 변경" : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const ADS = (() => {
    try {
      return JSON.parse($("adsCfg").textContent);
    } catch (e) {
      return null;
    }
  })();
  function adPick(slot) {
    if (!ADS) return null;
    if (ADS.adsense && ADS.adsense.client && ADS.adsense.slots && ADS.adsense.slots[slot])
      return { n: "adsense", id: ADS.adsense.slots[slot] };
    return null;
  }
  function adRender() {
    document.querySelectorAll(".ad-slot[data-slot]").forEach((el) => {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      const a = adPick(el.dataset.slot);
      if (!a) {
        if (FREE && FREE_CFG.preview) {
          el.hidden = false;
          el.innerHTML = `<span class="ad-lab">광고</span><div class="ad-ph">광고 자리 (${esc(el.dataset.slot)}) · 승인 뒤 ID를 넣으면 여기에 광고가 나와요</div>`;
        }
        return;
      }
      el.hidden = false;
      el.innerHTML = `<span class="ad-lab">광고</span><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(ADS.adsense.client)}" data-ad-slot="${esc(a.id)}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {}
    });
  }
  function sumRows() {
    const gap = gapMode();
    const rowOf = (r) => {
      const si = r.st || r.ll ? stnInfo(r) : null;
      const stn = si ? (si.min > 25 ? `${si.n}역 ${(si.d / 1e3).toFixed(1)}km` : `${si.n}역 도보 ${si.min}분`) : "–";
      let now, tot;
      if (gap) {
        const g = gapOf(r);
        now = g.na || g.block ? null : g.now;
        tot = g.na || g.block || !g.x.ok ? null : g.total;
      } else {
        const x = investC(r);
        now = x.needNow;
        tot = x.ok ? x.needTotal : null;
      }
      return { r, now, tot, stg: r.src === "moa" ? srLabel(r) : stageName(r), p10: r.eta?.p10, eta: etaYears(r), stn };
    };
    const ids = [...AFF].filter((id) => byId[id] && !estHide(byId[id]));
    const ok = ids.map((id) => rowOf(byId[id])).sort((a, b) => (a.tot ?? 1e9) - (b.tot ?? 1e9) || (a.now ?? 1e9) - (b.now ?? 1e9));
    const fav = FAV.filter((id) => byId[id]).map((id) => rowOf(byId[id]));
    return { ok, fav, gap };
  }
  function sumHTML() {
    const { ok, fav, gap } = sumRows(),
      top = ok.slice(0, 15);
    const d = new Date(Date.now() + KST),
      today = `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
    const yr = (t) => (t == null ? "미정" : t > 15 ? "15년 넘게" : `${new Date(TODAY.getTime() + t * 365.25 * 864e5).getFullYear()}년`);
    const pc = (v) => (v == null ? "–" : `${prob(v)}%`);
    const eok = (v) => (v == null ? "–" : `${f1(v)}억`);
    const tbl = (rows, cap) =>
      rows.length
        ? `<table class="sm-t"><caption class="sr-only">${cap}</caption><thead><tr><th scope="col">구역</th><th scope="col">단계</th><th scope="col" class="n">① 지금</th><th scope="col" class="n">③ 입주까지</th><th scope="col" class="n">10년 준공</th><th scope="col">입주(추정)</th><th scope="col">가까운 역</th></tr></thead><tbody>${rows.map((x) => `<tr><th scope="row">${esc(shortName(x.r.n))}<small>${esc(x.r.g)}</small></th><td>${esc(x.stg)}</td><td class="n">${eok(x.now)}</td><td class="n"><b>${eok(x.tot)}</b></td><td class="n">${pc(x.p10)}</td><td>${yr(x.eta)}</td><td>${esc(x.stn)}</td></tr>`).join("")}</tbody></table>`
        : "";
    const nowLab = gap ? "전세 끼고 지금 드는 돈(매수가 − 전세금 + 취득세)" : "지금 드는 돈(매수가 + 취득세 − 매수 대출)";
    return `<div class="sm-in">\n    <div class="sm-bar no-print"><button type="button" class="btn primary" id="svPrint">PDF로 저장 · 인쇄</button><button type="button" class="btn secondary" id="svClose">닫기</button><span class="sm-tip">인쇄 창에서 대상을 'PDF로 저장'으로 고르면 파일로 남아요</span></div>\n    <article class="sm-page" aria-labelledby="smT">\n      <header class="sm-h"><p class="sm-k">집핀 · 내 조건 한 장 요약</p><h2 id="smT">현금 ${e2(CASH)}억으로 ${gap ? "전세 끼고 지금 살 수 있는" : P.basis === "now" ? "지금 살 수 있는" : "입주까지 감당할 수 있는"} 구역 <b>${fmt(ok.length)}곳</b></h2>\n        <p class="sm-c">${esc(condText())}</p>\n        <p class="sm-d">만든 날 ${today} · 데이터 기준 ${ASOF}</p></header>\n      ${top.length ? `<h3>${LBL.cashToMoveIn}이 적은 순 ${top.length < ok.length ? `상위 ${top.length}곳 <small>(전체 ${fmt(ok.length)}곳은 사이트에서)</small>` : `${top.length}곳`}</h3>${tbl(top, "조건에 맞는 구역")}` : `<p class="sm-empty">이 조건으로는 아직 맞는 구역이 없어요. 사이트의 답 카드에서 다음 금액이나 다른 조건을 확인해 보세요.</p>`}\n      ${fav.length ? `<h3>내 핀 ${fav.length}곳</h3>${tbl(fav, "내 핀")}` : ""}\n      <ul class="sm-n">\n        <li>① ${nowLab} · ③ 입주까지 필요한 현금(분담금·세금·이자 더하고 입주 잔금대출 뺀 값)</li>\n        <li>모두 추정치예요. 시세 상승 0% 가정 · 대출 한도는 현행 규제 기준 · 조합원 분양가·감정가 계수는 작성자 가정값</li>\n        <li>10년 준공 확률·입주 시점은 서울 사업장 실제 인가일 생존분석(해제 구역이 빠져 다소 낙관적)</li>\n        <li>투자 권유가 아니에요. 사기 전에 조합·구청 공고와 실제 매물가를 꼭 확인하세요.</li>\n      </ul>\n      <p class="sm-f">jaegaebal.alwaysquestions.kr</p>\n    </article></div>`;
  }
  function sumOpen() {
    if (!isMember()) {
      mbOpen("sum");
      return;
    }
    track("summary");
    let v = $("sumView");
    if (!v) {
      v = document.createElement("div");
      v.id = "sumView";
      v.setAttribute("role", "dialog");
      v.setAttribute("aria-modal", "true");
      v.setAttribute("aria-labelledby", "svT");
      document.body.appendChild(v);
    }
    SUM_FROM = document.activeElement;
    v.innerHTML = sumHTML();
    v.hidden = false;
    document.documentElement.classList.add("sum-on");
    $("svPrint").onclick = () => window.print();
    $("svClose").onclick = sumClose;
    v.scrollTop = 0;
    $("svPrint").focus();
  }
  let SUM_FROM = null;
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && document.documentElement.classList.contains("sum-on")) {
        e.stopPropagation();
        e.preventDefault();
        sumClose();
      }
    },
    true,
  );
  function sumClose() {
    const v = $("sumView");
    if (v) v.hidden = true;
    document.documentElement.classList.remove("sum-on");
    if (SUM_FROM && document.contains(SUM_FROM)) SUM_FROM.focus({ preventScroll: true });
  }
  function sumBtnPaint() {
    const b = $("sumBtn");
    if (!b) return;
    b.innerHTML = `${isMember() ? "" : '<span class="sb-lk" aria-hidden="true"></span>'}내 조건 저장·공유<span class="sr-only">${isMember() ? " (PDF로 저장)" : " · 멤버십 기능"}</span>`;
  }
  $("maxBox").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cash],[data-go],[data-alt],[data-jump]");
    if (!b || !$("maxBox").contains(b)) return;
    if (b.dataset.cash) {
      if (b.dataset.rev) PREV_CASH = null;
      else PREV_CASH = CASH;
      $("pCash").value = b.dataset.cash;
      cashNote("");
      planN = PLAN0();
      plan();
      return;
    }
    if (b.dataset.jump) {
      e.preventDefault();
      jumpTo(b.dataset.jump);
      return;
    }
    if (b.dataset.go) {
      const el = document.querySelector(`[data-card="${b.dataset.go}"]`);
      if (el) {
        el.scrollIntoView({ behavior: smooth(), block: "center" });
        const g = el.querySelector(".go");
        if (g) g.focus({ preventScroll: true });
      }
      return;
    }
    const a = b.dataset.alt;
    if (a === "unit59") $("pUnit").querySelector('[data-v="59"]').click();
    else if (a === "first") $("pFirst").click();
    else if (a === "both") {
      P.first = 1;
      syncFirst();
      $("pUnit").querySelector('[data-v="59"]').click();
    } else $("pBasis").querySelector('[data-v="now"]').click();
  });
  $("sumBtn").onclick = sumOpen;
  $("condBtn").onclick = () => {
    const open = $("condPanel").hidden;
    $("condPanel").hidden = !open;
    $("condBtn").setAttribute("aria-expanded", String(open));
    $("condBtn").querySelector(".pmb-t").textContent = open ? "조건 접기" : "조건 더 보기";
    if (open) refreshFades();
  };
  let LADDER_ARGS = null;
  const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];
  function drawLadder(all, needOf) {
    keepFocus(() => {
      const box = $("cashLadder"),
        W = Math.max(300, Math.round(box.clientWidth || 520)),
        H = W < 420 ? 170 : 180,
        padL = 34,
        padB = 26,
        padT = 24;
      let lv = LEVELS.includes(CASH) ? LEVELS.slice() : [...LEVELS, CASH].sort((a, b) => a - b);
      const capN = Math.floor((W - padL - 4) / 24);
      for (const d of [6, 15, 12, 4, 2]) {
        if (lv.length <= capN) break;
        if (d !== CASH) lv = lv.filter((v) => v !== d);
      }
      const rowOf = (c) => {
        const f = all.filter((x) => (P.basis === "total" ? x.ok : x.needBuy != null) && needOf(x) <= c);
        const p = f.filter((x) => x.tier === 0).length;
        return { c, n: f.length, p, ins: !LEVELS.includes(c) };
      };
      const rowsAll = (LEVELS.includes(CASH) ? LEVELS.slice() : [...LEVELS, CASH].sort((a, b) => a - b)).map(rowOf);
      const rows = lv.map((c) => rowsAll.find((r) => r.c === c));
      const bw = (W - padL - 4) / rows.length,
        mx = Math.max(1, ...rows.map((r) => r.n)),
        narrow = bw < 34;
      const v = mx * 1.1,
        step = v <= 50 ? 10 : v <= 100 ? 20 : v <= 250 ? 50 : 100,
        top = Math.ceil(v / step) * step,
        y = (q) => padT + (H - padT - padB) * (1 - q / top);
      const basisLab = P.basis === "total" ? "입주까지" : "지금 매수";
      const grid =
        [top / 2, top]
          .map(
            (q) =>
              `<line x1="${padL}" x2="${W}" y1="${y(q)}" y2="${y(q)}" class="gl"/><text x="${padL - 8}" y="${y(q) + 4}" class="ax" text-anchor="end">${q}</text>`,
          )
          .join("") +
        `<line x1="${padL}" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="gl0"/><text x="${padL - 8}" y="${y(0) + 4}" class="ax" text-anchor="end">0</text>`;
      const curI = rows.findIndex((r) => Math.abs(r.c - CASH) < 1e-9);
      const bars = rows
        .map((r, i) => {
          const hideLab = false;
          const w = Math.min(bw * 0.7, 44),
            x = padL + i * bw + (bw - w) / 2,
            cur = Math.abs(r.c - CASH) < 1e-9;
          let hN = y(0) - y(r.n);
          const hP = y(0) - y(r.p),
            rx = Math.min(4, w / 4);
          if (cur && r.n) hN = Math.max(hN, 3);
          const lab = `${NF1.format(r.c)}억`;
          return `<g class="bar ${cur ? "cur" : ""}${r.ins ? " ins" : ""}" data-c="${r.c}" tabindex="0" role="button" aria-label="${lab}: ${basisLab} 가능 ${r.n}곳, 기준 통과 ${r.p}곳${cur ? " (현재)" : ""}">\n      <rect class="hit" x="${padL + i * bw}" y="${padT - 18}" width="${bw}" height="${H - padT + 18}" />\n      ${r.n ? `<rect class="b2" x="${x}" y="${y(0) - hN}" width="${w}" height="${Math.max(0, hN - (r.p ? hP + 2 : 0))}" rx="${rx}"/>` : `<circle class="z" cx="${x + w / 2}" cy="${y(0)}" r="2.5"/>`}\n      ${r.p ? `<rect class="b1" x="${x}" y="${y(r.p)}" width="${w}" height="${hP}" rx="${rx}"/>` : ""}\n      ${cur ? `<text x="${x + w / 2}" y="${y(0) - hN - 8}" class="vl" text-anchor="middle">${r.ins ? `${NF1.format(r.c)}억 · ` : ""}${r.n}곳${r.p ? ` · 통과 ${r.p}` : ""}</text>` : ""}\n      <text x="${x + w / 2}" y="${H - 7}" class="ax ${cur ? "on" : ""}" text-anchor="middle">${r.ins ? "" : narrow && !cur ? NF1.format(r.c) : lab}</text></g>`;
        })
        .join("");
      const changed = setHTML(
        box,
        `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="현금별 ${basisLab} 가능 구역 수 막대 (누르면 그 금액으로 계산)">${grid}${bars}</svg><div class="tipbox" hidden></div>`,
      );
      setHTML(
        $("ladderTable"),
        `<table class="ltab"><caption class="sr-only">현금별 ${basisLab} 가능 구역 수</caption><thead><tr><th scope="col">현금</th><th scope="col">${basisLab} 가능</th><th scope="col">기준 통과</th></tr></thead><tbody>${rowsAll.map((r) => `<tr${Math.abs(r.c - CASH) < 1e-9 ? ' class="cur"' : ""}><td>${NF1.format(r.c)}억</td><td>${fmt(r.n)}곳</td><td>${fmt(r.p)}곳</td></tr>`).join("")}</tbody></table>`,
      );
      if (!changed) return;
      const tipb = box.querySelector(".tipbox");
      box.querySelectorAll(".bar").forEach((g) => {
        const r = rows.find((z) => String(z.c) === g.dataset.c);
        g.onclick = () => {
          PREV_CASH = null;
          $("pCash").value = g.dataset.c;
          cashNote("");
          planN = PLAN0();
          plan();
        };
        g.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            g.onclick();
          }
        };
        const show = () => {
          tipb.hidden = false;
          tipb.textContent = `${NF1.format(r.c)}억 · ${basisLab} ${r.n}곳 (기준 통과 ${r.p}곳)`;
          const bb = g.querySelector(".hit").getBoundingClientRect(),
            pb = box.getBoundingClientRect();
          tipb.style.left = Math.min(pb.width - 200, Math.max(0, bb.left - pb.left + bb.width / 2 - 100)) + "px";
        };
        g.onmouseenter = show;
        g.onfocus = show;
        g.onmouseleave = () => {
          tipb.hidden = true;
        };
        g.onblur = () => {
          tipb.hidden = true;
        };
      });
    });
  }
  async function shareLink(url, fb, title = "집핀 · 서울 재개발 지도") {
    try {
      if (navigator.share && matchMedia("(pointer:coarse)").matches) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      fb.textContent = "링크 복사됨";
      setTimeout(() => {
        fb.textContent = "";
      }, 2400);
    } catch (e) {
      fb.innerHTML = `<label class="share-fall">복사가 안 되면 길게 눌러 복사하세요<input readonly value="${esc(url)}"></label>`;
      const i = fb.querySelector("input");
      i.focus();
      i.select();
    }
  }
  function condQuery() {
    const q = new URLSearchParams(location.search);
    const set = (k, v, def) => {
      if (v == null || v === "" || String(v) === String(def)) q.delete(k);
      else q.set(k, v);
    };
    set("cash", lastValidCash, 1);
    set("homes", P.homes, 0);
    set("first", P.first ? 1 : "", "");
    set("unit", P.unit, 84);
    set("inc", $("pIncome").value.trim(), "");
    set("basis", P.basis, "total");
    set("kind", P.kind, "");
    set("fund", P.fund, "gap");
    set("jr", P.jr, null);
    const s = q.toString();
    return s ? "?" + s : "";
  }
  const pageURL = () => location.href.split(/[?#]/)[0];
  $("shareBtn").onclick = () => shareLink(pageURL() + condQuery(), $("shareFb"));
  let urlT = 0;
  function syncURL() {
    clearTimeout(urlT);
    urlT = setTimeout(() => {
      try {
        history.replaceState(history.state, "", location.pathname + condQuery() + location.hash);
      } catch (e) {}
      try {
        localStorage.setItem("jg-cond", condQuery());
      } catch (e) {}
    }, 250);
  }
  function restoreURL() {
    let qs = location.search;
    if (!/[?&](cash|fund|inc|income)=/.test(qs)) {
      try {
        const sv = localStorage.getItem("jg-cond");
        if (sv) qs = sv;
      } catch (e) {}
    }
    const q = new URLSearchParams(qs);
    const cash = parseFloat(q.get("cash"));
    if (isFinite(cash) && cash > 0 && cash <= 100) $("pCash").value = String(cash);
    const homes = +q.get("homes");
    if ([0, 1, 2, 3].includes(homes) && q.has("homes")) {
      P.homes = homes;
      setSeg("pHomes", homes);
    }
    if (q.get("first") === "1" && P.homes === 0) P.first = 1;
    const unit = +q.get("unit");
    if (unit === 59 || unit === 84) {
      P.unit = unit;
      setSeg("pUnit", unit);
    }
    if (q.get("inc")) $("pIncome").value = q.get("inc");
    if (q.get("basis") === "now") {
      P.basis = "now";
      setSeg("pBasis", "now");
    }
    const kd = q.get("kind");
    if (kd && ["재개발", "재건축", "가로·소규모"].includes(kd)) {
      P.kind = kd;
      setSeg("pKind", kd);
    }
    P.fund = q.get("fund") === "cash" ? "cash" : "gap";
    const jr = parseFloat(q.get("jr"));
    if (isFinite(jr) && jr >= 10 && jr <= 95) P.jr = jr;
    syncFirst();
    syncFundUI();
  }
  let backTo = null,
    ovBusy = false,
    reportReady = false;
  function openCard(id) {
    backTo = id;
    curTab = "money";
    select(id, true, true);
  }
  function bindCards(root) {
    root.querySelectorAll("[data-card]").forEach((c) => {
      c.onclick = (e) => {
        if (e.target.closest("details,input,label,a,button")) return;
        c.setAttribute("tabindex", c.getAttribute("tabindex") || "-1");
        c.focus({ preventScroll: true });
        openCard(c.dataset.card);
      };
      const go = c.querySelector(".go");
      if (go)
        go.onclick = (e) => {
          e.stopPropagation();
          openCard(c.dataset.card);
        };
    });
    root.querySelectorAll("[data-ov]").forEach((inp) =>
      inp.addEventListener("change", () => {
        if (ovBusy || !inp.isConnected) return;
        ovBusy = true;
        try {
          const id = inp.dataset.id,
            k = inp.dataset.ov,
            v = parseFloat(inp.value);
          OV[id] = OV[id] || {};
          if (isFinite(v) && v > 0) {
            OV[id][k] = v;
            if (k === "price") delete OV[id].est;
          } else delete OV[id][k];
          estSync();
          invalidate();
          plan();
          const nc = document.querySelector(`[data-card="${id}"]`);
          if (nc) {
            const d = nc.querySelector("details.why");
            if (d) d.open = true;
          }
        } finally {
          ovBusy = false;
        }
      }),
    );
  }
  const SEC_GAP = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sec-gap")) || 80;
  let JUMP_GEN = 0;
  const FOLD_IDS = ["commuteTop", "rankTop", "saveTop", "statsTop", "rulesTop"];
  function unfold(sec) {
    if (!sec || !sec.classList.contains("fold")) return false;
    sec.classList.remove("fold");
    const b = sec.querySelector(".fold-btn");
    if (b) b.setAttribute("aria-expanded", "true");
    if (sec.id === "statsTop") {
      done.stats = 0;
    }
    if (sec.id === "rankTop") {
      done.rank = 0;
    }
    requestAnimationFrame(() => {
      const f = SECT[sec.id];
      if (f) f();
      window.dispatchEvent(new Event("resize"));
    });
    return true;
  }
  function initFold() {
    FOLD_IDS.forEach((id) => {
      const sec = $(id);
      if (!sec) return;
      const h = sec.querySelector(".sec-h");
      if (!h) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fold-btn";
      b.setAttribute("aria-expanded", "false");
      b.setAttribute("aria-controls", id);
      b.innerHTML =
        '<span class="fb-o">펼쳐 보기</span><span class="fb-c">접기</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      b.addEventListener("click", () => {
        if (sec.classList.contains("fold")) unfold(sec);
        else {
          sec.classList.add("fold");
          b.setAttribute("aria-expanded", "false");
          const r = sec.getBoundingClientRect();
          if (r.top < 0) window.scrollTo({ top: r.top + window.scrollY - HDR() + SEC_GAP() - 24, behavior: "auto" });
        }
      });
      h.after(b);
      sec.classList.add("fold");
    });
    const fromHash = () => {
      const id = (location.hash || "").slice(1);
      if (FOLD_IDS.includes(id)) unfold($(id));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener(
      "click",
      (e) => {
        const a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;
        const id = a.getAttribute("href").slice(1);
        if (FOLD_IDS.includes(id)) unfold($(id));
      },
      true,
    );
  }
  function jumpTo(id) {
    const t0 = $(id);
    if (t0 && unfold(t0.closest(".sec.fold") || (t0.classList.contains("fold") ? t0 : null))) {
      requestAnimationFrame(() => requestAnimationFrame(() => jumpTo(id)));
      return;
    }
    const t = $(id);
    if (!t) return;
    const want = () => t.getBoundingClientRect().top + window.scrollY - HDR() + (t.classList.contains("sec") && !t.classList.contains("s-on") && !document.documentElement.classList.contains("s-view") ? SEC_GAP() - 24 : -8); // 도구 화면(s-on·입주 계산 아래 칸)은 SIMPLE.open과 같은 자리로
    window.scrollTo({ top: want(), behavior: smooth() });
    const y0 = window.scrollY;
    let moved = false;
    const onWheel = () => {
      moved = true;
    };
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach((ev) =>
      addEventListener(ev, onWheel, { once: true, passive: true, capture: true }),
    );
    JUMP_GEN = (JUMP_GEN || 0) + 1;
    const gen = JUMP_GEN;
    const fix = () => {
      if (moved || gen !== JUMP_GEN) return;
      const w = want();
      if (Math.abs(w - window.scrollY) > 12) window.scrollTo({ top: w, behavior: "auto" });
    };
    if ("onscrollend" in window) addEventListener("scrollend", fix, { once: true });
    [1e3, 1900, 2800].forEach((ms) => setTimeout(fix, ms));
  }
  let searchFrom = null;
  function closeSearchNow(opts = {}) {
    if (!$("hdr").classList.contains("searching")) return;
    $("hdr").classList.remove("searching");
    if (!$("report").classList.contains("sheet")) document.documentElement.classList.remove("sheet-open");
    setInert(bgFor("search"), false);
    $("sugg").hidden = true;
    $("q").value = "";
    if (!opts.keepHistory && searchFrom) $("sOpen").focus({ preventScroll: true });
  }
  (function () {
    const links = [...document.querySelectorAll("#tabbar a")],
      tb = $("tabbar");
    links.forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        jumpTo(a.dataset.sec);
      }),
    );
    const SPY = [
      ["planner", "planner"],
      ["results", "planner"],
      ["readsTop", "readsTop"],
      ["mapTop", "mapTop"],
      ["commuteTop", "commuteTop"],
      ["rankTop", "rankTop"],
      ["saveTop", "saveTop"],
      ["favTop", null],
      ["statsTop", null],
      ["rulesTop", null],
      ["blogCta", null],
    ];
    let last = null,
      sT2 = 0;
    function spy() {
      const off = HDR() + innerHeight * 0.33;
      let curS = "planner",
        curRaw = "planner";
      SPY.forEach(([id, tab]) => {
        const el = $(id);
        if (el && !el.hidden && el.getBoundingClientRect().top + (el.classList.contains("sec") ? SEC_GAP() - 24 : 0) - off <= 0) {
          curS = tab;
          curRaw = id;
        }
      });
      links.forEach((a) => {
        const on = a.dataset.sec === curS;
        a.classList.toggle("on", on);
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      $("huFav").classList.toggle("on", curRaw === "favTop");
      if (curS !== last) {
        last = curS;
        const a = links.find((x) => x.dataset.sec === curS);
        if (a && tb.scrollWidth > tb.clientWidth) {
          const l = a.offsetLeft - 16,
            rgt = a.offsetLeft + a.offsetWidth - tb.clientWidth + 40;
          if (tb.scrollLeft > l) tb.scrollTo({ left: l, behavior: smooth() });
          else if (tb.scrollLeft < rgt) tb.scrollTo({ left: rgt, behavior: smooth() });
        }
      }
      $("hdr").classList.toggle("scrolled", window.scrollY > 4);
    }
    window.addEventListener(
      "scroll",
      () => {
        if (sT2) return;
        sT2 = requestAnimationFrame(() => {
          sT2 = 0;
          spy();
        });
      },
      { passive: true },
    );
    spy();
    const openS = () => {
      searchFrom = document.activeElement;
      $("hdr").classList.add("searching");
      document.documentElement.classList.add("sheet-open");
      setInert(bgFor("search"), true);
      pushSt({ search: 1 });
      setTimeout(() => $("q").focus(), 0);
    };
    $("sOpen").onclick = openS;
    $("sCancel").onclick = () => {
      if (history.state && history.state.search) history.back();
      else closeSearchNow();
    };
    $("q").addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $("hdr").classList.contains("searching") && $("sugg").hidden) $("sCancel").click();
    });
  })();
  {
    const btn = $("menuBtn"),
      pop = $("menuPop"),
      bd = $("menuBd");
    const place = () => {
      if (matchMedia("(max-width:640px)").matches) {
        pop.style.top = "";
        pop.style.right = "";
        return;
      }
      const b = btn.getBoundingClientRect();
      pop.style.top = b.bottom + 8 + "px";
      pop.style.right = Math.max(12, innerWidth - b.right) + "px";
    };
    const open = (on) => {
      pop.hidden = !on;
      bd.hidden = !on;
      btn.setAttribute("aria-expanded", String(on));
      document.documentElement.classList.toggle("menu-open", on);
      if (on) {
        place();
        const f = pop.querySelector("a");
        if (f) f.focus({ preventScroll: true });
      }
    };
    btn.onclick = (e) => {
      e.stopPropagation();
      open(pop.hidden);
    };
    bd.onclick = () => open(false);
    $("menuClose").onclick = () => {
      open(false);
      btn.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !pop.hidden) {
        open(false);
        btn.focus({ preventScroll: true });
      }
    });
    document.addEventListener("click", (e) => {
      if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) open(false);
    });
    addEventListener("resize", () => {
      if (!pop.hidden) place();
    });
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("[data-menu]");
      if (!a) return;
      e.preventDefault();
      open(false);
      const id = a.dataset.menu;
      if (id === "statsTop") SECT.statsTop();
      if (id === "rulesTop") SECT.rulesTop();
      requestAnimationFrame(() => jumpTo(id));
    });
    pop.addEventListener("click", (e) => {
      if (e.target.closest("[data-jumplead],[data-mb]")) open(false);
    });
  }
  window.addEventListener("hashchange", () => {
    if (popNav) return;
    const x = location.hash.slice(1);
    if (byId[x] && (!cur || cur.id !== x || (MQ_SHEET.matches && !$("report").classList.contains("sheet")))) {
      curTab = "money";
      select(x, true, false, { scroll: true, replace: true });
    }
  });
  function hookCounts() {
    const save = { ...P };
    Object.assign(P, { homes: 0, first: 0, unit: 84, basis: "total", kind: "" });
    const base = R.filter((r) => !r.dn && r.s < 9 && !r.cx && r.src !== "moa" && !restricted(r) && !rewinBlocked(r) && !estHide(r)).map(
      investC,
    );
    const sets = {};
    [5, 7, 10].forEach((c) => {
      sets[c] = new Set(base.filter((x) => x.ok && x.needTotal <= c).map((x) => x.r.id));
    });
    Object.assign(P, save);
    return sets;
  }
  function countUp(el, to, dur) {
    el.style.minWidth = fmt(to).replace(/,/g, "").length + "ch";
    if (reduceMotion() || !dur || !el.textContent || el.textContent === "0") {
      el.textContent = fmt(to);
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur),
        e = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
      el.textContent = fmt(Math.round(to * e));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  let INTRO_DOTS = null,
    HOOK_MIN = null,
    HOOK_T = {},
    HOOK = null,
    HOOK_CASH = null,
    artC = 1,
    artTimer = 0,
    artUser = false,
    introVis = true;
  function initIntro() {
    const art = $("introArt");
    HOOK_CASH = hookCounts();
    {
      const save = { ...P };
      Object.assign(P, { homes: 0, first: 0, unit: 84, basis: "total", kind: "", jr: null });
      const base = R.filter((r) => !r.dn && r.s < 9 && !r.cx && r.src !== "moa" && !rewinBlocked(r));
      HOOK = {};
      [1, 2, 3].forEach((c) => {
        HOOK[c] = new Set(base.filter((r) => gapOk(r, c)).map((r) => r.id));
      });
      {
        const tots = base
          .filter((r) => HOOK[3].has(r.id))
          .map((r) => gapOf(r))
          .filter((g) => g && g.x && g.x.ok && g.total != null)
          .map((g) => g.total);
        HOOK_MIN = tots.length ? Math.min(...tots) : null;
      }
      HOOK_T = {};
      [1, 2, 3].forEach((c) => {
        HOOK_T[c] = base
          .filter((r) => HOOK[c].has(r.id))
          .filter((r) => {
            const g = gapOf(r);
            return g && g.x && g.x.ok && g.total != null && g.total <= c + 1e-9;
          }).length;
      });
      Object.assign(P, save);
      GCACHE = new Map();
    }
    if (art) {
      const y0 = -26,
        y1 = 839;
      const dots = POP.filter((r) => r.xy).sort((a, b) => a.xy[1] - b.xy[1]);
      art.innerHTML = `<defs><radialGradient id="igl"><stop offset="0" stop-color="var(--grad-a)" stop-opacity=".6"/><stop offset="1" stop-color="var(--grad-a)" stop-opacity="0"/></radialGradient></defs>\n      <path class="i-land" d="${GEO.outline}"/>\n      <g class="i-gu">${D.map.gu.map((g) => `<path d="${g[1]}"/>`).join("")}</g>\n      <path class="i-riv" d="${GEO.river}"/>\n      <path class="i-out" d="${GEO.outline}" pathLength="1"/>\n      <g class="i-glow"></g>\n      <g class="i-dots">${dots.map((r) => `<circle data-id="${r.id}" cx="${r.xy[0]}" cy="${r.xy[1]}" r="3.4" style="--d:${(0.9 + ((r.xy[1] - y0) / (y1 - y0)) * 1.1).toFixed(2)}s"/>`).join("")}</g>`;
      INTRO_DOTS = new Map([...art.querySelectorAll(".i-dots circle")].map((c) => [c.dataset.id, c]));
      requestAnimationFrame(() => art.classList.add("go"));
      setTimeout(() => art.classList.add("settled"), 3400);
    }
    const cards = [...document.querySelectorAll("#inStats .ist[data-c]")];
    {
      const it = $("inTot");
      if (it && HOOK_MIN != null)
        it.innerHTML = `계약할 때 드는 돈과 입주까지 드는 돈은 달라요. 전세 끼고 사도 입주까지는 가장 적은 곳이 약 <b>${f1(HOOK_MIN)}억</b>이에요.`;
    }
    {
      const allZero = [1, 2, 3].every((c) => !HOOK_T[c]);
      cards.forEach((card) => {
        const t = card.querySelector(".hk2"),
          w = card.querySelector(".ist-t");
        if (t) t.textContent = fmt(HOOK_T[card.dataset.c] || 0);
        if (w) w.hidden = allZero;
      });
    }
    cards.forEach((card, i) => {
      const el = card.querySelector(".hk"),
        n = HOOK[card.dataset.c].size;
      el.textContent = "0";
      setTimeout(() => countUp(el, n, 1400), 150 + i * 120);
    });
    {
      const ig = $("inGap");
      if (ig) {
        ig.innerHTML = `<span class="ig-h">현금만, 입주까지</span>${[5, 7, 10].map((c) => `<a href="#planner" data-cashgo="${c}"><b>${c}억</b> ${fmt(HOOK_CASH[c].size)}곳</a>`).join("")}<span class="ig-n">입주까지 필요한 현금 기준 · 매수 대출 포함 · ${num("pIncome") != null ? `연소득 ${fmt(num("pIncome"))}만원 반영` : "연소득 미입력(잔금대출 최대 가정)"}${HOOK_MIN != null ? `<br>전세 끼고 사도 입주까지는 가장 적은 곳이 약 <b>${f1(HOOK_MIN)}억</b>이에요` : ""}</span>`;
        ig.hidden = false;
      }
    }
    const d7 = $("d7");
    if (d7) d7.textContent = `1억보다 +${fmt(HOOK[2].size - HOOK[1].size)}곳`;
    const big = document.querySelector("#inStats .ist.big b");
    if (big) {
      const n = POP.length;
      big.textContent = "0";
      setTimeout(() => countUp(big, n, 1400), 150);
    }
    const pick = (c, user) => {
      if (user) {
        artUser = true;
        clearInterval(artTimer);
      }
      artC = c;
      introPaint(c);
    };
    cards.forEach((card) => {
      const c = +card.dataset.c;
      card.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "mouse") pick(c, true);
      });
      card.addEventListener("click", () => pick(c, true));
      card.addEventListener("focus", () => pick(c, true));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick(c, true);
        }
      });
    });
    {
      const it = $("intro");
      if (it)
        it.addEventListener(
          "pointerdown",
          () => {
            artUser = true;
            clearInterval(artTimer);
          },
          { once: true, passive: true },
        );
    }
    if (!reduceMotion())
      artTimer = setInterval(() => {
        if (artUser || !introVis || document.hidden) return;
        const seq = [1, 2, 3];
        pick(seq[(seq.indexOf(artC) + 1) % 3], false);
      }, 2400);
    const intro = $("intro");
    if (intro && window.IntersectionObserver)
      new IntersectionObserver((es) =>
        es.forEach((e) => {
          introVis = e.isIntersecting;
          intro.classList.toggle("idle", !introVis);
        }),
      ).observe(intro);
    const cta = $("introCta");
    if (cta)
      cta.onclick = (e) => {
        e.preventDefault();
        jumpTo("planner");
        if (!coarse())
          setTimeout(
            () => {
              const c = $("pCash");
              if (c) {
                c.focus({ preventScroll: true });
                c.select();
              }
            },
            reduceMotion() ? 0 : 450,
          );
      };
    introPaint(1);
  }
  function introPaint(c) {
    if (!INTRO_DOTS || !HOOK || !HOOK[c]) return;
    const set = HOOK[c],
      art = $("introArt"),
      glow = art && art.querySelector(".i-glow");
    let gh = "",
      k = 0;
    const step = Math.max(1, Math.ceil(set.size / 40));
    INTRO_DOTS.forEach((el, id) => {
      const on = set.has(id);
      if (el.classList.contains("on") !== on) el.classList.toggle("on", on);
      if (on && k++ % step === 0) gh += `<circle cx="${el.getAttribute("cx")}" cy="${el.getAttribute("cy")}" r="18" fill="url(#igl)"/>`;
    });
    if (glow) glow.innerHTML = gh;
    const ac = $("artCash"),
      an = $("artN");
    if (ac) ac.textContent = c;
    if (an) an.textContent = fmt(set.size);
    document.querySelectorAll("#inStats .ist[data-c]").forEach((card) => {
      const on = +card.dataset.c === c;
      card.classList.toggle("on", on);
      card.setAttribute("aria-pressed", String(on));
    });
  }
  restoreURL();
  readAV();
  sizeCash();
  plan();
  initIntro();
  const hash0 = location.hash.slice(1);
  const done = {};
  const SECT = {
    mapTop: () => {
      if (!done.map) {
        done.map = 1;
        initMap();
      }
    },
    rankTop: () => {
      if (!done.rank) {
        done.rank = 1;
        rankReady = true;
        drawRank();
      }
    },
    statsTop: () => {
      if (!done.stats) {
        done.stats = 1;
        drawGu();
        drawDur();
      }
    },
    rulesTop: () => {
      if (!done.rules) {
        done.rules = 1;
        drawRules();
      }
    },
  };
  if (window.IntersectionObserver) {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            const f = SECT[e.target.id];
            if (f) window.requestIdleCallback ? requestIdleCallback(f, { timeout: 300 }) : setTimeout(f, 0);
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "600px 0px" },
    );
    Object.keys(SECT).forEach((id) => $(id) && io.observe($(id)));
  }
  function initReveal() {
    if (reduceMotion() || !window.IntersectionObserver) return;
    const els = [
      ...document.querySelectorAll(
        "#mapTop .sec-h, #rankTop .sec-h, #statsTop .sec-h, #rulesTop .sec-h, #rankTop .fbar, #rankTop .tblwrap, #statsTop .grid2 > .panel, #blogCta, #mapTop .mapcard, #mapTop #report",
      ),
    ].filter((el) => el.getBoundingClientRect().top > innerHeight);
    if (!els.length) return;
    els.forEach((el) => {
      el.classList.add("rv");
      if (el.matches(".mapcard, #report")) el.classList.add("fo");
    });
    document.documentElement.classList.add("rv");
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    addEventListener("hashchange", () => els.forEach((el) => el.classList.add("in")), { once: true });
  }
  const T3 = { ready: false };
  let CMP = [];
  let FAV_NOTE = "";
  function toggleFav(id) {
    if (!byId[id]) return;
    if (isFav(id)) {
      FAV = FAV.filter((x) => x !== id);
      CMP = CMP.filter((x) => x !== id);
      PINS.drop(id);
    } else {
      FAV.push(id);
      PINS.add(id);
    }
    saveFav();
    syncFav();
  }
  function syncFav() {
    document.querySelectorAll("[data-fav]").forEach((b) => {
      const on = isFav(b.dataset.fav),
        r = byId[b.dataset.fav];
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", `${r ? shortName(r.n) : ""} ${on ? "핀 빼기" : "핀 꽂고 알림 받기"}`);
      b.innerHTML = `${SVG_PIN(on)}<span>${on ? "알림 받는 중" : "핀 꽂고 알림 받기"}</span>`;
    });
    renderFav();
    PINS.badges();
    PINS.emit();
  }
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest && e.target.closest("[data-fav]");
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      if (!isMember()) {
        mbOpen("fav");
        return;
      }
      const id = b.dataset.fav;
      if (!isFav(id) && !PINS.room(id)) return;
      toggleFav(id);
      PINS.feedback(b, id, isFav(id));
    },
    true,
  );
  {
    const q = new URLSearchParams(location.search),
      f = q.get("fav");
    if (f) {
      // 받은 핀 링크는 바로 꽂지 않는다 → PINS(ext/70_pins.js)가 '가져올까요?' 시트로 묻고 합치기·바꾸기
      q.delete("fav");
      try {
        history.replaceState(history.state, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
      } catch (e) {}
    }
  }
  if (!CMP.length) CMP = FAV.slice(0, 3);
  function favShareURL() {
    const q = new URLSearchParams(condQuery().slice(1));
    q.set("fav", (CMP.length >= 2 ? CMP : FAV).join("."));
    return pageURL() + "?" + q.toString() + "#favTop";
  }
  // 내 핀: 목록·소식은 PINS(ext/70_pins.js), 나란히 보기 표는 여기서
  function favCmpTable(sel) {
    let table = "";
      const xs = sel.map((r) => ({ r, x: r.src === "moa" ? null : investC(r), w: buyWindow(r), s: stnInfo(r), hj: nearHojae(r) }));
      const tot = (o) => {
        if (gapMode()) {
          const g = gapOf(o.r);
          if (!g.block && !g.na && g.x && g.x.ok) return g.total;
        }
        return o.x && o.x.ok ? o.x.needTotal : null;
      };
      const cash = xs.map(tot),
        pr = xs.map((o) => o.r.eta?.p10 ?? null),
        wk = xs.map((o) => (o.s ? o.s.min : null)),
        hn = xs.map((o) => o.hj.length);
      const best = (arr, dir) => {
        const v = arr.filter((a) => a != null);
        if (v.length < 2) return -1;
        const m = dir < 0 ? Math.min(...v) : Math.max(...v);
        if (v.every((a) => a === m)) return -1;
        return arr.indexOf(m);
      };
      const bc = best(cash, -1),
        bp = best(pr, 1),
        bw = best(wk, -1),
        bh = best(hn, 1);
      const cell = (i, b, html) =>
        `<td${i === b ? ' class="bst"' : ""}>${html}${i === b ? '<i class="bdot" aria-label="이 줄에서 가장 유리한 값"></i>' : ""}</td>`;
      // 비교하는 구역 모두 '계산 불가'·'–'인 줄은 숨긴다(빈 줄만 길어지지 않게)
      const blank = (h) => /^\s*(?:<span class="mut">\s*(?:계산 불가[^<]*|–|-)\s*<\/span>|–|-)\s*$/.test(String(h));
      const row = (lab, f, b = -1) => {
        const hs = xs.map((o, i) => f(o, i));
        return hs.every(blank) ? "" : `<tr><th scope="row">${lab}</th>${hs.map((h, i) => cell(i, b, h)).join("")}</tr>`;
      };
      table = `<p class="fv-base">비교 기준: ${gapMode() ? "전세 끼고 " : "현금 "}${e2(CASH)}억${num("pIncome") != null ? ` · 연소득 ${fmt(num("pIncome"))}만원` : " · 연소득 미입력"} (계산기에 넣은 조건)</p>${84 + xs.length * 120 > 340 ? '<p class="fv-hint" aria-hidden="true">옆으로 밀어서 더 보기 →</p>' : ""}<div class="fv-tw"><table class="fv-t" style="min-width:${84 + xs.length * 120}px"><caption class="sr-only">핀 꽂은 구역 나란히 보기</caption><thead><tr><th scope="col"><span class="sr-only">항목</span></th>${xs.map((o) => `<th scope="col"><button type="button" class="fv-open" data-open="${o.r.id}">${esc(shortName(o.r.n))}</button><small>${esc(o.r.g)} ${esc((o.r.bj || o.r.j || "").split(" ")[0])}</small></th>`).join("")}</tr></thead><tbody>\n      ${row("입주까지 현금", (o, i) => (cash[i] != null ? `<b>${e2(cash[i])}억</b><small>${cash[i] <= CASH ? `내 현금 ${e2(CASH)}억으로 가능` : `${e2(cash[i] - CASH)}억 부족`}</small>` : '<span class="mut">계산 불가</span>'), bc)}\n      ${
        gapMode()
          ? row("전세 끼고 지금 ①", (o) => {
              const g = gapOf(o.r);
              return g.block
                ? `<span class="mut">${esc(g.block)}</span>`
                : g.na
                  ? '<span class="mut">계산 불가</span>'
                  : `<b>${e2(g.now)}억</b><small>${g.x.ok ? `이주 때 ${g.reloc < 0.05 ? "추가 없음(이주비 대출로 반환)" : `+${e2(g.reloc)}억`} · ${LBL.cashToMoveIn} ${e2(g.total)}억` : "입주까지 계산 전"}</small>`;
            })
          : ""
      }\n      ${row("매수가 기준", (o) => (o.x && o.x.price != null ? `${e2(o.x.price)}억<small>${isEst(o.r || o.x.r) ? "구 평균 시세로 추정" : o.x.priceSrc === "user" ? "직접 입력" : o.x.priceSrc === "complex" ? "단지 실거래 가운데 값" : "주변 빌라 실거래 가운데 값"}</small>` : `<span class="mut">${noPriceTxt(o.r)}</span>`))}\n      ${row("단계", (o) => esc(stageName(o.r)))}\n      ${row("예상 입주", (o) => { const t = etaShow(o.r); return /^\d|20\d\d|년/.test(t) ? `${esc(t)}<small>계산용 추정</small>` : `<span class="mut">${esc(t)}</span>`; })}\n      ${row("토지거래허가", (o) => { try { const k = TOH.lookup(o.r), z = /주거용 필지 허가 ([\d,]+)건/.exec(k.t); return k.cls === "no" ? `<span class="io no">${z ? `허가 ${z[1]}건 · 실거주 2년` : "허가구역 · 실거주 2년"}</span>` : `<span class="io warn">구청 확인</span><small>${esc(k.t.split(" · ")[0])}</small>`; } catch (e) { return "–"; } })}\n      ${row("10년 안 준공 가능성", (o) => (o.r.eta?.p10 != null ? `${prob(o.r.eta.p10)}%<small>추정</small>` : '<span class="mut">–</span>'), bp)}\n      ${row("가까운 역·도보", (o) => (o.s ? `${esc(o.s.n)}역 ${fmt(o.s.d)}m<small>도보 약 ${o.s.min}분 · 직선거리 기준</small>` : "–"), bw)}\n      ${row(
        "GTX·주변 호재",
        (o) =>
          o.hj.length
            ? `${o.hj.length}건<small>${esc(
                o.hj
                  .slice(0, 2)
                  .map((h) => h.h.n)
                  .join(", "),
              )}</small>`
            : '<span class="mut">1.5km 안 없음</span>',
        bh,
      )}\n      ${row("입주권 판단", (o) => `<span class="io ${o.w.cls}">${esc(o.w.t)}</span>${o.w.due ? `<small>${esc(o.w.due)}</small>` : ""}`)}\n      ${row("매물", (o) => (listingURL(o.r) ? `<a class="btn text sm" href="${esc(listingURL(o.r))}" target="_blank" rel="noopener">${noTicket(o.r) ? "주변 시세 보기" : "매물 보기"} ↗</a>` : "–"))}\n    </tbody></table></div><p class="t-note"><i class="bdot" aria-hidden="true"></i> 표시는 그 줄에서 숫자가 가장 유리한 칸(현금·도보는 적은 쪽, 확률·호재는 많은 쪽)이에요. 어느 구역이 낫다는 뜻은 아니에요 · 추정치 · 투자 권유 아님</p>`;
    return table;
  }
  function renderFav() {
    const out = $("fvOut");
    if (!out) return;
    const co = $("pnCmpOut");
    if (!isMember()) {
      setHTML(
        out,
        lockCard({
          kind: "table",
          title: "내 핀",
          line: `핀 꽂은 구역의 단계·신고가·필요한 돈 변화를 모아 보고, 2~3곳을 나란히 비교해요.${FAV.length ? ` 지금까지 꽂은 핀 ${fmt(FAV.length)}곳은 그대로 남아 있어요.` : ""}`,
          ctx: "fav",
        }),
      );
      if (co) setHTML(co, "");
      return;
    }
    const note = FAV_NOTE ? `<p class="t-ok">${esc(FAV_NOTE)}</p>` : "";
    if (!FAV.length) {
      setHTML(out, `${note}${PINS.emptyHTML()}`);
      if (co) setHTML(co, "");
      return;
    }
    CMP = CMP.filter(isFav).slice(0, 3);
    setHTML(
      out,
      `${note}${PINS.listHTML()}
    <div class="t-acts pn-acts"><button type="button" class="btn text sm" id="fvClear">핀 모두 빼기</button></div>`,
    );
    if (co && PINS.cmpShown() && CMP.length >= 2 && typeof TOH !== "undefined" && !TOH.loaded()) TOH.load().then((T) => { if (T && PINS.cmpShown()) renderFav(); });
    if (co) setHTML(co, PINS.cmpShown() && CMP.length >= 2 ? `<div class="pn-cmp"><div class="pn-cmp-h"><h3 id="pnCmpT" tabindex="-1">나란히 보기</h3><button type="button" class="btn text sm" id="pnCmpX">닫기</button></div>${favCmpTable(CMP.map((id) => byId[id]))}</div>` : "");
    PINS.after();
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("[data-cmp],[data-open],#fvShare,#fvClear,[data-jump2]");
    if (!t) return;
    if (t.dataset.cmp) {
      const id = t.dataset.cmp;
      if (CMP.includes(id)) CMP = CMP.filter((x) => x !== id);
      else {
        if (CMP.length >= 3) CMP.shift();
        CMP.push(id);
      }
      FAV_NOTE = "";
      renderFav();
      return;
    }
    if (t.dataset.open) {
      curTab = "money";
      select(t.dataset.open, true, false, { scroll: true });
      return;
    }
    if (t.id === "fvShare") {
      shareLink(favShareURL(), $("fvShareFb"));
      return;
    }
    if (t.id === "fvClear") {
      FAV = [];
      CMP = [];
      FAV_NOTE = "";
      PINS.clear();
      saveFav();
      syncFav();
      return;
    }
    if (t.dataset.jump2) {
      e.preventDefault();
      jumpTo(t.dataset.jump2);
    }
  });
  const STN_NAMES = [...new Set(STN.map((s) => s.n))].sort(byName);
  function pickerBind(inputId, sugId, items, onPick, render) {
    const inp = $(inputId),
      box = $(sugId);
    let hits = [],
      idx = -1;
    const close = () => {
      box.hidden = true;
      inp.setAttribute("aria-expanded", "false");
      inp.removeAttribute("aria-activedescendant");
    };
    const show = () => {
      const q = inp.value.trim().replace(/역$/, "").replace(/\s/g, "");
      hits = q ? items(q).slice(0, 8) : [];
      idx = -1;
      if (!hits.length) {
        if (q) {
          box.innerHTML = `<p class="st-none" role="status">찾는 역이 없어요: ${esc(inp.value.trim())}. 서울 안 지하철역 이름으로 다시 찾아 주세요(판교·수원 등 서울 밖 역은 아직 없어요). 아래 결과는 이전에 고른 역 기준이에요.</p>`;
          box.hidden = false;
          inp.setAttribute("aria-expanded", "false");
        } else close();
        return;
      }
      box.innerHTML = hits
        .map((h, i) => `<button type="button" role="option" id="${sugId}-${i}" aria-selected="false" tabindex="-1">${render(h)}</button>`)
        .join("");
      box.hidden = false;
      inp.setAttribute("aria-expanded", "true");
      box.querySelectorAll("button").forEach(
        (b, i) =>
          (b.onmousedown = (e) => {
            e.preventDefault();
            onPick(hits[i]);
            close();
          }),
      );
    };
    inp.addEventListener("input", show);
    inp.addEventListener("focus", () => {
      try {
        inp.select();
      } catch (e) {}
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (box.hidden) return;
        e.preventDefault();
        idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length;
        box.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-selected", String(i === idx)));
        inp.setAttribute("aria-activedescendant", `${sugId}-${idx}`);
      } else if (e.key === "Enter") {
        if (!hits.length) return;
        e.preventDefault();
        onPick(hits[Math.max(0, idx)]);
        close();
      } else if (e.key === "Escape") close();
    });
    inp.addEventListener("blur", () => setTimeout(close, 120));
  }
  const KM_U = 0.0388;
  let GRAPH = null;
  function buildGraph() {
    if (GRAPH) return GRAPH;
    const segOf = (li) => {
      const out = [];
      (TRD.paths[String(li)] || []).forEach((p) => {
        const pts = p.split(" ").map((q) => q.split(",").map(Number));
        for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
      });
      return out;
    };
    const dseg = (p, a, b) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    const dist = (a, b) => Math.hypot(a.xy[0] - b.xy[0], a.xy[1] - b.xy[1]);
    const adj = new Map();
    const key = (i, li) => i + "|" + li;
    const addE = (i, j, li, km) => {
      const gtx = /^GTX/.test(LNS[li]);
      const w = gtx ? Math.max(2.2, km * 0.75) : Math.max(2, km * 1.6);   // 역 사이 최소 2분(정차 포함), 먼 구간은 km당 1.6분
      [
        [i, j],
        [j, i],
      ].forEach(([a, b]) => {
        const k = key(a, li);
        if (!adj.has(k)) adj.set(k, []);
        adj.get(k).push([key(b, li), w]);
      });
    };
    // 2호선 지선은 본선과 따로 — 신정지선(신도림–까치산)·성수지선(성수–신설동)은 갈아타야 한다
    const L2 = LNS.indexOf("2호선");
    const BR = [
      ["신도림", ["도림천", "양천구청", "신정네거리", "까치산"]],
      ["성수", ["용답", "신답", "용두", "신설동"]],
    ];
    const brOf = new Map();
    BR.forEach(([, a], bi) => a.forEach((n) => brOf.set(n, bi)));
    const gl = STN.map((s) => s.ls.flatMap((li) => (li === L2 && brOf.has(s.n) ? [LNS.length + brOf.get(s.n)] : [li])));
    BR.forEach(([h], bi) => STN.forEach((s, i) => s.n === h && s.ls.includes(L2) && gl[i].push(LNS.length + bi)));
    const GL = LNS.map((ln, li) => [li, li]).concat(BR.map((b, bi) => [LNS.length + bi, L2]));
    GL.forEach(([li, pl]) => {
      const S = STN.map((s, i) => i).filter((i) => gl[i].includes(li));
      if (S.length < 2) return;
      const G = segOf(pl);
      const cell = 40,
        grid = new Map();
      G.forEach((g, gi) => {
        const x0 = Math.floor(Math.min(g[0][0], g[1][0]) / cell),
          x1 = Math.floor(Math.max(g[0][0], g[1][0]) / cell),
          y0 = Math.floor(Math.min(g[0][1], g[1][1]) / cell),
          y1 = Math.floor(Math.max(g[0][1], g[1][1]) / cell);
        for (let x = x0; x <= x1; x++)
          for (let y = y0; y <= y1; y++) {
            const k = x + "," + y;
            if (!grid.has(k)) grid.set(k, []);
            grid.get(k).push(gi);
          }
      });
      const near = (p) => {
        const cx = Math.floor(p[0] / cell),
          cy = Math.floor(p[1] / cell);
        for (let x = cx - 1; x <= cx + 1; x++)
          for (let y = cy - 1; y <= cy + 1; y++) {
            const l = grid.get(x + "," + y);
            if (l && l.some((gi) => dseg(p, G[gi][0], G[gi][1]) < 9)) return true;
          }
        return false;
      };
      const par = new Map(S.map((i) => [i, i]));
      const f = (x) => {
        while (par.get(x) !== x) {
          par.set(x, par.get(par.get(x)));
          x = par.get(x);
        }
        return x;
      };
      const edges = [];
      for (let a = 0; a < S.length; a++)
        for (let b = a + 1; b < S.length; b++) {
          const i = S[a],
            j = S[b],
            d = dist(STN[i], STN[j]);
          if (d * KM_U > 12) continue;
          if (S.some((k) => k !== i && k !== j && dist(STN[k], STN[i]) + dist(STN[k], STN[j]) < 1.12 * d)) continue;
          if (
            G.length &&
            ![0.2, 0.35, 0.5, 0.65, 0.8].every((t) =>
              near([STN[i].xy[0] + (STN[j].xy[0] - STN[i].xy[0]) * t, STN[i].xy[1] + (STN[j].xy[1] - STN[i].xy[1]) * t]),
            )
          )
            continue;
          edges.push([i, j, d * KM_U]);
          par.set(f(i), f(j));
        }
      const cand = [];
      for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) cand.push([dist(STN[S[a]], STN[S[b]]) * KM_U, S[a], S[b]]);
      cand.sort((p, q) => p[0] - q[0]);
      for (const [km, i, j] of cand) {
        if (km > 25) break;
        if (f(i) !== f(j)) {
          par.set(f(i), f(j));
          edges.push([i, j, km]);
        }
      }
      edges.forEach(([i, j, km]) => addE(i, j, li, km));
    });
    const byN = new Map();
    STN.forEach((s, i) => {
      if (!byN.has(s.n)) byN.set(s.n, []);
      byN.get(s.n).push(i);
    });
    return (GRAPH = { adj, byN, key, gl });
  }
  // 노선별 평균 대기(배차 간격의 절반, 분): 배차가 긴 경의중앙·경춘·지선은 갈아타거나 처음 탈 때 더 기다린다
  const HW = { "1호선": 3, 경의중앙선: 6, 경춘선: 8, 서해선: 6, 공항철도: 4, 수인분당선: 4, 우이신설선: 2.5, 신림선: 2.5, "GTX-A": 5 };
  const hw = (li) => (li >= LNS.length ? 4 : HW[LNS[li]] ?? 2.5);
  function commuteFrom(dest) {
    const g = buildGraph(),
      D = new Map(),
      prev = new Map(),
      heap = [];
    const push = (d, k) => {
      heap.push([d, k]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0],
        last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1,
            r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    (g.byN.get(dest) || []).forEach((i) =>
      g.gl[i].forEach((li) => {
        const k = g.key(i, li);
        D.set(k, 0);
        push(0, k);
      }),
    );
    while (heap.length) {
      const [d, k] = pop();
      if (d > (D.get(k) ?? Infinity)) continue;
      const [i, li] = k.split("|").map(Number);
      const nb = (g.adj.get(k) || []).slice();
      (g.byN.get(STN[i].n) || []).forEach((j) =>
        g.gl[j].forEach((l2) => {
          const k2 = g.key(j, l2);
          if (k2 !== k) nb.push([k2, 6 + hw(li)]);   // 환승 = 갈아타는 길 6분 + 갈아탈 노선 평균 대기
        }),
      );
      nb.forEach(([k2, w]) => {
        if (d + w < (D.get(k2) ?? Infinity)) {
          D.set(k2, d + w);
          prev.set(k2, k);
          push(d + w, k2);
        }
      });
    }
    const best = new Map();
    D.forEach((d0, k) => {
      const [i, li] = k.split("|").map(Number),
        n = STN[i].n,
        d = d0 + (n === dest ? 0 : hw(li));   // 출발역에서 처음 탈 때 대기

      const b = best.get(n);
      if (!b || d < b.d) best.set(n, { d, k, m: d0 });   // 고를 때는 첫 대기까지, 보여 줄 때는 타고 가는 시간(m)
    });
    const route = (n) => {
      const b = best.get(n);
      if (!b) return null;
      let k = b.k;
      const seq = [k];
      while (prev.has(k)) {
        k = prev.get(k);
        seq.push(k);
      }
      const st = seq.map((x) => x.split("|").map(Number));
      const tr = [];
      for (let a = 1; a < st.length; a++)
        if (st[a][1] !== st[a - 1][1] && STN[st[a][0]].n === STN[st[a - 1][0]].n && !tr.includes(STN[st[a][0]].n)) tr.push(STN[st[a][0]].n);
      return { min: b.m, tr, first: LNS[st[0][1]] || "2호선", path: st.map(([i, l]) => STN[i].n + ":" + (LNS[l] || "2지선")) };
    };
    return { best, route };
  }
  window.__cmTrip = (o, d) => {
    const rt = commuteFrom(d).route(o);
    return rt ? { min: Math.round(rt.min * 10) / 10, via: rt.tr, path: rt.path } : null;
  };
  let CM = { dest: "강남", max: 50, n: 18 },
    CM_SET = new Set(),
    CM_RES = null,
    CM_SHOW = false;
  const CM_CHIPS = [
    "강남",
    "여의도",
    "광화문",
    "시청",
    "삼성",
    "판교",
    "을지로입구",
    "구로디지털단지",
    "마곡나루",
    "가산디지털단지",
  ].filter((n) => STN_NAMES.includes(n));
  function zoneStn(r) {
    const x = stnInfo(r);
    if (!x) return null;
    const s = x.s || (nearStn(r) || {}).s;
    return s ? { s, n: s.n, walk: x.min, d: x.d } : null;
  }
  function runCommute() {
    const out = $("cmOut");
    if (!out) return;
    const C = commuteFrom(CM.dest),
      res = [];
    baseList().forEach((r) => {
      if (!r.ll) return;
      const z = zoneStn(r);
      if (!z) return;
      const rt = C.route(z.n);
      if (!rt) return;
      const tot = Math.round(z.walk + rt.min);
      if (tot > CM.max) return;
      const x = investC(r),
        g = gapMode() ? gapOf(r) : null;
      const st = g ? (g.block || g.na ? "u" : g.now <= CASH ? "y" : "n") : x.ok ? (x.needTotal <= CASH ? "y" : "n") : "u";
      res.push({ r, x, g, z, rt, tot, st });
    });
    const ord = { y: 0, n: 1, u: 2 };
    const totOf = (o) => (o.g ? (o.g.x.ok && !o.g.block && !o.g.na ? o.g.total : 999) : o.x.ok ? o.x.needTotal : 999);
    // 출퇴근 도구라 같은 판정(가능·부족·계산 전) 안에서는 가까운(분) 순 → 같은 분이면 적은 돈 순
    res.sort((a, b) => ord[a.st] - ord[b.st] || a.tot - b.tot || totOf(a) - totOf(b));
    CM_RES = res;
    CM_SET = new Set(res.filter((o) => !($("cmOnly") ? $("cmOnly").checked : true) || o.st === "y").map((o) => o.r.id));
    const ny = res.filter((o) => o.st === "y").length;
    const card = (o) => {
      const r = o.r,
        x = o.x,
        via = o.rt.tr.length ? ` → 환승 ${o.rt.tr.map(esc).join(" → ")}` : "";
      const money = o.g
        ? o.g.block
          ? `<span class="cm-m u">${esc(o.g.block)}</span>`
          : o.g.na
            ? '<span class="cm-m u">매수가 추정 불가 · 주변 빌라 거래가 적어요</span>'
            : `<span class="cm-m ${o.st}">전세 끼고 지금 <b>${e2(o.g.now)}억</b>${o.g.x.ok ? ` · 입주까지 현금 ${e2(o.g.total)}억` : ""}${o.st === "n" ? ` · ${e2(o.g.now - CASH)}억 부족` : ""}</span>`
        : o.st === "y"
          ? `<span class="cm-m y">입주까지 현금 <b>${e2(x.needTotal)}억</b> · 내 현금으로 가능</span>`
          : o.st === "n"
            ? `<span class="cm-m n">입주까지 현금 <b>${e2(x.needTotal)}억</b> · ${e2(x.needTotal - CASH)}억 부족</span>`
            : `<span class="cm-m u">${x.needBuy != null ? `지금 매수 ${e2(x.needBuy)}억 · 입주까지는 계산 전` : "시세 자료 부족 · 계산 불가"}</span>`;
      return `<li class="cm-c ${o.st}"><div class="cm-top"><div><b class="cm-n">${esc(shortName(r.n))}</b><small>${esc(r.g)} ${esc((r.bj || r.j || "").split(" ")[0])} · ${esc(stageName(r))}</small></div>${favBtn(r, "sm")}</div>\n      <p class="cm-t"><b>${o.tot}분</b> <span>예상 출퇴근</span></p>\n      <p class="cm-r">도보 ${o.z.walk}분 · ${esc(o.z.n)}역${via} → ${esc(CM.dest)}</p>\n      ${money}\n      <div class="cm-a"><button type="button" class="btn text sm" data-open="${r.id}">리포트</button><button type="button" class="btn text sm" data-cmmap="${r.id}">지도에서 보기</button></div></li>`;
    };
    const only = $("cmOnly") ? $("cmOnly").checked : true,
      pool = only ? res.filter((o) => o.st === "y") : res;
    const shown0 = only ? pool : res.slice(0, CM.n),
      cmLock = !isMember() && (only ? pool : res).length > 3;
    const shown = cmLock ? shown0.slice(0, 3) : shown0;
    setHTML(
      out,
      `<div class="cm-sum"><p><b>${esc(CM.dest)}역</b>까지 <b>${CM.max}분</b> 안 <b class="cm-big">${fmt(res.length)}곳</b>${res.length ? ` · 그중 ${gapMode() ? `전세 끼고 ${e2(CASH)}억으로 살 수 있는 곳` : `내 현금 ${e2(CASH)}억으로 입주 가능`} <b class="y">${fmt(ny)}곳</b>` : ""}</p>${res.length ? `<button type="button" class="btn secondary sm" data-cmmap="*">지도에서 모두 보기</button>` : ""}</div>\n    ${res.length ? `${shown.length ? `<ol class="cm-list">${shown.map(card).join("")}</ol>` : `<div class="t-empty"><b>${CM.max}분 안에 ${gapMode() ? `전세 끼고 ${e2(CASH)}억으로` : `내 현금 ${e2(CASH)}억으로 입주까지`} 되는 곳은 아직 없어요</b><p>'내 조건에 맞는 곳만'을 끄면 ${fmt(res.length)}곳을 모두 볼 수 있어요.</p></div>`}${cmLock ? lockCard({ kind: "list", title: `여기까지 무료로 볼 수 있어요`, line: `나머지 ${fmt((only ? pool : res).length - 3)}곳 전체 목록은 멤버십에서 볼 수 있어요.`, ctx: "commute" }) : ""}${!cmLock && !only && res.length > shown.length ? `<div class="t-acts"><button type="button" class="btn secondary sm" id="cmMore">${fmt(Math.min(18, res.length - shown.length))}곳 더 보기 · 남은 ${fmt(res.length - shown.length)}곳</button></div>` : ""}${only && res.length > pool.length ? `<p class="t-note">그 밖에 ${fmt(res.length - pool.length)}곳은 현금이 부족하거나 계산 불가 · '내 조건에 맞는 곳만'을 끄면 보여요</p>` : ""}` : `<div class="t-empty"><b>${CM.max}분 안에 계산기 조건에 맞는 구역이 없어요</b><p>시간을 늘리거나 다른 역을 골라 보세요.</p></div>`}`,
    );
    const m = $("cmMore");
    if (m)
      m.onclick = () => {
        CM.n += 18;
        runCommute();
        const m2 = $("cmMore");
        if (m2) m2.focus({ preventScroll: true });
      };
    document.querySelectorAll("#marks .mc").forEach((el) => el.classList.toggle("cm", CM_SHOW && CM_SET.has(el.dataset.id)));
    if (typeof rescaleDots === "function" && mapView === "gu") rescaleDots();
    if (CM_SHOW && typeof drawLegend === "function") drawLegend();
  }
  function setDest(n) {
    if (!STN_NAMES.includes(n)) return;
    CM.dest = n;
    CM.n = 18;
    $("cmQ").value = n;
    drawCmChips();
    runCommute();
  }
  function drawCmChips() {
    $("cmChips").innerHTML = CM_CHIPS.map(
      (n) => `<button type="button" class="chip-b" data-dest="${n}" aria-pressed="${CM.dest === n}">${esc(n)}</button>`,
    ).join("");
    $("cmChips")
      .querySelectorAll("[data-dest]")
      .forEach((b) => (b.onclick = () => setDest(b.dataset.dest)));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-cmmap]");
    if (!b) return;
    const id = b.dataset.cmmap;
    if (id !== "*") {
      curTab = "money";
      select(id, true, false, { scroll: true });
      return;
    }
    const cnt = new Map();
    (CM_RES || []).forEach((o) => cnt.set(o.r.g, (cnt.get(o.r.g) || 0) + (o.st === "y" ? 3 : 1)));
    const g = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!g) return;
    CM_SHOW = true;
    jumpTo("mapTop");
    setTimeout(
      () => {
        enterGu(g[0], { hist: true });
        setTimeout(() => {
          document.querySelectorAll("#marks .mc").forEach((el) => el.classList.toggle("cm", CM_SET.has(el.dataset.id)));
          rescaleDots();
          drawLegend();
        }, 700);
      },
      reduceMotion() ? 0 : 350,
    );
  });
  function initCommute() {
    if (!$("cmOut")) return;
    pickerBind(
      "cmQ",
      "cmSug",
      (q) =>
        STN_NAMES.filter((n) => n.replace(/\s/g, "").includes(q)).sort(
          (a, b) => (a.startsWith(q) ? 0 : 1) - (b.startsWith(q) ? 0 : 1) || a.length - b.length,
        ),
      (n) => setDest(n),
      (n) => {
        const s = stnBy(n);
        return `${esc(n)}역<small>${s ? esc(stnLines(s)) : ""}</small>`;
      },
    );
    $("cmOnly").addEventListener("change", () => {
      CM.n = 18;
      runCommute();
    });
    $("cmMax")
      .querySelectorAll("button")
      .forEach(
        (b) =>
          (b.onclick = () => {
            CM.max = +b.dataset.v;
            CM.n = 18;
            setSeg("cmMax", CM.max);
            runCommute();
          }),
      );
    $("cmQ").value = CM.dest;
    drawCmChips();
    runCommute();
  }
  let SV = { rate: 0, g: 0, touched: false };
  function renderSave() {
    const out = $("svOut");
    if (!out) return;
    // '모으면 언제?' 화면이 안 보일 땐(첫 화면 등) 셈을 미뤘다가, 화면이 보이는 순간 한 번 그린다(시작 때 긴 작업 줄이기)
    const svSec = $("saveTop");
    if (svSec && !svSec.getClientRects().length) {
      SV.dirty = true;
      if (!SV.ro && window.ResizeObserver) (SV.ro = new ResizeObserver(() => { if (SV.dirty && svSec.getClientRects().length) renderSave(); })).observe(svSec);
      if (window.ResizeObserver) return;
    }
    SV.dirty = false;
    const c0 = parseFloat($("svCash").value),
      mon = parseFloat(String($("svMon").value).replace(/,/g, ""));
    const cash0 = isFinite(c0) && c0 >= 0 ? c0 : CASH,
      m = isFinite(mon) && mon >= 0 ? mon / 1e4 : 0,
      i = SV.rate / 100 / 12;
    const at = (k) => (i ? cash0 * Math.pow(1 + i, k) + (m * (Math.pow(1 + i, k) - 1)) / i : cash0 + m * k);
    // 집값이 오르면 같은 구역에 필요한 돈도 같이 오른다 → 모은 돈을 '지금 가치'로 낮춰서 센다
    const gr = SV.g / 100,
      atE = (k) => at(k) / Math.pow(1 + gr, k / 12),
      HMAX = 12 * 20;
    const monthsTo = (c) => {
      if (cash0 >= c) return 0;
      if (m <= 0 && !i) return null;
      let lo = 0,
        hi = HMAX;
      if (atE(hi) < c) return null;
      while (hi - lo > 1) {
        const md = (lo + hi) >> 1;
        if (atE(md) >= c) hi = md;
        else lo = md;
      }
      return hi;
    };
    // 곳 수는 홈 '살 수 있는 곳'과 같은 판정(window.ZP_ok)으로 센다
    const cnt = (c) => {
      if (typeof window.ZP_ok !== "function") return gapMode() ? gapCount(c) : computeOk({ cash: c });
      const sv = CASH;
      CASH = c;
      try {
        return R.filter(window.ZP_ok).length;
      } finally {
        CASH = sv;
      }
    };
    const n0 = cnt(cash0);
    const needs = gapMode()
      ? baseList()
          .map(gapOf)
          .filter((g) => !g.block && !g.na)
          .map((g) => g.now)
          .sort((a, b) => a - b)
      : baseList()
          .map(investC)
          .filter((x) => (P.basis === "total" ? x.ok : x.needBuy != null))
          .map((x) => (P.basis === "total" ? x.needTotal : x.needBuy))
          .sort((a, b) => a - b);
    const firstC = needs.find((v) => v > cash0);
    const ms = [
      ...new Set([firstC && n0 === 0 ? Math.ceil(firstC * 10) / 10 : null, 5, 7, 10, 15, 20].filter((c) => c != null && c > cash0 + 1e-9)),
    ]
      .sort((a, b) => a - b)
      .slice(0, 5);
    const ymTxt = (k) =>
      k == null ? null : k === 0 ? "지금" : `${k >= 12 ? `${Math.floor(k / 12)}년` : ""}${k % 12 ? ` ${k % 12}개월` : ""} 뒤`.trim();
    const rows = ms.map((c) => {
      const k = monthsTo(c);
      return { c, k, n: cnt(c) };
    });
    const basisLab = gapMode() ? "전세 끼고 가능" : P.basis === "total" ? "입주 가능" : "지금 매수 가능";
    const firstRow = rows.find((o) => o.k != null && o.n > n0);
    const tgtK = firstRow ? firstRow.k : null;
    const YMAX = 20,
      pts = [];
    for (let y = 0; y <= YMAX; y++) {
      const c = atE(12 * y);
      pts.push({ y, c, n: cnt(c) });
    }
    const mpts = [];
    {
      let prevN = -1;
      for (let k = 0; k <= 12 * YMAX; k++) {
        const n = cnt(atE(k));
        if (n !== prevN) {
          mpts.push({ y: k / 12, n });
          prevN = n;
        }
      }
    }
    const hook =
      n0 > 0 && !firstRow
        ? `지금 ${e2(cash0)}억으로 이미 <b>${fmt(n0)}곳</b> ${basisLab}`
        : firstRow
          ? `지금 ${e2(cash0)}억 · 매달 ${fmt(Math.round(m * 1e4))}만 원이면 <b>${ymTxt(firstRow.k)}</b> ${e2(firstRow.c)}억 → <b>${fmt(firstRow.n)}곳</b>${n0 ? `(지금 ${fmt(n0)}곳)` : "부터"}${gr ? `<small class="sv-gn">집값 연 ${SV.g}% 오름 반영 · 금액은 지금 가치</small>` : `<small class="sv-gn">집값이 그대로일 때 · 오르면 더 늦어져요</small>`}`
          : m > 0 || i
            ? `지금 ${e2(cash0)}억 · 매달 ${fmt(Math.round(m * 1e4))}만 원으로는 <b>20년 넘게</b> 걸려요${gr ? ` (집값 연 ${SV.g}% 오름 가정)` : ""}`
            : `매달 모으는 돈을 넣으면 언제 몇 곳이 되는지 보여 줘요`;
    // 넓은 PC 입주 계산 아래(.pl-save)에서는 그래프가 왼쪽 칸(약 55%)만 쓴다(66_tools.css) — 글자가 줄어들지 않게 그 폭으로 그린다
    const W = Math.max(300, Math.round((out.clientWidth || 640) * (out.closest(".pl-save") && matchMedia("(min-width:1200px)").matches ? 0.55 : 1))),
      H = W < 520 ? 200 : 240,
      pl = 40,
      pr = 14,
      pt = 22,
      pb = 28,
      ymax = Math.max(5, ...pts.map((p) => p.n)),
      niceMax = (v) => {
        const e = Math.pow(10, Math.floor(Math.log10(v)));
        // 축 끝이 최댓값의 두 배 가까이 가지 않게(120 → 200이던 것) 촘촘한 단계로 올림
        return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((k) => k * e >= v - 1e-9) * e;
      },
      top = niceMax(Math.max(ymax, ...mpts.map((p) => p.n)));
    const X = (y) => pl + ((W - pl - pr) * y) / YMAX,
      Y = (n) => pt + (H - pt - pb) * (1 - n / top);
    let d = `M${X(0)},${Y(mpts[0].n)}`;
    mpts.slice(1).forEach((p) => {
      d += ` H${X(p.y)} V${Y(p.n)}`;
    });
    d += ` H${X(YMAX)}`;
    const gy = [0, top / 2, top]
      .map(
        (v) =>
          `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" class="sv-g"/><text x="${pl - 6}" y="${Y(v) + 4}" class="sv-yl">${fmt(v)}</text>`,
      )
      .join("") + `<text x="${pl - 6}" y="10" class="sv-yl sv-unit">곳</text>`;
    const gx = [...new Set([0, 5, 10, 15, 20, 25, 30, 35, 40].filter((y) => y <= YMAX - 2).concat(YMAX))]
      .map((y) => `<text x="${X(y)}" y="${H - 8}" class="sv-xl">${y ? y + "년" : "지금"}</text>`)
      .join("");
    const dotLab = [],
      dots = rows
        .filter((o) => o.k != null && o.k <= YMAX * 12)
        .map((o) => {
          const cx = X(o.k / 12),
            cy = Y(o.n),
            right = o.k / 12 > YMAX * 0.8,
            t = `${e2(o.c)}억 · ${fmt(o.n)}곳`,
            tw = t.length * 7.2 + 4,
            tx = cx + (right ? -8 : 8);
          const x0 = right ? tx - tw : tx,
            x1 = right ? tx : tx + tw;
          let ty = null;
          for (const c of [cy - 8, cy + 18, cy - 24, cy + 34]) {
            if (c < pt + 10 || c > H - pb - 4) continue;
            if (!dotLab.some((b) => x0 < b[1] && x1 > b[0] && Math.abs(c - b[2]) < 15)) {
              ty = c;
              break;
            }
          }
          if (ty != null) dotLab.push([x0, x1, ty]);
          return (
            `<circle cx="${cx}" cy="${cy}" r="4.5" class="sv-d"/>` +
            (ty != null ? `<text x="${tx}" y="${ty}" class="sv-dl" text-anchor="${right ? "end" : "start"}">${t}</text>` : "")
          );
        })
        .join("");
    const hits = pts
      .map(
        (p) =>
          `<rect x="${X(p.y) - (W - pl - pr) / YMAX / 2}" y="${pt}" width="${(W - pl - pr) / YMAX}" height="${H - pt - pb}" class="sv-h" data-y="${p.y}" data-c="${e2(p.c)}" data-n="${p.n}"/>`,
      )
      .join("");
    setHTML(
      out,
      `<p class="sv-hook">${hook}</p>\n    <div class="sv-ch"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="해마다 ${basisLab} 구역 수 계단 그래프. 아래 표에 같은 값이 있어요.">${gy}${gx}<path d="${d}" class="sv-l"/>${dots}${hits}<line class="sv-x" x1="0" x2="0" y1="${pt}" y2="${H - pb}" hidden/></svg><div class="sv-tip" id="svTip" hidden></div></div>\n    <table class="sv-t cardt"><caption class="sr-only">현금 목표별 도달 시점과 ${basisLab} 구역 수</caption><thead><tr><th scope="col">현금</th><th scope="col">도달 시점</th><th scope="col">${basisLab}</th></tr></thead><tbody>\n      <tr><td data-l="현금">${e2(cash0)}억</td><td data-l="도달 시점">지금</td><td data-l="${basisLab}">${fmt(n0)}곳</td></tr>\n      ${rows.map((o) => `<tr><td data-l="현금">${e2(o.c)}억</td><td data-l="도달 시점">${o.k == null ? "20년 넘게" : ymTxt(o.k)}</td><td data-l="${basisLab}">${fmt(o.n)}곳</td></tr>`).join("")}\n    </tbody></table>${gapMode() ? gapSavePlan(cash0, m, at) : ""}`,
    );
    const svg = out.querySelector(".sv-ch svg"),
      tip = $("svTip"),
      xl = out.querySelector(".sv-x");
    out.querySelectorAll(".sv-h").forEach((h) => {
      const show = () => {
        tip.hidden = false;
        tip.textContent = `${+h.dataset.y ? h.dataset.y + "년 뒤" : "지금"} · ${h.dataset.c}억 · ${basisLab} ${fmt(+h.dataset.n)}곳`;
        const bb = h.getBoundingClientRect(),
          sb = svg.getBoundingClientRect();
        tip.style.left = Math.min(sb.width - 150, Math.max(0, bb.left - sb.left + bb.width / 2 - 75)) + "px";
        xl.hidden = false;
        const cx = +h.getAttribute("x") + +h.getAttribute("width") / 2;
        xl.setAttribute("x1", cx);
        xl.setAttribute("x2", cx);
      };
      h.addEventListener("pointerenter", show);
      h.addEventListener("click", show);
    });
    svg.addEventListener("pointerleave", () => {
      tip.hidden = true;
      xl.hidden = true;
    });
  }
  let svW = 0;
  window.addEventListener("resize", () => {
    const o = $("svOut");
    if (o && Math.abs(o.clientWidth - svW) > 40) {
      svW = o.clientWidth;
      renderSave();
    }
  });
  function gapSavePlan(cash0, m, at) {
    // 홈 플래너와 같은 기준(참고값 lc 제외)으로 센다 → '살 수 있는 N곳 · ③ 계산 M곳'이 두 곳에서 같게
    const buy = baseList()
      .map(gapOf)
      .filter((g) => !g.r.lc && !g.block && !g.na && g.now != null && g.now <= cash0 + 1e-9);
    const tot = buy.filter((g) => g.x.ok);
    const gs = tot.filter((g) => g.tR != null).sort((a, b) => a.total - b.total);
    // 머리말: 살 수 있는 곳 → ③(입주까지 현금) 계산되는 곳 → 이주 시점까지 나온 곳, 빠지는 단계를 숫자로 밝힘
    const sub =
      buy.length > gs.length
        ? `지금 전세 끼고 살 수 있는 ${fmt(buy.length)}곳 중 ③이 계산되는 ${tot.length > gs.length ? `${fmt(tot.length)}곳, 그중 이주 시점까지 나온 ` : ""}`
        : "";
    if (!gs.length) return `<p class="t-hint">지금 ${e2(cash0)}억으로 전세 끼고 살 수 있고 입주 시점까지 계산되는 곳이 없어요.</p>`;
    if (!isMember())
      return `<div class="gsv"><h3>전세 끼고 지금 ${e2(cash0)}억으로 사면, 매달 ${fmt(Math.round(m * 1e4))}만 원으로 제때 모을 수 있을까?</h3>${lockCard({ kind: "table", title: `구역별 표 · ${fmt(gs.length)}곳`, line: `구역마다 지금 ①·이주 ②·${LBL.cashToMoveIn} ③과 매달 필요한 돈을 표로 보여 줘요.`, ctx: "save" })}</div>`;
    const need = (g) => Math.max((g.now + g.reloc - cash0) / (12 * g.tR), (g.total - cash0) / (12 * g.tM), 0) * 1e4;
    const okN = gs.filter((g) => at(Math.round(12 * g.tR)) >= g.now + g.reloc - 1e-9 && at(Math.round(12 * g.tM)) >= g.total - 1e-9).length;
    const rows = gs
      .slice(0, 12)
      .map((g) => {
        const ok = at(Math.round(12 * g.tR)) >= g.now + g.reloc - 1e-9 && at(Math.round(12 * g.tM)) >= g.total - 1e-9;
        return `<tr><td data-l="구역"><button type="button" class="linklike" data-open="${g.r.id}">${esc(shortName(g.r.n))}</button><small>${esc(g.r.g)}</small></td><td data-l="지금 ①">${f1(g.now)}억</td><td data-l="이주 ②">${g.reloc < 0.05 ? "추가 현금 없음" : `+${f1(g.reloc)}억`}<small>${yrTxt(g.tR)}</small></td><td data-l="${LBL.cashToMoveIn} ③">${f1(g.total)}억<small>${yrTxt(g.tM)}</small></td><td data-l="월 필요">${fmt(Math.ceil(need(g) / 10) * 10)}만원</td><td data-l="매달 ${fmt(Math.round(m * 1e4))}만" class="${ok ? "ok" : "no"}">${ok ? "제때 가능" : "부족"}</td></tr>`;
      })
      .join("");
    return `<div class="gsv"><h3>전세 끼고 지금 ${e2(cash0)}억으로 사면, 매달 ${fmt(Math.round(m * 1e4))}만 원으로 제때 모을 수 있을까?</h3>\n    <p class="sv-hook sm">${(() => {
      const nd = gs.map(need).sort((a, b) => a - b),
        r10 = (v) => Math.ceil(v / 10) * 10,
        mm = fmt(Math.round(m * 1e4));
      const k1 = nd[Math.min(nd.length - 1, Math.floor(nd.length / 2))],
        n1 = nd.filter((v) => v <= r10(k1)).length;
      if (okN === gs.length) return `${sub}${fmt(gs.length)}곳 모두 월 ${mm}만 원이면 이주·입주 시점까지 모을 수 있어요`;
      if (!okN)
        return `${sub}${fmt(gs.length)}곳 모두 월 ${mm}만 원으로는 이주·입주 시점까지 부족해요 · 월 <b>${fmt(r10(nd[0]))}만 원</b>이면 1곳${gs.length > 2 ? `, 월 <b>${fmt(r10(k1))}만 원</b>이면 ${fmt(n1)}곳` : ""}`;
      return `${sub ? sub + `${fmt(gs.length)}곳 가운데 ` : ""}월 ${mm}만 원이면 <b>${fmt(okN)}곳</b>은 이주·입주 시점까지 모을 수 있어요 · 나머지 ${fmt(gs.length - okN)}곳은 더 필요`;
    })()}</p>\n    <div class="fv-tw"><table class="sv-t gsv-t cardt"><caption class="sr-only">구역별 필요 금액과 시점</caption><thead><tr><th scope="col">구역</th><th scope="col">지금 ①</th><th scope="col">이주 ②</th><th scope="col">${LBL.cashToMoveIn} ③</th><th scope="col">월 필요</th><th scope="col">매달 ${fmt(Math.round(m * 1e4))}만</th></tr></thead><tbody>${rows}</tbody></table></div>\n    <p class="t-note">월 필요 = 지금 현금으로 모자란 몫을 이주·입주 예상 시점까지 나눈 값(수익 0%) · 이주 = 예상 입주 − 착공→준공 가운데 값 ${CJ().toFixed(1)}년 · 시세·분담금이 지금 그대로라는 가정 · 투자 권유 아님</p></div>`;
  }
  function initSave() {
    if (!$("svOut")) return;
    $("svCash").placeholder = `예: 3`;
    $("svCash").value = e2(CASH);
    $("svCash").addEventListener("input", () => (SV.touched = $("svCash").value.trim() !== ""));
    ["svCash", "svMon"].forEach((id) => $(id).addEventListener("input", renderSave));
    // 집값 오름 가정(연 0/2/4%)
    if (!$("svGrow")) {
      const f = document.createElement("div");
      f.className = "t-field";
      f.innerHTML = `<span class="t-l" id="svGl">집값 오름 가정</span><div class="seg" id="svGrow" role="group" aria-labelledby="svGl"><button type="button" data-v="0" aria-pressed="true">그대로</button><button type="button" data-v="2" aria-pressed="false">연 2%</button><button type="button" data-v="4" aria-pressed="false">연 4%</button></div>`;
      $("svRate").closest(".t-field").after(f);
      $("svGrow")
        .querySelectorAll("button")
        .forEach(
          (b) =>
            (b.onclick = () => {
              SV.g = +b.dataset.v;
              setSeg("svGrow", SV.g);
              renderSave();
            }),
        );
      const nt = $("svOut").previousElementSibling;
      if (nt && nt.classList.contains("t-note"))
        nt.textContent = "집값 오름 가정을 고르면 필요한 돈도 같은 비율로 오른다고 보고 셈 · 최대 20년까지 · 곳 수는 홈 '살 수 있는 곳'과 같은 기준 · 연 3%는 월복리·세전 가정 · 투자 권유 아님";
    }
    $("svRate")
      .querySelectorAll("button")
      .forEach(
        (b) =>
          (b.onclick = () => {
            SV.rate = +b.dataset.v;
            setSeg("svRate", SV.rate);
            renderSave();
          }),
      );
    renderSave();
  }
  let t3T = 0;
  window.__t3 = () => {
    if (!T3.ready || t3T) return;
    t3T = requestAnimationFrame(() => {
      t3T = 0;
      try {
        if ($("svCash") && !SV.touched) $("svCash").value = e2(CASH);
        runCommute();
        renderSave();
        renderFav();
      } catch (e) {
        console.warn(e);
      }
    });
  };
  function initTools() {
    {
      const lr = $("leadRes");
      if (lr) lr.innerHTML = "";
    }
    initCommute();
    initSave();
    syncFav();
    T3.ready = true;
  }
  async function boot() {
    if (!hash0) initReveal();
    mbInit();
    await yieldT();
    SECT.mapTop();
    await yieldT();
    SECT.rankTop();
    await yieldT();
    SECT.statsTop();
    SECT.rulesTop();
    reportReady = true;
    await yieldT();
    initTools();
    const gu0 = /^map-/.test(hash0) ? decodeURIComponent(hash0.slice(4)) : null;
    if (byId[hash0]) {
      curTab = "money";
      select(hash0, true, false, { scroll: true, deep: true });
    } else if (gu0 && GU.has(gu0)) {
      replSt(null, "");
      enterGu(gu0, { hist: true });
      requestAnimationFrame(() => jumpTo("mapTop"));
    }
    // #report(구별 요약): 모바일에선 빈 리포트 칸이 숨겨지므로 같은 내용인 '지역 · 필요한 돈' 목록으로
    if (hash0 === "report" && !$("report").offsetParent && $("sListW")) setTimeout(() => $("sListW").scrollIntoView({ block: "start" }), 300);
    else if (hash0 && !gu0 && $(hash0)) requestAnimationFrame(() => jumpTo(window.ZP_ALIAS && ZP_ALIAS[hash0] ? (ZP_ALIAS[hash0][1] === "save" ? "saveTop" : ZP_ALIAS[hash0][0]) : hash0));   // 예전 도구 주소는 합친 화면 머리로(60_simple.js ZP_ALIAS)
    refreshFades();
  }
  initFold();
  boot();
  try {
    adRender();
  } catch (e) {}
  {
    const q = new URLSearchParams(location.search),
      from = q.get("from"),
      utm = q.get("utm_source");
    let ref = "";
    try {
      ref = document.referrer ? new URL(document.referrer).hostname : "";
    } catch (e) {}
    track("visit", from ? "p:" + from : utm ? "utm:" + utm : ref ? "ref:" + ref : "direct");
    if (from) {
      q.delete("from");
      try {
        history.replaceState(history.state, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
      } catch (e) {}
    }
  }
  $("pCash") && $("pCash").addEventListener("change", () => track("calc"));
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.btn.naver");
    if (a) track(a.classList.contains("pass") ? "pass_click" : "join_click");
  });
  const mbHash = () => {
    if (location.hash === "#membership") {
      try {
        history.replaceState(history.state, "", location.pathname + location.search);
      } catch (e) {}
      mbOpen("new");
    }
  };
  window.addEventListener("hashchange", mbHash);
  setTimeout(mbHash, 400);
})();
