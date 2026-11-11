const conn = require('./ws.cjs');
const hx = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const hex = hx;
(async () => {
  const { call, close } = await conn();
  const v = await call('get_variables', {}, 60000);
  const want = new Set(['VariableID:102:1706', 'VariableID:102:1705', 'VariableID:131:10674', 'VariableID:131:10696']);
  for (const col of v.collections) {
    for (const vv of col.variables || []) {
      if (want.has(vv.id)) console.log(vv.id, col.name, '|', vv.name, '=', Object.values(vv.valuesByMode).map(hex).join(','));
    }
  }
  // other home cards
  for (const [k, id] of Object.entries({ DayWork: '121:2011', DayHi: '121:2017', DawnWork: '121:4490', NightWork: '121:3251' })) {
    try {
      const n = await call('get_node_info', { nodeId: id, depth: 1 }, 60000);
      console.log(k, n.name, JSON.stringify((n.fills || []).map(p => ({ t: p.type, c: p.color && hex(p.color), b: ((p.boundVariables || {}).color || {}).id }))));
    } catch (e) { console.log(k, 'ERR', e.message); }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
