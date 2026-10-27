#!/bin/bash
# 조용한 시간(다른 트랙 QA를 멈춘 때)에 리드가 한 번에 돌리는 I 트랙 측정:
#   1) qa_consistency 전체 2번(바뀌지 않은 코드 · 둘 다 PASSED여야 · 검사 수 같아야)  2) 바뀐 레인만 1번(예시 파일)  3) 성능 기준선 → tools/fixtures/perf_main.json
# 사용: tools/infra_gate.sh [포트=8765]   (public/을 그 포트로 띄운다 · 결과는 $OUT 폴더)
# 모든 단계는 /tmp/qa.lock 기계 잠금 안에서(다른 QA가 돌면 기다림).
set -u
cd "$(dirname "$0")/.."
PORT=${1:-8765}; BASE=http://localhost:$PORT
OUT=${OUT:-/tmp/claude-0/-home-claude/887bff60-b663-5701-90e9-e402cebc9114/scratchpad/infra/gate}
mkdir -p "$OUT"; export NODE_PATH=${NODE_PATH:-$(npm root -g)}
curl -sf -o /dev/null "$BASE/" || { (python3 -m http.server "$PORT" -d public >/dev/null 2>&1 &); sleep 2; }
echo "load before: $(cut -d' ' -f1-3 /proc/loadavg) · $(git rev-parse --short HEAD)"
for i in 1 2; do
  s=$(date +%s); QAC_OUT=$OUT/full$i.json node tools/qa_consistency.js "$BASE" > "$OUT/full$i.txt" 2>&1; rc=$?
  echo "full #$i: exit $rc · $(( $(date +%s) - s ))s · $(tail -1 "$OUT/full$i.txt" | cut -c1-120)"
done
node -e "const a=require('$OUT/full1.json'),b=require('$OUT/full2.json');const k=r=>r.checks.map(c=>c.id).join();console.log('same check ids:',k(a)===k(b),a.checks.length,b.checks.length,'· sum n',a.checks.reduce((s,c)=>s+c.n,0),b.checks.reduce((s,c)=>s+c.n,0))"
s=$(date +%s); QAC_OUT=$OUT/fast.json node tools/qa_consistency.js "$BASE" --files=src/app.css > "$OUT/fast.txt" 2>&1; rc=$?
echo "fast (--files=src/app.css): exit $rc · $(( $(date +%s) - s ))s · $(head -1 "$OUT/fast.txt" | cut -c1-140)"
node tools/perf_baseline.js "$BASE" --runs 3 --out tools/fixtures/perf_main.json > "$OUT/perf.txt" 2>&1; echo "perf: exit $? · $(grep -A3 '^median' "$OUT/perf.txt" | tr '\n' ' ')"
echo "load after: $(cut -d' ' -f1-3 /proc/loadavg)"
