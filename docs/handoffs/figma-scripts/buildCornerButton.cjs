// Build "Work card · corner button" on the Exploration page: 4 variants x Day/Night.
// Each cell is a clone of the highlight-work card (Day 102:1766 / Night 102:1223) with the
// corner control added at the 32px card inset (top-right). Source cards are never edited.
const conn = require('./ws.cjs');
const fs = require('fs');
const path = require('path');

const PAGE = '127:9124';
const SECTION = 'Work card · corner button';
const SRC = { Day: '102:1766', Night: '102:1223' };

const T = {
  Day: {
    accent: '#3687D9', onSurface: '#0D0D0D', onSurfaceVariant: '#4C4C4C',
    containerHigh: '#E5E5E5', shadow: 'S:0e426ce577fa003cd9fe125e1f9119ae45330f77,',
  },
  Night: {
    accent: '#FD6850', onSurface: '#F2F2F2', onSurfaceVariant: '#B2B2B2',
    containerHigh: '#333333', shadow: 'S:52af8fdd4c236fd0247a40575fdf0387cd8e1964,',
  },
};

const CARD_W = 753, CARD_H = 416, INSET = 32;
const SECTION_X = 9000, SECTION_Y = 800;
const COL_X = [64, 64 + CARD_W + 48];
const SECTION_W = 64 + CARD_W * 2 + 48 + 64;
const ROWS = [
  { key: 'A', label: 'A · Tinted chip', labelY: 186 },
  { key: 'B', label: 'B · Raised circle', labelY: 680 },
  { key: 'C', label: 'C · Bare icon', labelY: 1174 },
  { key: 'D', label: 'D · Label pill', labelY: 1700 },
];
const SECTION_H = 2210;

const hex = h => {
  const n = parseInt(h.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
};
const alpha = (c, a) => ({ ...c, a });

(async () => {
  const { call, close } = await conn();
  const ids = { section: null, cells: [], source: SRC };
  const hexOf = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

  const say = (...a) => console.log(...a);

  // ---- page + section
  await call('set_current_page', { pageId: PAGE }, 40000);
  const page = await call('get_node_info', { nodeId: PAGE, depth: 1 }, 60000);
  const existing = (page.children || []).find(c => c.name === SECTION);
  if (existing) throw new Error(`Section already exists: ${existing.id} — rerun after removing it`);

  const sec = await call('create_section', {
    x: SECTION_X, y: SECTION_Y, width: SECTION_W, height: SECTION_H, name: SECTION,
    fillColor: { r: 0.898, g: 0.898, b: 0.898, a: 1 },
  }, 40000);
  ids.section = sec.id;
  say('section', sec.id, sec.name);

  // ---- text helper
  const FIGMA_STYLE = { 'Regular': 'Regular', 'Medium': 'Medium', 'Semi Bold': 'SemiBold' };
  async function mkText({ characters, name, x, y, parentId, size, style = 'Medium', color, lineHeight, tracking }) {
    const t = await call('create_text', {
      x, y, text: characters, fontSize: size, fontWeight: style === 'Medium' ? 500 : 600,
      fontColor: hex(color), name, parentId, textAutoResize: 'WIDTH_AND_HEIGHT',
    }, 40000);
    await call('set_font_name', { nodeId: t.id, family: 'Work Sans', style: FIGMA_STYLE[style] || style }, 40000);
    await call('set_font_size', { nodeId: t.id, fontSize: size }, 30000);
    if (lineHeight) await call('set_line_height', { nodeId: t.id, lineHeight }, 30000);
    if (tracking !== undefined) await call('set_letter_spacing', { nodeId: t.id, letterSpacing: tracking }, 30000);
    await call('set_fill_color', { nodeId: t.id, color: hex(color) }, 30000);
    return t;
  }

  // ---- header
  await mkText({ characters: 'Work card · corner button', name: 'section title', x: 64, y: 64, parentId: sec.id, size: 24, style: 'Semi Bold', color: '#0D0D0D' });
  await mkText({
    characters: 'Clones of the highlight-work card (Final · Light 102:1766 / Final · Dark 102:1223). Chip top-right at the 32px card inset. Day = Final · Light tokens, Night = Final · Dark tokens.',
    name: 'section note', x: 64, y: 100, parentId: sec.id, size: 13, style: 'Regular', color: '#4C4C4C',
  });
  await mkText({ characters: `Source card ${CARD_W}×${CARD_H} · r12 · shadow-light / shadow-dark · no strokes`, name: 'section note 2', x: 64, y: 120, parentId: sec.id, size: 13, style: 'Regular', color: '#4C4C4C' });

  await mkText({ characters: 'Day · Final · Light', name: 'column header day', x: COL_X[0], y: 152, parentId: sec.id, size: 12, style: 'Semi Bold', color: '#4C4C4C', tracking: 0.5 });
  await mkText({ characters: 'Night · Final · Dark', name: 'column header night', x: COL_X[1], y: 152, parentId: sec.id, size: 12, style: 'Semi Bold', color: '#4C4C4C', tracking: 0.5 });

  // ---- icons
  const svgArrow = (size, colour) => {
    const p = size === 12
      ? '<path d="M2.5 9.5L9.5 2.5M3.75 2.5H9.5V8.25"'
      : size === 16
        ? '<path d="M3.5 12.5L12.5 3.5M5 3.5H12.5V11"'
        : '<path d="M3 11L11 3M4.5 3H11V9.5"';
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">` +
      `${p} stroke="${colour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  };
  const icon = async (size, colour, x, y, parentId, name) => {
    const r = await call('set_svg', { svgString: svgArrow(size, colour), x, y, parentId, name }, 40000);
    return r.id;
  };

  // ---- cells
  const RIGHT = CARD_W - INSET;          // right edge of the control zone
  const CENTRE_Y = INSET + 14;           // optical centre of the 28px chip

  for (const row of ROWS) {
    await mkText({ characters: row.label, name: `row ${row.key} label`, x: 64, y: row.labelY, parentId: sec.id, size: 13, style: 'Medium', color: '#0D0D0D' });

    const cardY = row.labelY + 30;
    for (let ci = 0; ci < 2; ci++) {
      const phase = ci === 0 ? 'Day' : 'Night';
      const t = T[phase];
      const accent = hex(t.accent);
      const cardX = COL_X[ci];

      const clone = await call('clone_node', { nodeId: SRC[phase], parentId: sec.id, x: cardX, y: cardY }, 90000);
      const groupIds = [clone.id];

      let chipId;
      if (row.key === 'A') {
        const s = 28, x = cardX + RIGHT - s, y = cardY + CENTRE_Y - s / 2;
        const r = await call('create_frame', {
          x, y, width: s, height: s, name: 'chip / tinted', parentId: sec.id,
          fillColor: alpha(accent, 0.1),
        }, 40000);
        await call('set_corner_radius', { nodeId: r.id, radius: 8 }, 30000);
        await icon(14, t.accent, 7, 7, r.id, 'icon / arrow-up-right');
        chipId = r.id;
      } else if (row.key === 'B') {
        const s = 32, x = cardX + RIGHT - s, y = cardY + CENTRE_Y - s / 2;
        const r = await call('create_frame', {
          x, y, width: s, height: s, name: 'chip / raised', parentId: sec.id,
          fillColor: hex(t.containerHigh),
        }, 40000);
        await call('set_corner_radius', { nodeId: r.id, radius: s / 2 }, 30000);
        await call('set_effect_style_id', { nodeId: r.id, effectStyleId: t.shadow }, 40000);
        await icon(14, t.onSurface, 9, 9, r.id, 'icon / arrow-up-right');
        chipId = r.id;
      } else if (row.key === 'C') {
        const s = 16, x = cardX + RIGHT - s, y = cardY + CENTRE_Y - s / 2;
        chipId = await icon(s, t.onSurfaceVariant, x, y, sec.id, 'icon / bare 16');
      } else {
        // D · label pill: 28 high, 12px horizontal padding, full radius, "View" + 12px arrow
        const pill = await call('create_frame', {
          x: 0, y: 0, width: 120, height: 28, name: 'chip / label pill', parentId: sec.id,
          fillColor: alpha(accent, 0.1),
        }, 40000);
        const txt = await mkText({
          characters: 'View', name: 'View', x: 12, y: 6, parentId: pill.id,
          size: 12, style: 'Medium', color: t.accent, lineHeight: 16, tracking: 0.5,
        });
        const info = await call('get_node_info', { nodeId: txt.id, depth: 0 }, 40000);
        const tw = Math.round(info.absoluteBoundingBox.width);
        const arrow = 12, gap = 6, pad = 12;
        const pillW = pad + tw + gap + arrow + pad;
        await call('resize_node', { nodeId: pill.id, width: pillW, height: 28 }, 30000);
        await call('set_corner_radius', { nodeId: pill.id, radius: 14 }, 30000);
        await call('move_node', { nodeId: txt.id, x: pad, y: 6 }, 30000);
        await icon(arrow, t.accent, pad + tw + gap, 8, pill.id, 'icon / arrow-up-right 12');
        await call('move_node', { nodeId: pill.id, x: cardX + RIGHT - pillW, y: cardY + INSET }, 30000);
        chipId = pill.id;
        say(`  pill ${phase}: w=${pillW} text=${tw}`);
      }
      groupIds.push(chipId);

      const g = await call('group_nodes', { nodeIds: groupIds, name: `${row.label.replace(/ · /, ' · ')} — ${phase}` }, 40000);
      ids.cells.push({ row: row.key, phase, cell: g.id, card: clone.id, chip: chipId });
      say('cell', row.key, phase, g.id, '(card', clone.id + ', chip', chipId + ')');
    }
  }

  // ---- C · hover specimen, under the Day card
  {
    const cardY = ROWS.find(r => r.key === 'C').labelY + 30;
    const y = cardY + CARD_H + 16;
    const hi = await icon(16, T.Day.accent, 64, y, sec.id, 'icon / bare 16 · hover');
    const cap = await mkText({ characters: 'hover', name: 'hover caption', x: 88, y: y + 1, parentId: sec.id, size: 12, style: 'Regular', color: '#4C4C4C' });
    ids.hover = { icon: hi, caption: cap.id };
    say('hover specimen', hi, cap.id);
  }

  const out = path.join(__dirname, '..', 'work-card', 'manifest.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(ids, null, 2));
  say('written', out);
  close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
