#!/usr/bin/env python3
"""주변 빌라 매수가 표본(구역 경계에서 300·500·800m) 다시 만들기 — 거래 하나하나까지 남겨 화면에서 확인할 수 있게.
예전 기준 자료(data.base.json)의 '주변 300m 빌라 17건' 값은 어떤 거래였는지 남아 있지 않아 거래 탭에서 맞춰 볼 수 없었다.
입력: pipeline/raw/sale_*.csv(서울 부동산 실거래), pipeline/data.base.json(어느 구역이 주변 표본을 쓰는지·반경·준공 상한),
      pipeline/geo.full.json 또는 public/data/geo.json(구역 경계)
캐시: pipeline/cache/pnu_ll.json {PNU: [lat, lng] | null} — 연속지적(서울도시공간포털 layer 1) 필지 중심(enrich.py와 같은 파일)
출력: pipeline/near.json {구역id: 표본 요약 + rows} → enrich.py가 mk.entry를 이 값으로 바꾼다
      public/data/near.json {구역id: {r: 반경, w: 개월, s: [[계약일, 전용㎡, 대지㎡, 준공, 만원, 층, '동 본번-부번', 경계에서 m]]}} → 거래 탭 '매수가 표본'
표본 규칙(예전과 같음): 연립·다세대 매매(취소 제외) · 전용 30~70㎡ · 준공 ≤ 준공 상한(기본 2010) · 경계에서 반경 안(경계 안 포함)
  · 최근 12개월(원자료 마지막 계약일 기준), 3건 미만이면 24개월 · 6건 이상이면 ㎡당 값 IQR 1.5배 밖은 뺌
사용: python3 tools/near.py [--max-req N] (NO_NET=1이면 캐시에 있는 필지만)"""
import csv, json, os, sys, math, glob, time, subprocess, urllib.parse, statistics as st, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
J = lambda p, d=None: json.load(open(P(p), encoding='utf-8')) if os.path.exists(P(p)) else d
MAXREQ = int(sys.argv[sys.argv.index('--max-req') + 1]) if '--max-req' in sys.argv else 2000
D = J('pipeline/data.base.json') or J('src/data.json')
GF = J('pipeline/geo.full.json') or J('public/data/geo.json')
GEO = GF['z']
act = lambda r: not (r['s'] >= 9 or (r.get('dn') and r['s'] < 7))
Z = []
for r in D['recs']:
    en = (r.get('mk') or {}).get('entry') or {}
    if act(r) and r.get('src') != 'moa' and en.get('src') == 'villa' and (en.get('radius') or 0) >= 100:
        Z.append((r, en['radius'], en.get('yr_cap') or 2010))
# ---- 실거래
rows = []
for f in sorted(glob.glob(P('pipeline/raw/sale_*.csv'))):
    rd = csv.reader(open(f, encoding='cp949', errors='replace')); h = next(rd); ix = {k: i for i, k in enumerate(h)}
    for x in rd:
        if x[ix['건물용도']] != '연립다세대' or x[ix['취소일']].strip(): continue
        try:
            a = float(x[ix['건물면적(㎡)']]); yr = int(x[ix['건축년도']] or 0); pr = int(x[ix['물건금액(만원)']].replace(',', ''))
            land = float(x[ix['토지면적(㎡)']] or 0)
        except ValueError: continue
        if not (30 <= a <= 70) or yr <= 0: continue
        bn, bb = int(x[ix['본번']] or 0), int(x[ix['부번']] or 0)
        if not bn: continue
        pnu = f"{x[ix['자치구코드']]}{x[ix['법정동코드']]}{'2' if x[ix['지번구분']] == '2' else '1'}{bn:04d}{bb:04d}"
        rows.append((x[ix['계약일']], a, round(land, 1), yr, pr, x[ix['층']], f"{x[ix['법정동명']]} {bn}{'-' + str(bb) if bb else ''}", pnu))
if not rows or not Z:
    print('near: 자료 없음'); sys.exit(0)
asof = max(r[0] for r in rows)
def back(m):
    y, mo = int(asof[:4]), int(asof[4:6]) - m
    while mo <= 0: y -= 1; mo += 12
    return f"{y:04d}{mo:02d}{asof[6:]}"
C24 = back(24)
rows = [r for r in rows if r[0] >= C24 and r[0] <= asof]
# ---- 필지 좌표(캐시 + 40개씩 조회)
_PLP = P('pipeline/cache/pnu_ll.json')
PLL = json.load(open(_PLP)) if os.path.exists(_PLP) else {}
UB = "https://urban.seoul.go.kr/proxy/proxy.jsp?http://98.33.2.225:6080/arcgis/rest/services/UPIS/20200526_WFS/MapServer/1/query?"
need = sorted({r[7] for r in rows} - set(PLL))
nreq = 0
if need and not os.environ.get('NO_NET'):
    from shapely.geometry import Polygon
    print(f'near: 필지 좌표 {len(need)}개 조회')
    for i in range(0, len(need), 40):
        if nreq >= MAXREQ: break
        ch = need[i:i + 40]; nreq += 1
        q = urllib.parse.urlencode({'f': 'json', 'where': "PNU IN (" + ",".join(f"'{x}'" for x in ch) + ")", 'outFields': 'PNU', 'returnGeometry': 'true', 'outSR': '4326', 'maxAllowableOffset': '0.00005'})
        fs = None
        for k in range(3):
            try:
                o = subprocess.run(['curl', '-sS', '--max-time', '60', UB + q], capture_output=True, text=True, timeout=70).stdout
                fs = json.loads(o).get('features'); break
            except Exception: time.sleep(2)
        if fs is None: continue   # 실패는 캐시하지 않음(다음 실행 때 다시)
        for x in ch: PLL[x] = None
        for ft in fs:
            try:
                g = Polygon(ft['geometry']['rings'][0]).buffer(0); c = g.centroid if g.contains(g.centroid) else g.representative_point()
                PLL[ft['attributes']['PNU']] = [round(c.y, 6), round(c.x, 6)]
            except Exception: pass
        if nreq % 25 == 0:
            json.dump(PLL, open(_PLP, 'w'), separators=(',', ':')); print(f'  {i + len(ch)}/{len(need)}', flush=True)
    json.dump(PLL, open(_PLP, 'w'), separators=(',', ':'))
# ---- 구역마다 반경 안 거래
def ring_dist(lat0):
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110950
    def inside(x, y, rg):
        c = False
        for i in range(len(rg)):
            x1, y1 = rg[i]; x2, y2 = rg[i - 1]
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
        return c
    def dist(rings, lng, lat):
        if any(inside(lng, lat, rg) for rg in rings): return 0
        b = 1e12; px, py = lng * kx, lat * ky
        for rg in rings:
            for i in range(len(rg)):
                ax, ay = rg[i - 1][0] * kx, rg[i - 1][1] * ky; bx, by = rg[i][0] * kx, rg[i][1] * ky
                dx, dy = bx - ax, by - ay; t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / ((dx * dx + dy * dy) or 1)))
                b = min(b, math.hypot(px - ax - t * dx, py - ay - t * dy))
        return b
    return dist
GEO_PTS = [(r, PLL.get(r[7])) for r in rows]
GEO_PTS = [(r, ll) for r, ll in GEO_PTS if ll]
ym = lambda d: d[2:4] + '.' + d[4:6]
OUT, PUB, stat = {}, {}, collections.Counter()
C12 = back(12)
for r, rad, ycap in Z:
    z = GEO.get(r['id'])
    if z and z.get('g'): rings = z['g']
    elif r.get('ll'):
        la, lo = r['ll']; rings = [[[lo, la]]]
    else: stat['no_geo'] += 1; continue
    lat0 = rings[0][0][1]; dist = ring_dist(lat0)
    lo0 = min(p[0] for rg in rings for p in rg); lo1 = max(p[0] for rg in rings for p in rg); la0 = min(p[1] for rg in rings for p in rg); la1 = max(p[1] for rg in rings for p in rg)
    pad_la, pad_lo = rad / 110950 + 1e-4, rad / (111320 * math.cos(math.radians(lat0))) + 1e-4
    near = []
    for x, (la, lo) in GEO_PTS:
        if x[3] > ycap or la < la0 - pad_la or la > la1 + pad_la or lo < lo0 - pad_lo or lo > lo1 + pad_lo: continue
        d = dist(rings, lo, la)
        if d <= rad: near.append(x + (round(d),))
    S, w = [x for x in near if x[0] >= C12], 12
    if len(S) < 3: S, w = near, 24
    if len(S) >= 6:
        u = sorted(x[4] / x[1] for x in S); q = st.quantiles(u, n=4); lo, hi = q[0] - 1.5 * (q[2] - q[0]), q[2] + 1.5 * (q[2] - q[0])
        S = [x for x in S if lo <= x[4] / x[1] <= hi]
    if not S: stat['empty'] += 1; continue
    S.sort(key=lambda x: x[0], reverse=True)
    ps = [x[4] for x in S]; qs = st.quantiles(ps, n=4) if len(ps) >= 2 else [ps[0]] * 3
    L = [x for x in S if x[2] > 0]
    u = int(st.median([x[4] / x[2] * 3.3058 for x in L]) + 0.5) if L and len(L) >= -(-len(S) // 2) else None
    OUT[r['id']] = {'n': len(S), 'p25': int(round(qs[0])), 'med': int(round(st.median(ps))), 'p75': int(round(qs[2])), 'area_med': round(st.median([x[1] for x in S]), 1),
                    'last': S[0][0][2:4] + '.' + S[0][0][4:6] + '.' + S[0][0][6:8], 'f': ym(S[-1][0]), 't': ym(S[0][0]), 'w': w, 'radius': rad, 'yr_cap': ycap,
                    **({'u': u, 'nl': len(L)} if u else {})}
    PUB[r['id']] = {'r': rad, 'w': w, 's': [[x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[8]] for x in S]}
    stat['ok'] += 1
json.dump({'asOf': asof, 'z': OUT}, open(P('pipeline/near.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({'asOf': asof, 'z': PUB}, open(P('public/data/near.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f"near: 구역 {len(Z)}곳 중 표본 {stat['ok']}곳 · 빈 곳 {stat['empty']} · 경계 없음 {stat['no_geo']} · 좌표 조회 {nreq}회 · 기준 {asof}")
