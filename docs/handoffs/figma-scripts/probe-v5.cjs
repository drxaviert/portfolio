// Where did the interrupted v5 build get to?
const conn = require('./ws.cjs');
const SEC = '133:13342';
(async () => {
  const { call, close } = await conn();
  const sec = await call('get_node_info', { nodeId: SEC, depth: 1 });
  console.log('section', JSON.stringify(sec.absoluteBoundingBox), 'children', (sec.children || []).length);
  for (const c of sec.children || []) {
    if (!c.name.includes('v5')) continue;
    console.log('\n', c.id, JSON.stringify(c.name), c.type, JSON.stringify(c.absoluteBoundingBox));
    const info = await call('get_node_info', { nodeId: c.id, depth: 2 });
    console.log('  radius', info.cornerRadius, 'fills', (info.fills || []).length, 'strokes', (info.strokes || []).length,
      'fx', (info.effects || []).map(e => e.type).join('+'));
    for (const k of info.children || []) {
      console.log('   child', k.id, k.type, JSON.stringify(k.name), JSON.stringify(k.absoluteBoundingBox), 'kids', (k.children || []).length);
      for (const g of k.children || []) console.log('     ', g.id, g.type, JSON.stringify(g.name), 'kids', (g.children || []).length);
    }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
