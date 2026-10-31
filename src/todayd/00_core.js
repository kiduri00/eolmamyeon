/* ===================== 사이클 5 D 화면 묶음(/b/y.*.js) — 오늘 카드 개인 줄 · 소식 서울 오늘·일정·주간 · 내 돈 레이더 · 아침에 받기 =====================
   자료·문구·셈은 A 묶음(window.ZP_today · /b/n.*.js)만 쓴다: 숫자 = today.json(ZP_today.seoul·feed·feedCount·sched·radar), 문구 = tools/feed_words.json(ZP_today.W · 화면 말은 W.ui),
   판정 = 앱 zstate(ctx.zst). 이 묶음은 그리기만 한다(새 셈 없음). 앱 닫힘 범위 밖이라 값·함수는 ctx(73_today.js)로만. */
(function () {
  "use strict";
  const Y = (window.ZPT = window.ZPT || {});
  Y.v = 1;
  const CSS = "__YCSS__";
  Y.css = () => { if (document.getElementById("zptCss")) return; const s = document.createElement("style"); s.id = "zptCss"; s.textContent = CSS; document.head.appendChild(s); };
  const Z = window.ZP_today, W = (Y.W = Z.W), U = (Y.U = W.ui);
  Y.Z = Z;
  Y.f = Z.fill;
  Y.esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  Y.n = (v) => Number(v || 0).toLocaleString("ko-KR");
  Y.T = () => Z.get();
  // 날짜: 기기 서울 날짜(내 일정 입력 최소값) · 표시 'M.D(요)'
  Y.day = (t) => new Date((t || Date.now()) + 9 * 36e5).toISOString().slice(0, 10);
  Y.add = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  Y.md = Z.mdw;
  Y.md0 = Z.md;
  Y.ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  Y.lsw = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  // 서울 줄 칸: ZP_today.seoul(t) 그대로(조용한 날 = 새로 올라온 숫자 0 → '적어요 · 이번 주 N건' 줄 + 허가·매각 칸) · 이번 주 줄 = 푸시 주간 줄(ZP_today.weekLine)
  //   tools/td_card.py tiles()가 같은 규칙으로 첫 페인트 HTML을 쓴다
  Y.tiles = (T, id) => {
    const S = Z.seoul(T), p = id ? "" : "x";
    const L = (S.quiet ? S.parts.filter((x) => x.k === "tho" || x.k === "auc_sale") : S.parts).slice(0, 4);
    const lab = (k) => U.tile[k] + (k === "tho" && T.tho_d && T.tho_d !== T.asOf ? ` · ${Z.md(T.tho_d)}` : "");
    const li = L.map((x) => `<li><b>${Y.n(x.n)}</b><span>${Y.esc(lab(x.k))}</span></li>`).join("");
    return (S.quiet ? `<p class="td-few" id="${p}tdF">${Y.esc(S.quietT)}</p>` : "") + (li ? `<ul class="td-s" id="${p}tdS">${li}</ul>` : "") + `<p class="td-w" id="${p}tdW">${Y.esc(Z.weekLine(T))}</p>`;
  };
  Y.cashT = (ctx, v) => { try { return ctx.ZF.cash(v); } catch (e) { return v + "억"; } };
  Y.modeT = (ctx) => (ctx.gap() ? "전세 끼고" : "대출 끼고");
  Y.name = (ctx, id) => { const r = ctx.byId[id]; return r ? ctx.shortName(r.n) : ""; };
  Y.chev = '<svg class="td-cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  // 레이더 ctx(A ZP_today.radar): 판정은 앱 zstate · 끈 구역 제외
  const muteZ = (ctx) => { try { return new Set((Y.ls("zp-alert-mute", {}) || {}).z || []); } catch (e) { return new Set(); } };
  const rctx = (ctx, ids) => ({ cash: ctx.cash(), gap: ctx.gap(), mute: muteZ(ctx), ids, zstate: (id) => { const r = ctx.byId[id]; return r ? ctx.zst(r) : null; } });
  let RC = null, NC = null;
  // 새로 가능 · 멀어짐(같은 금액·방식·자료면 다시 세지 않음) — nw 수 = 목록 '이번 주 새로 가능' 칩 수(60_simple isNew = ZP_today.isNew + 앱 판정)
  Y.radar = (ctx) => { const T = Y.T(), k = `${ctx.cash()}|${ctx.gap()}|${T && T.asOf}`; if (RC && RC.k === k) return RC; const r = T ? Z.radar(T, rctx(ctx)) : { nw: [], far: [], near: [] }; return (RC = Object.assign(r, { k })); };
  // 조금만 더(3,000만 안): ZP_today.radar near와 같은 거르기, 다 센 수(레이더는 가까운 5곳만 돌려줌) — 구역 1천여 곳이라 한 번 세고 금액·방식이 바뀔 때만 다시
  Y.near = (ctx) => { const T = Y.T(), c = ctx.cash(), k = `${c}|${ctx.gap()}|${T && T.asOf}`; if (NC && NC.k === k) return NC; const m = muteZ(ctx), L = []; for (const id in ctx.byId) { if (m.has(id)) continue; let z = null; try { z = ctx.zst(ctx.byId[id]); } catch (e) {} if (z && z.st === "near" && z.need != null && z.need - c <= 0.3 + 1e-9) L.push({ id, need: z.need, gap: z.need - c }); } L.sort((a, b) => a.gap - b.gap || a.need - b.need); return (NC = { k, n: L.length, top: L.slice(0, 5) }); };
})();
