// Dot count, size and spread for Faithful v4, read from the generated SVG.
const V4 = require('./gen-v4.cjs');
const { PW, PH } = V4;
const svg = V4.tileLayers('Day').layers.find(l => l.name === 'art · strands').svg;

const dots = [];
const dre = /M([\d.]+),([\d.]+)a([\d.]+),/g;
let m;
while ((m = dre.exec(svg))) dots.push({ x: +m[1] + +m[3], y: +m[2], r: +m[3] });

const hist = (vals, hi, bins) => {
  const out = new Array(bins).fill(0);
  for (const v of vals) out[Math.min(bins - 1, Math.max(0, Math.floor(v / hi * bins)))]++;
  return out.join(' ');
};
const rs = dots.map(d => d.r);
console.log(`dots ${dots.length}, radius ${Math.min(...rs).toFixed(1)}..${Math.max(...rs).toFixed(1)}px`);
console.log('per x eighth  :', hist(dots.map(d => d.x), PW, 8));
console.log('per y twelfth :', hist(dots.map(d => d.y), PH, 12));
console.log(`dots inside the 30px side margin: ${dots.filter(d => d.x < 30 || d.x > PW - 30).length}`);
console.log(`dots below 86% height: ${dots.filter(d => d.y > PH * 0.86).length}`);
