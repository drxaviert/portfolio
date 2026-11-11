// Builds Faithful · v7 · Day: clones the v6 Day card into row 12 and swaps in
// the v7 art (v4 geometry with v3's sizing, page Day background).
//   FIGMA_CHANNEL=<channel> node build-v7.cjs
const conn = require('./ws.cjs');
const G = require('./gen-v7.cjs');

const SEC = '133:13342';
const SRC = '149:16512';        // Faithful · v6 · Day (shell only; children cleared)
const SRC_LABEL = '149:16543';  // Faithful · v6 label
const NAME = 'Faithful · v7';
const COL = 1;                  // Day
const ROW = 12;                 // after the v6 row (row 11)
const colX = i => 304 + i * 897;
const rowY = j => 192 + j * 324;

const hexToRgba = h => { const n = parseInt(h.slice(1), 16); return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, a: 1 }; };
const nid = r => r && (r.id || (r.node && r.node.id));
const PLACEHOLDER = (w, h, r, fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="${fill}"/></svg>`;

(async () => {
  const { call, close } = await conn();
  const t = G.tileLayers('Day');
  console.log('metrics', JSON.stringify(G.metrics('Day')));

  const sec = await call('get_node_info', { nodeId: SEC, depth: 1 }, 60000);
  for (const c of (sec.children || []).filter(c => c.name.startsWith(NAME))) {
    await call('delete_node', { nodeId: c.id }, 60000);
    console.log('removed stale', c.id, c.name);
  }

  const card = await call('clone_node', { nodeId: SRC, parentId: SEC, x: colX(COL), y: rowY(ROW) }, 60000);
  await call('rename_node', { nodeId: card.id, name: `${NAME} · Day` }, 60000);
  const info = await call('get_node_info', { nodeId: card.id }, 60000);
  console.log('card', card.id, JSON.stringify(info.absoluteBoundingBox),
    'radius', info.cornerRadius, 'strokes', (info.strokes || []).length,
    'fx', (info.effects || []).map(e => e.type).join('+'),
    'fill', JSON.stringify(info.fills && info.fills[0] && info.fills[0].color));
  for (const c of info.children || []) {
    await call('delete_node', { nodeId: c.id }, 60000);
    console.log('cleared', c.id, c.name);
  }

  const pn = await call('set_svg', {
    svgString: PLACEHOLDER(t.panel.w, t.panel.h, t.panel.r, t.cardFill),
    x: t.panel.x, y: t.panel.y, parentId: card.id, name: 'art panel',
  }, 120000);
  const panelId = nid(pn);
  const pnInfo = await call('get_node_info', { nodeId: panelId }, 60000);
  for (const c of pnInfo.children || []) await call('delete_node', { nodeId: c.id }, 60000);
  await call('move_node', { nodeId: panelId, x: t.panel.x, y: t.panel.y }, 60000);
  await call('set_corner_radius', { nodeId: panelId, radius: t.panel.r }, 60000);
  await call('set_fill_color', { nodeId: panelId, color: hexToRgba(t.cardFill) }, 60000);
  const pnAfter = await call('get_node_info', { nodeId: panelId }, 60000);
  console.log('panel', panelId, JSON.stringify(pnAfter.absoluteBoundingBox),
    'radius', pnAfter.cornerRadius, 'clips', pnAfter.clipsContent);

  const ids = {};
  for (const layer of t.layers) {
    const sv = await call('set_svg', { svgString: layer.svg, x: 0, y: 0, parentId: panelId, name: layer.name }, 240000);
    const sid = nid(sv);
    ids[layer.name] = sid;
    if (layer.blur && sid) {
      await call('set_effects', { nodeId: sid, effects: [{ type: 'LAYER_BLUR', radius: layer.blur, visible: true }] }, 60000);
    }
    console.log('  layer', sid, layer.name, layer.blur ? 'blur ' + layer.blur : '');
  }

  const lab = await call('clone_node', { nodeId: SRC_LABEL, parentId: SEC }, 60000);
  await call('move_node', { nodeId: lab.id, x: 64, y: rowY(ROW) }, 60000);
  await call('rename_node', { nodeId: lab.id, name: NAME }, 60000);
  const li = await call('get_node_info', { nodeId: lab.id }, 60000);
  for (const c of li.children || []) {
    if (c.name === 'name') await call('set_text_content', { nodeId: c.id, text: NAME }, 60000);
    if (c.name === 'axis') await call('set_text_content', { nodeId: c.id, text: 'v3 sizing, page Day glow' }, 60000);
  }
  console.log('label', lab.id, NAME);

  const needH = rowY(ROW) + G.CARD_H + 64;
  const cur = await call('get_node_info', { nodeId: SEC }, 60000);
  const bb = cur.absoluteBoundingBox || {};
  if (bb.height < needH) await call('resize_node', { nodeId: SEC, width: bb.width, height: needH }, 60000);
  console.log('section', JSON.stringify((await call('get_node_info', { nodeId: SEC }, 60000)).absoluteBoundingBox));

  const tree = await call('get_node_info', { nodeId: card.id, depth: 3 }, 60000);
  const walk = (n, d = 0) => {
    console.log(' '.repeat(d), n.id, n.type, JSON.stringify(n.name), 'clip', n.clipsContent,
      JSON.stringify(n.absoluteBoundingBox), 'fx', (n.effects || []).map(e => e.type + ':' + e.radius).join('+'), 'kids', (n.children || []).length);
    for (const c of (n.children || [])) walk(c, d + 2);
  };
  walk(tree);
  console.log('IDS', JSON.stringify({ card: card.id, panel: panelId, ...ids, label: lab.id }));
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
