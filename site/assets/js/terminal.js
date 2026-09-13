/*
 * terminal.js — the CLI theme. Same content.json, rendered as a terminal transcript:
 * typed commands, ASCII banner generated from a real font, the 3D scene rendered live as ASCII,
 * and a working prompt at the bottom (type `help`).
 */
import { esc, slug, splitList, splitLinks, yes, dateRange, fmtDate, md, plain, extraFields, img, hrefOf, initLiveReload, switchTheme } from './content.js';
import { asciiText, resolveInto, AsciiScreen, measureCell } from './ascii.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let C, S, SECTIONS, JOURNEY, ERA_BY_ID, LINKS, PS, scene = null, currentShape = null, currentMode = 'hero';
const eraOf = (id) => ERA_BY_ID[String(id || '').toLowerCase()];
const fileName = (sec) => String(sec.id).toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ---------------------------------------------------------------- pieces
const tagsLine = (it) => {
  const list = [...splitList(it.tags), ...splitList(it.tools), ...splitList(it.stack)];
  return list.length ? `<p class="line tagsline"><b>tags:</b> ${list.map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : '';
};
const linksLine = (it) => {
  const out = [];
  if (it.link || it.url) out.push({ label: it.link_label || 'open', url: it.link || it.url });
  out.push(...splitLinks(it.links));
  return out.length ? `<p class="line links-line">${out.map((l) => `<a href="${esc(hrefOf(l.url))}" target="_blank" rel="noopener">${esc(l.label.toLowerCase())}</a>`).join('')}</p>` : '';
};
const metaLine = (it) => {
  const ex = extraFields(it);
  return ex.length ? `<p class="line meta">${ex.map((f) => `<b>${esc(f.label.toLowerCase())}=</b>${esc(f.value)}`).join('  ')}</p>` : '';
};
const imagesOf = (it) => [...splitList(it.image).slice(0, 1), ...String(it.images ?? '').split(';').map((s) => s.trim()).filter(Boolean)].map(img);
const prompt = (cmd, typed = true) => `<p class="line prompt"><span class="ps">${esc(PS)}</span><span class="cmd" ${typed ? `data-cmd="${esc(cmd)}"` : ''}>${typed ? '' : esc(cmd)}</span></p>`;

const COMMANDS = {
  text: (s) => `cat ${fileName(s)}.md`, stats: (s) => `./${fileName(s)} --summary`, timeline: (s) => `cat ${fileName(s)}.log`,
  cards: (s) => `ls -la ${fileName(s)}/`, tags: (s) => `tree ${fileName(s)}/`, list: (s) => `cat ${fileName(s)}.txt`,
  gallery: (s) => `ls ${fileName(s)}/*.png`, table: (s) => `column -t ${fileName(s)}.tsv`, contact: () => 'cat contact.txt',
};

const RENDERERS = {
  text(sec, items) {
    if (!items.length) return md(sec.intro);
    return items.map((it) => `${it.title ? `<p class="line acc2">## ${esc(it.title)}</p>` : ''}${md(it.description || it.summary)}${linksLine(it)}${metaLine(it)}`).join('');
  },
  stats(sec, items) {
    return items.map((it) => `<div class="stat-line"><b>${esc(it.value ?? it.title ?? '')}</b><span>${esc(it.label ?? it.subtitle ?? it.description ?? '')}</span></div>`).join('');
  },
  timeline(sec, items) {
    return items.map((it) => `<div class="entry">
      <p class="line head"><span class="when">[${esc(dateRange(it) || '—')}]</span> ${esc(it.title || it.role || '')}${it.org || it.company ? ` <span class="org">@ ${esc(it.org || it.company)}</span>` : ''}${it.location ? ` <span class="loc">· ${esc(it.location)}</span>` : ''}</p>
      <div class="body">${it.subtitle ? `<p class="dim">${esc(it.subtitle)}</p>` : ''}${md(it.description || it.summary)}${tagsLine(it)}${linksLine(it)}${metaLine(it)}</div>
    </div>`).join('');
  },
  cards(sec, items) {
    const rows = items.map((it, i) => {
      const name = String(it.title || `item-${i + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const imgs = imagesOf(it);
      return `<span class="perm">${yes(it.featured) ? 'drwxr-xr-x' : 'drwxr-x---'}</span><span class="name" data-section="${esc(sec.id)}" data-index="${i}" role="button" tabindex="0">${esc(name)}/</span><span class="desc">${esc(it.subtitle || plain(it.description, 90))}</span><span class="st">${it.status ? `[${esc(String(it.status).toLowerCase())}]` : ''}${it.date ? ` ${esc(fmtDate(it.date))}` : ''}</span>
      <div class="detail" hidden id="detail-${esc(slug(sec.id))}-${i}">${prompt(`cat ${name}/README.md`, false)}<div class="box"><p class="line acc2"># ${esc(it.title)}</p>${it.subtitle ? `<p class="line dim">${esc(it.subtitle)}</p>` : ''}${imgs.length ? `<div class="gal">${imgs.map((s) => `<figure><img src="${esc(s)}" alt=""></figure>`).join('')}</div>` : ''}${md(it.description || it.summary)}${tagsLine(it)}${linksLine(it)}${metaLine(it)}</div></div>`;
    });
    return `<p class="line dim">total ${items.length}</p><div class="ls">${rows.join('')}</div>`;
  },
  tags(sec, items) {
    const groups = new Map();
    items.forEach((it) => { const g = it.group || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
    const width = Math.max(10, ...items.map((it) => String(it.title || it.label || '').length)) + 2;
    let out = `<span class="g">${esc(fileName(sec))}/</span>\n`;
    const gs = [...groups.entries()];
    gs.forEach(([g, list], gi) => {
      const lastG = gi === gs.length - 1;
      if (g) out += `<span class="br">${lastG ? '└── ' : '├── '}</span><span class="g">${esc(g)}</span>\n`;
      list.forEach((it, i) => {
        const last = i === list.length - 1;
        const lvl = Math.max(0, Math.min(5, Number(it.level) || 0));
        const bar = lvl ? `<span class="bar">${'█'.repeat(lvl * 2)}</span><span class="bar-off">${'░'.repeat(10 - lvl * 2)}</span>` : '';
        const name = esc(String(it.title || it.label || '').padEnd(width, ' '));
        const label = it.link ? `<a href="${esc(hrefOf(it.link))}" target="_blank" rel="noopener">${name}</a>` : name;
        out += `<span class="br">${g ? (lastG ? '    ' : '│   ') : ''}${last ? '└── ' : '├── '}</span>${label}${bar}\n`;
      });
    });
    return `<pre class="tree line">${out}</pre>`;
  },
  list(sec, items) {
    const groups = new Map();
    items.forEach((it) => { const g = it.group || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
    return `<div class="listing">${[...groups.entries()].map(([g, list]) => `${g ? `<p class="line acc2">## ${esc(g)}</p>` : ''}${list.map((it) => `<div class="row"><span class="when">${esc(fmtDate(it.date || it.year || it.start) || '—')}</span><span>${it.link ? `<a class="t" href="${esc(hrefOf(it.link))}" target="_blank" rel="noopener">${esc(it.title)}</a>` : `<span class="t">${esc(it.title)}</span>`}${it.subtitle || it.org ? `<br><span class="s">${esc(it.subtitle || it.org)}</span>` : ''}${it.description ? `<div class="s">${md(it.description)}</div>` : ''}${metaLine(it)}</span></div>`).join('')}`).join('')}</div>`;
  },
  gallery(sec, items) {
    return `<div class="gal">${items.flatMap((it) => imagesOf(it).map((src) => `<figure><img src="${esc(src)}" alt="${esc(it.caption || it.title || '')}" loading="lazy">${it.caption || it.title ? `<figcaption>${esc(it.caption || it.title)}</figcaption>` : ''}</figure>`)).join('')}</div>`;
  },
  table(sec, items) {
    const cols = [...new Set(items.flatMap((it) => Object.keys(it)))].filter((k) => !['order', 'hidden'].includes(k));
    return `<table><thead><tr>${cols.map((c) => `<td class="acc2">${esc(c)}</td>`).join('')}</tr></thead><tbody>${items.map((it) => `<tr>${cols.map((c) => `<td>${esc(it[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  },
  contact(sec, items) {
    const extra = LINKS.filter((l) => ['all', 'contact'].includes(l.show_in) && !items.some((it) => hrefOf(it.link) === l.url));
    const rows = [...items.map((it) => ({ k: it.title || it.label, v: it.subtitle || it.link, url: it.link || it.url })), ...extra.map((l) => ({ k: l.label, v: l.url.replace(/^(https?:\/\/|mailto:)/, ''), url: l.url }))];
    if (S.location) rows.push({ k: 'location', v: S.location });
    return `<div class="kv">${rows.map((r) => `<span class="k">${esc(String(r.k).toLowerCase())}</span><span>${r.url ? `<a href="${esc(hrefOf(r.url))}" ${String(r.url).startsWith('mailto:') ? '' : 'target="_blank" rel="noopener"'}>${esc(r.v)}</a>` : esc(r.v)}</span>`).join('')}</div>`;
  },
};

// ---------------------------------------------------------------- page
function heroEra() {
  const key = String(S.hero_era || '').toLowerCase();
  return eraOf(key) || JOURNEY.find((j) => j.shape === key) || JOURNEY[0];
}

function renderBar() {
  return el(`<header class="term-bar" id="term-bar">
    <span class="lights"><i></i><i></i><i></i></span>
    <span class="title">${esc(PS)}: ~/portfolio</span>
    <button class="term-menu" id="term-menu" aria-label="Menu">menu</button>
    <nav class="term-tabs" id="term-tabs">${SECTIONS.map((s) => `<a href="#${esc(slug(s.id))}" data-for="${esc(slug(s.id))}">${esc(fileName(s))}</a>`).join('')}<a href="cv.html">cv</a>${yes(S.theme_toggle ?? 'yes') ? '<button id="theme-toggle" title="Switch to the paper theme">paper theme</button>' : ''}</nav>
  </header>`);
}

function renderHero() {
  const era = heroEra();
  const roles = splitList(S.roles);
  const socials = LINKS.filter((l) => ['all', 'hero'].includes(l.show_in));
  return el(`<section class="term-hero" id="top">
    ${prompt('whoami', false)}
    <pre class="banner" id="banner" aria-label="${esc(S.name || '')}"></pre>
    <div class="hero-lines">
      <p class="line dim">${esc([S.tagline, S.location].filter(Boolean).join(' · '))}${S.availability ? ` · <span class="acc">${esc(S.availability.toLowerCase())}</span>` : ''}</p>
      ${roles.length ? `<p class="line">&gt; ${esc(S.roles_prefix || 'I build')} <span class="role" id="role-word">${esc(roles[0])}</span><span class="caret" aria-hidden="true"></span></p>` : ''}
      ${S.headline ? `<p class="line headline">${esc(S.headline)}</p>` : ''}
      <p class="line links-line">${socials.map((l) => `<a href="${esc(hrefOf(l.url))}" target="_blank" rel="noopener">${esc(l.label.toLowerCase())}</a>`).join('')}${S.resume_url ? `<a href="${esc(hrefOf(S.resume_url))}" target="_blank" rel="noopener">resume.pdf</a>` : ''}<a href="cv.html">cv</a></p>
      ${era ? `<p class="line comment note"># <span class="year">${esc(era.year)}</span> ${esc(era.title)} — ${esc(era.insight)}</p>` : ''}
      ${S.hero_note ? `<p class="line dim">${esc(S.hero_note)}</p>` : ''}
      <p class="line scroll-hint">▼ scroll, or type <span class="acc">help</span> in the prompt below</p>
    </div>
  </section>`);
}

function renderSection(sec) {
  const items = C.data[sec.id] || [];
  const era = eraOf(sec.era);
  const render = RENDERERS[sec.layout] || RENDERERS.cards;
  const cmd = (COMMANDS[sec.layout] || COMMANDS.cards)(sec);
  const body = items.length || sec.layout === 'text' ? render(sec, items) : `<p class="line err">${esc(fileName(sec))}: no entries yet — add rows to the "${esc(sec.id)}" sheet</p>`;
  const node = el(`<section class="term-block" id="${esc(slug(sec.id))}" data-era="${esc(sec.era || '')}">
    ${prompt(cmd)}
    <div class="out">
      <p class="line acc2">## ${esc(sec.title)}${sec.eyebrow ? ` <span class="dim">— ${esc(sec.eyebrow.toLowerCase())}</span>` : ''}</p>
      ${era ? `<p class="line comment"># <span class="year">${esc(era.year)}</span> ${esc(era.title)} — ${esc(era.insight)}</p>` : ''}
      ${sec.intro ? `<p class="line dim">${esc(sec.intro)}</p>` : ''}
      ${body}
      ${sec.cta_label ? `<p class="line links-line"><a href="${esc(hrefOf(sec.cta_link))}" target="_blank" rel="noopener">${esc(sec.cta_label.toLowerCase())}</a></p>` : ''}
    </div>
  </section>`);
  $$('.out > *', node).forEach((n, i) => n.style.setProperty('--i', Math.min(i, 14)));
  return node;
}

function renderCli() {
  return el(`<footer class="cli"><div class="cli-inner">
    <div class="cli-out" id="cli-out"></div>
    <div class="cli-row"><span class="ps">${esc(PS)}</span><input id="cli" type="text" autocomplete="off" spellcheck="false" placeholder="help" aria-label="Command prompt"></div>
  </div></footer>`);
}

// ---------------------------------------------------------------- behaviours
async function typeCommand(node) {
  const cmd = node.dataset.cmd || '';
  if (reduced) { node.textContent = cmd; return; }
  node.innerHTML = '<span class="caret"></span>';
  for (let i = 1; i <= cmd.length; i++) {
    node.innerHTML = `${esc(cmd.slice(0, i))}<span class="caret"></span>`;
    await wait(22 + Math.random() * 30);
  }
  await wait(180);
  node.textContent = cmd;
}

function initBlocks() {
  const io = new IntersectionObserver((entries) => entries.forEach(async (e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const cmd = $('.cmd[data-cmd]', e.target);
    if (cmd) await typeCommand(cmd);
    e.target.classList.add('in');
  }), { rootMargin: '0px 0px -12% 0px', threshold: 0.02 });
  $$('.term-block').forEach((b) => io.observe(b));
}

function initJourney() {
  const tabs = $$('#term-tabs a[data-for]');
  const hero = heroEra();
  let activeEra = null;
  const activate = (eraId, sectionId) => {
    if (eraId && eraId !== activeEra) {
      activeEra = eraId;
      currentShape = eraOf(eraId)?.shape || 'constellation';
      scene?.setShape(currentShape);
    }
    tabs.forEach((a) => a.classList.toggle('active', a.dataset.for === sectionId));
  };
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const isHero = e.target.id === 'top';
    currentMode = isHero ? 'hero' : 'aside';
    scene?.setMode(currentMode);
    document.body.classList.toggle('ascii-dim', !isHero);
    activate(isHero ? hero?.id : (e.target.dataset.era || activeEra), isHero ? null : e.target.id);
  }), { rootMargin: '-40% 0px -45% 0px', threshold: 0 });
  io.observe($('#top'));
  $$('.term-block').forEach((s) => io.observe(s));
  activate(hero?.id, null);
}

async function initBanner() {
  const pre = $('#banner');
  const name = S.name || 'portfolio';
  const cell = measureCell(pre);
  let cols = Math.floor(pre.clientWidth / cell.w);
  let text = name;
  if (cols < 70 && S.first_name) text = S.first_name;
  cols = Math.max(24, Math.min(cols, Math.round(text.length * 9.5)));
  let rows;
  try { rows = asciiText(text, cols, { font: `900 120px ${S.font_display ? `"${S.font_display}",` : ''} "Segoe UI", Arial, sans-serif` }); } catch { rows = []; }
  if (!rows.length || rows.length > 40) { pre.replaceWith(el(`<p class="banner-fallback">${esc(name)}</p>`)); return; }
  await resolveInto(pre, rows, { duration: 1500 });
}

function initRoles() {
  const node = $('#role-word');
  const words = splitList(S.roles);
  if (!node || words.length < 2) return;
  let wi = 0;
  if (reduced) { setInterval(() => { wi = (wi + 1) % words.length; node.textContent = words[wi]; }, 3000); return; }
  const type = async () => {
    const w = words[wi];
    for (let i = 1; i <= w.length; i++) { node.textContent = w.slice(0, i); await wait(35 + Math.random() * 40); }
    await wait(2300);
    for (let i = w.length; i >= 0; i--) { node.textContent = w.slice(0, i); await wait(18); }
    wi = (wi + 1) % words.length;
    type();
  };
  setTimeout(type, 2200);
}

function toggleDetail(nameEl, open) {
  const detail = $(`#detail-${slug(nameEl.dataset.section)}-${nameEl.dataset.index}`);
  if (!detail) return;
  const show = open ?? detail.hidden;
  detail.hidden = !show;
  if (show) { $$('.out > *', detail).forEach((n, i) => n.style.setProperty('--i', i)); scene?.burst(10); }
}

function initCards() {
  $$('.ls .name').forEach((n) => {
    n.addEventListener('click', () => toggleDetail(n));
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDetail(n); } });
  });
}

function initCli() {
  const input = $('#cli'), out = $('#cli-out');
  const say = (text, cls = '') => {
    const lines = Array.isArray(text) ? text : [text];
    lines.forEach((t) => out.appendChild(el(`<p class="line ${cls}">${t}</p>`)));
    while (out.children.length > 9) out.removeChild(out.firstChild);
  };
  const projects = SECTIONS.filter((s) => s.layout === 'cards').flatMap((s) => (C.data[s.id] || []).map((it, i) => ({ sec: s, it, i })));
  const findSection = (q) => SECTIONS.find((s) => [s.id, s.title, fileName(s)].some((v) => String(v).toLowerCase().replace(/[^a-z0-9]/g, '') === q)) || SECTIONS.find((s) => fileName(s).startsWith(q) || String(s.id).toLowerCase().startsWith(q));
  const goto = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  const run = (raw) => {
    const line = raw.trim();
    if (!line) return;
    say(`<span class="acc">${esc(PS)}</span> $ ${esc(line)}`);
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
    switch (cmd.toLowerCase()) {
      case 'help': case '?':
        say(['commands: <span class="acc">ls</span> · <span class="acc">cat &lt;section&gt;</span> · <span class="acc">open &lt;project|n&gt;</span> · <span class="acc">theme paper</span> · <span class="acc">cv</span> · <span class="acc">email</span> · <span class="acc">top</span> · <span class="acc">clear</span>']); break;
      case 'ls': case 'dir':
        say(SECTIONS.map((s) => `<span class="acc">${esc(fileName(s))}/</span>`).join('  ')); break;
      case 'cat': case 'cd': case 'go': case 'goto': case 'show': {
        const s = findSection(arg);
        if (s) { goto(slug(s.id)); say(`→ ${esc(s.title)}`); } else say(`cat: ${esc(rest.join(' '))}: no such file or directory`, 'err');
        break;
      }
      case 'open': case 'run': {
        const n = parseInt(arg, 10);
        const p = Number.isFinite(n) ? projects[n - 1] : projects.find(({ it }) => String(it.title).toLowerCase().replace(/[^a-z0-9]/g, '').includes(arg));
        if (p) { goto(slug(p.sec.id)); const nameEl = $(`.ls .name[data-section="${CSS.escape(p.sec.id)}"][data-index="${p.i}"]`); if (nameEl) toggleDetail(nameEl, true); say(`opening ${esc(p.it.title)} …`); }
        else say(`open: nothing matches "${esc(rest.join(' '))}" — projects: ${projects.map(({ it }, i) => `${i + 1}) ${esc(it.title)}`).join(', ')}`, 'err');
        break;
      }
      case 'theme': if (arg === 'paper' || arg === 'light') switchTheme('paper'); else say('usage: theme paper', 'dim'); break;
      case 'cv': case 'resume': location.href = 'cv.html'; break;
      case 'email': case 'mail': case 'contact': if (S.email) location.href = `mailto:${S.email}`; else goto('Contact'); break;
      case 'top': case 'home': goto('top'); break;
      case 'clear': case 'cls': out.innerHTML = ''; break;
      case 'whoami': say(esc(S.name || '')); break;
      case 'date': say(esc(new Date().toString())); break;
      case 'pwd': say('/home/' + esc(String(PS).split('@')[0]) + '/portfolio'); break;
      case 'sudo': say('nice try.', 'dim'); break;
      case 'exit': case 'quit': say('there is no escape. try <span class="acc">theme paper</span>.', 'dim'); break;
      default: {
        const s = findSection(cmd.toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (s) { goto(slug(s.id)); say(`→ ${esc(s.title)}`); } else say(`bash: ${esc(cmd)}: command not found (try <span class="acc">help</span>)`, 'err');
      }
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { run(input.value); input.value = ''; } });
  addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement !== input && !e.ctrlKey && !e.metaKey) { e.preventDefault(); input.focus(); } });
}

async function initScene() {
  try {
    const { createScene } = await import('./scene.js');
    const canvas = $('#scene');
    scene = createScene(canvas, {
      palette: { paper: '#000000', ink: '#ffffff', accent: '#ff8c3a' },
      density: S.scene_density || 'medium', asideOpacity: 0.7, renderScale: 0.35, preserveDrawingBuffer: true,
    });
    window.__scene = scene;
    const screen = AsciiScreen($('#ascii-bg'), canvas, { fps: 24 });
    screen.start();
    const hero = heroEra();
    setTimeout(() => { scene.setMode(currentMode); scene.setShape(currentShape || hero?.shape || 'perceptron'); }, 400);
  } catch (err) {
    console.warn('ASCII scene unavailable:', err);
  }
}

function applyTerminalTheme() {
  const r = document.body.style;
  const set = (k, v) => v && r.setProperty(k, String(v));
  set('--t-bg', S.terminal_bg); set('--t-fg', S.terminal_fg); set('--t-dim', S.terminal_dim); set('--t-accent', S.terminal_accent); set('--t-accent-2', S.terminal_accent_2);
  const font = S.terminal_font || 'JetBrains Mono';
  set('--t-font', `"${font}", "IBM Plex Mono", ui-monospace, Consolas, monospace`);
  if (!document.getElementById('gfonts-mono')) {
    const link = document.createElement('link');
    link.id = 'gfonts-mono'; link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }
}

function loadCss(href) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    link.onload = resolve; link.onerror = resolve;
    document.head.appendChild(link);
    setTimeout(resolve, 1500);
  });
}

// ---------------------------------------------------------------- boot
export async function bootTerminal(content) {
  C = content; S = C.settings || {};
  JOURNEY = C.journey || [];
  ERA_BY_ID = Object.fromEntries(JOURNEY.map((j) => [j.id, j]));
  LINKS = C.links || [];
  SECTIONS = (C.sections || []).filter((s) => s.visible !== false);
  PS = S.terminal_user || `${(S.first_name || 'me').toLowerCase().replace(/\s+/g, '')}@portfolio`;

  document.body.className = 'theme-terminal';
  await loadCss('assets/css/terminal.css');
  applyTerminalTheme();
  document.title = S.site_title || S.name || 'Portfolio';
  const rail = $('#rail'); if (rail) rail.hidden = true;
  const footer = $('#footer'); if (footer) footer.hidden = true;
  $('#nav')?.remove();

  const main = $('#main');
  main.innerHTML = '';
  main.className = 'term-body';
  document.body.insertBefore(renderBar(), main);
  document.body.insertBefore(el('<pre class="ascii-bg" id="ascii-bg" aria-hidden="true"></pre>'), main);
  main.appendChild(renderHero());
  SECTIONS.forEach((s) => main.appendChild(renderSection(s)));
  main.appendChild(el(`<p class="line dim" style="margin-top:2rem">${esc(S.footer_note || '')} — generated from ${esc(C.source || 'content.xlsx')} · ${esc((C.generated_at || '').slice(0, 10))}</p>`));
  document.body.appendChild(renderCli());
  if (yes(S.terminal_scanlines ?? 'yes')) { document.body.appendChild(el('<div class="scanlines" aria-hidden="true"></div>')); document.body.appendChild(el('<div class="vignette" aria-hidden="true"></div>')); }

  $('#theme-toggle')?.addEventListener('click', () => switchTheme('paper'));
  $('#term-menu')?.addEventListener('click', () => $('#term-bar').classList.toggle('open'));
  $('#term-tabs')?.addEventListener('click', (e) => { if (e.target.tagName === 'A') $('#term-bar').classList.remove('open'); });

  initScene();
  initBanner();
  initRoles();
  initBlocks();
  initCards();
  initJourney();
  initCli();
  initLiveReload();
}
