#!/usr/bin/env python3
"""정비사업 정보몽땅(cleanup.seoul.go.kr) 갱신: 사업장 목록(단계) + 사업장별 추진경과(인가일·최근 활동).
캐시: pipeline/cache/cleanup.json  {cafeUrl: {row:{...}, dt:{단계:날짜}, ev:[[날짜, 단계, 내용]...최근 8], ts: 조회일}}
사용: python3 tools/cleanup.py [--full] [--max N]
 - 목록은 매번 한 번에 받아(약 1MB) 단계 글자가 바뀐 사업장, 캐시가 없는 사업장, 7일 넘은 사업장 순으로 추진경과를 다시 읽는다.
"""
import re, os, json, time, html, argparse, datetime, subprocess, threading
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CP = os.path.join(ROOT, 'pipeline/cache/cleanup.json')
BASE = 'https://cleanup.seoul.go.kr'
ap = argparse.ArgumentParser(); ap.add_argument('--full', action='store_true'); ap.add_argument('--max', type=int, default=400); ap.add_argument('--days', type=int, default=7)
A = ap.parse_args()
TODAY = datetime.date.today().isoformat()

def get(url, tries=4):
    for k in range(tries):
        r = subprocess.run(['curl', '-sS', '--compressed', '-m', '60', '-A', 'Mozilla/5.0 (jaegaebal-data-bot; +https://jaegaebal.alwaysquestions.kr/method)', url], capture_output=True)
        if r.returncode == 0 and len(r.stdout) > 500: return r.stdout.decode('utf-8', 'replace')
        time.sleep(3 + 3*k)
    return None
clean = lambda s: html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s))).strip()

lst = get(f'{BASE}/cleanup/bsnssttus/lscrMainIndx.do?cpage=1&pageSize=3000')
if not lst: raise SystemExit('list fetch failed')
rows = {}
for tr in re.findall(r'<tr>(.*?)</tr>', lst[lst.find('<tbody'):], re.S):
    tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)
    m = re.search(r"cafeOpenPopup\('([^']+)'\)", tr)
    if len(tds) < 9 or not m: continue
    mp = re.search(r"mapOpenPopup\('([^']+)'\)", tr)
    rows[m.group(1)] = {'no': int(clean(tds[0]) or 0), 'g': clean(tds[1]), 'k': clean(tds[2]), 'n': clean(tds[3]), 'j': clean(tds[4]), 'sr': clean(tds[5]), 'map': mp.group(1) if mp else None}
print('list rows', len(rows), flush=True)
cache = json.load(open(CP, encoding='utf-8')) if os.path.exists(CP) else {}

# 단계 섹션 → 대표 날짜 규칙 (첫 '인가/승인/고시' 날짜)
SEC = [('정비구역지정', '구역지정', r'구역지정\(변경\)고시|지정고시'), ('조합설립추진위원회승인', '추진위', r'^\[\(변경\)승인\]'), ('조합설립인가', '조합설립', r'^\[\(변경\)인가\]'),
       ('사업시행자지정', '시행자지정', r'지정고시|^\[\(변경\)지정\]'), ('사업시행인가', '사업시행', r'^\[\(변경\)인가\]'), ('관리처분인가', '관리처분', r'^\[\(변경\)인가\]'),
       ('시공자선정', '시공자', r'^\[업체선정\]'), ('착공신고', '착공', r'^(?!.*신청).'), ('준공인가', '준공', r'^(?!.*신청).*(인가|준공)'), ('이주', '이주', r'.'), ('조합해산', '해산', r'.')]
def progress(cafe):
    main = get(f'{BASE}/cafe/mainIndx.do?cafeUrl={cafe}')
    if not main: return None
    m = re.search(r'cleanup-prtnelapse/vscr\.do\?cafeId=([0-9A-Z]+)&(?:amp;)?bsnsPk=([0-9\-]+)', main)
    if not m: return {'dt': {}, 'ev': []}
    pg = get(f'{BASE}/cafe/mainIndx/cleanup-prtnelapse/vscr.do?cafeId={m.group(1)}&bsnsPk={m.group(2)}')
    if not pg: return None
    dt, ev = {}, []
    for name, body in re.findall(r'<a href="#foldings-data-cont\d+"[^>]*>\s*<span>\s*([^<]+?)\s*</span>.*?<ul class="check-list01">(.*?)</ul>', pg, re.S):
        name = re.sub(r'\s', '', name)
        ents = [(re.sub(r'\s', '', d), clean(t)) for d, t in re.findall(r'<h3 class="tit">\s*([\d\-\s]+?)\s*</h3>(.*?)</li>', body, re.S)]
        for d, t in ents:
            if re.match(r'\d{4}-\d{2}-\d{2}$', d): ev.append([d, name, t[:90]])
        for sname, key, pat in SEC:
            if name == sname and key not in dt:
                hit = next((d for d, t in ents if re.match(r'\d{4}-\d{2}-\d{2}$', d) and re.search(pat, t)), None)
                if hit: dt[key] = hit
    ev.sort(reverse=True)
    return {'dt': dt, 'ev': ev[:8], 'cid': m.group(1)}

def stale(c):
    o = cache.get(c)
    if not o or 'dt' not in o: return 0
    if o.get('row', {}).get('sr') != rows[c]['sr']: return 1
    if A.full: return 2
    age = (datetime.date.fromisoformat(TODAY) - datetime.date.fromisoformat(o.get('ts', '2000-01-01'))).days
    return 3 if age >= A.days else 9
order = sorted(rows, key=lambda c: (stale(c), cache.get(c, {}).get('ts', '')))
todo = [c for c in order if stale(c) < 9][:A.max]
print('todo', len(todo), 'changed', sum(1 for c in todo if stale(c) == 1), 'new', sum(1 for c in todo if stale(c) == 0), flush=True)
LOCK = threading.Lock(); changes = []; done_n = [0]
def save():
    with LOCK: snap = json.dumps(cache, ensure_ascii=False, separators=(',', ':'))
    open(CP + '.tmp', 'w', encoding='utf-8').write(snap); os.replace(CP + '.tmp', CP)
def run(c):
    p = progress(c)
    time.sleep(0.4)
    with LOCK:
        o = cache.get(c, {})
        if p is not None:
            old = o.get('dt', {})
            for k, v in p['dt'].items():
                if old.get(k) != v: changes.append([c, k, old.get(k), v])
            o.update(p); o['ts'] = TODAY
        o['row'] = rows[c]; cache[c] = o
        done_n[0] += 1; n = done_n[0]
    if n % 50 == 0: save(); print(n, '/', len(todo), flush=True)
with ThreadPoolExecutor(4) as ex: list(ex.map(run, todo))
for c in rows:
    cache.setdefault(c, {})['row'] = rows[c]
json.dump(cache, open(CP + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':')); os.replace(CP + '.tmp', CP)
log = os.path.join(ROOT, 'pipeline/cache/cleanup_changes.jsonl')
with open(log, 'a', encoding='utf-8') as f:
    for ch in changes: f.write(json.dumps({'d': TODAY, 'cafe': ch[0], 'k': ch[1], 'old': ch[2], 'new': ch[3]}, ensure_ascii=False) + '\n')
print('done', len(todo), 'date changes', len(changes), flush=True)
