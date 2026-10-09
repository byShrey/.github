// The profile as a video editing suite. Program monitor + effect controls up top,
// a timeline of every project with its versions and activity below, and one card per project.
// Tool count and the all-repo commit days come from the daily robot's caches (out/*-state.json).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import opentype from 'opentype.js';
import { portrait, lines, MONO, esc, karaoke, toolCount } from './card.mjs';
import { FIGS } from './figs.mjs';
import { api } from './gh.mjs';

const OUT = `${process.argv[2] || 'v4'}/out`; // each design version keeps its own folder
const anton = opentype.loadSync('fonts/Anton-Regular.ttf');
const read = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const tools = await toolCount();
writeFileSync('out/card-state.json', JSON.stringify({ tools }));
const { days = {} } = read('out/arcade-state.json', {});
const { stars } = read('projects.json', {});
const RED = '#FF3B30';
const T = {
  dark: { bg: '#000000', panel: '#0A0A0A', chrome: '#141414', line: '#262626', fg: '#FFFFFF', soft: '#8A8A8A', dim: '#4A4A4A', clip: '#FFFFFF', clipInk: '#000000' },
  light: { bg: '#FFFFFF', panel: '#F7F7F7', chrome: '#EDEDED', line: '#D6D6D6', fg: '#000000', soft: '#5C5C5C', dim: '#B0B0B0', clip: '#000000', clipInk: '#FFFFFF' },
};
const FILE = 'shrey_final_FINAL_v7.prproj';
const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
const updated = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const svg = (W, H, title, css, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>${title}</title><style>${css}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style><g font-family="${MONO}">${body}</g></svg>\n`;
const txt = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${esc(s)}</text>`;

// ---------- top: menu bar, program monitor, effect controls ----------

// HH:MM:SS:FF that starts at zero when the page opens. Each digit is a strip of numbers slid up in steps.
function timecode(x, y, fs, fill) {
  const cw = fs * 0.6, digits = [[6, 600], [10, 60], [6, 10], [10, 1]]; // minutes tens/units, seconds tens/units: [count, seconds per step]
  let out = txt(x, y, '00:', `fill="${fill}"`), cx = x + cw * 3, css = '';
  digits.forEach(([n, step], i) => {
    if (i === 2) { out += txt(cx, y, ':', `fill="${fill}"`); cx += cw; }
    out += `<svg x="${cx}" y="${y - fs}" width="${cw}" height="${fs * 1.25}" overflow="hidden"><g class="d${i}">` +
      [...Array(n + 1).keys()].map((k) => txt(0, fs + k * fs * 1.25, String(k % n), `fill="${fill}"`)).join('') + '</g></svg>';
    css += `.d${i}{animation:d${i} ${n * step}s steps(${n}) infinite}@keyframes d${i}{to{transform:translateY(${-n * fs * 1.25}px)}}`;
    cx += cw;
  });
  // frames: 00-23, one second around
  out += txt(cx, y, ':', `fill="${fill}"`); cx += cw;
  out += `<svg x="${cx}" y="${y - fs}" width="${cw * 2}" height="${fs * 1.25}" overflow="hidden"><g class="ff">` +
    [...Array(25).keys()].map((k) => txt(0, fs + k * fs * 1.25, String(k % 24).padStart(2, '0'), `fill="${RED}"`)).join('') + '</g></svg>';
  css += `.ff{animation:ff 1s steps(24) infinite}@keyframes ff{to{transform:translateY(${-24 * fs * 1.25}px)}}`;
  return { out, css };
}

const LEGEND = 'Legend says he once fixed a render, a website and a Wi-Fi router in one chai break. He neither confirms nor denies. This is his workbench.';

function monitor(t, theme, x, y, w, h) {
  const head = 26, foot = 40, sx = x + 12, sy = y + head, sw = w - 24, sh = h - head - foot;
  const p = portrait(theme, 0, 0, 7.6), px = sx + (sw - p.w) / 2, py = sy + (sh - p.h) / 2 - 6;
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${t.panel}" stroke="${t.line}"/>`;
  out += txt(x + 12, y + 17, 'PROGRAM', `font-size="11" font-weight="700" fill="${t.fg}"`) + txt(x + 76, y + 17, FILE.replace('.prproj', ''), `font-size="11" fill="${t.soft}"`);
  out += `<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="${t.bg}" stroke="${t.line}"/>`;
  // title-safe corners
  const m = 16, k = 14, c = `stroke="${t.dim}" fill="none"`;
  out += [[sx + m, sy + m, 1, 1], [sx + sw - m, sy + m, -1, 1], [sx + m, sy + sh - m, 1, -1], [sx + sw - m, sy + sh - m, -1, -1]]
    .map(([a, b, dx, dy]) => `<path d="M${a} ${b + dy * k}V${b}H${a + dx * k}" ${c}/>`).join('');
  out += `<g transform="translate(${px.toFixed(1)} ${(py + 8).toFixed(1)})">${p.svg}</g>`;
  // subtitles: the whole line on screen at once, read along word by word
  const sub = karaoke(LEGEND, sx + sw / 2, 0, { fs: 11.5, cols: Math.floor((sw - 40) / 7), lh: 1.45, dim: '#8A8A8A', lit: '#FFFFFF', anchor: 'middle' });
  const ky = sy + sh - 14 - sub.h;
  out += `<rect x="${sx + 14}" y="${ky - 6}" width="${sw - 28}" height="${sub.h + 10}" fill="#000" opacity=".82"/><g transform="translate(0 ${(ky + 11.5).toFixed(1)})">${sub.svg}</g>`;
  // REC badge
  out += `<circle class="rec" cx="${sx + sw - 46}" cy="${sy + 20}" r="4.5" fill="${RED}"/>` + txt(sx + sw - 37, sy + 24, 'REC', `font-size="11" font-weight="700" fill="${RED}"`);
  // footer: timecode, transport, zoom
  const fy = y + h - 15, tc = timecode(x + 14, fy, 14, t.fg), mid = x + w / 2;
  out += tc.out;
  const tri = (cx, dir, fill) => `<path d="M${cx - 5 * dir} ${fy - 13}L${cx + 5 * dir} ${fy - 7}L${cx - 5 * dir} ${fy - 1}Z" fill="${fill}"/>`;
  out += `<rect x="${mid - 52}" y="${fy - 13}" width="2" height="12" fill="${t.soft}"/>` + tri(mid - 38, -1, t.soft) + tri(mid, 1, RED) + tri(mid + 38, 1, t.soft) + `<rect x="${mid + 50}" y="${fy - 13}" width="2" height="12" fill="${t.soft}"/>`;
  out += txt(x + w - 14, fy, 'Fit  ▾   Full', `font-size="12" fill="${t.soft}" text-anchor="end"`);
  const css = `${sub.css}
.rec{animation:rec 1.2s steps(1) infinite}@keyframes rec{50%{opacity:.15}}${tc.css}`;
  return { out, css };
}

function inspector(t, x, y, w, h) {
  const L = lines(tools, updated).filter(([k]) => !['updated', 'speed', 'warning'].includes(k));
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${t.panel}" stroke="${t.line}"/>`;
  out += txt(x + 12, y + 17, 'EFFECT CONTROLS', `font-size="11" font-weight="700" fill="${t.fg}"`) + txt(x + w - 12, y + 17, 'shrey  ▾', `font-size="11" fill="${t.soft}" text-anchor="end"`);
  out += `<line x1="${x}" x2="${x + w}" y1="${y + 26}" y2="${y + 26}" stroke="${t.line}"/>`;
  out += txt(x + 12, y + 48, 'fx  Shrey', `font-size="12" font-weight="700" fill="${t.fg}"`);
  const rh = 22.5;
  L.forEach(([k, v], i) => {
    const yy = y + 74 + i * rh, d = (0.6 + i * 0.09).toFixed(2), on = i % 3 === 0;
    out += `<g class="ln" style="animation-delay:${d}s">` +
      `<path d="M${x + 22} ${yy - 8}l4 4-4 4-4-4z" fill="${on ? RED : 'none'}" stroke="${on ? RED : t.dim}"/>` +
      txt(x + 34, yy, k, `font-size="11.5" fill="${t.soft}"`) + txt(x + 110, yy, k === 'uptime' ? '∞' : v, `font-size="11.5" fill="${t.fg}"`) +
      (k === 'uptime' ? `<rect x="${x + 128}" y="${yy - 8}" width="${w - 150}" height="6" fill="${t.line}"/><rect class="chai" x="${x + 128}" y="${yy - 8}" width="${w - 150}" height="6" fill="${RED}"/>` + txt(x + w - 12, yy + 12, 'runs on chai', `font-size="9.5" fill="${t.soft}" text-anchor="end"`) : '') + '</g>';
  });
  const sy = y + 74 + L.length * rh + 6, bench = stars.filter((s) => s.status === 'bench');
  out += `<line x1="${x}" x2="${x + w}" y1="${sy}" y2="${sy}" stroke="${t.line}"/>` + txt(x + 12, sy + 22, 'fx  Render queue', `font-size="12" font-weight="700" fill="${t.fg}"`);
  bench.forEach((s, i) => {
    const yy = sy + 44 + i * 19, bx = x + 110, bw = w - 122;
    if (yy > y + h - 34) return;
    out += txt(x + 34, yy, s.name, `font-size="11" fill="${t.soft}"`) + `<svg x="${bx}" y="${yy - 7}" width="${bw}" height="5" overflow="hidden"><rect width="${bw}" height="5" fill="${t.line}"/><rect class="rq" style="animation-delay:${-i * 0.7}s" x="${-bw * 0.3}" width="${bw * 0.3}" height="5" fill="${RED}"/></svg>`;
  });
  out += '' + txt(x + 12, y + h - 14, `updated ${updated}`, `font-size="10" fill="${t.soft}"`);
  const css = `.ln{animation:ln .35s cubic-bezier(.2,.7,.2,1) backwards}@keyframes ln{from{opacity:0;transform:translateX(-6px)}}
.rq{animation:rq 2.8s cubic-bezier(.5,0,.5,1) infinite}@keyframes rq{to{transform:translateX(${(w - 122) * 1.3}px)}}
.chai{transform-box:fill-box;transform-origin:left;animation:chai 2.4s cubic-bezier(.2,.7,.2,1) 1.6s backwards}@keyframes chai{from{transform:scaleX(0)}}`;
  return { out, css };
}

function menubar(t, W) {
  return `<rect width="${W}" height="30" fill="${t.chrome}"/>` + txt(14, 20, 'byShrey Studio', `font-size="12.5" font-weight="700" fill="${t.fg}"`) +
    ['File', 'Edit', 'Clip', 'Sequence', 'Chai', 'Help'].reduce((a, m) => ({ x: a.x + m.length * 7.2 + 26, s: a.s + txt(a.x, 20, m, `font-size="12" fill="${t.soft}"`) }), { x: 140, s: '' }).s +
    txt(W - 14, 20, FILE, `font-size="11" fill="${t.soft}" text-anchor="end"`);
}

function top(theme, layout) {
  const t = T[theme];
  if (layout === 'wide') {
    const W = 1000, H = 520, y = 42, h = H - y - 12, mw = 572;
    const m = monitor(t, theme, 12, y, mw, h), i = inspector(t, 12 + mw + 12, y, W - mw - 36, h);
    return svg(W, H, 'byShrey Studio', m.css + i.css, `<rect width="${W}" height="${H}" fill="${t.bg}"/>${menubar(t, W)}${m.out}${i.out}`);
  }
  const W = 420, mh = 440, ih = 470, y = 12;
  const m = monitor(t, theme, 12, y, W - 24, mh), i = inspector(t, 12, y + mh + 12, W - 24, ih);
  const H = y + mh + 12 + ih + 12;
  return svg(W, H, 'byShrey Studio', m.css + i.css, `<rect width="${W}" height="${H}" fill="${t.bg}"/>${m.out}${i.out}`);
}

// ---------- timeline: projects grouped by kind, versions as red keyframes, each clip carrying its own activity ----------

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const D = (s) => new Date(s + 'T00:00:00Z');
const day = (d) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
const ver = (v) => /^\d/.test(v) ? `v${v}` : v;
const GROUPS = [['apps', 'APPS'], ['web', 'WEB'], ['hardware', 'HARDWARE']];

// commits per day for each project's repos, cached so a failed fetch keeps yesterday's picture
const ASTATE = 'out/activity-state.json', cached = read(ASTATE, {});
async function activity() {
  const out = {};
  for (const s of stars) for (const repo of s.activity || (s.repo ? [s.repo] : [])) {
    try {
      const days = {};
      for (let page = 1; ; page++) {
        const list = await api(`repos/${repo}/commits?per_page=100&since=2026-08-01T00:00:00Z&page=${page}`);
        for (const c of list) { const d = c.commit.author.date.slice(0, 10); days[d] = (days[d] || 0) + 1; }
        if (list.length < 100) break;
      }
      out[repo] = days;
    } catch { out[repo] = cached[repo] || {}; }
  }
  writeFileSync(ASTATE, JSON.stringify(out));
  return out;
}
const ACT = await activity();
const daysOf = (s) => (s.activity || (s.repo ? [s.repo] : [])).reduce((a, r) => { for (const [d, n] of Object.entries(ACT[r] || {})) a[d] = (a[d] || 0) + n; return a; }, {});
const RELEASES = stars.reduce((n, s) => n + (s.versions || []).length, 0);
const COMMITS = Object.values(days).reduce((a, b) => a + b, 0);

function timeline(theme, layout) {
  const t = T[theme], wide = layout === 'wide', W = wide ? 1000 : 420;
  const from = D('2026-08-03'), to = new Date(+today + (wide ? 24 : 20) * 864e5), span = to - from;
  const hx = wide ? 132 : 92, x0 = hx + 8, x1 = W - 14, X = (d) => x0 + ((d - from) / span) * (x1 - x0), nowX = X(today), SWEEP = 4;
  const at = (x) => (Math.max(0, Math.min(1, (x - x0) / (nowX - x0))) * SWEEP).toFixed(2); // when the playhead reaches x
  const th = wide ? 24 : 26, gh = 22, ry = 82, fs = wide ? 11.5 : 12;
  // rows: a header per group, then its projects in start order (ideas last)
  const rows = GROUPS.flatMap(([k, label]) => [{ label }, ...stars.filter((s) => s.kind === k).sort((a, b) => (a.from || '9').localeCompare(b.from || '9'))]);
  let y = ry + 12, out = '', v = stars.length;
  const aY = ry + 12 + rows.reduce((h, r) => h + (r.label ? gh : th), 0) + 10, aH = 44, H = aY + aH * 2 + 44;
  out += `<rect width="${W}" height="${H}" fill="${t.bg}"/><rect x="12" y="12" width="${W - 24}" height="${H - 24}" fill="${t.panel}" stroke="${t.line}"/>`;
  out += txt(24, 34, 'TIMELINE', `font-size="11" font-weight="700" fill="${t.fg}"`) + (wide ? txt(92, 34, 'everything on the bench, 2026', `font-size="11" fill="${t.soft}"`) : '');
  const stats = [[stars.length, 'projects'], [RELEASES, 'milestones'], [COMMITS, 'commits']];
  out += `<text x="${W - 24}" y="34" font-size="11" text-anchor="end">` + stats.map(([n, l], i) => `<tspan fill="${t.fg}" font-weight="700">${i ? '  ' : ''}${n}</tspan><tspan fill="${t.soft}"> ${l}</tspan>`).join('') + '</text>';
  out += `<line x1="12" x2="${W - 12}" y1="46" y2="46" stroke="${t.line}"/>`;
  out += `<defs><pattern id="h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line y2="6" stroke="${t.line}" stroke-width="1.5"/></pattern></defs>`;
  out += `<rect x="${nowX}" y="${ry}" width="${x1 - nowX}" height="${aY - ry + aH * 2}" fill="url(#h)"/>`;
  out += `<line x1="${x0}" x2="${x1}" y1="${ry}" y2="${ry}" stroke="${t.line}"/>`;
  for (let d = new Date(from), i = 0; d <= to; d = new Date(+d + 7 * 864e5), i++) {
    const x = X(d);
    out += `<line x1="${x}" x2="${x}" y1="${ry - 6}" y2="${ry}" stroke="${t.soft}"/>` + ((wide || i % 2 === 0) && x < x1 - 34 ? txt(x + 3, ry - 8, day(d), `font-size="10" fill="${t.soft}"`) : '');
  }
  for (const s of rows) {
    if (s.label) {
      out += txt(22, y + 15, s.label, `font-size="9.5" font-weight="700" letter-spacing="1.5" fill="${t.soft}"`) + `<line x1="${22 + s.label.length * 7.4 + 8}" x2="${x1}" y1="${y + 11.5}" y2="${y + 11.5}" stroke="${t.line}"/>`;
      y += gh; continue;
    }
    const live = s.status === 'bench', idea = !s.from, parked = s.status === 'blueprint' && !idea;
    const a = idea ? nowX + 12 : X(D(s.from)), b = idea ? a + (wide ? 70 : 44) : live ? nowX : X(D(s.to || s.from)), w = Math.max(b - a, 4), cy = y + th / 2;
    out += `<line x1="${x0 - 8}" x2="${x1}" y1="${y + th}" y2="${y + th}" stroke="${t.line}" stroke-width=".6"/>`;
    out += txt(22, cy + 4, `V${v--}`, `font-size="10" fill="${t.dim}"`) + txt(46, cy + 4, s.name, `font-size="${fs}" fill="${live || s.status === 'shipped' ? t.fg : t.soft}"`);
    const solid = s.status === 'shipped', ink = solid ? t.clipInk : t.soft;
    out += `<g class="clip" style="animation-delay:${at(a)}s"><rect x="${a.toFixed(1)}" y="${y + 3}" width="${w.toFixed(1)}" height="${th - 6}" fill="${solid ? t.clip : 'none'}" stroke="${live ? RED : solid ? t.clip : t.soft}" stroke-width="1.2"${idea ? ' stroke-dasharray="3 3"' : ''}/>`;
    // the clip's own activity, drawn like the waveform on an audio clip
    const act = daysOf(s), mx = Math.max(1, ...Object.values(act)), dw = Math.max((x1 - x0) / (span / 864e5) - 1, 1.5);
    for (const [d, n] of Object.entries(act)) {
      const x = X(D(d)); if (x < a - 1 || x > b + 1) continue;
      const hh = 1.5 + Math.sqrt(n / mx) * (th / 2 - 6);
      out += `<rect x="${x.toFixed(1)}" y="${(cy - hh).toFixed(1)}" width="${dw.toFixed(1)}" height="${(hh * 2).toFixed(1)}" fill="${ink}" opacity="${solid ? 0.35 : 0.6}"/>`;
    }
    if (live && w > 70) out += txt(a + 6, cy + 3.5, 'recording', `font-size="9.5" fill="${RED}"`);
    if (idea) out += txt(a + w / 2, cy + 3.5, 'idea', `font-size="9.5" fill="${t.soft}" text-anchor="middle"`);
    // versions: a red keyframe on the clip at each release; the latest one is named just past the clip
    const vs = s.versions || [];
    vs.forEach(([d, label], i) => {
      const x = X(D(d));
      out += `<path d="M${x.toFixed(1)} ${cy - 5}l5 5-5 5-5-5z" fill="${RED}" stroke="${solid ? t.clip : t.panel}" stroke-width="1"/>`;
    });
    // the whole version history sits just past the clip; phones only get the latest
    const chain = (wide ? vs : vs.slice(-1)).map(([, l]) => ver(l)).join(' › ');
    const tag = chain + (vs.length && parked ? ' · parked' : '');
    // a label that would cross the red line starts just past it instead
    const lx = b + 12 + tag.length * 6.2 > nowX - 4 && b < nowX + 4 ? Math.max(b + 12, nowX + 10) : b + 12;
    if (tag && lx + tag.length * 6 < x1) out += txt(lx, cy + 3.5, tag, `font-size="10" font-weight="700" fill="${parked ? t.soft : t.fg}"`);
    out += '</g>';
    y += th;
  }
  // audio: all commits as a waveform, and a chai track that never changes
  const mid = aY + aH / 2, max = Math.max(1, ...Object.values(days)), dayW = (x1 - x0) / (span / 864e5);
  out += txt(22, mid + 4, 'A1', `font-size="10" fill="${t.dim}"`) + txt(46, mid + 4, 'commits', `font-size="${fs}" fill="${t.soft}"`);
  out += `<line x1="${x0}" x2="${nowX}" y1="${mid}" y2="${mid}" stroke="${t.dim}"/>`;
  for (const [d, n] of Object.entries(days)) {
    const x = X(D(d)); if (x < x0 || x > nowX) continue;
    const hh = 3 + Math.sqrt(n / max) * (aH / 2 - 5);
    out += `<rect class="wv" style="animation-delay:${at(x)}s" x="${x.toFixed(1)}" y="${(mid - hh).toFixed(1)}" width="${Math.max(dayW - 1, 2).toFixed(1)}" height="${(hh * 2).toFixed(1)}" fill="${n >= 10 ? RED : t.fg}"/>`;
  }
  const cY = aY + aH + aH / 2;
  out += txt(22, cY + 4, 'A2', `font-size="10" fill="${t.dim}"`) + txt(46, cY + 4, 'chai', `font-size="${fs}" fill="${t.soft}"`);
  let wave = `M${x0} ${cY}`; for (let x = x0; x <= x1; x += 6) wave += `L${x + 3} ${cY - 4}L${x + 6} ${cY + 4}`;
  out += `<path class="tea" d="${wave}" fill="none" stroke="${t.soft}" stroke-width="1"/>` + txt(x1 - 4, cY - 9, 'constant', `font-size="9.5" fill="${t.soft}" text-anchor="end"`);
  out += `<g class="ph"><line x1="${nowX}" x2="${nowX}" y1="${ry - 14}" y2="${H - 22}" stroke="${RED}" stroke-width="1.6"/><path d="M${nowX - 7} ${ry - 22}h14v7l-7 7-7-7z" fill="${RED}"/></g>`;
  out += txt(nowX - 8, H - 26, `today, ${day(today)}`, `class="tag" font-size="10" fill="${RED}" text-anchor="end"`);
  const css = `.ph{animation:ph ${SWEEP}s cubic-bezier(.45,0,.2,1) backwards}@keyframes ph{from{transform:translateX(${(x0 - nowX).toFixed(1)}px)}}
.clip{transform-box:fill-box;transform-origin:left;animation:clip .5s cubic-bezier(.2,.7,.2,1) backwards}@keyframes clip{from{transform:scaleX(0);opacity:0}}
.wv{transform-box:fill-box;transform-origin:center;animation:wv .4s ease-out backwards}@keyframes wv{from{transform:scaleY(0)}}
.tag{animation:mk .4s ease-out ${SWEEP}s backwards}@keyframes mk{from{opacity:0}}
.tea{animation:tea 1.6s linear infinite}@keyframes tea{to{transform:translateX(-6px)}}`;
  return svg(W, H, 'Timeline', css, out);
}

// ---------- cards: one per project, a line drawing that sketches itself in ----------

const CHIP = { shipped: ['LIVE', true], bench: ['BUILDING', false], blueprint: ['PARKED', false] };
function card(theme, s) {
  const t = T[theme], W = 240, H = 300, f = FIGS[s.id], [chip, solid] = CHIP[s.status];
  let out = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="${t.panel}" stroke="${t.line}"/>`;
  out += `<defs><pattern id="g" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="${t.dim}"/></pattern></defs>`;
  out += `<rect x="10" y="10" width="${W - 20}" height="150" fill="${t.bg}" stroke="${t.line}"/><rect x="10" y="10" width="${W - 20}" height="150" fill="url(#g)"/>`;
  out += `<g transform="translate(23 ${22}) scale(.75)" fill="none" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">` +
    f.d.map((d, i) => `<path class="dr" pathLength="1" style="animation-delay:${(i * 0.04).toFixed(2)}s" d="${d}" stroke="${f.red.includes(i) ? RED : t.fg}"/>`).join('') + '</g>';
  const cw = chip.length * 6.6 + (solid ? 14 : 24);
  out += solid ? `<rect x="18" y="18" width="${cw}" height="17" fill="${RED}"/>` + txt(25, 30, chip, 'font-size="10" font-weight="700" letter-spacing="1" fill="#FFFFFF"')
    : `<rect x="18" y="18" width="${cw}" height="17" fill="${t.bg}" stroke="${s.status === 'bench' ? RED : t.soft}"/>` + (s.status === 'bench' ? `<circle class="rec" cx="27" cy="26.5" r="3" fill="${RED}"/>` : `<circle cx="27" cy="26.5" r="3" fill="${t.soft}"/>`) + txt(35, 30, chip, `font-size="10" font-weight="700" letter-spacing="1" fill="${s.status === 'bench' ? RED : t.soft}"`);
  const vs = s.versions || [];
  out += `<path d="${anton.getPath(s.name.toUpperCase(), 14, 196, 27).toPathData(1)}" fill="${t.fg}"/>`;
  if (vs.length) out += txt(W - 14, 195, ver(vs.at(-1)[1]), `font-size="12" font-weight="700" fill="${RED}" text-anchor="end"`);
  const words = s.blurb.split(' ').reduce((a, w) => (a.length && (a.at(-1) + ' ' + w).length <= 28 ? (a[a.length - 1] += ' ' + w) : a.push(w), a), []);
  words.slice(0, 2).forEach((l, i) => { out += txt(14, 218 + i * 17, l, `font-size="12.5" fill="${t.soft}"`); });
  out += `<line x1="14" x2="${W - 14}" y1="252" y2="252" stroke="${t.line}"/>`;
  const n = Object.values(daysOf(s)).reduce((a, b) => a + b, 0);
  out += txt(14, 276, `since ${day(D(s.from))}${n ? ` · ${n} commit${n > 1 ? 's' : ''}` : ''}`, `font-size="11" fill="${t.soft}"`);
  out += s.url ? txt(W - 14, 276, 'OPEN ↗', `font-size="11.5" font-weight="700" fill="${RED}" text-anchor="end"`) : txt(W - 14, 276, 'soon', `font-size="11" fill="${t.soft}" text-anchor="end"`);
  const css = `.dr{stroke-dasharray:1;stroke-dashoffset:1;animation:dr 1.6s cubic-bezier(.5,0,.3,1) forwards}@keyframes dr{to{stroke-dashoffset:0}}
.rec{animation:rec 1.2s steps(1) infinite}@keyframes rec{50%{opacity:.15}}@media (prefers-reduced-motion:reduce){.dr{stroke-dashoffset:0}}`;
  return svg(W, H, `${s.name}: ${s.blurb}`, css, out);
}

mkdirSync(OUT, { recursive: true });
for (const theme of ['dark', 'light']) {
  for (const layout of ['wide', 'narrow']) {
    writeFileSync(`${OUT}/top-${layout}-${theme}.svg`, top(theme, layout));
    writeFileSync(`${OUT}/timeline-${layout}-${theme}.svg`, timeline(theme, layout));
  }
  for (const s of stars.filter((s) => FIGS[s.id])) writeFileSync(`${OUT}/card-${s.id}-${theme}.svg`, card(theme, s));
}
console.log('suite: written to', OUT, '| releases', RELEASES, '| commits', COMMITS);
