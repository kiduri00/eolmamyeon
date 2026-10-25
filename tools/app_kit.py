#!/usr/bin/env python3
"""설치 앱 디자인 키트(v2)를 앱 화면 묶음 자리로 옮긴다 — 한 번 돌려 결과(src/tapp/kit/*.svg · public/sc-*.png)를 저장소에 둔다.
사용: python3 tools/app_kit.py <키트 폴더(README.md가 있는 app_kit)>
- 그림 이름 → 자리 이름(src/tapp/00_icons.js tIcon의 slot). '_dark' 짝은 '<자리>-dark'.
- 아주 큰 그림(관심 구역 안내의 서울 윤곽선)은 꺾인 선 점을 줄인다(Douglas–Peucker 0.35px · 화면 크기에서 차이 없음).
- 바로가기 PNG(96·192)는 public/sc-<이름>-<크기>.png 로.
빌드(tools/build.py)는 src/tapp/kit/*.svg를 앱 묶음(/b/t.*.js)에 넣는다. 웹 묶음에는 들어가지 않는다."""
import os, re, sys, shutil

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = sys.argv[1] if len(sys.argv) > 1 else None
if not KIT or not os.path.exists(os.path.join(KIT, 'README.md')):
    sys.exit('키트 폴더(README.md 있는 곳)를 주세요')
OUT = os.path.join(R, 'src', 'tapp', 'kit')
MAP = {
    'icons/grid/map': 'grid-map', 'icons/grid/ranking': 'grid-rank', 'icons/grid/move_in_calc': 'grid-calc',
    'icons/grid/save_when': 'grid-save', 'icons/grid/commute': 'grid-commute', 'icons/grid/listing_check': 'grid-diag',
    'icons/grid/pre_purchase_rules': 'grid-rules', 'icons/grid/stats': 'grid-stats', 'icons/grid/monthly_report': 'grid-report',
    'icons/grid/how_long': 'grid-years',
    'icons/feed/deal_price': 'feed-trade', 'icons/feed/auction': 'feed-auction', 'icons/feed/notice': 'feed-notice',
    'icons/feed/stage_change': 'feed-stage', 'icons/extra/zone': 'feed-price', 'icons/extra/favorite': 'extra-fav',
    'illustrations/banner/banner_report': 'banner-report', 'illustrations/banner/banner_moatown': 'banner-guide',
    'illustrations/banner/banner_alarm': 'banner-alert',
    'illustrations/onboarding/onboarding_money': 'onb-1', 'illustrations/onboarding/onboarding_favorite': 'onb-2',
    'illustrations/onboarding/onboarding_alarm': 'onb-3',
    'illustrations/empty/empty_news': 'empty-feed', 'illustrations/empty/empty_favorites': 'empty-fav',
    'illustrations/empty/offline': 'offline',
}
for k in ('home', 'map', 'favorite', 'news', 'my'):
    t = {'favorite': 'fav'}.get(k, k)
    MAP[f'nav/nav_{k}'] = f'tab-{t}'
    MAP[f'nav/nav_{k}_active'] = f'tab-{t}-on'


def dp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    if abs(x1 - x2) < 1e-6 and abs(y1 - y2) < 1e-6:   # 닫힌 고리: 첫 점에서 가장 먼 점으로 둘로 나눠 줄인다
        k = max(range(len(pts)), key=lambda j: (pts[j][0] - x1) ** 2 + (pts[j][1] - y1) ** 2)
        if k == 0: return pts[:1]
        return dp(pts[:k + 1], eps)[:-1] + dp(pts[k:], eps)
    dx, dy = x2 - x1, y2 - y1
    L = (dx * dx + dy * dy) ** .5 or 1e-9
    i, dm = 0, 0
    for j in range(1, len(pts) - 1):
        d = abs(dy * pts[j][0] - dx * pts[j][1] + x2 * y1 - y2 * x1) / L
        if d > dm: i, dm = j, d
    if dm <= eps: return [pts[0], pts[-1]]
    return dp(pts[:i + 1], eps)[:-1] + dp(pts[i:], eps)


def simplify(s, eps=0.45):
    # 꺾인 선(M/L/Z만)으로 된 길만: 하위 길(M…Z)마다 따로 줄인다
    def one(m):
        d = m.group(1)
        if not re.fullmatch(r'(?:[MLZ]|-?[\d.]+,-?[\d.]+|\s)+', d): return m.group(0)
        out = []
        for sp in re.findall(r'M[^M]*', d):
            z = 'Z' in sp
            pts = [(float(a), float(b)) for a, b in re.findall(r'(-?[\d.]+),(-?[\d.]+)', sp)]
            if z and pts and max(max(x for x, _ in pts) - min(x for x, _ in pts), max(y for _, y in pts) - min(y for _, y in pts)) < 1.6: continue   # 1.6px보다 작은 조각은 화면에서 안 보인다
            q = dp(pts, eps)
            if len(q) < 3 and z: continue
            out.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in q) + ('Z' if z else ''))
        return 'd="' + ''.join(out) + '"'
    s = re.sub(r'd="([^"]+)"', one, s)
    return re.sub(r'<path d=""[^>]*/>', '', s)


os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.svg'): os.remove(os.path.join(OUT, f))
n = 0
for src, slot in MAP.items():
    for suf in ('', '_dark'):
        p = os.path.join(KIT, src + suf + '.svg')
        if not os.path.exists(p): continue
        s = open(p, encoding='utf-8').read()
        if len(s) > 20000: s = simplify(s)
        open(os.path.join(OUT, slot + ('-dark' if suf else '') + '.svg'), 'w', encoding='utf-8').write(s)
        n += 1
print('kit svg', n)
for k, o in (('map', 'map'), ('favorites', 'fav'), ('report', 'report'), ('zone', 'zone')):
    for sz in (96, 192):
        p = os.path.join(KIT, 'png', 'shortcuts', f'shortcut_{k}_{sz}.png')
        if os.path.exists(p): shutil.copyfile(p, os.path.join(R, 'public', f'sc-{o}-{sz}.png'))
print('shortcuts ok')
