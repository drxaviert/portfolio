// Probe: list the structure of the final homepage frames to find the main work card.
const conn = require('./ws.cjs');
const FRAMES = { Day: '102:1762', Night: '102:1219' };
const bb = n => n.absoluteBoundingBox ? `${Math.round(n.absoluteBoundingBox.x)},${Math.round(n.absoluteBoundingBox.y)} ${Math.round(n.absoluteBoundingBox.width)}x${Math.round(n.absoluteBoundingBox.height)}` : `${n.width}x${n.height}`;

(async () => {
  const { call, close } = await conn();
  for (const [phase, id] of Object.entries(FRAMES)) {
    const n = await call('get_node_info', { nodeId: id, depth: 3 }, 90000);
    console.log(`\n## ${phase} ${id} "${n.name}" ${bb(n)}`);
    const walk = (c, d) => {
      console.log('  '.repeat(d), c.id, c.type, JSON.stringify(c.name), bb(c), 'kids=' + ((c.children || []).length));
      if (d < 3) for (const k of c.children || []) walk(k, d + 1);
    };
    for (const c of n.children || []) walk(c, 1);
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
