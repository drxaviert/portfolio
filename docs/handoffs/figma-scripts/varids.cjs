const conn = require('./ws.cjs');
(async () => {
  const { call, close } = await conn();
  const v = await call('get_variables', {}, 60000);
  for (const col of v.collections) {
    if (!/Color ·/.test(col.name)) continue;
    const sc = (col.variables || []).filter(x => /surface-container$/.test(x.name) || /surface-container-low$/.test(x.name));
    console.log(col.name, sc.map(x => x.name + '=' + x.id).join('  '));
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
