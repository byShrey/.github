// The maker card: ASCII portrait typing itself in, next to a terminal-style panel of real facts.
// Writes wide (desktop) and stacked (phone) versions for GitHub's dark and light themes.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const STATE = 'out/card-state.json'; // last good numbers, kept if a fetch fails
const last = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { tools: 63 };

export async function toolCount() {
  try {
    const xml = await (await fetch('https://tools.byshrey.com/sitemap.xml', { signal: AbortSignal.timeout(10000) })).text();
    const n = (xml.match(/<loc>https:\/\/tools\.byshrey\.com\/tools\//g) || []).length;
    return n > 0 ? n : last.tools;
  } catch { return last.tools; }
}

export const lines = (tools, updated) => [
  ['role', 'inventor, part-time deity'],
  ['skills', 'design, video, web, code, magic'],
  ['ships', `${tools} tools, 2 Mac apps, 0 sign-ups`],
  ['bench', '5 builds cooking, none burnt'],
  ['minions', 'a squad of AI agents, unpaid'],
  ['motto', 'done it twice? make it a tool'],
  ['power', 'spots a 1px error from orbit'],
  ['speed', 'renders before you hit export'],
  ['uptime', '∞ (runs on chai)'],
  ['weakness', 'meetings that could be texts'],
  ['warning', 'may cause sudden tool envy'],
  ['from', 'planet Earth, allegedly'],
  ['updated', updated],
];
let LINES;

export const MONO = `ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace`;
// Spaces become non-breaking: SVG drops repeated spaces when it is shown as an image.
export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '\u00A0');
export const THEME = {
  dark: { fg: '#FFFFFF', soft: '#8A8A8A', dim: '#5C5C5C', blocks: ['#000000', '#161616', '#5C5C5C', '#8A8A8A', '#FFFFFF', '#FF3B30'] },
  light: { fg: '#000000', soft: '#5C5C5C', dim: '#8A8A8A', blocks: ['#FFFFFF', '#E6E6E6', '#8A8A8A', '#5C5C5C', '#000000', '#FF3B30'] },
};

// Portrait from ascii.py ({text, tone}). Tone 0 = main ink, 1 = red shadow, 2 = grey hair.
// The face never moves. Only loose hair strands do: grey characters with empty space around them sway
// in a wind that travels down the head, and flick between two glyphs (~ and -, ` and ') like strands catching air.
const FLICK = { '~': '-', '-': '~', '`': "'", "'": '`', ',': '.', '.': ',', '_': '-', '=': '-', '^': '~', '"': "'", '/': '|', '\\': '|', '|': '/', ':': ';', ';': ':' };

// A strand is a grey character in the hair area (the top rows, or beside the face lower down)
// that sits on the outer edge: open space above it, or on two sides.
const HAIR_ROWS = 11, SIDE_ROWS = 31;
function strands(P) {
  const at = (i, j) => (P.text[i] || '')[j] || ' ';
  return P.text.map((row, i) => {
    const tone = P.tone[i], a = tone.search(/[01]/), b = tone.length - 1 - [...tone].reverse().join('').search(/[01]/);
    return [...row].map((c, j) => {
      if (c === ' ' || tone[j] !== '2') return false;
      if (i >= HAIR_ROWS && (i >= SIDE_ROWS || (a >= 0 && j > a && j < b))) return false;
      const open = [at(i, j - 1), at(i, j + 1), at(i - 1, j), at(i + 1, j)].filter((n) => n === ' ').length;
      return open >= 2 || at(i - 1, j) === ' ';
    });
  });
}

export function portrait(theme, x, y, fs = 9.6) {
  const lh = fs * 1.04, cw = fs * 0.6, t = THEME[theme], ink = [t.fg, '#FF3B30', t.soft];
  const P = JSON.parse(readFileSync('src/portrait.json', 'utf8')), S = strands(P);
  // one row of text, keeping only the characters keep() picks; the rest become spaces so columns stay put
  const line = (text, tone, keep, swap = (c) => c) => {
    const runs = [];
    [...text].forEach((c, j) => {
      const ch = keep(j) ? swap(c) : ' ', k = ch === ' ' ? 's' : tone[j], last = runs.at(-1);
      if (last && last.k === k) last.s += ch; else runs.push({ k, s: ch });
    });
    while (runs.length && runs.at(-1).k === 's') runs.pop();
    return runs.map(({ k, s }) => k === 's' ? esc(s) : `<tspan fill="${ink[k]}">${esc(s)}</tspan>`).join('');
  };
  const rows = P.text.length, h = rows * lh, w = Math.max(...P.text.map((r) => r.length)) * cw;
  const body = P.text.map((text, i) => {
    const yy = (y + i * lh).toFixed(1), tone = P.tone[i], s = S[i];
    const face = line(text, tone, (j) => !s[j]);
    const hair = line(text, tone, (j) => s[j]), alt = line(text, tone, (j) => s[j], (c) => FLICK[c] || c);
    // strands near the top swing widest, as hair further from the scalp would
    const amp = (cw * (1 - i / rows) * 1.1).toFixed(1), d = (-i * 0.14).toFixed(2), f = (-i * 0.37 % 2.6).toFixed(2);
    return `<g class="row" style="animation-delay:${(i * 0.03).toFixed(2)}s">` +
      (face ? `<text x="${x}" y="${yy}">${face}</text>` : '') +
      (hair ? `<g class="wind" style="--a:${amp}px;animation-delay:${d}s"><text class="fa" style="animation-delay:${f}s" x="${x}" y="${yy}">${hair}</text>` +
        (alt !== hair ? `<text class="fb" style="animation-delay:${f}s" x="${x}" y="${yy}">${alt}</text>` : '') + '</g>' : '') + '</g>';
  }).join('');
  const css = `.row{animation:row .25s ease-out backwards}@keyframes row{from{opacity:0}}
.wind{animation:wind 4.2s ease-in-out infinite}
@keyframes wind{0%,100%{transform:translateX(0)}35%{transform:translateX(var(--a))}60%{transform:translateX(calc(var(--a)*.4))}80%{transform:translateX(calc(var(--a)*.8))}}
.fa,.fb{animation:fa 2.6s step-end infinite}.fb{animation-name:fb;opacity:0}
@keyframes fa{0%{opacity:1}40%{opacity:0}55%{opacity:1}}@keyframes fb{0%{opacity:0}40%{opacity:1}55%{opacity:0}}`;
  return { svg: `<style>${css}</style><g font-family="${MONO}" font-size="${fs}">${body}</g>`, h, w };
}

function panel(theme, x, y, size) {
  const t = THEME[theme], lh = size * 1.7, start = 1.4;
  let out = `<g font-family="${MONO}" font-size="${size}">`;
  out += `<text class="ln" style="animation-delay:${start}s" x="${x}" y="${y}" font-weight="700"><tspan fill="#FF3B30">shrey</tspan><tspan fill="${t.soft}">@</tspan><tspan fill="${t.fg}">byshrey</tspan></text>`;
  out += `<text class="ln" style="animation-delay:${start + 0.1}s" x="${x}" y="${y + lh}" fill="${t.dim}">${'─'.repeat(13)}</text>`;
  LINES.forEach(([k, v], i) => {
    const yy = y + lh * (i + 2), d = (start + 0.25 + i * 0.12).toFixed(2);
    out += `<text class="ln" style="animation-delay:${d}s" x="${x}" y="${yy}"><tspan fill="${t.soft}">${esc(k.padEnd(10))}</tspan><tspan fill="${t.fg}">${esc(v)}</tspan></text>`;
  });
  const by = y + lh * (LINES.length + 2.4), bd = (start + 0.4 + LINES.length * 0.12).toFixed(2);
  out += `<g class="ln" style="animation-delay:${bd}s">` + t.blocks.map((c, i) =>
    `<rect x="${x + i * size * 2}" y="${by - size}" width="${size * 2}" height="${size * 1.1}" fill="${c}" stroke="${t.dim}" stroke-width=".6"/>`).join('') + '</g>';
  out += `<rect class="cur" x="${x + t.blocks.length * size * 2 + size * 0.8}" y="${by - size}" width="${size * 0.6}" height="${size * 1.1}" fill="#FF3B30"/>`;
  return { svg: out + '</g>', h: by - y + size * 0.4 };
}

const STYLE = `<style>
.ln{animation:ln .35s cubic-bezier(.2,.7,.2,1) backwards}
@keyframes ln{from{opacity:0;transform:translateX(-6px)}}
.cur{animation:blink 1.1s steps(1) 3s infinite}
@keyframes blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`;

function card(theme, layout) {
  const pad = 24;
  if (layout === 'wide') {
    const p = portrait(theme, pad, pad + 11, 10.6), size = 17;
    const q = panel(theme, pad + p.w + 40, pad + 60, size);
    const W = 1000, H = Math.max(p.h, q.h + 60) + pad * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>shrey@byshrey</title>${STYLE}${p.svg}${q.svg}</svg>\n`;
  }
  const W = 600, p = portrait(theme, (W - 64 * 5.76) / 2, pad + 9), size = 22;
  const q = panel(theme, pad, pad + p.h + 56, size);
  const H = pad + p.h + 56 + q.h + pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>shrey@byshrey</title>${STYLE}${p.svg}${q.svg}</svg>\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
const tools = await toolCount();
const updated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
writeFileSync(STATE, JSON.stringify({ tools }));
LINES = lines(tools, updated);
mkdirSync('out', { recursive: true });
for (const theme of ['dark', 'light']) for (const layout of ['wide', 'narrow'])
  writeFileSync(`out/card-${layout}-${theme}.svg`, card(theme, layout));
console.log('card: tools', tools, 'updated', updated);
}

// Read-along text: the whole passage is always on screen; a red highlight walks it word by word,
// read words stay lit, then the passage dims and it starts again. Returns svg, css and height.
export function karaoke(text, x, y, { fs = 13, cols = 60, lh = 1.5, dim, lit, anchor = 'start', id = 'k', step = 0.3 } = {}) {
  const rows = [];
  for (const w of text.split(' ')) (rows.length && (rows.at(-1) + ' ' + w).length <= cols) ? rows[rows.length - 1] += ' ' + w : rows.push(w);
  const n = text.split(' ').length, T = n * step + 3, pc = (s) => ((s / T) * 100).toFixed(2);
  let i = 0, css = '';
  const body = rows.map((r, j) => `<text x="${x}" y="${(y + j * fs * lh).toFixed(1)}" font-size="${fs}" text-anchor="${anchor}">` + r.split(' ').map((w, k) => {
    const a = i * step, c = `${id}${i++}`;
    css += `.${c}{animation:${c} ${T.toFixed(2)}s linear infinite}@keyframes ${c}{0%,${pc(Math.max(a - 0.01, 0))}%{fill:${dim}}${pc(a + 0.02)}%{fill:#FF3B30}${pc(a + step * 1.6)}%,95%{fill:${lit}}100%{fill:${dim}}}`;
    return `<tspan class="${c}" fill="${lit}">${k ? ' ' : ''}${esc(w)}</tspan>`;
  }).join('') + '</text>').join('');
  return { svg: body, css, h: rows.length * fs * lh, rows: rows.length };
}
