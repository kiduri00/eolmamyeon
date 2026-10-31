/* ===================== 소식 탭(예전 알림함 종) + 웹 푸시 =====================
   소식 화면(#news) 위 칸 '내 조건에 맞는 소식'에 그린다. 새 소식 수는 아래 탭 '관심' 배지.
   알림 종류 끄기: localStorage zp-alert-off ["trade","stage","notice","auction","price"] — 목록·배지·폰 알림(서버 o) 모두에서 뺀다.
   서버 없이 동작: 매일 파이프라인이 만드는 data/changes.json(최근 30일 구역별 사건: 단계·실거래·고시·필요한 돈)에서
   핀 꽂은 구역 것만 골라 보여 주고, 조건 핀은 앱 엔진(PINS.condsAll)의 '새로 들어온 곳'을 그대로 쓴다
   → 조건 핀 '+N 새 구역'은 홈 띠(condBtn)·내 핀 배지와 같은 수(PINS.freshIds).
   읽음: localStorage zp-inbox-seen {at: 마지막으로 연 날의 최신 날짜, k: 그날 본 사건 키}.
   웹 푸시: /api/push/key가 200일 때만(Worker 배포 뒤) '알림 받기'가 보인다. 404·오류면 숨김. */
const INBOX = (() => {
  const SK = "zp-inbox-seen", PK = "zp-push", AK = "zp-push-ask", SYK = "zp-push-sync", OK_ = "zp-alert-off";
  // 알림 종류(MY > 알림 설정). price = 내 돈으로 갈 수 있게 된 곳(조건 알림)
  const KINDS = [["trade", "새 실거래·신고가"], ["stage", "단계 변경·인가"], ["notice", "고시·공고"], ["auction", "경매 물건 등장"], ["price", "내 돈으로 갈 수 있게 된 곳"]];
  const off = () => { const v = lsR(OK_, []); return Array.isArray(v) ? v.filter((k) => KINDS.some((x) => x[0] === k)) : []; };
  const isOff = (k) => off().includes(k);
  const lsR = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const lsW = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let CH = null, CHP = null, SEEN = lsR(SK, null);
  const day = (t) => new Date((t || Date.now()) + 9 * 36e5).toISOString().slice(0, 10);   // 서울 날짜
  const addDay = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const BELL = '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>';
  const bellSvg = (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${BELL}</svg>`;
  const TY = { stage: ["단계", "st"], trade: ["실거래", "tr"], notice: ["고시·공고", "nt"], auction: ["경매", "au"] };

  // ---------- 데이터 ----------
  function load() {
    if (CH) return Promise.resolve(CH);
    return CHP || (CHP = fetch(`data/changes.json?v=${D.upd || D.asOf || ""}-${(D.dv && D.dv.changes) || ""}`)
      .then((r) => (r.ok ? r.json() : null)).then((j) => { CH = j && Array.isArray(j.items) ? j : { asOf: "", items: [] }; return CH; })
      .catch(() => { CHP = null; return null; }));
  }
  const pinIds = () => { try { return PINS.list(); } catch (e) { return []; } };
  // renew-feat F9: 구역별·조건별 끄기(zp-alert-mute {z:[구역 id], c:[조건 id]}) — 끈 구역·조건은 소식 목록·배지·폰 알림(서버로 보내는 목록)에서 뺀다 · 관심 구역·조건 자체는 그대로
  const MUK = "zp-alert-mute";
  const mute = () => { const v = lsR(MUK, {}); return { z: Array.isArray(v && v.z) ? v.z : [], c: Array.isArray(v && v.c) ? v.c : [] }; };
  const pinOn = () => { const m = new Set(mute().z); return pinIds().filter((id) => !m.has(id)); };
  const conds = () => { try { return PINS.condsOn ? PINS.condsOn() : PINS.condsAll(); } catch (e) { return []; } };
  function seen() {
    // 처음 쓰는 기기: 지난 7일 소식만 '새 소식'으로(30일치가 한꺼번에 뜨지 않게)
    if (!SEEN || typeof SEEN.at !== "string" || !Array.isArray(SEEN.k)) { SEEN = { at: addDay((CH && CH.asOf) || day(), -7), k: [] }; lsW(SK, SEEN); }
    return SEEN;
  }
  function pinEvents() {
    if (!CH) return [];
    const P = new Set(pinOn());
    const O = off();
    return uniq(CH.items.filter((e) => P.has(e.id) && TY[e.type] && byId[e.id] && !O.includes(e.type)));
  }
  // 같은 구역·같은 날·같은 글(경매 두 건이 요약이 똑같은 경우 등)은 한 줄로(17차: 소식에 같은 줄이 두 번 보이던 것)
  function uniq(L) { const s = new Set(); return L.filter((e) => { const k = `${e.id}|${e.date}|${e.type}|${e.text}`; if (s.has(k)) return false; s.add(k); return true; }); }
  function unread(e) {
    const s = seen(), pd = day(PINS.snapT(e.id) || 0);
    if (e.date < pd || e.bf) return false;   // 핀 꽂기 전 일·밀린 자료(bf · 사이클 5)는 목록에만(배지·푸시 숫자와 같게)
    return e.date > s.at || (e.date === s.at && !s.k.includes(e.k));
  }
  const freshN = () => { if (isOff("price")) return 0; try { return PINS.freshIds().length; } catch (e) { return 0; } };
  const unreadC = (e) => { const s = seen(); return !e.bf && (e.date > s.at || (e.date === s.at && !s.k.includes(e.k))); };
  // 알림 조건에 맞는 구역의 경매(핀 꽂은 구역은 핀 소식으로 이미 셈)
  // all = true: 꺼 둔 설정(종류·조건)을 무시한 셈(미리 보기 '꺼 둔 설정으로 N건 빠져요'의 기준) · 서버 match(worker/push.js)와 같은 규칙: 관심 구역(끈 구역 포함)은 조건 경로에서 빼고, 최저가 ≤ 조건 현금 × 1.1
  const condAuc = (all) => { if (!CH || (!all && isOff("auction"))) return []; const P = new Set(pinIds()), out = new Map(); (all ? (() => { try { return PINS.condsAll(); } catch (e) { return []; } })() : conds()).forEach((n) => { const I = new Set(n.ids), d0 = day(n.c.at || 0); CH.items.forEach((e) => { if (e.type === "auction" && I.has(e.id) && !P.has(e.id) && byId[e.id] && e.date >= d0 && !(e.mn > n.c.cash * 1.1 + 1e-9)) out.set(e.k, e); }); /* 경매: 대표 물건 최저가가 조건 현금(+10%) 안일 때만 */ }); return [...out.values()]; };
  const count = () => pinEvents().filter(unread).length + freshN() + condAuc().filter(unreadC).length;
  function markSeen() {
    if (!CH) return;
    const at = CH.items.reduce((m, e) => (e.date > m ? e.date : m), seen().at);
    SEEN = { at, k: CH.items.filter((e) => e.date === at).map((e) => e.k) };
    lsW(SK, SEEN);
    lsW("zp-seen-t", Date.now());   // 사이클 5 D: '지난번(날짜) 본 뒤'의 날짜 = 이 기기에서 소식·관심을 마지막으로 연 때(기기에만)
    try { PINS.markCondSeen(); } catch (e) {}
    paint();
  }

  // ---------- 배지: 아래 탭 '관심'에 새 소식 수(관심 구역·알림 조건) ----------
  // 소식 자료(changes.json)를 받기 전에는 70_pins가 쓴 수를 그대로 둔다
  function paint() {
    let n = 0; try { n = count(); } catch (e) {}
    const nb = document.querySelector('#sNav [data-nav="fav"]');
    if (nb && CH) {
      let i = nb.querySelector(".pn-nb");
      if (!i) { i = document.createElement("b"); i.className = "pn-nb"; i.setAttribute("aria-hidden", "true"); nb.appendChild(i); }
      i.hidden = !n; i.textContent = n > 9 ? "9+" : String(n);
      let fl = 0; try { fl = pinIds().length; } catch (e) {}
      nb.setAttribute("aria-label", `관심 구역 ${fl}곳${n ? `, 새 소식 ${n}건` : ""}`);
    }
    // 앱 아이콘 숫자(setAppBadge): 데스크톱 설치 앱(Windows·macOS 크롬 등)에서만 보인다 = 관심 탭 숫자 · 소식을 보면 0.
    // Android(크롬·TWA)는 Badging API를 지원하지 않는다 — 아이콘 점은 알림 서랍에 아침 알림(jp-날짜)이 남아 있을 때만 생기고, 소식 탭을 열면 그 알림을 닫아 점도 사라진다(73_today.js)
    try { if (installed() && navigator.setAppBadge && CH) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) {}
  }
  const installed = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } };

  // ---------- 소식 목록(내 조건에 맞는 소식) ----------
  const dLabel = (d) => { const t = day(); if (d === t) return "오늘"; if (d === addDay(t, -1)) return "어제"; const x = new Date(d + "T00:00:00Z"); return `${x.getUTCMonth() + 1}.${x.getUTCDate()} (${"일월화수목금토"[x.getUTCDay()]})`; };
  function condHTML() {
    const A = CH ? uniq(CH.items.filter((e) => e.type === "auction" && byId[e.id])) : [], P = new Set(pinIds());
    const noAu = isOff("auction"), noAdd = isOff("price");
    const MZ = new Set(mute().z);   // 사이클 4: 끈 구역 = 그 구역 알림 전부 끔(조건 '새로 갈 수 있게 된 곳'·경매 경로 포함 · 워커 match와 같은 규칙)
    const L = conds().map((n) => { const I = new Set(n.ids.filter((id) => !MZ.has(id))); n = Object.assign({}, n, { add: noAdd ? [] : (n.add || []).filter((id) => !MZ.has(id)) }); return Object.assign(n, { au: noAu ? [] : A.filter((e) => I.has(e.id) && !P.has(e.id) && e.date >= day(n.c.at || 0) && !(e.mn > n.c.cash * 1.1 + 1e-9)) })   /* 경매: 조건 현금(+10%)을 넘는 물건은 '갈 수 있는 곳'에 넣지 않는다(condAuc·푸시와 같은 기준) */; }).filter((n) => n.add.length || n.au.length);
    if (!L.length) return "";
    const F = new Set(freshN() ? PINS.freshIds() : []);
    return `<section class="ib-sec" aria-labelledby="ibCT"><h4 id="ibCT">내 돈으로 새로 갈 수 있게 된 곳</h4>${L.map((n) => {
      const f = n.add.filter((id) => F.has(id)).length;
      const au = n.au.slice(0, 3).map((e) => { const r = byId[e.id], nw = unreadC(e); return `<li><button type="button" class="ib-it${nw ? " new" : ""}" data-open="${e.id}"><span class="ib-tg au">경매</span><span class="ib-tx"><b>${esc(shortName(r.n))}</b><small>${esc(e.text)}</small></span>${nw ? '<i class="ib-dot" aria-label="새 소식"></i>' : ""}</button></li>`; }).join("");
      return `<div class="ib-cond"><p class="ib-ch"><b>${esc(n.c.name)}</b>${f ? `<em class="pc-nb">+${f} 새 구역</em>` : n.add.length ? `<small>새로 들어온 곳 ${n.add.length}곳</small>` : ""}</p><ul>${au}${n.add.slice(0, 5).map((id) => { const r = byId[id]; if (!r) return ""; let wy = ""; try { wy = PINS.whyNew(n.c, id); } catch (e) {} return `<li><button type="button" class="ib-it${F.has(id) ? " new" : ""}" data-open="${id}"><span class="ib-tg cd">조건</span><span class="ib-tx"><b>${esc(shortName(r.n))}</b><small>${esc(stageName(r))}${wy ? ` · ${esc(wy)}` : ""}</small></span>${F.has(id) ? '<i class="ib-dot" aria-label="새 소식"></i>' : ""}</button></li>`; }).join("")}${n.add.length > 5 ? `<li class="ib-more">외 ${n.add.length - 5}곳 · 관심 구역 화면에서 모두 보기</li>` : ""}</ul></div>`;
    }).join("")}</section>`;
  }
  function pinHTML() {
    const P = pinIds();
    if (!P.length) return conds().length ? "" : `<div class="ib-empty">${bellSvg(30)}<p><b>관심 구역 소식을 여기 모아 드려요</b><br>구역에서 '♡ 관심 구역에 추가'를 누르면 새 실거래·단계·경매 소식을 알려 드려요</p><button type="button" class="btn primary sm" data-ibmap>지도에서 구역 고르기</button></div>`;
    if (!CH) return `<p class="ib-note">소식을 불러오는 중이에요…</p>`;
    const E = pinEvents();
    if (!E.length) return `<section class="ib-sec" aria-labelledby="ibPT"><h4 id="ibPT">관심 구역 소식</h4><p class="ib-note ib-none">최근 30일 동안 관심 구역 ${P.length}곳에 새 소식이 없어요${asOfD() ? ` <span class="nw">(${asOfD()} 기준)</span>` : ""}</p></section>`;
    const by = new Map(); E.slice(0, 80).forEach((e) => { if (!by.has(e.date)) by.set(e.date, []); by.get(e.date).push(e); });
    return `<section class="ib-sec" aria-labelledby="ibPT"><h4 id="ibPT">관심 구역 소식</h4>${[...by].map(([d, L]) => `<h5 class="ib-d">${dLabel(d)}</h5><ul>${L.map((e) => { const r = byId[e.id], [tl, tc] = TY[e.type], nw = unread(e); return `<li><button type="button" class="ib-it${nw ? " new" : ""}" data-open="${e.id}"><span class="ib-tg ${e.hi ? "hi" : tc}">${e.hi ? "신고가" : tl}</span><span class="ib-tx"><b>${esc(shortName(r.n))}</b><small>${esc(e.text)}${e.type === "auction" && overCash(e) ? " · 참고 · 내 돈 초과" : ""}</small></span>${nw ? '<i class="ib-dot" aria-label="새 소식"></i>' : ""}</button></li>`; }).join("")}</ul>`).join("")}</section>`;
  }
  // 핀 구역 경매: 대표 최저가가 지금 내 돈(+10%)을 넘으면 '참고'로 표시
  const overCash = (e) => { let c = null; try { c = CASH; } catch (er) {} return c != null && e.mn > c * 1.1 + 1e-9; };
  // 28차: 기준일은 앱 머리 'N.NN 갱신'과 같은 한 곳(D.upd)에서 — 알림 자료(changes.json asOf)가 하루 어긋나 '10.24 기준' vs '10.25 갱신'이던 것
  const asOfD = () => { let u = ""; try { u = String((typeof D !== "undefined" && (D.upd || D.asOf)) || (CH && CH.asOf) || ""); } catch (e) {} const m = /(\d{4})-?(\d\d)-?(\d\d)/.exec(u); return m ? `${+m[2]}.${m[3]}` : ""; };
  // 사이클 2: '새 소식'의 기준을 밝힌다 — 날짜 머리는 자료에 새로 올라온 날(실거래는 신고 등록일) · 실거래 줄의 'N.N 계약'은 계약일(넉 달 전 계약이 새 소식으로 보이던 혼동)
  const foot = () => (CH && asOfD() ? `<p class="ib-foot">최근 ${CH.days || 30}일 · 매일 아침 갱신 <span class="nw">(${asOfD()} 기준)</span><br>날짜는 자료에 새로 올라온 날(실거래는 신고 등록일)이에요 · 실거래 줄의 '○.○ 계약'은 계약한 날</p>` : "");
  function body() { const ph = pinHTML(); return `${pushBox()}${condHTML()}${ph}${/ib-none|ib-empty/.test(ph) && !condHTML() ? "" : foot()}`; }   // 28차: 소식이 없으면 기준일을 그 줄에 붙이고 아래 줄은 뺀다(빈 카드 여백)
  // 소식 화면(#news) 위 칸에 그린다 · 화면을 열면 소식을 받아 다시 그리고 잠시 뒤 읽음 처리
  const box = () => $("nwMine");
  const shown = () => { const s = $("news"); return !!(s && s.classList.contains("s-on")); };
  function rerender() { const el = box(); if (el && shown()) el.innerHTML = body(); try { window.dispatchEvent(new Event("zp:alerts")); } catch (e) {} }
  let seenT = 0;
  function view() {
    const el = box(); if (!el) return;
    el.innerHTML = body();
    clearTimeout(seenT);
    load().then(() => { if (!shown()) return; rerender(); seenT = setTimeout(() => { if (shown()) markSeen(); }, 600); });
    pushKey().then(() => { if (shown()) rerender(); });
  }
  function open() { try { if (typeof SIMPLE !== "undefined" && SIMPLE.open("news")) return; } catch (e) {} location.hash = "#news"; }
  function bindBox() {
    const el = box(); if (!el || el.dataset.on) return; el.dataset.on = "1";
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-ibmap]")) { try { SIMPLE.close(); } catch (e2) {} requestAnimationFrame(() => { const m = $("mapTop"); if (m) window.scrollTo({ top: m.getBoundingClientRect().top + scrollY - HDR() - 8, behavior: "auto" }); }); return; }
      if (e.target.closest("[data-ibon]")) { subscribe(e.target.closest("[data-ibon]")); return; }
      if (e.target.closest("[data-iboff]")) { unsubscribe(); return; }
    });
  }

  // ---------- 웹 푸시 ----------
  const okHost = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const canPush = () => okHost && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  let KEY, KEYP = null, PMSG = "";
  // Worker가 배포되기 전(정적 404)·오류면 null → 알림 받기 버튼은 아예 안 보인다
  const pushKey = () => {
    if (!canPush()) return Promise.resolve(null);
    if (KEY !== undefined) return Promise.resolve(KEY);
    return KEYP || (KEYP = fetch("/api/push/key", { cache: "no-store", headers: { Accept: "application/json" } })
      .then((r) => (r.ok && /json/.test(r.headers.get("content-type") || "") ? r.json() : null))
      .then((j) => (KEY = j && typeof j.key === "string" && /^[A-Za-z0-9_-]{80,100}$/.test(j.key) ? j.key : null))
      .catch(() => { KEYP = null; KNET = true; KEY = undefined; return null; }));   // 27차: 네트워크 실패(오프라인)는 '안 되는 브라우저'가 아니다 — 다음에 다시 받는다
  };
  let KNET = false;
  try { addEventListener("online", () => { if (KNET) { KNET = false; pushKey(); } }); } catch (e) {}
  const P_OFF = "오프라인이라 지금은 켤 수 없어요 · 연결되면 다시 눌러 주세요";
  const isOn = () => !!(lsR(PK, null) || {}).on;
  function pushBox() {
    if (!KEY || !canPush()) return "";
    const perm = Notification.permission;
    if (isOn() && perm === "granted") return `<div class="ib-push on" role="group" aria-label="폰 알림">${bellSvg(18)}<span><b>폰 알림 켜짐</b><small>아침에 관심 구역·알림 조건 새 소식이 있으면 알려 드려요</small></span><button type="button" class="btn text sm" data-iboff>끄기</button></div>`;
    if (perm === "denied") return `<div class="ib-push" role="group" aria-label="폰 알림">${bellSvg(18)}<span><b>알림이 막혀 있어요</b><small>${TAPP() ? `폰 ${TSET()}에서 허용한 뒤 다시 열어 주세요` : "주소창 왼쪽 자물쇠(사이트 설정) → 알림 허용 뒤 다시 열어 주세요"}</small></span></div>`;
    if (PMSG === P_FAIL) return `<div class="ib-push" role="group" aria-label="폰 알림">${bellSvg(18)}<span><b>폰 알림을 켤 수 없어요</b><small>${TAPP() ? "이 기기에선 안 돼요" : "이 브라우저에선 안 돼요"} · 새 소식은 여기 소식 탭에 모아 드려요</small></span></div>`;
    return `<div class="ib-push" role="group" aria-label="폰 알림">${bellSvg(18)}<span><b>새 소식을 폰 알림으로 받기</b><small>${PMSG ? esc(PMSG) : "새 실거래·단계·경매, 갈 수 있게 된 곳"}</small></span><button type="button" class="btn primary sm" data-ibon>알림 받기</button></div>`;
  }
  const u8 = (s) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  const b64 = (buf) => { const a = new Uint8Array(buf); let s = ""; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const swReady = (ms = 8000) => Promise.race([navigator.serviceWorker.getRegistration("/").then((r) => r || navigator.serviceWorker.register("/sw.js", { scope: "/" })).then(() => navigator.serviceWorker.ready), new Promise((_, no) => setTimeout(() => no(new Error("sw")), ms))]);
  // 사이클 4: mz = 끈 구역(서버가 조건·경매·필요한 돈(price) 경로에서도 그 구역을 빼게 · worker/push.js match)
  // 사이클 5(A): 알림 빈도 f = i 중요한 것만(기본) · d 매일 · w 주 1회 — localStorage zp-push-freq · 서버(worker/push.js)가 거른다
  const FQK = "zp-push-freq", freq = () => { const v = lsR(FQK, "i"); return v === "d" || v === "w" ? v : "i"; };
  const setFreq = (f) => { lsW(FQK, f === "d" || f === "w" ? f : "i"); sync(true); };
  const payload = (sub) => { const muteZ = new Set(mute().z); return { sub: sub.toJSON(), f: freq(), o: off(), zones: pinOn().slice(0, 20), mz: [...muteZ].slice(0, 200), conds: conds().map((n) => ({ n: n.c.name, cash: n.c.cash, mode: n.c.mode, gu: n.c.gu || "", kind: n.c.kind || "", minS: n.c.minS || 0, z: condZ(n.ids, muteZ) })) }; };
  // 사이클 3(F9): 조건 구역은 경매 소식이 있는 구역 먼저, 상한 500(worker/push.js MAXCZ와 같음) — 150에서 잘려 앱 소식(condAuc)에는 있는데 폰 알림이 오지 않던 것
  const CZMAX = 500;
  const condZ = (ids, muteZ) => { const A = new Set(CH ? CH.items.filter((e) => e.type === "auction").map((e) => e.id) : []), L = ids.filter((id) => !muteZ.has(id)); return L.filter((id) => A.has(id)).concat(L.filter((id) => !A.has(id))).slice(0, CZMAX); };   // 사이클 2: 끈 구역은 조건 경로(conds[].z)에서도 뺀다(서버가 조건 경매로 보내던 누수)
  // 시간 제한: 구독·서버 저장이 멈춰도 '켜는 중…'에 갇히지 않게(8초)
  const tmo = (p, ms, tag) => { let t; return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error(tag || "timeout")), ms); })]).finally(() => clearTimeout(t)); };
  const postSub = (sub) => {
    const ac = "AbortController" in window ? new AbortController() : null, t = setTimeout(() => ac && ac.abort(), 8000);
    return tmo(fetch("/api/push/sub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(sub)), signal: ac ? ac.signal : undefined }), 8000, "sub")
      .then((r) => { if (!r.ok) throw new Error("sub " + r.status); lsW(SYK, day()); return r; }).finally(() => clearTimeout(t));
  };
  // 구독 키가 서버 키와 다르면(서버 키를 바꾼 경우) 새로 구독
  const sameKey = (sub) => { try { const k = sub.options && sub.options.applicationServerKey; return !k || b64(k) === KEY; } catch (e) { return true; } };
  async function getSub(create) {
    const reg = await swReady();
    let sub = await tmo(reg.pushManager.getSubscription(), 8000, "get");
    if (sub && !sameKey(sub)) { try { await sub.unsubscribe(); } catch (e) {} sub = null; }
    if (!sub && create) sub = await tmo(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(KEY) }), 8000, "subscribe");
    return sub;
  }
  let P_FAIL = "이 브라우저에선 폰 알림을 켤 수 없어요 · 소식 탭에 모아 드려요";
  // 설치 앱(html.is-tapp · 안드로이드 앱)에는 주소창이 없다 → 폰 설정에서 푸는 길
  const TAPP = () => document.documentElement.classList.contains("is-tapp");
  const TSET = () => (/iPhone|iPad|iPod/.test(navigator.userAgent) ? `설정 → 알림 → ${BRAND}` : `설정 → 애플리케이션(또는 앱) → ${BRAND} → 알림`);
  let P_DENY = "알림이 막혀 있어요 · 주소창 왼쪽 자물쇠(사이트 설정)에서 알림을 허용해 주세요";
  if (TAPP()) P_DENY = `알림이 막혀 있어요 · 폰 ${TSET()}에서 허용해 주세요`;
  if (TAPP()) P_FAIL = "이 기기에선 폰 알림을 켤 수 없어요 · 소식 탭에 모아 드려요";
  // 성공은 서버가 구독을 받았다고 답한 뒤에만. 실패하면 버튼을 되돌리고 이유를 보여 준다. 결과 { ok, msg, denied }
  async function subscribe(btn) {
    const lbl = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.textContent = "켜는 중…"; }
    PMSG = ""; let res = { ok: false, msg: P_FAIL };
    try {
      if (!(await tmo(pushKey(), 8000, "key"))) throw new Error("key");
      // 권한 창은 사람이 고르는 시간이라 넉넉히(그래도 끝없이 기다리진 않음)
      const perm = Notification.permission === "granted" ? "granted" : await tmo(Promise.resolve(Notification.requestPermission()), 60000, "perm");
      try { window.dispatchEvent(new CustomEvent("push:perm", { detail: perm })); } catch (e) {}   // 홈 알림 카드가 '알림 켜짐'을 고쳐 쓰게(70_pins condBtn)
      if (perm === "denied") res = { ok: false, msg: P_DENY, denied: true };
      else if (perm !== "granted") res = { ok: false, msg: "알림을 허용해야 받을 수 있어요" };
      else {
        const sub = await getSub(true);
        if (!sub) throw new Error("nosub");
        await postSub(sub);
        lsW(PK, { on: 1, at: Date.now() });
        res = { ok: true, msg: "" };
      }
    } catch (e) { res = { ok: false, msg: navigator.onLine === false || KNET ? P_OFF : P_FAIL }; }
    PMSG = res.ok ? "" : res.msg;
    if (btn && btn.isConnected && !res.ok) { btn.disabled = false; btn.removeAttribute("aria-busy"); btn.innerHTML = lbl; }
    if (res.ok) { tst("폰 알림 켰어요", "아침에 새 소식이 있으면 알려 드려요"); setTimeout(() => { try { window.ZP_INSTALL && ZP_INSTALL.offer("push"); } catch (e) {} }, 3600); }
    rerender();
    return res;
  }
  async function unsubscribe() {
    try { const sub = await getSub(false); if (sub) { const ep = sub.endpoint; await sub.unsubscribe(); await fetch("/api/push/unsub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: ep }) }).catch(() => {}); } } catch (e) {}
    lsW(PK, { on: 0 });
    rerender();
    tst("폰 알림 껐어요", "소식 탭은 그대로 볼 수 있어요");
  }
  // 핀·조건이 바뀌면 서버의 구역 목록도 맞춘다(2초 모아서). 켜 둔 기기에서는 하루 한 번 다시 확인(키 바뀜·구독 사라짐)
  let syT = 0;
  function sync(force) {
    if (!isOn() || !canPush()) return;
    clearTimeout(syT);
    syT = setTimeout(async () => {
      try {
        if (!(await pushKey())) return;
        if (Notification.permission !== "granted") { lsW(PK, { on: 0 }); return; }
        if (!force && lsR(SYK, "") === day()) return;
        const sub = await getSub(true);
        if (sub) await postSub(sub);
      } catch (e) {}
    }, force ? 2000 : 4000);
  }
  const tst = (a, b) => { try { const t = document.createElement("div"); t.className = "ib-toast"; t.setAttribute("role", "status"); t.innerHTML = `${bellSvg(18)}<span><b>${esc(a)}</b><small>${esc(b)}</small></span>`; document.body.appendChild(t); requestAnimationFrame(() => t.classList.add("on")); setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 300); }, 3200); } catch (e) {} };

  // ---------- '알림 받을 준비' 시트: 첫 핀·첫 알림 조건 뒤에 한 번 ----------
  // 사이클 5 D: 시트 그리기는 지연 묶음(src/todayd 50_watch.js · 같은 동작)으로 옮겼다 — 첫 묶음(a) 무게를 늘리지 않게. 한 번만 뜨는 표시(zp-watch-*)는 여기서
  let prevN = -1;
  function watch(kind, id) {
    const K = kind === "cond" ? "zp-watch-cond" : "zp-watch-pin";
    if (lsR(K, 0) || $("wsSheet")) return;
    lsW(K, 1);
    if (isOn() && Notification.permission === "granted") return;   // 이미 폰 알림을 받는 기기
    try { TDAY.wLoad().then((Y) => Y.watch(TDAY.ctx(), kind, id, { subscribe, pushKey, tst, bellSvg, P_FAIL: () => P_FAIL })).catch(() => {}); } catch (e) {}
  }
  function onPins(ids) {
    const n = ids.length, was = prevN; prevN = n;
    if (n > was && was >= 0 && !(Date.now() - (window.__zpImport || 0) < 8000)) {
      // 첫 관심 구역: '알림 받을 준비' 시트(설치 권유 포함) · 그 뒤로는 관심 구역을 더한 직후에만 설치 권유 카드(닫으면 30일 쉼, 69_install)
      // 꽂기 토스트('실행 취소')가 떠 있는 동안은 기다렸다가(되돌릴 틈을 남김 · 되돌리면 시트 없음) — 예전엔 0.9초 만에 시트가 토스트를 걷어 냈다
      // 첫 관심 구역의 '알림 받을 준비'는 꽂기 토스트 안 '알림 켜기' 버튼으로만(70_pins notify) — 시트가 상세·토스트 위에 저절로 겹치지 않게
      if (Date.now() - (window.__zpOffer || 0) < 15000 || !lsR("zp-watch-pin", 0)) return;
      setTimeout(() => { try { if ($("pnToast") && $("pnToast").classList.contains("on")) return; if (document.querySelector(".pn-ov, .dt-rs, html.bs-on")) return; window.ZP_INSTALL && ZP_INSTALL.offer("pin"); } catch (e) {} }, 4600);
    }
  }

  // 알림을 눌러 열린 창: 서비스 워커가 {t:"zp-open", url} → 구역 열기 또는 소식 화면
  function go(url) {
    let h = ""; try { h = new URL(url, location.origin).hash.slice(1); } catch (e) {}
    if (h === "inbox" || h === "news") return open();
    if (byId[h]) { if (location.hash.slice(1) === h) { try { curTab = "money"; select(h, true, false, { scroll: true }); } catch (e) {} } else location.hash = "#" + h; }
  }

  function init() {
    paint(); bindBox();
    // 예전 알림 주소 #inbox(서버가 보내는 폰 알림 링크) = 소식 화면
    if ((location.hash || "") === "#inbox") { try { history.replaceState(history.state, "", location.pathname + location.search + "#news"); } catch (e) {} setTimeout(open, 300); }
    addEventListener("zp:view", (e) => { if (e.detail === "news") view(); else if (e.detail === "favTop") load().then(() => setTimeout(markSeen, 1200)); });
    if (shown()) view();
    // 핀·조건 핀이 있을 때만 미리 받아 배지 계산(없으면 열 때 받음)
    const pre = () => { if (pinIds().length || conds().length) load().then(paint); };
    "requestIdleCallback" in window ? requestIdleCallback(pre, { timeout: 3000 }) : setTimeout(pre, 1500);
    prevN = pinIds().length;
    try { PINS.on((ids) => { onPins(ids); sync(true); paint(); rerender(); if (ids.length && !CH) load().then(paint); }); } catch (e) {}
    try { navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.t === "zp-open") go(e.data.url); }); } catch (e) {}
    setTimeout(() => sync(false), 5000);
  }
  // 관심 구역 화면(70_pins)에서 쓰는 것: 구역별 최근 소식·이번 주 소식
  const evOf = (id) => (CH ? CH.items.filter((e) => e.id === id && TY[e.type]) : []);
  const week = () => { const d0 = addDay(day(), -6); return pinEvents().filter((e) => e.date >= d0); };
  // MY > 알림 설정에서 쓰는 것: 폰 알림 상태(st) · 켜기/끄기 · 종류별 끄기
  const st = () => ({ can: (!!KEY || KNET || (KEY === undefined && navigator.onLine === false)) && canPush(), on: isOn() && canPush() && Notification.permission === "granted", perm: canPush() ? Notification.permission : "unsupported", msg: PMSG });
  function setMute(t, id, on) { const m = mute(), L = new Set(m[t]); if (on) L.delete(id); else L.add(id); m[t] = [...L]; lsW(MUK, m); paint(); try { window.NEWB && NEWB.paint(); } catch (e) {} rerender(); sync(true); }
  const isMuted = (t, id) => mute()[t].includes(id);
  function setKind(k, on) { const O = new Set(off()); if (on) O.delete(k); else O.add(k); lsW(OK_, [...O]); paint(); try { window.NEWB && NEWB.paint(); } catch (e) {} rerender(); sync(true); }
  // 사이클 5(A): 오늘 묶음(/b/n.*.js · window.ZP_today) — 화면에 보일 때 부른다. 부르는 코드는 73_today.js 한 곳(D 화면 묶음과 같은 로더 · 첫 묶음 무게)
  const today = () => TDAY.nLoad();
  return { brk: () => { const P = pinEvents().filter(unread), c = freshN() + condAuc().filter(unreadC).length; return { n: P.length + c, pin: P.length, zones: new Set(P.map((e) => e.id)).size, cond: c, ev: P }; }, unreadOf: (id) => pinEvents().filter((e) => e.id === id && unread(e)), priceSince: (id, gap) => { if (!CH) return null; const s0 = seen(), m = gap ? "g" : "c", L = CH.items.filter((e) => e.type === "price" && e.id === id && e.v && !e.bf && Array.isArray(e.v[m]) && (e.date > s0.at || (e.date === s0.at && !s0.k.includes(e.k)))).sort((a, b) => (a.date < b.date ? -1 : 1)); return L.length ? L[L.length - 1].v[m][1] - L[0].v[m][0] : null; }, init, paint, open, count, load, today, freq, setFreq, pushKey, watch, evOf, week, ready: () => !!CH, TY, dLabel: (d) => dLabel(d), st, subscribe, unsubscribe, KINDS, isOff, setKind, setMute, isMuted, d0: () => addDay(day(), -6), asOf: () => (CH ? CH.asOf || "" : ""), pinEvents: () => pinEvents(), condAuc: (all) => condAuc(all), payloadOf: () => payload({ toJSON: () => ({}) }) };
})();
window.ZP_INBOX = INBOX;   // 점검(QA): 폰 알림 상태·종류 끄기
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", INBOX.init) : setTimeout(INBOX.init, 0);
