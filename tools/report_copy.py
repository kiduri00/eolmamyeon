"""월간 리포트 글 틀(리뉴얼 사이클 2 · renew-content): 질문형 소제목 + 도입부 훅.
report.py(새 호를 만들 때)와 static_tabs.py(이미 낸 호: 7~10월호)가 같은 표를 쓴다. 숫자·사실은 바꾸지 않는다 — 소제목 말투와,
페이지에 이미 있는 숫자 상자(kpis)를 그대로 옮긴 훅 한 문단만. 몇 번 돌려도 결과가 같다(<!--rp-hook--> 표시 사이를 통째로 바꿈)."""
import re

# 예전 소제목 → 질문형(번호·id·뒤에 붙는 숫자 꼬리는 그대로 둔다)
HEADS = [
    ('이번 호를 읽는 법', '이번 호는 어떻게 읽으면 되나요?'),
    ('이번 달 어떤 인가가 났나', '이번 달 어떤 인가가 났나요?'),
    ('구역별로 보기', '구역별로 보면 어떤가요?'),
    ('1. 이달 단계가 바뀐 구역', '1. 이달 어느 구역이 다음 단계로 갔나요?'),
    ('2. 1억·2억·3억으로 갈 수 있는 곳', '2. 1억·2억·3억이면 어디까지 갈 수 있나요?'),
    ('4. 정비구역 안 경매 물건', '4. 정비구역 안 경매 물건은 몇 건인가요?'),
    ('5. 토지거래허가와 규제', '5. 토지거래허가와 규제는 무엇이 바뀌었나요?'),
    ('7. 이달의 구역 3곳', '7. 이달 눈여겨볼 구역 3곳은 어디인가요?'),
    ('8. 다음 달에 볼 것', '8. 다음 달에는 무엇을 봐야 하나요?'),
    ('유찰 횟수', '몇 번씩 유찰됐나요?'),
    ('입찰 전 물건의 최저가', '입찰 전 물건의 최저가는 얼마인가요?'),
    ('신청에서 인가까지 며칠 걸렸나 (변경 인가 포함)', '신청에서 인가까지 며칠 걸렸나요? (변경 인가 포함)'),
]
# 숫자 꼬리가 붙는 소제목: (정규식, 바꿀 꼴)
HEADS_RX = [
    (r'3\. 재개발 구역 실거래: (거래는 (?:줄고|늘고)) (값(?:은|도) (?:올랐어요|내렸어요|제자리였어요))', r'3. 재개발 구역 실거래는 어땠나요? \1 \2'),
    (r'6\. 입주 흐름: 착공 ([\d,]+)곳이 줄 서 있어요', r'6. 앞으로 입주는 얼마나 몰리나요? 착공 \1곳이 줄 서 있어요'),
    (r'지난 호\(([^)]*)\)와 견주면$', r'지난 호(\1)와 견주면 어떤가요?'),
]


def head(t):
    """소제목 글 하나(태그 없이)를 질문형으로 — report.py가 새 호를 만들 때"""
    for a, b in HEADS:
        if t == a: return b
    for rx, b in HEADS_RX:
        if re.fullmatch(rx, t): return re.sub(rx, b, t)
    return t


def retitle(h):
    """완성된 리포트 HTML의 <h2>/<h3> 글(작은 글 <small> 앞까지)을 질문형으로"""
    def f(m):
        inner = m.group(2)
        k = inner.find('<small')
        txt, tail = (inner[:k], inner[k:]) if k >= 0 else (inner, '')
        return m.group(1) + head(txt.strip()) + (' ' if tail and txt.endswith(' ') else '') + tail + m.group(3)
    return re.sub(r'(<h[23](?: [^>]*)?>)(.*?)(</h[23]>)', f, h, flags=re.S)


def hook_text(month, kp, rng=''):
    """도입부 훅: 독자의 질문으로 열고, 페이지 숫자 상자에 있는 값만 그대로 쓴다. kp = {숫자 상자 이름: 큰 글씨 값}"""
    m = f'{month}월({rng})' if rng else f'{month}월'
    if '단계 바뀐 구역' in kp:
        s = f'{m}에 서울에서 다음 단계로 넘어간 정비구역은 몇 곳일까요? 정보몽땅 등록 기준 {kp["단계 바뀐 구역"]}이에요.'
        if '전세 끼고 3억 안쪽' in kp: s += f' 전세를 끼고 3억 안쪽으로 계산되는 구역은 {kp["전세 끼고 3억 안쪽"]}이고요.'
        return s + ' 어느 구역이 움직였는지, 내 예산으로는 어디까지 닿는지 아래에 정리했어요.'
    if '인가 이벤트' in kp:
        s = f'{m}에 서울 정비사업 인가는 몇 건 났을까요? 정보몽땅 등록 기준 {kp["인가 이벤트"]}이에요.'
        if '최근 36개월 월평균' in kp: s += f' 최근 36개월 월평균 {kp["최근 36개월 월평균"]}과 견주면 이 달이 많은 편인지 적은 편인지 보여요.'
        return s + ' 인가마다 기사·고시 원문과 맞춰 본 결과를 함께 붙였어요.'
    return ''


def kpis(h):
    m = re.search(r'<div class="kpis">(.*?)</div>\s*</div>', h, re.S)
    if not m: return {}
    return {re.sub(r'<[^>]+>', '', a).strip(): re.sub(r'<[^>]+>', '', b).strip() for a, b in re.findall(r'<span>(.*?)</span><b>(.*?)</b>', m.group(1), re.S)}


def add_hook(h, month):
    """byline 바로 뒤에 훅 한 문단(이미 있으면 바꿔 끼움)"""
    h = re.sub(r'<!--rp-hook-->.*?<!--/rp-hook-->', '', h, flags=re.S)
    rg = re.search(r'<p class="eyebrow">[^<]*\(([\d.–-]+) 기준\)</p>', h)
    t = hook_text(month, kpis(h), rg.group(1) if rg else '')
    m = re.search(r'<p class="byline">.*?</p>', h, re.S)
    if not t or not m: return h
    return h[:m.end()] + f'<!--rp-hook--><p class="lede rp-hook">{t}</p><!--/rp-hook-->' + h[m.end():]
