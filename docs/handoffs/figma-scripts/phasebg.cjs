const conn = require('./ws.cjs');
const hx = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('') + ((c.a !== undefined && c.a < 1) ? '@' + c.a.toFixed(2) : '');
const paints = ps => (ps || []).map(p => p.type === 'SOLID' ? 'SOLID ' + hx(p.color) + ' op' + (p.opacity ?? 1)
  : p.type.startsWith('GRADIENT') ? p.type + '[' + (p.gradientStops || []).map(s => `${(s.position * 100).toFixed(0)}%${hx(s.color)}`).join(' ') + ']' + (p.opacity !== undefined && p.opacity !== 1 ? ' op' + p.opacity : '')
  : p.type).join(' | ');

(async () => {
  const { call, close } = await conn();
  const ids = { Dawn: '121:3828', Day: '121:1349', Dusk: '121:5067', Night: '121:2589' };
  for (const [k, id] of Object.entries(ids)) {
    const n = await call('get_node_info', { nodeId: id, depth: 1 }, 120000);
    const f1440 = (n.children || []).find(c => /1440/.test(c.name)) || (n.children || [])[0];
    const f = await call('get_node_info', { nodeId: f1440.id, depth: 2 }, 120000);
    console.log('##', k, 'frame', f1440.id, f1440.name, f1440.width + 'x' + f1440.height);
    for (const c of f.children || []) {
      if (c.type === 'FRAME' && /bg/i.test(c.name)) {
        console.log('  bg', c.id, paints(c.fills));
        for (const g of c.children || []) console.log('   child', g.name, paints(g.fills), 'fx', (g.effects || []).map(e => e.type + ':' + e.radius + ':' + (e.opacity ?? 1)).join(','));
      }
    }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
