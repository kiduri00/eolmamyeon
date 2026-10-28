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
from brand import BRAND, BRAND_EN, SITE_TAIL, TAGLINE, ICON_LINKS, wordmark_svg   # 서비스 이름은 tools/brand.py 한 곳에서
from brand import EDITOR   # 글쓴이 = '<이름> 편집'(2026-10-27 오너: 개인 운영자 소개·필명 없이)
OP = EDITOR
_JE = lambda w: w + ('은' if (ord(w[-1]) - 0xAC00) % 28 else '는') if '가' <= w[-1] <= '힣' else w + '는'   # 받침 따라 은/는
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
    ('2026-10-27', '', '자료', '지하철역 위치와 대형마트 목록을 공공데이터로 바꿨어요',
     '역 좌표를 출처가 분명하지 않은 정리본에서 가져와 서원역(2.4km)·석촌고분역(1.7km)처럼 크게 어긋난 역이 있었어요. 아직 개통하지 않은 계획 역 5곳이 「가까운 역」으로 나왔어요. 대형마트 목록은 비영리 조건이 붙은 위키 문서였어요.',
     '역 좌표는 서울시 역사마스터 정보로, 대형마트는 서울시 대규모점포 인허가 정보로 바꿨어요. 계획 역은 가까운 역 후보에서 뺐어요. 빠져 있던 마트 15곳도 더해졌어요.', '가까운 역·도보 시간·입지 점수·<a href="/about#sources">자료 출처</a>'),
    # 사이클 4 통합(오너): 이름 변경 항목은 뺐다(예전 이름 흔적 없이)
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


# ================= about: 편집 원칙(2026-10-27 오너: 개인 운영자 소개 없음) =================
OP_HTML = f'''<!--zp-op--><span id="operator"></span><span id="editorial"></span><h2 id="principles">{BRAND}의 숫자는 어떻게 만들고 확인하나요?</h2>
<p>화면 숫자는 두 갈래로 만들어져요. 매일 자동으로 다시 계산하는 숫자와, 사람이 원문을 찾아 맞춰 본 글이에요. 구역 페이지와 가이드 맨 위 범례에서 <b>자동 계산</b>과 <b>사람 대조</b>로 나눠 표시해요.</p>
<ol class="flow">
<li><b>모으기</b> 매일 아침 공개 자료를 다시 받아요. 받지 못한 자료는 전날 것을 그대로 쓰고 기준일을 화면에 적어요.</li>
<li><b>같은 식으로 계산하기</b> 모든 구역을 같은 식과 같은 기본 가정으로 계산해요. 식과 가정은 <a href="method">계산 방법</a>에 다 적어 뒀어요.</li>
<li><b>화면끼리 맞춰 보기</b> 목록·구역 화면·구역 페이지·검색 결과가 같은 구역에서 같은 숫자를 보이는지 배포 전에 자동 검사로 전부 견줘요. 어긋나면 배포하지 않아요.</li>
<li><b>원문과 대조하기</b> 리포트에 싣는 인가는 한 건씩 기사나 구청·서울시 고시를 찾아 날짜를 맞춰요. 찾지 못한 건은 「원문 미확인」으로 그대로 표시해요. 손으로 쓴 구역 글도 같은 방식으로 기사·고시와 대조해요.</li>
<li><b>틀리면 고치고 남기기</b> 제보나 자체 검사로 틀린 걸 찾으면 고치고 <a href="corrections">오류 수정 기록</a>에 날짜와 함께 남겨요. 리포트는 발행일을 바꾸지 않고 그 호에 정정 상자를 달아요.</li>
</ol>
<p>숫자를 꾸며 넣지 않아요. 근거가 모자란 곳은 금액 대신 「계산 보류」로 두고 표본이 적으면 신뢰를 낮게 표시해요. 법 조항은 국가법령정보센터 원문으로 확인해요.</p>
<p class="meta">고침 주기: 자료와 계산은 매일 아침 · 월간 리포트는 매달 5일 무렵 · 구역 글과 가이드는 큰 변화(인가·고시)가 생기면 다시 써요. 고친 내용은 <a href="corrections">오류 수정 기록</a>에 남겨요.</p>
<p>{_JE(BRAND)} 소규모로 운영돼요. 글쓴이 줄의 「{EDITOR}」은 이 편집 원칙에 따라 자료를 모으고 대조한다는 뜻이에요. 중개 사무소·조합·시공사와는 관계가 없고 돈을 받고 특정 구역을 소개하지 않아요. 문의는 <a href="contact">문의하기 양식</a>으로 받아요.</p>
<p>{_JE(BRAND)} 서울시·국토교통부 등 정부·공공기관과 무관한 비공식 정보 서비스예요. 공공 자료를 쓰고 출처를 밝히지만 자료를 낸 기관이 이 서비스를 운영하거나 내용을 보증하지는 않아요.</p><!--/zp-op-->'''


# ================= about: 자료 출처와 이용조건 (renew-infra docs/sources.md 2026-10-27 내용을 쉬운 말로) =================
KOGL1 = '공공누리 제1유형: 출처만 밝히면 상업적 이용·변경 가능'
SOURCES = [
    ('정비사업 정보몽땅', 'https://cleanup.seoul.go.kr/cleanup/bsnssttus/lscrMainIndx.do', '서울시', '공개 웹페이지(별도 개방 라이선스 표시 없음). 사업장·단계·인가일 같은 사실 정보만 쓰고 출처를 링크해요', '구역 목록, 단계, 인가 날짜, 추진경과, 조합 정보', '매일'),
    ('신속통합기획·모아타운 현황', 'https://cleanup.seoul.go.kr/cleanup/view/publicIntgrPlanSttn.do', '서울시', '정보몽땅과 같아요', '후보지·대상지 목록', '수시'),
    ('부동산 실거래가 정보(OA-21275)', 'https://data.seoul.go.kr/dataList/OA-21275/S/1/datasetView.do', '서울 열린데이터광장 · 국토교통부 실거래가', KOGL1, '매매 실거래, 대지 3.3㎡당 가격, 계산 매수가 표본', '매일'),
    ('부동산 전월세가 정보(OA-21276)', 'https://data.seoul.go.kr/dataList/OA-21276/S/1/datasetView.do', '서울 열린데이터광장', KOGL1, '전세가, 전세 끼고 필요한 돈', '매일'),
    ('건축물대장 총괄표제부(OA-23051)', 'https://data.seoul.go.kr/dataList/OA-23051/S/1/datasetView.do', '서울 열린데이터광장', KOGL1, '용적률, 세대수, 사용승인일(노후도)', '매주'),
    ('상권분석서비스(OA-15560·15572·15577)', 'https://data.seoul.go.kr/dataList/OA-15577/S/1/datasetView.do', '서울 열린데이터광장', KOGL1, '주변 상권(점포 수, 학원 수, 분기 매출)', '매주'),
    ('역사마스터 정보(OA-21232)', 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do', '서울 열린데이터광장 · 서울교통공사·서울시', KOGL1, '역 좌표, 가까운 역, 도보 시간, 지도의 역 점', '개통·역 이름이 바뀔 때'),
    ('대규모점포 인허가 정보(OA-16096)', 'https://data.seoul.go.kr/dataList/OA-16096/S/1/datasetView.do', '서울 열린데이터광장 · 지방행정 인허가', KOGL1, '대형마트 영업 여부와 위치(생활 인프라·입지 점수)', '분기'),
    ('서울 도시계획포털(정비구역·연속지적)', 'https://urban.seoul.go.kr', '서울시', '공개 지도 서비스(별도 개방 라이선스 표시 없음). 사실 정보만 쓰고 출처를 링크해요', '구역 경계, 필지 위치, 개별공시지가', '매주'),
    ('서울 부동산정보광장(토지거래허가 내역)', 'https://land.seoul.go.kr', '서울시', '공개 웹페이지. 사실 정보만 쓰고 출처를 링크해요', '토지거래허가 판정과 건수', '매일'),
    ('공시가격 알리미', 'https://www.realtyprice.kr', '국토교통부', '공개 웹페이지', '개별공시지가 기준연도 확인', '해마다'),
    ('법원경매정보', 'https://www.courtauction.go.kr', '법원행정처', '이용약관을 따르고 사람 이름은 싣지 않아요', '구역 안 경매 물건', '매일'),
    ('상급종합병원 지정(제5기, 2024.1.1~2026.12.31)', 'https://www.mohw.go.kr', '보건복지부', '정부가 공고한 사실 정보', '대형병원(상급종합) 위치', '지정 기간마다'),
    ('OpenStreetMap', 'https://www.openstreetmap.org/copyright', 'OpenStreetMap contributors', 'ODbL 1.0(출처 표시 · 데이터베이스는 같은 조건으로)', '학교·병원·대형마트 위치, 한강 수면', '손으로(2026.10.1)'),
    ('OpenFreeMap 지도 타일', 'https://openfreemap.org', 'OpenFreeMap · OpenMapTiles', '서비스는 MIT, 지도 데이터는 ODbL. 지도 화면에 출처가 자동으로 붙어요', '배경 지도', '실시간'),
    ('seoul-maps 행정구역 경계', 'https://github.com/southkorea/seoul-maps', 'Lucy Park 정리 · 통계청 2013 센서스 경계', 'Apache 2.0', '첫 화면 지도의 자치구 경계', '고정'),
    ('국가법령정보센터', 'https://www.law.go.kr', '법제처', '법령은 저작권 보호 대상이 아니에요(저작권법 제7조)', '도시정비법·소규모주택정비법·조례 요약과 조항 링크', '법이 바뀔 때'),
    ('언론 기사·보도자료', '', '각 언론사·서울시', '링크와 사실 인용만 해요. 본문은 옮기지 않아요', '구역 소식, 날짜 대조', '수시'),
]


def sources_html():
    rows = ''.join(
        f'<tr><td class="t" data-l="자료">{f"<a href=\"{u}\" target=\"_blank\" rel=\"noopener\">{esc(n)}</a>" if u else esc(n)}<small class="meta" style="display:block">{esc(by)}</small></td>'
        f'<td data-l="이용조건">{esc(lic)}</td><td data-l="쓰는 곳">{esc(use)}</td><td data-l="갱신">{esc(cyc)}</td></tr>'
        for n, u, by, lic, use, cyc in SOURCES)
    return ('<!--zp-src--><h2 id="sources">어떤 자료를 쓰고 이용조건은 무엇인가요?</h2>'
            '<p>모두 누구나 볼 수 있는 공개 자료예요. 사이트 숫자는 이 자료를 모아 같은 기준으로 다시 계산한 값이에요. 서울 열린데이터광장 자료는 대부분 공공누리 제1유형이라 출처를 밝히면 광고가 붙은 사이트에서도 쓸 수 있어요.</p>'
            f'<div class="tw cards"><table><thead><tr><th>자료</th><th>이용조건</th><th>쓰는 곳</th><th>갱신</th></tr></thead><tbody>{rows}</tbody></table></div>'
            '<h3>2026년 10월에 바꾼 자료는 무엇인가요?</h3>'
            '<p><b>지하철역 위치</b>는 출처와 이용조건이 분명하지 않은 개인 정리본을 쓰다가, 서울시 역사마스터 정보로 모두 바꿨어요. 예전 좌표 가운데 서원역은 2.4km, 석촌고분역은 1.7km 어긋나 있었어요. 아직 개통하지 않은 계획 역 5곳이 「가까운 역」으로 나오던 것도 뺐어요.</p>'
            '<p><b>대형마트 목록</b>은 비영리 조건(CC BY-NC-SA)이 붙은 위키 문서를 쓰다가, 서울시 대규모점포 인허가 정보로 영업 여부를 확인하는 방식으로 바꿨어요. 이때 빠져 있던 매장 15곳이 더해졌어요.</p>'
            f'<p class="meta">출처 표시: 서울 열린데이터광장 자료(실거래가·전월세가·건축물대장·상권분석·역사마스터·대규모점포 인허가)는 공공누리 제1유형 조건에 따라 출처를 밝혀요. 지도와 생활 인프라 위치는 © OpenStreetMap contributors(ODbL), © OpenMapTiles를 이용해요. {_JE(BRAND)} 서울시·국토교통부와 관계없는 비공식 정보 서비스예요.</p><!--/zp-src-->')


def about():
    fp = os.path.join(PUB, 'about.html')
    h = open(fp, encoding='utf-8').read()
    # 사이클 4 통합(오너 'Pick 콘셉트'): 예전 이름 안내 한 줄은 넣지 않고, 남아 있으면 지운다
    h = re.sub(r'<!--zp-rename-->.*?<!--/zp-rename-->', '', h, flags=re.S)
    h = re.sub(r'<p class="byline">정리: (?:<a [^>]*>)?[^<·]*?(?:운영자|편집)(?:</a>)?', f'<p class="byline">정리: <a href="#principles">{EDITOR}</a>', h, count=1)   # 글쓴이 = 브랜드 편집
    if '<!--zp-op-->' in h:
        h2 = re.sub(r'<!--zp-op-->.*?<!--/zp-op-->', lambda m: OP_HTML, h, count=1, flags=re.S)
    else:   # 처음 한 번: 예전 '누가 운영하나' 덩이(제목 ~ 운영 정보 목록)를 바꿔 끼운다
        h2 = re.sub(r'<h2>누가 운영하나</h2>.*?<ul class="meta-list">.*?</ul>', lambda m: OP_HTML, h, count=1, flags=re.S)
    # 자료 출처와 이용조건(처음 한 번은 예전 '어떤 자료를 쓰나요?' 제목 ~ 표를 바꿔 끼움)
    if '<!--zp-src-->' in h2: h2 = re.sub(r'<!--zp-src-->.*?<!--/zp-src-->', lambda m: sources_html(), h2, count=1, flags=re.S)
    else: h2 = re.sub(r'<h2>어떤 자료를 쓰나요\?</h2>.*?</table></div>', lambda m: sources_html(), h2, count=1, flags=re.S)
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
