// Probe: label structure + tile child structure.
const conn = require('./ws.cjs');
(async () => {
  const { call, close } = await conn();
  for (const id of ['133:13349', '133:13361', '133:13373']) {
    const n = await call('get_node_info', { nodeId: id });
    console.log('---', id, n.name, n.type, 'bb', JSON.stringify(n.absoluteBoundingBox), 'fills', JSON.stringify((n.fills||[]).slice(0,2)).slice(0,300));
    for (const c of (n.children || [])) {
      console.log('   ', c.id, JSON.stringify(c.name), c.type, 'bb', JSON.stringify(c.absoluteBoundingBox), 'fill', c.fills && c.fills[0] ? JSON.stringify(c.fills[0]).slice(0,160) : '');
      const cc = await call('get_node_info', { nodeId: c.id });
      for (const k of (cc.children || [])) {
        console.log('      ', k.id, JSON.stringify(k.name), k.type, 'bb', JSON.stringify(k.absoluteBoundingBox));
      }
    }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
