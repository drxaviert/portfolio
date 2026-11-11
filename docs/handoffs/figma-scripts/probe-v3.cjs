// Probe the v3 Day tile: bg gradient stops, layer list, panel + column position.
const conn = require('./ws.cjs');
const ID = '148:16181';
(async () => {
  const { call, close } = await conn();
  const n = await call('get_node_info', { nodeId: ID, depth: 3 });
  console.log('tile', n.id, JSON.stringify(n.name), JSON.stringify(n.absoluteBoundingBox),
    'radius', n.cornerRadius, 'clip', n.clipsContent,
    'fill', JSON.stringify(n.fills && n.fills[0] && n.fills[0].color));
  const find = (node, name) => {
    if (node.name === name) return node;
    for (const c of node.children || []) { const r = find(c, name); if (r) return r; }
  };
  const bg = find(n, 'art · bg');
  const vec = bg && (bg.children || [])[0];
  console.log('bg vector fills:', JSON.stringify(vec && vec.fills, null, 1).slice(0, 1200));
  const strands = find(n, 'art · strands');
  console.log('strands group', strands && strands.id, 'kids', strands && (strands.children || []).length);
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
