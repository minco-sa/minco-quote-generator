// Global search box (header) — Notes-style: debounce, scope tokens, sections, suggestions, ranking switch.
import { store } from '../store.js';
import { buildIndex, search } from '../search/engine.js';
import { buildDocs } from '../search/docs.js';
import { esc } from './helpers.js';

let index = null, dirty = true, strategy = 'relevance';
store.onChange(() => { dirty = true; });
const getIndex = () => { if (dirty || !index) { index = buildIndex(buildDocs()); dirty = false; } return index; };

export function mountSearch(host) {
  host.innerHTML = `<div class="gsearch"><input id="gsearch" class="i" placeholder="Search quotations, positions, systems, prices…  (system: customer: status: supplier: type:)" autocomplete="off"><div id="gsearch-panel" class="gsearch-panel" hidden></div></div>`;
  const input = host.querySelector('#gsearch'), panel = host.querySelector('#gsearch-panel');
  let timer;
  const hl = (s) => esc(s).replace(/«([^»]*)»/g, '<mark>$1</mark>');
  const render = (q) => {
    if (!q.trim()) { panel.hidden = true; return; }
    const r = search(getIndex(), q, { strategy, limit: 40 });
    panel.hidden = false;
    panel.innerHTML = `<div class="gs-bar"><span class="sub">${r.hits.length} result(s)${r.corrected ? ` · showing results for <b>${esc(r.corrected)}</b> (typo fallback)` : ''}${Object.keys(r.scopes).length ? ' · scope ' + Object.entries(r.scopes).map(([k, v]) => `<span class="tag">${esc(k)}: ${esc(v)}</span>`).join('') : ''}</span><span class="spacer"></span>
      <button class="btn sm ${strategy === 'relevance' ? 'p' : ''}" data-strat="relevance">Relevance</button><button class="btn sm ${strategy === 'recent' ? 'p' : ''}" data-strat="recent">Recent</button></div>
      ${r.suggestions.length ? `<div class="gs-sugg">${r.suggestions.map((s) => `<button class="tag" data-sugg="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
      ${r.sections.length ? r.sections.map((sec) => `<div class="gs-sec"><div class="gs-h">${esc(sec.label)}</div>${sec.hits.map((h) => `<a class="gs-hit" href="${esc(h.doc.href)}"><span class="gs-kind">${esc(h.doc.kind)}</span><span class="gs-title">${hl(h.snippet.startsWith('…') || !h.snippet.includes(h.doc.title.slice(0, 12)) ? esc(h.doc.title) : '')}</span><span class="gs-snip">${hl(h.snippet)}</span></a>`).join('')}</div>`).join('') : '<div class="empty">No matches. Try fewer words, or a scope like <span class="mono">type:price</span>.</div>'}`;
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => render(input.value), 150); });
  input.addEventListener('focus', () => { if (input.value.trim()) render(input.value); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { panel.hidden = true; input.blur(); } });
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-strat],[data-sugg],a.gs-hit'); if (!b) return;
    if (b.dataset.strat) { strategy = b.dataset.strat; render(input.value); }
    else if (b.dataset.sugg) { input.value = b.dataset.sugg; render(input.value); input.focus(); }
    else { panel.hidden = true; }
  });
  document.addEventListener('click', (e) => { if (!host.contains(e.target)) panel.hidden = true; });
  window.addEventListener('hashchange', () => { panel.hidden = true; });
}
