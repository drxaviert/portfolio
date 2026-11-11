// Local raster preview of the v6 card art (no Figma round-trip) so the palette
// can be judged before building. node preview-v6.cjs [phase]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const G = require('./gen-v6.cjs');

const phase = process.argv[2] || 'Day';
const t = G.tileLayers(phase);
const card = t.cardFill;

// the three layer SVGs sit inside the clipped art panel at 16,16
const inner = t.layers.map(l => l.svg).join('\n');

const html = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:${card}}
  .card{width:${G.CARD_W}px;height:${G.CARD_H}px;background:${card};border-radius:${G.CARD_R}px;position:relative}
  .panel{position:absolute;left:${t.panel.x}px;top:${t.panel.y}px;width:${t.panel.w}px;height:${t.panel.h}px;
    border-radius:${t.panel.r}px;overflow:hidden;background:${card}}
  .panel svg{position:absolute;inset:0;width:100%;height:100%}
  .glow{filter:blur(6px)}
</style>
<div class="card"><div class="panel">${t.layers.map(l =>
  `<div class="${l.blur ? 'glow' : ''}" style="position:absolute;inset:0">${l.svg}</div>`).join('')}</div></div>`;

const tmp = path.join(process.env.TEMP || '.', 'v6-preview.html');
const out = path.join(__dirname, '..', 'play-cards', '_preview-v6.png');
fs.writeFileSync(tmp, html);

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=2',
  `--window-size=${G.CARD_W},${G.CARD_H}`,
  `--screenshot=${out}`, 'file:///' + tmp.replace(/\\/g, '/'),
], { stdio: 'inherit' });
console.log('wrote', out);
