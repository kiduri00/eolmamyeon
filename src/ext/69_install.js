/* ===================== 홈 화면에 추가 안내 =====================
   - 모바일 브라우저(앱으로 이미 열린 경우 제외)에서만
   - 때: 의미 있는 행동 직후에만 — 관심 구역을 더했을 때·폰 알림을 켰을 때(72_inbox가 ZP_INSTALL.offer로 부른다).
     페이지를 열자마자·방문 횟수로는 권하지 않는다. 첫 관심 구역은 72_inbox '알림 받을 준비' 시트가 설치까지 함께 권한다
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
  // 앱 코드가 붙기 전(첫 화면 섬)에 온 설치 창 신호는 boot.js가 window.__bip에 받아 둔다
  let deferred = window.__bip || null, shown = false;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; try { dispatchEvent(new Event("zp:bip")); } catch (_) {} });
  if (deferred) setTimeout(() => { try { dispatchEvent(new Event("zp:bip")); } catch (_) {} }, 0);
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
    const lead = why === "push" ? "알림을 켰어요. 앱으로 두면 놓치지 않아요" : "관심 구역에 넣었어요. 앱처럼 바로 열어 보세요";
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
    // 관심 구역 추가·알림 켜기 직후(72_inbox) · 닫았으면 30일 동안 안 띄움
    offer: (why) => show(why || "pin"),
    // 다른 시트에서 설치 권유를 '나중에'로 닫음 → 30일 쉼
    later: () => put({ no: Date.now() }),
    // MY > 앱 설치: 이 기기에서 지금 설치 창을 띄울 수 있나(안드로이드) · iOS면 안내
    state: () => ({ app: window.ZP_INSTALL.app(), ios, inApp, prompt: !!deferred, done: !!get().done }),
  };
  const boot = () => {
    let wiped = false; try { wiped = sessionStorage.getItem("zp_wiped") === "1"; } catch (e) {}
    const s = get(), n = (s.v || 0) + 1; if (!wiped) put({ v: n });   // 방문 수는 세기만(권유 때는 아님)
    // 핀을 꽂은 직후 안내는 72_inbox의 '알림 받을 준비' 시트가 함께 한다(ZP_INSTALL로 설치 창을 띄움)
  };
  document.readyState === "complete" ? setTimeout(boot, 0) : addEventListener("load", () => setTimeout(boot, 0), { once: true });
})();
