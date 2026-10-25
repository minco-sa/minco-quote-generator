import { store } from '../store.js';
import { takeoff } from '../engine/calc.js';
import { elevationSVG } from '../engine/drawing.js';
import { CATEGORIES } from '../data/systems.js';
import { esc, mm, num, field, input, select, setPath, download, readFile, toast, navigate, confirmDialog } from './helpers.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const FINISHES = ['black', 'mill', 'bronze', 'white', 'champagne', 'other'];
const DRAW_TYPES = [['sliding', 'Sliding (pattern of S/F panels, optional top light)'], ['fixed', 'Fixed (optional columns)'], ['hung', 'Top-hung over fixed'], ['door', 'Hinged door (leaves)'], ['grid', 'Grid — curtain wall / skylight (cols × rows)'], ['blank', 'Plain rectangle']];

function newSystemTemplate() {
  return {
    id: `SYSTEM_${Date.now().toString(36).toUpperCase()}`, name: 'New system', nameAr: '', category: 'sliding', mincoCode: '', description: '',
    barLength: store.settings.barLength || 6000, waste: store.settings.wasteAluminum ?? 0.05, rounding: 1, defaultGlassKey: store.settings.defaultGlassKey || '',
    constants: [],
    params: [
      { key: 'W', label: 'Opening width', unit: 'mm', type: 'number', default: 1200 },
      { key: 'H', label: 'Opening height', unit: 'mm', type: 'number', default: 1200 },
    ],
    variables: [{ key: 'FW', label: 'Frame width', expr: 'W' }, { key: 'FH', label: 'Frame height', expr: 'H' }, { key: 'GW', label: 'Glass width', expr: 'W - 100' }, { key: 'GH', label: 'Glass height', expr: 'H - 100' }],
    profiles: [{ code: '', name: 'Frame', finish: 'black', pieces: [{ label: 'Head / sill', length: 'FW', qty: '2' }, { label: 'Jamb', length: 'FH', qty: '2' }] }],
    glass: [{ label: 'Glass', width: 'GW', height: 'GH', qty: '1' }],
    accessories: [{ code: '564416', name: 'Silicone', unit: 'pc', qty: 'ceil(2 * (W + H) / 1000 / 8)' }],
    drawing: { type: 'fixed', cols: '1' },
  };
}

// ------------------------------------------------------------------ list
export function renderSystems(container) {
  container.innerHTML = `
    <div class="flex" style="margin-bottom:12px"><h1 style="margin:0">Systems library</h1><span class="sub">each system = parametric rules for cut lengths, glass, accessories and drawing</span><span class="spacer"></span>
      <button class="btn" data-act="import">Import JSON</button><a class="btn p" href="#/systems/new">+ New system</a></div>
    ${CATEGORIES.map((c) => { const list = store.systems.filter((s) => (s.category || 'other') === c.id); if (!list.length) return ''; return `<h3 style="margin:14px 0 8px">${esc(c.label)}</h3><div class="grid c2">${list.map((s) => `
      <div class="sys-card"><h3>${esc(s.name)} ${s.mincoCode ? `<span class="tag">MINCO-${esc(s.mincoCode)}</span>` : ''}</h3><div class="sub">${esc(s.nameAr || '')} · <span class="mono">${esc(s.id)}</span></div>
        <p class="sub" style="margin:6px 0">${esc(s.description || '')}</p>
        <div class="sub">${(s.params || []).length} params · ${(s.variables || []).length} variables · ${(s.profiles || []).length} profiles / ${(s.profiles || []).reduce((a, p) => a + (p.pieces || []).length, 0)} pieces · ${(s.glass || []).length} glass · ${(s.accessories || []).length} accessories</div>
        <div class="actions" style="margin-top:8px"><a class="btn sm p" href="#/systems/${esc(s.id)}">Edit</a><a class="btn sm" href="#/estimator">Estimate</a><button class="btn sm" data-dup="${esc(s.id)}">Duplicate</button><button class="btn sm" data-exp="${esc(s.id)}">Export JSON</button><button class="btn sm bad" data-del="${esc(s.id)}">Delete</button></div></div>`).join('')}</div>`; }).join('')}
    <div class="card" style="margin-top:16px"><h2>How a system is defined</h2>
      <ol class="sub" style="padding-left:18px"><li><b>Params</b> — what the estimator asks for (W, H, configuration selects…). A select option can <i>set</i> helper variables (e.g. NS=2, NF=0, PATTERN=SS).</li>
      <li><b>Constants</b> — the deductions of the profile system (Kw, Dh, Dg, sightline…) so a new system only needs new numbers.</li>
      <li><b>Variables</b> — formulas evaluated in order: <span class="mono">SIDE = H - 66</span>, <span class="mono">TB = pick(CFG, '2', W/2 - 93, '3_SSS', W/3 - 102, 0)</span>, <span class="mono">if(TOP &gt; 0, …, …)</span>. Functions: ceil floor round max min abs sqrt if pick.</li>
      <li><b>Profiles</b> — each profile (price-book code) with its cut pieces: label, length formula, quantity formula per unit.</li>
      <li><b>Glass</b> and <b>accessories</b> — formulas for sizes and quantities; prices come from the price book.</li>
      <li><b>Drawing</b> — which elevation template to draw and which variables drive it.</li></ol></div>`;
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.dup) { const s = clone(store.getSystem(b.dataset.dup)); s.id = `${s.id}_COPY`; s.name = `${s.name} (copy)`; while (store.getSystem(s.id)) s.id += '_1'; store.upsertSystem(s); navigate(`#/systems/${s.id}`); }
    else if (b.dataset.exp) { const s = store.getSystem(b.dataset.exp); download(`${s.id}.system.json`, JSON.stringify(s, null, 2)); }
    else if (b.dataset.del) { const used = store.quotes.filter((q) => q.items.some((i) => i.systemId === b.dataset.del)).length; if (!confirmDialog(`Delete system ${b.dataset.del}?${used ? ` It is used in ${used} quotation(s) which will then show errors.` : ''}`)) return; store.deleteSystem(b.dataset.del); renderSystems(container); }
    else if (b.dataset.act === 'import') { try { const { text } = await readFile('.json'); const data = JSON.parse(text); const list = Array.isArray(data) ? data : [data]; let n = 0; for (const s of list) { if (!s.id || !s.name) continue; if (store.getSystem(s.id) && !confirmDialog(`System ${s.id} exists — overwrite?`)) continue; store.upsertSystem(s); n++; } toast(`Imported ${n} system(s)`); renderSystems(container); } catch (err) { toast(`Import failed: ${err.message}`); } }
  });
}

// ------------------------------------------------------------------ editor
export function renderSystemEditor(container, id) {
  const existing = id ? store.getSystem(id) : null;
  if (id && !existing) { container.innerHTML = '<div class="err">System not found.</div>'; return; }
  const draft = existing ? clone(existing) : newSystemTemplate();
  draft.constants ||= []; draft.params ||= []; draft.variables ||= []; draft.profiles ||= []; draft.glass ||= []; draft.accessories ||= []; draft.drawing ||= { type: 'fixed' };
  const ui = { tab: 'params', test: {} };
  for (const p of draft.params) ui.test[p.key] = p.default;
  const profileCodes = store.prices.filter((p) => p.category === 'profile');
  const accCodes = store.prices.filter((p) => p.category !== 'profile' && p.category !== 'glass');
  const glassCodes = store.prices.filter((p) => p.category === 'glass');

  const setStr = (o) => Object.entries(o || {}).map(([k, v]) => `${k}=${v}`).join(', ');
  const parseSet = (s) => { const o = {}; for (const part of String(s).split(',')) { const [k, v] = part.split('=').map((x) => x && x.trim()); if (k) o[k] = v === undefined ? 1 : (v !== '' && !isNaN(Number(v)) ? Number(v) : v); } return o; };

  const rowBtns = (path, i) => `<td style="white-space:nowrap"><button class="btn sm ghost" data-move="${path}" data-i="${i}" data-dir="-1" title="up">↑</button><button class="btn sm ghost" data-move="${path}" data-i="${i}" data-dir="1" title="down">↓</button><button class="btn sm bad" data-rm="${path}" data-i="${i}">✕</button></td>`;

  const tabHTML = () => {
    switch (ui.tab) {
      case 'general': return `<div class="grid c2">
        ${field('System ID (unique, no spaces)', input('id', draft.id))}${field('Name', input('name', draft.name))}${field('Arabic name', input('nameAr', draft.nameAr || ''))}
        ${field('Category', select('category', draft.category, CATEGORIES.map((c) => ({ value: c.id, label: c.label }))))}
        ${field('MINCO code (catalogue)', input('mincoCode', draft.mincoCode || '', { placeholder: 'SL94, HW52, CW50 …' }))}
        ${field('Default glass', select('defaultGlassKey', draft.defaultGlassKey || '', [{ value: '', label: '— settings default —' }, ...glassCodes.map((g) => ({ value: g.code, label: g.name }))]))}
        ${field('Stock bar length', input('barLength', draft.barLength, { type: 'number' }), 'mm')}${field('Aluminium waste', input('waste', draft.waste, { type: 'number', step: 0.01 }), 'fraction')}${field('Cut rounding', input('rounding', draft.rounding ?? 1, { type: 'number', step: 0.5 }), 'mm')}
        </div>${field('Description / source of deductions', `<textarea class="i" data-path="description" style="font-family:inherit">${esc(draft.description || '')}</textarea>`)}`;
      case 'params': return `<p class="sub">Inputs asked in the Estimator. Keep <b>W</b> and <b>H</b> (opening size in mm) — area and labour use them. Select options may set helper variables, e.g. <span class="mono">NS=2, NF=0, PATTERN=SS</span>.</p>
        <table class="t"><thead><tr><th>Key</th><th>Label</th><th>Type</th><th>Unit</th><th>Default</th><th></th></tr></thead><tbody>
        ${draft.params.map((p, i) => `<tr><td>${input(`params.${i}.key`, p.key, { cls: 'i sm' })}</td><td>${input(`params.${i}.label`, p.label, { cls: 'i sm' })}</td><td>${select(`params.${i}.type`, p.type || 'number', [{ value: 'number', label: 'number' }, { value: 'select', label: 'select' }], { cls: 'i sm' })}</td><td>${input(`params.${i}.unit`, p.unit || '', { cls: 'i sm' })}</td><td>${input(`params.${i}.default`, p.default ?? '', { cls: 'i sm' })}</td>${rowBtns('params', i)}</tr>
          ${p.type === 'select' ? `<tr><td></td><td colspan="5"><div class="sub-card"><b class="sub">Options for ${esc(p.key)}</b><table class="t"><thead><tr><th>Value</th><th>Label</th><th>Sets (K=v, K=v)</th><th></th></tr></thead><tbody>
            ${(p.options || []).map((o, j) => `<tr><td>${input(`params.${i}.options.${j}.value`, o.value, { cls: 'i sm' })}</td><td>${input(`params.${i}.options.${j}.label`, o.label, { cls: 'i sm' })}</td><td><input class="i sm" data-set="params.${i}.options.${j}.set" value="${esc(setStr(o.set))}"></td><td><button class="btn sm bad" data-rm="params.${i}.options" data-i="${j}">✕</button></td></tr>`).join('')}
          </tbody></table><button class="btn sm" data-add="params.${i}.options" data-tpl="option">+ option</button></div></td></tr>` : ''}`).join('')}
        </tbody></table><button class="btn sm" data-add="params" data-tpl="param">+ parameter</button>
        <h3 style="margin-top:16px">Constants <span class="sub">(system deductions — numbers only)</span></h3>
        <table class="t"><thead><tr><th>Key</th><th>Label</th><th>Value</th><th></th></tr></thead><tbody>
        ${draft.constants.map((c, i) => `<tr><td>${input(`constants.${i}.key`, c.key, { cls: 'i sm' })}</td><td>${input(`constants.${i}.label`, c.label || '', { cls: 'i sm' })}</td><td>${input(`constants.${i}.value`, c.value, { type: 'number', step: 'any', cls: 'i sm' })}</td>${rowBtns('constants', i)}</tr>`).join('')}
        </tbody></table><button class="btn sm" data-add="constants" data-tpl="constant">+ constant</button>`;
      case 'variables': return `<p class="sub">Evaluated top to bottom; each may use params, constants, option-set helpers and earlier variables.</p>
        <table class="t"><thead><tr><th style="width:110px">Key</th><th style="width:180px">Label</th><th>Formula</th><th class="n">Test value</th><th></th></tr></thead><tbody>
        ${draft.variables.map((v, i) => `<tr><td>${input(`variables.${i}.key`, v.key, { cls: 'i sm mono' })}</td><td>${input(`variables.${i}.label`, v.label || '', { cls: 'i sm' })}</td><td>${input(`variables.${i}.expr`, v.expr, { cls: 'i sm mono' })}</td><td class="n mono" data-testvar="${esc(v.key)}"></td>${rowBtns('variables', i)}</tr>`).join('')}
        </tbody></table><button class="btn sm" data-add="variables" data-tpl="variable">+ variable</button>`;
      case 'profiles': return `<p class="sub">One card per aluminium profile. Code should match a price-book item (unit: bar). Each piece: label, length formula, quantity formula per unit.</p>
        ${draft.profiles.map((pr, i) => `<div class="sub-card"><div class="grid c4">
          ${field('Price-book code', `<input class="i sm mono" list="profile-codes" data-path="profiles.${i}.code" value="${esc(pr.code || '')}">`)}
          ${field('Name', input(`profiles.${i}.name`, pr.name || '', { cls: 'i sm' }))}
          ${field('Finish', select(`profiles.${i}.finish`, pr.finish || 'black', FINISHES.map((f) => ({ value: f, label: f })), { cls: 'i sm' }))}
          ${field('Weight kg/m (for painting)', input(`profiles.${i}.weightKgM`, pr.weightKgM || '', { type: 'number', step: 0.001, cls: 'i sm' }))}
          </div>
          <table class="t" style="margin-top:6px"><thead><tr><th>Piece</th><th>Length formula</th><th>Qty formula</th><th class="n">Test</th><th></th></tr></thead><tbody>
          ${(pr.pieces || []).map((pc, j) => `<tr><td>${input(`profiles.${i}.pieces.${j}.label`, pc.label, { cls: 'i sm' })}</td><td>${input(`profiles.${i}.pieces.${j}.length`, pc.length, { cls: 'i sm mono' })}</td><td>${input(`profiles.${i}.pieces.${j}.qty`, pc.qty, { cls: 'i sm mono' })}</td><td class="n mono" data-testpiece="${i}.${j}"></td><td><button class="btn sm bad" data-rm="profiles.${i}.pieces" data-i="${j}">✕</button></td></tr>`).join('')}
          </tbody></table><div class="actions" style="margin-top:6px"><button class="btn sm" data-add="profiles.${i}.pieces" data-tpl="piece">+ piece</button><span class="spacer"></span><button class="btn sm bad" data-rm="profiles" data-i="${i}">remove profile</button></div></div>`).join('')}
        <button class="btn sm" data-add="profiles" data-tpl="profile">+ profile</button>
        <datalist id="profile-codes">${profileCodes.map((p) => `<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('')}</datalist>`;
      case 'glass': return `<table class="t"><thead><tr><th>Pane label</th><th>Width formula</th><th>Height formula</th><th>Qty formula</th><th>Glass price key (blank = item/system default)</th><th class="n">Test</th><th></th></tr></thead><tbody>
        ${draft.glass.map((g, i) => `<tr><td>${input(`glass.${i}.label`, g.label, { cls: 'i sm' })}</td><td>${input(`glass.${i}.width`, g.width, { cls: 'i sm mono' })}</td><td>${input(`glass.${i}.height`, g.height, { cls: 'i sm mono' })}</td><td>${input(`glass.${i}.qty`, g.qty, { cls: 'i sm mono' })}</td><td>${select(`glass.${i}.priceKey`, g.priceKey || '', [{ value: '', label: '— default —' }, ...glassCodes.map((x) => ({ value: x.code, label: x.name }))], { cls: 'i sm' })}</td><td class="n mono" data-testglass="${i}"></td>${rowBtns('glass', i)}</tr>`).join('')}
        </tbody></table><button class="btn sm" data-add="glass" data-tpl="glass">+ glass pane</button>`;
      case 'accessories': return `<table class="t"><thead><tr><th>Price-book code</th><th>Name</th><th>Unit</th><th>Qty formula (per unit)</th><th class="n">Test</th><th></th></tr></thead><tbody>
        ${draft.accessories.map((a, i) => `<tr><td><input class="i sm mono" list="acc-codes" data-path="accessories.${i}.code" value="${esc(a.code || '')}"></td><td>${input(`accessories.${i}.name`, a.name, { cls: 'i sm' })}</td><td>${select(`accessories.${i}.unit`, a.unit || 'pc', ['pc', 'm', 'm2', 'kg', 'roll', 'set'].map((u) => ({ value: u, label: u })), { cls: 'i sm' })}</td><td>${input(`accessories.${i}.qty`, a.qty, { cls: 'i sm mono' })}</td><td class="n mono" data-testacc="${i}"></td>${rowBtns('accessories', i)}</tr>`).join('')}
        </tbody></table><button class="btn sm" data-add="accessories" data-tpl="accessory">+ accessory</button>
        <datalist id="acc-codes">${accCodes.map((p) => `<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('')}</datalist>`;
      case 'drawing': return `<div class="grid c2">${field('Elevation template', select('drawing.type', draft.drawing.type || 'fixed', DRAW_TYPES.map(([v, l]) => ({ value: v, label: l }))))}
        ${field('Pattern (sliding) — variable or literal like \'SFS\'', input('drawing.pattern', draft.drawing.pattern || '', { cls: 'i mono', placeholder: 'PATTERN' }))}
        ${field('Top light height (sliding) — variable', input('drawing.top', draft.drawing.top || '', { cls: 'i mono', placeholder: 'TOP' }))}
        ${field('Columns (fixed / grid)', input('drawing.cols', draft.drawing.cols || '', { cls: 'i mono', placeholder: 'COLS or NCOL' }))}
        ${field('Rows (grid)', input('drawing.rows', draft.drawing.rows || '', { cls: 'i mono', placeholder: 'NROW' }))}
        ${field('Leaves (door)', input('drawing.leaves', draft.drawing.leaves || '', { cls: 'i mono', placeholder: 'NLEAF' }))}</div>`;
      case 'json': return `<p class="sub">Full definition. Edit and apply, or copy to share / version in git.</p><textarea class="i" id="json" style="min-height:420px">${esc(JSON.stringify(draft, null, 2))}</textarea><div class="actions" style="margin-top:8px"><button class="btn" data-act="apply-json">Apply JSON</button></div>`;
      default: return '';
    }
  };

  const draw = () => {
    container.innerHTML = `
      <div class="flex" style="margin-bottom:12px"><a href="#/systems">← Systems</a><span class="spacer"></span><button class="btn" data-act="export">Export JSON</button><button class="btn p" data-act="save">Save system</button></div>
      <h1>${existing ? 'Edit' : 'New'} system — ${esc(draft.name)}</h1>
      <div class="row"><div class="col-2"><div class="card">
        <div class="tabs">${[['general', 'General'], ['params', 'Params & constants'], ['variables', 'Variables'], ['profiles', 'Profiles & cuts'], ['glass', 'Glass'], ['accessories', 'Accessories'], ['drawing', 'Drawing'], ['json', 'JSON']].map(([k, l]) => `<button data-tab="${k}" class="${ui.tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>
        <div id="tab" style="overflow-x:auto">${tabHTML()}</div></div></div>
      <div class="col"><div class="card"><h2>Live test</h2><div class="grid c2" id="testform">
        ${draft.params.map((p) => p.type === 'select' ? field(p.label || p.key, `<select class="i sm" data-test="${esc(p.key)}">${(p.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(ui.test[p.key]) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`) : field(p.label || p.key, `<input class="i sm" type="number" step="any" data-test="${esc(p.key)}" value="${esc(ui.test[p.key] ?? '')}">`, p.unit || '')).join('')}
        </div><div id="testout" style="margin-top:10px"></div></div></div></div>`;
    runTest();
  };

  const runTest = () => {
    const out = container.querySelector('#testout'); if (!out) return;
    let t;
    try { t = takeoff(draft, ui.test); } catch (e) { out.innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
    out.innerHTML = `${t.warnings.length ? `<div class="warn"><ul>${t.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '<div class="ok-note">No errors — formulas evaluate.</div>'}
      ${elevationSVG(draft, t.vars, t.glass, { title: `${t.vars.W} × ${t.vars.H}` })}
      <table class="t" style="margin-top:8px"><thead><tr><th>Piece</th><th class="n">Length</th><th class="n">Qty</th></tr></thead><tbody>${t.pieces.map((p) => `<tr><td><span class="sub">${esc(p.profileName)}</span> ${esc(p.label)}</td><td class="n">${mm(p.length)}</td><td class="n">${p.qty}</td></tr>`).join('')}
      ${t.glass.map((g) => `<tr><td><span class="sub">glass</span> ${esc(g.label)}</td><td class="n">${g.w} × ${g.h}</td><td class="n">${g.qty}</td></tr>`).join('')}</tbody></table>`;
    // inline test values in the tables
    container.querySelectorAll('[data-testvar]').forEach((td) => { const v = t.vars[td.dataset.testvar]; td.textContent = typeof v === 'number' ? mm(v) : (v ?? '—'); });
    container.querySelectorAll('[data-testpiece]').forEach((td) => { const [i, j] = td.dataset.testpiece.split('.').map(Number); const pr = draft.profiles[i], pc = pr?.pieces?.[j]; const hit = t.pieces.find((p) => p.profileName === pr?.name && p.label === pc?.label); td.textContent = hit ? `${mm(hit.length)} × ${hit.qty}` : '0'; });
    container.querySelectorAll('[data-testglass]').forEach((td) => { const g = t.glass.find((x) => x.label === draft.glass[Number(td.dataset.testglass)]?.label); td.textContent = g ? `${g.w} × ${g.h} × ${g.qty}` : '0'; });
    container.querySelectorAll('[data-testacc]').forEach((td) => { const a = t.accessories.find((x) => x.name === draft.accessories[Number(td.dataset.testacc)]?.name); td.textContent = a ? num(a.qty, 2) : '0'; });
  };

  const TEMPLATES = { param: { key: 'X', label: 'New parameter', type: 'number', unit: 'mm', default: 0 }, option: { value: 'opt', label: 'Option', set: {} }, constant: { key: 'K', label: '', value: 0 }, variable: { key: 'V', label: '', expr: '0' }, profile: { code: '', name: 'Profile', finish: 'black', pieces: [{ label: 'Piece', length: 'W', qty: '1' }] }, piece: { label: 'Piece', length: 'W', qty: '1' }, glass: { label: 'Glass', width: 'GW', height: 'GH', qty: '1' }, accessory: { code: '', name: 'Accessory', unit: 'pc', qty: '1' } };

  container.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.path) { let v = el.value; if (el.dataset.type === 'number' || el.type === 'number') v = v === '' ? '' : Number(v); setPath(draft, el.dataset.path, v); if (el.dataset.path.startsWith('params.') && el.dataset.path.endsWith('.default')) { const i = Number(el.dataset.path.split('.')[1]); ui.test[draft.params[i].key] = v; } runTest(); }
    else if (el.dataset.set) { setPath(draft, el.dataset.set, parseSet(el.value)); runTest(); }
    else if (el.dataset.test) { ui.test[el.dataset.test] = el.type === 'number' ? Number(el.value) : el.value; runTest(); }
  });
  container.addEventListener('change', (e) => { const el = e.target; if (el.dataset.path && (el.tagName === 'SELECT')) { setPath(draft, el.dataset.path, el.value); if (el.dataset.path.endsWith('.type')) draw(); else runTest(); } });
  container.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) { ui.tab = b.dataset.tab; draw(); return; }
    if (b.dataset.add) { const arr = b.dataset.add.split('.').reduce((o, k) => o[k], draft); arr.push(clone(TEMPLATES[b.dataset.tpl])); if (b.dataset.tpl === 'param') ui.test.X = 0; draw(); return; }
    if (b.dataset.rm) { const arr = b.dataset.rm.split('.').reduce((o, k) => o[k], draft); arr.splice(Number(b.dataset.i), 1); draw(); return; }
    if (b.dataset.move) { const arr = b.dataset.move.split('.').reduce((o, k) => o[k], draft); const i = Number(b.dataset.i), j = i + Number(b.dataset.dir); if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; draw(); return; }
    if (b.dataset.act === 'apply-json') { try { const d = JSON.parse(container.querySelector('#json').value); Object.keys(draft).forEach((k) => delete draft[k]); Object.assign(draft, d); draft.constants ||= []; draft.params ||= []; draft.variables ||= []; draft.profiles ||= []; draft.glass ||= []; draft.accessories ||= []; draft.drawing ||= { type: 'fixed' }; toast('JSON applied — remember to Save'); draw(); } catch (err) { toast(`Invalid JSON: ${err.message}`); } return; }
    if (b.dataset.act === 'export') { download(`${draft.id}.system.json`, JSON.stringify(draft, null, 2)); return; }
    if (b.dataset.act === 'save') {
      const errors = [];
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(draft.id || '')) errors.push('ID must be letters, digits, underscore');
      if (!draft.name) errors.push('Name is required');
      if (!existing && store.getSystem(draft.id)) errors.push(`ID ${draft.id} already exists`);
      if (existing && draft.id !== existing.id && store.getSystem(draft.id)) errors.push(`ID ${draft.id} already exists`);
      for (const p of draft.params) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(p.key)) errors.push(`Bad param key "${p.key}"`);
      for (const v of draft.variables) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.key)) errors.push(`Bad variable key "${v.key}"`);
      if (!draft.params.some((p) => p.key === 'W') || !draft.params.some((p) => p.key === 'H')) errors.push('Params must include W and H');
      const t = takeoff(draft, ui.test); errors.push(...t.warnings.map((w) => `Test: ${w}`));
      if (errors.length && !confirmDialog(`Problems found:\n- ${errors.join('\n- ')}\n\nSave anyway?`)) return;
      if (existing && draft.id !== existing.id) { store.deleteSystem(existing.id); store.quotes.forEach((q) => q.items.forEach((it) => { if (it.systemId === existing.id) it.systemId = draft.id; })); store.save('quotes'); }
      store.upsertSystem(clone(draft)); toast('System saved'); navigate('#/systems');
    }
  });
  draw();
}
