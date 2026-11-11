// Local raster preview of the v7 card art, so the palette can be judged before
// the Figma round-trip.   node preview-v7.cjs [phase]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const G = require('./gen-v7.cjs');

const phase = process.argv[2] || 'Day';
const t = G.tileLayers(phase);
const card = t.cardFill;

const panels = t.layers.map(l =>
  `<div style="position:absolute;inset:0;${l.blur ? `filter:blur(${l.blur}px)` : ''}">${l.svg}</div>`).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:${card}}
  .card{width:${G.CARD_W}px;height:${G.CARD_H}px;background:${card};border-radius:${G.CARD_R}px;position:relative}
  .panel{position:absolute;left:${t.panel.x}px;top:${t.panel.y}px;width:${t.panel.w}px;height:${t.panel.h}px;
    border-radius:${t.panel.r}px;overflow:hidden;background:${card}}
  .panel svg{position:absolute;inset:0;width:100%;height:100%}
</style>
<div class="card"><div class="panel">${panels}</div></div>`;

const tmp = path.join(process.env.TEMP || '.', 'v7-preview.html');
const out = path.join(__dirname, '..', 'play-cards', '_preview-v7.png');
fs.writeFileSync(tmp, html);

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=2',
  `--window-size=${G.CARD_W},${G.CARD_H}`,
  `--screenshot=${out}`, 'file:///' + tmp.replace(/\\/g, '/'),
], { stdio: 'ignore' });
console.log('wrote', out);
