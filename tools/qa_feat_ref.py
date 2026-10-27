#!/usr/bin/env python3
"""renew-feat QA 기준식(파이썬 · 화면 코드와 따로 짠 셈) — tools/qa_feat.js가 화면 함수(ZPF.tl·org·px) 결과와 전수 대조
입력: pipeline/data.enriched.json(없으면 src/data.json) · public/premium.json · public/data/tx.json
출력(stdout JSON): {tl: {id: ...}, org: {id: ...}, px: {id: {basis: {ak: {qs, jr}}}}}"""
import json, os, sys, datetime, statistics
from decimal import Decimal, ROUND_HALF_UP   # 자바스크립트 toFixed·Math.round(.5는 위로)와 같은 반올림
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(R, p), encoding='utf-8'))
D = J('pipeline/data.enriched.json') if os.path.exists(os.path.join(R, 'pipeline/data.enriched.json')) else J('src/data.json')
P = J('public/premium.json'); T = J('public/data/tx.json')
YMS = 365.25 * 864e5
def yr(d):
    try:
        y, m, dd = int(d[0:4]), int(d[5:7]), int(d[8:10]) if len(d) >= 10 else 1
        return 1970 + (datetime.datetime(y, m, dd, tzinfo=datetime.timezone.utc).timestamp() * 1000) / YMS
    except Exception: return None
KEYS = ["구역지정", "추진위", "조합설립", "시행자지정", "사업시행", "관리처분", "착공", "준공"]
NEXT = {2: "구역지정>조합설립", 3: "추진위>조합설립", 4: "조합설립>사업시행", 5: "사업시행>관리처분", 6: "관리처분>착공", 8: "착공>준공"}
S = D.get('stats') or {}
TRS = (D.get('etaMeta') or {}).get('transitions') or {}
def stat(r, k):
    """사이클 2: 화면 ZF.stageStat와 따로 쓴 셈 — 가운데 값 = 생존분석(etaMeta) · 25~75% = stats(이미 넘어간 곳)"""
    import re
    sm = bool(re.search('가로|소규모', r.get('k') or ''))
    q = (sm and (S.get('small') or {}).get(k)) or (S.get('large') or {}).get(k)
    ts = sm and (TRS.get('small') or {}).get(k); t = (ts if ts and ts.get('uses') == 'small' else None) or (TRS.get('large') or {}).get(k)
    if not q or (t and t.get('med') is None and q.get('med') is None): return None
    med = t['med'] if t and t.get('med') is not None else q['med']
    return {'med': med, 'p25': q['p25'], 'p75': q['p75'], 'n': (t['nEv'] + t['nCen']) if t else None}
ASOF = yr(D['asOf'])
import math; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import zsample as zs
UPD = D.get('upd') or D['asOf']; NOWY = yr(UPD); PAST = []
def _erf(x):
    s = 1 if x > 0 else -1 if x < 0 else 0; x = abs(x); t = 1 / (1 + 0.3275911 * x)
    return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * math.exp(-x * x))
_Phi = lambda z: 0.5 * (1 + _erf(z / math.sqrt(2)))
def _inv(p):
    a, b = -8.0, 8.0
    for _ in range(80):
        m = (a + b) / 2
        if _Phi(m) < p: a = m
        else: b = m
    return (a + b) / 2
def condq(el, st):
    mu = math.log(st['med']); sg = max(0.05, (math.log(st['p75']) - math.log(st['p25'])) / 1.349); f0 = _Phi((math.log(max(el, 1e-6)) - mu) / sg)
    return [math.exp(mu + sg * _inv(f0 + q * (1 - f0))) for q in (0.25, 0.5, 0.75)]
out = {'tl': {}, 'org': {}, 'px': {}}
for r in D['recs']:
    if r.get('src') == 'moa': continue
    p = P.get(r['id']) or {}
    dt = p.get('dt') or {}
    rr = dict(r); rr['dt'] = dt
    steps = [(k, dt[k], yr(dt[k])) for k in KEYS if dt.get(k) and yr(dt[k]) is not None and not (k == '시행자지정' and dt.get('조합설립'))]
    steps.sort(key=lambda x: (x[2], KEYS.index(x[0])))
    gaps = []
    for i in range(1, len(steps)):
        a, b = steps[i - 1], steps[i]; y = b[2] - a[2]
        ka = '조합설립' if a[0] == '시행자지정' else a[0]; kb = '조합설립' if b[0] == '시행자지정' else b[0]
        st = stat(rr, f'{ka}>{kb}')
        lvl = None
        if y > 0 and st: lvl = 'fast' if y < st['p25'] else 'norm' if y <= st['p75'] else 'slow'
        gaps.append([a[0], b[0], round(y, 4), st['med'] if st else None, lvl])
    nxt = None
    nk = NEXT.get(r.get('s')) if not r.get('dn') and not (r.get('s', 0) >= 9) else None
    if nk:
        fr = nk.split('>')[0]; fd = dt.get(fr) or (dt.get('시행자지정') if fr == '조합설립' else None); st = stat(rr, nk)
        if fd and st and yr(fd) is not None:
            # 사이클 2: 경과 = zsample.yrs_since(데이터 갱신일 기준 · 화면 ZF.yrsSince와 같은 셈) · 장기 정체 = zsample.stall_yrs
            y0 = yr(fd); el = zs.yrs_since(fd, UPD)
            if zs.stall_yrs(rr, dt, UPD): nxt = [nk, None, None, 'stall']
            elif el > st['p75']: nxt = [nk, None, None, 'over']
            elif el >= st['p25']:
                c = condq(el, st); nxt = [nk, round(y0 + c[0], 4), round(y0 + c[2], 4), 'in']
            else: nxt = [nk, round(y0 + st['p25'], 4), round(y0 + st['p75'], 4), 'before']
            if nxt[3] in ('in', 'before') and nxt[1] < NOWY - 1e-6: PAST.append(r['id'])   # 지난 날짜를 예상으로 내면 안 됨
    if steps or nxt: out['tl'][r['id']] = {'gaps': gaps, 'next': nxt}
    # org
    sm = dict(r.get('sm') or {}); sm.update(p.get('sm') or {})
    cs = dict(r.get('cs') or {})
    for k, v in (p.get('cs') or {}).items():
        if k in cs: cs[k] = {**cs[k], **v}
    ck = '조합설립' if cs.get('조합설립') else '추진위' if cs.get('추진위') else None
    c = cs.get(ck) if ck else None
    cv = (c.get('v') if c.get('v') is not None else c.get('first')) if c else None
    units = sm.get('units') if sm.get('units') is not None else (sm['saleUnits'] + sm['rental'] if sm.get('saleUnits') is not None and sm.get('rental') is not None else None)
    owners = sm.get('owners') or sm.get('members') or None
    sale = (units - owners - (sm.get('rental') or 0)) / units if units and owners and units > owners else None
    out['org'][r['id']] = {'builder': p.get('b') or None, 'consent': float(Decimal(cv).quantize(Decimal('0.01'), ROUND_HALF_UP)) if cv is not None else None, 'owners': owners, 'units': units,
                           'sale': int(Decimal(sale * 100).quantize(Decimal('1'), ROUND_HALF_UP)) if sale is not None and sale > 0 else None, 'far': sm.get('far') or None}
# px
def q(d): return f"{d[2:4]}Q{(int(d[4:6]) - 1) // 3 + 1}"
def qk(x): return x[0:2] + x[3:]
def med(a):
    s = sorted(a); n = len(s)
    return None if not n else (s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2)
AREA = {'all': (0, 1e9), 's': (0, 40), 'm': (40, 60), 'l': (60, 85), 'x': (85, 1e9)}
def jsround(v):  # 자바스크립트 Math.round(.5는 위로)
    import math
    return math.floor(v + 0.5)
for zid, z in T.items():
    Sx = z.get('s') or []; Jx = z.get('j') or []
    if len(Sx) < 3: continue
    res = {}
    for basis in ('v', 'a'):
        res[basis] = {}
        for ak, (a0, a1) in AREA.items():
            pts = [v for v in Sx if ((v[1] <= 1 and v[4] > 0) if basis == 'v' else (v[1] >= 2 and v[3] > 0)) and (ak == 'all' or (v[3] > 0 and a0 < v[3] <= a1))]
            Q = {}
            for v in pts: Q.setdefault(q(v[0]), []).append(v[5] / ((v[4] if basis == 'v' else v[3]) / 3.3058))
            qs = [[k, jsround(med(Q[k])), len(Q[k])] for k in sorted(Q, key=qk)]
            res[basis][ak] = qs
    SQ, JQ = {}, {}
    for v in Sx:
        if v[1] == 0 and v[3] > 0: SQ.setdefault(q(v[0]), []).append(v[5] / v[3])
    for v in Jx:
        if v[2] > 0 and v[3] > 0: JQ.setdefault(q(v[0]), []).append(v[3] / v[2])
    jr = [[k, jsround(med(JQ[k]) / med(SQ[k]) * 100)] for k in sorted(JQ, key=qk) if len(SQ.get(k, [])) >= 2 and len(JQ[k]) >= 2]
    out['px'][zid] = {'q': res, 'jr': jr}
out['past'] = PAST
# 사이클 2: /years 표(public/years.html 안 const S)와 같은 출처인지 — 가운데 값·전체 표본·닿은 표본·25~75%
import re as _re
try:
    _Y = json.loads(_re.search(r'const S=(\{.*?\});\n', open(os.path.join(R, 'public/years.html'), encoding='utf-8').read()).group(1))
    out['years'] = {g: {k: [v.get('km_med'), v.get('n'), v.get('nEv'), v.get('p25'), v.get('p75'), v.get('na')] for k, v in (_Y.get(g) or {}).items()} for g in _Y}
except Exception as e: out['years'] = {'err': str(e)}
json.dump(out, sys.stdout, ensure_ascii=False, separators=(',', ':'))
