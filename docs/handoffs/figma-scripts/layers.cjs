const conn = require('./ws.cjs');
const ids = process.argv.slice(2);
(async () => {
  const { call, close } = await conn();
  for (const id of ids) {
    const info = await call('get_node_info', { nodeId: id, depth: 2 });
    console.log('==', info.id, info.name, JSON.stringify(info.absoluteBoundingBox));
    for (const c of info.children || []) {
      console.log('  layer', c.id, JSON.stringify(c.name), c.type, 'kids', (c.children || []).length,
        'bb', JSON.stringify(c.absoluteBoundingBox),
        'fx', JSON.stringify((c.effects || []).map(e => `${e.type}:${e.radius}`)),
        'opacity', c.opacity);
      for (const k of c.children || []) {
        console.log('    ', k.id, k.type, 'kids', (k.children || []).length, JSON.stringify(k.absoluteBoundingBox));
      }
    }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
