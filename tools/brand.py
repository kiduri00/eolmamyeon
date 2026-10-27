"""서비스 이름(브랜드) 한 곳 정의 — 정적 페이지 생성기(zpages·report·feeds·api·rebuild·zmap·trust·static_tabs)와
SPA·앱 묶음(build.py: 소스의 __BRAND__ · __BRAND_EN__ · __APP_PKG__ · __BRAND_WM__ · __BRAND_ICONS__ · __BRAND_COVER_L/D__ 자리)이 모두 여기서 가져온다.
2026-10-27: 상표 문제로 '집핀 Zippin' → '재개각 Jaegaegak'(재개발 + '각 나왔다'). 도메인은 그대로.
(콘텐츠 트랙 renew-content의 tools/brand.py와 같은 이름·값 + 기능 트랙 항목 — 합칠 때 이 파일 하나로)"""
BRAND = '재개각'                     # 서비스 이름(한글)
BRAND_EN = 'Jaegaegak'               # 영문 표기
TAGLINE = '서울 재개발 지도'          # 로고 옆 작은 글
SITE_TAIL = f'{BRAND} - {TAGLINE}'   # <title> 꼬리
OPERATOR = f'{BRAND} 운영자'   # (예전 이름 — 쓰지 않음)
EDITOR = f'{BRAND} 편집'   # 글쓴이 줄·JSON-LD author(2026-10-27 오너: 개인 운영자 소개 없이 브랜드 편집으로)
SLOGAN = '내 돈으로 갈 수 있는 서울 재개발'
WIT = '내 돈이면 재개각 나옴'
# 예전 이름 — 아래 안내 문장(about·오류 수정 기록)에서만 쓴다. QA(브랜드 잔존 0)의 허용 예외
OLD_NAMES = ('집핀', 'Zippin', 'zippin')
RENAME_DATE = '2026-10-27'
RENAME_NOTE = '2026년 10월에 서비스 이름을 집핀에서 재개각으로 바꿨어요. 다른 회사 상표와 겹치지 않게 하려는 변경이에요. 사이트 주소와 기능은 그대로예요.'
# ---- 기능 트랙(SPA·앱) ----
APP_PKG = 'kr.alwaysquestions.jaegaegak'   # 안드로이드 앱 패키지(assetlinks)
APP_NAME = f'{BRAND} - {SLOGAN}'          # 설치 앱 이름(manifest name)
TOKENS = {'__BRAND_EN__': BRAND_EN, '__APP_PKG__': APP_PKG, '__BRAND__': BRAND}
def sub(s):
    s = sub_assets(s)
    for k, v in TOKENS.items(): s = s.replace(k, v)
    return s

# ---- 브랜드 그림(재개각 v7) — public/icons/ 한 곳. 정적 페이지 생성기도 이 경로·조각을 쓴다 ----
import os as _os, re as _re, urllib.parse as _up
ICON_DIR = '/icons'
ICON_LINKS = ('<link rel="icon" href="/icons/favicon.ico" sizes="32x32">'
              '<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">'
              '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png">')
ICON_192 = '/icons/icon-192.png'
WORDMARK_LIGHT = '/icons/header_wordmark_light.svg'   # 밝은 바탕용(그림 파일로 쓸 때)
WORDMARK_DARK = '/icons/header_wordmark_dark.svg'     # 어두운 바탕용
COVER_BG = ('#1F3A87', '#13265E')                     # 앱 덮개·스플래시 바탕(밝게, 어둡게) — 집 모양은 바탕색으로 뚫어 보이게
_PUB = _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), 'public')
def _rd(p):
    with open(_os.path.join(_PUB, p.lstrip('/')), encoding='utf-8') as f: return f.read()
def wordmark_svg(cls='logo-wm'):
    """머리 워드마크(높이 28px) — 글 속 SVG. 색은 CSS(.wm-a 남색↔흰색 · .wm-b 흰색↔#13265E)로 밝게·어둡게 함께."""
    s = _rd(WORDMARK_LIGHT)
    vb = _re.search(r'viewBox="([^"]+)"', s).group(1); w = _re.search(r' width="([^"]+)"', s).group(1)
    body = _re.sub(r'^.*?<title>.*?</title>', '', s, flags=_re.S).rsplit('</svg>', 1)[0]
    body = body.replace('fill="#1F3A87"', 'class="wm-a"').replace('fill="#FFFFFF"', 'class="wm-b"')
    return f'<svg class="{cls}" viewBox="{vb}" width="{float(w):.0f}" height="28" aria-hidden="true" focusable="false">{body}</svg>'
WORDMARK_CSS = ('.logo-wm{display:block;flex:none;height:28px;width:auto}.logo-wm .wm-a{fill:#1F3A87}.logo-wm .wm-b{fill:#fff}'
                '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .logo-wm .wm-a{fill:#fff}:root:not([data-theme="light"]) .logo-wm .wm-b{fill:#13265E}}'
                ':root[data-theme="dark"] .logo-wm .wm-a{fill:#fff}:root[data-theme="dark"] .logo-wm .wm-b{fill:#13265E}')
def cover_uri(bg):
    """앱 덮개 마크(안드로이드 스플래시와 같은 모양: logo/jaegaegak_mark_dark.svg) — 240×240 칸 가운데, 너비 70 · 높이 100(점 포함)."""
    s = _rd('/icons/jaegaegak_mark_dark.svg')
    body = s.split('>', 1)[1].rsplit('</svg>', 1)[0].replace('#13265E', bg).replace('"', "'")
    k = 70 / 38.0; tx = 120 - (13 + 19) * k; ty = 120 - (6 + 54.27 / 2) * k
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'><g transform='translate({tx:.3f} {ty:.3f}) scale({k:.5f})'>{body}</g></svg>"
    return 'data:image/svg+xml,' + _up.quote(svg, safe="/:=' .,-()")
def sub_assets(s):
    if '__BRAND_WM__' in s: s = s.replace('__BRAND_WM__', wordmark_svg())
    if '__BRAND_ICONS__' in s: s = s.replace('__BRAND_ICONS__', ICON_LINKS)
    if '__BRAND_COVER_L__' in s: s = s.replace('__BRAND_COVER_L__', cover_uri(COVER_BG[0]))
    if '__BRAND_COVER_D__' in s: s = s.replace('__BRAND_COVER_D__', cover_uri(COVER_BG[1]))
    return s
