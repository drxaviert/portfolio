// Test whether createNodeFromSvg honours <clipPath> (and gradient + opacity).
const conn = require('./ws.cjs');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
<defs>
<clipPath id="c"><rect x="0" y="0" width="120" height="120" rx="16"/></clipPath>
<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120">
<stop offset="0" stop-color="#ff0000" stop-opacity="1"/><stop offset="1" stop-color="#0000ff" stop-opacity="0.2"/>
</linearGradient>
</defs>
<g clip-path="url(#c)"><rect x="-20" y="-20" width="200" height="200" fill="url(#g)"/></g>
</svg>`;
(async () => {
  const { call, close } = await conn();
  const r = await call('set_svg', { svgString: svg, x: 20000, y: 20000, name: 'zz clip test' });
  console.log('created', JSON.stringify(r));
  const info = await call('get_node_info', { nodeId: r.id, depth: 3 });
  const walk = (n, d = 0) => {
    console.log(' '.repeat(d), n.id, n.type, JSON.stringify(n.name), 'mask?', n.isMask, 'clips?', n.clipsContent, 'bb', JSON.stringify(n.absoluteBoundingBox), 'fill', n.fills && n.fills[0] ? n.fills[0].type : '');
    for (const c of (n.children || [])) walk(c, d + 2);
  };
  walk(info);
  await call('delete_node', { nodeId: r.id });
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
