#!/usr/bin/env python3
"""구역 경계 안 건축물(서울도시공간포털 건물 레이어 86: 사용승인연도·구조·용도) 수집 → 노후도 직접 계산용.
캐시: pipeline/cache/bldg.json {recId: {"h": 경계해시, "b": [[PNU, 사용승인연도, 구조(R=철근콘크리트·철골류, O=그 외), 용도]]}}"""
import json, os, time, subprocess, urllib.parse, hashlib, threading
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = "https://urban.seoul.go.kr/proxy/proxy.jsp?http://98.33.2.225:6080/arcgis/rest/services/UPIS/20200526_WFS/MapServer/86"
PAR = json.load(open(os.path.join(ROOT, 'pipeline/cache/parcels.json')))
GEO = json.load(open(os.path.join(ROOT, 'public/data/geo.json'), encoding='utf-8'))['z']
CP = os.path.join(ROOT, 'pipeline/cache/bldg.json')
cache = json.load(open(CP)) if os.path.exists(CP) else {}
LOCK = threading.Lock()
def get(url):
    for k in range(5):
        r = subprocess.run(['curl', '-sS', '--max-time', '120', url], capture_output=True, text=True)
        try: return json.loads(r.stdout)
        except Exception: time.sleep(3 + 3*k)
    return None
todo = [rid for rid, v in PAR.items() if v['p'] and cache.get(rid, {}).get('h') != v['h']]
print('todo', len(todo), flush=True)
def run(rid):
    z = GEO.get(rid)
    if not z: return
    xs = [p[0] for p in z['g'][0]]; ys = [p[1] for p in z['g'][0]]
    pn = {p[0] for p in PAR[rid]['p']}
    env = f"{min(xs)},{min(ys)},{max(xs)},{max(ys)}"
    q = urllib.parse.urlencode({'f': 'json', 'returnIdsOnly': 'true', 'geometry': env, 'geometryType': 'esriGeometryEnvelope', 'inSR': '4326', 'spatialRel': 'esriSpatialRelIntersects'})
    d = get(f'{B}/query?{q}')
    if d is None: print('FAIL', rid, flush=True); return
    ids = sorted(d.get('objectIds') or []); out = []
    for i in range(0, len(ids), 300):
        dd = get(f"{B}/query?f=json&returnGeometry=false&outFields=ADDRESS,SAYONG_YEA,DBGJCD,DBYDETC&objectIds={','.join(map(str, ids[i:i+300]))}")
        if dd is None: print('FAIL', rid, flush=True); return
        for f in dd.get('features', []):
            a = f['attributes']; p = (a.get('ADDRESS') or '').strip()
            if p not in pn: continue
            try: y = int(str(a.get('SAYONG_YEA') or '').strip()[:4])
            except Exception: y = 0
            st = a.get('DBGJCD') or ''
            out.append([p, y, 'R' if any(k in st for k in ('철근', '철골', '콘크리트', 'SRC', '강구조')) else 'O', (a.get('DBYDETC') or '').strip()[:6]])
    with LOCK: cache[rid] = {'h': PAR[rid]['h'], 'b': out}
done = [0]
def wrap(rid):
    run(rid)
    with LOCK:
        done[0] += 1
        if done[0] % 50 == 0:
            json.dump(cache, open(CP + '.tmp', 'w'), separators=(',', ':')); os.replace(CP + '.tmp', CP); print(done[0], '/', len(todo), flush=True)
with ThreadPoolExecutor(6) as ex: list(ex.map(wrap, todo))
json.dump(cache, open(CP + '.tmp', 'w'), separators=(',', ':')); os.replace(CP + '.tmp', CP)
print('DONE', len(cache), flush=True)
