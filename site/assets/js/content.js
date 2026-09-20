/*
 * content.js — shared helpers: load content.json, tiny markdown, list splitting, dates, theme.
 */

export async function loadContent(url = 'content.json') {
  const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`content.json: HTTP ${res.status}`);
  return res.json();
}

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const slug = (s) => String(s ?? '').trim().replace(/[^\w-]+/g, '-');

/** "a, b; c" -> ["a","b","c"] */
export function splitList(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v;
  return String(v).split(/[;,\n]/).map((s) => s.trim()).filter(Boolean);
}

/** "GitHub|https://x ; Paper|https://y" -> [{label,url}] */
export function splitLinks(v) {
  return String(v ?? '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const [a, b] = s.split('|').map((x) => x.trim());
    return b ? { label: a, url: b } : { label: a.replace(/^https?:\/\//, ''), url: a };
  });
}

export const yes = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return ['yes', 'y', 'true', '1', 'x', 'on'].includes(String(v ?? '').trim().toLowerCase());
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Pretty-print a date typed however: 2026-06, 2026-06-01, 2026, "Jun 2026", "Present" */
export function fmtDate(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (m) return `${MONTHS[Math.max(0, Math.min(11, +m[2] - 1))]} ${m[1]}`;
  if (/^\d{4}$/.test(s)) return s;
  if (typeof v === 'number' && v > 1900 && v < 2200) return String(v);
  return s;
}

export function dateRange(it) {
  const a = fmtDate(it.start), b = fmtDate(it.end);
  if (a && b) return `${a} – ${b}`;
  if (a && !b && it.start && !it.end && ('end' in it || 'start' in it)) return a;
  if (a) return a;
  if (it.date) return fmtDate(it.date);
  if (it.year) return fmtDate(it.year);
  return b;
}

/** Minimal markdown: paragraphs, "- " bullets, **bold**, *italic*, `code`, [text](url), line breaks. */
export function md(text) {
  if (text == null || text === '') return '';
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+|#[^)\s]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const blocks = String(text).replace(/\r/g, '').split(/\n\s*\n/);
  return blocks.map((b) => {
    const lines = b.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) return '';
    if (lines.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l))) {
      return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*([-•*]|\d+[.)])\s+/, ''))}</li>`).join('')}</ul>`;
    }
    // mixed: bullets after a lead line
    const out = [];
    let ul = [];
    const flush = () => { if (ul.length) { out.push(`<ul>${ul.join('')}</ul>`); ul = []; } };
    for (const l of lines) {
      if (/^\s*([-•*]|\d+[.)])\s+/.test(l)) ul.push(`<li>${inline(l.replace(/^\s*([-•*]|\d+[.)])\s+/, ''))}</li>`);
      else { flush(); out.push(`<p>${inline(l)}</p>`); }
    }
    flush();
    return out.join('');
  }).join('');
}

/** Plain-text one-liner (for cards' short preview). */
export function plain(text, max = 180) {
  const s = String(text ?? '').replace(/[*`_#>]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^\s*[-•]\s+/gm, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
}

/** Map "accent2" / "#hex" / "teal" to a CSS colour value. */
export function themeColor(v, fallback = 'var(--accent)') {
  if (!v) return fallback;
  const s = String(v).trim().toLowerCase();
  const m = s.match(/^accent[-_ ]?(\d)?$/);
  if (m) return m[1] && m[1] !== '1' ? `var(--accent-${m[1]})` : 'var(--accent)';
  if (['ink', 'paper'].includes(s)) return `var(--${s})`;
  return s;
}

export const ACCENT_CYCLE = ['var(--accent)', 'var(--accent-3)', 'var(--accent-2)', 'var(--accent-4)'];
export const cycleColor = (i) => ACCENT_CYCLE[i % ACCENT_CYCLE.length];

/** Apply Settings colours & fonts as CSS variables and load the Google Fonts. */
export function applyTheme(settings) {
  const r = document.documentElement.style;
  const set = (k, v) => v && r.setProperty(k, String(v));
  set('--paper', settings.color_paper);
  set('--paper-2', settings.color_paper_2);
  set('--ink', settings.color_ink);
  set('--accent', settings.color_accent);
  set('--accent-2', settings.color_accent_2);
  set('--accent-3', settings.color_accent_3);
  set('--accent-4', settings.color_accent_4);
  const fam = (n, fb) => (n ? `"${n}", ${fb}` : '');
  set('--font-display', fam(settings.font_display, 'Georgia, serif'));
  set('--font-hand', fam(settings.font_hand, 'cursive'));
  set('--font-body', fam(settings.font_body, 'system-ui, sans-serif'));
  const fonts = [settings.font_display, settings.font_hand, settings.font_body].filter(Boolean);
  if (fonts.length && !document.getElementById('gfonts')) {
    const link = document.createElement('link');
    link.id = 'gfonts';
    link.rel = 'stylesheet';
    const fam2 = fonts.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:ital,wght@0,300..900;1,300..900`).join('&');
    link.href = `https://fonts.googleapis.com/css2?${fam2}&display=swap`;
    document.head.appendChild(link);
  }
}

export const KNOWN_KEYS = new Set(['title', 'subtitle', 'org', 'role', 'company', 'location', 'start', 'end', 'date', 'year', 'description', 'summary',
  'tags', 'tools', 'stack', 'link', 'url', 'link_label', 'links', 'image', 'images', 'icon', 'color', 'group', 'level', 'value', 'label',
  'featured', 'order', 'hidden', 'status', 'caption']);

/** Extra columns that are not part of the standard schema -> [{key,label,value}] */
export function extraFields(item) {
  return Object.entries(item)
    .filter(([k, v]) => !KNOWN_KEYS.has(k) && v !== '' && v != null)
    .map(([k, v]) => ({ key: k, label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: v }));
}

/** Resolve an image reference: URL, data URI or a file in assets/img/ */
export const img = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return /^(https?:|data:|\/)/.test(s) ? s : `assets/img/${s}`;
};

export const hrefOf = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^(https?:|mailto:|tel:|#|\.\/|\/)/.test(s) || s.endsWith('.html') || s.endsWith('.pdf')) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`;
  if (s.includes('@')) return `mailto:${s}`;
  return s;
};

/** Poll studio.py for workbook changes (the endpoint does not exist on GitHub Pages, so this is a no-op there). */
export function initLiveReload() {
  let stamp = null;
  const poll = async () => {
    try {
      const r = await fetch('/__studio/version', { cache: 'no-store' });
      if (!r.ok) return;
      const v = (await r.json()).version;
      if (stamp && v !== stamp) location.reload();
      stamp = v;
      setTimeout(poll, 1500);
    } catch { /* not served by studio.py */ }
  };
  poll();
}

/** UI text: T(key, fallback, {vars}) — Text sheet value if present, else the fallback; {placeholders} filled from vars. */
export function makeText(content) {
  const t = content.text || {};
  return (key, fallback, vars = {}) => {
    const raw = t[key] != null && t[key] !== '' ? String(t[key]) : String(fallback ?? '');
    return raw.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  };
}

/** Settings switch: yes/no with a default when the row is missing or blank. */
export const flag = (S, key, def = 'yes') => { const v = S?.[key]; return v == null || v === '' ? yes(def) : yes(v); };

/** Sections visible in a given theme ('paper' | 'terminal'). */
export const sectionsFor = (content, theme) => (content.sections || []).filter((s) => s.visible !== false && ['all', theme, ''].includes(String(s.themes || 'all').toLowerCase()));

export const THEMES = ['paper', 'terminal'];

/** Which theme to show: ?theme= in the URL, then the visitor's saved choice, then Settings.theme. */
export function resolveTheme(settings) {
  const def = String(settings.theme || 'paper').trim().toLowerCase();
  // theme_toggle = no means visitors cannot switch, so Settings wins over any saved or URL choice
  if (!flag(settings, 'theme_toggle')) return THEMES.includes(def) ? def : 'paper';
  const url = new URLSearchParams(location.search).get('theme');
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch { /* storage blocked */ }
  for (const t of [url, saved, def]) if (THEMES.includes(t)) return t;
  return 'paper';
}

export function switchTheme(theme) {
  try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  const u = new URL(location.href);
  u.searchParams.set('theme', theme);
  u.hash = '';
  location.href = u.toString();
}
