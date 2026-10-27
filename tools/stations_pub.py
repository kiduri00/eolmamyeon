#!/usr/bin/env python3
"""역 좌표를 공공데이터로 맞춘다(스펙 A6 · 라이선스 정리).

원자료: 서울 열린데이터광장 「서울시 역사마스터 정보」(OA-21232, 서울교통공사·서울시 · 공공누리 제1유형: 출처표시, 상업적 이용·변경 가능)
        → pipeline/sources/seoul_station_master.csv (UTF-8로 바꿔 저장한 원본 그대로, 열: 역사_ID,역사명,호선,위도,경도)

예전 좌표는 jhj0517 gist(라이선스 불명) + 위키백과·블로그 보완이었다. 이 도구는 역 이름·노선은 그대로 두고
좌표만 공공데이터 값으로 바꾼다(이름·노선 소속은 사실 정보). 고치는 곳:
  - src/data.json  stations  [이름, lat, lng, [노선], x, y]   ← 가까운 역·도보 N분(enrich.py가 다시 고름)
  - src/shell.html transitData.st [이름, lat, lng, [노선 번호], 허브]  ← 지도 역 점·통근
  - tools/enrich.py · tools/build.py 의 NEW_ST / ST_POS 좌표 글자
공공데이터 역사마스터(운영 중인 역)에 없는 역(아직 개통 전 계획 역)은 '가까운 역' 후보에서 뺀다(PLANNED).
사용:  python3 tools/stations_pub.py            # 고치고 바뀐 내용을 출력
       python3 tools/stations_pub.py --check    # 고치지 않고 차이만(차이가 있으면 exit 1)
"""
import csv, json, math, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'pipeline', 'sources', 'seoul_station_master.csv')
CHECK = '--check' in sys.argv

# 우리 표기 → 역사마스터 표기(이름이 바뀌었거나 원자료 오타)
ALIAS = {'답심리': '답십리', '시가정': '사가정', '구회의사당': '국회의사당', '잠실시내': '잠실새내', '당고개': '불암산',
         '자양': '뚝섬유원지',      # 2025 역 이름 바꿈(자양(뚝섬한강공원)) · 역사마스터 2026.2판은 옛 이름
         '한국항공대': '화전'}      # 2024 역 이름 바꿈 · 역사마스터는 옛 이름
# 역사마스터(운영 중인 역)에 없는 계획 역: 가까운 역 후보에서 뺀다(호재는 hojaeData에서 따로 다룸)
PLANNED = {'샘터공원', '신강일', '신명일', '도당', '원릉'}
# 같은 이름이지만 갈아타는 통로가 없는 다른 역(역사마스터에 노선별 줄로 따로 있음)
DISTINCT = {'신촌', '운정', '양평'}
# 역사마스터 '호선' → 우리 노선 이름
LINE = {'경부선': '1호선', '경원선': '1호선', '경인선': '1호선', '장항선': '1호선', '1호선': '1호선',
        '분당선': '수인분당선', '수인선': '수인분당선', '중앙선': '경의중앙선', '경의중앙선': '경의중앙선',
        '공항철도1호선': '공항철도', '9호선(연장)': '9호선', '신분당선(연장)': '신분당선', '신분당선(연장2)': '신분당선',
        '수도권 광역급행철도': 'GTX-A', '7호선(인천)': '7호선', '김포골드라인': '김포골드라인'}
LN_FIX = {'경의중앙': '경의중앙선', '김포 골드라인': '김포골드라인', '신림역': '신림선'}

def norm(n):
    n = re.sub(r'\s', '', n); n = re.sub(r'\(.*?\)', '', n); n = re.sub(r'역$', '', n)
    return ALIAS.get(n, n)

def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))

jr = lambda v: math.floor(v + 0.5)
def toXY(la, lo):   # tools/build.py NEW_ST와 같은 식(src/data.json 기존 x,y를 0.1 안으로 재현)
    x = jr((2272.72439 * lo - 0.00834955 * la - 288078.866) * 10) / 10; y = jr((-0.0013117628 * lo - 2866.9639 * la + 108107.651) * 10) / 10
    return [int(x) if x == int(x) else x, int(y) if y == int(y) else y]

PUB = collections.defaultdict(list)
for row in csv.DictReader(open(SRC, encoding='utf-8')):
    try: PUB[norm(row['역사명'])].append((float(row['위도']), float(row['경도']), LINE.get(row['호선'], row['호선']), row['역사명'], row['호선']))
    except (ValueError, KeyError): pass

def pick(name, lines, cur):
    """같은 이름 중 우리 노선과 맞는 줄(첫 노선 우선) → 없으면 지금 좌표에서 가장 가까운 줄. 3km 넘게 떨어지면 다른 역으로 보고 버림."""
    c = PUB.get(norm(name))
    if not c: return None
    # 환승역: 우리 노선마다 그 노선 승강장 좌표(지금 좌표에서 3km 안 · 같은 이름 다른 역 거름) → 평균 한 점
    got = []
    for l in dict.fromkeys(LN_FIX.get(l, l) for l in lines):
        m = [p for p in c if p[2] == l and hav(cur, p[:2]) < 3000]
        if m: got.append(min(m, key=lambda p: hav(cur, p[:2])))
    if got:
        # 이름만 같은 다른 역(신촌 2호선 ↔ 경의중앙선 신촌 715m · 운정 GTX ↔ 경의중앙선 3.6km)은 평균하지 않고 첫 노선 것
        if len(got) == 1 or norm(name) in DISTINCT: return got[0]
        return (sum(p[0] for p in got) / len(got), sum(p[1] for p in got) / len(got), got[0][2], got[0][3], '+'.join(p[4] for p in got))
    best = min(c, key=lambda p: hav(cur, p[:2]))
    return best if hav(cur, best[:2]) < 3000 else None

report = {'moved': [], 'missing': [], 'planned_dropped': []}
def fix_list(lst, label, line_names, with_xy):
    out = []
    for s in lst:
        n = s[0]
        if norm(n) in PLANNED and label == 'data.json':
            report['planned_dropped'].append(n); continue
        ls = [line_names[i] for i in s[3]] if line_names else s[3]
        p = pick(n, ls, (s[1], s[2]))
        if not p:
            report['missing'].append(f'{label}:{n}'); out.append(s); continue
        la, lo = round(p[0], 6), round(p[1], 6)
        d = hav((s[1], s[2]), (la, lo))
        if d >= 1: report['moved'].append((round(d), label, n, f'{p[3]} {p[4]}'))
        s = list(s); s[1], s[2] = la, lo
        if with_xy: s[4:6] = toXY(la, lo)
        out.append(s)
    return out

# 1) src/data.json
DP = os.path.join(ROOT, 'src', 'data.json')
raw = open(DP, encoding='utf-8').read()
D = json.loads(raw)
D['stations'] = fix_list(D['stations'], 'data.json', None, True)
# 출처 줄: gist → 역사마스터
for s in D.get('sources', []):
    if 'jhj0517' in s.get('u', ''):
        s['t'] = '서울시 역사마스터 정보(역 좌표 · 서울 열린데이터광장 OA-21232 · 공공누리 제1유형)'
        s['u'] = 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do'
# 2) src/shell.html transitData
SP = os.path.join(ROOT, 'src', 'shell.html')
sh = open(SP, encoding='utf-8').read()
m = re.search(r'(id="transitData">)(.*?)(</script>)', sh, re.S)
T = json.loads(m.group(2))
T['st'] = fix_list(T['st'], 'transitData', T['lines'], False)
T['src'] = '역 좌표: 서울시 역사마스터 정보(서울 열린데이터광장 OA-21232, 공공누리 제1유형)'
sh2 = sh[:m.start(2)] + json.dumps(T, ensure_ascii=False, separators=(',', ':')) + sh[m.end(2):]
# 3) enrich.py · build.py 의 NEW_ST / ST_POS 좌표 글자
def fix_lits(path):
    s = open(path, encoding='utf-8').read()
    def rep(mm):
        n, la, lo = mm.group(2), float(mm.group(3)), float(mm.group(4))
        p = pick(n, re.findall(r"'([^']+)'", mm.group(5) or ''), (la, lo))
        if not p: report['missing'].append(f'{os.path.basename(path)}:{n}'); return mm.group(0)
        d = hav((la, lo), p[:2])
        if d >= 1: report['moved'].append((round(d), os.path.basename(path), n, f'{p[3]} {p[4]}'))
        return f"{mm.group(1)}{round(p[0], 6)}, {round(p[1], 6)}{mm.group(5) or ''}{mm.group(6)}"
    s2 = re.sub(r"(\['([^']+역)', )(3\d\.\d+), (12\d\.\d+)((?:, \[[^\]]*\]))?(\])", rep, s)
    # ST_POS = {'당곡역': (37.4906, 126.9271)}
    def rep2(mm):
        n, la, lo = mm.group(2), float(mm.group(3)), float(mm.group(4))
        p = pick(n, [], (la, lo))
        if not p: return mm.group(0)
        d = hav((la, lo), p[:2])
        if d >= 1: report['moved'].append((round(d), os.path.basename(path) + ' ST_POS', n, f'{p[3]} {p[4]}'))
        return f"{mm.group(1)}{round(p[0], 6)}, {round(p[1], 6)})"
    s2 = re.sub(r"('([^']+역)': \()(3\d\.\d+), (12\d\.\d+)\)", rep2, s2)
    return s, s2

files = {DP: (raw, json.dumps(D, ensure_ascii=False, indent=0)), SP: (sh, sh2)}   # src/data.json은 indent=0 꼴
for f in ('enrich.py', 'build.py'):
    p = os.path.join(ROOT, 'tools', f); files[p] = fix_lits(p)

report['moved'].sort(reverse=True)
print(f"moved {len(report['moved'])} (≥1m) · missing {len(report['missing'])} · planned dropped {len(report['planned_dropped'])}")
for r in report['moved'][:40]: print('  %5dm %-12s %-10s ← %s' % r)
if len(report['moved']) > 40: print(f"  … +{len(report['moved']) - 40}")
print('  missing:', report['missing']); print('  planned dropped:', report['planned_dropped'])
changed = [p for p, (a, b) in files.items() if a != b]
if CHECK: sys.exit(1 if changed else 0)
for p in changed: open(p, 'w', encoding='utf-8').write(files[p][1])
print('wrote', [os.path.relpath(p, ROOT) for p in changed])
