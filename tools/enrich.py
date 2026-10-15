#!/usr/bin/env python3
"""데이터 보강: 좌표(경계로 위치를 찾은 후보지) · 권리산정기준일 · 매수가 빈칸 채우기 · 구역 실거래 요약 병합.
입력: src/data.json(기준), public/data/geo.json, pipeline/txsum.json, pipeline/rights.json
출력: public/data/... 는 건드리지 않고 build 단계용 pipeline/data.enriched.json 을 쓴다(src/data.json 원본 보존).
"""
import json, os, re, math, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
D = J('src/data.json'); R = D['recs']
GEO = J('public/data/geo.json')['z']
TX = J('pipeline/txsum.json')
PARC = J('pipeline/cache/parcels.json') if os.path.exists(os.path.join(ROOT, 'pipeline/cache/parcels.json')) else {}
RT = J('pipeline/rights.json') if os.path.exists(os.path.join(ROOT, 'pipeline/rights.json')) else {}
stat = collections.Counter()
SALES_OK = True
act = lambda r: not (r['s'] >= 9 or (r.get('dn') and r['s'] < 7))

# ---------- 0. 정보몽땅 최신 추진경과 반영(단계·인가일·최근 기록) ----------
PREM = J('src/premium.json')
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
        stage_changes.append([r['id'], r['sr'], row['sr']]); r['sr'] = row['sr']; r['s'] = ns; r['sUp'] = 1
        stat['stage_up'] += 1
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
    if r.get('ll') or not z or z.get('e'): continue
    lng, lat = z['l']; r['ll'] = [lat, lng]; r['xy'] = toXY(lat, lng); r['llFix'] = 'bnd'
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

for r in R:
    if PARC.get(r['id'], {}).get('p'): r['pcl'] = 1

# ---------- 2. 권리산정기준일 ----------
for r in R:
    x = RT.get(r['id'])
    if x: r['rdx'] = x; stat['rights'] += 1

# ---------- 3. 구역 실거래 요약 병합 + 매수가 ----------
T = TX['tx']; DONG = TX['dong']; APT = TX['apt']; DC = TX['dcode']
GU5 = {}
for k, c in DC.items(): GU5[k.split('|')[0]] = c[:5]
def parse_j(r):
    j = (r.get('bj') or r.get('j') or '').strip()
    m = re.match(r'([가-힣0-9]+?(?:동|가|로))\s*(산\s*)?(\d+)(?:-(\d+))?', j)
    if not m: return None, None
    dong = re.sub(r'(\d+)가$', r'\1가', m.group(1))
    code = DC.get(f"{r['g']}|{dong}")
    if not code:   # '신당동' 대신 '신당2동' 같은 행정동 표기
        code = DC.get(f"{r['g']}|{re.sub(r'\d+동$', '동', dong)}")
    if not code: return None, None
    pnu = f"{code}{'2' if m.group(2) else '1'}{int(m.group(3)):04d}{int(m.group(4) or 0):04d}"
    return code, pnu
for r in R:
    t = T.get(r['id'])
    if t:
        r['tx'] = {k: v for k, v in t.items() if v not in (None, [], {}) and k not in ('q', 'age', 'agn', 'pc')}   # 상세는 data/tx.json에서 지연 로딩
    if not act(r) or r.get('src') == 'moa': continue
    mk = r.setdefault('mk', {}); en = mk.get('entry')
    villa_kind = r['k'] not in ('재건축', '소규모재건축', '도시정비형 재개발')
    # (a) 구역 안 실거래가 충분하면 반경 추정보다 우선
    if t and t.get('no', 0) >= 5 and villa_kind:
        mk['entry'] = {'src': 'villa', 'scope': '구역 경계 안 2015년 이전 준공 빌라', 'n': t['no'], 'med': t['med'], 'p25': t.get('p25') or t['med'], 'p75': t.get('p75') or t['med'],
                       'radius': 0, 'area_med': t['ar'], 'last': t['last'][2:4] + '.' + t['last'][4:6] + '.' + t['last'][6:8], 'fill': 'zone',
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
        if not a and code:   # 같은 법정동에서 단지 이름이 겹치는 곳
            core = re.sub(r'(아파트|주택|재건축|정비|사업|조합|소규모|추진위원회|위원회|\s|\(.*?\))', '', r['n'])
            core = re.sub(r'^[가-힣]{1,3}동(?=[가-힣])', '', core) if len(core) > 4 else core
            nm = lambda v: re.sub(r'(아파트|\s|\(.*?\))', '', v['name'])
            c = [v for k, v in APT.items() if k[:10] == code and core and (core in nm(v) or (len(nm(v)) >= 3 and nm(v) in core))]
            a = max(c, key=lambda v: v['n']) if c else None
        if not a and t and t.get('n', 0) >= 3 and SALES_OK:   # 연립 재건축: 구역 안 매매
            a = {'n': t['n'], 'p25': t.get('p25') or t.get('med'), 'med': t.get('med'), 'p75': t.get('p75') or t.get('med'), 'area_med': t.get('ar'), 'name': '구역 안 연립·다세대', 'yr': None, 'last': t['last'], 'by_area': {}} if t.get('med') else None
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
D['jrz'] = TX.get('jrz'); D['txAsOf'] = TX.get('asOf')
import datetime as _dt
D['upd'] = _dt.date.today().isoformat()
json.dump(D, open(os.path.join(ROOT, 'pipeline/data.enriched.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(dict(stat))
miss = [(r['id'], r['n'], r['k'], r.get('j')) for r in R if act(r) and r.get('src') != 'moa' and not (r.get('mk') or {}).get('entry') and r.get('nx') != 'biz']
print('still no price', len(miss)); [print(' ', m) for m in miss[:40]]
