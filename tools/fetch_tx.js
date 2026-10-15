// 서울 열린데이터광장에서 부동산 실거래가(OA-21275)·전월세가(OA-21276) CSV를 받는다.
// 사용: node tools/fetch_tx.js pipeline/raw   → sale.csv, rent_<올해>.csv, rent_<작년>.csv
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || 'pipeline/raw');
fs.mkdirSync(out, { recursive: true });
const Y = new Date().getFullYear();
(async () => {
  const args = ['--no-sandbox'];
  if (process.env.HTTPS_PROXY) args.push('--proxy-server=' + process.env.HTTPS_PROXY);
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args });
  const ctx = await b.newContext({ acceptDownloads: true, ignoreHTTPSErrors: !!process.env.HTTPS_PROXY });
  const p = await ctx.newPage();
  await p.route(/analytics|googletagmanager|seoulgnb/, (r) => r.abort());
  p.on('dialog', (d) => { console.log('dialog', d.message().slice(0, 60)); d.accept(); });
  const grab = async (oa, col, val, file) => {
    for (let k = 0; k < 3; k++) {
      try {
        await p.goto(`https://data.seoul.go.kr/dataList/${oa}/S/1/datasetView.do`, { waitUntil: 'load', timeout: 120000 });
        await p.waitForFunction(() => !!(document.frmSheet && window.serviceDownload), null, { timeout: 90000 });
        await p.evaluate(([c, v]) => { document.frmSheet.filterCol.value = c; document.frmSheet.txtFilter.value = v; window.isDown = 'N'; }, [col, val]);
        const [d] = await Promise.all([p.waitForEvent('download', { timeout: 900000 }), p.evaluate(() => serviceDownload('csv'))]);
        const f = path.join(out, file);
        await d.saveAs(f);
        const n = fs.statSync(f).size;
        if (n < 1e6) throw new Error('too small ' + n);
        console.log('ok', file, n);
        return true;
      } catch (e) { console.log('retry', file, e.message.slice(0, 120)); await p.waitForTimeout(5000 * (k + 1)); }
    }
    return false;
  };
  // 올해 것은 매일, 지난 2년(매매)·1년(전월세)은 파일이 없을 때만
  const have = (f) => fs.existsSync(path.join(out, f)) && fs.statSync(path.join(out, f)).size > 1e6;
  let ok = true;
  for (const y of [Y, Y - 1, Y - 2]) if (y === Y || !have(`sale_${y}.csv`)) ok = (await grab('OA-21275', 'RCPT_YR', String(y), `sale_${y}.csv`)) && ok;
  ok = (await grab('OA-21276', 'RCPT_YR', String(Y), `rent_${Y}.csv`)) && ok;
  // 지난해 전월세는 시트에 없고 연도별 압축 파일로만 있다(2025년 = seq 40). 없을 때만 받는다.
  const RENT_SEQ = { 2025: 40, 2026: 41 };
  if (!have(`rent_${Y - 1}.csv`) && RENT_SEQ[Y - 1]) {
    const r = await ctx.request.post('https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false', { form: { infId: 'OA-21276', seqNo: '', seq: String(RENT_SEQ[Y - 1]), infSeq: '3' }, timeout: 900000 });
    if (r.ok()) {
      const zp = path.join(out, `rent_${Y - 1}.zip`);
      fs.writeFileSync(zp, await r.body());
      try { require('child_process').execSync(`cd "${out}" && unzip -o -q "rent_${Y - 1}.zip" && f=$(ls -t *.csv | grep -v '^rent_\\|^sale_' | head -1) && mv "$f" "rent_${Y - 1}.csv" && rm -f "rent_${Y - 1}.zip"`); console.log('ok', `rent_${Y - 1}.csv (zip)`); }
      catch (e) { console.log('unzip fail', e.message.slice(0, 80)); ok = false; }
    } else { console.log('bigfile fail', r.status()); ok = false; }
  }
  await b.close();
  process.exit(ok ? 0 : 1);
})();
