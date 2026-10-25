#!/usr/bin/env python3
"""public/sitemap.xml 재생성: 정적 페이지 + 리포트 + 구역 + 가이드
lastmod = 그 페이지 '본문'이 실제로 바뀐 날(27차): <main> 글에서 매일 바뀌는 표시(데이터 기준·갱신 날짜 · 매일 다시 쓰는 최신 숫자 상자 ·
머리·푸터·스크립트)를 뺀 내용의 해시가 지난번과 같으면 지난 날짜를 그대로 둔다. 예전엔 페이지 전체 해시라 98곳이 모두 오늘 날짜였다.
  python3 tools/sitemap.py              # 보통(매일)
  python3 tools/sitemap.py --backfill   # git 이력에서 페이지마다 본문이 마지막으로 바뀐 날을 다시 찾는다(한 번)"""
import os, re, sys, json, hashlib, datetime, collections, urllib.parse, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public'); SITE = 'https://jaegaebal.alwaysquestions.kr'
STATE = os.path.join(ROOT, 'pipeline/cache/sitemap_state.json')
st = json.load(open(STATE)) if os.path.exists(STATE) else {}
today = datetime.date.today().isoformat()
DATE_RX = [r'\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?\.?', r'\d{1,2}\.\d{2}\s*(?:갱신|기준|신고분)', r'\d+\s*일\s*전', r'(?:데이터|자료) 기준[^<\n]{0,20}']
def mainhash(s):
    """본문만(<main> 안 · 없으면 <body>) · 매일 다시 쓰는 덩이(<!--zk-->최신 숫자 상자 · <!--zc-->오늘 숫자 계산 · <!--zr-->신고 링크 · <!--zn-->)·스크립트·스타일 빼고 · 날짜 표시 빼고"""
    m = re.search(r'<main\b[^>]*>(.*)</main>', s, re.S)
    b = m.group(1) if m else re.sub(r'^.*?<body[^>]*>', '', s, flags=re.S)
    b = re.sub(r'<!--(z[kcrn])-->.*?<!--/\1-->', '', b, flags=re.S)
    b = re.sub(r'<(script|style|svg|nav|footer|header)\b[^>]*>.*?</\1>', '', b, flags=re.S)
    t = re.sub(r'<[^>]+>', ' ', b)
    for rx in DATE_RX: t = re.sub(rx, ' ', t)
    return hashlib.md5(re.sub(r'\s+', ' ', t).strip().encode()).hexdigest()
def pages():
    for dp, _, fs in os.walk(PUB):
        for f in fs:
            if not f.endswith('.html'): continue
            rel = os.path.relpath(os.path.join(dp, f), PUB).replace(os.sep, '/')
            s = open(os.path.join(dp, f), encoding='utf-8').read()
            if 'name="robots" content="noindex' in s or 'http-equiv="refresh"' in s: continue   # 색인 안 하는 페이지(얇은 구역 페이지 · 옛 주소 이동 · 404 · 운영자 화면)
            loc = '' if rel == 'index.html' else rel[:-5].replace('/index', '/') if rel.endswith('/index.html') else rel[:-5]
            cm = re.search(r'<link rel="canonical" href="([^"]*)"', s)
            if cm and urllib.parse.unquote(cm.group(1)) != f'{SITE}/{loc}': continue   # 대표 주소가 다른 페이지는 대표 주소만 싣는다
            yield rel, loc, s
def backfill(rel, cur):
    """git 이력(오래된 것부터)에서 본문 해시가 지금과 같아진 첫 커밋 날짜 · 지금 파일이 마지막 커밋과 다르면 오늘"""
    try:
        log = subprocess.run(['git', 'log', '--format=%H %cs', '--', 'public/' + rel], cwd=ROOT, capture_output=True, text=True, timeout=60).stdout.split('\n')
    except Exception: return None
    vers = [l.split() for l in log if l.strip()]
    d = None
    for h, cs in vers:   # 최신 → 옛날: 해시가 지금과 같은 동안 날짜를 뒤로 민다
        try: s = subprocess.run(['git', 'show', f'{h}:public/{rel}'], cwd=ROOT, capture_output=True, text=True, timeout=30).stdout
        except Exception: break
        if not s or mainhash(s) != cur: break
        d = cs
    return d or today
BF = '--backfill' in sys.argv
urls = []
for rel, loc, s in pages():
    h = mainhash(s); o = st.get(rel)
    if BF: o = st[rel] = {'m': h, 'd': backfill(rel, h)}
    elif not o or o.get('m') != h: o = st[rel] = {'m': h, 'd': today}
    urls.append((loc, o['d']))
    # 28차: 구조화 데이터 dateModified = 사이트맵 lastmod(본문 해시가 바뀐 날) — /z 손글 페이지가 10-10, 사이트맵은 10-25로 엇갈리던 것.
    # JSON-LD는 mainhash에서 빠지는 <script> 안이라 고쳐도 본문 해시는 그대로다
    s2 = re.sub(r'(<script type="application/ld\+json">.*?</script>)', lambda m: re.sub(r'("dateModified":\s*")\d{4}-\d\d-\d\d(")', lambda q: q.group(1) + o['d'] + q.group(2), m.group(1)), s, flags=re.S)
    if s2 != s: open(os.path.join(PUB, rel), 'w', encoding='utf-8').write(s2); nld = globals().get('nld', 0) + 1; globals()['nld'] = nld
urls.sort(key=lambda u: (u[0].count('/'), u[0]))
# 25차: 한글 경로(/gu/강남구)는 퍼센트 인코딩해서 싣는다(그대로 요청하면 307로 한 번 돌아 들어왔다)
xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'<url><loc>{SITE}/{urllib.parse.quote(l, safe="/")}</loc><lastmod>{d}</lastmod></url>\n' for l, d in urls) + '</urlset>\n'
open(os.path.join(PUB, 'sitemap.xml'), 'w', encoding='utf-8').write(xml)
json.dump(st, open(STATE, 'w'), separators=(',', ':'))
comp = collections.Counter((l.split('/')[0] if '/' in l else 'static') for l, _ in urls)
print('ld dateModified aligned', globals().get('nld', 0)); print('sitemap', len(urls), dict(comp), f"/z share {comp.get('z', 0) / max(1, len(urls)) * 100:.0f}%", 'lastmod', dict(collections.Counter(d for _, d in urls).most_common(6)))
