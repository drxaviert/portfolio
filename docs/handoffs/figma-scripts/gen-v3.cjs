// gen-v3.cjs — Faithful v3: the v2 fan inside an inset art panel, shortened and
// fading out toward the top. 849x276 card, 16px inset, 817x244 panel, radius 8.
const G = require('./gen.cjs');
const { PHASES, COLS } = G;

const CARD_W = 849, CARD_H = 276, CARD_R = 12;
const PAD = 16;
const PW = CARD_W - PAD * 2, PH = CARD_H - PAD * 2, PR = 8;

const f = n => Math.round(n * 100) / 100;
const rng = seed => {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
};
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
  if (enter > 0) for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; inside(p(m)[0], p(m)[1]) ? hi = m : lo = m; enter = hi; }
  let e0 = exit, e1 = Math.min(1, exit + 1 / steps);
  if (exit < 1) for (let k = 0; k < 22; k++) { const m = (e0 + e1) / 2; inside(p(m)[0], p(m)[1]) ? e0 = m : e1 = m; exit = e0; }
  if (exit - enter < 0.004) return null;
  return [enter, exit];
}
const dotsPath = dots => dots.map(d =>
  `M${f(d.x - d.r)},${f(d.y)}a${f(d.r)},${f(d.r)} 0 1,0 ${f(2 * d.r)},0a${f(d.r)},${f(d.r)} 0 1,0 ${f(-2 * d.r)},0Z`).join('');

const svgDoc = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}"><defs>${defs}</defs>${body}</svg>`;

// the fan is shortened to ~70% of the panel height; the tip locus is a
// superellipse matched to the panel, so the fan keeps v2's width and no tips
// land on a single horizontal cap line
const CY = PH + 18;
const LOCUS_RX = 402, LOCUS_RY = 186, LOCUS_N = 2.5;
function locusRadius(th) {
  const a = Math.abs(Math.sin(th)) / LOCUS_RX;
  const b = Math.abs(Math.cos(th)) / LOCUS_RY;
  return Math.pow(Math.pow(a, LOCUS_N) + Math.pow(b, LOCUS_N), -1 / LOCUS_N);
}

function bgLayer(phase) {
  const p = PHASES[phase];
  // plain open phase gradient: no surface-coloured stop at the top, which used
  // to read as a pale strip along the panel's top edge
  return svgDoc(`<linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${PH}">
<stop offset="0" stop-color="${p.g1}"/><stop offset="1" stop-color="${p.g2}"/>
</linearGradient>`, `<rect width="${PW}" height="${PH}" rx="${PR}" fill="url(#bg)"/>`);
}

// same feathered horizon as v2, sized to the panel
function glowLayer(phase) {
  const p = PHASES[phase];
  const night = phase === 'Night';
  const peak = night ? 0.24 : 0.30;
  const bloomA = night ? 0.30 : 0.24;
  const top = PH - 34, bot = PH - 4, hh = bot - top;
  return svgDoc(`<linearGradient id="hz" gradientUnits="userSpaceOnUse" x1="0" y1="${f(top)}" x2="0" y2="${f(bot)}">
<stop offset="0" stop-color="${p.band}" stop-opacity="0"/>
<stop offset="0.22" stop-color="${p.band}" stop-opacity="${f(peak * 0.30)}"/>
<stop offset="0.50" stop-color="${p.band}" stop-opacity="${f(peak)}"/>
<stop offset="0.74" stop-color="${p.band}" stop-opacity="${f(peak * 0.26)}"/>
<stop offset="1" stop-color="${p.band}" stop-opacity="0"/>
</linearGradient>
<radialGradient id="bl" gradientUnits="userSpaceOnUse" cx="${f(PW / 2)}" cy="${f(PH + 46)}" r="200">
<stop offset="0" stop-color="${p.bloom}" stop-opacity="${f(bloomA)}"/>
<stop offset="0.26" stop-color="${p.bloom}" stop-opacity="${f(bloomA * 0.42)}"/>
<stop offset="0.58" stop-color="${p.bloom}" stop-opacity="${f(bloomA * 0.11)}"/>
<stop offset="1" stop-color="${p.bloom}" stop-opacity="0"/>
</radialGradient>`,
    `<rect width="${PW}" height="${PH}" rx="${PR}" fill="url(#bl)"/>
<rect x="0" y="${f(top)}" width="${PW}" height="${f(hh)}" fill="url(#hz)"/>`);
}

// v2 fan geometry (seed, count, spread, opacities). Tips follow the superellipse
// dome with a wide per-strand length jitter, so lengths are staggered and no
// two tips line up; dots are dropped near the panel sides and the bottom.
function fanArt(phase) {
  const r = rng(31);
  const count = 560, spread = 85 * Math.PI / 180;
  const cx = PW / 2, cy = CY;
  const ops = [0.45, 0.36, 0.28];
  const buckets = [[], [], []];
  const dots = [];
  for (let i = 0; i < count; i++) {
    let u = (i + r() * 0.9) / count * 2 - 1;
    u = Math.sign(u) * Math.pow(Math.abs(u), 1.05);
    const th = u * spread + (r() - 0.5) * 0.012;
    const dx = Math.sin(th), dy = -Math.cos(th);
    const Ltop = dy < 0 ? (0 - cy) / dy : 1e9;
    const Lside = dx > 0 ? (PW - cx) / dx : dx < 0 ? (0 - cx) / dx : 1e9;
    const reach = Math.min(Math.min(Ltop, Lside), locusRadius(th) * (0.65 + 0.35 * r()));
    const pos = t => [cx + dx * reach * t, cy + dy * reach * t];
    const s = span(pos, 44);
    if (!s) continue;
    const a = pos(s[0]), b = pos(s[1]);
    const g = r() < 0.34 ? 0 : (r() < 0.515 ? 1 : 2);
    buckets[g].push(`M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}`);
    // keep dots off the side edges and out of the bottom glow
    const dotZone = b[0] > 40 && b[0] < PW - 40 && b[1] > 10 && b[1] < PH * 0.86;
    if (r() < 0.72 && dotZone) dots.push({ x: b[0], y: b[1], r: 1.2 + r() * 0.6 });
  }
  return { paths: buckets.map((arr, i) => ({ d: arr.join(''), o: ops[i] })), dots };
}

function strandLayer(phase) {
  const p = PHASES[phase];
  const art = fanArt(phase);
  const body = art.paths.filter(x => x.d).map(x =>
    `<path d="${x.d}" fill="none" stroke="${p.strand}" stroke-opacity="${x.o}" stroke-width="1" stroke-linecap="round"/>`).join('\n');
  const dots = art.dots.length ? `<path d="${dotsPath(art.dots)}" fill="${p.dot}" opacity="0.95"/>` : '';
  // vertical fade: nothing at the top, full strength from ~72% height down
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
  return svgDoc(defs, `<g mask="url(#fade)">${body}\n${dots}</g>`);
}

function tileLayers(phase) {
  return {
    cardFill: PHASES[phase].surface,
    panel: { w: PW, h: PH, r: PR, x: PAD, y: PAD },
    layers: [
      { name: 'art · bg', svg: bgLayer(phase) },
      { name: 'art · glow', svg: glowLayer(phase), blur: 5 },
      { name: 'art · strands', svg: strandLayer(phase) },
    ],
  };
}

module.exports = { CARD_W, CARD_H, CARD_R, PAD, PW, PH, PR, LOCUS_RX, LOCUS_RY, COLS, tileLayers };

if (require.main === module) {
  const t = tileLayers(process.argv[2] || 'Day');
  console.log(JSON.stringify({ cardFill: t.cardFill, panel: t.panel,
    layers: t.layers.map(l => ({ name: l.name, bytes: l.svg.length, paths: (l.svg.match(/<path /g) || []).length })) }, null, 1));
}
