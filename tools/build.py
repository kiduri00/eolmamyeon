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
d_url = emit('d', pre_js + "window.__ZPD=JSON.parse('" + data.replace('\\', '\\\\').replace("'", "\\'") + "');")
a_url = emit('a', js)
c_url = emit('c', css, 'css')
# 지난 빌드 파일은 이번 것 + 바로 전 것만 남김(배포 직후 옛 화면이 잠깐 참조할 수 있게)
KEEP = 2
def prune():
    for pre, ext in (('d', 'js'), ('a', 'js'), ('c', 'css'), ('h', 'js')):
        fs = sorted([f for f in os.listdir(B) if f.startswith(pre + '.') and f.endswith('.' + ext)], key=lambda f: os.path.getmtime(os.path.join(B, f)), reverse=True)
        for f in fs[KEEP:]:
            try: os.remove(os.path.join(B, f))
            except OSError: pass
# ---- 예전 방식(전체 앱을 바로) = 섬을 못 만들 때의 대비책이자, 섬 상태를 떠 오는 원본 ----
full = shell.replace('<script type="application/json" id="data">/*DATA*/</script>', f'<script src="{d_url}"></script>', 1)
full = full.replace('<script>/*APPJS*/</script>', f'<script src="{a_url}"></script>', 1)
full = full.replace('</head>', f'<link rel="preload" href="{d_url}" as="script"><link rel="preload" href="{a_url}" as="script">\n</head>', 1)
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
    isl = S('island.js'); boot = S('boot.js')
    if ESB and not os.environ.get('NO_MINIFY'): isl = mini(isl, 'js'); boot = mini(boot, 'js')
    h_url = emit('h', 'window.__ZPH=' + json.dumps(P, ensure_ascii=False, separators=(',', ':')) + ';\n' + isl)
    font = re.search(r'<link rel="stylesheet" href="(https://cdn\.jsdelivr\.net/[^"]*pretendard[^"]*)"', shell)
    boot = boot.replace('__A__', a_url).replace('__D__', d_url).replace('__C__', c_url).replace('__F__', font.group(1) if font else '')
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
    rep('<small id="sNL">살 수 있는 곳</small>', f'<small id="sNL">{E(T(t[1]))}</small>')
    rep(r'<span id="sN">[^<]*</span>', f'<span id="sN">{E(T(t[0]))}</span>', rx=True)
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
    trim = ('<script>/* 미리 그린 목록: 화면 높이에 맞는 줄 수(60_simple.js SHOW0와 같은 식) · 흐름선 때문에 이름이 잘리는 줄은 흐름선 빼기(fitSp와 같은 판정) */(function(){'
            'var l=document.getElementById("sList"),m=document.getElementById("sMore");if(!l)return;'
            'var n=6;try{if(matchMedia("(min-width:981px)").matches)n=Math.max(6,Math.min(10,Math.floor((Math.min(innerHeight-79,902)-144)/75)))}catch(e){}'
            'while(l.children.length>n)l.removeChild(l.lastElementChild);'
            f'var t={tot};if(m&&t>n){{m.hidden=false;m.textContent={json.dumps(more, ensure_ascii=False)}.replace("{{n}}",(t-n).toLocaleString("ko-KR"))}}'
            'window.ZP_fit=function(){var ls=document.querySelectorAll("#sList li");for(var i=0;i<ls.length;i++){var li=ls[i];if(!li.querySelector(".s-sp"))continue;li.classList.remove("s-nosp");'
            'var b=li.querySelector(".s-nm b"),s=li.querySelector(".s-nm small");if((b&&b.scrollWidth>b.clientWidth+1)||(s&&s.getClientRects().length&&s.offsetHeight>parseFloat(getComputedStyle(s).lineHeight||"0")*1.5))li.classList.add("s-nosp")}};'
            'window.ZP_fit()})()</script>')
    mv = re.search(r'<script>/\* 넓은 화면: 목록을 지도 오른쪽 칸으로[^<]*</script>', x)
    if not mv: raise ValueError('island: list mover script')
    x = x[:mv.end()] + trim + x[mv.end():]
    for k in ('/*APPCSS*/', '/*APPJS*/', '/*DATA*/'): assert k not in x
    # 첫 페인트 CSS: 이 첫 화면에 실제로 그려지는 요소에 맞는 규칙만(tools/prerender.js css). 전체 CSS는 앱과 함께 붙는다.
    ip = os.path.join(PRE, 'island.html'); open(ip, 'w', encoding='utf-8').write(x)
    cp = os.path.join(PRE, 'crit.css')
    PH = ('.zp-ph{position:absolute;inset:0;z-index:0;pointer-events:none}.zp-ph svg{display:block;width:100%;height:100%}'
          '.zp-gu path{fill:var(--surface,#fff);stroke:var(--border,#e5e8eb);stroke-width:1.6}.zp-dot{fill:var(--brand,#2B59F0);opacity:.85}'
          'html.zp-wait,html.zp-wait *{cursor:progress!important}')
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
open(os.path.join(R, 'public', 'index.html'), 'w', encoding='utf-8').write(out)
print('public/index.html', len(out.encode()), 'bytes', '(island)' if out is not full else '(full)')
# 서비스 워커 캐시 이름 = 이번 빌드 내용 해시(배포마다 옛 캐시를 비운다)
SW = os.path.join(R, 'public', 'sw.js')
if os.path.exists(SW):
    sw0 = open(SW, encoding='utf-8').read(); swv = hashlib.md5(out.encode()).hexdigest()[:8]
    sw1 = re.sub(r'^const V = "[^"]*";', f'const V = "{swv}";', sw0, count=1, flags=re.M)
    if sw1 != sw0: open(SW, 'w', encoding='utf-8').write(sw1); print('sw.js cache', swv)
