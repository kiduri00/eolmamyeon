/* ===================== 앱 화면 아이콘(설치 앱 전용 묶음 /b/t.*.js) =====================
   2.5D 두 톤: 남색 면(--tf) + 아래로 2px 깊이(--ts) + 옅은 남색 보조(--tl) + 노란 강조 하나(--th · 깊이 --th2) + 종이(--tp).
   색은 CSS 변수(tapp.css :root)라 밝게·어둡게가 저절로. tools/app_icons.js가 같은 그림을 색을 박아 PNG(바로가기 아이콘)로 낸다.
   viewBox 0 0 40 40 · 모양만(바탕 타일은 CSS). */
const TI = {
  // 지도: 접힌 지도 세 칸 + 노란 핀
  map: '<path d="M6 13l9-3 10 3 9-3v23l-9 3-10-3-9 3z" fill="var(--ts)"/><path d="M6 11l9-3v23l-9 3z" fill="var(--tf)"/><path d="M15 8l10 3v23l-10-3z" fill="var(--tl)"/><path d="M25 11l9-3v23l-9 3z" fill="var(--tf)"/><path d="M25 5.2c-3.3 0-6 2.6-6 5.9 0 4.3 6 10.1 6 10.1s6-5.8 6-10.1c0-3.3-2.7-5.9-6-5.9z" fill="var(--th2)"/><path d="M25 4c-3.3 0-6 2.6-6 5.9C19 14.2 25 20 25 20s6-5.8 6-10.1C31 6.6 28.3 4 25 4z" fill="var(--th)"/><circle cx="25" cy="9.9" r="2.3" fill="var(--tp)"/>',
  // 순위: 시상대 막대 셋 + 가운데 위 노란 별
  rank: '<rect x="5" y="33" width="30" height="3" rx="1.5" fill="var(--tl)"/><rect x="7" y="22" width="8" height="12" rx="2" fill="var(--ts)"/><rect x="7" y="20" width="8" height="12" rx="2" fill="var(--tf)"/><rect x="16" y="16" width="8" height="18" rx="2" fill="var(--ts)"/><rect x="16" y="14" width="8" height="18" rx="2" fill="var(--tf)"/><rect x="25" y="26" width="8" height="8" rx="2" fill="var(--ts)"/><rect x="25" y="24" width="8" height="8" rx="2" fill="var(--tl)"/><path d="M20 3.2l1.5 3.1 3.4.5-2.5 2.4.6 3.4L20 11l-3 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="var(--th)" stroke="var(--th2)" stroke-width=".8" stroke-linejoin="round"/>',
  // 입주 계산: 계산기 + 노란 = 단추
  calc: '<rect x="9" y="7" width="22" height="30" rx="5" fill="var(--ts)"/><rect x="9" y="5" width="22" height="30" rx="5" fill="var(--tf)"/><rect x="12.5" y="8.5" width="15" height="7.5" rx="2" fill="var(--tp)"/><rect x="21" y="10.6" width="4.4" height="1.8" rx=".9" fill="var(--tl)"/><rect x="12.5" y="19.5" width="4" height="4" rx="1.2" fill="var(--tl)"/><rect x="18" y="19.5" width="4" height="4" rx="1.2" fill="var(--tl)"/><rect x="23.5" y="19.5" width="4" height="4" rx="1.2" fill="var(--tl)"/><rect x="12.5" y="26" width="4" height="4" rx="1.2" fill="var(--tl)"/><rect x="18" y="26" width="4" height="4" rx="1.2" fill="var(--tl)"/><rect x="23.5" y="26.6" width="4" height="4" rx="1.2" fill="var(--th2)"/><rect x="23.5" y="25.6" width="4" height="4" rx="1.2" fill="var(--th)"/>',
  // 모으면 언제: 동전 탑 + 떨어지는 노란 동전
  save: '<ellipse cx="16" cy="33" rx="9" ry="3" fill="var(--ts)"/><rect x="7" y="29" width="18" height="4" fill="var(--ts)"/><ellipse cx="16" cy="29" rx="9" ry="3" fill="var(--tf)"/><rect x="7" y="24" width="18" height="5" fill="var(--ts)"/><ellipse cx="16" cy="24" rx="9" ry="3" fill="var(--tf)"/><rect x="7" y="19" width="18" height="5" fill="var(--ts)"/><ellipse cx="16" cy="19" rx="9" ry="3" fill="var(--tf)"/><ellipse cx="16" cy="19" rx="5.4" ry="1.6" fill="none" stroke="var(--tl)" stroke-width="1.2"/><circle cx="29" cy="12.4" r="6.5" fill="var(--th2)"/><circle cx="29" cy="11" r="6.5" fill="var(--th)"/><path d="M26.4 8.6l1.3 5 1.3-3.6 1.3 3.6 1.3-5M26 11.1h6" fill="none" stroke="var(--ts)" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>',
  // 출퇴근: 지하철 앞모습 + 노란 전조등
  commute: '<path d="M13.4 32.5l-3.2 4M26.6 32.5l3.2 4" stroke="var(--tl)" stroke-width="2.6" stroke-linecap="round"/><rect x="9" y="7" width="22" height="26" rx="7" fill="var(--ts)"/><rect x="9" y="5" width="22" height="26" rx="7" fill="var(--tf)"/><rect x="16.5" y="2.6" width="7" height="2.6" rx="1.2" fill="var(--tl)"/><rect x="12.5" y="9" width="15" height="9" rx="2.6" fill="var(--tp)"/><path d="M20 9v9" stroke="var(--tl)" stroke-width="1.2"/><circle cx="14.6" cy="24.4" r="2.2" fill="var(--th)"/><circle cx="25.4" cy="24.4" r="2.2" fill="var(--th)"/><rect x="17.6" y="23.3" width="4.8" height="2.2" rx="1.1" fill="var(--tl)"/>',
  // 매물진단: 집 + 노란 확인 배지
  diag: '<path d="M5 21.4L20 9.2l15 12.2V34a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="var(--ts)"/><path d="M5 19.4L20 7.2l15 12.2V32a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="var(--tf)"/><path d="M3.4 19.6L20 6l16.6 13.6" fill="none" stroke="var(--tl)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="11" y="22" width="7" height="12" rx="1.6" fill="var(--tl)"/><circle cx="28.6" cy="28.4" r="7" fill="var(--th2)"/><circle cx="28.6" cy="27" r="7" fill="var(--th)"/><path d="M25.3 27.2l2.3 2.3 4.4-4.6" fill="none" stroke="var(--ts)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  // 매수 전 규정: 서류판 + 노란 집게
  rules: '<rect x="8" y="8" width="24" height="29" rx="4" fill="var(--ts)"/><rect x="8" y="6" width="24" height="29" rx="4" fill="var(--tf)"/><rect x="11.5" y="10.5" width="17" height="21" rx="2" fill="var(--tp)"/><rect x="14.5" y="15.5" width="11" height="2.2" rx="1.1" fill="var(--tl)"/><rect x="14.5" y="20.5" width="11" height="2.2" rx="1.1" fill="var(--tl)"/><rect x="14.5" y="25.5" width="6.5" height="2.2" rx="1.1" fill="var(--tl)"/><rect x="14.5" y="4.6" width="11" height="6" rx="2" fill="var(--th2)"/><rect x="14.5" y="3.4" width="11" height="6" rx="2" fill="var(--th)"/>',
  // 통계: 원그래프 + 빠져나온 노란 조각
  stats: '<circle cx="18" cy="24" r="12" fill="var(--ts)"/><path d="M18 22h12A12 12 0 1 1 18 10z" fill="var(--tf)"/><path d="M18 22v12A12 12 0 0 1 6 22z" fill="var(--tl)"/><path d="M21 20.6V8.6a12 12 0 0 1 12 12z" fill="var(--th2)"/><path d="M21 19V7a12 12 0 0 1 12 12z" fill="var(--th)"/>',
  // 월간 리포트: 보고서 + 막대 + 노란 책갈피
  report: '<rect x="7" y="7" width="24" height="30" rx="4" fill="var(--ts)"/><rect x="7" y="5" width="24" height="30" rx="4" fill="var(--tf)"/><rect x="10.5" y="9" width="17" height="11" rx="2" fill="var(--tp)"/><rect x="13" y="14.5" width="2.6" height="3.6" rx=".8" fill="var(--tl)"/><rect x="17.4" y="12" width="2.6" height="6.1" rx=".8" fill="var(--tf)"/><rect x="21.8" y="13.4" width="2.6" height="4.7" rx=".8" fill="var(--tl)"/><rect x="10.5" y="23.5" width="17" height="2.2" rx="1.1" fill="var(--tl)"/><rect x="10.5" y="28.5" width="11" height="2.2" rx="1.1" fill="var(--tl)"/><path d="M27 4h7v13.4l-3.5-2.6-3.5 2.6z" fill="var(--th2)"/><path d="M27 2.6h7V16l-3.5-2.6L27 16z" fill="var(--th)"/>',
  // 몇 년 걸리나: 모래시계 + 노란 모래
  years: '<path d="M12 9.4h16c0 6.2-5 8.2-5 11.1s5 4.9 5 11.1H12c0-6.2 5-8.2 5-11.1s-5-4.9-5-11.1z" fill="var(--tl)"/><path d="M14.6 12.4h10.8c-.9 3-3.6 4.4-5.4 6.6-1.8-2.2-4.5-3.6-5.4-6.6z" fill="var(--th)"/><rect x="19.4" y="18.6" width="1.2" height="6.4" rx=".6" fill="var(--th)"/><path d="M13.6 31.6c1.4-3.8 3.9-5.4 6.4-5.9 2.5.5 5 2.1 6.4 5.9z" fill="var(--th)"/><rect x="8.5" y="6.6" width="23" height="4" rx="2" fill="var(--ts)"/><rect x="8.5" y="5" width="23" height="4" rx="2" fill="var(--tf)"/><rect x="8.5" y="32.6" width="23" height="4" rx="2" fill="var(--ts)"/><rect x="8.5" y="31" width="23" height="4" rx="2" fill="var(--tf)"/>',
  // 관심(바로가기 아이콘): 하트 + 노란 반짝
  heart: '<path d="M20 36s-13-7.8-15.6-16C2.6 14 6.3 8.6 12 8.6c3.4 0 6.1 1.9 8 4.8 1.9-2.9 4.6-4.8 8-4.8 5.7 0 9.4 5.4 7.6 11.4C33 28.2 20 36 20 36z" fill="var(--ts)"/><path d="M20 34s-13-7.8-15.6-16C2.6 12 6.3 6.6 12 6.6c3.4 0 6.1 1.9 8 4.8 1.9-2.9 4.6-4.8 8-4.8 5.7 0 9.4 5.4 7.6 11.4C33 26.2 20 34 20 34z" fill="var(--tf)"/><path d="M10.6 12.6c-1.6.6-2.6 2.2-2.6 4" fill="none" stroke="var(--tl)" stroke-width="2" stroke-linecap="round"/><path d="M31.5 1.8l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1z" fill="var(--th)"/>',
  // 구역(바로가기 아이콘): 핀 + 집 + 노란 문
  zone: '<g transform="translate(1.6 2.2) scale(.92)"><path d="M20 38c-4.6-6-13-14.2-13-24.2a13 13 0 0 1 26 0C33 23.8 24.6 32 20 38z" fill="var(--ts)"/><path d="M20 36C15.4 30 7 21.8 7 11.8a13 13 0 0 1 26 0C33 21.8 24.6 30 20 36z" fill="var(--tf)"/><path d="M20 5.4l8.2 7.2h-2.6V21H14.4v-8.4h-2.6z" fill="var(--tp)"/><rect x="17.7" y="14.6" width="4.6" height="6.4" rx=".9" fill="var(--th)"/></g>',
  // 소식(배너): 종 + 노란 점
  bell: '<path d="M10 28.6V18.4a10 10 0 0 1 20 0v10.2l2.8 3.6H7.2z" fill="var(--ts)"/><path d="M10 26.6V16.4a10 10 0 0 1 20 0v10.2l2.8 3.6H7.2z" fill="var(--tf)"/><path d="M16.4 32.6a3.8 3.8 0 0 0 7.2 0z" fill="var(--tl)"/><path d="M14.2 14.8a6 6 0 0 1 3.4-4.4" fill="none" stroke="var(--tl)" stroke-width="2" stroke-linecap="round"/><circle cx="29.6" cy="9.6" r="5" fill="var(--th2)"/><circle cx="29.6" cy="8.4" r="5" fill="var(--th)"/>',
  // 가이드(배너): 펼친 책 + 노란 책갈피
  guide: '<path d="M4 11.4c5.4-1.6 11.2-.8 16 2.4 4.8-3.2 10.6-4 16-2.4v22c-5.4-1.6-11.2-.8-16 2.4-4.8-3.2-10.6-4-16-2.4z" fill="var(--ts)"/><path d="M4 9.4c5.4-1.6 11.2-.8 16 2.4v22c-4.8-3.2-10.6-4-16-2.4z" fill="var(--tf)"/><path d="M20 11.8c4.8-3.2 10.6-4 16-2.4v22c-5.4-1.6-11.2-.8-16 2.4z" fill="var(--tl)"/><path d="M27.4 9v10.6l2.4-1.8 2.4 1.8V8.4" fill="var(--th)"/>',
};
// 아래 탭 '홈'·'지도'(줄 아이콘 · 다른 탭과 같은 굵기)
const TNAV = {
  home: "M4 10.6 12 4l8 6.6V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z",
  map: "M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
};
// 그림 자리(slot) → 디자인 키트(TKIT · tools/build.py가 src/tapp/kit/*.svg에서 넣음)가 있으면 키트, 없으면 위 임시 그림(fb = TI 열쇠)
let tUid = 0;
const tKit = (slot) => !!(slot && TKIT[slot]);
const tKitSvg = (svg, sz, c) => {
  const u = "u" + (++tUid);
  return svg.replace(/__U__/g, "-" + u + "-").replace(/^<svg\b([^>]*)>/, (m, a) => `<svg${a.replace(/\s(width|height|class|aria-hidden|focusable|role)="[^"]*"/g, "")} class="${c}" width="${sz}" height="${sz}" aria-hidden="true" focusable="false">`);
};
// 키트에 '-dark' 짝이 있으면 둘 다 넣고 CSS(.tk-l/.tk-d)가 밝게·어둡게에 맞는 하나만 보인다
const tIcon = (k, s, cls, slot) => {
  const sz = s || 34, c = cls || "ti";
  const kit = slot && TKIT[slot];
  if (kit) {
    const dk = TKIT[slot + "-dark"];
    return dk ? tKitSvg(kit, sz, c + " tk tk-l") + tKitSvg(dk, sz, c + " tk tk-d") : tKitSvg(kit, sz, c + " tk");
  }
  return `<svg class="${c}" width="${sz}" height="${sz}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${TI[k] || ""}</svg>`;
};
