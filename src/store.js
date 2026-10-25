// Persistence: localStorage-backed collections with seed defaults and JSON backup.
import { DEFAULT_SYSTEMS, RETIRED_SYSTEM_IDS, LIBRARY_VERSION } from './data/systems.js';
import { CLIST_PRICE_PLACEHOLDERS } from './data/systems-clist.js';
import { DEFAULT_PRICES } from './data/prices.js';
import { DEFAULT_SETTINGS } from './data/settings.js';

const NS = 'minco.estimator.v1';
const KEYS = { systems: `${NS}.systems`, prices: `${NS}.prices`, quotes: `${NS}.quotes`, settings: `${NS}.settings`, clients: `${NS}.clients`, version: `${NS}.libraryVersion`, imports: `${NS}.imports` };

const read = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error('storage write failed', e); } };
const clone = (v) => JSON.parse(JSON.stringify(v));

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const today = () => new Date().toISOString().slice(0, 10);

export const store = {
  systems: read(KEYS.systems, null) || clone(DEFAULT_SYSTEMS),
  prices: read(KEYS.prices, null) || clone([...DEFAULT_PRICES, ...CLIST_PRICE_PLACEHOLDERS]),
  imports: read(KEYS.imports, []),
  quotes: read(KEYS.quotes, []),
  clients: read(KEYS.clients, []),
  settings: deepMerge(clone(DEFAULT_SETTINGS), read(KEYS.settings, {})),
  listeners: new Set(),

  save(what) {
    if (!what || what === 'imports') write(KEYS.imports, this.imports);
    if (!what || what === 'systems') write(KEYS.systems, this.systems);
    if (!what || what === 'prices') write(KEYS.prices, this.prices);
    if (!what || what === 'quotes') write(KEYS.quotes, this.quotes);
    if (!what || what === 'clients') write(KEYS.clients, this.clients);
    if (!what || what === 'settings') write(KEYS.settings, this.settings);
    this.listeners.forEach((l) => l(what));
  },
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },

  // ---- systems
  getSystem(id) { return this.systems.find((s) => s.id === id); },
  upsertSystem(sys) {
    const i = this.systems.findIndex((s) => s.id === sys.id);
    if (i >= 0) this.systems[i] = sys; else this.systems.push(sys);
    this.save('systems');
  },
  deleteSystem(id) { this.systems = this.systems.filter((s) => s.id !== id); this.save('systems'); },
  resetSystems() { this.systems = clone(DEFAULT_SYSTEMS); this.save('systems'); },

  // ---- prices
  upsertPrice(p, { keepHistory = true } = {}) {
    const i = this.prices.findIndex((x) => x.code === p.code);
    if (i >= 0) {
      const old = this.prices[i];
      const history = Array.isArray(old.history) ? old.history.slice() : [];
      if (keepHistory && Number(old.price) > 0 && (Number(old.price) !== Number(p.price) || (p.date && p.date !== old.date))) {
        history.unshift({ price: Number(old.price), date: old.date || '', source: old.source || '', supplier: old.supplier || '' });
      }
      this.prices[i] = { ...old, ...p, history: history.slice(0, 30) };
    } else this.prices.push({ ...p, history: [] });
    this.save('prices');
  },
  /** Price variance (min–max) over history + current, for flagging >5% swings. */
  priceRange(p) {
    const vals = [Number(p.price), ...(p.history || []).map((h) => Number(h.price))].filter((v) => v > 0);
    if (!vals.length) return null;
    return { min: Math.min(...vals), max: Math.max(...vals) };
  },
  logImport(entry) { this.imports.unshift({ at: new Date().toISOString(), ...entry }); this.imports = this.imports.slice(0, 200); this.save('imports'); },
  deletePrice(code) { this.prices = this.prices.filter((p) => p.code !== code); this.save('prices'); },
  resetPrices() { this.prices = clone(DEFAULT_PRICES); this.save('prices'); },

  // ---- quotes
  getQuote(id) { return this.quotes.find((q) => q.id === id); },
  newQuote(partial = {}) {
    const d = today();
    const q = {
      id: uid(), ref: '', date: d, status: 'draft', history: [{ at: new Date().toISOString(), status: 'draft', note: 'Created' }],
      client: { company: '', contact: '', phone: '', email: '' },
      project: { name: '', location: '', consultant: '', contractor: '' },
      items: [], discountPct: 0, notes: '', validityDays: this.settings.validityDays || 20,
      ...partial,
    };
    if (!q.ref) q.ref = this.nextRef(q);
    this.quotes.unshift(q);
    this.save('quotes');
    return q;
  },
  nextRef(q) {
    const d = (q.date || today()).replace(/-/g, '');
    const slug = (q.project?.name || 'PRJ').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 14) || 'PRJ';
    const base = `${this.settings.company.refPrefix}/${d.slice(0, 4)}/${d.slice(4, 8)}-${slug}`;
    const n = this.quotes.filter((x) => x.id !== q.id && x.ref && x.ref.startsWith(base)).length;
    return n ? `${base}-R${n}` : base;
  },
  saveQuote(q) {
    const i = this.quotes.findIndex((x) => x.id === q.id);
    q.updatedAt = new Date().toISOString();
    if (i >= 0) this.quotes[i] = q; else this.quotes.unshift(q);
    this.save('quotes');
  },
  setStatus(q, status, note = '') {
    q.status = status;
    q.history = q.history || [];
    q.history.push({ at: new Date().toISOString(), status, note });
    if (status === 'approved') q.approvedAt = today();
    this.saveQuote(q);
  },
  deleteQuote(id) { this.quotes = this.quotes.filter((q) => q.id !== id); this.save('quotes'); },
  duplicateQuote(q) {
    const copy = clone(q);
    copy.id = uid(); copy.date = today(); copy.status = 'draft'; copy.approvedAt = undefined;
    copy.history = [{ at: new Date().toISOString(), status: 'draft', note: `Revision of ${q.ref}` }];
    copy.ref = this.nextRef(copy);
    this.quotes.unshift(copy); this.save('quotes');
    return copy;
  },

  // ---- backup
  exportAll() { return { exportedAt: new Date().toISOString(), version: 1, systems: this.systems, prices: this.prices, quotes: this.quotes, clients: this.clients, settings: this.settings }; },
  importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
    if (Array.isArray(data.systems)) this.systems = data.systems;
    if (Array.isArray(data.prices)) this.prices = data.prices;
    if (Array.isArray(data.quotes)) this.quotes = data.quotes;
    if (Array.isArray(data.clients)) this.clients = data.clients;
    if (data.settings) this.settings = deepMerge(clone(DEFAULT_SETTINGS), data.settings);
    this.save();
  },
};

/** Bring stored libraries up to the current defaults without overwriting user edits. */
function migrateLibrary() {
  const v = Number(read(KEYS.version, 0)) || 0;
  if (v >= LIBRARY_VERSION) return;
  const usedIds = new Set(store.quotes.flatMap((q) => (q.items || []).map((i) => i.systemId)));
  for (const d of DEFAULT_SYSTEMS) if (!store.systems.some((s) => s.id === d.id)) store.systems.push(clone(d));
  store.systems = store.systems.filter((s) => !(RETIRED_SYSTEM_IDS.includes(s.id) && !usedIds.has(s.id)));
  store.systems.forEach((s) => { if (RETIRED_SYSTEM_IDS.includes(s.id)) s.retired = true; });
  for (const p of CLIST_PRICE_PLACEHOLDERS) if (!store.prices.some((x) => x.code === p.code)) store.prices.push(clone(p));
  if (v < 3) {
    // v3: price book rebuilt from marefty_purchase_prices.csv (2026-10-25) — previous prices move to history.
    for (const p of DEFAULT_PRICES) store.upsertPrice(clone(p));
    for (const q of store.quotes) for (const it of q.items || []) if (['GL_DGU24_HDGREY_TGF', 'GL_6_CLEAR_TMP_SEC'].includes(it.glassKey) && !store.prices.some((x) => x.code === it.glassKey)) it.glassKey = '';
    const stale = ['BOX_LEAF', 'BOX_BEAD', 'ACC_CW_BRACKET', 'ACC_DOOR_LOCK', 'ACC_DOOR_CLOSER', 'ACC_DOOR_HINGE'];
    store.prices = store.prices.filter((x) => !(stale.includes(x.code) && !(Number(x.price) > 0)));
    if (!store.settings.defaultGlassKey || store.settings.defaultGlassKey === 'GL_6_CLEAR_TMP_SEC') { store.settings.defaultGlassKey = 'GL_DGU24_TINTED'; store.save('settings'); }
  }
  write(KEYS.version, LIBRARY_VERSION);
  store.save('systems'); store.save('prices');
}
migrateLibrary();

function deepMerge(base, over) {
  if (!over || typeof over !== 'object') return base;
  for (const k of Object.keys(over)) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') base[k] = deepMerge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}
