// Probe: list top-level sections/frames on the Design page, looking for the exploration/work-card area.
const conn = require('./ws.cjs');
const PAGE = '102:1321';

const bb = n => n.absoluteBoundingBox ? `${Math.round(n.absoluteBoundingBox.x)},${Math.round(n.absoluteBoundingBox.y)} ${Math.round(n.absoluteBoundingBox.width)}x${Math.round(n.absoluteBoundingBox.height)}` : `${n.width}x${n.height}`;

(async () => {
  const { call, close } = await conn();
  const p = await call('get_node_info', { nodeId: PAGE, depth: 1 }, 60000);
  console.log('page', p.id, JSON.stringify(p.name), 'children', (p.children || []).length);
  for (const c of p.children || []) {
    console.log(' ', c.id, c.type, JSON.stringify(c.name), bb(c), 'kids=' + ((c.children || []).length));
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
