#!/usr/bin/env python3
"""정적 페이지에 앱과 같은 아래 탭 4개(찾기·관심·소식·MY)를 넣는다(폰 폭에서만 보임).
build.py 끝에서 부른다. 이미 넣은 자리(<!--zp-tabs--> … <!--/zp-tabs-->)는 통째로 바꾸므로 몇 번 돌려도 결과가 같다.
지금 탭: 구역(/z)·구(/gu)·404 = 찾기, 나머지(가이드·리포트·약관·FAQ …) = MY."""
import os, re
from brand import BRAND, TAGLINE, ICON_LINKS, wordmark_svg, WORDMARK_CSS   # 브랜드 v7 워드마크·아이콘(기능 트랙과 같은 tools/brand.py · public/icons/)
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
       'footer.f p:first-child{display:flex;flex-wrap:wrap;gap:2px 4px;line-height:1.2;font-size:0}footer.f p:first-child a{display:inline-flex;align-items:center;justify-content:center;min-width:40px;min-height:40px;padding:0 6px;border-radius:8px;font-size:13px}'
       '@media (display-mode:standalone),(display-mode:fullscreen),(display-mode:minimal-ui){footer.f{display:none!important}}'
       # 29차: 브라우저에서도 누를 때 파란 하이라이트 없음(앱과 같게 · 대신 누른 줄은 옅은 바탕) · 머리 로고 링크 높이 40px · 리포트 차례 현재 칸 · 정정 상자 · 오프라인 알약
       'html,a,button,summary,label{-webkit-tap-highlight-color:transparent}.zl:active,.gl a:active,.rp-toc a:active{background:var(--surface-2,#f2f4f6)}'
       '.top .logo{min-height:40px}'
       '.rp-toc a[aria-current="true"]{background:var(--brand,#1f3a87)!important;color:var(--on-brand,#fff)!important;border-color:var(--brand,#1f3a87)!important}'
       '.rp-fix{margin:18px 0;padding:14px 16px 12px;border:1px solid var(--border,#e5e8eb);border-left:4px solid var(--warn-ink,#8a4b00);border-radius:12px;background:var(--warn-soft,#fff6e8)}'
       '.rp-fix h2{margin:0 0 6px;font-size:17px}.rp-fix ul{margin:0;padding-left:18px}.rp-fix li{margin:6px 0;line-height:1.65}'
       '.zp-off{position:fixed;left:50%;top:calc(8px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:60;padding:6px 12px;border-radius:999px;background:#191f28;color:#fff;font:600 13px/1.2 inherit;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.2)}.zp-off[hidden]{display:none}')


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


# 29차: 리포트 차례(.rp-toc) 지금 읽는 칸 표시(aria-current) · 끊기면 '오프라인 · M.DD 기준' 알약(앱과 같은 말)
SPYJS = ('<script>(function(){var t=document.querySelector(".rp-toc");if(!t)return;var A=[].slice.call(t.querySelectorAll(\'a[href^="#"]\')),S=A.map(function(a){return document.getElementById(a.getAttribute("href").slice(1))}),cur=-1,q=0;'
         'function f(){q=0;var y=(t.getBoundingClientRect().bottom||0)+24,k=-1;for(var i=0;i<S.length;i++){if(S[i]&&S[i].getBoundingClientRect().top<=y)k=i}if(k===cur)return;cur=k;A.forEach(function(a,i){if(i===k)a.setAttribute("aria-current","true");else a.removeAttribute("aria-current")});'
         'if(k>=0){var a=A[k];t.scrollTo({left:Math.max(0,a.offsetLeft-16),behavior:"smooth"})}}'
         'addEventListener("scroll",function(){if(!q){q=1;requestAnimationFrame(f)}},{passive:true});f()})()</script>')
# 29차: 홈 '찾기' 첫 화면의 읽을거리 줄(10월 리포트 · 재개발 가이드)에서 온 길이면 아래 탭도 '찾기'에 그대로(누른 곳과 도착한 탭 강조가 엇갈리던 것) · MY에서 온 길은 MY
TABJS = ('<script>(function(){try{var f=sessionStorage.getItem("zp.from");sessionStorage.removeItem("zp.from");if(f!=="find")return;'
         'var t=document.querySelector(".zp-tabs");if(!t||!t.querySelector(\'a[aria-current="page"][href="/#my"]\'))return;[].forEach.call(t.querySelectorAll("a"),function(a){if(a.getAttribute("href")==="/")a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")})}catch(e){}})()</script>')
OFFJS = ('<script>(function(){var d=' + json.dumps(UPD) + ',p;function s(){var off=navigator.onLine===false;if(off&&!p){p=document.createElement("div");p.className="zp-off";p.setAttribute("role","status");p.textContent="오프라인"+(d?" · "+d+" 기준":"");document.body.appendChild(p)}if(p)p.hidden=!off}'
         'addEventListener("offline",s);addEventListener("online",s);s()})()</script>')


# 설치 앱(홈 화면 앱·안드로이드 TWA) 알아채기 — 첫 화면(src/shell.html 머리 스크립트)과 같은 규칙 · 같은 sessionStorage 키(zp.tapp)
# ?src=app 주소만으로는 켜지 않는다(브라우저로 공유될 수 있는 주소). 알아채면 html.is-tapp
TDET = ('function(){var H=document.documentElement,a=false,m=function(q){try{return matchMedia(q).matches}catch(e){return false}};'
        'a=m("(display-mode: standalone)")||m("(display-mode: fullscreen)")||m("(display-mode: minimal-ui)")||navigator.standalone===true||/^android-app:\\/\\//.test(document.referrer||"");'
        'try{if(a)sessionStorage.setItem("zp.tapp","1");else a=sessionStorage.getItem("zp.tapp")==="1"}catch(e){}if(a)H.classList.add("is-tapp");return a}')
# (광고 로더는 넣지 않는다 — 애드센스 심사는 정적 페이지 head의 리터럴 adsbygoogle 태그로 확인 · 로더는 after-adsense 브랜치)
# 설치 앱에서만: 아래 탭을 앱과 같은 5개(홈·지도·관심·소식·MY)로 — 브라우저 화면은 그대로 4개
TAPPJS = ('<script>(function(){if(!(' + TDET + ')())return;var t=document.querySelector(".zp-tabs");if(!t||t.dataset.t5)return;t.dataset.t5="1";'
          'var h=t.querySelector(\'a[href="/"]\');if(!h)return;h.querySelector("span").textContent="홈";h.querySelector("path").setAttribute("d","M4 10.6 12 4l8 6.6V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z");'
          'var m=h.cloneNode(true);m.removeAttribute("aria-current");m.setAttribute("href","/#map");m.querySelector("span").textContent="지도";m.querySelector("path").setAttribute("d","M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14");h.after(m)})()</script>')
TCSS = '@media (max-width:980px){html.is-tapp .zp-tabs{grid-template-columns:repeat(5,1fr)}}'


def block(cur):
    ac = ' aria-current="page"'
    a = ''.join(f'<a href="{u}"{ac if k == cur else ""}>{SV(d)}<span>{t}</span>{"<i class=\"nb-dot\" aria-hidden=\"true\" hidden>N</i>" if k == "news" else ""}</a>' for k, u, t, d in TABS)
    return f'<!--zp-tabs--><style>{CSS}{BCSS}{TCSS}{WORDMARK_CSS}</style><nav class="zp-tabs" aria-label="주요 메뉴">{a}</nav>{NJS}{FONTJS}{SPYJS}{OFFJS}{TABJS}{TAPPJS}<!--/zp-tabs-->'


RX = re.compile(r'<!--zp-tabs-->.*?<!--/zp-tabs-->', re.S)
HDR = re.compile(r'<header class="top">.*?</header>', re.S)
NAV = re.compile(r'<nav aria-label="사이트 메뉴">.*?</nav>', re.S)
PH = '구역·동·지번·역 검색'   # 앱 검색칸과 같은 글
FORM = f'<form class="tsr" action="/" method="get" role="search"><label class="sr-only" for="tq">구역 검색</label><input id="tq" name="q" type="search" placeholder="{PH}" autocomplete="off" enterkeyhint="search" maxlength="40"></form>'


LOGO_SVG = '<svg class="logo-i" width="28" height="28" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 61C25.5 52.5 12.5 40.5 12.5 24.5a19.5 19.5 0 0 1 39 0C51.5 40.5 38.5 52.5 32 61z" fill="#1F3A87" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M32 12.6 44.4 23.7h-3.9V35.2H23.5V23.7h-3.9z" fill="#fff" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><rect x="28.6" y="26.6" width="6.8" height="8.6" rx="1.2" fill="#1F3A87"/></svg>'


def app_header(h):
    """정적 페이지 머리 = 앱 머리: 웹 메뉴 줄(계산기·월간 리포트·구역별 페이지·가이드)을 빼고 로고 + 검색 알약만."""
    m = HDR.search(h)
    if not m: return h
    hd = NAV.sub('', m.group(0))
    if 'class="tsr"' not in hd: hd = hd.replace('</div></header>', FORM + '</div></header>', 1)
    hd = re.sub(r'<span class="hdr-date"[^>]*>.*?</span><a class="hdr-bell".*?</a>', '', hd, flags=re.S)
    hd = hd.replace('</div></header>', BELL + '</div></header>', 1)
    # 28차: 로고를 그림 파일 대신 글 속 SVG로(첫 프레임부터 보이게 · 그림 요청을 기다리지 않음)
    # 리뉴얼 브랜드 v7: 로고 = 브랜드 워드마크(글 속 SVG · 밝게/어둡게 CSS 색) + 작은 글('서울 재개발 지도', 폰에서는 숨김)
    hd = re.sub(r'<a class="logo"[^>]*>.*?</a>', lambda m: f'<a class="logo" href="/" aria-label="{BRAND} 처음으로">{wordmark_svg()}<small class="logo-s">{TAGLINE}</small></a>', hd, count=1, flags=re.S)
    hd = re.sub(r'(<input id="tq"[^>]*placeholder=")[^"]*(")', lambda x: x.group(1) + PH + x.group(2), hd)
    # 26차: 400px 아래에선 자리표시가 잘려 '구역·동·:'로 보이던 것 → '검색'
    hd = re.sub(r'<script>(?:innerWidth<400|matchMedia\("\(max-width:399)[^<]*</script>', '', hd)
    hd = hd.replace('</form>', '</form><script>matchMedia("(max-width:399.98px)").matches&&(document.getElementById("tq").placeholder="검색")</script>', 1)
    return h[:m.start()] + hd + h[m.end():]


# 24차: 모든 정적 페이지 푸터 링크 한 줄을 같은 목록·같은 순서로(첫 화면 .f-nav와 같은 9곳 + 구역별·기간·블로그) — 절대 경로라 어느 폴더에서든 같다
FOOT_LINKS = [('/about', '소개'), ('/method', '계산 방법'), ('/faq', '자주 묻는 질문'), ('/contact', '문의'), ('/terms', '이용약관'), ('/privacy', '<b>개인정보처리방침</b>'),
              ('/gu/', '구별 페이지'), ('/guide/', '가이드'), ('/report/', '월간 리포트'), ('/z/', '구역별 페이지'), ('/years', '몇 년 걸리나'),
              ('/glossary', '용어집'), ('/corrections', '오류 수정 기록')]
FOOT_P = ' · '.join(f'<a href="{u}">{t}</a>' for u, t in FOOT_LINKS) + ' · <a href="https://blog.naver.com/always_questions" rel="noopener">블로그</a>'
RF1 = re.compile(r'(<footer class="f"><p>).*?(</p>)', re.S)
RF2 = re.compile(r'(<footer id="contact">.*?<p class="fl">).*?(</p>)', re.S)


# 리뉴얼 브랜드 v7: 파비콘·홈 화면 아이콘 = public/icons/(기능 트랙과 같은 ICON_LINKS) — 예전 /icon-small.svg·/icon-180.png 링크를 지우고 </head> 앞에 한 번
RICON = re.compile(r'<link rel="(?:icon|apple-touch-icon)"[^>]*>')


def icons(h):
    i = h.find('</head>')
    if i < 0: return h
    hd = RICON.sub('', h[:i])
    return hd + ICON_LINKS + h[i:]


def foot_links(h):
    h = RF1.sub(lambda m: m.group(1) + FOOT_P + m.group(2), h, count=1)
    h = RF2.sub(lambda m: m.group(1) + FOOT_P + m.group(2), h, count=1)
    return foot_disc(h)


# 리뉴얼 A3: 모든 정적 페이지 푸터에 '정부·공공기관과 무관한 비공식 서비스' 한 줄(링크 줄 바로 뒤 · 링크와 붙지 않게 글 한 줄로)
# 첫 화면(src/shell.html .site-foot .f-meta)과 같은 문장 · 몇 번 돌려도 같다(있던 줄은 지우고 다시 넣음)
# (서비스 이름이 바뀔 수 있어 이름·조사 없이 '이 사이트'로 쓴다)
DISC_T = '이 사이트는 서울시·국토교통부 등 정부·공공기관과 무관한 비공식 정보 서비스예요. 공개 자료로 계산한 추정치를 보여 주며 투자 권유가 아니에요.'
DISC_P = f'<p class="f-d">{DISC_T}</p>'
RFD = re.compile(r'<p class="f-d">.*?</p>', re.S)


DISC_S = '<p class="f-d">이 사이트는 서울시·국토교통부 등 정부·공공기관과 무관한 비공식 정보 서비스예요. 공개 자료로 계산한 추정치를 보여 줘요.</p>'


def foot_disc(h):
    h = RFD.sub('', h)
    m = re.search(r'<footer class="f"><p>.*?</p>', h, re.S) or re.search(r'<footer id="contact">.*?<p class="fl">.*?</p>', h, re.S)
    # 통합: 면책('투자 권유 아님')은 화면마다 한 번(term.disclaimer) — 본문에 이미 있으면 푸터 줄에서는 뺀다
    return h[:m.end()] + (DISC_S if '투자 권유' in re.sub(r'<script.*?</script>', '', h, flags=re.S) else DISC_P) + h[m.end():] if m else h


# 리뉴얼 A3: 사람이 대조한 글(손으로 쓴 /z 40곳 · 가이드)에 '자동 계산 / 사람 대조' 범례 한 줄 — 글쓴이 줄(byline) 바로 뒤
LEG_RX = re.compile(r'<!--zp-legend-->.*?<!--/zp-legend-->', re.S)
LEG_Z = ('<!--zp-legend--><p class="zp-legend"><span class="lg lg-a">자동 계산</span>맨 위 숫자 상자·계산 표·사업 개요는 공개 자료로 매일 다시 계산해요. '
         '<span class="lg lg-h">사람 대조</span>이야기와 주요 일정은 기사·고시 원문과 맞춰 본 내용이에요. <a href="/about#principles">편집 원칙</a></p><!--/zp-legend-->')
LEG_G = ('<!--zp-legend--><p class="zp-legend"><span class="lg lg-a">자동 계산</span>표·막대의 숫자는 글 기준일에 공개 자료로 계산한 값이에요. '
         '<span class="lg lg-h">사람 대조</span>해설과 법 조항은 원문과 맞춰 봤어요. <a href="/about#principles">편집 원칙</a> · 낯선 말은 <a href="/glossary">용어집</a>에 있어요.</p><!--/zp-legend-->')


def legend(h, rel):
    h = LEG_RX.sub('', h)
    hand_z = rel.startswith('z/') and 'class="zstory"' in h
    guide = rel.startswith('guide/') and rel != 'guide/index.html'
    if not (hand_z or guide): return h
    m = re.search(r'<p class="byline">.*?</p>', h, re.S)
    if not m: return h
    bl = m.group(0)   # 글쓴이 줄은 op_line이 '<이름> 편집'으로 맞춘다
    return h[:m.start()] + bl + (LEG_Z if hand_z else LEG_G) + h[m.end():]


# 통합(2026-10-27 오너 결정): 개인 운영자 소개 없이 — 손글·가이드·/gu 해설·리포트의 글쓴이 줄 = '<이름> 편집'(brand.EDITOR) → /about#principles(편집 원칙)
from brand import EDITOR as _ED
OPL_RX = re.compile(r'(<p class="(?:byline|meta)">(?:정리|글·계산|글·화면|글·정리): )(?:(?!</p>|<span class="op-f">| · <time| · 기사| · 글 | · 새로| · 법 | · 발행).)*?(?:운영자|편집)(?:(?!</p>|<span class="op-f">| · <time| · 기사| · 글 | · 새로| · 법 | · 발행).)*?(?:<span class="op-f">[^<]*</span>)?(?=(?: · )|</p>)', re.S)
def op_line(h, rel):
    if rel in ('index.html', 'admin.html', 'about.html'): return h   # about은 trust.py가 맞춘다
    h = OPL_RX.sub(lambda m: f'{m.group(1)}<a href="/about#principles">{_ED}</a>', h)
    h = re.sub(r'<p class="rp-sig">— [^<]*?운영자</p>', f'<p class="rp-sig">— {_ED}</p>', h)
    # JSON-LD 글쓴이도 사람 대신 브랜드 편집(Organization)
    return re.sub(r'"author": \{"@type": "Person", "name": "[^"]*운영자"(?:, "url": "[^"]*")?\}', lambda m: '"author": {"@type": "Organization", "name": "' + _ED + '", "url": "https://jaegaebal.alwaysquestions.kr/about#principles"}', h)


# 리뉴얼 F10: 가이드 끝 '함께 보면 좋은 질문'에 용어집 한 줄(없을 때만)
def glossary_link(h, rel):
    if not rel.startswith('guide/') or 'href="/glossary"' in re.sub(r'<!--zp-legend-->.*?<!--/zp-legend-->', '', h, flags=re.S): return h
    return re.sub(r'(<h2>함께 보면 좋은 질문</h2><ul>)', r'\1<li><a href="/glossary">재개발 용어집: 권리산정기준일부터 비례율까지</a></li>', h, count=1)


# 리뉴얼 A4: 정적 페이지 광고 자리(승인 전에는 비어 있고 hidden · 크기 0) — 애드센스 리터럴 태그가 있는 페이지에만.
# 규칙: 본문 문단(<p>) 뒤 + 다음 소제목(<h2>/<h3>) 앞에만 · 글이 35% 넘게 지난 곳 1칸(mid), 70% 넘게 지난 곳 1칸(bottom)
# · 버튼(.cta)·링크 목록·'함께 보면'·출처·면책(disc)·푸터·아래 탭 옆에는 두지 않는다. 자리 표는 renew/ad_placements.md
AD_RX = re.compile(r'<!--zp-ad:\w+-->.*?<!--/zp-ad-->', re.S)
AD_TAG = 'pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='
AD_NO_H = re.compile(r'함께 보면|다음에 읽을|관련|참고|출처|원문|문의|지금까지 낸|용어 찾기')


def ad_slot(k, kind):
    return f'<!--zp-ad:{k}--><aside class="ad-slot" data-slot="{kind}-{k}" aria-label="광고" hidden></aside><!--/zp-ad-->'


def ad_slots(h, rel):
    h = AD_RX.sub('', h)
    if AD_TAG not in h[:h.find('</head>')]: return h
    a, b = h.find('<main'), h.find('</main>')
    if a < 0 or b < 0: return h
    kind = rel.split('/')[0] if '/' in rel else rel[:-5]
    body = h[a:b]
    # 손으로 지정한 자리(<!--zp-ad-at:mid|bottom-->)가 있으면 그 자리만 쓴다(규칙으로 자리를 못 찾는 리포트 7~9월호·howto·용어집)
    if '<!--zp-ad-at:' in body:
        body = re.sub(r'<!--zp-ad-at:(\w+)-->', lambda m: m.group(0) + ad_slot(m.group(1), kind), body)
        return h[:a] + body + h[b:]
    cand = []
    for m in re.finditer(r'<p(?: class="(?:lede)")?>(?:(?!</p>).)*</p>\s*(?:</div>\s*)?(?:<!--zn-->.*?<!--/zn-->)?\s*(?=<h[23][ >])', body, re.S):
        nh = re.match(r'<h[23][^>]*>(.*?)</h[23]>', body[m.end():].lstrip(), re.S)
        if not nh or AD_NO_H.search(re.sub(r'<[^>]+>', '', nh.group(1))): continue
        if len(re.sub(r'<[^>]+>', '', m.group(0))) < 60: continue      # 한 줄짜리 안내 문장 뒤는 건너뜀(본문 문단 뒤에만)
        cand.append(m.end())
    L = len(body); out, last = [], -1
    for k, frac in (('mid', .35), ('bottom', .7)):
        p = next((x for x in cand if x >= L * frac and x > last), None)
        if p is None: continue
        out.append((p, k)); last = p
    for p, k in reversed(out): body = body[:p] + ad_slot(k, kind) + body[p:]
    return h[:a] + body + h[b:]


# pre-adsense 3: 리포트 링크 — '지도 열기'는 지도 화면(#map)으로 · 정적 /z에서 '지금 필요한 돈'이 계산 보류인 구역으로 가는 '내 돈으로 계산'은 '구역 보기'(계산할 금액이 없는 곳)
_ZHOLD = {}
def _z_hold(i):
    if i not in _ZHOLD:
        fp = os.path.join(PUB, 'z', i + '.html'); v = False
        if os.path.exists(fp):
            t = open(fp, encoding='utf-8').read(); t = t[t.find('<body'):]
            t = re.sub(r'(\s*\|\s*)+', ' | ', re.sub(r'<[^>]+>', ' | ', t))
            m = re.search(r' \| 지금 필요한 돈 \| ([^|]+?) \|', t); v = bool(m and m.group(1).strip() == '계산 보류')
        _ZHOLD[i] = v
    return _ZHOLD[i]


def report_links(h):
    h = re.sub(r'(<a class="btn primary" href="/\?cash=[^"#]*?from=report)(">[^<]*지도 열기</a>)', r'\1#map\2', h)
    return re.sub(r'<a href="(\.\./\?from=report#([\w-]+))">(내 돈으로 계산|구역 보기)</a>', lambda m: f'<a href="{m.group(1)}">{"구역 보기" if _z_hold(m.group(2)) else "내 돈으로 계산"}</a>', h)


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
            # 28차: 읽을거리·안내 페이지(리포트·가이드·기간·소식 구독·FAQ·문의·소개·약관…)는 모두 MY(앱에서 이 링크들이 모인 곳) · 지도에서 이어지는 구역·구 페이지와 404만 '찾기'
            cur = 'home' if rel.startswith(('z/', 'gu/', 'api/')) or rel == '404.html' else 'my'
            b = block(cur)
            h1 = RX.sub(lambda m: b, h, count=1) if RX.search(h) else h.replace('</body>', b + '\n</body>', 1)
            h1 = app_header(h1)
            h1 = icons(h1)
            h1 = foot_links(h1)
            h1 = legend(h1, rel)
            h1 = op_line(h1, rel)
            h1 = glossary_link(h1, rel)
            h1 = ad_slots(h1, rel)
            if rel.startswith('report/'): h1 = report_links(h1)
            if re.match(r'report/\d{4}-\d{2}\.html$', rel):   # 리뉴얼 사이클 2: 이미 낸 호도 질문형 소제목 + 도입부 훅(tools/report_copy.py)
                import report_copy
                h1 = report_copy.add_hook(report_copy.retitle(h1), int(rel[12:14]))
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
