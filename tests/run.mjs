// Run: node tests/run.mjs — validates the engine against the factory-sheet examples.
import assert from 'node:assert/strict';
import { evaluate } from '../src/engine/formula.js';
import { takeoff, costUnit, costQuote, projectPieces } from '../src/engine/calc.js';
import { packBars, optimizeByProfile } from '../src/engine/optimize.js';
import { DEFAULT_SYSTEMS } from '../src/data/systems.js';
import { DEFAULT_PRICES } from '../src/data/prices.js';
import { DEFAULT_SETTINGS } from '../src/data/settings.js';

let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('✓', name); } catch (e) { console.error('✗', name, '\n  ', e.message); process.exitCode = 1; } };
const sys = (id) => DEFAULT_SYSTEMS.find((s) => s.id === id);
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('formula: arithmetic & precedence', () => {
  assert.equal(evaluate('2 + 3 * 4'), 14);
  assert.equal(evaluate('(2 + 3) * 4'), 20);
  assert.equal(evaluate('W/2 - 93', { W: 2400 }), 1107);
  assert.equal(evaluate('-W + 10', { W: 4 }), 6);
  assert.equal(evaluate('2 ^ 3 ^ 2'), 512);
});
test('formula: functions, comparisons, strings', () => {
  assert.equal(evaluate("if(CFG == '3_SFS', 1, 0)", { CFG: '3_SFS' }), 1);
  assert.equal(evaluate("pick(CFG, '2', 10, '3', 20, 99)", { CFG: '3' }), 20);
  assert.equal(evaluate("pick(CFG, '2', 10, '3', 20, 99)", { CFG: 'x' }), 99);
  assert.equal(evaluate('ceil(2 * (W + H) / 1000 / 8)', { W: 2400, H: 2200 }), 2);
  assert.equal(evaluate('max(1, 5, 3) + min(4, 2)'), 7);
  assert.equal(evaluate('TOP > 0 && W > 100', { TOP: 0, W: 200 }), 0);
  assert.throws(() => evaluate('X + 1', {}), /Unknown variable/);
  assert.throws(() => evaluate('1 / 0'), /Division by zero/);
  assert.throws(() => evaluate('foo(1)'), /Unknown function/);
});

test('SARAYA_120 sliding 2-panel: W240 × H220 cm factory example', () => {
  const t = takeoff(sys('SARAYA_120_SLIDING'), { W: 2400, H: 2200, CFG: '2', TOP: 0, FLY: '1' });
  assert.deepEqual(t.warnings, []);
  assert.equal(t.vars.FW, 2317); assert.equal(t.vars.FH, 2117);
  assert.equal(t.vars.SIDE, 2134); assert.equal(t.vars.TB, 1107);
  assert.equal(t.vars.GW, 1103); assert.equal(t.vars.GH, 2025);
  assert.equal(t.vars.FLYW, 1104); assert.equal(t.vars.FLYH, 2045);
  const find = (lbl) => t.pieces.find((p) => p.label === lbl);
  assert.equal(find('Head / sill').qty, 2); assert.equal(find('Head / sill').length, 2317);
  assert.equal(find('Sash stile (SIDE)').qty, 2);
  assert.equal(find('Interlock (CTR)').qty, 2);
  assert.equal(find('Sash top / bottom rail').qty, 4);
  assert.equal(find('Fly stile').qty, 4);
  assert.equal(t.glass.length, 1); assert.equal(t.glass[0].qty, 2);
  close(t.glass[0].areaM2, 1.103 * 2.025, 1e-6);
  close(t.areaM2, 5.28);
});
test('SARAYA_120 sliding 4_FSSF: fixed panels have no interlock / rollers', () => {
  const t = takeoff(sys('SARAYA_120_SLIDING'), { W: 4000, H: 2200, CFG: '4_FSSF', TOP: 0 });
  assert.equal(t.vars.TB, 1000 - 81);
  assert.equal(t.pieces.find((p) => p.label === 'Interlock (CTR)').qty, 2);
  assert.equal(t.pieces.find((p) => p.label === 'Fixed panel stile').qty, 4);
  assert.equal(t.accessories.find((a) => a.name.startsWith('Sliding rollers')).qty, 4);
  assert.equal(t.glass[0].qty, 4);
});
test('SARAYA_120 sliding with top fixed light', () => {
  const t = takeoff(sys('SARAYA_120_SLIDING'), { W: 2400, H: 2800, CFG: '2', TOP: 850 });
  assert.equal(t.vars.SIDE, (2800 - 850) - 69);
  assert.equal(t.vars.TB, (2400 - 191) / 2);
  assert.equal(t.glass.length, 2);
  assert.equal(t.glass[1].w, 2290); assert.equal(t.glass[1].h, 795);
  assert.equal(t.pieces.find((p) => p.label === 'Transom').qty, 1);
});
test('SARAYA_105 fixed: W120 × H120 cm', () => {
  const t = takeoff(sys('SARAYA_105_FIXED'), { W: 1200, H: 1200, MUL: '0' });
  assert.equal(t.vars.FW, 1104); assert.equal(t.vars.GW, 1138); assert.equal(t.vars.GH, 1138);
  const tm = takeoff(sys('SARAYA_105_FIXED'), { W: 1200, H: 1200, MUL: '1' });
  assert.equal(tm.vars.GW, 550); assert.equal(tm.glass[0].qty, 2);
  assert.equal(tm.pieces.find((p) => p.label === 'Centre mullion').length, 1148);
});
test('SARAYA_105 hung + fixed', () => {
  const t = takeoff(sys('SARAYA_105_HUNG'), { W: 1000, H: 1400 });
  assert.equal(t.vars.SW, 772.5); assert.equal(t.vars.SH, 484.5);
  assert.equal(t.glass[0].w, 808); assert.equal(t.glass[0].h, 520);
  assert.equal(t.glass[1].w, 938); assert.equal(t.glass[1].h, 650);
});
test('Royal 120 2-panel (mm skill example W2000 × H1500)', () => {
  const t = takeoff(sys('ROYAL_120_SLIDING_2P'), { W: 2000, H: 1500, ROLL: 'std' });
  assert.equal(t.vars.SW, 1025); assert.equal(t.vars.SH, 1440);
  assert.equal(t.glass[0].w, 900); assert.equal(t.glass[0].h, 1315);
});
test('SG50 curtain wall grid', () => {
  const t = takeoff(sys('SG50_STICK_CW'), { W: 6000, H: 4000, NCOL: 4, NROW: 2 });
  assert.equal(t.pieces.find((p) => p.label === 'Mullion').qty, 5);
  assert.equal(t.pieces.find((p) => p.label === 'Transom').qty, 12);
  assert.equal(t.pieces.find((p) => p.label === 'Transom').length, 1450);
  assert.equal(t.glass[0].qty, 8); assert.equal(t.glass[0].w, 1480); assert.equal(t.glass[0].h, 1980);
});

test('packBars: FFD, kerf, whole bars only', () => {
  const r = packBars([{ length: 2317, qty: 2 }, { length: 2117, qty: 2 }], 6000, { kerf: 5 });
  assert.equal(r.barCount, 2);
  assert.equal(r.bars[0].cuts.length, 2);
  assert.ok(Number.isInteger(r.barCount));
  const o = packBars([{ length: 7000, qty: 1 }], 6000);
  assert.equal(o.oversize.length, 1);
});

test('costUnit: SARAYA_120 cost rollup is consistent', () => {
  const c = costUnit(sys('SARAYA_120_SLIDING'), { W: 2400, H: 2200, CFG: '2', TOP: 0, FLY: '1' }, { priceBook: DEFAULT_PRICES, settings: DEFAULT_SETTINGS });
  close(c.areaM2, 5.28);
  const frame = c.aluminum.lines.find((l) => l.profileCode === '1020070530');
  close(frame.lengthM, (2317 * 2 + 2117 * 2) / 1000, 1e-6);
  close(frame.barsTheoretical, frame.lengthWithWasteM / 6, 1e-9);
  close(frame.cost, frame.barsTheoretical * 132, 1e-6);
  close(c.materialCost, c.aluminum.cost + c.aluminum.paintCost + c.glass.cost + c.accessories.cost, 1e-6);
  close(c.directCost, c.materialCost + c.labor.cost, 1e-6);
  close(c.totalCost, c.directCost * 1.10, 1e-6);
  close(c.sellingPrice, c.totalCost * 1.25, 1e-6);
  close(c.costPerM2, c.totalCost / 5.28, 1e-6);
  close(c.vat, c.sellingPrice * 0.15, 1e-6);
  assert.ok(c.warnings.some((w) => w.includes('ACC_SASH_CORNER')), 'missing-price items are flagged');
  assert.ok(c.totalCost > 0);
  console.log(`   → cost/m² ${c.costPerM2.toFixed(2)}  price/m² ${c.pricePerM2.toFixed(2)}  total ${c.sellingPrice.toFixed(2)} SAR`);
});
test('glass minimum billed area applies per lite', () => {
  const c = costUnit(sys('SARAYA_105_FIXED'), { W: 400, H: 400, MUL: '0' }, { priceBook: DEFAULT_PRICES, settings: DEFAULT_SETTINGS, glassPriceKey: 'GL_DGU24_HDGREY_TGF' });
  const g = c.glass.lines[0];
  close(g.billedAreaM2, 0.35 * 1.05, 1e-9);
});
test('costQuote aggregates items × qty and project pieces scale', () => {
  const quote = { items: [
    { mark: 'W1', systemId: 'SARAYA_120_SLIDING', qty: 3, inputs: { W: 2400, H: 2200, CFG: '2', TOP: 0, FLY: '1' } },
    { mark: 'W2', systemId: 'SARAYA_105_FIXED', qty: 2, inputs: { W: 1200, H: 1200, MUL: '0' } },
  ], discountPct: 5 };
  const ctx = { priceBook: DEFAULT_PRICES, settings: DEFAULT_SETTINGS };
  const q = costQuote(quote, DEFAULT_SYSTEMS, ctx);
  close(q.areaM2, 5.28 * 3 + 1.44 * 2);
  close(q.net, q.subtotal * 0.95, 1e-6);
  close(q.total, q.net * 1.15, 1e-6);
  const pieces = projectPieces(quote, DEFAULT_SYSTEMS);
  assert.equal(pieces.find((p) => p.label === 'W1 Head / sill').qty, 6);
  const opt = optimizeByProfile(pieces, 6000, { kerf: 5 });
  const frame = opt.find((g) => g.profileCode === '1020070530');
  assert.equal(frame.result.totalPieces, 12);
  assert.ok(frame.result.barCount >= Math.ceil(frame.result.totalLength / 6000));
});

console.log(`\n${passed} tests passed${process.exitCode ? ', some FAILED' : ''}`);
