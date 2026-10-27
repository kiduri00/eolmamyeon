/* F9 알림 세부 설정(MY > 알림 설정 · 종류 스위치 아래)
   - 관심 구역별 끄기 · 알림 조건별 끄기(zp-alert-mute — 72_inbox setMute) : 관심 구역·조건 자체는 그대로 두고 소식 목록·배지·폰 알림에서만 뺀다
   - 미리 보기: 지금 설정이면 최근 7일에 받았을 소식(관심 구역 소식 + 조건에 맞는 곳의 경매) · 꺼 둔 설정으로 빠진 수
   숫자는 소식 자료(changes.json)를 72_inbox와 같은 함수(week · condAuc · evOf)로 센다 — 따로 셈하지 않는다. */
(function () {
  "use strict";
  const F = window.ZPF;
  const SHOW = 5;   // 구역 줄은 5개까지 보이고 나머지는 '더 보기'
  let open = false;
  const SW = (k, id, t, sub, on) => `<li><button type="button" class="my-r my-sw" role="switch" aria-checked="${on}" data-m${k}="${id}"><span class="my-t"><b>${t}</b>${sub ? `<small>${sub}</small>` : ""}</span><i class="my-tg" aria-hidden="true"></i></button></li>`;
  // 최근 7일 소식(구역별 수 · 미리 보기 줄) — 72_inbox 함수만 쓴다
  F.alertsData = (A, ctx) => {
    const I = A.INBOX, P = A.PINS, d0 = I.d0();
    const pins = P.list().filter((id) => ctx.byId[id]);
    const uq = (L) => { const s = new Set(); return L.filter((e) => { const k = `${e.id}|${e.date}|${e.type}|${e.text}`; if (s.has(k)) return false; s.add(k); return true; }); };
    const offK = new Set(I.KINDS.map((k) => k[0]).filter((k) => I.isOff(k)));
    const per = {};
    pins.forEach((id) => { per[id] = uq(I.evOf(id).filter((e) => e.date >= d0 && !offK.has(e.type))).length; });
    const got = [...I.week(), ...I.condAuc().filter((e) => e.date >= d0)].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    // 꺼 둔 설정(종류·구역·조건)이 없었다면 받았을 수 — 구역 소식 전체(종류 무관) + 조건 경매(종류 꺼짐이면 0)
    const all = uq(pins.flatMap((id) => I.evOf(id).filter((e) => e.date >= d0))).length;
    const conds = P.conds().map((c) => ({ id: c.id, name: P.cname(c), on: !I.isMuted("c", c.id), n: (P.evalCond(c) || []).length }));
    return { d0, pins, per, got, out: Math.max(0, all - I.week().length), conds };
  };
  function render(K, A, ctx) {
    const I = A.INBOX, X = F.alertsData(A, ctx), esc = ctx.esc;
    let box = document.getElementById("myMute");
    if (!X.pins.length && !X.conds.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.id = "myMute"; box.className = "zal"; box.setAttribute("data-f", "alerts"); K.after(box); }
    const zl = X.pins.map((id, i) => SW("z", id, esc(ctx.shortName(ctx.byId[id].n)), `최근 7일 소식 ${X.per[id]}건`, !I.isMuted("z", id)).replace("<li>", i >= SHOW && !open ? '<li hidden data-more="1">' : "<li>")).join("");
    const more = X.pins.length > SHOW ? `<button type="button" class="zal-more" data-zmore aria-expanded="${open}">${open ? "접기" : `관심 구역 ${X.pins.length - SHOW}곳 더 보기`}</button>` : "";
    const cl = X.conds.map((c) => SW("c", c.id, esc(c.name), `지금 맞는 곳 ${ctx.fmt(c.n)}곳`, c.on)).join("");
    const rows = X.got.slice(0, SHOW).map((e) => `<li><span class="zal-d">${esc(I.dLabel(e.date))}</span><span class="zal-n">${esc(ctx.byId[e.id] ? ctx.shortName(ctx.byId[e.id].n) : e.n || "")}</span><span class="zal-x">${esc(e.text)}</span></li>`).join("");
    const html = `${X.pins.length ? `<p class="my-kc zal-h" id="myMuteZ">관심 구역별</p><ul class="my-l my-kinds" aria-labelledby="myMuteZ">${zl}</ul>${more}` : ""}` +
      `${X.conds.length ? `<p class="my-kc zal-h" id="myMuteC">알림 조건별</p><ul class="my-l my-kinds" aria-labelledby="myMuteC">${cl}</ul>` : ""}` +
      `<section class="zal-pv" aria-labelledby="myMuteP"><h4 id="myMuteP">미리 보기 · 지금 설정이면 최근 7일에 받았을 소식</h4>` +
      `<p class="zal-c"><b>${ctx.fmt(X.got.length)}건</b>${X.out ? ` · 꺼 둔 설정으로 ${ctx.fmt(X.out)}건 빠져요` : ""}</p>` +
      (rows ? `<ul class="zal-l">${rows}</ul>${X.got.length > SHOW ? `<p class="zal-s">외 ${ctx.fmt(X.got.length - SHOW)}건은 소식 탭에서 볼 수 있어요</p>` : ""}` : `<p class="zal-s">최근 7일에는 받을 소식이 없었어요</p>`) +
      `<p class="zal-s">소식 자료 ${esc(F.ymd(A.INBOX.asOf() || ""))} 기준 · 폰 알림은 하루 한 번 아침에 모아서 보내요 · '갈 수 있게 된 곳'은 그날 계산으로 정해져 미리 보기에 넣지 않았어요</p></section>`;
    if (box.innerHTML !== html) box.innerHTML = html;
    if (!box.__b) {
      box.__b = 1;
      box.addEventListener("click", (e) => {
        const t = e.target.closest("button"); if (!t) return;
        if (t.hasAttribute("data-zmore")) { open = !open; render(K, A, ctx); return; }
        const z = t.dataset.mz, c = t.dataset.mc; if (!z && !c) return;
        const v = t.getAttribute("aria-checked") !== "true"; t.setAttribute("aria-checked", String(v));
        I.setMute(z ? "z" : "c", z || c, v);
        render(K, A, ctx);
      });
    }
  }
  F.alerts = (K, A, ctx) => { F.css(); return A.INBOX.load().then(() => render(K, A, ctx)); };
})();
