/*
 * app.js — renders content.json into the page and wires the 3D journey to scrolling.
 * Layout renderers live in RENDERERS; add one there to support a new `layout` value.
 */
import { loadContent, esc, slug, splitList, splitLinks, yes, dateRange, fmtDate, md, plain, themeColor, cycleColor, applyTheme, extraFields, img, hrefOf, initLiveReload, resolveTheme, switchTheme } from './content.js';
import { doodle, isDoodle, guessIcon } from './doodles.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let C, S, SECTIONS, JOURNEY, ERA_BY_ID, LINKS, scene = null, currentShape = null, currentMode = 'hero';

// ---------------------------------------------------------------- small render helpers
const iconOf = (v, cls = '', fallback = '') => doodle(v || fallback, cls) || (v ? `<span class="doodle doodle-emoji ${cls}">${esc(v)}</span>` : '');
const tagsHtml = (it, cls = 'chip') => {
  const list = [...splitList(it.tags), ...splitList(it.tools), ...splitList(it.stack)];
  return list.length ? `<div class="tl-tags tags">${list.map((t) => `<span class="${cls}">${esc(t)}</span>`).join('')}</div>` : '';
};
const linksHtml = (it, small = true) => {
  const out = [];
  const main = it.link || it.url;
  if (main) out.push({ label: it.link_label || 'Open', url: main });
  out.push(...splitLinks(it.links));
  if (!out.length) return '';
  return `<div class="links-row">${out.map((l) => `<a class="btn ${small ? 'btn-sm' : ''}" href="${esc(hrefOf(l.url))}" target="_blank" rel="noopener">${doodle(guessIcon(l.label, l.url))}${esc(l.label)}</a>`).join('')}</div>`;
};
const metaHtml = (it) => {
  const ex = extraFields(it);
  return ex.length ? `<div class="meta-row">${ex.map((f) => `<span class="meta"><b>${esc(f.label)}:</b> ${esc(f.value)}</span>`).join('')}</div>` : '';
};
const imagesOf = (it) => [...splitList(it.image).slice(0, 1), ...String(it.images ?? '').split(';').map((s) => s.trim()).filter(Boolean)].map(img);
const eraOf = (id) => ERA_BY_ID[String(id || '').toLowerCase()];

// ---------------------------------------------------------------- layout renderers
const RENDERERS = {
  text(sec, items) {
    if (!items.length) return `<div class="text-body reveal">${md(sec.intro)}</div>`;
    return items.map((it, i) => {
      const image = imagesOf(it)[0] || (i === 0 && S.avatar ? img(S.avatar) : '');
      return `<div class="text-block ${image ? 'has-image' : ''}">
        <div class="text-body reveal" style="--i:${i}">${it.title ? `<h3>${esc(it.title)}</h3>` : ''}${md(it.description || it.summary)}${linksHtml(it)}${metaHtml(it)}</div>
        ${image ? `<div class="portrait reveal" style="--i:${i + 1}"><img src="${esc(image)}" alt="${esc(it.title || S.name || '')}">${doodle('sparkle')}</div>` : ''}
      </div>`;
    }).join('');
  },

  stats(sec, items) {
    const cols = Number(sec.columns) || Math.min(4, items.length || 4);
    return `<div class="stats" style="--cols:${cols}">${items.map((it, i) => `
      <div class="stat sketch ${i % 2 ? 'sketch-alt' : ''} reveal draw" style="--i:${i}">
        ${iconOf(it.icon)}
        <div class="stat-value" data-count="${esc(it.value ?? it.title ?? '')}">${esc(it.value ?? it.title ?? '')}</div>
        <div class="stat-label">${esc(it.label ?? it.subtitle ?? it.description ?? '')}</div>
      </div>`).join('')}</div>`;
  },

  timeline(sec, items) {
    return `<ol class="timeline">${items.map((it, i) => `
      <li class="tl-item reveal draw" style="--i:${i}">
        <div class="tl-date">${esc(dateRange(it))}</div>
        <div class="tl-dot">${doodle('circle', 'ring')}${iconOf(it.icon, 'icon', 'star')}</div>
        <div class="tl-body sketch ${i % 2 ? 'sketch-alt' : ''}">
          <div class="tl-head">
            <h3 class="tl-title">${esc(it.title || it.role || '')}</h3>
            ${it.org || it.company ? `<span class="tl-org">${esc(it.org || it.company)}</span>` : ''}
            ${it.location ? `<span class="tl-loc">${doodle('pin')} ${esc(it.location)}</span>` : ''}
          </div>
          ${it.subtitle ? `<div class="card-sub">${esc(it.subtitle)}</div>` : ''}
          <div class="tl-desc">${md(it.description || it.summary)}</div>
          ${tagsHtml(it)}${linksHtml(it)}${metaHtml(it)}
        </div>
      </li>`).join('')}</ol>`;
  },

  cards(sec, items) {
    const cols = Number(sec.columns) || 2;
    return `<div class="cards" style="--cols:${cols}">${items.map((it, i) => {
      const image = imagesOf(it)[0];
      const color = themeColor(it.color, cycleColor(i));
      return `<article class="card sketch ${i % 2 ? 'sketch-alt' : ''} ${yes(it.featured) ? 'featured' : ''} reveal draw" style="--i:${i}; --card-color:${color}" data-section="${esc(sec.id)}" data-index="${i}" tabindex="0" role="button" aria-haspopup="dialog">
        <div class="card-top">
          <div class="card-icon">${iconOf(it.icon, '', 'star')}</div>
          <div><h3 class="card-title">${esc(it.title)}</h3>${it.subtitle ? `<p class="card-sub">${esc(it.subtitle)}</p>` : ''}</div>
          ${it.status ? `<span class="card-status">${esc(it.status)}</span>` : ''}
        </div>
        ${image ? `<div class="card-img"><img src="${esc(image)}" alt="" loading="lazy"></div>` : ''}
        <p class="card-desc">${esc(plain(it.description || it.summary, yes(it.featured) ? 260 : 170))}</p>
        ${tagsHtml(it, 'chip chip-soft')}
        <div class="card-foot">${it.date || it.year ? `<span class="list-date">${esc(fmtDate(it.date || it.year))}</span>` : ''}<span class="more">read more ${doodle('arrow')}</span></div>
      </article>`;
    }).join('')}</div>`;
  },

  tags(sec, items) {
    const groups = new Map();
    items.forEach((it) => { const g = it.group || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
    const chip = (it) => {
      const lvl = Number(it.level);
      const dots = lvl ? `<span class="level" aria-label="level ${lvl} of 5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= lvl ? 'on' : ''}"></i>`).join('')}</span>` : '';
      const inner = `${iconOf(it.icon)}${esc(it.title || it.label || '')}${dots}`;
      return it.link ? `<a class="chip" href="${esc(hrefOf(it.link))}" target="_blank" rel="noopener">${inner}</a>` : `<span class="chip">${inner}</span>`;
    };
    return `<div class="tag-groups">${[...groups.entries()].map(([g, list], i) => `
      <div class="tag-group reveal draw" style="--i:${i}">${g ? `<h3>${esc(g)} ${doodle('squiggle')}</h3>` : ''}<div class="tags">${list.map(chip).join('')}</div></div>`).join('')}</div>`;
  },

  list(sec, items) {
    const cols = Number(sec.columns) || 1;
    const groups = new Map();
    items.forEach((it) => { const g = it.group || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
    let i = 0;
    const row = (it) => `<li class="list-item sketch ${i % 2 ? 'sketch-alt' : ''} reveal draw" style="--i:${i++ % 6}">
        ${iconOf(it.icon, 'icon', 'star')}
        <div><div class="list-title">${it.link ? `<a href="${esc(hrefOf(it.link))}" target="_blank" rel="noopener">${esc(it.title)}</a>` : esc(it.title)}</div>${it.subtitle || it.org ? `<div class="list-sub">${esc(it.subtitle || it.org)}</div>` : ''}</div>
        <div class="list-date">${esc(dateRange(it))}</div>
        ${it.description ? `<div class="list-desc">${md(it.description)}</div>` : ''}
        ${extraFields(it).length ? metaHtml(it) : ''}
      </li>`;
    return `<ul class="list" style="--cols:${cols}">${[...groups.entries()].map(([g, list]) => `${g ? `<li class="list-group-title">${esc(g)}</li>` : ''}${list.map(row).join('')}`).join('')}</ul>`;
  },

  gallery(sec, items) {
    const cols = Number(sec.columns) || 3;
    return `<div class="gallery" style="--cols:${cols}">${items.flatMap((it, i) => imagesOf(it).map((src, j) => `
      <figure class="sketch ${(i + j) % 2 ? 'sketch-alt' : ''} reveal" style="--i:${(i + j) % 6}" data-src="${esc(src)}" data-caption="${esc(it.caption || it.title || '')}">
        <img src="${esc(src)}" alt="${esc(it.caption || it.title || '')}" loading="lazy">
        ${it.caption || it.title ? `<figcaption>${esc(it.caption || it.title)}</figcaption>` : ''}
      </figure>`)).join('')}</div>`;
  },

  table(sec, items) {
    const cols = [...new Set(items.flatMap((it) => Object.keys(it)))].filter((k) => !['order', 'hidden'].includes(k));
    return `<div class="table-wrap sketch reveal"><table class="data"><thead><tr>${cols.map((c) => `<th>${esc(c.replace(/_/g, ' '))}</th>`).join('')}</tr></thead>
      <tbody>${items.map((it) => `<tr>${cols.map((c) => `<td>${c === 'link' && it[c] ? `<a href="${esc(hrefOf(it[c]))}" target="_blank" rel="noopener">${esc(it[c])}</a>` : md(String(it[c] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  },

  contact(sec, items) {
    const email = S.email || items.find((it) => String(it.link || '').startsWith('mailto:'))?.link?.replace('mailto:', '');
    const extra = LINKS.filter((l) => ['all', 'contact'].includes(l.show_in) && !items.some((it) => hrefOf(it.link) === l.url));
    const rows = [...items.map((it) => ({ label: it.title || it.label, sub: it.subtitle || it.description, url: it.link || it.url, icon: it.icon })), ...extra.map((l) => ({ label: l.label, sub: l.url.replace(/^(https?:\/\/|mailto:)/, ''), url: l.url, icon: l.icon }))];
    return `<div class="contact">
      <div class="reveal draw">${doodle('mail', 'contact-doodle')}
        ${email ? `<a class="contact-big" href="mailto:${esc(email)}">${esc(email)}</a>` : ''}
        ${S.location ? `<div class="hero-meta">${doodle('pin')} ${esc(S.location)}</div>` : ''}
      </div>
      <div class="contact-links">${rows.map((r, i) => `<a class="contact-link sketch ${i % 2 ? 'sketch-alt' : ''} reveal" style="--i:${i}" href="${esc(hrefOf(r.url))}" ${String(r.url).startsWith('mailto:') ? '' : 'target="_blank" rel="noopener"'}>${iconOf(r.icon, '', guessIcon(r.label, r.url))}<div><b>${esc(r.label)}</b><span>${esc(r.sub || '')}</span></div></a>`).join('')}</div>
    </div>`;
  },
};

// ---------------------------------------------------------------- page pieces
function renderNav() {
  const cta = S.secondary_cta_label ? `<a class="btn btn-sm nav-cta" href="${esc(hrefOf(S.secondary_cta_link || 'cv.html'))}">${doodle('download')}${esc(S.secondary_cta_label)}</a>` : '';
  const toggle = yes(S.theme_toggle ?? 'yes') ? `<button class="btn btn-sm nav-cta theme-toggle" id="theme-toggle" title="Switch to the terminal theme">${doodle('code')}Terminal</button>` : '';
  $('#nav').innerHTML = `
    <a class="logo" href="#top" aria-label="Back to top"><span class="logo-mark">${doodle('circle')}${esc(S.initials || (S.name || 'P').split(' ').map((w) => w[0]).join('').slice(0, 2))}</span><span class="logo-name">${esc(S.first_name || S.name || '')}</span></a>
    <button class="burger" id="burger" aria-label="Menu" aria-expanded="false">${doodle('menu')}</button>
    <nav class="nav-links" id="nav-links">${SECTIONS.map((s) => `<a href="#${esc(slug(s.id))}" data-for="${esc(slug(s.id))}">${esc(s.title)}</a>`).join('')}${cta}${toggle}</nav>`;
  $('#theme-toggle')?.addEventListener('click', () => switchTheme('terminal'));
  $('#burger').addEventListener('click', () => { const n = $('#nav'); n.classList.toggle('open'); $('#burger').setAttribute('aria-expanded', n.classList.contains('open')); });
  $('#nav-links').addEventListener('click', (e) => { if (e.target.tagName === 'A') $('#nav').classList.remove('open'); });
  addEventListener('scroll', () => $('#nav').classList.toggle('scrolled', scrollY > 30), { passive: true });
}

function heroEra() {
  const key = String(S.hero_era || '').toLowerCase();
  return eraOf(key) || JOURNEY.find((j) => j.shape === key) || JOURNEY[0];
}

function renderHero() {
  const name = S.name || 'Your Name';
  const words = name.split(' ');
  const last = words.pop();
  const nameHtml = `${esc(words.join(' '))} <span class="underline-doodle">${esc(last)}${doodle('underline')}</span>`;
  const roles = splitList(S.roles);
  const era = heroEra();
  const socials = LINKS.filter((l) => ['all', 'hero'].includes(l.show_in));
  const first = SECTIONS[0];
  return el(`<section class="hero" id="top">
    <div class="wrap hero-inner">
      <div class="hero-copy">
        ${S.availability ? `<span class="pill"><i></i>${esc(S.availability)}</span>` : ''}
        ${S.tagline ? `<p class="hero-hello">${esc(S.tagline)}</p>` : ''}
        <h1>${nameHtml}</h1>
        ${roles.length ? `<p class="hero-roles"><span class="prefix">${esc(S.roles_prefix || 'I build')}</span> <span class="word" id="role-word">${esc(roles[0])}</span><span class="caret" aria-hidden="true"></span></p>` : ''}
        ${S.headline ? `<p class="hero-headline">${esc(S.headline)}</p>` : ''}
        <div class="hero-ctas">
          ${S.primary_cta_label ? `<a class="btn btn-primary" href="${esc(hrefOf(S.primary_cta_link || '#' + slug(first?.id || '')))}">${esc(S.primary_cta_label)} ${doodle('arrow')}</a>` : ''}
          ${S.secondary_cta_label ? `<a class="btn" href="${esc(hrefOf(S.secondary_cta_link || 'cv.html'))}">${doodle('download')}${esc(S.secondary_cta_label)}</a>` : ''}
        </div>
        <div class="hero-meta">
          ${socials.length ? `<div class="socials">${socials.map((l) => `<a href="${esc(hrefOf(l.url))}" target="_blank" rel="noopener" aria-label="${esc(l.label)}" title="${esc(l.label)}">${doodle(l.icon || guessIcon(l.label, l.url))}</a>`).join('')}</div>` : ''}
          ${S.location ? `<span>${doodle('pin')} ${esc(S.location)}</span>` : ''}
        </div>
      </div>
    </div>
    ${era ? `<aside class="era-note" id="era-note">${doodle('arrow-curl', 'arrow')}<span class="year hand">${esc(era.year)}</span><strong>${esc(era.title)}</strong><p>${esc(era.insight)}</p>${S.hero_note ? `<p class="note">${esc(S.hero_note)}</p>` : ''}</aside>` : ''}
    ${first ? `<a class="scroll-cue" href="#${esc(slug(first.id))}">${doodle('scroll')}<span>scroll</span></a>` : ''}
  </section>`);
}

function renderSection(sec, i) {
  const items = C.data[sec.id] || [];
  const era = eraOf(sec.era);
  const render = RENDERERS[sec.layout] || RENDERERS.cards;
  const body = items.length || sec.layout === 'text' ? render(sec, items) : `<p class="empty">Nothing here yet — add rows to the "${esc(sec.id)}" sheet.</p>`;
  const decor = ['sparkle', 'star', 'plus', 'squiggle', 'wave'][i % 5];
  return el(`<section class="section layout-${esc(sec.layout)}" id="${esc(slug(sec.id))}" data-era="${esc(sec.era || '')}">
    <div class="wrap">
      ${doodle(decor, 'decor draw reveal')}
      <header class="section-head reveal draw">
        ${era ? `<div class="era-chip" title="${esc(era.insight)}"><span class="year">${esc(era.year)}</span><span>${esc(era.title)}</span></div>` : ''}
        ${sec.eyebrow ? `<p class="eyebrow">${doodle(sec.doodle)}${esc(sec.eyebrow)}</p>` : ''}
        <h2 class="section-title">${esc(sec.title)}</h2>
        ${sec.intro ? `<p class="intro">${esc(sec.intro)}</p>` : ''}
        ${era ? `<p class="era-insight">${esc(era.insight)}</p>` : ''}
      </header>
      ${body}
      ${sec.cta_label ? `<div class="section-cta reveal"><a class="btn" href="${esc(hrefOf(sec.cta_link))}" target="_blank" rel="noopener">${esc(sec.cta_label)} ${doodle('external')}</a></div>` : ''}
    </div>
  </section>`);
}

function renderRail() {
  const rail = $('#rail');
  if (!yes(S.show_journey_rail ?? 'yes')) { rail.remove(); document.body.classList.remove('with-rail'); return; }
  const order = [];
  const hero = heroEra();
  if (hero) order.push(hero.id);
  SECTIONS.forEach((s) => { const e = eraOf(s.era); if (e && !order.includes(e.id)) order.push(e.id); });
  if (!order.length) { rail.remove(); document.body.classList.remove('with-rail'); return; }
  rail.hidden = false;
  rail.innerHTML = `<p class="rail-title">${esc(S.journey_title || 'A short history of learning machines')}</p><ol>${order.map((id) => {
    const e = eraOf(id);
    const target = id === hero?.id ? 'top' : slug(SECTIONS.find((s) => String(s.era).toLowerCase() === id)?.id || '');
    return `<li data-era="${esc(id)}" style="--rail-color:${themeColor(e.color)}"><span class="dot"></span><button data-target="${esc(target)}"><span class="year">${esc(e.year)}</span><span class="ttl">${esc(e.title)}</span><span class="ins">${esc(e.insight)}</span></button></li>`;
  }).join('')}</ol>`;
  rail.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) document.getElementById(b.dataset.target)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); });
}

function renderFooter() {
  const links = LINKS.filter((l) => ['all', 'footer'].includes(l.show_in));
  const f = $('#footer');
  f.hidden = false;
  f.innerHTML = `<div class="wrap">
    <div><strong>${esc(S.name || '')}</strong>${S.footer_note ? `<p class="footer-note">${esc(S.footer_note)}</p>` : ''}</div>
    <div class="footer-links">${links.map((l) => `<a href="${esc(hrefOf(l.url))}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}<a href="cv.html">${doodle('print')} CV page</a><a href="#top">Back to top ↑</a></div>
    <small>© ${new Date().getFullYear()} ${esc(S.name || '')}. Content generated from ${esc(C.source || 'content.xlsx')} on ${esc((C.generated_at || '').slice(0, 10))}.</small>
  </div>`;
}

// ---------------------------------------------------------------- behaviours
function initReveal() {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  $$('.reveal').forEach((n) => io.observe(n));
}

function initCounters() {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const raw = e.target.dataset.count;
    const m = String(raw).match(/^([^\d]*)(\d[\d,]*)(\.\d+)?(.*)$/);
    if (!m || reduced) return;
    const pre = m[1], intPart = parseInt(m[2].replace(/,/g, ''), 10), dec = m[3] || '', post = m[4];
    const t0 = performance.now(), dur = 1400;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur), ease = 1 - Math.pow(1 - p, 3);
      const v = Math.round(intPart * ease);
      e.target.textContent = `${pre}${v.toLocaleString()}${p === 1 ? dec : ''}${post}`;
      if (p < 1) requestAnimationFrame(tick); else e.target.textContent = raw;
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.4 });
  $$('[data-count]').forEach((n) => io.observe(n));
}

function initRoles() {
  const node = $('#role-word');
  const words = splitList(S.roles);
  if (!node || words.length < 2) return;
  let wi = 0;
  if (reduced) { setInterval(() => { wi = (wi + 1) % words.length; node.textContent = words[wi]; }, 3000); return; }
  const type = async () => {
    const w = words[wi];
    for (let i = 1; i <= w.length; i++) { node.textContent = w.slice(0, i); await wait(38 + Math.random() * 40); }
    await wait(2200);
    for (let i = w.length; i >= 0; i--) { node.textContent = w.slice(0, i); await wait(22); }
    wi = (wi + 1) % words.length;
    type();
  };
  setTimeout(type, 1800);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function initTilt() {
  if (reduced || matchMedia('(hover: none)').matches) return;
  $$('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--tilt-y', `${x * 6}deg`); card.style.setProperty('--tilt-x', `${-y * 6}deg`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--tilt-y', '0deg'); card.style.setProperty('--tilt-x', '0deg'); });
  });
}

function initModal() {
  const modal = $('#modal'), content = $('#modal-content');
  $('#modal-close').innerHTML = doodle('close');
  const open = (html) => { content.innerHTML = html; modal.hidden = false; document.body.classList.add('modal-open'); $('#modal-close').focus(); };
  const close = () => { modal.hidden = true; document.body.classList.remove('modal-open'); };
  $('#modal-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

  const openItem = (card) => {
    const it = (C.data[card.dataset.section] || [])[Number(card.dataset.index)];
    if (!it) return;
    const imgs = imagesOf(it);
    open(`<div class="card-top"><div class="card-icon" style="--card-color:${card.style.getPropertyValue('--card-color')}">${iconOf(it.icon, '', 'star')}</div>
      <div><h3 class="card-title">${esc(it.title)}</h3>${it.subtitle ? `<p class="card-sub">${esc(it.subtitle)}</p>` : ''}</div></div>
      <div class="hero-meta" style="margin-top:.6rem">${it.date || it.year ? `<span class="list-date">${esc(fmtDate(it.date || it.year))}</span>` : ''}${it.status ? `<span class="card-status">${esc(it.status)}</span>` : ''}${it.org ? `<span class="tl-org">${esc(it.org)}</span>` : ''}</div>
      ${imgs.length ? `<div class="modal-imgs">${imgs.map((s) => `<img src="${esc(s)}" alt="">`).join('')}</div>` : ''}
      <div class="modal-body">${md(it.description || it.summary)}</div>
      ${tagsHtml(it)}${metaHtml(it)}
      <div class="modal-foot">${linksHtml(it, false)}</div>`);
    scene?.burst(30);
  };
  $$('.card').forEach((card) => {
    card.addEventListener('click', (e) => { if (!e.target.closest('a')) openItem(card); });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(card); } });
  });
  $$('.gallery figure').forEach((fig) => fig.addEventListener('click', () => open(`<div class="modal-img-only"><img src="${esc(fig.dataset.src)}" alt="${esc(fig.dataset.caption)}"></div>${fig.dataset.caption ? `<p class="hand" style="text-align:center;font-size:1.3rem;margin:.8rem 0 0">${esc(fig.dataset.caption)}</p>` : ''}`)));
}

function initJourney() {
  const rail = $('#rail');
  const railItems = rail ? $$('li', rail) : [];
  const navLinks = $$('#nav-links a[data-for]');
  const hero = heroEra();
  let activeEra = null;

  const activate = (eraId, sectionId) => {
    if (eraId && eraId !== activeEra) {
      activeEra = eraId;
      const era = eraOf(eraId);
      currentShape = era?.shape || 'constellation';
      scene?.setShape(currentShape);
      let seen = false;
      railItems.forEach((li) => { const isIt = li.dataset.era === eraId; li.classList.toggle('active', isIt); li.classList.toggle('done', !isIt && !seen); if (isIt) seen = true; });
    }
    navLinks.forEach((a) => a.classList.toggle('active', a.dataset.for === sectionId));
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const isHero = e.target.id === 'top';
      currentMode = isHero ? 'hero' : 'aside';
      scene?.setMode(currentMode);
      rail?.classList.toggle('show', !isHero);
      activate(isHero ? hero?.id : (e.target.dataset.era || activeEra), isHero ? null : e.target.id);
    });
  }, { rootMargin: '-40% 0px -45% 0px', threshold: 0 });
  io.observe($('#top'));
  $$('.section').forEach((s) => io.observe(s));
  activate(hero?.id, null);
}

async function initScene() {
  try {
    const { createScene } = await import('./scene.js');
    scene = createScene($('#scene'), {
      palette: { paper: S.color_paper, paper2: S.color_paper_2, ink: S.color_ink, accent: S.color_accent, accent2: S.color_accent_2, accent3: S.color_accent_3, accent4: S.color_accent_4 },
      density: S.scene_density || 'medium',
      asideOpacity: parseFloat(S.scene_opacity_sections) || 0.55,
    });
    window.__scene = scene; // handy for debugging in devtools
    const hero = heroEra();
    setTimeout(() => { scene.setMode(currentMode); scene.setShape(currentShape || hero?.shape || 'perceptron', { duration: 2.2 }); }, 350);
    addEventListener('click', (e) => { if (!e.target.closest('a, button, .card, .modal')) scene.burst(18); });
  } catch (err) {
    console.warn('3D scene unavailable (offline or WebGL disabled):', err);
    $('#scene').remove();
  }
}

function showError(err) {
  $('#main').innerHTML = `<div class="error sketch"><h2 class="hand" style="font-size:2rem;margin:0 0 .5rem">Could not load content.json</h2>
    <p>Run <code>python studio.py</code> (or <code>python tools/build_content.py</code>) so the site has content to show. Opening index.html straight from the file system does not work — it needs a web server.</p><pre>${esc(err.message || err)}</pre></div>`;
}

// ---------------------------------------------------------------- boot
async function main() {
  try { C = await loadContent(); } catch (e) { showError(e); return; }
  S = C.settings || {};
  if (resolveTheme(S) === 'terminal') {
    const mod = await import('./terminal.js');
    mod.bootTerminal(C);
    return;
  }
  document.body.classList.add('theme-paper');
  JOURNEY = C.journey || [];
  ERA_BY_ID = Object.fromEntries(JOURNEY.map((j) => [j.id, j]));
  LINKS = C.links || [];
  SECTIONS = (C.sections || []).filter((s) => s.visible !== false);
  applyTheme(S);
  document.title = S.site_title || S.name || 'Portfolio';
  $('meta[name="description"]').content = S.seo_description || S.headline || '';
  if (!yes(S.show_grain ?? 'yes')) document.body.classList.add('no-grain');

  renderNav();
  const main = $('#main');
  main.innerHTML = '';
  main.appendChild(renderHero());
  const wrap = el('<div id="content"></div>');
  SECTIONS.forEach((s, i) => wrap.appendChild(renderSection(s, i)));
  main.appendChild(wrap);
  renderRail();
  renderFooter();

  initScene();
  initReveal();
  initCounters();
  initRoles();
  initTilt();
  initModal();
  initJourney();
  initLiveReload();
}

main();
