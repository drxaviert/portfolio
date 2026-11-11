// Export a node to a PNG file. usage: node workcard-export.cjs <nodeId> <outPath> [scale]
const conn = require('./ws.cjs');
const fs = require('fs');
const [nodeId, outPath, scale = '1'] = process.argv.slice(2);
(async () => {
  const { call, close } = await conn();
  const r = await call('export_node_as_image', { nodeId, scale: Number(scale), format: 'PNG' }, 120000);
  const data = r.imageData || r.data || r.image || r.base64;
  if (!data) { console.log('unexpected result keys:', Object.keys(r)); close(); process.exit(1); }
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log('wrote', outPath, fs.statSync(outPath).size, 'bytes', JSON.stringify({ w: r.width, h: r.height, mimeType: r.mimeType }));
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
