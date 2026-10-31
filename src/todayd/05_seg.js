/* 소식 4칸 바꾸기(내 소식 · 서울 오늘 · 일정 · 주간) · 내 돈 레이더 묶음 · 소식을 보면 서랍의 아침 알림 닫기 */
(function () {
  "use strict";
  const Y = window.ZPT;
  const SEGS = ["mine", "today", "cal", "wk"];
  let NSEG = "", USER = false, HQ = true;
  Y.tapp = () => document.documentElement.classList.contains("is-tapp");
  const news = () => document.getElementById("news");
  // 레이더(같은 금액·방식·자료면 다시 세지 않음): nw 새로 가능(목록 칩과 같은 TDAY.isNew) · far 멀어짐(7일 전엔 내 돈 안 → 지금 밖) — 원인 없는·계산 방식 변경(cv) 구역은 뺀다
  let RC = null;
  Y.radar = (ctx) => {
    const T = ctx.today.data(), c = ctx.cash(), g = ctx.gap(), k = `${c}|${g}|${T ? T.asOf : ""}`;
    if (RC && RC.k === k) return RC;
    const R = T && T.rad && T.rad[g ? "g" : "c"], nw = [], far = [];
    if (R) for (const id in R) {
      const r = ctx.byId[id], a = R[id]; if (!r || !Array.isArray(a) || !a[2] || a[2] === "cv") continue;
      let z = null; try { z = ctx.zst(r); } catch (e) {}
      if (!z) continue;
      if (z.st === "ok" && ctx.today.isNew(id, z.need)) nw.push(id);
      else if (a[0] <= c + 1e-9 && a[1] > c + 1e-9 && z.st !== "ok") far.push(id);
    }
    return (RC = { k, nw, far });
  };
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
})();
