"""화면(app.js)과 같은 반올림으로 숫자 글자를 만드는 함수 — 정적 페이지·API·리포트가 앱과 1 차이 나지 않게.
파이썬 round()는 .5를 짝수로 보낸다(6.5 → 6). 앱의 Math.round는 올린다(6.5 → 7)."""
import math
def jround(x):
    """JS Math.round와 같다(.5는 +무한 쪽)."""
    return math.floor(x + 0.5)
def walk_min(d):
    """역까지 도보 분 = 거리(m) × 1.3 ÷ 67 (app.js·64_overview와 같은 식·반올림) · 최소 1분."""
    return None if d is None else max(1, jround(d * 1.3 / 67))
def prob(v):
    """10년 안 준공 가능성 % (app.js prob: 97% 상한)."""
    return None if v is None else min(97, jround(v * 100))
def prob_txt(v):
    """app.js probTxt와 같은 글자: 1% 미만은 '1% 미만'(0%로 보이지 않게)."""
    return '–' if v is None else '1% 미만' if v < 0.01 else f'{prob(v)}%'
