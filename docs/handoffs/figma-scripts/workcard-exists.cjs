// Probe: does 133:13342 exist in the open file? Which pages exist?
const conn = require('./ws.cjs');
(async () => {
  const { call, close } = await conn();
  const pages = await call('get_pages');
  console.log('pages:', JSON.stringify(pages));
  for (const id of ['133:13342', '117:152', '121:1349']) {
    try {
      const n = await call('get_node_info', { nodeId: id, depth: 0 }, 30000);
      console.log(id, '->', n.type, JSON.stringify(n.name), JSON.stringify(n.absoluteBoundingBox || null));
    } catch (e) { console.log(id, 'ERR', e.message); }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
