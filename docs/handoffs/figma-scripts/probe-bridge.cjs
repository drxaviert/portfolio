// Probe the talk-to-figma bridge for a live plugin on a channel.
//   node probe-bridge.cjs [channel] [seconds]
const ch = process.argv[2] || '1bhk4343';
const secs = Number(process.argv[3] || 20);
const ws = new WebSocket('ws://localhost:3055');
let answered = false;
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'join', channel: ch }));
  setTimeout(() => ws.send(JSON.stringify({ id: 'p1', type: 'message', channel: ch, message: { id: 'p1', command: 'ping', params: { commandId: 'p1' } } })), 400);
};
ws.onmessage = e => {
  const s = String(e.data);
  console.log('MSG', s.slice(0, 300));
  if (s.includes('p1') && !answered) { answered = true; console.log('PLUGIN ANSWERED'); process.exit(0); }
};
ws.onerror = e => console.log('ERR', e.message);
setTimeout(() => { console.log('no plugin answer in ' + secs + 's'); process.exit(answered ? 0 : 2); }, secs * 1000);
