// Final verification of the Faithful · v3 row.
const conn = require('./ws.cjs');
const SEC = '133:13342';
const GROUP = '148:16354';
const ORIG = ['133:13361', '133:13373', '133:13385', '133:13397', '133:13409', '133:13422', '133:13435', '133:13448',
  '135:14215', '135:14237', '135:14259', '135:14281', '136:14303', '136:14323', '136:14343', '136:14363'];

(async () => {
  const { call, close } = await conn();
  const sec = await call('get_node_info', { nodeId: SEC, depth: 1 });
  console.log('section', JSON.stringify(sec.absoluteBoundingBox), 'children', (sec.children || []).length,
    'originals present', (sec.children || []).filter(c => ORIG.includes(c.id)).length + '/16');

  const g = await call('get_node_info', { nodeId: GROUP, depth: 1 });
  console.log('group', g.id, JSON.stringify(g.name), JSON.stringify(g.absoluteBoundingBox));
  const tiles = (g.children || []).slice().sort((a, b) => a.absoluteBoundingBox.x - b.absoluteBoundingBox.x);
  for (const t of tiles) {
    const card = await call('get_node_info', { nodeId: t.id, depth: 2 });
    const panel = (card.children || []).find(c => c.name === 'art panel');
    const pd = panel ? await call('get_node_info', { nodeId: panel.id, depth: 2 }) : null;
    const f = card.fills && card.fills[0];
    const hex = f && f.color ? '#' + [f.color.r, f.color.g, f.color.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('') : '?';
    console.log(` ${card.id} ${JSON.stringify(card.name)} @${card.absoluteBoundingBox.x},${card.absoluteBoundingBox.y} ` +
      `r${card.cornerRadius} strokes${(card.strokes || []).length} fx${(card.effects || []).length} fill${hex}`);
    if (!pd) { console.log('   MISSING PANEL'); continue; }
    console.log(`   panel ${pd.id} ${pd.absoluteBoundingBox.width}x${pd.absoluteBoundingBox.height} @${pd.absoluteBoundingBox.x},${pd.absoluteBoundingBox.y} ` +
      `r${pd.cornerRadius} clips=${pd.clipsContent} layers=${(pd.children || []).map(c => c.name).join(' / ')}`);
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
