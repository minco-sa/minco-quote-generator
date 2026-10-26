// Turn the store's data into search documents.
import { store } from '../store.js';
import { QUOTE_STATUSES } from '../data/settings.js';

const statusLabel = (id) => QUOTE_STATUSES.find((s) => s.id === id)?.label || id;

export function buildDocs() {
  const docs = [];
  for (const q of store.quotes) {
    const customer = q.client?.company || q.client?.contact || '';
    docs.push({ kind: 'quote', id: q.id, href: `#/quotes/${q.id}`, title: `${q.ref} — ${q.project?.name || ''}`.trim(), date: q.updatedAt || q.date,
      body: [customer, q.client?.contact, q.project?.location, statusLabel(q.status), ...(q.items || []).map((i) => `${i.mark} ${i.systemName || ''} ${i.inputs?.W}x${i.inputs?.H}`)].filter(Boolean).join(' · '),
      fields: { customer, status: statusLabel(q.status) + ' ' + q.status, city: q.project?.location || '', project: q.project?.name || '', ref: q.ref, system: (q.items || []).map((i) => i.systemName || '').join(' ') } });
    for (const it of q.items || []) {
      const sys = store.getSystem(it.systemId);
      docs.push({ kind: 'position', id: `${q.id}:${it.id}`, href: `#/quotes/${q.id}`, title: `${it.mark} ${it.inputs?.W} x ${it.inputs?.H} — ${sys?.name || it.systemName || ''}`, date: q.updatedAt || q.date,
        body: [q.ref, q.project?.name, customer, it.location, `qty ${it.qty}`, sys?.family, sys?.supplier].filter(Boolean).join(' · '),
        fields: { customer, status: statusLabel(q.status) + ' ' + q.status, system: `${sys?.name || ''} ${sys?.family || ''} ${sys?.id || ''}`, supplier: sys?.supplier || '', mark: it.mark || '', project: q.project?.name || '', ref: q.ref } });
    }
  }
  for (const s of store.systems) docs.push({ kind: 'system', id: s.id, href: `#/systems/${s.id}`, title: s.name, date: '', body: [s.nameAr, s.family, s.supplier, s.mincoCode ? `MINCO-${s.mincoCode}` : '', s.description].filter(Boolean).join(' · '), fields: { system: `${s.name} ${s.family || ''} ${s.id}`, supplier: s.supplier || '', status: s.verified ? 'factory sheet verified' : 'not verified' } });
  for (const p of store.prices) docs.push({ kind: 'price', id: p.code, href: `#/prices?q=${encodeURIComponent(p.code)}`, title: `${p.code} — ${p.name}`, date: p.date, body: [p.category, p.unit, `${p.price} SAR`, p.supplier, p.source].filter(Boolean).join(' · '), fields: { supplier: p.supplier || '', status: p.category } });
  return docs;
}
