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
