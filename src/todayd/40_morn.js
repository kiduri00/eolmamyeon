/* '아침에 받기' — 빈도(중요한 것만 기본 · 매일 · 주 1회)를 고르고 단추를 누를 때만 조건 저장 → 알림 권한 → 구독(72_inbox subscribe 한 길)
   권한 창은 이 단추를 누를 때만 뜬다. 거부됐으면 다시 묻지 않고 폰 설정 안내만. */
(function () {
  "use strict";
  const Y = window.ZPT, W = Y.W, U = Y.U, e = Y.esc;
  let N = 0;
  const st = (ctx) => { try { return ctx.inbox.st(); } catch (er) { return null; } };
  // 받을 수 있는 기기인지(서버 키가 왔고 막히지 않음) — 아니면 단추를 보이지 않는다
  const can = (s) => !!(s && s.can && s.perm !== "denied" && s.perm !== "unsupported");
  function boxHTML(ctx, where) {
    const s = st(ctx); if (!s) return "";
    const f = ctx.inbox.freq(), id = "mo" + ++N;
    if (s.on) return `<div class="mo-box on" data-mo="${where}"><p class="mo-t"><b>${e(Y.f(U.morning_on, { f: W.freq[f] }))}</b><small>${e(W.freq_note[f])}</small></p><div class="mo-f" role="radiogroup" aria-label="알림 빈도">${["i", "d", "w"].map((k) => `<button type="button" role="radio" aria-checked="${k === f}" data-mof="${k}">${e(W.freq[k])}</button>`).join("")}</div></div>`;
    if (!can(s)) return s && s.perm === "denied" ? `<div class="mo-box" data-mo="${where}"><p class="mo-t"><b>알림이 막혀 있어요</b><small>${e(Y.tapp() ? `폰 설정 → 애플리케이션(또는 앱) → ${ctx.BRAND} → 알림에서 허용할 수 있어요` : "주소창 왼쪽 자물쇠(사이트 설정)에서 알림을 허용할 수 있어요")}</small></p></div>` : "";
    return `<div class="mo-box" data-mo="${where}"><p class="mo-t" id="${id}"><b>${e(U.morning)}</b><small>${e(`내 돈 ${Y.cashT(ctx, ctx.cash())}·${Y.modeT(ctx)} 조건 · 관심 구역`)}</small></p>` +
      `<div class="mo-f" role="radiogroup" aria-labelledby="${id}">${["i", "d", "w"].map((k) => `<button type="button" role="radio" aria-checked="${k === f}" data-mof="${k}">${e(W.freq[k])}</button>`).join("")}</div>` +
      `<p class="mo-h" data-moh>${e(W.freq_note[f])}</p><button type="button" class="btn primary mo-go" data-mogo>아침에 받기</button><p class="mo-m" role="status" data-mom></p></div>`;
  }
  Y.mornBox = (ctx, where) => boxHTML(ctx, where);
  Y.mornBind = (ctx, root) => {
    if (!root || root.dataset.mob) return; root.dataset.mob = "1";
    root.addEventListener("click", async (ev) => {
      const t = ev.target.closest("[data-mof],[data-mogo]"); if (!t) return;
      const box = t.closest("[data-mo]"); if (!box) return;
      if (t.hasAttribute("data-mof")) {
        const v = t.dataset.mof, on = box.classList.contains("on");
        // 고르기만(권한 창 없음) · 이미 켜져 있으면 바로 서버 구독에 반영(72_inbox freq → sync)
        if (on) ctx.inbox.setFreq(v); else box.dataset.f = v;
        box.querySelectorAll("[data-mof]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mof === v)));
        const h = box.querySelector("[data-moh]") || box.querySelector(".mo-t small"); if (h) h.textContent = W.freq_note[v];
        if (on) { const b = box.querySelector(".mo-t b"); if (b) b.textContent = Y.f(U.morning_on, { f: W.freq[v] }); }
        return;
      }
      // 누름: 빈도 저장 → 지금 조건을 알림 조건으로(이미 같은 조건이면 그대로) → 권한(이때만) → 구독
      const f = box.dataset.f || ctx.inbox.freq();
      ctx.inbox.setFreq(f);
      try { ctx.pins.condSave(); } catch (er) {}
      const r = await ctx.inbox.subscribe(t);
      const m = box.querySelector("[data-mom]");
      if (r && r.ok) { box.outerHTML = boxHTML(ctx, box.dataset.mo); try { window.dispatchEvent(new Event("zp:alerts")); } catch (er) {} }
      else if (m) { m.textContent = (r && r.msg) || "알림을 켜지 못했어요 · MY › 알림 설정에서 다시 켤 수 있어요"; if (r && r.denied) t.hidden = true; }
    });
  };
  // 오늘 카드 끝: 받을 수 있는데 아직 안 받는 기기만 '아침에 받기' 한 단추(누르면 빈도 고르는 칸이 펼쳐짐 — 권한은 그 안 단추에서)
  Y.mornFoot = (ctx, card) => {
    const f = card.querySelector(".td-f"); if (!f) return;
    const put = () => {
      const s = st(ctx), old = f.querySelector(".mo-open"); if (old) old.remove();
      if (!can(s) || s.on) return;
      f.insertAdjacentHTML("afterbegin", '<button type="button" class="btn text sm mo-open" aria-expanded="false" aria-controls="tdMo">아침에 받기</button>');
    };
    put(); ctx.inbox.pushKey().then(put);
    if (card.dataset.mof) return; card.dataset.mof = "1";
    card.addEventListener("click", (ev) => {
      const o = ev.target.closest(".mo-open"); if (!o) return;
      let p = card.querySelector("#tdMo");
      if (p) { p.remove(); o.setAttribute("aria-expanded", "false"); return; }
      f.insertAdjacentHTML("beforebegin", `<div id="tdMo">${boxHTML(ctx, "home")}</div>`); o.setAttribute("aria-expanded", "true");
      p = card.querySelector("#tdMo"); Y.mornBind(ctx, p); const g = p.querySelector("[data-mof]"); if (g) g.focus();
    });
  };
  // 설치 앱 처음 안내 3/3 칸에 끼우기(src/tapp onbHTML이 자리 #tobMorn을 둠)
  Y.morning = (el, ctx, where) => { if (!el) return; Y.css(); el.innerHTML = boxHTML(ctx, where || "tonb"); Y.mornBind(ctx, el); };
})();
