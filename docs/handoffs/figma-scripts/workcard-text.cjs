// Probe: text style details (font, size, weight, line height, letter spacing) for chosen text nodes.
const conn = require('./ws.cjs');
const IDS = process.argv.slice(2);
(async () => {
  const { call, close } = await conn();
  for (const id of IDS) {
    try {
      const n = await call('get_node_info', { nodeId: id, depth: 0 }, 30000);
      const s = n.style || {};
      console.log(id, JSON.stringify(n.characters), '|', s.fontFamily, s.fontWeight, s.fontSize + 'px', 'lh=' + (s.lineHeightPx ?? '-'), 'ls=' + (s.letterSpacing ?? '-'),
        '| styleId=' + JSON.stringify(n.styles && n.styles.text || null), '| ' + Math.round(n.absoluteBoundingBox?.width) + 'x' + Math.round(n.absoluteBoundingBox?.height));
    } catch (e) { console.log(id, 'ERR', e.message); }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
