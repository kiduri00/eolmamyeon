#!/usr/bin/env python3
"""geo.json 가볍게: 원본(pipeline/geo.full.json) → public/data/geo.json (같은 구조, 좌표 5자리·점 줄이기).
build.py가 부른다. bnd_match.py가 public/data/geo.json을 새로 쓰면(지난 출력 해시와 다르면) 그것을 새 원본으로 삼는다.
점 줄이기: 고리마다 Douglas-Peucker(허용 오차 TOL도 ≈ 3m), 고리는 닫힌 채 최소 4점."""
import json, os, hashlib, shutil
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, 'public', 'data', 'geo.json')
SRC = os.path.join(R, 'pipeline', 'geo.full.json')
MARK = os.path.join(R, 'pipeline', 'geo.slim.md5')
TOL = 0.00003

def _md5(p): return hashlib.md5(open(p, 'rb').read()).hexdigest()

def dp(pts, tol):
    n = len(pts)
    if n < 3: return pts
    keep = [False] * n; keep[0] = keep[-1] = True; st = [(0, n - 1)]; t2 = tol * tol
    while st:
        a, b = st.pop(); ax, ay = pts[a]; bx, by = pts[b]; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        mi, md = -1, t2
        for i in range(a + 1, b):
            px, py = pts[i]
            if L == 0: d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L)); qx, qy = ax + t * dx - px, ay + t * dy - py; d = qx * qx + qy * qy
            if d > md: mi, md = i, d
        if mi >= 0: keep[mi] = True; st += [(a, mi), (mi, b)]
    return [p for p, k in zip(pts, keep) if k]

def ring(r, tol):
    r = [[round(c[0], 5), round(c[1], 5)] for c in r]
    if len(r) < 5: return r
    closed = r[0] == r[-1]
    body = r[:-1] if closed else r
    # 닫힌 고리는 가장 먼 두 점에서 나눠 각각 줄인다(시작점 하나에 매달리지 않게)
    far = max(range(len(body)), key=lambda i: (body[i][0] - body[0][0]) ** 2 + (body[i][1] - body[0][1]) ** 2)
    s = dp(body[:far + 1], tol)[:-1] + dp(body[far:] + [body[0]], tol)
    if len(s) < 4: return r
    if closed and s[-1] != s[0]: s.append(s[0])
    return s

def slim(g):
    o = dict(g)
    o['seoul'] = [ring(r, TOL) for r in g['seoul']]
    o['gu'] = [dict(x, r=[ring(r, TOL) for r in x['r']]) for x in g['gu']]
    o['z'] = {k: dict(v, g=[ring(r, TOL) for r in v['g']]) for k, v in g['z'].items()}
    return o

def main():
    if not os.path.exists(OUT) and not os.path.exists(SRC): return
    if os.path.exists(OUT) and (not os.path.exists(SRC) or not os.path.exists(MARK) or open(MARK).read().strip() != _md5(OUT)):
        shutil.copyfile(OUT, SRC)   # 처음이거나 bnd_match가 새로 쓴 경우: 지금 것이 원본
    g = json.load(open(SRC, encoding='utf-8'))
    body = json.dumps(slim(g), ensure_ascii=False, separators=(',', ':'))
    if not os.path.exists(OUT) or open(OUT, encoding='utf-8').read() != body:
        open(OUT, 'w', encoding='utf-8').write(body)
    open(MARK, 'w').write(_md5(OUT))
    print(f'geo.json {os.path.getsize(SRC)} -> {os.path.getsize(OUT)} bytes')

if __name__ == '__main__': main()
