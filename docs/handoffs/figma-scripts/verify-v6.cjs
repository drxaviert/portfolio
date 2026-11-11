// Verification for Faithful v6: strand/orb counts straight out of the built SVG,
// geometry against v4, and the Day background's lighter side behind every tip.
const V4 = require('./gen-v4.cjs');
const V6 = require('./gen-v6.cjs');

const t = V6.tileLayers('Day');
const strandsSvg = t.layers.find(l => l.name === 'art · strands').svg;
const bgSvg = t.layers.find(l => l.name === 'art · bg').svg;

// --- counts from the SVG itself ---
const body = strandsSvg.slice(strandsSvg.indexOf('<g mask'), strandsSvg.indexOf('</g>') + 4);
const strandPaths = body.match(/<path [^>]*stroke-width[^>]*>/g) || [];
const strands = strandPaths.reduce((n, p) => n + (p.match(/C/g) || []).length, 0);
const orbPath = (body.match(/<path d="[^"]*" fill="#FFFFFF" opacity="0.95"\/>/) || [''])[0];
const orbs = (orbPath.match(/Z/g) || []).length;
const widths = strandPaths.map(p => +p.match(/stroke-width="([\d.]+)"/)[1]);
const ops = strandPaths.map(p => +p.match(/stroke-opacity="([\d.]+)"/)[1]);
const strokes = [...new Set(strandPaths.map(p => p.match(/stroke="(#[0-9A-Fa-f]+)"/)[1]))];
const orbR = [...orbPath.matchAll(/a([\d.]+),/g)].map(m => +m[1]);
const orbsInsideMask = bgSvg ? strandPaths.length > 0 : false;

// --- geometry ---
const m = V6.metrics('Day');
const v4ss = V4.strands('Day');

// --- background composite behind each tip (bg + glow, as Figma stacks them) ---
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const stops = V6.STOPS;
const mixAt = hexStr => {
  const c = rgb(hexStr);
  const hex = '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  return c;
};
function bgAt(rad) {
  const u = Math.min(1, rad / V6.BGC);
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (u >= stops[i].o && u <= stops[i + 1].o) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const k = b.o === a.o ? 0 : (u - a.o) / (b.o - a.o);
  const ca = rgb(a.c), cb = rgb(b.c);
  return ca.map((v, i) => v + (cb[i] - v) * k);
}
const GLOW = [0, 0.5, 0.25, 0.30, 0.55, 0.10, 1, 0];
function glowAt(rad) {
  const u = Math.min(1, rad / 204);
  for (let i = 0; i < GLOW.length; i += 2) {
    if (u <= GLOW[i]) {
      const p = GLOW[i - 2], pa = GLOW[i - 1], q = GLOW[i], qa = GLOW[i + 1];
      const k = (u - p) / (q - p);
      return pa + (qa - pa) * k;
    }
  }
  return 0;
}
const lum = c => {
  const s = c.map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
const glowC = rgb(V6.DAY.glow);
let worst = { c: 1e9 }, lightest = { L: -1 }, nearWhite = 0;
for (const s of v4ss) {
  const dx = s.tip[0] - V6.PW / 2, dy = s.tip[1] - (V6.PH + 8);
  const rad = Math.hypot(dx, dy);
  const a = glowAt(rad);
  const under = bgAt(rad).map((v, i) => v + (glowC[i] - v) * a);
  const L = lum(under);
  const contrast = 1.05 / (L + 0.05);
  if (contrast < worst.c) worst = { c: contrast, trip: s.tip, under, rad };
  if (L > lightest.L) lightest = { L, under, rad };
  if (L > 0.88) nearWhite++;
}

const pct = n => (n * 100).toFixed(1) + '%';
console.log('strands in SVG       ', strands);
console.log('orbs in SVG          ', orbs, orbs >= strands ? '(>= strands ✓)' : '(TOO FEW ✗)');
console.log('stroke widths        ', [...new Set(widths)].join(', '), widths.length, 'path groups');
console.log('stroke opacities     ', ops.join(', '), '| stroke', strokes.join(','));
console.log('orb radius range     ', Math.min(...orbR).toFixed(2), '..', Math.max(...orbR).toFixed(2),
  '(v4 was 2.50..3.50, drawn 2.5 + r*1.0)');
console.log('orbs inside the mask ', /<g mask="url\(#fade\)">[\s\S]*fill="#FFFFFF" opacity="0.95"[\s\S]*<\/g>/.test(body) ? 'yes ✓' : 'NO ✗');
console.log('highest strand point ', m.minY.toFixed(1), '=', pct(m.heightPct / 100), 'of panel height (limit 68%)');
console.log('visible strands      ', m.visible, '/', m.strands);
console.log('bg stops             ', stops.map(s => `${s.c}@${s.o}`).join('  '));
console.log('lightest bg under a tip', '#' + lightest.under.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''),
  'L=' + lightest.L.toFixed(2));
console.log('worst white-vs-bg     ', worst.c.toFixed(2) + ':1', 'at tip', worst.trip.map(v => v.toFixed(0)).join(','),
  '#' + worst.under.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''));
console.log('tips over near-white  ', nearWhite, '(bg luminance > 0.88)');
