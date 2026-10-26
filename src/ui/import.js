// Bulk import of supplier bills into the price book: XLSX/CSV (local parse + column mapping) and PDF/photo (AI extraction).
import { store } from '../store.js';
import { readXlsx } from '../import/xlsx.js';
import { extractInvoice, detectSupplier, matchLine, normalizeUnit, normalizeCategory, guessCategory, guessColumns } from '../import/invoices.js';
import { esc, money, num, parseCSV, toast, navigate } from './helpers.js';

const state = { queue: [], lines: [], running: false, log: [] };
const FIELDS = [['code', 'Code'], ['name', 'Description'], ['category', 'Category (optional)'], ['unit', 'Unit'], ['price', 'Unit price (excl. VAT)'], ['qty', 'Qty'], ['supplier', 'Supplier'], ['date', 'Date'], ['source', 'Invoice / source']];
const UNITS = ['bar', 'pc', 'm', 'm2', 'kg', 'roll'];
const normDate = (d) => { const s = String(d || '').trim(); let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; return ''; };
const CATS = ['profile', 'glass', 'accessory', 'consumable', 'service'];

export function renderImport(container) {
  const draw = () => {
    const s = store.settings;
    const hasKey = !!(s.aiApiKey || '').trim();
    container.innerHTML = `
      <div class="flex" style="margin-bottom:12px"><h1 style="margin:0">Import supplier bills</h1><span class="sub">invoices & quotes → price book (with history)</span><span class="spacer"></span><a class="btn" href="#/prices">Price book</a></div>
      ${!hasKey ? '<div class="warn">PDF and photo bills are read with Claude. Add your Anthropic API key in <a href="#/settings">Settings → AI</a>. Excel/CSV files are parsed locally and need no key.</div>' : ''}
      <div class="row"><div class="col">
        <div class="card"><h2>1 · Add files</h2>
          <p class="sub">Drop up to 200 files: <b>.xlsx / .csv</b> (price lists, exported invoices) are parsed in the browser; <b>.pdf / .jpg / .png</b> (scanned bills, supplier quotes, WhatsApp photos) are read by AI. Each file becomes extracted lines you review before anything changes.</p>
          <input type="file" id="files" multiple accept=".xlsx,.csv,.pdf,image/*" class="i">
          <div class="actions" style="margin-top:10px"><button class="btn p" data-act="run" ${state.running ? 'disabled' : ''}>Process queue</button><button class="btn" data-act="clear">Clear</button><span class="sub" id="prog"></span></div>
          <table class="t" style="margin-top:10px"><thead><tr><th>File</th><th>Kind</th><th>Status</th><th class="n">Lines</th><th></th></tr></thead><tbody>
            ${state.queue.map((f, i) => `<tr><td>${esc(f.name)}</td><td>${esc(f.kind)}</td><td class="${f.status === 'error' ? 'err' : ''}">${esc(f.status)}${f.error ? ' — ' + esc(f.error) : ''}${f.supplier ? ' · ' + esc(f.supplier) : ''}${f.docNo ? ' · ' + esc(f.docNo) : ''}</td><td class="n">${f.lines ?? ''}</td><td>${f.kind === 'sheet' && f.rows ? `<button class="btn sm" data-map="${i}">Map columns</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Queue is empty</td></tr>'}
          </tbody></table>
          <div id="mapper"></div>
        </div>
        <div class="card"><h2>Recent imports</h2><ul class="sub">${store.imports.slice(0, 8).map((l) => `<li>${esc(l.at.slice(0, 16).replace('T', ' '))} — ${esc(l.file)} · ${l.applied} lines applied${l.supplier ? ' · ' + esc(l.supplier) : ''}</li>`).join('') || '<li>none yet</li>'}</ul></div>
      </div>
      <div class="col-2"><div class="card">
        <div class="flex"><h2 style="margin:0">2 · Review extracted lines (${state.lines.length})</h2><span class="spacer"></span>
          <button class="btn sm" data-act="sel-all">Select all</button><button class="btn sm" data-act="sel-none">None</button><button class="btn sm" data-act="sel-changed">Only changed / new</button>
          <button class="btn p" data-act="apply">Apply selected to price book</button></div>
        <p class="sub">Match: <span class="tag">exact</span> same code · <span class="tag">section</span> same supplier section number · <span class="tag">name</span> similar description · <span class="tag miss">new</span> not in price book (creates a new item with the code shown; edit it first if needed).</p>
        <div style="overflow-x:auto"><table class="t"><thead><tr><th></th><th>Code → apply to</th><th>Description</th><th>Cat.</th><th>Unit</th><th class="n">New price</th><th class="n">Current</th><th class="n">Δ</th><th>Supplier</th><th>Date</th><th>Source</th><th>Match</th></tr></thead><tbody>
          ${state.lines.map((l, i) => { const cur = l.match.candidate; const delta = cur && Number(cur.price) > 0 ? ((l.price - cur.price) / cur.price) * 100 : null; return `<tr class="${l.selected ? '' : 'muted'}">
            <td><input type="checkbox" data-sel="${i}" ${l.selected ? 'checked' : ''}></td>
            <td><input class="i sm mono" data-f="code" data-i="${i}" value="${esc(l.applyCode)}" style="width:130px" list="pb-codes"></td>
            <td><input class="i sm" data-f="name" data-i="${i}" value="${esc(l.name)}" style="min-width:240px"></td>
            <td><select class="i sm" data-f="category" data-i="${i}">${CATS.map((c) => `<option ${l.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
            <td><select class="i sm" data-f="unit" data-i="${i}">${UNITS.map((u) => `<option ${l.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
            <td class="n"><input class="i sm" type="number" step="0.01" data-f="price" data-i="${i}" value="${esc(l.price)}" style="width:90px;text-align:right"></td>
            <td class="n">${cur ? money(cur.price) : '—'}</td>
            <td class="n" style="color:${delta == null ? '' : Math.abs(delta) > 5 ? '#b45309' : '#16a34a'}">${delta == null ? '' : (delta > 0 ? '+' : '') + delta.toFixed(1) + '%'}</td>
            <td><input class="i sm" data-f="supplier" data-i="${i}" value="${esc(l.supplier)}" style="width:60px"></td>
            <td><input class="i sm" type="date" data-f="date" data-i="${i}" value="${esc(l.date)}"></td>
            <td><input class="i sm" data-f="source" data-i="${i}" value="${esc(l.source)}" style="width:110px"></td>
            <td><span class="tag ${l.match.status === 'new' ? 'miss' : ''}">${esc(l.match.status)}</span>${l.match.note ? `<br><span class="sub">${esc(l.match.note)}</span>` : ''}${l.match.suggestion ? `<br><span class="sub">maybe: ${esc(l.match.suggestion.code)}</span>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="12" class="empty">Process files to see lines here.</td></tr>'}
        </tbody></table></div>
        <datalist id="pb-codes">${store.prices.map((p) => `<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('')}</datalist>
      </div></div></div>`;
  };

  const addLine = (raw, meta) => {
    const price = Number(raw.price) || 0;
    const givenCat = normalizeCategory(raw.category);
    const line = { code: String(raw.code || '').trim(), description: raw.name || '', price, supplier: detectSupplier({ supplier_name: raw.supplier || '' }) || raw.supplier || meta.supplier || '', date: normDate(raw.date) || meta.date || '', source: raw.source || meta.source || '', qty: raw.qty };
    const match = matchLine({ code: line.code, description: line.description }, store.prices);
    const category = match.candidate?.category || givenCat || guessCategory({ unit: normalizeUnit(raw.unit), description: line.description });
    line.unit = match.candidate?.unit || normalizeUnit(raw.unit, category);
    state.lines.push({ ...line, name: line.description, applyCode: match.code || line.code || '', category, match, selected: price > 0 && (match.status === 'new' || !match.candidate || Number(match.candidate.price) !== price), file: meta.file });
  };

  const processSheet = (f, mapping) => {
    const rows = f.rows, hdr = f.headerRow;
    const headers = rows[hdr].map((h) => String(h));
    const idx = (field) => headers.indexOf(mapping[field]);
    let n = 0;
    for (const r of rows.slice(hdr + 1)) {
      const get = (field) => { const i = idx(field); return i >= 0 ? r[i] : ''; };
      if (!String(get('code') || get('name')).trim()) continue;
      const price = Number(String(get('price')).replace(/[^\d.\-]/g, ''));
      if (!Number.isFinite(price)) continue;
      addLine({ code: get('code'), name: get('name'), category: get('category'), unit: String(get('unit') || ''), price, qty: get('qty'), supplier: get('supplier'), date: get('date'), source: get('source') }, { file: f.name, source: `Sheet ${f.name}` });
      n++;
    }
    f.lines = n; f.status = 'extracted'; f.mapped = true;
  };

  const showMapper = (i) => {
    const f = state.queue[i];
    const hdrCandidates = f.rows.slice(0, 6);
    const headers = (f.rows[f.headerRow] || []).map((h) => String(h));
    const mapping = f.mapping || guessColumns(headers);
    f.mapping = mapping;
    container.querySelector('#mapper').innerHTML = `<div class="sub-card"><b>Map columns — ${esc(f.name)}</b> <span class="sub">(${f.rows.length} rows)</span>
      <div class="grid c2" style="margin-top:6px">
        <label class="f"><span>Header row</span><select class="i sm" data-hdr="${i}">${hdrCandidates.map((r, k) => `<option value="${k}" ${k === f.headerRow ? 'selected' : ''}>Row ${k + 1}: ${esc(r.slice(0, 5).join(' | ').slice(0, 60))}</option>`).join('')}</select></label>
        ${FIELDS.map(([k, l]) => `<label class="f"><span>${l}</span><select class="i sm" data-mapf="${k}" data-mi="${i}"><option value="">—</option>${headers.map((h) => `<option ${mapping[k] === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}
      </div><div class="actions" style="margin-top:8px"><button class="btn p sm" data-mapgo="${i}">Extract lines from this sheet</button></div></div>`;
  };

  container.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.id === 'files') {
      for (const file of el.files) {
        const kind = /\.(xlsx|csv)$/i.test(file.name) ? 'sheet' : (file.type === 'application/pdf' || /^image\//.test(file.type)) ? 'ai' : 'unsupported';
        const entry = { name: file.name, file, kind, status: kind === 'unsupported' ? 'error' : 'queued', error: kind === 'unsupported' ? 'unsupported type' : '' };
        if (kind === 'sheet') {
          try {
            if (/\.csv$/i.test(file.name)) { const objs = parseCSV(await file.text()); const headers = Object.keys(objs[0] || {}); entry.rows = [headers, ...objs.map((o) => headers.map((h) => o[h]))]; entry.headerRow = 0; }
            else { const { sheets } = await readXlsx(await file.arrayBuffer()); for (const sh of sheets) { if (!sh.rows.length) continue; state.queue.push({ ...entry, name: `${file.name} › ${sh.name}`, rows: sh.rows, headerRow: sh.rows.findIndex((r) => r.filter((c) => String(c).trim()).length >= 3) }); } continue; }
          } catch (err) { entry.status = 'error'; entry.error = err.message; }
        }
        state.queue.push(entry);
      }
      draw();
    }
    if (el.dataset.hdr !== undefined) { const f = state.queue[Number(el.dataset.hdr)]; f.headerRow = Number(el.value); f.mapping = null; showMapper(Number(el.dataset.hdr)); }
    if (el.dataset.mapf) { const f = state.queue[Number(el.dataset.mi)]; f.mapping[el.dataset.mapf] = el.value; }
    if (el.dataset.sel !== undefined) { state.lines[Number(el.dataset.sel)].selected = el.checked; }
  });
  container.addEventListener('input', (e) => { const el = e.target; if (el.dataset.f && el.dataset.i !== undefined) { const l = state.lines[Number(el.dataset.i)]; const v = el.dataset.f === 'price' ? Number(el.value) : el.value; if (el.dataset.f === 'code') l.applyCode = v; else l[el.dataset.f] = v; } });
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.map !== undefined) { showMapper(Number(b.dataset.map)); return; }
    if (b.dataset.mapgo !== undefined) { const i = Number(b.dataset.mapgo); const f = state.queue[i]; if (!f.mapping.price || !(f.mapping.code || f.mapping.name)) { toast('Map at least Code or Description, and Unit price'); return; } processSheet(f, f.mapping); draw(); return; }
    if (b.dataset.act === 'clear') { state.queue = []; state.lines = []; draw(); return; }
    if (b.dataset.act === 'sel-all') { state.lines.forEach((l) => { l.selected = true; }); draw(); return; }
    if (b.dataset.act === 'sel-none') { state.lines.forEach((l) => { l.selected = false; }); draw(); return; }
    if (b.dataset.act === 'sel-changed') { state.lines.forEach((l) => { l.selected = l.match.status === 'new' || !l.match.candidate || Number(l.match.candidate.price) !== Number(l.price); }); draw(); return; }
    if (b.dataset.act === 'run') { await runQueue(); return; }
    if (b.dataset.act === 'apply') { applyLines(); return; }
  });

  async function runQueue() {
    state.running = true; draw();
    const prog = () => { const el = container.querySelector('#prog'); if (el) el.textContent = `${state.queue.filter((f) => ['extracted', 'error'].includes(f.status)).length} / ${state.queue.length} done`; };
    for (const f of state.queue) {
      if (f.status !== 'queued') continue;
      if (f.kind === 'sheet') { if (f.rows) { f.mapping = f.mapping || guessColumns((f.rows[f.headerRow] || []).map(String)); if (f.mapping.price && (f.mapping.code || f.mapping.name)) processSheet(f, f.mapping); else { f.status = 'needs mapping'; } } continue; }
      f.status = 'reading…'; draw();
      try {
        const r = await extractInvoice(f.file, store.settings, { onRetry: (m) => { f.status = m; draw(); } });
        const supplier = detectSupplier(r);
        const meta = { file: f.name, supplier, date: r.date || '', source: `${r.document_type === 'quotation' ? 'Q' : 'Inv'} ${r.document_number || ''}`.trim() };
        for (const ln of r.lines || []) addLine({ code: ln.code, name: ln.description, unit: ln.unit, price: ln.unit_price, qty: ln.qty }, meta);
        f.lines = (r.lines || []).length; f.status = 'extracted'; f.supplier = supplier || r.supplier_name; f.docNo = meta.source; f.notes = r.notes;
        if (!supplier) f.error = `supplier not recognised (${r.supplier_name || 'unknown'})`;
      } catch (err) { f.status = 'error'; f.error = err.message; }
      draw(); prog();
    }
    state.running = false; draw(); prog();
  }

  function applyLines() {
    const sel = state.lines.filter((l) => l.selected);
    if (!sel.length) { toast('Nothing selected'); return; }
    let applied = 0;
    const bad = sel.filter((l) => !l.applyCode.trim() || !(Number(l.price) > 0));
    if (bad.length && !window.confirm(`${bad.length} selected line(s) have no code or price and will be skipped. Continue?`)) return;
    for (const l of sel) {
      if (!l.applyCode.trim() || !(Number(l.price) > 0)) continue;
      const existing = store.prices.find((p) => p.code === l.applyCode.trim());
      store.upsertPrice({ code: l.applyCode.trim(), name: existing?.name || l.name, category: existing?.category || l.category, unit: existing?.unit || l.unit, price: Number(l.price), supplier: l.supplier || existing?.supplier || '', date: l.date || new Date().toISOString().slice(0, 10), source: l.source || 'import', ...(existing ? {} : { minArea: 0 }) });
      applied++;
    }
    const files = [...new Set(sel.map((l) => l.file))];
    files.forEach((file) => store.logImport({ file, applied: sel.filter((l) => l.file === file).length, supplier: sel.find((l) => l.file === file)?.supplier || '' }));
    state.lines = state.lines.filter((l) => !l.selected);
    toast(`${applied} price(s) updated — previous prices kept in history`);
    draw();
  }

  draw();
}
