(function () {
  "use strict";
  // 서비스 이름: tools/brand.py 한 곳에서 정하고 빌드가 자리를 채운다(화면 문구에 이름을 직접 쓰지 않는다)
  const BRAND = "__BRAND__", BRAND_EN = "__BRAND_EN__";
  window.ZP_BRAND = { ko: BRAND, en: BRAND_EN };
  const D = window.__ZPD || JSON.parse(document.getElementById("data").textContent);
  const $ = (id) => document.getElementById(id);
  // 첫 화면 섬(boot.js) 없이 전체 앱으로 바로 뜬 경우: 글꼴은 <link>로 이미 받으니 바로 웹글꼴(app.css :root:not(.fo))
  if (!window.ZP_boot) document.documentElement.classList.add("fo");
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
  /*Y*/
  /*EXT*/
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
  if (!D.stFix)   // 빌드(tools/build.py st_fix)가 이미 했으면 건너뜀
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
  if (!D.stFix) NEW_ST.forEach((s) => {
    const [x, y] = toXY(s[1], s[2]);
    D.stations.push([s[0], s[1], s[2], s[3], x, y]);
  });
  let ST_CHANGED = 0;
  if (!D.stFix) R.forEach((r) => {
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
  // 같은 곳이 두 번 실렸던 옛 id(tools/enrich.py D.alias: 버린 id → 남긴 id) — 옛 링크·핀이 남긴 구역을 연다(목록 R에는 없음)
  for (const [a, k] of Object.entries(D.alias || {})) if (!byId[a] && byId[k]) byId[a] = byId[k];
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
  function scoreOne(r) {
    if (!r.st) return;
    const v = LOC_AX.map((a) => {
      const x = a.f(r);
      return x == null ? null : Math.round(x);
    });
    const wsum = LOC_AX.reduce((s, a, i) => s + (v[i] == null ? 0 : a.w), 0);
    r.ax = v;
    r.pts = v.map((x, i) => (x == null ? 0 : (x * LOC_AX[i].w) / wsum));
    r.score = Math.round(r.pts.reduce((s, x) => s + x, 0));
  }
  // 입지 점수: 앱 코드 실행 한 덩어리에서 빼서 boot()가 300곳씩 나눠 계산(18차 성능) · scoreAll()은 한 번에
  async function scoreChunked() {
    for (let i = 0; i < R.length; i += 300) { for (let j = i; j < Math.min(R.length, i + 300); j++) scoreOne(R[j]); await yieldT(); }
    scoreFin();
  }
  function scoreAll() {
    R.forEach(scoreOne);
    scoreFin();
  }
  function scoreFin() {
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
  // 4라운드(설치 앱): 칩·입주권 화면과 같은 '이주·철거'(웹은 그대로)
  const ST_LAB = ["완료", "후보지·계획·지정", "추진위", "조합설립", "사업시행", "관리처분", document.documentElement.classList.contains("is-tapp") ? "이주·철거" : "이주·착공"];
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
  const josa = (w, a, b) => (window.ZP_josa ? window.ZP_josa(w, a, b) : w + b);   // 받침 규칙 한 곳(src/ext/70_pins.js · 숫자 끝도 읽는 소리로)
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
    // 바깥 사이트로 나가는 링크: 눈에 보이는 ↗(이미 글자에 있으면 그대로) + 화면 읽기 '(새 창)'
    (root || document).querySelectorAll('a[target="_blank"]:not([data-nw])').forEach((a) => {
      a.dataset.nw = "1";
      a.insertAdjacentHTML("beforeend", `${/↗/.test(a.textContent) ? "" : '<span class="ext-ic" aria-hidden="true">↗</span>'}<span class="sr-only"> (새 창)</span>`);
    });
  }
  const yieldT = () => (window.scheduler && scheduler.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0)));
  // 구역 수는 한 기준만: 진행 중 = 준공·해산 빼고 모아타운 관리지역 뺀 곳(tools/zpages.py의 /z·/gu 숫자와 같음)
  window.ZP_zones = { live: POP.length, done: R.filter((r) => isDone(r) && r.src !== "moa").length, moa: MOA_ALL.length };
  try { $("eyebrow").title = `진행 중 ${fmt(POP.length)}곳 = 준공·해산 ${fmt(window.ZP_zones.done)}곳과 모아타운 관리지역 ${fmt(MOA_ALL.length)}곳을 뺀 숫자`; } catch (e) {}
  document.querySelectorAll("[data-zcount]").forEach((el) => (el.textContent = `진행 중 ${fmt(POP.length)}곳 한 장씩`));
  if ($("eyebrow")) $("eyebrow").innerHTML =
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
    if (md === "now") return `${ZF.cash(CASH)}으로 입주까지 가능한 구가 없어 '지금 매수' 가능 수로 칠했어요`;
    if (md === "prog" && mapAff) return `${ZF.cash(CASH)}으로 가능한 구가 없어 진행 중 구역 수로 칠했어요`;
    return "";
  }
  function modeTitle() {
    const md = modeOf();
    return md === "prog"
      ? "진행 중 구역 수"
      : md === "now"
        ? `<span class="lt-f">내 돈 ${ZF.cash(CASH)}으로 지금 매수 가능한 구역 수 (입주까지는 부족)</span><span class="lt-s">${ZF.cash(CASH)} · 지금 매수 가능 (입주까지 부족)</span>`
        : `<span class="lt-f">내 돈 ${ZF.cash(CASH)}으로 ${P.basis === "total" ? "입주까지" : "지금 매수"} 가능한 구역 수</span><span class="lt-s">${ZF.cash(CASH)} · ${P.basis === "total" ? "입주까지" : "지금 매수"} 가능</span>`;
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
      p.setAttribute("aria-label", `${g}, 내 돈으로 가능 ${o.aff}곳, 지도 ${o.prog}곳 · 누르면 확대`);
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
      sub.innerHTML = `<span class="ms-c">${md === "prog" ? "색이 ${DK} 진행 중 구역이 많은 구예요" : md === "now" ? `색이 ${DK} 내 돈 ${ZF.cash(CASH)}으로 지금 매수 가능한 구역이 많은 구예요 (입주까지 가능한 구가 없어 기준을 바꿨어요)` : `색이 ${DK} 내 돈 ${ZF.cash(CASH)}으로 ${P.basis === "total" ? "입주까지" : "지금 매수"} 가능한 구역이 많은 구예요`}${md === "prog" && mapAff ? ` (내 돈 ${ZF.cash(CASH)}으로 가능한 구가 없어요)` : ""}. </span>구를 누르면 확대되고, 확대한 지도에서 구역을 누르면 리포트가 열립니다`;
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
        return `<li><button type="button" class="gl-row" data-gu="${g}" title="지도 ${o.prog}곳 = 진행 중 ${o.prog - o.moa} + 모아타운 관리지역 ${o.moa}${o.done ? ` (완료 ${o.done}곳 별도)` : ""}" aria-label="${g}: 내 돈으로 ${lab} ${v}곳, 지도 ${o.prog}곳 (${[1, 2, 3, 4, 5, 6].map((i) => `${ST_LAB[i]} ${o.st[i]}`).join(", ")}) · 지도에서 확대"><span class="gl-n"><i class="gl-sw" style="${fillVars(tOf(md === "prog" ? o.prog : v))}" aria-hidden="true"></i>${g}</span><span class="gl-a">${lab} <b>${fmt(v)}</b>곳</span>${stBar(o.st, 120)}<span class="gl-p">지도 ${fmt(o.prog)}곳</span></button></li>`;
      })
      .join("");
    const head = `<p class="gl-cap">구를 누르면 지도가 그 구로 확대돼요 · ${lab} = 내 돈 ${ZF.cash(CASH)}으로 ${P.fund === "gap" ? "전세 끼고 지금 계약" : md === "now" || P.basis !== "total" ? "지금 매수" : "입주까지"}<br>지도 N곳 = 위치 확인된 진행 중 구역 + 모아타운 관리지역(완료 제외). 통계의 자치구 수는 모아타운 제외·위치 미확인 포함이라 다를 수 있어요</p>${STAGE_KEY()}`;
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
    y: "내 돈으로 입주 가능",
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
          ? "전세 끼고 내 돈으로 갈 수 있음"
          : "전세 끼고도 현금 부족"
        : a === "y"
          ? effBasis() === "total"
            ? DOT_TXT.y
            : "내 돈으로 지금 매수 가능"
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
    // 모아타운 'A1구역'처럼 붙은 블록 이름은 남긴다(옆 구역 '화곡6동 957'과 이름표가 같아지던 것)
    const blk = shortName(r.n).match(/모아타운\s*([A-Z]\d+(?:-\d+)?)\s*(구역)?$/);
    if (blk && !s.includes(blk[1])) s = `${s.length > 8 ? s.slice(0, 8) + "…" : s} ${blk[1]}`;
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
  /*Y*/
  const IS_MOBILE =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ""));
  function listingURL(r) {
    if (!r || !r.ll) return null;
    const q = `${r.ll[0].toFixed(6)},${r.ll[1].toFixed(6)},17`;
    if (aptZone(r) && KBC[r.id]) return `https://kbland.kr/c/${KBC[r.id]}`;
    return `https://kbland.kr/map?xy=${r.ll[0].toFixed(6)},${r.ll[1].toFixed(6)},17`;
  }
  const LIST_NOTE = "매물 가격이 계산기 기준 매수가보다 높으면 입주까지 현금도 늘어나요. 입주권 여부는 조합·중개사무소에서 꼭 확인하세요.";
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
      lab = tot ? "입주까지 현금" : "지금 필요한 돈";
    if (need == null)
      return `<p class="cstrip na"><span>${lab}</span><b>–</b><small>${x.price == null ? noPriceTxt(r) : ZF.noCalcTxt(r, x) + " · 입주까지는 계산 보류"}</small></p>`;
    const estN = isEst(r) ? `<span class="zb est">구 평균 시세로 추정${P.est ? "" : " · 곳 수 제외"}</span>` : "";
    const left = CASH - need;
    return `<p class="cstrip ${left >= 0 ? "ok" : "short"}"><span>${lab}${estN}</span><b>${ZF.cash(need)}</b><small>${left >= 0 ? `내 돈 ${ZF.cash(CASH)} 중 ${ZF.left(CASH, need) ? ZF.cash(ZF.left(CASH, need)) + " 남음" : "남는 돈 없음"}` : `내 돈 ${ZF.cash(CASH)}보다 ${ZF.gap(need, CASH)} 더 필요`}</small></p>`;
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
  // scoreAll() → boot()의 scoreChunked()
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
    // 22차: 저장된 배치(LAYOUT)가 이 구역 목록보다 먼저 만들어졌으면 새 구역은 제자리(xy)에 — 없는 자리를 읽어 지도 그리기가 멈추던 오류(#o348 등)
    const items = all.map((r) => ({ r, a: dotState(r), p: lay.get(r.id) || r.xy })).sort((a, b) => ORD[a.a] - ORD[b.a]);
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
  /*Y*/
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
      y: P.fund === "gap" ? `전세 끼고 지금 ${ZF.cash(CASH)}으로 가능` : `내 돈으로 ${b === "total" ? "입주" : "지금 매수"} 가능`,
      n: "현금 부족",
      e: "구 평균 시세로 추정 (곳 수 제외)",
      u: "거래 적어 계산 보류",
      x: "계산 제외",
    };
    const why = (r) => {
      if (r.src === "moa") return "관리지역 · 블록별 계산";
      const w = buyWindow(r);
      if (w.cls === "no") return "지금 사면 입주권 없음";
      if (w.cls === "chk") return w.t;
      if (P.fund === "gap") {
        const g = gapOf(r);
        if (g.block) return g.block.split(" · ")[0];
      }
      return noPriceTxt(r);
    };
    const row = (r, k) => {
      const nd = k === "u" || k === "x" ? null : needOf(r);
      return `<li><button type="button" class="gz-row" data-zid="${r.id}"><span class="gz-n">${esc(shortName(r.n))}<small>${esc([dongOf(r), SHAPE[shapeOf(r)], r.src === "moa" ? "관리계획" : stageName(r)].filter(Boolean).join(" · "))}</small></span><span class="gz-v ${k}">${k === "u" || k === "x" ? esc(why(r)) : nd == null ? "–" : k === "n" ? `${ZF.gap(nd, CASH)} 부족` : `${lab} ${ZF.cash(nd)}`}</span></button></li>`;
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
    if (document.documentElement.classList.contains("s-rep") && !MQ_SHEET.matches) return;   // PC 상세가 열려 있으면 Esc는 상세만 닫는다(구 화면 그대로 · 60_simple)
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
      lab = b === "total" ? "입주까지 현금" : "지금 필요한 돈";
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
                ? `${lab} ${ZF.cash(need)}`
                : `현금 ${ZF.gap(need, CASH)} 부족 (${b === "total" ? "입주까지" : "지금 매수"} ${ZF.cash(need)})`;
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
          ? `전세 끼고 ${ZF.cash(CASH)}으로 지금 계약`
          : md === "now"
            ? `내 돈 ${ZF.cash(CASH)}으로 지금 매수`
            : `내 돈 ${ZF.cash(CASH)}으로 ${P.basis === "total" ? "입주까지" : "지금 매수"}`;
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
      const sw = `<button type="button" class="mswitch" data-maff aria-pressed="${mapAff}"><span class="sw" aria-hidden="true"></span>내 돈</button>`;
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
                ? `색이 ${dk} 전세 끼고 ${ZF.cash(CASH)}으로 갈 수 있는 구역이 많은 구`
                : md === "now"
                  ? `색이 ${dk} 내 돈 ${ZF.cash(CASH)}으로 지금 매수 가능한 구역이 많은 구 (입주까지는 부족)`
                  : `색이 ${dk} 내 돈 ${ZF.cash(CASH)}으로 ${P.basis === "total" ? "입주" : "지금 매수"} 가능한 구역이 많은 구`;
        const shortS = `색이 ${dk} ${md === "prog" ? "진행 중 구역" : P.fund === "gap" ? `전세 끼고 ${ZF.cash(CASH)} 가능 구역` : md === "now" || P.basis !== "total" ? `${ZF.cash(CASH)} 지금 매수 가능 구역` : `${ZF.cash(CASH)} 입주 가능 구역`} 많음`;
        el.innerHTML = `<div class="ml-h"><b><span class="ml-lf">${sent}</span><span class="ml-ls">${shortS}</span></b><span class="ml-sw">${stnChip}${stkChip}${sw}</span></div>${note ? `<p class="ml-mode">${esc(note)}</p>` : ""}${
          md !== "prog"
            ? (() => {
                const n = R.filter((r) => r.xy && !isDone(r) && dotState(r) === "y").length;
                return `<p class="ml-glow"><i class="gd" aria-hidden="true"></i>반짝이는 점 = ${P.fund === "gap" ? "전세 끼고 지금 계약할 수 있는 구역" : P.basis === "total" ? "내 돈으로 입주까지 되는 구역" : "내 돈으로 지금 갈 수 있는 구역"} <b>${fmt(n)}곳</b>${n ? " · 구를 누르면 하나씩 볼 수 있어요" : " · 금액을 바꿔 보세요"}</p>`;
              })()
            : ""
        }<div class="ml-scale" role="img" aria-label="색 범례: 회색 0곳, 옅은 파랑 1곳부터 진한 파랑 ${SMAX}곳 이상까지"><span class="ml-zero"><i></i>0</span><div class="ml-bar"><div class="ml-grad"></div><span class="ml-cur" id="mlCur" hidden></span><div class="ml-ticks">${ticks.map((v) => `<span style="left:${(tOf(v) * 100).toFixed(1)}%">${v}</span>`).join("")}</div></div><span class="ml-unit">곳</span></div>${showStn ? `<p class="ml-stk" id="mlStk">${HUB_KEY}</p>` : ""}`;
      } else {
        const c = { y: 0, n: 0, u: 0, e: 0, x: 0 };
        VIS.forEach((id) => {
          c[dotState(byId[id])]++;
        });
        const lab =
          P.fund === "gap" ? `지금 ${ZF.cash(CASH)}으로 전세 끼고 매수 가능` : effBasis() === "total" ? "입주 가능" : "지금 매수 가능";
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
                lv.textContent = `내 돈 기준 ${mapAff ? "켜짐" : "꺼짐"} · ${
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
  const probTxt = (v) => (v == null ? "–" : v < 0.01 ? "1% 미만" : prob(v) + "%");   // 0%로 보이지 않게(아주 작으면 '1% 미만')
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
    const t = ZF.yrsSince(d);   // 사이클 2: 경과 연수 한 곳(ZF.yrsSince · /z zsample.yrs_since와 같은 셈)
    return t != null && t >= 8 ? Math.floor(t) : 0;
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
    return hasEta(pr) ? probTxt(pr.p10) : pr.done ? "완료" : "–";
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
      // 4라운드(설치 앱): 리포트의 '내 돈으로 계산'(?from=report#oID)은 같은 문서에 홈 칸을 끼우지 않는다 → 뒤로 = 리포트 · × = 홈(칸은 그대로 바꿔 씀)
      const fromRep = opts.deep && document.documentElement.classList.contains("is-tapp") && /[?&]from=report(&|$)/.test(window.ZP_Q0 || location.search);   // ZP_Q0 = 첫 주소(머리 스크립트) — ?from=은 boot 도중 지워진다
      if (fromRep) replSt({ sheet: cur.id, rootR: 1 }, cur.id);
      // 5라운드: 시트가 열린 채 새로고침·앱 복원(기록 칸에 이미 시트 표시가 있음)이면 그 칸을 바꿔 쓴다 — 매번 홈 칸 + 시트 칸을 새로 쌓아 뒤로를 헛누르던 것(웹도)
      else if (opts.deep && history.state && history.state.sheet) replSt(Object.assign({}, history.state, { sheet: cur.id }), cur.id);
      else if (opts.deep) {
        replSt(null, "");
        pushSt({ sheet: cur.id }, cur.id);
      } else if (!opts.noHistory) {
        if (opts.replace) replSt({ sheet: cur.id }, cur.id);
        else pushSt({ sheet: cur.id }, cur.id);
      }
    } else if (!opts.noHistory) {
      // 설치 앱(html.is-tapp): 시트 안에서 다른 구역(모아타운 → 안의 사업구역 등)을 열면 기록 한 칸 더 → 뒤로 = 처음 시트 · 웹은 예전처럼 바꿔 쓰기
      const hs = history.state || {};
      if (document.documentElement.classList.contains("is-tapp") && hs.sheet && hs.sheet !== cur.id) pushSt({ sheet: cur.id }, cur.id);
      else replSt({ sheet: cur.id }, cur.id);
    }
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
    if (history.state && history.state.sheet && history.state.rootR) { replSt(null, ""); closeSheetNow(); }
    else if (history.state && history.state.sheet) history.back();
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
    // PC: 구 화면에서 연 상세에서 뒤로 → 상세를 닫고 그 구 화면(같은 목록) 그대로
    if (!MQ_SHEET.matches && st.gu && !st.det && document.documentElement.classList.contains("s-rep")) {
      document.documentElement.classList.remove("s-rep");
      // 20차: 그 구 경계에 다시 맞추고(상세가 당겨 둔 줌 대신) 초점은 방금 연 목록 줄로
      const oid = cur && cur.id;
      setTimeout(() => {
        try { if (mapView === "gu") LMX.zoom(0); } catch (er) {}
        const a = oid && document.querySelector(`#sList a[data-id="${oid}"]`);
        if (a) { a.focus({ preventScroll: true }); try { a.scrollIntoView({ block: "nearest" }); } catch (er) {} }
      }, 80);
    }
    if (!MQ_SHEET.matches && st.det && byId[st.det] && (!cur || cur.id !== st.det)) { cur = byId[st.det]; try { renderReport(); } catch (er) {} document.documentElement.classList.add("s-rep"); }
    if (!st.search && $("hdr").classList.contains("searching")) closeSearchNow();
    // 설치 앱: 하위 시트에서 뒤로 → 시트는 열린 채 처음 구역으로 다시 그림
    if (st.sheet && byId[st.sheet] && MQ_SHEET.matches && $("report").classList.contains("sheet") && cur && cur.id !== st.sheet && document.documentElement.classList.contains("is-tapp")) {
      cur = byId[st.sheet];
      renderReport();
      $("report").scrollTop = 0;
    }
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
    el.innerHTML = `<button type="button" class="mp-x" id="mpX" aria-label="요약 닫기">${ICON.close}</button><b class="mp-n">${esc(shortName(cur.n))}</b><small>${esc(z.l2)}</small><p class="mp-3 ${z.a}">${esc(z.l3)}</p>${z.l4 ? `<p class="mp-4">${esc(z.l4)}</p>` : ""}${z.hj ? `<p class="mp-4">주변 호재 ${z.hj}건 · 상세 '입지' 탭</p>` : ""}<div class="mp-acts">${listBtn(cur, "primary sm")}${favBtn(cur, "sm")}</div>`;
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
      // PC 구 화면(#map-구)에서 연 상세는 기록 한 칸 더(뒤로·Esc = 그 구 화면·같은 목록으로) · 이미 상세면 그 칸을 바꾼다
      const hs = history.state || {};
      if (hs.gu && mapView === "gu" && !hs.det && !popNav) pushSt({ gu: hs.gu, det: id }, id);
      else replSt(hs.gu ? (hs.det ? { gu: hs.gu, det: id } : { gu: hs.gu }) : null, id);
      if (fromCard || opts.scroll) {
        const el = $("report"), tl = $("sToList"), tlh = tl && tl.offsetParent ? tl.offsetHeight + 10 : 0;   // PC 2칸: '← 목록' 단추까지 머리 아래에 보이게
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - HDR() - 16 - tlh, behavior: smooth() });
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
  // 상세 섹션 탭 5개(돈 · 일정 · 거래 · 입지 · 규제) — 예전 '호재' 탭 내용은 '입지' 탭 아래에 이어 붙인다(src/ext/76_detail.js)
  const TABS = [
    ["money", "돈"],
    ["biz", "일정"],
    ["tx", "거래"],
    ["loc", "입지"],
    ["req", "규제"],
  ];
  const TABF = { money: "돈 · 지금 필요한 돈과 입주까지 현금", tx: "거래 · 실거래", loc: "입지 · 역·생활·호재", near: "입지 · 호재·주변 시세", biz: "일정 · 진행 단계", req: "규제 · 사기 전 확인" };
  function renderReport() {
    keepFocus(() => {
      const r = cur;
      if (!r) return;
      const rp = $("report"),
        keepTop = rp.classList.contains("sheet") ? rp.scrollTop : null;
      const parent = r.parent ? byId[r.parent] : null;
      const w = !isDone(r) && !r.dn && !r.cx ? buyWindow(r) : null;
      const main = [
        w ? `<span class="bw ${w.cls}" title="${esc(w.d)}"><i></i>${esc(w.cls === "no" ? "지금 사면 입주권 없음" : w.t)}</span>` : "",
        stagePill(r),
        r.cx ? '<span class="pill risk">대상지 취소</span>' : "",
        isDone(r) ? '<span class="pill">사업 완료 · 일반 매매</span>' : "",
        isPublic(r) ? '<span class="pill">공공재개발(LH·SH 참여)</span>' : "",
        r.trust ? '<span class="pill">신탁 방식</span>' : "",
      ].filter(Boolean);
      const extra = (r.pg || []).map((p) => `<span class="pill">${esc(p)}</span>`);
      const open = zoneOpen(r.id);
      rp.classList.toggle("rep-locked", !open);
      rp.innerHTML = `<div class="sheet-bar"><b aria-hidden="true">${esc(shortName(r.n))}</b><button type="button" class="btn ghost sm" id="sheetClose" aria-label="구역 리포트 닫기">${ICON.close}닫기</button></div>\n    ${backTo && MQ_SHEET.matches ? `<button type="button" class="back" id="backList">← 목록으로</button>` : ""}\n    <div class="rep-head">\n      <div class="rep-t"><div class="rep-tn"><h2 id="repTitle" tabindex="-1">${esc(shortName(r.n)).replace(/(\d)-(?=\d)/g, "$1\u2011")}</h2>${shortName(r.n) !== r.n ? `<div class="formal">${esc(r.n)}</div>` : ""}</div>${gradeBadge(r)}</div>\n      <div class="where" title="역까지 직선거리 기준 · 도보 분은 직선×1.3, 분당 67m 추정"><b>${esc(r.g)} ${esc(r.bj || r.j)}</b> · ${esc(r.k)}${r.st ? ` · ${esc(whereText(r))}` : ""}</div>\n      ${parent ? `<div class="where">소속 모아타운: <a href="#${parent.id}" data-go="${parent.id}">${esc(parent.n)}</a></div>` : ""}\n      <div class="kind">${main.join("")}${extra.length ? `<span class="kx" id="kindX" hidden>${extra.join("")}</span><button type="button" class="pill more-p" id="kindMore" aria-expanded="false" aria-controls="kindX" title="사업 방식 태그 더 보기">사업 방식 ${extra.length}개 더 보기</button>` : ""}</div>\n      ${cashStrip(r)}\n      ${open ? hjSummary(r) : ""}\n      <div class="rep-acts">${listBtn(r, "primary sm")}${favBtn(r, "sm")}<button type="button" class="btn secondary sm" id="zoneShare">공유</button><span class="share-fb" id="zoneShareFb" role="status"></span></div>\n    </div>\n    ${open ? `<div class="tabs" role="tablist" aria-label="구역 리포트">\n      ${TABS.map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" data-tab="${k}" aria-label="${TABF[k] || l}" aria-selected="${curTab === k}" aria-controls="pane" tabindex="${curTab === k ? 0 : -1}">${l}</button>`).join("")}\n    </div>\n    <div class="tabpane" id="pane" role="tabpanel" aria-labelledby="tab-${curTab}" tabindex="0"></div>` : `<div class="rep-gate">${reportGate(r)}</div>`}\n    <div class="sheet-foot"><button type="button" class="btn secondary" id="sheetClose2">닫고 목록으로</button></div>`;
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
      $("zoneShare").onclick = () => shareLink(r.src !== "moa" && !(r.s >= 9 || (r.dn && r.s < 7)) && /^[\w-]+$/.test(r.id) ? `https://jaegaebal.alwaysquestions.kr/z/${r.id}` : pageURL() + condQuery() + "#" + r.id, $("zoneShareFb"), `${shortName(r.n)} · ${BRAND}`);
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
  /*Y*/
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
    // 26차: 좌표가 없는 구역은 '호재 없음'처럼 비어 보이는 칸 대신 이유 한 줄(지어내지 않음)
    if (!r.ll && !hs.length) { p.innerHTML = `<div class="sect"><p class="hj-none">이 구역은 위치 좌표가 아직 없어 가까운 역·학교·호재를 계산하지 못했어요. 주소(${esc(r.j || r.g)})로 지도 앱에서 확인해 주세요.</p></div>`; return; }
    p.innerHTML = `\n    <div class="sect"><h3>주변 호재 <small>구역 대표 좌표에서 약 1.5km 안 · 직선거리 · ${HJD.asOf.replaceAll("-", ".")} 기준</small></h3>\n      ${hs.length ? `<ul class="hjl">${rows}</ul>` : `<p class="hj-none">1.5km 안 정리된 호재 없음 <span>(GTX·새 철도·대형 복합개발 ${HJD.items.length}건 중)</span></p>`}\n      <p class="hj-warn">계획은 변경·지연될 수 있어요. 공식 발표로 확인하세요.</p></div>\n    <div class="sect"><h3>매물 보기</h3>\n      ${ns ? `<p class="hj-st">${esc(nearTxt(r))}${ns.s && ns.s.ls.length ? ` · ${esc(stnLines(ns.s))}` : ""}</p>` : ""}\n      ${listBtn(r, "primary") || '<p class="note">대표 좌표가 없어 지도 매물 링크를 만들 수 없어요.</p>'}\n      ${listingURL(r) ? `<p class="list-note">${noTicket(r) ? "" : LIST_NOTE + " "}${aptZone(r) && KBC[r.id] ? "KB부동산 단지 화면이 새 창으로 열려요(매매·전세 매물)." : "KB부동산 지도가 구역 대표 좌표를 가운데에 두고 새 창으로 열려요(매물·시세)."}</p>` : ""}</div>\n    <div class="chk3"><h3>매물 볼 때 체크할 3가지</h3><ol>${CHK3.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join("")}</ol><p class="note">구역별 판정은 '규제' 탭에서 볼 수 있어요.</p></div>\n    ${leadCard("in-rep")}`;
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
  // renew-feat: 새 기능(단계 타임라인·사업 정보 카드·근처 구역 추천·가격 흐름·매수 전 진단)은 따로 된 묶음(/b/f.*.js)을 처음 쓸 때 받는다
  // 기능 묶음은 앱 닫힘 범위 밖이라 쓰는 값·함수를 아래 ctx로만 건넨다(숫자는 시트·/z와 같은 함수: DTL.nums · ZX.pace · ZX.rights)
  let FEAT_P = null;
  const featLoad = () => FEAT_P || (FEAT_P = new Promise((res, rej) => {
    if (window.ZPF && window.ZPF.v) return res(window.ZPF);
    const s = document.createElement("script"); s.src = "__FEAT__"; s.async = true;
    s.onload = () => (window.ZPF && window.ZPF.v ? res(window.ZPF) : rej(new Error("feat")));
    s.onerror = () => { FEAT_P = null; rej(new Error("feat load")); };
    document.head.appendChild(s);
  }));
  const featCtx = () => ({
    D, R, byId, ZF, esc, fmt, stageName, shortName, isDone, probTxt, projection,
    nums: (r) => DTL.nums(r), pace: (r) => ZX.pace(r), rights: (r) => ZX.rights(r), tx: () => ZX.loadTx(), shape: (r) => shapeOf(r), SHAPE,
    cash: () => CASH, gap: () => gapMode(), tapp: () => document.documentElement.classList.contains("is-tapp"),
    open: (id) => { curTab = "money"; select(id, true, false, { scroll: true }); },
    brand: BRAND, etaShow: (r) => etaShow(r), yrsSince: (d) => ZF.yrsSince(d), dur: (y) => ZF.dur(y), stall: (r) => stallYrs(r), shown: (r) => DTL.shown(r), win: (r) => buyWindow(r), b18: (r) => b18Of(r), calc: (r) => { try { const x = investC(r); return x ? { ok: !!x.ok, appr: x.appr, ratio: x.ratio, unitPrice: x.unitPrice, unitArea: x.unitArea, contrib: x.contrib, apprWhy: x.apprWhy } : null; } catch (e) { return null; } },
    stageDate: (r) => curStageDate(r), condURL: () => location.href.split(/[?#]/)[0] + condQuery(), condQ: () => condQuery(), share: (url, fb, t) => shareLink(url, fb, t), ZL: typeof ZL !== "undefined" ? ZL : null, spark: (id) => { try { return SIMPLE.spark(id); } catch (e) { return ""; } }, gapMode: () => gapMode(), evOf: (id) => { try { return typeof INBOX !== "undefined" ? INBOX.evOf(id) : []; } catch (e) { return []; } }, inboxLoad: () => { try { return typeof INBOX !== "undefined" && INBOX.load ? INBOX.load() : Promise.resolve(); } catch (e) { return Promise.resolve(); } }, ntLoad: () => ntLoad(), geo: (id) => { try { const g = ZX.geoZ(); return g ? g[id] : null; } catch (e) { return null; } }, news: (id) => { try { if (typeof INBOX === "undefined") return ""; const e = INBOX.evOf(id)[0]; return e ? `${INBOX.dLabel(e.date).replace(/ \(.\)$/, "")} ${INBOX.TY[e.type][0]}` : ""; } catch (e) { return ""; } }, pcl: (id) => ZX.loadPcl(id), rules: () => { const el = $("rules"); if (el && !el.innerHTML.trim()) drawRules(); }, cur: () => cur, tab: () => curTab, areaBad: (r) => areaSuspect(r), ok: (r) => !!(window.ZP_ok && window.ZP_ok(r)),
  });
  const featHook = (tab, r) => {
    if (!["biz", "tx", "loc"].includes(tab) || !r || r.src === "moa") return;
    featLoad().then((F) => { if (cur === r && curTab === tab && $("pane")) F.pane(tab, r, $("pane"), featCtx()); }).catch(() => {});
  };
  // 사이클 2: 두 번째 지연 묶음(/b/g.*.js · src/featx) — 구역 비교(F6)·내 시나리오(F7)·필지 연식 지도(F8). 처음 누를 때만 받는다
  let FX_P = null;
  const featxLoad = () => FX_P || (FX_P = new Promise((res, rej) => {
    if (window.ZPX && window.ZPX.v) return res(window.ZPX);
    const s = document.createElement("script"); s.src = "__FEATX__"; s.async = true;
    s.onload = () => (window.ZPX && window.ZPX.v ? res(window.ZPX) : rej(new Error("featx")));
    s.onerror = () => { FX_P = null; rej(new Error("featx load")); };
    document.head.appendChild(s);
  }));
  window.ZP_feat = { load: featLoad, ctx: featCtx, hook: featHook, loadX: featxLoad };
  function renderPane() {
    if (!$("pane")) return;
    if (PREM_TABS.has(curTab) && !cur._prem) {
      premPane(cur);
      return;
    }
    ({ loc: paneLoc, biz: paneBiz, money: paneMoney, req: paneReq, near: paneNear, tx: paneTx })[curTab](cur);
    if (curTab === "biz" || curTab === "loc") featHook(curTab, cur);
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
    p.innerHTML = `\n    <div class="locbox">\n      <div class="lb-top"><div class="lb-v"><b>${r.score}</b><span>/100 입지 점수</span></div><p class="lb-pos">${posTxt(Math.round(((scored.length - Math.max(1, rankAll)) / scored.length) * 100))} <small>위치 확인된 진행 중 ${fmt(scored.length)}곳 중 약 ${fmt(Math.max(1, rankAll))}위 · ${esc(r.g)} ${rankGu ? `${rankGu}위/${sameGu.length}곳` : ""}</small></p></div>\n      ${ptsBar(r, "pb-lg")}\n      <div class="lb-key">${locKeyHTML()}</div>\n      <table class="lb-t"><caption class="sr-only">입지 점수 항목별 점수</caption><thead><tr><th scope="col">항목</th><th scope="col" class="n">가중치</th><th scope="col" class="n">항목 점수</th><th scope="col" class="n">얻은 점수</th></tr></thead><tbody>\n        ${LOC_AX.map((a, i) => `<tr><th scope="row"><i class="${LOC_G[a.g]}"></i>${a.k}<small>${esc(a.why)}</small></th><td class="n">${Math.round(a.w * 100)}</td><td class="n">${r.ax[i] == null ? "–" : r.ax[i]}</td><td class="n"><b>${r.pts[i].toFixed(1)}</b></td></tr>`).join("")}\n      </tbody></table>\n      <p class="sc-why">가중치와 거리별 점수는 작성자 가정값이에요. 교통·일자리·생활 편의를 거리로만 본 값이라 학군 수준·병원 진료과·상권 질은 반영하지 않아요. 투자 등급이 아니에요.${r.comp != null && !r.dn ? ` 입지·진척 점수 ${r.comp} = 입지 ${r.compAx[0]}×50% + 사업 진척 ${r.compAx[1]}×30% + 추진력 ${r.compAx[2]}×20%.` : ""}</p>\n    </div>\n    <div class="sect infra"><h3>생활 인프라 <small>가장 가까운 곳 · 직선거리 기준 · 도보는 직선×1.3, 분당 67m 추정</small></h3>\n      ${inf ? `<ul class="iflist">${irow("e", "초등학교")}${irow("m", "중학교")}${irow("h", "고등학교")}${irow("hp", "대형병원")}${irow("mt", "대형마트")}</ul>\n      <p class="note">학교: OpenStreetMap 학교 이름 기준(배정 학교와 다를 수 있음) · 대형병원: 보건복지부 제5기 상급종합병원 서울 14곳 + OSM 병원 중 이름 규칙으로 고른 종합병원급(추정) · 대형마트: 이마트·홈플러스·롯데마트·코스트코·트레이더스 대형 매장(영업 여부: 서울시 대규모점포 인허가 정보 · 공공누리 제1유형) · ${INF.asOf.replaceAll("-", ".")} 기준 · © OpenStreetMap contributors (ODbL)</p>` : '<p class="note">대표 좌표가 없어 생활 인프라 거리를 계산하지 못했어요.</p>'}</div>\n    <dl class="facts">\n      <div><dt>가장 가까운 역</dt><dd>${(() => {
      const x = stnInfo(r);
      return x ? `${esc(x.n)}역 ${fmt(x.d)}m<small>도보 약 ${x.min}분 · 직선거리 기준</small>` : "–";
    })()}</dd></div>\n      <div><dt>한강 중심선까지</dt><dd>${(r.h / 1e3).toFixed(2)}km</dd></div>\n      <div><dt>주변 호재 (1.5km)</dt><dd>${nearHojae(r).length}건<small>아래 '주변 호재'에서 목록</small></dd></div>\n      ${r.jg ? `<div><dt>주변 150m 대지 공시지가 가운데 값</dt><dd>㎡당 ${fmt(r.jg / 1e4)}만<small>3.3㎡당 약 ${fmt((r.jg * 3.3058) / 1e4)}만 · 진행 중 사업장 중 ${posTxt(jgPct(r.jg))}</small></dd></div>` : ""}\n    </dl>\n    <div class="sect"><h3>주변 역 <small>반경 1km 노선 ${r.ln.length ? r.ln.map(esc).join(", ") : "없음"}</small></h3>\n      <ul class="list">${r.s3.map(([n, d, l]) => `<li><span>${esc(n)} <small>${l.map(esc).join("·")}</small></span><span class="mono">${fmt(d)}m</span></li>`).join("")}</ul></div>\n    <div class="sect"><h3>업무지구까지 직선거리</h3>\n      <ul class="list">${Object.entries(
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
      consentHtml = `<div class="sect"><h3>${isUnion ? "조합설립 동의율" : "추진위원회 동의율"} <small>정비사업 정보몽땅 추진경과 · ${esc(c.d)}</small></h3>\n      <div class="meter"><i style="width:${Math.min(100, c.v)}%"></i><div class="th" style="left:${th}%"><span>법정 기준 ${th}%</span></div></div>\n      <div class="meter-v"><b>${String(+c.v.toFixed(2))}%</b><span>${c.first != null && c.first !== c.v ? `최초 인가 때 ${c.first}%` : ""}</span></div></div>`;
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
      // 20차 G9: 예상 입주 값은 위 큰 칸에 한 번 — 여기서는 범위만(값이 '15년 넘게'면 줄 자체를 빼서 같은 말을 두 번 하지 않게)
      hasEta(pr) && !pr.past && !/15년 넘게/.test(String(etaSpan(r, pr)))
        ? `<li class="eta"><span class="d" aria-hidden="true">◷</span><div><b>예상 준공·입주 범위</b><p>준공되는 경우의 가운데 값 · 빠르면 ${pr.eLo < ETA_NOW ? "곧" : ym(pr.eLo)}, 늦으면 ${(pr.eHi - ETA_NOW) / (365.25 * 864e5) > 15 ? "15년 넘게" : ym(pr.eHi)}</p></div></li>`
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
    p.innerHTML = `\n    <div class="bigrow">\n      <div class="big"><span>예상 입주 <em class="lbl">준공되는 경우의 가운데 값</em></span><b${/\d/.test(big1[0]) ? "" : ' class="t"'}>${big1[0]}</b><small>${big1[1]}</small></div>\n      <div class="big"><span>${pr.done ? "준공" : "10년 안 준공 가능성"}</span><b${pShow && pr.p10 != null && pr.p10 >= 0.01 ? "" : ' class="t"'}>${pShow ? probTxt(pr.p10) : pr.done ? "준공 완료" : pr.moa ? "사업구역별" : pr.stale || pr.past ? "확인 필요" : "자료 부족"}</b><small>${pShow ? (pr.noDate ? "현재 단계 날짜 없음 · 추정" : "서울 사업장 생존분석(KM·몬테카를로 4,000회)") : p10Why(r)}</small></div>\n      <div class="big"><span>현재 단계</span><b class="t">${esc(stageName(r))}</b><small>${curStageDate(r) ? esc(curStageDate(r)) + (r.chk ? " · 확인 필요(인가일이 아닐 수 있음)" : " · 공식 인가·고시일") : r.chk ? "단계 정보 확인 중" : ""}</small></div>\n    </div>\n    ${pr.adj ? `<p class="note"><b>가로·소규모 보정</b> 가로주택·소규모 표본이 적어 조합설립→사업시행 외 구간은 대규모 재개발·재건축 기간을 빌려 씁니다. 사업시행계획인가에 관리처분이 포함되므로 '사업시행→관리처분' 대기(${DUP.toFixed(1)}년)는 빼고 근사 보정했어요.</p>` : pr.grp === "small" && pShow ? `<p class="note"><b>가로·소규모</b> 표본이 적어 조합설립→사업시행 외 구간은 대규모 재개발·재건축 기간을 빌려 씁니다.</p>` : ""}\n    ${r.chk ? `<p class="note warnbox"><b>단계 정보 확인 중</b> ${esc(chkText(r))} 조합·구청 공고로 확인하세요.</p>` : ""}\n    ${r.cx ? `<p class="note riskbox"><b>대상지 취소</b> ${esc(r.cx)} 서울시가 모아타운 대상지에서 취소했습니다.</p>` : ""}\n    ${(r.news || []).length ? `<div class="sect"><h3>최근 확인된 소식 <small>공식 목록보다 최신</small></h3>${r.news.map((n) => `<p class="note">${n.d ? `<b>${esc(n.d.replaceAll("-", "."))}</b> ` : ""}${esc(n.t)} <a href="${esc(n.src)}" target="_blank" rel="noopener">출처</a></p>`).join("")}</div>` : ""}\n    ${r.sin ? `<p class="note"><b>신속통합기획 현황</b> ${esc(r.sin.stage && r.sin.stage !== "-" ? r.sin.stage : "진행 중")}${r.sin.designated && r.sin.designated !== "-" ? ` · 구역지정 ${esc(r.sin.designated)}` : ""}${r.sin.note && r.sin.note.trim() !== "-" ? ` · ${esc(r.sin.note)}` : ""} <span class="dim">(서울시 ${esc(r.sin.asOf)} 기준)</span></p>` : ""}\n    ${pr.moa ? `<p class="note"><b>일정</b> 모아타운 관리지역은 사업구역(블록)별로 따로 진행돼 관리지역 전체의 입주 시점은 계산하지 않아요.${kidDist ? ` 소속 조합 진행: ${kidDist}. 입주 시점은 아래 소속 조합 리포트에서 확인하세요.` : " 아직 정보몽땅에 등록된 개별 조합이 없어 입주 시점을 알 수 없어요."}</p>` : ""}\n    ${pr.pre ? `<p class="note"><b>일정</b> 구역지정 전이라 입주 시점과 준공 확률은 계산하지 않아요. 구역지정 시점은 서울시·구청 고시로 확인하세요.</p>` : ""}\n    ${pr.nodata ? `<p class="note"><b>일정 자료 부족</b> 현재 단계의 인가일 등 일정 자료가 모자라 준공 확률과 입주 시점을 산정하지 못했어요.</p>` : ""}\n    ${consentHtml}\n    <dl class="facts">\n      ${fact("구역 면적", sm.area ? (areaBad ? "확인 중" : fmt(sm.area) + "㎡") : null, sm.area ? (areaBad ? `원자료 ${fmt(sm.area)}㎡는 계획 세대수(${fmt(units)}세대)에 비해 너무 작아 필지 하나의 면적일 수 있어요` : `약 ${fmt(sm.area / 3.3058)}평`) : "", "자료 없음")}\n      ${fact("계획 세대수", units ? fmt(units) + "세대" : null, sm.rental ? `임대 ${fmt(sm.rental)} 포함` : "", naReason("units", r))}\n      ${fact(r.k === "재건축" || r.k === "소규모재건축" ? "조합원 수" : "토지등소유자", owners ? fmt(owners) + "명" : null, sm.members && sm.owners && sm.members !== sm.owners ? `조합원 ${fmt(sm.members)}명` : "", naReason("owners", r))}\n      ${fact("일반분양 비율(추정)", saleRatio != null ? (saleRatio * 100).toFixed(0) + "%" : null, saleRatio != null ? "(세대−소유자−임대)÷세대" : "", "계산 불가 (세대·소유자 자료 부족)")}\n      ${fact("계획 용적률", sm.far ? sm.far + "%" : null, sm.zoning || "", naReason("far", r))}\n      ${fact("시공자", r.b || null, r.b ? "정보몽땅 추진경과·기사 대조 · 늦게 반영될 수 있음" : "", naReason("builder", r))}\n    </dl>\n    ${kids.length ? `<div class="sect"><h3>관리지역 안 개별 조합 <small>${kids.length}곳 · 누르면 이동</small></h3><div class="children">${kids.map((k) => `<button type="button" class="child" data-go="${k.id}"><span>${esc(k.n)}<small>${esc(stageName(k))}${k.cs && (k.cs["조합설립"] || k.cs["추진위"]) ? ` · 동의율 ${(k.cs["조합설립"] || k.cs["추진위"]).v.toFixed(1)}%` : ""}</small></span><span class="pill">${esc(k.k)}</span></button>`).join("")}</div></div>` : ""}\n    <div class="sect"><h3>추진 단계 <small>날짜는 공식 인가·고시일</small></h3>\n      <ol class="ladder">${L.map(
      (l, i) => {
        const st = i < ladderIdx ? "done" : i === ladderIdx ? "now" : "";
        const d = dates[i];
        const sk = skip.has(i) || (i === 3 && (r.skip || []).includes("추진위"));
        // 뒤 단계 날짜가 더 이르면 변경 지정·고시일. 단 구역지정보다 이른 추진위는 2009년 전 제도상 정상이라 보지 않는다
        const later = d && dates.slice(i + 1).some((x, j) => x && x < d && !(dMap[i] === "구역지정" && dMap[i + 1 + j] === "추진위"));
        return `<li class="${st}${sk ? " skip" : ""}"><span class="d">${sk ? "–" : i < ladderIdx ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : i}</span><div><b>${esc(l)}</b>${sk && i === 3 && (r.skip || []).includes("추진위") && !r.trust ? "<p>생략 (공공지원 조합직접설립)</p>" : ""}${later ? "<p>이 날짜는 변경 지정·고시일로 보여요 (최초 지정은 더 이름)</p>" : ""}</div><span class="t">${d ? d.replaceAll("-", ".") + ((r.dq || []).includes(dMap[i]) ? " ?" : "") + (later ? " (변경)" : "") : i === ladderIdx ? "현재" : ""}</span></li>`;
      },
    ).join(
      "",
    )}${pr.moa ? '<li><span class="d" aria-hidden="true">…</span><div><b>사업구역(블록)별 조합 진행</b><p>소속 조합 리포트에서 확인</p></div><span class="t"></span></li>' : ""}${etaRow}</ol></div>\n    ${r.rd ? `<p class="note"><b>권리산정기준일</b> ${esc(r.rd)} · 이날 이후 쪼갠 지분은 입주권이 안 나올 수 있습니다.</p>` : ""}\n    ${(() => {
      const bw = buyWindow(r);
      return bw.b18
        ? `<p class="note"><b>${bw.b18by === "app" ? "2018.1.24까지 사업시행인가 신청" : "2018.1.24 전 사업시행인가"}</b> ${esc(String(bw.b18).replace(/^(\d{4})-(\d{2})-(\d{2}).*/, (m, y, a, c) => `${y}.${+a}.${+c}`))} · 관리처분인가 뒤에도 지위양도 제한이 적용되지 않아요(도시정비법 부칙 제2조 · 신청일 기준 · 추정·확인 필요)</p>`
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
          : fmt(Math.round(x * 1e4)) + "만"
        : NF2.format(Math.round(x * 10) / 10) + "억";   // 19차: 억은 소수 한 자리(1.4억 · 앱 전체 같은 꼴)
  const NF2 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
  function taxDesc(x) {
    if (x.land0) return "멸실 후 토지 취득 4.6% (취득세 4% + 교육세·농특세)";
    if (P.homes === 2) return "조정지역 3주택 이상 중과 12% + 지방교육세 0.4%" + (x.big ? " + 농특세" : "");
    if (P.homes === 3) return "조정지역 2주택 중과 8% + 지방교육세 0.4%" + (x.big ? " + 농특세" : "");
    return `${(acqRate(x.price, false, false) * 100).toFixed(1)}% (1~3% + 지방교육세) · 매수 시 납부`;
  }
  function tiParts(x) {
    const rate = num("aRate") ?? 4.5;
    return [
      `원시취득세 ${won(x.origTax)} (${x.contrib >= x.unitPrice * 0.35 ? "분담금" : "조합원 분양가의 35%"} ${ZF.exact(Math.max(x.contrib, x.unitPrice * 0.35))} × ${x.unitArea > 85 ? "3.16" : "2.96"}% · 분담금과 분양가 35% 중 큰 값)`,
      x.loanNow
        ? `매수대출 이자 ${won(x.interest)} (${won(x.loanNow)} × ${rate}% × ${x.yrs ? NF1.format(x.yrs) + "년" : `${CONS_YRS}년(입주 시점 미정 · 보수 가정)`} 단리)`
        : x.loanCap > 0.005 ? "매수대출 이자 넣지 않음 (매수 대출은 입주 전 갚는다고 봄)" : "매수대출 없음",
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
      // 입주권이 안 나오는 이유는 첫 화면 셋째 칸('입주권')에서 한 번 — 여기서 '입주권 없음' 큰 칸·주황 상자로 다시 말하지 않는다(20차 G3)
      p.innerHTML = `<p class="note"><b>지금 사면 ${rb ? "매도청구 대상" : "현금청산 대상"}</b></p>\n      ${rb ? `<p class="note"><b>보상 방식</b> ${isSmall(r) ? "가로·소규모는 협의 → 매도청구(시가 기준, 소규모주택정비법 §35·36)로" : "재건축은 매도청구(시가 기준)로"} 보상액이 달라집니다 · 법률 검토 권장</p>` : x.price != null && x.appr != null ? `<p class="note"><b>현금청산 시 예상 손실</b> 약 ${won(x.price - x.appr + x.tax)} (매수가 ${won(x.price)} − 감정가 추정 ${won(x.appr)} + 취득세 ${won(x.tax)}) · 재개발 수용 보상 기준의 참고값</p>` : ""}\n      <p class="note">${rb ? "" : "현금청산은 감정평가액 기준 보상이라 매수가에 붙은 프리미엄은 돌려받지 못합니다. "}예외 매물(매도인이 10년 보유·5년 거주 1세대1주택 등)을 사는 경우에만 조합원 지위가 승계되며, 이때는 조합에 승계 가능 여부를 먼저 확인하십시오.</p>`;
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
    // 7차: 칸에는 계산에 쓴 값 그대로(만 원까지 · 1.93) — 올림한 '2'를 넣어 두면 손대지 않은 칸을 다시 넣기만 해도 결과가 바뀌던 것
    const eX = (v) => (v == null || !isFinite(v) ? "–" : String(+(Math.round(v * 1e4) / 1e4)));
    const f = (id, lab, sub, val, est, unit) => {
      const chg = val != null && val !== "";
      return `<div class="f${chg ? " chg" : ""}"><label for="${id}">${lab}${chg ? `<button type="button" class="rs" data-reset="${id}">초기화</button>` : est !== "" && est !== "–" ? '<span class="est">추정</span>' : ""}<small>${sub}</small></label><div class="inp"><input id="${id}" inputmode="decimal" value="${chg ? val : est === "–" ? "" : est}" data-est="${est}"><span>${unit}</span></div></div>`;
    };
    const ratioChg = Math.round(x.ratio * 100) !== 100;
    const cons = x.ok && x.annual == null;
    const gainCls = !x.ok ? "off" : cons ? "ref" : x.gain >= 0.05 ? "up" : x.gain <= -0.05 ? "dn" : "";
    const left = CASH - x.needTotal;
    // 입주 때 시세를 못 정해 입주까지 계산이 안 되면 빈 '–' 카드 셋 대신 이유 한 장 + 넣을 칸으로 바로 가기
    const noCalc = x.ok ? "" : `<div class="big cash nocalc"><span>입주까지 현금</span><b class="t">계산 보류</b><small>${x.nvThin ? "주변 신축 거래가 적어" : "주변 신축 실거래가 없어"} 입주 때 시세를 못 정했어요.${x.needBuy != null && isFinite(x.needBuy) ? ` 지금 사는 데는 대출 끼고 <b>${ZF.cash(x.needBuy)}</b>(매수가 ${ZF.cash(x.price)} · ${o.est ? "구 평균 추정" : x.priceSrc === "user" ? "직접 입력" : "추정"})` : ""}</small><span class="nc-a"><button type="button" class="btn secondary sm" data-nc="mNv">입주 때 시세 넣기</button><button type="button" class="btn text sm" data-nc="mPrice">매수가 넣기</button></span></div>`;
    p.innerHTML = `\n    ${noCalc}<div class="bigrow"${x.ok ? "" : " hidden"}>\n      <div class="big cash"><span>입주까지 현금</span><b>${x.ok ? ZF.cash(x.needTotal) + "" : "–"}</b><small>${x.ok ? (x.needTotal <= CASH ? `내 돈 ${ZF.cash(CASH)} · ${ZF.left(CASH, x.needTotal) ? ZF.cash(ZF.left(CASH, x.needTotal)) + " 남음" : "남는 돈 없음"}` : `내 돈 ${ZF.cash(CASH)} · ${ZF.gap(x.needTotal, CASH)} 부족`) : ""}</small></div>\n      <div class="big gain ${gainCls}"><span>입주 때 시세 차이</span><b>${x.ok ? sg(x.gain) : x.nvThin ? "표본 부족" : "–"}</b><small>${x.ok ? (x.gain <= 0 ? "손실 예상" : x.annual != null ? `연 ${pcIrr(x.annual)} (연 복리 수익률)${x.annual < DEP ? ' · <span class="lowp">예금 3.0% 미만</span>' : ""}${r.eta?.p10 != null && r.eta.p10 < 0.3 ? ` · <span class="lowp">10년 내 준공 ${probTxt(r.eta.p10)}</span>` : ""}` : `입주 시점 미정 · 참고값${x.loanNow ? ` (매수대출 이자 ${CONS_YRS}년 가정)` : ""}`) : x.nvThin ? "주변 신축 비교 거래가 부족해 차익을 계산하지 않아요" : ""}</small><small class="lbl2">추정 · 시세 상승 ${num("aGrowth") ? `연 ${num("aGrowth")}%` : "0%"} 가정${isMulti() ? " · " + MULTI_NOTE : ""}</small></div>\n      <div class="big"><span>${x.refund ? "환급 추정" : "추가 분담금"}</span><b>${x.ok ? won(Math.abs(x.contrib)) : "–"}</b><small>${x.ok ? `조합원 분양가 ${ZF.exact(x.unitPrice)} − 권리가액 ${ZF.exact((Math.round(x.unitPrice * 1e4) - Math.round(x.contrib * 1e4)) / 1e4)}${x.refund ? "" : ` = ${ZF.exact(x.contrib)}`}${won(Math.abs(x.contrib)) !== ZF.exact(Math.abs(x.contrib)) ? ` · 위 ${won(Math.abs(x.contrib))}은 0.1억 단위 반올림(입주까지 현금과 같은 규칙)` : ""}` : ""}</small></div>\n    </div>\n    ${x.ok ? `<div class="cash-brw">${cashBr(x).html}</div>` : ""}\n    ${x.ok ? `<details class="note flow"><summary><b>계산식</b></summary><p>${esc(flowLine(x))}</p></details>` : ""}\n    ${x.ok && r.s >= 5 && x.prem < x.right * 0.2 && x.priceSrc !== "user" ? `<p class="note warnbox"><b>매수가가 낮게 잡혔을 수 있음</b> 사업시행인가 이후인데 프리미엄 추정(${won(x.prem)})이 권리가액의 20% 미만이에요. 실제 매물가를 아래 '매수가'에 넣어 보세요.</p>` : ""}\n    ${o.appr != null && x.price != null && o.appr > x.price ? `<p class="note warnbox"><b>감정가가 매수가보다 높아요</b> 매수가(현재 시세)도 함께 바꿔야 결과가 과하게 좋게 나오지 않아요.</p>` : ""}\n    ${isEst(r) ? `<p class="note warnbox"><b>구 평균 시세로 추정</b> 주변 빌라 거래가 적어 매수가를 정할 수 없는 구역이라, 같은 구(${esc(r.g)}) 다른 구역 ${EST_N[r.g] || 0}곳의 주변 빌라 실거래 가운데 값 ${ZF.cash(o.price)}을 매수가로 넣었어요. 실제 매물가를 아래 '매수가'에 넣으면 그 값으로 계산해요.${P.est ? "" : " 기본 설정에서는 곳 수·목록에서 빠져 있어요(조건 더 보기 → 추정 구역 포함)."}</p>` : ""}\n    ${r.src === "moa" ? `<p class="note warnbox"><b>관리지역 평균값</b> 모아타운 관리지역 전체 기준의 참고값이에요. 실제 분담금·입주권은 사업구역(블록)별로 달라요.</p>` : ""}\n    <p class="note ${w.cls === "no" ? "riskbox" : ""}"><b>${esc(w.t)}</b> ${esc(w.d)}${lp ? ` · <b>${esc(lp.t)}</b> ${esc(lp.d)}` : ""}</p>\n    <div class="sect"><h3>숫자 바꿔 보기 <small>'추정'은 자동 계산값 · 바꾸면 목록 카드에도 반영</small></h3><div class="ff">\n      ${f("mPrice", "매수가", "프리미엄 포함 실제 매물가", o.price, eX(x.price), "억")}\n      ${f("mAppr", "종전자산 감정가", "관리처분 뒤에는 조합 공개값", o.appr, eX(x.appr), "억")}\n      ${f("mRatio", "비례율", "모든 구역 일괄 변경은 고급 가정에서", ratioChg ? Math.round(x.ratio * 100) : "", ratioChg ? "" : Math.round(x.ratio * 100), "%")}\n      ${f("mUnit", "조합원 분양가", `${P.unit}㎡ 기준`, o.unitPrice, x.ok ? eX(x.unitPrice) : "", "억")}\n      ${f("mNv", "입주 때 시세", x.ref ? `주변 신축 ${esc(x.ref.scope || "")} ${x.ref.n}건${x.ref.complexes ? " · " + x.ref.complexes.slice(0, 2).map(esc).join(", ") : ""}` : "주변 신축 실거래 기준", o.nv, x.ok ? eX(x.nv) : "", "억")}\n    </div></div>\n    ${x.ok ? `<dl class="facts">\n      <div><dt>권리가액</dt><dd>${ZF.exact(x.right)}<small>감정가 ${ZF.exact(x.appr)} × 비례율 ${Math.round(x.ratio * 100)}%</small></dd></div>\n      <div><dt>프리미엄 추정</dt><dd>${x.prem < 0 ? "−" + ZF.exact(-x.prem) : ZF.exact(x.prem)}<small>매수가 − 권리가액</small></dd></div>\n      <div><dt>취득세</dt><dd>${ZF.exact(x.tax)}<small>${taxDesc(x)} · '지금 필요한 돈'에 포함</small></dd></div>\n      <div class="fx-loan"><dt>매수 대출</dt><dd>${loanWhy(x)}</dd></div>\n      <div class="fx-ti"><dt>세금·이자 (입주까지)</dt><dd>${ZF.exact(flowParts(x).ti)}<small>${tiParts(x)}</small></dd></div>\n      <div class="fx-tot"><dt>입주까지 들어가는 돈 합계(잔금대출 빼기 전)</dt><dd>${totSum([["매수가", x.price], ["취득세", x.tax], [x.contrib < 0 ? "환급" : "분담금", x.contrib], ["세금·이자", flowParts(x).ti]])}</dd></div>\n      <div><dt>입주 잔금대출</dt><dd>${ZF.exact(x.loanEnd)}<small>신축 시세 기준 LTV ${Math.round(ltvEnd() * 100)}%·가격구간 한도${P.first ? " (생애최초 70%는 매수 대출에만)" : ""}${r.s >= 6 ? " · 2025.10.15 이전 관리처분인가 구역은 종전 규정 적용 가능(은행 확인)" : ""} · 현행 규제(2025.10.16~) 기준 · 입주 시점 규제에 따라 달라짐</small></dd></div>\n    </dl>\n    <div class="sect"><h3>비례율에 따른 결과 <small>현금 매수 기준 · 나머지 조건 고정</small></h3><table class="sens"><caption class="sr-only">비례율별 입주 때 시세 차이와 분담금</caption><thead><tr><th scope="col">비례율</th><th scope="col">입주 때 시세 차이</th><th scope="col">분담금</th></tr></thead><tbody id="mSens"></tbody></table></div>` : ""}\n    <p class="note">감정가 추정: ${esc(x.apprWhy || "")}. ${r.k === "재건축" ? "재건축초과이익환수 부담금은 미반영. " : ""}실제 감정가·비례율·조합원 분양가는 관리처분계획에서 확정됩니다.</p>\n    <p class="note"><b>포함하지 않은 비용</b> ${MISSING_COSTS}</p>`;
    p.querySelectorAll("[data-nc]").forEach((b) => b.addEventListener("click", () => { const i = $(b.dataset.nc); if (!i) return; i.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => { try { i.focus({ preventScroll: true }); i.select(); } catch (e) {} }, 300); }));
    const map = { mPrice: "price", mAppr: "appr", mUnit: "unitPrice", mNv: "nv" };
    Object.entries(map).forEach(([id, k]) =>
      $(id).addEventListener("change", () => {
        const v = parseFloat($(id).value);
        OV[r.id] = OV[r.id] || {};
        if (isFinite(v) && v > 0 && !(Math.abs(v - parseFloat($(id).dataset.est)) < 1e-9)) {
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
            `<tr${v === curV ? ' class="cur"' : ""}><td>${v}%</td><td class="gv"><span class="sb" style="width:${Math.round((Math.abs(y.gain) / mx) * 56)}px"></span><span class="${y.gain >= 0.05 ? "up" : y.gain <= -0.05 ? "dn" : ""}">${sg(y.gain)}</span></td><td>${y.contrib >= 0 ? ZF.cash(y.contrib) : "환급 " + ZF.cash(-y.contrib)}</td></tr>`,
        )
        .join("");
    }
    if (r.src === "moa") {
      const kids = (r.kids || []).map((id) => byId[id]).filter(Boolean);
      const box = document.createElement("details");
      box.className = "note flow moa-calc";
      box.innerHTML = "<summary><b>관리지역 평균 기준 참고 계산 보기</b></summary>";
      while (p.firstChild) box.appendChild(p.firstChild);
      p.innerHTML = `<p class="note warnbox"><b>블록별로 계산하세요</b> 모아타운 관리지역은 사업구역(블록)마다 조합·분담금·입주권 판정이 달라요. ${kids.length ? "아래 소속 조합 리포트에서 계산하세요." : "아직 정보몽땅에 등록된 소속 조합이 없어요."}</p>${kids.length ? `<div class="children">${kids.map((k) => `<button type="button" class="child" data-go="${k.id}"><span>${esc(k.n)}<small>${esc(stageName(k))}</small></span><span class="pill">${esc(k.k)}</span></button>`).join("")}</div>` : ""}`;
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
          `<li><span class="mk ${ok == null ? "q" : ok ? "ok" : "no"}" aria-hidden="true">${ok == null ? "?" : ok ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : "!"}</span><span>${ok == null ? '<span class="sr-only">미확인: </span>' : ok ? '<span class="sr-only">충족: </span>' : '<span class="sr-only">미충족: </span>'}${t}</span></li>`;
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
    const mob = matchMedia("(max-width:980px)").matches;
    if (mob) { try { SIMPLE.mapTab(); } catch (e) {} }
    else ($("mapbox") || $("mapTop"))?.scrollIntoView({ block: "start", behavior: "smooth" });
    setTimeout(() => { try { enterGu(g, { hist: true }); } catch (e) {} }, mob ? 450 : 50);
  }
  function goStation(s) {
    saveQ();
    $("sugg").hidden = true;
    $("q").setAttribute("aria-expanded", "false");
    $("q").value = "";
    if ($("hdr").classList.contains("searching")) closeSearchNow({ keepHistory: true });
    const mob = matchMedia("(max-width:980px)").matches;
    if (mob) { try { SIMPLE.mapTab(); } catch (e) {} }
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
      // after-adsense 1: 검색 줄 금액 = 구역 시트 '지금 필요한 돈'·정적 /z와 같은 함수(DTL.nums) — 전세 끼고 못 사는 곳은 시트처럼 대출 끼고 값(lnow), 따로 셈하던 gapOf/investC가 '계산 보류'를 내던 것(라이브 373곳)
      if (typeof DTL !== "undefined" && DTL.nums) {
        const n = DTL.nums(r), tot = !gapMode() && effBasis() === "total";
        const v = tot ? (n.total != null ? n.total : n.ltot) : n.need != null ? n.need : n.lnow;
        return v == null || !isFinite(v) ? null : { v, l: tot ? "입주까지" : "지금" };
      }
      if (gapMode()) { const g = gapOf(r); return g.block || g.na || g.now == null || !isFinite(g.now) ? null : { v: g.now, l: "전세 끼고" }; }
      const x = investC(r), tot = effBasis() === "total";
      const v = tot ? (x.ok ? x.needTotal : null) : x.needBuy;
      return v == null || !isFinite(v) ? null : { v, l: tot ? "입주까지" : "지금" };
    } catch (e) {
      return null;
    }
  };
  // 23차: 검색 배지 금액 = 목록·알약·상세·/z와 같은 꼴(ZF.cash: 0.1억 올림 · 1억 아래 만) — 따로 반올림하던 e1S("0.6억"·"1억" vs 1.1억)는 없앰
  const e1S = (v) => ZF.cash(Math.max(0, v));
  // 5라운드 16: 구역 안 필지 지번 검색 — 검색어가 '동 + 번지'일 때만 그 동의 색인 파일 하나(public/pcli/hNN.json · tools/pcli.py)를 받는다(첫 화면·긴 작업과 무관)
  // 받는 꼴: '면목동 86-15' · '면목동86-15' · '중랑구 면목동 86-15' · '면목동 86'(본번만 → 그 본번 필지 전부) · '면목동 산 2-25'·'산2-25' · '86 - 15'(띄어쓰기) · '번지'·'일대' 글자는 앞에서 지움
  const PCLI = {};
  const pcliH = (d) => { let n = 0; for (const c of d) n += c.charCodeAt(0); return n % 32; };
  const pcliLoad = (dong) => { const h = pcliH(dong); if (PCLI[h] === undefined) { PCLI[h] = fetch(`pcli/h${String(h).padStart(2, "0")}.json?v=${(D.dv && D.dv.tx) || D.asOf || ""}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => (PCLI[h] = j || {})); } return Promise.resolve(PCLI[h]); };
  // 6라운드: 구 이름은 서울 25개 구 목록으로만(압구정동 480 → '압구' 구 + '정동'으로 잘리던 것) · 표기 정규화(문자열만) · 행정동 → 법정동 다시 찾기
  const GU25 = ["종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구", "강동구"];
  const pcliQ = (raw) => {
    let t = String(raw || "").trim().replace(/[－–—]/g, "-").replace(/\s+/g, " ").replace(/^서울(특별시|시)?\s*/, "");
    t = t.replace(/(\d+)\s*번지\s*(\d+)\s*호?/g, "$1-$2").replace(/(\d+)\s*의\s*(\d+)/g, "$1-$2").replace(/번지|일대/g, "").replace(/([가-힣]+로)\s+(\d+가)/g, "$1$2").trim();
    let gu = "";
    for (const g of GU25) if (t.startsWith(g + " ") || (t.startsWith(g) && /[가-힣]/.test(t.charAt(g.length)) && !/^(동|가|로)/.test(t.slice(g.length)))) { gu = g; t = t.slice(g.length).trim(); break; }
    const m = /^([가-힣][가-힣0-9]*?(?:동|가|로)(?:\d+가)?)\s*(산)?\s*(\d+)(?:\s*-\s*(\d+))?$/.exec(t);
    return m ? { gu, dong: m[1], san: !!m[2], bon: m[3], bu: m[4] || "" } : null;
  };
  // 법정동 후보: 그대로 → 행정동 꼴(면목본동·면목2동·면목제2동 → 면목동) → '성수2가' → '성수동2가'
  const pcliAlt = (d) => { const o = [d]; const a = d.replace(/본동$/, "동").replace(/제?\d+동$/, "동"); if (a !== d) o.push(a); const b = /^([가-힣]+?)(\d+가)$/.exec(d); if (b && !/동$/.test(b[1])) o.push(b[1] + "동" + b[2]); return o; };
  const pcliAdm = (d) => /본동$|\d+동$/.test(d);
  function pcliHits(pq) {
    const C = pcliAlt(pq.dong); let miss = false, hitD = null, m = null;
    for (const d of C) { const B = PCLI[pcliH(d)]; if (!B || typeof B.then === "function") { miss = true; pcliLoad(d); continue; } if (B[d]) { hitD = d; m = B[d]; break; } }
    if (!hitD && miss) return null;   // 아직 받는 중
    if (!hitD) return { own: [], other: [], dong: null, alt: false };
    const pre = (pq.san ? "산" : "") + pq.bon, ids = [];
    for (const k in m) if (pq.bu ? k === `${pre}-${pq.bu}` : k === pre || k.startsWith(pre + "-")) [].concat(m[k]).forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    const zs = ids.map((id) => byId[id]).filter((r) => r && (!pq.gu || r.g === pq.gu));
    // 필지가 든 구역(사업구역 먼저) + 그 모아타운 관리지역 = 한 묶음 · 같은 관리지역의 다른 사업구역은 '다른 검색 결과' 맨 앞 · 같은 구역은 한 번만
    const own = [], other = [], add = (L, r) => { if (r && !own.includes(r) && !other.includes(r)) L.push(r); };
    zs.filter((r) => r.src !== "moa").sort((a, b) => (isDone(a) ? 1 : 0) - (isDone(b) ? 1 : 0)).forEach((r) => add(own, r));
    zs.filter((r) => r.src === "moa").forEach((r) => add(own, r));
    zs.filter((r) => r.src === "moa").forEach((mr) => (mr.kids || []).map((id) => byId[id]).filter(Boolean).forEach((r) => add(other, r)));
    return { own, other, dong: hitD, alt: hitD !== pq.dong };
  }
  // after-adsense 1: 정적 /z 제목 꼴('창신4구역 도시정비형' · '…재개발 진행 단계와 분담금 추정' · '길훈(개봉동)' · '홍제3구역(재건축)')로 찾아도 그 구역 — 원래 검색어로 하나도 안 걸릴 때만 다듬은 말로 다시(걸리던 검색 결과는 그대로)
  const SG_TW = /^(도시정비형|주택정비형|재개발|재건축|공공|도심공공주택복합|도시재생형|통합|소규모|가로주택|소규모재건축|소규모재개발|자율주택정비|모아타운|역세권|장기전세주택|활성화|시장)$/;
  const sgClean = (q) => {
    let s = q.replace(/\s*진행 단계와.*$/, "").replace(/\(([^)]*)\)/g, (m, x) => (SG_TW.test(x.trim()) ? " " : ` ${x} `)).replace(/\s+/g, " ").trim();
    const w = s.split(" ");
    while (w.length > 1 && SG_TW.test(w[w.length - 1])) w.pop();
    return w.join(" ");
  };
  const sgAny = (q) => {
    const vs = qVariants(q.replace(/\s/g, "")), terms = q.split(/\s+/), nq = normQ(q);
    return idx.some((x) => terms.every((t) => x.t.includes(t)) || vs.some((v) => x.c.includes(v)) || (nq.length >= 2 && vs.some((v) => x.a.includes(normQ(v)))) || sgSn(x, q));
  };
  // 화면에 보이는 짧은 이름(강동역세권(1구역) → '강동역세권1구역')으로도 찾게 — 색인 글자는 원래 이름이라 괄호가 낀 이름은 보이는 이름으로 못 찾던 것
  const sgSn = (x, q) => { const nq = normQ(q.replace(/\s/g, "")); if (nq.length < 2) return false; if (!x.sn) { try { x.sn = normQ(shortName(x.r.n)); } catch (e) { return false; } } return x.sn.includes(nq); };
  function renderSugg() {
    let q = $("q")
      .value.trim()
      .toLowerCase()
      .replace(/번지|일대/g, "");
    if (q.length >= 4 && !sgAny(q)) { const c = sgClean(q); if (c && c !== q && sgAny(c)) q = c; }
    // 사이클 2 통합: 이 목록이 어떤 입력값으로 그려졌는지(data-q)·지번 색인을 받는 중이라 한 번 더 그릴지(data-pend) — 검사(search.names·search.parcel)가 고정 대기 대신 '이 검색어의 그리기 끝'을 기다린다
    const qRaw = $("q").value;
    $("sugg").dataset.q = qRaw; $("sugg").dataset.pend = "";
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
          sgSn(x, q) ||
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
    // 거리·15분 기준·문구는 ZF.walkNear·walkLbl 하나(지도 역 고리 안내와 같은 수)
    const stnW = (r) => (stn ? ZF.walkD(r, [stn[2], stn[1]], stn[0]) : Infinity);
    const stnAll = stn ? ZF.walkNear([stn[2], stn[1]], stn[0]).map((x) => x[0]) : [];
    const stnZ = stnAll.slice(0, 8);
    // 15분 안 모아타운 관리지역(지도 고리 'N곳'과 같은 셈에서는 빠짐)은 수를 따로 밝히고, 아래 줄에 '15분 안' 꼬리표
    const moaIn = new Set(stn ? R.filter((r) => r.src === "moa" && !isDone(r) && stnW(r) <= ZF.W15).map((r) => r.id) : []), stnMoa = moaIn.size;
    const stnSet = new Set(stnZ.map((r) => r.id));
    // 같은 지번의 모아타운 관리지역은 따로 줄을 세우지 않고 사업 구역 줄에 '모아타운' 꼬리표로 합친다
    const pk = (r) => `${r.g}|${(r.j || "").replace(/\s+/g, "")}`;
    const zoneJ = new Set(R.filter((r) => r.src !== "moa" && r.j).map(pk));
    const moaJ = new Set(R.filter((r) => r.src === "moa" && r.j).map(pk));
    // 이름·지번이 같은 줄(같은 곳이 두 자료에 따로 실린 것: 행당동 300-1)은 한 줄만 — 먼저 나온 것(역 주변·가까운 것)을 남긴다
    const lk = (r) => `${shortName(r.n)}|${(r.j || "").replace(/\s+/g, "")}`, seenL = new Set();
    // 5라운드 16: 지번 검색 — 그 필지가 든 구역을 맨 위에 · 구역 밖이면 안내 한 줄 + 같은 동 구역('근처 구역') · 엉뚱한 구역을 맨 위에 두지 않는다
    const pq = !stn && !gu ? pcliQ($("q").value) : null;
    let pr = null, pcl = null, pclOut = false, pclAdm = false, pclOther = [];
    if (pq) {
      pr = pcliHits(pq);
      if (pr === null) { $("sugg").dataset.pend = "1"; Promise.all(pcliAlt(pq.dong).map(pcliLoad)).then(() => { if (pcliQ($("q").value)) renderSugg(); else if ($("sugg").dataset.q === qRaw) $("sugg").dataset.pend = ""; }, () => { if ($("sugg").dataset.q === qRaw) $("sugg").dataset.pend = ""; }); }
      else if (pr.own.length) { pcl = pr.own; pclOther = pr.other; }
      else if (!pr.dong && pcliAdm(pq.dong)) { pclOut = true; pclAdm = true; pcl = []; }
      else { pclOut = true; const dd = pr.dong || pq.dong; pcl = R.filter((r) => !isDone(r) && (!pq.gu || r.g === pq.gu) && String(r.j || "").split(" ")[0] === dd).slice(0, 6); }
      // 출시 전 검수 B1: 필지 매칭이 없어도 기존 이름·주소 검색에 걸린 곳이 있으면(구역 이름이 '수유동 310-15' 꼴) '구역 밖' 안내 대신 기존 결과 · 이름이 똑같은 곳이 1위
      if (pclOut && all.some((x) => !jb(x.r))) { pclOut = false; pclAdm = false; pcl = null; }
    }
    const pclIds = new Set((pcl || []).concat(pclOther).map((r) => r.id));
    const hits = (pcl || []).map((r) => ({ r, pcl: true }))
      .concat(pclOther.map((r) => ({ r, pclo: true })))
      .concat(pclOut ? [] : stnZ.map((r) => ({ r, near: true })))
      .concat(pclOut ? [] : (pq ? all.filter((x) => x.nh === 0).concat(all.filter((x) => x.nh !== 0)) : all).filter((x) => !pclIds.has(x.r.id) && !stnSet.has(x.r.id) && !(x.r.src === "moa" && x.r.j && zoneJ.has(pk(x.r)))))
      .filter((x) => { const k = lk(x.r); if (seenL.has(k)) return false; seenL.add(k); return true; })
      .slice(0, 20);
    sIdx = -1;
    $("q").removeAttribute("aria-activedescendant");
    const walkT = (r) => (r.st ? (Math.round((r.st.d * 1.3) / 67) > 20 ? "역에서 멀어요" : esc(r.st.n.replace(/역$/, "")) + "역 " + Math.max(1, Math.round((r.st.d * 1.3) / 67)) + "분") : "");
    const okZ = (r) => { try { return !!(window.ZP_ok && window.ZP_ok(r)); } catch (e) { return false; } };
    const row = (r, i, near) => {
      const n = needS(r), ok = okZ(r);
      const wt = near || moaIn.has(r.id) ? `${esc(stn[0].replace(/역$/, ""))}역 ${ZF.walkMin(stnW(r))}분${moaIn.has(r.id) ? " · 15분 안" : ""}` : r.st ? walkT(r) : "";
      // 27차: 보이는 이름에는 없고 공식 이름에만 검색어가 있으면(강북2구역 ← '미아중심재정비촉진지구…') 공식 이름을 한 줄 더
      const qn = String(q || "").replace(/\s+/g, ""), sn = shortName(r.n), offi = qn.length >= 2 && !near && !sn.replace(/\s+/g, "").includes(qn) && String(r.n || "").replace(/\s+/g, "").includes(qn) ? `<small class="sg-off">공식 이름: ${esc(String(r.n).trim())}</small>` : "";
      return `<button type="button" role="option" id="sg${i}" aria-selected="false" data-id="${r.id}" tabindex="-1"><span>${esc(sn)}${r.s >= 9 ? " <i class=\"sg-done\">완료</i>" : ""}${offi}<small>${esc(r.g)} ${esc(r.j)} · ${esc(stageName(r))}${r.src !== "moa" && r.j && moaJ.has(pk(r)) ? " · 모아타운" : ""}${wt ? " · " + wt : ""}</small></span><em class="sg-c">${n ? `<b><i class="sg-l">${n.l === "입주까지" ? "입주까지" : "지금"}</i> ${e1S(n.v)}</b>${ok ? '<i class="sg-ok">내 돈으로 가능</i>' : n.v > CASH + 1e-9 ? `<i class="sg-ok sg-no">내 돈 ${esc(ZF.gap(n.v, CASH))} 부족</i>` : (r.lc || estHide(r)) ? `<i class="sg-ok sg-no sg-na">${ZF.EXCL}</i>` : '<i class="sg-ok sg-no sg-na">조건 밖</i>'}` : r.s >= 9 ? "" : `<i class="sg-ok sg-no sg-na">${r.src === "moa" ? "사업구역별" : "계산 보류"}</i>`}</em></button>`;   // 20차: 금액이 없는 줄도 빈칸 대신 '계산 보류'
    };
    const stnRow = stn
      ? `<button type="button" role="option" id="sgS" aria-selected="false" data-stn="${esc(stn[0])}" tabindex="-1" class="sg-stn"><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 10h12M8 21l2-4M16 21l-2-4"/></svg>${esc(stn[0])}<small>${esc((stn[3] || []).join(" · "))} · 지도에서 역 주변 보기</small></span><em>지도 →</em></button>`
      : "";
    const guN = gu ? R.filter((r) => r.g === gu && !isDone(r) && r.src !== "moa").length : 0;
    const guRow = gu
      ? `<div class="sg-gu" role="presentation"><button type="button" role="option" id="sgG" aria-selected="false" data-gu="${esc(gu)}" tabindex="-1" class="sg-stn"><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>${esc(gu)}<small>진행 중 구역 ${fmt(guN)}곳 · 지도에서 보기</small></span><em>지도 →</em></button><a class="sg-gup" role="option" id="sgGp" aria-selected="false" tabindex="-1" href="/gu/${encodeURIComponent(gu)}">구 페이지</a></div>`
      : "";
    // 6라운드: 구역 밖 안내 = 빈 화면 문법(그림 · 14px 본문 · 설명 한 줄)
    const outHTML = () => pclAdm
      ? `<div class="s-none sg-out" role="presentation"><b>법정동 이름(예: 면목동)으로 찾아 주세요</b><br>지번은 행정동(면목본동·면목2동)이 아니라 법정동 이름으로 찾아요.</div>`
      : `<div class="s-none sg-out" role="presentation"><b>이 지번은 지도에 있는 재개발 구역 밖이에요</b><br>${esc(pq ? `${(pr && pr.dong) || pq.dong} ${pq.san ? "산" : ""}${pq.bon}${pq.bu ? "-" + pq.bu : ""}` : "")} · 정비구역·모아타운 경계 안 필지만 찾아요.</div>`;
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
            const pj = pq ? `${pr && pr.dong ? pr.dong : pq.dong} ${pq.san ? "산" : ""}${pq.bon}${pq.bu ? "-" + pq.bu : "번지"}` : "";
            const altT = pr && pr.alt ? ` · ${esc(pr.dong)}(법정동)으로 찾았어요` : "";
            if (h.pcl && i === 0) hd = pclOut ? `${outHTML()}<div class="x-h" role="presentation">같은 동(${esc((pr && pr.dong) || pq.dong)}) 구역</div>` : `<div class="x-h" role="presentation">${esc(pj)} → ${esc(shortName(h.r.n))}${pcl.length > 1 ? ` 외 ${pcl.length - 1}곳` : ""} 안 필지${altT}</div>`;
            else if (!h.pcl && i > 0 && hits[i - 1].pcl && !pclOut) hd = `<div class="x-h" role="presentation">다른 검색 결과</div>`;
            else if (h.near && i === 0) hd = `<div class="x-h" role="presentation" data-walk="${stnAll.length}">${esc(ZF.walkLbl(stn[0], stnAll.length))}${stnAll.length > stnZ.length ? ` (가까운 ${stnZ.length}곳)` : ""}${stnMoa ? ` · 모아타운 관리지역 ${stnMoa}곳 따로` : ""}</div>`;
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
        : pclOut
          ? outHTML()
          : stn || gu
            ? ""
            : noneHTML());
    $("sugg").hidden = false;
    $("q").setAttribute("aria-expanded", "true");
    $("suggLive").textContent = pclAdm ? "법정동 이름으로 찾아 주세요" : pclOut ? "이 지번은 재개발 구역 밖이에요" : pcl && pcl.length ? `${shortName(pcl[0].n)} 안 필지` : hits.length ? `${all.length}곳 찾음` : stn ? `${stn[0]} 찾음` : gu ? `${gu} 찾음` : "일치하는 사업장 없음";
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
      // 23차: 화살표로 고른 줄(aria-activedescendant)이 있으면 그 줄 — 목록을 다시 그리면(sIdx = -1) 첫 줄이 열리던 것
      const ad = $("q").getAttribute("aria-activedescendant"), ae = ad && document.getElementById(ad);
      if (ae && !$("sugg").hidden && $("sugg").contains(ae)) { ae.click(); return; }
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
  const rankGain = (r) => { try { const x = investC(r); return x && x.ok && x.gain != null && isFinite(x.gain) ? x.gain : null; } catch (e) { return null; } };
  $("rSort").addEventListener("change", (e) => { sortKey = e.target.value; sortDir = sortKey === "move" ? 1 : -1; drawRank(true); });
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
        // 정렬 고르기(#rSort): 입주까지 현금 적은 순(지금 사는 방식 · 계산 못 하면 맨 아래) · 입주 때 시세 차이 큰 순
        move: (r) => ZF.cashToMoveIn(r, gapMode()) ?? 1e9,
        gain: (r) => { const g = rankGain(r); return g == null ? -1e9 : g; },
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
            return `<tr data-id="${r.id}" tabindex="0" aria-label="${esc(r.n)} 리포트 열기"><td class="rn">${i + 1}</td><td class="nm"><b title="${esc(r.n)}">${esc(shortName(r.n))}</b><small>${esc(r.g)} ${esc(r.j)} · ${esc(r.k)}${sortKey === "move" ? ` · <span class="rk-v">${LBL.cashToMoveIn} ${ZF.cashToMoveIn(r, gapMode()) != null ? ZF.cash(ZF.cashToMoveIn(r, gapMode())) : "계산 못 함"}</span>` : sortKey === "gain" ? ` · <span class="rk-v">입주 때 시세 차이 ${rankGain(r) != null ? (rankGain(r) > 0 ? "+" : "") + ZF.cash(rankGain(r)) : "계산 못 함"}</span>` : ""}</small></td><td class="stc">${stagePill(r)}</td><td class="sc">${ptsBar(r)}<span class="mlab">입지</span><b>${r.score}</b></td><td class="n cm">${r.comp != null ? `<span class="mlab">입지·진척</span><span class="gb sm" title="투자 등급 아님"><b>${r.comp}</b></span>` : dash("자료 없음")}</td><td class="n stn">${esc(r.st.n)} ${fmt(r.st.d)}m</td><td class="n xo inf">${(() => {
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
        `<b>${total > 60 ? `상위 60곳` : `${fmt(total)}곳`}</b>${total > 60 ? ` · 전체 ${fmt(total)}곳` : ""}${f.af ? ` · 현금 ${ZF.cash(CASH)} 기준` : ""}${!total && nf ? ` · 조건 ${nf}개 적용` : ""}<span class="rs-note"> · ${[noLoc ? `위치 정보 없는 ${fmt(noLoc)}곳은 빼고 셌어요` : "", moaK ? "모아타운 관리지역만" : `모아타운 관리지역 ${fmt(MOA_ALL.length)}곳은 유형 '모아타운'에서`].filter(Boolean).join(" · ")}</span>`;
      $("rankPop").textContent =
        `모집단: 진행 중 사업장 ${fmt(POP.length)}곳 중 위치가 확인된 ${fmt(POP_LOC.length)}곳 (위치 미확인 ${fmt(POP.length - POP_LOC.length)}곳은 입지 점수가 없어 검색·계산기에서만 보여요)`;
      $("rAffordLab").textContent = `내 돈 ${ZF.cash(CASH)}으로 되는 곳`;
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
              try { const so = $("rSort"); if (so) so.value = [...so.options].some((o) => o.value === sortKey) ? sortKey : ""; } catch (e) {}
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
  /*Y*/
  function rankEmpty(f) {
    const cash = `현금 ${ZF.cash(CASH)}으로`,
      basisTxt = P.basis === "total" ? "입주까지" : "지금 매수";
    const where = f.g || "서울";
    const subj = `${f.s ? f.s + " 단계 " : ""}${f.k || "구역"}`;
    const title = f.af ? `${where}에서 ${cash} 되는 ${josa(subj, "이", "가")} 없어요` : `${where}에 ${josa(subj, "이", "가")} 없어요`;
    const LAB = {
      af: "내 돈 조건 끄고 보기",
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
        "모아타운 관리지역은 사업구역(블록)별로 계산이 달라 '내 돈' 조건에서 빠져요. 관리지역 안 개별 가로주택·소규모 조합으로 보세요.";
      return emptyState({
        icon: ICON.filter,
        title: "모아타운은 '내 돈' 조건과 함께 볼 수 없어요",
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
      desc = `적용한 조건: ${[f.g || "서울 전체", f.k || "모든 유형", f.s ? f.s + " 단계" : "진행 중 전체", f.af ? `내 돈 ${ZF.cash(CASH)}` : null].filter(Boolean).join(" · ")}`;
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
            "<b>재개발</b>: 관리처분계획인가 뒤 매수 → 조합원 불가 · 2018.1.25 시행 뒤 최초로 사업시행인가를 신청한 구역부터 (도시정비법 부칙 〈제14943호〉 제2조 · 기준은 신청일)",
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
      `<p class="rules-dg" data-rules-dg><a href="#diagTop" data-menu="diagTop">구역을 골라 입주권·토지거래허가·신축 쪼개기 위험까지 한 번에 보기 → 매물진단</a></p><h3 class="rules-g">매수 전에 확인할 것 <small>지위양도·재당첨·대출·세금</small></h3><div class="rules-col">${buyer.join("")}</div><h3 class="rules-g">사업 진행 요건 <small>구역지정·동의율·모아타운</small></h3><div class="rules-col">${biz.join("")}</div>`;
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
    "https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do": { d: "내려받음 2026.10 · 공공누리 제1유형" },
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
      g: "pub",
      t: "서울시 대규모점포 인허가 정보 · 대형마트 영업 여부·좌표(서울 열린데이터광장 OA-16096)",
      d: "내려받음 2026.10 · 공공누리 제1유형",
      u: "https://data.seoul.go.kr/dataList/OA-16096/S/1/datasetView.do",
    },
    {
      g: "etc",
      t: "학교·병원·대형마트 위치 © OpenStreetMap contributors (ODbL)",
      d: "Overpass API 2026.10.1 조회",
      u: "https://www.openstreetmap.org/copyright",
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
  const e2 = ZF.num;   // 억 금액 숫자 꼴은 ZF.num 하나(05_facts.js) · 단위까지 붙인 글은 ZF.cash(1억 아래 만 원)
  const sg = (x) => (Math.abs(x) < 0.05 ? "0원" : (x >= 0 ? "+" : "−") + ZF.cash(Math.abs(x)));   // 단위까지(1억 아래 '4,100만')
  const uI = (t) => String(t).replace(/(억|만|원)$/, "<i>$1</i>");   // 큰 숫자의 단위만 작게
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
  // 사이클 2: 재개발 관리처분인가 뒤 지위양도 제한의 적용 범위 — 도시정비법 부칙 <법률 제14943호, 2017.10.24> 제2조(법제처 19-0079):
  //   2018.1.25 시행 뒤 '최초로 사업시행인가를 신청한' 구역부터 적용 → 기준은 인가일이 아니라 신청일
  //   ex(제한 없음): 신청일(b18p)이 2018.1.24까지 · 또는 인가일(b18)이 2018.1.24까지(인가가 그 전이면 신청도 그 전)
  //   unk(신청일 확인 필요): 신청일 자료 없이 인가일만 있고 그 인가가 시행 뒤 2년 안(2018.1.25~2020.1.24) — 신청이 그 전이었을 수 있어 단정하지 않는다
  //   ap(제한 적용): 그 밖
  function b18Of(r) {
    const B18_CUT = "2018-01-24";
    if (r.b18p && String(r.b18p).slice(0, 10) <= B18_CUT) return { st: "ex", by: "app", d: r.b18p };
    if (r.b18 && String(r.b18).slice(0, 10) <= B18_CUT) return { st: "ex", by: "appr", d: r.b18 };
    const a = String(r.b18a || "").slice(0, 10);   // 빌드가 넣은 사업시행인가일(신청일 자료 없는 2018.1.25~2020.1.24 인가 · tools/build.py)
    if (a && a > B18_CUT && a < "2020-01-25") return { st: "unk", d: a };
    return { st: "ap", d: null };
  }
  window.ZP_b18 = b18Of;   // 점검(QA): 부칙 판정 단위 시험
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
      // 사이클 2: 부칙 판정은 b18Of 하나(신청일 기준) — 화면 문구·가격 계산(stale)·추정 매수가 제외가 모두 이것을 쓴다
      const b8 = b18Of(r), dd = (d) => String(d || "").replace(/^(\d{4})-(\d{2})-(\d{2}).*/, (m, y, a, c) => `${y}.${+a}.${+c}`);   // 날짜 꼴 YYYY.M.D(앱 공통)
      const EXT = b8.by === "app"
        ? `사업시행인가 신청(${dd(b8.d)})이 2018.1.24까지라 관리처분인가 뒤에도 지위양도 제한이 적용되지 않아요(도시정비법 부칙 제2조 · 신청일 기준으로 지위양도 제한 적용 안 됨 · 인가는 그 뒤 · 추정·확인 필요).`
        : `사업시행인가(${dd(b8.d)})가 2018.1.24 이전이라 신청도 그 전이에요 · 사업시행인가 신청이 2018.1.24까지라 관리처분인가 뒤에도 지위양도 제한이 적용되지 않아요(도시정비법 부칙 제2조).`;
      const UNK = `사업시행인가(${dd(b8.d)})가 2018.1.25 시행 직후라, 신청이 2018.1.24까지였다면 관리처분인가 뒤에도 지위양도 제한이 적용되지 않아요(도시정비법 부칙 제2조 · 기준은 인가일이 아니라 신청일). 신청일 자료가 없어 단정하지 않아요 — 조합·구청에 사업시행인가 신청일을 확인하세요.`;
      if (r.s >= 6) {
        if (b8.st === "ex")
          return {
            cls: "ok",
            t: "입주권 가능",
            due: "2018.1.24까지 사업시행인가 신청 구역",
            b18: b8.d, b18by: b8.by,
            d: EXT + `${r.s >= 7 ? " 멸실 뒤에는 토지 취득세 4.6%." : ""}` + REQ,
          };
        if (b8.st === "unk")
          return {
            cls: "chk",
            t: "입주권 여부 확인 필요",
            due: "사업시행인가 신청일 확인 필요",
            d: UNK,
          };
        return {
          cls: "no",
          t: "입주권 없음",
          due: "관리처분인가 이후 매수분",
          d: "관리처분계획인가 뒤 매수자는 조합원 불가(현금청산 · 2018.1.25 시행 뒤 최초로 사업시행인가를 신청한 구역 · 도시정비법 부칙 제2조)." + ex,
        };
      }
      if (b8.st === "ex")
        return {
          cls: "ok",
          t: "입주권 가능",
          due: "2018.1.24까지 사업시행인가 신청 구역 · 관리처분인가 뒤에도 지위양도 가능",
          b18: b8.d, b18by: b8.by,
          d: EXT + REQ,
        };
      if (b8.st === "unk" && r.s === 5)
        return {
          cls: "ok",
          t: "입주권 가능",
          due: "관리처분인가 전 매수 · 다음 단계부터는 신청일 확인 필요",
          near: true,
          d: "관리처분계획인가 전 매수·등기 시 조합원 자격 취득. " + UNK + REQ,
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
        // 사이클 2: 인가일 기록이 없어도 공식 목록 단계가 조합설립인가면 단계로 판정(같은 단계 가로주택끼리 판정이 갈리던 것 · o64·o61 vs o65)
        if (!((r.dt || {})["조합설립"] || r.u4) && r.chk)
          return { cls: "no", t: "입주권 없음", due: `${lab} 이후 매수분 · 인가일 기록 없음(정보몽땅 목록 단계로 판정)`, d: `정보몽땅 목록 단계가 ${lab}이라 이후 매수자는 조합원 불가(${law}). 인가일이 기록되지 않아 날짜는 구청에 확인하세요.` + ex };
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
    const stale = r.s >= 7 || (r.s >= 6 && b18Of(r).st === "ex");
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
        apprWhy = `세대당 대지지분 약 ${L}㎡(구역 면적 × 80% ÷ 소유자 수) × 공시지가 ㎡당 ${fmt(r.jg / 1e4)}만 × 1.35 + 건물 0.2억 (시세의 75% 상한)`;
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
      apprWhy = `대지지분 ${L}㎡${o.land == null ? " (가정값 · 입력으로 수정)" : ""} × ${r.jgf ? "같은 동 사업장" : "주변"} 공시지가 ㎡당 ${fmt(r.jg / 1e4)}만 × 1.4 + 건물 0.2억 (매수가의 95% 상한)`;
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
      if (r.dn || r.cx || r.src === "moa" || r.tag === "mk" || r.s >= 7 || (r.s >= 6 && b18Of(r).st === "ex") || r.k === "재건축" || r.mk?.entry || MED[r.g] == null) return;
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
  /*Y*/
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
      cashNote(`${raw} → ${ZF.cash(e)}으로 계산했어요.`);
      sizeCash();
      return;
    }
    if (v >= 1e7) {
      const e = v / 1e8;
      $("pCash").value = String(Math.round(e * 100) / 100);
      cashNote(`${fmt(v)}원 → ${ZF.cash(e)}으로 바꿔 계산했어요. (억 단위로 입력: 예 3.5)`);
      sizeCash();
      return;
    }
    if (v >= 1e3) {
      const e = v / 1e4;
      $("pCash").value = String(Math.round(e * 100) / 100);
      cashNote(`${fmt(v)}만 → ${ZF.cash(e)}으로 바꿔 계산했어요. (억 단위로 입력: 예 3.5)`);
      sizeCash();
      return;
    }
  }
  const NAME_TAIL =
    /\s*(주택)?(재정비촉진구역|정비구역)?\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)?\s*(정비)?\s*(사업)?\s*(조합설립)?\s*(정비사업)?\s*(추진위원회|추진위|조합|준비위원회|주민협의체|주민대표회의|사업시행자|위원회)?\s*(재개발구역)?\s*$/;
  let SN_DIS = null;   // 짧은 이름이 겹치는 구역 → 동 붙인 이름(한 번만 계산)
  // shortName0은 같은 이름을 수천 번 다시 계산하던 것 → 한 번만(18차 성능)
  const SN0C = new Map();
  const shortName0m = (n) => { let v = SN0C.get(n); if (v === undefined) { v = shortName0(n); SN0C.set(n, v); } return v; };
  function shortName(n) {
    if (!SN_DIS) {
      SN_DIS = new Map();
      const g = new Map();
      // 띄어쓰기만 다른 이름('여의대방역세권' · '여의대방 역세권')도 같은 이름으로 보고 가른다
      R.forEach((r) => { if (!r.n) return; const k = shortName0m(r.n).replace(/\s+/g, ""); if (!g.has(k)) g.set(k, new Map()); g.get(k).set(r.n, r); });
      g.forEach((m) => {
        if (m.size < 2) return;
        const dn = (r) => (r.bj || r.j || "").split(" ")[0];
        const jb = (r) => ((r.bj || r.j || "").split(" ")[1] || "").replace(/[^\d-]/g, "");   // 지번 그대로(4-5 · 1343) — 본번만 쓰면 '신길동 4'처럼 읽혔다
        const kd = (r) => (r.src === "moa" ? "관리지역" : /재건축/.test(r.n) ? "재건축" : /도시환경|도시정비형/.test(r.n) ? "도시정비형" : /가로/.test(r.n) ? "가로주택" : /재개발/.test(r.n) ? "재개발" : "");
        const V = [...m.values()], diffD = new Set(V.map(dn)).size === V.length;
        // 동이 다르면 동을, 같은 동끼리면 사업 유형을, 유형도 같으면 동+지번 본번을 붙인다(예: 홍제3구역(재건축) · 홍제3구역(도시정비형))
        const diffK = !diffD && new Set(V.map(kd)).size === V.length && V.every(kd);
        m.forEach((r, full) => {
          const d = dn(r), k = shortName0m(full);
          const tag = diffD ? (d && !k.includes(d) ? d : "") : diffK ? kd(r) : d && jb(r) ? `${d} ${jb(r)}` : "";
          if (tag) SN_DIS.set(full, `${k}(${tag})`);
        });
      });
    }
    if (!SN_FIX) SN_FIX = snFix();
    return SN_DIS.get(n) || SN_FIX.get(n) || shortName0m(n);
  }
  // 29차: 짧은 이름이 동·구·도시 이름뿐이면(서울 · 상도 · 월계동 · 용답동) 무엇인지 모른다 → 아파트는 '아파트'(도시·구 이름이면 동도),
  //       괄호 속 진짜 이름('상도 214' · '1구역'), 아니면 '동 지번 사업 종류'를 붙인다. 숫자만 붙은 '천호1·3'은 '구역'까지
  let SN_FIX = null;
  function snFix() {
    const out = new Map(), dongs = new Set(), GU = new Set();
    R.forEach((r) => { const d = ((r.bj || r.j || "").split(" ")[0] || ""); if (/동$/.test(d)) { dongs.add(d); dongs.add(d.replace(/\d*동$/, "")); } if (r.g) { GU.add(r.g); GU.add(r.g.replace(/구$/, "")); } });
    const city = (k) => k === "서울" || GU.has(k);
    const kindW = (n) => (/가로/.test(n) ? "가로주택" : /소규모재건축/.test(n) ? "소규모재건축" : /재건축/.test(n) ? "재건축" : /재개발|도시환경|도시정비형/.test(n) ? "재개발" : "");
    R.forEach((r) => {
      if (!r.n || SN_DIS.has(r.n)) return;
      const k = shortName0m(r.n), par = (/\(([^)]+)\)/.exec(r.n) || [])[1] || "";
      const d = ((r.bj || r.j || "").split(" ")[0] || ""), jb = ((r.bj || r.j || "").split(" ")[1] || "").replace(/[^\d-]/g, "");
      if (/^\d+구역$/.test(par.trim()) && !/구역$/.test(k)) { out.set(r.n, k + par.trim()); return; }   // '강동역세권(1구역)' → '강동역세권1구역'
      if (/^(천호)\d+$/.test(k)) { out.set(r.n, k + "구역"); return; }   // '천호3' → '천호3구역'(천호1과 같은 꼴)
      if (/\s/.test(k) || !(city(k) || dongs.has(k) || /^[가-힣]{1,3}동$/.test(k))) return;
      if (/아파트/.test(r.n)) { out.set(r.n, `${city(k) && d ? d.replace(/\d*동$/, "") + " " : ""}${k}아파트${par && !/\d,|,/.test(par) ? " " + par.replace(/^제/, "") : ""}`); return; }
      if (/[가-힣]+\s*\d/.test(par) && !/,/.test(par)) { out.set(r.n, par.trim()); return; }   // '상도 주택재개발…(상도 214)' → '상도 214'
      const t = [d || k, jb, kindW(r.n)].filter(Boolean).join(" ");
      if (t !== k) out.set(r.n, t);
    });
    return out;
  }
  // 이름이 '…제'로 끝나는 동(홍제·인제 등) — 지번 주소 첫 낱말에서
  let JE0 = null;
  const JE = () => JE0 || (JE0 = new Set(R.map((r) => ((r.bj || r.j || "").split(" ")[0] || "").replace(/\d*동$/, "")).filter((d) => /제$/.test(d)).flatMap((d) => [d, d.slice(-2), d.slice(-3)])));
  function shortName0(n) {
    // '응암3동 재개발 연계형 도시재생활성화사업(A구역)' → '응암3동 A구역'(괄호 속 영문 구역 이름이 진짜 이름)
    // 이름이 사업 종류뿐이고 곳이 괄호 안에만 있으면: '주택재개발정비사업조합(상도동2,4동)' → '상도동2·4동 재개발'
    const gk = /^\s*(?:주택)?(재개발|재건축)(?:정비)?(?:사업)?(?:조합|추진위원회)?\s*\(([^)]+)\)\s*$/.exec(n);
    if (gk) return `${gk[2].replace(/\s*,\s*/g, "·").trim()} ${gk[1]}`;
    const ab = /^(\S+?동)\s.*\(([A-Z]구역)\)\s*$/.exec(n);
    if (ab) return `${ab[1]} ${ab[2]}`;
    // 28차: 같은 단지 몇 개 동만 하는 소규모재건축('개포현대2차아파트 200동,220동 소규모재건축사업조합') → '개포현대2차 200·220동(소규모)' — 단지 전체 재건축('개포현대2차')과 거의 같은 이름이던 것
    const sb = /^(.+?)(?:아파트)?\s+(\d+동(?:\s*,\s*\d+동)+)\s*소규모재건축/.exec(n);
    if (sb) return `${sb[1]} ${sb[2].split(/\s*,\s*/).map((x) => x.replace(/동$/, "")).join("·")}동(소규모)`;
    let s = n
      .replace(/^\s*\d{1,3}\.\s+(?=\S)/, "")   // 정보몽땅 목록 번호 '43. 문래동1·2가' → '문래동1·2가'
      .replace(/^\s*\[[^\]]*\]\s*/, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/^[^(]*\)\s*/, (m) => (/\(/.test(m) ? m : ""))
      .replace(/\s+/g, " ")
      .trim()
      // '미아제4구역'·'노량진 제1구역' → '…4구역'·'…1구역'. 단, 동 이름이 '제'로 끝나면(홍제동 → '홍제3구역') 그 '제'는 남긴다
      .replace(/([가-힣]*?)\s*(제?)\s*(\d+)\s*(재정비촉진구역|구역)/, (m, a, j, d) => (j && a && JE().has(a.slice(-3) + "제") ? `${a}제${d}구역` : `${a}${d}구역`));
    s = s.replace(/\s*(주택)?(재건축|재개발)정비사업구역$/, "");   // '오금현대아파트 주택재건축정비사업구역' → '오금현대'
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
      .replace(/(역세권)(\s+SHIFT)?(\s+(장기전세|공공임대|공공주택|건립))+$/, "$1")   // 사업 방식 말은 이름에서 뺀다(/z 제목과 같은 '역촌역세권(역촌동)')
      .replace(/\s+/g, " ")
      .trim();
    return s.length >= 2 ? s : n;
  }
  window.ZP_shortName = (n) => shortName(n);   // 26차: 검사(한 판정 · 검색 배지)용 — shortName0 원본 덩이(zsample·qa가 잘라 씀) 밖에 둔다
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
    // 28차: '매수 대출 0원'(입주까지 계산에서 고른 금액)만 보여 머리 '대출 6,920만'(지금 필요한 돈에 쓴 한도)과 엇갈리던 것 → 두 금액을 이름 붙여 함께
    if (part) return `${won(x.loanCap)} <small>지금 필요한 돈에 넣은 대출(한도) · ${how}</small><small>입주까지 현금은 이 대출을 입주 전에 갚는다고 보고 계산했어요 · ${x.loanNow ? `이자는 ${won(x.loanNow)}에 대해서만 넣었어요` : "그 이자는 넣지 않았어요(일찍 갚을수록 줄어요)"}</small>`;
    return `${won(x.loanNow)} <small>${how} · 한도 전액 · 지금 필요한 돈과 입주까지 현금에 같은 금액</small>`;
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
      return `<div class="hv ref"><span>${GAIN_LBL()}</span><b>${uI(sg(x.gain))} <em class="refb">시점 미정 · 참고값</em></b><small>${x.yrs ? "입주 2년 이내 · 연환산 생략" : `입주 시점 미정${x.loanNow ? ` · 매수대출 이자는 ${CONS_YRS}년(보수 가정)` : ""}`}</small>${isMulti() ? `<small class="mh">${MULTI_NOTE}</small>` : ""}</div>`;
    const sub =
      x.gain <= 0
        ? "손실 예상 · 추정 이율 없음"
        : `<span title="매수대출 이자와 분담금 납부 시점을 반영한 연 복리 수익률(연 복리 수익률)">연 ${pcIrr(x.annual)} (연 복리 수익률)</span>${x.annual < DEP ? ` · <span class="lowp">예금 ${(DEP * 100).toFixed(1)}% 미만</span>` : ""}${slow ? ` · <span class="lowp" title="10년 안 준공 가능성이 낮아요">10년 내 준공 ${probTxt(p10)}로 낮음</span>` : ""}`;
    const cls = x.gain >= 0.05 ? "up" : x.gain <= -0.05 ? "dn" : "";
    return `<div class="hv ${cls}"><span>${GAIN_LBL()}</span><b>${uI(sg(x.gain))}</b><small>${sub}${x.refund ? " · 환급 추정(조합 추정분담금 확인)" : ""}</small>${isMulti() ? `<small class="mh">${MULTI_NOTE}</small>` : ""}</div>`;
  }
  function flowParts(x) {
    // 29차: 칸마다 화면 타일과 같은 값(원값 → ZF.cash가 표시 단위로 올림) · 합은 원값으로(= 머리 '입주까지 현금')
    const now = x.needNow, rep = x.loanNow, c = x.contrib, ti = x.origTax + x.interest + x.midInt, le = x.loanEnd;
    return { now, rep, c, ti, le, sum: x.needTotal };
  }
  function flowLine(x) {
    if (!x.ok)
      return x.needNow != null
        ? `지금 ${ZF.cash(x.needNow)} (매수가 ${ZF.cash(x.price)} + 취득세 ${won(x.tax)}${x.loanNow ? ` − 대출 ${ZF.cash(x.loanNow)}` : ""})`
        : "";
    const f = flowParts(x);
    // 30차: 칸마다 정확한 만 원(왜 이 금액? 시트와 같은 꼴) · 합 = 보이는 칸의 합 그대로 — 칸마다 올려 보여 '1.2억 + 7,720만 + 7.8억 …'이 5.22억인데 '= 5.1억'이던 것
    // 머리 숫자(0.1억 단위로 반올림)와 글자가 다르면 그 값을 괄호로 함께
    const cap = x.loanCap > 0.005 ? x.loanCap : 0;
    if (!(x.flow >= x.needNow - 1e-9)) return `지금 ${ZF.cash(f.now)}이 최대 (입주 때는 잔금대출로 충당)`;
    const M = (v) => Math.round((v || 0) * 1e4), E = (m) => ZF.exact(m / 1e4);
    const a = M(cap ? x.needBuy : f.now), b = cap ? M(cap) : 0, c = M(f.c), t = M(f.ti), l = M(f.le), sm = a + b + c + t - l;
    const parts = [
      `지금 ${E(a)}`,
      cap ? `매수 대출 갚기 ${E(b)}` : null,
      `${c < 0 ? "환급 −" + E(-c) : "분담금 " + E(c)}`,
      `세금·이자 ${E(t)}`,
    ]
      .filter(Boolean)
      .join(" + ")
      .replace("+ 환급 −", "− 환급 ");
    const head = ZF.cash(f.sum), tot = E(sm);
    const tail = [tot !== head ? `입주까지 현금 ${head}은 0.1억 단위로 반올림한 값` : "", cap ? `매수 대출은 입주 전에 갚는다고 보고 계산 · ${x.loanNow ? `이자는 ${won(x.loanNow)}에 대해 넣음` : "그 이자는 넣지 않음"}` : ""].filter(Boolean).join(" · ");
    return `${parts} − 잔금대출 ${E(l)} = ${tot}${tail ? ` (${tail})` : ""}`;
  }
  // 순위 카드에서만 쓰는 '이름이 겹치는 구역' — 처음 쓸 때 계산(첫 화면 긴 작업 줄이기)
  let DUPN0 = null;
  const DUPN = { has: (k) => (DUPN0 || (DUPN0 = (() => {
    const c = new Map();
    R.forEach((r) => {
      const k = shortName(r.n);
      c.set(k, (c.get(k) || 0) + 1);
    });
    return new Set([...c].filter(([, n]) => n > 1).map(([k]) => k));
  })())).has(k) };
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
        lv = ZF.left(CASH, need),   // 화면 '남음' = 내 돈 − 보인 필요한 돈(내림)
        tight = !over && left < 0.5 - 1e-9,
        loss = x.ok && x.gain <= -0.05;
      const short = !total && x.ok && x.needTotal > CASH;
      const st = over
        ? `${ZF.gap(need, CASH)} 부족`
        : loss
          ? `손실 예상 · ${lv ? ZF.cash(lv) + " 남음" : "남는 돈 없음"}`
          : tight
            ? !lv
              ? "예산 거의 다 씀"
              : `${ZF.cash(lv)} 남음 · 빠듯`
            : `${ZF.cash(lv)} 남음`;
      const inc = num("pIncome"),
        le = x.ok ? Math.max(x.loanEnd, x.loanNow) : x.loanNow;
      const dsrNote =
        inc != null && total && x.ok && x.loanEnd > 0.05
          ? `<p class="dsr-s">입주 잔금대출 ${ZF.cash(x.loanEnd)} · 현행 규제(2025.10.16~) 기준 · 입주 시점 규제에 따라 달라짐</p>`
          : inc == null && total && le > 0.05
            ? `<p class="dsr-s">${x.ok && x.loanEnd >= x.loanNow ? "입주 잔금대출" : "대출"} ${ZF.cash(le)} → DSR상 연소득 약 ${incTxt(le)} 필요 (연소득 미입력 · 현행 규제 기준)</p>`
            : "";
      budget = `<div class="bud ${over || short ? "over" : loss ? "neutral" : tight ? "tight" : ""}">\n      <div class="bl"><span>${total ? "입주까지 현금" : "지금 필요한 돈"}</span><b>${ZF.cash(need)} <small>/ ${ZF.cash(CASH)}</small></b></div>\n      <div class="bt" role="img" aria-label="필요한 돈 ${ZF.cash(need)}, 내 돈 ${ZF.cash(CASH)}, ${st}"><i style="width:${Math.min(100, fill)}%"></i></div>\n      <div class="bs"><small>${esc(flowLine(x))}</small><span class="st">${st}</span></div>\n      ${dsrNote}${short ? `<p class="warnline">입주까지 ${ZF.cash(x.needTotal)} 필요 · ${ZF.gap(x.needTotal, CASH)} 부족 — 분담금을 못 내면 중간에 팔아야 할 수 있어요</p>` : ""}\n    </div>`;
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
            `사업시행인가 이후인데 웃돈(프리미엄) 추정이 내 지분 값(권리가액)의 20% 미만이에요. 실제 매물가를 아래에 넣어 보세요.${x.passHeld ? " 수익·확률 기준은 넘지만 매수가 확인 전이라 기준 통과에서 뺐어요." : ""}`,
          ]
        : null,
      x.nvFix ? ["신축 시세 보정", "주변 신축 시세가 이 단지 구축보다 낮아 구축 ㎡단가 × 1.15로 보정"] : null,
      x.consYrs && x.ok && x.loanNow ? ["이자 기간 가정", `입주 시점이 없어 매수대출 이자를 ${CONS_YRS}년으로 보수적으로 넣었어요.`] : null,
      r.chk && w.cls !== "chk"
        ? ["단계 정보 확인 중", chkText(r) + (x.passHeld ? " 수익·확률 기준은 넘지만 단계가 확정되지 않아 기준 통과에서 뺐어요." : "")]
        : null,
    ].filter(Boolean);
    const ti = x.ok ? flowParts(x).ti : null;
    const why = `<details class="why"><summary>계산 근거${notes.length ? ` · 참고 ${notes.length}` : ""}</summary><div class="why-in">\n      ${notes.length ? `<ul class="why-notes">${notes.map(([t, d]) => `<li><b>${esc(t)}</b>${esc(d)}</li>`).join("")}</ul>` : ""}\n      ${x.price != null ? `<dl>\n        <dt>매수가</dt><dd>${ZF.cash(x.price)} <small>${x.priceSrc === "user" ? "직접 입력" : x.priceSrc === "complex" ? `${esc(en.name)} 실거래 ${en.n}건 가운데 값 (전용 ${en.area_med}㎡ · 계약 2025.10~2026.9)` : x.priceSrc === "villa" ? `${en.scope ? esc(en.scope) : `반경 ${fmt(en.radius)}m 구축 빌라`} 실거래 ${en.n}건 가운데 값 (전용 ${en.area_med}㎡ · 계약 2025.10~2026.9)` : ""}</small></dd>\n        <dt>취득세</dt><dd>${won(x.tax)} <small>${taxDesc(x)} · '지금'에 포함</small></dd>\n        ${x.ok ? `<dt>매수 대출</dt><dd>${loanWhy(x)}</dd>` : ""}\n        <dt>감정가 추정</dt><dd>${ZF.cash(x.appr)} <small>${esc(x.apprWhy)}</small></dd>\n        <dt>내 지분 값(권리가액) · 웃돈(프리미엄)</dt><dd>${won(x.right)} · ${won(x.prem)} <small>비례율 ${Math.round(x.ratio * 100)}% 가정</small></dd>\n        ${x.ok ? `<dt>조합원 분양가</dt><dd>${ZF.cash(x.unitPrice)} <small>${x.unitArea}㎡ · 신축 시세의 ${Math.round((x.unitPrice / x.nv) * 100)}% (${x.unitArea}㎡ 원가 하한 ${ZF.cash(x.floor)} · 비율은 작성자 가정값)</small></dd>\n        <dt>신축 시세</dt><dd>${ZF.cash(x.nv)} <small>${x.nvFix ? "구축 ㎡단가 × 1.15로 보정 · " : ""}${x.same ? `같은 평형(${x.unitArea}㎡) 환산 · ` : ""}${esc(x.ref?.scope || "")} 2016년 이후 준공 ${x.ref?.n || ""}건${x.ref?.complexes ? " · " + x.ref.complexes.slice(0, 2).map(esc).join(", ") : ""}</small></dd>\n        <dt>세금·이자 (입주까지)</dt><dd>${ZF.cash(ti)} <small>${tiParts(x)}</small></dd>\n        <dt>입주까지 들어가는 돈 합계(잔금대출 빼기 전)</dt><dd>${ZF.cash(x.total)} <small>매수가 + 취득세 + 분담금 + 세금·이자 (각 값은 반올림 전 합계)</small></dd>` : ""}\n      </dl>` : ""}\n      <div class="ov">\n        <label>매수가<span class="inp"><input inputmode="decimal" data-ov="price" data-id="${r.id}" value="${OV[r.id]?.price ?? ""}" placeholder="${x.price != null ? e2(x.price) : "예: 5"}"><span>억</span></span></label>\n        ${x.land != null ? `<label>대지지분${x.landDef ? ' <small class="lab-def">가정값 · 입력으로 수정</small>' : ""}<span class="inp"><input inputmode="decimal" data-ov="land" data-id="${r.id}" value="${OV[r.id]?.land ?? ""}" placeholder="${x.land}"><span>㎡</span></span></label>` : x.price != null ? `<label>감정가<span class="inp"><input inputmode="decimal" data-ov="appr" data-id="${r.id}" value="${OV[r.id]?.appr ?? ""}" placeholder="${e2(x.appr)}"><span>억</span></span></label>` : ""}\n      </div>\n    </div></details>`;
    const cap = `${esc(r.g)} ${esc(DUPN.has(shortName(r.n)) ? r.bj || r.j : (r.bj || r.j).split(" ")[0])} · ${esc(r.k.replace("(모아주택)", ""))}${(() => {
      const x = r.st ? stnInfo(r) : null;
      return !x ? "" : x.min > 20 ? ` · ${esc(x.n)}역 ${(x.d / 1e3).toFixed(1)}km` : ` · ${esc(x.n)}역 ${fmt(x.d)}m·도보 ${x.min}분`;
    })()}`;
    const keep =
      (lowPrem
        ? `<span class="chip-s warn" title="사업시행인가 이후인데 웃돈(프리미엄) 추정이 내 지분 값(권리가액)의 20% 미만이에요. 실제 매물가를 넣어 보세요.">매수가 낮게 잡혔을 수 있음</span>`
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
      return `<span class="iv-hj" title="1.5km 안 주변 호재 ${hs.length}건 · 리포트 '${(typeof TABS !== "undefined" && TABS.find((t) => t[0] === "near")?.[1]) || "주변"}' 탭"><i style="background:${h.h.c}" aria-hidden="true"></i>호재 ${hs.length} · ${esc(h.h.n.replace(/\s*\(.*\)$/, ""))} ${kmTxt(h.d)}</span>`;
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
      cashNote(`쉼표를 소수점으로 보고 ${ZF.cash(cv)}으로 계산했어요.`);
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
    return y >= 1 ? `${ZF.cash(y)}` : `${fmt(Math.round((y * 1e4) / 100) * 100)}만`;
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
          ? `10년 내 준공 ${probTxt(x.r.eta.p10)}`
          : "";
  const cheapSentence = (x, need, lab) =>
    `가장 적게 드는 곳은 <b>${esc(shortName(x.r.n))}</b>, ${lab} <b>${ZF.cash(need)}</b>이에요${cheapFlag(x) ? ` <span class="flag">(${cheapFlag(x)})</span>` : ""}.`;
  // 내 핀 아이콘: 남색 물방울 핀 + 노란 점(public/icon.svg와 같은 모양)
  // 관심 구역 아이콘 = 하트 하나(17차: 탭·저장 버튼·목록 모두 같은 모양)
  const SVG_PIN = (on) =>
    `<svg class="pin-ic" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.4 7.2 4.4c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`;
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
      ? `<button type="button" class="favb ${cls}" data-fav="${r.id}" aria-pressed="${isFav(r.id)}" aria-label="${esc(shortName(r.n))} ${isFav(r.id) ? "관심 구역에서 빼기" : "관심 구역에 추가하기"}">${SVG_PIN(isFav(r.id))}<span>${isFav(r.id) ? "관심 구역에 있어요" : "관심 구역에 추가"}</span></button>`
      : "";
  const BLOG_URL = "https://blog.naver.com/always_questions";
  const leadCard = (cls = "") =>
    MO
      ? `<aside class="lead ${cls}" aria-label="월간 단계 변경 리포트"><div class="ld-t"><b>${moLabel()}에 서울 정비사업 인가 ${MO.items.length}건(구역 ${new Set(MO.items.map((x) => x.id)).size}곳)</b><p>매달 추진위 승인·구역지정·조합설립·사업시행·관리처분 인가가 난 구역을 원문 링크, 입주까지 현금과 함께 정리해요.</p><ul class="ld-p"><li>매달 발행</li><li>기사·고시 원문 대조</li><li>가입 없이 열람</li></ul></div><div class="ld-a"><a class="btn secondary sm" href="${MO.url}">최신 리포트 보기</a><small><a href="years">우리 단계는 몇 년 걸리나</a> · <a href="z/">구역별 페이지</a></small></div></aside>`
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
    if (w.cls === "no") return `지금 사면 입주권 없음 · ${w.due || ""}`.replace(/ · $/, "");
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
  // 곳 수는 홈 '갈 수 있는 곳'(affOk)과 같은 기준: 참고값(lc · 매수가 표본 부족) 구역은 세지 않는다
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
  // 30차: 합계 줄 = 보이는 칸(정확한 만 원)의 합 그대로 — '매수가 1.93 + … = 10.40억'인데 '합계 10.3억'이던 것
  function totSum(T, extra) {
    const M = (v) => Math.round((v || 0) * 1e4), E = (m) => ZF.exact(m / 1e4);
    const ms = T.map(([n, v]) => [n, M(v)]), sm = ms.reduce((a, [, m]) => a + m, 0);
    return `${E(sm)}<small>${ms.map(([n, m], i) => (m < 0 ? `${i ? "− " : "−"}${n} ${E(-m)}` : `${i ? "+ " : ""}${n} ${E(m)}`)).join(" ")}${extra ? " · " + extra : ""}</small>`;
  }
  function cashBr(x, g) {
    // 7차: 칸마다 정확한 만 원 · 합 = 보이는 칸의 합 = 계산식·합계 칸과 같은 값(머리 '입주까지 현금'을 0.1억 반올림한 값으로 '= 5.1억'이라 쓰고 위 칸은 올림이라 규칙이 둘이던 것)
    const M = (v) => Math.round((v || 0) * 1e4), E = (m) => (m <= 0 ? "0원" : ZF.exact(m / 1e4));
    const fl = g ? g.x.price + g.x.tax + g.x.contrib + g.x.origTax + g.x.midInt + g.intM - g.x.loanEnd : 0;
    if (g && g.now + g.reloc > fl + 0.05) { const a = M(g.now), b = M(g.reloc);
      return { s: null, html: `<p class="cash-br"><span>지금 <b>${E(a)}</b></span><span>+ 이주 때 <b>${E(b)}</b></span><span>= 입주까지 현금 <b>${ZF.cash(g.total)}</b> <small>(${E(a + b)})</small></span></p>` }; }
    const ti = g ? x.origTax + x.midInt + g.intM : x.origTax + x.interest + x.midInt;
    const s = M(x.price) + M(x.tax) + M(x.contrib) + M(ti), l = M(x.loanEnd), t = s - l;
    return { s: s / 1e4, html: `<p class="cash-br"><span>입주까지 들어가는 돈 <b>${E(s)}</b></span><span>− 입주 잔금대출 <b>${E(l)}</b></span><span>= 입주까지 현금 <b>${ZF.cash(g ? g.total : x.needTotal)}</b> <small>(${E(t)} · 0.1억 반올림 전)</small></span></p>` };
  }
  const taxT = (v) => (v != null && isFinite(v) && Math.abs(v) < 0.995 && Math.abs(v) >= 0.00005 ? Math.round(v * 1e4).toLocaleString("ko-KR") + "만" : ZF.cash(v));   // 취득세는 작아 만 원 단위 그대로
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
    const s1 = `<li class="gt1"><span class="gt-w">지금 · 매수</span><b>${ZF.cash(g.now)}</b><small>매수가 ${ZF.exact(x.price)} − 전세 ${ZF.exact(g.D)} + 취득세 ${ZF.exact(x.tax)}</small></li>`;
    const s2 =
      x.ok && g.reloc < 0.05
        ? `<li class="gt2 z"><span class="gt-w">이주 · ${yrTxt(g.tR)}${g.tR != null && g.tR <= 4 ? " 무렵" : ""}</span><b class="z0">이주비 대출로 전세금 반환</b><small>이주비 대출 ${ZF.cash(g.M)}으로 전세금 ${ZF.cash(g.D)} 반환 · 추정 · 입주 때 상환</small></li>`
        : x.ok
          ? `<li class="gt2"><span class="gt-w">이주 · ${yrTxt(g.tR)}${g.tR != null && g.tR <= 4 ? " 무렵" : ""}</span><b>+${ZF.cash(g.reloc)}</b><small>전세금 ${ZF.cash(g.D)} 반환${g.M > 0.04 ? ` − 이주비 대출 ${ZF.cash(g.M)}(추정·입주 때 상환)` : g.Mcap === 0 ? " · 다주택은 이주비 대출 불가" : ""}</small></li>`
          : `<li class="gt2 na"><span class="gt-w">이주</span><b>+${ZF.cash(g.D)}</b><small>전세금 반환 · 이주비 대출로 일부 충당 가능(조합·규제에 따라 다름)</small></li>`;
    const s3 = x.ok
      ? `<li class="gt3"><span class="gt-w">입주 · ${etaShow(g.r)}${(() => { const pr = projection(g.r); return pr.stall || pr.nodata ? " (계산용 가정)" : ""; })()}</span><b>${ZF.cash(g.total)}</b><em class="gt-l">${LBL.cashToMoveIn}</em><small>${small ? `${LBL.cashToMoveIn} = 분담금·세금·이자 − 잔금대출` : `${LBL.cashToMoveIn} = 분담금·세금·이자 − 잔금대출 · 참고: 현금으로 사면 ${ZF.cash(x.needTotal)}(매수대출 이자 대신 이주비 이자라 차이)`}</small></li>`
      : `<li class="gt3 na"><span class="gt-w">입주</span><b>계산 전</b><small>입주 시점·신축 시세 자료가 부족해요</small></li>`;
    return `<ol class="gtl${small ? " sm" : ""}">${s1}${s2}${s3}</ol>`;
  }
  function gapGainTxt(g) {
    const x = g.x;
    if (!x.ok) return x.nvThin ? "입주 때 시세 차이: 신축 시세 표본 부족" : "입주 때 시세 차이: 계산 전";
    const gg = g.gain,
      ann = x.annual != null ? ` · 추정 이율(가정) ${pcIrr(x.annual)}(현금으로 샀을 때)` : "";
    if (gg <= -0.3) return `시세 그대로면 손실 예상 <b>${sg(gg)}</b>${ann}`;
    if (gg < 0.3) return `시세 그대로면 차익 거의 없음 (${sg(gg)})${ann}`;
    return `입주 때 시세 차이 <b>${sg(gg)}</b> (시세 상승 0% 가정)${ann}`;
  }
  function gapCard(g) {
    const r = g.r,
      cap = `${esc(r.g)} ${esc((r.bj || r.j || "").split(" ")[0])} · ${esc(stageName(r))}`;
    const w = buyWindow(r);
    return `<article class="iv gp" data-card="${r.id}" tabindex="0" aria-label="${esc(shortName(r.n))} 리포트 열기">\n    <div class="iv-h"><div class="nm"><h3 title="${esc(shortName(r.n))}">${esc(shortName(r.n))}</h3><p class="cap">${cap}</p></div><div class="iv-hr">${favBtn(r, "sm ic")}</div></div>\n    <div class="iv-chips"><span class="io ${w.cls}" title="${esc(w.d)}">${esc(w.t)}</span><span class="jr-c" title="전세가 = 매수가 × 전세가율 (${esc(jrSrcTxt(r))}) · 리포트에서 실제 전세금 입력 가능">${g.userJ ? `전세 ${ZF.cash(g.D)} (입력)` : `전세 ${ZF.cash(g.D)} · 가정 ${fmt(g.jr, 1)}%`}</span></div>\n    ${gapTL(g, true)}\n    <p class="gp-gain ${g.x.ok && g.gain >= 0.3 ? "up" : g.x.ok && g.gain <= -0.3 ? "dn" : ""}">${gapGainTxt(g)}</p>\n  </article>`;
  }
  const rng = (a) => {
    const v = a.filter((x) => x != null && isFinite(x)).sort((p, q) => p - q);
    if (!v.length) return null;
    const lo = ZF.cash(v[0]),
      hi = ZF.cash(v[v.length - 1]);
    return lo === hi ? lo : `${lo}~<wbr>${hi}`;
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
    `<span class="zb est" title="주변 빌라 실거래가 적어, 같은 구(${esc(r.g)}) 다른 구역 주변 빌라 실거래 가운데 값 ${ZF.cash(OV[r.id].price)}을 매수가로 넣은 추정이에요(구역 ${EST_N[r.g] || 0}곳의 가운데 값). 실제 매물가와 다를 수 있어요.">구 평균 시세로 추정</span>`;
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
      p != null ? `10년 준공 ${probTxt(p)}` : "준공 확률 산정 전",
    ].join(" · ");
    const tot = o.tot != null ? `<b class="zc-big">${uI(ZF.cash(o.tot))}</b>` : `<b class="zc-big na">계산 전</b>`;
    const over = o.tot != null && o.tot > CASH + 1e-9 ? `<span class="zc-more">입주까지 내 돈보다 ${ZF.gap(o.tot, CASH)} 더</span>` : "";
    return `<article class="zc" data-card="${r.id}">\n    <div class="zc-1"><h3 title="${esc(r.n)}">${esc(shortName(r.n))}</h3><span class="zc-loc">${loc}</span>${stagePill(r)}</div>\n    <div class="zc-2"><span class="zc-k">③ ${LBL.cashToMoveIn}</span>${tot}<span class="zc-now">① 지금 <b>${o.now != null ? ZF.cash(o.now) + "" : "–"}</b></span>${over}</div>\n    <div class="zc-3">${pub}${loss}${rent}${early ? early + " " : ""}${meta}</div>\n    <div class="zc-act">${favBtn(r, "sm ic")}${o.badge || ""}<button type="button" class="go" data-open="${r.id}">리포트<span class="sr-only">: ${esc(shortName(r.n))}</span> <span aria-hidden="true">→</span></button></div>\n  </article>`;
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
      `${base} <b>${fmt(nAll)}곳</b>${nFit != null ? (nFit ? `<span class="rt-f"> · 입주까지 되는 곳 <b>${fmt(nFit)}곳</b></span>` : `<span class="rt-f rt-0"> · 입주까지 ${ZF.cash(CASH)} 안에 끝나는 곳은 아직 없어요</span>`) : ""}${LF ? `<span class="rt-f"> · ${LF_LAB[LF]} ${fmt(nShown)}곳</span>` : ""}`;
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
          lab: `전세 끼고 <b>${ZF.cash(CASH)}</b>으로 지금 갈 수 있는 곳`,
          side: estN ? `추정 구역 ${fmt(estN)}곳 포함` : "",
          t1: rng(ok.map((g) => g.now)),
          s1: "매수가 − 전세금 + 취득세",
          t2: withTot.length && withTot.every((g) => g.reloc < 0.05) ? "추가 없음" : rng(withTot.map((g) => g.reloc)),
          t2z: withTot.length && withTot.every((g) => g.reloc < 0.05),
          s2: (() => {
            const ex = withTot.length ? Math.max(...withTot.map((g) => (g.relocAlt ?? g.reloc) - g.reloc)) : 0;
            return "전세금 반환 − 이주비 대출(추정)" + (ex >= 0.05 ? ` · 대출을 감정가 기준으로만 잡으면 최대 ${ZF.cash(ex)} 더` : "");
          })(),
          t3: rng(withTot.map((g) => g.total)),
          s3: cheap ? `가장 적은 곳 ${esc(shortName(cheap.r.n))} ${ZF.cash(cheap.total)}` : "입주까지 계산된 곳 없음",
          honest: `전세를 끼면 지금 드는 돈은 줄지만, 이주 때 전세금을 돌려줘야 해서 ${LBL.cashToMoveIn}은 현금으로 살 때와 비슷해요.${withTot.length < ok.length ? ` ${fmt(ok.length - withTot.length)}곳은 입주 시점·신축 시세 자료가 부족해 ③을 계산하지 않았어요.` : ""}`,
          empty: `<div class="pa-empty"><p>전세 끼고 ${ZF.cash(CASH)}으로 지금 갈 수 있는 곳이 아직 없어요.${nextLv ? ` ${nextLv[0]}억이면 ${fmt(nextLv[1])}곳이에요.` : ""}</p></div>`,
          alt:
            !ok.length && nextLv
              ? `<button type="button" class="btn secondary" data-cash="${nextLv[0]}">${nextLv[0]}억으로 보기</button>`
              : "",
        }),
      );
    });
    setMore(
      `<div class="pm-lv"><p class="pm-h">금액별 전세 끼고 갈 수 있는 곳</p><div class="gap-lv" role="group" aria-label="금액별 전세 끼고 갈 수 있는 곳">${lv.map(([c, n]) => `<button type="button" data-cash="${c}" aria-pressed="${Math.abs(c - CASH) < 1e-9}"><span>${c}억</span><b>${fmt(n)}곳</b></button>`).join("")}</div></div>\n      ${blocked.length ? `<p class="pm-p">금액으로는 되지만 토지거래허가(실거주 2년)·입주권 문제로 전세를 끼고 살 수 없는 곳 <b>${fmt(blocked.length)}곳</b>은 목록 아래에 따로 모았어요.</p>` : ""}\n      <ul class="gap-as">\n        <li>전세가 = 매수가 × 전세가율 (${P.jr != null ? `직접 설정 ${fmt(P.jr, 1)}%` : `구역 경계 안 실거래로 전세가율을 구할 수 있는 곳은 그 값, 나머지는 서울 연립·다세대 평균 ${JR_SEOUL}%(도봉 83.7·강서 76.6·금천 70.3·종로 65.6%는 자치구 값, 2026.3)`}). 노후 빌라는 실제 전세가율이 더 낮은 경우가 많아요 → 리포트에서 실제 전세금을 넣어 보세요.</li>\n        <li>제외: 토지거래허가(실거주 2년)로 전세 낀 매수가 막힌 곳, 입주권이 안 나오는 곳, 이주·철거가 시작된 곳${P.est ? "" : ", 주변 빌라 거래가 적어 매수가를 못 정한 곳(조건 더 보기 → 추정 구역 포함)"}.</li>\n        <li>이주비 대출 = min(전세금, 6억, 40% × max(종전자산평가액, 조합원 분양가)) · 다주택은 0 · 조합·은행에 따라 다름 (추정).</li>\n        <li>이주 시점 = 예상 입주 − 착공→준공 가운데 값 ${CJ().toFixed(1)}년 (추정) · 이주비 대출 이자는 이주~입주 동안.</li>\n        <li>취득세는 보유 주택 수 기준 · 매수 대출 없음 · 시세 상승 0% 가정 · 투자 권유 아님.</li>\n      </ul>\n      <p class="gap-src">출처: ${GAP_SRC.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(t)}</a>`).join(" · ")}</p>`,
      "금액별 곳 수·가정·출처",
    );
    $("qAns").innerHTML =
      `<span>전세 끼고 ${ZF.cash(CASH)}이면 <b>${fmt(ok.length)}곳</b></span><a href="#maxBox" class="qa-go">결과 보기</a>`;
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
      `전세 끼고 ${ZF.cash(CASH)}으로 지금 계약할 수 있는 구역`,
      ok.length,
      fl.length,
      withTot.filter((g) => g.total <= CASH + 1e-9).length,
    );
    {
      const mn = withTot.length ? Math.min(...withTot.map((g) => g.total)) : null,
        fit = withTot.filter((g) => g.total <= CASH + 1e-9).length;
      $("resSub").textContent =
        (!fit && mn != null ? `입주까지 가려면 가장 적은 곳도 약 ${ZF.cash(mn)}이 들어요 · ` : "") +
        `'입주까지 되는 곳'은 이주 때 전세금 반환과 분담금까지 ${ZF.cash(CASH)} 안에 드는 곳이에요 · 추정치${num("pIncome") == null ? " · 연소득 미입력이라 잔금대출을 최대로 잡았어요" : ""}`;
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
          `${!shown.length ? `<div class="t-empty"><b>${LF ? `${LF_LAB[LF]} 중에는 없어요` : `전세 끼고 ${ZF.cash(CASH)}으로 갈 수 있는 곳이 아직 없어요`}</b><p>${LF ? "유형 거르기를 풀어 보세요." : "금액을 올리거나 전세가율을 바꿔 보세요."}</p></div>` : ""}${fl.length > planN ? `<button type="button" class="btn-more" id="planMore">${fmt(Math.min(12, fl.length - planN))}곳 더 보기 · 남은 ${fmt(fl.length - planN)}곳</button>` : ""}\n    ${
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
    if (noTicket(r)) return "";   // 입주권이 안 나오는 구역: 머리 '지금 사면 새 아파트 입주권이 안 나와요'가 말한다(여기 '(입주권 매수)'와 엇갈렸다)
    if (g.block) {
      // 전세 끼고는 안 되면 대출 끼고 사는 길을 바로 보여 준다
      let alt = "";
      try { const x = investC(r); if (x && x.needBuy != null && !r.lc && r.tag !== "mk") alt = `<b class="gb-alt">대출 끼고 사면 지금 ${ZF.cash(x.needBuy)}${x.ok && !noTicket(r) ? ` · 입주까지 ${ZF.cash(x.needTotal)}` : ""}</b>`; } catch (e) {}
      return `<p class="cstrip gblock"><span>전세 끼고 사기 <b class="gb-t">불가</b></span>${alt}<small>${esc(g.block)}</small></p>`;
    }
    if (g.na)
      return `<p class="cstrip na"><span>전세 끼고 지금 필요한 돈</span><b>–</b><small>${noPriceTxt(r)}</small></p>`;
    return `<div class="cstrip gstrip ${CASH - g.now >= -0.05 ? "ok" : "short"}"><span>전세 끼고 사면${isEst(r) ? `<span class="zb est">구 평균 시세로 추정${P.est ? "" : " · 곳 수 제외"}</span>` : ""}</span><b>${g.now <= CASH + 0.05 ? `지금 ${ZF.cash(g.now)}이면 계약 가능` : `지금 ${ZF.cash(g.now)} 필요 <em class="gs-sh">${ZF.gap(g.now, CASH)} 모자라요</em>`}</b><small class="gs-2">${g.x.ok ? `입주까지 현금 ${ZF.cash(g.total)}${g.total > CASH ? ` · 내 돈 ${ZF.cash(CASH)} 빼면 ${ZF.gap(g.total, CASH)} 더` : ""}` : "입주까지는 계산 전"}</small></div>`;
  }
  function gapFrame(g) {
    const ok = g.now <= CASH + 1e-9;
    const a = ok
      ? `지금 ${ZF.cash(g.now)}이면 계약 가능(내 돈 ${ZF.cash(CASH)} 안)`
      : `지금 ${ZF.cash(g.now)} 필요 · 내 돈보다 ${ZF.gap(g.now, CASH)} 부족`;
    if (!g.x.ok) return `${a} · 입주까지는 계산 전`;
    return `${a} · 입주까지 현금 ${ZF.cash(g.total)}${g.total > CASH ? ` → 입주 전까지 ${ZF.gap(g.total, CASH)} 더 필요` : ""}`;
  }
  function gapPaneHTML(r) {
    const g = gapOf(r);
    if (g.block || g.na)
      return g.block && g.block !== "계산 대상 아님"
        ? `<div class="gpane"><p class="note riskbox"><b>전세 끼고 사기 불가</b> ${esc(g.block)}</p></div>`
        : "";
    return `<div class="gpane"><h3>전세 끼고 사면 <small>언제 얼마가 필요한지</small></h3>\n    ${/공공재개발/.test(r.n) ? '<p class="note riskbox"><b>먼저 확인</b> 공공재개발 후보지 상당수가 토지거래허가구역으로 지정돼 왔어요(2026년 1월까지 확인). 지금도 지정돼 있으면 실거주 의무 때문에 전세 끼고 사기가 어려워요. 계약 전 구청에 지정 여부를 물어보세요.</p>' : ""}\n    ${gapTL(g, false)}${g.x.ok ? cashBr(g.x, g).html : ""}${g.relocAlt != null && g.relocAlt - g.reloc >= 0.05 ? `<p class="t-note">${g.reloc < 0.05 ? "위 이주 칸은 이주비 대출로 전세금을 다 돌려준다고 본 값이에요." : `위 이주 때 +${ZF.cash(g.reloc)}는 이주비 대출을 넉넉히 잡은 값이에요.`} 이주비 대출을 감정가만 기준으로 잡으면 이주 때 ${ZF.cash(g.reloc < 0.05 ? g.relocAlt : g.relocAlt - g.reloc)}이 더 들어요 · 조합·은행마다 기준이 달라요.</p>` : ""}\n    <p class="gap-honest">${gapLine}</p>\n    <div class="gj-f"><label for="gJ">이 매물 전세금 <small>${g.userJ ? "직접 입력" : `기본 = 매수가 × ${fmt(g.jr, 1)}% (${esc(jrSrcTxt(r))})`}</small></label><div class="inp"><input id="gJ" inputmode="decimal" placeholder="${e2(g.D)}" value="${OV[r.id]?.jeonse ?? ""}"><span>억</span></div>${g.userJ ? '<button type="button" class="btn text sm" id="gJx">초기화</button>' : ""}</div>\n    <p class="t-note">이주비 대출·이주 시점은 추정(조합·은행에 따라 다름) · 입력값 기준 계산</p></div>`;
  }
  function gapBigrow(r) {
    const g = gapOf(r),
      p = $("pane");
    if (g.block || g.na || !g.x.ok) return;
    const c = p.querySelector(".bigrow .big.cash");
    if (c)
      c.outerHTML = `<div class="big cash"><span>전세 끼고 입주까지 현금</span><b>${ZF.cash(g.total)}</b><small>${esc(gapFrame(g))}</small></div>`;
    const gn = p.querySelector(".bigrow .big.gain");
    if (gn)
      gn.outerHTML = `<div class="big gain ${g.gain >= 0.05 ? "up" : g.gain <= -0.05 ? "dn" : ""}"><span>입주 때 시세 차이 (전세 끼고 산 경우·추정)</span><b>${sg(g.gain)}</b><small>${g.gain > -0.3 && g.gain < 0.3 ? "시세 그대로면 차익 거의 없음 · " : ""}${g.x.annual != null ? `추정 이율(가정) ${pcIrr(g.x.annual)}(현금으로 샀을 때) · ` : ""}추정 · 시세 상승 0% 가정</small></div>`;
    // 비례율 표도 위 큰 숫자와 같은 '전세 끼고' 기준(차이 = 매수대출 이자 대신 이주비 이자 · 비례율과 무관한 상수)
    const sb = $("mSens");
    if (sb && isFinite(g.x.gain)) {
      const dg = g.gain - g.x.gain, cap = sb.closest(".sect") && sb.closest(".sect").querySelector("h3 small");
      if (cap) cap.textContent = "전세 끼고 산 경우 · 나머지 조건 고정";
      sb.querySelectorAll("tr").forEach((tr) => {
        const v = parseFloat(tr.cells[0].textContent), save = AV.aRatio;
        AV.aRatio = v; const y = invest(r); AV.aRatio = save;
        const gg = y.gain + dg, sp = tr.cells[1].querySelector("span:last-child");
        if (sp) { sp.textContent = `${sg(gg)}`; sp.className = gg >= 0.05 ? "up" : gg <= -0.05 ? "dn" : ""; }
      });
    }
    // 다리 줄·합계·세금이자 칸도 '전세 끼고' 숫자로(위 타임라인 '총'과 같은 값)
    const br = cashBr(g.x, g), bw = p.querySelector(".cash-brw");
    if (bw) { bw.innerHTML = br.html; bw.hidden = !!p.querySelector(".gpane .cash-br"); }   // 위 타임라인 밑에 이미 있으면 한 번만
    const ftot = p.querySelector(".fx-tot dd"), fti = p.querySelector(".fx-ti dd"), flo = p.querySelector(".fx-loan");
    if (flo) flo.style.display = "none";   // 29차: 전세 끼고 계산식엔 매수 대출이 없다(지금 = 매수가 + 취득세 − 전세)
    if (ftot && br.s != null) ftot.innerHTML = totSum([["매수가", g.x.price], ["취득세", g.x.tax], [g.x.contrib < 0 ? "환급" : "분담금", g.x.contrib], ["세금·이자", g.x.origTax + g.x.midInt + g.intM]], "전세 끼고 산 경우");
    if (fti) fti.innerHTML = `${ZF.exact(g.x.origTax + g.x.midInt + g.intM)}<small>원시취득세 ${won(g.x.origTax)} · 중도금 이자 ${won(g.x.midInt)} · 이주비 대출 이자 ${won(g.intM)} (전세 끼고 산 경우)</small>`;
    const fl = p.querySelector("details.flow");
    if (fl)
      fl.innerHTML = `<summary><b>계산식 (전세 끼고)</b></summary><p>${esc(gapFlow(g))}</p>`;
  }
  // 30차: 전세 끼고 계산식 — 칸마다 정확한 만 원 · 합 = 보이는 칸의 합(매수가를 올려 '2억'으로 쓰던 것 · 머리 '1억 9,300만'과 같은 값)
  function gapFlow(g) {
    const M = (v) => Math.round((v || 0) * 1e4), E = (m) => (m <= 0 ? "0원" : ZF.exact(m / 1e4)), x = g.x;
    const p = M(x.price), t = M(x.tax), d = M(g.D), mm = M(g.M), now = p + t - d, rl = d - mm;
    const c = M(x.contrib), ti = M(x.origTax + x.midInt + g.intM), le = M(x.loanEnd);
    const nh = ZF.cash(g.now), th = ZF.cash(g.total), note = (v, h, lab) => (E(v) !== h ? ` (${lab} ${h}은 ${lab === "위 지금" ? `${h.endsWith("만") ? "100만" : "0.1억"} 단위로 올림한 값` : "0.1억 단위로 반올림한 값"})` : "");   // 7차: 지금은 화면 올림 · 입주까지 현금은 엔진 0.1억 반올림(g.total) — 실제 규칙대로
    const one = `① 지금 = 매수가 ${E(p)} + 취득세 ${E(t)} − 전세 ${E(d)} = ${E(now)}${note(now, nh, "위 지금")}`;
    const two = `② 이주 = 전세 ${E(d)} − 이주비 대출 ${E(mm)} = ${E(rl)}`;
    const fl = p + t + c + ti - le;
    const three = g.now + g.reloc > (x.price + x.tax + x.contrib + x.origTax + x.midInt + g.intM - x.loanEnd) + 0.05
      ? `③ ${LBL.cashToMoveIn} = ① ${E(now)} + ② ${E(rl)} = ${E(now + rl)}${note(now + rl, th, LBL.cashToMoveIn)}`
      : `③ ${LBL.cashToMoveIn} = 매수가 ${E(p)} + 취득세 ${E(t)} ${c < 0 ? `− 환급 ${E(-c)}` : `+ 분담금 ${E(c)}`} + 원시취득세·중도금 이자·이주비 이자 ${E(ti)} − 잔금대출 ${E(le)} = ${E(fl)}${note(fl, th, LBL.cashToMoveIn)}`;
    return `${one} · ${two} · ${three}`;
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
    { const t = stale ? `입력값을 확인하세요 · 아래 결과는 마지막 유효값 ${ZF.cash(lastValidCash)} 기준` : ""; if ($("staleNote").textContent !== t) $("staleNote").textContent = t; }   // 26차: 숨은 상태 알림에 지난 글이 남지 않게(화면 읽기)
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
      `${sg(z.gain)} <span class="est2">(추정·시세 상승 0% 가정)</span> · 연 ${pcIrr(z.annual)} · 준공 ${probTxt(z.r.eta?.p10)}`;
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
          ? `<p class="ans-cap">연소득 미입력 → DSR 미반영 · ${ok.length ? "이 구역들은" : "이 구역은"} ${usedEnd ? "입주 잔금대출" : "대출"} 최대 ${ZF.cash(usedLoan)} 가정 (${ZF.cash(usedLoan)} 받으려면 연소득 약 ${incTxt(usedLoan)} 필요)</p>`
          : "";
    const revert =
      PREV_CASH != null && PREV_CASH !== CASH
        ? `<button type="button" class="btn text sm rev" data-cash="${PREV_CASH}" data-rev="1">← ${ZF.cash(PREV_CASH)}으로 되돌리기</button>`
        : "";
    document.querySelector(".cashfig figcaption b").textContent = `현금별로 ${basisLab} 가능한 구역 수`;
    const maxLine = `최대 매수가 ${ZF.cash(MAXP)} (대출 ${ZF.cash(ln)} · 매수가 전액을 담보로 인정할 때)`;
    const gapN = gapCount(CASH),
      gapCta =
        gapN > ok.length
          ? `<button type="button" class="btn primary gapcta" data-fundset="gap">전세 끼고 사면 ${ZF.cash(CASH)}으로 ${fmt(gapN)}곳 보기 →</button>`
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
      if (gapN > 0) acts.push({ label: `전세 끼고 사면 ${ZF.cash(CASH)}으로 ${fmt(gapN)}곳 보기 →`, attr: 'data-fundset="gap"' });
      if (n59) acts.push({ label: "59㎡로 보기", n: n59, attr: 'data-alt="unit59"' });
      if (nBoth > n59) acts.push({ label: "생애최초 대상이면 · 59㎡", n: nBoth, attr: 'data-alt="both"' });
      if (nFirst) acts.push({ label: "생애최초 대상이면", n: nFirst, attr: 'data-alt="first"' });
      if (cheapest) {
        const cc = Math.ceil(needOf(cheapest) * 10) / 10,
          fl = cheapFlag(cheapest);
        acts.push({
          label: `${ZF.cash(cc)}이면 어떻게 되나 보기${fl ? ` <small class="flag">${fl} 구역</small>` : ""}`,
          attr: `data-cash="${cc}"`,
        });
      }
      if (P.basis === "total" && (n = computeOk({ P: { basis: "now" } })))
        acts.push({ label: "매수까지만 보기 (입주까지는 부족)", n, attr: 'data-alt="now"' });
      acts.forEach((a, i) => {
        a.primary = i === 0;
      });
      empty = `<div class="pa-empty"><p>${cheapest ? cheapSentence(cheapest, needOf(cheapest), P.basis === "total" ? "입주까지" : "지금") : ""}${profitMin ? ` 수익이 계산되는 곳 중에서는 <b>${esc(shortName(profitMin.r.n))}</b> ${ZF.cash(needOf(profitMin))}부터예요.` : ""}${P.homes === 3 || P.homes === 2 ? " 규제지역 다주택은 주담대가 막혀(LTV 0%) 현금이 많이 필요해요." : ""}</p></div>`;
      alt = `<div class="es-acts">${acts.map((a) => `<button type="button" class="btn ${a.primary ? "primary" : "secondary"}" ${a.attr}>${a.label}${a.n != null ? ` <b>${fmt(a.n)}곳</b>` : ""}</button>`).join("")}</div>`;
      qa = `${basisLab} <b>0곳</b>${cheapest ? ` · 가장 적게 드는 곳 ${ZF.cash(needOf(cheapest))}` : ""}`;
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
          lab: `현금 <b>${ZF.cash(CASH)}</b>으로 ${P.basis === "total" ? "입주까지 감당할 수 있는 곳" : "지금 갈 수 있는 곳"}${revert}`,
          side: estN ? `추정 구역 ${fmt(estN)}곳 포함` : "",
          t1: rng(ok.map((x) => x.needNow)),
          s1: "매수가 + 취득세 − 매수 대출",
          t2: "추가 없음",
          t2z: true,
          s2: "돌려줄 전세금 없음 · 분담금은 입주 때",
          t3: rng(okT.map((x) => x.needTotal)),
          s3: cheapT ? `가장 적은 곳 ${esc(shortName(cheapT.r.n))} ${ZF.cash(cheapT.needTotal)}` : "입주까지 계산된 곳 없음",
          honest: `③은 분담금·세금·이자를 더하고 입주 잔금대출을 뺀 추정치예요 · 시세 상승 0% · 대출 한도는 현행 규제 기준${inc == null ? " · 연소득을 넣으면 DSR까지 반영" : ""}.`,
          empty,
          alt: ok.length && ok.length < 20 && gapCta ? gapCta.replace("btn primary gapcta", "btn secondary gapcta") : alt,
        }) + (ok.length ? "" : ""),
      );
      $("maxBox").setAttribute("aria-disabled", String(stale));
    });
    const next = TOP
      ? `<button type="button" class="ans-top" data-go="${TOP.r.id}"><span><span class="t1">추정 이율(가정) 3%·준공 30% 넘는 곳 중 첫 번째</span><span class="t2">${esc(shortName(TOP.r.n))}</span><span class="t3">${zline(TOP)}${tightTxt(TOP)}</span></span><span class="go">보기 →</span></button>`
      : unlock
        ? `<div class="ans-next"><p>추정 이율(가정) 3%·10년 내 준공 30%를 넘는 곳은 <b>${ZF.cash(unlockCash)}</b>부터 나와요 · 서울 전체 ${fmt(passAll)}곳<small>${esc(shortName(unlock.r.n))} · ${zline(unlock)}</small></p><div class="ans-acts"><button type="button" class="btn secondary sm" data-cash="${unlockCash}">${ZF.cash(unlockCash)}이면 어떻게 되나 보기</button></div></div>`
        : "";
    setMore(
      `${dsrWarn}<div class="ans-row${passN ? "" : " one"}">\n      ${passN ? `<div><span>추정 이율(가정) 3%·준공 30% 넘는 곳</span><b class="okc">${fmt(passN)}곳</b><small>추정 이율(가정) 3%↑ · 10년 안 준공 가능성 30%↑</small></div>` : ""}\n      <div><span>${otherTxt}</span><b>${fmt(otherN)}곳</b><small>${maxLine}</small></div>\n    </div>${next}`,
      "대출·기준·다음 금액·현금별 곳 수",
    );
    $("qAns").innerHTML = `<span>${ZF.cash(CASH)}이면 ${qa}</span><a href="#maxBox" class="qa-go">결과 보기</a>`;
    LADDER_ARGS = [all, needOf];
    drawLadder(all, needOf);
    NEED = new Map(all.map((x) => [x.r.id, needOf(x)]));
    XOF = new Map(all.map((x) => [x.r.id, x]));
    $("condSum").textContent = condText();
    const uTxt = num("aUnit") != null ? `신축 시세의 ${num("aUnit")}%` : "신축 시세에 따라 75%→42% (84㎡ 원가 하한 7억 · 59㎡ 5.2억)";
    $("resNoteList").innerHTML =
      `\n      <li>매수가: 구축 빌라 또는 해당 단지의 국토부 실거래(서울 부동산정보광장, 계약 2025.10.1~2026.9.26) 가운데 값 · 구역 안 → 같은 본번 → 반경 300~800m → 같은 동 → 같은 구 순서로 찾아요. 관리처분·이주 이후 구역은 입주권 호가 입력 필요${P.est ? " · 추정 구역은 같은 구 빌라 시세 가운데 값(구 평균 시세로 추정 배지)" : ""}</li>\n      <li>신축 시세: 반경 1.5km 안 2016년 이후 준공 아파트 ${P.unit}㎡ 실거래 가운데 값. 비교 거래 10건 미만이거나 84㎡가 59㎡보다 싸면 '표본 부족'으로 차익을 내지 않음</li>\n      <li>감정가: 빌라는 대지지분 × 공시지가 × 1.4(매수가의 95% 상한), 아파트는 세대당 대지지분 × 공시지가 × 1.35(시세의 75% 상한) · 내 지분 값(권리가액) = 감정가 × 비례율 · 계수는 작성자 가정값</li>\n      <li>조합원 분양가: ${esc(uTxt)} · 작성자 가정값</li>\n      <li>필요한 돈: 지금(매수가 + 취득세 − 매수대출) + 대출상환 + 분담금 + 세금·이자 − 입주 잔금대출(LTV ${Math.round(ltvEnd() * 100)}%${ltvEnd() ? "·가격구간 한도" : ""}${num("pIncome") != null ? "·DSR" : ""}) · 현행 규제(2025.10.16~) 기준</li>\n      <li>입주 시점·준공 확률: 서울 사업장 실제 인가일 생존분석. 해제 구역이 빠져 있어 다소 낙관적</li>\n      <li>${MISSING_COSTS}${num("pIncome") != null ? "" : " 연소득을 넣으면 DSR 한도 반영"}</li>`;
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
      afford ? `현금 ${ZF.cash(CASH)}으로 ${P.basis === "total" ? "입주까지 가능한" : "지금 계약할 수 있는"} 구역` : `${gu || "서울"} 구역`,
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
        : (_mn != null && isFinite(_mn) ? `입주까지 가려면 가장 적은 곳도 약 ${ZF.cash(_mn)}이 들어요 · ` : "") +
          "③ 총액 = 입주까지 현금(잔금대출 뺀 값) · ① = 지금 필요한 돈 · 추정치" +
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
          ? `<span class="zb warn" title="${esc(x.lowPrem ? "사업시행인가 이후인데 웃돈(프리미엄) 추정이 내 지분 값(권리가액)의 20% 미만이에요. 실제 매물가를 리포트에 넣어 보세요." : chkText(r))}">${x.lowPrem ? "매수가 확인 필요" : "단계 확인 중"}</span>`
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
          `${!shown.length && !earlyF.length ? `<div class="t-empty"><b>${LF ? `${LF_LAB[LF]} 중에는 없어요` : `현금 ${ZF.cash(CASH)}으로 ${basisLab} 가능한 곳이 아직 없어요`}</b><p>${LF ? "유형 거르기를 풀어 보세요." : "위 답 카드의 다음 금액이나 전세 끼고 보기를 눌러 보세요."}</p></div>` : ""}${mainF.length > planN ? `<button type="button" class="btn-more" id="planMore">${fmt(Math.min(12, mainF.length - planN))}곳 더 보기 · 남은 ${fmt(mainF.length - planN)}곳</button>` : ""}\n    ${earlyF.length ? `<details class="early" id="earlyBox"${mainF.length ? "" : " open"}><summary><b>입주 시점 미정</b><span class="cnt">${fmt(earlyF.length)}곳</span><small>입주 시점·매수가·신축 시세 표본이 없어 추정 수익률을 계산하지 않은 구역</small></summary><div class="zl" id="earlyList">${!mainF.length ? earlyF.slice(0, 24).map(card).join("") : ""}</div>${earlyF.length > 24 ? `<p class="early-more">외 ${fmt(earlyF.length - 24)}곳은 지도에서 확인</p>` : ""}</details>` : ""}`,
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
  /*Y*/
  function condText() {
    const homes = { 0: "무주택", 1: "1채·팔 거예요", 3: "1채 유지", 2: "2채 이상" }[P.homes];   // 23차: 첫 실행 질문과 같은 말(채)
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
      num("pIncome") != null ? (num("pIncome") > 0 ? `연소득 ${fmt(num("pIncome"))}만` : "연소득 없음(대출 0)") : null,
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
    // 설치 앱(html.is-tapp · 안드로이드 앱 등)에서는 광고 칸을 그리지도, adsbygoogle을 부르지도 않는다
    if (document.documentElement.classList.contains("is-tapp")) return;
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
    const pc = (v) => (v == null ? "–" : `${probTxt(v)}`);
    const eok = (v) => (v == null ? "–" : `${ZF.cash(v)}`);
    const tbl = (rows, cap) =>
      rows.length
        ? `<table class="sm-t"><caption class="sr-only">${cap}</caption><thead><tr><th scope="col">구역</th><th scope="col">단계</th><th scope="col" class="n">① 지금</th><th scope="col" class="n">③ 입주까지</th><th scope="col" class="n">10년 준공</th><th scope="col">입주(추정)</th><th scope="col">가까운 역</th></tr></thead><tbody>${rows.map((x) => `<tr><th scope="row">${esc(shortName(x.r.n))}<small>${esc(x.r.g)}</small></th><td>${esc(x.stg)}</td><td class="n">${eok(x.now)}</td><td class="n"><b>${eok(x.tot)}</b></td><td class="n">${pc(x.p10)}</td><td>${yr(x.eta)}</td><td>${esc(x.stn)}</td></tr>`).join("")}</tbody></table>`
        : "";
    const nowLab = gap ? "전세 끼고 지금 드는 돈(매수가 − 전세금 + 취득세)" : "지금 드는 돈(매수가 + 취득세 − 매수 대출)";
    return `<div class="sm-in">\n    <div class="sm-bar no-print"><button type="button" class="btn primary" id="svPrint">PDF로 저장 · 인쇄</button><button type="button" class="btn secondary" id="svClose">닫기</button><span class="sm-tip">인쇄 창에서 대상을 'PDF로 저장'으로 고르면 파일로 남아요</span></div>\n    <article class="sm-page" aria-labelledby="smT">\n      <header class="sm-h"><p class="sm-k">${BRAND} · 내 조건 한 장 요약</p><h2 id="smT">현금 ${ZF.cash(CASH)}으로 ${gap ? "전세 끼고 지금 갈 수 있는" : P.basis === "now" ? "지금 갈 수 있는" : "입주까지 감당할 수 있는"} 구역 <b>${fmt(ok.length)}곳</b></h2>\n        <p class="sm-c">${esc(condText())}</p>\n        <p class="sm-d">만든 날 ${today} · 데이터 기준 ${ASOF}</p></header>\n      ${top.length ? `<h3>${LBL.cashToMoveIn}이 적은 순 ${top.length < ok.length ? `상위 ${top.length}곳 <small>(전체 ${fmt(ok.length)}곳은 사이트에서)</small>` : `${top.length}곳`}</h3>${tbl(top, "조건에 맞는 구역")}` : `<p class="sm-empty">이 조건으로는 아직 맞는 구역이 없어요. 사이트의 답 카드에서 다음 금액이나 다른 조건을 확인해 보세요.</p>`}\n      ${fav.length ? `<h3>관심 구역 ${fav.length}곳</h3>${tbl(fav, "관심 구역")}` : ""}\n      <ul class="sm-n">\n        <li>① ${nowLab} · ③ 입주까지 현금(분담금·세금·이자 더하고 입주 잔금대출 뺀 값)</li>\n        <li>모두 추정치예요. 시세 상승 0% 가정 · 대출 한도는 현행 규제 기준 · 조합원 분양가·감정가 계수는 작성자 가정값</li>\n        <li>10년 준공 확률·입주 시점은 서울 사업장 실제 인가일 생존분석(해제 구역이 빠져 다소 낙관적)</li>\n        <li>투자 권유가 아니에요. 사기 전에 조합·구청 공고와 실제 매물가를 꼭 확인하세요.</li>\n      </ul>\n      <p class="sm-f">jaegaebal.alwaysquestions.kr</p>\n    </article></div>`;
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
  async function shareLink(url, fb, title = `${BRAND} · 서울 재개발 지도`) {
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
    // 주소 꼴 ?cash=1&mode=jeonse(리뉴얼 2단계): 금액·방식은 기본값이어도 늘 적는다 · 예전 fund=cash도 읽기는 한다(restoreURL)
    set("cash", lastValidCash, null);
    q.delete("fund");
    q.set("mode", P.fund === "cash" ? "loan" : "jeonse");
    set("homes", P.homes, 0);
    set("first", P.first ? 1 : "", "");
    set("unit", P.unit, 84);
    set("inc", $("pIncome").value.trim(), "");
    set("basis", P.basis, P.fund === "cash" ? "now" : "total");
    set("kind", P.kind, "");
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
      // 첫 실행 질문(shell.html #onb)이 떠 있는 동안은 저장하지 않는다(답하기 전 기본값이 '저장된 조건'으로 남지 않게)
      if (document.documentElement.classList.contains("onb-on")) return;
      try {
        history.replaceState(history.state, "", location.pathname + condQuery() + location.hash);
      } catch (e) {}
      try {
        localStorage.setItem("jg-cond", condQuery());
      } catch (e) {}
    }, 250);
  }
  // 4라운드: 뒤로 가기로 돌아간 칸의 주소(?cash=…)는 그 칸을 쌓을 때의 조건 → 지금 조건으로 다시 맞춘다(새로고침·앱 복원 때 고른 금액이 사라지지 않게)
  addEventListener("popstate", () => syncURL());
  function restoreURL() {
    let qs = location.search;
    if (!/[?&](cash|mode|fund|inc|income)=/.test(qs)) {
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
    const loanQ = q.get("mode") === "loan" || q.get("fund") === "cash";
    if (q.get("basis") === "now" || (loanQ && !q.has("basis"))) {
      P.basis = "now";
      setSeg("pBasis", "now");
    }
    const kd = q.get("kind");
    if (kd && ["재개발", "재건축", "가로·소규모"].includes(kd)) {
      P.kind = kd;
      setSeg("pKind", kd);
    }
    P.fund = loanQ ? "cash" : "gap";
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
    // 4라운드(설치 앱): 도구·탭 화면 자체로 가는 이동(콜드 해시 #rankHub 등)은 맨 위 — 앱바 아래 첫 블록이 바로 보이게(머리 높이 48px 내려가던 것)
    { const R = document.documentElement; if (R.classList.contains("is-tapp") && (t.classList.contains("s-on") || id === "saveTop" || "#" + id === window.ZP_H0)) { window.scrollTo({ top: 0, behavior: "auto" }); return; } }
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
      if ($("huFav")) $("huFav").classList.toggle("on", curRaw === "favTop");
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
    // ⋯ 메뉴는 없앴다(내용은 MY 화면으로) — 메뉴가 없으면 [data-menu] 링크 처리만 남긴다
    const btn = $("menuBtn"),
      pop = $("menuPop") || document.createElement("div"),
      bd = $("menuBd") || document.createElement("div");
    if (!btn) pop.hidden = true;
    const place = () => {
      if (!btn) return;
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
      if (!btn) return;
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
    if (btn) btn.onclick = (e) => {
      e.stopPropagation();
      open(pop.hidden);
    };
    bd.onclick = () => open(false);
    if ($("menuClose")) $("menuClose").onclick = () => {
      open(false);
      btn.focus({ preventScroll: true });
    };
    if (btn) document.addEventListener("keydown", (e) => {
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
      const save = { ...P }, gc0 = GCACHE, gk0 = GKEY;   // 지금 조건의 계산 캐시는 남겨 둔다(첫 화면이 같은 계산을 다시 하지 않게)
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
      GCACHE = gc0; GKEY = gk0;
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
        it.innerHTML = `계약할 때 드는 돈과 입주까지 드는 돈은 달라요. 전세 끼고 사도 입주까지는 가장 적은 곳이 약 <b>${ZF.cash(HOOK_MIN)}</b>이에요.`;
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
        ig.innerHTML = `<span class="ig-h">현금만, 입주까지</span>${[5, 7, 10].map((c) => `<a href="#planner" data-cashgo="${c}"><b>${c}억</b> ${fmt(HOOK_CASH[c].size)}곳</a>`).join("")}<span class="ig-n">입주까지 현금 기준 · 매수 대출 포함 · ${num("pIncome") != null ? `연소득 ${fmt(num("pIncome"))}만 반영` : "연소득 미입력(잔금대출 최대 가정)"}${HOOK_MIN != null ? `<br>전세 끼고 사도 입주까지는 가장 적은 곳이 약 <b>${ZF.cash(HOOK_MIN)}</b>이에요` : ""}</span>`;
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
  /*Y*/
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
  // plan()(입주 계산 화면 + 되는 구역 집합)·initIntro는 boot()에서 한 번 쉬고 — 앱 코드 실행 한 덩어리(1초+)를 나눈다(18차 성능)
  // 내 돈(CASH)만은 지금 정해 둔다(확장 모듈의 첫 그리기가 plan()보다 먼저 돌아도 같은 금액)
  readAV();
  { const c0 = readCash(); if (!(c0.bad || c0.big)) { CASH = c0.cv; lastValidCash = CASH; } }
  MAXP = maxBuy(CASH);
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
      b.setAttribute("aria-label", `${r ? shortName(r.n) : ""} ${on ? "관심 구역에서 빼기" : "관심 구역에 추가하기"}`);
      b.innerHTML = `${SVG_PIN(on)}<span>${on ? "관심 구역에 있어요" : "관심 구역에 추가"}</span>`;
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
      table = `<p class="fv-base">비교 기준: ${gapMode() ? "전세 끼고 " : "현금 "}${ZF.cash(CASH)}${num("pIncome") != null ? ` · 연소득 ${fmt(num("pIncome"))}만` : " · 연소득 미입력"} (계산기에 넣은 조건)</p>${84 + xs.length * 120 > 340 ? '<p class="fv-hint" aria-hidden="true">옆으로 밀어서 더 보기 →</p>' : ""}<div class="fv-tw"><table class="fv-t" style="min-width:${84 + xs.length * 120}px"><caption class="sr-only">관심 구역 나란히 보기</caption><thead><tr><th scope="col"><span class="sr-only">항목</span></th>${xs.map((o) => `<th scope="col"><button type="button" class="fv-open" data-open="${o.r.id}">${esc(shortName(o.r.n))}</button><small>${esc(o.r.g)} ${esc((o.r.bj || o.r.j || "").split(" ")[0])}</small></th>`).join("")}</tr></thead><tbody>\n      ${row("입주까지 현금", (o, i) => (cash[i] != null ? `<b>${ZF.cash(cash[i])}</b><small>${cash[i] <= CASH ? `내 돈 ${ZF.cash(CASH)}으로 가능` : `${ZF.gap(cash[i], CASH)} 부족`}</small>` : '<span class="mut">계산 불가</span>'), bc)}\n      ${
        gapMode()
          ? row("전세 끼고 지금 ①", (o) => {
              const g = gapOf(o.r);
              return g.block
                ? `<span class="mut">${esc(g.block)}</span>`
                : g.na
                  ? '<span class="mut">계산 불가</span>'
                  : `<b>${ZF.cash(g.now)}</b><small>${g.x.ok ? `이주 때 ${g.reloc < 0.05 ? "추가 없음(이주비 대출로 반환)" : `+${ZF.cash(g.reloc)}`} · ${LBL.cashToMoveIn} ${ZF.cash(g.total)}` : "입주까지 계산 전"}</small>`;
            })
          : ""
      }\n      ${row("매수가 기준", (o) => (o.x && o.x.price != null ? `${ZF.cash(o.x.price)}<small>${isEst(o.r || o.x.r) ? "구 평균 시세로 추정" : o.x.priceSrc === "user" ? "직접 입력" : o.x.priceSrc === "complex" ? "단지 실거래 가운데 값" : "주변 빌라 실거래 가운데 값"}</small>` : `<span class="mut">${noPriceTxt(o.r)}</span>`))}\n      ${row("단계", (o) => esc(stageName(o.r)))}\n      ${row("예상 입주", (o) => { const t = etaShow(o.r); return /^\d|20\d\d|년/.test(t) ? `${esc(t)}<small>계산용 추정</small>` : `<span class="mut">${esc(t)}</span>`; })}\n      ${row("토지거래허가", (o) => { try { const k = TOH.lookup(o.r), z = /주거용 필지 허가 ([\d,]+)건/.exec(k.t); return k.cls === "no" ? `<span class="io no">${z ? `허가 ${z[1]}건 · 실거주 2년` : "허가구역 · 실거주 2년"}</span>` : `<span class="io warn">구청 확인</span><small>${esc(k.t.split(" · ")[0])}</small>`; } catch (e) { return "–"; } })}\n      ${row("10년 안 준공 가능성", (o) => (o.r.eta?.p10 != null ? `${probTxt(o.r.eta.p10)}<small>추정</small>` : '<span class="mut">–</span>'), bp)}\n      ${row("가까운 역·도보", (o) => (o.s ? `${esc(o.s.n)}역 ${fmt(o.s.d)}m<small>도보 약 ${o.s.min}분 · 직선거리 기준</small>` : "–"), bw)}\n      ${row(
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
          title: "관심 구역",
          line: `관심 구역의 단계·신고가·지금 필요한 돈 변화를 모아 보고, 2~3곳을 나란히 비교해요.${FAV.length ? ` 지금까지 추가한 관심 구역 ${fmt(FAV.length)}곳은 그대로 남아 있어요.` : ""}`,
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
    <div class="t-acts pn-acts"><button type="button" class="btn text sm" id="fvClear">관심 구역 모두 빼기</button></div>`,
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
    // 출퇴근 화면이 안 보일 땐 셈을 미뤘다가 보이는 순간 한 번(renderSave와 같은 방식 · 첫 화면 긴 작업 줄이기)
    const cmSec = $("commuteTop");
    if (cmSec && !cmSec.getClientRects().length && window.ResizeObserver) {
      CM.dirty = true;
      if (!CM.ro) (CM.ro = new ResizeObserver(() => { if (CM.dirty && cmSec.getClientRects().length) { CM.dirty = false; runCommute(); } })).observe(cmSec);
      return;
    }
    CM.dirty = false;
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
            : `<span class="cm-m ${o.st}">전세 끼고 지금 <b>${ZF.cash(o.g.now)}</b>${o.g.x.ok ? ` · 입주까지 현금 ${ZF.cash(o.g.total)}` : ""}${o.st === "n" ? ` · ${ZF.gap(o.g.now, CASH)} 부족` : ""}</span>`
        : o.st === "y"
          ? `<span class="cm-m y">입주까지 현금 <b>${ZF.cash(x.needTotal)}</b> · 내 돈으로 가능</span>`
          : o.st === "n"
            ? `<span class="cm-m n">입주까지 현금 <b>${ZF.cash(x.needTotal)}</b> · ${ZF.gap(x.needTotal, CASH)} 부족</span>`
            : `<span class="cm-m u">${x.needBuy != null ? `지금 매수 ${ZF.cash(x.needBuy)} · 입주까지는 계산 전` : "시세 자료 부족 · 계산 불가"}</span>`;
      return `<li class="cm-c ${o.st}"><div class="cm-top"><div><b class="cm-n">${esc(shortName(r.n))}</b><small>${esc(r.g)} ${esc((r.bj || r.j || "").split(" ")[0])} · ${esc(stageName(r))}</small></div>${favBtn(r, "sm")}</div>\n      <p class="cm-t"><b>${o.tot}분</b> <span>예상 출퇴근</span></p>\n      <p class="cm-r">도보 ${o.z.walk}분 · ${esc(o.z.n)}역${via} → ${esc(CM.dest)}</p>\n      ${money}\n      <div class="cm-a"><button type="button" class="btn text sm" data-open="${r.id}">리포트</button><button type="button" class="btn text sm" data-cmmap="${r.id}">지도에서 보기</button></div></li>`;
    };
    const only = $("cmOnly") ? $("cmOnly").checked : true,
      pool = only ? res.filter((o) => o.st === "y") : res;
    const shown0 = only ? pool : res.slice(0, CM.n),
      cmLock = !isMember() && (only ? pool : res).length > 3;
    const shown = cmLock ? shown0.slice(0, 3) : shown0;
    setHTML(
      out,
      `<div class="cm-sum"><p><b>${esc(CM.dest)}역</b>까지 <b>${CM.max}분</b> 안 <b class="cm-big">${fmt(res.length)}곳</b>${res.length ? ` · 그중 ${gapMode() ? `전세 끼고 ${ZF.cash(CASH)}으로 갈 수 있는 곳` : `내 돈 ${ZF.cash(CASH)}으로 입주 가능`} <b class="y">${fmt(ny)}곳</b>` : ""}</p>${res.length ? `<button type="button" class="btn secondary sm" data-cmmap="*">지도에서 모두 보기</button>` : ""}</div>\n    ${res.length ? `${shown.length ? `<ol class="cm-list">${shown.map(card).join("")}</ol>` : `<div class="t-empty"><b>${CM.max}분 안에 ${gapMode() ? `전세 끼고 ${ZF.cash(CASH)}으로` : `내 돈 ${ZF.cash(CASH)}으로 입주까지`} 되는 곳은 아직 없어요</b><p>'내 조건에 맞는 곳만'을 끄면 ${fmt(res.length)}곳을 모두 볼 수 있어요.</p></div>`}${cmLock ? lockCard({ kind: "list", title: `여기까지 무료로 볼 수 있어요`, line: `나머지 ${fmt((only ? pool : res).length - 3)}곳 전체 목록은 멤버십에서 볼 수 있어요.`, ctx: "commute" }) : ""}${!cmLock && !only && res.length > shown.length ? `<div class="t-acts"><button type="button" class="btn secondary sm" id="cmMore">${fmt(Math.min(18, res.length - shown.length))}곳 더 보기 · 남은 ${fmt(res.length - shown.length)}곳</button></div>` : ""}${only && res.length > pool.length ? `<p class="t-note">그 밖에 ${fmt(res.length - pool.length)}곳은 현금이 부족하거나 계산 불가 · '내 조건에 맞는 곳만'을 끄면 보여요</p>` : ""}` : `<div class="t-empty"><b>${CM.max}분 안에 계산기 조건에 맞는 구역이 없어요</b><p>시간을 늘리거나 다른 역을 골라 보세요.</p></div>`}`,
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
    // 곳 수는 홈 '갈 수 있는 곳'과 같은 판정(window.ZP_ok)으로 센다
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
        ? `지금 ${ZF.cash(cash0)}으로 이미 <b>${fmt(n0)}곳</b> ${basisLab}`
        : firstRow
          ? `지금 ${ZF.cash(cash0)} · 매달 ${fmt(Math.round(m * 1e4))}만 원이면 <b>${ymTxt(firstRow.k)}</b> ${ZF.cash(firstRow.c)} → <b>${fmt(firstRow.n)}곳</b>${n0 ? `(지금 ${fmt(n0)}곳)` : "부터"}${gr ? `<small class="sv-gn">집값 연 ${SV.g}% 오름 반영 · 금액은 지금 가치</small>` : `<small class="sv-gn">집값이 그대로일 때 · 오르면 더 늦어져요</small>`}`
          : m > 0 || i
            ? `지금 ${ZF.cash(cash0)} · 매달 ${fmt(Math.round(m * 1e4))}만 원으로는 <b>20년 넘게</b> 걸려요${gr ? ` (집값 연 ${SV.g}% 오름 가정)` : ""}`
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
            t = `${ZF.cash(o.c)} · ${fmt(o.n)}곳`,
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
      `<p class="sv-hook">${hook}</p>\n    <div class="sv-ch"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="해마다 ${basisLab} 구역 수 계단 그래프. 아래 표에 같은 값이 있어요.">${gy}${gx}<path d="${d}" class="sv-l"/>${dots}${hits}<line class="sv-x" x1="0" x2="0" y1="${pt}" y2="${H - pb}" hidden/></svg><div class="sv-tip" id="svTip" hidden></div></div>\n    <table class="sv-t cardt"><caption class="sr-only">현금 목표별 도달 시점과 ${basisLab} 구역 수</caption><thead><tr><th scope="col">현금</th><th scope="col">도달 시점</th><th scope="col">${basisLab}</th></tr></thead><tbody>\n      <tr><td data-l="현금">${ZF.cash(cash0)}</td><td data-l="도달 시점">지금</td><td data-l="${basisLab}">${fmt(n0)}곳</td></tr>\n      ${rows.map((o) => `<tr><td data-l="현금">${ZF.cash(o.c)}</td><td data-l="도달 시점">${o.k == null ? "20년 넘게" : ymTxt(o.k)}</td><td data-l="${basisLab}">${fmt(o.n)}곳</td></tr>`).join("")}\n    </tbody></table>${gapMode() ? gapSavePlan(cash0, m, at) : ""}`,
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
  /*Y*/
  let svW = 0;
  window.addEventListener("resize", () => {
    const o = $("svOut");
    if (o && Math.abs(o.clientWidth - svW) > 40) {
      svW = o.clientWidth;
      renderSave();
    }
  });
  function gapSavePlan(cash0, m, at) {
    // 홈 플래너와 같은 기준(참고값 lc 제외)으로 센다 → '갈 수 있는 N곳 · ③ 계산 M곳'이 두 곳에서 같게
    const buy = baseList()
      .map(gapOf)
      .filter((g) => !g.r.lc && !g.block && !g.na && g.now != null && g.now <= cash0 + 1e-9);
    const tot = buy.filter((g) => g.x.ok);
    const gs = tot.filter((g) => g.tR != null).sort((a, b) => a.total - b.total);
    // 머리말: 갈 수 있는 곳 → ③(입주까지 현금) 계산되는 곳 → 이주 시점까지 나온 곳, 빠지는 단계를 숫자로 밝힘
    const sub =
      buy.length > gs.length
        ? `지금 전세 끼고 갈 수 있는 ${fmt(buy.length)}곳 중 ③이 계산되는 ${tot.length > gs.length ? `${fmt(tot.length)}곳, 그중 이주 시점까지 나온 ` : ""}`
        : "";
    if (!gs.length) return `<p class="t-hint">지금 ${ZF.cash(cash0)}으로 전세 끼고 갈 수 있고 입주 시점까지 계산되는 곳이 없어요.</p>`;
    if (!isMember())
      return `<div class="gsv"><h3>전세 끼고 지금 ${ZF.cash(cash0)}으로 사면, 매달 ${fmt(Math.round(m * 1e4))}만 원으로 제때 모을 수 있을까?</h3>${lockCard({ kind: "table", title: `구역별 표 · ${fmt(gs.length)}곳`, line: `구역마다 지금 ①·이주 ②·${LBL.cashToMoveIn} ③과 매달 필요한 돈을 표로 보여 줘요.`, ctx: "save" })}</div>`;
    const need = (g) => Math.max((g.now + g.reloc - cash0) / (12 * g.tR), (g.total - cash0) / (12 * g.tM), 0) * 1e4;
    const okN = gs.filter((g) => at(Math.round(12 * g.tR)) >= g.now + g.reloc - 1e-9 && at(Math.round(12 * g.tM)) >= g.total - 1e-9).length;
    const rows = gs
      .slice(0, 12)
      .map((g) => {
        const ok = at(Math.round(12 * g.tR)) >= g.now + g.reloc - 1e-9 && at(Math.round(12 * g.tM)) >= g.total - 1e-9;
        return `<tr><td data-l="구역"><button type="button" class="linklike" data-open="${g.r.id}">${esc(shortName(g.r.n))}</button><small>${esc(g.r.g)}</small></td><td data-l="지금 ①">${ZF.cash(g.now)}</td><td data-l="이주 ②">${g.reloc < 0.05 ? "추가 현금 없음" : `+${ZF.cash(g.reloc)}`}<small>${yrTxt(g.tR)}</small></td><td data-l="${LBL.cashToMoveIn} ③">${ZF.cash(g.total)}<small>${yrTxt(g.tM)}</small></td><td data-l="월 필요">${fmt(Math.ceil(need(g) / 10) * 10)}만</td><td data-l="매달 ${fmt(Math.round(m * 1e4))}만" class="${ok ? "ok" : "no"}">${ok ? "제때 가능" : "부족"}</td></tr>`;
      })
      .join("");
    return `<div class="gsv"><h3>전세 끼고 지금 ${ZF.cash(cash0)}으로 사면, 매달 ${fmt(Math.round(m * 1e4))}만 원으로 제때 모을 수 있을까?</h3>\n    <p class="sv-hook sm">${(() => {
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
        nt.textContent = "집값 오름 가정을 고르면 필요한 돈도 같은 비율로 오른다고 보고 셈 · 최대 20년까지 · 곳 수는 홈 '갈 수 있는 곳'과 같은 기준 · 연 3%는 월복리·세전 가정 · 투자 권유 아님";
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
    await yieldT();
    await scoreChunked();
    // 전세 끼고 계산(gapOf)을 150곳씩 나눠 미리 — plan()·첫 목록이 한 번에 1,300곳을 계산하는 긴 작업(300ms+)을 잘게(결과는 같은 캐시)
    // 예전 첫 화면 소개(#intro)는 간단 화면에서 숨겨져 있다 → 그 숫자(1·2·3억이면 N곳) 계산은 건너뛴다(18차 성능)
    if (!document.documentElement.classList.contains("simple") || ($("intro") && $("intro").getClientRects().length)) { initIntro(); await yieldT(); }
    // 4라운드(설치 앱): 미리 나눠 계산하기 전에 조건(AV)을 읽어 둔다 — 안 읽으면 계산 캐시 열쇠(condKey)가 plan()에서 바뀌어 미리 한 계산을 버리고 1,300곳을 한 번에 다시(긴 작업 ~150ms@4×CPU)
    try { readAV(); } catch (e) {}   // 사이클 2 성능(B): 웹도(예전엔 설치 앱만) — 안 읽으면 미리 한 계산을 plan()이 버리고 1,300곳을 한 번에 다시
    if (gapMode()) { const L = baseList(); for (let i = 0; i < L.length; i += 150) { for (let j = i; j < Math.min(L.length, i + 150); j++) try { gapOf(L[j]); } catch (e) {} await yieldT(); } }
    // 4라운드(설치 앱): 짧은 이름 표(1,300곳 · 첫 호출 ~130ms@4×CPU)를 plan() 앞의 따로 된 작업으로 — plan() 한 작업이 290~430ms이던 것을 나눔
    { try { if (R[0]) shortName(R[0].n); } catch (e) {} await yieldT(); }   // 사이클 2 성능(B): 웹도(예전엔 설치 앱만)
    plan();
    if (!hash0) initReveal();
    mbInit();
    await yieldT();
    SECT.mapTop();
    await yieldT();
    // 간단 화면(홈): 순위·통계·규제 화면은 MY의 도구로 열 때 그린다(SIMPLE.open → SECT) — 첫 화면 긴 작업 줄이기(18차)
    if (!document.documentElement.classList.contains("simple")) {
      SECT.rankTop();
      await yieldT();
      SECT.statsTop();
      SECT.rulesTop();
    }
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
    // 5라운드: 첫 계산·홈 그리기가 끝났다는 알림(설치 앱 시작 덮개가 이것과 첫 긴 작업이 끝난 뒤 걷힌다 · 웹은 듣는 곳 없음)
    window.ZP_booted = 1; try { performance.mark("zp-booted"); } catch (e) {} try { window.dispatchEvent(new Event("zp:booted")); } catch (e) {}
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
