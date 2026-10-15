# 얼마면 재개발 (jaegaebal.alwaysquestions.kr)

서울 정비사업 구역을 "내 현금으로 어디까지"로 보여 주는 정적 사이트입니다.

## 폴더

| 위치 | 내용 |
|---|---|
| `public/` | **배포 폴더**. Cloudflare Pages의 빌드 출력 디렉터리로 지정합니다. |
| `src/` | 첫 화면 원본: `shell.html`(HTML 뼈대), `app.js`, `app.css`, `data.json`(구역 기준 자료), `premium.json`(단계 날짜 등), `ext/`(추가 기능: 실제 지도, 구역 리포트 보강, 색 체계) |
| `tools/` | 자료 갱신·빌드 스크립트 |
| `pipeline/` | 갱신 중간 결과와 캐시(경계 레이어, 필지, 정보몽땅 추진경과, 리포트 목록) |
| `.github/workflows/daily.yml` | 매일 06:40(서울) 자동 갱신 |

## 매일 자동 갱신 순서 (`tools/daily.sh`)

1. 서울 열린데이터광장 부동산 실거래가·전월세 CSV 내려받기 (`fetch_tx.js`)
2. 정비사업 정보몽땅 사업장 목록·추진경과 (`cleanup.py`, 하루 최대 350곳, 바뀐 곳 우선)
3. 서울도시공간포털 정비구역(UQ181)·정비사업 현황(UQ120) 경계 레이어 — 매주 월요일 (`fetch_upis.py`)
4. 구역↔경계 매칭(`bnd_match.py`), 경계 안 필지(`parcels.py`)
5. 구역 경계 안 실거래 집계(`tx.py`)
6. 보강(`enrich.py`: 단계·날짜, 좌표, 권리산정기준일, 매수가 빈칸) → 빌드(`build.py`) → 사이트맵(`sitemap.py`)
7. 매달 5일: 지난달 월간 리포트 생성(`calc.js` → `report.py`)

실패한 단계는 어제 자료를 그대로 쓰고 다음 단계로 넘어갑니다.

## 로컬에서

```bash
python3 tools/build.py                 # src → public/index.html
python3 -m http.server 8765 -d public  # 미리 보기
bash tools/daily.sh                    # 전체 갱신(크롬·playwright·shapely 필요)
python3 tools/report.py 2026-10        # 월간 리포트 한 호 만들기
```

## 월간 리포트 원문 대조

`pipeline/report/checks/YYYY-MM.json`에 `{"items":[{"id","event","status":"일치","url","note"}]}`를 넣고 `report.py`를 다시 돌리면 원문 링크가 붙습니다.

## 데이터 출처

서울시 정비사업 정보몽땅, 서울도시공간포털(정비구역·정비사업 현황·연속지적), 서울 열린데이터광장(부동산 실거래가·전월세가), 국토교통부, OpenStreetMap·OpenFreeMap(지도 바탕).

### 구역 실거래 순위 · 고시·공고 소식 (2026-10)
- `tools/tx.py`가 구역별 `n3`(최근 3개월 거래), `n12`, `yoy`(대지지분 3.3㎡당 1년 변화, 두 기간 각 10건 이상만 표시), `hi`(최근 3개월 신고가)를 더한다 → 메인 `#txrTop`.
- `tools/notice.py`가 정보몽땅 추진경과 최근 90일을 `public/data/notice.json`으로 → 메인 `#ntcTop`(인가·고시 / 시공자 / 신청 / 찜 거르기).

### 레드팀 반영 (2026-10-16)
- 신고가: 대지지분 15㎡ 이상 거래끼리 2024년 이후 최고를 3% 넘게 웃돌 때만. 1년 변화: 두 기간 각 10건·5개 건물 이상, 한 건물 비중 30% 이하, 대지지분 구성 차이 20% 이하일 때만.
- 노후도: 사용승인연도 확인 건물 20동 이상·절반 이상일 때만, 이주·철거 이후 단계는 숨김.
- enrich: 미래 날짜 기록 제거, 단계 순서가 거꾸로 된 날짜 제거, 터무니없는 예전 매수가(범위 3배 초과·원룸 기준·신축 단지·먼 이름 매칭) 폐기 후 재계산, 구역 안 3~4건이라도 반경 추정과 25% 넘게 다르면 구역 값 사용.
- notice: 대괄호 태그와 단계로 분류(인가·고시 / 변경 인가 / 시공자 / 신청·공람 / 기타).
- 상권: 서울시 상권분석서비스(`tools/fetch_sang.js` → `tools/sang.py`, 매주 월요일), 매출은 분기 추정매출.
