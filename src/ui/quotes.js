import { store } from '../store.js';
import { costQuote, costItem } from '../engine/calc.js';
import { elevationSVG } from '../engine/drawing.js';
import { QUOTE_STATUSES } from '../data/settings.js';
import { esc, money, num, pct, field, navigate, toast, download, toCSV, bindPaths, confirmDialog } from './helpers.js';

const statusOf = (id) => QUOTE_STATUSES.find((s) => s.id === id) || QUOTE_STATUSES[0];
export const badge = (id) => { const s = statusOf(id); return `<span class="badge" style="background:${s.color}">${esc(s.label)}</span>`; };
const ctx = () => ({ priceBook: store.prices, settings: store.settings });
const describeInputs = (item, sys) => (sys?.params || []).filter((p) => !['W', 'H'].includes(p.key)).map((p) => { const v = item.inputs?.[p.key]; if (v === undefined || v === '') return ''; const o = p.type === 'select' ? (p.options || []).find((x) => String(x.value) === String(v)) : null; return `${p.label.split(' ')[0]}: ${o ? o.label : v}`; }).filter(Boolean).join(' · ');

// ------------------------------------------------------------------ list
export function renderQuotes(container, _m, query) {
  const filter = query.status || 'all';
  const search = (query.q || '').toLowerCase();
  const list = store.quotes.filter((q) => (filter === 'all' || q.status === filter) && (!search || JSON.stringify([q.ref, q.client, q.project]).toLowerCase().includes(search)));
  const counts = Object.fromEntries(QUOTE_STATUSES.map((s) => [s.id, store.quotes.filter((q) => q.status === s.id).length]));
  container.innerHTML = `
    <div class="flex" style="margin-bottom:12px"><h1 style="margin:0">Quotations</h1><span class="spacer"></span>
      <input class="i" style="max-width:260px" id="search" placeholder="Search ref / client / project" value="${esc(query.q || '')}">
      <button class="btn p" data-act="new">+ New quotation</button></div>
    <div class="statusbar no-print" style="margin-bottom:12px">
      <a class="step ${filter === 'all' ? 'on' : ''}" href="#/quotes?status=all">All (${store.quotes.length})</a>
      ${QUOTE_STATUSES.map((s) => `<a class="step ${filter === s.id ? 'on' : ''}" href="#/quotes?status=${s.id}">${esc(s.label)} (${counts[s.id]})</a>`).join('')}
    </div>
    <div class="card">${list.length ? `<table class="t"><thead><tr><th>Ref</th><th>Date</th><th>Client / project</th><th>Status</th><th class="n">Items</th><th class="n">Area m²</th><th class="n">Net (SAR)</th><th class="n">Margin</th><th></th></tr></thead><tbody>
      ${list.map((q) => { const c = costQuote(q, store.systems, ctx()); return `<tr>
        <td><a href="#/quotes/${q.id}"><b>${esc(q.ref)}</b></a></td><td>${esc(q.date)}</td>
        <td>${esc(q.client.company || q.client.contact || '—')}<br><span class="sub">${esc(q.project.name || '')} ${q.project.location ? '· ' + esc(q.project.location) : ''}</span></td>
        <td>${badge(q.status)}</td><td class="n">${q.items.length}</td><td class="n">${num(c.areaM2, 2)}</td><td class="n">${money(c.net)}</td><td class="n">${pct(c.marginPct, 1)}</td>
        <td class="right"><a class="btn sm" href="#/quotes/${q.id}">Open</a></td></tr>`; }).join('')}
      </tbody></table>` : '<div class="empty">No quotations yet. Create one here or add an opening from the Estimator.</div>'}</div>`;
  container.querySelector('[data-act="new"]').onclick = () => { const q = store.newQuote(); navigate(`#/quotes/${q.id}`); };
  container.querySelector('#search').addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(`#/quotes?status=${filter}&q=${encodeURIComponent(e.target.value)}`); });
}

// ------------------------------------------------------------------ detail
export function renderQuote(container, id) {
  const q = store.getQuote(id);
  if (!q) { container.innerHTML = '<div class="err">Quotation not found.</div>'; return; }
  const draw = () => {
    const c = costQuote(q, store.systems, ctx());
    const s = store.settings;
    const next = { draft: ['sent', 'approved', 'rejected'], sent: ['approved', 'rejected', 'expired', 'draft'], approved: ['in_production', 'rejected', 'draft'], rejected: ['draft'], expired: ['draft', 'sent'], in_production: ['delivered', 'approved'], delivered: [] }[q.status] || ['draft'];
    container.innerHTML = `
      <div class="flex no-print" style="margin-bottom:12px"><a href="#/quotes">← Quotations</a><span class="spacer"></span>
        <a class="btn" href="#/quotes/${q.id}/print">Print / PDF quotation</a>
        <button class="btn" data-act="json">Export JSON</button>
        <button class="btn" data-act="csv">Export CSV</button>
        ${s.webhookUrl ? '<button class="btn" data-act="webhook">Push to webhook</button>' : ''}
        <button class="btn" data-act="dup">Duplicate as revision</button>
        <button class="btn bad" data-act="del">Delete</button></div>
      <div class="flex" style="margin-bottom:12px"><h1 style="margin:0">${esc(q.ref)}</h1>${badge(q.status)}<span class="sub">created ${esc(q.date)}${q.approvedAt ? ` · approved ${esc(q.approvedAt)}` : ''}</span></div>
      <div class="row">
        <div class="col">
          <div class="card"><h2>Client & project</h2><div class="grid c2">
            ${field('Client company', `<input class="i" data-path="client.company" value="${esc(q.client.company)}">`)}
            ${field('Contact (Eng. …)', `<input class="i" data-path="client.contact" value="${esc(q.client.contact)}">`)}
            ${field('Phone', `<input class="i" data-path="client.phone" value="${esc(q.client.phone)}">`)}
            ${field('Email', `<input class="i" data-path="client.email" value="${esc(q.client.email)}">`)}
            ${field('Project name', `<input class="i" data-path="project.name" value="${esc(q.project.name)}">`)}
            ${field('Location', `<input class="i" data-path="project.location" value="${esc(q.project.location)}">`)}
            ${field('Consultant', `<input class="i" data-path="project.consultant" value="${esc(q.project.consultant)}">`)}
            ${field('Main contractor', `<input class="i" data-path="project.contractor" value="${esc(q.project.contractor)}">`)}
            ${field('Reference', `<input class="i" data-path="ref" value="${esc(q.ref)}">`)}
            ${field('Date', `<input class="i" type="date" data-path="date" value="${esc(q.date)}">`)}
            ${field('Discount %', `<input class="i" type="number" step="0.5" data-path="discountPct" data-type="number" value="${esc(q.discountPct || 0)}">`)}
            ${field('Validity (days)', `<input class="i" type="number" data-path="validityDays" data-type="number" value="${esc(q.validityDays || 20)}">`)}
          </div>
          ${field('Notes (internal)', `<textarea class="i" data-path="notes" style="font-family:inherit">${esc(q.notes || '')}</textarea>`)}
          </div>
          <div class="card"><h2>Status</h2>
            <div class="statusbar">${['draft', 'sent', 'approved', 'in_production', 'delivered'].map((st) => `<span class="step ${q.status === st ? 'on' : ''}">${esc(statusOf(st).label)}</span>`).join('<span class="muted">›</span>')}</div>
            <div class="actions" style="margin-top:10px">${next.map((st) => `<button class="btn sm ${st === 'approved' ? 'ok' : st === 'rejected' ? 'bad' : ''}" data-status="${st}">Mark ${esc(statusOf(st).label)}</button>`).join('')}</div>
            ${q.status === 'approved' || q.status === 'in_production' || q.status === 'delivered' ? `<div class="ok-note" style="margin-top:10px">Customer approved. <a class="btn ok sm" href="#/shop/${q.id}">Generate shop drawings, cutting lists & bar optimization →</a></div>` : `<p class="sub" style="margin-top:8px">Shop drawings unlock when the quotation is marked <b>Approved</b>. <a href="#/shop/${q.id}">Preview anyway</a>.</p>`}
            <details class="adv" style="margin-top:8px"><summary>History</summary><ul class="sub">${(q.history || []).map((h) => `<li>${esc(h.at.slice(0, 16).replace('T', ' '))} — ${esc(statusOf(h.status).label)} ${h.note ? '· ' + esc(h.note) : ''}</li>`).join('')}</ul></details>
          </div>
        </div>
        <div class="col-2">
          <div class="card">
            <div class="flex"><h2 style="margin:0">Items (${q.items.length})</h2><span class="spacer"></span><a class="btn p sm" href="#/estimator?quote=${q.id}">+ Add opening</a></div>
            ${c.warnings.length ? `<div class="warn" style="margin-top:10px"><b>${c.warnings.length} pricing warning(s)</b> — fill the missing prices in the <a href="#/prices">price book</a>.<details><summary>show</summary><ul>${c.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details></div>` : ''}
            <div style="overflow-x:auto;margin-top:10px">${q.items.length ? `<table class="t"><thead><tr><th>Mark</th><th>System / configuration</th><th class="n">W × H</th><th class="n">Qty</th><th class="n">Area m²</th><th class="n">Cost / unit</th><th class="n">Price / unit</th><th class="n">Price / m²</th><th class="n">Amount</th><th></th></tr></thead><tbody>
              ${c.items.map(({ item, result }) => { const sys = store.getSystem(item.systemId); if (result.error) return `<tr><td>${esc(item.mark)}</td><td colspan="8" class="err">${esc(result.error)}</td><td><button class="btn sm bad" data-del="${item.id}">✕</button></td></tr>`; const u = result.unit; return `<tr>
                <td><b>${esc(item.mark)}</b><br><span class="sub">${esc(item.location || '')}</span></td>
                <td>${esc(sys?.name || item.systemName)}<br><span class="sub">${esc(describeInputs(item, sys))} ${item.glassKey ? '· ' + esc(store.prices.find((p) => p.code === item.glassKey)?.name || item.glassKey) : ''}</span></td>
                <td class="n">${esc(item.inputs.W)} × ${esc(item.inputs.H)}</td><td class="n">${item.qty}</td><td class="n">${num(result.areaM2, 2)}</td>
                <td class="n muted">${money(u.totalCost)}</td><td class="n">${money(u.sellingPrice)}</td><td class="n">${money(u.pricePerM2)}</td><td class="n"><b>${money(result.sellingPrice)}</b></td>
                <td class="right" style="white-space:nowrap"><a class="btn sm" href="#/estimator?quote=${q.id}&item=${item.id}">Edit</a> <button class="btn sm" data-dupitem="${item.id}">⧉</button> <button class="btn sm bad" data-del="${item.id}">✕</button></td></tr>`; }).join('')}
              </tbody></table>` : '<div class="empty">No items. Add openings from the Estimator.</div>'}</div>
          </div>
          <div class="card"><h2>Totals</h2>
            <div class="kpis">
              <div class="kpi"><div class="l">Total area</div><div class="v">${num(c.areaM2, 2)} <small>m²</small></div></div>
              <div class="kpi"><div class="l">Total cost</div><div class="v">${money(c.totalCost, 0)}</div></div>
              <div class="kpi hi"><div class="l">Net selling</div><div class="v">${money(c.net, 0)}</div></div>
              <div class="kpi"><div class="l">Profit / margin</div><div class="v">${money(c.profit, 0)} <small>${pct(c.marginPct, 1)}</small></div></div>
              <div class="kpi"><div class="l">Avg price / m²</div><div class="v">${money(c.areaM2 ? c.net / c.areaM2 : 0, 0)}</div></div>
              <div class="kpi"><div class="l">Total incl. VAT</div><div class="v">${money(c.total, 0)}</div></div>
            </div>
            <table class="t"><tbody>
              <tr><td>Subtotal</td><td class="n">${money(c.subtotal)}</td></tr>
              ${c.discount ? `<tr><td>Discount ${pct(c.discountPct, 1)}</td><td class="n">− ${money(c.discount)}</td></tr>` : ''}
              <tr class="sub"><td>Net (excl. VAT)</td><td class="n">${money(c.net)}</td></tr>
              <tr><td>VAT ${pct(c.vatPct, 0)}</td><td class="n">${money(c.vat)}</td></tr>
              <tr class="total"><td>Total</td><td class="n">${money(c.total)} ${esc(s.currency)}</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>`;

  };
    bindPaths(container, q, (path) => { if (path.startsWith('project.name') && !q.refLocked) { /* keep ref stable once created */ } store.saveQuote(q); });
    container.addEventListener('click', (e) => {
      const b = e.target.closest('button,[data-act]'); if (!b) return;
      if (b.dataset.status) { if (b.dataset.status === 'approved' && !confirmDialog('Mark this quotation as APPROVED by the customer? This unlocks shop drawings and production.')) return; store.setStatus(q, b.dataset.status); draw(); toast(`Status: ${statusOf(b.dataset.status).label}`); }
      else if (b.dataset.del) { if (!confirmDialog('Remove this item?')) return; q.items = q.items.filter((x) => x.id !== b.dataset.del); store.saveQuote(q); draw(); }
      else if (b.dataset.dupitem) { const it = q.items.find((x) => x.id === b.dataset.dupitem); const copy = JSON.parse(JSON.stringify(it)); copy.id = Math.random().toString(36).slice(2, 10); copy.mark = `${it.mark}-copy`; q.items.push(copy); store.saveQuote(q); draw(); }
      else if (b.dataset.act === 'json') download(`${q.ref.replace(/[\/\\]/g, '_')}.json`, JSON.stringify(exportQuote(q), null, 2));
      else if (b.dataset.act === 'csv') { const rows = c.items.filter((x) => !x.result.error).map(({ item, result }) => ({ mark: item.mark, location: item.location, system: result.system.name, width_mm: item.inputs.W, height_mm: item.inputs.H, qty: item.qty, area_m2: result.areaM2.toFixed(3), unit_cost_sar: result.unit.totalCost.toFixed(2), unit_price_sar: result.unit.sellingPrice.toFixed(2), price_per_m2: result.unit.pricePerM2.toFixed(2), amount_sar: result.sellingPrice.toFixed(2) })); download(`${q.ref.replace(/[\/\\]/g, '_')}.csv`, toCSV(rows, Object.keys(rows[0] || { mark: '' })), 'text/csv'); }
      else if (b.dataset.act === 'webhook') pushWebhook(q);
      else if (b.dataset.act === 'dup') { const copy = store.duplicateQuote(q); navigate(`#/quotes/${copy.id}`); }
      else if (b.dataset.act === 'del') { if (!confirmDialog(`Delete quotation ${q.ref}? This cannot be undone.`)) return; store.deleteQuote(q.id); navigate('#/quotes'); }
    });
  draw();
}

/** Integration payload: quotation + per-item cost sheet + Odoo-style order lines. */
export function exportQuote(q) {
  const c = costQuote(q, store.systems, ctx());
  return {
    ref: q.ref, date: q.date, status: q.status, approvedAt: q.approvedAt || null, client: q.client, project: q.project,
    currency: store.settings.currency, totals: { areaM2: c.areaM2, cost: c.totalCost, subtotal: c.subtotal, discountPct: c.discountPct, net: c.net, vatPct: c.vatPct, vat: c.vat, total: c.total, profit: c.profit, marginPct: c.marginPct },
    items: c.items.filter((x) => !x.result.error).map(({ item, result }) => ({
      id: item.id, mark: item.mark, location: item.location, systemId: item.systemId, system: result.system.name, mincoCode: result.system.mincoCode || null,
      inputs: item.inputs, qty: item.qty, glassKey: item.glassKey || result.system.defaultGlassKey || null,
      unit: { areaM2: result.unit.areaM2, cost: result.unit.totalCost, costPerM2: result.unit.costPerM2, price: result.unit.sellingPrice, pricePerM2: result.unit.pricePerM2,
        breakdown: { aluminum: result.unit.aluminum.cost, paint: result.unit.aluminum.paintCost, glass: result.unit.glass.cost, accessories: result.unit.accessories.cost, laborFabrication: result.unit.labor.fabrication, laborInstallation: result.unit.labor.installation, overhead: result.unit.overhead, profit: result.unit.profit } },
      amount: result.sellingPrice,
      takeoff: { pieces: result.unit.takeoff.pieces, glass: result.unit.takeoff.glass, accessories: result.unit.takeoff.accessories, variables: result.unit.takeoff.vars },
    })),
    odoo: { sale_order_lines: c.items.filter((x) => !x.result.error).map(({ item, result }) => ({ name: `${item.mark} — ${result.system.name} ${item.inputs.W}×${item.inputs.H} mm`, product_uom_qty: item.qty, price_unit: Math.round(result.unit.sellingPrice * 100) / 100, x_area_m2: result.areaM2 })) },
    warnings: c.warnings,
  };
}

async function pushWebhook(q) {
  const s = store.settings;
  try {
    const res = await fetch(s.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(s.webhookSecret ? { 'X-Webhook-Secret': s.webhookSecret } : {}) }, body: JSON.stringify({ event: 'quotation', ...exportQuote(q) }) });
    toast(res.ok ? `Webhook OK (${res.status})` : `Webhook failed (${res.status})`);
  } catch (e) { toast(`Webhook error: ${e.message}`); }
}

// ------------------------------------------------------------------ client-facing print
export function renderQuotePrint(container, id) {
  const q = store.getQuote(id);
  if (!q) { container.innerHTML = '<div class="err">Quotation not found.</div>'; return; }
  const c = costQuote(q, store.systems, ctx());
  const s = store.settings, co = s.company;
  const validUntil = new Date(new Date(q.date).getTime() + (q.validityDays || 20) * 86400000).toISOString().slice(0, 10);
  container.innerHTML = `
    <div class="flex no-print" style="margin-bottom:12px"><a href="#/quotes/${q.id}">← Back</a><span class="spacer"></span><button class="btn p" onclick="window.print()">Print / Save as PDF</button></div>
    <div class="card" style="max-width:900px;margin:0 auto">
      <div class="doc-head"><div><div class="brand">${esc(co.name.split(' ')[0].toLowerCase())}<small>${esc(co.name.split(' ').slice(1).join(' '))}</small></div><div class="tag-line">${esc(co.tagline)}</div></div>
        <div class="doc-meta"><div style="font-size:16px;font-weight:700">QUOTATION</div><div><b>Ref.</b> ${esc(q.ref)}</div><div><b>Date</b> ${esc(q.date)}</div><div><b>Valid to</b> ${esc(validUntil)}</div></div></div>
      <table class="t" style="margin-bottom:12px"><tbody>
        <tr><td style="width:140px"><b>Attn.</b></td><td>${esc(q.client.contact || 'Eng. ____________')} ${q.client.company ? '— ' + esc(q.client.company) : ''}</td></tr>
        <tr><td><b>Project</b></td><td>${esc(q.project.name || '—')}</td></tr>
        <tr><td><b>Location</b></td><td>${esc(q.project.location || '—')}</td></tr>
        ${q.project.consultant ? `<tr><td><b>Consultant</b></td><td>${esc(q.project.consultant)}</td></tr>` : ''}
        ${q.project.contractor ? `<tr><td><b>Main contractor</b></td><td>${esc(q.project.contractor)}</td></tr>` : ''}
        <tr><td><b>Subject</b></td><td>Supply and installation of aluminium and glass works</td></tr>
      </tbody></table>
      <p>Dear ${esc(q.client.contact || 'Eng. ____________')},</p>
      <p>With reference to your enquiry, ${esc(co.name)} is pleased to submit its offer for the aluminium and glass works listed below. Our rates cover supply, fabrication in our Riyadh factory and installation on site, per the specification stated against each item.</p>
      <div class="band">A — PRICED SCHEDULE OF OPENINGS</div>
      <table class="t"><thead><tr><th>Item</th><th>Description</th><th class="n">W × H (mm)</th><th class="n">Qty</th><th class="n">Area m²</th><th class="n">Rate / unit (SAR)</th><th class="n">Amount (SAR)</th></tr></thead><tbody>
        ${c.items.filter((x) => !x.result.error).map(({ item, result }, i) => { const sys = result.system; const g = store.prices.find((p) => p.code === (item.glassKey || sys.defaultGlassKey)); return `<tr><td>${i + 1}</td><td><b>${esc(item.mark)}</b> — ${esc(sys.name)}${sys.mincoCode ? ` (MINCO-${esc(sys.mincoCode)})` : ''}<br><span class="sub">${esc(describeInputs(item, sys))}${g ? ' · Glass: ' + esc(g.name) : ''}${item.location ? ' · ' + esc(item.location) : ''}</span></td><td class="n">${esc(item.inputs.W)} × ${esc(item.inputs.H)}</td><td class="n">${item.qty}</td><td class="n">${num(result.areaM2, 2)}</td><td class="n">${money(result.unit.sellingPrice)}</td><td class="n">${money(result.sellingPrice)}</td></tr>`; }).join('')}
        <tr class="sub"><td colspan="6">Subtotal</td><td class="n">${money(c.subtotal)}</td></tr>
        ${c.discount ? `<tr><td colspan="6">Discount ${pct(c.discountPct, 1)}</td><td class="n">− ${money(c.discount)}</td></tr>` : ''}
        <tr><td colspan="6">Net total excl. VAT</td><td class="n">${money(c.net)}</td></tr>
        <tr><td colspan="6">VAT ${pct(c.vatPct, 0)}</td><td class="n">${money(c.vat)}</td></tr>
        <tr class="total"><td colspan="6">TOTAL INCL. VAT</td><td class="n">${money(c.total)} ${esc(s.currency)}</td></tr>
      </tbody></table>
      <div class="band">B — TERMS & CONDITIONS</div>
      <ol style="font-size:12px;padding-left:18px">${(s.terms || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      <div class="row" style="margin-top:24px"><div class="col"><p>Yours faithfully,<br>For ${esc(co.name)}</p><br><br><p style="border-top:1px solid #111;display:inline-block;padding-top:4px">${esc(co.signatory)}</p></div>
      <div class="col"><p>Accepted by the Client:</p><br><br><p style="border-top:1px solid #111;display:inline-block;padding-top:4px;min-width:220px">Name / signature / date / stamp</p></div></div>
      <div class="doc-foot"><span>${esc(co.name)} · ${esc(co.web)} · ${esc(co.email)} · ${esc(co.phone)}</span><span>${esc(co.address)}</span></div>
    </div>`;
}
