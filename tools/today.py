#!/usr/bin/env python3
"""사이클 5(A): 서울 '오늘' 묶음 → public/data/today.json (gzip 10KB 이하 · 홈 오늘 카드·소식 '서울 오늘'·일정·내 돈 레이더·푸시가 같은 숫자)
입력: public/data/changes.json(사건) · public/data/auction.json(매각기일·최저가 이력) · pipeline/cache/toheo.json + parcels.json(구역 안 토지거래허가)
      · pipeline/cache/changes_state.json(pd: 구역별 필요한 돈 변화 · vh: 날마다 계산 버전) · tools/feed_words.json(문구 사전)
날짜 두 가지: 사건 'date'는 자료에 올라온 날(실거래 = 신고가 들어온 날 · 경매 = 처음 본 날 · 고시 = 고시일 · 허가 = 허가일), 계약일·매각기일은 문구 안에 따로.
밀린 자료(bf): changes.py가 붙인 bf(경매 첫 수집 · 막혔다 풀린 날 · 스냅숏 공백 · 계산 버전 바뀐 날 price)는 오늘·이번 주 숫자와 푸시에서 빼고 seoul.bf로 따로 센다.
출처 없는 미래 날짜는 쓰지 않는다: 다가오는 일정은 법원경매정보 매각기일뿐(총회·감정평가 날짜 추정 없음).

today.json 꼴 (v 1)
  asOf, ver(계산 버전), cvd(최근 30일 중 계산 버전이 바뀐 날), wv(문구 사전 해시), tho_d(허가 숫자의 허가일)
  seoul.d / seoul.w : {trade, hi, notice, stage, tho, auc_new, auc_drop, auc_sale} 오늘 / 이번 주(7일) — bf 뺌
  seoul.bf          : {trade, auction, …} 오늘 밀린 자료 · seoul.bfw 이번 주 밀린 자료
  dd                : [[날짜, {같은 열쇠}], …] 7일(오늘 먼저)
  ev                : [[구역, 종류, 날짜, 문구, 표시, 개수(, 서울 셈 u(, 대표 최저가 억))], …] 7일 · 종류 trade·notice·stage·auction·tho · 표시 글자 h 신고가 · b 밀린 자료 · x 해제됨 · d 유찰 하락 · o 인가 고시
                      u = 겹치는 구역(모아 상위·하위, 마포로1 지구 등)에서 이미 센 거래 지문(tk)·사건번호(ck)·허가 접수번호를 뺀 수(개수와 같으면 생략) — 서울 숫자 = u 합(/gu·월간과 같은 셈)
                      경매 줄은 늘 8칸(u 또는 null, 대표 최저가 억 mn — '내 돈 안만'의 물건 단위 규칙)
  auc               : [[구역, 사건번호, 물건번호, 매각기일, 시각, 최저가, 감정가, 유찰, 최저가율, 법원, 용도, 표시, 직전 최저가, 마지막 확인 = asOf보다 며칠 전], …] 오늘~14일 · 표시 j 지분 · s 소규모주택정비법 사업(가로주택·소규모·모아)
  tsg               : [[구역, …], …] 거래 표본(tx.json s)이 똑같은 구역 묶음(모아타운 하위 구역끼리 등) — 화면 '모아타운 전체 표본' 꼬리용
  cts               : {법원: 전체 수집일} — 일정 줄 '법원 확인' · 3일 넘으면 D-day·일정 칩·푸시 D-1 숨김
  rad               : {g: {구역: [7일 전, 지금, 원인 문구]}, c: {…}} 계산 버전 바뀐 날 변화는 빼고 견줌 · 원인 모르는 구역은 뺌
  tho               : {구역: [7일, 30일]} 주거용 허가
사용: python3 tools/today.py [--asof YYYY-MM-DD] [--replay 30 --out DIR] [--tho-lag 1]"""
import json, os, re, sys, gzip, hashlib, datetime, collections, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zsample import auc_amt
ROOT = os.environ.get('ZP_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda p: os.path.join(ROOT, p)
def J(p, d=None):
    try: return json.load(open(P(p), encoding='utf-8'))
    except Exception: return d
WP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'feed_words.json')
WORDS = json.load(open(WP, encoding='utf-8'))
WV = hashlib.md5(open(WP, 'rb').read()).hexdigest()[:8]
KST = datetime.timezone(datetime.timedelta(hours=9))
DAYS_EV, DAYS_SCHED = 7, 14
KEYS = ('trade', 'hi', 'notice', 'stage', 'tho', 'auc_new', 'auc_drop', 'auc_sale')
dd = lambda s: datetime.date.fromisoformat(s)
add = lambda s, n: (dd(s) + datetime.timedelta(days=n)).isoformat()
eok = lambda v: f"{round(v, 1):g}억"

def fill(t, **kw):
    return re.sub(r'\{(\w+)\}', lambda m: f"{kw[m.group(1)]:,}" if isinstance(kw.get(m.group(1)), int) and not isinstance(kw.get(m.group(1)), bool) else str(kw.get(m.group(1), m.group(0))), t)

def why_text(w):
    """원인 {jr:[a,b], px:[a,b], sm:[n0,n1]|1, st:[s0,s1]} → '전세 기준 ▲0.3억 · 표본 21→23건' (사전 rad.why)"""
    out, W = [], WORDS['rad']['why']
    for code in ('jr', 'px', 'sm', 'st'):
        v = w.get(code)
        if v is None: continue
        if code in ('jr', 'px'):
            if abs(v[1] - v[0]) < 0.05: continue   # 화면 꼴(0.1억 단위)로 0이면 쓰지 않는다
            out.append(fill(W[code], a=('▲' if v[1] > v[0] else '▼') + eok(abs(v[1] - v[0]))))
        elif code == 'sm':
            if isinstance(v, list) and v[0] != v[1]: out.append(fill(W[code], a=v[0], b=v[1]))
        else: out.append(W[code])
    return ' · '.join(out)

def load():
    ch = J('public/data/changes.json', {}) or {}
    au = J('public/data/auction.json', {}) or {}
    st = J('pipeline/cache/changes_state.json', {}) or {}
    th = J('pipeline/cache/toheo.json', {}) or {}
    par = J('pipeline/cache/parcels.json', {}) or {}
    p2z = collections.defaultdict(list)
    for rid, v in par.items():
        for p in v.get('p') or []: p2z[p[0]].append(rid)
    # 구역 안 주거용 허가(허가만): [[허가일, 구역, 접수번호], …] — toheo.py와 같은 지번 맞춤 · 접수번호로 겹치는 구역을 한 번만 센다
    tho = []
    for k, v in th.items():
        if not isinstance(v, list) or len(v) < 6 or v[5] != '허가' or v[4] != '주거용' or not re.match(r'^\d{8}$', str(v[0])): continue
        d = f"{v[0][:4]}-{v[0][4:6]}-{v[0][6:]}"
        for rid in dict.fromkeys(p2z.get(v[1], [])): tho.append((d, rid, k))
    return ch, au, st, tho

# ---------- 겹치는 구역 한 번만(오늘 카드·/gu·월간 같은 셈) ----------
def ev_keys(e):
    """사건 하나가 가리키는 실제 거래·물건 열쇠: 거래 지문(tk) · 경매 사건·물건번호(ck) · 없으면 (날짜·구·문구·순번)"""
    t = e.get('type'); n = e.get('cnt') if isinstance(e.get('cnt'), int) else 1
    if t == 'trade' and e.get('tk'): return [('t', x) for x in e['tk']]
    if t == 'auction' and e.get('ck'): return [('a' + (e.get('ak') or ''), x) for x in e['ck']]
    if t in ('trade', 'auction'): return [(t[0] + (e.get('ak') or ''), e.get('date'), e.get('g') or '', e.get('text') or '', i) for i in range(n)]
    return [(t, e.get('id'), e.get('date'), re.sub(r'(고시|공고)$', '', re.sub(r'\s+', '', e.get('text') or '')) if t == 'notice' else e.get('text') or '')]   # 같은 날 같은 고시('(변경)인가고시'·'(변경)인가')는 하나(changes.py notices와 같은 이름 맞춤)
def uniq_n(events, seen=None):
    """사건 목록의 중복 없는 건수(같은 거래가 겹치는 구역 여러 곳에 올라도 1)"""
    seen = set() if seen is None else seen; n = 0
    for e in events:
        for k in ev_keys(e):
            if k not in seen: seen.add(k); n += 1
    return n
def tho_uniq(tho, ids, d0, d1):
    """구역 묶음(ids) 안 주거용 허가를 접수번호로 한 번만: d0 < 허가일 ≤ d1"""
    return len({k for d, rid, k in tho if rid in ids and d0 < d <= d1})
def same_sample():
    """거래 표본(public/data/tx.json 구역별 s)이 똑같은 구역 묶음 — 하위 구역이 상위(모아타운 전체) 표본을 같이 쓰는 곳"""
    tx = J('public/data/tx.json', {}) or {}; g = collections.defaultdict(list)
    for i, v in tx.items():
        s_ = (v or {}).get('s') if isinstance(v, dict) else None
        if s_: g[json.dumps(s_, separators=(',', ':'))].append(i)
    return sorted(sorted(L) for L in g.values() if len(L) > 1)
SMALL_RE = re.compile(r'가로|소규모|모아')
def small_ids():
    """소규모주택정비법 사업(가로주택·소규모재건축·소규모재개발·모아타운) 구역 id — 일정 고지를 사업 종류로 나눈다"""
    D = J('pipeline/data.enriched.json') or J('src/data.json') or {}
    return {r['id'] for r in D.get('recs') or [] if r.get('id') and (r.get('src') == 'moa' or SMALL_RE.search(r.get('k') or ''))}

def build(asof, ch, au, st, tho, tho_lag=0):
    items = [e for e in (ch.get('items') or []) if isinstance(e, dict) and e.get('date') and e['date'] <= asof]
    d0 = add(asof, -(DAYS_EV - 1))
    week = [add(asof, -k) for k in range(DAYS_EV)]
    # ---------- 사건(7일) ----------
    ev, cnt, bfc = [], {d: collections.Counter() for d in week}, {d: collections.Counter() for d in week}
    seen, seen_b = set(), set()   # 겹치는 구역 한 번만(밀린 자료는 따로)
    for e in sorted(items, key=lambda x: (x['date'], x.get('id') or '', -len(x.get('text') or ''), x.get('k') or '')):   # 같은 고시 두 줄이면 긴 이름이 남게
        if e['date'] < d0 or e.get('type') not in ('trade', 'notice', 'stage', 'auction'): continue
        f = ''
        if e.get('hi'): f += 'h'
        if e.get('bf'): f += 'b'
        if e.get('x') and str(e.get('xd') or '') <= asof: f += 'x'
        if e.get('ak') == 'drop': f += 'd'
        if e.get('type') == 'notice' and e.get('cat') == 'ok': f += 'o'
        n = e.get('cnt') if isinstance(e.get('cnt'), int) else 1
        u = uniq_n([e], seen_b if 'b' in f else seen)
        if e['type'] in ('notice', 'stage') and not u: continue   # 같은 고시 두 줄은 한 줄만
        row = [e['id'], e['type'], e['date'], e.get('text') or '', f, n]
        if e['type'] == 'auction': row += [u if u != n else None, e.get('mn')]
        elif u != n: row.append(u)
        ev.append(row)
        C = bfc if 'b' in f else cnt
        t = e['type']
        if t == 'trade':
            C[e['date']]['trade'] += u
            if u and 'h' in f and 'x' not in f: C[e['date']]['hi'] += 1
        elif t == 'auction': C[e['date']]['auc_drop' if 'd' in f else 'auc_new'] += u
        elif u: C[e['date']][t] += 1
    # 토지거래허가: 구역·허가일별 한 줄(주거용 허가 건수) — 자료는 하루쯤 늦게 올라와 '가장 최근 허가일' 숫자를 기준일과 함께 쓴다
    tho = [x for x in tho if x[0] <= add(asof, -tho_lag)]
    thd = collections.Counter((d, rid) for d, rid, _ in tho)
    thk = collections.defaultdict(list)
    for d, rid, k in tho: thk[(d, rid)].append(k)
    last_tho = max((d for d, _ in thd), default=None)
    tseen = set()
    for (d, rid), n in sorted(thd.items(), key=lambda x: (x[0][0], x[0][1])):
        u = len(set(thk[(d, rid)]) - tseen); tseen |= set(thk[(d, rid)])
        if d < add(last_tho or asof, -(DAYS_EV - 1)): continue
        ev.append([rid, 'tho', d, f"토지거래허가 {n}건(주거용 · {int(d[5:7])}.{int(d[8:10])} 허가)", '', n] + ([u] if u != n else []))
    tho_day = collections.Counter()
    for d, _, k in {(d, 0, k) for d, rid, k in tho}: tho_day[d] += 1   # 서울 = 접수번호 한 번만
    # ---------- 경매 일정(오늘~14일 · 그날 기준 '예정'이었던 물건 · 사건·물건번호 하나씩) ----------
    sched, seen, SM = [], set(), small_ids()
    def up_at(o):   # 그날 예정 물건이었나: 처음 본 날 ≤ 그날 · 빠짐(gone)은 마지막으로 본 날까지만
        if str(o.get('fs') or '9') > asof: return False
        if o.get('st') == 'gone' and str(o.get('ls') or '') < asof: return False
        return True
    for z, L in sorted((au.get('byZone') or {}).items()) if au.get('ok') else []:
        for o in L or []:
            if not isinstance(o, dict) or not o.get('cs') or not re.match(r'^\d{4}-\d\d-\d\d$', str(o.get('date') or '')): continue
            if not (asof <= o['date'] <= add(asof, DAYS_SCHED)) or not up_at(o): continue
            k = f"{o['cs']}#{o.get('no') or 1}"
            if k in seen: continue
            seen.add(k)
            mh = [h for h in (o.get('mh') or []) if isinstance(h, list) and len(h) >= 3 and str(h[0]) <= asof]
            pm = mh[-2][2] if len(mh) >= 2 and isinstance(mh[-2][2], (int, float)) and mh[-2][2] > (o.get('min') or 0) else None
            sched.append([z, o['cs'], o.get('no') or 1, o['date'], o.get('time') or '', o.get('min'), o.get('appr'), o.get('fail'), o.get('rate'),
                          o.get('court') or '', o.get('use') or '', ('j' if o.get('jb') else '') + ('s' if z in SM else ''), pm, (dd(asof) - dd(o.get('ls') or o.get('fs'))).days if re.match(r'^\d{4}-\d\d-\d\d$', str(o.get('ls') or o.get('fs') or '')) else None])
    sched.sort(key=lambda x: (x[3], x[4], x[1], x[2]))
    sale_today = sum(1 for x in sched if x[3] == asof)
    # ---------- 숫자(오늘 · 이번 주 · 날마다) ----------
    def day(d):
        c = dict(cnt.get(d) or {})
        c['tho'] = tho_day.get(d, 0)
        c['auc_sale'] = sale_today if d == asof else 0
        return {k: int(c.get(k, 0)) for k in KEYS}
    today_c = day(asof)
    today_c['tho'] = tho_day.get(last_tho, 0) if last_tho else 0   # 오늘 줄 = 가장 최근 허가일 숫자(tho_d와 같이 씀)
    wk = collections.Counter()
    for d in week:
        for k, v in (cnt.get(d) or {}).items(): wk[k] += v
    for d, n in tho_day.items():
        if last_tho and add(last_tho, -(DAYS_EV - 1)) <= d <= last_tho: wk['tho'] += n
    wk['auc_sale'] = 0
    # 이번 주 매각기일(지난 7일): 그 주에 기일이 있었던 사건·물건 수
    ws = set()
    for z, L in (au.get('byZone') or {}).items() if au.get('ok') else []:
        for o in L or []:
            if isinstance(o, dict) and d0 <= str(o.get('date') or '') <= asof and str(o.get('fs') or '9') <= str(o.get('date')): ws.add(f"{o.get('cs')}#{o.get('no') or 1}")
    wk['auc_sale'] = len(ws)
    bf_today = {k: v for k, v in (bfc.get(asof) or {}).items() if v}
    bfw = collections.Counter()
    for d in week:
        for k, v in (bfc.get(d) or {}).items(): bfw[k] += v
    # ---------- 내 돈 레이더 자료(7일 비교 · 계산 버전 바뀐 날 뺌) ----------
    snap = st.get('snap') or {}
    PD = st.get('pd') or {}
    rad = {'g': {}, 'c': {}}
    for n, m in enumerate(('g', 'c')):
        acc = {}
        for d, z in PD.items():
            for i, v in (z or {}).items():
                a = acc.setdefault(i, {'after': 0.0, 'win': 0.0, 'why': {}, 'any': False})
                dv = v[n] if isinstance(v, list) and len(v) > n and isinstance(v[n], (int, float)) else 0.0
                if d > asof: a['after'] += dv
                elif d >= d0 and not (len(v) > 3 and v[3]):
                    a['win'] += dv
                    if dv:
                        a['any'] = True
                        for code, wv in (v[2] or {}).items():
                            if code in ('jr', 'px', 'sm') and isinstance(wv, list):
                                p0 = a['why'].get(code); a['why'][code] = [p0[0] if p0 else wv[0], wv[1]]
                            elif code not in a['why']: a['why'][code] = wv
        for i, a in acc.items():
            cur = (snap.get(i) or {}).get(m)
            if not a['any'] or cur is None: continue
            now = round(cur - a['after'], 2); old = round(now - a['win'], 2)
            w = {k: v for k, v in a['why'].items() if k != 'na'}
            if abs(now - old) < 0.005 or not w: continue   # 원인 모르는 구역은 뺀다
            t = why_text(w)
            if not t: continue
            rad[m][i] = [old, now, t]
    # ---------- 구역별 허가(7일 · 30일) ----------
    tz = collections.defaultdict(lambda: [0, 0])
    if last_tho:
        for (d, rid), n in thd.items():   # 구역별(시트 한 줄 · 그 구역 숫자라 겹침을 빼지 않음)
            if d > add(last_tho, -30): tz[rid][1] += n
            if d > add(last_tho, -DAYS_EV): tz[rid][0] += n
    # 계산 버전 바뀐 날: 날마다 버전 기록(vh)이 바뀐 날 + 그날 필요한 돈 변화가 계산 버전 때문(pd cv 표시 · price why cv)인 날 — 기록이 하루뿐이어도 잡는다
    vh = st.get('vh') or {}
    vs = sorted(vh.items()); cvd = {d for (d0_, v0), (d, v) in zip(vs, vs[1:]) if v != v0}
    cvd |= {d for d, z in PD.items() if any(isinstance(v, list) and len(v) > 3 and v[3] for v in (z or {}).values())}
    cvd |= {e['date'] for e in items if e.get('type') == 'price' and 'cv' in (e.get('why') or [])}
    cvd = sorted(d for d in cvd if add(asof, -30) < d <= asof)
    ev.sort(key=lambda x: (x[2], {'stage': 5, 'notice': 4, 'auction': 3, 'trade': 2, 'tho': 1}.get(x[1], 0), x[5]), reverse=True)
    cts = {c: d for c, d in sorted((au.get('cts') or {}).items()) if isinstance(d, str)} if au.get('ok') else {}
    return {'v': 1, 'asOf': asof, 'w': tj_words(), 'ver': st.get('ver') or ch.get('ver') or '', 'cvd': cvd, 'wv': WV, 'tho_d': last_tho, 'cts': cts, 'tsg': same_sample(),
            'seoul': {'d': today_c, 'w': {k: int(wk.get(k, 0)) for k in KEYS}, 'bf': bf_today, 'bfw': dict(bfw)},
            'dd': [[d, day(d)] for d in week], 'ev': ev, 'auc': sched, 'rad': rad, 'tho': dict(sorted(tz.items()))}

def tj_words():
    """오늘 묶음 6KB 상한 때문에 today.json에 싣는 긴 문장(feed_words.json _tj 목록) — 앱 ZP_today가 문구 사전 W에 합친다"""
    out = {}
    for k, ks in (WORDS.get('_tj') or {}).items():
        if k == '_' or k not in WORDS: continue
        out[k] = WORDS[k] if not isinstance(ks, list) else {x: WORDS[k][x] for x in ks if x in WORDS[k]}
    return out

def dump(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':'))

def fit(o, asof):
    """상한 10KB(gzip): 넘으면 오래된 날 거래 줄부터 줄인다(오늘 줄은 숫자와 맞아야 해서 그대로 · cut 1) — 매일 파일·재생 모두 같은 규칙"""
    body = dump(o); gz = len(gzip.compress(body.encode(), 9))
    if gz > 10240:
        keep = [x for x in o['ev'] if x[2] == asof or x[1] != 'trade']
        rest = [x for x in o['ev'] if not (x[2] == asof or x[1] != 'trade')]
        while rest and gz > 10240:
            rest = rest[:int(len(rest) * 0.8)]
            o['ev'] = sorted(keep + rest, key=lambda x: (x[2],), reverse=True); o['cut'] = 1
            body = dump(o); gz = len(gzip.compress(body.encode(), 9))
    return body, gz

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--asof'); ap.add_argument('--replay', type=int, default=0); ap.add_argument('--out'); ap.add_argument('--tho-lag', type=int, default=0)
    A = ap.parse_args()
    ch, au, st, tho = load()
    asof = A.asof or os.environ.get('CHANGES_TODAY') or ch.get('asOf') or datetime.datetime.now(KST).date().isoformat()
    if A.replay:
        os.makedirs(A.out, exist_ok=True)
        for k in range(A.replay):
            d = add(asof, -k)
            open(os.path.join(A.out, f'today.{d}.json'), 'w', encoding='utf-8').write(fit(build(d, ch, au, st, tho, A.tho_lag), d)[0])
        print('today replay', A.replay, 'days →', A.out)
        return
    o = build(asof, ch, au, st, tho, A.tho_lag)
    body, gz = fit(o, asof)
    out = P('public/data/today.json')
    if not os.path.exists(out) or open(out, encoding='utf-8').read() != body:
        open(out, 'w', encoding='utf-8').write(body)
    print('today', asof, 'ev', len(o['ev']), 'auc', len(o['auc']), 'rad', len(o['rad']['g']), len(o['rad']['c']), 'd', o['seoul']['d'], 'bf', o['seoul']['bf'], f'{len(body)//1024}KB gzip {gz}B')

if __name__ == '__main__':
    main()
