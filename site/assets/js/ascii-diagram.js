/*
 * ascii-diagram.js — draws the architecture layouts (layouts.js) directly as characters:
 * nodes as o / O / @ glyphs, edges as - | / \ lines, a slow 3D sway, and a dust transition
 * where the old diagram blows away as particles and the new one condenses from them.
 *
 *   const d = AsciiDiagram(pre); d.start(); d.setShape('perceptron');
 */
import { LAYOUTS, mulberry } from './layouts.js';
import { measureCell } from './ascii.js';

const DUST = '@*+=:.';
const esc = (ch) => (ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : ch);

export function AsciiDiagram(pre, opts = {}) {
  const fps = opts.fps || 20;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = mulberry(99);
  let cols = 80, rows = 24, raf = 0, last = 0, running = false, time = 0;
  let layout = null, shapeId = null;
  let phase = 'idle', pt = 0; // 'out' -> 'in' -> 'idle'
  let particles = [];
  let chars = [], cls = [];
  const pulses = Array.from({ length: opts.pulses ?? 4 }, () => ({ e: -1, t: rnd() }));

  function fit() {
    const cell = measureCell(pre);
    cols = Math.max(30, Math.floor(pre.clientWidth / cell.w));
    rows = Math.max(12, Math.floor(pre.clientHeight / cell.h));
    chars = new Array(cols * rows); cls = new Uint8Array(cols * rows);
  }

  function project(p) {
    const a = reduced ? 0.25 : Math.sin(time * 0.25) * 0.55 + 0.15;
    const b = reduced ? 0.12 : Math.sin(time * 0.17) * 0.12 + 0.1;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const X = p[0] * ca + p[2] * sa, Z = -p[0] * sa + p[2] * ca;
    const Y = p[1] * cb - Z * sb;
    const sx = (cols * 0.86) / 10, sy = Math.min(sx * 0.5, (rows * 0.8) / 6);
    return [Math.round(cols / 2 + X * sx), Math.round(rows / 2 - Y * sy), Z];
  }

  const put = (x, y, ch, c) => { if (x >= 0 && x < cols && y >= 0 && y < rows) { const i = y * cols + x; if (c >= cls[i] || cls[i] === 1) { chars[i] = ch; cls[i] = c; } } };
  function edgeChar(dx, dy) {
    const ax = Math.abs(dx), ay = Math.abs(dy) * 2; // a row is ~2 columns tall
    if (ay < ax * 0.35) return '-';
    if (ax < ay * 0.35) return '|';
    return '.'; // diagonals as dots: crossings stay quiet, nodes stay the focus
  }
  function drawLine(x0, y0, x1, y1, ch, c, reach = 1) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    const total = Math.max(dx, -dy) || 1;
    let err = dx + dy, n = 0;
    for (let k = 0; k < 600; k++) {
      if (n / total > reach) break;
      const i = y0 * cols + x0;
      // dashed: every other cell, so crossing edges stay readable
      if (n % 2 === 0 && x0 >= 0 && x0 < cols && y0 >= 0 && y0 < rows && cls[i] < 2) { chars[i] = ch; cls[i] = c; }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; n++; }
      if (e2 <= dx) { err += dx; y0 += sy; n++; }
    }
  }
  function nodeGlyph(nd) {
    const big = nd.s >= 0.9, mid = nd.s >= 0.42;
    if (nd.c === 1) return big ? ['(', 'o', ')'] : mid ? [null, 'o', null] : [null, 'o', null];
    const g = nd.c === 2 ? '@' : mid ? '@' : '*';
    return big ? ['(', g, ')'] : [null, g, null];
  }
  function drawNode(nd, P, c) {
    const [x, y] = P, [l, m, r] = nodeGlyph(nd);
    put(x, y, m, c);
    if (l) { put(x - 1, y, l, c); put(x + 1, y, r, c); }
  }

  function render() {
    chars.fill(' '); cls.fill(0);
    if (layout && (phase === 'idle' || phase === 'in')) {
      const P = layout.nodes.map((nd) => project(nd.p));
      const inT = phase === 'in' ? pt : 99;
      const edgeReach = (e) => (phase === 'idle' ? 1 : Math.max(0, Math.min(1, (inT - 1.0 - (e % 7) * 0.05) / 0.5)));
      layout.edges.forEach(([a, b], e) => {
        const r = edgeReach(e);
        if (r <= 0) return;
        drawLine(P[a][0], P[a][1], P[b][0], P[b][1], edgeChar(P[b][0] - P[a][0], P[b][1] - P[a][1]), 1, r);
      });
      if (phase === 'idle' || inT > 0.95) layout.nodes.forEach((nd, i) => drawNode(nd, P[i], nd.c === 2 ? 3 : 2));
      // pulses
      if (phase === 'idle' && layout.edges.length) {
        for (const pu of pulses) {
          if (pu.e < 0) { pu.e = Math.floor(rnd() * layout.edges.length); pu.t = 0; }
          const [a, b] = layout.edges[pu.e];
          const x = Math.round(P[a][0] + (P[b][0] - P[a][0]) * pu.t), y = Math.round(P[a][1] + (P[b][1] - P[a][1]) * pu.t);
          const i = y * cols + x;
          if (x >= 0 && x < cols && y >= 0 && y < rows && cls[i] < 2) { chars[i] = '*'; cls[i] = 3; }
        }
      }
    }
    for (const p of particles) {
      const x = Math.round(p.x), y = Math.round(p.y);
      const stage = Math.min(DUST.length - 1, Math.floor(p.k * DUST.length));
      if (x >= 0 && x < cols && y >= 0 && y < rows && cls[y * cols + x] < 4) { chars[y * cols + x] = p.conv ? DUST[DUST.length - 1 - stage] : DUST[stage]; cls[y * cols + x] = p.acc ? 3 : 4; }
    }
    let html = '', curc = -1;
    const open = (c) => (c === 1 ? '<span class="e">' : c === 2 ? '<span class="n">' : c === 3 ? '<span class="a">' : c === 4 ? '<span class="d">' : '');
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x, c = cls[i];
        if (c !== curc) { if (curc > 0) html += '</span>'; html += open(c); curc = c; }
        html += esc(chars[i] || ' ');
      }
      if (curc > 0) { html += '</span>'; curc = -1; }
      html += '\n';
    }
    pre.innerHTML = html;
  }

  function step(dt) {
    time += dt;
    if (phase === 'idle') {
      for (const pu of pulses) { pu.t += dt * 0.6; if (pu.t >= 1) pu.e = -1; }
      return;
    }
    pt += dt;
    for (const p of particles) {
      if (p.conv) {
        const k = Math.min(1, pt / 0.95), e = 1 - Math.pow(1 - k, 3);
        p.x = p.sx + (p.tx - p.sx) * e; p.y = p.sy + (p.ty - p.sy) * e; p.k = k;
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= dt * 0.6; p.k = Math.min(1, p.age / p.life); p.age += dt;
      }
    }
    if (phase === 'out') {
      particles = particles.filter((p) => p.k < 1);
      if (pt > 0.7) { phase = 'in'; pt = 0; spawnConverge(); }
    } else if (phase === 'in') {
      if (pt > 0.95) particles = particles.filter((p) => !p.conv);
      if (pt > 1.6) { phase = 'idle'; particles = []; }
    }
  }

  function spawnDissolve(oldLayout) {
    if (!oldLayout) return;
    const P = oldLayout.nodes.map((nd) => project(nd.p));
    oldLayout.nodes.forEach((nd, i) => {
      const n = nd.s > 0.6 ? 4 : 2;
      for (let k = 0; k < n; k++) particles.push({ x: P[i][0], y: P[i][1], vx: 12 + rnd() * 30, vy: -2 - rnd() * 6, age: rnd() * 0.15, life: 0.5 + rnd() * 0.4, k: 0, conv: false, acc: nd.c === 2 });
    });
  }
  function spawnConverge() {
    const P = layout.nodes.map((nd) => project(nd.p));
    layout.nodes.forEach((nd, i) => {
      const n = nd.s > 0.6 ? 3 : 1;
      for (let k = 0; k < n; k++) particles.push({ sx: P[i][0] - 10 - rnd() * 35, sy: P[i][1] + 3 + rnd() * 8, tx: P[i][0], ty: P[i][1], x: 0, y: 0, k: 0, conv: true, acc: nd.c === 2 });
    });
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / fps) return;
    const dt = Math.min(0.2, (now - last) / 1000); last = now;
    step(dt);
    render();
  }
  const onResize = () => fit();
  return {
    setShape(id, o = {}) {
      const key = LAYOUTS[id] ? id : 'constellation';
      if (key === shapeId && !o.force) return;
      const old = layout;
      shapeId = key; layout = LAYOUTS[key]();
      for (const pu of pulses) pu.e = -1;
      if (reduced || o.instant || !old) { phase = 'idle'; particles = []; if (!old && !reduced && !o.instant) { phase = 'in'; pt = 0; spawnConverge(); } return; }
      particles = []; phase = 'out'; pt = 0; spawnDissolve(old);
    },
    start() { fit(); running = true; last = performance.now(); window.addEventListener('resize', onResize); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); },
    get shape() { return shapeId; },
    debug() {
      let err = null;
      try { step(0.05); render(); } catch (e) { err = String(e.stack || e); }
      let filled = 0, clsSum = 0;
      for (let i = 0; i < chars.length; i++) { if (chars[i] && chars[i] !== ' ') filled++; clsSum += cls[i] || 0; }
      return { cols, rows, phase, pt: +pt.toFixed(2), particles: particles.length, nodes: layout?.nodes.length, edges: layout?.edges.length, nonSpace: (pre.textContent.match(/[^\s]/g) || []).length, filled, clsSum, charsLen: chars.length, clsType: cls.constructor.name, err, sampleP: layout ? project(layout.nodes[0].p) : null, P2: layout ? layout.nodes.slice(0, 3).map((n) => project(n.p)) : null };
    },
  };
}
