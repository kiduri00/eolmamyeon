#!/usr/bin/env python3
"""손으로 쓴 구역 분석 글(content/z) · 구 해설(content/gu) 점검 — 리뉴얼 A1·A2 게이트.
  python3 tools/zhand_check.py        (tools/zpages.py · api.py · static_tabs.py · sitemap.py 뒤에)
검사
  1. 글 속 숫자(data-zv) == 그날 계산값(pipeline/cache/zhand_vals.json) == /api/v1/zones.json 같은 항목(앱 시트와 같은 값)
  2. 위 3숫자 상자(zk)·요약 카드의 '지금 필요한 돈' == /api/v1 같은 방식 값
  3. 색인: noindex 없음 · sitemap.xml에 있음 · 광고 리터럴 태그 정확히 1번(기존 손글과 같은 바이트) · tools/fixtures/ads_tag_pages.json에 있음
  4. zthin 잣대: 자료 점수 4 이상 · 다른 페이지와 겹치지 않는 본문 800자 이상(pipeline/cache/zthin.json handPages)
  5. 글자 수 2,500자 이상 · 고유 문장 비율 70% 이상(renew/adsense/textstats.py와 같은 셈: 숫자를 지우고 2쪽 이하에만 나오는 문장)
  6. /gu 해설: 글 속 숫자 == 캐시 값, 구 곳 수(n) == h1, 예산대 곳 수(b2·b3·b5·b8) == 아래 목록에서 센 값
  7. 광고 칸: 태그가 있는 정적 페이지는 칸 1개 이상 · 본문 3,000자 미만이거나 칸당 1,500자 미만이면 칸 1개
나가는 값: 실패가 있으면 1"""
import json, os, re, sys, html, math, collections, urllib.parse
import sys as _sys, os as _os; _sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from jsnum import prob_txt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PUB = os.path.join(ROOT, 'public')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from zsample import cash, manT
TAG = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9772652926977648" crossorigin="anonymous"></script>'
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
V = J('pipeline/cache/zhand_vals.json'); API = {z['id']: z for z in J('public/api/v1/zones.json')['items']}
SCHED = set((V.get('scheduled') or {}).keys())   # 공개 전 손글(tools/zhand.py pub)
HELD = V.get('held') or {}   # 공개 보류 손글(content/z publishHold: 사유) — 늘 공개 전. zthin 잣대는 공개할 때 다시 본다(점수는 아래 표에 그대로 남김)
PUBST = J('pipeline/cache/zpub_state.json') if os.path.exists(os.path.join(ROOT, 'pipeline/cache/zpub_state.json')) else {}
TH = J('pipeline/cache/zthin.json').get('handPages', {}); ADS = set(J('tools/fixtures/ads_tag_pages.json'))
SM = open(os.path.join(PUB, 'sitemap.xml'), encoding='utf-8').read()
bad = []; okn = 0
def chk(cond, msg):
    global okn
    if cond: okn += 1
    else: bad.append(msg)
def cashes(v):   # api는 소수 셋째 자리로 반올림돼 있다 → 그 안의 꼴이면 같은 값
    return {cash(v + d) for d in (-0.0005, 0, 0.00049)} if v is not None else {None}
def ymd(s): return str(s or '')[:10].replace('-', '.')
def ym(s): return str(s or '')[:7].replace('-', '.')
APIMAP = {   # 글 키 → /api/v1 값(그 키의 글자 꼴로)
    'gapNow': lambda a: cashes(a['need']['gap']['now']), 'gapTotal': lambda a: cashes(a['need']['gap']['total']),
    'cnow': lambda a: cashes(a['need']['cash']['now']), 'need': lambda a: cashes(a['need']['cash'].get('total')),
    # /api/v1 price·jeonse는 소수 둘째·넷째 자리로 줄인 값 → 반올림 폭(±0.0005억 = ±5만) 안의 만 원 단위 글자를 모두 같은 값으로 본다
    'price': lambda a: {manT(round(a['price'] + d / 1e4, 4)) for d in range(-5, 6)} if a.get('price') is not None else {None},
    'jeonse': lambda a: {manT(round(a['jeonse'] + d / 1e4, 4)) for d in range(-5, 6)} if a.get('jeonse') is not None else {None},
    'stage': lambda a: {a['stage']['label']}, 'owners': lambda a: {f"{a['owners']:,}"} if a.get('owners') else {None},
    'n12': lambda a: {f"{a['trades']['n12']:,}"} if (a.get('trades') or {}).get('n12') is not None else {None},
    'p10': lambda a: {prob_txt(a['completion']['p10'])} if a.get('completion') else {None},   # 앱 probTxt와 같은 반올림(tools/jsnum.py)
    'eLo': lambda a: {ym(a['completion']['lo'])} if a.get('completion') else {None}, 'eMid': lambda a: {ym(a['completion']['mid'])} if a.get('completion') else {None},
    'eHi': lambda a: {ym(a['completion']['hi'])} if a.get('completion') else {None},
    'station': lambda a: {(a.get('station') or {}).get('name')}, 'walk': lambda a: {f"{a['station']['walkMin']}분"} if a.get('station') else {None},
    'rdx': lambda a: {ymd(a.get('rightsDate'))} if a.get('rightsDate') else {None}, 'pol': lambda a: {f"{a['oldPct']}%"} if a.get('oldPct') is not None else {None},
    'sampleN': lambda a: {f"{a['priceSample']['n']:,}"} if (a.get('priceSample') or {}).get('n') else {None},
    # 사이클 3 통합: ZoneFacts 값(/api/v1 facts)
    'jrUse': lambda a: {f"{a['facts']['jeonseRatio']['pct']:g}%"} if ((a.get('facts') or {}).get('jeonseRatio') or {}).get('pct') is not None and not a['facts']['jeonseRatio'].get('held') else {None},
    'nextTo': lambda a: {((a.get('facts') or {}).get('next') or {}).get('to')}, 'etaFx': lambda a: {(a.get('facts') or {}).get('eta')},
    'etaSpan': lambda a: {re.sub(r' 뒤$', '', str((a.get('facts') or {}).get('eta') or '')) or None},   # c4 최종: 손글 '…년을 기다릴' = ZoneFacts 입주 범위
}
# 고유 문장 비율(textstats.py와 같은 셈)
def text(s):
    m = re.search(r'<main\b[^>]*>(.*)</main>', s, re.S); b = m.group(1) if m else s
    b = re.sub(r'<(script|style|svg|nav|footer|header|template)\b[^>]*>.*?</\1>', ' ', b, flags=re.S)
    t = re.sub(r'<[^>]+>', ' ', b); t = re.sub(r'&[a-z#0-9]+;', ' ', t); return re.sub(r'\s+', ' ', t).strip()
sents = lambda t: [x.strip() for x in re.split(r'(?<=[.다요?!])\s+|\s·\s', t) if len(x.strip()) > 8]
norm = lambda x: re.sub(r'[\d,.]+', '#', x)
freq = collections.Counter(); TXT = {}
for dp, _, fs in os.walk(PUB):
    top = os.path.relpath(dp, PUB).split(os.sep)[0]
    if top not in ('z', 'gu', 'guide', 'report'): continue
    for f in fs:
        if f.endswith('.html'):
            t = text(open(os.path.join(dp, f), encoding='utf-8').read()); TXT[os.path.join(top, f)] = t
            for s_ in set(norm(x) for x in sents(t)): freq[s_] += 1
rep = []
for f in V.get('failed') or []: chk(False, '렌더 실패(어제 페이지 유지): ' + f)
for rid, vals in sorted(V.get('z', {}).items()):
    fp = os.path.join(PUB, 'z', rid + '.html'); h = open(fp, encoding='utf-8').read(); a = API.get(rid)
    zv = re.findall(r'<b class="zv" data-zv="(\w+)">([^<]*)</b>', h)
    chk(bool(zv), f'{rid}: 글 속 data-zv 숫자 없음')
    for k, t in zv:
        t = html.unescape(t)
        chk(t == vals.get(k), f'{rid}: {{{{{k}}}}} 페이지 "{t}" ≠ 계산값 "{vals.get(k)}"')
        if a and k in APIMAP: chk(t in APIMAP[k](a), f'{rid}: {{{{{k}}}}} 페이지 "{t}" ≠ /api/v1 {sorted(map(str, APIMAP[k](a)))}')
    # 머리 3숫자 상자 · 요약 카드 '지금 필요한 돈'
    zk = re.search(r'<section class="zk".*?</section>', h, re.S); car = re.search(r'<section class="zh-car".*?</section>', h, re.S)
    chk(bool(zk) and bool(car), f'{rid}: 3숫자 상자(zk) 또는 요약 카드 없음')
    if zk and car and a:
        kn = re.search(r'zk-l">지금 필요한 돈</span><b class="zk-v">([^<]+)</b>', zk.group(0)); cn = re.search(r'zh-sl">지금 필요한 돈</span><b class="zh-sv">([^<]+)</b>', car.group(0))
        chk(kn and cn and kn.group(1) == cn.group(1), f'{rid}: 상자 {kn and kn.group(1)} ≠ 카드 {cn and cn.group(1)}')
        if kn and kn.group(1) != '계산 보류':
            exp = cashes(a['need']['gap']['now']) if a['need']['gap'].get('now') is not None else cashes(a['need']['cash']['now'])
            chk(kn.group(1) in exp, f'{rid}: 지금 필요한 돈 {kn.group(1)} ≠ /api/v1 {sorted(map(str, exp))}')
    if rid in SCHED:   # 공개 전(publishWave · DEPLOY_DATE): noindex · 사이트맵 없음 · 광고 태그 없음 · '처음 올림' 날짜 없음
        chk('name="robots" content="noindex' in h, f'{rid}: 공개 전인데 noindex 없음')
        chk(f'/z/{rid}</loc>' not in SM, f'{rid}: 공개 전인데 sitemap.xml에 있음')
        chk(not re.findall(r'<script[^>]*adsbygoogle', h), f'{rid}: 공개 전인데 광고 태그 있음')
        chk('처음 올림' not in h and '"datePublished"' not in h and '공개 예정' not in h, f'{rid}: 공개 전인데 날짜가 있음')
    else:
        chk('name="robots" content="noindex' not in h, f'{rid}: noindex')
        chk(f'/z/{rid}</loc>' in SM, f'{rid}: sitemap.xml에 없음')
        chk(h.count(TAG) == 1 and len(re.findall(r'<script[^>]*adsbygoogle', h)) == 1, f'{rid}: 광고 리터럴 태그 {h.count(TAG)}번')
        fd = (PUBST.get('first') or {}).get(rid)
        if fd: chk(f'처음 올림 {int(fd[:4])}년 {int(fd[5:7])}월 {int(fd[8:10])}일' in h, f'{rid}: 처음 올림 날짜 ≠ 상태 파일 {fd}')
    chk(f'z/{rid}.html' in ADS, f'{rid}: tools/fixtures/ads_tag_pages.json에 없음')
    # 사이클 3: 광고 칸 자리 — 공개 전에도 zhand가 둔 자리 표시(<!--ad-slot-->)가 1개 이상(공개되면 태그와 함께 칸이 생김)
    chk(h.count('<!--ad-slot-->') >= 1, f'{rid}: 광고 칸 자리 표시(<!--ad-slot-->) 없음 — 공개 뒤 태그만 있고 칸 0이 돼요')
    tm = TH.get(rid) or {}
    if rid in HELD:   # 공개 보류: 사유가 있고 공개 전 상태(위 SCHED 검사 · noindex·사이트맵·광고·날짜)일 때만 zthin 미달을 넘긴다 — 공개로 바뀌면(HELD에서 빠지면) 다시 아래 잣대
        chk(rid in SCHED and len(str(HELD[rid]).strip()) >= 10, f'{rid}: 공개 보류인데 사유 없음 또는 공개 전 상태 아님')
        if not (tm.get('score', 0) >= 4 and tm.get('uniq', 0) >= 800): print(f'  (공개 보류) {rid}: zthin 점수 {tm.get("score")} · 고유 본문 {tm.get("uniq")} — 공개 전이라 통과 · 사유: {HELD[rid]}')
    else:
        chk(tm.get('score', 0) >= 4 and tm.get('uniq', 0) >= 800, f'{rid}: zthin 잣대 미달 score {tm.get("score")} uniq {tm.get("uniq")}')
    t = TXT[os.path.join('z', rid + '.html')]; ss = sents(t); tot = sum(len(x) for x in ss) or 1; u = sum(len(x) for x in ss if freq[norm(x)] <= 2)
    chk(len(t) >= 2500 and u / tot >= 0.70, f'{rid}: 글자 {len(t)} · 고유 {u / tot:.0%} (기준 2,500자 · 70%)')
    rep.append((rid, len(t), round(100 * u / tot), tm.get('score'), tm.get('uniq')))
# 예전 손글 40쪽: 글 속 data-zv == 오늘 계산값 == /api/v1 · 준공 통계 생략 구역(8년 넘게 같은 단계)은 카드·머리 칸·본문에 준공 가능성 숫자 없음
for rid, vals in sorted(V.get('old', {}).items()):
    h = open(os.path.join(PUB, 'z', rid + '.html'), encoding='utf-8').read(); a = API.get(rid)
    for k, t in re.findall(r'<b class="zv" data-zv="(\w+)">([^<]*)</b>', h):
        t = html.unescape(t)
        chk(t == vals.get(k), f'{rid}(예전 글): {{{{{k}}}}} 페이지 "{t}" ≠ 계산값 "{vals.get(k)}"')
        if a and k in APIMAP: chk(t in APIMAP[k](a), f'{rid}(예전 글): {{{{{k}}}}} "{t}" ≠ /api/v1 {sorted(map(str, APIMAP[k](a)))}')
    chk('분담금 추정' not in h, f'{rid}: 제목·본문에 \'분담금 추정\'')
    chk(not re.search(r'분담금 [\d.]+억', re.sub(r'<[^>]+>', '', h)), f'{rid}: 분담금을 한 숫자로 씀')
    if vals.get('eta') == '산정 불가':
        kp = re.search(r'<span>10년 안 준공 가능성</span><b>([^<]*)</b>', h)
        chk(not kp or kp.group(1) in ('–', '통계 생략'), f'{rid}: 준공 통계 생략 구역인데 머리 칸에 {kp and kp.group(1)}')   # renew-feat 사이클 2: 장기 정체(stall_yrs)는 '통계 생략'
        car = re.search(r'<section class="zh-car".*?</section>', h, re.S)
        chk(not car or not re.search(r'10년 안 준공 가능성 \d', car.group(0)), f'{rid}: 준공 통계 생략 구역인데 요약 카드에 가능성 숫자')
# /gu 해설은 '한눈에' 자동 문단이 이미 말한 숫자(곳 수·방식별 수·관리처분 뒤 곳 수·계산된 곳 수·가운데 값·토지거래허가 곳 수·거래 건수·가장 오래 머문 곳·가장 많은 단계)를 다시 쓰지 않는다(애드센스 레드팀 c1: 영등포 6 vs 9)
_J0 = lambda p: J(p) if os.path.exists(os.path.join(ROOT, p)) else {}
CHG, AUC, TDJ = _J0('public/data/changes.json'), _J0('public/data/auction.json'), _J0('public/data/today.json')
from zhand import tho_today; THZ = tho_today()[0]   # 오늘 카드와 같은 셈(주거용 허가 30일)
GUZ = collections.defaultdict(set)   # /gu 목록과 같은 '진행 중' 기준(tools/zpages.py R)
for r in _J0('pipeline/data.enriched.json').get('recs') or []:
    if not (r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7)) and r.get('src') != 'moa' and r.get('n'): GUZ[r['g']].add(r['id'])
GU_DUP = {'n', 'nRedev', 'nRebuild', 'nSmall', 'late', 'listed', 'med', 'medVsSeoul', 'seoulMed', 'tx12', 'txTop', 'th', 'thPct', 'loanOnly', 'stallList'}
for g, vals in sorted(V.get('gu', {}).items()):
    src = J(f'content/gu/{g}.json'); used = set(re.findall(r'\{\{(\w+)\}\}', json.dumps(src, ensure_ascii=False)))
    sts = {k: int(v) for k, v in vals.items() if k.startswith('st') and k not in ('stall', 'stallList') and str(v).isdigit()}
    top = {k for k, v in sts.items() if v and v == max(sts.values())}
    chk(not (used & (GU_DUP | top)), f'/gu/{g}: 한눈에 문단과 겹치는 숫자 {sorted(used & (GU_DUP | top))}')
    first = re.sub(r'\{\{\w+\}\}', '#', ' '.join(src['blocks'][0]['p']))
    nt = len(re.findall(r'\d[\d,.]*|#', first)); chk(nt <= 3, f'/gu/{g}: 첫 문단 숫자 나열 {nt}개(3개까지)')
    fp = os.path.join(PUB, 'gu', g + '.html'); h = open(fp, encoding='utf-8').read()
    blk = re.search(r'<!--gx-->.*?<!--/gx-->', h, re.S); chk(bool(blk), f'/gu/{g}: 해설 덩이 없음')
    if not blk: continue
    for k, t in re.findall(r'<b class="zv" data-zv="(\w+)">([^<]*)</b>', blk.group(0)): chk(html.unescape(t) == vals.get(k), f'/gu/{g}: {{{{{k}}}}} "{t}" ≠ "{vals.get(k)}"')
    h1 = re.search(r'<h1>[^<]*?([\d,]+)곳</h1>', h); chk(h1 and h1.group(1).replace(',', '') == vals['n'], f'/gu/{g}: h1 곳 수 ≠ n {vals["n"]}')
    rows = re.findall(r'<li class="gr">(.*?)</li>', h, re.S)
    def mon(row):
        m = re.search(r'<i>지금</i> <b class="gr-now">([^<]+)</b>', row)
        if not m or 'gr-ex' in row: return None
        s = m.group(1); return float(s[:-1].replace(',', '')) if s.endswith('억') else float(s[:-1].replace(',', '')) / 1e4 if s.endswith('만') else None
    ms = [m for m in map(mon, rows) if m is not None]
    chk(len(ms) == int(vals['listed']), f'/gu/{g}: 목록에서 센 곳 {len(ms)} ≠ listed {vals["listed"]}')
    for cap, k in ((2, 'b2'), (3, 'b3'), (5, 'b5'), (8, 'b8')):
        # 목록 금액은 올림 꼴(ZF.cash) — 꼴이 cap 이하인 곳 수는 실제 값 cap 이하 곳 수와 같다(올림이라 cap 경계를 넘지 않음)
        chk(sum(1 for m in ms if m <= cap + 1e-9) == int(vals[k]), f'/gu/{g}: {cap}억 이하 곳 수 목록 {sum(1 for m in ms if m <= cap + 1e-9)} ≠ {vals[k]}')
    if 'tho30' in vals:   # 사이클 5 C: '이번 달 흐름' 숫자 == 시트(toheo n30)·소식(changes trade cnt)·일정(auction 매각기일 남은 물건)에서 다시 센 값
        ids = GUZ.get(g, set())
        chk(vals['tho30'] == f"{sum((THZ.get(i) or [0, 0])[1] for i in ids):,}", f'/gu/{g}: tho30 {vals["tho30"]} ≠ 오늘 묶음(today.py) 다시 센 값')
        if TDJ.get('asOf') == CHG.get('asOf') and TDJ.get('tho') is not None: chk(vals['tho30'] == f"{sum(((TDJ.get('tho') or {}).get(i) or [0, 0])[1] for i in ids):,}", f'/gu/{g}: tho30 {vals["tho30"]} ≠ public/data/today.json tho')
        chk(vals['tx30'] == f"{sum(e.get('cnt') or 1 for e in CHG.get('items') or [] if e.get('type') == 'trade' and e.get('id') in ids and not e.get('x')):,}", f'/gu/{g}: tx30 {vals["tx30"]} ≠ changes.json 다시 센 값')
        chk(vals['auc'] == f"{sum(1 for i in ids for x in (AUC.get('byZone') or {}).get(i, []) if x.get('date', '') >= (AUC.get('asOf') or '') and x.get('st') != 'gone')}", f'/gu/{g}: auc {vals["auc"]} ≠ auction.json 다시 센 값')
    t = TXT[os.path.join('gu', g + '.html')]; ss = sents(t); tot = sum(len(x) for x in ss) or 1; u = sum(len(x) for x in ss if freq[norm(x)] <= 2)
    rep.append(('gu:' + g, len(t), round(100 * u / tot), '', ''))
# 사이클 3(애드센스 레드팀 c2): 광고 리터럴 태그가 있는 정적 페이지는 광고 칸이 1개 이상(태그만 있고 칸 0이던 손글 4편)
for dp, _, fs in os.walk(PUB):
    if os.path.relpath(dp, PUB).split(os.sep)[0] in ('b', 'api', 'data'): continue
    for f in fs:
        if not f.endswith('.html'): continue
        rel = os.path.relpath(os.path.join(dp, f), PUB)
        if rel in ('index.html', 'admin.html'): continue   # SPA 홈은 src/shell.html 칸(정적 칸 규칙 밖)
        h = open(os.path.join(dp, f), encoding='utf-8').read(); hd = h[:h.find('</head>')]
        if 'adsbygoogle.js' in hd:
            ns = h.count('class="ad-slot"'); chk(ns >= 1, f'{rel}: 광고 태그는 있는데 광고 칸 0')
            # 사이클 4(애드센스 레드팀 c3): 본문 3,000자 미만이거나 칸 하나당 1,500자 미만이면 칸은 1개(tools/static_tabs.py AD_LEN_MIN·AD_PER_SLOT)
            nl = len(text(h)); chk(ns <= 1 or (nl >= 3000 and nl / ns >= 1500), f'{rel}: 본문 {nl:,}자에 광고 칸 {ns}개(칸당 {nl // max(ns, 1):,}자 · 기준 3,000자·칸당 1,500자)')
# 원본 글에 '살 수 있'이 있으면 용어 통일(term_fix)이 '갈 수 있'으로 바꿔 문장이 깨진다('들어가 갈 수 있는') — 원본 단계에서 막는다
import glob as _g
for f in sorted(_g.glob(os.path.join(ROOT, 'content', '**', '*.json'), recursive=True)):
    chk('살 수 있' not in open(f, encoding='utf-8').read(), f'{os.path.relpath(f, ROOT)}: 원본에 \'살 수 있\' — 용어 통일이 \'갈 수 있\'으로 바꿔 문장이 깨져요')
# 사이클 5 통합: assetlinks.json = JSON · 새 앱(APP_PKG)에 업로드 키 + Play 앱 서명 키 둘 다 · 예전 시험 앱(LEGACY_PKG) 항목 유지(값은 tools/brand.py 한 곳)
sys.path.insert(0, os.path.join(ROOT, 'tools')); import brand as _B
try: _al = json.load(open(os.path.join(PUB, '.well-known', 'assetlinks.json'), encoding='utf-8')); _alok = isinstance(_al, list)
except Exception as _e: _al, _alok = [], False
chk(_alok, 'assetlinks.json: JSON 목록이 아님')
_fp = {x.get('target', {}).get('package_name'): x.get('target', {}).get('sha256_cert_fingerprints') or [] for x in (_al if _alok else [])}
for _k in list(_B.SIGNING_SHA256) + list(getattr(_B, 'PLAY_SIGNING_SHA256', [])): chk(_k in _fp.get(_B.APP_PKG, []), f'assetlinks.json: {_B.APP_PKG}에 지문 {_k[:8]}… 없음')
chk(len(getattr(_B, 'PLAY_SIGNING_SHA256', [])) >= 1, 'brand.PLAY_SIGNING_SHA256 비어 있음')
chk(_B.LEGACY_PKG in _fp, f'assetlinks.json: 예전 시험 앱 {_B.LEGACY_PKG} 항목 없음')
for x in rep: print('%-14s 글자 %6d · 고유 %3d%% · zthin 점수 %s · 고유 본문 %s' % x)
print(f'zhand_check: ok {okn} · fail {len(bad)}')
for b in bad[:60]: print('  FAIL', b)
sys.exit(1 if bad else 0)
