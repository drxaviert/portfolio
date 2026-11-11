// Verify the E row: geometry, stroke paint + weight, and that nothing else moved.
const conn = require('./ws.cjs');
const SEC = '147:16070';
const PLATE = process.argv[2] || '148:16355';
const r2 = v => v === undefined || v === null ? v : Math.round(v * 100) / 100;
const hx = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const paints = ps => (ps || []).map(p => `${p.type} ${p.color ? hx(p.color) : ''} @${r2(p.opacity ?? 1)} ${p.visible === false ? 'hidden' : ''}`).join(' | ');

(async () => {
  const { call, close } = await conn();
  const s = await call('get_node_info', { nodeId: SEC, depth: 1 }, 90000);
  const sb = s.absoluteBoundingBox;
  console.log('SECTION', s.id, r2(sb.x) + ',' + r2(sb.y), r2(sb.width) + 'x' + r2(sb.height), 'kids', (s.children || []).length);
  console.log('last child', s.children[s.children.length - 1].id, JSON.stringify(s.children[s.children.length - 1].name));

  const p = await call('get_node_info', { nodeId: PLATE, depth: 3 }, 90000);
  const pb = p.absoluteBoundingBox;
  console.log('\nPLATE', p.id, JSON.stringify(p.name), r2(pb.x) + ',' + r2(pb.y), r2(pb.width) + 'x' + r2(pb.height), 'fills', paints(p.fills));
  const walk = (n, d) => {
    const b = n.absoluteBoundingBox || {};
    console.log('  '.repeat(d), n.id, n.type, JSON.stringify(n.name), `${r2(b.x)},${r2(b.y)} ${r2(b.width)}x${r2(b.height)}`,
      'fills', paints(n.fills), 'strokes', paints(n.strokes), 'sw', n.strokeWeight ?? '-', 'r', JSON.stringify(n.cornerRadius ?? null),
      'eff', (n.effects || []).length);
    for (const c of n.children || []) walk(c, d + 1);
  };
  for (const c of p.children || []) walk(c, 1);
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
