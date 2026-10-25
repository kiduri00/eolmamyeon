#!/usr/bin/env node
/* 설치 앱(안드로이드 TWA·PWA) 아이콘 PNG 만들기 — 한 번 돌려 public/에 둔다(내용이 같으면 다시 쓰지 않음).
   - icon-badge-96.png   : 알림 상태 표시줄 작은 아이콘(sw.js badge) · 흰 모양 + 투명 바탕(안드로이드는 알파만 씀)
   - icon-mono-512.png   : manifest purpose "monochrome"(테마 아이콘) · 같은 모양, 안전 영역 안
   - sc-*.png (192)      : manifest 바로가기 4개(지도·관심·리포트·구역) — 앱 첫 화면 아이콘과 같은 그림(src/tapp/00_icons.js)
   사용: NODE_PATH=$(npm root -g) node tools/app_icons.js */
const fs = require("fs"), path = require("path");
const sharp = require("sharp");
const R = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(R, "src/tapp/00_icons.js"), "utf8");
const TI = new Function(src + ";return TI;")();
const LIGHT = { "--tf": "#1F3A87", "--ts": "#13286A", "--tl": "#A9BBE8", "--th": "#F5C33B", "--th2": "#D6A019", "--tp": "#FFFFFF" };
const paint = (s, C) => s.replace(/var\((--t[a-z0-9]+)\)/g, (_, k) => C[k] || "#000");
// 로고 핀 + 집 구멍(흰 모양 · 나머지 투명)
const GLYPH = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${64 + pad * 2} ${64 + pad * 2}"><path fill="#fff" fill-rule="evenodd" d="M32 61C25.5 52.5 12.5 40.5 12.5 24.5a19.5 19.5 0 0 1 39 0C51.5 40.5 38.5 52.5 32 61zM32 12.6 19.6 23.7h3.9V35.2h17V23.7h3.9z"/></svg>`;
// 바로가기: 둥근 타일(앱 첫 화면 아이콘 바탕과 같은 색) + 그림
const SC = (k) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F6FC"/><stop offset="1" stop-color="#E8EDF7"/></linearGradient></defs><rect width="192" height="192" rx="0" fill="url(#g)"/><svg x="36" y="36" width="120" height="120" viewBox="0 0 40 40">${paint(TI[k], LIGHT)}</svg></svg>`;
const OUT = [
  ["icon-badge-96.png", GLYPH(4), 96],
  ["icon-mono-512.png", GLYPH(22), 512],
  ["sc-map-192.png", SC("map"), 192],
  ["sc-fav-192.png", SC("heart"), 192],
  ["sc-report-192.png", SC("report"), 192],
  ["sc-zone-192.png", SC("zone"), 192],
];
(async () => {
  for (const [f, svg, s] of OUT) {
    const buf = await sharp(Buffer.from(svg), { density: 384 }).resize(s, s).png({ compressionLevel: 9 }).toBuffer();
    const fp = path.join(R, "public", f);
    if (fs.existsSync(fp) && Buffer.compare(fs.readFileSync(fp), buf) === 0) continue;
    fs.writeFileSync(fp, buf); console.log("wrote", f, buf.length);
  }
})();
