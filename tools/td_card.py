"""사이클 5 D: 홈 '오늘의 재개발' 카드 — 서울 줄은 빌드가 HTML에 써 넣는다(첫 페인트 · JS 0).
개인 줄(내 돈 이번 주 · 관심 구역 지난번 본 뒤)은 자리만 두고 지연 묶음(src/todayd → /b/y.*.js)이 채운다.
자료: public/data/today.json(A 트랙 tools/today.py · 없으면 카드를 넣지 않음). 문구: src/todayd/words.json(같은 키를 JS도 씀)."""
import json, os, datetime as dt, html as H
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WD = json.load(open(os.path.join(R, 'src', 'todayd', 'words.json'), encoding='utf-8'))
_FW = os.path.join(R, 'pipeline', 'feed_words.json')   # A 트랙 공용 사전이 있으면 같은 키를 덮어쓴다
if os.path.exists(_FW):
    try:
        _f = json.load(open(_FW, encoding='utf-8'))
        for k, v in (_f.get('today') or {}).items():
            if isinstance(v, dict) and isinstance(WD.get(k), dict): WD[k].update(v)
            else: WD[k] = v
    except Exception as e: print('feed_words 건너뜀:', e)
ORDER = ('trade', 'notice', 'tho', 'auc_sale', 'auc_new', 'auc_drop')
NEWK = ('trade', 'notice', 'stage', 'auc_new', 'auc_drop')   # A today.js와 같음: 이 합이 0이면 '적어요' + 이번 주
def md(d):
    x = dt.date.fromisoformat(d); return f'{x.month}.{x.day}({"월화수목금토일"[x.weekday()]})'
def val(o, k):
    o = o or {}
    return int(o.get('notice') or 0) + int(o.get('stage') or 0) if k == 'notice' else int(o.get(k) or 0)
def tiles(T):
    """JS(src/todayd/00_core.js Y.tiles)와 같은 규칙: 오늘 0이 아닌 칸만(최대 4) · 오늘 합이 0이면 '적어요' 줄 + 이번 주 칸."""
    S = T.get('seoul') or {}; d, w = S.get('d') or {}, S.get('w') or {}
    quiet = sum(int(d.get(k) or 0) for k in NEWK) == 0
    t = [] if quiet else [(k, val(d, k)) for k in ORDER if val(d, k) > 0][:4]
    wk = [(k, val(w, k)) for k in ORDER if val(w, k) > 0][:4]
    E = H.escape
    td = T.get('tho_d'); lab = lambda k: WD['k'][k] + (f' · {int(td[5:7])}.{int(td[8:10])}' if k == 'tho' and td and td != T.get('asOf') else '')   # 거래허가는 하루 늦게 모임(A tho_d)
    li = lambda L: ''.join(f'<li><b>{n:,}</b><span>{E(lab(k))}</span></li>' for k, n in L)
    wsum = ' · '.join(f'{E(WD["ks"][k])} {n:,}' for k, n in wk)
    if t:
        return f'<ul class="td-s" id="tdS">{li(t)}</ul><p class="td-w" id="tdW"><span>{E(WD["week"])}</span> {wsum}</p>'
    return f'<p class="td-few" id="tdS">{E(WD["few"])}</p><ul class="td-s td-sw" id="tdW">{li(wk)}</ul>'
def card(T):
    a = T['asOf']; E = H.escape
    return (f'<section class="td-card" id="tdCard" aria-labelledby="tdH" data-asof="{E(a)}">'
            f'<div class="td-h"><h2 id="tdH">{E(WD["title"])}</h2><span class="td-as" id="tdAs">{E(WD["asof"].format(d=md(a)))}</span></div>'
            f'{tiles(T)}'
            # 개인 줄 자리(지연 묶음이 채움) — 높이를 미리 잡아 채울 때 아래가 밀리지 않게(줄 3개 고정: 오늘 한 줄 · 내 돈 · 관심)
            '<div class="td-me" id="tdMe" aria-live="polite"><p class="td-r td-sk" aria-hidden="true"><i></i></p><p class="td-r td-sk" aria-hidden="true"><i></i></p><p class="td-r td-sk" aria-hidden="true"><i></i></p></div>'
            f'<div class="td-f"><a class="td-go" href="#news" id="tdGo">{E(WD["allNews"])}<span aria-hidden="true"> ›</span></a></div>'
            '</section>')
def inject(shell):
    p = os.path.join(R, 'public', 'data', 'today.json')
    assert shell.count('<!--TODAY-->') == 1, 'shell.html: <!--TODAY--> 자리 하나'
    if not os.path.exists(p):
        print('today 카드 건너뜀(today.json 없음)'); return shell.replace('<!--TODAY-->', '', 1)
    try: T = json.load(open(p, encoding='utf-8')); c = card(T)
    except Exception as e: print('today 카드 건너뜀:', e); return shell.replace('<!--TODAY-->', '', 1)
    print('today 카드', T.get('asOf'), (T.get('seoul') or {}).get('d'))
    return shell.replace('<!--TODAY-->', c, 1)
