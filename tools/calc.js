// public/index.html의 계산 엔진으로 모든 구역의 기본 가정 결과를 뽑아 pipeline/calc.json에 쓴다.
// 사용: node tools/calc.js   (환경변수 CHROME 으로 크롬 경로 지정 가능)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PUB = path.join(ROOT, 'public');
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(PUB, p);
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
}).listen(0, async () => {
  const port = srv.address().port;
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof window.__emrCalc === 'function', null, { timeout: 30000 });
  const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline/data.enriched.json'), 'utf8')).recs.map((r) => r.id);
  const out = await p.evaluate((ids) => window.__emrCalc(ids), ids);
  fs.writeFileSync(path.join(ROOT, 'pipeline/calc.json'), JSON.stringify(out));
  console.log('calc', Object.keys(out).length);
  await b.close(); srv.close();
});
