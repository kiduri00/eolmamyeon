#!/usr/bin/env python3
"""법원경매 물건(tools/auction.js 결과) → 구역별 목록 public/data/auction.json
매칭: ① 법정동 코드 + 지번(산·본번·부번)이 구역 경계 안 필지 목록(pipeline/cache/parcels.json)에 있으면 그 구역
      ② 필지 목록이 없는 공식 경계 구역(추정 원 경계 제외)만, 물건 좌표(KATEC)를 경위도로 바꿔 경계 안에 드는지
사용: python3 tools/auction_match.py [raw=pipeline/raw/auction_raw.json] [out=public/data/auction.json]
수집이 실패하면(ok:false) 이전 auction.json을 지키고, 지난 기일만 걷어 낸다."""
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
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')


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


def main(raw_p=None, out_p=None):
    raw_p = raw_p or P('pipeline/raw/auction_raw.json'); out_p = out_p or P('public/data/auction.json')
    prev = None
    if os.path.exists(out_p):
        try: prev = json.load(open(out_p, encoding='utf-8'))
        except Exception: prev = None
    raw = json.load(open(raw_p, encoding='utf-8')) if os.path.exists(raw_p) else {'ok': False, 'err': 'no-raw'}
    if 'data' in raw and 'dlt_srchResult' in (raw.get('data') or {}):   # 사이트 응답 원형(fixture)
        raw = {'ok': True, 'asOf': today(), 'items': raw['data']['dlt_srchResult'], 'courts': []}
    items = raw.get('items') or []
    miss = sorted({g for c in raw.get('courts') or [] if not c.get('ok') for g in JUR.get(c.get('court'), '').split()})
    if not raw.get('ok') and not (items and len(miss) < 25):
        # 이번 수집 실패 → 이전 결과 유지(지난 기일만 정리)
        print('!! 경매 수집 실패:', raw.get('err') or [c.get('err') for c in raw.get('courts') or []])
        if prev and prev.get('ok'):
            d = today()
            prev['byZone'] = {k: [o for o in v if (o.get('date') or '9') >= d] for k, v in (prev.get('byZone') or {}).items()}
            prev['byZone'] = {k: v for k, v in prev['byZone'].items() if v}
            prev['stale'] = 1
            out = prev
        else:
            out = {'asOf': today(), 'ok': False, 'src': '법원경매정보', 'byZone': {}}
    else:
        idx, polys = load_zones()
        by, stat = match(items, idx, polys)
        out = {'asOf': raw.get('asOf') or today(), 'ok': True, 'src': '법원경매정보', 'n': len(items), 'byZone': by}
        if miss: out['miss'] = miss
        print('경매 물건', len(items), '건 · 구역 안', sum(len(v) for v in by.values()), '건 /', len(by), '구역', stat, ('· 못 가져온 구 ' + ','.join(miss)) if miss else '')
    body = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    if not os.path.exists(out_p) or open(out_p, encoding='utf-8').read() != body:
        open(out_p, 'w', encoding='utf-8').write(body)
    return out


if __name__ == '__main__':
    main(*(sys.argv[1:3]))
