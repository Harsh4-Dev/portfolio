/* history.js — the ML-history page for the terminal theme: eras on the left, the architecture drawn in ASCII on the right. */
import { loadContent, esc } from './content.js';
import { AsciiDiagram } from './ascii-diagram.js';
import { scramble } from './ascii-fx.js';

const $ = (s) => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function main() {
  let C;
  try { C = await loadContent(); } catch (e) { $('#hist-list').innerHTML = `<li class="err">could not load content.json (${esc(e.message)})</li>`; return; }
  const S = C.settings || {};
  const set = (k, v) => v && document.body.style.setProperty(k, String(v));
  set('--t-bg', S.terminal_bg); set('--t-fg', S.terminal_fg); set('--t-dim', S.terminal_dim); set('--t-accent', S.terminal_accent);
  const font = S.terminal_font || 'JetBrains Mono';
  set('--t-font', `"${font}", "IBM Plex Mono", ui-monospace, Consolas, monospace`);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;700&display=swap`;
  document.head.appendChild(link);
  const PS = S.terminal_user || 'portfolio';
  $('#ps').textContent = PS; $('#ps2').textContent = PS;
  document.title = `${S.journey_title || 'A short history of learning machines'} — ${S.name || ''}`;
  $('#hist-title').textContent = (S.journey_title || 'a short history of learning machines').toLowerCase();

  const eras = C.journey || [];
  const list = $('#hist-list');
  list.innerHTML = eras.map((e, i) => `<li data-i="${i}"><span class="y" data-text="${esc(e.year)}">${esc(e.year)}</span> <span class="t">${esc(e.title)}</span><span class="ins">${esc(e.insight)}</span></li>`).join('');
  const items = [...list.children];

  const dia = AsciiDiagram($('#hist-screen'), { pulses: 4 });
  dia.start();
  window.__dia = dia;

  let cur = -1, timer = 0;
  const show = (i, manual) => {
    cur = (i + eras.length) % eras.length;
    items.forEach((li, k) => li.classList.toggle('active', k === cur));
    dia.setShape(eras[cur].shape || 'constellation');
    if (!reduced) scramble(items[cur].querySelector('.y'));
    if (manual) { clearInterval(timer); timer = setInterval(() => show(cur + 1), 10000); }
  };
  items.forEach((li) => li.addEventListener('click', () => show(+li.dataset.i, true)));
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); show(cur + 1, true); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); show(cur - 1, true); }
    if (e.key === 'h' || e.key === 'Escape') location.href = 'index.html?theme=terminal';
  });
  setTimeout(() => show(0), 300);
  timer = setInterval(() => show(cur + 1), 10000);
}
main();
