/*
 * doodles.js — a small library of hand-drawn SVG accents.
 * Every path carries pathLength="1" so CSS can "draw" it with stroke-dashoffset.
 * Usage:  doodle('brain')  ->  '<svg class="doodle doodle-brain" ...>…</svg>'
 */

const P = (d, extra = '') => `<path d="${d}" pathLength="1" ${extra}/>`;

export const DOODLES = {
  // ---- accents / decorations -------------------------------------------------
  underline: { vb: '0 0 200 20', body: P('M3 12 C 40 4, 70 18, 105 9 S 165 3, 197 11') + P('M12 17 C 60 12, 120 19, 190 15', 'opacity=".55"') },
  squiggle: { vb: '0 0 120 30', body: P('M4 18 C 14 2, 22 2, 30 18 S 46 34, 56 18 S 72 2, 82 18 S 98 34, 116 12') },
  circle: { vb: '0 0 100 100', body: P('M50 14 C 78 12, 92 30, 88 52 C 84 76, 62 90, 40 86 C 18 82, 8 62, 12 42 C 16 24, 34 14, 54 15 C 70 16, 84 28, 86 44') },
  arrow: { vb: '0 0 100 100', body: P('M8 60 C 30 20, 60 30, 88 48') + P('M70 34 L 90 48 L 72 62') },
  'arrow-curl': { vb: '0 0 100 100', body: P('M18 12 C 10 50, 30 70, 60 66 C 84 62, 82 40, 66 42 C 52 44, 56 66, 80 82') + P('M66 86 L 84 84 L 80 66') },
  'arrow-down': { vb: '0 0 60 100', body: P('M30 6 C 22 30, 38 50, 28 88') + P('M12 72 L 28 90 L 46 72') },
  star: { vb: '0 0 100 100', body: P('M50 10 L 60 40 L 92 42 L 66 60 L 74 92 L 50 72 L 26 92 L 34 60 L 8 42 L 40 40 Z') },
  sparkle: { vb: '0 0 100 100', body: P('M50 8 C 52 34, 60 46, 92 50 C 60 54, 52 66, 50 92 C 48 66, 40 54, 8 50 C 40 46, 48 34, 50 8 Z') },
  plus: { vb: '0 0 60 60', body: P('M30 8 C 28 26, 32 40, 30 52') + P('M8 30 C 24 28, 40 32, 52 30') },
  wave: { vb: '0 0 100 100', body: P('M20 62 C 26 40, 34 40, 40 62 C 46 84, 54 84, 60 62 C 66 40, 74 40, 80 62') + P('M28 30 C 40 22, 60 22, 72 30', 'opacity=".6"') },
  // ---- icons -----------------------------------------------------------------
  brain: { vb: '0 0 100 100', body: P('M46 18 C 34 12, 20 20, 22 34 C 12 40, 12 56, 22 62 C 18 78, 36 88, 46 78 C 50 86, 60 88, 66 78 C 84 84, 92 66, 82 56 C 92 46, 86 30, 72 30 C 70 16, 54 12, 46 18 Z') + P('M46 18 C 44 40, 48 60, 46 78') + P('M32 44 C 40 44, 44 50, 40 56') + P('M60 36 C 68 40, 66 50, 58 52') },
  chip: { vb: '0 0 100 100', body: P('M26 26 L 74 24 L 76 74 L 24 76 Z') + P('M40 40 L 60 39 L 61 61 L 39 62 Z') + P('M34 8 L 34 22 M50 8 L 50 22 M66 8 L 66 22 M34 78 L 34 92 M50 78 L 50 92 M66 78 L 66 92 M8 34 L 22 34 M8 50 L 22 50 M8 66 L 22 66 M78 34 L 92 34 M78 50 L 92 50 M78 66 L 92 66') },
  network: { vb: '0 0 100 100', body: P('M18 30 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0') + P('M18 72 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0') + P('M52 50 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0') + P('M84 26 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0') + P('M84 74 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0') + P('M26 32 L 44 46 M26 70 L 44 54 M60 45 L 76 30 M60 55 L 76 70') },
  graph: { vb: '0 0 100 100', body: P('M12 84 L 12 16 M12 84 L 88 84') + P('M20 70 C 34 66, 40 48, 52 50 C 64 52, 68 30, 84 22') + P('M78 20 L 88 22 L 84 32') },
  lightbulb: { vb: '0 0 100 100', body: P('M50 10 C 28 10, 18 30, 24 46 C 28 56, 38 60, 38 70 L 62 70 C 62 60, 72 56, 76 46 C 82 30, 72 10, 50 10 Z') + P('M40 78 L 60 78 M42 86 L 58 86') + P('M44 60 C 46 48, 40 44, 50 40 C 60 44, 54 48, 56 60') },
  rocket: { vb: '0 0 100 100', body: P('M50 10 C 66 24, 70 50, 62 72 L 38 72 C 30 50, 34 24, 50 10 Z') + P('M38 60 C 26 62, 20 74, 22 84 C 32 82, 38 78, 42 72 M62 60 C 74 62, 80 74, 78 84 C 68 82, 62 78, 58 72') + P('M44 78 C 46 88, 54 88, 56 78') + P('M50 36 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0') },
  book: { vb: '0 0 100 100', body: P('M12 22 C 26 16, 40 18, 50 26 C 60 18, 74 16, 88 22 L 88 80 C 74 74, 60 76, 50 84 C 40 76, 26 74, 12 80 Z') + P('M50 26 L 50 84') + P('M22 36 C 30 34, 36 36, 42 40 M22 50 C 30 48, 36 50, 42 54 M58 40 C 64 36, 70 34, 78 36 M58 54 C 64 50, 70 48, 78 50') },
  trophy: { vb: '0 0 100 100', body: P('M30 16 L 70 16 L 66 50 C 62 62, 38 62, 34 50 Z') + P('M30 22 C 14 22, 12 40, 30 44 M70 22 C 86 22, 88 40, 70 44') + P('M50 62 L 50 76 M34 84 L 66 84 M40 76 L 60 76 L 62 84 L 38 84 Z') },
  medal: { vb: '0 0 100 100', body: P('M50 60 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0') + P('M50 46 L 55 56 L 66 57 L 58 64 L 60 75 L 50 70 L 40 75 L 42 64 L 34 57 L 45 56 Z') + P('M36 40 L 26 10 L 44 10 L 50 26 L 56 10 L 74 10 L 64 40') },
  mail: { vb: '0 0 100 100', body: P('M12 28 L 88 26 L 90 74 L 10 76 Z') + P('M12 28 C 26 42, 38 52, 50 56 C 62 52, 74 42, 88 26') + P('M12 74 L 40 50 M88 74 L 60 50', 'opacity=".55"') },
  pin: { vb: '0 0 100 100', body: P('M50 90 C 30 64, 20 50, 22 36 C 24 20, 36 10, 50 10 C 64 10, 76 20, 78 36 C 80 50, 70 64, 50 90 Z') + P('M50 36 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0') },
  coffee: { vb: '0 0 100 100', body: P('M20 40 L 68 40 L 64 80 L 24 80 Z') + P('M68 48 C 84 46, 86 66, 66 68') + P('M34 30 C 30 22, 38 20, 34 12 M48 30 C 44 22, 52 20, 48 12') },
  code: { vb: '0 0 100 100', body: P('M34 26 L 10 50 L 34 74') + P('M66 26 L 90 50 L 66 74') + P('M58 18 L 42 84') },
  heart: { vb: '0 0 100 100', body: P('M50 84 C 20 62, 8 48, 12 32 C 16 14, 40 12, 50 30 C 60 12, 84 14, 88 32 C 92 48, 80 62, 50 84 Z') },
  flask: { vb: '0 0 100 100', body: P('M38 10 L 62 10 M42 10 L 42 40 L 18 84 L 82 84 L 58 40 L 58 10') + P('M28 66 C 40 60, 60 72, 72 66', 'opacity=".6"') + P('M46 72 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M60 76 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0') },
  globe: { vb: '0 0 100 100', body: P('M50 50 m-38 0 a38 38 0 1 0 76 0 a38 38 0 1 0 -76 0') + P('M50 12 C 30 30, 30 70, 50 88 C 70 70, 70 30, 50 12') + P('M12 50 L 88 50 M18 32 L 82 32 M18 68 L 82 68') },
  github: { vb: '0 0 100 100', body: P('M50 12 C 28 12, 12 29, 12 50 C 12 67, 23 81, 38 86 C 40 86, 41 85, 41 84 L 41 76 C 30 78, 28 71, 27 68 C 26 66, 24 63, 21 62 C 19 61, 18 59, 22 59 C 26 59, 29 63, 30 65 C 34 71, 40 69, 42 68 C 42 65, 44 63, 45 62 C 35 61, 25 57, 25 40 C 25 35, 27 31, 30 28 C 29 27, 28 22, 30 17 C 30 17, 34 16, 41 21 C 44 20, 47 20, 50 20 C 53 20, 56 20, 59 21 C 66 16, 70 17, 70 17 C 72 22, 71 27, 70 28 C 73 31, 75 35, 75 40 C 75 57, 65 61, 55 62 C 57 64, 59 67, 59 71 L 59 84 C 59 85, 60 86, 62 86 C 77 81, 88 67, 88 50 C 88 29, 72 12, 50 12 Z') },
  linkedin: { vb: '0 0 100 100', body: P('M16 18 L 82 16 L 84 82 L 18 84 Z') + P('M32 44 L 32 70 M32 30 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0') + P('M46 70 L 46 44 M46 54 C 48 44, 66 42, 66 56 L 66 70') },
  twitter: { vb: '0 0 100 100', body: P('M18 18 L 44 54 L 18 82 M82 18 L 56 46 M82 82 L 30 18 L 44 18 L 82 82 Z') },
  x: { vb: '0 0 100 100', body: P('M18 18 L 44 54 L 18 82 M82 18 L 56 46 M82 82 L 30 18 L 44 18 L 82 82 Z') },
  link: { vb: '0 0 100 100', body: P('M42 58 L 58 42') + P('M46 32 L 56 22 C 66 12, 84 30, 74 40 L 64 50') + P('M54 68 L 44 78 C 34 88, 16 70, 26 60 L 36 50') },
  external: { vb: '0 0 100 100', body: P('M60 18 L 82 18 L 82 40') + P('M82 18 L 44 56') + P('M70 56 L 70 82 L 18 82 L 18 30 L 44 30') },
  download: { vb: '0 0 100 100', body: P('M50 14 C 48 34, 52 50, 50 66') + P('M32 50 L 50 68 L 68 50') + P('M18 74 L 20 86 L 82 86 L 82 74') },
  menu: { vb: '0 0 100 100', body: P('M16 30 C 40 26, 62 34, 84 30 M16 50 C 40 46, 62 54, 84 50 M16 70 C 40 66, 62 74, 84 70') },
  close: { vb: '0 0 100 100', body: P('M22 22 C 40 38, 60 62, 78 78 M78 22 C 60 40, 40 60, 22 78') },
  print: { vb: '0 0 100 100', body: P('M30 36 L 30 14 L 70 14 L 70 36') + P('M18 36 L 82 36 L 82 70 L 68 70 M18 36 L 18 70 L 32 70') + P('M32 58 L 68 58 L 68 88 L 32 88 Z') + P('M42 70 L 58 70 M42 78 L 58 78', 'opacity=".55"') },
  scroll: { vb: '0 0 60 100', body: P('M30 8 C 16 8, 10 20, 10 32 L 10 68 C 10 82, 20 92, 30 92 C 40 92, 50 82, 50 68 L 50 32 C 50 20, 44 8, 30 8 Z') + P('M30 24 L 30 40') },
  neuron: { vb: '0 0 100 100', body: P('M50 50 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0') + P('M38 44 C 26 36, 20 30, 8 26 M40 56 C 28 62, 20 70, 10 78 M42 38 C 36 26, 34 18, 30 8') + P('M62 50 C 72 50, 80 50, 92 52') + P('M86 46 L 94 52 L 86 58') },
  dots: { vb: '0 0 100 30', body: P('M16 15 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M50 15 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M84 15 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0') },
};

export const DOODLE_NAMES = Object.keys(DOODLES);

const EMOJI_RE = /\p{Extended_Pictographic}/u;

export function isDoodle(name) {
  return !!(name && DOODLES[String(name).trim().toLowerCase()]);
}

/** Return the SVG markup for a doodle (or an emoji / plain text wrapped in a span). */
export function doodle(name, cls = '', opts = {}) {
  if (!name) return '';
  const key = String(name).trim().toLowerCase();
  const d = DOODLES[key];
  if (!d) {
    if (EMOJI_RE.test(name)) return `<span class="doodle doodle-emoji ${cls}" aria-hidden="true">${name}</span>`;
    return '';
  }
  const sw = opts.strokeWidth || 3;
  const label = opts.label ? `role="img" aria-label="${opts.label}"` : 'aria-hidden="true"';
  return `<svg class="doodle doodle-${key} ${cls}" viewBox="${d.vb}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" ${label}>${d.body}</svg>`;
}

/** Pick an icon for a social link from its label / URL when none is given. */
export function guessIcon(label = '', url = '') {
  const s = `${label} ${url}`.toLowerCase();
  if (s.includes('github')) return 'github';
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('twitter') || s.includes('x.com')) return 'twitter';
  if (s.includes('mailto:') || s.includes('mail')) return 'mail';
  if (s.includes('scholar') || s.includes('paper')) return 'book';
  if (s.includes('.pdf') || s.includes('resume') || s.includes('cv')) return 'download';
  return 'globe';
}
