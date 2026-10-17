#!/usr/bin/env python3
"""월간 '서울 정비사업 단계 변경 리포트' 생성.
사용: python3 tools/report.py 2026-10 [--publish 2026-11-05] [--draft]
입력: pipeline/data.enriched.json, public/premium.json(dt), pipeline/cache/cleanup.json(최신 추진경과), pipeline/calc.json(계산기 결과),
      pipeline/report/checks/YYYY-MM.json(선택: 원문 대조 {"items":[{"id","event","status":"일치|불일치|확인 불가","url","note"}]})
출력: public/report/YYYY-MM.html, public/report/index.html, public/report/feed.xml, pipeline/report/issues.json, pipeline/report/latest.json(첫 화면 배너용)
"""
import json, os, sys, re, html, math, argparse, datetime, collections, statistics as st
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p, d=None: json.load(open(os.path.join(ROOT, p), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, p)) else d
ap = argparse.ArgumentParser(); ap.add_argument('ym'); ap.add_argument('--publish'); ap.add_argument('--draft', action='store_true'); ap.add_argument('--test', action='store_true')
A = ap.parse_args()
YM = A.ym; Y, M = map(int, YM.split('-'))
PUB = A.publish or datetime.date.today().isoformat()
SITE = 'https://jaegaebal.alwaysquestions.kr'
D = J('pipeline/data.enriched.json') or J('src/data.json'); R = D['recs']; byId = {r['id']: r for r in R}
PREM = J('public/premium.json', {}); CL = J('pipeline/cache/cleanup.json', {}); CALC = J('pipeline/calc.json', {})
CHK = {(c['id'], c['event']): c for c in (J(f'pipeline/report/checks/{YM}.json', {}) or {}).get('items', [])}
def josa(w, a, b):
    c = w[-1]
    return w + (a if '가' <= c <= '힣' and (ord(c) - 0xAC00) % 28 else b)
esc = lambda s: html.escape(str(s if s is not None else ''), quote=True)
EV5 = [('추진위', '추진위원회 승인'), ('구역지정', '정비구역 지정'), ('조합설립', '조합설립인가'), ('사업시행', '사업시행인가'), ('관리처분', '관리처분인가')]
EVX = [('착공', '착공'), ('준공', '준공'), ('시공자', '시공자 선정')]
LAB = dict(EV5 + EVX)
NEXT = {'추진위': '추진위>조합설립', '구역지정': '구역지정>조합설립', '조합설립': '조합설립>사업시행', '사업시행': '사업시행>관리처분', '관리처분': '관리처분>착공'}
MEAN = {
 '추진위': '조합을 만들기 위한 준비 조직이 구청 승인을 받은 단계예요. 아직 조합이 없어서 사업 일정은 가장 불확실해요.',
 '구역지정': '서울시가 정비구역으로 지정·고시한 단계예요. 원칙적으로 이 날이 권리산정기준일이 돼요(따로 고시한 날이 있으면 그날).',
 '조합설립': '토지등소유자 동의를 모아 조합이 인가된 단계예요. <b>재건축·소규모 정비는 이 인가 뒤에 산 사람은 조합원이 될 수 없어요</b>(도시정비법 제39조②·소규모주택정비법 제24조, 예외 있음). 재개발은 관리처분인가 전까지 매수해도 조합원이 될 수 있어요.',
 '사업시행': '건물 배치·세대수 등 사업계획이 인가된 단계예요. 다음은 분담금이 정해지는 관리처분인가예요.',
 '관리처분': '조합원별 분담금과 새 아파트 배정 계획이 인가된 단계예요. <b>재개발도 이 인가 뒤 매수자는 조합원이 될 수 없어요</b>(2018.1.24 이전 사업시행인가 구역 등 예외).',
}
# ---- 레코드별 단계 날짜: 정보몽땅 최신 추진경과가 있으면 그것을, 없으면 기존 자료 ----
DT = {}
for r in R:
    d = dict((PREM.get(r['id']) or {}).get('dt') or r.get('dt') or {})
    cafe = (PREM.get(r['id']) or {}).get('cafe')
    if cafe and CL.get(cafe, {}).get('dt'): d.update({k: v for k, v in CL[cafe]['dt'].items() if k not in d})
    DT[r['id']] = d
def short(n):
    n = re.sub(r'\s*(주택)?(재개발|재건축|가로주택|소규모재건축|소규모재개발)?\s*(정비)?(사업)?\s*(조합|추진위원회|조합설립추진위원회|주민대표회의)?\s*$', '', n).strip()
    return n or n
ev = [(r, k, DT[r['id']][k]) for r in R for k, _ in EV5 if (DT[r['id']].get(k) or '').startswith(YM)]
evx = [(r, k, DT[r['id']][k]) for r in R for k, _ in EVX if (DT[r['id']].get(k) or '').startswith(YM)]
ev.sort(key=lambda x: (x[2], [k for k, _ in EV5].index(x[1])))
if not ev: raise SystemExit(f'{YM}: 인가 이벤트 없음')
# 같은 구역·같은 날 사업시행·관리처분(소규모 정비는 함께 인가) → 관리처분 쪽에 표시하고 원문을 같이 쓴다(원문 미확인이 한쪽에만 뜨지 않게)
SAME = {(r['id'], d) for r, k, d in ev if k == '관리처분' and DT[r['id']].get('사업시행') == d}
# ---- 통계 ----
allm = collections.Counter(DT[r['id']][k][:7] for r in R for k, _ in EV5 if DT[r['id']].get(k))
base = [allm.get(f'{y}-{m:02d}', 0) for y in range(2016, 2025) for m in range(1, 13)]
avg_base = sum(base)/len(base)
last36 = []
y, m = Y, M
for _ in range(36):
    m -= 1
    if m == 0: y, m = y - 1, 12
    last36.append(allm.get(f'{y}-{m:02d}', 0))
avg36 = sum(last36)/36
ytd = [allm.get(f'{Y}-{mm:02d}', 0) for mm in range(1, M + 1)]
yearly = [(yy, sum(v for k, v in allm.items() if k.startswith(str(yy)) and (yy < Y or int(k[5:7]) <= M))) for yy in range(2016, Y + 1)]
n_ev = len(ev); zones = {r['id'] for r, _, _ in ev}
gu = collections.Counter(r['g'] for r, _, _ in ev)
kinds = collections.Counter(k for _, k, _ in ev)
checked = [CHK.get((r['id'], k)) for r, k, _ in ev]
n_ok = sum(1 for c in checked if c and c.get('url') and c.get('status') in ('일치', '확인'))
calc = {r['id']: CALC.get(r['id'], {}) for r, _, _ in ev}
needs = [(calc[i]['need'], i) for i in zones if calc.get(i, {}).get('need')]
top_k = kinds.most_common(1)[0]
title = f"{M}월 서울 정비사업 {len(zones)}곳이 다음 단계로, {josa(LAB[top_k[0]], "이", "가")} {top_k[1]}건으로 가장 많아" if top_k[1] >= 2 else f"{M}월 서울 정비사업 {len(zones)}곳이 다음 단계로"
ratio = n_ev / avg_base if avg_base else 0
s1 = f"{M}월 인가 5종 {n_ev}건. 2016~2024년 월평균(약 {round(avg_base)}건)의 {ratio:.1f}배, 최근 36개월 월평균({round(avg36)}건)과 비교하면 {'많은' if n_ev > avg36 * 1.15 else '적은' if n_ev < avg36 * 0.85 else '비슷한'} 달이에요."
g1, g1n = gu.most_common(1)[0]
s2 = f"{len(gu)}개 구에서 나왔어요(가장 많은 곳 {g1} {g1n}건)."
if needs:
    needs.sort(); mn, mid_ = needs[0], st.median([x for x, _ in needs])
    s3 = f"기본 가정(현금 매수·무주택·84㎡)으로 입주까지 필요한 현금이 가장 적은 곳은 {short(byId[mn[1]]['n'])}(약 {mn[0]:.1f}억), 계산된 {len(needs)}곳의 가운데 값은 약 {mid_:.1f}억이에요."
else: s3 = "이번 달 구역은 매수가 자료가 부족해 입주까지 필요한 현금을 계산하지 못했어요."
SUM3 = [s1, s2, s3]
_I = {i['ym']: i['no'] for i in (J('pipeline/report/issues.json', []) or [])}
no = _I.get(YM) or (max([v for k, v in _I.items() if k < YM] or [0]) + 1)
# ---- HTML ----
def e2(v): return '–' if v is None else f"{v:.1f}"
def card(r, k, d):
    c = calc[r['id']]; ck = CHK.get((r['id'], k)) or {}
    if (r['id'], d) in SAME:
        if not ck.get('url'): ck = dict(CHK.get((r['id'], '사업시행')) or {})
        ck = {**ck, 'note': ' · '.join(x for x in [ck.get('note'), '사업시행인가와 같은 날 인가(소규모 정비는 함께 인가되는 경우가 많아요)'] if x)}
    src = f'<a href="{esc(ck["url"])}" rel="noopener">원문 기사·고시</a>' if ck.get('url') else '<span class="pill p-mute">원문 미확인</span>'
    stn = c.get('st'); ow = c.get('owners')
    meta2 = ' · '.join(x for x in [f"토지등소유자 {ow:,.0f}명" if ow else '', f"{stn['n']} 도보 {max(1, round(stn['d'] * 1.3 / 67))}분" if stn else ''] if x)
    nk = NEXT.get(k); nx = D['stats']['large'].get(nk) if nk else None
    kv = []
    if c.get('price') is not None: kv.append(('지금 매수가(실거래 추정)', f"{c['price']:.1f}억"))
    if c.get('need') is not None: kv.append(('입주까지 필요한 현금 <small>발행 당시 시세·현금 매수 가정</small>', f"약 {c['need']:.1f}억"))
    if c.get('p10') is not None: kv.append(('10년 안 준공 가능성', f"{min(97, round(c['p10'] * 100))}%"))
    if nx: kv.append(('다음 인가까지 보통', f"{nx['med']:.1f}년"))
    zp = os.path.exists(os.path.join(ROOT, 'public/z', r['id'] + '.html'))
    win = c.get('win'); wt = c.get('winT') or ''
    return f'''<article class="zcard"><div class="zc-h"><h3>{esc(short(r['n']))}</h3><span class="meta">{esc(r['g'])} · {esc(re.sub(r'\(모아주택\)', '', r['k']))}</span></div>
<p class="zc-s"><span class="pill">{LAB[k]}</span> {d.replace('-', '.')} · {src}</p>{f'<p class="meta">{esc(ck["note"])}</p>' if ck.get('note') else ''}
{f'<p class="meta">{esc(meta2)}</p>' if meta2 else ''}
<div class="zc-k">{''.join(f'<div><span>{a}</span><b>{b}</b></div>' for a, b in kv)}</div>
<p class="zc-bw {'no' if win == 'no' else ''}"><b>{esc(wt)}</b></p><p class="zc-a">{f'<a href="../z/{r["id"]}">구역 페이지</a> · ' if zp else ''}<a href="../?from=report#{r['id']}">내 현금으로 계산</a></p></article>'''
hb_max = max(kinds.values())
hbars = ''.join(f'<div class="hb"><span class="hb-l">{l}</span><span class="hb-t"><i style="width:{round(kinds.get(k, 0) / hb_max * 100)}%"></i></span><b>{kinds.get(k, 0)}</b></div>' for k, l in EV5)
means = ''.join(f'<div class="mean"><h3>{l} <small>{kinds[k]}건</small></h3><p>{MEAN[k]}{(lambda s: f" 서울 사업장 기록으로는 다음 인가까지 <b>가운데 값 {s["med"]:.1f}년</b>, 5년 안에 닿은 비율 {round(s["reach5y"]["rate"] * 100)}%예요.")(D["stats"]["large"][NEXT[k]]) if NEXT.get(k) in D["stats"]["large"] else ""}</p></div>' for k, l in EV5 if kinds.get(k))
mx = max(v for _, v in yearly) or 1
bw = 390 / len(yearly)
bars = ''.join(f'<rect class="bar{" hi" if yy == Y else ""}" x="{6 + i * bw + 3:.1f}" y="{174 - v / mx * 154:.1f}" width="{bw - 6:.1f}" height="{v / mx * 154:.1f}" rx="3"><title>{yy}년 {v}건</title></rect><text class="lab" x="{6 + i * bw + bw / 2:.1f}" y="{169 - v / mx * 154:.1f}" text-anchor="middle">{v}</text><text class="ax" x="{6 + i * bw + bw / 2:.1f}" y="192" text-anchor="middle">’{str(yy)[2:]}{"*" if yy == Y else ""}</text>' for i, (yy, v) in enumerate(yearly))
# 오래 머문 큰 구역
PK = {2: ('구역지정', '구역지정>조합설립'), 3: ('추진위', '추진위>조합설립'), 4: ('조합설립', '조합설립>사업시행'), 5: ('사업시행', '사업시행>관리처분'), 6: ('관리처분', '관리처분>착공')}
big = sorted([r for r in R if not r.get('dn') and r['s'] < 9 and r.get('src') == 'official' and (r.get('sm') or {}).get('owners')], key=lambda r: -r['sm']['owners'])[:50]
stall = []
ref = datetime.date(Y, M, 28)
for r in big:
    if r['s'] not in PK: continue
    k, sk = PK[r['s']]; d = DT[r['id']].get(k); s0 = D['stats']['large'].get(sk)
    if not d or not s0: continue
    yrs = (ref - datetime.date.fromisoformat(d)).days / 365.25
    stall.append((yrs / s0['med'], yrs, s0['med'], r, LAB[k]))
stall.sort(key=lambda x: -x[0])
stall_html = ''.join(f'<li>{f"<a href=\"../z/{r["id"]}\">" if os.path.exists(os.path.join(ROOT, "public/z", r["id"] + ".html")) else ""}{esc(short(r["n"]))}{"</a>" if os.path.exists(os.path.join(ROOT, "public/z", r["id"] + ".html")) else ""} <span class="meta">{esc(r["g"])}</span> · {lab} {yrs:.1f}년째 (같은 단계 가운데 값 {med:.1f}년)</li>' for _, yrs, med, r, lab in stall[:5])
dur_rows = ''.join(f'<tr><td class="t" data-l="단계">{k.replace(">", " → ").replace("추진위", "추진위원회 승인").replace("구역지정", "정비구역 지정").replace("조합설립", "조합설립인가").replace("사업시행", "사업시행인가").replace("관리처분", "관리처분인가")}</td><td class="n" data-l="가운데 값">{v["med"]:.1f}년</td><td class="n" data-l="5년 안 도달">{round(v["reach5y"]["rate"] * 100)}%</td><td class="n" data-l="빠른 25%~느린 25%">{v["p25"]:.1f}~{v["p75"]:.1f}년</td><td class="n" data-l="표본">{v["n"]}</td></tr>' for k, v in D['stats']['large'].items())
table = ''.join(f'<tr><td class="t" data-l="구역">{esc(short(r["n"]))} <small class="meta">{esc(r["g"])}</small></td><td data-l="단계">{LAB[k]}</td><td class="n" data-l="인가일(정보몽땅)">{d[5:].replace("-", ".")}</td><td data-l="원문">{f"<a href=\"{esc(CHK[(r["id"], k)]["url"])}\" rel=\"noopener\">원문</a>" if CHK.get((r["id"], k), {}).get("url") else "<span class=\"pill p-mute\">원문 미확인</span>"}</td><td data-l="계산"><a href="../?from=report#{r["id"]}">계산기에서 보기</a></td></tr>' for r, k, d in ev)
xtable = ''.join(f'<tr><td class="t" data-l="구역">{esc(short(r["n"]))} <small class="meta">{esc(r["g"])}</small></td><td data-l="단계">{LAB[k]}</td><td class="n" data-l="날짜(정보몽땅)">{d[5:].replace("-", ".")}</td><td data-l="계산"><a href="../?from=report#{r["id"]}">계산기에서 보기</a></td></tr>' for r, k, d in evx)
desc = f"{title}. 구역별 입주까지 필요한 현금·준공 가능성·입주권 판정과 원문 링크, 10년 인가 흐름."
url = f"{SITE}/report/{YM}"
tpl = open(os.path.join(ROOT, 'public/report/2026-09.html'), encoding='utf-8').read()
head = tpl[:tpl.index('<main>')]; foot = tpl[tpl.index('</main>') + 7:]
head = re.sub(r'<title>.*?</title>', f'<title>{Y}년 {M}월 서울 정비사업 단계 변경 리포트 | 집핀 - 서울 재개발 지도</title>', head)
head = re.sub(r'(name="description" content=")[^"]*', lambda m: m.group(1) + esc(desc), head)
head = re.sub(r'(property="og:description" content=")[^"]*', lambda m: m.group(1) + esc(desc), head)
head = re.sub(r'(property="og:title" content=")[^"]*', lambda m: m.group(1) + f'{Y}년 {M}월 서울 정비사업 단계 변경 리포트 | 집핀 - 서울 재개발 지도', head)
head = head.replace(f'{SITE}/report/2026-09', url)
head = re.sub(r'<script type="application/ld\+json">.*?</script>', '<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@type": "Article", "headline": title, "inLanguage": "ko", "datePublished": PUB, "mainEntityOfPage": url, "author": {"@type": "Person", "name": "집핀 운영자", "url": f"{SITE}/about"}, "publisher": {"@type": "Organization", "name": "집핀", "url": SITE}}, ensure_ascii=False) + '</script>', head, flags=re.S)
if A.draft: head = head.replace('<head>', '<head>\n<meta name="robots" content="noindex">', 1)
asof = D.get('asOf', '')
foot = re.sub(r'데이터 기준 [0-9.]+', f'데이터 기준 {asof.replace("-", ".")}', foot)
pd = datetime.date.fromisoformat(PUB)
body = f'''<main>
<p class="eyebrow">서울 정비사업 단계 변경 리포트 · {no}호 · {Y}년 {M}월분</p>
<h1>{esc(title)}</h1>
<p class="byline">정리: 집핀 · 정보몽땅 추진경과 자동 집계{' + 원문 대조' if CHK else ''} · 발행 {pd.year}년 {pd.month}월 {pd.day}일</p>
<div class="sum3"><b>3줄 요약</b><ol>{''.join(f'<li>{esc(s)}</li>' for s in SUM3)}</ol></div>
<div class="kpis">
<div class="kpi"><span>인가 이벤트</span><b>{n_ev}건</b><small>추진위·구역지정·조합설립·사업시행·관리처분</small></div>
<div class="kpi"><span>원문으로 확인</span><b>{n_ok}/{n_ev}건</b><small>기사·고시 링크를 붙인 건</small></div>
<div class="kpi"><span>가장 많은 구</span><b>{esc(g1)} {g1n}건</b><small>{esc(' · '.join(f'{g} {n}' for g, n in gu.most_common()[1:4]))}</small></div>
<div class="kpi"><span>최근 36개월 월평균</span><b>{round(avg36)}건</b><small>2016~2024년 평균은 월 약 {round(avg_base)}건</small></div>
</div>
<h2>이번 달 어떤 인가가 났나</h2>
<div class="hbars" role="img" aria-label="이번 달 인가 종류별 건수">{hbars}</div>
{means}
<h2>구역별로 보기</h2>
<p class="meta">숫자는 무주택·현금 매수·84㎡ 신청·비례율 100%로 계산한 추정이에요. 내 조건(주택 수·소득·전세 끼고)으로는 '내 현금으로 계산'에서 바뀌어요. 입주권 판정은 사이트 규칙 기준이라 실제 매수 전에는 조합·구청에 꼭 확인하세요.</p>
<div class="zcards">{''.join(card(r, k, d) for r, k, d in ev)}</div>
{f'<h3>참고: 착공·준공·시공자 선정</h3><div class="tw cards compact"><table><thead><tr><th>구역</th><th>내용</th><th class="n">날짜(정보몽땅)</th><th>계산</th></tr></thead><tbody>{xtable}</tbody></table></div>' if evx else ''}
<h2>10년 흐름: 한 해 인가 건수(인가 5종)</h2>
<div class="chart"><svg viewBox="0 0 400 200" role="img" aria-label="연도별 인가 5종 건수"><line class="grid" x1="6" x2="396" y1="174" y2="174"/>{bars}</svg><p class="meta">*{Y}년은 1~{M}월 집계</p></div>
<p class="meta">정보몽땅 추진경과의 인가·승인·고시 날짜 기준이에요. 정보몽땅에는 인가가 몇 주 늦게 올라오기도 해서, 다음 갱신 때 이 달 숫자가 늘 수 있어요.</p>
{f'<h2>다음 호 관전 포인트: 같은 단계에 오래 머문 큰 구역</h2><p>토지등소유자가 많은 구역 50곳 중, 지금 단계에 머문 기간이 서울 같은 단계 가운데 값보다 가장 긴 곳이에요. 다음 인가가 곧 난다는 뜻은 아니고, 지연 여부를 지켜볼 구역이에요.</p><ul class="links">{stall_html}</ul>' if stall_html else ''}
<h2>단계마다 실제로 걸린 기간</h2>
<div class="tw cards"><table><thead><tr><th>단계</th><th class="n">가운데 값</th><th class="n">5년 안 도달</th><th class="n">빠른 25%~느린 25%</th><th class="n">표본</th></tr></thead><tbody>{dur_rows}</tbody></table></div>
<p class="meta">가운데 값·5년 안 도달은 아직 다음 단계에 못 간 구역까지 포함한 생존분석 값이에요.</p>
<p><a href="../years">우리 동네가 지금 어느 단계인지 고르고 보기 →</a></p>
<h2>한눈에 보기 (표)</h2>
<div class="tw cards compact"><table><thead><tr><th>구역</th><th>단계</th><th class="n">인가일(정보몽땅)</th><th>원문</th><th>계산</th></tr></thead><tbody>{table}</tbody></table></div>
<h2>인용하실 때</h2><p class="meta">출처를 '집핀 월간 리포트({Y}년 {M}월분)'로 적고 이 페이지 링크를 붙여 주세요. 날짜는 서울시 정비사업 정보몽땅 등록 기준이고, 투자 권유가 아니에요.</p>
</main>'''
if A.test:
    open(os.path.join(ROOT, f'pipeline/report/test_{YM}.html'), 'w', encoding='utf-8').write((head + body + foot).replace('href="../pages.css"', 'href="../../public/pages.css"'))
    print('test written', title); raise SystemExit
open(os.path.join(ROOT, f'public/report/{YM}.html'), 'w', encoding='utf-8').write(head + body + foot)
# ---- 목록·피드·배너 ----
ISS = J('pipeline/report/issues.json', []) or []
ISS = [i for i in ISS if i['ym'] != YM] + [{'ym': YM, 'no': no, 'title': title, 'sum3': SUM3, 'n': n_ev, 'ok': n_ok, 'pub': PUB, 'draft': A.draft}]
ISS.sort(key=lambda i: i['ym'], reverse=True)
json.dump(ISS, open(os.path.join(ROOT, 'pipeline/report/issues.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
pubs = [i for i in ISS if not i.get('draft')]
if pubs:
    L = pubs[0]
    json.dump({'ym': L['ym'], 'no': L['no'], 'url': f"report/{L['ym']}", 'title': L['title'], 'n': L['n'], 'items': [{'id': r['id'], 'step': k, 'date': d} for r, k, d in ev] if L['ym'] == YM else None},
              open(os.path.join(ROOT, 'pipeline/report/latest.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    idx = open(os.path.join(ROOT, 'public/report/index.html'), encoding='utf-8').read()
    a, b = idx.index('<main>'), idx.index('</main>')
    ym2 = lambda ym: f"{int(ym[:4])}년 {int(ym[5:])}월"
    old_main = idx[a:b]
    keep = old_main[old_main.index('<h2>리포트를 만드는 방법</h2>'):old_main.index('<h2>이번 호 미리 보기</h2>')]
    main = f'''<main>
<h1>서울 정비사업 단계 변경 리포트</h1>
<a class="rl-hero" href="{L['ym']}"><small>{L['no']}호 · {ym2(L['ym'])} · 최신</small><b>{esc(L['title'])}</b>
<ol>{''.join(f'<li>{esc(s)}</li>' for s in L['sum3'])}</ol><span class="rl-go">리포트 전체 보기 →</span></a>
{keep}<h2>지난 호</h2><div class="rlist">{''.join(f'<a class="zl" href="{i["ym"]}"><small>{i["no"]}호 · {ym2(i["ym"])}</small><b>{esc(i["title"])}</b><small>인가 {i["n"]}건 · 원문 확인 {i["ok"]}건</small></a>' for i in pubs[1:])}</div>
'''
    open(os.path.join(ROOT, 'public/report/index.html'), 'w', encoding='utf-8').write(idx[:a] + main + idx[b:])
    items = ''.join(f'<item><title>{ym2(i["ym"])} 서울 정비사업 단계 변경 리포트 ({i["no"]}호)</title><link>{SITE}/report/{i["ym"]}</link><guid>{SITE}/report/{i["ym"]}</guid><pubDate>{datetime.datetime.fromisoformat(i["pub"]).strftime("%a, %d %b %Y 09:00:00 +0900")}</pubDate><description>{esc(i["title"])} · 인가 {i["n"]}건 · 원문 확인 {i["ok"]}건</description></item>' for i in pubs)
    open(os.path.join(ROOT, 'public/report/feed.xml'), 'w', encoding='utf-8').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>집핀 · 서울 정비사업 단계 변경 리포트</title><link>{SITE}/report/</link><description>매달 서울에서 인가 단계가 바뀐 정비사업</description><language>ko</language>{items}</channel></rss>')
print(YM, 'no', no, 'events', n_ev, 'zones', len(zones), 'checked', n_ok, '→', title)
