#!/usr/bin/env python3
"""월간 '서울 재개발 리포트' 생성(4호~: 단계 변경 + 내 돈으로 갈 수 있는 곳 + 실거래 + 경매 + 토지거래허가 + 입주 흐름).
사용: python3 tools/report.py 2026-10 [--asof 2026-10-24] [--publish 2026-10-24] [--draft] [--force] [--test]
  · 달이 끝나기 전에 돌리면(또는 --asof) '부분 호'가 된다: 제목·머리에 'M.1–M.D 기준'을 적고 issues.json에 partial을 남긴다.
    다음 달 5일 daily.sh가 같은 달을 다시 돌리면 전체 달 자료로 같은 주소(/report/YYYY-MM)에 덮어쓰고 partial을 지운다(호 번호·첫 발행일 유지).
  · issues.json에 manual(손으로 다듬은 호)이고 partial이 아닌 호는 --force 없이는 다시 쓰지 않는다(7~9월호 보호).
입력: pipeline/data.enriched.json, public/premium.json(dt), pipeline/cache/cleanup.json(최신 추진경과), pipeline/calc.json(계산기 결과),
      public/api/v1/cash.json·zones.json(첫 화면과 같은 '갈 수 있는 곳' 수), pipeline/txsum.json(구역별 분기 실거래), public/data/auction.json(경매),
      pipeline/cache/toheo.json + parcels.json(토지거래허가), public/data/notice.json(고시·공고), public/data/changes.json(단계 변경 감지),
      pipeline/report/checks/YYYY-MM.json(선택: 원문 대조 {"items":[{"id","event","status","url","note","extra":true,"date":null}]}; extra=정보몽땅에 날짜가 아직 없는 건),
      pipeline/report/notes/YYYY-MM.json(선택: 운영자 글 {"asof","lede":[],"zones":{id:[문단]},"comment":[]}; asof가 리포트 기준일과 다르면 '그날 기준 글'이라고 밝힌다)
출력: public/report/YYYY-MM.html, public/report/index.html, public/report/feed.xml, pipeline/report/issues.json, pipeline/report/latest.json(첫 화면 배너용),
      pipeline/report/budget/YYYY-MM.json(다음 호가 견줄 '갈 수 있는 곳' 스냅숏)
"""
import json, os, sys, re, html, argparse, datetime, collections, calendar, statistics as st
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def J(p, d=None):
    fp = os.path.join(ROOT, p)
    try: return json.load(open(fp, encoding='utf-8')) if os.path.exists(fp) else d
    except Exception: return d
ap = argparse.ArgumentParser(); ap.add_argument('ym'); ap.add_argument('--asof'); ap.add_argument('--publish'); ap.add_argument('--draft', action='store_true')
ap.add_argument('--force', action='store_true'); ap.add_argument('--test', action='store_true')
A = ap.parse_args()
YM = A.ym; Y, M = map(int, YM.split('-'))
KST = datetime.timezone(datetime.timedelta(hours=9))
TODAY = datetime.datetime.now(KST).date()
MEND = datetime.date(Y, M, calendar.monthrange(Y, M)[1])
CUT = datetime.date.fromisoformat(A.asof) if A.asof else min(TODAY, MEND)
if CUT < datetime.date(Y, M, 1): raise SystemExit(f'{YM}: 기준일 {CUT}이 달 시작보다 앞')
PARTIAL = CUT < MEND
RNG = f"{M}.1–{M}.{CUT.day}"
SITE = 'https://jaegaebal.alwaysquestions.kr'
_I0 = J('pipeline/report/issues.json', []) or []
OLD = next((i for i in _I0 if i['ym'] == YM), None)
if OLD and OLD.get('manual') and not OLD.get('partial') and not A.force and not A.test:
    print(f'{YM}: 손으로 다듬은 호(manual) — 다시 쓰지 않음(--force로 덮어쓰기)'); raise SystemExit(0)
PUB = A.publish or (OLD or {}).get('pub') or TODAY.isoformat()
MOD = TODAY.isoformat()
D = J('pipeline/data.enriched.json') or J('src/data.json'); R = D['recs']; byId = {r['id']: r for r in R}
PREM = J('public/premium.json', {}); CL = J('pipeline/cache/cleanup.json', {}); CALC = J('pipeline/calc.json', {})
CK = J(f'pipeline/report/checks/{YM}.json', {}) or {}
CHK = {(c['id'], c['event']): c for c in CK.get('items', [])}
NOTES = J(f'pipeline/report/notes/{YM}.json', {}) or {}
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zsample import batchim   # 받침 규칙 한 곳(숫자 끝 '9구'는 받침 없음)
def josa(w, a, b): return w + (a if batchim(w) else b)
esc = lambda s: html.escape(str(s if s is not None else ''), quote=True)
zp = lambda i: os.path.exists(os.path.join(ROOT, 'public/z', i + '.html'))
md = lambda d: f"{int(d[5:7])}.{int(d[8:10])}" if d else ''
eok = lambda v: f"{v:.1f}억"
pct = lambda v: f"{'+' if v > 0 else ''}{v:.1f}%"
EV5 = [('추진위', '추진위원회 승인'), ('구역지정', '정비구역 지정'), ('조합설립', '조합설립인가'), ('사업시행', '사업시행인가'), ('관리처분', '관리처분인가')]
EVX = [('착공', '착공'), ('준공', '준공'), ('시공자', '시공자 선정')]
LAB = dict(EV5 + EVX)
NEXT = {'추진위': '추진위>조합설립', '구역지정': '구역지정>조합설립', '조합설립': '조합설립>사업시행', '사업시행': '사업시행>관리처분', '관리처분': '관리처분>착공'}
LAD2EV = {'추진위원회 승인': '추진위', '정비구역 지정': '구역지정', '조합설립인가': '조합설립', '사업시행인가': '사업시행', '관리처분인가': '관리처분'}
MEAN = {
 '추진위': '조합을 만들기 위한 준비 조직이 구청 승인을 받은 단계예요. 아직 조합이 없어서 사업 일정은 가장 불확실해요.',
 '구역지정': '서울시가 정비구역으로 지정·고시한 단계예요. 원칙적으로 이 날이 권리산정기준일이 돼요(따로 고시한 날이 있으면 그날).',
 '조합설립': '토지등소유자 동의를 모아 조합이 인가된 단계예요. <b>재건축·소규모 정비는 이 인가 뒤에 산 사람은 조합원이 될 수 없어요</b>(도시정비법 제39조②·소규모주택정비법 제24조, 예외 있음). 재개발은 관리처분인가 전까지 매수해도 조합원이 될 수 있어요.',
 '사업시행': '건물 배치·세대수 등 사업계획이 인가된 단계예요. 다음은 분담금이 정해지는 관리처분인가예요.',
 '관리처분': '조합원별 분담금과 새 아파트 배정 계획이 인가된 단계예요. <b>재개발도 이 인가 뒤 매수자는 조합원이 될 수 없어요</b>(2018.1.24 이전 사업시행인가 구역 등 예외).',
}
act = lambda r: not (r['s'] >= 9 or (r.get('dn') and r['s'] < 7))   # 진행 중·중복 아닌 구역(enrich.py와 같은 규칙)
kind = lambda r: 'rebuild' if '재건축' in (r.get('k') or '') else 'small' if re.search('가로|소규모', r.get('k') or '') else 'redev'
# ---- 레코드별 단계 날짜: 정보몽땅 최신 추진경과가 있으면 그것을, 없으면 기존 자료 ----
DT = {}
for r in R:
    d = dict((PREM.get(r['id']) or {}).get('dt') or r.get('dt') or {})
    cafe = (PREM.get(r['id']) or {}).get('cafe')
    if cafe and CL.get(cafe, {}).get('dt'): d.update({k: v for k, v in CL[cafe]['dt'].items() if k not in d})
    DT[r['id']] = d
def short(n):
    n = re.sub(r'\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발)?\s*(정비)?(사업)?\s*(조합|추진위원회|조합설립추진위원회|주민대표회의)?\s*$', '', n).strip()
    return n or n
inm = lambda d, ym=YM: bool(d) and d.startswith(ym) and d <= CUT.isoformat()
ev = [(r, k, DT[r['id']][k]) for r in R for k, _ in EV5 if inm(DT[r['id']].get(k))]
evx = [(r, k, DT[r['id']][k]) for r in R for k, _ in EVX if inm(DT[r['id']].get(k))]
ev.sort(key=lambda x: (x[2], [k for k, _ in EV5].index(x[1])))
# 날짜가 아직 정보몽땅에 없는 단계 변경: ① 원문 대조 파일의 extra ② 매일 알림(changes.json)이 감지한 단계 상승
_have = {(r['id'], k) for r, k, _ in ev}
evn = []   # (r, k, None, 감지일/메모)
for c in CK.get('items', []):
    if c.get('extra') and c['id'] in byId and (c['id'], c['event']) not in _have:
        evn.append((byId[c['id']], c['event'], c.get('date'), c.get('seen') or '')); _have.add((c['id'], c['event']))
for it in (J('public/data/changes.json', {}) or {}).get('items', []):
    if it.get('type') != 'stage' or not inm(it.get('date')) or it['id'] not in byId: continue
    k = LAD2EV.get((it.get('text') or '').split('→')[-1].strip())
    if k and (it['id'], k) not in _have and not DT[it['id']].get(k):
        evn.append((byId[it['id']], k, None, it['date'])); _have.add((it['id'], k))
SAME = {(r['id'], d) for r, k, d in ev if k == '관리처분' and DT[r['id']].get('사업시행') == d}
EVA = ev + [(r, k, d) for r, k, d, _ in evn]
zones = list(dict.fromkeys(r['id'] for r, _, _ in EVA))
kinds = collections.Counter(k for _, k, _ in EVA)
gu = collections.Counter(r['g'] for r, _, _ in EVA)
n_ev = len(EVA)
checked = [CHK.get((r['id'], k)) for r, k, _ in EVA]
n_ok = sum(1 for c in checked if c and c.get('url') and c.get('status') in ('일치', '확인'))
calc = {i: CALC.get(i, {}) for i in zones}
# ---- 10년 통계(인가 5종, 정보몽땅 날짜) ----
allm = collections.Counter(DT[r['id']][k][:7] for r in R for k, _ in EV5 if DT[r['id']].get(k))
base = [allm.get(f'{y}-{m:02d}', 0) for y in range(2016, 2025) for m in range(1, 13)]
avg_base = sum(base) / len(base)
last36 = []; y, m = Y, M
for _ in range(36):
    m -= 1
    if m == 0: y, m = y - 1, 12
    last36.append(allm.get(f'{y}-{m:02d}', 0))
avg36 = sum(last36) / 36
W36 = f"{y}.{m}~{Y if M > 1 else Y - 1}.{M - 1 if M > 1 else 12}"   # 30차: 36개월 창을 글에 밝힌다(호마다 창이 한 달씩 밀려 월평균이 12·13으로 달라 보이던 것)
yearly = [(yy, sum(v for k, v in allm.items() if k.startswith(str(yy)) and (yy < Y or int(k[5:7]) <= M))) for yy in range(2016, Y + 1)]
# ---- 지난달 늦게 올라온 인가(지난 호 발행 뒤 정보몽땅에 등록) ----
py, pm = (Y, M - 1) if M > 1 else (Y - 1, 12); PYM = f'{py}-{pm:02d}'
_pf = os.path.join(ROOT, f'public/report/{PYM}.html')
late = []
if os.path.exists(_pf):
    _ph = open(_pf, encoding='utf-8').read()
    _seen = set(re.findall(r'from=report#([A-Za-z0-9_]+)', _ph))
    late = sorted([(r, k, DT[r['id']][k]) for r in R for k, _ in EV5 if (DT[r['id']].get(k) or '').startswith(PYM) and r['id'] not in _seen], key=lambda x: x[2])
    _pn = (next((i for i in _I0 if i['ym'] == PYM), None) or {}).get('n')
else: _pn = None
# ---- 고시·공고: 신청 → 인가 처리 기간 ----
NT = (J('public/data/notice.json', {}) or {}).get('items', [])
proc = []
for x in NT:
    if x[4] in ('ok', 'chg') and inm(x[0]) and '인가' in x[2] and '신청' not in x[3] and '고시' not in x[3]:
        rq = [y for y in NT if y[1] == x[1] and y[2] == x[2] and y[4] == 'req' and y[0] <= x[0]]
        if rq:
            d0 = max(y[0] for y in rq)
            proc.append((x[0], x[1], x[2], x[3], d0, (datetime.date.fromisoformat(x[0]) - datetime.date.fromisoformat(d0)).days))
proc.sort()
pend = []
for x in NT:
    if x[4] == 'req' and x[0] <= CUT.isoformat() and (CUT - datetime.date.fromisoformat(x[0])).days <= 60:
        if not any(y[1] == x[1] and y[2] == x[2] and y[4] in ('ok', 'chg') and y[0] >= x[0] for y in NT): pend.append(x)
# ---- 내 돈으로 갈 수 있는 곳(첫 화면·API와 같은 판정) ----
CASH = J('public/api/v1/cash.json', {}) or {}; ZN = (J('public/api/v1/zones.json', {}) or {}).get('items', [])
STEP = {s['cash']: s for s in CASH.get('steps', [])}
BUD = [1, 2, 3, 5]
gapN = lambda z, c: not z.get('lowConfidence') and z['need']['gap']['eligible'] and z['need']['gap']['now'] is not None and z['need']['gap']['now'] <= c
cashN = lambda z, c: not z.get('lowConfidence') and z['need']['cash']['eligible'] and z['need']['cash']['now'] is not None and z['need']['cash']['now'] <= c
bud = {c: {'gap': (STEP.get(float(c)) or STEP.get(c) or {}).get('gapNow'), 'cash': (STEP.get(float(c)) or STEP.get(c) or {}).get('cashNow'),
           'gapIds': sorted(z['id'] for z in ZN if gapN(z, c)), 'cashIds': sorted(z['id'] for z in ZN if cashN(z, c))} for c in BUD}
for c in BUD:   # API 파일이 없으면 zones.json으로 센다
    if bud[c]['gap'] is None: bud[c]['gap'] = len(bud[c]['gapIds'])
    if bud[c]['cash'] is None: bud[c]['cash'] = len(bud[c]['cashIds'])
ZBY = {z['id']: z for z in ZN}
def stg3(ids):
    c = collections.Counter()
    for i in ids:
        lv = (ZBY[i].get('stage') or {}).get('level') or 0
        c['early' if lv <= 3 else 'jo' if lv == 4 else 'late'] += 1
    return c
PREVB = J(f'pipeline/report/budget/{PYM}.json')
budgu = sorted(((v[0], g) for g, v in ((STEP.get(3.0) or {}).get('byGu') or {}).items() if v[0]), reverse=True)
# ---- 실거래: 구역별 분기 가운데 값(txsum q · 빌라·단독 대지 3.3㎡당, 만원) ----
TS = J('pipeline/txsum.json', {}) or {}; TX = TS.get('tx', {})
qn = lambda d: f"{str(d.year)[2:]}Q{(d.month - 1) // 3 + 1}"
def qprev(q, n=1):
    yy, qq = int(q[:2]), int(q[3])
    for _ in range(n):
        qq -= 1
        if qq == 0: yy, qq = yy - 1, 4
    return f"{yy:02d}Q{qq}"
QC = qn(CUT); Q1 = qprev(QC); Q0 = qprev(QC, 2)
QS = [qprev(QC, i) for i in range(6, -1, -1)]
qlab = lambda q: f"’{q[:2]}.{q[3]}분기"
qcnt = collections.Counter(); guc = collections.defaultdict(list); gun = collections.defaultdict(lambda: [0, 0]); zchg = []
for r in R:
    t = TX.get(r['id'])
    if not t or not act(r) or kind(r) != 'redev' or (t.get('hd') or {}).get('b') != 'v': continue
    q = {x[0]: (x[1], x[2]) for x in t.get('q', [])}
    for k, (u, n) in q.items(): qcnt[k] += n
    if Q0 in q and Q1 in q and q[Q0][1] >= 2 and q[Q1][1] >= 2:
        ch = (q[Q1][0] / q[Q0][0] - 1) * 100
        guc[r['g']].append(ch); gun[r['g']][0] += q[Q0][1]; gun[r['g']][1] += q[Q1][1]; zchg.append((ch, r['id'], q[Q0], q[Q1]))
allch = [c for c, *_ in zchg]
med_all = st.median(allch) if allch else None
n_up = sum(1 for c in allch if c > 0); n_dn = sum(1 for c in allch if c < 0)
gurows = sorted([(st.median(v), g, len(v), gun[g][0], gun[g][1]) for g, v in guc.items() if len(v) >= 5], key=lambda x: -x[0])
SALE_ASOF = (TS.get('asOf') or D.get('txAsOf') or {}).get('sale', '')
sale_md = f"{int(SALE_ASOF[4:6])}.{int(SALE_ASOF[6:8])}" if len(SALE_ASOF) == 8 else ''
# ---- 경매(법원경매정보 · 정비구역 경계 안) ----
AU = J('public/data/auction.json', {}) or {}
AUX = {}
if AU.get('ok'):
    for z, v in (AU.get('byZone') or {}).items():
        for x in v:
            k = (x.get('cs'), x.get('no') or 1)
            if k not in AUX: AUX[k] = (x, set())
            AUX[k][1].add(z)
AL = [v[0] for v in AUX.values()]
au_up = [x for x in AL if not x.get('st')]
au_fs = min((x.get('fs') for x in AL if x.get('fs')), default='')
au_d0 = min((x['date'] for x in AL), default=''); au_d1 = max((x['date'] for x in AL), default='')
def ause(u):
    u = u or ''
    if '아파트' in u: return '아파트'
    if re.search('다세대|연립|빌라', u): return '빌라(다세대·연립)'
    if re.search('단독|다가구', u): return '단독·다가구'
    if re.search('대지|토지|임야|전|답', u): return '땅'
    return '상가·기타'
au_use = collections.Counter(ause(x.get('use')) for x in AL)
au_fail = collections.Counter(min(int(x.get('fail') or 0), 4) for x in AL)
au_jb = sum(1 for x in AL if x.get('jb'))
au_band = collections.Counter('~1억' if x['min'] <= 1e8 else '1~2억' if x['min'] <= 2e8 else '2~3억' if x['min'] <= 3e8 else '3억 넘음' for x in au_up)
au_gu = collections.Counter((x.get('addr') or '').split(' ')[0] for x in AL)
au_z = collections.Counter(z for _, zs in AUX.values() for z in zs if z in byId)
au_rate = st.median([x['rate'] for x in AL]) if AL else None
nym = f"{Y + (M == 12)}-{(M % 12) + 1:02d}"
au_next = collections.Counter(x['date'] for x in au_up if x['date'].startswith(nym))
au_cur = collections.Counter(x['date'] for x in au_up if x['date'].startswith(YM))
au_low = sorted([x for x in AL if int(x.get('fail') or 0) >= 3], key=lambda x: x['rate'])
# ---- 토지거래허가(서울부동산정보광장 · 최근 62일 조회분 누적) ----
TH = J('pipeline/cache/toheo.json', {}) or {}
SGG = {'11680': '강남구', '11740': '강동구', '11305': '강북구', '11500': '강서구', '11620': '관악구', '11215': '광진구', '11530': '구로구', '11545': '금천구', '11350': '노원구', '11320': '도봉구', '11230': '동대문구', '11590': '동작구', '11440': '마포구',
       '11410': '서대문구', '11650': '서초구', '11200': '성동구', '11290': '성북구', '11710': '송파구', '11470': '양천구', '11560': '영등포구', '11170': '용산구', '11380': '은평구', '11110': '종로구', '11140': '중구', '11260': '중랑구'}
th_max = max((v[0] for v in TH.values() if v and v[0]), default='')
th_min = min((v[0] for v in TH.values() if v and v[0]), default='')
th_end = min(CUT.strftime('%Y%m%d'), th_max) if th_max else ''
th_day = int(th_end[6:8]) if th_end else 0
pys, pme = f"{py}{pm:02d}01", f"{py}{pm:02d}{min(th_day, calendar.monthrange(py, pm)[1]):02d}"
cys, cye = f"{Y}{M:02d}01", th_end
th_ok = bool(th_end) and th_min <= pys and th_end.startswith(f"{Y}{M:02d}")
def th_in(a, b): return [(k, v) for k, v in TH.items() if v and a <= v[0] <= b and v[5] == '허가']
th_p = th_in(pys, pme) if th_ok else []; th_c = th_in(cys, cye) if th_ok else []
th_gp = collections.Counter(SGG.get(k[:5]) for k, _ in th_p); th_gc = collections.Counter(SGG.get(k[:5]) for k, _ in th_c)
th_res = sum(1 for _, v in th_c if v[4] == '주거용')
PAR = J('pipeline/cache/parcels.json', {}) or {}
p2z = collections.defaultdict(list)
for rid, v in PAR.items():
    for p in v.get('p', []): p2z[p[0]].append(rid)
th_z = collections.Counter()
for _, v in th_c:
    for rid in set(p2z.get(v[1], [])):
        if rid in byId: th_z[rid] += 1
POL = D.get('policy') or {}
# ---- 입주 흐름: 준공(실적) · 착공 구역의 예상 입주(사이트 추정 가운데 값) ----
jg_y = collections.Counter(DT[r['id']]['준공'][:4] for r in R if DT[r['id']].get('준공') and DT[r['id']]['준공'] <= CUT.isoformat())
cg = [r for r in R if r['s'] == 8 and not r.get('dn')]
cg_y = collections.Counter(((r.get('eta') or {}).get('eMid') or '')[:4] for r in cg)
mg = [r for r in R if r['s'] in (6, 7) and not r.get('dn')]
# ---- 첫 줄 요약·제목 ----
k1 = kinds.most_common(1)[0] if kinds else None
if not EVA: evs = '새 인가 없음'
elif len(kinds) == 1: evs = f"{LAB[k1[0]]} {len(zones)}곳"
else: evs = f"단계 바뀐 곳 {len(zones)}곳"
g3 = bud[3]['gap']
title = f"{M}월 서울 재개발 리포트{f'({RNG} 기준)' if PARTIAL else ''}: {evs}, 전세 끼고 3억 안쪽 {g3}곳"
desc = (f"{Y}년 {M}월{f'({RNG})' if PARTIAL else ''} 서울 정비사업 단계 변경, 1억·2억·3억으로 갈 수 있는 구역 수, 재개발 구역 실거래 3.3㎡당 시세 변화, "
        f"구역 안 경매 {len(AL)}건과 토지거래허가 흐름을 공개 자료로 정리했어요.")
S1 = (f"{RNG} 정보몽땅 기준 단계가 바뀐 구역은 {len(zones)}곳이에요" + (f"({', '.join(f'{LAB[k]} {n}건' for k, n in kinds.most_common())})" if kinds else '') +
      (f". {pm}월분 중 지난 호 뒤에 늦게 올라온 인가도 {len(late)}건 있어요." if late else '.'))
S2 = f"기본 가정(무주택·84㎡)으로 전세 끼고 지금 드는 돈이 1억 안쪽인 곳은 {bud[1]['gap']}곳, 2억 {bud[2]['gap']}곳, 3억 {bud[3]['gap']}곳이에요. 대출 끼고 사면 2억 {bud[2]['cash']}곳, 3억 {bud[3]['cash']}곳이에요."
S3 = (f"재개발 구역 빌라·단독 거래는 {qlab(Q1)} {qcnt[Q1]:,}건으로 {qlab(Q0)}({qcnt[Q0]:,}건)보다 {abs(qcnt[Q1] / qcnt[Q0] * 100 - 100):.0f}% {'적고' if qcnt[Q1] < qcnt[Q0] else '많고'}, 같은 구역끼리 견준 대지 3.3㎡당 가격 변화의 가운데 값은 {pct(med_all)}예요."
      if qcnt.get(Q0) and med_all is not None else '')
SUM3 = [x for x in [S1, S2, S3] if x]
_I = {i['ym']: i['no'] for i in _I0}
no = _I.get(YM) or (max([v for k, v in _I.items() if k < YM] or [0]) + 1)

# ====================================================================== HTML 조각
def src_of(r, k):
    ck = CHK.get((r['id'], k)) or {}
    return (f'<a href="{esc(ck["url"])}" rel="noopener">원문</a>' if ck.get('url') else '<span class="pill p-mute">원문 미확인</span>'), ck
def card(r, k, d, seen=''):
    c = CALC.get(r['id'], {}); s_, ck = src_of(r, k)
    if (r['id'], d) in SAME:
        if not ck.get('url'): ck = dict(CHK.get((r['id'], '사업시행')) or {}); s_ = f'<a href="{esc(ck["url"])}" rel="noopener">원문</a>' if ck.get('url') else s_
        ck = {**ck, 'note': ' · '.join(x for x in [ck.get('note'), '사업시행인가와 같은 날 인가(소규모 정비는 함께 인가되는 경우가 많아요)'] if x)}
    stn = c.get('st'); ow = c.get('owners')
    meta2 = ' · '.join(x for x in [f"토지등소유자 {ow:,.0f}명" if ow else '', f"{stn['n']} 도보 {max(1, round(stn['d'] * 1.3 / 67))}분" if stn else ''] if x)
    nk = NEXT.get(k); nx = D['stats']['large'].get(nk) if nk else None
    kv = []
    if c.get('price') is not None: kv.append(('지금 매수가(실거래 추정)', f"{c['price']:.1f}억"))
    # 28차: 지금 사면 입주권이 없는 곳(win no)은 입주까지 현금을 내지 않는다(앱·/z·api와 같은 '계산 보류')
    if c.get('win') == 'no': kv.append(('입주까지 현금 <small>입주권 없음</small>', '계산 보류'))
    elif c.get('need') is not None: kv.append(('입주까지 현금 <small>발행 당시 시세·현금 매수 가정</small>', f"약 {c['need']:.1f}억"))
    if c.get('p10') is not None: kv.append(('10년 안 준공 가능성', f"{min(97, round(c['p10'] * 100))}%"))
    if nx: kv.append(('다음 인가까지 보통', f"{nx['med']:.1f}년"))
    when = d.replace('-', '.') if d else ('인가일 미등록' + (f' · 단계 변경 감지 {md(seen)}' if seen else ''))
    win = c.get('win'); wt = c.get('winT') or ''
    return f'''<article class="zcard"><div class="zc-h"><h3>{esc(short(r['n']))}</h3><span class="meta">{esc(r['g'])} · {esc(re.sub(r'\(모아주택\)', '', r['k']))}</span></div>
<p class="zc-s"><span class="pill">{LAB[k]}</span> {when} · {s_}</p>{f'<p class="meta">{esc(ck["note"])}</p>' if ck.get('note') else ''}
{f'<p class="meta">{esc(meta2)}</p>' if meta2 else ''}
<div class="zc-k">{''.join(f'<div><span>{a}</span><b>{b}</b></div>' for a, b in kv)}</div>
<p class="zc-bw {'no' if win == 'no' else ''}"><b>{esc(wt)}</b></p><p class="zc-a">{f'<a href="../z/{r["id"]}">구역 페이지</a> · ' if zp(r['id']) else ''}<a href="../?from=report#{r['id']}">내 돈으로 계산</a></p></article>'''
def zlink(i, name=None):
    n = esc(name or short(byId[i]['n'])) if i in byId else esc(name or i)
    return f'<a href="../z/{i}">{n}</a>' if zp(i) else n
def hbars(rows, cls=''):   # rows: (label, value, display) — 막대 길이는 value 비례
    mx = max([v for _, v, _ in rows] or [1]) or 1
    return f'<div class="hbars w {cls}">' + ''.join(f'<div class="hb"><span class="hb-l">{l}</span><span class="hb-t"><i style="width:{max(1, round(v / mx * 100)) if v else 0}%"></i></span><b>{t}</b></div>' for l, v, t in rows) + '</div>'
def svg_pair(rows, a_lab, b_lab, aria):   # 묶은 가로 막대 2개(전세 끼고·대출 끼고)
    W, L, RW = 400, 58, 44; rh = 46; H = len(rows) * rh + 8
    mx = max([max(a, b) for _, a, b in rows] or [1]) or 1; bw = W - L - RW
    o = [f'<svg class="rp-c" viewBox="0 0 {W} {H}" role="img" aria-label="{esc(aria)}">']
    for i, (lab, a, b) in enumerate(rows):
        y = 6 + i * rh
        o.append(f'<text x="0" y="{y + 22}" class="k">{esc(lab)}</text>')
        for j, (v, cl, nm) in enumerate(((a, 'b1', a_lab), (b, 'b2', b_lab))):
            yy = y + j * 18; w = max(2, v / mx * bw) if v else 0
            o.append(f'<rect class="{cl}" x="{L}" y="{yy}" width="{w:.1f}" height="14" rx="3"><title>{esc(lab)} {nm} {v}곳</title></rect><text class="v" x="{L + w + 6:.1f}" y="{yy + 11.5}">{v}곳</text>')
    o.append('</svg>')
    return ''.join(o)
def svg_div(rows, aria):   # 가로 막대(± %): rows (label, value, sub)
    W, L = 400, 70; rh = 26; H = len(rows) * rh + 24
    mx = max([abs(v) for _, v, _ in rows] or [1]) or 1
    half = (W - L - 62) / 2; zx = L + half
    o = [f'<svg class="rp-c" viewBox="0 0 {W} {H}" role="img" aria-label="{esc(aria)}"><line class="gl" x1="{zx:.1f}" x2="{zx:.1f}" y1="0" y2="{H - 18}"/>']
    for i, (lab, v, sub) in enumerate(rows):
        y = 4 + i * rh; w = abs(v) / mx * half
        x = zx if v >= 0 else zx - w
        o.append(f'<text x="0" y="{y + 13}" class="k">{esc(lab)}</text><rect class="{"b1" if v >= 0 else "neg"}" x="{x:.1f}" y="{y + 2}" width="{max(1.5, w):.1f}" height="14" rx="3"><title>{esc(lab)} {pct(v)} · {esc(sub)}</title></rect>')
        o.append(f'<text class="v" x="{W - 2}" y="{y + 13}" text-anchor="end">{pct(v)}</text>')
    o.append(f'<text class="k s" x="{zx:.1f}" y="{H - 4}" text-anchor="middle">0%</text></svg>')
    return ''.join(o)
def svg_cols(rows, aria, hi=None, note_last=False):   # 세로 막대: rows (label, value)
    W, H, B = 400, 200, 174; n = len(rows); bw = (W - 12) / n; mx = max([v for _, v in rows] or [1]) or 1
    o = [f'<svg class="rp-c" viewBox="0 0 {W} {H}" role="img" aria-label="{esc(aria)}"><line class="gl" x1="6" x2="{W - 6}" y1="{B}" y2="{B}"/>']
    for i, (lab, v) in enumerate(rows):
        h = v / mx * 146; x = 6 + i * bw + bw * 0.14; w = bw * 0.72
        cl = 'b1' if (hi is None or i in hi) else 'b2'
        if note_last and i == n - 1: cl = 'b3'
        o.append(f'<rect class="{cl}" x="{x:.1f}" y="{B - h:.1f}" width="{w:.1f}" height="{h:.1f}" rx="3"><title>{esc(lab)} {v:,}</title></rect>'
                 f'<text class="v" x="{x + w / 2:.1f}" y="{B - h - 5:.1f}" text-anchor="middle">{v:,}</text><text class="k" x="{x + w / 2:.1f}" y="{B + 18}" text-anchor="middle">{esc(lab)}</text>')
    o.append('</svg>')
    return ''.join(o)
def tbl(head, rows, cap, compact=False):
    th = ''.join(f'<th{" class=\"n\"" if n else ""}>{h}</th>' for h, n in head)
    tr = ''.join('<tr>' + ''.join(f'<td class="{"n" if head[j][1] else ("t" if j == 0 else "")}" data-l="{esc(re.sub("<[^>]+>", "", head[j][0]))}">{c}</td>' for j, c in enumerate(rw)) + '</tr>' for rw in rows)
    return f'<div class="tw cards{' compact' if compact else ''}" tabindex="0" role="region" aria-label="{esc(cap)}"><table><caption class="sr-only">{esc(cap)}</caption><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'
def notes_block(key):
    v = NOTES.get(key)
    if not v: return ''
    if isinstance(v, str): v = [v]
    return ''.join(f'<p>{p}</p>' for p in v)
NA = NOTES.get('asof')
NOTE_TAG = f'<p class="meta">이 글은 {md(NA)} 자료를 보고 썼어요. 숫자 칸과 그래프는 갱신된 자료로 다시 그렸어요.</p>' if NA and NA != CUT.isoformat() else ''

# ---- 1. 단계 변경 ----
tl = ''.join(f'<li><span class="rp-d">{md(d) if d else "날짜 미등록"}</span><span><b>{zlink(r["id"])}</b> <small class="meta">{esc(r["g"])} · {esc(re.sub(r"\(모아주택\)", "", r["k"]))}</small><br>{LAB[k]} · {src_of(r, k)[0]}</span></li>'
             for r, k, d in sorted(EVA, key=lambda x: (x[2] is None, x[2] or '')))
sec_stage = f'''<h2 id="stage">1. 이달 단계가 바뀐 구역</h2>
<p>{RNG} 사이 정보몽땅 추진경과에 날짜가 붙은 인가는 {len(ev)}건{f"이고, 날짜는 아직 없지만 단계 표시가 바뀐(또는 기사로 확인된) 곳이 {len(evn)}곳이에요" if evn else "이에요"}. 최근 36개월({W36}) 평균이 한 달 약 {round(avg36)}건, 2016~2024년 평균이 {round(avg_base)}건이라{f" 달의 {CUT.day}일까지만 센 것을 감안해도" if PARTIAL else ""} {"조용한 편이에요" if n_ev < avg36 * 0.6 else "평소와 비슷해요" if n_ev < avg36 * 1.2 else "많은 편이에요"}. 정보몽땅에는 인가가 몇 주 늦게 올라오는 일이 잦아서, 이 숫자는 다음 갱신 때 늘 수 있어요.</p>
{f'<ol class="rp-tl">{tl}</ol>' if tl else '<p class="note">기준일까지 정보몽땅에 날짜가 붙은 새 인가가 없어요.</p>'}
{''.join(f'<div class="mean"><h3>{l} <small>{kinds[k]}건</small></h3><p>{MEAN[k]}{(lambda s: f" 서울 사업장 기록으로는 다음 인가까지 <b>가운데 값 {s["med"]:.1f}년</b>, 5년 안에 닿은 비율 {round(s["reach5y"]["rate"] * 100)}%예요.")(D["stats"]["large"][NEXT[k]]) if NEXT.get(k) in D["stats"]["large"] else ""}</p></div>' for k, l in EV5 if kinds.get(k))}
<div class="zcards">{''.join(card(r, k, d) for r, k, d in ev)}{''.join(card(r, k, d, s) for r, k, d, s in evn)}</div>
<p class="meta">카드 숫자는 무주택·현금 매수·84㎡ 신청·비례율 100%로 계산한 추정이에요. 입주권 판정은 사이트 규칙 기준이라 실제 매수 전에는 조합·구청에 꼭 확인하세요.</p>
'''
if late:
    sec_stage += f'''<h3>지난 호 뒤에 늦게 올라온 {pm}월 인가 {len(late)}건</h3>
<p>{pm}월호에 실은 {_pn or "?"}건 말고도, 그 호를 낸 뒤 정보몽땅에 {pm}월 날짜로 {len(late)}건이 더 올라왔어요. {pm}월호 숫자는 그대로 두고 여기에 따로 적어요. 인가 소식을 정보몽땅만 보고 따라가면 2~4주 늦을 수 있다는 뜻이에요.</p>
{tbl([("구역", 0), ("단계", 0), ("인가일(정보몽땅)", 1)], [(f'{zlink(r["id"])} <small class="meta">{esc(r["g"])}</small>', LAB[k], d[5:].replace("-", ".")) for r, k, d in late], f"{pm}월 늦게 등록된 인가", True)}'''
if proc:
    dd = [x[5] for x in proc]
    sec_stage += f'''<h3>신청에서 인가까지 며칠 걸렸나 (변경 인가 포함)</h3>
<p>정보몽땅 고시·공고 목록에서 신청과 인가가 모두 보이는 {len(proc)}건은 {min(dd)}~{max(dd)}일(가운데 값 {st.median(dd):.0f}일)이 걸렸어요. 법정 처리 기한은 30일이에요. 목록은 새 인가와 변경 인가를 '(변경)인가' 한 칸으로 적어서 둘을 나눠 보지는 못했어요. 구청이 서두르는 분위기는 보이지만, 인가 뒤 사업시행계획까지 가는 시간은 여전히 몇 년 단위예요.</p>
{tbl([("구역", 0), ("내용", 0), ("신청", 1), ("인가", 1), ("걸린 날", 1)], [(f'{zlink(x[1])} <small class="meta">{esc(byId[x[1]]["g"]) if x[1] in byId else ""}</small>', esc(x[2]), md(x[4]), md(x[0]), f"{x[5]}일") for x in proc], "신청에서 인가까지 걸린 날")}'''
# ---- 2. 내 돈으로 갈 수 있는 곳 ----
sg = {c: stg3(bud[c]['gapIds']) for c in (1, 2, 3)}
cross = next((c for c in BUD if bud[c]['cash'] > bud[c]['gap']), None)
n_thb = sum(1 for z in ZN if '토지거래허가' in (z['need']['gap'].get('blocked') or ''))
early3 = [i for i in bud[3]['gapIds'] if ((ZBY[i].get('stage') or {}).get('level') or 0) <= 3]
early3_lo = sum(1 for i in early3 if ((ZBY[i].get('completion') or {}).get('p10') or 0) < 0.1)
zero4 = [g for g in ('강남구', '서초구', '송파구', '용산구') if not (((STEP.get(3.0) or {}).get('byGu') or {}).get(g) or [0])[0]]
pr = ''
if PREVB:
    pb = PREVB.get('b', {})
    def mv(c, f):
        a = set(pb.get(str(c), {}).get(f + 'Ids', [])); b = set(bud[c][f + 'Ids'])
        return b - a, a - b
    rows = []
    for c in (1, 2, 3):
        i_, o_ = mv(c, 'gap')
        rows.append((f'{c}억', f"{pb.get(str(c), {}).get('gap', '–')}곳", f"{bud[c]['gap']}곳", ', '.join(zlink(i) for i in sorted(i_)[:6]) + (f' 외 {len(i_) - 6}곳' if len(i_) > 6 else '') or '없음', ', '.join(zlink(i) for i in sorted(o_)[:6]) + (f' 외 {len(o_) - 6}곳' if len(o_) > 6 else '') or '없음'))
    pr = f'<h3>지난 호({md(PREVB.get("asof"))})와 견주면</h3>' + tbl([("전세 끼고", 0), ("지난 호", 1), ("이번 호", 1), ("새로 들어온 곳", 0), ("빠진 곳", 0)], rows, '지난 호와 견준 갈 수 있는 곳')
else:
    pr = f'<p class="note">지난 호 스냅숏이 없어 지난달과 견준 숫자는 넣지 않았어요. 이번 호 숫자({md(CASH.get("updated") or "")} 기준)를 저장해 두고 다음 호부터 견줘요.</p>' if YM != '2026-10' else f'<p class="note">지난달과 견준 숫자는 이번 호에 넣지 않았어요. 첫 화면 계산 방식이 10월 17~20일 사이에 여러 번 바뀌어서(표본 기준·전세 계산 등) 9월 숫자와 바로 견주면 시세 변화가 아니라 계산 방식 변화를 보게 되거든요. 이번 호 숫자({md(CASH.get("updated") or "")} 기준)를 저장해 두고, 다음 호부터 같은 방식끼리 견줘요.</p>'
sec_budget = f'''<h2 id="budget">2. 1억·2억·3억으로 갈 수 있는 곳</h2>
<p>첫 화면 계산기와 같은 기준(무주택·84㎡ 신청·기본 가정)으로 센 숫자예요. <b>전세 끼고</b>는 매수가에서 전세 보증금을 뺀, 지금 손에 있어야 하는 돈이에요. <b>대출 끼고</b>는 전세 없이 사서 주택담보대출을 받는 경우의 지금 드는 돈이에요. 어느 쪽이든 입주 때까지 분담금·이주비 같은 돈이 더 들고, 그건 구역 페이지 '입주까지 현금'에서 따로 봐야 해요.</p>
<div class="chart">{svg_pair([(f'{c}억', bud[c]['gap'], bud[c]['cash']) for c in BUD], '전세 끼고', '대출 끼고', '예산별 갈 수 있는 구역 수')}<p class="rp-lg"><span><i class="b1"></i>전세 끼고</span><span><i class="b2"></i>대출 끼고</span></p></div>
<p>1억으로는 전세 끼고 {bud[1]['gap']}곳, 대출 끼고 {bud[1]['cash']}곳뿐이에요. 2억이 되면 전세 끼고 {bud[2]['gap']}곳으로 {bud[2]['gap'] - bud[1]['gap']}곳이 늘고, 3억이면 {bud[3]['gap']}곳이에요. 대출 끼고는 2억 {bud[2]['cash']}곳, 3억 {bud[3]['cash']}곳{f"으로 {cross}억부터 전세 끼고보다 많아져요" if cross else "이에요"}. 전세 끼고 칸이 생각보다 작은 이유는 따로 있어요. 계산 대상 구역 중 {n_thb}곳이 토지거래허가(아파트 단지 또는 신속통합기획 후보지)에 걸려 실거주 2년 의무가 붙고, 그래서 전세 낀 매수 자체가 안 돼요.</p>
{tbl([("전세 끼고 예산", 0), ("갈 수 있는 곳 · 단계 구성", 0)], [(f'{c}억', f"<b>{bud[c]['gap']}곳</b> · 후보지~추진위 {sg[c]['early']} · 조합설립인가 {sg[c]['jo']} · 사업시행인가 이후 {sg[c]['late']}") for c in (1, 2, 3)], '예산별 단계 구성', True)}
<p>같은 3억 안에서도 단계가 크게 갈려요. 3억 안쪽 {bud[3]['gap']}곳 중 {sg[3]['early']}곳은 아직 후보지·정비계획·추진위 단계예요. 그 {sg[3]['early']}곳 가운데 {early3_lo}곳은 사이트 추정 '10년 안 준공 가능성'이 10%가 안 돼요. 사업시행인가를 넘긴 곳은 {sg[3]['late']}곳뿐이에요. 돈이 맞는 곳을 찾았다면 다음으로 볼 것은 '언제 들어가느냐'예요.</p>
{f'<p>구별로는 3억 전세 끼고 기준 {", ".join(f"{g} {n}곳" for n, g in budgu[:5])} 순이에요.{" " + josa("·".join(g[:-1] for g in zero4), "은", "는") + " 0곳이에요." if zero4 else ""}</p>' if budgu else ''}
{pr}
<p class="cta"><a class="btn" href="/?cash=1&amp;mode=jeonse">1억·전세 끼고 지도</a> <a class="btn" href="/?cash=2&amp;mode=jeonse">2억·전세 끼고 지도</a> <a class="btn" href="/?cash=3&amp;mode=loan">3억·대출 끼고 지도</a></p>
'''
# ---- 3. 실거래 ----
qrows = [(f"’{q[:2]} {q[3]}Q", qcnt.get(q, 0)) for q in QS]
_tt = '값은 올랐어요' if (med_all or 0) > 2 else '값도 내렸어요' if (med_all or 0) < -2 else '값은 제자리였어요'
_tq = '거래는 줄고' if qcnt.get(Q1, 0) < qcnt.get(Q0, 0) else '거래는 늘고'
sec_tx = f'''<h2 id="trade">3. 재개발 구역 실거래: {_tq} {_tt}</h2>
<p>재개발 구역 경계 안(경계 자료가 없는 곳은 대표지번과 같은 본번) 빌라·단독 매매를 구역별로 모은 숫자예요(국토교통부 실거래가, {sale_md} 신고분까지). 실거래는 계약 뒤 30일 안에 신고하면 돼서, 이번 분기({qlab(QC)}) 칸은 아직 절반도 안 찼어요.</p>
<div class="chart">{svg_cols(qrows, '분기별 재개발 구역 빌라·단독 거래 건수', note_last=True)}<p class="meta">진한 칸이 지난 분기까지, 연한 마지막 칸({qlab(QC)})은 {sale_md} 신고분까지의 중간 집계예요.</p></div>
<p>{qlab(Q1)} 거래는 {qcnt[Q1]:,}건으로 {qlab(Q0)} {qcnt[Q0]:,}건보다 {abs(qcnt[Q1] / qcnt[Q0] * 100 - 100):.0f}% {"줄었어요" if qcnt[Q1] < qcnt[Q0] else "늘었어요"}. 마지막 달 말 계약분 일부가 아직 신고 전이라는 걸 감안해도 작은 차이는 아니에요. 값은 어땠을까요. 두 분기 모두 2건 이상 거래가 있었던 {len(allch)}개 구역만 골라 같은 구역끼리 대지 3.3㎡당 가운데 값을 견주면, 오른 곳이 {n_up}곳, 내린 곳이 {n_dn}곳이고 변화율의 가운데 값은 {pct(med_all)}예요.</p>
<div class="chart">{svg_div([(g, v, f"{nz}개 구역 · 거래 {a}→{b}건") for v, g, nz, a, b in gurows], f"구별 재개발 구역 대지 3.3㎡당 가격 변화 {qlab(Q0)}→{qlab(Q1)}")}</div>
<p class="meta">구역을 5곳 이상 견줄 수 있는 구만 넣었어요. 막대 = 그 구 구역들의 변화율 가운데 값({qlab(Q0)}→{qlab(Q1)}). 구역 하나의 분기 거래가 2~10건 정도라 한 건이 값을 크게 흔들 수 있어요.</p>
{tbl([("구", 0), ("견준 구역 · 변화 · 거래 수", 0)], [(g, f"구역 {nz}곳 · <b>{pct(v)}</b> · 거래 {a:,}→{b:,}건") for v, g, nz, a, b in gurows], '구별 실거래 변화', True)}
<p>1억~3억으로 빌라를 보는 사람에게 이 표가 말해 주는 건 두 가지예요. 하나, 이 자료만으로는 '거래가 줄었으니 값도 곧 내리겠지'라고 보기 어려워요. 둘, 거래가 적은 구역일수록 부르는 값과 실제 거래값 차이가 벌어지기 쉬워요. 구역 페이지의 최근 거래 목록에서 같은 면적대 실거래를 먼저 보고 매물 값을 견줘 보세요.</p>
'''
# ---- 4. 경매 ----
fl = [('유찰 없음', au_fail[0]), ('1회', au_fail[1]), ('2회', au_fail[2]), ('3회', au_fail[3]), ('4회 이상', au_fail[4])]
sec_auc = ''
if AL:
    sec_auc = f'''<h2 id="auction">4. 정비구역 안 경매 물건</h2>
<p>법원경매정보에서 정비구역 경계 안 필지와 맞는 물건만 모았어요. {md(au_fs)}부터 매일 모으기 시작해서, 지금 보이는 건 입찰기일 {md(au_d0)}~{md(au_d1)} 물건 {len(AL)}건이에요(사건·물건번호 기준, 겹치는 구역은 한 번만). 이 중 {len(au_up)}건은 아직 입찰 전이고, {sum(1 for x in AL if x.get('st') == 'chk')}건은 기일이 지나 결과를 확인 중, {sum(1 for x in AL if x.get('st') == 'gone')}건은 목록에서 빠졌어요(취하·변경 등).</p>
<div class="kpis"><div class="kpi"><span>물건 수</span><b>{len(AL)}건</b><small>입찰 전 {len(au_up)}건</small></div><div class="kpi"><span>최저가/감정가 가운데 값</span><b>{au_rate:.0f}%</b><small>유찰 1회마다 보통 20%씩 내려가요</small></div><div class="kpi"><span>빌라(다세대·연립)</span><b>{au_use["빌라(다세대·연립)"]}건</b><small>아파트 {au_use["아파트"]} · 단독·다가구 {au_use["단독·다가구"]} · 땅 {au_use["땅"]}</small></div><div class="kpi"><span>지분 물건</span><b>{au_jb}건</b><small>집 전체가 아닌 일부 지분</small></div></div>
<h3>유찰 횟수</h3>
{hbars([(l, v, f"{v}건") for l, v in fl])}
<p>{au_fail[0]}건은 첫 입찰이고, 3번 이상 유찰된 물건이 {au_fail[3] + au_fail[4]}건이에요. 최저가가 감정가의 3분의 1 아래로 내려간 물건도 있는데, 이런 물건은 대개 이유가 있어요. 선순위 임차인 보증금을 낙찰자가 떠안거나, 지분만 나왔거나, 건물이 무허가인 경우가 흔해요. 정비구역 안 물건은 여기에 '이걸 사면 입주권이 나오나'라는 질문이 하나 더 붙어요. 권리산정기준일 뒤에 쪼개진 다세대는 현금청산 대상일 수 있어서 감정가 대비 싸 보이는 게 함정일 수 있어요.</p>
<h3>입찰 전 물건의 최저가</h3>
{hbars([(l, au_band[l], f"{au_band[l]}건") for l in ('~1억', '1~2억', '2~3억', '3억 넘음')])}
<p>입찰 전 {len(au_up)}건 중 최저가 1억 이하가 {au_band["~1억"]}건, 1~2억이 {au_band["1~2억"]}건, 2~3억이 {au_band["2~3억"]}건이에요. 경매는 낙찰가 외에 잔금을 한 번에 내야 하고 경락잔금대출 한도도 따로 따져야 해서, 같은 2억이라도 매매로 전세 끼고 사는 것과 돈이 드는 방식이 달라요.</p>
<p>법원별로는 {", ".join(f"{k.replace('서울', '').replace('지방법원', '지법')} {v}건" for k, v in collections.Counter(x["court"] for x in AL).most_common())}이고, 구별로는 {", ".join(f"{g} {n}건" for g, n in au_gu.most_common(5))} 순이에요. 물건이 많은 구역은 {", ".join(f"{zlink(z)} {n}건" for z, n in au_z.most_common(5))}이에요.</p>
<p class="meta">사건번호·주소는 구역 페이지에서 볼 수 있고, 이 리포트에는 소유자·채무자 등 사람 이름을 싣지 않아요. 입찰 전에는 법원경매정보 원문(매각물건명세서·현황조사서)을 꼭 확인하세요.</p>
'''
# ---- 5. 토지거래허가·규제 ----
sp = POL.get('speculation') or {}; lp = POL.get('landPermit') or {}; lz = (POL.get('landPermitZones') or {}).get('announcements') or []; cb = POL.get('consentBill') or {}
newpol = [a for a in lz if a.get('d', '').startswith(YM)]
thg = sorted(set(th_gc) | set(th_gp), key=lambda g: -(th_gc.get(g, 0)))
sec_th = ''
if th_ok:
    sec_th = f'''<h2 id="permit">5. 토지거래허가와 규제</h2>
<p>서울은 {sp.get("date", "")[:4]}년 {int(sp.get("date", "2000-01-01")[5:7])}월 {int(sp.get("date", "2000-01-01")[8:10])}일부터 25개 구 전체가 투기과열지구이고, {lp.get("date", "")[:4]}년 {int(lp.get("date", "2000-01-01")[5:7])}월 {int(lp.get("date", "2000-01-01")[8:10])}일부터는 아파트(같은 단지 연립·다세대 포함)를 사려면 구청 허가를 받아야 해요. 허가를 받으면 2년은 직접 살아야 해서 전세 끼고 살 수 없어요. 지정 기한은 {lp.get("until", "").replace("-", ".")}이에요(<a href="{esc(lp.get("src", ""))}" rel="noopener">정책브리핑</a>). 신속통합기획 재개발 후보지는 아파트가 아니어도 구역 전체가 허가 대상이에요.</p>
<p>그 허가가 실제로 얼마나 나오는지는 서울부동산정보광장 허가 내역으로 볼 수 있어요. {Y}년 {M}월 1~{th_day}일 서울 전체 허가는 <b>{len(th_c):,}건</b>으로, 지난달 같은 기간({pm}월 1~{min(th_day, calendar.monthrange(py, pm)[1])}일) {len(th_p):,}건과 {"거의 같아요" if abs(len(th_c) / max(1, len(th_p)) - 1) < 0.05 else ("" + pct((len(th_c) / max(1, len(th_p)) - 1) * 100) + " 차이가 나요")}. 이 중 {th_res / max(1, len(th_c)) * 100:.0f}%가 주거용이에요. 허가 건수는 '실거주할 사람이 계약까지 간 건수'에 가까워서, 실거래 신고보다 2~4주 빠른 신호로 볼 수 있어요.</p>
{tbl([("구", 0), (f"{M}월 1~{th_day}일 · {pm}월 같은 기간 · 차이", 0)], [(g, f"<b>{th_gc.get(g, 0):,}건</b> · {th_gp.get(g, 0):,}건 · " + (pct((th_gc.get(g, 0) / th_gp[g] - 1) * 100) if th_gp.get(g) else "–")) for g in thg[:10]], '구별 토지거래허가 건수', True)}
<p class="meta">허가 건수 상위 10개 구. 허가 1건 = 접수번호별 대표 지번 1개(원자료 기준), 결과가 '허가'인 건만 셌어요.</p>
<p>정비구역 경계 안 필지로 좁히면 {M}월 1~{th_day}일 허가는 {sum(th_z.values())}건, 구역으로는 {len(th_z)}곳이에요. 많은 곳은 {", ".join(f"{zlink(z)} {n}건" for z, n in th_z.most_common(5))}이에요.</p>
<p>{f"이달 새 규제 발표: " + " · ".join(esc(a["t"]) for a in newpol) if newpol else f"집핀이 따로 정리해 두는 규제 자료(투기과열지구·토지거래허가·신통/모아타운 허가구역)에는 {M}월에 새로 바뀐 내용이 없어요. 가장 최근 변경은 {lz[-1]['d'][:4] if lz else ''}년 {md(lz[-1]['d']).replace('.', '월 ') + '일' if lz else ''} 발표된 내용이에요({esc(lz[-1]['t']) if lz else ''})."} {f"재개발 조합설립 동의율을 75%에서 70%로 낮추는 도시정비법 개정안은 자료 확인일({cb.get('asOf', '').replace('-', '.')}) 기준 국회 발의 단계라 아직 시행 전이에요." if cb.get('status') else ''}</p>
'''
# ---- 6. 입주 흐름 ----
yrs = [str(y) for y in range(Y - 6, Y + 1)]
sec_sup = f'''<h2 id="supply">6. 입주 흐름: 착공 {len(cg)}곳이 줄 서 있어요</h2>
<p>정비사업으로 새 아파트가 나오는 양을 구역 수로 봤어요. 세대수는 구역마다 자료가 들쭉날쭉해서(착공 구역 {len(cg)}곳 중 {sum(1 for r in cg if (r.get("sm") or {}).get("units"))}곳만 있어요) 이번엔 구역 수만 셌어요.</p>
<div class="chart">{svg_cols([(f"’{y[2:]}", jg_y.get(y, 0)) for y in yrs], "연도별 준공 구역 수", note_last=PARTIAL)}<p class="meta">연도별 준공(정보몽땅 준공인가일) 구역 수, 사이트 자료에 남아 있는 구역 기준. {Y}년은 {RNG.split("–")[1]}까지.</p></div>
<p>지금 착공 단계인 {len(cg)}곳의 예상 입주 시기(사이트 추정 가운데 값, 착공→준공 서울 가운데 값 {D["stats"]["large"].get("착공>준공", {}).get("med", 0):.1f}년 기준)를 해마다 세면 {", ".join(f"{y}년 {n}곳" for y, n in sorted(cg_y.items()) if y)}이에요. 관리처분인가·이주 단계 {len(mg)}곳은 그 뒤를 이어요. 입주가 몰리는 해에는 주변 전세 공급이 늘어 전세가가 눌리기 쉬운데, 전세 끼고 사는 사람에겐 이게 지금 드는 돈을 늘리는 쪽으로 작용해요. 전세가가 10%p 낮아지면 얼마나 달라지는지는 <a href="/guide/jeonse-ratio">전세가율 가이드</a>에 계산해 뒀어요.</p>
'''
# ---- 7. 이달의 구역 ----
def zbox(i, paras):
    r = byId.get(i); z = ZBY.get(i) or {}; c = CALC.get(i, {}); t = TX.get(i, {})
    if not r: return ''
    q = {x[0]: x for x in t.get('q', [])}; qa = {x[0]: x for x in (t.get('qa') or [])}
    kv = [('단계', esc((z.get('stage') or {}).get('label') or r.get('sr') or ''))]
    if c.get('price') is not None: kv.append(('매수가(추정)', eok(c['price'])))
    if c.get('gapOk') and c.get('gapNow') is not None: kv.append(('전세 끼고 지금', eok(c['gapNow'])))
    elif c.get('now') is not None and c.get('cashOk'): kv.append(('대출 끼고 지금', eok(c['now'])))
    if c.get('need') is not None: kv.append(('입주까지 현금', eok(c['need'])))
    if c.get('p10') is not None: kv.append(('10년 안 준공', f"{min(97, round(c['p10'] * 100))}%"))
    if Q1 in q: kv.append((f'{qlab(Q1)} 거래', f"{q[Q1][2]}건 · 3.3㎡ {q[Q1][1]:,}만"))
    elif Q1 in qa: kv.append((f'{qlab(Q1)} 아파트 거래', f"{qa[Q1][2]}건 · {qa[Q1][1] / 1e4:.1f}억"))
    if th_z.get(i): kv.append((f'{M}월 허가', f"{th_z[i]}건"))
    if au_z.get(i): kv.append(('경매 물건', f"{au_z[i]}건"))
    kv.append(('입주권', esc(c.get('winT') or '')))
    return f'''<article class="rp-z"><div class="zc-h"><h3>{zlink(i)}</h3><span class="meta">{esc(r['g'])} {esc(r.get('j') or '')} · {esc(re.sub(r'\(모아주택\)', '', r['k']))}</span></div>
<div class="zc-k">{''.join(f'<div><span>{a}</span><b>{b}</b></div>' for a, b in kv)}</div>{''.join(f'<p>{p}</p>' for p in paras)}
<p class="zc-a">{f'<a href="../z/{i}">구역 페이지</a> · ' if zp(i) else ''}<a href="../?from=report#{i}">내 돈으로 계산</a></p></article>'''
ZN3 = NOTES.get('zones') or {}
sec_zone = (f'<h2 id="zones">7. 이달의 구역 3곳</h2><p>단계가 바뀐 곳 하나, 예산 2억대에서 많이 묻는 곳 하나, 3억 안쪽인데 사업이 많이 진행된 곳 하나를 골랐어요. 좋은 곳을 고른 게 아니라 이번 달 자료에서 눈에 띈 곳이에요.</p>{NOTE_TAG}'
            + ''.join(zbox(i, p if isinstance(p, list) else [p]) for i, p in ZN3.items()) if ZN3 else '')
# ---- 8. 다음 달에 볼 것 ----
nm = (M % 12) + 1
watch = []
if PARTIAL: watch.append(f'<b>이 리포트 갱신</b> · {M}월 전체 자료로 {nm}월 초(5일 자동 갱신)에 같은 주소로 다시 써요. 늦게 올라오는 {M}월 인가가 더해질 거예요.')
if au_cur: watch.append(f'<b>{M}월 남은 경매</b> · {", ".join(f"{md(d)} {n}건" for d, n in sorted(au_cur.items()) if d > CUT.isoformat())} 입찰이 남아 있어요.' if any(d > CUT.isoformat() for d in au_cur) else '')
if au_next: watch.append(f'<b>{nm}월 경매 입찰기일</b> · 지금 잡힌 것만 {sum(au_next.values())}건: ' + ', '.join(f"{md(d)} {n}건" for d, n in sorted(au_next.items())) + '. 새 물건은 매일 더해져요.')
watch.append(f'<b>{qlab(Q1)} 실거래 확정</b> · {qlab(Q1)} 마지막 달 계약분 신고 기한이 끝나면(계약 뒤 30일) 위 거래 건수가 조금 늘어요. 값 변화의 방향이 그대로인지 다음 호에서 다시 봐요.')
if pend: watch.append('<b>인가 신청 중</b> · ' + ', '.join(f"{zlink(x[1])} {esc(x[2])}({md(x[0])} {'주민공람 공고' if '공람' in x[3] else '신청'})" for x in pend[:6]) + '. 고시·공고 목록에 신청·공람만 있고 결과가 아직 없는 건이에요.')
if lp.get('until'):
    u = datetime.date.fromisoformat(lp['until'])
    if 0 <= (u - CUT).days <= 120: watch.append(f'<b>아파트 토지거래허가 기한</b> · 서울 전역 아파트 허가구역 지정 기한이 {lp["until"].replace("-", ".")}이에요. 연장 여부에 따라 전세 끼고 갈 수 있는 곳 수가 크게 달라질 수 있어요.')
stall = []
PK = {2: ('구역지정', '구역지정>조합설립'), 3: ('추진위', '추진위>조합설립'), 4: ('조합설립', '조합설립>사업시행'), 5: ('사업시행', '사업시행>관리처분'), 6: ('관리처분', '관리처분>착공')}
big = sorted([r for r in R if not r.get('dn') and r['s'] < 9 and r.get('src') == 'official' and (r.get('sm') or {}).get('owners')], key=lambda r: -r['sm']['owners'])[:50]
for r in big:
    if r['s'] not in PK: continue
    k, sk = PK[r['s']]; d = DT[r['id']].get(k); s0 = D['stats']['large'].get(sk)
    if not d or not s0: continue
    yrs_ = (CUT - datetime.date.fromisoformat(d)).days / 365.25
    stall.append((yrs_ / s0['med'], yrs_, s0['med'], r, LAB[k]))
stall.sort(key=lambda x: -x[0])
if stall: watch.append('<b>오래 머문 큰 구역</b> · 토지등소유자가 많은 50곳 중 지금 단계에 가장 오래 머문 곳: ' + ', '.join(f'{zlink(r["id"])}({lab} {yy:.1f}년째, 보통 {mm:.1f}년)' for _, yy, mm, r, lab in stall[:3]) + '.')
sec_next = '<h2 id="next">8. 다음 달에 볼 것</h2><ul class="rp-w">' + ''.join(f'<li>{w}</li>' for w in watch if w) + '</ul>'
# ---- 9. 운영자 코멘트 ----
sec_cm = (f'<h2 id="comment">9. 운영자 코멘트</h2>{NOTE_TAG}<div class="rp-cm">{notes_block("comment")}<p class="rp-sig">— 집핀 운영자</p></div>' if NOTES.get('comment') else '')
# ---- 부록: 10년 흐름·기간표 ----
mx = max(v for _, v in yearly) or 1; bw = 390 / len(yearly)
bars = ''.join(f'<rect class="bar{" hi" if yy == Y else ""}" x="{6 + i * bw + 3:.1f}" y="{174 - v / mx * 154:.1f}" width="{bw - 6:.1f}" height="{v / mx * 154:.1f}" rx="3"><title>{yy}년 {v}건</title></rect><text class="lab" x="{6 + i * bw + bw / 2:.1f}" y="{169 - v / mx * 154:.1f}" text-anchor="middle">{v}</text><text class="ax" x="{6 + i * bw + bw / 2:.1f}" y="192" text-anchor="middle">’{str(yy)[2:]}{"*" if yy == Y else ""}</text>' for i, (yy, v) in enumerate(yearly))
dur_rows = [(k.replace(">", " → ").replace("추진위", "추진위원회 승인").replace("구역지정", "정비구역 지정").replace("조합설립", "조합설립인가").replace("사업시행", "사업시행인가").replace("관리처분", "관리처분인가"), f'{v["med"]:.1f}년', f'{round(v["reach5y"]["rate"] * 100)}%', f'{v["p25"]:.1f}~{v["p75"]:.1f}년') for k, v in D['stats']['large'].items()]
sec_app = f'''<h2 id="flow">부록: 10년 흐름과 단계별 기간</h2>
<div class="chart"><svg viewBox="0 0 400 200" role="img" aria-label="연도별 인가 5종 건수"><line class="grid" x1="6" x2="396" y1="174" y2="174"/>{bars}</svg><p class="meta">연도별 인가 5종 건수(정보몽땅 날짜). *{Y}년은 1~{M}월{f" {CUT.day}일" if PARTIAL else ""}까지.</p></div>
{tbl([("단계", 0), ("가운데 값", 1), ("5년 안 도달", 1), ("빠른 25%~느린 25%", 1)], dur_rows, '단계별 걸린 기간')}
<p class="meta">가운데 값·5년 안 도달은 아직 다음 단계에 못 간 구역까지 넣은 생존분석 값이고, 오른쪽 범위는 이미 닿은 구역만 본 값이에요. <a href="../years">우리 동네가 지금 어느 단계인지 고르고 보기 →</a></p>
'''
# ---- 출처 ----
asof_cash = md(CASH.get('updated') or '')
srcs = [('서울시 정비사업 정보몽땅 · 추진경과·고시공고', 'https://cleanup.seoul.go.kr/cleanup/bsnssttus/lscrMainIndx.do', f'{md(D.get("upd") or "")} 수집'),
        ('국토교통부 실거래가(서울 부동산정보광장 공개 자료)', 'https://land.seoul.go.kr/land/rtms/rtmsMultiHouse.do', f'{sale_md} 신고분까지'),
        ('대한민국 법원 법원경매정보', 'https://www.courtauction.go.kr/', f'{md(AU.get("asOf") or "")} 확인'),
        ('서울부동산정보광장 · 토지거래허가 내역', 'https://land.seoul.go.kr/land/other/contractStatus.do', f'{th_end[4:6].lstrip("0")}.{th_end[6:8].lstrip("0")}까지' if th_end else ''),
        ('정책브리핑 · 10·15 주택시장 안정화 대책(투기과열지구·토지거래허가)', lp.get('src') or sp.get('src') or 'https://www.korea.kr', '2025.10.15 발표'),
        ('집핀 계산 엔진(첫 화면·API와 같은 숫자)', '/method', f'{asof_cash} 기준')]
srcs += [(c.get('title') or '원문', c['url'], c.get('checked') or '') for c in CK.get('items', []) if c.get('url') and c.get('title')]
sec_src = '<h2 id="sources">자료와 기준일</h2><ul class="links rp-src">' + ''.join(f'<li><a href="{esc(u)}"{" rel=\"noopener\"" if u.startswith("http") else ""}>{esc(t)}</a>{f" <small class=\"meta\">{esc(d)}</small>" if d else ""}</li>' for t, u, d in srcs) + '</ul>'
toc = ''.join(f'<a href="#{a}">{b}</a>' for a, b in [('stage', '단계 변경'), ('budget', '1억·2억·3억'), ('trade', '실거래'), ('auction', '경매'), ('permit', '토허·규제'), ('supply', '입주 흐름'), ('zones', '이달의 구역'), ('next', '다음 달'), ('comment', '운영자 코멘트')]
              if (a != 'zones' or ZN3) and (a != 'comment' or NOTES.get('comment')) and (a != 'auction' or AL) and (a != 'permit' or th_ok))
STY = '''<style>.rp-c{width:100%;max-width:560px;height:auto;display:block}main .chart svg{max-width:560px}.rp-c text{font-size:12.5px;fill:var(--text-2)}.rp-c .v{fill:var(--text-1);font-weight:700}.rp-c .s{font-size:11px}.rp-c .b1{fill:var(--brand)}.rp-c .b2{fill:var(--gr-A)}.rp-c .b3{fill:var(--brand);opacity:.38}.rp-c .neg{fill:var(--risk-ink)}.rp-c .gl{stroke:var(--divider);stroke-width:1}
.rp-lg{display:flex;flex-wrap:wrap;gap:6px 16px;margin:6px 0 0;font-size:13px;color:var(--text-2)}.rp-lg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px;background:var(--brand)}.rp-lg i.b2{background:var(--gr-A)}
.rp-toc{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 4px}.rp-toc a{display:inline-flex;align-items:center;min-height:34px;padding:0 12px;border-radius:999px;background:var(--surface-2);color:var(--text-1);font-size:13px;font-weight:600;text-decoration:none}
.rp-pt{margin:14px 0;padding:12px 14px;border-radius:12px;border:1px solid var(--border);background:var(--brand-soft);font-size:14px;line-height:1.65}
.rp-tl{list-style:none;margin:12px 0;padding:0;border-left:2px solid var(--divider)}.rp-tl li{display:grid;grid-template-columns:76px 1fr;gap:8px;padding:8px 0 8px 12px;position:relative;line-height:1.55}.rp-tl li:before{content:"";position:absolute;left:-6px;top:15px;width:10px;height:10px;border-radius:50%;background:var(--brand)}.rp-d{font-weight:700;font-variant-numeric:tabular-nums;color:var(--brand)}
.rp-z{margin:14px 0;padding:14px 16px;border:1px solid var(--border);border-radius:14px;background:var(--surface)}.rp-z p{line-height:1.75}.rp-z .zc-k{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
.rp-w{padding-left:18px}.rp-w li{margin:8px 0;line-height:1.7}.rp-cm p{line-height:1.85}.rp-sig{text-align:right;color:var(--text-2)}.rp-src li{margin:4px 0}
.hbars.w .hb{grid-template-columns:96px 1fr 52px}main h2[id]{scroll-margin-top:72px}</style>'''
pd_ = datetime.date.fromisoformat(PUB); md_ = TODAY
by = f"글·정리: 집핀 운영자 · 발행 {pd_.year}년 {pd_.month}월 {pd_.day}일" + (f" · 갱신 {md_.year}년 {md_.month}월 {md_.day}일" if MOD != PUB else '')
ptxt = (f'<div class="rp-pt"><b>{RNG} 기준이에요.</b> {M}월이 아직 끝나지 않아 {M}월 1일~{CUT.day}일 자료로 썼어요. 11월 초 전체 달 기준으로 갱신해요(같은 주소). 늦게 등록되는 인가와 신고 기한이 남은 실거래가 그때 더해져요.</div>'.replace('11월 초', f'{nm}월 초')
        if PARTIAL else (f'<div class="rp-pt">{M}월 전체 자료로 {md_.month}월 {md_.day}일 갱신했어요. 처음 낸 건 {pd_.month}월 {pd_.day}일({md(OLD.get("asof") or "")} 기준)이에요.</div>' if OLD and OLD.get('partial') else ''))
ld = {"@context": "https://schema.org", "@type": "Article", "headline": title[:110], "description": desc, "inLanguage": "ko", "datePublished": PUB, "dateModified": MOD,
      "url": f"{SITE}/report/{YM}", "mainEntityOfPage": f"{SITE}/report/{YM}", "image": f"{SITE}/og.png",
      "author": {"@type": "Person", "name": "집핀 운영자", "url": f"{SITE}/about"}, "publisher": {"@type": "Organization", "name": "집핀", "url": SITE, "logo": f"{SITE}/icon-512.png"}}
body = f'''<main><script type="application/ld+json" id="zp-ld">{json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")}</script>{STY}
<p class="eyebrow">서울 재개발 월간 리포트 · {no}호 · {Y}년 {M}월분{f" ({RNG} 기준)" if PARTIAL else ""}</p>
<h1>{esc(title)}</h1>
<p class="byline">{by}</p>
{ptxt}
<div class="sum3"><b>3줄 요약</b><ol>{''.join(f'<li>{esc(s)}</li>' for s in SUM3)}</ol></div>
<div class="kpis">
<div class="kpi"><span>단계 바뀐 구역</span><b>{len(zones)}곳</b><small>날짜 등록 {len(ev)}건{f" · 미등록 {len(evn)}건" if evn else ""}</small></div>
<div class="kpi"><span>전세 끼고 3억 안쪽</span><b>{bud[3]['gap']}곳</b><small>2억 {bud[2]['gap']} · 1억 {bud[1]['gap']}곳</small></div>
<div class="kpi"><span>재개발 구역 거래 {qlab(Q1)}</span><b>{qcnt[Q1]:,}건</b><small>{qlab(Q0)} {qcnt[Q0]:,}건 · 값 {pct(med_all) if med_all is not None else "–"}</small></div>
<div class="kpi"><span>구역 안 경매</span><b>{len(AL)}건</b><small>입찰 전 {len(au_up)}건</small></div>
</div>
<nav class="rp-toc" aria-label="이 리포트 차례">{toc}</nav>
{f'<h2>이번 호를 읽는 법</h2>{NOTE_TAG}{notes_block("lede")}' if NOTES.get('lede') else ''}
{sec_stage}{sec_budget}{sec_tx}{sec_auc}{sec_th}{sec_sup}{sec_zone}{sec_next}{sec_cm}{sec_app}
<h2>함께 읽기</h2>
<ul class="links"><li><a href="/guide/gap-after-permit">토지거래허가 이후, 전세 끼고 갈 수 있는 정비구역은 얼마나 남았나</a></li><li><a href="/guide/ipjugwon">조합설립인가 뒤에 사도 입주권이 나오나</a></li><li><a href="/guide/jungong">재개발 단계별로 10년 안에 준공될 확률</a></li><li><a href="/guide/bundamgeum">서울 재개발 분담금, 실제로 얼마나 나오나</a></li><li><a href="/guide/gu-cash">자치구별로 입주까지 현금은 얼마나 다를까</a></li><li><a href="/years">재개발 단계별로 몇 년 걸리나</a></li><li><a href="/report/">지난 월간 리포트 모두 보기</a></li></ul>
<div class="cta"><a class="btn primary" href="/?cash=2&amp;mode=jeonse&amp;from=report">2억·전세 끼고로 지도 열기</a><a class="btn" href="/?cash=3&amp;mode=loan&amp;from=report">3억·대출 끼고로 보기</a></div>
{sec_src}
<h2>인용하실 때</h2>
<p class="note">"출처: 집핀 월간 리포트({Y}년 {M}월분{f', {RNG} 기준' if PARTIAL else ''})"로 적고 이 페이지 링크를 붙여 주세요. 숫자 오류는 <a href="../contact">문의하기</a>로 알려 주시면 고쳐요.</p>
<p class="disc">투자 권유가 아닌 공개 자료 정리예요. 인가일은 정보몽땅 등록 기준이고, 원문 링크는 운영자가 기사·고시로 확인한 건에만 붙였어요. 필요한 돈·준공 가능성은 공개 자료와 기본 가정으로 낸 추정이고 예측이 아니에요. 경매 자료에는 사람 이름을 싣지 않아요.</p>
</main>'''
# ---- 머리·꼬리(지난 호 틀) ----
_tf = sorted(f for f in os.listdir(os.path.join(ROOT, 'public/report')) if re.match(r'\d{4}-\d{2}\.html$', f) and f[:7] != YM)
tpl = open(os.path.join(ROOT, 'public/report', _tf[-1] if _tf else '2026-09.html'), encoding='utf-8').read()
head = tpl[:tpl.index('<main>')]; foot = tpl[tpl.index('</main>') + 7:]
T_ = f'{Y}년 {M}월 서울 재개발 리포트{f"({RNG} 기준)" if PARTIAL else ""} | 집핀 - 서울 재개발 지도'
head = re.sub(r'<title>.*?</title>', lambda m: f'<title>{esc(T_)}</title>', head)
head = re.sub(r'(name="description" content=")[^"]*', lambda m: m.group(1) + esc(desc), head)
head = re.sub(r'(property="og:description" content=")[^"]*', lambda m: m.group(1) + esc(desc), head)
head = re.sub(r'(property="og:title" content=")[^"]*', lambda m: m.group(1) + esc(T_), head)
head = re.sub(re.escape(SITE) + r'/report/\d{4}-\d{2}', f'{SITE}/report/{YM}', head)
head = re.sub(r'<script type="application/ld\+json">.*?</script>\n?', '', head, flags=re.S)
head = head.replace('<meta name="robots" content="noindex">\n', '')
if A.draft: head = head.replace('<head>', '<head>\n<meta name="robots" content="noindex">', 1)
if A.test:
    open(os.path.join(ROOT, f'pipeline/report/test_{YM}.html'), 'w', encoding='utf-8').write(head + body + foot)
    print('test written', title); raise SystemExit
open(os.path.join(ROOT, f'public/report/{YM}.html'), 'w', encoding='utf-8').write(head + body + foot)
os.makedirs(os.path.join(ROOT, 'pipeline/report/budget'), exist_ok=True)
json.dump({'asof': CASH.get('updated') or CUT.isoformat(), 'b': {str(c): {k: v for k, v in bud[c].items()} for c in BUD}},
          open(os.path.join(ROOT, f'pipeline/report/budget/{YM}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
# ---- 목록·피드·배너 ----
ISS = [i for i in _I0 if i['ym'] != YM] + [{'ym': YM, 'no': no, 'title': title, 'sum3': SUM3, 'n': n_ev, 'ok': n_ok, 'pub': PUB, 'mod': MOD, 'draft': A.draft,
                                             'partial': PARTIAL, 'asof': CUT.isoformat()}]
ISS.sort(key=lambda i: i['ym'], reverse=True)
json.dump(ISS, open(os.path.join(ROOT, 'pipeline/report/issues.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
pubs = [i for i in ISS if not i.get('draft')]
ym2 = lambda ym: f"{int(ym[:4])}년 {int(ym[5:])}월"
if pubs:
    L = pubs[0]
    if L['ym'] == YM and ev and not PARTIAL:   # 부분 호는 첫 화면 '최근 단계 변경' 배너를 바꾸지 않는다(전체 달 갱신 때 바꿈)
        json.dump({'ym': L['ym'], 'no': L['no'], 'url': f"report/{L['ym']}", 'title': L['title'], 'n': L['n'], 'items': [{'id': r['id'], 'step': k, 'date': d} for r, k, d in ev]},
                  open(os.path.join(ROOT, 'pipeline/report/latest.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    idx = open(os.path.join(ROOT, 'public/report/index.html'), encoding='utf-8').read()
    a, b = idx.index('<main>'), idx.index('</main>')
    ixld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "서울 정비사업 단계 변경 리포트 | 집핀 - 서울 재개발 지도", "description": "매달 서울 정비사업 중 인가 단계가 바뀐 구역을 원문 링크와 함께 정리합니다.",
            "url": f"{SITE}/report/", "inLanguage": "ko", "publisher": {"@type": "Organization", "name": "집핀", "url": SITE, "logo": f"{SITE}/icon-512.png"},
            "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": n + 1, "url": f"{SITE}/report/{i['ym']}"} for n, i in enumerate(pubs)]}}
    sub = lambda i: f"인가 {i['n']}건 · 원문 확인 {i['ok']}건" + (f" · {int(i['asof'][5:7])}.{int(i['asof'][8:10])} 기준" if i.get('partial') else '')
    main = f'''<main><script type="application/ld+json" id="zp-ld">{json.dumps(ixld, ensure_ascii=False)}</script>
<h1>서울 정비사업 단계 변경 리포트</h1>
<a class="rl-hero" href="{L['ym']}"><small>{L['no']}호 · {ym2(L['ym'])}{f" ({int(L['asof'][5:7])}.1–{int(L['asof'][5:7])}.{int(L['asof'][8:10])} 기준)" if L.get('partial') else ''} · 최신</small><b>{esc(L['title'])}</b>
<ol>{''.join(f'<li>{esc(s)}</li>' for s in L['sum3'])}</ol><span class="rl-go">리포트 전체 보기 →</span></a>
<h2>리포트를 만드는 방법</h2>
<p>매달 서울시 정비사업 정보몽땅의 추진경과를 다시 모아, 그달 날짜로 새로 올라온 인가 다섯 가지(추진위원회 승인·정비구역 지정·조합설립인가·사업시행인가·관리처분인가)를 골라요. 한 건씩 기사나 구청·서울시 고시를 찾아 날짜를 맞춰 보고, 찾은 건에는 원문 링크를, 못 찾은 건에는 '원문 미확인'을 붙여요.</p>
<p>4호(2026년 10월분)부터는 같은 달의 실거래(재개발 구역 대지 3.3㎡당 가격·거래 수), 정비구역 안 법원 경매 물건, 토지거래허가 건수, 1억·2억·3억으로 갈 수 있는 구역 수도 함께 정리해요. 달이 끝나기 전에 낸 호는 기준일을 제목에 적고, 다음 달 초 전체 달 자료로 같은 주소에서 갱신해요.</p>
<p>정보몽땅에는 인가가 몇 주 늦게 올라오기도 해서, 지난 호 숫자가 다음 달에 조금 늘 수 있어요. 그런 경우 다음 호에서 따로 밝혀요.</p>
<h2>이번 호 미리 보기</h2>
<ul class="links">{''.join(f'<li><a href="{L["ym"]}#{a}">{b}</a></li>' for a, b in [('stage', '이달 단계가 바뀐 구역'), ('budget', '1억·2억·3억으로 갈 수 있는 곳'), ('trade', '재개발 구역 실거래'), ('auction', '정비구역 안 경매 물건'), ('permit', '토지거래허가와 규제'), ('zones', '이달의 구역 3곳'), ('next', '다음 달에 볼 것')]) if L['ym'] == YM else ''}</ul>
<h2>지난 호</h2><div class="rlist">{''.join(f'<a class="zl" href="{i["ym"]}"><small>{i["no"]}호 · {ym2(i["ym"])}</small><b>{esc(i["title"])}</b><small>{sub(i)}</small></a>' for i in pubs[1:])}</div>
'''
    open(os.path.join(ROOT, 'public/report/index.html'), 'w', encoding='utf-8').write(idx[:a] + main + idx[b:])
    def ftitle(i):
        t = i['title'] if i['no'] >= 4 else f"{ym2(i['ym'])} 서울 정비사업 단계 변경 리포트"
        return f"{t} ({i['no']}호)" if i['no'] >= 4 else f"{t} ({i['no']}호)"
    _fx = {}
    try:
        for m_ in re.finditer(r'<item><title>.*?</title><link>[^<]*/report/(\d{4}-\d{2})</link>.*?<pubDate>(.*?)</pubDate><description>(.*?)</description></item>', open(os.path.join(ROOT, 'public/report/feed.xml'), encoding='utf-8').read()):
            _fx[m_.group(1)] = (m_.group(2), m_.group(3))
    except Exception: pass
    def fitem(i):
        keep = _fx.get(i['ym']) if i.get('manual') else None   # 손으로 낸 호는 그때의 발행 시각·설명 그대로
        pdt = keep[0] if keep else datetime.datetime.fromisoformat(i['pub']).strftime('%a, %d %b %Y 09:00:00 +0900')
        dsc = keep[1] if keep else esc(' '.join(i.get('sum3') or []) or i['title'])
        if keep and re.fullmatch(r'인가 \d+건 · 원문 확인 \d+건', keep[1]): dsc = f"인가 {i.get('n', 0)}건 · 원문 확인 {i.get('ok', 0)}건"   # 30차: 정정으로 바뀐 건수는 따라간다(9월호 9→8건)
        return f'<item><title>{esc(ftitle(i))}</title><link>{SITE}/report/{i["ym"]}</link><guid>{SITE}/report/{i["ym"]}</guid><pubDate>{pdt}</pubDate><description>{dsc}</description></item>'
    open(os.path.join(ROOT, 'public/report/feed.xml'), 'w', encoding='utf-8').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>집핀 · 서울 정비사업 단계 변경 리포트</title><link>{SITE}/report/</link><description>매달 서울에서 인가 단계가 바뀐 정비사업</description><language>ko</language>{"".join(fitem(i) for i in pubs)}</channel></rss>')
print(YM, 'no', no, 'cut', CUT, 'partial', PARTIAL, 'events', n_ev, '(dated', len(ev), ')', 'zones', len(zones), 'checked', n_ok, '→', title)
