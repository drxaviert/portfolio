// Probe: type scale entries on the Design System page (label/body/title sizes).
const conn = require('./ws.cjs');
(async () => {
  const { call, close } = await conn();
  const n = await call('get_node_info', { nodeId: '102:1846', depth: 1 }, 90000);
  for (const c of n.children || []) {
    const nm = String(c.name || '');
    if (/label|body|title|headline|type scale/i.test(nm)) {
      console.log(c.id, c.type, JSON.stringify(nm), `${Math.round(c.width)}x${Math.round(c.height)}`, '@' + Math.round(c.x) + ',' + Math.round(c.y));
    }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
