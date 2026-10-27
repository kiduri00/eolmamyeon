"""구역 페이지(/z/<id>)용 그림 도구: 정적 위치 지도(SVG)와 공유 카드(OG PNG 1200x630).
tools/zpages.py가 불러 쓴다. 외부 지도 타일 없이 공개 자료(구 경계·정비구역 경계·지하철 노선/역)만으로 그린다."""
import json, os, re, math, hashlib, html
from brand import BRAND, BRAND_EN
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
esc = lambda s: html.escape(str(s if s is not None else ''), quote=True)

def _rings(g):
    if not g: return []
    return g if isinstance(g[0][0][0], (int, float)) else [rg for poly in g for rg in poly]

# 지하철 노선: 앱 SVG 지도 좌표(xy) → 위경도(역 좌표로 맞춘 1차 변환의 역변환 · src/ext/10_lmap.js subwayGeo와 같은 방식)
_SUB = None
def _subway(stations):
    global _SUB
    if _SUB is not None: return _SUB
    _SUB = []
    try:
        s = open(os.path.join(ROOT, 'src/shell.html'), encoding='utf-8').read()
        m = re.search(r'id="transitData">(.*?)</script>', s, re.S)
        T = json.loads(m.group(1))
        S = [x for x in stations if len(x) > 5 and x[4] is not None and x[5] is not None]
        def fit(ix):
            M = [[0.0] * 3 for _ in range(3)]; v = [0.0] * 3
            for q in S:
                xx = (q[2], q[1], 1.0)
                for i in range(3):
                    v[i] += xx[i] * q[ix]
                    for j in range(3): M[i][j] += xx[i] * xx[j]
            det = lambda a: a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
            d0 = det(M)
            return [det([[v[i] if j == k else M[i][j] for j in range(3)] for i in range(3)]) / d0 for k in range(3)]
        X, Y = fit(4), fit(5); dd = X[0] * Y[1] - X[1] * Y[0]
        def toLL(x, y):
            px, py = x - X[2], y - Y[2]
            return ((px * Y[1] - py * X[1]) / dd, (X[0] * py - Y[0] * px) / dd)
        for li, arr in (T.get('paths') or {}).items():
            col = (T.get('col') or [])[int(li)] if int(li) < len(T.get('col') or []) else '#888'
            for st in (arr if isinstance(arr, list) else [arr]):
                pts = [tuple(map(float, q.split(','))) for q in str(st).split() if ',' in q]
                if len(pts) > 1: _SUB.append((col, [toLL(x, y) for x, y in pts]))
    except Exception:
        _SUB = []
    return _SUB

def minimap(r, GEO, D, short):
    """구역 경계 + 주변 정비구역 + 구 경계 + 지하철 노선·역 + 축척. 경계가 없으면 빈 문자열."""
    Z = GEO.get('z') or {}
    z = Z.get(r['id'])
    if not z or not z.get('g'): return ''
    rings = _rings(z['g']); est = str(z.get('e') or '') == '1'
    xs = [p[0] for rg in rings for p in rg]; ys = [p[1] for rg in rings for p in rg]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    kx = math.cos(math.radians(cy)) * 111320; ky = 110540   # 도 → m
    W, H = 640, 400
    bw, bh = (max(xs) - min(xs)) * kx, (max(ys) - min(ys)) * ky
    # 구역이 그림의 1/3쯤 차지하게, 다만 세로로 최소 650m는 보이게(역·주변이 같이 보이도록)
    sc = min(W / max(1, bw * 3.0), H / max(1, bh * 3.0), H / 650.0)
    sc = max(sc, H / 4000.0)
    P = lambda lng, lat: ((lng - cx) * kx * sc + W / 2, H / 2 - (lat - cy) * ky * sc)
    inv = lambda x, y: (cx + (x - W / 2) / (kx * sc), cy + (H / 2 - y) / (ky * sc))
    (l0, t0), (l1, t1) = inv(-40, H + 40), inv(W + 40, -40)   # 보이는 범위(조금 넉넉히)
    inview = lambda lng, lat: l0 <= lng <= l1 and t0 <= lat <= t1
    def path(rgs):
        return ''.join('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in (P(*q) for q in rg)) + 'Z' for rg in rgs)
    def bbox_hit(rgs):
        a = [p for rg in rgs for p in rg]
        return a and not (max(p[0] for p in a) < l0 or min(p[0] for p in a) > l1 or max(p[1] for p in a) < t0 or min(p[1] for p in a) > t1)
    o = []
    # 구 경계: 이 구는 밝게, 옆 구는 조금 어둡게 + 이름
    gus = [(g['n'], _rings(g['r'])) for g in (GEO.get('gu') or [])]
    for n, rgs in gus:
        if n != r['g'] and bbox_hit(rgs): o.append(f'<path d="{path(rgs)}" class="mm-og"/>')
    for n, rgs in gus:
        if n == r['g']: o.append(f'<path d="{path(rgs)}" class="mm-gu"/>')
    # 250m 격자
    step = 250 * sc
    if step >= 24:
        gl = ''.join(f'M{x:.1f},0V{H}' for x in [W / 2 + i * step for i in range(-int(W / step), int(W / step) + 1)] if 0 < x < W)
        gl += ''.join(f'M0,{y:.1f}H{W}' for y in [H / 2 + i * step for i in range(-int(H / step), int(H / step) + 1)] if 0 < y < H)
        o.append(f'<path d="{gl}" class="mm-grid"/>')
    # 주변 정비구역
    near = []
    for zid, v in Z.items():
        if zid == r['id'] or not v.get('g'): continue
        l = v.get('l')
        if l and not (l0 - 0.01 <= l[0] <= l1 + 0.01 and t0 - 0.01 <= l[1] <= t1 + 0.01): continue
        rg = _rings(v['g'])
        if bbox_hit(rg): near.append(f'<path d="{path(rg)}" class="mm-oz"/>')
    o.extend(near[:40])
    # 지하철 노선
    for col, pts in _subway(D.get('stations') or []):
        run = []
        for i, q in enumerate(pts):
            nb = inview(*q) or (i and inview(*pts[i - 1])) or (i + 1 < len(pts) and inview(*pts[i + 1]))
            if nb: run.append(q)
            elif run:
                if len(run) > 1: o.append(('L', col, run))
                run = []
        if len(run) > 1: o.append(('L', col, run))
    lines = [x for x in o if isinstance(x, tuple)]; o = [x for x in o if not isinstance(x, tuple)]
    for _t, col, run in lines:
        d = 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in (P(*q) for q in run))
        o.append(f'<path d="{d}" class="mm-lc"/><path d="{d}" class="mm-ln" stroke="{col}"/>')
    # 이 구역
    o.append(f'<path d="{path(rings)}" class="mm-z{" mm-ze" if est else ""}" fill-rule="evenodd"/>')
    # 역(가까운 순 6곳)
    st = []
    for s_ in (D.get('stations') or []):
        x, y = P(s_[2], s_[1])
        if 10 <= x <= W - 10 and 18 <= y <= H - 10: st.append(((x - W / 2) ** 2 + (y - H / 2) ** 2, x, y, s_[0]))
    st.sort(); st = st[:6]
    # 구역 이름표 자리: 기본은 경계 위 · 역 점·이름을 덮으면 아래/옆으로(o1059 '미아역'을 이름표가 가리던 것)
    ry = [P(*q)[1] for rg in rings for q in rg]; rx = [P(*q)[0] for rg in rings for q in rg]
    top, bot = min(ry), max(ry)
    nm = short(r['n']); tw = min(300, 16 + 13.5 * len(nm))
    hit = lambda a, b: a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]
    lw = lambda n: 7.2 * len(n) * 1.25 + 4   # 12.5px 굵은 한글 폭 어림
    def lab_box(x, y, n, k):   # k: 0 위 · 1 아래 · 2 오른쪽 · 3 왼쪽 → (상자, text x, y, anchor)
        w = lw(n)
        if k == 0: return (x - w / 2, y - 24, x + w / 2, y - 8), x, y - 10, 'middle'
        if k == 1: return (x - w / 2, y + 9, x + w / 2, y + 25), x, y + 22, 'middle'
        if k == 2: return (x + 9, y - 9, x + 9 + w, y + 7), x + 10, y + 4.5, 'start'
        return (x - 9 - w, y - 9, x - 9, y + 7), x - 10, y + 4.5, 'end'
    cands = []
    for i, (px, ly) in enumerate([(W / 2, max(30, top - 12)), (W / 2, min(H - 44, bot + 34)), (W / 2 - tw / 2 - 30, max(30, top - 12)), (W / 2 + tw / 2 + 30, max(30, top - 12)), (W / 2, max(30, top - 40))]):
        px = min(max(px, tw / 2 + 8), W - tw / 2 - 8)
        box = (px - tw / 2, ly - 21, px + tw / 2, ly + 5)
        sc_ = sum(3 for _, x, y, n in st if hit(box, (x - 8, y - 8, x + 8, y + 8))) + sum(1 for _, x, y, n in st if hit(box, lab_box(x, y, n, 0)[0]))
        cands.append((sc_, i, px, ly, box))
    _, _, px, ly, pill = min(cands)
    used = [pill] + [(x - 7, y - 7, x + 7, y + 7) for _, x, y, n in st]
    for _, x, y, n in st:
        own = (x - 7, y - 7, x + 7, y + 7)
        for k in (0, 1, 2, 3):
            b, tx, ty, an = lab_box(x, y, n, k)
            if b[0] >= 2 and b[2] <= W - 2 and b[1] >= 2 and b[3] <= H - 2 and not any(hit(b, u) for u in used if u != own): break
        else: b, tx, ty, an = lab_box(x, y, n, 0)
        used.append(b)
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5.5" class="mm-st"/><text x="{tx:.1f}" y="{ty:.1f}" class="mm-tx" text-anchor="{an}">{esc(n)}</text>')
    if not st:   # 보이는 역이 없으면 가장 가까운 역 쪽 가장자리에 방향 표시
        best = min(((((s_[2] - cx) * kx) ** 2 + ((s_[1] - cy) * ky) ** 2) ** .5, s_) for s_ in (D.get('stations') or [])) if D.get('stations') else None
        if best:
            dm, s_ = best; x, y = P(s_[2], s_[1]); dx, dy = x - W / 2, y - H / 2; f = min((W / 2 - 70) / max(1e-6, abs(dx)), (H / 2 - 40) / max(1e-6, abs(dy)))
            ex, ey = W / 2 + dx * f, H / 2 + dy * f; ang = math.degrees(math.atan2(dy, dx))
            lab = f'{s_[0]} {round(dm / 50) * 50:,}m'
            o.append(f'<g class="mm-off"><path d="M0,-7L12,0L0,7z" transform="translate({ex:.1f},{ey:.1f}) rotate({ang:.0f})"/><text x="{ex - (dx > 0) * 10 + (dx <= 0) * 10:.1f}" y="{ey + (18 if dy < 0 else -12):.1f}" text-anchor="{"end" if dx > 0 else "start"}" class="mm-tx">{esc(lab)}</text></g>')
    # 구역 이름표
    o.append(f'<g class="mm-lab"><rect x="{px - tw / 2:.1f}" y="{ly - 21:.1f}" width="{tw:.1f}" height="26" rx="13"/><text x="{px:.1f}" y="{ly - 3.5:.1f}" text-anchor="middle">{esc(nm)}</text></g>')
    # 축척·방위·구 이름
    m = next((v for v in (50, 100, 200, 250, 500, 1000) if v * sc >= 70), 1000); bar = m * sc
    o.append(f'<g class="mm-sb"><rect x="10" y="{H - 34}" width="{bar + 24:.1f}" height="26" rx="6"/><path d="M22,{H - 14}h{bar:.1f}M22,{H - 18}v8M{22 + bar:.1f},{H - 18}v8"/><text x="22" y="{H - 20}">{m if m < 1000 else 1}{"m" if m < 1000 else "km"}</text></g>')
    o.append(f'<g class="mm-n"><circle cx="{W - 24}" cy="24" r="14"/><path d="M{W - 24},14l5,12h-10z"/><text x="{W - 24}" y="36" text-anchor="middle">N</text></g>')
    o.append(f'<text x="14" y="26" class="mm-gn">{esc(r["g"])}</text>')
    css = ('.mm-bg{fill:#e6eaf0}.mm-og{fill:#eef1f5;stroke:#b8c0cc;stroke-width:1}.mm-gu{fill:#fbfcfd;stroke:#7b8594;stroke-width:1.6;stroke-dasharray:7 4}'
           '.mm-grid{stroke:#1f3a87;stroke-opacity:.06;stroke-width:1;fill:none}.mm-oz{fill:#1f3a87;fill-opacity:.07;stroke:#1f3a87;stroke-opacity:.35;stroke-width:1}'
           '.mm-lc{fill:none;stroke:#fff;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}.mm-ln{fill:none;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;opacity:.9}'
           '.mm-z{fill:#1f3a87;fill-opacity:.32;stroke:#1f3a87;stroke-width:3;stroke-linejoin:round}.mm-ze{stroke-dasharray:6 4}'
           '.mm-st{fill:#fff;stroke:#333d4b;stroke-width:2.5}.mm-tx{font:700 12.5px Pretendard,system-ui,sans-serif;fill:#333d4b;paint-order:stroke;stroke:#fff;stroke-width:3.5;stroke-linejoin:round}'
           '.mm-lab rect{fill:#1f3a87}.mm-lab text{font:700 13px Pretendard,system-ui,sans-serif;fill:#fff}'
           '.mm-sb rect,.mm-n circle{fill:#fff;fill-opacity:.9}.mm-sb path{stroke:#333d4b;stroke-width:2;fill:none}.mm-sb text{font:600 11px Pretendard,system-ui,sans-serif;fill:#333d4b}'
           '.mm-n path,.mm-off path{fill:#333d4b}.mm-n text{font:700 8px system-ui,sans-serif;fill:#333d4b}.mm-gn{font:700 13px Pretendard,system-ui,sans-serif;fill:#4e5968;paint-order:stroke;stroke:#fbfcfd;stroke-width:4}'
           '@media (prefers-color-scheme:dark){.mm-bg{fill:#121722}.mm-og{fill:#171d2a;stroke:#3a4458}.mm-gu{fill:#1b2130;stroke:#8b95a8}.mm-grid{stroke:#fff}.mm-oz{fill:#7da2ff;stroke:#7da2ff}'
           '.mm-lc{stroke:#1b2130}.mm-z{fill:#7da2ff;stroke:#9db8ff}.mm-st{fill:#1b2130;stroke:#d5dae3}.mm-tx{fill:#d5dae3;stroke:#1b2130}.mm-lab rect{fill:#9db8ff}.mm-lab text{fill:#14213d}'
           '.mm-sb rect,.mm-n circle{fill:#1b2130}.mm-sb path{stroke:#d5dae3}.mm-sb text,.mm-n text{fill:#d5dae3}.mm-n path,.mm-off path{fill:#d5dae3}.mm-gn{fill:#c3cad9;stroke:#1b2130}}')
    cap = '경계 자료가 없어 면적만큼 원으로 그렸어요 · ' if est else ''
    return (f'<figure class="mm" style="margin:16px 0 8px"><svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(short(r["n"]))} 위치 지도: 정비구역 경계(서울도시공간포털)와 가까운 지하철역">'
            f'<style>{css}</style><rect width="{W}" height="{H}" class="mm-bg"/>{"".join(o)}</svg>'
            f'<figcaption class="meta">{cap}<a href="../#{r["id"]}">지도에서 크게 보기</a></figcaption></figure>')

# ---------- 공유 카드(OG) ----------
_FONTS = {}
def _font(w, size):
    k = (w, size)
    if k in _FONTS: return _FONTS[k]
    from PIL import ImageFont
    cands = {'b': ['/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'], 'r': ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'], 'k': ['/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc']}[w]
    for p in cands:
        if os.path.exists(p):
            try: _FONTS[k] = ImageFont.truetype(p, size, index=1); return _FONTS[k]   # index 1 = KR
            except Exception: pass
    raise RuntimeError('no CJK font')
_OGH = None
_OGHF = os.path.join(ROOT, 'pipeline/og_z.json')
def og_ok():
    try:
        import PIL  # noqa
        _font('b', 20); return True
    except Exception:
        return False
_G = None
def _geo():
    global _G
    if _G is None:
        try: _G = json.load(open(os.path.join(ROOT, 'public/data/geo.json'), encoding='utf-8'))
        except Exception: _G = {}
    return _G
def og_card(rid, nm, sub, stage, money_lab, money, loc, gu, upd, text_only=False):
    """text_only=True: 지도 없이 글자만(손으로 쓴 페이지 등 위치 그림을 쓰지 않는 카드)."""
    """public/og/z/<rid>.png를 만든다(내용이 같으면 건너뜀). 성공하면 사이트 경로, 아니면 None."""
    global _OGH
    out = os.path.join(ROOT, 'public/og/z', rid + '.png')
    key = hashlib.md5(json.dumps([nm, sub, stage, money_lab, money, upd[:7], [round(v, 3) for v in (loc or [])], gu, 5, text_only, BRAND, BRAND_EN]).encode()).hexdigest()[:12]
    if _OGH is None:
        try: _OGH = json.load(open(_OGHF))
        except Exception: _OGH = {}
    if _OGH.get(rid) == key and os.path.exists(out): return f'/og/z/{rid}.png'
    try:
        from PIL import Image, ImageDraw
        W, H = 1200, 630
        im = Image.new('RGB', (W, H), '#ffffff'); d = ImageDraw.Draw(im)
        NAVY, INK, MUT, YEL = '#1f3a87', '#191f28', '#6b7684', '#f5c33b'
        d.rectangle([0, 0, W, 14], fill=NAVY)
        # 오른쪽: 서울 지도 위 위치(구 경계 · 이 구 칠하기 · 구역 점)
        bx0, by0, bx1, by1 = 740, 96, 1150, 534
        if not text_only: d.rounded_rectangle([bx0, by0, bx1, by1], 28, fill='#f3f6fb')
        G = _geo()
        if G.get('seoul') and loc and not text_only:
            allp = [p for rg in _rings(G['seoul']) for p in rg]
            x0, x1 = min(p[0] for p in allp), max(p[0] for p in allp); y0, y1 = min(p[1] for p in allp), max(p[1] for p in allp)
            kx = math.cos(math.radians((y0 + y1) / 2))
            s_ = min((bx1 - bx0 - 50) / ((x1 - x0) * kx), (by1 - by0 - 50) / (y1 - y0))
            ox = (bx0 + bx1) / 2 - (x0 + x1) / 2 * kx * s_; oy = (by0 + by1) / 2 + (y0 + y1) / 2 * s_
            PP = lambda q: (q[0] * kx * s_ + ox, oy - q[1] * s_)
            for g in (G.get('gu') or []):
                for rg in _rings(g['r']):
                    if len(rg) > 2: d.polygon([PP(q) for q in rg], fill='#c9d4ec' if g['n'] == gu else '#ffffff', outline='#9aa6b8')
            for rg in _rings(G['seoul']):
                if len(rg) > 2: d.line([PP(q) for q in rg] + [PP(rg[0])], fill='#6b7684', width=3)
            px, py = PP(loc)
            d.ellipse([px - 17, py - 17, px + 17, py + 17], fill='#f5c33b')
            d.ellipse([px - 9, py - 9, px + 9, py + 9], fill=NAVY, outline='#ffffff', width=3)
        # 왼쪽: 글자
        # 머리: 앱 아이콘(집 든 핀) + 서비스 이름(brand.BRAND·BRAND_EN) · 서울 재개발 지도
        lx = 64
        try:
            ic = Image.open(os.path.join(ROOT, 'public/icon-512.png')).convert('RGBA').resize((56, 56), Image.LANCZOS)
            im.paste(ic, (56, 50), ic); lx = 116
        except Exception: pass
        d.text((lx, 56), (BRAND), font=_font('k', 40), fill=NAVY)
        lx += d.textlength((BRAND), font=_font('k', 40)) + 10
        d.text((lx, 71), (BRAND_EN), font=_font('b', 26), fill=NAVY)
        lx += d.textlength((BRAND_EN), font=_font('b', 26)) + 2
        d.text((lx, 70), '· 서울 재개발 지도', font=_font('b', 24), fill=MUT)
        f = 72
        while f > 40 and d.textlength(nm, font=_font('k', f)) > (1070 if text_only else 660): f -= 4
        d.text((64, 150), nm, font=_font('k', f), fill=INK)
        d.text((66, 150 + f + 22), sub, font=_font('r', 30), fill=MUT)
        y = 150 + f + 90
        tw = d.textlength(stage, font=_font('b', 30))
        d.rounded_rectangle([64, y, 64 + tw + 44, y + 56], 28, fill=NAVY)
        d.text((86, y + 7), stage, font=_font('b', 30), fill='#ffffff')
        if money:
            d.text((64, y + 92), money_lab, font=_font('b', 28), fill=MUT)
            d.text((64, y + 130), money, font=_font('k', 76), fill=NAVY)
        d.rectangle([64, H - 54, 64 + 56, H - 48], fill=YEL)
        d.text((64, H - 42), f'데이터 기준 {upd} · jaegaebal.alwaysquestions.kr', font=_font('r', 22), fill=MUT)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.quantize(colors=48, method=Image.Quantize.MEDIANCUT).save(out, optimize=True)
        _OGH[rid] = key
        return f'/og/z/{rid}.png'
    except Exception:
        return None
def og_save():
    if _OGH is not None:
        try: json.dump(_OGH, open(_OGHF, 'w'), ensure_ascii=False, separators=(',', ':'))
        except Exception: pass
