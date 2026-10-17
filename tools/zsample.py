"""구역 사실 한 곳(정적 쪽): 계산 매수가 표본 한 문장 · 머리 큰 숫자 · '이 숫자 믿어도 될까' · 짧은 이름 · 용어.
zpages.py(/z/ 페이지)·api.py가 같이 쓴다. 화면 쪽 같은 규칙: src/ext/05_facts.js (ZF.smpTxt · ZF.headline · LBL) — 둘을 같이 고친다."""
import datetime, re
LBL = {'cashToMoveIn': '입주까지 현금', 'gap': '전세 끼고', 'loan': '대출 끼고'}   # 화면 LBL과 같은 말
PSRC = {'villa': '빌라 실거래 가운데 값', 'complex': '단지 실거래 가운데 값', 'apt': '단지 실거래 가운데 값', 'est': '구 평균 시세로 추정'}
def isEst(r, c):   # 매수가 표본이 없어 같은 구 빌라 시세로 채운 값(화면 isEst · calc.json에는 priceSrc 'user'로 남음)
    return c.get('priceSrc') == 'est' or r.get('lcw') == 'est' or (c.get('priceSrc') == 'user' and not ((r.get('mk') or {}).get('entry') or {}).get('n'))
def manT(v):   # 억 단위 값 → '1억 5,450만'(계산 매수가: 화면 머리 카드와 같은 표기)
    m = round(v * 1e4); a, b = divmod(m, 10000)
    return (f"{a}억" + (f" {b:,}만" if b else "")) if a else f"{b:,}만"
def smpTxt(r, c):   # 매수가 표본 한 문장 — 화면 64_overview.js smpTxt와 같은 규칙
    en = (r.get('mk') or {}).get('entry') or {}
    if isEst(r, c): return f"같은 구({r.get('g', '')}) 빌라 시세 가운데 값으로 추정"
    if not en.get('n'): return PSRC.get(c.get('priceSrc'), '실거래 가운데 값')
    where = (('구역 안 아파트' if en.get('fill') == 'zoneapt' else en.get('name') or '단지') if en.get('src') == 'complex' else '같은 동 빌라' if en.get('fill') == 'dong'
             else f"주변 {en['radius']}m 빌라" if en.get('radius') else '같은 본번 빌라' if en.get('m') == 'jibun' else '구역 안 빌라')
    span = f"({en['f']}" + (f"–{en['t']}" if en.get('t') and en['t'] != en['f'] else '') + ')' if en.get('f') else (f"(최근 {en['last'][:5]})" if en.get('last') else '')
    return f"{where} 거래 1건{span}" if en['n'] == 1 else f"{where} {en['n']}건 가운데 값{span}"   # 1건이면 '가운데 값'이라 하지 않는다
def headline(r, c, hd):
    """구역 머리 큰 숫자 하나(화면 ZF.headline과 같은 규칙) — 계산 매수가가 있으면 그 표본으로만 말한다.
    hd = tx.json x.hd(구역 대표 거래 기준) 또는 None.  → {'kind', 'v'(만원), 'n', 'basis', 'label'}
      'u'  : 매수가 표본(구역 안 빌라)의 대지 3.3㎡당 가운데 값(tools/enrich.py entry.u) — 매수가·신뢰 상자와 같은 n건
      'p'  : 3.3㎡당을 같은 표본으로 낼 수 없으면 매수가 자체(가운데 값)를 큰 숫자로 · 구역 대표 거래 3.3㎡당은 참고 줄로
      'hd' : 매수가 표본이 없거나(추정·계산 전) 아파트·입주권 기준 구역 → 대표 거래 기준 그대로"""
    en = (r.get('mk') or {}).get('entry') or {}
    has = bool(en.get('n')) and (en.get('med') or 0) > 0 and c.get('price') is not None and c.get('priceSrc') in ('villa', 'complex', 'apt') and not isEst(r, c)
    if has and hd and hd.get('b') == 'v' and en.get('src') == 'villa' and en.get('u'):
        nl = en.get('nl') or en['n']
        return {'kind': 'u', 'v': en['u'], 'n': en['n'], 'label': '대지 3.3㎡당', 'basis': smpTxt(r, c) + (f' · 대지 면적 있는 {nl}건' if nl < en['n'] else '') + ' · 매수가와 같은 표본'}
    t = r.get('tx') or {}
    if not hd and ((r.get('s', 0) >= 8 and t.get('im')) or (t.get('am') and ('재건축' in (r.get('k') or '') or (not t.get('pp') and not t.get('med'))))): return None   # 아파트·입주권 기준 구역(화면 txHTML A·IP)
    if has and (not hd or hd.get('b') == 'v'):
        near = en.get('src') == 'villa' and bool(en.get('radius') or en.get('fill') == 'dong')
        return {'kind': 'p', 'v': en['med'], 'n': en['n'], 'label': '주변 빌라 매매가 · 계산 매수가' if near else '계산 매수가', 'basis': smpTxt(r, c) + (f" · 전용 {en['area_med']:g}㎡ 안팎" if en.get('area_med') else '')}
    return {'kind': 'hd', 'v': hd.get('u'), 'n': hd.get('n'), 'label': '', 'basis': ''} if hd else None
def trust(r, c):   # '이 숫자 믿어도 될까' — 화면 64_overview.js trustHTML과 같은 기준 → (등급, 이유)
    en = (r.get('mk') or {}).get('entry') or {}; n = en.get('n') or 0; last = en.get('last') or en.get('t') or ''
    ma = None
    if last:
        y, m = 2000 + int(last[:2]), int(last[3:5] or 1); td = datetime.date.today(); ma = (td.year - y) * 12 + td.month - m
    why = []
    if isEst(r, c): return '낮음', ['구역 안 거래가 적어 같은 구 빌라 시세로 추정한 값 · 계약 전 매물 시세로 꼭 확인']
    if n and n < 3: why.append(f'표본 {n}건뿐')
    if ma is not None and ma > 12: why.append('마지막 거래가 1년 넘음')
    if r.get('lc') and not why: why.append('표본이 적거나 구역 거래와 구성이 달라 참고값')
    if why: return '낮음', why
    if r.get('nbp') or en.get('radius') or en.get('fill') == 'dong': why.append('구역 밖 주변 시세 기준')
    if n < 10: why.append(f'표본 {n}건이라 몇 건에 값이 흔들릴 수 있어요')
    if ma is not None and ma > 6: why.append('마지막 거래 6개월 넘음')
    return ('보통' if why else '높음'), why or ['구역 안 최근 거래가 충분해요']
def short(n):   # 구역 짧은 이름(/z/ 제목·API name) — 사업 종류 꼬리를 뗀다
    n0 = n
    n = re.sub(r'^\s*(\(가칭\)|\[임시\]|\(임시\))\s*', '', n)
    n = re.sub(r'\s*(\(가칭\)|\[임시\]|\(임시\))\s*$', '', n)
    n = re.sub(r'\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)?\s*(정비)?(사업)?\s*(조합|추진위원회|조합설립추진위원회|주민대표회의)?\s*$', '', n).strip()
    for _ in range(3):   # '…도시정비형 재개발사업'처럼 사업 종류 말이 겹친 꼬리(제목에 '도시정비형 도시정비형'이 되던 것)
        n = re.sub(r'\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)\s*(정비)?(사업|구역)?\s*$', '', n).strip()
        n = re.sub(r'\s+소규모(\s*주택)?(\s*정비)?$', '', n).strip()   # '○○ 소규모 재건축 사업'·'○○ 소규모주택정비사업' → 제목이 '소규모 소규모재건축'이 되던 것
    return n or n0
