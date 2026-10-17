#!/usr/bin/env python3
"""구역 경계 안 실거래(매매·전세)와 필지 현황 집계.
입력: src/data.json, pipeline/cache/parcels.json, --sale CSV들(서울시 부동산 실거래가 OA-21275), --rent CSV들(전월세 OA-21276)
출력: public/data/tx.json (구역별 최근 거래 목록), pipeline/txsum.json (구역별 요약 + 동 단위 빌라 시세·단지 시세 — enrich.py가 사용)
"""
import csv, json, re, os, sys, argparse, collections, statistics as st, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--sale', nargs='+', required=True)
ap.add_argument('--rent', nargs='+', required=True)
A = ap.parse_args()
_B = os.path.join(ROOT, 'pipeline/data.base.json')
D = json.load(open(_B if os.path.exists(_B) else os.path.join(ROOT, 'src/data.json'), encoding='utf-8'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from junk import is_junk
R = [r for r in D['recs'] if not is_junk(r)]   # 시험 등록 제외
_JK = {r['id'] for r in D['recs']} - {r['id'] for r in R}
PAR = {k: v for k, v in json.load(open(os.path.join(ROOT, 'pipeline/cache/parcels.json'))).items() if k not in _JK}
med = lambda a: st.median(a) if a else None
NOWY = datetime.date.today().year

def opencsv(fn):
    raw = open(fn, 'rb').read(1 << 20)
    if raw.startswith(b'\xef\xbb\xbf'): enc = 'utf-8-sig'
    else:
        import codecs
        try: codecs.getincrementaldecoder('utf-8')().decode(raw, final=False); enc = 'utf-8'   # 잘린 마지막 글자는 허용
        except UnicodeDecodeError: enc = 'cp949'
    f = open(fn, encoding=enc, errors='replace'); rd = csv.reader(f)
    h = [re.sub(r'\(.*?\)|\s|"', '', c) for c in next(rd)]
    return rd, {k: i for i, k in enumerate(h)}

def pnu(g, dong, se, b1, b2):
    try: return f"{g}{dong}{'2' if str(se).strip() in ('2', '산') else '1'}{int(b1):04d}{int(b2 or 0):04d}"
    except Exception: return None

# ---- 구역 → 필지 ----
pnu2rec = collections.defaultdict(list); parstat = {}
for rid, v in PAR.items():
    ps = v['p']
    for p in ps: pnu2rec[p[0]].append(rid)
    if not ps: continue
    land = [p for p in ps if p[3] not in ('도로', '하천', '구거', '공원', '제방')]
    small = sum(1 for p in land if 0 < p[1] < 90)
    pub = sum(1 for p in ps if any(k in p[2] for k in ('국유', '시유', '도유', '구유', '군유', '시,도유', '시군구유')))
    road = sum(1 for p in ps if p[3] == '도로')
    jm = collections.Counter(p[3] for p in ps)
    parstat[rid] = {'n': len(ps), 'sm': round(small/max(1, len(land))*100), 'pub': round(pub/len(ps)*100), 'rd': round(road/len(ps)*100),
                    'ar': round(sum(p[1] for p in ps)), 'jm': [[k, v] for k, v in jm.most_common(4)]}
print('zones with parcels', len(parstat), 'pnus', len(pnu2rec))

# ---- 매매 ----
SALE = collections.defaultdict(list)
dongV = collections.defaultdict(list)      # (구코드+동코드) → 2010년 이전 준공 빌라 최근 12개월 [가격, 전용, 대지, 날짜]
apt = collections.defaultdict(list)        # 지번 PNU → 아파트 매매 [날짜, 전용, 가격, 건물명, 준공]
bldS = collections.defaultdict(list); dongName = {}
YR = {}   # PNU → 가장 최근 준공연도(매매·전월세 신고에서)
ALLB = collections.defaultdict(list)       # PNU 본번(앞 15자리) → 매매 전체(빌라·단독·아파트·입주권) — 경계 없는 구역의 대표지번 매칭용
APTR = collections.defaultdict(list)       # 지번 PNU → 아파트·입주권 매매 행(구역 거래 행 모양) — 경계·지번 없는 재건축 후보지의 단지 이름 매칭용
APTN = collections.defaultdict(collections.Counter)   # 지번 PNU → 아파트 건물명 빈도
last_sale = ''
for fn in A.sale:
    rd, ix = opencsv(fn)
    for x in rd:
        try:
            if x[ix['취소일']].strip(): continue
            use = x[ix['건물용도']]
            rk = x[ix['권리구분']].strip() if ix.get('권리구분') is not None else ''
            if rk and not (rk == '입주권' and use == '아파트'): continue   # 분양권은 제외, 입주권은 구역 목록에만(유형 3)
            price = int(float(x[ix['물건금액만원']] if '물건금액만원' in ix else x[ix['물건금액']]))
            area = float(x[ix['건물면적㎡']] if '건물면적㎡' in ix else x[ix['건물면적']] or 0)
            land = float((x[ix['토지면적㎡']] if '토지면적㎡' in ix else x[ix['토지면적']]) or 0)
            yv = (x[ix['건축년도']] or '').strip(); yr = int(float(yv)) if yv and yv.lower() != 'null' else 0
        except Exception: continue
        g, dcode = x[ix['자치구코드']], x[ix['법정동코드']]
        p = pnu(g, dcode, x[ix['지번구분']], x[ix['본번']], x[ix['부번']])
        d = x[ix['계약일']]; last_sale = max(last_sale, d)
        dongName[g + dcode] = (x[ix['자치구명']], x[ix['법정동명']])
        if use == '아파트':
            # 구역 거래 목록 유형: 0 연립다세대 · 1 단독다가구 · 2 아파트 · 3 아파트 입주권 (아파트·입주권은 대지 0)
            rec = [d, 3 if rk else 2, yr, round(area, 1), 0, price, x[ix['층']], p]
            if p:
                if not rk: apt[p].append([d, round(area, 1), price, x[ix['건물명']], yr])
                ALLB[p[:15]].append(rec); APTR[p].append(rec)
                if x[ix['건물명']]: APTN[p][x[ix['건물명']]] += 1
            for rid in pnu2rec.get(p, ()): SALE[rid].append(rec)
            continue
        if use not in ('연립다세대', '단독다가구'): continue
        rec = [d, 0 if use == '연립다세대' else 1, yr, round(area, 1), round(land, 1), price, x[ix['층']], p]
        if p in pnu2rec and yr: YR[p] = max(YR.get(p, 0), yr)
        for rid in pnu2rec.get(p, ()): SALE[rid].append(rec)
        if p: ALLB[p[:15]].append(rec)
        if use == '연립다세대' and area > 0 and yr:
            if yr <= 2010: dongV[g + dcode].append([price, area, land, d])
            if NOWY - yr >= 15: bldS[p].append(price/area)
for k in list(SALE): SALE[k] = [list(t) for t in dict.fromkeys(tuple(x) for x in SALE[k])]
print('sale zones', len(SALE), 'last', last_sale)
if len(SALE) < 100 or not last_sale: raise SystemExit('매매 자료가 비정상적으로 적어요 — 집계 중단(어제 결과 유지)')

# ---- 전세 ----
JEON = collections.defaultdict(list); bldJ = collections.defaultdict(list); last_rent = ''
ALLJ = collections.defaultdict(list)   # PNU 본번 → 연립다세대 전세(경계 없는 구역의 대표지번 매칭용, 매매 ALLB와 같은 규칙)
RV = collections.defaultdict(list)   # 구 → [(계약일, 보증금, 종전 보증금)] 갱신계약
for fn in A.rent:
    rd, ix = opencsv(fn)
    kse = '지번구분코드' if '지번구분코드' in ix else '지번구분'
    for x in rd:
        try:
            if x[ix['법정동명']]: dongName.setdefault(x[ix['자치구코드']] + x[ix['법정동코드']], (x[ix['자치구명']], x[ix['법정동명']]))   # 매매가 없는 법정동 이름도(코드→이름)
            if x[ix['전월세구분']] != '전세' or x[ix['건물용도']] != '연립다세대': continue
            dep = int(float(x[ix['보증금만원']] if '보증금만원' in ix else x[ix['보증금']]))
            area = float((x[ix['임대면적㎡']] if '임대면적㎡' in ix else x[ix['임대면적']]) or 0)
            yr = int(float(x[ix['건축년도']] or 0))
        except Exception: continue
        p = pnu(x[ix['자치구코드']], x[ix['법정동코드']], x[ix[kse]], x[ix['본번']], x[ix['부번']])
        d = x[ix['계약일']]; last_rent = max(last_rent, d)
        for rid in pnu2rec.get(p, ()): JEON[rid].append([d, yr, round(area, 1), dep])
        if p: ALLJ[p[:15]].append([d, yr, round(area, 1), dep])
        try:
            if '갱신' in x[ix.get('신규갱신여부', -1)] and x[ix['종전보증금']].strip():
                RV[x[ix['자치구명']]].append((d, dep, int(float(x[ix['종전보증금']]))))
        except Exception: pass
        if p in pnu2rec and yr: YR[p] = max(YR.get(p, 0), yr)
        if area > 0 and yr and NOWY - yr >= 15: bldJ[p].append(dep/area)
for k in list(JEON): JEON[k] = [list(t) for t in dict.fromkeys(tuple(x) for x in JEON[k])]
print('jeonse zones', len(JEON), 'last', last_rent)
if len(JEON) < 100: raise SystemExit('전세 자료가 비정상적으로 적어요 — 집계 중단(어제 결과 유지)')

bldRatio = {p: med(bldJ[p])/med(bldS[p]) for p in set(bldS) & set(bldJ)}
allR = [v for v in bldRatio.values() if .15 < v < 1.1]

def q_of(d): return f"{d[2:4]}Q{(int(d[4:6]) - 1)//3 + 1}"

# ---- 대표지번 → 법정동 코드·PNU (enrich.py의 parse_j와 같은 규칙) ----
DCODE = {}
for k, (gu, dn) in dongName.items(): DCODE[(gu, dn)] = k
DC = {f"{a}|{b}": c for (a, b), c in DCODE.items()}
_D2C = collections.defaultdict(set)
for (gu, dn), c in DCODE.items(): _D2C[dn].add(c)
JRE = re.compile(r'([가-힣]+\d+가|[가-힣]+?\d*(?:동|로|가))\s*(산\s*)?(\d+)(?:-(\d+))?')   # '금호동2가 421-1'처럼 N가를 먼저
def parse_j(r, dc=DC):
    j = re.sub(r'^\s*(서울(특별)?시\s*)?([가-힣]+구\s+)?', '', (r.get('bj') or r.get('j') or ''))
    m = JRE.match(j)
    if not m: return None, None
    dong = m.group(1)
    code = dc.get(f"{r['g']}|{dong}") or dc.get(f"{r['g']}|{re.sub(r'\d+동$', '동', dong)}")   # '신당2동' 같은 행정동 표기
    if not code:   # 자치구 오기: 그 법정동 이름이 서울에 하나뿐이면 그 코드
        cs = _D2C.get(dong) or _D2C.get(re.sub(r'\d+동$', '동', dong)) or ()
        code = next(iter(cs)) if len(cs) == 1 else None
    if not code: return None, None
    return code, f"{code}{'2' if m.group(2) else '1'}{int(m.group(3)):04d}{int(m.group(4) or 0):04d}"
# ---- 경계·대표지번이 없는 재건축 후보지(신통기획 자문 등): 이름의 단지명을 같은 구(동 이름이 앞에 붙으면 그 동) 아파트 건물명과 맞춘다 ----
#   '중계주공8' → 중계동 '주공8' · '성수동아' → 성수동1·2가 '동아' · '상계주공3' → '상계주공3(고층)'. 2005년 이후 준공 신축 단지는 제외
def _nn(s): return re.sub(r'(\d)차$', r'\1', re.sub(r'아파트|단지|\(.*?\)|\s|-', '', s or '').upper())
def name_match(r):
    g5 = next((c[:5] for (gu, _), c in DCODE.items() if gu == r['g']), None)
    if not g5: return None
    core = _nn(re.sub(r'재건축|소규모|정비|사업|조합|추진위원회', '', r['n']))
    if len(core) < 2: return None
    keys = {(core, None)}
    gs = r['g'][:-1]   # '용산반도' → 용산구 '반도'(동 이름이 안 맞을 때만, 아래)
    rest = {core[len(gs):]} if len(gs) >= 2 and core.startswith(gs) and len(core) - len(gs) >= 2 else set()
    for (gu, dn), c in DCODE.items():
        if gu != r['g']: continue
        for pre in {dn, re.sub(r'\d+가$', '', dn), re.sub(r'동?(\d+가)?$', '', dn)}:
            if pre and core.startswith(pre) and len(core) - len(pre) >= 2: keys.add((core[len(pre):], c)); rest.add(core[len(pre):])
    def scan(keys):
        hit = []
        for p, cn in APTN.items():
            if p[:5] != g5: continue
            nms = {_nn(k) for k in cn}
            if not any(k in nms and (c is None or p[:10] == c) for k, c in keys): continue
            yrs = collections.Counter(x[2] for x in APTR[p] if x[2])
            if yrs and yrs.most_common(1)[0][0] >= 2005: continue
            hit.append(p)
        return hit
    hit = scan(keys)
    if not hit and rest:   # 동 이름이 생활권 이름일 때(예: 청량리 신현대 → 회기동): 구 전체에서 한 단지(같은 본번)만 맞으면
        h2 = scan({(k, None) for k in rest})
        if len({p[:15] for p in h2}) == 1: hit = h2
    if not hit: return None
    def _yr(p):
        c = collections.Counter(x[2] for x in APTR[p] if x[2]); return c.most_common(1)[0][0] if c else 0
    old = [p for p in hit if 0 < _yr(p) <= NOWY - 30]   # 이름이 겹치면 재건축 연한(30년)을 채운 단지
    if old and len({p[:15] for p in hit}) > 1: hit = old
    nm = collections.Counter()
    for p in hit: nm.update(APTN[p])
    return {'p': sorted(hit), 'nm': nm.most_common(1)[0][0]}
GEO = (json.load(open(os.path.join(ROOT, 'public/data/geo.json'))) if os.path.exists(os.path.join(ROOT, 'public/data/geo.json')) else {}).get('z', {})
for k in list(ALLB): ALLB[k] = [list(t) for t in dict.fromkeys(tuple(x) for x in ALLB[k])]
ZCODE = {}   # 구역 → 법정동 코드(동 단위 참고 시세용)

# ---- 화면 실거래 머리글 하나의 기준(hd): 헤드라인·칩·차트·최근 목록이 모두 이 값만 쓴다 ----
# 기간은 오늘이 아니라 원자료의 가장 최근 계약일(last_sale)에서 거꾸로 센다
def _back(d, months):
    y, m = int(d[:4]), int(d[4:6]) - months
    while m <= 0: y -= 1; m += 12
    return f"{y:04d}{m:02d}{d[6:8]}"
HD12, HD24 = _back(last_sale, 12), _back(last_sale, 24)
def _q_idx(d): return int(d[:4]) * 4 + (int(d[4:6]) - 1) // 3
HDQ0 = _q_idx(last_sale) - 11   # 최근 12개 분기
def _unit(x, b): return x[5] / x[4] * 3.3058 if b == 'v' else x[5] / x[3] * 3.3058
def _okrow(x, b): return (x[1] in (0, 1) and x[4] > 0) if b == 'v' else (x[1] == (3 if b == 'i' else 2) and x[3] > 0)
def _filt(rows, b, ref=None):
    """직거래·특수관계 의심 거래 제외. 반환 (남긴 행, 뺀 건수). 3건 이상일 때만.
    빌라(v): 같은 기준 가운데 값의 0.6~1.8배 밖. 아파트·입주권(a·i): 면적대마다 값이 달라 전용 ±10㎡ 같은 면적대(같은 기간, 3건 미만이면 ref = 최근 24개월)의
    가운데 값과 비교해 0.75~1.35배 밖(같은 단지·같은 평형 시세 차이는 보통 이 안). 같은 면적대 비교 거래가 3건 미만이면 전체 가운데 값 0.6~1.8배."""
    if len(rows) < 3: return rows, 0
    m = med([_unit(x, b) for x in rows])
    if b == 'v':
        k = [x for x in rows if .6 * m <= _unit(x, b) <= 1.8 * m]
        return k, len(rows) - len(k)
    k = []
    for x in rows:   # 같은 기간 같은 면적대가 먼저(값이 빠르게 오른 단지), 3건 미만이면 ref(더 긴 기간)
        band = [_unit(y, b) for y in rows if abs(y[3] - x[3]) <= 10]
        if len(band) < 3 and ref: band = [_unit(y, b) for y in ref if abs(y[3] - x[3]) <= 10]
        if len(band) >= 3:
            mb = med(band)
            if .75 * mb <= _unit(x, b) <= 1.35 * mb: k.append(x)
        elif .6 * m <= _unit(x, b) <= 1.8 * m: k.append(x)
    return k, len(rows) - len(k)
def headline(s, r):
    in24 = [x for x in s if x[0] >= HD24]
    n_i = sum(1 for x in in24 if x[1] == 3); n_a = sum(1 for x in in24 if x[1] == 2 and x[3] > 0); n_v = sum(1 for x in in24 if x[1] in (0, 1))
    if r.get('s', 0) >= 8 and n_i: b = 'i'
    elif n_a and ('재건축' in (r.get('k') or '') or not n_v or n_a >= 3 * n_v): b = 'a'   # 아파트 거래가 빌라·단독의 3배 이상이면 아파트 기준
    else: b = 'v'
    rows = [x for x in s if _okrow(x, b)]
    if not rows:   # 빌라·단독 대지면적이 없는 경우 등: 있는 쪽으로
        for b in ('a', 'i'):
            rows = [x for x in s if _okrow(x, b)]
            if rows: break
    if not rows: return None
    xn = 0
    if b == 'v':
        # 빌라·단독 대지 3.3㎡당: 대지 10㎡ 미만(지분 잡음)·2016년 이후 신축(쪼개기·신축 프리미엄)은 구축 대지 시세가 아니라 뺀다(남는 거래가 3건 이상일 때)
        rv = [x for x in rows if x[4] >= 10 and not (x[2] and x[2] >= 2016)]
        if len(rv) >= 3: xn = sum(1 for x in rows if x[0] >= HD24) - sum(1 for x in rv if x[0] >= HD24); rows = rv
        # 분기마다 가운데 값(3건 미만 분기는 최근 12개 분기 전체 가운데 값)의 0.6~1.8배 밖 제외 — 차트와 큰 숫자가 같은 행을 쓴다
        win = [x for x in rows if _q_idx(x[0]) >= HDQ0]
        if len(win) >= 3:
            mall = med([_unit(x, b) for x in win]); byq = collections.defaultdict(list)
            for x in win: byq[_q_idx(x[0])].append(x)
            keep = set()
            for L in byq.values():
                m = med([_unit(x, b) for x in L]) if len(L) >= 3 else mall
                keep |= {tuple(x) for x in L if .6 * m <= _unit(x, b) <= 1.8 * m}
            dq = [x for x in win if tuple(x) not in keep]
            rows = [x for x in rows if _q_idx(x[0]) < HDQ0 or tuple(x) in keep]
        else: dq = []
    ref = [x for x in rows if x[0] >= HD24]   # 면적대 비교 기준(아파트·입주권)
    used, xo, w = _filt([x for x in rows if x[0] >= HD12], b, ref) + (12,)
    if len(used) < 3: used, xo, w = _filt([x for x in rows if x[0] >= HD24], b, ref) + (24,)
    if not used:
        last = max(rows, key=lambda x: x[0]); used, xo, w = [last], 0, 0
        if b != 'v':   # 단 1건이라도 같은 면적대 시세와 크게 다르면 그다음 거래
            ok, _ = _filt(rows, b, rows)
            if ok: used = [max(ok, key=lambda x: x[0])]
    used = sorted(used, key=lambda x: x[0], reverse=True)
    if b == 'v' and w: xo += sum(1 for x in dq if x[0] >= (HD12 if w == 12 else HD24))   # 분기 기준으로 뺀 거래도 '시세와 크게 다른' 건수에
    qq = collections.defaultdict(list)
    for x in rows:
        if _q_idx(x[0]) >= HDQ0: qq[q_of(x[0])].append(x)
    qref = [x for x in rows if _q_idx(x[0]) >= HDQ0]
    q = []
    uset = {tuple(x) for x in used}; u0 = used[-1][0] if w else '99999999'
    for k in sorted(qq):   # 머리글 기간 안 거래는 머리글이 남긴 거래만(차트와 큰 숫자가 같은 거래를 본다), 그 전 분기는 분기마다 걸러서
        inw = [x for x in qq[k] if x[0] >= u0]; v = [x for x in inw if tuple(x) in uset]
        v += _filt([x for x in qq[k] if x[0] < u0], b, qref)[0]
        if v: q.append([k, round(med([_unit(x, b) for x in v])), len(v)])
    h = {'b': b, 'u': round(med([_unit(x, b) for x in used])), 'w': w, 'n': len(used), 'xo': xo, 'from': used[-1][0], 'to': used[0][0],
         'p': round(med([x[5] for x in used])), 'pa': round(med([x[3] for x in used]), 1), 'q': q, 'r': [x[:7] for x in used[:5]]}
    if xn: h['xn'] = xn   # 2016년 이후 신축·대지 10㎡ 미만이라 뺀 거래(최근 24개월)
    if w == 0 and used[0][0] < HD12: h['st'] = 1   # 오래된 거래 1건뿐(원자료 최근 계약일 기준 12개월보다 전)
    return h

OUT = {}; DET = {}
for r in R:
    rid = r['id']; t = {}
    s = SALE.get(rid, []); j = JEON.get(rid, [])
    code, jp = parse_j(r)
    if not code and PAR.get(rid, {}).get('p'): code = collections.Counter(p[0][:10] for p in PAR[rid]['p']).most_common(1)[0][0]
    ZCODE[rid] = code
    nobnd = not PAR.get(rid, {}).get('p') or not GEO.get(rid) or GEO[rid].get('e')
    if not s and nobnd and jp and ALLB.get(jp[:15]):   # 공식 경계·필지가 없으면 대표지번 본번으로
        s = ALLB[jp[:15]]; t['m'] = 'jibun'
        if not j and ALLJ.get(jp[:15]): j = ALLJ[jp[:15]]   # 전세도 같은 본번(매매와 같은 범위)
    if not s and nobnd and not jp and '재건축' in (r.get('k') or ''):   # 주소도 경계도 없는 재건축 후보지: 단지 이름으로
        cx = name_match(r)
        if cx:
            s = [list(v) for v in dict.fromkeys(tuple(x) for p in cx['p'] for x in APTR[p])]; t['m'] = 'name'; t['cx'] = cx
            if not code: code = cx['p'][0][:10]; ZCODE[rid] = code
    sv = [x for x in s if x[1] in (0, 1)]                 # 빌라·단독(예전 n 기준)
    sa = [x for x in s if x[1] == 2]                      # 아파트 매매(입주권 제외)
    recent = sorted({x[0] for x in s}, reverse=True)
    cut = (datetime.date.today() - datetime.timedelta(days=550)).strftime('%Y%m%d')
    # 구축 빌라(연립·다세대, 전용 20~85㎡)만 — 단독 통매매 제외. 최근 12개월 5건 이상이면 12개월, 아니면 18개월
    cut12z = (datetime.date.today() - datetime.timedelta(days=365)).strftime('%Y%m%d')
    c24i = (datetime.date.today() - datetime.timedelta(days=730)).strftime('%Y%m%d')
    base = [x for x in s if x[1] == 0 and x[2] and x[2] <= 2015 and 20 <= x[3] <= 85]
    cut6z = (datetime.date.today() - datetime.timedelta(days=183)).strftime('%Y%m%d')
    old, nwin = [x for x in base if x[0] >= cut6z], 6
    if len(old) < 10: old, nwin = [x for x in base if x[0] >= cut12z], 12
    if len(old) < 5: old, nwin = [x for x in base if x[0] >= cut], 18
    if len(old) >= 6:   # ㎡당 가격 이상치 제거(사분위 범위 1.5배 밖)
        u = sorted(x[5]/x[3] for x in old); q1, q3 = st.quantiles(u, n=4)[0], st.quantiles(u, n=4)[2]; lo, hi = q1 - 1.5*(q3 - q1), q3 + 1.5*(q3 - q1)
        old = [x for x in old if lo <= x[5]/x[3] <= hi]
    if s:
        pp = [x[5]/x[4]*3.3058 for x in s if x[4] > 0]
        t['n'] = len(s)            # 매매 전체(빌라·단독·아파트·입주권)
        t['nv'] = len(sv)          # 빌라·단독만(예전 n)
        if sv: t['lv'] = max(x[0] for x in sv)   # 빌라·단독 최근 계약일
        t['na'] = len(sa)          # 아파트 매매 수(입주권 제외, 전체 기간)
        ay = collections.Counter(x[2] for x in sa if x[2] >= 2015)
        if ay: t['ay'] = {str(k): v for k, v in sorted(ay.items())}   # 2015년 이후 준공 아파트 매매(준공 뒤 단계 확인용)
        so = [x for x in sa if x[3] >= 20 and 0 < x[2] < 2005]   # 정비 대상인 옛 단지만(2005년 이후 준공 신축 단지 제외 — enrich.py 재건축 단지와 같은 기준)
        ae, aw = [x for x in so if x[0] >= cut12z], 12
        if len(ae) < 3: ae, aw = [x for x in so if x[0] >= c24i], 24
        ae, _ = _filt(ae, 'a', [x for x in so if x[0] >= c24i])
        if len(ae) >= 3:   # 구역 경계 안 아파트 매매(아파트 위주 구역의 매수가 — enrich.py)
            ps = sorted(x[5] for x in ae); qa4 = st.quantiles(ps, n=4)
            t['ae'] = {'n': len(ae), 'med': round(med(ps)), 'p25': round(qa4[0]), 'p75': round(qa4[2]), 'area_med': round(med([x[3] for x in ae]), 1),
                       'yr': collections.Counter(x[2] for x in ae).most_common(1)[0][0], 'last': max(x[0] for x in ae), 'win': aw}
        if sa:   # 아파트 매매: 최근 12개월 가운데 값·건수, 가장 최근 거래가, 분기별 가운데 값
            a12 = [x[5] for x in sa if x[0] >= cut12z]
            t['an'] = len(a12)
            if a12: t['am'] = round(med(a12))
            t['al'] = max(sa, key=lambda x: x[0])[5]
            qa = collections.defaultdict(list)
            for x in sa: qa[q_of(x[0])].append(x[5])
            t['qa'] = [[k, round(med(v)), len(v)] for k, v in sorted(qa.items())]
        si = [x for x in s if x[1] == 3]
        if si:   # 아파트 입주권(착공 뒤 구역 안 거래는 대부분 입주권 — 구축 아파트 매매가와 따로 본다)
            t['ni'] = len(si)   # 입주권 거래 수(전체 기간)
            i12 = [x[5] for x in si if x[0] >= cut12z]; iw = 12
            if len(i12) < 3: i12, iw = [x[5] for x in si if x[0] >= c24i], 24
            if i12: t['im'] = round(med(i12)); t['in'] = len(i12); t['iw'] = iw   # 가운데 값(만원)·건수·기간(개월)
            qi = collections.defaultdict(list)
            for x in si: qi[q_of(x[0])].append(x[5])
            t['qi'] = [[k, round(med(v)), len(v)] for k, v in sorted(qi.items())]
        if old:
            t['no'] = len(old); t['med'] = med([x[5] for x in old]); t['nwin'] = nwin; t['ar'] = round(med([x[3] for x in old]), 1)
            t['ld'] = round(med([x[4] for x in old if x[4] > 0]) or 0, 1)
            t['p25'] = round(st.quantiles([x[5] for x in old], n=4)[0]) if len(old) >= 4 else None
            t['p75'] = round(st.quantiles([x[5] for x in old], n=4)[2]) if len(old) >= 4 else None
        if pp: t['pp'] = round(med(pp))
        ages = {'a': [], 'b': [], 'c': []}
        for x in s:
            if x[4] <= 0 or not x[2]: continue
            age = NOWY - x[2]; ages['a' if age <= 10 else 'b' if age <= 30 else 'c'].append(x[5]/x[4]*3.3058)
        t['age'] = {k: (round(med(v)) if v else None) for k, v in ages.items()}
        t['agn'] = {k: len(v) for k, v in ages.items()}
        qs = collections.defaultdict(list)
        for x in s:
            if x[4] > 0: qs[q_of(x[0])].append(x[5]/x[4]*3.3058)
        t['q'] = [[k, round(med(v)), len(v)] for k, v in sorted(qs.items())]
        t['last'] = recent[0]
        t['split'] = sum(1 for x in s if x[2] and x[2] >= 2016 and 0 < x[4] <= 15)
        # 순위용: 최근 3·12개월 거래 수, 대지지분 3.3㎡당 가격 1년 변화, 최근 3개월 신고가
        c3 = (datetime.date.today() - datetime.timedelta(days=92)).strftime('%Y%m%d')
        c24 = (datetime.date.today() - datetime.timedelta(days=730)).strftime('%Y%m%d')
        t['n3'] = sum(1 for x in s if x[0] >= c3); t['n12'] = sum(1 for x in s if x[0] >= cut12z)
        # 1년 변화: 한 건물에 거래가 몰리거나 두 기간 대지지분 구성이 크게 다르면 계산하지 않는다(구성 변화가 가격 변화로 보이는 것 방지)
        lp = [(x[0], x[5]/x[4]*3.3058, x[4], x[7] if len(x) > 7 else None) for x in s if x[4] >= 5 and x[2] and x[2] <= 2015]
        A_ = [v for v in lp if v[0] >= cut12z]; B_ = [v for v in lp if c24 <= v[0] < cut12z]
        def ok_mix(L):
            ps = collections.Counter(v[3] for v in L)
            return len(L) >= 10 and len(ps) >= 5 and ps.most_common(1)[0][1] / len(L) <= 0.3
        if ok_mix(A_) and ok_mix(B_) and abs(med([v[2] for v in A_]) / med([v[2] for v in B_]) - 1) <= 0.2:
            t['yoy'] = round((med([v[1] for v in A_]) / med([v[1] for v in B_]) - 1) * 100, 1); t['yon'] = [len(A_), len(B_)]
        # 신고가: 대지지분 15㎡ 이상 거래끼리, 2024년 이후 구역 최고가를 3% 넘게 웃돈 최근 3개월 거래(정수 반올림된 대지지분 잡음 방지)
        lq = sorted((d, v) for d, v, ld, _ in lp if ld >= 15)
        hi = [(d, v) for i, (d, v) in enumerate(lq) if d >= c3 and i >= 5 and v > max(w for _, w in lq[:i]) * 1.03]
        hv = [len(hi), hi[-1][0], round(hi[-1][1]), 'l'] if hi else None
        # 아파트: 같은 기준으로 전용 3.3㎡당 가격(전용 20㎡ 이상 매매끼리)
        la = sorted((x[0], x[5]/x[3]*3.3058) for x in sa if x[3] >= 20)
        ha = [(d, v) for i, (d, v) in enumerate(la) if d >= c3 and i >= 5 and v > max(w for _, w in la[:i]) * 1.03]
        hb = [len(ha), ha[-1][0], round(ha[-1][1]), 'a'] if ha else None
        # hi = [건수, 날짜, 3.3㎡당 가격, 기준('l' 빌라 대지지분 · 'a' 아파트 전용)] — 둘 다 있으면 더 최근 것
        h = max([v for v in (hv, hb) if v], key=lambda v: (v[1], v[3] == 'l'), default=None)
        if h: t['hi'] = h
    if old: t['ol'] = max(x[0] for x in old)   # 매수가 표본의 가장 최근 계약일(enrich.py 신뢰도 판정)
    if j:
        # 전세가율·전세 가운데 값은 매매 표본(2015년 이전 준공 구축 빌라)과 같은 연식대 전세만: 신축 전세가 섞이면 갭이 작게 보인다
        jo = [x for x in j if x[1] and x[1] <= 2015]
        if old and jo:
            ym = med([x[2] for x in old]); jb = [x for x in jo if abs(x[1] - ym) <= 10]   # 매매 표본 가운데 준공연도 ±10년
            if len(jb) >= 5: jo = jb
        t['jt'] = len(j)   # 연식 상관없이 전체 전세 수
        if jo:
            t['jn'] = len(jo); t['jm'] = med([x[3] for x in jo]); t['ja'] = round(med([x[2] for x in jo]), 1); t['jy'] = [min(x[1] for x in jo), max(x[1] for x in jo)]
    if rid in PAR:
        rs = [bldRatio[p[0]] for p in PAR[rid]['p'] if p[0] in bldRatio and .15 < bldRatio[p[0]] < 1.1]
        if len(rs) >= 3: t['jr'] = round(med(rs), 3); t['jrn'] = len(rs)
    if t.get('jn', 0) >= 5 and t.get('no', 0) >= 5 and t.get('ja') and t.get('ar') and abs(t['ja'] - t['ar']) / t['ar'] <= 0.3:   # 면적대가 비슷할 때만
        v = (t['jm']/t['ja'])/(t['med']/t['ar'])
        if .08 < v < 1.1: t['jr2'] = round(v, 3)
    if rid in parstat: t['pc'] = parstat[rid]
    if t: OUT[rid] = t
    xt = {k: t[k] for k in ('q', 'qa', 'qi', 'age', 'agn', 'pc') if t.get(k)}
    hd = headline(s, r) if s else None
    if hd:
        xt['hd'] = hd
        OUT.setdefault(rid, t)['hd'] = {k: hd[k] for k in ('b', 'u', 'w', 'n', 'to', 'st') if k in hd}   # 목록·인근 비교용 요약(같은 값)
    if s or j or xt:
        DET[rid] = {'s': [x[:7] for x in sorted(s, key=lambda x: x[0], reverse=True)[:40]], 'j': sorted(j, key=lambda x: x[0], reverse=True)[:20], 'x': xt}
zr = [v.get('jr') or v.get('jr2') for v in OUT.values() if v.get('jr') or v.get('jr2')]
jrz = round(med(zr), 3) if zr else None

# 역전세 지표(자치구): 최근 6개월 연립다세대 전세 갱신계약
cut6 = (datetime.date.today() - datetime.timedelta(days=183)).strftime('%Y%m%d')
RVJ = {}
for g, v in RV.items():
    v = [x for x in v if x[0] >= cut6 and x[2] > 0]
    if len(v) >= 30:
        RVJ[g] = {'n': len(v), 'down': round(sum(1 for x in v if x[1] < x[2]) / len(v) * 100), 'chg': round(med([x[1] / x[2] - 1 for x in v]) * 100, 1)}
# 노후도(직접 계산): 서울도시공간포털 건물 레이어의 경계 안 건축물 전체, 사용승인연도·구조 기준
BP = os.path.join(ROOT, 'pipeline/cache/bldg.json')
BL = json.load(open(BP)) if os.path.exists(BP) else {}
for rid, v in BL.items():
    bs = [b for b in v['b'] if b[1] > 1900]
    # 사용승인연도가 확인된 건물이 20동 미만이거나 절반에 못 미치면 노후도를 내지 않는다(일부만 보고 100%·0%로 보이는 것 방지)
    if len(bs) < 20 or len(bs) < len(v['b']) * 0.5 or rid not in OUT: continue
    for b in v['b']:
        if b[1] > 1900: YR[b[0]] = max(YR.get(b[0], 0), b[1])
    old = sum(1 for b in bs if NOWY - b[1] >= (30 if b[2] == 'R' else 20))
    OUT[rid]['old'] = {'n': len(v['b']), 'k': len(bs), 'pol': round(old / len(bs) * 100), 'p30': round(sum(1 for b in bs if NOWY - b[1] >= 30) / len(bs) * 100),
                       'avg': round(sum(NOWY - b[1] for b in bs) / len(bs), 1), 'new10': sum(1 for b in bs if NOWY - b[1] <= 10)}
# 동 단위 빌라 시세(최근 12개월, 2010년 이전 준공) — 매수가 빈칸 채우기용
cut12 = (datetime.date.today() - datetime.timedelta(days=365)).strftime('%Y%m%d')
DONG = {}
for k, v in dongV.items():
    v = [x for x in v if x[3] >= cut12 and 30 <= x[1] <= 70]
    if len(v) >= 8:
        ps = sorted(x[0] for x in v); q = st.quantiles(ps, n=4)
        DONG[k] = {'n': len(v), 'p25': round(q[0]), 'med': round(med(ps)), 'p75': round(q[2]), 'area_med': round(med([x[1] for x in v]), 1), 'last': max(x[3] for x in v), 'nm': dongName.get(k)}
# 구역 안 매매가 하나도 없으면 같은 법정동 구축 빌라 시세를 참고로만 붙인다(n·n3·순위에는 넣지 않음)
for r in R:
    rid = r['id']; code = ZCODE.get(rid)
    if not code or (OUT.get(rid) or {}).get('n'): continue
    if re.search(r'시장|상가', r['n']): continue   # 시장·상가 정비(enrich.py tag 'mk')는 빌라 시세를 쓰지 않아 참고값도 붙이지 않는다
    dg = DONG.get(code)
    if dg: nb = {'n': dg['n'], 'med': dg['med']}
    else:
        v = [x[0] for x in dongV.get(code, ()) if x[3] >= cut12 and 30 <= x[1] <= 70]
        nb = {'n': len(v), 'med': round(med(v))} if len(v) >= 3 else None
    if nb: OUT.setdefault(rid, {})['nb'] = {'dong': (dongName.get(code) or ('', ''))[1], **nb}
# 단지(지번) 아파트 시세: 최근 12개월
APT = {}
for p, v0 in apt.items():
    v = [x for x in v0 if x[0] >= cut12]
    win = 12
    if len(v) < 3: v, win = v0, 24   # 조합설립 뒤 거래가 드문 재건축 단지: 2024년 이후 전체
    # 머리글(hd)과 같은 이상치 기준: 같은 면적대(전용 ±10㎡) 가운데 값 0.75~1.35배 밖 거래 제외
    _as = lambda L: [[y[0], 2, y[4], y[1], 0, y[2]] for y in L]   # 단지 행 → 구역 거래 행 모양
    keep = {tuple(y) for y in _filt(_as(v), 'a', _as(v0))[0]}
    v = [x for x in v if (x[0], 2, x[4], x[1], 0, x[2]) in keep]
    if len(v) >= (3 if win == 12 else 2):
        by = collections.defaultdict(list)
        for x in v: by[round(x[1])].append(x[2])
        APT[p] = {'n': len(v), 'med': round(med([x[2] for x in v])), 'p25': round(st.quantiles([x[2] for x in v], n=4)[0]), 'p75': round(st.quantiles([x[2] for x in v], n=4)[2]),
                  'area_med': round(med([x[1] for x in v]), 1), 'name': collections.Counter(x[3] for x in v).most_common(1)[0][0], 'yr': collections.Counter(x[4] for x in v).most_common(1)[0][0],
                  'last': max(x[0] for x in v), 'win': win, 'by_area': {str(a): [round(med(ps)), len(ps)] for a, ps in sorted(by.items()) if len(ps) >= 2}}
asof = {'sale': last_sale, 'rent': last_rent}
json.dump({'tx': OUT, 'rvj': RVJ, 'jrz': jrz, 'jr0': round(med(allR), 3) if allR else None, 'asOf': asof, 'dong': DONG, 'apt': APT,
           'dcode': {f"{a}|{b}": c for (a, b), c in DCODE.items()}},
          open(os.path.join(ROOT, 'pipeline/txsum.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
os.makedirs(os.path.join(ROOT, 'public/data'), exist_ok=True)
json.dump(DET, open(os.path.join(ROOT, 'public/data/tx.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
# 구역별 필지 목록(주소로 물건 확인용): [지번, 면적, 지목, 확인된 준공연도]
PD = os.path.join(ROOT, 'public/data/pcl'); os.makedirs(PD, exist_ok=True)
for f in os.listdir(PD): os.remove(os.path.join(PD, f))
def jb(p): return ('산' if p[10] == '2' else '') + str(int(p[11:15])) + (('-' + str(int(p[15:19]))) if int(p[15:19]) else '')
for rid, v in PAR.items():
    if not v['p']: continue
    rows = sorted([[p[0][5:10], jb(p[0]), round(p[1]), p[3], YR.get(p[0], 0)] for p in v['p']], key=lambda x: (x[0], x[1]))
    json.dump({'d': {c: (dongName.get(v['p'][0][0][:5] + c) or ('', ''))[1] for c in {x[0] for x in rows}}, 'p': rows}, open(os.path.join(PD, rid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
_H = [v['x']['hd'] for v in DET.values() if v['x'].get('hd')]
print('hd', len(_H), 'basis', dict(collections.Counter(h['b'] for h in _H)), 'w', dict(collections.Counter(h['w'] for h in _H)), 'xo rows', sum(h['xo'] for h in _H))
print('tx recs', len(OUT), 'entry-able', sum(1 for v in OUT.values() if v.get('no', 0) >= 5), 'det', len(DET), 'dong', len(DONG), 'apt', len(APT), 'jrz', jrz)
