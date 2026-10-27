/* F2 단계 타임라인 + 다음 단계 예상 — 일정 탭 '추진 단계' 아래
   재료: 정보몽땅 인가·고시일(r.dt) · 서울 정비사업 실제 단계 전이 기간(D.stats: 인가일 기록이 있는 사업장 n곳의 25·50·75% 값)
   지난 단계: 걸린 기간 + 서울 같은 구간 가운데 값 대비 · 다음 단계: 현재 단계 인가일 + 서울 가운데 50%(25~75%) 범위 — 단정하지 않는다 */
(function () {
  "use strict";
  const F = window.ZPF;
  const NM = { 구역지정: "구역 지정", 추진위: "추진위 승인", 조합설립: "조합설립인가", 시행자지정: "사업시행자 지정", 사업시행: "사업시행인가", 관리처분: "관리처분인가", 착공: "착공", 준공: "준공" };
  const KEYS = ["구역지정", "추진위", "조합설립", "시행자지정", "사업시행", "관리처분", "착공", "준공"];
  // 현재 단계 → 다음 인가 구간(앱 ZX.pace와 같은 표)
  const NEXT = { 2: "구역지정>조합설립", 3: "추진위>조합설립", 4: "조합설립>사업시행", 5: "사업시행>관리처분", 6: "관리처분>착공", 8: "착공>준공" };
  const statOf = (ctx, r, k) => { const S = ctx.D.stats || {}; return ((/가로|소규모/.test(r.k) && S.small && S.small[k]) || (S.large && S.large[k])) || null; };
  const lvlOf = (y, st) => (!st ? null : y < st.p25 ? "fast" : y <= st.p75 ? "norm" : "slow");
  // 숫자만(화면·QA 같은 값): steps(날짜 순) · gaps(이웃한 두 단계 사이) · next(다음 인가 예상 범위)
  F.tl = (r, ctx) => {
    if (!r || r.src === "moa") return null;
    const dt = r.dt || {};
    const steps = KEYS.filter((k) => dt[k] && F.yr(dt[k]) != null && !(k === "시행자지정" && dt["조합설립"])).map((k) => ({ k, d: dt[k], y: F.yr(dt[k]) }));
    steps.sort((a, b) => a.y - b.y || KEYS.indexOf(a.k) - KEYS.indexOf(b.k));
    const gaps = [];
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1], b = steps[i], yrs = b.y - a.y;
      const ka = a.k === "시행자지정" ? "조합설립" : a.k, kb = b.k === "시행자지정" ? "조합설립" : b.k;
      const st = statOf(ctx, r, `${ka}>${kb}`);
      gaps.push({ a: a.k, b: b.k, yrs, st: st ? { n: st.n, p25: st.p25, med: st.med, p75: st.p75 } : null, lvl: yrs > 0 ? lvlOf(yrs, st) : null, same: !(yrs > 0) });
    }
    let next = null;
    const nk = !r.dn && !(r.s >= 9) ? NEXT[r.s] : null;
    if (nk) {
      const from = nk.split(">")[0], to = nk.split(">")[1];
      const fd = dt[from] || (from === "조합설립" ? dt["시행자지정"] : null), st = statOf(ctx, r, nk);
      if (fd && st && F.yr(fd) != null) {
        const y0 = F.yr(fd), lo = y0 + st.p25, hi = y0 + st.p75, now = F.asOf(ctx);
        next = { k: nk, to, fromD: fd, n: st.n, p25: st.p25, med: st.med, p75: st.p75, lo, hi, mid: y0 + st.med, state: now > hi ? "past" : now >= lo ? "in" : "before", el: now - y0, reach5y: st.reach5y || null };
      }
    }
    if (!steps.length && !next) return null;
    return { steps, gaps, next };
  };
  const LV = { fast: ["빠른 편", "ok"], norm: ["서울 보통", "mid"], slow: ["오래 걸림", "slow"] };
  const bar = (y, st) => {
    if (!st) return "";
    const mx = Math.max(y, st.p75 * 1.4, 0.5), pc = (v) => Math.max(0, Math.min(100, (v / mx) * 100)).toFixed(1);
    return `<div class="ztl-bar" aria-hidden="true"><span class="b" style="left:${pc(st.p25)}%;width:${(pc(st.p75) - pc(st.p25)).toFixed(1)}%"></span><span class="m" style="left:${pc(st.med)}%"></span><i style="width:${pc(y)}%"></i></div>`;
  };
  F.mods.timeline = {
    key: "timeline", tab: "biz",
    run(r, pane, ctx) {
      const T = F.tl(r, ctx);
      const esc = ctx.esc;
      if (!T || (!T.gaps.length && !T.next)) { F.put(pane, "timeline", ""); return; }
      const rows = T.gaps.map((g) => {
        const lv = g.lvl && LV[g.lvl];
        const cmp = g.same ? `<small>같은 날 또는 뒤 단계가 먼저 기록됨(변경 인가로 보여요) · 기간을 재지 않았어요</small>`
          : g.st ? `<small>서울 같은 구간 가운데 ${F.dur(g.st.med)} · 보통 ${F.dur(g.st.p25)}~${F.dur(g.st.p75)} (${ctx.fmt(g.st.n)}곳)</small>` : `<small>서울 비교 자료가 없는 구간이에요</small>`;
        return `<li class="ztl-r${g.lvl ? " " + g.lvl : ""}"><div class="ztl-h"><span class="ztl-k">${esc(NM[g.a] || g.a)} <i aria-hidden="true">→</i> ${esc(NM[g.b] || g.b)}</span><b>${g.same ? "–" : F.dur(g.yrs)}</b>${lv && !g.same ? `<em class="ztl-t ${lv[1]}">${lv[0]}</em>` : ""}</div>${g.same ? "" : bar(g.yrs, g.st)}${cmp}</li>`;
      }).join("");
      const N = T.next;
      const nx = N ? `<div class="ztl-next ${N.state}">
          <div class="ztl-nh"><span>다음 단계 예상 <em class="ztl-est">추정</em></span><b>${esc(NM[N.to] || N.to)}</b></div>
          <p class="ztl-rng"><b>${F.ym(N.lo)} ~ ${F.ym(N.hi)}</b><small>가운데 ${F.ym(N.mid)}</small></p>
          <p class="ztl-why">${N.state === "past" ? `서울 같은 구간 사업장 4곳 중 3곳이 다음 단계로 넘어간 시점(${F.ym(N.hi)})이 지났어요 · ${esc(NM[N.k.split(">")[0]] || "")} ${F.ymd(N.fromD)}부터 ${F.dur(N.el)}째 · 늦어지는 중이라 위 범위보다 더 걸릴 수 있어요` : N.state === "in" ? `지금이 서울 같은 단계 사업장 가운데 50%가 다음 단계로 넘어간 기간 안이에요 · ${F.ymd(N.fromD)}부터 ${F.dur(N.el)}째` : `${F.ymd(N.fromD)} ${esc(NM[N.k.split(">")[0]] || "")}에서 서울 같은 구간 가운데 50%가 걸린 기간(${F.dur(N.p25)}~${F.dur(N.p75)})을 더한 범위예요`}</p>
          <small class="ztl-src">서울 정비사업 ${ctx.fmt(N.n)}곳의 실제 ${esc((NM[N.k.split(">")[0]] || "") + " → " + (NM[N.to] || ""))} 기간(정보몽땅 인가·고시일)으로 낸 범위 · 이 구역 사정(소송·조합 갈등·심의)은 반영하지 않아요</small>
        </div>` : "";
      const html = `<div class="sect ztl"><h3>단계별 걸린 기간 <small>정보몽땅 인가·고시일 기준 · 서울 같은 구간과 비교</small></h3>${nx}${rows ? `<ol class="ztl-l">${rows}</ol>` : ""}<p class="ztl-key" aria-hidden="true"><span><i class="kb"></i>서울 가운데 50%</span><span><i class="km"></i>가운데 값</span><span><i class="ki"></i>이 구역</span></p></div>`;
      F.put(pane, "timeline", html, (n) => { const lad = pane.querySelector(".ladder"); const sec = lad && lad.closest(".sect"); if (sec) sec.after(n); else pane.appendChild(n); });
    },
  };
})();
