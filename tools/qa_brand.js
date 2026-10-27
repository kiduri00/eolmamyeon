#!/usr/bin/env node
/* QA brand.residual — 옛 서비스 이름('집핀'·'Zippin'·'zippin'·'ZIPPIN')이 public 전체와 src에 0건인지.
   예외: 소개(about)와 오류 수정 기록(corrections)의 '이름 변경' 안내(같은 줄 앞뒤 80자 안에 새 이름과 '이름'이 함께 있을 때만).
   public/b는 지금 빌드가 쓰는 묶음만 본다(index.html·sw.js에서 이어지는 /b/ 파일 — 옛 묶음은 캐시용으로 남겨 둔 것).
   사용: node tools/qa_brand.js  (실패하면 파일별 건수와 첫 몇 곳을 찍고 종료 코드 1) */
const fs = require("fs"), path = require("path");
const R = path.resolve(__dirname, "..");
const OLD = /집핀|zippin/gi;
const NEW = (() => { const m = fs.readFileSync(path.join(R, "tools", "brand.py"), "utf8").match(/^BRAND = '([^']+)'/m); return m ? m[1] : "재개각"; })();
const EXC = /^public\/(about|corrections)(\.html|\/index\.html)$/;
const TXT = /\.(html?|js|mjs|css|json|webmanifest|xml|txt|svg|md|py)$/i;
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (TXT.test(e.name)) out.push(p); } return out; };
const rel = (p) => path.relative(R, p).split(path.sep).join("/");
// 지금 빌드가 쓰는 /b/ 묶음: index.html·sw.js에서 시작해 묶음 안의 /b/ 참조를 따라간다
const cur = new Set(), q = ["public/index.html", "public/sw.js"];
while (q.length) { const f = q.shift(); let s = ""; try { s = fs.readFileSync(path.join(R, f), "utf8"); } catch (e) { continue; } for (const m of s.matchAll(/\/b\/([a-z]+\.[0-9a-f]{6,}\.(?:js|css|json))/g)) { const k = "public/b/" + m[1]; if (!cur.has(k)) { cur.add(k); q.push(k); } } }
const files = [...walk(path.join(R, "public")), ...walk(path.join(R, "src"))].map(rel).filter((f) => !f.startsWith("public/b/") || cur.has(f));
const bad = {}; let n = 0, okEx = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(R, f), "utf8");
  for (const m of s.matchAll(OLD)) {
    const ctx = s.slice(Math.max(0, m.index - 80), m.index + 80).split("\n");
    const near = s.slice(Math.max(0, m.index - 80), m.index + 80);
    if (EXC.test(f) && near.includes(NEW) && /이름/.test(near)) { okEx++; continue; }
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
if (!n) { console.log(`PASS brand.residual: 옛 이름 0건 (파일 ${files.length}개 · 지금 묶음 ${cur.size}개 · 이름 변경 안내 예외 ${okEx}곳)`); process.exit(process.exitCode || 0); }
console.log(`FAIL brand.residual: 옛 이름 ${n}건 · 파일 ${files_n}개 (이름 변경 안내 예외 ${okEx}곳)`);
const byDir = {}; for (const f of Object.keys(bad)) { const d = f.replace(/\/[^/]*$/, ""); byDir[d] = (byDir[d] || 0) + bad[f].length; }
for (const [d, c] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) console.log(`  ${d}/ ${c}건`);
for (const f of Object.keys(bad).filter((f) => !/^public\/(z|gu|feed|guide)\//.test(f)).slice(0, 40)) console.log(`  - ${f} ${bad[f].length}건: ${bad[f][0]}`);
process.exit(1);
