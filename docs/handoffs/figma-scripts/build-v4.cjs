// Builds Faithful · v4 · Day: clones the v3 Day tile into a new row below the
// v3 row and swaps in drooping (weighted-tip) strands. Nothing else changes.
//   node build-v4.cjs
const conn = require('./ws.cjs');
const G = require('./gen-v4.cjs');

const SEC = '133:13342';
const SEC_X = 900, SEC_Y = 14000;
const SRC = '148:16181';        // Faithful · v3 · Day
const SRC_LABEL = '148:16220';  // Faithful · v3 label
const NAME = 'Faithful · v4';
const COL = 1;                  // Day
const ROW = 9;                  // after the v3 row (row 8)
const colX = i => 304 + i * 897;
const rowY = j => 192 + j * 324;

const hexToRgba = h => { const n = parseInt(h.slice(1), 16); return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, a: 1 }; };
const nid = r => r && (r.id || (r.node && r.node.id));
const PLACEHOLDER = (w, h, r, fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="${fill}"/></svg>`;

(async () => {
  const { call, close } = await conn();
  const t = G.tileLayers('Day');

  const sec = await call('get_node_info', { nodeId: SEC, depth: 1 });
  for (const c of (sec.children || []).filter(c => c.name.startsWith(NAME))) {
    await call('delete_node', { nodeId: c.id });
    console.log('removed stale', c.id, c.name);
  }

  // clone the approved v3 Day tile so card fill / radius / shadow carry over
  const card = await call('clone_node', { nodeId: SRC, parentId: SEC, x: colX(COL), y: rowY(ROW) });
  await call('rename_node', { nodeId: card.id, name: `${NAME} · Day` });
  const info = await call('get_node_info', { nodeId: card.id });
  console.log('card', card.id, JSON.stringify(info.absoluteBoundingBox),
    'radius', info.cornerRadius, 'strokes', (info.strokes || []).length,
    'fx', (info.effects || []).map(e => e.type).join('+'),
    'fill', JSON.stringify(info.fills && info.fills[0] && info.fills[0].color));
  for (const c of info.children || []) {
    await call('delete_node', { nodeId: c.id });
    console.log('cleared', c.id, c.name);
  }

  // the 16px inset art panel (created from SVG so clipsContent comes on)
  const pn = await call('set_svg', {
    svgString: PLACEHOLDER(t.panel.w, t.panel.h, t.panel.r, t.cardFill),
    x: t.panel.x, y: t.panel.y, parentId: card.id, name: 'art panel',
  });
  const panelId = nid(pn);
  const pnInfo = await call('get_node_info', { nodeId: panelId });
  for (const c of pnInfo.children || []) await call('delete_node', { nodeId: c.id });
  await call('move_node', { nodeId: panelId, x: t.panel.x, y: t.panel.y });
  await call('set_corner_radius', { nodeId: panelId, radius: t.panel.r });
  await call('set_fill_color', { nodeId: panelId, color: hexToRgba(t.cardFill) });
  const pnAfter = await call('get_node_info', { nodeId: panelId });
  console.log('panel', panelId, JSON.stringify(pnAfter.absoluteBoundingBox),
    'radius', pnAfter.cornerRadius, 'clips', pnAfter.clipsContent);

  for (const layer of t.layers) {
    const sv = await call('set_svg', { svgString: layer.svg, x: 0, y: 0, parentId: panelId, name: layer.name }, 180000);
    const sid = nid(sv);
    if (layer.blur && sid) {
      await call('set_effects', { nodeId: sid, effects: [{ type: 'LAYER_BLUR', radius: layer.blur, visible: true }] });
    }
    console.log('  layer', sid, layer.name);
  }

  // row label, cloned from the v3 label so the type matches
  const lab = await call('clone_node', { nodeId: SRC_LABEL, parentId: SEC });
  await call('move_node', { nodeId: lab.id, x: 64, y: rowY(ROW) });
  await call('rename_node', { nodeId: lab.id, name: NAME });
  const li = await call('get_node_info', { nodeId: lab.id });
  for (const c of li.children || []) {
    if (c.name === 'name') await call('set_text_content', { nodeId: c.id, text: NAME });
    if (c.name === 'axis') await call('set_text_content', { nodeId: c.id, text: 'weighted tips, sagging arcs' });
  }
  console.log('label', lab.id, NAME);

  // grow the section
  const needH = rowY(ROW) + G.CARD_H + 64;
  const cur = await call('get_node_info', { nodeId: SEC });
  const bb = cur.absoluteBoundingBox || {};
  if (bb.height < needH) await call('resize_node', { nodeId: SEC, width: bb.width, height: needH });
  console.log('section', JSON.stringify((await call('get_node_info', { nodeId: SEC })).absoluteBoundingBox));

  const tree = await call('get_node_info', { nodeId: card.id, depth: 2 });
  const walk = (n, d = 0) => {
    console.log(' '.repeat(d), n.id, n.type, JSON.stringify(n.name), 'clip', n.clipsContent,
      JSON.stringify(n.absoluteBoundingBox), 'fx', (n.effects || []).map(e => e.type).join('+'), 'kids', (n.children || []).length);
    for (const c of (n.children || [])) walk(c, d + 2);
  };
  walk(tree);
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
