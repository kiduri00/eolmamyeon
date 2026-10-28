"""사이클 3: 계산 조건(금액·연소득 등)은 주소의 # 뒤에만 — 서버(Cloudflare) 요청에 실리지 않게.
정적 페이지의 앱 링크 href="/?cash=2&mode=jeonse#map" → href="/#map?cash=2&mode=jeonse" (조건이 아닌 from 등은 ? 그대로).
앱 첫 스크립트(src/shell.html ZP_CQ)가 # 뒤 조건을 읽고 주소에서 지운다. 옛 ?cash= 링크도 앱이 읽은 즉시 같은 꼴로 바꾼다.
광고 태그·메타는 건드리지 않는다(href 안의 앱 링크만)."""
import re
CK = ('cash', 'mode', 'fund', 'homes', 'first', 'unit', 'inc', 'income', 'basis', 'kind', 'jr', 'sv', 'ar', 'ag', 'at')
_RE = re.compile(r'href="((?:\.\./|/))\?([^"#]*)(#[^"]*)?"')
def _fix(m):
    base, qs, frag = m.group(1), m.group(2), m.group(3) or ''
    parts = [p for p in qs.split('&amp;' if '&amp;' in qs else '&') if p]
    sep = '&amp;' if '&amp;' in qs else '&'
    cond = [p for p in parts if p.split('=', 1)[0] in CK]
    if not cond: return m.group(0)
    rest = [p for p in parts if p.split('=', 1)[0] not in CK]
    return f'href="{base}' + ('?' + sep.join(rest) if rest else '') + '#' + frag[1:] + '?' + sep.join(cond) + '"'
def fix(h): return _RE.sub(_fix, h)
