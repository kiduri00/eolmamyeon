"""시험·임시로 등록된 사업장(이름이 'test', '테스트', '임시' 등뿐인 레코드)을 자료에서 뺀다.
newrecs.py · tx.py · enrich.py가 같은 규칙을 쓴다."""
import re
JUNK = re.compile(r'^[\s\[\(]*(test(ing)?|tset|tmp|temp|dummy|sample|untitled|asdf|qwer|xxx+|zzz+|aaa+|'
                  r'테스트(용)?|시험(용)?|임시|더미|샘플|무제|제목\s*없음|삭제|ㅁ+|ㅇ+|ㅎ+|ㅋ+)[\s\]\)]*[-_#.]?\s*\d*\s*$', re.I)
def is_junk(r):
    n = (r.get('n') or '').strip()
    return not n or bool(JUNK.match(n)) or not re.search(r'[가-힣A-Za-z]', n)
