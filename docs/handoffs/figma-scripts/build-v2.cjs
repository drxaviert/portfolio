// Builds the v2 revision rows as NEW rows below the originals. Originals untouched.
//   node build-v2.cjs              -> all four rows
//   node build-v2.cjs "Silk wave"  -> rebuild just that row
const conn = require('./ws.cjs');
const G = require('./gen-v2.cjs');

const SEC = '133:13342';
const SEC_X = 900, SEC_Y = 14000;
const SHADOW = [
  { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 1 }, radius: 3, spread: 0, visible: true, blendMode: 'NORMAL' },
  { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.06 }, offset: { x: 0, y: 8 }, radius: 24, spread: 0, visible: true, blendMode: 'NORMAL' },
];
const hexToRgba = h => { const n = parseInt(h.slice(1), 16); return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, a: 1 }; };
const colX = i => 304 + i * 897;          // section-relative
const rowY = j => 192 + j * 324;          // section-relative
// v2 rows continue the grid after the four originals (j = 0..3)
const ROW_J = { 'Faithful': 4, 'Fibre lamp': 5, 'Depth': 6, 'Silk wave': 7 };
const LABEL_SRC = { 'Faithful': '133:13349', 'Fibre lamp': '133:13352', 'Depth': '133:13355', 'Silk wave': '133:13358' };
const LABEL_NOTE = {
  'Faithful': 'same fan, feathered glow',
  'Fibre lamp': 'same fibres, feathered glow',
  'Depth': '3 parallax layers, fog',
  'Silk wave': 'brushed silk, one fold',
};

(async () => {
  const { call, close } = await conn();
  const only = process.argv[2];
  const dirs = only ? [only] : G.DIRS;
  for (const d of dirs) if (!(d in ROW_J)) throw new Error('unknown row ' + d);

  // clear only v2 nodes for the rows we are (re)building
  const sec = await call('get_node_info', { nodeId: SEC, depth: 1 });
  for (const d of dirs) {
    const stale = (sec.children || []).filter(c => c.name.startsWith(`${d} · v2`));
    for (const c of stale) { await call('delete_node', { nodeId: c.id }); console.log('removed stale', c.id, c.name); }
  }

  for (const d of dirs) {
    const j = ROW_J[d];
    // label
    const cp = await call('clone_node', { nodeId: LABEL_SRC[d], parentId: SEC });
    await call('move_node', { nodeId: cp.id, x: 64, y: rowY(j) });
    await call('rename_node', { nodeId: cp.id, name: `${d} · v2` });
    const li = await call('get_node_info', { nodeId: cp.id });
    for (const c of li.children || []) {
      if (c.name === 'name') await call('set_text_content', { nodeId: c.id, text: `${d} · v2` });
      if (c.name === 'axis') await call('set_text_content', { nodeId: c.id, text: LABEL_NOTE[d] });
    }
    console.log('label', cp.id, `${d} · v2`);

    for (let i = 0; i < 4; i++) {
      const phase = G.COLS[i];
      const t = G.tileLayers(d, phase);
      const name = `${d} · v2 · ${phase}`;
      const fr = await call('create_frame', {
        x: SEC_X + colX(i), y: SEC_Y + rowY(j), width: 849, height: 276,
        name, parentId: SEC, fillColor: hexToRgba(t.fill),
      });
      await call('move_node', { nodeId: fr.id, x: colX(i), y: rowY(j) });
      await call('set_corner_radius', { nodeId: fr.id, radius: 12 });
      await call('set_effects', { nodeId: fr.id, effects: SHADOW });
      for (const layer of t.layers) {
        const sv = await call('set_svg', { svgString: layer.svg, x: 0, y: 0, parentId: fr.id, name: layer.name }, 180000);
        const sid = sv && (sv.id || (sv.node && sv.node.id));
        if (layer.blur && sid) {
          await call('set_effects', { nodeId: sid, effects: [{ type: 'LAYER_BLUR', radius: layer.blur, visible: true }] });
        }
      }
      const info = await call('get_node_info', { nodeId: fr.id });
      console.log(fr.id, name, JSON.stringify(info.absoluteBoundingBox), 'layers', (info.children || []).length);
    }
  }

  // grow the section to fit the new rows (never shrink it)
  const needH = rowY(ROW_J['Silk wave']) + 276 + 64;
  const cur = await call('get_node_info', { nodeId: SEC });
  const curH = (cur.absoluteBoundingBox || {}).height || cur.height || 0;
  const curW = (cur.absoluteBoundingBox || {}).width || cur.width || 3908;
  if (curH < needH) await call('resize_node', { nodeId: SEC, width: curW, height: needH });
  const after = await call('get_node_info', { nodeId: SEC });
  console.log('section', after.id, JSON.stringify(after.absoluteBoundingBox));
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
