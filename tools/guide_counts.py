#!/usr/bin/env python3
"""가이드 ipjugwon · gap-after-permit의 그림·표 숫자를 빌드된 자료에서 다시 센다(사람이 글에 옮겨 적는 근거).
  python3 tools/guide_counts.py            → 표준 출력에 JSON
입력(빌드 결과만 읽음 · 아무것도 쓰지 않음): pipeline/data.enriched.json(정비사업 목록) · pipeline/calc.json(화면 계산 엔진 결과 · 입주권 판정 win/winT·gapBlock)
  · public/premium.json(단계 날짜)
판정은 화면과 같은 값(calc.json)을 그대로 센다. '다음 인가가 나면 막힘'(near)만 src/app.js buyWindow의 near 규칙을 옮겨 셌다:
  재개발: 사업시행인가 단계(s=5)이고 부칙 예외(신청일·인가일 2018.1.24까지)가 아님 · 재건축·가로·소규모: 추진위 단계(s=3) 또는 uc 표시
리뉴얼 사이클 3(디자인·부동산 레드팀 c2: 가이드 그림·표가 9.26 옛 판정 기준) — 2026.10.28 판정 기준으로 다시 셈."""
import json, os, statistics, collections, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zsample import yrs_since
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
D = J('pipeline/data.enriched.json'); C = J('pipeline/calc.json'); P = J('public/premium.json')
R = [r for r in D['recs'] if not (r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7)) and r.get('src') != 'moa' and r.get('n')]   # 화면 '진행 중'(zpages.R)
MOA = [r for r in D['recs'] if r.get('src') == 'moa' and not r.get('dn')]
SKEY = {2: ('구역지정',), 3: ('추진위',), 4: ('조합설립', '시행자지정'), 5: ('사업시행',), 6: ('관리처분',), 7: ('관리처분',), 8: ('착공',)}
UPD = D.get('upd') or D.get('asOf')
c = lambda r: C.get(r['id']) or {}
isRedev = lambda r: r['k'] in ('재개발', '도시정비형 재개발')
isRB = lambda r: r['k'] in ('재건축', '소규모재건축') or '가로' in r['k'] or '소규모' in r['k']

def b18ex(r):
    cut = '2018-01-24'
    return bool((r.get('b18p') and str(r['b18p'])[:10] <= cut) or (r.get('b18') and str(r['b18'])[:10] <= cut))

def near(r):
    if c(r).get('win') != 'ok': return False
    if isRedev(r): return r.get('s') == 5 and not b18ex(r)
    if isRB(r): return r.get('s') == 3 or bool(r.get('uc'))
    return False

def sdate(r):
    dt = (P.get(r['id']) or {}).get('dt') or {}
    return next((dt[k] for k in SKEY.get(r.get('s', 0)) or () if dt.get(k)), None)

def cat(r):
    b = c(r).get('gapBlock') or ''
    if '아파트 단지 토지거래허가' in b: return 'apt'
    if '신속통합기획' in b: return 'sintong'
    if '공공재개발 토지거래허가' in b: return 'public'
    if b.startswith('지금 사면 입주권 없음'): return 'nowin'
    if b.startswith('입주권 판정 보류'): return 'hold'
    return 'open'

def q(v, p):
    v = sorted(v); k = (len(v) - 1) * p; f = int(k); return v[f] + (v[min(f + 1, len(v) - 1)] - v[f]) * (k - f)

out = {'asOf': D.get('asOf'), 'upd': UPD, 'live': len(R), 'moa': len(MOA)}
# ---- ipjugwon
pop = R + MOA
out['ipju'] = {'n': len(pop), 'bars': collections.Counter(c(r).get('winT') for r in pop).most_common(),
               'nearN': sum(1 for r in R if near(r)),
               'nearByKind': collections.Counter(r['k'] for r in R if near(r)).most_common(),
               'tableStillNear': {i: near(next(r for r in R if r['id'] == i)) for i in ('o392', 'o836', 'o830', 'o845', 'o842') if any(r['id'] == i for r in R)}}
# ---- gap-after-permit
pre = [r for r in R if (r.get('s') or 0) <= 6]
G = collections.defaultdict(list)
for r in pre: G[cat(r)].append(r)
op = G['open']; priced = [r for r in op if c(r).get('gapNow') is not None]
gn = [c(r)['gapNow'] for r in priced]
o = {'pre': len(pre), 'excluded': {'done_or_moa_etc': len(D['recs']) - len(R), 'moving': len(R) - len(pre)}, 'recs': len(D['recs'])}
o['cats'] = {k: len(v) for k, v in G.items()}
o['open_priced'] = len(priced); o['open_est'] = sum(1 for r in priced if not c(r).get('gapOk'))
o['open_listed'] = sum(1 for r in priced if c(r).get('gapOk'))
o['nowin_kind'] = collections.Counter(r['k'] for r in G['nowin']).most_common()
o['hold_detail'] = [(r['id'], r['n'], c(r).get('gapBlock')) for r in G['hold']]
o['sintong_stage'] = collections.Counter(c(r).get('stage') for r in G['sintong']).most_common()
o['public_stage'] = collections.Counter(c(r).get('stage') for r in G['public']).most_common()
# 유형별 표
kinds = ['재개발', '도시정비형 재개발', '재건축', '가로주택(모아주택)', '소규모재건축', '소규모재개발']
o['byKind'] = {k: {'n': sum(1 for r in pre if r['k'] == k), **{x: sum(1 for r in G[x] if r['k'] == k) for x in ('open', 'apt', 'sintong', 'public', 'nowin', 'hold')},
                   'priced': sum(1 for r in priced if r['k'] == k)} for k in kinds}
dj = [r for r in pre if r['k'] == '도시정비형 재개발' and sdate(r)]
o['urbanStall'] = {'dated': len(dj), 'over10': sum(1 for r in dj if (yrs_since(sdate(r), UPD) or 0) >= 10)}
# 구별
byg = collections.defaultdict(lambda: [0, 0, 0])
for r in pre: byg[r['g']][0] += 1
for r in op: byg[r['g']][1] += 1
for r in priced: byg[r['g']][2] += 1
o['byGu'] = sorted(([g, *v] for g, v in byg.items()), key=lambda x: (-x[2], x[0]))
o['byGuZeroOpen'] = sorted(([g, v[0]] for g, v in byg.items() if v[1] == 0), key=lambda x: -x[1])
o['byGuRate'] = sorted(([g, v[1], v[0], round(100 * v[1] / v[0], 1)] for g, v in byg.items() if v[0] >= 10), key=lambda x: -x[3])[:4]
o['openUrbanInGu'] = {g: sum(1 for r in priced if r['g'] == g and r['k'] == '도시정비형 재개발') for g in ('영등포구',)}
# 금액 분포
bins = [('1억 이하', 0, 1), ('1~2억', 1, 2), ('2~3억', 2, 3), ('3~5억', 3, 5), ('5~10억', 5, 10), ('10억 초과', 10, 1e9)]
o['dist'] = [(lab, sum(1 for v in gn if (v > lo + 1e-9 if lo else True) and v <= hi + 1e-9)) for lab, lo, hi in bins]
o['cum'] = {cap: sum(1 for v in gn if v <= cap + 1e-9) for cap in (1, 2, 3, 5)}
o['med'] = round(statistics.median(gn), 3) if gn else None; o['q1'] = round(q(gn, .25), 3) if gn else None; o['q3'] = round(q(gn, .75), 3) if gn else None
le1 = [r for r in priced if c(r)['gapNow'] <= 1 + 1e-9]
o['le1_kind'] = collections.Counter(r['k'] for r in le1).most_common(); o['le1_gu'] = collections.Counter(r['g'] for r in le1).most_common(4)
o['priced_stage'] = collections.Counter(c(r).get('stage') for r in priced).most_common()
pd = [r for r in priced if sdate(r)]
o['priced_dated'] = len(pd); o['priced_over5'] = sum(1 for r in pd if (yrs_since(sdate(r), UPD) or 0) >= 5); o['priced_over10'] = sum(1 for r in pd if (yrs_since(sdate(r), UPD) or 0) >= 10)
o['jeonse566'] = sum(1 for r in priced if c(r).get('jeonse') and c(r).get('price') and abs(c(r)['jeonse'] / c(r)['price'] - 0.566) < 0.002)
o['priceSrc'] = collections.Counter(c(r).get('priceSrc') for r in priced).most_common()
both = [r for r in pre if c(r).get('gapTotal') is not None and c(r).get('need') is not None]
o['both'] = {'n': len(both), 'medGapTotal': round(statistics.median(c(r)['gapTotal'] for r in both), 2) if both else None, 'medCash': round(statistics.median(c(r)['need'] for r in both), 2) if both else None}
out['gap'] = o
print(json.dumps(out, ensure_ascii=False, indent=1))
