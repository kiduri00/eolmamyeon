#!/usr/bin/env python3
"""정적 페이지에 앱과 같은 아래 탭 4개(찾기·관심·소식·MY)를 넣는다(폰 폭에서만 보임).
build.py 끝에서 부른다. 이미 넣은 자리(<!--zp-tabs--> … <!--/zp-tabs-->)는 통째로 바꾸므로 몇 번 돌려도 결과가 같다.
지금 탭: 구역(/z)·구(/gu)·404 = 찾기, 나머지(가이드·리포트·약관·FAQ …) = MY."""
import os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(R, 'public')
SV = lambda d: f'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{d}"/></svg>'
TABS = [
    ('home', '/', '찾기', 'M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14'),
    ('fav', '/#favTop', '관심', 'M12 22c-3.4-4.1-7.2-8.4-7.2-12.6a7.2 7.2 0 0 1 14.4 0c0 4.2-3.8 8.5-7.2 12.6zM12 12a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'),
    ('news', '/#news', '소식', 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4zM10 20.5a2.2 2.2 0 0 0 4 0'),
    ('my', '/#my', 'MY', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0'),
]
CSS = ('.zp-tabs{display:none}'
       '@media (max-width:980px){body{padding-bottom:calc(64px + env(safe-area-inset-bottom,0px))!important}'
       '.zp-tabs{position:fixed;left:0;right:0;bottom:0;z-index:50;display:grid;grid-template-columns:repeat(4,1fr);'
       'padding:6px max(8px,env(safe-area-inset-left,0px)) calc(6px + env(safe-area-inset-bottom,0px)) max(8px,env(safe-area-inset-right,0px));'
       'background:var(--surface,#fff);border-top:1px solid var(--border,#e5e8eb);font-family:inherit;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}'
       '.zp-tabs a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:50px;color:var(--text-2,#4e5968);font:600 11.5px/1.2 inherit;text-decoration:none!important}'
       '.zp-tabs a[aria-current="page"]{color:var(--brand,#1f3a87)}'
       '.zp-tabs a:focus-visible{outline:2px solid var(--brand,#1f3a87);outline-offset:-4px;border-radius:12px}}'
       '@media (max-width:980px) and (prefers-color-scheme:dark){:root:not([data-theme="light"]) .zp-tabs{background:var(--surface,#15181d);border-top-color:var(--border,#2a3038)}'
       ':root:not([data-theme="light"]) .zp-tabs a{color:var(--text-2,#b4bcc6)}:root:not([data-theme="light"]) .zp-tabs a[aria-current="page"]{color:var(--brand,#93ade6)}}'
       '@media (max-width:980px){.logo .logo-s{display:none!important}}'
       '@media print{.zp-tabs{display:none!important}}')


def block(cur):
    ac = ' aria-current="page"'
    a = ''.join(f'<a href="{u}"{ac if k == cur else ""}>{SV(d)}<span>{t}</span></a>' for k, u, t, d in TABS)
    return f'<!--zp-tabs--><style>{CSS}</style><nav class="zp-tabs" aria-label="주요 메뉴">{a}</nav><!--/zp-tabs-->'


RX = re.compile(r'<!--zp-tabs-->.*?<!--/zp-tabs-->', re.S)


def main():
    n = 0
    for root, _, files in os.walk(PUB):
        for f in files:
            if not f.endswith('.html'): continue
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, PUB).replace(os.sep, '/')
            if rel == 'index.html' or rel.startswith('b/'): continue
            h = open(fp, encoding='utf-8').read()
            if '</body>' not in h: continue
            cur = 'home' if rel.startswith(('z/', 'gu/')) or rel == '404.html' else 'my'
            b = block(cur)
            h1 = RX.sub(lambda m: b, h, count=1) if RX.search(h) else h.replace('</body>', b + '\n</body>', 1)
            if h1 != h:
                open(fp, 'w', encoding='utf-8').write(h1); n += 1
    print('static tabs:', n, 'pages updated')


if __name__ == '__main__':
    main()
