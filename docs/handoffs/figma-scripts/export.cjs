const CH = process.env.FIGMA_CHANNEL || '1bhk4343';
const nodeId = process.argv[2], scale = Number(process.argv[3] || 1), out = process.argv[4];
const ws = new WebSocket('ws://localhost:3055');
const id = 'exp' + Date.now();
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'join', channel: CH }));
  setTimeout(() => {
    ws.send(JSON.stringify({ id, type: 'message', channel: CH, message: { id, command: 'export_node_as_image', params: { nodeId, format: 'PNG', scale, commandId: id } } }));
    console.log('sent export', nodeId, scale);
  }, 400);
};
ws.onmessage = e => {
  const d = JSON.parse(e.data);
  if (d.type === 'system') { console.log('sys', JSON.stringify(d).slice(0, 200)); return; }
  const m = d.message; if (!m) return;
  if (m.id !== id) { console.log('other', m.id, m.error ? 'err' : 'ok'); return; }
  if (m.error) { console.log('ERROR', JSON.stringify(m.error)); process.exit(1); }
  const r = m.result || {};
  console.log('result keys', Object.keys(r));
  const b64 = r.imageData;
  if (b64 && out) {
    const fs = require('fs');
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log('wrote', out, fs.statSync(out).size, 'bytes');
  }
  process.exit(0);
};
setTimeout(() => { console.log('no reply in 180s'); process.exit(2); }, 180000);
