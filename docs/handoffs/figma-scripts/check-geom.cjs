// Geometry sanity check for the silk ribbon and depth fans (no rendering).
const S = require('./gen-v2.cjs');
const { W, H } = S;

const rows = [];
for (let t = 0.02; t <= 0.98; t += 0.04) {
  const c = S.silkPt(t), w = S.silkWidth(t), n = [0, 1];
  const nn = (() => { const d = [S.silkPt(t + 1e-4)[0] - c[0], S.silkPt(t + 1e-4)[1] - c[1]]; const L = Math.hypot(d[0], d[1]) || 1; return [d[1] / L, -d[0] / L]; })();
  rows.push({
    t: +t.toFixed(2), x: Math.round(c[0]), y: Math.round(c[1]), w: +w.toFixed(1),
    top: Math.round(c[1] + nn[1] * w / 2), bot: Math.round(c[1] - nn[1] * w / 2),
    nx: +nn[0].toFixed(2), ny: +nn[1].toFixed(2),
  });
}
console.log('t     x    y    w     top  bot   nx    ny');
for (const r of rows) console.log(String(r.t).padEnd(5), String(r.x).padEnd(4), String(r.y).padEnd(4), String(r.w).padEnd(5), String(r.top).padEnd(4), String(r.bot).padEnd(5), String(r.nx).padEnd(5), r.ny);

// fraction of tile area covered by the ribbon (sampled)
let hit = 0, tot = 0;
const insideP = (x, y) => {
  // inside ribbon if the perpendicular distance to the centreline is under w/2
  let best = 1e9, bt = 0;
  for (let k = 0; k <= 900; k++) {
    const t = k / 900, c = S.silkPt(t);
    const d = Math.hypot(c[0] - x, c[1] - y);
    if (d < best) { best = d; bt = t; }
  }
  return best <= S.silkWidth(bt) / 2;
};
for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) { tot++; if (insideP(x, y)) hit++; }
console.log('ribbon coverage', (hit / tot * 100).toFixed(1) + '%');

// fans: where do tip ends land per layer
function fanExtent(reachMul) {
  const ys = [];
  for (let i = -20; i <= 20; i++) {
    const th = (i / 20) * 82 * Math.PI / 180;
    const dx = Math.sin(th), dy = -Math.cos(th);
    const cy = 296, cx = W / 2;
    let L = dy < 0 ? (0 - cy) / dy : 1e9;
    if (dx > 0) L = Math.min(L, (W - cx) / dx); else if (dx < 0) L = Math.min(L, (0 - cx) / dx);
    ys.push(Math.round(cy + dy * L * reachMul));
  }
  return [Math.min(...ys), Math.max(...ys)];
}
console.log('front tips y range', fanExtent(1.04), 'mid', fanExtent(0.76), 'back', fanExtent(0.5));
