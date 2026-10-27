#!/usr/bin/env python3
"""QA 기준식(F1 신축 쪼개기 위험) — 화면 함수(ZPF.split)와 따로 쓴 셈.
입력(stdin): {구역 id: 권리산정기준일 'YYYY.MM.DD' 또는 null} — 기준일 자체는 시트와 같은 rights()에서 받는다(새 숫자가 아님)
출력: {id: [준공연도 확인 필지, 기준일 뒤, 같은 해, 거래 수, 쪼개기 의심 거래, %]}"""
import json, os, sys, math
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RD = json.load(sys.stdin)
T = json.load(open(os.path.join(ROOT, 'public/data/tx.json'), encoding='utf-8'))
out = {}
for zid, rd in RD.items():
    f = os.path.join(ROOT, 'public/data/pcl', zid + '.json')
    P = json.load(open(f, encoding='utf-8'))['p'] if os.path.exists(f) else []
    ys = [int(x[4] or 0) for x in P if int(x[4] or 0) > 0]
    ry = int(rd[:4]) if rd else None
    after = sum(1 for y in ys if ry and y > ry); same = sum(1 for y in ys if ry and y == ry)
    S = (T.get(zid) or {}).get('s') or []
    txf = sum(1 for v in S if v[2] >= 2016 and 0 < v[4] <= 15)
    pct = math.floor(after / len(ys) * 100 + 0.5) if ry and ys else None
    out[zid] = [len(ys), after, same, len(S), txf, pct]
json.dump(out, sys.stdout, separators=(',', ':'))
