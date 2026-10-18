// 법원경매정보(courtauction.go.kr) 서울 5개 지방법원 부동산 기일입찰 물건 모으기 — 날마다 조금씩(증분)
// 사이트 화면을 그대로 조작한다(법원 고르기 → 기간 → 검색 → 쪽 넘김) · 응답(searchControllerMain.on)만 읽는다.
// 사이트는 매각기일을 '오늘부터 2주 안'으로만 찾게 해 주고, 많이 부르면 IP를 막는다. 그래서
//   · 처음(상태 없음·상태가 3일 넘게 묵음·그 법원을 끝까지 받은 적 없음): 법원마다 2주 전체 한 번(full)
//   · 그 뒤 날마다: 지난번 받은 끝 날 다음부터 2주 끝까지(새로 들어온 1~2일, new) + 가까운 평일 2일 다시 보기(re: 변경·취하·정지 찾기)
//   · 남은 요청이 넉넉하면 7일 넘게 전체를 안 받은 법원 하나를 다시 전체로(refresh)
//   · 검색 건수가 상태와 같고 첫 쪽 물건이 모두 아는 것이면 나머지 쪽은 건너뛴다(skip)
// 상태는 tools/auction_match.py가 pipeline/cache/auction_state.json에 쓴다(여기서는 읽기만).
// 사용: node tools/auction.js [출력=pipeline/raw/auction_raw.json] [상태=pipeline/cache/auction_state.json]
// 막히거나(차단·시간 초과·요청 상한) 실패해도 exit 0 — 모은 데까지 저장한다.
// 환경 변수: AUCTION_BUDGET(쪽 요청 상한, 120) · AUCTION_TIMEOUT(초, 1200) · AUCTION_MAX_PAGES(검색 하나당 쪽 상한, 150) · AUCTION_SHOTS(오류 화면 폴더) · AUCTION_FULL=1(전부 전체로)
const fs = require('fs'), path = require('path');
const OUT = path.resolve(process.argv[2] || 'pipeline/raw/auction_raw.json');
const STATE = path.resolve(process.argv[3] || 'pipeline/cache/auction_state.json');
const URL0 = 'https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151F00.xml';
const API = /\/pgj\/pgjsearch\/searchControllerMain\.on/;
const COURTS = ['서울서부지방법원', '서울중앙지방법원', '서울동부지방법원', '서울남부지방법원', '서울북부지방법원'];
const JUR = { 서울서부지방법원: ['마포구', '서대문구', '은평구', '용산구'] };   // 법원 고르기가 안 먹을 때 소재지 검색(관할 구)
const P = 'mf_wfm_mainFrame_';
const SEL_COURT = `#${P}sbx_rletCortOfc`, BTN = `#${P}btn_gdsDtlSrch`, SEL_SD = `#${P}sbx_rletAdongSdS`, SEL_SGG = `#${P}sbx_rletAdongSggS`;
const CAL_S = `${P}cal_rletPerdStr`, CAL_E = `${P}cal_rletPerdEnd`;
const MAX_PAGES = +process.env.AUCTION_MAX_PAGES || 150;
const BUDGET = +process.env.AUCTION_BUDGET || 120;
const STALE_DAYS = 3, REFRESH_DAYS = 7;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => a + Math.floor(Math.random() * (b - a));
const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const addD = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const diffD = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5);
const wday = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const ymd = (s) => s.replaceAll('-', '');
const iso = (v) => (/^\d{8}$/.test(String(v || '')) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);
const log = (...a) => console.log('[auction]', ...a);
const BLOCK = /(비정상적인\s*접(속|근)|보안정책|접근이\s*(제한|차단)|차단되었|해외\s*IP|허용되지\s*않은|Access\s*Denied|Forbidden)/i;
const save = (o) => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT + '.tmp', JSON.stringify(o)); fs.renameSync(OUT + '.tmp', OUT); };

// 오늘 할 검색 목록 만들기(상태 기준)
function plan(state, today, wEnd) {
  const S = state && state.courts ? state : { courts: {}, items: {} };
  const fresh = state && state.asOf && diffD(today, state.asOf) <= STALE_DAYS && !process.env.AUCTION_FULL;
  // 상태에 있는 '예정' 물건(법원·기일별) → 건너뛰기 판정용
  const known = {};
  for (const o of Object.values(S.items || {})) if (o && o.docid && o.court && o.date && (o.status || 'up') === 'up') (known[o.court] = known[o.court] || []).push([o.date, o.docid]);
  const exp = (court, from, to) => (known[court] || []).filter(([d]) => d >= from && d <= to).map(([, id]) => id);
  const weekdays = (from, to) => { const out = []; for (let d = from; d <= to; d = addD(d, 1)) if (wday(d) % 6) out.push(d); return out; };
  const T = [], later = [];
  for (const court of COURTS) {
    const c = (S.courts || {})[court] || {};
    if (!fresh || !c.lastFullDate || !c.through) { later.push({ court, kind: 'full', from: today, to: wEnd, exp: exp(court, today, wEnd), age: 999 }); continue; }
    // 새로 들어온 날: 지난번 끝 날 다음 ~ 2주 끝(주말뿐이면 요청 없이 덮은 것으로)
    const from = c.through >= today ? addD(c.through, 1) : today;
    if (from <= wEnd) {
      const wd = weekdays(from, wEnd);
      if (wd.length) T.push({ court, kind: 'new', from: wd[0], to: wd[wd.length - 1], cover: [from, wEnd], exp: exp(court, wd[0], wEnd) });
      else T.push({ court, kind: 'new', from, to: wEnd, noreq: true });
    }
    // 가까운 평일 2일 다시 보기(내일부터)
    const re = weekdays(addD(today, 1), addD(today, 7)).slice(0, 2);
    if (re.length) T.push({ court, kind: 're', from: re[0], to: re[re.length - 1], exp: exp(court, re[0], re[re.length - 1]) });
    const age = diffD(today, c.lastFullDate);
    if (age > REFRESH_DAYS) later.push({ court, kind: 'refresh', from: today, to: wEnd, exp: exp(court, today, wEnd), age });
  }
  later.sort((a, b) => b.age - a.age);
  return { tasks: T, later, fresh };
}

(async () => {
  const today = kst();
  let state = null;
  try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) {}
  const res = { asOf: today, ok: false, src: '법원경매정보', v: 2, used: 0, budget: BUDGET, courts: [], searches: [], items: [] };
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { log('playwright 없음 — 건너뜀'); save({ ...res, err: 'no-playwright' }); return; }
  let b, done = false, stop = '';
  const hard = setTimeout(() => { log('!! 전체 시간 초과 — 모은 것까지만 저장'); finish('timeout'); }, (+process.env.AUCTION_TIMEOUT || 1200) * 1000);
  function finish(err) {
    if (done) return; done = true; clearTimeout(hard);
    const by = {};
    for (const s of res.searches) (by[s.court] = by[s.court] || []).push(s);
    res.courts = COURTS.map((court) => { const ss = by[court] || []; return { court, ok: ss.length > 0 && ss.every((s) => s.complete), got: ss.reduce((a, s) => a + (s.got || 0), 0), how: (ss.find((s) => s.how) || {}).how, err: (ss.find((s) => s.err) || {}).err }; });
    res.ok = res.courts.every((c) => c.ok);
    if (err || stop) res.err = err || stop;
    save(res);
    log(`끝 ok=${res.ok} 물건 ${res.items.length}건 · 요청 ${res.used}/${BUDGET}${res.err ? ' · ' + res.err : ''}`);
    for (const s of res.searches) log(' ', s.court, s.kind, `${s.from}~${s.to}`, `${s.got ?? 0}/${s.total ?? '?'}`, `${s.pages || 0}쪽`, s.how || '', s.skip ? 'skip' : '', s.noreq ? '(요청 없음)' : '', s.complete ? '완료' : '미완', s.err || '');
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
      if (waiter) { const w = waiter; waiter = null; w({ st, j, body }); }
    });
    const nextResp = (ms = 40000) => new Promise((ok) => { const t = setTimeout(() => { if (waiter === f) waiter = null; ok(null); }, ms); const f = (x) => { clearTimeout(t); ok(x); }; waiter = f; });
    const blockedPage = async () => { try { return BLOCK.test(await p.evaluate(() => document.body ? document.body.innerText.slice(0, 4000) : '')); } catch (e) { return false; } };
    const popupText = () => p.evaluate(() => [...document.querySelectorAll('[class*="w2popup"],[class*="w2window"],[role="dialog"],[class*="alert"]')].filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\s+/g, ' ').trim().slice(0, 160)).filter(Boolean).join(' | ')).catch(() => '');
    const rows = (j) => (j && j.data && Array.isArray(j.data.dlt_srchResult) ? j.data.dlt_srchResult : null);
    const info = (j) => (j && j.data && j.data.dma_pageInfo) || {};
    // 요청 하나(검색·쪽 넘김 공통): 상한·차단은 여기서만 센다
    const ask = async (fire) => {
      if (stop) throw new Error(stop);
      if (res.used >= BUDGET) { stop = 'budget'; throw new Error('budget'); }
      res.used++;
      const pr = nextResp();
      if ((await fire()) === false) { waiter = null; res.used--; return { none: true }; }
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
    const getPeriod = () => p.evaluate(([a, b]) => { const g = (id) => { const c = window[id]; try { return c && c.getValue ? c.getValue() : null; } catch (e) { return null; } }; return [g(a), g(b)]; }, [CAL_S, CAL_E]);
    const setPeriod = async (from, to) => {
      const r = await p.evaluate(([a, b, f, t]) => {
        const out = {};
        for (const [id, v] of [[b, t], [a, f], [b, t]]) { const c = window[id]; if (!c || typeof c.setValue !== 'function') return { err: 'no-comp ' + id }; c.setValue(v); out[id] = c.getValue ? c.getValue() : v; }
        return out;
      }, [CAL_S, CAL_E, ymd(from), ymd(to)]);
      return !r.err && r[CAL_S] === ymd(from) && r[CAL_E] === ymd(to) ? true : r;
    };
    const courtState = () => p.evaluate((id) => {
      const s = document.querySelector('#' + id), c = window[id];
      const o = s && s.selectedOptions && s.selectedOptions[0];
      let cv = null; try { cv = c && c.getValue ? c.getValue() : null; } catch (e) {}
      return { dom: o ? `${o.value}:${o.text.trim()}` : null, ws: cv };
    }, SEL_COURT.slice(1));
    const pickCourt = async (name, mode) => {
      if (mode === 'label') {
        try { await p.selectOption(SEL_COURT, { label: name }, { timeout: 8000 }); return { how: 'label', ...(await courtState()) }; } catch (e) { return { err: 'no-label' }; }
      }
      const how = await p.evaluate(([id, name]) => {
        const s = document.querySelector('#' + id); if (!s) return '';
        const o = [...(s.options || [])].find((o) => o.text.replace(/\s+/g, '') === name) || [...(s.options || [])].find((o) => o.text.includes(name.replace(/^서울|지방법원$/g, '')));
        if (!o) return '';
        const c = window[id];
        if (c && typeof c.setValue === 'function') { try { c.setValue(o.value); } catch (e) {} }
        s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true }));
        return o.value;
      }, [SEL_COURT.slice(1), name]);
      return how ? { how: 'ws', val: how, ...(await courtState()) } : { err: 'no-option' };
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
    let radioLogged = false;
    const pickAddr = async (gu) => {
      const rs = await p.evaluate(() => [...document.querySelectorAll('input[type=radio]')].filter((e) => e.id.startsWith('mf_wfm_mainFrame')).map((e) => {
        const l = document.querySelector(`label[for="${e.id}"]`);
        return { id: e.id, name: e.name, v: e.value, ck: e.checked, vis: !!e.offsetParent, lab: (l ? l.textContent : (e.parentElement && e.parentElement.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 30) };
      }));
      if (!radioLogged) { radioLogged = true; log('라디오', JSON.stringify(rs).slice(0, 900)); }
      const r = rs.find((x) => /소재지/.test(x.lab) && /지번/.test(x.lab)) || rs.find((x) => /소재지/.test(x.lab));
      if (!r) return { err: 'no-radio' };
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
      return { how: 'addr', gu, radio: r.id };
    };
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
    const seen = new Map();   // docid → 물건(같은 실행 안 중복 제거 · 마지막 응답이 이긴다)
    const take = (j, court) => { for (const it of rows(j)) { const key = it.docid || `${it.boCd}/${it.srnSaNo}/${it.maemulSer}/${it.mokmulSer}`; if (!seen.has(key)) res.items.push(seen.set(key, { ...it, _court: court }).get(key)); } };
    const names = (j) => { const m = {}; for (const it of rows(j) || []) m[it.jiwonNm] = (m[it.jiwonNm] || 0) + 1; return m; };

    // 첫 화면: 법원 칸·달력 기본값(2주 끝 날)
    await open();
    const dflt = await getPeriod();
    const wEnd = iso(dflt[1]) && diffD(iso(dflt[1]), today) >= 7 && diffD(iso(dflt[1]), today) <= 15 ? iso(dflt[1]) : addD(today, 13);
    res.win = [today, wEnd];
    const d0 = await p.evaluate((id) => { const s = document.querySelector('#' + id), c = window[id]; return { opts: s ? [...s.options].map((o) => `${o.value}:${o.text.trim()}`).filter((x) => /서울/.test(x)) : null, ws: !!c }; }, SEL_COURT.slice(1));
    log('달력 기본', JSON.stringify(dflt), '→ 2주 끝', wEnd, '· 법원 칸', JSON.stringify(d0).slice(0, 400));
    const { tasks, later, fresh } = plan(state, today, wEnd);
    log(`상태 ${state ? state.asOf : '없음'}${fresh ? '' : ' (처음/묵음 → 전체)'} · 할 일`, tasks.length, '+ 전체', later.length);

    let firstOpen = true;
    // 검색 한 번: 법원(how 순서대로) → 기간 → 검색 → 첫 쪽 판정 → 끝 쪽까지
    const howOf = {};
    for (const c of COURTS) { const h = state && state.courts && state.courts[c] && state.courts[c].how; howOf[c] = h ? [h] : []; }
    async function runTask(t) {
      const s = { court: t.court, kind: t.kind, from: t.from, to: t.to, total: 0, got: 0, pages: 0, complete: false };
      if (t.cover) s.cover = t.cover;
      res.searches.push(s);
      if (t.noreq) { s.noreq = true; s.complete = true; return; }
      const order = [...new Set([...(howOf[t.court] || []), 'label', 'ws', ...(JUR[t.court] ? ['addr'] : [])])];
      for (const how of order) {
        if (stop) { s.err = stop; return; }
        const subs = how === 'addr' ? JUR[t.court] : [null];
        let tot = 0, got = 0, pages = 0, okAll = true, bad = false, nskip = 0;
        for (const gu of subs) {
          if (!firstOpen) { await sleep(jitter(2500, 4000)); await open(); }
          firstOpen = false;
          const setup = () => (how === 'addr' ? pickAddr(gu) : pickCourt(t.court, how));
          let st = await setup();
          if (!st || st.err) { s.err = `${how}:${JSON.stringify(st).slice(0, 200)}`; bad = true; break; }
          if (!(t.from === today && t.to === wEnd)) {
            const ok = await setPeriod(t.from, t.to);
            if (ok !== true) {
              log('!! 기간 설정 실패', t.court, t.kind, JSON.stringify(ok).slice(0, 200));
              if (t.kind !== 'new') { s.err = 'period'; return; }
              // 새 날 검색인데 기간이 안 먹으면 2주 전체로
              Object.assign(t, { from: today, to: wEnd, exp: null }); Object.assign(s, { from: today, to: wEnd, fallback: 'full' });
              await open(); st = await setup();
              if (!st || st.err) { s.err = `${how}:${JSON.stringify(st).slice(0, 200)}`; bad = true; break; }
            }
          }
          const isFull = t.from === today && t.to === wEnd;
          await sleep(jitter(800, 1500));
          const r = await ask(() => p.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return false; b.click(); return true; }, BTN));
          if (!r || r.none) { s.err = 'no-response ' + (await popupText()); bad = true; break; }
          if (r.st >= 400 || !rows(r.j)) { s.err = 'bad-response ' + r.st + ' ' + JSON.stringify(r.j || '').slice(0, 120); bad = true; break; }
          const pi = info(r.j), size = +pi.pageSize || 10, total = +pi.totalCnt || 0, nm = names(r.j);
          if (res.searches.length <= 2 || how !== 'label' || t.kind === 'new') log(t.court, t.kind, how, gu || '', `${t.from}~${t.to}`, JSON.stringify({ set: st, total, names: nm, body: String(r.body || '').slice(0, 500) }));
          // 법원 이름이 다르거나(법원 고르기가 안 먹음) 전체 2주인데 0건이면 다음 방법으로
          if (how !== 'addr' && (Object.keys(nm).some((k) => k !== t.court) || (total === 0 && isFull && JUR[t.court]))) { s.err = `${how}:${total}건 ${JSON.stringify(nm)}`; bad = true; break; }
          const ids = rows(r.j).map((x) => x.docid);
          const exp = new Set(t.exp || []);
          const skip = how !== 'addr' && t.exp && total === exp.size && total > 0 && ids.every((x) => exp.has(x));
          take(r.j, t.court); pages++;
          let g = rows(r.j).length;
          if (skip) nskip++;
          else {
            const n = Math.min(MAX_PAGES, Math.ceil(total / size));
            for (let k = 2; k <= n; k++) {
              await sleep(jitter(2500, 4000));
              let r2;
              try { r2 = await ask(() => clickPage(k)); } catch (e) { s.err = String(e.message); break; }
              if (!r2 || r2.none || !rows(r2.j)) { s.err = `page${k}-${r2 && r2.none ? 'no-button' : 'no-response'}`; break; }
              take(r2.j, t.court); pages++; g += rows(r2.j).length;
            }
          }
          tot += total; got += skip ? total : g;
          if (!skip && g < total - Math.floor(total * 0.005)) okAll = false;
          if (stop) { okAll = false; break; }
        }
        if (bad) { if (stop) return; continue; }
        Object.assign(s, { how, total: tot, got, pages, complete: okAll });
        if (nskip) s.skip = true;
        if (okAll) delete s.err;
        howOf[t.court] = [how];
        return;
      }
    }
    for (const t of tasks) { try { await runTask(t); } catch (e) { log('!!', t.court, t.kind, e.message); } if (stop) break; }
    // 남은 요청으로 전체 받기(처음이면 꼭 · 아니면 7일 넘은 법원 하나) — 예상 쪽 수가 남은 요청보다 크면 다음 날로
    let refreshed = 0;
    for (const t of later) {
      if (stop) break;
      const need = Math.ceil(Math.max(t.exp.length, 10) / 10) + 2;
      if (t.kind === 'refresh' && (refreshed >= 1 || BUDGET - res.used < need)) continue;
      if (t.kind === 'full' && BUDGET - res.used < 3) { log('요청 상한이 모자라 다음에:', t.court); continue; }
      try { await runTask(t); } catch (e) { log('!!', t.court, t.kind, e.message); }
      if (t.kind === 'refresh') refreshed++;
    }
  } catch (e) {
    res.err = String(e.message || e).slice(0, 160); log('!! 실패:', res.err);
    try { if (process.env.AUCTION_SHOTS) await b.contexts()[0].pages()[0].screenshot({ path: path.join(process.env.AUCTION_SHOTS, 'err.png') }); } catch (e2) {}
  }
  finish();
})();
