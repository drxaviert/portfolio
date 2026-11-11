const conn = require('./ws.cjs');
(async () => {
  const { call, close } = await conn();
  for (const id of ['133:13350', '133:13351', '133:13343', '133:13344']) {
    const n = await call('get_node_info', { nodeId: id });
    console.log(id, JSON.stringify(n.name), n.type, 'chars:', JSON.stringify(n.characters), 'font:', JSON.stringify(n.fontName), 'size:', n.fontSize, 'bb', JSON.stringify(n.absoluteBoundingBox));
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
