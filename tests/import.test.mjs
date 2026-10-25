import assert from 'node:assert/strict';
import { matchLine, dahayanSection, detectSupplier, guessColumns, guessCategory } from '../src/import/invoices.js';
import { suggestSystem } from '../src/import/drawings.js';
import { DEFAULT_PRICES } from '../src/data/prices.js';
import { DEFAULT_SYSTEMS } from '../src/data/systems.js';
let n = 0; const test = (name, fn) => { try { fn(); n++; console.log('✓', name); } catch (e) { console.error('✗', name, e.message); process.exitCode = 1; } };
test('dahayan section parsing', () => { assert.equal(dahayanSection('1020070530'), '2007'); assert.equal(dahayanSection('1012100530'), '1210'); assert.equal(dahayanSection('ABC'), null); });
test('match exact / section / name / new', () => {
  const pb = [...DEFAULT_PRICES, { code: '1210', name: 'Sliding frame 120 section 1210', category: 'profile', unit: 'bar', price: 0 }];
  assert.equal(matchLine({ code: '1020070530', description: 'x' }, pb).status, 'exact');
  const m = matchLine({ code: '1012100530', description: 'حلق 12سم' }, pb); assert.equal(m.status, 'section'); assert.equal(m.code, '1210');
  assert.equal(matchLine({ code: '', description: 'كالون DOMUS سرايا مروحة أسود' }, pb).status, 'name');
  assert.equal(matchLine({ code: 'ZZZ', description: 'totally unknown thing' }, pb).status, 'new');
});
test('supplier detection by VAT and name', () => { assert.equal(detectSupplier({ supplier_vat: '300047882500003' }), 'DHY'); assert.equal(detectSupplier({ supplier_name: 'شركة الإسناد التجارية' }), 'ESC'); assert.equal(detectSupplier({ supplier_cr: '1010278952' }), 'TGF'); assert.equal(detectSupplier({ supplier_name: 'nobody' }), ''); });
test('column guessing', () => { const g = guessColumns(['رقم الصنف', 'البيان', 'الوحدة', 'سعر الوحدة', 'الكمية']); assert.deepEqual([g.code, g.name, g.unit, g.price, g.qty], ['رقم الصنف', 'البيان', 'الوحدة', 'سعر الوحدة', 'الكمية']); });
test('category guess', () => { assert.equal(guessCategory({ unit: 'm2', description: 'زجاج' }), 'glass'); assert.equal(guessCategory({ unit: 'bar', description: 'حلق' }), 'profile'); assert.equal(guessCategory({ unit: 'pc', description: 'كالون' }), 'accessory'); });
test('system suggestion from opening type', () => {
  assert.equal(suggestSystem({ type: 'sliding', fix_height_mm: 0 }, DEFAULT_SYSTEMS), 'CL_SLIDING_2P');
  assert.equal(suggestSystem({ type: 'sliding', fix_height_mm: 500 }, DEFAULT_SYSTEMS), 'CL_SLIDING_2P_FIX');
  assert.equal(suggestSystem({ type: 'door', fix_height_mm: 500 }, DEFAULT_SYSTEMS), 'CL_DOOR_FIX');
  assert.equal(suggestSystem({ type: 'fixed', fix_height_mm: 0 }, DEFAULT_SYSTEMS), 'CL_FIXED');
});
console.log(`${n} import tests passed`);
