#!/usr/bin/env bash
# 매일 데이터 갱신 → 빌드. GitHub Actions(.github/workflows/daily.yml)와 로컬에서 같은 순서로 돈다.
set -euo pipefail
# 모든 날짜(갱신일·사이트맵·피드)는 서울 기준 — Actions 러너는 UTC라 아침 실행이 전날로 찍혔다
export TZ=Asia/Seoul
cd "$(dirname "$0")/.."
RAW=pipeline/raw
mkdir -p "$RAW" pipeline/cache
echo "== 1. 실거래·전월세 CSV"
timeout 2400 node tools/fetch_tx.js "$RAW" || echo "!! 실거래 내려받기 실패 — 어제 자료로 계속"
echo "== 2. 정보몽땅 추진경과(바뀐 곳 + 7일 지난 곳 최대 350곳)"
timeout 1500 python3 tools/cleanup.py --max 350 || echo "!! 정보몽땅 갱신 실패 — 어제 자료로 계속"
if [ "$(date -u +%u)" = "1" ] || [ ! -f pipeline/cache/upis_uq181.json ]; then
  echo "== 3. 공식 경계 레이어(매주 월요일)"
  timeout 1200 python3 tools/fetch_upis.py || echo "!! 경계 레이어 갱신 실패"
fi
echo "== 3b. 새 사업장"
python3 tools/newrecs.py || cp src/data.json pipeline/data.base.json
echo "== 4. 경계 매칭 · 필지"
python3 tools/bnd_match.py --data pipeline/data.base.json --uq181 pipeline/cache/upis_uq181.json --uq120 pipeline/cache/upis_uq120.json --sgg pipeline/cache/upis_sgg.json --report public/data/geo.json --out public/data/geo.json
timeout 1800 python3 tools/parcels.py || echo "!! 필지 갱신 일부 실패"
timeout 1800 python3 tools/bldg.py || echo "!! 건축물 갱신 일부 실패"
python3 tools/agexy.py || echo "!! 필지 연식 지도 자료 실패 — 이전 자료 유지"   # 사이클 2(F8)
echo "== 5. 구역 실거래 집계"
SALE=$(ls $RAW/sale_*.csv 2>/dev/null | tr "\n" " " || true)
RENT=$(ls $RAW/rent_*.csv 2>/dev/null | tr '\n' ' ' || true)
if [ -n "$SALE" ] && [ -n "$RENT" ]; then python3 tools/tx.py --sale $SALE --rent $RENT || echo "!! 실거래 집계 실패 — 어제 결과 유지"; else echo "!! CSV 없음 — 실거래 집계 건너뜀"; fi
echo "== 5b. 주변 빌라 매수가 표본(구역 경계 반경 안 거래 · 필지 좌표 캐시)"
timeout 1800 python3 tools/near.py || echo "!! 주변 표본 갱신 실패 — 이전 표본 유지"
echo "== 5c. 법원경매 물건(구역 안 필지 · 새로 들어온 날만 검색, 상태 pipeline/cache/auction_state.json에 쌓음) — 실패해도 상태·이전 자료 유지"
rm -f pipeline/raw/auction_raw.json; timeout 1500 node tools/auction.js pipeline/raw/auction_raw.json pipeline/cache/auction_state.json || echo "!! 경매 수집 중단"
python3 tools/auction_match.py || echo "!! 경매 물건 갱신 실패 — 이전 자료 유지"
echo "== 6. 보강 · 빌드"
python3 tools/enrich.py
python3 tools/notice.py || echo "!! 고시·공고 피드 실패"
# 상권분석(분기 자료): 매주 월요일 또는 파일이 없을 때
if [ "$(date -u +%u)" = "1" ] || [ ! -f public/data/sang.json ]; then
  (timeout 1500 node tools/fetch_sang.js pipeline/raw/sang && python3 tools/sang.py) || echo "!! 상권 갱신 실패 — 이전 자료 유지"
fi
python3 tools/build.py
# 토지거래허가 내역(최근 62일만 조회되므로 매일 모아 쌓는다)
timeout 600 python3 tools/toheo.py || echo "!! 토지거래허가 수집 실패 — 이전 자료 유지"
# 구역별 정적 페이지(검색 노출용): 계산 엔진 결과를 새로 뽑아 만든다
(timeout 900 node tools/calc.js && python3 tools/zpages.py) || echo "!! 구역 페이지 갱신 실패 — 이전 페이지 유지"
# 관심 구역 알림(알림함·웹 푸시): 어제 스냅숏과 견준 단계·실거래·고시·필요한 돈 변화 → public/data/changes.json
python3 tools/changes.py || echo "!! 알림 변경 내역 실패 — 어제 자료 유지"
# 건축물대장 총괄표제부(용적률·세대수): 매주 월요일 또는 캐시가 없을 때
if [ "$(date -u +%u)" = "1" ] || [ ! -f pipeline/cache/ledger.json ]; then timeout 1200 node tools/fetch_ledger.js pipeline/raw/ledger || echo "!! 건축물대장 갱신 실패 — 이전 자료 유지"; fi
python3 tools/rebuild.py || echo "!! 재건축 연한 단지 목록 실패"
python3 tools/api.py || echo "!! 앱용 데이터(API) 생성 실패"
python3 tools/feeds.py || echo "!! 구별 RSS 실패"
# 정적 페이지(구역·구·가이드·리포트) 공통 머리·아래 탭·푸터 링크: zpages·rebuild가 새로 쓴 페이지에도 다시 입힌다(build.py가 앞에서 한 번 돌았어도 그 뒤에 새로 쓴 파일이 있다)
python3 tools/static_tabs.py || echo "!! 정적 페이지 탭·푸터 실패"
# 사이트맵: noindex(얇은 구역 페이지 · tools/zpages.py가 매일 다시 판정) 페이지는 뺀다
python3 tools/sitemap.py
# 월간 리포트: 매달 5일에 지난달 호 생성
if [ "$(TZ=Asia/Seoul date +%d)" = "05" ] || [ -n "${FORCE_REPORT:-}" ]; then
  echo "== 7. 월간 리포트"
  if timeout 600 node tools/calc.js; then
  YM=$(TZ=Asia/Seoul date -d "$(TZ=Asia/Seoul date +%Y-%m-01) -1 day" +%Y-%m)
    python3 tools/report.py "$YM" || echo "!! 리포트 생성 실패"
    python3 tools/build.py && python3 tools/sitemap.py
  else echo "!! 계산 엔진 실행 실패 — 리포트 건너뜀"; fi
fi
echo "== 끝"
