#!/usr/bin/env python3
"""리뉴얼 A3·F10: 신뢰·학습 페이지 생성기 (renew-content)
  - public/glossary.html     재개발 용어집 (원문: tools/glossary_data.py · 앵커는 바꾸지 않는다)
  - public/corrections.html  오류 수정 기록 (아래 FIXES · git 커밋 날짜 그대로)
  - public/about.html        '운영자 소개·편집 원칙' 덩이(<!--zp-op--> … <!--/zp-op-->)만 바꿔 끼운다
서비스 이름·필명은 아래 상수 한 곳에서만 바꾼다(상표 문제로 이름이 바뀔 수 있음 · 글은 이름 받침에 기대는 조사를 쓰지 않게 짰다).
머리·아래 탭·푸터 링크·푸터 무관 문장은 build.py 끝의 static_tabs.py가 넣는다. 몇 번 돌려도 결과가 같다.
  python3 tools/trust.py"""
import os, re, json, html
from glossary_data import T as TERMS, SECS, LAWURL

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(R, 'public')
SITE = 'https://jaegaebal.alwaysquestions.kr'

# ---- 브랜드: tools/brand.py · 필명만 여기 ----
from brand import BRAND, BRAND_EN, SITE_TAIL, RENAME_NOTE, RENAME_DATE, TAGLINE, ICON_LINKS, wordmark_svg   # 서비스 이름은 tools/brand.py 한 곳에서
PEN = '늘질문'                 # 운영자 필명(always questions) — 실명·사업자 정보·이메일은 싣지 않는다(운영 원칙)
OP = f'{BRAND} 운영자'
TITLE_SUFFIX = SITE_TAIL
E = html.escape


def esc(s): return E(s, quote=False)


# 애드센스 리터럴 태그(다른 63쪽과 바이트 같음) — 고유 글인 /glossary에만(리드 결정 2026-10-27 · tools/fixtures/ads_tag_pages.json에 함께 올림). /corrections에는 넣지 않는다
ADS_TAG = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9772652926977648" crossorigin="anonymous"></script>'


def page(path, title, desc, body, ld, og_type='article', ads=False):
    """정적 페이지 뼈대(about.html과 같은 머리)"""
    url = f'{SITE}/{path}'
    t = f'{title} | {TITLE_SUFFIX}'
    return f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<base href="/">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(t)}</title>
<meta name="description" content="{E(desc)}">
<meta name="color-scheme" content="light dark">
<link rel="canonical" href="{url}">
<meta property="og:site_name" content="{BRAND}"><meta property="og:title" content="{E(t)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:type" content="{og_type}">
<meta property="og:image" content="{SITE}/og.png">
<meta property="og:locale" content="ko_KR">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#15181D" media="(prefers-color-scheme: dark)">
{ICON_LINKS}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" crossorigin>
<link rel="stylesheet" href="pages.css">
{ADS_TAG + chr(10) if ads else ""}<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<link rel="manifest" href="/manifest.webmanifest">
</head>
<body>
<header class="top"><div class="in"><a class="logo" href="/" aria-label="{BRAND} 처음으로">{wordmark_svg()}<small class="logo-s">{TAGLINE}</small></a></div></header>
<main>
{body}
</main>
<footer class="f"><p></p><p class="f-c">© 2026 {BRAND}</p></footer>
</body>
</html>
'''


def keep(fp, new):
    """머리·탭·푸터는 static_tabs가 다시 쓰므로, 본문(<main>)과 머리 정보가 같으면 파일을 건드리지 않는다(빌드를 여러 번 돌려도 diff 없음)"""
    if os.path.exists(fp):
        old = open(fp, encoding='utf-8').read()
        k = lambda s: (re.search(r'<main>.*?</main>', s, re.S) or [''])[0] + (re.search(r'<head>.*?</head>', s, re.S) or [''])[0]
        if k(old) == k(new): return False
    open(fp, 'w', encoding='utf-8').write(new); return True


# ================= 용어집 =================
def law_html(law, note=''):
    out = []
    for name, art in law:
        u = LAWURL.get(name)
        m = re.match(r'제(\d+조(?:의\d+)?)', art)
        if u and m: out.append(f'<a href="{u}/제{m.group(1)}" target="_blank" rel="noopener">{name} {art}</a>')
        else: out.append(f'{name} {art}')
    if note: out.append(esc(note))
    return ' · '.join(out)


def glossary():
    by = {t['id']: t for t in TERMS}
    assert len(by) == len(TERMS), 'id 겹침'
    for t in TERMS:
        for r in t['rel']: assert r in by, (t['id'], r)
    secs = []
    for sid, h, lead in SECS:
        items = []
        for t in (x for x in TERMS if x['s'] == sid):
            aka = f'<small>{esc(t["a"])}</small>' if t.get('a') else ''
            law = law_html(t.get('law') or [], t.get('lawnote', ''))
            rel = ''.join(f'<a href="/glossary#{r}">{esc(by[r]["t"])}</a>' for r in t['rel'])
            more = f'<a href="{t["more"][0]}">{esc(t["more"][1])} →</a>' if t.get('more') else ''
            items.append(f'<article class="term" id="{t["id"]}"><h3>{esc(t["t"])}{aka}</h3>'
                         f'<p class="t-def">{esc(t["d"])}</p><p>{esc(t["w"])}</p><p class="t-ex">{esc(t["e"])}</p>'
                         + (f'<p class="t-law">근거: {law}</p>' if law else '')
                         + f'<p class="t-rel"><span>같이 보면</span>{rel}{more}</p></article>')
        at = {'rights': '<!--zp-ad-at:mid-->', 'plan': '<!--zp-ad-at:bottom-->'}.get(sid, '')   # 광고 자리: 묶음 소개 문단 뒤 · 첫 용어 제목 앞
        secs.append(f'<section class="gl-sec" id="s-{sid}" aria-labelledby="h-{sid}"><h2 id="h-{sid}">{esc(h)}</h2><p>{esc(lead)}</p>{at}{"".join(items)}</section>')
    nav = ''.join(f'<li><a href="/glossary#s-{sid}">{esc(h)}</a></li>' for sid, h, _ in SECS)
    n = len(TERMS)
    body = f'''<p class="eyebrow">용어집</p>
<h1>비례율, 권리산정기준일… 재개발 말이 막힐 때</h1>
<p class="byline">정리: {OP} · 법 조항은 국가법령정보센터 원문과 맞춰 봤어요 · 글 고친 날 <time class="zp-mod" datetime="2026-10-27">2026년 10월 27일</time></p>
<p class="lede">기사에서 「관리처분 전 매수」나 「비례율 하락」이 나오면 그게 내 돈에 무슨 뜻인지 바로 와닿지 않아요. 재개발·재건축에서 자주 마주치는 말 {n}개를 골라 뜻과 함께 돈과 시기에 어떤 영향을 주는지 적었어요.</p>
<p>항목마다 한 줄 뜻, 왜 신경 써야 하는지, 짧은 예, 근거 법 조항, 같이 보면 좋은 말 순서로 놓았어요. 예에 나오는 숫자는 계산을 보여 주려고 넣은 가상의 값이고 구역 이름이 나오는 예만 실제 자료예요.</p>
<ul class="gl-nav" aria-label="용어집 묶음">{nav}</ul>
{"".join(secs)}
<p class="note">법 조항은 2026년 10월 현행 기준이에요. 법과 서울시 조례는 자주 바뀌니, 계약 전에는 조합·구청에서 꼭 다시 확인하세요. 이 페이지는 법률 자문이 아니에요.</p>
<section class="next-read" aria-labelledby="nr-h"><h2 id="nr-h">다음에 읽을 거리</h2><ul>
<li><a href="/guide/ipjugwon">조합설립인가 뒤에 사도 입주권이 나오나</a></li>
<li><a href="/guide/bundamgeum">서울 재개발 분담금, 실제로 얼마나 나오나</a></li>
<li><a href="/years">지금 단계에서 입주까지 몇 년 걸리나</a></li>
<li><a href="/method">이 사이트 숫자는 어떻게 계산하나</a></li>
</ul></section>'''
    ld = {"@context": "https://schema.org", "@type": "DefinedTermSet", "name": "재개발 용어집", "url": f"{SITE}/glossary", "inLanguage": "ko", "dateModified": "2026-10-27",
          "hasDefinedTerm": [{"@type": "DefinedTerm", "name": t['t'], "description": t['d'], "url": f"{SITE}/glossary#{t['id']}"} for t in TERMS]}
    desc = f'재개발·재건축에서 자주 쓰는 말 {n}개를 뜻, 돈·시기에 주는 영향, 예, 도시정비법·소규모주택정비법 근거 조항과 함께 정리했어요.'
    return page('glossary', f'재개발 용어집 {n}개 · 비례율·권리산정기준일·관리처분', desc, body, ld, ads=True)


# ================= 오류 수정 기록 =================
# 날짜 = 고친 커밋의 날짜(git log --format=%cs). 2026-10-15 이전 일은 저장소 기록이 시작되기 전이라 '기록 시작 전'으로 둔다.
# 새로 고칠 때마다 맨 위에 한 줄씩 더한다(무엇이 · 어떻게 틀렸고 · 어떻게 고쳤나 · 어디에 반영됐나).
FIXES = [
    (RENAME_DATE, '', '이름', '서비스 이름을 집핀에서 재개각으로 바꿨어요',
     '예전 이름 「집핀(Zippin)」이 다른 회사 상표와 겹칠 수 있었어요.',
     f'이름을 {BRAND}({BRAND_EN})으로 바꿨어요. 사이트 주소와 기능은 그대로예요.', '모든 페이지·앱 이름'),
    ('2026-10-26', '83f474089', '숫자', '모아타운 사업구역 줄의 금액이 구역 화면과 달랐어요',
     '모아타운 관리지역 화면의 사업구역(하위 조합) 줄이 「일반 매매 · 금액」을 보여 줬어요. 같은 사업구역의 구역 화면과 구역 페이지는 「계산 보류」였어요.',
     '지금 사면 입주권이 원칙적으로 없는 사업구역은 모든 화면에서 「계산 보류 · 입주권 원칙적으로 없음 · 예외 매물만」으로 맞췄어요.', '지도·목록의 모아타운 화면'),
    ('2026-10-26', 'a4216b207', '이름', '사당동 206-1번지 일원의 구역 이름이 깨져 보였어요',
     '구역 이름이 「사당동 206대시 1번지 일원」으로 나왔어요. 원자료의 대시 기호를 글자로 잘못 옮긴 거예요.',
     '원자료 표기대로 「사당동 206-1번지 일원」으로 고쳤어요. 매일 갱신할 때도 숫자 사이 대시가 「-」로 바뀌게 했어요.', '구역 페이지·동작구 페이지·검색·앱 자료'),
    ('2026-10-26', '816323fda', '숫자', '검색 결과 줄의 금액이 구역 페이지와 달랐어요',
     '전세를 끼고 살 수 없는 373곳이 검색 결과 줄에서만 「계산 보류」로 보였어요. 구역 화면과 구역 페이지는 대출 끼고 산 금액을 보여 줬어요.',
     '검색 줄도 같은 값을 쓰게 했어요. 956곳 금액을 구역 페이지와 하나씩 견줘 어긋나는 곳이 없는 걸 확인했어요.', '검색 결과'),
    ('2026-10-26', 'f9744d365', '문구', '「입주권 없음」이 이미 집을 가진 사람에게도 해당하는 것처럼 읽혔어요',
     '웹 화면은 「입주권 없음」이라고만 적었어요. 그 구역에 이미 집을 가진 조합원도 입주권이 없다는 뜻으로 오해할 수 있었어요.',
     '「지금 사면 입주권 없음」으로 고치고 그 전에 산 집은 해당하지 않는다는 설명을 붙였어요. 앱과 같은 문구예요.', '구역 화면·목록'),
    ('2026-10-25', '7bcb75850', '리포트', '9월호에 주민공람 공고일을 정비구역 지정일로 실었어요',
     '개포우성1·2차아파트를 「정비구역 지정 9월 18일」로 실었는데, 정보몽땅 고시·공고 목록을 다시 보니 그날은 주민공람 공고일이었어요. 10월 24일까지 지정 고시는 확인되지 않았어요.',
     '인가 건수에서 빼서 9건을 8건으로, 구역 8곳을 7곳으로 고쳤어요. 제목·요약·막대·표도 함께 고쳤어요.', '<a href="/report/2026-09#fix">9월호 정정 상자</a>'),
    ('2026-10-25', '7bcb75850', '리포트', '7~9월호가 입주권 없는 곳의 금액까지 요약에 셌어요',
     '지금 사면 입주권이 나오지 않는 곳의 입주까지 현금을 본문 요약과 범위 계산에 넣었어요. 카드에서는 이미 「계산 보류」였던 곳들이에요.',
     '본문도 카드처럼 「계산 보류」로 두고 요약을 다시 셌어요. 7월호는 계산된 곳 14곳이 7곳으로(모아타운 참고값까지 뺌), 8월호는 16곳이 8곳으로, 9월호는 6곳이 2곳으로 줄었어요. 발행일과 인가 날짜, 원문 링크는 그대로예요.',
     '<a href="/report/2026-07#fix">7월호</a> · <a href="/report/2026-08#fix">8월호</a> · <a href="/report/2026-09#fix">9월호</a> 정정 상자'),
    ('2026-10-17', '1c61deaf2', '자료', '구역의 가까운 역 147곳을 바로잡았어요',
     '일부 구역의 「가까운 역」이 실제와 다르게 붙어 있었어요.',
     '147곳의 가까운 역을 바로잡았어요.', '구역 화면·구역 페이지·출퇴근 계산'),
    ('2026-10-17', '23e10492e', '자료', '역 이름과 동의율 표기 오타를 고쳤어요',
     '역 이름 몇 곳과 조합설립 동의율 표기에 오타가 있었어요.',
     '원자료와 대조해 고쳤어요.', '구역 화면·구역 페이지'),
    ('2026-10-15', 'eacdc76a6', '계산', '입주 때 잔금대출 한도를 너무 크게 잡았어요',
     '입주 때 잔금대출에 매수할 때와 같은 대출 비율(LTV)을 썼어요. 입주할 때는 이미 집(입주권)을 가진 상태라 생애최초 우대 같은 비율을 받을 수 없어요.',
     '입주 때 비율을 40%로, 집을 두 채 이상 가진 경우는 0으로 고쳤어요. 그만큼 입주까지 현금이 늘어난 구역이 있어요.', '입주까지 현금 계산 전체'),
    ('2026-10-15', '072de9ac8', '자료', '모아타운 관리지역에 조합 인가가 있는 것처럼 셌어요',
     '모아타운 관리지역은 조합이 아닌데, 관리지역을 한 조합처럼 보고 인가 기록을 붙여 셌어요.',
     '관리지역에는 소속 사업구역 조합의 인가만 세도록 고쳤어요.', '단계 통계·구역 화면'),
    ('2026-10-15', '072de9ac8', '문구', '토지거래허가 안내가 실제 지정 범위보다 넓게 읽혔어요',
     '「실거주 의무(토허) 없는 곳만」 필터와 모아타운 안내가, 빌라까지 모두 허가 대상인 것처럼 읽힐 수 있었어요.',
     '필터 이름을 「아파트·신통 토허 아닌 곳만」으로 바꾸고 모아타운은 지목이 도로인 땅(도로 지분)만 허가 대상으로 지정되는 경우가 많다고 적었어요.', '목록 필터·매수 전 체크'),
    ('기록 시작 전', '', '리포트', '염리동 488-14번지 조합설립인가 날짜가 창립총회 날이었어요',
     '정보몽땅에 7월 3일 조합설립인가로 잡혀 있어 7월호에 실었는데, 그날은 창립총회 날이었어요.',
     '기사(한국경제 2026.9.16 보도)로 실제 인가일이 9월 14일인 걸 확인하고 9월호로 옮겼어요.', '<a href="/report/2026-07">7월호</a> · <a href="/report/2026-09">9월호</a>'),
    ('기록 시작 전', '', '자료', '시공사 기록이 빈 진행 구역 30곳을 기사와 대조했어요',
     '정보몽땅에 시공사가 비어 있는 진행 구역이 있었어요.',
     '30곳을 기사와 대조해 이미 시공사를 뽑은 11곳의 시공사를 채웠어요.', '구역 화면·시공사 순위 가이드'),
]


def corrections():
    items = []
    for d, c, k, h, wrong, fix, where in FIXES:
        dl = f'<time datetime="{d}">{d.replace("-", ".")}</time>' if re.match(r'\d{4}-', d) else '<span>2026.10.15 이전(저장소 기록 시작 전)</span>'
        items.append(f'<li><p class="cx-d">{dl}<span class="cx-k">{esc(k)}</span></p><h3>{esc(h)}</h3>'
                     f'<p><b>무엇이 틀렸나</b> {esc(wrong)}</p><p><b>어떻게 고쳤나</b> {esc(fix)}</p><p class="cx-w">고친 곳: {where}</p></li>')
    n = len(FIXES)
    body = f'''<p class="eyebrow">오류 수정 기록</p>
<h1>무엇이 틀렸고 언제 어떻게 고쳤나요?</h1>
<p class="byline">정리: {OP} · 새로 고칠 때마다 맨 위에 더해요 · 글 고친 날 <time class="zp-mod" datetime="2026-10-27">2026년 10월 27일</time></p>
<p class="lede">숫자를 다루는 사이트는 틀릴 때가 있어요. 틀린 걸 조용히 고치기보다 무엇이 어떻게 틀렸는지 남겨 두는 편이 믿고 쓰는 데 낫다고 봐요.</p>
<p>아래는 지금까지 고친 것 가운데 화면 숫자나 문구, 리포트 내용이 바뀐 {n}건이에요. 날짜는 실제로 고친 날이고 리포트 정정은 그 호의 정정 상자에도 같은 내용이 있어요. 디자인이나 속도만 바뀐 수정은 싣지 않았어요.</p>
<h2>어떤 걸 고쳤나요?</h2>
<ol class="cx" reversed>{"".join(items)}</ol>
<h2>틀린 숫자를 보셨나요?</h2>
<p>구역 페이지 아래 「이 숫자가 틀렸어요」를 누르면 구역 번호가 자동으로 들어간 채 보낼 수 있어요. 다른 페이지라면 <a href="/contact">문의하기 양식</a>에 페이지 주소와 근거(기사·고시 링크)를 적어 주세요. 확인되면 고치고 이 페이지에 남겨요.</p>
<p>어떤 순서로 확인하는지는 <a href="/about#editorial">편집 원칙</a>에 적어 뒀어요.</p>
<section class="next-read" aria-labelledby="nr-h"><h2 id="nr-h">다음에 읽을 거리</h2><ul>
<li><a href="/about#editorial">숫자를 어떻게 만들고 확인하나 (편집 원칙)</a></li>
<li><a href="/method">계산 방법과 가정 전체</a></li>
<li><a href="/report/">월간 리포트 전체 목록</a></li>
</ul></section>'''
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "오류 수정 기록", "url": f"{SITE}/corrections", "inLanguage": "ko", "dateModified": "2026-10-27",
          "isPartOf": {"@type": "WebSite", "name": BRAND, "url": f"{SITE}/"}}
    desc = '이 사이트의 숫자·문구·리포트에서 틀린 곳을 언제, 무엇을, 어떻게 고쳤는지 날짜순으로 남긴 기록이에요.'
    return page('corrections', '오류 수정 기록 · 무엇을 언제 고쳤나', desc, body, ld, 'website')


# ================= about: 운영자 소개·편집 원칙 =================
OP_HTML = f'''<!--zp-op--><h2 id="operator">누가 만드나요?</h2>
<section class="op" aria-label="운영자 소개">
<div class="op-h"><span class="op-av" aria-hidden="true"><svg viewBox="13 6 38 54.27"><path fill="#fff" d="M33.500 50.370L45.435 38.435A19.0 19.0 0 1 0 18.565 38.435L30.500 50.370Q32.000 51.870 33.500 50.370Z"/><path fill="#1F3A87" d="M32 12.4L42.4 22.8H40.5V34.6H23.5V22.8H21.6Z"/><path fill="#F5C33B" d="M30.40 26.60H33.60A1.1 1.1 0 0 1 34.70 27.70V34.6H29.30V27.70A1.1 1.1 0 0 1 30.40 26.60Z"/><path fill="#F5C33B" d="M29.250 57.520a2.75 2.75 0 1 0 5.500 0a2.75 2.75 0 1 0 -5.500 0Z"/></svg></span><span><b>{PEN}</b><small>필명 · 개인 운영자 1인</small></span></div>
<p>부동산 데이터를 다루는 개인 한 명이 만들고 운영해요. 재개발 매물 소개가 늘 「지금 얼마면 들어간다」에서 끝나는 게 아쉬웠어요. 처음 드는 돈만 보고 들어가면 이주·입주 때 돈이 모자랄 수 있어서 「입주까지」를 기준으로 계산하게 됐어요.</p>
<p>운영자는 경매로 집을 한 번 낙찰받아 본 경험이 있어요. 2020년에는 평택에 전세를 끼고 집을 사려다 가족의 반대로 멈췄어요. 그때 「지금 얼마」만 보고 판단할 뻔했던 일이 이 사이트를 만든 직접적인 계기예요.</p>
<dl><dt>하는 일</dt><dd>자료 수집과 계산, 구역 글, 월간 리포트를 운영자 한 사람이 관리해요</dd>
<dt>관계</dt><dd>중개 사무소·조합·시공사와 관계가 없어요. 돈을 받고 특정 구역을 소개하지 않아요</dd>
<dt>공개하지 않는 것</dt><dd>실명·연락처는 싣지 않아요. 문의는 <a href="contact">문의하기 양식</a>으로 받고 운영자가 직접 읽어요</dd>
<dt>소식</dt><dd><a href="https://blog.naver.com/always_questions" rel="noopener">네이버 블로그</a> · 인스타그램 <a href="https://www.instagram.com/jaegaebal.ok/" rel="noopener">@jaegaebal.ok</a></dd></dl>
</section>
<p>이 사이트는 서울시·국토교통부 등 정부·공공기관과 무관한 비공식 정보 서비스예요. 공공 자료를 쓰고 출처를 밝히지만 자료를 낸 기관이 이 사이트를 운영하거나 내용을 보증하지는 않아요.</p>
<h2 id="editorial">숫자는 어떻게 만들고 누가 확인하나요?</h2>
<p>화면 숫자는 두 갈래로 만들어져요. 매일 자동으로 다시 계산하는 숫자와, 사람이 원문을 찾아 맞춰 본 글이에요. 구역 페이지와 가이드 맨 위 범례에서 <b>자동 계산</b>과 <b>사람 대조</b>로 나눠 표시해요.</p>
<ol class="flow">
<li><b>모으기</b> 매일 아침 공개 자료를 다시 받아요. 받지 못한 자료는 전날 것을 그대로 쓰고 기준일을 화면에 적어요.</li>
<li><b>같은 식으로 계산하기</b> 모든 구역을 같은 식과 같은 기본 가정으로 계산해요. 식과 가정은 <a href="method">계산 방법</a>에 다 적어 뒀어요.</li>
<li><b>화면끼리 맞춰 보기</b> 목록·구역 화면·구역 페이지·검색 결과가 같은 구역에서 같은 숫자를 보이는지 배포 전에 자동 검사로 전부 견줘요. 어긋나면 배포하지 않아요.</li>
<li><b>원문과 대조하기</b> 리포트에 싣는 인가는 한 건씩 기사나 구청·서울시 고시를 찾아 날짜를 맞춰요. 찾지 못한 건은 「원문 미확인」으로 그대로 표시해요. 손으로 쓴 구역 글도 같은 방식으로 기사·고시와 대조해요.</li>
<li><b>틀리면 고치고 남기기</b> 제보나 자체 검사로 틀린 걸 찾으면 고치고 <a href="corrections">오류 수정 기록</a>에 날짜와 함께 남겨요. 리포트는 발행일을 바꾸지 않고 그 호에 정정 상자를 달아요.</li>
</ol>
<p>숫자를 꾸며 넣지 않아요. 근거가 모자란 곳은 금액 대신 「계산 보류」로 두고 표본이 적으면 신뢰를 낮게 표시해요. 법 조항은 국가법령정보센터 원문으로 확인해요.</p>
<p class="meta">고침 주기: 자료와 계산은 매일 아침 · 월간 리포트는 매달 5일 무렵 · 구역 글과 가이드는 큰 변화(인가·고시)가 생기면 다시 써요.</p><!--/zp-op-->'''


def about():
    fp = os.path.join(PUB, 'about.html')
    h = open(fp, encoding='utf-8').read()
    # 이름 변경 안내 한 줄(첫 소개 문단 바로 뒤) — 예전 이름이 남는 허용 예외
    h = re.sub(r'<!--zp-rename-->.*?<!--/zp-rename-->', '', h, flags=re.S)
    m = re.search(r'<p class="lede">.*?</p>\s*<p>.*?</p>', h, re.S)
    if m: h = h[:m.end()] + f'<!--zp-rename--><p class="note" id="rename">{RENAME_NOTE} 새 이름 {BRAND}은 재개발과 「각 나왔다」를 합친 말이에요.</p><!--/zp-rename-->' + h[m.end():]
    if '<!--zp-op-->' in h:
        h2 = re.sub(r'<!--zp-op-->.*?<!--/zp-op-->', lambda m: OP_HTML, h, count=1, flags=re.S)
    else:   # 처음 한 번: 예전 '누가 운영하나' 덩이(제목 ~ 운영 정보 목록)를 바꿔 끼운다
        h2 = re.sub(r'<h2>누가 운영하나</h2>.*?<ul class="meta-list">.*?</ul>', lambda m: OP_HTML, h, count=1, flags=re.S)
    if h2 != open(fp, encoding='utf-8').read(): open(fp, 'w', encoding='utf-8').write(h2); return True
    return False


def main():
    n = 0
    n += keep(os.path.join(PUB, 'glossary.html'), glossary())
    n += keep(os.path.join(PUB, 'corrections.html'), corrections())
    n += about()
    print('trust pages:', n, 'changed ·', len(TERMS), 'terms ·', len(FIXES), 'fixes')


if __name__ == '__main__':
    main()
