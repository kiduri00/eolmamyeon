#!/usr/bin/env python3
"""사이트 대표 공유 그림 public/og.png(1200×630) — 서비스 이름은 tools/brand.py에서. 예전 손으로 만든 그림과 같은 짜임
(남색 바탕 · v7 가로 로고 + 영문 · '내 돈으로 갈 수 있는 서울 재개발' · 물결 · 주소). 내용이 같으면 다시 쓰지 않는다.
  python3 tools/og_site.py"""
import os, io, hashlib
from brand import BRAND, BRAND_EN, SLOGAN, LOGO_H_DARK
from zmap import _font

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, 'public', 'og.png')


def main():
    from PIL import Image, ImageDraw
    W, H = 1200, 630
    NAVY, LINE, SKY, WHITE, SUB, YEL = '#1f3a87', '#2a4797', '#9fb6ff', '#ffffff', '#d6def5', '#f5c33b'
    im = Image.new('RGB', (W, H), NAVY); d = ImageDraw.Draw(im)
    for x in range(0, W, 60): d.line([(x, 0), (x, H)], fill=LINE, width=1)
    for y in range(0, H, 60): d.line([(0, y), (W, y)], fill=LINE, width=1)
    # 물결(아래)
    import math
    pts = [(x, 560 - 28 * math.sin((x - 80) / 190)) for x in range(0, W + 1, 8)]
    d.line(pts, fill='#3d5cad', width=34)
    # 브랜드 v7 가로 로고(마크 + 한글 워드마크 · 어두운 바탕용) — tools/brand_assets
    lg = Image.open(os.path.join(R, LOGO_H_DARK)).convert('RGBA')
    lh = 132; lg = lg.resize((round(lg.width * lh / lg.height), lh), Image.LANCZOS)
    im.paste(lg, (92, 88), lg)
    d.text((92 + lg.width + 22, 140), BRAND_EN, font=_font('b', 46), fill=SKY)
    # 핵심 문구 두 줄('내 돈'만 하늘색)
    f2 = _font('k', 54)
    a, b = '내 돈', SLOGAN[len('내 돈'):]
    l1, l2 = (b.split(' 서울 ')[0], '서울 ' + b.split(' 서울 ')[1]) if ' 서울 ' in b else (b, '')
    d.text((96, 288), a, font=f2, fill=SKY)
    d.text((96 + d.textlength(a, font=f2), 288), l1, font=f2, fill=WHITE)
    d.text((96, 360), l2, font=f2, fill=WHITE)
    d.text((98, 458), '금액만 고르면 · 지금 필요한 돈 · 입주까지 현금 · 언제 입주', font=_font('r', 28), fill=SUB)
    dom = 'jaegaebal.alwaysquestions.kr'
    fd = _font('b', 28)
    d.text((W - 96 - d.textlength(dom, font=fd), 544), dom, font=fd, fill=SUB)
    buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True); new = buf.getvalue()
    old = open(OUT, 'rb').read() if os.path.exists(OUT) else b''
    if hashlib.md5(new).digest() != hashlib.md5(old).digest():
        open(OUT, 'wb').write(new); print('og.png', len(new), 'bytes')
    else: print('og.png same')


if __name__ == '__main__':
    main()
