#!/bin/sh
# 다른 QA 도구(qa.js · qa_feat.js · calc.js …)도 같은 잠금으로:  tools/qa_lock.sh node tools/qa.js http://localhost:8765
# 잠금 파일 QA_LOCK(기본 /tmp/qa.lock) · QA_LOCK_WAIT 초(기본 7200)
L="${QA_LOCK:-/tmp/qa.lock}"
exec env QA_LOCK_HELD=1 flock -w "${QA_LOCK_WAIT:-7200}" "$L" "$@"
