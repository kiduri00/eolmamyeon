#!/usr/bin/env python3
"""앱용 공개 데이터(JSON) → public/api/v1/
사이트와 같은 자료·같은 계산 엔진 결과(calc.json: 무주택·84㎡·기본 가정)를 앱이 바로 쓰기 좋은 모양으로 낸다. 매일 갱신.
  meta.json            버전·갱신 시각·엔드포인트·가정
  zones.json           진행 중 구역 전체(목록·지도용 요약)
  zones/<id>.json      구역 상세(인가 이력·정보몽땅 기록·실거래·토지거래허가·주변 상권)
  cash.json            현금(0.5억 단위)별 가능 구역 수: 전체·구별, 전세 끼고/현금만
  rank.json            구역 실거래 순위(거래량·1년 변화·신고가)
  notice.json          고시·공고(최근 90일)
  rebuild.json         재건축 연한 30년 아파트 단지
"""
import json, os, re, math, datetime, collections, shutil
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zsample import smpTxt, trust, isEst, short, eta_adj, set_dup, noTicket   # /z/ 페이지와 같은 표본 문장·신뢰도 · 입주 시점(가로·소규모 보정 = 화면과 같은 값)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p, d=None: json.load(open(os.path.join(ROOT, p), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, p)) else d
D = J('pipeline/data.enriched.json') or J('src/data.json'); P = J('public/premium.json', {}); C = J('pipeline/calc.json', {})
from stfix import st_fix; from jsnum import walk_min; st_fix(D)   # 가까운 역·노선: 앱 화면·/z와 같은 값(예전엔 고치기 전 자료를 써서 도보 분이 1분씩 어긋난 곳이 있었다)
set_dup(D)
TX = J('public/data/tx.json', {}); TH = J('public/data/toheo.json', {}) or {}; S = J('public/data/sang.json'); NT = J('public/data/notice.json', {}) or {}
RB = J('pipeline/rebuild.json', {}) or {}
OUT = os.path.join(ROOT, 'public/api/v1'); SITE = 'https://jaegaebal.alwaysquestions.kr'
if os.path.isdir(os.path.join(OUT, 'zones')): shutil.rmtree(os.path.join(OUT, 'zones'))
os.makedirs(os.path.join(OUT, 'zones'), exist_ok=True)
W = lambda name, obj: json.dump(obj, open(os.path.join(OUT, name), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
r2 = lambda v: None if v is None else round(v, 3)
LAD = D.get('ladder') or []
# 법정동 이름 전체: 'OO동', 'OO동N가', 'OON가', 'OO로N가', 'OO로'(세종로 등). 지번이 바로 붙은 '수유동392-9'도. '구로동'을 '구로'로 자르지 않는다
DONG_RE = re.compile(r'^(?:서울(?:특별)?시\s*)?(?:[가-힣]+구\s+)?([가-힣]+?(?:\d+(?:·\d+)*)?(?:동\d+가|로\d+가|\d+가|동|로|가))(?=[\s\d(산]|$)')
def dong(r):
    for s in (r.get('j'), r.get('n')):
        m = DONG_RE.match((s or '').strip())
        if m and (s == r.get('j') or not m.group(1).endswith('로')): return m.group(1)
    return r.get('dg') or ''   # 주소·이름에 동이 없으면 경계 안 필지 PNU로 찾은 법정동(enrich.py)
def active(r): return not (r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7)) and r.get('src') != 'moa' and r.get('n')
R = [r for r in D['recs'] if active(r)]
def summary(r):
    c = C.get(r['id']) or {}; t = r.get('tx') or {}; e = eta_adj(r, D.get('asOf')) or {}; st = r.get('st') or {}
    old = t.get('old') if r.get('s', 0) < 7 else None
    th = (TH.get('z') or {}).get(r['id'])
    mkz = r.get('tag') == 'mk' or r.get('nx') == 'mk'
    return {
        'id': r['id'], 'name': short(r['n']), 'fullName': r['n'], 'gu': r['g'], 'dong': dong(r), 'jibun': r.get('j') or None,
        'kind': r.get('k'), 'tag': {'lt': '역세권 장기전세주택', 'mk': '시장·상가 정비'}.get(r.get('tag')), 'stage': {'level': r.get('s'), 'label': c.get('stage') or r.get('sr'), 'raw': r.get('sr'), 'since': r.get('sd')},
        'lat': r['ll'][0] if r.get('ll') else None, 'lng': r['ll'][1] if r.get('ll') else None,
        'station': {'name': st.get('n'), 'walkMin': walk_min(st['d']) if st.get('d') else None, 'lines': r.get('ln') or []} if st else None,
        # 시장·상가 정비(tag mk)는 빌라 시세가 상가 지분 값을 대신하지 못해 사이트처럼 값을 내지 않는다(null)
        'need': ({'gap': {'now': None, 'total': None, 'eligible': False, 'blocked': '시장·상가 정비사업이라 계산 전'}, 'cash': {'now': None, 'total': None, 'eligible': False}} if mkz else {  # 단위: 억원 · 무주택·84㎡·기본 가정(사이트 계산기와 같은 엔진)
            'gap': {'now': r2(c.get('gapNow')), 'total': r2(c.get('gapTotal')), 'eligible': bool(c.get('gapOk')), 'blocked': c.get('gapBlock')},
            # 지금 사면 입주권이 없는 곳(win no): 입주까지 현금은 계산 보류(사이트 /z·앱 상세와 같은 판정) — total null + held 이유
            'cash': {'now': r2(c.get('now')), 'total': None if noTicket(r, c) else r2(c.get('need')), 'eligible': bool(c.get('cashOk')) and not noTicket(r, c), **({'held': '입주권 없음'} if noTicket(r, c) else {})},
        }),
        'price': None if mkz else r2(c.get('price')), 'jeonse': None if mkz else r2(c.get('jeonse')),
        # 매수가 표본이 3건 미만·12개월보다 오래됨·구역 안 거래가 1~2건뿐이라 참고값(사이트 '살 수 있는 곳' 목록에서 뺌)
        'lowConfidence': bool(r.get('lc')),
        # price를 정한 표본(사이트 '계산 매수가 = 구역 안 빌라 N건 가운데 값(기간)'과 같은 묶음) · trades.n12(12개월 모든 거래)와 다른 묶음
        'priceSample': None if mkz or c.get('price') is None else {'n': ((r.get('mk') or {}).get('entry') or {}).get('n'), 'from': ((r.get('mk') or {}).get('entry') or {}).get('f'),
                        'to': ((r.get('mk') or {}).get('entry') or {}).get('t'), 'lastTrade': ((r.get('mk') or {}).get('entry') or {}).get('last'), 'source': 'est' if isEst(r, c) else c.get('priceSrc'),
                        'text': smpTxt(r, c), 'confidence': trust(r, c)[0]},
        'membership': {'status': c.get('win'), 'label': c.get('winT')},   # 입주권: ok 가능 / warn 확인 필요 / chk 판단 보류 / no 없음
        'completion': {'p10': e.get('p10'), 'mid': e.get('eMid'), 'lo': e.get('eLo'), 'hi': e.get('eHi')} if e.get('p10') is not None else None,
        'rightsDate': (r.get('rdx') or {}).get('d'),
        'oldPct': old.get('pol') if old else None,
        # trades.n12 = 12개월 모든 거래(빌라·단독·아파트) · medVilla = 구역 안 구축 빌라 가운데 값(만원 · 구역 안 표본으로 정한 곳은 priceSample과 같은 묶음)
        'trades': {'n3': t.get('n3'), 'n12': t.get('n12'), 'yoy': t.get('yoy'), 'medVilla': t.get('med'), 'perPyeongLand': t.get('pp'), 'newHigh': t.get('hi'),
                   'im': t.get('im'), 'in': t.get('in'), 'iw': t.get('iw')} if t.get('n') else None,   # im: 아파트 입주권 가운데 값(만원)·in 건수·iw 기간(12 또는 24개월)
        'landPermit30d': th['n30'] if th else 0,
        'owners': c.get('owners'),
        'url': f"{SITE}/#{r['id']}", 'page': f"{SITE}/z/{r['id']}",
    }
Z = [summary(r) for r in R]
W('zones.json', {'updated': D.get('upd'), 'count': len(Z), 'items': Z})
# 구역 상세
def dist(a, b, c, d):
    k = math.pi / 180; x = (d - b) * k * math.cos((a + c) / 2 * k); y = (c - a) * k
    return math.sqrt(x * x + y * y) * 6371000
KEYS = [('구역지정', '정비구역 지정'), ('추진위', '추진위원회 승인'), ('조합설립', '조합설립인가'), ('시행자지정', '사업시행자 지정'), ('사업시행', '사업시행인가'), ('관리처분', '관리처분인가'), ('착공', '착공'), ('준공', '준공')]
today = datetime.date.today().isoformat()
for r, z in zip(R, Z):
    pm = P.get(r['id']) or {}; dt = pm.get('dt') or {}; tx = TX.get(r['id']) or {}
    near = []
    if S and r.get('ll'):
        a, b = r['ll']
        n1 = sorted(((dist(a, b, x[1], x[0]), x) for x in S['items']), key=lambda q: q[0])
        near = [{'name': x[2], 'type': {'a': '골목상권', 'd': '발달상권', 'r': '전통시장', 'u': '관광특구'}.get(x[3]), 'm': round(d), 'stores': x[4], 'academies': x[5], 'salesQuarterEok': x[6]} for d, x in n1 if d <= 1000][:5]
    det = dict(z)
    det.update({
        'history': [{'stage': lab, 'date': dt[k]} for k, lab in KEYS if dt.get(k)],
        'events': [{'date': d, 'section': sec, 'text': t} for d, sec, t in (pm.get('ev') or []) if d <= today][:10],
        # 실거래 머리글 기준(화면과 같음): basis i 입주권·a 아파트(전용 3.3㎡당)·v 빌라·단독(대지 3.3㎡당), unit 만원/3.3㎡, window 개월(0=가장 최근 1건)
        'tradeHeadline': ({'basis': h['b'], 'unit': h['u'], 'window': h['w'], 'n': h['n'], 'outliers': h['xo'], 'from': h['from'], 'to': h['to'], 'price': h['p'], 'area': h['pa'], 'quarters': h['q']}
                          if (h := (tx.get('x') or {}).get('hd')) else None),
        'sales': [{'date': x[0], 'type': ['연립다세대', '단독', '아파트', '입주권'][x[1]] if x[1] in (0, 1, 2, 3) else None, 'built': x[2] or None, 'area': x[3], 'land': x[4], 'price': x[5], 'floor': x[6]} for x in (tx.get('s') or [])[:20]],
        'rents': [{'date': x[0], 'built': x[1] or None, 'area': x[2], 'deposit': x[3]} for x in (tx.get('j') or [])[:10]],
        'landPermits': [{'date': d, 'jibun': jb, 'jimok': jm, 'use': u, 'result': res} for d, jb, jm, u, res in (((TH.get('z') or {}).get(r['id']) or {}).get('r') or [])],
        'nearbyCommerce': near,
        'cafe': pm.get('cafe'),
    })
    W(f"zones/{r['id']}.json", det)
# 현금별 가능 구역 수
steps = [x / 2 for x in range(1, 31)]
# 사이트 첫 화면과 같은 기준: eligible(입주권·토지거래허가·추정 제외 등 판정 통과) + 필요한 돈 ≤ 현금
gapN = lambda z, c: not z.get('lowConfidence') and z['need']['gap']['eligible'] and z['need']['gap']['now'] is not None and z['need']['gap']['now'] <= c
cashN = lambda z, c: not z.get('lowConfidence') and z['need']['cash']['eligible'] and z['need']['cash']['now'] is not None and z['need']['cash']['now'] <= c
cashT = lambda z, c: not z.get('lowConfidence') and z['need']['cash']['eligible'] and z['need']['cash']['total'] is not None and z['need']['cash']['total'] <= c
gus = sorted({z['gu'] for z in Z})
W('cash.json', {'updated': D.get('upd'), 'unit': '억원', 'note': '무주택·84㎡·기본 가정. 사이트 화면은 내 조건(보유 주택·소득 등)을 반영해 조금 다를 수 있음',
               'steps': [{'cash': c, 'gapNow': sum(gapN(z, c) for z in Z), 'cashNow': sum(cashN(z, c) for z in Z), 'cashTotal': sum(cashT(z, c) for z in Z),
                          'byGu': {g: [sum(gapN(z, c) for z in Z if z['gu'] == g), sum(cashN(z, c) for z in Z if z['gu'] == g)] for g in gus}} for c in steps]})
# 순위
withT = [z for z in Z if z['trades']]
W('rank.json', {'updated': D.get('upd'),
                'volume3m': [{'id': z['id'], 'name': z['name'], 'gu': z['gu'], 'n3': z['trades']['n3'], 'n12': z['trades']['n12']} for z in sorted([z for z in withT if z['trades']['n3']], key=lambda z: -z['trades']['n3'])[:50]],
                'yoy': [{'id': z['id'], 'name': z['name'], 'gu': z['gu'], 'yoy': z['trades']['yoy']} for z in sorted([z for z in withT if z['trades']['yoy'] is not None], key=lambda z: -z['trades']['yoy'])[:50]],
                'newHigh': [{'id': z['id'], 'name': z['name'], 'gu': z['gu'], 'count': z['trades']['newHigh'][0], 'date': z['trades']['newHigh'][1], 'perPyeongLand': z['trades']['newHigh'][2]} for z in sorted([z for z in withT if z['trades']['newHigh']], key=lambda z: z['trades']['newHigh'][1], reverse=True)[:50]]})
byId = {z['id']: z for z in Z}
CAT = {'ok': '인가·고시', 'chg': '변경 인가', 'con': '시공자 선정', 'req': '신청·공람', 'etc': '기타'}
W('notice.json', {'updated': NT.get('asOf'), 'items': [{'date': d, 'id': i, 'name': byId[i]['name'] if i in byId else None, 'gu': byId[i]['gu'] if i in byId else None, 'section': sec, 'text': t, 'category': c, 'categoryLabel': CAT.get(c)} for d, i, sec, t, c in NT.get('items', [])]})
W('rebuild.json', {'updated': RB.get('asOf'), 'note': '준공 30년 넘은 서울 아파트(최근 실거래 있음). far=용적률(%), hh=세대수, ld=세대당 대지(㎡), m=실거래 가운데 값(만원), z=진행 중 정비구역 id',
                   'items': RB.get('items', [])})
meta = {'name': '집핀 공개 데이터', 'version': 1, 'updated': D.get('upd'), 'tradesUntil': (D.get('txAsOf') or {}).get('sale'), 'site': SITE,
        'license': '원자료: 서울시·국토교통부 공공데이터(공공누리 1유형 등), 서울도시공간포털, 서울시 상권분석서비스, 서울부동산정보광장. 계산값은 추정치이며 투자 권유가 아님',
        'assumptions': {'homes': 0, 'unit': '84㎡', 'growth': '0%', 'ratio': '100%', 'unitPrice': '자동'},
        'endpoints': {k: f"{SITE}/api/v1/{k}" for k in ('meta.json', 'zones.json', 'zones/{id}.json', 'cash.json', 'rank.json', 'notice.json', 'rebuild.json')},
        'extra': {'commerce': f"{SITE}/data/sang.json", 'boundaries': f"{SITE}/data/geo.json"},
        'counts': {'zones': len(Z), 'notice': len(NT.get('items', [])), 'rebuild': len(RB.get('items', []))}}
W('meta.json', meta)
print('api', len(Z), 'zones', sum(1 for _ in os.listdir(os.path.join(OUT, 'zones'))), 'files')
