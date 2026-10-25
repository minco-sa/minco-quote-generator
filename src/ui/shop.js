import { store } from '../store.js';
import { takeoff, costQuote, projectPieces, projectGlass, projectAccessories, findPrice, isPriced } from '../engine/calc.js';
import { optimizeByProfile } from '../engine/optimize.js';
import { elevationSVG, barsSVG } from '../engine/drawing.js';
import { esc, money, num, mm, pct, download, toCSV } from './helpers.js';
import { badge } from './quotes.js';

export function renderShop(container, id) {
  const q = store.getQuote(id);
  if (!q) { container.innerHTML = '<div class="err">Quotation not found.</div>'; return; }
  const s = store.settings, co = s.company;
  const ctx = { priceBook: store.prices, settings: s };
  const approved = ['approved', 'in_production', 'delivered'].includes(q.status);
  const pieces = projectPieces(q, store.systems);
  const opt = optimizeByProfile(pieces, s.barLength || 6000, { kerf: s.kerf ?? 5, endTrim: s.endTrim ?? 0 });
  const glassOrder = projectGlass(q, store.systems, ctx);
  const accOrder = projectAccessories(q, store.systems, ctx);
  const cost = costQuote(q, store.systems, ctx);
  const purchase = opt.map((g) => { const pr = findPrice(store.prices, g.pieces[0]?.priceKey || g.profileCode); const pricePerBar = isPriced(pr) ? (pr.unit === 'bar' ? pr.price : pr.unit === 'm' ? pr.price * g.barLength / 1000 : 0) : 0; return { ...g, pricePerBar, cost: g.result.barCount * pricePerBar, supplier: pr?.supplier || '', missing: !isPriced(pr) }; });
  const totalBarsCost = purchase.reduce((a, b) => a + b.cost, 0);
  const totalGlassArea = glassOrder.reduce((a, g) => a + g.areaM2, 0);

  container.innerHTML = `
    <div class="flex no-print" style="margin-bottom:12px"><a href="#/quotes/${q.id}">← Quotation ${esc(q.ref)}</a>${badge(q.status)}<span class="spacer"></span>
      <button class="btn" data-act="csv-cut">Cutting list CSV</button><button class="btn" data-act="csv-glass">Glass order CSV</button><button class="btn" data-act="json">Production JSON</button>
      <button class="btn p" onclick="window.print()">Print shop drawings</button></div>
    ${!approved ? '<div class="warn no-print"><b>Preview only.</b> This quotation is not yet approved by the customer. Mark it <b>Approved</b> on the quotation page before releasing to the workshop.</div>' : ''}
    <div class="card">
      <div class="doc-head"><div><div class="brand">${esc(co.name.split(' ')[0].toLowerCase())}<small>${esc(co.name.split(' ').slice(1).join(' '))}</small></div><div class="tag-line">SHOP DRAWINGS · CUTTING LISTS · MATERIAL ORDER</div></div>
        <div class="doc-meta"><div><b>Ref.</b> ${esc(q.ref)}</div><div><b>Project</b> ${esc(q.project.name || '—')}</div><div><b>Client</b> ${esc(q.client.company || q.client.contact || '—')}</div><div><b>Approved</b> ${esc(q.approvedAt || '—')}</div><div><b>Issued</b> ${new Date().toISOString().slice(0, 10)}</div></div></div>
      <div class="kpis">
        <div class="kpi"><div class="l">Openings</div><div class="v">${q.items.reduce((a, i) => a + (Number(i.qty) || 1), 0)} <small>units · ${q.items.length} types</small></div></div>
        <div class="kpi"><div class="l">Area</div><div class="v">${num(cost.areaM2, 2)} <small>m²</small></div></div>
        <div class="kpi"><div class="l">Profiles</div><div class="v">${purchase.reduce((a, g) => a + g.result.barCount, 0)} <small>bars × ${s.barLength / 1000} m</small></div></div>
        <div class="kpi"><div class="l">Glass</div><div class="v">${glassOrder.reduce((a, g) => a + g.qty, 0)} <small>lites · ${num(totalGlassArea, 2)} m²</small></div></div>
        <div class="kpi"><div class="l">Avg bar utilization</div><div class="v">${pct(purchase.length ? (purchase.reduce((a, g) => a + g.result.utilization, 0) / purchase.length) * 100 : 0, 1)}</div></div>
      </div>
    </div>

    <h2 class="print-only">1 — Elevations & cutting lists per opening</h2>
    ${q.items.map((item, idx) => {
      const sys = store.getSystem(item.systemId); if (!sys) return `<div class="err">Item ${esc(item.mark)}: system missing</div>`;
      const t = takeoff(sys, item.inputs || {});
      const qty = Math.max(1, Number(item.qty) || 1);
      const glassName = findPrice(store.prices, item.glassKey || sys.defaultGlassKey)?.name || '';
      return `<div class="card ${idx > 0 ? 'page-break' : ''}">
        <div class="flex"><h2 style="margin:0">${esc(item.mark)} — ${esc(sys.name)}</h2><span class="tag">${esc(item.inputs.W)} × ${esc(item.inputs.H)} mm</span><span class="tag">× ${qty}</span>${item.location ? `<span class="sub">${esc(item.location)}</span>` : ''}</div>
        ${t.warnings.length ? `<div class="warn"><ul>${t.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
        <div class="row">
          <div class="col" style="flex:1 1 300px">${elevationSVG(sys, t.vars, t.glass, { title: `${item.mark} · ${(sys.params || []).filter((p) => p.type === 'select').map((p) => { const o = (p.options || []).find((x) => String(x.value) === String(item.inputs[p.key])); return o ? o.label : ''; }).filter(Boolean).join(' · ')}` })}
            <table class="t" style="margin-top:8px"><thead><tr><th>Glass</th><th class="n">W × H</th><th class="n">Pcs/unit</th><th class="n">Total</th></tr></thead><tbody>
              ${t.glass.map((g) => `<tr><td>${esc(g.label)}<br><span class="sub">${esc(glassName)}</span></td><td class="n"><b>${g.w} × ${g.h}</b></td><td class="n">${g.qty}</td><td class="n">${g.qty * qty}</td></tr>`).join('')}</tbody></table>
            <table class="t" style="margin-top:8px"><thead><tr><th>Key dimensions</th><th class="n">mm</th></tr></thead><tbody>
              ${(sys.variables || []).filter((v) => typeof t.vars[v.key] === 'number' && t.vars[v.key] > 0).map((v) => `<tr><td><span class="mono">${esc(v.key)}</span> ${v.label ? '<span class="sub">' + esc(v.label) + '</span>' : ''}</td><td class="n">${mm(t.vars[v.key])}</td></tr>`).join('')}</tbody></table>
          </div>
          <div class="col-2">
            <table class="t"><thead><tr><th>Profile</th><th>Piece</th><th class="n">Length (mm)</th><th class="n">Pcs/unit</th><th class="n">Total pcs</th><th class="n">Total m</th></tr></thead><tbody>
              ${t.pieces.map((p) => `<tr><td><span class="mono">${esc(p.profileCode)}</span><br><span class="sub">${esc(p.profileName)}</span></td><td>${esc(p.label)}</td><td class="n"><b>${mm(p.length)}</b></td><td class="n">${p.qty}</td><td class="n">${p.qty * qty}</td><td class="n">${num((p.length * p.qty * qty) / 1000, 2)}</td></tr>`).join('')}</tbody></table>
            <h3 style="margin-top:12px">Hardware & consumables per unit (× ${qty})</h3>
            <table class="t"><thead><tr><th>Code</th><th>Item</th><th class="n">Per unit</th><th class="n">Total</th><th>Unit</th></tr></thead><tbody>
              ${t.accessories.map((a) => `<tr><td class="mono">${esc(a.code)}</td><td>${esc(a.name)}</td><td class="n">${num(a.qty, a.unit === 'pc' ? 0 : 2)}</td><td class="n">${num(a.qty * qty, a.unit === 'pc' ? 0 : 2)}</td><td>${esc(a.unit)}</td></tr>`).join('')}</tbody></table>
          </div>
        </div></div>`;
    }).join('')}

    <div class="card page-break"><h2>2 — Bar optimization & aluminium purchase list (${s.barLength / 1000} m stock, kerf ${s.kerf} mm)</h2>
      <table class="t"><thead><tr><th>Profile</th><th class="n">Pieces</th><th class="n">Net length (m)</th><th class="n">Bars</th><th class="n">Utilization</th><th class="n">Offcut (m)</th><th class="n">SAR / bar</th><th class="n">Cost (SAR)</th><th>Supplier</th></tr></thead><tbody>
        ${purchase.map((g) => `<tr><td><span class="mono">${esc(g.profileCode)}</span> ${g.missing ? '<span class="tag miss">no price</span>' : ''}<br><span class="sub">${esc(g.profileName)}</span></td><td class="n">${g.result.totalPieces}</td><td class="n">${num(g.result.totalLength / 1000, 2)}</td><td class="n"><b>${g.result.barCount}</b></td><td class="n">${pct(g.result.utilization * 100, 1)}</td><td class="n">${num((g.result.totalStock - g.result.totalLength) / 1000, 2)}</td><td class="n">${money(g.pricePerBar)}</td><td class="n">${money(g.cost)}</td><td class="sub">${esc(g.supplier)}</td>${g.result.oversize.length ? `<td class="err">${g.result.oversize.length} piece(s) longer than stock!</td>` : ''}</tr>`).join('')}
        <tr class="total"><td colspan="3">Total</td><td class="n">${purchase.reduce((a, g) => a + g.result.barCount, 0)}</td><td colspan="3"></td><td class="n">${money(totalBarsCost)}</td><td></td></tr>
      </tbody></table>
      <p class="sub">Compare with the theoretical aluminium in the quotation cost (${money(cost.items.reduce((a, x) => a + (x.result.error ? 0 : x.result.unit.aluminum.cost * x.result.qty), 0))} SAR incl. waste allowance). Actual whole-bar purchase is what you order.</p>
      ${purchase.map((g) => `<details class="adv" ${purchase.length <= 6 ? 'open' : ''}><summary>${esc(g.profileCode)} — ${esc(g.profileName)} · ${g.result.barCount} bars</summary>${barsSVG(g.result)}
        <table class="t" style="margin:6px 0 12px"><thead><tr><th>Bar</th><th>Cuts (mm · mark)</th><th class="n">Offcut</th></tr></thead><tbody>${g.result.bars.map((b, i) => `<tr><td>${i + 1}</td><td>${b.cuts.map((c) => `${mm(c.length)}${c.ref ? ' <span class="sub">' + esc(c.ref) + '</span>' : ''}`).join(' | ')}</td><td class="n">${Math.round(b.offcut)}</td></tr>`).join('')}</tbody></table></details>`).join('')}
    </div>

    <div class="card page-break"><h2>3 — Glass order</h2>
      <table class="t"><thead><tr><th>Specification</th><th class="n">W × H (mm)</th><th class="n">Pcs</th><th class="n">Area m²</th><th>Marks</th></tr></thead><tbody>
        ${glassOrder.map((g) => `<tr><td>${esc(g.glassName)}</td><td class="n"><b>${g.w} × ${g.h}</b></td><td class="n">${g.qty}</td><td class="n">${num(g.areaM2, 3)}</td><td class="sub">${esc(g.marks)}</td></tr>`).join('')}
        <tr class="total"><td>Total</td><td></td><td class="n">${glassOrder.reduce((a, g) => a + g.qty, 0)}</td><td class="n">${num(totalGlassArea, 3)}</td><td></td></tr>
      </tbody></table>
      <p class="sub">Sizes are finished glass sizes (rounded down to 1 mm). Confirm supplier minimum billed area per lite and tempering before ordering.</p>
    </div>

    <div class="card"><h2>4 — Hardware & consumables order</h2>
      <table class="t"><thead><tr><th>Code</th><th>Item</th><th class="n">Qty</th><th>Unit</th><th class="n">Unit price</th><th class="n">Cost</th><th>Supplier</th></tr></thead><tbody>
        ${accOrder.map((a) => `<tr><td class="mono">${esc(a.code)}</td><td>${esc(a.name)} ${a.missingPrice ? '<span class="tag miss">no price</span>' : ''}</td><td class="n"><b>${num(a.qty, a.unit === 'pc' ? 0 : 2)}</b></td><td>${esc(a.unit)}</td><td class="n">${money(a.unitPrice)}</td><td class="n">${money(a.cost)}</td><td class="sub">${esc(a.supplier)}</td></tr>`).join('')}
        <tr class="total"><td colspan="5">Total</td><td class="n">${money(accOrder.reduce((a, b) => a + b.cost, 0))}</td><td></td></tr>
      </tbody></table>
    </div>`;

  container.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const safe = q.ref.replace(/[\/\\]/g, '_');
    if (b.dataset.act === 'csv-cut') download(`${safe}-cutting-list.csv`, toCSV(pieces.map((p) => ({ mark: p.ref, profile_code: p.profileCode, profile: p.profileName, piece: p.label.replace(p.ref, '').trim(), length_mm: p.length, qty: p.qty })), ['mark', 'profile_code', 'profile', 'piece', 'length_mm', 'qty']), 'text/csv');
    if (b.dataset.act === 'csv-glass') download(`${safe}-glass-order.csv`, toCSV(glassOrder.map((g) => ({ spec: g.glassName, width_mm: g.w, height_mm: g.h, qty: g.qty, area_m2: g.areaM2.toFixed(3), marks: g.marks })), ['spec', 'width_mm', 'height_mm', 'qty', 'area_m2', 'marks']), 'text/csv');
    if (b.dataset.act === 'json') download(`${safe}-production.json`, JSON.stringify({ ref: q.ref, project: q.project, approvedAt: q.approvedAt, barLength: s.barLength, kerf: s.kerf, pieces, bars: purchase.map((g) => ({ profileCode: g.profileCode, profileName: g.profileName, barCount: g.result.barCount, utilization: g.result.utilization, bars: g.result.bars })), glass: glassOrder, accessories: accOrder, mrp: { bom_lines: [...purchase.map((g) => ({ product_code: g.profileCode, name: g.profileName, qty: g.result.barCount, uom: 'bar' })), ...glassOrder.map((g) => ({ product_code: g.glassKey, name: `${g.glassName} ${g.w}×${g.h}`, qty: g.qty, uom: 'pc', area_m2: g.areaM2 })), ...accOrder.map((a) => ({ product_code: a.code, name: a.name, qty: a.qty, uom: a.unit }))] } }, null, 2));
  });
}
