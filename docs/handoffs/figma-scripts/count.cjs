const conn = require('./ws.cjs');
(async () => {
  const { call, close } = await conn();
  const ids = { Day: '121:1349', Night: '121:2589', Dawn: '121:3828', Dusk: '121:5067' };
  const count = n => 1 + (n.children || []).reduce((a, c) => a + count(c), 0);
  for (const [k, id] of Object.entries(ids)) {
    const t0 = Date.now();
    const n = await call('get_node_info', { nodeId: id, depth: 60 }, 120000);
    console.log(k.padEnd(6), 'nodes=', count(n), 'top=', (n.children || []).length, `${Date.now() - t0}ms`);
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
