// 기계 전체에서 QA·성능 측정을 한 번에 하나만(2코어 공용 기계 · 동시 실행이면 타이밍 검사가 가짜로 떨어진다).
// 쓰는 법(스크립트 맨 앞): if (require("./qa_lock").relaunch(__filename)) return;   — 잠금을 쥔 채 자기 자신을 다시 실행
//   잠금 파일 QA_LOCK(기본 /tmp/qa.lock) · 쥔 쪽 정보는 같은 파일에 · QAC_NO_LOCK=1이면 건너뜀 · QA_LOCK_WAIT 초(기본 7200) 넘게 기다리면 exit 4
"use strict";
const fs = require("fs");
const { spawnSync } = require("child_process");
const LOCK = process.env.QA_LOCK || "/tmp/qa.lock";
function relaunch(file) {
  if (process.env.QAC_NO_LOCK || process.env.QA_LOCK_HELD) return false;
  let holder = ""; try { holder = fs.readFileSync(LOCK, "utf8").trim(); } catch (e) {}
  if (holder) console.error(`[qa-lock] ${LOCK} — 다른 QA가 돌고 있으면 끝날 때까지 기다려요(지금 기록: ${holder})`);
  const wait = String(+process.env.QA_LOCK_WAIT || 7200);
  const info = `${new Date().toISOString()} pid ${process.pid} ${process.cwd()} ${require("path").basename(file)} ${process.argv.slice(2).join(" ")}`.replace(/'/g, "");
  // flock은 fd 9에 잠금을 걸고 쥔 동안 명령을 돌린다 · 쥔 쪽 정보를 잠금 파일에 적는다(잠금은 내용과 상관없이 fd로)
  const r = spawnSync("flock", ["-w", wait, LOCK, "sh", "-c", `printf '%s\\n' '${info}' > ${LOCK}; exec "$0" "$@"`, process.execPath, file, ...process.argv.slice(2)],
    { stdio: "inherit", env: { ...process.env, QA_LOCK_HELD: "1" } });
  if (r.error) { console.error("[qa-lock] flock 실행 실패: " + r.error.message + " — QAC_NO_LOCK=1 로 잠금 없이 돌 수 있어요"); process.exit(2); }
  process.exit(r.status === 1 && !r.signal ? 1 : r.status == null ? 2 : r.status);
}
module.exports = { relaunch, LOCK };
