#!/usr/bin/env python3
"""데이터 보강: 좌표(경계로 위치를 찾은 후보지) · 권리산정기준일 · 매수가 빈칸 채우기 · 구역 실거래 요약 병합.
입력: src/data.json(기준), public/data/geo.json, pipeline/txsum.json, pipeline/rights.json
출력: public/data/... 는 건드리지 않고 build 단계용 pipeline/data.enriched.json 을 쓴다(src/data.json 원본 보존).
"""
import json, os, re, math, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
D = J('pipeline/data.base.json') if os.path.exists(os.path.join(ROOT, 'pipeline/data.base.json')) else J('src/data.json')
# 원자료 오타 바로잡기(역 이름 등) — 모든 문자열에 적용
FIX = {'답심리': '답십리'}
_s = json.dumps(D, ensure_ascii=False)
for a, b in FIX.items(): _s = _s.replace(a, b)
D = json.loads(_s)
from junk import is_junk   # 시험 등록(이름이 'test'·'테스트'·'임시'뿐) 제외 — 화면·정적 페이지·API 모두 이 파일을 쓴다
_JUNK = {r['id'] for r in D['recs'] if is_junk(r)}
D['recs'] = [r for r in D['recs'] if r['id'] not in _JUNK]; R = D['recs']
# after-adsense 4: 원자료 이름에 '-'가 '대시'로 적힌 것(o734 '사당동 206대시 1번지 일원') → 지번 '206-1'
import re as _re_n
for _r in R:
    if isinstance(_r.get('n'), str) and '대시' in _r['n']: _r['n'] = _re_n.sub(r'(\d)\s*대시\s*(\d)', r'\1-\2', _r['n'])
# 같은 곳이 두 자료에 따로 실린 것(짧은 이름 + 지번이 같음: 행당동 300-1 s41/s42 · 문래국화 o288/o289) → 더 많이 아는 쪽 하나만.
# 버린 id는 D['alias'](버린 id → 남긴 id)로 남겨 옛 링크·핀·/z 페이지가 남긴 구역으로 간다(zpages.py가 옮김 페이지를 만든다).
from zsample import short0 as _short0
_PM0 = J('pipeline/premium.base.json') if os.path.exists(os.path.join(ROOT, 'pipeline/premium.base.json')) else J('src/premium.json')
_GZ = J('public/data/geo.json').get('z', {})
_PC0 = J('pipeline/cache/parcels.json') if os.path.exists(os.path.join(ROOT, 'pipeline/cache/parcels.json')) else {}
def _rich(r):   # 경계·인가일·실거래·필지 목록·단계·항목 수 순으로 '더 많이 아는 쪽'
    i = r['id']; pm = _PM0.get(i) or {}
    return (3 if i in _GZ else 0) + (2 if pm.get('dt') or r.get('sd') else 0) + (2 if (_PC0.get(i) or {}).get('p') else 0) + (1 if r.get('tx') else 0) + 0.5 * (r.get('s') or 0) + 0.05 * len(r)
_dg = collections.defaultdict(list)
for r in R:
    j = re.sub(r'\s+', '', str(r.get('j') or ''))
    if j and r.get('n') and r.get('src') != 'moa': _dg[(_short0(r['n']).replace(' ', ''), j)].append(r)
ALIAS = {}
for _k, _xs in _dg.items():
    if len(_xs) < 2: continue
    _xs.sort(key=_rich, reverse=True); keep = _xs[0]
    for x in _xs[1:]:
        ALIAS[x['id']] = keep['id']
        for f, v in x.items():   # 남긴 쪽에 없는 항목만 채운다(단계·이름은 남긴 쪽 그대로)
            if f not in keep and f not in ('id', 'pcl'): keep[f] = v
        pk, px = _PM0.get(keep['id']), _PM0.get(x['id'])
        if px:
            if pk is None: _PM0[keep['id']] = pk = {}
            for f, v in px.items(): pk.setdefault(f, v)
            _PM0.pop(x['id'], None)
        if not (_PC0.get(keep['id']) or {}).get('p') and (_PC0.get(x['id']) or {}).get('p'):   # 필지 목록(매물 지번 확인)은 버린 쪽 것을 남긴 id로
            _PC0[keep['id']] = _PC0[x['id']]
            _pf = os.path.join(ROOT, 'public/data/pcl')
            if os.path.exists(os.path.join(_pf, x['id'] + '.json')):
                import shutil as _sh; _sh.copyfile(os.path.join(_pf, x['id'] + '.json'), os.path.join(_pf, keep['id'] + '.json'))
if ALIAS:
    D['recs'] = [r for r in D['recs'] if r['id'] not in ALIAS]; R = D['recs']
    D['alias'] = ALIAS
    print('dedupe alias', ALIAS)
GEO = J('public/data/geo.json')['z']
TX = J('pipeline/txsum.json')
PARC = _PC0   # (위에서 읽고 같은 곳 합치기를 반영한 것)
RT = J('pipeline/rights.json') if os.path.exists(os.path.join(ROOT, 'pipeline/rights.json')) else {}
stat = collections.Counter()
NEAR = (J('pipeline/near.json') or {}).get('z', {}) if os.path.exists(os.path.join(ROOT, 'pipeline/near.json')) else {}   # tools/near.py
SALES_OK = True
act = lambda r: not (r['s'] >= 9 or (r.get('dn') and r['s'] < 7))

# ---------- 0. 정보몽땅 최신 추진경과 반영(단계·인가일·최근 기록) ----------
PREM = _PM0   # (위에서 읽고 같은 곳 합치기를 반영한 것)
CL = J('pipeline/cache/cleanup.json') if os.path.exists(os.path.join(ROOT, 'pipeline/cache/cleanup.json')) else {}
SR2S = {'정비계획 수립': 1, '안전진단': 1, '정비구역지정': 2, '추진위원회승인': 3, '조합설립인가': 4, '사업시행자 지정': 4, '사업시행인가': 5, '관리처분인가': 6, '철거': 7, '이주': 7, '착공': 8, '분양': 8,
        '준공인가': 9, '부분준공인가': 9, '이전고시': 9, '조합해산': 9, '조합청산': 9}
stage_changes = []
for r in R:
    pm = PREM.get(r['id'])
    cafe = pm and pm.get('cafe')
    c = CL.get(cafe) if cafe else None
    if not c: continue
    if c.get('dt'):
        dt = pm.setdefault('dt', {})
        for k, v in c['dt'].items():
            if k == '해산': continue
            if k not in dt: dt[k] = v; stat['dt_add'] += 1   # 기존 날짜(리포트 대조로 검증된 값)는 바꾸지 않고 빈 단계만 채운다
    if c.get('ev'): pm['ev'] = [[e[0], e[1], re.sub(r'(\d),(\d{1,2})\s*%', r'\1.\2%', e[2])] if len(e) >= 3 and isinstance(e[2], str) else e for e in c['ev'][:6]]   # '동의율 86,36%' 쉼표 소수점
    row = c.get('row') or {}
    ns = SR2S.get(row.get('sr'))
    KEYS = {2: '구역지정', 3: '추진위', 4: '조합설립', 5: '사업시행', 6: '관리처분', 8: '착공', 9: '준공'}
    ok_ev = ns is not None and (ns - r['s'] == 1 or (KEYS.get(ns) and (c.get('dt') or {}).get(KEYS[ns])))
    if ns is not None and ns > r['s'] and not ok_ev: r['sPend'] = row['sr']; stat['stage_pending'] += 1
    if ok_ev and '(' not in r['sr'] and not r.get('chk') and ns > r['s']:
        stage_changes.append([r['id'], r['sr'], row['sr']]); r['sr'] = row['sr']; r['s'] = ns; r['sUp'] = 1; r['eta'] = {'na': '단계 갱신 반영 중'}   # 예전 단계 기준 준공 확률은 버린다(다음 월간 재계산 때 채움)
        stat['stage_up'] += 1
# 수동 보정(tools/overrides.json): 정보몽땅 단계가 늦은 곳(준공했는데 착공으로 남은 곳 등). 실거래로 확인한 것만 넣는다
_OVP = os.path.join(ROOT, 'tools/overrides.json')
OVR = {k: v for k, v in (json.load(open(_OVP, encoding='utf-8')) if os.path.exists(_OVP) else {}).items() if not k.startswith('_')}
for r in R:
    o = OVR.get(r['id'])
    if not o: continue
    for k, v in o.items():
        if k == 'dt': PREM.setdefault(r['id'], {}).setdefault('dt', {}).update(v)  # 단계 날짜 보정(정보몽땅에 빠진 착공일 등)
        elif k != 'why': r[k] = v
    r['ovr'] = 1; r.pop('sPend', None); r.pop('sUp', None); stat['override'] += 1
    if r.get('s', 0) >= 9: r['eta'] = {'na': '준공'}
# 날짜 정리: 오늘 뒤 날짜(원자료 오기, 예: 2033년)는 버리고, 단계 순서가 거꾸로 된 날짜(준공이 착공보다 앞섬 등)는 뒤 단계 쪽을 버린다
import datetime as _d0
_today = (_d0.datetime.now(_d0.timezone.utc) + _d0.timedelta(hours=9)).date().isoformat()   # 서울 날짜
ORDER = ['구역지정', '추진위', '조합설립', '시행자지정', '사업시행', '관리처분', '착공', '준공']
for pid, pm in PREM.items():
    if not isinstance(pm, dict): continue
    if pm.get('ev'):
        n0 = len(pm['ev']); pm['ev'] = [e for e in pm['ev'] if e and e[0] <= _today]; stat['ev_future_drop'] += n0 - len(pm['ev'])
    dt = pm.get('dt')
    if not isinstance(dt, dict): continue
    for k in [k for k, v in dt.items() if isinstance(v, str) and v[:10] > _today]: dt.pop(k); stat['dt_future_drop'] += 1
    last = ''
    for k in ORDER:
        v = dt.get(k)
        if not isinstance(v, str): continue
        if last and v[:10] < last and k in ('착공', '준공', '관리처분', '사업시행'): dt.pop(k); stat['dt_order_drop'] += 1; continue
        if k != '시행자지정': last = max(last, v[:10])
for _k in _JUNK: PREM.pop(_k, None)   # 뺀 시험 레코드
json.dump(PREM, open(os.path.join(ROOT, 'public/premium.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
if stage_changes: print('단계 변경', stage_changes[:20])

T = TX['tx']; DONG = TX['dong']; APT = TX['apt']; DC = TX['dcode']
GU5 = {}
for k, c in DC.items(): GU5[k.split('|')[0]] = c[:5]
JRE = re.compile(r'([가-힣]+\d+가|[가-힣]+?\d*(?:동|로|가))\s*(산\s*)?(\d+)(?:-(\d+))?')   # '금호동2가 421-1'처럼 N가를 먼저(tools/tx.py와 같은 규칙)
_D2C = collections.defaultdict(set)
for k, c in DC.items(): _D2C[k.split('|')[1]].add(c)
def parse_j(r):
    j = re.sub(r'^\s*(서울(특별)?시\s*)?([가-힣]+구\s+)?', '', (r.get('bj') or r.get('j') or ''))
    m = JRE.match(j)
    if not m: return None, None
    dong = m.group(1)
    code = DC.get(f"{r['g']}|{dong}")
    if not code:   # '신당동' 대신 '신당2동' 같은 행정동 표기
        code = DC.get(f"{r['g']}|{re.sub(r'\d+동$', '동', dong)}")
    if not code:   # 자치구 오기: 그 법정동 이름이 서울에 하나뿐이면 그 코드
        cs = _D2C.get(dong) or _D2C.get(re.sub(r'\d+동$', '동', dong)) or ()
        code = next(iter(cs)) if len(cs) == 1 else None
    if not code: return None, None
    pnu = f"{code}{'2' if m.group(2) else '1'}{int(m.group(3)):04d}{int(m.group(4) or 0):04d}"
    return code, pnu
# ---------- 1a. 좌표가 없는 구역: 대표지번(또는 단지 이름으로 찾은 단지 지번, tools/tx.py cx) 필지의 중심 ----------
#   서울도시공간포털 연속지적(layer 1)을 PNU로 조회. 캐시 pipeline/cache/pnu_ll.json {PNU: [lat, lng] | null}
import subprocess, urllib.parse
_PLP = os.path.join(ROOT, 'pipeline/cache/pnu_ll.json')
PLL = json.load(open(_PLP)) if os.path.exists(_PLP) else {}
_UPIS = "https://urban.seoul.go.kr/proxy/proxy.jsp?http://98.33.2.225:6080/arcgis/rest/services/UPIS/20200526_WFS/MapServer/1/query?"
def pnu_ll(p):
    if p in PLL: return PLL[p]
    if os.environ.get('NO_NET'): return None
    q = urllib.parse.urlencode({'f': 'json', 'where': f"PNU='{p}'", 'outFields': 'PNU', 'returnGeometry': 'true', 'outSR': '4326', 'maxAllowableOffset': '0.0001'})
    try:
        o = subprocess.run(['curl', '-sS', '--max-time', '40', _UPIS + q], capture_output=True, text=True, timeout=50).stdout
        fs = json.loads(o).get('features') or []
    except Exception: return None   # 네트워크 실패는 캐시하지 않는다(다음 실행 때 다시)
    v = None
    if fs:
        from shapely.geometry import Polygon
        g = Polygon(fs[0]['geometry']['rings'][0]).buffer(0); c = g.centroid if g.contains(g.centroid) else g.representative_point()
        v = [round(c.y, 6), round(c.x, 6)]
    PLL[p] = v; return v
for r in R:
    if r.get('ll'): continue
    z = GEO.get(r['id'])
    if z and not z.get('e'): continue   # 경계가 있으면 아래 1에서 경계 중심으로
    t = T.get(r['id']) or {}
    ps = (t.get('cx') or {}).get('p') or [x for x in [parse_j(r)[1]] if x]
    for p in ps:
        v = pnu_ll(p)
        if v: r['ll'] = v; r['llFix'] = 'name' if t.get('cx') else 'jibun'; stat['ll_from_pnu'] += 1; break
json.dump(PLL, open(_PLP, 'w'), separators=(',', ':'))
# ---------- 1. 좌표: ll → 지도 SVG xy 변환식 (기존 레코드로 최소제곱) ----------
pairs = [(r['ll'], r['xy']) for r in R if r.get('ll') and r.get('xy')]
def fit(ix):
    # xy[ix] = a*lng + b*lat + c
    n = len(pairs); sx = sy = sz = sxx = syy = sxy = sxz = syz = 0
    for (lat, lng), xy in pairs:
        z = xy[ix]; sx += lng; sy += lat; sz += z; sxx += lng*lng; syy += lat*lat; sxy += lng*lat; sxz += lng*z; syz += lat*z
    import numpy as np
    A = np.array([[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]]); b = np.array([sxz, syz, sz])
    return np.linalg.solve(A, b)
FX, FY = fit(0), fit(1)
toXY = lambda lat, lng: [round(FX[0]*lng + FX[1]*lat + FX[2], 1), round(FY[0]*lng + FY[1]*lat + FY[2], 1)]
def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2 - lo1)/2)**2
    return 2*6371000*math.asin(math.sqrt(h))
# 역 목록 정리(src/app.js ST_FIX·LN_FIX·NEW_ST와 같은 규칙을 데이터에도): 이름·노선 표기 통일, 같은 역 중복은 노선을 합쳐 하나로,
#   빠진 역(신림선 보라매공원·보라매병원 등) 추가, 틀린 좌표·노선 바로잡기
ST_FIX = {'당고개역': '불암산역', '구회의사당역': '국회의사당역', '영등포 구청역': '영등포구청역', '잠실시내역': '잠실새내역', '시가정역': '사가정역'}
LN_FIX = {'경의중앙': '경의중앙선', '김포 골드라인': '김포골드라인', '신림역': '신림선'}
NEW_ST = [['천왕역', 37.486637, 126.838713, ['7호선']], ['온수역', 37.492262, 126.823555, ['1호선', '7호선']], ['오류동역', 37.494526, 126.845365, ['1호선']],
          ['개봉역', 37.494594, 126.85968, ['1호선']], ['사당역', 37.476746, 126.981597, ['2호선', '4호선']], ['영등포역', 37.515504, 126.907628, ['1호선']],
          ['여의나루역', 37.527098, 126.932901, ['5호선']], ['마포역', 37.539574, 126.945932, ['5호선']], ['가좌역', 37.568491, 126.915487, ['경의중앙선']],
          ['서강대역', 37.551881, 126.935711, ['경의중앙선']], ['압구정로데오역', 37.527381, 127.040534, ['수인분당선']], ['남태령역', 37.463873, 126.989134, ['4호선']],
          ['중앙보훈병원역', 37.529191, 127.148739, ['9호선']], ['보라매공원역', 37.495569, 126.918083, ['신림선']], ['보라매병원역', 37.49296, 126.923496, ['신림선']]]
ST_POS = {'당곡역': (37.4903, 126.927513)}          # 원자료가 신림역 좌표를 그대로 써 둔 역
ST_LN = {'대방역': ['1호선', '신림선'], '장한평역': ['5호선']}   # 빠진 노선 · 잘못 붙은 노선(장한평 7호선)
_st = {}
for s0 in D['stations']:
    n = ST_FIX.get(s0[0]) or re.sub(r'(\S) (구청역|시청역)$', r'\1\2', s0[0])
    ls = [LN_FIX.get(l, l) for l in s0[3]]
    if n in _st: _st[n][3] = list(dict.fromkeys(_st[n][3] + ls)); stat['station_dup_merged'] += 1
    else: _st[n] = [n, s0[1], s0[2], list(dict.fromkeys(ls)), s0[4], s0[5]]
for n, la, lo, ls in NEW_ST:
    if n not in _st: _st[n] = [n, la, lo, ls, *toXY(la, lo)]; stat['station_add'] += 1
for n, (la, lo) in ST_POS.items():
    if n in _st: _st[n][1:3] = [la, lo]; _st[n][4:6] = toXY(la, lo)
for n, ls in ST_LN.items():
    if n in _st: _st[n][3] = ls
D['stations'] = ST = list(_st.values())   # [이름, lat, lng, [노선], x, y]
HB = {'광화문·시청(CBD)': (37.5714, 126.9768), '강남역(GBD)': (37.4979, 127.0276), '여의도(YBD)': (37.5216, 126.9243)}
withH = [r for r in R if r.get('ll') and r.get('h') is not None]
from shapely.geometry import Polygon as _Poly
def _bnd_pt(z):   # 공식 경계의 중심(경계 밖으로 나가면 경계 안 대표점) — 대표지번 좌표는 구역 한쪽 끝일 수 있다
    try:
        g = _Poly(z['g'][0], z['g'][1:]).buffer(0); c = g.centroid
        if not g.contains(c): c = g.representative_point()
        return c.y, c.x
    except Exception: return None
for r in R:
    z = GEO.get(r['id'])
    bp = _bnd_pt(z) if z and not z.get('e') and z.get('g') else None
    if not r.get('ll'):
        if bp: lng0, lat0 = z['l']; r['ll'] = [lat0, lng0]; r['llFix'] = 'bnd'; stat['ll_from_boundary'] += 1   # 지도 표시점은 경계 레이어의 라벨 위치
        else: continue
    if not r.get('xy'):
        r['xy'] = toXY(*r['ll'])
        r['hb'] = {k: round(hav(r['ll'], v)) for k, v in HB.items()}
        r['h'] = min(withH, key=lambda q: hav(r['ll'], q['ll']))['h']
    # 가까운 역: 공식 경계가 있으면 경계 중심에서, 없으면 대표 좌표에서(모든 구역 같은 규칙)
    lat, lng = bp or r['ll']
    ds = sorted(((hav((lat, lng), (s[1], s[2])), s) for s in ST), key=lambda t: t[0])
    before = (r.get('st') or {}).get('n')
    r['st'] = {'n': ds[0][1][0], 'd': round(ds[0][0])}
    r['s3'] = [[s[0], round(d), s[3]] for d, s in ds[:3]]
    r['ln'] = sorted({l for d, s in ds if d <= 1000 for l in s[3]})
    if before and ST_FIX.get(before, before) != r['st']['n']: stat['station_changed'] += 1
    elif not before: stat['station_new'] += 1

# ---------- 1b. 자치구 오기 바로잡기: 이름·주소의 법정동이 다른 구에만 있으면 그 구로 ----------
_DC0 = J('pipeline/txsum.json')['dcode']
_D2G = collections.defaultdict(set)
for k in _DC0: g, dn = k.split('|'); _D2G[dn].add(g)
for r in R:
    m = re.match(r'\s*([가-힣]+?)(\d+(?:가)?)?(동)?\s*\d', (r.get('j') or r['n']))
    if not m: continue
    dn = m.group(1) + (m.group(2) or '') + '동' if not m.group(1).endswith('동') else m.group(1)
    gs = _D2G.get(dn) or _D2G.get(re.sub(r'\d+동$', '동', dn))
    if gs and r['g'] not in gs and len(gs) == 1:
        print('  구 바로잡기', r['id'], r['n'], r['g'], '→', next(iter(gs))); r['gFix'] = r['g']; r['g'] = next(iter(gs)); stat['gu_fix'] += 1
# 도심 업무지구 후보지는 도시정비형(업무·상업 중심)
for r in R:
    if r.get('src') == 'sintong' and re.search(r'지구|을지로|공평|무교|소공|관수|남대문로|서소문|충무로|태평로|세운|수표|입정', r['n']): r['nx'] = 'biz'

SDK = {2: '구역지정', 3: '추진위', 4: '조합설립', 5: '사업시행', 6: '관리처분', 8: '착공', 9: '준공'}
for r in R:
    if PARC.get(r['id'], {}).get('p'): r['pcl'] = 1
    dt = (PREM.get(r['id']) or {}).get('dt') or {}
    d = dt.get(SDK.get(r['s'], '')) or (r['s'] == 4 and (dt.get('조합설립') or dt.get('시행자지정')))
    if d: r['sd'] = d   # 현재 단계 날짜(상세 자료를 불러오기 전에도 '오래 멈춤' 판정이 같도록)

# ---------- 2. 권리산정기준일 ----------
for r in R:
    x = RT.get(r['id'])
    if x: r['rdx'] = x; stat['rights'] += 1
    # 공공재개발: 후보지 공모 공고일이 권리산정기준일(1차 2020.9.21, 2차 2021.12.30). 법 원칙 추정값보다 우선
    pub = re.search(r'공공재개발|\s공공$|공공\s*재개발|공공\)', r['n']) and not re.search(r'공공임대|장기전세', r['n'])
    if pub and r['k'] in ('재개발', '도시정비형 재개발') and (not x or x.get('c') != 'high'):
        r['rdx'] = {'d': '2020-09-21', 'b': '공공재개발 1차 후보지 공모 공고일(2차 후보지라면 2021.12.30)', 'u': 'https://www.newsis.com/view/NISX20210329_0001387661', 'c': 'mid'}; stat['rights_pub'] += 1
    # 구역지정일이 변경 지정일이면(조합설립 등 뒤 단계 날짜가 더 이름) 그 날짜로 기준일을 추정하지 않는다 → '확인 필요'
    #  추진위만 더 이른 건 변경으로 보지 않는다(2009년 전엔 구역지정 전 추진위 승인이 가능했다)
    rx = r.get('rdx'); dt = (PREM.get(r['id']) or {}).get('dt') or {}; dz = dt.get('구역지정')
    if dz and (not rx or (rx.get('c') != 'high' and str(rx.get('b', '')).startswith('정비구역 지정 고시일'))):
        ear = [(k, dt[k]) for k in ('조합설립', '시행자지정', '사업시행', '관리처분', '착공') if dt.get(k) and dt[k] < dz]
        if ear:
            k0, d0 = min(ear, key=lambda t: t[1])
            r['rdx'] = {'b': f'등록된 구역지정일({dz.replace("-", ".")})이 {k0}({d0[:7].replace("-", ".")})보다 늦어 변경 지정일로 보여요. 최초 지정 고시일이나 따로 고시된 기준일을 구청에 확인하세요.',
                        'u': 'https://www.law.go.kr/법령/도시및주거환경정비법/제77조', 'c': 'chg', 'zchg': dz}; stat['rights_chg'] += 1

# ---------- 3. 구역 실거래 요약 병합 + 매수가 ----------
T = TX['tx']; DONG = TX['dong']; APT = TX['apt']; DC = TX['dcode']
# ---------- 특수 사업 표시: 역세권 장기전세주택(lt) · 시장·상가 정비(mk) — 매수가 계산 전에 정한다 ----------
# ---------- 2c. 같은 사업이 두 번 등록된 곳: 상위(묶음) 이름 하나와 '(A구역)'·'(B구역)'처럼 그 이름 + 괄호 하위 구역이 따로 있으면
#   상위 기록은 하위 구역과 같은 대표지번·같은 매수가를 그대로 써서 목록·갭 순위에 같은 이름이 두 번 나온다(예: 응암3동 재개발 연계형 o99 ↔ A구역 o98).
#   상위 기록을 dn(진행 목록·순위 제외)으로 두고 dupOf에 하위 구역 id를 적는다. 하위 구역이 대표지번까지 같을 때만.
_sq = lambda n: re.sub(r'\s+', '', n)
_byg = collections.defaultdict(list)
for r in R:
    if act(r) and r.get('src') != 'moa': _byg[r['g']].append(r)
for L in _byg.values():
    for a in L:
        kids = [b['id'] for b in L if b is not a and _sq(b['n']).startswith(_sq(a['n'])) and re.fullmatch(r'\([^)]*구역\)', _sq(b['n'])[len(_sq(a['n'])):])]
        if kids and any((b.get('j') == a.get('j')) for b in L if b['id'] in kids):
            a['dn'] = 1; a['dupOf'] = kids; stat['dup_umbrella'] += 1
for r in R:
    r.pop('tag', None)
    if '장기전세' in r['n']: r['tag'] = 'lt'; stat['tag_lt'] += 1
    elif re.search(r'시장|상가', r['n']): r['tag'] = 'mk'; stat['tag_mk'] += 1
# 매수가(mk.entry) 신뢰도 표시: r['lc'] = 1 · mk.entry.lc = 1 → 표본이 적거나 구역 거래 구성과 다른 매물로 계산한 값.
#   화면 '살 수 있는 곳' 순위에서 빼는 용도(구역 상세에는 값과 함께 '참고' 표시). 조건: 구역 안 빌라 3~4건으로 정한 값 ·
#   아파트 위주 구역(머리글 기준 아파트 또는 아파트 매매 ≥ 빌라·단독 3배)인데 구역 안 아파트 매매가 3건 미만이라 빌라로 계산한 값.
# 시장·상가 정비(tag 'mk')는 빌라 시세가 상가 지분 값을 대신하지 못해 매수가를 내지 않는다(계산 전).
_TXD = json.load(open(os.path.join(ROOT, 'public/data/tx.json'), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, 'public/data/tx.json')) else {}
def _entry_span(rid, t):
    """tx.py 매수가 표본(t.no건 · 가운데 값 t.med)을 public/data/tx.json 거래 목록에서 다시 찾아 (첫 계약일, 끝 계약일 'YY.MM', 대지 3.3㎡당 가운데 값(만원)|None, 대지 면적 있는 건수)를 돌려준다.
    tx.py와 같은 기준(빌라·2015년 이전 준공·전용 20~85㎡, 6건 이상이면 ㎡당 가격 사분위 1.5배 밖 제외) · 건수와 가운데 값이 모두 맞을 때만."""
    import statistics as st
    rows = (_TXD.get(rid) or {}).get('s') or []
    base = sorted([x for x in rows if x[1] == 0 and x[2] and x[2] <= 2015 and 20 <= x[3] <= 85], key=lambda x: x[0], reverse=True)
    for k in range(t.get('no', 0), len(base) + 1):
        old = base[:k]
        if len(old) >= 6:
            u = sorted(x[5] / x[3] for x in old); q = st.quantiles(u, n=4); lo, hi = q[0] - 1.5 * (q[2] - q[0]), q[2] + 1.5 * (q[2] - q[0])
            old = [x for x in old if lo <= x[5] / x[3] <= hi]
        if old and len(old) == t.get('no') and abs(st.median([x[5] for x in old]) - t['med']) < 1:
            f = lambda d: d[2:4] + '.' + d[4:6]
            # 같은 표본의 대지 3.3㎡당 가운데 값(대지 면적 있는 거래만, 절반 이상일 때) — 화면 큰 숫자·/z/ 큰 숫자가 이 값 하나를 쓴다(ZF.headline · zsample.headline)
            L = [x for x in old if x[4] and x[4] > 0]
            u = int(st.median([x[5] / x[4] * 3.3058 for x in L]) + 0.5) if len(L) >= max(1, -(-len(old) // 2)) else None
            return f(min(x[0] for x in old)), f(max(x[0] for x in old)), u, len(L)
    return None
# 사이클 3(리드 결정 10.28): 구역 안 아파트 단지가 관리처분 대상인지 확인되기 전까지는 (a0)(구역 안 아파트 매매)를 쓰지 않고 구역 안 빌라 표본으로 —
#   표본이 적어 lc(참고값) · lcw 'few' · tag '표본 적음'. 확인되면 여기서 빼면 예전 규칙으로 돌아간다.
NO_A0 = {'o189': '구역 안 아파트(1992년 준공 단지 · 전용 84.9㎡)가 관리처분 대상인지 확인 전이라 빌라 표본 기준'}
def apt_dom(t):
    return bool(t) and ((t.get('hd') or {}).get('b') == 'a' or (t.get('na', 0) >= 3 and t.get('na', 0) >= 3 * t.get('nv', 0)))
for r in R:
    r.pop('lc', None)
    t = T.get(r['id'])
    if r.get('tag') == 'mk' and act(r) and r.get('src') != 'moa':
        if t: r['tx'] = {k: v for k, v in t.items() if v not in (None, [], {}) and k not in ('q', 'qa', 'qi', 'age', 'agn', 'pc')}
        if (r.get('mk') or {}).pop('entry', None): stat['entry_drop_mk'] += 1
        r['nx'] = 'mk'; continue
    if t:
        r['tx'] = {k: v for k, v in t.items() if v not in (None, [], {}) and k not in ('q', 'qa', 'qi', 'age', 'agn', 'pc')}   # 상세는 data/tx.json에서 지연 로딩
    if not act(r): continue
    # 사이클 3: 모아타운 관리지역도 구역 안 빌라 표본(아래 (a))을 반경 추정보다 먼저 — '주변 300m 32건'과 '구역 안 21건'이 한 화면에 함께 나오던 것(관리지역 참고값)
    moa = r.get('src') == 'moa'
    mk = r.setdefault('mk', {}); en = mk.get('entry')
    villa_kind = r['k'] not in ('재건축', '소규모재건축') or moa
    if moa and not (t and (t.get('no', 0) >= 5 or (t.get('no', 0) >= 3 and en and en.get('med') and t.get('med') and abs(en['med'] / t['med'] - 1) > 0.25))): continue
    # (0) 예전 반경 추정값 점검: 범위가 터무니없거나(p75/p25 3배 초과) 원룸 기준(전용 20㎡ 미만), 신축 단지(2005년 이후 준공)·먼 이름 매칭이면 버리고 다시 채운다
    if en and ((en.get('p25') and en.get('p75') and en['p75'] / max(en['p25'], 1) > 3) or (en.get('area_med') or 99) < 20
               or (en.get('src') == 'complex' and (en.get('yr') or 0) >= 2005) or (en.get('match') == 'name' and (en.get('radius') or 0) > 50)):
        mk.pop('entry', None); en = None; stat['entry_drop_bad'] += 1
    # (a0) 아파트 위주 구역(재개발 안 기존 아파트 단지 등): 구역 경계 안 아파트 매매로
    if t and villa_kind and not moa and apt_dom(t) and t.get('ae') and r['id'] not in NO_A0:
        a = t['ae']
        mk['entry'] = {'src': 'complex', 'scope': '구역 경계 안 아파트', 'n': a['n'], 'p25': a['p25'], 'med': a['med'], 'p75': a['p75'], 'radius': 0, 'area_med': a['area_med'],
                       'name': '구역 안 아파트', 'yr': a['yr'], 'last': a['last'][2:4] + '.' + a['last'][4:6] + '.' + a['last'][6:8], 'match': 'zone', 'by_area': {}, 'fill': 'zoneapt',
                       **({'prev': {k: en[k] for k in ('n', 'med', 'radius', 'src') if k in en}} if en else {})}
        stat['entry_zone_apt'] += 1
        continue
    # (a) 구역 안 실거래가 충분하면 반경 추정보다 우선. 3~4건이라도 반경 추정과 25% 넘게 다르면 구역 안 값을 쓴다
    if t and villa_kind and (t.get('no', 0) >= 5 or (t.get('no', 0) >= 3 and en and en.get('med') and t.get('med') and abs(en['med'] / t['med'] - 1) > 0.25)):
        lv = t.get('lv') or t['last']   # 빌라·단독 최근 거래일(아파트 거래가 섞인 last 대신)
        mk['entry'] = {'src': 'villa', 'scope': '대표지번과 같은 본번 2015년 이전 준공 빌라' if t.get('m') == 'jibun' else '구역 경계 안 2015년 이전 준공 빌라', 'n': t['no'], 'med': t['med'], 'p25': t.get('p25') or t['med'], 'p75': t.get('p75') or t['med'],
                       'radius': 0, 'area_med': t['ar'], 'last': lv[2:4] + '.' + lv[4:6] + '.' + lv[6:8], 'fill': 'zone', **({'m': 'jibun'} if t.get('m') == 'jibun' else {}),
                       **({'prev': {k: en[k] for k in ('n', 'med', 'radius') if k in en}} if en else {})}
        stat['entry_zone' if en else 'entry_zone_new'] += 1
        fr = _entry_span(r['id'], t)   # 매수가 표본 기간(첫·끝 계약일) — 화면·/z/·API가 같은 표본을 '○건 가운데 값(기간)'으로 말한다
        if fr:
            mk['entry']['f'], mk['entry']['t'] = fr[0], fr[1]
            if fr[2]: mk['entry']['u'], mk['entry']['nl'] = fr[2], fr[3]
        if t['no'] < 5 or apt_dom(t): mk['entry']['lc'] = 1; r['lc'] = 1; stat['entry_lc'] += 1
        if r['id'] in NO_A0: mk['entry'].update({'lc': 1, 'lcw': 'few', 'tag': '표본 적음', 'why': NO_A0[r['id']]}); r['lc'] = 1; stat['entry_no_a0'] += 1
        continue
    if moa: continue   # 모아타운은 구역 안 표본만 바꾼다(아래 반경 보충·아파트 판정은 사업구역에서)
    # (b) 주변 빌라 표본(반경 300·500·800m): tools/near.py가 원자료에서 다시 뽑은 값으로(거래 하나하나가 public/data/near.json에 남아 거래 탭에서 확인 가능)
    #     예전 기준 자료의 반경 값은 어떤 거래였는지 남아 있지 않았다. 다시 뽑은 표본이 3건 미만이면 예전 값을 그대로 둔다
    if en and en.get('src') == 'villa' and (en.get('radius') or 0) >= 100 and (NEAR.get(r['id']) or {}).get('n', 0) >= 3:
        nz = NEAR[r['id']]
        for k in ('f', 't', 'u', 'nl', 'lc', 'lcw', 'nbp'): en.pop(k, None)
        en.update({k: nz[k] for k in ('n', 'p25', 'med', 'p75', 'area_med', 'last', 'f', 't', 'w', 'radius', 'yr_cap', 'u', 'nl') if k in nz})
        en['scope'] = f"구역 경계에서 {nz['radius']}m 안 {nz['yr_cap']}년 이전 준공 빌라(전용 30~70㎡) 최근 {nz['w']}개월"
        stat['entry_near'] += 1
    if en and en.get('src') == 'villa' and t and villa_kind and apt_dom(t):   # 아파트 위주 구역인데 주변 빌라 값으로 계산
        en['lc'] = 1; r['lc'] = 1; stat['entry_lc'] += 1
    if en: continue
    code, pnu = parse_j(r)
    if not code and PARC.get(r['id'], {}).get('p'):   # 주소가 없으면 경계 안 필지의 법정동
        code = collections.Counter(p[0][:10] for p in PARC[r['id']]['p']).most_common(1)[0][0]
    if r['k'] in ('재건축', '소규모재건축'):
        a = APT.get(pnu) if pnu else None
        if not a and (t or {}).get('cx'):   # 주소·경계 없는 후보지: tools/tx.py가 단지 이름으로 찾은 지번
            c = [APT[p] for p in t['cx']['p'] if p in APT]
            a = max(c, key=lambda v: v['n']) if c else None
        if not a and pnu:   # 같은 본번의 다른 부번(단지 대표 지번이 다를 때)
            c = [v for k, v in APT.items() if k[:15] == pnu[:15]]
            a = max(c, key=lambda v: v['n']) if c else None
        if not a and PARC.get(r['id'], {}).get('p'):   # 경계 안 필지 중 아파트 거래가 있는 지번
            c = [APT[p[0]] for p in PARC[r['id']]['p'] if p[0] in APT]
            a = max(c, key=lambda v: v['n']) if c else None
        if a and (a.get('yr') or 0) >= 2005: a = None; stat['apt_new_reject'] += 1   # 재건축 대상이 아닌 신축 단지
        if not a and code:   # 같은 법정동에서 단지 이름이 겹치는 곳
            core = re.sub(r'(아파트|주택|재건축|정비|사업|조합|소규모|추진위원회|위원회|\s|\(.*?\))', '', r['n'])
            core = re.sub(r'^[가-힣]{1,3}동(?=[가-힣])', '', core) if len(core) > 4 else core
            nm = lambda v: re.sub(r'(아파트|\s|\(.*?\))', '', v['name'])
            c = [v for k, v in APT.items() if k[:10] == code and core and (v.get('yr') or 0) < 2005 and (core in nm(v) or (len(nm(v)) >= 3 and nm(v) in core))]
            a = max(c, key=lambda v: v['n']) if c else None
        if not a and t and t.get('nv', 0) >= 3 and SALES_OK:   # 연립 재건축: 구역 안 빌라·단독 매매(nv)
            a = {'n': t['nv'], 'p25': t.get('p25') or t.get('med'), 'med': t.get('med'), 'p75': t.get('p75') or t.get('med'), 'area_med': t.get('ar'), 'name': '구역 안 연립·다세대', 'yr': None, 'last': t.get('lv') or t['last'], 'by_area': {}} if t.get('med') else None
        if a:
            mk['entry'] = {'src': 'complex', 'n': a['n'], 'p25': a['p25'], 'med': a['med'], 'p75': a['p75'], 'radius': 0, 'area_med': a['area_med'], 'name': a['name'], 'yr': a['yr'],
                           'last': a['last'][2:4] + '.' + a['last'][4:6] + '.' + a['last'][6:8], 'match': 'jibun', 'by_area': a['by_area'], 'fill': 'apt'}
            stat['entry_apt'] += 1
        else: stat['entry_apt_miss'] += 1
        continue
    if r['k'] == '도시정비형 재개발':
        r['nx'] = 'biz'; stat['biz'] += 1   # 업무·상업 중심: 아파트 입주권 계산 대상 아님(화면에서 설명)
        continue
    dg = DONG.get(code) if code else None
    if dg:
        nm = ' '.join(dg['nm']) if dg.get('nm') else '같은 법정동'
        mk['entry'] = {'src': 'villa', 'scope': f"{nm} 전체 2010년 이전 준공 빌라(전용 30~70㎡)", 'n': dg['n'], 'p25': dg['p25'], 'med': dg['med'], 'p75': dg['p75'], 'radius': 0,
                       'area_med': dg['area_med'], 'last': dg['last'][2:4] + '.' + dg['last'][4:6] + '.' + dg['last'][6:8], 'yr_cap': 2010, 'fill': 'dong'}
        stat['entry_dong'] += 1
        if apt_dom(t): mk['entry']['lc'] = 1; r['lc'] = 1; stat['entry_lc'] += 1
    else: stat['entry_miss'] += 1
# ---------- 4. 매수가 신뢰도(lc) 보강: 표본 3건 미만 · 쓴 거래가 원자료 최근 계약일 기준 12개월보다 오래됨 ·
#   구역 밖 시세로 정했는데 구역 안 거래는 1~2건이고 12개월보다 오래됨(구역 시세를 확인할 수 없음) ----------
_as = (TX.get('asOf') or {}).get('sale') or _d0.date.today().strftime('%Y%m%d')
_c12 = f"{int(_as[:4]) - 1:04d}{_as[4:]}"
def _d8(v): return ('20' + v.replace('.', '')) if v and len(v) == 8 and v[2] == '.' else (v or '')
for r in R:
    en = (r.get('mk') or {}).get('entry')
    if not en or not act(r) or r.get('src') == 'moa': continue
    t = r.get('tx') or {}; hd = t.get('hd') or {}
    inz = en.get('fill') in ('zone', 'zoneapt')
    last = t.get('ol') if en.get('fill') == 'zone' and t.get('ol') else _d8(en.get('last'))
    # thin: 구역 밖 시세로 정했는데 구역 안 매매가 아예 없거나(머리글 없음) 최근 24개월 안에 하나도 없거나(w 0) 1~2건이 모두 12개월보다 오래됨
    why = ('n' if (en.get('n') or 0) < 3 else 'old' if last and last < _c12 else
           'thin' if not inz and (not hd or hd.get('w') == 0 or (hd.get('n', 9) < 3 and (hd.get('to') or '') < _c12)) else None)
    # thin(구역 안 최근 거래 없이 주변 시세로 정한 값)은 목록에서 빼지 않고 '주변 시세 기준' 표시만 한다(빼면 살 수 있는 곳이 절반 가까이 사라짐)
    if why == 'thin': en['nbp'] = 1; r['nbp'] = 1; stat['entry_nbp'] += 1
    elif why: en['lc'] = 1; en['lcw'] = why; r['lc'] = 1; stat['entry_lc_' + why] += 1
# 매수가가 아예 없는 진행 중 구역: 화면이 같은 구 다른 구역 빌라 시세 가운데 값(구 평균 추정)을 넣어 '대출 끼고 지금 X억'을 보여 준다(예: s84 무교다동 — 구역 안 거래 0건).
#   구역 안 거래로 확인할 수 없는 값이라 참고값(lc, lcw 'est')으로 둔다.
for r in R:
    if not act(r) or r.get('src') == 'moa' or (r.get('mk') or {}).get('entry') or r.get('nx') in ('biz', 'mk'): continue
    if r.get('s', 0) >= 7 or r['k'] in ('재건축', '소규모재건축'): continue
    t = r.get('tx') or {}; hd = t.get('hd') or {}
    if not hd or hd.get('w') == 0 or (hd.get('n', 9) < 3 and (hd.get('to') or '') < _c12): r['lc'] = 1; r['lcw'] = 'est'; stat['entry_lc_est'] += 1
# ---------- 4b. 같은 이름의 끝난 옛 사업장(예: 노량진제1구역 이전고시 · 노량진1재정비촉진구역 진행 중): 이름은 그대로 두고 표시만 ----------
#   화면 검색(src/app.js)이 s>=9 구역 이름 뒤에 '(완료)'를 붙이므로 데이터 이름은 바꾸지 않는다(바꾸면 '완료 (완료)'로 겹침). 서로 다른 사업이라 지우지 않는다.
def _nk(n):
    n = re.sub(r'\([^)]*\)', '', n); n = re.sub(r'제\s*(\d)', r'\1', n)
    return re.sub(r'재정비촉진구역|재정비촉진지구|재정비촉진|정비구역|주택재개발|주택재건축|재개발|재건축|정비사업|사업|구역|조합|추진위원회|\s', '', n)
_live = collections.defaultdict(list)
for r in R:
    if act(r): _live[(r['g'], _nk(r['n']))].append(r['id'])
# 화면 검색은 이름을 줄여 '노량진1구역 (완료)'처럼 보여 진행 중인 같은 이름 구역과 구분이 안 된다(괄호 안은 줄일 때 지워진다).
#   준공일(정보몽땅 추진경과)이 있으면 이름에 괄호 없이 'YYYY 준공'을 넣고(예: '미아 제4구역 2017 준공 주택재개발정비사업조합' → '미아4구역 2017 준공 (완료)'),
#   준공일도 구역 안 거래도 없어 보여 줄 내용이 없는 옛 사업장(예: o758 노량진제1구역 · 이전고시)은 목록에서 뺀다.
_drop = set()
for r in R:
    if r.get('s', 0) >= 9 and _live.get((r['g'], _nk(r['n']))):
        r['doneTwin'] = _live[(r['g'], _nk(r['n']))]; stat['done_twin'] += 1
        y = ((PREM.get(r['id']) or {}).get('dt') or {}).get('준공', '')[:4]
        if y.isdigit() and y not in r['n']:
            m = re.search(r'제?\s*\d+\s*(재정비촉진구역|구역)?', r['n'])
            r['n'] = (r['n'][:m.end()] + f" {y} 준공 " + r['n'][m.end():].lstrip()).strip() if m else f"{r['n']} {y} 준공"; stat['done_twin_year'] += 1
        elif not y and not (r.get('tx') or {}).get('n'): _drop.add(r['id']); stat['done_twin_drop'] += 1
if _drop:
    D['recs'] = [r for r in R if r['id'] not in _drop]; R = D['recs']; print('drop stale done twins', sorted(_drop))
# ---------- 5. 법정동이 비어 있는 구역(주소 없음·이름에 동 없음): 경계 안 필지 PNU 앞 10자리 → 법정동 이름(dg) ----------
# api.py dong()과 같은 규칙으로 비어 있는지 본다
DONG_RE = re.compile(r'^(?:서울(?:특별)?시\s*)?(?:[가-힣]+구\s+)?([가-힣]+?(?:\d+(?:·\d+)*)?(?:동\d+가|로\d+가|\d+가|동|로|가))(?=[\s\d(산]|$)')
def _dong(r):
    for s in (r.get('j'), r.get('n')):
        m = DONG_RE.match((s or '').strip())
        if m and (s == r.get('j') or not m.group(1).endswith('로')): return m.group(1)
    return ''
C2D = {c: k.split('|')[1] for k, c in DC.items()}
_withD = [(q['ll'], q['g'], _dong(q)) for q in R if q.get('ll') and _dong(q)]
for r in R:
    r.pop('dg', None)
    if _dong(r): continue
    # 이름 앞 2~3글자(+ '동')가 그 구의 법정동과 정확히 같으면(예: '상계주공3' → 상계동)
    nm = next((d for k in (3, 2) for d in (r['n'][:k] + '동', r['n'][:k]) if d.endswith('동') and f"{r['g']}|{d}" in DC), None)
    if nm and '재건축' in r['k']: r['dg'] = nm; stat['dong_fix_name'] += 1; continue   # 단지 이름이 동 이름: 필지 매칭(경계 오매칭 가능)보다 우선
    code = None
    if PARC.get(r['id'], {}).get('p'): code = collections.Counter(p[0][:10] for p in PARC[r['id']]['p']).most_common(1)[0][0]
    if not code or code not in C2D: code = parse_j(r)[0]
    if (not code or code not in C2D) and ((T.get(r['id']) or {}).get('cx')): code = T[r['id']]['cx']['p'][0][:10]
    if code and code in C2D: r['dg'] = C2D[code]; stat['dong_fix_pnu'] += 1; continue
    if r.get('ll'):   # 필지가 없으면 같은 구 가장 가까운(300m 안) 구역의 법정동
        c = [(hav(r['ll'], ll), d) for ll, g, d in _withD if g == r['g']]
        c = min(c, default=None)
        if c and c[0] <= 300: r['dg'] = c[1]; stat['dong_fix_near'] += 1; continue
    if nm: r['dg'] = nm; stat['dong_fix_name'] += 1; continue   # 필지·좌표로 못 찾으면 이름으로
    stat['dong_missing'] += 1
# ---------- 6. 준공 시점 다시 계산 + 오래 멈춘 구역 표시 ----------
#   예전 값(data.base.json eta)은 2026.09.26 한 번 계산한 것이라 그 뒤 단계가 바뀐 구역은 비고, 구역마다 현재 단계에 머문 기간이 거의 반영되지 않아
#   같은 단계 구역이 같은 해에 몰렸다(eMid 2039년 122곳, 2030년 0곳 · eHi 2049~51년 186곳). 그래서 매일 여기서 다시 뽑는다.
#   방법: 단계 전이마다 로그정규분포. 가운데 값 = etaMeta 생존분석(KM) 가운데 값(아직 못 넘어간 구역까지 반영), 퍼짐 = stats의 서울 실제 소요기간
#   25~75% 범위. 현재 단계는 '지금까지 머문 기간(정보몽땅 인가일)보다 길다'는 조건으로 남은 기간을 뽑고(절단 분포), 그 뒤 단계를 이어 붙인다.
#   각 전이의 '정체(끝내 못 넘어감)' 비율은 KM의 stalled 값 · 현재 단계는 머문 기간만큼 정체 비율을 키운다(베이즈). 4,000회 몬테카를로.
#   ① 착공·이주 단계인데 5년 넘게 새 기록(인가·추진경과)이 없거나 ② 착공일 없이 관리처분 뒤 7년이 지났거나 ③ 착공 뒤 관측된 가장 긴 공사기간을 넘긴 구역은
#   준공됐는지 멈췄는지 자료로 알 수 없어 r.stale(진행 확인 필요)로 두고 준공 확률·시점을 싣지 않는다(지난 입주 시점·100% 같은 값이 나오지 않게).
import numpy as _np, hashlib as _hl
from statistics import NormalDist as _NDc
_ND = _NDc()
_EM = D.get('etaMeta') or {}; _TRN = _EM.get('transitions') or {}; _STT = D.get('stats') or {}
_TODAY = _d0.date.fromisoformat(_today)
_CHAIN = ['조합설립>사업시행', '사업시행>관리처분', '관리처분>착공', '착공>준공']
_FIRST = {2: '구역지정>조합설립', 3: '추진위>조합설립', 4: '조합설립>사업시행', 5: '사업시행>관리처분', 6: '관리처분>착공', 7: '관리처분>착공', 8: '착공>준공'}
_ANCH = {2: ['구역지정'], 3: ['추진위'], 4: ['조합설립', '시행자지정'], 5: ['사업시행'], 6: ['관리처분'], 7: ['관리처분'], 8: ['착공']}
def _yrs(d): d = _d0.date.fromisoformat((d + '-15')[:10] if len(d) == 7 else d[:10]); return (_TODAY - d).days / 365.25
def _ym(t): m = _TODAY.year * 12 + _TODAY.month - 1 + int(round(t * 12)); return f"{m // 12:04d}-{m % 12 + 1:02d}"
def _par(g, tr):
    k = (_TRN.get(g) or {}).get(tr) or (_TRN.get('large') or {}).get(tr) or {}
    s = (_STT.get(g) or {}).get(tr) or (_STT.get('large') or {}).get(tr) or {}
    med = k.get('med') or s.get('med') or 3.0
    sig = math.log(s['p75'] / s['p25']) / 1.349 if s.get('p25') and s.get('p75') else 0.6
    return math.log(med), min(0.85, max(0.25, sig)), k.get('stalled') or 0.0, k.get('tLastEv') or 20
def _grp(r):
    g = (r.get('eta') or {}).get('grp')
    return g if g in ('large', 'small') else ('small' if re.search(r'가로|소규모', r.get('k', '')) else 'large')
def _last(rid, r):
    pm = PREM.get(rid) or {}; ds = [v[:10] for v in (pm.get('dt') or {}).values() if isinstance(v, str)]
    ds += [e[0][:10] for e in (pm.get('ev') or []) if e and isinstance(e[0], str)]
    ds += [v.get('d', '')[:10] for v in (pm.get('cs') or r.get('cs') or {}).values() if isinstance(v, dict) and v.get('d')]
    return max([d for d in ds if re.match(r'\d{4}-\d{2}', d)], default='')
_Phi = lambda z: 0.5 * (1 + math.erf(z / math.sqrt(2)))
_old = collections.Counter((r.get('eta') or {}).get('eMid', '')[:4] for r in R if act(r))
# 날짜가 없는 구역의 '머문 기간': 같은 단계에서 날짜가 있는 구역들의 가운데 값(이전 단계 날짜가 있으면 그보다 길 수 없음)
_pool = collections.defaultdict(list)
for r in R:
    if not act(r) or r.get('src') == 'moa' or not (2 <= r.get('s', 0) <= 8): continue
    dt = (PREM.get(r['id']) or {}).get('dt') or {}
    a = next((dt[k] for k in _ANCH[r['s']] if isinstance(dt.get(k), str)), None)
    if a: _pool[r['s']].append(max(0.0, _yrs(a)))
N_DRAW = 4000; H = 35.0; _mix = collections.Counter()
for r in R:
    if not act(r) or r.get('src') == 'moa' or not (2 <= r.get('s', 0) <= 8): continue
    s = r['s']; g = _grp(r); dt = (PREM.get(r['id']) or {}).get('dt') or {}
    a = next((dt[k] for k in _ANCH[s] if isinstance(dt.get(k), str)), None)
    last = _last(r['id'], r); ly = _yrs(last) if last else None
    # 오래 멈춘 구역(착공·이주 단계)
    why = None
    if s >= 7 and ly is not None and ly >= 5: why = f"{last[:4]}.{last[5:7]} 뒤로 5년 넘게 새 기록이 없어요"
    elif s == 8 and not dt.get('착공') and isinstance(dt.get('관리처분'), str) and _yrs(dt['관리처분']) >= 7:
        why = f"착공일 기록이 없고 관리처분인가({dt['관리처분'][:7].replace('-', '.')}) 뒤 {int(_yrs(dt['관리처분']))}년이 지났어요"
    elif s == 8 and a and _yrs(a) > _par(g, '착공>준공')[3]: why = f"착공({a[:7].replace('-', '.')}) 뒤 {int(_yrs(a))}년이 지났는데 준공 기록이 없어요"
    if why:
        r['stale'] = {'why': why, 'last': last[:7]}; r['eta'] = {'na': '진행 확인 필요', 'stale': 1}; stat['eta_stale'] += 1; continue
    r.pop('stale', None)
    if a: e0 = max(0.0, _yrs(a)); src = 'date'
    else:
        prev = [_yrs(v) for k, v in dt.items() if isinstance(v, str) and k in ('구역지정', '추진위', '조합설립', '시행자지정', '사업시행', '관리처분')]
        cap = min(prev) if prev else None
        pl = sorted(x for x in _pool[s] if cap is None or x <= cap) or sorted(_pool[s]) or [1.0]
        e0 = pl[len(pl) // 2]; src = 'pool'
    rng = _np.random.default_rng(int(_hl.md5(r['id'].encode()).hexdigest()[:8], 16))
    first = _FIRST[s]; trs = [first] + _CHAIN[_CHAIN.index(first) + 1:] if first in _CHAIN else [first] + _CHAIN
    mu, sg, st, tl = _par(g, first)
    if e0 > max(tl, 8): r['eta'] = {'p10': 0.0, 'p15': 0.0, 'cond': 0.0, 'grp': g, 'noDate': src != 'date', 'e': round(e0, 1), 'tr': first, 'beyond': 1}; stat['eta_beyond'] += 1; continue
    surv = 1 - _Phi((math.log(max(e0, 1e-3)) - mu) / sg)
    st_c = st / (st + (1 - st) * surv) if st else 0.0
    u = rng.uniform(1 - surv, 1, N_DRAW).clip(1e-9, 1 - 1e-9)
    z = _np.array([_ND.inv_cdf(x) for x in u])
    tot = _np.exp(mu + sg * z) - e0
    dead = rng.uniform(0, 1, N_DRAW) < st_c
    for tr in trs[1:]:
        m2, s2, st2, _ = _par(g, tr)
        tot = tot + _np.exp(m2 + s2 * rng.standard_normal(N_DRAW)); dead |= rng.uniform(0, 1, N_DRAW) < st2
    tot = _np.where(dead, _np.inf, tot)
    _mix.update(collections.Counter((_TODAY.year + _np.floor(tot[tot <= 20] + (_TODAY.month - 0.5) / 12)).astype(int).tolist()))   # 연도별 기대 준공 수(점검용 출력)
    ok = tot[tot <= H]
    if len(ok) < N_DRAW * 0.05: r['eta'] = {'p10': float(_np.mean(tot <= 10)), 'p15': float(_np.mean(tot <= 15)), 'cond': len(ok) / N_DRAW, 'grp': g, 'noDate': src != 'date'}; continue
    lo, md, hi = _np.percentile(ok, [25, 50, 75])
    r['eta'] = {'p10': round(float(_np.mean(tot <= 10)), 3), 'p15': round(float(_np.mean(tot <= 15)), 3), 'cond': round(len(ok) / N_DRAW, 3),
                'eLo': _ym(max(lo, 1 / 12)), 'eMid': _ym(max(md, 1 / 12)), 'eHi': _ym(max(hi, 1 / 12)), 'noDate': src != 'date', 'grp': g, 'e': round(e0, 1), 'tr': first, 'eSrc': src}
    stat['eta_model'] += 1
if _EM:
    _EM['asOf'] = _today; _EM['model'] = 'lognormal-v2'
    _EM['method'] = ("단계 전이마다 걸린 기간을 서울 사업장 기록으로 추정했어요. 가운데 값은 카플란–마이어(KM) 생존분석(아직 다음 단계에 못 간 구역까지 반영), 퍼짐은 실제로 넘어간 구역의 25~75% 범위를 쓴 로그정규분포예요. "
                     "구역마다 지금 단계에 머문 기간(정보몽땅 인가일)보다 길다는 조건으로 남은 기간을 뽑고 이후 단계를 이어 붙이는 몬테카를로(4,000회)로 준공 확률과 시점을 계산했어요. "
                     "끝내 다음 단계로 못 간 비율(정체)도 넣었고, 오래 머문 구역일수록 정체 가능성을 더 크게 봐요. 착공·이주 단계인데 5년 넘게 새 기록이 없는 구역은 '진행 확인 필요'로 두고 확률·시점을 싣지 않아요. "
                     "해제·취소된 구역은 자료에 없어 확률은 다소 낙관적이에요.")
_new = collections.Counter((r.get('eta') or {}).get('eMid', '')[:4] for r in R if act(r))
print('eta eMid by year old', sorted((k, v) for k, v in _old.items() if k)); print('eta eMid by year new', sorted((k, v) for k, v in _new.items() if k))
print('eta expected completions/yr (mixture)', [(y, round(v / N_DRAW, 1)) for y, v in sorted(_mix.items())])
print('eta stale', [(r['id'], r['n'][:14], r['stale']['why']) for r in R if r.get('stale')][:30])
D['jrz'] = TX.get('jrz'); D['txAsOf'] = TX.get('asOf')
D['rvj'] = TX.get('rvj')
import datetime as _dt
# 갱신일은 서울 날짜(KST)로 — Actions 러너는 UTC라 06:40(서울)에 돌면 전날이 찍혔다(10.25 → 10.24 되돌아감).
# 직전 빌드·배포된 날짜보다 앞서지 않게 한다(같은 날 두 번 돌거나 시계가 어긋나도 날짜가 뒤로 가지 않음).
_kst = os.environ.get('ZP_UPD') or (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(hours=9)).date().isoformat()   # ZP_UPD: 새 자료 없이 다시 생성할 때(통합 빌드 등) 자료 날짜를 그대로
_prev = []
for _pp, _kk in (('pipeline/data.enriched.json', 'upd'), ('public/api/v1/meta.json', 'updated')):
    try: _prev.append(str(json.load(open(os.path.join(ROOT, _pp), encoding='utf-8')).get(_kk) or '')[:10])
    except Exception: pass
D['upd'] = max([_kst] + [x for x in _prev if re.match(r'\d{4}-\d\d-\d\d$', x)])
# ---------- 경사도(tools/slope.py 캐시): 평균 경사로 평지·완만·경사·급경사 ----------
_SLP = os.path.join(ROOT, 'pipeline/cache/slope.json')
if os.path.exists(_SLP):
    _sl = json.load(open(_SLP)); _ns = 0
    for r in D['recs']:
        v = _sl.get(r['id'])
        if not v or v.get('a') is None: continue
        a_ = v['a']; k = '평지' if a_ < 3 else '완만' if a_ < 7 else '경사' if a_ < 12 else '급경사'
        r['sl'] = {'a': v['a'], 'd': v.get('d'), 'p': v.get('p'), 'k': k}; _ns += 1
    print('slope', _ns)
# ---------- 사이클 3(리드 결정 10.28): 세대수 출처 라벨(sm.uL) · 원천으로 다시 확인한 세대수 · 같은 대표지번 사업장(sj) ----------
#   세대수(sm.units)는 첫 가져오기 값이다. 출처를 화면이 그대로 말하게 라벨을 붙인다 —
#   premium sm.unitsSrc '신통 추진현황'이면 '계획 세대수(신통 추진현황)', 그 밖은 정보몽땅 사업개요 '분양 세대수'(임대 포함이면 '총 세대수(정보몽땅 분양+임대)').
#   UNITS_SRC: 정보몽땅 사업개요(주택공급계획 분양 전용면적별 세대수)를 다시 열어 확인한 값 — 확인 날짜·주소를 남긴다. 확인 못 한 곳에 숫자를 지어 넣지 않는다.
#   UNITS_TBD: 원천으로 확인되지 않아 숫자 대신 '확인 중'으로 둘 곳(sm.units를 지우고 sm.uTbd = 1).
UNITS_SRC = {'o840': {'units': 1573, 'd': '2026-10-28', 'url': 'https://cleanup.seoul.go.kr/cafe/mastr-cleanup-bsnsSumry/execute.do?cafeId=350100002017D33&stepSeCode=102&div=sumry',
                      'note': '분양 60㎡ 이하 677 · 60~85㎡ 792 · 85㎡ 초과 104 (예전 값 4,591은 신통 추진현황 표 값)'}}
UNITS_TBD = {}
_PB = J('pipeline/premium.base.json') if os.path.exists(os.path.join(ROOT, 'pipeline/premium.base.json')) else {}
for r in D['recs']:
    sm = r.get('sm')
    if r['id'] in UNITS_SRC:
        u = UNITS_SRC[r['id']]; sm = r.setdefault('sm', {})
        sm['units'] = u['units']; sm.pop('saleUnits', None); sm['uL'] = '분양 세대수(정보몽땅)'; sm['uD'] = u['d']; sm['uU'] = u['url']; stat['units_src'] += 1
        continue
    if r['id'] in UNITS_TBD and sm:
        sm.pop('units', None); sm.pop('saleUnits', None); sm['uTbd'] = 1; sm['uL'] = '세대수 확인 중'; stat['units_tbd'] += 1; continue
    if not sm or not sm.get('units'): continue
    src = ((_PB.get(r['id']) or {}).get('sm') or {}).get('unitsSrc')
    if src == '신통 추진현황': sm['uL'] = '계획 세대수(신통 추진현황)'
    elif sm.get('rental') and sm.get('saleUnits') and sm['units'] == sm['saleUnits'] + sm['rental']: sm['uL'] = '총 세대수(정보몽땅 분양+임대)'
    else: sm['uL'] = '분양 세대수(정보몽땅)'
    stat['units_lbl'] += 1
_SJ = collections.defaultdict(list)
for r in D['recs']:
    if act(r) and r.get('j') and r.get('src') != 'moa': _SJ[(r.get('g'), r['j'])].append(r['id'])
for r in D['recs']:
    r.pop('sj', None)
    L = _SJ.get((r.get('g'), r.get('j'))) if act(r) and r.get('src') != 'moa' else None
    if L and len(L) > 1: r['sj'] = [i for i in L if i != r['id']]; stat['same_jibun'] += 1   # 같은 구·같은 대표지번에 따로 등록된 사업장(예: o38 면목동172-1 재건축 추진위 ↔ o39 면목8구역) — 근거 없이 합치지 않고 안내만
json.dump(D, open(os.path.join(ROOT, 'pipeline/data.enriched.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(dict(stat))
miss = [(r['id'], r['n'], r['k'], r.get('j')) for r in R if act(r) and r.get('src') != 'moa' and not (r.get('mk') or {}).get('entry') and r.get('nx') not in ('biz', 'mk')]
print('still no price', len(miss)); [print(' ', m) for m in miss[:40]]
