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
SECS = [('추진위', 3), ('조합설립', 4), ('시행자', 4), ('사업시행', 5), ('관리처분', 6), ('이주', 7), ('철거', 7), ('착공', 8), ('분양', 8), ('준공', 9), ('이전고시', 9), ('정비구역', 2), ('정비계획', 2)]
def cat(sec, t, s_now):
    """대괄호 태그로 분류(정보몽땅은 첫 인가도 '(변경)인가'로 적어서 '변경' 글자는 믿지 않는다).
    req 신청·공람 / con 시공자 선정 / chg 이미 지난 단계의 인가(내용 변경) / ok 지금 단계의 인가·승인·고시 / etc 법인등기·용역 계약 등"""
    m = re.match(r'\[([^\]]*)\]', t); tag = m.group(1) if m else t
    if re.search(r'신청|공람|\(안\)', tag): return 'req'
    if '시공자' in sec and '계약' in tag: return 'con'
    if re.search('등기|계약', tag): return 'etc'
    if re.search('인가|승인|고시|결정|지정', tag):
        st = next((n for k, n in SECS if k in sec), None)
        return 'chg' if st is not None and s_now is not None and st < s_now else 'ok'
    return 'etc'
out = []
for rid, v in P.items():
    r = byId.get(rid)
    if not r or not v.get('ev') or r.get('dn'): continue
    for d, sec, t in v['ev']:
        if not (cut <= d <= today): continue
        out.append([d, rid, sec, re.sub(r'\s+', ' ', t).strip(), cat(sec, t, r.get('s'))])
out.sort(key=lambda x: (x[0], x[1]), reverse=True)
json.dump({'asOf': today, 'items': out}, open(os.path.join(ROOT, 'public/data/notice.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('notice', len(out), {c: sum(1 for x in out if x[4] == c) for c in ('ok', 'chg', 'con', 'req', 'etc')})
