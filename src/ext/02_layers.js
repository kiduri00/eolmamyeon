/* 겹(layer) 기록: 시트·확인 상자·지도 고른 카드처럼 '위에 뜨는 것'마다 방문 기록을 하나씩 쌓는다.
   뒤로 가기 = 맨 위 겹 하나만 닫는다(앱 밖 about:blank로 나가지 않게).
   ZL.open(id, closeFn) — 열 때. 같은 주소로 기록 한 칸(state에 zl·zn을 덧붙여 아래 상태(sheet·gu·sView)는 그대로).
   ZL.done(id) — 겹이 스스로 닫혔을 때(× · Esc · 바탕 누름). history.back()을 부르지 않는다(바로 이어지는 다른 이동과 엇갈려
     그 이동을 되돌리던 경쟁을 없앰): 그 칸을 '빈 칸'(zdead)으로 바꿔 두고, 나중에 뒤로/앞으로 가기가 빈 칸과 같은 화면에 닿으면 한 칸 더 간다.
   뒤로 가기(popstate) — 새 state의 zn보다 위에 있는 겹을 위에서부터 closeFn(true)로 닫는다. */
const ZL = (() => {
  const S = [];
  const strip = (s) => { if (!s || typeof s !== "object") return "{}"; const o = Object.assign({}, s); delete o.zl; delete o.zn; delete o.zdead; delete o.tD; return JSON.stringify(o); };   // tD = 설치 앱 화면 묶음이 적는 기록 깊이(같은 화면 판정에서 뺀다)
  let last = { st: history.state, url: location.href }, skipping = false, hold = 0;
  // 다른 코드의 pushState·replaceState도 '지금 칸'으로 기억(빈 칸 건너뛰기 판정용)
  try {
    const P = history.pushState.bind(history), Rp = history.replaceState.bind(history);
    history.pushState = function (s, t, u) { const x = P(s, t, u); last = { st: history.state, url: location.href }; return x; };
    history.replaceState = function (s, t, u) { const x = Rp(s, t, u); last = { st: history.state, url: location.href }; return x; };
  } catch (e) {}
  function open(id, close) {
    const t = S[S.length - 1];
    if (t && t.id === id) { t.close = close; return; }
    S.push({ id, close });
    try { history.pushState(Object.assign({}, history.state || {}, { zl: id, zn: S.length }), "", location.href); } catch (e) {}
  }
  function done(id) {
    const i = S.findIndex((x) => x.id === id);
    if (i < 0) return Promise.resolve(false);
    const top = i === S.length - 1;
    S.splice(i, 1);
    const st = history.state || {};
    if (top && st.zl === id && st.zn === i + 1) {
      const o = Object.assign({}, st); delete o.zl; delete o.zn; o.zdead = 1;
      if (S.length) { o.zl = S[S.length - 1].id; o.zn = S.length; }
      try { history.replaceState(o, "", location.href); } catch (e) {}
    }
    return Promise.resolve(true);
  }
  addEventListener("popstate", (e) => {
    const st = e.state, prev = last;
    last = { st, url: location.href };
    skipping = false;
    const n = (st && st.zn) || 0;
    while (S.length > n) { const L = S.pop(); try { L.close(true); } catch (er) {} }
    // 닫힌 겹의 빈 칸과 같은 화면에 닿았으면 한 칸 더(뒤로 → 뒤로, 앞으로 → 앞으로) — 뒤로 가기가 '아무 일 없음'이 되지 않게
    // noskip(): 여러 칸을 한 번에 돌아갈 때(설치 앱 탭 → 처음 칸) 도착한 칸에서 더 가지 않는다
    if (hold && Date.now() - hold < 1500) { hold = 0; return; }
    if (prev && prev.url === location.href && strip(prev.st) === strip(st)) {
      const pd = !!(prev.st && prev.st.zdead), nd = !!(st && st.zdead);
      if (pd && !nd) { skipping = true; try { history.back(); } catch (er) {} }
      else if (nd && !pd) { skipping = true; try { history.forward(); } catch (er) {} }
    }
  });
  // 모두 닫기(로고·찾기 탭처럼 기록을 새로 시작할 때) — 기록은 건드리지 않는다
  function reset() { while (S.length) { const L = S.pop(); try { L.close(true); } catch (er) {} } }
  return { open, done, reset, noskip: () => { hold = Date.now(); }, skipping: () => skipping, has: (id) => S.some((x) => x.id === id), top: () => (S.length ? S[S.length - 1].id : null), depth: () => S.length };
})();
window.ZL = ZL;
