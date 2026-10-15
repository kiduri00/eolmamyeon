#!/usr/bin/env python3
"""src/ → public/index.html 조립. 사용: python3 tools/build.py"""
import json, hashlib, os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda p: open(os.path.join(R, 'src', p), encoding='utf-8').read()
shell = S('shell.html')
D = json.loads(S('data.json'))
# 지연 로딩 데이터 파일 버전(내용 해시) → 캐시 무효화
dv = {}
for f in sorted(os.listdir(os.path.join(R, 'public', 'data'))) if os.path.isdir(os.path.join(R, 'public', 'data')) else []:
    if f.endswith('.json'):
        dv[f[:-5]] = hashlib.md5(open(os.path.join(R, 'public', 'data', f), 'rb').read()).hexdigest()[:8]
if dv: D['dv'] = dv
data = json.dumps(D, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
out = shell.replace('/*APPCSS*/', S('app.css'), 1).replace('/*APPJS*/', S('app.js').replace('</script', '<\\/script'), 1).replace('/*DATA*/', data, 1)
for k in ('/*APPCSS*/', '/*APPJS*/', '/*DATA*/'): assert k not in out
open(os.path.join(R, 'public', 'index.html'), 'w', encoding='utf-8').write(out)
print('public/index.html', len(out.encode()), 'bytes')
