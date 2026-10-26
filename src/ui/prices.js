import { store } from '../store.js';
import { SUPPLIERS } from '../data/prices.js';
import { esc, money, download, toCSV, parseCSV, readFile, toast, confirmDialog } from './helpers.js';

const CATS = ['profile', 'glass', 'accessory', 'consumable', 'service'];
const UNITS = ['bar', 'm2', 'pc', 'm', 'kg', 'roll'];
const state = { cat: 'all', q: '' };

export function renderPrices(container) {
  const draw = () => {
    const list = store.prices.filter((p) => (state.cat === 'all' || p.category === state.cat) && (!state.q || `${p.code} ${p.name} ${p.supplier}`.toLowerCase().includes(state.q.toLowerCase())));
    const old = (d) => d && (Date.now() - new Date(d).getTime()) > 90 * 86400000;
    container.innerHTML = `
      <div class="flex" style="margin-bottom:12px"><h1 style="margin:0">Price book</h1><span class="sub">purchase prices, SAR excl. VAT</span><span class="spacer"></span>
        <a class="btn p" href="#/import">Import bills (XLSX / PDF / photo)</a><button class="btn" data-act="import">Import CSV</button><button class="btn" data-act="export">Export CSV</button><button class="btn" data-act="reset">Reset to defaults</button><button class="btn p" data-act="add">+ Add price</button></div>
      <div class="card">
        <div class="flex" style="margin-bottom:10px">
          <select class="i" style="max-width:180px" data-f="cat"><option value="all">All categories</option>${CATS.map((c) => `<option value="${c}" ${state.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          <input class="i" style="max-width:280px" data-f="q" placeholder="Search code / name / supplier" value="${esc(state.q)}">
          <span class="sub">${list.length} of ${store.prices.length} · <span class="tag miss">no price</span> = fill in · <span class="tag">old</span> = older than 90 days</span></div>
        <div style="overflow-x:auto"><table class="t"><thead><tr><th>Code</th><th>Item</th><th>Category</th><th>Unit</th><th class="n">Price</th><th class="n">Min m²/lite</th><th>Supplier</th><th>Date</th><th>Source</th><th>History</th><th></th></tr></thead><tbody>
          ${list.map((p) => `<tr data-code="${esc(p.code)}">
            <td class="mono">${esc(p.code)}</td>
            <td><input class="i sm" data-k="name" value="${esc(p.name)}" style="min-width:260px"> ${!(Number(p.price) > 0) ? '<span class="tag miss">no price</span>' : ''} ${old(p.date) ? '<span class="tag">old</span>' : ''}</td>
            <td><select class="i sm" data-k="category">${CATS.map((c) => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
            <td><select class="i sm" data-k="unit">${UNITS.map((u) => `<option ${p.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
            <td class="n"><input class="i sm" type="number" step="0.01" data-k="price" value="${esc(p.price)}" style="width:90px;text-align:right"></td>
            <td class="n">${p.category === 'glass' ? `<input class="i sm" type="number" step="0.01" data-k="minArea" value="${esc(p.minArea ?? 0)}" style="width:70px;text-align:right">` : ''}</td>
            <td><input class="i sm" data-k="supplier" value="${esc(p.supplier || '')}" style="width:70px" title="${esc(SUPPLIERS[p.supplier] || '')}"></td>
            <td><input class="i sm" type="date" data-k="date" value="${esc(p.date || '')}"></td>
            <td><input class="i sm" data-k="source" value="${esc(p.source || '')}" style="width:110px"></td>
            <td class="sub" title="${esc((p.history || []).map((h) => `${h.price} · ${h.date} · ${h.source}`).join('\n'))}">${(p.history || []).length ? `${(p.history || []).length}× · ${(() => { const r = store.priceRange(p); return r && r.max > r.min * 1.05 ? `<span class="tag">${money(r.min)}–${money(r.max)}</span>` : ''; })()}` : ''}</td>
            <td><button class="btn sm bad" data-del="${esc(p.code)}">✕</button></td></tr>`).join('')}
        </tbody></table></div>
        <p class="sub">Suppliers: ${Object.entries(SUPPLIERS).map(([k, v]) => `<b>${k}</b> ${esc(v)}`).join(' · ')}</p>
      </div>`;
  };
  container.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.f) { state[el.dataset.f] = el.value; if (el.dataset.f === 'cat') draw(); return; }
    const tr = el.closest('tr[data-code]'); if (!tr || !el.dataset.k) return;
    const p = store.prices.find((x) => x.code === tr.dataset.code); if (!p) return;
    p[el.dataset.k] = ['price', 'minArea'].includes(el.dataset.k) ? Number(el.value) : el.value;
    store.save('prices');
  });
  container.addEventListener('keydown', (e) => { if (e.target.dataset.f === 'q' && e.key === 'Enter') draw(); });
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.del) { if (!confirmDialog(`Delete price ${b.dataset.del}?`)) return; store.deletePrice(b.dataset.del); draw(); }
    else if (b.dataset.act === 'add') { const code = window.prompt('New item code (supplier code or your own key):'); if (!code) return; if (store.prices.some((p) => p.code === code)) { toast('Code already exists'); return; } store.upsertPrice({ code, name: '', category: state.cat === 'all' ? 'accessory' : state.cat, unit: 'pc', price: 0, supplier: '', date: new Date().toISOString().slice(0, 10), source: '' }); state.q = code; draw(); }
    else if (b.dataset.act === 'export') download('price-book.csv', toCSV(store.prices, ['code', 'name', 'category', 'unit', 'price', 'minArea', 'supplier', 'date', 'source']), 'text/csv');
    else if (b.dataset.act === 'import') { try { const { text } = await readFile('.csv'); const rows = parseCSV(text); let n = 0; for (const r of rows) { if (!r.code) continue; store.upsertPrice({ code: r.code.trim(), name: r.name || '', category: r.category || 'accessory', unit: r.unit || 'pc', price: Number(r.price) || 0, minArea: Number(r.minArea) || 0, supplier: r.supplier || '', date: r.date || '', source: r.source || 'CSV import' }); n++; } toast(`Imported ${n} prices`); draw(); } catch (err) { toast(`Import failed: ${err.message}`); } }
    else if (b.dataset.act === 'reset') { if (!confirmDialog('Replace the whole price book with the built-in defaults? Your edits will be lost.')) return; store.resetPrices(); draw(); }
  });
  draw();
}
