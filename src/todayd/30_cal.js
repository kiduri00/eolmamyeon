/* 소식 › 일정: 경매 매각기일(오늘부터 14일 · 법원 공고) · 내 일정(직접 넣음 · 기기에만) · 캘린더 파일(.ics, 기기에서 만듦 · 서버 요청 0)
   개인 이름은 저장·표시하지 않는다(법원 자료도 주소·법원·사건번호·기일·감정가·최저가·유찰·용도만). 날짜는 법원 공고 또는 사용자가 넣은 것만 — 지어낸 미래 날짜 없음. */
(function () {
  "use strict";
  const Y = window.ZPT, W = Y.W, e = Y.esc;
  const MK = "zp-my-sched";   // 내 일정 [{i, d:'YYYY-MM-DD', t:'제목', z:'구역 id'}] — 이 기기에만
  const mine = () => { const v = Y.ls(MK, []); return Array.isArray(v) ? v.filter((x) => x && /^\d{4}-\d\d-\d\d$/.test(x.d) && x.t) : []; };
  let AJ = null, AP = null, flt = "", form = false;
  const aLoad = (ctx) => AJ ? Promise.resolve(AJ) : AP || (AP = fetch(`data/auction.json?v=${(ctx.D.dv && ctx.D.dv.auction) || ""}`).then((r) => (r.ok ? r.json() : null)).then((j) => { AJ = j || {}; return AJ; }).catch(() => { AP = null; return {}; }));
  const won = (v) => (v >= 1e8 ? `${(Math.round(v / 1e6) / 100).toLocaleString("ko-KR")}억` : `${Math.round(v / 1e4).toLocaleString("ko-KR")}만`);
  const dd = (n) => (n === 0 ? "D-day" : `D-${n}`);
  const COURT = (c) => String(c || "").replace(/^서울/, "").replace(/지방법원$/, "지법");
  function rows(ctx, T) {
    const td = Y.day(), end = Y.add(td, 14);
    const det = new Map(); Object.values((AJ && AJ.byZone) || {}).forEach((L) => (L || []).forEach((x) => det.set(x.cs + "|" + x.date, x)));
    let fav = []; try { fav = ctx.pins.list(); } catch (er) {}
    const c = ctx.cash(), seen = new Set();
    return ((T && T.auc) || []).map(Y.aucN).filter((a) => a.d >= td && a.d <= end).map((a) => {
      const x = a.full ? { addr: "", court: a.court, time: a.time, appr: a.appr, use: a.use } : det.get(a.cs + "|" + a.d) || {}, k = a.cs + "|" + (a.no || "") + "|" + a.d;
      const mn = a.min;
      return { id: a.id, cs: a.cs + (a.no > 1 ? `(${a.no})` : ""), d: a.d, min: mn, fail: a.fail, st: a.st || x.st || "", j: a.j, prev: a.prev, x, fav: fav.includes(a.id), inC: mn != null && mn <= c + 1e-9, k, dup: seen.has(k) ? 1 : (seen.add(k), 0) };
    }).filter((r) => !r.dup);
  }
  function icsOf(ctx, L, M) {
    // RFC 5545 · 시간대 Asia/Seoul(일광 절약 없음) · 줄 75바이트 접기 · 개인 이름 없음
    const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    const fold = (l) => { const out = []; let cur = "", n = 0; for (const ch of l) { const b = new TextEncoder().encode(ch).length; if (n + b > 74) { out.push(cur); cur = " " + ch; n = 1 + b; } else { cur += ch; n += b; } } out.push(cur); return out.join("\r\n"); };
    const st = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"), D8 = (d) => d.replace(/-/g, "");
    const host = location.hostname || "jaegaepick";
    const ev = L.map((r) => { const t = (r.x.time || "10:00").replace(":", "") + "00", nm = Y.name(ctx, r.id); return ["BEGIN:VEVENT", `UID:auc-${r.cs}-${D8(r.d)}@${host}`, `DTSTAMP:${st}`, `DTSTART;TZID=Asia/Seoul:${D8(r.d)}T${t}`, "DURATION:PT1H", `SUMMARY:${esc(`경매 매각기일 · ${r.cs}${nm ? ` · ${nm}` : ""}`)}`, `LOCATION:${esc(r.x.court || "")}`, `DESCRIPTION:${esc(`${r.x.addr ? r.x.addr + " · " : ""}${r.x.use ? r.x.use + " · " : ""}최저가 ${Y.cashT(ctx, r.min)}(유찰 ${r.fail || 0}회) · 최저가는 낙찰가가 아니에요 · 권리분석 필요 · 법원 공고에서 확인하세요`)}`, "END:VEVENT"]; })
      .concat(M.map((m) => ["BEGIN:VEVENT", `UID:my-${m.i}@${host}`, `DTSTAMP:${st}`, `DTSTART;VALUE=DATE:${D8(m.d)}`, `DTEND;VALUE=DATE:${D8(Y.add(m.d, 1))}`, `SUMMARY:${esc(m.t)}`, `DESCRIPTION:${esc(W.mine)}`, "END:VEVENT"]));
    const all = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${ctx.BRAND}//today//KO`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VTIMEZONE", "TZID:Asia/Seoul", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0900", "TZOFFSETTO:+0900", "TZNAME:KST", "END:STANDARD", "END:VTIMEZONE"].concat(...ev, ["END:VCALENDAR"]);
    return all.map(fold).join("\r\n") + "\r\n";
  }
  Y.icsOf = icsOf;
  async function save(ctx, L, M) {
    const body = (window.ZP_ics && typeof window.ZP_ics === "function") ? window.ZP_ics(L, M) : icsOf(ctx, L, M);   // A 트랙 생성기가 있으면 그것
    const name = `${ctx.BRAND}-일정-${Y.day()}.ics`, blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
    try { const f = new File([blob], name, { type: "text/calendar" }); if (Y.tapp() && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return "공유 창을 열었어요"; } } catch (er) { if (er && er.name === "AbortError") return ""; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return `캘린더 파일을 만들었어요 · ${L.length + M.length}건`;
  }
  function html(ctx, T) {
    const td = Y.day(), all = rows(ctx, T), M = mine().filter((m) => m.d >= td).sort((a, b) => (a.d < b.d ? -1 : 1));
    const L = all.filter((r) => (flt === "fav" ? r.fav : flt === "in" ? r.inC : true));
    const by = new Map(); L.forEach((r) => { if (!by.has(r.d)) by.set(r.d, []); by.get(r.d).push(r); });
    const ck = (AJ && AJ.chkd) || (T && T.asOf), age = ck ? Y.diff(ck, td) : null;
    let fav = []; try { fav = ctx.pins.list(); } catch (er) {}
    const row = (r) => {
      const gone = r.st === "gone", n = Y.diff(td, r.d), nm = Y.name(ctx, r.id);
      const tags = `<span class="cl-t">${e(W.aucTag)}</span>${r.inC ? `<span class="cl-t in">${e(W.aucIn)}</span>` : ""}${r.fav ? '<span class="cl-t fv">관심 구역</span>' : ""}${(r.fav || r.inC) && !gone ? `<b class="cl-dd">${dd(n)}</b>` : ""}`;
      return `<li class="${gone ? "gone" : ""}"><button type="button" class="nt-it cl-it" data-open="${e(r.id)}"><span class="td-rt"><b>${e(nm)}${r.x.use ? ` <small class="cl-u">${e(r.x.use)}</small>` : ""}</b><small>${e([r.cs, COURT(r.x.court), r.x.time].filter(Boolean).join(" · "))}</small><small class="cl-m">${r.x.appr ? `감정 ${e(won(r.x.appr))} · ` : ""}최저 <b>${e(Y.cashT(ctx, r.min))}</b>${r.prev && r.prev > r.min ? ` <small>(직전 ${e(Y.cashT(ctx, r.prev))})</small>` : ""} · 유찰 ${r.fail || 0}회${r.j ? " · 지분 물건" : ""}${gone ? " · 변경·취하 등으로 목록에서 빠졌어요(법원 공고 확인 필요)" : ""}</small><span class="cl-tags">${tags}</span></span></button></li>`;
    };
    const myRow = (m) => { const n = Y.diff(td, m.d); return `<li><span class="td-rt"><b>${e(m.t)}</b><small>${e(Y.md(m.d))}${m.z && ctx.byId[m.z] ? ` · ${e(Y.name(ctx, m.z))}` : ""} · ${e(W.mine)}</small></span><b class="cl-dd">${dd(n)}</b><button type="button" class="cl-x" data-cldel="${e(m.i)}" aria-label="${e(m.t)} 일정 지우기">지우기</button></li>`; };
    const exp = L.filter((r) => (r.fav || r.inC) && r.st !== "gone");
    return `<div class="nt-h"><h3>일정</h3><span class="td-as">오늘 ${e(Y.md(td))}</span></div>` +
      `<section class="wk-c"><div class="cl-h"><h4>내 일정</h4><button type="button" class="btn text sm" data-cladd aria-expanded="${form}">${form ? "닫기" : "일정 넣기"}</button></div>` +
      (form ? `<form class="cl-f" data-clform><label>날짜<input type="date" name="d" required min="${td}"></label><label>내용<input type="text" name="t" required maxlength="30" placeholder="예: 조합 총회 · 분양신청 마감"></label>${fav.length ? `<label>구역(선택)<select name="z"><option value="">고르지 않음</option>${fav.filter((id) => ctx.byId[id]).map((id) => `<option value="${e(id)}">${e(Y.name(ctx, id))}</option>`).join("")}</select></label>` : ""}<button type="submit" class="btn primary sm">넣기</button><p class="nt-sub">총회·감정평가·분양신청 날짜는 조합 공지에서 직접 넣어 주세요 · 이 기기에만 저장돼요</p></form>` : "") +
      (M.length ? `<ul class="cl-my">${M.map(myRow).join("")}</ul>` : `<p class="nt-sub">조합 문자로 받은 날짜를 넣어 두면 D-day로 보여 드려요</p>`) + `</section>` +
      `<section class="wk-c"><h4>경매 매각기일 <small>오늘부터 14일 · 구역 안 물건</small></h4><p class="cl-warn">${e(W.aucHead)}</p>` +
      (ck ? `<p class="nt-sub${age > 3 ? " cl-old" : ""}">법원 공고 마지막 확인 ${e(Y.md(ck))}${age > 0 ? ` · ${age}일 전` : ""}${age > 3 ? " · 그 뒤 바뀐 기일은 법원 공고에서 확인하세요" : ""}</p>` : "") +
      `<div class="nt-chips" role="group" aria-label="경매 거르기">${[["", "전체", all.length], ["fav", "관심 구역", all.filter((r) => r.fav).length], ["in", "최저가 내 돈 안", all.filter((r) => r.inC).length]].map(([k, l, n]) => `<button type="button" data-clf="${k}" aria-pressed="${k === flt}">${l} <small>${Y.n(n)}</small></button>`).join("")}</div>` +
      (L.length ? `<ol class="nt-list">${[...by].map(([d, rs]) => `<li><h4 class="nt-dh">${e(Y.md(d))} <span class="nt-td">${dd(Y.diff(td, d))}</span><small>${rs.length}건</small></h4><ul>${rs.map(row).join("")}</ul></li>`).join("")}</ol>` : `<p class="nt-empty">${flt ? "이 조건의 매각기일이 14일 안에 없어요" : "14일 안에 잡힌 구역 안 매각기일이 없어요"}</p>`) + `</section>` +
      `<section class="wk-c cl-exp"><h4>캘린더로 보내기</h4><p class="nt-sub">내 일정 ${M.length}건과 관심 구역·최저가 내 돈 안 경매 ${exp.length}건을 .ics 파일로 만들어요 · 파일은 이 기기에서 만들고 서버로 보내지 않아요</p><button type="button" class="btn secondary sm" data-clics${M.length + exp.length ? "" : " disabled"}>캘린더 파일 만들기</button><span class="share-fb" role="status" data-clfb></span></section>`;
  }
  let bound = false;
  Y.cal = (ctx) => {
    const el = document.getElementById("nwCal"); if (!el) return; Y.css();
    ctx.today.load().then((T) => (T && T.auc && T.auc[0] && T.auc[0].length >= 11 ? [T] : aLoad(ctx).then(() => [T]))).then(([T]) => {
      const draw = () => { el.innerHTML = T ? html(ctx, T) : `<p class="nt-empty">일정 자료를 불러오지 못했어요${navigator.onLine === false ? " · 오프라인" : ""}</p>`; };
      draw();
      if (bound) return; bound = true;
      el.addEventListener("click", async (ev) => {
        const t = ev.target.closest("button"); if (!t || t.type === "submit") return;
        if (t.hasAttribute("data-clf")) { flt = t.dataset.clf; draw(); const b = el.querySelector(`[data-clf="${flt}"]`); if (b) b.focus({ preventScroll: true }); }
        else if (t.hasAttribute("data-cladd")) { form = !form; draw(); const i = el.querySelector('[name="d"]'); if (i) i.focus(); else { const b = el.querySelector("[data-cladd]"); b && b.focus(); } }
        else if (t.hasAttribute("data-cldel")) { Y.lsw(MK, mine().filter((m) => String(m.i) !== t.dataset.cldel)); draw(); const b = el.querySelector("[data-cladd]"); b && b.focus(); }
        else if (t.hasAttribute("data-clics")) { const td = Y.day(), L = rows(ctx, T).filter((r) => (r.fav || r.inC) && r.st !== "gone"), M = mine().filter((m) => m.d >= td); const m = await save(ctx, L, M); const fb = el.querySelector("[data-clfb]"); if (fb) fb.textContent = m; }
      });
      el.addEventListener("submit", (ev) => {
        const f = ev.target.closest("[data-clform]"); if (!f) return; ev.preventDefault();
        const d = f.d.value, tt = String(f.t.value || "").trim().slice(0, 30), z = f.z ? f.z.value : "";
        if (!/^\d{4}-\d\d-\d\d$/.test(d) || !tt) return;
        const L = mine(); L.push({ i: Date.now().toString(36), d, t: tt, z }); Y.lsw(MK, L.slice(-50)); form = false; draw();
        const b = el.querySelector("[data-cladd]"); b && b.focus();
      });
    });
  };
})();
