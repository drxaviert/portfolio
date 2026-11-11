// Add row "C · Final" to section 147:16070: rest + hover cards per column, 24px arrow.
// Fresh clones of the source cards; no existing node is edited.
const conn = require('./ws.cjs');
const fs = require('fs');
const path = require('path');

const SEC = '147:16070';
const SRC = { Day: '102:1766', Night: '102:1223' };
const T = {
  Day: { accent: '#3687D9', onSurfaceVariant: '#4C4C4C' },
  Night: { accent: '#FD6850', onSurfaceVariant: '#B2B2B2' },
};

const CARD_W = 753, CARD_H = 416;
const COL_X = [64, 64 + CARD_W + 48];    // section-relative
const PLATE = { x: 32, y: 3708, w: 1618, h: 938 };
const SECTION_H = PLATE.y + PLATE.h + 48;   // 4694

const LABEL_Y = 16, REST_Y = 46, CAPTION_Y = 486, HOVER_Y = 506;

// 24px arrow: shaft (4,20)->(20,4), head arms 10 each = ~44% of the 22.6px shaft.
// The visual corner sits at local (20,4); the frame is offset so it lands on the 32px inset.
const ICON = 24;
const CORNER = { x: 20, y: 4 };
const FRAME_X = CARD_W - 32 - CORNER.x;   // 701
const FRAME_Y = 32 - CORNER.y;            // 28
const NUDGE = { x: 2, y: -2 };            // hover motion, icon only

const hex = h => {
  const n = parseInt(h.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
};

const arrowSvg = colour =>
  `<svg width="${ICON}" height="${ICON}" viewBox="0 0 ${ICON} ${ICON}" fill="none" xmlns="http://www.w3.org/2000/svg">` +
  `<path d="M4 20L20 4M10 4H20V14" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

(async () => {
  const { call, close } = await conn();
  const manifestPath = path.join(__dirname, '..', 'work-card', 'manifest.json');
  const ids = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const say = (...a) => console.log(...a);

  const plate = await call('create_frame', {
    x: PLATE.x, y: PLATE.y, width: PLATE.w, height: PLATE.h,
    name: 'C · Final — row', parentId: SEC,
    fillColor: { r: 1, g: 1, b: 1, a: 0 },
  }, 40000);
  say('plate', plate.id, plate.width + 'x' + plate.height);
  ids.cFinal = { plate: plate.id, labels: [], cells: [] };

  const text = async ({ characters, name, x, y, size, color, parentId }) => {
    const t = await call('create_text', {
      x, y, text: characters, fontSize: size, fontWeight: 500,
      fontColor: { ...hex(color), a: 1 }, name, parentId, textAutoResize: 'WIDTH_AND_HEIGHT',
    }, 40000);
    await call('set_font_name', { nodeId: t.id, family: 'Work Sans', style: 'Medium' }, 40000);
    await call('set_font_size', { nodeId: t.id, fontSize: size }, 30000);
    await call('set_fill_color', { nodeId: t.id, color: { ...hex(color), a: 1 } }, 30000);
    return t;
  };

  const label = await text({ characters: 'C · Final', name: 'row C Final label', x: 32, y: LABEL_Y, size: 13, color: '#0D0D0D', parentId: plate.id });
  ids.cFinal.labels.push({ row: 'C · Final', label: label.id });

  for (let ci = 0; ci < 2; ci++) {
    const phase = ci === 0 ? 'Day' : 'Night';
    const t = T[phase];
    const colX = COL_X[ci] - PLATE.x;

    const cap = await text({ characters: 'hover', name: `hover caption ${phase}`, x: colX, y: CAPTION_Y, size: 12, color: '#4C4C4C', parentId: plate.id });
    ids.cFinal.labels.push({ row: `hover caption ${phase}`, label: cap.id });

    for (const state of ['rest', 'hover']) {
      const cardY = state === 'rest' ? REST_Y : HOVER_Y;
      const clone = await call('clone_node', { nodeId: SRC[phase], parentId: plate.id, x: colX, y: cardY }, 90000);

      const paint = state === 'rest' ? t.onSurfaceVariant : t.accent;
      const dx = state === 'rest' ? 0 : NUDGE.x;
      const dy = state === 'rest' ? 0 : NUDGE.y;

      const mark = await call('set_svg', {
        svgString: arrowSvg(paint),
        x: colX + FRAME_X + dx,
        y: cardY + FRAME_Y + dy,
        parentId: plate.id,
        name: `icon / arrow 24 ${state}`,
      }, 40000);

      const info = await call('get_node_info', { nodeId: mark.id, depth: 1 }, 40000);
      const vec = (info.children || []).find(n => n.type === 'VECTOR');
      if (!vec) throw new Error('no vector child in ' + mark.id);
      await call('set_stroke_color', { nodeId: vec.id, color: { ...hex(paint), a: 1 }, strokeWeight: 2 }, 40000);

      const g = await call('group_nodes', {
        nodeIds: [clone.id, mark.id],
        name: state === 'rest' ? `C · Final — ${phase}` : `C · Final hover — ${phase}`,
      }, 40000);
      ids.cFinal.cells.push({ row: 'C · Final', state, phase, cell: g.id, card: clone.id, chip: mark.id, vector: vec.id });
      say('cell', state, phase, g.id, '(card', clone.id + ', icon', mark.id + ', vector', vec.id + ')');
    }
  }

  await call('resize_node', { nodeId: SEC, width: 1682, height: SECTION_H }, 40000);
  say('section resized to 1682x' + SECTION_H);

  fs.writeFileSync(manifestPath, JSON.stringify(ids, null, 2));
  say('manifest updated');
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
