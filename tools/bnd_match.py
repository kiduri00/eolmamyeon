#!/usr/bin/env python3
"""구역 경계 매칭: 서울도시공간포털 정비구역(UQ181) + 서울시 정비사업 현황(UQ120) → 레코드별 폴리곤.
입력: --data src/data.json --uq181 zones.json(esri features) --uq120 seoulplan.geojson --sgg sgg.json
출력: public/data/geo.json  {seoul, gu, z:{id:{g,l,a,nm,src,e?}}}  (e=1: 공식 경계 없음 → 면적 기준 추정 범위)
"""
import json, re, math, argparse, collections
from shapely.geometry import shape, Point, Polygon, MultiPolygon
from shapely.strtree import STRtree
from shapely.ops import unary_union

ap = argparse.ArgumentParser()
for a in ('data', 'uq181', 'uq120', 'sgg', 'out', 'report'): ap.add_argument('--' + a)
A = ap.parse_args()
D = json.load(open(A.data, encoding='utf-8')); R = D['recs']

def esri_poly(g):
    outers, holes = [], []
    for rg in g['rings']:
        if len(rg) < 4: continue
        a = sum(rg[i][0]*rg[i+1][1] - rg[i+1][0]*rg[i][1] for i in range(len(rg)-1))
        (outers if a < 0 else holes).append(rg)
    if not outers: outers = g['rings']
    ps = [Polygon(o, [h for h in holes if Polygon(o).contains(Point(h[0]))]).buffer(0) for o in outers]
    ps = [q for p in ps for q in (p.geoms if hasattr(p, 'geoms') else [p]) if not q.is_empty]
    return ps[0] if len(ps) == 1 else MultiPolygon(ps)

SGG = json.load(open(A.sgg, encoding='utf-8'))
def gu_name(a): return a.get('SIG_KOR_NM') or a.get('SGG_NM') or next((v for v in a.values() if isinstance(v, str) and v.endswith('구')), '')
GUP = [(gu_name(f['attributes']), esri_poly(f['geometry'])) for f in SGG]
GUCODE = {}
for f in SGG:
    a = f['attributes']; code = next((str(v) for k, v in a.items() if 'CD' in k.upper() and str(v).startswith('11')), None)
    if code: GUCODE[code[:5]] = gu_name(a)

POLY, META = [], []
for f in json.load(open(A.uq181, encoding='utf-8')):
    try: p = esri_poly(f['geometry'])
    except Exception: continue
    a = f['attributes']; POLY.append(p); META.append({'src': 'uq181', 'nm': a.get('DGM_NM') or '', 'cl': a.get('ATRB_SE') or '', 'sg': str(a.get('SIGNGU_SE') or '')})
for f in json.load(open(A.uq120, encoding='utf-8'))['features']:
    try: p = shape(f['geometry']).buffer(0)
    except Exception: continue
    a = f['properties']; POLY.append(p); META.append({'src': 'uq120', 'nm': (a.get('DGM_NM') or '').strip(), 'cl': a.get('ATRB_SE') or '', 'sg': str(a.get('SIGNGU_SE') or '')})
TREE = STRtree(POLY)
KX = lambda lat: 111320*math.cos(math.radians(lat))
def area_m2(g): return g.area*KX(g.centroid.y)*110540
AREA = [area_m2(g) for g in POLY]
for i, m in enumerate(META):
    c = POLY[i].representative_point(); m['gu'] = next((n for n, gp in GUP if gp.contains(c)), GUCODE.get(m['sg'][:5], ''))

STOP = r'(주택|재개발|재건축|정비|사업|조합|구역|지구|추진위원회|도시환경|재정비촉진|주거환경|번지|일대|일원|가로주택|소규모|아파트|도시정비형|주택정비형|역세권|공공|모아타운|모아주택|후보지|가칭|관리지역|빌라|연립|맨션|\s|·|,|\(|\))'
def norm(s): return re.sub(r'(\d)\s*의\s*(\d)', r'\1-\2', re.sub(r'제(\d)', r'\1', s or ''))
def toks(s): return set(t for t in re.sub(STOP, ' ', re.sub(r'\d+(?:-\d+)*', ' ', norm(s))).split() if len(t) >= 2)
def nums(s): return set(re.findall(r'\d+(?:-\d+)*', norm(s)))
def dong(s): m = re.match(r'\s*([가-힣]+?\d*(?:가)?동)', s or ''); return re.sub(r'\d+동$', '동', m.group(1)) if m else ''

KIND = {  # 레코드 유형 → 허용 경계 분류 (접두)
    'moa': ('UQ1812', 'BZ201'),
    '가로주택(모아주택)': ('UQ1812', 'BZ202', 'BZ203'),
    '소규모재건축': ('UQ1813', 'BZ204'), '소규모재개발': ('UQ1814', 'BZ205'),
}
def kind_ok(r, cl):
    if r['src'] == 'moa': return cl in KIND['moa']
    if r['k'] in KIND: return cl in KIND[r['k']]
    return not cl.startswith(('UQ18', 'BZ2', 'BZ3', 'BZ5', 'BZ6', 'UQ19', 'UQ11', 'UQ17', 'UQ5', 'UQ6', 'UQ9', 'UQA', 'BZ401', 'BZ404'))

def score(r, i, d):
    m = META[i]; nm = m['nm']
    if not kind_ok(r, m['cl']): return None
    rn = nums(r['n']) | nums(r.get('j', '')); zn = nums(nm)
    sc = 2.5*len(toks(r['n']) & toks(nm))
    if dong(r.get('j')) and dong(r.get('j')) == dong(nm): sc += 1
    if rn & zn: sc += 3
    elif rn and zn: return None          # 번호가 둘 다 있는데 겹치지 않으면 다른 구역
    ra = (r.get('sm') or {}).get('area')
    if ra and AREA[i] > 0:
        q = AREA[i]/ra; sc += 3 if .8 <= q <= 1.25 else 1.5 if .6 <= q <= 1.7 else (-3 if q > 4 or q < .25 else 0)
    if d is not None: sc += 2 if d == 0 else -d/50
    if AREA[i] > 600000 and not (ra and ra > 300000): sc -= 3
    if m['src'] == 'uq181': sc += .3      # 법정 고시 경계 우선
    return sc

best = {}
for r in R:
    cands = []
    if r.get('ll'):
        p = Point(r['ll'][1], r['ll'][0]); kx = KX(r['ll'][0])
        for i in TREE.query(p.buffer(0.003)):
            d = 0 if POLY[i].contains(p) else POLY[i].distance(p)*kx
            if d > 200: continue
            s = score(r, i, d)
            if s is not None: cands.append((s, i))
    else:   # 좌표 없는 후보지: 같은 구 안에서 이름으로
        for i, m in enumerate(META):
            if m['gu'] != r['g']: continue
            if not (toks(r['n']) & toks(m['nm']) or (nums(r['n']) & nums(m['nm']) and dong(r['n']) == dong(m['nm']))): continue
            s = score(r, i, None)
            if s is not None and s >= 4: cands.append((s + 1, i))
    if cands:
        s, i = max(cands)
        if s >= 3.5: best[r['id']] = (s, i)
# 한 경계 = 한 레코드
byp = collections.defaultdict(list)
for k, (s, i) in best.items(): byp[i].append(k)
idx = {r['id']: r for r in R}
for i, ks in byp.items():
    if len(ks) > 1:
        ks.sort(key=lambda k: (-best[k][0], idx[k]['s'] >= 9))
        for k in ks[1:]: del best[k]

rnd = lambda c: [round(c[0], 5), round(c[1], 5)]
def rings(g):
    if g.geom_type == 'MultiPolygon': g = max(g.geoms, key=lambda x: x.area)
    g = g.simplify(0.00002, preserve_topology=True)
    if g.geom_type == 'MultiPolygon': g = max(g.geoms, key=lambda x: x.area)
    return g, [[rnd(c) for c in g.exterior.coords]] + [[rnd(c) for c in h.coords] for h in g.interiors if len(h.coords) > 4]
Z = {}; st = collections.Counter()
for r in R:
    if r['id'] in best:
        s, i = best[r['id']]; g, rg = rings(POLY[i]); lp = g.representative_point()
        Z[r['id']] = {'g': rg, 'l': rnd((lp.x, lp.y)), 'a': round(AREA[i]), 'nm': META[i]['nm'], 'src': META[i]['src']}
        st[(r['src'], META[i]['src'])] += 1
    elif r.get('ll'):
        # 공식 경계 없음: 대표 지번을 중심으로 면적만큼의 원 (추정 범위)
        ar = (r.get('sm') or {}).get('area') or (6000 if r['k'].startswith('가로') or r['k'].startswith('소규모') else 30000)
        ar = min(max(ar, 2000), 400000); rad = math.sqrt(ar/math.pi)
        lat, lng = r['ll']; kx = KX(lat)
        ring = [rnd((lng + rad*math.cos(t)/kx, lat + rad*math.sin(t)/110540)) for t in [k*2*math.pi/40 for k in range(41)]]
        Z[r['id']] = {'g': [ring], 'l': rnd((lng, lat)), 'a': round(ar), 'e': 1}
        st[(r['src'], 'est')] += 1
    else: st[(r['src'], 'none')] += 1
print(sorted(st.items()))
G = json.load(open(A.out, encoding='utf-8')) if False else None
base = json.load(open(A.report, encoding='utf-8'))   # 기존 seoul·gu 외곽선 재사용
json.dump({'seoul': base['seoul'], 'gu': base['gu'], 'z': Z}, open(A.out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
