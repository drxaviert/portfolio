// Verification for Faithful v7: v3 sizing out of the built SVG, fade evenness
// across the dome (top vs side tips), geometry, and the page-glow contrast.
const V4 = require('./gen-v4.cjs');
const V6 = require('./gen-v6.cjs');
const V7 = require('./gen-v7.cjs');

const t = V7.tileLayers('Day');
const strandsSvg = t.layers.find(l => l.name === 'art · strands').svg;
const body = strandsSvg.slice(strandsSvg.indexOf('<g mask'), strandsSvg.indexOf('</g>') + 4);
const strandPaths = body.match(/<path [^>]*stroke-width[^>]*>/g) || [];
const strands = strandPaths.reduce((n, p) => n + (p.match(/C/g) || []).length, 0);
const orbPath = (body.match(/<path d="[^"]*" fill="#FFFFFF" opacity="0.95"\/>/) || [''])[0];
const orbs = (orbPath.match(/Z/g) || []).length;
const radii = [...orbPath.matchAll(/a([\d.]+),/g)].map(m => +m[1]);

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = c => {
  const s = c.map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const over = (a, b, alpha) => a.map((v, i) => v + (b[i] - v) * alpha);

// page gradient sampled at panel y
const bgAtY = y => {
  const u = y / V7.PH;
  let a = V7.BG_STOPS[0], b = V7.BG_STOPS[V7.BG_STOPS.length - 1];
  for (let i = 0; i < V7.BG_STOPS.length - 1; i++) {
    if (u >= V7.BG_STOPS[i].o && u <= V7.BG_STOPS[i + 1].o) { a = V7.BG_STOPS[i]; b = V7.BG_STOPS[i + 1]; break; }
  }
  const k = b.o === a.o ? 0 : (u - a.o) / (b.o - a.o);
  const ca = rgb(a.c), cb = rgb(b.c);
  return ca.map((v, i) => v + (cb[i] - v) * k);
};

// fade evenness: mask value at each tip, grouped by angle
const tips = [];
for (const s of V4.strands('Day')) tips.push(s);
const v6mask = y => {
  const u = y / V7.PH;
  const stops = [[0, 0], [0.26, 0], [0.38, 0.32], [0.5, 0.62], [0.62, 0.88], [0.76, 1], [1, 1]];
  for (let i = 0; i < stops.length - 1; i++) {
    if (u >= stops[i][0] && u <= stops[i + 1][0]) {
      const k = (u - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      return stops[i][1] + (stops[i + 1][1] - stops[i][1]) * k;
    }
  }
  return 1;
};
const bands = { 0: [], 30: [], 60: [], 85: [] };
for (const s of tips) {
  const deg = Math.abs(s.th) * 180 / Math.PI;
  const b = deg < 15 ? 0 : deg < 45 ? 30 : deg < 72 ? 60 : 85;
  bands[b].push({ v7: V7.maskAt(s.tip[0], s.tip[1]), v6: v6mask(s.tip[1]) });
}

let minY = 1e9;
for (const s of tips) for (let k = 0; k <= 30; k++) minY = Math.min(minY, (function (t) {
  const a = 1 - t, p = s.c;
  return a * a * a * p[0][1] + 3 * a * a * t * p[1][1] + 3 * a * t * t * p[2][1] + t * t * t * p[3][1];
})(k / 30));

const bgTop = bgAtY(0), bgMid = bgAtY(V7.PH * 0.5), bgBase = bgAtY(V7.PH);
const white = [255, 255, 255];
const cRatio = (a, b) => { const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1, L2), lo = Math.min(L1, L2); return 1.05 / (lo + 0.05) * (hi === L1 ? 1 : 1); };
const ratio = (a, b) => { const L1 = Math.max(lum(a), lum(b)), L2 = Math.min(lum(a), lum(b)); return (L1 + 0.05) / (L2 + 0.05); };

console.log('strands in SVG       ', strands, '| orbs', orbs, orbs >= strands ? '(>= strands ✓)' : '(TOO FEW ✗)');
console.log('stroke widths        ', [...new Set(strandPaths.map(p => p.match(/stroke-width="([\d.]+)"/)[1]))].join(','),
  '| opacities', strandPaths.map(p => p.match(/stroke-opacity="([\d.]+)"/)[1]).join(', '));
console.log('orb radius           ', Math.min(...radii).toFixed(2) + '..' + Math.max(...radii).toFixed(2),
  '= diameter', (2 * Math.min(...radii)).toFixed(1) + '..' + (2 * Math.max(...radii)).toFixed(1), 'px (v3: 1.2+r*0.6)');
console.log('orbs in same mask    ', /<g mask="url\(#fade\)">[\s\S]*opacity="0.95"[\s\S]*<\/g>/.test(body) ? 'yes ✓' : 'NO ✗');
console.log('highest point        ', minY.toFixed(1), '=', ((V7.PH - minY) / V7.PH * 100).toFixed(1) + '% of height');
console.log('fade at tips by angle (v7 dome vs v6 vertical):');
for (const b of Object.keys(bands)) {
  const a = bands[b];
  if (!a.length) continue;
  const m = k => a.reduce((s, v) => s + v[k], 0) / a.length;
  console.log(`  ~${b.padStart(2)}deg n=${String(a.length).padStart(3)}  v7 mask ${m('v7').toFixed(2)}   (v6 mask ${m('v6').toFixed(2)})`);
}
console.log('page bg at panel top ', hex(bgTop), 'L=' + lum(bgTop).toFixed(3));
console.log('page bg mid / base   ', hex(bgMid), '/', hex(bgBase));
console.log('white vs bg contrast ', ratio(white, bgTop).toFixed(2) + ':1 (top)', ratio(white, bgBase).toFixed(2) + ':1 (base)');
console.log('0.45 white on bg     ', hex(over(bgTop, white, 0.45)), 'vs bg', ratio(over(bgTop, white, 0.45), bgTop).toFixed(2) + ':1');
