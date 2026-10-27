/* F2 단계 타임라인 + 다음 단계 예상 — 일정 탭 '추진 단계' 아래
   재료: 정보몽땅 인가·고시일(r.dt) · 서울 정비사업 실제 단계 전이 기간(ZF.stageStat: 가운데 값 = 생존분석 KM · 25·75% = 이미 넘어간 곳)
   지난 단계: 걸린 기간 + 서울 같은 구간 가운데 값 대비 · 다음 단계: 현재 단계 인가일 + 서울 가운데 50%(25~75%) 범위 — 단정하지 않는다 */
(function () {
  "use strict";
  const F = window.ZPF;
  const NM = { 구역지정: "구역 지정", 추진위: "추진위 승인", 조합설립: "조합설립인가", 시행자지정: "사업시행자 지정", 사업시행: "사업시행인가", 관리처분: "관리처분인가", 착공: "착공", 준공: "준공" };
  const KEYS = ["구역지정", "추진위", "조합설립", "시행자지정", "사업시행", "관리처분", "착공", "준공"];
  // 현재 단계 → 다음 인가 구간(앱 ZX.pace와 같은 표)
  const NEXT = { 2: "구역지정>조합설립", 3: "추진위>조합설립", 4: "조합설립>사업시행", 5: "사업시행>관리처분", 6: "관리처분>착공", 8: "착공>준공" };
  // 사이클 2: 단계 기간 통계는 앱 한 곳(ZF.stageStat · /years·진행 속도와 같은 기준: 가운데 값 = 생존분석, 보통 범위 = 이미 넘어간 곳의 25~75%)
  const statOf = (ctx, r, k) => { const s = ctx.ZF.stageStat(r, k); return s && s.med != null && s.p25 != null ? s : null; };
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
      gaps.push({ a: a.k, b: b.k, yrs, st: st ? { n: st.n, na: st.na, km: st.km, p25: st.p25, med: st.med, p75: st.p75 } : null, lvl: yrs > 0 ? lvlOf(yrs, st) : null, same: !(yrs > 0) });
    }
    let next = null;
    const nk = !r.dn && !(r.s >= 9) ? NEXT[r.s] : null;
    if (nk) {
      const from = nk.split(">")[0], to = nk.split(">")[1];
      const fd = dt[from] || (from === "조합설립" ? dt["시행자지정"] : null), st = statOf(ctx, r, nk);
      if (fd && st && F.yr(fd) != null) {
        // 사이클 2: 이미 지난 날짜를 예상으로 내지 않는다 — 경과(ctx.yrsSince · 시트 '현재 단계 N년째'와 같은 셈)에 따라
        //   before(아직 보통 범위 전): 인가일 + 서울 25~75% · in(보통 범위 안): 아직 넘어가지 않은 사업장 조건부 범위(로그정규 근사 · 모두 지금 뒤)
        //   over(75% 넘음): 날짜 없이 '보통 범위를 넘었어요' · stall(같은 단계 8년 이상 · 시트 projection과 같은 판정): 통계 범위 생략
        const y0 = F.yr(fd), el = ctx.yrsSince(fd);
        let stall = 0; try { stall = ctx.stall(r) || 0; } catch (e) {}   // 장기 정체 판정 = 시트 '산정 불가'·/z와 같은 함수(stallYrs)
        const base = { k: nk, to, fromD: fd, n: st.n, na: st.na, p25: st.p25, med: st.med, p75: st.p75, el, reach5y: st.reach5y || null };
        if (stall) next = { ...base, state: "stall", stall };
        else if (el > st.p75) next = { ...base, state: "over" };
        else if (el >= st.p25) { const c = F.condQ(el, st); next = { ...base, state: "in", lo: y0 + c[0], mid: y0 + c[1], hi: y0 + c[2] }; }
        else next = { ...base, state: "before", lo: y0 + st.p25, mid: y0 + st.med, hi: y0 + st.p75 };
      }
    }
    if (!steps.length && !next) return null;
    return { steps, gaps, next };
  };
  // 조건부 남은 기간: 서울 구간 기간을 로그정규로 근사(가운데 med · 25~75% → 시그마)하고, 지금까지 el년 안 넘어간 사업장의 25·50·75% 시점(인가일부터 년)
  //   erf는 앱(app.js eta 보정)과 같은 근사식 · 역함수는 이분법(QA 파이썬 기준식과 같은 셈)
  const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const PhiInv = (p) => { let a = -8, b = 8; for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (Phi(m) < p) a = m; else b = m; } return (a + b) / 2; };
  F.condQ = (el, st) => {
    const mu = Math.log(st.med), sg = Math.max(0.05, (Math.log(st.p75) - Math.log(st.p25)) / 1.349), F0 = Phi((Math.log(Math.max(el, 1e-6)) - mu) / sg);
    return [0.25, 0.5, 0.75].map((q) => Math.exp(mu + sg * PhiInv(F0 + q * (1 - F0))));
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
          : g.st ? `<small>서울 같은 구간 ${ctx.ZF.stageStatTxt(g.st)}</small>` : `<small>서울 비교 자료가 없는 구간이에요</small>`;
        return `<li class="ztl-r${g.lvl ? " " + g.lvl : ""}"><div class="ztl-h"><span class="ztl-k">${esc(NM[g.a] || g.a)} <i aria-hidden="true">→</i> ${esc(NM[g.b] || g.b)}</span><b>${g.same ? "–" : F.dur(g.yrs)}</b>${lv && !g.same ? `<em class="ztl-t ${lv[1]}">${lv[0]}</em>` : ""}</div>${g.same ? "" : bar(g.yrs, g.st)}${cmp}</li>`;
      }).join("");
      const N = T.next;
      const FROM = N ? esc(NM[N.k.split(">")[0]] || "") : "";
      const nx = !N ? "" : N.state === "stall" || N.state === "over" ? `<div class="ztl-next past">
          <div class="ztl-nh"><span>다음 단계 예상 <em class="ztl-est">추정·확인 필요</em></span><b>${esc(NM[N.to] || N.to)}</b></div>
          <p class="ztl-rng"><b>${N.state === "stall" ? "통계 범위를 싣지 않아요" : "보통 범위를 넘었어요"}</b></p>
          <p class="ztl-why">${N.state === "stall" ? `${FROM} ${F.ymd(N.fromD)}부터 ${F.dur(N.el)}째 같은 단계예요 · 8년 넘게 그대로인 사업장은 서울 통계로 견줄 곳이 거의 없어 예상 시점을 내지 않아요` : `${FROM} ${F.ymd(N.fromD)}부터 ${F.dur(N.el)}째 · 서울 같은 구간 사업장 가운데 50%가 걸린 기간(${ctx.ZF.durS(N.p25)}~${ctx.ZF.durS(N.p75)})을 넘었어요 · 언제 넘어갈지는 통계로 말하기 어려워요`}</p>
          <small class="ztl-src">서울 정비사업 ${ctx.fmt(N.n)}곳(아직 못 넘어간 곳 포함 · 생존분석 가운데 값 ${ctx.ZF.durS(N.med)} · <a href="years">몇 년 걸리나</a>와 같은 기준)의 실제 ${esc((NM[N.k.split(">")[0]] || "") + " → " + (NM[N.to] || ""))} 기간(정보몽땅 인가·고시일)과 견준 결과예요</small>
        </div>` : `<div class="ztl-next ${N.state}">
          <div class="ztl-nh"><span>다음 단계 예상 <em class="ztl-est">추정·확인 필요</em></span><b>${esc(NM[N.to] || N.to)}</b></div>
          <p class="ztl-rng"><b>${F.ym(N.lo)} ~ ${F.ym(N.hi)}</b><small>가운데 ${F.ym(N.mid)}</small></p>
          <p class="ztl-why">${N.state === "in" ? `${FROM} ${F.ymd(N.fromD)}부터 ${F.dur(N.el)}째 · 서울 같은 구간 사업장 가운데 이만큼 지나도 아직 넘어가지 않은 곳 기준으로 다시 낸 범위예요` : `${F.ymd(N.fromD)} ${FROM}에서 서울 같은 구간 가운데 50%가 걸린 기간(${ctx.ZF.durS(N.p25)}~${ctx.ZF.durS(N.p75)})을 더한 범위예요`}</p>
          <small class="ztl-src">서울 정비사업 ${ctx.fmt(N.n)}곳(아직 못 넘어간 곳 포함 · 생존분석 가운데 값 ${ctx.ZF.durS(N.med)} · <a href="years">몇 년 걸리나</a>와 같은 기준)의 실제 ${esc((NM[N.k.split(">")[0]] || "") + " → " + (NM[N.to] || ""))} 기간(정보몽땅 인가·고시일)으로 낸 범위 · 이 구역 사정(소송·조합 갈등·심의)은 반영하지 않아요</small>
        </div>`;
      const html = `<div class="sect ztl"><h3>단계별 걸린 기간 <small>정보몽땅 인가·고시일 기준 · 서울 같은 구간과 비교</small></h3>${nx}${rows ? `<ol class="ztl-l">${rows}</ol>` : ""}<p class="ztl-key" aria-hidden="true"><span><i class="kb"></i>서울 가운데 50%</span><span><i class="km"></i>가운데 값</span><span><i class="ki"></i>이 구역</span></p></div>`;
      F.put(pane, "timeline", html, (n) => { const lad = pane.querySelector(".ladder"); const sec = lad && lad.closest(".sect"); if (sec) sec.after(n); else pane.appendChild(n); });
    },
  };
})();
