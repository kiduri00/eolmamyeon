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
out = shell.replace('/*APPCSS*/', css, 1).replace('/*APPJS*/', js.replace('</script', '<\\/script'), 1).replace('/*DATA*/', data, 1)
for k in ('/*APPCSS*/', '/*APPJS*/', '/*DATA*/'): assert k not in out
open(os.path.join(R, 'public', 'index.html'), 'w', encoding='utf-8').write(out)
print('public/index.html', len(out.encode()), 'bytes')
