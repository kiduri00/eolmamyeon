#!/usr/bin/env python3
"""준공 30년 넘은 서울 아파트 단지(재건축 연한 도래) 목록 → public/guide/rebuild-30y.html
입력: pipeline/txsum.json의 apt(지번별 단지 실거래 요약: 이름·준공연도·거래 수·가운데 값), pipeline/cache/parcels.json(정비구역 안 필지), pipeline/data.enriched.json
이미 정비구역(재건축 등)에 들어간 단지는 구역 페이지로 연결하고 '추진 중'으로 표시한다."""
import json, os, html, datetime, collections, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p, d=None: json.load(open(os.path.join(ROOT, p), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, p)) else d
T = J('pipeline/txsum.json'); PAR = J('pipeline/cache/parcels.json', {}); D = J('pipeline/data.enriched.json')
esc = lambda s: html.escape(str(s if s is not None else ''), quote=True)
inv = {v: k for k, v in T['dcode'].items()}
# 건축물대장 총괄표제부(OA-23051, tools/fetch_ledger.js): 공동주택 지번별 용적률·세대수·대지면적 → pipeline/cache/ledger.json로 줄여 보관
LP = os.path.join(ROOT, 'pipeline/raw/ledger/summary.csv'); LC = os.path.join(ROOT, 'pipeline/cache/ledger.json')
if os.path.exists(LP):
    import csv
    f = open(LP, encoding='cp949', errors='replace'); rd = csv.reader(f); h = next(rd); ix = {k: i for i, k in enumerate(h)}
    L = {}
    for x in rd:
        if x[ix['주용도코드명']] != '공동주택': continue
        gu = x[ix['시군구코드명']].replace('서울특별시', '').strip(); dg = x[ix['법정동코드명']].strip()
        code = T['dcode'].get(f'{gu}|{dg}')
        if not code: continue
        try:
            pnu = f"{code}{'2' if '산' in x[ix['대지구분코드명']] else '1'}{int(x[ix['주지번']] or 0):04d}{int(x[ix['부지번']] or 0):04d}"
            far = float(x[ix['용적률']] or 0); hh = int(float(x[ix['세대수']] or 0)); land = float(x[ix['대지면적']] or 0); fa = float(x[ix['용적률산정연면적']] or 0)
        except ValueError: continue
        if hh <= 0: continue
        o = L.get(pnu)
        if not o or hh > o[1]: L[pnu] = [round(far, 1), hh, round(land, 1), (x[ix['사용승인일자']] or '')[:8], round(fa)]
    json.dump(L, open(LC, 'w'), separators=(',', ':'))
LED = J('pipeline/cache/ledger.json', {})
def led(p):
    if p in LED: return LED[p]
    c = [v for k, v in LED.items() if k[:15] == p[:15]]
    return max(c, key=lambda v: v[1]) if c else None
byId = {r['id']: r for r in D['recs']}
in_zone = {}
for rid, v in PAR.items():
    r = byId.get(rid)
    if not r or r.get('src') == 'moa': continue
    for p in v.get('p', []): in_zone.setdefault(p[0], rid)
NOWY = datetime.date.today().year
# 대장에 대지면적이 빈 단지: 연속지적(서울도시공간포털 layer 1)의 해당 지번 면적으로 보완(결과는 캐시)
import subprocess, urllib.parse, time
AC = os.path.join(ROOT, 'pipeline/cache/pnu_area.json'); AREA = J('pipeline/cache/pnu_area.json', {})
UB = "https://urban.seoul.go.kr/proxy/proxy.jsp?http://98.33.2.225:6080/arcgis/rest/services/UPIS/20200526_WFS/MapServer/1/query?"
need = [p for p, v in T['apt'].items() if v.get('yr') and NOWY - v['yr'] >= 30 and p not in AREA and (lambda l: l is not None and l[2] <= 0)(LED.get(p))]
for i in range(0, len(need), 40):
    ch = need[i:i + 40]
    q = urllib.parse.urlencode({'f': 'json', 'where': "PNU IN (" + ",".join(f"'{x}'" for x in ch) + ")", 'outFields': 'PNU,SHAPE.AREA', 'returnGeometry': 'false'})
    for k in range(3):
        rr = subprocess.run(['curl', '-sS', '--max-time', '90', UB + q], capture_output=True, text=True)
        try: fs = json.loads(rr.stdout).get('features', []); break
        except Exception: fs = None; time.sleep(3)
    if fs is None: continue
    for x in ch: AREA[x] = 0
    for ft in fs:
        a_ = ft['attributes']; AREA[a_['PNU']] = round(a_.get('SHAPE.AREA') or 0, 1)
json.dump(AREA, open(AC, 'w'), separators=(',', ':'))
rows = []
fill = collections.Counter()
for p, v in T['apt'].items():
    yr = v.get('yr')
    if not yr or NOWY - yr < 30: continue
    gd = inv.get(p[:10], '|').split('|')
    zid = in_zone.get(p)
    lg = led(p)
    if lg and lg[2] <= 0 and zid and len(lg) > 4 and lg[4] > 0:   # 대장에 대지면적이 비면 정비구역 경계 안 '대' 필지 면적으로 보완
        land = sum(q[1] for q in PAR[zid].get('p', []) if len(q) > 3 and q[3] in ('대', '대지'))
        if land > 0: lg = [round(lg[4] / land * 100, 1), lg[1], round(land, 1), lg[3], lg[4]]; fill['zone'] += 1
    if lg and lg[2] <= 0 and AREA.get(p, 0) > 0 and len(lg) > 4 and lg[4] > 0: lg = [round(lg[4] / AREA[p] * 100, 1), lg[1], AREA[p], lg[3], lg[4]]; fill['parcel'] += 1
    if lg and lg[0] <= 0 and lg[2] > 0 and len(lg) > 4 and lg[4] > 0: lg = [round(lg[4] / lg[2] * 100, 1)] + lg[1:]; fill['far_calc'] += 1
    if lg: fill['hit'] += 1
    far = lg[0] if lg and 60 <= lg[0] <= 500 else None   # 범위 밖은 지번·면적이 어긋난 것으로 보고 비움
    hh = lg[1] if lg else None; ld = round(lg[2] / lg[1], 1) if far and lg[2] > 0 and lg[1] > 0 and 5 <= lg[2] / lg[1] < 300 else None
    rows.append({'g': gd[0], 'd': gd[1], 'n': v['name'], 'y': yr, 'c': v['n'], 'w': v.get('win', 12), 'm': v['med'], 'a': v.get('area_med'), 'l': v['last'], 'z': zid,
                 'zs': (byId[zid].get('sr') if zid else ''), 'far': far, 'hh': hh, 'ld': ld})
# 26차: 실거래 신고는 '아파트'지만 이름이 빌라·연립·주택이고 세대수가 30 미만(또는 대장에 없음)인 작은 공동주택은 재건축 단지 목록에서 뺀다(예: '은진빌라')
_VILLA = re.compile(r'빌라(?!트)|연립|다세대|주택(?:\(|$)')
SMALL = [r for r in rows if _VILLA.search(r['n']) and '아파트' not in r['n'] and not (r['hh'] and r['hh'] >= 30)]
rows = [r for r in rows if r not in SMALL]
for r in rows: r['farS'] = f"{round(r['far'])}%" if r['far'] else '–'; r['hhS'] = f"{r['hh']:,}세대" if r['hh'] else ''; r['ldS'] = f"{r['ld']}㎡" if r['ld'] else '–'
rows.sort(key=lambda x: (x['g'], -x['c']))
json.dump({'asOf': (D.get('upd') or ''), 'items': [{k: r[k] for k in ('g', 'd', 'n', 'y', 'c', 'w', 'm', 'a', 'l', 'z', 'far', 'hh', 'ld')} for r in rows]}, open(os.path.join(ROOT, 'pipeline/rebuild.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
UPD = (D.get('upd') or '').replace('-', '.')
guN = collections.Counter(r['g'] for r in rows)
zN = sum(1 for r in rows if r['z'])
eok = lambda v: f"{v/10000:.1f}억".replace('.0억', '억')
# 25차(애드센스 1차 레드팀): 표만 있던 글 → 요약 + 자료로 쓴 설명 다섯 꼭지(숫자는 모두 위 rows에서) · 큰 표는 접어 둔다
def _med(v): v = sorted(v); return v[len(v) // 2] if v else None
def _pc(a, b): return round(a / b * 100) if b else 0
def narrative():
    N = len(rows)
    if not N: return ''
    top = guN.most_common(5); low = [g for g, n in sorted(guN.items(), key=lambda z: (z[1], z[0]))[:3]]
    zg = collections.Counter(r['g'] for r in rows if r['z'])
    dec = collections.Counter((r['y'] // 10) * 10 for r in rows)
    old = min(rows, key=lambda r: (r['y'], -r['c']))
    F = [r['far'] for r in rows if r['far']]; fb = lambda lo, hi: sum(1 for v in F if lo < v <= hi)
    LDv = [r['ld'] for r in rows if r['ld']]
    pm = {g: _med([r['m'] for r in rows if r['g'] == g]) for g in guN if guN[g] >= 10}
    pr = sorted(pm.items(), key=lambda z: z[1])
    tc = sorted(rows, key=lambda r: -r['c'])[:3]
    zs = collections.Counter(r['zs'] for r in rows if r['z'] and r['zs'])
    S = []
    S.append(('요약', f'<ul><li>준공 30년이 지나고 최근 실거래가 있는 서울 아파트는 <b>{N:,}단지</b>예요.</li><li>{top[0][0]}({top[0][1]:,}단지)·{top[1][0]}({top[1][1]:,})·{top[2][0]}({top[2][1]:,})에 가장 많아요.</li>'
              f'<li>이미 정비구역에 들어간 단지는 {zN:,}단지({_pc(zN, N)}%)이고, 나머지 {N - zN:,}단지는 아직 정비구역으로 잡히지 않았어요.</li>'
              + (f'<li>용적률이 확인된 {len(F):,}단지 가운데 200% 이하가 {fb(0, 200):,}단지({_pc(fb(0, 200), len(F))}%)예요.</li>' if F else '')
              + f'<li>단지별 실거래 가운데 값의 가운데 값은 {eok(_med([r["m"] for r in rows]))}이에요.</li></ul>'))
    S.append(('어느 구에 많나', f'<p>{", ".join(f"{g} {n:,}단지" for g, n in top)} 순이에요. 다섯 구만 합쳐도 {_pc(sum(n for _, n in top), N)}%예요. 가장 적은 곳은 {", ".join(low)}예요. '
              + (f'이미 정비사업이 진행 중인 단지 비율은 {", ".join(f"{g} {_pc(zg[g], guN[g])}%" for g, _ in top[:3])}로, 같은 노후 단지라도 구마다 사업에 들어간 정도가 달라요.' if zg else '') + '</p>'))
    ds = sorted(dec.items())
    S.append(('언제 지어졌나', f'<p>준공 연대로 나누면 ' + ', '.join(f"{d}년대 {n:,}단지" for d, n in ds) + f'예요. 가장 오래된 단지는 {esc(old["g"])} {esc(old["d"])}의 {esc(old["n"])}({old["y"]}년 준공, {NOWY - old["y"]}년)이에요. '
              f'1990년대 준공 단지는 해마다 새로 30년을 넘기면서 이 목록이 길어져요. 30년은 재건축을 검토할 수 있는 최소 조건이고, 실제 착수는 안전진단(재건축 진단)과 정비계획을 거쳐야 해요.</p>'))
    if F:
        S.append(('용적률로 보는 여지', f'<p>용적률은 대지 면적 대비 건물 연면적 비율이에요. 지금 용적률이 낮을수록 다시 지을 때 늘릴 수 있는 폭이 커서 일반분양 몫이 생기기 쉬워요. 확인된 {len(F):,}단지 가운데 150% 이하 {fb(0, 150):,}단지, 150~200% {fb(150, 200):,}단지, 200~250% {fb(200, 250):,}단지, 250% 넘음 {fb(250, 999):,}단지예요(가운데 값 {round(_med(F))}%). '
                  f'다만 용적률은 건축물대장 총괄표제부가 있는 단지만 확인돼서, 한 동짜리 단지는 빠져 있어요.</p>'))
    if LDv:
        S.append(('세대당 대지지분', f'<p>대지면적을 세대수로 나눈 세대당 평균 대지지분은 가운데 값 {_med(LDv)}㎡예요. 같은 용적률이라도 대지지분이 클수록 조합원 한 사람 몫의 땅이 많아 분담금 부담이 줄어드는 쪽으로 작용해요. '
                  f'대지지분이 확인된 {len(LDv):,}단지 가운데 40㎡ 이상은 {sum(1 for v in LDv if v >= 40):,}단지, 20㎡ 미만은 {sum(1 for v in LDv if v < 20):,}단지예요.</p>'))
    if pr:
        S.append(('값과 거래', f'<p>단지가 10곳 넘는 구만 놓고 단지별 가운데 값을 다시 가운데로 모으면 {pr[0][0]} {eok(pr[0][1])}, {pr[1][0]} {eok(pr[1][1])}이 가장 낮고 {pr[-1][0]} {eok(pr[-1][1])}, {pr[-2][0]} {eok(pr[-2][1])}이 가장 높아요. 평형이 섞인 값이라 단지끼리 바로 비교하기보다는 흐름을 보는 용도예요. '
                  f'거래가 가장 많은 단지는 ' + ', '.join(f'{esc(r["g"])} {esc(r["n"])}({r["c"]}건)' for r in tc) + '이에요.</p>'))
    if zs:
        S.append(('이미 정비사업 중인 단지', f'<p>정비구역 안에 있는 {zN:,}단지를 지금 단계로 나누면 ' + ', '.join(f'{esc(k)} {v:,}단지' for k, v in zs.most_common(5)) + '예요. 표에서 ‘정비사업 진행 중’ 링크를 누르면 구역 페이지에서 인가 이력과 입주까지 현금을 볼 수 있어요. 재건축은 조합설립인가 뒤에 사면 입주권이 나오지 않으니 단계를 먼저 확인하세요.</p>'))
    # 27차(애드센스 3차): 표를 읽는 법 — 두 조건(낮은 용적률 · 넓은 대지지분)을 함께 갖춘 단지 수 · 아직 정비구역 밖인 곳(자료에서 센 값만)
    both = [r for r in rows if r['far'] and r['ld'] and r['far'] <= 200 and r['ld'] >= 40]
    bothN = [r for r in both if not r['z']]
    if F and LDv:
        S.append(('표를 볼 때', f'<p>용적률이 200% 이하이면서 세대당 대지지분이 40㎡ 이상인 단지는 {len(both):,}단지예요. 이 가운데 {len(bothN):,}단지는 아직 정비구역에 들어가지 않았어요. '
                  '두 숫자가 좋아도 단지 규모가 작거나 상가·도로 지분이 섞여 있으면 사업성이 떨어질 수 있어요. 반대로 용적률이 250%를 넘어도 서울시 정비계획에서 상한 용적률을 높여 주면 사업이 될 수 있어요. '
                  '그래서 이 표는 “어디가 오를까”가 아니라 “어느 단지가 재건축 조건을 얼마나 갖췄나”를 보는 출발점으로 쓰는 게 맞아요. 관심 단지는 구청 공람·고시와 안전진단 결과를 따로 확인하세요.</p>'))
    return ''.join(f'<h2>{t}</h2>{b}' for t, b in S)
NARR = narrative()
def _tr(r): return (
    f'<tr data-g="{esc(r["g"])}" data-z="{1 if r["z"] else 0}" data-far="{r["far"] or 999}"><td>{esc(r["g"])}<small>{esc(r["d"])}</small></td><td><b>{esc(r["n"])}</b>'
    + (f'<small><a href="../z/{r["z"]}">정비사업 진행 중 · {esc(r["zs"])}</a></small>' if r['z'] else '') +
    f'</td><td class="n">{r["y"]}<small>{NOWY - r["y"]}년</small></td><td class="n">{r["farS"]}<small>{r["hhS"]}</small></td><td class="n">{r["ldS"]}<small>{"세대당 대지" if r["ld"] else ""}</small></td><td class="n">{eok(r["m"])}<small>전용 {r["a"]}㎡ 가운데</small></td><td class="n">{r["c"]}건<small>최근 {r["w"]}개월</small></td></tr>'
    )
TOP = sorted(rows, key=lambda r: (-r['c'], r['g'], r['n']))[:100]; _top = {id(r) for r in TOP}
trs_top = ''.join(_tr(r) for r in TOP)
trs = ''.join(_tr(r) for r in rows if id(r) not in _top)
NREST = len(rows) - len(TOP)
_gr = collections.Counter(r['g'] for r in rows if id(r) not in _top)
opts = ''.join(f'<option value="{esc(g)}">{esc(g)} ({n})</option>' for g, n in sorted(_gr.items()))
desc = f"준공 30년이 지난 서울 아파트 {len(rows):,}단지의 실거래 가운데 값·거래 수·준공연도. 이미 정비사업이 진행 중인 {zN}단지는 구역 페이지로 연결. 데이터 기준 {UPD}."
LD = json.dumps({"@context": "https://schema.org", "@type": "Article", "headline": f"준공 30년 넘은 서울 아파트 {len(rows):,}단지", "description": desc, "inLanguage": "ko", "datePublished": "2026-10-17", "dateModified": UPD.replace('.', '-'),
                 "mainEntityOfPage": "https://jaegaebal.alwaysquestions.kr/guide/rebuild-30y", "image": "https://jaegaebal.alwaysquestions.kr/og.png", "author": {"@type": "Person", "name": "집핀 운영자", "url": "https://jaegaebal.alwaysquestions.kr/about"},
                 "publisher": {"@type": "Organization", "name": "집핀", "url": "https://jaegaebal.alwaysquestions.kr", "logo": "https://jaegaebal.alwaysquestions.kr/icon-512.png"}}, ensure_ascii=False).replace('</', '<\\/')
page = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<base href="/guide/">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>서울 재건축 연한 30년 넘은 아파트 {len(rows):,}단지 실거래 | 집핀 - 서울 재개발 지도</title>
<meta name="description" content="{esc(desc)}">
<meta name="color-scheme" content="light dark">
<link rel="canonical" href="https://jaegaebal.alwaysquestions.kr/guide/rebuild-30y">
<meta property="og:site_name" content="집핀"><meta property="og:title" content="서울 재건축 연한 30년 넘은 아파트 실거래">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="https://jaegaebal.alwaysquestions.kr/og.png">
<meta property="og:url" content="https://jaegaebal.alwaysquestions.kr/guide/rebuild-30y"><meta property="og:type" content="article"><meta property="og:locale" content="ko_KR"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{LD}</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" crossorigin>
<link rel="stylesheet" href="../pages.css">
<style>.rb-f{{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}}.rb-f select,.rb-f input{{min-height:38px;padding:0 10px;border:1px solid var(--border,#d6dae1);border-radius:10px;background:var(--surface,#fff);color:inherit;font:inherit}}.rb-w{{overflow-x:auto}}table.rb{{width:100%;border-collapse:collapse;font-size:14px;min-width:720px}}table.rb th,table.rb td{{padding:9px 8px;border-bottom:1px solid var(--border,#e5e7eb);text-align:left;vertical-align:top}}table.rb th{{font-size:12.5px;color:var(--text-3);font-weight:600;white-space:nowrap}}table.rb .n{{text-align:right;white-space:nowrap}}table.rb small{{display:block;font-size:12px;color:var(--text-3);margin-top:2px}}table.rb tr[hidden]{{display:none}}#rbCnt{{font-size:13px;color:var(--text-3)}}</style>
</head>
<body>
<header class="top"><div class="in"><a class="logo" href="/" aria-label="집핀 처음으로"><img class="logo-i" src="/icon-small.svg" width="28" height="28" alt=""><span class="logo-t">집핀</span><span class="logo-en" lang="en">Zippin</span><small class="logo-s">서울 재개발 지도</small></a><nav aria-label="사이트 메뉴"><a href="../">계산기</a><a href="../report/">월간 리포트</a><a href="../z/">구역별 페이지</a><a href="../guide/" aria-current="page">가이드·분석</a></nav></div></header>
<main>
<p class="eyebrow">재건축 · 데이터 기준 {UPD}</p>
<h1>준공 30년 넘은 서울 아파트 {len(rows):,}단지</h1>
<p class="byline">정리: 집핀 운영자 · <time datetime="2026-10-17">2026.10.17</time> 작성 · 매일 자동 갱신(<time datetime="{UPD.replace('.', '-')}">{UPD}</time> 자료)</p>
<p class="lede">재건축 연한(준공 30년)이 지난 서울 아파트 가운데 최근 실거래가 있는 단지를 모았어요. 이 가운데 <b>{zN}단지</b>는 이미 정비사업(재건축 등)이 진행 중이라 구역 페이지로 연결했고, 나머지는 아직 정비구역으로 잡히지 않은 단지예요.</p>
<div class="hbox"><b>읽는 법</b>준공 30년은 재건축을 시작할 수 있는 최소 조건일 뿐이에요. 실제 사업성은 용적률·대지지분·단지 규모·안전진단(재건축 진단) 결과에 달려 있는데, 용적률·세대수는 건축물대장 총괄표제부(여러 동이 한 대지에 있는 단지만 있음)에서 가져왔고, 대지지분은 대지면적÷세대수로 낸 세대당 평균이에요. 총괄표제부가 없는 단지는 '–'로 보여요. 가격은 최근 12개월(거래가 적으면 2024년 이후) 실거래 가운데 값이고 평형이 섞여 있어요.</div>
{NARR}
<h2>거래가 많은 100단지</h2>
<p class="meta">최근 실거래 수가 많은 순이에요. 나머지 {NREST:,}단지는 아래 표를 펼쳐 자치구·용적률로 걸러 볼 수 있어요.{f' 이름이 빌라·연립·주택이고 세대수가 30 미만이거나 대장에 없는 작은 공동주택 {len(SMALL)}곳은 재건축 단지로 보기 어려워 뺐어요.' if SMALL else ''}</p>
<div class="rb-w"><table class="rb"><thead><tr><th>구·동</th><th>단지</th><th class="n">준공</th><th class="n">용적률</th><th class="n">대지지분</th><th class="n">실거래 가운데 값</th><th class="n">거래 수</th></tr></thead><tbody>{trs_top}</tbody></table></div>
<details class="rb-d"><summary>나머지 {NREST:,}단지 표 펼치기(자치구·용적률로 거르기)</summary>
<div class="rb-f"><label>자치구 <select id="rbG"><option value="">서울 전체 ({NREST:,})</option>{opts}</select></label><label><input type="checkbox" id="rbZ"> 정비사업 진행 중 빼기</label><label><input type="checkbox" id="rbF"> 용적률 200% 이하</label><input id="rbQ" type="search" placeholder="단지·동 이름 검색" aria-label="단지·동 이름 검색"><span id="rbCnt"></span></div>
<div class="rb-w"><table class="rb"><thead><tr><th>구·동</th><th>단지</th><th class="n">준공</th><th class="n">용적률</th><th class="n">대지지분</th><th class="n">실거래 가운데 값</th><th class="n">거래 수</th></tr></thead><tbody id="rbB">{trs}</tbody></table></div>
</details>
<p class="note">자료: 서울시 건축물대장 총괄표제부(서울 열린데이터광장), 서울시 부동산 실거래가(아파트 매매, {esc(T['asOf']['sale'][:4])}.{esc(T['asOf']['sale'][4:6])}.{esc(T['asOf']['sale'][6:])}까지), 정비구역 필지 서울도시공간포털. 단지 이름은 실거래 신고 이름이라 실제 단지명과 다를 수 있어요. 투자 권유가 아니에요.</p>
<h2>출처</h2>
<ul class="links"><li><a href="https://data.seoul.go.kr/dataList/OA-23051/S/1/datasetView.do" target="_blank" rel="noopener">서울시 건축물대장 총괄표제부 · 서울 열린데이터광장</a> — 용적률·세대수·대지면적·사용승인일</li><li><a href="https://data.seoul.go.kr/dataList/OA-21275/S/1/datasetView.do" target="_blank" rel="noopener">서울시 부동산 실거래가 정보(국토교통부 신고 자료) · 서울 열린데이터광장</a> — 단지 이름·준공연도·매매 가운데 값·거래 수</li><li><a href="https://urban.seoul.go.kr" target="_blank" rel="noopener">서울도시공간포털</a> — 정비구역 경계·필지(이미 정비사업 중인 단지 표시)</li><li><a href="../method">집핀 계산 방법</a> — 가운데 값·기간 기준</li></ul>
<h2>함께 읽기</h2>
<ul class="links"><li><a href="/guide/redevelop-vs-rebuild">같은 돈으로 재개발과 재건축은 무엇이 다를까</a></li><li><a href="/guide/ipjugwon">조합설립인가 뒤에 사도 입주권이 나오나</a></li><li><a href="/guide/jungong">재개발 단계별로 10년 안에 준공될 확률</a></li><li><a href="/guide/status">서울 정비사업, 지금 어느 단계에 몇 곳</a></li><li><a href="/gu/">구별 페이지: 구마다 진행 중인 정비사업</a></li></ul>
<p class="meta">계산 방식과 자료: <a href="/method">계산 방법</a> · <a href="/about">집핀 소개</a> · <a href="/">찾기에서 내 돈으로 갈 수 있는 구역 보기 →</a></p>
</main>
<footer class="f"><p><a href="../report/">월간 리포트</a> · <a href="../z/">구역별 페이지</a> · <a href="../guide/">가이드·분석</a> · <a href="../about">소개</a> · <a href="../method">출처·계산 방법</a> · <a href="../privacy"><b>개인정보처리방침</b></a></p><p class="f-c">© 2026 집핀 · 데이터 기준 {UPD}</p></footer>
<script>
(function(){{var G=document.getElementById('rbG'),Z=document.getElementById('rbZ'),F=document.getElementById('rbF'),Q=document.getElementById('rbQ'),C=document.getElementById('rbCnt'),R=[].slice.call(document.querySelectorAll('#rbB tr'));
function f(){{var g=G.value,z=Z.checked,q=Q.value.trim(),n=0;R.forEach(function(r){{var ok=(!g||r.dataset.g===g)&&(!z||r.dataset.z==='0')&&(!F.checked||+r.dataset.far<=200)&&(!q||r.textContent.indexOf(q)>=0);r.hidden=!ok;if(ok)n++;}});C.textContent=n.toLocaleString()+'단지';}}
G.onchange=f;Z.onchange=f;F.onchange=f;Q.oninput=f;f();}})();
</script>
</body>
</html>
'''
open(os.path.join(ROOT, 'public/guide/rebuild-30y.html'), 'w', encoding='utf-8').write(page)
print('rebuild-30y', len(rows), 'in zone', zN, dict(fill), 'far', sum(1 for r in rows if r['far']))
# 7차: /guide/ 목록의 이 글 소개도 같은 숫자(목록에 1,077·245로 고정돼 본문 1,058·234와 달랐던 것) · 숫자는 <!--zk--> 덩이라 사이트맵 lastmod를 매일 바꾸지 않는다
_HP = os.path.join(ROOT, 'public/guide/index.html')
if os.path.exists(_HP):
    _h = open(_HP, encoding='utf-8').read()
    _h2 = re.sub(r'(<a href="/guide/rebuild-30y">준공 30년 넘은 서울 아파트 )(?:<!--zk-->)?[\d,]+(?:<!--/zk-->)?(단지)', lambda m: f'{m.group(1)}<!--zk-->{len(rows):,}<!--/zk-->{m.group(2)}', _h, count=1)
    _h2 = re.sub(r'(구별로 모았어요\. )(?:<!--zk-->)?[\d,]+(?:<!--/zk-->)?(단지는 이미 정비사업이 진행 중이라)', lambda m: f'{m.group(1)}<!--zk-->{zN:,}<!--/zk-->{m.group(2)}', _h2, count=1)
    if _h2 != _h: open(_HP, 'w', encoding='utf-8').write(_h2); print('guide hub rebuild-30y', len(rows), zN)
