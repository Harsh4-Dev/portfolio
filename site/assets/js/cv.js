/* cv.js — a classic, printable CV rendered from the same content.json. */
import { loadContent, esc, splitList, splitLinks, dateRange, fmtDate, md, applyTheme, hrefOf, yes, makeText, flag } from './content.js';

let T = (k, d) => d;
import { doodle } from './doodles.js';

const SKIP_LAYOUTS = new Set(['contact', 'gallery']);

function entry(it) {
  const tags = [...splitList(it.tags), ...splitList(it.tools), ...splitList(it.stack)];
  const links = [...(it.link ? [{ label: it.link_label || 'Link', url: it.link }] : []), ...splitLinks(it.links)];
  return `<div class="cv-entry">
    <div><span class="t">${esc(it.title || it.role || it.label || '')}</span>${it.org || it.company ? ` — <span class="o">${esc(it.org || it.company)}</span>` : ''}${it.subtitle ? ` <span class="l">· ${esc(it.subtitle)}</span>` : ''}${it.location ? ` <span class="l">· ${esc(it.location)}</span>` : ''}</div>
    <div class="d">${esc(dateRange(it))}</div>
    ${it.description || it.summary ? `<div class="desc">${md(it.description || it.summary)}</div>` : ''}
    ${tags.length || links.length ? `<div class="tags">${tags.length ? `<b>${esc(T('cv_tools', 'Tools:'))}</b> ${esc(tags.join(', '))}` : ''}${links.length ? ` ${links.map((l) => `· <a href="${esc(hrefOf(l.url))}">${esc(l.label)}</a>`).join(' ')}` : ''}</div>` : ''}
  </div>`;
}

function section(sec, items) {
  let body = '';
  switch (sec.layout) {
    case 'tags': {
      const groups = new Map();
      items.forEach((it) => { const g = it.group || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it.title || it.label); });
      body = `<div class="cv-tags">${[...groups.entries()].map(([g, l]) => `<p>${g ? `<b>${esc(g)}:</b> ` : ''}${esc(l.join(', '))}</p>`).join('')}</div>`;
      break;
    }
    case 'stats':
      body = `<div class="cv-stats">${items.map((it) => `<span><b>${esc(it.value ?? it.title ?? '')}</b> ${esc(it.label ?? it.subtitle ?? '')}</span>`).join('')}</div>`;
      break;
    case 'text':
      body = `<div class="cv-text">${items.map((it) => md(it.description || it.summary)).join('')}${!items.length ? md(sec.intro) : ''}</div>`;
      break;
    case 'table': {
      const cols = [...new Set(items.flatMap((it) => Object.keys(it)))].filter((k) => !['order', 'hidden'].includes(k));
      body = `<table class="data"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${items.map((it) => `<tr>${cols.map((c) => `<td>${esc(it[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      break;
    }
    default:
      body = items.map(entry).join('');
  }
  return `<section class="cv-section"><h2>${doodle(sec.doodle)}${esc(sec.title)}</h2>${body}</section>`;
}

async function main() {
  const root = document.getElementById('cv');
  let C;
  try { C = await loadContent(); } catch (e) { root.innerHTML = `<p>Could not load content.json (${esc(e.message)}). Run <code>python studio.py</code>.</p>`; return; }
  const S = C.settings || {};
  T = makeText(C);
  applyTheme(S);
  if (!yes(S.show_grain ?? 'yes')) document.body.classList.add('no-grain');
  document.title = `${S.name || 'CV'} — ${S.cv_title || 'Curriculum Vitae'}`;
  const back = document.querySelector('.cv-tools a'); if (back) back.textContent = T('cv_back', '← Portfolio');
  const print = document.querySelector('.cv-tools button'); if (print) print.textContent = T('cv_print', 'Print / Save as PDF');
  const links = (C.links || []).filter((l) => l.show_in !== 'none' && !(S.email && l.url.toLowerCase() === `mailto:${S.email.toLowerCase()}`));
  const contact = [S.email && `<a href="mailto:${esc(S.email)}">${esc(S.email)}</a>`, S.phone && esc(S.phone), flag(S, 'show_location') && S.location && esc(S.location), ...links.map((l) => `<a href="${esc(hrefOf(l.url))}">${esc(l.url.replace(/^(https?:\/\/(www\.)?|mailto:)/, ''))}</a>`)].filter(Boolean);
  const sections = (C.sections || []).filter((s) => s.visible !== false && s.show_in_cv !== false && !SKIP_LAYOUTS.has(s.layout));
  root.innerHTML = `
    <header class="cv-head">
      <div><h1>${esc(S.name || '')}</h1>${S.tagline ? `<p class="tag">${esc(S.tagline)}</p>` : ''}</div>
      <div class="cv-contact">${contact.join('<br>')}</div>
    </header>
    ${S.headline ? `<p class="cv-text">${esc(S.headline)}</p>` : ''}
    ${sections.map((s) => section(s, C.data[s.id] || [])).join('')}
    ${flag(S, 'show_generated_line') ? `<p class="l" style="margin-top:2rem;font-size:.8rem;color:var(--ink-faint)">${esc(T('cv_generated', 'Generated from {source} · {date}', { source: C.source || 'content.xlsx', date: (C.generated_at || '').slice(0, 10) }))}</p>` : ''}`;
}
main();
