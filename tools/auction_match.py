#!/usr/bin/env python3
"""법원경매 물건(tools/auction.js 결과) → 구역별 목록 public/data/auction.json
매칭: ① 법정동 코드 + 지번(산·본번·부번)이 구역 경계 안 필지 목록(pipeline/cache/parcels.json)에 있으면 그 구역
      ② 필지 목록이 없는 공식 경계 구역(추정 원 경계 제외)만, 물건 좌표(KATEC)를 경위도로 바꿔 경계 안에 드는지
사용: python3 tools/auction_match.py [raw=pipeline/raw/auction_raw.json] [out=public/data/auction.json] [오늘=YYYY-MM-DD] [상태=pipeline/cache/auction_state.json]
수집기(tools/auction.js)는 날마다 새로 들어온 날·가까운 날만 검색한다 → 여기서 상태(auction_state.json)에 쌓고 auction.json은 상태에서 만든다.
상태 물건: firstSeen·lastSeen·status(up=예정 / gone=끝까지 받은 검색 범위인데 빠짐 / chk=기일 지남·다음 기일 확인 중, 45일 뒤 뺌).
auction.json 물건: fs·ls·st(없음=예정)·est(chk일 때 유찰 시 다음 최저가 80% 추정)."""
import json, math, os, re, sys, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
# 서울 법원 관할(구) — 한 법원이 실패하면 그 구 구역은 '못 가져옴'으로 보여 준다
JUR = {'서울중앙지방법원': '강남구 관악구 동작구 서초구 종로구 중구', '서울동부지방법원': '강동구 광진구 성동구 송파구',
       '서울서부지방법원': '마포구 서대문구 용산구 은평구', '서울남부지방법원': '강서구 구로구 금천구 양천구 영등포구',
       '서울북부지방법원': '강북구 노원구 도봉구 동대문구 성북구 중랑구'}
LOT = re.compile(r'^\s*(산)?\s*(\d+)(?:-(\d+))?')
# 부동산 아닌 것(자동차·중기 등)은 걸러 낸다
NOT_RE = re.compile(r'자동차|중기|선박|항공기|건설기계')


def today():
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')


def pnu_of(it):
    """물건 → 19자리 PNU(법정동 10 + 산 1 + 본번 4 + 부번 4) · 못 만들면 None"""
    dong = str(it.get('srchHjguDongCd') or '').strip()
    lot = str(it.get('srchHjguLotno') or it.get('daepyoLotno') or '').strip()
    if len(dong) == 8: dong += '00'
    if len(dong) != 10 or not dong.isdigit(): return None
    m = LOT.match(lot)
    if not m: return None
    return f"{dong}{'2' if m.group(1) else '1'}{int(m.group(2)):04d}{int(m.group(3) or 0):04d}"


def fail_n(it):
    """유찰 횟수: 서울 법원은 유찰마다 최저가 20% 낮춤 → 최저가율로 계산, 어긋나면 yuchalCnt"""
    try: rate = float(it.get('notifyMinmaePriceRate1') or 0)
    except ValueError: rate = 0
    yc = it.get('yuchalCnt')
    yc = int(yc) if str(yc or '').isdigit() else None
    if 0 < rate <= 100:
        x = math.log(rate / 100) / math.log(0.8)
        if abs(x - round(x)) < 0.2: return int(round(x))
    return yc


def num(v):
    try: return int(float(str(v).replace(',', '')))
    except (TypeError, ValueError): return None


def area_of(it):
    c = re.sub(r'<[^>]+>', ' ', str(it.get('convAddr') or '')).strip()
    if c:
        c = re.sub(r'\s+', ' ', c.replace('[', '').replace(']', ' · ')).strip(' ·')
        return c[:120]
    parts = [str(it.get(k) or '').strip() for k in ('areaList', 'pjbBuldList')]
    return ' · '.join(p for p in parts if p)[:120]


def parse(it):
    """원자료 한 줄 → 화면용 작은 꼴"""
    d = str(it.get('maeGiil') or '')
    hh = str(it.get('maeHh1') or '').strip()
    cs = str(it.get('srnSaNo') or '').strip()
    ms = str(it.get('maemulSer') or '1').strip()
    lot = str(it.get('srchHjguLotno') or it.get('daepyoLotno') or '').strip()
    addr = ' '.join(x for x in [str(it.get('hjguSigu') or '').strip(), str(it.get('hjguDong') or '').strip(), lot] if x)
    bld = ' '.join(x for x in [str(it.get('buldNm') or '').strip(), str(it.get('buldList') or '').strip()] if x)
    o = {'cs': cs, 'no': int(ms) if ms.isdigit() and ms != '1' else None, 'court': str(it.get('jiwonNm') or it.get('_court') or '').strip(),
         'dept': str(it.get('jpDeptNm') or '').strip() or None,
         'date': f'{d[:4]}-{d[4:6]}-{d[6:8]}' if len(d) == 8 else None,
         'time': f'{hh[:2]}:{hh[2:4]}' if len(hh) == 4 and hh.isdigit() else None,
         'appr': num(it.get('gamevalAmt')), 'min': num(it.get('notifyMinmaePrice1') or it.get('minmaePrice')),
         'rate': num(it.get('notifyMinmaePriceRate1')), 'fail': fail_n(it), 'use': str(it.get('dspslUsgNm') or '').strip() or None,
         'addr': addr, 'bld': bld or None, 'area': area_of(it) or None, 'note': str(it.get('mulBigo') or '').strip() or None}
    return {k: v for k, v in o.items() if v is not None}


def katec_ll(x, y):
    try:
        from pyproj import Transformer
    except ImportError: return None
    global _TR
    try: _TR
    except NameError:
        _TR = Transformer.from_crs('+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +units=m', 'EPSG:4326', always_xy=True)
    lng, lat = _TR.transform(x, y)
    return (lng, lat) if 126.7 < lng < 127.3 and 37.4 < lat < 37.75 else None


def load_zones(parcels=None, geo=None):
    parcels = json.load(open(P('pipeline/cache/parcels.json'))) if parcels is None else parcels
    geo = json.load(open(P('public/data/geo.json'), encoding='utf-8')) if geo is None else geo
    idx = {}
    for rid, v in parcels.items():
        for p in v.get('p') or []: idx.setdefault(p[0], []).append(rid)
    polys = []
    try:
        from shapely.geometry import Polygon
        for rid, z in (geo.get('z') or {}).items():
            if z.get('e') or parcels.get(rid, {}).get('p'): continue
            try: polys.append((rid, Polygon(z['g'][0], z['g'][1:]).buffer(0)))
            except Exception: pass
    except ImportError: pass
    return idx, polys


def match(items, idx, polys, day=None):
    day = day or today()
    by, seen, stat = {}, set(), {'pnu': 0, 'pt': 0, 'none': 0, 'old': 0, 'skip': 0}
    for it in items:
        if str(it.get('hjguSido') or '서울').find('서울') < 0 or NOT_RE.search(str(it.get('dspslUsgNm') or '')): stat['skip'] += 1; continue
        o = parse(it)
        if o.get('date') and o['date'] < day: stat['old'] += 1; continue
        key = (o['cs'], o.get('no'))
        if key in seen: continue
        seen.add(key)
        z = idx.get(pnu_of(it) or '', [])
        if z: stat['pnu'] += 1
        elif polys and num(it.get('xCordi')) and num(it.get('yCordi')):
            ll = katec_ll(num(it['xCordi']), num(it['yCordi']))
            if ll:
                from shapely.geometry import Point
                pt = Point(*ll); z = [rid for rid, g in polys if g.contains(pt)]
                if z: stat['pt'] += 1
        if not z: stat['none'] += 1
        for rid in z: by.setdefault(rid, []).append(o)
    for v in by.values(): v.sort(key=lambda o: (o.get('date') or '9', o['cs']))
    return by, stat


KEEP_DAYS = 45   # 기일이 지난 뒤 다시 안 보이는 물건을 '확인 중'으로 두는 날 수
STATE_P = P('pipeline/cache/auction_state.json')
akey = lambda o: f"{o.get('cs')}#{o.get('no') or 1}"
dd = lambda s: datetime.date.fromisoformat(s)
add = lambda s, n: (dd(s) + datetime.timedelta(days=n)).isoformat()


def zones_of(it, idx, polys):
    z = idx.get(pnu_of(it) or '', [])
    if z: return list(z), 'pnu'
    if polys and num(it.get('xCordi')) and num(it.get('yCordi')):
        ll = katec_ll(num(it['xCordi']), num(it['yCordi']))
        if ll:
            from shapely.geometry import Point
            pt = Point(*ll); z = [rid for rid, g in polys if g.contains(pt)]
            if z: return z, 'pt'
    return [], 'none'


def searches_of(raw):
    """수집 결과의 검색 목록(v2) · 예전 꼴(법원별 2주 전체 한 번)은 검색 하나로 친다"""
    if raw.get('searches') is not None: return raw['searches']
    a = raw.get('asOf') or today()
    out = []
    for c in raw.get('courts') or []:
        tot, got = c.get('total') or 0, c.get('got') or 0
        out.append({'court': c.get('court'), 'kind': 'full', 'from': a, 'to': add(a, 13), 'total': tot, 'got': got,
                    'complete': bool(c.get('ok') and tot > 0 and got >= tot * 0.99)})
    return out


def bootstrap_state(prev):
    """상태 파일이 없을 때: 이전 auction.json의 구역 안 물건으로 시작(법원 정보는 비움 → 수집기가 법원마다 전체 검색)"""
    st = {'asOf': None, 'courts': {}, 'items': {}}
    if not prev or not prev.get('ok'): return st
    a = prev.get('asOf')
    for z, v in (prev.get('byZone') or {}).items():
        for o in v or []:
            if not isinstance(o, dict) or not o.get('cs'): continue
            k = akey(o)
            x = st['items'].get(k) or {kk: vv for kk, vv in o.items() if kk not in ('st', 'est', 'fs', 'ls')}
            x.setdefault('firstSeen', o.get('fs') or a); x.setdefault('lastSeen', o.get('ls') or a)
            x['status'] = {'chk': 'chk', 'gone': 'gone'}.get(o.get('st'), 'up')
            x['zones'] = sorted(set(x.get('zones') or []) | {z})
            st['items'][k] = x
    return st


def update(state, raw, idx, polys, day):
    """오늘 수집(raw)을 상태에 반영. 돌려주는 것: 통계"""
    items, S = raw.get('items') or [], state['items']
    a = raw.get('asOf') or day
    stat = {'raw': len(items), 'new': 0, 'seen': 0, 'pnu': 0, 'pt': 0, 'zone_new': 0, 'skip': 0, 'gone': 0, 'refresh': 0, 'chk': 0, 'drop': 0}
    seen = set()
    for it in items:
        o = parse(it)
        if not o.get('cs') or not o.get('date'): continue
        k = it.get('docid') or akey(o)   # 상태 열쇠: docid(검색 건수와 맞춰 보려고) · 없으면 사건번호#물건번호
        if k in seen: continue
        seen.add(k)
        old = S.get(k)
        if old is None and akey(o) in S and not S[akey(o)].get('docid'): old = S.pop(akey(o))   # 이전 auction.json에서 시작한 기록
        rec = {'cs': o['cs'], 'no': o.get('no'), 'court': o.get('court') or it.get('_court'), 'date': o['date'], 'docid': it.get('docid')}
        z = []
        if not (str(it.get('hjguSido') or '서울').find('서울') < 0 or NOT_RE.search(str(it.get('dspslUsgNm') or ''))):
            z, how = zones_of(it, idx, polys) if idx is not None else ([], 'none')
            if z: stat[how] += 1
        if z: rec.update(o); rec['zones'] = sorted(z)
        rec = {kk: vv for kk, vv in rec.items() if vv is not None}
        rec['firstSeen'] = (old or {}).get('firstSeen') or a
        rec['lastSeen'] = a; rec['status'] = 'up'
        if z and not (old and old.get('zones')): stat['zone_new'] += 1
        stat['seen' if old else 'new'] += 1
        S[k] = rec
    # 끝까지 받은 검색 범위 안인데 오늘 안 보인 예정 물건 → gone(건너뛴 검색이면 그대로 있는 것으로)
    C = state.setdefault('courts', {})
    for sc in searches_of(raw):
        if not sc.get('complete') or not sc.get('court'): continue
        lo, hi = sc.get('from') or a, sc.get('to') or a
        for k, o in S.items():
            if k in seen or o.get('court') != sc['court'] or not (lo <= (o.get('date') or '') <= hi): continue
            if sc.get('skip') and o.get('status') == 'up': o['lastSeen'] = a; stat['skip'] += 1
            elif not sc.get('skip') and o.get('status') == 'up' and not sc.get('noreq'): o['status'] = 'gone'; stat['gone'] += 1
        c = C.setdefault(sc['court'], {})
        if sc.get('how'): c['how'] = sc['how']
        end = (sc.get('cover') or [None, hi])[1]
        if sc.get('kind') in ('full', 'refresh') or sc.get('fallback') == 'full':
            c['lastFullDate'] = a; c['through'] = max(c.get('through') or '', end); stat['refresh'] += sc.get('kind') == 'refresh'
        elif sc.get('kind') == 'new' and (c.get('through') or '') >= add(lo, -1 - 7):
            c['through'] = max(c.get('through') or '', end)
    if any(sc.get('complete') for sc in searches_of(raw)): state['asOf'] = max(state.get('asOf') or '', a)
    # 기일이 지난 물건: 구역 안 → chk(45일까지), 구역 밖 → 뺀다
    for k in list(S):
        o = S[k]; d = o.get('date') or ''
        if d and d < day and k not in seen:
            if not o.get('zones') or (dd(day) - dd(d)).days > KEEP_DAYS: del S[k]; stat['drop'] += 1; continue
            if o.get('status') != 'chk': o['status'] = 'chk'; stat['chk'] += 1
    return stat


def derive(state, day):
    """상태 → 화면용 auction.json(구역 안 물건: 예정 · 목록에서 빠짐 · 기일 지남 45일까지)"""
    by = {}
    for o in state['items'].values():
        if not o.get('zones'): continue
        x = {kk: vv for kk, vv in o.items() if kk not in ('zones', 'docid', 'firstSeen', 'lastSeen', 'status')}
        x['fs'], x['ls'] = o.get('firstSeen'), o.get('lastSeen')
        st = o.get('status') or 'up'
        if st != 'up': x['st'] = st
        if st == 'chk' and isinstance(o.get('min'), (int, float)) and o['min'] > 0: x['est'] = int(round(o['min'] * 0.8, -5))
        for z in o['zones']:
            m = by.setdefault(z, {}); k = akey(x)   # 같은 사건·물건번호(목록 여러 줄)는 한 번만: 예정 · 최근 확인 우선
            if k not in m or ((not x.get('st'), x.get('ls') or '') > (not m[k].get('st'), m[k].get('ls') or '')): m[k] = x
    by = {z: list(m.values()) for z, m in by.items()}
    for z, v in by.items():
        k0 = lambda o: (o.get('date') or '9', o['cs'], o.get('no') or 1)
        by[z] = sorted([o for o in v if not o.get('st')], key=k0) + sorted([o for o in v if o.get('st') == 'gone'], key=k0) \
            + sorted([o for o in v if o.get('st') == 'chk'], key=lambda o: o.get('date') or '', reverse=True)
    recs = {akey(o): o for v in by.values() for o in v}
    cts = {c: v.get('lastFullDate') for c, v in (state.get('courts') or {}).items() if c in JUR and v.get('lastFullDate')}
    out = {'asOf': state.get('asOf') or day, 'chkd': day, 'ok': True, 'src': '법원경매정보', 'up': sum(1 for o in recs.values() if not o.get('st')),
           'all': len(recs), 'cts': cts, 'byZone': dict(sorted(by.items()))}
    have = {o.get('court') for o in state['items'].values()}
    miss = sorted({g for c in JUR if c not in cts and c not in have for g in JUR[c].split()})   # 한 번도 못 받은 법원의 구
    if miss: out['miss'] = miss
    return out


def main(raw_p=None, out_p=None, day=None, state_p=None):
    raw_p = raw_p or P('pipeline/raw/auction_raw.json'); out_p = out_p or P('public/data/auction.json')
    state_p = state_p or os.environ.get('AUCTION_STATE') or STATE_P
    day = day or os.environ.get('AUCTION_TODAY') or today()
    prev = None
    if os.path.exists(out_p):
        try: prev = json.load(open(out_p, encoding='utf-8'))
        except Exception: prev = None
    state = None
    if os.path.exists(state_p):
        try: state = json.load(open(state_p, encoding='utf-8'))
        except Exception: state = None
    if not isinstance(state, dict) or not isinstance(state.get('items'), dict): state = bootstrap_state(prev); print('경매 상태 새로 시작(이전 auction.json 구역 물건', len(state['items']), '건)')
    raw = json.load(open(raw_p, encoding='utf-8')) if os.path.exists(raw_p) else {'ok': False, 'err': 'no-raw', 'items': []}
    if 'data' in raw and 'dlt_srchResult' in (raw.get('data') or {}):   # 사이트 응답 원형(fixture): 법원마다 2주 전체를 다 받은 것으로
        its = raw['data']['dlt_srchResult']
        raw = {'ok': True, 'asOf': day, 'items': its, 'searches': [{'court': c, 'kind': 'full', 'from': day, 'to': add(day, 13), 'complete': True} for c in JUR]}
    if not raw.get('ok'):
        print('!! 경매 수집 일부/전부 실패:', raw.get('err') or '', [(c.get('court'), c.get('err')) for c in raw.get('courts') or [] if not c.get('ok')])
    idx, polys = load_zones() if raw.get('items') else (None, None)
    stat = update(state, raw, idx, polys, day)
    state['v'] = 1
    out = derive(state, day) if state['items'] or state.get('asOf') else {'asOf': day, 'ok': False, 'src': '법원경매정보', 'byZone': {}}
    out['n'] = len(raw.get('items') or [])
    if not any(sc.get('complete') for sc in searches_of(raw)): out['stale'] = 1
    print('경매 오늘 받은', stat['raw'], '건', stat, '· 상태', len(state['items']), '건 · 구역 안', out.get('all', 0), '건(예정', out.get('up', 0), ') /', len(out['byZone']), '구역',
          '· 법원', {c[2:4]: (v.get('lastFullDate'), v.get('through'), v.get('how')) for c, v in state.get('courts', {}).items()}, ('· 못 가져온 구 ' + ','.join(out['miss'])) if out.get('miss') else '')
    os.makedirs(os.path.dirname(state_p), exist_ok=True)
    json.dump(state, open(state_p + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), sort_keys=True); os.replace(state_p + '.tmp', state_p)
    body = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    if not os.path.exists(out_p) or open(out_p, encoding='utf-8').read() != body:
        open(out_p, 'w', encoding='utf-8').write(body)
    return out


if __name__ == '__main__':
    main(*(sys.argv[1:5]))
