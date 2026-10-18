// 법원경매정보(courtauction.go.kr) 서울 5개 지방법원 부동산 기일입찰 물건 목록 모으기
// 사이트 화면을 그대로 조작한다(법원 고르기 → 검색 → 쪽 넘김) · 응답(searchControllerMain.on)만 읽는다.
// 사이트는 매각기일을 '오늘부터 2주 안'으로만 찾게 해 준다 → 법원마다 하루 한 번, 기본 기간(오늘~2주)으로만 검색한다.
// 그 밖(다음 기일이 2주 넘게 남은 물건)은 tools/auction_match.py가 이전 자료를 이어 붙여 보여 준다.
// 사용: node tools/auction.js [출력 파일=pipeline/raw/auction_raw.json]
// 막히거나(차단·시간 초과·요청 상한) 실패해도 exit 0 — 모은 데까지 저장하고, 이전 자료는 auction_match.py가 지킨다.
// 환경 변수: AUCTION_BUDGET(쪽 요청 상한, 기본 300) · AUCTION_TIMEOUT(초, 기본 1500) · AUCTION_MAX_PAGES(법원당 쪽 상한, 150) · AUCTION_SHOTS(오류 화면 저장 폴더)
const fs = require('fs'), path = require('path');
const OUT = path.resolve(process.argv[2] || 'pipeline/raw/auction_raw.json');
const URL0 = 'https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151F00.xml';
const API = /\/pgj\/pgjsearch\/searchControllerMain\.on/;
// 서부를 먼저: 법원 고르기가 안 먹던 곳이라 진단·대안 검색에 요청 여유를 둔다
const COURTS = ['서울서부지방법원', '서울중앙지방법원', '서울동부지방법원', '서울남부지방법원', '서울북부지방법원'];
const JUR = { 서울서부지방법원: ['마포구', '서대문구', '은평구', '용산구'] };   // 소재지 검색 대안(관할 구)
const P = 'mf_wfm_mainFrame_';
const SEL_COURT = `#${P}sbx_rletCortOfc`, BTN = `#${P}btn_gdsDtlSrch`, SEL_SD = `#${P}sbx_rletAdongSdS`, SEL_SGG = `#${P}sbx_rletAdongSggS`;
const MAX_PAGES = +process.env.AUCTION_MAX_PAGES || 150;
const BUDGET = +process.env.AUCTION_BUDGET || 300;   // 이번 실행 전체 쪽 요청 상한(많이 부르면 IP가 막힌다)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => a + Math.floor(Math.random() * (b - a));
const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const log = (...a) => console.log('[auction]', ...a);
const BLOCK = /(비정상적인\s*접(속|근)|보안정책|접근이\s*(제한|차단)|차단되었|해외\s*IP|허용되지\s*않은|Access\s*Denied|Forbidden)/i;

function save(o) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT + '.tmp', JSON.stringify(o)); fs.renameSync(OUT + '.tmp', OUT); }

(async () => {
  const res = { asOf: kst(), ok: false, src: '법원경매정보', win: 14, used: 0, budget: BUDGET, courts: [], items: [] };
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { log('playwright 없음 — 건너뜀'); save({ ...res, err: 'no-playwright' }); return; }
  let b, done = false, stop = '';   // stop: 'blocked' | 'budget' — 더는 요청하지 않는다
  const hard = setTimeout(() => { log('!! 전체 시간 초과 — 모은 것까지만 저장'); finish('timeout'); }, (+process.env.AUCTION_TIMEOUT || 1500) * 1000);
  function finish(err) {
    if (done) return; done = true; clearTimeout(hard);
    res.ok = res.courts.length === COURTS.length && res.courts.every((c) => c.ok);
    if (err || stop) res.err = err || stop;
    save(res);
    log(`끝 ok=${res.ok} 물건 ${res.items.length}건 · 요청 ${res.used}/${BUDGET}${res.err ? ' · ' + res.err : ''}`, res.courts.map((c) => `${c.court}:${c.got}/${c.total ?? '?'}${c.how ? '[' + c.how + ']' : ''}${c.err ? '(' + c.err + ')' : ''}`).join(' '));
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
    let waiter = null;
    p.on('response', async (r) => {
      if (!API.test(r.url())) return;
      let j = null, st = r.status();
      try { j = await r.json(); } catch (e) { try { const t = await r.text(); if (BLOCK.test(t)) j = { blocked: true, message: t.slice(0, 120) }; } catch (e2) {} }
      if (j && !j.blocked && j.message && BLOCK.test(String(j.message))) j = { blocked: true, message: String(j.message).slice(0, 120) };
      let body = ''; try { body = r.request().postData() || ''; } catch (e) {}
      const x = { st, j, body };
      if (waiter) { const w = waiter; waiter = null; w(x); }
    });
    const nextResp = (ms = 40000) => new Promise((ok) => { const t = setTimeout(() => { if (waiter === f) waiter = null; ok(null); }, ms); const f = (x) => { clearTimeout(t); ok(x); }; waiter = f; });
    const blockedPage = async () => { try { return BLOCK.test(await p.evaluate(() => document.body ? document.body.innerText.slice(0, 4000) : '')); } catch (e) { return false; } };
    const popupText = () => p.evaluate(() => [...document.querySelectorAll('[class*="w2popup"],[class*="w2window"],[role="dialog"],[class*="alert"]')].filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\s+/g, ' ').trim().slice(0, 160)).filter(Boolean).join(' | ')).catch(() => '');
    const rows = (j) => (j && j.data && Array.isArray(j.data.dlt_srchResult) ? j.data.dlt_srchResult : null);
    const info = (j) => (j && j.data && j.data.dma_pageInfo) || {};
    // 요청 하나 보내기(검색·쪽 넘김 공통): 상한·차단을 여기서만 센다
    const ask = async (fire) => {
      if (stop) throw new Error(stop);
      if (res.used >= BUDGET) { stop = 'budget'; throw new Error('budget'); }
      res.used++;
      const pr = nextResp();
      const how = await fire();
      if (how === false) { waiter = null; return { none: true }; }
      const r = await pr;
      if (r && r.j && r.j.blocked) { stop = 'blocked'; log('!! 차단 안내:', r.j.message); throw new Error('blocked'); }
      return r;
    };
    const open = async () => {
      await p.goto(URL0, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await p.waitForSelector(SEL_COURT, { timeout: 60000 }).catch(() => null);
      if (await blockedPage()) { stop = 'blocked'; throw new Error('blocked-page'); }
      if (!(await p.$(SEL_COURT))) throw new Error('no-form');
      await sleep(jitter(2000, 3500));
    };
    // 법원 고르기: 화면 select(라벨) → WebSquare 컴포넌트 setValue(값) 순. 무엇이 실제로 골라졌는지 돌려준다
    const courtState = () => p.evaluate((id) => {
      const s = document.querySelector('#' + id), c = window[id];
      const o = s && s.selectedOptions && s.selectedOptions[0];
      let cv = null; try { cv = c && c.getValue ? c.getValue() : null; } catch (e) {}
      return { dom: o ? `${o.value}:${o.text.trim()}` : null, ws: cv };
    }, SEL_COURT.slice(1));
    const pickCourt = async (name, mode) => {
      if (mode !== 'ws') {
        try { await p.selectOption(SEL_COURT, { label: name }, { timeout: 8000 }); return { how: 'label', ...(await courtState()) }; } catch (e) {}
      }
      const how = await p.evaluate(([id, name]) => {
        const s = document.querySelector('#' + id); if (!s) return '';
        const o = [...(s.options || [])].find((o) => o.text.replace(/\s+/g, '') === name) || [...(s.options || [])].find((o) => o.text.includes(name.replace(/^서울|지방법원$/g, '')));
        if (!o) return '';
        const c = window[id];
        if (c && typeof c.setValue === 'function') { try { c.setValue(o.value); } catch (e) {} }
        s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true }));
        return 'ws:' + o.value;
      }, [SEL_COURT.slice(1), name]);
      return how ? { how, ...(await courtState()) } : null;
    };
    const selectByText = async (sel, text) => {
      try { await p.selectOption(sel, { label: text }, { timeout: 6000 }); return true; } catch (e) {}
      return p.evaluate(([id, text]) => {
        const s = document.querySelector('#' + id); if (!s) return false;
        const o = [...(s.options || [])].find((o) => o.text.trim() === text) || [...(s.options || [])].find((o) => o.text.includes(text));
        if (!o) return false;
        const c = window[id]; if (c && typeof c.setValue === 'function') { try { c.setValue(o.value); } catch (e) {} }
        s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return true;
      }, [sel.slice(1), text]);
    };
    // 소재지(지번주소)로 찾기: 라디오 → 시/도 → 시/군/구
    let radioLogged = false;
    const pickAddr = async (gu) => {
      const rs = await p.evaluate(() => [...document.querySelectorAll('input[type=radio]')].filter((e) => e.id.startsWith('mf_wfm_mainFrame')).map((e) => {
        const l = document.querySelector(`label[for="${e.id}"]`);
        return { id: e.id, name: e.name, v: e.value, ck: e.checked, vis: !!e.offsetParent, lab: (l ? l.textContent : (e.parentElement && e.parentElement.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 30) };
      }));
      if (!radioLogged) { radioLogged = true; log('라디오', JSON.stringify(rs).slice(0, 900)); }
      const r = rs.find((x) => /소재지/.test(x.lab) && /지번/.test(x.lab)) || rs.find((x) => /소재지/.test(x.lab));
      if (!r) return null;
      await p.evaluate((id) => { const e = document.getElementById(id); const l = document.querySelector(`label[for="${id}"]`); (l || e).click(); if (!e.checked) { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); e.dispatchEvent(new Event('click', { bubbles: true })); } }, r.id);
      await sleep(jitter(800, 1400));
      if (!(await selectByText(SEL_SD, '서울특별시'))) return { how: 'addr', err: 'no-sido', radio: r.id };
      let okGu = false;
      for (let k = 0; k < 20 && !okGu; k++) { await sleep(500); okGu = await p.evaluate(([id, gu]) => { const s = document.querySelector('#' + id); return !!(s && [...s.options].some((o) => o.text.trim() === gu)); }, [SEL_SGG.slice(1), gu]); }
      if (!okGu || !(await selectByText(SEL_SGG, gu))) {
        const opts = await p.evaluate((id) => { const s = document.querySelector('#' + id); return s ? [...s.options].map((o) => o.text.trim()).slice(0, 30) : null; }, SEL_SGG.slice(1));
        return { how: 'addr', err: 'no-sgg', radio: r.id, opts };
      }
      await sleep(jitter(600, 1100));
      return { how: 'addr:' + gu, radio: r.id };
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
      return false;
    }, n);
    const seen = new Set();
    const take = (j, court) => { let k = 0; for (const it of rows(j)) { const key = it.docid || `${it.boCd}/${it.srnSaNo}/${it.maemulSer}/${it.mokmulSer}`; if (seen.has(key)) continue; seen.add(key); res.items.push({ ...it, _court: court }); k++; } return k; };
    const names = (j) => { const m = {}; for (const it of rows(j) || []) m[it.jiwonNm] = (m[it.jiwonNm] || 0) + 1; return m; };

    // 검색 한 번(설정 → 검색 → 끝 쪽까지). 첫 쪽 응답·법원 이름을 돌려준다
    let firstOpen = true, optsLogged = false;
    const search = async (court, setup, tag) => {
      const out = { tag, total: null, got: 0, pages: 0 };
      if (!firstOpen) await open();
      firstOpen = false;
      if (!optsLogged) {
        optsLogged = true;
        const d = await p.evaluate((id) => { const s = document.querySelector('#' + id), c = window[id]; return { tag: s && s.tagName, opts: s ? [...s.options].map((o) => `${o.value}:${o.text.trim()}`).filter((x) => /서울|^:/.test(x)) : null, ws: !!c, wsFns: c ? ['setValue', 'getValue', 'setText', 'setSelectedIndex'].filter((f) => typeof c[f] === 'function') : [] }; }, SEL_COURT.slice(1));
        log('법원 칸', JSON.stringify(d).slice(0, 600));
      }
      const st = await setup();
      out.set = st;
      if (!st || st.err) throw Object.assign(new Error('setup ' + JSON.stringify(st)), { out });
      await sleep(jitter(800, 1500));
      let r = await ask(() => p.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return false; b.click(); return true; }, BTN));
      if (!r || r.none) throw Object.assign(new Error('no-response ' + (await popupText())), { out });
      if (r.st >= 400 || !rows(r.j)) throw Object.assign(new Error('bad-response ' + r.st + ' ' + JSON.stringify(r.j || '').slice(0, 120)), { out });
      out.body = String(r.body || '').slice(0, 700);
      out.names = names(r.j);
      const pi = info(r.j), size = +pi.pageSize || 10; out.total = +pi.totalCnt || 0;
      out.first = r.j;
      return { out, r, size };
    };
    const pageAll = async (court, s) => {
      const { out, r, size } = s;
      const g0 = seen.size;
      take(r.j, court); out.pages = 1;
      const pages = Math.min(MAX_PAGES, Math.ceil(out.total / size));
      for (let n = 2; n <= pages; n++) {
        await sleep(jitter(2500, 4000));
        let r2;
        try { r2 = await ask(() => clickPage(n)); } catch (e) { out.err = String(e.message); break; }
        if (!r2 || r2.none || !rows(r2.j)) { out.err = `page${n}-${r2 && r2.none ? 'no-button' : 'no-response'}`; log(court, out.tag, n, out.err); break; }
        take(r2.j, court); out.pages++;
      }
      out.got = seen.size - g0;
      delete out.first;
      return out;
    };

    await open();
    for (const court of COURTS) {
      if (stop) { res.courts.push({ court, ok: false, err: stop }); continue; }
      const c = { court, ok: false, total: null, got: 0, pages: 0, tries: [] };
      res.courts.push(c);
      const want = (nm) => Object.keys(nm || {}).every((k) => k === court);
      try {
        // ① 화면에서 법원 고르기(라벨)
        let s = null;
        try { s = await search(court, () => pickCourt(court), 'label'); } catch (e) { c.tries.push({ tag: 'label', err: String(e.message).slice(0, 200), set: e.out && e.out.set }); if (stop) throw e; }
        if (s) log(court, '①', JSON.stringify({ set: s.out.set, total: s.out.total, names: s.out.names, body: court === COURTS[0] || court === COURTS[1] ? s.out.body : undefined }));
        // ② 0건이거나 다른 법원이 왔으면: WebSquare 컴포넌트로 값 넣고 다시
        if (!s || !s.out.total || !want(s.out.names)) {
          if (s) c.tries.push({ tag: 'label', total: s.out.total, names: s.out.names, set: s.out.set, body: s.out.body });
          s = null;
          await sleep(jitter(2500, 4000));
          try { s = await search(court, () => pickCourt(court, 'ws'), 'ws'); } catch (e) { c.tries.push({ tag: 'ws', err: String(e.message).slice(0, 200) }); if (stop) throw e; }
          if (s) log(court, '②', JSON.stringify({ set: s.out.set, total: s.out.total, names: s.out.names, body: s.out.body }));
          if (s && (!s.out.total || !want(s.out.names))) { c.tries.push({ tag: 'ws', total: s.out.total, names: s.out.names, set: s.out.set, body: s.out.body }); s = null; }
        }
        if (s) {
          const o = await pageAll(court, s);
          c.tries.push(o); c.how = o.tag; c.total = o.total; c.got = o.got; c.pages = o.pages;
          c.ok = !o.err && o.got >= o.total - Math.max(1, Math.round(o.total * 0.01));
          if (o.err) c.err = o.err;
        } else if (JUR[court]) {
          // ③ 소재지(지번주소) 서울특별시 + 관할 구마다 검색 — 결과는 그 구에 있는 물건(법원 이름은 응답대로)
          c.how = 'addr'; c.total = 0; let all = true;
          for (const gu of JUR[court]) {
            await sleep(jitter(2500, 4000));
            try {
              const s3 = await search(court, () => pickAddr(gu), 'addr:' + gu);
              log(court, '③', gu, JSON.stringify({ set: s3.out.set, total: s3.out.total, names: s3.out.names, body: s3.out.body }));
              const o = await pageAll(court, s3);
              o.names = s3.out.names; c.tries.push(o); c.total += o.total; c.got += o.got; c.pages += o.pages;
              if (o.err || o.got < o.total - 1) all = false;
            } catch (e) {
              all = false; c.tries.push({ tag: 'addr:' + gu, err: String(e.message).slice(0, 300), set: e.out && e.out.set }); log('!!', court, gu, String(e.message).slice(0, 300));
              if (stop) throw e;
            }
          }
          c.ok = all && c.total > 0;
          if (!c.ok) c.err = c.total ? 'addr-partial' : 'zero';
        } else {
          c.err = 'zero-or-mismatch';
          // 다른 법원은 0건이면 그냥 0건으로 둔다(라벨 고르기가 먹은 경우)
          const t0 = c.tries[0] || {};
          if (t0.total === 0 && t0.set && t0.set.dom && t0.set.dom.includes(court)) { c.ok = true; c.total = 0; delete c.err; }
        }
        log(court, `${c.got}/${c.total} · ${c.pages}쪽 · ${c.how || '-'}${c.err ? ' · ' + c.err : ''} · 누적 요청 ${res.used}`);
      } catch (e) {
        c.err = String(e.message || e).slice(0, 200); log('!!', court, c.err);
        try { if (process.env.AUCTION_SHOTS) await p.screenshot({ path: path.join(process.env.AUCTION_SHOTS, `err-${res.courts.length}.png`) }); } catch (e2) {}
        if (!stop && (await blockedPage())) stop = 'blocked';
      }
      if (!stop) await sleep(jitter(3000, 5000));
    }
  } catch (e) {
    res.err = String(e.message || e).slice(0, 160); log('!! 실패:', res.err);
  }
  finish();
})();
