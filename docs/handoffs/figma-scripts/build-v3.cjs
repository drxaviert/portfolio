// Builds the Faithful · v3 row: fixes the approved Day tile in place and adds
// Dawn / Dusk / Night from each phase's v2 tile. Then groups the four for export.
//   node build-v3.cjs
const conn = require('./ws.cjs');
const G = require('./gen-v3.cjs');

const SEC = '133:13342';
const SEC_X = 900, SEC_Y = 14000;
const V2 = { Dawn: '143:14996', Day: '143:15019', Dusk: '143:15042', Night: '143:15065' };
const COL = { Dawn: 0, Day: 1, Dusk: 2, Night: 3 };
const ROW = 8;                 // after Silk wave v2 (row 7)
const GROUP = 'Faithful · v3 · row';
const colX = i => 304 + i * 897;
const rowY = j => 192 + j * 324;

const hexToRgba = h => { const n = parseInt(h.slice(1), 16); return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, a: 1 }; };
const nid = r => r && (r.id || (r.node && r.node.id));
const PLACEHOLDER = (w, h, r, fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="${fill}"/></svg>`;

(async () => {
  const { call, close } = await conn();

  // a previous run leaves the row grouped; flatten it so the rebuild is simple
  const sec = await call('get_node_info', { nodeId: SEC, depth: 1 });
  const grp = (sec.children || []).find(c => c.name === GROUP);
  if (grp) { await call('ungroup_nodes', { nodeId: grp.id }); console.log('ungrouped', grp.id); }

  const kids = (await call('get_node_info', { nodeId: SEC, depth: 1 })).children || [];
  const tiles = [];

  for (const phase of G.COLS) {
    const t = G.tileLayers(phase);
    const name = `Faithful · v3 · ${phase}`;
    const existing = kids.find(c => c.name === name);

    if (existing) {
      // approved tile: rebuild its art layers in place, keep the card node
      const card = await call('get_node_info', { nodeId: existing.id, depth: 2 });
      const panel = (card.children || []).find(c => c.name === 'art panel');
      if (!panel) throw new Error('no art panel on ' + existing.id);
      const pd = await call('get_node_info', { nodeId: panel.id });
      for (const c of pd.children || []) await call('delete_node', { nodeId: c.id });
      await addArt(call, panel.id, phase);
      const after = await call('get_node_info', { nodeId: existing.id });
      console.log('fixed in place', existing.id, name, JSON.stringify(after.absoluteBoundingBox));
      tiles.push(existing.id);
      continue;
    }

    // new phase: clone its own v2 tile so the card fill / radius / shadow carry over
    const card = await call('clone_node', { nodeId: V2[phase], parentId: SEC, x: colX(COL[phase]), y: rowY(ROW) });
    await call('rename_node', { nodeId: card.id, name });
    const info = await call('get_node_info', { nodeId: card.id });
    for (const c of info.children || []) await call('delete_node', { nodeId: c.id });

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
    await addArt(call, panelId, phase);

    const after = await call('get_node_info', { nodeId: card.id });
    const pin = await call('get_node_info', { nodeId: panelId });
    console.log('created', card.id, name, JSON.stringify(after.absoluteBoundingBox),
      'panel', panelId, JSON.stringify(pin.absoluteBoundingBox), 'clips', pin.clipsContent,
      'card fill', JSON.stringify(after.fills && after.fills[0] && after.fills[0].color));
    tiles.push(card.id);
  }

  // group the four tiles so the row can be exported as one node
  const g = await call('group_nodes', { nodeIds: tiles, name: GROUP });
  console.log('group', g.id, g.name, g.children.map(c => `${c.name}(${c.id})`).join(', '));

  const gInfo = await call('get_node_info', { nodeId: g.id });
  console.log('group bb', JSON.stringify(gInfo.absoluteBoundingBox));

  const s = await call('get_node_info', { nodeId: SEC });
  const bb = s.absoluteBoundingBox || {};
  if (bb.height < rowY(ROW) + G.CARD_H + 64) {
    await call('resize_node', { nodeId: SEC, width: bb.width, height: rowY(ROW) + G.CARD_H + 64 });
  }
  console.log('section', JSON.stringify((await call('get_node_info', { nodeId: SEC })).absoluteBoundingBox));
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

async function addArt(call, panelId, phase) {
  const t = G.tileLayers(phase);
  for (const layer of t.layers) {
    const sv = await call('set_svg', { svgString: layer.svg, x: 0, y: 0, parentId: panelId, name: layer.name }, 180000);
    const sid = nid(sv);
    if (layer.blur && sid) {
      await call('set_effects', { nodeId: sid, effects: [{ type: 'LAYER_BLUR', radius: layer.blur, visible: true }] });
    }
  }
}
