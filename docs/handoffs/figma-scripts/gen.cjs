// Generates Play-card strand artworks as SVG. One tile = 849x276.
const fs = require('fs');
const path = require('path');

const W = 849, H = 276, RAD = 12;

// Palette sampled from the Design page: surface-container of each phase collection
// (Dawn 131:10675 / Day 102:1708 / Dusk 131:10697 / Night 102:1707) plus the
// horizon-glow gradients + accent blobs used by the phase frames (121:2004,
// 121:4483, 121:5722, 121:3244) and the phase primary.
const PHASES = {
  Dawn: {
    surface: '#F2F2F2', g1: '#DDBDF8', g2: '#C79BF0', tint: '#C79BF0', band: '#A974D8', aScale: 0.5,
    strand: '#FFFFFF', dot: '#FFFFFF', bloom: '#FFFFFF', bloomA: 0.45,
    silkBg: '#F2F2F2', ribbon: ['#F0DFFB', '#D19EF9', '#B478F0'], sheen: '#FFFFFF',
  },
  Day: {
    surface: '#F2F2F2', g1: '#A9CAEA', g2: '#6FA3DC', tint: '#6FA3DC', band: '#3687D9', aScale: 0.5,
    strand: '#FFFFFF', dot: '#FFFFFF', bloom: '#FFFFFF', bloomA: 0.45,
    silkBg: '#F2F2F2', ribbon: ['#D5E7F8', '#3687D9', '#1F6FBF'], sheen: '#FFFFFF',
  },
  Dusk: {
    surface: '#F2F2F2', g1: '#F6DCC0', g2: '#EFBE8C', tint: '#EFBE8C', band: '#DE9750', aScale: 0.5,
    strand: '#FFFFFF', dot: '#FFFFFF', bloom: '#FFFFFF', bloomA: 0.45,
    silkBg: '#F2F2F2', ribbon: ['#FBEEDF', '#F0B075', '#D98B43'], sheen: '#FFFFFF',
  },
  Night: {
    surface: '#262626', g1: '#1C1C1E', g2: '#131316', tint: '#131316', band: '#B85343', aScale: 1,
    strand: '#FFF2EA', dot: '#FFFFFF', bloom: '#FFE8DC', bloomA: 0.5,
    silkBg: '#262626', ribbon: ['#6E3A2E', '#FD6850', '#FF9A82'], sheen: '#FFF0E8',
  },
};

/* ---------- colour + number helpers ---------- */
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const hx = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const darken = (h, k) => hx(rgb(h).map(v => v * k));
const mixc = (a, b, t) => hx(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
const f = n => Math.round(n * 100) / 100;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ---------- rounded-rect clipping ---------- */
function inside(x, y) {
  const nx = Math.min(Math.max(x, RAD), W - RAD);
  const ny = Math.min(Math.max(y, RAD), H - RAD);
  return (x - nx) * (x - nx) + (y - ny) * (y - ny) <= RAD * RAD + 1e-9;
}
// visible parameter span of p(t) for t in [0,1]; null when fully outside
function span(p, steps = 96) {
  let enter = -1, exit = -1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, q = p(t);
    if (inside(q[0], q[1])) { if (enter < 0) enter = t; exit = t; }
    else if (enter >= 0) break;
  }
  if (enter < 0) return null;
  // refine both edges
  let lo = Math.max(0, enter - 1 / steps), hi = enter;
  if (enter > 0) for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; inside(p(m)[0], p(m)[1]) ? hi = m : lo = m; enter = hi; }
  let e0 = exit, e1 = Math.min(1, exit + 1 / steps);
  if (exit < 1) for (let k = 0; k < 22; k++) { const m = (e0 + e1) / 2; inside(p(m)[0], p(m)[1]) ? e0 = m : e1 = m; exit = e0; }
  if (exit - enter < 0.004) return null;
  return [enter, exit];
}
function splitQuad(p0, c, p1, t) {
  const a = lerp(p0, c, t), b = lerp(c, p1, t), m = lerp(a, b, t);
  return { l: [p0, a, m], r: [m, b, p1] };
}
function quadSeg(p0, c, p1, t0, t1) {
  let s = [p0, c, p1];
  if (t1 < 1) s = splitQuad(s[0], s[1], s[2], t1).l;
  const u = t1 <= 0 ? 0 : t0 / t1;
  if (u > 0) s = splitQuad(s[0], s[1], s[2], u).r;
  return `Q${f(s[1][0])},${f(s[1][1])} ${f(s[2][0])},${f(s[2][1])}`;
}
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

/* ---------- shared layers ---------- */
function bgFill(phase) {
  const p = PHASES[phase];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}">
<stop offset="0" stop-color="${p.surface}"/><stop offset="0.10" stop-color="${p.g1}"/><stop offset="1" stop-color="${p.g2}"/>
</linearGradient></defs>
<rect width="${W}" height="${H}" rx="${RAD}" fill="url(#bg)"/>
</svg>`;
}

function horizonLayer(phase, opts = {}) {
  const p = PHASES[phase];
  const base = p.band;
  const bandH = opts.bandH || 40;
  const ox = (opts.ox ?? W / 2), oy = (opts.oy ?? 296);
  const bloomR = opts.bloomR ?? 180, bloomA = opts.bloomA ?? p.bloomA;
  const horizon = H - bandH;
  const corner = `M0,${H - RAD}V${horizon}H${W}V${H - RAD}A${RAD},${RAD} 0 0 1 ${W - RAD},${H}H${RAD}A${RAD},${RAD} 0 0 1 0,${H - RAD}Z`;
  const feather = Math.min(34, bandH * 0.8);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<radialGradient id="bloom" gradientUnits="userSpaceOnUse" cx="${f(ox)}" cy="${f(oy)}" r="${bloomR}">
<stop offset="0" stop-color="${p.bloom}" stop-opacity="${bloomA}"/>
<stop offset="0.22" stop-color="${p.bloom}" stop-opacity="${f(bloomA * 0.55)}"/>
<stop offset="0.55" stop-color="${p.bloom}" stop-opacity="${f(bloomA * 0.16)}"/>
<stop offset="1" stop-color="${p.bloom}" stop-opacity="0"/>
</radialGradient>
${bandH ? `<linearGradient id="hor" gradientUnits="userSpaceOnUse" x1="0" y1="${f(horizon - feather)}" x2="0" y2="${horizon}">
<stop offset="0" stop-color="${base}" stop-opacity="0"/><stop offset="1" stop-color="${base}" stop-opacity="1"/>
</linearGradient>` : ''}
</defs>
${bandH ? `<rect x="0" y="${f(horizon - feather)}" width="${W}" height="${f(feather)}" fill="url(#hor)"/>
<path d="${corner}" fill="${base}"/>` : ''}
<rect width="${W}" height="${H}" fill="url(#bloom)"/>
</svg>`;
}

function dotsPath(dots) {
  return dots.map(d => `M${f(d.x - d.r)},${f(d.y)}a${f(d.r)},${f(d.r)} 0 1,0 ${f(2 * d.r)},0a${f(d.r)},${f(d.r)} 0 1,0 ${f(-2 * d.r)},0Z`).join('');
}

function strandSvg(paths, dots, extra = '', phase) {
  const p = PHASES[phase] || PHASES.Day;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${paths.map(x => `<path d="${x.d}" fill="none" stroke="${x.c || p.strand}" stroke-opacity="${x.o}" stroke-width="${x.w}" stroke-linecap="round"/>`).join('\n')}
${dots && dots.length ? `<path d="${dotsPath(dots)}" fill="${p.dot}" opacity="${dots[0].o ?? 0.95}"/>` : ''}
${extra}
</svg>`;
}

/* ---------- 1. faithful fan ---------- */
function faithful(phase, o = {}) {
  const r = rng(o.seed || 7);
  const count = o.count || 560;
  const spread = (o.spread || 85) * Math.PI / 180;
  const cx = W / 2 + (o.dx || 0), cy = 296;
  const paths = [], dots = [];
  const groups = { 0.9: [], 0.72: [], 0.55: [] };
  for (let i = 0; i < count; i++) {
    let u = (i + r() * 0.9) / count * 2 - 1;
    u = Math.sign(u) * Math.pow(Math.abs(u), 1.05);
    const th = u * spread + (r() - 0.5) * 0.012;
    const dx = Math.sin(th), dy = -Math.cos(th);
    let L = 1e9;
    if (dy < 0) L = Math.min(L, (0 - cy) / dy);
    if (dx > 0) L = Math.min(L, (W - cx) / dx); else if (dx < 0) L = Math.min(L, (0 - cx) / dx);
    const reach = L * (0.86 + 0.18 * r());
    const p = t => [cx + dx * reach * t, cy + dy * reach * t];
    const s = span(p, 40);
    if (!s) continue;
    const a = p(s[0]), b = p(s[1]);
    const g = r() < 0.34 ? 0.9 : r() < 0.68 ? 0.72 : 0.55;
    groups[g].push(`M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}`);
    if (r() < (o.dotEvery ?? 0.9)) {
      const dr = 1.2 + r() * 0.6;
      if (inside(b[0], b[1])) dots.push({ x: b[0], y: b[1], r: dr * (o.dotScale || 1), o: 1 });
    }
  }
  let k = 0;
  for (const g of Object.keys(groups)) {
    paths.push({ d: groups[g].join(''), o: (+g * (o.opacityMul ?? 1) * (o.aScale ?? 1)).toFixed(2), w: o.stroke || 1 });
    k++;
  }
  return { paths, dots };
}

/* ---------- 2. fibre lamp ---------- */
function fibreLamp(phase, o = {}) {
  const r = rng(o.seed || 21);
  const count = o.count || 210;
  const cx = W / 2 + (o.dx || 0), cy = 292;
  const paths = [], dots = [];
  const groups = { 0.92: [], 0.74: [], 0.56: [] };
  for (let i = 0; i < count; i++) {
    let u = (i + r()) / count * 2 - 1;
    u = Math.sign(u) * Math.pow(Math.abs(u), 1.22);
    const D = u * 432;
    const edge = Math.abs(D) / 432;
    const yA = 14 + 104 * Math.pow(edge, 0.8) + (r() - 0.5) * 30;
    const A = [cx + D, yA];
    const droop = 14 + 52 * r() + 26 * edge;
    const E = [A[0] + Math.sign(D || 1) * (5 + 20 * r()), A[1] + droop];
    const P0 = [cx, cy];
    const P1 = [P0[0] + D * 0.07, P0[1] - (P0[1] - yA) * 0.78];
    const P2 = [A[0] - D * 0.26, yA];
    const c = [P0, P1, P2, E];
    const p = t => cubicAt(c, t);
    const s = span(p, 64);
    if (!s) continue;
    const g = r() < 0.3 ? 0.92 : r() < 0.66 ? 0.74 : 0.56;
    groups[g].push(`M${f(P0[0])},${f(P0[1])}${cubicSeg(c, s[0], s[1])}`);
    if (s[1] > 0.94 && inside(E[0], E[1])) {
      const tw = r() < 0.08;
      dots.push({ x: E[0], y: E[1], r: tw ? 2.5 + r() * 0.9 : 1.6 + r() * 0.5, o: tw ? 1 : 0.85 });
    }
  }
  const keys = Object.keys(groups);
  const normal = dots.filter(d => d.r < 2.5), tw = dots.filter(d => d.r >= 2.5);
  const pathsOut = keys.map(g => ({ d: groups[g].join(''), o: (+g * (o.opacityMul ?? 1) * (o.aScale ?? 1)).toFixed(2), w: o.stroke || 1 }));
  let extra = '';
  if (normal.length) extra += `<path d="${dotsPath(normal)}" fill="${PHASES[phase].dot}" opacity="0.9"/>`;
  if (tw.length) extra += `<path d="${dotsPath(tw)}" fill="${PHASES[phase].dot}" opacity="1"/>`;
  return { paths: pathsOut, dots: [], extra };
}

/* ---------- 3. depth: three fans ---------- */
function depthLayers(phase, o = {}) {
  const cfg = [
    { dx: 0, count: 400, spread: 96, opacityMul: 0.15 / 0.9, dotEvery: 0.15, blur: 4, w: 1 },
    { dx: 6, count: 240, spread: 74, opacityMul: 0.36 / 0.9, dotEvery: 0.3, w: 1 },
    { dx: 12, count: 100, spread: 48, opacityMul: 1.0, dotEvery: 0.95, w: 1.3, dotScale: 1.2 },
  ];
  return cfg.map((c, i) => {
    const art = faithful(phase, { aScale: PHASES[phase].aScale, seed: 100 + i * 13, ...c });
    return { ...art, name: ['fan · back', 'fan · mid', 'fan · front'][i], blur: c.blur };
  });
}

/* ---------- 4. silk wave ---------- */
function silk(phase, o = {}) {
  const p = PHASES[phase];
  const top = p.ribbon[0], mid = p.ribbon[1], base = p.ribbon[2];
  const bgc = p.silkBg;

  const P = [[-110, 352], [160, 214], [470, 58], [962, 96]];
  const bez = t => cubicAt(P, t);
  const dbez = t => {
    const a = 1 - t;
    return [0, 1].map(i => 3 * a * a * (P[1][i] - P[0][i]) + 6 * a * t * (P[2][i] - P[1][i]) + 3 * t * t * (P[3][i] - P[2][i]));
  };
  const WKEY = [[0, 142], [0.28, 198], [0.56, 158], [0.72, 118], [1, 158]];
  const width = t => {
    for (let i = 0; i < WKEY.length - 1; i++) {
      const [t0, w0] = WKEY[i], [t1, w1] = WKEY[i + 1];
      if (t <= t1 || i === WKEY.length - 2) {
        const x = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
        return w0 + (w1 - w0) * (x * x * (3 - 2 * x));
      }
    }
  };
  const normalAt = t => {
    const d = dbez(t), len = Math.hypot(d[0], d[1]) || 1;
    return [d[1] / len, -d[0] / len]; // +u points to the upper edge
  };

  // solid ribbon body: the outline of the swept band, so the fill reads as a surface
  const STEPS = 96;
  const tEdge = [], bEdge = [];
  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS, c = bez(t), n = normalAt(t), w = width(t) / 2;
    tEdge.push([c[0] + n[0] * w, c[1] + n[1] * w]);
    bEdge.push([c[0] - n[0] * w, c[1] - n[1] * w]);
  }
  const outline = `M${tEdge.map(q => `${f(q[0])},${f(q[1])}`).join('L')}L${bEdge.slice().reverse().map(q => `${f(q[0])},${f(q[1])}`).join('L')}Z`;

  // fine fibres over the body: slight tonal alternation reads as brushed silk
  const NF = 300, FSTEPS = 46;
  const dfib = [], lfib = [];
  for (let i = 0; i < NF; i++) {
    const u = i / (NF - 1) - 0.5;
    const pts = [];
    for (let s = 0; s <= FSTEPS; s++) {
      const t = s / FSTEPS, c = bez(t), n = normalAt(t), w = width(t);
      pts.push([c[0] + n[0] * u * w, c[1] + n[1] * u * w]);
    }
    const d = pts.map((q, j) => `${j ? 'L' : 'M'}${f(q[0])},${f(q[1])}`).join('');
    if (i % 3 === 0) dfib.push(d);
    if (i % 7 === 0) lfib.push(d);
  }
  // cross-ribbon shading, built from soft bands that follow the ribbon
  const shade = u => {
    if (u < -0.05) { const t = Math.min(1, (-u - 0.05) / 0.45); return { c: '#000000', o: 0.21 * Math.pow(t, 1.05) }; }
    const t = Math.min(1, (u + 0.05) / 0.34);
    return { c: '#ffffff', o: u < 0.34 ? 0.14 * t : 0.14 * Math.max(0.35, 1 - (u - 0.34) / 0.22) };
  };
  const bands = [];
  for (let b = 0; b < 12; b++) {
    const lo = -0.5 + b / 12, hi = -0.5 + (b + 1) / 12;
    const s = shade((lo + hi) / 2);
    if (s.o < 0.006) continue;
    const pts = [];
    for (let st = 0; st <= FSTEPS; st++) {
      const t = st / FSTEPS, c = bez(t), n = normalAt(t), w = width(t);
      pts.push([c[0] + n[0] * lo * w, c[1] + n[1] * lo * w]);
    }
    bands.push({ d: pts.map((q, j) => `${j ? 'L' : 'M'}${f(q[0])},${f(q[1])}`).join(''), c: s.c, o: s.o.toFixed(3), w: 2 });
  }

  // specular sheen along the fold (upper edge), plus a soft glow under it
  const sheenPts = (u) => {
    const out = [];
    for (let s = 0; s <= FSTEPS; s++) {
      const t = s / FSTEPS, c = bez(t), n = normalAt(t), w = width(t);
      out.push([c[0] + n[0] * u * w, c[1] + n[1] * u * w]);
    }
    return out;
  };
  const pStr = pts => pts.map((q, j) => `${j ? 'L' : 'M'}${f(q[0])},${f(q[1])}`).join('');
  const sheenLine = pStr(sheenPts(0.455));
  const sheenSoft = pStr(sheenPts(0.40));
  const crease = pStr(sheenPts(-0.12));

  const body = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="rb" gradientUnits="userSpaceOnUse" x1="30" y1="300" x2="890" y2="80">
<stop offset="0" stop-color="${top}"/><stop offset="0.42" stop-color="${mid}"/><stop offset="0.86" stop-color="${base}"/><stop offset="1" stop-color="${mixc(base, '#ffffff', 0.18)}"/>
</linearGradient>
</defs>
<rect width="${W}" height="${H}" rx="${RAD}" fill="${bgc}"/>
<path d="${outline}" fill="url(#rb)"/>
<path d="${dfib.join('')}" fill="none" stroke="#000000" stroke-opacity="0.05" stroke-width="1"/>
<path d="${lfib.join('')}" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1"/>
${bands.map(b => `<path d="${b.d}" fill="none" stroke="${b.c}" stroke-opacity="${b.o}" stroke-width="${b.w}"/>`).join('\n')}
</svg>`;

  const sheen = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="sh" gradientUnits="userSpaceOnUse" x1="300" y1="215" x2="880" y2="30">
<stop offset="0" stop-color="${p.sheen}" stop-opacity="0"/>
<stop offset="0.34" stop-color="${p.sheen}" stop-opacity="0.55"/>
<stop offset="0.62" stop-color="${p.sheen}" stop-opacity="0.95"/>
<stop offset="0.86" stop-color="${p.sheen}" stop-opacity="0.4"/>
<stop offset="1" stop-color="${p.sheen}" stop-opacity="0"/>
</linearGradient>
<linearGradient id="cr" gradientUnits="userSpaceOnUse" x1="330" y1="230" x2="880" y2="40">
<stop offset="0" stop-color="#000000" stop-opacity="0"/>
<stop offset="0.3" stop-color="#000000" stop-opacity="0.07"/>
<stop offset="0.58" stop-color="#000000" stop-opacity="0.10"/>
<stop offset="0.85" stop-color="#000000" stop-opacity="0.04"/>
<stop offset="1" stop-color="#000000" stop-opacity="0"/>
</linearGradient>
</defs>
<path d="${sheenSoft}" fill="none" stroke="url(#sh)" stroke-opacity="0.22" stroke-width="12" stroke-linecap="round"/>
<path d="${sheenLine}" fill="none" stroke="url(#sh)" stroke-opacity="1" stroke-width="3.2" stroke-linecap="round"/>
</svg>`;
  return { body, sheen, bgc };
}

/* ---------- assemblies ---------- */
const DIRS = ['Faithful', 'Fibre lamp', 'Depth', 'Silk wave'];
const COLS = ['Dawn', 'Day', 'Dusk', 'Night'];

function tileLayers(dir, phase) {
  const p = PHASES[phase];
  const base = p.surface;
  if (dir === 'Silk wave') {
    const s = silk(phase);
    return {
      fill: s.bgc,
      layers: [
        { name: 'silk ribbon', svg: s.body },
        { name: 'silk sheen', svg: s.sheen, blur: 1.2 },
      ],
    };
  }
  const bg = bgFill(phase);
  const hz = horizonLayer(phase);
  if (dir === 'Faithful') {
    const art = faithful(phase, { seed: 31, aScale: PHASES[phase].aScale });
    return { fill: base, layers: [{ name: 'bg', svg: bg }, { name: 'strands', svg: strandSvg(art.paths, art.dots, '', phase) }, { name: 'horizon', svg: hz }] };
  }
  if (dir === 'Fibre lamp') {
    const art = fibreLamp(phase, { seed: 44, aScale: PHASES[phase].aScale });
    return { fill: base, layers: [{ name: 'bg', svg: bg }, { name: 'fibres', svg: strandSvg(art.paths, [], art.extra, phase) }, { name: 'horizon', svg: hz }] };
  }
  // depth
  const d = depthLayers(phase);
  return {
    fill: base,
    layers: [
      { name: 'bg', svg: bg },
      { name: 'fan · back', svg: strandSvg(d[0].paths, d[0].dots, '', phase), blur: 4 },
      { name: 'fan · mid', svg: strandSvg(d[1].paths, d[1].dots, '', phase) },
      { name: 'fan · front', svg: strandSvg(d[2].paths, d[2].dots, '', phase) },
      { name: 'horizon', svg: hz },
    ],
  };
}

module.exports = { W, H, RAD, PHASES, DIRS, COLS, tileLayers };

if (require.main === module) {
  const dir = process.argv[2] || 'Faithful';
  const phase = process.argv[3] || 'Day';
  const out = process.argv[4];
  const t = tileLayers(dir, phase);
  const layers = t.layers.map(l => ({ ...l }));
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, layers[0].svg);
    console.log('wrote', out, layers[0].svg.length, 'bytes');
  }
  console.log(JSON.stringify({ fill: t.fill, layers: layers.map(l => ({ name: l.name, bytes: l.svg.length, blur: l.blur || 0 })) }, null, 1));
}
