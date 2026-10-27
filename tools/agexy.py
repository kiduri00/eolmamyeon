#!/usr/bin/env python3
"""사이클 2(F8 필지 연식 지도): 구역 안 필지 가운데 점 + 그 필지 건물 사용승인연도 → public/data/age/<id>.json
입력: pipeline/cache/parcels.json(필지 · tools/parcels.py가 가운데 점 [4]위도 [5]경도를 함께 저장) · pipeline/cache/bldg.json(건물 · [PNU, 연도, …])
출력: {"p": [[위도, 경도, 가장 오래된 연도, 가장 새 연도], …], "n": 필지 수, "k": 점 있는 필지 수} — 건물 없는 필지(도로·나대지)는 연도 0
점이 있는 필지가 60% 안 되는 구역은 쓰지 않는다(앱은 지도 대신 연식 분포만 보인다) · 지어내는 값 없음(원자료 그대로)"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p, d=None: json.load(open(os.path.join(ROOT, p), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, p)) else d
PAR = J('pipeline/cache/parcels.json', {}) or {}
BLD = J('pipeline/cache/bldg.json', {}) or {}
OUT = os.path.join(ROOT, 'public/data/age'); os.makedirs(OUT, exist_ok=True)
made = skip = 0; keep = set()
for rid, v in PAR.items():
    ps = v.get('p') or []
    if not ps: continue
    yrs = {}
    for b in (BLD.get(rid) or {}).get('b') or []:
        if len(b) >= 2 and isinstance(b[1], int) and b[1] > 1900:
            a = yrs.setdefault(b[0], [b[1], b[1]]); a[0] = min(a[0], b[1]); a[1] = max(a[1], b[1])
    pts = [[round(p[4], 5), round(p[5], 5)] + (yrs.get(p[0]) or [0, 0]) for p in ps if len(p) >= 6 and isinstance(p[4], (int, float))]
    if len(pts) < 0.6 * len(ps): skip += 1; continue
    s = json.dumps({'p': pts, 'n': len(ps), 'k': len(pts)}, separators=(',', ':'))
    fp = os.path.join(OUT, rid + '.json'); keep.add(rid + '.json')
    if not os.path.exists(fp) or open(fp, encoding='utf-8').read() != s: open(fp, 'w', encoding='utf-8').write(s)
    made += 1
for f in os.listdir(OUT):   # 경계가 바뀌어 점이 모자라게 된 구역의 옛 파일은 지운다
    if f.endswith('.json') and f != 'index.json' and f not in keep: os.remove(os.path.join(OUT, f))
json.dump(sorted(k[:-5] for k in keep), open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))   # 앱이 먼저 받는 목록(없는 구역은 파일을 부르지 않게)
print('agexy', made, 'zones · skip(점 부족)', skip)
