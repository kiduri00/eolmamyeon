#!/usr/bin/env python3
"""서울도시공간포털 UPIS 레이어 내려받기 → pipeline/cache/
 - upis_uq181.json : 정비구역(layer 64, esri features)
 - upis_uq120.json : 서울시 정비사업 현황(layer 12, GeoJSON) — 모아타운·가로주택·신통 후보지 경계 포함
 - upis_sgg.json   : 자치구(layer 2, esri features)
 - upis_sgg_hi.json: 자치구(layer 2, 약 1m 정밀도) → public/data/gu_hi.json(확대했을 때 구 경계선)
"""
import json, os, time, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = "https://urban.seoul.go.kr/proxy/proxy.jsp?http://98.33.2.225:6080/arcgis/rest/services/UPIS/20200526_WFS/MapServer"
def get(url):
    for t in range(6):
        r = subprocess.run(['curl', '-sS', '--max-time', '180', url], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip().startswith('{'):
            try: return json.loads(r.stdout)
            except Exception: pass
        time.sleep(3 + t*3)
    raise SystemExit('fail ' + url[:120])
def layer(lid, fields, off):
    ids = sorted(get(f"{B}/{lid}/query?f=json&returnIdsOnly=true&where=1%3D1")['objectIds'])
    feats = []
    for i in range(0, len(ids), 150):
        d = get(f"{B}/{lid}/query?f=json&outFields={fields}&returnGeometry=true&outSR=4326&maxAllowableOffset={off}&geometryPrecision=6&objectIds={','.join(map(str, ids[i:i+150]))}")
        feats += d.get('features', [])
    print(lid, len(feats), '/', len(ids), flush=True)
    if len(feats) < len(ids) * 0.98: raise SystemExit(f'layer {lid} incomplete')
    return feats
def save(name, obj):
    p = os.path.join(ROOT, 'pipeline/cache', name)
    json.dump(obj, open(p + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':')); os.replace(p + '.tmp', p)
os.makedirs(os.path.join(ROOT, 'pipeline/cache'), exist_ok=True)
save('upis_uq181.json', layer(64, 'DGM_NM,DGM_AR,ATRB_SE,SIGNGU_SE,NTFC_SN,CREATE_DAT,PRESENT_SN', 0.00001))
f12 = layer(12, '*', 0.00001)
def esri2geo(g):
    # esri: 바깥 고리 시계 방향, 구멍 반시계 → GeoJSON MultiPolygon
    def area(rg): return sum(rg[i][0]*rg[i+1][1] - rg[i+1][0]*rg[i][1] for i in range(len(rg) - 1))
    def inside(pt, rg):
        x, y = pt; c = False
        for i in range(len(rg) - 1):
            (x1, y1), (x2, y2) = rg[i], rg[i+1]
            if (y1 > y) != (y2 > y) and x < (x2 - x1)*(y - y1)/(y2 - y1) + x1: c = not c
        return c
    rings = [r for r in (g.get('rings') or []) if len(r) >= 4]
    outers = [r for r in rings if area(r) < 0] or rings
    holes = [r for r in rings if area(r) >= 0 and r not in outers]
    polys = [[o] + [h for h in holes if inside(h[0], o)] for o in outers]
    return {'type': 'Polygon', 'coordinates': polys[0]} if len(polys) == 1 else {'type': 'MultiPolygon', 'coordinates': polys}
save('upis_uq120.json', {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': f['attributes'], 'geometry': esri2geo(f['geometry'])} for f in f12 if f.get('geometry')]})
save('upis_sgg.json', layer(2, '*', 0.00015))
save('upis_sgg_hi.json', layer(2, 'SGG_NM', 0.00001))   # 29차: 확대(줌 12+)에서 쓰는 자치구 경계 원본(약 1m) → geo_slim.py가 data/gu_hi.json으로
