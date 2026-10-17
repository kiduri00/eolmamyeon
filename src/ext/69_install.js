/* ===================== 홈 화면에 추가 안내 =====================
   - 모바일 브라우저(앱으로 이미 열린 경우 제외)에서만
   - 때: 첫 핀을 저장한 직후, 또는 세 번째 방문
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
  const boot = () => {
    const s = get(), n = (s.v || 0) + 1; put({ v: n });
    if (n >= 3) setTimeout(() => show("visit"), 9000);
    try { let base = window.PINS ? PINS.list().length : 0; PINS.on(() => { const c = PINS.list().length; if (c > base) setTimeout(() => show("pin"), 2600); base = c; }); } catch (e) {}
  };
  document.readyState === "complete" ? setTimeout(boot, 0) : addEventListener("load", () => setTimeout(boot, 0), { once: true });
})();
