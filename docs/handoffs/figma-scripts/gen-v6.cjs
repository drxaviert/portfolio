// gen-v6.cjs — Faithful v6: v4's strand art untouched (widths, orb sizes, white,
// weighted-tip bend, fade) with an orb on every tip, inside the same fade mask,
// over a Day-theme radial whose warm core sits at the fan origin.
// Day hues are the site's play tokens (src/app/globals.css) + the Day phase roles:
//   play-bg-top #FFE97A · play-bg-mid #A9D98B · play-base #8FB0F0
//   play-glow   #FFF8D4 · primary #3687D9
const V3 = require('./gen-v3.cjs');
const V4 = require('./gen-v4.cjs');
const G = require('./gen.cjs');
const { PHASES } = G;
const { CARD_W, CARD_H, CARD_R, PAD, PW, PH, PR } = V3;
const { COLS } = V3;

const f = n => Math.round(n * 100) / 100;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const hx = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mixc = (a, b, t) => hx(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
const rng = seed => {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
};
function cubicAt(p, t) {
  const a = 1 - t;
  return [0, 1].map(i => a * a * a * p[0][i] + 3 * a * a * t * p[1][i] + 3 * a * t * t * p[2][i] + t * t * t * p[3][i]);
}
function splitCubic(p, t) {
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
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

/* ---------- Day palette (site tokens only) ---------- */
const DAY = {
  top: '#FFE97A',    // --play-bg-top
  mid: '#A9D98B',    // --play-bg-mid
  base: '#8FB0F0',   // --play-base
  glow: '#FFF8D4',   // --play-glow
  primary: '#3687D9',// --primary (Day)
};

// fan origin, the centre of the warm core
const CX = PW / 2, CY = PH + 8;

const BGC = 520;   // radial radius in panel space; corners (479) land on the cool rim
const STOPS = [
  { o: 0.00, c: DAY.top },
  { o: 0.10, c: mixc(DAY.top, DAY.mid, 0.60) },
  { o: 0.24, c: DAY.mid },
  { o: 0.44, c: mixc(DAY.mid, DAY.base, 0.58) },
  { o: 0.68, c: DAY.base },
  { o: 1.00, c: mixc(DAY.base, DAY.primary, 0.42) },
];

/* ---------- background: warm core at the origin, cooling outward ---------- */
function bgLayer() {
  return svgDoc(`<radialGradient id="bg" gradientUnits="userSpaceOnUse" cx="${f(CX)}" cy="${f(CY)}" r="${BGC}">
${STOPS.map(s => `<stop offset="${s.o}" stop-color="${s.c}"/>`).join('')}
</radialGradient>`,
    `<rect width="${PW}" height="${PH}" rx="${PR}" fill="url(#bg)"/>`);
}

/* ---------- glow: the warm core itself, hugging the fan base ---------- */
function glowLayer() {
  return svgDoc(`<radialGradient id="core" gradientUnits="userSpaceOnUse" cx="${f(CX)}" cy="${f(CY)}" r="204">
<stop offset="0" stop-color="${DAY.glow}" stop-opacity="0.50"/>
<stop offset="0.25" stop-color="${DAY.glow}" stop-opacity="0.30"/>
<stop offset="0.55" stop-color="${DAY.top}" stop-opacity="0.10"/>
<stop offset="1" stop-color="${DAY.top}" stop-opacity="0"/>
</radialGradient>`,
    `<rect width="${PW}" height="${PH}" rx="${PR}" fill="url(#core)"/>`);
}

/* ---------- strands: v4's art, orb on every tip, orbs under the fade ---------- */
function strandLayer(phase) {
  const p = PHASES[phase];
  const r = rng(911);
  const keys = [0.45, 0.36, 0.28];
  const groups = [[], [], []];
  const dots = [];
  for (const s of V4.strands(phase)) {
    const pos = t => cubicAt(s.c, t);
    const sp = span(pos, 64);
    if (!sp) continue;
    const a = pos(sp[0]);
    const gi = r() < 0.34 ? 0 : (r() < 0.515 ? 1 : 2);
    groups[gi].push(`M${f(a[0])},${f(a[1])}${cubicSeg(s.c, sp[0], sp[1])}`);
    // v4 drew two randoms per tip for a 72%-gated orb; keep both draws and the
    // same 2.5–3.5 radius so the orb sizes are v4's, but place one on every tip.
    r();
    const dr = 2.5 + r() * 1.0;
    dots.push({ x: s.tip[0], y: s.tip[1], r: dr });
  }
  const body = keys.map((k, i) => groups[i].length
    ? `<path d="${groups[i].join('')}" fill="none" stroke="${p.strand}" stroke-opacity="${k}" stroke-width="1" stroke-linecap="round"/>` : '').join('\n');
  // v4's fade, unchanged, now covering the orbs too
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
  const dotEl = dots.length ? `<path d="${dotsPath(dots)}" fill="${p.dot}" opacity="0.95"/>` : '';
  return svgDoc(defs, `<g mask="url(#fade)">${body}\n${dotEl}</g>`);
}

function tileLayers(phase) {
  return {
    cardFill: V3.tileLayers(phase).cardFill,
    panel: V3.tileLayers(phase).panel,
    layers: [
      { name: 'art · bg', svg: bgLayer() },
      { name: 'art · glow', svg: glowLayer(), blur: 6 },
      { name: 'art · strands', svg: strandLayer(phase) },
    ],
  };
}

// counts + geometry, for the local check and the report
function metrics(phase = 'Day') {
  const strands = V4.strands(phase);
  let visible = 0, minY = 1e9, orbs = 0;
  const r = rng(911);
  for (const s of strands) {
    const sp = span(t => cubicAt(s.c, t), 64);
    if (!sp) continue;
    visible++;
    for (let k = 0; k <= 30; k++) minY = Math.min(minY, cubicAt(s.c, k / 30)[1]);
    r(); r();
    orbs++;
  }
  return { strands: strands.length, visible, orbs, minY, heightPct: (PH - minY) / PH * 100 };
}

module.exports = { CARD_W, CARD_H, CARD_R, PAD, PW, PH, PR, COLS, DAY, STOPS, BGC, tileLayers, metrics };

if (require.main === module) {
  const t = tileLayers(process.argv[2] || 'Day');
  const m = metrics(process.argv[2] || 'Day');
  console.log(JSON.stringify({
    cardFill: t.cardFill, panel: t.panel,
    stops: STOPS.map(s => `${s.c} @ ${s.o}`),
    metrics: m,
    layers: t.layers.map(l => ({ name: l.name, bytes: l.svg.length, paths: (l.svg.match(/<path /g) || []).length })),
  }, null, 1));
}
