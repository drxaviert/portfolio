// Probe: list Exploration page sections.
const conn = require('./ws.cjs');
const bb = n => n.absoluteBoundingBox ? `${Math.round(n.absoluteBoundingBox.x)},${Math.round(n.absoluteBoundingBox.y)} ${Math.round(n.absoluteBoundingBox.width)}x${Math.round(n.absoluteBoundingBox.height)}` : `${n.width}x${n.height}`;
(async () => {
  const { call, close } = await conn();
  const p = await call('get_node_info', { nodeId: '127:9124', depth: 1 }, 60000);
  console.log('page', p.id, JSON.stringify(p.name), 'children', (p.children || []).length);
  for (const c of p.children || []) console.log(' ', c.id, c.type, JSON.stringify(c.name), bb(c), 'kids=' + ((c.children || []).length));
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
