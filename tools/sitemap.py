#!/usr/bin/env python3
"""public/sitemap.xml 재생성: 정적 페이지 + 리포트 + 구역 + 가이드 (lastmod = 파일 내용이 바뀐 날)"""
import os, re, json, hashlib, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public'); SITE = 'https://jaegaebal.alwaysquestions.kr'
STATE = os.path.join(ROOT, 'pipeline/cache/sitemap_state.json')
st = json.load(open(STATE)) if os.path.exists(STATE) else {}
today = datetime.date.today().isoformat()
urls = []
for dp, _, fs in os.walk(PUB):
    for f in fs:
        if not f.endswith('.html'): continue
        rel = os.path.relpath(os.path.join(dp, f), PUB).replace(os.sep, '/')
        s = open(os.path.join(dp, f), encoding='utf-8').read()
        if 'name="robots" content="noindex' in s: continue
        h = hashlib.md5(re.sub(r'데이터 기준 [0-9.]+', '', s).encode()).hexdigest()
        o = st.get(rel)
        if not o or o['h'] != h: st[rel] = o = {'h': h, 'd': today}
        loc = '' if rel == 'index.html' else rel[:-5].replace('/index', '/') if rel.endswith('/index.html') else rel[:-5]
        urls.append((loc, o['d']))
urls.sort(key=lambda u: (u[0].count('/'), u[0]))
xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'<url><loc>{SITE}/{l}</loc><lastmod>{d}</lastmod></url>\n' for l, d in urls) + '</urlset>\n'
open(os.path.join(PUB, 'sitemap.xml'), 'w', encoding='utf-8').write(xml)
json.dump(st, open(STATE, 'w'), separators=(',', ':'))
print('sitemap', len(urls))
