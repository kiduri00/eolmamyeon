"""계산 매수가 표본 한 문장·'이 숫자 믿어도 될까' 신뢰도 — zpages.py(/z/ 페이지)와 api.py가 같이 쓴다.
화면 쪽 같은 규칙: src/ext/64_overview.js smpTxt · trustHTML."""
import datetime
PSRC = {'villa': '빌라 실거래 가운데 값', 'complex': '단지 실거래 가운데 값', 'apt': '단지 실거래 가운데 값', 'est': '구 평균 시세로 추정'}
def manT(v):   # 억 단위 값 → '1억 5,450만'(계산 매수가: 화면 머리 카드와 같은 표기)
    m = round(v * 1e4); a, b = divmod(m, 10000)
    return (f"{a}억" + (f" {b:,}만" if b else "")) if a else f"{b:,}만"
def smpTxt(r, c):   # 매수가 표본 한 문장 — 화면 64_overview.js smpTxt와 같은 규칙
    en = (r.get('mk') or {}).get('entry') or {}
    if c.get('priceSrc') == 'est': return '같은 구 빌라 시세로 추정'
    if not en.get('n'): return PSRC.get(c.get('priceSrc'), '실거래 가운데 값')
    where = (('구역 안 아파트' if en.get('fill') == 'zoneapt' else en.get('name') or '단지') if en.get('src') == 'complex' else '같은 동 빌라' if en.get('fill') == 'dong'
             else f"주변 {en['radius']}m 빌라" if en.get('radius') else '같은 본번 빌라' if en.get('m') == 'jibun' else '구역 안 빌라')
    span = f"({en['f']}" + (f"–{en['t']}" if en.get('t') and en['t'] != en['f'] else '') + ')' if en.get('f') else (f"(최근 {en['last'][:5]})" if en.get('last') else '')
    return f"{where} {en['n']}건 가운데 값{span}"
def trust(r, c):   # '이 숫자 믿어도 될까' — 화면 64_overview.js trustHTML과 같은 기준 → (등급, 이유)
    en = (r.get('mk') or {}).get('entry') or {}; n = en.get('n') or 0; last = en.get('last') or en.get('t') or ''
    ma = None
    if last:
        y, m = 2000 + int(last[:2]), int(last[3:5] or 1); td = datetime.date.today(); ma = (td.year - y) * 12 + td.month - m
    why = []
    if c.get('priceSrc') == 'est': why.append('구역 안 거래가 없어 같은 구 시세로 추정')
    if n and n < 3: why.append(f'표본 {n}건뿐')
    if ma is not None and ma > 12: why.append('마지막 거래가 1년 넘음')
    if r.get('lc') and not why: why.append('표본이 적거나 구역 거래와 구성이 달라 참고값')
    if why: return '낮음', why
    if r.get('nbp') or en.get('radius') or en.get('fill') == 'dong': why.append('구역 밖 주변 시세 기준')
    if n < 10: why.append(f'표본 {n}건(10건 미만)')
    if ma is not None and ma > 6: why.append('마지막 거래 6개월 넘음')
    return ('보통' if why else '높음'), why or ['구역 안 최근 거래가 충분해요']
