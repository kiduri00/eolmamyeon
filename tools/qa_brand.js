#!/usr/bin/env node
/* QA brand.residual — 옛·검토 이름(tools/brand.py OLD_NAMES)이 public 전체와 src에 0건인지.
   사이클 4 통합(2026-10-29 오너 'Pick 콘셉트로 집핀·얼마면 재개발 흔적 모두 삭제'): 이름 변경 안내·JSON-LD alternateName 예외 없음.
   남는 예외는 assetlinks의 예전 시험 앱 패키지 식별자(brand.OLD_PKGS · 화면에 안 보임 · Play 출시 뒤 뺌) 하나.
   public/b는 지금 빌드가 쓰는 묶음만 본다(index.html·sw.js에서 이어지는 /b/ 파일 — 옛 묶음은 캐시용으로 남겨 둔 것).
   사용: node tools/qa_brand.js  (실패하면 파일별 건수와 첫 몇 곳을 찍고 종료 코드 1) */
const fs = require("fs"), path = require("path");
const R = path.resolve(__dirname, "..");
const BN = require("./brand_names")(), OLD = BN.OLD_RX, NEW = BN.BRAND;   // 금지어·새 이름·안내 문구 = tools/brand.py
const TXT = /\.(html?|js|mjs|css|json|webmanifest|xml|txt|svg|md|py)$/i;
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (TXT.test(e.name)) out.push(p); } return out; };
const rel = (p) => path.relative(R, p).split(path.sep).join("/");
// 지금 빌드가 쓰는 /b/ 묶음: index.html·sw.js에서 시작해 묶음 안의 /b/ 참조를 따라간다
const cur = new Set(), q = ["public/index.html", "public/sw.js"];
while (q.length) { const f = q.shift(); let s = ""; try { s = fs.readFileSync(path.join(R, f), "utf8"); } catch (e) { continue; } for (const m of s.matchAll(/\/b\/([a-z]+\.[0-9a-f]{6,}\.(?:js|css|json))/g)) { const k = "public/b/" + m[1]; if (!cur.has(k)) { cur.add(k); q.push(k); } } }
const files = [...walk(path.join(R, "public")), ...walk(path.join(R, "src"))].map(rel).filter((f) => !f.startsWith("public/b/") || cur.has(f));
// assetlinks.json의 package_name이 brand.OLD_PKGS 가운데 하나일 때만(예전 시험 앱 · 화면에 안 보이는 식별자)
const PKGOK = (f, s, i) => f === "public/.well-known/assetlinks.json" && (BN.OLD_PKGS || []).some((p) => { const k = s.indexOf(`"${p}"`); return k >= 0 && i > k && i < k + p.length + 2; });
const bad = {}; let n = 0, okEx = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(R, f), "utf8");
  for (const m of s.matchAll(OLD)) {
    const ctx = s.slice(Math.max(0, m.index - 80), m.index + 80).split("\n");
    const near = s.slice(Math.max(0, m.index - 80), m.index + 80);
    if (PKGOK(f, s, m.index)) { okEx++; continue; }   // 남는 예외: assetlinks 예전 시험 앱 패키지(brand.OLD_PKGS)
    (bad[f] = bad[f] || []).push(near.replace(/\s+/g, " ").slice(40, 130)); n++;
  }
}
const files_n = Object.keys(bad).length;
// SPA·앱 범위(src · index.html · 지금 묶음 · sw · manifest · assetlinks · admin)와 정적 페이지(생성기·콘텐츠 트랙) 범위를 따로 센다
const SPA = (f) => f.startsWith("src/") || f.startsWith("public/b/") || /^public\/(index\.html|sw\.js|manifest\.webmanifest|admin\.html|\.well-known\/)/.test(f);
const nSpa = Object.keys(bad).filter(SPA).reduce((a, f) => a + bad[f].length, 0);
console.log(`  SPA·앱 범위 ${nSpa}건 · 정적 페이지 범위 ${n - nSpa}건`);
// persona.residual(2026-10-27 오너 결정: 개인 운영자 소개 없음): about 본문·모든 글쓴이 줄(byline·meta 정리 줄·리포트 서명)에
// 필명·개인 경력 서술('늘질문'·'AQ'·'운영자 1인'·'낙찰'·'임장'·'평택')이 없고, 글쓴이 줄은 '운영자'가 아니라 브랜드 편집이어야 한다
{
  const txt = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
  const BADW = /늘질문|\bAQ\b|운영자 1인|낙찰|임장|평택/, hits = [];
  try { const a = txt(fs.readFileSync(path.join(R, "public", "about.html"), "utf8")); const m = BADW.exec(a); if (m) hits.push(`about: '${a.slice(Math.max(0, m.index - 30), m.index + 20).replace(/\s+/g, " ")}'`); } catch (e) { hits.push("about 읽기 실패"); }
  for (const f of files.filter((f) => f.startsWith("public/") && f.endsWith(".html") && !f.startsWith("public/b/"))) {
    const h = fs.readFileSync(path.join(R, f), "utf8");
    for (const m of h.matchAll(/<p class="(?:byline|rp-sig)">[\s\S]*?<\/p>|<p class="meta">정리:[\s\S]*?<\/p>/g)) { const t = txt(m[0]); if (BADW.test(t) || /운영자/.test(t)) { hits.push(`${f}: '${t.replace(/\s+/g, " ").slice(0, 60)}'`); break; } }
  }
  console.log(hits.length ? `FAIL persona.residual — ${hits.length}곳: ${hits.slice(0, 4).join(" ; ")}` : `PASS persona.residual`);
  if (hits.length) process.exitCode = 1;
}
// tone.banned(2026-10-28 오너 '유치한 건 빼고 세련되게'): 말장난·유행어 금지어(tools/brand.py BANNED — '될랑가' 등)가 public·src에 0건
{
  const BW = new RegExp((BN.BANNED || ['될랑가']).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g"), th = [];
  for (const f of files) { if (/\.py$/.test(f)) continue; const s = fs.readFileSync(path.join(R, f), "utf8"); for (const m of s.matchAll(BW)) { th.push(`${f}: '${s.slice(Math.max(0, m.index - 20), m.index + 20).replace(/\s+/g, " ")}'`); } }
  console.log(th.length ? `FAIL tone.banned — ${th.length}곳: ${th.slice(0, 4).join(" ; ")}` : `PASS tone.banned — ${(BN.BANNED || []).join("·")}`);
  if (th.length) process.exitCode = 1;
}
// 사이클 3(B) 사각지대: 글자가 아닌 그림(PNG·SVG)에 남은 옛 핀 마크 — public 전체(+src의 SVG).
//   ① 바이트 해시가 main의 옛 마크 그림(tools/fixtures/old_mark_hashes.json oldMark)과 같은 파일
//   ② SVG 안 옛 핀 물방울 경로(호 반지름 19·19.5: 'A19,19' · 'a19.5 19.5' 꼴) — 새 마크 경로는 'M27.34,7.44'로 시작
//   manifest 스크린샷(mainShots)은 따로 brand.shots에서 본다(사이클 4에 새로 찍기 전까지 알려진 실패 · 숨기지 않음)
let nImg = 0;
{
  const crypto = require("crypto"), FX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "old_mark_hashes.json"), "utf8"));
  const OLDH = new Map(FX.oldMark.map((x) => [x.sha256, x.from])), SHOT = new Map(FX.mainShots.map((x) => [x.sha256, x.file]));
  const IMG = /\.(png|svg)$/i, OLDPIN = /[Aa]\s*19(?:\.5)?[\s,]+19(?:\.5)?[\s,]/;
  const walkI = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walkI(p, out); else if (IMG.test(e.name)) out.push(p); } return out; };
  const imgs = [...walkI(path.join(R, "public")), ...walkI(path.join(R, "src")).filter((p) => /\.svg$/i.test(p))].map(rel);
  const shotSame = [];
  for (const f of imgs) {
    const b = fs.readFileSync(path.join(R, f)), h = crypto.createHash("sha256").update(b).digest("hex");
    if (SHOT.has(h)) { shotSame.push(f); continue; }
    if (OLDH.has(h)) { (bad[f] = bad[f] || []).push(`옛 핀 마크 그림(main ${OLDH.get(h)}와 같은 바이트)`); n++; nImg++; continue; }
    if (/\.svg$/i.test(f)) { const m = OLDPIN.exec(b.toString("utf8")); if (m) { (bad[f] = bad[f] || []).push(`옛 핀 마크 SVG 경로('${m[0].trim()}')`); n++; nImg++; } }
  }
  console.log(`  그림 ${imgs.length}개 검사(옛 마크 해시 ${OLDH.size}개 · SVG 옛 핀 경로) · 걸린 것 ${nImg}개`);
  // manifest가 실제로 내는 스크린샷 파일이 main과 같은 바이트면 실패(옛 이름·옛 화면)
  let mf = {}; try { mf = JSON.parse(fs.readFileSync(path.join(R, "public", "manifest.webmanifest"), "utf8")); } catch (e) {}
  const used = (mf.screenshots || []).map((x) => "public/" + String(x.src || "").replace(/^\//, ""));
  const same = used.filter((f) => shotSame.includes(f));
  console.log(same.length ? `FAIL brand.shots — 알려진 실패(사이클 4에 새로 찍음): manifest 스크린샷 ${same.length}/${used.length}장이 main과 같은 바이트(${same.join(", ")})` : `PASS brand.shots — manifest 스크린샷 ${used.length}장 · main과 같은 바이트 0`);
  if (same.length) process.exitCode = 1;
}
if (!n) { console.log(`PASS brand.residual — 옛 이름·옛 마크 0건 (파일 ${files.length}개 · 지금 묶음 ${cur.size}개 · assetlinks 예전 시험 앱 패키지 예외 ${okEx}곳)`); process.exit(process.exitCode || 0); }
console.log(`FAIL brand.residual — 옛 이름·옛 마크 ${n}건(그림 ${nImg}) · 파일 ${Object.keys(bad).length}개 (assetlinks 예전 시험 앱 패키지 예외 ${okEx}곳)`);
const byDir = {}; for (const f of Object.keys(bad)) { const d = f.replace(/\/[^/]*$/, ""); byDir[d] = (byDir[d] || 0) + bad[f].length; }
for (const [d, c] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) console.log(`  ${d}/ ${c}건`);
for (const f of Object.keys(bad).filter((f) => !/^public\/(z|gu|feed|guide)\//.test(f)).slice(0, 40)) console.log(`  - ${f} ${bad[f].length}건: ${bad[f][0]}`);
process.exit(1);
