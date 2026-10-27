#!/usr/bin/env python3
"""구역별 정적 페이지 자동 생성(검색 노출용) → public/z/<id>.html, public/z/index.html
- 기사·고시를 대조해 손으로 쓴 페이지(emr-auto 표시 없음)는 건드리지 않는다.
- 입력: pipeline/data.enriched.json, public/premium.json, pipeline/calc.json(계산 엔진 결과), public/data/sang.json
- 숫자는 화면 계산기와 같은 엔진(calc.json)에서만 가져온다. 없으면 싣지 않는다.
"""
import json, statistics, os, re, html, math, datetime, collections
from brand import BRAND, BRAND_EN
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p, d=None: json.load(open(os.path.join(ROOT, p), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, p)) else d
D = J('pipeline/data.enriched.json') or J('src/data.json'); TH = J('public/data/toheo.json', {}) or {}; P = J('public/premium.json', {}); C = J('pipeline/calc.json', {}); S = J('public/data/sang.json')
ZD = os.path.join(ROOT, 'public/z'); SITE = 'https://jaegaebal.alwaysquestions.kr'
esc = lambda s: html.escape(str(s if s is not None else ''), quote=True)
UPD = (D.get('upd') or datetime.date.today().isoformat()).replace('-', '.')
TXD = (D.get('txAsOf') or {}).get('sale', '')
AUC = J('public/data/auction.json', {}) or {}   # 법원경매 물건(구역별 · tools/auction_match.py)
AUT = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')
TXX = J('public/data/tx.json', {}) or {}   # 구역별 실거래 상세: x.hd = 화면 머리글과 같은 기준(tools/tx.py)
GEO = J('public/data/geo.json', {}) or {}   # 앱 지도와 같은 정비구역·구 경계(작은 지도 그림용)
GUG = {x['n']: x['r'] for x in (GEO.get('gu') or [])}
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import zmap   # 구역 위치 지도(SVG)·공유 카드(OG PNG) — tools/zmap.py
from jsnum import walk_min, prob, prob_txt   # 역 도보 분·준공 가능성 %(앱과 같은 반올림) — tools/jsnum.py
OG_OK = zmap.og_ok()
# 돈 꼴: 숫자 뒤 '만원·억원' → '만·억'(앱 ZF와 같은 꼴 · '476만' '6,920만') — 글 속(자료 원문 인용 포함) 화면 글자에만, 태그 속성은 그대로
import re as _re
def MONEY(h):
    return _re.sub(r'>([^<]*)<', lambda m: '>' + _re.sub(r'(\d)(만|억)원', r'\1\2', m.group(1)) + '<', h)

def est_bnd(r):
    """27차: 경계 자료가 없어 면적만큼 원으로 그린 구역(zmap '경계 자료가 없어…')이면 True — '경계 안' 대신 '구역 근처(원 안)'라고 쓴다"""
    z = (GEO.get('z') or {}).get(r['id']) or {}
    return not z.get('g') or str(z.get('e') or '') == '1'
def inb(r):
    z = (GEO.get('z') or {}).get(r['id']) or {}
    return '경계 안' if not est_bnd(r) else '구역 근처(원 안)' if z.get('g') else '구역 근처'
def minimap(r):
    """구역 경계 + 주변 정비구역 + 구 경계 + 지하철 노선·역(tools/zmap.py). 경계가 없으면 빈 문자열."""
    return zmap.minimap(r, GEO, D, short)
HDB = {'i': ('입주권 전용 3.3㎡당', '아파트 입주권'), 'a': ('아파트 전용 3.3㎡당', '아파트 매매'), 'v': ('대지 3.3㎡당', '빌라·단독 매매')}
def nk(nm, kind):   # 이름에 이미 있는 사업 종류 말은 빼고 붙인다('○○ 소규모' + '소규모재건축' → '○○ 소규모재건축')
    ws = nm.split()
    if len(ws) > 1 and kind.replace(' ', '').startswith(ws[-1]): nm = ' '.join(ws[:-1])
    w = set(re.split(r'\s+', nm)); k = ' '.join(x for x in kind.split() if x not in w and x not in nm)   # '미아3구역(재개발)'·'…재개발1구역'처럼 이름 안에 이미 있으면 다시 안 붙인다
    return f"{nm} {k}".strip()
# /z 제목은 '<짧은 이름> 재개발|재건축 | …'만: 사업 방식·지원 말(도시정비형·공공·신속통합기획·장기전세…)은 설명(description)으로 옮긴다
TQ = ('도심공공주택복합', '주택정비형', '신속통합기획', 'LH참여형', '장기전세', 'SHIFT', '공공임대', '공공시행', '공공', '민간', '후보지', '건립', '활성화', '통합')
_TQR = re.compile(r'^(' + '|'.join(TQ) + r')(\(.*\))?$')
def ztitle(nm, kind):
    """→ (제목 이름, 옮긴 말 목록). '역촌역세권 장기전세(역촌동)' → '역촌역세권(역촌동)', ['장기전세']"""
    keep, q = [], []
    for w in nm.split():
        m = _TQR.match(w)
        if not m: keep.append(w); continue
        q.append(m.group(1))
        if m.group(2):
            if keep: keep[-1] += m.group(2)
            else: keep.append(m.group(2))
    if not keep: keep, q = nm.split(), []
    k = kind
    if kind == '도시정비형 재개발': k = '재개발'; q.append('도시정비형')
    q = list(dict.fromkeys(q))
    return nk(' '.join(keep), k), q
_TD = None
def zt(r):
    """구역 레코드 → (제목 이름, 옮긴 말). 말을 떼어 다른 구역과 제목이 같아지면 그 구역만 첫 말을 괄호로 남긴다(신길2구역 · 신길2구역(도심공공주택복합))."""
    global _TD
    nm = short(r['n']); kind = KIND.get(r['k'], r['k'])
    if _TD is None:
        _TD = collections.Counter(ztitle(short(x['n']), KIND.get(x['k'], x['k']))[0] for x in R)
    t, q = ztitle(nm, kind)
    if _TD.get(t, 0) > 1:
        q2 = [x for x in q if x != '도시정비형']
        if q2:
            k = kind if kind != '도시정비형 재개발' else '재개발'
            base = t[: -len(k)].rstrip() if t.endswith(k) else t
            t = f"{base}({q2[0]}) {k}".strip(); q = [x for x in q if x != q2[0]]
    return t, q
def ztitle_s(r): return f"{zt(r)[0]} | 단계·실거래·입주 현금 | {BRAND}"
EVK = {'조합설립인가': '조합설립', '사업시행인가': '사업시행', '관리처분인가': '관리처분', '정비구역지정': '구역지정', '조합설립추진위원회승인': '추진위', '사업시행자지정': '시행자지정', '준공인가': '준공'}
def evtext(dt, d, sec, t):
    """정보몽땅 원문 '[(변경)인가] 동의율 : 89.85' → '변경인가 · 동의율 89.85%' (src/ext/20_zone.js evText와 같은 규칙)"""
    m = re.match(r'^\[([^\]]*)\]\s*(.*)$', str(t or ''))
    a, b = (m.group(1), m.group(2)) if m else ('', str(t or ''))
    sd = (dt or {}).get(EVK.get(sec, ''), '')
    chg = '(변경)' in a and bool(sd) and sd < d
    a = re.sub(r'\(변경\)\s*', '변경' if chg else '', a, count=1)
    a = re.sub(r'(인가|승인)(신청|고시)', r'\1 \2', a, count=1); a = re.sub(r'\s*:\s*', ' ', a, count=1)
    b = re.sub(r'동의율\s*:\s*(\d+(?:\.\d+)?)\s*%?', r'동의율 \1%', b, count=1)
    b = re.sub(r'동의율\s*:\s*(해당없음|[.\-]?)\s*$', '', b); b = b.replace('(최초인가시)', ' (최초 인가 때)')
    b = re.sub(r'(\S*?)일자\s*:\s*', lambda x: (x.group(1) if x.group(1).endswith('일') else x.group(1) + '일') + ' ', b, count=1)
    b = re.sub(r'선정업체명\s*:\s*', '', b); b = re.sub(r'(\d{4})-(\d{2})-(\d{2})', r'\1.\2.\3', b); b = re.sub(r'\b(20\d\d)(\d\d)(\d\d)\b', r'\1.\2.\3', b)
    b = re.sub(r'\s*:\s*', ' ', b).strip()
    if b and a and b.replace(' ', '') == a.replace(' ', ''): b = ''
    return f'{a} · {b}' if a and b else (a or b)
def eok(v, d=1):   # 억 금액 — 화면 ZF.cash와 같은 꼴(tools/zsample.cash)
    from zsample import cash
    return cash(v)
def man(v):
    if v is None: return '–'
    return f"{v/10000:.1f}억".replace('.0억', '억') if v >= 10000 else f"{v:,.0f}만"
KIND = {'재개발': '재개발', '재건축': '재건축', '도시정비형 재개발': '도시정비형 재개발', '가로주택(모아주택)': '가로주택정비', '소규모재건축': '소규모재건축', '소규모재개발': '소규모재개발'}
DTK = [('구역지정', '정비구역 지정'), ('추진위', '추진위원회 승인'), ('조합설립', '조합설립인가'), ('시행자지정', '사업시행자 지정'), ('사업시행', '사업시행인가'), ('관리처분', '관리처분인가'), ('착공', '착공'), ('준공', '준공')]
SKEY = {2: ('구역지정',), 3: ('추진위',), 4: ('조합설립', '시행자지정'), 5: ('사업시행',), 6: ('관리처분',), 7: ('관리처분',), 8: ('착공',)}
PSRC = {'villa': '빌라 실거래 가운데 값', 'complex': '단지 실거래 가운데 값', 'apt': '단지 실거래 가운데 값', 'est': '구 평균 시세로 추정'}
from zsample import ro, isEst, cash, manT, smpTxt, trust, short, headline, noTicket, LBL, josa, auc_use, auc_uses, auc_jb, auc_amt, key3, set_dup
set_dup(D)  # 22차: '언제 입주' 가로·소규모 보정(화면과 같은 값)   # 계산 매수가 표본 한 문장·신뢰도(api.py와 같은 함수)
def gapWhy(c):   # 전세 끼고 계산이 안 되는 이유(화면 gapBlock과 같은 문구에서) → (표 칸 짧은 말, 설명)
    b = str(c.get('gapBlock') or '')
    if b.startswith('전세 낀 매수 불가'): return ('토허제', '토지거래허가구역이라 불가(2년 실거주)')
    if b.startswith('이주·철거'): return ('세입자 없음', '이주·철거가 시작돼 세입자가 없어요')
    if b.startswith('입주권 없음'): return ('입주권 없음', b.split('·')[-1].strip() + '라 입주권이 없어요')
    if b.startswith('입주권 판정 보류'): return ('판정 보류', '입주권 판정 자료가 부족해요')
    if b == '계산 대상 아님': return ('대상 아님', '아파트 입주권 계산 대상이 아니에요')
    return None
def dist(a, b, c, d):
    k = math.pi / 180; x = (d - b) * k * math.cos((a + c) / 2 * k); y = (c - a) * k
    return math.sqrt(x * x + y * y) * 6371000
HEAD = ('''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<base href="/z/">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="emr-auto" content="1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="color-scheme" content="light dark">
<link rel="canonical" href="{url}">
<meta property="og:site_name" content="''' + BRAND + '''"><meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:type" content="article">
<meta property="og:image" content="{site}/og.png">
<meta property="og:locale" content="ko_KR">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#15181D" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/icon-small.svg" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" crossorigin>
<link rel="stylesheet" href="../pages.css">
<link rel="manifest" href="/manifest.webmanifest">
<script type="application/ld+json">{ld}</script>
</head>
<body>
<header class="top"><div class="in"><a class="logo" href="/" aria-label="''' + BRAND + ''' 처음으로"><img class="logo-i" src="/icon-small.svg" width="28" height="28" alt=""><span class="logo-t">''' + BRAND + '''</span><span class="logo-en" lang="en">''' + BRAND_EN + '''</span><small class="logo-s">서울 재개발 지도</small></a><nav aria-label="사이트 메뉴"><a href="../">계산기</a><a href="../report/">월간 리포트</a><a href="../z/" aria-current="page">구역별 페이지</a><a href="../guide/">가이드·분석</a></nav><form class="tsr" action="/" method="get" role="search"><label class="sr-only" for="tq">구역 검색</label><input id="tq" name="q" type="search" placeholder="구역·동·역 검색" autocomplete="off" enterkeyhint="search" maxlength="40"></form><script>matchMedia("(max-width:399.98px)").matches&&(document.getElementById("tq").placeholder="검색")</script></div></header>
<main>
''')
FOOT = ('''</main>
<footer class="f"><p><a href="../report/">월간 리포트</a> · <a href="../z/">구역별 페이지</a> · <a href="../guide/">가이드·분석</a> · <a href="../years">몇 년 걸리나</a> · <a href="../about">소개</a> · <a href="../contact">문의하기</a> · <a href="../method">출처·계산 방법</a> · <a href="../terms">이용약관</a> · <a href="../privacy"><b>개인정보처리방침</b></a> · <a href="https://blog.naver.com/always_questions" rel="noopener">블로그</a></p><p class="f-c">© 2026 ''' + BRAND + ''' · 데이터 기준 {upd}</p></footer>
<script>/* 오프라인에서도 다시 열 수 있게: 서비스 워커를 붙이고 이 페이지를 저장해 달라고 알린다 */if("serviceWorker"in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))addEventListener("load",function(){{navigator.serviceWorker.register("/sw.js",{{scope:"/"}}).then(function(){{return navigator.serviceWorker.ready}}).then(function(r){{r.active&&r.active.postMessage({{t:"keep",u:[location.pathname]}})}}).catch(function(){{}})}});</script>
</body>
</html>
''')
def is_hand(rid):
    f = os.path.join(ZD, rid + '.html')
    return os.path.exists(f) and os.path.getsize(f) > 0 and 'name="emr-auto"' not in open(f, encoding='utf-8').read(3000)   # 빈 파일은 자동 페이지로 다시 만든다
def place_ld(r, url):   # 구역 장소(Place): 위경도는 구역 대표점 → 경계 자료 대표점 순 · 둘 다 없으면 주소만
    zg = (GEO.get('z') or {}).get(r['id']) or {}; nm = short(r['n']); kind = KIND.get(r['k'], r['k'])
    ll = r.get('ll') or ((zg.get('l') or [None, None])[::-1] if zg.get('l') else None)
    o = {"@type": "Place", "name": nk(nm, kind) + " 정비구역", "url": url}
    if ll and ll[0] is not None: o["geo"] = {"@type": "GeoCoordinates", "latitude": round(ll[0], 5), "longitude": round(ll[1], 5)}
    o["address"] = {"@type": "PostalAddress", "addressCountry": "KR", "addressRegion": "서울특별시", "addressLocality": r['g'], **({"streetAddress": r['j']} if r.get('j') else {})}
    o["containedInPlace"] = {"@type": "AdministrativeArea", "name": f"서울특별시 {r['g']}"}
    return o
def crumbs(*xs):   # BreadcrumbList: (이름, 주소) 차례로
    return {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(xs)]}
def dong_of(r):   # 구 다음 동 이름(화면 64_overview 주소 줄과 같은 규칙)
    m = re.match(r'^(?:서울(?:특별)?시\s*)?(?:[가-힣]+구\s+)?([가-힣]+?(?:\d+(?:·\d+)*)?(?:동\d+가|로\d+가|\d+가|동|로|가))(?=[\s\d(산]|$)', str(r.get('j') or r.get('bj') or ''))
    return m.group(1) if m else (r.get('dg') or '')
def report_href(r):
    """'이 숫자가 틀렸어요' → 사이트 안 문의 양식(/contact?kind=error&zone=<id>) · cf.js가 있으면 시트로 연다(앱과 같은 양식 · 메일 주소는 내지 않음, 20차)."""
    return f"../contact?kind=error&zone={r['id']}"
def key3_html(r, c, dt, cap=False):
    """상세 첫 화면 3숫자 + 신뢰 한 줄(앱 구역 상세와 같은 이름·값 · 기본 가정 = 전세 끼고)."""
    k = key3(r, c, dt, D.get('asOf'), D.get('upd')); rid = r['id']; stage = (c or {}).get('stage') or r.get('sr') or ''
    ip = f'<span class="zk-ip {k["ip"][1]}">{esc(k["ip"][0])}</span>' if k.get('ip') else ''
    ex = bool(k['now'] != '계산 보류' and (r.get('lc') or isEst(r, c or {})))   # 26차: 앱 목록·곳 수에서 빠지는 곳(추정 매수가·참고값) — 앱 상세·검색과 같은 말
    hv = bool(k.get('lnow'))   # 27차: 전세 끼고는 못 사는 곳(토허제 등) — 모든 /z에서 '대출 끼고' 값을 칸의 큰 값으로(앱 상세와 같은 꼴 · 겹치던 '계산 보류' 칸과 한 줄을 하나로)
    MODE = '<em class="zk-mode">대출 끼고</em>'
    tc, tt, lv, cls = k['trust'] or ('', '', '', '')
    thref = '#trust' if cls != 'na' else f'../#{rid}'
    return (f'<section class="zk" aria-label="핵심 숫자"><p class="zk-nl"><b>{esc(short(r["n"]))}</b><span>{esc(r["g"])} {esc(dong_of(r))}</span><span class="zk-st">{esc(stage)}</span></p><div class="zk-k">'
            f'<div class="zk-i{" zk-hv" if hv else ""}"><span class="zk-l">지금 필요한 돈</span><b class="zk-v">{k["lnow"] if hv else k["now"]}</b>' + (MODE if hv else '') + ('<span class="zk-s zk-ex">추정 신뢰 낮아 목록에서 뺐어요</span>' if ex else '') + f'<span class="zk-s">{esc(k["basis"])}</span>' + (f'<span class="zk-s zk-alt">{esc(k["alt"])}</span>' if k['alt'] and not hv else '') + f'<a class="zk-my" href="../#{rid}">내 돈으로 보기 ›</a></div>'
            + (f'<div class="zk-i"><span class="zk-l">{LBL["cashToMoveIn"]}</span><b class="zk-v">{k["ltot"]}</b>{MODE}<span class="zk-s">잔금대출 뺀 값</span></div>' if hv and k.get('ltot') else f'<div class="zk-i"><span class="zk-l">{LBL["cashToMoveIn"]}</span><b class="zk-v">{k["tot"]}</b>' + (f'<span class="zk-s">{esc(k["tsub"] or "잔금대출 뺀 값")}</span>' if k["tsub"] or k["tot"] != "계산 보류" else '') + '</div>')
            + f'<div class="zk-i"><span class="zk-l">{esc(k.get("elab") or "언제 입주")}</span><b class="zk-v zk-eta">{esc(k["eta"])}</b>{ip}' + (f'<span class="zk-s">{esc(k["esub"])}</span>' if k.get('esub') else '') + '</div></div>' +
            (f'<p class="zk-cap">최신 숫자 · 기본 가정 · 데이터 기준 {UPD}</p>' if cap else '') + (f'<a class="zk-tr {cls}" href="{thref}"><span class="zk-tc">{esc(tc)}</span><span class="zk-tt">{esc(tt)}{f"<b>{esc(lv)}</b>" if lv else ""}{" · 목록에서 뺐어요" if ex and cls != "na" else ""}</span><i aria-hidden="true">›</i></a>' if k['trust'] else '') + '</section>')
REPORT_P = lambda r: f'<p class="zk-rep"><a class="zk-rb zk-rs" href="{report_href(r)}" data-zp-contact data-kind="error" data-zone="{esc(r["id"])}" data-asof="{UPD}" data-title="이 숫자가 틀렸어요" data-meta="{esc(short(r["n"]))} · 구역 ID {esc(r["id"])} · {UPD} 기준">이 숫자가 틀렸어요</a></p><script src="/cf.js" defer></script>'
# ---- '이 구역 한눈에'(25차 · 애드센스 1차 레드팀): 자료가 있는 문장만, 구역마다 다른 숫자로 3~5문장 ----
_ST = None
def _stage(x): return (C.get(x['id']) or {}).get('stage') or x.get('sr') or ''
def _sdate(x):   # 지금 단계의 인가·고시일(SKEY) — 없으면 None
    dt = (P.get(x['id']) or {}).get('dt') or {}
    return next((dt[k] for k in SKEY.get(x.get('s', 0)) or () if dt.get(k)), None)
def _yrs(d):
    try: return (datetime.date.today() - datetime.date.fromisoformat(d[:10])).days / 365.25
    except Exception: return None
def _stats():
    """같은 단계(서울 전체) 경과 연수 가운데 값 · 구×단계 묶음"""
    global _ST
    if _ST is None:
        by = collections.defaultdict(list); grp = collections.defaultdict(list)
        for x in R:
            y = _yrs(_sdate(x) or '')
            if y is not None and y >= 0: by[x.get('s', 0)].append(y)
            grp[(x['g'], _stage(x))].append(x)
        _ST = ({k: (statistics.median(v), len(v)) for k, v in by.items() if len(v) >= 5}, grp)
    return _ST
def _area(x):
    a = (x.get('sm') or {}).get('area')
    return a if isinstance(a, (int, float)) and a >= 500 else None
def _pol(x):
    o = (x.get('tx') or {}).get('old')
    return o['pol'] if o and x.get('s', 0) < 7 and isinstance(o.get('pol'), (int, float)) else None
def _units(x):
    u = (x.get('sm') or {}).get('units')
    return u if isinstance(u, (int, float)) and u > 0 else None
def _rank(L, f, me):
    v = sorted({x['id']: f(x) for x in L if f(x) is not None}.items(), key=lambda z: -z[1])
    ids = [k for k, _ in v]
    return (ids.index(me['id']) + 1, len(ids)) if me['id'] in ids and len(ids) >= 2 else None
def _rk(k, n, big, small):
    """순위 말: 가운데보다 위면 '가장/N번째로 big', 아래면 뒤에서 센 'N번째로 small'"""
    if k == 1: return '가장 ' + big
    if k == n: return '가장 ' + small
    if k <= (n + 1) / 2: return f'{k}번째로 ' + big
    return f'{n - k + 1}번째로 ' + small
def _walk(x):
    st = (C.get(x['id']) or {}).get('st') or {}
    return walk_min(st['d']) if st.get('d') is not None else None
def glance(r, c, k3):
    """→ 문장 목록(26차: 그 구역에서 가장 눈에 띄는 신호부터). 자료가 없는 문장은 만들지 않는다(지어내지 않음).
    · 순위는 비교 대상이 5곳 이상일 때만 · 가운데보다 위면 'N번째로 많아요/넓어요' · 비교 묶음을 밝힌다
    · 거래가 두 기간 모두 30건 이상일 때만 1년 변화율 · 아니면 가격 범위(가운데 절반)
    · 머리 카드에 나온 금액(지금 필요한 돈 · 입주까지 현금 · 역 도보 분)은 다시 쓰지 않는다"""
    rid = r['id']; g = r['g']; stg = _stage(r); t = r.get('tx') or {}; med, grp = _stats(); S_ = []   # (눈에 띄는 정도, 문장)
    L = grp.get((g, stg)) or []
    AD = {'넓': ('넓고', '넓어요'), '좁': ('좁고', '좁아요'), '높': ('높고', '높아요'), '낮': ('낮고', '낮아요'), '많': ('많고', '많아요'), '적': ('적고', '적어요')}
    if stg and len(L) >= 5:
        bits = []
        for f, sub, big, small, unit in ((_area, '면적은', '넓', '좁', lambda v: f'{int(v):,}㎡'), (_pol, '노후도는', '높', '낮', lambda v: f'{v}%'), (_units, '계획 세대는', '많', '적', lambda v: f'{int(v):,}세대')):
            if len(bits) >= 2: break
            k = _rank(L, f, r)
            if not k or k[1] < 5: continue
            w = _rk(k[0], k[1], big, small)
            bits.append((sub, w, unit(f(r)), k))
        if bits:
            ext = max((1.0 if b[3][0] in (1, b[3][1]) else 0.4) for b in bits)
            S_.append((ext + 0.2, f"{g} {stg} 단계 {len(L)}곳 중 " + ', '.join(f"{sub[:-1]}({v}){sub[-1]} {w[:-1]}{AD[w[-1]][1 if i == len(bits) - 1 else 0]}" for i, (sub, w, v, _) in enumerate(bits)) + '.'))
    elif stg and len(L) == 1:
        S_.append((0.5, f"{g}에서 {stg} 단계는 이 구역 하나예요."))
    sd = _sdate(r); y = _yrs(sd) if sd else None; m = med.get(r.get('s', 0))
    if y is not None and y >= 0 and m and not r.get('stale'):
        d = round(y, 1) - round(m[0], 1)   # 27차: 차이는 화면에 쓴(반올림한) 두 값으로 — '3.7년째, 4.7년보다 0.9년 짧아요' 같은 어긋남 없게
        tail = f"가운데 값 {m[0]:.1f}년과 비슷해요" if abs(d) < 0.5 else f"가운데 값 {m[0]:.1f}년보다 {abs(d):.1f}년 {'길어요' if d > 0 else '짧아요'}"
        S_.append((min(1.2, abs(d) / max(1.0, m[0])) + 0.1, f"{sd[:4]}년 {int(sd[5:7])}월 {stg} 뒤 {y:.1f}년째로, 서울 같은 단계 {m[1]:,}곳의 {tail}."))
    if t.get('n12') is not None:
        if t['n12']:
            s = f"{inb(r)}에서 최근 12개월 동안 신고된 거래는 {t['n12']}건이에요"
            yon = t.get('yon') or []
            if t.get('yoy') is not None and len(yon) == 2 and min(yon) >= 30:
                s += f". 대지 3.3㎡당 값은 {yon[0]}건 대 {yon[1]}건 비교로 1년 새 {abs(t['yoy'])}% {'올랐어요' if t['yoy'] > 0 else '내렸어요' if t['yoy'] < 0 else '그대로예요'}"
            elif t.get('p25') and t.get('p75') and (t.get('no') or 0) >= 4 and t['p75'] > t['p25']:
                s += f". 최근 {t.get('nwin', 6)}개월 빌라 매매 {t['no']}건은 가운데 절반이 {man(t['p25'])}~{man(t['p75'])} 사이였어요"
            S_.append((0.3 + min(0.6, t['n12'] / 200), s + '.'))
        else:
            S_.append((0.2, f"최근 12개월 동안 {inb(r)}에서 신고된 거래는 없어요."))
    # 같은 구에서 지금 필요한 돈이 계산되는 곳끼리 순위(금액은 머리 카드에 있으니 다시 쓰지 않는다)
    if LISTED(r):
        G = sorted((C.get(x['id']) or {}).get('gapNow') for x in R if x['g'] == g and LISTED(x))
        if len(G) >= 5:
            k = G.index(c['gapNow']) + 1; md = statistics.median(G)
            w = _rk(k, len(G), '적게 들어요', '많이 들어요')
            S_.append(((1.1 if k in (1, len(G)) else 0.6), f"{g}에서 지금 필요한 돈이 계산되는 {len(G)}곳 중 {w}(가운데 값 {eok(md)})."))
    au = [x for x in ((AUC.get('byZone') or {}).get(rid) or []) if not x.get('st') and str(x.get('date') or '') >= AUT] if AUC.get('ok') else []
    th = (TH.get('z') or {}).get(rid); tb = str(c.get('gapBlock') or '').startswith('전세 낀 매수 불가')
    s5 = []
    if au: s5.append(f"입찰을 앞둔 법원경매 사건이 {len({x.get('cs') for x in au})}건 있어요")
    if th: s5.append(f"최근 토지거래허가가 {th['n']}건 났어요(주거용 {th['res']}건)")
    elif tb: s5.append("토지거래허가구역이라 사면 2년 동안 직접 살아야 해요")
    if s5: S_.append((0.9 if au else 0.7, ' · '.join(s5) + '.'))
    # 역 거리: 머리 칸의 '도보 N분'을 되풀이하지 않고 같은 구 구역들과 견준다(5곳 이상일 때)
    mw = _walk(r)
    if mw is not None:
        W = sorted(v for v in (_walk(x) for x in R if x['g'] == g) if v is not None)
        if len(W) >= 5:
            wm = statistics.median(W); wm = int(wm) if wm == int(wm) else round(wm, 1)
            if abs(mw - wm) >= 3: S_.append((0.5 if mw < wm else 0.35, f"역까지 거리는 {g} 구역 {len(W)}곳의 가운데 값(도보 {wm}분)보다 {'가까운' if mw < wm else '먼'} 편이에요."))
    S_.sort(key=lambda z: -z[0])
    return [s for _, s in S_][:5]
def hold_line(r, c, k3):
    """계산 보류 페이지 첫 줄: 왜 보류인지 + 대출 끼고 값(있으면) — 화면 key3와 같은 판정에서 말만 고른다"""
    if k3['now'] != '계산 보류': return ''
    t = r.get('tx') or {}; w = gapWhy(c)
    if noTicket(r, c): why = '착공 뒤라 조합원 입주권을 사야 해요' if r.get('s', 0) >= 8 and t.get('im') else '지금 사면 새 아파트 입주권이 안 나와서 계산하지 않아요'
    elif w and w[0] == '토허제': why = '토지거래허가구역이라 2년 실거주해야 해서 전세를 끼고 살 수 없어요'
    elif w and w[0] != '대상 아님': why = f'전세를 끼고 계산하지 않아요. {w[1]}'
    elif k3['basis']: why = k3['basis'].replace(' · ', ', ')
    else: why = '매수가로 쓸 거래가 없어 계산하지 않아요'
    alt = k3.get('alt') or ''
    return f'<p class="zk-hold"><b>지금 필요한 돈은 계산 보류예요.</b> {esc(why.rstrip("."))}.' + (f' {esc(alt)}.' if alt else '') + '</p>'
REPORT_A = lambda r: f'<a class="zk-rb zk-rs" href="{report_href(r)}" data-zp-contact data-kind="error" data-zone="{esc(r["id"])}" data-asof="{UPD}" data-title="이 숫자가 틀렸어요" data-meta="{esc(short(r["n"]))} · 구역 ID {esc(r["id"])} · {UPD} 기준">이 숫자가 틀렸어요</a>'
def page(r):
    rid = r['id']; pm = P.get(rid) or {}; c = C.get(rid) or {}; t = r.get('tx') or {}
    nm = short(r['n']); kind = KIND.get(r['k'], r['k']); stage = c.get('stage') or r.get('sr') or ''
    dt = pm.get('dt') or {}
    nmk = nk(nm, kind)
    tnm, tq = zt(r)
    title = ztitle_s(r)
    desc = f"{r['g']} {tnm}{'(' + ' · '.join(tq) + ')' if tq else ''}: 지금 {stage} 단계. 구역 안 실거래, 노후도, 권리산정기준일, 정비사업 정보몽땅 추진경과, 기본 가정의 지금 필요한 돈과 입주까지 현금 추정. 데이터 기준 {UPD}."
    url = f"{SITE}/z/{rid}"
    ld0 = {"@type": "Article", "headline": f"{nmk} 진행 단계와 입주까지 현금", "description": desc, "inLanguage": "ko", "dateModified": UPD.replace('.', '-'),
           "mainEntityOfPage": url, "author": {"@type": "Organization", "name": (BRAND + " 편집"), "url": f"{SITE}/about#principles"}, "publisher": {"@type": "Organization", "name": (BRAND), "url": SITE}}
    o = [HEAD.format(title=esc(title), desc=esc(desc), url=url, site=SITE, ld='@@LD@@').replace('<link rel="canonical"', f'<link rel="alternate" type="application/rss+xml" title="{esc(nmk)} 소식" href="../feed/z/{rid}.xml">\n<link rel="canonical"', 1)]
    o.append(f'<p class="eyebrow">{esc(r["g"])} {esc(r.get("j") or r.get("dg") or "")} · {esc(kind)} · 데이터 기준 {UPD}</p>')
    o.append(f'<h1>{esc(nmk)} 진행 단계와 입주까지 현금</h1>')
    if r['n'].strip() != nm: o.append(f'<p class="formal">정식 이름 {esc(r["n"].strip())}</p>')   # 제목은 앱과 같은 짧은 이름, 정식 이름은 한 줄 아래
    k3 = key3(r, c, dt, D.get('asOf'), D.get('upd'))
    o.append(hold_line(r, c, k3))   # 계산 보류면 이유 + 대출 끼고 값을 맨 앞 한 줄로
    o.append(key3_html(r, c, dt))   # 첫 화면: 앱 상세와 같은 3숫자(지금 필요한 돈 · 입주까지 현금 · 언제 입주/입주권) + 신뢰 한 줄
    # 현재 단계의 인가·고시일만 쓴다(예전엔 기록 중 가장 늦은 날짜를 써서 '착공' 구역에 관리처분일이 붙었다 · o747)
    sk = SKEY.get(r.get('s', 0)) or ()
    sd = next((dt[k] for k in sk if dt.get(k)), '')[:7].replace('-', '.')
    prevd = next(((lab, dt[k]) for k, lab in reversed(DTK) if dt.get(k) and k not in sk), None) if not sd else None
    lede = f"{esc(nm)}{josa(nm)} 지금 <b>{esc(stage)}</b> 단계예요" + (f" ({sd} 인가·고시)." if sd else ".")
    stl = r.get('stale')
    if stl: lede += f" 다만 {esc(stl['why'])}. 준공됐는지 멈췄는지 자료로 확인되지 않아 준공 가능성과 입주 시점은 싣지 않았어요."
    elif c.get('p10') is not None: lede += f" 10년 안 준공 가능성은 {'1% 미만이' if c['p10'] < 0.01 else f"약 {prob(c['p10'])}%"}예요(서울 사업장 기록 통계)."
    o.append(f'<p class="lede">{lede} 기본 가정(무주택·84㎡·전세 끼고)으로 낸 추정이고 투자 권유가 아니에요. <a href="../#{rid}">내 조건으로 열기</a></p>')
    gl = glance(r, c, k3)
    if gl: o.append(f'<h2>이 구역 한눈에</h2><p class="glance">{esc(" ".join(gl))}</p>')
    k = []
    k.append(('현재 단계', esc(stage), f'{sd} 인가·고시' if sd else ('진행 확인 필요' if stl else '아직 구역지정 전이라 인가일이 없어요' if r.get('s', 0) <= 1 else f'이 단계 인가일 기록 없음 · 직전 {prevd[0]} {prevd[1][:7].replace("-", ".")}' if prevd else '이 단계 인가일 기록 없음')))
    if c.get('gapOk') and c.get('gapTotal') is not None:   # 첫 화면 기본 모드(전세 끼고)와 같은 숫자
        k.append((f"{LBL['gap']} {LBL['cashToMoveIn']}", eok(c['gapTotal']), f'지금 {eok(c.get("gapNow"))} · 매수가 {manT(c["price"]) if c.get("price") is not None else "–"} = {esc(smpTxt(r, c))}' + (f' · 대출 끼고 사면 {eok(c["need"])}' if c.get('cashOk') and c.get('need') is not None else '')))
    elif c.get('need') is not None and r.get('tag') != 'mk' and r.get('nx') != 'mk' and not noTicket(r, c) and (k3['tot'] != '계산 보류' or k3.get('ltot')): k.append((f"{LBL['loan']} {LBL['cashToMoveIn']}", eok(c['need']), f'기본 가정 · 매수가 {eok(c.get("price"))} 기준' + (f' · 전세 끼고는 {esc(gapWhy(c)[1])}' if gapWhy(c) else '')))
    elif c.get('winT'):   # 23차: 착공 뒤 입주권 거래가 있으면 머리 칸('조합원 입주권을 사야 해요')과 같은 말 — '입주권 없음'과 부딪치지 않게
        _t = r.get('tx') or {}
        k.append(('입주권', '조합원 입주권 매매로', '지금 사는 집은 입주권 없음 · 기본 가정 판정') if c['winT'] == '입주권 없음' and r.get('s', 0) >= 8 and _t.get('im') else ('입주권', esc(c['winT']), '기본 가정 판정'))
    if c.get('st'): k.append(('가까운 역', f"{esc(c['st']['n'])} 도보 {walk_min(c['st']['d'])}분", ' · '.join(esc(x) for x in (c.get('ln') or [])[:3])))
    if c.get('owners'): k.append(('토지등소유자', f"{int(c['owners']):,}명", f"구역 면적 {int((r.get('sm') or {}).get('area') or 0):,}㎡" if (r.get('sm') or {}).get('area') else ''))
    o.append('<div class="kpis">' + ''.join(f'<div class="kpi"><span>{a}</span><b>{b}</b><small>{s}</small></div>' for a, b, s in k) + '</div>')
    o.append(minimap(r))
    # 인가 이력
    hist = [(lab, dt[key]) for key, lab in DTK if dt.get(key)]
    if hist:
        o.append('<h2>인가 이력</h2><ul class="steps">' + ''.join(f'<li class="{"cur" if i == len(hist) - 1 else ""}"><b>{esc(l)}</b><span>{esc(d[:10].replace("-", "."))}{" (변경)" if any(d2 < d and not (l == "정비구역 지정" and l2 == "추진위원회 승인") for l2, d2 in hist[i + 1:]) else ""}</span></li>' for i, (l, d) in enumerate(hist)) + '</ul>')
    ev = [e for e in (pm.get('ev') or []) if e and e[0] <= datetime.date.today().isoformat()][:6]
    if ev:
        o.append('<h3>정비사업 정보몽땅 최근 기록</h3><ul class="steps tl">' + ''.join(f'<li><b>{esc(d.replace("-", "."))}</b><span>{esc(sec)} · {esc(evtext(dt, d, sec, tx))}</span></li>' for d, sec, tx in ev) + '</ul>')
    # 실거래
    if t.get('n') or t.get('jn'):
        rows = []
        hd = ((TXX.get(rid) or {}).get('x') or {}).get('hd')
        H = headline(r, c, hd)   # 머리 큰 숫자 하나 — 화면 ZF.headline과 같은 규칙(tools/zsample.py)
        en = (r.get('mk') or {}).get('entry') or {}
        def zone_row(lab, pre=''):   # 구역 대표 거래 기준(tx.json x.hd) 한 줄 — 머리 숫자가 아닐 때는 짧은 참고 줄 이름 + 설명 앞에 '대지 3.3㎡당'
            if hd:
                f, to = hd['from'], hd['to']; what = HDB[hd['b']][1]
                one = hd['w'] == 0 or hd['n'] == 1   # 1건이면 '가운데 값'이라 하지 않는다
                per = f"거래 1건({to[2:4]}.{to[4:6]})" if one else f"{hd['n']}건 가운데 값({f[2:4]}.{f[4:6]}–{to[2:4]}.{to[4:6]})"
                return (lab, man(hd['u']), pre + f"{what} {per}" + (f" · 튀는 값 {hd['xo']}건 뺌" if hd.get('xo') else ''))
            if t.get('pp'):
                nv = t.get('nv', t.get('n', 0))
                return (lab, man(t['pp']), pre + ('' if nv == 1 else '가운데 값 · ') + f"빌라·단독 매매 {nv}건 · 2024년~")
            return None
        trow = None
        if c.get('price') is not None and c.get('priceSrc') in PSRC and not noTicket(r, c):   # '이 숫자 믿어도 될까' — 매수가와 같은 표본 n건 · 입주권 없는 구역은 계산 안 함(화면과 같게)
            lv, why = trust(r, c)
            trow = ('이 숫자 믿어도 될까', lv, ' · '.join([x for x in (f"매수가 표본 {en['n']}건" if en.get('n') else '', f"마지막 거래 {en['last']}" if en.get('last') else '') if x] + why))
        buy = ('계산 매수가', manT(c['price']), f"= {esc(smpTxt(r, c))}" + (f" · 전용 {en['area_med']:g}㎡ 안팎" if en.get('area_med') else '')) if trow else None
        if H and H['kind'] == 'u':   # 대지 3.3㎡당 = 매수가 표본 그대로
            rows.append(('대지 3.3㎡당', man(H['v']), esc(H['basis'])))
            if hd and abs(hd['u'] - H['v']) >= 1: rows.append(zone_row('참고 · 구역 대표 거래(3.3㎡당)', ''))   # 화면 '다른 기준 보기'처럼 참고 줄로(큰 숫자와 헷갈리지 않게)
            rows += [buy, trow]
        elif H and H['kind'] == 'p':   # 매수가가 곧 큰 숫자 · 구역 안 3.3㎡당은 참고 줄
            rows += [buy, trow]   # 표 머리칸이 좁아 이름은 '계산 매수가' 그대로(설명 줄이 '주변 300m 빌라 n건' 등 표본을 말함)
            z = zone_row(f'참고 · {"구역 안" if not est_bnd(r) else inb(r)} 거래(3.3㎡당)', '')
            if z: rows.append(z)
        else:
            if hd: rows.append(zone_row(HDB[hd['b']][0]))
            elif t.get('pp'): rows.append(zone_row('대지 3.3㎡당'))
            if buy: rows += [buy, trow]
        rows = [x for x in rows if x]
        if not buy and t.get('med'): rows.append(('빌라 매매', man(t['med']), f"가운데 값 · 2015년 이전 준공 · 최근 {t.get('nwin', 18)}개월 {t.get('no', 0)}건 · 전용 {t.get('ar', '–')}㎡"))
        if t.get('im'): rows.append(('입주권 매매', man(t['im']), f"가운데 값 · 아파트 입주권 · 최근 {t.get('iw', 12)}개월 {t.get('in', 0)}건"))
        if t.get('jm'):
            en1 = (r.get('mk') or {}).get('entry') or {}; am = en1.get('area_med'); ja = t.get('ja')
            jn = ''
            if c.get('jeonse') and c.get('price'):   # 전세 표본과 매수가 표본은 면적이 달라 바로 빼면 안 된다 → 계산에 쓴 전세(전세가율)를 함께
                diff = am and isinstance(ja, (int, float)) and abs(ja - am) / am > 0.15
                jn = (f" · 매수가 표본(전용 {am:g}㎡)과 면적 다름" if diff else '') + f" · 계산엔 전세 {manT(c['jeonse'])}(전세가율 {round(c['jeonse'] / c['price'] * 100)}%)"
            if c.get('jeonse') and c.get('price') and t['jm'] / 1e4 > c['price']:
                # 27차: 전세 가운데 값이 매수가보다 높게 보이면(표본이 다른 건물·면적) 계산에 쓴 기준을 먼저 말한다(/z/o1059)
                rows.append(('빌라 전세', man(t['jm']), f"계산엔 매수가의 {round(c['jeonse'] / c['price'] * 100)}%인 전세 {manT(c['jeonse'])}{josa(manT(c['jeonse']), '을', '를')} 써요 · 이 값은 다른 건물·면적(임대 {t.get('ja', '–')}㎡) 전세 {t.get('jn', 0)}건의 가운데 값이라 매수가보다 높게 나왔어요"))
            else: rows.append(('빌라 전세', man(t['jm']), f"가운데 값 · 전세 {t.get('jn', 0)}건 · 임대 {t.get('ja', '–')}㎡" + jn))
        if t.get('n12') is not None: rows.append((f'{inb(r)} 12개월 거래' if est_bnd(r) else '구역 안 12개월 거래', f"{t['n12']}건", '모든 유형 · 계약일 기준'))
        if t.get('yoy') is not None and min((t.get('yon') or [0])) >= 30: rows.append(('1년 변화', f"{'+' if t['yoy'] > 0 else ''}{t['yoy']}%", f"표본 {t['yon'][0]}/{t['yon'][1]}건 · 한 건물 쏠림 제외"))
        if rows:
            o.append(f'<h2>{"시세 근거" if en.get("radius") or est_bnd(r) else "구역 안 실거래"} <small class="meta">{TXD[:4]}.{TXD[4:6]}.{TXD[6:]} 신고분까지</small></h2><table class="ov"><tbody>' + ''.join(f'<tr{" id=\"trust\"" if a == "이 숫자 믿어도 될까" else ""}><th scope="row">{a}</th><td><b>{b}</b><br><small class="meta">{s}</small></td></tr>' for a, b, s in rows) + '</tbody></table>')
    if t.get('old') and r.get('s', 0) < 7:
        x = t['old']
        o.append(f'<h2>노후도</h2><p>노후·불량 <b>{x["pol"]}%</b> · 30년 넘음 {x["p30"]}% · 평균 {x["avg"]}년 <small class="meta">({x["k"]:,}/{x["n"]:,}동 확인)</small></p>')
    if r.get('rdx') and not r['rdx'].get('d'):   # 구역지정일이 변경 지정일이라 날짜를 추정하지 않은 곳(tools/enrich.py)
        x = r['rdx']
        o.append(f'<h2>권리산정기준일</h2><p><b>확인 필요</b> · {esc(x.get("b"))} <a href="{esc(x.get("u"))}" target="_blank" rel="noopener nofollow">근거</a></p>')
    elif r.get('rdx'):
        x = r['rdx']
        o.append(f'<h2>권리산정기준일</h2><p><b>{esc(x.get("d"))}</b> · {esc(x.get("b"))} <a href="{esc(x.get("u"))}" target="_blank" rel="noopener nofollow">근거</a> · <a href="../guide/ipjugwon">뜻</a></p>')
    th = (TH.get('z') or {}).get(rid)
    if th:
        o.append(f'<h2>토지거래허가 최근 내역 <small class="meta">서울부동산정보광장 · {esc(TH["since"].replace("-", "."))}~{esc(TH["asOf"].replace("-", "."))}</small></h2><p>경계 안 필지 허가 <b>{th["n"]}건</b> · 최근 30일 {th["n30"]}건 · 주거용 {th["res"]}건</p><ul class="steps tl">' + ''.join(f'<li><b>{esc(d.replace("-", "."))}</b><span>{esc(jb)} · {esc(jm)} · {esc(use)}{"" if res == "허가" else " · " + esc(res)}</span></li>' for d, jb, jm, use, res in th['r'][:5]) + '</ul>')
    au = [x for x in ((AUC.get('byZone') or {}).get(rid) or []) if not x.get('st') and str(x.get('date') or '') >= AUT] if AUC.get('ok') else []
    if au:   # 법원경매(tools/auction_match.py): 입찰기일이 남은 물건만, 사건번호로 묶어 5건까지
        g = {}
        for x in sorted(au, key=lambda x: (x.get('date') or '9', x.get('cs'), x.get('no') or 1)): g.setdefault(x.get('cs'), []).append(x)
        ek = auc_amt   # 화면 ZF.aucAmt와 같은 반올림(3.25억 → 3.3억)
        def arow(cs, xs):
            x = xs[0]; mins = [y['min'] for y in xs if isinstance(y.get('min'), (int, float)) and y['min'] > 0]
            pr = (f"최저 {ek(min(mins))}" + (f"~{ek(max(mins))}" if len(set(mins)) > 1 else '') + (f" · 감정가 {ek(x['appr'])}" if len(xs) == 1 and x.get('appr') else '') + (f" · 감정가의 {x['rate']}%" if len(xs) == 1 and x.get('rate') is not None else '')) if mins else ''
            fl = '신건' if x.get('fail') == 0 else f"유찰 {x['fail']}회" if x.get('fail') else ''
            d = str(x.get('date') or '')
            use = auc_uses([y.get('use') for y in xs])
            jb = next((y.get('jb') for y in xs if y.get('jb')), None)
            if jb: use += ' · ' + auc_jb(jb)
            when = f"입찰 {int(d[5:7])}.{int(d[8:10])}" if len(d) == 10 else ''
            head = esc(cs) + (f' · 물건 {len(xs)}개' if len(xs) > 1 else '')
            return f'<li><b>{head}</b><span>{esc(" · ".join(v for v in [use, pr, when, fl] if v))}</span></li>'
        o.append(f'<h2>경매 예정 {len(g)}건' + (f' · 물건 {len(au)}개' if len(au) > len(g) else '') + f' <small class="meta">법원경매정보 · {esc(str(AUC.get("asOf") or "").replace("-", "."))} 기준 · 구역 경계 안 필지</small></h2><ul class="steps tl">' + ''.join(arow(cs, xs) for cs, xs in list(g.items())[:5]) + '</ul>' + (f'<p class="meta">그 밖 {len(g) - 5}개 사건은 앱 구역 리포트 거래 탭에서 볼 수 있어요.</p>' if len(g) > 5 else ''))
    if S and r.get('ll'):
        a, b = r['ll']
        near = sorted(((dist(a, b, x[1], x[0]), x) for x in S['items']), key=lambda z: z[0])
        n1 = [x for d, x in near if d <= 1000]
        if n1:
            big = sorted(n1, key=lambda x: -x[4])[:3]
            o.append(f'<h2>주변 상권</h2><p>반경 1km에 상권 {len(n1)}곳 · 점포 {sum(x[4] for x in n1):,}개 · 학원 {sum(x[5] for x in n1):,}개. 큰 곳은 ' + ', '.join(f'{esc(x[2])}(점포 {x[4]:,})' for x in big) + f'. <small class="meta">{esc(S["q"])} 기준</small></p>')
    # 같은 구 다른 구역
    same = [x for x in R if x['g'] == r['g'] and x['id'] != rid and x['id'] in PAGES][:8]
    if same:
        o.append(f'<nav aria-labelledby="zo-{rid}"><h2 id="zo-{rid}">{esc(r["g"])} 다른 구역</h2><div class="grid2">' + ''.join(f'<a class="zl" href="{x["id"]}">{esc(short(x["n"]))}<small>{esc(KIND.get(x["k"], x["k"]))} · {esc((C.get(x["id"]) or {}).get("stage") or x.get("sr") or "")}</small></a>' for x in same) + '</div></nav>')
    cafe = f' · <a href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl={esc(pm["cafe"])}" target="_blank" rel="noopener nofollow">정보몽땅 원문</a>' if pm.get('cafe') else ''
    # 25차: 출처·신고·소식·면책을 한 줄로(예전 고정 문단 세 개는 모든 구역에 같은 글이라 본문을 묽게 했다)
    o.append(f'<nav class="zrow meta" aria-label="출처·소식·오류 신고"><a href="../method">출처·계산 방법</a>{cafe} · <a href="../feed/z/{rid}.xml">RSS</a> · <a href="../gu/{esc(r["g"])}">{esc(r["g"])} 전체</a> · {REPORT_A(r)}</nav><script src="/cf.js" defer></script>')
    o.append(FOOT.format(upd=UPD))
    # 구조화 데이터: 글(Article) + 이동 경로(BreadcrumbList) + 장소(Place · 위경도·주소) · 공유 카드는 구역마다
    zg = (GEO.get('z') or {}).get(rid) or {}
    og = None
    if OG_OK:
        mk = next(((a, b) for a, b, _ in k if a not in ('현재 단계', '가까운 역', '토지등소유자')), None)
        og = zmap.og_card(rid, nm, f"{r['g']} {r.get('j') or ''} · {kind}".strip(), stage or '단계 확인 중', mk[0] if mk else '', re.sub(r'<[^>]+>', '', mk[1]) if mk else '', (r['ll'][1], r['ll'][0]) if r.get('ll') else (tuple(zg['l']) if zg.get('l') else None), r['g'], UPD)
    elif os.path.exists(os.path.join(ROOT, 'public/og/z', rid + '.png')): og = f'/og/z/{rid}.png'   # 글꼴·PIL이 없는 곳에서 돌 때는 있던 카드를 그대로
    if og: ld0["image"] = SITE + og
    graph = [ld0, crumbs(((BRAND), SITE + "/"), ("구역별 페이지", f"{SITE}/z/"), (r['g'], f"{SITE}/gu/{r['g']}"), (nm, url))]
    graph.append(place_ld(r, url))
    h = plain(''.join(o)).replace('@@LD@@', json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace('</', '<\\/'), 1)
    if og: h = h.replace(f'<meta property="og:image" content="{SITE}/og.png">', f'<meta property="og:image" content="{SITE}{og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:image" content="{SITE}{og}">', 1)
    return h
R = [r for r in D['recs'] if not (r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7)) and r.get('src') != 'moa' and r.get('n')]   # 화면의 '진행 중'과 같은 기준
# 29차: 앱 목록·곳 수와 같은 한 판정 — 전세 끼고 '지금'이 있고, 참고값(lc · 표본이 적거나 구성이 달라 신뢰 낮음)도 같은 구 평균 추정(isEst)도 아니고, 시장 정비(mk)도 아닌 곳
def LISTED(x):
    c = C.get(x['id']) or {}
    return bool(c.get('gapOk') and c.get('gapNow') is not None and not x.get('lc') and not isEst(x, c) and x.get('tag') != 'mk')
def EXCL(x):   # 숫자는 있지만 신뢰가 낮아 목록에서 빼는 곳(/z '추정 신뢰 낮아 목록에서 뺐어요'와 같은 판정)
    c = C.get(x['id']) or {}
    return bool(c.get('gapOk') and c.get('gapNow') is not None and (x.get('lc') or isEst(x, c)))
_isdone = lambda r: bool(r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7))
N_DONE = sum(1 for r in D['recs'] if _isdone(r) and r.get('src') != 'moa'); N_MOA = sum(1 for r in D['recs'] if not r.get('dn') and r.get('src') == 'moa')
CNT_NOTE = f'<p class="meta">진행 중 {len(R):,}곳은 준공·해산된 {N_DONE:,}곳과 모아타운 관리지역 {N_MOA:,}곳을 뺀 숫자예요. 첫 화면·메뉴의 숫자와 같은 기준이에요.</p>'
_ALL = {r['id'] for r in D['recs']}
_LIVE = {r['id'] for r in R}
for f in os.listdir(ZD):   # 진행 중이 아닌 구역(준공·해산·자료에서 빠진 곳)의 자동 페이지는 지운다 — 매일 다시 안 만들어져 날짜·숫자가 멈춰 있던 것(손으로 쓴 페이지는 둔다)
    if f.endswith('.html') and f != 'index.html' and f[:-5] not in _LIVE and not is_hand(f[:-5]): os.remove(os.path.join(ZD, f)); print('  removed stale page', f)
# 같은 곳이 두 번 실렸던 옛 id(tools/enrich.py D.alias) → 남긴 구역 페이지로 옮기는 작은 페이지(색인 안 함 · 옛 링크·공유 유지)
_BY = {r['id']: r for r in D['recs']}
for _a, _k in (D.get('alias') or {}).items():
    if _k not in _LIVE or is_hand(_a): continue
    _u = f"{SITE}/z/{_k}"
    open(os.path.join(ZD, _a + '.html'), 'w', encoding='utf-8').write(f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="emr-auto" content="1"><meta name="robots" content="noindex,follow">
<title>{esc(short(_BY[_k]['n']))} | {BRAND}</title><link rel="canonical" href="{_u}"><meta http-equiv="refresh" content="0; url=./{_k}"><script>location.replace("./{_k}"+location.search+location.hash)</script></head>
<body style="font-family:system-ui,sans-serif;padding:24px"><p>같은 구역이 한 페이지로 합쳐졌어요. <a href="./{_k}">{esc(short(_BY[_k]['n']))} 페이지로 가기</a></p></body></html>
''')
    print('  alias page', _a, '->', _k)
# 손으로 쓴 글(구역 정리 페이지·가이드·리포트·소개): 본문은 두고 용어만 정식 말로 · 푸터 '데이터 기준'은 오늘 자료 날짜로(매 실행, 같은 결과면 그대로)
TERM_FIX = [(re.compile(r'입주까지 총액|입주까지 총(?=[\s ③<])'), LBL['cashToMoveIn']), (re.compile(r'(?<!정보)(?<!사업 )정비몽땅'), '정비사업 정보몽땅'),
            (re.compile(r'입주까지 필요한 현금'), LBL['cashToMoveIn']), (re.compile(r'지금 필요한 현금'), '지금 필요한 돈'), (re.compile(r'내 현금'), '내 돈'), (re.compile(r'살 수 있는 곳'), '갈 수 있는 곳'),
            (re.compile(r'살 수 있'), '갈 수 있'), (re.compile(r'가용 현금'), '내 돈'), (re.compile(r'필요 현금'), LBL['cashToMoveIn']), (re.compile(r'5천만'), '5,000만'), (re.compile(r'계산 안 해요'), '계산하지 않아요'), (re.compile(r'즐겨찾기해 두면'), '북마크해 두면'), (re.compile(r'내 찜'), '내 관심 구역')]   # 17차 용어 통일   # 용어집(리뉴얼 5단계)
JARGON = [(re.compile(r'내 지분 값\(권리가액\)|권리가액'), '내 지분 값(권리가액)', '내 지분 값'), (re.compile(r'웃돈\(프리미엄\)|프리미엄'), '웃돈(프리미엄)', '웃돈')]
def plain(h):
    """본문 글자(태그·스크립트 밖)에서 처음 나오는 '권리가액'·'프리미엄'은 '내 지분 값(권리가액)'·'웃돈(프리미엄)', 그 뒤는 쉬운 말만(앱 76_detail.js plain과 같은 규칙)."""
    b = h.find('<body'); 
    if b < 0: return h
    head, body = h[:b], h[b:]
    parts = re.split(r'(<script[\s\S]*?</script>|<style[\s\S]*?</style>|<[^>]+>)', body)
    seen = [False] * len(JARGON)
    for i, t in enumerate(parts):
        if i % 2 or not t: continue
        for k, (rx, full, easy) in enumerate(JARGON):
            def f(m, k=k, full=full, easy=easy):
                if not seen[k]: seen[k] = True; return full
                return easy
            t = rx.sub(f, t)
        parts[i] = t
    return head + ''.join(parts)
def term_fix(h):
    for a, b in TERM_FIX: h = a.sub(b, h)
    h = plain(h)
    return re.sub((r'(<p class="f-c">© \d{4} ' + BRAND + r' · 데이터 기준 )[\d.]+'), lambda m: m.group(1) + UPD, h)
def hand_live(r, h):
    """손으로 쓴 구역 페이지: 글 속 숫자는 쓴 날 기준이라 머리 날짜를 '글 기준'으로 밝히고, 바로 밑에 오늘 숫자 상자(자동 페이지와 같은 값)를 끼운다."""
    rid = r['id']; c = C.get(rid) or {}
    h = re.sub(r'(<p class="eyebrow">[^<]*?)데이터 기준 ([\d.]+)', r'\1글 기준 \2', h, count=1)
    parts = [f"지금 <strong>{esc(c.get('stage') or r.get('sr') or '')}</strong> 단계"]
    if c.get('gapOk') and c.get('gapTotal') is not None: parts.append(f"{LBL['gap']} {LBL['cashToMoveIn']} <strong>{eok(c['gapTotal'])}</strong> (지금 {eok(c.get('gapNow'))})")
    elif c.get('need') is not None and r.get('tag') != 'mk' and r.get('nx') != 'mk' and not noTicket(r, c) and ((_k3 := key3(r, c, (P.get(rid) or {}).get('dt') or {}, D.get('asOf'), D.get('upd')))['tot'] != '계산 보류' or _k3.get('ltot')): parts.append(f"{LBL['loan']} · {LBL['cashToMoveIn']} <strong>{eok(c['need'])}</strong>")
    box = f'<div class="hbox" id="zp-live"><b>최신 숫자 · 데이터 기준 {UPD}</b>{" · ".join(parts)} · 기본 가정 · <a href="../#{rid}">입주 계산에서 열기</a></div>'
    # 앱 상세와 같은 3숫자 상자 + 신고 링크(표시 주석 사이 · 매일 다시 씀)
    kb = '<!--zk-->' + key3_html(r, c, (P.get(rid) or {}).get('dt') or {}, cap=True) + '<!--/zk-->'
    if '<!--zk-->' in h:
        h = re.sub(r'<!--zk-->.*?<!--/zk-->', lambda m: kb, h, count=1, flags=re.S)
        h = re.sub(r'<div class="hbox" id="zp-live">.*?</div>', '', h, count=1, flags=re.S)
        rp = '<!--zr-->' + REPORT_P(r) + '<!--/zr-->'
        h = re.sub(r'<!--zr-->.*?<!--/zr-->', lambda m: rp, h, count=1, flags=re.S) if '<!--zr-->' in h else h.replace('</main>', rp + '</main>', 1)
        return h
    if 'id="zp-live"' in h:
        h = re.sub(r'<div class="hbox" id="zp-live">.*?</div>', lambda m: kb, h, count=1, flags=re.S)
        return h.replace('</main>', '<!--zr-->' + REPORT_P(r) + '<!--/zr--></main>', 1)
    m = re.search(r'<p class="byline">.*?</p>', h, re.S) or re.search(r'</h1>', h)
    return (h[:m.end()] + kb + h[m.end():]).replace('</main>', '<!--zr-->' + REPORT_P(r) + '<!--/zr--></main>', 1) if m else h
PAGES = {r['id'] for r in R} | {f[:-5] for f in os.listdir(ZD) if f.endswith('.html') and f != 'index.html'}
def hand_og(r):
    """손으로 쓴 페이지는 본문을 두고, 공유 카드(글자만)와 og:image 메타만 붙인다."""
    rid = r['id']; f = os.path.join(ZD, rid + '.html'); h = open(f, encoding='utf-8').read()
    base = f'<meta property="og:image" content="{SITE}/og.png">'
    if 'og:image' not in h: h = h.replace('</head>', base + '\n</head>', 1)
    if base not in h and f'/og/z/{rid}.png' not in h: return   # 손으로 다른 카드를 단 페이지는 그대로
    c = C.get(rid) or {}; kind = KIND.get(r['k'], r['k'])
    if c.get('gapOk') and c.get('gapTotal') is not None: ml, mv = f"{LBL['gap']} {LBL['cashToMoveIn']} · 기본 가정", eok(c['gapTotal'])
    elif c.get('need') is not None and r.get('tag') != 'mk' and not noTicket(r, c): ml, mv = f"{LBL['loan']} · {LBL['cashToMoveIn']} · 기본 가정", eok(c['need'])
    else: ml, mv = '', ''
    og = zmap.og_card(rid, short(r['n']), f"{r['g']} {r.get('j') or ''} · {kind}".strip(), c.get('stage') or r.get('sr') or '단계 확인 중', ml, mv, None, r['g'], UPD, text_only=True) if OG_OK else (f'/og/z/{rid}.png' if os.path.exists(os.path.join(ROOT, 'public/og/z', rid + '.png')) else None)
    if not og or base not in h: return
    h = h.replace(base, f'<meta property="og:image" content="{SITE}{og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:image" content="{SITE}{og}">', 1)
    open(f, 'w', encoding='utf-8').write(h)
def hand_seo(r, h):
    ("""손으로 쓴 구역 글: 본문은 두고 머리만 자동 페이지와 같게 — 제목 '<짧은 이름> 재개발 | 단계·실거래·입주 현금 | """ + BRAND + """', 구조화 데이터(글 + 이동 경로 + 장소).""")
    rid = r['id']; nm = short(r['n']); kind = KIND.get(r['k'], r['k']); url = f"{SITE}/z/{rid}"
    t = ztitle_s(r)
    h = re.sub(r'<title>.*?</title>', lambda m: f'<title>{esc(t)}</title>', h, count=1, flags=re.S)
    h = re.sub(r'<meta property="og:title" content="[^"]*">', lambda m: f'<meta property="og:title" content="{esc(t)}">', h, count=1)
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
    try: obj = json.loads(m.group(1)) if m else {}
    except ValueError: obj = {}
    art = next((x for x in obj.get('@graph', []) if x.get('@type') == 'Article'), None) if '@graph' in obj else ({k: v for k, v in obj.items() if k != '@context'} if obj.get('@type') else None)
    graph = ([art] if art else []) + [crumbs(((BRAND), SITE + "/"), ("구역별 페이지", f"{SITE}/z/"), (r['g'], f"{SITE}/gu/{r['g']}"), (nm, url)), place_ld(r, url)]
    tag = '<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace('</', '<\\/') + '</script>'
    return h[:m.start()] + tag + h[m.end():] if m else h.replace('</head>', tag + '\n</head>', 1)
# 모든 정적 페이지 공통: 머리 검색(좁은 화면 포함) · 다크 theme-color를 앱과 같게(#15181D) · '정보몽땅' 첫 언급은 '정비사업 정보몽땅'
TSR = '<form class="tsr" action="/" method="get" role="search"><label class="sr-only" for="tq">구역 검색</label><input id="tq" name="q" type="search" placeholder="구역·동·역 검색" autocomplete="off" enterkeyhint="search" maxlength="40"></form><script>matchMedia("(max-width:399.98px)").matches&&(document.getElementById("tq").placeholder="검색")</script>'
def static_norm(h):
    h = h.replace('content="#14171C" media="(prefers-color-scheme: dark)"', 'content="#15181D" media="(prefers-color-scheme: dark)"')
    if '<header class="top"><a ' in h: h = h.replace('<header class="top"><a ', '<header class="top"><div class="in"><a ', 1).replace('</nav></header>', '</nav></div></header>', 1)
    if 'class="tsr"' not in h: h = re.sub(r'</nav>(</div></header>)', lambda m: '</nav>' + TSR + m.group(1), h, count=1)
    else: h = re.sub(r'<form class="tsr".*?</form>(?:<script>(?:innerWidth<400|matchMedia\("\(max-width:399)[^<]*</script>)?', lambda m: TSR, h, count=1, flags=re.S)   # 26차: 좁은 화면(400px 아래) 자리표시 '검색'
    if 'rel="manifest"' not in h and '</head>' in h: h = h.replace('</head>', '<link rel="manifest" href="/manifest.webmanifest">\n</head>', 1)   # 26차: 정적 페이지에서도 설치 앱과 같은 매니페스트
    def first(seg):
        i = seg.find('정보몽땅')
        return seg if i < 0 or seg[max(0, i - 5):i] == '정비사업 ' else seg[:i] + '정비사업 ' + seg[i:]
    b = h.find('<body')
    if b > 0:
        hd = h[:b]; m = re.search(r'<meta name="description" content="[^"]*">', hd)
        if m: hd = hd[:m.start()] + first(m.group(0)) + hd[m.end():]
        h = hd + first(h[b:])
    return h
def hand_calc(r, h):
    """26차: 손으로 쓴 구역 글의 '기본 가정으로 계산한 입주까지 현금' 덩이를 오늘 숫자로 다시 쓴다(머리 카드와 같은 calc.json 값).
    예전엔 글 쓴 날(09.26) 숫자가 그대로 남아 머리 카드(오늘)와 22곳에서 어긋났다. 이야기 속 금액에는 '글 쓴 날 기준' 표시를 붙인다."""
    rid = r['id']; c = C.get(rid) or {}; g = r['g']
    m = re.search(r'<!--zc-->.*?<!--/zc-->', h, re.S) or re.search(r'<h2>기본 가정으로 계산한 입주까지 현금</h2>.*?(?=<h2|<p class="disc"|<!--zr-->|</main>)', h, re.S)
    if not m: return h
    k = key3(r, c, (P.get(rid) or {}).get('dt') or {}, D.get('asOf'), D.get('upd'))
    gap = bool(c.get('gapOk') and c.get('gapNow') is not None)
    kp = []
    if c.get('price') is not None and not noTicket(r, c):
        kp.append(('계산 매수가', manT(c['price']), esc(smpTxt(r, c))))
    if gap:
        kp.append((f"{LBL['gap']} · 지금 필요한 돈", cash(c['gapNow']), f"전세 {manT(c['jeonse'])}{josa(manT(c['jeonse']), '을', '를')} 안고 사는 경우(+취득세)" if c.get('jeonse') is not None else '기본 가정'))
        if c.get('gapTotal') is not None: kp.append((f"{LBL['gap']} · {LBL['cashToMoveIn']}", cash(c['gapTotal']), '세금·이자 포함 · 입주 때 잔금대출 최대 가정'))
    elif c.get('now') is not None and not r.get('lc') and r.get('tag') != 'mk' and not noTicket(r, c):
        kp.append((f"{LBL['loan']} · 지금 필요한 돈", cash(c['now']), '전세 끼고는 계산 보류'))
        if c.get('need') is not None: kp.append((f"{LBL['loan']} · {LBL['cashToMoveIn']}", cash(c['need']), '세금·이자 포함 · 입주 때 잔금대출 최대 가정'))
    p = []
    if gap:
        p.append(f"전세를 안고 사면 계약할 때 {cash(c['gapNow'])}{josa(cash(c['gapNow']), '이', '가')} 들어요." + (f" 이주 때 전세금을 돌려주고 분담금·세금·이자를 더한 뒤 입주 때 잔금대출을 최대로 받는다고 치면, 입주까지 준비할 현금은 {cash(c['gapTotal'])}이에요." if c.get('gapTotal') is not None else ' 입주까지 현금은 입주 시점·신축 시세 자료가 부족해 계산하지 않았어요.'))
        if c.get('cashOk') and c.get('need') is not None: p.append(f"전세 없이 대출을 끼고 사면 입주까지 {cash(c['need'])}이에요.")
    elif kp and c.get('now') is not None:
        why = re.sub(r'^전세를 안고는 살 수 없어요 · ', '', k.get('basis') or '') or '전세를 끼고 살 수 없는 곳'
        p.append(f"전세 끼고는 계산하지 않아요({why}). 대출을 끼고 사면 지금 {cash(c['now'])}" + (f", 입주까지 {cash(c['need'])}이 들어요." if c.get('need') is not None else '이 들어요.'))
    elif noTicket(r, c):
        p.append('지금 사면 입주권이 나오지 않아 지금 필요한 돈과 입주까지 현금은 계산하지 않아요(계산 보류). 새 아파트를 원하면 조합원 입주권 매매나 일반분양을 알아봐야 해요.')
    else:
        p.append(f"지금 필요한 돈은 계산 보류예요. {(k.get('basis') or '매수가로 쓸 거래가 없어 계산하지 않아요').rstrip('.')}.")
    cmp_ = []
    okv = LISTED
    mine = c['gapNow'] if gap else None
    oth = sorted((x for x in R if x['g'] == g and x['id'] != rid and okv(x) and (mine is None or C[x['id']]['gapNow'] < mine)), key=lambda x: C[x['id']]['gapNow'])[:3]
    for x in oth:
        v = C[x['id']]
        cmp_.append(f'<li><a href="{x["id"]}">{esc(short(x["n"]))}</a> · 전세 끼고 지금 드는 돈 {cash(v["gapNow"])}' + (f' · 입주까지 {cash(v["gapTotal"])}' if v.get('gapTotal') is not None else '') + f' · {esc(v.get("stage") or x.get("sr") or "")}</li>')
    cc = math.ceil(c['gapNow'] if gap else (c.get('now') or 1))
    blk = (f'<!--zc--><h2>기본 가정으로 계산한 입주까지 현금 <small class="meta">데이터 기준 {UPD} · 위 카드와 같은 값</small></h2>'
           + ('<div class="kpis">' + ''.join(f'<div class="kpi"><span>{a}</span><b>{b}</b><small>{s}</small></div>' for a, b, s in kp) + '</div>' if kp else '')
           + ''.join(f'<p>{esc(x)}</p>' for x in p)
           + f'<p class="note">가정: 무주택·84㎡·비례율 100%·연소득 미입력. 바꾸면 결과가 크게 달라져요(<a href="../method">계산 가정 전체</a>).</p>'
           + f'<div class="cta"><a class="btn primary" href="../?from=z{"" if gap else "&fund=cash"}&cash={cc}#{rid}">내 돈으로 다시 계산하기</a></div>'
           + (f'<h3>비교용 자료: 같은 {esc(g)}에서 전세 끼고 지금 드는 돈이 {"더 적은" if gap else "계산되는"} 구역</h3><p class="meta">추천 목록이 아니에요. 단계·준공 가능성은 구역마다 달라요.</p><ul class="links">' + ''.join(cmp_) + '</ul>' if cmp_ else '')
           + '<!--/zc-->')
    h = h[:m.start()] + blk + h[m.end():]
    # 이야기 속 금액은 글 쓴 날 기준(지어 고치지 않음) — 이야기 바로 밑에 한 줄
    wd = re.search(r'글 기준 (\d{4}\.\d\d\.\d\d)', h)
    note = f'<!--zn--><p class="meta znum">이야기 속 금액·순위는 글을 쓴 {wd.group(1) if wd else "날"} 기준이에요. 최신 값은 위 카드와 아래 계산을 보세요.</p><!--/zn-->'
    if '<!--zn-->' in h: h = re.sub(r'<!--zn-->.*?<!--/zn-->', lambda _: note, h, count=1, flags=re.S)
    else:
        i = h.find('<div class="zstory">')
        if i >= 0:
            j = h.find('</div>', i)
            if j > 0: h = h[:j + 6] + note + h[j + 6:]
    return h
def hand_kpi(r, h):
    """리뉴얼 통합(data.sync): 예전 손글 머리 숫자 칸 중 매일 바뀌는 '가까운 역'·'10년 안 준공 가능성'을 오늘 값으로(앱·API·자동 /z와 같은 calc.json · 같은 반올림).
    글 본문 문장 속 숫자는 글 기준일 값 그대로 둔다(글쓰기 트랙 data-zv 대상)."""
    c = C.get(r['id']) or {}
    if c.get('st'):
        b = f"{esc(c['st']['n'])} 도보 {walk_min(c['st']['d'])}분"; sm = ' · '.join(esc(x) for x in (c.get('ln') or [])[:3])
        h = re.sub(r'(<div class="kpi"><span>가까운 역</span><b>)[^<]*(</b><small>)[^<]*(</small>)', lambda m: m.group(1) + b + m.group(2) + sm + m.group(3), h, count=1)
    if c.get('p10') is not None:
        h = re.sub(r'(<div class="kpi"><span>10년 안 준공 가능성</span><b>)[^<]*(</b>)', lambda m: m.group(1) + prob_txt(c['p10']) + m.group(2), h, count=1)
        if c['p10'] >= 0.01:   # 글 속 '이 페이지 통계로 본 10년 안 준공 가능성은 약 N%' — 같은 통계라 오늘 값으로(1% 미만이 되면 문장 꼴이 달라 그대로 두고 QA가 알림)
            h = re.sub(r'(10년 안 준공 가능성은 약 )\d+(%)', lambda m: m.group(1) + str(prob(c['p10'])) + m.group(2), h)
        if re.match(r'\d{4}-\d{2}', str(c.get('eMid') or '')):
            em = f"{c['eMid'][:4]}년 {int(c['eMid'][5:7])}월"
            h = re.sub(r'(<div class="kpi"><span>10년 안 준공 가능성</span><b>[^<]*</b><small>준공 시점 가운데 값 )\d{4}년 \d{1,2}월', lambda m: m.group(1) + em, h, count=1)
    return h
def hand_fix(r):
    f = os.path.join(ZD, r['id'] + '.html'); h0 = open(f, encoding='utf-8').read()
    h1 = static_norm(hand_seo(r, term_fix(hand_kpi(r, hand_calc(r, hand_live(r, h0))) if r['id'] in _LIVE else h0)))
    if r['id'] in _LIVE and r['id'] not in ZH_IDS: h1 = zhand.enhance_hand(_ZX, r, h1)   # 리뉴얼: 예전 손글에도 목차·다음에 볼 구역(본문은 그대로)
    if h1 != h0: open(f, 'w', encoding='utf-8').write(h1)
# ---- 얇은 페이지 거르기(24차 · 애드센스 '가치가 별로 없는 콘텐츠' 대응) ----
# 자동 페이지마다 (1) 자료가 얼마나 있는지(계산 매수가 표본 · 구역 안 거래 · 날짜가 있는 인가 이력 · 정보몽땅 추진경과 기록 · 법원경매 · 토지거래허가)와
# (2) 다른 구역 페이지와 겹치지 않는 본문 글자 수(숫자를 0으로 바꿔 같은 틀 문장이 THIN_TPL곳 넘게 나오면 틀로 봄)를 잰다.
# 자료 점수(계산 매수가 표본 2점 — 실제 거래로 낸 이 구역만의 숫자 · 구역 안 거래·인가 날짜·추진경과 기록·경매·토지거래허가 각 1점)가 THIN_SIG 미만이고 고유 본문도 THIN_TXT자 미만이면 <meta name="robots" content="noindex,follow"> — 사람은 그대로 열 수 있고 링크는 따라가며,
# sitemap.py가 noindex 페이지를 사이트맵에서 뺀다. 손으로 쓴 구역 글(emr-auto 없음)은 늘 색인. 매일 다시 잰다(자료가 늘면 다시 색인).
# 25차(애드센스 1차 레드팀): 색인 = '지금 필요한 돈'을 실제로 계산한 곳(계산 보류 아님) 그리고 (자료 점수 4 이상 또는 고유 본문 600자 이상)일 때만.
#   나머지 자동 페이지는 전부 noindex,follow + 사이트맵 제외(사람·링크로는 그대로 열림). 손으로 쓴 구역 글은 늘 색인.
THIN_SIG, THIN_TXT, THIN_TPL = 4, 800, 10
THIN_W = {'price': 2, 'trades': 1, 'dates': 1, 'records': 1, 'auction': 1, 'toheo': 1}
NOIDX = '<meta name="robots" content="noindex,follow">'
def zsignals(r):
    rid = r['id']; c = C.get(rid) or {}; dt = (P.get(rid) or {}).get('dt') or {}
    today = datetime.date.today().isoformat()
    t = r.get('tx') or {}; hd = ((TXX.get(rid) or {}).get('x') or {}).get('hd')
    s = {'price': bool(c.get('price') is not None and c.get('priceSrc') in PSRC and not noTicket(r, c)),   # 계산 매수가 표본(이 구역 거래로 낸 매수가)
         'trades': bool(hd or t.get('pp') or t.get('im')),   # 구역 안 대표 거래 · 빌라 대지 3.3㎡당 · 입주권 매매
         'dates': any(dt.get(k) for k, _ in DTK),
         'records': any(e and e[0] <= today for e in ((P.get(rid) or {}).get('ev') or [])),
         'auction': bool(AUC.get('ok') and [x for x in ((AUC.get('byZone') or {}).get(rid) or []) if not x.get('st') and str(x.get('date') or '') >= AUT]),
         'toheo': bool((TH.get('z') or {}).get(rid))}
    return s
_SEGX = re.compile(r'<(?:/?)(?:p|h\d|li|div|tr|td|th|section|ul|ol|table|details|summary|a|small|br|span|b)\b[^>]*>')
def zsegs(h):
    m = re.search(r'<main>(.*)</main>', h, re.S); b = m.group(1) if m else ''
    b = re.sub(r'<(script|style|svg)[^>]*>.*?</\1>', '', b, flags=re.S)
    b = re.sub(r'<nav[^>]*>.*?</nav>', '', b, flags=re.S)   # 25차: 같은 구 다른 구역 링크 목록은 본문 글자로 세지 않는다
    b = html.unescape(re.sub(r'<[^>]+>', '', _SEGX.sub('\n', b)))
    return [x.strip() for x in re.split(r'\n|(?<=[.요다])\s', b) if x.strip()]
_tpl = lambda x: re.sub(r'[\d,.%]+', '0', x)
eok_m = __import__('zsample').eok_m
# 리뉴얼 A1: 손으로 쓴 구역 분석 글(content/z/*.json) → public/z/<id>.html (아래 손글 처리 hand_fix가 최신 숫자 상자·계산 덩이를 채운다)
import zhand
ZH_IDS = set(zhand.render_all(globals())); _ZX = zhand.Ctx(globals()); _ZX._HANDSET = zhand.HANDSET
made = kept = 0
AUTO = {}
for r in R:
    if is_hand(r['id']): kept += 1; hand_og(r); hand_fix(r); continue
    AUTO[r['id']] = (r, MONEY(page(r)))
_SG = {k: zsegs(h) for k, (_, h) in AUTO.items()}
_CNT = collections.Counter(t for v in _SG.values() for t in {_tpl(x) for x in v})
THIN = {}
for rid, (r, h) in AUTO.items():
    sg = zsignals(r); n = sum(THIN_W[k] for k, v in sg.items() if v)
    u = sum(len(x) for x in _SG[rid] if _CNT[_tpl(x)] <= THIN_TPL)
    calc = key3(r, C.get(rid) or {}, (P.get(rid) or {}).get('dt') or {}, D.get('asOf'), D.get('upd'))['now'] != '계산 보류'
    thin = not (calc and u >= THIN_TXT)   # 26차(애드센스 2차): 계산되는 곳 + 다른 구역과 겹치지 않는 본문 800자 이상일 때만 색인
    THIN[rid] = {'sig': [k for k, v in sg.items() if v], 'score': n, 'uniq': u, 'calc': calc, 'noindex': thin}
    if thin: h = h.replace('<meta name="emr-auto" content="1">', '<meta name="emr-auto" content="1">\n' + NOIDX, 1)
    open(os.path.join(ZD, rid + '.html'), 'w', encoding='utf-8').write(h); made += 1
_ni = sum(1 for v in THIN.values() if v['noindex'])
# 리뉴얼 A1: 손글(content/z)도 같은 잣대로 잰다(자료 점수 · 다른 페이지와 겹치지 않는 본문 글자) — 손글은 늘 색인이지만 tools/zhand_check.py가 기준(점수 4·고유 800자) 통과를 확인
HANDM = {}
for rid in sorted(ZH_IDS):
    _h = open(os.path.join(ZD, rid + '.html'), encoding='utf-8').read(); _sg = zsegs(_h)
    _c2 = collections.Counter(_CNT); _c2.update({_tpl(x) for x in _sg})
    _sig = zsignals(_BY[rid])
    HANDM[rid] = {'sig': [k for k, v in _sig.items() if v], 'score': sum(THIN_W[k] for k, v in _sig.items() if v), 'uniq': sum(len(x) for x in _sg if _c2[_tpl(x)] <= THIN_TPL)}
json.dump({'rule': {'needs_calc': True, 'score_min': THIN_SIG, 'weights': THIN_W, 'unique_chars_min': THIN_TXT, 'template_pages': THIN_TPL}, 'auto': len(THIN), 'indexed': len(THIN) - _ni, 'noindex': _ni, 'hand': kept, 'pages': THIN, 'handPages': HANDM},
          open(os.path.join(ROOT, 'pipeline/cache/zthin.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'zpages thin control: auto {len(THIN)} · indexed {len(THIN) - _ni} · noindex {_ni} · hand(always indexed) {kept}')
_RID = {r['id'] for r in R}
for r in D['recs']:   # 준공·해산 등으로 목록에서 빠졌지만 손으로 쓴 페이지가 남은 구역도 공유 카드는 붙인다
    if r['id'] not in _RID and r.get('n') and os.path.exists(os.path.join(ZD, r['id'] + '.html')) and os.path.getsize(os.path.join(ZD, r['id'] + '.html')): hand_og(r); hand_fix(r)
# 목록 페이지: 손으로 쓴 정리 페이지를 위에, 나머지는 구별로
hand = [r for r in D['recs'] if is_hand(r['id'])]
byg = collections.defaultdict(list)
for r in R: byg[r['g']].append(r)
li = lambda x: f'<a class="zl" href="{x["id"]}">{esc(short(x["n"]))}<small>{esc(KIND.get(x["k"], x["k"]))} · {esc((C.get(x["id"]) or {}).get("stage") or x.get("sr") or "")}</small></a>'
idx = [HEAD.format(title=('서울 정비사업 구역별 페이지 | ' + BRAND + ' - 서울 재개발 지도'), desc=f'서울 진행 중 정비사업 {len(R)}곳의 구역별 진행 단계·실거래·노후도·입주까지 현금. 데이터 기준 {UPD}.', url=f'{SITE}/z/', site=SITE,
                  ld=json.dumps({"@context": "https://schema.org", "@graph": [{"@type": "CollectionPage", "name": "서울 정비사업 구역별 페이지", "url": f"{SITE}/z/", "inLanguage": "ko"}, crumbs(((BRAND), SITE + "/"), ("구역별 페이지", f"{SITE}/z/"))]}, ensure_ascii=False)).replace('<meta name="emr-auto" content="1">\n', '')]
idx.append(f'<p class="eyebrow">구역별 페이지 · 데이터 기준 {UPD}</p><h1>서울 정비사업 구역별 페이지</h1><p class="lede">서울에서 진행 중인 재개발·재건축·가로주택 {len(R)}곳을 구역마다 한 페이지로 정리했어요. 진행 단계와 인가 이력, 구역 안 실거래, 노후도, 권리산정기준일, 기본 가정의 지금 필요한 돈과 입주까지 현금이 있어요. 매일 자동 갱신돼요.</p>')
idx.append(CNT_NOTE)
if hand: idx.append('<h2>기사·고시로 대조해 정리한 구역</h2><p>규모가 커서 확인할 거리가 많은 구역은 기사·고시와 정비사업 정보몽땅 등록값을 대조한 이야기를 붙였어요.</p><div class="grid2">' + ''.join(li(x) for x in hand if x['id'] in {y['id'] for y in R}) + '</div>')
# 27차(애드센스 3차): 구역 844곳을 한 페이지에 다 늘어놓지 않는다 — 구마다 한 줄 요약 + 자세히 정리된(색인되는) 구역만 링크, 나머지는 구별 페이지에서
_HID = {x['id'] for x in hand}
_PK = {g: sorted((x for x in byg[g] if x['id'] not in _HID and not (THIN.get(x['id']) or {}).get('noindex', True)), key=lambda x: -x.get('s', 0)) for g in byg}
idx.append('<h2>자치구별로 보기</h2><p>구마다 진행 중인 곳 수와 가장 많은 단계, 전세 끼고 지금 필요한 돈이 나온 곳 수예요. 구 이름을 누르면 그 구의 모든 구역을 지금 필요한 돈 순으로 볼 수 있어요.' + (' 구 아래 링크는 거래·인가 기록이 넉넉해 따로 읽을 만한 구역이에요.' if any(_PK.values()) else '') + '</p>')
for g in sorted(byg):
    L = byg[g]; stc = collections.Counter(_stage(x) for x in L if _stage(x)); k0 = stc.most_common(1)[0] if stc else None
    ng = sum(1 for x in L if (C.get(x['id']) or {}).get('gapOk')); pick = _PK[g]
    idx.append(f'<h3><a href="../gu/{esc(g)}">{esc(g)}</a> <small class="meta">{len(L)}곳</small></h3><p class="meta">' + (f'{esc(k0[0])} 단계가 {k0[1]}곳으로 가장 많아요. ' if k0 else '') + (f'전세 끼고 지금 필요한 돈이 나온 곳은 {ng}곳이에요. ' if ng else '전세 끼고 지금 필요한 돈이 나온 곳은 아직 없어요. ') + f'<a href="../gu/{esc(g)}">{esc(g)} 구역 {len(L)}곳 전체 보기 →</a></p>' + (f'<div class="grid2">' + ''.join(li(x) for x in pick) + '</div>' if pick else ''))
idx.append(FOOT.format(upd=UPD))
open(os.path.join(ZD, 'index.html'), 'w', encoding='utf-8').write(''.join(idx))
zmap.og_save()
print('zpages made', made, 'hand kept', kept, 'index', len(R))
# 구별 페이지: public/gu/<구>.html (검색 노출용 · 그 구의 진행 중 구역을 필요한 돈과 함께)
GD = os.path.join(ROOT, 'public/gu'); os.makedirs(GD, exist_ok=True)
for f in os.listdir(GD):
    if f.endswith('.html'): os.remove(os.path.join(GD, f))
_GSE = None
def _gu_seoul():
    """구 해설 견주기용 서울 전체 값(한 번만): 관리처분 뒤 비율 · 구당 12개월 거래 가운데 값 · 역 10분 안 비율"""
    global _GSE
    if _GSE is None:
        cg = lambda x: C.get(x['id']) or {}
        late = sum(1 for x in R if _stage(x) in ('관리처분인가', '이주·철거', '착공·분양')) / max(1, len(R))
        per = sorted(sum((x.get('tx') or {}).get('n12') or 0 for x in R if x['g'] == g) for g in {x['g'] for x in R})
        wk = [walk_min(cg(x)['st']['d']) for x in R if (cg(x).get('st') or {}).get('d') is not None]
        _GSE = {'late': late, 'tx': statistics.median(per) if per else 0, 'w10': sum(1 for v in wk if v <= 10) / max(1, len(wk))}
    return _GSE
_UNQ = None
def gu_unique(g, L):
    """28차(애드센스 4차): 그 구에서만 나오는 사실 한 문장 — 자료로만(지어내지 않음).
    ① 토지거래허가로 전세를 안고 살 수 없는 곳이 30% 넘고 3곳 이상이면 그 비율(서울 전체와 견줌)
    ② 아니면 계획 세대수가 가장 많은 구역과 서울 순위 ③ 세대수 자료가 없으면 가장 앞선 단계의 구역"""
    global _UNQ
    tb = lambda x: not (C.get(x['id']) or {}).get('gapOk') and (gapWhy(C.get(x['id']) or {}) or ('',))[0] == '토허제'   # 아래 표 '토허제' 칸과 같은 판정
    if _UNQ is None:
        uu = sorted((_units(x) for x in R if _units(x)), reverse=True)
        _UNQ = {'th': sum(1 for x in R if tb(x)) / max(1, len(R)), 'units': uu}
    N = len(L); nt = sum(1 for x in L if tb(x))
    if nt >= 3 and nt / max(1, N) >= max(0.3, _UNQ['th'] + 0.1):   # 서울 전체보다 10%p 넘게 높을 때만 '이 구의 특징'
        return f"{g} 구역 {N}곳 가운데 {nt}곳({round(nt / N * 100)}%)이 토지거래허가를 받아야 해서 전세를 안고 살 수 없어요. 서울 전체로는 {round(_UNQ['th'] * 100)}%예요."
    U = [(x, _units(x)) for x in L if _units(x)]
    # 29차: 세대수 자료가 있는 곳끼리만 견준다는 걸 문장에 밝히고, 자료 없는 곳 중 면적(구역 면적, 저장소 자료)이 더 큰 곳이 있으면 '가장 많은 곳'이라 하지 않는다(한남3·여의도 시범처럼)
    if U:
        x, u = max(U, key=lambda z: z[1]); rk = _UNQ['units'].index(u) + 1
        ar = lambda y: (y.get('sm') or {}).get('area') or 0
        if not any(not _units(y) and ar(y) > ar(x) for y in L):
            nm = short(x['n'])
            scope = f"{g} 구역 {len(L)}곳 가운데" if len(U) == len(L) else f"{g}에서 계획 세대수 자료가 있는 {len(U)}곳 가운데"
            return f"{scope} 세대수가 가장 많은 곳은 {nm}{ro(nm)} {int(u):,}세대예요" + (f". 서울 진행 구역 {len(_UNQ['units']):,}곳(세대수 자료 있는 곳) 가운데 {rk}번째로 커요." if rk <= max(20, len(_UNQ['units']) // 10) else '.')
    adv = max(L, key=lambda x: x.get('s', 0), default=None)
    # 30차: 같은 단계가 여럿이면(동률) 한 곳만 고르지 않고 모두(4곳 넘으면 앞 3곳 + 외 N곳)
    tie = [x for x in L if adv and x.get('s', 0) == adv.get('s', 0) and _stage(x) == _stage(adv)] if adv else []
    if adv and _stage(adv) and len(tie) > 1:
        nms = [short(x['n']) for x in sorted(tie, key=lambda x: (_sdate(x) or '9999'), reverse=True)]
        lst = '·'.join(nms[:3]) + (f" 외 {len(nms) - 3}곳" if len(nms) > 3 else '')
        return f"{g}에서 가장 앞선 단계는 {_stage(adv)}{josa(_stage(adv), '이고', '고')}, {len(tie)}곳({lst})이 같은 단계예요."
    if adv and _stage(adv):
        nm = short(adv['n']); sd = _sdate(adv)
        return f"{g}에서 가장 앞선 곳은 {_stage(adv)} 단계인 {nm}{josa(nm, '이에요', '예요')}" + (f" ({sd[:7].replace('-', '.')} 인가·고시)." if sd else '.')
    return ''
def dsp(v):   # 30차: 가운데 값은 화면에 보이는 값(ZF.cash 올림)끼리 — 짝수 개면 두 보이는 값의 평균을 다시 같은 규칙(올림)으로(양천 1.9·2.0 → 1.95 → 2억)
    return math.ceil(v * 100 - 1e-6) / 100 if v < 1 else math.ceil(v * 10 - 1e-6) / 10
def gu_note(g, L):
    """26차: 구 페이지 해설(자료로만 만든 3~6문장) — 사업 종류 · 단계 분포 · 계산되는 곳과 서울 견주기 · 보류 이유 · 거래 · 오래 머문 곳 · 역 거리
    27차: ① '전세 끼고' 칸 내역은 아래 표와 같은 갈래(숫자 있음 / 토허제 · 세입자 없음 · 입주권 없음 · 판정 보류 · 대상 아님 · 자료 부족)로 세어 합이 늘 맞게
          ② 앞에 센 곳이 없으면 '나머지' 대신 'N곳 모두' ③ 계산되는 곳이 5곳 미만이면 서울 견주기 문장은 쓰지 않음
          ④ 첫 문장(사업 종류) 다음은 그 구에서 서울과 가장 다른 사실부터(문장 순서가 구마다 다름 · 지어내지 않음)"""
    cg = lambda x: C.get(x['id']) or {}
    okv = LISTED
    med = lambda v: statistics.median(v)   # 28차: 짝수 개면 가운데 두 값의 평균(전엔 위쪽 값 · 동대문 4.7억 vs 실제 3.55억)
    SE = _gu_seoul(); N = len(L)
    out = []; blocks = []   # (서울과 다른 정도, 문장)
    kc = collections.Counter('재건축' if x['k'] in ('재건축',) else '가로·소규모' if x['k'] in ('가로주택(모아주택)', '소규모재건축', '소규모재개발') else '재개발' for x in L)
    out.append(f"{g}에서 진행 중인 정비사업 {N}곳은 모두 {next(iter(kc))}{josa(next(iter(kc)), '이에요', '예요')}." if len(kc) == 1 else f"{g}에서 진행 중인 정비사업 {N}곳은 " + ', '.join(f"{k} {v}곳" for k, v in kc.most_common()) + "이에요.")
    out.append(gu_unique(g, L))   # 28차: 구마다 다른 사실 한 문장(순서만 바꾸지 않게)
    out = [t for t in out if t]
    stc = collections.Counter(_stage(x) for x in L if _stage(x))
    late = sum(v for k, v in stc.items() if k in ('관리처분인가', '이주·철거', '착공·분양'))
    if stc:
        k0, v0 = stc.most_common(1)[0]
        blocks.append((abs(late / max(1, N) - SE['late']) * 3, f"단계로는 {k0}{josa(k0, '이', '가')} {v0}곳으로 가장 많고, 관리처분인가 뒤 이주·착공까지 간 곳은 {late}곳이에요." if late else f"단계로는 {k0}{josa(k0, '이', '가')} {v0}곳으로 가장 많고, 아직 관리처분인가까지 간 곳은 없어요."))
    # 아래 표와 같은 갈래: '지금' 숫자가 있는 줄(gapOk) / 없는 줄은 이유 말(gapWhy) 또는 '자료 부족'
    num = [x for x in L if cg(x).get('gapOk')]
    WHY = {'토허제': '토지거래허가구역', '세입자 없음': '이주·철거로 세입자 없음', '입주권 없음': '입주권 없음', '판정 보류': '입주권 판정 보류', '대상 아님': '계산 대상 아님', '자료 부족': '매수가·전세 자료 부족'}
    rest = collections.Counter((gapWhy(cg(x)) or ('자료 부족',))[0] for x in L if not cg(x).get('gapOk'))
    parts = ', '.join(f"{WHY.get(k, k)} {v}곳" for k, v in sorted(rest.items(), key=lambda z: (-z[1], z[0])))
    ok = [x for x in L if okv(x)]
    allok = [cg(x)['gapNow'] for x in R if okv(x)]
    if not num:
        money = f"{N}곳 모두 전세 끼고 지금 필요한 돈은 아직 계산하지 않았어요: {parts}."
        sc = 0.8
    else:
        money = f"전세 끼고 지금 필요한 돈이 나온 곳은 {len(num)}곳이에요."
        # 30차: 참고값이 섞이면 늘 '참고값을 뺀 N곳'(첫 화면 곳 수에 드는 수)을 밝힌다 — 강동구처럼 5곳 미만이라 견주기 문장이 없을 때도
        if len(ok) != len(num): money += f" 이 중 참고값을 뺀 {len(ok)}곳이 첫 화면 곳 수에 들어가요."
        sc = 0.3
        if len(ok) >= 5 and allok:
            gm, sm = med([dsp(cg(x)['gapNow']) for x in ok]), med([dsp(v) for v in allok])
            cmpw = '보다 많이 들어요' if gm > sm * 1.05 else '보다 적게 들어요' if gm < sm * 0.95 else '과 비슷해요'
            money += (f" 그 {len(ok)}곳의" if len(ok) != len(num) else "") + f" 가운데 값은 {eok(gm)}{ro(eok(gm))}, 서울 전체 가운데 값 {eok(sm)}{cmpw}."
            sc = abs(gm / sm - 1) * 2 if sm else 0.3
        if rest: money += f" 나머지 {sum(rest.values())}곳은 아직 계산하지 않았어요: {parts}."
        if rest.get('토허제', 0) >= max(3, N * 0.3): sc = max(sc, 1.2)
    blocks.append((sc, money))
    tx = [(x, (x.get('tx') or {}).get('n12') or 0) for x in L]
    tn = sum(v for _, v in tx)
    if tn:
        bx = max(tx, key=lambda z: z[1])
        blocks.append((min(1.5, abs(tn - SE['tx']) / max(1, SE['tx'])), f"구역 경계 안에서 최근 12개월 동안 신고된 거래는 모두 {tn:,}건이고, {short(bx[0]['n'])}{josa(short(bx[0]['n']), '이', '가')} {bx[1]:,}건으로 가장 많아요."))
    ys = [(x, _yrs(_sdate(x) or '')) for x in L if not x.get('stale')]
    ys = [(x, y) for x, y in ys if y is not None and y >= 0]
    if ys:
        x, y = max(ys, key=lambda z: z[1])
        if y >= 3: blocks.append((min(1.4, y / 12), f"같은 단계에 가장 오래 머문 곳은 {short(x['n'])}{ro(short(x['n']))}, {_stage(x)} 뒤 {y:.1f}년째예요."))
    wk = [walk_min(cg(x)['st']['d']) for x in L if (cg(x).get('st') or {}).get('d') is not None]
    if len(wk) >= 3:
        n10 = sum(1 for v in wk if v <= 10)
        blocks.append((abs(n10 / len(wk) - SE['w10']) * 2, f"역까지 걸어서 10분 안(직선거리로 추정)인 구역은 {n10}곳으로 {round(n10 / len(wk) * 100)}%예요."))
    blocks.sort(key=lambda z: -z[0])
    out += [t for _, t in blocks]
    return '<h2>' + esc(g) + ' 정비사업 한눈에</h2><p class="gnote">' + esc(' '.join(out)) + '</p>'
def guPage(g, L):
    url = f'{SITE}/gu/{g}'
    c = lambda x: C.get(x['id']) or {}
    ok = [x for x in L if LISTED(x)]   # 참고값(lc)·시장 정비는 '가장 적은 돈' 예시에서 뺀다(사이트 목록과 같음)
    cheap = sorted(ok, key=lambda x: c(x)['gapNow'])[:3]
    st = collections.Counter(c(x).get('stage') or x.get('sr') or '' for x in L)
    title = f'{g} 재개발·재건축 {len(L)}곳 · 진행 단계와 필요한 돈 | {BRAND}'
    desc = f'{g}에서 진행 중인 정비사업 {len(L)}곳. ' + (f'전세를 안고 살 때 지금 드는 돈이 가장 적은 곳은 {short(cheap[0]["n"])}(추정 {eok(c(cheap[0])["gapNow"])}). ' if cheap else '') + f'데이터 기준 {UPD}.'
    gc = next((x.get('c') for x in (GEO.get('gu') or []) if x['n'] == g), None)
    area = {"@type": "AdministrativeArea", "name": f"서울특별시 {g}", "url": url, "address": {"@type": "PostalAddress", "addressCountry": "KR", "addressRegion": "서울특별시", "addressLocality": g}}
    if gc: area["geo"] = {"@type": "GeoCoordinates", "latitude": round(gc[1], 5), "longitude": round(gc[0], 5)}
    ld = json.dumps({"@context": "https://schema.org", "@graph": [{"@type": "CollectionPage", "name": f"{g} 정비사업", "url": url, "inLanguage": "ko", "about": {"@id": url + "#gu"}},
                     crumbs(((BRAND), SITE + "/"), ("자치구별", f"{SITE}/gu/"), (g, url)), {**area, "@id": url + "#gu"}]}, ensure_ascii=False)
    o = [HEAD.format(title=esc(title), desc=esc(desc), url=url, site=SITE, ld=ld).replace(' aria-current="page"', '').replace('<link rel="canonical"', f'<link rel="alternate" type="application/rss+xml" title="{esc(g)} 정비사업 새 소식" href="../feed/gu/{esc(g)}.xml">\n<link rel="canonical"', 1)]
    o.append(f'<p class="eyebrow"><a href="./">구역별 페이지</a> · <a href="../gu/">자치구별</a> · 데이터 기준 {UPD}</p><h1>{esc(g)} 재개발·재건축 {len(L)}곳</h1>')
    top = [(k, v) for k, v in st.most_common() if k][:5]; rest = len(L) - sum(v for _, v in top)   # 단계 합이 머리글 곳 수와 꼭 맞게: 나머지는 '기타'
    o.append('<p class="lede">' + ' · '.join([f'{esc(k)} {v}곳' for k, v in top] + ([f'기타 {rest}곳'] if rest else [])) + '</p>')
    if cheap: o.append('<p>전세를 안고 살 때 지금 드는 돈이 적은 곳(추정): ' + ', '.join(f'<a href="{x["id"]}">{esc(short(x["n"]))}</a> {eok(c(x)["gapNow"])}' for x in cheap) + f'. <a href="../#map-{esc(g)}">지도에서 내 돈으로 보기 →</a></p>')
    def rowkey(x):   # 숫자가 있는 줄 먼저(전세 끼고 지금 적은 순 → 현금만 있는 줄), 숫자 없는 줄은 뒤에 단계순
        v = c(x)
        if LISTED(x): return (0, v['gapNow'], short(x['n']))
        if EXCL(x): return (0.5, v['gapNow'], short(x['n']))   # 29차: 신뢰 낮은 추정은 목록에 든 곳 뒤로(앱 곳 수에서 빠짐)
        if v.get('cashOk') and v.get('need') is not None: return (1, v['need'], short(x['n']))
        return (2, -x.get('s', 0), short(x['n']))
    def tot(x):   # '전세 끼고 지금' 칸과 같은 방식의 입주까지 현금(앱 5.8억 = 갭 총액) · 전세 못 끼면 현금 매수 총액임을 표시
        v = c(x)
        if v.get('gapOk') and v.get('gapTotal') is not None: return eok(v['gapTotal'])
        if v.get('cashOk') and v.get('need') is not None: return f'{eok(v["need"])} <small>대출 끼고</small>'
        return '–'
    def nowT(x):
        v = c(x)
        if v.get('gapOk'): return eok(v.get('gapNow'))
        w = gapWhy(v)
        return None
    def whyT(x):
        w = gapWhy(c(x))
        return (w[0] + ('<sup>*</sup>' if w[0] == '토허제' else '')) if w else '자료 부족'
    # 앱 목록과 같은 줄(밑줄 없는 한 줄 버튼): 왼쪽 이름 16/700 · 단계 칩 / 오른쪽 '지금 X' 위 '입주까지 현금 Y'
    def grow(x):
        nm = short(x["n"]); tt = (' title="' + esc(x["n"].strip()) + '"') if nm != x["n"].strip() else ''
        stg = esc(c(x).get("stage") or x.get("sr") or "")
        return (f'<li class="gr"><a href="{x["id"]}"{tt}><span class="gr-l"><b>{esc(nm)}</b><span class="gr-s">{f"<em>{stg}</em>" if stg else ""}{esc(KIND.get(x["k"], x["k"]))}</span></span>'
                f'<span class="gr-r">{f'<span class="gr-v"><i>지금</i> <b class="gr-now">{nowT(x)}</b></span>' if nowT(x) else f'<span class="gr-v gr-na"><i>전세 끼고</i> <b class="gr-now">{whyT(x)}</b></span>'}{f'<small>입주까지 현금 <b class="gr-tot">{tot(x)}</b></small>' if tot(x) != '–' else '<small class="gr-hold">입주까지 현금 계산 보류</small>'}{'<small class="gr-ex">참고값 · 추정 신뢰 낮아 목록에서 뺐어요</small>' if EXCL(x) else ''}</span></a></li>')
    # 리뉴얼 A2: 분석 글(손글)이 있는 구역 먼저 → 자료가 넉넉해 색인되는 구역 → 자료가 적은 구역(얇은 페이지)은 접어서 아래에 · 각 묶음 안은 예전 순서(필요한 돈 적은 순)
    _hs = zhand.HANDSET or _HID
    gH = [x for x in sorted(L, key=rowkey) if x['id'] in _hs]
    gI = [x for x in sorted(L, key=rowkey) if x['id'] not in _hs and not (THIN.get(x['id']) or {}).get('noindex', True)]
    gT = [x for x in sorted(L, key=rowkey) if x['id'] not in _hs and (THIN.get(x['id']) or {}).get('noindex', True)]
    GCSS = ('<style>.gl{list-style:none;margin:12px 0;padding:0;border:1px solid var(--border);border-radius:16px;background:var(--surface);overflow:hidden}'
            '.gl li+li{border-top:1px solid var(--border)}.gl a{display:flex;align-items:center;gap:12px;min-height:72px;padding:10px 14px 10px 16px;color:var(--text-1);text-decoration:none!important}'
            '.gl a:hover{background:var(--surface-2)}.gr-l{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:5px}.gr-l>b{font-size:16px;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
            '.gr-s{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-3);white-space:nowrap;overflow:hidden}.gr-s em{font-style:normal;flex:none;padding:2px 7px;border-radius:6px;background:var(--surface-2);color:var(--text-2);font-weight:600;font-size:12px}'
            '.gr-r{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:2px;text-align:right}.gr-v i{font-style:normal;font-size:12px;color:var(--text-2)}.gr-v b{font-size:18px;font-weight:800;color:var(--brand,#1f3a87);font-variant-numeric:tabular-nums}'
            '.gr-na b{font-size:13px!important;font-weight:600!important;color:var(--text-2)!important}main p a,.eyebrow a{text-decoration:none!important;color:var(--brand,#1f3a87);font-weight:600}'
            '.gr-r small{font-size:12px;color:var(--text-2)}.gr-r small.gr-ex{color:var(--warn-ink,#8a4b00);font-weight:600}.gr-r small b{font-weight:700;color:var(--text-1)}.gr-r small small{font-size:11px;color:var(--text-3)}</style>')
    o.append(gu_note(g, L))
    o.append(zhand.gu_prose(g, L, globals()))
    GCSS = GCSS.replace('</style>', '.gl-h{margin:22px 0 4px;font-size:16px}.gthin{margin:14px 0}.gthin>summary{cursor:pointer;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2);font-weight:700;font-size:14.5px}.gthin[open]>summary{margin-bottom:4px}</style>')
    _ol = lambda xs, lab: f'<ol class="gl" aria-label="{esc(g)} {lab} · 전세 끼고 지금 필요한 돈 적은 순">' + ''.join(grow(x) for x in xs) + '</ol>'
    o.append(GCSS)
    if gH: o.append(f'<h3 class="gl-h">기사·고시로 대조한 분석 글이 있는 구역 {len(gH)}곳</h3>' + _ol(gH, '분석 글이 있는 구역'))
    if gI: o.append(f'<h3 class="gl-h">{"그 밖에 " if gH else ""}거래·인가 자료가 넉넉한 구역 {len(gI)}곳</h3>' + _ol(gI, '자료가 넉넉한 구역'))
    if gT: o.append(f'<details class="gthin"{"" if gH or gI else " open"}><summary>자료가 적은 구역 {len(gT)}곳 더 보기</summary>' + _ol(gT, '자료가 적은 구역') + '</details>')
    o.append('<p class="meta">입주까지 현금(입주 잔금대출 제외): 전세 끼고 갈 수 있는 곳은 <b>전세 끼고 산 경우</b>(앱 첫 화면과 같은 값), 전세를 낄 수 없는 곳은 <b>대출 끼고</b> 산 금액이에요(앱 ‘대출 끼고’와 같은 값).' + (' <sup>*</sup><b>토허제</b> = 토지거래허가구역. 사면 2년 동안 직접 살아야 해서 전세를 끼고 살 수 없어요.' if any((gapWhy(c(x)) or ('',))[0] == '토허제' for x in L) else '') + '</p>')
    why = collections.Counter(gapWhy(c(x))[0] for x in L if not c(x).get('gapOk') and gapWhy(c(x)))
    EXP = {'토허제': '토지거래허가구역이라 사면 2년 실거주해야 해서 전세를 끼고 살 수 없어요', '세입자 없음': '이주·철거가 시작돼 전세를 낄 세입자가 없어요(입주권으로 사야 해요)',
           '입주권 없음': '지금 사면 입주권이 안 나오는 시점이에요(조합설립인가 등 이후 매수분)', '판정 보류': '입주권이 나오는지 판단할 자료가 부족해요', '대상 아님': '상가·업무 중심 사업 등 아파트 입주권 계산 대상이 아니에요'}
    nd = sum(1 for x in L if not c(x).get('gapOk') and not gapWhy(c(x)))
    if why or nd: o.append('<p class="meta">전세 끼고 칸이 비어 있는 이유: ' + ' · '.join([f'<b>{k}</b>({v}곳) {EXP[k]}' for k, v in why.most_common()] + ([f'<b>자료 부족</b>({nd}곳) 매수가·전세 자료가 부족하거나 같은 구 시세로만 추정한 곳이에요'] if nd else [])) + '.</p>')
    o.append(f'<p class="meta">새 소식 받기: <a href="../feed/gu/{esc(g)}.xml">{esc(g)} RSS</a></p>')
    o.append('<p class="note">무주택·84㎡·시세 상승 0% 같은 기본 가정으로 계산한 추정이에요. 내 조건은 <a href="../">찾기(첫 화면)</a>에서 바꿔 볼 수 있어요. 투자 권유가 아니에요.</p>')
    o.append(FOOT.format(upd=UPD))
    return ''.join(o)
for g in sorted(byg): open(os.path.join(GD, g + '.html'), 'w', encoding='utf-8').write(MONEY(guPage(g, byg[g])))
print('gu pages', len(byg)); zhand.save_cache()
if os.environ.get('ZH_PEEK_GU'):   # 구 해설 쓰는 사람용: 쓸 수 있는 값 미리 보기
    for _g in sorted(byg, key=lambda g: -len(byg[g])): print('ZH_GU', _g, json.dumps(zhand.gu_vals(zhand.Ctx(globals()), _g, byg[_g]), ensure_ascii=False))
# 구 목록 페이지: public/gu/index.html (/gu/ 가 404가 나지 않게)
def gu_compare():
    """25차: 구별 비교 글(자료로만) — 구역 수 · 전세 끼고 지금 필요한 돈이 가장 적은 구 · 단계 분포 · 토지거래허가로 전세를 못 끼는 곳"""
    cg = lambda x: C.get(x['id']) or {}
    okv = LISTED
    cnt = sorted(((g, len(L)) for g, L in byg.items()), key=lambda z: (-z[1], z[0]))
    med = lambda v: statistics.median(v)
    gm = sorted(((g, med([dsp(cg(x)['gapNow']) for x in L if okv(x)]), sum(1 for x in L if okv(x))) for g, L in byg.items() if sum(1 for x in L if okv(x)) >= 3), key=lambda z: z[1])
    allok = [x for x in R if okv(x)]
    stc = collections.Counter(_stage(x) for x in R if _stage(x))
    early = sum(v for k, v in stc.items() if k in ('정비계획 수립', '정비구역 지정', '추진위원회 승인', '주민합의체·준비위원회'))
    late = sum(v for k, v in stc.items() if k in ('관리처분인가', '이주·철거', '착공·분양'))
    th = collections.Counter(x['g'] for x in R if str(cg(x).get('gapBlock') or '').startswith('전세 낀 매수 불가'))
    def lead(stage):   # 그 단계 구역이 가장 많은 구
        c = collections.Counter(x['g'] for x in R if _stage(x) == stage)
        return c.most_common(1)[0] if c else None
    P_ = []
    P_.append(f"서울에서 진행 중인 정비사업 {len(R):,}곳 가운데 {cnt[0][0]}가 {cnt[0][1]}곳으로 가장 많고, {cnt[1][0]} {cnt[1][1]}곳, {cnt[2][0]} {cnt[2][1]}곳이 뒤를 이어요. "
              f"가장 적은 곳은 {cnt[-1][0]}({cnt[-1][1]}곳)와 {cnt[-2][0]}({cnt[-2][1]}곳)예요. 위 세 구만 합쳐도 서울 전체의 {round((cnt[0][1] + cnt[1][1] + cnt[2][1]) / len(R) * 100)}%예요."
              if len(cnt) >= 5 else '')
    if gm:
        n15 = sum(1 for x in allok if cg(x)['gapNow'] <= 15 + 1e-9)   # 29차: 첫 화면 막대 끝(15억+)이 세는 곳과 같은 기준을 밝힌다
        P_.append(f"전세 끼고 지금 필요한 돈이 계산되는 곳은 서울 전체에 {len(allok):,}곳이에요(가운데 값 {eok(med([dsp(cg(x)['gapNow']) for x in allok]))}" + (f" · 15억 안쪽은 {n15:,}곳으로 첫 화면 ‘15억+’의 곳 수와 같아요" if n15 != len(allok) else "") + f"). 신뢰가 낮은 참고값은 넣지 않았어요. 이런 곳이 3곳 이상인 구만 놓고 구별 가운데 값을 비교하면 "
                  + ', '.join(f"{g} {eok(v)}({n}곳)" for g, v, n in gm[:3]) + "이 가장 적게 들고, "
                  + ', '.join(f"{g} {eok(v)}" for g, v, n in gm[-2:][::-1]) + "이 가장 많이 들어요. 같은 구 안에서도 구역마다 몇 배씩 차이가 나니 구 이름보다 구역별 숫자를 먼저 보는 게 좋아요.")
    if stc:
        top = stc.most_common(3)
        P_.append(f"단계로 나누면 {top[0][0]} {top[0][1]}곳, {top[1][0]} {top[1][1]}곳, {top[2][0]} {top[2][1]}곳 순으로 많아요. "
                  f"조합을 만들기 전 초기 단계(정비계획 수립·구역 지정·추진위원회 승인 등)가 {early:,}곳으로 전체의 {round(early / len(R) * 100)}%이고, 관리처분인가 이후 이주·착공까지 간 곳은 {late:,}곳이에요."
                  + (lambda a, b: f" 관리처분인가 구역은 {a[0]}({a[1]}곳)에, 착공·분양 구역은 {b[0]}({b[1]}곳)에 가장 많아요." if a and b else '')(lead('관리처분인가'), lead('착공·분양')))
    if th:
        t3 = th.most_common(3)
        P_.append(f"토지거래허가 때문에 전세를 끼고 살 수 없는 곳은 {sum(th.values()):,}곳이고, " + ', '.join(f"{g} {n}곳" for g, n in t3) + " 순으로 많아요. 이런 구는 목록의 ‘전세 끼고’ 칸이 비어 보이는데, 자료가 없어서가 아니라 사면 2년 동안 직접 살아야 하기 때문이에요.")
    tt = [x for x in allok if cg(x).get('gapTotal') is not None]
    if len(tt) >= 10:
        tg = sorted(((g, med([dsp(cg(x)['gapTotal']) for x in tt if x['g'] == g]), sum(1 for x in tt if x['g'] == g)) for g in byg if sum(1 for x in tt if x['g'] == g) >= 3), key=lambda z: z[1])
        P_.append(f"계약할 때 드는 돈과 입주할 때까지 드는 돈은 달라요. 전세 끼고 산 뒤 입주까지 들어가는 현금(입주 잔금대출 제외)이 계산되는 {len(tt):,}곳의 가운데 값은 {eok(med([dsp(cg(x)['gapTotal']) for x in tt]))}이에요."
                  + (f" 구별로는 {tg[0][0]}가 {eok(tg[0][1])}{ro(eok(tg[0][1]))} 가장 적고 {tg[-1][0]}가 {eok(tg[-1][1])}{ro(eok(tg[-1][1]))} 가장 많아요." if len(tg) >= 2 else ''))
    kc = collections.Counter(KIND.get(x['k'], x['k']) for x in R)
    rb = sorted(((g, sum(1 for x in L if x['k'] in ('재건축', '소규모재건축')), len(L)) for g, L in byg.items() if len(L) >= 10), key=lambda z: -z[1] / z[2])
    if kc and rb:
        P_.append(f"사업 종류로는 재개발 {kc.get('재개발', 0):,}곳, 재건축 {kc.get('재건축', 0):,}곳, 가로주택정비 {kc.get('가로주택정비', 0):,}곳, 소규모재건축 {kc.get('소규모재건축', 0):,}곳, 도시정비형 재개발 {kc.get('도시정비형 재개발', 0):,}곳이에요. "
                  f"구역이 10곳 넘는 구 가운데 재건축(소규모 포함) 비중은 {rb[0][0]}가 {round(rb[0][1] / rb[0][2] * 100)}%로 가장 높고, {rb[-1][0]}는 {round(rb[-1][1] / rb[-1][2] * 100)}%로 가장 낮아요." + (lambda a, b: f" 전세 끼고 지금 필요한 돈의 가운데 값은 재개발 {eok(med(a))}({len(a)}곳), 재건축 {eok(med(b))}({len(b)}곳)이에요." if len(a) >= 5 and len(b) >= 5 else '')([cg(x)['gapNow'] for x in allok if x['k'] in ('재개발', '도시정비형 재개발')], [cg(x)['gapNow'] for x in allok if x['k'] == '재건축']))
    wk = lambda x: (cg(x).get('st') or {}).get('d')
    wg = sorted(((g, sum(1 for x in L if wk(x) is not None and wk(x) * 1.3 / 67 <= 10), len(L)) for g, L in byg.items() if len(L) >= 10), key=lambda z: -z[1] / z[2])
    if wg:
        P_.append(f"역까지 걸어서 10분 안(직선거리 기준 추정)인 구역 비율은 {wg[0][0]}가 {round(wg[0][1] / wg[0][2] * 100)}%로 가장 높고, {wg[-1][0]}는 {round(wg[-1][1] / wg[-1][2] * 100)}%로 가장 낮아요. 출퇴근이 중요하다면 구 목록에서 역 거리도 함께 보세요.")
    P_ = [p for p in P_ if p]
    return '<h2>구별로 견주어 보면</h2>' + ''.join(f'<p>{esc(p)}</p>' for p in P_) + f'<p class="meta">숫자는 {UPD} 자료와 기본 가정(무주택·84㎡·전세 끼고)으로 낸 추정이에요. 구를 누르면 구역별 숫자를 볼 수 있어요. 참고값을 빼는 기준은 <a href="../method#exclude">계산 방법</a>에 있어요.</p>'
def guIndex():
    url = f'{SITE}/gu/'
    ld = json.dumps({"@context": "https://schema.org", "@graph": [{"@type": "CollectionPage", "name": "서울 자치구별 정비사업", "url": url, "inLanguage": "ko",
                     "mainEntity": {"@type": "ItemList", "numberOfItems": len(byg), "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": g, "url": f"{SITE}/gu/{g}"} for i, g in enumerate(sorted(byg))]}},
                     crumbs(((BRAND), SITE + "/"), ("자치구별", url))]}, ensure_ascii=False)
    title = f'서울 자치구별 재개발·재건축 {len(byg)}개 구 | {BRAND}'
    desc = f'서울 {len(byg)}개 자치구의 진행 중 정비사업 {len(R)}곳을 구별로 모았어요. 구를 누르면 구역마다 진행 단계와 필요한 돈을 볼 수 있어요. 데이터 기준 {UPD}.'
    o = [HEAD.format(title=esc(title), desc=esc(desc), url=url, site=SITE, ld=ld).replace('<meta name="emr-auto" content="1">\n', '').replace(' aria-current="page"', '').replace('<base href="/z/">', '<base href="/gu/">')]
    o.append(f'<p class="eyebrow">자치구별 페이지 · 데이터 기준 {UPD}</p><h1>서울 자치구별 재개발·재건축</h1><p class="lede">서울에서 진행 중인 정비사업 {len(R)}곳을 {len(byg)}개 구로 나눴어요. 구를 고르면 그 구의 구역을 전세 끼고 지금 필요한 돈 순으로 볼 수 있어요.</p>')
    o.append(CNT_NOTE)
    o.append(gu_compare())
    def card(g):
        L = byg[g]; ok = [C.get(x['id'], {}).get('gapNow') for x in L if LISTED(x)]
        sub = f"{len(L)}곳" + (f" · 전세 끼고 최소 {eok(min(ok))}" if ok else '')
        return f'<a class="zl" href="{esc(g)}">{esc(g)}<small>{sub}</small></a>'
    o.append('<div class="grid2">' + ''.join(card(g) for g in sorted(byg)) + '</div>')
    o.append('<p class="meta"><a href="../z/">구역별 페이지 전체</a> · <a href="../">찾기에서 내 돈으로 보기</a></p>')
    o.append(FOOT.format(upd=UPD))
    return ''.join(o).replace('href="../gu/', 'href="')
open(os.path.join(GD, 'index.html'), 'w', encoding='utf-8').write(guIndex())
print('gu index', len(byg))
# 손으로 쓴 소개·기간 페이지의 '데이터 기준' 날짜를 앱과 같은 갱신일로 맞춘다(예전엔 2026.09.26에 멈춰 있었다)
for fn, pats in (('years.html', [(r'(<p class="eyebrow">데이터 기준 )[\d.]+(</p>)', r'\g<1>' + UPD + r'\2')]),
                 ('about.html', [(r'(지금 기준일은 )[\d.]+(이에요)', r'\g<1>' + UPD + r'\2')])):
    fp = os.path.join(ROOT, 'public', fn)
    if not os.path.exists(fp): continue
    h0 = open(fp, encoding='utf-8').read(); h1 = h0
    for a, b in pats: h1 = re.sub(a, b, h1)
    if h1 != h0: open(fp, 'w', encoding='utf-8').write(h1); print('date synced', fn, UPD)

# 손으로 쓴 정적 글(소개·방법·가이드·리포트·피드 목록): 용어 정식화 + 푸터 데이터 기준 날짜(term_fix) — 글 본문 숫자는 그대로
import glob
for fp in sorted(set(glob.glob(os.path.join(ROOT, 'public', '*.html')) + glob.glob(os.path.join(ROOT, 'public', 'guide', '*.html')) + glob.glob(os.path.join(ROOT, 'public', 'api', '*.html')) + glob.glob(os.path.join(ROOT, 'public', 'report', '*.html')) + glob.glob(os.path.join(ROOT, 'public', 'feed', '*.html')))):
    if os.path.basename(fp) == 'index.html' and os.path.dirname(fp) == os.path.join(ROOT, 'public'): continue   # 앱 첫 화면은 build.py
    h0 = open(fp, encoding='utf-8').read(); h1 = term_fix(h0)
    if '/feed/' not in fp: h1 = static_norm(h1)   # 머리 검색·theme-color·정보몽땅 첫 언급(피드 목록은 feeds.py 몫)
    if h1 != h0: open(fp, 'w', encoding='utf-8').write(h1); print('terms/date synced', os.path.relpath(fp, ROOT))

# /report·/years 구조화 데이터(JSON-LD): 다른 도구(report.py·feeds.py)가 이 페이지의 <head>를 틀로 베끼므로 <main> 바로 안에 한 덩이만 넣고 매번 바꿔 끼운다
def _ld_put(fp, obj):
    if not os.path.exists(fp): return
    h0 = open(fp, encoding='utf-8').read()
    tag = '<script type="application/ld+json" id="zp-ld">' + json.dumps(obj, ensure_ascii=False).replace('</', '<\\/') + '</script>'
    h1 = re.sub(r'<script type="application/ld\+json" id="zp-ld">.*?</script>', lambda m: tag, h0, flags=re.S) if 'id="zp-ld"' in h0 else h0.replace('<main>', '<main>' + tag, 1)
    if h1 != h0: open(fp, 'w', encoding='utf-8').write(h1); print('json-ld', os.path.relpath(fp, ROOT))
def _meta(h, name):
    m = re.search(r'<title>(.*?)</title>', h, re.S) if name == 'title' else re.search(r'<meta name="description" content="([^"]*)"', h)
    return html.unescape(m.group(1)).strip() if m else ''
_pub = {"@type": "Organization", "name": (BRAND), "url": SITE, "logo": f"{SITE}/icon-512.png"}
RD = os.path.join(ROOT, 'public/report')
if os.path.isdir(RD):
    iss = sorted((f for f in os.listdir(RD) if re.match(r'\d{4}-\d{2}\.html$', f)), reverse=True)
    for f in iss:
        h = open(os.path.join(RD, f), encoding='utf-8').read(); ym = f[:7]
        h1m = re.search(r'<h1[^>]*>(.*?)</h1>', h, re.S)
        # 발행일 = 머리글 '발행 YYYY년 M월 D일'(예전엔 해당 월 1일을 넣어 머리의 Article과 날짜가 달랐다) · 머리에 따로 있던 Article 구조화 데이터는 이 한 덩이로 합친다
        pm = re.search(r'발행 (\d{4})년 (\d{1,2})월 (\d{1,2})일', h)
        pubd = f"{pm.group(1)}-{int(pm.group(2)):02d}-{int(pm.group(3)):02d}" if pm else ym + "-01"
        gm = re.search(r'갱신 (\d{4})년 (\d{1,2})월 (\d{1,2})일', h)   # 부분 호를 다음 달 전체 자료로 다시 쓴 날(tools/report.py)
        modd = f"{gm.group(1)}-{int(gm.group(2)):02d}-{int(gm.group(3)):02d}" if gm else pubd
        hd0 = h[:h.find('<body')]
        hd1 = re.sub(r'<script type="application/ld\+json">\{[^<]*?"@type": ?"Article"[^<]*?</script>\n?', '', hd0)
        if hd1 != hd0: open(os.path.join(RD, f), 'w', encoding='utf-8').write(hd1 + h[len(hd0):])
        _ld_put(os.path.join(RD, f), {"@context": "https://schema.org", "@type": "Article", "headline": re.sub(r'<[^>]+>', '', h1m.group(1)).strip()[:110] if h1m else _meta(h, 'title'),
                 "description": _meta(h, 'desc'), "inLanguage": "ko", "datePublished": pubd, "dateModified": modd, "url": f"{SITE}/report/{ym}", "mainEntityOfPage": f"{SITE}/report/{ym}",
                 "image": f"{SITE}/og.png", "author": {"@type": "Organization", "name": (BRAND + " 편집"), "url": f"{SITE}/about#principles"}, "publisher": _pub})
    ix = os.path.join(RD, 'index.html')
    if os.path.exists(ix):
        h = open(ix, encoding='utf-8').read()
        _ld_put(ix, {"@context": "https://schema.org", "@type": "CollectionPage", "name": _meta(h, 'title'), "description": _meta(h, 'desc'), "url": f"{SITE}/report/", "inLanguage": "ko", "publisher": _pub,
                     "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{SITE}/report/{f[:7]}"} for i, f in enumerate(iss)]}})
YF = os.path.join(ROOT, 'public/years.html')
if os.path.exists(YF):
    h = open(YF, encoding='utf-8').read()
    _ld_put(YF, {"@context": "https://schema.org", "@type": "Article", "headline": _meta(h, 'title').split(' | ')[0], "description": _meta(h, 'desc'), "inLanguage": "ko",
                 "dateModified": UPD.replace('.', '-'), "url": f"{SITE}/years", "mainEntityOfPage": f"{SITE}/years", "image": f"{SITE}/og.png",
                 "author": {"@type": "Organization", "name": (BRAND + " 편집"), "url": f"{SITE}/about#principles"}, "publisher": _pub})
# 26차(애드센스 2차): /report/ 목록에 지난 호들을 이어 읽는 해설(issues.json 숫자로만) — report.py가 목록을 다시 써도 매일 다시 끼운다
_IJ = J('pipeline/report/issues.json', []) or []
_IX = os.path.join(ROOT, 'public/report/index.html')
if _IJ and os.path.exists(_IX):
    _iss = sorted([x for x in _IJ if not x.get('draft')], key=lambda x: x['ym'])
    _full = [x for x in _iss if not x.get('partial')]
    if len(_iss) >= 2:
        _mo = lambda x: f"{int(x['ym'][5:7])}월"
        _tn, _tok = sum(x.get('n', 0) for x in _full), sum(x.get('ok', 0) for x in _full)
        _hi = max(_full, key=lambda x: x.get('n', 0)) if _full else None; _lo = min(_full, key=lambda x: x.get('n', 0)) if _full else None
        _p = []
        if _full:
            _p.append(f"달 전체 자료로 낸 {len(_full)}개 호({', '.join(_mo(x) for x in _full)})를 합치면 단계가 바뀐 인가는 모두 {_tn}건, 한 달에 평균 {_tn / len(_full):.1f}건이고, 그중 {_tok}건({(lambda v: f'{v:.1f}'.rstrip('0').rstrip('.'))(_tok / max(1, _tn) * 100)}%)은 기사나 구청·서울시 고시로 날짜까지 맞춰 봤어요."
                      + (f" 가장 많았던 달은 {_mo(_hi)}({_hi['n']}건), 가장 적었던 달은 {_mo(_lo)}({_lo['n']}건)이에요." if _hi and _lo and _hi is not _lo else ''))
        _pt = [x for x in _iss if x.get('partial')]
        for x in _pt:
            _p.append(f"{_mo(x)}호는 {x['asof'][5:7].lstrip('0')}월 {x['asof'][8:10].lstrip('0')}일까지 올라온 자료로 먼저 냈어요. 지금까지 확인한 인가는 {x.get('n', 0)}건(원문 확인 {x.get('ok', 0)}건)이고, 다음 달 초 그달 전체 자료로 같은 주소에서 다시 써요. 그때 늦게 올라온 인가가 더해지면 숫자가 늘 수 있어요.")
        # 30차: 지난 호 숫자는 그 호를 낸 날 기준 — 늦게 올라온 인가는 다음 호에 따로(합계에 넣지 않음)
        for x in [x for x in _full if x.get('late')]: _p.append(f"{_mo(x)}호 숫자({x.get('n', 0)}건)를 낸 뒤 정보몽땅에 {_mo(x)} 날짜로 늦게 올라온 인가 {x['late']}건은 그 호 숫자와 위 합계에 넣지 않고 다음 호에 따로 실었어요.")
        if _full:
            _p.append("호마다 원문과 맞춘 비율은 " + ', '.join(f"{x['no']}호({_mo(x)}) {x.get('n', 0)}건 중 {x.get('ok', 0)}건" for x in _full) + "이에요. 원문을 못 찾은 건도 지우지 않고 '원문 미확인'으로 표시해 두고, 나중에 찾으면 그 호에 링크를 붙여요.")
        _p.append("리포트의 금액(1억·2억·3억으로 갈 수 있는 곳 수 등)은 그 호를 낸 날의 자료와 기본 가정(무주택·84㎡)으로 셌어요. 지난 호에 적힌 곳 수는 그 호를 낸 날 숫자라서, 지금 숫자는 찾기 화면에서 보는 게 정확해요.")
        _p.append("인가 건수는 서울 전체 사업 속도를 보는 숫자라 한 달만 보고 판단하기는 어려워요. 같은 구역이 몇 달 사이에 추진위원회 승인에서 조합설립인가로 넘어가는 식으로 이어지는 경우가 많으니, 관심 있는 구역은 호를 건너뛰지 말고 이어서 보세요. 10월호부터는 끝에 다음 달에 볼 일정도 적어 두었어요.")
        _blk = '<!--rpx--><h2>지난 호를 이어 보면</h2>' + ''.join(f'<p>{esc(x)}</p>' for x in _p) + '<!--/rpx-->'
        _h0 = open(_IX, encoding='utf-8').read()
        if '<!--rpx-->' in _h0: _h1 = re.sub(r'<!--rpx-->.*?<!--/rpx-->', lambda m: _blk, _h0, count=1, flags=re.S)
        else: _h1 = _h0.replace('<h2>리포트를 만드는 방법</h2>', _blk + '<h2>리포트를 만드는 방법</h2>', 1)
        if _h1 != _h0: open(_IX, 'w', encoding='utf-8').write(_h1); print('report index prose')
