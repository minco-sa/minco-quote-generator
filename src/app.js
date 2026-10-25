import { store } from './store.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderEstimator } from './ui/estimator.js';
import { renderQuotes, renderQuote, renderQuotePrint } from './ui/quotes.js';
import { renderShop } from './ui/shop.js';
import { renderSystems, renderSystemEditor } from './ui/systems.js';
import { renderPrices } from './ui/prices.js';
import { renderSettings } from './ui/settings.js';
import { qs } from './ui/helpers.js';

const routes = [
  { re: /^#\/dashboard/, view: renderDashboard, nav: 'dashboard' },
  { re: /^#\/estimator/, view: renderEstimator, nav: 'estimator' },
  { re: /^#\/quotes\/([^/?]+)\/print/, view: (c, m, q) => renderQuotePrint(c, m[1], q), nav: 'quotes' },
  { re: /^#\/quotes\/([^/?]+)/, view: (c, m, q) => renderQuote(c, m[1], q), nav: 'quotes' },
  { re: /^#\/quotes/, view: renderQuotes, nav: 'quotes' },
  { re: /^#\/shop\/([^/?]+)/, view: (c, m, q) => renderShop(c, m[1], q), nav: 'quotes' },
  { re: /^#\/systems\/new/, view: (c, m, q) => renderSystemEditor(c, null, q), nav: 'systems' },
  { re: /^#\/systems\/([^/?]+)/, view: (c, m, q) => renderSystemEditor(c, m[1], q), nav: 'systems' },
  { re: /^#\/systems/, view: renderSystems, nav: 'systems' },
  { re: /^#\/prices/, view: renderPrices, nav: 'prices' },
  { re: /^#\/settings/, view: renderSettings, nav: 'settings' },
];

function route() {
  const hash = location.hash || '#/dashboard';
  const r = routes.find((x) => x.re.test(hash)) || routes[0];
  const m = hash.match(r.re) || [];
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === r.nav));
  const main = document.getElementById('app');
  const container = document.createElement('div');
  main.replaceChildren(container);
  try { r.view(container, m, qs(hash)); }
  catch (e) { console.error(e); container.innerHTML = `<div class="err"><b>Error rendering view:</b> ${e.message}</div><pre class="mono">${e.stack}</pre>`; }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
window.MINCO = { store };
route();
