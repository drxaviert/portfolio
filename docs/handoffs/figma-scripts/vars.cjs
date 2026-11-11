const conn = require('./ws.cjs');
const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

(async () => {
  const { call, close } = await conn();
  const v = await call('get_variables', {}, 60000);
  const want = ['surface-container', 'surface-container-low', 'surface-container-high', 'surface', 'primary', 'secondary', 'tracker/1', 'tracker/2', 'tracker/3', 'tracker/4'];
  for (const col of v.collections) {
    if (!/Color ·/.test(col.name)) continue;
    const rows = [];
    for (const vv of col.variables || []) {
      const base = vv.name.split('/').pop();
      if (want.some(w => vv.name.endsWith(w)) || want.includes(vv.name)) {
        const val = Object.values(vv.valuesByMode)[0];
        rows.push(vv.name + '=' + hex(val));
      }
    }
    console.log('##', col.name, col.id);
    console.log(rows.join('  '));
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
