// Probe: full detail of the candidate work cards (Day 102:1766 / Night 102:1223), plus sibling frames.
const conn = require('./ws.cjs');
const IDS = process.argv.slice(2);

const hx = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('') + (c.a !== undefined && c.a < 1 ? '@' + c.a.toFixed(2) : '');
const paints = ps => (ps || []).map(p => p.type === 'SOLID' ? `SOLID ${hx(p.color)} op${p.opacity ?? 1}` : p.type);

(async () => {
  const { call, close } = await conn();
  for (const id of IDS) {
    const n = await call('get_node_info', { nodeId: id, depth: 1 }, 60000);
    console.log('\n###', n.id, n.type, JSON.stringify(n.name), `${n.width}x${n.height}`,
      'r=' + JSON.stringify(n.cornerRadius ?? n.rectangleCornerRadii ?? null));
    console.log('  fills:', paints(n.fills), '| bound:', JSON.stringify((n.boundVariables || {}).fills || null));
    console.log('  strokes:', paints(n.strokes), '| strokeWeight:', n.strokeWeight ?? null);
    console.log('  effects:', JSON.stringify(n.effects || []));
    console.log('  padding:', JSON.stringify({ l: n.paddingLeft, r: n.paddingRight, t: n.paddingTop, b: n.paddingBottom, gap: n.itemSpacing, layout: n.layoutMode, align: n.primaryAxisAlignItems, counter: n.counterAxisAlignItems }));
    for (const c of n.children || []) {
      console.log('   -', c.id, c.type, JSON.stringify(c.name), `${Math.round(c.width)}x${Math.round(c.height)}`, '@' + Math.round(c.x) + ',' + Math.round(c.y));
      console.log('     fills:', paints(c.fills), '| r=' + JSON.stringify(c.cornerRadius ?? null), '| eff=' + JSON.stringify((c.effects || []).map(e => e.type)));
      if (c.type === 'TEXT') console.log('     text:', JSON.stringify(c.characters), 'font:', JSON.stringify(c.fontName), c.fontSize, 'lh=' + JSON.stringify(c.lineHeight), 'ls=' + JSON.stringify(c.letterSpacing));
    }
  }
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
