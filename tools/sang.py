#!/usr/bin/env python3
"""서울시 상권분석서비스 → public/data/sang.json (지도 '상권'·'학원가' 레이어, 구역 리포트 '주변 상권')
입력: pipeline/raw/sang/area.csv(영역-상권, EPSG:5181 중심점·면적), store.csv(점포-상권, 최신 분기), sales.csv(추정매출-상권)
학원 = 일반교습학원·외국어학원·예술학원·컴퓨터학원 점포 수(스포츠 강습 제외)"""
import csv, json, os, collections, math
from pyproj import Transformer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'pipeline/raw/sang')
def rows(fn):
    f = open(os.path.join(RAW, fn), encoding='cp949', errors='replace')
    r = csv.reader(f); h = next(r); ix = {k: i for i, k in enumerate(h)}
    for x in r: yield ix, x
T = Transformer.from_crs('EPSG:5181', 'EPSG:4326', always_xy=True)
ACAD = {'일반교습학원', '외국어학원', '예술학원', '컴퓨터학원'}
st = collections.Counter(); ac = collections.Counter(); acd = collections.defaultdict(collections.Counter); sal = collections.Counter(); q = ''
for ix, x in rows('store.csv'):
    c = x[ix['상권_코드']]; n = int(x[ix['전체_점포_수']] or 0); q = x[ix['기준_년분기_코드']]
    st[c] += n
    if x[ix['서비스_업종_코드_명']] in ACAD: ac[c] += n; acd[c][x[ix['서비스_업종_코드_명']]] += n
for ix, x in rows('sales.csv'):
    sal[x[ix['상권_코드']]] += float(x[ix['당월_매출_금액']] or 0)
K = {'A': 'a', 'D': 'd', 'R': 'r', 'U': 'u'}   # 골목·발달·전통시장·관광특구
out = []
for ix, x in rows('area.csv'):
    c = x[ix['상권_코드']]
    lng, lat = T.transform(float(x[ix['엑스좌표_값']]), float(x[ix['와이좌표_값']]))
    area = float(x[ix['영역_면적']] or 0)
    out.append([round(lng, 5), round(lat, 5), x[ix['상권_코드_명']], K.get(x[ix['상권_구분_코드']], 'a'), st[c], ac[c], round(sal[c] / 1e8, 1), x[ix['자치구_코드_명']], round(math.sqrt(area / math.pi)), x[ix['행정동_코드_명']].replace('?', '·')])
qq = f"{q[:4]}년 {q[4:]}분기" if q else ''
json.dump({'q': qq, 'f': ['lng', 'lat', 'n', 'k', 'stores', 'acad', 'salesEok', 'gu', 'r', 'dong'], 'items': out}, open(os.path.join(ROOT, 'public/data/sang.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
top = sorted(out, key=lambda x: -x[5])[:8]
print('sang', len(out), qq, 'acad top', [(t[2], t[5], t[7]) for t in top])
