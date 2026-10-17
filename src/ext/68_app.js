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

  // 서비스 워커: 안전한 출처에서만, 첫 화면을 다 그린 뒤에
  const okHost = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && okHost) {
    const reg = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") setTimeout(reg, 1500); else addEventListener("load", () => setTimeout(reg, 1500), { once: true });
  }
})();
