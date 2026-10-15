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
data = json.dumps(D, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
EXT = os.path.join(R, 'src', 'ext')
ext_js = ''.join(open(os.path.join(EXT, f), encoding='utf-8').read() for f in sorted(os.listdir(EXT)) if f.endswith('.js'))
ext_css = ''.join(open(os.path.join(EXT, f), encoding='utf-8').read() for f in sorted(os.listdir(EXT)) if f.endswith('.css'))
js = S('app.js'); assert js.count('/*EXT*/') == 1; js = js.replace('/*EXT*/', ext_js.strip() + '\n')
out = shell.replace('/*APPCSS*/', S('app.css') + ext_css, 1).replace('/*APPJS*/', js.replace('</script', '<\\/script'), 1).replace('/*DATA*/', data, 1)
for k in ('/*APPCSS*/', '/*APPJS*/', '/*DATA*/'): assert k not in out
open(os.path.join(R, 'public', 'index.html'), 'w', encoding='utf-8').write(out)
print('public/index.html', len(out.encode()), 'bytes')
