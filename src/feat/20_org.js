/* F3 조합·사업 정보 카드 — 일정 탭의 사실 목록(dl.facts)을 한 장의 카드로
   시공사 · 동의율 · 토지등소유자/조합원 · 계획 세대(임대) · 일반분양 비율(추정) · 구역 면적 · 용도지역 · 용적률 · 층수 · 정보몽땅 조합 공개 자료(링크)
   값은 정보몽땅 사업장 정보·추진경과와 정비계획 고시(서울도시공간포털) 그대로 · 없는 값은 '자료 없음' */
(function () {
  "use strict";
  const F = window.ZPF;
  // 층수 원자료 꼴('지상:24/지하:3' · '35' · '지상35층')을 '지상 24층 · 지하 3층'으로
  F.floors = (v) => { const s = String(v).replace(/\s/g, ""); const up = /지상:?(\d+)/.exec(s), dn = /지하:?(\d+)/.exec(s); if (up || dn) return [up ? `지상 ${up[1]}층` : "", dn ? `지하 ${dn[1]}층` : ""].filter(Boolean).join(" · "); return /^\d+$/.test(s) ? `${s}층` : s.replace(/층?$/, "층"); };
  F.org = (r, ctx) => {
    const sm = r.sm || {}, cs = r.cs || {};
    const units = sm.units ?? (sm.saleUnits != null && sm.rental != null ? sm.saleUnits + sm.rental : null);
    const owners = sm.owners || sm.members || null;
    const ck = cs["조합설립"] ? "조합설립" : cs["추진위"] ? "추진위" : null, c = ck ? cs[ck] : null;
    const cv = c ? (c.v != null ? c.v : c.first != null ? c.first : null) : null;
    const areaBad = !!(sm.area && ctx && ctx.areaBad && ctx.areaBad(r));
    const sale = units && owners && units > owners ? (units - owners - (sm.rental || 0)) / units : null;
    return {
      builder: r.b || null,
      consent: cv != null ? { v: +(+cv).toFixed(2), k: ck, d: c.d || null } : null,   // 일정 탭 동의율 막대(meter-v)와 같은 꼴
      owners, members: sm.members && sm.owners && sm.members !== sm.owners ? sm.members : null,
      units, rental: sm.rental || null, sale: sale != null && sale > 0 ? Math.round(sale * 100) : null,
      area: sm.area ? Math.round(sm.area) : null, areaBad, zoning: sm.zoning || null, far: sm.far || null, floors: sm.floors || null,
      cafe: r.cafe || null,
    };
  };
  // 사이클 2: 정보몽땅 등록값에 계획 세대·층수가 없으면 구역 글(/z) 주요 일정의 기사·고시 값(public/data/zplan.json · tools/zhand.plan_all)으로 — 날짜·출처 줄을 함께
  let PLAN = null;
  F.plan = (ctx) => PLAN || (PLAN = fetch(`data/zplan.json?v=${encodeURIComponent((ctx.D && (ctx.D.upd || ctx.D.asOf)) || "")}`).then((x) => (x.ok ? x.json() : {})).catch(() => { PLAN = null; return {}; }));
  F.zoning = (v) => String(v || "").replace(/제(\d)(\d)종/g, "제$1·$2종").replace(/\((\d)(\d{1,2})층\)/, "($1·$2층)");
  F.mods.org = {
    key: "org", tab: "biz",
    run(r, pane, ctx) {
      // 바로 한 번 그리고(옛 사실 목록을 곧바로 바꿔 끼움), 구역 글 자료(zplan)가 오면 그 값으로 다시 — 두 번째부터는 받아 둔 것으로 바로
      if (F.planD) { F.mods.org.draw(r, pane, ctx, F.planD[r.id] || null); return; }
      F.mods.org.draw(r, pane, ctx, null);
      F.plan(ctx).then((P) => { F.planD = P || {}; if (P && P[r.id]) F.mods.org.draw(r, pane, ctx, P[r.id]); }, () => {});
    },
    draw(r, pane, ctx, pl) {
      if (!pane.isConnected || (ctx.cur && ctx.cur() !== r)) return;
      const o = F.org(r, ctx), esc = ctx.esc, fmt = ctx.fmt;
      const pd = pl ? `기사·고시 기준 · ${esc(pl.d.replace(/-/g, "."))} <a href="z/${esc(r.id)}">구역 글</a>` : "";
      if (o.units == null && pl && pl.u) { o.units = pl.u; o.uSrc = pd; o.uA = !!pl.a; }
      if (o.floors == null && pl && pl.f) { o.floors = `최고 ${pl.f}층`; o.fSrc = pd; }
      const reb = /재건축/.test(r.k);
      const cell = (lab, v, sub, wide) => `<div class="zorg-c${wide ? " w" : ""}${v == null ? " na" : ""}"><dt>${lab}</dt><dd>${v == null ? "자료 없음" : v}${sub ? `<small>${sub}</small>` : ""}</dd></div>`;
      const pyeong = o.area ? `약 ${fmt(Math.round(o.area / 3.3058))}평` : "";
      const html = `<div class="sect zorg"><h3>조합·사업 정보 <small>정보몽땅 사업장 정보·추진경과 · 정비계획 고시 · 늦게 반영될 수 있어요</small></h3>
        <dl class="zorg-g">
          ${cell("시공사", o.builder ? esc(o.builder) : null, o.builder ? "추진경과·기사 대조" : r.s < 5 ? "보통 사업시행인가 앞뒤로 선정" : "")}
          ${cell(o.consent && o.consent.k === "추진위" ? "추진위 동의율" : "조합설립 동의율", o.consent ? `${o.consent.v}%` : null, o.consent && o.consent.d ? `${F.ymd(o.consent.d)} 기록` : "")}
          ${cell(reb ? "조합원 수" : "토지등소유자", o.owners ? `${fmt(o.owners)}명` : null, o.members ? `조합원 ${fmt(o.members)}명` : "")}
          ${cell("계획 세대", o.units ? `${o.uA ? "약 " : ""}${fmt(o.units)}세대` : null, o.uSrc || (o.rental ? `임대 ${fmt(o.rental)} 포함` : "정보몽땅 등록값 없음"))}
          ${cell("일반분양 비율", o.sale != null ? `${o.sale}% <em class="zorg-est">추정</em>` : null, o.sale != null ? "(세대 − 소유자 − 임대) ÷ 세대" : "")}
          ${cell("구역 면적", o.area ? (o.areaBad ? "확인 중" : `${fmt(o.area)}㎡`) : null, o.areaBad ? `원자료 ${fmt(o.area)}㎡는 계획 세대에 비해 너무 작아 필지 하나의 면적일 수 있어요` : pyeong)}
          ${cell("용적률 · 층수", o.far || o.floors ? `${o.far ? o.far + "%" : "용적률 –"}${o.floors ? ` · ${esc(o.fSrc ? o.floors : F.floors(o.floors))}` : ""}` : null, o.fSrc || "정비계획 고시")}
          ${o.zoning ? cell("용도지역", esc(F.zoning(o.zoning)), "정보몽땅 등록값", true) : ""}
        </dl>
        ${o.cafe ? `<a class="zorg-cafe" href="https://cleanup.seoul.go.kr/cafe/mainIndx.do?cafeUrl=${encodeURIComponent(o.cafe)}" target="_blank" rel="noopener"><span><b>정보몽땅 조합 공개 자료</b><small>서울시 정비사업 정보몽땅의 이 조합 화면 · 총회 자료·공지·추정분담금</small></span><i aria-hidden="true">↗</i></a>` : ""}
      </div>`;
      const old = pane.querySelector("dl.facts");
      F.put(pane, "org", html, (n) => { if (old) old.replaceWith(n); else { const lad = pane.querySelector(".ladder"); const sec = lad && lad.closest(".sect"); if (sec) sec.before(n); else pane.appendChild(n); } });
      if (old && old.isConnected) old.remove();
      // 예전 '조합 카페' 안내 문단은 카드 링크와 같은 말이라 뺀다
      if (o.cafe) pane.querySelectorAll("p.note").forEach((p) => { if (p.querySelector('a[href*="cafeUrl="]') && !p.closest('[data-f]')) p.remove(); });
    },
  };
})();
