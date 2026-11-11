// Builds (or rebuilds) the four Silk wave tiles directly inside the section.
const conn = require('./ws.cjs');
const G = require('./gen.cjs');

const SEC = '133:13342';
const SHADOW = [
  { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 1 }, radius: 3, spread: 0, visible: true, blendMode: 'NORMAL' },
  { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.06 }, offset: { x: 0, y: 8 }, radius: 24, spread: 0, visible: true, blendMode: 'NORMAL' },
];
const hexToRgba = h => { const n = parseInt(h.slice(1), 16); return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, a: 1 }; };
const colX = i => 304 + i * 897;
const ROWY = 1164;

(async () => {
  const { call, close } = await conn();
  for (let i = 0; i < 4; i++) {
    const phase = G.COLS[i];
    const t = G.tileLayers('Silk wave', phase);
    const fr = await call('create_frame', {
      x: colX(i), y: ROWY, width: 849, height: 276, name: `Play · Silk wave · ${phase}`,
      parentId: SEC, fillColor: hexToRgba(t.fill),
    });
    await call('insert_child', { parentId: SEC, childId: fr.id });
    await call('move_node', { nodeId: fr.id, x: colX(i), y: ROWY });
    await call('set_corner_radius', { nodeId: fr.id, radius: 12 });
    await call('set_effects', { nodeId: fr.id, effects: SHADOW });
    for (const layer of t.layers) {
      const sv = await call('set_svg', { svgString: layer.svg, x: 0, y: 0, parentId: fr.id, name: layer.name }, 120000);
      if (layer.blur) {
        const sid = sv.id || (sv.node && sv.node.id);
        if (sid) await call('set_effects', { nodeId: sid, effects: [{ type: 'LAYER_BLUR', radius: layer.blur, visible: true }] });
      }
    }
    const info = await call('get_node_info', { nodeId: fr.id });
    console.log(fr.id, phase, 'bb', JSON.stringify(info.absoluteBoundingBox), 'parent', info.parent && info.parent.id, 'kids', (info.children || []).length);
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
