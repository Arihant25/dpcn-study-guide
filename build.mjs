// Build: node build.mjs
// Concatenates src/*.html in order, draws the plots, renders \( \) and \[ \] TeX to MathML
// with temml, and writes a single self-contained index.html.
import fs from 'node:fs';
import path from 'node:path';
import temml from 'temml';

const SRC = 'src';
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.html')).sort();
let html = files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');

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

html = html.replace(/<!--plot:([\w-]+)-->/g, (m, name) => {
  if (!plots[name]) throw new Error('unknown plot ' + name);
  return plots[name]();
});

/* ---------------- TeX → MathML ---------------- */
const macros = { '\\avg': '\\langle #1\\rangle' };
let errors = 0;
const render = (tex, display) => {
  try { return temml.renderToString(tex, { displayMode: display, throwOnError: true, macros }); }
  catch (e) { errors++; console.error('TeX error:', e.message, '\n  in:', tex.slice(0, 120)); return `<span style="color:red">[TeX error]</span>`; }
};
html = html.replace(/\\\[([\s\S]+?)\\\]/g, (m, t) => render(t.trim(), true));
html = html.replace(/\\\(([\s\S]+?)\\\)/g, (m, t) => render(t.trim(), false));

fs.writeFileSync('index.html', html);
console.log(`index.html written (${(html.length / 1024).toFixed(0)} KB), ${files.length} parts, ${errors} TeX errors`);
if (errors) process.exit(1);
