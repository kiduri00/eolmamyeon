/* ===================== 사이클 2: 구역 비교(F6)·내 시나리오(F7) 입구 — 첫 화면 묶음에는 입구만, 화면은 지연 묶음(/b/g) =====================
   · 구역 시트 위 행동 줄 '비교에 담기'(관심 구역이 아니어도 · 최대 4곳 · localStorage 'zp-cmp') + '비교 N곳 보기'
   · MY > 도구 '구역 비교' · '내 시나리오'(button[data-cx-open])
   · 주소: ?cmp=id.id(#cmp) → 비교 창 · ?sv=&ar=&ag=&at= → 매달 모으는 돈·비례율·시세 상승률·금리 입력칸에 넣고 다시 계산(시나리오 불러오기·공유 링크) */
const CX = (() => {
  const KEY = "zp-cmp", MAX = 4;
  const ids = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a.filter((x) => typeof x === "string" && byId[x]).slice(0, MAX) : []; } catch (e) { return []; } };
  const save = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, MAX))); } catch (e) {} paint(); };
  const open = (what, arg) => {
    const F = window.ZP_feat; if (!F || !F.loadX) return;
    F.loadX().then((X) => { const ctx = F.ctx(); if (what === "scen") X.scenOpen(ctx); else X.cmpOpen(ctx, arg); }).catch(() => {});
  };
  // 시트 아래 버튼(76_detail이 맨 아래 덩이를 그린 뒤 부른다)
  function btn(end, r) {
    if (!end || !r || r.src === "moa") return;
    const acts = end.querySelector(".dt-acts"); if (!acts || acts.querySelector("[data-cx-add]")) { paint(); return; }
    acts.insertAdjacentHTML("afterbegin", `<button type="button" class="btn secondary dt-cmp" data-cx-add="${r.id}" aria-pressed="false">비교에 담기</button><button type="button" class="btn secondary dt-cmpv" data-cx-open="cmp" hidden>비교 보기</button>`);
    paint();
  }
  function paint() {
    const L = ids();
    document.querySelectorAll("[data-cx-add]").forEach((b) => {
      const on = L.includes(b.dataset.cxAdd), full = !on && L.length >= MAX;
      b.setAttribute("aria-pressed", String(on)); b.disabled = full;
      b.textContent = on ? `비교에 담음 (${L.length}/${MAX})` : full ? `비교는 ${MAX}곳까지` : `비교에 담기${L.length ? ` (${L.length}/${MAX})` : ""}`;
    });
    document.querySelectorAll(".dt-cmpv[data-cx-open]").forEach((b) => { b.hidden = L.length < 2; b.textContent = `비교 ${L.length}곳 보기`; });
    // 사이클 4: 담은 구역 = 노란 체크(공용 고른 상태 · 버튼 노란 테두리 + 체크 · 시트 이름 옆 체크)
    document.querySelectorAll("[data-cx-add]").forEach((b) => { b.classList.add("zp-pk"); b.classList.toggle("is-picked", L.includes(b.dataset.cxAdd)); });
    { let cid = null; try { cid = window.ZP_feat && ZP_feat.ctx().cur() ? ZP_feat.ctx().cur().id : null; } catch (e) {} const on = !!cid && L.includes(cid); document.querySelectorAll("#report .dt-pick, #report .dt-pick-sr").forEach((i) => { i.hidden = !on; }); }
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("[data-cx-add]");
    if (a) { const id = a.dataset.cxAdd, L = ids(); save(L.includes(id) ? L.filter((x) => x !== id) : L.length < MAX ? L.concat(id) : L); return; }
    const o = e.target.closest && e.target.closest("[data-cx-open]");
    if (o) { e.preventDefault(); open(o.dataset.cxOpen); }
  });
  addEventListener("zp:cmp", paint);
  addEventListener("storage", (e) => { if (e.key === KEY) paint(); });
  // 주소로 받은 비교·시나리오(공유 링크)
  function boot() {
    let q, cq; try { q = new URLSearchParams(location.search); cq = new URLSearchParams(window.ZP_CQ || ""); } catch (e) { return; }
    const XID = [["sv", "svMon"], ["ar", "aRatio"], ["ag", "aGrowth"], ["at", "aRate"]];
    let hit = false;
    // 사이클 3: 시나리오 값은 # 뒤 조건(ZP_CQ)에서 읽고 지운다(주소 ?에는 없음)
    XID.forEach(([k, id]) => { const v = cq.get(k); if (v == null) return; cq.delete(k); try { window.ZP_CQ = cq.toString() ? "?" + cq : ""; } catch (e) {} const el = document.getElementById(id); if (el && /^-?[\d.,]{1,12}$/.test(v)) { el.value = v; try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {} } });
    const c = q.get("cmp");
    if (c != null) { hit = true; q.delete("cmp"); }
    if (hit) try { history.replaceState(history.state, "", location.pathname + (q.toString() ? "?" + q : "") + (location.hash === "#cmp" ? "" : location.hash)); } catch (e) {}
    if (c) { const L = c.split(/[.,]/).filter((x) => /^[a-z]+\d+$/.test(x) && byId[x]).slice(0, MAX); if (L.length) setTimeout(() => open("cmp", L), 0); }
  }
  return { btn, paint, boot, ids, open };
})();
window.ZP_cx = CX;   // 점검(QA)
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", CX.boot) : setTimeout(CX.boot, 0);
