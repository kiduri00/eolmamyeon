#!/usr/bin/env python3
"""관심 구역 알림용 변경 내역: public/data/changes.json (최근 30일, 구역별 사건 목록)
사건 종류(type)
  stage  단계가 올라감(data.enriched.json의 s·sr을 어제 스냅숏과 비교)
  trade  새 실거래(public/data/tx.json 매매 행 중 어제 없던 것; 신고가면 hi=1)
  notice 고시·공고(public/data/notice.json 최근 30일, 인가·신청·시공자 선정만)
  auction 경매 물건 등장(public/data/auction.json byZone, 어제 목록에 없던 사건번호이면서 fs가 최근 3일 안인 예정 물건; 파일이 없거나 ok:false면 건너뜀)
  price  기본 가정 '지금 필요한 돈'이 크게 바뀜(pipeline/calc.json gapNow·now) → 조건 핀 '이제 살 수 있어요' 판정용 v={g:[전,후], c:[전,후]}
스냅숏·누적 사건은 pipeline/cache/changes_state.json에 둔다(같은 날 다시 돌려도 결과가 같다).
처음 돌릴 때(스냅숏 없음)는 실거래 계약일·고시 날짜로 지난 30일을 채운다.
사용: python3 tools/changes.py   (tools/daily.sh에서 calc.js 다음에 돈다)"""
import json, os, re, hashlib, datetime, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
        S[i] = {'s': r.get('s'), 'sr': r.get('sr') or '', 't': [tkey(x) for x in rows],
                'hi': hi[1] if isinstance(hi, list) and len(hi) > 1 else None,
                'g': rd(c.get('gapNow')), 'c': rd(c.get('now'))}
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

def auc_text(items):
    x = min(items, key=lambda y: (str(y.get('date') or '9'), y.get('min') or 0))
    mn = x.get('min'); d = str(x.get('date') or '')
    t = f"경매 물건 등장{f' {len(items)}건' if len(items) > 1 else ''} · {x.get('use') or '부동산'}"
    if isinstance(mn, (int, float)) and mn > 0: t += f" 최저 {won(mn / 1e4)}"
    if re.match(r'\d{4}-\d\d-\d\d', d): t += f" · 입찰 {int(d[5:7])}.{int(d[8:10])}"
    return t

def diff(prev, cur, date):
    out = []
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
            out.append(ev(i, date, 'trade', trade_text(new, hi), hi=1 if hi else None, cnt=len(new)))
        # 경매: 어제 목록에 없던 사건(경매 자료를 처음 받은 날은 지금 물건 모두가 '등장')
        if AUC_OK and 'a' in c:
            old_a = set(p.get('a') or [])
            old_cs = {k.split('#')[0] for k in old_a}
            na = [x for x in auc_items(i) if auc_new(x) and akey(x) not in old_a and x.get('cs') not in old_cs]
            if na:
                mn = min((x.get('min') for x in na if isinstance(x.get('min'), (int, float))), default=None)
                out.append(ev(i, date, 'auction', auc_text(na), cnt=len(na), mn=round(mn / 1e8, 2) if mn else None))
        # 필요한 돈(기본 가정): 0.1억 이상이면서 3% 이상 바뀐 방식만
        if r.get('dn'): continue
        v = {}
        for m in ('g', 'c'):
            a, b = p.get(m), c.get(m)
            if a is not None and b is not None and abs(b - a) >= max(0.1, abs(a) * 0.03): v[m] = [round(a, 2), round(b, 2)]
        if v:
            lab = {'g': '전세 끼고', 'c': '대출 끼고'}
            parts = [f"{lab[m]} {eok(v[m][0])}→{eok(v[m][1])}" for m in ('g', 'c') if m in v]
            d0 = next(iter(v.values())); arrow = '▼' if d0[1] < d0[0] else '▲'
            out.append(ev(i, date, 'price', f"필요한 돈 {arrow}{eok(abs(d0[1] - d0[0]))} · " + ' · '.join(parts), v=v, kd=kind(r), s=r.get('s')))
    return out

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
            out.append(ev(i, date, 'trade', trade_text(rs, h), hi=1 if h else None, cnt=len(rs)))
        na = [x for x in auc_items(i) if not x.get('st') and str(x.get('date') or '9') >= TODAY]
        if na:
            mn = min((x.get('min') for x in na if isinstance(x.get('min'), (int, float))), default=None)
            out.append(ev(i, TODAY, 'auction', auc_text(na), cnt=len(na), mn=round(mn / 1e8, 2) if mn else None))
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

def main():
    st = J(STATE, {}) or {}
    cur = snap_now()
    if st.get('day') == TODAY:   # 같은 날 다시: 어제 스냅숏과 다시 비교(오늘 사건은 새로 만든다)
        base, prev = st.get('prev'), st.get('prev')
        kept = [e for e in st.get('ev') or [] if e.get('date') != TODAY or e.get('boot')]
    else:
        base, prev = st.get('snap'), st.get('snap')
        kept = list(st.get('ev') or [])
    if not AUC_OK and base:
        for i, v in cur.items():
            if 'a' in (base.get(i) or {}): v['a'] = base[i]['a']
    if base:
        new = diff(base, cur, TODAY)
    else:
        new = [dict(e, boot=1) for e in bootstrap(cur)]
        prev = None
    # 필요한 돈(price)은 푸시 조건 판정용이라 3일만 둔다(계산 엔진이 바뀐 날 수백 건이 30일 쌓이지 않게)
    PCUT = (T0 - datetime.timedelta(days=2)).isoformat()
    stored, sk = [], set()
    for e in new + kept:   # 같은 날 다시 돌려도 쌓이지 않게 키로 한 번만
        if e.get('k') in sk or e.get('date', '') < CUT or (e.get('type') == 'price' and e.get('date', '') < PCUT): continue
        sk.add(e.get('k')); stored.append(e)
    seenk = set(); evs = []
    for e in stored + notices():
        if e['k'] in seenk: continue
        seenk.add(e['k']); evs.append(e)
    evs.sort(key=lambda e: (e['date'], {'stage': 5, 'auction': 4, 'notice': 3, 'price': 2, 'trade': 1}.get(e['type'], 0), e['id']), reverse=True)
    pub = [{k: v for k, v in e.items() if k != 'boot'} for e in evs]
    body = json.dumps({'asOf': TODAY, 'days': DAYS, 'items': pub}, ensure_ascii=False, separators=(',', ':'))
    if not os.path.exists(P(OUT)) or open(P(OUT), encoding='utf-8').read() != body:
        open(P(OUT), 'w', encoding='utf-8').write(body)
    json.dump({'day': TODAY, 'snap': cur, 'prev': prev, 'ev': stored}, open(P(STATE), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    cnt = collections.Counter(e['type'] for e in pub)
    print('changes', len(pub), dict(cnt), 'new today', len(new) if base else 0, f'{len(body.encode()) // 1024}KB')

if __name__ == '__main__':
    main()
