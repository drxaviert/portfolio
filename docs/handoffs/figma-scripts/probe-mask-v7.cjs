// Probe: does Figma's set_svg keep a radial gradient with gradientTransform
// inside a mask? Imports a 200x120 test frame, exports it, then removes it.
//   node probe-mask-v7.cjs
const fs = require('fs');
const conn = require('./ws.cjs');

const W = 200, H = 120;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<radialGradient id="fg" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(100 130) scale(96 90)">
<stop offset="0" stop-color="#ffffff" stop-opacity="1"/>
<stop offset="0.5" stop-color="#ffffff" stop-opacity="1"/>
<stop offset="0.85" stop-color="#ffffff" stop-opacity="0.4"/>
<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>
<mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="url(#fg)"/>
</mask>
</defs>
<rect width="${W}" height="${H}" fill="#dddddd"/>
<g mask="url(#fade)">
<path d="M100,130 L100,20" fill="none" stroke="#ff0000" stroke-width="6" stroke-linecap="round"/>
<path d="M100,130 L20,60" fill="none" stroke="#ff0000" stroke-width="6" stroke-linecap="round"/>
<path d="M100,130 L180,60" fill="none" stroke="#ff0000" stroke-width="6" stroke-linecap="round"/>
</g>
</svg>`;

(async () => {
  const { call, close } = await conn();
  const nid = r => r && (r.id || (r.node && r.node.id));
  // keep the probe well clear of the rows, then delete it
  const f = await call('create_frame', { x: 6000, y: 14000, width: W, height: H, name: 'PROBE mask v7', parentId: '133:13342' }, 60000);
  const frameId = nid(f);
  const sv = await call('set_svg', { svgString: svg, x: 0, y: 0, parentId: frameId, name: 'probe art' }, 60000);
  console.log('frame', frameId, 'svg node', nid(sv));
  const kids = await call('get_node_info', { nodeId: frameId, depth: 3 }, 60000);
  const walk = (n, d = 0) => {
    console.log(' '.repeat(d) + n.id + ' ' + n.type + ' ' + JSON.stringify(n.name) + ' ' + JSON.stringify(n.absoluteBoundingBox));
    for (const c of n.children || []) walk(c, d + 2);
  };
  walk(kids);
  const img = await call('export_node_as_image', { nodeId: frameId, format: 'PNG', scale: 3 }, 120000);
  if (img && img.imageData) {
    fs.writeFileSync(__dirname + '/../../handoffs/play-cards/_probe-mask-v7.png', Buffer.from(img.imageData, 'base64'));
    console.log('wrote _probe-mask-v7.png');
  }
  await call('delete_node', { nodeId: frameId }, 60000);
  console.log('probe frame removed');
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
