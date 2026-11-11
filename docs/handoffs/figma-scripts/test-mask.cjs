// Test whether createNodeFromSvg honours <mask> with a gradient fill (fade).
const conn = require('./ws.cjs');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
<defs><mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="80">
<rect x="0" y="0" width="120" height="80" fill="url(#fg)"/>
</mask>
<linearGradient id="fg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="80">
<stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#ffffff" stop-opacity="1"/>
</linearGradient></defs>
<g mask="url(#fade)"><rect x="0" y="0" width="120" height="80" fill="#ff0000"/></g>
</svg>`;
(async () => {
  const { call, close } = await conn();
  const r = await call('set_svg', { svgString: svg, x: 20000, y: 20000, name: 'zz mask test' });
  console.log('created', JSON.stringify(r));
  const info = await call('get_node_info', { nodeId: r.id, depth: 3 });
  const walk = (n, d = 0) => {
    console.log(' '.repeat(d), n.id, n.type, JSON.stringify(n.name), 'mask?', n.isMask, 'clip?', n.clipsContent,
      'bb', JSON.stringify(n.absoluteBoundingBox), 'fill', n.fills && n.fills[0] ? n.fills[0].type : '');
    for (const c of (n.children || [])) walk(c, d + 2);
  };
  walk(info);
  await call('delete_node', { nodeId: r.id });
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
