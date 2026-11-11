// gen-v7.cjs — Faithful v7: v4/v6 fan geometry (gentle bend, 68% height, 560
// strands) with v3's sizing (1px strokes at .45/.36/.28, 1.2–1.8px orb radii,
// white at .95), and the site page's Day background instead of a pastel mix.
//
// Background source of truth — Figma "Design" page, section 121:1349
// "Day · breakpoints" → frame 121:2003 "homepage/day · 1440" → child 121:2004
// "bg / stripe gradient":
//   GRADIENT_LINEAR, vertical (handle 0.5,0 → 0.5,1)
//     #F8FAFD @ 0 · #F8FAFD @ 0.70 · #F3F7FD @ 0.82 · #ECF4FD @ 1.00
//   blob left 121:2005  #60A8E2 @ 6%, ellipse 900x420 at (-200, 860) of 1440x1024, blur 180
//   blob right 121:2006 #0071C1 @ 6%, ellipse 1000x460 at ( 700, 820) of 1440x1024, blur 180
// src/ implements no page glow yet: body is flat --surface (globals.css:232-236).
const V3 = require('./gen-v3.cjs');
const V4 = require('./gen-v4.cjs');
const G = require('./gen.cjs');
const { PHASES } = G;
const { CARD_W, CARD_H, CARD_R, PAD, PW, PH, PR } = V3;
const { COLS } = V3;

const f = n => Math.round(n * 100) / 100;
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

const CX = PW / 2, CY = PH + 8;      // fan origin

/* ---------- page background (Day) ---------- */
const PAGE_W = 1440, PAGE_H = 1024;
const SX = PW / PAGE_W, SY = PH / PAGE_H;         // page → panel scale
const BG_STOPS = [
  { o: 0.00, c: '#F8FAFD' },   // 121:2004 stop 0
  { o: 0.70, c: '#F8FAFD' },   // 121:2004 stop 0.70 (flat neutral to 70%)
  { o: 0.82, c: '#F3F7FD' },   // 121:2004 stop 0.82
  { o: 1.00, c: '#ECF4FD' },   // 121:2004 stop 1.00 (barely tinted bottom edge)
];
const PAGE_BLOBS = [
  { fill: '#60A8E2', a: 0.06, x: -200, y: 860, w: 900, h: 420 },   // 121:2005
  { fill: '#0071C1', a: 0.06, x: 700, y: 820, w: 1000, h: 460 },   // 121:2006
];
const BLUR = Math.round(180 * SY);   // 180 on the page → 43 in the panel

function bgLayer() {
  return svgDoc(`<linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${PH}">
${BG_STOPS.map(s => `<stop offset="${s.o}" stop-color="${s.c}"/>`).join('')}
</linearGradient>`,
    `<rect width="${PW}" height="${PH}" rx="${PR}" fill="url(#bg)"/>`);
}

function glowLayer() {
  const els = PAGE_BLOBS.map(b =>
    `<ellipse cx="${f((b.x + b.w / 2) * SX)}" cy="${f((b.y + b.h / 2) * SY)}" rx="${f(b.w / 2 * SX)}" ry="${f(b.h / 2 * SY)}" fill="${b.fill}" fill-opacity="${b.a}"/>`).join('\n');
  return svgDoc('', els);
}

/* ---------- strands: v4 geometry, v3 sizing ---------- */
const MASK_RX = 400, MASK_RY = 190;   // dome-shaped mask, so every tip fades alike
const MASK_STOPS = [
  { o: 0.00, a: 1 },
  { o: 0.52, a: 1 },
  { o: 0.72, a: 0.86 },
  { o: 0.88, a: 0.44 },
  { o: 1.00, a: 0 },
];
const maskAt = (x, y) => {
  const u = Math.hypot((x - CX) / MASK_RX, (y - CY) / MASK_RY);
  if (u <= MASK_STOPS[1].o) return 1;
  for (let i = 1; i < MASK_STOPS.length - 1; i++) {
    const a = MASK_STOPS[i], b = MASK_STOPS[i + 1];
    if (u <= b.o) return a.a + (b.a - a.a) * (u - a.o) / (b.o - a.o);
  }
  return 0;
};

function strandLayer(phase) {
  const p = PHASES[phase];
  const r = rng(911);
  const keys = [0.45, 0.36, 0.28];        // v3 stroke opacities
  const groups = [[], [], []];
  const dots = [];
  for (const s of V4.strands(phase)) {
    const pos = t => cubicAt(s.c, t);
    const sp = span(pos, 64);
    if (!sp) continue;
    const a = pos(sp[0]);
    const gi = r() < 0.34 ? 0 : (r() < 0.515 ? 1 : 2);
    groups[gi].push(`M${f(a[0])},${f(a[1])}${cubicSeg(s.c, sp[0], sp[1])}`);
    r();                                   // v3's 72% dot gate, kept for parity
    const dr = 1.2 + r() * 0.6;            // v3 orb radius: 1.2–1.8 (dia 2.4–3.6)
    dots.push({ x: s.tip[0], y: s.tip[1], r: dr });
  }
  const body = keys.map((k, i) => groups[i].length
    ? `<path d="${groups[i].join('')}" fill="none" stroke="${p.strand}" stroke-opacity="${k}" stroke-width="1" stroke-linecap="round"/>` : '').join('\n');
  // one mask over strands and orbs: a dome-shaped falloff centred on the fan
  // origin, so a tip at the top and a tip at the side dissolve by the same rule
  const defs = `<radialGradient id="fg" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"
  gradientTransform="translate(${f(CX)} ${f(CY)}) scale(${MASK_RX} ${MASK_RY})">
${MASK_STOPS.map(s => `<stop offset="${s.o}" stop-color="#ffffff" stop-opacity="${s.a}"/>`).join('')}
</radialGradient>
<mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${PW}" height="${PH}">
<rect width="${PW}" height="${PH}" fill="url(#fg)"/>
</mask>`;
  const dotEl = dots.length ? `<path d="${dotsPath(dots)}" fill="${p.dot}" opacity="0.95"/>` : '';
  return svgDoc(defs, `<g mask="url(#fade)">${body}\n${dotEl}</g>`);
}

function tileLayers(phase) {
  return {
    cardFill: V3.tileLayers(phase).cardFill,
    panel: V3.tileLayers(phase).panel,
    layers: [
      { name: 'art · bg', svg: bgLayer() },
      { name: 'art · glow', svg: glowLayer(), blur: BLUR },
      { name: 'art · strands', svg: strandLayer(phase) },
    ],
  };
}

function metrics(phase = 'Day') {
  const r = rng(911);
  let visible = 0, minY = 1e9, orbs = 0;
  const maskTip = [];
  for (const s of V4.strands(phase)) {
    const sp = span(t => cubicAt(s.c, t), 64);
    if (!sp) continue;
    visible++;
    for (let k = 0; k <= 30; k++) minY = Math.min(minY, cubicAt(s.c, k / 30)[1]);
    r(); r();
    orbs++;
    maskTip.push(maskAt(s.tip[0], s.tip[1]));
  }
  maskTip.sort((a, b) => a - b);
  const q = t => maskTip[Math.floor(t * (maskTip.length - 1))];
  return {
    strands: 560, visible, orbs, minY, heightPct: (PH - minY) / PH * 100,
    maskTip: { min: q(0), median: q(0.5), max: q(1) },
  };
}

module.exports = { CARD_W, CARD_H, CARD_R, PAD, PW, PH, PR, COLS, BG_STOPS, PAGE_BLOBS, BLUR, MASK_STOPS, MASK_RX, MASK_RY, tileLayers, metrics, maskAt, CX, CY };

if (require.main === module) {
  const t = tileLayers(process.argv[2] || 'Day');
  console.log(JSON.stringify({
    cardFill: t.cardFill, panel: t.panel, blur: BLUR,
    bgStops: BG_STOPS.map(s => `${s.c}@${s.o}`),
    metrics: metrics(process.argv[2] || 'Day'),
    layers: t.layers.map(l => ({ name: l.name, bytes: l.svg.length })),
  }, null, 1));
}
