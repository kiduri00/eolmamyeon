// 서울 열린데이터광장 상권분석서비스: 영역-상권(OA-15560), 점포-상권(OA-15577, 최신 분기), 추정매출-상권(OA-15572, 최신 분기)
// 사용: node tools/fetch_sang.js pipeline/raw/sang
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || 'pipeline/raw/sang');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const args = ['--no-sandbox'];
  if (process.env.HTTPS_PROXY) args.push('--proxy-server=' + process.env.HTTPS_PROXY);
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args });
  const ctx = await b.newContext({ acceptDownloads: true, ignoreHTTPSErrors: !!process.env.HTTPS_PROXY });
  const p = await ctx.newPage();
  await p.route(/analytics|googletagmanager|seoulgnb/, (r) => r.abort());
  p.on('dialog', (d) => d.accept());
  const open = async (oa) => {
    await p.goto(`https://data.seoul.go.kr/dataList/${oa}/S/1/datasetView.do`, { waitUntil: 'load', timeout: 120000 });
    await p.waitForFunction(() => !!(document.frmSheet && window.serviceDownload), null, { timeout: 90000 });
  };
  const grab = async (oa, file, col, val) => {
    for (let k = 0; k < 3; k++) {
      try {
        await open(oa);
        if (col) await p.evaluate(([c, v]) => { document.frmSheet.filterCol.value = c; document.frmSheet.txtFilter.value = v; }, [col, val]);
        await p.evaluate(() => { window.isDown = 'N'; });
        const [d] = await Promise.all([p.waitForEvent('download', { timeout: 600000 }), p.evaluate(() => serviceDownload('csv'))]);
        const f = path.join(out, file);
        await d.saveAs(f);
        const n = fs.statSync(f).size;
        if (n < 5e4) throw new Error('too small ' + n);
        console.log('ok', file, n);
        return true;
      } catch (e) { console.log('retry', file, e.message.slice(0, 120)); await p.waitForTimeout(5000 * (k + 1)); }
    }
    return false;
  };
  if (process.argv[3] === 'cols') {
    for (const oa of ['OA-15577', 'OA-15572']) { await open(oa); console.log(oa, await p.evaluate(() => [...document.frmSheet.filterCol.options].map((o) => o.value + '=' + o.text).join(' | '))); }
    await b.close(); return;
  }
  // 최신 분기: 올해·작년 분기를 거꾸로 시도
  const now = new Date(), qs = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 1; y--) for (let q = 4; q >= 1; q--) qs.push(`${y}${q}`);
  let ok = await grab('OA-15560', 'area.csv');
  let got = null;
  for (const q of qs) { if (await grab('OA-15577', 'store.csv', 'STDR_YYQU_CD', q)) { got = q; break; } }
  if (got) await grab('OA-15572', 'sales.csv', 'STDR_YYQU_CD', got);
  fs.writeFileSync(path.join(out, 'quarter.txt'), got || '');
  await b.close();
  process.exit(ok && got ? 0 : 1);
})();
