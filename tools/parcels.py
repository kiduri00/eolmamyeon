#!/usr/bin/env python3
"""공식 경계가 있는 구역마다 서울도시공간포털 연속지적(layer 1)에서 경계 안 필지(PNU·면적·소유·지목)를 모은다.
캐시: pipeline/cache/parcels.json {recId: {"h": 경계해시, "p": [[PNU, 면적, 소유, 지목], ...]}}
경계가 바뀐 구역만 다시 조회한다."""
import json, os, sys, time, hashlib, subprocess, urllib.parse, threading
from concurrent.futures import ThreadPoolExecutor
from shapely.geometry import Polygon, Point
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = "https://urban.seoul.go.kr/proxy/proxy.jsp?http://98.33.2.225:6080/arcgis/rest/services/UPIS/20200526_WFS/MapServer"
GEO = json.load(open(os.path.join(ROOT, 'public/data/geo.json'), encoding='utf-8'))
_B = os.path.join(ROOT, 'pipeline/data.base.json')
D = json.load(open(_B if os.path.exists(_B) else os.path.join(ROOT, 'src/data.json'), encoding='utf-8'))
act = {r['id'] for r in D['recs'] if not (r['s'] >= 9 or (r.get('dn') and r['s'] < 7))}
CP = os.path.join(ROOT, 'pipeline/cache/parcels.json')
cache = json.load(open(CP)) if os.path.exists(CP) else {}
LOCK = threading.Lock()
def save():
    with LOCK: snap = dict(cache)
    json.dump(snap, open(CP + '.tmp', 'w'), separators=(',', ':')); os.replace(CP + '.tmp', CP)
SEED = os.environ.get('PARCEL_SEED')   # 예전 실행 결과 재사용: {"match": 예전 매칭 rid→idx 파일, "parcels": idx→필지 파일}
if SEED and not cache:
    sd = json.load(open(SEED)); om = json.load(open(sd['match']))['match']; op = json.load(open(sd['parcels']))
    for rid, z in GEO['z'].items():
        if z.get('e') or z.get('src') != 'uq181' or rid not in om: continue
        ps = op.get(str(om[rid]))
        if ps is None: continue
        tot = sum(p[1] for p in ps)
        if z.get('a') and 0.8 <= tot / z['a'] <= 1.15:
            cache[rid] = {'h': hashlib.md5(json.dumps(z['g']).encode()).hexdigest()[:10], 'p': ps}
    print('seeded', len(cache), flush=True)
todo = []
for rid, z in GEO['z'].items():
    if z.get('e') or rid not in act: continue
    h = hashlib.md5(json.dumps(z['g']).encode()).hexdigest()[:10]
    if cache.get(rid, {}).get('h') != h: todo.append((rid, h, z['g']))
# 사이클 2(F8 필지 연식 지도): 필지 가운데 점(위도·경도)을 함께 저장 — 예전 캐시(점 없음)는 하루 120곳씩 다시 받아 채운다(매일 갱신 시간 안에)
_back = [(rid, cache[rid]['h'], GEO['z'][rid]['g']) for rid in cache if rid in GEO['z'] and rid in act and not GEO['z'][rid].get('e') and cache[rid].get('p') and len(cache[rid]['p'][0]) < 6 and rid not in {t[0] for t in todo}]
todo += _back[:120]
print('todo', len(todo), 'cached', len(cache), 'backfill', min(120, len(_back)), '/', len(_back), flush=True)
def run(t):
    rid, h, rings = t
    g = Polygon(rings[0], rings[1:]).buffer(0)
    x0, y0, x1, y1 = g.bounds
    q = urllib.parse.urlencode({'f': 'json', 'geometry': f"{x0},{y0},{x1},{y1}", 'geometryType': 'esriGeometryEnvelope', 'inSR': '4326', 'outSR': '4326', 'spatialRel': 'esriSpatialRelIntersects', 'outFields': 'PNU,OWN,JIMOK,SHAPE.AREA', 'returnGeometry': 'true', 'maxAllowableOffset': '0.0001', 'geometryPrecision': '6'})
    for k in range(5):
        r = subprocess.run(['curl', '-sS', '--max-time', '180', B + '/1/query?' + q], capture_output=True, text=True)
        try: fs = json.loads(r.stdout)['features']; break
        except Exception: time.sleep(4 + k*3)
    else:
        print('FAIL', rid, flush=True); return
    out = []
    for f in fs:
        rg = f['geometry']['rings'][0]; cx = sum(p[0] for p in rg)/len(rg); cy = sum(p[1] for p in rg)/len(rg)
        if g.contains(Point(cx, cy)):
            a = f['attributes']; out.append([a['PNU'], round(a.get('SHAPE.AREA') or 0, 1), a.get('OWN') or '', a.get('JIMOK') or '', round(cy, 6), round(cx, 6)])
    with LOCK: cache[rid] = {'h': h, 'p': out}
    time.sleep(.3)
with ThreadPoolExecutor(3) as ex:
    for k, _ in enumerate(ex.map(run, todo)):
        if k % 40 == 0:
            save(); print(k, '/', len(todo), flush=True)
save(); print('DONE', len(cache), flush=True)
