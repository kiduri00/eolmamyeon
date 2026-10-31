/* 소식 › 일정: 경매 매각기일(법원 공고 · today.json 14일 · ZP_today.sched) · 내 일정(직접 넣음 · ZP_today.mySched, 기기에만 zp-sched) · 캘린더 파일(ZP_today.ics · 기기에서 만듦 · 서버 요청 0)
   개인 이름은 저장·표시하지 않는다(사건번호·법원·기일·감정가·최저가·유찰·용도만). D-day는 법원 기일과 사용자가 넣은 날짜에만(지어낸 미래 날짜 없음). */
(function () {
  "use strict";
  const Y = window.ZPT, Z = Y.Z, W = Y.W, U = Y.U, e = Y.esc;
  let flt = "", form = false;
  const COURT = (c) => String(c || "").replace(/^서울/, "").replace(/지방법원$/, "지법");
  function groups(ctx, T) {
    let fav = []; try { fav = ctx.pins.list(); } catch (er) {}
    const F = new Set(fav), c = ctx.cash();
    const G = Z.sched(T, { cash: c });
    G.forEach((g) => g.items.forEach((r) => { r.fav = F.has(r.id); r.inC = !!r.inT; }));
    return G;
  }
  function html(ctx, T) {
    const G = groups(ctx, T), all = G.flatMap((g) => g.items), M = Z.mySched.get().filter((m) => m.d >= T.asOf).sort((a, b) => (a.d < b.d ? -1 : 1));
    const keep = (r) => (flt === "fav" ? r.fav : flt === "in" ? r.inC : true);
    let fav = []; try { fav = ctx.pins.list(); } catch (er) {}
    const row = (r) => {
      const tags = `<span class="cl-t">${e(U.auc_tag)}</span>${r.inC ? `<span class="cl-t in">${e(W.auc.in)}</span>` : ""}${r.fav ? '<span class="cl-t fv">관심 구역</span>' : ""}${r.jb ? '<span class="cl-t">지분</span>' : ""}${(r.fav || r.inC) && r.dday ? `<b class="cl-dd">${e(r.dday)}</b>` : ""}`;
      return `<li><button type="button" class="nt-it cl-it" data-open="${e(r.id)}"><span class="td-rt"><b>${e(Y.name(ctx, r.id))}${r.use ? ` <small class="cl-u">${e(r.use)}</small>` : ""}</b><small>${e([r.cs + (r.no > 1 ? `(${r.no})` : ""), COURT(r.court), r.time].filter(Boolean).join(" · "))}</small><small class="cl-m">감정 ${e(Z.aucAmt(r.appr))} · 최저 <b>${e(r.minT)}</b>${r.rateT ? ` (${e(r.rateT)})` : ""}${r.failT ? ` · ${e(r.failT)}` : ""}${r.dropT ? ` · ${e(r.dropT)}` : ""}</small><span class="cl-tags">${tags}</span></span></button></li>`;
    };
    const myRow = (m) => `<li><span class="td-rt"><b>${e(m.title)}</b><small>${e(Z.mdw(m.d))}${m.t ? ` ${e(m.t)}` : ""}${m.z && ctx.byId[m.z] ? ` · ${e(Y.name(ctx, m.z))}` : ""} · ${e(W.sched.mine)}</small></span><b class="cl-dd">${e(Z.dday(m.d, T.asOf))}</b><button type="button" class="cl-x" data-cldel="${e(m.k)}" aria-label="${e(m.title)} 일정 지우기">지우기</button></li>`;
    const shown = G.map((g) => ({ g, L: g.items.filter(keep) })).filter((x) => x.L.length);
    const exp = all.filter((r) => r.fav || r.inC);
    return `<div class="nt-h"><h3>${e(W.sched.head)}</h3><span class="td-as">${e(Z.asOfT(T))}</span></div>` +
      `<section class="wk-c"><div class="cl-h"><h4>${e(W.sched.mine)}</h4><button type="button" class="btn text sm" data-cladd aria-expanded="${form}">${form ? "닫기" : "일정 넣기"}</button></div>` +
      (form ? `<form class="cl-f" data-clform><label>날짜<input type="date" name="d" required min="${Y.day()}"></label><label>내용<input type="text" name="t" required maxlength="30" placeholder="예: 조합 총회 · 분양신청 마감"></label>${fav.length ? `<label>구역(선택)<select name="z"><option value="">고르지 않음</option>${fav.filter((id) => ctx.byId[id]).map((id) => `<option value="${e(id)}">${e(Y.name(ctx, id))}</option>`).join("")}</select></label>` : ""}<button type="submit" class="btn primary sm">넣기</button><p class="nt-sub">${e(W.sched.mine_note)}</p></form>` : "") +
      (M.length ? `<ul class="cl-my">${M.map(myRow).join("")}</ul>` : `<p class="nt-sub">조합 문자로 받은 총회·감정평가·분양신청 날짜를 넣어 두면 D-day로 보여 드려요</p>`) + `</section>` +
      `<section class="wk-c"><h4>경매 매각기일 <small>${e(W.sched.sub)}</small></h4><p class="cl-warn">${e(W.auc.note)}</p>` +
      `<div class="nt-chips" role="group" aria-label="경매 거르기">${[["", "전체", all.length], ["fav", "관심 구역", all.filter((r) => r.fav).length], ["in", W.auc.in, all.filter((r) => r.inC).length]].map(([k, l, n]) => `<button type="button" data-clf="${k}" aria-pressed="${k === flt}">${e(l)} <small>${Y.n(n)}</small></button>`).join("")}</div>` +
      (shown.length ? `<ol class="nt-list">${shown.map(({ g, L }) => `<li><h4 class="nt-dh">${e(g.dateT)} <span class="nt-td">${e(g.dday)}</span><small>${e(Y.f(W.sched.auc, { n: L.length }))}</small></h4><ul>${L.map(row).join("")}</ul></li>`).join("")}</ol>` : `<p class="nt-empty">${flt ? "이 조건의 매각기일이 14일 안에 없어요" : "14일 안에 잡힌 구역 안 매각기일이 없어요"}</p>`) +
      `<p class="nt-sub">${e(W.auc.src)}</p></section>` +
      `<section class="wk-c cl-exp"><h4>${e(W.sched.ics)}</h4><p class="nt-sub">${e(W.sched.mine)} ${M.length}건 · 관심 구역·${e(W.auc.in)} 경매 ${exp.length}건 · ${e(W.sched.ics_note)}</p><button type="button" class="btn secondary sm" data-clics${M.length + exp.length ? "" : " disabled"}>캘린더 파일 만들기</button><span class="share-fb" role="status" data-clfb></span></section>`;
  }
  let bound = false;
  Y.cal = (ctx) => {
    const el = document.getElementById("nwCal"); if (!el) return; Y.css();
    const T = Y.T();
    const draw = () => { el.innerHTML = T ? html(ctx, T) : `<p class="nt-empty">일정 자료를 불러오지 못했어요${navigator.onLine === false ? " · 오프라인" : ""}</p>`; };
    draw();
    if (bound || !T) return; bound = true;
    el.addEventListener("click", (ev) => {
      const t = ev.target.closest("button"); if (!t || t.type === "submit") return;
      if (t.hasAttribute("data-clf")) { flt = t.dataset.clf; draw(); const b = el.querySelector(`[data-clf="${flt}"]`); if (b) b.focus({ preventScroll: true }); }
      else if (t.hasAttribute("data-cladd")) { form = !form; draw(); const i = el.querySelector('[name="d"]'); if (i) i.focus(); else { const b = el.querySelector("[data-cladd]"); b && b.focus(); } }
      else if (t.hasAttribute("data-cldel")) { Z.mySched.remove(t.dataset.cldel); draw(); const b = el.querySelector("[data-cladd]"); b && b.focus(); }
      else if (t.hasAttribute("data-clics")) {
        const rows = groups(ctx, T).flatMap((g) => g.items).filter((r) => r.fav || r.inC);
        const evs = Z.icsAuc(rows, (id) => Y.name(ctx, id)).concat(Z.icsMine().filter((x) => x.date >= T.asOf));
        Z.icsDownload(evs, `jaegaepick-${T.asOf}.ics`);
        const fb = el.querySelector("[data-clfb]"); if (fb) fb.textContent = `캘린더 파일을 만들었어요 · ${evs.length}건`;
      }
    });
    el.addEventListener("submit", (ev) => {
      const f = ev.target.closest("[data-clform]"); if (!f) return; ev.preventDefault();
      if (!Z.mySched.add({ d: f.d.value, title: String(f.t.value || "").trim().slice(0, 30), z: f.z ? f.z.value : "" })) return;
      form = false; draw(); const b = el.querySelector("[data-cladd]"); b && b.focus();
    });
  };
})();
