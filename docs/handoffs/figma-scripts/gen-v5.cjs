// gen-v5.cjs — Faithful v5: v4's weighted, drooping strands with a per-strand
// base-to-tip colour ramp, a dot on every tip, and a stripe.com style radial
// panel glow (warm core -> cool blue -> near-white edge).
const V3 = require('./gen-v3.cjs');
const G = require('./gen.cjs');
const { CARD_W, CARD_H, CARD_R, PAD, PW, PH, PR } = V3;
const { COLS } = V3;
const { PHASES } = G;

const f = n => Math.round(n * 100) / 100;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const hx = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mixc = (a, b, t) => hx(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
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
function span(p, steps = 64) {
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

/* ---------- panel palette (Day) ---------- */
const CX = PW / 2, CY = PH + 8;
const PAL = {
  Day: {
    warm: '#EFBE8C', warmLight: '#F6D8BA',
    cool: '#3687D9', deep: '#2A5FD0', light: '#5AA0E4',
    gradTop: '#A9CAEA', gradMid: '#B7D2EC', gradPale: '#D7E7F5', gradEdge: '#F0F7FC',
  },
  Dawn: { warm: '#EFBE8C', warmLight: '#F6D8BA', cool: '#C79BF0', deep: '#A974D8', light: '#DDBDF8', gradTop: '#DDBDF8', gradMid: '#E6D2F7', gradPale: '#F3EBFB', gradEdge: '#FBF7FE' },
  Dusk: { warm: '#EFBE8C', warmLight: '#F6D8BA', cool: '#DE9750', deep: '#C87932', light: '#EFBE8C', gradTop: '#F6DCC0', gradMid: '#F3E2CE', gradPale: '#FBF1E6', gradEdge: '#FEFAF5' },
  Night: { warm: '#B85343', warmLight: '#C96A58', cool: '#FFF2EA', deep: '#FFB39E', light: '#FFD9C9', gradTop: '#1C1C1E', gradMid: '#222226', gradPale: '#2A2A2E', gradEdge: '#333338' },
};

/* ---------- beam geometry (v4 bend, tighter locus so every tip fits) ---------- */
const LOCUS_RX = 365, LOCUS_RY = 170, LOCUS_N = 2.5;
const SAG_K = 1.8e-4, CURL = 45, WEIGHT_JITTER = 0.15;
const MARGIN = 16;
function locusRadius(th) {
  const a = Math.abs(Math.sin(th)) / LOCUS_RX;
  const b = Math.abs(Math.cos(th)) / LOCUS_RY;
  return Math.pow(Math.pow(a, LOCUS_N) + Math.pow(b, LOCUS_N), -1 / LOCUS_N);
}

const VARIANTS = [
  { key: 'A', p: 0.55, tip: 'cool', end: 'deep' },
  { key: 'B', p: 0.25, tip: 'deep', end: 'deep' },
  { key: 'C', p: 0.20, tip: 'light', end: 'cool' },
];
const BUCKETS = [0.90, 0.72, 0.55, 0.40, 0.27];
const WIDTHS = [1.35, 1.15, 0.95, 0.78, 0.62];

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
    const sag = Math.min(SAG_K * hReach * hReach * weight, Math.max(0, (PH - MARGIN) - e[1]));
    const tip = [e[0], e[1] + sag];
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
    const big = r() < 0.06;
    out.push({
      c, th, tip, sag, phi, big,
      dotR: big ? 3.2 + r() * 0.5 : 2 + r() * 1.4,
    });
  }
  return out;
}

/* ---------- background: warm core over a cool-to-white radial ---------- */
function bgLayer(phase) {
  const c = PAL[phase] || PAL.Day;
  return svgDoc(`<radialGradient id="bgc" gradientUnits="userSpaceOnUse" cx="${f(CX)}" cy="${f(CY)}" r="560">
<stop offset="0" stop-color="${mixc(c.gradTop, '#1F5FA8', 0.18)}"/>
<stop offset="0.16" stop-color="${c.gradTop}"/>
<stop offset="0.38" stop-color="${c.gradMid}"/>
<stop offset="0.62" stop-color="${c.gradPale}"/>
<stop offset="0.84" stop-color="${c.gradEdge}"/>
<stop offset="1" stop-color="#FFFFFF"/>
</radialGradient>
<radialGradient id="bgw" gradientUnits="userSpaceOnUse" cx="${f(CX)}" cy="${f(CY)}" r="320">
<stop offset="0" stop-color="${c.warm}" stop-opacity="0.52"/>
<stop offset="0.20" stop-color="${mixc(c.warm, '#ffffff', 0.18)}" stop-opacity="0.40"/>
<stop offset="0.45" stop-color="${mixc(c.warm, '#ffffff', 0.45)}" stop-opacity="0.20"/>
<stop offset="0.72" stop-color="${mixc(c.warm, '#ffffff', 0.72)}" stop-opacity="0.06"/>
<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
</radialGradient>`,
    `<rect width="${PW}" height="${PH}" rx="${PR}" fill="url(#bgc)"/>
<rect width="${PW}" height="${PH}" rx="${PR}" fill="url(#bgw)"/>`);
}

/* ---------- strands: v4 styling (solid phase colour, three opacity groups),
   a dot on every tip, kept outside the fade so no dot is lost ---------- */
function strandLayer(phase) {
  const p = PHASES[phase];
  const r = rng(911);
  const keys = [0.45, 0.36, 0.28];
  const groups = [[], [], []];
  const dots = [], bright = [];
  for (const s of strands(phase)) {
    const pos = t => cubicAt(s.c, t);
    const sp = span(pos, 64);
    if (!sp) continue;
    const a = pos(sp[0]);
    const gi = r() < 0.34 ? 0 : (r() < 0.515 ? 1 : 2);
    groups[gi].push(`M${f(a[0])},${f(a[1])}${cubicSeg(s.c, sp[0], sp[1])}`);
    (s.big ? bright : dots).push({ x: s.tip[0], y: s.tip[1], r: s.dotR });
  }
  const body = keys.map((k, i) => groups[i].length
    ? `<path d="${groups[i].join('')}" fill="none" stroke="${p.strand}" stroke-opacity="${k}" stroke-width="1" stroke-linecap="round"/>` : '').join('\n');
  // v4's fade, applied to the strands only
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
  const dotEls = [
    dots.length ? `<path d="${dotsPath(dots)}" fill="${p.dot}" opacity="0.95"/>` : '',
    bright.length ? `<path d="${dotsPath(bright)}" fill="${p.dot}" opacity="1"/>` : '',
  ].filter(Boolean).join('\n');
  return svgDoc(defs, `<g mask="url(#fade)">${body}</g>\n${dotEls}`);
}

function tileLayers(phase) {
  return {
    cardFill: V3.tileLayers(phase).cardFill,
    panel: V3.tileLayers(phase).panel,
    layers: [
      { name: 'art · bg', svg: bgLayer(phase) },
      { name: 'art · strands', svg: strandLayer(phase) },
    ],
  };
}

module.exports = { CARD_W, CARD_H, CARD_R, PAD, PW, PH, PR, COLS, PAL, tileLayers, strands, locusRadius };

if (require.main === module) {
  const t = tileLayers(process.argv[2] || 'Day');
  console.log(JSON.stringify({
    cardFill: t.cardFill, panel: t.panel,
    layers: t.layers.map(l => ({ name: l.name, bytes: l.svg.length, paths: (l.svg.match(/<path /g) || []).length, grads: (l.svg.match(/Gradient/g) || []).length })),
  }, null, 1));
}
