#!/usr/bin/env python3
"""관심 구역 알림용 변경 내역: public/data/changes.json (최근 30일, 구역별 사건 목록)
사건 종류(type)
  stage  단계가 올라감(data.enriched.json의 s·sr을 어제 스냅숏과 비교)
  trade  새 실거래(public/data/tx.json 매매 행 중 어제 없던 것; 신고가면 hi=1)
  notice 고시·공고(public/data/notice.json 최근 30일, 인가·신청·시공자 선정만)
  auction 경매 물건 등장(public/data/auction.json byZone, 어제 목록에 없던 사건번호이면서 fs가 최근 3일 안인 예정 물건; 파일이 없거나 ok:false면 건너뜀)
  price  기본 가정 '지금 필요한 돈'이 크게 바뀜(pipeline/calc.json gapNow·now) → 조건 핀 '이제 살 수 있어요' 판정용 v={g:[전,후], c:[전,후]}
사이클 5(A)
  why    price 원인 코드: jr 전세 기준 · px 매수가 표본 · sm 표본 수 · st 단계 · cv 계산 버전(pipeline/calc_ver.json) · na 원인 모름(레이더·푸시에서 뺌)
  bf:1   밀린 자료: 계산 버전이 바뀐 날의 price · 경매 자료를 처음 받은 날(aucFirst)·막혔다 풀린 날의 경매 · 스냅숏이 3일 넘게 비었다 이어진 날의 실거래
         → 오늘 숫자·푸시·레이더에서 빼고 '새로 확인한 지난 자료'로 묶는다(tools/today.py)
  tk     trade 사건의 거래 지문(tkey) — tx.py가 남긴 해제 지문(pipeline/cache/tx_cancel.json)에 오르면 x:1·xd(알게 된 날)·xc(해제일)을 단다(지우지 않음)
  ak     경매 종류: 'drop' = 같은 사건 최저가가 유찰로 내려감(auction_match.py 최저가 이력 mh)
  pd     state에 날마다 구역별 필요한 돈 변화 [Δ전세 끼고, Δ대출 끼고, 원인, cv] 8일 — today.json rad(7일 비교, 계산 버전 바뀐 날은 뺌)
스냅숏·누적 사건은 pipeline/cache/changes_state.json에 둔다(같은 날 다시 돌려도 결과가 같다).
처음 돌릴 때(스냅숏 없음)는 실거래 계약일·고시 날짜로 지난 30일을 채운다.
사용: python3 tools/changes.py   (tools/daily.sh에서 calc.js 다음에 돈다)"""
import json, os, re, hashlib, datetime, collections, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zsample import auc_use, auc_uses, auc_jb, auc_amt   # 경매 용도·지분 말(화면 ZF.aucUse·aucJb와 같은 규칙)
ROOT = os.environ.get('ZP_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # QA(tools/qa_today.js)가 임시 폴더로 돌린다
P = lambda p: os.path.join(ROOT, p)
def J(p, d=None):
    try: return json.load(open(P(p), encoding='utf-8'))
    except Exception: return d

KST = datetime.timezone(datetime.timedelta(hours=9))
TODAY = os.environ.get('CHANGES_TODAY') or datetime.datetime.now(KST).date().isoformat()   # 시험용으로 날짜를 바꿀 수 있다
T0 = datetime.date.fromisoformat(TODAY)
DAYS = 30
CUT = (T0 - datetime.timedelta(days=DAYS - 1)).isoformat()
TXKEEP = (T0 - datetime.timedelta(days=200)).strftime('%Y%m%d')   # 스냅숏에 남길 실거래 계약일 범위
STATE = 'pipeline/cache/changes_state.json'
OUT = 'public/data/changes.json'

D = J('pipeline/data.enriched.json') or J('src/data.json')
LAD = [re.sub(r' \(.*\)$', '', x) for x in D.get('ladder', [])]
TX = J('public/data/tx.json', {}) or {}
NT = J('public/data/notice.json', {}) or {}
CALC = J('pipeline/calc.json', {}) or {}
AUC = J('public/data/auction.json', {}) or {}
VER = (J('pipeline/calc_ver.json', {}) or {}).get('ver') or ''   # 계산 코드 버전(tools/calc.js) — 바뀐 날의 필요한 돈 변화는 '밀린 자료'
CANC = J('pipeline/cache/tx_cancel.json', {}) or {}   # 해제된 매매 지문(tkey) → 해제일 YYYYMMDD (tools/tx.py)
AUC_OK = isinstance(AUC, dict) and AUC.get('ok') is True and isinstance(AUC.get('byZone'), dict)
def auc_items(i):
    v = (AUC.get('byZone') or {}).get(i) if AUC_OK else None
    return [x for x in v if isinstance(x, dict) and x.get('cs')] if isinstance(v, list) else []
akey = lambda x: f"{x.get('cs')}#{x.get('no') or 1}"
# 경매 '등장'은 정말 처음 보는 사건만: 예정 물건(st 없음)·기일이 오늘 이후·처음 본 날(fs, auction_match.py)이 최근 3일 안
AFS = (T0 - datetime.timedelta(days=3)).isoformat()
auc_new = lambda x: not x.get('st') and str(x.get('date') or '9') >= TODAY and str(x.get('fs') or TODAY) >= AFS

def short(n):
    s = re.sub(r'^\s*\[[^\]]*\]\s*', '', n or '')
    s = re.sub(r'\([^)]*\)', '', s)
    for _ in range(4):
        s2 = re.sub(r'(주택|재개발|재건축|정비|사업|조합|추진위원회|추진위|구역|가로|소규모|설립|준비위원회|\s)+$', '', s)
        if s2 == s: break
        s = s2
    return s.strip() or (n or '').strip()
kind = lambda r: 'rebuild' if '재건축' in (r.get('k') or '') else 'small' if re.search('가로|소규모', r.get('k') or '') else 'redev'
def stg(s, sr):
    lab = LAD[s] if isinstance(s, int) and 0 <= s < len(LAD) else ''
    return (lab or sr or '').replace('조합설립 또는 사업시행자 지정', '조합·시행자 지정')
def won(m):   # 만원 → '20.9억' / '9,500만'
    if m is None: return ''
    return f"{round(m / 1e4, 1):g}억" if m >= 1e4 else f"{int(m):,}만"
eok = lambda v: f"{round(v, 1):g}억"
WORDS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'feed_words.json'), encoding='utf-8'))   # 문구 사전 한 곳
def fill(t, **kw):
    return re.sub(r'\{(\w+)\}', lambda m: f"{kw[m.group(1)]:,}" if isinstance(kw.get(m.group(1)), int) and not isinstance(kw.get(m.group(1)), bool) else str(kw.get(m.group(1), m.group(0))), t)
TYPE = {0: '빌라·주택', 1: '빌라·주택', 2: '아파트', 3: '입주권'}
def tkey(x):   # 거래 한 행의 짧은 지문(스냅숏 크기를 줄이려고 해시 8자)
    return hashlib.md5(f"{x[0]}|{x[1]}|{x[3]}|{x[4]}|{x[5]}|{x[6] if len(x) > 6 else ''}".encode()).hexdigest()[:8]
def rd(v): return None if v is None else round(float(v), 4)

recs = [r for r in D['recs'] if r.get('id')]
byId = {r['id']: r for r in recs}

def snap_now():
    S = {}
    for r in recs:
        i = r['id']; t = TX.get(i) or {}
        rows = [x for x in (t.get('s') or []) if isinstance(x, list) and len(x) >= 6 and str(x[0]) >= TXKEEP]
        c = CALC.get(i) or {}
        hi = (r.get('tx') or {}).get('hi')
        ref = (((c.get('f') or {}).get('num') or {}).get('ref') or {})
        S[i] = {'s': r.get('s'), 'sr': r.get('sr') or '', 't': [tkey(x) for x in rows],
                'hi': hi[1] if isinstance(hi, list) and len(hi) > 1 else None,
                'g': rd(c.get('gapNow')), 'c': rd(c.get('now')),
                'j': rd(c.get('jeonse')), 'p': rd(c.get('price')), 'n': ref.get('n') if isinstance(ref.get('n'), int) else None}
        if AUC_OK: S[i]['a'] = sorted({akey(x) for x in auc_items(i)})
    return S

def ev(i, date, typ, text, **kw):
    r = byId.get(i) or {}
    e = {'id': i, 'date': date, 'type': typ, 'text': text, 'n': short(r.get('n')), 'g': r.get('g') or ''}
    e.update({k: v for k, v in kw.items() if v is not None})
    e['k'] = hashlib.md5(f"{typ}|{i}|{date}|{text}".encode()).hexdigest()[:10]
    return e

def trade_text(rows, hi):
    x = max(rows, key=lambda y: (y[0], y[5]))
    ty = TYPE.get(x[1], '거래')
    area = x[3] if x[1] in (2, 3) or not x[4] else x[4]
    lab = '대지 ' if x[1] in (0, 1) and x[4] else ''
    d = str(x[0]); dd = f"{int(d[4:6])}.{int(d[6:8])}"
    t = f"새 실거래 {len(rows)}건 · {ty} {lab}{area:g}㎡ {won(x[5])}({dd} 계약)"
    return t + (' · 신고가' if hi else '')

RES_RE = re.compile(r'아파트|다세대|연립|빌라|단독|다가구|주택|오피스텔|도시형')
def auc_head(items):
    """대표 물건: 주거용(다세대·아파트 등) 가운데 최저가가 가장 낮은 것 → 없으면 전체에서"""
    res = [y for y in items if RES_RE.search(str(y.get('use') or ''))] or items
    return min(res, key=lambda y: (y.get('min') if isinstance(y.get('min'), (int, float)) and y['min'] > 0 else 9e18, str(y.get('date') or '9')))
auc_jibun = lambda y: bool(y.get('jb'))   # 지분 매각(auction_match.py)
def auc_text(items):   # 구역 리포트 경매 블록과 같은 말: '경매 1건 · 물건 15개 · 근린시설 외 · 최저 3.3억 · 입찰 11.4'
    x = auc_head(items)
    mn = x.get('min'); d = str(x.get('date') or '')
    ncs = len({y.get('cs') for y in items}) or 1
    use = auc_uses([y.get('use') for y in items]) if len(items) > 1 else (auc_use(x.get('use')) or '부동산')
    t = f"경매 {ncs}건{f' · 물건 {len(items)}개' if len(items) > ncs else ''} · {use}{' ' + auc_jb(x.get('jb')) if auc_jibun(x) else ''}"
    if isinstance(mn, (int, float)) and mn > 0: t += f" · 최저 {auc_amt(mn)}"
    if re.match(r'\d{4}-\d\d-\d\d', d): t += f" · 입찰 {int(d[5:7])}.{int(d[8:10])}"
    return t
def auc_mn(items):   # 알림 조건(현금) 비교용: 대표 물건 최저가(억)
    v = auc_head(items).get('min')
    return round(v / 1e8, 2) if isinstance(v, (int, float)) and v > 0 else None

def causes(p, c, cv):
    """필요한 돈이 바뀐 원인(앞뒤 스냅숏 입력 비교) → {코드: [전, 후]} · 하나도 못 찾으면 {'na': 1}"""
    w = {}
    if cv: w['cv'] = 1
    for k, code in (('j', 'jr'), ('p', 'px')):
        a, b = p.get(k), c.get(k)
        if a is not None and b is not None and abs(b - a) >= 0.005: w[code] = [round(a, 2), round(b, 2)]
    if p.get('n') is not None and c.get('n') is not None and p['n'] != c['n']: w['sm'] = [p['n'], c['n']]
    elif collections.Counter(p.get('t') or []) != collections.Counter(c.get('t') or []) and 'j' in p: w['sm'] = 1   # 거래 표본이 바뀜(수는 모름)
    if isinstance(p.get('s'), int) and isinstance(c.get('s'), int) and p['s'] != c['s']: w['st'] = [p['s'], c['s']]
    return w or {'na': 1}
def why_txt(w):   # 사건 문구 꼬리: '전세 기준 ▲0.3억' · '매수가 표본 ▼0.2억' · '표본 21→23건' · '단계 바뀜' (tools/feed_words.json rad.why)
    out = []
    for code in ('jr', 'px', 'sm', 'st'):
        v = w.get(code)
        if v is None: continue
        t = WORDS['rad']['why'][code]
        if code in ('jr', 'px'): out.append(fill(t, a=('▲' if v[1] > v[0] else '▼') + eok(abs(v[1] - v[0]))))
        elif code == 'sm':
            if isinstance(v, list): out.append(fill(t, a=v[0], b=v[1]))
        else: out.append(t)
    return out

def diff(prev, cur, date, fl=None):
    """fl: {'cv': 계산 버전 바뀜, 'abf': 경매 밀린 자료(처음 받은 날·막혔다 풀린 날), 'tbf': 실거래 밀린 자료(스냅숏 공백 뒤)}"""
    fl = fl or {}
    out, pd = [], {}
    for i, c in cur.items():
        p = prev.get(i)
        r = byId[i]
        if p is None: continue   # 새로 생긴 구역은 비교할 게 없다
        # 단계
        if isinstance(c['s'], int) and isinstance(p.get('s'), int) and c['s'] > p['s']:
            out.append(ev(i, date, 'stage', f"{stg(p['s'], p.get('sr'))} → {stg(c['s'], c['sr'])}", s=c['s']))
        # 실거래: 어제 없던 행(같은 행이 여러 건이면 늘어난 만큼)
        old = collections.Counter(p.get('t') or [])
        rows = [x for x in ((TX.get(i) or {}).get('s') or []) if isinstance(x, list) and len(x) >= 6 and str(x[0]) >= TXKEEP]
        new = []
        for x in rows:
            k = tkey(x)
            if old[k] > 0: old[k] -= 1
            else: new.append(x)
        if new:
            hi = bool(c.get('hi') and c['hi'] != p.get('hi'))
            out.append(ev(i, date, 'trade', trade_text(new, hi), hi=1 if hi else None, cnt=len(new), tk=[tkey(x) for x in new], bf=1 if fl.get('tbf') else None))
        # 경매: 어제 목록에 없던 사건(경매 자료를 처음 받은 날은 지금 물건 모두가 '등장' → 밀린 자료 bf)
        if AUC_OK and 'a' in c:
            old_a = set(p.get('a') or [])
            old_cs = {k.split('#')[0] for k in old_a}
            na = [x for x in auc_items(i) if auc_new(x) and akey(x) not in old_a and x.get('cs') not in old_cs]
            if na:
                out.append(ev(i, date, 'auction', auc_text(na), cnt=len(na), mn=auc_mn(na), ak='new', bf=1 if fl.get('abf') or 'a' not in p else None))
            dr = auc_drops(i, date)
            if dr: out.append(ev(i, date, 'auction', auc_drop_text(dr), cnt=len(dr), mn=auc_mn(dr), ak='drop', bf=1 if fl.get('abf') else None))
        # 필요한 돈: 구역별 변화 기록(작은 변화까지 · today.json 레이더) + 큰 변화(0.1억 이상이면서 3% 이상)만 사건
        if r.get('dn'): continue
        dv = [None, None]
        for n, m in enumerate(('g', 'c')):
            a, b = p.get(m), c.get(m)
            if a is not None and b is not None and abs(b - a) >= 0.005: dv[n] = round(b - a, 3)
        if dv == [None, None]: continue
        w = causes(p, c, fl.get('cv'))
        pd[i] = [dv[0], dv[1], {k: v for k, v in w.items() if k != 'cv'}, 1 if 'cv' in w else 0]
        v = {}
        for m in ('g', 'c'):
            a, b = p.get(m), c.get(m)
            if a is not None and b is not None and abs(b - a) >= max(0.1, abs(a) * 0.03): v[m] = [round(a, 2), round(b, 2)]
        if v:
            lab = {'g': '전세 끼고', 'c': '대출 끼고'}
            parts = [f"{lab[m]} {eok(v[m][0])}→{eok(v[m][1])}" for m in ('g', 'c') if m in v]
            d0 = next(iter(v.values())); arrow = '▼' if d0[1] < d0[0] else '▲'
            tail = [] if 'cv' in w else why_txt(w)
            out.append(ev(i, date, 'price', f"필요한 돈 {arrow}{eok(abs(d0[1] - d0[0]))} · " + ' · '.join(parts + tail), v=v, kd=kind(r), s=r.get('s'),
                          why=sorted(w), bf=1 if 'cv' in w else None))
    return out, pd

def auc_drops(i, date):
    """오늘 새로 본 최저가가 바로 전 기일보다 낮은 물건(유찰 뒤 저감) — auction_match.py 최저가 이력 mh: [[처음 본 날, 매각기일, 최저가, 유찰], …]"""
    out = []
    for x in auc_items(i):
        h = x.get('mh')
        if x.get('st') or not isinstance(h, list) or len(h) < 2: continue
        a, b = h[-2], h[-1]
        if b[0] == date and isinstance(a[2], (int, float)) and isinstance(b[2], (int, float)) and 0 < b[2] < a[2] and str(b[1]) >= TODAY: out.append(x)
    return out
def auc_drop_text(items):   # '유찰 2회 · 최저가 2.7억 → 2.2억 · 입찰 11.5' (feed_words auc.drop)
    x = min(items, key=lambda y: y['mh'][-1][2])
    a, b = x['mh'][-2], x['mh'][-1]
    t = fill(WORDS['auc']['drop'], f=x.get('fail') if isinstance(x.get('fail'), int) else b[3], a=auc_amt(a[2]), b=auc_amt(b[2]))
    d = str(x.get('date') or '')
    if re.match(r'\d{4}-\d\d-\d\d', d): t += f" · 입찰 {int(d[5:7])}.{int(d[8:10])}"
    return ('경매 ' + (f'{len(items)}건 · ' if len(items) > 1 else '')) + t

def bootstrap(cur):
    """스냅숏이 없을 때: 지난 30일 실거래를 계약일 기준으로 묶는다."""
    out = []
    c0 = CUT.replace('-', '')
    for i in cur:
        rows = [x for x in ((TX.get(i) or {}).get('s') or []) if isinstance(x, list) and len(x) >= 6 and str(x[0]) >= c0]
        byd = collections.defaultdict(list)
        for x in rows: byd[str(x[0])].append(x)
        hi = (byId[i].get('tx') or {}).get('hi')
        for d, rs in byd.items():
            date = f"{d[:4]}-{d[4:6]}-{d[6:8]}"
            h = isinstance(hi, list) and len(hi) > 1 and hi[1] == d
            out.append(ev(i, date, 'trade', trade_text(rs, h), hi=1 if h else None, cnt=len(rs), tk=[tkey(x) for x in rs]))
        na = [x for x in auc_items(i) if not x.get('st') and str(x.get('date') or '9') >= TODAY]
        if na:   # 처음 모은 날 한꺼번에 '등장' = 밀린 자료
            out.append(ev(i, TODAY, 'auction', auc_text(na), cnt=len(na), mn=auc_mn(na), ak='new', bf=1))
    return out

def notices():
    """고시·공고: 인가·고시(ok/chg)·신청·공람(req)·시공자 선정(con). 법인등기·용역 계약(etc)은 소식으로 치지 않는다."""
    out, seen = [], set()
    LAB = {'ok': '', 'chg': '변경 ', 'req': '', 'con': ''}
    for it in NT.get('items') or []:
        if not isinstance(it, list) or len(it) < 5: continue
        d, i, sec, t, cat = it[:5]
        if cat not in LAB or d < CUT or d > TODAY or i not in byId: continue
        tag = re.match(r'\[([^\]]*)\]', t or '')
        tag = tag.group(1) if tag else (t or '')[:20]
        txt = f"{sec} {tag}".strip()
        if (i, d, txt) in seen: continue
        seen.add((i, d, txt))
        out.append(ev(i, d, 'notice', txt, cat=cat))
    return out

def auc_retext(e):
    """예전 꼴 경매 문구('… 2건 · 단독주택다가구 지분 최저 1.4억') → 지금 꼴('(물건 2개) · 단독·다가구 지분 약 15% · 최저 1.4억').
    지분 몫은 그 구역 경매 물건 중 대표 최저가(mn)가 같은 물건에서 찾는다."""
    if e.get('type') != 'auction': return e
    t = e.get('text') or ''
    if t.startswith('경매 물건 등장'):   # 리포트와 다른 옛 말 → 같은 사건(대표 최저가 mn이 같은 물건의 사건번호) 물건들로 다시 쓴다
        its = auc_items(e['id']); h = next((y for y in its if isinstance(y.get('min'), (int, float)) and abs(y['min'] / 1e8 - (e.get('mn') or -1)) < 0.006), None)
        if h: return dict(e, text=auc_text([y for y in its if y.get('cs') == h.get('cs')]))
        m = re.match(r'^경매 물건 등장(?: \(물건 (\d+)개\))?(.*)$', t)
        if m: return dict(e, text=f"경매 1건{f' · 물건 {m.group(1)}개' if m.group(1) else ''}{m.group(2)}")
    if ' · 최저 ' in t: return e   # 이미 지금 꼴
    m = re.match(r'^경매 물건 등장(?: (\d+)건)? · (.+?)( 지분)? 최저 (.+)$', t)
    if not m: return e
    n, use, jb, rest = m.groups()
    x = next((y for y in auc_items(e['id']) if y.get('jb') and isinstance(y.get('min'), (int, float)) and abs(y['min'] / 1e8 - (e.get('mn') or 0)) < 0.006), None)
    j = ' ' + auc_jb(x['jb']) if x else ' 지분' if jb else ''
    return dict(e, text=f"경매 물건 등장{f' (물건 {n}개)' if n else ''} · {auc_use(use)}{j} · 최저 {rest}")

def dgap(a, b):
    try: return (datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days
    except Exception: return 0

def main():
    st = J(STATE, {}) or {}
    cur = snap_now()
    same = st.get('day') == TODAY
    if same:   # 같은 날 다시: 어제 스냅숏과 다시 비교(오늘 사건은 새로 만든다)
        base, prev = st.get('prev'), st.get('prev')
        kept = [e for e in st.get('ev') or [] if e.get('date') != TODAY or e.get('boot')]
        bver, bday, baa = st.get('pver'), st.get('pday'), st.get('paAsOf')
    else:
        base, prev = st.get('snap'), st.get('snap')
        kept = list(st.get('ev') or [])
        bver, bday, baa = st.get('ver'), st.get('day'), st.get('aAsOf')
    if not AUC_OK and base:
        for i, v in cur.items():
            if 'a' in (base.get(i) or {}): v['a'] = base[i]['a']
    # 밀린 자료(bf) 판정: 계산 버전 · 경매 처음/공백 · 스냅숏 공백
    aa = AUC.get('asOf') if AUC_OK else None
    fl = {'cv': bool(base) and (bver is None or bver != VER),
          'abf': bool(base) and AUC_OK and (not any('a' in v for v in base.values()) or (baa and aa and dgap(baa, aa) > 2) or bool(AUC.get('stale'))),
          'tbf': bool(base) and bool(bday) and dgap(bday, TODAY) > 3}
    if base:
        new, pd = diff(base, cur, TODAY, fl)
    else:
        new, pd = [dict(e, boot=1) for e in bootstrap(cur)], {}
        prev = None
    afirst = st.get('aucFirst')
    if afirst is None:   # 경매 자료를 처음 받은 날(한 번 정하면 그대로) — 그날 '등장'은 밀린 자료
        ds = sorted(e['date'] for e in kept + new if e.get('type') == 'auction')
        afirst = ds[0] if ds else (TODAY if fl['abf'] else None)
    # 필요한 돈(price)은 푸시 조건 판정용이라 3일만 둔다(계산 엔진이 바뀐 날 수백 건이 30일 쌓이지 않게)
    PCUT = (T0 - datetime.timedelta(days=2)).isoformat()
    stored, sk = [], set()
    new = [auc_retext(e) for e in new]; kept = [auc_retext(e) for e in kept]
    for e in new + kept:   # 같은 날 다시 돌려도 쌓이지 않게 키로 한 번만
        if e.get('k') in sk or e.get('date', '') < CUT or (e.get('type') == 'price' and e.get('date', '') < PCUT): continue
        sk.add(e.get('k'))
        if e.get('type') == 'auction':
            e.setdefault('ak', 'new')
            if afirst and e.get('date') == afirst: e['bf'] = 1
        if e.get('type') == 'trade' and e.get('tk') and not e.get('x'):   # 해제 거래 정정(지우지 않고 표시)
            hit = [CANC[t] for t in e['tk'] if t in CANC]
            if hit:
                e['x'] = 1; e['xd'] = TODAY
                d = str(hit[0]); e['xc'] = f"{d[:4]}-{d[4:6]}-{d[6:8]}" if re.match(r'^\d{8}$', d) else d
        stored.append(e)
    seenk = set(); evs = []
    for e in stored + notices():
        if e['k'] in seenk: continue
        seenk.add(e['k']); evs.append(e)
    evs.sort(key=lambda e: (e['date'], {'stage': 5, 'auction': 4, 'notice': 3, 'price': 2, 'trade': 1}.get(e['type'], 0), e['id']), reverse=True)
    pub = [{k: v for k, v in e.items() if k != 'boot'} for e in evs]
    body = json.dumps({'asOf': TODAY, 'days': DAYS, 'ver': VER, 'items': pub}, ensure_ascii=False, separators=(',', ':'))
    if not os.path.exists(P(OUT)) or open(P(OUT), encoding='utf-8').read() != body:
        open(P(OUT), 'w', encoding='utf-8').write(body)
    # 구역별 필요한 돈 변화 기록(8일): today.json 레이더 7일 비교
    PD = {d: v for d, v in (st.get('pd') or {}).items() if dgap(d, TODAY) < 8 and d != TODAY}
    if base: PD[TODAY] = pd
    VH = {d: v for d, v in (st.get('vh') or {}).items() if dgap(d, TODAY) < 31}
    VH[TODAY] = VER   # 날마다 계산 버전(QA·today.py가 '계산 버전 바뀐 날'을 안다)
    out_st = {'day': TODAY, 'snap': cur, 'prev': prev, 'ev': stored, 'ver': VER, 'pver': bver if same else st.get('ver'),
              'pday': bday if same else st.get('day'), 'aAsOf': aa or baa, 'paAsOf': baa if same else st.get('aAsOf'),
              'aucFirst': afirst, 'pd': PD, 'vh': VH, 'fl': {k: 1 for k, v in fl.items() if v}}
    json.dump(out_st, open(P(STATE), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    cnt = collections.Counter(e['type'] for e in pub)
    print('changes', len(pub), dict(cnt), 'new today', len(new) if base else 0, 'bf', sum(1 for e in new if e.get('bf')), 'flags', out_st['fl'], f'{len(body.encode()) // 1024}KB')

if __name__ == '__main__':
    main()
