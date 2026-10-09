// The arcade: a different game each day, played on a year of workbench activity.
// The grid is built from commit dates across every byShrey repo (GitHub's own grid misses private repos),
// so it reads the same way as GitHub's green squares, in STARK colours.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { api } from './gh.mjs';

const STATE = 'out/arcade-state.json', last = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { days: {} };

async function commitDays() {
  try {
    const since = new Date(Date.now() - 371 * 864e5).toISOString(), days = {};
    for (const repo of await api('orgs/byShrey/repos?per_page=100&type=all'))
      for (let page = 1; ; page++) {
        const list = await api(`repos/byShrey/${repo.name}/commits?per_page=100&since=${since}&page=${page}`).catch(() => []);
        for (const c of list) { const d = c.commit.author.date.slice(0, 10); days[d] = (days[d] || 0) + 1; }
        if (list.length < 100) break;
      }
    return Object.keys(days).length ? days : last.days;
  } catch { return last.days; }
}
const days = await commitDays();
writeFileSync(STATE, JSON.stringify({ days }));

// 53 weeks, Sunday-first columns, ending with today's week, like GitHub's grid
const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
const start = new Date(today - (today.getUTCDay() + 52 * 7) * 864e5);
const level = (n) => !n ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4;
const cells = [];
for (let w = 0; w < 53; w++) for (let d = 0; d < 7; d++) {
  const date = new Date(+start + (w * 7 + d) * 864e5);
  if (date <= today) cells.push({ x: w, y: d, lv: level(days[date.toISOString().slice(0, 10)]) });
}

const MONO = `ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace`;
const THEME = {
  dark: { fg: '#FFFFFF', soft: '#8A8A8A', lv: ['#1A1A1A', '#5C5C5C', '#8A8A8A', '#C8C8C8', '#FFFFFF'] },
  light: { fg: '#000000', soft: '#5C5C5C', lv: ['#EDEDED', '#BDBDBD', '#8A8A8A', '#5C5C5C', '#000000'] },
};
const P = 17, S = 13, W = 1000, OX = (W - 53 * P) / 2, OY = 64; // cell pitch, cell size, grid origin
const px = (x) => OX + x * P, py = (y) => OY + y * P;

// Snake: greedy tour of every active day (nearest by grid steps). It enters and leaves on the right,
// where the recent squares are, so it doesn't spend the loop crossing empty months.
function tour() {
  const food = cells.filter((c) => c.lv);
  let at = { x: 56, y: 3 }; const path = [{ ...at }], eatAt = new Map();
  const left = [...food];
  while (left.length) {
    left.sort((a, b) => (Math.abs(a.x - at.x) + Math.abs(a.y - at.y)) - (Math.abs(b.x - at.x) + Math.abs(b.y - at.y)));
    const f = left.shift();
    while (at.x !== f.x) { at.x += Math.sign(f.x - at.x); path.push({ ...at }); }
    while (at.y !== f.y) { at.y += Math.sign(f.y - at.y); path.push({ ...at }); }
    eatAt.set(f, path.length - 1);
  }
  while (at.x < 56) { at.x++; path.push({ ...at }); }
  return { food, path, eatAt, at };
}

function snake(theme) {
  const t = THEME[theme], { food, path, eatAt, at } = tour();
  const DT = 0.11, LEN = 6, T = +(path.length * DT + 2.5).toFixed(2), pct = (i) => +(i * DT / T * 100).toFixed(3);
  const head = path.map((p, i) => `${pct(i)}%{transform:translate(${px(p.x)}px,${py(p.y)}px)}`).join('') + `100%{transform:translate(${px(at.x)}px,${py(at.y)}px)}`;
  let css = `.seg{animation:snake ${T}s linear infinite both}@keyframes snake{${head}}`;
  let grid = cells.map((c) => `<rect x="${px(c.x)}" y="${py(c.y)}" width="${S}" height="${S}" rx="2" fill="${t.lv[0]}"/>`).join('');
  food.forEach((c, i) => {
    const e = pct(eatAt.get(c));
    css += `@keyframes e${i}{0%,${e}%{opacity:1}${(e + 0.01).toFixed(3)}%,99.9%{opacity:0}100%{opacity:1}}`;
    grid += `<rect style="animation:e${i} ${T}s step-end infinite" x="${px(c.x)}" y="${py(c.y)}" width="${S}" height="${S}" rx="2" fill="${t.lv[c.lv]}"/>`;
  });
  // body segments run the head's path a few steps behind; the tail fades
  const segs = Array.from({ length: LEN }, (_, k) => `<rect class="seg" style="animation-delay:${(k * DT).toFixed(2)}s;opacity:${(1 - k * 0.13).toFixed(2)}" x="0" y="0" width="${S}" height="${S}" rx="${k ? 2 : 4}" fill="${k ? t.fg : '#FF3B30'}"/>`).reverse().join('');
  return { css, body: grid + segs, name: 'snake', hint: 'eats one square for every day something got built' };
}


// Gravity: the day's squares drop off the grid, then squares rain in and stack up into "byshrey"
// (grey "by", bold "shrey", like the wordmark), hold, and fall away before the grid comes back.
const FONT = {
  b: ['10000', '10000', '11110', '10001', '10001', '10001', '11110'],
  y: ['00000', '00000', '10001', '10001', '01111', '00001', '01110'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  h: ['10000', '10000', '10110', '11001', '10001', '10001', '10001'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
};
function gravity(theme) {
  const t = THEME[theme], T = 11, p = (s) => +(s / T * 100).toFixed(2), food = cells.filter((c) => c.lv);
  const word = [], x0 = Math.floor((53 - 41) / 2);
  [...'byshrey'].forEach((ch, i) => FONT[ch].forEach((row, y) => [...row].forEach((b, x) => {
    if (b === '1') word.push({ x: x0 + i * 6 + x, y, by: i < 2 });
  })));
  // fill like sand: left to right, each column from the bottom up
  word.sort((a, b) => a.x - b.x || b.y - a.y);
  let css = '', body = cells.map((c) => `<rect x="${px(c.x)}" y="${py(c.y)}" width="${S}" height="${S}" rx="2" fill="${t.lv[0]}"/>`).join('');
  // falling squares only show inside the grid, never over the title or caption
  body += `<clipPath id="grid"><rect x="0" y="${OY - 2}" width="${W}" height="${7 * P + 2}"/></clipPath><g clip-path="url(#grid)">`;
  food.forEach((c, i) => {
    const go = 1.4 + c.x * 0.012 + (6 - c.y) * 0.03, fall = (9 - c.y) * P;
    css += `@keyframes f${i}{0%,${p(go)}%{transform:translateY(0);opacity:1}${p(go + 0.7)}%{transform:translateY(${fall}px);opacity:0}${p(T - 0.6)}%{transform:translateY(0);opacity:0}100%{opacity:1}}`;
    body += `<rect style="animation:f${i} ${T}s cubic-bezier(.55,0,1,.45) infinite" x="${px(c.x)}" y="${py(c.y)}" width="${S}" height="${S}" rx="2" fill="${t.lv[c.lv]}"/>`;
  });
  word.forEach((w, i) => {
    const land = 3 + i * 0.03, drop = (w.y + 3) * P, out = 8.6 + w.x * 0.008;
    css += `@keyframes w${i}{0%,${p(land - 0.35)}%{transform:translateY(-${drop}px);opacity:0}${p(land - 0.34)}%{opacity:1}${p(land)}%{transform:translateY(0);opacity:1}` +
      `${p(out)}%{transform:translateY(0);opacity:1}${p(out + 0.6)}%{transform:translateY(${(9 - w.y) * P}px);opacity:0}100%{transform:translateY(${(9 - w.y) * P}px);opacity:0}}`;
    body += `<rect class="wd" style="animation:w${i} ${T}s cubic-bezier(.55,0,1,.45) infinite" x="${px(w.x)}" y="${py(w.y)}" width="${S}" height="${S}" rx="2" fill="${w.by ? t.soft : t.fg}"/>`;
  });
  body += '</g>';
  return { css, body, name: 'gravity', hint: 'what goes up as commits comes down as a name' };
}

// Pac-Man: same route as the snake, but every empty square it crosses holds a dot to eat,
// the day's squares are power pellets, and a red ghost follows a few steps behind.
function pacman(theme) {
  const t = THEME[theme], { food, path, eatAt, at } = tour();
  const DT = 0.13, T = +(path.length * DT + 2.5).toFixed(2), pct = (i) => +(i * DT / T * 100).toFixed(3), h = S / 2;
  const move = path.map((q, i) => `${pct(i)}%{transform:translate(${px(q.x) + h}px,${py(q.y) + h}px)}`).join('') + `100%{transform:translate(${px(at.x) + h}px,${py(at.y) + h}px)}`;
  // face the way it's heading: right 0, down 90, left 180, up 270
  const turn = path.slice(1).map((q, i) => {
    const d = q.x > path[i].x ? 0 : q.x < path[i].x ? 180 : q.y > path[i].y ? 90 : 270;
    return `${pct(i)}%{transform:rotate(${d}deg)}`;
  }).join('');
  let css = `.mv{animation:mv ${T}s linear infinite both}@keyframes mv{${move}}.tn{animation:tn ${T}s step-end infinite both}@keyframes tn{${turn}}` +
    // chomp: open and closed mouths swap (CSS path morphing is not supported in Safari)
    `.shut{animation:shut .26s step-end infinite}@keyframes shut{0%{opacity:0}50%{opacity:1}}`;
  let body = cells.map((c) => `<rect x="${px(c.x)}" y="${py(c.y)}" width="${S}" height="${S}" rx="2" fill="${t.lv[0]}"/>`).join('');
  const seen = new Set(food.map((c) => `${c.x},${c.y}`)), dots = new Map();
  path.forEach((q, i) => { const k = `${q.x},${q.y}`; if (!seen.has(k) && q.x >= 0 && q.x < 53 && cells.some((c) => c.x === q.x && c.y === q.y) && !dots.has(k)) dots.set(k, [q, i]); });
  let n = 0;
  const gone = (i, step) => { const e = pct(step); css += `@keyframes e${i}{0%,${e}%{opacity:1}${(e + 0.01).toFixed(3)}%,99.9%{opacity:0}100%{opacity:1}}`; return `animation:e${i} ${T}s step-end infinite`; };
  for (const [, [q, i]] of dots) body += `<circle style="${gone(n++, i)}" cx="${px(q.x) + h}" cy="${py(q.y) + h}" r="1.6" fill="${t.soft}"/>`;
  food.forEach((c) => { body += `<rect style="${gone(n++, eatAt.get(c))}" x="${px(c.x)}" y="${py(c.y)}" width="${S}" height="${S}" rx="2" fill="${t.lv[c.lv]}"/>`; });
  const r = h + 1.5;
  const ghost = `<g class="mv" style="animation-delay:${(5 * DT).toFixed(2)}s"><path d="M${-r} ${r}V0A${r} ${r} 0 0 1 ${r} 0V${r}l-${r / 3} -2.5-${r / 3} 2.5-${r / 3} -2.5-${r / 3} 2.5-${r / 3} -2.5-${r / 3} 2.5Z" fill="#FF3B30"/>` +
    `<circle cx="-2.6" cy="-1" r="2.2" fill="#fff"/><circle cx="2.6" cy="-1" r="2.2" fill="#fff"/><circle cx="-2" cy="-1" r="1" fill="#000"/><circle cx="3.2" cy="-1" r="1" fill="#000"/></g>`;
  const pac = `<g class="mv"><g class="tn"><path d="M0 0L${r * 0.7} -${r * 0.7}A${r} ${r} 0 1 0 ${r * 0.7} ${r * 0.7}Z" fill="${t.fg}"/><circle class="shut" r="${r}" fill="${t.fg}"/></g></g>`;
  return { css, body: body + ghost + pac, name: 'pac-man', hint: 'dots for the quiet days, power pellets for the busy ones' };
}

// Game of Life: the year's active days are the first generation. Each beat, a square with 3 neighbours
// is born (red for one beat) and one with 2 or 3 survives; the grid wraps at its edges so life lasts longer.
function life(theme) {
  const t = THEME[theme], GENS = 22, BEAT = 0.4, HOLD = 1.5, T = +(HOLD * 2 + GENS * BEAT).toFixed(2);
  const at = (k) => k ? HOLD + (k - 1) * BEAT : 0, p = (s) => +(s / T * 100).toFixed(2);
  const live = new Set(cells.map((c) => c.x + ',' + c.y));
  let g = Array.from({ length: 7 }, (_, y) => Array.from({ length: 53 }, (_, x) => cells.some((c) => c.x === x && c.y === y && c.lv) ? 1 : 0));
  const gens = [g];
  for (let k = 1; k <= GENS; k++) {
    g = g.map((row, y) => row.map((v, x) => {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += g[(y + dy + 7) % 7][(x + dx + 53) % 53] ? 1 : 0;
      return n === 3 || (v && n === 2) ? 1 : 0;
    }));
    gens.push(g);
  }
  let css = '', body = cells.map((c) => `<rect x="${px(c.x)}" y="${py(c.y)}" width="${S}" height="${S}" rx="2" fill="${t.lv[0]}"/>`).join(''), n = 0;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 53; x++) {
    if (!live.has(x + ',' + y) || !gens.some((q) => q[y][x])) continue;
    const seed = cells.find((c) => c.x === x && c.y === y).lv;
    let k = '', prev = null;
    gens.forEach((q, i) => {
      const on = q[y][x], born = on && i && !gens[i - 1][y][x];
      const st = !on ? 'opacity:0' : `opacity:1;fill:${born ? '#FF3B30' : i ? t.fg : t.lv[seed]}`;
      if (st !== prev) { k += `${p(at(i))}%{${st}}`; prev = st; }
    });
    css += `@keyframes l${n}{${k}${p(T - 0.01)}%{${prev}}100%{${gens[0][y][x] ? `opacity:1;fill:${t.lv[seed]}` : 'opacity:0'}}}`;
    body += `<rect style="animation:l${n++} ${T}s step-end infinite" x="${px(x)}" y="${py(y)}" width="${S}" height="${S}" rx="2" fill="${gens[0][y][x] ? t.lv[seed] : t.fg}" opacity="${gens[0][y][x] ? 1 : 0}"/>`;
  }
  return { css, body, name: 'life', hint: 'every busy day is a cell. the rest is Conway' };
}

const GAMES = [snake, gravity, pacman, life];
const dayOfYear = Math.floor((today - new Date(Date.UTC(today.getUTCFullYear(), 0, 0))) / 864e5);
const game = GAMES[dayOfYear % GAMES.length];

mkdirSync('out/games', { recursive: true });
for (const play of GAMES) for (const theme of ['dark', 'light']) {
  const t = THEME[theme], g = play(theme), H = OY + 7 * P + 40;
  const label = `<text x="${OX}" y="34" font-weight="700"><tspan fill="#FF3B30">arcade</tspan><tspan fill="${t.soft}"> · today: </tspan><tspan fill="${t.fg}">${g.name}</tspan></text>` +
    `<text x="${OX}" y="${H - 14}" fill="${t.soft}" font-size="13">${g.hint}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>Arcade: ${g.name}</title><style>${g.css}@media (prefers-reduced-motion:reduce){*{animation:none!important}.seg,.wd,.mv{display:none}}</style><g font-family="${MONO}" font-size="16">${label}${g.body}</g></svg>\n`;
  writeFileSync(`out/games/${g.name}-${theme}.svg`, svg);
  if (play === game) writeFileSync(`out/arcade-${theme}.svg`, svg);
}
console.log('arcade:', game.name, Object.keys(days).length, 'active days');
