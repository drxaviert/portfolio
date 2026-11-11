// Recolour every tile in the section, keeping each frame node (id, size, radius,
// shadow, position) exactly as it is. Only fills + SVG layers are replaced.
const conn = require('./ws.cjs');
const G = require('./gen.cjs');

const SEC = '133:13342';
const VAR = { Dawn: 'VariableID:131:10675', Day: 'VariableID:102:1708', Dusk: 'VariableID:131:10697', Night: 'VariableID:102:1707' };
const hexToRgba = h => { const n = parseInt(h.slice(1), 16); return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, a: 1 }; };

(async () => {
  const { call, close } = await conn();
  const sec = await call('get_node_info', { nodeId: SEC, depth: 1 });
  const only = process.argv[2];
  const tiles = (sec.children || []).filter(c => c.name.startsWith('Play · ') && (!only || c.name.startsWith('Play · ' + only + ' · ')));
  console.log('tiles', tiles.length);
  for (const t of tiles) {
    const [, dir, phase] = t.name.split(' · ');
    const layers = G.tileLayers(dir, phase);
    const info = await call('get_node_info', { nodeId: t.id, depth: 1 });
    for (const c of info.children || []) await call('delete_node', { nodeId: c.id });
    await call('set_fill_color', { nodeId: t.id, color: hexToRgba(layers.fill) });
    for (const layer of layers.layers) {
      const sv = await call('set_svg', { svgString: layer.svg, x: 0, y: 0, parentId: t.id, name: layer.name }, 120000);
      if (layer.blur) {
        const sid = sv.id || (sv.node && sv.node.id);
        if (sid) await call('set_effects', { nodeId: sid, effects: [{ type: 'LAYER_BLUR', radius: layer.blur, visible: true }] });
      }
    }
    try {
      await call('apply_variable_to_node', { nodeId: t.id, variableId: VAR[phase], field: 'fills/0/color' });
    } catch (e) { console.log('  bind failed', t.id, e.message); }
    console.log(t.id, dir, phase, 'fill', layers.fill, 'layers', layers.layers.length);
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
