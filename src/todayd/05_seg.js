/* 소식 4칸 바꾸기(내 소식 · 서울 오늘 · 일정 · 주간) · 내 돈 레이더 묶음 · 소식을 보면 서랍의 아침 알림 닫기 */
(function () {
  "use strict";
  const Y = window.ZPT;
  const CSS2 = "__ZCSS__";
  Object.assign(Y.U, "__ZUI__");   // 소식 칸만 쓰는 화면 말(feed_words.json ui)
  Y.css2 = () => { if (document.getElementById("zptCss2")) return; const s = document.createElement("style"); s.id = "zptCss2"; s.textContent = CSS2; document.head.appendChild(s); };
  const SEGS = ["mine", "today", "cal", "wk"];
  let NSEG = "", USER = false, HQ = true;
  const news = () => document.getElementById("news");
  // 설치 앱: 예전 두 칸(전체 소식 tseg=all · 관심 구역 tseg=mine)을 이 칸에 맞춘다(30일 전체 소식은 '서울 오늘' 칸 아래)
  const want = () => (NSEG === "mine" ? "mine" : "all");
  function syncT() {
    const n = news(); if (!n || !Y.tapp() || !NSEG) return;
    if (n.dataset.tseg !== want()) { const b = n.querySelector(`.tf-seg [data-seg="${want()}"]`); if (b) b.click(); else n.dataset.tseg = want(); }
  }
  let mo = false;
  Y.seg = (ctx, v, user) => {
    const n = news(); if (!n || !SEGS.includes(v)) return;
    NSEG = v; if (user) { USER = true; try { sessionStorage.setItem("zp.nseg", v); } catch (e) {} }
    n.dataset.nseg = v;
    n.querySelectorAll("#nwSeg [role=tab]").forEach((b) => { const on = b.dataset.nseg === v; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    syncT();
    if (!mo) { mo = true; try { new MutationObserver(() => { if (Y.tapp() && NSEG && n.dataset.tseg !== want()) n.dataset.tseg = want(); }).observe(n, { attributes: true, attributeFilter: ["data-tseg"] }); } catch (e) {} }
    Y.news(ctx, v);
  };
  Y.segKey = (ctx, e) => {
    const k = { ArrowRight: 1, ArrowLeft: -1, Home: -9, End: 9 }[e.key]; if (!k) return;
    const i = SEGS.indexOf(NSEG || "mine"), j = k === -9 ? 0 : k === 9 ? 3 : (i + k + 4) % 4;
    Y.seg(ctx, SEGS[j], true); const b = document.querySelector(`#nwSeg [data-nseg="${SEGS[j]}"]`); if (b) b.focus();
  };
  // 고시·단계 기록(빠른 메뉴 경공매·고시공고가 가는 곳)이 있는 칸: 웹 '서울 오늘' · 앱 '내 소식'(예전 자리)
  Y.alias = (ctx, d) => { if (/^(ntc|auc|new|supply)Top$/.test(d)) Y.seg(ctx, Y.tapp() ? "mine" : "today", true); };
  // 앱 바로가기 '오늘'(/?src=app#news?today)·알림(#news?from=today): 첫 스크립트가 # 뒤 ?를 떼어 ZP_CQ에 둔다 → 처음 한 번만 그 칸으로
  const hashSeg = () => { if (!HQ) return ""; HQ = false; try { const q = new URLSearchParams(window.ZP_CQ || ""), f = q.get("from") || q.get("seg") || ""; return q.has("today") || f === "today" ? "today" : q.has("cal") || f === "cal" ? "cal" : q.has("wk") || f === "wk" ? "wk" : ""; } catch (e) { return ""; } };
  Y.enter = (ctx) => {
    const n = news(), s = document.getElementById("nwSeg"), h = n && n.querySelector(":scope > .sec-h");
    if (s && h && h.nextElementSibling !== s) h.after(s);   // 앱이 나중에 끼우는 예전 칸(tf-seg) 위로
    // 설치 앱: 30일 전체 소식(tFeed)은 '서울 오늘' 7일 요약 아래로, 머리 한 줄을 붙여
    const tf = document.getElementById("tFeed"), td = document.getElementById("nwToday");
    if (tf && td && td.nextElementSibling !== tf && td.nextElementSibling?.id !== "nwT30") { let hh = document.getElementById("nwT30"); if (!hh) { hh = document.createElement("h3"); hh.className = "nw-h"; hh.id = "nwT30"; hh.textContent = "최근 30일 전체 기록"; } td.after(hh); hh.after(tf); }
    let v = NSEG;
    const hs = hashSeg();
    if (hs) { v = hs; USER = true; }
    else if (!USER) {
      let c = 0, has = false, ss = "";
      try { c = ctx.inbox.count(); } catch (e) {}
      try { has = ctx.pins.list().length > 0 || ctx.pins.condsAll().length > 0; } catch (e) {}
      try { ss = sessionStorage.getItem("zp.nseg") || ""; } catch (e) {}
      v = c > 0 ? "mine" : SEGS.includes(ss) ? ss : has ? "mine" : "today";
    }
    Y.seg(ctx, v);
    // 소식을 봤으면 서랍에 남은 아침 알림(태그 jp-날짜 · 운영 알림 admin 제외)을 닫는다 → Android 아이콘 점도 사라짐(점은 서랍 알림 기준)
    try { if (navigator.serviceWorker) navigator.serviceWorker.getRegistration("/").then((r) => (r && r.getNotifications ? r.getNotifications() : [])).then((L) => (L || []).forEach((x) => { if (/^jp-/.test(x.tag || "") && !/admin/.test(x.tag)) x.close(); })).catch(() => {}); } catch (e) {}
  };
  // 다른 화면에서 소식 칸으로(오늘 카드 줄 누름)
  Y.go = (ctx, v) => { USER = true; try { if (ctx.simple.open("news")) { Y.seg(ctx, v, true); return; } } catch (e) {} location.hash = "#news"; setTimeout(() => Y.seg(ctx, v, true), 50); };
  window.ZPTz = 1;
})();
