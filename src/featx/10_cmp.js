/* F6 구역 비교 — 2~4곳을 나란히(관심 구역 밖에서도 담는다 · 이 기기 localStorage 'zp-cmp')
   항목: 지금 필요한 돈 · 입주까지 현금 · 언제 입주 · 단계(몇 년째) · 입주권 판정(진단 요약) · 권리산정기준일 · 가까운 역 · 가격 흐름(3.3㎡당 · 최근 2년 선)
   값은 모두 시트와 같은 함수: ctx.shown(첫 칸 판정) · ctx.etaShow · ctx.win(입주권) · ctx.rights · ctx.ZF.u33 · ctx.spark
   돈은 고른 사는 방식 한 가지로만(전세 끼고면 대출 끼고 값은 섞지 않고 '전세 끼고 불가') · 공유 주소 ?cmp=id.id(+ 내 조건) */
(function () {
  "use strict";
  const X = window.ZPX;
  const KEY = "zp-cmp", MAX = 4;
  X.cmpIds = () => { const a = X.get(KEY, []); return Array.isArray(a) ? a.filter((x) => typeof x === "string").slice(0, MAX) : []; };
  X.cmpSet = (ids) => { X.set(KEY, [...new Set(ids)].slice(0, MAX)); try { window.dispatchEvent(new Event("zp:cmp")); } catch (e) {} };
  const HOLD = { nt: "입주권 없음", done: "사업 끝", moa: "사업구역별", hold: "계산 보류" };
  // 숫자·글자만(화면·QA 같은 값)
  X.cmpRows = (ids, ctx) => {
    const Z = ids.map((id) => ctx.byId[id]).filter(Boolean);
    return Z.map((r) => {
      let w = null; try { w = ctx.shown(r); } catch (e) {}
      const gap = ctx.gap(), lnowOff = w && w.kind === "lnow" && gap;
      const now = w && w.v != null && !lnowOff ? w.v : null;
      const tot = w && (w.kind === "need" || (w.kind === "lnow" && !gap)) ? (w.total ?? null) : null;
      const nowTxt = now != null ? ctx.ZF.cash(now) : lnowOff ? "전세 끼고 불가" : HOLD[(w && w.kind) || "hold"] || "계산 보류";
      let win = null; try { win = ctx.win(r); } catch (e) {}
      let rt = null; try { rt = ctx.rights(r); } catch (e) {}
      let p = null; try { p = ctx.pace(r); } catch (e) {}
      const u = ctx.ZF.u33 ? ctx.ZF.u33(r) : null;
      return {
        id: r.id, name: ctx.shortName(r.n), gu: r.g, kind: ctx.SHAPE[ctx.shape(r)] || "",
        now, nowTxt, tot, totTxt: tot != null ? ctx.ZF.cash(tot) : "계산 보류",
        eta: (() => { try { return ctx.etaShow(r); } catch (e) { return "–"; } })(),
        stage: ctx.stageName(r), stageYrs: p && p.yrs != null ? ctx.ZF.dur(p.yrs) : null,
        win: win ? { cls: win.cls, t: win.t } : null,
        rd: rt && rt.k === "set" ? rt.d + (rt.old || rt.c === "low" ? "? 추정" : "") : rt && rt.k === "pre" ? "아직 없음" : "확인 필요",
        st: r.st && r.st.n ? `${r.st.n} 걸어서 ${ctx.ZF.walkMin(r.st.d)}분` : "–",
        u33: u ? u.v : null, spark: ctx.spark ? ctx.spark(r.id) : "",
      };
    });
  };
  const best = (vals) => { const v = vals.filter((x) => x != null); if (v.length < 2) return null; const m = Math.min(...v); return v.every((x) => x === m) ? null : m; };
  X.cmpHTML = (ids, ctx) => {
    const esc = ctx.esc, L = X.cmpRows(ids, ctx);
    const mode = ctx.gap() ? "전세 끼고" : "대출 끼고";
    if (L.length < 2) return `<p class="zx-empty">비교할 구역을 2곳 이상 담아 주세요. 구역 시트 아래 <b>'비교에 담기'</b>를 누르면 여기 모여요(최대 ${MAX}곳 · 관심 구역이 아니어도 돼요).</p>${L.length ? `<ul class="zx-chips">${L.map((z) => `<li>${esc(z.name)} <button type="button" data-cx-rm="${esc(z.id)}" aria-label="${esc(z.name)} 비교에서 빼기">×</button></li>`).join("")}</ul>` : ""}`;
    const bn = best(L.map((z) => z.now)), bt = best(L.map((z) => z.tot));
    const td = (v, b, html) => `<td${b != null && v === b ? ' class="zx-b1"' : ""}>${html}</td>`;
    const row = (lab, f) => `<tr><th scope="row">${lab}</th>${L.map(f).join("")}</tr>`;
    const winC = { ok: "ok", no: "no", chk: "chk", warn: "chk" };
    return `<p class="zx-base">비교 기준: <b>${mode}</b> · 내 돈 ${ctx.ZF.cash(ctx.cash())} · 계산기에 넣은 조건 그대로 · 굵은 값이 가장 적은 돈 · 모두 추정</p>
      <div class="zx-tw"><table class="zx-t"><caption class="sr-only">구역 ${L.length}곳 비교</caption>
      <thead><tr><th scope="col"><span class="sr-only">항목</span></th>${L.map((z) => `<th scope="col"><a href="#${esc(z.id)}" data-cx-go="${esc(z.id)}">${esc(z.name)}</a><small>${esc(z.gu)} · ${esc(z.kind)}</small><button type="button" class="zx-rm" data-cx-rm="${esc(z.id)}" aria-label="${esc(z.name)} 비교에서 빼기">빼기</button></th>`).join("")}</tr></thead>
      <tbody>
        ${row(`지금 필요한 돈<small>${mode}</small>`, (z) => td(z.now, bn, z.now != null ? `<b>${esc(z.nowTxt)}</b>` : `<span class="zx-na">${esc(z.nowTxt)}</span>`))}
        ${row("입주까지 현금", (z) => td(z.tot, bt, z.tot != null ? esc(z.totTxt) : '<span class="zx-na">계산 보류</span>'))}
        ${row("언제 입주<small>추정</small>", (z) => `<td>${esc(z.eta)}</td>`)}
        ${row("단계", (z) => `<td>${esc(z.stage)}${z.stageYrs ? `<small>${esc(z.stageYrs)}째</small>` : ""}</td>`)}
        ${row("입주권<small>추정·확인 필요</small>", (z) => `<td>${z.win ? `<span class="zx-w ${winC[z.win.cls] || ""}">${esc(z.win.t)}</span>` : "–"}</td>`)}
        ${row("권리산정기준일", (z) => `<td>${esc(z.rd)}</td>`)}
        ${row("가까운 역", (z) => `<td>${esc(z.st)}</td>`)}
        ${row("가격 흐름<small>3.3㎡당 · 최근 2년</small>", (z) => `<td>${z.u33 != null ? esc(ctx.ZF.eok(z.u33)) : "–"}${z.spark ? `<span class="zx-sp">${z.spark}</span>` : ""}</td>`)}
      </tbody></table></div>
      <div class="zx-acts"><button type="button" class="btn secondary" data-cx-share>비교 링크 공유</button><span class="share-fb" data-cx-fb aria-live="polite"></span><button type="button" class="btn secondary" data-cx-clear>모두 비우기</button></div>
      <p class="zx-src">숫자는 각 구역 시트 첫 칸과 같은 계산이에요 · 입주권·권리산정기준일은 공개 자료로 낸 추정이라 조합·구청 확인이 필요해요 · 투자 권유가 아니에요</p>`;
  };
  X.cmpOpen = (ctx, ids) => {
    if (ids && ids.length) X.cmpSet(ids.filter((id) => ctx.byId[id]));
    const D = X.dlg("zxCmp", "구역 비교", X.cmpHTML(X.cmpIds(), ctx), ctx);
    const bind = () => {
      D.body.querySelectorAll("[data-cx-rm]").forEach((b) => (b.onclick = () => { X.cmpSet(X.cmpIds().filter((x) => x !== b.dataset.cxRm)); D.body.innerHTML = X.cmpHTML(X.cmpIds(), ctx); bind(); }));
      D.body.querySelectorAll("[data-cx-go]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); D.close(); setTimeout(() => ctx.open(a.dataset.cxGo), 0); }));
      const sh = D.body.querySelector("[data-cx-share]"); if (sh) sh.onclick = () => { const u = new URL(ctx.condURL()); u.searchParams.set("cmp", X.cmpIds().join(".")); u.hash = "cmp"; ctx.share(u.toString(), D.body.querySelector("[data-cx-fb]"), `구역 비교 · ${X.cmpIds().length}곳`); };
      const cl = D.body.querySelector("[data-cx-clear]"); if (cl) cl.onclick = () => { X.cmpSet([]); D.body.innerHTML = X.cmpHTML([], ctx); bind(); };
    };
    bind();
    return D;
  };
})();
