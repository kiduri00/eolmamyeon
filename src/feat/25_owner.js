/* 사이클 2: '이미 가진 집이면' — 일정 탭 맨 위(빌라·단독을 이미 가진 사람용)
   ① 입주권 대상 여부: 권리산정기준일(시트·매물진단과 같은 ctx.rights) 전부터 가진 집인지로만 가른다(추정·확인 필요)
   ② 다음 단계(F2 타임라인 ZPF.tl과 같은 셈) · 총회·감정평가·분양신청·관리처분 공고(정보몽땅 추진경과 data/notice.json)가 있으면 날짜와 함께
   ③ 분담금: 단일 숫자 없이 범위와 근거만 — 조합원 분양가 추정 − 감정가 × 비례율(±10%p) · 감정가는 이 구역 빌라 표본으로 낸 추정(내 집 값이 아님)
   아울러 필지 연식 지도(F8)는 두 번째 지연 묶음(/b/g)에서 그린다(이 탭을 열 때만 받음) */
(function () {
  "use strict";
  const F = window.ZPF;
  const SM = (r) => /가로|소규모|모아/.test(r.k || "") || r.src === "moa";
  // 사이클 3: 분양가 추정 불확실성(작성자 가정 ±10%) — 관리처분계획 전 조합원 분양가는 정해지지 않아 비례율(±10%p)만으로는 폭이 사실상 한 숫자가 되던 것
  const UP_BAND = 0.1;
  // 숫자만(화면·QA 같은 값)
  F.owner = (r, ctx) => {
    if (!r || r.s >= 9 || r.dn) return null;
    let rt = null; try { rt = ctx.rights(r); } catch (e) {}
    if (r.src === "moa") return { moa: true, rt, rule: F.buyRule(r, ctx) };
    let x = null; try { x = ctx.calc(r); } catch (e) {}
    let rg = null;
    if (x && x.ok && isFinite(x.unitPrice) && isFinite(x.appr) && isFinite(x.ratio)) {
      // 분담금 = 조합원 분양가 − 감정가 × 비례율 · 낮은 끝 = 분양가 −10% · 비례율 +10%p, 높은 끝 = 분양가 +10% · 비례율 −10%p
      const lo = x.unitPrice * (1 - UP_BAND) - x.appr * (x.ratio + 0.1), hi = x.unitPrice * (1 + UP_BAND) - x.appr * Math.max(0, x.ratio - 0.1);
      rg = { lo, hi, unit: x.unitPrice, uLo: x.unitPrice * (1 - UP_BAND), uHi: x.unitPrice * (1 + UP_BAND), area: x.unitArea, appr: x.appr, ratio: x.ratio };
    }
    let f = null; try { f = ctx.facts(r); } catch (e) {}
    return { rt, rg, next: f && f.next ? f.next : null, rule: F.buyRule(r, ctx) };
  };
  // 사이클 3: 언제 산 집인지(매수 시점 규칙) 한 줄 — 재건축 도시정비법 제39조② · 재개발 같은 조항(관리처분인가 뒤)과 부칙〈법률 제14943호〉 제2조 · 가로·소규모·모아 소규모주택정비법 제24조②
  const L39 = "https://www.law.go.kr/법령/도시및주거환경정비법/제39조", L24 = "https://www.law.go.kr/법령/빈집및소규모주택정비에관한특례법/제24조";
  // 사이클 4: 투기과열지구 기간은 구별 이력(ZoneFacts buy · tools/tgj.json 출처·확인일) — '2025.10.16 전에 산 집은 다를 수 있어요' 한 줄이
  //   다른 21개 구도 2017.8.3~2023.1.4에 지정돼 있었다는 점을 빠뜨리던 것. 인가일이 있으면 그 뒤 지정이 풀려 있던 구간을 날짜로 쓴다
  const TGL = (r) => { let b = null; try { b = ZFX.buyOf(r); } catch (e) {} if (b) return `${b.txt} · ${b.tg}`; let t = ""; try { t = ZFX.tgjTxt(r.g); } catch (e) {} return t ? `매수일이 ${t}에 들면 이 제한을 받아요` : "매수일이 투기과열지구 지정 기간에 들면 이 제한을 받아요"; };
  F.buyRule = (r, ctx) => {
    const dt = r.dt || {}, d = (k) => (dt[k] ? F.ymd(dt[k]) : "");
    let f = null; try { f = ctx.facts(r); } catch (e) {}
    const g = f && f.kind ? f.kind.g : "";
    const ex = "매도인이 10년 보유·5년 거주한 1세대 1주택 같은 예외가 있어요";
    if (g === "moa") return { law: "소규모주택정비법 제24조②", u: L24, t: `안의 사업구역(가로주택·모아주택 조합)마다 따로예요 · 그 조합의 설립인가 뒤에 산 집은 조합원이 될 수 없어요 · ${ex} · ${(() => { let t = ""; try { t = ZFX.tgjTxt(r.g); } catch (e) {} return t ? `매수일이 ${t}에 들면 이 제한을 받아요` : ""; })()}` };
    const when = (lab, cd) => (cd ? ` · 이 구역 ${lab} ${cd}` : r.s >= 4 && lab === "조합설립인가" ? ` · 이 구역은 ${lab} 단계인데 인가일 기록이 없어요` : ` · 이 구역은 아직 ${lab} 전이에요`);
    if (g === "small") return { law: "소규모주택정비법 제24조②", u: L24, t: `조합설립인가 뒤에 산 집은 조합원이 될 수 없어요${when("조합설립인가", d("조합설립"))} · ${TGL(r)} · ${ex}` };
    if (g === "rebuild") return { law: "도시정비법 제39조②", u: L39, t: `조합설립인가 뒤에 산 집은 조합원 지위를 넘겨받지 못해 입주권 대신 현금청산될 수 있어요${when("조합설립인가", d("조합설립") || d("시행자지정"))} · ${TGL(r)} · ${ex}` };
    if (g === "redev") {
      let b = null; try { b = ctx.b18(r); } catch (e) {}
      const md = d("관리처분");
      const bx = b && b.st === "ex" ? ` · 다만 이 구역은 사업시행인가${b.by === "app" ? " 신청" : ""}(${F.ymd(b.d)})이 2018.1.24 이전이라 관리처분인가 뒤에 산 집도 이 제한을 받지 않는 것으로 보여요(부칙〈법률 제14943호, 2017.10.24〉 제2조 · 법제처 해석 19-0079)`
        : b && b.st === "unk" ? ` · 사업시행인가(${F.ymd(b.d)})가 2018.1.25 시행 직후라, 신청이 2018.1.24까지였다면 이 제한을 받지 않아요(부칙〈법률 제14943호〉 제2조) · 신청일은 조합·구청에 확인하세요` : "";
      return { law: "도시정비법 제39조②", u: L39, t: `관리처분인가 뒤에 산 집은 조합원이 될 수 없어 현금청산될 수 있어요${md ? ` · 이 구역 관리처분인가 ${md}` : r.s >= 6 ? "" : " · 이 구역은 아직 관리처분인가 전이에요"} · ${TGL(r)} · ${ex}${bx}` };
    }
    return null;
  };
  const signed = (v, ctx) => (v < 0 ? `${ctx.ZF.cash(-v)} 돌려받음` : ctx.ZF.cash(v));
  F.mods.owner = {
    key: "owner", tab: "biz", moa: true,
    run(r, pane, ctx) {
      const o = F.owner(r, ctx);
      if (!o) { F.put(pane, "owner", ""); return; }
      const draw = (NT) => {
        if (ctx.cur() !== r || !pane.isConnected) return;
        const esc = ctx.esc, rt = o.rt, law = SM(r) ? "소규모주택정비법" : "도시정비법 제77조";
        const elig = rt && rt.k === "set"
          ? `<p><b>권리산정기준일 ${esc(rt.d)}${rt.old || rt.c === "low" ? " (추정)" : ""}</b> 전부터 가진 집(토지·건물)이면 분양 대상이 될 수 있어요. 그 뒤에 새로 지었거나 지분을 쪼갠 집은 입주권 대신 현금청산될 수 있어요(${law}). 분양 대상은 서울시 도시정비조례 기준(주택 소유·토지 면적·권리가액)도 함께 충족해야 해요.</p>`
          : `<p><b>권리산정기준일 ${rt && rt.k === "pre" ? "아직 없음" : "확인 필요"}</b> — ${esc((rt && rt.b) || "공개 자료에서 날짜를 찾지 못했어요.")} 이 날짜 전부터 가진 집인지가 입주권(분양 대상)을 가르는 첫 기준이에요.</p>`;
        const rl = o.rule ? `<p class="zow-rule"><b>언제 산 집인지</b> ${esc(o.rule.t)} <a href="${esc(o.rule.u)}" target="_blank" rel="noopener">${esc(o.rule.law)}</a> <em class="zow-est">추정·확인 필요</em></p>` : "";
        if (o.moa) {
          const kids = (r.kids || []).map((id) => ctx.byId[id]).filter(Boolean);
          const kl = kids.length ? `<ul class="zow-ev">${kids.slice(0, 6).map((k) => `<li><span>${esc(ctx.stageName(k))}</span>${esc(ctx.shortName(k.n))}</li>`).join("")}</ul>` : `<p class="zow-mut">아직 정보몽땅에 등록된 사업구역(조합)이 없어요.</p>`;
          const html = `<div class="sect zow"><h3>이미 가진 집이면 <small>모아타운 관리지역 · 모두 추정·확인 필요</small></h3>
            <div class="zow-b"><h4>입주권 대상</h4>${elig}${rl}</div>
            <div class="zow-b"><h4>내 집이 속한 사업구역</h4><p>모아타운은 안의 사업구역(가로주택·모아주택 조합)마다 따로 진행돼요 · 다음 일정과 분담금은 내 집이 속한 사업구역 화면에서 보세요.</p>${kl}</div>
            <div class="zow-b"><h4>분담금</h4><p class="zow-mut">사업구역마다 분양가·감정가가 달라 관리지역 전체로는 범위를 내지 않아요.</p></div></div>`;
          F.put(pane, "owner", html, (n) => { pane.insertBefore(n, pane.firstChild); });
          return;
        }
        const N = o.next;
        // 사이클 3: 다음 단계 문장은 ZoneFacts next.txt 하나(F2 타임라인·/z와 같은 판단 · 가로·소규모 사업시행 다음은 이주·착공)
        const nx = !N ? `<p>다음 단계 예상은 이 구역 인가일 기록이 부족해 내지 않아요.</p>`
          : `<p>다음 단계 <b>${esc(N.txt)}</b>${N.state === "before" || N.state === "in" ? ` <em class="zow-est">추정·확인 필요</em>` : ""}</p>`;
        const ev = (NT || []).slice(0, 3);
        const evH = ev.length ? `<ul class="zow-ev">${ev.map((e) => `<li><span>${esc(F.ymd(e[0]))}</span>${esc(String(e[3] || e[2] || "").slice(0, 70))}</li>`).join("")}</ul>` : `<p class="zow-mut">공개된 총회·감정평가·분양신청 공고가 아직 없어요${r.cafe ? " · 조합 공지는 정보몽땅 조합 공개 자료에서 볼 수 있어요" : ""}.</p>`;
        const rg = o.rg;
        const fee = rg ? `<p>분담금(추정 범위) <b>${signed(Math.min(rg.lo, rg.hi), ctx)} ~ ${signed(Math.max(rg.lo, rg.hi), ctx)}</b></p>
            <p class="zow-mut">근거: 조합원 분양가 추정 ${ctx.ZF.cash(rg.uLo)}~${ctx.ZF.cash(rg.uHi)}(${rg.area}㎡ · 가운데 ${ctx.ZF.cash(rg.unit)}에 ±10%) − 종전자산 감정가 × 비례율 ${Math.round((rg.ratio - 0.1) * 100)}~${Math.round((rg.ratio + 0.1) * 100)}% · 분양가 ±10%는 관리처분계획 전이라 정해지지 않은 몫을 넣은 이 사이트의 가정이에요 · 감정가(${ctx.ZF.cash(rg.appr)})는 이 구역 빌라 표본으로 낸 추정이라 <b>내 집 감정가가 아니에요</b> · 실제 분담금은 감정평가·관리처분계획으로 정해져요 · 돈 탭 '숫자 바꿔 보기'에 내 집 감정가를 넣으면 다시 계산돼요</p>`
          : `<p class="zow-mut">분담금 범위를 내지 않아요 · ${esc((() => { let f = null; try { f = ctx.facts(r); } catch (e) {} const h = f && f.hold && (f.hold.now || f.hold.tot || f.hold.one); if (h) return h.txt; let x = null; try { x = ctx.calc(r); } catch (e) {} return x && x.price != null ? ctx.ZF.noCalcTxt(r, x) : "조합원 분양가·감정가 추정에 필요한 시세 자료가 부족해요"; })())}.</p>`;
        const html = `<div class="sect zow"><h3>이미 가진 집이면 <small>이 구역에 집·땅을 가진 분용 · 모두 추정·확인 필요</small></h3>
          <div class="zow-b"><h4>입주권 대상</h4>${elig}${rl}</div>
          <div class="zow-b"><h4>다음 일정</h4>${nx}${evH}</div>
          <div class="zow-b"><h4>분담금</h4>${fee}</div></div>`;
        F.put(pane, "owner", html, (n) => { pane.insertBefore(n, pane.firstChild); });
      };
      draw(null);
      if (!o.moa && ctx.ntLoad) ctx.ntLoad().then((NT) => { const it = (NT && (NT.items || NT)) || []; draw(Array.isArray(it) ? it.filter((e) => Array.isArray(e) && e[1] === r.id && /총회|감정|분양신청|관리처분/.test(String(e[3] || "") + String(e[2] || ""))).sort((a, b) => (a[0] < b[0] ? 1 : -1)) : []); }).catch(() => {});
    },
  };
  // F8 필지 연식 지도: 두 번째 지연 묶음
  F.mods.age = {
    key: "age", tab: "biz",
    run(r, pane, ctx) { if (!r || !r.pcl || r.src === "moa" || r.s >= 7) return; try { window.ZP_feat.loadX().then((X) => X.agePane(r, pane, ctx)).catch(() => {}); } catch (e) {} },
  };
})();
