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
byId = {r['id']: r for r in D['recs']}
in_zone = {}
for rid, v in PAR.items():
    r = byId.get(rid)
    if not r or r.get('src') == 'moa': continue
    for p in v.get('p', []): in_zone.setdefault(p[0], rid)
NOWY = datetime.date.today().year
rows = []
for p, v in T['apt'].items():
    yr = v.get('yr')
    if not yr or NOWY - yr < 30: continue
    gd = inv.get(p[:10], '|').split('|')
    zid = in_zone.get(p)
    rows.append({'g': gd[0], 'd': gd[1], 'n': v['name'], 'y': yr, 'c': v['n'], 'w': v.get('win', 12), 'm': v['med'], 'a': v.get('area_med'), 'l': v['last'], 'z': zid,
                 'zs': (byId[zid].get('sr') if zid else '')})
rows.sort(key=lambda x: (x['g'], -x['c']))
UPD = (D.get('upd') or '').replace('-', '.')
guN = collections.Counter(r['g'] for r in rows)
zN = sum(1 for r in rows if r['z'])
eok = lambda v: f"{v/10000:.1f}억".replace('.0억', '억')
trs = ''.join(
    f'<tr data-g="{esc(r["g"])}" data-z="{1 if r["z"] else 0}"><td>{esc(r["g"])}<small>{esc(r["d"])}</small></td><td><b>{esc(r["n"])}</b>'
    + (f'<small><a href="../z/{r["z"]}">정비사업 진행 중 · {esc(r["zs"])}</a></small>' if r['z'] else '') +
    f'</td><td class="n">{r["y"]}<small>{NOWY - r["y"]}년</small></td><td class="n">{eok(r["m"])}<small>전용 {r["a"]}㎡ 가운데</small></td><td class="n">{r["c"]}건<small>최근 {r["w"]}개월</small></td></tr>'
    for r in rows)
opts = ''.join(f'<option value="{esc(g)}">{esc(g)} ({n})</option>' for g, n in sorted(guN.items()))
desc = f"준공 30년이 지난 서울 아파트 {len(rows):,}단지의 실거래 가운데 값·거래 수·준공연도. 이미 정비사업이 진행 중인 {zN}단지는 구역 페이지로 연결. 데이터 기준 {UPD}."
page = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<base href="/guide/">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>서울 재건축 연한 30년 넘은 아파트 {len(rows):,}단지 실거래 | 얼마면 재개발</title>
<meta name="description" content="{esc(desc)}">
<meta name="color-scheme" content="light dark">
<link rel="canonical" href="https://jaegaebal.alwaysquestions.kr/guide/rebuild-30y">
<meta property="og:title" content="서울 재건축 연한 30년 넘은 아파트 실거래">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="https://jaegaebal.alwaysquestions.kr/og.png">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" crossorigin>
<link rel="stylesheet" href="../pages.css">
<style>.rb-f{{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}}.rb-f select,.rb-f input{{min-height:38px;padding:0 10px;border:1px solid var(--border,#d6dae1);border-radius:10px;background:var(--surface,#fff);color:inherit;font:inherit}}.rb-w{{overflow-x:auto}}table.rb{{width:100%;border-collapse:collapse;font-size:14px;min-width:560px}}table.rb th,table.rb td{{padding:9px 8px;border-bottom:1px solid var(--border,#e5e7eb);text-align:left;vertical-align:top}}table.rb th{{font-size:12.5px;color:var(--text-3);font-weight:600;white-space:nowrap}}table.rb .n{{text-align:right;white-space:nowrap}}table.rb small{{display:block;font-size:12px;color:var(--text-3);margin-top:2px}}table.rb tr[hidden]{{display:none}}#rbCnt{{font-size:13px;color:var(--text-3)}}</style>
</head>
<body>
<header class="top"><div class="in"><a class="logo" href="../">얼마면 <span>재개발</span></a><nav aria-label="사이트 메뉴"><a href="../">계산기</a><a href="../report/">월간 리포트</a><a href="../z/">구역별 페이지</a><a href="../guide/" aria-current="page">가이드·분석</a></nav></div></header>
<main>
<p class="eyebrow">재건축 · 데이터 기준 {UPD}</p>
<h1>준공 30년 넘은 서울 아파트 {len(rows):,}단지</h1>
<p class="lede">재건축 연한(준공 30년)이 지난 서울 아파트 가운데 최근 실거래가 있는 단지를 모았어요. 이 가운데 <b>{zN}단지</b>는 이미 정비사업(재건축 등)이 진행 중이라 구역 페이지로 연결했고, 나머지는 아직 정비구역으로 잡히지 않은 단지예요.</p>
<div class="hbox"><b>읽는 법</b>준공 30년은 재건축을 시작할 수 있는 최소 조건일 뿐이에요. 실제 사업성은 용적률·대지지분·단지 규모·안전진단(재건축 진단) 결과에 달려 있는데, 이 목록에는 아직 용적률·대지지분이 없어요. 가격은 최근 12개월(거래가 적으면 2024년 이후) 실거래 가운데 값이고 평형이 섞여 있어요.</div>
<div class="rb-f"><label>자치구 <select id="rbG"><option value="">서울 전체 ({len(rows):,})</option>{opts}</select></label><label><input type="checkbox" id="rbZ"> 정비사업 진행 중 빼기</label><input id="rbQ" type="search" placeholder="단지·동 이름 검색" aria-label="단지·동 이름 검색"><span id="rbCnt"></span></div>
<div class="rb-w"><table class="rb"><thead><tr><th>구·동</th><th>단지</th><th class="n">준공</th><th class="n">실거래 가운데 값</th><th class="n">거래 수</th></tr></thead><tbody id="rbB">{trs}</tbody></table></div>
<p class="note">자료: 서울시 부동산 실거래가(아파트 매매, {esc(T['asOf']['sale'][:4])}.{esc(T['asOf']['sale'][4:6])}.{esc(T['asOf']['sale'][6:])}까지), 정비구역 필지 서울도시공간포털. 단지 이름은 실거래 신고 이름이라 실제 단지명과 다를 수 있어요. 투자 권유가 아니에요.</p>
</main>
<footer class="f"><p><a href="../report/">월간 리포트</a> · <a href="../z/">구역별 페이지</a> · <a href="../guide/">가이드·분석</a> · <a href="../about">소개</a> · <a href="../method">출처·계산 방법</a> · <a href="../privacy"><b>개인정보처리방침</b></a></p><p class="f-c">© 2026 얼마면 재개발 · 데이터 기준 {UPD}</p></footer>
<script>
(function(){{var G=document.getElementById('rbG'),Z=document.getElementById('rbZ'),Q=document.getElementById('rbQ'),C=document.getElementById('rbCnt'),R=[].slice.call(document.querySelectorAll('#rbB tr'));
function f(){{var g=G.value,z=Z.checked,q=Q.value.trim(),n=0;R.forEach(function(r){{var ok=(!g||r.dataset.g===g)&&(!z||r.dataset.z==='0')&&(!q||r.textContent.indexOf(q)>=0);r.hidden=!ok;if(ok)n++;}});C.textContent=n.toLocaleString()+'단지';}}
G.onchange=f;Z.onchange=f;Q.oninput=f;f();}})();
</script>
</body>
</html>
'''
open(os.path.join(ROOT, 'public/guide/rebuild-30y.html'), 'w', encoding='utf-8').write(page)
print('rebuild-30y', len(rows), 'in zone', zN)
