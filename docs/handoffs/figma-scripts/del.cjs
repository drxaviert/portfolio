const conn = require('./ws.cjs');
(async () => {
  const { call, close } = await conn();
  await call('set_current_page', { pageId: '127:9124' });
  for (const id of process.argv.slice(2)) {
    const r = await call('delete_node', { nodeId: id });
    console.log('deleted', id, JSON.stringify(r));
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
