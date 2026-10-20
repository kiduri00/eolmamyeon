/* ===================== 21차: 새 소식 'N' 점(경공매 · 고시공고 · 소식 탭 · 머리 종) =====================
   한 곳에서만 센다: 빌드가 넣는 최신 날짜(NEWD = {auc: 경매 물건이 처음 보인 날 중 가장 늦은 날, ntc: 고시·공고 기록 중 가장 늦은 날})
   > 이 기기에서 그 목록을 마지막으로 본 날(localStorage zp.seen.auc / zp.seen.ntc) 이면 N.
   목록을 열면 그날로 적어 지운다. 'MY > 데이터 모두 지우기'는 localStorage를 통째로 지우므로 함께 지워진다.
   정적 페이지(/z·/gu·가이드)의 머리 종·아래 탭도 같은 키·같은 규칙(tools/static_tabs.py). */
const NEWB = window.NEWB = (() => {
  const NEWD = /*NEWD*/ null;
  const K = { auc: "zp.seen.auc", ntc: "zp.seen.ntc" };
  const last = (k) => { try { return localStorage.getItem(K[k]) || ""; } catch (e) { return ""; } };
  // MY > 알림 종류에서 끈 것(zp-alert-off: auction·notice)은 N을 띄우지 않는다
  const KOFF = { auc: "auction", ntc: "notice" };
  const muted = (k) => { try { const v = JSON.parse(localStorage.getItem("zp-alert-off") || "[]"); return Array.isArray(v) && v.includes(KOFF[k]); } catch (e) { return false; } };
  const unseen = (k) => !!(NEWD && NEWD[k] && NEWD[k] > last(k)) && !muted(k);
  const any = () => unseen("auc") || unseen("ntc");
  const LBL = { auc: "경공매", ntc: "고시공고" };
  function paint() {
    const st = { auc: unseen("auc"), ntc: unseen("ntc") }; st.any = st.auc || st.ntc;
    // 아래 탭 '소식'에도 같은 점(없으면 만든다)
    const nb = document.querySelector('#sNav [data-nav="news"]');
    if (nb && !nb.querySelector(".nb-dot")) { const i = document.createElement("i"); i.className = "nb-dot"; i.dataset.newb = "any"; i.setAttribute("aria-hidden", "true"); i.textContent = "N"; i.hidden = true; nb.appendChild(i); }
    document.querySelectorAll("[data-newb]").forEach((e) => { const on = !!st[e.dataset.newb]; if (e.hidden === on) e.hidden = !on; });
    const b = document.getElementById("hdrBell"); if (b) b.setAttribute("aria-label", st.any ? "소식, 새 소식 있음" : "소식");
    if (nb) nb.setAttribute("aria-label", st.any ? "소식, 새 소식 있음" : "소식");
    document.querySelectorAll("#sQuick [data-q]").forEach((a) => { const k = a.dataset.q === "aucTop" ? "auc" : a.dataset.q === "ntcTop" ? "ntc" : ""; if (k) a.setAttribute("aria-label", LBL[k] + (st[k] ? ", 새 소식 있음" : "")); });
  }
  function seen(k) { if (!NEWD || !NEWD[k]) return; try { localStorage.setItem(K[k], NEWD[k]); } catch (e) {} paint(); }
  const init = () => { paint(); addEventListener("storage", (e) => { if (!e.key || /^zp\.seen\.|^zp-alert-off$/.test(e.key)) paint(); }); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : setTimeout(init, 0);
  return { unseen, any, seen, last, paint, NEWD };
})();
