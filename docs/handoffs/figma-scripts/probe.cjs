const conn = require('./ws.cjs');
(async () => {
  const { call, close } = await conn();
  await call('set_current_page', { pageId: '127:9124' });
  const ids = ['133:12263', '133:11660', '133:11447', '133:11661', '133:11662'];
  const out = [];
  for (const id of ids) {
    const n = await call('get_node_info', { nodeId: id });
    out.push({ id, name: n.name, bb: n.absoluteBoundingBox, w: n.width, h: n.height, radius: n.cornerRadius, clips: n.clipsContent, effects: (n.effects||[]).map(e=>`${e.type} r=${e.radius} y=${e.offset?.y} a=${e.color?.a}`) });
  }
  console.log(JSON.stringify(out, null, 1));
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
