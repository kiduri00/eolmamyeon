#!/usr/bin/env python3
"""구별 '정비사업 새 소식' RSS: 최근 180일 안의 인가·착공·준공(정보몽땅 날짜) → public/feed/gu/<구>.xml, public/feed/index.html"""
import json, os, html, datetime, collections, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://jaegaebal.alwaysquestions.kr'
D = json.load(open(os.path.join(ROOT, 'pipeline/data.enriched.json'), encoding='utf-8'))
P = json.load(open(os.path.join(ROOT, 'public/premium.json'), encoding='utf-8'))
LAB = {'구역지정': '정비구역 지정', '추진위': '추진위원회 승인', '조합설립': '조합설립인가', '시행자지정': '사업시행자 지정', '사업시행': '사업시행인가', '관리처분': '관리처분인가', '착공': '착공', '준공': '준공'}
cut = (datetime.date.today() - datetime.timedelta(days=180)).isoformat()
G = collections.defaultdict(list)
for r in D['recs']:
    for k, d in ((P.get(r['id']) or {}).get('dt') or {}).items():
        if k in LAB and d and d >= cut: G[r['g']].append((d, k, r))
esc = lambda s: html.escape(str(s), quote=True)
out = os.path.join(ROOT, 'public/feed/gu'); os.makedirs(out, exist_ok=True)
gus = sorted({r['g'] for r in D['recs']})
for g in gus:
    ev = sorted(G.get(g, []), key=lambda x: x[0], reverse=True)[:40]
    items = ''.join(f'<item><title>{esc(r["n"])} · {LAB[k]}</title><link>{SITE}/#{r["id"]}</link><guid isPermaLink="false">{r["id"]}-{k}-{d}</guid><pubDate>{datetime.datetime.fromisoformat(d).strftime("%a, %d %b %Y 09:00:00 +0900")}</pubDate><description>{esc(g)} {esc(r.get("j", ""))} · {LAB[k]} {d.replace("-", ".")} (정비사업 정보몽땅 기준)</description></item>' for d, k, r in ev)
    open(os.path.join(out, g + '.xml'), 'w', encoding='utf-8').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>{esc(g)} 정비사업 새 소식 | 집핀 - 서울 재개발 지도</title><link>{SITE}/</link><description>{esc(g)} 재개발·재건축 인가·착공·준공 소식(최근 180일)</description><language>ko</language>{items}</channel></rss>\n')
tpl = open(os.path.join(ROOT, 'public/report/index.html'), encoding='utf-8').read()
head = tpl[:tpl.index('<main>')].replace('<base href="/report/">', '<base href="/feed/">')
import re
head = re.sub(r'<title>.*?</title>', '<title>구별 정비사업 새 소식 구독 | 집핀 - 서울 재개발 지도</title>', head)
head = re.sub(r'(name="description" content=")[^"]*', r'\1서울 25개 구의 재개발·재건축 인가·착공·준공 소식을 RSS로 받아 보세요.', head)
head = re.sub(r'(property="og:title" content=")[^"]*', r'\1구별 정비사업 새 소식 구독 | 집핀 - 서울 재개발 지도', head)
head = re.sub(r'(property="og:description" content=")[^"]*', r'\1서울 25개 구의 재개발·재건축 인가·착공·준공 소식을 RSS로 받아 보세요.', head)
head = head.replace(f'{SITE}/report/"', f'{SITE}/feed/"')   # 대표 주소·og:url = 이 페이지(예전엔 리포트 목록을 가리켰다)
# RSS 주소 목록일 뿐이라 검색 색인에서는 뺀다(링크는 따라감) — 사이트맵에도 안 실린다
if 'name="robots"' not in head: head = head.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex,follow">', 1)
foot = tpl[tpl.index('</main>') + 7:]
rows = ''.join(f'<a class="zl" href="gu/{urllib.parse.quote(g)}.xml"><b>{esc(g)}</b><small>최근 180일 소식 {len(G.get(g, []))}건 · RSS</small></a>' for g in gus)
body = f'<main><h1>구별 정비사업 새 소식 구독</h1><p>관심 있는 구의 RSS 주소를 피드 앱(Feedly, Inoreader, 네이버 블로그 이웃 대신 쓰는 RSS 리더 등)에 넣으면, 정비구역 지정·추진위·조합설립·사업시행·관리처분 인가와 착공·준공이 정보몽땅에 올라올 때마다 받아 볼 수 있어요. 매일 아침 갱신돼요. 가입이나 개인정보는 필요 없어요.</p><div class="rlist">{rows}</div><p class="meta">월간 리포트 전체는 <a href="../report/feed.xml">월간 리포트 RSS</a>로 받을 수 있어요.</p></main>'
open(os.path.join(ROOT, 'public/feed/index.html'), 'w', encoding='utf-8').write(head + body + foot)
print('feeds', len(gus), sum(len(v) for v in G.values()))
# 구역별 소식 RSS: 단계 날짜 + 정보몽땅 추진경과 + 고시·공고 → public/feed/z/<id>.xml
import hashlib
NTP = os.path.join(ROOT, 'public/data/notice.json')
NT = json.load(open(NTP, encoding='utf-8')) if os.path.exists(NTP) else {}
NB = collections.defaultdict(list)
for it in NT.get('items', []): NB[it[1]].append(it)
zd = os.path.join(ROOT, 'public/feed/z'); os.makedirs(zd, exist_ok=True)
for f in os.listdir(zd): os.remove(os.path.join(zd, f))
today = datetime.date.today().isoformat(); nz = 0
rd = lambda d: datetime.datetime.fromisoformat(d[:10]).strftime("%a, %d %b %Y 09:00:00 +0900")
for r in D['recs']:
    # zpages.py와 같은 기준(사업 중단 dn이면서 관리처분 전인 곳은 /z 페이지가 없다 → 그 RSS는 없는 /z로 가는 고아 링크였다: o941·o99)
    if r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7) or r.get('src') == 'moa' or not r.get('n'): continue
    pm = P.get(r['id']) or {}; ev = {}
    for k, d in (pm.get('dt') or {}).items():
        if k in LAB and d and d <= today: ev[(d, LAB[k])] = f'{LAB[k]} (정보몽땅 등록 날짜)'
    for d, sec, t in (pm.get('ev') or []):
        if d and d <= today: ev[(d, t[:60])] = f'{sec} · {t}'
    for d, _, sec, t, c in NB.get(r['id'], []): ev[(d, t[:60])] = f'{sec} · {t}'
    its = sorted(ev.items(), key=lambda x: x[0][0], reverse=True)[:30]
    items = ''.join(f'<item><title>{esc(t)}</title><link>{SITE}/z/{r["id"]}</link><guid isPermaLink="false">{r["id"]}-{d}-{hashlib.md5(t.encode()).hexdigest()[:8]}</guid><pubDate>{rd(d)}</pubDate><description>{esc(desc)}</description></item>' for (d, t), desc in its)
    open(os.path.join(zd, r['id'] + '.xml'), 'w', encoding='utf-8').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>{esc(r["n"])} 소식 | 집핀 - 서울 재개발 지도</title><link>{SITE}/z/{r["id"]}</link><description>{esc(r["g"])} {esc(r["n"])} 인가·고시·추진경과</description><language>ko</language>{items}</channel></rss>\n')
    nz += 1
print('zone feeds', nz)
