// Final verification: v2 rows present at the expected grid, originals untouched.
const conn = require('./ws.cjs');
const SEC = '133:13342';
const ORIG = ['133:13361', '133:13373', '133:13385', '133:13397', '133:13409', '133:13422', '133:13435', '133:13448',
  '135:14215', '135:14237', '135:14259', '135:14281', '136:14303', '136:14323', '136:14343', '136:14363'];

(async () => {
  const { call, close } = await conn();
  const sec = await call('get_node_info', { nodeId: SEC, depth: 1 });
  console.log('section', JSON.stringify(sec.absoluteBoundingBox), 'children', (sec.children || []).length);
  const kids = sec.children || [];
  const orig = kids.filter(c => ORIG.includes(c.id));
  console.log('originals still present:', orig.length, '/ 16');
  const v2 = kids.filter(c => c.name.includes('· v2'));
  const byRow = {};
  for (const c of v2) {
    const row = c.name.split(' · v2')[0];
    (byRow[row] = byRow[row] || []).push(c);
  }
  for (const row of Object.keys(byRow)) {
    console.log('\n' + row + ' · v2');
    for (const c of byRow[row].sort((a, b) => a.absoluteBoundingBox.x - b.absoluteBoundingBox.x)) {
      const bb = c.absoluteBoundingBox;
      const info = c.type === 'FRAME' && c.name.includes(' · ') && c.name.split(' · ').length > 2
        ? await call('get_node_info', { nodeId: c.id }) : null;
      console.log('  ', c.id, JSON.stringify(c.name), c.type, `${bb.width}x${bb.height} @ ${bb.x},${bb.y}`,
        info ? `layers ${(info.children || []).length} radius ${info.cornerRadius} fx ${(info.effects || []).length}` : '');
    }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
