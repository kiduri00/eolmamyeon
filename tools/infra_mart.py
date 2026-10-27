#!/usr/bin/env python3
"""대형마트 거리(infraData mt · premium inf[4])를 공공데이터로 다시 만든다(스펙 A6 · 나무위키 파생 자료 걷어내기).

예전: 영업 중 지점 목록 = 나무위키 지점 문서(CC BY-NC-SA, 비영리 조건) + 좌표 = OSM.
지금: 영업 중인지 = 「서울시 대규모점포 인허가 정보」(서울 열린데이터광장 OA-16096 · 행정안전부 지방행정 인허가 자료,
      공공누리 제1유형: 출처표시, 상업적 이용·변경 가능) → pipeline/sources/seoul_large_store.csv (UTF-8로 바꾼 원본)
      좌표 = 그 인허가 자료의 좌표(EPSG:5174 → WGS84) 또는 이미 쓰던 OSM 좌표(ODbL, 출처 표기).
규칙(대상 = 이마트·트레이더스·홈플러스·롯데마트(맥스)·코스트코 대형 매장, 예전과 같은 범위):
  1) 인허가 자료에서 '영업/정상'이고 준대규모점포(SSM)가 아닌 줄 중 이름이 위 상표인 곳 → 그 좌표로 추가
  2) 예전 OSM 지점은 반경 200m 안에 영업 중인 대규모점포(업태 무관 — 복합몰·쇼핑센터 안 매장) 줄이 있을 때만 남김
  3) 150m 안 겹침은 하나로(OSM 좌표 우선 = 입구 쪽이라 예전 값과 같게)
구역 기준점은 예전과 같은 pipeline/data.enriched.json 의 ll, 거리는 하버사인 10m 단위. 가장 가까운 매장이 그대로인 구역은 값을 건드리지 않는다.
사용: python3 tools/infra_mart.py [--check]
"""
import csv, json, math, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'pipeline', 'sources', 'seoul_large_store.csv')
CHECK = '--check' in sys.argv
BRAND = re.compile(r'이마트|트레이더스|홈플러스|롯데마트|코스트코')
NOT_BRAND = re.compile(r'이마트24|에브리데이|익스프레스|노브랜드|하이마트|THE FRESH', re.I)

def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))

from pyproj import Transformer
_T = Transformer.from_crs('EPSG:5174', 'EPSG:4326', always_xy=True)

def clean_name(n):
    n = re.sub(r'\(주\)|주식회사|롯데쇼핑|㈜|신세계|삼성테스코|홈플러스테스코|\s+', ' ', n).strip()
    n = re.sub(r'^\s*(롯데마트)\s*', r'\1 ', n); n = re.sub(r'이마트\s*', '이마트 ', n); n = re.sub(r'홈플러스\s*', '홈플러스 ', n)
    n = re.sub(r'코스트코\s*(홀세일|코리아)?\s*', '코스트코 ', n); n = re.sub(r'\s+', ' ', n).strip()
    return n

# 1) 인허가 자료
OPEN = []      # 영업 중 대규모점포(업태 무관) — 복합몰 안 매장 확인용
OPEN_N = set() # 영업 중 상표 매장 이름(좌표 빈칸 줄 포함)
BR = []        # 상표 매장
key = lambda n: re.sub(r'\s|점$', '', n)
for r in csv.DictReader(open(SRC, encoding='utf-8')):
    if not r['영업상태명'].startswith('영업') or r['점포구분명'].strip() == '준대규모점포': continue
    isb = BRAND.search(r['사업장명']) and not NOT_BRAND.search(r['사업장명'])
    nm = clean_name(r['사업장명'])
    if isb and not re.search(r'\S점$', nm):   # 지점 이름이 없는 줄(코스트코코리아 · 홈플러스 주식회사) → 주소의 동 이름
        dong = re.search(r'\(([가-힣0-9]+동)', r['도로명주소']) or re.search(r'([가-힣0-9]+동)\s', r['지번주소'])
        if dong: nm = f"{nm} {dong.group(1).rstrip('동')}점"
    if isb: OPEN_N.add(key(nm))
    x, y = r['좌표정보(X)'].strip(), r['좌표정보(Y)'].strip()
    if not x or not y: continue
    lo, la = _T.transform(float(x), float(y))
    OPEN.append((la, lo, r['사업장명'].strip()))
    if isb: BR.append([nm, round(la, 5), round(lo, 5)])

# 2) 예전 지점(OSM 좌표) — src/premium.json inf[4]
PP = os.path.join(ROOT, 'src', 'premium.json'); praw = open(PP, encoding='utf-8').read(); P = json.loads(praw)
OLD = {}
for v in P.values():
    if isinstance(v, dict) and v.get('inf') and len(v['inf']) > 4 and v['inf'][4]: OLD[v['inf'][4][0]] = v['inf'][4][:3]
kept, dropped = [], []
for n, la, lo in OLD.values():
    near = min(OPEN, key=lambda o: hav((la, lo), o[:2]))
    if hav((la, lo), near[:2]) <= 200 or key(n) in OPEN_N: kept.append([n, la, lo])
    else: dropped.append((n, round(hav((la, lo), near[:2])), near[2]))
MARTS = list(kept); added = []
for b in BR:
    if key(b[0]) in {key(m[0]) for m in MARTS}: continue   # 같은 지점 = 예전 OSM 좌표 그대로
    if all(hav(b[1:], m[1:]) > 150 for m in MARTS): MARTS.append(b); added.append(b)

# 3) 구역마다 가장 가까운 매장
E = {r['id']: r for r in json.load(open(os.path.join(ROOT, 'pipeline', 'data.enriched.json'), encoding='utf-8'))['recs']}
SP = os.path.join(ROOT, 'src', 'shell.html'); sh = open(SP, encoding='utf-8').read()
m = re.search(r'(id="infraData">)(.*?)(</script>)', sh, re.S); I = json.loads(m.group(2))
mi = I['cats'].index('mt')
diff = []
for zid, d in I['z'].items():
    r = E.get(zid)
    if not r or not r.get('ll'): continue
    best = min(MARTS, key=lambda q: hav(r['ll'], q[1:]))
    nd = int(math.floor(hav(r['ll'], best[1:]) / 10 + 0.5) * 10)
    p = P.get(zid)
    old_n = p['inf'][mi][0] if p and p.get('inf') else None
    if old_n == best[0]: continue   # 가장 가까운 매장이 그대로면 거리도 그대로(10.1 이후 구역 좌표가 조금 바뀐 것은 이 정리와 무관 — 섞지 않음)
    diff.append((zid, old_n, d[mi], best[0], nd))
    d[mi] = nd
    if p and p.get('inf'): p['inf'][mi] = [best[0], best[1], best[2]]
I['src']['mart'] = ('이마트·트레이더스·홈플러스·롯데마트·코스트코 대형 매장 · 영업 여부: 서울시 대규모점포 인허가 정보(서울 열린데이터광장 OA-16096, '
                    '공공누리 제1유형, 2026.10 내려받음 · 준대규모점포·이마트24·에브리데이·익스프레스 제외) · 좌표: 인허가 자료 좌표 또는 OpenStreetMap(ODbL)')
I['asOfMart'] = '2026-10-27'
sh2 = sh[:m.start(2)] + json.dumps(I, ensure_ascii=False, separators=(',', ':')) + sh[m.end(2):]
p2 = json.dumps(P, ensure_ascii=False, separators=(',', ':'))
if praw.endswith('\n'): p2 += '\n'

print(f'marts: kept {len(kept)} of {len(OLD)} current (OSM·인허가) · added {len(added)} from 인허가 · dropped {len(dropped)} · total {len(MARTS)}')
for a in added: print('  + ', a[0], a[1], a[2])
for x in dropped: print('  - ', x)
print(f'zones changed {len(diff)} of {len(I["z"])}')
ch = collections.Counter('closer' if b[4] < b[2] else 'farther' if b[4] > b[2] else 'same-dist' for b in diff); print(' ', dict(ch))
for x in sorted(diff, key=lambda x: x[4] - x[2])[:400 if '-v' in sys.argv else 15]: print('   %-6s %s %sm → %s %sm' % x)
if CHECK: sys.exit(1 if (sh2 != sh or p2 != praw) else 0)
open(SP, 'w', encoding='utf-8').write(sh2); open(PP, 'w', encoding='utf-8').write(p2)
BP = os.path.join(ROOT, 'pipeline', 'premium.base.json')   # newrecs.py가 매일 src/premium.json에서 다시 만드는 사본 — 같은 값으로 맞춰 둠
if os.path.exists(BP):
    B = json.load(open(BP, encoding='utf-8'))
    for k, v in B.items():
        if isinstance(v, dict) and v.get('inf') and isinstance(P.get(k), dict) and P[k].get('inf'): v['inf'] = P[k]['inf']
    braw = open(BP, encoding='utf-8').read()
    b2 = json.dumps(B, ensure_ascii=False, separators=(',', ':')) + ('\n' if braw.endswith('\n') else '')
    open(BP, 'w', encoding='utf-8').write(b2)
print('wrote src/shell.html src/premium.json pipeline/premium.base.json')
