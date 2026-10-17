#!/usr/bin/env python3
"""데이터 보강: 좌표(경계로 위치를 찾은 후보지) · 권리산정기준일 · 매수가 빈칸 채우기 · 구역 실거래 요약 병합.
입력: src/data.json(기준), public/data/geo.json, pipeline/txsum.json, pipeline/rights.json
출력: public/data/... 는 건드리지 않고 build 단계용 pipeline/data.enriched.json 을 쓴다(src/data.json 원본 보존).
"""
import json, os, re, math, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
D = J('pipeline/data.base.json') if os.path.exists(os.path.join(ROOT, 'pipeline/data.base.json')) else J('src/data.json')
from junk import is_junk   # 시험 등록(이름이 'test'·'테스트'·'임시'뿐) 제외 — 화면·정적 페이지·API 모두 이 파일을 쓴다
_JUNK = {r['id'] for r in D['recs'] if is_junk(r)}
D['recs'] = [r for r in D['recs'] if r['id'] not in _JUNK]; R = D['recs']
GEO = J('public/data/geo.json')['z']
TX = J('pipeline/txsum.json')
PARC = J('pipeline/cache/parcels.json') if os.path.exists(os.path.join(ROOT, 'pipeline/cache/parcels.json')) else {}
RT = J('pipeline/rights.json') if os.path.exists(os.path.join(ROOT, 'pipeline/rights.json')) else {}
stat = collections.Counter()
SALES_OK = True
act = lambda r: not (r['s'] >= 9 or (r.get('dn') and r['s'] < 7))

# ---------- 0. 정보몽땅 최신 추진경과 반영(단계·인가일·최근 기록) ----------
PREM = J('pipeline/premium.base.json') if os.path.exists(os.path.join(ROOT, 'pipeline/premium.base.json')) else J('src/premium.json')
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
    if c.get('ev'): pm['ev'] = c['ev'][:6]
    row = c.get('row') or {}
    ns = SR2S.get(row.get('sr'))
    KEYS = {2: '구역지정', 3: '추진위', 4: '조합설립', 5: '사업시행', 6: '관리처분', 8: '착공', 9: '준공'}
    ok_ev = ns is not None and (ns - r['s'] == 1 or (KEYS.get(ns) and (c.get('dt') or {}).get(KEYS[ns])))
    if ns is not None and ns > r['s'] and not ok_ev: r['sPend'] = row['sr']; stat['stage_pending'] += 1
    if ok_ev and '(' not in r['sr'] and not r.get('chk') and ns > r['s']:
        stage_changes.append([r['id'], r['sr'], row['sr']]); r['sr'] = row['sr']; r['s'] = ns; r['sUp'] = 1; r['eta'] = {'na': '단계 갱신 반영 중'}   # 예전 단계 기준 준공 확률은 버린다(다음 월간 재계산 때 채움)
        stat['stage_up'] += 1
# 날짜 정리: 오늘 뒤 날짜(원자료 오기, 예: 2033년)는 버리고, 단계 순서가 거꾸로 된 날짜(준공이 착공보다 앞섬 등)는 뒤 단계 쪽을 버린다
import datetime as _d0
_today = _d0.date.today().isoformat()
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
ST = D['stations']   # [이름, lat, lng, [노선], x, y]
HB = {'광화문·시청(CBD)': (37.5714, 126.9768), '강남역(GBD)': (37.4979, 127.0276), '여의도(YBD)': (37.5216, 126.9243)}
withH = [r for r in R if r.get('ll') and r.get('h') is not None]
for r in R:
    z = GEO.get(r['id'])
    if r.get('ll') and r.get('xy'): continue
    if r.get('ll'): lat, lng = r['ll']
    elif z and not z.get('e'): lng, lat = z['l']; r['ll'] = [lat, lng]; r['llFix'] = 'bnd'
    else: continue
    r['xy'] = toXY(lat, lng)
    ds = sorted(((hav((lat, lng), (s[1], s[2])), s) for s in ST), key=lambda t: t[0])
    r['st'] = {'n': ds[0][1][0], 'd': round(ds[0][0])}
    r['s3'] = [[s[0], round(d), s[3]] for d, s in ds[:3]]
    r['ln'] = sorted({l for d, s in ds if d <= 1000 for l in s[3]})
    r['hb'] = {k: round(hav((lat, lng), v)) for k, v in HB.items()}
    nb = min(withH, key=lambda q: hav((lat, lng), q['ll']))
    r['h'] = nb['h']
    stat['ll_from_boundary'] += 1

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

# ---------- 3. 구역 실거래 요약 병합 + 매수가 ----------
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
for r in R:
    t = T.get(r['id'])
    if t:
        r['tx'] = {k: v for k, v in t.items() if v not in (None, [], {}) and k not in ('q', 'qa', 'qi', 'age', 'agn', 'pc')}   # 상세는 data/tx.json에서 지연 로딩
    if not act(r) or r.get('src') == 'moa': continue
    mk = r.setdefault('mk', {}); en = mk.get('entry')
    villa_kind = r['k'] not in ('재건축', '소규모재건축')
    # (0) 예전 반경 추정값 점검: 범위가 터무니없거나(p75/p25 3배 초과) 원룸 기준(전용 20㎡ 미만), 신축 단지(2005년 이후 준공)·먼 이름 매칭이면 버리고 다시 채운다
    if en and ((en.get('p25') and en.get('p75') and en['p75'] / max(en['p25'], 1) > 3) or (en.get('area_med') or 99) < 20
               or (en.get('src') == 'complex' and (en.get('yr') or 0) >= 2005) or (en.get('match') == 'name' and (en.get('radius') or 0) > 50)):
        mk.pop('entry', None); en = None; stat['entry_drop_bad'] += 1
    # (a) 구역 안 실거래가 충분하면 반경 추정보다 우선. 3~4건이라도 반경 추정과 25% 넘게 다르면 구역 안 값을 쓴다
    if t and villa_kind and (t.get('no', 0) >= 5 or (t.get('no', 0) >= 3 and en and en.get('med') and t.get('med') and abs(en['med'] / t['med'] - 1) > 0.25)):
        lv = t.get('lv') or t['last']   # 빌라·단독 최근 거래일(아파트 거래가 섞인 last 대신)
        mk['entry'] = {'src': 'villa', 'scope': '대표지번과 같은 본번 2015년 이전 준공 빌라' if t.get('m') == 'jibun' else '구역 경계 안 2015년 이전 준공 빌라', 'n': t['no'], 'med': t['med'], 'p25': t.get('p25') or t['med'], 'p75': t.get('p75') or t['med'],
                       'radius': 0, 'area_med': t['ar'], 'last': lv[2:4] + '.' + lv[4:6] + '.' + lv[6:8], 'fill': 'zone', **({'m': 'jibun'} if t.get('m') == 'jibun' else {}),
                       **({'prev': {k: en[k] for k in ('n', 'med', 'radius') if k in en}} if en else {})}
        stat['entry_zone' if en else 'entry_zone_new'] += 1
        continue
    if en: continue
    code, pnu = parse_j(r)
    if not code and PARC.get(r['id'], {}).get('p'):   # 주소가 없으면 경계 안 필지의 법정동
        code = collections.Counter(p[0][:10] for p in PARC[r['id']]['p']).most_common(1)[0][0]
    if r['k'] in ('재건축', '소규모재건축'):
        a = APT.get(pnu) if pnu else None
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
    else: stat['entry_miss'] += 1
# ---------- 4. 특수 사업 표시: 역세권 장기전세주택(lt) · 시장·상가 정비(mk) ----------
for r in R:
    r.pop('tag', None)
    if '장기전세' in r['n']: r['tag'] = 'lt'; stat['tag_lt'] += 1
    elif re.search(r'시장|상가', r['n']): r['tag'] = 'mk'; stat['tag_mk'] += 1
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
    if code and code in C2D: r['dg'] = C2D[code]; stat['dong_fix_pnu'] += 1; continue
    if r.get('ll'):   # 필지가 없으면 같은 구 가장 가까운(300m 안) 구역의 법정동
        c = [(hav(r['ll'], ll), d) for ll, g, d in _withD if g == r['g']]
        c = min(c, default=None)
        if c and c[0] <= 300: r['dg'] = c[1]; stat['dong_fix_near'] += 1; continue
    if nm: r['dg'] = nm; stat['dong_fix_name'] += 1; continue   # 필지·좌표로 못 찾으면 이름으로
    stat['dong_missing'] += 1
D['jrz'] = TX.get('jrz'); D['txAsOf'] = TX.get('asOf')
D['rvj'] = TX.get('rvj')
import datetime as _dt
D['upd'] = _dt.date.today().isoformat()
json.dump(D, open(os.path.join(ROOT, 'pipeline/data.enriched.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(dict(stat))
miss = [(r['id'], r['n'], r['k'], r.get('j')) for r in R if act(r) and r.get('src') != 'moa' and not (r.get('mk') or {}).get('entry') and r.get('nx') != 'biz']
print('still no price', len(miss)); [print(' ', m) for m in miss[:40]]
