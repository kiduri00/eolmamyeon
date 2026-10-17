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
    let lyr = (() => { try { return new Set(JSON.parse(store.get("emr.lyr", '[]'))); } catch (e) { return new Set(); } })();
    const RAMP = ["#C9D2E3", "#9EB0D3", "#6F89C0", "#3F5FA3", "#1F3A87"];
    const RAMP_D = ["#2B3546", "#33507E", "#4A6DAA", "#7392D0", "#A9C0EE"];
    const BINS = { old: [[40, "40% 미만"], [60, "40~60%"], [67, "60~67%"], [80, "67~80%"], [101, "80% 이상"]], vol: [[1, "0건"], [5, "1~4건"], [15, "5~14건"], [40, "15~39건"], [1e9, "40건 이상"]], yoy: [[-10, "−10% 미만"], [0, "−10~0%"], [10, "0~+10%"], [25, "+10~25%"], [1e9, "+25% 이상"]] };
    const metric = (r) => { const t = r.tx || {}; if (colorBy === "old") return t.old && r.s < 7 ? t.old.pol : null; if (colorBy === "vol") return t.n12 != null ? t.n12 : r.tx ? 0 : null; if (colorBy === "yoy") return t.yoy != null && t.yon && t.yon[0] >= 10 && t.yon[1] >= 10 ? t.yoy : null; return null; };
    const binOf = (v) => BINS[colorBy].findIndex(([hi]) => v < hi);
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
    const KIND_COL = () => ({ rd: probe("var(--k-rd, #2F6FEB)"), rc: probe("var(--k-rc, #C2410C)"), sm: probe("var(--k-sm, #0E7490)"), moa: probe("var(--k-moa, #7C5CDB)") });
    const CASH_LAB = { y: null, n: "현금 부족", u: "계산 보류", e: "구 평균 시세 추정", x: "" };
    function palette() {
      const v = (n, d) => probe(`var(${n}, ${d})`);
      return { y: v("--brand", "#2B59F0"), n: v("--text-3", "#5c6573"), u: v("--text-4", "#8B95A1"), e: v("--acc2", "#8B6FE8"), x: v("--text-4", "#8B95A1"), ink: v("--text-1", "#191F28"), sub: v("--text-3", "#5F6B7A"), surf: v("--surface", "#fff"), line: v("--border", "#E5E8EB"), sel: v("--focus", "#2B59F0") };
    }
    function colorOf(r, P) {
      if (BINS[colorBy]) { const v = metric(r); return v == null ? P.x : (dark() ? RAMP_D : RAMP)[binOf(v)]; }
      if (colorBy === "stage") return P["st" + st6(r)] || (P["st" + st6(r)] = probe(STCOL(st6(r))));
      if (colorBy === "kind") return (P.K || (P.K = KIND_COL()))[shapeOf(r)];
      return P[dotState(r)];
    }
    function style() {
      const dk = dark();
      const C = dk
        ? { bg: "#11161D", park: "#152019", water: "#15283A", wline: "#1E3D55", res: "#141B23", bld: "#1A222C", bldl: "#232D39", mw: "#4A3E22", mwc: "#2E2716", pr: "#2A3441", prc: "#1D242E", mn: "#202833", rail: "#3A4553", txt: "#C3CCD8", txt2: "#8A95A5", halo: "#11161D", wtxt: "#6E9EBF" }
        : { bg: "#F3F4F6", park: "#E1EEDC", water: "#BFD9EC", wline: "#A3C6E0", res: "#EDEFF2", bld: "#E2E5EA", bldl: "#D3D8DF", mw: "#FBE3A6", mwc: "#E0BE6A", pr: "#FFFFFF", prc: "#D3D8E0", mn: "#FFFFFF", rail: "#A6AFBB", txt: "#2F3846", txt2: "#6A7482", halo: "#FFFFFF", wtxt: "#3F7DA6" };
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
          { id: "road-name", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 14.5, filter: ["in", ["get", "class"], ["literal", ["primary", "secondary", "tertiary", "motorway", "trunk"]]], layout: { "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": 11.5, "symbol-placement": "line" }, paint: { "text-color": C.txt2, "text-halo-color": C.halo, "text-halo-width": 1.6 } },
          { id: "place", type: "symbol", source: "omt", "source-layer": "place", minzoom: 12.5, filter: ["in", ["get", "class"], ["literal", ["suburb", "quarter", "neighbourhood"]]], layout: { "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 12.5, 11, 16, 14] }, paint: { "text-color": C.txt2, "text-halo-color": C.halo, "text-halo-width": 1.6 } },
        ],
      };
    }
    const FC = (f) => ({ type: "FeatureCollection", features: f });
    function overlays() {
      if (!map || !geo) return;
      const dk = dark(), P = palette(), halo = dk ? "#11161D" : "#ffffff";
      const add = (id) => { if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: FC([]) }); };
      ["mask", "seoul", "gul", "zones", "zest", "zlab", "pts", "stn", "sel", "hj", "hi", "sang", "subway", "gub"].forEach(add);
      map.getSource("subway").setData(subwayGeo());
      const outer = [[124, 32], [132, 32], [132, 40], [124, 40], [124, 32]];
      map.getSource("mask").setData({ type: "Feature", geometry: { type: "Polygon", coordinates: [outer, ...geo.seoul] }, properties: {} });
      map.getSource("seoul").setData({ type: "Feature", geometry: { type: "MultiLineString", coordinates: geo.seoul }, properties: {} });
      map.getSource("gul").setData(FC(geo.gu.map((g) => ({ type: "Feature", geometry: { type: "MultiLineString", coordinates: g.r }, properties: { n: g.n } }))));
      map.getSource("stn").setData(FC(D.stations.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s[2], s[1]] }, properties: { n: s[0].replace(/역$/, ""), c: LINE_COL[(s[3] || [])[0]] || "#7A8594" } }))));
      const L = (o) => { if (!map.getLayer(o.id)) map.addLayer(o); };
      L({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": dk ? "#0B0F14" : "#ffffff", "fill-opacity": dk ? 0.7 : 0.75 } });
      L({ id: "gu-line", type: "line", source: "gul", paint: { "line-color": dk ? "#3B4656" : "#AEB7C4", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 1.3], "line-dasharray": [2, 2] } });
      L({ id: "seoul-line", type: "line", source: "seoul", paint: { "line-color": P.sub, "line-width": 1.6, "line-opacity": 0.7 } });
      L({ id: "subway-case", type: "line", source: "subway", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": halo, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 7], "line-opacity": 0.9 } });
      L({ id: "subway", type: "line", source: "subway", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.6, 14, 4], "line-opacity": dk ? 0.85 : 0.9 } });
      L({ id: "zest-fill", type: "fill", source: "zest", paint: { "fill-color": ["get", "c"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, ["min", 0.4, ["*", ["get", "o"], 0.22]], 15, ["min", 0.4, ["*", ["get", "o"], 0.1]]] } });
      L({ id: "zest-line", type: "line", source: "zest", paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 15, 1.8], "line-dasharray": [2, 1.6], "line-opacity": ["min", 1, ["*", ["get", "o"], 0.9]] } });
      L({ id: "zone-fill", type: "fill", source: "zones", paint: { "fill-color": ["get", "c"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, ["min", 0.75, ["*", ["get", "o"], 0.5]], 13, ["min", 0.75, ["*", ["get", "o"], 0.36]], 16, ["min", 0.75, ["*", ["get", "o"], 0.24]]] } });
      L({ id: "zone-line", type: "line", source: "zones", paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 13, 1.7, 16, 2.6], "line-opacity": ["min", 1, ["get", "o"]] } });
      L({ id: "pts", type: "circle", source: "pts", paint: { "circle-color": ["get", "c"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.2, 12.5, 5.5], "circle-stroke-color": halo, "circle-stroke-width": 1.2, "circle-opacity": ["min", 1, ["get", "o"]], "circle-stroke-opacity": ["min", 1, ["get", "o"]] } });
      L({ id: "sel-line", type: "line", source: "sel", paint: { "line-color": P.sel, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.6, 16, 4.5] } });
      L({ id: "stn", type: "circle", source: "stn", minzoom: 11.3, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 6], "circle-color": dk ? "#151B23" : "#ffffff", "circle-stroke-color": ["get", "c"], "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 12, 2, 16, 3] } });
      L({ id: "stn-lab", type: "symbol", source: "stn", minzoom: 12.8, layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": P.ink, "text-halo-color": halo, "text-halo-width": 1.8 } });
      // ---- 겹쳐 보기 레이어 ----
      const nm = ["coalesce", ["get", "name:ko"], ["get", "name"], ""];
      const poiTxt = (id, filter, color, minz) => [
        { id: id, type: "circle", source: "omt", "source-layer": "poi", minzoom: minz, filter, layout: { visibility: "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 6], "circle-color": color, "circle-stroke-color": halo, "circle-stroke-width": 1.4 } },
        { id: id + "-lab", type: "symbol", source: "omt", "source-layer": "poi", minzoom: Math.max(minz, 14), filter, layout: { visibility: "none", "text-field": nm, "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 0.9], "text-anchor": "top", "text-optional": true, "text-max-width": 8 }, paint: { "text-color": color, "text-halo-color": halo, "text-halo-width": 1.6 } },
      ];
      const SHOPC = ["shop", "grocery", "restaurant", "cafe", "fast_food", "bar", "beer", "bakery", "clothing_store", "ice_cream", "alcohol_shop", "convenience", "hairdresser", "laundry", "shoe_shop", "jewelry", "optician", "furniture", "mobile_phone", "cosmetics", "florist", "butcher", "deli", "pharmacy"];
      const sz = (f, k) => ["interpolate", ["exponential", 1.6], ["zoom"], 10, ["*", ["sqrt", ["get", f]], k * 0.35], 13, ["*", ["sqrt", ["get", f]], k], 16, ["*", ["sqrt", ["get", f]], k * 3.2]];
      L({ id: "ly-biz", type: "circle", source: "sang", filter: [">=", ["get", "st"], 80], layout: { visibility: "none" }, paint: { "circle-radius": sz("st", 0.9), "circle-color": dk ? "rgba(236,150,60,.16)" : "rgba(232,140,40,.12)", "circle-stroke-color": dk ? "rgba(236,150,60,.7)" : "rgba(200,110,20,.6)", "circle-stroke-width": 1 } });
      L({ id: "ly-biz-lab", type: "symbol", source: "sang", minzoom: 13, filter: [">=", ["get", "st"], 80], layout: { visibility: "none", "text-field": ["format", ["get", "n"], {}, "\n", {}, ["concat", "점포 ", ["to-string", ["get", "st"]], ["case", [">", ["get", "sa"], 0], ["concat", " · 분기 매출 ", ["to-string", ["get", "sa"]], "억"], ""]], { "font-scale": 0.85 }], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-optional": true, "text-max-width": 9 }, paint: { "text-color": dk ? "#F2B37A" : "#9A4E0C", "text-halo-color": halo, "text-halo-width": 1.8 } });
      L({ id: "ly-acad", type: "circle", source: "sang", filter: [">=", ["get", "ac"], 15], layout: { visibility: "none" }, paint: { "circle-radius": sz("ac", 1.9), "circle-color": dk ? "rgba(190,150,240,.3)" : "rgba(122,63,184,.2)", "circle-stroke-color": dk ? "#C9A0F0" : "#7A3FB8", "circle-stroke-width": 1.2 } });
      L({ id: "ly-acad-lab", type: "symbol", source: "sang", minzoom: 11.5, filter: [">=", ["get", "ac"], 40], layout: { visibility: "none", "text-field": ["concat", ["get", "n"], "\n학원 ", ["to-string", ["get", "ac"]]], "text-font": ["Noto Sans Bold"], "text-size": 11.5, "text-optional": true, "text-max-width": 9 }, paint: { "text-color": dk ? "#D8B8F6" : "#5E2A96", "text-halo-color": halo, "text-halo-width": 2 } });
      poiTxt("ly-edu", ["all", ["in", ["get", "class"], ["literal", ["school"]]], ["any", ["in", "초등학교", nm], ["in", "중학교", nm], ["in", "고등학교", nm]]], dk ? "#7FB2E8" : "#1D5FA8", 12).forEach(L);
      poiTxt("ly-med", ["all", ["==", ["get", "class"], "hospital"], ["any", ["in", "병원", nm], ["in", "의료원", nm], ["in", "의료센터", nm]]], dk ? "#F08A8A" : "#C2272D", 11).forEach(L);
      poiTxt("ly-mart", ["all", ["in", ["get", "subclass"], ["literal", ["supermarket", "department_store", "mall", "wholesale"]]], ["any", ["in", "이마트", nm], ["in", "홈플러스", nm], ["in", "롯데마트", nm], ["in", "코스트코", nm], ["in", "트레이더스", nm], ["in", "백화점", nm], ["in", "하나로", nm]]], dk ? "#6FCF9A" : "#13744A", 11).forEach(L);
      L({ id: "ly-hj", type: "circle", source: "hj", layout: { visibility: "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 8], "circle-color": halo, "circle-stroke-color": ["get", "c"], "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 15, 4] } });
      L({ id: "ly-hj-lab", type: "symbol", source: "hj", layout: { visibility: "none", "text-field": ["format", ["get", "n"], {}, "\n", {}, ["get", "s"], { "font-scale": 0.85 }], "text-font": ["Noto Sans Bold"], "text-size": 11.5, "text-offset": [0, 1.2], "text-anchor": "top", "text-optional": true, "text-max-width": 10 }, paint: { "text-color": ["get", "c"], "text-halo-color": halo, "text-halo-width": 2 } });
      L({ id: "ly-hi", type: "symbol", source: "hi", layout: { visibility: "none", "text-field": ["get", "t"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-offset": [0, -1.9], "text-allow-overlap": false, "text-optional": true }, paint: { "text-color": dk ? "#FF9C8A" : "#B42318", "text-halo-color": halo, "text-halo-width": 2.2 } });
      L({ id: "zone-lab", type: "symbol", source: "zlab", minzoom: 11.8, layout: { "text-field": ["format", ["get", "n"], { "font-scale": 1 }, "\n", {}, ["get", "s"], { "font-scale": 0.84 }], "text-font": ["Noto Sans Bold"], "text-size": 12.5, "text-max-width": 9, "text-padding": 4 }, paint: { "text-color": P.ink, "text-halo-color": halo, "text-halo-width": 2 } });
      const pill = (id, bg, bd) => { if (map.hasImage(id)) return; const c = document.createElement("canvas"), r = 2, w = 40 * r, h = 28 * r; c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = bg; x.strokeStyle = bd; x.lineWidth = 2 * r; const rr = 12 * r; x.beginPath(); x.moveTo(rr, r); x.arcTo(w - r, r, w - r, h - r, rr); x.arcTo(w - r, h - r, r, h - r, rr); x.arcTo(r, h - r, r, r, rr); x.arcTo(r, r, w - r, r, rr); x.closePath(); x.fill(); x.stroke(); map.addImage(id, { width: w, height: h, data: x.getImageData(0, 0, w, h).data }, { pixelRatio: r, stretchX: [[14 * r, 26 * r]], stretchY: [[12 * r, 16 * r]], content: [8 * r, 5 * r, 32 * r, 23 * r] }); };
      pill("pill-on", P.y, P.y); pill("pill-off", dk ? "#1b2230" : "#ffffff", dk ? "#3a4556" : "#c9d0da");
      L({ id: "gub", type: "symbol", source: "gub", maxzoom: 12.2, layout: { "icon-image": ["case", [">", ["get", "k"], 0], "pill-on", "pill-off"], "icon-text-fit": "both", "icon-allow-overlap": true, "text-field": ["format", ["get", "n"], { "font-scale": 0.82 }, " ", {}, ["get", "v"], { "font-scale": 1.12 }], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 9.5, 10, 10.6, 12.5], "symbol-sort-key": ["-", 0, ["get", "k"]], "text-allow-overlap": true, "text-padding": 0 }, paint: { "text-color": ["case", [">", ["get", "k"], 0], "#ffffff", dk ? "#aab4c3" : "#5c6573"] } });
      ready = true;
      layerData();
      layers();
      paint();
      focus(pendFocus); pendFocus = false;
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
    // 서울 전체 화면: 구 이름 + 가능 구역 수(확대하면 사라지고 구역 경계가 보인다)
    function guBubbles() {
      if (!map || !ready || !geo || !map.getSource("gub")) return;
      const F = geo.gu.map((g) => {
        const rings = g.r.flat ? g.r : [g.r]; let a = 180, b = 90, c = -180, d = -90, sx = 0, sy = 0, n = 0;
        rings.forEach((rg) => rg.forEach(([x, y]) => { sx += x; sy += y; n++; if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }));
        const k = typeof guMetric === "function" ? guMetric(g.n) : 0;
        return { type: "Feature", geometry: { type: "Point", coordinates: [sx / n, sy / n] }, properties: { n: g.n.length <= 2 ? g.n : g.n.replace(/구$/, ""), g: g.n, v: String(k), k } };
      });
      map.getSource("gub").setData(FC(F));
    }
    function seoul() {
      gu = null;
      ui();
      if (!want || failed) return show(false);
      show(true);
      Promise.all([loadLib(), loadGeo()])
        .then(() => {
          if (mapView !== "seoul") return;
          if (!init()) { show(false); return; }
          const fitS = () => { if (mapView === "seoul" && !gu) { map.resize(); map.fitBounds(SEOUL_BB, { padding: 8, duration: 0 }); } };
          fitS(); requestAnimationFrame(fitS); map.once("idle", fitS);
          if (ready) paint();
        })
        .catch(() => { failed = true; show(false); });
    }
    function layerData() {
      const F = [];
      (HJD.items || []).forEach((h) => {
        if (/개통/.test(h.st || "") && !(h.stn || []).some(([, s]) => !/개통/.test(s))) return;
        (h.stn || []).forEach(([n, s]) => { if (/개통/.test(s)) return; const st = stnBy(n); if (st) F.push({ type: "Feature", geometry: { type: "Point", coordinates: [st.ll[1], st.ll[0]] }, properties: { n: `${h.n} ${n}`, s, c: h.c || "#7A3FB8" } }); });
        if (h.pt && h.pt.length === 2) { const [a, b] = h.pt; const ll = a > 90 ? [a, b] : [b, a]; F.push({ type: "Feature", geometry: { type: "Point", coordinates: ll }, properties: { n: h.n.replace(/\s*\(.*\)$/, ""), s: h.st || "", c: h.c || "#7A3FB8" } }); }
      });
      map.getSource("hj").setData(FC(F));
      const H = [];
      R.forEach((r) => { const t = r.tx && r.tx.hi, z = geo && geo.z[r.id]; if (!t || r.dn) return; const c = z ? z.l : r.ll ? [r.ll[1], r.ll[0]] : null; if (c) H.push({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: { t: `▲ 24년 이후 최고 ${t[1].slice(2, 4)}.${t[1].slice(4, 6)}` } }); });
      map.getSource("hi").setData(FC(H));
      if (lyr.has("biz") || lyr.has("acad")) ZXS.load().then((S) => { if (!S || !map.getSource("sang")) return; map.getSource("sang").setData(FC(S.items.map((x) => ({ type: "Feature", geometry: { type: "Point", coordinates: [x[0], x[1]] }, properties: { n: x[2], st: x[4], ac: x[5], sa: x[6] } })))); const q = $("lmSangQ"); if (q) q.textContent = `(${S.q})`; });
    }
    function layers() {
      if (!map || !ready) return;
      const ids = { hj: ["ly-hj", "ly-hj-lab"], hi: ["ly-hi"], edu: ["ly-edu", "ly-edu-lab"], acad: ["ly-acad", "ly-acad-lab"], biz: ["ly-biz", "ly-biz-lab"], med: ["ly-med", "ly-med-lab"], mart: ["ly-mart", "ly-mart-lab"] };
      Object.entries(ids).forEach(([k, ls]) => ls.forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, "visibility", lyr.has(k) ? "visible" : "none")));
    }
    function labelOf(r) {
      if (BINS[colorBy]) { const v = metric(r); if (v == null) return ""; return colorBy === "old" ? `노후 ${v}%` : colorBy === "vol" ? `1년 ${v}건` : `1년 ${v > 0 ? "+" : ""}${v}%`; }
      if (colorBy === "cash") {
        const k = dotState(r);
        if (k === "y" || k === "n") {
          const x = gapMode() ? gapOf(r) : investC(r);
          const need = gapMode() ? x.now : effBasis() === "total" ? x.needTotal : x.needBuy;
          if (need != null && isFinite(need)) return `${gapMode() ? "지금" : effBasis() === "total" ? "입주까지" : "지금"} ${e2(need)}억`;
        }
        return CASH_LAB[k] || "";
      }
      return r.src === "moa" ? "모아타운" : stageName(r);
    }
    function paint() {
      if (!map || !ready || !geo) return;
      const P = palette(), Z = geo.z;
      const vis = R.filter((r) => r.ll && visible(r));
      const off = [], est = [], lab = [], pts = [];
      for (const r of vis) {
        const st0 = colorBy === "cash" ? dotState(r) : "", c = colorOf(r, P), z = Z[r.id], o = BINS[colorBy] ? (metric(r) == null ? 0.4 : 1.25) : st0 === "x" ? 0.45 : st0 === "n" || st0 === "u" ? 0.75 : st0 === "y" ? 1.3 : 1;
        if (z) {
          (z.e ? est : off).push({ type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: { id: r.id, c, o } });
          lab.push({ type: "Feature", geometry: { type: "Point", coordinates: z.l }, properties: { id: r.id, n: shortName(r.n), s: labelOf(r) } });
        }
        if (!z) pts.push({ type: "Feature", geometry: { type: "Point", coordinates: [r.ll[1], r.ll[0]] }, properties: { id: r.id, c, o } });
      }
      map.getSource("zones").setData(FC(off));
      map.getSource("zest").setData(FC(est));
      map.getSource("zlab").setData(FC(lab));
      map.getSource("pts").setData(FC(pts));
      requestAnimationFrame(guBubbles);
      legend();
    }
    function bboxOf(rings) { let a = 180, b = 90, c = -180, d = -90; rings.forEach((rg) => rg.forEach(([x, y]) => { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; })); return [[a, b], [c, d]]; }
    function focus(zoom) {
      if (!map || !ready) return;
      const src = map.getSource("sel");
      const z = cur && geo && geo.z[cur.id];
      if (!cur || !(z || cur.ll)) { src.setData(FC([])); return; }
      src.setData(z ? { type: "Feature", geometry: { type: "Polygon", coordinates: z.g }, properties: {} } : FC([]));
      if (!zoom) return;
      const dur = reduceMotion() ? 0 : 650;
      if (z) map.fitBounds(bboxOf(z.g), { padding: 70, maxZoom: 16.3, duration: dur });
      else map.flyTo({ center: [cur.ll[1], cur.ll[0]], zoom: Math.max(map.getZoom(), 15), duration: dur });
    }
    function fitGu(n) {
      if (!map || !geo) return;
      const g = geo.gu.find((x) => x.n === n);
      if (g) map.fitBounds(bboxOf(g.r.flat ? g.r : [g.r]), { padding: 18, duration: reduceMotion() ? 0 : 500 });
    }
    function legend() {
      const el = $("lmLegend");
      if (!el) return;
      const P = palette();
      let items;
      if (colorBy === "stage") items = [[1, "계획·지정"], [2, "추진위"], [3, "조합설립"], [4, "사업시행"], [5, "관리처분"], [6, "이주·착공"]].map(([i, t]) => [probe(STCOL(i)), t]);
      else if (colorBy === "kind") { const K = KIND_COL(); items = [[K.rd, "재개발"], [K.rc, "재건축"], [K.sm, "가로·소규모"], [K.moa, "모아타운"]]; }
      else if (BINS[colorBy]) items = BINS[colorBy].map(([, t], i) => [(dark() ? RAMP_D : RAMP)[i], t]).concat([[P.x, "자료 없음"]]);
      else items = [[P.y, gapMode() ? "전세 끼고 지금 가능" : effBasis() === "total" ? "입주까지 가능" : "지금 매수 가능"], [P.n, "현금 부족"], [P.u, "거래 적어 계산 못 함·제외"]];
      const note = { old: "노후도 = 경계 안 건축물 중 사용승인 후 30년(철근콘크리트)·20년(그 외) 지난 비율 · 서울도시공간포털 건물 레이어(사용승인 2022년까지 반영)로 직접 계산 · 이주·철거 이후 구역과 연도 확인 건물이 적은 곳은 빼요", vol: "최근 12개월 구역 안 연립·다세대 매매 건수(단독·아파트 제외, 서울시 실거래)", yoy: "대지지분 3.3㎡당 매매가 가운데 값, 최근 12개월 vs 그 전 12개월 · 두 기간 5건 이상" }[colorBy];
      el.innerHTML = `${items.map(([c, t]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join("")}<span class="lm-est"><i></i>점선 = 공식 경계 없음(면적 기준 추정 범위)</span>${note ? `<small class="lm-note">${esc(note)}</small>` : ""}`;
    }
    function ui() {
      const box = $("mapbox");
      if (!box || $("lmap")) return;
      const d = document.createElement("div");
      d.id = "lmap"; d.className = "lmap"; d.hidden = true;
      d.innerHTML = `<div class="lm-ctl" role="group" aria-label="지도 보기"><label class="lm-sel"><span>색</span><select id="lmColor" aria-label="구역 색 기준">${MODES.map(([k, t]) => `<option value="${k}"${colorBy === k ? " selected" : ""}>${t}</option>`).join("")}</select></label><button type="button" class="lm-ly" aria-expanded="false" aria-controls="lmLayers">레이어${lyr.size ? ` <b>${lyr.size}</b>` : ""}</button><button type="button" class="lm-lg" aria-expanded="false" aria-controls="lmLegend">범례</button></div><div class="lm-layers" id="lmLayers" hidden><p>겹쳐 보기</p>${LAYERS.map(([k, t, sub]) => `<label><input type="checkbox" value="${k}"${lyr.has(k) ? " checked" : ""}><span>${t}<small>${sub}</small></span></label>`).join("")}<p class="lm-ln">상권·학원가: 서울시 상권분석서비스 <span id="lmSangQ"></span> 점포 수·추정매출. 학교·병원·마트: OpenStreetMap 기준이라 빠진 곳이 있을 수 있어요.</p></div><div class="lm-legend" id="lmLegend" hidden></div>`;
      d.querySelector(".lm-lg").onclick = (e) => { const lg = $("lmLegend"), on = lg.hidden; lg.hidden = !on; e.currentTarget.setAttribute("aria-expanded", String(on)); if (on) { $("lmLayers").hidden = true; d.querySelector(".lm-ly").setAttribute("aria-expanded", "false"); } };
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
        d.querySelector(".lm-ly").innerHTML = `레이어${lyr.size ? ` <b>${lyr.size}</b>` : ""}`;
        layerData();
        layers();
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
          minZoom: 8.8, maxZoom: 17.6, maxBounds: [[126.55, 37.3], [127.42, 37.82]], attributionControl: false,
          localIdeographFontFamily: "'Pretendard Variable','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif",
          cooperativeGestures: matchMedia("(pointer: coarse)").matches, dragRotate: false, pitchWithRotate: false, touchPitch: false,
          locale: { "CooperativeGesturesHandler.WindowsHelpText": "Ctrl 키를 누른 채 스크롤하면 확대·축소돼요", "CooperativeGesturesHandler.MacHelpText": "⌘ 키를 누른 채 스크롤하면 확대·축소돼요", "CooperativeGesturesHandler.MobileHelpText": "두 손가락으로 지도를 움직여 보세요" },
        });
      } catch (e) { map = null; failed = true; return false; }
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '정비구역 경계 <a href="https://urban.seoul.go.kr" target="_blank" rel="noopener">서울도시공간포털</a>' }), "bottom-right");
      map.on("style.load", () => { ready = false; loadGeo().then(overlays); });
      map.once("load", () => { const a = $("lmap").querySelector(".maplibregl-ctrl-attrib"); if (a) a.classList.remove("maplibregl-compact-show"); });
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
      const tipOf = (r) => `<b>${esc(shortName(r.n))}</b><small>${esc([SHAPE[shapeOf(r)], r.src === "moa" ? srLabel(r) : stageName(r)].join(" · "))}</small><small>${esc(labelOf(r))}${geo && geo.z[r.id] && geo.z[r.id].e ? " · 경계 추정" : ""}</small>`;
      hit.forEach((l) => {
        map.on("mousemove", l, (e) => { const r = byId[e.features[0].properties.id]; if (!r) return; map.getCanvas().style.cursor = "pointer"; pop.setLngLat(e.lngLat).setHTML(tipOf(r)).addTo(map); });
        map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; pop.remove(); });
      });
      map.on("click", (e) => {
        const gb = map.getLayer("gub") ? map.queryRenderedFeatures(e.point, { layers: ["gub"] }) : [];
        if (gb.length && mapView === "seoul") { enterGu(gb[0].properties.g, {}); return; }
        const ls = hit.filter((l) => map.getLayer(l));
        const fs = map.queryRenderedFeatures(e.point, { layers: ls });
        if (!fs.length) return;
        // 겹치면 작은(구체적인) 구역 우선
        const area = (f) => { const z = geo && geo.z[f.properties.id]; return z ? z.a || 1e9 : 1e9; };
        const f = fs.slice().sort((a, b) => (a.layer.id === "zest-fill") - (b.layer.id === "zest-fill") || area(a) - area(b))[0];
        const id = f.properties.id;
        if (!byId[id]) return;
        pop.remove();
        curTab = "money";
        const rt = $("report").getBoundingClientRect().top;
        select(id, false, false, { scroll: !MQ_SHEET.matches && (rt < HDR() - 4 || rt > innerHeight * 0.5) });
      });
      try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", restyle); } catch (e) {}
      try { new MutationObserver(restyle).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) {}
      try { map.getCanvas().setAttribute("aria-label", "정비구역 경계 지도. 키보드로는 옆의 구역 목록을 쓰세요"); } catch (e) {}
      return true;
    }
    function restyle() { if (map) { ready = false; map.setStyle(style(), { diff: false }); } }
    function show(on) {
      const el = $("lmap");
      if (!el) return;
      el.hidden = !on;
      $("mapbox").classList.toggle("lm-on", on);
      const bar = $("mapBar");
      if (on && bar && getComputedStyle(bar).position !== "absolute") $("mapbox").style.setProperty("--lm-top", bar.offsetHeight + "px");
      else $("mapbox").style.removeProperty("--lm-top");
      if (on && map) requestAnimationFrame(() => map.resize());
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
    function exit() { gu = null; if (document.documentElement.classList.contains("simple")) seoul(); else show(false); }
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
      focus: (zoom) => { if (map && ready && !$("lmap").hidden) focus(zoom); },
      zoom: (k) => { if (!map) return; if (k > 0) map.zoomIn(); else if (k < 0) map.zoomOut(); else if (gu) fitGu(gu); else map.fitBounds(SEOUL_BB, { padding: 8, duration: reduceMotion() ? 0 : 400 }); },
      geo: () => loadGeo(),
    };
  })();
