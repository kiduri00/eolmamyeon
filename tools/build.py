#!/usr/bin/env python3
"""src/ → public/index.html 조립. 사용: python3 tools/build.py"""
import json, hashlib, os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda p: open(os.path.join(R, 'src', p), encoding='utf-8').read()
shell = S('shell.html')
EN = os.path.join(R, 'pipeline', 'data.enriched.json')
D = json.load(open(EN, encoding='utf-8')) if os.path.exists(EN) else json.loads(S('data.json'))
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
data = json.dumps(D, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
EXT = os.path.join(R, 'src', 'ext')
ext_js = ''.join(open(os.path.join(EXT, f), encoding='utf-8').read() for f in sorted(os.listdir(EXT)) if f.endswith('.js'))
ext_css = ''.join(open(os.path.join(EXT, f), encoding='utf-8').read() for f in sorted(os.listdir(EXT)) if f.endswith('.css'))
js = S('app.js'); assert js.count('/*EXT*/') == 1; js = js.replace('/*EXT*/', ext_js.strip() + '\n')
css = S('app.css') + ext_css
# 배포본만 줄이기(원본 src는 그대로): esbuild가 있으면 JS·CSS를 압축. 없으면 그대로 둔다.
import shutil, subprocess
ESB = os.environ.get('ESBUILD') or shutil.which('esbuild') or next((x for x in (os.path.join(R, 'node_modules/.bin/esbuild'), '/tmp/esb/node_modules/.bin/esbuild') if os.path.exists(x)), None)
if ESB and not os.environ.get('NO_MINIFY'):
    def mini(src, loader):
        r = subprocess.run([ESB, f'--loader={loader}', '--minify', '--target=es2020,chrome90,safari14', '--log-level=error'], input=src, capture_output=True, text=True)
        if r.returncode: raise SystemExit('esbuild 실패: ' + r.stderr[:500])
        return r.stdout
    js0, css0 = len(js), len(css)
    js = mini(js, 'js'); css = mini(css, 'css')
    print(f'minify js {js0}->{len(js)} css {css0}->{len(css)}')
# 큰 데이터·앱 코드는 내용 해시가 박힌 파일로 따로(브라우저·서비스 워커가 오래 저장) → index.html은 작게
B = os.path.join(R, 'public', 'b'); os.makedirs(B, exist_ok=True)
def emit(prefix, body):
    h = hashlib.md5(body.encode()).hexdigest()[:10]; fn = f'{prefix}.{h}.js'
    open(os.path.join(B, fn), 'w', encoding='utf-8').write(body)
    return '/b/' + fn
d_url = emit('d', "window.__ZPD=JSON.parse('" + data.replace('\\', '\\\\').replace("'", "\\'") + "');")
a_url = emit('a', js)
# 지난 빌드 파일은 이번 것 + 바로 전 것만 남김(배포 직후 옛 화면이 잠깐 참조할 수 있게)
KEEP = 2
for pre in ('d', 'a'):
    fs = sorted([f for f in os.listdir(B) if f.startswith(pre + '.') and f.endswith('.js')], key=lambda f: os.path.getmtime(os.path.join(B, f)), reverse=True)
    for f in fs[KEEP:]: os.remove(os.path.join(B, f))
shell = shell.replace('<script type="application/json" id="data">/*DATA*/</script>', f'<script src="{d_url}"></script>', 1)
shell = shell.replace('<script>/*APPJS*/</script>', f'<script src="{a_url}"></script>', 1)
shell = shell.replace('</head>', f'<link rel="preload" href="{d_url}" as="script"><link rel="preload" href="{a_url}" as="script">\n</head>', 1)
c_h = hashlib.md5(css.encode()).hexdigest()[:10]
open(os.path.join(B, f'c.{c_h}.css'), 'w', encoding='utf-8').write(css)
for f in sorted([f for f in os.listdir(B) if f.startswith('c.') and f.endswith('.css')], key=lambda f: os.path.getmtime(os.path.join(B, f)), reverse=True)[KEEP:]: os.remove(os.path.join(B, f))
out = shell.replace('<style>/*APPCSS*/</style>', f'<link rel="stylesheet" href="/b/c.{c_h}.css">', 1)
for k in ('/*APPCSS*/', '/*APPJS*/', '/*DATA*/'): assert k not in out
open(os.path.join(R, 'public', 'index.html'), 'w', encoding='utf-8').write(out)
print('public/index.html', len(out.encode()), 'bytes')
# 서비스 워커 캐시 이름 = 이번 빌드 내용 해시(배포마다 옛 캐시를 비운다)
SW = os.path.join(R, 'public', 'sw.js')
if os.path.exists(SW):
    sw0 = open(SW, encoding='utf-8').read(); swv = hashlib.md5(out.encode()).hexdigest()[:8]
    sw1 = re.sub(r'^const V = "[^"]*";', f'const V = "{swv}";', sw0, count=1, flags=re.M)
    if sw1 != sw0: open(SW, 'w', encoding='utf-8').write(sw1); print('sw.js cache', swv)
