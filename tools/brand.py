"""서비스 이름(브랜드) 한 곳 정의 — 정적 페이지 생성기(zpages·report·feeds·api·rebuild·zmap·trust·static_tabs)와
SPA·앱 묶음(build.py: 소스의 __BRAND__ · __BRAND_EN__ · __APP_PKG__ · __BRAND_WM__ · __BRAND_ICONS__ · __BRAND_COVER_L/D__ 자리)이 모두 여기서 가져온다.
2026-10-27: 상표 문제로 '집핀 Zippin'을 쓰지 않는다. 새 이름은 BRAND(재개픽) — 이름이 다시 바뀌면 아래 BRAND·BRAND_EN·APP_PKG 값만 바꾸면
정적 페이지·SPA·앱·manifest·assetlinks·QA 기대값이 모두 따라간다(이름을 다른 파일에 직접 쓰지 않는다). 도메인은 그대로.
(콘텐츠 트랙 renew-content의 tools/brand.py와 같은 이름·값 + 기능 트랙 항목 — 합칠 때 이 파일 하나로)"""
BRAND = '재개픽'                     # 서비스 이름(한글) — 2026-10-27 확정(내 돈으로 갈 수 있는 재개발을 골라 준다 · Pick)
BRAND_EN = 'JaegaePick'              # 영문 표기
TAGLINE = '서울 재개발 지도'          # 로고 옆 작은 글
SITE_TAIL = f'{BRAND} - {TAGLINE}'   # <title> 꼬리
EDITOR = f'{BRAND} 편집'   # 글쓴이 줄·JSON-LD author(2026-10-27 오너: 개인 운영자 소개 없이 브랜드 편집으로)
SLOGAN = '내 돈으로 갈 수 있는 서울 재개발'
WIT = '내 돈으로 어디까지 갈 수 있을까?'   # 홈 소개 블록 첫 줄(2026-10-28 오너: 말장난·유행어 없이 차분하게 · '될랑가'는 QA 금지어)
# 예전 이름 — 사이클 4 통합(2026-10-29 오너 'Pick 콘셉트로 집핀·얼마면 재개발 흔적 모두 삭제'): 화면·검색 노출 어디에도 쓰지 않는다. QA(브랜드 잔존 0)의 금지어 목록(검사 장치라 남김)
OLD_NAMES = ('집핀', 'Zippin', 'zippin', '얼마면 재개발', '얼마면재개발', '재개각', 'Jaegaegak', 'jaegaegak', '재개랩', 'JaegaeLab')   # brand.residual 금지어(재개각·재개랩은 공개된 적 없는 검토안 — 안내 문구에도 쓰지 않는다)
# 쓰지 않는 말투(2026-10-28 오너: '유치한 건 빼고 세련되게') — QA tone.banned가 public·src 전체에서 0건인지 본다
BANNED = ('될랑가', '각 나옴', '각 나왔다', '재개각', '사세요', '급매', '낙찰 가능', '무조건', '대박', '놓치지')   # 사이클 5(C 제안·리드): 권유·과장 말 사이트 전체 0 · 추천·확정·보장·수익·기회·신고가는 qa_today에서만
def _batchim(w): c = ord(w[-1]) - 0xAC00; return 0 <= c < 11172 and c % 28   # 받침 번호(0 = 없음 · 8 = ㄹ)
def josa_ro(w): b = _batchim(w); return w + ('으로' if b and b != 8 else '로')   # '…으로/로'
def josa_eun(w): return w + ('은' if _batchim(w) else '는')
# ---- 기능 트랙(SPA·앱) ----
APP_PKG = 'kr.alwaysquestions.jaegaepick'   # 안드로이드 앱 패키지(assetlinks · QA 기대값)
LEGACY_PKG = 'kr.alwaysquestions.zippin'   # 이미 설치된 예전 시험 앱(화면에 안 보이는 기술 식별자 · Play 출시 뒤 뺌) — assetlinks에 함께 둬야 그 앱의 주소 열기가 끊기지 않는다
OLD_PKGS = (LEGACY_PKG,)   # QA brand.residual 허용 예외: assetlinks의 이 패키지 식별자만
# assetlinks 서명 지문(두 패키지 공통) — 지금은 업로드 키 · Play 앱 서명 지문이 나오면 이 목록에 더한다
SIGNING_SHA256 = ['CA:7E:87:4A:C9:9C:A4:AD:53:2F:24:4C:17:43:7A:5F:F2:03:B3:97:4F:01:78:C8:44:98:38:C7:54:15:0F:9B']
ALT_NAMES = (BRAND_EN,)   # JSON-LD alternateName — 사이클 4 통합(오너): 예전 이름 없이 영문 이름만
APP_NAME = BRAND                          # 설치 앱 이름(manifest name)
import json as _json
TOKENS = {'__ALT_NAMES__': _json.dumps(list(ALT_NAMES), ensure_ascii=False, separators=(',', ':')), '__BRAND_EN__': BRAND_EN, '__APP_PKG__': APP_PKG, '__BRAND__': BRAND}
def sub(s):
    s = sub_assets(s)
    for k, v in TOKENS.items(): s = s.replace(k, v)
    return s

# ---- 브랜드 그림(v7) — public/icons/ 한 곳. 정적 페이지 생성기도 이 경로·조각을 쓴다 ----
import os as _os, re as _re, urllib.parse as _up
ICON_DIR = '/icons'
ICON_LINKS = ('<link rel="icon" href="/icons/favicon.ico" sizes="32x32">'
              '<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">'
              '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png">')
ICON_192 = '/icons/icon-192.png'
WORDMARK_LIGHT = '/icons/header_wordmark_light.svg'   # 밝은 바탕용(그림 파일로 쓸 때)
WORDMARK_DARK = '/icons/header_wordmark_dark.svg'     # 어두운 바탕용
LOGO_H_LIGHT = 'tools/brand_assets/brand_horizontal_ko_light.png'   # 공유 그림(og)용 가로 로고 — 이름이 바뀌면 디자이너 새 파일(같은 경로로 덮어씀) 경로로
LOGO_H_DARK = 'tools/brand_assets/brand_horizontal_ko_dark.png'
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
# 사이클 2(브랜드 콘셉트 '픽'으로 마크 교체 예정): 마크를 글 속에 직접 쓰지 않고 이 파일들만 읽는다 — 새 에셋은 같은 경로로 덮어쓰면 끝
MARK_FILE = '/icons/brand_mark_dark.svg'          # 작은 마크(첫 화면 소개 줄 st-k 등 글 속 마크 · brand_v7 logo/*_mark_dark.svg)
COVER_MARK_FILES = ('/icons/cover_mark_light.svg', '/icons/cover_mark_dark.svg')   # 덮개 마크(디자이너 web/cover_mark_*.svg · 2026-10-28 '픽' 마크) — 덮개 바탕이 남색이라 _dark(흰 몸통)를 쓴다 · _light는 밝은 바탕용 예비
def mark_svg(cls='mk', h=17):
    """글 속 작은 마크(높이 h px) — MARK_FILE 그대로 · 흰 몸통 → class '{cls}-p'(CSS로 남색) · 남색 집 → '{cls}-h'(CSS로 바탕색) · 나머지 색은 그대로."""
    s = _rd(MARK_FILE)
    vb = _re.search(r'viewBox="([^"]+)"', s).group(1); n = [float(x) for x in vb.split()]
    body = _re.sub(r'<title>.*?</title>', '', s.split('>', 1)[1].rsplit('</svg>', 1)[0], flags=_re.S)
    body = body.replace('fill="#FFFFFF"', f'class="{cls}-p"').replace('fill="#13265E"', f'class="{cls}-h"')
    return f'<svg class="{cls}" width="{round(h * n[2] / n[3])}" height="{h}" viewBox="{vb}" aria-hidden="true">{body}</svg>'
def cover_uri(bg):
    """앱 덮개 마크(남색 바탕 240×240 칸 가운데) — 디자이너 덮개 파일(web/cover_mark_dark.svg · 64×64, 흰 몸통·노란 문·노란 체크)을 그대로 넣고
    가운데 너비 약 84px(64칸 100px)로 놓는다 · 파일 안 짙은 남색(#13265E)은 덮개 바탕색으로(밝게·어둡게 바탕이 달라도 이음새 없게)
    덮개 파일이 없으면 MARK_FILE(viewBox 그대로)로 같은 크기에 맞춘다."""
    cf = _os.path.join(_PUB, COVER_MARK_FILES[1].lstrip('/'))
    if _os.path.exists(cf):
        s = _rd(COVER_MARK_FILES[1]); x, y, w, h = 0.0, 0.0, 64.0, 64.0; size = 100.0
        vb = _re.search(r'viewBox="([^"]+)"', s)
        if vb: x, y, w, h = [float(v) for v in vb.group(1).split()]
    else:
        s = _rd(MARK_FILE); x, y, w, h = [float(v) for v in _re.search(r'viewBox="([^"]+)"', s).group(1).split()]; size = 84.0
    body = _re.sub(r'<title>.*?</title>', '', s.split('>', 1)[1].rsplit('</svg>', 1)[0], flags=_re.S).replace('#13265E', bg).replace('"', "'")
    k = size / max(w, h); tx = 120 - (x + w / 2) * k; ty = 120 - (y + h / 2) * k
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'><g transform='translate({tx:.3f} {ty:.3f}) scale({k:.5f})'>{body}</g></svg>"
    return 'data:image/svg+xml,' + _up.quote(svg, safe="/:=' .,-()")
def sub_assets(s):
    if '__BRAND_WM__' in s: s = s.replace('__BRAND_WM__', wordmark_svg())
    if '__BRAND_MARK_SM__' in s: s = s.replace('__BRAND_MARK_SM__', mark_svg())
    if '__BRAND_ICONS__' in s: s = s.replace('__BRAND_ICONS__', ICON_LINKS)
    if '__BRAND_COVER_L__' in s: s = s.replace('__BRAND_COVER_L__', cover_uri(COVER_BG[0]))
    if '__BRAND_COVER_D__' in s: s = s.replace('__BRAND_COVER_D__', cover_uri(COVER_BG[1]))
    return s
