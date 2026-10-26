import assert from 'node:assert/strict';
import { normalize, parseQuery, buildIndex, search } from '../src/search/engine.js';
let n = 0; const test = (name, fn) => { try { fn(); n++; console.log('✓', name); } catch (e) { console.error('✗', name, e.message); process.exitCode = 1; } };
const docs = [
  { kind: 'quote', id: 'q1', title: 'MINCO/Q/2026/1025-ABU-SULTAN — فيلا أبو سلطان', body: 'Eng. Fahad · Riyadh · Sent to client', date: '2026-10-25', fields: { customer: 'أبو سلطان', status: 'sent', city: 'Riyadh', system: 'Gulf GE-SL 120' } },
  { kind: 'position', id: 'p1', title: 'W01 2400 x 1500 — Sliding window — 2 panels', body: 'MINCO/Q/2026/1025-ABU-SULTAN · qty 3', date: '2026-10-25', fields: { system: 'Gulf GE-SL 120', customer: 'أبو سلطان' } },
  { kind: 'position', id: 'p2', title: 'CW-02 6000 x 4000 — Curtain wall SG50', body: 'Al Ageel · qty 1', date: '2026-09-01', fields: { system: 'SG50', customer: 'Al Ageel' } },
  { kind: 'system', id: 's1', title: 'Schüco FWS 50 — stick curtain wall', body: 'supplier SCH', date: '', fields: { system: 'Schüco FWS 50', supplier: 'SCH' } },
  { kind: 'price', id: '1020070530', title: '1020070530 — حلق 10سم سرايا شفة 4سم أسود', body: 'profile · bar · 132 SAR · DHY', date: '2026-09-29', fields: { supplier: 'DHY' } },
  { kind: 'price', id: 'gulf', title: 'GE-SL-120-F — Gulf GE-SL 120 frame', body: 'profile', date: '2026-09-29', fields: { system: 'Gulf GE-SL 120', supplier: 'GULF' } },
];
const idx = buildIndex(docs);
const titles = (r) => r.hits.map((h) => h.doc.id);
test('normalize folds Arabic, accents, digits and ×', () => {
  assert.equal(normalize('أبو سلطان'), 'ابو سلطان'); assert.equal(normalize('Schüco'), 'schuco'); assert.equal(normalize('٢٤٠٠×١٥٠٠'), '2400x1500'); assert.equal(normalize('مَدْرَسَة'), 'مدرسه');
});
test('ابو سلطان (no hamza) finds the أبو سلطان villa', () => { const r = search(idx, 'ابو سلطان'); assert.ok(titles(r).includes('q1')); assert.equal(r.corrected, null); });
test('curtian wal (misspelled) finds CW-02 via fuzzy fallback', () => { const r = search(idx, 'curtian wal'); assert.ok(titles(r).includes('p2')); assert.equal(r.hits[0].tier, 'fuzzy'); });
test('schuco finds Schüco', () => { assert.equal(titles(search(idx, 'schuco'))[0], 's1'); });
test('٢٤٠٠×١٥٠٠ finds W01 2400 x 1500', () => { assert.equal(titles(search(idx, '٢٤٠٠×١٥٠٠'))[0], 'p1'); assert.equal(titles(search(idx, '2400x1500'))[0], 'p1'); });
test('scope token system:"Gulf GE-SL 120" returns only that system\'s docs', () => { const r = search(idx, 'system:"Gulf GE-SL 120"'); assert.deepEqual(new Set(titles(r)), new Set(['q1', 'p1', 'gulf'])); });
test('scope + text, type: and نوع:', () => { assert.deepEqual(titles(search(idx, 'type:price gulf')), ['gulf']); assert.deepEqual(titles(search(idx, 'نوع:system schuco')), ['s1']); assert.deepEqual(parseQuery('customer:ageel wall').scopes, { customer: 'ageel' }); });
test('exact title outranks prefix, sections and snippets', () => { const r = search(idx, 'W01 2400 x 1500 — Sliding window — 2 panels'); assert.equal(r.hits[0].doc.id, 'p1'); assert.equal(r.sections[0].kind, 'top'); assert.ok(search(idx, 'سرايا').hits[0].snippet.includes('«سرايا»')); });
test('recent strategy orders by date', () => { const r = search(idx, 'x', { strategy: 'recent' }); assert.ok(r.hits.length >= 2); assert.ok(r.hits[0].doc._time >= r.hits[r.hits.length - 1].doc._time); });
test('suggestions complete the last token', () => { const r = search(idx, 'cur'); assert.ok(r.suggestions.some((s) => s.startsWith('curtain'))); });
console.log(`${n} search tests passed`);
