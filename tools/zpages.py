#!/usr/bin/env python3
"""구역별 정적 페이지 자동 생성(검색 노출용) → public/z/<id>.html, public/z/index.html
- 기사·고시를 대조해 손으로 쓴 페이지(emr-auto 표시 없음)는 건드리지 않는다.
- 입력: pipeline/data.enriched.json, public/premium.json, pipeline/calc.json(계산 엔진 결과), public/data/sang.json
- 숫자는 화면 계산기와 같은 엔진(calc.json)에서만 가져온다. 없으면 싣지 않는다.
"""
import json, os, re, html, math, datetime, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p, d=None: json.load(open(os.path.join(ROOT, p), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, p)) else d
D = J('pipeline/data.enriched.json') or J('src/data.json'); TH = J('public/data/toheo.json', {}) or {}; P = J('public/premium.json', {}); C = J('pipeline/calc.json', {}); S = J('public/data/sang.json')
ZD = os.path.join(ROOT, 'public/z'); SITE = 'https://jaegaebal.alwaysquestions.kr'
esc = lambda s: html.escape(str(s if s is not None else ''), quote=True)
UPD = (D.get('upd') or datetime.date.today().isoformat()).replace('-', '.')
TXD = (D.get('txAsOf') or {}).get('sale', '')
AUC = J('public/data/auction.json', {}) or {}   # 법원경매 물건(구역별 · tools/auction_match.py)
AUT = (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')
TXX = J('public/data/tx.json', {}) or {}   # 구역별 실거래 상세: x.hd = 화면 머리글과 같은 기준(tools/tx.py)
GEO = J('public/data/geo.json', {}) or {}   # 앱 지도와 같은 정비구역·구 경계(작은 지도 그림용)
GUG = {x['n']: x['r'] for x in (GEO.get('gu') or [])}
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import zmap   # 구역 위치 지도(SVG)·공유 카드(OG PNG) — tools/zmap.py
OG_OK = zmap.og_ok()
# 돈 꼴: 숫자 뒤 '만원·억원' → '만·억'(앱 ZF와 같은 꼴 · '476만' '6,920만') — 글 속(자료 원문 인용 포함) 화면 글자에만, 태그 속성은 그대로
import re as _re
def MONEY(h):
    return _re.sub(r'>([^<]*)<', lambda m: '>' + _re.sub(r'(\d)(만|억)원', r'\1\2', m.group(1)) + '<', h)

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
def ztitle_s(r): return f"{zt(r)[0]} | 단계·실거래·입주 현금 | 집핀"
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
from zsample import manT, smpTxt, trust, short, headline, noTicket, LBL, josa, auc_use, auc_uses, auc_jb, auc_amt, key3, set_dup
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
HEAD = '''<!doctype html>
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
<meta property="og:site_name" content="집핀"><meta property="og:title" content="{title}">
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
<script type="application/ld+json">{ld}</script>
</head>
<body>
<header class="top"><div class="in"><a class="logo" href="/" aria-label="집핀 처음으로"><img class="logo-i" src="/icon-small.svg" width="28" height="28" alt=""><span class="logo-t">집핀</span><span class="logo-en" lang="en">Zippin</span><small class="logo-s">서울 재개발 지도</small></a><nav aria-label="사이트 메뉴"><a href="../">계산기</a><a href="../report/">월간 리포트</a><a href="../z/" aria-current="page">구역별 페이지</a><a href="../guide/">가이드·분석</a></nav><form class="tsr" action="/" method="get" role="search"><label class="sr-only" for="tq">구역 검색</label><input id="tq" name="q" type="search" placeholder="구역·동·역 검색" autocomplete="off" enterkeyhint="search" maxlength="40"></form></div></header>
<main>
'''
FOOT = '''</main>
<footer class="f"><p><a href="../report/">월간 리포트</a> · <a href="../z/">구역별 페이지</a> · <a href="../guide/">가이드·분석</a> · <a href="../years">몇 년 걸리나</a> · <a href="../about">소개</a> · <a href="../contact">문의하기</a> · <a href="../method">출처·계산 방법</a> · <a href="../terms">이용약관</a> · <a href="../privacy"><b>개인정보처리방침</b></a> · <a href="https://blog.naver.com/always_questions" rel="noopener">블로그</a></p><p class="f-c">© 2026 집핀 · 데이터 기준 {upd}</p></footer>
<script>/* 오프라인에서도 다시 열 수 있게: 서비스 워커를 붙이고 이 페이지를 저장해 달라고 알린다 */if("serviceWorker"in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))addEventListener("load",function(){{navigator.serviceWorker.register("/sw.js",{{scope:"/"}}).then(function(){{return navigator.serviceWorker.ready}}).then(function(r){{r.active&&r.active.postMessage({{t:"keep",u:[location.pathname]}})}}).catch(function(){{}})}});</script>
</body>
</html>
'''
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
    tc, tt, lv, cls = k['trust'] or ('', '', '', '')
    thref = '#trust' if cls != 'na' else f'../#{rid}'
    return (f'<section class="zk" aria-label="핵심 숫자"><p class="zk-nl"><b>{esc(short(r["n"]))}</b><span>{esc(r["g"])} {esc(dong_of(r))}</span><span class="zk-st">{esc(stage)}</span></p><div class="zk-k">'
            f'<div class="zk-i"><span class="zk-l">지금 필요한 돈</span><b class="zk-v">{k["now"]}</b><span class="zk-s">{esc(k["basis"])}</span>' + (f'<span class="zk-s zk-alt">{esc(k["alt"])}</span>' if k['alt'] else '') + f'<a class="zk-my" href="../#{rid}">내 돈으로 되는지 보기 ›</a></div>'
            f'<div class="zk-i"><span class="zk-l">{LBL["cashToMoveIn"]}</span><b class="zk-v">{k["tot"]}</b><span class="zk-s">{esc(k["tsub"] or "기본 가정 · 전세 끼고 · 입주 잔금대출 뺀 값")}</span></div>'
            f'<div class="zk-i"><span class="zk-l">{esc(k.get("elab") or "언제 입주")}</span><b class="zk-v zk-eta">{esc(k["eta"])}</b>{ip}' + (f'<span class="zk-s">{esc(k["esub"])}</span>' if k.get('esub') else '') + '</div></div>' +
            (f'<p class="zk-cap">최신 숫자 · 기본 가정 · 데이터 기준 {UPD}</p>' if cap else '') + (f'<a class="zk-tr {cls}" href="{thref}"><span class="zk-tc">{esc(tc)}</span><span class="zk-tt">{esc(tt)}{f"<b>{esc(lv)}</b>" if lv else ""}</span><i aria-hidden="true">›</i></a>' if k['trust'] else '') + '</section>')
REPORT_P = lambda r: f'<p class="zk-rep"><a class="zk-rb" href="{report_href(r)}" data-zp-contact data-kind="error" data-zone="{esc(r["id"])}" data-asof="{UPD}" data-title="이 숫자가 틀렸어요" data-meta="{esc(short(r["n"]))} · 구역 ID {esc(r["id"])} · {UPD} 기준">이 숫자가 틀렸어요</a><span>구역 ID {esc(r["id"])}가 문의에 자동으로 들어가요 · 운영자가 직접 읽어요</span></p><script src="/cf.js" defer></script>'
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
           "mainEntityOfPage": url, "author": {"@type": "Person", "name": "집핀 운영자", "url": f"{SITE}/about"}, "publisher": {"@type": "Organization", "name": "집핀", "url": SITE}}
    o = [HEAD.format(title=esc(title), desc=esc(desc), url=url, site=SITE, ld='@@LD@@').replace('<link rel="canonical"', f'<link rel="alternate" type="application/rss+xml" title="{esc(nmk)} 소식" href="../feed/z/{rid}.xml">\n<link rel="canonical"', 1)]
    o.append(f'<p class="eyebrow">{esc(r["g"])} {esc(r.get("j") or r.get("dg") or "")} · {esc(kind)} · 데이터 기준 {UPD}</p>')
    o.append(f'<h1>{esc(nmk)} 진행 단계와 입주까지 현금</h1>')
    if r['n'].strip() != nm: o.append(f'<p class="formal">정식 이름 {esc(r["n"].strip())}</p>')   # 제목은 앱과 같은 짧은 이름, 정식 이름은 한 줄 아래
    o.append(key3_html(r, c, dt))   # 첫 화면: 앱 상세와 같은 3숫자(지금 필요한 돈 · 입주까지 현금 · 언제 입주/입주권) + 신뢰 한 줄
    # 현재 단계의 인가·고시일만 쓴다(예전엔 기록 중 가장 늦은 날짜를 써서 '착공' 구역에 관리처분일이 붙었다 · o747)
    sk = SKEY.get(r.get('s', 0)) or ()
    sd = next((dt[k] for k in sk if dt.get(k)), '')[:7].replace('-', '.')
    prevd = next(((lab, dt[k]) for k, lab in reversed(DTK) if dt.get(k) and k not in sk), None) if not sd else None
    lede = f"{esc(nm)}{josa(nm)} 지금 <b>{esc(stage)}</b> 단계예요" + (f" ({sd} 인가·고시)." if sd else ".")
    stl = r.get('stale')
    if stl: lede += f" 다만 {esc(stl['why'])}. 준공됐는지 멈췄는지 자료로 확인되지 않아 준공 가능성과 입주 시점은 싣지 않았어요."
    elif c.get('p10') is not None: lede += f" 서울 사업장 기록으로 낸 10년 안 준공 가능성은 {'1% 미만이' if c['p10'] < 0.01 else f"약 {min(97, round(c['p10'] * 100))}%"}예요(예측이 아닌 통계)."
    o.append(f'<p class="lede">{lede} 아래 숫자는 무주택·84㎡ 기본 가정이고, 첫 화면과 같은 <b>전세 끼고 사는</b> 기준이에요. 내 조건은 <a href="../#{rid}">입주 계산에서 열기</a>로 바꿔 볼 수 있어요.</p>')
    k = []
    k.append(('현재 단계', esc(stage), f'{sd} 인가·고시' if sd else ('진행 확인 필요' if stl else '아직 구역지정 전이라 인가일이 없어요' if r.get('s', 0) <= 1 else f'이 단계 인가일 기록 없음 · 직전 {prevd[0]} {prevd[1][:7].replace("-", ".")}' if prevd else '이 단계 인가일 기록 없음')))
    if c.get('gapOk') and c.get('gapTotal') is not None:   # 첫 화면 기본 모드(전세 끼고)와 같은 숫자
        k.append((f"{LBL['gap']} {LBL['cashToMoveIn']}", eok(c['gapTotal']), f'지금 {eok(c.get("gapNow"))} · 매수가 {manT(c["price"]) if c.get("price") is not None else "–"} = {esc(smpTxt(r, c))}' + (f' · 현금으로 사면 {eok(c["need"])}' if c.get('cashOk') and c.get('need') is not None else '')))
    elif c.get('need') is not None and r.get('tag') != 'mk' and r.get('nx') != 'mk': k.append((f"현금 매수 · {LBL['cashToMoveIn']}", eok(c['need']), f'기본 가정 · 매수가 {eok(c.get("price"))} 기준' + (f' · 전세 끼고는 {esc(gapWhy(c)[1])}' if gapWhy(c) else '')))
    elif c.get('winT'):   # 23차: 착공 뒤 입주권 거래가 있으면 머리 칸('조합원 입주권을 사야 해요')과 같은 말 — '입주권 없음'과 부딪치지 않게
        _t = r.get('tx') or {}
        k.append(('입주권', '조합원 입주권 매매로', '지금 사는 집은 입주권 없음 · 기본 가정 판정') if c['winT'] == '입주권 없음' and r.get('s', 0) >= 8 and _t.get('im') else ('입주권', esc(c['winT']), '기본 가정 판정'))
    if c.get('st'): k.append(('가까운 역', f"{esc(c['st']['n'])} 도보 {max(1, round(c['st']['d'] * 1.3 / 67))}분", ' · '.join(esc(x) for x in (c.get('ln') or [])[:3])))
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
                per = f"거래 1건({to[2:4]}.{to[4:6]})" if one else f"최근 {hd['w']}개월 대표 거래 {hd['n']}건({f[2:4]}.{f[4:6]}–{to[2:4]}.{to[4:6]})"
                return (lab, man(hd['u']), pre + ('' if one else '가운데 값 · ') + f"{what} · {per}" + (f" · 시세와 크게 다른 {hd['xo']}건 제외" if hd.get('xo') else ''))
            if t.get('pp'):
                nv = t.get('nv', t.get('n', 0))
                return (lab, man(t['pp']), pre + ('' if nv == 1 else '가운데 값 · ') + f"빌라·단독 매매 {nv}건 · 2024년~")
            return None
        trow = None
        if c.get('price') is not None and c.get('priceSrc') in PSRC and not noTicket(r, c):   # '이 숫자 믿어도 될까' — 매수가와 같은 표본 n건 · 입주권 없는 구역은 계산 안 함(화면과 같게)
            lv, why = trust(r, c)
            trow = ('이 숫자 믿어도 될까', lv, ' · '.join([x for x in (f"매수가 표본 {en['n']}건" if en.get('n') else '', f"마지막 거래 {en['last']}" if en.get('last') else '') if x] + why))
        buy = ('계산 매수가', manT(c['price']), f"= {esc(smpTxt(r, c))}" + (f" · 전용 {en['area_med']:g}㎡ 안팎" if en.get('area_med') else '') + (f" · {esc(en['scope'])}" if en.get('scope') else '')) if trow else None
        if H and H['kind'] == 'u':   # 대지 3.3㎡당 = 매수가 표본 그대로
            rows.append(('대지 3.3㎡당', man(H['v']), esc(H['basis'])))
            if hd and abs(hd['u'] - H['v']) >= 1: rows.append(zone_row('참고 · 구역 대표 거래', '매수가 표본과 다른 묶음 · 대지 3.3㎡당 · '))   # 화면 '다른 기준 보기'처럼 참고 줄로(큰 숫자와 헷갈리지 않게)
            rows += [buy, trow]
        elif H and H['kind'] == 'p':   # 매수가가 곧 큰 숫자 · 구역 안 3.3㎡당은 참고 줄
            rows += [buy, trow]   # 표 머리칸이 좁아 이름은 '계산 매수가' 그대로(설명 줄이 '주변 300m 빌라 n건' 등 표본을 말함)
            z = zone_row('참고 · 구역 안 거래', '매수가 표본과 다른 묶음 · 대지 3.3㎡당 · ')
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
                jn = (f" · 매수가 표본(전용 {am:g}㎡)과 면적이 달라 직접 비교 불가" if diff else '') + f" · 계산엔 전세 {manT(c['jeonse'])}(전세가율 {round(c['jeonse'] / c['price'] * 100)}%)"
            rows.append(('빌라 전세', man(t['jm']), f"가운데 값 · 전세 {t.get('jn', 0)}건 · 임대 {t.get('ja', '–')}㎡" + jn))
        if t.get('n12') is not None: rows.append(('구역 안 12개월 거래', f"{t['n12']}건", '빌라·단독·아파트 전부 · 계약일 기준(계산 매수가 표본과 다른 묶음)'))
        if t.get('yoy') is not None: rows.append(('1년 변화', f"{'+' if t['yoy'] > 0 else ''}{t['yoy']}%", f"표본 {t['yon'][0]}/{t['yon'][1]}건 · 한 건물 쏠림 제외"))
        if rows:
            o.append(f'<h2>구역 안 실거래 <small class="meta">국토교통부·서울시 실거래 · {TXD[:4]}.{TXD[4:6]}.{TXD[6:]}까지</small></h2><table class="ov"><tbody>' + ''.join(f'<tr{" id=\"trust\"" if a == "이 숫자 믿어도 될까" else ""}><th scope="row">{a}</th><td><b>{b}</b><br><small class="meta">{s}</small></td></tr>' for a, b, s in rows) + '</tbody></table>')
    if t.get('old') and r.get('s', 0) < 7:
        x = t['old']
        o.append(f'<h2>노후도 <small class="meta">경계 안 건축물 {x["n"]:,}동 · 사용승인연도 확인 {x["k"]:,}동 · 서울도시공간포털 건물 레이어</small></h2><p>노후·불량 건축물 비율 <b>{x["pol"]}%</b>(철근콘크리트 30년·그 밖 20년 기준), 30년 넘은 건물 {x["p30"]}%, 평균 {x["avg"]}년이에요. 서울 재개발 구역지정 요건(노후도 60% 이상)과 비교해 보세요.</p>')
    if r.get('rdx') and not r['rdx'].get('d'):   # 구역지정일이 변경 지정일이라 날짜를 추정하지 않은 곳(tools/enrich.py)
        x = r['rdx']
        o.append(f'<h2>권리산정기준일</h2><p><b>확인 필요</b> · {esc(x.get("b"))} <a href="{esc(x.get("u"))}" target="_blank" rel="noopener nofollow">근거</a></p>')
    elif r.get('rdx'):
        x = r['rdx']
        o.append(f'<h2>권리산정기준일</h2><p><b>{esc(x.get("d"))}</b> · {esc(x.get("b"))}. 이날 뒤에 새로 짓거나 쪼갠 지분은 입주권이 안 나오거나 나눠 받을 수 있어요. <a href="{esc(x.get("u"))}" target="_blank" rel="noopener nofollow">근거</a></p>')
    th = (TH.get('z') or {}).get(rid)
    if th:
        o.append(f'<h2>토지거래허가 최근 내역 <small class="meta">서울부동산정보광장 · {esc(TH["since"].replace("-", "."))}~{esc(TH["asOf"].replace("-", "."))}</small></h2><p>구역 경계 안 필지로 <b>{th["n"]}건</b>이 허가됐어요(최근 30일 {th["n30"]}건, 주거용 {th["res"]}건). 주거용 허가는 2년 실거주 의무가 붙어 전세를 끼고 살 수 없어요.</p><ul class="steps tl">' + ''.join(f'<li><b>{esc(d.replace("-", "."))}</b><span>{esc(jb)} · {esc(jm)} · {esc(use)}{"" if res == "허가" else " · " + esc(res)}</span></li>' for d, jb, jm, use, res in th['r'][:5]) + '</ul>')
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
            o.append(f'<h2>주변 상권·학원가 <small class="meta">반경 1km · 서울시 상권분석서비스 {esc(S["q"])}</small></h2><p>상권 {len(n1)}곳 · 점포 {sum(x[4] for x in n1):,}개 · 학원 {sum(x[5] for x in n1):,}개. 큰 상권: ' + ', '.join(f'{esc(x[2])}(점포 {x[4]:,})' for x in big) + '.</p>')
    # 같은 구 다른 구역
    same = [x for x in R if x['g'] == r['g'] and x['id'] != rid and x['id'] in PAGES][:8]
    if same:
        o.append(f'<h2>{esc(r["g"])} 다른 구역</h2><div class="grid2">' + ''.join(f'<a class="zl" href="{x["id"]}">{esc(short(x["n"]))}<small>{esc(KIND.get(x["k"], x["k"]))} · {esc((C.get(x["id"]) or {}).get("stage") or x.get("sr") or "")}</small></a>' for x in same) + '</div>')
    src = ['<li>서울시 정비사업 정보몽땅 사업장 정보·추진경과</li>']
    if pm.get('cafe'): src = [f'<li>서울시 정비사업 정보몽땅 <a href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl={esc(pm["cafe"])}" target="_blank" rel="noopener nofollow">사업장 원문</a></li>']
    src += ['<li>국토교통부·서울시 부동산 실거래가(연립·다세대 매매, 전월세)</li>', '<li>서울도시공간포털 정비구역 경계·건물 정보</li>', '<li>서울시 상권분석서비스</li>']
    o.append(f'<p class="meta">이 구역 인가·고시 소식 받아 보기: <a href="../feed/z/{rid}.xml">RSS</a> · <a href="../gu/{esc(r["g"])}">{esc(r["g"])} 전체 구역</a></p>')
    o.append(f'<details class="srcs"><summary>자료 출처</summary><ul>{"".join(src)}</ul></details>')
    o.append(REPORT_P(r))
    o.append(f'<p class="note">이 페이지는 공개 자료로 매일 자동 갱신돼요. 계산은 시세 상승 0%·기본 비례율 같은 가정이 들어간 추정이고 투자 권유가 아니에요. 입주권 자격과 토지거래허가는 계약 전에 조합·구청에서 확인하세요. <a href="../method">계산 방법</a></p>')
    o.append(FOOT.format(upd=UPD))
    # 구조화 데이터: 글(Article) + 이동 경로(BreadcrumbList) + 장소(Place · 위경도·주소) · 공유 카드는 구역마다
    zg = (GEO.get('z') or {}).get(rid) or {}
    og = None
    if OG_OK:
        mk = next(((a, b) for a, b, _ in k if a not in ('현재 단계', '가까운 역', '토지등소유자')), None)
        og = zmap.og_card(rid, nm, f"{r['g']} {r.get('j') or ''} · {kind}".strip(), stage or '단계 확인 중', mk[0] if mk else '', re.sub(r'<[^>]+>', '', mk[1]) if mk else '', (r['ll'][1], r['ll'][0]) if r.get('ll') else (tuple(zg['l']) if zg.get('l') else None), r['g'], UPD)
    elif os.path.exists(os.path.join(ROOT, 'public/og/z', rid + '.png')): og = f'/og/z/{rid}.png'   # 글꼴·PIL이 없는 곳에서 돌 때는 있던 카드를 그대로
    if og: ld0["image"] = SITE + og
    graph = [ld0, crumbs(("집핀", SITE + "/"), ("구역별 페이지", f"{SITE}/z/"), (r['g'], f"{SITE}/gu/{r['g']}"), (nm, url))]
    graph.append(place_ld(r, url))
    h = plain(''.join(o)).replace('@@LD@@', json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace('</', '<\\/'), 1)
    if og: h = h.replace(f'<meta property="og:image" content="{SITE}/og.png">', f'<meta property="og:image" content="{SITE}{og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:image" content="{SITE}{og}">', 1)
    return h
R = [r for r in D['recs'] if not (r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7)) and r.get('src') != 'moa' and r.get('n')]   # 화면의 '진행 중'과 같은 기준
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
<title>{esc(short(_BY[_k]['n']))} | 집핀</title><link rel="canonical" href="{_u}"><meta http-equiv="refresh" content="0; url=./{_k}"><script>location.replace("./{_k}"+location.search+location.hash)</script></head>
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
    return re.sub(r'(<p class="f-c">© \d{4} 집핀 · 데이터 기준 )[\d.]+', lambda m: m.group(1) + UPD, h)
def hand_live(r, h):
    """손으로 쓴 구역 페이지: 글 속 숫자는 쓴 날 기준이라 머리 날짜를 '글 기준'으로 밝히고, 바로 밑에 오늘 숫자 상자(자동 페이지와 같은 값)를 끼운다."""
    rid = r['id']; c = C.get(rid) or {}
    h = re.sub(r'(<p class="eyebrow">[^<]*?)데이터 기준 ([\d.]+)', r'\1글 기준 \2', h, count=1)
    parts = [f"지금 <strong>{esc(c.get('stage') or r.get('sr') or '')}</strong> 단계"]
    if c.get('gapOk') and c.get('gapTotal') is not None: parts.append(f"{LBL['gap']} {LBL['cashToMoveIn']} <strong>{eok(c['gapTotal'])}</strong> (지금 {eok(c.get('gapNow'))})")
    elif c.get('need') is not None and r.get('tag') != 'mk' and r.get('nx') != 'mk': parts.append(f"현금 매수 · {LBL['cashToMoveIn']} <strong>{eok(c['need'])}</strong>")
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
    elif c.get('need') is not None and r.get('tag') != 'mk': ml, mv = f"현금 매수 · {LBL['cashToMoveIn']} · 기본 가정", eok(c['need'])
    else: ml, mv = '', ''
    og = zmap.og_card(rid, short(r['n']), f"{r['g']} {r.get('j') or ''} · {kind}".strip(), c.get('stage') or r.get('sr') or '단계 확인 중', ml, mv, None, r['g'], UPD, text_only=True) if OG_OK else (f'/og/z/{rid}.png' if os.path.exists(os.path.join(ROOT, 'public/og/z', rid + '.png')) else None)
    if not og or base not in h: return
    h = h.replace(base, f'<meta property="og:image" content="{SITE}{og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:image" content="{SITE}{og}">', 1)
    open(f, 'w', encoding='utf-8').write(h)
def hand_seo(r, h):
    """손으로 쓴 구역 글: 본문은 두고 머리만 자동 페이지와 같게 — 제목 '<짧은 이름> 재개발 | 단계·실거래·입주 현금 | 집핀', 구조화 데이터(글 + 이동 경로 + 장소)."""
    rid = r['id']; nm = short(r['n']); kind = KIND.get(r['k'], r['k']); url = f"{SITE}/z/{rid}"
    t = ztitle_s(r)
    h = re.sub(r'<title>.*?</title>', lambda m: f'<title>{esc(t)}</title>', h, count=1, flags=re.S)
    h = re.sub(r'<meta property="og:title" content="[^"]*">', lambda m: f'<meta property="og:title" content="{esc(t)}">', h, count=1)
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
    try: obj = json.loads(m.group(1)) if m else {}
    except ValueError: obj = {}
    art = next((x for x in obj.get('@graph', []) if x.get('@type') == 'Article'), None) if '@graph' in obj else ({k: v for k, v in obj.items() if k != '@context'} if obj.get('@type') else None)
    graph = ([art] if art else []) + [crumbs(("집핀", SITE + "/"), ("구역별 페이지", f"{SITE}/z/"), (r['g'], f"{SITE}/gu/{r['g']}"), (nm, url)), place_ld(r, url)]
    tag = '<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace('</', '<\\/') + '</script>'
    return h[:m.start()] + tag + h[m.end():] if m else h.replace('</head>', tag + '\n</head>', 1)
# 모든 정적 페이지 공통: 머리 검색(좁은 화면 포함) · 다크 theme-color를 앱과 같게(#15181D) · '정보몽땅' 첫 언급은 '정비사업 정보몽땅'
TSR = '<form class="tsr" action="/" method="get" role="search"><label class="sr-only" for="tq">구역 검색</label><input id="tq" name="q" type="search" placeholder="구역·동·역 검색" autocomplete="off" enterkeyhint="search" maxlength="40"></form>'
def static_norm(h):
    h = h.replace('content="#14171C" media="(prefers-color-scheme: dark)"', 'content="#15181D" media="(prefers-color-scheme: dark)"')
    if '<header class="top"><a ' in h: h = h.replace('<header class="top"><a ', '<header class="top"><div class="in"><a ', 1).replace('</nav></header>', '</nav></div></header>', 1)
    if 'class="tsr"' not in h: h = re.sub(r'</nav>(</div></header>)', lambda m: '</nav>' + TSR + m.group(1), h, count=1)
    def first(seg):
        i = seg.find('정보몽땅')
        return seg if i < 0 or seg[max(0, i - 5):i] == '정비사업 ' else seg[:i] + '정비사업 ' + seg[i:]
    b = h.find('<body')
    if b > 0:
        hd = h[:b]; m = re.search(r'<meta name="description" content="[^"]*">', hd)
        if m: hd = hd[:m.start()] + first(m.group(0)) + hd[m.end():]
        h = hd + first(h[b:])
    return h
def hand_fix(r):
    f = os.path.join(ZD, r['id'] + '.html'); h0 = open(f, encoding='utf-8').read()
    h1 = static_norm(hand_seo(r, term_fix(hand_live(r, h0) if r['id'] in _LIVE else h0)))
    if h1 != h0: open(f, 'w', encoding='utf-8').write(h1)
# ---- 얇은 페이지 거르기(24차 · 애드센스 '가치가 별로 없는 콘텐츠' 대응) ----
# 자동 페이지마다 (1) 자료가 얼마나 있는지(계산 매수가 표본 · 구역 안 거래 · 날짜가 있는 인가 이력 · 정보몽땅 추진경과 기록 · 법원경매 · 토지거래허가)와
# (2) 다른 구역 페이지와 겹치지 않는 본문 글자 수(숫자를 0으로 바꿔 같은 틀 문장이 THIN_TPL곳 넘게 나오면 틀로 봄)를 잰다.
# 자료 점수(계산 매수가 표본 2점 — 실제 거래로 낸 이 구역만의 숫자 · 구역 안 거래·인가 날짜·추진경과 기록·경매·토지거래허가 각 1점)가 THIN_SIG 미만이고 고유 본문도 THIN_TXT자 미만이면 <meta name="robots" content="noindex,follow"> — 사람은 그대로 열 수 있고 링크는 따라가며,
# sitemap.py가 noindex 페이지를 사이트맵에서 뺀다. 손으로 쓴 구역 글(emr-auto 없음)은 늘 색인. 매일 다시 잰다(자료가 늘면 다시 색인).
THIN_SIG, THIN_TXT, THIN_TPL = 2, 400, 10
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
    b = html.unescape(re.sub(r'<[^>]+>', '', _SEGX.sub('\n', b)))
    return [x.strip() for x in re.split(r'\n|(?<=[.요다])\s', b) if x.strip()]
_tpl = lambda x: re.sub(r'[\d,.%]+', '0', x)
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
    thin = n < THIN_SIG and u < THIN_TXT
    THIN[rid] = {'sig': [k for k, v in sg.items() if v], 'score': n, 'uniq': u, 'noindex': thin}
    if thin: h = h.replace('<meta name="emr-auto" content="1">', '<meta name="emr-auto" content="1">\n' + NOIDX, 1)
    open(os.path.join(ZD, rid + '.html'), 'w', encoding='utf-8').write(h); made += 1
_ni = sum(1 for v in THIN.values() if v['noindex'])
json.dump({'rule': {'score_min': THIN_SIG, 'weights': THIN_W, 'unique_chars_min': THIN_TXT, 'template_pages': THIN_TPL}, 'auto': len(THIN), 'indexed': len(THIN) - _ni, 'noindex': _ni, 'hand': kept, 'pages': THIN},
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
idx = [HEAD.format(title='서울 정비사업 구역별 페이지 | 집핀 - 서울 재개발 지도', desc=f'서울 진행 중 정비사업 {len(R)}곳의 구역별 진행 단계·실거래·노후도·입주까지 현금. 데이터 기준 {UPD}.', url=f'{SITE}/z/', site=SITE,
                  ld=json.dumps({"@context": "https://schema.org", "@graph": [{"@type": "CollectionPage", "name": "서울 정비사업 구역별 페이지", "url": f"{SITE}/z/", "inLanguage": "ko"}, crumbs(("집핀", SITE + "/"), ("구역별 페이지", f"{SITE}/z/"))]}, ensure_ascii=False)).replace('<meta name="emr-auto" content="1">\n', '')]
idx.append(f'<p class="eyebrow">구역별 페이지 · 데이터 기준 {UPD}</p><h1>서울 정비사업 구역별 페이지</h1><p class="lede">서울에서 진행 중인 재개발·재건축·가로주택 {len(R)}곳을 구역마다 한 페이지로 정리했어요. 진행 단계와 인가 이력, 구역 안 실거래, 노후도, 권리산정기준일, 기본 가정의 지금 필요한 돈과 입주까지 현금이 있어요. 매일 자동 갱신돼요.</p>')
idx.append(CNT_NOTE)
if hand: idx.append('<h2>기사·고시로 대조해 정리한 구역</h2><p>규모가 커서 확인할 거리가 많은 구역은 기사·고시와 정비사업 정보몽땅 등록값을 대조한 이야기를 붙였어요.</p><div class="grid2">' + ''.join(li(x) for x in hand if x['id'] in {y['id'] for y in R}) + '</div>')
for g in sorted(byg): idx.append(f'<h2><a href="../gu/{esc(g)}">{esc(g)}</a> <small class="meta">{len(byg[g])}곳</small></h2><div class="grid2">' + ''.join(li(x) for x in sorted(byg[g], key=lambda x: -x.get('s', 0))) + '</div>')
idx.append(FOOT.format(upd=UPD))
open(os.path.join(ZD, 'index.html'), 'w', encoding='utf-8').write(''.join(idx))
zmap.og_save()
print('zpages made', made, 'hand kept', kept, 'index', len(R))
# 구별 페이지: public/gu/<구>.html (검색 노출용 · 그 구의 진행 중 구역을 필요한 돈과 함께)
GD = os.path.join(ROOT, 'public/gu'); os.makedirs(GD, exist_ok=True)
for f in os.listdir(GD):
    if f.endswith('.html'): os.remove(os.path.join(GD, f))
def guPage(g, L):
    url = f'{SITE}/gu/{g}'
    c = lambda x: C.get(x['id']) or {}
    ok = [x for x in L if c(x).get('gapOk') and c(x).get('gapNow') is not None and not x.get('lc') and x.get('tag') != 'mk']   # 참고값(lc)·시장 정비는 '가장 적은 돈' 예시에서 뺀다(사이트 목록과 같음)
    cheap = sorted(ok, key=lambda x: c(x)['gapNow'])[:3]
    st = collections.Counter(c(x).get('stage') or x.get('sr') or '' for x in L)
    title = f'{g} 재개발·재건축 {len(L)}곳 · 진행 단계와 필요한 돈 | 집핀'
    desc = f'{g}에서 진행 중인 정비사업 {len(L)}곳. ' + (f'전세 끼고 가장 적은 돈으로 갈 수 있는 곳은 {short(cheap[0]["n"])}(지금 {eok(c(cheap[0])["gapNow"])}). ' if cheap else '') + f'데이터 기준 {UPD}.'
    gc = next((x.get('c') for x in (GEO.get('gu') or []) if x['n'] == g), None)
    area = {"@type": "AdministrativeArea", "name": f"서울특별시 {g}", "url": url, "address": {"@type": "PostalAddress", "addressCountry": "KR", "addressRegion": "서울특별시", "addressLocality": g}}
    if gc: area["geo"] = {"@type": "GeoCoordinates", "latitude": round(gc[1], 5), "longitude": round(gc[0], 5)}
    ld = json.dumps({"@context": "https://schema.org", "@graph": [{"@type": "CollectionPage", "name": f"{g} 정비사업", "url": url, "inLanguage": "ko", "about": {"@id": url + "#gu"}},
                     crumbs(("집핀", SITE + "/"), ("자치구별", f"{SITE}/gu/"), (g, url)), {**area, "@id": url + "#gu"}]}, ensure_ascii=False)
    o = [HEAD.format(title=esc(title), desc=esc(desc), url=url, site=SITE, ld=ld).replace(' aria-current="page"', '').replace('<link rel="canonical"', f'<link rel="alternate" type="application/rss+xml" title="{esc(g)} 정비사업 새 소식" href="../feed/gu/{esc(g)}.xml">\n<link rel="canonical"', 1)]
    o.append(f'<p class="eyebrow"><a href="./">구역별 페이지</a> · <a href="../gu/">자치구별</a> · 데이터 기준 {UPD}</p><h1>{esc(g)} 재개발·재건축 {len(L)}곳</h1>')
    top = [(k, v) for k, v in st.most_common() if k][:5]; rest = len(L) - sum(v for _, v in top)   # 단계 합이 머리글 곳 수와 꼭 맞게: 나머지는 '기타'
    o.append('<p class="lede">' + ' · '.join([f'{esc(k)} {v}곳' for k, v in top] + ([f'기타 {rest}곳'] if rest else [])) + '</p>')
    if cheap: o.append('<p>전세 끼고 적은 돈으로 시작할 수 있는 곳: ' + ', '.join(f'<a href="{x["id"]}">{esc(short(x["n"]))}</a> {eok(c(x)["gapNow"])}' for x in cheap) + f'. <a href="../#map-{esc(g)}">지도에서 내 돈으로 보기 →</a></p>')
    def rowkey(x):   # 숫자가 있는 줄 먼저(전세 끼고 지금 적은 순 → 현금만 있는 줄), 숫자 없는 줄은 뒤에 단계순
        v = c(x)
        if v.get('gapOk') and v.get('gapNow') is not None: return (0, v['gapNow'], short(x['n']))
        if v.get('cashOk') and v.get('need') is not None: return (1, v['need'], short(x['n']))
        return (2, -x.get('s', 0), short(x['n']))
    def tot(x):   # '전세 끼고 지금' 칸과 같은 방식의 입주까지 현금(앱 5.8억 = 갭 총액) · 전세 못 끼면 현금 매수 총액임을 표시
        v = c(x)
        if v.get('gapOk') and v.get('gapTotal') is not None: return eok(v['gapTotal'])
        if v.get('cashOk') and v.get('need') is not None: return f'{eok(v["need"])} <small>현금 매수 시</small>'
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
                f'<span class="gr-r">{f'<span class="gr-v"><i>지금</i> <b class="gr-now">{nowT(x)}</b></span>' if nowT(x) else f'<span class="gr-v gr-na"><i>전세 끼고</i> <b class="gr-now">{whyT(x)}</b></span>'}{f'<small>입주까지 현금 <b class="gr-tot">{tot(x)}</b></small>' if tot(x) != '–' else '<small class="gr-hold">입주까지 현금 계산 보류</small>'}</span></a></li>')
    rows = ''.join(grow(x) for x in sorted(L, key=rowkey))
    GCSS = ('<style>.gl{list-style:none;margin:12px 0;padding:0;border:1px solid var(--border);border-radius:16px;background:var(--surface);overflow:hidden}'
            '.gl li+li{border-top:1px solid var(--border)}.gl a{display:flex;align-items:center;gap:12px;min-height:72px;padding:10px 14px 10px 16px;color:var(--text-1);text-decoration:none!important}'
            '.gl a:hover{background:var(--surface-2)}.gr-l{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:5px}.gr-l>b{font-size:16px;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
            '.gr-s{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-3);white-space:nowrap;overflow:hidden}.gr-s em{font-style:normal;flex:none;padding:2px 7px;border-radius:6px;background:var(--surface-2);color:var(--text-2);font-weight:600;font-size:12px}'
            '.gr-r{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:2px;text-align:right}.gr-v i{font-style:normal;font-size:12px;color:var(--text-2)}.gr-v b{font-size:18px;font-weight:800;color:var(--brand,#1f3a87);font-variant-numeric:tabular-nums}'
            '.gr-na b{font-size:13px!important;font-weight:600!important;color:var(--text-2)!important}main p a,.eyebrow a{text-decoration:none!important;color:var(--brand,#1f3a87);font-weight:600}'
            '.gr-r small{font-size:12px;color:var(--text-2)}.gr-r small b{font-weight:700;color:var(--text-1)}.gr-r small small{font-size:11px;color:var(--text-3)}</style>')
    o.append(f'{GCSS}<ol class="gl" aria-label="{esc(g)} 구역 목록 · 전세 끼고 지금 필요한 돈 적은 순">{rows}</ol>')
    o.append('<p class="meta">입주까지 현금(입주 잔금대출 제외): 전세 끼고 갈 수 있는 곳은 <b>전세 끼고 산 경우</b>(앱 첫 화면과 같은 값), 전세를 낄 수 없는 곳은 <b>현금 매수 시</b> 금액이에요.' + (' <sup>*</sup><b>토허제</b> = 토지거래허가구역. 사면 2년 동안 직접 살아야 해서 전세를 끼고 살 수 없어요.' if any((gapWhy(c(x)) or ('',))[0] == '토허제' for x in L) else '') + '</p>')
    why = collections.Counter(gapWhy(c(x))[0] for x in L if not c(x).get('gapOk') and gapWhy(c(x)))
    EXP = {'토허제': '토지거래허가구역이라 사면 2년 실거주해야 해서 전세를 끼고 살 수 없어요', '세입자 없음': '이주·철거가 시작돼 전세를 낄 세입자가 없어요(입주권으로 사야 해요)',
           '입주권 없음': '지금 사면 입주권이 안 나오는 시점이에요(조합설립인가 등 이후 매수분)', '판정 보류': '입주권이 나오는지 판단할 자료가 부족해요', '대상 아님': '상가·업무 중심 사업 등 아파트 입주권 계산 대상이 아니에요'}
    if why: o.append('<p class="meta">전세 끼고 칸이 비어 있는 이유: ' + ' · '.join(f'<b>{k}</b>({v}곳) {EXP[k]}' for k, v in why.most_common()) + '. –는 매수가·전세 자료가 부족한 곳이에요.</p>')
    o.append(f'<p class="meta">새 소식 받기: <a href="../feed/gu/{esc(g)}.xml">{esc(g)} RSS</a></p>')
    o.append('<p class="note">무주택·84㎡·시세 상승 0% 같은 기본 가정으로 계산한 추정이에요. 내 조건은 <a href="../">찾기(첫 화면)</a>에서 바꿔 볼 수 있어요. 투자 권유가 아니에요.</p>')
    o.append(FOOT.format(upd=UPD))
    return ''.join(o)
for g in sorted(byg): open(os.path.join(GD, g + '.html'), 'w', encoding='utf-8').write(MONEY(guPage(g, byg[g])))
print('gu pages', len(byg))
# 구 목록 페이지: public/gu/index.html (/gu/ 가 404가 나지 않게)
def guIndex():
    url = f'{SITE}/gu/'
    ld = json.dumps({"@context": "https://schema.org", "@graph": [{"@type": "CollectionPage", "name": "서울 자치구별 정비사업", "url": url, "inLanguage": "ko",
                     "mainEntity": {"@type": "ItemList", "numberOfItems": len(byg), "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": g, "url": f"{SITE}/gu/{g}"} for i, g in enumerate(sorted(byg))]}},
                     crumbs(("집핀", SITE + "/"), ("자치구별", url))]}, ensure_ascii=False)
    title = f'서울 자치구별 재개발·재건축 {len(byg)}개 구 | 집핀'
    desc = f'서울 {len(byg)}개 자치구의 진행 중 정비사업 {len(R)}곳을 구별로 모았어요. 구를 누르면 구역마다 진행 단계와 필요한 돈을 볼 수 있어요. 데이터 기준 {UPD}.'
    o = [HEAD.format(title=esc(title), desc=esc(desc), url=url, site=SITE, ld=ld).replace('<meta name="emr-auto" content="1">\n', '').replace(' aria-current="page"', '').replace('<base href="/z/">', '<base href="/gu/">')]
    o.append(f'<p class="eyebrow">자치구별 페이지 · 데이터 기준 {UPD}</p><h1>서울 자치구별 재개발·재건축</h1><p class="lede">서울에서 진행 중인 정비사업 {len(R)}곳을 {len(byg)}개 구로 나눴어요. 구를 고르면 그 구의 구역을 전세 끼고 지금 필요한 돈 순으로 볼 수 있어요.</p>')
    o.append(CNT_NOTE)
    def card(g):
        L = byg[g]; ok = [C.get(x['id'], {}).get('gapNow') for x in L if (C.get(x['id']) or {}).get('gapOk') and (C.get(x['id']) or {}).get('gapNow') is not None and not x.get('lc') and x.get('tag') != 'mk']
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
_pub = {"@type": "Organization", "name": "집핀", "url": SITE, "logo": f"{SITE}/icon-512.png"}
RD = os.path.join(ROOT, 'public/report')
if os.path.isdir(RD):
    iss = sorted((f for f in os.listdir(RD) if re.match(r'\d{4}-\d{2}\.html$', f)), reverse=True)
    for f in iss:
        h = open(os.path.join(RD, f), encoding='utf-8').read(); ym = f[:7]
        h1m = re.search(r'<h1[^>]*>(.*?)</h1>', h, re.S)
        # 발행일 = 머리글 '발행 YYYY년 M월 D일'(예전엔 해당 월 1일을 넣어 머리의 Article과 날짜가 달랐다) · 머리에 따로 있던 Article 구조화 데이터는 이 한 덩이로 합친다
        pm = re.search(r'발행 (\d{4})년 (\d{1,2})월 (\d{1,2})일', h)
        pubd = f"{pm.group(1)}-{int(pm.group(2)):02d}-{int(pm.group(3)):02d}" if pm else ym + "-01"
        hd0 = h[:h.find('<body')]
        hd1 = re.sub(r'<script type="application/ld\+json">\{[^<]*?"@type": ?"Article"[^<]*?</script>\n?', '', hd0)
        if hd1 != hd0: open(os.path.join(RD, f), 'w', encoding='utf-8').write(hd1 + h[len(hd0):])
        _ld_put(os.path.join(RD, f), {"@context": "https://schema.org", "@type": "Article", "headline": re.sub(r'<[^>]+>', '', h1m.group(1)).strip()[:110] if h1m else _meta(h, 'title'),
                 "description": _meta(h, 'desc'), "inLanguage": "ko", "datePublished": pubd, "dateModified": pubd, "url": f"{SITE}/report/{ym}", "mainEntityOfPage": f"{SITE}/report/{ym}",
                 "image": f"{SITE}/og.png", "author": {"@type": "Person", "name": "집핀 운영자", "url": f"{SITE}/about"}, "publisher": _pub})
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
                 "author": {"@type": "Person", "name": "집핀 운영자", "url": f"{SITE}/about"}, "publisher": _pub})
