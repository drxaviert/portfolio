const conn = require('./ws.cjs');
const id = process.argv[2];
(async () => {
  const { call, close } = await conn();
  const info = await call('get_node_info', { nodeId: id, depth: 3 });
  const walk = (n, d = 0) => {
    console.log(' '.repeat(d), n.id, n.type, JSON.stringify(n.name), 'mask', n.isMask, 'clip', n.clipsContent,
      'bb', JSON.stringify(n.absoluteBoundingBox), 'fx', JSON.stringify((n.effects || []).map(e => `${e.type}:${e.radius}`)),
      'fill', n.fills && n.fills[0] ? n.fills[0].type : '');
    for (const c of (n.children || [])) walk(c, d + 2);
  };
  walk(info);
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
