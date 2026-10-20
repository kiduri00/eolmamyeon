#!/usr/bin/env python3
"""src/ → public/index.html 조립. 사용: python3 tools/build.py"""
import json, hashlib, os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda p: open(os.path.join(R, 'src', p), encoding='utf-8').read()
shell = S('shell.html')
EN = os.path.join(R, 'pipeline', 'data.enriched.json')
D = json.load(open(EN, encoding='utf-8')) if os.path.exists(EN) else json.loads(S('data.json'))
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
            new = {'ym': lt['ym'], 'no': lt['no'], 'url': lt['url'] + '.html', 'items': [{'id': i['id'], 'step': i['step'], 'date': i['date'], 'src': ''} for i in lt['items']]}
            shell = shell[:m.start(2)] + json.dumps(new, ensure_ascii=False) + shell[m.end(2):]
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
    break
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
# 역 이름 고치기·새 역 넣기·가까운 역 다시 고르기(예전엔 앱이 켤 때마다 1,300곳을 돌며 ~200ms) — 빌드에서 한 번(src/app.js D.stFix 분기와 같은 규칙)
def st_fix(D):
    import math
    if D.get('stFix') or not isinstance(D.get('stations'), list): return
    ST_FIX = {'당고개역': '불암산역', '구회의사당역': '국회의사당역', '영등포 구청역': '영등포구청역', '잠실시내역': '잠실새내역', '시가정역': '사가정역'}
    LN_FIX = {'경의중앙': '경의중앙선', '김포 골드라인': '김포골드라인', '신림역': '신림선'}
    stName = lambda n: ST_FIX.get(n) or re.sub(r'(\S) (구청역|시청역)$', r'\1\2', n)
    uniq = lambda a: list(dict.fromkeys(a))
    for st in D['stations']:
        st[0] = stName(st[0]); st[3] = uniq([LN_FIX.get(l, l) for l in st[3]])
    NEW_ST = [['천왕역', 37.486637, 126.838713, ['7호선']], ['온수역', 37.492258, 126.823388, ['1호선', '7호선']], ['오류동역', 37.494526, 126.845365, ['1호선']], ['개봉역', 37.494594, 126.85868, ['1호선']],
              ['사당역', 37.47653, 126.981685, ['2호선', '4호선']], ['영등포역', 37.515504, 126.907628, ['1호선']], ['여의나루역', 37.527098, 126.932901, ['5호선']], ['마포역', 37.539574, 126.945932, ['5호선']],
              ['가좌역', 37.568491, 126.915487, ['경의중앙선']], ['서강대역', 37.551881, 126.935711, ['경의중앙선']], ['압구정로데오역', 37.527381, 127.040534, ['수인분당선']], ['남태령역', 37.463873, 126.989134, ['4호선']],
              ['중앙보훈병원역', 37.528807, 127.148488, ['9호선']], ['보라매공원역', 37.4954, 126.9182, ['신림선']]]
    jr = lambda v: math.floor(v + 0.5)
    for n, la, lo, ln in NEW_ST:
        x = jr((2272.72439 * lo - 0.00834955 * la - 288078.866) * 10) / 10; y = jr((-0.0013117628 * lo - 2866.9639 * la + 108107.651) * 10) / 10
        D['stations'].append([n, la, lo, ln, int(x) if x == int(x) else x, int(y) if y == int(y) else y])
    def hav(a, b):
        t = math.pi / 180; dl = (b[0] - a[0]) * t; dn = (b[1] - a[1]) * t
        x = math.sin(dl / 2) ** 2 + math.cos(a[0] * t) * math.cos(b[0] * t) * math.sin(dn / 2) ** 2
        return 12742e3 * math.asin(math.sqrt(x))
    for r in D['recs']:
        if r.get('st'): r['st']['n'] = stName(r['st']['n'])
        for x in (r.get('s3') or []):
            x[0] = stName(x[0]); x[2] = uniq([LN_FIX.get(l, l) for l in (x[2] or [])])
        if r.get('s3'):
            seen = set(); o = []
            for x in r['s3']:
                k = re.sub(r'\s', '', x[0])
                if k in seen: continue
                seen.add(k); o.append(x)
            r['s3'] = o
        if r.get('ln'): r['ln'] = uniq([LN_FIX.get(l, l) for l in r['ln']])
        if not r.get('ll') or not r.get('st'): continue
        worst = r['s3'][2][1] if r.get('s3') and len(r['s3']) >= 3 else float('inf')
        if not any((lambda d: d < worst or d <= 1e3)(hav(r['ll'], [s[1], s[2]])) for s in NEW_ST): continue
        al = sorted(((s, hav(r['ll'], [s[1], s[2]])) for s in D['stations']), key=lambda z: z[1])
        seen = set(); s3 = []
        for s, d in al:
            if s[0] in seen: continue
            seen.add(s[0]); s3.append([s[0], jr(d), s[3]])
            if len(s3) == 3: break
        r['st'] = {'n': s3[0][0], 'd': s3[0][1]}; r['s3'] = s3
        r['ln'] = uniq([l for s, d in al if d <= 1e3 for l in s[3]])
    D['stFix'] = 1
st_fix(D)
data = json.dumps(D, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
EXT = os.path.join(R, 'src', 'ext')
ext_js = ''.join(open(os.path.join(EXT, f), encoding='utf-8').read() for f in sorted(os.listdir(EXT)) if f.endswith('.js'))
ext_css = ''.join(open(os.path.join(EXT, f), encoding='utf-8').read() for f in sorted(os.listdir(EXT)) if f.endswith('.css'))
js = S('app.js'); assert js.count('/*EXT*/') == 1; js = js.replace('/*EXT*/', ext_js.strip() + '\n')
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
assert js.count('/*NEWD*/ null') == 1; js = js.replace('/*NEWD*/ null', json.dumps(NEWD))
assert shell.count('/*NEWD0*/{}') == 1; shell = shell.replace('/*NEWD0*/{}', json.dumps(NEWD))   # 23차: 첫 페인트 N 점(shell.html 작은 스크립트)
_ud = _md(D.get('upd') or D.get('asOf'))
_uf = (lambda m: f'{m.group(1)}.{m.group(2)}.{m.group(3)}' if m else '')(re.search(r'(\d{4})-?(\d\d)-?(\d\d)', str(D.get('upd') or D.get('asOf') or '')))   # 23차: 문의 보낼 때 자료 기준일(contact.js pageAsOf)
shell = shell.replace('<span class="hdr-date" id="hdrDate"></span>', f'<span class="hdr-date" id="hdrDate" data-asof="{_uf}">{_ud} 갱신</span>' if _ud else '<span class="hdr-date" id="hdrDate"></span>', 1)
# 지도 자리 그림(src/ghost.js): 섬(h)과 앱(a)이 같은 코드 · 서울 모양은 빌드가 넣는다(tools/ghost_geo.py)
import ghost_geo
GHOST_JS = S('ghost.js'); assert GHOST_JS.count('/*GHOST*/ null') == 1
GHOST_JS = GHOST_JS.replace('/*GHOST*/ null', json.dumps(ghost_geo.build(D), ensure_ascii=False, separators=(',', ':')))
js = GHOST_JS + js
# 문의하기 양식(src/contact.js): 앱 묶음에 넣고, 정적 페이지(/contact · /faq · /z)용으로 public/cf.js 로도 낸다(같은 코드)
CONTACT_JS = S('contact.js')
js = CONTACT_JS + js
# 22차: 자료 받기 시간 제한·다시 받기 + 잡히지 않은 오류 알림(src/net.js) — 앱 묶음 맨 앞
js = S('net.js') + js
css = S('app.css') + ext_css
# 22차: 죽은 CSS 규칙 빼기 — 선택자에 꼭 있어야 하는 class·id가 앱 코드·첫 화면 HTML·생성기 어디에도 없는 규칙(21번의 덧칠로 남은 옛 화면 규칙).
# 한 낱말이라도 남아 있거나("pre-" + x 처럼 이어 붙이는 앞부분 포함) 확신이 없는 선택자(\ 이스케이프·:is·:where 안)는 그대로 둔다.
def prune_css(css):
    import glob
    src = ''.join(open(f, encoding='utf-8').read() for f in [os.path.join(R, 'src', p) for p in ('app.js', 'shell.html', 'island.js', 'boot.js', 'ghost.js', 'contact.js', 'net.js')] + sorted(glob.glob(os.path.join(R, 'src', 'ext', '*.js'))) + sorted(glob.glob(os.path.join(R, 'tools', '*.py'))) + [os.path.join(R, 'tools', 'prerender.js')] if os.path.exists(f))
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
    js = mini(js, 'js'); css = mini(css, 'css'); CONTACT_JS = mini(CONTACT_JS, 'js')
    print(f'minify js {js0}->{len(js)} css {css0}->{len(css)}')
    if not os.environ.get('NO_CSS_PRUNE'):
        c1 = len(css); css = prune_css(css); print(f'css prune {c1}->{len(css)}')
# 큰 데이터·앱 코드는 내용 해시가 박힌 파일로 따로(브라우저·서비스 워커가 오래 저장) → index.html은 작게
B = os.path.join(R, 'public', 'b'); os.makedirs(B, exist_ok=True)
_cf = os.path.join(R, 'public', 'cf.js')
if not os.path.exists(_cf) or open(_cf, encoding='utf-8').read() != CONTACT_JS: open(_cf, 'w', encoding='utf-8').write(CONTACT_JS)
def emit(prefix, body, ext='js'):
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
a_url = emit('a', js)
# MY > 앱 버전: 앱 코드 내용 해시(같은 코드면 같은 값 → 다시 빌드해도 첫 화면이 그대로)
shell = shell.replace('__ZPVER__', '버전 2.0')   # 사용자에게는 버전만(빌드 해시는 /b/ 파일 이름에만)
c_url = emit('c', css, 'css')
# 지난 빌드 파일은 이번 것 + 바로 전 것만 남김(배포 직후 옛 화면이 잠깐 참조할 수 있게)
KEEP = 2
def prune():
    for pre, ext in (('d', 'js'), ('a', 'js'), ('c', 'css'), ('h', 'js'), ('r', 'json')):
        fs = sorted([f for f in os.listdir(B) if f.startswith(pre + '.') and f.endswith('.' + ext)], key=lambda f: os.path.getmtime(os.path.join(B, f)), reverse=True)
        cur = {u.split('/')[-1] for u in d_urls} if pre == 'd' else set()
        for f in [x for x in fs if x not in cur][KEEP * (len(d_urls) if pre == 'd' else 1) - len(cur):]:
            try: os.remove(os.path.join(B, f))
            except OSError: pass
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
    isl = GHOST_JS + S('island.js'); boot = S('boot.js')
    if ESB and not os.environ.get('NO_MINIFY'): isl = mini(isl, 'js'); boot = mini(boot, 'js')
    # 23차: 금액마다 미리 그린 목록 줄(rows · 압축 31KB)은 첫 화면 JS에서 빼서 JSON 파일로 — 섬이 시작하자마자 받아 두고, 오기 전에 금액을 바꾸면 줄만 받는 대로 채운다
    #       (기본 금액의 줄은 HTML에 이미 있음 → 첫 페인트는 그대로). 첫 화면 JS 95KB → 64KB 안팎
    rows_all = P['rows']
    PJ = dict(P); PJ['rows'] = None; PJ['ru'] = emit('r', json.dumps(rows_all, ensure_ascii=False, separators=(',', ':')), 'json')
    h_url = emit('h', 'window.__ZPH=' + json.dumps(PJ, ensure_ascii=False, separators=(',', ':')) + ';\n' + isl)
    font = re.search(r'<link rel="stylesheet" href="(https://cdn\.jsdelivr\.net/[^"]*pretendard[^"]*)"', shell)
    boot = boot.replace('__A__', a_url).replace('__D__', ','.join(d_urls)).replace('__C__', c_url).replace('__F__', font.group(1) if font else '')
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
prune()
# 정적 페이지(/z·/gu·가이드·리포트·약관·404 …): 폰에서 앱과 같은 아래 탭 4개(찾기·관심·소식·MY)로 앱에 돌아가게.
# 생성기마다 틀이 달라서(zpages·report·손으로 쓴 페이지) 빌드 끝에 한 번에 넣는다(표시 사이를 통째로 바꿔 몇 번 돌려도 같음)
try:
    import static_tabs; static_tabs.main()
except Exception as e: print('static tabs 건너뜀:', e)
open(os.path.join(R, 'public', 'index.html'), 'w', encoding='utf-8').write(out)
print('public/index.html', len(out.encode()), 'bytes', '(island)' if out is not full else '(full)')
# 서비스 워커 캐시 이름 = 이번 빌드 내용 해시(배포마다 옛 캐시를 비운다)
SW = os.path.join(R, 'public', 'sw.js')
if os.path.exists(SW):
    sw0 = open(SW, encoding='utf-8').read(); swv = hashlib.md5(out.encode()).hexdigest()[:8]
    sw1 = re.sub(r'^const V = "[^"]*";', f'const V = "{swv}";', sw0, count=1, flags=re.M)
    if sw1 != sw0: open(SW, 'w', encoding='utf-8').write(sw1); print('sw.js cache', swv)
