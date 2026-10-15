#!/usr/bin/env python3
"""고시·공고 피드: 정보몽땅 추진경과(premium ev)에서 최근 90일 기록을 모아 public/data/notice.json으로.
구역 이름·구·단계는 data.enriched.json에서 붙인다. 날짜가 오늘보다 뒤인 오기(예: 2033년)는 뺀다."""
import json, os, datetime, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
D = J('pipeline/data.enriched.json') if os.path.exists(os.path.join(ROOT, 'pipeline/data.enriched.json')) else J('src/data.json')
P = J('public/premium.json')
byId = {r['id']: r for r in D['recs']}
today = datetime.date.today().isoformat(); cut = (datetime.date.today() - datetime.timedelta(days=90)).isoformat()
def cat(sec, t):
    if '신청' in t: return 'req'
    if re.search('시공자', sec): return 'con'
    if re.search('인가|승인|고시|지정|결정', t + sec) and not re.search('계약', t): return 'ok'
    return 'etc'
out = []
for rid, v in P.items():
    r = byId.get(rid)
    if not r or not v.get('ev') or r.get('dn'): continue
    for d, sec, t in v['ev']:
        if not (cut <= d <= today): continue
        out.append([d, rid, sec, re.sub(r'\s+', ' ', t).strip(), cat(sec, t)])
out.sort(key=lambda x: (x[0], x[1]), reverse=True)
json.dump({'asOf': today, 'items': out}, open(os.path.join(ROOT, 'public/data/notice.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('notice', len(out), {c: sum(1 for x in out if x[4] == c) for c in ('ok', 'con', 'req', 'etc')})
