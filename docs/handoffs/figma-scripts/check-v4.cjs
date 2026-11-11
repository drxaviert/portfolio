// Geometry check for Faithful v4: sag, bounds, tip tangents, dot spread.
const V4 = require('./gen-v4.cjs');
const { PW, PH } = V4;

const ss = V4.strands('Day');
let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
let badMargin = 0, tipsBelowHorizon = 0;
const byAngle = { 0: [], 30: [], 45: [], 60: [], 75: [], 85: [] };
for (const s of ss) {
  for (let k = 0; k <= 30; k++) {
    const t = k / 30;
    const a = 1 - t;
    const p = s.c;
    const x = a * a * a * p[0][0] + 3 * a * a * t * p[1][0] + 3 * a * t * t * p[2][0] + t * t * t * p[3][0];
    const y = a * a * a * p[0][1] + 3 * a * a * t * p[1][1] + 3 * a * t * t * p[2][1] + t * t * t * p[3][1];
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  }
  const [tx, ty] = s.tip;
  if (tx < 12 || tx > PW - 12 || ty > PH - 12 || ty < 12) badMargin++;
  if (s.phi < 0) tipsBelowHorizon++;
  const deg = Math.abs(s.th) * 180 / Math.PI;
  for (const b of [0, 30, 45, 60, 75, 85]) {
    if (Math.abs(deg - b) < 5) byAngle[b].push({ phi: s.phi * 180 / Math.PI, sag: s.sag, tip: s.tip });
  }
}
const pct = y => ((PH - y) / PH * 100).toFixed(1) + '% of height';
console.log(`strands ${ss.length}, panel ${PW}x${PH}`);
console.log(`highest strand point y=${minY.toFixed(1)} (${pct(minY)})  [limit 68% -> y>=${(PH * 0.32).toFixed(1)}]`);
console.log(`lowest point y=${maxY.toFixed(1)}, x range ${minX.toFixed(0)}..${maxX.toFixed(0)}`);
console.log(`tips outside the 12px margin: ${badMargin}`);
console.log(`tips whose tangent points below horizontal: ${tipsBelowHorizon}`);
for (const b of Object.keys(byAngle)) {
  const a = byAngle[b];
  if (!a.length) continue;
  const m = a.reduce((s, v) => s + v.phi, 0) / a.length;
  const sg = a.reduce((s, v) => s + v.sag, 0) / a.length;
  const ty = a.reduce((s, v) => s + v.tip[1], 0) / a.length;
  console.log(`  ~${b}deg: n=${a.length} mean tip tangent ${m.toFixed(0)}deg  mean sag ${sg.toFixed(1)}px  mean tip y ${ty.toFixed(0)}`);
}
