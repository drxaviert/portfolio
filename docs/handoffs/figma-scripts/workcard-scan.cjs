// Probe: list children of the Day/Night breakpoint sections, looking for work/project cards.
const conn = require('./ws.cjs');
const SECS = { Day: '121:1349', Night: '121:2589' };
const bb = n => n.absoluteBoundingBox ? `${Math.round(n.absoluteBoundingBox.x)},${Math.round(n.absoluteBoundingBox.y)} ${Math.round(n.absoluteBoundingBox.width)}x${Math.round(n.absoluteBoundingBox.height)}` : `${n.width}x${n.height}`;

(async () => {
  const { call, close } = await conn();
  for (const [phase, id] of Object.entries(SECS)) {
    const s = await call('get_node_info', { nodeId: id, depth: 2 }, 90000);
    console.log(`\n## ${phase} ${id} "${s.name}" ${bb(s)}`);
    for (const c of s.children || []) {
      console.log('  ', c.id, c.type, JSON.stringify(c.name), bb(c), 'kids=' + ((c.children || []).length));
      for (const g of c.children || []) {
        const nm = String(g.name || '');
        if (/work|project|card|case/i.test(nm)) console.log('      >>', g.id, g.type, JSON.stringify(nm), bb(g));
      }
    }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
