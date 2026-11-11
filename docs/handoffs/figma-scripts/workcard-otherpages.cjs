// Probe: search pages Components (49:2) and Design System (102:1322) top two levels for work/card names.
const conn = require('./ws.cjs');
const bb = n => n.absoluteBoundingBox ? `${Math.round(n.absoluteBoundingBox.x)},${Math.round(n.absoluteBoundingBox.y)} ${Math.round(n.absoluteBoundingBox.width)}x${Math.round(n.absoluteBoundingBox.height)}` : `${n.width}x${n.height}`;
(async () => {
  const { call, close } = await conn();
  for (const pid of ['49:2', '102:1322']) {
    const p = await call('get_node_info', { nodeId: pid, depth: 2 }, 90000);
    console.log(`\n## page ${p.id} "${p.name}"`);
    for (const c of p.children || []) {
      console.log('  ', c.id, c.type, JSON.stringify(c.name), bb(c), 'kids=' + ((c.children || []).length));
      for (const g of c.children || []) {
        if (/work|project|card|case/i.test(String(g.name))) console.log('      >>', g.id, g.type, JSON.stringify(g.name), bb(g));
      }
    }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
