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
  // 오프라인 동안 늘 보이는 띠 '오프라인 · 10.18 기준'(앱 자료 기준일) · 다시 연결되면 띠를 걷고 새 자료가 있는지 보고 새로 받는다
  const asOf = () => { let u = ""; try { u = String((typeof D !== "undefined" && (D.upd || D.asOf)) || ""); } catch (_) {} const m = /(\d{4})-?(\d\d)-?(\d\d)/.exec(u); return m ? `${+m[2]}.${m[3]}` : ""; };
  let bar = null;
  const offBar = (on) => {
    if (!document.body) return;
    if (!bar) { bar = document.createElement("div"); bar.id = "offBar"; bar.className = "off-bar"; bar.setAttribute("role", "status"); bar.hidden = true; document.body.appendChild(bar); }
    const d = asOf();
    bar.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M2 8.8a15 15 0 0 1 4.2-2.6M10.6 5.1A15 15 0 0 1 22 8.8M5 12.6a10 10 0 0 1 3.4-2M16 10.8a10 10 0 0 1 3 1.8M8.5 16.4a5 5 0 0 1 5.4-.9M12 20h.01M3 3l18 18"/></svg><b>오프라인</b>${d ? ` · ${d} 기준` : ""}<span> · 저장된 자료로 보여요</span>`;
    bar.hidden = !on; H.classList.toggle("off-on", !!on);
  };
  const goOff = (t) => { H.classList.add("is-offline"); offBar(true); if (t) toast("오프라인이에요 · 저장된 자료로 보여요", 3000); };
  // 다시 연결: 최신 첫 화면을 받아 자료 묶음(/b/d.…js) 이름이 바뀌었으면 새 자료 → 열린 시트·입력이 없으면 바로 새로 고침(보던 #화면은 그대로), 아니면 안내
  const refresh = async () => {
    try { const r = await navigator.serviceWorker?.getRegistration?.(); r && r.update && r.update().catch(() => {}); } catch (_) {}
    try {
      const t = await (await fetch("/?fresh=" + Date.now(), { cache: "no-store" })).text();
      const cur = (document.querySelector('script[src*="/b/d."]') || {}).getAttribute?.("src") || "", nw = (t.match(/\/b\/d\.[0-9a-f]{10}\.js/) || [])[0] || "";
      if (!nw || !cur || cur.includes(nw)) { toast("다시 연결됐어요 · 최신 자료예요", 2200); return; }
      const busy = () => H.classList.contains("sheet-open") || H.classList.contains("bs-on") || document.querySelector(".pn-ov, #dtRep, #cfSheet") || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
      if (!busy()) { toast("다시 연결됐어요 · 새 자료를 받아요", 1500); setTimeout(() => location.reload(), 900); }
      else toast("다시 연결됐어요 · 새 자료는 화면을 닫으면 받아요", 3200);
    } catch (_) { toast("다시 연결됐어요", 1800); }
  };
  window.ZP_offline = { bar: () => !!(bar && !bar.hidden), text: () => (bar ? bar.textContent : "") };
  addEventListener("offline", () => goOff(true));
  addEventListener("online", () => { if (!H.classList.contains("is-offline")) return; H.classList.remove("is-offline"); offBar(false); refresh(); });
  const boot = () => { if (navigator.onLine === false) goOff(true); };
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
