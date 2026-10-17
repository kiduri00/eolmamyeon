#!/usr/bin/env python3
"""토지거래허가 내역(서울부동산정보광장, 국토부 K-Geo 연계 · 최근 62일만 조회됨)을 매일 모아 쌓고, 정비구역 경계 안 필지와 맞춘다.
출력: pipeline/cache/toheo.json(누적 원자료), public/data/toheo.json({asOf, since, z: {구역id: [[허가일, 지번, 지목, 이용목적, 결과], ...]}, gu: {구: [62일 건수, 주거용 건수]}})
허가 1건 = 접수번호별 대표 지번 1개(원자료 설명). 지번이 구역 경계 필지와 같을 때만 그 구역 허가로 센다."""
import json, os, subprocess, datetime, time, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p, d=None: json.load(open(os.path.join(ROOT, p), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, p)) else d
SGG = {'11680': '강남구', '11740': '강동구', '11305': '강북구', '11500': '강서구', '11620': '관악구', '11215': '광진구', '11530': '구로구', '11545': '금천구', '11350': '노원구', '11320': '도봉구', '11230': '동대문구', '11590': '동작구', '11440': '마포구',
       '11410': '서대문구', '11650': '서초구', '11200': '성동구', '11290': '성북구', '11710': '송파구', '11470': '양천구', '11560': '영등포구', '11170': '용산구', '11380': '은평구', '11110': '종로구', '11140': '중구', '11260': '중랑구'}
CP = os.path.join(ROOT, 'pipeline/cache/toheo.json')
C = J('pipeline/cache/toheo.json', {})
today = datetime.date.today(); b = (today - datetime.timedelta(days=61)).strftime('%Y%m%d'); e = today.strftime('%Y%m%d')
ok = 0
for code, gu in SGG.items():
    for k in range(3):
        r = subprocess.run(['curl', '-sS', '-m', '60', '-X', 'POST', 'https://land.seoul.go.kr/land/wsklis/getContractList.do', '-H', 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8',
                            '-H', 'X-Requested-With: XMLHttpRequest', '-H', 'Referer: https://land.seoul.go.kr/land/other/contractStatus.do', '--data', f'sggCd={code}&beginDate={b}&endDate={e}'], capture_output=True, text=True)
        try:
            rows = json.loads(r.stdout).get('result') or []; break
        except Exception: rows = None; time.sleep(3 + 3 * k)
    if rows is None: print('!! 실패', gu); continue
    ok += 1
    for x in rows:
        key = f"{x.get('SGG_CD')}-{x.get('ACC_YEAR')}-{x.get('ACC_NO')}-{x.get('OBJ_SEQNO')}"
        pnu = f"{x.get('LAWD_CD')}{x.get('LAND_GBN') or '1'}{x.get('BOBN')}{x.get('BUBN')}"
        C[key] = [x.get('HNDL_YMD'), pnu, (x.get('ADDRESS') or '').strip(), x.get('JIMOK') or '', x.get('USE_PURP') or '', x.get('JOB_GBN_NM') or '']
    time.sleep(0.5)
if ok < 20: raise SystemExit(f'토지거래허가 조회가 {ok}개 구만 성공 — 이전 자료 유지')
# 2년 넘은 기록은 정리
cut = (today - datetime.timedelta(days=730)).strftime('%Y%m%d')
C = {k: v for k, v in C.items() if v[0] and v[0] >= cut}
json.dump(C, open(CP, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
# 구역 경계 필지와 맞추기
PAR = J('pipeline/cache/parcels.json', {})
p2z = collections.defaultdict(list)
for rid, v in PAR.items():
    for p in v.get('p', []): p2z[p[0]].append(rid)
Z = collections.defaultdict(list); GU = collections.defaultdict(lambda: [0, 0])
c62 = (today - datetime.timedelta(days=62)).strftime('%Y%m%d')
for k, (d, pnu, addr, jm, use, res) in C.items():
    if d >= c62:
        g = SGG.get(k[:5]); GU[g][0] += 1; GU[g][1] += use == '주거용'
    for rid in p2z.get(pnu, []):
        jb = addr.split(' ', 1)[1] if ' ' in addr else addr
        Z[rid].append([f"{d[:4]}-{d[4:6]}-{d[6:]}", jb, jm, use, res])
c30 = (today - datetime.timedelta(days=30)).isoformat()
for rid in list(Z): L = sorted(Z[rid], reverse=True); Z[rid] = {'n': len(L), 'n30': sum(1 for x in L if x[0] >= c30), 'res': sum(1 for x in L if x[3] == '주거용'), 'r': L[:20]}
since = min((v[0] for v in C.values()), default=b)
json.dump({'asOf': today.isoformat(), 'since': f"{since[:4]}-{since[4:6]}-{since[6:]}", 'z': Z, 'gu': GU}, open(os.path.join(ROOT, 'public/data/toheo.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('toheo', len(C), 'records · zones with permits', len(Z), '· top', sorted(((v['n'], k) for k, v in Z.items()), reverse=True)[:8])
