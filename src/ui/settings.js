import { store } from '../store.js';
import { CATEGORIES } from '../data/systems.js';
import { esc, field, input, bindPaths, download, readFile, toast, confirmDialog } from './helpers.js';

export function renderSettings(container) {
  const s = store.settings;
  const glass = store.prices.filter((p) => p.category === 'glass');
  container.innerHTML = `
    <h1>Settings</h1>
    <div class="row"><div class="col">
      <div class="card"><h2>Company (printed on quotations)</h2><div class="grid">
        ${field('Name', input('company.name', s.company.name))}${field('Tagline', input('company.tagline', s.company.tagline))}${field('Address', input('company.address', s.company.address))}
        <div class="grid c3">${field('Phone', input('company.phone', s.company.phone))}${field('Email', input('company.email', s.company.email))}${field('Web', input('company.web', s.company.web))}</div>
        <div class="grid c2">${field('Signatory', input('company.signatory', s.company.signatory))}${field('Reference prefix', input('company.refPrefix', s.company.refPrefix))}</div>
      </div></div>
      <div class="card"><h2>Commercial defaults</h2><div class="grid c3">
        ${field('Profit % on cost', input('profitPct', s.profitPct, { type: 'number', step: 0.5 }))}
        ${field('Overhead %', input('overheadPct', s.overheadPct, { type: 'number', step: 0.5 }))}
        ${field('VAT %', input('vatPct', s.vatPct, { type: 'number', step: 0.5 }))}
        ${field('Validity days', input('validityDays', s.validityDays, { type: 'number' }))}
        ${field('Currency', input('currency', s.currency))}
        ${field('Default glass', `<select class="i" data-path="defaultGlassKey">${glass.map((g) => `<option value="${esc(g.code)}" ${g.code === s.defaultGlassKey ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>`)}
      </div></div>
      <div class="card"><h2>Waste, stock & painting</h2><div class="grid c3">
        ${field('Aluminium waste', input('wasteAluminum', s.wasteAluminum, { type: 'number', step: 0.01 }), 'fraction')}
        ${field('Glass waste', input('wasteGlass', s.wasteGlass, { type: 'number', step: 0.01 }), 'fraction')}
        ${field('Accessories waste', input('wasteAccessories', s.wasteAccessories, { type: 'number', step: 0.01 }), 'fraction')}
        ${field('Stock bar length', input('barLength', s.barLength, { type: 'number', step: 100 }), 'mm')}
        ${field('Saw kerf', input('kerf', s.kerf, { type: 'number' }), 'mm')}
        ${field('End trim per bar end', input('endTrim', s.endTrim, { type: 'number' }), 'mm')}
        ${field('Powder coating', input('paintingPerKg', s.paintingPerKg, { type: 'number', step: 0.05 }), 'SAR / kg')}
      </div></div>
    </div><div class="col">
      <div class="card"><h2>Labour rates per category <span class="sub">(SAR — defaults are assumptions, set your factory figures)</span></h2>
        <table class="t"><thead><tr><th>Category</th><th class="n">Fabrication / m²</th><th class="n">Installation / m²</th><th class="n">Fixed / unit</th></tr></thead><tbody>
          ${CATEGORIES.map((c) => `<tr><td>${esc(c.label)}</td><td class="n">${input(`labor.${c.id}.fabricationPerM2`, s.labor[c.id]?.fabricationPerM2 ?? 0, { type: 'number', cls: 'i sm' })}</td><td class="n">${input(`labor.${c.id}.installationPerM2`, s.labor[c.id]?.installationPerM2 ?? 0, { type: 'number', cls: 'i sm' })}</td><td class="n">${input(`labor.${c.id}.fixedPerUnit`, s.labor[c.id]?.fixedPerUnit ?? 0, { type: 'number', cls: 'i sm' })}</td></tr>`).join('')}
        </tbody></table></div>
      <div class="card"><h2>Terms & conditions (one per line)</h2><textarea class="i" id="terms" style="min-height:160px;font-family:inherit">${esc((s.terms || []).join('\n'))}</textarea></div>
      <div class="card"><h2>Integrations</h2><div class="grid">
        ${field('Webhook URL (n8n / Make / Odoo controller) — receives the quotation JSON on "Push to webhook"', input('webhookUrl', s.webhookUrl, { placeholder: 'https://n8n.example.com/webhook/minco-quote' }))}
        ${field('Webhook secret header (X-Webhook-Secret)', input('webhookSecret', s.webhookSecret))}
        <p class="sub">Payload: <span class="mono">{ event, ref, status, client, project, totals, items[ {takeoff, unit breakdown} ], odoo.sale_order_lines[] }</span>. Shop-drawing export adds <span class="mono">mrp.bom_lines[]</span>.</p>
      </div></div>
      <div class="card"><h2>Backup & library</h2><div class="actions">
        <button class="btn" data-act="export">Download full backup (JSON)</button><button class="btn" data-act="import">Restore backup</button>
        <button class="btn" data-act="reset-sys">Reset systems to defaults</button><button class="btn bad" data-act="wipe">Erase everything</button></div>
        <p class="sub">Data is stored in this browser (localStorage). Download a backup regularly, or push quotations to your webhook.</p></div>
    </div></div>`;
  bindPaths(container, s, () => store.save('settings'));
  container.querySelector('#terms').addEventListener('input', (e) => { s.terms = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); store.save('settings'); });
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'export') download(`minco-estimator-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll(), null, 2));
    if (b.dataset.act === 'import') { try { const { text } = await readFile('.json'); if (!confirmDialog('Restore this backup? Current data will be replaced.')) return; store.importAll(JSON.parse(text)); toast('Backup restored'); location.reload(); } catch (err) { toast(`Restore failed: ${err.message}`); } }
    if (b.dataset.act === 'reset-sys') { if (!confirmDialog('Replace all systems with the built-in library? Custom systems will be lost (export a backup first).')) return; store.resetSystems(); toast('Systems reset'); }
    if (b.dataset.act === 'wipe') { if (!confirmDialog('Erase ALL quotations, systems, prices and settings from this browser?')) return; Object.keys(localStorage).filter((k) => k.startsWith('minco.estimator')).forEach((k) => localStorage.removeItem(k)); location.reload(); }
  });
}
