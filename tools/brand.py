"""서비스 이름(브랜드) 한 곳 정의 — 정적 페이지 생성기(zpages·report·feeds·api·rebuild·zmap·trust·static_tabs)가 모두 여기서 가져온다.
2026-10-27: 상표 문제로 '집핀 Zippin' → '재개각 Jaegaegak'(재개발 + '각 나왔다'). 도메인은 그대로.
SPA·앱(src/shell.html·app.js·tapp·manifest)은 기능 트랙이 같은 값을 쓴다 — 바꿀 때는 이 파일과 함께."""
BRAND = '재개각'                     # 서비스 이름(한글)
BRAND_EN = 'Jaegaegak'               # 영문 표기
TAGLINE = '서울 재개발 지도'          # 로고 옆 작은 글
SITE_TAIL = f'{BRAND} - {TAGLINE}'   # <title> 꼬리
OPERATOR = f'{BRAND} 운영자'
SLOGAN = '내 돈으로 갈 수 있는 서울 재개발'
WIT = '내 돈이면 재개각 나옴'
# 예전 이름 — 아래 안내 문장(about·오류 수정 기록)에서만 쓴다. QA(브랜드 잔존 0)의 허용 예외
OLD_NAMES = ('집핀', 'Zippin', 'zippin')
RENAME_DATE = '2026-10-27'
RENAME_NOTE = '2026년 10월에 서비스 이름을 집핀에서 재개각으로 바꿨어요. 다른 회사 상표와 겹치지 않게 하려는 변경이에요. 사이트 주소와 기능은 그대로예요.'
