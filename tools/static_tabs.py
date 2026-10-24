#!/usr/bin/env python3
"""정적 페이지에 앱과 같은 아래 탭 4개(찾기·관심·소식·MY)를 넣는다(폰 폭에서만 보임).
build.py 끝에서 부른다. 이미 넣은 자리(<!--zp-tabs--> … <!--/zp-tabs-->)는 통째로 바꾸므로 몇 번 돌려도 결과가 같다.
지금 탭: 구역(/z)·구(/gu)·404 = 찾기, 나머지(가이드·리포트·약관·FAQ …) = MY."""
import os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(R, 'public')
SV = lambda d: f'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{d}"/></svg>'
TABS = [
    ('home', '/', '찾기', 'M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14'),
    ('fav', '/#favTop', '관심', 'M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.4 7.2 4.4c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z'),
    ('news', '/#news', '소식', 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4zM10 20.5a2.2 2.2 0 0 0 4 0'),
    ('my', '/#my', 'MY', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0'),
]
CSS = ('.zp-tabs{display:none}'
       '@media (max-width:980px){body{padding-bottom:calc(64px + env(safe-area-inset-bottom,0px))!important}'
       '.zp-tabs{position:fixed;left:0;right:0;bottom:0;z-index:50;display:grid;grid-template-columns:repeat(4,1fr);'
       'padding:6px max(8px,env(safe-area-inset-left,0px)) calc(6px + env(safe-area-inset-bottom,0px)) max(8px,env(safe-area-inset-right,0px));'
       'background:var(--surface,#fff);border-top:1px solid var(--border,#e5e8eb);font-family:inherit;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}'
       '.zp-tabs a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:50px;color:var(--text-2,#4e5968);font:600 11.5px/1.2 inherit;text-decoration:none!important}'
       '.zp-tabs a[aria-current="page"]{color:var(--brand,#1f3a87)}'
       '.zp-tabs a:focus-visible{outline:2px solid var(--brand,#1f3a87);outline-offset:-4px;border-radius:12px}}'
       '@media (max-width:980px) and (prefers-color-scheme:dark){:root:not([data-theme="light"]) .zp-tabs{background:var(--surface,#15181d);border-top-color:var(--border,#2a3038)}'
       ':root:not([data-theme="light"]) .zp-tabs a{color:var(--text-2,#b4bcc6)}:root:not([data-theme="light"]) .zp-tabs a[aria-current="page"]{color:var(--brand,#93ade6)}}'
       '@media (max-width:980px){.logo .logo-s{display:none!important}}'
       '@media print{.zp-tabs{display:none!important}}'
       # 앱 머리(로고 + 검색 알약)만 · 웹 메뉴 줄 없음 · 설치 앱(standalone)에서는 웹 푸터 숨김 · 메뉴·푸터 링크는 밑줄 없는 글자 버튼
       '.top .in{flex-wrap:nowrap!important}.top .tsr{order:2;flex:1 1 auto!important;max-width:480px!important;min-width:0!important;margin-left:auto}'
       '.top .tsr input{height:40px!important;border:0!important;background-color:var(--surface-2,#f2f4f6)!important;font-size:15px!important}'
       'footer.f a{color:var(--text-2,#4e5968);text-decoration:none!important;font-weight:600}footer.f a:hover{color:var(--brand,#1f3a87)}'
       # 링크 사이 '·' 글자는 숨긴다(줄이 바뀌면 줄 머리에 '·'가 오던 것) — 링크마다 여백 있는 글자 버튼이라 구분은 간격으로
       'footer.f p:first-child{display:flex;flex-wrap:wrap;gap:2px 4px;line-height:1.2;font-size:0}footer.f p:first-child a{display:inline-flex;align-items:center;min-height:36px;padding:0 6px;border-radius:8px;font-size:13px}'
       '@media (display-mode:standalone),(display-mode:fullscreen),(display-mode:minimal-ui){footer.f{display:none!important}}')


# 21차: 머리 오른쪽 종(소식) + 'N' 점 + '10.19 갱신' — 앱(63_newb.js)과 같은 키(zp.seen.auc·zp.seen.ntc)·같은 날짜(가장 늦은 경매·고시 날)
import json
def _newd():
    o = {}
    try:
        a = json.load(open(os.path.join(PUB, 'data', 'auction.json'), encoding='utf-8'))
        fs = [x.get('fs') or '' for v in (a.get('byZone') or {}).values() for x in v if x.get('fs')]
        if fs: o['auc'] = max(fs)
    except Exception: pass
    try:
        n = json.load(open(os.path.join(PUB, 'data', 'notice.json'), encoding='utf-8'))
        ds = [i[0] for i in n.get('items') or [] if i and i[0]]
        if ds: o['ntc'] = max(ds)
    except Exception: pass
    return o
def _upd():
    try:
        D = json.load(open(os.path.join(R, 'pipeline', 'data.enriched.json'), encoding='utf-8'))
        m = re.search(r'(\d{4})-?(\d\d)-?(\d\d)', D.get('upd') or D.get('asOf') or '')
        return (f'{int(m.group(2))}.{m.group(3)}', f'{m.group(1)}.{m.group(2)}.{m.group(3)}') if m else ('', '')
    except Exception: return ('', '')
NEWD, (UPD, UPDF) = _newd(), _upd()
BELL = ('<span class="hdr-date"' + (f' data-asof="{UPDF}"' if UPDF else '') + '>' + (UPD + ' 갱신' if UPD else '') + '</span>'
        '<a class="hdr-bell" href="/#news" aria-label="소식"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4zM10 20.5a2.2 2.2 0 0 0 4 0"/></svg><i class="nb-dot" aria-hidden="true" hidden>N</i></a>')
BCSS = ('.top .in{align-items:center}.hdr-date{order:3;flex:none;margin-left:10px;font-weight:500;font-size:12px;line-height:1;color:#5c6573;white-space:nowrap}'
        '.hdr-bell{order:4;position:relative;flex:none;margin-left:2px;display:inline-grid;place-items:center;width:44px;height:44px;margin-right:-8px;border-radius:12px;color:var(--brand,#1f3a87)}'
        '.hdr-bell:focus-visible{outline:2px solid var(--brand,#1f3a87);outline-offset:-4px}'
        '.nb-dot{position:absolute;top:6px;right:5px;display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:#e5484d;color:#fff;font-weight:800;font-size:10px;line-height:1;font-style:normal;box-shadow:0 0 0 2px var(--surface,#fff)}.nb-dot[hidden]{display:none}'
        '.zp-tabs a{position:relative}.zp-tabs .nb-dot{top:2px;right:auto;left:calc(50% + 6px)}'
        '@media (max-width:359px){.hdr-date{display:none}}@media (max-width:980px){.hdr-bell{display:none!important}.hdr-date{margin-right:2px}}'
        '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .hdr-date{color:#8b93a1}:root:not([data-theme="light"]) .hdr-bell{color:#9fb3ff}}'
        ':root[data-theme="dark"] .hdr-date{color:#8b93a1}:root[data-theme="dark"] .hdr-bell{color:#9fb3ff}')
NJS = ('<script>(function(){var D=' + json.dumps(NEWD) + ',g=function(k){try{return localStorage.getItem("zp.seen."+k)||""}catch(e){return""}},'
       'o=[];try{o=JSON.parse(localStorage.getItem("zp-alert-off")||"[]")||[]}catch(e){}var M={auc:"auction",ntc:"notice"},u=["auc","ntc"].some(function(k){return D[k]&&D[k]>g(k)&&o.indexOf(M[k])<0});if(!u)return;'
       '[].forEach.call(document.querySelectorAll(".hdr-bell .nb-dot,.zp-tabs .nb-dot"),function(e){e.hidden=false});'
       'var b=document.querySelector(".hdr-bell");if(b)b.setAttribute("aria-label","소식, 새 소식 있음")})()</script>')


# 27차 성능(/z TBT): 웹 글꼴 조각(유니코드 범위별 woff2 20여 개)이 하나 올 때마다 긴 페이지 전체를 다시 배치하던 것 → 대체 글꼴(같은 크기로 맞춘 Pretendard Fallback)로 그리다가
# 이 페이지 글자에 필요한 조각이 다 오면 html.fo 한 번으로 바꾼다(앱 첫 화면 boot.js와 같은 방식 · pages.css html:not(.fo))
FONTJS = ('<script>(function(){var H=document.documentElement;if(H.classList.contains("fo"))return;var t0=performance.now(),go=function(){H.classList.add("fo")};'
          'try{if(!document.fonts||!document.fonts.load)return go();var t=(document.body.textContent||"").replace(/\\s+/g," ").slice(0,20000);'
          # font-display: optional 처럼 — 조각이 금방(캐시) 오면 바로 바꾸고, 늦게 오면 이 화면은 대체 글꼴 그대로(받은 조각은 캐시돼 다음 페이지부터 바로)
          'Promise.all(["400","700"].map(function(w){return document.fonts.load(w+" 15px \\"Pretendard Variable\\"",t)})).then(function(){if(performance.now()-t0<250)go()},function(){})}catch(e){go()}})()</script>')


def block(cur):
    ac = ' aria-current="page"'
    a = ''.join(f'<a href="{u}"{ac if k == cur else ""}>{SV(d)}<span>{t}</span>{"<i class=\"nb-dot\" aria-hidden=\"true\" hidden>N</i>" if k == "news" else ""}</a>' for k, u, t, d in TABS)
    return f'<!--zp-tabs--><style>{CSS}{BCSS}</style><nav class="zp-tabs" aria-label="주요 메뉴">{a}</nav>{NJS}{FONTJS}<!--/zp-tabs-->'


RX = re.compile(r'<!--zp-tabs-->.*?<!--/zp-tabs-->', re.S)
HDR = re.compile(r'<header class="top">.*?</header>', re.S)
NAV = re.compile(r'<nav aria-label="사이트 메뉴">.*?</nav>', re.S)
PH = '구역·동·지번·역 검색'   # 앱 검색칸과 같은 글
FORM = f'<form class="tsr" action="/" method="get" role="search"><label class="sr-only" for="tq">구역 검색</label><input id="tq" name="q" type="search" placeholder="{PH}" autocomplete="off" enterkeyhint="search" maxlength="40"></form>'


def app_header(h):
    """정적 페이지 머리 = 앱 머리: 웹 메뉴 줄(계산기·월간 리포트·구역별 페이지·가이드)을 빼고 로고 + 검색 알약만."""
    m = HDR.search(h)
    if not m: return h
    hd = NAV.sub('', m.group(0))
    if 'class="tsr"' not in hd: hd = hd.replace('</div></header>', FORM + '</div></header>', 1)
    hd = re.sub(r'<span class="hdr-date"[^>]*>.*?</span><a class="hdr-bell".*?</a>', '', hd, flags=re.S)
    hd = hd.replace('</div></header>', BELL + '</div></header>', 1)
    hd = re.sub(r'(<input id="tq"[^>]*placeholder=")[^"]*(")', lambda x: x.group(1) + PH + x.group(2), hd)
    # 26차: 400px 아래에선 자리표시가 잘려 '구역·동·:'로 보이던 것 → '검색'
    hd = re.sub(r'<script>(?:innerWidth<400|matchMedia\("\(max-width:399)[^<]*</script>', '', hd)
    hd = hd.replace('</form>', '</form><script>matchMedia("(max-width:399.98px)").matches&&(document.getElementById("tq").placeholder="검색")</script>', 1)
    return h[:m.start()] + hd + h[m.end():]


# 24차: 모든 정적 페이지 푸터 링크 한 줄을 같은 목록·같은 순서로(첫 화면 .f-nav와 같은 9곳 + 구역별·기간·블로그) — 절대 경로라 어느 폴더에서든 같다
FOOT_LINKS = [('/about', '소개'), ('/method', '계산 방법'), ('/faq', '자주 묻는 질문'), ('/contact', '문의'), ('/terms', '이용약관'), ('/privacy', '<b>개인정보처리방침</b>'),
              ('/gu/', '구별 페이지'), ('/guide/', '가이드'), ('/report/', '월간 리포트'), ('/z/', '구역별 페이지'), ('/years', '몇 년 걸리나')]
FOOT_P = ' · '.join(f'<a href="{u}">{t}</a>' for u, t in FOOT_LINKS) + ' · <a href="https://blog.naver.com/always_questions" rel="noopener">블로그</a>'
RF1 = re.compile(r'(<footer class="f"><p>).*?(</p>)', re.S)
RF2 = re.compile(r'(<footer id="contact">.*?<p class="fl">).*?(</p>)', re.S)


def foot_links(h):
    h = RF1.sub(lambda m: m.group(1) + FOOT_P + m.group(2), h, count=1)
    return RF2.sub(lambda m: m.group(1) + FOOT_P + m.group(2), h, count=1)


def main():
    n = 0
    for root, _, files in os.walk(PUB):
        for f in files:
            if not f.endswith('.html'): continue
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, PUB).replace(os.sep, '/')
            if rel == 'index.html' or rel == 'admin.html' or rel.startswith('b/'): continue   # 운영자 화면(admin.html)은 사이트 탭 없이
            h = open(fp, encoding='utf-8').read()
            if '</body>' not in h: continue
            # 26차: 리포트·가이드·기간 글은 '찾기'(예전엔 MY가 켜져 있었다 — 읽을거리 입구가 찾기 첫 화면) · 약관·소개·FAQ·문의 = MY
            cur = 'home' if rel.startswith(('z/', 'gu/', 'report/', 'guide/', 'feed/', 'api/')) or rel in ('404.html', 'years.html') else 'my'
            b = block(cur)
            h1 = RX.sub(lambda m: b, h, count=1) if RX.search(h) else h.replace('</body>', b + '\n</body>', 1)
            h1 = app_header(h1)
            h1 = foot_links(h1)
            # 26차: 글꼴 CSS를 늦게 붙여 봤지만(/z TBT) 나아지지 않아 원래대로(첫 그림부터 같은 글꼴 · CLS 0)
            h1 = re.sub(r'<link rel="stylesheet" href="(https://cdn\.jsdelivr\.net/gh/orioncactus/pretendard[^"]+)" media="print" onload="this\.media=\'all\'" crossorigin>', lambda m: f'<link rel="stylesheet" href="{m.group(1)}" crossorigin>', h1)
            # 22차 접근성: 옆으로 밀리는 표 상자(.tw)는 키보드로도 밀 수 있게(초점 + 이름) — axe scrollable-region-focusable
            k = iter(range(1, 999))
            h1 = re.sub(r'<div class="(tw(?: [^"]*)?)"(?: tabindex="0" role="region" aria-label="[^"]*")?>', lambda m: f'<div class="{m.group(1)}" tabindex="0" role="region" aria-label="표 {next(k)} · 옆으로 밀어 보기">', h1)
            if h1 != h:
                open(fp, 'w', encoding='utf-8').write(h1); n += 1
    print('static tabs:', n, 'pages updated')


if __name__ == '__main__':
    main()
