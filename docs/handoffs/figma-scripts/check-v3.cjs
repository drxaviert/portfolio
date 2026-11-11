// Geometry + dot distribution check for Faithful v3, read from the generated SVG.
const { PW, PH, tileLayers } = require('./gen-v3.cjs');
const strands = tileLayers('Day').layers.find(l => l.name === 'art · strands').svg;

const tips = [];
const re = /M([\d.]+),([\d.]+)L([\d.]+),([\d.]+)/g;
let m;
while ((m = re.exec(strands))) tips.push([+m[3], +m[4]]);
const ys = tips.map(p => p[1]).sort((a, b) => a - b);
const xs = tips.map(p => p[0]);

const dots = [];
const dre = /M([\d.]+),([\d.]+)a([\d.]+),/g;
while ((m = dre.exec(strands))) dots.push([+m[1] + +m[3], +m[2]]);

const hist = (vals, lo, hi, bins) => {
  const out = new Array(bins).fill(0);
  for (const v of vals) out[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / (hi - lo) * bins)))]++;
  return out.join(' ');
};

console.log(`panel ${PW}x${PH} · strands ${tips.length} · dots ${dots.length}`);
console.log(`highest tip y=${ys[0].toFixed(1)} (${((PH - ys[0]) / PH * 100).toFixed(0)}% of height), median ${ys[Math.floor(ys.length / 2)].toFixed(1)}`);
console.log(`tips above the top-25% line: ${ys.filter(v => v < PH * 0.25).length}`);
console.log(`tip x range ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)}`);
console.log('dot count per x eighth :', hist(dots.map(d => d[0]), 0, PW, 8));
console.log('dot count per y twelfth:', hist(dots.map(d => d[1]), 0, PH, 12));
