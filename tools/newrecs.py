#!/usr/bin/env python3
"""정보몽땅에 새로 올라온 정비사업장을 자료에 더한다(지역주택·리모델링 제외).
 - 같은 구에서 주소가 같거나 이름이 사실상 같은 기존 레코드가 있으면: 신통 후보지라면 정보몽땅 사업장과 연결, 아니면 중복으로 건너뜀
 - 없으면 새 레코드(id = 'c' + 정보몽땅 사업장 코드)를 만들고, 대표 지번을 연속지적으로 찾아 좌표를 붙인다
출력: pipeline/data.base.json (src/data.json + 새 레코드), pipeline/premium.base.json (src/premium.json + 연결·새 레코드)
"""
import json, os, re, subprocess, urllib.parse, time, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p, d=None: json.load(open(os.path.join(ROOT, p), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, p)) else d
D = J('src/data.json'); P = J('src/premium.json'); C = J('pipeline/cache/cleanup.json', {}); TX = J('pipeline/txsum.json', {})
GEOC = J('pipeline/cache/geocode.json', {})
B = "https://urban.seoul.go.kr/proxy/proxy.jsp?http://98.33.2.225:6080/arcgis/rest/services/UPIS/20200526_WFS/MapServer"
from junk import is_junk   # 이름이 'test'·'테스트'·'임시'뿐인 시험 등록은 뺀다
D['recs'] = [r for r in D['recs'] if not is_junk(r)]
R = D['recs']; known = {v.get('cafe') for v in P.values() if v.get('cafe')}
KIND = {'재건축': '재건축', '재개발(주택정비형)': '재개발', '재개발': '재개발', '재개발(도시정비형)': '도시정비형 재개발', '가로주택정비': '가로주택(모아주택)', '소규모재건축': '소규모재건축', '소규모재개발': '소규모재개발', '재정비촉진': '재개발'}
SR2S = {'정비계획 수립': 1, '안전진단': 1, '안전진단(1차)': 1, '정비구역지정': 2, '추진위원회승인': 3, '조합설립인가': 4, '사업시행자 지정': 4, '사업시행인가': 5, '관리처분인가': 6, '철거': 7, '이주': 7, '철거 및 착공': 8, '착공': 8, '분양': 8, '준공인가': 9, '이전고시': 9, '조합해산': 9, '조합청산': 9, '청산 및 조합해산': 9}
STOP = r'(\(임시\)|\[임시\]|\(가칭\)|^\d+\.\s*|주택|재개발|재건축|정비|사업|조합|설립|추진위원회|구역|아파트|일대|일원|번지|가로주택|소규모|도시정비형|주택정비형|민간|LH참여형|\s)'
norm = lambda s: re.sub(STOP, '', s or '')
def dong(j): m = re.match(r'([가-힣0-9]+?(?:동|가))\s', (j or '') + ' '); return m.group(1) if m else ''
DC = TX.get('dcode', {})
def pnu_of(g, j):
    m = re.match(r'([가-힣0-9]+?(?:동\d*가|동|가))\s*(산\s*)?(\d+)(?:-(\d+))?', j or '')
    if not m: return None
    code = DC.get(f'{g}|{m.group(1)}')
    return f"{code}{'2' if m.group(2) else '1'}{int(m.group(3)):04d}{int(m.group(4) or 0):04d}" if code else None
def geocode(pnu):
    if pnu in GEOC: return GEOC[pnu]
    q = urllib.parse.urlencode({'f': 'json', 'where': f"PNU='{pnu}'", 'outFields': 'PNU', 'returnGeometry': 'true', 'outSR': '4326'})
    for k in range(4):
        r = subprocess.run(['curl', '-sS', '--max-time', '60', f'{B}/1/query?{q}'], capture_output=True, text=True)
        try:
            fs = json.loads(r.stdout).get('features', []); break
        except Exception: time.sleep(3 + 3*k)
    else: return None
    if not fs: GEOC[pnu] = None; return None
    rg = fs[0]['geometry']['rings'][0]
    ll = [round(sum(p[1] for p in rg)/len(rg), 6), round(sum(p[0] for p in rg)/len(rg), 6)]
    GEOC[pnu] = ll; return ll
stat = collections.Counter(); added = []
for cafe, o in C.items():
    row = o.get('row') or {}
    if is_junk(row): stat['junk_skip'] += 1; continue
    if cafe in known or re.search('지역주택|리모델링', row.get('k', '')) or row.get('k') not in KIND: continue
    same = [r for r in R if r['g'] == row['g'] and ((r.get('j') or '') == row['j'] or (norm(r['n']) and norm(r['n']) == norm(row['n'])) or (norm(row['n']) and len(norm(row['n'])) >= 3 and (norm(row['n']) in norm(r['n']) or norm(r['n']) in norm(row['n'])) and (dong(r.get('j') or r['n']) == dong(row['j']) or (r.get('src') == 'sintong' and not r.get('j')))))]
    if same:
        s = same[0]
        if s.get('src') == 'sintong' and not (P.get(s['id']) or {}).get('cafe'):
            P.setdefault(s['id'], {})['cafe'] = cafe; stat['linked_sintong'] += 1
        else: stat['dup_skip'] += 1
        continue
    if row['sr'] not in SR2S: stat['stage_unknown'] += 1; continue
    s = SR2S[row['sr']]
    if s >= 9: stat['done_skip'] += 1; continue
    rid = 'c' + re.sub(r'[^0-9A-Za-z_]', '', cafe)[:24]
    rec = {'id': rid, 'n': re.sub(r'^\d+\.\s*|^\[임시\]\s*|^\(임시\)\s*|^\(가칭\)\s*', '', row['n']), 'g': row['g'], 'j': row['j'], 'k': KIND[row['k']], 'sr': row['sr'], 's': s, 'src': 'official', 'new': 1}
    pnu = pnu_of(row['g'], row['j'])
    ll = geocode(pnu) if pnu else None
    if ll: rec['ll'] = ll
    P[rid] = {'cafe': cafe, 'dt': o.get('dt') or {}}
    R.append(rec); added.append((rid, rec['n'], rec['sr'], bool(ll))); stat['added'] += 1
json.dump(GEOC, open(os.path.join(ROOT, 'pipeline/cache/geocode.json'), 'w'), separators=(',', ':'))
json.dump(D, open(os.path.join(ROOT, 'pipeline/data.base.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(P, open(os.path.join(ROOT, 'pipeline/premium.base.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(dict(stat)); [print(' +', a) for a in added]
