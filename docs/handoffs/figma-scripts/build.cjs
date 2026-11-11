// Builds the Play card variation section on the Exploration page.
const conn = require('./ws.cjs');
const G = require('./gen.cjs');

const PAGE = '127:9124';
const SX = 900, SY = 14000;
const PAD = 64, LABELW = 240, COLS_GAP = 48, TILEW = 849, TILEH = 276, ROWGAP = 48;
const GRIDX = PAD + LABELW;
const SECW = GRIDX + 4 * TILEW + 3 * COLS_GAP + PAD;
const SECH = 192 + 4 * TILEH + 3 * ROWGAP + PAD;
const colX = i => GRIDX + i * (TILEW + COLS_GAP);
const rowY = j => 192 + j * (TILEH + ROWGAP);

const META = [
  { dir: 'Faithful', axis: 'static fidelity to the reference' },
  { dir: 'Fibre lamp', axis: 'strands that droop under gravity' },
  { dir: 'Depth', axis: 'three stacked fans, blurred behind' },
  { dir: 'Silk wave', axis: 'one brushed ribbon, colour-graded' },
];

const SHADOW = [
  { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 1 }, radius: 3, spread: 0, visible: true, blendMode: 'NORMAL' },
  { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.06 }, offset: { x: 0, y: 8 }, radius: 24, spread: 0, visible: true, blendMode: 'NORMAL' },
];

async function build(mode) {
  const { call, close } = await conn();
  const log = (...a) => console.log(...a);
  await call('set_current_page', { pageId: PAGE });
  const T = mode === 'test';
  const sec = await call('create_section', {
    x: T ? SX : SX, y: T ? 15600 : SY, width: SECW, height: SECH, name: T ? 'Play card · variations · TEST' : 'Play card · variations', parentId: PAGE,
    fillColor: { r: 0.957, g: 0.957, b: 0.961, a: 1 },
  });
  const secId = sec.id || sec.nodeId || (sec.section && sec.section.id);
  log('section', secId, JSON.stringify(sec).slice(0, 160));

  // header text
  await call('create_text', { x: PAD, y: 50, text: 'Play card · variations', fontSize: 28, fontWeight: 600, parentId: secId, name: 'Title', fontColor: { r: 0.06, g: 0.06, b: 0.08, a: 1 } });
  await call('create_text', { x: PAD, y: 94, text: '849 × 276 · radius 12 · four directions × four phases', fontSize: 14, fontWeight: 400, parentId: secId, name: 'Subtitle', fontColor: { r: 0.35, g: 0.35, b: 0.4, a: 1 } });
  for (let i = 0; i < 4; i++) {
    await call('create_text', { x: colX(i) + 2, y: 154, text: G.COLS[i], fontSize: 14, fontWeight: 600, parentId: secId, name: 'Phase · ' + G.COLS[i], fontColor: { r: 0.25, g: 0.25, b: 0.3, a: 1 } });
  }
  for (let j = 0; j < META.length; j++) {
    const lab = await call('create_frame', { x: PAD, y: rowY(j), width: LABELW - 32, height: 64, name: 'Label · ' + META[j].dir, parentId: secId, fillColor: { r: 0, g: 0, b: 0, a: 0 } });
    await call('create_text', { x: 0, y: 0, text: META[j].dir, fontSize: 15, fontWeight: 600, parentId: lab.id, name: 'name', fontColor: { r: 0.1, g: 0.1, b: 0.12, a: 1 }, textAutoResize: 'WIDTH_AND_HEIGHT' });
    await call('create_text', { x: 0, y: 24, text: META[j].axis, fontSize: 13, fontWeight: 400, parentId: lab.id, name: 'axis', fontColor: { r: 0.42, g: 0.42, b: 0.47, a: 1 }, width: LABELW - 40, textAutoResize: 'HEIGHT' });
  }

  const rows = [];
  const dirs = mode === 'test' ? [META[0]] : META;
  for (let j = 0; j < dirs.length; j++) {
    const ids = [];
    const phases = mode === 'test' ? ['Day'] : G.COLS;
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const t = G.tileLayers(dirs[j].dir, phase);
      const fr = await call('create_frame', {
        x: colX(i), y: rowY(j), width: TILEW, height: TILEH,
        name: `Play · ${dirs[j].dir} · ${phase}`, parentId: secId,
        fillColor: { ...hexToRgba(t.fill) },
      });
      await call('set_corner_radius', { nodeId: fr.id, radius: 12 });
      await call('set_effects', { nodeId: fr.id, effects: SHADOW });
      for (const layer of t.layers) {
        const svgNode = await call('set_svg', { svgString: layer.svg, x: 0, y: 0, parentId: fr.id, name: layer.name });
        if (layer.blur) {
          const id = svgNode.id || (svgNode.node && svgNode.node.id);
          if (id) await call('set_effects', { nodeId: id, effects: [{ type: 'LAYER_BLUR', radius: layer.blur, visible: true }] });
        }
      }
      const info = await call('get_node_info', { nodeId: fr.id });
      ids.push({ id: fr.id, clips: info.clipsContent, kids: (info.children || []).length });
      log('tile', fr.id, dirs[j].dir, phase, 'clips=' + info.clipsContent, 'kids=' + (info.children || []).length);
    }
    rows.push({ dir: dirs[j].dir, ids });
  }
  log('SECTION', secId);
  log('ROWS', JSON.stringify(rows));
  close();
}

function hexToRgba(h) {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, a: 1 };
}

build(process.argv[2] || 'all').catch(e => { console.error('ERR', e.message); process.exit(1); });
