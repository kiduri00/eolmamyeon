/* ===================== 사이클 5 D 지연 묶음(/b/y.*.js) — 오늘 카드 개인 줄 · 소식 서울 오늘·일정·주간 · 내 돈 레이더 · 아침에 받기 =====================
   앱 닫힘 범위 밖이라 값·함수는 ctx(73_today.js)로만 받는다. 숫자는 today.json(A 트랙)·ZoneFacts(ctx.ZF)·앱 판정(ctx.zst)·소식 자료(ctx.inbox)에서만.
   문구는 words(src/today/words.json · 빌드가 넣음) — A 트랙 공용 사전(window.FEED_WORD.today)이 있으면 같은 키를 그쪽으로. */
(function () {
  "use strict";
  const Y = (window.ZPT = window.ZPT || {});
  Y.v = 1;
  const CSS = "__YCSS__";
  Y.css = () => { if (document.getElementById("zptCss")) return; const s = document.createElement("style"); s.id = "zptCss"; s.textContent = CSS; document.head.appendChild(s); };
  const W = JSON.parse("__YWORDS__");
  try { const F = window.FEED_WORD && window.FEED_WORD.today; if (F) for (const k in F) W[k] = typeof F[k] === "object" && typeof W[k] === "object" ? Object.assign({}, W[k], F[k]) : F[k]; } catch (e) {}
  Y.W = W;
  Y.f = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? o[k] : m));
  Y.esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  Y.n = (v) => Number(v || 0).toLocaleString("ko-KR");
  // 날짜: 서울 오늘 · 'M.D(요)'
  Y.day = (t) => new Date((t || Date.now()) + 9 * 36e5).toISOString().slice(0, 10);
  Y.add = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  Y.md = (d) => { const x = new Date(String(d).slice(0, 10) + "T00:00:00Z"); return isNaN(x) ? "" : `${x.getUTCMonth() + 1}.${x.getUTCDate()}(${"일월화수목금토"[x.getUTCDay()]})`; };
  Y.md0 = (d) => { const m = /^\d{4}-(\d\d)-(\d\d)/.exec(String(d)); return m ? `${+m[1]}.${+m[2]}` : ""; };
  Y.diff = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
  Y.ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  Y.lsw = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  // 오늘 자료 칸(서울 줄): tools/td_card.py tiles()와 같은 규칙 — 오늘 0이 아닌 칸만(최대 4) · 오늘 합이 0이면 '적어요' + 이번 주
  const ORDER = ["trade", "notice", "tho", "auc_sale", "auc_new", "auc_drop"];
  // '새로 올라온' 숫자(A today.js NEWK와 같음: 허가는 하루 늦은 자료 · 매각기일은 일정이라 뺌) — 이 합이 0이면 '적어요' + 이번 주
  const NEWK = ["trade", "notice", "stage", "auc_new", "auc_drop"];
  Y.val = (o, k) => (k === "notice" ? (+((o || {}).notice) || 0) + (+((o || {}).stage) || 0) : +((o || {})[k]) || 0);
  Y.tiles = (T, id) => {
    const S = (T && T.seoul) || {}, d = S.d || {}, w = S.w || {};
    const quiet = NEWK.reduce((x, k) => x + (+d[k] || 0), 0) === 0;
    const t = quiet ? [] : ORDER.filter((k) => Y.val(d, k) > 0).slice(0, 4).map((k) => [k, Y.val(d, k)]);
    const wk = ORDER.filter((k) => Y.val(w, k) > 0).slice(0, 4).map((k) => [k, Y.val(w, k)]);
    // 거래허가는 하루 늦게 모이는 자료 — 기준일과 다르면 허가 날짜를 붙인다(A today.json tho_d)
    const lab = (k) => W.k[k] + (k === "tho" && T.tho_d && T.tho_d !== T.asOf ? ` · ${Y.md0(T.tho_d)}` : "");
    const li = (L) => L.map(([k, n]) => `<li><b>${Y.n(n)}</b><span>${Y.esc(lab(k))}</span></li>`).join("");
    const ws = wk.map(([k, n]) => `${Y.esc(W.ks[k])} ${Y.n(n)}`).join(" · ");
    const p = id ? "" : "x";
    return t.length ? `<ul class="td-s" id="${p}tdS">${li(t)}</ul><p class="td-w" id="${p}tdW"><span>${Y.esc(W.week)}</span> ${ws}</p>` : `<p class="td-few" id="${p}tdS">${Y.esc(W.few)}</p><ul class="td-s td-sw" id="${p}tdW">${li(wk)}</ul>`;
  };
  // 사건 줄 [id, type, date, text, flags(1 밀린 자료 · 2 신고가 · 4 해제) 또는 {bf,hi,x}, (mn 경매 최저가 억)]
  // A today.py: 표시 글자 h 신고가 · b 밀린 자료 · x 해제됨 · d 유찰 하락 · o 인가 고시 / 6번째 = 건수
  Y.fl = (e) => { const f = e[4]; if (typeof f === "string") return { bf: f.includes("b"), hi: f.includes("h"), x: f.includes("x"), d: f.includes("d"), o: f.includes("o") }; return f && typeof f === "object" ? { bf: !!f.bf, hi: !!f.hi, x: !!f.x } : { bf: !!(f & 1), hi: !!(f & 2), x: !!(f & 4) }; };
  Y.nOf = (x) => (typeof x[5] === "number" && x[1] !== "auction" ? x[5] : x[1] === "tho" ? parseInt(String(x[3]).replace(/^\D+/, "")) || 1 : typeof x[5] === "number" && x[5] < 50 && Number.isInteger(x[5]) ? x[5] : 1);
  // 그날 칸 숫자(A: dd [[날짜, {…}]] · 임시: seoul.days{날짜: {…}})
  Y.dayOf = (T, d) => { if (Array.isArray(T.dd)) { const r = T.dd.find((x) => x[0] === d); if (r) return r[1]; } return (T.seoul && T.seoul.days && T.seoul.days[d]) || (d === T.asOf ? T.seoul && T.seoul.d : null); };
  // 경매 일정 줄 → 한 꼴(A: [구역, 사건번호, 물건번호, 매각기일, 시각, 최저가원, 감정가원, 유찰, 최저가율, 법원, 용도, 표시(j 지분), 직전 최저가원] · 임시: [구역, 사건번호, 기일, 최저가억, 유찰, 상태])
  Y.aucN = (a) => (a.length >= 11 ? { id: a[0], cs: a[1], no: a[2], d: a[3], time: a[4], min: a[5] / 1e8, appr: a[6], fail: a[7], court: a[9], use: a[10], j: String(a[11] || "").includes("j"), st: String(a[11] || "").includes("g") ? "gone" : "", prev: a[12] ? a[12] / 1e8 : null, full: 1 } : { id: a[0], cs: a[1], d: a[2], min: Y.mn(a[3]), fail: a[4], st: a[5] || "" });
  Y.evs = (T) => ((T && T.ev) || []).filter((e) => Array.isArray(e) && e.length >= 4);
  Y.mn = (v) => (v == null ? null : v > 1000 ? v / 1e8 : +v);   // 경매 최저가: 억(임시 자료) · 원(원자료) 둘 다
  Y.cashT = (ctx, v) => { try { return ctx.ZF.cash(v); } catch (e) { return v + "억"; } };
  Y.modeT = (ctx) => (ctx.gap() ? "전세 끼고" : "대출 끼고");
  Y.name = (ctx, id) => { const r = ctx.byId[id]; return r ? ctx.shortName(r.n) : ""; };
  Y.WHY = { jr: "전세 가운데 값 변화", px: "매수가 표본 변화", sm: "거래 표본이 바뀜" };
  Y.chev = '<svg class="td-cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  // 조금만 더 있으면 닿는 곳(0~3,000만): 홈 '다음 문턱'과 같은 셈(ZP_count) — 수만
  Y.nearN = (ctx) => { try { const c = ctx.cash(), a = window.ZP_count(c), b = window.ZP_count(Math.round((c + 0.3) * 100) / 100); return a != null && b != null ? Math.max(0, b - a) : null; } catch (e) { return null; } };
})();
