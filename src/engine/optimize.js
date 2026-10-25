// 1-D cutting stock: pack piece lengths into stock bars (first-fit decreasing).
// Returns whole bars with their cut sequence, usage and offcut. Never fractional bars.

/**
 * @param {Array<{length:number, qty:number, label?:string, ref?:string}>} pieces
 * @param {number} barLength  stock length (mm)
 * @param {object} [opts]  { kerf: saw blade loss per cut (mm), endTrim: unusable length per bar end (mm) }
 */
export function packBars(pieces, barLength, opts = {}) {
  const kerf = opts.kerf ?? 5;
  const endTrim = opts.endTrim ?? 0;
  const usable = barLength - 2 * endTrim;
  const items = [];
  for (const p of pieces) {
    const n = Math.max(0, Math.round(p.qty || 0));
    for (let i = 0; i < n; i++) items.push({ length: p.length, label: p.label || '', ref: p.ref || '' });
  }
  items.sort((a, b) => b.length - a.length);
  const bars = [];
  const oversize = [];
  for (const it of items) {
    if (it.length > usable) { oversize.push(it); continue; }
    let placed = false;
    for (const bar of bars) {
      const need = it.length + (bar.cuts.length > 0 ? kerf : 0);
      if (bar.used + need <= usable) {
        bar.cuts.push(it);
        bar.used += need;
        placed = true;
        break;
      }
    }
    if (!placed) bars.push({ cuts: [it], used: it.length });
  }
  for (const bar of bars) {
    bar.offcut = Math.max(0, usable - bar.used);
    bar.utilization = bar.used / barLength;
  }
  const totalLength = items.reduce((s, i) => s + i.length, 0);
  return {
    barLength,
    kerf,
    bars,
    barCount: bars.length,
    totalPieces: items.length,
    totalLength,
    totalStock: bars.length * barLength,
    utilization: bars.length ? totalLength / (bars.length * barLength) : 0,
    oversize,
  };
}

/** Group pieces by profile code and pack each group. */
export function optimizeByProfile(pieces, defaultBarLength, opts = {}) {
  const groups = new Map();
  for (const p of pieces) {
    const key = p.profileCode || p.profileName;
    if (!groups.has(key)) groups.set(key, { profileCode: p.profileCode, profileName: p.profileName, barLength: p.barLength || defaultBarLength, pieces: [] });
    groups.get(key).pieces.push(p);
  }
  const out = [];
  for (const g of groups.values()) {
    out.push({ ...g, result: packBars(g.pieces, g.barLength, opts) });
  }
  return out;
}
