#!/usr/bin/env python3
"""src/ → public/index.html 조립. 사용: python3 tools/build.py"""
import json, hashlib, os, re, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(R, 'tools')); import brand   # 서비스 이름은 tools/brand.py 한 곳
S = lambda p: open(os.path.join(R, 'src', p), encoding='utf-8').read()
shell = brand.sub(S('shell.html'))
EN = os.path.join(R, 'pipeline', 'data.enriched.json')
D = json.load(open(EN, encoding='utf-8')) if os.path.exists(EN) else json.loads(S('data.json'))
# 사이클 4 D1: 홈 미니 서울 지도(SVG 구 채움 · 숫자 단추 자리) — tools/hm_map.py · 숫자는 섬·앱이 src/hmini.js로 채운다
import hm_map
assert shell.count('/*HMMAP*/') == 1
shell = shell.replace('/*HMMAP*/', hm_map.build(D), 1)
# 사이클 2(부칙 판정 · app.js b18Of): 재개발 사업시행인가일이 2018.1.25~2020.1.24인데 신청일(b18p) 자료가 없는 구역 → b18a(인가일)
#   첫 화면 엔진(목록·calc.json)과 시트가 같은 판정('신청일 확인 필요')을 내게 — premium.json(나중에 받음)의 날짜를 기다리지 않는다
try:
    _PD = json.load(open(os.path.join(R, 'public', 'premium.json'), encoding='utf-8'))
    for _r in D['recs']:
        _a = str(((_PD.get(_r['id']) or {}).get('dt') or {}).get('사업시행') or '')[:10]
        if '재개발' in (_r.get('k') or '') and (_r.get('s') or 0) < 9 and not _r.get('b18') and not _r.get('b18p') and '2018-01-25' <= _a < '2020-01-25': _r['b18a'] = _a
except Exception as _e: print('b18a 건너뜀:', _e)
# 사이클 4: 투기과열지구 구별 지정 이력(tools/tgj.json · 출처·확인일 포함) → D.policy.tgj · 매수 시점 규칙(ZFX.tgj)이 이것만 읽는다
#   최근 보도 경고(tools/notices.json · 관리처분 임박 등) → r.notice — 단계·날짜 자료는 바꾸지 않는다(enrich를 다시 돌리지 않고 빌드 때 붙임)
try:
    D.setdefault('policy', {})['tgj'] = {k: v for k, v in json.load(open(os.path.join(R, 'tools', 'tgj.json'), encoding='utf-8')).items() if k != '_doc'}
    _NTC = {k: v for k, v in json.load(open(os.path.join(R, 'tools', 'notices.json'), encoding='utf-8')).items() if k != '_doc'}
    for _r in D['recs']:
        _r.pop('notice', None)
        if _r['id'] in _NTC: _r['notice'] = _NTC[_r['id']]
except Exception as _e: print('tgj·notice 건너뜀:', _e)
# 첫 화면 정적 글자(눈썹·요약·읽을거리 소개)의 '진행 중 N곳'을 자료와 같게(앱이 그린 뒤의 숫자 · /api count와 같은 기준) — 같은 곳 합치기 등으로 수가 바뀌어도 어긋나지 않게
_LIVE = sum(1 for r in D['recs'] if not (r.get('s', 0) >= 9 or (r.get('dn') and r.get('s', 0) < 7)) and r.get('src') != 'moa' and r.get('n'))
shell = re.sub(r'(진행 중(?: 정비사업)? |<span class="eb-s">서울 정비사업 )[\d,]+(곳)', lambda m: f"{m.group(1)}{_LIVE:,}{m.group(2)}", shell)
shell = re.sub(r'(<span class="dt">진행 중 정비사업</span><span class="dd"><b data-n=")\d+(">)[\d,]+(<)', lambda m: f"{m.group(1)}{_LIVE}{m.group(2)}{_LIVE:,}{m.group(3)}", shell)
# 목록 줄의 작은 실거래 흐름선용 경량 파일(tx.json 1.8MB 대신 구역별 최근 8분기 값만) → 첫 화면에서 tx.json을 안 받는다
TXF = os.path.join(R, 'public', 'data', 'tx.json')
if os.path.exists(TXF):
    try:
        T = json.load(open(TXF, encoding='utf-8'))
        TS = {}
        for i, v in T.items():
            q = (((v or {}).get('x') or {}).get('hd') or {}).get('q') if isinstance(v, dict) else None
            if q: TS[i] = [[e[0], e[1]] for e in q[-8:] if isinstance(e, list) and len(e) >= 2]
        body = json.dumps(TS, ensure_ascii=False, separators=(',', ':'))
        TSF = os.path.join(R, 'public', 'data', 'txs.json')
        if not os.path.exists(TSF) or open(TSF, encoding='utf-8').read() != body: open(TSF, 'w', encoding='utf-8').write(body)
    except Exception as e: print('txs.json 건너뜀:', e)
# 구역·구 경계 geo.json 가볍게(같은 구조, 점 줄이기) — 원본은 pipeline/geo.full.json
try:
    import sys; sys.path.insert(0, os.path.join(R, 'tools')); import geo_slim; geo_slim.main()
except Exception as e: print('geo_slim 건너뜀:', e)
# 지연 로딩 데이터 파일 버전(내용 해시) → 캐시 무효화
dv = {}
for f in sorted(os.listdir(os.path.join(R, 'public', 'data'))) if os.path.isdir(os.path.join(R, 'public', 'data')) else []:
    if f.endswith('.json'):
        dv[f[:-5]] = hashlib.md5(open(os.path.join(R, 'public', 'data', f), 'rb').read()).hexdigest()[:8]
if dv: D['dv'] = dv
# 첫 화면 '최신 월간 리포트' 배너: 생성기가 만든 최신 호가 더 새로우면 교체
LT = os.path.join(R, 'pipeline', 'report', 'latest.json')
if os.path.exists(LT):
    lt = json.load(open(LT, encoding='utf-8'))
    m = re.search(r'(<script type="application/json" id="monthlyData">)(.*?)(</script>)', shell, re.S)
    if m and lt.get('items'):
        cur = json.loads(m.group(2))
        if lt['ym'] > cur.get('ym', ''):
            new = {'ym': lt['ym'], 'no': lt['no'], 'url': lt['url'], 'items': [{'id': i['id'], 'step': i['step'], 'date': i['date'], 'src': ''} for i in lt['items']]}
            shell = shell[:m.start(2)] + json.dumps(new, ensure_ascii=False) + shell[m.end(2):]
# 8차: latest.json이 없거나(부분 호는 report.py가 안 씀) 그보다 새 호를 냈으면 — 낸 호 목록(issues.json)의 최신 호로 바꾼다.
# 인가 목록은 그 호 페이지의 '이달 단계가 바뀐 구역' 줄을 읽기만 한다(날짜 미등록은 빈 날짜 · 페이지는 건드리지 않음)
_IS = os.path.join(R, 'pipeline', 'report', 'issues.json')
_m0 = re.search(r'(<script type="application/json" id="monthlyData">)(.*?)(</script>)', shell, re.S)
if _m0 and os.path.exists(_IS):
    try:
        _cur = json.loads(_m0.group(2))
        _pub = [i for i in json.load(open(_IS, encoding='utf-8')) if not i.get('draft')]
        _top = max(_pub, key=lambda i: i['ym']) if _pub else None
        _RP = _top and os.path.join(R, 'public', 'report', _top['ym'] + '.html')
        if _top and _top['ym'] > _cur.get('ym', '') and os.path.exists(_RP):
            _h = open(_RP, encoding='utf-8').read()
            _ol = re.search(r'<ol class="rp-tl">(.*?)</ol>', _h, re.S)
            _L2 = {'추진위원회 승인': '추진위', '정비구역 지정': '구역지정', '조합설립인가': '조합설립', '사업시행인가': '사업시행', '관리처분인가': '관리처분'}
            _it = []
            for _li in re.findall(r'<li>(.*?)</li>', _ol.group(1) if _ol else '', re.S):
                _d = re.search(r'<span class="rp-d">(\d{1,2})\.(\d{1,2})</span>', _li); _z = re.search(r'href="\.\./z/(o\d+)"', _li)
                _k = next((v for k, v in _L2.items() if '<br>' + k in _li), None)
                if _z and _k: _it.append({'id': _z.group(1), 'step': _k, 'date': f"{_top['ym'][:4]}-{int(_d.group(1)):02d}-{int(_d.group(2)):02d}" if _d else '', 'src': ''})
            new = {'ym': _top['ym'], 'no': _top['no'], 'url': f"report/{_top['ym']}", 'items': _it}
            shell = shell[:_m0.start(2)] + json.dumps(new, ensure_ascii=False) + shell[_m0.end(2):]
    except Exception as e: print('monthlyData 최신 호 건너뜀:', e)
# 24차: 첫 화면 '재개발 공부하기' 첫 줄 = 가장 최근에 낸 월간 리포트(색인 안 하는 초안은 건너뜀)
_RD = os.path.join(R, 'public', 'report')
_iss = sorted((f for f in (os.listdir(_RD) if os.path.isdir(_RD) else []) if re.match(r'\d{4}-\d{2}\.html$', f)), reverse=True)
for _f in _iss:
    _h = open(os.path.join(_RD, _f), encoding='utf-8').read()
    if 'name="robots" content="noindex' in _h: continue
    _m = re.search(r'<h1[^>]*>(.*?)</h1>', _h, re.S)
    if _m:
        _t = re.sub(r'<[^>]+>', '', _m.group(1)).strip()
        shell = re.sub(r'<a class="sr-r" href="report/[^"]*" id="sReadsRpt">(<span class="sr-k">[^<]*</span>)<span class="sr-t">[^<]*</span>',
                       lambda m: f'<a class="sr-r" href="report/{_f[:-5]}" id="sReadsRpt">{m.group(1)}<span class="sr-t">{_t.replace("&", "&amp;").replace("<", "&lt;")}</span>', shell, count=1)
        # 25차: 목록 위 '읽을거리' 한 줄의 리포트 링크도 같은 호로(‘10월 리포트’)
        shell = re.sub(r'<a href="report/[^"]*" id="sRdRpt">[^<]*</a>', f'<a href="report/{_f[:-5]}" id="sRdRpt">{int(_f[5:7])}월 리포트</a>', shell, count=1)
        # 7차: 아래 '읽을거리' 리포트 카드도 같은 호(제목·3줄 요약은 그 호 페이지에서 그대로) — 10월호를 냈는데 카드는 3호(9월)이던 것
        _s3 = re.search(r'<div class="sum3"><b>3줄 요약</b><ol>(.*?)</ol>', _h, re.S)
        _no = re.search(r'리포트 · (\d+)호 · ', _h)
        if _s3 and _no:
            _li = re.sub(r'<(?!/?li\b)[^>]+>', '', _s3.group(1))
            _ym = _f[:-5]; _M = int(_ym[5:7])
            _card = f'<article class="rd-card"><span class="rd-k">월간 리포트 {_no.group(1)}호 · {_ym[:4]}년 {_M}월분</span><h3><a href="report/{_ym}">{_t.replace("&", "&amp;").replace("<", "&lt;")}</a></h3><ol>{_li}</ol><a class="rd-go" href="report/{_ym}">{_M}월 리포트 전체 보기 →</a></article>'
            shell = re.sub(r'<article class="rd-card"><span class="rd-k">월간 리포트 .*?</article>', lambda m: _card, shell, count=1, flags=re.S)
    break
# 리뉴얼 A5: 홈 소개 글(#sReads)의 '최신 리포트 요약' = 가장 최근에 낸 호(색인하는 호)의 제목·설명(JSON-LD headline·description)
for _f in _iss:
    _h = open(os.path.join(_RD, _f), encoding='utf-8').read()
    if 'name="robots" content="noindex' in _h: continue
    _ld = re.search(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', _h, re.S)
    try: _j = json.loads(_ld.group(1)) if _ld else {}
    except Exception: _j = {}
    _no = re.search(r'리포트 · (\d+)호 · ', _h)
    _hd, _ds = (_j.get('headline') or '').strip(), (_j.get('description') or '').strip()
    if _hd and _ds:
        _e = lambda x: x.replace('&', '&amp;').replace('<', '&lt;')
        shell = re.sub(r'<p class="st-l" id="sStRptK">[^<]*</p>', f'<p class="st-l" id="sStRptK">월간 리포트 · {int(_f[:4])}년 {int(_f[5:7])}월분' + (f' {_no.group(1)}호' if _no else '') + '</p>', shell, count=1)
        shell = re.sub(r'<a href="report/[^"]*" id="sStRpt">[^<]*</a>', f'<a href="report/{_f[:-5]}" id="sStRpt">{_e(_hd)}</a>', shell, count=1)
        shell = re.sub(r'<p id="sStRptD">[^<]*</p>', f'<p id="sStRptD">{_e(_ds)}</p>', shell, count=1)
    break
# 7차: /about '지금까지 낸 리포트'도 낸 호 전체(새 호가 빠져 3호까지만 있던 것)
_AB = os.path.join(R, 'public', 'about.html')
if os.path.exists(_AB):
    _a = open(_AB, encoding='utf-8').read(); _L = []
    for _f in _iss:
        _h = open(os.path.join(_RD, _f), encoding='utf-8').read()
        if 'name="robots" content="noindex' in _h: continue
        _m = re.search(r'<h1[^>]*>(.*?)</h1>', _h, re.S); _no = re.search(r'리포트 · (\d+)호 · ', _h)
        if _m and _no: _L.append(f'<li><a href="report/{_f[:-5]}">{_f[:4]}년 {int(_f[5:7])}월분 ({_no.group(1)}호)</a>: {re.sub(r"<[^>]+>", "", _m.group(1)).strip()}</li>')
    if _L:
        _a2 = re.sub(r'(<h2>지금까지 낸 리포트</h2>\n<ul>).*?(</ul>)', lambda m: m.group(1) + ''.join(_L) + m.group(2), _a, count=1, flags=re.S)
        if _a2 != _a: open(_AB, 'w', encoding='utf-8').write(_a2); print('about: 리포트', len(_L), '호')
PJ = os.path.join(R, 'public', 'premium.json')
if os.path.exists(PJ):
    pv = hashlib.md5(open(PJ, 'rb').read()).hexdigest()[:8]
    shell = re.sub(r'("prem":\s*")premium\.json[^"]*(")', lambda m: m.group(1) + 'premium.json?v=' + pv + m.group(2), shell)
# 머리·푸터의 데이터 기준 한 줄(앱 JS의 ZP_fresh와 같은 글) — 첫 화면부터 채워 두면 JS가 채울 때 줄이 밀리지 않는다
def _md(x):
    m = re.search(r'(\d{4})-?(\d\d)-?(\d\d)', x or '')
    return f'{int(m.group(2))}.{m.group(3)}' if m else ''
_t, _u = _md((D.get('txAsOf') or {}).get('sale')), _md(D.get('upd') or D.get('asOf'))
FRESH = (f'실거래 {_t} 신고분까지' + (f' · {_u} 갱신' if _u else '')) if _t else f'{_u} 갱신'
shell = shell.replace('<span class="asof" id="asof"></span>', f'<span class="asof" id="asof">{FRESH}</span>', 1).replace('<span id="footAsof"></span>', f'<span id="footAsof">{FRESH}</span>', 1)
# 역 이름 고치기·새 역 넣기·가까운 역 다시 고르기 — tools/stfix.py 한 곳(api.py도 같은 함수 · 앱 화면·/z·API의 '가까운 역'이 같게)
from stfix import st_fix
st_fix(D)
data = json.dumps(D, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
EXT = os.path.join(R, 'src', 'ext')
ext_js = ''.join(open(os.path.join(EXT, f), encoding='utf-8').read() for f in sorted(os.listdir(EXT)) if f.endswith('.js'))
ext_css = ''.join(open(os.path.join(EXT, f), encoding='utf-8').read() for f in sorted(os.listdir(EXT)) if f.endswith('.css'))
# 사이클 2(B): app.js 맨 위 문장 경계에 쉬는 자리를 더(약 150줄마다) — /*Y*/ 사이 한 덩이가 260ms@4×까지 컸다.
# 닫힘 범위 맨 위(들여쓰기 2칸)의 function·const·let 줄이고 바로 앞 줄이 문장 끝(; } ,가 아닌 })일 때만 — 식·템플릿 중간에는 안 넣는다. 확장 모듈(/*EXT*/ 자리)은 위 모듈 경계에서.
def _auto_y(src, every=150):
    L = src.split('\n'); out = []; last = 0; depth_ok = True
    for i, l in enumerate(L):
        prev = next((x for x in reversed(out) if x.strip()), '')
        if (i - last >= every and re.match(r'^  (async function|function|const|let) [A-Za-z_$]', l)
                and (prev.rstrip().endswith(';') or prev.rstrip() == '  }' or prev.rstrip().endswith('*/'))):
            out.append('  /*YW*/'); last = i
        out.append(l)
    return '\n'.join(out)
js = _auto_y(S('app.js')); assert js.count('/*EXT*/') == 1; js = js.replace('/*EXT*/', ext_js.strip() + '\n')
# pre-adsense 5: 앱 코드(a.js) 첫 실행을 몇 덩이로 — 4배 느린 CPU에서 a.js 실행 한 덩이(350~420ms)가 첫 화면 가장 긴 작업이었다.
# 확장 모듈이 app.js 닫힘 범위를 함께 써서 파일로 나누면 모듈 구조를 다 바꿔야 하므로, 같은 파일 안에서 실행만 나눈다:
# 함수 전체를 async로 두고 /*Y*/ 자리(맨 위 문장 경계)와 큰 확장 모듈 사이에서 scheduler.yield()로 한 번씩 쉰다.
# 설치 앱(html.is-tapp)이고 scheduler.yield가 있을 때만 쉰다 — 웹·다른 브라우저는 await가 한 번도 없어 예전처럼 한 번에 끝까지(동작 그대로).
# 다 돌면 window.ZP_aWait가 풀리고, boot.js는 그 뒤에 '붙음(zp:hydrated)'을 낸다. 웹 묶음(a.*.js)은 쉬는 자리 없는 예전 그대로이고, 나눠 도는 판은 설치 앱 전용 묶음(ta.*.js)으로 따로 낸다(웹은 받지 않음).
_Y = 'if (__Y) await __Y();'
js_y = js
js = js.replace('  /*Y*/\n', '').replace('/*Y*/', '').replace('  /*YW*/\n', '').replace('/*YW*/', '')   # 웹 묶음(a): 쉬는 자리 없이 예전 그대로(한 번에 끝까지)
# 사이클 2(B): 큰 모듈 5개 뒤에만 쉬던 것을 확장 모듈마다(작은 것은 이웃과 묶여도 됨) — 70_pins 뒤 남은 모듈 + app.js 앞부분이 한 덩이(~310ms@4×)였다.
# 모듈은 같은 닫힘 범위의 맨 위 문장들이라 모듈 경계는 늘 문장 경계다.
_Y5 = ('10_lmap.js', '20_zone.js', '60_simple.js', '64_overview.js', '70_pins.js')   # 설치 앱(ta)도 쉬는 예전 자리
_YW = 'if (__YW) await __YW();'   # 사이클 2: 웹에서만 쉬는 자리(설치 앱 ta는 예전 자리만 — 앱 첫 화면 LCP 그대로)
for _m in sorted(f for f in os.listdir(EXT) if f.endswith('.js') and os.path.getsize(os.path.join(EXT, f)) > 1500):
    _src = open(os.path.join(EXT, _m), encoding='utf-8').read().strip()
    assert js_y.count(_src) == 1, _m
    js_y = js_y.replace(_src, _src + '\n' + (_Y if _m in _Y5 else _YW), 1)
assert js_y.count('/*Y*/') >= 8
js_y = js_y.replace('/*Y*/', _Y).replace('/*YW*/', _YW)
if os.environ.get('ZP_YMARK'):   # 측정용: 쉬는 자리마다 performance.mark('zpY<n>') — 덩이 크기 재기(배포 빌드에는 안 씀)
    _k = [0]
    def _ym(m): _k[0] += 1; return f'try {{ performance.mark("zpY{_k[0]}"); }} catch (e) {{}} ' + m.group(0)
    js_y = re.sub(re.escape(_Y), _ym, js_y)
assert js_y.startswith('(function () {\n  "use strict";\n') and js_y.rstrip().endswith('})();')
js_y = ('(async function () {\n  "use strict";\n'
      '  const __Y = document.documentElement.classList.contains("is-tapp") && window.scheduler && typeof scheduler.yield === "function" ? () => scheduler.yield() : null;\n'
      '  const __YW = null;\n'
      '  if (__Y) window.ZP_aWait = new Promise((r) => (window.ZP_aDone = r));\n'

      # 덩이 사이에 끼어들 수 있는 예약(setTimeout·setInterval·requestAnimationFrame)은 실행이 다 끝날 때까지 잡아 두었다가 같은 순서·남은 시간으로 — 한 번에 돌던 예전과 같은 차례(뒤 덩이 정의를 앞서 부르지 않게)
      '  if (__Y) { const W = window, st = W.setTimeout, ct = W.clearTimeout, si = W.setInterval, ci = W.clearInterval, ra = W.requestAnimationFrame, ca = W.cancelAnimationFrame, q = [], m = new Map(); let n = 0, on = 1;\n'
      '    const hold = (k, real) => function (f, d, ...a) { if (!on || typeof f !== "function") return real.apply(W, arguments); const id = -(++n); q.push({ k, id, f, d: +d || 0, a, at: performance.now() }); return id; };\n'
      '    const drop = (real) => function (id) { if (typeof id === "number" && id < 0) { if (m.has(id)) return real.call(W, m.get(id)); const i = q.findIndex((x) => x.id === id); if (i >= 0) q.splice(i, 1); return; } return real.apply(W, arguments); };\n'
      '    W.setTimeout = hold("t", st); W.setInterval = hold("i", si); W.requestAnimationFrame = hold("r", ra); W.clearTimeout = drop(ct); W.clearInterval = drop(ci); W.cancelAnimationFrame = drop(ca);\n'
      '    W.ZP_aRel = () => { if (!on) return; on = 0; W.setTimeout = st; W.setInterval = si; W.requestAnimationFrame = ra; const now = performance.now(); for (const x of q) m.set(x.id, x.k === "r" ? ra.call(W, x.f) : (x.k === "t" ? st : si).call(W, x.f, x.k === "t" ? Math.max(0, x.d - (now - x.at)) : x.d, ...x.a)); q.length = 0; }; }\n'
      + js_y[len('(function () {\n  "use strict";\n'):].rstrip()[:-len('})();')]
      + '\n  if (window.ZP_aRel) window.ZP_aRel(); if (window.ZP_aDone) window.ZP_aDone();\n})().catch((e) => { try { window.ZP_aRel && window.ZP_aRel(); window.ZP_aDone && window.ZP_aDone(); } catch (x) {} setTimeout(() => { throw e; }, 0); });\n')
# 사이클 2 성능(B 트랙): 웹 묶음(a)도 같은 자리에서 쉰다 — 4×CPU 폰에서 a.js 첫 실행 한 덩이(420~500ms)가 홈·#map의 가장 긴 작업 중 하나였다.
# 쉬는 조건만 다르다: 설치 앱 판(ta)은 html.is-tapp일 때, 웹 판(a)은 scheduler.yield가 있는 브라우저 전부(크롬 129+ · 없으면 예전처럼 한 번에).
# 실행 순서·예약(setTimeout·rAF) 차례는 ta와 같은 방식으로 지킨다(위 hold/ZP_aRel). ZP_WEB_YIELD=0 이면 예전 웹 판(쉬지 않음).
_GATE = 'document.documentElement.classList.contains("is-tapp") && window.scheduler'
assert js_y.count(_GATE) == 1
if os.environ.get('ZP_WEB_YIELD', '1') != '0':
    js = js_y.replace(_GATE, 'window.scheduler', 1)
    assert js.count('  const __YW = null;\n') == 1
    js = js.replace('  const __YW = null;\n', '  const __YW = __Y;\n', 1)

# 21차: 새 소식 'N' 점의 기준 날짜(경매 물건이 처음 보인 날 · 고시·공고 기록 날 중 가장 늦은 날) — 63_newb.js · 정적 페이지(static_tabs.py)가 같은 값
def newd():
    o = {}
    try:
        a = json.load(open(os.path.join(R, 'public', 'data', 'auction.json'), encoding='utf-8'))
        fs = [x.get('fs') or '' for v in (a.get('byZone') or {}).values() for x in v if x.get('fs')]
        if fs: o['auc'] = max(fs)
    except Exception as e: print('newd auction', e)
    try:
        n = json.load(open(os.path.join(R, 'public', 'data', 'notice.json'), encoding='utf-8'))
        ds = [i[0] for i in n.get('items') or [] if i and i[0]]
        if ds: o['ntc'] = max(ds)
    except Exception as e: print('newd notice', e)
    return o
NEWD = newd()
assert js.count('/*NEWD*/ null') == 1; js = js.replace('/*NEWD*/ null', json.dumps(NEWD)); js_y = js_y.replace('/*NEWD*/ null', json.dumps(NEWD))
assert shell.count('/*NEWD0*/{}') == 1; shell = shell.replace('/*NEWD0*/{}', json.dumps(NEWD))   # 23차: 첫 페인트 N 점(shell.html 작은 스크립트)
_ud = _md(D.get('upd') or D.get('asOf'))
_uf = (lambda m: f'{m.group(1)}.{m.group(2)}.{m.group(3)}' if m else '')(re.search(r'(\d{4})-?(\d\d)-?(\d\d)', str(D.get('upd') or D.get('asOf') or '')))   # 23차: 문의 보낼 때 자료 기준일(contact.js pageAsOf)
shell = shell.replace('<span class="hdr-date" id="hdrDate"></span>', f'<span class="hdr-date" id="hdrDate" data-asof="{_uf}">{_ud} 갱신</span>' if _ud else '<span class="hdr-date" id="hdrDate"></span>', 1)
# 지도 자리 그림(src/ghost.js): 섬(h)과 앱(a)이 같은 코드 · 서울 모양은 빌드가 넣는다(tools/ghost_geo.py)
import ghost_geo
GHOST_JS = S('ghost.js'); assert GHOST_JS.count('/*GHOST*/ null') == 1
GHOST_JS = GHOST_JS.replace('/*GHOST*/ null', json.dumps(ghost_geo.build(D), ensure_ascii=False, separators=(',', ':')))
js = GHOST_JS + js; js_y = GHOST_JS + js_y
# 사이클 4 D1: 홈 미니 지도·다음 문턱(src/hmini.js) — 섬(h)과 앱(a)이 같은 코드
HMINI_JS = S('hmini.js')
js = HMINI_JS + js; js_y = HMINI_JS + js_y
# 문의하기 양식(src/contact.js): 앱 묶음에 넣고, 정적 페이지(/contact · /faq · /z)용으로 public/cf.js 로도 낸다(같은 코드)
CONTACT_JS = S('contact.js')
js = CONTACT_JS + js; js_y = CONTACT_JS + js_y
# 22차: 자료 받기 시간 제한·다시 받기 + 잡히지 않은 오류 알림(src/net.js) — 앱 묶음 맨 앞
js = S('net.js') + js; js_y = S('net.js') + js_y
css = S('app.css') + ext_css
# 22차: 죽은 CSS 규칙 빼기 — 선택자에 꼭 있어야 하는 class·id가 앱 코드·첫 화면 HTML·생성기 어디에도 없는 규칙(21번의 덧칠로 남은 옛 화면 규칙).
# 한 낱말이라도 남아 있거나("pre-" + x 처럼 이어 붙이는 앞부분 포함) 확신이 없는 선택자(\ 이스케이프·:is·:where 안)는 그대로 둔다.
def prune_css(css):
    # 사이클 4 통합: src/tapp·src/feat·src/featx 안에서만 쓰는 클래스(.tob-cash 등)도 살린다 — 예전엔 스캔 밖이라 규칙이 지워졌다
    import glob
    src = ''.join(open(f, encoding='utf-8').read() for f in [os.path.join(R, 'src', p) for p in ('app.js', 'shell.html', 'island.js', 'boot.js', 'ghost.js', 'hmini.js', 'contact.js', 'net.js')] + sorted(glob.glob(os.path.join(R, 'src', 'ext', '*.js'))) + sorted(glob.glob(os.path.join(R, 'src', 'tapp', '*.js'))) + sorted(glob.glob(os.path.join(R, 'src', 'feat', '*.js'))) + sorted(glob.glob(os.path.join(R, 'src', 'featx', '*.js'))) + sorted(glob.glob(os.path.join(R, 'tools', '*.py'))) + [os.path.join(R, 'tools', 'prerender.js')] if os.path.exists(f))
    words = set(re.findall(r'[\w-]+', src))
    pre = set(re.findall(r'(?<![\w-])([\w-]+-)(?=["\'`]|\$\{)', src))
    def alive(t):
        if t.startswith(('maplibregl', 'mapboxgl')) or t in words: return True
        p = t.split('-')
        return any('-'.join(p[:i]) + '-' in pre for i in range(1, len(p)))
    def sel_dead(x):
        if '\\' in x: return False
        x = re.sub(r'\[[^\]]*\]', '', x)
        for _ in range(3): x = re.sub(r':(?:not|is|where)\([^()]*\)', '', x)
        if re.search(r':(?:not|is|where)\(', x): return False
        return any(not alive(t) for t in re.findall(r'[.#](-?[A-Za-z_][\w-]*)', x))
    def walk(s):
        out = []; i = 0; n = len(s)
        while i < n:
            j = s.find('{', i)
            if j < 0: out.append(s[i:]); break
            d = 0; k = j
            while k < n:
                c = s[k]
                if c == '{': d += 1
                elif c == '}':
                    d -= 1
                    if d == 0: break
                elif c in '"\'':
                    k += 1
                    while k < n and s[k] != c: k += 2 if s[k] == '\\' else 1
                k += 1
            head = s[i:j]; body = s[j + 1:k]; hs = head.strip()
            if hs.startswith(('@media', '@supports', '@layer', '@container')):
                inner = walk(body)
                if inner.strip(): out.append(head + '{' + inner + '}')
            elif hs.startswith('@') or not all(sel_dead(x) for x in re.split(r',(?![^()]*\))', hs)):
                out.append(s[i:k + 1])
            i = k + 1
        return ''.join(out)
    return walk(css)
# 배포본만 줄이기(원본 src는 그대로): esbuild가 있으면 JS·CSS를 압축. 없으면 그대로 둔다.
import shutil, subprocess
ESB = os.environ.get('ESBUILD') or shutil.which('esbuild') or next((x for x in (os.path.join(R, 'node_modules/.bin/esbuild'), '/tmp/esb/node_modules/.bin/esbuild') if os.path.exists(x)), None)
if ESB and not os.environ.get('NO_MINIFY'):
    def mini(src, loader):
        r = subprocess.run([ESB, f'--loader={loader}', '--minify', '--target=es2020,chrome90,safari14', '--log-level=error'], input=src, capture_output=True, text=True)
        if r.returncode: raise SystemExit('esbuild 실패: ' + r.stderr[:500])
        return r.stdout
    js0, css0 = len(js), len(css)
    js = mini(js, 'js'); js_y = mini(js_y, 'js'); css = mini(css, 'css'); CONTACT_JS = mini(CONTACT_JS, 'js')
    print(f'minify js {js0}->{len(js)} css {css0}->{len(css)}')
    if not os.environ.get('NO_CSS_PRUNE'):
        c1 = len(css); css = prune_css(css); print(f'css prune {c1}->{len(css)}')
# 큰 데이터·앱 코드는 내용 해시가 박힌 파일로 따로(브라우저·서비스 워커가 오래 저장) → index.html은 작게
B = os.path.join(R, 'public', 'b'); os.makedirs(B, exist_ok=True)
_cf = os.path.join(R, 'public', 'cf.js')
if not os.path.exists(_cf) or open(_cf, encoding='utf-8').read() != CONTACT_JS: open(_cf, 'w', encoding='utf-8').write(CONTACT_JS)
def emit(prefix, body, ext='js'):
    body = brand.sub(body)
    h = hashlib.md5(body.encode()).hexdigest()[:10]; fn = f'{prefix}.{h}.{ext}'
    open(os.path.join(B, fn), 'w', encoding='utf-8').write(body)
    return '/b/' + fn
# 앱만 읽는 큰 JSON 덩어리(노선·생활 인프라·호재)는 HTML에서 빼서 데이터 파일로 → 첫 HTML이 ~80KB 가벼워진다.
# 데이터 파일이 실행될 때 같은 id의 <script type="application/json">을 만들어 두므로 앱 코드($("transitData").textContent)는 그대로.
MOVE = ('transitData', 'infraData', 'hojaeData')
blobs = {}
for k in MOVE:
    m = re.search(r'<script type="application/json" id="' + k + r'">(.*?)</script>\n?', shell, re.S)
    if m: blobs[k] = m.group(1); shell = shell[:m.start()] + shell[m.end():]
pre_js = ''
if blobs:
    pre_js = '(function(){var J=' + json.dumps(blobs, ensure_ascii=False) + ';for(var k in J)if(!document.getElementById(k)){var s=document.createElement("script");s.type="application/json";s.id=k;s.textContent=J[k];(document.body||document.head).appendChild(s)}})();'
# 19차: 자료를 몇 조각(앞 = 구역 밖 자료, 뒤 = 구역 목록을 나눈 것)으로 — 큰 JSON.parse 하나(4배 느린 CPU에서 0.6초 넘는 긴 작업)를 짧은 작업 여러 개로
JP = lambda o: "JSON.parse('" + json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/').replace('\\', '\\\\').replace("'", "\\'") + "')"
_core = {k: v for k, v in D.items() if k != 'recs'}; _recs = D['recs']; _N = 3; _k = -(-len(_recs) // _N)
_parts = [pre_js + 'window.__ZPDp=[' + JP(_core) + '];'] + ['window.__ZPDp.push(' + JP(_recs[i:i + _k]) + ');' for i in range(0, len(_recs), _k)]
_parts[-1] += '(function(){var p=window.__ZPDp,D=p[0];D.recs=[].concat.apply([],p.slice(1));window.__ZPD=D;window.__ZPDp=null})();'
d_urls = [emit('d', x) for x in _parts]
d_url = d_urls[0]
# renew-feat: 새 기능 묶음(src/feat/*.js · *.css) → /b/f.*.js — 구역 시트의 일정·거래·입지 탭과 도구를 처음 열 때 받는다(웹·앱 첫 화면 a.js 무게에 넣지 않음)
# 기능 CSS는 같은 파일 안 문자열로(처음 쓸 때 <style>로 붙임) — 앱 CSS 정리(prune)와 섞이지 않게
_FD = os.path.join(R, 'src', 'feat')
f_js = ''.join(open(os.path.join(_FD, f), encoding='utf-8').read() for f in sorted(os.listdir(_FD)) if f.endswith('.js')) if os.path.isdir(_FD) else ''
f_css = ''.join(open(os.path.join(_FD, f), encoding='utf-8').read() for f in sorted(os.listdir(_FD)) if f.endswith('.css')) if os.path.isdir(_FD) else ''
if ESB and not os.environ.get('NO_MINIFY'): f_js = mini(f_js, 'js'); f_css = mini(f_css, 'css')
assert f_js.count('"__FCSS__"') == 1, 'src/feat: "__FCSS__" 자리 하나'
f_js = f_js.replace('"__FCSS__"', json.dumps(f_css, ensure_ascii=False).replace('</', '<\\/'))
f_url = emit('f', f_js)
assert js.count('__FEAT__') == 1 and js_y.count('__FEAT__') == 1, 'app.js: __FEAT__ 자리 하나'
js = js.replace('__FEAT__', f_url); js_y = js_y.replace('__FEAT__', f_url)
print('feat', f_url, len(f_js.encode()), 'bytes')
# 사이클 2: 두 번째 지연 묶음(src/featx → /b/g.*.js) — 구역 비교·내 시나리오·필지 연식 지도(누를 때만 받음 · f 묶음 무게에 넣지 않음)
_XD = os.path.join(R, 'src', 'featx')
x_js = ''.join(open(os.path.join(_XD, f), encoding='utf-8').read() for f in sorted(os.listdir(_XD)) if f.endswith('.js')) if os.path.isdir(_XD) else ''
x_css = ''.join(open(os.path.join(_XD, f), encoding='utf-8').read() for f in sorted(os.listdir(_XD)) if f.endswith('.css')) if os.path.isdir(_XD) else ''
if ESB and not os.environ.get('NO_MINIFY'): x_js = mini(x_js, 'js'); x_css = mini(x_css, 'css')
assert x_js.count('"__XCSS__"') == 1, 'src/featx: "__XCSS__" 자리 하나'
x_js = x_js.replace('"__XCSS__"', json.dumps(x_css, ensure_ascii=False).replace('</', '<\\/'))
g_url = emit('g', x_js)
assert js.count('__FEATX__') == 1 and js_y.count('__FEATX__') == 1, 'app.js: __FEATX__ 자리 하나'
js = js.replace('__FEATX__', g_url); js_y = js_y.replace('__FEATX__', g_url)
print('featx', g_url, len(x_js.encode()), 'bytes')
# 사이클 5(A): 오늘 묶음(src/today → /b/n.*.js) — 홈 오늘 카드·소식 '서울 오늘'·일정·레이더가 화면에 보일 때만 받는다(INBOX.today · 첫 화면 a·ta에 안 넣음)
# 문구 사전(tools/feed_words.json) 한 곳 → 묶음 안 FW · pipeline/feed_words.json(파이프라인) · worker/feed_words.js(푸시 워커)
_FWP = os.path.join(R, 'tools', 'feed_words.json')
_fw = json.load(open(_FWP, encoding='utf-8'))
_fws = json.dumps(_fw, ensure_ascii=False, separators=(',', ':'))
for _p, _b in ((os.path.join(R, 'pipeline', 'feed_words.json'), _fws), (os.path.join(R, 'worker', 'feed_words.js'), '// 만든 곳: tools/build.py ← tools/feed_words.json (직접 고치지 말 것)\nexport default ' + _fws + ';\n')):
    if not os.path.exists(_p) or open(_p, encoding='utf-8').read() != _b: open(_p, 'w', encoding='utf-8').write(_b)
_ND = os.path.join(R, 'src', 'today')
n_js = ''.join(open(os.path.join(_ND, f), encoding='utf-8').read() for f in sorted(os.listdir(_ND)) if f.endswith('.js')) if os.path.isdir(_ND) else ''
assert n_js.count('"__FEED_WORD__"') == 1, 'src/today: "__FEED_WORD__" 자리 하나'
_fwn = json.dumps({k: v for k, v in _fw.items() if k not in ('_', 'banned', 'banned_ok', 'banned_head')}, ensure_ascii=False, separators=(',', ':'))   # 묶음에는 화면 문장만(금지어 목록은 QA·파이프라인용)
n_js = n_js.replace('"__FEED_WORD__"', _fwn.replace('</', '<\\/'))
if ESB and not os.environ.get('NO_MINIFY'): n_js = mini(n_js, 'js')
n_url = emit('n', n_js)
assert js.count('__TODAY__') == 1 and js_y.count('__TODAY__') == 1, 'app.js: __TODAY__ 자리 하나(72_inbox.js INBOX.today)'
js = js.replace('__TODAY__', n_url); js_y = js_y.replace('__TODAY__', n_url)
print('today', n_url, len(n_js.encode()), 'bytes')
a_url = emit('a', js)
aa_url = emit('ta', js_y)   # pre-adsense 5: 설치 앱 전용(덩이로 나눠 실행) — 이름이 't'로 시작해 웹 서비스 워커의 미리 받기(/b/[a-su-z].*)에 안 걸린다(웹 방문자는 받지 않음)
# MY > 앱 버전: 앱 코드 내용 해시(같은 코드면 같은 값 → 다시 빌드해도 첫 화면이 그대로)
shell = shell.replace('__ZPVER__', '버전 2.0')   # 사용자에게는 버전만(빌드 해시는 /b/ 파일 이름에만)
c_url = emit('c', css, 'css')
# 설치 앱 화면 묶음(src/tapp/ → /b/t.*.js · /b/t.*.css): 설치 앱(html.is-tapp)일 때만 첫 화면 머리 스크립트가 받는다 — 웹 묶음(a·c)에는 들어가지 않는다
_TD = os.path.join(R, 'src', 'tapp')
t_js = ''.join(open(os.path.join(_TD, f), encoding='utf-8').read() for f in sorted(os.listdir(_TD)) if f.endswith('.js'))
t_css = ''.join(open(os.path.join(_TD, f), encoding='utf-8').read() for f in sorted(os.listdir(_TD)) if f.endswith('.css'))
# 디자인 키트(src/tapp/kit/*.svg · 자리 이름 = 파일 이름, 예: grid-map.svg · banner-report.svg · onb-1.svg · tab-home.svg/tab-home-on.svg)
# 있으면 그 그림을 쓰고, 없으면 00_icons.js 임시 그림. 그림 안 id는 '파일이름__U__'로 바꿔 두고(화면에 여러 번 넣을 때 tIcon이 겹치지 않게 번호를 붙임)
# kit/tokens.css가 있으면 tapp.css 뒤에 붙인다(키트 색·간격 토큰)
_KD = os.path.join(_TD, 'kit')
_kit = {}
if os.path.isdir(_KD):
    for f in sorted(os.listdir(_KD)):
        if not f.endswith('.svg'): continue
        k = f[:-4]
        s = open(os.path.join(_KD, f), encoding='utf-8').read()
        s = re.sub(r'<\?xml.*?\?>|<!--.*?-->|<!DOCTYPE[^>]*>', '', s, flags=re.S).strip()
        s = re.sub(r'\s+', ' ', s)
        ids = set(re.findall(r'\bid="([^"]+)"', s))
        for i in sorted(ids, key=len, reverse=True):
            s = s.replace(f'id="{i}"', f'id="{k}__U__{i}"').replace(f'url(#{i})', f'url(#{k}__U__{i})').replace(f'href="#{i}"', f'href="#{k}__U__{i}"')
        _kit[k] = s
    if os.path.exists(os.path.join(_KD, 'tokens.css')): t_css += open(os.path.join(_KD, 'tokens.css'), encoding='utf-8').read()
t_js = '(function(){"use strict";\nconst BRAND = "__BRAND__";\nconst TKIT = ' + json.dumps(_kit, ensure_ascii=False) + ';\n' + t_js + '\n})();'
if ESB and not os.environ.get('NO_MINIFY'): t_js = mini(t_js, 'js'); t_css = mini(t_css, 'css')
t_url = emit('t', t_js); tc_url = emit('t', t_css, 'css')
assert shell.count('__TJS__') == 1 and shell.count('__TCSS__') == 1
shell = shell.replace('__TJS__', t_url).replace('__TCSS__', tc_url)
# 사이클 2: 지난 빌드 파일 정리 — 참조로 남긴다(수정 시각 순 KEEP=2는 여러 번 빌드하면 배포된 화면이 쓰는 묶음까지 지웠다)
#   남기는 것 = 이번 빌드(out·full) + 디스크의 지난 index.html + 배포본(origin/main public/index.html)이 이어 부르는 /b/ 파일(묶음 안 참조까지 따라감)
#   그 밖의 /b/ 파일(아무 화면도 안 부르는 옛 묶음)만 지운다 · git이 없으면 지난 index.html만 '배포본'으로 본다
_BREF = re.compile(r'/b/([a-z]+\.[0-9a-f]{6,}\.(?:json|js|css))(?![a-z])')
def _refs(roots):
    seen, q = set(), [m for t in roots for m in _BREF.findall(t or '')]
    while q:
        f = q.pop()
        if f in seen: continue
        seen.add(f)
        try: t = open(os.path.join(B, f), encoding='utf-8').read()
        except OSError:
            try: t = subprocess.run(['git', '-C', R, 'show', f'origin/main:public/b/{f}'], capture_output=True, text=True, timeout=20).stdout
            except Exception: t = ''
        q += [m for m in _BREF.findall(t) if m not in seen]
    return seen
def prune(*cur_html):
    prev = ''
    try: prev = open(os.path.join(R, 'public', 'index.html'), encoding='utf-8').read()
    except OSError: pass
    live = ''
    try: live = subprocess.run(['git', '-C', R, 'show', 'origin/main:public/index.html'], capture_output=True, text=True, timeout=20).stdout
    except Exception: pass
    stat = []   # 정적 페이지가 직접 부르는 묶음(예: 설치 앱 ta)도 남긴다
    for dp, _, fns in os.walk(os.path.join(R, 'public')):
        if os.path.basename(dp) == 'b': continue
        for fn in fns:
            if fn.endswith('.html') and not (dp == os.path.join(R, 'public') and fn == 'index.html'):
                try:
                    t = open(os.path.join(dp, fn), encoding='utf-8').read()
                    if '/b/' in t: stat.append(t)
                except OSError: pass
    keep = _refs(list(cur_html) + [prev, live] + stat)
    # 사이클 4 통합(오너 'Pick 콘셉트'): 라이브(origin/main)가 부르는 옛 묶음 a.26ea0821e8.js · ta.230a56a8d6.js에는 예전 이름이 남아 있다.
    #   배포 전까지는 라이브 화면이 부르므로 남기고(위 live), 리뉴얼 배포 뒤 첫 빌드에서 live가 새 index를 가리키면 이 정리에서 자동으로 지워진다.
    #   (QA brand.residual은 지금 빌드가 쓰는 묶음만 본다 · 배포 뒤 첫 빌드 결과에서 두 파일이 없는지 확인)
    for f in keep:   # 배포본이 부르는데 디스크에 없는 묶음은 git(origin/main)에서 되살린다(배포 직후 옛 화면이 깨지지 않게)
        fp = os.path.join(B, f)
        if os.path.exists(fp): continue
        try:
            t = subprocess.run(['git', '-C', R, 'show', f'origin/main:public/b/{f}'], capture_output=True, timeout=20)
            if t.returncode == 0 and t.stdout: open(fp, 'wb').write(t.stdout)
        except Exception: pass
    gone = [f for f in os.listdir(B) if _BREF.fullmatch('/b/' + f) and f not in keep]
    for f in gone:
        try: os.remove(os.path.join(B, f))
        except OSError: pass
    print(f'b/ 정리: 남김 {len(keep)} · 지움 {len(gone)}')
# ---- 예전 방식(전체 앱을 바로) = 섬을 못 만들 때의 대비책이자, 섬 상태를 떠 오는 원본 ----
full = shell.replace('<script type="application/json" id="data">/*DATA*/</script>', ''.join(f'<script src="{u}"></script>' for u in d_urls), 1)
full = full.replace('<script>/*APPJS*/</script>', f'<script src="{a_url}"></script>', 1)
full = full.replace('</head>', ''.join(f'<link rel="preload" href="{u}" as="script">' for u in d_urls) + f'<link rel="preload" href="{a_url}" as="script">\n</head>', 1)
full = full.replace('<style>/*APPCSS*/</style>', f'<link rel="stylesheet" href="{c_url}">', 1)
for k in ('/*APPCSS*/', '/*APPJS*/', '/*DATA*/'): assert k not in full
out = full
# ---- 섬(island) 첫 화면: 미리 그린 숫자·목록 + 첫 페인트 CSS + 작은 섬 코드, 전체 앱은 손댈 때(빠른 연결이면 유휴 때) ----
PRE = os.path.join(R, 'pipeline', '.pre'); os.makedirs(PRE, exist_ok=True)
def node_env():
    e = dict(os.environ)
    if not e.get('NODE_PATH'):
        try: e['NODE_PATH'] = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, timeout=20).stdout.strip()
        except Exception: pass
    return e
def prerender(*args):
    # 같은 입력(후보 HTML + 쓰는 번들 + 이 도구)이면 지난 결과를 그대로 → 코드·데이터가 그대로인 재빌드는 크롬을 띄우지 않는다
    PJ = os.path.join(R, 'tools', 'prerender.js')
    hh = hashlib.md5(open(PJ, 'rb').read() + args[0].encode())
    for a in args[1:-1]: hh.update(open(a, 'rb').read() if os.path.exists(a) else a.encode())
    CD = os.path.join(PRE, 'cache'); os.makedirs(CD, exist_ok=True)
    cf = os.path.join(CD, f'{args[0]}.{hh.hexdigest()[:16]}')
    if os.path.exists(cf):
        shutil.copyfile(cf, args[-1]); os.utime(cf); print(f'prerender {args[0]}: cache'); return True
    try: r = subprocess.run(['node', PJ, *args], capture_output=True, text=True, env=node_env(), timeout=300)
    except Exception as e: print('prerender', args[0], e); return False
    print((r.stdout + r.stderr).strip()[-600:])
    if r.returncode != 0: return False
    shutil.copyfile(args[-1], cf)
    for f in sorted([f for f in os.listdir(CD) if f.startswith(args[0] + '.')], key=lambda f: os.path.getmtime(os.path.join(CD, f)), reverse=True)[6:]: os.remove(os.path.join(CD, f))
    return True
def island():
    import html as H
    open(os.path.join(PRE, 'full.html'), 'w', encoding='utf-8').write(full)
    stp = os.path.join(PRE, 'state.json')
    if not prerender('state', os.path.join(PRE, 'full.html'), stp): return None
    P = json.load(open(stp, encoding='utf-8'))
    T = lambda i: None if i is None or i < 0 else P['strs'][i]
    f0, c0 = P['def']['f'], P['def']['c']; i0 = P['stops'].index(c0)
    st = P['st'][f0][i0]; t = st[0]
    isl = GHOST_JS + HMINI_JS + S('island.js'); boot = S('boot.js')
    if ESB and not os.environ.get('NO_MINIFY'): isl = mini(isl, 'js'); boot = mini(boot, 'js')
    # 23차: 금액마다 미리 그린 목록 줄(rows · 압축 31KB)은 첫 화면 JS에서 빼서 JSON 파일로 — 섬이 시작하자마자 받아 두고, 오기 전에 금액을 바꾸면 줄만 받는 대로 채운다
    #       (기본 금액의 줄은 HTML에 이미 있음 → 첫 페인트는 그대로). 첫 화면 JS 95KB → 64KB 안팎
    rows_all = P['rows']
    PJ = dict(P); PJ['rows'] = None; PJ['ru'] = emit('r', json.dumps(rows_all, ensure_ascii=False, separators=(',', ':')), 'json')
    h_url = emit('h', 'window.__ZPH=' + json.dumps(PJ, ensure_ascii=False, separators=(',', ':')) + ';\n' + isl)
    font = re.search(r'<link rel="stylesheet" href="(https://cdn\.jsdelivr\.net/[^"]*pretendard[^"]*)"', shell)
    boot = boot.replace('__AA__', aa_url).replace('__A__', a_url).replace('__D__', ','.join(d_urls)).replace('__C__', c_url).replace('__F__', font.group(1) if font else '')
    x = shell
    def rep(old, new, cnt=1, rx=False):
        nonlocal x
        n = len(re.findall(old, x, re.S)) if rx else x.count(old)
        if n != cnt: raise ValueError(f'island: "{old[:60]}" ×{n}')
        x = re.sub(old, new, x, count=1, flags=re.S) if rx else x.replace(old, new, 1)
    cls = ' '.join(P['cls'] + (['gapm'] if st[3] else []))
    rep(r'<html lang="ko" class="([^"]*)">', lambda m: f'<html lang="ko" class="{m.group(1)} {cls}">', rx=True)
    # 글꼴은 전체 앱과 함께(빠른 연결이면 바로) — 느린 연결의 첫 화면에서 400KB 남짓을 아낀다. 그 전엔 시스템 글꼴.
    x = re.sub(r'<link rel="preconnect" href="https://cdn\.jsdelivr\.net"[^>]*>\n?', '', x)
    x = re.sub(r'<link rel="preload" as="style" href="https://cdn\.jsdelivr\.net/[^"]*pretendard[^"]*"[^>]*>\n?', '', x)
    x = re.sub(r'<link rel="stylesheet" href="https://cdn\.jsdelivr\.net/[^"]*pretendard[^"]*"[^>]*>\n?', '', x)
    rep('<style>/*APPCSS*/</style>', f'<link rel="stylesheet" href="{c_url}">\n<script>{boot}</script>\n<script defer src="{h_url}"></script>')
    rep('<script type="application/json" id="data">/*DATA*/</script>\n', '')
    rep('<script>/*APPJS*/</script>\n', '')
    E = H.escape
    rep('<small id="sNL" class="bc-k">갈 수 있는 곳</small>', f'<small id="sNL" class="bc-k">{E(T(t[1]))}</small>')
    rep(r'<span id="sN">[^<]*</span>', f'<span id="sN">{E(T(t[0]))}</span>', rx=True)
    # 카운트업 숫자(CSS 카운터 --n)도 첫 페인트부터 같은 값 — 섬·앱이 바꿀 때만 굴러간다
    rep(r'id="sNB" style="--n:\d+"', f'id="sNB" style="--n:{int(re.sub(r"[^0-9]", "", T(t[0]) or "0") or 0)}"', rx=True)
    rep(r'<b id="sCashV">.*?</b>', f'<b id="sCashV">{T(t[4])}</b>', rx=True)
    rep(r'<input type="range" id="sCash" style="--p:[^"]*"', f'<input type="range" id="sCash" style="--p:{T(t[9])}" aria-valuetext="{E(T(t[10]) or "")}"', rx=True)
    mb = re.search(r'<div class="s-mode"[^>]*>(.*?)</div>', x, re.S)
    if not mb: raise ValueError('island: s-mode')
    k = iter(st[2]); inner = re.sub(r'<button type="button"', lambda m: f'<button type="button" aria-pressed="{next(k, "false")}"', mb.group(1))
    x = x[:mb.start(1)] + inner + x[mb.end(1):]
    rep('<div class="s-sum" id="sSum"></div>', f'<div class="s-sum" id="sSum">{T(t[5])}</div>')
    # 사이클 4 D1: 홈 금액 칩 · 다음 문턱 · 미니 지도 · 가장 맞는 곳 — 기본 금액의 첫 페인트(island.js hero · 60_simple heroR와 같은 값·같은 글)
    STP = P['stops']
    def cnt_at(f, i):
        s0 = P['st'][f][i] if 0 <= i < len(P['st'][f]) else None
        return int(re.sub(r'\D', '', T(s0[0][0]) or '') or 0) if s0 else None
    n0, up, skip = cnt_at(f0, i0), None, False
    if c0 < 15 - 1e-9:
        for d in (0.5, 1, 1.5, 2, 3, 5):
            c2 = round((c0 + d) * 10) / 10
            if c2 > 15: break
            if c2 not in STP: skip = True; break
            n2 = cnt_at(f0, STP.index(c2))
            if n2 > n0: up = (d, c2, n2); break
    f1 = 'cash' if f0 == 'gap' else 'gap'
    rep('<div class="hm-next" id="hmNext"></div>', '<div class="hm-next" id="hmNext"' + ('' if skip else f' data-k="{f0}|{c0:g}"') + '>' + ('' if skip else hm_map.next_html(up, f1, cnt_at(f1, i0))) + '</div>')
    for v in ('1', '1.5', '2', '2.5', '3'):
        if abs(float(v) - c0) < 1e-9: rep(f'data-hc="{v}" aria-pressed="false"', f'data-hc="{v}" aria-pressed="true"')
    if P.get('thr'):
        cnt = {}
        for k, z in enumerate(P['zones']):
            tk = P['thr'][f0][k]
            if tk is not None and 0 <= tk <= i0: cnt[z[0]] = cnt.get(z[0], 0) + 1
        x = re.sub(r'<div class="hm-mw" id="hmMw".*?</div>', lambda m: hm_map.paint(m.group(0), cnt), x, count=1, flags=re.S)
    rep('<ol class="s-list hm-bl" id="hmBestL"></ol>', '<ol class="s-list hm-bl" id="hmBestL">' + (P['rows'][st[1][0]] if st[1] else '') + '</ol>')
    if not st[1]: rep('<section class="hm-best" id="hmBest"', '<section class="hm-best" id="hmBest" hidden')
    rep(r'<h2 id="sLT">[^<]*</h2>', f'<h2 id="sLT">{E(T(t[2]))}</h2>', rx=True)
    rep(r'<span id="sLS">[^<]*</span>', f'<span id="sLS">{E(T(t[3]))}</span>', rx=True)
    rep(r'<ol class="s-list" id="sList">.*?</ol>', lambda m: '<ol class="s-list" id="sList">' + ''.join(P['rows'][r] for r in st[1]) + '</ol>', rx=True)
    tot = int(re.sub(r'\D', '', (re.search(r'([\d,]+)\s*곳\s*$', T(t[2]) or '') or [None, '0'])[1]) or 0)
    more = next((T(s[0][6]) for f in ('gap', 'cash') for s in P['st'][f] if T(s[0][6]) and re.search(r'\d', T(s[0][6]))), '더 보기 ({n}곳)')
    more = re.sub(r'[\d,]+(?=곳)', '{n}', more, count=1)
    trim = ('<script>/* 미리 그린 목록: 화면 높이에 맞는 줄 수(60_simple.js SHOW0와 같은 식). 레이아웃을 재는 일(흐름선 빼기)은 섬이 첫 페인트 뒤에 */(function(){'
            'var l=document.getElementById("sList"),m=document.getElementById("sMore");if(!l)return;'
            'var n=6;try{if(matchMedia("(min-width:981px)").matches)n=Math.max(6,Math.min(10,Math.floor((Math.min(innerHeight-79,902)-144)/75)))}catch(e){}'
            'while(l.children.length>n)l.removeChild(l.lastElementChild);'
            # 29차: 줄 오른쪽 '예산 거의 다 씀 · 예산에서 남는 돈'(island.js fx와 같은 식)도 첫 페인트 전에 — 섬이 붙을 때 줄이 8px씩 자라 PC 첫 화면이 밀리던 것
            f'var c={json.dumps(P["def"]["c"])},cT=function(v){{var a=Math.abs(v),m=Math.ceil(a*100-1e-6);if(a<0.005)return"0원";if(m<100)return(m*100).toLocaleString("ko-KR")+"만";var u=Math.ceil(a*10-1e-6)/10;return u.toLocaleString("ko-KR",{{maximumFractionDigits:1}})+"억"}};'
            'var es=function(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;")},fH=function(li){var f=li.getAttribute("data-ft");if(f==null)return"";var p=f.split("|");return\'<span class="s-ftl\'+(p[1]?"":" s-na")+\'">\'+es(p[0])+(p[1]?" <b>"+es(p[1])+"</b>":"")+"</span>"};'
            # 사이클 4 D4: 맨 아래 줄 왼쪽 '입주까지 현금 Y'(data-ft · island.js fx와 같은 식)
            '[].forEach.call(document.querySelectorAll("#sList li[data-ft],#sList li[data-need],#hmBestL li[data-ft],#hmBestL li[data-need]"),function(li){var x=li.hasAttribute("data-need")?+li.getAttribute("data-need"):NaN,el=li.querySelector(".s-fx");if(!el||el.firstChild)return;if(!isFinite(x)){el.innerHTML=fH(li);return}var lf=Math.max(0,Math.round((c-x)*100)/100);'
            'el.innerHTML=fH(li)+(lf<=c*0.1+1e-9?\'<em class="s-fit">예산 거의 다 씀</em>\':lf>=0.01?\'<span class="s-left">예산에서 남는 돈 \'+cT(lf)+"</span>":"")});'
            f'var t={tot};if(m&&t>n){{m.hidden=false;m.textContent={json.dumps(more, ensure_ascii=False)}.replace("{{n}}",(t-n).toLocaleString("ko-KR"))}}'
            '})()</script>')
    mv = re.search(r'<script>/\* 넓은 화면: 목록을 지도 오른쪽 칸으로[^<]*</script>', x)
    if not mv: raise ValueError('island: list mover script')
    x = x[:mv.end()] + trim + x[mv.end():]
    for k in ('/*APPCSS*/', '/*APPJS*/', '/*DATA*/'): assert k not in x
    # 첫 페인트 CSS: 이 첫 화면에 실제로 그려지는 요소에 맞는 규칙만(tools/prerender.js css). 전체 CSS는 앱과 함께 붙는다.
    ip = os.path.join(PRE, 'island.html'); open(ip, 'w', encoding='utf-8').write(x)
    cp = os.path.join(PRE, 'crit.css')
    PH = 'html.zp-wait,html.zp-wait *{cursor:progress!important}'
    if prerender('css', ip, os.path.join(B, c_url.split('/')[-1]), cp):
        crit = open(cp, encoding='utf-8').read().replace('</style', '<\\/style')
        x = x.replace(f'<link rel="stylesheet" href="{c_url}">', f'<style>{crit}{PH}</style>', 1)
    else:
        x = x.replace(f'<link rel="stylesheet" href="{c_url}">', f'<link rel="stylesheet" href="{c_url}"><style>{PH}</style>', 1)
    return x
if os.environ.get('ZP_ISLAND', '1') != '0':
    try:
        x = island()
        if x: out = x
        else: print('island 건너뜀(prerender 실패) — 전체 앱을 바로 싣는 예전 방식으로 냄')
    except Exception as e:
        print('island 건너뜀:', e)
prune(out, full)
# 5라운드 16: 구역 안 필지 지번 검색 색인(public/pcli · 검색창에 동+번지를 칠 때만 받음)
try:
    import pcli; pcli.main()
except Exception as e: print('pcli 건너뜀:', e)
# 정적 페이지(/z·/gu·가이드·리포트·약관·404 …): 폰에서 앱과 같은 아래 탭 4개(찾기·관심·소식·MY)로 앱에 돌아가게.
# 생성기마다 틀이 달라서(zpages·report·손으로 쓴 페이지) 빌드 끝에 한 번에 넣는다(표시 사이를 통째로 바꿔 몇 번 돌려도 같음)
# 리뉴얼 A3·F10: 용어집·오류 수정 기록·about 운영자 소개(tools/trust.py) — 탭·푸터를 넣기 전에 만든다
try:
    import trust; trust.main()
except Exception as e: print('trust 건너뜀:', e)
try:
    import og_site; og_site.main()   # 사이트 대표 공유 그림(이름: tools/brand.py)
except Exception as e: print('og_site 건너뜀:', e)
try:
    import static_tabs; static_tabs.main()
except Exception as e: print('static tabs 건너뜀:', e)
out = brand.sub(out)
open(os.path.join(R, 'public', 'index.html'), 'w', encoding='utf-8').write(out)
print('public/index.html', len(out.encode()), 'bytes', '(island)' if out is not full else '(full)')
# 서비스 워커 캐시 이름 = 이번 빌드 내용 해시(배포마다 옛 캐시를 비운다)
SW = os.path.join(R, 'public', 'sw.js')
if os.path.exists(SW):
    sw0 = open(SW, encoding='utf-8').read(); swv = hashlib.md5(out.encode()).hexdigest()[:8]
    sw1 = re.sub(r'^const V = "[^"]*";', f'const V = "{swv}";', sw0, count=1, flags=re.M)
    sw1 = re.sub(r'^const BRAND = "[^"]*", BRAND_EN = "[^"]*";', f'const BRAND = "{brand.BRAND}", BRAND_EN = "{brand.BRAND_EN}";', sw1, count=1, flags=re.M)
    if sw1 != sw0: open(SW, 'w', encoding='utf-8').write(sw1); print('sw.js cache', swv)
# 서비스 이름(tools/brand.py) → 앱 정보 파일(manifest · assetlinks)
_MF = os.path.join(R, 'public', 'manifest.webmanifest')
if os.path.exists(_MF):
    m0 = open(_MF, encoding='utf-8').read()
    m1 = re.sub(r'("name": ")[^"]*(")', lambda m: m.group(1) + brand.APP_NAME + m.group(2), m0, count=1)
    m1 = re.sub(r'("short_name": ")[^"]*(")', lambda m: m.group(1) + brand.BRAND + m.group(2), m1, count=1)
    if m1 != m0: open(_MF, 'w', encoding='utf-8').write(m1); print('manifest brand', brand.BRAND)
_AL = os.path.join(R, 'public', '.well-known', 'assetlinks.json')
if os.path.exists(_AL):
    a0 = open(_AL, encoding='utf-8').read()
    # 사이클 2: 새 앱(APP_PKG) + 이미 설치된 예전 앱(LEGACY_PKG) 두 항목 · 지문은 brand.SIGNING_SHA256(두 항목 공통)
    a1 = json.dumps([{"relation": ["delegate_permission/common.handle_all_urls"], "target": {"namespace": "android_app", "package_name": p, "sha256_cert_fingerprints": list(brand.SIGNING_SHA256)}} for p in (brand.APP_PKG, brand.LEGACY_PKG)], indent=2) + '\n'
    if a1 != a0: open(_AL, 'w', encoding='utf-8').write(a1); print('assetlinks packages', brand.APP_PKG, brand.LEGACY_PKG)
