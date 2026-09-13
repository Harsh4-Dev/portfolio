/*
 * ascii.js — ASCII rendering helpers for the terminal theme.
 *
 *   measureCell(el)                       -> { w, h } size of one monospace character cell
 *   asciiText(text, cols, opts)           -> string[] rows of an ASCII banner generated from a real font
 *   resolveInto(pre, rows, opts)          -> animates random characters "resolving" into the final rows
 *   AsciiScreen(pre, sourceCanvas, opts)  -> continuously converts a WebGL canvas into characters
 */

export const RAMP = ' .:-=+*#%@';
const NOISE = '01!<>-_\\/[]{}=+*^?#________';

export function measureCell(el) {
  const probe = document.createElement('span');
  probe.textContent = 'M'.repeat(20);
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;padding:0;margin:0;';
  el.appendChild(probe);
  const r = probe.getBoundingClientRect();
  el.removeChild(probe);
  const w = r.width / 20;
  const h = parseFloat(getComputedStyle(el).lineHeight) || r.height;
  return { w: w || 7.8, h: h || 14 };
}

/** Rasterise text with a real font and sample it into an ASCII grid. */
export function asciiText(text, cols, opts = {}) {
  const cellAspect = opts.cellAspect || 0.5; // width / height of a character cell
  const font = opts.font || '900 100px system-ui, "Segoe UI", Arial, sans-serif';
  const ramp = opts.ramp || ' .:-=+*#%@';
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const m = ctx.measureText(text);
  const textW = Math.ceil(m.width) + 8;
  const textH = Math.ceil((m.actualBoundingBoxAscent || 80) + (m.actualBoundingBoxDescent || 20)) + 8;
  c.width = textW; c.height = textH;
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, 4, (m.actualBoundingBoxAscent || 80) + 4);
  const rows = Math.max(3, Math.round((cols * cellAspect * textH) / textW));
  const sc = document.createElement('canvas');
  sc.width = cols; sc.height = rows;
  const sctx = sc.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(c, 0, 0, cols, rows);
  const data = sctx.getImageData(0, 0, cols, rows).data;
  const out = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) {
      const a = data[(y * cols + x) * 4 + 3] / 255;
      line += ramp[Math.min(ramp.length - 1, Math.round(Math.pow(a, 0.8) * (ramp.length - 1)))];
    }
    out.push(line.replace(/\s+$/, ''));
  }
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

/** Animate `pre` from noise into `rows` (array of strings). Returns a promise that resolves when settled. */
export function resolveInto(pre, rows, opts = {}) {
  const duration = opts.duration || 1400;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const width = Math.max(...rows.map((r) => r.length), 1);
  const cells = rows.map((r) => r.padEnd(width, ' ').split(''));
  if (reduced) { pre.textContent = rows.join('\n'); return Promise.resolve(); }
  const settle = cells.map((row, y) => row.map((ch, x) => (ch === ' ' ? 0 : (x / width) * 0.55 + Math.random() * 0.45)));
  const t0 = performance.now();
  return new Promise((resolve) => {
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      let s = '';
      for (let y = 0; y < cells.length; y++) {
        for (let x = 0; x < width; x++) {
          const ch = cells[y][x];
          if (ch === ' ') { s += (p < 0.7 && Math.random() < 0.015 * (1 - p)) ? NOISE[Math.floor(Math.random() * NOISE.length)] : ' '; continue; }
          s += p >= settle[y][x] ? ch : NOISE[Math.floor(Math.random() * NOISE.length)];
        }
        s += '\n';
      }
      pre.textContent = s;
      if (p < 1) requestAnimationFrame(tick); else { pre.textContent = rows.join('\n'); resolve(); }
    };
    requestAnimationFrame(tick);
  });
}

/** Live WebGL-canvas -> ASCII converter. Call start(); stop() to end. */
export function AsciiScreen(pre, source, opts = {}) {
  const fps = opts.fps || 24;
  const ramp = opts.ramp || RAMP;
  const accentClass = opts.accentClass || 'a';
  const sample = document.createElement('canvas');
  const sctx = sample.getContext('2d', { willReadFrequently: true });
  let cols = 80, rows = 30, raf = 0, last = 0, running = false;
  const esc = (ch) => (ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : ch);

  function fit() {
    const cell = measureCell(pre);
    cols = Math.max(20, Math.floor(pre.clientWidth / cell.w));
    rows = Math.max(10, Math.floor(pre.clientHeight / cell.h));
    sample.width = cols; sample.height = rows;
  }

  function draw(now) {
    if (!running) return;
    raf = requestAnimationFrame(draw);
    if (now - last < 1000 / fps) return;
    last = now;
    if (!(source.width > 0 && source.height > 0)) return;
    sctx.clearRect(0, 0, cols, rows);
    sctx.drawImage(source, 0, 0, cols, rows);
    const d = sctx.getImageData(0, 0, cols, rows).data;
    let html = '', inAccent = false;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const a = d[i + 3] / 255;
        const lum = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
        const v = Math.min(1, a * (lum * 0.75 + 0.25) * 1.15);
        const idx = v < 0.05 ? 0 : Math.min(ramp.length - 1, Math.max(1, Math.round(v * (ramp.length - 1))));
        const ch = ramp[idx];
        const accent = idx > 0 && d[i] - d[i + 1] > 40;
        if (accent && !inAccent) { html += `<span class="${accentClass}">`; inAccent = true; }
        else if (!accent && inAccent) { html += '</span>'; inAccent = false; }
        html += esc(ch);
      }
      if (inAccent) { html += '</span>'; inAccent = false; }
      html += '\n';
    }
    pre.innerHTML = html;
  }

  const onResize = () => fit();
  return {
    start() { fit(); running = true; window.addEventListener('resize', onResize); raf = requestAnimationFrame(draw); },
    stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); },
    fit,
  };
}
