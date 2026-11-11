const conn = require('./ws.cjs');
const hx = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('') + ((c.a !== undefined && c.a < 1) ? '@' + c.a.toFixed(2) : '');
const paints = ps => (ps || []).map(p => p.type === 'SOLID' ? 'SOLID ' + hx(p.color) + ' op' + (p.opacity ?? 1)
  : p.type.startsWith('GRADIENT') ? p.type + '[' + (p.gradientStops || []).map(s => `${(s.position * 100).toFixed(0)}%${hx(s.color)}`).join(' ') + ']'
  : p.type).join(' | ');
(async () => {
  const { call, close } = await conn();
  // generative-art (Play card) in each phase 1440 frame
  const nodes = { Day: '121:2020', Dawn: '121:4499', Dusk: '121:5738', Night: '121:3260' };
  for (const [k, id] of Object.entries(nodes)) {
    try {
      const n = await call('get_node_info', { nodeId: id, depth: 2 }, 60000);
      console.log('##', k, n.name, JSON.stringify(n.fills), '| bound', JSON.stringify((n.boundVariables || {}).fills || null), '| r', n.cornerRadius);
      for (const c of n.children || []) console.log('   ', c.type, c.name, paints(c.fills));
    } catch (e) { console.log('##', k, 'ERR', e.message); }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
