/* ===================== 검색 최근·인기 · 공유 카드 (내 핀 빈 화면은 70_pins.js) ===================== */
const EXTRA = (() => {
  const RK = "emr.recent";
  const getR = () => { try { return JSON.parse(localStorage.getItem(RK) || "[]").filter((id) => byId[id]); } catch (e) { return []; } };
  const pushR = (id) => { try { const a = [id].concat(getR().filter((x) => x !== id)).slice(0, 6); localStorage.setItem(RK, JSON.stringify(a)); } catch (e) {} };
  const QK = "emr.recentQ";   // 최근 검색어(app.js saveQ가 고를 때 저장)
  const getQ = () => { try { return JSON.parse(localStorage.getItem(QK) || "[]").filter((x) => typeof x === "string" && x).slice(0, 5); } catch (e) { return []; } };
  let HOT = null;
  // 인기 = 최근 3개월 구역 안 거래가 많은 곳(진행 중만)
  const hot = () => HOT || (HOT = R.filter((r) => r.tx && r.tx.n3 && !(r.s >= 9) && r.src !== "moa").sort((a, b) => b.tx.n3 - a.tx.n3).slice(0, 8).map((r) => r.id));
  const chip = (id) => `<button type="button" class="x-chip" role="option" data-id="${id}" tabindex="-1">${esc(shortName(byId[id].n))}<small>${esc(byId[id].g.replace(/구$/, ""))}</small></button>`;
  function empty() {
    const q = $("q");
    if (!q || q.value.trim() || document.activeElement !== q) return false;
    const rc = getR(), ht = hot().filter((id) => !rc.includes(id)).slice(0, 6), rq = getQ();
    if (!rc.length && !ht.length && !rq.length) return false;
    const s = $("sugg");
    const qChip = (v) => `<button type="button" class="x-chip x-q" role="option" data-q="${esc(v)}" tabindex="-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${esc(v)}</button>`;
    s.innerHTML = (rq.length ? `<div class="x-h" role="presentation">최근 검색<button type="button" class="x-clr" id="xClrQ" tabindex="-1">지우기</button></div><div class="x-row">${rq.map(qChip).join("")}</div>` : "") + (rc.length ? `<div class="x-h" role="presentation">최근 본 구역<button type="button" class="x-clr" id="xClr" tabindex="-1">지우기</button></div><div class="x-row">${rc.map(chip).join("")}</div>` : "") +
      (ht.length ? `<div class="x-h" role="presentation">요즘 거래 많은 구역</div><div class="x-row">${ht.map(chip).join("")}</div>` : "");
    s.hidden = false; q.setAttribute("aria-expanded", "true");
    s.querySelectorAll(".x-chip[data-id]").forEach((b) => (b.onmousedown = (e) => e.preventDefault(), b.onclick = () => pickSugg(b.dataset.id)));
    s.querySelectorAll(".x-chip[data-q]").forEach((b) => (b.onmousedown = (e) => e.preventDefault(), b.onclick = () => { q.value = b.dataset.q; renderSugg(); }));
    const cq = $("xClrQ"); if (cq) { cq.onmousedown = (e) => e.preventDefault(); cq.onclick = () => { try { localStorage.removeItem(QK); } catch (e) {} empty(); }; }
    const c = $("xClr"); if (c) { c.onmousedown = (e) => e.preventDefault(); c.onclick = () => { try { localStorage.removeItem(RK); } catch (e) {} empty(); }; }
    return true;
  }
  // ---------- 공유 카드(이미지) ----------
  function card(r) {
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), F = (w, s) => `${w} ${s}px "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#1f3a87"); gr.addColorStop(1, "#142659");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,.6)"; g.font = F(600, 38); g.fillText("집핀 Zippin · 서울 재개발 지도", 88, 130);
    g.fillStyle = "#fff"; g.font = F(800, shortName(r.n).length > 10 ? 76 : 96);
    g.fillText(shortName(r.n), 88, 300, W - 176);
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = F(500, 40); g.fillText(`${r.g} ${dongOfR(r)} · ${String(srLabel(r)).replace(/(회|합)(승인|인가)/, "$1 $2")}`, 88, 375, W - 176);
    const gp = gapMode() ? gapOf(r) : null, x = investC(r);
    const rowsC = [];
    if (gp && gp.now != null) rowsC.push(["전세 끼고 지금", eokT(gp.now)]);
    else if (x && x.needBuy != null) rowsC.push(["지금 살 때 필요한 돈", eokT(x.needBuy)]);
    if (gp && gp.total != null) rowsC.push(["입주까지 현금", eokT(gp.total)]);
    else if (x && x.ok) rowsC.push(["입주까지 현금", eokT(x.needTotal)]);
    try { const pr = projection(r); if (hasEta(pr) && !pr.past) rowsC.push(["예상 입주", etaSpan(r, pr)]); } catch (e) {}
    let y = 520;
    rowsC.forEach(([k, v]) => {
      g.fillStyle = "rgba(255,255,255,.1)"; rr(g, 72, y - 92, W - 144, 170, 32); g.fill();
      g.textBaseline = "middle"; g.fillStyle = "rgba(255,255,255,.75)"; g.font = F(600, 38); g.fillText(k, 112, y - 7);
      g.fillStyle = "#fff"; g.font = F(800, 72); g.textAlign = "right"; g.fillText(v, W - 112, y - 7); g.textAlign = "left"; g.textBaseline = "alphabetic";
      y += 200;
    });
    g.fillStyle = "rgba(255,255,255,.55)"; g.font = F(500, 30);
    g.fillText("무주택·84㎡·기본 가정 추정 · 투자 권유 아님", 88, H - 150);
    g.fillStyle = "#fff"; g.font = F(700, 40); g.fillText("jaegaebal.alwaysquestions.kr", 88, H - 90);
    return cv;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const eokT = ZF.cash;
  const dongOfR = (r) => { const m = /^([가-힣0-9]+?(?:동\d*가|동|가))\s/.exec((r.j || "") + " "); return m ? m[1] : ""; };
  async function shareCard(r, fb) {
    try { await (document.fonts && document.fonts.ready); } catch (e) {}
    const url = `https://jaegaebal.alwaysquestions.kr/z/${r.id}`;
    return shareCv(card(r), `jaegaebal_${r.id}.png`, shortName(r.n), `${shortName(r.n)} · 집핀 ${url}`, fb);
  }
  // 캔버스를 공유 시트로(안 되면 파일로 저장)
  async function shareCv(cv, name, title, text, fb) {
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
    const file = blob && typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title, text }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    if (fb) fb.textContent = "카드 이미지를 저장했어요";
  }
  function init() {
    const q = $("q");
    if (q) {
      q.addEventListener("focus", () => setTimeout(empty, 0));
      q.addEventListener("input", () => { if (!q.value.trim()) setTimeout(empty, 90); });
      q.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== q && $("sugg").querySelector(".x-row")) { $("sugg").hidden = true; q.setAttribute("aria-expanded", "false"); } }, 150));
    }
    const _sel = select;
    select = function (id) { const x = _sel.apply(this, arguments); try { if (byId[id]) pushR(id); } catch (e) {} return x; };
    const _rr = renderReport; renderReport = function () { const x = _rr.apply(this, arguments); try { addCardBtn(cur); } catch (e) {} return x; };
    try { addCardBtn(cur); } catch (e) {}
  }
  function addCardBtn(r) {
    const acts = document.querySelector("#report .rep-acts");
    if (!r || !acts || acts.querySelector(".x-card")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn secondary sm x-card"; b.textContent = "이미지";
    b.onclick = () => shareCard(r, $("zoneShareFb"));
    const sh = $("zoneShare"); sh ? sh.after(b) : acts.appendChild(b);
  }
  return { init, card, shareCv, rr };
})();
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", EXTRA.init) : setTimeout(EXTRA.init, 0);
