/* 사이클 2: '이미 가진 집이면' — 일정 탭 맨 위(빌라·단독을 이미 가진 사람용)
   ① 입주권 대상 여부: 권리산정기준일(시트·매물진단과 같은 ctx.rights) 전부터 가진 집인지로만 가른다(추정·확인 필요)
   ② 다음 단계(F2 타임라인 ZPF.tl과 같은 셈) · 총회·감정평가·분양신청·관리처분 공고(정보몽땅 추진경과 data/notice.json)가 있으면 날짜와 함께
   ③ 분담금: 단일 숫자 없이 범위와 근거만 — 조합원 분양가 추정 − 감정가 × 비례율(±10%p) · 감정가는 이 구역 빌라 표본으로 낸 추정(내 집 값이 아님)
   아울러 필지 연식 지도(F8)는 두 번째 지연 묶음(/b/g)에서 그린다(이 탭을 열 때만 받음) */
(function () {
  "use strict";
  const F = window.ZPF;
  const SM = (r) => /가로|소규모|모아/.test(r.k || "") || r.src === "moa";
  // 숫자만(화면·QA 같은 값)
  F.owner = (r, ctx) => {
    if (!r || r.src === "moa" || r.s >= 9 || r.dn) return null;
    let rt = null; try { rt = ctx.rights(r); } catch (e) {}
    let x = null; try { x = ctx.calc(r); } catch (e) {}
    let rg = null;
    if (x && x.ok && isFinite(x.unitPrice) && isFinite(x.appr) && isFinite(x.ratio)) {
      const lo = x.unitPrice - x.appr * (x.ratio + 0.1), hi = x.unitPrice - x.appr * Math.max(0, x.ratio - 0.1);
      rg = { lo, hi, unit: x.unitPrice, area: x.unitArea, appr: x.appr, ratio: x.ratio };
    }
    const T = F.tl ? F.tl(r, ctx) : null;
    return { rt, rg, next: T && T.next ? T.next : null };
  };
  const signed = (v, ctx) => (v < 0 ? `${ctx.ZF.cash(-v)} 돌려받음` : ctx.ZF.cash(v));
  F.mods.owner = {
    key: "owner", tab: "biz",
    run(r, pane, ctx) {
      const o = F.owner(r, ctx);
      if (!o) { F.put(pane, "owner", ""); return; }
      const draw = (NT) => {
        if (ctx.cur() !== r || !pane.isConnected) return;
        const esc = ctx.esc, rt = o.rt, law = SM(r) ? "소규모주택정비법" : "도시정비법 제77조";
        const elig = rt && rt.k === "set"
          ? `<p><b>권리산정기준일 ${esc(rt.d)}${rt.old || rt.c === "low" ? "? (추정)" : ""}</b> 전부터 가진 집(토지·건물)이면 분양 대상이 될 수 있어요. 그 뒤에 새로 지었거나 지분을 쪼갠 집은 입주권 대신 현금청산될 수 있어요(${law}). 분양 대상은 서울시 도시정비조례 기준(주택 소유·토지 면적·권리가액)도 함께 충족해야 해요.</p>`
          : `<p><b>권리산정기준일 ${rt && rt.k === "pre" ? "아직 없음" : "확인 필요"}</b> — ${esc((rt && rt.b) || "공개 자료에서 날짜를 찾지 못했어요.")} 이 날짜 전부터 가진 집인지가 입주권(분양 대상)을 가르는 첫 기준이에요.</p>`;
        const N = o.next, NM = { 조합설립: "조합설립인가", 사업시행: "사업시행인가", 관리처분: "관리처분인가", 착공: "착공", 준공: "준공" };
        const nx = !N ? `<p>다음 단계 예상은 이 구역 인가일 기록이 부족해 내지 않아요.</p>`
          : N.state === "stall" || N.state === "over" ? `<p>다음 단계 <b>${esc(NM[N.to] || N.to)}</b> · ${N.state === "stall" ? "같은 단계에 오래 머물러 예상 시점을 내지 않아요" : "서울 보통 범위를 넘었어요 · 언제 넘어갈지는 통계로 말하기 어려워요"}</p>`
          : `<p>다음 단계 <b>${esc(NM[N.to] || N.to)}</b> 예상 <b>${F.ym(N.lo)} ~ ${F.ym(N.hi)}</b> <em class="zow-est">추정·확인 필요</em></p>`;
        const ev = (NT || []).slice(0, 3);
        const evH = ev.length ? `<ul class="zow-ev">${ev.map((e) => `<li><span>${esc(F.ymd(e[0]))}</span>${esc(String(e[3] || e[2] || "").slice(0, 70))}</li>`).join("")}</ul>` : `<p class="zow-mut">공개된 총회·감정평가·분양신청 공고가 아직 없어요${r.cafe ? " · 조합 공지는 정보몽땅 조합 공개 자료에서 볼 수 있어요" : ""}.</p>`;
        const rg = o.rg;
        const fee = rg ? `<p>분담금(추정 범위) <b>${signed(Math.min(rg.lo, rg.hi), ctx)} ~ ${signed(Math.max(rg.lo, rg.hi), ctx)}</b></p>
            <p class="zow-mut">근거: 조합원 분양가 추정 ${ctx.ZF.cash(rg.unit)}(${rg.area}㎡) − 종전자산 감정가 × 비례율 ${Math.round((rg.ratio - 0.1) * 100)}~${Math.round((rg.ratio + 0.1) * 100)}% · 감정가(${ctx.ZF.cash(rg.appr)})는 이 구역 빌라 표본으로 낸 추정이라 <b>내 집 감정가가 아니에요</b> · 실제 분담금은 감정평가·관리처분계획으로 정해져요 · 돈 탭 '숫자 바꿔 보기'에 내 집 감정가를 넣으면 다시 계산돼요</p>`
          : `<p class="zow-mut">분담금은 조합원 분양가·감정가 추정에 필요한 시세 자료가 부족해 범위를 내지 않아요.</p>`;
        const html = `<div class="sect zow"><h3>이미 가진 집이면 <small>이 구역에 집·땅을 가진 분용 · 모두 추정·확인 필요</small></h3>
          <div class="zow-b"><h4>입주권 대상</h4>${elig}</div>
          <div class="zow-b"><h4>다음 일정</h4>${nx}${evH}</div>
          <div class="zow-b"><h4>분담금</h4>${fee}</div></div>`;
        F.put(pane, "owner", html, (n) => { pane.insertBefore(n, pane.firstChild); });
      };
      draw(null);
      if (ctx.ntLoad) ctx.ntLoad().then((NT) => { const it = (NT && (NT.items || NT)) || []; draw(Array.isArray(it) ? it.filter((e) => Array.isArray(e) && e[1] === r.id && /총회|감정|분양신청|관리처분/.test(String(e[3] || "") + String(e[2] || ""))).sort((a, b) => (a[0] < b[0] ? 1 : -1)) : []); }).catch(() => {});
    },
  };
  // F8 필지 연식 지도: 두 번째 지연 묶음
  F.mods.age = {
    key: "age", tab: "biz",
    run(r, pane, ctx) { if (!r || !r.pcl || r.src === "moa" || r.s >= 7) return; try { window.ZP_feat.loadX().then((X) => X.agePane(r, pane, ctx)).catch(() => {}); } catch (e) {} },
  };
})();
