/*
 * terminal.js — the CLI theme. Same content.json, rendered as a terminal transcript on a
 * character grid: boot sequence, typed commands, ASCII banner / portrait, a rotating ASCII
 * wireframe, an animated character field behind the page, text-scramble hovers, single-key
 * shortcuts ([h] home [p] projects [c] contact [i] invert [/] prompt) and a working prompt.
 * The ML-history story lives on its own page: history.html.
 */
import { esc, slug, splitList, splitLinks, yes, dateRange, fmtDate, md, plain, extraFields, img, hrefOf, initLiveReload, switchTheme } from './content.js';
import { asciiText, resolveInto, measureCell } from './ascii.js';
import { asciiImage, scramble, AsciiWire, WIRE_SHAPES, CharField } from './ascii-fx.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let C, S, SECTIONS, LINKS, PS, field = null, wire = null;
const fileName = (sec) => String(sec.id).toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ---------------------------------------------------------------- pieces
const tagsLine = (it) => {
  const list = [...splitList(it.tags), ...splitList(it.tools), ...splitList(it.stack)];
  return list.length ? `<p class="line tagsline">tags: ${list.map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : '';
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
const rule = () => `<p class="line rule">${'─'.repeat(120)}</p>`;

const COMMANDS = {
  text: (s) => `cat ${fileName(s)}.md`, stats: (s) => `./${fileName(s)} --summary`, timeline: (s) => `cat ${fileName(s)}.log`,
  cards: (s) => `ls -la ${fileName(s)}/`, tags: (s) => `tree ${fileName(s)}/`, list: (s) => `cat ${fileName(s)}.txt`,
  gallery: (s) => `ls ${fileName(s)}/*.png`, table: (s) => `column -t ${fileName(s)}.tsv`, contact: () => 'cat contact.txt',
};

const RENDERERS = {
  text(sec, items) {
    if (!items.length) return md(sec.intro);
    return items.map((it) => `${it.title ? `<p class="line h">${esc(it.title)}</p>` : ''}${md(it.description || it.summary)}${linksLine(it)}${metaLine(it)}`).join('');
  },
  stats(sec, items) {
    return items.map((it) => `<div class="stat-line"><b>${esc(it.value ?? it.title ?? '')}</b><span>${esc(it.label ?? it.subtitle ?? it.description ?? '')}</span></div>`).join('');
  },
  timeline(sec, items) {
    return items.map((it) => `<div class="entry">
      <p class="line head"><span class="when">${esc(dateRange(it) || '—')} ⮐</span>  ${esc(it.title || it.role || '')}${it.org || it.company ? ` <span class="org">@ ${esc(it.org || it.company)}</span>` : ''}${it.location ? ` <span class="loc">· ${esc(it.location)}</span>` : ''}</p>
      <div class="body">${it.subtitle ? `<p class="dim">${esc(it.subtitle)}</p>` : ''}${md(it.description || it.summary)}${tagsLine(it)}${linksLine(it)}${metaLine(it)}</div>
    </div>`).join('');
  },
  cards(sec, items) {
    const rows = items.map((it, i) => {
      const name = String(it.title || `item-${i + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const imgs = imagesOf(it);
      return `<span class="when">${esc(fmtDate(it.date || it.year) || String(dateRange(it) || '').split(' ')[0] || '')}</span><span class="name" data-section="${esc(sec.id)}" data-index="${i}" data-text="${esc(name)}/" role="button" tabindex="0">${esc(name)}/</span><span class="desc">${esc(it.subtitle || plain(it.description, 90))}</span><span class="st">${it.status ? `${esc(String(it.status).toLowerCase())}` : ''}</span>
      <div class="detail" hidden id="detail-${esc(slug(sec.id))}-${i}">${prompt(`cat ${name}/README.md`, false)}<p class="line h">${esc(it.title)}</p>${it.subtitle ? `<p class="line dim">${esc(it.subtitle)}</p>` : ''}${imgs.length ? `<div class="gal">${imgs.map((s) => `<figure><img src="${esc(s)}" alt=""></figure>`).join('')}</div>` : ''}${md(it.description || it.summary)}${tagsLine(it)}${linksLine(it)}${metaLine(it)}</div>`;
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
    return `<div class="listing">${[...groups.entries()].map(([g, list]) => `${g ? `<p class="line h">${esc(g)}</p>` : ''}${list.map((it) => `<div class="row"><span class="when">${esc(fmtDate(it.date || it.year || it.start) || '—')}</span><span>${it.link ? `<a class="t" href="${esc(hrefOf(it.link))}" target="_blank" rel="noopener">${esc(it.title)}</a>` : `<span class="t">${esc(it.title)}</span>`}${it.subtitle || it.org ? `<br><span class="s">${esc(it.subtitle || it.org)}</span>` : ''}${it.description ? `<div class="s">${md(it.description)}</div>` : ''}${metaLine(it)}</span></div>`).join('')}`).join('')}</div>`;
  },
  gallery(sec, items) {
    return `<div class="gal">${items.flatMap((it) => imagesOf(it).map((src) => `<figure><img src="${esc(src)}" alt="${esc(it.caption || it.title || '')}" loading="lazy">${it.caption || it.title ? `<figcaption>${esc(it.caption || it.title)}</figcaption>` : ''}</figure>`)).join('')}</div>`;
  },
  table(sec, items) {
    const cols = [...new Set(items.flatMap((it) => Object.keys(it)))].filter((k) => !['order', 'hidden'].includes(k));
    return `<table><thead><tr>${cols.map((c) => `<td>${esc(c)}</td>`).join('')}</tr></thead><tbody>${items.map((it) => `<tr>${cols.map((c) => `<td>${esc(it[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  },
  contact(sec, items) {
    const extra = LINKS.filter((l) => ['all', 'contact'].includes(l.show_in) && !items.some((it) => hrefOf(it.link) === l.url));
    const rows = [...items.map((it) => ({ k: it.title || it.label, v: it.subtitle || it.link, url: it.link || it.url })), ...extra.map((l) => ({ k: l.label, v: l.url.replace(/^(https?:\/\/|mailto:)/, ''), url: l.url }))];
    if (S.location) rows.push({ k: 'location', v: S.location });
    return `<div class="kv">${rows.map((r) => `<span class="k">${esc(String(r.k).toLowerCase())}</span><span>${r.url ? `<a href="${esc(hrefOf(r.url))}" ${String(r.url).startsWith('mailto:') ? '' : 'target="_blank" rel="noopener"'}>${esc(r.v)}</a>` : esc(r.v)}</span>`).join('')}</div>`;
  },
};

// ---------------------------------------------------------------- page
const showHistory = () => yes(S.terminal_history ?? 'yes') && (C.journey || []).length > 0;

function renderBar() {
  return el(`<header class="term-bar" id="term-bar">
    <span class="title"><b>${esc(PS)}</b>:~/portfolio</span>
    <button class="term-menu" id="term-menu" aria-label="Menu">menu</button>
    <nav class="term-tabs" id="term-tabs">${SECTIONS.map((s) => `<a href="#${esc(slug(s.id))}" data-for="${esc(slug(s.id))}" data-text="${esc(fileName(s))}">${esc(fileName(s))}</a>`).join('')}${showHistory() ? '<a href="history.html" data-text="history">history</a>' : ''}<a href="cv.html" data-text="cv">cv</a>${yes(S.theme_toggle ?? 'yes') ? '<button id="theme-toggle" data-text="paper" title="Switch to the paper theme">paper</button>' : ''}</nav>
  </header>`);
}

function renderHero() {
  const roles = splitList(S.roles);
  const socials = LINKS.filter((l) => ['all', 'hero'].includes(l.show_in));
  return el(`<section class="term-hero" id="top">
    <div class="copy">
      ${prompt('whoami', false)}
      <pre class="banner" id="banner" aria-label="${esc(S.name || '')}"></pre>
      <div class="hero-lines">
        <p class="line dim">${esc([S.tagline, S.location].filter(Boolean).join(' · '))}</p>
        ${S.availability ? `<p class="line"><span class="acc">*</span> ${esc(S.availability.toLowerCase())}</p>` : ''}
        ${roles.length ? `<p class="line">&gt; ${esc(S.roles_prefix || 'I build')} <span class="role" id="role-word">${esc(roles[0])}</span><span class="caret" aria-hidden="true"></span></p>` : ''}
        ${S.headline ? `<p class="line headline">${esc(S.headline)}</p>` : ''}
        <p class="line links-line">${socials.map((l) => `<a href="${esc(hrefOf(l.url))}" target="_blank" rel="noopener" data-text="${esc(l.label.toLowerCase())}">${esc(l.label.toLowerCase())}</a>`).join('')}${S.resume_url ? `<a href="${esc(hrefOf(S.resume_url))}" target="_blank" rel="noopener" data-text="resume.pdf">resume.pdf</a>` : ''}<a href="cv.html" data-text="cv">cv</a></p>
        ${S.hero_note_terminal ? `<p class="line dim">${esc(S.hero_note_terminal)}</p>` : ''}
        <p class="line dim">▼ scroll · <span class="acc">?</span> for shortcuts · <span class="acc">/</span> to type a command</p>
      </div>
    </div>
  </section>`);
}

function renderSection(sec, index) {
  const items = C.data[sec.id] || [];
  const render = RENDERERS[sec.layout] || RENDERERS.cards;
  const cmd = (COMMANDS[sec.layout] || COMMANDS.cards)(sec);
  const body = items.length || sec.layout === 'text' ? render(sec, items) : `<p class="line err">${esc(fileName(sec))}: no entries yet — add rows to the "${esc(sec.id)}" sheet</p>`;
  const node = el(`<section class="term-block" id="${esc(slug(sec.id))}" data-index="${index}">
    <p class="line rule">${'─'.repeat(3)} <b>${String(index + 1).padStart(2, '0')}</b> ${'─'.repeat(160)}</p>
    ${prompt(cmd)}
    <div class="out">
      <p class="line tag">${esc(sec.title.toLowerCase())}${sec.eyebrow ? ` <span class="dim">— ${esc(sec.eyebrow.toLowerCase())}</span>` : ''}</p>
      ${sec.intro ? `<p class="line dim">${esc(sec.intro)}</p>` : ''}
      ${body}
      ${sec.cta_label ? `<p class="line links-line"><a href="${esc(hrefOf(sec.cta_link))}" target="_blank" rel="noopener">${esc(sec.cta_label.toLowerCase())}</a></p>` : ''}
    </div>
  </section>`);
  $$('.out > *', node).forEach((n, i) => n.style.setProperty('--i', Math.min(i, 14)));
  return node;
}

function renderCli() {
  const keys = [['h', 'home'], ['p', 'projects'], ['c', 'contact'], ['i', 'invert'], ['/', 'prompt'], ['?', 'help']];
  return el(`<footer class="cli"><div class="cli-inner">
    <div class="cli-out" id="cli-out"></div>
    <div class="cli-row"><span class="ps">${esc(PS)}</span><input id="cli" type="text" autocomplete="off" spellcheck="false" placeholder="help" aria-label="Command prompt"></div>
    <div class="status">${keys.map(([k, l], i) => `<span class="${i > 2 ? 'hide-sm' : ''}"><span class="k">${k}</span> ${l}</span>`).join('')}<span class="clock hide-sm" id="clock"></span></div>
  </div></footer>`);
}

// ---------------------------------------------------------------- behaviours
async function boot() {
  if (!yes(S.terminal_boot ?? 'yes') || reduced) return;
  let seen = false;
  try { seen = sessionStorage.getItem('booted') === '1'; } catch { /* ignore */ }
  if (seen) return;
  const items = Object.values(C.data || {}).reduce((n, v) => n + v.length, 0);
  const lines = [
    `<span class="dim">${esc(PS)}</span> $ ./portfolio --serve`,
    `[ <span class="ok">ok</span> ] reading ${esc(C.source || 'content.xlsx')} ........ ${items} items`,
    `[ <span class="ok">ok</span> ] mounting sections ........... ${SECTIONS.length}`,
    `[ <span class="ok">ok</span> ] font grid ................... ${getComputedStyle(document.body).getPropertyValue('--lh').trim() || '20px'}`,
    `[ <span class="ok">ok</span> ] warming up the wireframe`,
  ];
  const box = el('<pre class="boot" id="boot"></pre>');
  document.body.appendChild(box);
  let skipped = false;
  const skip = () => { skipped = true; };
  addEventListener('keydown', skip, { once: true });
  addEventListener('pointerdown', skip, { once: true });
  for (const l of lines) { box.innerHTML += l + '\n'; if (skipped) break; await wait(90 + Math.random() * 120); }
  if (!skipped) {
    const bar = el('<span class="bar"></span>');
    box.appendChild(bar);
    for (let i = 0; i <= 20 && !skipped; i++) { bar.textContent = `[${'█'.repeat(i)}${'░'.repeat(20 - i)}] ${i * 5}%`; await wait(28); }
    await wait(180);
  }
  try { sessionStorage.setItem('booted', '1'); } catch { /* ignore */ }
  box.classList.add('done');
  setTimeout(() => box.remove(), 450);
}

async function typeCommand(node) {
  const cmd = node.dataset.cmd || '';
  if (reduced) { node.textContent = cmd; return; }
  node.innerHTML = '<span class="caret"></span>';
  for (let i = 1; i <= cmd.length; i++) { node.innerHTML = `${esc(cmd.slice(0, i))}<span class="caret"></span>`; await wait(20 + Math.random() * 28); }
  await wait(160);
  node.textContent = cmd;
}

async function printBlock(block) {
  const cmd = $('.cmd[data-cmd]', block);
  if (cmd) await typeCommand(cmd);
  block.classList.add('in');
  const lines = $$('.out > *', block);
  if (reduced) lines.forEach((l) => l.classList.add('shown'));
  else {
    const caret = el('<span class="pcaret" aria-hidden="true"></span>');
    const step = Math.max(18, Math.min(70, 900 / Math.max(1, lines.length)));
    for (const l of lines) { l.classList.add('shown'); l.appendChild(caret); await wait(step); }
    caret.remove();
  }
  animateBars(block);
  animateCounts(block);
  const r = block.getBoundingClientRect();
  field?.pulse(r.left + 40, Math.max(60, r.top + 20));
}

function animateBars(block) {
  $$('.tree .bar', block).forEach((bar, i) => {
    const n = bar.textContent.length, off = bar.nextElementSibling;
    const total = n + (off?.textContent.length || 0);
    if (reduced || !n) return;
    let k = 0;
    const tick = () => { k++; bar.textContent = '█'.repeat(k); if (off) off.textContent = '░'.repeat(total - k); if (k < n) setTimeout(tick, 45); };
    bar.textContent = ''; if (off) off.textContent = '░'.repeat(total);
    setTimeout(tick, 120 + i * 60);
  });
}

function animateCounts(block) {
  $$('.stat-line b', block).forEach((b) => {
    const raw = b.textContent, m = raw.match(/^([^\d]*)(\d[\d,]*)(\.\d+)?(.*)$/);
    if (!m || reduced) return;
    const pre = m[1], target = parseInt(m[2].replace(/,/g, ''), 10), dec = m[3] || '', post = m[4], t0 = performance.now();
    b.classList.add('counting');
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - p, 3);
      b.textContent = `${pre}${Math.round(target * e).toLocaleString()}${p === 1 ? dec : ''}${post}`;
      if (p < 1) requestAnimationFrame(tick); else { b.textContent = raw; b.classList.remove('counting'); }
    };
    requestAnimationFrame(tick);
  });
}

function initBlocks() {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    printBlock(e.target);
  }), { rootMargin: '0px 0px -12% 0px', threshold: 0.02 });
  $$('.term-block').forEach((b) => io.observe(b));
}

function initActiveTabs() {
  const tabs = $$('#term-tabs a[data-for]');
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const isHero = e.target.id === 'top';
    tabs.forEach((a) => a.classList.toggle('active', a.dataset.for === e.target.id));
    field?.setIntensity(isHero ? 1 : 0.7);
    const idx = isHero ? 0 : Number(e.target.dataset.index) + 1;
    wire?.setShape(WIRE_SHAPES[idx % WIRE_SHAPES.length]);
    const cap = $('#side-cap');
    if (cap) cap.textContent = isHero ? `${PS} $ whoami` : `${PS} $ ${$('.cmd', e.target)?.dataset.cmd || $('.cmd', e.target)?.textContent || ''}`;
  }), { rootMargin: '-40% 0px -45% 0px', threshold: 0 });
  io.observe($('#top'));
  $$('.term-block').forEach((s) => io.observe(s));
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
  try { rows = asciiText(text, cols, { font: '900 120px "Segoe UI", Arial, Helvetica, sans-serif' }); } catch { rows = []; }
  if (!rows.length || rows.length > 40) { pre.replaceWith(el(`<p class="banner-fallback">${esc(name)}</p>`)); return; }
  await resolveInto(pre, rows, { duration: 1400 });
}

async function initSide() {
  const pre = $('#hero-side');
  if (!pre) return;
  if (S.avatar) {
    try {
      const rows = await asciiImage(img(S.avatar), 64, { ramp: ' .:-=+*#%@' });
      pre.classList.add('portrait');
      await resolveInto(pre, rows, { duration: 1600 });
      return;
    } catch { /* fall through to the wireframe */ }
  }
  wire = AsciiWire(pre, { cols: 46, rows: 23, shape: 'ico' });
  wire.start();
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
  nameEl.classList.toggle('open', show);
  if (show) { const r = nameEl.getBoundingClientRect(); field?.pulse(r.left, r.top); wire?.kick(); }
}

function initCards() {
  $$('.ls .name').forEach((n) => {
    n.addEventListener('click', () => toggleDetail(n));
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDetail(n); } });
  });
}

function initScramble() {
  if (reduced) return;
  $$('[data-text]').forEach((n) => n.addEventListener('pointerenter', () => scramble(n)));
}

function initClock() {
  const c = $('#clock');
  if (!c) return;
  const t0 = Date.now();
  const tick = () => {
    const up = Math.floor((Date.now() - t0) / 1000);
    c.textContent = `${new Date().toLocaleTimeString([], { hour12: false })} · up ${Math.floor(up / 60)}m${String(up % 60).padStart(2, '0')}s`;
  };
  tick(); setInterval(tick, 1000);
}

function invert() {
  document.body.classList.toggle('inverted');
  const cs = getComputedStyle(document.body);
  field?.setColors(cs.getPropertyValue('--t-fg').trim(), cs.getPropertyValue('--t-accent').trim());
}

function initCli() {
  const input = $('#cli'), out = $('#cli-out');
  const say = (text, cls = '') => {
    (Array.isArray(text) ? text : [text]).forEach((t) => out.appendChild(el(`<p class="line ${cls}">${t}</p>`)));
    while (out.children.length > 7) out.removeChild(out.firstChild);
  };
  const projects = SECTIONS.filter((s) => s.layout === 'cards').flatMap((s) => (C.data[s.id] || []).map((it, i) => ({ sec: s, it, i })));
  const norm = (v) => String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
  const findSection = (q) => SECTIONS.find((s) => [s.id, s.title, fileName(s)].some((v) => norm(v) === q)) || SECTIONS.find((s) => fileName(s).startsWith(q) || norm(s.id).startsWith(q));
  const goto = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  const gotoLayout = (layout) => { const s = SECTIONS.find((x) => x.layout === layout); if (s) goto(slug(s.id)); };
  const help = () => say('<span class="acc">ls</span> · <span class="acc">cat &lt;section&gt;</span> · <span class="acc">open &lt;project|n&gt;</span> · <span class="acc">history</span> · <span class="acc">invert</span> · <span class="acc">theme paper</span> · <span class="acc">cv</span> · <span class="acc">email</span> · <span class="acc">top</span> · <span class="acc">clear</span>');
  const run = (raw) => {
    const line = raw.trim();
    if (!line) return;
    say(`<span class="dim">${esc(PS)} $</span> ${esc(line)}`);
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = norm(rest.join(' '));
    switch (cmd.toLowerCase()) {
      case 'help': case '?': help(); break;
      case 'ls': case 'dir': say(SECTIONS.map((s) => `<span class="acc">${esc(fileName(s))}/</span>`).join('  ') + (showHistory() ? '  <span class="acc">history/</span>' : '')); break;
      case 'cat': case 'cd': case 'go': case 'goto': case 'show': {
        if (arg === 'history') { location.href = 'history.html'; break; }
        const s = findSection(arg);
        if (s) { goto(slug(s.id)); say(`→ ${esc(s.title)}`); } else say(`cat: ${esc(rest.join(' '))}: no such file or directory`, 'err');
        break;
      }
      case 'open': case 'run': {
        const n = parseInt(arg, 10);
        const p = Number.isFinite(n) ? projects[n - 1] : projects.find(({ it }) => norm(it.title).includes(arg));
        if (p) { goto(slug(p.sec.id)); const nameEl = $(`.ls .name[data-section="${CSS.escape(p.sec.id)}"][data-index="${p.i}"]`); if (nameEl) toggleDetail(nameEl, true); say(`opening ${esc(p.it.title)} …`); }
        else say(`open: nothing matches "${esc(rest.join(' '))}" — projects: ${projects.map(({ it }, i) => `${i + 1}) ${esc(it.title)}`).join(', ')}`, 'err');
        break;
      }
      case 'history': location.href = 'history.html'; break;
      case 'invert': case 'i': invert(); break;
      case 'theme': if (arg === 'paper' || arg === 'light') switchTheme('paper'); else say('usage: theme paper', 'dim'); break;
      case 'cv': case 'resume': location.href = 'cv.html'; break;
      case 'email': case 'mail': case 'contact': if (S.email) location.href = `mailto:${S.email}`; else gotoLayout('contact'); break;
      case 'top': case 'home': goto('top'); break;
      case 'clear': case 'cls': out.innerHTML = ''; break;
      case 'whoami': say(esc(S.name || '')); break;
      case 'date': say(esc(new Date().toString())); break;
      case 'pwd': say('/home/' + esc(String(PS).split('@')[0]) + '/portfolio'); break;
      case 'sudo': say('nice try.', 'dim'); break;
      case 'exit': case 'quit': say('there is no escape. try <span class="acc">theme paper</span>.', 'dim'); break;
      default: {
        const s = findSection(norm(cmd));
        if (s) { goto(slug(s.id)); say(`→ ${esc(s.title)}`); } else say(`bash: ${esc(cmd)}: command not found (try <span class="acc">help</span>)`, 'err');
      }
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { run(input.value); input.value = ''; } if (e.key === 'Escape') input.blur(); });
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = document.activeElement === input || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (typing) return;
    switch (e.key) {
      case '/': e.preventDefault(); input.focus(); break;
      case '?': help(); break;
      case 'h': goto('top'); break;
      case 'p': gotoLayout('cards'); break;
      case 'c': gotoLayout('contact'); break;
      case 'i': invert(); break;
      default: return;
    }
  });
}

function initField() {
  if (reduced) return;
  const canvas = el('<canvas class="field" id="field" aria-hidden="true"></canvas>');
  document.body.insertBefore(canvas, document.body.firstChild);
  const cs = getComputedStyle(document.body);
  field = CharField(canvas, { fg: cs.getPropertyValue('--t-fg').trim() || '#fff', accent: cs.getPropertyValue('--t-accent').trim() || '#f2c86b', family: cs.getPropertyValue('--t-font') || 'monospace', fontSize: 12 });
  field.start();
  addEventListener('click', (e) => { if (!e.target.closest('a, button, input, .name')) field.pulse(e.clientX, e.clientY); });
}

function applyTerminalTheme() {
  const r = document.body.style;
  const set = (k, v) => v && r.setProperty(k, String(v));
  set('--t-bg', S.terminal_bg); set('--t-fg', S.terminal_fg); set('--t-dim', S.terminal_dim); set('--t-accent', S.terminal_accent);
  const font = S.terminal_font || 'JetBrains Mono';
  set('--t-font', `"${font}", "IBM Plex Mono", ui-monospace, Consolas, monospace`);
  if (!document.getElementById('gfonts-mono')) {
    const link = document.createElement('link');
    link.id = 'gfonts-mono'; link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }
}

export function loadCss(href) {
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
  const col = el('<div class="term-col" id="term-col"></div>');
  main.appendChild(col);
  col.appendChild(renderHero());
  SECTIONS.forEach((s, i) => col.appendChild(renderSection(s, i)));
  col.appendChild(el(`<p class="line dim">${esc(S.footer_note || '')} — generated from ${esc(C.source || 'content.xlsx')} · ${esc((C.generated_at || '').slice(0, 10))}</p>`));
  main.appendChild(el(`<aside class="side" aria-hidden="true"><pre class="hero-side" id="hero-side"></pre><p class="line side-cap" id="side-cap">${esc(PS)} $ whoami</p></aside>`));
  document.body.appendChild(renderCli());
  if (yes(S.terminal_scanlines ?? 'yes')) document.body.appendChild(el('<div class="scanlines" aria-hidden="true"></div>'));

  $('#theme-toggle')?.addEventListener('click', () => switchTheme('paper'));
  $('#term-menu')?.addEventListener('click', () => $('#term-bar').classList.toggle('open'));
  $('#term-tabs')?.addEventListener('click', (e) => { if (e.target.tagName === 'A') $('#term-bar').classList.remove('open'); });

  initField();
  const booting = boot();
  initBanner();
  initSide();
  initRoles();
  initBlocks();
  initActiveTabs();
  initCards();
  initScramble();
  initClock();
  initCli();
  initLiveReload();
  await booting;
}
