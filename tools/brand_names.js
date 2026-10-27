// 서비스 이름 값은 tools/brand.py 한 곳 — QA 스크립트(qa_brand·qa_consistency·qa_feat)는 여기서 읽는다(파이썬으로 그대로 불러 옴)
const { execFileSync } = require("child_process");
const path = require("path");
let B = null;
module.exports = () => {
  if (B) return B;
  const code = "import sys, json; sys.path.insert(0, sys.argv[1]); import brand as b; print(json.dumps({k: getattr(b, k) for k in ('BRAND', 'BRAND_EN', 'APP_PKG', 'OLD_NAMES', 'RENAME_LINE', 'EDITOR', 'BANNED')}, ensure_ascii=False))";
  B = JSON.parse(execFileSync("python3", ["-c", code, __dirname], { encoding: "utf8" }));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  B.OLD_RX = new RegExp(B.OLD_NAMES.map(esc).join("|"), "gi");
  return B;
};
