import { store } from '../store.js';
import { costQuote } from '../engine/calc.js';
import { QUOTE_STATUSES } from '../data/settings.js';
import { esc, money, num, pct } from './helpers.js';
import { badge } from './quotes.js';

export function renderDashboard(container) {
  const ctx = { priceBook: store.prices, settings: store.settings };
  const rows = store.quotes.map((q) => ({ q, c: costQuote(q, store.systems, ctx) }));
  const by = (st) => rows.filter((r) => r.q.status === st);
  const sum = (list, f) => list.reduce((a, r) => a + f(r), 0);
  const approvedLike = rows.filter((r) => ['approved', 'in_production', 'delivered'].includes(r.q.status));
  const decided = rows.filter((r) => ['approved', 'in_production', 'delivered', 'rejected', 'expired'].includes(r.q.status));
  const winRate = decided.length ? (approvedLike.length / decided.length) * 100 : 0;
  const missing = store.prices.filter((p) => !(Number(p.price) > 0)).length;
  container.innerHTML = `
    <h1>Dashboard</h1>
    <div class="kpis">
      <div class="kpi"><div class="l">Quotations</div><div class="v">${rows.length}</div></div>
      <div class="kpi"><div class="l">Open (draft + sent)</div><div class="v">${by('draft').length + by('sent').length} <small>${money(sum([...by('draft'), ...by('sent')], (r) => r.c.net), 0)} SAR</small></div></div>
      <div class="kpi hi"><div class="l">Approved value</div><div class="v">${money(sum(approvedLike, (r) => r.c.net), 0)} <small>SAR</small></div></div>
      <div class="kpi"><div class="l">Win rate</div><div class="v">${pct(winRate, 0)} <small>${approvedLike.length}/${decided.length}</small></div></div>
      <div class="kpi"><div class="l">Approved area</div><div class="v">${num(sum(approvedLike, (r) => r.c.areaM2), 1)} <small>m²</small></div></div>
      <div class="kpi"><div class="l">Avg margin (approved)</div><div class="v">${pct(approvedLike.length ? sum(approvedLike, (r) => r.c.marginPct) / approvedLike.length : 0, 1)}</div></div>
    </div>
    <div class="row">
      <div class="col-2"><div class="card"><div class="flex"><h2 style="margin:0">Recent quotations</h2><span class="spacer"></span><a class="btn p sm" href="#/estimator">+ Estimate an opening</a></div>
        ${rows.length ? `<table class="t" style="margin-top:10px"><thead><tr><th>Ref</th><th>Client / project</th><th>Status</th><th class="n">Net SAR</th><th class="n">SAR/m²</th></tr></thead><tbody>
          ${rows.slice(0, 12).map(({ q, c }) => `<tr><td><a href="#/quotes/${q.id}"><b>${esc(q.ref)}</b></a><br><span class="sub">${esc(q.date)}</span></td><td>${esc(q.client.company || q.client.contact || '—')}<br><span class="sub">${esc(q.project.name || '')}</span></td><td>${badge(q.status)}</td><td class="n">${money(c.net, 0)}</td><td class="n">${money(c.areaM2 ? c.net / c.areaM2 : 0, 0)}</td></tr>`).join('')}
        </tbody></table>` : '<div class="empty">No quotations yet. Start in the <a href="#/estimator">Estimator</a>: pick a system, enter W × H, read the cost per m², then add the opening to a quotation.</div>'}
      </div></div>
      <div class="col">
        <div class="card"><h2>Pipeline</h2><table class="t"><tbody>${QUOTE_STATUSES.map((s) => `<tr><td>${badge(s.id)}</td><td class="n">${by(s.id).length}</td><td class="n">${money(sum(by(s.id), (r) => r.c.net), 0)}</td></tr>`).join('')}</tbody></table></div>
        <div class="card"><h2>Library</h2>
          <p><b>${store.systems.length}</b> systems · <b>${store.prices.length}</b> price-book items ${missing ? `· <span class="tag miss">${missing} without price</span>` : ''}</p>
          <div class="actions"><a class="btn sm" href="#/systems">Systems</a><a class="btn sm" href="#/prices">Price book</a><a class="btn sm" href="#/settings">Settings</a></div>
          <p class="sub" style="margin-top:10px">Workflow: Estimator → add openings to a quotation → send → mark Approved → Shop drawings (elevations, cutting lists, bar optimization, glass & hardware order) → production.</p>
        </div>
      </div>
    </div>`;
}
