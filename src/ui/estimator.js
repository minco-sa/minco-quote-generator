import { store } from '../store.js';
import { costUnit } from '../engine/calc.js';
import { elevationSVG } from '../engine/drawing.js';
import { CATEGORIES } from '../data/systems.js';
import { esc, money, num, mm, pct, field, navigate, toast } from './helpers.js';
import { extractOpenings, suggestSystem } from '../import/drawings.js';

// Module state so the form survives re-renders of the results pane.
const state = { systemId: null, inputs: {}, qty: 1, glassKey: '', mark: '', location: '', overrides: {}, install: true, paint: false, tab: 'cost' };

function systemOptions() {
  return CATEGORIES.map((c) => {
    const list = store.systems.filter((s) => (s.category || 'other') === c.id);
    if (!list.length) return '';
    return `<optgroup label="${esc(c.label)}">${list.map((s) => `<option value="${esc(s.id)}" ${s.id === state.systemId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`;
  }).join('');
}

function loadItem(item) {
  state.systemId = item.systemId; state.inputs = { ...item.inputs }; state.qty = item.qty || 1; state.glassKey = item.glassKey || '';
  state.mark = item.mark || ''; state.location = item.location || ''; state.overrides = { ...(item.overrides || {}) };
  state.install = item.inputs?.INSTALL !== false; state.paint = !!item.inputs?.PAINT;
}

function resetInputsFor(sys) {
  state.inputs = {};
  for (const p of sys.params || []) state.inputs[p.key] = p.default ?? '';
  state.glassKey = sys.defaultGlassKey || store.settings.defaultGlassKey || '';
}

export function renderEstimator(container, _m, query) {
  const editing = query.quote && query.item ? { quoteId: query.quote, itemId: query.item } : null;
  const targetQuote = query.quote ? store.getQuote(query.quote) : null;
  if (editing && targetQuote) {
    const it = targetQuote.items.find((x) => x.id === editing.itemId);
    if (it) loadItem(it);
  }
  if (!state.systemId || !store.getSystem(state.systemId)) {
    state.systemId = store.systems[0]?.id || null;
    if (state.systemId) resetInputsFor(store.getSystem(state.systemId));
  }
  if (!store.systems.length) { container.innerHTML = '<div class="empty">No systems defined. <a href="#/systems/new">Create one</a>.</div>'; return; }

  container.innerHTML = `
  <div class="flex"><h1 style="margin:0 0 14px">Estimator <span class="sub">take-off → cost → price per m²</span></h1><span class="spacer"></span><button class="btn" data-act="ai-draw" id="ai-draw">📐 Read openings from drawing / photo (AI)</button></div>
  <div id="ai-panel"></div>
  ${targetQuote ? `<div class="ok-note">${editing ? 'Editing item in' : 'Adding items to'} quotation <b>${esc(targetQuote.ref)}</b> — <a href="#/quotes/${targetQuote.id}">back to quotation</a></div>` : ''}
  <div class="row">
    <div class="col"><div class="card" id="form"></div></div>
    <div class="col-2" id="results"></div>
  </div>`;
  const formEl = container.querySelector('#form');
  const resEl = container.querySelector('#results');

  const renderForm = () => {
    const sys = store.getSystem(state.systemId);
    const glassOpts = store.prices.filter((p) => p.category === 'glass');
    const s = store.settings;
    formEl.innerHTML = `
      <h2>Opening</h2>
      <div class="grid">
        ${field('System', `<select class="i" data-k="systemId">${systemOptions()}</select>`)}
        <div class="sub">${sys.supplier ? `<span class="tag">supplier ${esc(sys.supplier)}</span>` : ''}${sys.family ? `<span class="tag">${esc(sys.family)}</span>` : ''}${sys.verified ? '<span class="tag" style="background:#dcfce7;color:#14532d">factory sheet</span>' : '<span class="tag" style="background:#fef3c7;color:#78350f">formulas not verified</span>'} ${esc(sys.description || '')} ${sys.mincoCode ? `<span class="tag">MINCO-${esc(sys.mincoCode)}</span>` : ''} <a href="#/systems/${sys.id}">edit system</a></div>
        ${sys.glassNote ? `<div class="warn">${esc(sys.glassNote)}</div>` : ''}
        <div class="grid c2">
          ${field('Mark / tag', `<input class="i" data-k="mark" value="${esc(state.mark)}" placeholder="W1, D2 …">`)}
          ${field('Location', `<input class="i" data-k="location" value="${esc(state.location)}" placeholder="GF living, 1F bedroom …">`)}
        </div>
        <div class="grid c2">
        ${(sys.params || []).map((p) => {
          const v = state.inputs[p.key] ?? p.default ?? '';
          if (p.type === 'select') return field(p.label, `<select class="i" data-p="${esc(p.key)}">${(p.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`);
          return field(p.label, `<input class="i" type="number" step="any" data-p="${esc(p.key)}" value="${esc(v)}">`, p.unit || '');
        }).join('')}
        </div>
        <div class="grid c2">
          ${field('Quantity', `<input class="i" type="number" min="1" step="1" data-k="qty" value="${esc(state.qty)}">`, 'units')}
          ${field('Glass specification', `<select class="i" data-k="glassKey"><option value="">— system default —</option>${glassOpts.map((g) => `<option value="${esc(g.code)}" ${g.code === state.glassKey ? 'selected' : ''}>${esc(g.name)} — ${money(g.price)}/m²</option>`).join('')}</select>`)}
        </div>
        <details class="adv"><summary>Commercial parameters (defaults from Settings)</summary>
          <div class="grid c3" style="margin-top:8px">
            ${field('Profit % on cost', `<input class="i" type="number" step="0.5" data-o="profitPct" value="${esc(state.overrides.profitPct ?? s.profitPct)}">`)}
            ${field('Overhead %', `<input class="i" type="number" step="0.5" data-o="overheadPct" value="${esc(state.overrides.overheadPct ?? s.overheadPct)}">`)}
            ${field('Aluminium waste', `<input class="i" type="number" step="0.01" data-o="wasteAluminum" value="${esc(state.overrides.wasteAluminum ?? sys.waste ?? s.wasteAluminum)}">`, 'fraction')}
            ${field('Fabrication SAR/m²', `<input class="i" type="number" step="1" data-o="fabricationPerM2" value="${esc(state.overrides.fabricationPerM2 ?? (s.labor[sys.category]?.fabricationPerM2 ?? 0))}">`)}
            ${field('Installation SAR/m²', `<input class="i" type="number" step="1" data-o="installationPerM2" value="${esc(state.overrides.installationPerM2 ?? (s.labor[sys.category]?.installationPerM2 ?? 0))}">`)}
            <label class="f"><span>Options</span><span class="flex"><label><input type="checkbox" data-k="install" ${state.install ? 'checked' : ''}> Include installation</label> <label><input type="checkbox" data-k="paint" ${state.paint ? 'checked' : ''}> Paint mill profiles</label></span></label>
          </div>
        </details>
      </div>
      <div class="actions" style="margin-top:14px">
        <button class="btn p" data-act="add">${editing ? 'Save changes to item' : 'Add to quotation'}</button>
        <button class="btn" data-act="reset">Reset inputs</button>
      </div>`;
  };

  const compute = () => {
    const sys = store.getSystem(state.systemId);
    const inputs = { ...state.inputs, INSTALL: state.install, PAINT: state.paint };
    return costUnit(sys, inputs, { priceBook: store.prices, settings: store.settings, glassPriceKey: state.glassKey || null, overrides: state.overrides });
  };

  const renderResults = () => {
    const sys = store.getSystem(state.systemId);
    let c;
    try { c = compute(); } catch (e) { resEl.innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
    const q = Math.max(1, Number(state.qty) || 1);
    const t = c.takeoff;
    const tabs = [['cost', 'Cost breakdown'], ['cut', 'Cutting list'], ['alu', 'Aluminium'], ['glass', 'Glass'], ['acc', 'Accessories'], ['vars', 'Variables']];
    let body = '';
    if (state.tab === 'cost') body = `
      <table class="t"><thead><tr><th>Component</th><th class="n">Per unit (SAR)</th><th class="n">× ${q} (SAR)</th><th class="n">SAR / m²</th><th class="n">% of cost</th></tr></thead><tbody>
        ${[['Aluminium profiles', c.aluminum.cost], ['Powder coating', c.aluminum.paintCost], ['Glass', c.glass.cost], ['Accessories & consumables', c.accessories.cost], ['Labour — fabrication', c.labor.fabrication], ['Labour — installation', c.labor.installation], [`Overhead (${pct(c.overheadPct, 0)})`, c.overhead]]
          .filter(([, v]) => v !== 0 || true).map(([l, v]) => `<tr><td>${l}</td><td class="n">${money(v)}</td><td class="n">${money(v * q)}</td><td class="n">${money(c.areaM2 ? v / c.areaM2 : 0)}</td><td class="n">${c.totalCost ? pct((v / c.totalCost) * 100, 1) : '—'}</td></tr>`).join('')}
        <tr class="total"><td>Total cost</td><td class="n">${money(c.totalCost)}</td><td class="n">${money(c.totalCost * q)}</td><td class="n">${money(c.costPerM2)}</td><td class="n">100%</td></tr>
        <tr><td>Profit (${pct(c.profitPct, 1)} on cost · margin ${pct(c.marginPct, 1)})</td><td class="n">${money(c.profit)}</td><td class="n">${money(c.profit * q)}</td><td class="n">${money(c.areaM2 ? c.profit / c.areaM2 : 0)}</td><td></td></tr>
        <tr class="total"><td>Selling price (excl. VAT)</td><td class="n">${money(c.sellingPrice)}</td><td class="n">${money(c.sellingPrice * q)}</td><td class="n">${money(c.pricePerM2)}</td><td></td></tr>
        <tr><td>VAT ${pct(c.vatPct, 0)}</td><td class="n">${money(c.vat)}</td><td class="n">${money(c.vat * q)}</td><td></td><td></td></tr>
        <tr class="total"><td>Total incl. VAT</td><td class="n">${money(c.totalWithVat)}</td><td class="n">${money(c.totalWithVat * q)}</td><td></td><td></td></tr>
      </tbody></table>`;
    else if (state.tab === 'cut') body = `
      <table class="t"><thead><tr><th>Profile</th><th>Piece</th><th class="n">Length (mm)</th><th class="n">Pcs / unit</th><th class="n">Pcs × ${q}</th></tr></thead><tbody>
        ${t.pieces.map((p) => `<tr><td><span class="mono">${esc(p.profileCode)}</span><br><span class="sub">${esc(p.profileName)}</span></td><td>${esc(p.label)}</td><td class="n"><b>${mm(p.length)}</b></td><td class="n">${p.qty}</td><td class="n">${p.qty * q}</td></tr>`).join('')}
      </tbody></table>
      <p class="sub">Rounding ${sys.rounding ?? 1} mm. Glass rounded down to 1 mm.</p>`;
    else if (state.tab === 'alu') body = `
      <table class="t"><thead><tr><th>Profile</th><th class="n">Pcs</th><th class="n">Length (m)</th><th class="n">+ waste (m)</th><th class="n">Bars (theor.)</th><th class="n">Bars (ceil)</th><th class="n">SAR / bar</th><th class="n">Cost / unit</th><th>Source</th></tr></thead><tbody>
        ${c.aluminum.lines.map((l) => `<tr><td><span class="mono">${esc(l.profileCode)}</span> ${l.missingPrice ? '<span class="tag miss">no price</span>' : ''}<br><span class="sub">${esc(l.profileName)}</span></td><td class="n">${l.pieces}</td><td class="n">${num(l.lengthM, 2)}</td><td class="n">${num(l.lengthWithWasteM, 2)}</td><td class="n">${num(l.barsTheoretical, 2)}</td><td class="n">${l.barsRounded}</td><td class="n">${money(l.pricePerBar)}</td><td class="n">${money(l.cost)}</td><td class="sub">${esc(l.supplier)} ${esc(l.priceDate)}</td></tr>`).join('')}
        <tr class="total"><td colspan="7">Aluminium per unit (priced on theoretical bars incl. ${pct(c.waste.aluminum * 100, 0)} waste)</td><td class="n">${money(c.aluminum.cost)}</td><td></td></tr>
      </tbody></table>
      <p class="sub">Whole-bar purchase quantities are computed project-wide in the shop drawings (first-fit-decreasing across all items of the quotation).</p>`;
    else if (state.tab === 'glass') body = `
      <table class="t"><thead><tr><th>Pane</th><th>Spec</th><th class="n">W × H (mm)</th><th class="n">Pcs</th><th class="n">Area m²</th><th class="n">Billed m² (min/lite + waste)</th><th class="n">SAR / m²</th><th class="n">Cost / unit</th></tr></thead><tbody>
        ${c.glass.lines.map((g) => `<tr><td>${esc(g.label)}</td><td class="sub">${esc(g.glassName)} ${g.missingPrice ? '<span class="tag miss">no price</span>' : ''}</td><td class="n"><b>${g.w} × ${g.h}</b></td><td class="n">${g.qty}</td><td class="n">${num(g.totalAreaM2, 3)}</td><td class="n">${num(g.billedAreaM2, 3)}</td><td class="n">${money(g.pricePerM2)}</td><td class="n">${money(g.cost)}</td></tr>`).join('')}
        <tr class="total"><td colspan="7">Glass per unit</td><td class="n">${money(c.glass.cost)}</td></tr>
      </tbody></table>`;
    else if (state.tab === 'acc') body = `
      <table class="t"><thead><tr><th>Code</th><th>Item</th><th class="n">Qty / unit</th><th>Unit</th><th class="n">Unit price</th><th class="n">Cost / unit</th><th>Supplier</th></tr></thead><tbody>
        ${c.accessories.lines.map((a) => `<tr><td class="mono">${esc(a.code)}</td><td>${esc(a.name)} ${a.missingPrice ? '<span class="tag miss">no price</span>' : ''}</td><td class="n">${num(a.qty, a.unit === 'pc' ? 0 : 2)}</td><td>${esc(a.unit)}</td><td class="n">${money(a.unitPrice)}</td><td class="n">${money(a.cost)}</td><td class="sub">${esc(a.supplier)}</td></tr>`).join('')}
        <tr class="total"><td colspan="5">Accessories per unit</td><td class="n">${money(c.accessories.cost)}</td><td></td></tr>
      </tbody></table>`;
    else body = `
      <table class="t"><thead><tr><th>Variable</th><th>Formula</th><th class="n">Value</th></tr></thead><tbody>
        ${(sys.params || []).map((p) => `<tr><td class="mono">${esc(p.key)}</td><td class="sub">input — ${esc(p.label)}</td><td class="n">${esc(t.vars[p.key])}</td></tr>`).join('')}
        ${(sys.constants || []).map((k) => `<tr><td class="mono">${esc(k.key)}</td><td class="sub">constant — ${esc(k.label || '')}</td><td class="n">${esc(t.vars[k.key])}</td></tr>`).join('')}
        ${(sys.variables || []).map((v) => `<tr><td class="mono">${esc(v.key)}</td><td class="mono sub">${esc(v.expr)}</td><td class="n"><b>${typeof t.vars[v.key] === 'number' ? mm(t.vars[v.key]) : esc(t.vars[v.key])}</b></td></tr>`).join('')}
        ${Object.keys(t.vars).filter((k) => !(sys.params || []).some((p) => p.key === k) && !(sys.constants || []).some((p) => p.key === k) && !(sys.variables || []).some((p) => p.key === k)).map((k) => `<tr><td class="mono">${esc(k)}</td><td class="sub">set by option</td><td class="n">${esc(t.vars[k])}</td></tr>`).join('')}
      </tbody></table>`;

    resEl.innerHTML = `
      <div class="card">
        <div class="kpis">
          <div class="kpi"><div class="l">Area / unit</div><div class="v">${num(c.areaM2, 2)} <small>m²</small></div></div>
          <div class="kpi"><div class="l">Total cost / unit</div><div class="v">${money(c.totalCost, 0)} <small>SAR</small></div></div>
          <div class="kpi hi"><div class="l">Cost per m²</div><div class="v">${money(c.costPerM2, 0)} <small>SAR</small></div></div>
          <div class="kpi hi"><div class="l">Price per m²</div><div class="v">${money(c.pricePerM2, 0)} <small>SAR</small></div></div>
          <div class="kpi"><div class="l">Selling / unit</div><div class="v">${money(c.sellingPrice, 0)} <small>SAR</small></div></div>
          <div class="kpi"><div class="l">Total × ${q} incl. VAT</div><div class="v">${money(c.totalWithVat * q, 0)} <small>SAR</small></div></div>
        </div>
        ${c.warnings.length ? `<div class="warn"><b>${c.warnings.length} warning(s)</b><ul>${c.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
        <div class="row">
          <div class="col" style="flex:1 1 260px">${elevationSVG(sys, t.vars, t.glass, { title: `${state.mark || sys.name} — ${t.vars.W} × ${t.vars.H}` })}</div>
          <div class="col-2">
            <div class="tabs">${tabs.map(([id, l]) => `<button data-tab="${id}" class="${state.tab === id ? 'active' : ''}">${l}</button>`).join('')}</div>
            <div style="overflow-x:auto">${body}</div>
          </div>
        </div>
      </div>`;
  };

  formEl.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.p) { state.inputs[el.dataset.p] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; renderResults(); }
    else if (el.dataset.o) { const v = el.value === '' ? undefined : Number(el.value); if (v === undefined) delete state.overrides[el.dataset.o]; else state.overrides[el.dataset.o] = v; renderResults(); }
    else if (el.dataset.k === 'qty') { state.qty = Number(el.value) || 1; renderResults(); }
    else if (el.dataset.k === 'mark') { state.mark = el.value; renderResults(); }
    else if (el.dataset.k === 'location') state.location = el.value;
  });
  formEl.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.k === 'systemId') { state.systemId = el.value; resetInputsFor(store.getSystem(el.value)); state.overrides = {}; renderForm(); renderResults(); }
    else if (el.dataset.k === 'glassKey') { state.glassKey = el.value; renderResults(); }
    else if (el.dataset.k === 'install') { state.install = el.checked; renderResults(); }
    else if (el.dataset.k === 'paint') { state.paint = el.checked; renderResults(); }
  });
  formEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'reset') { resetInputsFor(store.getSystem(state.systemId)); state.overrides = {}; renderForm(); renderResults(); }
    if (b.dataset.act === 'add') addToQuote(editing, targetQuote);
  });
  resEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    state.tab = b.dataset.tab; renderResults();
  });

  container.querySelector('#ai-draw').addEventListener('click', () => renderDrawingReader(container.querySelector('#ai-panel'), targetQuote));
  renderForm(); renderResults();
}

// ---------------------------------------------------------------- AI drawing reader
function renderDrawingReader(panel, targetQuote) {
  const st = { files: [], rows: [], busy: false, hint: '', notes: '' };
  const glassOpts = store.prices.filter((p) => p.category === 'glass');
  const draw = () => {
    const hasKey = !!(store.settings.aiApiKey || '').trim();
    panel.innerHTML = `<div class="card"><div class="flex"><h2 style="margin:0">Read openings from drawing / photo</h2><span class="spacer"></span><button class="btn sm" data-a="close">✕ close</button></div>
      ${!hasKey ? '<div class="warn">Add your Anthropic API key in <a href="#/settings">Settings → AI</a> first.</div>' : ''}
      <div class="grid c2" style="margin-top:8px">
        ${field('Drawing, schedule or site photo (PDF / JPG / PNG, several allowed)', '<input type="file" class="i" id="dr-files" multiple accept=".pdf,image/*">')}
        ${field('Hint for the reader (optional)', `<input class="i" id="dr-hint" placeholder="e.g. sizes are in cm; ground floor only; W1–W6 are sliding" value="${esc(st.hint)}">`)}
      </div>
      <div class="actions" style="margin-top:8px"><button class="btn p" data-a="read" ${st.busy || !hasKey ? 'disabled' : ''}>${st.busy ? 'Reading…' : 'Read with AI'}</button><span class="sub" id="dr-status"></span></div>
      ${st.rows.length ? `<p class="sub" style="margin-top:8px">Check every row against the drawing: W / H are what the reader found (mm). They are passed to the system's <b>W / H</b> inputs exactly as on your cutting sheet, so make sure they mean the same thing. ${st.notes ? 'Reader notes: ' + esc(st.notes) : ''}</p>
      <div style="overflow-x:auto"><table class="t"><thead><tr><th></th><th>Mark</th><th>Type</th><th class="n">W</th><th class="n">H</th><th class="n">FIX</th><th class="n">Qty</th><th>System</th><th>Glass</th><th>Location / notes</th><th class="n">Conf.</th></tr></thead><tbody>
        ${st.rows.map((r, i) => `<tr><td><input type="checkbox" data-sel="${i}" ${r.selected ? 'checked' : ''}></td><td><input class="i sm" data-r="mark" data-i="${i}" value="${esc(r.mark)}" style="width:60px"></td><td>${esc(r.type)}</td>
          <td class="n"><input class="i sm" type="number" data-r="W" data-i="${i}" value="${esc(r.W)}" style="width:80px"></td><td class="n"><input class="i sm" type="number" data-r="H" data-i="${i}" value="${esc(r.H)}" style="width:80px"></td><td class="n"><input class="i sm" type="number" data-r="FIX" data-i="${i}" value="${esc(r.FIX)}" style="width:70px"></td><td class="n"><input class="i sm" type="number" data-r="qty" data-i="${i}" value="${esc(r.qty)}" style="width:55px"></td>
          <td><select class="i sm" data-r="systemId" data-i="${i}"><option value="">— choose —</option>${store.systems.map((s) => `<option value="${esc(s.id)}" ${s.id === r.systemId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></td>
          <td><select class="i sm" data-r="glassKey" data-i="${i}"><option value="">default</option>${glassOpts.map((g) => `<option value="${esc(g.code)}" ${g.code === r.glassKey ? 'selected' : ''}>${esc(g.name.slice(0, 40))}</option>`).join('')}</select></td>
          <td class="sub">${esc(r.location)} ${r.notes ? '· ' + esc(r.notes) : ''}</td><td class="n" style="color:${r.confidence < 0.6 ? '#b45309' : '#16a34a'}">${Math.round(r.confidence * 100)}%</td></tr>`).join('')}
      </tbody></table></div>
      <div class="actions" style="margin-top:8px"><button class="btn ok" data-a="add">Add selected openings to quotation</button><span class="sub">${st.rows.filter((r) => r.selected).length} selected · rows without a system are skipped</span></div>` : ''}
    </div>`;
  };
  panel.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'dr-files') st.files = [...el.files];
    if (el.dataset.sel !== undefined) st.rows[Number(el.dataset.sel)].selected = el.checked;
    if (el.dataset.r) { const r = st.rows[Number(el.dataset.i)]; r[el.dataset.r] = el.type === 'number' ? Number(el.value) : el.value; }
  });
  panel.addEventListener('input', (e) => { const el = e.target; if (el.id === 'dr-hint') st.hint = el.value; if (el.dataset.r) { const r = st.rows[Number(el.dataset.i)]; r[el.dataset.r] = el.type === 'number' ? Number(el.value) : el.value; } });
  panel.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'close') { panel.innerHTML = ''; return; }
    if (b.dataset.a === 'read') {
      if (!st.files.length) { toast('Choose at least one file'); return; }
      st.busy = true; draw();
      try {
        const r = await extractOpenings(st.files, store.settings, { hint: st.hint, onRetry: (m) => { const el = panel.querySelector('#dr-status'); if (el) el.textContent = m; } });
        st.notes = [r.units_detected ? `units: ${r.units_detected}` : '', r.notes].filter(Boolean).join(' · ');
        st.rows = (r.openings || []).map((o, i) => ({ mark: o.mark || `W${i + 1}`, type: o.type, W: Math.round(o.width_mm), H: Math.round(o.height_mm), FIX: Math.round(o.fix_height_mm || 0), qty: Math.max(1, o.qty || 1), systemId: suggestSystem(o, store.systems), glassKey: '', location: o.location || '', notes: o.notes || '', confidence: o.confidence ?? 0.5, selected: true }));
        toast(`${st.rows.length} opening(s) read`);
      } catch (err) { toast(err.message, 5000); }
      st.busy = false; draw();
    }
    if (b.dataset.a === 'add') {
      const rows = st.rows.filter((r) => r.selected && r.systemId && r.W > 0 && r.H > 0);
      if (!rows.length) { toast('No complete rows selected'); return; }
      let q = targetQuote;
      if (!q) { const name = window.prompt('New quotation — project name:', '') ?? ''; q = store.newQuote({ project: { name, location: '', consultant: '', contractor: '' } }); }
      for (const r of rows) {
        const sys = store.getSystem(r.systemId);
        const inputs = {};
        for (const p of sys.params || []) inputs[p.key] = p.default;
        inputs.W = r.W; inputs.H = r.H;
        if ((sys.params || []).some((p) => p.key === 'FIX')) inputs.FIX = r.FIX || sys.params.find((p) => p.key === 'FIX').default;
        if ((sys.params || []).some((p) => p.key === 'TOP')) inputs.TOP = r.FIX || 0;
        inputs.INSTALL = true; inputs.PAINT = false;
        q.items.push({ id: Math.random().toString(36).slice(2, 10), mark: r.mark, location: r.location, systemId: sys.id, systemName: sys.name, inputs, qty: r.qty, glassKey: r.glassKey || '', overrides: {}, snapshot: {} });
      }
      store.saveQuote(q); toast(`${rows.length} opening(s) added to ${q.ref}`); navigate(`#/quotes/${q.id}`);
    }
  });
  draw();
}

function addToQuote(editing, targetQuote) {
  const sys = store.getSystem(state.systemId);
  let c;
  try { c = costUnit(sys, { ...state.inputs, INSTALL: state.install, PAINT: state.paint }, { priceBook: store.prices, settings: store.settings, glassPriceKey: state.glassKey || null, overrides: state.overrides }); }
  catch (e) { toast(`Cannot add: ${e.message}`); return; }
  if (c.takeoff.pieces.length === 0) { toast('Nothing to add — the take-off produced no pieces'); return; }
  const item = {
    id: editing?.itemId || Math.random().toString(36).slice(2, 10),
    mark: state.mark || '', location: state.location || '', systemId: state.systemId, systemName: sys.name,
    inputs: { ...state.inputs, INSTALL: state.install, PAINT: state.paint }, qty: Math.max(1, Number(state.qty) || 1),
    glassKey: state.glassKey || '', overrides: { ...state.overrides },
    // snapshot for quick listing (recomputed live on the quotation page)
    snapshot: { areaM2: c.areaM2, unitPrice: c.sellingPrice, unitCost: c.totalCost, pricePerM2: c.pricePerM2 },
  };
  let q = targetQuote;
  if (!q) {
    const drafts = store.quotes.filter((x) => x.status === 'draft');
    if (drafts.length) {
      const pick = window.prompt(`Add to which quotation?\n${drafts.map((d, i) => `${i + 1}. ${d.ref} — ${d.project.name || '(no project)'}`).join('\n')}\n\nEnter a number, or 0 for a NEW quotation:`, '0');
      if (pick === null) return;
      const n = parseInt(pick, 10);
      if (n > 0 && drafts[n - 1]) q = drafts[n - 1];
    }
    if (!q) {
      const name = window.prompt('New quotation — project name:', '') ?? '';
      q = store.newQuote({ project: { name, location: '', consultant: '', contractor: '' } });
    }
  }
  if (!item.mark) item.mark = `${sys.category === 'door' ? 'D' : sys.category === 'curtain_wall' ? 'CW' : 'W'}${q.items.length + 1}`;
  if (editing) { const i = q.items.findIndex((x) => x.id === editing.itemId); if (i >= 0) q.items[i] = item; else q.items.push(item); }
  else q.items.push(item);
  store.saveQuote(q);
  toast(`${editing ? 'Updated' : 'Added'} ${item.mark} in ${q.ref}`);
  navigate(`#/quotes/${q.id}`);
}
