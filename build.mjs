// Build: node build.mjs
// Concatenates src/*.html in order, draws the plots, renders \( \) and \[ \] TeX to MathML
// with temml, and writes a single self-contained index.html.
import fs from 'node:fs';
import path from 'node:path';
import temml from 'temml';

// Each page is built from the parts in its src folder.
// {{ROOT}} in any part is replaced by the path from that page back to the site root, and
// <!--include:shared/x.html--> pulls in a shared part (used for the whole-course map).
const PAGES = [
  { src: 'src', out: 'index.html', root: '' },                       // Mid-sem guide
  { src: 'src-after', out: 'after-midsem/index.html', root: '../' }, // After mid-sem guide
  { src: 'src-quiz1', out: 'quiz1/index.html', root: '../' },        // Quiz 1 guide
];

/* ---------------- plotting helpers (static SVG, colours from CSS tokens) ---------------- */
const f2 = v => (Math.round(v * 10) / 10).toString();
function plot(o) {
  const W = o.w || 520, H = o.h || 300, L = o.ml ?? 56, R = o.mr ?? 18, T = o.mt ?? 18, B = o.mb ?? 46;
  const [x0, x1] = o.x, [y0, y1] = o.y;
  const tx = v => o.logx ? Math.log10(v) : v, ty = v => o.logy ? Math.log10(v) : v;
  const sx = v => L + (tx(v) - tx(x0)) / (tx(x1) - tx(x0)) * (W - L - R);
  const sy = v => H - B - (ty(v) - ty(y0)) / (ty(y1) - ty(y0)) * (H - T - B);
  const inX = v => v >= Math.min(x0, x1) - 1e-12 && v <= Math.max(x0, x1) + 1e-12 && !(o.logx && v <= 0);
  const inY = v => v >= Math.min(y0, y1) - 1e-12 && v <= Math.max(y0, y1) + 1e-12 && !(o.logy && v <= 0);
  let s = `<svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label || ''}">`;
  // grid + ticks
  (o.xticks || []).forEach(([v, lab]) => {
    s += `<line x1="${f2(sx(v))}" y1="${T}" x2="${f2(sx(v))}" y2="${H - B}" style="stroke:var(--grid)" stroke-width="1"/>`;
    s += `<text x="${f2(sx(v))}" y="${H - B + 17}" text-anchor="middle" class="tk">${lab ?? v}</text>`;
  });
  (o.yticks || []).forEach(([v, lab]) => {
    s += `<line x1="${L}" y1="${f2(sy(v))}" x2="${W - R}" y2="${f2(sy(v))}" style="stroke:var(--grid)" stroke-width="1"/>`;
    s += `<text x="${L - 7}" y="${f2(sy(v) + 4)}" text-anchor="end" class="tk">${lab ?? v}</text>`;
  });
  // axes
  const ax0 = o.xaxisAt !== undefined ? sy(o.xaxisAt) : H - B;
  s += `<line x1="${L}" y1="${f2(ax0)}" x2="${W - R}" y2="${f2(ax0)}" style="stroke:var(--axis)" stroke-width="1.3"/>`;
  const ay0 = o.yaxisAt !== undefined ? sx(o.yaxisAt) : L;
  s += `<line x1="${f2(ay0)}" y1="${T}" x2="${f2(ay0)}" y2="${H - B}" style="stroke:var(--axis)" stroke-width="1.3"/>`;
  if (o.xlabel) s += `<text x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle" class="al">${o.xlabel}</text>`;
  if (o.ylabel) s += `<text x="14" y="${(T + H - B) / 2}" text-anchor="middle" class="al" transform="rotate(-90 14 ${(T + H - B) / 2})">${o.ylabel}</text>`;
  (o.vlines || []).forEach(v => {
    s += `<line x1="${f2(sx(v.x))}" y1="${T}" x2="${f2(sx(v.x))}" y2="${H - B}" style="stroke:var(${v.c || '--muted-fg'})" stroke-width="1.2" stroke-dasharray="${v.dash || '3 4'}"/>`;
    if (v.text) s += `<text x="${f2(sx(v.x) + 5)}" y="${T + 13}" class="lb" style="fill:var(${v.c || '--muted-fg'})">${v.text}</text>`;
  });
  // series
  (o.series || []).forEach(se => {
    const st = `stroke:var(${se.c || '--c1'})`;
    if (se.bars) {
      se.pts.forEach(([x, y]) => {
        const bw = se.bw || 8;
        s += `<rect x="${f2(sx(x) - bw / 2)}" y="${f2(sy(y))}" width="${bw}" height="${f2(sy(y0) - sy(y))}" style="fill:var(${se.c || '--c1'});opacity:.85" rx="1.5"/>`;
      });
      return;
    }
    if (se.pixels) { // many points: one path of 1-px squares, deduplicated on the pixel grid
      const seen = new Set(); let d = '';
      se.pts.forEach(([x, y]) => { if (!inY(y) || !inX(x)) return; const px = Math.round(sx(x) * 2) / 2, py = Math.round(sy(y) * 2) / 2, k = px + ',' + py; if (seen.has(k)) return; seen.add(k); d += `M${px} ${py}h1v1h-1z`; });
      s += `<path d="${d}" style="fill:var(${se.c || '--c1'})"/>`; return;
    }
    if (!se.dotsOnly) {
      let segs = [], cur = [];
      se.pts.forEach(([x, y]) => { if (inY(y) && inX(x)) cur.push(`${f2(sx(x))},${f2(sy(y))}`); else { if (cur.length > 1) segs.push(cur); cur = []; } });
      if (cur.length > 1) segs.push(cur);
      segs.forEach(p => s += `<polyline points="${p.join(' ')}" fill="none" style="${st}" stroke-width="${se.w || 2.4}" stroke-linecap="round" stroke-linejoin="round"${se.dash ? ` stroke-dasharray="${se.dash}"` : ''}/>`);
    }
    if (se.dots || se.dotsOnly) se.pts.forEach(([x, y]) => { if (inY(y) && inX(x)) s += `<circle cx="${f2(sx(x))}" cy="${f2(sy(y))}" r="${se.r || 3.2}" style="fill:var(${se.c || '--c1'})"/>`; });
  });
  (o.arrows || []).forEach(a => { // arrow heads on the x axis for phase lines
    const x = sx(a.x), y = ax0, d = a.dir;
    s += `<path d="M${f2(x - 6 * d)},${f2(y - 5)} L${f2(x + 6 * d)},${f2(y)} L${f2(x - 6 * d)},${f2(y + 5)} z" style="fill:var(${a.c || '--fg'})"/>`;
  });
  (o.marks || []).forEach(m => {
    const c = m.stable ? '--stable' : '--unstable';
    s += m.stable
      ? `<circle cx="${f2(sx(m.x))}" cy="${f2(sy(m.y))}" r="5.5" style="fill:var(${c});stroke:var(${c})" stroke-width="2"/>`
      : `<circle cx="${f2(sx(m.x))}" cy="${f2(sy(m.y))}" r="5.5" style="fill:var(--card);stroke:var(${c})" stroke-width="2.2"/>`;
  });
  (o.texts || []).forEach(t => s += `<text x="${f2(sx(t.x) + (t.dx || 0))}" y="${f2(sy(t.y) + (t.dy || 0))}" text-anchor="${t.a || 'start'}" class="lb" style="fill:var(${t.c || '--fg'})">${t.t}</text>`);
  return s + '</svg>';
}
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
const logTicks = (a, b) => { const t = []; for (let e = a; e <= b; e++) t.push([10 ** e, `10<tspan dy="-6" font-size="9">${e}</tspan>`]); return t; };

// seeded RNG for the synthetic power-law sample
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const solveS = c => { let S = 0.99; for (let i = 0; i < 20000; i++) S = 1 - Math.exp(-c * S); return S < 1e-6 ? 0 : S; };

const plots = {
  // log-log: power law is a straight line, Poisson bends down
  'loglog-compare': () => {
    const pl = range(0, 2, 60).map(e => { const k = 10 ** e; return [k, 0.6 * k ** -2.5]; });
    const po = []; let lf = 0; for (let k = 1; k <= 40; k++) { lf += Math.log(k); po.push([k, Math.exp(-6 + k * Math.log(6) - lf)]); }
    return plot({ label: 'Power law vs Poisson on log-log axes', x: [1, 100], y: [1e-6, 1], logx: true, logy: true,
      xticks: logTicks(0, 2), yticks: logTicks(-6, 0), xlabel: 'degree k', ylabel: 'P(k)',
      series: [{ pts: pl, c: '--c1' }, { pts: po, c: '--c2', dots: true, r: 2.6 }],
      texts: [{ x: 22, y: 2.5e-3, t: 'power law, slope −γ = −2.5', c: '--c1' }, { x: 1.15, y: 4e-5, t: 'Poisson (random network), ⟨k⟩ = 6', c: '--c2' }] });
  },
  // synthetic gamma=2.5 sample, linear vs log bins, both normalised by width
  'binning': () => {
    const rnd = mulberry(7), N = 20000, g = 2.5, ks = [];
    for (let i = 0; i < N; i++) ks.push(Math.floor((1 - rnd()) ** (-1 / (g - 1))));
    const lin = [], lg = [];
    const w = 5; const cnt = {}; ks.forEach(k => { const b = Math.floor((k - 1) / w); cnt[b] = (cnt[b] || 0) + 1; });
    Object.keys(cnt).forEach(b => { const lo = 1 + b * w; lin.push([lo + w / 2, cnt[b] / (N * w)]); });
    let edges = [1]; while (edges.at(-1) < 5e4) edges.push(edges.at(-1) * 2);
    for (let i = 0; i < edges.length - 1; i++) { const a = edges[i], b = edges[i + 1]; const n = ks.filter(k => k >= a && k < b).length; if (n) lg.push([Math.sqrt(a * b), n / (N * (b - a))]); }
    const theory = range(0, 4, 40).map(e => { const k = 10 ** e; return [k, 1.5 * k ** -2.5]; });
    return plot({ label: 'Linear versus logarithmic binning of a power law', x: [1, 1e4], y: [1e-10, 1], logx: true, logy: true,
      xticks: logTicks(0, 4), yticks: logTicks(-10, 0).filter((_, i) => i % 2 === 0), xlabel: 'degree k', ylabel: 'P(k) = count ÷ (N × bin width)',
      series: [{ pts: theory, c: '--muted-fg', dash: '5 4', w: 1.6 }, { pts: lin.sort((a, b) => a[0] - b[0]), c: '--c2', dotsOnly: true, r: 2.3 }, { pts: lg, c: '--c1', dots: true, r: 4 }],
      texts: [{ x: 1.3, y: 2e-9, t: 'orange · linear bins (width 5)', c: '--c2' }, { x: 1.3, y: 1.2e-8 * 1.6, t: 'teal · log bins (each 2× wider)', c: '--c1' }, { x: 300, y: 3e-5, t: 'noisy floor', c: '--c2' }] });
  },
  // path length vs N for simple graphs
  'pathlength-N': () => {
    const Ns = range(5, 200, 80);
    return plot({ label: 'Average path length against N for simple graphs', x: [0, 200], y: [0, 70], xticks: [[0], [50], [100], [150], [200]], yticks: [[0], [10], [20], [30], [40], [50], [60], [70]],
      xlabel: 'number of nodes N', ylabel: '⟨l⟩',
      series: [{ pts: Ns.map(N => [N, (N + 1) / 3]), c: '--c2' }, { pts: Ns.map(N => [N, N / 4]), c: '--c3' }, { pts: Ns.map(N => [N, N / 8]), c: '--c3', dash: '6 4' },
        { pts: Ns.map(N => [N, 2 * (N - 1) / N]), c: '--c1' }, { pts: Ns.map(N => [N, Math.log(N) / Math.log(4)]), c: '--c4', dash: '2 4', w: 2.6 }],
      texts: [{ x: 30, y: 38, t: 'open chain, (N+1)/3', c: '--c2' }, { x: 198, y: 50, dy: 20, a: 'end', t: 'ring, k = 2: N/4', c: '--c3' }, { x: 198, y: 25, dy: 20, a: 'end', t: 'ring, k = 4: N/8', c: '--c3' }] });
  },
  // Poisson distributions
  'poisson': () => {
    const P = (m, k) => { let lf = 0; for (let i = 2; i <= k; i++) lf += Math.log(i); return Math.exp(-m + k * Math.log(m) - lf); };
    const ks = range(0, 25, 25);
    return plot({ label: 'Poisson degree distributions', x: [0, 25], y: [0, 0.4], xticks: [[0], [5], [10], [15], [20], [25]], yticks: [[0], [0.1], [0.2], [0.3], [0.4]],
      xlabel: 'degree k', ylabel: 'P(k)',
      series: [{ pts: ks.map(k => [k, P(1, k)]), c: '--c2', dots: true }, { pts: ks.map(k => [k, P(4, k)]), c: '--c1', dots: true }, { pts: ks.map(k => [k, P(10, k)]), c: '--c3', dots: true }],
      texts: [{ x: 1.4, y: 0.36, t: '⟨k⟩ = 1', c: '--c2' }, { x: 5, y: 0.215, t: '⟨k⟩ = 4', c: '--c1' }, { x: 11, y: 0.14, t: '⟨k⟩ = 10', c: '--c3' }] });
  },
  // graphical solution of S = 1 - e^{-cS}
  'gcc-graphical': () => {
    const Ss = range(0, 1, 60);
    return plot({ label: 'Graphical solution of the giant component equation', x: [0, 1], y: [0, 1], xticks: [[0], [0.2], [0.4], [0.6], [0.8], [1]], yticks: [[0], [0.2], [0.4], [0.6], [0.8], [1]],
      xlabel: 'S', ylabel: 'y', w: 460, h: 330,
      series: [{ pts: Ss.map(S => [S, S]), c: '--fg', dash: '5 4', w: 1.8 }, ...[0.5, 1, 1.5, 2].map((c, i) => ({ pts: Ss.map(S => [S, 1 - Math.exp(-c * S)]), c: ['--c2', '--muted-fg', '--c3', '--c1'][i] }))],
      marks: [{ x: 0, y: 0, stable: false }, { x: solveS(1.5), y: solveS(1.5), stable: true }, { x: solveS(2), y: solveS(2), stable: true }],
      texts: [{ x: 0.99, y: 1 - Math.exp(-0.5), dy: -7, a: 'end', t: '⟨k⟩ = 0.5', c: '--c2' }, { x: 0.99, y: 1 - Math.exp(-1), dy: -7, a: 'end', t: '⟨k⟩ = 1', c: '--muted-fg' }, { x: 0.99, y: 1 - Math.exp(-1.5), dy: 15, a: 'end', t: '⟨k⟩ = 1.5', c: '--c3' }, { x: 0.27, y: 0.47, a: 'end', t: '⟨k⟩ = 2', c: '--c1' }, { x: 0.9, y: 0.97, a: 'end', t: 'y = S', c: '--fg' }] });
  },
  // S against <k>
  'gcc-curve': () => {
    const cs = range(0, 4, 160);
    return plot({ label: 'Giant component size against mean degree', x: [0, 4], y: [0, 1], xticks: [[0], [1], [2], [3], [4]], yticks: [[0], [0.2], [0.4], [0.6], [0.8], [1]],
      xlabel: 'mean degree ⟨k⟩', ylabel: 'S (fraction in giant component)',
      vlines: [{ x: 1 }],
      series: [{ pts: cs.map(c => [c, solveS(c)]), c: '--c1', w: 2.8 }, { pts: range(1, 1.45, 20).map(c => [c, 2 * (c - 1)]), c: '--c2', dash: '5 4', w: 2 }],
      texts: [{ x: 1.55, y: 0.33, t: 'dashed: S ≈ 2(⟨k⟩ − 1)', c: '--c2' }, { x: 2.2, y: 0.72, t: 'solid: exact solution', c: '--c1' }, { x: 0.08, y: 0.06, t: 'S = 0 below ⟨k⟩ = 1', c: '--c1' }, { x: 1.05, y: 0.95, t: 'critical point', c: '--muted-fg' }] });
  },
  // phase line for logistic growth
  'phase-logistic': () => {
    const xs = range(-0.2, 1.25, 80);
    return plot({ label: 'Phase line of the logistic equation', x: [-0.2, 1.25], y: [-0.4, 0.35], xaxisAt: 0, yaxisAt: 0, w: 480, h: 260,
      xticks: [[0, '0'], [0.5, 'K/2'], [1, 'K']], yticks: [], xlabel: 'x', ylabel: 'ẋ = f(x)',
      series: [{ pts: xs.map(x => [x, x * (1 - x)]), c: '--c3' }],
      arrows: [{ x: -0.1, dir: -1 }, { x: 0.3, dir: 1 }, { x: 0.7, dir: 1 }, { x: 1.14, dir: -1 }],
      marks: [{ x: 0, y: 0, stable: false }, { x: 1, y: 0, stable: true }],
      texts: [{ x: 0.5, y: 0.29, t: 'ẋ > 0, x grows', a: 'middle', c: '--muted-fg' }, { x: 1.02, y: -0.2, t: 'ẋ < 0', c: '--muted-fg' }] });
  },
  'budworm-f': () => {
    const r = 0.5, K = 10, xs = range(0, 9, 300);
    const f = x => r * x * (1 - x / K) - x * x / (1 + x * x);
    return plot({ label: 'Spruce budworm rate at r = 0.5', x: [0, 9], y: [-0.6, 0.35], xaxisAt: 0, w: 520, h: 280, xticks: [[0], [1], [2], [3], [4], [5], [6], [7], [8], [9]], yticks: [[-0.4], [-0.2], [0], [0.2]], xlabel: 'population x', ylabel: 'rate of change',
      series: [{ pts: xs.map(x => [x, f(x)]), c: '--c3' }],
      arrows: [{ x: 4.6, dir: 1 }, { x: 8.4, dir: -1 }],
      marks: [{ x: 0, y: 0, stable: false }, { x: 0.683375, y: 0, stable: true }, { x: 2, y: 0, stable: false }, { x: 7.316625, y: 0, stable: true }],
      texts: [{ x: 7.32, y: 0, dy: -12, t: '7.32', a: 'middle' }, { x: 1.2, y: -0.25, t: 'the part from 0 to 2.5 is zoomed in the next plot', c: '--muted-fg' }] });
  },
  'budworm-zoom': () => {
    const r = 0.5, K = 10, xs = range(0, 2.6, 300);
    const f = x => r * x * (1 - x / K) - x * x / (1 + x * x);
    return plot({ label: 'Spruce budworm rate at r = 0.5, zoomed', x: [0, 2.6], y: [-0.075, 0.08], xaxisAt: 0, w: 520, h: 260, xticks: [[0], [0.5], [1], [1.5], [2], [2.5]], yticks: [[-0.06], [-0.03], [0], [0.03], [0.06]], xlabel: 'population x (zoomed)', ylabel: 'rate of change',
      series: [{ pts: xs.map(x => [x, f(x)]), c: '--c3' }],
      arrows: [{ x: 0.35, dir: 1 }, { x: 1.35, dir: -1 }, { x: 2.4, dir: 1 }],
      marks: [{ x: 0, y: 0, stable: false }, { x: 0.683375, y: 0, stable: true }, { x: 2, y: 0, stable: false }],
      texts: [{ x: 0.68, y: 0, dy: -12, t: '0.68', a: 'middle' }, { x: 2, y: 0, dy: -12, t: '2', a: 'middle' }] });
  },
  'budworm-bif': () => {
    const K = 10, pts = [];
    for (const x of range(0.02, 9.6, 700)) {
      const r = x / ((1 + x * x) * (1 - x / K));
      const fx = r * (1 - 2 * x / K) - 2 * x / (1 + x * x) ** 2;
      pts.push([r, x, fx < 0]);
    }
    const segs = []; let cur = [pts[0]];
    for (let i = 1; i < pts.length; i++) { if (pts[i][2] !== cur[0][2]) { cur.push(pts[i]); segs.push(cur); cur = [pts[i]]; } else cur.push(pts[i]); }
    segs.push(cur);
    return plot({ label: 'Budworm equilibria against r, showing hysteresis', x: [0.2, 0.8], y: [0, 10], xticks: [[0.2], [0.3], [0.4], [0.5], [0.6], [0.7], [0.8]], yticks: [[0], [2], [4], [6], [8], [10]], xlabel: 'r', ylabel: 'equilibrium x*',
      vlines: [{ x: 0.38397, text: '0.384' }, { x: 0.55953, text: '0.560' }],
      series: segs.map(sg => ({ pts: sg.map(p => [p[0], p[1]]), c: sg[0][2] ? '--stable' : '--unstable', dash: sg[0][2] ? '6 4' : null, w: 2.8 })),
      texts: [{ x: 0.23, y: 1.3, t: 'low (refuge) branch', c: '--stable' }, { x: 0.61, y: 8.9, t: 'high (outbreak) branch', c: '--stable' }, { x: 0.43, y: 3.2, t: 'middle branch, unstable', c: '--unstable' }] });
  },
  'sis': () => {
    const ts = range(0, 40, 200);
    const sol = (b, g, i0) => { const a = b - g, K = 1 - g / b; return ts.map(t => [t, a === 0 ? i0 : K / (1 + ((K - i0) / i0) * Math.exp(-a * t))]); };
    return plot({ label: 'SIS solutions', x: [0, 40], y: [0, 0.8], xticks: [[0], [10], [20], [30], [40]], yticks: [[0], [0.2], [0.4], [0.6], [0.8]], xlabel: 'time t', ylabel: 'infected fraction i(t)',
      series: [{ pts: sol(0.5, 0.2, 0.01), c: '--c2' }, { pts: ts.map(t => [t, 0.6]), c: '--c2', dash: '3 4', w: 1.2 }, { pts: sol(0.2, 0.5, 0.3), c: '--c1' }],
      texts: [{ x: 13, y: 0.7, t: 'β = 0.5, γ = 0.2 · settles at 1 − γ/β = 0.6', c: '--c2' }, { x: 17, y: 0.08, t: 'β = 0.2, γ = 0.5 · dies out', c: '--c1' }] });
  },
  'diffusion': () => {
    const E = [[0, 1], [0, 4], [1, 2], [1, 3], [2, 3], [2, 4]], n = 5, dt = 0.002;
    let x = [1, 0, 0, 0, 0]; const hist = [...Array(n)].map(() => []);
    for (let s = 0; s <= 2500; s++) {
      if (s % 25 === 0) x.forEach((v, i) => hist[i].push([s * dt, v]));
      const dx = Array(n).fill(0); E.forEach(([a, b]) => { dx[a] += x[b] - x[a]; dx[b] += x[a] - x[b]; });
      x = x.map((v, i) => v + dt * dx[i]);
    }
    const cols = ['--c2', '--c1', '--c3', '--c4', '--muted-fg'];
    return plot({ label: 'Diffusion on the five-node graph', x: [0, 5], y: [0, 1], xticks: [[0], [1], [2], [3], [4], [5]], yticks: [[0], [0.2], [0.4], [0.6], [0.8], [1]], xlabel: 'time t (C = 1)', ylabel: 'amount at node, xᵢ(t)',
      series: hist.map((h, i) => ({ pts: h, c: cols[i] })),
      texts: [{ x: 0.35, y: 0.86, t: 'node 1 starts with everything', c: '--c2' }, { x: 3.1, y: 0.27, t: 'all nodes → 1/5 = 0.2', c: '--fg' }] });
  },
};
// bifurcation diagrams (course convention: dashed = stable, solid = unstable; colour carries it too)
function bif(kind) {
  const R = range(-2, 2, 80), sq = v => Math.sqrt(v);
  const br = (f, a, b, st) => ({ pts: range(a, b, 60).map(r => [r, f(r)]), c: st ? '--stable' : '--unstable', dash: st ? '6 4' : null, w: 2.8 });
  const map = {
    saddle: [br(r => sq(r), 0, 2, true), br(r => -sq(r), 0, 2, false)],
    trans: [br(() => 0, -2, 0, true), br(() => 0, 0, 2, false), br(r => r, -2, 0, false), br(r => r, 0, 2, true)],
    super: [br(() => 0, -2, 0, true), br(() => 0, 0, 2, false), br(r => sq(r), 0, 2, true), br(r => -sq(r), 0, 2, true)],
    sub: [br(() => 0, -2, 0, true), br(() => 0, 0, 2, false), br(r => sq(-r), -2, 0, false), br(r => -sq(-r), -2, 0, false)],
  };
  return plot({ label: kind + ' bifurcation diagram', x: [-2, 2], y: [-1.7, 1.7], w: 260, h: 200, ml: 16, mr: 14, mt: 12, mb: 26, xaxisAt: 0, yaxisAt: 0,
    series: map[kind], texts: [{ x: 1.95, y: 0, t: 'r', a: 'end', dy: 15, c: '--muted-fg' }, { x: 0, y: 1.6, t: 'x*', dx: 6, dy: 4, c: '--muted-fg' }] });
}
['saddle', 'trans', 'super', 'sub'].forEach(k => plots['bif-' + k] = () => bif(k));

/* ---------------- phase portraits (2-D flows), integrated with RK4 ---------------- */
// o = { f:(x,y)=>[dx,dy], x:[min,max], y:[min,max], starts:[[x,y],..], T, dt, back:[[x,y],..] (integrated backwards),
//       marks:[{x,y,stable}], lines:[{pts,c,dash}], texts, w, h, label }
function phase(o) {
  const W = o.w || 300, H = o.h || 300, P = 14;
  const [x0, x1] = o.x, [y0, y1] = o.y;
  const sx = v => P + (v - x0) / (x1 - x0) * (W - 2 * P), sy = v => H - P - (v - y0) / (y1 - y0) * (H - 2 * P);
  const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const step = (x, y, h) => {
    const k1 = o.f(x, y), k2 = o.f(x + h * k1[0] / 2, y + h * k1[1] / 2), k3 = o.f(x + h * k2[0] / 2, y + h * k2[1] / 2), k4 = o.f(x + h * k3[0], y + h * k3[1]);
    return [x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
  };
  let s = `<svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label || 'phase portrait'}">`;
  if (x0 < 0 && x1 > 0) s += `<line x1="${f2(sx(0))}" y1="${P}" x2="${f2(sx(0))}" y2="${H - P}" style="stroke:var(--axis)" stroke-width="1"/>`;
  if (y0 < 0 && y1 > 0) s += `<line x1="${P}" y1="${f2(sy(0))}" x2="${W - P}" y2="${f2(sy(0))}" style="stroke:var(--axis)" stroke-width="1"/>`;
  (o.lines || []).forEach(l => s += `<polyline points="${l.pts.map(([x, y]) => f2(sx(x)) + ',' + f2(sy(y))).join(' ')}" fill="none" style="stroke:var(${l.c || '--muted-fg'})" stroke-width="${l.w || 1.6}"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''}/>`);
  const traj = (start, dir) => {
    let [x, y] = start; const pts = [[x, y]]; const T = o.T || 12, dt = (o.dt || 0.01) * dir;
    for (let t = 0; t < T; t += Math.abs(dt)) { [x, y] = step(x, y, dt); if (!isFinite(x) || !inside(x, y)) break; pts.push([x, y]); }
    return dir > 0 ? pts : pts.reverse();
  };
  const draw = (raw, col = o.c || '--c3', wd = 1.7) => {
    // keep only points at least ~1.5 px apart (the integrator step is far finer than the screen)
    const pts = raw.filter((p, i) => i === 0 || i === raw.length - 1 || (draw.last && Math.hypot(sx(p[0]) - sx(draw.last[0]), sy(p[1]) - sy(draw.last[1])) < 1.5 ? false : (draw.last = p, true)));
    draw.last = null;
    if (pts.length < 3) return;
    s += `<polyline points="${pts.map(([x, y]) => f2(sx(x)) + ',' + f2(sy(y))).join(' ')}" fill="none" style="stroke:var(${col})" stroke-width="${wd}" stroke-linejoin="round"/>`;
    // arrowhead at the point where a third of the drawn length has been covered
    let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(sx(pts[i][0]) - sx(pts[i - 1][0]), sy(pts[i][1]) - sy(pts[i - 1][1])); L += d; seg.push(L); }
    const target = L * (o.arrowAt || 0.35); const i = Math.max(1, seg.findIndex(v => v >= target) + 1);
    const ax = sx(pts[i][0]), ay = sy(pts[i][1]), bx = sx(pts[i - 1][0]), by = sy(pts[i - 1][1]);
    const ang = Math.atan2(ay - by, ax - bx), a = 7;
    if (L > 20) s += `<path d="M${f2(ax + a * Math.cos(ang))},${f2(ay + a * Math.sin(ang))} L${f2(ax + a * Math.cos(ang + 2.5))},${f2(ay + a * Math.sin(ang + 2.5))} L${f2(ax + a * Math.cos(ang - 2.5))},${f2(ay + a * Math.sin(ang - 2.5))} z" style="fill:var(${col})"/>`;
  };
  (o.starts || []).forEach(p => draw(traj(p, 1)));
  (o.back || []).forEach(p => draw(traj(p, -1), o.backC || o.c || '--c3', o.backW || 1.7));
  (o.marks || []).forEach(m => {
    const c = m.stable ? '--stable' : '--unstable';
    s += m.stable ? `<circle cx="${f2(sx(m.x))}" cy="${f2(sy(m.y))}" r="5" style="fill:var(${c})"/>`
      : `<circle cx="${f2(sx(m.x))}" cy="${f2(sy(m.y))}" r="5" style="fill:var(--card);stroke:var(${c})" stroke-width="2.2"/>`;
  });
  (o.texts || []).forEach(t => s += `<text x="${f2(sx(t.x) + (t.dx || 0))}" y="${f2(sy(t.y) + (t.dy || 0))}" text-anchor="${t.a || 'start'}" class="lb" style="fill:var(${t.c || '--fg'})">${t.t}</text>`);
  return s + '</svg>';
}
const ring = (n, r, cx = 0, cy = 0) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n + 0.3), cy + r * Math.sin(2 * Math.PI * i / n + 0.3)]);
const lin = (a, b, c, d) => (x, y) => [a * x + b * y, c * x + d * y];
Object.assign(plots, {
  'ph-saddle': () => phase({ label: 'Saddle', f: lin(1, 1, 4, -2), x: [-3, 3], y: [-3, 3], T: 4, starts: [[-3, 2.6], [3, -2.6], [-3, 3], [3, -3], [-0.7, 3], [0.7, -3], [-2, 3], [2, -3], [0.75, -3], [-0.75, 3]], marks: [{ x: 0, y: 0 }], lines: [{ pts: [[-3, -3], [3, 3]], c: '--c2', dash: '4 3' }, { pts: [[-0.75, 3], [0.75, -3]], c: '--c1', dash: '4 3' }] }),
  'ph-stable-node': () => phase({ label: 'Stable node', f: lin(-2, 0, 0, -0.5), x: [-3, 3], y: [-3, 3], T: 12, starts: ring(16, 2.95), marks: [{ x: 0, y: 0, stable: true }] }),
  'ph-unstable-node': () => phase({ label: 'Unstable node', f: lin(2, 0, 0, 0.5), x: [-3, 3], y: [-3, 3], T: 12, back: ring(16, 2.95), marks: [{ x: 0, y: 0 }], arrowAt: 0.65 }),
  'ph-star': () => phase({ label: 'Star', f: lin(-1, 0, 0, -1), x: [-3, 3], y: [-3, 3], T: 8, starts: ring(16, 2.95), marks: [{ x: 0, y: 0, stable: true }] }),
  'ph-stable-spiral': () => phase({ label: 'Stable spiral', f: lin(-0.25, -1, 1, -0.25), x: [-3, 3], y: [-3, 3], T: 30, starts: [[2.8, 0], [-2.8, 0]], marks: [{ x: 0, y: 0, stable: true }], arrowAt: 0.2 }),
  'ph-unstable-spiral': () => phase({ label: 'Unstable spiral', f: lin(0.25, 1, -1, 0.25), x: [-3, 3], y: [-3, 3], T: 40, starts: [[0.15, 0]], marks: [{ x: 0, y: 0 }], arrowAt: 0.5 }),
  'ph-center': () => phase({ label: 'Center', f: lin(0, 1, -1, 0), x: [-3, 3], y: [-3, 3], T: 6.4, starts: [[0.8, 0], [1.6, 0], [2.4, 0]], marks: [{ x: 0, y: 0, stable: true }] }),
  'ph-line': () => phase({ label: 'Line of fixed points', f: lin(0, 0, 0, -1), x: [-3, 3], y: [-3, 3], T: 8, starts: [-2, -1, 0, 1, 2].flatMap(x => [[x, 3], [x, -3]]), lines: [{ pts: [[-3, 0], [3, 0]], c: '--stable', w: 3 }] }),
  'ph-rabbits': () => phase({ label: 'Rabbits and sheep', w: 420, h: 330, f: (x, y) => [x * (3 - x - 2 * y), y * (2 - x - y)], x: [-0.05, 3.5], y: [-0.05, 2.6], T: 15, dt: 0.005,
    starts: [[0.2, 0.05], [0.05, 0.2], [0.5, 2.5], [1.5, 2.5], [3.5, 2.3], [3.5, 1.4], [3.5, 0.6], [3.5, 0.1], [2.5, 2.5], [0.3, 0.5], [0.5, 0.3], [0.4, 0.4], [1.0, 2.5]],
    back: [[1.002, 1.006], [0.998, 0.994]], backC: '--c4', backW: 3.4, c: '--c3',
    marks: [{ x: 0, y: 0 }, { x: 3, y: 0, stable: true }, { x: 0, y: 2, stable: true }, { x: 1, y: 1 }],
    texts: [{ x: 3, y: 0, dy: -10, a: 'middle', t: '(3, 0)' }, { x: 0, y: 2, dx: 8, dy: -6, t: '(0, 2)' }, { x: 1, y: 1, dx: 8, dy: 14, t: '(1, 1) saddle' }] }),
  'ph-lv': () => phase({ label: 'Predator and prey', w: 420, h: 300, f: (n, p) => [n * (2 / 3 - 4 / 3 * p), p * (n - 1)], x: [0, 3.2], y: [0, 1.6], T: 9.5, dt: 0.002,
    starts: [[1, 0.6], [1, 0.8], [1, 1.0], [1, 1.2]], marks: [{ x: 1, y: 0.5, stable: true }],
    texts: [{ x: 1, y: 0.5, dx: 8, dy: 4, t: '(d/c, a/b) = (1, 0.5)' }, { x: 3.1, y: 0.05, a: 'end', dy: -4, t: 'prey N →', c: '--muted-fg' }, { x: 0.05, y: 1.5, t: '↑ predators P', c: '--muted-fg' }] }),
  'ph-limit-cycle': () => phase({ label: 'Limit cycle of the Stuart–Landau oscillator', w: 320, h: 320, f: (x, y) => { const r2 = x * x + y * y; return [x - y - x * r2, x + y - y * r2]; }, x: [-2, 2], y: [-2, 2], T: 14, dt: 0.005,
    starts: [[0.05, 0], [1.95, 1.2], [-1.95, -1.2]], marks: [{ x: 0, y: 0 }], lines: [{ pts: Array.from({ length: 73 }, (_, i) => [Math.cos(i * Math.PI / 36), Math.sin(i * Math.PI / 36)]), c: '--stable', w: 3 }] }),
  'ph-vdp': () => phase({ label: 'Van der Pol limit cycle', w: 320, h: 320, f: (x, v) => [v, -x - 1.5 * (x * x - 1) * v], x: [-3, 3], y: [-4, 4], T: 30, dt: 0.004, starts: [[0.1, 0], [3, 4]], marks: [{ x: 0, y: 0 }], arrowAt: 0.15 }),
});

/* ---------------- plots for the 2026 mid-sem answers ---------------- */
Object.assign(plots, {
  'l-vs-n': () => {
    const Ns = range(1, 6, 100).map(e => 10 ** e);
    return plot({ label: 'Average path length of an ER graph against N', x: [10, 1e6], y: [0, 7], logx: false, w: 460, h: 260,
      xticks: [[10, ''], [2e5, '200k'], [4e5, '400k'], [6e5, '600k'], [8e5, '800k'], [1e6, '1M']], yticks: [[0], [2], [4], [6]], xlabel: 'number of nodes N', ylabel: '⟨ℓ⟩',
      series: [{ pts: range(10, 1e6, 400).map(N => [N, Math.log(N) / Math.log(10)]), c: '--c1', w: 2.6 }],
      texts: [{ x: 3e5, y: 4.5, t: '⟨ℓ⟩ = ln N / ln⟨k⟩, ⟨k⟩ = 10', c: '--c1' }] });
  },
  'c-vs-n': () => plot({ label: 'Average clustering of an ER graph against N', x: [10, 1e6], y: [1e-5, 1], logx: true, logy: true, w: 460, h: 260,
    xticks: logTicks(1, 6), yticks: logTicks(-5, 0), xlabel: 'number of nodes N', ylabel: 'C̄',
    series: [{ pts: range(1, 6, 50).map(e => [10 ** e, Math.min(1, 10 / 10 ** e)]), c: '--c2', w: 2.6 }, { pts: [[10, 0.3], [1e6, 0.3]], c: '--c1', dash: '6 4', w: 2 }],
    texts: [{ x: 3e2, y: 0.45, t: 'real social networks: C̄ stays about 0.1–0.6', c: '--c1' }, { x: 14, y: 3e-4, t: 'ER: C̄ = 10/N, slope −1', c: '--c2' }] }),
});

/* ---------------- plots for the After mid-sem guide ---------------- */
function cobweb(f, x0, n, label, extra = {}) {
  const pts = [[x0, 0]]; let x = x0;
  for (let i = 0; i < n; i++) { const y = f(x); pts.push([x, y]); pts.push([y, y]); x = y; }
  const xs = range(extra.lo ?? 0, extra.hi ?? 1, 200);
  return plot({ label, x: [extra.lo ?? 0, extra.hi ?? 1], y: [extra.lo ?? 0, extra.hi ?? 1], w: 300, h: 300, ml: 40, mb: 38,
    xticks: extra.ticks || [[0], [0.5], [1]], yticks: extra.ticks || [[0], [0.5], [1]], xlabel: 'x(n)', ylabel: 'x(n+1)',
    series: [{ pts: xs.map(x => [x, x]), c: '--muted-fg', dash: '4 4', w: 1.4 }, { pts: xs.map(x => [x, f(x)]), c: '--c3', w: 2.2 }, { pts, c: '--c2', w: 1.4 }],
    texts: extra.texts || [] });
}
Object.assign(plots, {
  'td-diagram': () => {
    const ts = range(-3, 3, 120);
    return plot({ label: 'Trace–determinant classification', x: [-2.5, 3], y: [-3, 3], w: 520, h: 380, xaxisAt: 0, yaxisAt: 0, ml: 20, mb: 30,
      xticks: [], yticks: [], series: [{ pts: ts.map(t => [t * t / 4, t]), c: '--c4', w: 2.4 }, { pts: [[0, 0], [3, 0]], c: '--c1', w: 4 }],
      texts: [{ x: -1.3, y: 1.6, t: 'SADDLES', a: 'middle', c: '--c2' }, { x: -1.3, y: 1.2, t: 'Δ < 0', a: 'middle', c: '--muted-fg' },
        { x: 0.55, y: 2.6, t: 'unstable nodes', c: '--c2' }, { x: 1.9, y: 1.2, t: 'unstable spirals', c: '--c2' },
        { x: 1.9, y: -1.2, t: 'stable spirals', c: '--c1' }, { x: 0.55, y: -2.7, t: 'stable nodes', c: '--c1' },
        { x: 2.95, y: 0, dy: -8, a: 'end', t: 'centers (τ = 0)', c: '--c1' }, { x: 2.95, y: 3, dy: 14, a: 'end', t: 'τ² = 4Δ', c: '--c4' },
        { x: 3, y: 0, dy: 18, a: 'end', t: 'Δ (determinant) →', c: '--muted-fg' }, { x: 0, y: 3, dx: 6, dy: 12, t: 'τ (trace) ↑', c: '--muted-fg' }] });
  },
  'cobweb-25': () => cobweb(x => 2.5 * x * (1 - x), 0.1, 30, 'Cobweb for r = 2.5', { texts: [{ x: 0.62, y: 0.55, t: 'x* = 0.6', c: '--c1' }] }),
  'cobweb-32': () => cobweb(x => 3.2 * x * (1 - x), 0.3, 60, 'Cobweb for r = 3.2'),
  'cobweb-cos': () => cobweb(Math.cos, -1.2, 30, 'Cobweb for the cosine map', { lo: -1.5, hi: 1.5, ticks: [[-1], [0], [1]], texts: [{ x: 0.75, y: 0.62, t: 'x* = 0.739', c: '--c1' }] }),
  'logistic-bif': () => {
    const pts = [];
    for (let i = 0; i <= 900; i++) { const r = 1 + 3 * i / 900; let x = 0.5; for (let k = 0; k < 400; k++) x = r * x * (1 - x); for (let k = 0; k < 120; k++) { x = r * x * (1 - x); pts.push([r, x]); } }
    return plot({ label: 'Bifurcation diagram of the logistic map', x: [1, 4], y: [0, 1], w: 560, h: 320, xticks: [[1], [2], [3], [3.449, '3.45'], [3.57, ''], [4]], yticks: [[0], [0.5], [1]], xlabel: 'r', ylabel: 'long-run values of x',
      series: [{ pts, c: '--c3', pixels: true }], vlines: [{ x: 3, text: '3' }, { x: 3.57, text: '3.57' }] });
  },
  ...Object.fromEntries([[2.5, '--c1'], [3.2, '--c2'], [3.9, '--c4']].map(([rr, col]) => ['logistic-ts-' + String(rr).replace('.', ''), () => {
    let x = 0.5; const p = []; for (let k = 0; k <= 30; k++) { p.push([k, x]); x = rr * x * (1 - x); }
    return plot({ label: 'Logistic map time series, r = ' + rr, x: [0, 30], y: [0, 1], w: 300, h: 200, ml: 40, mb: 38, xticks: [[0], [10], [20], [30]], yticks: [[0], [0.5], [1]], xlabel: 'step n', ylabel: 'x(n)',
      series: [{ pts: p, c: col, dots: true, r: 2.2, w: 1.4 }] });
  }])),
  'lorenz': () => {
    const s = 10, b = 8 / 3, rho = 28; let [x, y, z] = [1, 1, 1]; const dt = 0.005, pts = [];
    const F = (x, y, z) => [s * (y - x), rho * x - y - x * z, x * y - b * z];
    for (let i = 0; i < 9000; i++) {
      const k1 = F(x, y, z), k2 = F(x + dt / 2 * k1[0], y + dt / 2 * k1[1], z + dt / 2 * k1[2]), k3 = F(x + dt / 2 * k2[0], y + dt / 2 * k2[1], z + dt / 2 * k2[2]), k4 = F(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
      x += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); z += dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      if (i > 200 && i % 2 === 0) pts.push([x, z]);
    }
    const c = Math.sqrt(b * (rho - 1));
    return plot({ label: 'Lorenz attractor', x: [-22, 22], y: [0, 52], w: 460, h: 380, xticks: [[-20], [-10], [0], [10], [20]], yticks: [[0], [10], [20], [30], [40], [50]], xlabel: 'x', ylabel: 'z',
      series: [{ pts, c: '--c3', w: 0.7 }], marks: [{ x: c, y: rho - 1 }, { x: -c, y: rho - 1 }],
      texts: [{ x: c, y: rho - 1, dx: 8, dy: 4, t: 'P₁' }, { x: -c, y: rho - 1, dx: -8, dy: 4, a: 'end', t: 'P₂' }] });
  },
  'kuramoto-r': () => {
    const Ks = range(0, 6, 200), Kc = 2;
    return plot({ label: 'Kuramoto order parameter against coupling', x: [0, 6], y: [0, 1], w: 520, h: 280, xticks: [[0], [1], [2, 'Kc'], [3], [4], [5], [6]], yticks: [[0], [0.5], [1]], xlabel: 'coupling K', ylabel: 'order parameter r',
      series: [{ pts: Ks.map(K => [K, K < Kc ? 0 : Math.sqrt(1 - Kc / K)]), c: '--c1', w: 2.8 }], vlines: [{ x: 2 }],
      texts: [{ x: 0.2, y: 0.08, t: 'incoherent, r = 0', c: '--muted-fg' }, { x: 3.2, y: 0.55, t: 'partial sync, r = √(1 − Kc/K)', c: '--c1' }] });
  },
  'pendulum': () => {
    const w0 = Math.sqrt(9.8 / 0.25), w1 = w0 * Math.sqrt(2 + Math.SQRT2), w2 = w0 * Math.sqrt(2 - Math.SQRT2), ts = range(0, 4.6, 500);
    return plot({ label: 'Double pendulum angles for equal masses', x: [0, 4.6], y: [-32, 32], w: 560, h: 260, xaxisAt: 0, xticks: [[0], [1], [2], [3], [4]], yticks: [[-30], [-15], [0], [15], [30]], xlabel: 'time t (s)', ylabel: 'angle (degrees)',
      series: [{ pts: ts.map(t => [t, 15 * (Math.cos(w1 * t) + Math.cos(w2 * t))]), c: '--c2', w: 1.8 }, { pts: ts.map(t => [t, 15 / Math.SQRT2 * (Math.cos(w2 * t) - Math.cos(w1 * t))]), c: '--c1', w: 1.8, dash: '5 3' }],
      texts: [{ x: 0.05, y: 30, dy: -4, t: 'φ₂ (starts at 30°)', c: '--c2' }, { x: 2.6, y: -27, t: 'φ₁ (starts at 0°)', c: '--c1' }] });
  },
  'sl-radial': () => {
    const rs = range(0, 1.4, 100);
    return plot({ label: 'Radial equation of the limit cycle', x: [0, 1.4], y: [-0.8, 0.5], w: 400, h: 240, xaxisAt: 0, xticks: [[0], [0.5], [1], [1.4, '']], yticks: [[-0.5], [0], [0.5]], xlabel: 'r (distance from the centre)', ylabel: 'rate ṙ',
      series: [{ pts: rs.map(r => [r, (1 - r * r) * r]), c: '--c3' }], arrows: [{ x: 0.5, dir: 1 }, { x: 1.2, dir: -1 }], marks: [{ x: 0, y: 0 }, { x: 1, y: 0, stable: true }],
      texts: [{ x: 0.97, y: 0, dy: 18, a: 'end', t: 'r = 1 (the cycle)' }] });
  },
  'hopf-super': () => plot({ label: 'Supercritical Hopf: radius of the cycle against mu', x: [-1, 1], y: [0, 1.1], w: 300, h: 220, ml: 30, mb: 34, yaxisAt: 0, xticks: [[-1], [0], [1]], yticks: [], xlabel: 'μ', ylabel: 'r*',
    series: [{ pts: [[-1, 0], [0, 0]], c: '--stable', dash: '6 4', w: 2.8 }, { pts: [[0, 0], [1, 0]], c: '--unstable', w: 2.8 }, { pts: range(0, 1, 50).map(m => [m, Math.sqrt(m)]), c: '--stable', dash: '6 4', w: 2.8 }],
    texts: [{ x: 0.05, y: 1.02, t: 'stable cycle, r = √μ', c: '--stable' }, { x: -0.95, y: 0.1, t: 'stable point', c: '--stable' }, { x: 0.3, y: 0.08, t: 'origin unstable', c: '--unstable' }] }),
});

/* ---------------- TeX → MathML ---------------- */
const macros = { '\\avg': '\\langle #1\\rangle' };
let errors = 0;
const render = (tex, display) => {
  try { return temml.renderToString(tex, { displayMode: display, throwOnError: true, macros }); }
  catch (e) { errors++; console.error('TeX error:', e.message, '\n  in:', tex.slice(0, 120)); return `<span style="color:red">[TeX error]</span>`; }
};
for (const page of PAGES) {
  if (!fs.existsSync(page.src)) continue;
  const files = fs.readdirSync(page.src).filter(f => f.endsWith('.html')).sort();
  let html = files.map(f => fs.readFileSync(path.join(page.src, f), 'utf8')).join('\n');
  html = html.replace(/<!--include:([\w\/.-]+)-->/g, (m, f) => fs.readFileSync(f, 'utf8'));
  html = html.replace(/\{\{ROOT\}\}/g, page.root);
  html = html.replace(/<!--plot:([\w-]+)-->/g, (m, name) => {
    if (!plots[name]) throw new Error('unknown plot ' + name);
    return plots[name]();
  });
  html = html.replace(/\\\[([\s\S]+?)\\\]/g, (m, t) => render(t.trim(), true));
  html = html.replace(/\\\(([\s\S]+?)\\\)/g, (m, t) => render(t.trim(), false));
  fs.mkdirSync(path.dirname(page.out), { recursive: true });
  fs.writeFileSync(page.out, html);
  console.log(`${page.out} written (${(html.length / 1024).toFixed(0)} KB), ${files.length} parts`);
}
console.log(`${errors} TeX errors`);
if (errors) process.exit(1);
