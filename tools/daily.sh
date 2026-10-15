#!/usr/bin/env bash
# 매일 데이터 갱신 → 빌드. GitHub Actions(.github/workflows/daily.yml)와 로컬에서 같은 순서로 돈다.
set -euo pipefail
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
echo "== 5. 구역 실거래 집계"
SALE=$(ls $RAW/sale_*.csv 2>/dev/null | tr "\n" " " || true)
RENT=$(ls $RAW/rent_*.csv 2>/dev/null | tr '\n' ' ' || true)
if [ -n "$SALE" ] && [ -n "$RENT" ]; then python3 tools/tx.py --sale $SALE --rent $RENT || echo "!! 실거래 집계 실패 — 어제 결과 유지"; else echo "!! CSV 없음 — 실거래 집계 건너뜀"; fi
echo "== 6. 보강 · 빌드"
python3 tools/enrich.py
python3 tools/notice.py || echo "!! 고시·공고 피드 실패"
python3 tools/build.py
python3 tools/feeds.py || echo "!! 구별 RSS 실패"
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
