// 법원경매정보(courtauction.go.kr) 서울 5개 지방법원 부동산 기일입찰 물건 목록 모으기
// 사이트 화면을 그대로 조작한다(법원 고르기 → 검색 → 쪽 넘김) · 응답(searchControllerMain.on)만 읽는다.
// 사용: node tools/auction.js [출력 파일=pipeline/raw/auction_raw.json]
// 막히거나(차단·시간 초과·해외 IP 안내) 실패해도 exit 0 — 이전 public/data/auction.json은 tools/auction_match.py가 지킨다.
const fs = require('fs'), path = require('path');
const OUT = path.resolve(process.argv[2] || 'pipeline/raw/auction_raw.json');
const URL0 = 'https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151F00.xml';
const API = /\/pgj\/pgjsearch\/searchControllerMain\.on/;
const COURTS = ['서울중앙지방법원', '서울동부지방법원', '서울서부지방법원', '서울남부지방법원', '서울북부지방법원'];
const SEL_COURT = '#mf_wfm_mainFrame_sbx_rletCortOfc', BTN = '#mf_wfm_mainFrame_btn_gdsDtlSrch';
const MAX_PAGES = +process.env.AUCTION_MAX_PAGES || 150;   // 법원 하나당 쪽 수 상한
const DAYS = +process.env.AUCTION_DAYS || 45;              // 기일 검색 기간(화면이 받아 주면 넓힌다 · 기본은 14일)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => a + Math.floor(Math.random() * (b - a));
const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const log = (...a) => console.log('[auction]', ...a);
const BLOCK = /(접근이\s*(제한|차단)|차단되었|비정상적인\s*접근|해외\s*IP|허용되지\s*않은|Access\s*Denied|Forbidden)/i;

function save(o) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT + '.tmp', JSON.stringify(o)); fs.renameSync(OUT + '.tmp', OUT); }

(async () => {
  const res = { asOf: kst(), ok: false, src: '법원경매정보', courts: [], items: [] };
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { log('playwright 없음 — 건너뜀'); save({ ...res, err: 'no-playwright' }); return; }
  let b;
  const hard = setTimeout(() => { log('!! 전체 시간 초과 — 모은 것까지만 저장'); finish(true); }, (+process.env.AUCTION_TIMEOUT || 900) * 1000);
  let done = false;
  function finish(timeout) {
    if (done) return; done = true; clearTimeout(hard);
    res.ok = res.courts.length === COURTS.length && res.courts.every((c) => c.ok);
    if (timeout) res.err = 'timeout';
    save(res);
    log(`끝 ok=${res.ok} 물건 ${res.items.length}건`, res.courts.map((c) => `${c.court}:${c.got}/${c.total ?? '?'}${c.err ? '(' + c.err + ')' : ''}`).join(' '));
    Promise.resolve(b && b.close()).catch(() => {}).finally(() => process.exit(0));
  }
  try {
    const args = ['--no-sandbox', '--disable-blink-features=AutomationControlled'];
    if (process.env.HTTPS_PROXY) args.push('--proxy-server=' + process.env.HTTPS_PROXY);
    b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args });
    const ctx = await b.newContext({
      locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: 1366, height: 900 }, ignoreHTTPSErrors: !!process.env.HTTPS_PROXY,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.6' },
    });
    const p = await ctx.newPage();
    await p.route(/google-analytics|googletagmanager|\.(woff2?|ttf)(\?|$)/, (r) => r.abort());
    p.on('dialog', (d) => { log('알림창:', d.message().slice(0, 80)); d.accept().catch(() => {}); });
    // 응답 모으기: 마지막 검색 응답을 기다리는 쪽으로 넘긴다
    let waiter = null, last = null;
    p.on('response', async (r) => {
      if (!API.test(r.url())) return;
      let j = null, st = r.status();
      try { j = await r.json(); } catch (e) { try { const t = await r.text(); if (BLOCK.test(t)) j = { blocked: true }; } catch (e2) {} }
      last = { st, j, req: r.request() };
      if (waiter) { const w = waiter; waiter = null; w(last); }
    });
    const nextResp = (ms = 40000) => new Promise((ok) => { const t = setTimeout(() => { if (waiter === f) waiter = null; ok(null); }, ms); const f = (x) => { clearTimeout(t); ok(x); }; waiter = f; });
    const blocked = async () => { try { return BLOCK.test(await p.evaluate(() => document.body ? document.body.innerText.slice(0, 4000) : '')); } catch (e) { return false; } };

    await p.goto(URL0, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForSelector(SEL_COURT, { timeout: 60000 }).catch(() => null);
    if (await blocked()) throw new Error('blocked-page');
    if (!(await p.$(SEL_COURT))) throw new Error('no-form');
    await sleep(jitter(2000, 3500));

    // 기일 검색 기간 넓히기(가능할 때만): 폼 안 'YYYY.MM.DD'/'YYYYMMDD' 날짜 칸 두 개 중 뒤 칸
    const widen = async () => {
      try {
        const end = new Date(Date.now() + 9 * 3600e3 + DAYS * 864e5).toISOString().slice(0, 10);
        const r = await p.evaluate((end) => {
          const ins = [...document.querySelectorAll('input[id^="mf_wfm_mainFrame"]')].filter((i) => i.offsetParent && /^\d{4}[.\-]?\d{2}[.\-]?\d{2}$/.test(i.value.trim()));
          if (ins.length < 2) return 'no-date-inputs';
          const e = ins[1], v0 = e.value, sep = v0.includes('.') ? '.' : v0.includes('-') ? '-' : '';
          const nv = end.replaceAll('-', sep);
          // WebSquare 달력 컴포넌트면 그 API로(입력 칸 id 끝 '_input'을 뗀 이름)
          const cid = e.id.replace(/_input$/, ''), c = window[cid] || (window.$p && $p.getComponentById && $p.getComponentById(cid));
          if (c && typeof c.setValue === 'function') { c.setValue(end.replaceAll('-', '')); return 'ws:' + cid + '=' + (c.getValue ? c.getValue() : nv); }
          e.focus(); e.value = nv; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur();
          return 'dom:' + e.id + '=' + e.value;
        }, end);
        log('기간:', r);
      } catch (e) { log('기간 넓히기 건너뜀', e.message.slice(0, 80)); }
    };
    // 쪽 크기 50(화면에 고르는 칸이 있으면)
    const bigPage = async () => {
      try {
        return await p.evaluate(() => {
          const s = [...document.querySelectorAll('select')].find((x) => x.offsetParent && [...x.options].some((o) => /^50/.test(o.text.trim())) && [...x.options].some((o) => /^10/.test(o.text.trim())));
          if (!s) return false;
          const o = [...s.options].find((o) => /^50/.test(o.text.trim()));
          if (s.value === o.value) return false;
          s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true }));
          const cid = s.id.replace(/_input_?\d*$/, ''), c = window[cid];
          if (c && typeof c.setValue === 'function') { try { c.setValue(o.value); } catch (e) {} }
          return true;
        });
      } catch (e) { return false; }
    };
    const pickCourt = async (name) => {
      try { await p.selectOption(SEL_COURT, { label: name }, { timeout: 8000 }); return true; } catch (e) {}
      return p.evaluate(([sel, name]) => {
        const s = document.querySelector(sel); if (!s) return false;
        const o = [...(s.options || [])].find((o) => o.text.trim() === name); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return true; }
        const c = window[sel.slice(1)]; if (c && typeof c.setText === 'function') { c.setText(name); return true; }
        return false;
      }, [SEL_COURT, name]);
    };
    // 다음 쪽 누르기: 쪽 목록에서 숫자 n 버튼 → 없으면 '다음' 버튼
    const clickPage = (n) => p.evaluate((n) => {
      const vis = (e) => e && e.offsetParent;
      const box = [...document.querySelectorAll('[id*="pgl"],[class*="pageList"],[class*="paging"]')].filter(vis);
      for (const bx of box) {
        const a = [...bx.querySelectorAll('a,button,li,span')].find((x) => vis(x) && x.textContent.trim() === String(n) && !x.querySelector('a,button'));
        if (a) { a.click(); return 'num'; }
      }
      for (const bx of box) {
        const nx = [...bx.querySelectorAll('[id$="_next_btn"],[class*="next"],a,button')].find((x) => vis(x) && (/_next_btn$/.test(x.id) || /next/.test(x.className) || /^(다음|>|›)$/.test(x.textContent.trim())) && !/last|end/.test(x.id + x.className));
        if (nx) { nx.click(); return 'next'; }
      }
      return '';
    }, n);
    const rows = (j) => (j && j.data && Array.isArray(j.data.dlt_srchResult) ? j.data.dlt_srchResult : null);
    const info = (j) => (j && j.data && j.data.dma_pageInfo) || {};

    // 기일 기간 칸 찾기·설정(WebSquare 달력 컴포넌트 API 우선). 화면 기본은 오늘~+14일이라, 2주씩 끊어 여러 번 검색한다
    const WINS = +process.env.AUCTION_WINS || 4;   // 2주 × 4 = 8주 앞까지
    const calIds = () => p.evaluate(() => [...document.querySelectorAll('[id^="mf_wfm_mainFrame_cal_rletPerd"]')].map((e) => e.id).filter((id) => !/_(input|img|button|div)/.test(id)));
    const setPeriod = async (from, to) => p.evaluate(([from, to]) => {
      const ids = [...document.querySelectorAll('[id^="mf_wfm_mainFrame_cal_rletPerd"]')].map((e) => e.id).filter((id) => !/_(input|img|button|div)/.test(id));
      const comp = (id) => window[id] || (window.$p && $p.getComponentById && $p.getComponentById(id));
      const st = ids.find((i) => /Bgn|Str|Start|Fr|Beg/i.test(i)), en = ids.find((i) => /End|To/i.test(i));
      const out = {};
      for (const [id, v] of [[st, from], [en, to]]) { const c = id && comp(id); if (c && c.setValue) { c.setValue(v); out[id] = c.getValue ? c.getValue() : v; } }
      return { ids, out };
    }, [from, to]);
    const popupText = () => p.evaluate(() => [...document.querySelectorAll('[class*="w2popup"],[class*="w2window"],[role="dialog"],[class*="alert"]')].filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 160)).join(' | '));
    const ymd = (d) => d.toISOString().slice(0, 10).replaceAll('-', '');
    const today = new Date(Date.now() + 9 * 3600e3);

    let first = true;
    for (const court of COURTS) {
      const c = { court, ok: true, total: 0, got: 0, pages: 0, wins: [] };
      res.courts.push(c);
      const seen = new Set();
      const take = (j) => { let k = 0; for (const it of rows(j)) { const key = it.docid || `${it.srnSaNo}/${it.maemulSer}/${it.mokmulSer}`; if (seen.has(key)) continue; seen.add(key); res.items.push({ ...it, _court: court }); k++; } return k; };
      for (let w = 0; w < WINS; w++) {
        const wi = { w, ok: false, total: null, got: 0 };
        c.wins.push(wi);
        try {
          if (!first) { await p.goto(URL0, { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForSelector(SEL_COURT, { timeout: 60000 }).catch(() => null); await sleep(jitter(2000, 3500)); }
          first = false;
          await bigPage();
          if (!(await pickCourt(court))) throw new Error('court-select');
          await sleep(jitter(800, 1500));
          if (w > 0) {
            const from = new Date(today.getTime() + (w * 14 + 1) * 864e5), to = new Date(today.getTime() + (w + 1) * 14 * 864e5);
            const r0 = await setPeriod(ymd(from), ymd(to));
            if (court === COURTS[0]) log('기간', w, JSON.stringify(r0).slice(0, 200));
            await sleep(jitter(600, 1200));
          } else if (court === COURTS[0]) log('달력 칸', JSON.stringify(await calIds()));
          const pr = nextResp();
          await p.evaluate((sel) => { const b = document.querySelector(sel); if (b) b.click(); }, BTN);
          let r = await pr;
          if (!r) throw new Error('no-response ' + (await popupText()));
          if (r.j && r.j.blocked) throw new Error('blocked');
          if (r.st >= 400 || !rows(r.j)) throw new Error('bad-response ' + r.st + ' ' + JSON.stringify(r.j || '').slice(0, 120));
          const g0 = seen.size;
          take(r.j); c.pages++;
          const pi = info(r.j), size = +pi.pageSize || 10; wi.total = +pi.totalCnt || 0;
          const pages = Math.min(MAX_PAGES, Math.ceil(wi.total / size));
          for (let n = 2; n <= pages; n++) {
            await sleep(jitter(2500, 4000));
            const pr2 = nextResp();
            const how = await clickPage(n);
            if (!how) { log(court, w, n, '쪽 버튼을 못 찾음'); break; }
            r = await pr2;
            if (!r || (r.j && r.j.blocked) || !rows(r.j)) { log(court, w, n, '쪽 응답 없음/막힘'); if (r && r.j && r.j.blocked) throw new Error('blocked'); break; }
            take(r.j); c.pages++;
          }
          wi.got = seen.size - g0;
          wi.ok = seen.size - g0 >= Math.min(wi.total, MAX_PAGES * size) - 1 - (wi.total - (seen.size - g0) > 0 ? 0 : 0);
          c.total += wi.total;
          log(court, `기간${w}`, `${wi.got}/${wi.total}`);
        } catch (e) {
          wi.err = String(e.message || e).slice(0, 160); log('!!', court, `기간${w}`, wi.err);
          try { if (process.env.AUCTION_SHOTS) await p.screenshot({ path: path.join(process.env.AUCTION_SHOTS, `err-${res.courts.length}-${w}.png`) }); } catch (e2) {}
          if (/blocked/.test(wi.err) || (await blocked())) { log('!! 차단 안내 — 멈춤'); c.ok = false; break; }
        }
        if (w === 0 && !wi.ok) { c.ok = false; }
        await sleep(jitter(2500, 4000));
      }
      c.got = seen.size;
      if (!c.wins[0] || !c.wins[0].ok) c.ok = false;
      c.days = c.wins.filter((x) => x.ok).length * 14;
      log(court, `합계 ${c.got} · ${c.days}일치`);
      if (res.courts.length && /blocked/.test((c.wins.slice(-1)[0] || {}).err || '')) break;
      await sleep(jitter(3000, 5000));
    }
  } catch (e) {
    res.err = String(e.message || e).slice(0, 160); log('!! 실패:', res.err);
  }
  finish(false);
})();
