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
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p, d=None: json.load(open(os.path.join(ROOT, p), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, p)) else d
D = J('pipeline/data.enriched.json') or J('src/data.json'); P = J('public/premium.json', {}); C = J('pipeline/calc.json', {})
TX = J('public/data/tx.json', {}); TH = J('public/data/toheo.json', {}) or {}; S = J('public/data/sang.json'); NT = J('public/data/notice.json', {}) or {}
RB = J('pipeline/rebuild.json', {}) or {}
OUT = os.path.join(ROOT, 'public/api/v1'); SITE = 'https://jaegaebal.alwaysquestions.kr'
if os.path.isdir(os.path.join(OUT, 'zones')): shutil.rmtree(os.path.join(OUT, 'zones'))
os.makedirs(os.path.join(OUT, 'zones'), exist_ok=True)
W = lambda name, obj: json.dump(obj, open(os.path.join(OUT, name), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
r2 = lambda v: None if v is None else round(v, 3)
LAD = D.get('ladder') or []
def short(n):
    n = re.sub(r'^\s*(\(가칭\)|\[임시\]|\(임시\))\s*', '', n)
    return re.sub(r'\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)?\s*(정비)?(사업)?\s*(조합|추진위원회|조합설립추진위원회|주민대표회의)?\s*$', '', n).strip() or n
def dong(r):
    m = re.match(r'([가-힣0-9]+?(?:동\d*가|동|가))\s', (r.get('j') or '') + ' ')
    return m.group(1) if m else ''
def active(r): return not (r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7)) and r.get('src') != 'moa' and r.get('n')
R = [r for r in D['recs'] if active(r)]
def summary(r):
    c = C.get(r['id']) or {}; t = r.get('tx') or {}; e = r.get('eta') or {}; st = r.get('st') or {}
    old = t.get('old') if r.get('s', 0) < 7 else None
    th = (TH.get('z') or {}).get(r['id'])
    return {
        'id': r['id'], 'name': short(r['n']), 'fullName': r['n'], 'gu': r['g'], 'dong': dong(r), 'jibun': r.get('j') or None,
        'kind': r.get('k'), 'stage': {'level': r.get('s'), 'label': c.get('stage') or r.get('sr'), 'raw': r.get('sr'), 'since': r.get('sd')},
        'lat': r['ll'][0] if r.get('ll') else None, 'lng': r['ll'][1] if r.get('ll') else None,
        'station': {'name': st.get('n'), 'walkMin': max(1, round(st['d'] * 1.3 / 67)) if st.get('d') else None, 'lines': r.get('ln') or []} if st else None,
        'need': {  # 단위: 억원 · 무주택·84㎡·기본 가정(사이트 계산기와 같은 엔진)
            'gap': {'now': r2(c.get('gapNow')), 'total': r2(c.get('gapTotal')), 'eligible': bool(c.get('gapOk')), 'blocked': c.get('gapBlock')},
            'cash': {'now': r2(c.get('now')), 'total': r2(c.get('need')), 'eligible': bool(c.get('cashOk'))},
        },
        'price': r2(c.get('price')), 'jeonse': r2(c.get('jeonse')),
        'membership': {'status': c.get('win'), 'label': c.get('winT')},   # 입주권: ok 가능 / warn 확인 필요 / chk 판단 보류 / no 없음
        'completion': {'p10': e.get('p10'), 'mid': e.get('eMid'), 'lo': e.get('eLo'), 'hi': e.get('eHi')} if e.get('p10') is not None else None,
        'rightsDate': (r.get('rdx') or {}).get('d'),
        'oldPct': old.get('pol') if old else None,
        'trades': {'n3': t.get('n3'), 'n12': t.get('n12'), 'yoy': t.get('yoy'), 'medVilla': t.get('med'), 'perPyeongLand': t.get('pp'), 'newHigh': t.get('hi')} if t.get('n') else None,
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
        'sales': [{'date': x[0], 'type': '연립다세대' if x[1] == 0 else '단독', 'built': x[2] or None, 'area': x[3], 'land': x[4], 'price': x[5], 'floor': x[6]} for x in (tx.get('s') or [])[:20]],
        'rents': [{'date': x[0], 'built': x[1] or None, 'area': x[2], 'deposit': x[3]} for x in (tx.get('j') or [])[:10]],
        'landPermits': [{'date': d, 'jibun': jb, 'jimok': jm, 'use': u, 'result': res} for d, jb, jm, u, res in (((TH.get('z') or {}).get(r['id']) or {}).get('r') or [])],
        'nearbyCommerce': near,
        'cafe': pm.get('cafe'),
    })
    W(f"zones/{r['id']}.json", det)
# 현금별 가능 구역 수
steps = [x / 2 for x in range(1, 31)]
# 사이트 첫 화면과 같은 기준: eligible(입주권·토지거래허가·추정 제외 등 판정 통과) + 필요한 돈 ≤ 현금
gapN = lambda z, c: z['need']['gap']['eligible'] and z['need']['gap']['now'] is not None and z['need']['gap']['now'] <= c
cashN = lambda z, c: z['need']['cash']['eligible'] and z['need']['cash']['now'] is not None and z['need']['cash']['now'] <= c
cashT = lambda z, c: z['need']['cash']['eligible'] and z['need']['cash']['total'] is not None and z['need']['cash']['total'] <= c
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
meta = {'name': '얼마면 재개발 공개 데이터', 'version': 1, 'updated': D.get('upd'), 'tradesUntil': (D.get('txAsOf') or {}).get('sale'), 'site': SITE,
        'license': '원자료: 서울시·국토교통부 공공데이터(공공누리 1유형 등), 서울도시공간포털, 서울시 상권분석서비스, 서울부동산정보광장. 계산값은 추정치이며 투자 권유가 아님',
        'assumptions': {'homes': 0, 'unit': '84㎡', 'growth': '0%', 'ratio': '100%', 'unitPrice': '자동'},
        'endpoints': {k: f"{SITE}/api/v1/{k}" for k in ('meta.json', 'zones.json', 'zones/{id}.json', 'cash.json', 'rank.json', 'notice.json', 'rebuild.json')},
        'extra': {'commerce': f"{SITE}/data/sang.json", 'boundaries': f"{SITE}/data/geo.json"},
        'counts': {'zones': len(Z), 'notice': len(NT.get('items', [])), 'rebuild': len(RB.get('items', []))}}
W('meta.json', meta)
print('api', len(Z), 'zones', sum(1 for _ in os.listdir(os.path.join(OUT, 'zones'))), 'files')
