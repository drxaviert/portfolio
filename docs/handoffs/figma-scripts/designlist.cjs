const conn = require('./ws.cjs');
(async () => {
  const { call, close } = await conn();
  const ids = { Day: '121:1349', Night: '121:2589', Dawn: '121:3828', Dusk: '121:5067' };
  for (const [k, id] of Object.entries(ids)) {
    const n = await call('get_node_info', { nodeId: id, depth: 3 }, 120000);
    const walk = (x, d) => {
      if (d > 2) return;
      console.log('  '.repeat(d) + x.type + ' ' + x.id + ' ' + JSON.stringify(x.name));
      (x.children || []).forEach(c => walk(c, d + 1));
    };
    console.log('##', k);
    (n.children || []).forEach(c => walk(c, 1));
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
