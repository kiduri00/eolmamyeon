#!/usr/bin/env python3
"""홈 미니 서울 지도(사이클 4 D1) — 지도 엔진 없이 SVG 구 채움 + 구별 '갈 수 있는 곳' 숫자 단추.
빌드(tools/build.py)가 shell.html의 /*HMMAP*/ 자리에 넣는다. 모양은 사이트 SVG 지도(D.map: 1000×831 칸 · 구 경계·한강)를 줄인 것.
숫자는 그리지 않는다: 첫 화면 섬(src/island.js)과 앱(src/ext/60_simple.js)이 같은 판정(ZP_simple.guCounts · 섬은 미리 뜬 같은 값)으로 src/hmini.js를 불러 채운다.
단추 자리는 구 경계 안 가장 큰 고리의 면적 중심(%)."""
import json, os, re, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(R, 'tools'))
from ghost_geo import dp


def rings(d):
    out = []
    for part in re.findall(r'M[^M]*', d):
        nums = [float(t) for t in re.findall(r'-?\d+(?:\.\d+)?', part)]
        pts = list(zip(nums[0::2], nums[1::2]))
        if len(pts) >= 2: out.append(pts)
    return out


def centroid(rg):
    a = x = y = 0.0
    n = len(rg)
    for i in range(n):
        x0, y0 = rg[i]; x1, y1 = rg[(i + 1) % n]; f = x0 * y1 - x1 * y0
        a += f; x += (x0 + x1) * f; y += (y0 + y1) * f
    if abs(a) < 1e-9: return abs(a), rg[0]
    return abs(a) / 2, (x / (3 * a), y / (3 * a))


def pth(rgs, o, tol, close=True):
    s = []
    for rg in rgs:
        P = [(round(p[0] - o[0]), round(p[1] - o[1])) for p in dp(rg + ([rg[0]] if close else []), tol)]
        if len(P) < 2: continue
        q = [P[0]] + [p for i, p in enumerate(P[1:]) if p != P[i]]
        if close and len(q) > 1 and q[-1] == q[0]: q = q[:-1]
        if len(q) < (3 if close else 2): continue
        s.append('M' + ' '.join(f'{p[0]} {p[1]}' for p in q[:1]) + 'L' + ' '.join(f'{p[0]} {p[1]}' for p in q[1:]) + ('Z' if close else ''))
    return ''.join(s)


def build(D):
    m = D.get('map') or {}
    G = [(g[0], rings(g[1])) for g in m.get('gu') or []]
    if len(G) < 20: return ''
    xs = [p[0] for _, rg in G for r in rg for p in r]; ys = [p[1] for _, rg in G for r in rg for p in r]
    pad = 4
    o = (min(xs) - pad, min(ys) - pad)
    W, H = round(max(xs) - o[0] + pad), round(max(ys) - o[1] + pad)
    paths, btns = [], []
    for n, rg in G:
        d = pth(rg, o, 3)
        a, c = max((centroid(r) for r in rg), key=lambda t: t[0])
        lx, ly = (c[0] - o[0]) / W * 100, (c[1] - o[1]) / H * 100
        nm = n
        paths.append(f'<path class="hm-g" data-gu="{nm}" d="{d}"/>')
        btns.append(f'<button type="button" class="hm-gb" data-gu="{nm}" data-x="{lx:.2f}" data-y="{ly:.2f}" style="left:{lx:.2f}%;top:{ly:.2f}%" hidden>0</button>')
    rv = ''
    if m.get('river'):
        rv = pth(rings(m["river"]), o, 3, close=False)
    svg = (f'<svg class="hm-svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">'
           f'<g class="hm-gs">{"".join(paths)}</g>' + (f'<path class="hm-rv" d="{rv}"/>' if rv else '') + '</svg>')
    return f'<div class="hm-mw" id="hmMw" style="aspect-ratio:{W}/{H}">{svg}{"".join(btns)}</div>'


if __name__ == '__main__':
    D = json.load(open(os.path.join(R, 'src', 'data.json'), encoding='utf-8'))
    s = build(D)
    print(len(s), s[:300])


# ---- 첫 페인트(빌드가 기본 금액으로 채움) — src/hmini.js와 같은 식 ----
# c4 최종: 지도 서울 줌과 같은 표기('✓ 은평 8' 태그 → 노란 숫자 원 → 가장 덜 겹치는 둘레) · 자리는 픽셀(미니 지도 칸 폭 290 기준)
DT = {0.5: '5,000만', 1: '1억', 1.5: '1.5억', 2: '2억', 3: '3억', 5: '5억'}
CK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
import math


def tw(t, px):
    w = 0.0
    for ch in str(t):
        c = ord(ch); w += 0.95 if 0xac00 <= c <= 0xd7a3 else 0.28 if c == 32 else 0.6 if 48 <= c <= 57 else 0.62
    return math.ceil(w * px)


def sn(g): return g[:-1] if len(g) > 2 and g.endswith('구') else g


def _ring(rs):
    out = []
    for r in rs:
        for k in range(8): out.append([round(r * math.cos(k * math.pi / 4)), round(r * math.sin(k * math.pi / 4))])
    return out


NU = [[0, 0], [0, -12], [0, 12], [-16, 0], [16, 0], [-12, -10], [12, -10], [-12, 10], [12, 10]]
NU3 = NU + _ring([16, 24]); NU4 = NU3 + _ring([32, 40])


def jround(x): return math.floor(x + 0.5)   # JS Math.round


def place(PW, PH, L, TB=1):
    put, out, G = [], [], 2
    hit = lambda a, b: a[0] < b[2] + G and b[0] < a[2] + G and a[1] < b[3] + G and b[1] < a[3] + G
    inb = lambda b: b[0] >= 2 and b[2] <= PW - 2 and b[1] >= 2 and b[3] <= PH - 2
    for g, px, py, n in L:
        x0, y0, got = px / 100 * PW, py / 100 * PH, None
        S = [(math.ceil((tw(sn(g) + ' ' + str(n), 12) + 15 + 3 + 11) * 1.04 * TB), math.ceil(24 * TB), NU, 'tag'), (math.ceil((tw(sn(g) + ' ' + str(n), 11) + 13 + 2 + 8) * 1.04 * TB), math.ceil(22 * TB), NU, 'tagx'), (math.ceil(max(22, tw(str(n), 12.5) + 8) * TB) + 4, math.ceil(22 * TB) + 4, NU3, 'num')]
        for w, h, nu, kd in S:
            for dx, dy in nu:
                x, y = x0 + dx, y0 + dy; b = (x - w / 2, y - h / 2, x + w / 2, y + h / 2)
                if inb(b) and not any(hit(q, b) for q in put): got = (x, y, b, kd); break
            if got: break
        if not got:
            w, h, best = S[2][0], S[2][1], None
            for i, (dx, dy) in enumerate(NU4):
                x = max(2 + w / 2, min(PW - 2 - w / 2, x0 + dx)); y = max(2 + h / 2, min(PH - 2 - h / 2, y0 + dy)); b = (x - w / 2, y - h / 2, x + w / 2, y + h / 2); a = i * 0.01
                for q in put:
                    ox = min(q[2], b[2]) - max(q[0], b[0]); oy = min(q[3], b[3]) - max(q[1], b[1])
                    if ox > 0 and oy > 0: a += ox * oy
                if best is None or a < best[3]: best = (x, y, b, a)
            got = (best[0], best[1], best[2], 'num')
        put.append(got[2])
        out.append((g, f'{got[0] / PW * 100:.2f}%', f'{got[1] / PH * 100:.2f}%', got[3]))
    return out


def paint(html, cnt):
    """빌드 때 미니 지도 HTML에 구별 곳 수를 넣는다(ZP_HM.paint와 같은 결과 · 칸 폭 290)."""
    bk = lambda n: 3 if n >= 6 else 2 if n >= 3 else 1 if n >= 1 else 0
    html = re.sub(r'<path class="hm-g" data-gu="([^"]+)"', lambda m: f'<path class="hm-g" data-gu="{m.group(1)}" data-b="{bk(cnt.get(m.group(1), 0))}"', html)
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', html); W, H = int(vb.group(1)), int(vb.group(2))
    PW = 290; PH = PW * H / W
    B = re.findall(r'<button type="button" class="hm-gb" data-gu="([^"]+)" data-x="([\d.]+)" data-y="([\d.]+)"', html)
    on = [(g, float(x), float(y), cnt[g]) for g, x, y in B if cnt.get(g, 0) > 0]
    on.sort(key=lambda t: -t[3])   # 같은 곳 수는 원래 차례(JS sort도 안정 정렬)
    pos = {g: (l, t, k) for g, l, t, k in place(PW, PH, on)}
    def rb(m):
        g = m.group(1); n = cnt.get(g, 0)
        if not n: return m.group(0)
        l, t, k = pos[g]
        inner = f'<span class="hm-in">{n:,}</span>' if k == 'num' else f'<span class="hm-in"><i class="zg-ck">{CK}</i><span class="gn">{sn(g)}</span> <b class="mn">{n:,}</b></span>'
        return f'<button type="button" class="hm-gb hm-t{" hm-n" if k == "num" else " hm-x" if k == "tagx" else ""}" data-gu="{g}" data-x="{m.group(2)}" data-y="{m.group(3)}" style="left:{l};top:{t}" aria-label="{g} 갈 수 있는 곳 {n}곳, 그 구 지도 보기">{inner}</button>'
    return re.sub(r'<button type="button" class="hm-gb" data-gu="([^"]+)" data-x="([\d.]+)" data-y="([\d.]+)" style="[^"]*" hidden>0</button>', rb, html)


def next_html(up, f1, n1):
    a = f'<button type="button" class="hm-nb" data-hup="{up[1]:g}">+{DT[up[0]]}이면 <b>{up[2]:,}곳</b></button>' if up and up[0] in DT else ''
    b = f'<button type="button" class="hm-nb" data-hmode="{f1}">{"대출 끼고" if f1 == "cash" else "전세 끼고"}면 <b>{n1:,}곳</b></button>' if n1 is not None else ''
    return a + ('<i aria-hidden="true">·</i>' if a and b else '') + b
