/* ===================== 사이클 5(A): 오늘 묶음 API — window.ZP_today (지연 묶음 /b/n.*.js) =====================
   첫 화면 묶음(a·ta)에 넣지 않는다. 홈 오늘 카드·소식 '서울 오늘'·일정·내 돈 레이더(D 트랙)가 화면에 보일 때 INBOX.today()로 받는다.
   숫자는 data/today.json(tools/today.py) 그대로 · 문장은 문구 사전(tools/feed_words.json → FW) 한 곳 · 판정은 앱 zstate(ctx로 받음).
   node에서도 돈다(tools/qa_today.js가 같은 함수로 30일 재생 · 숫자 대조): window가 없으면 globalThis에 붙는다.
   개인 이름·서버 요청 없음: ICS 파일은 이 기기에서 만들어 내려받는다(fetch 0). 직접 넣은 일정은 localStorage zp-sched에만. */
(function (G) {
  "use strict";
  const FW = "__FEED_WORD__";
  const W = typeof FW === "string" ? JSON.parse(FW) : FW;
  const BR = "__BRAND_EN__";
  const fmtN = (n) => Number(n).toLocaleString("ko-KR");
  const fill = (t, o) => String(t).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? (typeof o[k] === "number" && Number.isInteger(o[k]) ? fmtN(o[k]) : String(o[k])) : m));
  // 금액 꼴: 경매(원) = zsample.auc_amt · ZF.aucAmt와 같은 규칙(첫째 자리 반올림 · 1억 아래 만 단위)
  const aucAmt = (v) => (v == null || !isFinite(v) || v <= 0 ? "–" : v >= 1e8 ? `${(Math.floor(v / 1e7 + 0.5) / 10).toLocaleString("ko-KR")}억` : `${Math.floor(v / 1e4 + 0.5).toLocaleString("ko-KR")}만`);
  const md = (d) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || ""); return m ? `${+m[2]}.${+m[3]}` : ""; };
  const mdw = (d) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || ""); if (!m) return ""; const t = new Date(Date.UTC(+m[1], m[2] - 1, +m[3])); return `${+m[2]}.${+m[3]}(${"일월화수목금토"[t.getUTCDay()]})`; };
  const dnum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
  const NEWK = ["trade", "notice", "stage", "auc_new", "auc_drop"];   // '새로 올라온' 숫자(허가는 하루 늦은 자료 · 매각기일은 일정이라 뺌)
  let T = null, TP = null;
  function load(url) {
    if (T) return Promise.resolve(T);
    if (TP) return TP;
    // 주소는 changes.json과 같은 버전 규칙(data/today.json?v=<upd>-<dv> · INBOX.today가 url을 채움) → 서비스 워커 DATA 캐시(swr)를 탄다
    TP = fetch(url || G.ZP_today.url || "/data/today.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error("today " + r.status)))).then((j) => (T = j)).catch((e) => { TP = null; throw e; });
    return TP;
  }
  const use = (t) => { T = t; return t; };
  // ---------- 홈 카드 줄 ----------
  function seoul(t) {
    t = t || T; const d = (t && t.seoul && t.seoul.d) || {}, w = (t && t.seoul && t.seoul.w) || {};
    const parts = W.home.seoul.filter(([k]) => d[k] > 0).map(([k, tp]) => ({ k, n: d[k], t: fill(tp, { n: d[k] }) }));
    const nNew = NEWK.reduce((a, k) => a + (d[k] || 0), 0), nWeek = NEWK.reduce((a, k) => a + (w[k] || 0), 0);
    const quiet = nNew === 0;   // 0건을 크게 쓰지 않는다: 이번 주 묶음으로
    const tho = d.tho > 0 && t.tho_d && t.tho_d !== t.asOf ? fill(W.home.tho_d, { d: md(t.tho_d) }) : "";
    return { head: fill(W.home.head, { d: mdw(t.asOf) }), parts, quiet, quietT: quiet ? fill(W.home.quiet, { n: nWeek }) : "", week: nWeek, weekT: fill(W.home.week, { n: nWeek }), tho, bf: bfLine(t), asOf: t.asOf,
      text: quiet ? [fill(W.home.quiet, { n: nWeek })].concat(parts.filter((p) => p.k === "tho" || p.k === "auc_sale").map((p) => p.t)).join(" · ") : parts.map((p) => p.t).join(" · ") };
  }
  // 기준일은 기기 날짜가 아니라 today.json asOf(오프라인일 때도 같은 날짜) — D-day도 asOf 기준
  const offLine = (t) => fill(W.home.off, { d: md((t || T).asOf) });
  const asOfT = (t) => fill(W.home.asof, { d: md((t || T).asOf) });
  function bfLine(t) { t = t || T; const b = (t && t.seoul && t.seoul.bf) || {}; const n = Object.values(b).reduce((a, v) => a + (+v || 0), 0); return n > 0 ? fill(W.home.bf, { n }) : ""; }
  // 내 돈 안 줄: 오늘 거래·경매 중 ctx.ok(id)(앱 zstate 'ok')인 구역
  function mine(t, ctx) {
    t = t || T; if (!ctx || typeof ctx.ok !== "function") return null;
    let trade = 0, auc = 0;
    for (const e of t.ev || []) { if (e[2] !== t.asOf || e[4].includes("b") || !ctx.ok(e[0])) continue; if (e[1] === "trade") trade += e[5]; else if (e[1] === "auction") auc += e[5]; }
    return { trade, auc, t: fill(W.home.mine, { cash: ctx.cashT || "", mode: ctx.gap ? "전세 끼고" : "대출 끼고", trade, auc }) };
  }
  // ---------- 서울 오늘 피드 ----------
  const flagsOf = (f) => ({ hi: f.includes("h"), bf: f.includes("b"), x: f.includes("x"), drop: f.includes("d"), ok: f.includes("o") });
  function feed(t, o) {
    t = t || T; o = o || {};
    const day = o.day || t.asOf, types = o.types ? new Set(o.types) : null;
    return (t.ev || []).filter((e) => (o.week ? true : e[2] === day) && (!types || types.has(e[1])) && (o.bf ? e[4].includes("b") : !e[4].includes("b")) && (!o.ok || o.ok(e[0])))
      .map((e) => { const f = flagsOf(e[4]); return { id: e[0], type: e[1], date: e[2], text: e[3], n: e[5], ...f, tag: f.x ? W.x.tag : "", chip: W.chip[e[1]] || "" }; });
  }
  // 목록 건수(서울 줄 숫자와 같은 셈) — QA today.same
  function feedCount(t, day) {
    t = t || T; day = day || t.asOf; const c = { trade: 0, hi: 0, notice: 0, stage: 0, tho: 0, auc_new: 0, auc_drop: 0 };
    for (const e of t.ev || []) {
      if (e[2] !== day || e[4].includes("b")) continue;
      if (e[1] === "trade") { c.trade += e[5]; if (e[4].includes("h") && !e[4].includes("x")) c.hi++; }
      else if (e[1] === "auction") c[e[4].includes("d") ? "auc_drop" : "auc_new"] += e[5];
      else if (e[1] === "tho") c.tho += e[5];
      else c[e[1]]++;
    }
    return c;
  }
  // ---------- 일정(경매 매각기일 · 출처 있는 날짜만) ----------
  const dday = (d, asOf) => { if (!/^\d{4}-\d\d-\d\d$/.test(d || "") || !asOf) return ""; const n = dnum(d) - dnum(asOf); return n === 0 ? W.sched.d0 : n > 0 ? fill(W.sched.dday, { n }) : ""; };
  function aucRow(a, t) {
    const [id, cs, no, date, time, min, appr, fail, rate, court, use, fl, pm] = a;
    return { id, cs, no, date, time, min, appr, fail, rate, court, use, jb: fl.includes("j"), pm, dday: dday(date, t.asOf),
      minT: aucAmt(min), rateT: rate > 0 && rate < 100 ? fill(W.auc.rate, { r: rate }) : "", failT: fail > 0 ? fill(W.auc.fail, { f: fail }) : "",
      dropT: pm && min < pm ? fill(W.auc.drop, { f: fail || 0, a: aucAmt(pm), b: aucAmt(min) }) : "", inT: "" };
  }
  function sched(t, o) {
    t = t || T; o = o || {};
    const rows = (t.auc || []).map((a) => aucRow(a, t)).filter((r) => (!o.ids || o.ids.has(r.id)) && (o.today ? true : r.date >= t.asOf));
    if (o.cash != null) rows.forEach((r) => { if (r.min > 0 && r.min <= o.cash * 1e8 + 1) r.inT = W.auc.in; });
    const by = new Map(); rows.forEach((r) => { if (!by.has(r.date)) by.set(r.date, []); by.get(r.date).push(r); });
    return [...by.entries()].map(([date, items]) => ({ date, dateT: mdw(date), dday: dday(date, t.asOf), n: items.length, t: fill(W.sched.auc, { n: items.length }), items }));
  }
  // ---------- 내 돈 레이더(7일 비교 · 판정은 앱 zstate) ----------
  //   ctx: {cash(억), gap(전세 끼고?), zstate(id) → {st, need, gap}, mute?: Set, ids?: 전체 구역 id(조금만 더 계산용)}
  function radar(t, ctx) {
    t = t || T; const m = ctx.gap ? "g" : "c", R = (t.rad && t.rad[m]) || {}, cash = ctx.cash, mute = ctx.mute || new Set();
    const nw = [], far = [], near = [];
    const zs = (id) => { try { return ctx.zstate(id) || null; } catch (e) { return null; } };
    for (const [id, v] of Object.entries(R)) {
      if (mute.has(id)) continue;
      const [old, now, why] = v, z = zs(id); if (!z || !why) continue;
      if (old > cash + 1e-9 && now <= cash + 1e-9 && z.st === "ok") nw.push({ id, old, now, why });
      else if (old <= cash + 1e-9 && now > cash + 1e-9 && z.st !== "ok") far.push({ id, old, now, why });
    }
    for (const id of ctx.ids || []) {
      if (mute.has(id)) continue;
      const z = zs(id); if (z && z.st === "near" && z.need != null && z.need - cash <= 0.3 + 1e-9) near.push({ id, need: z.need, gap: z.need - cash });
    }
    near.sort((a, b) => a.gap - b.gap || a.need - b.need);
    nw.sort((a, b) => a.now - b.now); far.sort((a, b) => a.now - b.now);
    return { head: W.rad.head, nw, far, near: near.slice(0, 5), none: !nw.length && !far.length ? W.rad.none : "", W: W.rad };
  }
  const isNew = (t, id, ctx) => { t = t || T; const v = t && t.rad && t.rad[ctx.gap ? "g" : "c"] && t.rad[ctx.gap ? "g" : "c"][id]; return !!(v && v[2] && v[0] > ctx.cash + 1e-9 && v[1] <= ctx.cash + 1e-9 && ctx.need != null && ctx.need <= ctx.cash + 1e-9); };
  // ---------- 직접 넣은 일정(이 기기에만) ----------
  const SK = "zp-sched";
  const mySched = {
    get() { try { const v = JSON.parse(localStorage.getItem(SK) || "[]"); return Array.isArray(v) ? v.filter((x) => x && /^\d{4}-\d\d-\d\d$/.test(x.d) && x.title) : []; } catch (e) { return []; } },
    add(x) { const L = mySched.get(); const it = { k: "u" + Date.now().toString(36), d: String(x.d), t: /^\d\d:\d\d$/.test(x.t || "") ? x.t : "", title: String(x.title || "").slice(0, 60), z: x.z || "" }; if (!/^\d{4}-\d\d-\d\d$/.test(it.d) || !it.title) return null; L.push(it); try { localStorage.setItem(SK, JSON.stringify(L.slice(-50))); } catch (e) {} return it; },
    remove(k) { try { localStorage.setItem(SK, JSON.stringify(mySched.get().filter((x) => x.k !== k))); } catch (e) {} },
  };
  // ---------- 캘린더 파일(RFC 5545 · Asia/Seoul · 기기에서 만듦) ----------
  const icsEsc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  function fold(line) {   // 75옥텟마다 접기(UTF-8 글자를 자르지 않음)
    const enc = (s) => new TextEncoder().encode(s).length; if (enc(line) <= 75) return line;
    const out = []; let cur = "", lim = 75;
    for (const ch of line) { if (enc(cur + ch) > lim) { out.push(cur); cur = " " + ch; lim = 75; } else cur += ch; }
    out.push(cur); return out.join("\r\n");
  }
  const ymd = (d) => d.replace(/-/g, "");
  const nextDay = (d) => new Date((dnum(d) + 1) * 864e5).toISOString().slice(0, 10);
  const uidOf = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
  // ev: [{kind:'auc'|'mine', date, time?, title, place?, desc?, key}]
  function ics(evs, now) {
    const st = (now ? new Date(now) : new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${BR}//today//KO`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-TIMEZONE:Asia/Seoul",
      "BEGIN:VTIMEZONE", "TZID:Asia/Seoul", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0900", "TZOFFSETTO:+0900", "TZNAME:KST", "END:STANDARD", "END:VTIMEZONE"];
    for (const e of evs || []) {
      if (!/^\d{4}-\d\d-\d\d$/.test(e.date || "")) continue;   // 출처 있는 날짜만
      L.push("BEGIN:VEVENT", `UID:${e.kind}-${uidOf(e.key || e.title + e.date)}@${BR.toLowerCase()}`, `DTSTAMP:${st}`);
      if (/^\d\d:\d\d$/.test(e.time || "")) { const hm = e.time.replace(":", ""); L.push(`DTSTART;TZID=Asia/Seoul:${ymd(e.date)}T${hm}00`, "DURATION:PT1H"); }
      else L.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(e.date))}`);
      L.push(`SUMMARY:${icsEsc(e.title)}`);
      if (e.place) L.push(`LOCATION:${icsEsc(e.place)}`);
      if (e.desc) L.push(`DESCRIPTION:${icsEsc(e.desc)}`);
      L.push("END:VEVENT");
    }
    L.push("END:VCALENDAR");
    return L.map(fold).join("\r\n") + "\r\n";
  }
  // 경매 매각기일 → 캘린더 줄(이름 = ctx.name(구역) · 사건번호·법원·최저가만 · 개인 이름 없음)
  function icsAuc(rows, name) {
    return rows.map((r) => ({ kind: "auc", key: `${r.cs}#${r.no}`, date: r.date, time: r.time, place: r.court,
      title: `${W.type.auction} 매각기일 · ${(name && name(r.id)) || ""} ${r.cs}`.replace(/\s+/g, " ").trim(),
      desc: [`최저가 ${r.minT}${r.rateT ? `(${r.rateT})` : ""}`, r.failT, r.dropT, W.auc.note, W.auc.src].filter(Boolean).join("\n") }));
  }
  const icsMine = () => mySched.get().map((x) => ({ kind: "mine", key: x.k, date: x.d, time: x.t, title: `${x.title} (${W.sched.mine})`, desc: W.sched.mine_note }));
  function icsDownload(evs, fn) {
    const blob = new Blob([ics(evs)], { type: "text/calendar;charset=utf-8" }), u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = fn || "jaegaepick-schedule.ics"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 1000);
  }
  // 푸시 미리보기 줄(worker/push.js wk와 같은 틀) — QA today.same
  const weekLine = (t) => { t = t || T; const w = t.seoul.w; return fill(W.push.wk, { trade: w.trade, notice: w.notice, auc_sale: w.auc_sale }); };
  G.ZP_today = { v: 1, W, fill, aucAmt, md, mdw, load, use, get: () => T, offLine, asOfT, seoul, mine, bfLine, feed, feedCount, sched, dday, radar, isNew, mySched, ics, icsAuc, icsMine, icsDownload, weekLine };
})(typeof window !== "undefined" ? window : globalThis);
