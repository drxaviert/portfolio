// Probe: locate the main work card inside Final · Light (102:1757) and Final · Dark (102:1214).
const conn = require('./ws.cjs');
const FRAMES = { Day: '102:1757', Night: '102:1214' };

const bb = n => n.absoluteBoundingBox ? `${Math.round(n.absoluteBoundingBox.x)},${Math.round(n.absoluteBoundingBox.y)} ${Math.round(n.absoluteBoundingBox.width)}x${Math.round(n.absoluteBoundingBox.height)}` : `${n.width}x${n.height}`;

(async () => {
  const { call, close } = await conn();
  const doc = await call('get_document_info');
  console.log('doc:', doc.name, '| pages:', (doc.pages || []).map(p => `${p.name}(${p.id})`).join(', '));
  for (const [phase, id] of Object.entries(FRAMES)) {
    try {
      const n = await call('get_node_info', { nodeId: id, depth: 2 }, 60000);
      console.log(`\n## ${phase} ${id} "${n.name}" ${bb(n)} type=${n.type}`);
      for (const c of n.children || []) {
        console.log('  ', c.id, c.type, JSON.stringify(c.name), bb(c),
          'kids=' + ((c.children || []).length),
          'r=' + JSON.stringify(c.cornerRadius ?? null),
          'eff=' + JSON.stringify((c.effects || []).map(e => e.type + (e.radius ?? '') + '/' + (e.styleId ? 'style' : 'local'))));
      }
    } catch (e) { console.log(`## ${phase} ERR`, e.message); }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
