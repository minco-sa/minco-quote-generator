// Take-off + costing for a single opening (one unit) and for quotation items.
import { evaluate, evalNumber } from './formula.js';

const roundTo = (v, step) => (step ? Math.round(v / step) * step : v);

/** Build the variable scope for a system from user inputs. */
export function buildScope(system, inputs) {
  const vars = {};
  const warnings = [];
  for (const p of system.params || []) {
    let v = inputs[p.key];
    if (v === undefined || v === null || v === '') v = p.default;
    if (p.type === 'select') {
      const opt = (p.options || []).find((o) => String(o.value) === String(v));
      if (!opt) { warnings.push(`Parameter ${p.key}: unknown option "${v}"`); vars[p.key] = v; continue; }
      vars[p.key] = opt.value;
      Object.assign(vars, opt.set || {});
    } else {
      const n = Number(v);
      vars[p.key] = Number.isFinite(n) ? n : v;
    }
  }
  for (const c of system.constants || []) vars[c.key] = Number(c.value);
  for (const d of system.variables || []) {
    try { vars[d.key] = evaluate(d.expr, vars); }
    catch (e) { warnings.push(`Variable ${d.key}: ${e.message}`); vars[d.key] = 0; }
  }
  return { vars, warnings };
}

/**
 * Take-off for ONE unit of an opening.
 * @returns {{vars, pieces, glass, accessories, areaM2, perimeterM, warnings}}
 */
export function takeoff(system, inputs) {
  const { vars, warnings } = buildScope(system, inputs);
  const rounding = system.rounding ?? 1;
  const pieces = [];
  for (const prof of system.profiles || []) {
    for (const pc of prof.pieces || []) {
      try {
        const qty = Math.round(evalNumber(pc.qty, vars, `${prof.name} / ${pc.label} qty`));
        if (qty <= 0) continue;
        const length = roundTo(evalNumber(pc.length, vars, `${prof.name} / ${pc.label} length`), rounding);
        if (length <= 0) { warnings.push(`${prof.name} / ${pc.label}: non-positive length ${length}`); continue; }
        pieces.push({ profileCode: prof.code, profileName: prof.name, priceKey: prof.priceKey || prof.code, barLength: prof.barLength || system.barLength || 6000, weightKgM: prof.weightKgM || 0, finish: prof.finish || '', label: pc.label, length, qty });
      } catch (e) { warnings.push(e.message); }
    }
  }
  const glass = [];
  for (const g of system.glass || []) {
    try {
      const qty = Math.round(evalNumber(g.qty, vars, `${g.label} qty`));
      if (qty <= 0) continue;
      const w = Math.floor(evalNumber(g.width, vars, `${g.label} width`));
      const h = Math.floor(evalNumber(g.height, vars, `${g.label} height`));
      if (w <= 0 || h <= 0) { warnings.push(`${g.label}: non-positive glass size ${w} × ${h}`); continue; }
      glass.push({ label: g.label, w, h, qty, areaM2: (w * h) / 1e6, priceKey: g.priceKey || null });
    } catch (e) { warnings.push(e.message); }
  }
  const accessories = [];
  for (const a of system.accessories || []) {
    try {
      const qty = evalNumber(a.qty, vars, `${a.name} qty`);
      if (qty <= 0) continue;
      accessories.push({ code: a.code || '', name: a.name, unit: a.unit || 'pc', priceKey: a.priceKey || a.code, qty: a.unit === 'pc' || !a.unit ? Math.ceil(qty) : Math.round(qty * 100) / 100 });
    } catch (e) { warnings.push(e.message); }
  }
  const W = Number(vars.W) || 0, H = Number(vars.H) || 0;
  return { vars, pieces, glass, accessories, areaM2: (W * H) / 1e6, perimeterM: (2 * (W + H)) / 1000, warnings };
}

/** Lookup a price-book entry. */
export function findPrice(priceBook, key) {
  if (!key) return null;
  return priceBook.find((p) => p.code === key || p.key === key) || null;
}

/** A price-book entry counts as priced only when it carries a positive price. */
export const isPriced = (pr) => !!pr && Number(pr.price) > 0;

/**
 * Cost ONE unit of an opening. Aluminum priced on theoretical bars (length × (1+waste) / barLength);
 * actual purchase bars come from the project-level optimizer.
 */
export function costUnit(system, inputs, ctx) {
  const { priceBook = [], settings = {}, glassPriceKey = null, overrides = {} } = ctx;
  const t = takeoff(system, inputs);
  const warnings = [...t.warnings];
  const waste = {
    aluminum: overrides.wasteAluminum ?? system.waste ?? settings.wasteAluminum ?? 0.05,
    glass: settings.wasteGlass ?? 0.05,
    accessories: settings.wasteAccessories ?? 0.0,
  };

  // --- Aluminum
  const byProfile = new Map();
  for (const p of t.pieces) {
    const k = p.profileCode || p.profileName;
    if (!byProfile.has(k)) byProfile.set(k, { profileCode: p.profileCode, profileName: p.profileName, priceKey: p.priceKey, barLength: p.barLength, weightKgM: p.weightKgM, finish: p.finish, lengthMm: 0, pieces: 0 });
    const g = byProfile.get(k);
    g.lengthMm += p.length * p.qty;
    g.pieces += p.qty;
  }
  const alumLines = [];
  let alumCost = 0, alumWeight = 0, paintCost = 0;
  for (const g of byProfile.values()) {
    const pr = findPrice(priceBook, g.priceKey);
    const lengthWithWaste = g.lengthMm * (1 + waste.aluminum);
    const barsTheoretical = lengthWithWaste / g.barLength;
    let pricePerBar = 0;
    if (!isPriced(pr)) warnings.push(`No price for profile ${g.profileCode} (${g.profileName}) — سعر غير متوفر`);
    else if (pr.unit === 'bar') pricePerBar = pr.price;
    else if (pr.unit === 'm') pricePerBar = pr.price * (g.barLength / 1000);
    else if (pr.unit === 'kg' && g.weightKgM) pricePerBar = pr.price * g.weightKgM * (g.barLength / 1000);
    else warnings.push(`Profile ${g.profileCode}: price unit "${pr.unit}" needs weight/m or bar price`);
    const cost = barsTheoretical * pricePerBar;
    const weightKg = g.weightKgM ? (lengthWithWaste / 1000) * g.weightKgM : 0;
    alumWeight += weightKg;
    if (inputs.PAINT && g.finish === 'mill' && settings.paintingPerKg) {
      if (weightKg) paintCost += weightKg * settings.paintingPerKg;
      else warnings.push(`Profile ${g.profileCode}: painting needs weight/m`);
    }
    alumLines.push({ ...g, lengthM: g.lengthMm / 1000, lengthWithWasteM: lengthWithWaste / 1000, barsTheoretical, barsRounded: Math.ceil(barsTheoretical), pricePerBar, cost, weightKg, supplier: pr?.supplier || '', priceDate: pr?.date || '', missingPrice: !isPriced(pr) });
    alumCost += cost;
  }

  // --- Glass
  const glassLines = [];
  let glassCost = 0, glassArea = 0;
  for (const g of t.glass) {
    const key = g.priceKey || glassPriceKey || system.defaultGlassKey || settings.defaultGlassKey;
    const pr = findPrice(priceBook, key);
    const minArea = pr?.minArea || 0;
    const billedPerLite = Math.max(g.areaM2, minArea);
    const billedArea = billedPerLite * g.qty * (1 + waste.glass);
    if (!isPriced(pr)) warnings.push(`No glass price for "${key || '(none selected)'}"`);
    const cost = billedArea * (pr?.price || 0);
    glassLines.push({ ...g, glassKey: key, glassName: pr?.name || key || '—', totalAreaM2: g.areaM2 * g.qty, billedAreaM2: billedArea, pricePerM2: pr?.price || 0, cost, missingPrice: !isPriced(pr) });
    glassCost += cost;
    glassArea += g.areaM2 * g.qty;
  }

  // --- Accessories
  const accLines = [];
  let accCost = 0;
  for (const a of t.accessories) {
    const pr = findPrice(priceBook, a.priceKey);
    if (!isPriced(pr)) warnings.push(`No price for accessory ${a.priceKey || ''} (${a.name}) — سعر غير متوفر`);
    const qty = a.qty * (1 + waste.accessories);
    const cost = qty * (pr?.price || 0);
    accLines.push({ ...a, unitPrice: pr?.price || 0, supplier: pr?.supplier || '', cost, missingPrice: !isPriced(pr) });
    accCost += cost;
  }

  // --- Labour
  const cat = system.category || 'other';
  const lab = (settings.labor && settings.labor[cat]) || system.labor || { fabricationPerM2: 0, installationPerM2: 0, fixedPerUnit: 0 };
  const laborFab = t.areaM2 * (overrides.fabricationPerM2 ?? lab.fabricationPerM2 ?? 0) + (lab.fixedPerUnit || 0);
  const laborInst = inputs.INSTALL === false ? 0 : t.areaM2 * (overrides.installationPerM2 ?? lab.installationPerM2 ?? 0);
  const laborCost = laborFab + laborInst;

  const materialCost = alumCost + paintCost + glassCost + accCost;
  const directCost = materialCost + laborCost;
  const overheadPct = overrides.overheadPct ?? settings.overheadPct ?? 0;
  const overhead = directCost * overheadPct / 100;
  const totalCost = directCost + overhead;
  const profitPct = overrides.profitPct ?? settings.profitPct ?? 25;
  const profit = totalCost * profitPct / 100;
  const sellingPrice = totalCost + profit;
  const vatPct = settings.vatPct ?? 15;
  const vat = sellingPrice * vatPct / 100;
  const area = t.areaM2 || 0;

  return {
    takeoff: t,
    areaM2: area,
    aluminum: { lines: alumLines, cost: alumCost, weightKg: alumWeight, paintCost },
    glass: { lines: glassLines, cost: glassCost, areaM2: glassArea },
    accessories: { lines: accLines, cost: accCost },
    labor: { fabrication: laborFab, installation: laborInst, cost: laborCost, rates: lab },
    materialCost, directCost, overheadPct, overhead, totalCost,
    costPerM2: area ? totalCost / area : 0,
    profitPct, profit, sellingPrice,
    pricePerM2: area ? sellingPrice / area : 0,
    marginPct: sellingPrice ? (profit / sellingPrice) * 100 : 0,
    vatPct, vat, totalWithVat: sellingPrice + vat,
    waste, warnings,
  };
}

/** Cost a quotation item (unit × qty). */
export function costItem(item, systems, ctx) {
  const system = systems.find((s) => s.id === item.systemId);
  if (!system) return { error: `System ${item.systemId} not found` };
  const qty = Math.max(1, Math.round(Number(item.qty) || 1));
  const unit = costUnit(system, item.inputs || {}, { ...ctx, glassPriceKey: item.glassKey, overrides: item.overrides || {} });
  const scale = (v) => v * qty;
  return {
    system, qty, unit,
    areaM2: scale(unit.areaM2),
    totalCost: scale(unit.totalCost),
    sellingPrice: scale(unit.sellingPrice),
    profit: scale(unit.profit),
    vat: scale(unit.vat),
    totalWithVat: scale(unit.totalWithVat),
    materialCost: scale(unit.materialCost),
    laborCost: scale(unit.labor.cost),
    warnings: unit.warnings,
  };
}

/** Aggregate a whole quotation. */
export function costQuote(quote, systems, ctx) {
  const items = (quote.items || []).map((it) => ({ item: it, result: costItem(it, systems, ctx) }));
  const sum = (f) => items.reduce((s, x) => s + (x.result.error ? 0 : f(x.result)), 0);
  const discountPct = Number(quote.discountPct) || 0;
  const subtotal = sum((r) => r.sellingPrice);
  const discount = subtotal * discountPct / 100;
  const net = subtotal - discount;
  const vatPct = ctx.settings?.vatPct ?? 15;
  const vat = net * vatPct / 100;
  const totalCost = sum((r) => r.totalCost);
  return {
    items,
    areaM2: sum((r) => r.areaM2),
    totalCost,
    materialCost: sum((r) => r.materialCost),
    laborCost: sum((r) => r.laborCost),
    subtotal, discountPct, discount, net, vatPct, vat, total: net + vat,
    profit: net - totalCost,
    marginPct: net ? ((net - totalCost) / net) * 100 : 0,
    warnings: items.flatMap((x) => (x.result.error ? [x.result.error] : x.result.warnings.map((w) => `${x.item.mark || ''}: ${w}`))),
  };
}

/** Flatten all cut pieces of a quote (× item qty) for project-level bar optimization. */
export function projectPieces(quote, systems) {
  const out = [];
  for (const it of quote.items || []) {
    const sys = systems.find((s) => s.id === it.systemId);
    if (!sys) continue;
    const t = takeoff(sys, it.inputs || {});
    const q = Math.max(1, Math.round(Number(it.qty) || 1));
    for (const p of t.pieces) out.push({ ...p, qty: p.qty * q, ref: it.mark || '', label: `${it.mark || ''} ${p.label}`.trim() });
  }
  return out;
}

/** Glass order list for a quote (grouped by size + spec). */
export function projectGlass(quote, systems, ctx) {
  const map = new Map();
  for (const it of quote.items || []) {
    const sys = systems.find((s) => s.id === it.systemId);
    if (!sys) continue;
    const t = takeoff(sys, it.inputs || {});
    const q = Math.max(1, Math.round(Number(it.qty) || 1));
    for (const g of t.glass) {
      const key = g.priceKey || it.glassKey || sys.defaultGlassKey || ctx.settings?.defaultGlassKey || '';
      const pr = findPrice(ctx.priceBook || [], key);
      const k = `${key}|${g.w}x${g.h}`;
      if (!map.has(k)) map.set(k, { glassKey: key, glassName: pr?.name || key, w: g.w, h: g.h, qty: 0, marks: new Set() });
      const e = map.get(k);
      e.qty += g.qty * q;
      e.marks.add(it.mark || '');
    }
  }
  return [...map.values()].map((e) => ({ ...e, marks: [...e.marks].join(', '), areaM2: (e.w * e.h * e.qty) / 1e6 })).sort((a, b) => b.areaM2 - a.areaM2);
}

/** Accessories order list for a quote. */
export function projectAccessories(quote, systems, ctx) {
  const map = new Map();
  for (const it of quote.items || []) {
    const sys = systems.find((s) => s.id === it.systemId);
    if (!sys) continue;
    const t = takeoff(sys, it.inputs || {});
    const q = Math.max(1, Math.round(Number(it.qty) || 1));
    for (const a of t.accessories) {
      const k = a.priceKey || a.name;
      if (!map.has(k)) map.set(k, { ...a, qty: 0 });
      map.get(k).qty += a.qty * q;
    }
  }
  return [...map.values()].map((a) => {
    const pr = findPrice(ctx.priceBook || [], a.priceKey);
    const qty = a.unit === 'pc' ? Math.ceil(a.qty) : Math.round(a.qty * 100) / 100;
    return { ...a, qty, unitPrice: pr?.price || 0, cost: qty * (pr?.price || 0), supplier: pr?.supplier || '', missingPrice: !isPriced(pr) };
  });
}
