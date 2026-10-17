#!/usr/bin/env python3
"""구역 경사도(지형): AWS Terrain Tiles(Terrarium PNG, z13 ≈ 15m/px · 원자료 SRTM 등 30m급) → 구역별 평균 경사·고저차·10° 넘는 면적 비율.
입력: pipeline/data.base.json(또는 src/data.json), public/data/geo.json
출력: pipeline/cache/slope.json {id: {a: 평균 경사(°), d: 고저차(m), p: 10° 넘는 비율(%), h: 경계 지문, n: 표본 수}}
  - 경계(geo.json z[id].g)가 있으면 그 안을, 추정 원(e=1)이거나 경계가 없으면 대표 좌표 반경 150m 원 안을 15m 격자로 본다.
  - 경계가 바뀌지 않은 구역은 캐시를 그대로 쓴다(타일 재다운로드 없음). 타일은 pipeline/raw/terrain/ 에 둔다(git 제외).
  enrich.py 가 이 캐시를 읽어 rec.sl = {a, d, p, k(평지·완만·경사·급경사)} 를 넣는다.
사용: python3 tools/slope.py [--force]
"""
import json, os, sys, math, hashlib, io, urllib.request, concurrent.futures as cf
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
Z = 13; TS = 256; STEP = 15.0; RAD = 150.0
URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
TDIR = os.path.join(ROOT, 'pipeline/raw/terrain'); CP = os.path.join(ROOT, 'pipeline/cache/slope.json')
FORCE = '--force' in sys.argv

def lonlat2px(lon, lat):   # 전역 픽셀 좌표(z13)
    n = TS * 2 ** Z; s = math.sin(math.radians(lat))
    return (lon + 180) / 360 * n, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n

_tiles = {}
def tile(x, y):
    if (x, y) in _tiles: return _tiles[(x, y)]
    p = os.path.join(TDIR, f'{Z}_{x}_{y}.png')
    if not os.path.exists(p):
        os.makedirs(TDIR, exist_ok=True)
        for k in range(3):
            try:
                b = urllib.request.urlopen(URL.format(z=Z, x=x, y=y), timeout=30).read(); break
            except Exception as e:
                if k == 2: raise
        Image.open(io.BytesIO(b)).verify(); open(p + '.tmp', 'wb').write(b); os.replace(p + '.tmp', p)
    a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float64)
    _tiles[(x, y)] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    return _tiles[(x, y)]

def mosaic(x0, y0, x1, y1):   # 타일 범위 → 고도 배열
    return np.vstack([np.hstack([tile(x, y) for x in range(x0, x1 + 1)]) for y in range(y0, y1 + 1)])

def circle(lon, lat, r=RAD, n=48):
    k = 111320.0
    return [[[lon + r * math.cos(2 * math.pi * i / n) / (k * math.cos(math.radians(lat))), lat + r * math.sin(2 * math.pi * i / n) / k] for i in range(n + 1)]]

def inside(px, py, rings):   # 짝홀 규칙(구멍·여러 고리 처리), 벡터화
    ins = np.zeros(px.shape, bool)
    for ring in rings:
        r = np.asarray(ring, float); xa, ya = r[:, 0], r[:, 1]; xb, yb = np.roll(xa, -1), np.roll(ya, -1)
        for i in range(len(r)):
            c = ((ya[i] > py) != (yb[i] > py))
            with np.errstate(divide='ignore', invalid='ignore'):
                xi = xa[i] + (py - ya[i]) * (xb[i] - xa[i]) / (yb[i] - ya[i])
            ins ^= c & (px < xi)
    return ins

def zone(rings):
    pts = [p for ring in rings for p in ring]
    lo0, lo1 = min(p[0] for p in pts), max(p[0] for p in pts); la0, la1 = min(p[1] for p in pts), max(p[1] for p in pts)
    lat = (la0 + la1) / 2; mlat = 111320.0; mlon = mlat * math.cos(math.radians(lat))
    # 15m 격자(구역이 작아 점이 너무 적으면 격자를 줄인다)
    st = STEP
    while True:
        gx = np.arange(lo0, lo1 + 1e-12, st / mlon); gy = np.arange(la0, la1 + 1e-12, st / mlat)
        LON, LAT = np.meshgrid(gx, gy); m = inside(LON, LAT, rings)
        if m.sum() >= 12 or st < 4: break
        st /= 2
    if not m.any():   # 아주 작은 구역: 중심 한 점
        LON = np.array([[(lo0 + lo1) / 2]]); LAT = np.array([[lat]]); m = np.array([[True]])
    lon, la = LON[m], LAT[m]
    n = TS * 2 ** Z; s = np.sin(np.radians(la))
    PX = (lon + 180) / 360 * n; PY = (0.5 - np.log((1 + s) / (1 - s)) / (4 * np.pi)) * n
    x0, x1 = int(PX.min() // TS), int(PX.max() // TS); y0, y1 = int(PY.min() // TS), int(PY.max() // TS)
    # 가장자리 기울기를 위해 이웃 타일 1장씩 더
    x0 -= (PX.min() - x0 * TS) < 2; y0 -= (PY.min() - y0 * TS) < 2
    x1 += ((x1 + 1) * TS - PX.max()) < 2; y1 += ((y1 + 1) * TS - PY.max()) < 2
    E = mosaic(x0, y0, x1, y1)
    res = 2 * math.pi * 6378137 * math.cos(math.radians(lat)) / n   # 픽셀 크기(m) — 웹 메르카토르 축척 보정
    gyE, gxE = np.gradient(E, res)
    SL = np.degrees(np.arctan(np.hypot(gxE, gyE)))
    fx = PX - x0 * TS - 0.5; fy = PY - y0 * TS - 0.5   # 픽셀 중심 기준 쌍선형 보간
    ix = np.clip(np.floor(fx).astype(int), 0, E.shape[1] - 2); iy = np.clip(np.floor(fy).astype(int), 0, E.shape[0] - 2)
    tx = np.clip(fx - ix, 0, 1); ty = np.clip(fy - iy, 0, 1)
    bil = lambda A: (A[iy, ix] * (1 - tx) * (1 - ty) + A[iy, ix + 1] * tx * (1 - ty) + A[iy + 1, ix] * (1 - tx) * ty + A[iy + 1, ix + 1] * tx * ty)
    e, sl = bil(E), bil(SL)
    return {'a': round(float(sl.mean()), 1), 'd': int(round(float(e.max() - e.min()))), 'p': int(round(100 * float((sl > 10).mean()))),
            'z0': int(round(float(e.min()))), 'z1': int(round(float(e.max()))), 'n': int(len(e))}

def main():
    D = J('pipeline/data.base.json') if os.path.exists(os.path.join(ROOT, 'pipeline/data.base.json')) else J('src/data.json')
    GEO = J('public/data/geo.json')['z']
    act = lambda r: not (r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7))
    C = json.load(open(CP)) if os.path.exists(CP) else {}
    todo = {}
    for r in D['recs']:
        if not act(r): continue
        g = GEO.get(r['id']) or {}
        if g.get('g') and not g.get('e'): rings = g['g'] if isinstance(g['g'], list) else json.loads(g['g'])
        else:
            ll = r.get('ll') or ((lambda l: [l[1], l[0]])(json.loads(g['l']) if isinstance(g['l'], str) else g['l']) if g.get('l') else None)
            if not ll: continue
            rings = circle(ll[1], ll[0])
        h = hashlib.md5(json.dumps(rings, separators=(',', ':')).encode()).hexdigest()[:10]
        if not FORCE and (C.get(r['id']) or {}).get('h') == h: continue
        todo[r['id']] = (rings, h)
    print('slope: cached', len(C), 'todo', len(todo))
    # 필요한 타일을 미리 병렬로 받는다
    need = set()
    for rings, _ in todo.values():
        pts = [p for ring in rings for p in ring]
        X = [lonlat2px(p[0], p[1]) for p in pts]
        for x in range(int(min(q[0] for q in X) // TS) - 1, int(max(q[0] for q in X) // TS) + 2):
            for y in range(int(min(q[1] for q in X) // TS) - 1, int(max(q[1] for q in X) // TS) + 2): need.add((x, y))
    miss = [t for t in need if not os.path.exists(os.path.join(TDIR, f'{Z}_{t[0]}_{t[1]}.png'))]
    if miss:
        print('slope: download tiles', len(miss))
        with cf.ThreadPoolExecutor(8) as ex: list(ex.map(lambda t: tile(*t), miss))
    fail = 0
    for i, (rings, h) in todo.items():
        try: C[i] = dict(zone(rings), h=h)
        except Exception as e: fail += 1; print('  !!', i, e)
    json.dump(C, open(CP, 'w'), separators=(',', ':'))
    print('slope: done', len(todo) - fail, 'fail', fail, 'total cached', len(C))

if __name__ == '__main__': main()
