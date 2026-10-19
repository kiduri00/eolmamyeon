#!/usr/bin/env python3
"""지도 자리 그림(src/ghost.js)용 가벼운 서울 모양 — 빌드가 부른다(tools/build.py).
구 경계·서울 경계·한강을 웹 메르카토르 좌표(세계 = 2^20 칸)의 SVG 경로로, 구 이름 자리(실제 지도 10_lmap.js guLabels와 같은 식: 가장 큰 고리의 면적 중심)를 경위도로.
실제 지도(MapLibre)와 같은 투영이라 같은 카메라(중심·줌)면 같은 자리에 그려진다."""
import json, math, os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 2 ** 20


def merc(lng, lat):
    s = math.sin(lat * math.pi / 180)
    return ((lng + 180) / 360 * S, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * S)


def dp(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1e-9
    best, bi = -1, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L if (dx or dy) else math.hypot(p[0] - a[0], p[1] - a[1])
        if d > best: best, bi = d, i
    if best <= tol: return [a, b]
    return dp(pts[:bi + 1], tol)[:-1] + dp(pts[bi:], tol)


def path(rings, o, tol, close=True):
    out = []
    for rg in rings:
        P = [merc(x, y) for x, y in rg]
        P = [(round(p[0] - o[0]), round(p[1] - o[1])) for p in dp(P, tol)]
        if len(P) < 2: continue
        s = f'M{P[0][0]} {P[0][1]}'
        last = P[0]
        rel = []
        for p in P[1:]:
            d = (p[0] - last[0], p[1] - last[1])
            if d == (0, 0): continue
            rel.append(f'{d[0]} {d[1]}'.replace(' -', '-')); last = p
        if not rel: continue   # 한 점으로 줄어든 아주 작은 고리(빈 'l'은 SVG 오류)
        out.append(s + 'l' + ' '.join(rel).replace(' -', '-') + ('z' if close else ''))
    return ''.join(out)


def label(rings):
    best, ba = None, 0
    for rg in rings:
        a = x = y = 0
        for i in range(len(rg) - 1):
            x0, y0 = rg[i]; x1, y1 = rg[i + 1]; f = x0 * y1 - x1 * y0
            a += f; x += (x0 + x1) * f; y += (y0 + y1) * f
        if abs(a) > ba: ba = abs(a); best = [x / (3 * a), y / (3 * a)]
    return best


def build(D):
    g = json.load(open(os.path.join(R, 'public', 'data', 'geo.json'), encoding='utf-8'))
    allp = [merc(x, y) for rg in g['seoul'] for x, y in rg]
    o = (math.floor(min(p[0] for p in allp)) - 200, math.floor(min(p[1] for p in allp)) - 200)
    gu = []
    for x in g['gu']:
        lb = label(x['r'])
        xs = [q[0] for rg in x['r'] for q in rg]; ys = [q[1] for rg in x['r'] for q in rg]
        # [이름, 이름 자리 경도, 위도, 경계 상자 서·남·동·북] — 상자는 구를 누를 때 자리 그림·실제 지도가 같은 카메라로 확대하는 데(20차)
        gu.append([x['n'], round(lb[0], 6), round(lb[1], 6), round(min(xs), 4), round(min(ys), 4), round(max(xs), 4), round(max(ys), 4)])
    # 구 경계는 구마다 따로(누른 구만 밝게 남기고 나머지를 어둡게) — ghost.js가 이어 붙여 전체 경계(gp)로도 쓴다
    gpl = [path(x['r'], o, 2.2) for x in g['gu']]
    sp = path(g['seoul'], o, 1.6)
    # 한강: 사이트 SVG 지도(D.map.river, 지도 칸 좌표)를 역 좌표로 맞춘 1차 변환으로 경위도로
    rv = ''
    try:
        st = [s for s in D.get('stations', []) if len(s) >= 6 and s[4] is not None and s[5] is not None]
        import itertools
        def fit(ix):   # v = a*x + b*y + c (최소제곱, 3×3)
            m = [[0.0] * 3 for _ in range(3)]; v = [0.0] * 3
            for s in st:
                q = [s[4], s[5], 1]
                for i in range(3):
                    v[i] += q[i] * s[ix]
                    for j in range(3): m[i][j] += q[i] * q[j]
            det = lambda a: a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
            d0 = det(m)
            return [det([[v[i] if j == k else m[i][j] for j in range(3)] for i in range(3)]) / d0 for k in range(3)]
        LN, LA = fit(2), fit(1)
        nums = [float(t) for t in re.findall(r'-?\d+(?:\.\d+)?', D['map']['river'])]
        pts = [(LN[0] * x + LN[1] * y + LN[2], LA[0] * x + LA[1] * y + LA[2]) for x, y in zip(nums[0::2], nums[1::2])]
        rv = path([pts], o, 1.2, close=False)
    except Exception as e:
        print('ghost river 건너뜀:', e)
    # 21차: 정비구역 모양(서울 보기 줌 ≤ 11.5에서 1px 안팎 오차로 줄임) — 자리 그림이 '내 돈으로 가능' 구역을 실제 지도와 같은 남색 면으로 칠한다
    # zp = {구역 id: 경로}, ze = 공식 경계 없이 면적으로 추정한 구역(점선) id
    # zl = 면적 9만㎡ 아래 구역의 이름 자리(실제 지도 zone-okdot과 같은 규칙 · 서울 보기에서 작은 원으로)
    zp, ze, zl = {}, [], {}
    for zid, z in sorted((g.get('z') or {}).items()):
        if not z.get('g'): continue
        d = path(z['g'], o, 1.2)
        if not d: continue
        zp[zid] = d
        if z.get('e'): ze.append(zid)
        if z.get('l') and float(z.get('a') or 0) < 90000:
            x, y = merc(z['l'][0], z['l'][1]); zl[zid] = [round(x - o[0]), round(y - o[1])]
    return {'S': S, 'o': list(o), 'gu': gu, 'gpl': gpl, 'sp': sp, 'rv': rv, 'zp': zp, 'ze': ze, 'zl': zl}


if __name__ == '__main__':
    D = json.load(open(os.path.join(R, 'pipeline', 'data.enriched.json'), encoding='utf-8'))
    x = build(D)
    print(len(json.dumps(x, ensure_ascii=False)), x['gu'][:3], sum(map(len, x['gpl'])), len(x['sp']), len(x['rv']))
