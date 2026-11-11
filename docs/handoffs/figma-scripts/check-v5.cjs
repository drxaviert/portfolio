// Faithful v5 checks: 100% dots, tip bounds, height cap, v4 strand styling, radial bg.
const V5 = require('./gen-v5.cjs');
const { PW, PH } = V5;

const t = V5.tileLayers('Day');
const svg = t.layers.find(l => l.name === 'art · strands').svg;
const bg = t.layers.find(l => l.name === 'art · bg').svg;
const ss = V5.strands('Day');

const dots = [];
const dre = /M([\d.]+),([\d.]+)a([\d.]+),/g;
let m;
while ((m = dre.exec(svg))) dots.push({ x: +m[1] + +m[3], y: +m[2], r: +m[3] });

let minTop = 1e9, minLeft = 1e9, maxRight = -1e9, maxBottom = -1e9;
for (const d of dots) {
  minTop = Math.min(minTop, d.y - d.r);
  minLeft = Math.min(minLeft, d.x - d.r);
  maxRight = Math.max(maxRight, d.x + d.r);
  maxBottom = Math.max(maxBottom, d.y + d.r);
}
const pct = y => ((PH - y) / PH * 100).toFixed(1) + '%';
console.log(`strands ${ss.length}  dots ${dots.length}  radius ${Math.min(...dots.map(d => d.r)).toFixed(1)}..${Math.max(...dots.map(d => d.r)).toFixed(1)}px`);
console.log(`top of dots y=${minTop.toFixed(1)} = ${pct(minTop)} of panel height (cap 68%)`);
console.log(`clearance  left ${minLeft.toFixed(1)}  right ${(PW - maxRight).toFixed(1)}  bottom ${(PH - maxBottom).toFixed(1)} px`);
console.log(`dots larger than 3.1px: ${dots.filter(d => d.r > 3.1).length}`);
console.log('strand paths:', (svg.match(/<path/g) || []).length, '| gradients in strands:', (svg.match(/<linearGradient|<radialGradient/g) || []).length);
console.log('strand strokes:', [...svg.matchAll(/stroke="([^"]+)" stroke-opacity="([^"]+)"/g)].map(x => `${x[1]}@${x[2]}`).join(', ') || 'none (gradient)');
console.log('dot fills:', [...svg.matchAll(/<path d="[^"]{200,}" fill="([^"]+)" opacity="([^"]+)"/g)].map(x => `${x[1]}@${x[2]}`).join(' '));
console.log('bg gradients:', (bg.match(/<radialGradient/g) || []).length, '| bg rects:', (bg.match(/<rect/g) || []).length);

const hist = (vals, hi, bins) => { const o = new Array(bins).fill(0); for (const v of vals) o[Math.min(bins - 1, Math.max(0, Math.floor(v / hi * bins)))]++; return o.join(' '); };
console.log('dots per x eighth ', hist(dots.map(d => d.x), PW, 8));
console.log('dots per y twelfth', hist(dots.map(d => d.y), PH, 12));
