"""서비스 이름 — 이 파일 한 곳에서만 정한다(2026-10-27 '집핀' → '재개각').
SPA·앱 묶음(build.py): 소스의 __BRAND__ · __BRAND_EN__ · __APP_PKG__ 자리를 이 값으로 바꾼다.
정적 페이지 생성기(zpages·report·rebuild·feeds·api·zmap 등)도 `from brand import BRAND, BRAND_EN` 로 쓴다."""
BRAND = '재개각'
BRAND_EN = 'Jaegaegak'
APP_PKG = 'kr.alwaysquestions.jaegaegak'
TAGLINE = '서울 재개발 지도'
SLOGAN = '내 돈으로 갈 수 있는 서울 재개발'   # 핵심 문구(그대로 쓴다)
APP_NAME = f'{BRAND} - {SLOGAN}'          # 설치 앱 이름(manifest name)
# 옛 이름(잔존 검사 brand.residual 전용 — 화면 문구에 쓰지 않는다)
OLD = ('집핀', 'Zippin', 'zippin', 'ZIPPIN')
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
