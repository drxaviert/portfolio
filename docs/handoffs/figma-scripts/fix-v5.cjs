// Replace one art layer on the existing v5 tile, in place (keeps the tile id).
//   node fix-v5.cjs "art · bg"
//   node fix-v5.cjs "art · strands"
const conn = require('./ws.cjs');
const G = require('./gen-v5.cjs');

const SEC = '133:13342';
const NAME = 'Faithful · v5 · Day';
const nid = r => r && (r.id || (r.node && r.node.id));

(async () => {
  const { call, close } = await conn();
  const layerName = process.argv[2] || 'art · strands';
  const sec = await call('get_node_info', { nodeId: SEC, depth: 1 });
  const card = (sec.children || []).find(c => c.name === NAME);
  if (!card) throw new Error('no ' + NAME);

  const t = G.tileLayers('Day');
  const info = await call('get_node_info', { nodeId: card.id, depth: 2 });
  const panel = (info.children || []).find(c => c.name === 'art panel');
  if (!panel) throw new Error('no panel');

  const pd = await call('get_node_info', { nodeId: panel.id, depth: 1 });
  for (const c of pd.children || []) {
    if (c.name === layerName) {
      await call('delete_node', { nodeId: c.id });
      console.log('removed', c.id, c.name);
    }
  }

  const layer = t.layers.find(l => l.name === layerName);
  if (!layer) throw new Error('no such layer in generator: ' + layerName);
  const sv = await call('set_svg', { svgString: layer.svg, x: 0, y: 0, parentId: panel.id, name: layer.name }, 240000);
  const sid = nid(sv);
  if (layerName === 'art · bg') await call('reorder_node', { nodeId: sid, position: 'back' });
  console.log('added', sid, layerName, 'bytes', layer.svg.length);

  const tree = await call('get_node_info', { nodeId: card.id, depth: 2 });
  const walk = (n, d = 0) => {
    console.log(' '.repeat(d), n.id, n.type, JSON.stringify(n.name), 'kids', (n.children || []).length);
    for (const c of (n.children || [])) walk(c, d + 2);
  };
  walk(tree);
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
