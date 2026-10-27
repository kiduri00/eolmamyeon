"""역 이름 고치기·새 역 넣기·가까운 역 다시 고르기 — 한 곳(앱 화면·/z·API가 같은 '가까운 역'을 쓰게).
build.py(앱에 싣는 자료)와 api.py(공개 API)가 같은 함수를 부른다. calc.json(→ /z·리포트)은 build.py가 고친 앱 자료에서 뽑으므로 같은 값.
src/app.js의 D.stFix 분기와 같은 규칙(빌드가 했으면 앱은 건너뜀)."""
import re
def st_fix(D):
    import math
    if D.get('stFix') or not isinstance(D.get('stations'), list): return
    ST_FIX = {'당고개역': '불암산역', '구회의사당역': '국회의사당역', '영등포 구청역': '영등포구청역', '잠실시내역': '잠실새내역', '시가정역': '사가정역'}
    LN_FIX = {'경의중앙': '경의중앙선', '김포 골드라인': '김포골드라인', '신림역': '신림선'}
    stName = lambda n: ST_FIX.get(n) or re.sub(r'(\S) (구청역|시청역)$', r'\1\2', n)
    uniq = lambda a: list(dict.fromkeys(a))
    for st in D['stations']:
        st[0] = stName(st[0]); st[3] = uniq([LN_FIX.get(l, l) for l in st[3]])
    NEW_ST = [['천왕역', 37.486637, 126.838713, ['7호선']], ['온수역', 37.492258, 126.823388, ['1호선', '7호선']], ['오류동역', 37.494526, 126.845365, ['1호선']], ['개봉역', 37.494594, 126.85868, ['1호선']],
              ['사당역', 37.47653, 126.981685, ['2호선', '4호선']], ['영등포역', 37.515504, 126.907628, ['1호선']], ['여의나루역', 37.527098, 126.932901, ['5호선']], ['마포역', 37.539574, 126.945932, ['5호선']],
              ['가좌역', 37.568491, 126.915487, ['경의중앙선']], ['서강대역', 37.551881, 126.935711, ['경의중앙선']], ['압구정로데오역', 37.527381, 127.040534, ['수인분당선']], ['남태령역', 37.463873, 126.989134, ['4호선']],
              ['중앙보훈병원역', 37.528807, 127.148488, ['9호선']], ['보라매공원역', 37.4954, 126.9182, ['신림선']]]
    jr = lambda v: math.floor(v + 0.5)
    for n, la, lo, ln in NEW_ST:
        x = jr((2272.72439 * lo - 0.00834955 * la - 288078.866) * 10) / 10; y = jr((-0.0013117628 * lo - 2866.9639 * la + 108107.651) * 10) / 10
        D['stations'].append([n, la, lo, ln, int(x) if x == int(x) else x, int(y) if y == int(y) else y])
    def hav(a, b):
        t = math.pi / 180; dl = (b[0] - a[0]) * t; dn = (b[1] - a[1]) * t
        x = math.sin(dl / 2) ** 2 + math.cos(a[0] * t) * math.cos(b[0] * t) * math.sin(dn / 2) ** 2
        return 12742e3 * math.asin(math.sqrt(x))
    for r in D['recs']:
        if r.get('st'): r['st']['n'] = stName(r['st']['n'])
        for x in (r.get('s3') or []):
            x[0] = stName(x[0]); x[2] = uniq([LN_FIX.get(l, l) for l in (x[2] or [])])
        if r.get('s3'):
            seen = set(); o = []
            for x in r['s3']:
                k = re.sub(r'\s', '', x[0])
                if k in seen: continue
                seen.add(k); o.append(x)
            r['s3'] = o
        if r.get('ln'): r['ln'] = uniq([LN_FIX.get(l, l) for l in r['ln']])
        if not r.get('ll') or not r.get('st'): continue
        worst = r['s3'][2][1] if r.get('s3') and len(r['s3']) >= 3 else float('inf')
        if not any((lambda d: d < worst or d <= 1e3)(hav(r['ll'], [s[1], s[2]])) for s in NEW_ST): continue
        al = sorted(((s, hav(r['ll'], [s[1], s[2]])) for s in D['stations']), key=lambda z: z[1])
        seen = set(); s3 = []
        for s, d in al:
            if s[0] in seen: continue
            seen.add(s[0]); s3.append([s[0], jr(d), s[3]])
            if len(s3) == 3: break
        r['st'] = {'n': s3[0][0], 'd': s3[0][1]}; r['s3'] = s3
        r['ln'] = uniq([l for s, d in al if d <= 1e3 for l in s[3]])
    D['stFix'] = 1
