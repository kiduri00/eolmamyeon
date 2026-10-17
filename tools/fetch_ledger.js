// 서울 열린데이터광장 '서울시 건축물대장 총괄표제부'(OA-23051): 대지면적·용적률·세대수·사용승인일 (재건축 연한 단지 목록용)
// 사용: node tools/fetch_ledger.js pipeline/raw/ledger
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || 'pipeline/raw/ledger');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const args = ['--no-sandbox'];
  if (process.env.HTTPS_PROXY) args.push('--proxy-server=' + process.env.HTTPS_PROXY);
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args });
  const ctx = await b.newContext({ acceptDownloads: true, ignoreHTTPSErrors: !!process.env.HTTPS_PROXY });
  const p = await ctx.newPage();
  await p.route(/analytics|googletagmanager|seoulgnb|weblog/, (r) => r.abort());
  p.on('dialog', (d) => d.accept());
  let ok = false;
  for (let k = 0; k < 3 && !ok; k++) {
    try {
      await p.goto('https://data.seoul.go.kr/dataList/OA-23051/S/1/datasetView.do', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await p.waitForFunction(() => !!(document.frmSheet && window.serviceDownload), null, { timeout: 90000 });
      await p.evaluate(() => { window.isDown = 'N'; });
      const [d] = await Promise.all([p.waitForEvent('download', { timeout: 900000 }), p.evaluate(() => serviceDownload('csv'))]);
      const f = path.join(out, 'summary.csv');
      await d.saveAs(f);
      const n = fs.statSync(f).size;
      if (n < 1e6) throw new Error('too small ' + n);
      console.log('ok summary.csv', n); ok = true;
    } catch (e) { console.log('retry', e.message.slice(0, 120)); await p.waitForTimeout(5000 * (k + 1)); }
  }
  await b.close();
  process.exit(ok ? 0 : 1);
})();
