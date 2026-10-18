/* 문의하기 양식(20차) — 앱(MY 문의 · '이 숫자가 틀렸어요' 시트)과 정적 페이지(/contact · /faq · /z 신고 링크)가 같은 이 코드를 쓴다.
   보내는 곳: POST /api/contact (worker/contact.js) · 메일 주소는 화면 어디에도 내지 않는다.
   ZP_contact.open(opts)  : 아래에서 올라오는 시트(뒤로 가기 = 닫기)
   ZP_contact.mount(el, opts) : 페이지 안에 바로(/contact)
   opts = { kind, title, meta, reasons:[[k, 제목, 설명]], ctx:{zone, url, asOf, nums} }
   정적 페이지: <a data-zp-contact data-kind="error" data-zone="o916" href="/contact?kind=error&zone=o916"> 를 누르면 시트로 연다(스크립트가 없으면 /contact로). */
(function () {
  if (window.ZP_contact) return;
  var W = window, D = document;
  var KINDS = [["general", "일반 문의"], ["error", "숫자 오류"], ["idea", "기능 제안"], ["etc", "기타"]];
  var MIN = 10, MAX = 2000, DK = "zp.cfDraft";
  var EMAIL = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var fmt = function (n) { try { return Number(n).toLocaleString("ko-KR"); } catch (e) { return String(n); } };
  var ls = { get: function () { try { return JSON.parse(localStorage.getItem(DK) || "null"); } catch (e) { return null; } }, set: function (v) { try { localStorage.setItem(DK, JSON.stringify(v)); } catch (e) {} }, del: function () { try { localStorage.removeItem(DK); } catch (e) {} } };
  var CSS = ".cf{display:flex;flex-direction:column;gap:12px;font:15px/1.5 var(--font,system-ui,-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif);color:var(--text-1,#141821)}"
    + ".cf h3{margin:0;font-size:19px;font-weight:800;letter-spacing:-.02em}.cf .cf-meta{margin:-6px 0 0;color:var(--text-2,#4a5361);font-size:13px}"
    + ".cf fieldset{margin:0;padding:0;border:0;min-width:0}.cf legend,.cf .cf-l{display:block;margin:0 0 6px;padding:0;font-weight:700;font-size:14px}.cf .cf-l small,.cf legend small{font-weight:500;color:var(--text-3,#6a7482)}"
    + ".cf .cf-k{display:flex;flex-wrap:wrap;gap:6px}.cf .cf-k label{position:relative}.cf .cf-k input,.cf .cf-r input{position:absolute;opacity:0;width:1px;height:1px;margin:0}"
    + ".cf .cf-k span{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:1px solid var(--border,#d7dce5);border-radius:999px;background:var(--surface,#fff);font-weight:600;font-size:14px;cursor:pointer}"
    + ".cf .cf-k input:checked+span{background:var(--zn,#1F3A87);border-color:var(--zn,#1F3A87);color:#fff}.cf .cf-k input:focus-visible+span,.cf .cf-r input:focus-visible+span{outline:2px solid var(--focus,#2B59F0);outline-offset:2px}"
    + ".cf .cf-r{display:grid;gap:6px}.cf .cf-r label{position:relative;display:block}.cf .cf-r span{display:flex;flex-direction:column;min-height:44px;justify-content:center;padding:6px 12px;border:1px solid var(--border,#d7dce5);border-radius:12px;cursor:pointer}.cf .cf-r span b{font-size:14px}.cf .cf-r span small{color:var(--text-3,#6a7482);font-size:12px}.cf .cf-r input:checked+span{border-color:var(--zn,#1F3A87);box-shadow:inset 0 0 0 1px var(--zn,#1F3A87);background:color-mix(in srgb,var(--zn,#1F3A87) 7%,transparent)}"
    + ".cf textarea,.cf input[type=email]{box-sizing:border-box;width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--border,#c9d0db);border-radius:12px;background:var(--surface,#fff);color:inherit;font:inherit;font-size:16px}.cf textarea{min-height:120px;resize:vertical}"
    + ".cf textarea:focus,.cf input[type=email]:focus{outline:2px solid var(--zn,#1F3A87);outline-offset:0;border-color:transparent}.cf [aria-invalid=true]{border-color:#C2410C}"
    + ".cf .cf-rw{display:flex;justify-content:space-between;gap:8px;margin-top:4px;font-size:12px;color:var(--text-3,#6a7482)}.cf .cf-cnt{margin-left:auto;font-variant-numeric:tabular-nums}.cf .cf-cnt.over{color:#C2410C}"
    + ".cf .cf-err{margin:4px 0 0;color:#C2410C;font-size:13px;font-weight:600}.cf .cf-note{margin:4px 0 0;color:var(--text-3,#6a7482);font-size:12.5px}"
    + ".cf .cf-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}"
    + ".cf .cf-st{margin:0;font-size:14px;font-weight:600}.cf .cf-st:empty{display:none}.cf .cf-st.bad{color:#C2410C}"
    + ".cf .cf-ft{display:flex;gap:8px}.cf .cf-ft button{flex:1;min-height:48px;border-radius:12px;font:700 16px/1 inherit;font-family:inherit;cursor:pointer}"
    + ".cf .cf-go{border:0;background:var(--zn,#1F3A87);color:#fff}.cf .cf-go[disabled]{opacity:.75;cursor:progress}.cf .cf-x{border:1px solid var(--border,#d7dce5);background:var(--surface,#fff);color:inherit}"
    + ".cf .cf-spin{display:inline-block;width:16px;height:16px;margin-right:8px;vertical-align:-3px;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;animation:cfSpin .8s linear infinite}@keyframes cfSpin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.cf .cf-spin{animation:none}}"
    + ".cf .cf-ok{padding:16px;border-radius:14px;background:color-mix(in srgb,var(--zn,#1F3A87) 8%,transparent);font-size:15px}.cf .cf-ok b{display:block;margin-bottom:4px;font-size:17px;color:var(--zn,#1F3A87)}"
    + ".cf-sh{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-end;justify-content:center}.cf-sh-bg{position:absolute;inset:0;background:rgba(10,14,22,.45)}"
    + ".cf-sh-in{position:relative;box-sizing:border-box;width:100%;max-width:560px;max-height:calc(100dvh - 24px);overflow:auto;padding:10px 20px calc(18px + env(safe-area-inset-bottom));border-radius:20px 20px 0 0;background:var(--surface,#fff);box-shadow:0 -8px 30px rgba(0,0,0,.18);overscroll-behavior:contain}"
    + ".cf-sh-h{display:block;width:40px;height:4px;margin:0 auto 10px;border-radius:2px;background:var(--border,#d7dce5)}"
    + "@media (min-width:700px){.cf-sh{align-items:center}.cf-sh-in{border-radius:20px;padding-bottom:20px}}"
    + "html.cf-on{overflow:hidden}"
    + ":root[data-theme=dark] .cf .cf-k input:checked+span,:root[data-theme=dark] .cf .cf-go{background:#9FB3FF;border-color:#9FB3FF;color:#0B1530}:root[data-theme=dark] .cf .cf-ok b{color:#9FB3FF}:root[data-theme=dark] .cf .cf-r input:checked+span{border-color:#9FB3FF;box-shadow:inset 0 0 0 1px #9FB3FF}:root[data-theme=dark] .cf .cf-spin{border-color:rgba(11,21,48,.35);border-top-color:#0B1530}"
    + "@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .cf .cf-k input:checked+span,:root:not([data-theme=light]) .cf .cf-go{background:#9FB3FF;border-color:#9FB3FF;color:#0B1530}:root:not([data-theme=light]) .cf .cf-ok b{color:#9FB3FF}:root:not([data-theme=light]) .cf .cf-r input:checked+span{border-color:#9FB3FF;box-shadow:inset 0 0 0 1px #9FB3FF}:root:not([data-theme=light]) .cf .cf-spin{border-color:rgba(11,21,48,.35);border-top-color:#0B1530}:root:not([data-theme=light]) .cf-sh-in{background:var(--surface,#181C24);color:var(--text-1,#E6EAF2)}:root:not([data-theme=light]) .cf textarea,:root:not([data-theme=light]) .cf input[type=email],:root:not([data-theme=light]) .cf .cf-k span{background:var(--surface,#181C24);color:var(--text-1,#E6EAF2);border-color:var(--border,#2E3644)}:root:not([data-theme=light]) .cf{color:var(--text-1,#E6EAF2)}}";
  function style() { if (D.getElementById("cfCss")) return; var s = D.createElement("style"); s.id = "cfCss"; s.textContent = CSS; (D.head || D.documentElement).appendChild(s); }
  var seq = 0;
  // 양식 하나 만들기 → {el, focus()}
  function build(opts, onClose) {
    style();
    opts = opts || {};
    var n = ++seq, P = "cf" + n + "_", ctx = opts.ctx || {};
    var dr = ls.get() || {};
    var kind0 = opts.kind || dr.kind || "general"; if (!KINDS.some(function (k) { return k[0] === kind0; })) kind0 = "general";
    var f = D.createElement("form");
    f.className = "cf"; f.noValidate = true; f.setAttribute("aria-labelledby", P + "t");
    var rs = opts.reasons || [];
    f.innerHTML = '<h3 id="' + P + 't">' + esc(opts.title || "문의하기") + "</h3>" + (opts.meta ? '<p class="cf-meta">' + esc(opts.meta) + "</p>" : "")
      + (rs.length ? '<fieldset class="cf-r"><legend>어디가 틀렸나요</legend>' + rs.map(function (r, i) { return '<label><input type="radio" name="' + P + 'why" value="' + esc(r[0]) + '"' + (i ? "" : " checked") + '><span><b>' + esc(r[1]) + "</b>" + (r[2] ? "<small>" + esc(r[2]) + "</small>" : "") + "</span></label>"; }).join("") + "</fieldset>" : "")
      + '<fieldset><legend>종류</legend><div class="cf-k">' + KINDS.map(function (k) { return '<label><input type="radio" name="' + P + 'kind" value="' + k[0] + '"' + (k[0] === kind0 ? " checked" : "") + "><span>" + k[1] + "</span></label>"; }).join("") + "</div></fieldset>"
      + '<div><label class="cf-l" for="' + P + 'tx">내용 <small>(' + MIN + "자 이상)</small></label>"
      + '<textarea id="' + P + 'tx" name="text" maxlength="' + MAX + '" required aria-required="true" aria-describedby="' + P + "cnt " + P + 'txe" placeholder="' + esc(opts.ph || "무엇이 궁금하거나 불편했는지 적어 주세요") + '"></textarea>'
      + '<div class="cf-rw"><p class="cf-err" id="' + P + 'txe" hidden></p><span class="cf-cnt" id="' + P + 'cnt" aria-live="polite">0 / ' + fmt(MAX) + "</span></div></div>"
      + '<div><label class="cf-l" for="' + P + 'em">답장 받을 이메일 <small>(안 적어도 돼요)</small></label>'
      + '<input id="' + P + 'em" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" aria-describedby="' + P + "emn " + P + 'eme">'
      + '<p class="cf-note" id="' + P + 'emn">적으면 이 주소로 답장드려요. 안 적으면 답장은 못 드려요.</p><p class="cf-err" id="' + P + 'eme" hidden></p></div>'
      + '<div class="cf-hp" aria-hidden="true"><label>웹사이트<input name="website" tabindex="-1" autocomplete="off"></label></div>'
      + '<p class="cf-st" id="' + P + 'st" role="status" aria-live="polite"></p>'
      + '<div class="cf-ft">' + (onClose ? '<button type="button" class="cf-x">닫기</button>' : "") + '<button type="submit" class="cf-go">보내기</button></div>';
    var $ = function (s) { return f.querySelector(s); };
    var tx = $("textarea"), em = $('input[type="email"]'), cnt = $(".cf-cnt"), st = $(".cf-st"), go = $(".cf-go");
    if (dr.text) tx.value = dr.text;
    if (dr.email) em.value = dr.email;
    var kindV = function () { var c = f.querySelector('input[name="' + P + 'kind"]:checked'); return c ? c.value : "general"; };
    var whyV = function () { var c = f.querySelector('input[name="' + P + 'why"]:checked'); if (!c) return ""; var r = rs.filter(function (x) { return x[0] === c.value; })[0]; return r ? r[1] : c.value; };
    var count = function () { var l = tx.value.trim().length; cnt.textContent = fmt(tx.value.length) + " / " + fmt(MAX); cnt.classList.toggle("over", tx.value.length > MAX); return l; };
    var save = function () { ls.set({ kind: kindV(), text: tx.value, email: em.value, at: Date.now() }); };
    var saveT = 0;
    var err = function (inp, id, msg) { var e = f.querySelector("#" + P + id); e.hidden = !msg; e.textContent = msg || ""; inp.setAttribute("aria-invalid", msg ? "true" : "false"); };
    tx.addEventListener("input", function () { count(); if (tx.getAttribute("aria-invalid") === "true" && tx.value.trim().length >= MIN) err(tx, "txe", ""); clearTimeout(saveT); saveT = setTimeout(save, 300); });
    em.addEventListener("input", function () { if (em.getAttribute("aria-invalid") === "true" && (!em.value.trim() || EMAIL.test(em.value.trim()))) err(em, "eme", ""); clearTimeout(saveT); saveT = setTimeout(save, 300); });
    f.addEventListener("change", function (e) { if (e.target.name === P + "kind") save(); });
    count();
    var busy = false;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      var t = tx.value.trim(), m = em.value.trim(), bad = null;
      if (t.length < MIN) { err(tx, "txe", t.length ? "조금만 더 적어 주세요 · " + MIN + "자 이상" : "내용을 적어 주세요"); bad = bad || tx; } else if (t.length > MAX) { err(tx, "txe", fmt(MAX) + "자까지 쓸 수 있어요"); bad = bad || tx; } else err(tx, "txe", "");
      if (m && !EMAIL.test(m)) { err(em, "eme", "이메일 주소를 다시 확인해 주세요 (예: name@example.com)"); bad = bad || em; } else err(em, "eme", "");
      clearTimeout(saveT);
      if (bad) { st.className = "cf-st bad"; st.textContent = "고칠 곳이 있어요"; bad.focus(); return; }
      save();
      if (W.navigator && navigator.onLine === false) { st.className = "cf-st bad"; st.textContent = "오프라인이에요. 연결되면 다시 보내 주세요"; return; }
      busy = true; go.disabled = true; go.setAttribute("aria-busy", "true"); go.innerHTML = '<span class="cf-spin" aria-hidden="true"></span>보내는 중…'; st.className = "cf-st"; st.textContent = "";
      var body = { kind: kindV(), text: t, email: m, website: (f.querySelector('input[name="website"]') || {}).value || "", zone: ctx.zone || "", url: ctx.url || location.href, asOf: ctx.asOf || "", nums: ctx.nums || "", why: whyV() };
      var done = function (ok, msg) {
        busy = false; go.disabled = false; go.removeAttribute("aria-busy");
        if (ok) {
          ls.del();
          f.innerHTML = '<div class="cf-ok" role="status" tabindex="-1"><b>잘 받았어요.</b>운영자가 직접 읽고, 이메일을 남기셨다면 며칠 안에 답장드려요.</div><div class="cf-ft"><button type="button" class="cf-x">닫기</button></div>';
          var x = f.querySelector(".cf-x"); x.onclick = function () { if (onClose) onClose(); else { var nf = build(opts, null); f.replaceWith(nf.el); nf.focus(); } };
          f.querySelector(".cf-ok").focus();
          try { W.dispatchEvent(new CustomEvent("zp:contact", { detail: { ok: true } })); } catch (e2) {}
          return;
        }
        go.textContent = "다시 시도"; st.className = "cf-st bad"; st.textContent = msg;
      };
      var ctl = W.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
      fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined, credentials: "same-origin" })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
        .then(function (x) {
          clearTimeout(tm);
          if (x.r.ok && x.j && x.j.ok) return done(true);
          done(false, x.r.status === 429 ? "보내지 못했어요 · 잠시 뒤에 다시 시도해 주세요(1시간에 5번까지)" : x.j && x.j.error === "text" ? "보내지 못했어요 · 내용을 " + MIN + "자 이상 적어 주세요" : x.j && x.j.error === "email" ? "보내지 못했어요 · 이메일 주소를 확인해 주세요" : "보내지 못했어요 · 다시 시도");
        })
        .catch(function () { clearTimeout(tm); done(false, navigator.onLine === false ? "오프라인이에요. 연결되면 다시 보내 주세요" : "보내지 못했어요 · 다시 시도"); });
    });
    if (onClose) $(".cf-x").onclick = function () { onClose(); };
    return { el: f, focus: function () { var c = rs.length ? f.querySelector('input[name="' + P + 'why"]:checked') : tx; try { (c || tx).focus({ preventScroll: true }); } catch (e) {} } };
  }
  // 아래에서 올라오는 시트 · 뒤로 가기 = 닫기(앱은 ZL 겹 · 정적 페이지는 history 한 칸)
  var cur = null;
  function open(opts) {
    if (cur) close(true);
    var last = D.activeElement, sh = D.createElement("div");
    sh.className = "cf-sh"; sh.id = "cfSheet"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true");
    sh.innerHTML = '<div class="cf-sh-bg" data-cfx></div><div class="cf-sh-in"><i class="cf-sh-h" aria-hidden="true"></i></div>';
    var me = { sh: sh, last: last, pop: false };
    var F = build(opts, function () { close(); });
    sh.setAttribute("aria-labelledby", F.el.getAttribute("aria-labelledby"));
    sh.querySelector(".cf-sh-in").appendChild(F.el);
    D.body.appendChild(sh); D.documentElement.classList.add("cf-on");
    cur = me;
    sh.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-cfx]")) close(); });
    sh.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== "Tab") return;
      var fs = [].filter.call(sh.querySelectorAll("button,textarea,input:not([tabindex='-1']),[tabindex='0']"), function (x) { return x.offsetParent && !x.disabled && !(x.type === "radio" && !x.checked); });
      if (!fs.length) return;
      if (e.shiftKey && D.activeElement === fs[0]) { e.preventDefault(); fs[fs.length - 1].focus(); } else if (!e.shiftKey && D.activeElement === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); }
    });
    if (W.ZL && ZL.open) { me.zl = 1; ZL.open("contact", function () { close(true); }); }
    else { try { history.pushState({ cf: 1 }, ""); me.hp = 1; } catch (e) {} me.onPop = function () { close(true); }; W.addEventListener("popstate", me.onPop); }
    requestAnimationFrame(F.focus);
    return sh;
  }
  function close(pop) {
    var me = cur; if (!me) return;
    cur = null;
    if (me.onPop) W.removeEventListener("popstate", me.onPop);
    if (pop !== true) { if (me.zl) { try { ZL.done("contact"); } catch (e) {} } else if (me.hp && history.state && history.state.cf) { try { history.back(); } catch (e) {} } }
    me.sh.remove(); D.documentElement.classList.remove("cf-on");
    if (me.last && me.last.isConnected) try { me.last.focus({ preventScroll: true }); } catch (e) {}
  }
  function mount(el, opts) { var F = build(opts, null); el.innerHTML = ""; el.appendChild(F.el); return F; }
  // 정적 페이지·앱 어디서든: [data-zp-contact] 링크·단추는 시트로(스크립트가 없으면 링크대로 /contact 페이지)
  D.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-zp-contact]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    var z = a.getAttribute("data-zone") || "", k = a.getAttribute("data-kind") || "general";
    open({ kind: k, title: a.getAttribute("data-title") || (k === "error" ? "이 숫자가 틀렸어요" : "문의하기"), meta: a.getAttribute("data-meta") || "", ctx: { zone: z, url: location.href, asOf: a.getAttribute("data-asof") || "" }, reasons: k === "error" && z ? REASONS : null });
  });
  var REASONS = [["price", "가격", "지금 필요한 돈·입주까지 현금·시세가 이상해요"], ["stage", "단계", "진행 단계·날짜가 달라요"], ["loc", "위치", "경계·주소·역 거리가 달라요"], ["name", "이름", "구역 이름이 달라요"], ["etc", "기타", "그 밖의 것"]];
  // /contact 페이지: <div data-zp-contact-here> 자리에 바로(주소 ?kind=error&zone=o916 이면 그 값으로)
  function auto() {
    var h = D.querySelector("[data-zp-contact-here]"); if (!h) return;
    var q = new URLSearchParams(location.search), z = /^[A-Za-z0-9_-]{1,24}$/.test(q.get("zone") || "") ? q.get("zone") : "", k = q.get("kind") || "general";
    mount(h, { kind: k, title: h.getAttribute("data-title") || "문의 보내기", ctx: { zone: z, url: z ? location.origin + "/z/" + z : location.href }, reasons: k === "error" && z ? REASONS : null, meta: z ? "구역 ID " + z + "가 함께 가요" : "" });
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", auto); else auto();
  W.ZP_contact = { open: open, close: close, mount: mount, REASONS: REASONS, KINDS: KINDS, draft: ls.get };
})();
