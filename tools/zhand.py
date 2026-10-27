#!/usr/bin/env python3
"""손으로 쓴 구역 분석 글(content/z/<id>.json) → public/z/<id>.html  ·  구 해설(content/gu/<구>.json) → /gu 페이지 본문 덩이.

리뉴얼 사이클 1(A1·A2). 글은 사람이 쓰고, 글 속 숫자는 이 파일이 사이트 자료(calc.json·data.enriched·premium·tx)에서 그날그날 채운다.
  · 글 속 {{키}} → <b class="zv" data-zv="키">값</b>  (값은 vals()가 화면 계산기·/api/v1과 같은 함수로 낸다 — tools/zhand_check.py가 대조)
  · 위 요약 카드(옆으로 넘김, CSS scroll-snap · JS 없음) · 목차 · 단계 일정표 · 가격 흐름 그림(앱 64_overview chart와 같은 분기 값) ·
    매수 전 체크리스트 · 다음에 볼 구역 카드 — 본문은 전부 HTML에 그대로(숨기지 않음)
  · 생성된 페이지에는 emr-auto 표시가 없어 tools/zpages.py가 손글로 다룬다(최신 숫자 상자 <!--zk-->, 계산 덩이 <!--zc-->, 신고 <!--zr--> 채움 · 늘 색인)
  · 매일 다시 쓰는 숫자·그림은 <!--zd-->…<!--/zd--> 또는 data-zv 안에 둔다 — sitemap.py가 본문 해시에서 빼서 lastmod가 매일 바뀌지 않게
  · 광고 칸은 승인 뒤에 정한다: 문단 사이에만 <!--ad-slot--> 표시(카드·목차·버튼 옆에는 두지 않음). 광고 리터럴 태그는 기존 손글과 같은 한 줄.
"""
import json, os, re, math, html, statistics, datetime, collections, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CZ = os.path.join(ROOT, 'content/z'); CG = os.path.join(ROOT, 'content/gu')
ADTAG = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9772652926977648" crossorigin="anonymous"></script>'
esc = lambda s: html.escape(str(s if s is not None else ''), quote=True)
PH = re.compile(r'\{\{([a-zA-Z0-9_]+)\}\}')
HANDSET = set()
HOOKS = json.load(open(os.path.join(ROOT, 'content/z_hooks.json'), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, 'content/z_hooks.json')) else {}
CARDS = json.load(open(os.path.join(ROOT, 'content/z_cards.json'), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, 'content/z_cards.json')) else {}   # 예전 손글 40쪽: 이야기 제목(질문형)·핵심 위험·이런 사람에게 맞아요
FAILED = []   # 그날 렌더하지 못한 글(값 없음) — save_cache가 함께 남긴다
CACHE = {'z': {}, 'gu': {}}   # 글에 쓴 값(키 → 글자) — tools/zhand_check.py가 페이지 글자·/api/v1과 대조
def save_cache():
    CACHE['failed'] = FAILED
    json.dump(CACHE, open(os.path.join(ROOT, 'pipeline/cache/zhand_vals.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)

def sources():
    out = {}
    for f in sorted(glob.glob(os.path.join(CZ, '*.json'))):
        o = json.load(open(f, encoding='utf-8')); out[o['id']] = o
    return out

def dsp(v):   # tools/zpages.py dsp와 같은 규칙(보이는 값 ZF.cash 올림끼리 가운데 값)
    return math.ceil(v * 100 - 1e-6) / 100 if v < 1 else math.ceil(v * 10 - 1e-6) / 10
def ymd(d): return str(d or '')[:10].replace('-', '.')
def ym(d): return str(d or '')[:7].replace('-', '.')

class Ctx:
    """tools/zpages.py의 전역(같은 자료·같은 함수)을 받아 쓴다 — 숫자를 따로 계산하지 않는다."""
    def __init__(self, g): self.__dict__.update({k: v for k, v in g.items() if not k.startswith('__')})

# ------------------------------------------------------------------ 값
def vals(X, r):
    """구역 하나의 {{키}} 값(글자). 자료가 없는 키는 None — 글에 쓰면 render가 멈춘다(지어내지 않음)."""
    rid = r['id']; c = X.C.get(rid) or {}; p = X.P.get(rid) or {}; dt = p.get('dt') or {}; t = r.get('tx') or {}; sm = r.get('sm') or {}
    k3 = X.key3(r, c, dt, X.D.get('asOf'), X.D.get('upd')); e = __import__('zsample').eta_adj(r, X.D.get('asOf')) or {}   # 앱·/api/v1과 같은 가로·소규모 보정
    v = {}
    v['stage'] = c.get('stage') or r.get('sr')
    sd = X._sdate(r); v['since'] = ymd(sd) if sd else None; v['sinceYM'] = ym(sd) if sd else None
    y = X._yrs(sd) if sd else None; med, _ = X._stats(); m = med.get(r.get('s', 0))
    v['stageYrs'] = f'{y:.1f}' if y is not None else None
    v['seoulStageMed'] = f'{m[0]:.1f}' if m else None; v['seoulStageN'] = f'{m[1]:,}' if m else None
    v['now'] = k3.get('lnow') or (k3['now'] if k3['now'] != '계산 보류' else None)
    v['tot'] = k3.get('ltot') or (k3['tot'] if k3['tot'] != '계산 보류' else None)
    v['eta'] = k3.get('eta')
    v['gapNow'] = X.cash(c['gapNow']) if c.get('gapOk') and c.get('gapNow') is not None else None
    v['gapTotal'] = X.cash(c['gapTotal']) if c.get('gapOk') and c.get('gapTotal') is not None else None
    v['cnow'] = X.cash(c['now']) if c.get('now') is not None else None
    v['need'] = X.cash(c['need']) if c.get('need') is not None else None
    v['price'] = X.manT(c['price']) if c.get('price') is not None else None
    v['jeonse'] = X.manT(c['jeonse']) if c.get('jeonse') is not None else None
    v['jrate'] = f"{round(c['jeonse'] / c['price'] * 100)}%" if c.get('jeonse') and c.get('price') else None
    en = (r.get('mk') or {}).get('entry') or {}
    v['sampleN'] = f"{en['n']:,}" if en.get('n') else None
    v['n12'] = f"{t['n12']:,}" if t.get('n12') is not None else None
    v['n3'] = f"{t['n3']:,}" if t.get('n3') is not None else None
    v['yoy'] = f"{abs(t['yoy'])}%" if t.get('yoy') is not None and min(t.get('yon') or [0]) >= 30 else None
    v['yonA'], v['yonB'] = (f"{t['yon'][0]}", f"{t['yon'][1]}") if v['yoy'] else (None, None)
    v['pol'] = f"{t['old']['pol']}%" if t.get('old') and isinstance(t['old'].get('pol'), (int, float)) else None
    v['split'] = f"{t['split']}" if t.get('split') else None   # 2016년 뒤 준공 · 대지지분 15㎡ 이하 매매 건수(tools/tx.py split)
    v['new10'] = f"{t['old']['new10']}" if t.get('old') and t['old'].get('new10') else None
    v['oldAvg'] = f"{t['old']['avg']}년" if t.get('old') and t['old'].get('avg') else None
    hd = ((X.TXX.get(rid) or {}).get('x') or {}).get('hd')
    v['hdU'] = X.eok_m(hd['u']) if hd else None; v['hdN'] = f"{hd['n']:,}" if hd else None
    v['im'] = X.eok_m(t['im']) if t.get('im') else None; v['imN'] = f"{t['in']}" if t.get('in') else None
    v['am'] = X.eok_m(t['am']) if t.get('am') else None; v['amN'] = f"{t['an']}" if t.get('an') else None
    v['owners'] = f"{int(sm['owners']):,}" if sm.get('owners') else None
    v['members'] = f"{int(sm['members']):,}" if sm.get('members') else None
    v['units'] = f"{int(sm['units']):,}" if sm.get('units') else None
    v['area'] = f"{sm['area']:,.0f}" if sm.get('area') else None
    v['rental'] = f"{int(sm['rental']):,}" if sm.get('rental') else None
    v['areaPy'] = f"{sm['area'] / 3.3058:,.0f}" if sm.get('area') else None
    psm = p.get('sm') or {}
    v['far'] = f"{psm['far']:g}%" if psm.get('far') else None
    fl = re.match(r'지상:(\d+)', str(psm.get('floors') or '')); v['floors'] = f"{fl.group(1)}층" if fl else None
    v['p10'] = (f"{min(97, round(e['p10'] * 100))}%" if e['p10'] >= 0.01 else '1% 미만') if e.get('p10') is not None and not r.get('stale') else None   # /api/v1 completion.p10과 같은 값(가로·소규모 보정)
    v['eLo'] = ym(e.get('eLo')) if e.get('eLo') else None; v['eMid'] = ym(e.get('eMid')) if e.get('eMid') else None; v['eHi'] = ym(e.get('eHi')) if e.get('eHi') else None
    v['eLoY'] = e['eLo'][:4] if e.get('eLo') else None; v['eHiY'] = e['eHi'][:4] if e.get('eHi') else None
    st = r.get('st') or c.get('st') or {}   # 앱 구역 시트(64_overview.js)·/api/v1과 같은 r.st (calc.json st와 몇 m 다를 수 있음)
    v['station'] = st.get('n'); v['walk'] = f"{max(1, round(st['d'] * 1.3 / 67))}분" if st.get('d') is not None else None
    v['rdx'] = ymd((r.get('rdx') or {}).get('d')) if (r.get('rdx') or {}).get('d') else None
    th = (X.TH.get('z') or {}).get(rid) or {}
    v['thN'] = f"{th['n']}" if th else None; v['thN30'] = f"{th['n30']}" if th else None
    v['thSince'] = ymd(X.TH.get('since')) if th else None
    au = [x for x in ((X.AUC.get('byZone') or {}).get(rid) or []) if not x.get('st') and str(x.get('date') or '') >= X.AUT] if X.AUC.get('ok') else []
    v['aucN'] = f"{len({x.get('cs') for x in au})}" if au else None
    for kk, lab in (('구역지정', 'dtZone'), ('추진위', 'dtCom'), ('조합설립', 'dtUnion'), ('시행자지정', 'dtTrust'), ('사업시행', 'dtImpl'), ('관리처분', 'dtMgmt'), ('착공', 'dtBuild'), ('시공자', 'dtBuilder'), ('이주', 'dtMove')):
        v[lab] = ymd(dt[kk]) if dt.get(kk) else None
    cs = r.get('cs') or {}
    for kk, lab in (('조합설립', 'csUnion'), ('사업시행', 'csImpl'), ('추진위', 'csCom')):
        v[lab] = f"{cs[kk]['v']:g}%" if (cs.get(kk) or {}).get('v') else None
    # 같은 구 · 서울 견주기(첫 화면 곳 수와 같은 LISTED 기준 · /gu 가운데 값과 같은 dsp 꼴)
    g = r['g']; L = [x for x in X.R if X.LISTED(x)]
    gm = [dsp(X.C[x['id']]['gapNow']) for x in L if x['g'] == g]; sm_ = [dsp(X.C[x['id']]['gapNow']) for x in L]
    v['guMedNow'] = X.eok(statistics.median(gm)) if len(gm) >= 5 else None; v['guListed'] = f"{len(gm)}"
    v['seoulMedNow'] = X.eok(statistics.median(sm_)) if sm_ else None; v['seoulListed'] = f"{len(sm_):,}"
    if X.LISTED(r) and len(gm) >= 5:
        G = sorted(X.C[x['id']]['gapNow'] for x in L if x['g'] == g); k = G.index(c['gapNow']) + 1
        v['guRank'] = f"{k}"; v['guRankN'] = f"{len(G)}"; v['guRankW'] = X._rk(k, len(G), '적게 들어요', '많이 들어요')
        v['guCheaper'] = f"{k - 1}"
    else: v['guRank'] = v['guRankN'] = v['guRankW'] = v['guCheaper'] = None
    gl = [x for x in X.R if x['g'] == g]; v['guZones'] = f"{len(gl)}"
    v['guSameStage'] = f"{sum(1 for x in gl if X._stage(x) == v['stage'])}"
    sl = r.get('sl') or {}
    v['slA'] = f"{sl['a']:g}°" if sl.get('a') is not None else None; v['slD'] = f"{sl['d']}m" if sl.get('d') is not None else None; v['slP'] = f"{sl['p']}%" if sl.get('p') is not None else None
    hb = r.get('hb') or {}
    for kk, lab in (('광화문·시청(CBD)', 'toCBD'), ('강남역(GBD)', 'toGBD'), ('여의도(YBD)', 'toYBD')):
        v[lab] = f"{hb[kk] / 1000:.1f}km" if hb.get(kk) else None
    v['kind'] = X.KIND.get(r['k'], r['k']); v['name'] = X.short(r['n']); v['gu'] = g
    v['upd'] = X.UPD
    return v

def fill(text, V, rid, plain=False):
    def f(m):
        k = m.group(1)
        if k not in V: raise KeyError(f'{rid}: 모르는 값 {{{{{k}}}}}')
        if V[k] is None: raise ValueError(f'{rid}: 자료가 없는 값 {{{{{k}}}}} — 글을 고치거나 문장을 빼세요')
        return esc(V[k]) if plain else f'<b class="zv" data-zv="{k}">{esc(V[k])}</b>'
    return PH.sub(f, text)

def josa_fix(h):
    """{{값}} 뒤 조사 자리표 '(이)가'·'(은)는'·'(을)를'·'(으)로'·'(이)에요' → 값 받침에 맞게(값이 날마다 바뀌어도 맞게)"""
    from zsample import josa, ro
    def f(m):
        w = re.sub(r'<[^>]+>', '', m.group(1)); a = m.group(2)
        if a == '(으)로': return m.group(1) + ro(w)
        pairs = {'(이)가': ('이', '가'), '(은)는': ('은', '는'), '(을)를': ('을', '를'), '(과)와': ('과', '와'), '(이)에요': ('이에요', '예요'), '(이)고': ('이고', '고'), '(이)라': ('이라', '라')}
        x, y = pairs[a]; return m.group(1) + josa(w, x, y)
    return re.sub(r'(<b class="zv"[^>]*>[^<]*</b>)(\(이\)가|\(은\)는|\(을\)를|\(으\)로|\(과\)와|\(이\)에요|\(이\)고|\(이\)라)', f, h)

# ------------------------------------------------------------------ 그림
def chart(X, r):
    """앱 구역 상세 가격 흐름(64_overview.js chart)과 같은 분기 값 · 같은 꼴(최근 3년 · 이번 분기 뺌 · 12분기까지)."""
    hd = ((X.TXX.get(r['id']) or {}).get('x') or {}).get('hd')
    if not hd or not hd.get('q'): return ''
    unit = {'i': '입주권', 'a': '아파트', 'v': '빌라·단독 대지'}[hd['b']] + ' 3.3㎡당'
    nd = datetime.date.today(); cut = str(nd.year - 3)[-2:]; curQ = f"{str(nd.year)[2:]}Q{(nd.month - 1) // 3 + 1}"
    qq = [x for x in hd['q'] if x[0][:2] >= cut and x[0] != curQ][-12:]
    if len(qq) < 3: return ''
    W, H, pl, pr, pt, pb, gap = 320, 150, 42, 2, 18, 32, 4; n = len(qq); bw = min(24, (W - pl - pr - gap * (n - 1)) / n)
    mx = max(x[1] for x in qq)
    def nice(v):
        p = 10 ** math.floor(math.log10(max(1, v))); m = v / p; return (1 if m < 1.5 else 2 if m < 3.5 else 5 if m < 7.5 else 10) * p
    st = nice(mx / 2); ticks = []; tt = st
    while not ticks or ticks[-1] < mx: ticks.append(tt); tt += st
    top = max(mx, ticks[-1]); base = H - pb; off = pl + (W - pl - pr - (n * (bw + gap) - gap)) / 2
    Xp = lambda i: off + i * (bw + gap); Yp = lambda v: pt + (base - pt) * (1 - v / top)
    E = X.eok_m
    g = ''.join(f'<line x1="{pl}" x2="{W - pr}" y1="{Yp(t):.1f}" y2="{Yp(t):.1f}" class="g"/><text x="{pl - 6}" y="{Yp(t) + 3.5:.1f}" class="ax">{E(t)}</text>' for t in ticks) + f'<line x1="{pl}" x2="{W - pr}" y1="{base}" y2="{base}" class="g b"/>'
    imx = next(i for i, x in enumerate(qq) if x[1] == mx); last = ''; bars = []
    for i, x in enumerate(qq):
        y = Yp(x[1]); yr = '20' + x[0][:2]; lab = ''
        if yr != last: last = yr; lab = f'<text x="{Xp(i):.1f}" y="{H - 3}" class="yr">{yr}</text>'
        cx = Xp(i) + bw / 2; anc = 'end' if cx > W - 40 else 'middle'; tx = Xp(i) + bw if anc == 'end' else cx
        val = f'<text x="{tx:.1f}" y="{y - 5:.1f}" text-anchor="{anc}" class="bv{" last" if i == n - 1 else ""}">{E(x[1])}</text>' if i == n - 1 or (i == imx and imx < n - 2) else ''
        cls = ' '.join(c for c in ('on' if i == n - 1 else '', 'lo' if x[2] < 3 else '') if c)
        bars.append(f'<rect x="{Xp(i):.1f}" y="{y:.1f}" width="{bw:.1f}" height="{max(1, base - y):.1f}" rx="3"{f" class=\"{cls}\"" if cls else ""}><title>20{x[0][:2]}년 {x[0][3:]}분기 · {E(x[1])} · {x[2]}건</title></rect>{val}<text x="{cx:.1f}" y="{base + 12}" class="bq">{x[0][2:]}</text>' + (f'<text x="{cx:.1f}" y="{base - 4:.1f}" class="bn{" on" if i == n - 1 else ""}">{x[2]}</text>' if base - y >= 15 else '') + lab)
    lo = any(x[2] < 3 for x in qq)
    first, lastq = qq[0], qq[-1]
    return (f'<!--zd--><div class="zh-card zh-ch" role="figure" aria-label="{unit} 분기별 가운데 값 그림"><p class="zh-fc"><b>{unit} · 분기별 가운데 값</b><span>최근 분기 {E(lastq[1])} · 20{first[0][:2]}년 {first[0][3:]}분기 {E(first[1])}</span></p>'
            f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{unit} 분기별 가운데 값, 최근 {E(lastq[1])}, 최고 {E(mx)}">{g}{"".join(bars)}</svg>'
            f'<p class="zh-cap">국토교통부 실거래 신고분 · 구역 대표 거래 기준(앱 구역 상세 그림과 같은 값) · 막대 안 숫자는 분기 거래 수{" · 흐린 막대는 3건 미만" if lo else ""} · 데이터 기준 {X.UPD}</p></div><!--/zd-->')

DTL = [('구역지정', '정비구역 지정'), ('추진위', '추진위원회 승인'), ('조합설립', '조합설립인가'), ('시행자지정', '사업시행자 지정'), ('시공자', '시공자 선정'), ('사업시행', '사업시행인가'), ('관리처분', '관리처분인가'), ('이주', '이주 시작'), ('착공', '착공'), ('준공', '준공')]
def timeline(X, r, src):
    """정보몽땅 등록 단계 날짜(자료) + 기사·고시로 확인한 일(글쓴이) — 날짜 순 · 지금 단계 표시 · 다음 단계 예상(범위)"""
    dt = (X.P.get(r['id']) or {}).get('dt') or {}
    ORD = ['구역지정', '추진위', '조합설립', '시행자지정', '사업시행', '관리처분', '이주', '착공', '준공']
    def stale(k):   # 뒤 단계 날짜보다 늦게 적힌 앞 단계 날짜(변경 승인일이 덮어쓴 것)는 일정표에서 뺀다 · 구역지정·추진위 순서는 구역마다 달라 둘끼리는 견주지 않음
        if k not in ORD: return False
        i = ORD.index(k); later = [dt[x] for x in ORD[i + 1:] if dt.get(x) and not {k, x} <= {'구역지정', '추진위'}]
        return any(dt[k] > d for d in later)
    rows = [(dt[k], lab, '정보몽땅 등록') for k, lab in DTL if dt.get(k) and not stale(k)]
    for d, lab in src.get('events') or []: rows.append((d.replace('.', '-'), lab, '기사·고시'))
    rows.sort(key=lambda z: z[0])
    cur = X._sdate(r)
    li = ''.join(f'<li class="{"cur" if d == cur and s == "정보몽땅 등록" else ""}{" ev" if s != "정보몽땅 등록" else ""}"><b>{esc(ymd(d) if len(d) >= 10 else ym(d))}</b><span>{esc(lab)}</span><small>{esc(s)}</small></li>' for d, lab, s in rows)
    e = __import__('zsample').eta_adj(r, X.D.get('asOf')) or {}; c = X.C.get(r['id']) or {}   # 앱·/api/v1과 같은 가로·소규모 보정
    nx = ''
    if e.get('eLo') and e.get('eHi') and not r.get('stale'):
        nx = f'<li class="nx"><b>{esc(ym(e["eLo"]))}~{esc(ym(e["eHi"])[2:])}</b><span>준공 예상 범위(추정)</span><small>서울 사업장 기록 통계 · 가운데 {esc(ym(e.get("eMid")))}</small></li>'
    return f'<!--zd--><div class="zh-card zh-tl"><p class="zh-ct">단계 일정표</p><ol>{li}{nx}</ol><p class="zh-cap">줄마다 아래에 출처를 적었어요(정보몽땅 등록 날짜 · 기사·고시로 확인한 일). 예상 범위는 단정이 아니에요.</p></div><!--/zd-->'

def checklist(items, V, rid, title='사기 전에 이것 3가지만 확인하세요'):
    return f'<div class="zh-card zh-ck"><p class="zh-ct">{esc(title)}</p><ol>' + ''.join(f'<li>{josa_fix(fill(x, V, rid))}</li>' for x in items) + '</ol></div>'

def carousel(X, r, src, V):
    c = X.C.get(r['id']) or {}; k3 = X.key3(r, c, (X.P.get(r['id']) or {}).get('dt') or {}, X.D.get('asOf'), X.D.get('upd'))
    hv = bool(k3.get('lnow'))
    if hv: m1 = (k3['lnow'], '대출 끼고 · 전세를 안고는 살 수 없는 곳' + (f' · 입주까지 {k3["ltot"]}' if k3.get('ltot') else ''))
    elif k3['now'] != '계산 보류': m1 = (k3['now'], k3['basis'] + (f' · 입주까지 {k3["tot"]}' if k3['tot'] != '계산 보류' else ''))
    else: m1 = ('계산 보류', (k3.get('esub') or k3.get('basis') or '') + (f' · {k3["alt"]}' if k3.get('alt') else ''))
    e = __import__('zsample').eta_adj(r, X.D.get('asOf')) or {}   # 앱·/api/v1과 같은 가로·소규모 보정
    if e.get('eLo') and e.get('eHi') and not r.get('stale') and r.get('s', 0) < 9:
        m2 = (f'{e["eLo"][:4]}~{e["eHi"][:4]}년', f'준공 예상 범위(추정) · 가운데 {ym(e.get("eMid"))}' + (f' · 10년 안 준공 가능성 {V["p10"]}' if V.get('p10') and r.get('s', 0) < 8 else '') + (' · 지금 사면 입주권은 없어요' if k3.get('elab') == '입주권' and not k3.get('im') else ''))
    else: m2 = (k3.get('eta') or '산정 불가', k3.get('esub') or '입주 시기는 범위로만 봐요')
    cards = [('지금 필요한 돈', m1[0], m1[1], 'm'), ('입주 시기 범위', m2[0], m2[1], 'm'), ('핵심 위험', None, src['cards']['risk'], 'r'), ('이런 사람에게 맞아요', None, src['cards']['fit'], 'f')]
    li = ''.join(f'<li class="zh-s zh-s{t}" role="group" aria-roledescription="슬라이드" aria-label="{i + 1}/{len(cards)} {esc(a)}"><span class="zh-sl">{esc(a)}</span>' + (f'<b class="zh-sv">{esc(b)}</b>' if b else '') + f'<p>{josa_fix(fill(s, V, r["id"])) if t in "rf" else esc(s)}</p></li>' for i, (a, b, s, t) in enumerate(cards))
    return (f'<!--zd--><section class="zh-car" aria-roledescription="캐러셀" aria-label="{esc(V["name"])} 요약 카드 {len(cards)}장"><ul class="zh-tr" tabindex="0" aria-label="요약 카드 · 옆으로 넘기거나 화살표 키로 이동">{li}</ul>'
            f'<p class="zh-hint" aria-hidden="true">옆으로 넘겨 보세요 · 기본 가정(무주택·84㎡) 추정 · 데이터 기준 {X.UPD}</p></section><!--/zd-->')

def nextcards(X, r, src):
    """다음에 볼 구역: 손글 있는 곳 먼저 → 같은 유형 → 거리 순(2.5km 안) · 4곳 · 직접 고른 목록(next)이 있으면 그것부터"""
    if not r.get('ll'): return ''
    rid = r['id']; hand = X._HANDSET
    near = []
    for y in X.R:
        if y['id'] == rid or not y.get('ll'): continue
        d = X.dist(r['ll'][0], r['ll'][1], y['ll'][0], y['ll'][1])
        if d <= 2500: near.append((d, y))
    pick = [X._BY[i] for i in (src.get('next') or []) if i in X._BY and i in X._LIVE]
    rest = sorted(near, key=lambda z: (z[1]['id'] not in hand, z[1]['k'] != r['k'], z[0]))
    for d, y in rest:
        if len(pick) >= 4: break
        if y not in pick: pick.append(y)
    if not pick: return ''
    def card(y):
        c = X.C.get(y['id']) or {}; k3 = X.key3(y, c, (X.P.get(y['id']) or {}).get('dt') or {}, X.D.get('asOf'), X.D.get('upd'))
        mon = k3.get('lnow') and f'대출 끼고 지금 {k3["lnow"]}' or (k3['now'] != '계산 보류' and f'전세 끼고 지금 {k3["now"]}') or '지금 필요한 돈 계산 보류'
        d = X.dist(r['ll'][0], r['ll'][1], y['ll'][0], y['ll'][1]) if y.get('ll') else None
        tag = '<em>분석 글</em>' if y['id'] in hand else ''
        return f'<a class="zh-nc" href="{y["id"]}"><b>{esc(X.short(y["n"]))}{tag}</b><span>{esc(X.KIND.get(y["k"], y["k"]))} · {esc(c.get("stage") or y.get("sr") or "")}{f" · {d / 1000:.1f}km" if d is not None else ""}</span><small>{esc(mon)}</small></a>'
    return '<!--zd--><nav class="zh-next" aria-labelledby="zh-nx"><h2 id="zh-nx">다음에 볼 구역</h2><div class="zh-ng">' + ''.join(card(y) for y in pick[:4]) + '</div><p class="zh-cap">가까운 곳 가운데 분석 글이 있는 구역을 먼저 놓았어요. 추천 목록이 아니에요.</p></nav><!--/zd-->'

CSS = ('<style>'
       '.zh-car{margin:18px 0 6px}.zh-tr{list-style:none;margin:0;padding:2px 2px 8px;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(232px,82%);gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin}'
       '.zh-tr:focus-visible{outline:2px solid var(--focus,#1f3a87);outline-offset:2px;border-radius:14px}'
       '@media (min-width:760px){.zh-tr{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}.zh-hint{display:none}}'
       '@media (prefers-reduced-motion:no-preference){.zh-tr{scroll-behavior:smooth}}'
       '.zh-s{scroll-snap-align:start;min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px 16px;position:relative}'
       '.zh-s::before{content:"";position:absolute;top:16px;right:16px;width:8px;height:8px;border-radius:50%;background:#FFC24A}'
       '.zh-sl{display:block;font-size:12.5px;font-weight:700;color:var(--brand)}.zh-sv{display:block;font-size:22px;line-height:1.3;margin:4px 0 2px;font-variant-numeric:tabular-nums;word-break:keep-all}'
       '.zh-s p{margin:4px 0 0;font-size:14px;line-height:1.6;color:var(--text-2);word-break:keep-all}.zh-sr{border-left:4px solid var(--warn-ink,#8a4b00)}.zh-sf{border-left:4px solid var(--brand)}'
       '.zh-hint,.zh-cap,.zh-body .zh-cap,.zh-body .zh-fc{font-size:12px!important;line-height:1.55!important;color:var(--text-3);margin:6px 0 0!important}.zh-body .zh-fc{font-size:13.5px!important;color:var(--text-1);margin:0 0 6px!important;display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px}'
       '.zh-toc{margin:16px 0;padding:12px 16px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)}.zh-toc p{margin:0 0 6px;font-weight:700;font-size:14px}'
       '.zh-toc ol{margin:0;padding-left:1.3em}.zh-toc li{margin:4px 0;line-height:1.5}.zh-toc a{color:var(--text-1)}'
       '.zh-body h2{scroll-margin-top:72px}.zh-body p{font-size:15.5px;line-height:1.8;margin:0 0 12px;word-break:keep-all}'
       '.zh-card{margin:16px 0;padding:14px 16px;border:1px solid var(--border);border-radius:16px;background:var(--surface);min-width:0}.zh-ct{margin:0 0 8px!important;font-weight:700;font-size:14.5px!important}'
       '.zh-tl ol{list-style:none;margin:0;padding:0}.zh-tl li{display:grid;grid-template-columns:7.2em 1fr;gap:2px 10px;padding:7px 0 7px 14px;border-left:2px solid var(--border);position:relative}'
       '.zh-tl li::before{content:"";position:absolute;left:-5px;top:13px;width:8px;height:8px;border-radius:50%;background:var(--surface);border:2px solid var(--text-3)}'
       '.zh-tl li.cur::before{background:var(--brand);border-color:var(--brand)}.zh-tl li.nx::before{background:#FFC24A;border-color:#FFC24A}.zh-tl li.ev span{color:var(--text-2)}'
       '.zh-tl b{font-variant-numeric:tabular-nums;font-size:14px}.zh-tl span{font-size:14.5px;line-height:1.5}.zh-tl small{grid-column:2;font-size:12px;color:var(--text-3)}'
       '.zh-fc{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px;font-size:13.5px;margin-bottom:6px}.zh-fc span{color:var(--text-3)}'
       '.zh-ch svg{display:block;width:100%!important;min-width:0!important;height:auto;max-width:520px;border:0!important;border-radius:0!important}.zh-ch rect{fill:var(--brand);opacity:.55}.zh-ch rect.on{opacity:1}.zh-ch rect.lo{opacity:.25}'
       '.zh-ch .g{stroke:var(--divider,#e5e8eb);stroke-width:1}.zh-ch .g.b{stroke:var(--text-3)}.zh-ch text{font-size:10px;fill:var(--text-3);font-family:inherit}.zh-ch .ax{text-anchor:end}.zh-ch .bq,.zh-ch .bn{text-anchor:middle}'
       '.zh-ch .bn{fill:#fff;font-size:9px}.zh-ch .bv{fill:var(--text-1);font-weight:700}.zh-ch .yr{font-size:9.5px}'
       '.zh-ck{border-left:4px solid #FFC24A}.zh-ck ol{margin:0;padding-left:1.3em}.zh-ck li{margin:8px 0;line-height:1.65;font-size:15px}'
       '.zh-next{margin:26px 0 8px}.zh-ng{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}'
       '.zh-nc{display:flex;flex-direction:column;gap:3px;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--text-1);text-decoration:none!important;min-width:0}'
       '.zh-nc:hover{border-color:var(--brand)}.zh-nc b{font-size:15.5px}.zh-nc em{font-style:normal;margin-left:6px;padding:1px 6px;border-radius:6px;background:var(--brand-soft,#e8edf9);color:var(--brand);font-size:11.5px;vertical-align:2px}'
       '.zh-nc span{font-size:12.5px;color:var(--text-3)}.zh-nc small{font-size:13px;color:var(--text-2);font-weight:600}'
       'b.zv{font-weight:700;font-variant-numeric:tabular-nums}.zh-hook{font-size:17px;line-height:1.75;font-weight:600;color:var(--text-1);margin:14px 0 8px;word-break:keep-all}'
       '@media (max-width:420px){.zh-tl li{grid-template-columns:6.4em 1fr}.zh-sv{font-size:20px}}'
       '</style>')

def page(X, r, src):
    rid = r['id']; V = vals(X, r); nm = V['name']; kind = V['kind']
    tnm, tq = X.zt(r); title = X.ztitle_s(r); url = f"{X.SITE}/z/{rid}"
    W = src['written']; Wd = W.replace('-', '.')
    desc = src['desc']
    cites = [s[3] for s in src.get('sources') or []]
    ld = {"@context": "https://schema.org", "@graph": [{"@type": "Article", "headline": src['h1'], "description": desc, "inLanguage": "ko", "datePublished": src['first'], "dateModified": W,
          "image": f"{X.SITE}/og.png", "mainEntityOfPage": url, "author": {"@type": "Person", "name": "집핀 운영자", "url": f"{X.SITE}/about"}, "publisher": {"@type": "Organization", "name": "집핀", "url": X.SITE}, "citation": cites}]}
    secs = src['sections']
    toc = '<nav class="zh-toc" aria-label="이 글의 차례"><p>이 글에서 답하는 질문</p><ol>' + ''.join(f'<li><a href="#{s["id"]}">{esc(s["h"])}</a></li>' for s in secs) + '<li><a href="#zh-check">사기 전에 이것 3가지만</a></li></ol></nav>'
    body = []; nads = 0
    for si, s in enumerate(secs):
        body.append(f'<h2 id="{s["id"]}">{esc(s["h"])}</h2>')
        bl = s['blocks']
        for bi, b in enumerate(bl):
            if isinstance(b, str):
                body.append('<p>' + josa_fix(fill(b, V, rid)) + '</p>')
                # 광고 칸 자리(승인 뒤 설정): 둘째·넷째 질문에서 문단과 문단 사이에만
                if si in (1, 3) and nads < 2 and bi + 1 < len(bl) and isinstance(bl[bi + 1], str) and bi >= 0 and not any('ad-slot' in x for x in body[-3:]):
                    body.append('<!--ad-slot-->'); nads += 1
            elif b['t'] == 'timeline': body.append(timeline(X, r, src))
            elif b['t'] == 'chart': body.append(chart(X, r))
            elif b['t'] == 'live': body.append('<!--zk--><!--/zk-->')
            elif b['t'] == 'calc': body.append('<!--zc--><!--/zc-->')
            elif b['t'] == 'card': body.append(f'<div class="zh-card"><p class="zh-ct">{esc(b["title"])}</p>' + ''.join(f'<p>{josa_fix(fill(x, V, rid))}</p>' for x in b['p']) + '</div>')
    body.append('<h2 id="zh-check">사기 전에 이것 3가지만</h2>' + ('<p>' + josa_fix(fill(src['checkLead'], V, rid)) + '</p>' if src.get('checkLead') else '') + checklist(src['check'], V, rid))
    srcs = '<details class="srcs"><summary>참고한 기사·고시·법령 ' + str(len(src.get('sources') or [])) + '건</summary><ul>' + ''.join(f'<li>{esc(a)}, 「{esc(b)}」 ({esc(c)}) <a href="{esc(u)}" target="_blank" rel="noopener nofollow">원문</a></li>' for a, b, c, u in src.get('sources') or []) + '</ul></details>'
    # 머리·바닥은 tools/zpages.py의 공통 틀(HEAD·FOOT)을 그대로 쓴다 — 서비스 이름·메뉴 같은 공통 상수는 그쪽에서 한 번에 바뀐다
    brand = (re.search(r'<meta property="og:site_name" content="([^"]*)"', X.HEAD) or [None, ''])[1]
    for a in ld['@graph']:
        a['author']['name'] = f'{brand} 운영자'.strip(); a['publisher']['name'] = brand
    head = X.HEAD.format(title=esc(title), desc=esc(desc), url=url, site=X.SITE, ld=json.dumps(ld, ensure_ascii=False).replace("</", "<\\/"))
    head = head.replace('<meta name="emr-auto" content="1">\n', '', 1)
    head = head.replace('<link rel="canonical"', f'<link rel="alternate" type="application/rss+xml" title="{esc(X.nk(nm, kind))} 소식" href="../feed/z/{rid}.xml">\n<link rel="canonical"', 1)
    head = head.replace('<script type="application/ld+json">', ADTAG + '\n<script type="application/ld+json">', 1).replace('</head>', CSS + '\n</head>', 1)
    o = [head]
    o.append(f'<p class="eyebrow">{esc(r["g"])} {esc(r.get("j") or "")} · {esc(kind)} · 글 기준 {Wd}</p>')
    o.append(f'<h1>{esc(src["h1"])}</h1>')
    o.append(f'<p class="byline">정리: <a href="../about">운영자</a> · 기사·고시·정비사업 정보몽땅 대조 · 처음 올림 {int(src["first"][:4])}년 {int(src["first"][5:7])}월 {int(src["first"][8:10])}일 · 글 속 굵은 숫자는 매일 사이트 계산값으로 다시 써요</p>')
    o.append('<p class="lede">' + josa_fix(fill(src['lede'], V, rid)) + '</p>')
    o.append(carousel(X, r, src, V))
    o.append(toc)
    o.append('<div class="zh-body">' + ''.join(body) + '</div>')
    o.append(nextcards(X, r, src))
    o.append(srcs)
    o.append(f'<p class="disc">출처: 정비사업 정보몽땅 추진경과·사업개요, 국토교통부 실거래가, 서울부동산정보광장 토지거래허가, 위 기사·고시. 금액은 기본 가정(무주택·84㎡·비례율 100%)으로 낸 추정이고 실제 분담금은 감정평가·관리처분계획으로 정해져요. 투자 권유가 아니에요. 서울시·국토교통부와 무관한 개인 운영 서비스예요.</p>')
    o.append('<!--zr--><!--/zr-->')
    o.append(X.FOOT.format(upd=X.UPD))
    return ''.join(o)

def render_all(g):
    """content/z/*.json → public/z/<id>.html (진행 중인 구역만). 돌려주는 값: 쓴 id 목록"""
    global HANDSET
    X = Ctx(g); S = sources(); done = []
    X._HANDSET = HANDSET = {f[:-5] for f in os.listdir(X.ZD) if f.endswith('.html') and f != 'index.html' and X.is_hand(f[:-5])} | set(S)
    for rid, src in S.items():
        r = X._BY.get(rid)
        if not r or rid not in X._LIVE: print('  zhand: skip (진행 중 아님)', rid); continue
        try: h = page(X, r, src); CACHE['z'][rid] = vals(X, r)
        except (KeyError, ValueError) as e:   # 그날 자료에 글이 쓰는 값이 없으면(지어내지 않음) 이 페이지만 어제 것을 둔다 — 매일 갱신 전체를 멈추지 않게 · zhand_check.py가 실패로 알림
            print('  !! zhand: 어제 페이지 유지 —', e); FAILED.append(f'{rid}: {e}'); done.append(rid) if os.path.exists(os.path.join(X.ZD, rid + '.html')) else None; continue
        fp = os.path.join(X.ZD, rid + '.html')
        old = open(fp, encoding='utf-8').read() if os.path.exists(fp) else ''
        # 아래 탭·머리(static_tabs.py가 입힘)는 지난번 것을 유지해 매번 같은 결과가 되게
        m = re.search(r'<!--zp-tabs-->.*?<!--/zp-tabs-->', old, re.S)
        if m: h = h.replace('</body>', m.group(0) + '\n</body>', 1)
        open(fp, 'w', encoding='utf-8').write(h); done.append(rid)
    for rid in filter(None, os.environ.get('ZH_PEEK', '').split(',')):   # 글 쓰는 사람용: 쓸 수 있는 값 미리 보기(ZH_PEEK=o1,o2)
        if rid in X._BY: print('ZH_PEEK', rid, json.dumps(vals(X, X._BY[rid]), ensure_ascii=False))
    print('zhand: hand analysis pages', len(done))
    return done

# ------------------------------------------------------------------ /gu 해설
def gu_vals(X, g, L):
    """구 해설 {{키}} 값: /gu 목록·첫 화면 곳 수와 같은 기준(LISTED · dsp 가운데 값)"""
    X._HANDSET = HANDSET; cg = lambda x: X.C.get(x['id']) or {}
    v = {'gu': g, 'n': f"{len(L)}", 'upd': X.UPD}
    stc = collections.Counter(X._stage(x) for x in L if X._stage(x))
    for k, lab in (('정비계획 수립', 'stPlan'), ('정비구역 지정', 'stZone'), ('추진위원회 승인', 'stCom'), ('조합설립인가', 'stUnion'), ('사업시행자 지정', 'stTrust'), ('사업시행인가', 'stImpl'), ('관리처분인가', 'stMgmt'), ('이주·철거', 'stMove'), ('착공·분양', 'stBuild'), ('후보지·대상지 선정', 'stCand'), ('주민합의체·준비위원회', 'stPrep')):
        v[lab] = f"{stc.get(k, 0)}"
    early = sum(1 for x in L if (x.get('s', 0) or 0) <= 3)   # 조합(시행자) 전: 후보지·정비계획·구역지정·추진위·주민대표회의 등 단계 이름이 여럿이라 단계 번호로 센다
    late = sum(1 for x in L if (x.get('s', 0) or 0) >= 6)    # 관리처분인가 이후(이주·착공 포함)
    v['early'] = f"{early}"; v['late'] = f"{late}"; v['earlyPct'] = f"{round(early / max(1, len(L)) * 100)}%"
    ok = [x for x in L if X.LISTED(x)]; allok = [x for x in X.R if X.LISTED(x)]
    v['listed'] = f"{len(ok)}"
    v['med'] = X.eok(statistics.median([dsp(cg(x)['gapNow']) for x in ok])) if len(ok) >= 3 else None
    v['seoulMed'] = X.eok(statistics.median([dsp(cg(x)['gapNow']) for x in allok]))
    if v['med']:   # /gu 해설 견주기와 같은 5% 잣대(tools/zpages.py gu_note) — 값이 바뀌어도 말이 맞게
        gm, sm = statistics.median([dsp(cg(x)['gapNow']) for x in ok]), statistics.median([dsp(cg(x)['gapNow']) for x in allok])
        v['medVsSeoul'] = f"서울 전체 가운데 값 {v['seoulMed']}" + ('보다 많이 들어요' if gm > sm * 1.05 else '보다 적게 들어요' if gm < sm * 0.95 else '과 비슷해요')
    else: v['medVsSeoul'] = None
    for cap, lab in ((2, 'b2'), (3, 'b3'), (5, 'b5'), (8, 'b8')):
        v[lab] = f"{sum(1 for x in ok if cg(x)['gapNow'] <= cap + 1e-9)}"
    cheap = sorted(ok, key=lambda x: cg(x)['gapNow'])
    v['cheap1'] = f"{X.short(cheap[0]['n'])}({X.cash(cg(cheap[0])['gapNow'])})" if cheap else None
    v['cheap3'] = ', '.join(f"{X.short(x['n'])}({X.cash(cg(x)['gapNow'])})" for x in cheap[:3]) if len(cheap) >= 3 else None
    th = [x for x in L if str(cg(x).get('gapBlock') or '').startswith('전세 낀 매수 불가')]
    v['th'] = f"{len(th)}"; v['thPct'] = f"{round(len(th) / max(1, len(L)) * 100)}%"
    v['loanOnly'] = f"{sum(1 for x in th if cg(x).get('now') is not None)}"
    lo = sorted((cg(x)['now'] for x in th if cg(x).get('now') is not None))
    v['loanMin'] = X.cash(lo[0]) if lo else None
    cut = (datetime.date.today() - datetime.timedelta(days=365)).isoformat()
    moved = []
    for x in L:
        dt = (X.P.get(x['id']) or {}).get('dt') or {}
        ks = [(d, k) for k, d in dt.items() if k in ('구역지정', '추진위', '조합설립', '시행자지정', '사업시행', '관리처분', '착공') and d >= cut and d <= datetime.date.today().isoformat()]
        if ks: moved.append((max(ks)[0], x, max(ks)[1]))
    moved.sort(key=lambda z: z[0], reverse=True)
    KL = {'구역지정': '정비구역 지정', '추진위': '추진위원회 승인', '조합설립': '조합설립인가', '시행자지정': '사업시행자 지정', '사업시행': '사업시행인가', '관리처분': '관리처분인가', '착공': '착공'}
    v['moved'] = f"{len(moved)}"
    v['movedList'] = ', '.join(f"{X.short(x['n'])}({KL[k]} {ym(d)})" for d, x, k in moved[:4]) if moved else None
    ys = sorted(((X._yrs(X._sdate(x) or ''), x) for x in L if not x.get('stale') and X._sdate(x)), key=lambda z: -(z[0] or 0))
    ys = [(y, x) for y, x in ys if y is not None and y >= 8]
    v['stall'] = f"{len(ys)}"
    v['stallList'] = ', '.join(f"{X.short(x['n'])}({X._stage(x)} 뒤 {y:.1f}년)" for y, x in ys[:3]) if ys else None
    v['tx12'] = f"{sum((x.get('tx') or {}).get('n12') or 0 for x in L):,}"
    bx = max(L, key=lambda x: (x.get('tx') or {}).get('n12') or 0)
    v['txTop'] = f"{X.short(bx['n'])}({(bx.get('tx') or {}).get('n12') or 0}건)"
    kc = collections.Counter('재건축' if x['k'] == '재건축' else '가로·소규모' if x['k'] in ('가로주택(모아주택)', '소규모재건축', '소규모재개발') else '재개발' for x in L)
    v['nRedev'] = f"{kc.get('재개발', 0)}"; v['nRebuild'] = f"{kc.get('재건축', 0)}"; v['nSmall'] = f"{kc.get('가로·소규모', 0)}"
    hand = [x for x in L if x['id'] in X._HANDSET]
    v['handN'] = f"{len(hand)}"
    return v

def gu_prose(g, L, gl):
    """content/gu/<구>.json이 있으면 /gu 해설 덩이 HTML, 없으면 ''"""
    fp = os.path.join(CG, g + '.json')
    if not os.path.exists(fp): return ''
    X = Ctx(gl); src = json.load(open(fp, encoding='utf-8')); V = gu_vals(X, g, L); CACHE['gu'][g] = V
    try: return _gu_html(X, g, src, V)
    except (KeyError, ValueError) as e:   # 그날 값이 없는 문장이 있으면 해설 덩이를 빼고(지어내지 않음) 점검에 실패로 남긴다
        print('  !! zhand gu:', e); FAILED.append(f'/gu/{g}: {e}'); return ''
def _gu_html(X, g, src, V):
    X._HANDSET = HANDSET
    o = [f'<!--gx--><section class="gx" aria-labelledby="gx-h"><h2 id="gx-h">{esc(src["h"])}</h2><p class="meta">정리: <a href="../about">운영자</a> · 글 기준 {src["written"].replace("-", ".")} · 굵은 숫자는 데이터 기준 {X.UPD} 값으로 매일 다시 써요</p>']
    for s in src['blocks']:
        if s.get('h'): o.append(f'<h3>{esc(s["h"])}</h3>')
        for p_ in s['p']: o.append('<p>' + josa_fix(fill(p_, V, g)) + '</p>')
    o.append('</section><!--/gx-->')
    return ''.join(o)

# ------------------------------------------------------------------ 기존 손글(40쪽)에 같은 틀 일부 입히기
def enhance_hand(X, r, h):
    """content/z 원본이 없는 예전 손글: 본문은 그대로 두고 ① 목차(본문 h2로) ② 다음에 볼 구역 카드 ③ 같은 CSS만 끼운다.
    표시 주석(<!--zt-->·<!--zx-->·id="zh-css") 사이를 통째로 바꿔 몇 번 돌려도 같다 · 본문 글자는 줄이지 않는다."""
    m = re.search(r'<main>(.*)</main>', h, re.S)
    if not m: return h
    # ① h2에 id를 붙이고 목차를 만든다(계산 덩이·신고 덩이 안 제목 포함 · 이미 붙은 id는 그대로)
    hs = []; k = iter(range(1, 99))
    def addid(mm):
        tag = mm.group(0); txt = re.sub(r'<small.*?</small>|<[^>]+>', '', mm.group(1)).strip()
        if 'id="' in tag[:12]:
            hid = re.search(r'id="([^"]+)"', tag).group(1)
        else:
            hid = f'zh-s{next(k)}'; tag = tag.replace('<h2>', f'<h2 id="{hid}">', 1)
        if hid != 'zh-nx': hs.append((hid, txt))
        return tag
    body = re.sub(r'<!--zt-->.*?<!--/zt-->|<!--zx-->.*?<!--/zx-->|<!--zh-hook-->.*?<!--/zh-hook-->|<!--zcar-->.*?<!--/zcar-->', '', m.group(1), flags=re.S)
    cd = (CARDS or {}).get(r['id'])
    if cd and cd.get('h'):   # 이야기 제목을 질문형으로(content/z_cards.json · 손으로 씀)
        body = re.sub(r'<h2((?: id="[^"]*")?)>[^<]*</h2>(<div class="zstory">)', lambda mm: f'<h2{mm.group(1)}>{esc(cd["h"])}</h2>{mm.group(2)}', body, count=1)
    hk = (HOOKS or {}).get(r['id'])   # 첫 두 문장 질문(content/z_hooks.json · 손으로 씀 · 숫자는 그 페이지 본문에 있는 것만)
    if hk and '<p class="lede">' in body: body = body.replace('<p class="lede">', f'<!--zh-hook--><p class="zh-hook">{esc(hk)}</p><!--/zh-hook--><p class="lede">', 1)
    body = re.sub(r'<h2(?: id="[^"]*")?>(.*?)</h2>', addid, body, flags=re.S)
    toc = ('<!--zt--><nav class="zh-toc" aria-label="이 글의 차례"><p>이 글의 차례</p><ol>' + ''.join(f'<li><a href="#{a}">{esc(b)}</a></li>' for a, b in hs) + '</ol></nav><!--/zt-->') if len(hs) >= 3 else ''
    if toc:
        i = body.find('<!--/zk-->'); j = body.find('</p>', body.find('<p class="lede">')) if '<p class="lede">' in body else -1
        at = max(i + len('<!--/zk-->') if i >= 0 else -1, j + 4 if j >= 0 else -1)
        if at > 0: body = body[:at] + toc + body[at:]
    # ①-2 요약 카드 4장(돈·입주 시기는 매일 계산값 · 위험·맞는 사람은 content/z_cards.json) — 목차 바로 뒤
    if cd and cd.get('risk') and cd.get('fit'):
        try: car = '<!--zcar-->' + carousel(X, r, {'cards': cd}, vals(X, r)) + '<!--/zcar-->'
        except Exception as ex: FAILED.append(f'{r["id"]} 카드: {ex}'); car = ''
        if car:
            i = body.find('<!--/zt-->'); i = i + len('<!--/zt-->') if i >= 0 else body.find('<div class="kpis">')
            if i >= 0: body = body[:i] + car + body[i:]
    # ② 다음에 볼 구역(면책 문단 바로 앞, 없으면 신고 덩이 앞)
    nx = nextcards(X, r, {})
    if nx:
        nx = '<!--zx-->' + nx.replace('<!--zd-->', '').replace('<!--/zd-->', '') + '<!--/zx-->'
        at = body.find('<p class="disc">')
        if at < 0: at = body.find('<!--zr-->')
        body = body[:at] + nx + body[at:] if at >= 0 else body + nx
    h = h[:m.start(1)] + body + h[m.end(1):]
    # ③ CSS
    css = CSS.replace('<style>', '<style id="zh-css">', 1)
    if 'id="zh-css"' in h: h = re.sub(r'<style id="zh-css">.*?</style>', lambda _: css, h, count=1, flags=re.S)
    else: h = h.replace('</head>', css + '\n</head>', 1)
    return h
