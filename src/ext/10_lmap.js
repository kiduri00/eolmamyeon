  // ===================== 실제 지도 (MapLibre · OpenFreeMap 벡터 타일) =====================
  // 서울 전체 = 기존 구 단위 지도(SVG). 구를 누르면 실제 지도로 바뀌고 정비구역 경계를 그린다.
  // 경계: 서울도시공간포털 정비구역(UQ181) + 서울시 정비사업 현황(UQ120). 공식 경계가 없으면 면적 기준 추정 범위(점선).
  const LMX = (() => {
    const MLV = "4.7.1";
    const ML_JS = { src: `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MLV}/maplibre-gl.min.js`, sri: "sha512-dXgoFR02YHJ9Fa29P3D/1umNaZ0EXS2N0w29Lm3b/1BK8UDLMdLWDFwuujIyJJdU27/PLuk3dmS1V9NO8ABX1A==" };
    const ML_CSS = { src: `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MLV}/maplibre-gl.min.css`, sri: "sha512-qN/uDg9bS3IAldWq4lswyC+9ZSoShtfyNDp+FaJhdtXJqdgubHA+s4nB8BajW0m90Y0+RBGbqu2anzbxiQYdHA==" };
    const LINE_COL = { "1호선": "#0052A4", "2호선": "#00A84D", "3호선": "#EF7C1C", "4호선": "#00A5DE", "5호선": "#996CAC", "6호선": "#CD7C2F", "7호선": "#747F00", "8호선": "#E6186C", "9호선": "#BDB092", 신분당선: "#D4003B", 수인분당선: "#F5A200", 경의중앙선: "#77C4A3", 공항철도: "#0090D2", 경춘선: "#0C8E72", 우이신설선: "#B0CE18", 신림선: "#6789CA", "GTX-A": "#9A6292", 서해선: "#8FC31F" };
    const SEOUL_BB = [[126.76, 37.413], [127.185, 37.716]];
    const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
    let pendFocus = false;
    let map = null, libP = null, geo = null, geoP = null, ready = false, active = false, gu = null, failed = false;
    let want = store.get("emr.map", "real") !== "svg";
    let colorBy = store.get("emr.mapc", "cash");
    const MODES = [["cash", "내 현금"], ["stage", "단계"], ["kind", "사업 방식"], ["old", "노후도"], ["vol", "거래량"], ["yoy", "1년 가격 변화"]];
    if (!MODES.some(([k]) => k === colorBy)) colorBy = "cash";
    // 겹쳐 보는 레이어(호갱노노식): 지도 바탕 POI는 OpenFreeMap 벡터 타일, 나머지는 사이트 자료
    const LAYERS = [["hj", "개발 호재", "신설 노선 역·복합개발"], ["hi", "신고가", "최근 3개월, 2024년 이후 최고가"], ["edu", "학교", "초·중·고"], ["acad", "학원가", "학원 점포가 많은 상권"], ["biz", "상권", "점포 수·분기 매출"], ["med", "병원", "종합·대형병원"], ["mart", "대형마트", "이마트·홈플러스 등"]];
    const POIZ = 14;
    // 목록 머리 유형 칩(60_simple.js가 'zp:filter' 이벤트로 알림) → 지도 구역·핀도 같은 유형만
    const KINDOF = (r) => (/재건축/.test(r.k) ? "rebuild" : /가로|소규모/.test(r.k) ? "small" : "redev");
    let kindF = "";
    const kindOk = (r) => !kindF || KINDOF(r) === kindF;
    addEventListener("zp:filter", (e) => { const k = (e && e.detail && e.detail.kind) || ""; if (k === kindF) return; kindF = k; if (map && ready) paint(); });
    let lyr = (() => { try { return new Set(JSON.parse(store.get("emr.lyr", '[]'))); } catch (e) { return new Set(); } })();
    const BINS = { old: [[40, "40% 미만"], [60, "40~60%"], [67, "60~67%"], [80, "67~80%"], [101, "80% 이상"]], vol: [[1, "0건"], [5, "1~4건"], [15, "5~14건"], [40, "15~39건"], [1e9, "40건 이상"]], yoy: [[-10, "−10% 미만"], [0, "−10~0%"], [10, "0~+10%"], [25, "+10~25%"], [1e9, "+25% 이상"]] };
    const metric = (r) => { const t = r.tx || {}; if (colorBy === "old") return t.old && r.s < 7 ? t.old.pol : null; if (colorBy === "vol") return t.n12 != null ? t.n12 : r.tx ? 0 : null; if (colorBy === "yoy") return t.yoy != null && t.yon && t.yon[0] >= 10 && t.yon[1] >= 10 ? t.yoy : null; return null; };
    const dark = () => { const t = document.documentElement.dataset.theme; return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
    function loadLib() {
      if (window.maplibregl && window.maplibregl.Map) return Promise.resolve();
      if (libP) return libP;
      libP = new Promise((ok, no) => {
        const l = document.createElement("link");
        l.rel = "stylesheet"; l.href = ML_CSS.src; l.integrity = ML_CSS.sri; l.crossOrigin = "anonymous";
        document.head.appendChild(l);
        const s = document.createElement("script");
        s.src = ML_JS.src; s.integrity = ML_JS.sri; s.crossOrigin = "anonymous";
        s.onload = () => (window.maplibregl && window.maplibregl.Map ? ok() : no(new Error("lib")));
        s.onerror = () => no(new Error("lib"));
        document.head.appendChild(s);
      }).catch((e) => { libP = null; throw e; });
      return libP;
    }
    function loadGeo() {
      if (geo) return Promise.resolve(geo);
      if (!geoP) geoP = fetch(`data/geo.json?v=${(D.dv && D.dv.geo) || D.asOf}`).then((r) => (r.ok ? r.json() : null)).then((g) => { geo = g && g.z ? g : null; if (!geo) geoP = null; return geo; }).catch(() => { geoP = null; return null; });
      return geoP;
    }
    // 색: 페이지 CSS 토큰에서 읽어 디자인 변경을 그대로 따른다
    const probe = (() => { let el = null; return (css) => { if (!el) { el = document.createElement("i"); el.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden"; document.body.appendChild(el); } el.style.color = ""; el.style.color = css; return getComputedStyle(el).color; }; })();
    const CASH_LAB = { y: null, n: "현금 부족", u: "계산 보류", e: "구 평균 시세 추정", x: "" };
    function palette() {
      const v = (n, d) => probe(`var(${n}, ${d})`);
      return { y: v("--brand", "#2B59F0"), n: v("--text-3", "#5c6573"), u: v("--text-4", "#8B95A1"), e: v("--acc2", "#8B6FE8"), x: v("--text-4", "#8B95A1"), ink: v("--text-1", "#191F28"), sub: v("--text-3", "#5F6B7A"), surf: v("--surface", "#fff"), line: v("--border", "#E5E8EB"), sel: v("--focus", "#2B59F0") };
    }
    // 겹쳐 보기 아이콘 색: [동그라미, 글자]. 남색(구역)·파랑과 겹치지 않는 청록·빨강·자홍
    const POIC = (dk) => (dk ? { edu: ["#2BA894", "#6FD8C6"], med: ["#E0484E", "#F59A9A"], mart: ["#C2479A", "#F09ACD"] } : { edu: ["#0B8070", "#0A6F61"], med: ["#D0343A", "#B4232A"], mart: ["#B0327F", "#9A2470"] });
    function poiIcon(k, dk, px) {
      const S = 20, c = document.createElement("canvas"); c.width = c.height = S * px;
      const x = c.getContext("2d"); x.scale(px, px);
      x.beginPath(); x.arc(10, 10, 8.6, 0, Math.PI * 2); x.fillStyle = POIC(dk)[k][0]; x.fill(); x.lineWidth = 1.6; x.strokeStyle = dk ? "#11161D" : "#FFFFFF"; x.stroke();
      x.fillStyle = "#FFFFFF"; x.strokeStyle = "#FFFFFF"; x.lineJoin = "round"; x.lineCap = "round";
      if (k === "edu") { x.beginPath(); x.moveTo(5, 9.2); x.lineTo(10, 5.4); x.lineTo(15, 9.2); x.closePath(); x.fill(); x.fillRect(6.4, 9.2, 7.2, 5.4); x.fillStyle = POIC(dk)[k][0]; x.fillRect(9, 11.4, 2, 3.2); }
      else if (k === "med") { x.fillRect(8.6, 5.2, 2.8, 9.6); x.fillRect(5.2, 8.6, 9.6, 2.8); }
      else { x.lineWidth = 1.5; x.beginPath(); x.moveTo(5, 6.2); x.lineTo(6.6, 6.2); x.lineTo(8, 12.4); x.lineTo(14, 12.4); x.lineTo(15, 8.2); x.lineTo(7.1, 8.2); x.stroke(); x.beginPath(); x.arc(8.6, 14.4, 1.1, 0, 7); x.arc(13.2, 14.4, 1.1, 0, 7); x.fill(); }
      return c;
    }
    const POIURL = {};
    const poiUrl = (k) => { const key = k + (dark() ? "d" : ""); if (!POIURL[key]) { try { POIURL[key] = poiIcon(k, dark(), 3).toDataURL(); } catch (e) { POIURL[key] = ""; } } return POIURL[key]; };
    // 상태 점 그림(남색 한 가지 안에서): 멀다 = 6px 회남색 점 · 정보 부족 = 점선 동그라미 · 가능/모자람(알약 자리 없음) = 작은 남색 점/테두리 점 · 관심 구역 = 남색 하트
    function dotImgs(dk) {
      const k = 3, NV = dk ? "#7FA6FF" : "#1F3A87", GR = dk ? "#7C8AA6" : "#8792AE", HL = dk ? "#11161D" : "#FFFFFF";
      const put = (id, S, draw) => { if (map.hasImage(id)) map.removeImage(id); const c = document.createElement("canvas"); c.width = c.height = S * k; const x = c.getContext("2d"); x.scale(k, k); draw(x, S / 2); map.addImage(id, x.getImageData(0, 0, S * k, S * k), { pixelRatio: k }); };
      put("zd-far", 10, (x, c) => { x.beginPath(); x.arc(c, c, 3, 0, 7); x.fillStyle = GR; x.fill(); x.lineWidth = 1; x.strokeStyle = HL; x.stroke(); });
      put("zd-na", 12, (x, c) => { x.beginPath(); x.arc(c, c, 3.9, 0, 7); x.fillStyle = HL; x.fill(); x.setLineDash([1.7, 1.5]); x.lineWidth = 1.4; x.strokeStyle = GR; x.stroke(); });
      put("zd-ok", 12, (x, c) => { x.beginPath(); x.arc(c, c, 4, 0, 7); x.fillStyle = NV; x.fill(); x.lineWidth = 1.5; x.strokeStyle = HL; x.stroke(); });
      put("zd-near", 12, (x, c) => { x.beginPath(); x.arc(c, c, 4, 0, 7); x.fillStyle = HL; x.fill(); x.lineWidth = 1.7; x.strokeStyle = NV; x.stroke(); });
      put("zd-fav", 16, (x) => { x.save(); x.translate(2, 2.4); x.scale(0.5, 0.5); const p = new Path2D("M12 21s-8-4.9-9.7-10C1.2 7.4 3.5 4 7 4c2.1 0 3.8 1.2 5 3 1.2-1.8 2.9-3 5-3 3.5 0 5.8 3.4 4.7 7-1.7 5.1-9.7 10-9.7 10z"); x.lineWidth = 3.2; x.strokeStyle = HL; x.stroke(p); x.fillStyle = NV; x.fill(p); x.restore(); });
    }
    function style() {
      const dk = dark();
      const C = dk
        ? { bg: "#11161D", park: "#152019", water: "#15283A", wline: "#1E3D55", res: "#141B23", bld: "#1A222C", bldl: "#232D39", mw: "#4A3E22", mwc: "#2E2716", pr: "#2A3441", prc: "#1D242E", mn: "#202833", rail: "#3A4553", txt: "#C3CCD8", txt2: "#8A95A5", halo: "#11161D", wtxt: "#6E9EBF" }
        : { bg: "#F3F4F6", park: "#E1EEDC", water: "#BFD9EC", wline: "#A3C6E0", res: "#EDEFF2", bld: "#ECEEF1", bldl: "#E2E5EA", mw: "#FBE3A6", mwc: "#E0BE6A", pr: "#FFFFFF", prc: "#D3D8E0", mn: "#FFFFFF", rail: "#A6AFBB", txt: "#2F3846", txt2: "#6A7482", halo: "#FFFFFF", wtxt: "#3F7DA6" };
      const name = ["coalesce", ["get", "name:ko"], ["get", "name"]];
      const road = (id, cls, color, w, minz) => ({ id, type: "line", source: "omt", "source-layer": "transportation", minzoom: minz || 0, filter: ["in", ["get", "class"], ["literal", cls]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 10, w[0], 14, w[1], 17, w[2]] } });
      return {
        version: 8,
        glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
        sources: { omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": C.bg } },
          { id: "res", type: "fill", source: "omt", "source-layer": "landuse", filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood"]]], paint: { "fill-color": C.res } },
          { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": C.park } },
          { id: "wood", type: "fill", source: "omt", "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["wood", "grass"]]], paint: { "fill-color": C.park, "fill-opacity": 0.8 } },
          { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": C.water } },
          { id: "waterway", type: "line", source: "omt", "source-layer": "waterway", paint: { "line-color": C.wline, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 15, 2] } },
          { id: "bld", type: "fill", source: "omt", "source-layer": "building", minzoom: 14, paint: { "fill-color": C.bld, "fill-outline-color": C.bldl, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1] } },
          road("minor", ["minor", "service"], C.mn, [0, 1.5, 7], 12.5),
          road("pri-c", ["primary", "secondary", "tertiary"], C.prc, [0.8, 4.5, 14]),
          road("pri", ["primary", "secondary", "tertiary"], C.pr, [0.4, 3, 11.5]),
          road("mw-c", ["motorway", "trunk"], C.mwc, [1.2, 5.5, 16]),
          road("mw", ["motorway", "trunk"], C.mw, [0.7, 3.8, 13]),
          { id: "rail", type: "line", source: "omt", "source-layer": "transportation", filter: ["in", ["get", "class"], ["literal", ["rail", "transit"]]], paint: { "line-color": C.rail, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 15, 1.6], "line-dasharray": [3, 2] } },
          { id: "water-name-l", type: "symbol", source: "omt", "source-layer": "water_name", filter: ["==", ["geometry-type"], "LineString"], layout: { "text-field": name, "text-font": ["Noto Sans Italic"], "text-size": 13, "symbol-placement": "line" }, paint: { "text-color": C.wtxt, "text-halo-color": C.halo, "text-halo-width": 1.5 } },
          { id: "water-name-p", type: "symbol", source: "omt", "source-layer": "water_name", filter: ["==", ["geometry-type"], "Point"], layout: { "text-field": name, "text-font": ["Noto Sans Italic"], "text-size": 13 }, paint: { "text-color": C.wtxt, "text-halo-color": C.halo, "text-halo-width": 1.5 } },
          // 도로 이름: 큰길(고속·간선)은 13부터, 나머지 큰 도로는 15부터. 분기점·나들목 같은 이름은 뺀다. 구역 카드보다 늘 뒤에 자리 잡는다(겹치면 숨음)
          { id: "road-name-mj", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 13, filter: ["all", ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]], ["!", ["in", "분기점", name]], ["!", ["in", "나들목", name]], ["!", ["in", "IC", name]]], layout: { "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10.5, 16, 12], "symbol-placement": "line", "symbol-spacing": 420, "text-padding": 6, "text-max-angle": 30 }, paint: { "text-color": C.txt2, "text-opacity": 0.85, "text-halo-color": C.halo, "text-halo-width": 1.6 } },
          { id: "road-name", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 15, filter: ["all", ["in", ["get", "class"], ["literal", ["secondary", "tertiary"]]], ["!", ["in", "분기점", name]]], layout: { "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": 11, "symbol-placement": "line", "symbol-spacing": 360, "text-padding": 6 }, paint: { "text-color": C.txt2, "text-opacity": 0.8, "text-halo-color": C.halo, "text-halo-width": 1.6 } },
          { id: "place", type: "symbol", source: "omt", "source-layer": "place", minzoom: 12.5, filter: ["in", ["get", "class"], ["literal", ["suburb", "quarter", "neighbourhood"]]], layout: { "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 12.5, 11, 16, 14] }, paint: { "text-color": C.txt2, "text-halo-color": C.halo, "text-halo-width": 1.6 } },
        ],
      };
    }
    const FC = (f) => ({ type: "FeatureCollection", features: f });
    function overlays() {
      if (!map || !geo) return;
      const dk = dark(), P = palette(), halo = dk ? "#11161D" : "#ffffff";
      const add = (id) => { if (!map.getSource(id)) map.addSource(id, Object.assign({ type: "geojson", data: FC([]) }, /^(zones|zest|zlab|pts)$/.test(id) ? { promoteId: "id" } : {})); };
      ["mask", "seoul", "gul", "zones", "zest", "zlab", "pts", "stn", "sel", "hj", "hi", "sang", "subway", "gun", "dong", "sdim", "sring", "spt", "hov", "sellab", "gudim", "gusel", "zdot", "pillb"].forEach(add);
      map.getSource("gun").setData(guLabels());
      map.getSource("dong").setData(dongLabels());
      map.getSource("subway").setData(subwayGeo());
      const outer = [[124, 32], [132, 32], [132, 40], [124, 40], [124, 32]];
      map.getSource("mask").setData({ type: "Feature", geometry: { type: "Polygon", coordinates: [outer, ...geo.seoul] }, properties: {} });
      map.getSource("seoul").setData({ type: "Feature", geometry: { type: "MultiLineString", coordinates: geo.seoul }, properties: {} });
      map.getSource("gul").setData(FC(geo.gu.map((g) => ({ type: "Feature", geometry: { type: "MultiLineString", coordinates: g.r }, properties: { n: g.n } }))));
      map.getSource("stn").setData(FC(D.stations.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s[2], s[1]] }, properties: { n: s[0].replace(/역$/, ""), c: LINE_COL[(s[3] || [])[0]] || "#7A8594", t: (s[3] || []).length } }))));
      const L = (o) => { if (!map.getLayer(o.id)) map.addLayer(o); };
      L({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": dk ? "#0B0F14" : "#ffffff", "fill-opacity": dk ? 0.7 : 0.75 } });
      L({ id: "gu-line", type: "line", source: "gul", paint: { "line-color": dk ? "#3B4656" : "#AEB7C4", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 1.3], "line-dasharray": [2, 2] } });
      L({ id: "seoul-line", type: "line", source: "seoul", paint: { "line-color": P.sub, "line-width": 1.6, "line-opacity": 0.7 } });
      L({ id: "subway-case", type: "line", source: "subway", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": halo, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.8, 14, 4], "line-opacity": 0.5 } });
      L({ id: "subway", type: "line", source: "subway", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 12, 1.2, 14, 2, 16, 2.6], "line-opacity": 0.5 } });
      // 바탕 이름: 구(줌 9.5~13.4) → 동(13.2부터) → 큰 역(12부터, 환승역). 회색으로 작게, 구역 카드가 먼저 자리 잡는다
      const T1 = dk ? "#8A95A5" : "#6A7482", T2 = dk ? "#7A8696" : "#7C8693";
      L({ id: "gu-lab", type: "symbol", source: "gun", minzoom: 8.8, maxzoom: 13.4, layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10.5, 12.5, 12.5], "text-padding": 4, "text-letter-spacing": 0.04, "text-variable-anchor": ["center", "top", "bottom", "right", "left"], "text-radial-offset": 0.7, "text-justify": "auto" }, paint: { "text-color": T1, "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.6, 0.95, 13.4, 0], "text-halo-color": halo, "text-halo-width": 1.6 } });
      L({ id: "dong-lab", type: "symbol", source: "dong", minzoom: 13.2, layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 13.2, 10.5, 16, 12], "text-padding": 6, "text-variable-anchor": ["center", "top", "bottom"], "text-radial-offset": 0.9, "symbol-sort-key": ["get", "k"] }, paint: { "text-color": T2, "text-halo-color": halo, "text-halo-width": 1.6 } });
      // 구역: 한 가지 색(브랜드 남색). 상태 4가지(feature-state k)는 남색 안에서 채움·테두리로만: 가능 = 면 20% + 진한 선 · 조금 모자람 = 면 없이 선만 · 멀다·정보 부족 = 아주 옅게
      // 관심 구역(f) = 선을 굵게. 공식 경계 없는 추정 범위는 점선
      const ZC = dk ? "#5B8CFF" : "#1F3A87", ZL = dk ? "#7FA6FF" : "#1F3A87";
      const K = ["coalesce", ["feature-state", "k"], 2], FV = ["boolean", ["feature-state", "f"], false];
      const fo = (ok, far, na) => ["match", K, 0, ok, 1, 0, 2, far, na];
      const zop = (m) => ["interpolate", ["linear"], ["zoom"], 10, fo((dk ? 0.34 : 0.26) * m, (dk ? 0.07 : 0.05) * m, (dk ? 0.05 : 0.04) * m), 13, fo((dk ? 0.28 : 0.21) * m, (dk ? 0.06 : 0.045) * m, (dk ? 0.05 : 0.035) * m), 16, fo((dk ? 0.22 : 0.16) * m, (dk ? 0.05 : 0.04) * m, (dk ? 0.04 : 0.03) * m)];
      const lw = (a, b, c) => ["+", ["match", K, 0, a, 1, a * 1.05, b], ["case", FV, c, 0]];
      const zlw = ["interpolate", ["linear"], ["zoom"], 10, lw(0.9, 0.45, 1), 12, lw(1.3, 0.6, 1.3), 14, lw(1.8, 0.8, 1.6), 16, lw(2.1, 0.9, 1.8)];
      const zlo = ["case", FV, 1, ["match", K, 0, 0.95, 1, 0.9, dk ? 0.34 : 0.28]];
      L({ id: "zest-fill", type: "fill", source: "zest", paint: { "fill-color": ZC, "fill-opacity": zop(0.8) } });
      L({ id: "zest-line", type: "line", source: "zest", layout: { "line-join": "round" }, paint: { "line-color": ZL, "line-width": zlw, "line-dasharray": [2.2, 1.6], "line-opacity": zlo } });
      L({ id: "zone-fill", type: "fill", source: "zones", paint: { "fill-color": ZC, "fill-opacity": zop(1), "fill-antialias": true } });
      L({ id: "zone-line", type: "line", source: "zones", layout: { "line-join": "round" }, paint: { "line-color": ZL, "line-width": zlw, "line-opacity": zlo } });
      // 알약이 없는 구역의 점(멀다 6px 회남색 · 정보 부족 점선 · 자리가 없는 가능·모자람 · 관심 구역 하트) — 구 묶음 줌(11 이하)에는 비운다
      dotImgs(dk);
      L({ id: "zdot", type: "symbol", source: "zdot", layout: { "icon-image": ["concat", "zd-", ["get", "t"]], "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.85, 15, 1.1], "symbol-sort-key": ["-", 10, ["get", "k"]] }, paint: {} });
      // 구를 고르면(검색·구 누르기): 다른 구는 옅게 덮고 그 구 경계를 굵게
      L({ id: "gu-dim", type: "fill", source: "gudim", paint: { "fill-color": dk ? "#0B0F14" : "#F3F4F6", "fill-opacity": dk ? 0.5 : 0.55 } });
      L({ id: "gu-sel-case", type: "line", source: "gusel", layout: { "line-join": "round" }, paint: { "line-color": halo, "line-width": 5, "line-opacity": 0.85 } });
      L({ id: "gu-sel", type: "line", source: "gusel", layout: { "line-join": "round" }, paint: { "line-color": dk ? "#9DBBFF" : "#1F3A87", "line-width": 2.4 } });
      // 역으로 찾기: 걸어서 1km 밖은 옅게 덮고, 500m·1km 고리를 흐리게
      L({ id: "stn-dim", type: "fill", source: "sdim", paint: { "fill-color": dk ? "#0B0F14" : "#F3F4F6", "fill-opacity": dk ? 0.55 : 0.6 } });
      L({ id: "stn-ring", type: "line", source: "sring", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": dk ? "#9DBBFF" : "#1F3A87", "line-width": 1.4, "line-opacity": ["case", ["==", ["get", "m"], 515], 0.35, 0.55], "line-dasharray": [3, 2] } });
      // 목록에 마우스를 올린 구역(데스크톱)
      L({ id: "hov-fill", type: "fill", source: "hov", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": dk ? "#F5C33B" : "#E8A400", "fill-opacity": 0.22 } });
      L({ id: "hov-line", type: "line", source: "hov", filter: ["==", ["geometry-type"], "Polygon"], layout: { "line-join": "round" }, paint: { "line-color": dk ? "#F5C33B" : "#C98A00", "line-width": 3 } });
      L({ id: "hov-pt", type: "circle", source: "hov", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 13, 14, 10], "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": dk ? "#F5C33B" : "#C98A00", "circle-stroke-width": 3 } });
      // 고른 구역: 면은 조금 진하게 + 굵은 테두리(바깥 흰 테 + 안쪽 남색)
      L({ id: "sel-fill", type: "fill", source: "sel", paint: { "fill-color": ZC, "fill-opacity": dk ? 0.32 : 0.26 } });
      L({ id: "sel-case", type: "line", source: "sel", layout: { "line-join": "round" }, paint: { "line-color": halo, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 16, 8], "line-opacity": 0.9 } });
      L({ id: "sel-line", type: "line", source: "sel", layout: { "line-join": "round" }, paint: { "line-color": dk ? "#9DBBFF" : "#1F3A87", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.6, 16, 4.5] } });
      L({ id: "stn", type: "circle", source: "stn", minzoom: 14, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3.5, 16, 5.5], "circle-color": dk ? "#151B23" : "#ffffff", "circle-stroke-color": ["get", "c"], "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 14, 2, 16, 2.6] } });
      // 큰 역(환승역)은 12부터 작은 점 + '○○역'
      L({ id: "stn-mj", type: "circle", source: "stn", minzoom: 12, maxzoom: 14, filter: [">=", ["get", "t"], 2], paint: { "circle-radius": 2.6, "circle-color": dk ? "#151B23" : "#ffffff", "circle-stroke-color": dk ? "#8A95A5" : "#5F6B7A", "circle-stroke-width": 1.4 } });
      L({ id: "stn-mj-lab", type: "symbol", source: "stn", minzoom: 12, maxzoom: 14, filter: [">=", ["get", "t"], 2], layout: { "text-field": ["concat", ["get", "n"], "역"], "text-font": ["Noto Sans Regular"], "text-size": 10.5, "text-offset": [0, 0.75], "text-anchor": "top", "text-padding": 4, "text-optional": true }, paint: { "text-color": T1, "text-halo-color": halo, "text-halo-width": 1.6 } });
      L({ id: "stn-lab", type: "symbol", source: "stn", minzoom: 14, layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": P.sub, "text-halo-color": halo, "text-halo-width": 1.6 } });
      // ---- 겹쳐 보기 레이어 ----
      const nm = ["coalesce", ["get", "name:ko"], ["get", "name"], ""];
      // 학교·병원·마트: 구역(남색)과 헷갈리지 않게 레이어마다 다른 색 + 그림 아이콘(동그라미 안 흰 그림)
      ["edu", "med", "mart"].forEach((k) => { const c = poiIcon(k, dk, 2); if (map.hasImage("poi-" + k)) map.removeImage("poi-" + k); map.addImage("poi-" + k, c.getContext("2d").getImageData(0, 0, c.width, c.height), { pixelRatio: 2 }); });
      const poiTxt = (id, filter, color, minz) => [
        { id: id, type: "symbol", source: "omt", "source-layer": "poi", minzoom: minz, filter, layout: { visibility: "none", "icon-image": "poi-" + id.slice(3), "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.85, 16, 1.1], "icon-allow-overlap": true, "icon-ignore-placement": false, "icon-padding": 1 }, paint: {} },
        { id: id + "-lab", type: "symbol", source: "omt", "source-layer": "poi", minzoom: Math.max(minz, 14), filter, layout: { visibility: "none", "text-field": nm, "text-font": ["Noto Sans Regular"], "text-size": 10, "text-offset": [0, 1.15], "text-anchor": "top", "text-optional": true, "text-max-width": 8 }, paint: { "text-color": color, "text-halo-color": halo, "text-halo-width": 1.6 } },
      ];
      const SHOPC = ["shop", "grocery", "restaurant", "cafe", "fast_food", "bar", "beer", "bakery", "clothing_store", "ice_cream", "alcohol_shop", "convenience", "hairdresser", "laundry", "shoe_shop", "jewelry", "optician", "furniture", "mobile_phone", "cosmetics", "florist", "butcher", "deli", "pharmacy"];
      const sz = (f, k) => ["interpolate", ["exponential", 1.6], ["zoom"], 10, ["*", ["sqrt", ["get", f]], k * 0.35], 13, ["*", ["sqrt", ["get", f]], k], 16, ["*", ["sqrt", ["get", f]], k * 3.2]];
      // 상권: 서울·구 줌(13 아래)은 원 수백 개가 주황 덩어리가 되므로 열지도(진할수록 점포 많음), 13부터 원(크기 = 점포 수)으로 바뀐다
      const bizFade = (a, b) => ["interpolate", ["linear"], ["zoom"], 12.6, a, 13.2, b];
      L({ id: "ly-biz-heat", type: "heatmap", source: "sang", maxzoom: 13.3, filter: [">=", ["get", "st"], 80], layout: { visibility: "none" }, paint: { "heatmap-weight": ["interpolate", ["linear"], ["get", "st"], 80, 0.15, 400, 0.6, 1200, 1], "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 9, 0.7, 13, 1.3], "heatmap-radius": ["interpolate", ["exponential", 1.6], ["zoom"], 9, 7, 11, 14, 13, 30], "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(232,140,40,0)", 0.2, dk ? "rgba(236,150,60,.22)" : "rgba(240,160,70,.22)", 0.5, dk ? "rgba(236,150,60,.45)" : "rgba(226,128,32,.42)", 0.8, dk ? "rgba(245,170,90,.62)" : "rgba(205,105,15,.56)", 1, dk ? "rgba(255,190,120,.75)" : "rgba(180,85,5,.68)"], "heatmap-opacity": bizFade(0.9, 0) } });
      L({ id: "ly-biz", type: "circle", source: "sang", minzoom: 12.6, filter: [">=", ["get", "st"], 80], layout: { visibility: "none" }, paint: { "circle-radius": sz("st", 0.9), "circle-color": dk ? "rgba(236,150,60,.16)" : "rgba(232,140,40,.12)", "circle-stroke-color": dk ? "rgba(236,150,60,.7)" : "rgba(200,110,20,.6)", "circle-stroke-width": 1, "circle-opacity": bizFade(0, 1), "circle-stroke-opacity": bizFade(0, 1) } });
      L({ id: "ly-biz-lab", type: "symbol", source: "sang", minzoom: 13, filter: [">=", ["get", "st"], 80], layout: { visibility: "none", "text-field": ["format", ["get", "n"], {}, "\n", {}, ["concat", "점포 ", ["to-string", ["get", "st"]], ["case", [">", ["get", "sa"], 0], ["concat", " · 분기 매출 ", ["to-string", ["get", "sa"]], "억"], ""]], { "font-scale": 0.85 }], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-optional": true, "text-max-width": 9 }, paint: { "text-color": dk ? "#F2B37A" : "#9A4E0C", "text-halo-color": halo, "text-halo-width": 1.8 } });
      L({ id: "ly-acad", type: "circle", source: "sang", filter: [">=", ["get", "ac"], 15], layout: { visibility: "none" }, paint: { "circle-radius": sz("ac", 1.9), "circle-color": dk ? "rgba(190,150,240,.3)" : "rgba(122,63,184,.2)", "circle-stroke-color": dk ? "#C9A0F0" : "#7A3FB8", "circle-stroke-width": 1.2 } });
      L({ id: "ly-acad-lab", type: "symbol", source: "sang", minzoom: 11.5, filter: [">=", ["get", "ac"], 40], layout: { visibility: "none", "text-field": ["concat", ["get", "n"], "\n학원 ", ["to-string", ["get", "ac"]]], "text-font": ["Noto Sans Regular"], "text-size": 10, "text-optional": true, "text-max-width": 8 }, paint: { "text-color": dk ? "#D8B8F6" : "#5E2A96", "text-halo-color": halo, "text-halo-width": 2 } });
      poiTxt("ly-edu", ["all", ["in", ["get", "class"], ["literal", ["school"]]], ["any", ["in", "초등학교", nm], ["in", "중학교", nm], ["in", "고등학교", nm]]], POIC(dk).edu[1], POIZ).forEach(L);
      poiTxt("ly-med", ["all", ["==", ["get", "class"], "hospital"], ["any", ["in", "병원", nm], ["in", "의료원", nm], ["in", "의료센터", nm]]], POIC(dk).med[1], POIZ).forEach(L);
      poiTxt("ly-mart", ["all", ["in", ["get", "subclass"], ["literal", ["supermarket", "department_store", "mall", "wholesale"]]], ["any", ["in", "이마트", nm], ["in", "홈플러스", nm], ["in", "롯데마트", nm], ["in", "코스트코", nm], ["in", "트레이더스", nm], ["in", "백화점", nm], ["in", "하나로", nm]]], POIC(dk).mart[1], POIZ).forEach(L);
      L({ id: "ly-hj", type: "circle", source: "hj", layout: { visibility: "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 8], "circle-color": halo, "circle-stroke-color": ["get", "c"], "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 15, 4] } });
      L({ id: "ly-hj-lab", type: "symbol", source: "hj", minzoom: 13.5, layout: { visibility: "none", "text-field": ["get", "sn"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 16, 11], "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true, "text-max-width": 8, "symbol-sort-key": 10 }, paint: { "text-color": dk ? "#AAB3C0" : "#5B6472", "text-halo-color": halo, "text-halo-width": 1 } });
      // 신고가: 줌 13 아래는 구역 가운데 작은 빨간 점, 13부터는 구역 카드 아래 칸에 '▲신고가' 배지(카드 데이터 h)
      L({ id: "ly-hi", type: "circle", source: "hi", maxzoom: 13, layout: { visibility: "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 13, 4.5], "circle-color": dk ? "#FF8A75" : "#D92D20", "circle-stroke-color": halo, "circle-stroke-width": 1.4 } });
      // ---- 구역 카드(네이버·리치고식): 위 칸 남색에 이름, 아래 흰 칸에 핵심 숫자. 줌 13부터(그 아래는 면만, 살 수 있는 곳엔 핀) ----
      // 9-patch 이미지 하나로 두 칸 배경을 만들고 icon-text-fit으로 글자에 맞춘다(위·아래 늘림 구간이 같아 두 줄 경계가 가운데에 온다)
      const CARD_TOP = dk ? "#3E6AE0" : "#1F3A87", CARD_BOT = dk ? "#1A2130" : "#FFFFFF", CARD_INK = dk ? "#E8EDF5" : "#191F28";
      const rr = (x, X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
      const img = (id, two, lite) => {
        const TOP = lite ? (dk ? "#273041" : "#E8ECF4") : CARD_TOP, EDGE = lite ? (dk ? "#3B4656" : "#B8C2D6") : CARD_TOP;
        if (map.hasImage(id)) map.removeImage(id);
        const k = 2, W = 40, H = two ? 38 : 22, sh = 2, c = document.createElement("canvas"); c.width = W * k; c.height = (H + sh) * k;
        const x = c.getContext("2d"); x.scale(k, k);
        x.fillStyle = dk ? "rgba(0,0,0,.35)" : "rgba(15,30,70,.16)"; rr(x, 0.5, 1.5, W - 1, H - 1, 6); x.fill();   // 아래로 살짝 그림자
        rr(x, 0.5, 0.5, W - 1, H - 1, 6); x.save(); x.clip();
        x.fillStyle = TOP; x.fillRect(0, 0, W, H);
        if (two) { x.fillStyle = CARD_BOT; x.fillRect(0, H / 2, W, H / 2); }
        x.restore(); x.strokeStyle = EDGE; x.lineWidth = 1; rr(x, 0.5, 0.5, W - 1, H - 1, 6); x.stroke();
        const m = H / 2;
        map.addImage(id, x.getImageData(0, 0, W * k, (H + sh) * k), { pixelRatio: k, stretchX: [[8 * k, 32 * k]], stretchY: two ? [[5 * k, (m - 4) * k], [(m + 4) * k, (H - 5) * k]] : [[7 * k, (H - 7) * k]], content: two ? [7 * k, 4 * k, 33 * k, (H - 4) * k] : [7 * k, 4 * k, 33 * k, (H - 4) * k] });
      };
      img("zcard", true); img("zcard1", false); img("zcardL", true, true); img("zcardL1", false, true);
      const csz = ["interpolate", ["linear"], ["zoom"], 13, 11, 16, 12.5];
      // 카드 형식은 하나: 금액이 있으면 '이름 / X억'(두 칸), 없으면 이름만(한 칸). 신고가를 켜면 아래 칸에 빨간 '▲신고가'
      // 내 돈으로 되는 곳 = 남색 카드, 안 되는 곳 = 옅은 회청색 카드(면과 같은 규칙)
      const NM_C = ["case", ["==", ["get", "y"], 1], "#FFFFFF", dk ? "#C3CCD8" : "#2E3A55"];
      const HI = dk ? "#FF9C8A" : "#C0261B", two = ["any", ["!=", ["get", "s"], ""], ["!=", ["get", "h"], ""]];
      const card = (id, f, maxz, src, top) => L({ id, type: "symbol", source: src || "zlab", minzoom: top ? 11 : 13, maxzoom: maxz || 24, filter: f, layout: { ...(top ? { "icon-allow-overlap": true, "text-allow-overlap": true } : {}), "icon-image": ["concat", ["case", ["==", ["get", "y"], 1], "zcard", "zcardL"], ["case", two, "", "1"]], "icon-text-fit": "both", "icon-text-fit-padding": [2, 2, 2, 2], "text-field": ["case", two, ["format", ["get", "n"], { "text-color": NM_C }, "\n", {}, ["get", "s"], { "text-color": CARD_INK }, ["case", ["all", ["!=", ["get", "s"], ""], ["!=", ["get", "h"], ""]], " ", ""], {}, ["get", "h"], { "text-color": HI, "font-scale": 0.9 }], ["format", ["get", "n"], { "text-color": NM_C }]], "text-font": ["Noto Sans Bold"], "text-size": csz, "text-line-height": 1.55, "text-max-width": 20, "text-padding": 3, ...(top ? { "text-anchor": "top", "text-offset": [0, 0.35] } : { "text-variable-anchor": ["top", "bottom", "right", "left"], "text-radial-offset": 0.35, "text-justify": "center" }), "symbol-sort-key": ["get", "k"] }, paint: {} });
      card("zone-lab", ["==", ["get", "p"], 0]);
      card("zone-lab-p", ["==", ["get", "p"], 1], 16);   // 핀 있는 곳은 16부터 핀 라벨('이름 · X억')로
      // 보이지 않는 역 자리표(줌 14+): 구역 카드가 역 점을 덮지 않고 아래·위·옆으로 비켜 가게(카드는 자리 4곳 중 빈 곳으로)
      if (!map.getLayer("stn-blk")) map.addLayer({ id: "stn-blk", type: "symbol", source: "stn", minzoom: 14, layout: { "text-field": "●", "text-font": ["Noto Sans Regular"], "text-size": 14, "text-allow-overlap": true, "text-padding": 1 }, paint: { "text-opacity": 0 } });
      // 고른 구역 카드: 다른 카드·핀에 밀려 숨지 않게 맨 위에 늘 그린다(값은 그 구역 id로 계산)
      card("sel-lab", ["==", ["get", "p"], 0], 24, "sellab", true);
      card("sel-lab-p", ["==", ["get", "p"], 1], 16, "sellab", true);
      // 역 표시: 흰 점 + 남색 테두리 + '○○역'
      L({ id: "spt-c", type: "circle", source: "spt", filter: ["==", ["get", "k"], "s"], paint: { "circle-radius": 7, "circle-color": dk ? "#151B23" : "#FFFFFF", "circle-stroke-color": dk ? "#9DBBFF" : "#1F3A87", "circle-stroke-width": 3 } });
      // 고리 이름('걸어서 10분·15분')은 고리 위 끝에 고정
      L({ id: "spt-rlab", type: "symbol", source: "spt", filter: ["==", ["get", "k"], "r"], layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Regular"], "text-size": 10.5, "text-anchor": "bottom", "text-offset": [0, -0.2], "text-allow-overlap": true, "text-ignore-placement": false }, paint: { "text-color": dk ? "#C7D6FF" : "#1F3A87", "text-halo-color": halo, "text-halo-width": 2 } });
      // 역 이름: 구역 카드가 먼저 자리 잡고(카드 레이어 아래에 둠), 역 이름은 아래·오른쪽·왼쪽·위 중 비어 있는 쪽에. 다 막히면 아래에 겹쳐서라도 보인다
      if (!map.getLayer("spt-lab")) map.addLayer({ id: "spt-lab", type: "symbol", source: "spt", filter: ["==", ["get", "k"], "s"], layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-variable-anchor": ["bottom", "left", "right", "top"], "text-radial-offset": 0.85, "text-padding": 2, "text-justify": "auto", "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": dk ? "#C7D6FF" : "#1F3A87", "text-halo-color": halo, "text-halo-width": 2 } }, "zone-lab");
      // 목록 줄에 마우스: 그 구역 이름표를 맨 위에(줌과 상관없이, 다른 카드에 안 가림)
      L({ id: "hov-lab", type: "symbol", source: "hov", filter: ["==", ["geometry-type"], "Point"], layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": 12.5, "text-anchor": "bottom", "text-offset": [0, -1.35], "text-allow-overlap": true, "text-ignore-placement": false }, paint: { "text-color": dk ? "#F5C33B" : "#7A5200", "text-halo-color": halo, "text-halo-width": 2.4 } });
      // 알약·구 묶음 자리표(보이지 않는 글자, 맨 위 = 가장 먼저 자리 잡음): 구역·동·역·구 이름이 DOM 알약 밑에 깔리지 않게
      L({ id: "pill-blk", type: "symbol", source: "pillb", layout: { "text-field": ["get", "t"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-anchor": ["case", ["has", "c"], "center", "bottom"], "text-offset": ["case", ["has", "c"], ["literal", [0, 0]], ["literal", [0, -0.55]]], "text-line-height": 1.6, "text-allow-overlap": true, "text-padding": 7 }, paint: { "text-opacity": 0 } });
      stnDraw(); hovDraw(); guDraw();
      FSV.clear(); MW.clear();
      ready = true;
      layerData();
      layers();
      paint();
      focus(pendFocus); pendFocus = false;
      if (stnF && stnPend) stnGo();
      notes(); edgeSoon();
    }
    // 구 이름 자리: 가장 큰 고리의 면적 중심. 동 이름 자리: 그 동(지번 주소 첫 낱말) 구역들의 평균 위치
    function guLabels() {
      const F = [];
      ((geo && geo.gu) || []).forEach((g) => {
        let best = null, ba = 0;
        (g.r || []).forEach((rg) => {
          let a = 0, x = 0, y = 0;
          for (let i = 0, n = rg.length - 1; i < n; i++) { const [x0, y0] = rg[i], [x1, y1] = rg[i + 1], f = x0 * y1 - x1 * y0; a += f; x += (x0 + x1) * f; y += (y0 + y1) * f; }
          if (Math.abs(a) > ba) { ba = Math.abs(a); best = [x / (3 * a), y / (3 * a)]; }
        });
        if (best && isFinite(best[0])) F.push({ type: "Feature", geometry: { type: "Point", coordinates: best }, properties: { n: g.n } });
      });
      return FC(F);
    }
    function dongLabels() {
      const M = new Map();
      R.forEach((r) => {
        if (!r.ll) return;
        const t = String(r.j || "").trim().split(/\s+/)[0] || "";
        if (!/^[가-힣\d]{1,8}(동|가)$/.test(t)) return;
        // 같은 이름 동끼리 3km 안이면 하나로(구 경계에 걸친 동이 두 번 찍히지 않게)
        const L = M.get(t) || []; M.set(t, L);
        let m = L.find((q) => Math.hypot((q.a / q.c - r.ll[0]) * 111, (q.b / q.c - r.ll[1]) * 88) < 3);
        if (!m) { m = { n: t, a: 0, b: 0, c: 0 }; L.push(m); }
        m.a += r.ll[0]; m.b += r.ll[1]; m.c++;
      });
      return FC([...M.values()].flat().map((m) => ({ type: "Feature", geometry: { type: "Point", coordinates: [m.b / m.c, m.a / m.c] }, properties: { n: m.n, k: -m.c } })));
    }
    // 노선: 사이트 SVG 지도 좌표(xy)를 역 좌표로 맞춘 1차 변환의 역변환으로 위경도로 바꿔 그린다
    let SUBG = null;
    function subwayGeo() {
      if (SUBG) return SUBG;
      const S = (D.stations || []).filter((s) => s[4] != null && s[5] != null);
      const fit = (ix) => {   // v = a*lng + b*lat + c (최소제곱)
        let m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
        S.forEach((s) => { const x = [s[2], s[1], 1]; for (let i = 0; i < 3; i++) { v[i] += x[i] * s[ix]; for (let j = 0; j < 3; j++) m[i][j] += x[i] * x[j]; } });
        const det = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
        const d0 = det(m);
        return [0, 1, 2].map((k) => det(m.map((row, i) => row.map((c, j) => (j === k ? v[i] : c)))) / d0);
      };
      const X = fit(4), Y = fit(5);
      const dd = X[0] * Y[1] - X[1] * Y[0];
      const toLL = (x, y) => { const px = x - X[2], py = y - Y[2]; return [(px * Y[1] - py * X[1]) / dd, (X[0] * py - Y[0] * px) / dd]; };
      const F = [];
      Object.entries(TRD.paths || {}).forEach(([li, arr]) => {
        const c = (TRD.col || [])[+li] || "#888";
        (Array.isArray(arr) ? arr : [arr]).forEach((str) => {
          const pts = String(str).trim().split(/\s+/).map((q) => q.split(",").map(Number)).filter((q) => q.length === 2 && isFinite(q[0]));
          if (pts.length > 1) F.push({ type: "Feature", geometry: { type: "LineString", coordinates: pts.map(([x, y]) => toLL(x, y)) }, properties: { c, n: (TRD.lines || [])[+li] || "" } });
        });
      });
      return (SUBG = FC(F));
    }
    // 기본은 압구정을 가운데 둔 한강 W자 구간. 내 돈으로 되는 구역이 그 밖에 있으면 거기까지 넓힌다.
    const CORE = [[126.882, 37.494], [127.118, 37.562]];   // 망원~잠실, 가운데가 반포·압구정 사이(한강 W자가 좌우 대칭으로 들어오게)
    function affBB() {
      let [[a, b], [c, d]] = CORE;
      try {
        const f = okSafe(), P = R.filter((r) => r.ll && f(r)).map((r) => r.ll);
        if (P.length) {
          const la = P.map((x) => x[0]).sort((x, y) => x - y), lo = P.map((x) => x[1]).sort((x, y) => x - y);
          const q = (A, f) => A[Math.max(0, Math.min(A.length - 1, Math.round((A.length - 1) * f)))];
          const t = P.length >= 8 ? 0.04 : 0;   // 동떨어진 한두 곳 때문에 너무 멀어지지 않게
          a = Math.min(a, q(lo, t)); c = Math.max(c, q(lo, 1 - t)); b = Math.min(b, q(la, t)); d = Math.max(d, q(la, 1 - t));
        }
      } catch (e) {}
      // PC: 첫 화면에서 서울 전체가 보이게(보이는 부분 안에) — 폰은 작은 지도라 내 돈으로 되는 곳 둘레만
      if (!MQ_SHEET.matches) { a = Math.min(a, SEOUL_BB[0][0]); b = Math.min(b, SEOUL_BB[0][1]); c = Math.max(c, SEOUL_BB[1][0]); d = Math.max(d, SEOUL_BB[1][1]); }
      return [[a, b], [c, d]];
    }
    // 지도 위에 떠 있는 것(위 게이지·아래 '목록 보기')을 피한 여백
    // settled = 곧 페이지가 지도 칸이 머리 밑에 붙는 자리까지 스크롤된다(구 고르기). 지금 자리가 아니라 그 자리 기준으로 보이는 부분을 잰다
    function fitPad(settled) {
      const P = { top: 14, bottom: 14, left: 20, right: 20 };   // 양끝 핀·구 이름이 가장자리에 붙지 않게
      try {
        const cv = map.getCanvas().getBoundingClientRect();
        // 데스크톱 끼워 둔 지도: 오른쪽 위 레일·가장자리 카드 자리를 비워 양끝 구역(강서·양천 등)이 잘리지 않게
        // 처음 화면에서 지도 아래쪽이 창 밖이면 보이는 부분 안에 맞춘다
        if (!MQ_SHEET.matches) {
          let bot = cv.bottom;
          if (settled && !document.documentElement.classList.contains("s-full")) { const mc = document.querySelector("#mapTop .main>.mapcard"); if (mc) { const top0 = (HDR() || 56) + 8 + (cv.top - mc.getBoundingClientRect().top); bot = Math.min(cv.bottom, top0 + cv.height); } }
          P.left = 40; P.right = Math.max(40, railPad()); P.top = 30; P.bottom = 24 + Math.round(Math.min(cv.height * 0.62, Math.max(0, bot - innerHeight)));
        }
        const ov = (sel) => { const e = document.querySelector(sel); if (!e || e.hidden || !e.offsetWidth) return null; const b = e.getBoundingClientRect(); return b.bottom > cv.top && b.top < cv.bottom && b.right > cv.left && b.left < cv.right ? b : null; };
        const m = ov(".s-mini"); if (m && m.width > cv.width * 0.6 && m.top <= cv.top + 40) P.top = Math.round(m.bottom - cv.top + 10);
        const x = ov(".s-fullx"); if (x) P.bottom = Math.round(cv.bottom - x.top + 6);
      } catch (e) {}
      return P;
    }
    function fitTo(bb, anim, maxZ) {
      const pad = fitPad(), cam = map.cameraForBounds(bb, { padding: pad, maxZoom: maxZ });
      if (!cam) return;
      let z = cam.zoom;
      // 세로로 긴 폰 화면: 서울(가로로 넓음)이 위아래로 남으면 조금 더 당겨서 채운다(양옆은 살짝 잘려도 손가락으로 밀어 봄)
      try {
        const cv = map.getCanvas(), H = cv.clientHeight - pad.top - pad.bottom, W = cv.clientWidth;
        const y0 = maplibregl.MercatorCoordinate.fromLngLat([bb[0][0], bb[1][1]]).y, y1 = maplibregl.MercatorCoordinate.fromLngLat([bb[0][0], bb[0][1]]).y;
        const h = (y1 - y0) * 512 * Math.pow(2, z);
        if (MQ_SHEET.matches && H > W * 1.15 && h > 0 && H / h > 1.3) z +=Math.min(0.45, Math.log2(H / h) * 0.5);
      } catch (e) {}
      map.easeTo({ center: cam.center, zoom: Math.min(z, maxZ + 0.75), duration: anim && !reduceMotion() ? 700 : 0 });
    }
    function fitAff(anim, force) {
      if (!map || !ready || mapView !== "seoul" || gu) return;
      map.resize();
      if (stnF) return;   // 역을 보고 있는 동안은 자동 맞춤으로 옮기지 않는다
      if (!force && typeof window.ZP_bbOn === "function" && window.ZP_bbOn()) return;   // 목록이 '지도 범위만'을 따르는 동안도(금액을 바꿔도 보던 곳 그대로)
      fitTo(affBB(), anim, 12);
    }
    // 지도 라이브러리(~180KB)·경계(geo.json ~115KB)·타일은 지도 칸이 화면 근처에 올 때 처음 불러온다(도구 화면으로 바로 들어온 경우 등).
    // 그 전엔 SVG 간단 지도(또는 첫 화면 섬의 자리 그림)가 그대로 보인다. 한 번 뜬 뒤 동작은 예전과 같다.
    let nearIO = null;
    const isNear = () => { const b = $("mapbox"); if (!b) return true; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > -400 && r.top < innerHeight + 400; };
    function whenNear(fn) {
      if (isNear() || typeof IntersectionObserver !== "function") return true;
      if (!nearIO) {
        nearIO = new IntersectionObserver((es) => { if (!es.some((e) => e.isIntersecting)) return; nearIO.disconnect(); nearIO = null; fn(); }, { rootMargin: "400px 0px" });
        nearIO.observe($("mapbox"));
      }
      return false;
    }
    function seoul() {
      gu = null; guDraw();
      ui();
      if (!want || failed) return show(false);
      if (!map && !whenNear(() => { if (mapView === "seoul" && !gu) seoul(); })) return;
      show(true);
      Promise.all([loadLib(), loadGeo()])
        .then(() => {
          if (mapView !== "seoul") return;
          if (!init()) { show(false); return; }
          // 처음엔 서울 전체가 아니라 '내 돈으로 되는 구역'이 모인 곳에 맞춘다(폰 지도는 작아서 전체는 답답함)
          const fitS = () => { if (stnF) { if (stnPend) stnGo(); return; } if (mapView === "seoul" && !gu) { map.resize(); if (ready) fitTo(affBB(), false, 12); else map.fitBounds(CORE, { padding: 12, duration: 0 }); } };
          fitS(); requestAnimationFrame(fitS); map.once("idle", fitS);
          map.once("idle", () => { try { dispatchEvent(new Event("zp:mapready")); } catch (e) {} });
          if (ready) paint();
        })
        .catch(() => { failed = true; show(false); });
    }
    function layerData() {
      const F = [];
      (HJD.items || []).forEach((h) => {
        if (/개통/.test(h.st || "") && !(h.stn || []).some(([, s]) => !/개통/.test(s))) return;
        (h.stn || []).forEach(([n, s]) => { if (/개통/.test(s)) return; const st = stnBy(n); if (st) F.push({ type: "Feature", geometry: { type: "Point", coordinates: [st.ll[1], st.ll[0]] }, properties: { n: `${h.n} ${n}`, sn: (`${h.n.replace(/\s*\(.*\)$/, "")} ${n}`).slice(0, 10), s, c: h.c || "#7A3FB8" } }); });
        if (h.pt && h.pt.length === 2) { const [a, b] = h.pt; const ll = a > 90 ? [a, b] : [b, a]; F.push({ type: "Feature", geometry: { type: "Point", coordinates: ll }, properties: { n: h.n.replace(/\s*\(.*\)$/, ""), sn: h.n.replace(/\s*\(.*\)$/, "").slice(0, 10), s: h.st || "", c: h.c || "#7A3FB8" } }); }
      });
      map.getSource("hj").setData(FC(F));
      const H = [];
      R.forEach((r) => { const t = r.tx && r.tx.hi, z = geo && geo.z[r.id]; if (!t || r.dn) return; const c = z ? z.l : r.ll ? [r.ll[1], r.ll[0]] : null; if (c) H.push({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: { t: `▲ 24년 이후 최고 ${t[1].slice(2, 4)}.${t[1].slice(4, 6)}` } }); });
      map.getSource("hi").setData(FC(H));
      if (lyr.has("biz") || lyr.has("acad")) ZXS.load().then((S) => { if (!S || !map.getSource("sang")) return; map.getSource("sang").setData(FC(S.items.map((x) => ({ type: "Feature", geometry: { type: "Point", coordinates: [x[0], x[1]] }, properties: { n: x[2], st: x[4], ac: x[5], sa: x[6] } })))); const q = $("lmSangQ"); if (q) q.textContent = `(${S.q})`; });
    }
    function layers() {
      if (!map || !ready) return;
      const ids = { hj: ["ly-hj", "ly-hj-lab"], hi: ["ly-hi"], edu: ["ly-edu", "ly-edu-lab"], acad: ["ly-acad", "ly-acad-lab"], biz: ["ly-biz-heat", "ly-biz", "ly-biz-lab"], med: ["ly-med", "ly-med-lab"], mart: ["ly-mart", "ly-mart-lab"] };
      Object.entries(ids).forEach(([k, ls]) => ls.forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, "visibility", lyr.has(k) ? "visible" : "none")));
    }
    function labelOf(r) {
      if (BINS[colorBy]) { const v = metric(r); if (v == null) return ""; return colorBy === "old" ? `노후 ${v}%` : colorBy === "vol" ? `1년 ${v}건` : `1년 ${v > 0 ? "+" : ""}${v}%`; }
      if (colorBy === "cash") {
        const k = dotState(r);
        if (k === "y" || k === "n") {
          const x = gapMode() ? gapOf(r) : investC(r);
          const need = gapMode() ? x.now : effBasis() === "total" ? x.needTotal : x.needBuy;
          if (need != null && isFinite(need)) return `${gapMode() ? "지금" : effBasis() === "total" ? "입주까지" : "지금"} ${ZF.cash(need)}`;
        }
        return CASH_LAB[k] || "";
      }
      return r.src === "moa" ? "모아타운" : stageName(r);
    }
    // 카드 아래 칸: 값이 있으면 금액(지금 X억), 없으면 단계
    // 카드 아래 칸: 금액(X억)만. 금액이 없으면 빈칸 → 카드는 이름만 한 칸
    function cardVal(r) {
      const t = labelOf(r);
      if (BINS[colorBy]) return t || "";
      const m = /([\d.,]+(?:억|만|원))/.exec(t || "");
      return m ? m[1] : "";
    }
    // 같은 짧은 이름이 둘 이상이면(예: '역촌역세권 장기전세' 3곳) 지도 글자에 동을 붙여 구분한다
    let NMC = null;
    const dongOfR = (r) => { const t = String(r.j || "").trim().split(/\s+/)[0] || ""; return /^[가-힣\d]{1,8}(동|가)$/.test(t) ? t : r.g || ""; };
    const nmOf = (r) => {
      if (!NMC) { NMC = new Map(); R.forEach((x) => { const k = shortName(x.n) || ""; NMC.set(k, (NMC.get(k) || 0) + 1); }); }
      const n = shortName(r.n) || "";
      return NMC.get(n) > 1 ? { n, d: dongOfR(r) } : { n, d: "" };
    };
    const cardName = (r) => {
      let { n, d } = nmOf(r);
      // 이름이 이미 '…(동)'으로 끝나면(검색 쪽 shortName이 붙인 구분) 그 괄호는 자르지 않는다
      const m = /^(.*\S)\s*\(([^()]{1,8})\)$/.exec(n);
      if (m) { n = m[1]; d = d || m[2]; }
      // 13자까지는 그대로('화곡동 1087 모아타운'), 더 길면 낱말 단위로 줄이고 '…'(낱말 가운데서 자르면 '화곡동 1087 …'처럼 잘렸다)
      if (!d) { if (n.length <= 13) return n; const w = n.split(/\s+/); let t = ""; for (const x of w) { if ((t ? t.length + 1 : 0) + x.length > 12) break; t = t ? t + " " + x : x; } return (t || n.slice(0, 12)) + "…"; }
      const a = n.length + d.length + 2 <= 13 ? n : n.split(/\s+/)[0].slice(0, 9);
      return `${a}(${d})`;
    };
    const fullName = (r) => { const { n, d } = nmOf(r); return d ? `${n}(${d})` : n; };
    let labSel = null;
    const hiOf = (r) => { const t = r.tx && r.tx.hi; return t && !r.dn ? t : null; };
    function paint() {
      if (!map || !ready || !geo) return;
      const Z = geo.z;
      const vis = R.filter((r) => r.ll && visible(r) && kindOk(r));
      const off = [], est = [], lab = [], pts = [], hiOn = lyr.has("hi"), selId = cur && cur.id;
      let selF = null;
      VIS = vis;
      for (const r of vis) {
        const z = Z[r.id];
        // 이름표(줌 13부터): 금액은 알약이 말하므로 이름만(카드 값을 '내 현금' 말고 다른 기준으로 고르면 그 값) · 신고가를 켜면 아래 칸에 '▲신고가'
        const s = colorBy === "cash" ? "" : cardVal(r), h = hiOn && hiOf(r) ? "▲신고가" : "";
        const k = (s ? 2 : 3) - (h ? 1 : 0);
        const lf = { type: "Feature", geometry: { type: "Point", coordinates: z ? z.l : [r.ll[1], r.ll[0]] }, properties: { id: r.id, n: cardName(r), s, h, y: 0, k: z ? k : k + 0.5, p: 0 } };
        if (r.id === selId) selF = lf; else lab.push(lf);   // 고른 구역 카드는 따로(sel-lab) 늘 보이게
        if (z) (z.e ? est : off).push({ type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: { id: r.id } });
        else pts.push({ type: "Feature", geometry: { type: "Point", coordinates: [r.ll[1], r.ll[0]] }, properties: { id: r.id } });
      }
      labSel = selId || null;
      map.getSource("zones").setData(FC(off));
      map.getSource("zest").setData(FC(est));
      map.getSource("zlab").setData(FC(lab));
      map.getSource("sellab").setData(FC(selF ? [selF] : []));
      map.getSource("pts").setData(FC(pts));
      legend();
      states();
    }
    // ===================== 지도 위 '지금 필요한 돈' 알약 · 상태 점 · 구 묶음(리뉴얼 3단계) =====================
    // 상태 4가지는 남색 한 가지 안에서 모양으로만 가른다(새 색 없음): 가능 = 남색 알약·흰 글씨(면 20%) · 조금 모자람(내 돈×1.2 안) = 흰 알약·남색 테두리 '+2,000만'(면 없이 테두리만)
    // 멀다 = 6px 회남색 점(면 아주 옅게) · 정보 부족 = 점선 점. 판정·금액은 목록과 같은 함수(SIMPLE.zstate · ZF.cash).
    // 알약은 화면 안 구역 중 맞춤순(가능 먼저 내 돈에 가까운 순 → 조금 모자람은 모자란 돈 적은 순) 위에서 40개까지, 서로·떠 있는 버튼과 겹치면 점으로.
    // 관심 구역 = 하트 + 굵은 테두리. 줌 11 이하(서울 보기) = 구 묶음 '구로 · 가능 3'(남색 농도 = 곳 수), 누르면 그 구로.
    // 알약·구 묶음은 DOM 버튼(접근 가능한 이름 '정릉3구역, 지금 필요한 돈 7,300만, 가능')이라 지도 글자 배치에 안 끼므로, 같은 자리에 보이지 않는 글자(pill-blk)를 깔아 구역·동·역 이름이 그 밑에 깔리지 않게 한다.
    const CITYZ = 11, PILL_MAX = 40;
    const ST_K = { ok: 0, near: 1, far: 2, na: 3 };
    let ZS = new Map(), pillRaf = 0, pickId = null, VIS = [], lastCity = null, toastEl = null, toastTm = 0, pinSnap = null, pinHooked = false;
    const PILLS = new Map(), GUS = new Map(), FSV = new Map();
    const zsOf = (r) => { try { return SIMPLE.zstate(r); } catch (e) { return { st: "na", need: null, total: null }; } };
    function computeStates() { const M = new Map(); for (const r of R) if (r.ll) M.set(r.id, zsOf(r)); ZS = M; }
    // 면·테두리 칠: feature-state k(0 가능 · 1 모자람 · 2 멀다 · 3 정보 부족) · f(관심 구역) — 바뀐 구역만 다시 넣는다
    function stateFS() {
      if (!map || !ready || !geo) return;
      const mine = mineSet(), Z = geo.z;
      for (const [id, s] of ZS) {
        const z = Z[id]; if (!z) continue;
        const k = ST_K[s.st], f = mine.has(id), c = k * 2 + (f ? 1 : 0);
        if (FSV.get(id) === c) continue;
        FSV.set(id, c);
        try { map.setFeatureState({ source: z.e ? "zest" : "zones", id }, { k, f }); } catch (e) {}
      }
    }
    function mineSet() {
      let L = null;
      try { const PZ = typeof PINS !== "undefined" ? PINS : window.PINS; if (PZ && typeof PZ.list === "function") L = PZ.list(); } catch (e) {}
      if (!Array.isArray(L)) { try { L = FAV; } catch (e) { L = []; } }
      return new Set((L || []).map((x) => (x && typeof x === "object" ? x.id : x)).filter(Boolean));
    }
    const llOf = (r) => { const z = geo && geo.z[r.id]; return z ? z.l : r.ll ? [r.ll[1], r.ll[0]] : null; };
    // 글자 폭(알약 겹침 계산용): 알약과 같은 글꼴로 캔버스에서 잰다
    const MW = new Map(); let mctx = null;
    const measure = (t, px, w8) => { const k = px + "|" + (w8 || 700) + "|" + t; if (MW.has(k)) return MW.get(k); if (!mctx) mctx = document.createElement("canvas").getContext("2d"); mctx.font = `${w8 || 700} ${px}px 'Pretendard Variable',Pretendard,'Apple SD Gothic Neo','Noto Sans KR',sans-serif`; const v = Math.ceil(mctx.measureText(t).width); MW.set(k, v); return v; };
    // 떠 있는 것(겹쳐 보기 레일·확대 버튼·위 작은 막대·목록 보기·안내·고른 구역 카드) 자리: 알약·구 묶음을 그 밑에 두지 않는다
    function obstacles() {
      const out = [];
      try {
        const cb = map.getCanvas().getBoundingClientRect();
        document.querySelectorAll("#mapbox .s-rail, #lmap .lm-zoom, #lmap .lm-ctl, .s-mini, .s-fullx, #lmNotes, #lmAucLg, #lmPick, #lmap .lm-snote, #lmap .maplibregl-ctrl-attrib").forEach((e) => {
          if (!e.offsetWidth || e.hidden || e.closest("[hidden]")) return;
          const b = e.getBoundingClientRect();
          if (b.bottom <= cb.top || b.top >= cb.bottom || b.right <= cb.left || b.left >= cb.right) return;
          out.push([b.left - cb.left - 4, b.top - cb.top - 4, b.right - cb.left + 4, b.bottom - cb.top + 4]);
        });
      } catch (e) {}
      return out;
    }
    const hitB = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const HEART_S = '<svg class="zp-h" width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-4.9-9.7-10C1.2 7.4 3.5 4 7 4c2.1 0 3.8 1.2 5 3 1.2-1.8 2.9-3 5-3 3.5 0 5.8 3.4 4.7 7-1.7 5.1-9.7 10-9.7 10z" fill="currentColor"/></svg>';
    const pillText = (s) => (s.st === "near" ? SIMPLE.shortTxt(s.need) : ZF.cash(s.need));
    const pillLabel = (r, s, fav, nw) => `${fullName(r)}, 지금 필요한 돈 ${ZF.cash(s.need)}, ${SIMPLE.stWord[s.st]}${s.st === "near" ? `, ${SIMPLE.shortTxt(s.need).slice(1)} 더 필요` : ""}${fav ? ", 관심 구역" : ""}${nw ? ", 이번 주 새로 가능" : ""}`;
    const selId = () => pickId || (cur && cur.id) || null;
    function states() {
      if (!map || !ready || !geo || pillRaf) return;
      pillRaf = requestAnimationFrame(() => { pillRaf = 0; if (!map || !ready) return; pinHooks(); computeStates(); stateFS(); layout(); });
    }
    function layout() {
      if (!map || !ready || !geo) return;
      if ($("lmap").hidden) { pillsSet(new Map()); gusSet([]); return; }
      const city = map.getZoom() <= CITYZ + 1e-6;
      lastCity = city;
      if (city) { pillsSet(new Map()); dotsSet([]); guLayout(); }
      else { gusSet([]); pillsLayout(); }
    }
    function pillsLayout() {
      const cv = map.getCanvas(), W = cv.clientWidth, H = cv.clientHeight;
      if (W < 50 || H < 50) return;
      const obs = obstacles(), mine = mineSet(), sel = selId(), named = map.getZoom() >= 15;
      const C = [];
      for (const r of VIS) { const s = ZS.get(r.id); if (s && (s.st === "ok" || s.st === "near") && s.need != null) C.push([r, s]); }
      const rank = ([r, s]) => (r.id === sel ? -2e9 : 0) + (mine.has(r.id) ? -1e9 : 0) + (s.st === "ok" ? Math.abs(CASH - s.need) : 1e6 + s.need);
      C.sort((a, b) => rank(a) - rank(b));
      const placed = [], P = new Map();
      for (const [r, s] of C) {
        if (P.size >= PILL_MAX) break;
        const ll = llOf(r); if (!ll) continue;
        const q = map.project(ll);
        if (q.x < 4 || q.x > W - 4 || q.y < 4 || q.y > H - 4) continue;
        const t = pillText(s), fav = mine.has(r.id), nm = named ? cardName(r) : "", nw = SIMPLE.isNew(r, s.need);
        const w = measure(t, 13) + 18 + (fav ? 14 : 0) + (nm ? measure(nm, 12, 600) + 6 : 0) + (nw ? 30 : 0), h = 28;
        const bx = [q.x - w / 2 - 2, q.y - h - 2, q.x + w / 2 + 2, q.y + 1];
        if (bx[0] < 2 || bx[2] > W - 2 || bx[1] < 2) continue;
        if (r.id !== sel && (obs.some((o) => hitB(o, bx)) || placed.some((o) => hitB(o, bx)))) continue;
        placed.push(bx); P.set(r.id, { r, s, t, fav, nm, nw, sel: r.id === sel });
      }
      pillsSet(P);
      // 알약이 없는 구역은 점(멀다 6px 회남색 · 정보 부족 점선 · 가능·모자람인데 자리가 없으면 작은 남색 점 · 관심 구역은 하트)
      const F = [];
      for (const r of VIS) {
        if (P.has(r.id)) continue;
        const s = ZS.get(r.id), ll = llOf(r); if (!s || !ll) continue;
        F.push({ type: "Feature", geometry: { type: "Point", coordinates: ll }, properties: { id: r.id, t: mine.has(r.id) ? "fav" : s.st, k: mine.has(r.id) ? 0 : ST_K[s.st] + 1 } });
      }
      dotsSet(F);
    }
    function dotsSet(F) { try { map.getSource("zdot").setData(FC(F)); } catch (e) {} }
    function pillsSet(P) {
      PILLS.forEach((p, id) => { if (!P.has(id)) { p.mk.remove(); PILLS.delete(id); } });
      const B = [];
      P.forEach((v, id) => {
        let p = PILLS.get(id);
        const ll = llOf(v.r);
        if (!p) {
          const el = document.createElement("button");
          el.type = "button"; el.tabIndex = -1; el.dataset.zid = id;
          el.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); pillTap(id); });
          p = { el, key: "", mk: new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(ll).addTo(map) };
          PILLS.set(id, p);
        }
        const key = [v.s.st, v.t, v.fav, v.sel, v.nm, v.nw].join("|");
        if (p.key !== key) {
          p.key = key;
          p.el.className = `zpill st-${v.s.st}${v.fav ? " fav" : ""}${v.sel ? " sel" : ""}`;
          p.el.style.zIndex = v.sel ? 4 : v.fav ? 3 : v.s.st === "ok" ? 2 : 1;
          p.el.innerHTML = `<span class="zp-in">${v.fav ? HEART_S : ""}${v.nm ? `<i class="zp-n">${esc(v.nm)}</i>` : ""}<b class="zp-v">${esc(v.t)}</b>${v.nw ? '<em class="zp-new">NEW</em>' : ""}</span>`;
          p.el.setAttribute("aria-label", pillLabel(v.r, v.s, v.fav, v.nw));
          p.el.setAttribute("aria-pressed", String(!!v.sel));
        }
        B.push({ type: "Feature", geometry: { type: "Point", coordinates: ll }, properties: { t: (v.fav ? "♥ " : "") + (v.nm ? v.nm + " " : "") + v.t + (v.nw ? " NEW" : "") } });
      });
      try { map.getSource("pillb").setData(FC(B)); } catch (e) {}
    }
    // 알약 누르기: 처음 = 고르기(진한 남색·1.15배) + 목록의 그 카드(PC는 목록에서 스크롤, 폰은 지도 아래 카드) · 같은 알약 한 번 더 = 상세
    function pillTap(id) {
      if (!byId[id]) return;
      const pc = !MQ_SHEET.matches, H = document.documentElement;
      if (pickId === id || (pc && H.classList.contains("s-rep"))) { pickClear(); curTab = "money"; select(id, false, false, { scroll: false }); return; }
      pickId = id;
      let inList = false; try { inList = SIMPLE.pick(id, pc); } catch (e) {}
      pickCard(!pc || !inList ? id : null);
      layout();
    }
    function pickClear() { if (!pickId) return; pickId = null; try { SIMPLE.pick(null); } catch (e) {} pickCard(null); layout(); }
    function pickCard(id) {
      let el = $("lmPick");
      if (!id) { if (el && !el.hidden) { el.hidden = true; edgeSoon(); } return; }
      if (!el) {
        el = document.createElement("div"); el.id = "lmPick"; el.className = "lm-pick"; el.setAttribute("role", "region"); el.setAttribute("aria-label", "지도에서 고른 구역");
        el.addEventListener("click", (e) => {
          if (e.target.closest("[data-heart]")) return;
          if (e.target.closest(".lm-pick-x")) { pickClear(); return; }
          const a = e.target.closest("[data-zid]"); if (!a) return;
          e.preventDefault(); e.stopPropagation();
          const z = a.dataset.zid; pickClear(); curTab = "money"; select(z, false, false, { scroll: false });
        });
        $("lmap").appendChild(el);
      }
      const r = byId[id];
      el.innerHTML = `<ol class="s-list">${SIMPLE.cardHTML(r, { z: ZS.get(id) || zsOf(r) })}</ol><button type="button" class="lm-pick-x" aria-label="고른 구역 닫기"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
      try { const cv = map.getCanvas().getBoundingClientRect(), fx = document.querySelector(".s-fullx"), fb = fx && fx.offsetWidth ? fx.getBoundingClientRect() : null; el.style.bottom = (fb && fb.top < cv.bottom && fb.bottom > cv.top ? Math.round(cv.bottom - fb.top + 8) : 10) + "px"; } catch (e) {}
      el.hidden = false;
    }
    // 구 묶음(줌 11 이하): 구 이름 자리에 동그라미 '구로 / 가능 3' · 농도 4단계(0 · 적음 · 중간 · 많음) · 서로 겹치면 곳 수 적은 구부터 뺀다
    let GUL = null;
    function guLayout() {
      if (!GUL) GUL = guLabels().features.map((f) => ({ n: f.properties.n, ll: f.geometry.coordinates }));
      let cnt = {}; try { cnt = SIMPLE.guCounts(); } catch (e) {}
      const cv = map.getCanvas(), W = cv.clientWidth, H = cv.clientHeight, obs = obstacles();
      const L = GUL.map((g) => ({ n: g.n, ll: g.ll, c: cnt[g.n] || 0 })).sort((a, b) => b.c - a.c);
      const mx = Math.max(1, ...L.map((x) => x.c)), placed = [], keep = [];
      for (const g of L) {
        if (!g.c) continue;   // 갈 수 있는 곳이 없는 구는 묶음을 그리지 않는다(구 이름은 바탕 지도에)
        const q = map.project(g.ll), sn = g.n.length > 2 ? g.n.replace(/구$/, "") : g.n;
        const d = Math.max(46, Math.max(measure(sn, 12), measure(`가능 ${g.c}`, 11)) + 14), bx = [q.x - d / 2, q.y - d / 2, q.x + d / 2, q.y + d / 2];
        if (bx[0] < 2 || bx[2] > W - 2 || bx[1] < 2 || bx[3] > H - 2) continue;
        if (obs.some((o) => hitB(o, bx)) || placed.some((o) => hitB(o, bx))) continue;
        placed.push(bx); keep.push(Object.assign(g, { sn, d, t: g.c ? (g.c / mx > 0.6 ? 3 : g.c / mx > 0.25 ? 2 : 1) : 0 }));
      }
      gusSet(keep);
      try { map.getSource("pillb").setData(FC(keep.map((g) => ({ type: "Feature", geometry: { type: "Point", coordinates: g.ll }, properties: { t: g.sn + "\n가능 " + g.c, c: 1 } })))); } catch (e) {}
    }
    function gusSet(keep) {
      const K = new Map(keep.map((g) => [g.n, g]));
      GUS.forEach((p, n) => { if (!K.has(n)) { p.mk.remove(); GUS.delete(n); } });
      K.forEach((g, n) => {
        let p = GUS.get(n);
        if (!p) {
          const el = document.createElement("button");
          el.type = "button"; el.tabIndex = -1; el.dataset.gu = n;
          el.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); try { enterGu(n); } catch (er) {} });
          p = { el, key: "", mk: new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(g.ll).addTo(map) };
          GUS.set(n, p);
        }
        const key = g.c + "|" + g.t + "|" + g.d;
        if (p.key === key) return;
        p.key = key;
        p.el.className = `zgu t${g.t}`; p.el.dataset.n = String(g.c);
        p.el.style.setProperty("--d", g.d + "px");
        p.el.innerHTML = `<b>${esc(g.sn)}</b><span>가능 ${fmt(g.c)}</span>`;
        p.el.setAttribute("aria-label", `${n}, 갈 수 있는 곳 ${fmt(g.c)}곳, 눌러서 ${n} 보기`);
      });
    }
    // 금액을 바꾸고 손을 떼면: 진동 한 번 + '새로 갈 수 있는 곳 4곳 · 2곳 빠졌어요'(바뀐 게 있을 때만, 2초) — 홈 숫자와 같은 판정(70_pins.js window.ZP_ok)
    const pinOkF = () => (typeof window.ZP_ok === "function" ? window.ZP_ok : (r) => r.ll && visible(r) && dotState(r) === "y");
    const okSafe = () => { const f = pinOkF(); return (r) => { try { return !!f(r); } catch (e) { return false; } }; };
    // 내 돈으로 되는데 위치(좌표)가 없어 지도에 못 그리는 구역 → 홈 카드 등에서 '위치 미확인 n곳'
    function noLoc() { const f = okSafe(), ids = R.filter((r) => f(r) && !llOf(r)).map((r) => r.id); return { n: ids.length, ids }; }
    const okIds = () => { const f = pinOkF(), S = new Set(); R.forEach((r) => { try { if (f(r)) S.add(r.id); } catch (e) {} }); return S; };
    function pinToast(msg) {
      if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "app-toast lm-toast"; toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite"); document.body.appendChild(toastEl); }
      toastEl.textContent = msg; toastEl.classList.add("on");
      clearTimeout(toastTm); toastTm = setTimeout(() => toastEl.classList.remove("on"), 2000);
    }
    function pinHooks() {
      if (pinHooked) return; pinHooked = true;
      // 줌 11을 넘나들면 바로 구 묶음 ↔ 알약 · 움직임이 끝나면 화면 안 구역으로 다시 고른다
      map.on("zoom", () => { const c = map.getZoom() <= CITYZ + 1e-6; if (c !== lastCity) layout(); });
      let mT = 0; map.on("moveend", () => { clearTimeout(mT); mT = setTimeout(layout, 30); });
      map.on("resize", () => { clearTimeout(mT); mT = setTimeout(layout, 60); });
      const isG = (t) => t && (t.id === "sCash" || t.id === "sMiniR" || (t.closest && t.closest(".scrub")));
      document.addEventListener("pointerdown", (e) => { if (isG(e.target)) pinSnap = okIds(); }, true);
      const done = () => {
        if (!pinSnap) return;
        const snap = pinSnap; pinSnap = null;
        try { if (navigator.vibrate) navigator.vibrate(10); } catch (er) {}
        setTimeout(() => {
          if (!map || !$("lmap") || $("lmap").hidden) return;
          const nowS = okIds(); let a = 0, b = 0; nowS.forEach((id) => { if (!snap.has(id)) a++; }); snap.forEach((id) => { if (!nowS.has(id)) b++; });
          if (a || b) pinToast([a ? `새로 갈 수 있는 곳 ${a}곳` : "", b ? `${b}곳 빠졌어요` : ""].filter(Boolean).join(" · "));
        }, 380);
      };
      document.addEventListener("change", (e) => { if (isG(e.target)) done(); }, true);
      document.addEventListener("pointerup", (e) => { if (isG(e.target)) setTimeout(done, 40); }, true);
      addEventListener("storage", () => states());
      addEventListener("keydown", (e) => { if (e.key === "Escape" && pickId) pickClear(); });
    }
    // 오른쪽 위 겹쳐 보기 레일 폭만큼 오른쪽 여백(카드가 레일 밑에 깔리지 않게)
    function railPad() { try { const w = $("mapbox") && $("mapbox").querySelector(".s-rail"); const cv = map.getCanvas().getBoundingClientRect(); if (w && w.offsetWidth) return Math.max(16, Math.round(cv.right - w.getBoundingClientRect().left) + 8); } catch (e) {} return 16; }
    function bboxOf(rings) { let a = 180, b = 90, c = -180, d = -90; rings.forEach((rg) => rg.forEach(([x, y]) => { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; })); return [[a, b], [c, d]]; }
    function focus(zoom) {
      if (!map || !ready) return;
      if (((cur && cur.id) || null) !== labSel) paint();
      const src = map.getSource("sel");
      const z = cur && geo && geo.z[cur.id];
      if (!cur || !(z || cur.ll)) { src.setData(FC([])); layout(); return; }
      src.setData(z ? { type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: {} } : FC([]));
      if (pickId && cur && pickId !== cur.id) { pickId = null; pickCard(null); }
      layout();
      if (!zoom) return;
      const dur = reduceMotion() ? 0 : 650;
      if (zoom === "soft") {
        if (map.isMoving()) return;
        // 데스크톱에서 구역을 고르면: 이미 화면 안에 잘 보이면 그대로, 아니면 그 구역으로 부드럽게 이동(줌 14.5~15.5)
        const bb = z ? bboxOf(z.g) : [[cur.ll[1], cur.ll[0]], [cur.ll[1], cur.ll[0]]];
        const cv = map.getCanvas(), a = map.project(bb[0]), b = map.project(bb[1]), rp = railPad();
        const inV = Math.min(a.x, b.x) > 40 && Math.max(a.x, b.x) < cv.clientWidth - rp && Math.min(a.y, b.y) > 50 && Math.max(a.y, b.y) < cv.clientHeight - 50;
        if (inV && map.getZoom() >= 13.5) return;
        map.fitBounds(bb, { padding: { top: 80, bottom: 80, left: 60, right: Math.max(60, rp) }, maxZoom: Math.min(15.5, Math.max(14.5, map.getZoom())), duration: dur });
        return;
      }
      // 작은 구역도 골목 몇 개만 보일 만큼 당기지 않는다(주변 역·동네가 보이게). 추정 범위(점선)는 더 넓게
      // PC 첫 화면처럼 지도 아래쪽이 창 밖이면 그만큼 아래 여백을 더 둔다(구역이 보이는 부분 가운데에 오게)
      const bp = MQ_SHEET.matches ? 70 : Math.max(70, fitPad().bottom + 30);
      if (z) map.fitBounds(bboxOf(z.g), { padding: { top: 70, bottom: bp, left: 60, right: Math.max(60, railPad()) }, maxZoom: z.e ? 14.8 : 15.5, duration: dur });
      else map.flyTo({ center: [cur.ll[1], cur.ll[0]], zoom: Math.min(15.5, Math.max(map.getZoom(), 15)), duration: dur });
    }
    // ===================== 역으로 찾기: flyTo · 역 표시 · 걸어서 500m/1km 고리 =====================
    // stnF = { ll:[lng,lat], z, n } 지금 보고 있는 역(없으면 null). 있는 동안은 자동 맞춤(fitAff·fit)이 화면을 옮기지 않는다.
    // 사용자가 2km 넘게 밀거나 줌 12 아래로 빼면, 또는 clearStation()·확대 초기화(zoom(0))면 풀린다.
    let stnF = null, stnPend = false;
    // 걸어서 10분·15분 고리: 검색 '○○역 걸어서 15분 안'과 같은 기준(분속 67m, 길 돌아가는 몫 1.3배 → 직선 515m·773m)
    const W10 = ZF.W10, W15 = ZF.W15;
    const circ = (ll, m, n) => { const [lo, la] = ll, dy = m / 111320, dx = m / (111320 * Math.cos((la * Math.PI) / 180)), P = []; for (let i = 0; i <= (n || 72); i++) { const a = (i / (n || 72)) * 2 * Math.PI; P.push([lo + dx * Math.sin(a), la + dy * Math.cos(a)]); } return P; };
    function stnDraw() {
      if (!map || !ready || !map.getSource("sdim")) return;
      if (!stnF) { ["sdim", "sring", "spt"].forEach((s) => map.getSource(s).setData(FC([]))); return; }
      const ll = stnF.ll, outer = [[124, 32], [132, 32], [132, 40], [124, 40], [124, 32]];
      map.getSource("sdim").setData({ type: "Feature", geometry: { type: "Polygon", coordinates: [outer, circ(ll, W15).reverse()] }, properties: {} });
      map.getSource("sring").setData(FC([W10, W15].map((m) => ({ type: "Feature", geometry: { type: "LineString", coordinates: circ(ll, m) }, properties: { m } }))));
      map.getSource("spt").setData(FC([
        { type: "Feature", geometry: { type: "Point", coordinates: ll }, properties: { k: "s", n: stnF.n ? stnF.n.replace(/역$/, "") + "역" : "" } },
        { type: "Feature", geometry: { type: "Point", coordinates: rlabAt(ll, W10, null) }, properties: { k: "r", n: "걸어서 10분" } },
        { type: "Feature", geometry: { type: "Point", coordinates: rlabAt(ll, W15, null) }, properties: { k: "r", n: "걸어서 15분" } },
      ]));
    }
    // 고리 이름 자리: 고리 위 끝부터 둘레를 돌며, 떠 있는 것(게이지·레일·경매 범례·확대 버튼)·구역 카드·역 이름·화면 밖과 겹치지 않는 첫 자리
    const RL_OBS = "#mapbox .s-rail, #lmap .lm-zoom, #lmap .lm-ctl, .s-mini, .s-fullx, #lmNotes, #lmAucLg";
    function rlabAt(ll, m, used) {
      const at = (deg) => { const a = (deg * Math.PI) / 180, dy = (m / 111320) * Math.cos(a), dx = (m / (111320 * Math.cos((ll[1] * Math.PI) / 180))) * Math.sin(a); return [ll[0] + dx, ll[1] + dy]; };
      if (!map || !ready) return at(0);
      try {
        const cv = map.getCanvas(), cb = cv.getBoundingClientRect(), W = cv.clientWidth, H = cv.clientHeight;
        const obs = [];
        document.querySelectorAll(RL_OBS).forEach((e) => { if (!e.offsetWidth || e.hidden || e.closest("[hidden]")) return; const b = e.getBoundingClientRect(); obs.push([b.left - cb.left - 4, b.top - cb.top - 4, b.right - cb.left + 4, b.bottom - cb.top + 4]); });
        const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
        // 구역 카드·역 이름·바탕 지도 글자(역·동 이름 — 길 이름은 빼고)와 겹치는지
        const lab = (bx) => map.queryRenderedFeatures([[bx[0], bx[1]], [bx[2], bx[3]]]).some((f) => f.layer && (f.layer.type === "symbol" || (f.layer.type === "circle" && !/^spt/.test(f.layer.id))) && f.layer.id !== "spt-rlab" && !/road|street|transportation_name|highway/.test(f.layer.id + "|" + (f.sourceLayer || "")));
        const DEG = [0, -25, 25, -50, 50, -75, 75, 180, 155, -155, 130, -130, 105, -105];
        for (const strict of [true, false])
          for (const deg of DEG) {
            const c = at(deg), p = map.project(c), bx = [p.x - 34, p.y - 18, p.x + 34, p.y + 1];
            if (bx[0] < 6 || bx[1] < 6 || bx[2] > W - 6 || bx[3] > H - 6) continue;
            if (obs.some((o) => hit(bx, o)) || (used && used.some((o) => hit(bx, o)))) continue;
            if (strict && lab(bx)) continue;
            if (used) used.push(bx);
            return c;
          }
      } catch (e) {}
      return at(0);
    }
    let rlT = 0;
    const rlabSoon = () => { clearTimeout(rlT); rlT = setTimeout(() => { if (!stnF || !map || !map.getSource("spt")) return; const used = []; const f = (k) => ({ type: "Feature", geometry: { type: "Point", coordinates: rlabAt(stnF.ll, k === 10 ? W10 : W15, used) }, properties: { k: "r", n: `걸어서 ${k}분` } }); map.getSource("spt").setData(FC([{ type: "Feature", geometry: { type: "Point", coordinates: stnF.ll }, properties: { k: "s", n: stnF.n ? stnF.n.replace(/역$/, "") + "역" : "" } }, f(15), f(10)])); }, 120); };
    function stnGo() {
      if (!map || !stnF) return;
      stnPend = false;
      try { map.resize(); } catch (e) {}
      map.stop();
      // 걸어서 10분 고리가 화면(위 게이지·아래 버튼 자리 뺀) 안에 다 들어오는 줌, 그래도 14 이상(폰 390폭 ≈ 14.4 · 15분 고리는 가장자리 밖으로 나갈 수 있음)
      try {
        if (stnF.z0 == null) stnF.z0 = stnF.z;
        const cv = map.getCanvas(), r = Math.min(cv.clientWidth, cv.clientHeight - 150) / 2 - 14;
        if (r > 80) stnF.z = Math.max(14, Math.min(stnF.z0, Math.log2((r * 78271.5 * Math.cos((stnF.ll[1] * Math.PI) / 180)) / W10)));
      } catch (e) {}
      // 지도가 막 생기거나(첫 맞춤) 전체 지도로 커지는 동안 다른 맞춤이 끼어들어도 이 시간 안에는 역 자리로 되돌린다(아래 moveend 지킴이)
      stnF.until = Date.now() + (reduceMotion() ? 2500 : 3500);
      map.flyTo({ center: stnF.ll, zoom: stnF.z, duration: reduceMotion() ? 0 : 900, essential: true });
      stnDraw();
      if (snEl) snEl.hidden = true;
      clearTimeout(snGo); snGo = setTimeout(stnNote, reduceMotion() ? 60 : 1000);
    }
    function flyTo(lng, lat, zoom, name) {
      lng = +lng; lat = +lat;
      if (!isFinite(lng) || !isFinite(lat)) return false;
      if (lng < 90 && lat > 90) { const t = lng; lng = lat; lat = t; }   // [lat,lng]로 넘겨도 받아 준다
      stnF = { ll: [lng, lat], z: isFinite(+zoom) && +zoom > 0 ? +zoom : 14.5, n: name || "", until: Date.now() + 8000 };
      stnPend = true;
      // 아직 지도가 없으면(간단 지도 → 실제 지도, 첫 로딩) 만들고, 준비되면 이어서 옮긴다
      if (!want || failed) return false;
      if (!map) { if (mapView === "seoul" || !mapView) { try { seoul(); } catch (e) {} } return true; }
      stnGo();
      // 전체 지도가 열리며 크기가 바뀌는 동안(60·300·800ms) 다른 맞춤이 끼어들어도 마지막에 한 번 더 제자리로
      [350, 950].forEach((t) => setTimeout(() => { if (!stnF || !map) return; map.resize(); const c = map.getCenter(); if (Math.hypot((c.lng - stnF.ll[0]) * 88, (c.lat - stnF.ll[1]) * 111) > 0.25 && !map.isMoving()) map.jumpTo({ center: stnF.ll, zoom: Math.max(map.getZoom(), stnF.z - 0.3) }); }, t + (reduceMotion() ? 0 : 900)));
      return true;
    }
    function stnFind(q) {
      if (Array.isArray(q)) return q.length >= 3 && isFinite(q[1]) ? q : null;
      const b = String(q || "").replace(/\s/g, "").replace(/역$/, "");
      if (!b) return null;
      const L = (D.stations || []).filter((s) => isFinite(s[1]) && isFinite(s[2]));
      return L.find((s) => s[0].replace(/역$/, "") === b) || L.find((s) => s[0].replace(/역$/, "").startsWith(b)) || null;
    }
    // 역 주변에 구역이 없으면 말없이 빈 지도만 보이지 않게: '500m 안 0곳 · 1km 안 3곳 [보기]'
    let snEl = null, snTm = 0, snGo = 0;
    function stnNote() {
      if (snEl) { snEl.hidden = true; clearTimeout(snTm); }
      if (!stnF || !map || !geo) return;
      // 검색 '○○역 걸어서 15분 안 · N곳'과 같은 함수(ZF.walkNear)·같은 문구(ZF.walkLbl)
      const ll = stnF.ll, D2 = ZF.walkNear(ll, stnF.n, Infinity);
      const n5 = D2.filter((x) => x[1] <= W10).length, n10 = D2.filter((x) => x[1] <= W15).length;
      if (n5 || !D2.length) return;
      const near = D2[0];
      const msg = n10 ? `${ZF.walkLbl(stnF.n, n10)} · 10분 안은 없어요` : `걸어서 15분 안 구역 없음 · 가장 가까운 곳 ${(near[1] / 1000).toFixed(1)}km`;
      if (!snEl) {
        snEl = document.createElement("div"); snEl.className = "lm-snote"; snEl.setAttribute("role", "status");
        snEl.innerHTML = `<span></span><button type="button"></button>`;
        $("lmap").appendChild(snEl);
      }
      snEl.querySelector("span").textContent = msg; snEl.dataset.walk = String(n10);
      const bt = snEl.querySelector("button");
      bt.textContent = "보기";
      bt.onclick = () => {
        snEl.hidden = true; if (stnF) stnF.until = 0;
        const d = Math.max(W15 + 60, near[1] + 150), dy = d / 111000, dx = d / 88200;
        if (n10) map.fitBounds([[ll[0] - dx, ll[1] - dy], [ll[0] + dx, ll[1] + dy]], { padding: 20, duration: reduceMotion() ? 0 : 500 });
        else map.fitBounds([[Math.min(ll[0], llOf(near[0])[0]) - 0.004, Math.min(ll[1], llOf(near[0])[1]) - 0.004], [Math.max(ll[0], llOf(near[0])[0]) + 0.004, Math.max(ll[1], llOf(near[0])[1]) + 0.004]], { padding: 40, duration: reduceMotion() ? 0 : 500 });
      };
      // '목록 보기'·확대 버튼 위, 가운데
      try { const cv = map.getCanvas().getBoundingClientRect(), fx = document.querySelector(".s-fullx"), fb = fx && fx.offsetWidth ? fx.getBoundingClientRect() : null; let bo = fb && fb.top < cv.bottom && fb.bottom > cv.top ? Math.round(cv.bottom - fb.top + 10) : 16; const zm = $("lmap").querySelector(".lm-zoom"); if (zm && zm.offsetWidth && cv.width < 560) { const zb = zm.getBoundingClientRect(); bo = Math.max(bo, Math.round(cv.bottom - zb.top + 10)); } snEl.style.bottom = bo + "px"; } catch (e) {}
      snEl.hidden = false;
      snTm = setTimeout(() => { if (snEl) snEl.hidden = true; }, 7000);
    }
    function flyToStation(q, zoom) {
      const s = stnFind(q);
      if (!s) return false;
      return flyTo(s[2], s[1], zoom, s[0]);
    }
    function clearStation() { if (snEl) snEl.hidden = true; if (!stnF) return; stnF = null; stnPend = false; stnDraw(); }
    // ===================== 목록 ↔ 지도 마우스 연결(데스크톱) =====================
    let hovId = null;
    function hovDraw() {
      if (!map || !ready || !map.getSource("hov")) return;
      const r = hovId && byId[hovId], z = r && geo && geo.z[r.id];
      const c = r && llOf(r);
      map.getSource("hov").setData(!r || !c ? FC([]) : FC([].concat(z ? [{ type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: {} }] : [], [{ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: { n: fullName(r) } }])));
    }
    function hover(id) { id = id || null; if (id === hovId) return; hovId = id; hovDraw(); }
    // 지도 위 구역에 마우스 → 목록 줄에 .lm-hov
    let rowHov = null;
    function rowMark(id) {
      const el = id ? document.querySelector(`#sList [data-id="${CSS.escape(id)}"]`) : null, li = el && (el.closest("li") || el);
      if (li === rowHov) return;
      if (rowHov) rowHov.classList.remove("lm-hov");
      rowHov = li || null;
      if (rowHov) rowHov.classList.add("lm-hov");
    }
    function guDraw() {
      if (!map || !ready || !map.getSource("gusel")) return;
      const g = gu && geo && geo.gu.find((x) => x.n === gu);
      const outer = [[124, 32], [132, 32], [132, 40], [124, 40], [124, 32]];
      map.getSource("gusel").setData(g ? { type: "Feature", geometry: { type: "MultiLineString", coordinates: g.r }, properties: {} } : FC([]));
      map.getSource("gudim").setData(g ? { type: "Feature", geometry: { type: "Polygon", coordinates: [outer, ...g.r] }, properties: {} } : FC([]));
    }
    function fitGu(n) {
      if (!map || !geo) return;
      const g = geo.gu.find((x) => x.n === n);
      guDraw();
      if (!g) return;
      // 폰: 레일은 오른쪽 위 한 모서리뿐 → 오른쪽 전체를 비우지 않는다(구가 작게 보이던 문제). 위 게이지·아래 '목록 보기'만 피한다
      const P = fitPad(true), mob = MQ_SHEET.matches;
      map.fitBounds(bboxOf(g.r), { padding: { top: P.top + (mob ? 6 : 18), bottom: P.bottom + (mob ? 6 : 18), left: mob ? 16 : 30, right: mob ? 16 : Math.max(30, railPad()) }, maxZoom: 14.5, duration: reduceMotion() ? 0 : 500 });
    }
    function legend() {
      const el = $("lmLegend");
      if (!el) return;
      // 상태 4가지를 말로(색만으로 가르지 않음): 지도와 같은 꼴의 작은 알약·점 + 이름
      const note = { old: "노후도 = 경계 안 건축물 중 사용승인 후 30년(철근콘크리트)·20년(그 외) 지난 비율 · 서울도시공간포털 건물 레이어(사용승인 2022년까지 반영)로 직접 계산 · 이주·철거 이후 구역과 연도 확인 건물이 적은 곳은 빼요", vol: "최근 12개월 구역 안 연립·다세대 매매 건수(단독·아파트 제외, 서울시 실거래)", yoy: "대지지분 3.3㎡당 매매가 가운데 값, 최근 12개월 vs 그 전 12개월 · 두 기간 5건 이상" }[colorBy];
      const ex = { ok: "7,300만", near: "+2,000만" };
      el.innerHTML = `<b class="lm-lgt">지금 필요한 돈 · 내 돈 기준</b>`
        + `<span><i class="lg-pill zpill st-ok"><span class="zp-in"><b class="zp-v">${ex.ok}</b></span></i>가능 · 내 돈으로 돼요</span>`
        + `<span><i class="lg-pill zpill st-near"><span class="zp-in"><b class="zp-v">${ex.near}</b></span></i>조금 모자람 · 모자란 돈</span>`
        + `<span><i class="lg-dot far"></i>멀다 · 20% 넘게 더 필요</span>`
        + `<span><i class="lg-dot na"></i>정보 부족 · 계산할 자료 없음</span>`
        + `<span><i class="lg-heart" aria-hidden="true">${HEART_S}</i>관심 구역 · 굵은 테두리</span>`
        + `<span><i class="lg-gu"></i>서울 보기(줌 11 이하) · 구 묶음</span>`
        + `<span class="lm-est"><i></i>점선 = 공식 경계 없음(면적 기준 추정 범위)</span>${note ? `<small class="lm-note">${esc(note)}</small>` : ""}`;
    }
    // 레이어 범례·'확대하면 보여요' 안내: 오른쪽 위 레일 바로 아래에 작은 글자로
    // 학교·병원(OpenFreeMap POI)은 타일 줌 14부터만 들어 있다 → 레이어도 14부터, 안내도 14 기준
    const LMINZ = { edu: POIZ, med: POIZ };
    const NUMK = ["", "한 번", "두 번", "세 번", "네 번"];
    function notes() {
      if (!map) return;
      const short = $("mapbox") && $("mapbox").classList.contains("lm-short");
      const host = (!short && $("mapbox") && $("mapbox").querySelector(".s-rail-w")) || $("lmap");
      let el = $("lmNotes");
      if (!el) { el = document.createElement("div"); el.id = "lmNotes"; el.className = "lm-notes"; el.setAttribute("aria-live", "polite"); }
      if (el.parentNode !== host) host.appendChild(el);
      const on = !$("lmap").hidden, z = map.getZoom(), H = [];
      // 확대 버튼 한 번 = 줌 +1. 몇 번 더 눌러야 보이는지 알려 준다(보이기 시작하면 안내는 사라짐)
      const G = {};
      Object.keys(LMINZ).forEach((k) => { if (!lyr.has(k) || z >= LMINZ[k] - 0.001) return; const n = Math.ceil(LMINZ[k] - z - 0.001); (G[n] = G[n] || []).push({ edu: "학교", med: "병원" }[k]); });
      Object.keys(G).sort((a, b) => a - b).forEach((n) => {
        const far = G[n], last = far[far.length - 1];
        H.push(`<p class="lm-n-hint"><svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 10.5 14 14M7 5v4M5 7h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${far.join("·")}${(last.charCodeAt(last.length - 1) - 0xac00) % 28 ? "은" : "는"} ${NUMK[n] ? NUMK[n] + " 더 " : "더 "}확대하면 보여요</p>`);
      });
      if (lyr.has("hj")) H.push(`<p><i class="lm-n-hj"></i>새 역·개발 예정지<small>테두리 색 = 노선</small></p>`);
      [["edu", "학교", "초·중·고"], ["med", "병원", "종합·대형"], ["mart", "대형마트", ""]].forEach(([k, t, sub]) => { if (lyr.has(k)) H.push(`<p><img class="lm-n-ic" src="${poiUrl(k)}" alt="" width="14" height="14">${t}${sub ? `<small>${sub}</small>` : ""}</p>`); });
      if (lyr.has("acad")) H.push(`<p><i class="lm-n-acad"></i>학원가<small>원 크기 = 학원 수</small></p>`);
      if (lyr.has("biz")) H.push(z < 13 ? `<p><i class="lm-n-biz lm-n-heat"></i>상권<small>진할수록 점포 많음</small></p>` : `<p><i class="lm-n-biz"></i>상권<small>원 크기 = 점포 수</small></p>`);
      if (lyr.has("hi")) H.push(`<p><i class="lm-n-hi"></i>신고가<small>최근 3개월</small></p>`);
      const html = H.join("");
      if (el._h !== html) { el._h = html; el.innerHTML = html; edgeSoon(); }
      el.hidden = !on || !H.length;
    }
    // 구역 카드는 화면 가장자리·떠 있는 버튼(레일·확대 버튼·목록 보기) 밑에서는 그리지 않는다 → 잘리거나 가려진 카드 없음
    let edgeT = 0;
    function edgeFilter() {
      if (!map || !ready || !map.getLayer("zone-lab")) return;
      try {
        const cv = map.getCanvas(), W = cv.clientWidth, H = cv.clientHeight, cb = cv.getBoundingClientRect();
        if (W < 50 || H < 50) return;
        let top = 4;
        const holes = [];
        document.querySelectorAll("#mapbox .s-rail, #lmap .lm-zoom, .s-mini, .s-fullx, #lmNotes, #lmAucLg").forEach((e) => {
          if (!e.offsetWidth || e.hidden) return;
          const b = e.getBoundingClientRect();
          if (b.bottom <= cb.top || b.top >= cb.bottom || b.right <= cb.left || b.left >= cb.right) return;
          const r = [b.left - cb.left, b.top - cb.top, b.right - cb.left, b.bottom - cb.top];
          if (r[2] - r[0] > W * 0.6 && r[1] <= 40) { top = Math.max(top, r[3] + 2); return; }
          holes.push([r[0] - 46, r[1] - 42, r[2] + 46, r[3] + 2]);
        });
        const O = [34, top, W - 34, H - 40];
        // 겹치는 구멍은 하나로 합친다(짝홀 규칙이 꼬이지 않게)
        for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) {
          const a = holes[i], b = holes[j];
          if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) { holes[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; holes.splice(j, 1); i = -1; break; }
        }
        const ring = (x0, y0, x1, y1) => { const u = (x, y) => { const l = map.unproject([x, y]); return [l.lng, l.lat]; }; return [u(x0, y0), u(x0, y1), u(x1, y1), u(x1, y0), u(x0, y0)]; };
        const cl = (h) => [Math.max(h[0], O[0] + 1), Math.max(h[1], O[1] + 1), Math.min(h[2], O[2] - 1), Math.min(h[3], O[3] - 1)];
        const rings = [ring(...O)].concat(holes.map(cl).filter((h) => h[2] > h[0] && h[3] > h[1]).map((h) => ring(...h)));
        const poly = { type: "Polygon", coordinates: rings };
        map.setFilter("zone-lab", ["all", ["==", ["get", "p"], 0], ["within", poly]]);
        map.setFilter("zone-lab-p", ["all", ["==", ["get", "p"], 1], ["within", poly]]);
        // 구 이름도 가장자리에서 반쯤 잘려 보이지 않게(예: 왼쪽 끝 '강서구'), 레일·확대 버튼 밑에서는 빼기
        if (map.getLayer("gu-lab")) map.setFilter("gu-lab", ["within", poly]);
      } catch (e) {}
    }
    const edgeSoon = () => { clearTimeout(edgeT); edgeT = setTimeout(edgeFilter, 60); };
    function ui() {
      const box = $("mapbox");
      if (!box || $("lmap")) return;
      const d = document.createElement("div");
      d.id = "lmap"; d.className = "lmap"; d.hidden = true;
      d.innerHTML = `<div class="lm-ctl" role="group" aria-label="지도 보기"><label class="lm-sel"><span>카드 값</span><select id="lmColor" aria-label="구역 카드에 보일 값">${MODES.map(([k, t]) => `<option value="${k}"${colorBy === k ? " selected" : ""}>${t}</option>`).join("")}</select></label><button type="button" class="lm-ly" aria-expanded="false" aria-controls="lmLayers" aria-label="겹쳐 보기(학교·학원·상권 등)" title="겹쳐 보기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 13 10 5 10-5"/></svg>${lyr.size ? ` <b>${lyr.size}</b>` : ""}</button><button type="button" class="lm-lg" aria-expanded="false" aria-controls="lmLegend">범례</button></div><div class="lm-layers" id="lmLayers" hidden><p>겹쳐 보기</p>${LAYERS.map(([k, t, sub]) => `<label><input type="checkbox" value="${k}"${lyr.has(k) ? " checked" : ""}><span>${t}<small>${sub}</small></span></label>`).join("")}<p class="lm-ln">상권·학원가: 서울시 상권분석서비스 <span id="lmSangQ"></span> 점포 수·추정매출. 학교·병원·마트: OpenStreetMap 기준이라 빠진 곳이 있을 수 있어요.</p></div><div class="lm-legend" id="lmLegend" hidden></div>`;
      d.querySelector(".lm-lg").onclick = (e) => { const lg = $("lmLegend"), on = lg.hidden; lg.hidden = !on; e.currentTarget.setAttribute("aria-expanded", String(on)); if (on) { $("lmLayers").hidden = true; d.querySelector(".lm-ly").setAttribute("aria-expanded", "false"); } };
      const zm = document.createElement("div");
      zm.className = "lm-zoom"; zm.setAttribute("role", "group"); zm.setAttribute("aria-label", "지도 확대·축소");
      // ⤢ 크게 보기(PC): 지도를 화면 가득. 폰은 아래 탭 '지도'가 같은 일을 한다
      zm.innerHTML = `<button type="button" data-z="full" class="lm-fs" aria-label="지도 크게 보기" aria-pressed="false" title="지도 크게 보기"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" data-z="1" aria-label="확대"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button><button type="button" data-z="-1" aria-label="축소"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button>`;
      zm.addEventListener("click", (e) => { const b = e.target.closest("button[data-z]"); if (!b) return; if (b.dataset.z === "full") { try { SIMPLE.fullMap(); } catch (er) {} return; } if (!map) return; const o = { duration: reduceMotion() ? 0 : 250 }; if (+b.dataset.z > 0) map.zoomIn(o); else map.zoomOut(o); });
      d.appendChild(zm);
      box.appendChild(d);
      d.querySelector("#lmColor").addEventListener("change", (e) => {
        colorBy = e.target.value; store.set("emr.mapc", colorBy);
        paint();
      });
      d.querySelector(".lm-ly").onclick = (e) => {
        const p = $("lmLayers"), on = p.hidden, c = d.querySelector(".lm-ctl");
        p.style.top = c.offsetTop + c.offsetHeight + 6 + "px";
        p.hidden = !on; e.currentTarget.setAttribute("aria-expanded", String(on));
        if (on) { $("lmLegend").hidden = true; d.querySelector(".lm-lg").setAttribute("aria-expanded", "false"); }
      };
      $("lmLayers").addEventListener("change", (e) => {
        const c = e.target.closest("input[type=checkbox]"); if (!c) return;
        if (c.checked) lyr.add(c.value); else lyr.delete(c.value);
        store.set("emr.lyr", JSON.stringify([...lyr]));
        d.querySelector(".lm-ly").innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 13 10 5 10-5"/></svg>${lyr.size ? ` <b>${lyr.size}</b>` : ""}`;
        layerData();
        layers();
        if (c.value === "hi") paint();
        notes();
      });
      const bar = $("mapBar");
      if (bar && !$("mapKind")) {
        const t = document.createElement("div");
        t.className = "seg sm map-kind"; t.id = "mapKind"; t.setAttribute("role", "group"); t.setAttribute("aria-label", "지도 종류");
        t.innerHTML = `<button type="button" data-m="real" aria-pressed="${want}">실제 지도</button><button type="button" data-m="svg" aria-pressed="${!want}">간단 지도</button>`;
        bar.appendChild(t);
        t.addEventListener("click", (e) => { const b = e.target.closest("button[data-m]"); if (!b) return; use(b.dataset.m === "real", true); });
      }
    }
    function init() {
      if (map) return true;
      try {
        map = new maplibregl.Map({
          container: "lmap", style: style(), bounds: SEOUL_BB, fitBoundsOptions: { padding: 12 },
          minZoom: 8.8, maxZoom: 17.6, maxBounds: [[126.2, 37.05], [127.75, 38.05]], attributionControl: false,
          localIdeographFontFamily: "'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif",
          cooperativeGestures: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
          locale: { "CooperativeGesturesHandler.WindowsHelpText": "Ctrl 키를 누른 채 스크롤하면 확대·축소돼요", "CooperativeGesturesHandler.MacHelpText": "⌘ 키를 누른 채 스크롤하면 확대·축소돼요", "CooperativeGesturesHandler.MobileHelpText": "두 손가락으로 지도를 움직여 보세요", "AttributionControl.ToggleAttribution": "지도 출처", "AttributionControl.MapFeedback": "지도 고치기 제안" },
        });
      } catch (e) { map = null; failed = true; return false; }
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '정비구역 경계 <a href="https://urban.seoul.go.kr" target="_blank" rel="noopener">서울도시공간포털</a>' }), "bottom-right");
      map.on("style.load", () => { ready = false; loadGeo().then(overlays); });
      map.on("moveend", edgeSoon);
      map.on("moveend", rlabSoon); map.on("resize", rlabSoon);
      // 목록 '이 지도 범위만'(60_simple.js)이 지도를 옮길 때마다 따라오게: 보이는 범위·줌을 알린다
      // user = 사람이 끌거나·휠·두 손가락·확대 버튼으로 옮긴 이동(자동 맞춤·역 비행은 아님) → 목록이 저절로 '지도 범위만'
      let userMv = false;
      map.on("movestart", (e) => { if (e && e.originalEvent) userMv = true; });
      $("lmap").addEventListener("click", (e) => { if (e.target.closest && e.target.closest(".lm-zoom button[data-z]:not([data-z=full])")) userMv = true; }, true);
      map.on("moveend", (e) => { const u = userMv || !!(e && e.originalEvent); if (!map.isMoving()) userMv = false; try { if (!ready || $("lmap").hidden) return; const b = map.getBounds(); dispatchEvent(new CustomEvent("zp:mapmove", { detail: { bb: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], z: map.getZoom(), user: u } })); } catch (er) {} });
      // 사용자가 역에서 2km 넘게 밀거나 크게 빼면 역 표시(어둡게 덮기·고리)를 푼다
      // 역 지킴이: 역을 고른 직후(stnF.until 전) 사람이 옮긴 게 아닌 이동(첫 맞춤·크기 바뀜 뒤 맞춤)이 역에서 벗어나 끝나면 제자리로
      map.on("moveend", (e) => {
        if (!stnF || (e && e.originalEvent) || !stnF.until || Date.now() > stnF.until || map.isMoving()) return;
        const c = map.getCenter();
        if (Math.hypot((c.lng - stnF.ll[0]) * 88, (c.lat - stnF.ll[1]) * 111) > 0.12 || map.getZoom() < stnF.z - 0.3) map.jumpTo({ center: stnF.ll, zoom: stnF.z });
      });
      map.on("moveend", (e) => { if (!stnF || !e || !e.originalEvent) return; const c = map.getCenter(); if (map.getZoom() < 12 || Math.hypot((c.lng - stnF.ll[0]) * 88, (c.lat - stnF.ll[1]) * 111) > 2) clearStation(); }); map.on("resize", () => { shortMark(); edgeSoon(); });
      let nRaf = 0;
      map.on("zoom", () => { if (!nRaf) nRaf = requestAnimationFrame(() => { nRaf = 0; notes(); }); });
      // 출처는 접힌 'i' 단추로만(라이브러리가 로딩 중 저절로 펼쳤다 접으면 자리가 흔들림 = CLS). 사람이 누를 때만 펼친다
      {
        const at = $("lmap").querySelector(".maplibregl-ctrl-attrib");
        if (at) {
          let userT = 0;
          const fold = () => { if (Date.now() - userT < 800) return; if (at.classList.contains("maplibregl-compact-show")) at.classList.remove("maplibregl-compact-show"); if (at.hasAttribute("open")) at.removeAttribute("open"); };
          ["pointerdown", "keydown", "click"].forEach((t) => at.addEventListener(t, () => { userT = Date.now(); }, true));
          try { new MutationObserver(fold).observe(at, { attributes: true, attributeFilter: ["class", "open"] }); } catch (e) {}
          fold();
        }
      }
      // PC 첫 화면: 지도 아래쪽이 창 밖이면 보이는 부분에 서울을 맞춰 두었다 → 스크롤해 지도가 더 보이면(사용자가 지도를 직접 옮기기 전까지) 보이는 칸에 다시 맞춘다(위에 몰리고 아래가 비지 않게)
      { let auto = true, lastK = null, scT = 0;
        map.on("movestart", (e) => { if (e && e.originalEvent) auto = false; });
        addEventListener("scroll", () => {
          if (!auto || !map || !ready || MQ_SHEET.matches || mapView !== "seoul" || gu || stnF) return;
          clearTimeout(scT);
          scT = setTimeout(() => { try { const cv = map.getCanvas().getBoundingClientRect(), k = Math.round(Math.max(0, cv.bottom - innerHeight) / 60); if (k === lastK) return; lastK = k; fitAff(true); } catch (er) {} }, 140);
        }, { passive: true });
      }
      map.on("error", (e) => {
        const m = String((e && e.error && e.error.message) || "");
        if (/openfreemap|Failed to fetch|NetworkError/.test(m) && !$("lmap").querySelector(".lm-err")) {
          const n = document.createElement("div");
          n.className = "lm-err";
          n.innerHTML = '지도 바탕을 불러오지 못했어요. <button type="button" class="btn secondary sm">간단 지도로 보기</button>';
          n.querySelector("button").onclick = () => use(false, true);
          $("lmap").appendChild(n);
        }
      });
      const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "lm-pop", offset: 10, maxWidth: "260px" });
      const hit = ["zone-fill", "zest-fill", "pts"];
      const tipOf = (r) => `<b>${esc(fullName(r))}</b><small>${esc([SHAPE[shapeOf(r)], r.src === "moa" ? srLabel(r) : stageName(r)].join(" · "))}</small><small>${esc(labelOf(r))}${geo && geo.z[r.id] && geo.z[r.id].e ? " · 경계 추정" : ""}</small>`;
      hit.forEach((l) => {
        map.on("mousemove", l, (e) => { const r = byId[e.features[0].properties.id]; if (!r) return; map.getCanvas().style.cursor = "pointer"; pop.setLngLat(e.lngLat).setHTML(tipOf(r)).addTo(map); rowMark(r.id); });
        map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; pop.remove(); rowMark(null); });
      });
      let lastPT = "touch";
      map.getCanvasContainer().addEventListener("pointerdown", (e) => { lastPT = e.pointerType || "mouse"; }, true);
      map.on("click", (e) => {
        // 알약·구 묶음·고른 구역 카드(DOM)를 누른 것은 그쪽이 처리한다
        const ot = e.originalEvent && e.originalEvent.target;
        if (ot && ot.closest && ot.closest(".zpill,.zgu,.lm-pick")) return;
        const ls = ["zdot", "zone-lab", "zone-lab-p"].concat(hit).filter((l) => map.getLayer(l));
        let fs = map.queryRenderedFeatures(e.point, { layers: ls });
        // 손가락은 넓게: 정확히 안 맞으면 둘레 12px(마우스 5px) 안에서 가장 가까운 구역
        if (!fs.length) {
          const t = lastPT === "mouse" ? 5 : 12, p = e.point;
          const near = map.queryRenderedFeatures([[p.x - t, p.y - t], [p.x + t, p.y + t]], { layers: ls });
          if (near.length) {
            const d = (f) => { try { const c = f.geometry.type === "Point" ? f.geometry.coordinates : null; if (c) { const q = map.project(c); return Math.hypot(q.x - p.x, q.y - p.y); } } catch (er) {} return t; };
            fs = near.sort((a, b) => d(a) - d(b));
          }
        }
        if (!fs.length) { pickClear(); return; }
        // 겹치면 작은(구체적인) 구역 우선
        const area = (f) => { const z = geo && geo.z[f.properties.id]; return z ? z.a || 1e9 : 1e9; };
        const f = fs.find((x) => /^(zdot|zone-lab(-p)?)$/.test(x.layer.id)) || fs.slice().sort((a, b) => (a.layer.id === "zest-fill") - (b.layer.id === "zest-fill") || area(a) - area(b))[0];
        const id = f.properties.id;
        if (!byId[id]) return;
        pop.remove(); pickClear();
        curTab = "money";
        const rt = $("report").getBoundingClientRect().top;
        select(id, false, false, { scroll: !MQ_SHEET.matches && (rt < HDR() - 4 || rt > innerHeight * 0.5) });
      });
      try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", restyle); } catch (e) {}
      try { new MutationObserver(restyle).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) {}
      try { map.getCanvas().setAttribute("aria-label", "정비구역 경계 지도. 키보드로는 옆의 구역 목록을 쓰세요"); } catch (e) {}
      return true;
    }
    // 키 작은 지도(폰 홈 지도): 레일 3열×2줄, 확대·축소는 가로 → 서로 겹치지 않게
    function shortMark() {
      const b = $("mapbox"); if (!b) return;
      const fs = document.documentElement.classList.contains("s-full"), sh = !fs && b.clientHeight > 0 && b.clientHeight < 400;
      if (sh !== b.classList.contains("lm-short")) { b.classList.toggle("lm-short", sh); if (map) notes(); }
      const f = $("lmap") && $("lmap").querySelector(".lm-fs");
      if (f) { f.setAttribute("aria-pressed", String(fs)); f.setAttribute("aria-label", fs ? "지도 작게 보기" : "지도 크게 보기"); f.title = f.getAttribute("aria-label"); }
    }
    function restyle() { if (map) { ready = false; map.setStyle(style(), { diff: false }); } }
    function show(on) {
      const el = $("lmap");
      if (!el) return;
      el.hidden = !on;
      $("mapbox").classList.toggle("lm-on", on);
      shortMark();
      const bar = $("mapBar");
      if (on && bar && getComputedStyle(bar).position !== "absolute") $("mapbox").style.setProperty("--lm-top", bar.offsetHeight + "px");
      else $("mapbox").style.removeProperty("--lm-top");
      if (on && map) requestAnimationFrame(() => { map.resize(); notes(); edgeSoon(); });
      else if (!on && $("lmNotes")) $("lmNotes").hidden = true;
    }
    function enter(n) {
      gu = n;
      ui();
      if (!want || failed) return show(false);
      show(true);
      Promise.all([loadLib(), loadGeo()])
        .then(() => {
          if (mapView !== "gu" || !want) return;
          if (!init()) { show(false); return; }
          map.resize();
          if (cur && cur.g === n && geo && (geo.z[cur.id] || cur.ll)) { if (ready) focus(true); else pendFocus = true; }
          else fitGu(n);
          if (ready) paint();
        })
        .catch(() => { failed = true; show(false); });
    }
    function exit() { gu = null; guDraw(); if (document.documentElement.classList.contains("simple")) seoul(); else show(false); }
    function use(on, user) {
      want = on;
      if (user) store.set("emr.map", on ? "real" : "svg");
      document.querySelectorAll("#mapKind button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.m === "real") === on)));
      if (mapView === "gu" && mapGu) { if (on) enter(mapGu); else show(false); }
    }
    return {
      enter, exit, use, seoul,
      on: () => !!(map && $("lmap") && !$("lmap").hidden),
      paint: () => { if (map && ready) paint(); },
      states: () => states(),   // 금액·방식·유형이 바뀌면(끄는 중에도) — 다음 프레임에 한 번: 상태 4가지·알약·점·구 묶음
      counts: () => states(),
      pins: () => states(),     // 관심 구역이 바뀌면 불러 주세요(하트·굵은 테두리)
      pills: () => [...PILLS.entries()].map(([id, p]) => ({ id, st: (ZS.get(id) || {}).st, need: (ZS.get(id) || {}).need, t: (p.el.querySelector(".zp-v") || {}).textContent || "", lab: p.el.getAttribute("aria-label") || "", fav: p.el.classList.contains("fav"), sel: p.el.classList.contains("sel") })),
      gus: () => [...GUS.entries()].map(([n, p]) => ({ n, c: +p.el.dataset.n, t: p.el.textContent, lab: p.el.getAttribute("aria-label") || "" })),
      pick: (id) => (id ? pillTap(id) : pickClear()),
      focus: (zoom) => { if (map && ready && !$("lmap").hidden) focus(zoom); },
      noLoc: () => noLoc(),
      zoom: (k) => { if (!map) return; if (k > 0) map.zoomIn(); else if (k < 0) map.zoomOut(); else { clearStation(); if (gu) fitGu(gu); else fitAff(true, true); } },
      geo: () => loadGeo(),
      fitAff: (anim) => fitAff(anim),
      fit: () => { shortMark(); if (!map) return; map.resize(); if (!cur) fitAff(false); },   // 고른 구역이 있으면 보던 자리 그대로
      lib: () => loadLib(), style: () => style(), subway: () => subwayGeo(),
      map: () => map,
      // 역·좌표로 지도 옮기기(검색에서 역을 고를 때). 끼워 둔 지도·전체 지도 모두, 지도가 아직 준비 전이면 준비되면 이어서 옮긴다.
      // flyToStation('봉천' | '봉천역' | D.stations 한 줄[이름,lat,lng,…], zoom?=14.5) → true/false(역 못 찾음·간단 지도)
      // flyTo(lng, lat, zoom?=14.5, 이름?) · clearStation() · station() = 지금 보는 역 {ll,z,n} 또는 null
      flyToStation: (q, z) => flyToStation(q, z),
      flyTo: (lng, lat, z, n) => flyTo(lng, lat, z, n),
      clearStation: () => clearStation(),
      station: () => (stnF ? { ll: stnF.ll.slice(), z: stnF.z, n: stnF.n } : null),
      hover: (id) => hover(id),
    };
  })();
  window.ZP_lmx = window.__lmx = LMX;
  // 데스크톱: 목록 줄에 마우스를 올리면 지도에서 그 구역 테두리를 노랗게(목록 코드는 그대로, 이벤트 위임)
  {
    let hv = null;
    const fine = () => matchMedia("(hover:hover) and (pointer:fine)").matches;
    document.addEventListener("mouseover", (e) => { if (!fine()) return; const a = e.target.closest && e.target.closest("#sList [data-id]"), li = e.target.closest && e.target.closest("#sList li"); const id = a ? a.dataset.id : li && li.querySelector("[data-id]") ? li.querySelector("[data-id]").dataset.id : null; if (id === hv) return; hv = id; try { LMX.hover(id); } catch (er) {} });
    document.addEventListener("mouseout", (e) => { if (!hv || !e.target.closest || !e.target.closest("#sList")) return; const to = e.relatedTarget; if (to && to.closest && to.closest("#sList li")) return; hv = null; try { LMX.hover(null); } catch (er) {} });
  }   // 점검(QA)·다른 화면에서 지도 상태를 읽을 때
  // 데스크톱: 목록·검색에서 구역을 고르면 실제 지도가 그 구역으로 가서 굵은 테두리로 보여 준다
  {
    const _selL = select;
    select = function (id) {
      const x = _selL.apply(this, arguments);
      try { if (!MQ_SHEET.matches && cur && cur.id === id && LMX.on()) setTimeout(() => LMX.focus("soft"), 30); } catch (e) {}
      // 데스크톱: 상세로 스크롤한 뒤 지도 칸이 머리 밑으로 밀려 올라가면(붙는 칸의 끝) 머리+8 자리까지 되돌린다
      try {
        if (!MQ_SHEET.matches) {
          const fix = () => { const mc = document.querySelector("#mapTop .main>.mapcard"); if (!mc || document.documentElement.classList.contains("s-full") || !document.documentElement.classList.contains("s-rep") || cur !== sel0) return; const t = mc.getBoundingClientRect().top, want = (HDR() || 56) + 8; if (t < want - 2 && t > want - 400) window.scrollBy({ top: t - want, behavior: "auto" }); };
          const sel0 = cur;   // 상세를 닫았거나(Esc·목록 버튼 → 보던 자리로 되돌림) 다른 구역을 열었으면 손대지 않는다
          [450, 1000].forEach((t) => setTimeout(fix, t));
        }
      } catch (e) {}
      return x;
    };
  }
