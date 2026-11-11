// gen-v2.cjs — v2 revisions of the Play card directions (soft horizon glow,
// three-layer depth, brushed-silk ribbon). Each layer is a full 849x276 SVG
// wrapped in a rounded-rect clip so nothing spills past the card corners.
// Colours come from gen.cjs PHASES (single source of truth).
const G = require('./gen.cjs');
const { W, H, RAD, PHASES, COLS } = G;

/* ---------- colour + number helpers ---------- */
const f = n => Math.round(n * 100) / 100;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const hx = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mixc = (a, b, t) => hx(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ---------- rounded-tile clipping ---------- */
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
  let lo = Math.max(0, enter - 1 / steps), hi = enter;
  if (enter > 0) for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; inside(p(m)[0], p(m)[1]) ? hi = m : lo = m; enter = hi; }
  let e0 = exit, e1 = Math.min(1, exit + 1 / steps);
  if (exit < 1) for (let k = 0; k < 22; k++) { const m = (e0 + e1) / 2; inside(p(m)[0], p(m)[1]) ? e0 = m : e1 = m; exit = e0; }
  if (exit - enter < 0.004) return null;
  return [enter, exit];
}

const CLIP = `<defs><clipPath id="tile"><rect x="0" y="0" width="${W}" height="${H}" rx="${RAD}"/></clipPath></defs>`;
function doc(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${CLIP}<defs>${defs}</defs><g clip-path="url(#tile)">${body}</g></svg>`;
}
function dotsPath(dots) {
  return dots.map(d => `M${f(d.x - d.r)},${f(d.y)}a${f(d.r)},${f(d.r)} 0 1,0 ${f(2 * d.r)},0a${f(d.r)},${f(d.r)} 0 1,0 ${f(-2 * d.r)},0Z`).join('');
}

/* ---------- shared layers ---------- */
function bgFill(phase) {
  const p = PHASES[phase];
  return doc(`<linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}">
<stop offset="0" stop-color="${p.surface}"/><stop offset="0.10" stop-color="${p.g1}"/><stop offset="1" stop-color="${p.g2}"/>
</linearGradient>`, `<rect width="${W}" height="${H}" fill="url(#bg)"/>`);
}

// Fix 1: the horizon is a feathered glow, not a band. Peak opacity ~0.30
// (0.24 on Night, as a faint ember), gradient to transparent on every edge,
// with a soft bloom behind the fan. Total extent 32px, core ~13px.
function horizonGlow(phase, o = {}) {
  const p = PHASES[phase];
  const night = phase === 'Night';
  const peak = o.peak ?? (night ? 0.24 : 0.30);
  const band = o.color ?? p.band;
  const bloomA = o.bloomA ?? (night ? 0.30 : 0.24);
  const bloomR = o.bloomR ?? 210;
  const ox = o.ox ?? W / 2, oy = o.oy ?? H + 46;
  const top = H - 36, bot = H - 4, hh = bot - top;
  return doc(`<linearGradient id="hz" gradientUnits="userSpaceOnUse" x1="0" y1="${f(top)}" x2="0" y2="${f(bot)}">
<stop offset="0" stop-color="${band}" stop-opacity="0"/>
<stop offset="0.22" stop-color="${band}" stop-opacity="${f(peak * 0.30)}"/>
<stop offset="0.50" stop-color="${band}" stop-opacity="${f(peak)}"/>
<stop offset="0.74" stop-color="${band}" stop-opacity="${f(peak * 0.26)}"/>
<stop offset="1" stop-color="${band}" stop-opacity="0"/>
</linearGradient>
<radialGradient id="bl" gradientUnits="userSpaceOnUse" cx="${f(ox)}" cy="${f(oy)}" r="${bloomR}">
<stop offset="0" stop-color="${p.bloom}" stop-opacity="${f(bloomA)}"/>
<stop offset="0.26" stop-color="${p.bloom}" stop-opacity="${f(bloomA * 0.42)}"/>
<stop offset="0.58" stop-color="${p.bloom}" stop-opacity="${f(bloomA * 0.11)}"/>
<stop offset="1" stop-color="${p.bloom}" stop-opacity="0"/>
</radialGradient>`,
    `<rect width="${W}" height="${H}" fill="url(#bl)"/>
<rect x="0" y="${f(top)}" width="${W}" height="${f(hh)}" fill="url(#hz)"/>`);
}

/* ---------- fan primitive ---------- */
function fanPaths(phase, o) {
  const r = rng(o.seed || 7);
  const count = o.count || 560;
  const spread = (o.spread || 85) * Math.PI / 180;
  const cx = W / 2 + (o.dx || 0), cy = o.cy || 296;
  const ops = o.ops || [0.9, 0.72, 0.55];
  const reachMul = o.reachMul ?? 1;
  const buckets = [[], [], []];
  const dots = [];
  for (let i = 0; i < count; i++) {
    let u = (i + r() * 0.9) / count * 2 - 1;
    u = Math.sign(u) * Math.pow(Math.abs(u), 1.05);
    const th = u * spread + (r() - 0.5) * 0.012;
    const dx = Math.sin(th), dy = -Math.cos(th);
    let L = 1e9;
    if (dy < 0) L = Math.min(L, (0 - cy) / dy);
    if (dx > 0) L = Math.min(L, (W - cx) / dx); else if (dx < 0) L = Math.min(L, (0 - cx) / dx);
    const reach = L * (0.86 + 0.18 * r()) * reachMul;
    const pos = t => [cx + dx * reach * t, cy + dy * reach * t];
    const s = span(pos, 44);
    if (!s) continue;
    const a = pos(s[0]), b = pos(s[1]);
    const g = r() < 0.34 ? 0 : (r() < 0.515 ? 1 : 2);
    buckets[g].push(`M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}`);
    if (r() < (o.dotEvery ?? 0.9)) {
      const dr = o.dotR
        ? o.dotR[0] + r() * (o.dotR[1] - o.dotR[0])
        : (1.2 + r() * 0.6) * (o.dotScale || 1);
      if (inside(b[0], b[1])) dots.push({ x: b[0], y: b[1], r: dr });
    }
  }
  return {
    paths: buckets.map((arr, i) => ({ d: arr.join(''), o: ops[i], w: o.stroke || 1 })),
    dots,
  };
}

function strandLayer(phase, art, o = {}) {
  const p = PHASES[phase];
  const body = art.paths.filter(x => x.d).map(x =>
    `<path d="${x.d}" fill="none" stroke="${x.c || p.strand}" stroke-opacity="${x.o}" stroke-width="${x.w}" stroke-linecap="round"/>`).join('\n');
  const d = art.dots && art.dots.length
    ? `<path d="${dotsPath(art.dots)}" fill="${p.dot}" opacity="${o.dotOpacity ?? 0.95}"/>` : '';
  return doc('', body + d);
}

/* ---------- 1. faithful ---------- */
function faithfulV2(phase, o = {}) {
  return {
    fill: PHASES[phase].surface,
    layers: [
      { name: 'bg', svg: bgFill(phase) },
      { name: 'glow · horizon', svg: horizonGlow(phase), blur: 5 },
      { name: 'strands', svg: strandLayer(phase, fanPaths(phase, { seed: 31, count: 560, spread: 85, ops: [0.45, 0.36, 0.28], dotEvery: 0.9, ...o })) },
    ],
  };
}

/* ---------- 2. fibre lamp ---------- */
function cubicAt(p, t) {
  const a = 1 - t;
  return [0, 1].map(i => a * a * a * p[0][i] + 3 * a * a * t * p[1][i] + 3 * a * t * t * p[2][i] + t * t * t * p[3][i]);
}
function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
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

function fibreArt(phase, o = {}) {
  const r = rng(o.seed || 21);
  const count = o.count || 210;
  const cx = W / 2 + (o.dx || 0), cy = 292;
  const groups = { 0.92: [], 0.74: [], 0.56: [] };
  const dots = [];
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
  const scale = o.scale ?? 1;
  return {
    paths: Object.keys(groups).map(g => ({ d: groups[g].join(''), o: (g * scale).toFixed(2), w: o.stroke || 1 })),
    dots, normal: dots.filter(d => d.r < 2.5), twinkle: dots.filter(d => d.r >= 2.5),
  };
}
function fibreStrandLayer(phase, art) {
  const p = PHASES[phase];
  const body = art.paths.filter(x => x.d).map(x =>
    `<path d="${x.d}" fill="none" stroke="${p.strand}" stroke-opacity="${x.o}" stroke-width="${x.w}" stroke-linecap="round"/>`).join('\n');
  let extra = '';
  if (art.normal.length) extra += `<path d="${dotsPath(art.normal)}" fill="${p.dot}" opacity="0.9"/>`;
  if (art.twinkle.length) extra += `<path d="${dotsPath(art.twinkle)}" fill="${p.dot}" opacity="1"/>`;
  return doc('', body + extra);
}
function fibreV2(phase) {
  const scale = PHASES[phase].aScale;
  return {
    fill: PHASES[phase].surface,
    layers: [
      { name: 'bg', svg: bgFill(phase) },
      { name: 'glow · horizon', svg: horizonGlow(phase), blur: 5 },
      { name: 'fibres', svg: fibreStrandLayer(phase, fibreArt(phase, { seed: 44, scale })) },
    ],
  };
}

/* ---------- 3. depth: three parallax fans + atmospheric fog ---------- */
function fogLayer(phase, o) {
  const colour = o.colour;
  const y2 = H * (o.fadeTo ?? 0.9);
  return doc(`<linearGradient id="fg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${f(y2)}">
<stop offset="0" stop-color="${colour}" stop-opacity="${f(o.top)}"/>
<stop offset="0.42" stop-color="${colour}" stop-opacity="${f(o.top * 0.62)}"/>
<stop offset="0.74" stop-color="${colour}" stop-opacity="${f(o.top * 0.20)}"/>
<stop offset="1" stop-color="${colour}" stop-opacity="0"/>
</linearGradient>`, `<rect width="${W}" height="${H}" fill="url(#fg)"/>`);
}
function atmosLayer(phase, o) {
  const colour = o.colour;
  return doc(`<radialGradient id="at" gradientUnits="userSpaceOnUse" cx="${W / 2 + (o.dx || 0)}" cy="${H + 34}" r="${o.r || 250}">
<stop offset="0" stop-color="${colour}" stop-opacity="${f(o.top)}"/>
<stop offset="0.42" stop-color="${colour}" stop-opacity="${f(o.top * 0.52)}"/>
<stop offset="1" stop-color="${colour}" stop-opacity="0"/>
</radialGradient>`, `<rect width="${W}" height="${H}" fill="url(#at)"/>`);
}
function depthV2(phase) {
  const p = PHASES[phase];
  const night = phase === 'Night';
  const pm = night ? 1 : 0.8;                       // light phases: calmer whites
  const haze = night ? '#232326' : mixc(p.g1, '#ffffff', 0.32);
  const fogColour = night ? '#1B1B1E' : mixc(p.g2, '#ffffff', 0.55);
  const cfg = [
    // three genuinely different fans: wide+short+hazy, medium, narrow+tall+crisp
    { name: 'fan · back', dx: -34, count: 460, spread: 118, reachMul: 0.50, stroke: 0.55, ops: [0.16, 0.20, 0.24], dotEvery: 0.02, dotR: [0.5, 0.9], blur: 7, seed: 401 },
    { name: 'fan · mid', dx: 4, count: 150, spread: 88, reachMul: 0.82, stroke: 1.15, ops: [0.42, 0.50, 0.57], dotEvery: 0.35, dotR: [1.1, 1.7], blur: 1.6, seed: 402 },
    { name: 'fan · front', dx: 26, count: 56, spread: 58, reachMul: 1.08, stroke: 2.2, ops: [0.82, 0.92, 1.0], dotEvery: 0.95, dotR: [2.4, 3.4], blur: 0, seed: 403 },
  ];
  const layers = [
    { name: 'bg', svg: bgFill(phase) },
    { name: 'atmosphere', svg: atmosLayer(phase, { colour: haze, top: night ? 0.22 : 0.18, r: 300 }), blur: 14 },
  ];
  cfg.forEach((c, i) => {
    const art = fanPaths(phase, {
      seed: c.seed, count: c.count, spread: c.spread, dx: c.dx, reachMul: c.reachMul,
      ops: c.ops.map(v => +(v * pm).toFixed(3)), stroke: c.stroke,
      dotEvery: c.dotEvery, dotR: c.dotR,
    });
    layers.push({ name: c.name, svg: strandLayer(phase, art, { dotOpacity: 0.9 }), blur: c.blur });
    if (i === 0) layers.push({ name: 'fog · back', svg: fogLayer(phase, { colour: fogColour, top: night ? 0.52 : 0.58, fadeTo: 0.86 }) });
    if (i === 1) layers.push({ name: 'fog · mid', svg: fogLayer(phase, { colour: fogColour, top: night ? 0.20 : 0.28, fadeTo: 0.76 }) });
  });
  layers.push({ name: 'glow · horizon', svg: horizonGlow(phase, { peak: night ? 0.18 : 0.14, bloomA: night ? 0.14 : 0.10 }), blur: 6 });
  return { fill: p.surface, layers };
}

/* ---------- 4. silk wave: one brushed-silk ribbon with a single fold ---------- */
function silkColors(phase) {
  const p = PHASES[phase];
  if (phase === 'Night') {
    return {
      bg: '#262626', light: '#B85343', deep: '#341A13', hi: '#FF9A82',
      sheen: '#FFF2EA', sheenA: 0.25, strandLight: '#FFF2EA',
      strandShadow: '#160B07', edgeDark: '#000000',
    };
  }
  return {
    bg: p.surface,
    light: p.g1,
    deep: mixc(p.g2, p.band, 0.42),
    hi: mixc(p.g1, '#ffffff', 0.42),
    sheen: '#ffffff',
    sheenA: 0.4,
    strandLight: '#ffffff',
    strandShadow: mixc(p.band, '#000000', 0.42),
    edgeDark: '#000000',
  };
}

const SILK = {
  x0: -110, LX: 1080, Y0: 155, AMP: 118, PH: 0.5, T0: 0.05, T1: 0.95, TP: 0.4204,
  // full perpendicular width along the sweep; collapses at the fold
  WK: [[0, 100], [0.14, 120], [0.30, 98], [0.375, 42], [0.42, 7], [0.465, 42], [0.55, 100], [0.70, 126], [0.86, 118], [1, 100]],
};
function silkPt(t) { const S = SILK; return [S.x0 + S.LX * t, S.Y0 + S.AMP * Math.sin(2 * Math.PI * t + S.PH)]; }
function silkTangent(t) { const S = SILK; return [S.LX, S.AMP * 2 * Math.PI * Math.cos(2 * Math.PI * t + S.PH)]; }
function silkNormal(t) {
  const d = silkTangent(t), L = Math.hypot(d[0], d[1]) || 1;
  return [d[1] / L, -d[0] / L];              // +u is the upper side of the ribbon
}
function silkWidth(t) {
  const K = SILK.WK;
  for (let i = 0; i < K.length - 1; i++) {
    const [t0, w0] = K[i], [t1, w1] = K[i + 1];
    if (t <= t1 || i === K.length - 2) return w0 + (w1 - w0) * smooth((t - t0) / (t1 - t0));
  }
}
function silkOffset(t, u, extra = 0) {
  const c = silkPt(t), n = silkNormal(t), w = silkWidth(t);
  return [c[0] + n[0] * (u * w + extra), c[1] + n[1] * (u * w + extra)];
}
const pStr = pts => pts.map((q, j) => `${j ? 'L' : 'M'}${f(q[0])},${f(q[1])}`).join('');

function silkV2(phase) {
  const C = silkColors(phase);
  const S = SILK;
  // the fold flips which edge catches the light
  const shadeU = (t, u) => (t < S.TP ? u : -u);

  /* body: outline of the swept ribbon, two-tone along the sweep */
  const NEDGE = 130;
  const top = [], bot = [];
  for (let k = 0; k <= NEDGE; k++) {
    const t = S.T0 + (S.T1 - S.T0) * k / NEDGE;
    top.push(silkOffset(t, 0.5));
    bot.push(silkOffset(t, -0.5));
  }
  const outline = `M${top.map(q => `${f(q[0])},${f(q[1])}`).join('L')}L${bot.reverse().map(q => `${f(q[0])},${f(q[1])}`).join('L')}Z`;
  const p0 = silkPt(S.T0), p1 = silkPt(S.T1);
  const bodyGrad = `<linearGradient id="rb" gradientUnits="userSpaceOnUse" x1="${f(p0[0])}" y1="${f(p0[1])}" x2="${f(p1[0])}" y2="${f(p1[1])}">
<stop offset="0" stop-color="${mixc(C.light, '#ffffff', 0.10)}"/>
<stop offset="0.28" stop-color="${C.light}"/>
<stop offset="0.62" stop-color="${mixc(C.light, C.deep, 0.58)}"/>
<stop offset="0.88" stop-color="${C.deep}"/>
<stop offset="1" stop-color="${mixc(C.deep, C.hi, 0.18)}"/>
</linearGradient>`;

  /* cross-ribbon form: 12 translucent strips per side of the fold */
  const NBAND = 12, BSTEP = 22;
  const bandStyle = u => {
    if (u < -0.40) return { c: C.edgeDark, a: 0.30 };
    if (u < -0.24) return { c: C.strandShadow, a: 0.18 };
    if (u < -0.04) return { c: C.strandShadow, a: 0.07 };
    if (u < 0.18) return { c: C.strandLight, a: 0.06 };
    if (u < 0.32) return { c: C.strandLight, a: 0.12 };
    if (u < 0.42) return { c: C.strandLight, a: 0.20 };
    return { c: C.edgeDark, a: 0.15 };
  };
  const bands = [];
  for (const [ta, tb] of [[S.T0, S.TP], [S.TP, S.T1]]) {
    for (let b = 0; b < NBAND; b++) {
      const uLo = -0.5 + b / NBAND, uHi = -0.5 + (b + 1) / NBAND;
      const st = bandStyle(shadeU(ta + 0.001, (uLo + uHi) / 2));
      if (st.a < 0.02) continue;
      const up = [], dn = [];
      for (let k = 0; k <= BSTEP; k++) {
        const t = ta + (tb - ta) * k / BSTEP;
        up.push(silkOffset(t, uHi));
        dn.push(silkOffset(t, uLo));
      }
      const d = `M${up.map(q => `${f(q[0])},${f(q[1])}`).join('L')}L${dn.reverse().map(q => `${f(q[0])},${f(q[1])}`).join('L')}Z`;
      bands.push(`<path d="${d}" fill="${st.c}" fill-opacity="${f(st.a)}"/>`);
    }
  }

  /* ultra-fine strands: 180 hairlines, 0.5px, 6-15% each */
  const NS = 180, NT = 26;
  const zoneStyle = u => {
    if (u < -0.36) return { c: C.strandShadow, a: 0.12 };
    if (u < -0.10) return { c: C.strandShadow, a: 0.08 };
    if (u < 0.12) return { c: C.strandLight, a: 0.09 };
    if (u < 0.34) return { c: C.strandLight, a: 0.15 };
    return { c: C.strandShadow, a: 0.10 };
  };
  const zones = [[], [], [], [], []];
  const zIndex = u => u < -0.36 ? 0 : u < -0.10 ? 1 : u < 0.12 ? 2 : u < 0.34 ? 3 : 4;
  const r = rng(phase === 'Night' ? 77 : 33);
  for (let i = 0; i < NS; i++) {
    const u = (i + 0.5) / NS - 0.5 + (r() - 0.5) * 0.004;
    const jit = (r() - 0.5) * 1.2;
    const wob = r() * 6.283;
    const before = [], after = [];
    for (let k = 0; k <= NT; k++) {
      const t = S.T0 + (S.T1 - S.T0) * k / NT;
      const extra = jit + Math.sin(t * 9 + wob) * 0.85;
      const q = silkOffset(t, u, extra);
      (t <= S.TP ? before : after).push(q);
    }
    if (before.length > 1) zones[zIndex(u)].push(pStr(before));
    if (after.length > 1) zones[zIndex(-u)].push(pStr(after));
  }
  const strandEls = zones.map((arr, i) => {
    if (!arr.length) return '';
    const st = [zoneStyle(-0.45), zoneStyle(-0.22), zoneStyle(0.0), zoneStyle(0.22), zoneStyle(0.42)][i];
    return `<path d="${arr.join('')}" fill="none" stroke="${st.c}" stroke-opacity="${f(Math.min(0.15, st.a))}" stroke-width="0.5"/>`;
  }).join('\n');

  const ribbon = doc(bodyGrad, `<rect width="${W}" height="${H}" fill="${C.bg}"/>
<path d="${outline}" fill="url(#rb)"/>
${bands.join('\n')}
${strandEls}`);

  /* sheen: a glossy streak running through the fold, a glint at the waist, a crease */
  const sheenPts = (u, ta, tb, n = 40) => {
    const out = [];
    for (let k = 0; k <= n; k++) { const t = ta + (tb - ta) * k / n; out.push(silkOffset(t, u)); }
    return out;
  };
  const tp = silkPt(S.TP), tan = silkTangent(S.TP);
  const ang = Math.atan2(tan[1], tan[0]) * 180 / Math.PI;
  const sA = C.sheenA;
  const sheenDefs = `<linearGradient id="sh" gradientUnits="userSpaceOnUse" x1="${f(silkPt(0.20)[0])}" y1="${f(silkPt(0.20)[1])}" x2="${f(silkPt(0.70)[0])}" y2="${f(silkPt(0.70)[1])}">
<stop offset="0" stop-color="${C.sheen}" stop-opacity="0"/>
<stop offset="0.30" stop-color="${C.sheen}" stop-opacity="${f(sA * 0.55)}"/>
<stop offset="0.52" stop-color="${C.sheen}" stop-opacity="${f(sA)}"/>
<stop offset="0.76" stop-color="${C.sheen}" stop-opacity="${f(sA * 0.62)}"/>
<stop offset="1" stop-color="${C.sheen}" stop-opacity="0"/>
</linearGradient>
<linearGradient id="cg" gradientUnits="userSpaceOnUse" x1="${f(silkPt(0.26)[0])}" y1="${f(silkPt(0.26)[1])}" x2="${f(silkPt(0.48)[0])}" y2="${f(silkPt(0.48)[1])}">
<stop offset="0" stop-color="#000000" stop-opacity="0"/>
<stop offset="0.55" stop-color="#000000" stop-opacity="0.20"/>
<stop offset="1" stop-color="#000000" stop-opacity="0"/>
</linearGradient>
<radialGradient id="gl" gradientUnits="userSpaceOnUse" cx="${f(tp[0])}" cy="${f(tp[1])}" r="50">
<stop offset="0" stop-color="${C.sheen}" stop-opacity="${f(Math.min(0.62, sA * 1.5))}"/>
<stop offset="0.45" stop-color="${C.sheen}" stop-opacity="${f(sA * 0.45)}"/>
<stop offset="1" stop-color="${C.sheen}" stop-opacity="0"/>
</radialGradient>`;
  const sheen = doc(sheenDefs, `
<path d="${pStr(sheenPts(0.34, 0.20, 0.465))}" fill="none" stroke="url(#sh)" stroke-opacity="0.75" stroke-width="18" stroke-linecap="round"/>
<path d="${pStr(sheenPts(0.34, 0.22, 0.455))}" fill="none" stroke="url(#sh)" stroke-opacity="1" stroke-width="4" stroke-linecap="round"/>
<ellipse cx="${f(tp[0])}" cy="${f(tp[1])}" rx="52" ry="20" transform="rotate(${f(ang)} ${f(tp[0])} ${f(tp[1])})" fill="url(#gl)"/>
<path d="${pStr(sheenPts(-0.33, 0.47, 0.78))}" fill="none" stroke="url(#sh)" stroke-opacity="0.7" stroke-width="14" stroke-linecap="round"/>
<path d="${pStr(sheenPts(-0.14, 0.28, 0.45))}" fill="none" stroke="url(#cg)" stroke-opacity="1" stroke-width="13" stroke-linecap="round"/>`);

  return {
    fill: C.bg,
    layers: [
      { name: 'silk ribbon', svg: ribbon },
      { name: 'silk sheen', svg: sheen, blur: 1.2 },
    ],
  };
}

/* ---------- assemblies ---------- */
const DIRS = ['Faithful', 'Fibre lamp', 'Depth', 'Silk wave'];
function tileLayers(dir, phase) {
  if (dir === 'Faithful') return faithfulV2(phase);
  if (dir === 'Fibre lamp') return fibreV2(phase);
  if (dir === 'Depth') return depthV2(phase);
  if (dir === 'Silk wave') return silkV2(phase);
  throw new Error('unknown direction ' + dir);
}

module.exports = { W, H, RAD, PHASES, COLS, DIRS, tileLayers, silkPt, silkWidth, silkOffset, horizonGlow };

if (require.main === module) {
  const dir = process.argv[2] || 'Silk wave', phase = process.argv[3] || 'Day', out = process.argv[4];
  const t = tileLayers(dir, phase);
  console.log(JSON.stringify({
    dir, phase, fill: t.fill,
    layers: t.layers.map(l => ({ name: l.name, bytes: l.svg.length, paths: (l.svg.match(/<path /g) || []).length, blur: l.blur || 0 })),
  }, null, 1));
  if (out) {
    const fs = require('fs'), path = require('path');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    t.layers.forEach((l, i) => fs.writeFileSync(out.replace(/\.svg$/, `-${i}-${l.name.replace(/[^\w]+/g, '-')}.svg`), l.svg));
    console.log('bytes total', t.layers.reduce((s, l) => s + l.svg.length, 0));
  }
}
