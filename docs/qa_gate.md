# QA 게이트 사용법 (tools/infra_gate.sh)

`tools/infra_gate.sh [포트=8765]`는 통합 브랜치(예: /home/claude/zp-renew, renew)의 루트에서 빌드를 마친 뒤 돌린다. 그 포트에 서버가 없으면 `public/`을 python 서버로 띄운다.

차례대로 하는 일:
1. `qa_consistency` 전체를 2번 돈다. 둘 다 `PASSED`여야 하고, 검사 id·수가 같은지도 비교해 출력한다.
2. 바뀐 레인만 도는 예시(`--files=src/app.css`)를 1번 돈다.
3. `perf_baseline` 3번 가운데 값을 `tools/fixtures/perf_main.json`에 저장한다. 통합 브랜치에서 돌리면 그 브랜치 값이 저장되므로, main 기준선이 필요하면 main 체크아웃에서 돌린다.

결과(`full1/2.txt·json`, `fast.*`, `perf.txt`)는 `$OUT`(기본: 스크래치 `infra/gate`)에 남는다. 모든 단계는 기계 잠금 `/tmp/qa.lock`(flock) 안에서 돌아, 다른 QA가 잠금을 쥐고 있으면 끝날 때까지 기다린다(`QA_LOCK_WAIT` 초, 기본 7200).

종료 코드: 0 통과 · 1 FAIL · 3 SKIP(시간 초과)으로 불완전 · 2 실행 불가.

자주 쓰는 변형:
- `node tools/qa_consistency.js URL --changed` · `--files=a,b` · `--plan`(고른 레인만 보기) · `--list`
- `QAC_ONLY=r14,tapp`
- `QAC_PAR=3`(동시 단위 수)
- `QAC_LANE_MS`(레인 시간 한도 덮어쓰기)
- `QAC_NHF_RUNS`(noHomeFlash 횟수 · 전체 5 · 빠른 모드 1)
- 잠금 없이: `QAC_NO_LOCK=1`
- 다른 QA 도구도 같은 잠금으로: `tools/qa_lock.sh node tools/qa.js URL`

성능 견주기: `node tools/perf_baseline.js URL --against tools/fixtures/perf_main.json`. 한도는 JS gzip +10%, 가장 긴 작업 +100ms이고, 넘으면 exit 1.
