/*
 * ascii-fx.js — terminal-theme effects: ASCII portrait, text scramble, rotating wireframe,
 * and the animated character field that sits behind the page.
 */

/* ------------------------------------------------------------------ portrait from an image */
export function asciiImage(src, cols, opts = {}) {
  const ramp = opts.ramp || ' .:-=+*#%@';
  const cellAspect = opts.cellAspect || 0.5;
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      const rows = Math.max(4, Math.round(cols * cellAspect * (im.naturalHeight / im.naturalWidth)));
      const c = document.createElement('canvas');
      c.width = cols; c.height = rows;
      const ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0, cols, rows);
      const d = ctx.getImageData(0, 0, cols, rows).data;
      const out = [];
      for (let y = 0; y < rows; y++) {
        let line = '';
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const lum = ((0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255) * (d[i + 3] / 255);
          const v = opts.invert ? 1 - lum : lum;
          line += ramp[Math.min(ramp.length - 1, Math.round(Math.pow(v, 1.1) * (ramp.length - 1)))];
        }
        out.push(line);
      }
      resolve(out);
    };
    im.onerror = reject;
    im.src = src;
  });
}

/* ------------------------------------------------------------------ text scramble (hover decode) */
const SCRAMBLE = '!<>-_\\/[]{}=+*^?#%&';
export function scramble(el, opts = {}) {
  const original = el.dataset.text || el.textContent;
  el.dataset.text = original;
  if (el._scrambling) return;
  el._scrambling = true;
  const duration = opts.duration || 420;
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    let s = '';
    for (let i = 0; i < original.length; i++) {
      const ch = original[i];
      if (ch === ' ') { s += ' '; continue; }
      s += i / original.length < p ? ch : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
    }
    el.textContent = s;
    if (p < 1) requestAnimationFrame(tick);
    else { el.textContent = original; el._scrambling = false; }
  };
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ rotating ASCII wireframes */
const PHI = (1 + Math.sqrt(5)) / 2;
function ring(n, r, y) { return Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, y, Math.sin((i / n) * Math.PI * 2) * r]); }
const WIRES = {
  ico: () => ({
    V: [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]].map((v) => v.map((n) => n / PHI)),
    E: [[0, 11], [0, 5], [0, 1], [0, 7], [0, 10], [1, 5], [5, 11], [11, 10], [10, 7], [7, 1], [3, 9], [3, 4], [3, 2], [3, 6], [3, 8], [4, 9], [2, 4], [6, 2], [8, 6], [9, 8], [4, 5], [4, 11], [2, 11], [2, 10], [6, 10], [6, 7], [8, 7], [8, 1], [9, 1], [9, 5]],
  }),
  cube: () => ({ V: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map((v) => v.map((n) => n * 0.85)), E: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] }),
  octa: () => ({ V: [[1.1, 0, 0], [-1.1, 0, 0], [0, 1.1, 0], [0, -1.1, 0], [0, 0, 1.1], [0, 0, -1.1]], E: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]] }),
  torus: () => {
    const V = [], E = [], N = 14, M = 6;
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const a = (i / N) * Math.PI * 2, b = (j / M) * Math.PI * 2, R = 0.85, r = 0.32;
      V.push([(R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a)]);
      E.push([i * M + j, i * M + ((j + 1) % M)], [i * M + j, ((i + 1) % N) * M + j]);
    }
    return { V, E };
  },
  sphere: () => {
    const V = [], E = [], LAT = 5, LON = 12;
    for (let i = 1; i <= LAT; i++) { const t = (i / (LAT + 1)) * Math.PI; ring(LON, Math.sin(t) * 1.05, Math.cos(t) * 1.05).forEach((p) => V.push(p)); }
    for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) { E.push([i * LON + j, i * LON + ((j + 1) % LON)]); if (i < LAT - 1) E.push([i * LON + j, (i + 1) * LON + j]); }
    return { V, E };
  },
  tetra: () => ({ V: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((n) => n * 0.8)), E: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] }),
};
export const WIRE_SHAPES = Object.keys(WIRES);

export function AsciiWire(pre, opts = {}) {
  const cols = opts.cols || 46, rows = opts.rows || 23;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let { V, E } = WIRES[opts.shape || 'ico']();
  let shapeName = opts.shape || 'ico', pending = null, scale = 1;
  let raf = 0, t = 0, running = false, speed = 1;
  const grid = new Array(cols * rows);
  function project(v, a, b) {
    const [x0, y0, z0] = v;
    const cy = Math.cos(a), sy = Math.sin(a), cx = Math.cos(b), sx = Math.sin(b);
    const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
    const y1 = y0 * cx - z1 * sx, z2 = y0 * sx + z1 * cx;
    const d = 3.2 / (3.2 + z2 * 0.9);
    return [Math.round((x1 * d * 0.42 * scale + 0.5) * (cols - 1)), Math.round((y1 * d * 0.42 * 0.5 * scale + 0.5) * (rows - 1)), z2];
  }
  function line(x0, y0, x1, y1, ch) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 400; n++) {
      if (x0 >= 0 && x0 < cols && y0 >= 0 && y0 < rows && grid[y0 * cols + x0] !== '@') grid[y0 * cols + x0] = ch;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    t += reduced ? 0 : 0.011 * speed;
    speed += (1 - speed) * 0.02;
    if (pending) { scale -= 0.07; if (scale <= 0.05) { ({ V, E } = WIRES[pending]()); shapeName = pending; pending = null; scale = 0.05; } }
    else if (scale < 1) scale = Math.min(1, scale + 0.05);
    grid.fill(' ');
    const P = V.map((v) => project(v, t, t * 0.6 + 0.4));
    for (const [a, b] of E) {
      const depth = (P[a][2] + P[b][2]) / 2;
      line(P[a][0], P[a][1], P[b][0], P[b][1], depth > 0.3 ? '.' : depth > -0.3 ? '+' : '#');
    }
    if (V.length <= 12) for (const p of P) if (p[0] >= 0 && p[0] < cols && p[1] >= 0 && p[1] < rows) grid[p[1] * cols + p[0]] = '@';
    let s = '';
    for (let y = 0; y < rows; y++) s += grid.slice(y * cols, (y + 1) * cols).join('') + '\n';
    pre.textContent = s;
  }
  return {
    start() { running = true; frame(); },
    stop() { running = false; cancelAnimationFrame(raf); },
    kick() { speed = 6; },
    setShape(name) { if (WIRES[name] && name !== shapeName && name !== pending) { pending = name; speed = 3; } },
    get shape() { return shapeName; },
  };
}

/* ------------------------------------------------------------------ animated character field (canvas) */
export function CharField(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ramp = opts.ramp || ' .:+=*#';
  const family = opts.family || 'ui-monospace, monospace';
  const fontSize = opts.fontSize || 12;
  let cw = 7.2, ch = 15, cols = 0, rows = 0, dpr = 1;
  let colors = { fg: opts.fg || '#ffffff', accent: opts.accent || '#f2c86b' };
  let atlas = null;
  let heat = new Float32Array(0);
  const mouse = { x: -1, y: -1 };
  let sweep = -1, sweepAt = 0;
  let intensity = opts.intensity ?? 1;
  let raf = 0, running = false, last = 0, time = 0;
  const pulses = [];

  function buildAtlas() {
    const off = document.createElement('canvas');
    off.width = Math.ceil(cw * dpr) * ramp.length; off.height = Math.ceil(ch * dpr) * 2;
    const o = off.getContext('2d');
    o.font = `${fontSize * dpr}px ${family}`;
    o.textBaseline = 'middle'; o.textAlign = 'center';
    [colors.fg, colors.accent].forEach((c, row) => {
      o.fillStyle = c;
      for (let i = 0; i < ramp.length; i++) o.fillText(ramp[i], (i + 0.5) * cw * dpr, (row + 0.5) * ch * dpr);
    });
    atlas = off;
  }
  function fit() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.font = `${fontSize}px ${family}`;
    cw = ctx.measureText('M').width || 7.2; ch = Math.round(fontSize * 1.3);
    cols = Math.ceil(w / cw); rows = Math.ceil(h / ch);
    heat = new Float32Array(cols * rows);
    buildAtlas();
  }
  function draw(now) {
    if (!running) return;
    raf = requestAnimationFrame(draw);
    if (now - last < 1000 / 20) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const aw = Math.ceil(cw * dpr), ah = Math.ceil(ch * dpr);
    if (sweep < 0 && time - sweepAt > 11 && !reduced) { sweep = -2; sweepAt = time; }
    if (sweep >= -2) { sweep += dt * rows * 0.8; if (sweep > rows + 2) sweep = -1; }
    const mx = mouse.x / cw, my = mouse.y / ch;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let v = 0.5 + 0.5 * Math.sin(x * 0.11 + time * 0.3) * Math.sin(y * 0.21 - time * 0.2) + 0.25 * Math.sin((x + y) * 0.07 + time * 0.45);
        v = Math.max(0, (v - 0.86) * 3.0) * intensity;
        if (mouse.x >= 0) { const d2 = (x - mx) * (x - mx) + (y - my) * (y - my) * 4; if (d2 < 80) heat[i] = Math.min(1, heat[i] + (1 - d2 / 80) * 0.45); }
        for (const p of pulses) { const d = Math.sqrt((x - p.x) * (x - p.x) + (y - p.y) * (y - p.y) * 4); if (Math.abs(d - p.r) < 2.5) heat[i] = Math.min(1, heat[i] + 0.6 * p.a); }
        if (sweep >= -2 && Math.abs(y - sweep) < 1.2) v = Math.max(v, 0.5);
        heat[i] *= 0.93;
        const total = Math.min(1, v + heat[i]);
        if (total < 0.08) continue;
        const idx = Math.min(ramp.length - 1, Math.max(1, Math.round(total * (ramp.length - 1))));
        const accent = heat[i] > 0.35;
        ctx.globalAlpha = accent ? Math.min(1, 0.35 + heat[i]) : Math.min(0.38, 0.1 + total * 0.3);
        ctx.drawImage(atlas, idx * aw, accent ? ah : 0, aw, ah, Math.round(x * cw * dpr), Math.round(y * ch * dpr), aw, ah);
      }
    }
    ctx.globalAlpha = 1;
    for (let k = pulses.length - 1; k >= 0; k--) { pulses[k].r += dt * 26; pulses[k].a *= 0.965; if (pulses[k].a < 0.05) pulses.splice(k, 1); }
  }
  const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
  const onLeave = () => { mouse.x = -1; mouse.y = -1; };
  const onResize = () => fit();
  return {
    start() { fit(); running = true; last = performance.now(); window.addEventListener('pointermove', onMove, { passive: true }); document.addEventListener('pointerleave', onLeave); window.addEventListener('resize', onResize); raf = requestAnimationFrame(draw); },
    stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); window.removeEventListener('resize', onResize); },
    pulse(px, py) { pulses.push({ x: px / cw, y: py / ch, r: 0, a: 1 }); },
    setIntensity(v) { intensity = v; },
    setColors(fg, accent) { colors = { fg, accent }; if (cols) buildAtlas(); },
  };
}
