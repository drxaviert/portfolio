// Rebuild given tiles in place: node redo.cjs <tileId> [tileId...]
const conn = require('./ws.cjs');
const G = require('./gen.cjs');

const SHADOW = [
  { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 1 }, radius: 3, spread: 0, visible: true, blendMode: 'NORMAL' },
  { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.06 }, offset: { x: 0, y: 8 }, radius: 24, spread: 0, visible: true, blendMode: 'NORMAL' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hexToRgba = h => { const n = parseInt(h.slice(1), 16); return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, a: 1 }; };

(async () => {
  const { call, close } = await conn();
  const retry = async (c, p, n = 3, t = 25000) => {
    for (let i = 0; i < n; i++) {
      try { return await call(c, p, t); }
      catch (e) { console.log('  retry', c, i + 1, e.message); await sleep(700); }
    }
    throw new Error(c + ' failed');
  };
  await retry('get_pages');
  for (const id of process.argv.slice(2)) {
    const n = await retry('get_node_info', { nodeId: id });
    const [, dir, phase] = n.name.split(' · ');
    const parentId = n.parent && n.parent.id;
    const t = G.tileLayers(dir, phase);
    await retry('delete_node', { nodeId: id });
    const fr = await retry('create_frame', {
      x: n.x, y: n.y, width: 849, height: 276, name: n.name, parentId,
      fillColor: hexToRgba(t.fill),
    });
    await retry('set_corner_radius', { nodeId: fr.id, radius: 12 });
    await retry('set_effects', { nodeId: fr.id, effects: SHADOW });
    for (const layer of t.layers) {
      const sv = await retry('set_svg', { svgString: layer.svg, x: 0, y: 0, parentId: fr.id, name: layer.name }, 3, 120000);
      if (layer.blur) {
        const sid = sv.id || (sv.node && sv.node.id);
        if (sid) await retry('set_effects', { nodeId: sid, effects: [{ type: 'LAYER_BLUR', radius: layer.blur, visible: true }] });
      }
    }
    console.log('rebuilt', id, '->', fr.id, n.name);
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
