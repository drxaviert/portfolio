const conn = require('./ws.cjs');
(async () => {
  const { call, close } = await conn();
  const sec = await call('get_node_info', { nodeId: '133:13342', depth: 1 });
  const tiles = (sec.children || []).filter(c => c.name.startsWith('Play · '));
  const labels = (sec.children || []).filter(c => c.name.startsWith('Label · '));
  console.log('SECTION', sec.id, sec.name, sec.absoluteBoundingBox.x, sec.absoluteBoundingBox.y, sec.width + 'x' + sec.height);
  console.log('tiles', tiles.length, 'labels', labels.length, 'other', sec.children.length - tiles.length - labels.length);
  const rows = {};
  for (const t of tiles) {
    const [, dir, phase] = t.name.split(' · ');
    (rows[dir] = rows[dir] || []).push(`${phase}=${t.id}`);
  }
  for (const d of Object.keys(rows)) console.log(d.padEnd(11), rows[d].join('  '));
  const one = await call('get_node_info', { nodeId: tiles[0].id });
  console.log('sample tile', one.name, one.width + 'x' + one.height, 'r=' + one.cornerRadius, 'clips=' + one.clipsContent, 'effects=' + (one.effects || []).map(e => e.type + ':' + e.radius).join(','), 'kids=' + (one.children || []).length);
  for (const l of labels) console.log('label', l.id, l.name);
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
