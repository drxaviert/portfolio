// gen-v4.cjs — Faithful v4: v3's card, panel, gradient and glow with strands
// that hang under the weight of their tips (fibre-optic droop). Each strand is a
// cubic with the fan angle as its start tangent and a downward tip tangent.
const V3 = require('./gen-v3.cjs');
const G = require('./gen.cjs');
const { PHASES } = G;
const { CARD_W, CARD_H, CARD_R, PAD, PW, PH, PR } = V3;

const f = n => Math.round(n * 100) / 100;
const rng = seed => {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
};
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function cubicAt(p, t) {
  const a = 1 - t;
  return [0, 1].map(i => a * a * a * p[0][i] + 3 * a * a * t * p[1][i] + 3 * a * t * t * p[2][i] + t * t * t * p[3][i]);
}
function splitCubic(p, t) {
  const a = lerp(p[0], p[1], t), b = lerp(p[1], p[2], t), c = lerp(p[2], p[3], t);
  const d = lerp(a, b, t), e = lerp(b, c, t), m = lerp(d, e, t);
  return { l: [p[0], a, d, m], r: [m, e, c, p[3]] };
}
function cubicSeg(p, t0, t1) {
  let s = p;
  if (t1 < 1) s = splitCubic(s, t1).l;
  const u = t1 <= 0 ? 0 : t0 / t1;
  if (u > 0) s = splitCubic(s, u).r;
  return `C${f(s[1][0])},${f(s[1][1])} ${f(s[2][0])},${f(s[2][1])} ${f(s[3][0])},${f(s[3][1])}`;
}
function inside(x, y) {
  const nx = Math.min(Math.max(x, PR), PW - PR);
  const ny = Math.min(Math.max(y, PR), PH - PR);
  return (x - nx) * (x - nx) + (y - ny) * (y - ny) <= PR * PR + 1e-9;
}
function span(p, steps = 96) {
  let enter = -1, exit = -1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, q = p(t);
    if (inside(q[0], q[1])) { if (enter < 0) enter = t; exit = t; }
    else if (enter >= 0) break;
  }
  if (enter < 0) return null;
  let lo = Math.max(0, enter - 1 / steps), hi = enter;
  if (enter > 0) for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; inside(p(m)[0], p(m)[1]) ? hi = m : lo = m; enter = hi; }
  let e0 = exit, e1 = Math.min(1, exit + 1 / steps);
  if (exit < 1) for (let k = 0; k < 20; k++) { const m = (e0 + e1) / 2; inside(p(m)[0], p(m)[1]) ? e0 = m : e1 = m; exit = e0; }
  if (exit - enter < 0.004) return null;
  return [enter, exit];
}
const dotsPath = dots => dots.map(d =>
  `M${f(d.x - d.r)},${f(d.y)}a${f(d.r)},${f(d.r)} 0 1,0 ${f(2 * d.r)},0a${f(d.r)},${f(d.r)} 0 1,0 ${f(-2 * d.r)},0Z`).join('');
const svgDoc = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}"><defs>${defs}</defs>${body}</svg>`;

/* ---------- beam geometry ---------- */
const CX = PW / 2, CY = PH + 8;
const LOCUS_RX = 380, LOCUS_RY = 174, LOCUS_N = 2.5;  // tip dome, 174 -> 68% height
const SAG_K = 1.8e-4;      // sag per (horizontal reach)^2
const CURL = 45;           // degrees of tip-tangent rotation at full sideways
const WEIGHT_JITTER = 0.15;
const MARGIN = 14;         // tips stay this far inside the panel (spec: >=12)

function locusRadius(th) {
  const a = Math.abs(Math.sin(th)) / LOCUS_RX;
  const b = Math.abs(Math.cos(th)) / LOCUS_RY;
  return Math.pow(Math.pow(a, LOCUS_N) + Math.pow(b, LOCUS_N), -1 / LOCUS_N);
}

// returns every strand as a cubic plus its tip tangent, for art + checks
function strands(phase, o = {}) {
  const r = rng(o.seed || 31);
  const count = o.count || 560, spread = 85 * Math.PI / 180;
  const out = [];
  for (let i = 0; i < count; i++) {
    let u = (i + r() * 0.9) / count * 2 - 1;
    u = Math.sign(u) * Math.pow(Math.abs(u), 1.05);
    const th = u * spread + (r() - 0.5) * 0.012;
    const dx = Math.sin(th), dy = -Math.cos(th);
    const R = locusRadius(th) * (0.65 + 0.35 * r());
    const weight = 1 + (r() - 0.5) * 2 * WEIGHT_JITTER;
    const hReach = Math.abs(dx * R);
    const e = [CX + dx * R, CY + dy * R];
    // sag grows with the square of the horizontal reach; never past the panel
    const sag = Math.min(SAG_K * hReach * hReach * weight, Math.max(0, (PH - MARGIN) - e[1]));
    const tip = [e[0], e[1] + sag];
    // tip tangent: the fan angle minus a curl that grows sideways, so the
    // outermost strands leave the tip pointing below horizontal
    const alpha = Math.PI / 2 - Math.abs(th);
    const phi = alpha - CURL * Math.PI / 180 * Math.pow(Math.abs(Math.sin(th)), 1.2);
    const sgn = th < 0 ? -1 : 1;
    const td = [sgn * Math.cos(phi), -Math.sin(phi)];
    const c = [
      [CX, CY],
      [CX + dx * R / 3, CY + dy * R / 3],
      [tip[0] - td[0] * R / 3, tip[1] - td[1] * R / 3],
      tip,
    ];
    out.push({ c, th, tip, sag, phi, weight });
  }
  return out;
}

function strandLayer(phase, opts = {}) {
  const p = PHASES[phase];
  const r = rng(911);
  const groups = { 0.45: [], 0.36: [], 0.28: [] };
  const gkey = [0.45, 0.36, 0.28];
  const dots = [];
  for (const s of strands(phase)) {
    const pos = t => cubicAt(s.c, t);
    const sp = span(pos, 64);
    if (!sp) continue;
    const a = pos(sp[0]);
    const g = gkey[r() < 0.34 ? 0 : (r() < 0.515 ? 1 : 2)];
    groups[g].push(`M${f(a[0])},${f(a[1])}${cubicSeg(s.c, sp[0], sp[1])}`);
    const t = s.tip;
    const dotZone = t[0] > 30 && t[0] < PW - 30 && t[1] > 10 && t[1] < PH * 0.86;
    if (r() < 0.72 && dotZone) dots.push({ x: t[0], y: t[1], r: 2.5 + r() * 1.0 });
  }
  const body = Object.keys(groups).filter(k => groups[k].length).map(k =>
    `<path d="${groups[k].join('')}" fill="none" stroke="${p.strand}" stroke-opacity="${k}" stroke-width="1" stroke-linecap="round"/>`).join('\n');
  const dotsEl = dots.length ? `<path d="${dotsPath(dots)}" fill="${p.dot}" opacity="0.95"/>` : '';
  // v3's fade: clear over the top quarter, dissolving the tips
  const defs = `<mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${PW}" height="${PH}">
<rect x="0" y="0" width="${PW}" height="${PH}" fill="url(#fg)"/>
</mask>
<linearGradient id="fg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${PH}">
<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
<stop offset="0.26" stop-color="#ffffff" stop-opacity="0"/>
<stop offset="0.38" stop-color="#ffffff" stop-opacity="0.32"/>
<stop offset="0.50" stop-color="#ffffff" stop-opacity="0.62"/>
<stop offset="0.62" stop-color="#ffffff" stop-opacity="0.88"/>
<stop offset="0.76" stop-color="#ffffff" stop-opacity="1"/>
<stop offset="1" stop-color="#ffffff" stop-opacity="1"/>
</linearGradient>`;
  return svgDoc(defs, `<g mask="url(#fade)">${body}\n${dotsEl}</g>`);
}

function tileLayers(phase) {
  const base = V3.tileLayers(phase);   // v3 bg + glow are reused as-is
  return {
    cardFill: base.cardFill,
    panel: base.panel,
    layers: [
      base.layers[0],
      base.layers[1],
      { name: 'art · strands', svg: strandLayer(phase) },
    ],
  };
}

module.exports = { CARD_W, CARD_H, CARD_R, PAD, PW, PH, PR, COLS: V3.COLS, tileLayers, strands, locusRadius };

if (require.main === module) {
  const t = tileLayers(process.argv[2] || 'Day');
  console.log(JSON.stringify({ cardFill: t.cardFill, panel: t.panel,
    layers: t.layers.map(l => ({ name: l.name, bytes: l.svg.length, paths: (l.svg.match(/<path /g) || []).length, blur: l.blur || 0 })) }, null, 1));
}
