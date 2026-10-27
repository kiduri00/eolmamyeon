// 재개픽 brand mark (v7) — single source of geometry for the launcher, splash and notification icons.
// Same construction as brand_v7 (logo/jaegaegak_mark_*.svg), 64-unit box:
//   pin   : circle r19 at (32,25) + two tangents meeting at exactly 90deg , tip slightly rounded
//   house : 45deg roof, so the roof apex is a right angle mirroring the pin tip; crisp mitred corners
//   door  : yellow; dot: yellow brand dot under the tip (the "spot" on the map)
const R2 = Math.SQRT2;
const PIN_CY = 25, PIN_R = 19, TIP_R = 1.5;
const TIP_Y = PIN_CY + PIN_R * R2;                                  // 51.87
const DOT_R = 2.75, DOT_CY = TIP_Y + 3.5 + DOT_R - 0.6;             // 57.52
const APEX = 12.4, HW = 10.4, BASE = 34.6, EAVE = 1.9;
const DOOR_W = 5.4, DOOR_H = 8.0, DOOR_R = 1.1;
const f = (n) => +n.toFixed(3);

function pinD() {
  const a = PIN_R / R2, cx = 32, cy = PIN_CY, d = TIP_R;
  return `M${f(cx + d)},${f(TIP_Y - d)}L${f(cx + a)},${f(cy + a)}A${PIN_R},${PIN_R} 0 1,0 ${f(cx - a)},${f(cy + a)}` +
    `L${f(cx - d)},${f(TIP_Y - d)}Q${cx},${f(TIP_Y)} ${f(cx + d)},${f(TIP_Y - d)}Z`;
}
function houseD() {
  const ry = APEX + HW, ex = HW - EAVE;
  return `M32,${APEX}L${f(32 + HW)},${f(ry)}H${f(32 + ex)}V${BASE}H${f(32 - ex)}V${f(ry)}H${f(32 - HW)}Z`;
}
function doorD() {
  const x0 = 32 - DOOR_W / 2, y0 = BASE - DOOR_H, r = DOOR_R;
  return `M${f(x0 + r)},${f(y0)}H${f(x0 + DOOR_W - r)}A${r},${r} 0 0,1 ${f(x0 + DOOR_W)},${f(y0 + r)}V${BASE}` +
    `H${f(x0)}V${f(y0 + r)}A${r},${r} 0 0,1 ${f(x0 + r)},${f(y0)}Z`;
}
function dotD() {
  const r = DOT_R;
  return `M${f(32 - r)},${f(DOT_CY)}a${r},${r} 0 1,0 ${f(2 * r)},0a${r},${r} 0 1,0 ${f(-2 * r)},0Z`;
}

// Ink bounds in mark units (with and without the dot) and the farthest ink point from a centre, for safe-zone checks.
const BOX = { x0: 32 - PIN_R, y0: PIN_CY - PIN_R, x1: 32 + PIN_R, y1: DOT_CY + DOT_R };
const BOX_NODOT = { ...BOX, y1: TIP_Y };
function maxRadius(cx, cy, dot = true) {
  // circle part, tip and dot are the only extreme points
  let m = Math.hypot(32 - cx, PIN_CY - cy) + PIN_R;
  m = Math.max(m, Math.hypot(32 - cx, TIP_Y - cy));
  if (dot) m = Math.max(m, Math.hypot(32 - cx, DOT_CY - cy) + DOT_R);
  return m;
}

module.exports = { PIN: pinD(), HOUSE: houseD(), DOOR: doorD(), DOT: dotD(), BOX, BOX_NODOT, TIP_Y, maxRadius,
  NAVY: '#1F3A87', NAVY_D: '#13265E', YELLOW: '#F5C33B' };
