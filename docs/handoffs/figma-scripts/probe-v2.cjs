// Probe: current page, section geometry and children of "Play card · variations".
const conn = require('./ws.cjs');
const SEC = '133:13342';

(async () => {
  const { call, close } = await conn();
  const doc = await call('get_document_info');
  console.log('doc:', doc.name, 'pages:', (doc.pages || []).map(p => `${p.name}(${p.id})`).join(', '));
  const sec = await call('get_node_info', { nodeId: SEC });
  console.log('sec', JSON.stringify({ id: sec.id, name: sec.name, bb: sec.absoluteBoundingBox, w: sec.width, h: sec.height, type: sec.type }));
  const kids = sec.children || [];
  console.log('children', kids.length);
  for (const c of kids) {
    console.log(' ', c.id, JSON.stringify(c.name), c.absoluteBoundingBox ? `${c.absoluteBoundingBox.x},${c.absoluteBoundingBox.y} ${c.absoluteBoundingBox.width}x${c.absoluteBoundingBox.height}` : `${c.width}x${c.height}`);
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
