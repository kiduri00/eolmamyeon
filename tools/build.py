#!/usr/bin/env python3
"""src/ → public/index.html 조립. 사용: python3 tools/build.py"""
import json, hashlib, os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda p: open(os.path.join(R, 'src', p), encoding='utf-8').read()
shell = S('shell.html')
EN = os.path.join(R, 'pipeline', 'data.enriched.json')
D = json.load(open(EN, encoding='utf-8')) if os.path.exists(EN) else json.loads(S('data.json'))
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
# 지난 빌드 파일은 최근 6개만 남김(오래된 화면이 잠깐 참조할 수 있게)
for pre in ('d', 'a'):
    fs = sorted([f for f in os.listdir(B) if f.startswith(pre + '.') and f.endswith('.js')], key=lambda f: os.path.getmtime(os.path.join(B, f)), reverse=True)
    for f in fs[6:]: os.remove(os.path.join(B, f))
shell = shell.replace('<script type="application/json" id="data">/*DATA*/</script>', f'<script src="{d_url}"></script>', 1)
shell = shell.replace('<script>/*APPJS*/</script>', f'<script src="{a_url}"></script>', 1)
shell = shell.replace('</head>', f'<link rel="preload" href="{d_url}" as="script"><link rel="preload" href="{a_url}" as="script">\n</head>', 1)
c_h = hashlib.md5(css.encode()).hexdigest()[:10]
open(os.path.join(B, f'c.{c_h}.css'), 'w', encoding='utf-8').write(css)
for f in sorted([f for f in os.listdir(B) if f.startswith('c.') and f.endswith('.css')], key=lambda f: os.path.getmtime(os.path.join(B, f)), reverse=True)[6:]: os.remove(os.path.join(B, f))
out = shell.replace('<style>/*APPCSS*/</style>', f'<link rel="stylesheet" href="/b/c.{c_h}.css">', 1)
for k in ('/*APPCSS*/', '/*APPJS*/', '/*DATA*/'): assert k not in out
open(os.path.join(R, 'public', 'index.html'), 'w', encoding='utf-8').write(out)
print('public/index.html', len(out.encode()), 'bytes')
