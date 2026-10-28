/* 고른 상태(pick) 공용 언어 — 모양·색은 00_pick.css(토큰 --zp-pick* · 클래스 아래).
   빌드의 CSS 정리(build.py prune_css)는 소스 어디에도 없는 클래스 규칙을 지우므로 이름을 여기 모두 둔다:
   zp-check zp-check-s zp-pk zp-pk-fill is-picked zp-picked zp-soft
   ZP_pick.badge(small) → 체크 배지 HTML(aria-hidden) · ZP_pick.set(el, on, attr = "aria-pressed") → 상태 속성 + is-picked */
window.ZP_pick = {
  badge: (s) => `<i class="zp-check${s ? " zp-check-s" : ""}" aria-hidden="true"></i>`,
  set: (el, on, attr = "aria-pressed") => { if (!el) return; el.classList.add("zp-pk"); if (attr) el.setAttribute(attr, String(!!on)); el.classList.toggle("is-picked", !!on); },
};
