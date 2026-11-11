// Test: does a radial-gradient *stroke* survive createNodeFromSvg?
const conn = require('./ws.cjs');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
<defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="60" cy="120" r="110">
<stop offset="0" stop-color="#EFBE8C" stop-opacity="0.9"/>
<stop offset="0.45" stop-color="#3687D9" stop-opacity="0.9"/>
<stop offset="1" stop-color="#2A5FD0" stop-opacity="0.9"/>
</radialGradient></defs>
<g clip-path="url(#none)"></g>
<path d="M60,115 L60,10" fill="none" stroke="url(#g)" stroke-width="2"/>
<path d="M60,115 L110,40" fill="none" stroke="url(#g)" stroke-width="1"/>
</svg>`;
(async () => {
  const { call, close } = await conn();
  const r = await call('set_svg', { svgString: svg, x: 20000, y: 20000, name: 'zz radial stroke test' });
  const info = await call('get_node_info', { nodeId: r.id, depth: 3 });
  const walk = (n, d = 0) => {
    console.log(' '.repeat(d), n.id, n.type, JSON.stringify(n.name), 'bb', JSON.stringify(n.absoluteBoundingBox));
    if (n.strokes && n.strokes.length) {
      const st = n.strokes[0];
      console.log(' '.repeat(d + 2), 'stroke', st.type, st.opacity,
        st.gradientStops ? st.gradientStops.map(s => `${s.position.toFixed(2)}:${s.color.r.toFixed(2)},${s.color.g.toFixed(2)},${s.color.b.toFixed(2)}@${(s.color.a).toFixed(2)}`).join(' | ') : '');
    }
    for (const c of (n.children || [])) walk(c, d + 2);
  };
  walk(info);
  await call('delete_node', { nodeId: r.id });
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
