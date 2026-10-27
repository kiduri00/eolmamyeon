"""구역 사실 한 곳(정적 쪽): 계산 매수가 표본 한 문장 · 머리 큰 숫자 · '이 숫자 믿어도 될까' · 짧은 이름 · 용어.
zpages.py(/z/ 페이지)·api.py가 같이 쓴다. 화면 쪽 같은 규칙: src/ext/05_facts.js (ZF.smpTxt · ZF.headline · LBL) — 둘을 같이 고친다."""
import datetime, re, math
def batchim(w):   # 마지막 글자 받침 유무 — 한글은 음절, 숫자는 읽는 소리(0영·1일·3삼·6육·7칠·8팔 받침 / 2이·4사·5오·9구 없음) · 화면 ZP_josa와 같은 규칙
    s = re.sub(r'[\s)\]]+$', '', str(w or '')); c = s[-1:] 
    if '가' <= c <= '힣': return (ord(c) - 0xAC00) % 28 != 0
    return c in '013678'
def ro(w):   # '으로/로': 받침이 있어도 ㄹ 받침(…일·칠·팔, '길'·'동 258')이면 '로'
    s = re.sub(r'[\s)\]]+$', '', str(w or '')); c = s[-1:]
    if not batchim(w): return '로'
    if '가' <= c <= '힣': return '로' if (ord(c) - 0xAC00) % 28 == 8 else '으로'
    return '로' if c in '178' else '으로'
def num(v):   # 억 단위 금액 숫자 꼴 — 화면 ZF.num과 같은 규칙: 1억 아래 소수 둘째 자리(0.69), 1억부터 첫째 자리(1.2 · 1)
    if v is None or v != v or v in (float('inf'), float('-inf')): return '–'
    a = abs(v); sg = '-' if v < 0 else ''
    if a < 0.005: return '0'
    if math.ceil(a * 100 - 1e-6) < 100:   # 올림(화면 ZF.num과 같게 · 실제보다 작게 보이지 않게)
        t = f"{math.ceil(a * 100 - 1e-6) / 100:.2f}"; return sg + (t[:-1] if t.endswith('0') else t)
    t = f"{math.ceil(a * 10 - 1e-6) / 10:,.1f}"; return sg + (t[:-2] if t.endswith('.0') else t)
def cash(v):   # → '6,900만' · '1.2억' · '0원' (화면 ZF.cash: 1억 아래는 만 원 100만 단위)
    t = num(v)
    if t in ('–', '0'): return t if t == '–' else '0원'
    if math.ceil(abs(v) * 100 - 1e-6) < 100: return ('-' if v < 0 else '') + f"{math.ceil(abs(v) * 100 - 1e-6) * 100:,}만"
    return t + '억'
def auc_amt(v):   # 경매 금액(원) → '3.3억'(첫째 자리 반올림 · 0.5는 올림) · 1억 아래 '9,500만' — 화면 ZF.aucAmt와 같은 규칙(파이썬 round의 짝수 반올림 3.25→3.2를 쓰지 않는다)
    if not isinstance(v, (int, float)) or v <= 0: return '–'
    if v >= 1e8: return f"{math.floor(v / 1e7 + 0.5) / 10:,.1f}".rstrip('0').rstrip('.') + '억'
    return f"{math.floor(v / 1e4 + 0.5):,}만"
AUSE = {'단독주택다가구': '단독·다가구', '연립주택,다세대,빌라': '연립·다세대', '상가,오피스텔,근린시설': '상가·근린시설', '대지,임야,전답': '대지·임야', '다가구주택': '다가구'}
def auc_use(u):   # 경매 용도 원문 → 읽기 쉬운 말(화면 ZF.aucUse)
    t = str(u or '').strip(); return AUSE.get(re.sub(r'\s+', '', t)) or re.sub(r'\s*,\s*', '·', t)
def auc_uses(us):   # 여러 물건 대표 용도('기타'보다 구체적인 것 먼저 · 화면 ZF.aucUses)
    xs = list(dict.fromkeys(x for x in (auc_use(u) for u in us) if x)); top = [x for x in xs if x != '기타']
    a = (top or xs or ['부동산'])[0]; return f'{a} 외' if len(xs) > 1 else a
def auc_jb(jb):   # 지분 '333.4분의32.79' → '지분 약 9.8%'(화면 ZF.aucJb) · 몫 모르면 '지분'
    m = re.match(r'^([\d.]+)분의([\d.]+)$', str(jb or ''))
    if not m or not float(m.group(1)) > 0: return '지분' if jb else ''
    p = float(m.group(2)) / float(m.group(1)) * 100; t = math.floor(p + 0.5) if p >= 10 else math.floor(p * 10 + 0.5) / 10
    return f'지분 약 {t:g}%'
def josa(w, a='은', b='는'):   # 조사만 돌려준다(받침 있으면 a)
    return a if batchim(w) else b
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
def noTicket(r, c):   # 지금 사면 입주권이 안 나오는 구역(화면 app.js noTicket과 같은 기준) — 매수가·신뢰 상자를 내지 않는다
    s = r.get('s', 0); done = s >= 9 or (bool(r.get('dn')) and s < 7)
    return (c or {}).get('win') == 'no' and not done and not r.get('dn') and not r.get('cx') and r.get('src') != 'moa'
def headline(r, c, hd):
    """구역 머리 큰 숫자 하나(화면 ZF.headline과 같은 규칙) — 계산 매수가가 있으면 그 표본으로만 말한다.
    hd = tx.json x.hd(구역 대표 거래 기준) 또는 None.  → {'kind', 'v'(만원), 'n', 'basis', 'label'}
      'u'  : 매수가 표본(구역 안 빌라)의 대지 3.3㎡당 가운데 값(tools/enrich.py entry.u) — 매수가·신뢰 상자와 같은 n건
      'p'  : 3.3㎡당을 같은 표본으로 낼 수 없으면 매수가 자체(가운데 값)를 큰 숫자로 · 구역 대표 거래 3.3㎡당은 참고 줄로
      'hd' : 매수가 표본이 없거나(추정·계산 전) 아파트·입주권 기준 구역 → 대표 거래 기준 그대로"""
    en = (r.get('mk') or {}).get('entry') or {}
    has = bool(en.get('n')) and (en.get('med') or 0) > 0 and c.get('price') is not None and c.get('priceSrc') in ('villa', 'complex', 'apt') and not isEst(r, c) and not noTicket(r, c)
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
import json, os, subprocess
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_APPN = None
def _app_names():
    """화면 src/app.js의 shortName()(겹치는 이름 동 붙이기 포함)을 그대로 node로 돌려 {정식 이름: 짧은 이름}을 만든다.
    app.js 규칙이 바뀌어도 정적 페이지·API 이름이 화면과 같게(손으로 옮긴 규칙이 어긋나던 것: 청량리제6구역 vs 청량리6구역)."""
    global _APPN
    if _APPN is not None: return _APPN
    _APPN = {}
    try:
        s = open(os.path.join(_ROOT, 'src/app.js'), encoding='utf-8').read()
        a = s.index('const NAME_TAIL'); b = s.index('function shortName0(', a); e = s.index('\n  }\n', b)
        fn = s[a:e + 4]
        dp = next(p for p in (os.path.join(_ROOT, 'pipeline/data.enriched.json'), os.path.join(_ROOT, 'src/data.json')) if os.path.exists(p))
        js = ('const fs=require("fs");const D=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const R=D.recs;\n' + fn +
              '\nconst o={};for(const r of R){if(r.n)o[r.n]=shortName(r.n);}process.stdout.write(JSON.stringify(o));')
        r = subprocess.run(['node', '-e', js, dp], capture_output=True, text=True, timeout=60)
        if r.returncode == 0: _APPN = json.loads(r.stdout)
    except Exception: pass
    return _APPN
def short(n):   # 구역 짧은 이름(/z/ 제목·API name) — 화면 shortName()과 같은 값(node로 app.js 규칙 그대로) · node가 없으면 아래 옛 규칙
    m = _app_names().get(n)
    return m if m else short0(n)
def short0(n):   # 사업 종류 꼬리를 뗀다(옛 규칙 · 대체용)
    n0 = n
    n = re.sub(r'^\s*\d{1,3}\.\s+(?=\S)', '', n)   # 정보몽땅 목록 번호 '43. ' 떼기(app.js shortName0과 같게)
    n = re.sub(r'^\s*(\(가칭\)|\[임시\]|\(임시\))\s*', '', n)
    n = re.sub(r'\s*(\(가칭\)|\[임시\]|\(임시\))\s*$', '', n)
    n = re.sub(r'\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)?\s*(정비)?(사업)?\s*(조합|추진위원회|조합설립추진위원회|주민대표회의)?\s*$', '', n).strip()
    for _ in range(3):   # '…도시정비형 재개발사업'처럼 사업 종류 말이 겹친 꼬리(제목에 '도시정비형 도시정비형'이 되던 것)
        n = re.sub(r'\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)\s*(정비)?(사업|구역)?\s*$', '', n).strip()
        n = re.sub(r'\s+소규모(\s*주택)?(\s*정비)?$', '', n).strip()   # '○○ 소규모 재건축 사업'·'○○ 소규모주택정비사업' → 제목이 '소규모 소규모재건축'이 되던 것
    return n or n0
# ---------- 상세 첫 화면 3숫자(화면 src/ext/76_detail.js keyHTML과 같은 이름·값) ----------
def _ymd(s):
    m = re.match(r'(\d{4})-?(\d\d)-?(\d\d)', str(s or ''))
    return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None
def yrs_since(d, upd):
    """사이클 2: 경과 연수 한 곳(화면 ZF.yrsSince와 같은 셈) — (데이터 갱신일 − 날짜) 일수 ÷ 365.25 · 날짜는 'YYYY-MM(-DD)' / 'YYYY.MM(.DD)'."""
    m = re.match(r'(\d{4})[.-](\d{1,2})(?:[.-](\d{1,2}))?', str(d or '')); n = _ymd(upd) if upd else None
    if not m or not n: return None
    return (n - datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3) or 1))).days / 365.25
# ---------- 사이클 3: ZoneFacts(앱 src/ext/06_zfacts.js가 만든 구역 판단 한 객체 · calc.json 'f') ----------
# 정적 생성기는 판단(입주 글자·10년 확률·정체 생략·다음 단계·보류 이유·전세가율)을 따로 셈하지 않고 이것을 읽는다. 없으면(옛 calc.json) 아래 옛 셈.
_FX = None
def facts(rid):
    global _FX
    if _FX is None:
        try: _FX = {k: v.get('f') for k, v in json.load(open(os.path.join(_ROOT, 'pipeline/calc.json'), encoding='utf-8')).items() if isinstance(v, dict) and v.get('f')}
        except Exception: _FX = {}
    return _FX.get(rid)
def eta_hidden(r):   # 입주 범위를 숨긴 구역(범위가 10년 확률과 어긋남 · ZoneFacts eta.hid) — 정적 페이지도 범위(eLo~eHi)를 싣지 않는다
    f = facts(r.get('id')); return bool(f and (f.get('eta') or {}).get('hid'))
def hold_of(r, which='one'):   # 보류 이유 하나({code, short, txt}) — 화면과 같은 문장
    f = facts(r.get('id')); return ((f or {}).get('hold') or {}).get(which)
def stall_yrs(r, dt=None, upd=None):
    """같은 단계 8년 이상(장기 정체) — 화면 app.js stallYrs와 같은 판정 · 아니면 0. /z 카드·본문·입주 시점이 이것 하나로 통계를 생략한다."""
    f = facts(r.get('id'))
    if f is not None: return int(f.get('stall') or 0)
    s = r.get('s', 0) or 0
    if not (2 <= s <= 6): return 0
    dt = dt or {}
    k = {2: '구역지정', 3: '추진위', 4: '시행자지정' if r.get('trust') else '조합설립', 5: '사업시행', 6: '관리처분'}.get(s)
    d = dt.get(k) or ((dt.get('조합설립') or dt.get('시행자지정')) if s == 4 else None) or r.get('sd')
    t = yrs_since(d, upd)
    return int(t) if t is not None and t >= 8 else 0
# 22차: 가로·소규모 입주 시점 보정 — 화면 app.js(ETA_ADJ)와 같은 규칙: 사업시행계획인가에 관리처분이 포함되므로 '사업시행→관리처분' 대기(DUP년)를 뺀다.
# 예전엔 /z·api가 보정 전 값을 써서 22곳에서 '언제 입주'가 화면(7~10년 뒤)과 /z(10~15년 뒤)로 갈렸다.
DUP = None
def set_dup(D):
    global DUP
    try: DUP = (((D.get('etaMeta') or {}).get('transitions') or {}).get('small') or {}).get('사업시행>관리처분', {}).get('med') or 0
    except Exception: DUP = 0
def eta_adj(r, as_of=None):
    """→ r['eta'] 그대로 또는 가로·소규모 보정본(app.js와 같은 식: 로그정규 근사로 p10·p15, 날짜는 DUP년 당김)."""
    import math
    e = r.get('eta') or {}
    if not DUP or not e or not e.get('eMid') or e.get('grp') != 'small' or r.get('src') == 'moa' or r.get('dn') or (r.get('s', 0) or 0) > 5: return e
    t = _ymd(as_of) or datetime.date.today()
    base = t.year + (t.month - 1) / 12
    yr = lambda x: int(x[:4]) + (int(x[5:7]) - 0.5) / 12 - base
    def ym(v):   # app.js ymOf: TODAY + v년(365.25일)
        d = datetime.datetime(t.year, t.month, t.day) + datetime.timedelta(days=v * 365.25)
        return f'{d.year}-{d.month:02d}'
    t25, t50, t75 = max(0.25, yr(e['eLo'])), max(0.3, yr(e['eMid'])), max(0.35, yr(e['eHi']))
    mu, sig, cond = math.log(t50), max(0.08, (math.log(t75) - math.log(t25)) / 1.349), e.get('cond', 1) if e.get('cond') is not None else 1
    F = lambda h: 0.5 * (1 + math.erf((math.log(max(h, 0.001)) - mu) / sig / math.sqrt(2)))
    adj = lambda p, h: max(0, min(cond, (p or 0) + cond * (F(h + DUP) - F(h))))
    sh = lambda x: ym(max(0.25, yr(x) - DUP))
    return {**e, 'p10': adj(e.get('p10'), 10), 'p15': adj(e.get('p15'), 15), 'eLo': sh(e['eLo']), 'eMid': sh(e['eMid']), 'eHi': sh(e['eHi']), 'adj': DUP}
def eta_show(r, dt=None, as_of=None, upd=None):
    """예상 입주 글자 — 화면 app.js etaShow(projection·etaSpan·stallYrs)와 같은 규칙.
    dt = premium 단계 날짜(없으면 r.sd), as_of = D.asOf(TODAY), upd = D.upd(ETA_NOW)."""
    f = facts(r.get('id'))
    if f is not None and (f.get('eta') or {}).get('txt'): return f['eta']['txt']   # 사이클 3: ZoneFacts 글자 그대로
    s = r.get('s', 0) or 0
    if r.get('dn') or s >= 9: return '완료'
    if r.get('src') == 'moa': return '사업구역별'
    e = eta_adj(r, as_of) or {}
    if r.get('stale') or e.get('stale'): return '진행 확인 필요'
    today = _ymd(as_of) or datetime.date.today(); now = _ymd(upd) or today
    pre = False
    if not e or e.get('na'):
        if s <= 2: pre = True
        else: return '산정 불가'
    if not pre and stall_yrs(r, dt, upd or as_of): return '산정 불가'   # 장기 정체(8년) — 화면 stallYrs와 같은 셈(stall_yrs)
    if not pre and not e.get('eMid'): return '산정 불가'
    if pre:
        return '4~7년 뒤' if s >= 6 else '7~10년 뒤' if s == 5 else '10~15년 뒤' if s == 4 else '15년 넘게'
    d15 = lambda x: datetime.date(int(x[:4]), int(x[5:7]), 15)
    em = d15(e['eMid'])
    if em < now: return '준공 여부 확인 필요'
    yrs = (em - now).days / 365.25
    if yrs <= 4 and e.get('eLo') and e.get('eHi'):
        a = max(now.year, d15(e['eLo']).year); b = d15(e['eHi']).year
        return f'{a}년' if a == b else f'{a}~{str(b)[2:]}년'
    return '15년 넘게' if yrs > 15 else '10~15년 뒤' if yrs > 10 else '7~10년 뒤' if yrs > 7 else '4~7년 뒤'
def eok_m(m):   # 만원 → '9,587만' · '9.5억'(화면 ZF.eok와 같은 반올림)
    if m is None: return '–'
    if m >= 10000: v = math.floor(m / 1000 + 0.5) / 10; return (f"{v:,.1f}".rstrip('0').rstrip('.')) + '억'
    return f"{math.floor(m + 0.5):,}만"
def ref_price(r):   # 지금 필요한 돈을 내지 않는 곳의 참고 시세 한 줄(화면 76_detail.js refPrice와 같은 규칙)
    t = r.get('tx') or {}; s = r.get('s', 0) or 0
    L = ('입주권 매매', t['im']) if s >= 8 and t.get('im') else ('아파트 매매', t['am']) if t.get('am') and ('재건축' in (r.get('k') or '') or (not t.get('pp') and not t.get('med'))) else ('빌라 매매', t['med']) if t.get('med') else ('대지 3.3㎡당', t['pp']) if t.get('pp') else None
    return f'참고 시세 · {L[0]} 1년 가운데 값 {eok_m(L[1])}' if L else ''
def key3(r, c, dt=None, as_of=None, upd=None):
    """→ dict: now(값·근거·대안) · tot(값·설명) · eta · ip(칩 글자·cls) · trust(칩·글자·등급 cls). 기본 가정 = 전세 끼고(첫 화면 기본 모드)."""
    c = c or {}; s = r.get('s', 0) or 0
    done = s >= 9 or (bool(r.get('dn')) and s < 7)
    nt = noTicket(r, c)
    # 계산하지 않는 칸: 맨 '–' 대신 말로 — 23차부터 지금 필요한 돈·입주까지 현금 모두 '계산 보류'(목록·/gu·/z·상세 같은 이름 '입주까지 현금 계산 보류')
    o = {'now': '계산 보류', 'basis': '', 'alt': '', 'tot': '계산 보류', 'tsub': '', 'eta': eta_show(r, dt, as_of, upd), 'elab': '언제 입주'}
    if r.get('src') == 'moa': o['basis'] = o['tsub'] = '모아타운은 사업구역마다 달라요 · 안의 구역을 열어 보세요'
    elif done: o['basis'] = '사업이 끝난 곳이에요 · 일반 아파트 매매'; o['tsub'] = '새 아파트 입주까지 계산 대상이 아니에요'
    elif nt:
        # 입주권 이야기는 셋째 칸('입주권')에서 한 번(앱 76_detail.js와 같은 글) · 착공 뒤처럼 입주권 거래가 있는 곳은 '조합원 입주권을 사야 해요'(참고 시세)
        t = r.get('tx') or {}; o['basis'] = ''; o['tsub'] = ''; o['elab'] = '입주권'
        if s >= 8 and t.get('im'): o['eta'] = '조합원 입주권을 사야 해요'; o['esub'] = f"참고 입주권 시세 {eok_m(t['im'])}"; o['im'] = 1
        else: o['eta'] = '없음'; o['esub'] = '새 아파트를 원하면 일반분양·분양권을 알아봐야 해요'
    elif c.get('gapBlock') and c['gapBlock'] not in ('계산 대상 아님', 'na'):   # 'na' = 매수가 자료 없음(아래 마지막 갈래)
        h = hold_of(r, 'now')
        o['basis'] = h['txt'] if h and h.get('code') == 'jrLow' else '전세를 안고는 살 수 없어요 · ' + re.sub(r'^전세 낀 매수 불가\s*·\s*', '', re.sub(r'\s*\(.*\)\s*$', '', c['gapBlock']))
        if c.get('now') is not None and not r.get('lc') and r.get('tag') != 'mk':
            o['alt'] = f"대출 끼고 사면 지금 {cash(c['now'])}" + (f" · 입주까지 {cash(c['need'])}" if c.get('need') is not None else '')
            # 27차: 대출 끼고 사는 값을 칸의 큰 값으로(앱 76_detail.js keyHTML과 같은 꼴: 값 + '대출 끼고' 꼬리표) — '계산 보류' 칸과 아래 한 줄이 겹치던 것
            o['lnow'] = cash(c['now'])
            if c.get('need') is not None: o['ltot'] = cash(c['need'])   # 입주까지 값이 계산되면(앱 x.ok와 같은 판정 · cashOk는 '기본 예산 안' 뜻이라 쓰지 않는다)
        o['tsub'] = '전세 끼고는 계산하지 않아요'
    elif c.get('gapNow') is not None:
        o['now'] = cash(c['gapNow'])
        jr = ((facts(r.get('id')) or {}).get('jr') or {}).get('short')   # 사이클 3: 쓴 전세가율과 출처(화면 첫 칸과 같은 글)
        o['basis'] = f"전세 끼고 · 매수가 {manT(c['price'])} − 전세 {manT(c['jeonse'])}" + (f"(전세가율 {jr})" if jr else '') + " (+취득세)" if c.get('price') is not None and c.get('jeonse') is not None else '전세 끼고 · 기본 가정'
        if c.get('gapTotal') is not None: o['tot'] = cash(c['gapTotal'])
        else: h = hold_of(r, 'tot'); o['tsub'] = h['txt'] if h else '입주까지 계산에 필요한 자료가 부족해요'
    else: h = hold_of(r, 'now'); o['basis'] = h['txt'] if h else '매수가로 쓸 거래가 없어 계산하지 않아요'; o['tsub'] = ''   # 사이클 3: 보류 이유 하나(ZoneFacts) · 입주까지 칸에서 같은 이유를 또 쓰지 않는다
    if o['now'] == '계산 보류' and not o['alt'] and r.get('src') != 'moa' and not done and not o.get('im'): o['alt'] = ref_price(r)
    w = c.get('win')
    o['ip'] = None if nt else ('입주권 ✓ 나와요', 'ok') if w == 'ok' else ('입주권 ✕ 안 나와요', 'no') if w == 'no' else ('입주권 ! 확인 필요', 'warn') if not done and r.get('src') != 'moa' else None
    en = (r.get('mk') or {}).get('entry') or {}
    # 27차: 같은 구 빌라 시세로 채운 추정 매수가(calc.json priceSrc 'user')도 앱 상세처럼 '추정 · 같은 구 빌라 시세 기준 · 믿을 만함: 낮음'(전엔 '계산 보류'라 하면서 숫자를 보였다 · /z/o219)
    if c.get('price') is not None and (c.get('priceSrc') in PSRC or isEst(r, c)) and not nt and r.get('src') != 'moa' and not done:
        lv, _ = trust(r, c)
        est = isEst(r, c)
        basis = f"같은 구({r.get('g', '')}) 빌라 시세 기준" if est else (f"{('구역 안 아파트' if en.get('fill') == 'zoneapt' else '단지') if en.get('src') == 'complex' else '같은 동 빌라' if en.get('fill') == 'dong' else '주변 빌라' if en.get('radius') else '같은 본번 빌라' if en.get('m') == 'jibun' else '구역 안 빌라'} {en['n']}건 기준" if en.get('n') else '실거래 기준')
        o['trust'] = ('추정', f'{basis} · 믿을 만함: ', lv, {'높음': 'hi', '보통': 'md', '낮음': 'lo'}.get(lv, ''))
    else:
        h = hold_of(r, 'one')   # 사이클 3: 화면 신뢰 줄과 같은 짧은 이유(ZoneFacts hold.one.short)
        why = h['short'] if h else ('모아타운은 사업구역마다 달라요' if r.get('src') == 'moa' else '새 아파트 계산 대상이 아니에요' if nt else '이주·철거가 시작됐어요' if 7 <= s < 9 else '매수가로 쓸 거래가 없어요')
        o['trust'] = None if nt else ('계산 보류', f'{why} · 이유 보기', '', 'na')   # 입주권 없는 곳은 이유를 셋째 칸에서 한 번만(20차 G3)
    return o
