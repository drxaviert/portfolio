// Add rows "E2 · Accent" and "E2 · Grayscale" below E in section 147:16070.
// Fresh clones of the source cards. Corner mark: one open path, 2.5px, round caps,
// centreline 8px in from the card top/right, bend radius 6 (echoes the card's 12px corner).
const conn = require('./ws.cjs');
const fs = require('fs');
const path = require('path');

const SEC = '147:16070';
const SRC = { Day: '102:1766', Night: '102:1223' };
const T = {
  Day: { accent: '#3687D9', onSurface: '#0D0D0D' },
  Night: { accent: '#FD6850', onSurface: '#F2F2F2' },
};

const CARD_W = 753, CARD_H = 416;
const COL_X = [64, 64 + CARD_W + 48];   // section-relative card x
const ROWS = [
  { key: 'accent', label: 'E2 · Accent', labelY: 2704 + 16, color: p => ({ hex: T[p].accent, a: 0.4 }) },
  { key: 'grayscale', label: 'E2 · Grayscale', labelY: 2704 + 494, color: p => ({ hex: T[p].onSurface, a: 0.25 }) },
];

const PLATE = { x: 32, y: 2704, w: 1618, h: 956 };
const SECTION_H = PLATE.y + PLATE.h + 48;   // 3708

const INSET = 8;        // stroke centreline inset from card top / right
const SW = 2.5;         // stroke weight
const R = 6;            // bend radius (12px card corner, 8px inset, floor of 6)
const ARM = 24;         // arm length from the bend corner

const hex = h => {
  const n = parseInt(h.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
};

// Local SVG frame = exact stroke extent of the 24px arms.
const FRAME = { w: ARM + SW, h: ARM + SW };          // 26.5
const FRAME_X = CARD_W - INSET - ARM - SW / 2;       // 719.75
const FRAME_Y = INSET - SW / 2;                      // 6.75
const hEnd = CARD_W - INSET - R - FRAME_X;           // 19.25
const arcEndX = CARD_W - INSET - FRAME_X;            // 25.25
const arcEndY = INSET + R - FRAME_Y;                 // 7.25
const vEnd = INSET + ARM - FRAME_Y;                  // 25.25
const cornerSvg = colour =>
  `<svg width="${FRAME.w}" height="${FRAME.h}" viewBox="0 0 ${FRAME.w} ${FRAME.h}" fill="none" xmlns="http://www.w3.org/2000/svg">` +
  `<path d="M${SW / 2} ${SW / 2}H${hEnd}A${R} ${R} 0 0 1 ${arcEndX} ${arcEndY}V${vEnd}" ` +
  `stroke="${colour}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

(async () => {
  const { call, close } = await conn();
  const manifestPath = path.join(__dirname, '..', 'work-card', 'manifest.json');
  const ids = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const say = (...a) => console.log(...a);

  const plate = await call('create_frame', {
    x: PLATE.x, y: PLATE.y, width: PLATE.w, height: PLATE.h,
    name: 'E2 · Accent + Grayscale — rows', parentId: SEC,
    fillColor: { r: 1, g: 1, b: 1, a: 0 },
  }, 40000);
  say('plate', plate.id, plate.width + 'x' + plate.height);
  ids.e2 = { plate: plate.id, roles: [], cells: [] };

  for (const role of ROWS) {
    const labelY = role.labelY - PLATE.y;
    const cardY = labelY + 30;

    const label = await call('create_text', {
      x: 32, y: labelY, text: role.label, fontSize: 13, fontWeight: 500,
      fontColor: { ...hex('#0D0D0D'), a: 1 }, name: `row ${role.label}`, parentId: plate.id,
      textAutoResize: 'WIDTH_AND_HEIGHT',
    }, 40000);
    await call('set_font_name', { nodeId: label.id, family: 'Work Sans', style: 'Medium' }, 40000);
    await call('set_font_size', { nodeId: label.id, fontSize: 13 }, 30000);
    await call('set_fill_color', { nodeId: label.id, color: { ...hex('#0D0D0D'), a: 1 } }, 30000);
    ids.e2.roles.push({ row: role.label, label: label.id });

    for (let ci = 0; ci < 2; ci++) {
      const phase = ci === 0 ? 'Day' : 'Night';
      const paint = role.color(phase);
      const cardX = COL_X[ci] - PLATE.x;

      const clone = await call('clone_node', { nodeId: SRC[phase], parentId: plate.id, x: cardX, y: cardY }, 90000);

      const mark = await call('set_svg', {
        svgString: cornerSvg(paint.hex),
        x: cardX + FRAME_X,
        y: cardY + FRAME_Y,
        parentId: plate.id,
        name: `corner / ${role.key}`,
      }, 40000);

      const info = await call('get_node_info', { nodeId: mark.id, depth: 1 }, 40000);
      const vec = (info.children || []).find(n => n.type === 'VECTOR');
      if (!vec) throw new Error('no vector child in ' + mark.id);
      await call('set_stroke_color', { nodeId: vec.id, color: { ...hex(paint.hex), a: paint.a }, strokeWeight: SW }, 40000);

      const g = await call('group_nodes', { nodeIds: [clone.id, mark.id], name: `${role.label} — ${phase}` }, 40000);
      ids.e2.cells.push({ row: role.label, phase, cell: g.id, card: clone.id, chip: mark.id, vector: vec.id });
      say('cell', role.label, phase, g.id, '(card', clone.id + ', mark', mark.id + ', vector', vec.id + ')');
    }
  }

  await call('resize_node', { nodeId: SEC, width: 1682, height: SECTION_H }, 40000);
  say('section resized to 1682x' + SECTION_H);

  fs.writeFileSync(manifestPath, JSON.stringify(ids, null, 2));
  say('manifest updated');
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
