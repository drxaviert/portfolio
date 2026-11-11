// Add row E · Corner arrowhead (Day + Night) to section 147:16070.
// Fresh clones of the source cards; the corner mark is one open vector path, 1.5px, round caps.
const conn = require('./ws.cjs');
const fs = require('fs');
const path = require('path');

const SEC = '147:16070';
const SRC = { Day: '102:1766', Night: '102:1223' };
const T = {
  Day: { accent: '#3687D9' },
  Night: { accent: '#FD6850' },
};

const CARD_W = 753, CARD_H = 416;
const COL_X = [64, 64 + CARD_W + 48];       // section-relative card x
const LABEL_Y = 2194;
const CARD_Y = 2224;

// Row plate: 16px breathing room around the row so the export shows the card shadows.
const PLATE = { x: 32, y: LABEL_Y - 16, w: 64 + CARD_W * 2 + 48 - 32 + 32, h: 478 };
const SECTION_H = CARD_Y + CARD_H + 64;     // 2704

const hex = h => {
  const n = parseInt(h.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
};

// Outer edge of the bend 16px in from the card's top and right, outer radius 8, stroke 1.5.
// Centreline: radius 7.25, so the frame is exactly the 24x24 stroke extent.
const SVG_W = 24;
const cornerSvg = colour =>
  `<svg width="${SVG_W}" height="${SVG_W}" viewBox="0 0 ${SVG_W} ${SVG_W}" fill="none" xmlns="http://www.w3.org/2000/svg">` +
  `<path d="M0 0.75H16A7.25 7.25 0 0 1 23.25 8V23.25" stroke="${colour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

(async () => {
  const { call, close } = await conn();
  const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'work-card', 'manifest.json'), 'utf8'));
  const say = (...a) => console.log(...a);

  // ---- row plate
  const plate = await call('create_frame', {
    x: PLATE.x, y: PLATE.y, width: PLATE.w, height: PLATE.h,
    name: 'E · Corner arrowhead — row', parentId: SEC,
    fillColor: { r: 1, g: 1, b: 1, a: 0 },
  }, 40000);
  say('plate', plate.id, plate.width + 'x' + plate.height);

  // ---- label
  const label = await call('create_text', {
    x: 32, y: 16, text: 'E · Corner arrowhead', fontSize: 13, fontWeight: 500,
    fontColor: { ...hex('#0D0D0D'), a: 1 }, name: 'row E label', parentId: plate.id,
    textAutoResize: 'WIDTH_AND_HEIGHT',
  }, 40000);
  await call('set_font_name', { nodeId: label.id, family: 'Work Sans', style: 'Medium' }, 40000);
  await call('set_font_size', { nodeId: label.id, fontSize: 13 }, 30000);
  await call('set_fill_color', { nodeId: label.id, color: { ...hex('#0D0D0D'), a: 1 } }, 30000);

  ids.eRow = { plate: plate.id, label: label.id, cells: [] };

  for (let ci = 0; ci < 2; ci++) {
    const phase = ci === 0 ? 'Day' : 'Night';
    const accent = T[phase].accent;
    const cardX = COL_X[ci] - PLATE.x;        // plate-relative
    const cardY = CARD_Y - PLATE.y;

    const clone = await call('clone_node', { nodeId: SRC[phase], parentId: plate.id, x: cardX, y: cardY }, 90000);

    const mark = await call('set_svg', {
      svgString: cornerSvg(accent),
      x: cardX + CARD_W - 40,                  // 737 - 24
      y: cardY + 16,
      parentId: plate.id,
      name: 'corner / arrowhead',
    }, 40000);

    // stroke paint at 40% opacity
    const info = await call('get_node_info', { nodeId: mark.id, depth: 1 }, 40000);
    const vec = (info.children || []).find(n => n.type === 'VECTOR');
    if (!vec) throw new Error('no vector child in ' + mark.id + ': ' + JSON.stringify(info.children));
    await call('set_stroke_color', { nodeId: vec.id, color: { ...hex(accent), a: 0.4 }, strokeWeight: 1.5 }, 40000);

    const g = await call('group_nodes', { nodeIds: [clone.id, mark.id], name: `E · Corner arrowhead — ${phase}` }, 40000);
    ids.eRow.cells.push({ row: 'E', phase, cell: g.id, card: clone.id, chip: mark.id, vector: vec.id });
    say('cell E', phase, g.id, '(card', clone.id + ', mark', mark.id + ', vector', vec.id + ')');
  }

  await call('resize_node', { nodeId: SEC, width: 1682, height: SECTION_H }, 40000);
  say('section resized to 1682x' + SECTION_H);

  fs.writeFileSync(path.join(__dirname, '..', 'work-card', 'manifest.json'), JSON.stringify(ids, null, 2));
  say('manifest updated');
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
