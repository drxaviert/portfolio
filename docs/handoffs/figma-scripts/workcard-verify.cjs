// Verify: section + cell geometry, chip fills/effects, icon bounds.
const conn = require('./ws.cjs');
const SEC = process.argv[2] || '147:16070';
const r2 = v => v === undefined || v === null ? v : Math.round(v * 100) / 100;
const hx = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const paints = ps => (ps || []).map(p => p.type === 'SOLID' ? `SOLID ${hx(p.color)} @${r2(p.opacity ?? 1)}` : p.type).join(' | ');

(async () => {
  const { call, close } = await conn();
  const s = await call('get_node_info', { nodeId: SEC, depth: 1 }, 90000);
  const bb = s.absoluteBoundingBox;
  console.log('SECTION', s.id, JSON.stringify(r2(bb.x)) + ',' + r2(bb.y), r2(bb.width) + 'x' + r2(bb.height), 'fills', paints(s.fills));
  for (const c of s.children || []) {
    const b = c.absoluteBoundingBox || {};
    console.log(' ', c.id, c.type, JSON.stringify(c.name), `${r2(b.x)},${r2(b.y)} ${r2(b.width)}x${r2(b.height)}`);
    if (c.type === 'GROUP') {
      for (const g of c.children || []) {
        const gb = g.absoluteBoundingBox || {};
        console.log('     -', g.id, g.type, JSON.stringify(g.name), `${r2(gb.x)},${r2(gb.y)} ${r2(gb.width)}x${r2(gb.height)}`,
          'fills', paints(g.fills), 'r', JSON.stringify(g.cornerRadius ?? null),
          'eff', JSON.stringify((g.effects || []).length), 'style', JSON.stringify(g.effectStyleId || null));
        if (g.children) for (const k of g.children) {
          const kb = k.absoluteBoundingBox || {};
          console.log('        ·', k.id, k.type, JSON.stringify(k.name), `${r2(kb.x)},${r2(kb.y)} ${r2(kb.width)}x${r2(kb.height)}`, 'fills', paints(k.fills));
        }
      }
    }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
