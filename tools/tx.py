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
D = json.load(open(os.path.join(ROOT, 'src/data.json'), encoding='utf-8'))
R = D['recs']
PAR = json.load(open(os.path.join(ROOT, 'pipeline/cache/parcels.json')))
med = lambda a: st.median(a) if a else None
NOWY = datetime.date.today().year

def opencsv(fn):
    raw = open(fn, 'rb').read(4096)
    enc = 'utf-8-sig' if raw.startswith(b'\xef\xbb\xbf') else 'cp949'
    try: raw.decode(enc)
    except UnicodeDecodeError: enc = 'utf-8'
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
last_sale = ''
for fn in A.sale:
    rd, ix = opencsv(fn)
    for x in rd:
        try:
            if x[ix['취소일']].strip(): continue
            if ix.get('권리구분') is not None and x[ix['권리구분']].strip(): continue
            use = x[ix['건물용도']]
            price = int(float(x[ix['물건금액만원']] if '물건금액만원' in ix else x[ix['물건금액']]))
            area = float(x[ix['건물면적㎡']] if '건물면적㎡' in ix else x[ix['건물면적']] or 0)
            land = float((x[ix['토지면적㎡']] if '토지면적㎡' in ix else x[ix['토지면적']]) or 0)
            yr = int(float(x[ix['건축년도']] or 0))
        except Exception: continue
        g, dcode = x[ix['자치구코드']], x[ix['법정동코드']]
        p = pnu(g, dcode, x[ix['지번구분']], x[ix['본번']], x[ix['부번']])
        d = x[ix['계약일']]; last_sale = max(last_sale, d)
        dongName[g + dcode] = (x[ix['자치구명']], x[ix['법정동명']])
        if use == '아파트':
            if p: apt[p].append([d, round(area, 1), price, x[ix['건물명']], yr])
            continue
        if use not in ('연립다세대', '단독다가구'): continue
        rec = [d, 0 if use == '연립다세대' else 1, yr, round(area, 1), round(land, 1), price, x[ix['층']]]
        if p in pnu2rec and yr: YR[p] = max(YR.get(p, 0), yr)
        for rid in pnu2rec.get(p, ()): SALE[rid].append(rec)
        if use == '연립다세대' and area > 0 and yr:
            if yr <= 2010: dongV[g + dcode].append([price, area, land, d])
            if NOWY - yr >= 15: bldS[p].append(price/area)
for k in list(SALE): SALE[k] = [list(t) for t in dict.fromkeys(tuple(x) for x in SALE[k])]
print('sale zones', len(SALE), 'last', last_sale)

# ---- 전세 ----
JEON = collections.defaultdict(list); bldJ = collections.defaultdict(list); last_rent = ''
for fn in A.rent:
    rd, ix = opencsv(fn)
    kse = '지번구분코드' if '지번구분코드' in ix else '지번구분'
    for x in rd:
        try:
            if x[ix['전월세구분']] != '전세' or x[ix['건물용도']] != '연립다세대': continue
            dep = int(float(x[ix['보증금만원']] if '보증금만원' in ix else x[ix['보증금']]))
            area = float((x[ix['임대면적㎡']] if '임대면적㎡' in ix else x[ix['임대면적']]) or 0)
            yr = int(float(x[ix['건축년도']] or 0))
        except Exception: continue
        p = pnu(x[ix['자치구코드']], x[ix['법정동코드']], x[ix[kse]], x[ix['본번']], x[ix['부번']])
        d = x[ix['계약일']]; last_rent = max(last_rent, d)
        for rid in pnu2rec.get(p, ()): JEON[rid].append([d, yr, round(area, 1), dep])
        if p in pnu2rec and yr: YR[p] = max(YR.get(p, 0), yr)
        if area > 0 and yr and NOWY - yr >= 15: bldJ[p].append(dep/area)
for k in list(JEON): JEON[k] = [list(t) for t in dict.fromkeys(tuple(x) for x in JEON[k])]
print('jeonse zones', len(JEON), 'last', last_rent)

bldRatio = {p: med(bldJ[p])/med(bldS[p]) for p in set(bldS) & set(bldJ)}
allR = [v for v in bldRatio.values() if .15 < v < 1.1]

def q_of(d): return f"{d[2:4]}Q{(int(d[4:6]) - 1)//3 + 1}"
OUT = {}; DET = {}
for r in R:
    rid = r['id']; t = {}
    s = SALE.get(rid, []); j = JEON.get(rid, [])
    recent = sorted({x[0] for x in s}, reverse=True)
    cut = (datetime.date.today() - datetime.timedelta(days=550)).strftime('%Y%m%d')
    old = [x for x in s if x[2] and x[2] <= 2015 and x[0] >= cut]
    if s:
        pp = [x[5]/x[4]*3.3058 for x in s if x[4] > 0]
        t['n'] = len(s)
        if old:
            t['no'] = len(old); t['med'] = med([x[5] for x in old]); t['ar'] = round(med([x[3] for x in old]), 1)
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
    if j:
        t['jn'] = len(j); t['jm'] = med([x[3] for x in j]); t['ja'] = round(med([x[2] for x in j]), 1)
    if rid in PAR:
        rs = [bldRatio[p[0]] for p in PAR[rid]['p'] if p[0] in bldRatio and .15 < bldRatio[p[0]] < 1.1]
        if len(rs) >= 3: t['jr'] = round(med(rs), 3); t['jrn'] = len(rs)
    if t.get('jn', 0) >= 5 and t.get('no', 0) >= 5 and t.get('ja') and t.get('ar'):
        v = (t['jm']/t['ja'])/(t['med']/t['ar'])
        if .08 < v < 1.1: t['jr2'] = round(v, 3)
    if rid in parstat: t['pc'] = parstat[rid]
    if t: OUT[rid] = t
    if s or j:
        DET[rid] = {'s': sorted(s, key=lambda x: x[0], reverse=True)[:40], 'j': sorted(j, key=lambda x: x[0], reverse=True)[:20]}
zr = [v.get('jr') or v.get('jr2') for v in OUT.values() if v.get('jr') or v.get('jr2')]
jrz = round(med(zr), 3) if zr else None

# 동 단위 빌라 시세(최근 12개월, 2010년 이전 준공) — 매수가 빈칸 채우기용
cut12 = (datetime.date.today() - datetime.timedelta(days=365)).strftime('%Y%m%d')
DONG = {}
for k, v in dongV.items():
    v = [x for x in v if x[3] >= cut12 and 30 <= x[1] <= 70]
    if len(v) >= 8:
        ps = sorted(x[0] for x in v); q = st.quantiles(ps, n=4)
        DONG[k] = {'n': len(v), 'p25': round(q[0]), 'med': round(med(ps)), 'p75': round(q[2]), 'area_med': round(med([x[1] for x in v]), 1), 'last': max(x[3] for x in v), 'nm': dongName.get(k)}
# 단지(지번) 아파트 시세: 최근 12개월
APT = {}
for p, v0 in apt.items():
    v = [x for x in v0 if x[0] >= cut12]
    win = 12
    if len(v) < 3: v, win = v0, 24   # 조합설립 뒤 거래가 드문 재건축 단지: 2024년 이후 전체
    if len(v) >= (3 if win == 12 else 2):
        by = collections.defaultdict(list)
        for x in v: by[round(x[1])].append(x[2])
        APT[p] = {'n': len(v), 'med': round(med([x[2] for x in v])), 'p25': round(st.quantiles([x[2] for x in v], n=4)[0]), 'p75': round(st.quantiles([x[2] for x in v], n=4)[2]),
                  'area_med': round(med([x[1] for x in v]), 1), 'name': collections.Counter(x[3] for x in v).most_common(1)[0][0], 'yr': collections.Counter(x[4] for x in v).most_common(1)[0][0],
                  'last': max(x[0] for x in v), 'win': win, 'by_area': {str(a): [round(med(ps)), len(ps)] for a, ps in sorted(by.items()) if len(ps) >= 2}}
DCODE = {}
for k, (gu, dn) in dongName.items(): DCODE[(gu, dn)] = k
asof = {'sale': last_sale, 'rent': last_rent}
json.dump({'tx': OUT, 'jrz': jrz, 'jr0': round(med(allR), 3) if allR else None, 'asOf': asof, 'dong': DONG, 'apt': APT,
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
print('tx recs', len(OUT), 'entry-able', sum(1 for v in OUT.values() if v.get('no', 0) >= 5), 'det', len(DET), 'dong', len(DONG), 'apt', len(APT), 'jrz', jrz)
