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
TXX = J('public/data/tx.json', {}) or {}   # 구역별 실거래 상세: x.hd = 화면 머리글과 같은 기준(tools/tx.py)
HDB = {'i': ('입주권 전용 3.3㎡당', '아파트 입주권'), 'a': ('아파트 전용 3.3㎡당', '아파트 매매'), 'v': ('대지 3.3㎡당', '빌라·단독 매매')}
def short(n):
    n = re.sub(r'^\s*(\(가칭\)|\[임시\]|\(임시\))\s*', '', n)
    n = re.sub(r'\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발|도시환경|도시정비형)?\s*(정비)?(사업)?\s*(조합|추진위원회|조합설립추진위원회|주민대표회의)?\s*$', '', n).strip()
    return n or n
def josa(w):
    c = w[-1] if w else ''
    if '가' <= c <= '힣': return '은' if (ord(c) - 0xAC00) % 28 else '는'
    return '은' if c in '0136789' else '는'
def eok(v, d=1):
    if v is None: return '–'
    return f"{v:.{d}f}억".replace('.0억', '억') if v < 100 else f"{v:,.0f}억"
def man(v):
    if v is None: return '–'
    return f"{v/10000:.1f}억".replace('.0억', '억') if v >= 10000 else f"{v:,.0f}만원"
KIND = {'재개발': '재개발', '재건축': '재건축', '도시정비형 재개발': '도시정비형 재개발', '가로주택(모아주택)': '가로주택정비', '소규모재건축': '소규모재건축', '소규모재개발': '소규모재개발'}
DTK = [('구역지정', '정비구역 지정'), ('추진위', '추진위원회 승인'), ('조합설립', '조합설립인가'), ('시행자지정', '사업시행자 지정'), ('사업시행', '사업시행인가'), ('관리처분', '관리처분인가'), ('착공', '착공'), ('준공', '준공')]
SKEY = {2: ('구역지정',), 3: ('추진위',), 4: ('조합설립', '시행자지정'), 5: ('사업시행',), 6: ('관리처분',), 7: ('관리처분',), 8: ('착공',)}
PSRC = {'villa': '빌라 실거래 가운데 값', 'complex': '단지 실거래 가운데 값', 'apt': '단지 실거래 가운데 값', 'est': '구 평균 시세로 추정'}
def gapWhy(c):   # 전세 끼고 계산이 안 되는 이유(화면 gapBlock과 같은 문구에서) → (표 칸 짧은 말, 설명)
    b = str(c.get('gapBlock') or '')
    if b.startswith('전세 낀 매수 불가'): return ('토허제', '토지거래허가구역이라 불가(2년 실거주)')
    if b.startswith('이주·철거'): return ('세입자 없음', '이주·철거가 시작돼 세입자가 없어요')
    if b.startswith('입주권 없음'): return ('입주권 없음', b.split('·')[-1].strip() + '라 입주권이 없어요')
    if b.startswith('입주권 판정 보류'): return ('판정 보류', '입주권 판정 자료가 부족해요')
    if b == '계산 대상 아님': return ('계산 안 함', '아파트 입주권 계산 대상이 아니에요')
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
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" crossorigin>
<link rel="stylesheet" href="../pages.css">
<script type="application/ld+json">{ld}</script>
</head>
<body>
<header class="top"><div class="in"><a class="logo" href="../" aria-label="집핀 처음으로"><img class="logo-i" src="/icon.svg" width="28" height="28" alt=""><span class="logo-t">집핀</span><small class="logo-s">서울 재개발 지도</small></a><nav aria-label="사이트 메뉴"><a href="../">계산기</a><a href="../report/">월간 리포트</a><a href="../z/" aria-current="page">구역별 페이지</a><a href="../guide/">가이드·분석</a></nav></div></header>
<main>
'''
FOOT = '''</main>
<footer class="f"><p><a href="../report/">월간 리포트</a> · <a href="../z/">구역별 페이지</a> · <a href="../guide/">가이드·분석</a> · <a href="../years">몇 년 걸리나</a> · <a href="../about">소개</a> · <a href="../contact">문의하기</a> · <a href="../method">출처·계산 방법</a> · <a href="../terms">이용약관</a> · <a href="../privacy"><b>개인정보처리방침</b></a> · <a href="https://blog.naver.com/always_questions" rel="noopener">블로그</a></p><p class="f-c">© 2026 집핀 · 데이터 기준 {upd}</p></footer>
</body>
</html>
'''
def is_hand(rid):
    f = os.path.join(ZD, rid + '.html')
    return os.path.exists(f) and 'name="emr-auto"' not in open(f, encoding='utf-8').read(3000)
def page(r):
    rid = r['id']; pm = P.get(rid) or {}; c = C.get(rid) or {}; t = r.get('tx') or {}
    nm = short(r['n']); kind = KIND.get(r['k'], r['k']); stage = c.get('stage') or r.get('sr') or ''
    dt = pm.get('dt') or {}
    title = f"{nm} {kind} 진행 단계·실거래·입주까지 필요한 현금 | 집핀 - 서울 재개발 지도"
    desc = f"{r['g']} {nm} {kind}: 지금 {stage} 단계. 구역 안 실거래, 노후도, 권리산정기준일, 정보몽땅 추진경과, 기본 가정의 입주까지 필요한 현금 추정. 데이터 기준 {UPD}."
    url = f"{SITE}/z/{rid}"
    ld = json.dumps({"@context": "https://schema.org", "@type": "Article", "headline": f"{nm} {kind} 진행 단계와 입주까지 필요한 현금", "description": desc, "inLanguage": "ko", "dateModified": UPD.replace('.', '-'),
                     "mainEntityOfPage": url, "author": {"@type": "Person", "name": "집핀 운영자", "url": f"{SITE}/about"}, "publisher": {"@type": "Organization", "name": "집핀", "url": SITE}}, ensure_ascii=False)
    o = [HEAD.format(title=esc(title), desc=esc(desc), url=url, site=SITE, ld=ld)]
    o.append(f'<p class="eyebrow">{esc(r["g"])} {esc(r.get("j") or r.get("dg") or "")} · {esc(kind)} · 데이터 기준 {UPD}</p>')
    o.append(f'<h1>{esc(nm)} {esc(kind)} 진행 단계와 입주까지 필요한 현금</h1>')
    # 현재 단계의 인가·고시일만 쓴다(예전엔 기록 중 가장 늦은 날짜를 써서 '착공' 구역에 관리처분일이 붙었다 · o747)
    sk = SKEY.get(r.get('s', 0)) or ()
    sd = next((dt[k] for k in sk if dt.get(k)), '')[:7].replace('-', '.')
    prevd = next(((lab, dt[k]) for k, lab in reversed(DTK) if dt.get(k) and k not in sk), None) if not sd else None
    lede = f"{esc(nm)}{josa(nm)} 지금 <b>{esc(stage)}</b> 단계예요" + (f" ({sd} 인가·고시)." if sd else ".")
    stl = r.get('stale')
    if stl: lede += f" 다만 {esc(stl['why'])}. 준공됐는지 멈췄는지 자료로 확인되지 않아 준공 가능성과 입주 시점은 싣지 않았어요."
    elif c.get('p10') is not None: lede += f" 서울 사업장 기록으로 낸 10년 안 준공 가능성은 약 {min(97, round(c['p10'] * 100))}%예요(예측이 아닌 통계)."
    o.append(f'<p class="lede">{lede} 아래 숫자는 무주택·84㎡ 기본 가정이고, 첫 화면 계산기와 같은 <b>전세 끼고 사는</b> 기준이에요. 내 조건은 <a href="../#{rid}">계산기에서 이 구역 열기</a>로 바꿔 볼 수 있어요.</p>')
    k = []
    k.append(('현재 단계', esc(stage), f'{sd} 인가·고시' if sd else ('진행 확인 필요' if stl else '아직 구역지정 전이라 인가일이 없어요' if r.get('s', 0) <= 1 else f'이 단계 인가일 기록 없음 · 직전 {prevd[0]} {prevd[1][:7].replace("-", ".")}' if prevd else '이 단계 인가일 기록 없음')))
    if c.get('gapOk') and c.get('gapTotal') is not None:   # 첫 화면 기본 모드(전세 끼고)와 같은 숫자
        k.append(('전세 끼고 입주까지', eok(c['gapTotal']), f'지금 {eok(c.get("gapNow"))} · 매수가 {eok(c.get("price"))}({PSRC.get(c.get("priceSrc"), "실거래 가운데 값")})' + (f' · 현금으로 사면 {eok(c["need"])}' if c.get('cashOk') and c.get('need') is not None else '')))
    elif c.get('need') is not None and r.get('tag') != 'mk' and r.get('nx') != 'mk': k.append(('현금으로 사면 입주까지', eok(c['need']), f'기본 가정 · 매수가 {eok(c.get("price"))} 기준' + (f' · 전세 끼고는 {esc(gapWhy(c)[1])}' if gapWhy(c) else '')))
    elif c.get('winT'): k.append(('입주권', esc(c['winT']), '기본 가정 판정'))
    if c.get('st'): k.append(('가까운 역', f"{esc(c['st']['n'])} 도보 {max(1, round(c['st']['d'] * 1.3 / 67))}분", ' · '.join(esc(x) for x in (c.get('ln') or [])[:3])))
    if c.get('owners'): k.append(('토지등소유자', f"{int(c['owners']):,}명", f"구역 면적 {int((r.get('sm') or {}).get('area') or 0):,}㎡" if (r.get('sm') or {}).get('area') else ''))
    o.append('<div class="kpis">' + ''.join(f'<div class="kpi"><span>{a}</span><b>{b}</b><small>{s}</small></div>' for a, b, s in k) + '</div>')
    # 인가 이력
    hist = [(lab, dt[key]) for key, lab in DTK if dt.get(key)]
    if hist:
        o.append('<h2>인가 이력</h2><ul class="steps">' + ''.join(f'<li class="{"cur" if i == len(hist) - 1 else ""}"><b>{esc(l)}</b><span>{esc(d[:10].replace("-", "."))}</span></li>' for i, (l, d) in enumerate(hist)) + '</ul>')
    ev = [e for e in (pm.get('ev') or []) if e and e[0] <= datetime.date.today().isoformat()][:6]
    if ev:
        o.append('<h3>정보몽땅 최근 기록</h3><ul class="steps tl">' + ''.join(f'<li><b>{esc(d.replace("-", "."))}</b><span>{esc(sec)} · {esc(re.sub(r"^\[([^]]*)\]\s*(.*)$", lambda m: m.group(1) + (" · " + m.group(2) if m.group(2) else ""), tx))}</span></li>' for d, sec, tx in ev) + '</ul>')
    # 실거래
    if t.get('n') or t.get('jn'):
        rows = []
        hd = ((TXX.get(rid) or {}).get('x') or {}).get('hd')
        if hd:   # 화면 머리글과 같은 기준·기간·건수
            lab, what = HDB[hd['b']]; f, to = hd['from'], hd['to']
            per = f"가장 최근 1건({to[:4]}.{to[4:6]})" if hd['w'] == 0 else f"최근 {hd['w']}개월 {hd['n']}건({f[2:4]}.{f[4:6]}~{to[2:4]}.{to[4:6]})"
            rows.append((lab, man(hd['u']), f"{what} · {per}" + (f" · 시세와 크게 다른 {hd['xo']}건 제외" if hd['xo'] else '')))
        elif t.get('pp'): rows.append(('대지 3.3㎡당', man(t['pp']), f"빌라·단독 매매 {t.get('nv', t.get('n', 0))}건 · 2024년~"))
        if c.get('price') is not None and c.get('priceSrc') in PSRC:   # 화면 계산기 '매수가'와 같은 값(calc.json) — 한 구역에 '가운데 값'은 이것 하나만
            en = (r.get('mk') or {}).get('entry') or {}
            rows.append(('계산에 쓴 매수가', eok(c['price']), f"{PSRC[c['priceSrc']]}" + (f" · {en['n']}건" if en.get('n') else '') + (f" · 전용 {en['area_med']:g}㎡ 안팎" if en.get('area_med') else '') + (f" · {esc(en['scope'])}" if en.get('scope') else '')))
        elif t.get('med'): rows.append(('빌라 매매', man(t['med']), f"2015년 이전 준공 · 최근 {t.get('nwin', 18)}개월 {t.get('no', 0)}건 · 전용 {t.get('ar', '–')}㎡"))
        if t.get('im'): rows.append(('입주권 매매', man(t['im']), f"아파트 입주권 · 최근 {t.get('iw', 12)}개월 {t.get('in', 0)}건"))
        if t.get('jm'): rows.append(('빌라 전세', man(t['jm']), f"전세 {t.get('jn', 0)}건 · 임대 {t.get('ja', '–')}㎡"))
        if t.get('n12') is not None: rows.append(('12개월 거래', f"{t['n12']}건", '빌라·단독·아파트 · 계약일 기준'))
        if t.get('yoy') is not None: rows.append(('1년 변화', f"{'+' if t['yoy'] > 0 else ''}{t['yoy']}%", f"표본 {t['yon'][0]}/{t['yon'][1]}건 · 한 건물 쏠림 제외"))
        if rows:
            o.append(f'<h2>구역 안 실거래 <small class="meta">국토교통부·서울시 실거래 · {TXD[:4]}.{TXD[4:6]}.{TXD[6:]}까지</small></h2><table class="ov"><tbody>' + ''.join(f'<tr><th scope="row">{a}</th><td><b>{b}</b><br><small class="meta">가운데 값 · {s}</small></td></tr>' if a in ('대지 3.3㎡당', '입주권 전용 3.3㎡당', '아파트 전용 3.3㎡당', '빌라 매매', '입주권 매매', '빌라 전세') else f'<tr><th scope="row">{a}</th><td><b>{b}</b><br><small class="meta">{s}</small></td></tr>' for a, b, s in rows) + '</tbody></table>')
    if t.get('old') and r.get('s', 0) < 7:
        x = t['old']
        o.append(f'<h2>노후도 <small class="meta">경계 안 건축물 {x["n"]:,}동 · 사용승인연도 확인 {x["k"]:,}동 · 서울도시공간포털 건물 레이어</small></h2><p>노후·불량 건축물 비율 <b>{x["pol"]}%</b>(철근콘크리트 30년·그 밖 20년 기준), 30년 넘은 건물 {x["p30"]}%, 평균 {x["avg"]}년이에요. 서울 재개발 구역지정 요건(노후도 60% 이상)과 비교해 보세요.</p>')
    if r.get('rdx'):
        x = r['rdx']
        o.append(f'<h2>권리산정기준일</h2><p><b>{esc(x.get("d"))}</b> · {esc(x.get("b"))}. 이날 뒤에 새로 짓거나 쪼갠 지분은 입주권이 안 나오거나 나눠 받을 수 있어요. <a href="{esc(x.get("u"))}" target="_blank" rel="noopener nofollow">근거</a></p>')
    th = (TH.get('z') or {}).get(rid)
    if th:
        o.append(f'<h2>토지거래허가 최근 내역 <small class="meta">서울부동산정보광장 · {esc(TH["since"].replace("-", "."))}~{esc(TH["asOf"].replace("-", "."))}</small></h2><p>구역 경계 안 필지로 <b>{th["n"]}건</b>이 허가됐어요(최근 30일 {th["n30"]}건, 주거용 {th["res"]}건). 주거용 허가는 2년 실거주 의무가 붙어 전세를 끼고 살 수 없어요.</p><ul class="steps tl">' + ''.join(f'<li><b>{esc(d.replace("-", "."))}</b><span>{esc(jb)} · {esc(jm)} · {esc(use)}{"" if res == "허가" else " · " + esc(res)}</span></li>' for d, jb, jm, use, res in th['r'][:5]) + '</ul>')
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
    o.append(f'<p class="note">이 페이지는 공개 자료로 매일 자동 갱신돼요. 계산은 시세 상승 0%·기본 비례율 같은 가정이 들어간 추정이고 투자 권유가 아니에요. 입주권 자격과 토지거래허가는 계약 전에 조합·구청에서 확인하세요. <a href="../method">계산 방법</a></p>')
    o.append(FOOT.format(upd=UPD))
    return ''.join(o)
R = [r for r in D['recs'] if not (r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7)) and r.get('src') != 'moa' and r.get('n')]   # 화면의 '진행 중'과 같은 기준
_ALL = {r['id'] for r in D['recs']}
for f in os.listdir(ZD):   # 자료에서 빠진 구역(시험 등록 등)의 자동 페이지는 지운다(손으로 쓴 페이지는 둔다)
    if f.endswith('.html') and f != 'index.html' and f[:-5] not in _ALL and not is_hand(f[:-5]): os.remove(os.path.join(ZD, f)); print('  removed stale page', f)
PAGES = {r['id'] for r in R} | {f[:-5] for f in os.listdir(ZD) if f.endswith('.html') and f != 'index.html'}
made = kept = 0
for r in R:
    if is_hand(r['id']): kept += 1; continue
    open(os.path.join(ZD, r['id'] + '.html'), 'w', encoding='utf-8').write(page(r)); made += 1
# 목록 페이지: 손으로 쓴 정리 페이지를 위에, 나머지는 구별로
hand = [r for r in D['recs'] if is_hand(r['id'])]
byg = collections.defaultdict(list)
for r in R: byg[r['g']].append(r)
li = lambda x: f'<a class="zl" href="{x["id"]}">{esc(short(x["n"]))}<small>{esc(KIND.get(x["k"], x["k"]))} · {esc((C.get(x["id"]) or {}).get("stage") or x.get("sr") or "")}</small></a>'
idx = [HEAD.format(title='서울 정비사업 구역별 페이지 | 집핀 - 서울 재개발 지도', desc=f'서울 진행 중 정비사업 {len(R)}곳의 구역별 진행 단계·실거래·노후도·입주까지 필요한 현금. 데이터 기준 {UPD}.', url=f'{SITE}/z/', site=SITE,
                  ld=json.dumps({"@context": "https://schema.org", "@type": "CollectionPage", "name": "서울 정비사업 구역별 페이지", "url": f"{SITE}/z/"}, ensure_ascii=False)).replace('<meta name="emr-auto" content="1">\n', '')]
idx.append(f'<p class="eyebrow">구역별 페이지 · 데이터 기준 {UPD}</p><h1>서울 정비사업 구역별 페이지</h1><p class="lede">서울에서 진행 중인 재개발·재건축·가로주택 {len(R)}곳을 구역마다 한 페이지로 정리했어요. 진행 단계와 인가 이력, 구역 안 실거래, 노후도, 권리산정기준일, 기본 가정의 입주까지 필요한 현금이 있어요. 매일 자동 갱신돼요.</p>')
if hand: idx.append('<h2>기사·고시로 대조해 정리한 구역</h2><p>규모가 커서 확인할 거리가 많은 구역은 기사·고시와 정보몽땅 등록값을 대조한 이야기를 붙였어요.</p><div class="grid2">' + ''.join(li(x) for x in hand if x['id'] in {y['id'] for y in R}) + '</div>')
for g in sorted(byg): idx.append(f'<h2><a href="../gu/{esc(g)}">{esc(g)}</a> <small class="meta">{len(byg[g])}곳</small></h2><div class="grid2">' + ''.join(li(x) for x in sorted(byg[g], key=lambda x: -x.get('s', 0))) + '</div>')
idx.append(FOOT.format(upd=UPD))
open(os.path.join(ZD, 'index.html'), 'w', encoding='utf-8').write(''.join(idx))
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
    title = f'{g} 재개발·재건축 {len(L)}곳 · 진행 단계와 필요한 돈 | 집핀 - 서울 재개발 지도'
    desc = f'{g}에서 진행 중인 정비사업 {len(L)}곳. ' + (f'전세 끼고 가장 적은 돈으로 살 수 있는 곳은 {short(cheap[0]["n"])}(지금 {eok(c(cheap[0])["gapNow"])}). ' if cheap else '') + f'데이터 기준 {UPD}.'
    ld = json.dumps({"@context": "https://schema.org", "@type": "CollectionPage", "name": f"{g} 정비사업", "url": url}, ensure_ascii=False)
    o = [HEAD.format(title=esc(title), desc=esc(desc), url=url, site=SITE, ld=ld).replace(' aria-current="page"', '')]
    o.append(f'<p class="eyebrow"><a href="./">구역별 페이지</a> · 데이터 기준 {UPD}</p><h1>{esc(g)} 재개발·재건축 {len(L)}곳</h1>')
    o.append('<p class="lede">' + ' · '.join(f'{esc(k)} {v}곳' for k, v in st.most_common(6) if k) + '</p>')
    if cheap: o.append('<p>전세 끼고 적은 돈으로 시작할 수 있는 곳: ' + ', '.join(f'<a href="{x["id"]}">{esc(short(x["n"]))}</a> {eok(c(x)["gapNow"])}' for x in cheap) + f'. <a href="../#map-{esc(g)}">지도에서 내 돈으로 보기 →</a></p>')
    def rowkey(x):   # 숫자가 있는 줄 먼저(전세 끼고 지금 적은 순 → 현금만 있는 줄), 숫자 없는 줄은 뒤에 단계순
        v = c(x)
        if v.get('gapOk') and v.get('gapNow') is not None: return (0, v['gapNow'], short(x['n']))
        if v.get('cashOk') and v.get('need') is not None: return (1, v['need'], short(x['n']))
        return (2, -x.get('s', 0), short(x['n']))
    rows = ''.join(f'<tr><td><a href="{x["id"]}">{esc(short(x["n"]))}</a><br><small>{esc(KIND.get(x["k"], x["k"]))} · {esc(c(x).get("stage") or x.get("sr") or "")}</small></td><td class="n">{eok(c(x).get("gapNow")) if c(x).get("gapOk") else ('<small>' + gapWhy(c(x))[0] + '</small>' if gapWhy(c(x)) else "–")}</td><td class="n">{eok(c(x).get("need")) if c(x).get("cashOk") else "–"}</td></tr>' for x in sorted(L, key=rowkey))
    o.append(f'<div class="tw"><table class="t" style="min-width:0;width:100%"><thead><tr><th>구역</th><th class="n">전세 끼고 지금</th><th class="n">입주까지 현금</th></tr></thead><tbody>{rows}</tbody></table></div>')
    why = collections.Counter(gapWhy(c(x))[0] for x in L if not c(x).get('gapOk') and gapWhy(c(x)))
    EXP = {'토허제': '토지거래허가구역이라 사면 2년 실거주해야 해서 전세를 끼고 살 수 없어요', '세입자 없음': '이주·철거가 시작돼 전세를 낄 세입자가 없어요(입주권으로 사야 해요)',
           '입주권 없음': '지금 사면 입주권이 안 나오는 시점이에요(조합설립인가 등 이후 매수분)', '판정 보류': '입주권이 나오는지 판단할 자료가 부족해요', '계산 안 함': '상가·업무 중심 사업 등 아파트 입주권 계산 대상이 아니에요'}
    if why: o.append('<p class="meta">전세 끼고 칸이 비어 있는 이유: ' + ' · '.join(f'<b>{k}</b>({v}곳) {EXP[k]}' for k, v in why.most_common()) + '. –는 매수가·전세 자료가 부족한 곳이에요.</p>')
    o.append(f'<p class="meta">새 소식 받기: <a href="../feed/gu/{esc(g)}.xml">{esc(g)} RSS</a></p>')
    o.append('<p class="note">무주택·84㎡·시세 상승 0% 같은 기본 가정으로 계산한 추정이에요. 내 조건은 <a href="../">계산기</a>에서 바꿔 볼 수 있어요. 투자 권유가 아니에요.</p>')
    o.append(FOOT.format(upd=UPD))
    return ''.join(o)
for g in sorted(byg): open(os.path.join(GD, g + '.html'), 'w', encoding='utf-8').write(guPage(g, byg[g]))
print('gu pages', len(byg))
# 손으로 쓴 소개·기간 페이지의 '데이터 기준' 날짜를 앱과 같은 갱신일로 맞춘다(예전엔 2026.09.26에 멈춰 있었다)
for fn, pats in (('years.html', [(r'(<p class="eyebrow">데이터 기준 )[\d.]+(</p>)', r'\g<1>' + UPD + r'\2')]),
                 ('about.html', [(r'(지금 기준일은 )[\d.]+(이에요)', r'\g<1>' + UPD + r'\2')])):
    fp = os.path.join(ROOT, 'public', fn)
    if not os.path.exists(fp): continue
    h0 = open(fp, encoding='utf-8').read(); h1 = h0
    for a, b in pats: h1 = re.sub(a, b, h1)
    if h1 != h0: open(fp, 'w', encoding='utf-8').write(h1); print('date synced', fn, UPD)
