"""사이클 5 D: 홈 '오늘의 재개발' 카드 — 서울 줄은 빌드가 HTML에 써 넣는다(첫 페인트 · JS 0).
개인 줄(오늘 한 줄 · 내 돈 이번 주 · 관심 구역 지난번 본 뒤)은 자리만 두고 화면 지연 묶음(src/lazy/73_today.js → /b/ztoday)이 채운다.
자료: public/data/today.json(A 트랙 tools/today.py · 없으면 카드를 넣지 않음). 문구: tools/feed_words.json 한 곳(home·push·ui).
규칙은 A 묶음 ZP_today.seoul()·weekLine()과 src/lazy/73_today.js Y.tiles()와 같다(QA: 카드 숫자 = 소식 서울 오늘 = today.json)."""
import json, os, html as H
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FW = json.load(open(os.path.join(R, 'tools', 'feed_words.json'), encoding='utf-8'))
NEWK = ('trade', 'notice', 'stage', 'auc_new', 'auc_drop')   # A today.js NEWK: 이 합이 0이면 조용한 날('적어요 · 이번 주 N건')
def fill(t, o): 
    import re
    return re.sub(r'\{(\w+)\}', lambda m: (f'{o[m.group(1)]:,}' if isinstance(o.get(m.group(1)), int) else str(o[m.group(1)])) if m.group(1) in o else m.group(0), t)
def md(d): return f'{int(d[5:7])}.{int(d[8:10])}'
def tiles(T):
    S = T.get('seoul') or {}; d, w = S.get('d') or {}, S.get('w') or {}
    parts = [(k, int(d.get(k) or 0)) for k, _ in FW['home']['seoul'] if int(d.get(k) or 0) > 0]
    quiet = sum(int(d.get(k) or 0) for k in NEWK) == 0
    L = ([p for p in parts if p[0] in ('tho', 'auc_sale')] if quiet else parts)[:4]
    td = T.get('tho_d'); E = H.escape
    lab = lambda k: FW['ui']['tile'][k] + (f' · {md(td)}' if k == 'tho' and td and td != T.get('asOf') else '')   # 거래허가는 하루 늦게 모임(A tho_d)
    li = ''.join(f'<li><b>{n:,}</b><span>{E(lab(k))}</span></li>' for k, n in L)
    q = fill(FW['home']['quiet'], {'n': sum(int(w.get(k) or 0) for k in NEWK)})
    wk = fill(FW['push']['wk'], {k: int(w.get(k) or 0) for k in ('trade', 'notice', 'auc_sale')})
    return (f'<p class="td-few" id="tdF">{E(q)}</p>' if quiet else '') + (f'<ul class="td-s" id="tdS">{li}</ul>' if li else '') + f'<p class="td-w" id="tdW">{E(wk)}</p>'
def card(T):
    a = T['asOf']; E = H.escape; U = FW['ui']
    return (f'<section class="td-card" id="tdCard" data-zp-today aria-labelledby="tdH" data-asof="{E(a)}">'
            f'<div class="td-h"><h2 id="tdH">{E(U["title"])}</h2><span class="td-as" id="tdAs">{E(fill(FW["home"]["asof"], {"d": md(a)}))}</span></div>'
            f'{tiles(T)}'
            # 개인 줄 자리(화면 묶음이 채움) — 높이를 미리 잡아 채울 때 아래가 밀리지 않게(줄 3개 고정: 오늘 한 줄 · 내 돈 · 관심)
            '<div class="td-me" id="tdMe" aria-live="polite"><p class="td-r td-sk" aria-hidden="true"><i></i></p><p class="td-r td-sk" aria-hidden="true"><i></i></p><p class="td-r td-sk" aria-hidden="true"><i></i></p></div>'
            f'<div class="td-f"><a class="td-go" href="#news" id="tdGo">{E(U["all"])}<span aria-hidden="true"> ›</span></a></div>'
            '</section>')
def css():
    # 오늘 카드·소식 4칸 머리 CSS(src/today_first.css) — 첫 화면 CSS 묶음(c)에 넣지 않고 카드 HTML과 함께 <style>로(사이클 5 M 첫 묶음 상한 · 카드는 빌드가 쓰는 HTML이라 같은 자리)
    import re
    c = open(os.path.join(R, 'src', 'today_first.css'), encoding='utf-8').read()
    c = re.sub(r'/\*.*?\*/', '', c, flags=re.S); c = re.sub(r'\s*\n\s*', '', c)
    return '<style id="tdCss">' + c.replace('</', '<\\/') + '</style>'
def inject(shell):
    p = os.path.join(R, 'public', 'data', 'today.json')
    assert shell.count('<!--TODAY-->') == 1, 'shell.html: <!--TODAY--> 자리 하나'
    shell = shell.replace('<!--TODAY-->', css() + '<!--TODAY-->', 1)
    if not os.path.exists(p):
        print('today 카드 건너뜀(today.json 없음)'); return shell.replace('<!--TODAY-->', '', 1)
    try: T = json.load(open(p, encoding='utf-8')); c = card(T)
    except Exception as e: print('today 카드 건너뜀:', e); return shell.replace('<!--TODAY-->', '', 1)
    print('today 카드', T.get('asOf'), (T.get('seoul') or {}).get('d'))
    return shell.replace('<!--TODAY-->', c, 1)
