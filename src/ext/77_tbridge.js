/* 설치 앱 화면 묶음(/b/t.*.js · 설치 앱에서만 받음)이 읽는 것만 내보낸다. 웹 화면에서는 아무 일도 하지 않는다. */
window.ZP_T0 = { D: () => D, byId: (id) => byId[id], stage: (r) => stageName(r), name: (n) => shortName(n), cash: () => CASH, gap: () => gapMode(), inbox: () => INBOX, pins: () => PINS, ZF: () => ZF, esc: (s) => esc(s) };
