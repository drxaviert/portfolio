// Delete the partially built "Work card · corner button" section so the builder can rerun.
// Only touches nodes created by buildCornerButton.cjs.
const conn = require('./ws.cjs');
const IDS = process.argv.slice(2);
(async () => {
  const { call, close } = await conn();
  for (const id of IDS) {
    const r = await call('delete_node', { nodeId: id }, 40000);
    console.log('deleted', id, JSON.stringify(r));
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
